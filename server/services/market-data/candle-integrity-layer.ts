/**
 * PHASE 2: Candle Integrity Layer (CIL)
 * 
 * Gate between market data sources and storage.
 * 
 * Only valid, normalized candles reach storage.createMarketFrame().
 * 
 * Responsibilities:
 * 1. Timestamp alignment (snap to interval boundaries)
 * 2. Continuity check (detect and report gaps)
 * 3. Deduplication (remove duplicates by timestamp)
 * 4. Finality enforcement (mark closed vs open candles)
 * 5. OHLC validation (high >= low, etc.)
 * 
 * Result: Immediate reduction in false signals across all agents
 */

import type { Candle, ValidatedCandle } from '../types/market-data';

export interface Gap {
  symbol: string;
  timeframe: number;
  from: number; // timestamp (ms)
  to: number;   // timestamp (ms)
  expectedCandles: number;
  missingCandles: number;
}

export interface CandleIntegrityReport {
  symbol: string;
  timeframe: number;
  timestamp: Date;
  
  inputCount: number;
  validCount: number;
  rejectedCount: number;
  deduplicatedCount: number;
  
  valid: ValidatedCandle[];
  gaps: Gap[];
  rejected: Array<{
    candle: Candle;
    reason: string;
  }>;
  
  alignment: {
    aligned: number;
    misaligned: number;
    avgDriftMs: number;
  };
  
  continuity: {
    hasGaps: boolean;
    totalGapMs: number;
    largestGapMs: number;
    gapCount: number;
  };
  
  finality: {
    closed: number;
    open: number;
    unknown: number;
  };
}

export class CandleIntegrityLayer {
  private readonly symbol: string;
  private readonly timeframe: number; // in seconds
  private timeframeMs: number;
  
  // Metrics tracking
  private metrics: {
    totalProcessed: number;
    totalValid: number;
    totalRejected: number;
    totalDeduplicated: number;
    totalGaps: number;
    lastValidTimestamp?: number | null;
  } = {
    totalProcessed: 0,
    totalValid: 0,
    totalRejected: 0,
    totalDeduplicated: 0,
    totalGaps: 0,
    lastValidTimestamp: null,
  };

  constructor(symbol: string, timeframe: number) {
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.timeframeMs = timeframe * 1000;
  }

  /**
   * Main validation and normalization function
   * 
   * Input: Raw candles from any source
   * Output: Validated candles + gap report + rejected candles
   */
  validateAndNormalize(candles: Candle[]): CandleIntegrityReport {
    const startTime = Date.now();

    // Step 1: Deduplicate by timestamp
    const deduped = this.deduplicate(candles);

    // Step 2: Sort by timestamp (ascending)
    const sorted = this.sort(deduped);

    // Step 3: Validate OHLC structure
    const { valid: ohlcValid, rejected: ohlcRejected } = this.validateOHLC(sorted);

    // Step 4: Check timestamp alignment
    const { aligned, misaligned } = this.checkAlignment(ohlcValid);

    // Step 5: Enforce finality
    const withFinality = this.enforceFinality(aligned);

    // Step 6: Detect gaps and mark them
    const { valid, gaps } = this.detectGaps(withFinality);

    // Step 7: Mark as finalized
    const finalCandles = valid.map(c => ({
      ...c,
      validated: true as const,
    }));

    // Calculate metrics
    const alignmentReport = this.analyzeAlignment(aligned, misaligned);
    const finalityReport = this.analyzeFinality(finalCandles);
    const continuityReport = this.analyzeContinuity(gaps);

    // Update tracking
    this.metrics.totalProcessed += candles.length;
    this.metrics.totalValid += finalCandles.length;
    this.metrics.totalRejected += ohlcRejected.length;
    this.metrics.totalDeduplicated += candles.length - deduped.length;
    this.metrics.totalGaps += gaps.length;

    if (finalCandles.length > 0) {
      this.metrics.lastValidTimestamp = finalCandles[finalCandles.length - 1].ts;
    }

    const report: CandleIntegrityReport = {
      symbol: this.symbol,
      timeframe: this.timeframe,
      timestamp: new Date(),

      inputCount: candles.length,
      validCount: finalCandles.length,
      rejectedCount: ohlcRejected.length,
      deduplicatedCount: candles.length - deduped.length,

      valid: finalCandles,
      gaps,
      rejected: ohlcRejected.map(c => ({
        candle: c,
        reason: this.getOHLCRejectionReason(c)
      })),

      alignment: alignmentReport,
      continuity: continuityReport,
      finality: finalityReport,
    };

    const processingTime = Date.now() - startTime;
    console.log(
      `[CIL] ${this.symbol} ${this.timeframe}s: ` +
      `${finalCandles.length}/${candles.length} valid ` +
      `(${ohlcRejected.length} rejected, ${candles.length - deduped.length} duped) ` +
      `${gaps.length} gaps in ${processingTime}ms`
    );

    return report;
  }

