/**
 * Reversal Detector Service
 * 
 * Cluster breakdown detection for reversal trading
 * Tracks cluster strength changes to predict trend endings
 * 
 * Detects:
 * - Mild breakdown: 10-30% drop in cluster strength
 * - Moderate breakdown: 30-50% drop
 * - Severe breakdown: 50%+ drop (trend ending)
 */

export interface ClusterSnapshot {
  cluster_strength: number; // 0-1
  trend_formation_signal: boolean;
  directional_ratio: number;
  follow_through: number;
  timestamp: number;
}

export interface ClusterBreakdown {
  previous_cluster_strength: number;
  current_cluster_strength: number;
  strength_decline: number; // Absolute decline (0-1)
  decline_percentage: number; // Relative decline (0-100%)
  breakdown_severity: 'none' | 'mild' | 'moderate' | 'severe';
  formation_loss: boolean; // Was trend_formation true, now false?
  reversal_probability: number; // 0-1 (0.4 to 0.95)
  reversal_confidence: 'low' | 'moderate' | 'high' | 'very_high';
  reasoning: string[];
}

export interface ReversalDetectorConfig {
  // Breakdown severity thresholds
  mild_threshold: number; // 0.1 (10% decline)
  moderate_threshold: number; // 0.3 (30% decline)
  severe_threshold: number; // 0.5 (50% decline)
  
  // Reversal probability calculation
  base_reversal_probability: number; // 0.4 (40%)
  decline_bonus_multiplier: number; // 0.4 (decline * 0.4)
  formation_loss_bonus: number; // 0.2 (20% bonus if formation lost)
  
  // Timeframe lookback for trend detection
  lookback_periods: number; // How many previous snapshots to track
  
  // Filtering
  minimum_decline_for_detection: number; // 0.05 (5%)
}

const DEFAULT_CONFIG: ReversalDetectorConfig = {
  mild_threshold: 0.1,
  moderate_threshold: 0.3,
  severe_threshold: 0.5,
  base_reversal_probability: 0.4,
  decline_bonus_multiplier: 0.4,
  formation_loss_bonus: 0.2,
  lookback_periods: 20,
  minimum_decline_for_detection: 0.05
};

export class ReversalDetector {
  private config: ReversalDetectorConfig;
  private history: ClusterSnapshot[] = [];
  private maxHistorySize: number;

  constructor(config?: Partial<ReversalDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxHistorySize = this.config.lookback_periods;
  }

  /**
   * Detect cluster breakdown from current vs previous snapshot
   */
  detectBreakdown(
    previousSnapshot: ClusterSnapshot,
    currentSnapshot: ClusterSnapshot
  ): ClusterBreakdown {
    const prev_strength = previousSnapshot.cluster_strength;
    const curr_strength = currentSnapshot.cluster_strength;
    
    // Calculate decline metrics
    const strength_decline = prev_strength - curr_strength;
    const decline_percentage =
      prev_strength > 0 ? (strength_decline / prev_strength) * 100 : 0;
    
    // Determine severity
    const breakdown_severity = this.getSeverity(strength_decline);
    
    // Formation loss detection
    const formation_loss =
      previousSnapshot.trend_formation_signal &&
      !currentSnapshot.trend_formation_signal;
    
    // Calculate reversal probability
    const reversal_probability = this.calculateReversalProbability(
      strength_decline,
      formation_loss
    );
    
    // Determine confidence
    const reversal_confidence = this.getConfidence(reversal_probability);
    
    // Build reasoning
    const reasoning = this.buildReasoning(
      prev_strength,
      curr_strength,
      strength_decline,
      breakdown_severity,
      formation_loss,
      reversal_probability
    );

    return {
      previous_cluster_strength: prev_strength,
      current_cluster_strength: curr_strength,
      strength_decline,
      decline_percentage,
      breakdown_severity,
      formation_loss,
      reversal_probability,
      reversal_confidence,
      reasoning
    };
  }

  /**
   * Detect breakdown with automatic history tracking
   * Returns None if insufficient history
   */
  addSnapshot(snapshot: ClusterSnapshot): ClusterBreakdown | null {
    // Add to history
    this.history.push(snapshot);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Need at least 2 snapshots
    if (this.history.length < 2) {
      return null;
    }

    // Detect from previous and current
    const previousSnapshot = this.history[this.history.length - 2];
    const currentSnapshot = this.history[this.history.length - 1];

    return this.detectBreakdown(previousSnapshot, currentSnapshot);
  }

  /**
   * Get severity from strength decline
   */
  private getSeverity(
    decline: number
  ): 'none' | 'mild' | 'moderate' | 'severe' {
    if (decline < this.config.minimum_decline_for_detection) return 'none';
    if (decline < this.config.mild_threshold) return 'mild';
    if (decline < this.config.moderate_threshold) return 'moderate';
    return 'severe';
  }

  /**
   * Calculate reversal probability based on breakdown
   */
  private calculateReversalProbability(
    decline: number,
    formation_loss: boolean
  ): number {
    let probability = this.config.base_reversal_probability;

    // Decline bonus (up to 40%)
    const decline_bonus = Math.min(decline, 1.0) * this.config.decline_bonus_multiplier;
    probability += decline_bonus;

    // Formation loss bonus (20%)
    if (formation_loss) {
      probability += this.config.formation_loss_bonus;
    }

    // Cap at 95%
    return Math.min(probability, 0.95);
  }

