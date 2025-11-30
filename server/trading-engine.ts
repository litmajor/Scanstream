// Smart symbol mapper - learns which formats work per exchange
import symbolMapper from './services/symbol-mapper';

// Normalize a symbol for the given exchange, so only valid symbols are used
function normalizeSymbol(symbol: string, exchange: ccxt.Exchange): string {
  const exchangeName = exchange.id || 'unknown';

  // Check if exchange and symbols are available
  if (!exchange || !exchange.markets || Object.keys(exchange.markets).length === 0) {
    console.warn('[normalizeSymbol] Exchange markets not loaded, returning symbol as-is:', symbol);
    return symbol;
  }

  const symbols = Object.keys(exchange.markets);

  // 1. Check cache first - if we've already mapped this, use cached result
  const cachedMapping = symbolMapper.getCachedMapping(symbol, exchangeName);
  if (cachedMapping) {
    console.log(`[normalizeSymbol] Using cached mapping: ${symbol} -> ${cachedMapping} (${exchangeName})`);
    return cachedMapping;
  }

  // 2. If previously failed on this exchange, don't retry
  if (symbolMapper.hasFailedBefore(symbol, exchangeName)) {
    console.log(`[normalizeSymbol] Skipping ${symbol} on ${exchangeName} - previously failed`);
    return symbol; // Return as-is
  }

  // If symbol is already valid, cache and return it
  if (symbols.includes(symbol)) {
    symbolMapper.cacheSuccessfulMapping(symbol, exchangeName, symbol);
    return symbol;
  }

  // Try futures mapping (e.g. BTC/USDT -> BTCUSDT:USDT or BTC/USDT:USDT)
  const futuresVariants = [
    symbol.replace("/", "") + ":USDT",
    symbol + ":USDT",
    symbol.replace("/USDT", "USDT:USDT")
  ];
  
  for (const variant of futuresVariants) {
    if (symbols.includes(variant)) {
      symbolMapper.cacheSuccessfulMapping(symbol, exchangeName, variant);
      console.log(`[normalizeSymbol] Mapped ${symbol} -> ${variant} (${exchangeName})`);
      return variant;
    }
  }

  // Try spot mapping (e.g. BTCUSDT -> BTC/USDT)
  const spot = symbol.includes("/") ? symbol : symbol.replace("USDT", "/USDT");
  if (symbols.includes(spot)) {
    symbolMapper.cacheSuccessfulMapping(symbol, exchangeName, spot);
    console.log(`[normalizeSymbol] Mapped ${symbol} -> ${spot} (${exchangeName})`);
    return spot;
  }

  // Mark this symbol/exchange combo as failed - don't retry again
  symbolMapper.markAsFailed(symbol, exchangeName);
  console.warn(`[normalizeSymbol] No valid market symbol found for ${symbol} on ${exchangeName}, won't retry`);
  return symbol; // Return as-is
}
// Helper to guarantee a string (never null/undefined)
function safeString(val: any): string {
  return typeof val === 'string' ? val : '';
}
import * as ccxt from 'ccxt';
// yfinance fallback adapter for forex (fetchTicker, fetchOHLCV)
let yfinance: any = null;
try {
  yfinance = require('yahoo-finance2').default;
} catch (e) {
  // yfinance not installed, fallback will throw if used
}

// Adapter to mimic ccxt Exchange for yfinance
class YFinanceForexAdapter {
  async fetchTicker(symbol: string) {
    if (!yfinance) throw new Error('yahoo-finance2 not installed');
    // Convert symbol to yfinance format (e.g., EURUSD -> EURUSD=X)
    const yfSymbol = symbol.replace('/', '') + '=X';
    const data = await yfinance.quote(yfSymbol);
    return {
      symbol,
      bid: data.bid ?? 0,
      ask: data.ask ?? 0,
      last: data.regularMarketPrice ?? data.ask ?? data.bid ?? 0,
      bidVolume: 0,
      askVolume: 0,
      ...data
    };
  }
  async fetchOHLCV(symbol: string, timeframe = '1d', since?: number, limit = 100) {
    if (!yfinance) throw new Error('yahoo-finance2 not installed');
    const yfSymbol = symbol.replace('/', '') + '=X';
    const interval = timeframe === '1m' ? '1m' : timeframe === '1h' ? '1h' : '1d';
    const query = { period1: since ? new Date(since) : undefined, interval };
    const candles = await yfinance._chart(yfSymbol, { period: '1mo', interval });
    // Map to [timestamp, open, high, low, close, volume]
    return (candles.quotes || []).map((c: any) => [
      c.date ? new Date(c.date).getTime() : 0,
      c.open,
      c.high,
      c.low,
      c.close,
      c.volume ?? 0
    ]).slice(-limit);
  }
  get symbols() {
    // yfinance supports all major forex pairs, but we can't enumerate
    return [];
  }
}
import { storage } from './storage'; // Note: Ensure storage module is implemented
import { SignalClassifier } from './signal-classifier'; // Note: Ensure SignalClassifier module is implemented

/**
 * Shared types and interfaces for the trading system.
 */

