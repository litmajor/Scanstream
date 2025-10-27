import { Signal } from '@shared/schema';

// Local MarketFrame interface for type safety
interface MarketFrame {
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
    ema20?: number;
    ema50?: number;
    ema200?: number;
    multiEMA?: Record<number, number>;
    stoch_k?: number;
    stoch_d?: number;
    adx?: number;
    vwap?: number;
    atr?: number;
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
    smallOrders?: number;
  };
  marketMicrostructure: {
    spread: number;
    depth: number;
    imbalance: number;
    toxicity: number;
  };
}

export interface MLPrediction {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  horizon: number; // minutes
  features: Record<string, number>;
}

export interface MLModel {
  predict(features: number[]): MLPrediction;
  train(data: MarketFrame[]): Promise<void>;
  getFeatureImportance(): Record<string, number>;
}

export class FeatureExtractor {
  static extractFeatures(frames: MarketFrame[], currentIndex: number): number[] {
    if (currentIndex < 20 || currentIndex >= frames.length) return [];
    
    const current = frames[currentIndex];
    const recent = frames.slice(currentIndex - 20, currentIndex + 1);
    const prices = recent.map(f => f.price.close);
    const volumes = recent.map(f => f.volume);
    const highs = recent.map(f => f.price.high);
    const lows = recent.map(f => f.price.low);

    // === PRICE FEATURES ===
    const priceFeatures = [
      current.price.close,
      current.price.open,
      current.price.high,
      current.price.low,
      (current.price.high - current.price.low) / current.price.close, // Daily range
      (current.price.close - current.price.open) / current.price.open, // Daily return
      (current.price.high - current.price.low) / current.price.open, // Range ratio
    ];

    // === TECHNICAL INDICATORS ===
    const technicalFeatures = [
      current.indicators.rsi / 100, // Normalized RSI
      current.indicators.macd.macd,
      current.indicators.macd.signal,
      current.indicators.macd.histogram,
      (current.price.close - current.indicators.bb.middle) / (current.indicators.bb.upper - current.indicators.bb.lower), // BB position
      (current.indicators.bb.upper - current.indicators.bb.lower) / current.indicators.bb.middle, // BB width
      current.indicators.stoch_k / 100,
      current.indicators.stoch_d / 100,
      current.indicators.adx / 100,
      current.indicators.vwap,
      current.indicators.atr,
      current.indicators.ema20,
      current.indicators.ema50,
      current.indicators.ema200,
      current.price.close / current.indicators.ema20, // Price/EMA ratios
      current.price.close / current.indicators.ema50,
      current.price.close / current.indicators.ema200,
      current.indicators.ema20 / current.indicators.ema50, // EMA relationships
      current.indicators.ema50 / current.indicators.ema200,
    ];

    // === VOLUME FEATURES ===
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const volumeFeatures = [
      current.volume,
      avgVolume,
      current.volume / (avgVolume || 1), // Volume ratio
      current.indicators.volumeRatio || 0,
      Math.max(...volumes) / (Math.min(...volumes) || 1), // Volume volatility
    ];

    // === ORDER FLOW FEATURES (Comprehensive) ===
    const bidAskTotal = current.orderFlow.bidVolume + current.orderFlow.askVolume;
    const orderFlowFeatures = [
      // Basic flow metrics
      current.orderFlow.bidVolume,
      current.orderFlow.askVolume,
      bidAskTotal,
      
      // Net flow metrics
      current.orderFlow.netFlow,
      current.orderFlow.netFlow / (current.volume || 1),
      (current.orderFlow.bidVolume - current.orderFlow.askVolume) / (bidAskTotal || 1), // Bid-ask imbalance
      
      // Order size distribution
      current.orderFlow.largeOrders,
      current.orderFlow.smallOrders || 0,
      current.orderFlow.largeOrders / (current.volume || 1),
      (current.orderFlow.smallOrders || 0) / (current.volume || 1),
      (current.orderFlow.largeOrders || 0) / ((current.orderFlow.smallOrders || 1) || 1), // Large to small ratio
      
      // Bid/ask ratios
      current.orderFlow.bidVolume / (bidAskTotal || 1),
      current.orderFlow.askVolume / (bidAskTotal || 1),
    ];

    // === MARKET MICROSTRUCTURE FEATURES ===
    const microstructureFeatures = [
      // Spread metrics
      current.marketMicrostructure.spread,
      current.marketMicrostructure.spread / current.price.close,
      
      // Depth metrics
      current.marketMicrostructure.depth,
      current.marketMicrostructure.depth / (current.volume || 1),
      
      // Order imbalance
      current.marketMicrostructure.imbalance,
      
      // Market toxicity
      current.marketMicrostructure.toxicity,
    ];

    // === MOMENTUM FEATURES ===
    const momentumFeatures = [
      this.calculateMomentum(prices, 5),
      this.calculateMomentum(prices, 10),
      this.calculateMomentum(prices, 20),
      this.calculateMomentum(prices, 50),
      current.indicators.momentumShort || 0,
      current.indicators.momentumLong || 0,
      current.indicators.mom7d || 0,
      current.indicators.mom30d || 0,
    ];

    // === VOLATILITY FEATURES ===
    const volatilityFeatures = [
      this.calculateVolatility(prices, 5),
      this.calculateVolatility(prices, 10),
      this.calculateVolatility(prices, 20),
      this.calculateATR(highs, lows, prices, 10),
      this.calculateATR(highs, lows, prices, 20),
    ];

    // === TREND FEATURES ===
    const trendFeatures = [
      this.calculateTrendStrength(prices),
      this.calculateMeanReversion(prices, current.price.close),
      this.calculateTrendDirection(prices),
      this.calculateSupportResistance(prices, current.price.close),
    ];

    // === ADDITIONAL EMA FEATURES FROM multiEMA ===
    const emaFeatures: number[] = [];
    if (current.indicators.multiEMA) {
      const emaKeys = Object.keys(current.indicators.multiEMA);
      emaKeys.forEach(key => {
        const emaValue = (current.indicators.multiEMA as Record<string, number>)[key];
        emaFeatures.push(emaValue / current.price.close); // Normalized
      });
    }

    // === ICHIMOKU & OTHER INDICATORS ===
    const indicatorFeatures = [
      current.indicators.ichimoku_bullish ? 1 : 0,
      current.indicators.bbPos || 0,
    ];

    // Combine all features
    const allFeatures = [
      ...priceFeatures,
      ...technicalFeatures,
      ...volumeFeatures,
      ...orderFlowFeatures,
      ...microstructureFeatures,
      ...momentumFeatures,
      ...volatilityFeatures,
      ...trendFeatures,
      ...emaFeatures,
      ...indicatorFeatures,
    ];

    // Filter out invalid values
    return allFeatures.filter(f => !isNaN(f) && isFinite(f));
  }
  
