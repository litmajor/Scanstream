/**
 * Cluster Validator Service
 * 
 * Converts raw clustering metrics into entry quality signals
 * Implements entry quality scoring formula with confidence levels
 * 
 * ✅ Now uses RL-adaptive thresholds instead of hardcoded values
 * 
 * Formula:
 * final_quality = base_quality × 
 *   (0.4 × trend_formation_strength +
 *    0.3 × cluster_strength +
 *    0.2 × candle_consistency +
 *    0.1 × momentum_follow_through)
 */

import { getAdaptiveClusterThreshold, validateClusterGate } from '../../rl-system-integration';
import { getConfidenceScorer } from '../market-data/confidence-scorer';
import { getSharedService } from '../shared-service-registry';
import { MarketFrame } from '@shared/schema';
import type { Candle } from '../../types/market-data';

export interface ClusterMetrics {
  trend_formation_signal: boolean;
  cluster_strength: number; // 0-1
  directional_ratio: number; // 0-1 (% of candles in dominant direction)
  follow_through: number; // 0-1 (follow-through percentage)
  total_clusters: number;
  bullish_clusters: number;
  bearish_clusters: number;
  // Optional extended metrics
  avg_cluster_size?: number;
  max_cluster_size?: number;
  neutral_ratio?: number; // proportion of candles considered neutral/choppy
  volatility?: number; // 0-1 normalized volatility estimate
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
  // How much volatility should dampen cluster strength (0-1)
  volatility_weight?: number;
  // Minimum cluster size to count (ignore 1-candle clusters)
  min_cluster_size?: number;
  
  // Quality thresholds
  minimum_quality_for_entry: number; // 0.52 (52%)
  high_quality_threshold: number; // 0.72 (72%)
  very_high_quality_threshold: number; // 0.87 (87%)
  
  // Confidence level thresholds
  low_quality_ceiling: number; // < 0.50
  moderate_quality_ceiling: number; // 0.50-0.70
  high_quality_ceiling: number; // 0.70-0.85
  very_high_quality_floor: number; // >= 0.85
}

const DEFAULT_CONFIG: ClusterValidationConfig = {
  trend_formation_weight: 0.40,
  cluster_strength_weight: 0.30,
  candle_consistency_weight: 0.20,
  follow_through_weight: 0.10,
  volatility_weight: 0.10,
  min_cluster_size: 2,
  minimum_quality_for_entry: 0.52,
  high_quality_threshold: 0.72,
  very_high_quality_threshold: 0.87,
  low_quality_ceiling: 0.50,
  moderate_quality_ceiling: 0.70,
  high_quality_ceiling: 0.85,
  very_high_quality_floor: 0.85
};

export class ClusterValidator {
  private config: ClusterValidationConfig;
  private frames: MarketFrame[] = [];
  private rlThreshold: any = null;
  private minClusterSize: number;
  private volatilityWeight: number;

  constructor(config?: Partial<ClusterValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.minClusterSize = this.config.min_cluster_size || 2;
    this.volatilityWeight = this.config.volatility_weight ?? 0.1;
  }

  /**
   * Return a safe default ClusterMetrics object
   */
  static getDefaultMetrics(): ClusterMetrics {
    return {
      trend_formation_signal: false,
      cluster_strength: 0,
      directional_ratio: 0,
      follow_through: 0,
      total_clusters: 0,
      bullish_clusters: 0,
      bearish_clusters: 0,
      avg_cluster_size: 0,
      max_cluster_size: 0,
      neutral_ratio: 0,
      volatility: 0
    };
  }

  /**
   * Set market frames for RL adaptive threshold calculation
   * Call this before validateEntry to enable RL-adaptive thresholds
   */
  setMarketContext(
    frames: MarketFrame[],
    mlConfidence: number = 0.5,
    regime: string = 'NEUTRAL',
    drawdown: number = 0
  ): void {
    this.frames = frames;
    
    try {
      // Get RL-adaptive thresholds
      this.rlThreshold = getAdaptiveClusterThreshold(frames, mlConfidence, regime, drawdown);
    } catch (error) {
      console.warn('[ClusterValidator] RL threshold calculation failed, using defaults');
      this.rlThreshold = null;
    }
  }

