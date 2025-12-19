/**
 * Signal Processor
 * 
 * Derives high-level signals from frame.indicators (the 67 columns)
 * 
 * Responsibility:
 * - Read raw indicators from MarketFrame
 * - Compute unified signals (trend, breakout, momentum, etc.)
 * - Combine multiple indicators for confluence
 * - Return immutable SignalObject (consumed by agents)
 * 
 * Rule: This runs ONCE per frame, agents consume the result
 */

import type { MarketFrame } from '../../types/MarketFrame';
import type { SignalObject } from '../../types/SignalObject';

/**
 * Main entry point: derive signals from frame indicators
 * 
 * @param frame Market frame with 67-column indicators
 * @returns Unified SignalObject (immutable)
 */
export function deriveSignalsFromIndicators(frame: MarketFrame): SignalObject {
  const ind = frame.indicators || {};
  const now = Date.now();

  // Step 1: Trend signal (from EMA alignment)
  const trend = deriveTrendSignal(frame);

  // Step 2: Breakout signal (from volume profile + price action)
  const breakout = deriveBreakoutSignal(frame);

  // Step 3: Momentum signal (from RSI + Stochastic)
  const momentum = deriveMomentumSignal(frame);

  // Step 4: Bollinger Band position
  const bbPosition = deriveBBPosition(frame);

  // Step 5: Volatility assessment (from ATR)
  const volatility = deriveVolatilitySignal(frame);

  // Step 6: Volume profile analysis
  const volumeProfile = deriveVolumeProfileSignal(frame);

  // Step 7: Mean reversion signals
  const meanReversion = deriveMeanReversionSignal(frame);

  // Step 8: Ichimoku status (if available)
  const ichimokuStatus = deriveIchimokuStatus(frame);

  // Step 9: ADX trend (if available)
  const adxTrend = deriveADXTrend(frame);

  // Step 10: Confluence score (how many signals align)
  const confluenceScore = calculateConfluenceScore(
    trend.trend,
    breakout.direction,
    momentum,
    bbPosition,
    volatility
  );
  const confluenceLevel =
    confluenceScore > 0.75 ? 'strong' :
    confluenceScore > 0.5 ? 'medium' : 'weak';

  // Build final signal object
  const signals: SignalObject = {
    trend: trend.trend,
    trendStrength: trend.strength,

    breakout: breakout.breakout,
    breakoutDirection: breakout.direction,
    breakoutStrength: breakout.strength,

    momentum,
    rsiLevel: ind.rsi ?? 50,

    bbPosition,
    bbWidth: ind.bb?.upper && ind.bb?.lower ? (ind.bb.upper - ind.bb.lower) : 0,
    volatility: volatility.level,
    atrValue: ind.atr ?? 0,

    volumeProfile,

    meanReversion,

    confluenceScore,
    confluenceLevel,

    ichimokuStatus: ichimokuStatus ?? undefined,
    adxTrend: adxTrend ?? undefined,

    timestamp: now,
    source: (frame.meta.source === 'WS' ? 'live' : 
             frame.meta.source === 'REPLAY_API' ? 'replay' : 
             frame.meta.source === 'CACHE' ? 'scanner' : 'scanner') as any,
  };

  return Object.freeze(signals);
}

/**
 * Derive trend signal from EMA alignment
 * 
 * Rules:
 * - UP: price > EMA5 > EMA20 > EMA50
 * - DOWN: price < EMA5 < EMA20 < EMA50
 * - NEUTRAL: mixed alignment
 */
