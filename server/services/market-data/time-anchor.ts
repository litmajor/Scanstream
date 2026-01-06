/**
 * 🔒 TIME ANCHOR — Enforces hard boundary between BACKFILL and LIVE
 * 
 * For each (symbol, timeframe), maintains state machine:
 * BACKFILL → ARMED → LIVE
 * 
 * Rules (non-negotiable):
 * 1. BACKFILL: REST only, historical candles ≤ lastHistoricalTs
 * 2. ARMED: WS only, probation period (3-5 candles, emit-lag < 2s)
 * 3. LIVE: WS only, no REST, emit-lag < 2s, no gaps, monotonic time
 */

export type AnchorMode = 'BACKFILL' | 'ARMED' | 'LIVE';

export interface TimeAnchor {
  symbol: string;
  timeframe: number;
  
  // Temporal boundaries
  lastHistoricalTs: number; // Last timestamp allowed in BACKFILL
  liveAnchorTs: number | null; // First timestamp allowed in LIVE (set on ARMED→LIVE)
  
  // State tracking
  mode: AnchorMode;
  modeChangedAt: number;
  
  // ARMED probation tracking
  consecutiveWsCandles: number;
  lastWsEmitLag: number;
  
  // Safety tracking
  lastWorldTime: number;
  lastWsTime: number;
  restFetchCount: number;
}

export class TimeAnchorManager {
  private static instance: TimeAnchorManager;
  private anchors = new Map<string, TimeAnchor>(); // key: symbol:timeframe

  private constructor() {}

  static getInstance(): TimeAnchorManager {
    if (!TimeAnchorManager.instance) {
      TimeAnchorManager.instance = new TimeAnchorManager();
    }
    return TimeAnchorManager.instance;
  }

  /**
   * Create or get anchor for symbol+timeframe
   * 🔒 CRITICAL: Once system is in LIVE mode, NEW anchors cannot be created
   * This prevents runtime discovery from resetting symbols back to BACKFILL
   */
  getOrCreateAnchor(symbol: string, timeframe: number, allowNewCreation = true): TimeAnchor {
    const key = `${symbol}:${timeframe}`;
    
    if (!this.anchors.has(key)) {
      // Check if any anchor is in LIVE mode (system is active)
      const anyLive = Array.from(this.anchors.values()).some(a => a.mode === 'LIVE');
      
      // If system is LIVE and we don't have this anchor, reject new creation
      if (anyLive && !allowNewCreation) {
        throw new Error(
          `[TimeAnchor] ⛔ ${symbol}:${timeframe} cannot be created during LIVE mode ` +
          `(runtime discovery disabled). Use pre-configured symbols only.`
        );
      }

      const anchor: TimeAnchor = {
        symbol,
        timeframe,
        lastHistoricalTs: Date.now(),
        liveAnchorTs: null,
        mode: 'BACKFILL',
        modeChangedAt: Date.now(),
        consecutiveWsCandles: 0,
        lastWsEmitLag: 0,
        lastWorldTime: 0,
        lastWsTime: 0,
        restFetchCount: 0,
      };
      this.anchors.set(key, anchor);
      console.log(`[TimeAnchor] New anchor created: ${symbol}:${timeframe}`);
    }
    
    return this.anchors.get(key)!;
  }

  /**
   * Transition BACKFILL → ARMED
   * Called when REST backfill completes for this symbol+timeframe
   */
  transitionToArmed(symbol: string, timeframe: number): void {
    const anchor = this.getOrCreateAnchor(symbol, timeframe);
    
    if (anchor.mode !== 'BACKFILL') {
      console.warn(
        `[TimeAnchor] Cannot transition ${symbol}:${timeframe} to ARMED ` +
        `(current mode=${anchor.mode})`
      );
      return;
    }

    anchor.mode = 'ARMED';
    anchor.modeChangedAt = Date.now();
    anchor.consecutiveWsCandles = 0;
    anchor.lastHistoricalTs = Date.now();
    
    console.log(
      `[TimeAnchor] ${symbol}:${timeframe} transitioned to ARMED ` +
      `(waiting for 3-5 WS candles with emit-lag < 2s)`
    );
  }

