/**
 * Pyramid Entry Strategy Service
 * 
 * Safely add to winning positions using cluster validation
 * Only pyramid when:
 * 1. Position is profitable (+1% minimum)
 * 2. Trend is forming (cluster detection)
 * 3. Clusters are strong (>0.65 strength)
 * 
 * Pyramid size based on cluster strength:
 * - 0.85+: 50% of original size
 * - 0.75-0.85: 30% of original
 * - 0.65-0.75: 15% of original
 */

export interface PyramidInput {
  original_entry_price: number;
  current_price: number;
  original_position_size: number;
  cluster_strength: number; // 0-1
  trend_formation: boolean;
  unrealized_profit?: number; // Optional: override profit calc
}

export interface PyramidDecision {
  original_entry_price: number;
  current_price: number;
  profit_pct: number;
  cluster_strength: number;
  trend_formation: boolean;
  
  pyramid_recommended: boolean;
  pyramid_size: number; // Units to add
  pyramid_ratio: number; // Percentage of original (0.15 to 0.5)
  new_position_size: number; // Total after pyramid
  new_average_entry: number; // Blended average entry price
  
  reasoning: string[];
  risk_assessment: {
    is_safe: boolean;
    confidence_level: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
    safety_score: number; // 0-1
  };
}

export interface PyramidConfig {
  // Entry conditions
  min_profit_pct: number; // 1.0% minimum
  min_cluster_strength: number; // 0.65 minimum
  require_trend_formation: boolean; // Must have trend signal
  
  // Pyramid sizes by cluster strength
  pyramid_size_very_strong: number; // 0.85+: 50%
  pyramid_size_strong: number; // 0.75-0.85: 30%
  pyramid_size_moderate: number; // 0.65-0.75: 15%
  
  // Safety checks
  max_pyramid_size: number; // Don't add more than 100% (max 2x position)
  max_consecutive_pyramids: number; // Max 3 pyramids per position
}

const DEFAULT_CONFIG: PyramidConfig = {
  min_profit_pct: 1.0,
  min_cluster_strength: 0.65,
  require_trend_formation: true,
  pyramid_size_very_strong: 0.5,
  pyramid_size_strong: 0.3,
  pyramid_size_moderate: 0.15,
  max_pyramid_size: 1.0,
  max_consecutive_pyramids: 3
};

export class PyramidStrategy {
  private config: PyramidConfig;
  private pyramid_history: Map<string, number> = new Map(); // Track pyramids per position

