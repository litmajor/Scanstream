/**
 * Market Data Integrity Checker
 * 
 * Validates candles before they reach the RPG system.
 * 
 * Rules (non-negotiable):
 * 1. No gaps (missing candles)
 * 2. No duplicates
 * 3. Timestamps aligned to intervals
 * 4. OHLC validity (high ≥ low, etc)
 * 5. Monotonic ordering (ascending timestamps)
 */

import type {
  Candle,
  MarketDataAdapter,
  MarketDataIntegrity,
  IntegrityResult,
  IntegrityIssue,
} from '../../types/market-data';

export class MarketDataIntegrityChecker implements MarketDataIntegrity {
  /**
   * Validate a batch of candles
   */
  async validate(
    candles: Candle[],
    symbol: string,
    timeframe: number
  ): Promise<IntegrityResult> {
    const issues: IntegrityIssue[] = [];
    const timeframeMs = timeframe * 1000;

    // Empty input is valid (but suspicious)
    if (candles.length === 0) {
      return { valid: true, candles, issues };
    }

    // Rule 1: Check OHLC validity for each candle
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];

      if (c.high < c.low) {
        issues.push({
          type: 'ohlc_invalid',
          severity: 'error',
          details: `Candle ${i}: high (${c.high}) < low (${c.low})`,
          candles: [i],
          timestamp: c.ts,
        });
      }

      if (c.close > c.high || c.close < c.low) {
        issues.push({
          type: 'ohlc_invalid',
          severity: 'warn',
          details: `Candle ${i}: close (${c.close}) outside [${c.low}, ${c.high}]`,
          candles: [i],
          timestamp: c.ts,
        });
      }

      if (c.open > c.high || c.open < c.low) {
        issues.push({
          type: 'ohlc_invalid',
          severity: 'warn',
          details: `Candle ${i}: open (${c.open}) outside [${c.low}, ${c.high}]`,
          candles: [i],
          timestamp: c.ts,
        });
      }
    }

    // Rule 2: Check timestamp alignment
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const expectedCloseTime = c.ts + timeframeMs;
      
      // Candle timestamp should align to interval boundaries
      const alignmentError = c.ts % timeframeMs;
      if (alignmentError !== 0) {
        issues.push({
          type: 'timestamp_misaligned',
          severity: 'warn',
          details: `Candle ${i}: timestamp ${c.ts} not aligned to ${timeframe}s interval`,
          candles: [i],
          timestamp: c.ts,
        });
      }
    }

    // Rule 3: Check for duplicates (same timestamp)
    const timestampCounts = new Map<number, number>();
    for (const c of candles) {
      timestampCounts.set(c.ts, (timestampCounts.get(c.ts) || 0) + 1);
    }

    for (const [ts, count] of timestampCounts) {
      if (count > 1) {
        const indices = candles
          .map((c, i) => (c.ts === ts ? i : -1))
          .filter(i => i >= 0);

        issues.push({
          type: 'duplicate',
          severity: 'error',
          details: `Timestamp ${ts} appears ${count} times`,
          candles: indices,
          timestamp: ts,
        });
      }
    }

    // Rule 4: Check monotonic ordering
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].ts <= candles[i - 1].ts) {
        issues.push({
          type: 'out_of_order',
          severity: 'error',
          details: `Candles ${i - 1} and ${i} not in ascending order`,
          candles: [i - 1, i],
          timestamp: candles[i].ts,
        });
      }
    }

    // Rule 5: Check for gaps
    const gaps: { from: number; to: number; count: number }[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const expectedGap = timeframeMs;
      const actualGap = curr.ts - prev.ts;

      if (actualGap > expectedGap * 1.5) {
        // Allow 50% tolerance (some exchanges skip holidays, etc)
        const missingCount = Math.round(actualGap / timeframeMs) - 1;
        
        gaps.push({
          from: prev.ts + timeframeMs,
          to: curr.ts - timeframeMs,
          count: missingCount,
        });

        issues.push({
          type: 'gap',
          severity: 'warn',
          details: `Gap between candle ${i - 1} and ${i}: ${missingCount} candles missing`,
          candles: [i - 1, i],
          timestamp: prev.ts,
          // Suggest backfill parameters
        });
      }
    }

    // Determine validity
    const hasErrors = issues.some(issue => issue.severity === 'error');
    const valid = !hasErrors;

    // Suggest backfill if gaps found
    let backfillRequired;
    if (gaps.length > 0 && valid) {
      // Backfill the first gap
      const gap = gaps[0];
      backfillRequired = {
        symbol,
        timeframe,
        from: gap.from,
        to: gap.to,
      };
    }

    return {
      valid,
      candles,
      issues,
      backfillRequired,
    };
  }

  /**
   * Attempt to heal a gap by fetching missing candles
   */
  async healGap(
    adapter: MarketDataAdapter,
    symbol: string,
    timeframe: number,
    from: number,
    to: number
  ): Promise<Candle[]> {
    try {
      console.log(
        `[Integrity] Healing gap for ${symbol} ${timeframe}s: ${new Date(from).toISOString()} → ${new Date(to).toISOString()}`
      );

      // Fetch candles covering the gap
      const limit = Math.ceil((to - from) / (timeframe * 1000)) + 5;
      const healed = await adapter.fetchOHLCV(
        symbol,
        timeframe,
        from,
        limit
      );

      console.log(
        `[Integrity] Fetched ${healed.length} candles to heal gap`
      );

      return healed;
    } catch (error: any) {
      console.error(`[Integrity] Gap healing failed:`, error?.message);
      throw error;
    }
  }
}

/**
 * Integrity issue logger/reporter
 * Can be extended to send alerts, metrics, etc.
 */
export class IntegrityReporter {
  private issues: Map<string, IntegrityIssue[]> = new Map();

  report(symbol: string, issue: IntegrityIssue): void {
    if (!this.issues.has(symbol)) {
      this.issues.set(symbol, []);
    }

    this.issues.get(symbol)!.push(issue);

    // Log based on severity
    if (issue.severity === 'error') {
      console.error(`[Integrity] ${symbol}: ${issue.details}`);
    } else {
      console.warn(`[Integrity] ${symbol}: ${issue.details}`);
    }
  }

  getIssues(symbol?: string): IntegrityIssue[] {
    if (symbol) {
      return this.issues.get(symbol) || [];
    }

    return Array.from(this.issues.values()).flat();
  }

  clear(symbol?: string): void {
    if (symbol) {
      this.issues.delete(symbol);
    } else {
      this.issues.clear();
    }
  }
}
