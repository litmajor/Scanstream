/**
 * VFMD Regime Classifier
 * 
 * Classifies market flow into 6 distinct regimes and provides
 * regime-specific configuration for threshold adjustment
 * 
 * Core insight: Same thresholds fail across different market conditions
 * This system adapts strategy per regime
 */

import type { PhysicsMetrics } from './types';

/**
 * Six market flow regimes
 */
export const FlowRegime = {
  // Healthy trending conditions - aggressive entry
  LAMINAR_TREND: 'laminar_trend' as const,

  // Chaotic choppy markets - DON'T TRADE
  TURBULENT_CHOP: 'turbulent_chop' as const,

  // Buyers quietly accumulating - early long opportunity
  ACCUMULATION: 'accumulation' as const,

  // Sellers quietly distributing - early short opportunity
  DISTRIBUTION: 'distribution' as const,

  // Volatility compressing before big move - very aggressive
  BREAKOUT_TRANSITION: 'breakout_transition' as const,

  // Low energy, unclear direction - wait
  CONSOLIDATION: 'consolidation' as const
} as const;

export type FlowRegime = typeof FlowRegime[keyof typeof FlowRegime];

/**
 * Regime-specific configuration
 * Each regime has its own thresholds and risk settings
 */
export interface RegimeConfig {
  // Signal generation thresholds
  minConfidence: number; // 0-1, how confident must signal be
  minPEG: number; // Minimum potential energy gradient
  maxTI: number; // Maximum turbulence index (higher = more chaotic)
  minCoherence: number; // Minimum directional coherence
  minContrast: number; // Minimum divergence/curl contrast

  // Risk management
  riskPercentPerTrade: number; // 0-1, percentage of account
  maxSlippage: number; // Acceptable slippage
  maxSpreadBps: number; // Max spread in basis points

  // Position sizing
  positionSizeMultiplier: number; // 0.5 = half size, 2.0 = double size
  maxConcurrentTrades: number; // How many simultaneous positions

  // Exit strategy
  profitTargetMultiplier: number; // Risk multiplier for target (e.g., 2.0 = 2:1 R:R)
  stopLossPercent: number; // Hard stop loss in percent

  // Signal filtering
  requiresMultipleFactor: boolean; // Require 2+ factors to align
  minBarsToConfirm: number; // How many bars of confirmation needed

  // Regime description
  description: string;
  tradingAdvice: string;
}

export class RegimeClassifier {
  /**
   * Classify current market state into one of 6 regimes
   *
   * Decision tree priority:
   * 1. Is market turbulent? → TURBULENT_CHOP (don't trade)
   * 2. Is PEG spiking with low TI? → BREAKOUT_TRANSITION
   * 3. Is divergence negative with low volume? → ACCUMULATION
   * 4. Is divergence positive with high volume? → DISTRIBUTION
   * 5. Is coherence high? → LAMINAR_TREND
   * 6. Otherwise → CONSOLIDATION
   */
  static classify(metrics: PhysicsMetrics): FlowRegime {
    // Priority 1: Turbulent markets are dangerous
    if (metrics.turbulenceIndex > 2.0) {
      return FlowRegime.TURBULENT_CHOP;
    }

    // Priority 2: Breakout transition (stored energy, low chaos)
    if (
      metrics.peg > 1.5 &&
      metrics.turbulenceIndex < 0.8 &&
      metrics.coherenceScore > 0.5
    ) {
      return FlowRegime.BREAKOUT_TRANSITION;
    }

    // Priority 3: Accumulation (negative divergence, quiet)
    if (
      metrics.divergenceScore < -0.3 &&
      metrics.turbulenceIndex < 1.0 &&
      metrics.peg < 1.0
    ) {
      return FlowRegime.ACCUMULATION;
    }

    // Priority 4: Distribution (positive divergence, high volume)
    if (
      metrics.divergenceScore > 0.3 &&
      metrics.turbulenceIndex > 1.2 &&
      metrics.peg > 1.2
    ) {
      return FlowRegime.DISTRIBUTION;
    }

    // Priority 5: Clean trending market
    if (metrics.coherenceScore > 0.6 && metrics.turbulenceIndex < 1.0) {
      return FlowRegime.LAMINAR_TREND;
    }

    // Default: Consolidation / unclear
    return FlowRegime.CONSOLIDATION;
  }