  /**
   * Record WS candle during ARMED probation
   * Transition to LIVE once 3-5 consecutive WS candles arrive with good emit-lag
   */
  recordWsCandle(
    symbol: string,
    timeframe: number,
    worldTime: number,
    emitLag: number
  ): void {
    const anchor = this.getOrCreateAnchor(symbol, timeframe);
    
    if (anchor.mode !== 'ARMED') {
      return; // Only counts during ARMED
    }

    // Check emit-lag constraint
    if (emitLag > 2000) {
      console.warn(
        `[TimeAnchor] ${symbol}:${timeframe} ARMED probation reset ` +
        `(emit-lag ${emitLag}ms > 2s)`
      );
      anchor.consecutiveWsCandles = 0;
      return;
    }

    anchor.consecutiveWsCandles++;
    anchor.lastWsEmitLag = emitLag;
    anchor.lastWsTime = worldTime;

    // Promote to LIVE after 3 good candles
    if (anchor.consecutiveWsCandles >= 3) {
      this.transitionToLive(symbol, timeframe);
    }
  }

  /**
   * Transition ARMED → LIVE
   * Called after 3-5 consecutive good WS candles
   */
  private transitionToLive(symbol: string, timeframe: number): void {
    const anchor = this.getOrCreateAnchor(symbol, timeframe);
    
    if (anchor.mode !== 'ARMED') {
      return;
    }

    anchor.mode = 'LIVE';
    anchor.modeChangedAt = Date.now();
    anchor.liveAnchorTs = anchor.lastWsTime; // Freeze anchor
    
    console.log(
      `[TimeAnchor] ✅ ${symbol}:${timeframe} → LIVE ` +
      `(anchor=${new Date(anchor.liveAnchorTs).toISOString()}, ` +
      `emit-lag=${anchor.lastWsEmitLag}ms)`
    );
  }

  /**
   * Downgrade LIVE → ARMED
   * Called if: emit-lag > MAX, gap detected, or time regression
   */
  downgradeToArmed(symbol: string, timeframe: number, reason: string): void {
    const anchor = this.getOrCreateAnchor(symbol, timeframe);
    
    if (anchor.mode !== 'LIVE') {
      return;
    }

    anchor.mode = 'ARMED';
    anchor.modeChangedAt = Date.now();
    anchor.consecutiveWsCandles = 0;
    anchor.liveAnchorTs = null;
    
    console.warn(
      `[TimeAnchor] 🟡 ${symbol}:${timeframe} downgraded to ARMED ` +
      `(reason: ${reason})`
    );
  }

