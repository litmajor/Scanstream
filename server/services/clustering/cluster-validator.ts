/**
 * Cluster Validator Service
 * 
 * Converts raw clustering metrics into entry quality signals
 * Implements entry quality scoring formula with confidence levels
 * 
 * Formula:
 * final_quality = base_quality × 
 *   (0.4 × trend_formation_strength +
 *    0.3 × cluster_strength +
 *    0.2 × candle_consistency +
 *    0.1 × momentum_follow_through)
 */

export interface ClusterMetrics {
  trend_formation_signal: boolean;
  cluster_strength: number; // 0-1
  directional_ratio: number; // 0-1 (% of candles in dominant direction)
  follow_through: number; // 0-1 (follow-through percentage)
  total_clusters: number;
  bullish_clusters: number;
  bearish_clusters: number;
}

export interface ClusterEnhancedEntry {
  base_signal_quality: number; // 0-1 (existing agent signal)
  cluster_validation: {
    trend_forming: boolean;
    formation_strength: number; // 0-1
    candle_consistency: number; // 0-1
    momentum_follow_through: number; // 0-1
  };
  final_entry_quality: number; // 0-1 (combined score)
  confidence_level: 'low' | 'moderate' | 'high' | 'very_high';
  entry_recommendation: 'skip' | 'small' | 'normal' | 'aggressive';
  size_multiplier: number; // 0.1 to 1.0 (apply to normal position size)
  reasoning: string[];
}

export interface ClusterValidationConfig {
  trend_formation_weight: number; // 0.4
  cluster_strength_weight: number; // 0.3
  candle_consistency_weight: number; // 0.2
  follow_through_weight: number; // 0.1
  
  // Quality thresholds
  minimum_quality_for_entry: number; // 0.50 (50%)
  high_quality_threshold: number; // 0.70 (70%)
  very_high_quality_threshold: number; // 0.85 (85%)
  
  // Confidence level thresholds
  low_quality_ceiling: number; // < 0.50
  moderate_quality_ceiling: number; // 0.50-0.70
  high_quality_ceiling: number; // 0.70-0.85
  very_high_quality_floor: number; // >= 0.85
}

const DEFAULT_CONFIG: ClusterValidationConfig = {
  trend_formation_weight: 0.4,
  cluster_strength_weight: 0.3,
  candle_consistency_weight: 0.2,
  follow_through_weight: 0.1,
  minimum_quality_for_entry: 0.50,
  high_quality_threshold: 0.70,
  very_high_quality_threshold: 0.85,
  low_quality_ceiling: 0.50,
  moderate_quality_ceiling: 0.70,
  high_quality_ceiling: 0.85,
  very_high_quality_floor: 0.85
};

export class ClusterValidator {
  private config: ClusterValidationConfig;