  constructor(config?: Partial<PyramidConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate pyramid entry decision
   */
  decidePyramid(input: PyramidInput): PyramidDecision {
    // Calculate profit metrics
    const profitPct = ((input.current_price - input.original_entry_price) / input.original_entry_price) * 100;
    
    // Check all pyramid conditions
    const passesMinProfit = profitPct >= this.config.min_profit_pct;
    const passesClusterStrength = input.cluster_strength >= this.config.min_cluster_strength;
    const passesTrendFormation = !this.config.require_trend_formation || input.trend_formation;

    // If any condition fails, don't pyramid
    if (!passesMinProfit || !passesClusterStrength || !passesTrendFormation) {
      return this.createRejectDecision(input, profitPct, {
        passesMinProfit,
        passesClusterStrength,
        passesTrendFormation
      });
    }

    // All conditions passed - calculate pyramid size
    const pyramidRatio = this.getPyramidRatio(input.cluster_strength);
    const pyramidSize = input.original_position_size * pyramidRatio;

    // Calculate new position metrics
    const newPositionSize = input.original_position_size + pyramidSize;
    const newAverageEntry = this.calculateAverageEntry(
      input.original_entry_price,
      input.original_position_size,
      input.current_price,
      pyramidSize
    );

    // Safety assessment
    const safety = this.assessSafety(
      input.cluster_strength,
      input.trend_formation,
      pyramidRatio,
      profitPct
    );

    // Build reasoning
    const reasoning = this.buildReasoning(input, profitPct, pyramidRatio);

    return {
      original_entry_price: input.original_entry_price,
      current_price: input.current_price,
      profit_pct: parseFloat(profitPct.toFixed(2)),
      cluster_strength: input.cluster_strength,
      trend_formation: input.trend_formation,
      
      pyramid_recommended: true,
      pyramid_size: parseFloat(pyramidSize.toFixed(0)),
      pyramid_ratio: parseFloat(pyramidRatio.toFixed(2)),
      new_position_size: parseFloat(newPositionSize.toFixed(0)),
      new_average_entry: parseFloat(newAverageEntry.toFixed(8)),
      
      reasoning,
      risk_assessment: safety
    };
  }

  /**
   * Create rejection decision when pyramid not recommended
   */
  private createRejectDecision(
    input: PyramidInput,
    profitPct: number,
    checks: any
  ): PyramidDecision {
    const reasons: string[] = [];

    if (!checks.passesMinProfit) {
      reasons.push(
        `✗ Insufficient profit: ${profitPct.toFixed(2)}% (need ${this.config.min_profit_pct}% minimum)`
      );
    }

    if (!checks.passesClusterStrength) {
      reasons.push(
        `✗ Weak clusters: ${(input.cluster_strength * 100).toFixed(0)}% (need ${(this.config.min_cluster_strength * 100).toFixed(0)}% minimum)`
      );
    }

    if (!checks.passesTrendFormation) {
      reasons.push(`✗ Trend not forming - wait for cluster confirmation`);
    }

    return {
      original_entry_price: input.original_entry_price,
      current_price: input.current_price,
      profit_pct: parseFloat(profitPct.toFixed(2)),
      cluster_strength: input.cluster_strength,
      trend_formation: input.trend_formation,
      
      pyramid_recommended: false,
      pyramid_size: 0,
      pyramid_ratio: 0,
      new_position_size: input.original_position_size,
      new_average_entry: input.original_entry_price,
      
      reasoning: reasons,
      risk_assessment: {
        is_safe: false,
        confidence_level: 'very_low',
        safety_score: 0
      }
    };
  }

  /**
   * Get pyramid ratio based on cluster strength
   */
  private getPyramidRatio(clusterStrength: number): number {
    if (clusterStrength > 0.85) {
      return this.config.pyramid_size_very_strong; // 50%
    } else if (clusterStrength > 0.75) {
      return this.config.pyramid_size_strong; // 30%
    } else {
      return this.config.pyramid_size_moderate; // 15%
    }
  }

  /**
   * Calculate new average entry price
   */
  private calculateAverageEntry(
    originalEntry: number,
    originalSize: number,
    pyramidPrice: number,
    pyramidSize: number
  ): number {
    const totalCost =
      originalEntry * originalSize + pyramidPrice * pyramidSize;
    const totalSize = originalSize + pyramidSize;
    return totalCost / totalSize;
  }

  /**
   * Assess safety of pyramiding
   */
  private assessSafety(
    clusterStrength: number,
    trendForming: boolean,
    pyramidRatio: number,
    profitPct: number
  ): {
    is_safe: boolean;
    confidence_level: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
    safety_score: number;
  } {
    let safety = 0;

    // Cluster strength contribution (40%)
    safety += clusterStrength * 0.4;

    // Trend formation bonus (20%)
    if (trendForming) safety += 0.2;

    // Profit buffer contribution (20%)
    const profitBonus = Math.min(profitPct / 5, 0.2); // 5% profit = full bonus
    safety += profitBonus;

    // Pyramid ratio contribution (20%)
    // Smaller pyramids = safer (15% safer than 50%)
    const pyramidSafety = (1 - pyramidRatio) / 2; // 0.25 to 0.425
    safety += pyramidSafety * 0.2;

    const confidenceLevel: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low' =
      safety > 0.85 ? 'very_high' :
      safety > 0.70 ? 'high' :
      safety > 0.55 ? 'moderate' :
      safety > 0.40 ? 'low' :
      'very_low';

    return {
      is_safe: safety > 0.5,
      confidence_level: confidenceLevel,
      safety_score: parseFloat(safety.toFixed(3))
    };
  }

  /**
   * Build reasoning array
   */
  private buildReasoning(
    input: PyramidInput,
    profitPct: number,
    pyramidRatio: number
  ): string[] {
    const reasons: string[] = [];

    reasons.push(
      `Entry: $${input.original_entry_price.toFixed(2)} → Current: $${input.current_price.toFixed(2)} (+${profitPct.toFixed(2)}%)`
    );

    reasons.push(
      `Cluster strength: ${(input.cluster_strength * 100).toFixed(0)}% - ${pyramidRatio === this.config.pyramid_size_very_strong ? 'VERY STRONG' : pyramidRatio === this.config.pyramid_size_strong ? 'STRONG' : 'MODERATE'} conviction`
    );

    if (input.trend_formation) {
      reasons.push(`✓ Trend formation confirmed - safe to add`);
    }

    const addSize = Math.round(input.original_position_size * pyramidRatio);
    reasons.push(
      `Adding: ${addSize} units (${(pyramidRatio * 100).toFixed(0)}% of original)`
    );

    const newPosition = input.original_position_size + addSize;
    reasons.push(
      `New position: ${newPosition} units (leverage: ${(newPosition / input.original_position_size).toFixed(2)}x)`
    );

    return reasons;
  }

  /**
   * Track pyramid for this position
   */
  recordPyramid(positionId: string): boolean {
    const count = this.pyramid_history.get(positionId) || 0;

    if (count >= this.config.max_consecutive_pyramids) {
      return false; // Max pyramids reached
    }

    this.pyramid_history.set(positionId, count + 1);
    return true;
  }

  /**
   * Get pyramid count for position
   */
  getPyramidCount(positionId: string): number {
    return this.pyramid_history.get(positionId) || 0;
  }

  /**
   * Reset pyramid tracking for position (on close)
   */
  resetPyramidTracking(positionId: string): void {
    this.pyramid_history.delete(positionId);
  }

  /**
   * Calculate optimal exit for pyramided position
   */
  calculatePyramidedExit(
    averageEntry: number,
    positions: Array<{ entry: number; size: number }>
  ): {
    first_target: number; // Exit first (original) position
    second_target: number; // Exit pyramids if first target hit
    trail_stop: number; // Trail remaining position
  } {
    // Simple approach: scale targets based on average entry
    const profitTarget = averageEntry * 1.03; // 3% target
    
    return {
      first_target: profitTarget,
      second_target: profitTarget * 1.02, // Scale up for pyramids
      trail_stop: averageEntry * 0.98 // 2% trail
    };
  }

  /**
   * Batch evaluate pyramids
   */
  decideBatch(inputs: PyramidInput[]): PyramidDecision[] {
    return inputs.map(input => this.decidePyramid(input));
  }
}

/**
 * Factory function
 */
export function createPyramidStrategy(
  config?: Partial<PyramidConfig>
): PyramidStrategy {
  return new PyramidStrategy(config);
}

/**
 * Quick helper (stateless)
 */
export function quickDecidePyramid(
  originalEntryPrice: number,
  currentPrice: number,
  originalPositionSize: number,
  clusterStrength: number,
  trendFormation: boolean
): PyramidDecision {
  const strategy = new PyramidStrategy();
  return strategy.decidePyramid({
    original_entry_price: originalEntryPrice,
    current_price: currentPrice,
    original_position_size: originalPositionSize,
    cluster_strength: clusterStrength,
    trend_formation: trendFormation
  });
}