/** Market frame data structure */
export interface MarketFrame {
  id?: string;
  timestamp: Date | string;
  symbol: string;
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  volume: number;
  indicators: {
    rsi: number;
  macd: { macd: number; signal: number; histogram: number };
    bb: { upper: number; middle: number; lower: number };
    ema20: number;
    ema50: number;
    ema200: number;
    multiEMA: Record<number, number>;
    stoch_k: number;
    stoch_d: number;
    adx: number;
    vwap: number;
    atr: number;
    momentumShort?: number;
    momentumLong?: number;
    bbPos?: number;
    volumeRatio?: number;
    mom7d?: number;
    mom30d?: number;
    ichimoku_bullish?: boolean;
  };
  orderFlow: {
    bidVolume: number;
    askVolume: number;
    netFlow: number;
    largeOrders: number;
    smallOrders: number;
  };
  marketMicrostructure: {
    spread: number;
    depth: number;
    imbalance: number;
    toxicity: number;
  };
}

/** Signal data structure for insertion */
interface InsertSignal {
  symbol: string;
  type: 'BUY' | 'SELL';
  strength: number;
  confidence: number;
  price: number;
  reasoning: string[];
  riskReward: number;
  stopLoss: number;
  takeProfit: number;
}

/** Signal data with additional fields */
interface Signal extends InsertSignal {
  momentumLabel: string;
  regimeState: string;
  legacyLabel: string;
  signalStrengthScore: number;
}

/** Trading configuration */
interface TradingConfig {
  timeframes: Record<string, string>;
  backtest_periods: Record<string, number>;
  momentum_periods: Record<string, Record<string, Record<string, number>>>;
  signal_thresholds: Record<string, Record<string, Record<string, number>>>;
  trade_durations: Record<string, number>;
  rsi_period: number;
  macd_params: { fast: number; slow: number; signal: number };
  volume_trend_thresholds: { up: number; down: number };
  retry_attempts: number;
  retry_delay: number;
  rate_limit_delay: number;
  max_concurrent_requests: number;
  circuit_breaker_threshold: number;
  circuit_breaker_pause: number;
  websocket_update_interval: number;
  volume_profile_bins: number;
  fixed_range_bars: number;
}

/**
 * Class for calculating technical indicators used in trading analysis.
 */
class TechnicalIndicators {
  /**
   * Calculate Stochastic Oscillator (K, D).
   * @param prices Array of closing prices
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param kPeriod Period for %K calculation
   * @param dPeriod Period for %D (SMA of %K)
   * @returns Object containing %K and %D values
   */
  static calculateStochastic(
    prices: number[],
    highs: number[],
    lows: number[],
    kPeriod = 14,
    dPeriod = 3
  ): { k: number; d: number } {
    if (prices.length < kPeriod || highs.length < kPeriod || lows.length < kPeriod) {
      return { k: 50, d: 50 };
    }
    const recentCloses = prices.slice(-kPeriod);
    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    const k = ((recentCloses[recentCloses.length - 1] - lowestLow) / (highestHigh - lowestLow)) * 100;
    const kValues: number[] = [];
    for (let i = prices.length - kPeriod; i < prices.length; i++) {
      const h = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
      const l = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
      const kVal = ((prices[i] - l) / (h - l)) * 100;
      kValues.push(kVal);
    }
    const d = kValues.slice(-dPeriod).reduce((a, b) => a + b, 0) / dPeriod;
    return { k, d };
  }

