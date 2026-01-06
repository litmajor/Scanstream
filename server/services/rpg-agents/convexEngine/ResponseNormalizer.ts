/**
 * Response Score Normalizer
 * 
 * CRITICAL FIX #1: Regime-Adaptive Response Thresholds
 * 
 * Problem: R-score behavior differs across regimes
 * - Laminar Trend: R naturally high (0.65-0.90) → thresholds become too loose
 * - Consolidation: R moderate (0.35-0.70) → thresholds calibrated well
 * - Turbulent Chop: R naturally low (0.05-0.35) → thresholds become too strict
 * 
 * Solution: Use rolling percentile normalization
 * - Rank current R against last 200 bars of R scores
 * - Thresholds become regime-adaptive without re-optimization
 * - Self-healing: Percentiles shift as regime shifts
 */

export interface NormalizationThresholds {
  entry: number;              // Percentile rank (0.0-1.0) for entry threshold
  decay: number;              // Percentile rank for exit decay
  scaleIn: number;            // Percentile rank for scale-in
  strongConfidence: number;   // Percentile rank for strong conviction
}

export interface HealthIndicators {
  p25: number;      // 25th percentile of recent R-scores
  p50: number;      // Median (50th percentile)
  p75: number;      // 75th percentile
  p90: number;      // 90th percentile (very strong responses)
  responseCount: number;
}

export class ResponseNormalizer {
  private rHistory: number[] = [];
  private readonly maxHistoryLength: number;
  
  // Cached percentiles (updated after each new entry)
  private p25: number = 0;
  private p50: number = 0;
  private p75: number = 0;
  private p90: number = 0;
  
  /**
   * Initialize normalizer
   * @param lookbackBars - Number of bars to track (default 200)
   */
  constructor(lookbackBars: number = 200) {
    this.maxHistoryLength = lookbackBars;
  }
  
  /**
   * Update normalizer with new R-score
   * @param rScore - Raw response score (typically 0-1, but can be outside)
   * @returns Normalized R as percentile rank (0.0 = lowest quartile, 1.0 = highest)
   */
  update(rScore: number): number {
    // Add to history
    this.rHistory.push(rScore);
    if (this.rHistory.length > this.maxHistoryLength) {
      this.rHistory.shift();
    }
    
    // Need sufficient history to normalize
    if (this.rHistory.length < this.maxHistoryLength / 2) {
      // Not enough history; return raw score scaled to [0, 1]
      return Math.max(0, Math.min(1, rScore));
    }
    
    // Calculate percentiles
    this.updatePercentiles();
    
    // Return normalized rank
    return this.normalize(rScore);
  }
  
  /**
   * Calculate percentiles from history
   */
  private updatePercentiles(): void {
    const sorted = [...this.rHistory].sort((a, b) => a - b);
    const len = sorted.length;
    
    this.p25 = this.percentileValue(sorted, 0.25);
    this.p50 = this.percentileValue(sorted, 0.50);
    this.p75 = this.percentileValue(sorted, 0.75);
    this.p90 = this.percentileValue(sorted, 0.90);
  }
  
  /**
   * Get percentile value from sorted array
   */
  private percentileValue(sorted: number[], percentile: number): number {
    const index = (sorted.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sorted[lower];
    }
    
    // Linear interpolation between two values
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
  
  /**
   * Normalize a raw R-score to percentile rank
   * @returns 0.0 = lowest 25%, 0.5 = median, 1.0 = top 10%
   */
  private normalize(rScore: number): number {
    if (rScore <= this.p25) {
      return 0.0;
    } else if (rScore <= this.p50) {
      // Linear interpolation between p25 and p50 → [0.0, 0.5]
      if (this.p50 === this.p25) return 0.25;
      const ratio = (rScore - this.p25) / (this.p50 - this.p25);
      return 0.5 * ratio;
    } else if (rScore <= this.p75) {
      // Linear interpolation between p50 and p75 → [0.5, 0.75]
      if (this.p75 === this.p50) return 0.625;
      const ratio = (rScore - this.p50) / (this.p75 - this.p50);
      return 0.5 + 0.25 * ratio;
    } else {
      // Linear interpolation between p75 and p90 → [0.75, 1.0]
      if (this.p90 === this.p75) return 0.875;
      const ratio = (rScore - this.p75) / (this.p90 - this.p75);
      return 0.75 + 0.25 * Math.min(ratio, 1.0);  // Cap at 1.0
    }
  }
  
  /**
   * Get adaptive thresholds based on current percentile regime
   * These percentile-based thresholds auto-adjust as market regime changes
   */
  getAdaptiveThresholds(): NormalizationThresholds {
    return {
      entry: 0.65,              // Entry requires R ≥ 65th percentile of recent responses
      decay: 0.40,              // Exit if R ≤ 40th percentile
      scaleIn: 0.75,            // Scale-in only if R ≥ 75th percentile
      strongConfidence: 0.85    // High conviction at top 15% of responses
    };
  }
  
  /**
   * Get regime health indicators
   * Useful for diagnostics and monitoring
   */
  getHealthIndicators(): HealthIndicators {
    return {
      p25: this.p25,
      p50: this.p50,
      p75: this.p75,
      p90: this.p90,
      responseCount: this.rHistory.length
    };
  }
  
  /**
   * Get normalized score for display/logging
   * @param rScore - Raw R-score
   * @returns Percentile rank (0-100)
   */
  getNormalizedPercentile(rScore: number): number {
    return this.normalize(rScore) * 100;
  }
  
  /**
   * Reset normalizer (e.g., on symbol change)
   */
  reset(): void {
    this.rHistory = [];
    this.p25 = 0;
    this.p50 = 0;
    this.p75 = 0;
    this.p90 = 0;
  }
  
  /**
   * Check if current R-score passes entry threshold
   * @param rScore - Raw R-score
   * @param threshold - Optional custom threshold (default 0.65)
   */
  passesEntryThreshold(rScore: number, threshold: number = 0.65): boolean {
    return this.normalize(rScore) >= threshold;
  }
  
  /**
   * Check if current R-score indicates decay
   * @param rScore - Raw R-score
   * @param threshold - Optional custom threshold (default 0.40)
   */
  isDecaying(rScore: number, threshold: number = 0.40): boolean {
    return this.normalize(rScore) <= threshold;
  }
}
