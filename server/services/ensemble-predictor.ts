/**
 * Ensemble Predictor
 * 
 * Combines multiple ML models for improved predictions:
 * 1. Direction Classifier
 * 2. Price Predictor
 * 3. Volatility Predictor
 * 4. Risk Assessor
 * 5. RL Position Agent recommendations
 */

import MLPredictionService from './ml-predictions';

export interface EnsemblePrediction {
  direction: {
    prediction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    votes: { UP: number; DOWN: number; NEUTRAL: number };
    modelAgreement: number; // % of models agreeing
  };
  price: {
    predicted: number;
    high: number;
    low: number;
    confidence: number;
  };
  volatility: {
    predicted: number;
    level: 'low' | 'medium' | 'high' | 'extreme';
    confidence: number;
  };
  position: {
    sizeMultiplier: number;
    riskReward: number;
    confidence: number;
  };
  risk: {
    score: number;
    level: 'low' | 'medium' | 'high' | 'extreme';
    factors: string[];
  };
  ensembleScore: number; // Weighted confidence across all models
  recommendation: {
    action: 'BUY' | 'SELL' | 'HOLD';
    strength: number; // 0-100
    reason: string;
  };
  metadata: {
    timestamp: number;
    modelCount: number;
    averageModelConfidence: number;
    consensusLevel: string; // 'strong', 'moderate', 'weak'
  };
}

export class EnsemblePredictor {
  /**
   * Generate ensemble prediction combining all models
   */
  static async generateEnsemblePrediction(
    chartData: any[]
  ): Promise<EnsemblePrediction> {
    if (chartData.length < 20) {
      throw new Error('Insufficient data for ensemble predictions (minimum 20 candles required)');
    }

    // Get individual model predictions
    const mlPredictions = await MLPredictionService.generatePredictions(chartData);

    // Direction voting
    const directionVotes = {
      UP: 0,
      DOWN: 0,
      NEUTRAL: 0
    };

    // Model 1: Direction Classifier (weight: 0.35)
    if (mlPredictions.direction.prediction === 'bullish') {
      directionVotes.UP += 0.35;
    } else {
      directionVotes.DOWN += 0.35;
    }

    // Model 2: Price Predictor (weight: 0.25)
    const currentPrice = chartData[chartData.length - 1].close;
    if (mlPredictions.price.predicted > currentPrice) {
      directionVotes.UP += 0.25;
    } else {
      directionVotes.DOWN += 0.25;
    }

    // Model 3: Volatility-informed direction (weight: 0.15)
    if (mlPredictions.volatility.level === 'low' || mlPredictions.volatility.level === 'medium') {
      // In low volatility, bias towards ML direction
      if (mlPredictions.direction.prediction === 'bullish') {
        directionVotes.UP += 0.15;
      } else {
        directionVotes.DOWN += 0.15;
      }
    }

    // Model 4: Risk-adjusted direction (weight: 0.15)
    if (mlPredictions.risk.level !== 'extreme') {
      if (mlPredictions.direction.prediction === 'bullish') {
        directionVotes.UP += 0.15;
      } else {
        directionVotes.DOWN += 0.15;
      }
    }

    // Model 5: Holding period consistency (weight: 0.10)
    if (mlPredictions.holdingPeriod.candles > 4) {
      if (mlPredictions.direction.prediction === 'bullish') {
        directionVotes.UP += 0.10;
      } else {
        directionVotes.DOWN += 0.10;
      }
    }

    // Determine final direction
    const totalVotes = directionVotes.UP + directionVotes.DOWN + directionVotes.NEUTRAL;
    const upPercentage = (directionVotes.UP / totalVotes) * 100;
    const downPercentage = (directionVotes.DOWN / totalVotes) * 100;

    let finalDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (upPercentage > 55) finalDirection = 'UP';
    else if (downPercentage > 55) finalDirection = 'DOWN';

    // Model agreement metric
    const modelAgreement = Math.max(upPercentage, downPercentage);

    // Ensemble confidence
    const directionConfidence = mlPredictions.direction.confidence * 0.4 + 
                               (modelAgreement / 100) * 0.6;

    // Position sizing from volatility and confidence
    let sizeMultiplier = 1.0;
    if (mlPredictions.volatility.level === 'low' && directionConfidence > 0.75) {
      sizeMultiplier = 1.5; // Increase size in low vol with high confidence
    } else if (mlPredictions.volatility.level === 'extreme' || directionConfidence < 0.5) {
      sizeMultiplier = 0.5; // Reduce size in extreme vol or low confidence
    }

    // Risk-reward calculation
    const riskReward = mlPredictions.holdingPeriod.candles > 0 
      ? Math.max(1.5, mlPredictions.price.percentChange * 100 / (mlPredictions.volatility.predicted || 1))
      : 1.5;

    // Generate recommendation
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    let reason = '';

    if (finalDirection === 'UP' && directionConfidence > 0.65) {
      action = 'BUY';
      strength = Math.min(100, directionConfidence * 100);
      reason = `Strong buy signal with ${modelAgreement.toFixed(1)}% model agreement. Risk level: ${mlPredictions.risk.level}`;
    } else if (finalDirection === 'DOWN' && directionConfidence > 0.65) {
      action = 'SELL';
      strength = Math.min(100, directionConfidence * 100);
      reason = `Strong sell signal with ${modelAgreement.toFixed(1)}% model agreement. Risk level: ${mlPredictions.risk.level}`;
    } else if (modelAgreement > 60) {
      action = 'HOLD';
      strength = Math.min(80, modelAgreement);
      reason = `Moderate confidence in ${finalDirection} direction. Wait for better entry.`;
    } else {
      reason = 'Insufficient model consensus. Waiting for clearer signals.';
    }

    // Consensus level
    let consensusLevel = 'weak';
    if (modelAgreement > 75) consensusLevel = 'strong';
    else if (modelAgreement > 60) consensusLevel = 'moderate';

    return {
      direction: {
        prediction: finalDirection,
        confidence: directionConfidence,
        votes: directionVotes,
        modelAgreement
      },
      price: {
        predicted: mlPredictions.price.predicted,
        high: mlPredictions.price.high,
        low: mlPredictions.price.low,
        confidence: mlPredictions.price.confidence
      },
      volatility: {
        predicted: mlPredictions.volatility.predicted,
        level: mlPredictions.volatility.level,
        confidence: mlPredictions.volatility.confidence
      },
      position: {
        sizeMultiplier,
        riskReward,
        confidence: directionConfidence
      },
      risk: mlPredictions.risk,
      ensembleScore: (directionConfidence + 
                     mlPredictions.price.confidence + 
                     mlPredictions.volatility.confidence) / 3,
      recommendation: {
        action,
        strength,
        reason
      },
      metadata: {
        timestamp: Date.now(),
        modelCount: 5,
        averageModelConfidence: (directionConfidence + 
                               mlPredictions.price.confidence + 
                               mlPredictions.volatility.confidence +
                               (1 - mlPredictions.risk.score / 100) +
                               mlPredictions.holdingPeriod.confidence) / 5,
        consensusLevel
      }
    };
  }
}

export default EnsemblePredictor;