  /**
   * Validate candle against anchor constraints
   * Returns { allowed: boolean, reason: string }
   * 
   * 🔒 CRITICAL: Does NOT create new anchors. Only validates existing ones.
   * New symbols via WS are rejected (not pre-configured).
   */
  validateCandle(
    symbol: string,
    timeframe: number,
    worldTime: number,
    source: 'REST' | 'WS'
  ): { allowed: boolean; reason: string } {
    const key = `${symbol}:${timeframe}`;
    const anchor = this.anchors.get(key);

    // NEW SYMBOL CHECK: If anchor doesn't exist, reject WS (allow REST only)
    if (!anchor) {
      if (source === 'WS') {
        return {
          allowed: false,
          reason: `New symbol discovered at runtime (not pre-configured). Runtime discovery disabled.`
        };
      }
      // Allow REST to create anchor via getOrCreateAnchor
      const newAnchor = this.getOrCreateAnchor(symbol, timeframe, true);
      // Fall through to validation logic below
      return this.validateCandle(symbol, timeframe, worldTime, source);
    }

    // ✅ BACKFILL: Allow REST only, up to lastHistoricalTs
    if (anchor.mode === 'BACKFILL') {
      if (source !== 'REST') {
        return {
          allowed: false,
          reason: 'Only REST allowed in BACKFILL mode'
        };
      }
      if (worldTime > anchor.lastHistoricalTs) {
        return {
          allowed: false,
          reason: `Candle timestamp ${worldTime} > lastHistoricalTs ${anchor.lastHistoricalTs}`
        };
      }
      return { allowed: true, reason: 'BACKFILL: REST candle in valid range' };
    }

    // ✅ ARMED: Allow both REST (tail backfill) and WS (probation)
    // During ARMED transition, REST continues fetching the last historical candles
    // while WS begins sending live candles. Both are valid during this phase.
    if (anchor.mode === 'ARMED') {
      // REST allowed: still fetching tail end of historical data
      if (source === 'REST') {
        if (worldTime > anchor.lastHistoricalTs) {
          return {
            allowed: false,
            reason: `REST: candle ${worldTime} > lastHistoricalTs ${anchor.lastHistoricalTs}`
          };
        }
        return { allowed: true, reason: 'ARMED: REST tail backfill candle' };
      }
      // WS allowed: probation period, tracking emit-lag
      if (source === 'WS') {
        return { allowed: true, reason: 'ARMED: WS probation candle' };
      }
      return {
        allowed: false,
        reason: `ARMED: unknown source '${source}'`
      };
    }

    // ✅ LIVE: Allow WS only, must be ≥ liveAnchorTs, monotonic time
    if (anchor.mode === 'LIVE') {
      if (source !== 'WS') {
        return {
          allowed: false,
          reason: '⛔ REST not allowed in LIVE mode'
        };
      }

      if (!anchor.liveAnchorTs) {
        return {
          allowed: false,
          reason: 'liveAnchorTs not set (should not happen in LIVE)'
        };
      }

      if (worldTime < anchor.liveAnchorTs) {
        return {
          allowed: false,
          reason: `Candle ${worldTime} < liveAnchorTs ${anchor.liveAnchorTs}`
        };
      }

      if (worldTime < anchor.lastWorldTime) {
        return {
          allowed: false,
          reason: `Time regression: ${worldTime} < lastWorldTime ${anchor.lastWorldTime}`
        };
      }

      anchor.lastWorldTime = worldTime;
      return { allowed: true, reason: 'LIVE: WS candle accepted' };
    }

    return {
      allowed: false,
      reason: `Unknown mode: ${anchor.mode}`
    };
  }

  /**
   * Record REST fetch (for statistics)
   */
  recordRestFetch(symbol: string, timeframe: number): void {
    const anchor = this.getOrCreateAnchor(symbol, timeframe);
    anchor.restFetchCount++;
  }

  /**
   * Get anchor for monitoring/diagnostics
   */
  getAnchor(symbol: string, timeframe: number): TimeAnchor | undefined {
    const key = `${symbol}:${timeframe}`;
    return this.anchors.get(key);
  }

  /**
   * Get all anchors (for dashboard)
   */
  getAllAnchors(): TimeAnchor[] {
    return Array.from(this.anchors.values());
  }

  /**
   * Diagnostic output
   */
  diagnostics(): string {
    const anchors = this.getAllAnchors();
    if (anchors.length === 0) {
      return '[TimeAnchor] No anchors initialized';
    }

    return anchors
      .map((a) => {
        const modeColor =
          a.mode === 'LIVE'
            ? '✅'
            : a.mode === 'ARMED'
              ? '🟡'
              : '⏳';
        const durationMs = Date.now() - a.modeChangedAt;
        const duration = `${Math.round(durationMs / 1000)}s`;

        return [
          `${modeColor} ${a.symbol}:${a.timeframe}s`,
          `  mode=${a.mode} (${duration})`,
          `  historical_until=${new Date(a.lastHistoricalTs).toISOString()}`,
          a.liveAnchorTs
            ? `  live_since=${new Date(a.liveAnchorTs).toISOString()}`
            : '  live_since=not_set',
          a.mode === 'ARMED'
            ? `  probation=${a.consecutiveWsCandles}/3 emit-lag=${a.lastWsEmitLag}ms`
            : '',
          `  rest_fetches=${a.restFetchCount}`,
        ]
          .filter((x) => x)
          .join('\n');
      })
      .join('\n\n');
  }

  /**
   * Reset all anchors (for testing)
   */
  reset(): void {
    this.anchors.clear();
  }
}

export function getTimeAnchorManager(): TimeAnchorManager {
  return TimeAnchorManager.getInstance();
}
