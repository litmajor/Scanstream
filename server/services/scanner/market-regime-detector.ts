/**
 * Market Regime Detection - Ported from Python scanner.py
 * 
 * Detects market regime:
 * - Bull / Bear / Ranging
 * - Trend strength (ADX-based)
 * - Volatility classification
 * - EMA alignment
 */

export interface RegimeDetectionResult {
  regime: 'bull' | 'bear' | 'ranging';
  confidence: number; // 0-100
  trendStrength: number; // 0-100 (ADX)
  volatility: 'low' | 'medium' | 'high';
  atrPct: number;
  suggestedOpportunityThreshold: number; // 60-80 based on regime
  emaAlignment: {
    priceAbove20: boolean;
    priceAbove50: boolean;
    priceAbove200: boolean;
    ema20Above50: boolean;
    ema50Above200: boolean;
  };
  returns: {
    '20d': number;
    '50d': number;
  };
}

export interface FibonacciLevels {
  direction: 'bull' | 'bear';
  swingHigh: number;
  swingLow: number;
  retracements: Record<number, number>;
  extensions: Record<number, number>;
  nearestRetracement: number;
  nearestExtension: number;
  distanceToNearestR: number;
  distanceToNearestE: number;
}

export class MarketRegimeDetector {
  /**
   * Detect current market regime (bull/bear/ranging)
   * Uses EMA alignment, ADX, and volatility analysis
   */
  static detectRegime(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes?: number[]
  ): RegimeDetectionResult {
    if (closes.length < 200) {
      return {
        regime: 'ranging',
        confidence: 30,
        trendStrength: 0,
        volatility: 'medium',
        atrPct: 2,
        suggestedOpportunityThreshold: 75,
        emaAlignment: {
          priceAbove20: false,
          priceAbove50: false,
          priceAbove200: false,
          ema20Above50: false,
          ema50Above200: false
        },
        returns: { '20d': 0, '50d': 0 }
      };
    }

    const currentPrice = closes[closes.length - 1];

    // Calculate EMAs
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);

    // EMA alignment signals
    const priceAbove20 = currentPrice > ema20;
    const priceAbove50 = currentPrice > ema50;
    const priceAbove200 = currentPrice > ema200;
    const ema20Above50 = ema20 > ema50;
    const ema50Above200 = ema50 > ema200;

    // Count bullish/bearish signals
    const bullSignals = [priceAbove20, priceAbove50, priceAbove200, ema20Above50, ema50Above200]
      .filter(s => s).length;
    const bearSignals = 5 - bullSignals;

    // Calculate ADX for trend strength
    const adx = this.calculateADX(highs, lows, closes);

    // Calculate volatility
    const priceVolatility = this.calculateVolatility(closes, 20);
    const atrPct = this.calculateATRPct(highs, lows, closes, 14);

    // Determine volatility classification
    let volatility: 'low' | 'medium' | 'high' = 'medium';
    if (atrPct < 1.5) {
      volatility = 'low';
    } else if (atrPct >= 3.5) {
      volatility = 'high';
    }

    // Ranging detection: low ADX + low volatility
    let regime: 'bull' | 'bear' | 'ranging' = 'ranging';
    let confidence = 50;
    let opportunityThreshold = 75;

    if (adx < 20 && priceVolatility < 3) {
      regime = 'ranging';
      confidence = Math.min(100, (20 - adx) * 5 + (3 - priceVolatility) * 10);
      opportunityThreshold = 80;
    } else if (bullSignals >= 4) {
      regime = 'bull';
      const returns20d = closes.length >= 20 ? (closes[closes.length - 1] / closes[closes.length - 20] - 1) * 100 : 0;
      confidence = Math.min(100, bullSignals * 20 + Math.max(0, returns20d));
      opportunityThreshold = 60;
    } else if (bearSignals >= 4) {
      regime = 'bear';
      const returns20d = closes.length >= 20 ? (closes[closes.length - 1] / closes[closes.length - 20] - 1) * 100 : 0;
      confidence = Math.min(100, bearSignals * 20 + Math.max(0, -returns20d));
      opportunityThreshold = 75;
    } else if (bullSignals > bearSignals) {
      regime = 'bull';
      confidence = Math.min(80, bullSignals * 15);
      opportunityThreshold = 65;
    } else if (bearSignals > bullSignals) {
      regime = 'bear';
      confidence = Math.min(80, bearSignals * 15);
      opportunityThreshold = 75;
    }

    // Calculate returns
    const returns20d = closes.length >= 20
      ? ((closes[closes.length - 1] / closes[closes.length - 20]) - 1) * 100
      : 0;
    const returns50d = closes.length >= 50
      ? ((closes[closes.length - 1] / closes[closes.length - 50]) - 1) * 100
      : 0;

