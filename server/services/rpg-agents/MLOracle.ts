
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';
import { VolumeMechanicalVerifierAgent } from './VolumeMechanicalVerifierAgent';

export interface RegimeModel {
  regime: string;
  modelType: string;
  accuracy: number;
  predictions: number;
  lastUpdated: Date;
}

export class MLOracle extends TradingAgent {
  // Specialist stats
  prediction_accuracy: number = 0;
  pattern_similarity_score: number = 0;
  ensemble_agreement: number = 0;
  
  // Regime-specific models (ENSEMBLE ARCHITECTURE)
  private models = new Map<string, RegimeModel>();
  private volumeAgent: VolumeMechanicalVerifierAgent | null = null;
  
  constructor(name: string) {
    super(name, 'ML_PREDICTION', 'conservative');
    this.initializeRegimeModels();
  }

  /**
   * Initialize regime-specific models
   * Each regime (CONSOLIDATION, TRENDING, DISTRIBUTION, etc.) gets its own trained model
   */
  private initializeRegimeModels(): void {
    const regimes = ['CONSOLIDATION', 'TRENDING_UP', 'TRENDING_DOWN', 'DISTRIBUTION', 'ACCUMULATION', 'VOLATILE'];
    
    for (const regime of regimes) {
      this.models.set(regime, {
        regime,
        modelType: 'gradient_boosted_trees', // Replace with your actual model
        accuracy: 0.55, // Default baseline
        predictions: 0,
        lastUpdated: new Date()
      });
    }
    
    console.log(`🧠 MLOracle initialized with ${this.models.size} regime-specific ensemble models`);
  }

  /**
   * Set volume agent reference for hierarchical validation
   */
  setVolumeAgent(agent: VolumeMechanicalVerifierAgent): void {
    this.volumeAgent = agent;
  }

  /**
   * Predict using regime-specific ensemble
   * Returns confidence 0-1 where 1 = "definitely BUY" and 0 = "definitely SELL"
   */
  predict(marketData: any): number {
    const regime = marketData.regime || 'UNKNOWN';
    let model = this.models.get(regime);

    // Fallback to CONSOLIDATION model if regime unknown
    if (!model) {
      model = this.models.get('CONSOLIDATION')!;
    }

    // Volume pre-filter (HIERARCHICAL GATE): Use volume agent as truth layer
    if (this.volumeAgent && marketData) {
      const testSignal = { action: 'BUY', confidence: 0.8 };
      const volumeMultiplier = this.volumeAgent.validateOtherSignal(testSignal, marketData);
      
      if (volumeMultiplier < 0.5) {
        // Volume agent says "be cautious" - reduce ML confidence
        return 0.4; // Conservative 40% confidence
      }
    }

    // Call trained model for this regime
    const baseConfidence = this.trainRegimeSpecificModel(regime, marketData.history || []);
    
    // Boost confidence if ensemble agreement is high
    if (marketData.ensemble_confidence && marketData.ensemble_confidence > 0.8) {
      return Math.min(0.95, baseConfidence * 1.2);
    }
    
    return baseConfidence;
  }

  /**
   * Train or update regime-specific model
   * In production, this would use gradient-boosted trees, neural nets, or LightGBM
   */
  private trainRegimeSpecificModel(regime: string, history: any[]): number {
    const model = this.models.get(regime);
    if (!model) return 0.55; // Default if model not found

    // Increment prediction count for this regime
    model.predictions += 1;
    model.lastUpdated = new Date();

    // Extract features from market history (simplified example)
    const features = this.extractFeatures(regime, history);
    
    // In production: return actual model.predict(features)
    // For now: implement smart baseline logic
    let prediction = 0.55;
    
    if (regime === 'TRENDING_UP') {
      prediction = features.momentum > 0.6 ? 0.75 : 0.55;
    } else if (regime === 'TRENDING_DOWN') {
      prediction = features.momentum < 0.4 ? 0.25 : 0.45;
    } else if (regime === 'CONSOLIDATION') {
      // In consolidation: mean reversion often works
      prediction = features.rsi < 0.3 ? 0.7 : (features.rsi > 0.7 ? 0.3 : 0.5);
    } else if (regime === 'VOLATILE') {
      // Volatility requires more caution, stick with ensemble agreement
      prediction = 0.5 + (features.ensemble * 0.3);
    }

    return Math.max(0, Math.min(1, prediction));
  }