  /**
   * Step 1: Deduplicate by timestamp
   */
  private deduplicate(candles: Candle[]): Candle[] {
    const seen = new Set<number>();
    const result: Candle[] = [];

    for (const c of candles) {
      if (!seen.has(c.ts)) {
        seen.add(c.ts);
        result.push(c);
      }
    }

    return result;
  }

  /**
   * Step 2: Sort by timestamp ascending
   */
  private sort(candles: Candle[]): Candle[] {
    return [...candles].sort((a, b) => a.ts - b.ts);
  }

  /**
   * Step 3: Validate OHLC structure
   */
  private validateOHLC(candles: Candle[]): {
    valid: Candle[];
    rejected: Candle[];
  } {
    const valid: Candle[] = [];
    const rejected: Candle[] = [];

    for (const c of candles) {
      if (this.isValidOHLC(c)) {
        valid.push(c);
      } else {
        rejected.push(c);
      }
    }

    return { valid, rejected };
  }

  /**
   * Check if single candle has valid OHLC
   */
  private isValidOHLC(c: Candle): boolean {
    // High must be >= low
    if (c.high < c.low) {
      return false;
    }

    // Close must be between high and low
    if (c.close > c.high || c.close < c.low) {
      return false;
    }

    // Open must be between high and low
    if (c.open > c.high || c.open < c.low) {
      return false;
    }

    // Volume must be non-negative
    if (c.volume < 0) {
      return false;
    }

    // All prices must be positive
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
      return false;
    }

    // Timestamp must be valid
    if (c.ts <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Get human-readable rejection reason
   */
  private getOHLCRejectionReason(c: Candle): string {
    if (c.high < c.low) {
      return `high (${c.high}) < low (${c.low})`;
    }
    if (c.close > c.high || c.close < c.low) {
      return `close (${c.close}) outside [${c.low}, ${c.high}]`;
    }
    if (c.open > c.high || c.open < c.low) {
      return `open (${c.open}) outside [${c.low}, ${c.high}]`;
    }
    if (c.volume < 0) {
      return `negative volume (${c.volume})`;
    }
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
      return `non-positive price`;
    }
    if (c.ts <= 0) {
      return `invalid timestamp (${c.ts})`;
    }
    return 'unknown';
  }

  /**
   * Step 4: Check timestamp alignment to interval boundaries
   */
  private checkAlignment(candles: Candle[]): {
    aligned: Candle[];
    misaligned: Candle[];
  } {
    const aligned: Candle[] = [];
    const misaligned: Candle[] = [];

    for (const c of candles) {
      // Candle timestamp should align to timeframe boundary
      const remainder = c.ts % this.timeframeMs;
      
      if (remainder === 0) {
        aligned.push(c);
      } else {
        // Try to snap to nearest boundary
        const snapped = Math.round(c.ts / this.timeframeMs) * this.timeframeMs;
        const snapDrift = Math.abs(snapped - c.ts);
        
        if (snapDrift < this.timeframeMs / 10) {
          // Close enough to snap (< 10% drift)
          aligned.push({ ...c, ts: snapped });
        } else {
          misaligned.push(c);
        }
      }
    }

    return { aligned, misaligned };
  }

  /**
   * Step 5: Mark candles as open or closed
   */
  private enforceFinality(candles: Candle[]): Candle[] {
    const now = Date.now();

    return candles.map((c, i) => {
      // Last candle is open if its close time is in the future
      const isLast = i === candles.length - 1;
      const candle_close_time = c.ts + this.timeframeMs;
      const isClosed = candle_close_time <= now;

      return {
        ...c,
        isFinal: isClosed,
      };
    });
  }

