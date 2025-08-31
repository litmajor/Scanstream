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

    const features: number[] = [
      // Price features
      current.price.close,
      (current.price.high - current.price.low) / current.price.close, // Daily range
      (current.price.close - current.price.open) / current.price.open, // Daily return

      // Technical indicators
      current.indicators.rsi / 100,
  current.indicators.macd.macd,
      current.indicators.macd.signal,
      current.indicators.macd.histogram,
      (current.price.close - current.indicators.bb.middle) / (current.indicators.bb.upper - current.indicators.bb.lower),

      // Volume features
      current.volume,
      volumes.reduce((sum, v) => sum + v, 0) / volumes.length, // Average volume
      current.volume / (volumes.reduce((sum, v) => sum + v, 0) / volumes.length), // Volume ratio

      // Order flow features
      current.orderFlow.netFlow / current.volume,
      current.orderFlow.bidVolume / (current.orderFlow.bidVolume + current.orderFlow.askVolume),
      current.orderFlow.largeOrders / current.volume,

      // Market microstructure
      current.marketMicrostructure.spread / current.price.close,
      current.marketMicrostructure.depth / current.volume,
      current.marketMicrostructure.imbalance,
      current.marketMicrostructure.toxicity,

      // Price momentum features
      this.calculateMomentum(prices, 5),
      this.calculateMomentum(prices, 10),
      this.calculateMomentum(prices, 20),

      // Volatility features
      this.calculateVolatility(prices, 10),
      this.calculateVolatility(prices, 20),

      // Trend features
      this.calculateTrendStrength(prices),
      this.calculateMeanReversion(prices, current.price.close)
    ];

    return features.filter(f => !isNaN(f) && isFinite(f));
  }
  
  private static calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - period];
    return (current - past) / past;
  }
  
  private static calculateVolatility(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const recentPrices = prices.slice(-period);
    const returns = recentPrices.slice(1).map((price, i) => 
      Math.log(price / recentPrices[i])
    );
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
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