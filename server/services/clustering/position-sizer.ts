/**
 * Position Sizer Service
 * 
 * Cluster-aware position sizing
 * Scales position size from 0.5x to 2.0x based on cluster conviction
 * 
 * Formula:
 * sizeMultiplier = 0.5 + (cluster_strength * 1.5)
 * final_size = base_size * sizeMultiplier
 * 
 * Examples:
 * - cluster_strength = 0.2, trend = false  →  0.5x size (risky)
 * - cluster_strength = 0.5, trend = true   →  1.25x size (normal)
 * - cluster_strength = 0.9, trend = true   →  1.85x size (confident)
 */

export interface PositionSizingInput {
  baseSize: number; // Base position size in units
  cluster_strength: number; // 0-1
  trend_formation: boolean; // Is trend forming?
  signal_quality?: number; // 0-1 (optional, for quality adjustment)
  volatility_factor?: number; // 0-1 (1.0 = normal, <1.0 = higher vol = smaller)
}

export interface PositionSizingResult {
  base_size: number;
  cluster_strength: number;
  trend_formed: boolean;
  conviction_level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  size_multiplier: number; // 0.5 to 2.0
  final_size: number;
  risk_adjusted_size: number; // After volatility adjustment
  reasoning: string[];
}

export interface PositionSizingConfig {
  // Base multiplier range
  min_multiplier: number; // 0.5
  max_multiplier: number; // 2.0
  
  // Cluster strength thresholds for conviction levels
  very_low_threshold: number; // < 0.2
  low_threshold: number; // 0.2-0.4
  moderate_threshold: number; // 0.4-0.6
  high_threshold: number; // 0.6-0.8
  very_high_threshold: number; // >= 0.8
  
  // Penalty/boost modifiers
  no_trend_penalty: number; // 0.5x if no trend
  signal_quality_boost: number; // % per 10% quality
  volatility_adjustment_enabled: boolean;
}

const DEFAULT_CONFIG: PositionSizingConfig = {
  min_multiplier: 0.5,
  max_multiplier: 2.0,
  very_low_threshold: 0.2,
  low_threshold: 0.4,
  moderate_threshold: 0.6,
  high_threshold: 0.8,
  very_high_threshold: 0.8,
  no_trend_penalty: 0.5,
  signal_quality_boost: 0.05,
  volatility_adjustment_enabled: true
};

export class PositionSizer {
  private config: PositionSizingConfig;