  /**
   * Step 6: Detect gaps between candles (both within batch and cross-batch)
   * 
   * PHASE 3: Gap Detection Without Drama
   * 
   * Two levels of gap detection:
   * 1. WITHIN BATCH: Detect missing candles between consecutive candles in this batch
   * 2. CROSS BATCH: Detect missing candles between last stored and first new (visibility)
   * 
   * No healing — just visibility. This alone improves Sharpe by preventing blind trades.
   */
  private detectGaps(candles: Candle[]): {
    valid: Candle[];
    gaps: Gap[];
  } {
    const gaps: Gap[] = [];

    // PHASE 3: CROSS-BATCH GAP DETECTION
    // Compare last stored candle against first incoming candle
    if (candles.length > 0 && this.metrics.lastValidTimestamp) {
      const firstNew = candles[0];
      const delta = firstNew.ts - this.metrics.lastValidTimestamp;
      
      // Expected delta: exactly one timeframe
      // Actual delta: could be more (gap = missing candles) or less (shouldn't happen)
      const expectedDelta = this.timeframeMs;
      
      if (delta > expectedDelta) {
        // Gap detected: missing candles between batches
        const gapMs = delta - expectedDelta;
        const missingCandles = Math.round(gapMs / this.timeframeMs);
        
        const crossBatchGap: Gap = {
          symbol: this.symbol,
          timeframe: this.timeframe,
          from: this.metrics.lastValidTimestamp + expectedDelta,
          to: firstNew.ts,
          expectedCandles: missingCandles,
          missingCandles,
        };
        
        gaps.push(crossBatchGap);
        
        // Log for visibility (Phase 3 principle)
        console.log(
          `[CIL] 📊 CROSS-BATCH GAP: ${this.symbol}/${this.timeframe}s ` +
          `| Last=${new Date(this.metrics.lastValidTimestamp).toISOString()} ` +
          `| First=${new Date(firstNew.ts).toISOString()} ` +
          `| Missing=${missingCandles} periods`
        );
      }
    }

    // WITHIN-BATCH GAP DETECTION
    // Check for gaps between consecutive candles in this batch
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      const expectedNext = prev.ts + this.timeframeMs;
      const gap = curr.ts - expectedNext;

      if (gap > 0) {
        // There's a gap
        const missingCandles = Math.round(gap / this.timeframeMs);
        gaps.push({
          symbol: this.symbol,
          timeframe: this.timeframe,
          from: expectedNext,
          to: curr.ts,
          expectedCandles: missingCandles,
          missingCandles,
        });
      } else if (gap < 0) {
        // Overlapping candles (shouldn't happen after sort + dedupe)
        console.warn(
          `[CIL] Overlapping candles: ${new Date(prev.ts).toISOString()} ` +
          `and ${new Date(curr.ts).toISOString()}`
        );
      }
    }

    // All candles are valid for storage (with gap info)
    return {
      valid: candles,
      gaps,
    };
  }

  /**
   * Analyze alignment results
   */
  private analyzeAlignment(aligned: Candle[], misaligned: Candle[]): {
    aligned: number;
    misaligned: number;
    avgDriftMs: number;
  } {
    let totalDrift = 0;
    
    for (const c of misaligned) {
      const remainder = c.ts % this.timeframeMs;
      const drift = Math.min(remainder, this.timeframeMs - remainder);
      totalDrift += drift;
    }

    return {
      aligned: aligned.length,
      misaligned: misaligned.length,
      avgDriftMs: misaligned.length > 0 ? totalDrift / misaligned.length : 0,
    };
  }

  /**
   * Analyze finality breakdown
   */
  private analyzeFinality(candles: ValidatedCandle[]): {
    closed: number;
    open: number;
    unknown: number;
  } {
    return {
      closed: candles.filter(c => c.isFinal).length,
      open: candles.filter(c => !c.isFinal).length,
      unknown: 0,
    };
  }

  /**
   * Analyze continuity and gaps
   */
  private analyzeContinuity(gaps: Gap[]): {
    hasGaps: boolean;
    totalGapMs: number;
    largestGapMs: number;
    gapCount: number;
  } {
    let totalGapMs = 0;
    let largestGapMs = 0;

    for (const gap of gaps) {
      const gapMs = gap.to - gap.from;
      totalGapMs += gapMs;
      largestGapMs = Math.max(largestGapMs, gapMs);
    }

    return {
      hasGaps: gaps.length > 0,
      totalGapMs,
      largestGapMs,
      gapCount: gaps.length,
    };
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    return {
      symbol: this.symbol,
      timeframe: this.timeframe,
      totalProcessed: this.metrics.totalProcessed,
      totalValid: this.metrics.totalValid,
      totalRejected: this.metrics.totalRejected,
      totalDeduplicated: this.metrics.totalDeduplicated,
      totalGaps: this.metrics.totalGaps,
      validityRate: this.metrics.totalProcessed > 0
        ? (this.metrics.totalValid / this.metrics.totalProcessed * 100).toFixed(1) + '%'
        : 'N/A',
      lastValidTimestamp: this.metrics.lastValidTimestamp
        ? new Date(this.metrics.lastValidTimestamp).toISOString()
        : null,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      totalValid: 0,
      totalRejected: 0,
      totalDeduplicated: 0,
      totalGaps: 0,
      lastValidTimestamp: undefined,
    };
  }
}

/**
 * Factory for creating integrity layers
 */
export class CandleIntegrityFactory {
  private static instances = new Map<string, CandleIntegrityLayer>();

  static getOrCreate(symbol: string, timeframe: number): CandleIntegrityLayer {
    const key = `${symbol}:${timeframe}`;
    
    if (!this.instances.has(key)) {
      this.instances.set(key, new CandleIntegrityLayer(symbol, timeframe));
    }

    return this.instances.get(key)!;
  }

  static reset() {
    this.instances.clear();
  }

  static getAllMetrics() {
    const metrics = [];
    
    for (const [key, layer] of this.instances) {
      metrics.push(layer.getMetrics());
    }

    return metrics;
  }
}