  /**
   * Compute cluster metrics from a candle array.
   * This helper implements a minimum-cluster-size policy and returns
   * extra diagnostics (avg/max cluster size, neutralRatio, volatility).
   */
  static computeClusterMetricsFromCandles(candles: Candle[], minClusterSize = 2): ClusterMetrics {
    // Direction per candle: 1 = up, -1 = down, 0 = neutral
    const dirs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].close;
      const cur = candles[i].close;
      const diff = cur - prev;
      if (Math.abs(diff) < Number.EPSILON) dirs.push(0);
      else dirs.push(diff > 0 ? 1 : -1);
    }

    let currentDirection: number | null = null;
    let currentClusterLength = 0;
    let total = 0;
    let bullish = 0;
    let bearish = 0;
    const clusterSizes: number[] = [];
    let neutralCount = 0;

    for (const d of dirs) {
      const dir = d === 0 ? 0 : d;
      if (dir === 0) {
        neutralCount++;
        // treat neutral as cluster boundary
        if (currentDirection !== null) {
          if (currentClusterLength >= minClusterSize) {
            total++;
            if (currentDirection === 1) bullish++; else bearish++;
            clusterSizes.push(currentClusterLength);
          }
          currentClusterLength = 0;
          currentDirection = null;
        }
        continue;
      }

      if (dir !== currentDirection && currentDirection !== null) {
        if (currentClusterLength >= minClusterSize) {
          total++;
          if (currentDirection === 1) bullish++; else bearish++;
          clusterSizes.push(currentClusterLength);
        }
        currentClusterLength = 1;
        currentDirection = dir;
      } else {
        currentClusterLength++;
        if (currentDirection === null) currentDirection = dir;
      }
    }

    // finalize last cluster
    if (currentDirection !== null && currentClusterLength >= minClusterSize) {
      total++;
      if (currentDirection === 1) bullish++; else bearish++;
      clusterSizes.push(currentClusterLength);
    }

    const avgClusterSize = clusterSizes.length > 0 ? clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length : 0;
    const maxClusterSize = clusterSizes.length > 0 ? Math.max(...clusterSizes) : 0;
    const neutralRatio = dirs.length > 0 ? neutralCount / dirs.length : 0;

    // Simple volatility estimate: stddev of returns normalized
    const returns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const r = (candles[i].close - candles[i - 1].close) / (candles[i - 1].close || 1);
      returns.push(r);
    }
    const mean = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 0 ? returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length : 0;
    const volatility = Math.min(1, Math.sqrt(variance));

    // Build a cluster_strength proxy: proportion of non-neutral clusters weighted by size
    const nonNeutralProportion = dirs.length > 0 ? (dirs.length - neutralCount) / dirs.length : 0;
    const cluster_strength = total > 0 ? Math.min(1, (clusterSizes.reduce((a, b) => a + b, 0) / (dirs.length || 1)) ) : nonNeutralProportion;

    return {
      trend_formation_signal: avgClusterSize >= minClusterSize,
      cluster_strength,
      directional_ratio: dirs.length > 0 ? Math.max(bullish, bearish) / (bullish + bearish || 1) : 0,
      follow_through: 0, // caller should compute follow-through separately
      total_clusters: total,
      bullish_clusters: bullish,
      bearish_clusters: bearish,
      avg_cluster_size: avgClusterSize,
      max_cluster_size: maxClusterSize,
      neutral_ratio: neutralRatio,
      volatility
    };
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

    try {
      const scorer = getConfidenceScorer();
      const scored = scorer.scoreWithCurrentMode(baseSignalQuality, 'cluster');
      baseSignalQuality = scored.adjusted;
    } catch (e) {
      // ignore scorer failures
    }

    // ─────────────────────────────────────────────────────────────────────
    // NEW: Check RL-adaptive cluster gate if thresholds are available
    // ─────────────────────────────────────────────────────────────────────
    if (this.rlThreshold && this.rlThreshold.isRLControlled) {
      const passesRLGate = validateClusterGate(
        {
          cluster_strength: clusterMetrics.cluster_strength,
          follow_through: clusterMetrics.follow_through,
          directional_ratio: clusterMetrics.directional_ratio
        },
        this.rlThreshold
      );
      
      if (!passesRLGate) {
        // RL gate rejected this signal
        // Return very low quality (skip signal)
        const rejectedEntry: ClusterEnhancedEntry = {
          base_signal_quality: baseSignalQuality,
          cluster_validation: {
            trend_forming: clusterMetrics.trend_formation_signal,
            formation_strength: clusterMetrics.trend_formation_signal ? 1.0 : 0.3,
            candle_consistency: clusterMetrics.directional_ratio,
            momentum_follow_through: clusterMetrics.follow_through
          },
          final_entry_quality: 0.25, // Below minimum
          confidence_level: 'low',
          entry_recommendation: 'skip',
          size_multiplier: 0.0,
          reasoning: [
            `[RL-GATE] Signal rejected by adaptive cluster thresholds`,
            `Cluster strength: ${(clusterMetrics.cluster_strength * 100).toFixed(0)}% < ${(this.rlThreshold.minClusterStrength * 100).toFixed(0)}% required`,
            `Follow-through: ${(clusterMetrics.follow_through * 100).toFixed(0)}% < ${(this.rlThreshold.minFollowThrough * 100).toFixed(0)}% required`,
            `Directional ratio: ${(clusterMetrics.directional_ratio * 100).toFixed(0)}% < ${(this.rlThreshold.minDirectionalRatio * 100).toFixed(0)}% required`
          ]
        };
        return rejectedEntry;
      }
      // RL gate passed — optionally boost quality slightly (conservative)
      // This is a small trust boost from the RL controller
      // Mark that RL gate passed so we can apply boost after base quality calculation
      (clusterMetrics as any)._rlGatePassed = true;
    }

    // Build cluster validation scores
    const trend_strength = clusterMetrics.trend_formation_signal ? 1.0 : 0.3;
    const cluster_strength = clusterMetrics.cluster_strength;
    const candle_consistency = clusterMetrics.directional_ratio;
    const momentum_follow_through = clusterMetrics.follow_through;

    // Adjust cluster strength based on volatility (high volatility should dampen cluster strength)
    let adjusted_cluster_strength = cluster_strength;
    const vol = clusterMetrics.volatility ?? 0;
    if (this.volatilityWeight > 0) {
      adjusted_cluster_strength = cluster_strength * (1 - this.volatilityWeight) + (1 - vol) * this.volatilityWeight;
      adjusted_cluster_strength = Math.max(0, Math.min(1, adjusted_cluster_strength));
    }

    // Calculate combined cluster quality score
    const cluster_quality_score =
      this.config.trend_formation_weight * trend_strength +
      this.config.cluster_strength_weight * adjusted_cluster_strength +
      this.config.candle_consistency_weight * candle_consistency +
      this.config.follow_through_weight * momentum_follow_through;

    // Final quality = base signal × cluster validation
    const final_entry_quality = baseSignalQuality * cluster_quality_score;

    // If RL gate passed earlier, apply a small conservative boost (cap at 1.0)
    const rlPassed = (clusterMetrics as any)._rlGatePassed === true;
    const boosted_final_quality = rlPassed ? Math.min(1.0, final_entry_quality * 1.10) : final_entry_quality;

    // Determine confidence level
    const confidence_level = this.getConfidenceLevel(boosted_final_quality);

    // Get recommendation and multiplier
    const { recommendation, multiplier } = this.getRecommendation(
      boosted_final_quality,
      clusterMetrics.trend_formation_signal
    );

    // Build reasoning
    const reasoning = this.buildReasoning(
      baseSignalQuality,
      clusterMetrics,
      boosted_final_quality,
      confidence_level
    );

    // If clusterMetrics contains a symbol hint, consult TruthEngine consensus to further adjust quality
    try {
      const symbol = (clusterMetrics as any)._symbol as string | undefined;
      const truth = getSharedService('truthEngine');
      if (symbol && truth && typeof truth.getConsensus === 'function') {
        const cons = truth.getConsensus(symbol);
        if (cons && typeof cons.confidence === 'number') {
          const consConf = Math.max(0, Math.min(1, cons.confidence / 100));
          // Blend final quality conservatively with consensus confidence
          const blendFactor = 0.5; // how much to trust RL/cluster vs canonical consensus
          const adjustedFinal = Math.min(1, boosted_final_quality * (1 - blendFactor) + (boosted_final_quality * consConf) * blendFactor);
          // add reasoning note
          reasoning.push(`[Consensus] blended with canonical confidence ${(cons.confidence || 0).toFixed(0)}% -> quality ${(adjustedFinal * 100).toFixed(0)}%`);
          // Apply adjusted final quality
          const finalResult: ClusterEnhancedEntry = {
            base_signal_quality: baseSignalQuality,
            cluster_validation: {
              trend_forming: clusterMetrics.trend_formation_signal,
              formation_strength: trend_strength,
              candle_consistency,
              momentum_follow_through
            },
            final_entry_quality: adjustedFinal,
            confidence_level: this.getConfidenceLevel(adjustedFinal),
            entry_recommendation: this.getRecommendation(adjustedFinal, clusterMetrics.trend_formation_signal).recommendation,
            size_multiplier: this.getRecommendation(adjustedFinal, clusterMetrics.trend_formation_signal).multiplier,
            reasoning
          };
          return finalResult;
        }
      }
    } catch (e) {
      // ignore consensus integration failures
    }

    return {
      base_signal_quality: baseSignalQuality,
      cluster_validation: {
        trend_forming: clusterMetrics.trend_formation_signal,
        formation_strength: trend_strength,
        candle_consistency,
        momentum_follow_through
      },
      final_entry_quality: boosted_final_quality,
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

    if (typeof metrics.avg_cluster_size === 'number') {
      reasons.push(`Avg cluster size: ${metrics.avg_cluster_size.toFixed(2)} bars (max ${metrics.max_cluster_size || 0})`);
    }

    if (typeof metrics.neutral_ratio === 'number' && metrics.neutral_ratio > 0.15) {
      reasons.push(`Market shows choppiness (neutral ratio ${(metrics.neutral_ratio * 100).toFixed(0)}%)`);
    }

    if (typeof metrics.volatility === 'number') {
      reasons.push(`Volatility: ${(metrics.volatility * 100).toFixed(1)}% (used weight=${this.volatilityWeight})`);
    }

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
