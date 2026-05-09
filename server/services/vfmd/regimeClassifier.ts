/**
 * VFMD Regime Classifier - PHASE 2 MIGRATION
 * 
 * Classifies market flow into 6 distinct regimes and provides
 * regime-specific configuration for threshold adjustment
 * 
 * Core insight: Same thresholds fail across different market conditions
 * This system adapts strategy per regime
 * 
 * PHASE 2 UPDATE (March 2026):
 * - Now includes unified regime detection alongside legacy detection
 * - Enables side-by-side validation before full migration
 * - Maintains 100% backward compatibility with existing code
 */

import type { PhysicsMetrics } from './types';
import { UnifiedRegimeDetector, type UnifiedRegimeType } from '../unified-regime-system';
import { RegimeConsolidationBridge } from '../regime-consolidation-bridge';

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

/**
 * Exponential smoothing helper
 */
function exponentialSmoothing(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const smoothed = [values[0]];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }
  return smoothed;
}

export class RegimeClassifier {
  /**
   * FIELD NORMALIZATION (Feb 2025)
   * 
   * FieldConstructor now normalizes field velocities by priceRange,
   * making all metrics scale-agnostic (returns-space instead of raw dollars).
   * 
   * Before: BTC velocity ~$4,000/candle, ETH velocity ~$400/candle (10x difference)
   * After:  All velocities normalized by [priceMax - priceMin], same scale
   * 
   * Impact: PEG, divergence, and gradient now directly comparable across assets.
   * The asset parameter is now optional and can be removed from classify() entirely.
   * Previous assetBaselines dictionary has been removed as it's now obsolete.
   */

  /**
   * PHASE 2 MIGRATION: Track unified detections for validation
   */
  private static divergenceLog: Array<{
    timestamp: number;
    legacy: FlowRegime;
    unified: UnifiedRegimeType;
    match: boolean;
  }> = [];

  private static readonly MAX_DIVERGENCE_LOG = 1000;

  /**
   * Rolling PEG history for smoothing (prevents regime whipsaw)
   * Shared across classify calls to maintain continuity
   */
  private static pegHistory: number[] = [];

  /**
   * Classify current market state into one of 6 regimes (LEGACY)
   *
   * ✅ UPDATED March 2026: Now synced with VFMDPhysicsAgent normalized metrics
   * All metrics are scale-agnostic (normalized in FieldConstructor).
   * The asset parameter has been kept for backward compatibility but is no longer used.
   *
   * PHASE 2: This now runs alongside unified detection for parallel validation.
   *
   * Mar 2026 PEG thresholds (normalized via FieldConstructor):
   *   LAMINAR_TREND:        PEG > 0.25
   *   BREAKOUT_TRANSITION:  PEG > 0.30 (highest stored energy)
   *   ACCUMULATION:         PEG > 0.20
   *   DISTRIBUTION:         PEG > 0.20
   *   TURBULENT_CHOP:       PEG > 0.22
   *   CONSOLIDATION:        PEG < 0.15 (default)
   *
   * Decision tree priority:
   * 1. Is market turbulent? → TURBULENT_CHOP (don't trade)
   * 2. Is PEG extreme with low TI? → BREAKOUT_TRANSITION (peg > 0.30)
   * 3. Is divergence strongly negative? → ACCUMULATION (peg > 0.20, div < -0.3)
   * 4. Is divergence strongly positive? → DISTRIBUTION (peg > 0.20, div > 0.3)
   * 5. Is PEG high with clean coherence? → LAMINAR_TREND (peg > 0.25)
   * 6. Otherwise → CONSOLIDATION
   *
   * @param metrics Raw physics metrics (already normalized in FieldConstructor)
   * @param asset Deprecated: included for backward compatibility, no longer required
   */
  static classify(metrics: PhysicsMetrics, asset?: string): FlowRegime {
    // PHASE 2: Run legacy detection
    const legacyRegime = this.classifyLegacy(metrics, asset);

    // PHASE 2: Also detect using unified system (for validation)
    const unifiedDetection = this.detectUnified(metrics, asset);
    const mappedBackToLegacy = RegimeConsolidationBridge.toVFMD(unifiedDetection.regime);

    // PHASE 2: Track divergence for monitoring
    const matches = legacyRegime === mappedBackToLegacy;
    this.divergenceLog.push({
      timestamp: Date.now(),
      legacy: legacyRegime,
      unified: unifiedDetection.regime,
      match: matches,
    });

    if (this.divergenceLog.length > this.MAX_DIVERGENCE_LOG) {
      this.divergenceLog.shift();
    }

    // Return legacy format for now (100% backward compatible)
    return legacyRegime;
  }

