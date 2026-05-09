// Lightweight Market Data Layer client for subscriptions, replay, and validation
// Provides a clear API to subscribe to ticks with options,
// and returns a handle supporting unsubscribe/pause/resume and replay requests.
//
// Data Flow: RawTick (internal buffer) → MarketFrame (DB) → UITick (handler delivery)
// This ensures agents and UI never see raw exchange data.

import type { UITick } from '../types/UITick';
import { createLiveUITick, markUITickFinal, addUITickWarning } from '../types/UITick';
import type { RawTick } from '../types/RawTick';

/**
 * @deprecated Use UITick instead.
 * WorldTick is an internal alias for backward compatibility during migration.
 */
export type WorldTick = UITick;

/**
 * Internal RawTick-like buffer (not exposed to agents/UI).
 */
interface BufferedTick extends RawTick {
  _internalId: string;
}

export interface SubscribeOptions {
  timeframe?: string; // e.g. '1m', '5s' — explicitly string to avoid magic numbers
  includeIndicators?: boolean; // request indicators from MDL
  rateLimitMs?: number; // client-side rate limit for handler calls (ms)
  bufferMax?: number; // max retained buffered ticks
}

/**
 * Handler receives UITick (safe, annotated) — never RawTick.
 */
export type TickHandler = (tick: UITick) => void | Promise<void>;

function isNumber(n: any): n is number { return typeof n === 'number' && !isNaN(n); }

/**
 * Validate RawTick structure (internal check only).
 * @internal Only used by MDL buffer, not exposed.
 */
function validateRawTick(t: any): t is RawTick {
  if (!t || typeof t !== 'object') return false;
  if (!t.symbol || typeof t.symbol !== 'string') return false;
  if (!isNumber(t.ts ?? t.timestamp)) return false;
  // Accept timestamps in seconds or milliseconds (defensive)
  const ts = t.ts ?? t.timestamp;
  if (ts < 1e10) return false; // anything < ~2001 in seconds is invalid
  if (!isNumber(t.price)) return false;
  if (t.side && !['buy', 'sell'].includes(t.side)) return false;
  if (t.size !== undefined && !isNumber(t.size)) return false;
  return true;
}

/**
 * @deprecated Use validateRawTick instead.
 * Kept for backward compatibility during migration.
 */
export function validateWorldTick(t: any): t is WorldTick {
  return validateRawTick(t);
}

type Sub = {
  id: string;
  symbol: string;
  opts: SubscribeOptions;
  handler: TickHandler;
  paused: boolean;
  buffer: BufferedTick[];
  lastTs?: number;
  rateTimeout?: number | null;
  replayMode?: boolean; // true if currently in replay
};

export class MarketDataLayer {
  private url: string;
  private ws: WebSocket | null = null;
  private subs: Map<string, Sub> = new Map(); // key -> sub
  private nextId = 1;
  // simple event listeners for UI to observe connection/error/retry events
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private reconnectAttempts = 0;

  constructor(url?: string) {
    // Connect to Socket.IO endpoint
    this.url = url || `http${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}`;
    this.connect();
  }

