
import { SignalClassification } from './signal-classifier';

interface MarketState {
  regime: 'TRENDING' | 'CHOPPY' | 'VOLATILE';
  adx: number;
  volatility: number;
  volumeRatio: number;
}

interface PatternSignals {
  [pattern: string]: number; // pattern -> strength (0-100)
}

interface WeightedConfidence {
  finalConfidence: number;
  weights: Record<string, number>;
  alignmentBoost: number;
  reasoning: string[];
}

/**
 * Smart Pattern Combination Intelligence
 * Dynamically weights patterns based on market regime and conditions
 */
export class SmartPatternCombination {
  /**
   * Calculate weighted confidence based on market regime
   */
  calculateWeightedConfidence(
    signals: PatternSignals,
    marketState: MarketState
  ): WeightedConfidence {
    const weights = this.getRegimeBasedWeights(marketState.regime);
    const reasoning: string[] = [];

    let totalScore = 0;
    let totalWeight = 0;

    // Calculate weighted score
    for (const [pattern, signalStrength] of Object.entries(signals)) {
      const weight = weights[pattern] || 1.0;
      totalScore += signalStrength * weight;
      totalWeight += weight;

      if (weight > 1.1) {
        reasoning.push(`${pattern} weighted higher (${weight.toFixed(2)}x) in ${marketState.regime} regime`);
      } else if (weight < 0.9) {
        reasoning.push(`${pattern} weighted lower (${weight.toFixed(2)}x) in ${marketState.regime} regime`);
      }
    }

    // Normalize
    let finalConfidence = totalWeight > 0 ? (totalScore / totalWeight) : 50;

    // Alignment boost: 15% if 3+ strong patterns align
    const strongPatterns = Object.values(signals).filter(s => s > 70).length;
    let alignmentBoost = 0;

    if (strongPatterns >= 3) {
      alignmentBoost = 0.15;
      finalConfidence *= (1 + alignmentBoost);
      reasoning.push(`${strongPatterns} strong patterns aligned (+15% confluence boost)`);
    } else if (strongPatterns >= 2) {
      alignmentBoost = 0.08;
      finalConfidence *= (1 + alignmentBoost);
      reasoning.push(`${strongPatterns} patterns aligned (+8% confluence boost)`);
    }

    // Cap at 95%
    finalConfidence = Math.min(finalConfidence, 95);

    return {
      finalConfidence,
      weights,
      alignmentBoost,
      reasoning
    };
  }

  /**
   * Get pattern weights based on market regime
   */
  private getRegimeBasedWeights(regime: 'TRENDING' | 'CHOPPY' | 'VOLATILE'): Record<string, number> {
    const baseWeights: Record<string, number> = {
      BREAKOUT: 1.0,
      MA_CROSSOVER: 1.0,
      REVERSAL: 1.0,
      SUPPORT_BOUNCE: 1.0,
      ML_PREDICTION: 1.0,
      CONFLUENCE: 1.0,
      DIVERGENCE: 1.0,
      MACD_SIGNAL: 1.0,
      RSI_EXTREME: 1.0
    };

    if (regime === 'TRENDING') {
      return {
        ...baseWeights,
        BREAKOUT: 1.5,         // Breakouts work great in trends
        MA_CROSSOVER: 1.3,     // MA crossovers confirm trends
        REVERSAL: 0.7,         // Reversals fail in strong trends
        SUPPORT_BOUNCE: 0.8,   // Less reliable in strong trends
        ML_PREDICTION: 1.2,    // ML picks up trend patterns
        TREND_CONFIRMATION: 1.4,
        CONTINUATION: 1.3
      };
    } else if (regime === 'CHOPPY') {
      return {
        ...baseWeights,
        BREAKOUT: 0.6,         // False breakouts common
        MA_CROSSOVER: 0.7,     // Whipsaws common
        REVERSAL: 1.4,         // Reversals work in range
        SUPPORT_BOUNCE: 1.5,   // Bounces work great
        ML_PREDICTION: 1.1,    // ML moderate
        RANGING: 1.3,
        ACCUMULATION: 1.2,
        DISTRIBUTION: 1.2
      };
    } else if (regime === 'VOLATILE') {
      return {
        ...baseWeights,
        BREAKOUT: 1.2,         // Breakouts possible but risky
        MA_CROSSOVER: 0.8,     // Noisy in volatility
        REVERSAL: 1.1,         // Moderate
        SUPPORT_BOUNCE: 0.9,   // Less reliable
        ML_PREDICTION: 1.4,    // ML best in volatile conditions
        SPIKE: 1.3,
        PARABOLIC: 1.2
      };
    }

    return baseWeights;
  }

  /**
   * Get pattern performance-based weights
   * (Use historical win rates to further adjust weights)
   */
  getPerformanceWeights(patternWinRates: Map<string, number>): Record<string, number> {
    const weights: Record<string, number> = {};

    for (const [pattern, winRate] of patternWinRates.entries()) {
      // Convert win rate (0.4-0.6) to weight (0.7-1.3)
      // Win rate 50% = weight 1.0
      // Win rate 60% = weight 1.3
      // Win rate 40% = weight 0.7
      const deviation = winRate - 0.5;
      weights[pattern] = 1.0 + (deviation * 2);
    }

    return weights;
  }

  /**
   * Combine regime weights and performance weights
   */
  getCombinedWeights(
    regime: 'TRENDING' | 'CHOPPY' | 'VOLATILE',
    patternWinRates: Map<string, number>
  ): Record<string, number> {
    const regimeWeights = this.getRegimeBasedWeights(regime);
    const performanceWeights = this.getPerformanceWeights(patternWinRates);

    const combined: Record<string, number> = {};

    const allPatterns = new Set([
      ...Object.keys(regimeWeights),
      ...Array.from(patternWinRates.keys())
    ]);

    for (const pattern of allPatterns) {
      const regimeWeight = regimeWeights[pattern] || 1.0;
      const perfWeight = performanceWeights[pattern] || 1.0;
      
      // Average the two weights
      combined[pattern] = (regimeWeight + perfWeight) / 2;
    }

    return combined;
  }
}

export const smartPatternCombination = new SmartPatternCombination();
