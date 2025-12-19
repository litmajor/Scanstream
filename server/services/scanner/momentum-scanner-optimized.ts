/**
 * Optimized Momentum Scanner with Selective Indicator Computation
 * 
 * - Only computes enabled indicators based on configuration
 * - Leverages cache to avoid redundant computation
 * - Supports async deferred computation for heavy indicators
 * - Tracks performance metrics for diagnostics
 */

import type { MarketFrame } from './continuous-scanner';
import * as indicators from './indicators';
import { IndicatorCache } from './indicator-cache';
import { IndicatorConfigManager, type SymbolTimeframeConfig } from './indicator-config';

export interface MomentumScoreResult {
  score: number; // -1 .. +1
  reason?: string;
  indicators?: Record<string, any>;
  diagnostics?: {
    computedIndicators: string[];
    cachedIndicators: string[];
    deferredIndicators: string[];
    computationTimeMs: number;
    payloadSizeBytes: number;
  };
}

/**
 * Optimized MomentumScanner with:
 * - Config-driven selective computation
 * - Indicator caching
 * - Performance diagnostics
 * - Support for async deferred indicators
 */
export class OptimizedMomentumScanner {
  constructor(
    private configManager: IndicatorConfigManager,
    private cache: IndicatorCache
  ) {}

  /**
   * Compute score with selective indicators based on configuration.
   * Heavy indicators marked with deferToWorker are not computed here (set to undefined).
   */
  computeScore(
    symbol: string,
    timeframe: string,
    frames: MarketFrame[]
  ): MomentumScoreResult {
    const startTime = performance.now();
    const diagnostics = {
      computedIndicators: [] as string[],
      cachedIndicators: [] as string[],
      deferredIndicators: [] as string[],
      computationTimeMs: 0,
      payloadSizeBytes: 0
    };

    if (!frames || frames.length < 5) {
      return { score: 0, reason: 'INSUFFICIENT_DATA', indicators: {}, diagnostics };
    }

    const config = this.configManager.getEffectiveConfig(symbol, timeframe);
    const enabledIndicators = this.configManager.getEnabledIndicators(symbol, timeframe);
    const deferredIndicators = this.configManager.getDeferredIndicators(symbol, timeframe);

    // Extract price data
    const closes = frames.map(f => f.price.close);
    const volumes = frames.map(f => f.volume ?? 0);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);
    const lastIdx = closes.length - 1;

    const computedIndicators: Record<string, any> = {};

    // Try to get cached indicators first
    const cachedData = this.cache.getBatch(symbol, timeframe, enabledIndicators);
    Object.assign(computedIndicators, cachedData);
    diagnostics.cachedIndicators.push(...Object.keys(cachedData));

    // ========== REQUIRED INDICATORS FOR SCORING ==========
    // Always compute these core indicators if enabled; fallback to defaults if not

    if (enabledIndicators.includes('macd') && !('macd' in computedIndicators)) {
      const result = indicators.macd(closes);
      computedIndicators.macd = result;
      diagnostics.computedIndicators.push('macd');
      this.cache.set(symbol, timeframe, 'macd', result);
    }

    if (enabledIndicators.includes('rsi') && !('rsi' in computedIndicators)) {
      const result = indicators.rsi(closes);
      computedIndicators.rsi = result;
      diagnostics.computedIndicators.push('rsi');
      this.cache.set(symbol, timeframe, 'rsi', result);
    }

    if (enabledIndicators.includes('slope') && !('slope' in computedIndicators)) {
      const result = indicators.slope(closes, Math.min(10, closes.length));
      computedIndicators.slope = result;
      diagnostics.computedIndicators.push('slope');
      this.cache.set(symbol, timeframe, 'slope', result);
    }

    // Volume indicators
    if (enabledIndicators.includes('vwap') && !('vwap' in computedIndicators)) {
      const result = indicators.vwap(closes, volumes, 20);
      computedIndicators.vwap = result;
      diagnostics.computedIndicators.push('vwap');
      this.cache.set(symbol, timeframe, 'vwap', result);
    }

    // ========== OPTIONAL LIGHTWEIGHT INDICATORS ==========

    if (enabledIndicators.includes('ema') && !('ema' in computedIndicators)) {
      const result = indicators.ema(closes);
      computedIndicators.ema = result;
      diagnostics.computedIndicators.push('ema');
      this.cache.set(symbol, timeframe, 'ema', result);
    }

    if (enabledIndicators.includes('sma') && !('sma' in computedIndicators)) {
      const result = indicators.sma(closes);
      computedIndicators.sma = result;
      diagnostics.computedIndicators.push('sma');
      this.cache.set(symbol, timeframe, 'sma', result);
    }

    if (enabledIndicators.includes('atr') && !('atr' in computedIndicators)) {
      const result = indicators.atr(highs, lows, closes);
      computedIndicators.atr = result;
      diagnostics.computedIndicators.push('atr');
      this.cache.set(symbol, timeframe, 'atr', result);
    }