function deriveTrendSignal(frame: MarketFrame): { trend: 'up' | 'down' | 'neutral'; strength: number } {
  const { close } = frame;
  const ind = frame.indicators || {};

  // Get EMA values with fallback to undefined
  const ema5 = (ind as any).ema5;
  const ema20 = ind.ema20;
  const ema50 = ind.ema50;

  // Fallback if EMAs missing
  if (!ema5 || !ema20 || !ema50) {
    return { trend: 'neutral', strength: 0 };
  }

  const bullish = close > ema5 && ema5 > ema20 && ema20 > ema50;
  const bearish = close < ema5 && ema5 < ema20 && ema20 < ema50;

  if (bullish) {
    // Measure bullish strength: how far above EMAs
    const avgEMA = (ema5 + ema20 + ema50) / 3;
    const strength = Math.min((close - avgEMA) / avgEMA, 1);
    return { trend: 'up', strength };
  }

  if (bearish) {
    // Measure bearish strength: how far below EMAs
    const avgEMA = (ema5 + ema20 + ema50) / 3;
    const strength = Math.min((avgEMA - close) / avgEMA, 1);
    return { trend: 'down', strength };
  }

  return { trend: 'neutral', strength: 0 };
}

/**
 * Derive breakout signal from volume profile and price action
 */
function deriveBreakoutSignal(frame: MarketFrame): {
  breakout: boolean;
  direction: 'up' | 'down' | 'none';
  strength: number;
} {
  const { close, high, low } = frame;
  const ind = frame.indicators || {};
  const vp = (ind as any).volumeProfileRegular;

  if (!vp || !vp.poc) {
    return { breakout: false, direction: 'none', strength: 0 };
  }

  // Price above POC + volume > average → up breakout
  const priceAbovePOC = close > vp.poc * 1.02; // 2% above POC

  // Price below POC + volume → down breakout
  const priceBelowPOC = close < vp.poc * 0.98; // 2% below POC

  if (priceAbovePOC) {
    // Strength: how far above POC
    const pocDiff = (close - vp.poc) / vp.poc;
    return { breakout: true, direction: 'up', strength: Math.min(pocDiff / 0.05, 1) };
  }

  if (priceBelowPOC) {
    const pocDiff = (vp.poc - close) / vp.poc;
    return { breakout: true, direction: 'down', strength: Math.min(pocDiff / 0.05, 1) };
  }

  return { breakout: false, direction: 'none', strength: 0 };
}

/**
 * Derive momentum signal from RSI and Stochastic
 */
function deriveMomentumSignal(frame: MarketFrame): 'overbought' | 'oversold' | 'neutral' {
  const ind = frame.indicators || {};
  const rsi = (ind as any).rsi;

  if (!rsi) {
    return 'neutral';
  }

  // RSI > 70 → overbought
  if (rsi > 70) return 'overbought';

  // RSI < 30 → oversold
  if (rsi < 30) return 'oversold';

  return 'neutral';
}

/**
 * Derive Bollinger Band position
 */
function deriveBBPosition(frame: MarketFrame): 'oversold' | 'normal' | 'overbought' {
  const { close } = frame;
  const bb = frame.indicators?.bb;

  if (!bb || !bb.upper || !bb.lower) {
    return 'normal';
  }

  if (close > bb.upper) return 'overbought';
  if (close < bb.lower) return 'oversold';
  return 'normal';
}

/**
 * Derive volatility signal from ATR
 */
function deriveVolatilitySignal(frame: MarketFrame): {
  level: 'low' | 'medium' | 'high';
  atrPercent: number;
} {
  const ind = frame.indicators || {};
  const atr = (ind as any).atr;
  const { close } = frame;

  if (!atr) {
    return { level: 'medium', atrPercent: 0 };
  }

  const atrPercent = (atr / close) * 100;

  // Heuristic: adjust these based on asset
  if (atrPercent < 1) return { level: 'low', atrPercent };
  if (atrPercent > 3) return { level: 'high', atrPercent };
  return { level: 'medium', atrPercent };
}

/**
 * Derive volume profile signal
 */
function deriveVolumeProfileSignal(frame: MarketFrame): {
  poc: number;
  accumulation: boolean;
  distribution: boolean;
} {
  const ind = frame.indicators || {};
  const vp = (ind as any).volumeProfile?.regular;

  if (!vp || !vp.poc) {
    return { poc: frame.close, accumulation: false, distribution: false };
  }

  // Accumulation: high volume at lower prices (building strength)
  const accumulation = frame.close < vp.poc && frame.volume > 0;

  // Distribution: high volume at higher prices (taking profits)
  const distribution = frame.close > vp.poc && frame.volume > 0;

  return {
    poc: vp.poc,
    accumulation,
    distribution,
  };
}

