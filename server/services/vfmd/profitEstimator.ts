/**
 * Profit & Direction Estimator
 * 
 * Takes validated PEG + TRIGGER signals and estimates:
 * 1. Directional bias (bullish/bearish/neutral)
 * 2. Expected price movement magnitude
 * 3. Expected volatility expansion
 * 4. Reward-to-risk ratio
 * 5. Optimal position sizing
 * 
 * This completes the physics model:
 * STATE (regime) + ENERGY (PEG) + PERMISSION (TRIGGER) + DIRECTION + PROFIT
 * 
 * Mar 2026: Updated gradient threshold for normalized metrics (0.01-0.2 observed range)
 */

import { TriggerCalculator } from './triggerCalculator';
import type { PhysicsMetrics } from './types';

export type DirectionalBias = 'bullish' | 'bearish' | 'neutral';

export interface ProfitEstimate {
  // Directional bias
  direction: DirectionalBias;
  direction_confidence: number; // 0-1

  // Expected price movement
  expected_move_pct: number; // Expected % move from entry
  move_confidence: number; // 0-1

  // Expected volatility expansion
  expected_atr_expansion: number; // Multiplier on current ATR
  volatility_confidence: number; // 0-1

  // Risk/reward
  reward_to_risk: number; // Expected upside / typical stop distance
  kelly_fraction: number; // Optimal position size as fraction

  // Profit potential
  profit_potential_score: number; // 0-100, composite metric
  profit_interpretation: string;

  // Trade recommendation
  recommended_position_size: number; // 0-1, fraction of capital
  recommended_stop_distance_pct: number;
  recommended_take_profit_pct: number;
}

export class ProfitEstimator {
  /** Mar 2026: Normalized gradient threshold after FieldConstructor fix (was 200 raw scale) */
  private static readonly GRADIENT_THRESHOLD = 0.05;
  /**
   * Estimate direction and profit from physics metrics
   * 
   * @param direction_score Optional HTF-based direction score from VFMDDirectionPatch
   *                        If provided, replaces sin(dominantAngle) direction logic
   */
  static estimateProfit(
    metrics: PhysicsMetrics,
    previousMetrics: PhysicsMetrics | null,
    context?: {
      currentPrice?: number;
      atrValue?: number;
      recentHighPrice?: number;
      recentLowPrice?: number;
      prevHighPrice?: number;
      prevLowPrice?: number;
      volumeTrend?: 'rising' | 'stable' | 'falling';
      pricePosition?: number;
      direction_score?: number;
    }
  ): ProfitEstimate {
    const triggerState = TriggerCalculator.computeTrigger(metrics);
    const volatilityProb = TriggerCalculator.getVolatilityProbability(
      metrics.peg,
      triggerState.trigger
    );

    // Estimate direction (uses direction_score from VFMDDirectionPatch if available)
    const direction = context?.direction_score !== undefined
      ? this.estimateDirectionFromScore(context.direction_score)
      : this.estimateDirection(metrics, previousMetrics, context);
    
    const directionConfidence = context?.direction_score !== undefined
      ? this.getDirectionConfidenceFromScore(context.direction_score)
      : this.getDirectionConfidence(metrics, previousMetrics, direction);

    // Estimate move magnitude
    const { expectedMove, moveConfidence } = this.estimateMoveMagnitude(
      metrics,
      volatilityProb,
      context
    );

    // Estimate volatility expansion
    const { atrExpansion, volatilityConfidence } = this.estimateVolatilityExpansion(
      metrics,
      triggerState.trigger
    );

    // Compute risk/reward
    const stopDistance = this.estimateStopDistance(metrics, context);
    const rewardToRisk = expectedMove / Math.max(stopDistance, 0.01);
    const kellyFraction = this.computeKellyFraction(
      rewardToRisk,
      volatilityProb
    );

    // Profit potential score (0-100)
    const profitScore = this.computeProfitScore(
      volatilityProb,
      directionConfidence,
      moveConfidence,
      rewardToRisk
    );

    // Position sizing
    const positionSize = Math.min(
      kellyFraction * 1.5, // Slightly aggressive
      0.3 // Never more than 30% of capital
    );

    return {
      direction,
      direction_confidence: directionConfidence,
      expected_move_pct: expectedMove,
      move_confidence: moveConfidence,
      expected_atr_expansion: atrExpansion,
      volatility_confidence: volatilityConfidence,
      reward_to_risk: rewardToRisk,
      kelly_fraction: kellyFraction,
      profit_potential_score: profitScore,
      profit_interpretation: this.interpretProfitScore(profitScore),
      recommended_position_size: positionSize,
      recommended_stop_distance_pct: stopDistance,
      recommended_take_profit_pct: expectedMove * 1.0, // Exit at 100% of expected move (was 70%, too conservative)
    };
  }

