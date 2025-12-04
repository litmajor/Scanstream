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
  trendDirection: {
    direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    alignment: number; // % alignment with direction prediction
    alignmentMultiplier: number; // For position sizing
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
  ensembleScore: number; // Weighted confidence across all models (0-1)
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
    backtestKey?: string; // For backtest logging
    debugTrace?: Record<string, any>;
  };
}

export class EnsemblePredictor {
  /**
   * Clamp value between min and max
   */
  private static clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * Map model direction label to canonical format
   * Handles 'bullish', 'bearish', 'neutral', 'up', 'down', 'long', 'short'
   */
  private static mapDirectionLabel(label: string): 'UP' | 'DOWN' | 'NEUTRAL' {
    const l = (label || '').toString().toLowerCase().trim();
    if (l.includes('bull') || l === 'up' || l === 'long') return 'UP';
    if (l.includes('bear') || l === 'down' || l === 'short') return 'DOWN';
    return 'NEUTRAL';
  }

  /**
   * Map trend direction (from regimeData or external source)
   */
  private static mapTrendDirection(trend: string): 'BULLISH' | 'BEARISH' | 'SIDEWAYS' {
    const t = (trend || '').toString().toLowerCase().trim();
    if (t === 'up' || t === 'bullish' || t === 'bull') return 'BULLISH';
    if (t === 'down' || t === 'bearish' || t === 'bear') return 'BEARISH';
    return 'SIDEWAYS';
  }

  /**
   * Get trend alignment multiplier for position sizing
   * Boosts aligned trades, reduces counter-trend trades
   */
  private static getTrendAlignmentMultiplier(
    directionPrediction: 'UP' | 'DOWN' | 'NEUTRAL',
    trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS'
  ): number {
    // Aligned: prediction matches trend direction
    if ((directionPrediction === 'UP' && trendDirection === 'BULLISH') ||
        (directionPrediction === 'DOWN' && trendDirection === 'BEARISH')) {
      return 1.4; // 40% boost
    }
    // Counter-trend: prediction opposes trend
    if ((directionPrediction === 'UP' && trendDirection === 'BEARISH') ||
        (directionPrediction === 'DOWN' && trendDirection === 'BULLISH')) {
      return 0.6; // 40% reduction
    }
    // Sideways or neutral: no adjustment
    return 1.0;
  }