  /**
   * Calculate Average Directional Index (ADX).
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @param period Lookback period
   * @returns ADX value
   */
  static calculateADX(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
      return 20;
    }
    let tr: number[] = [];
    let plusDM: number[] = [];
    let minusDM: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      tr.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    const smooth = (arr: number[], period: number) => {
      let res: number[] = [arr.slice(0, period).reduce((a, b) => a + b, 0)];
      for (let i = period; i < arr.length; i++) {
        res.push(res[res.length - 1] - res[res.length - 1] / period + arr[i]);
      }
      return res;
    };
    const tr14 = smooth(tr, period);
    const plusDM14 = smooth(plusDM, period);
    const minusDM14 = smooth(minusDM, period);
    const plusDI = plusDM14.map((dm, i) => 100 * (dm / (tr14[i] || 1)));
    const minusDI = minusDM14.map((dm, i) => 100 * (dm / (tr14[i] || 1)));
    const dx = plusDI.map((pdi, i) => 100 * Math.abs(pdi - minusDI[i]) / ((pdi + minusDI[i]) || 1));
    const adx = dx.slice(-period).reduce((a, b) => a + b, 0) / period;
    return adx;
  }

  /**
   * Calculate multiple Exponential Moving Averages (EMAs).
   * @param prices Array of prices
   * @param periods Array of EMA periods
   * @returns Object with period as key and EMA value as value
   */
  static calculateMultiEMA(prices: number[], periods: number[]): Record<number, number> {
    const result: Record<number, number> = {};
    for (const p of periods) {
      const emaArr = this.calculateEMA(prices, p);
      result[p] = emaArr[emaArr.length - 1] || prices[prices.length - 1] || 0;
    }
    return result;
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP).
   * @param prices Array of prices
   * @param volumes Array of volumes
   * @returns VWAP value
   */
  static calculateVWAP(prices: number[], volumes: number[]): number {
    if (!prices.length || !volumes.length || prices.length !== volumes.length) {
      return 0;
    }
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    for (let i = 0; i < prices.length; i++) {
      cumulativePV += prices[i] * volumes[i];
      cumulativeVolume += volumes[i];
    }
    return cumulativeVolume === 0 ? 0 : cumulativePV / cumulativeVolume;
  }

  /**
   * Detect EMA crossover (bullish or bearish).
   * @param prices Array of prices
   * @param shortPeriod Short EMA period
   * @param longPeriod Long EMA period
   * @returns 'bullish', 'bearish', or null
   */
  static detectEMACrossover(prices: number[], shortPeriod = 20, longPeriod = 50): 'bullish' | 'bearish' | null {
    const emaShort = this.calculateEMA(prices, shortPeriod);
    const emaLong = this.calculateEMA(prices, longPeriod);
    if (emaShort.length < 2 || emaLong.length < 2) return null;
    const prevCross = emaShort[emaShort.length - 2] - emaLong[emaLong.length - 2];
    const currCross = emaShort[emaShort.length - 1] - emaLong[emaLong.length - 1];
    if (prevCross < 0 && currCross > 0) return 'bullish';
    if (prevCross > 0 && currCross < 0) return 'bearish';
    return null;
  }

  /**
   * Detect RSI divergence (bullish or bearish).
   * @param prices Array of prices
   * @param rsiPeriod RSI period
   * @returns 'bullish', 'bearish', or null
   */
  static detectRSIDivergence(prices: number[], rsiPeriod = 14): 'bullish' | 'bearish' | null {
    if (prices.length < rsiPeriod * 2) return null;
    const rsi = prices.map((_, i) =>
      i >= rsiPeriod ? this.calculateRSI(prices.slice(i - rsiPeriod, i + 1), rsiPeriod) : 50
    );
    const len = prices.length;
    const priceLow1 = Math.min(...prices.slice(len - rsiPeriod * 2, len - rsiPeriod));
    const priceLow2 = Math.min(...prices.slice(len - rsiPeriod, len));
    const rsiLow1 = Math.min(...rsi.slice(len - rsiPeriod * 2, len - rsiPeriod));
    const rsiLow2 = Math.min(...rsi.slice(len - rsiPeriod, len));
    if (priceLow2 > priceLow1 && rsiLow2 < rsiLow1) return 'bullish';
    const priceHigh1 = Math.max(...prices.slice(len - rsiPeriod * 2, len - rsiPeriod));
    const priceHigh2 = Math.max(...prices.slice(len - rsiPeriod, len));
    const rsiHigh1 = Math.max(...rsi.slice(len - rsiPeriod * 2, len - rsiPeriod));
    const rsiHigh2 = Math.max(...rsi.slice(len - rsiPeriod, len));
    if (priceHigh2 < priceHigh1 && rsiHigh2 > rsiHigh1) return 'bearish';
    return null;
  }

  /**
   * Detect MACD bullish crossover.
   * @param prices Array of prices
   * @param fast Fast EMA period
   * @param slow Slow EMA period
   * @param signal Signal line period
   * @returns True if bullish crossover detected
   */
  static detectMACDBullishCross(prices: number[], fast = 12, slow = 26, signal = 9): boolean {
    const macd = this.calculateMACD(prices, fast, slow, signal);
    if (!macd) return false;
    const macdLine = this.calculateEMA(prices, fast).map((v, i) => v - (this.calculateEMA(prices, slow)[i] || 0));
    const signalLine = this.calculateEMA(macdLine, signal);
    if (macdLine.length < 2 || signalLine.length < 2) return false;
    const prev = macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2];
    const curr = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
    return prev < 0 && curr > 0;
  }

  /**
   * Detect volume acceleration.
   * @param volumes Array of volumes
   * @param lookback Lookback period
   * @param threshold Volume threshold multiplier
   * @returns True if volume acceleration detected
   */
  static detectVolumeAcceleration(volumes: number[], lookback = 20, threshold = 1.5): boolean {
    if (volumes.length < lookback + 1) return false;
    const recent = volumes[volumes.length - 1];
    const avg = volumes.slice(-lookback - 1, -1).reduce((a, b) => a + b, 0) / lookback;
    return recent > avg * threshold;
  }

  /**
   * Detect trend reversal by price crossing EMA200.
   * @param prices Array of prices
   * @param period EMA period
   * @returns 'bullish', 'bearish', or null
   */
  static detectTrendReversal(prices: number[], period = 200): 'bullish' | 'bearish' | null {
    if (prices.length < period + 2) return null;
    const ema = this.calculateEMA(prices, period);
    const prev = prices[prices.length - 2] - ema[ema.length - 2];
    const curr = prices[prices.length - 1] - ema[ema.length - 1];
    if (prev < 0 && curr > 0) return 'bullish';
    if (prev > 0 && curr < 0) return 'bearish';
    return null;
  }

  /**
   * Overlay higher timeframe trend on lower timeframe data.
   * @param lowerFrames Lower timeframe market frames
   * @param higherFrames Higher timeframe market frames
   * @param higherTimeframe Timeframe identifier
   * @returns Lower frames with added trend data
   */
  static overlayHigherTimeframeTrend(lowerFrames: MarketFrame[], higherFrames: MarketFrame[], higherTimeframe: string = '4h') {
    return lowerFrames.map(lf => {
      const ht = [...higherFrames].reverse().find(hf => new Date(hf.timestamp) <= new Date(lf.timestamp));
      return { ...lf, [`trend_${higherTimeframe}`]: ht ? ht.indicators : undefined };
    });
  }

  /**
   * Adjust thresholds based on sentiment and volatility.
   * @param base Base threshold
   * @param sentiment Sentiment score (-1 to 1)
   * @param volatility Volatility score (0 to 1)
   * @returns Adjusted threshold
   */
  static adjustThresholds(base: number, sentiment: number, volatility: number): number {
    let adjusted = base;
    adjusted *= 1 + 0.5 * sentiment;
    adjusted *= 1 - 0.3 * Math.min(volatility, 1);
    return Math.max(0, adjusted);
  }

  /**
   * Calculate Relative Strength Index (RSI).
   * @param prices Array of prices
   * @param period RSI period
   * @returns RSI value
   */
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate Moving Average Convergence Divergence (MACD).
   * @param prices Array of prices
   * @param fastPeriod Fast EMA period
   * @param slowPeriod Slow EMA period
   * @param signalPeriod Signal line period
   * @returns MACD object with line, signal, and histogram
   */
  static calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    const emaFast = this.calculateEMA(prices, fastPeriod);
    const emaSlow = this.calculateEMA(prices, slowPeriod);
    const macdLine = emaFast.map((fast, i) => fast - emaSlow[i]);
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
    return {
      macd: macdLine[macdLine.length - 1] || 0,
      signal: signalLine[signalLine.length - 1] || 0,
      histogram: histogram[histogram.length - 1] || 0
    };
  }

  /**
   * Calculate Exponential Moving Average (EMA).
   * @param prices Array of prices
   * @param period EMA period
   * @returns Array of EMA values
   */
  static calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    if (prices.length === 0) return [];
    ema[0] = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    return ema;
  }

  /**
   * Calculate Bollinger Bands.
   * @param prices Array of prices
   * @param period SMA period
   * @param stdDev Standard deviation multiplier
   * @returns Bollinger Bands object with upper, middle, and lower bands
   */
  static calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    if (prices.length < period) {
      const price = prices[prices.length - 1] || 0;
      return { upper: price * 1.02, middle: price, lower: price * 0.98 };
    }
    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper: sma + (std * stdDev),
      middle: sma,
      lower: sma - (std * stdDev)
    };
  }

  /**
   * Calculate Average True Range (ATR).
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @param period ATR period
   * @returns ATR value
   */
  static calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < 2) return 0;
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
  }

  /**
   * Calculate Fibonacci retracement and extension levels.
   * @param prices Array of prices
   * @param lookback Lookback period
   * @returns Fibonacci levels object
   */
  static fibLevels(prices: number[], lookback: number = 55) {
    if (prices.length < lookback) return {};
    const recentPrices = prices.slice(-lookback);
    const high = Math.max(...recentPrices);
    const low = Math.min(...recentPrices);
    const diff = high - low;
    const direction = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'bull' : 'bear';
    return {
      direction,
      swing_high: high,
      swing_low: low,
      retracements: {
        0.0: high,
        0.236: high - 0.236 * diff,
        0.382: high - 0.382 * diff,
        0.5: high - 0.5 * diff,
        0.618: high - 0.618 * diff,
        0.786: high - 0.786 * diff,
        1.0: low
      },
      extensions: {
        1.272: direction === 'bull' ? high + 0.272 * diff : low - 0.272 * diff,
        1.618: direction === 'bull' ? high + 0.618 * diff : low - 0.618 * diff,
        2.0: direction === 'bull' ? high + 1.0 * diff : low - 1.0 * diff
      }
    };
  }
}