  /**
   * Convert HTF direction_score [-1, +1] to DirectionalBias
   * Replaces sin(dominantAngle) logic with HTF-grounded bias
   */
  private static estimateDirectionFromScore(score: number): DirectionalBias {
    if (Math.abs(score) < 0.1) return 'neutral';
    return score > 0 ? 'bullish' : 'bearish';
  }

  /**
   * Get direction confidence from HTF score
   */
  private static getDirectionConfidenceFromScore(score: number): number {
    // Confidence scales with absolute value of score
    // 0.0 → 0.3 (minimal), 0.5 → 0.65, 1.0 → 1.0
    const absScore = Math.abs(score);
    return 0.3 + absScore * 0.7;
  }

  /**
   * Estimate directional bias from metrics
   */
  private static estimateDirection(
    metrics: PhysicsMetrics,
    previousMetrics: PhysicsMetrics | null,
    context?: any
  ): DirectionalBias {
    let bullishScore = 0;
    let bearishScore = 0;

    // Signal 1: Dominant angle trend
    // dominantAngle > 0.5 with positive divergence = uptrend setup
    if (metrics.dominantAngle > 0.5) {
      if (metrics.divergenceScore > 0.3) bullishScore += 2;
      if (metrics.divergenceScore < -0.3) bearishScore += 1.5;
    } else if (metrics.dominantAngle < -0.5) {
      if (metrics.divergenceScore < -0.3) bearishScore += 2;
      if (metrics.divergenceScore > 0.3) bullishScore += 1.5;
    }

    // Signal 2: Curl direction (rotational momentum)
    // Positive curl at top = bearish reversal risk
    // Positive curl at bottom = bullish continuation
    if (context?.pricePosition !== undefined) {
      if (metrics.curlScore > 0.5) {
        // Upward rotation
        if (context.pricePosition < 0.5) bullishScore += 1.5; // At bottom
        if (context.pricePosition > 0.7) bearishScore += 1; // At top, reversal risk
      } else if (metrics.curlScore < -0.5) {
        // Downward rotation
        if (context.pricePosition > 0.5) bearishScore += 1.5; // At top
        if (context.pricePosition < 0.3) bullishScore += 1; // At bottom, reversal risk
      }
    }

    // Signal 3: Recent divergence trend
    // Rising divergence = energy rising = bullish
    // Falling divergence = energy falling = bearish
    if (previousMetrics) {
      const divergenceTrend = metrics.divergenceScore - previousMetrics.divergenceScore;
      if (divergenceTrend > 0.1) bullishScore += 1;
      if (divergenceTrend < -0.1) bearishScore += 1;
    }

    // Signal 4: Turbulence direction context
    // High TI can amplify existing bias
    if (metrics.turbulenceIndex > 1.5) {
      if (bullishScore > bearishScore) bullishScore += 0.5;
      if (bearishScore > bullishScore) bearishScore += 0.5;
    }

    // Signal 5: Recent curl as momentum
    if (metrics.recentCurl > 0.5) bullishScore += 0.5;
    if (metrics.recentCurl < -0.5) bearishScore += 0.5;

    // Decide direction
    const bias = bullishScore - bearishScore;
    if (Math.abs(bias) < 1) return 'neutral';
    return bias > 0 ? 'bullish' : 'bearish';
  }

