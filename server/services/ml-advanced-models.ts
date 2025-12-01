
/**
 * Advanced ML Models for Trading
 * 
 * 5 Additional Models:
 * 1. Market Regime Detector
 * 2. Breakout Probability Predictor
 * 3. Order Flow Imbalance Analyzer
 * 4. Multi-Timeframe Momentum Synthesizer
 * 5. Liquidity Squeeze Detector
 */

interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi?: number | null;
  macd?: number | null;
  ema?: number | null;
}

export interface AdvancedMLPredictions {
  marketRegime: {
    regime: 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'breakout';
    confidence: number;
    strength: number;
    characteristics: string[];
  };
  breakoutProbability: {
    upward: number;
    downward: number;
    direction: 'up' | 'down' | 'neutral';
    timeframe: string;
    triggerPrice: number;
  };
  orderFlowImbalance: {
    buyPressure: number;
    sellPressure: number;
    netImbalance: number;
    dominantSide: 'buyers' | 'sellers' | 'balanced';
    strength: number;
  };
  multiTimeframeMomentum: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
    alignment: 'bullish' | 'bearish' | 'mixed';
    divergence: boolean;
    score: number;
  };
  liquiditySqueeze: {
    detected: boolean;
    intensity: number;
    level: 'none' | 'low' | 'medium' | 'high' | 'extreme';
    expectedMove: number;
    timeToRelease: number;
  };
  metadata: {
    timestamp: number;
    dataPoints: number;
    allModelsConfidence: number;
  };
}

export class AdvancedMLService {
  /**
   * Model 1: Market Regime Detector
   * Classifies current market conditions
   */
  static detectMarketRegime(data: ChartDataPoint[]): AdvancedMLPredictions['marketRegime'] {
    if (data.length < 50) {
      return {
        regime: 'ranging',
        confidence: 0.5,
        strength: 0,
        characteristics: ['Insufficient data']
      };
    }

    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    // Calculate trend strength
    const trendStrength = this.calculateTrendStrength(prices);
    const volatility = this.calculateVolatility(prices, 20);
    const volumeTrend = this.calculateTrend(volumes, 20);
    const priceRange = (Math.max(...prices.slice(-20)) - Math.min(...prices.slice(-20))) / prices[prices.length - 1];

    // Score each regime
    const scores = {
      trending_up: 0,
      trending_down: 0,
      ranging: 0,
      volatile: 0,
      breakout: 0
    };

    // Trending up detection
    if (trendStrength > 0.3 && volumeTrend > 0) {
      scores.trending_up = Math.min(100, (trendStrength * 100) + (volumeTrend * 50));
    }

    // Trending down detection
    if (trendStrength < -0.3 && volumeTrend > 0) {
      scores.trending_down = Math.min(100, (Math.abs(trendStrength) * 100) + (volumeTrend * 50));
    }

    // Ranging detection
    if (Math.abs(trendStrength) < 0.2 && volatility < 0.015) {
      scores.ranging = Math.min(100, (1 - Math.abs(trendStrength)) * 100);
    }

    // Volatile detection
    if (volatility > 0.03) {
      scores.volatile = Math.min(100, volatility * 2000);
    }

    // Breakout detection
    const volumeSpike = volumes[volumes.length - 1] / (volumes.slice(-20).reduce((a, b) => a + b, 0) / 20);
    if (volumeSpike > 2 && priceRange > 0.05) {
      scores.breakout = Math.min(100, (volumeSpike * 30) + (priceRange * 500));
    }

    // Determine regime
    const maxScore = Math.max(...Object.values(scores));
    const regime = Object.keys(scores).find(k => scores[k as keyof typeof scores] === maxScore) as any;
    const confidence = maxScore / 100;

    // Characteristics
    const characteristics: string[] = [];
    if (volatility > 0.03) characteristics.push('High volatility');
    if (volumeTrend > 0.5) characteristics.push('Increasing volume');
    if (Math.abs(trendStrength) > 0.5) characteristics.push('Strong directional move');
    if (priceRange > 0.1) characteristics.push('Wide price range');
    if (characteristics.length === 0) characteristics.push('Normal conditions');

    return {
      regime: regime || 'ranging',
      confidence,
      strength: Math.abs(trendStrength),
      characteristics
    };
  }