    if (enabledIndicators.includes('bollingerBands') && !('bollingerBands' in computedIndicators)) {
      const result = indicators.bollingerBands(closes);
      computedIndicators.bollingerBands = result;
      diagnostics.computedIndicators.push('bollingerBands');
      this.cache.set(symbol, timeframe, 'bollingerBands', result);
    }

    if (enabledIndicators.includes('adx') && !('adx' in computedIndicators)) {
      const result = indicators.adx(highs, lows, closes);
      computedIndicators.adx = result;
      diagnostics.computedIndicators.push('adx');
      this.cache.set(symbol, timeframe, 'adx', result);
    }

    if (enabledIndicators.includes('stochastic') && !('stochastic' in computedIndicators)) {
      const result = indicators.stochastic(highs, lows, closes);
      computedIndicators.stochastic = result;
      diagnostics.computedIndicators.push('stochastic');
      this.cache.set(symbol, timeframe, 'stochastic', result);
    }

    if (enabledIndicators.includes('cci') && !('cci' in computedIndicators)) {
      const result = indicators.cci(highs, lows, closes);
      computedIndicators.cci = result;
      diagnostics.computedIndicators.push('cci');
      this.cache.set(symbol, timeframe, 'cci', result);
    }

    if (enabledIndicators.includes('williamsR') && !('williamsR' in computedIndicators)) {
      const result = indicators.williamsR(highs, lows, closes);
      computedIndicators.williamsR = result;
      diagnostics.computedIndicators.push('williamsR');
      this.cache.set(symbol, timeframe, 'williamsR', result);
    }

    if (enabledIndicators.includes('obv') && !('obv' in computedIndicators)) {
      const result = indicators.obv(closes, volumes);
      computedIndicators.obv = result;
      diagnostics.computedIndicators.push('obv');
      this.cache.set(symbol, timeframe, 'obv', result);
    }

    if (enabledIndicators.includes('mfi') && !('mfi' in computedIndicators)) {
      const result = indicators.mfi(highs, lows, closes, volumes);
      computedIndicators.mfi = result;
      diagnostics.computedIndicators.push('mfi');
      this.cache.set(symbol, timeframe, 'mfi', result);
    }

    if (enabledIndicators.includes('cmf') && !('cmf' in computedIndicators)) {
      const result = indicators.cmf(highs, lows, closes, volumes);
      computedIndicators.cmf = result;
      diagnostics.computedIndicators.push('cmf');
      this.cache.set(symbol, timeframe, 'cmf', result);
    }

    if (enabledIndicators.includes('aroon') && !('aroon' in computedIndicators)) {
      const result = indicators.aroon(highs, lows);
      computedIndicators.aroon = result;
      diagnostics.computedIndicators.push('aroon');
      this.cache.set(symbol, timeframe, 'aroon', result);
    }

    if (enabledIndicators.includes('tsi') && !('tsi' in computedIndicators)) {
      const result = indicators.tsi(closes);
      computedIndicators.tsi = result;
      diagnostics.computedIndicators.push('tsi');
      this.cache.set(symbol, timeframe, 'tsi', result);
    }

    if (enabledIndicators.includes('elderRay') && !('elderRay' in computedIndicators)) {
      const result = indicators.elderRay(highs, lows, closes);
      computedIndicators.elderRay = result;
      diagnostics.computedIndicators.push('elderRay');
      this.cache.set(symbol, timeframe, 'elderRay', result);
    }

    if (enabledIndicators.includes('keltnerChannels') && !('keltnerChannels' in computedIndicators)) {
      const result = indicators.keltnerChannels(highs, lows, closes);
      computedIndicators.keltnerChannels = result;
      diagnostics.computedIndicators.push('keltnerChannels');
      this.cache.set(symbol, timeframe, 'keltnerChannels', result);
    }

    if (enabledIndicators.includes('parabolicSAR') && !('parabolicSAR' in computedIndicators)) {
      const result = indicators.parabolicSAR(highs, lows, closes);
      computedIndicators.parabolicSAR = result;
      diagnostics.computedIndicators.push('parabolicSAR');
      this.cache.set(symbol, timeframe, 'parabolicSAR', result);
    }

    if (enabledIndicators.includes('fibLevels') && !('fibLevels' in computedIndicators)) {
      const result = indicators.fibLevels(highs, lows, closes);
      computedIndicators.fibLevels = result;
      diagnostics.computedIndicators.push('fibLevels');
      this.cache.set(symbol, timeframe, 'fibLevels', result);
    }

    if (enabledIndicators.includes('vwma') && !('vwma' in computedIndicators)) {
      const result = indicators.vwma(closes, volumes);
      computedIndicators.vwma = result;
      diagnostics.computedIndicators.push('vwma');
      this.cache.set(symbol, timeframe, 'vwma', result);
    }