  /**
   * Calculate direction confidence (0-1)
   */
  private static getDirectionConfidence(
    metrics: PhysicsMetrics,
    previousMetrics: PhysicsMetrics | null,
    direction: DirectionalBias
  ): number {
    // Confidence comes from:
    // 1. Strong coherence (stable direction)
    // 2. Aligned gradient and dominantAngle
    // 3. Recent trends consistent with direction

    let confidence = 0.3; // Baseline

    // Coherence adds confidence (stable structure)
    if (metrics.coherenceScore > 0.7) confidence += 0.3;
    else if (metrics.coherenceScore > 0.5) confidence += 0.15;

    // Gradient alignment (normalized scale 0.01-0.2, threshold at 0.05)
    if (metrics.gradientMagnitude > ProfitEstimator.GRADIENT_THRESHOLD) confidence += 0.2;

    // Trend consistency
    if (previousMetrics && metrics.divergenceScore > previousMetrics.divergenceScore) {
      if (direction === 'bullish') confidence += 0.1;
    }
    if (previousMetrics && metrics.divergenceScore < previousMetrics.divergenceScore) {
      if (direction === 'bearish') confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Estimate expected price movement magnitude
   */
  private static estimateMoveMagnitude(
    metrics: PhysicsMetrics,
    volatilityProb: number,
    context?: any
  ): { expectedMove: number; moveConfidence: number } {
    // Base move from PEG intensity (continuous sigmoid range [0.0, 0.64])
    // PEG=0.1 → ~0.8% move (low compression)
    // PEG=0.3 → ~1.5% move (moderate compression)
    // PEG=0.6+ → ~3%+ move (high compression = high energy release)
    const pegMagnitude = Math.min(metrics.peg / 0.2, 5); // Normalize sigmoid [0,0.64] to [0,5] range
    let expectedMove = 0.8 + pegMagnitude * 0.4; // 0.8% to 2.8% range

    // Adjust for ATR context
    if (context?.atrValue) {
      const atrPct = (context.atrValue / context.currentPrice) * 100;
      expectedMove = Math.max(expectedMove, atrPct * 1.2); // At least 1.2x current ATR
    }

    // Confidence from coherence and gradient (normalized scale 0.01-0.2, threshold at 0.05)
    let confidence = 0.5;
    if (metrics.coherenceScore > 0.6) confidence += 0.2;
    if (metrics.gradientMagnitude > ProfitEstimator.GRADIENT_THRESHOLD) confidence += 0.15;

    return {
      expectedMove: expectedMove / 100, // Convert to decimal
      moveConfidence: Math.min(0.9, confidence),
    };
  }

  /**
   * Estimate volatility expansion (ATR multiplier)
   */
  private static estimateVolatilityExpansion(
    metrics: PhysicsMetrics,
    trigger: number
  ): { atrExpansion: number; volatilityConfidence: number } {
    // TRIGGER strength determines volatility burst intensity
    // trigger=0.5 → 1.5x ATR
    // trigger=0.8 → 3x ATR
    let atrExpansion = 1 + trigger * 3; // 1x to 4x range

    // Adjust for curl (rotational complexity)
    if (metrics.curlScore > 0.6) {
      atrExpansion *= 1.3; // More chop = bigger swings
    }

    // Confidence from turbulence consistency
    let confidence = 0.6;
    if (trigger > 0.6) confidence += 0.2;
    if (metrics.turbulenceIndex > 1.0) confidence += 0.1;

    return {
      atrExpansion: Math.min(atrExpansion, 5), // Cap at 5x
      volatilityConfidence: Math.min(0.9, confidence),
    };
  }

  /**
   * Estimate appropriate stop-loss distance
   */
  private static estimateStopDistance(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // Base stop from recent volatility (tighter baseline)
    let stopDistance = 0.01; // 1.0% baseline (was 1.5%)

    // Increase for high turbulence (but cap it)
    if (metrics.turbulenceIndex > 1.5) {
      stopDistance += 0.005; // +0.5% (was +1%)
    }

    // Increase for low coherence (uncertain environment)
    if (metrics.coherenceScore < 0.5) {
      stopDistance += 0.003; // +0.3% (was +0.5%)
    }

    // Use ATR if available - tighter than before
    if (context?.atrValue && context?.currentPrice) {
      const atrStop = (context.atrValue / context.currentPrice) * 0.5; // 0.5x ATR (was 0.8x) - tighter stop
      stopDistance = Math.max(stopDistance, atrStop);
    }

    // Maximum stop to avoid excessive losses
    stopDistance = Math.min(stopDistance, 0.035); // Cap at 3.5% (was uncapped)

    return stopDistance;
  }

  /**
   * Compute Kelly Criterion position size
   */
  private static computeKellyFraction(
    rewardToRisk: number,
    winProbability: number
  ): number {
    // Kelly Criterion: f = (p × b - q) / b
    // p = probability of win
    // q = probability of loss = 1 - p
    // b = reward/risk ratio
    // We use volatility probability as win probability (with some conservatism)

    const p = Math.max(0.3, Math.min(winProbability, 0.8)); // Bound between 30%-80%
    const q = 1 - p;
    const b = Math.max(rewardToRisk, 0.5); // Bound reward/risk

    const kellyRaw = (p * b - q) / b;

    // Apply conservative fraction (Kelly/3 or Kelly/2 is standard)
    const kellyFraction = Math.max(0.01, Math.min(kellyRaw / 2.5, 0.3));

    return kellyFraction;
  }

  /**
   * Compute composite profit potential score (0-100)
   */
  private static computeProfitScore(
    volatilityProb: number,
    directionConfidence: number,
    moveConfidence: number,
    rewardToRisk: number
  ): number {
    // Weighted composite
    let score = 0;

    // Volatility probability: 40% weight
    score += volatilityProb * 40;

    // Direction confidence: 25% weight
    score += directionConfidence * 25;

    // Move magnitude confidence: 20% weight
    score += moveConfidence * 20;

    // Reward/risk bonus: 15% weight
    const rrScore = Math.min(rewardToRisk / 3, 1); // 3:1 R:R is perfect
    score += rrScore * 15;

    return Math.round(score);
  }

  /**
   * Interpret profit score
   */
  private static interpretProfitScore(score: number): string {
    if (score >= 80) return '🟢 EXCELLENT: High confidence setup, strong risk/reward';
    if (score >= 65) return '🟢 GOOD: Solid setup, proceed with normal sizing';
    if (score >= 50) return '🟡 FAIR: Acceptable setup, consider smaller position';
    if (score >= 35) return '🟡 WEAK: Low confidence, skip or micro-size only';
    return '🔴 POOR: Poor setup characteristics, pass';
  }

  /**
   * Format for display
   */
  static formatForDisplay(estimate: ProfitEstimate): string {
    const lines: string[] = [];

    lines.push('═'.repeat(80));
    lines.push('💰 PROFIT ESTIMATOR');
    lines.push('═'.repeat(80));

    lines.push('');
    lines.push(`🎯 DIRECTION: ${estimate.direction.toUpperCase()}`);
    lines.push(`   Confidence: ${(estimate.direction_confidence * 100).toFixed(0)}%`);

    lines.push('');
    lines.push(`📈 EXPECTED MOVEMENT: ${(estimate.expected_move_pct * 100).toFixed(2)}%`);
    lines.push(`   Confidence: ${(estimate.move_confidence * 100).toFixed(0)}%`);

    lines.push('');
    lines.push(`⚡ VOLATILITY EXPANSION: ${estimate.expected_atr_expansion.toFixed(1)}x ATR`);
    lines.push(`   Confidence: ${(estimate.volatility_confidence * 100).toFixed(0)}%`);

    lines.push('');
    lines.push(`💎 REWARD/RISK RATIO: ${estimate.reward_to_risk.toFixed(2)}:1`);
    lines.push(`   Kelly Fraction: ${(estimate.kelly_fraction * 100).toFixed(1)}%`);

    lines.push('');
    lines.push(`🎲 PROFIT POTENTIAL: ${estimate.profit_potential_score}/100`);
    lines.push(`   ${estimate.profit_interpretation}`);

    lines.push('');
    lines.push('📋 TRADE RECOMMENDATION:');
    lines.push(`   Position Size: ${(estimate.recommended_position_size * 100).toFixed(1)}% of capital`);
    lines.push(`   Stop Distance: ${(estimate.recommended_stop_distance_pct * 100).toFixed(2)}%`);
    lines.push(`   Take Profit: ${(estimate.recommended_take_profit_pct * 100).toFixed(2)}%`);

    lines.push('');
    lines.push('═'.repeat(80));

    return lines.join('\n');
  }

  /**
   * Export as JSON
   */
  static exportJSON(estimate: ProfitEstimate): object {
    return {
      direction: {
        bias: estimate.direction,
        confidence: estimate.direction_confidence,
      },
      expected_movement: {
        pct: estimate.expected_move_pct,
        confidence: estimate.move_confidence,
      },
      volatility: {
        atr_expansion: estimate.expected_atr_expansion,
        confidence: estimate.volatility_confidence,
      },
      risk_reward: {
        ratio: estimate.reward_to_risk,
        kelly_fraction: estimate.kelly_fraction,
      },
      profitability: {
        score: estimate.profit_potential_score,
        interpretation: estimate.profit_interpretation,
      },
      trade: {
        position_size: estimate.recommended_position_size,
        stop_distance_pct: estimate.recommended_stop_distance_pct,
        take_profit_pct: estimate.recommended_take_profit_pct,
      },
    };
  }
}

export default ProfitEstimator;