  /**
   * Get confidence level from probability
   */
  private getConfidence(probability: number): 'low' | 'moderate' | 'high' | 'very_high' {
    if (probability >= 0.75) return 'very_high';
    if (probability >= 0.60) return 'high';
    if (probability >= 0.45) return 'moderate';
    return 'low';
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoning(
    prevStrength: number,
    currStrength: number,
    decline: number,
    severity: string,
    formationLoss: boolean,
    probability: number
  ): string[] {
    const reasons: string[] = [];

    reasons.push(
      `Cluster strength: ${(prevStrength * 100).toFixed(0)}% → ${(currStrength * 100).toFixed(0)}%`
    );

    reasons.push(
      `Decline: ${(decline * 100).toFixed(0)}% (${severity})`
    );

    if (formationLoss) {
      reasons.push(`✗ Trend formation LOST`);
    }

    reasons.push(
      `Reversal probability: ${(probability * 100).toFixed(0)}%`
    );

    // Specific insights
    if (severity === 'severe') {
      reasons.push(`⚠️ SEVERE breakdown - trend is likely ending`);
    } else if (severity === 'moderate') {
      reasons.push(`Moderate breakdown - trend weakening`);
    }

    if (probability >= 0.70) {
      reasons.push(`💡 HIGH REVERSAL CONVICTION - consider entry`);
    }

    return reasons;
  }

  /**
   * Check if reversal signal is strong enough to act on
   */
  isStrongReversalSignal(breakdown: ClusterBreakdown): boolean {
    return breakdown.reversal_probability > 0.65;
  }

  /**
   * Apply reversal probability as filter to existing signal
   */
  filterSignal(
    baseSignalConfidence: number,
    breakdown: ClusterBreakdown
  ): {
    filtered_confidence: number;
    confidence_multiplier: number;
  } {
    const multiplier = breakdown.reversal_probability;
    const filtered = baseSignalConfidence * multiplier;

    return {
      filtered_confidence: filtered,
      confidence_multiplier: multiplier
    };
  }

  /**
   * Detect multi-period breakdown (for stronger signals)
   */
  detectMultiPeriodBreakdown(
    minConsecutiveDeclines: number = 2
  ): {
    is_multi_period: boolean;
    consecutive_declines: number;
    total_decline: number;
  } {
    if (this.history.length < minConsecutiveDeclines + 1) {
      return {
        is_multi_period: false,
        consecutive_declines: 0,
        total_decline: 0
      };
    }

    let consecutive = 0;
    let totalDecline = 0;

    for (let i = this.history.length - 1; i > 0; i--) {
      const prev = this.history[i - 1];
      const curr = this.history[i];
      const decline = prev.cluster_strength - curr.cluster_strength;

      if (decline > 0) {
        consecutive++;
        totalDecline += decline;
      } else {
        break;
      }
    }

    return {
      is_multi_period: consecutive >= minConsecutiveDeclines,
      consecutive_declines: consecutive,
      total_decline: totalDecline
    };
  }

  /**
   * Get current trend strength trend (accelerating/stabilizing/reversing)
   */
  getTrendStrengthTrend(): 'accelerating' | 'stable' | 'reversing' {
    if (this.history.length < 3) return 'stable';

    const recent = this.history.slice(-3);
    const trend1 = recent[1].cluster_strength - recent[0].cluster_strength;
    const trend2 = recent[2].cluster_strength - recent[1].cluster_strength;

    if (trend2 > 0 && trend1 > 0 && trend2 > trend1) return 'accelerating';
    if (trend2 < 0 && trend1 < 0 && Math.abs(trend2) > Math.abs(trend1)) return 'reversing';
    return 'stable';
  }

  /**
   * Get historical breakdown statistics
   */
  getBreakdownStatistics(): {
    total_snapshots: number;
    average_strength: number;
    strength_range: { min: number; max: number };
    trend_direction: 'strengthening' | 'weakening';
  } {
    if (this.history.length === 0) {
      return {
        total_snapshots: 0,
        average_strength: 0,
        strength_range: { min: 0, max: 0 },
        trend_direction: 'stable' as const
      };
    }

    const strengths = this.history.map(s => s.cluster_strength);
    const average = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    const min = Math.min(...strengths);
    const max = Math.max(...strengths);

    // Determine trend: first half vs second half
    const midpoint = Math.floor(this.history.length / 2);
    const firstHalf = strengths.slice(0, midpoint);
    const secondHalf = strengths.slice(midpoint);

    const firstAvg =
      firstHalf.length > 0 
        ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        : 0;
    const secondAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        : 0;

    const trend_direction: 'strengthening' | 'weakening' =
      secondAvg >= firstAvg ? 'strengthening' : 'weakening';

    return {
      total_snapshots: this.history.length,
      average_strength: parseFloat(average.toFixed(3)),
      strength_range: { min, max },
      trend_direction
    };
  }

  /**
   * Reset history
   */
  reset(): void {
    this.history = [];
  }
}

/**
 * Factory function for creating detector instances
 */
export function createReversalDetector(
  config?: Partial<ReversalDetectorConfig>
): ReversalDetector {
  return new ReversalDetector(config);
}

/**
 * Quick detection helper (stateless)
 */
export function quickDetectBreakdown(
  previousSnapshot: ClusterSnapshot,
  currentSnapshot: ClusterSnapshot
): ClusterBreakdown {
  const detector = new ReversalDetector();
  return detector.detectBreakdown(previousSnapshot, currentSnapshot);
}