  /**
   * Generate ensemble prediction combining all models
   */
  static async generateEnsemblePrediction(
    chartData: any[],
    trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS'
  ): Promise<EnsemblePrediction> {
    if (chartData.length < 20) {
      throw new Error('Insufficient data for ensemble predictions (minimum 20 candles required)');
    }

    // Get individual model predictions
    const mlPredictions = await MLPredictionService.generatePredictions(chartData);

    // Validate and extract current price
    const currentPrice = chartData[chartData.length - 1]?.close;
    if (!currentPrice || Number.isNaN(currentPrice)) {
      throw new Error('Invalid or missing current price in chartData');
    }

    // Map model outputs to canonical format
    const modelDirection = this.mapDirectionLabel(mlPredictions.direction?.prediction as string);

    // Direction voting with neutral support
    const directionVotes = {
      UP: 0,
      DOWN: 0,
      NEUTRAL: 0
    };

    // Model 1: Direction Classifier (weight: 0.35)
    if (modelDirection === 'UP') {
      directionVotes.UP += 0.35;
    } else if (modelDirection === 'DOWN') {
      directionVotes.DOWN += 0.35;
    } else {
      directionVotes.NEUTRAL += 0.35;
    }

    // Model 2: Price Predictor (weight: 0.25)
    const pricePredicted = mlPredictions.price?.predicted ?? currentPrice;
    if (pricePredicted > currentPrice) {
      directionVotes.UP += 0.25;
    } else if (pricePredicted < currentPrice) {
      directionVotes.DOWN += 0.25;
    } else {
      directionVotes.NEUTRAL += 0.25;
    }

    // Model 3: Volatility-informed direction (weight: 0.15)
    const volLevel = (mlPredictions.volatility?.level || 'medium').toLowerCase();
    if (volLevel === 'low' || volLevel === 'medium') {
      // In low volatility, lean into model direction
      directionVotes[modelDirection] += 0.15;
    } else {
      // In high/extreme volatility, bias slightly neutral for caution
      directionVotes.NEUTRAL += 0.15;
    }

    // Model 4: Risk-adjusted direction (weight: 0.15)
    if ((mlPredictions.risk?.level || 'medium') !== 'extreme') {
      directionVotes[modelDirection] += 0.15;
    } else {
      // Extreme risk → reduce direction push
      directionVotes.NEUTRAL += 0.15;
    }

    // Model 5: Holding period consistency (weight: 0.10)
    if ((mlPredictions.holdingPeriod?.candles ?? 0) > 4) {
      directionVotes[modelDirection] += 0.10;
    } else {
      directionVotes.NEUTRAL += 0.10;
    }

    // Finalize vote counts and compute percentages
    const totalVotes = (directionVotes.UP + directionVotes.DOWN + directionVotes.NEUTRAL) || 1e-9;
    const upPct = (directionVotes.UP / totalVotes) * 100;
    const downPct = (directionVotes.DOWN / totalVotes) * 100;
    const neutralPct = (directionVotes.NEUTRAL / totalVotes) * 100;

    // Determine final direction with threshold
    let finalDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    if (upPct > 55) {
      finalDirection = 'UP';
    } else if (downPct > 55) {
      finalDirection = 'DOWN';
    }

    // Model agreement: weighted agreement for the chosen direction
    const modelAgreement =
      finalDirection === 'UP' ? upPct :
      finalDirection === 'DOWN' ? downPct : neutralPct;

    // Direction confidence: blend model confidence (40%) with agreement (60%)
    const dirModelConf = this.clamp(mlPredictions.direction?.confidence ?? 0.5, 0, 1);
    const directionConfidence = this.clamp(
      (dirModelConf * 0.4) + ((modelAgreement / 100) * 0.6),
      0,
      1
    );

    // Volatility factor mapping: reduces sizing in high volatility
    const volMap: Record<string, number> = {
      'low': 1.2,
      'medium': 1.0,
      'high': 0.8,
      'extreme': 0.6
    };
    const volatilityFactor = volMap[volLevel] ?? 1.0;

    // Size multiplier: continuous mapping from confidence to [0.4, 2.5]
    // Base scale maps confidence [0, 1] → [0.5, 1.8], then apply volatility factor
    const baseScale = 0.5 + (directionConfidence * (1.8 - 0.5));
    const sizeMultiplierBefore = this.clamp(baseScale * volatilityFactor, 0.4, 2.5);

    // Apply trend alignment multiplier (1.4x boost for aligned, 0.6x for counter-trend)
    const trendAlignmentMult = this.getTrendAlignmentMultiplier(finalDirection, trendDirection);
    const sizeMultiplier = this.clamp(sizeMultiplierBefore * trendAlignmentMult, 0.3, 3.0);

    // Calculate trend alignment % (how well direction matches trend)
    let trendAlignment = 0;
    if ((finalDirection === 'UP' && trendDirection === 'BULLISH') ||
        (finalDirection === 'DOWN' && trendDirection === 'BEARISH')) {
      trendAlignment = modelAgreement; // Full agreement when aligned
    } else if ((finalDirection === 'UP' && trendDirection === 'BEARISH') ||
               (finalDirection === 'DOWN' && trendDirection === 'BULLISH')) {
      trendAlignment = 100 - modelAgreement; // Inverse agreement when opposed
    } else {
      trendAlignment = 50; // Neutral for sideways
    }

    // Risk/reward calculation with guards
    const pctChange = mlPredictions.price?.changePercent ??
      ((pricePredicted - currentPrice) / currentPrice);
    const volPredicted = (mlPredictions.volatility?.predicted ?? 1) || 1;
    const riskReward = this.clamp(
      (mlPredictions.holdingPeriod?.candles ?? 0) > 0
        ? Math.max(1.2, (Math.abs(pctChange) * 100) / volPredicted)
        : 1.2,
      1.2,
      10 // Cap extreme R:R ratios
    );

    // Ensemble score: normalized weighted blend of all model confidences
    const priceConf = this.clamp(mlPredictions.price?.changePercent ?? 0.5, 0, 1);
    const volConf = this.clamp(mlPredictions.volatility?.confidence ?? 0.5, 0, 1);
    const riskScore = this.clamp(mlPredictions.risk?.score ?? 50, 0, 100);
    const riskConf = 1 - (riskScore / 100);

    const ensembleScore = this.clamp(
      (directionConfidence * 0.4) + (priceConf * 0.35) + (volConf * 0.2) + (riskConf * 0.05),
      0,
      1
    );

    // Generate recommendation with stricter thresholds
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    let reason = '';

    if (
      finalDirection === 'UP' &&
      directionConfidence > 0.6 &&
      ensembleScore > 0.55 &&
      modelAgreement > 60
    ) {
      action = 'BUY';
      strength = Math.round(Math.min(100, ensembleScore * 100 * (modelAgreement / 100)));
      reason = `BUY — ${modelAgreement.toFixed(1)}% agreement, ${(ensembleScore * 100).toFixed(1)}% ensemble score, ${trendDirection} trend`;
    } else if (
      finalDirection === 'DOWN' &&
      directionConfidence > 0.6 &&
      ensembleScore > 0.55 &&
      modelAgreement > 60
    ) {
      action = 'SELL';
      strength = Math.round(Math.min(100, ensembleScore * 100 * (modelAgreement / 100)));
      reason = `SELL — ${modelAgreement.toFixed(1)}% agreement, ${(ensembleScore * 100).toFixed(1)}% ensemble score, ${trendDirection} trend`;
    } else {
      action = 'HOLD';
      strength = Math.round(Math.min(80, modelAgreement));
      reason = `HOLD — insufficient consensus (${modelAgreement.toFixed(1)}% agreement, ${(ensembleScore * 100).toFixed(1)}% ensemble)`;
    }

    // Average model confidence across all contributors
    const modelConfs = [
      dirModelConf,
      this.clamp(Math.abs(mlPredictions.price?.changePercent ?? 0.5), 0, 1),
      volConf,
      this.clamp(mlPredictions.direction?.strength ?? directionConfidence, 0, 1),
      riskConf,
      this.clamp(mlPredictions.holdingPeriod?.confidence ?? 0.5, 0, 1)
    ];
    const averageModelConfidence = modelConfs.reduce((a, b) => a + b, 0) / modelConfs.length;

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
        predicted: pricePredicted,
        high: pricePredicted * 1.05, // Estimate from predicted price
        low: pricePredicted * 0.95,  // Estimate from predicted price
        confidence: this.clamp(Math.abs(mlPredictions.price?.changePercent ?? 0.5), 0, 1)
      },
      volatility: {
        predicted: volPredicted,
        level: volLevel as any,
        confidence: volConf
      },
      trendDirection: {
        direction: trendDirection,
        alignment: trendAlignment,
        alignmentMultiplier: trendAlignmentMult
      },
      position: {
        sizeMultiplier,
        riskReward,
        confidence: directionConfidence
      },
      risk: mlPredictions.risk,
      ensembleScore,
      recommendation: {
        action,
        strength,
        reason
      },
      metadata: {
        timestamp: Date.now(),
        modelCount: 6,
        averageModelConfidence,
        consensusLevel,
        debugTrace: {
          directionVotes,
          upPct,
          downPct,
          neutralPct,
          volatilityFactor,
          trendAlignmentMult,
          sizeMultiplierBefore,
          riskReward
        }
      }
    };
  }
}

export default EnsemblePredictor;