  /**
   * Extract normalized features for ML models
   */
  private extractFeatures(regime: string, history: any[]): any {
    // Simplified feature extraction - replace with your full pipeline
    return {
      momentum: 0.55,
      rsi: 0.5,
      ensemble: 0.65,
      volume_ratio: 1.2,
      volatility_regime: regime
    };
  }

  /**
   * Update model accuracy based on trade results
   */
  updateModelAccuracy(regime: string, wasCorrect: boolean): void {
    const model = this.models.get(regime);
    if (!model) return;

    const oldAccuracy = model.accuracy;
    // Exponential moving average of accuracy
    model.accuracy = (oldAccuracy * 0.9) + (wasCorrect ? 1 : 0) * 0.1;
    model.lastUpdated = new Date();
    
    console.log(`📊 MLOracle [${regime}] accuracy: ${oldAccuracy.toFixed(2)} → ${model.accuracy.toFixed(2)}`);
  }

  /**
   * Get all regime models metadata
   */
  getModelMetadata(): RegimeModel[] {
    return Array.from(this.models.values());
  }
  
  /**
   * Use ML predictions from ensemble models (LSTM, Transformer, etc.)
   */
  processSignal(marketData: any): AgentSignal | null {
    const { ml_prediction, price, atr, regime } = marketData;
    
    if (!ml_prediction) return null;
    
    const { direction, probability, ensemble_confidence, pattern_similarity } = ml_prediction;
    
    // Require high ML confidence
    if (probability < 0.65) return null;
    
    // Calculate signal quality
    let quality = probability;
    
    // Ensemble agreement bonus
    if (ensemble_confidence > 0.8) quality += 0.1;
    
    // Pattern similarity bonus (if similar to past winners)
    if (pattern_similarity > 0.85) quality += 0.15;
    
    // Skill enhancement
    quality *= (this.skills.pattern_recognition / 10);
    
    // Regime awareness
    if (this.abilities.includes('regime_adaptation')) {
      if (regime === 'VOLATILE' || regime === 'HIGH_VOL') {
        quality *= 1.2; // ML excels in volatile conditions
      }
    }
    
    if (quality < 0.7) return null;
    
    const target = this.calculateTarget(marketData, direction);
    const stop = this.calculateStop(marketData, direction);
    
    return {
      action: direction === 'UP' ? 'BUY' : 'SELL',
      confidence: quality * this.confidence,
      entry: price,
      target,
      stop,
      reason: `ML Ensemble: ${(probability * 100).toFixed(0)}% ${direction}, pattern match ${(pattern_similarity * 100).toFixed(0)}%`,
      agent_name: this.name,
      agent_level: this.level
    };
  }
  
  private calculateTarget(data: any, direction: string): number {
    const { price, ml_prediction } = data;
    
    if (this.abilities.includes('velocity_based_targets')) {
      // Use ML predicted price target
      return ml_prediction.predicted_price || price * (direction === 'UP' ? 1.03 : 0.97);
    } else {
      return price * (direction === 'UP' ? 1.025 : 0.975);
    }
  }
  
  private calculateStop(data: any, direction: string): number {
    const { price, atr } = data;
    const risk_skill = this.skills.risk_management / 10;
    
    const stop_distance = atr * (1.5 - risk_skill * 0.3);
    
    return direction === 'UP' 
      ? price - stop_distance 
      : price + stop_distance;
  }
}
