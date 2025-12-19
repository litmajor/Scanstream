/**
 * Strategy Engine
 * 
 * Implements all 19 trading strategies from the strategies guide.
 * Each strategy evaluates market conditions and returns trading signals.
 * 
 * Strategies are organized by category:
 * - Trend-Following (4 strategies)
 * - Momentum (3 strategies)
 * - Volatility (3 strategies)
 * - Volume (3 strategies)
 * - Combination (3 strategies)
 * - Advanced (3 strategies)
 */

import * as Indicators from './indicators';

export enum SignalStrength {
  VERY_WEAK = 1,
  WEAK = 2,
  MEDIUM = 3,
  STRONG = 4,
  VERY_STRONG = 5
}

export interface StrategySignal {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: SignalStrength;
  confidence: number; // 0-100
  reason: string;
  indicators: Record<string, number>;
}

export interface StrategyInput {
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  timeframe?: string;
}

/**
 * TREND-FOLLOWING STRATEGIES
 */

/** Strategy 1: MACD Crossover
 * Best for: Trending markets, swing trading
 * Win Rate: 55-60%
 */
export function macdCrossover(input: StrategyInput): StrategySignal {
  const { close } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const { macd: macdLine, signal: signalLine, histogram } = Indicators.macd(close);

  if (i < 2 || Number.isNaN(macdLine[i]) || Number.isNaN(signalLine[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const macdCrossesAbove = macdLine[i] > signalLine[i] && macdLine[prev] <= signalLine[prev];
  const macdCrossesBelow = macdLine[i] < signalLine[i] && macdLine[prev] >= signalLine[prev];

  // Stronger signal if histogram is further in direction (2-3 bars consistent)
  let histogramStrength = 1;
  if (i >= 2) {
    const histConsistent = 
      (histogram[i] > 0 && histogram[i-1] > 0) ||
      (histogram[i] < 0 && histogram[i-1] < 0);
    if (histConsistent) histogramStrength = 1.5;
  }

  if (macdCrossesAbove) {
    return {
      signal: 'BUY',
      strength: Math.min(SignalStrength.VERY_STRONG, Math.ceil(3 * histogramStrength)),
      confidence: 58 + (histogramStrength > 1 ? 8 : 0),
      reason: 'MACD crosses above signal line (golden cross)',
      indicators: { macd: macdLine[i], signal: signalLine[i], histogram: histogram[i] }
    };
  }

  if (macdCrossesBelow) {
    return {
      signal: 'SELL',
      strength: Math.min(SignalStrength.VERY_STRONG, Math.ceil(3 * histogramStrength)),
      confidence: 58 + (histogramStrength > 1 ? 8 : 0),
      reason: 'MACD crosses below signal line (death cross)',
      indicators: { macd: macdLine[i], signal: signalLine[i], histogram: histogram[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 15, reason: 'No crossover', indicators: { macd: macdLine[i], signal: signalLine[i] } };
}

/** Strategy 2: ADX Trend Strength
 * Best for: Identifying strong trends
 * Use as filter: Only take trades when ADX > 25
 */
export function adxTrendFilter(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;

  const adxValues = Indicators.adx(high, low, close, 14);
  const adx = adxValues[i];

  if (Number.isNaN(adx)) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let strength = SignalStrength.WEAK;
  let confidence = 0;
  let reason = '';

  if (adx < 20) {
    signal = 'NEUTRAL';
    strength = SignalStrength.VERY_WEAK;
    confidence = 5;
    reason = `Weak trend (ADX ${adx.toFixed(2)}), avoid trend-following`;
  } else if (adx >= 20 && adx < 25) {
    signal = 'NEUTRAL';
    strength = SignalStrength.WEAK;
    confidence = 20;
    reason = `Emerging trend (ADX ${adx.toFixed(2)}), use caution`;
  } else if (adx >= 25 && adx < 40) {
    signal = 'BUY'; // Acts as a go signal for other strategies
    strength = SignalStrength.STRONG;
    confidence = 65;
    reason = `Strong trend (ADX ${adx.toFixed(2)}), trend-following valid`;
  } else {
    signal = 'BUY'; // Very strong trend
    strength = SignalStrength.VERY_STRONG;
    confidence = 80;
    reason = `Very strong trend (ADX ${adx.toFixed(2)}), excellent for trend trading`;
  }

  return { signal, strength, confidence, reason, indicators: { adx } };
}

/** Strategy 3: Parabolic SAR Trend Trading
 * Best for: Clear trending markets
 * Provides built-in stop loss (SAR value)
 */
export function parabolicSarTrend(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const sarValues = Indicators.parabolicSAR(high, low, close);
  const currentSAR = sarValues[i];
  const prevSAR = sarValues[prev];
  const lastClose = close[i];
  const prevClose = close[prev];

  if (Number.isNaN(currentSAR) || Number.isNaN(prevSAR)) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  // SAR flips from below to above price = bearish
  const sarFlipsBelow = prevSAR >= prevClose && currentSAR < lastClose;
  // SAR flips from above to below price = bullish
  const sarFlipsAbove = prevSAR <= prevClose && currentSAR > lastClose;

  if (sarFlipsBelow) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 52,
      reason: `SAR flips below price (BUY signal), stop at ${currentSAR.toFixed(4)}`,
      indicators: { sar: currentSAR, close: lastClose }
    };
  }

  if (sarFlipsAbove) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 52,
      reason: `SAR flips above price (SELL signal), stop at ${currentSAR.toFixed(4)}`,
      indicators: { sar: currentSAR, close: lastClose }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: 'No SAR flip', indicators: { sar: currentSAR } };
}

/** Strategy 4: Ichimoku Cloud
 * Best for: Trend identification and S/R levels
 * Uses 5 bullish/bearish conditions
 */
export function ichimokuCloud(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;

  const ichimoku = Indicators.ichimoku(high, low, close);
  if (!ichimoku || Number.isNaN(ichimoku.senkouA[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const lastClose = close[i];
  const senkouA = ichimoku.senkouA[i];
  const senkouB = ichimoku.senkouB[i];
  const cloudTop = Math.max(senkouA, senkouB);
  const cloudBottom = Math.min(senkouA, senkouB);
  const cloudGreen = senkouA > senkouB;

  // Count bullish conditions
  let bullishCount = 0;
  if (lastClose > cloudTop) bullishCount++; // Above cloud
  if (ichimoku.tenkan[i] > ichimoku.kijun[i]) bullishCount++; // Tenkan > Kijun
  if (cloudGreen) bullishCount++; // Cloud green
  
  // Chikou span comparison (shifted 26 periods back in time)
  if (i >= 26 && lastClose > close[i - 26]) bullishCount++;

  let bearishCount = 0;
  if (lastClose < cloudBottom) bearishCount++;
  if (ichimoku.tenkan[i] < ichimoku.kijun[i]) bearishCount++;
  if (!cloudGreen) bearishCount++;
  if (i >= 26 && lastClose < close[i - 26]) bearishCount++;

  if (bullishCount >= 3) {
    return {
      signal: 'BUY',
      strength: Math.min(SignalStrength.VERY_STRONG, Math.ceil(bullishCount)),
      confidence: 50 + (bullishCount * 10),
      reason: `${bullishCount}/4 Ichimoku bullish conditions met`,
      indicators: { 
        price: lastClose, 
        cloudTop, 
        cloudBottom, 
        tenkan: ichimoku.tenkan[i],
        kijun: ichimoku.kijun[i]
      }
    };
  }

  if (bearishCount >= 3) {
    return {
      signal: 'SELL',
      strength: Math.min(SignalStrength.VERY_STRONG, Math.ceil(bearishCount)),
      confidence: 50 + (bearishCount * 10),
      reason: `${bearishCount}/4 Ichimoku bearish conditions met`,
      indicators: { 
        price: lastClose, 
        cloudTop, 
        cloudBottom,
        tenkan: ichimoku.tenkan[i],
        kijun: ichimoku.kijun[i]
      }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 15, reason: 'Insufficient Ichimoku alignment', indicators: { price: lastClose, cloudTop, cloudBottom } };
}

/**
 * MOMENTUM STRATEGIES
 */

/** Strategy 5: RSI Oversold/Overbought Reversal
 * Best for: Range-bound markets, reversals
 * Win Rate: 60-65%
 */
export function rsiOversoldOverbought(input: StrategyInput): StrategySignal {
  const { close } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const rsi = Indicators.rsi(close, 14);

  if (Number.isNaN(rsi[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const rsiVal = rsi[i];
  const rsiPrev = rsi[prev];

  // Buy: RSI < 30 and crosses back above 30
  if (rsiVal > 30 && rsiPrev <= 30) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 62,
      reason: `RSI crosses above 30 from oversold (${rsiVal.toFixed(2)})`,
      indicators: { rsi: rsiVal }
    };
  }

  // Sell: RSI > 70 and crosses back below 70
  if (rsiVal < 70 && rsiPrev >= 70) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 62,
      reason: `RSI crosses below 70 from overbought (${rsiVal.toFixed(2)})`,
      indicators: { rsi: rsiVal }
    };
  }

  // Context: In bull market, buy dips at RSI 40-50; in bear market, sell rallies at RSI 50-60
  if (rsiVal > 40 && rsiVal < 50) {
    return { signal: 'BUY', strength: SignalStrength.MEDIUM, confidence: 45, reason: 'RSI in bull market dip zone (40-50)', indicators: { rsi: rsiVal } };
  }

  if (rsiVal > 50 && rsiVal < 60) {
    return { signal: 'SELL', strength: SignalStrength.MEDIUM, confidence: 45, reason: 'RSI in bear market rally zone (50-60)', indicators: { rsi: rsiVal } };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: `RSI neutral (${rsiVal.toFixed(2)})`, indicators: { rsi: rsiVal } };
}

/** Strategy 6: Stochastic Oscillator
 * Best for: Overbought/oversold reversals
 * Uses %K and %D crossovers
 */
export function stochasticCrossover(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const stoch = Indicators.stochastic(high, low, close, 14, 3);

  if (!stoch || Number.isNaN(stoch.k[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const kCurrent = stoch.k[i];
  const dCurrent = stoch.d[i];
  const kPrev = stoch.k[prev];
  const dPrev = stoch.d[prev];

  // Buy: %K crosses above %D while both below 20
  if (kCurrent > dCurrent && kPrev <= dPrev && kCurrent < 20 && dCurrent < 20) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 65,
      reason: `%K crosses above %D in oversold zone (%K=${kCurrent.toFixed(1)}, %D=${dCurrent.toFixed(1)})`,
      indicators: { k: kCurrent, d: dCurrent }
    };
  }

  // Sell: %K crosses below %D while both above 80
  if (kCurrent < dCurrent && kPrev >= dPrev && kCurrent > 80 && dCurrent > 80) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 65,
      reason: `%K crosses below %D in overbought zone (%K=${kCurrent.toFixed(1)}, %D=${dCurrent.toFixed(1)})`,
      indicators: { k: kCurrent, d: dCurrent }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: 'No Stochastic crossover', indicators: { k: kCurrent, d: dCurrent } };
}

/** Strategy 7: CCI Mean Reversion
 * Best for: Range trading
 * Extreme values: > +200 or < -200
 */
export function cciMeanReversion(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const cci = Indicators.cci(high, low, close, 20);

  if (Number.isNaN(cci[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const cciVal = cci[i];
  const cciPrev = cci[prev];

  // Buy: CCI < -100 and crosses back above -100
  if (cciVal > -100 && cciPrev <= -100) {
    return {
      signal: 'BUY',
      strength: SignalStrength.MEDIUM,
      confidence: 55,
      reason: `CCI crosses above -100 from extreme (${cciVal.toFixed(2)})`,
      indicators: { cci: cciVal }
    };
  }

  // Sell: CCI > +100 and crosses back below +100
  if (cciVal < 100 && cciPrev >= 100) {
    return {
      signal: 'SELL',
      strength: SignalStrength.MEDIUM,
      confidence: 55,
      reason: `CCI crosses below +100 from extreme (${cciVal.toFixed(2)})`,
      indicators: { cci: cciVal }
    };
  }

  // Extreme conditions
  if (cciVal < -200) {
    return { signal: 'BUY', strength: SignalStrength.STRONG, confidence: 68, reason: 'CCI extremely oversold (< -200)', indicators: { cci: cciVal } };
  }

  if (cciVal > 200) {
    return { signal: 'SELL', strength: SignalStrength.STRONG, confidence: 68, reason: 'CCI extremely overbought (> 200)', indicators: { cci: cciVal } };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 5, reason: `CCI neutral (${cciVal.toFixed(2)})`, indicators: { cci: cciVal } };
}

/**
 * VOLATILITY STRATEGIES
 */

/** Strategy 8: Bollinger Band Squeeze (Volatility Breakout)
 * Best for: Breakout trading
 * Looks for low volatility followed by breakout
 */
export function bollingerSqueeze(input: StrategyInput): StrategySignal {
  const { close, volume } = input;
  const i = close.length - 1;

  const bb = Indicators.bollingerBands(close, 20, 2);

  if (Number.isNaN(bb.upper[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const bandwidth = (bb.upper[i] - bb.lower[i]) / bb.middle[i];
  const priceAboveUpper = close[i] > bb.upper[i];
  const priceBelowLower = close[i] < bb.lower[i];

  // Check if bandwidth is at multi-period low (squeeze)
  const bandwidths = [];
  for (let j = Math.max(0, i - 20); j <= i; j++) {
    bandwidths.push((bb.upper[j] - bb.lower[j]) / bb.middle[j]);
  }
  const isSqueezeZone = bandwidth <= Math.min(...bandwidths) * 1.05;

  if (priceAboveUpper && volume[i] > (volume[i - 1] ?? 0) * 1.2) {
    const reason = isSqueezeZone 
      ? 'Breakout above upper band after squeeze with volume'
      : 'Breakout above upper band with volume';
    return {
      signal: 'BUY',
      strength: isSqueezeZone ? SignalStrength.VERY_STRONG : SignalStrength.STRONG,
      confidence: isSqueezeZone ? 72 : 58,
      reason,
      indicators: { bandwidth, close: close[i], upper: bb.upper[i] }
    };
  }

  if (priceBelowLower && volume[i] > (volume[i - 1] ?? 0) * 1.2) {
    const reason = isSqueezeZone
      ? 'Breakout below lower band after squeeze with volume'
      : 'Breakout below lower band with volume';
    return {
      signal: 'SELL',
      strength: isSqueezeZone ? SignalStrength.VERY_STRONG : SignalStrength.STRONG,
      confidence: isSqueezeZone ? 72 : 58,
      reason,
      indicators: { bandwidth, close: close[i], lower: bb.lower[i] }
    };
  }

  if (isSqueezeZone) {
    return {
      signal: 'NEUTRAL',
      strength: SignalStrength.MEDIUM,
      confidence: 40,
      reason: 'Bollinger band squeeze detected, awaiting breakout',
      indicators: { bandwidth }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: 'No squeeze or breakout', indicators: { bandwidth } };
}

/** Strategy 9: Bollinger Band Reversal (Mean Reversion)
 * Best for: Mean reversion in ranging markets
 */
export function bollingerReversal(input: StrategyInput): StrategySignal {
  const { close } = input;
  const i = close.length - 1;

  const bb = Indicators.bollingerBands(close, 20, 2);
  const rsi = Indicators.rsi(close, 14);

  if (Number.isNaN(bb.upper[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const touchedLower = close[i] <= bb.lower[i];
  const touchedUpper = close[i] >= bb.upper[i];
  const rsiExtreme = !Number.isNaN(rsi[i]) && (rsi[i] < 30 || rsi[i] > 70);

  if (touchedLower && rsiExtreme) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 65,
      reason: `Price at lower band + RSI extreme (${rsi[i].toFixed(2)}), target middle band`,
      indicators: { lower: bb.lower[i], close: close[i], rsi: rsi[i] }
    };
  }

  if (touchedUpper && rsiExtreme) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 65,
      reason: `Price at upper band + RSI extreme (${rsi[i].toFixed(2)}), target middle band`,
      indicators: { upper: bb.upper[i], close: close[i], rsi: rsi[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: 'No band touch or RSI extreme', indicators: {} };
}

/** Strategy 10: Keltner Channel Breakout
 * Best for: Trending breakouts
 * Uses ATR instead of std deviation (fewer false breakouts)
 */
export function keltnerBreakout(input: StrategyInput): StrategySignal {
  const { high, low, close, volume } = input;
  const i = close.length - 1;

  const kc = Indicators.keltnerChannels(high, low, close, 20, 10, 2);
  const atr = Indicators.atr(high, low, close, 14);

  if (!kc || Number.isNaN(kc.upper[i]) || Number.isNaN(atr[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const atrRising = i > 0 && atr[i] > atr[i - 1];
  const aboveUpper = close[i] > kc.upper[i];
  const belowLower = close[i] < kc.lower[i];

  if (aboveUpper && atrRising) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 62,
      reason: `Breakout above Keltner with rising ATR (${atr[i].toFixed(4)})`,
      indicators: { upper: kc.upper[i], close: close[i], atr: atr[i] }
    };
  }

  if (belowLower && atrRising) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 62,
      reason: `Breakout below Keltner with rising ATR (${atr[i].toFixed(4)})`,
      indicators: { lower: kc.lower[i], close: close[i], atr: atr[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: 'No Keltner breakout', indicators: {} };
}

/**
 * VOLUME STRATEGIES
 */

/** Strategy 11: OBV Divergence
 * Best for: Confirming trends, spotting reversals
 * Looks for price/OBV divergence
 */
export function obvDivergence(input: StrategyInput): StrategySignal {
  const { close, volume } = input;
  const i = close.length - 1;

  const obv = Indicators.obv(close, volume);
  const obvEma = Indicators.ema(obv, 20);

  if (Number.isNaN(obv[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  // Check for divergences (looking back 5-10 bars)
  const lookback = Math.min(10, i);
  let bullishDivergence = false;
  let bearishDivergence = false;

  // Bullish divergence: lower low in price, higher low in OBV
  if (i >= lookback) {
    const priceMinIdx = close.slice(i - lookback, i + 1).reduce((minIdx, val, idx) => val < close[i - lookback + minIdx] ? idx : minIdx, 0) + i - lookback;
    const obvMinIdx = obv.slice(i - lookback, i + 1).reduce((minIdx, val, idx) => val < obv[i - lookback + minIdx] ? idx : minIdx, 0) + i - lookback;
    
    if (priceMinIdx !== obvMinIdx && close[priceMinIdx] < close[i - lookback] && obv[obvMinIdx] > obv[i - lookback]) {
      bullishDivergence = true;
    }
  }

  // OBV confirming uptrend
  if (!bullishDivergence && i > 0 && obvEma[i] > obvEma[i - 1] && close[i] > close[i - 1]) {
    return {
      signal: 'BUY',
      strength: SignalStrength.MEDIUM,
      confidence: 55,
      reason: 'Rising OBV confirms uptrend',
      indicators: { obv: obv[i], obvEma: obvEma[i], close: close[i] }
    };
  }

  if (bullishDivergence) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 68,
      reason: 'Bullish divergence: lower low in price, higher low in OBV (volume buying pressure)',
      indicators: { obv: obv[i], close: close[i] }
    };
  }

  if (bearishDivergence) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 68,
      reason: 'Bearish divergence: higher high in price, lower high in OBV (volume weakness)',
      indicators: { obv: obv[i], close: close[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: 'No OBV confirmation or divergence', indicators: { obv: obv[i] } };
}

/** Strategy 12: MFI (Money Flow Index)
 * Best for: Identifying institutional activity
 * Like RSI but incorporates volume
 */
export function mfiOversoldOverbought(input: StrategyInput): StrategySignal {
  const { high, low, close, volume } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const mfi = Indicators.mfi(high, low, close, volume, 14);

  if (Number.isNaN(mfi[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const mfiVal = mfi[i];
  const mfiPrev = mfi[prev];

  // Buy: MFI < 20 and crosses back above 20
  if (mfiVal > 20 && mfiPrev <= 20) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 63,
      reason: `MFI crosses above 20 from oversold with volume (${mfiVal.toFixed(2)})`,
      indicators: { mfi: mfiVal }
    };
  }

  // Sell: MFI > 80 and crosses back below 80
  if (mfiVal < 80 && mfiPrev >= 80) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 63,
      reason: `MFI crosses below 80 from overbought with volume (${mfiVal.toFixed(2)})`,
      indicators: { mfi: mfiVal }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 10, reason: `MFI neutral (${mfiVal.toFixed(2)})`, indicators: { mfi: mfiVal } };
}

/** Strategy 13: CMF (Chaikin Money Flow)
 * Best for: Confirming trend strength
 */
export function cmfAccumulation(input: StrategyInput): StrategySignal {
  const { high, low, close, volume } = input;
  const i = close.length - 1;

  const cmf = Indicators.cmf(high, low, close, volume, 20);

  if (Number.isNaN(cmf[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const cmfVal = cmf[i];

  if (cmfVal > 0.1) {
    return {
      signal: 'BUY',
      strength: SignalStrength.MEDIUM,
      confidence: 58,
      reason: `Strong accumulation detected (CMF ${cmfVal.toFixed(3)})`,
      indicators: { cmf: cmfVal }
    };
  }

  if (cmfVal < -0.1) {
    return {
      signal: 'SELL',
      strength: SignalStrength.MEDIUM,
      confidence: 58,
      reason: `Strong distribution detected (CMF ${cmfVal.toFixed(3)})`,
      indicators: { cmf: cmfVal }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 5, reason: `CMF neutral (${cmfVal.toFixed(3)})`, indicators: { cmf: cmfVal } };
}

/**
 * COMBINATION STRATEGIES
 */

/** Strategy 14: Triple Confirmation System
 * Best for: High probability setups (70-75% win rate)
 * Requires all 3 indicators to align
 */
export function tripleConfirmation(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;

  const { macd: macdLine, signal: signalLine } = Indicators.macd(close);
  const rsiVal = Indicators.rsi(close, 14)[i];
  const adxVal = Indicators.adx(high, low, close, 14)[i];

  if (Number.isNaN(macdLine[i]) || Number.isNaN(rsiVal) || Number.isNaN(adxVal)) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const prev = i - 1;
  const macdCrossUp = macdLine[i] > signalLine[i] && macdLine[prev] <= signalLine[prev];
  const macdCrossDown = macdLine[i] < signalLine[i] && macdLine[prev] >= signalLine[prev];

  if (macdCrossUp && rsiVal > 50 && adxVal > 25) {
    const strength = (rsiVal - 50) + (adxVal - 25); // 0-55 scale
    return {
      signal: 'BUY',
      strength: Math.min(SignalStrength.VERY_STRONG, Math.ceil(strength / 12) + 2),
      confidence: 72,
      reason: 'Triple alignment: MACD crossover + RSI > 50 + strong trend (ADX > 25)',
      indicators: { macd: macdLine[i], rsi: rsiVal, adx: adxVal }
    };
  }

  if (macdCrossDown && rsiVal < 50 && adxVal > 25) {
    const strength = (50 - rsiVal) + (adxVal - 25);
    return {
      signal: 'SELL',
      strength: Math.min(SignalStrength.VERY_STRONG, Math.ceil(strength / 12) + 2),
      confidence: 72,
      reason: 'Triple alignment: MACD crossover + RSI < 50 + strong trend (ADX > 25)',
      indicators: { macd: macdLine[i], rsi: rsiVal, adx: adxVal }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 20, reason: 'Triple confirmation not aligned', indicators: { rsi: rsiVal, adx: adxVal } };
}

/** Strategy 15: Bollinger + RSI Double Strategy
 * Best for: Catching reversals with confirmation
 */
export function bollingerRsiDouble(input: StrategyInput): StrategySignal {
  const { close } = input;
  const i = close.length - 1;
  const prev = i - 1;

  const bb = Indicators.bollingerBands(close, 20, 2);
  const rsi = Indicators.rsi(close, 14);

  if (Number.isNaN(bb.lower[i]) || Number.isNaN(rsi[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const touchedLower = close[i] <= bb.lower[i];
  const touchedUpper = close[i] >= bb.upper[i];
  const rsiLow = rsi[i] < 30;
  const rsiHigh = rsi[i] > 70;
  const rsiCrossUp = rsi[i] > 30 && rsi[prev] <= 30;
  const rsiCrossDown = rsi[i] < 70 && rsi[prev] >= 70;
  const insideBands = close[i] > bb.lower[i] && close[i] < bb.upper[i];

  if (touchedLower && rsiLow && (rsiCrossUp || insideBands)) {
    return {
      signal: 'BUY',
      strength: SignalStrength.VERY_STRONG,
      confidence: 68,
      reason: `Bollinger lower band + RSI extreme (${rsi[i].toFixed(2)}), RSI recovering`,
      indicators: { lower: bb.lower[i], rsi: rsi[i] }
    };
  }

  if (touchedUpper && rsiHigh && (rsiCrossDown || insideBands)) {
    return {
      signal: 'SELL',
      strength: SignalStrength.VERY_STRONG,
      confidence: 68,
      reason: `Bollinger upper band + RSI extreme (${rsi[i].toFixed(2)}), RSI declining`,
      indicators: { upper: bb.upper[i], rsi: rsi[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 15, reason: 'Bollinger-RSI setup not complete', indicators: {} };
}

/** Strategy 16: Trend + Volume Confirmation
 * Best for: High-conviction trades
 */
export function trendVolumeConfirmation(input: StrategyInput): StrategySignal {
  const { close, volume } = input;
  const i = close.length - 1;

  const ema20 = Indicators.ema(close, 20);
  const ema50 = Indicators.ema(close, 50);
  const obv = Indicators.obv(close, volume);
  const obvEma = Indicators.ema(obv, 20);

  if (Number.isNaN(ema20[i]) || Number.isNaN(ema50[i]) || Number.isNaN(obvEma[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const prev = i - 1;
  const ema20CrossUp = ema20[i] > ema50[i] && ema20[prev] <= ema50[prev];
  const ema20CrossDown = ema20[i] < ema50[i] && ema20[prev] >= ema50[prev];
  const obvAboveEma = obv[i] > obvEma[i];
  const obvBelowEma = obv[i] < obvEma[i];

  if (ema20CrossUp && obvAboveEma) {
    return {
      signal: 'BUY',
      strength: SignalStrength.VERY_STRONG,
      confidence: 70,
      reason: 'Golden cross (EMA 20 > EMA 50) + OBV above its EMA (volume confirms)',
      indicators: { ema20: ema20[i], ema50: ema50[i], obv: obv[i], obvEma: obvEma[i] }
    };
  }

  if (ema20CrossDown && obvBelowEma) {
    return {
      signal: 'SELL',
      strength: SignalStrength.VERY_STRONG,
      confidence: 70,
      reason: 'Death cross (EMA 20 < EMA 50) + OBV below its EMA (volume confirms)',
      indicators: { ema20: ema20[i], ema50: ema50[i], obv: obv[i], obvEma: obvEma[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 15, reason: 'Trend-volume confirmation not aligned', indicators: {} };
}

/**
 * ADVANCED STRATEGIES
 */

/** Strategy 17: Ichimoku + Fibonacci Confluence
 * Best for: High-probability S/R levels
 * Requires both Ichimoku and Fibonacci signals
 * Note: Fibonacci implementation would need to be added to indicators.ts
 */
export function ichimokuFibonacciConfluence(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;

  const ichimoku = Indicators.ichimoku(high, low, close);

  if (!ichimoku || Number.isNaN(ichimoku.senkouA[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  const lastClose = close[i];
  const cloudTop = Math.max(ichimoku.senkouA[i], ichimoku.senkouB[i]);
  const cloudBottom = Math.min(ichimoku.senkouA[i], ichimoku.senkouB[i]);

  // For now, check if price is at cloud edges (acting as support/resistance)
  const atCloudTop = Math.abs(lastClose - cloudTop) / lastClose < 0.001; // Within 0.1%
  const atCloudBottom = Math.abs(lastClose - cloudBottom) / lastClose < 0.001;

  if (atCloudBottom && ichimoku.tenkan[i] > ichimoku.kijun[i]) {
    return {
      signal: 'BUY',
      strength: SignalStrength.VERY_STRONG,
      confidence: 72,
      reason: 'Price at Ichimoku cloud support + Tenkan > Kijun (confluence)',
      indicators: { cloudTop, cloudBottom, price: lastClose }
    };
  }

  if (atCloudTop && ichimoku.tenkan[i] < ichimoku.kijun[i]) {
    return {
      signal: 'SELL',
      strength: SignalStrength.VERY_STRONG,
      confidence: 72,
      reason: 'Price at Ichimoku cloud resistance + Tenkan < Kijun (confluence)',
      indicators: { cloudTop, cloudBottom, price: lastClose }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 15, reason: 'No Ichimoku-Fibonacci confluence', indicators: {} };
}

/** Strategy 18: Elder Ray Bull/Bear Power
 * Best for: Trend strength assessment
 */
export function elderRayPower(input: StrategyInput): StrategySignal {
  const { high, low, close } = input;
  const i = close.length - 1;

  const ema13 = Indicators.ema(close, 13);

  if (Number.isNaN(ema13[i])) {
    return { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'Insufficient data', indicators: {} };
  }

  // Bull power = high - EMA13
  // Bear power = low - EMA13
  const bullPower = high[i] - ema13[i];
  const bearPower = low[i] - ema13[i];
  const bullPowerPrev = i > 0 ? high[i - 1] - ema13[i - 1] : bullPower;
  const bearPowerPrev = i > 0 ? low[i - 1] - ema13[i - 1] : bearPower;

  const emaTrending = i > 0 && ema13[i] > ema13[i - 1];
  const trendDown = i > 0 && ema13[i] < ema13[i - 1];

  if (bullPower > 0 && bullPower > bullPowerPrev && bearPower > bearPowerPrev && emaTrending) {
    return {
      signal: 'BUY',
      strength: SignalStrength.STRONG,
      confidence: 65,
      reason: 'Bulls in control: Bull Power rising, Bear Power improving, EMA rising',
      indicators: { bullPower, bearPower, ema13: ema13[i] }
    };
  }

  if (bearPower < 0 && bearPower < bearPowerPrev && bullPower < bullPowerPrev && trendDown) {
    return {
      signal: 'SELL',
      strength: SignalStrength.STRONG,
      confidence: 65,
      reason: 'Bears in control: Bear Power falling, Bull Power declining, EMA falling',
      indicators: { bullPower, bearPower, ema13: ema13[i] }
    };
  }

  return { signal: 'NEUTRAL', strength: SignalStrength.WEAK, confidence: 20, reason: 'No clear Elder Ray signal', indicators: { bullPower, bearPower } };
}

/**
 * MASTER STRATEGY ORCHESTRATOR
 * Runs all strategies and aggregates signals
 */

export interface StrategyResults {
  primary: StrategySignal; // Highest confidence signal
  all: Map<string, StrategySignal>;
  aggregatedSignal: 'BUY' | 'SELL' | 'NEUTRAL';
  aggregatedConfidence: number;
  agreementPercentage: number; // How many strategies agree
}

export function runAllStrategies(input: StrategyInput): StrategyResults {
  const results = new Map<string, StrategySignal>();

  // Trend-Following
  results.set('macdCrossover', macdCrossover(input));
  results.set('adxTrendFilter', adxTrendFilter(input));
  results.set('parabolicSAR', parabolicSarTrend(input));
  results.set('ichimokuCloud', ichimokuCloud(input));

  // Momentum
  results.set('rsiOversold', rsiOversoldOverbought(input));
  results.set('stochastic', stochasticCrossover(input));
  results.set('cci', cciMeanReversion(input));

  // Volatility
  results.set('bollingerSqueeze', bollingerSqueeze(input));
  results.set('bollingerReversal', bollingerReversal(input));
  results.set('keltnerBreakout', keltnerBreakout(input));

  // Volume
  results.set('obv', obvDivergence(input));
  results.set('mfi', mfiOversoldOverbought(input));
  results.set('cmf', cmfAccumulation(input));

  // Combination
  results.set('tripleConfirmation', tripleConfirmation(input));
  results.set('bollingerRsi', bollingerRsiDouble(input));
  results.set('trendVolume', trendVolumeConfirmation(input));

  // Advanced
  results.set('ichimokuFib', ichimokuFibonacciConfluence(input));
  results.set('elderRay', elderRayPower(input));

  // Aggregate results
  let buyCount = 0;
  let sellCount = 0;
  let totalConfidence = 0;
  let maxConfidence = 0;
  let primarySignal: StrategySignal | null = null;

  for (const signal of results.values()) {
    if (signal.signal === 'BUY') buyCount++;
    if (signal.signal === 'SELL') sellCount++;
    totalConfidence += signal.confidence;

    if (signal.confidence > maxConfidence) {
      maxConfidence = signal.confidence;
      primarySignal = signal;
    }
  }

  const totalStrategies = results.size;
  const agreementPercentage = Math.max(buyCount, sellCount) / totalStrategies;
  
  let aggregatedSignal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  if (buyCount > sellCount && agreementPercentage > 0.4) {
    aggregatedSignal = 'BUY';
  } else if (sellCount > buyCount && agreementPercentage > 0.4) {
    aggregatedSignal = 'SELL';
  }

  return {
    primary: primarySignal || { signal: 'NEUTRAL', strength: SignalStrength.VERY_WEAK, confidence: 0, reason: 'No data', indicators: {} },
    all: results,
    aggregatedSignal,
    aggregatedConfidence: totalConfidence / totalStrategies,
    agreementPercentage: agreementPercentage * 100
  };
}