  /**
   * Model 2: Breakout Probability Predictor
   */
  static predictBreakout(data: ChartDataPoint[]): AdvancedMLPredictions['breakoutProbability'] {
    if (data.length < 30) {
      return {
        upward: 0.5,
        downward: 0.5,
        direction: 'neutral',
        timeframe: 'unknown',
        triggerPrice: data[data.length - 1].close
      };
    }

    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    const currentPrice = prices[prices.length - 1];
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    
    // Compression detection
    const compressionRatio = (recentHigh - recentLow) / currentPrice;
    const volumeCompression = this.calculateVolatility(volumes, 10);
    const priceAtResistance = currentPrice / recentHigh;
    const priceAtSupport = (currentPrice - recentLow) / currentPrice;

    // Upward breakout probability
    let upwardProb = 0.5;
    if (priceAtResistance > 0.95) upwardProb += 0.2;
    if (compressionRatio < 0.05) upwardProb += 0.15;
    if (volumeCompression < 0.3) upwardProb += 0.15;

    // Downward breakout probability
    let downwardProb = 0.5;
    if (priceAtSupport < 0.05) downwardProb += 0.2;
    if (compressionRatio < 0.05) downwardProb += 0.15;
    if (volumeCompression < 0.3) downwardProb += 0.15;

    const direction = upwardProb > downwardProb ? 'up' : downwardProb > upwardProb ? 'down' : 'neutral';
    const triggerPrice = direction === 'up' ? recentHigh : recentLow;
    const timeframe = compressionRatio < 0.03 ? '1-3 candles' : compressionRatio < 0.07 ? '3-7 candles' : '7+ candles';

    return {
      upward: Math.min(1, upwardProb),
      downward: Math.min(1, downwardProb),
      direction,
      timeframe,
      triggerPrice
    };
  }

  /**
   * Model 3: Order Flow Imbalance Analyzer
   */
  static analyzeOrderFlow(data: ChartDataPoint[]): AdvancedMLPredictions['orderFlowImbalance'] {
    if (data.length < 10) {
      return {
        buyPressure: 50,
        sellPressure: 50,
        netImbalance: 0,
        dominantSide: 'balanced',
        strength: 0
      };
    }

    const recent = data.slice(-20);
    let buyPressure = 0;
    let sellPressure = 0;

    for (const candle of recent) {
      const bodySize = Math.abs(candle.close - candle.open);
      const totalRange = candle.high - candle.low;
      
      if (candle.close > candle.open) {
        // Bullish candle
        buyPressure += (bodySize / totalRange) * candle.volume;
      } else {
        // Bearish candle
        sellPressure += (bodySize / totalRange) * candle.volume;
      }
    }

    const totalPressure = buyPressure + sellPressure;
    const buyPct = (buyPressure / totalPressure) * 100;
    const sellPct = (sellPressure / totalPressure) * 100;
    const netImbalance = buyPct - sellPct;

    let dominantSide: 'buyers' | 'sellers' | 'balanced' = 'balanced';
    if (netImbalance > 10) dominantSide = 'buyers';
    else if (netImbalance < -10) dominantSide = 'sellers';

    const strength = Math.abs(netImbalance) / 100;

    return {
      buyPressure: buyPct,
      sellPressure: sellPct,
      netImbalance,
      dominantSide,
      strength
    };
  }

  /**
   * Model 4: Multi-Timeframe Momentum Synthesizer
   */
  static synthesizeMomentum(data: ChartDataPoint[]): AdvancedMLPredictions['multiTimeframeMomentum'] {
    if (data.length < 50) {
      return {
        shortTerm: 0,
        mediumTerm: 0,
        longTerm: 0,
        alignment: 'mixed',
        divergence: false,
        score: 0
      };
    }

    const prices = data.map(d => d.close);

    // Calculate momentum for different timeframes
    const shortTerm = this.calculateMomentum(prices, 5);
    const mediumTerm = this.calculateMomentum(prices, 20);
    const longTerm = this.calculateMomentum(prices, 50);

    // Alignment detection
    let alignment: 'bullish' | 'bearish' | 'mixed' = 'mixed';
    if (shortTerm > 0 && mediumTerm > 0 && longTerm > 0) {
      alignment = 'bullish';
    } else if (shortTerm < 0 && mediumTerm < 0 && longTerm < 0) {
      alignment = 'bearish';
    }

    // Divergence detection
    const divergence = (shortTerm > 0 && mediumTerm < 0) || (shortTerm < 0 && mediumTerm > 0);

    // Overall score
    const score = (shortTerm * 0.5 + mediumTerm * 0.3 + longTerm * 0.2);

    return {
      shortTerm,
      mediumTerm,
      longTerm,
      alignment,
      divergence,
      score
    };
  }