    return {
      regime,
      confidence: Math.round(confidence * 10) / 10,
      trendStrength: Math.round(adx * 10) / 10,
      volatility,
      atrPct: Math.round(atrPct * 100) / 100,
      suggestedOpportunityThreshold: opportunityThreshold,
      emaAlignment: {
        priceAbove20,
        priceAbove50,
        priceAbove200,
        ema20Above50,
        ema50Above200
      },
      returns: {
        '20d': Math.round(returns20d * 100) / 100,
        '50d': Math.round(returns50d * 100) / 100
      }
    };
  }

  /**
   * Calculate Fibonacci retracement and extension levels
   */
  static calculateFibonacciLevels(
    highs: number[],
    lows: number[],
    closes: number[],
    lookback: number = 55
  ): FibonacciLevels {
    if (highs.length < lookback) {
      return {
        direction: 'bull',
        swingHigh: highs[highs.length - 1],
        swingLow: lows[lows.length - 1],
        retracements: { 0: 0, 0.236: 0, 0.382: 0, 0.5: 0, 0.618: 0, 0.786: 0, 1: 0 },
        extensions: { 1.272: 0, 1.618: 0, 2: 0 },
        nearestRetracement: 0,
        nearestExtension: 0,
        distanceToNearestR: 0,
        distanceToNearestE: 0
      };
    }

    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    const recentCloses = closes.slice(-lookback);

    // Find swing high and low
    let swingHighIdx = 0;
    let swingLowIdx = 0;
    let swingHigh = recentHighs[0];
    let swingLow = recentLows[0];

    for (let i = 0; i < recentHighs.length; i++) {
      if (recentHighs[i] > swingHigh) {
        swingHigh = recentHighs[i];
        swingHighIdx = i;
      }
      if (recentLows[i] < swingLow) {
        swingLow = recentLows[i];
        swingLowIdx = i;
      }
    }

    // Determine direction
    const direction = swingHighIdx > swingLowIdx ? 'bear' : 'bull';
    const [base, top] = direction === 'bull' ? [swingLow, swingHigh] : [swingHigh, swingLow];
    const diff = Math.abs(top - base);

    // Calculate retracements
    const retracements: Record<number, number> = {
      0: top,
      0.236: top - 0.236 * diff,
      0.382: top - 0.382 * diff,
      0.5: top - 0.5 * diff,
      0.618: top - 0.618 * diff,
      0.786: top - 0.786 * diff,
      1: base
    };

    // Calculate extensions
    const extensions: Record<number, number> = {
      1.272: direction === 'bull' ? top + 0.272 * diff : base - 0.272 * diff,
      1.618: direction === 'bull' ? top + 0.618 * diff : base - 0.618 * diff,
      2: direction === 'bull' ? top + 1.0 * diff : base - 1.0 * diff
    };

    // Find current price vs nearest levels
    const currentPrice = recentCloses[recentCloses.length - 1];

    let nearestR = Object.values(retracements)[0];
    let minDistR = Math.abs(currentPrice - nearestR);
    for (const level of Object.values(retracements)) {
      const dist = Math.abs(currentPrice - level);
      if (dist < minDistR) {
        minDistR = dist;
        nearestR = level;
      }
    }

    let nearestE = Object.values(extensions)[0];
    let minDistE = Math.abs(currentPrice - nearestE);
    for (const level of Object.values(extensions)) {
      const dist = Math.abs(currentPrice - level);
      if (dist < minDistE) {
        minDistE = dist;
        nearestE = level;
      }
    }

    return {
      direction: direction as 'bull' | 'bear',
      swingHigh,
      swingLow,
      retracements,
      extensions,
      nearestRetracement: nearestR,
      nearestExtension: nearestE,
      distanceToNearestR: (currentPrice - nearestR) / currentPrice,
      distanceToNearestE: (currentPrice - nearestE) / currentPrice
    };
  }

  /**
   * Calculate Fibonacci confluence score (0-100)
   */
  static calculateFibConfluenceScore(
    fib: FibonacciLevels,
    poc: number,
    vwap: number,
    currentPrice: number,
    tolerance: number = 0.005
  ): number {
    let confluence = 0;

    // Check price vs Fibonacci levels
    for (const level of Object.values(fib.retracements)) {
      if (Math.abs((currentPrice - level) / currentPrice) < tolerance) {
        confluence += 20;
      }
    }
    for (const level of Object.values(fib.extensions)) {
      if (Math.abs((currentPrice - level) / currentPrice) < tolerance) {
        confluence += 15;
      }
    }

    // Check price vs POC
    if (Math.abs((currentPrice - poc) / currentPrice) < tolerance) {
      confluence += 20;
    }

    // Check price vs VWAP
    if (Math.abs((currentPrice - vwap) / currentPrice) < tolerance) {
      confluence += 20;
    }

    return Math.min(100, confluence);
  }

  // ==================== PRIVATE HELPERS ====================

  private static calculateEMA(values: number[], period: number): number {
    if (values.length < period) {
      return values[values.length - 1];
    }

    const alpha = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      ema = alpha * values[i] + (1 - alpha) * ema;
    }

    return ema;
  }

  private static calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number {
    if (closes.length < period + 1) {
      return 0;
    }

    // Simplified ADX calculation: use high-low range as proxy for directional movement
    let sumTr = 0;
    for (let i = Math.max(0, closes.length - period); i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      sumTr += tr;
    }

    const atr = sumTr / Math.min(period, closes.length);
    const hl = (highs[closes.length - 1] - lows[closes.length - 1]) / atr;
    
    // Rough ADX proxy: 0-100 scale
    return Math.min(100, Math.abs(hl) * 10);
  }

  private static calculateATRPct(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number {
    let sumTr = 0;
    const len = Math.min(period, closes.length - 1);

    for (let i = Math.max(0, closes.length - period); i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - (i > 0 ? closes[i - 1] : closes[i])),
        Math.abs(lows[i] - (i > 0 ? closes[i - 1] : closes[i]))
      );
      sumTr += tr;
    }

    const atr = sumTr / Math.max(1, len);
    const currentPrice = closes[closes.length - 1];

    return (atr / currentPrice) * 100;
  }

  private static calculateVolatility(values: number[], window: number = 20): number {
    const recent = values.slice(-window);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, v) => sum + Math.pow((v - mean) / mean, 2), 0) / recent.length;
    return Math.sqrt(variance) * 100;
  }
}

export default MarketRegimeDetector;
