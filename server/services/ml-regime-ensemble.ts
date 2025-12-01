
import { MLPrediction, MLModel, FeatureExtractor } from '../ml-engine';

interface MarketFrame {
  timestamp: Date | string;
  symbol: string;
  price: number | { open: number; high: number; low: number; close: number };
  volume: number;
  indicators: any;
  orderFlow: any;
  marketMicrostructure: any;
}

interface RegimeClassification {
  regime: 'TRENDING' | 'CHOPPY' | 'VOLATILE';
  confidence: number;
  adx: number;
  volatility: number;
}

/**
 * Adaptive ML Ensemble with Regime-Specific Models
 * Uses different prediction strategies for different market conditions
 */
export class RegimeSpecificMLEnsemble implements MLModel {
  private trendingModel: MLModel;
  private choppyModel: MLModel;
  private volatileModel: MLModel;
  private isTrained: boolean = false;

  constructor() {
    // Initialize separate models for each regime
    // These will be trained on regime-specific data
    this.trendingModel = this.createSimpleModel();
    this.choppyModel = this.createSimpleModel();
    this.volatileModel = this.createSimpleModel();
  }

  private createSimpleModel(): MLModel {
    return {
      predict: (features: number[]) => ({
        direction: 'NEUTRAL' as const,
        confidence: 0.5,
        horizon: 60,
        features: {}
      }),
      train: async (data: MarketFrame[]) => {},
      getFeatureImportance: () => ({})
    };
  }

  /**
   * Classify current market regime
   */
  private classifyRegime(features: number[], frames: MarketFrame[]): RegimeClassification {
    if (frames.length < 10) {
      return { regime: 'CHOPPY', confidence: 0.5, adx: 25, volatility: 0.02 };
    }

    const lastFrame = frames[frames.length - 1];
    const adx = lastFrame.indicators?.adx || 25;
    
    // Calculate volatility from recent price movements
    const prices = frames.slice(-20).map(f => 
      typeof f.price === 'number' ? f.price : f.price.close
    );
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Regime classification logic
    if (adx > 40 && volatility < 0.03) {
      return { regime: 'TRENDING', confidence: 0.85, adx, volatility };
    } else if (volatility > 0.05) {
      return { regime: 'VOLATILE', confidence: 0.75, adx, volatility };
    } else {
      return { regime: 'CHOPPY', confidence: 0.70, adx, volatility };
    }
  }

  /**
   * Predict using regime-specific model
   */
  predict(features: number[], frames?: MarketFrame[]): MLPrediction {
    if (!this.isTrained || !frames || frames.length === 0) {
      return {
        direction: 'NEUTRAL',
        confidence: 0.5,
        horizon: 60,
        features: {}
      };
    }

    // Classify regime
    const regime = this.classifyRegime(features, frames);

    // Select appropriate model
    let model: MLModel;
    let confidenceBoost: number;

    switch (regime.regime) {
      case 'TRENDING':
        model = this.trendingModel;
        confidenceBoost = 1.15; // Boost confidence in trending markets
        break;
      case 'CHOPPY':
        model = this.choppyModel;
        confidenceBoost = 0.85; // Reduce confidence in choppy markets
        break;
      case 'VOLATILE':
        model = this.volatileModel;
        confidenceBoost = 0.95; // Slightly reduce in volatile
        break;
    }

    // Get prediction from regime-specific model
    const prediction = model.predict(features);

    // Apply confidence adjustment
    const adjustedConfidence = Math.min(1.0, prediction.confidence * confidenceBoost);

    return {
      ...prediction,
      confidence: adjustedConfidence,
      features: {
        ...prediction.features,
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        adx: regime.adx,
        volatility: regime.volatility
      }
    };
  }

  /**
   * Train regime-specific models
   */
  async train(data: MarketFrame[]): Promise<void> {
    if (data.length < 100) return;

    // Separate data by regime
    const trendingData: MarketFrame[] = [];
    const choppyData: MarketFrame[] = [];
    const volatileData: MarketFrame[] = [];

    for (let i = 20; i < data.length; i++) {
      const window = data.slice(i - 20, i);
      const features = FeatureExtractor.extractFeatures(data, i);
      if (features.length === 0) continue;

      const regime = this.classifyRegime(features, window);

      switch (regime.regime) {
        case 'TRENDING':
          trendingData.push(data[i]);
          break;
        case 'CHOPPY':
          choppyData.push(data[i]);
          break;
        case 'VOLATILE':
          volatileData.push(data[i]);
          break;
      }
    }

    // Train each model on its regime-specific data
    console.log(`[RegimeEnsemble] Training models:
      Trending: ${trendingData.length} samples
      Choppy: ${choppyData.length} samples
      Volatile: ${volatileData.length} samples`);

    if (trendingData.length > 30) {
      await this.trendingModel.train(trendingData);
    }
    if (choppyData.length > 30) {
      await this.choppyModel.train(choppyData);
    }
    if (volatileData.length > 30) {
      await this.volatileModel.train(volatileData);
    }

    this.isTrained = true;
  }

  getFeatureImportance(): Record<string, number> {
    // Combine feature importance from all models
    const trendingImp = this.trendingModel.getFeatureImportance();
    const choppyImp = this.choppyModel.getFeatureImportance();
    const volatileImp = this.volatileModel.getFeatureImportance();

    const combined: Record<string, number> = {};
    const allKeys = new Set([
      ...Object.keys(trendingImp),
      ...Object.keys(choppyImp),
      ...Object.keys(volatileImp)
    ]);

    for (const key of allKeys) {
      const avg = ((trendingImp[key] || 0) + (choppyImp[key] || 0) + (volatileImp[key] || 0)) / 3;
      combined[key] = avg;
    }

    return combined;
  }
}