  /**
   * Model 5: Liquidity Squeeze Detector
   */
  static detectLiquiditySqueeze(data: ChartDataPoint[]): AdvancedMLPredictions['liquiditySqueeze'] {
    if (data.length < 30) {
      return {
        detected: false,
        intensity: 0,
        level: 'none',
        expectedMove: 0,
        timeToRelease: 0
      };
    }

    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);

    // Calculate compression metrics
    const priceCompression = this.calculateVolatility(prices.slice(-20), 20);
    const volumeDecline = this.calculateTrend(volumes.slice(-20), 20);
    const rangeCompression = (Math.max(...highs.slice(-20)) - Math.min(...lows.slice(-20))) / prices[prices.length - 1];

    // Squeeze intensity
    let intensity = 0;
    if (priceCompression < 0.015) intensity += 30;
    if (volumeDecline < -0.2) intensity += 30;
    if (rangeCompression < 0.05) intensity += 40;

    const detected = intensity > 50;
    
    let level: 'none' | 'low' | 'medium' | 'high' | 'extreme' = 'none';
    if (intensity > 80) level = 'extreme';
    else if (intensity > 60) level = 'high';
    else if (intensity > 40) level = 'medium';
    else if (intensity > 20) level = 'low';

    // Expected move (higher compression = bigger move expected)
    const expectedMove = intensity > 0 ? (1 - priceCompression) * 0.1 : 0;

    // Time to release (estimate based on compression duration)
    const compressionDuration = this.countConsecutiveLowVolatility(prices);
    const timeToRelease = compressionDuration > 10 ? 1 : compressionDuration > 5 ? 3 : 5;

    return {
      detected,
      intensity,
      level,
      expectedMove,
      timeToRelease
    };
  }

  /**
   * Generate all advanced predictions
   */
  static async generateAdvancedPredictions(data: ChartDataPoint[]): Promise<AdvancedMLPredictions> {
    const marketRegime = this.detectMarketRegime(data);
    const breakoutProbability = this.predictBreakout(data);
    const orderFlowImbalance = this.analyzeOrderFlow(data);
    const multiTimeframeMomentum = this.synthesizeMomentum(data);
    const liquiditySqueeze = this.detectLiquiditySqueeze(data);

    const allConfidences = [
      marketRegime.confidence,
      Math.max(breakoutProbability.upward, breakoutProbability.downward),
      orderFlowImbalance.strength,
      Math.abs(multiTimeframeMomentum.score),
      liquiditySqueeze.intensity / 100
    ];
    const avgConfidence = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;

    return {
      marketRegime,
      breakoutProbability,
      orderFlowImbalance,
      multiTimeframeMomentum,
      liquiditySqueeze,
      metadata: {
        timestamp: Date.now(),
        dataPoints: data.length,
        allModelsConfidence: avgConfidence
      }
    };
  }

  // Helper methods
  private static calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    return (current - past) / past;
  }

  private static calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const returns = [];
    for (let i = prices.length - period; i < prices.length - 1; i++) {
      returns.push(Math.log(prices[i + 1] / prices[i]));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private static calculateTrend(values: number[], period: number): number {
    const recent = values.slice(-Math.min(period, values.length));
    if (recent.length < 2) return 0;
    const n = recent.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = recent.reduce((a, b) => a + b, 0);
    const sumXY = recent.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / (sumY / n);
  }

  private static calculateTrendStrength(prices: number[]): number {
    if (prices.length < 10) return 0;
    const recent = prices.slice(-10);
    let upMoves = 0;
    let downMoves = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) upMoves++;
      else if (recent[i] < recent[i - 1]) downMoves++;
    }
    return (upMoves - downMoves) / (recent.length - 1);
  }

  private static countConsecutiveLowVolatility(prices: number[]): number {
    let count = 0;
    for (let i = prices.length - 1; i >= Math.max(0, prices.length - 20); i--) {
      const windowPrices = prices.slice(Math.max(0, i - 5), i + 1);
      const vol = this.calculateVolatility(windowPrices, windowPrices.length);
      if (vol < 0.015) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}

export default AdvancedMLService;