  constructor(config?: Partial<ClusterValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate entry signal with cluster metrics
   * Returns quality score and recommendation
   */
  validateEntry(
    baseSignalQuality: number, // 0-1 from agent
    clusterMetrics: ClusterMetrics
  ): ClusterEnhancedEntry {
    // Validate inputs
    baseSignalQuality = Math.max(0, Math.min(1, baseSignalQuality));

    // Build cluster validation scores
    const trend_strength = clusterMetrics.trend_formation_signal ? 1.0 : 0.3;
    const cluster_strength = clusterMetrics.cluster_strength;
    const candle_consistency = clusterMetrics.directional_ratio;
    const momentum_follow_through = clusterMetrics.follow_through;

    // Calculate combined cluster quality score
    const cluster_quality_score =
      this.config.trend_formation_weight * trend_strength +
      this.config.cluster_strength_weight * cluster_strength +
      this.config.candle_consistency_weight * candle_consistency +
      this.config.follow_through_weight * momentum_follow_through;

    // Final quality = base signal × cluster validation
    const final_entry_quality = baseSignalQuality * cluster_quality_score;

    // Determine confidence level
    const confidence_level = this.getConfidenceLevel(final_entry_quality);

    // Get recommendation and multiplier
    const { recommendation, multiplier } = this.getRecommendation(
      final_entry_quality,
      clusterMetrics.trend_formation_signal
    );

    // Build reasoning
    const reasoning = this.buildReasoning(
      baseSignalQuality,
      clusterMetrics,
      final_entry_quality,
      confidence_level
    );

    return {
      base_signal_quality: baseSignalQuality,
      cluster_validation: {
        trend_forming: clusterMetrics.trend_formation_signal,
        formation_strength: trend_strength,
        candle_consistency,
        momentum_follow_through
      },
      final_entry_quality,
      confidence_level,
      entry_recommendation: recommendation,
      size_multiplier: multiplier,
      reasoning
    };
  }

  /**
   * Get confidence level based on quality score
   */
  private getConfidenceLevel(
    quality: number
  ): 'low' | 'moderate' | 'high' | 'very_high' {
    if (quality >= this.config.very_high_quality_floor) return 'very_high';
    if (quality >= this.config.high_quality_ceiling) return 'high';
    if (quality >= this.config.moderate_quality_ceiling) return 'moderate';
    return 'low';
  }

  /**
   * Get entry recommendation and position size multiplier
   */
  private getRecommendation(quality: number, trend_forming: boolean) {
    // Check minimum quality threshold
    if (quality < this.config.minimum_quality_for_entry) {
      return { recommendation: 'skip' as const, multiplier: 0.0 };
    }

    // Weak quality with no trend
    if (quality < this.config.moderate_quality_ceiling && !trend_forming) {
      return { recommendation: 'small' as const, multiplier: 0.3 };
    }

    // Moderate quality
    if (quality < this.config.high_quality_threshold) {
      return { recommendation: 'small' as const, multiplier: 0.6 };
    }

    // High quality
    if (quality < this.config.very_high_quality_threshold) {
      return { recommendation: 'normal' as const, multiplier: 1.0 };
    }

    // Very high quality
    return { recommendation: 'aggressive' as const, multiplier: 1.2 };
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoning(
    baseSignal: number,
    metrics: ClusterMetrics,
    finalQuality: number,
    confidence: string
  ): string[] {
    const reasons: string[] = [];

    reasons.push(`Base signal: ${(baseSignal * 100).toFixed(0)}%`);

    if (metrics.trend_formation_signal) {
      reasons.push(`✓ Trend formation detected`);
    } else {
      reasons.push(`✗ No trend formation`);
    }

    reasons.push(
      `Cluster strength: ${(metrics.cluster_strength * 100).toFixed(0)}% ` +
      `(consistency: ${(metrics.directional_ratio * 100).toFixed(0)}%, ` +
      `follow-through: ${(metrics.follow_through * 100).toFixed(0)}%)`
    );

    reasons.push(
      `Final quality: ${(finalQuality * 100).toFixed(0)}% (${confidence} confidence)`
    );

    // Add specific insights
    if (metrics.directional_ratio > 0.8) {
      reasons.push(`Strong candle consistency (80%+ aligned)`);
    }

    if (metrics.follow_through > 0.7) {
      reasons.push(`Good momentum follow-through`);
    }

    const bullishRatio = metrics.total_clusters > 0 
      ? metrics.bullish_clusters / metrics.total_clusters 
      : 0.5;
    
    if (bullishRatio > 0.75) {
      reasons.push(`Strongly bullish cluster composition`);
    } else if (bullishRatio < 0.25) {
      reasons.push(`Strongly bearish cluster composition`);
    }

    return reasons;
  }

  /**
   * Check if entry is valid (quality above threshold)
   */
  isValidEntry(quality: number): boolean {
    return quality >= this.config.minimum_quality_for_entry;
  }

  /**
   * Apply entry quality as multiplier to base position size
   */
  calculatePositionSize(
    baseSize: number,
    baseSignalQuality: number,
    clusterMetrics: ClusterMetrics
  ): number {
    const result = this.validateEntry(baseSignalQuality, clusterMetrics);
    return baseSize * result.size_multiplier;
  }

  /**
   * Batch validate multiple entries (for backtesting)
   */
  validateEntries(
    signals: Array<{ baseQuality: number; cluster: ClusterMetrics }>
  ): ClusterEnhancedEntry[] {
    return signals.map(({ baseQuality, cluster }) =>
      this.validateEntry(baseQuality, cluster)
    );
  }
}

/**
 * Factory function for creating validator instances
 */
export function createClusterValidator(
  config?: Partial<ClusterValidationConfig>
): ClusterValidator {
  return new ClusterValidator(config);
}

/**
 * Quick validation helper (stateless)
 */
export function quickValidateEntry(
  baseSignalQuality: number,
  clusterMetrics: ClusterMetrics
): ClusterEnhancedEntry {
  const validator = new ClusterValidator();
  return validator.validateEntry(baseSignalQuality, clusterMetrics);
}