    // ========== DEFERRED HEAVY INDICATORS ==========
    // These are marked but not computed in this pass (for async worker processing)
    diagnostics.deferredIndicators.push(...deferredIndicators);

    // ========== SCORING LOGIC (uses computed indicators) ==========

    const score = this.computeScoringLogic(closes, volumes, highs, lows, computedIndicators);

    const reasonParts: string[] = [];
    const computed = computedIndicators as any;

    if (computed.macd) {
      const macdHistLast = computed.macd.histogram?.[closes.length - 1] ?? 0;
      reasonParts.push(`macdHist:${macdHistLast.toFixed(6)}`);
    }
    if (computed.rsi) {
      const rsiLast = computed.rsi[closes.length - 1] ?? 50;
      reasonParts.push(`rsi:${rsiLast.toFixed(1)}`);
    }
    if (computed.slope !== undefined) {
      const meanPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
      const relSlope = meanPrice !== 0 ? computed.slope / meanPrice : 0;
      reasonParts.push(`slope:${relSlope.toExponential(2)}`);
    }

    diagnostics.computationTimeMs = performance.now() - startTime;
    diagnostics.payloadSizeBytes = this.estimatePayloadSize(computedIndicators);

    return {
      score,
      reason: reasonParts.join(' | '),
      indicators: computedIndicators,
      diagnostics
    };
  }

  /**
   * Core scoring logic: combines available indicators into a final score.
   * Gracefully handles missing indicators (uses defaults).
   */
  private computeScoringLogic(
    closes: number[],
    volumes: number[],
    highs: number[],
    lows: number[],
    indicators: Record<string, any>
  ): number {
    const lastIdx = closes.length - 1;

    // MACD contribution
    let macdScore = 0;
    if (indicators.macd?.histogram) {
      const macdHistLast = indicators.macd.histogram[lastIdx];
      if (!Number.isNaN(macdHistLast)) {
        macdScore = Math.max(-1, Math.min(1, macdHistLast * 5));
      }
    }

    // RSI contribution
    let rsiScore = 0;
    if (indicators.rsi) {
      const rsiLast = indicators.rsi[lastIdx];
      if (!Number.isNaN(rsiLast)) {
        rsiScore = (50 - rsiLast) / 50;
      }
    }

    // Slope contribution
    let slopeScore = 0;
    if (indicators.slope !== undefined) {
      const meanPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
      const relSlope = meanPrice !== 0 ? indicators.slope / meanPrice : 0;
      slopeScore = Math.max(-1, Math.min(1, relSlope * 200));
    }

    // Volume confirmation
    let volScore = 0;
    if (volumes.length > 0) {
      const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, volumes.length);
      const volLast = volumes[volumes.length - 1] ?? 0;
      const volRatio = avgVol > 0 ? volLast / avgVol : 1;
      volScore = Math.max(-1, Math.min(1, (volRatio - 1) / 2));
    }

    // VWAP contribution (if computed)
    let vwapScore = 0;
    if (indicators.vwap) {
      const vwapLast = indicators.vwap[lastIdx];
      if (!Number.isNaN(vwapLast)) {
        const vwapGap = (closes[lastIdx] - vwapLast) / vwapLast;
        vwapScore = Math.max(-1, Math.min(1, vwapGap * 3));
      }
    }

    // Weighted combination (tunable weights)
    const weights = {
      macd: 0.35,
      rsi: 0.20,
      slope: 0.20,
      vol: 0.10,
      vwap: 0.10,
      other: 0.05
    };

    // Bonus from ADX (if available) for trend strength
    let adxBonus = 0;
    if (indicators.adx) {
      const adxLast = indicators.adx[lastIdx];
      if (!Number.isNaN(adxLast) && adxLast > 25) {
        adxBonus = 0.1; // Strong trend amplification
      }
    }

    const rawScore =
      macdScore * weights.macd +
      rsiScore * weights.rsi +
      slopeScore * weights.slope +
      volScore * weights.vol +
      vwapScore * weights.vwap +
      adxBonus * weights.other;

    return Math.max(-1, Math.min(1, rawScore));
  }

  /**
   * Estimate payload size in bytes for diagnostics.
   */
  private estimatePayloadSize(indicators: Record<string, any>): number {
    let bytes = 0;
    for (const [name, data] of Object.entries(indicators)) {
      if (Array.isArray(data)) {
        // Each number is ~8 bytes, plus overhead
        bytes += data.length * 8 + 50;
      } else if (typeof data === 'object' && data !== null) {
        // Rough JSON estimate
        bytes += JSON.stringify(data).length + 100;
      } else {
        bytes += 50;
      }
    }
    return bytes;
  }
}

export default OptimizedMomentumScanner;
