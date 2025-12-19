/**
 * REGIME-SIGNAL INTEGRATION
 * 
 * Integrates RegimeAssessmentEngine with SignalPipeline for dynamic weight application.
 * 
 * Flow:
 * 1. Receive market data + historical candles
 * 2. Detect regime using RegimeAssessmentEngine
 * 3. Get weight matrix for detected regime
 * 4. Apply smooth transitions via WeightTransitionManager
 * 5. Return adjusted signal with dynamic weights applied
 */

import { RegimeAssessmentEngine, type RegimeDetectionResult, type RegimeType, type Candle } from './regime-assessment';
import { WeightTransitionManager, REGIME_WEIGHT_MATRICES, type RegimeWeights } from './weight-transition-manager';
import type { AggregatedSignal } from './signal-pipeline';

export interface RegimeAdjustedSignal extends AggregatedSignal {
  regimeDetection: RegimeDetectionResult;
  regimeWeights: RegimeWeights;
  dynamicWeightsApplied: boolean;
  confidenceBoost?: number;
  strengthBoost?: number;
  adjustmentReasons: string[];
}

export class RegimeSignalIntegrator {
  private regimeEngine: RegimeAssessmentEngine;
  private weightManager: WeightTransitionManager;
  private lastDetectedRegime: RegimeType | null = null;
  private lastProcessedTimestamp: number = 0;

  constructor() {
    this.regimeEngine = new RegimeAssessmentEngine();
    this.weightManager = new WeightTransitionManager();
  }

  /**
   * Apply regime-based dynamic weighting to a signal
   */
  applyRegimeWeighting(
    signal: AggregatedSignal,
    candles: Candle[]
  ): RegimeAdjustedSignal {
    const adjustmentReasons: string[] = [];

    // Detect current market regime from candle history
    const regimeDetection = this.regimeEngine.assessRegime(candles);
    adjustmentReasons.push(`Regime: ${regimeDetection.regime} (strength: ${(regimeDetection.regimeStrength * 100).toFixed(0)}%)`);

    // Get weight matrix for detected regime
    const regimeWeights = REGIME_WEIGHT_MATRICES[regimeDetection.regime] || REGIME_WEIGHT_MATRICES['DEFAULT'];

    // Check if regime has changed
    let transitioningWeights = regimeWeights;
    if (this.lastDetectedRegime && this.lastDetectedRegime !== regimeDetection.regime) {
      adjustmentReasons.push(`Regime transition: ${this.lastDetectedRegime} → ${regimeDetection.regime}`);
      
      // Start smooth transition in weight manager
      transitioningWeights = this.weightManager.startTransition(
        this.lastDetectedRegime,
        regimeDetection.regime
      );
    }

    this.lastDetectedRegime = regimeDetection.regime;

    // Apply confidence boost/penalty based on regime strength
    let confidenceBoost = 1.0;
    if (regimeDetection.regimeStrength > 0.8) {
      confidenceBoost = 1.15; // +15% confidence in strong regimes
      adjustmentReasons.push(`Strong regime signal (+15% confidence)`);
    } else if (regimeDetection.regimeStrength > 0.6) {
      confidenceBoost = 1.08; // +8% confidence in moderate regimes
      adjustmentReasons.push(`Moderate regime signal (+8% confidence)`);
    } else if (regimeDetection.isTransitioning) {
      confidenceBoost = 0.90; // -10% confidence during transitions
      adjustmentReasons.push(`Regime transitioning (-10% confidence)`);
    }

    // Apply strength boost based on regime alignment with signal direction
    let strengthBoost = 1.0;
    const isAlignedWithTrend = this.isSignalAlignedWithRegime(
      signal.type,
      regimeDetection
    );

    if (isAlignedWithTrend) {
      strengthBoost = 1.12; // +12% strength if aligned
      adjustmentReasons.push(`Signal aligned with regime (+12% strength)`);
    } else if (
      regimeDetection.regime === 'RANGING' ||
      regimeDetection.regime === 'CONSOLIDATING'
    ) {
      // Mean reversion signals in ranging markets are OK
      strengthBoost = 1.05;
      adjustmentReasons.push(`Mean reversion opportunity in ranging market (+5% strength)`);
    }

    // Calculate adjusted confidence and strength
    const adjustedConfidence = Math.min(
      1,
      Math.max(0, signal.confidence * confidenceBoost)
    );
    const adjustedStrength = Math.min(
      1,
      Math.max(0, signal.strength * strengthBoost)
    );

    // Apply data quality penalty
    let qualityPenalty = 1.0;
    if (regimeDetection.dataQuality === 'FAIR') {
      qualityPenalty = 0.95;
      adjustmentReasons.push(`Fair data quality (-5% confidence)`);
    } else if (regimeDetection.dataQuality === 'POOR') {
      qualityPenalty = 0.85;
      adjustmentReasons.push(`Poor data quality (-15% confidence)`);
    }

    const finalConfidence = adjustedConfidence * qualityPenalty;

    // Apply false flip risk penalty
    const falseFlipPenalty = 1 - (regimeDetection.falseFlipRisk * 0.5);
    const riskAdjustedConfidence = finalConfidence * falseFlipPenalty;

    if (regimeDetection.falseFlipRisk > 0.3) {
      adjustmentReasons.push(`False flip risk detected (${(regimeDetection.falseFlipRisk * 100).toFixed(0)}%)`);
    }

    return {
      ...signal,
      confidence: Math.min(1, Math.max(0, riskAdjustedConfidence)),
      strength: adjustedStrength,
      regimeDetection,
      regimeWeights: transitioningWeights,
      dynamicWeightsApplied: true,
      confidenceBoost,
      strengthBoost,
      adjustmentReasons,
      sources: {
        ...signal.sources,
        scanner: {
          ...signal.sources.scanner,
          confidence: signal.sources.scanner.confidence * transitioningWeights.scanner
        },
        ml: {
          ...signal.sources.ml,
          confidence: signal.sources.ml.confidence * transitioningWeights.ml
        },
        rl: {
          ...signal.sources.rl,
          confidence: signal.sources.rl.confidence * transitioningWeights.rl
        }
      }
    };
  }

  /**
   * Check if signal direction is aligned with regime trend
   */
  private isSignalAlignedWithRegime(
    signalType: string,
    regime: RegimeDetectionResult
  ): boolean {
    // In uptrends, BUY signals are aligned
    if (
      (signalType === 'BUY' && regime.direction === 'UP') ||
      (signalType === 'SELL' && regime.direction === 'DOWN')
    ) {
      return true;
    }

    // In ranging/consolidating, be cautious but not penalize
    if (regime.regime === 'RANGING' || regime.regime === 'CONSOLIDATING') {
      return true; // Mean reversion is valid here
    }

    return false;
  }

  /**
   * Get current regime state for diagnostics
   */
  getCurrentRegime(): {
    regime: RegimeType | null;
    weights: RegimeWeights;
    isTransitioning: boolean;
  } {
    return {
      regime: this.lastDetectedRegime,
      weights: this.lastDetectedRegime 
        ? REGIME_WEIGHT_MATRICES[this.lastDetectedRegime]
        : REGIME_WEIGHT_MATRICES['DEFAULT'],
      isTransitioning: this.lastDetectedRegime !== null && 
                       this.lastProcessedTimestamp > 0
    };
  }

  /**
   * Reset internal state (useful for testing)
   */
  reset(): void {
    this.lastDetectedRegime = null;
    this.lastProcessedTimestamp = 0;
  }
}

export const regimeSignalIntegrator = new RegimeSignalIntegrator();
