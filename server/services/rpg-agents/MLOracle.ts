
import { TradingAgent, type AgentSignal, type TradeResult } from './TradingAgent';

export class MLOracle extends TradingAgent {
  // Specialist stats
  prediction_accuracy: number = 0;
  pattern_similarity_score: number = 0;
  ensemble_agreement: number = 0;
  
  constructor(name: string) {
    super(name, 'ML_PREDICTION', 'conservative');
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