  /**
   * PHASE 2: Get divergence statistics for migration validation
   */
  static getDivergenceStats(): {
    totalSamples: number;
    matchingDetections: number;
    matchPercentage: number;
    recentDivergences: Array<{
      legacy: FlowRegime;
      unified: UnifiedRegimeType;
    }>;
  } {
    const matching = this.divergenceLog.filter((d) => d.match).length;
    const recentDivergences = this.divergenceLog
      .filter((d) => !d.match)
      .slice(-10)
      .map((d) => ({
        legacy: d.legacy,
        unified: d.unified,
      }));

    return {
      totalSamples: this.divergenceLog.length,
      matchingDetections: matching,
      matchPercentage:
        this.divergenceLog.length > 0
          ? (matching / this.divergenceLog.length) * 100
          : 0,
      recentDivergences,
    };
  }

  /**
   * PHASE 2 INTERNAL: Legacy classification logic (preserved for validation)
   */
  private static classifyLegacy(metrics: PhysicsMetrics, asset?: string): FlowRegime {
    // No normalization needed — metrics are already scale-agnostic from FieldConstructor

    // Update PEG history for smoothing (keep last 5 candles)
    this.pegHistory.push(metrics.peg);
    if (this.pegHistory.length > 5) {
      this.pegHistory.shift();
    }

    // Apply exponential smoothing to PEG to reduce regime whipsaw
    // Alpha = 0.3 means ~3-candle smoothing window
    const smoothedPEGValues = exponentialSmoothing(this.pegHistory, 0.3);
    const smoothedPEG = smoothedPEGValues[smoothedPEGValues.length - 1];

    // Priority 1: Turbulent markets are dangerous
    if (metrics.turbulenceIndex > 2.0) {
      return FlowRegime.TURBULENT_CHOP;
    }

    // Priority 2: BREAKOUT_TRANSITION (extreme stored energy, low chaos)
    // Mar 2026: threshold updated from 0.10 (old) → 0.30 (new normalized)
    // NOW USING SMOOTHED PEG to prevent false regime switches
    if (
      smoothedPEG > 0.30 &&
      metrics.turbulenceIndex < 0.8 &&
      metrics.coherenceScore > 0.5
    ) {
      return FlowRegime.BREAKOUT_TRANSITION;
    }

    // Priority 3: ACCUMULATION (high PEG + negative divergence = buyers in control)
    // Mar 2026: threshold updated from 0.07 (old) → 0.20 (new normalized)
    // Note: Unlike old logic, accumulation happens when PEG is HIGH (0.20+) with negative dive
    // NOW USING SMOOTHED PEG
    if (
      smoothedPEG > 0.20 &&
      metrics.divergenceScore < -0.3 &&
      metrics.turbulenceIndex < 1.0
    ) {
      return FlowRegime.ACCUMULATION;
    }

    // Priority 4: DISTRIBUTION (high PEG + positive divergence = sellers in control)
    // Mar 2026: threshold updated from 0.09 (old) → 0.20 (new normalized)
    // NOW USING SMOOTHED PEG
    if (
      smoothedPEG > 0.20 &&
      metrics.divergenceScore > 0.3 &&
      metrics.turbulenceIndex < 1.5
    ) {
      return FlowRegime.DISTRIBUTION;
    }

    // Priority 5: LAMINAR_TREND (clean trending market with high PEG)
    // Mar 2026: threshold updated from implicit to 0.25
    // NOW USING SMOOTHED PEG to prevent false trend breaks
    if (
      smoothedPEG > 0.25 &&
      metrics.coherenceScore > 0.6 &&
      metrics.turbulenceIndex < 1.0
    ) {
      return FlowRegime.LAMINAR_TREND;
    }

    // Default: CONSOLIDATION (low energy, waiting for direction)
    // Mar 2026: threshold updated from implicit to 0.15 (catch all PEG < 0.15)
    // NOW USING SMOOTHED PEG
    return FlowRegime.CONSOLIDATION;
  }