  constructor(config?: Partial<PositionSizingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate position size based on clustering conviction
   */
  calculateSize(input: PositionSizingInput): PositionSizingResult {
    // Validate inputs
    const baseSize = Math.max(0, input.baseSize);
    const clusterStrength = Math.max(0, Math.min(1, input.cluster_strength));
    const signalQuality = Math.max(0, Math.min(1, input.signal_quality || 0.7));
    const volatilityFactor = Math.max(0.5, Math.min(1, input.volatility_factor || 1.0));

    // Step 1: Calculate base multiplier from cluster strength
    // Formula: 0.5 + (strength * 1.5)
    let sizeMultiplier =
      this.config.min_multiplier + clusterStrength * 1.5;

    // Cap to max
    sizeMultiplier = Math.min(sizeMultiplier, this.config.max_multiplier);

    // Step 2: Apply trend penalty if no formation
    if (!input.trend_formation) {
      sizeMultiplier *= this.config.no_trend_penalty;
    }

    // Step 3: Apply signal quality boost
    if (signalQuality > 0) {
      const qualityBoost = signalQuality * this.config.signal_quality_boost * 10;
      sizeMultiplier *= 1 + qualityBoost / 100;
    }

    // Step 4: Apply volatility adjustment
    let riskAdjustedSize = baseSize * sizeMultiplier;
    if (this.config.volatility_adjustment_enabled) {
      riskAdjustedSize *= volatilityFactor;
    }

    // Determine conviction level
    const conviction = this.getConvictionLevel(clusterStrength, input.trend_formation);

    // Build reasoning
    const reasoning = this.buildReasoning(
      clusterStrength,
      input.trend_formation,
      sizeMultiplier,
      signalQuality,
      volatilityFactor
    );

    return {
      base_size: baseSize,
      cluster_strength: clusterStrength,
      trend_formed: input.trend_formation,
      conviction_level: conviction,
      size_multiplier: parseFloat(sizeMultiplier.toFixed(2)),
      final_size: baseSize * sizeMultiplier,
      risk_adjusted_size: riskAdjustedSize,
      reasoning
    };
  }

  /**
   * Get conviction level based on cluster strength and trend
   */
  private getConvictionLevel(
    strength: number,
    trendForming: boolean
  ): 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' {
    if (!trendForming) {
      if (strength < 0.3) return 'very_low';
      if (strength < 0.5) return 'low';
      return 'moderate';
    }

    // With trend forming
    if (strength < 0.2) return 'very_low';
    if (strength < 0.4) return 'low';
    if (strength < 0.6) return 'moderate';
    if (strength < 0.8) return 'high';
    return 'very_high';
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoning(
    clusterStrength: number,
    trendForming: boolean,
    multiplier: number,
    signalQuality: number,
    volatilityFactor: number
  ): string[] {
    const reasons: string[] = [];

    reasons.push(
      `Cluster strength: ${(clusterStrength * 100).toFixed(0)}% → ${(multiplier * 100).toFixed(0)}% multiplier`
    );

    if (trendForming) {
      reasons.push(`✓ Trend forming (full multiplier)`);
    } else {
      reasons.push(
        `✗ No trend formation (${(this.config.no_trend_penalty * 100).toFixed(0)}% penalty applied)`
      );
    }

    if (signalQuality > 0.5) {
      reasons.push(`Strong signal quality boost (+${(signalQuality * 100).toFixed(0)}%)`);
    }

    if (volatilityFactor < 1.0) {
      reasons.push(
        `Volatility adjustment (${(volatilityFactor * 100).toFixed(0)}% of position)`
      );
    }

    const finalMultiplier = multiplier;
    if (finalMultiplier < 0.6) {
      reasons.push(`⚠️ Conservative sizing - low conviction`);
    } else if (finalMultiplier > 1.5) {
      reasons.push(`🔥 Aggressive sizing - high conviction`);
    } else {
      reasons.push(`Normal sizing`);
    }

    return reasons;
  }

  /**
   * Get sizing bracket (for UI/monitoring)
   */
  getSizingBracket(multiplier: number): string {
    if (multiplier < 0.6) return 'MINIMAL (< 60%)';
    if (multiplier < 0.8) return 'CONSERVATIVE (60-80%)';
    if (multiplier < 1.0) return 'CAUTIOUS (80-100%)';
    if (multiplier < 1.2) return 'NORMAL (100-120%)';
    if (multiplier < 1.5) return 'CONFIDENT (120-150%)';
    return 'AGGRESSIVE (150%+)';
  }

  /**
   * Batch calculate sizes for multiple positions
   */
  calculateBatch(
    inputs: PositionSizingInput[]
  ): PositionSizingResult[] {
    return inputs.map(input => this.calculateSize(input));
  }

  /**
   * Rank positions by conviction (for portfolio allocation)
   */
  rankByConviction(
    results: PositionSizingResult[]
  ): PositionSizingResult[] {
    const convictionOrder = {
      'very_high': 5,
      'high': 4,
      'moderate': 3,
      'low': 2,
      'very_low': 1
    };

    return [...results].sort(
      (a, b) =>
        (convictionOrder[b.conviction_level] || 0) -
        (convictionOrder[a.conviction_level] || 0)
    );
  }

  /**
   * Calculate portfolio heat (total risk across all positions)
   */
  calculatePortfolioHeat(
    results: PositionSizingResult[]
  ): {
    total_heat: number;
    by_conviction: Record<string, number>;
    heat_status: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  } {
    const heatMap: Record<string, number> = {
      very_high: 0.2,
      high: 0.15,
      moderate: 0.1,
      low: 0.05,
      very_low: 0.02
    };

    let total_heat = 0;
    const by_conviction: Record<string, number> = {};

    for (const result of results) {
      const heatPerPosition = heatMap[result.conviction_level] || 0;
      const positionHeat = (result.risk_adjusted_size / (result.base_size || 1)) * heatPerPosition;

      total_heat += positionHeat;
      by_conviction[result.conviction_level] =
        (by_conviction[result.conviction_level] || 0) + positionHeat;
    }

    let heat_status: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (total_heat > 0.15) heat_status = 'MODERATE';
    if (total_heat > 0.25) heat_status = 'HIGH';
    if (total_heat > 0.4) heat_status = 'CRITICAL';

    return {
      total_heat: parseFloat(total_heat.toFixed(3)),
      by_conviction,
      heat_status
    };
  }
}

/**
 * Factory function for creating sizer instances
 */
export function createPositionSizer(
  config?: Partial<PositionSizingConfig>
): PositionSizer {
  return new PositionSizer(config);
}

/**
 * Quick sizing helper (stateless)
 */
export function quickCalculateSize(
  baseSize: number,
  clusterStrength: number,
  trendForming: boolean
): PositionSizingResult {
  const sizer = new PositionSizer();
  return sizer.calculateSize({
    baseSize,
    cluster_strength: clusterStrength,
    trend_formation: trendForming
  });
}