  private connect() {
    if (this.ws && (this.ws as any).connected) return;
    try {
      // Connect to raw WebSocket endpoint (NOT Socket.IO protocol)
      const socketUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
      this.ws = new WebSocket(socketUrl);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
        // re-subscribe server-side for active subscriptions
        this.subs.forEach(s => this.send({ type: 'subscribe', symbol: s.symbol, options: s.opts }));
      };
      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          this.handleMessage(msg);
        } catch (err) {
          console.debug('[MarketDataLayer] bad message', err);
        }
      };
      this.ws.onclose = () => {
        this.ws = null;
        this.emit('disconnected');
        // exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;
        this.emit('retry', { attempt: this.reconnectAttempts, delay });
        setTimeout(() => this.connect(), delay);
      };
      this.ws.onerror = (e) => { this.emit('error', e); console.warn('[MarketDataLayer] ws error', e); };
    } catch (err) {
      console.warn('[MarketDataLayer] failed to connect', err);
      this.emit('error', err);
    }
  }

  private send(obj: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private handleMessage(msg: any) {
    // Expect messages of shape { type: 'tick', symbol, tick }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'tick' && msg.tick && msg.symbol) {
      const tick = msg.tick as any;
      // normalize incoming symbol for matching
      const incoming = String(msg.symbol || '').toUpperCase();
      const incomingNormalized = incoming.replace(/\//g, '');
      // deliver to all subs matching symbol (either raw or normalized)
      this.subs.forEach(sub => {
        if (sub.symbol === incoming || sub.symbol === incomingNormalized) {
          this.enqueueTick(sub, tick);
        }
      });
    }
  }

  // tiny event emitter
  addEventListener(name: string, cb: (...args: any[]) => void) {
    const s = this.listeners.get(name) || new Set();
    s.add(cb);
    this.listeners.set(name, s);
  }
  removeEventListener(name: string, cb: (...args: any[]) => void) {
    const s = this.listeners.get(name);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) this.listeners.delete(name);
  }
  private emit(name: string, ...args: any[]) {
    const s = this.listeners.get(name);
    if (!s) return;
    s.forEach(cb => { try { cb(...args); } catch (e) { console.warn(e); } });
  }

  private enqueueTick(sub: Sub, raw: any) {
    // Normalize timestamp if needed (raw may have ts or timestamp)
    let ts = raw?.ts ?? raw?.timestamp;
    if (typeof ts === 'string') ts = Number(ts);
    if (typeof ts !== 'number' || isNaN(ts)) return; // drop if no valid timestamp
    if (ts < 1e10) ts = ts * 1000; // normalize seconds → ms

    // Validate minimum RawTick shape
    if (!validateRawTick({ ts, symbol: raw?.symbol, price: raw?.price, ...raw })) {
      return; // drop invalid
    }

    // Store internally as BufferedTick (RawTick + metadata)
    const bufferedTick: BufferedTick = {
      ts,
      exchange: raw?.exchange ?? 'unknown',
      symbol: raw?.symbol ?? '',
      price: raw?.price ?? 0,
      size: raw?.size,
      side: raw?.side,
      tradeId: raw?.tradeId,
      seq: raw?.seq,
      _internalId: `${Date.now()}_${Math.random()}`,
      ...raw.extra,
    };

    // Dedupe / ordering guard
    if (sub.lastTs && bufferedTick.ts <= sub.lastTs) {
      return; // duplicate or out-of-order; ignore
    }

    // Buffer retention (keep most recent N ticks)
    sub.buffer.unshift(bufferedTick);
    if (sub.opts.bufferMax && sub.buffer.length > sub.opts.bufferMax) {
      sub.buffer.length = sub.opts.bufferMax;
    }

    sub.lastTs = bufferedTick.ts;

    // Transform BufferedTick → UITick before delivery to handler
    const uiTick = this.transformToUITick(bufferedTick, sub);

    // Rate-limited delivery to handler
    const rate = sub.opts.rateLimitMs || 0;
    if (rate > 0) {
      if (sub.rateTimeout) return; // already scheduled
      sub.rateTimeout = window.setTimeout(() => {
        sub.rateTimeout = null;
        if (!sub.paused) {
          // Deliver buffered ticks (all transformed to UITick)
          const buffered = sub.buffer.slice().reverse();
          sub.buffer = [];
          buffered.forEach(t => {
            try {
              const uiT = this.transformToUITick(t, sub);
              sub.handler(uiT);
            } catch (e) {
                console.warn('[MarketDataLayer] handler error', e);
            }
          });
        }
      }, rate) as unknown as number;
    } else {
      if (!sub.paused) {
        try { sub.handler(uiTick); } catch (e) { console.warn('[MarketDataLayer] handler error', e); }
      }
    }
  }

  /**
   * Transform internal BufferedTick to UITick (safe, annotated output).
   * This is the key invariant boundary: RawTick → UITick.
   */
  private transformToUITick(buffered: BufferedTick, sub: Sub): UITick {
    const uiTick = createLiveUITick(
      {
        ts: buffered.ts,
        timestamp: buffered.ts,
        symbol: buffered.symbol,
        price: buffered.price,
      },
      sub.replayMode ? 'REPLAY_API' : 'WS'
    );

    // Mark as REPLAY if in replay mode
    if (sub.replayMode) {
      return {
        ...uiTick,
        state: { ...uiTick.state, mode: 'REPLAY' },
      };
    }

    return uiTick;
  }

  subscribe(symbol: string, opts: SubscribeOptions, handler: TickHandler) {
    const id = `s_${this.nextId++}`;
    const rawSymbol = String(symbol || '').toUpperCase();
    const normalizedSymbol = rawSymbol.replace(/\//g, '');
    const sub: Sub = {
      id,
      symbol: normalizedSymbol,
      opts,
      handler,
      paused: false,
      buffer: [],
      lastTs: undefined,
      rateTimeout: null,
      replayMode: false,
    };
    this.subs.set(id, sub);
    // inform server
    this.send({ type: 'subscribe', symbol: normalizedSymbol, options: opts });

    return {
      id,
      unsubscribe: () => {
        this.subs.delete(id);
        this.send({ type: 'unsubscribe', symbol, id });
      },
      pause: () => { sub.paused = true; },
      resume: () => { sub.paused = false; },
      /**
       * Request historical replay for this symbol.
       * Delivers ticks as UITick (never raw) to the handler.
       * Falls back to local buffer if server API unavailable.
       */
      requestReplay: async (fromMs?: number, toMs?: number) => {
        // Mark as replay mode (affects UITick output)
        const wasReplay = sub.replayMode;
        sub.replayMode = true;

        try {
          const params = new URLSearchParams();
          params.set('symbol', normalizedSymbol);
          if (fromMs) params.set('from', String(fromMs));
          if (toMs) params.set('to', String(toMs));
          const res = await fetch(`/api/replay?${params.toString()}`);
          if (!res.ok) throw new Error('replay response not ok');
          const data = await res.json();

          // Deliver replayed ticks via normal handler (which transforms to UITick)
          // This ensures invariant: RawTick → UITick before handler sees it
          (data || []).forEach((t: any) => {
            // Normalize timestamp if needed
            let ts = t?.ts ?? t?.timestamp;
            if (typeof ts === 'string') ts = Number(ts);
            if (typeof ts === 'number' && ts < 1e12) ts = ts * 1000;

            // Create BufferedTick and enqueue normally (applies all validations + transforms)
            const bufferedTick: BufferedTick = {
              ts,
              exchange: t?.exchange ?? 'replay',
              symbol: t?.symbol ?? normalizedSymbol,
              price: t?.price ?? 0,
              size: t?.size,
              side: t?.side,
              tradeId: t?.tradeId,
              seq: t?.seq,
              _internalId: `replay_${Date.now()}_${Math.random()}`,
            };

            if (validateRawTick(bufferedTick)) {
              this.enqueueTick(sub, bufferedTick);
            }
          });

          return data as UITick[];
        } catch (err) {
          console.warn('[MarketDataLayer] replay request failed, falling back to local buffer', err);
          // Fallback: deliver local buffer ticks as UITick
          const snap = sub.buffer.slice().reverse();
          snap.forEach(t => {
            try {
              const uiTick = this.transformToUITick(t, sub);
              handler(uiTick);
            } catch (e) {
              console.warn('[MarketDataLayer] fallback handler error', e);
            }
          });
          return snap.map(t => this.transformToUITick(t, sub));
        } finally {
          sub.replayMode = wasReplay;
        }
      }
    };
  }
}

// Export a default singleton to be used by UI/agents
const defaultMarketDataLayer = new MarketDataLayer();
export default defaultMarketDataLayer;