/**
 * Derive mean reversion signal
 * Compares current price to simple moving average
 */
function deriveMeanReversionSignal(frame: MarketFrame): {
  distanceFromMean: number;
  reverting: boolean;
} {
  const { close } = frame;
  const ind = frame.indicators || {};
  const sma = (ind as any).sma;

  if (!sma?.sma50) {
    return { distanceFromMean: 0, reverting: false };
  }

  const distance = ((close - sma.sma50) / sma.sma50) * 100;

  // Reverting if price > 3% away from SMA and moving back
  const reverting = Math.abs(distance) > 3;

  return {
    distanceFromMean: distance,
    reverting,
  };
}

/**
 * Derive Ichimoku cloud status
 */
function deriveIchimokuStatus(frame: MarketFrame): {
  priceAboveCloud: boolean;
  cloudColor: 'bullish' | 'bearish';
  conversion: number;
  baseline: number;
} | null {
  const ind = frame.indicators || {};
  const ich = (ind as any).ichimoku;

  if (!ich || !ich.tenkan || !ich.kijun) {
    return null;
  }

  const cloudColor = ich.senkouA && ich.senkouB
    ? ich.senkouA > ich.senkouB ? 'bullish' : 'bearish'
    : 'bullish';

  const cloudMid = ich.senkouA && ich.senkouB
    ? (ich.senkouA + ich.senkouB) / 2
    : frame.close;

  return {
    priceAboveCloud: frame.close > cloudMid,
    cloudColor,
    conversion: ich.tenkan,
    baseline: ich.kijun,
  };
}

/**
 * Derive ADX trend strength
 */
function deriveADXTrend(frame: MarketFrame): {
  value: number;
  strength: 'weak' | 'moderate' | 'strong';
} | null {
  const ind = frame.indicators || {};
  const adx = (ind as any).adx;

  if (!adx) {
    return null;
  }

  const strength =
    adx > 40 ? 'strong' :
    adx > 25 ? 'moderate' : 'weak';

  return { value: adx, strength };
}

/**
 * Calculate confluence score
 * How many signals agree on direction?
 */
function calculateConfluenceScore(
  trend: 'up' | 'down' | 'neutral',
  breakout: 'up' | 'down' | 'none',
  momentum: 'overbought' | 'oversold' | 'neutral',
  bbPosition: 'oversold' | 'normal' | 'overbought',
  volatility: { level: 'low' | 'medium' | 'high'; atrPercent: number }
): number {
  let bullishSignals = 0;
  let bearishSignals = 0;
  const totalSignals = 5; // trend, breakout, momentum, bb, volatility

  // Trend
  if (trend === 'up') bullishSignals++;
  if (trend === 'down') bearishSignals++;

  // Breakout
  if (breakout === 'up') bullishSignals++;
  if (breakout === 'down') bearishSignals++;

  // Momentum (overbought = continuation, oversold = reversal potential)
  if (momentum === 'overbought') bullishSignals++;
  if (momentum === 'oversold') bearishSignals++;

  // BB Position
  if (bbPosition === 'overbought') bullishSignals++;
  if (bbPosition === 'oversold') bearishSignals++;

  // Volatility (expansion = potential breakout, contraction = consolidation)
  if (volatility.level === 'high') bullishSignals++;

  // Calculate confluence as how aligned signals are
  const maxSignals = Math.max(bullishSignals, bearishSignals);
  return maxSignals / totalSignals;
}

/**
 * Batch derive signals from multiple frames
 */
export function deriveSignalsBatch(frames: MarketFrame[]): SignalObject[] {
  return frames.map(frame => deriveSignalsFromIndicators(frame));
}
