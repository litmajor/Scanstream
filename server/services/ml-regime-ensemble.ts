
/**
 * Adaptive ML Ensemble with Regime-Specific Models
 * Uses different prediction strategies for different market conditions
 * PHASE 2: Unified regime system integration with parallel detection
 */

import { MLPrediction, MLModel, FeatureExtractor } from '../ml-engine';
import { UnifiedRegimeDetector, type UnifiedRegimeType } from './unified-regime-system';
import { RegimeConsolidationBridge } from './regime-consolidation-bridge';

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
  unifiedRegime?: UnifiedRegimeType;
  unifiedConfidence?: number;
}

/**
 * Adaptive ML Ensemble with Regime-Specific Models
 * Uses different prediction strategies for different market conditions
 * PHASE 2: Unified regime system integration with parallel detection
 */
export class RegimeSpecificMLEnsemble implements MLModel {
  private trendingModel: MLModel;
  private choppyModel: MLModel;
  private volatileModel: MLModel;
  private isTrained: boolean = false;
  
  // PHASE 2: Unified regime system integration
  private divergenceLog: Array<{
    timestamp: number;
    legacy: 'TRENDING' | 'CHOPPY' | 'VOLATILE';
    unified: UnifiedRegimeType;
    match: boolean;
  }> = [];
  private readonly MAX_DIVERGENCE_LOG = 500;

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
   * Classify current market regime (Legacy)
   */
  private classifyRegimeLegacy(features: number[], frames: MarketFrame[]): RegimeClassification {
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
   * Classify current market regime
   * PHASE 2: Runs both legacy and unified detection in parallel
   */
  private classifyRegime(features: number[], frames: MarketFrame[]): RegimeClassification {
    // PHASE 2: Run legacy classification
    const legacyRegime = this.classifyRegimeLegacy(features, frames);
    
    // PHASE 2: Run unified detection in parallel
    const unifiedResult = this.classifyRegimeUnified(frames);
    
    // PHASE 2: Log divergence
    const matches = legacyRegime.regime === this.mapUnifiedToLegacy(unifiedResult.regime);
    this.divergenceLog.push({
      timestamp: Date.now(),
      legacy: legacyRegime.regime,
      unified: unifiedResult.regime,
      match: matches
    });
    
    // Maintain max log size
    if (this.divergenceLog.length > this.MAX_DIVERGENCE_LOG) {
      this.divergenceLog.shift();
    }
    
    // Return legacy regime + unified fields
    return {
      ...legacyRegime,
      unifiedRegime: unifiedResult.regime,
      unifiedConfidence: unifiedResult.confidence
    };
  }

  /**
   * PHASE 2: Unified regime detection
   * Maps ML ensemble metrics to unified detection parameters
   */
  private classifyRegimeUnified(frames: MarketFrame[]): { regime: UnifiedRegimeType; confidence: number } {
    if (frames.length < 10) {
      return { regime: 'RANGING', confidence: 0.5 };
    }

    const lastFrame = frames[frames.length - 1];
    const adx = lastFrame.indicators?.adx || 25;
    
    // Calculate volatility
    const prices = frames.slice(-20).map(f => 
      typeof f.price === 'number' ? f.price : f.price.close
    );
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Map to unified parameters
    const unifiedParams = {
      adx,                                          // Direct: 0-100
      volatility,                                   // Direct: volatility
      divergence: Math.abs(volatility - 0.02),     // Divergence from baseline
      coherence: 0.7,                               // Fixed coherence for ML ensemble
      momentum: 0,                                  // Not available in legacy ML ensemble
      priceVsMA: 0,                                 // Not available in legacy ML ensemble
      rangeWidth: volatility * 2,                   // Approximate from volatility
      compression: volatility < 0.01 ? 0.2 : 0.8   // Low if compression phase
    };

    return UnifiedRegimeDetector.detectRegime(unifiedParams);
  }

  /**
   * PHASE 2: Map unified regime back to legacy regime using bridge
   * Uses toRouter since ensemble doesn't have direct mapping
   */
  private mapUnifiedToLegacy(unifiedRegime: UnifiedRegimeType): 'TRENDING' | 'CHOPPY' | 'VOLATILE' {
    const legacyRouter = RegimeConsolidationBridge.toRouter(unifiedRegime);
    // Map router format to ensemble format (TRENDING/SIDEWAYS/HIGH_VOLATILITY)
    if (legacyRouter === 'TRENDING' || legacyRouter === 'BREAKOUT') return 'TRENDING';
    if (legacyRouter === 'HIGH_VOLATILITY') return 'VOLATILE';
    return 'CHOPPY'; // SIDEWAYS, QUIET → CHOPPY
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
        regime: (regime.regime as any) || 'UNKNOWN',
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
      const features = FeatureExtractor.extractFeatures(data as any, i);
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
    console.log(`[RegimeEnsemble] Training models: Trending: ${trendingData.length} samples, Choppy: ${choppyData.length} samples, Volatile: ${volatileData.length} samples`);

    if (trendingData.length > 30) {
      await this.trendingModel.train(trendingData as any);
    }
    if (choppyData.length > 30) {
      await this.choppyModel.train(choppyData as any);
    }
    if (volatileData.length > 30) {
      await this.volatileModel.train(volatileData as any);
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

  /**
   * PHASE 2: Get divergence statistics for validation
   */
  getDivergenceStats(): {
    totalSamples: number;
    matchingDetections: number;
    matchPercentage: number;
    recentDivergences: Array<{ timestamp: number; legacy: string; unified: string }>;
  } {
    if (this.divergenceLog.length === 0) {
      return {
        totalSamples: 0,
        matchingDetections: 0,
        matchPercentage: 0,
        recentDivergences: []
      };
    }
    
    const matchingDetections = this.divergenceLog.filter(d => d.match).length;
    const matchPercentage = (matchingDetections / this.divergenceLog.length) * 100;
    
    const recentDivergences = this.divergenceLog
      .filter(d => !d.match)
      .slice(-5)
      .map(d => ({
        timestamp: d.timestamp,
        legacy: d.legacy,
        unified: d.unified
      }));
    
    return {
      totalSamples: this.divergenceLog.length,
      matchingDetections,
      matchPercentage,
      recentDivergences
    };
  }
}
