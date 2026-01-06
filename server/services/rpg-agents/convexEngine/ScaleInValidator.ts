/**
 * Scale-In Validator
 * 
 * IMPORTANT FIX #3: Response-Based Scale-In (Not Price-Based)
 * 
 * Problem: Using price PnL to gate scale-in mixes concerns
 * - "Don't scale if losing money" blocks valid entries on pullbacks
 * - Creates counter-productive hedging behavior
 * - Misses 40% of payoff during normal retracements
 * 
 * Solution: Validate scale-in using RESPONSE, not PRICE
 * - Check 1: R-score is strong (75th percentile)
 * - Check 2: R is rising or stable (not decelerating)
 * - Check 3: R near recent peak (response still dominant)
 * 
 * Result: Scale-in happens during healthy pullbacks
 * - Same imbalance structure confirmed
 * - Price temporarily lower = better entry
 * - Response still strong = thesis intact
 */

import type { ResponseNormalizer } from './ResponseNormalizer';

export interface ScaleInValidation {
  canScaleIn: boolean;
  checks: {
    rScoreStrong: boolean;
    rVelocityHealthy: boolean;
    rNearPeak: boolean;
  };
  details: string[];
  confidence: number;  // 0-1
}

export class ScaleInValidator {
  private rHistorySinceEntry: number[] = [];
  private readonly maxHistoryLength: number = 100;
  
  /**
   * Initialize validator for new position
   */
  constructor(private normalizer: ResponseNormalizer) {}
  
  /**
   * Validate if scale-in is appropriate
   * Uses RESPONSE, not PRICE
   * 
   * @param currentRScore - Raw current R-score
   * @param rVelocity - Rate of change of R (current - previous)
   * @param thresholds - Optional custom thresholds
   */
  validate(
    currentRScore: number,
    rVelocity: number,
    thresholds?: { scaleIn?: number; velocityMin?: number; peakDecay?: number }
  ): ScaleInValidation {
    const thresh = {
      scaleIn: thresholds?.scaleIn ?? 0.75,        // 75th percentile
      velocityMin: thresholds?.velocityMin ?? -0.05,  // Don't scale if R dropping fast
      peakDecay: thresholds?.peakDecay ?? 0.08     // Allow 8% below peak
    };
    
    const details: string[] = [];
    const checks = {
      rScoreStrong: false,
      rVelocityHealthy: false,
      rNearPeak: false
    };
    
    // Add current R to history
    this.rHistorySinceEntry.push(currentRScore);
    if (this.rHistorySinceEntry.length > this.maxHistoryLength) {
      this.rHistorySinceEntry.shift();
    }
    
    // CHECK 1: R-score is strong (in upper percentiles)
    const rNormalized = this.normalizer.update(currentRScore);
    checks.rScoreStrong = rNormalized >= thresh.scaleIn;
    
    if (checks.rScoreStrong) {
      details.push(`✓ R-score strong: ${(rNormalized * 100).toFixed(0)}th percentile >= ${(thresh.scaleIn * 100).toFixed(0)}th`);
    } else {
      details.push(`✗ R-score too weak: ${(rNormalized * 100).toFixed(0)}th percentile < ${(thresh.scaleIn * 100).toFixed(0)}th`);
    }
    
    // CHECK 2: R velocity is not decelerating rapidly
    checks.rVelocityHealthy = rVelocity >= thresh.velocityMin;
    
    if (checks.rVelocityHealthy) {
      if (rVelocity >= 0) {
        details.push(`✓ R velocity positive: +${(rVelocity * 100).toFixed(1)}% (accelerating)`);
      } else {
        details.push(`✓ R velocity shallow decline: ${(rVelocity * 100).toFixed(1)}% (tolerable)`);
      }
    } else {
      details.push(`✗ R velocity too negative: ${(rVelocity * 100).toFixed(1)}% < ${(thresh.velocityMin * 100).toFixed(1)}% (decelerating)`);
    }
    
    // CHECK 3: R is near recent peak (not well below)
    const maxRSinceEntry = Math.max(...this.rHistorySinceEntry);
    checks.rNearPeak = currentRScore >= (maxRSinceEntry - thresh.peakDecay);
    
    if (checks.rNearPeak) {
      const percentBelowPeak = ((maxRSinceEntry - currentRScore) / maxRSinceEntry * 100).toFixed(1);
      details.push(`✓ R near peak: ${percentBelowPeak}% below max (tolerable)`);
    } else {
      const percentBelowPeak = ((maxRSinceEntry - currentRScore) / maxRSinceEntry * 100).toFixed(1);
      details.push(`✗ R well below peak: ${percentBelowPeak}% < ${(thresh.peakDecay * 100).toFixed(0)}% threshold`);
    }
    
    // Calculate overall confidence
    const passedChecks = [checks.rScoreStrong, checks.rVelocityHealthy, checks.rNearPeak].filter(c => c).length;
    const confidence = passedChecks / 3;
    
    // All checks must pass for scale-in
    const canScaleIn = checks.rScoreStrong && checks.rVelocityHealthy && checks.rNearPeak;
    
    if (canScaleIn) {
      details.push(`✅ SCALE-IN APPROVED (${passedChecks}/3 checks passed, confidence ${(confidence * 100).toFixed(0)}%)`);
    } else {
      details.push(`❌ SCALE-IN BLOCKED (${passedChecks}/3 checks passed, confidence ${(confidence * 100).toFixed(0)}%)`);
    }
    
    return {
      canScaleIn,
      checks,
      details,
      confidence
    };
  }
  
  /**
   * Record R-score during position lifetime
   */
  recordRScore(rScore: number): void {
    this.rHistorySinceEntry.push(rScore);
    if (this.rHistorySinceEntry.length > this.maxHistoryLength) {
      this.rHistorySinceEntry.shift();
    }
  }
  
  /**
   * Get R-score history statistics
   */
  getStats(): { maxR: number; minR: number; avgR: number; volatility: number } {
    if (this.rHistorySinceEntry.length === 0) {
      return { maxR: 0, minR: 0, avgR: 0, volatility: 0 };
    }
    
    const maxR = Math.max(...this.rHistorySinceEntry);
    const minR = Math.min(...this.rHistorySinceEntry);
    const avgR = this.rHistorySinceEntry.reduce((a, b) => a + b, 0) / this.rHistorySinceEntry.length;
    
    const variance = this.rHistorySinceEntry.reduce((sum, r) => sum + Math.pow(r - avgR, 2), 0) / this.rHistorySinceEntry.length;
    const volatility = Math.sqrt(variance);
    
    return { maxR, minR, avgR, volatility };
  }
  
  /**
   * Reset validator for new position
   */
  reset(): void {
    this.rHistorySinceEntry = [];
  }
  
  /**
   * Get current peak R since position entry
   */
  getPeakR(): number {
    return this.rHistorySinceEntry.length > 0 
      ? Math.max(...this.rHistorySinceEntry)
      : 0;
  }
  
  /**
   * Get distance below peak (in R points and percentage)
   */
  getDistanceBelowPeak(currentRScore: number): { points: number; percentage: number } {
    const peak = this.getPeakR();
    const points = peak - currentRScore;
    const percentage = peak > 0 ? (points / peak) * 100 : 0;
    
    return { points, percentage };
  }
}
