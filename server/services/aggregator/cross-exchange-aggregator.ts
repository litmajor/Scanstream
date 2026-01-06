/**
 * Cross-Exchange Aggregator
 *
 * Listens to `world.tick` events and keeps latest per-exchange candles
 * for each symbol. Exposes `getAggregated(symbol)` for agents to query
 * unified state inside `onWorldTick` calls (so agents still subscribe
 * only to `world.tick` via BaseAgent).
 *
 * Emits: 'aggregated.updated' events for dashboards/metrics.
 */

import { EventEmitter } from 'events';
import type { WorldTick, Candle } from '../../types/market-data';
import type { AggregatedCandle } from './cross-exchange-types';

export class CrossExchangeAggregator extends EventEmitter {
  // symbol -> exchange -> Candle
  private store: Map<string, Map<string, Candle>> = new Map();
  // symbol -> AggregatedCandle
  private aggregatedCache: Map<string, AggregatedCandle> = new Map();

  // freshness threshold (ms) — ignore stale exchange candles
  private freshnessMs: number;

  constructor(private source: EventEmitter, freshnessMs = 90_000) {
    super();
    this.freshnessMs = freshnessMs;

    // Listen to world.tick events from IntegrityGate
    this.source.on('world.tick', (tick: WorldTick) => this.onWorldTick(tick));
  }

  private onWorldTick(tick: WorldTick): void {
    try {
      const symbol = tick.symbol;
      const exchange = tick.source || 'unknown';
      const candle: Candle = tick.candle as Candle;

      if (!this.store.has(symbol)) this.store.set(symbol, new Map());
      const perExchange = this.store.get(symbol)!;
      perExchange.set(exchange, candle);

      // Recompute aggregated view
      const aggregated = this.computeAggregated(symbol, perExchange);

      // Emit only when aggregated snapshot changes to reduce noise
      const prev = this.aggregatedCache.get(symbol);
      const prevStr = prev ? this.serializeSafely(prev) : null;
      const nextStr = this.serializeSafely(aggregated);
      if (prevStr !== nextStr) {
        this.aggregatedCache.set(symbol, aggregated);
        this.emit('aggregated.updated', { symbol, aggregated });
      }
    } catch (err) {
      console.error('[CrossExchangeAggregator] onWorldTick error:', err);
    }
  }

  private serializeSafely(obj: any): string {
    try {
      // Extract only safe serializable properties
      if (!obj || typeof obj !== 'object') {
        return String(obj);
      }

      // For Candle objects, extract just the numeric values
      if (obj.open !== undefined || obj.close !== undefined) {
        return JSON.stringify({
          open: obj.open,
          high: obj.high,
          low: obj.low,
          close: obj.close,
          volume: obj.volume,
          timestamp: obj.timestamp
        });
      }

      // For other objects, use circular reference detection
      const seen = new WeakSet();
      const result = JSON.stringify(obj, (key, value) => {
        // Skip circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return undefined;
          }
          seen.add(value);
        }
        // Skip functions and non-serializable types
        if (typeof value === 'function' || value instanceof Error) {
          return undefined;
        }
        return value;
      });
      
      return result || '{}';
    } catch (e) {
      // Ultimate fallback - just use symbol and price
      return `${obj?.symbol || 'unknown'}:${obj?.close || 0}`;
    }
  }

  private computeAggregated(symbol: string, perExchange: Map<string, Candle>): AggregatedCandle {
    const exchangeCandles: Record<string, Candle | undefined> = {};
    const prices: number[] = [];
    const sourcesSeen: string[] = [];
    let latestTs = 0;

    for (const [exchange, candle] of perExchange.entries()) {
      exchangeCandles[exchange] = candle;
      if (candle) {
        prices.push(candle.close);
        sourcesSeen.push(exchange);
        if (candle.ts > latestTs) latestTs = candle.ts;
      }
    }

    const bestBid = prices.length > 0 ? Math.max(...prices) : undefined;
    const bestAsk = prices.length > 0 ? Math.min(...prices) : undefined;
    const spread = bestBid !== undefined && bestAsk !== undefined ? bestBid - bestAsk : undefined;

    const aggregated: AggregatedCandle = {
      symbol,
      exchangeCandles,
      bestBid,
      bestAsk,
      spread,
      timestamp: latestTs || Date.now(),
      sourcesSeen,
      confidence: this.computeConfidence(perExchange),
    };

    return aggregated;
  }

  private computeConfidence(perExchange: Map<string, Candle>): number {
    // Simple heuristic: confidence = percent of exchanges with fresh data
    let total = 0;
    let fresh = 0;
    const now = Date.now();

    for (const [_, candle] of perExchange.entries()) {
      total++;
      if (candle && now - candle.ts < this.freshnessMs) fresh++;
    }

    if (total === 0) return 0;
    return Math.round((fresh / total) * 100);
  }

  /**
   * Get aggregated state for a symbol (may be undefined)
   */
  getAggregated(symbol: string): AggregatedCandle | undefined {
    return this.aggregatedCache.get(symbol);
  }

  /**
   * Get per-exchange map (read-only copy)
   */
  getPerExchange(symbol: string): Record<string, Candle | undefined> {
    const out: Record<string, Candle | undefined> = {};
    const per = this.store.get(symbol);
    if (!per) return out;
    for (const [k, v] of per.entries()) out[k] = v;
    return out;
  }

  /**
   * Remove stale exchanges for a symbol (cleanup)
   */
  pruneStale(symbol: string): void {
    const per = this.store.get(symbol);
    if (!per) return;
    const now = Date.now();
    for (const [exchange, candle] of per.entries()) {
      if (!candle) continue;
      if (now - candle.ts > this.freshnessMs * 10) {
        per.delete(exchange);
      }
    }
  }
}
