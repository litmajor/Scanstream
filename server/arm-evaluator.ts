/**
 * Adaptive Regime Matcher (ARM) - Evaluates momentum signals based on market regime
 * Integrates with SignalClassifier to provide regime-aware signal classification
 */

import { SignalStrengthLabel, RegimeState, AdditionalIndicators } from './signal-classifier';

export interface RegimeContext {
  regime: RegimeState;
  volatility: number;
  trendStrength: number;
  regimeConfidence: number;
}

export interface ARMConfig {
  enableAdaptiveThresholds: boolean;
  regimeWeighting: Record<string, number>;
  volatilityAdjustment: number;
  trendInfluence: number;
}

export interface MomentumSignalContext {
  momentumShort: number;
  momentumLong: number;
  rsi: number;
  macd: number;
  regimeContext: RegimeContext;
  additionalIndicators: AdditionalIndicators;
}

/**
 * ARM Evaluator - Regime-aware momentum signal evaluation
 */
export class ARMEvaluator {
  private static readonly DEFAULT_CONFIG: ARMConfig = {
    enableAdaptiveThresholds: true,
    regimeWeighting: {
      'BULL_EARLY': 1.1,
      'BULL_STRONG': 1.3,
      'BULL_PARABOLIC': 1.2,
      'BEAR_EARLY': 0.9,
      'BEAR_STRONG': 0.7,
      'BEAR_CAPITULATION': 0.8,
      'NEUTRAL_ACCUM': 1.0,
      'NEUTRAL_DIST': 1.0,
      'NEUTRAL': 1.0,
    },
    volatilityAdjustment: 0.5,
    trendInfluence: 0.3,
  };

  /**
   * Evaluates momentum signal considering regime context
   */
  static evaluateMomentumWithRegime(
    context: MomentumSignalContext,
    baseSignal: SignalStrengthLabel,
    config: ARMConfig = ARMEvaluator.DEFAULT_CONFIG,
  ): SignalStrengthLabel {
    if (!config.enableAdaptiveThresholds) {
      return baseSignal;
    }

    const regimeWeight = config.regimeWeighting[context.regimeContext.regime] ?? 1.0;
    const volatilityFactor = 1.0 + (context.regimeContext.volatility - 0.5) * config.volatilityAdjustment;
    const trendFactor = 1.0 + context.regimeContext.trendStrength * config.trendInfluence;
    
    const combinedWeight = regimeWeight * volatilityFactor * trendFactor;

    return ARMEvaluator.adjustSignalByWeight(baseSignal, combinedWeight, context.regimeContext);
  }

  /**
   * Adjusts signal strength based on combined regime/volatility/trend weight
   */
  private static adjustSignalByWeight(
    signal: SignalStrengthLabel,
    weight: number,
    regimeContext: RegimeContext,
  ): SignalStrengthLabel {
    const signalStrengths: SignalStrengthLabel[] = [
      'Strong Sell',
      'Sell',
      'Weak Sell',
      'Neutral',
      'Weak Buy',
      'Buy',
      'Strong Buy',
    ];

    const currentIndex = signalStrengths.indexOf(signal);
    if (currentIndex === -1) return signal;

    // Adjust based on regime alignment
    const isBullish = regimeContext.regime.includes('BULL');
    const isBearish = regimeContext.regime.includes('BEAR');

    // In bull regimes, weight > 1.0 strengthens buy signals
    // In bear regimes, weight > 1.0 strengthens sell signals
    let adjustment = 0;
    if (isBullish && weight > 1.0 && currentIndex > 3) {
      adjustment = Math.min(1, Math.floor(weight - 1.0) * 2);
    } else if (isBearish && weight > 1.0 && currentIndex < 3) {
      adjustment = -Math.min(1, Math.floor(weight - 1.0) * 2);
    }

    const newIndex = Math.max(0, Math.min(6, currentIndex + adjustment));
    return signalStrengths[newIndex];
  }

  /**
   * Calculates regime confidence based on momentum consistency
   */
  static calculateRegimeConfidence(
    momentumShort: number,
    momentumLong: number,
    rsi: number,
  ): number {
    // High confidence when short-term momentum aligns with long-term
    const alignmentScore = Math.abs(Math.sign(momentumShort) - Math.sign(momentumLong)) === 0 ? 1.0 : 0.5;
    
    // RSI extremes indicate strong conviction
    const rsiScore = (Math.abs(rsi - 50) / 50) * 0.5 + 0.5;
    
    return Math.min(1.0, (alignmentScore + rsiScore) / 2.0);
  }

  /**
   * Evaluates trend strength from momentum indicators
   */
  static evaluateTrendStrength(
    momentumLong: number,
    macd: number,
    rsi: number,
  ): number {
    // Normalize momentum to 0-1 range
    const momNorm = Math.tanh(Math.abs(momentumLong)) * 0.5 + 0.5;
    
    // MACD trend strength
    const macdNorm = Math.tanh(Math.abs(macd) * 0.1) * 0.5 + 0.5;
    
    // RSI distance from neutral
    const rsiNorm = Math.abs(rsi - 50) / 50;
    
    return (momNorm + macdNorm + rsiNorm) / 3.0;
  }

  /**
   * Evaluates volatility environment
   */
  static evaluateVolatility(
    momentumShort: number,
    rsi: number,
    additionalIndicators: AdditionalIndicators,
  ): number {
    // Momentum volatility
    const momVol = Math.min(1.0, Math.abs(momentumShort) / 0.1);
    
    // RSI extremity (higher RSI extremity = higher volatility perception)
    const rsiVol = (Math.abs(rsi - 50) / 50) * 0.5;
    
    // Additional volatility indicators
    let additionalVol = 0;
    if (additionalIndicators.atr) {
      additionalVol = Math.min(1.0, (additionalIndicators.atr as number) / 0.05);
    }
    
    return (momVol + rsiVol + additionalVol) / 3.0;
  }
}