/**
 * Class for generating trading signals based on technical, order flow, and microstructure analysis.
 */
class SignalEngine {
  private config: TradingConfig;

  constructor(config: TradingConfig) {
    this.config = config;
  }

  /**
   * Calculate technical score based on indicators.
   * @param frames Array of market frames
   * @param currentIndex Index of current frame
   * @returns Technical score (-1 to 1)
   */
  calculateTechnicalScore(frames: MarketFrame[], currentIndex: number): number {
    if (currentIndex < 20) return 0;
    const frame = frames[currentIndex];
    const prices = frames
      .slice(Math.max(0, currentIndex - 50), currentIndex + 1)
      .map(f => f.price.close);
    const { rsi, macd, bb, ema20, ema50 } = frame.indicators;
    let score = 0;
    // RSI momentum
    if (rsi < 30) score += 0.3;
    else if (rsi > 70) score -= 0.3;
    else score += (50 - Math.abs(rsi - 50)) / 100;
    // MACD trend
  if (macd.macd > macd.signal && macd.histogram > 0) score += 0.25;
  else if (macd.macd < macd.signal && macd.histogram < 0) score -= 0.25;
    // Bollinger Bands position
    const bbPosition = (frame.price.close - bb.lower) / (bb.upper - bb.lower);
    if (bbPosition < 0.2) score += 0.2;
    else if (bbPosition > 0.8) score -= 0.2;
    // EMA trend
    if (ema20 > ema50 && frame.price.close > ema20) score += 0.25;
    else if (ema20 < ema50 && frame.price.close < ema20) score -= 0.25;
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Calculate order flow score.
   * @param frame Current market frame
   * @returns Order flow score
   */
  calculateOrderFlowScore(frame: MarketFrame): number {
    const { bidVolume, askVolume, netFlow } = frame.orderFlow;
    const totalVolume = bidVolume + askVolume;
    if (totalVolume === 0) return 0;
    const imbalance = (bidVolume - askVolume) / totalVolume;
    const flowScore = Math.tanh(netFlow / frame.volume);
    return imbalance * 0.6 + flowScore * 0.4;
  }

  /**
   * Calculate market microstructure score.
   * @param frame Current market frame
   * @returns Microstructure score
   */
  calculateMicrostructureScore(frame: MarketFrame): number {
    const { spread, depth, imbalance, toxicity } = frame.marketMicrostructure;
    const spreadScore = Math.max(0, 1 - spread / frame.price.close);
    const depthScore = Math.min(1, depth / (frame.volume * 0.1));
    const imbalanceScore = Math.tanh(imbalance);
    const toxicityScore = Math.max(0, 1 - toxicity);
    return spreadScore * 0.3 + depthScore * 0.2 + imbalanceScore * 0.3 + toxicityScore * 0.2;
  }

  /**
   * Generate trading signal.
   * @param frames Array of market frames
   * @param index Index of current frame
   * @returns Signal object or null
   */
  async generateSignal(frames: MarketFrame[], index: number): Promise<Signal | null> {
    if (index < 20) return null;
    const current = frames[index];
    const technicalScore = this.calculateTechnicalScore(frames, index);
    const orderFlowScore = this.calculateOrderFlowScore(current);
    const microstructureScore = this.calculateMicrostructureScore(current);
    const volatility = current.indicators.atr / current.price.close;
    const techWeight = volatility < 0.02 ? 0.5 : 0.3;
    const flowWeight = 0.3;
    const microWeight = 0.2;
    const compositeScore = (
      technicalScore * techWeight +
      orderFlowScore * flowWeight +
      microstructureScore * microWeight
    );
    const strength = Math.abs(compositeScore);
    const confidence = this.calculateConfidence(frames.slice(Math.max(0, index - 10), index), current);
    if (strength < 0.3 || confidence < 0.6) return null;
    const thresholds = this.config.signal_thresholds?.crypto?.scalping || {};
    const indicators = current.indicators;
    const additionalIndicators = { ichimoku_bullish: indicators.ichimoku_bullish };
    const momentumShort = indicators.momentumShort ?? 0;
    const momentumLong = indicators.momentumLong ?? 0;
    const rsi = indicators.rsi ?? 50;
  const macd = indicators.macd?.macd ?? 0;
    const bbPos = indicators.bbPos ?? 0.5;
    const volRatio = indicators.volumeRatio ?? 1.0;
    const mom7d = indicators.mom7d ?? 0;
    const mom30d = indicators.mom30d ?? 0;

    // --- label fallbacks ---
      // Construct config for classifier
      const classifierConfig = {
        thresholds,
        additionalIndicators,
      };
      const momentumLabel = safeString(
        SignalClassifier.classifyMomentumSignal(
          momentumShort,
          momentumLong,
          rsi,
          macd,
          classifierConfig
        )
      );
      const regimeState = safeString(
        SignalClassifier.classifyState(
          momentumShort,
          mom7d,
          mom30d,
          rsi,
          macd,
          bbPos,
          classifierConfig
        )
      );
      const legacyLabel = safeString(
        SignalClassifier.classifyLegacy(
          mom7d,
          mom30d,
          rsi,
          macd,
          bbPos,
          classifierConfig
        )
      );
      // signalStrengthScore: use momentumShort for now (or set to 0)
      const signalStrengthScore = Number(momentumShort ?? 0);

    const type = compositeScore > 0 ? 'BUY' : 'SELL';
    const atr = indicators.atr;
    const stopLoss = type === 'BUY'
      ? current.price.close - (atr * 2)
      : current.price.close + (atr * 2);
    const takeProfit = type === 'BUY'
      ? current.price.close + (atr * 3)
      : current.price.close - (atr * 3);
    const riskReward = Math.abs(takeProfit - current.price.close) / Math.abs(current.price.close - stopLoss);

      const signalData: Signal = {
        symbol: current.symbol,
        type,
        strength,
        confidence,
        price: current.price.close,
        reasoning: [
          ...this.generateReasoning(technicalScore, orderFlowScore, microstructureScore),
          `Momentum: ${momentumLabel}`,
          `State: ${regimeState}`,
          `Legacy: ${legacyLabel}`,
          `StrengthScore: ${signalStrengthScore}`
        ],
        riskReward,
        stopLoss,
        takeProfit,
        momentumLabel,
        regimeState,
        legacyLabel,
        signalStrengthScore: Number(signalStrengthScore)
      };

  // Ensure momentumLabel is always a string
    // Construct a Signal object, ensuring all required fields are present and strings
      const rawResult = await storage.createSignal(signalData);
      // Guarantee all required fields are present and typed correctly
      if (!rawResult) return null;
      return {
        ...rawResult,
        type: rawResult.type === 'BUY' ? 'BUY' : 'SELL',
        momentumLabel: safeString(rawResult.momentumLabel),
        regimeState: safeString(rawResult.regimeState),
        legacyLabel: safeString(rawResult.legacyLabel),
        signalStrengthScore: typeof rawResult.signalStrengthScore === 'number' ? rawResult.signalStrengthScore : Number(rawResult.signalStrengthScore) || 0,
        reasoning: Array.isArray(rawResult.reasoning)
          ? rawResult.reasoning.map((r: any) => typeof r === 'string' ? r : String(r))
          : [String(rawResult.reasoning)]
      };
  }

  /**
   * Calculate signal confidence.
   * @param historical Historical market frames
   * @param current Current market frame
   * @returns Confidence score (0 to 1)
   */
  private calculateConfidence(historical: MarketFrame[], current: MarketFrame): number {
    if (historical.length === 0) return 0.5;
    const avgVolume = historical.reduce((sum, f) => sum + f.volume, 0) / historical.length;
    const volumeConfirmation = Math.min(1, current.volume / avgVolume);
    const microHealth = 1 - current.marketMicrostructure.toxicity;
    return volumeConfirmation * 0.5 + microHealth * 0.5;
  }

  /**
   * Generate reasoning for signal.
   * @param tech Technical score
   * @param flow Order flow score
   * @param micro Microstructure score
   * @returns Array of reasoning strings
   */
  private generateReasoning(tech: number, flow: number, micro: number): string[] {
    const reasons: string[] = [];
    if (Math.abs(tech) > 0.3) {
      reasons.push(`Technical analysis ${tech > 0 ? 'bullish' : 'bearish'} (${(tech * 100).toFixed(1)}%)`);
    }
    if (Math.abs(flow) > 0.3) {
      reasons.push(`Order flow ${flow > 0 ? 'accumulation' : 'distribution'} detected`);
    }
    if (micro > 0.6) {
      reasons.push('Healthy market microstructure');
    } else if (micro < 0.4) {
      reasons.push('Degraded market microstructure');
    }
    return reasons;
  }
}

/**
 * Class for fetching market data from exchanges using ccxt.
 */
class ExchangeDataFeed {
  private exchanges: Map<string, ccxt.Exchange> = new Map();
  private isConnected: boolean = false;