  /**
   * Get configuration for a specific regime
   * These thresholds are tuned for each market state
   */
  static getRegimeConfig(regime: FlowRegime): RegimeConfig {
    const configs: Record<FlowRegime, RegimeConfig> = {
      // ✅ LAMINAR_TREND: Clean directional markets - be aggressive
      [FlowRegime.LAMINAR_TREND]: {
        minConfidence: 0.50,
        minPEG: 1.0,
        maxTI: 1.5,
        minCoherence: 0.6,
        minContrast: 0.2,

        riskPercentPerTrade: 0.02, // 2% per trade
        maxSlippage: 0.001,
        maxSpreadBps: 5,

        positionSizeMultiplier: 1.0,
        maxConcurrentTrades: 3,

        profitTargetMultiplier: 2.0, // 2:1 R:R
        stopLossPercent: 0.02,

        requiresMultipleFactor: false,
        minBarsToConfirm: 2,

        description: 'Clean trending market - institutional directional flow',
        tradingAdvice: 'AGGRESSIVE: Enter on any PEG signal, use wider stops, aim for 2:1 R:R'
      },

      // ❌ TURBULENT_CHOP: Chaotic markets - DON'T TRADE
      [FlowRegime.TURBULENT_CHOP]: {
        minConfidence: 0.95, // Impossibly high bar
        minPEG: 5.0,
        maxTI: 0.5,
        minCoherence: 0.8,
        minContrast: 0.8,

        riskPercentPerTrade: 0.005, // Only 0.5% (defensive)
        maxSlippage: 0.0005,
        maxSpreadBps: 2,

        positionSizeMultiplier: 0.25, // Quarter size only
        maxConcurrentTrades: 0, // AVOID

        profitTargetMultiplier: 3.0, // Require 3:1 R:R
        stopLossPercent: 0.01,

        requiresMultipleFactor: true,
        minBarsToConfirm: 5,

        description: 'Highly turbulent - avoid trading',
        tradingAdvice: 'AVOID: Market too chaotic. Wait for TI to drop below 1.5'
      },

      // 🟢 ACCUMULATION: Smart money quietly buying - early bullish setup
      [FlowRegime.ACCUMULATION]: {
        minConfidence: 0.45, // Low bar - this is early
        minPEG: 0.8,
        maxTI: 1.2,
        minCoherence: 0.4,
        minContrast: 0.1,

        riskPercentPerTrade: 0.015,
        maxSlippage: 0.0015,
        maxSpreadBps: 8,

        positionSizeMultiplier: 1.2, // Slightly larger
        maxConcurrentTrades: 2,

        profitTargetMultiplier: 2.5,
        stopLossPercent: 0.025,

        requiresMultipleFactor: true,
        minBarsToConfirm: 3,

        description: 'Accumulation phase - smart money quietly buying',
        tradingAdvice: 'OPPORTUNISTIC LONG: Low volume, negative div = buyers in control. Watch for PEG spike to trigger'
      },

      // 🔴 DISTRIBUTION: Smart money quietly selling - early bearish setup
      [FlowRegime.DISTRIBUTION]: {
        minConfidence: 0.45,
        minPEG: 0.8,
        maxTI: 1.2,
        minCoherence: 0.4,
        minContrast: 0.1,

        riskPercentPerTrade: 0.015,
        maxSlippage: 0.0015,
        maxSpreadBps: 8,

        positionSizeMultiplier: 1.2,
        maxConcurrentTrades: 2,

        profitTargetMultiplier: 2.5,
        stopLossPercent: 0.025,

        requiresMultipleFactor: true,
        minBarsToConfirm: 3,

        description: 'Distribution phase - smart money quietly selling',
        tradingAdvice: 'OPPORTUNISTIC SHORT: High volume at highs = sellers in control. Watch for PEG collapse to trigger'
      },

      // 🚀 BREAKOUT_TRANSITION: Most energetic moment - very aggressive
      [FlowRegime.BREAKOUT_TRANSITION]: {
        minConfidence: 0.40, // Lowest bar - maximum alpha
        minPEG: 1.2,
        maxTI: 0.8,
        minCoherence: 0.5,
        minContrast: 0.3,

        riskPercentPerTrade: 0.025, // 2.5% (aggressive)
        maxSlippage: 0.002,
        maxSpreadBps: 10,

        positionSizeMultiplier: 1.5, // 50% larger
        maxConcurrentTrades: 4,

        profitTargetMultiplier: 3.0, // Aim for 3:1 R:R
        stopLossPercent: 0.015,

        requiresMultipleFactor: false,
        minBarsToConfirm: 1,

        description: 'Volatility compression before major directional move',
        tradingAdvice: 'MAXIMUM ALPHA: Stored energy with low chaos = imminent breakout. Enter immediately on signal'
      },

      // ⏸️ CONSOLIDATION: Low energy, unclear direction - wait
      [FlowRegime.CONSOLIDATION]: {
        minConfidence: 0.65, // High bar - only take best setups
        minPEG: 0.5,
        maxTI: 1.5,
        minCoherence: 0.3,
        minContrast: 0.05,

        riskPercentPerTrade: 0.01, // 1% only
        maxSlippage: 0.001,
        maxSpreadBps: 4,

        positionSizeMultiplier: 0.5, // Half size
        maxConcurrentTrades: 1,

        profitTargetMultiplier: 1.5,
        stopLossPercent: 0.02,

        requiresMultipleFactor: true,
        minBarsToConfirm: 4,

        description: 'Low energy consolidation - waiting for direction',
        tradingAdvice: 'SELECTIVE: Only trade highest confidence signals. Focus on accumulation/distribution patterns'
      }
    };

    return configs[regime];
  }