  /**
   * PHASE 2 NEW: Map VFMD metrics to unified regime detection
   * Extracts market indicators from VFMD metrics and uses UnifiedRegimeDetector
   */
  private static detectUnified(metrics: PhysicsMetrics, asset?: string): {
    regime: UnifiedRegimeType;
    confidence: number;
  } {
    // Map VFMD metrics to unified system inputs
    // Note: Not all fields map 1:1, so we use best approximations
    const unifiedParams = {
      // PEG maps directly to regime strength indicator
      adx: Math.min(100, Math.max(0, metrics.peg * 100)), // Scale PEG to 0-100

      // Turbulence index inversely maps to volatility (high TI = low coherence = high volatility)
      volatility: Math.min(
        0.15,
        Math.max(0.005, metrics.turbulenceIndex * 0.05)
      ),

      // Divergence score maps directly [+1, -1] → [%.15, -0.15]
      divergence: metrics.divergenceScore,

      // Coherence score maps directly [0, 1]
      coherence: metrics.coherenceScore,

      // Approximate momentum from divergence trend
      momentum: metrics.divergenceScore > 0 ? 0.5 : -0.5,

      // Use turbulence as proxy for compression (low TI = tight range = compression)
      compression: 1.0 - metrics.turbulenceIndex * 0.2,

      // Not available from VFMD metrics, use sensible defaults
      priceVsMA: metrics.divergenceScore * 0.5, // Approximation
      rangeWidth: 0.03, // Default
    };

    // Call unified detector
    try {
      const result = UnifiedRegimeDetector.detectRegime(unifiedParams);
      return {
        regime: result.regime,
        confidence: result.confidence,
      };
    } catch (error) {
      // Fallback: if unified detection fails, map legacy to unified
      // This ensures migration doesn't break anything
      const mapped = RegimeConsolidationBridge.fromVFMD(
        this.classifyLegacy(metrics, asset)
      );
      return {
        regime: mapped,
        confidence: 0.5, // Low confidence on fallback
      };
    }
  }