  private static calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    return past === 0 ? 0 : (current - past) / past;
  }
  
  private static calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const recentPrices = prices.slice(-period);
    const returns = recentPrices.slice(1).map((price, i) => 
      recentPrices[i] === 0 ? 0 : Math.log(price / recentPrices[i])
    );
    if (returns.length === 0) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }
  
  private static calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period || lows.length < period || closes.length < period) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < period; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    return trueRanges.length > 0 ? trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length : 0;
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
  
  private static calculateMeanReversion(prices: number[], currentPrice: number): number {
    if (prices.length < 20) return 0;
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const std = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length);
    return std === 0 ? 0 : (currentPrice - mean) / std;
  }
  
  private static calculateTrendDirection(prices: number[]): number {
    if (prices.length < 10) return 0;
    const recent = prices.slice(-10);
    // Linear regression slope
    const n = recent.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = recent.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * recent[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }
  
  private static calculateSupportResistance(prices: number[], currentPrice: number): number {
    if (prices.length < 20) return 0;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const range = maxPrice - minPrice;
    
    if (range === 0) return 0;
    return (currentPrice - minPrice) / range; // Position in range (0-1)
  }
  
  // Feature names for interpretability
  static getFeatureNames(): string[] {
    return [
      // Price features
      'close', 'open', 'high', 'low', 'daily_range', 'daily_return', 'range_ratio',
      // Technical indicators
      'rsi', 'macd', 'macd_signal', 'macd_hist', 'bb_position', 'bb_width',
      'stoch_k', 'stoch_d', 'adx', 'vwap', 'atr',
      'ema20', 'ema50', 'ema200',
      'price_ema20', 'price_ema50', 'price_ema200',
      'ema20_50', 'ema50_200',
      // Volume features
      'volume', 'avg_volume', 'volume_ratio', 'volume_ratio_2', 'volume_volatility',
      // Order flow features
      'bid_volume', 'ask_volume', 'bid_ask_total',
      'net_flow', 'net_flow_ratio', 'bid_ask_imbalance',
      'large_orders', 'small_orders', 'large_orders_ratio', 'small_orders_ratio', 'large_small_ratio',
      'bid_ratio', 'ask_ratio',
      // Microstructure features
      'spread', 'spread_ratio', 'depth', 'depth_ratio', 'imbalance', 'toxicity',
      // Momentum features
      'momentum_5', 'momentum_10', 'momentum_20', 'momentum_50',
      'momentum_short', 'momentum_long', 'mom_7d', 'mom_30d',
      // Volatility features
      'volatility_5', 'volatility_10', 'volatility_20', 'atr_10', 'atr_20',
      // Trend features
      'trend_strength', 'mean_reversion', 'trend_direction', 'support_resistance',
    ];
  }
}