  /**
   * Confidence score for regime classification (0-1)
   * Higher = more certain about the regime
   */
  static getRegimeConfidence(metrics: PhysicsMetrics): number {
    // Metrics are more aligned = higher confidence
    const coherenceConfidence = Math.min(1, Math.abs(metrics.coherenceScore - 0.5) * 2);
    const tiConfidence = Math.min(1, Math.abs(metrics.turbulenceIndex - 1.0) / 1.0);
    const pegConfidence = Math.min(1, metrics.peg / 2.0);

    return (coherenceConfidence + tiConfidence + pegConfidence) / 3;
  }

  /**
   * Human-readable explanation of current regime
   */
  static explainRegime(regime: FlowRegime, metrics: PhysicsMetrics): string {
    const config = this.getRegimeConfig(regime);
    const confidence = this.getRegimeConfidence(metrics);

    return `
Regime: ${regime}
Confidence: ${(confidence * 100).toFixed(0)}%
${config.description}

Current Metrics:
  • PEG (Energy): ${metrics.peg.toFixed(2)}
  • TI (Chaos): ${metrics.turbulenceIndex.toFixed(2)}
  • Coherence: ${metrics.coherenceScore.toFixed(2)}
  • Divergence: ${metrics.divergenceScore.toFixed(2)}

Trading Advice:
${config.tradingAdvice}

Configuration:
  • Min Confidence: ${(config.minConfidence * 100).toFixed(0)}%
  • Position Size: ${(config.positionSizeMultiplier * 100).toFixed(0)}% of standard
  • Risk Per Trade: ${(config.riskPercentPerTrade * 100).toFixed(1)}%
  • Target Multiplier: ${config.profitTargetMultiplier.toFixed(1)}:1 R:R
    `;
  }

  /**
   * Get all regimes ranked by confidence given current metrics
   */
  static getRankedRegimes(metrics: PhysicsMetrics): Array<{
    regime: FlowRegime;
    confidence: number;
  }> {
    const allRegimes = Object.values(FlowRegime);
    const scores = allRegimes.map(regime => {
      // Score how well metrics fit this regime
      let score = 1.0;

      const config = this.getRegimeConfig(regime);

      // Penalize deviations from expected ranges
      if (metrics.turbulenceIndex > config.maxTI) {
        score -= 0.2 * ((metrics.turbulenceIndex - config.maxTI) / config.maxTI);
      }

      if (metrics.peg < config.minPEG) {
        score -= 0.15 * ((config.minPEG - metrics.peg) / config.minPEG);
      }

      if (metrics.coherenceScore < config.minCoherence) {
        score -= 0.15 * ((config.minCoherence - metrics.coherenceScore) / config.minCoherence);
      }

      return {
        regime,
        confidence: Math.max(0, Math.min(1, score))
      };
    });

    return scores.sort((a, b) => b.confidence - a.confidence);
  }
}