  /**
   * Get configuration for a specific regime
   * These thresholds are tuned for each market state
   */
  static getRegimeConfig(regime: FlowRegime): RegimeConfig {
    const configs: Record<FlowRegime, RegimeConfig> = {
      // ✅ LAMINAR_TREND: Clean directional markets - be aggressive
      // Mar 2026: Updated thresholds for normalized metrics (PEG 0.25+)
      [FlowRegime.LAMINAR_TREND]: {
        minConfidence: 0.50,
        minPEG: 0.25,  // Updated from 1.0 (old) to 0.25 (normalized)
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

      // 🚧 TURBULENT_CHOP: high‑energy chaotic market – trade selectively
      // Mar 2026: Updated thresholds for normalized metrics (PEG 0.22+)
      [FlowRegime.TURBULENT_CHOP]: {
        minConfidence: 0.25,          // operating confidence much lower than docs
        minPEG: 0.22,                 // Updated from 5.0 (old) to 0.22 (normalized)
        maxTI: 0.5,
        minCoherence: 0.8,
        minContrast: 0.8,

        // risk settings remain defensive but not prohibitive
        riskPercentPerTrade: 0.005, // 0.5% per trade
        maxSlippage: 0.0005,
        maxSpreadBps: 2,

        // sizing is larger than documentation suggested
        positionSizeMultiplier: 0.75, // 75% of normal size
        maxConcurrentTrades: 2,

        profitTargetMultiplier: 2.5, // moderately wider targets
        stopLossPercent: 0.01,

        requiresMultipleFactor: true,
        minBarsToConfirm: 5,

        description: 'High-energy chaotic market — momentum signals viable with tighter sizing',
        tradingAdvice: 'SELECTIVE: Trade momentum breakouts with reduced size. PF 2.05 empirically. Avoid mean-reversion setups.'
      },

      // 🟢 ACCUMULATION: Smart money quietly buying - early bullish setup
      // Mar 2026: Updated thresholds for normalized metrics (PEG 0.20+)
      [FlowRegime.ACCUMULATION]: {
        minConfidence: 0.45, // Low bar - this is early
        minPEG: 0.20,        // Updated from 0.8 (old) to 0.20 (normalized)
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
      // Mar 2026: Updated thresholds for normalized metrics (PEG 0.20+)
      [FlowRegime.DISTRIBUTION]: {
        minConfidence: 0.45,
        minPEG: 0.20,        // Updated from 0.8 (old) to 0.20 (normalized)
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
  static getRegimeConfidence(metrics: PhysicsMetrics, asset?: string): number {
    // Metrics are already scale-agnostic (normalized in FieldConstructor)
    // Asset parameter kept for backward compatibility but no longer used

    const coherenceConfidence = Math.min(1, Math.abs(metrics.coherenceScore - 0.5) * 2);
    const tiConfidence = Math.min(1, Math.abs(metrics.turbulenceIndex - 1.0) / 1.0);
    // Feb 2025: PEG divisor recalibrated from 2.0 (raw scale) to 0.15 (normalized scale)
    // 0.15 ≈ 2x average normalized PEG (~0.07); gives meaningful 0-1 confidence spread
    const pegConfidence = Math.min(1, metrics.peg / 0.15);

    return (coherenceConfidence + tiConfidence + pegConfidence) / 3;
  }

  /**
   * Human-readable explanation of current regime
   */
  static explainRegime(regime: FlowRegime, metrics: PhysicsMetrics, asset?: string): string {
    const config = this.getRegimeConfig(regime);
    const confidence = this.getRegimeConfidence(metrics, asset);

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
   * PHASE 2: Now also validates against unified system
   */
  static getRankedRegimes(metrics: PhysicsMetrics): Array<{
    regime: FlowRegime;
    confidence: number;
    unifiedRegime?: UnifiedRegimeType;
  }> {
    const allRegimes = Object.values(FlowRegime);
    const scores = allRegimes.map((regime) => {
      // Score how well metrics fit this regime
      let score = 1.0;

      const config = this.getRegimeConfig(regime);

      // Penalize deviations from expected ranges
      if (metrics.turbulenceIndex > config.maxTI) {
        score -=
          0.2 *
          ((metrics.turbulenceIndex - config.maxTI) / config.maxTI);
      }

      if (metrics.peg < config.minPEG) {
        score -= 0.15 * ((config.minPEG - metrics.peg) / config.minPEG);
      }

      if (metrics.coherenceScore < config.minCoherence) {
        score -=
          0.15 *
          ((config.minCoherence - metrics.coherenceScore) /
            config.minCoherence);
      }

      // PHASE 2: Include unified regime in output
      const unified = this.detectUnified(metrics);
      const mappedBack = RegimeConsolidationBridge.toVFMD(unified.regime);
      const isMatching = regime === mappedBack;

      return {
        regime,
        confidence: Math.max(0, Math.min(1, score)),
        unifiedRegime: unified.regime,
        ...(isMatching && { validatedByUnified: true }),
      };
    });

    return scores.sort((a, b) => b.confidence - a.confidence);
  }
}