export class SimpleMLModel implements MLModel {
  private weights: number[] = [];
  private bias: number = 0;
  private isTrained: boolean = false;
  private featureImportance: Record<string, number> = {};
  
  predict(features: number[]): MLPrediction {
    if (!this.isTrained || this.weights.length === 0) {
      return {
        direction: 'NEUTRAL',
        confidence: 0.5,
        horizon: 60,
        features: {}
      };
    }
    
    // Simple linear model prediction
    let score = this.bias;
    const minLength = Math.min(features.length, this.weights.length);
    
    for (let i = 0; i < minLength; i++) {
      score += features[i] * this.weights[i];
    }
    
    // Apply activation function (tanh for bounded output)
    const activated = Math.tanh(score);
    const confidence = Math.abs(activated);
    
    let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (activated > 0.1) direction = 'UP';
    else if (activated < -0.1) direction = 'DOWN';
    
    return {
      direction,
      confidence: Math.min(confidence, 1.0),
      horizon: 60,
      features: this.buildFeatureMap(features)
    };
  }
  
  async train(data: MarketFrame[]): Promise<void> {
    if (data.length < 100) return; // Need sufficient data
    
    const trainingData: { features: number[]; label: number }[] = [];
    
    // Prepare training data
    for (let i = 30; i < data.length - 10; i++) {
      const features = FeatureExtractor.extractFeatures(data, i);
      if (features.length === 0) continue;
      
      // Create label based on future price movement
      const currentPrice = data[i].price.close;
      const futurePrice = data[i + 10].price.close; // 10 periods ahead
      const priceChange = (futurePrice - currentPrice) / currentPrice;
      
      let label = 0; // NEUTRAL
      if (priceChange > 0.005) label = 1; // UP (0.5% threshold)
      else if (priceChange < -0.005) label = -1; // DOWN
      
      if (label !== 0) { // Only train on clear directional moves
        trainingData.push({ features, label });
      }
    }
    
    if (trainingData.length === 0) return;
    
    // Initialize weights from production model or database
    const featureCount = trainingData[0].features.length;
    this.weights = await this.getInitialWeights(featureCount);
    this.bias = 0;

    const learningRate = 0.001;
    const epochs = 100;

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      for (const sample of trainingData) {
        // Forward pass
        let prediction = this.bias;
        for (let i = 0; i < sample.features.length && i < this.weights.length; i++) {
          prediction += sample.features[i] * this.weights[i];
        }
        prediction = Math.tanh(prediction);
        // Calculate loss (MSE)
        const error = sample.label - prediction;
        totalLoss += error * error;
        // Backward pass (gradient descent)
        const gradient = error * (1 - prediction * prediction); // tanh derivative
        this.bias += learningRate * gradient;
        for (let i = 0; i < sample.features.length && i < this.weights.length; i++) {
          this.weights[i] += learningRate * gradient * sample.features[i];
        }
      }
      // Early stopping if loss is low enough
      if (totalLoss / trainingData.length < 0.01) break;
    }
    this.isTrained = true;
    this.calculateFeatureImportance(trainingData);
  }

  // Replace with actual DB or model call in production
  private async getInitialWeights(featureCount: number): Promise<number[]> {
    // TODO: Connect to your model registry or database here
    // Example: return await fetchWeightsFromDB(featureCount);
    return new Array(featureCount).fill(0); // Default to zeros
  }
  
  private calculateFeatureImportance(trainingData: { features: number[]; label: number }[]): void {
    const featureNames = [
      'price', 'daily_range', 'daily_return', 'rsi', 'macd_line', 'macd_signal', 'macd_hist',
      'bb_position', 'volume', 'avg_volume', 'volume_ratio', 'net_flow', 'bid_ask_ratio',
      'large_orders', 'spread', 'depth', 'imbalance', 'toxicity', 'momentum_5', 'momentum_10',
      'momentum_20', 'volatility_10', 'volatility_20', 'trend_strength', 'mean_reversion'
    ];
    
    this.featureImportance = {};
    for (let i = 0; i < featureNames.length && i < this.weights.length; i++) {
      this.featureImportance[featureNames[i]] = Math.abs(this.weights[i]);
    }
  }
  
  private buildFeatureMap(features: number[]): Record<string, number> {
    const featureNames = [
      'price', 'daily_range', 'daily_return', 'rsi', 'macd_line', 'macd_signal', 'macd_hist',
      'bb_position', 'volume', 'avg_volume', 'volume_ratio', 'net_flow', 'bid_ask_ratio',
      'large_orders', 'spread', 'depth', 'imbalance', 'toxicity', 'momentum_5', 'momentum_10',
      'momentum_20', 'volatility_10', 'volatility_20', 'trend_strength', 'mean_reversion'
    ];
    
    const featureMap: Record<string, number> = {};
    for (let i = 0; i < featureNames.length && i < features.length; i++) {
      featureMap[featureNames[i]] = features[i];
    }
    return featureMap;
  }
  
  getFeatureImportance(): Record<string, number> {
    return { ...this.featureImportance };
  }
}

