/**
 * MarketFrame Aggregator & Storage Layer
 * 
 * Responsible for:
 * 1. Time-bucketing raw ticks into MarketFrames
 * 2. Computing indicators on bucketed data
 * 3. Persisting to storage
 * 4. Serving frames for replay and analysis
 * 
 * This layer bridges RawTick → MarketFrame.
 */

import type { RawTick } from '../types/RawTick';
import type { MarketFrame, MarketFrameIndicators, MarketFrameMicrostructure } from '../types/MarketFrame';
import { createMarketFrame } from '../types/MarketFrame';

/**
 * Options for time-bucketing RawTicks into MarketFrames.
 */
export interface AggregationOptions {
  /** Timeframe: '1s', '5s', '1m', '5m', '1h', '1d' */
  timeframe: string;

  /** Compute indicators (ema, rsi, etc.)? */
  includeIndicators?: boolean;

  /** Compute microstructure metrics (spread, imbalance)? */
  includeMicrostructure?: boolean;

  /** Max ticks to retain in-memory buffer per bucket */
  bufferSize?: number;
}

/**
 * In-memory accumulator for a single time bucket.
 * Aggregates ticks, computes OHLCV, prepares for MarketFrame creation.
 */
interface BucketAccumulator {
  symbol: string;
  timeframe: string;
  tsOpen: number; // bucket start timestamp
  tsClose: number; // bucket end timestamp (or current if not final)
  ticks: RawTick[];
  ohlcv: {
    open: number | null;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  isFinal: boolean;
}

/**
 * Compute OHLCV from a list of ticks.
 */
function computeOHLCV(ticks: RawTick[]): { open: number; high: number; low: number; close: number; volume: number } {
  if (ticks.length === 0) {
    return { open: 0, high: 0, low: 0, close: 0, volume: 0 };
  }

  // Sort by timestamp (ascending)
  const sorted = [...ticks].sort((a, b) => a.ts - b.ts);
  const open = sorted[0].price;
  const close = sorted[sorted.length - 1].price;
  const prices = sorted.map(t => t.price);
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const volume = sorted.reduce((sum, t) => sum + (t.size ?? 0), 0);

  return { open, high, low, close, volume };
}

/**
 * Simple EMA (Exponential Moving Average) computation.
 * @param prices Array of prices
 * @param period Number of periods (e.g., 20, 50)
 * @returns EMA value (or null if insufficient data)
 */
function computeEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Simple RSI (Relative Strength Index) computation.
 * @param prices Array of prices
 * @param period Number of periods (default 14)
 * @returns RSI value 0-100 (or null if insufficient data)
 */
function computeRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  const deltas = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }
  const gains = deltas.filter(d => d > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(deltas.filter(d => d < 0).reduce((a, b) => a + b, 0)) / period;
  const rs = gains / (losses || 1);
  return 100 - 100 / (1 + rs);
}

/**
 * Compute basic microstructure metrics from ticks.
 */
function computeMicrostructure(ticks: RawTick[]): MarketFrameMicrostructure | undefined {
  if (ticks.length === 0) return undefined;

  const buys = ticks.filter(t => t.side === 'buy').length;
  const sells = ticks.filter(t => t.side === 'sell').length;
  const total = buys + sells;
  const aggression = total > 0 ? buys / total : 0.5;

  return {
    aggression,
  };
}

/**
 * Compute indicators for a MarketFrame from a list of ticks and their prices.
 */
function computeIndicators(ticks: RawTick[], _ohlcv: any): MarketFrameIndicators | undefined {
  if (ticks.length < 2) return undefined;

  const prices = ticks.map(t => t.price);
  const indicators: MarketFrameIndicators = {};

  const ema20 = computeEMA(prices, 20);
  if (ema20 !== null) indicators.ema20 = ema20;

  const ema50 = computeEMA(prices, 50);
  if (ema50 !== null) indicators.ema50 = ema50;

  const rsi = computeRSI(prices, 14);
  if (rsi !== null) indicators.rsi = rsi;

  return Object.keys(indicators).length > 0 ? indicators : undefined;
}

/**
 * MarketFrameAggregator — stateful aggregator for time-bucketing ticks into frames.
 */
export class MarketFrameAggregator {
  private accumulators: Map<string, BucketAccumulator> = new Map(); // key = `${symbol}_${tsOpen}`
  private options: AggregationOptions;

  constructor(options: AggregationOptions) {
    this.options = options;
  }

  /**
   * Get timeframe duration in milliseconds.
   */
  private getTimeframeDurationMs(): number {
    const tf = this.options.timeframe;
    if (tf === '1s') return 1000;
    if (tf === '5s') return 5000;
    if (tf === '1m') return 60 * 1000;
    if (tf === '5m') return 5 * 60 * 1000;
    if (tf === '1h') return 60 * 60 * 1000;
    if (tf === '1d') return 24 * 60 * 60 * 1000;
    // default 1m
    return 60 * 1000;
  }

  /**
   * Get the bucket start timestamp for a given tick timestamp.
   */
  private getBucketStart(tsMs: number): number {
    const duration = this.getTimeframeDurationMs();
    return Math.floor(tsMs / duration) * duration;
  }

