/**
 * Adaptive Holding Period Integration Service
 * Integrates AdaptiveHoldingPeriod analysis into the signal pipeline
 * This service decouples holding period analysis from the main pipeline
 */

import { AdaptiveHoldingPeriod } from './adaptive-holding-period';
import type { AggregatedSignal } from '../lib/signal-pipeline';

export interface HoldingAnalysisInput {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  marketRegime: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING';
  orderFlowScore: number; // 0-1
  microstructureHealth: number; // 0-1
  momentumQuality: number; // 0-1
  volatility: number; // Annualized volatility
  trendDirection: string; // BULLISH, BEARISH, SIDEWAYS, UP, DOWN
  timeHeldHours: number;
  profitPercent: number;
  atr: number;
  technicalScore: number; // 0-100
  mlProbability: number; // 0-1
  microstructureSignals: string[]; // Recent signals
}

export interface HoldingAnalysisOutput {
  holdingDecision: {
    action: 'HOLD' | 'REDUCE' | 'EXIT';
    holdingPeriodDays: number;
    institutionalConvictionLevel: 'STRONG' | 'MODERATE' | 'WEAK' | 'REVERSING';
    trailStopMultiplier: number;
    reasonsToHold: string[];
    reasonsToExit: string[];
    recommendation: string;
  };
  adjustedStopLoss?: number;
  positionSizeMultiplier?: number; // 0.5 for REDUCE, 1.0 for HOLD, 0 for EXIT
}

/**
 * Integration service for adaptive holding analysis
 * Can be called independently from signal pipeline or integrated at decision point
 */
export class AdaptiveHoldingIntegration {
  private analyzer: AdaptiveHoldingPeriod;

  constructor() {
    this.analyzer = AdaptiveHoldingPeriod.create();
  }

  /**
   * Analyze holding period for a trade/signal
   */
  analyzeHolding(input: HoldingAnalysisInput): HoldingAnalysisOutput {
    // Map regime if needed (convert CONSOLIDATING to RANGING)
    const mappedRegime = input.marketRegime === 'CONSOLIDATING' ? 'RANGING' : input.marketRegime;

    // Map trend direction (UP/DOWN/SIDEWAYS to BULLISH/BEARISH/SIDEWAYS)
    const mappedTrendDirection = input.trendDirection === 'UP' ? 'BULLISH' :
                                 input.trendDirection === 'DOWN' ? 'BEARISH' : 'SIDEWAYS';

    // Calculate momentum quality if not provided
    const momentumQuality = Math.min(1, Math.max(0, input.momentumQuality));

    try {
      const holdingDecision = this.analyzer.calculateHoldingDecision(
        {
          entryTime: new Date(Date.now() - (input.timeHeldHours * 60 * 60 * 1000)), // Calculate entry time
          marketRegime: mappedRegime as 'TRENDING' | 'RANGING' | 'VOLATILE',
          orderFlowScore: Math.min(1, Math.max(0, input.orderFlowScore)),
          microstructureHealth: Math.min(1, Math.max(0, input.microstructureHealth)),
          momentumQuality: momentumQuality,
          volatilityLabel: input.volatility > 0.03 ? 'HIGH' : 
                          input.volatility > 0.01 ? 'MEDIUM' : 'LOW',
          trendDirection: mappedTrendDirection,
          recentMicrostructureSignals: input.microstructureSignals || []
        },
        input.currentPrice,
        input.entryPrice,
        input.profitPercent,
        input.timeHeldHours,
        input.atr
      );

      // Calculate adjusted stop loss based on trail multiplier
      let adjustedStopLoss: number | undefined;
      if (input.currentPrice && input.atr) {
        const trailDistance = input.atr * holdingDecision.trailStopMultiplier;
        adjustedStopLoss = input.currentPrice - trailDistance;
        // Don't let stop go above entry price
        adjustedStopLoss = Math.min(adjustedStopLoss, input.entryPrice * 0.99);
      }

      // Determine position multiplier based on action
      let positionSizeMultiplier: number | undefined;
      if (holdingDecision.action === 'EXIT') {
        positionSizeMultiplier = 0; // Close position
      } else if (holdingDecision.action === 'REDUCE') {
        positionSizeMultiplier = 0.5; // Hold 50%
      } else {
        positionSizeMultiplier = 1.0; // Hold full position
      }

      return {
        holdingDecision,
        adjustedStopLoss,
        positionSizeMultiplier
      };
    } catch (error) {
      console.error(`[AdaptiveHolding] Error analyzing ${input.symbol}:`, error);
      // Return safe default
      return {
        holdingDecision: {
          action: 'HOLD',
          holdingPeriodDays: 7,
          institutionalConvictionLevel: 'MODERATE',
          trailStopMultiplier: 1.5,
          reasonsToHold: ['Using conservative default due to analysis error'],
          reasonsToExit: [],
          recommendation: 'HOLD: Adaptive analysis error, using safe defaults'
        },
        positionSizeMultiplier: 1.0
      };
    }
  }

  /**
   * Apply holding analysis to an aggregated signal
   * This is the integration point for signal pipeline
   */
  applyToSignal(
    signal: any, // AggregatedSignal (avoid circular dependency)
    input: HoldingAnalysisInput
  ): void {
    const result = this.analyzeHolding(input);
    const decision = result.holdingDecision;

    console.log(`[Adaptive Hold] ${input.symbol}: ${decision.recommendation}`);

    // Add holding information to signal quality reasons
    if (!signal.quality) signal.quality = { score: 0, rating: 'poor', reasons: [] };
    if (!signal.quality.reasons) signal.quality.reasons = [];

    signal.quality.reasons.push(
      `Holding target: ${decision.holdingPeriodDays} days (${decision.institutionalConvictionLevel} flow)`
    );
    signal.quality.reasons.push(...decision.reasonsToHold);

    // Adjust stop loss if calculated
    if (result.adjustedStopLoss) {
      const oldStop = signal.stopLoss || 0;
      signal.stopLoss = result.adjustedStopLoss;
      console.log(`[Adaptive Hold] ${input.symbol} - Stop adjusted: ${oldStop.toFixed(2)} → ${result.adjustedStopLoss.toFixed(2)} (${decision.trailStopMultiplier.toFixed(2)}x trail)`);
    }

    // Store holding decision in signal metadata
    if (!signal.metadata) signal.metadata = {};
    signal.metadata.holdingDecision = decision;

    // Apply actions (EXIT/REDUCE)
    if (decision.action === 'EXIT') {
      signal.quality.score = 0; // Force exit
      signal.quality.reasons.push(...decision.reasonsToExit);
      console.log(`[Adaptive Hold] ${input.symbol} - EXIT: ${decision.reasonsToExit[0] || 'See reasons'}`);
    } else if (decision.action === 'REDUCE') {
      signal.metadata.positionMultiplier = 0.5; // Reduce to 50%
      signal.quality.reasons.push(...decision.reasonsToExit);
      console.log(`[Adaptive Hold] ${input.symbol} - REDUCE 50%: ${decision.reasonsToExit[0] || 'See reasons'}`);
    }
  }

  /**
   * Get state for debugging
   */
  getState() {
    return this.analyzer.getState();
  }
}

// Export singleton instance
export const adaptiveHoldingIntegration = new AdaptiveHoldingIntegration();
