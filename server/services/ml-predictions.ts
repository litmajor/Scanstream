/**
 * ML Predictions Service
 * 
 * Provides multiple ML models for trading predictions:
 * 1. Direction Classifier - Binary classification (bullish=1/bearish=0)
 * 2. Price Predictor - Regression for next candle price
 * 3. Volatility Predictor - Predicts next candle volatility
 * 4. Risk Assessor - Predicts risk levels
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

export interface MLPredictions {
  direction: {
    prediction: 'bullish' | 'bearish';
    probability: number; // 0-1 (probability of bullish)
    confidence: number; // 0-1
    signal: 1 | 0; // 1 = bullish, 0 = bearish
  };
  price: {
    predicted: number;
    high: number;
    low: number;
    confidence: number;
    percentChange: number;
  };
  volatility: {
    predicted: number; // ATR-like metric
    level: 'low' | 'medium' | 'high' | 'extreme';
    confidence: number;
  };
  risk: {
    score: number; // 0-100
    level: 'low' | 'medium' | 'high' | 'extreme';
    factors: string[];
  };
  metadata: {
    timestamp: number;
    dataPoints: number;
    features: number;
    horizon: string; // '1 candle', '5 candles', etc.
  };
}

export class MLPredictionService {
  /**
   * Generate comprehensive ML predictions from chart data
   */
  static async generatePredictions(chartData: ChartDataPoint[]): Promise<MLPredictions> {
    if (chartData.length < 20) {
      throw new Error('Insufficient data for ML predictions (minimum 20 candles required)');
    }

    // Extract features
    const features = this.extractFeatures(chartData);
    
    // Run all models
    const direction = this.predictDirection(chartData, features);
    const price = this.predictPrice(chartData, features);
    const volatility = this.predictVolatility(chartData, features);
    const risk = this.assessRisk(chartData, features, direction, volatility);

    return {
      direction,
      price,
      volatility,
      risk,
      metadata: {
        timestamp: Date.now(),
        dataPoints: chartData.length,
        features: Object.keys(features).length,
        horizon: '1 candle'
      }
    };
  }

  /**
   * Extract features from chart data
   */
  private static extractFeatures(data: ChartDataPoint[]): Record<string, number> {
    const recent = data.slice(-20);
    const current = recent[recent.length - 1];
    const prices = recent.map(d => d.close);
    const volumes = recent.map(d => d.volume);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);

    return {
      // Price features
      currentPrice: current.close,
      priceChange1: this.calculateChange(prices, 1),
      priceChange3: this.calculateChange(prices, 3),
      priceChange5: this.calculateChange(prices, 5),
      priceChange10: this.calculateChange(prices, 10),
      
      // Momentum features
      momentum5: this.calculateMomentum(prices, 5),
      momentum10: this.calculateMomentum(prices, 10),
      rateOfChange: this.calculateRateOfChange(prices, 5),
      
      // Volatility features
      volatility5: this.calculateVolatility(prices, 5),
      volatility10: this.calculateVolatility(prices, 10),
      atr: this.calculateATR(highs, lows, recent.map(d => d.close), 14),
      
      // Volume features
      volumeRatio: current.volume / (volumes.reduce((a, b) => a + b, 0) / volumes.length),
      volumeTrend: this.calculateTrend(volumes, 5),
      
      // Technical indicators (if available)
      rsi: current.rsi || 50,
      macd: current.macd || 0,
      ema: current.ema || current.close,
      
      // Pattern features
      trendStrength: this.calculateTrendStrength(prices),
      meanReversion: this.calculateMeanReversion(prices),
      
      // Support/Resistance
      distanceToHigh: (Math.max(...highs) - current.close) / current.close,
      distanceToLow: (current.close - Math.min(...lows)) / current.close
    };
  }

  /**
   * Model 1: Direction Classifier (Bullish/Bearish)
   * Simple logistic regression-like model
   */
  private static predictDirection(
    data: ChartDataPoint[], 
    features: Record<string, number>
  ): MLPredictions['direction'] {
    // Feature weights (these would be learned from training data)
    const weights = {
      momentum5: 0.35,
      momentum10: 0.25,
      rsi: -0.002, // Inverse relationship (overbought = bearish)
      macd: 0.4,
      volumeRatio: 0.15,
      trendStrength: 0.30,
      meanReversion: -0.10,
      priceChange5: 0.20
    };

    // Calculate weighted score
    let score = 0;
    let totalWeight = 0;

    for (const [feature, weight] of Object.entries(weights)) {
      if (features[feature] !== undefined) {
        score += features[feature] * weight;
        totalWeight += Math.abs(weight);
      }
    }

    // Normalize score to 0-1 range (probability)
    const normalizedScore = (score / totalWeight + 1) / 2;
    const probability = Math.max(0, Math.min(1, normalizedScore));
    
    // Determine prediction
    const prediction = probability > 0.5 ? 'bullish' : 'bearish';
    const signal = probability > 0.5 ? 1 : 0;
    
    // Calculate confidence based on how far from 0.5
    const confidence = Math.abs(probability - 0.5) * 2;

    return {
      prediction,
      probability,
      confidence,
      signal
    };
  }

  /**
   * Model 2: Price Predictor (Regression)
   * Predicts next candle close price
   */
  private static predictPrice(
    data: ChartDataPoint[],
    features: Record<string, number>
  ): MLPredictions['price'] {
    const current = data[data.length - 1];
    const recent = data.slice(-10);
    const prices = recent.map(d => d.close);

    // Simple momentum-based prediction
    const momentum = features.momentum5;
    const volatility = features.volatility5;
    const trend = features.trendStrength;

    // Base prediction: current price + momentum-adjusted change
    let predictedChange = current.close * (momentum * 0.5 + trend * 0.3);
    
    // Adjust for RSI (mean reversion)
    if (features.rsi > 70) {
      predictedChange *= 0.7; // Expect some pullback
    } else if (features.rsi < 30) {
      predictedChange *= 1.3; // Expect bounce
    }

    const predicted = current.close + predictedChange;
    
    // Calculate prediction bounds based on volatility
    const volBand = current.close * volatility * 2;
    const high = predicted + volBand;
    const low = predicted - volBand;
    
    // Confidence based on trend strength and volatility
    const confidence = Math.min(1, Math.abs(trend) * (1 - volatility));
    
    const percentChange = ((predicted - current.close) / current.close) * 100;

    return {
      predicted: Math.max(0, predicted),
      high: Math.max(0, high),
      low: Math.max(0, low),
      confidence,
      percentChange
    };
  }

  /**
   * Model 3: Volatility Predictor
   * Predicts next candle volatility
   */
  private static predictVolatility(
    data: ChartDataPoint[],
    features: Record<string, number>
  ): MLPredictions['volatility'] {
    const currentVol = features.volatility10;
    const atr = features.atr;
    const volumeRatio = features.volumeRatio;

    // Predict volatility as weighted average of recent volatility and volume impact
    let predictedVol = currentVol * 0.7 + (atr / data[data.length - 1].close) * 0.3;
    
    // Volume can increase volatility
    if (volumeRatio > 1.5) {
      predictedVol *= 1.2;
    }

    // Classify volatility level
    let level: 'low' | 'medium' | 'high' | 'extreme';
    if (predictedVol < 0.01) level = 'low';
    else if (predictedVol < 0.02) level = 'medium';
    else if (predictedVol < 0.04) level = 'high';
    else level = 'extreme';

    // Confidence based on consistency of recent volatility
    const volHistory = data.slice(-10).map((d, i, arr) => {
      if (i === 0) return 0;
      return Math.abs((d.close - arr[i - 1].close) / arr[i - 1].close);
    });
    const volStd = this.calculateStandardDeviation(volHistory);
    const confidence = Math.max(0.3, 1 - volStd * 10);

    return {
      predicted: predictedVol,
      level,
      confidence
    };
  }

  /**
   * Model 4: Risk Assessor
   * Evaluates overall risk based on all factors
   */
  private static assessRisk(
    data: ChartDataPoint[],
    features: Record<string, number>,
    direction: MLPredictions['direction'],
    volatility: MLPredictions['volatility']
  ): MLPredictions['risk'] {
    const factors: string[] = [];
    let riskScore = 0;

    // Volatility risk (0-30 points)
    if (volatility.level === 'extreme') {
      riskScore += 30;
      factors.push('Extreme volatility detected');
    } else if (volatility.level === 'high') {
      riskScore += 20;
      factors.push('High volatility');
    } else if (volatility.level === 'medium') {
      riskScore += 10;
    }

    // Trend uncertainty risk (0-20 points)
    if (Math.abs(features.trendStrength) < 0.2) {
      riskScore += 20;
      factors.push('Weak trend - unclear direction');
    } else if (Math.abs(features.trendStrength) < 0.4) {
      riskScore += 10;
    }

    // Prediction confidence risk (0-25 points)
    if (direction.confidence < 0.4) {
      riskScore += 25;
      factors.push('Low prediction confidence');
    } else if (direction.confidence < 0.6) {
      riskScore += 15;
    }

    // RSI extreme risk (0-15 points)
    if (features.rsi > 75 || features.rsi < 25) {
      riskScore += 15;
      factors.push(`RSI at extreme level (${features.rsi.toFixed(0)})`);
    } else if (features.rsi > 70 || features.rsi < 30) {
      riskScore += 8;
    }

    // Volume anomaly risk (0-10 points)
    if (features.volumeRatio > 3) {
      riskScore += 10;
      factors.push('Unusual volume spike');
    } else if (features.volumeRatio < 0.5) {
      riskScore += 5;
      factors.push('Low volume');
    }

    // Classify risk level
    let level: 'low' | 'medium' | 'high' | 'extreme';
    if (riskScore < 25) level = 'low';
    else if (riskScore < 50) level = 'medium';
    else if (riskScore < 75) level = 'high';
    else level = 'extreme';

    if (factors.length === 0) {
      factors.push('Normal market conditions');
    }

    return {
      score: riskScore,
      level,
      factors
    };
  }

  // ============= Helper Methods =============

  private static calculateChange(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    return (current - past) / past;
  }

  private static calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    return (prices[prices.length - 1] - prices[prices.length - 1 - period]) / prices[prices.length - 1 - period];
  }

  private static calculateRateOfChange(prices: number[], period: number): number {
    const changes = [];
    for (let i = 1; i < Math.min(period + 1, prices.length); i++) {
      changes.push((prices[prices.length - i] - prices[prices.length - i - 1]) / prices[prices.length - i - 1]);
    }
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  private static calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const returns = [];
    for (let i = prices.length - period; i < prices.length - 1; i++) {
      returns.push(Math.log(prices[i + 1] / prices[i]));
    }
    return this.calculateStandardDeviation(returns);
  }

  private static calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    const trueRanges = [];
    for (let i = 1; i < Math.min(period + 1, highs.length); i++) {
      const high = highs[highs.length - i];
      const low = lows[lows.length - i];
      const prevClose = closes[closes.length - i - 1];
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  private static calculateTrend(values: number[], period: number): number {
    const recent = values.slice(-Math.min(period, values.length));
    if (recent.length < 2) return 0;
    
    // Simple linear regression slope
    const n = recent.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = recent.reduce((a, b) => a + b, 0);
    const sumXY = recent.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / (sumY / n); // Normalize by mean
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

  private static calculateMeanReversion(prices: number[]): number {
    if (prices.length < 20) return 0;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const current = prices[prices.length - 1];
    const std = this.calculateStandardDeviation(prices);
    return std === 0 ? 0 : (current - mean) / std;
  }

  private static calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}

export default MLPredictionService;