  /**
   * Aggregate a tick into a bucket. Returns a MarketFrame if bucket became final.
   */
  aggregate(tick: RawTick, isFinal: boolean = false): MarketFrame | null {
    const bucketStart = this.getBucketStart(tick.ts);
    const bucketEnd = bucketStart + this.getTimeframeDurationMs();
    const key = `${tick.symbol}_${bucketStart}`;

    let acc = this.accumulators.get(key);
    if (!acc) {
      acc = {
        symbol: tick.symbol,
        timeframe: this.options.timeframe,
        tsOpen: bucketStart,
        tsClose: bucketEnd,
        ticks: [],
        ohlcv: { open: null, high: tick.price, low: tick.price, close: tick.price, volume: 0 },
        isFinal: false,
      };
      this.accumulators.set(key, acc);
    }

    // Add tick to bucket
    acc.ticks.push(tick);
    const ohlcv = computeOHLCV(acc.ticks);
    acc.ohlcv = ohlcv;
    acc.tsClose = Math.max(acc.tsClose, tick.ts + 1); // extend close timestamp to latest tick + 1ms

    // Check if bucket should be finalized
    const shouldFinalize = isFinal || tick.ts >= bucketEnd;
    if (shouldFinalize && !acc.isFinal) {
      acc.isFinal = true;

      // Create MarketFrame from accumulated bucket
      const frame: MarketFrame = createMarketFrame(
        acc.symbol,
        acc.timeframe,
        acc.ohlcv as any,
        {
          tsOpen: acc.tsOpen,
          tsClose: acc.tsClose,
          isFinal: true,
          exchangeCount: 1,
          latencyMs: Date.now() - tick.ts,
          source: 'live',
        }
      );

      // Add computed indicators if requested
      if (this.options.includeIndicators) {
        frame.indicators = computeIndicators(acc.ticks, acc.ohlcv);
      }

      // Add microstructure if requested
      if (this.options.includeMicrostructure) {
        frame.microstructure = computeMicrostructure(acc.ticks);
      }

      // Clean up old buckets to prevent memory leak
      if (this.accumulators.size > (this.options.bufferSize ?? 100)) {
        const oldestKey = Array.from(this.accumulators.keys()).sort()[0];
        this.accumulators.delete(oldestKey);
      }

      return frame;
    }

    return null;
  }

  /**
   * Flush all pending buckets and return final frames.
   */
  flush(): MarketFrame[] {
    const frames: MarketFrame[] = [];
    this.accumulators.forEach((acc, _key) => {
      if (!acc.isFinal && acc.ticks.length > 0) {
        const ohlcv = computeOHLCV(acc.ticks);
        const frame: MarketFrame = createMarketFrame(
          acc.symbol,
          acc.timeframe,
          ohlcv,
          {
            tsOpen: acc.tsOpen,
            tsClose: acc.tsClose,
            isFinal: true,
            exchangeCount: 1,
            latencyMs: Date.now() - (acc.ticks[acc.ticks.length - 1]?.ts ?? Date.now()),
            source: 'live',
          }
        );

        if (this.options.includeIndicators) {
          frame.indicators = computeIndicators(acc.ticks, ohlcv);
        }

        if (this.options.includeMicrostructure) {
          frame.microstructure = computeMicrostructure(acc.ticks);
        }

        frames.push(frame);
        acc.isFinal = true;
      }
    });
    return frames;
  }

  /**
   * Clear all accumulators.
   */
  reset(): void {
    this.accumulators.clear();
  }
}

/**
 * In-memory storage for MarketFrames (for demo/dev purposes).
 * In production, replace with database storage.
 */
export class MarketFrameStore {
  private frames: Map<string, MarketFrame[]> = new Map(); // key = symbol

  /**
   * Store a frame.
   */
  save(frame: MarketFrame): void {
    const key = frame.symbol;
    if (!this.frames.has(key)) {
      this.frames.set(key, []);
    }
    this.frames.get(key)!.push(frame);
  }

  /**
   * Retrieve frames for a symbol within a time range.
   */
  queryBySymbol(symbol: string, fromMs?: number, toMs?: number): MarketFrame[] {
    const frames = this.frames.get(symbol) ?? [];
    return frames.filter(
      f =>
        (!fromMs || f.meta.tsClose >= fromMs) &&
        (!toMs || f.meta.tsOpen <= toMs)
    );
  }

  /**
   * Retrieve the latest frame for a symbol.
   */
  getLatest(symbol: string): MarketFrame | null {
    const frames = this.frames.get(symbol) ?? [];
    return frames.length > 0 ? frames[frames.length - 1] : null;
  }

  /**
   * Clear all stored frames.
   */
  clear(): void {
    this.frames.clear();
  }
}

/**
 * Create a demo aggregator + store for testing.
 */
export function createDemoMarketFramePipeline(timeframe: string = '1m') {
  const aggregator = new MarketFrameAggregator({
    timeframe,
    includeIndicators: true,
    includeMicrostructure: true,
    bufferSize: 100,
  });

  const store = new MarketFrameStore();

  return { aggregator, store };
}