export class MLSignalEnhancer {
  private model: MLModel;
  
  constructor() {
    this.model = new SimpleMLModel();
  }
  
  async enhanceSignal(signal: Signal, frames: MarketFrame[], currentIndex: number): Promise<Signal> {
    const features = FeatureExtractor.extractFeatures(frames, currentIndex);
    if (features.length === 0) return signal;
    
    const prediction = this.model.predict(features);
    
    // Enhance signal based on ML prediction
    let enhancedConfidence = signal.confidence;
    let enhancedStrength = signal.strength;
    
    // If ML agrees with signal direction, boost confidence
    if ((signal.type === 'BUY' && prediction.direction === 'UP') ||
        (signal.type === 'SELL' && prediction.direction === 'DOWN')) {
      enhancedConfidence = Math.min(1.0, signal.confidence + (prediction.confidence * 0.3));
      enhancedStrength = Math.min(1.0, signal.strength + (prediction.confidence * 0.2));
    }
    // If ML disagrees, reduce confidence
    else if ((signal.type === 'BUY' && prediction.direction === 'DOWN') ||
             (signal.type === 'SELL' && prediction.direction === 'UP')) {
      enhancedConfidence = Math.max(0.1, signal.confidence - (prediction.confidence * 0.4));
      enhancedStrength = Math.max(0.1, signal.strength - (prediction.confidence * 0.3));
    }
    
    // Add ML reasoning
    const mlReasoning = `ML prediction: ${prediction.direction} (${(prediction.confidence * 100).toFixed(1)}% confidence)`;
    const enhancedReasoning = Array.isArray(signal.reasoning) 
      ? [...signal.reasoning, mlReasoning]
      : [mlReasoning];
    
    return {
      ...signal,
      confidence: enhancedConfidence,
      strength: enhancedStrength,
      reasoning: enhancedReasoning
    };
  }
  
  async trainModel(frames: MarketFrame[]): Promise<void> {
    console.log('Training ML model with', frames.length, 'market frames...');
    await this.model.train(frames);
    console.log('ML model training completed');
  }
  
  getModelInsights(): Record<string, number> {
    return this.model.getFeatureImportance();
  }
}