  private constructor() {}

  /**
   * Load markets with caching to disk for faster restarts
   */
  private async loadMarketsWithCache(exchange: ccxt.Exchange, exchangeName: string): Promise<void> {
    const cacheDir = path.join(__dirname, '..', 'data');
    const cacheFile = path.join(cacheDir, `markets-${exchangeName}.json`);
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    try {
      // Try to load from cache first
      if (fs.existsSync(cacheFile)) {
        const cacheAge = Date.now() - fs.statSync(cacheFile).mtime.getTime();
        const maxCacheAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheAge < maxCacheAge) {
          console.log(`[CACHE] Loading markets for ${exchangeName} from cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
          const cachedMarkets = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          exchange.markets = cachedMarkets;
          return;
        } else {
          console.log(`[CACHE] Cache for ${exchangeName} is stale (${Math.round(cacheAge / 1000 / 60)} minutes old), refreshing...`);
        }
      }
      
      // Load fresh markets from exchange
      console.log(`[API] Loading fresh markets for ${exchangeName}...`);
      await exchange.loadMarkets();
      
      // Cache the markets
      fs.writeFileSync(cacheFile, JSON.stringify(exchange.markets, null, 2));
      console.log(`[CACHE] Markets for ${exchangeName} cached successfully`);
      
    } catch (error) {
      console.error(`[ERROR] Failed to load markets for ${exchangeName}:`, error);
      
      // Fallback to cache if available (even if stale)
      if (fs.existsSync(cacheFile)) {
        console.log(`[FALLBACK] Using stale cache for ${exchangeName}`);
        const cachedMarkets = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        exchange.markets = cachedMarkets;
      } else {
        throw error;
      }
    }
  }

  /**
   * Rate-limited fetch wrapper to prevent throttler overflow
   */
  private async rateLimitedFetch<T>(
    exchange: ccxt.Exchange, 
    fetchFunction: () => Promise<T>, 
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetchFunction();
      } catch (error: any) {
        // Check if it's a throttler queue overflow error
        if (error.message && error.message.includes('throttle queue is over maxCapacity')) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
          console.warn(`[RATE_LIMIT] Throttler queue overflow, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // If it's not a rate limit error or we've exhausted retries, throw
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  static async create(): Promise<ExchangeDataFeed> {
    const instance = new ExchangeDataFeed();
    await instance.initializeExchanges();
    return instance;
  }

  /**
   * Initialize exchanges with API credentials.
   */
  private async initializeExchanges() {
    try {
      const config = (await import('../config/exchange-config.json', { with: { type: 'json' } })).default;
      // --- Crypto Exchanges ---
      // Initialize all exchanges with proper rate limiting and throttler verification
      const cryptoExchanges = [
        { name: 'binance', instance: new ccxt.binance({
          apiKey: process.env.BINANCE_API_KEY,
          secret: process.env.BINANCE_SECRET,
          sandbox: config.binance.sandbox,
          enableRateLimit: true
        })},
        { name: 'coinbase', instance: new ccxt.coinbase({
          apiKey: process.env.COINBASE_API_KEY,
          secret: process.env.COINBASE_SECRET,
          enableRateLimit: true
        })},
        { name: 'kraken', instance: new ccxt.kraken({
          apiKey: process.env.KRAKEN_API_KEY,
          secret: process.env.KRAKEN_SECRET,
          enableRateLimit: true
        })}
      ];
      
      // Initialize crypto exchanges with throttler verification
      for (const { name, instance } of cryptoExchanges) {
        console.log(`[INIT] Initializing ${name}...`);
        await this.loadMarketsWithCache(instance, name);
        
        // Verify throttler is working
        if (typeof instance.throttle !== 'function') {
          console.warn(`[WARN] Throttler not properly initialized for ${name}`);
          instance.enableRateLimit = true;
        }
        
        this.exchanges.set(name, instance);
        console.log(`[INIT] ${name} initialized successfully`);
      }
      // Do NOT set sandbox for kucoinfutures (not supported)
      const kucoinFutures = new ccxt.kucoinfutures({
        apiKey: process.env.KUCOIN_API_KEY,
        secret: process.env.KUCOIN_SECRET,
        password: process.env.KUCOIN_PASSPHRASE,
        enableRateLimit: true, // Required for this.throttle to be initialized
        timeout: 20000,
        rateLimit: 200 // 200ms between requests to prevent throttler overflow
      });
      
      // Ensure throttler is properly initialized before loadMarkets
      console.log('[INIT] Initializing kucoinfutures...');
      await this.loadMarketsWithCache(kucoinFutures, 'kucoinfutures');
      
      // Verify throttler is working
      if (typeof kucoinFutures.throttle !== 'function') {
        console.warn('[WARN] Throttler not properly initialized for kucoinfutures');
        kucoinFutures.enableRateLimit = true;
      }
      
      console.log('Available symbols for kucoinfutures:', Object.keys(kucoinFutures.markets));
      this.exchanges.set('kucoinfutures', kucoinFutures);
      
      // Initialize other exchanges with proper rate limiting
      const otherExchanges = [
        { name: 'okx', instance: new ccxt.okx({
          apiKey: process.env.OKX_API_KEY,
          secret: process.env.OKX_SECRET,
          password: process.env.OKX_PASSPHRASE,
          enableRateLimit: true,
          sandbox: config.okx.sandbox
        })},
        { name: 'bybit', instance: new ccxt.bybit({
          apiKey: process.env.BYBIT_API_KEY,
          secret: process.env.BYBIT_SECRET,
          enableRateLimit: true,
          sandbox: config.bybit.sandbox
        })}
      ];
      
      // Initialize each exchange with proper throttler verification
      for (const { name, instance } of otherExchanges) {
        console.log(`[INIT] Initializing ${name}...`);
        await this.loadMarketsWithCache(instance, name);
        
        // Verify throttler is working
        if (typeof instance.throttle !== 'function') {
          console.warn(`[WARN] Throttler not properly initialized for ${name}`);
          instance.enableRateLimit = true;
        }
        
        this.exchanges.set(name, instance);
        console.log(`[INIT] ${name} initialized successfully`);
      }


      // --- Forex Exchanges ---
      // OANDA (only if present in ccxt build)
      if (config.oanda?.enabled && typeof (ccxt as any).oanda === 'function') {
        this.exchanges.set('oanda', new (ccxt as any).oanda({
          apiKey: process.env.OANDA_API_KEY,
          secret: process.env.OANDA_SECRET,
          enableRateLimit: config.oanda.enableRateLimit
        }));
      }
      // FXCM (only if present in ccxt build)
      if (config.fxcm?.enabled && typeof (ccxt as any).fxcm === 'function') {
        this.exchanges.set('fxcm', new (ccxt as any).fxcm({
          apiKey: process.env.FXCM_API_KEY,
          secret: process.env.FXCM_SECRET,
          enableRateLimit: config.fxcm.enableRateLimit
        }));
      }
      // yfinance fallback (always available as 'yfinance-forex')
      this.exchanges.set('yfinance-forex', new YFinanceForexAdapter() as any); // 'as any' to bypass Exchange type
      // Add more forex APIs here as needed. To add more, check ccxt docs and add runtime check as above.

      this.isConnected = true;
    } catch (error) {
      console.error('Failed to initialize exchanges:', error);
      this.isConnected = false;
    }
  }

  /**
   * Fetch market data for a symbol.
   * @param symbol Trading pair symbol (e.g., BTC/USDT)
   * @param timeframe Timeframe for OHLCV data
   * @param limit Number of candles to fetch
   * @returns Array of market frames
   */
  async fetchMarketData(symbol: string, timeframe: string = '1m', limit: number = 100, exchangeName?: string): Promise<MarketFrame[]> {
    if (!this.isConnected) {
      throw new Error('Exchange not connected. Please check API credentials.');
    }
    try {
      // Use kucoinfutures as main if present in config
      const config = (await import('../config/exchange-config.json', { with: { type: 'json' } })).default;
      let mainExchange = 'kucoinfutures';
      if (exchangeName && this.exchanges.has(exchangeName)) {
        mainExchange = exchangeName;
      } else if (config.kucoinfutures?.main) {
        mainExchange = 'kucoinfutures';
      } else if (config.oanda?.enabled) {
        mainExchange = 'oanda';
      } else if (config.fxcm?.enabled) {
        mainExchange = 'fxcm';
      } else {
        mainExchange = 'yfinance-forex';
      }
      const exchange = this.exchanges.get(mainExchange);
      if (!exchange) throw new Error('Exchange not available');
      // For yfinance, don't normalize symbol, just pass as is
      const normalizedSymbol = mainExchange === 'yfinance-forex' ? symbol : normalizeSymbol(symbol, exchange);
      
      // Use rate-limited fetch to prevent throttler overflow
      const ohlcv = await this.rateLimitedFetch(exchange, () => 
        exchange.fetchOHLCV(normalizedSymbol, timeframe, undefined, limit)
      );
      const ticker = await this.rateLimitedFetch(exchange, () => 
        exchange.fetchTicker(normalizedSymbol)
      );
      return ohlcv.map((candle, index) => {
        const [timestamp, open, high, low, close, volume] = candle;
        const prices = ohlcv.slice(0, index + 1).map(c => Number(c[4]) || 0);
        const highs = ohlcv.slice(0, index + 1).map(c => Number(c[2]) || 0);
        const lows = ohlcv.slice(0, index + 1).map(c => Number(c[3]) || 0);
        const closes = ohlcv.slice(0, index + 1).map(c => Number(c[4]) || 0);
        const volumes = ohlcv.slice(0, index + 1).map(c => Number(c[5]) || 0);
        const rsi = TechnicalIndicators.calculateRSI(prices);
        const macd = TechnicalIndicators.calculateMACD(prices);
        const bb = TechnicalIndicators.calculateBollingerBands(prices);
        const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
        const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
        const ema200 = TechnicalIndicators.calculateEMA(prices, 200);
        const multiEMA = TechnicalIndicators.calculateMultiEMA(prices, [9, 21, 50, 100, 200]);
        const stoch = TechnicalIndicators.calculateStochastic(prices, highs, lows);
        const adx = TechnicalIndicators.calculateADX(highs, lows, closes);
        const vwap = TechnicalIndicators.calculateVWAP(prices, volumes);
        const atr = TechnicalIndicators.calculateATR(highs, lows, closes);
        const safeClose = close !== undefined ? close : 0;
        // Use actual bid/ask volume, netFlow, largeOrders, smallOrders, spread, depth, imbalance, toxicity if available from ticker or exchange
        // If not available, set to null or 0
        return {
          id: `${symbol}-${timestamp}`,
          timestamp: new Date(Number(timestamp)),
          symbol,
          price: { open, high, low, close: safeClose },
          volume: Number(volume) || 0,
          indicators: {
            rsi,
            macd,
            bb,
            ema20: ema20[ema20.length - 1] || safeClose,
            ema50: ema50[ema50.length - 1] || safeClose,
            ema200: ema200[ema200.length - 1] || safeClose,
            multiEMA,
            stoch_k: stoch.k,
            stoch_d: stoch.d,
            adx,
            vwap,
            atr
          },
          orderFlow: {
            bidVolume: ticker.bidVolume ?? 0,
            askVolume: ticker.askVolume ?? 0,
            netFlow: 0, // Not available from ticker
            largeOrders: 0, // Not available from ticker
            smallOrders: 0 // Not available from ticker
          },
          marketMicrostructure: {
            spread: ticker.bid && ticker.ask ? ticker.ask - ticker.bid : 0,
            depth: 0, // Not available from ticker
            imbalance: 0, // Not available from ticker
            toxicity: 0 // Not available from ticker
          }
        } as MarketFrame & { id: string; timestamp: Date };
      });
    } catch (error: any) {
      // Only log if not a geo-restriction error (403/451)
      const statusCode = error?.status || error?.statusCode || 0;
      const message = error?.message || '';
      const isGeoRestricted = statusCode === 403 || statusCode === 451 || 
                            message.includes('403') || message.includes('451') ||
                            message.includes('Forbidden') || message.includes('geo') ||
                            message.includes('restricted') || message.includes('CloudFront');
      
      if (!isGeoRestricted) {
        console.error('Failed to fetch market data:', error);
      }
      throw error;
    }
  }

  /**
   * Check exchange connection status.
   * @returns Object with exchange names and their status
   */
  async getExchangeStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    for (const [name, exchange] of Array.from(this.exchanges.entries())) {
      try {
        await exchange.fetchStatus();
        status[name] = true;
      } catch (error) {
        status[name] = false;
      }
    }
    return status;
  }
}

/**
 * Default trading configuration.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadTradingConfig(): TradingConfig {
  const configPath = path.resolve(__dirname, '../config/trading-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

const defaultTradingConfig: TradingConfig = loadTradingConfig();

export { TechnicalIndicators, SignalEngine, ExchangeDataFeed, defaultTradingConfig };