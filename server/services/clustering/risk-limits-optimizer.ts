/**
 * Risk Limits Optimizer Service
 * Adjusts position sizing and daily loss limits based on cluster strength
 * 
 * Phase 2 Feature #6: Volatility-Adjusted Risk Limits
 * 
 * Problem: Risk limits remain static regardless of trend clarity
 * Solution: Scale exposure based on cluster strength (weak=conservative, strong=aggressive)
 */

export interface RiskLimitConfig {
  /** Base daily loss percentage (default: 2%) */
  base_daily_loss_pct?: number;
  /** Base position size percentage (default: 5%) */
  base_position_size_pct?: number;
  /** Base max positions allowed (default: 5) */
  base_max_positions?: number;
  /** Account size in base currency */
  account_size: number;
}

export interface ClusterRiskMetrics {
  cluster_strength: number;    // 0-1
  trend_formation: boolean;
  directional_ratio: number;   // 0-1
}

export interface AdjustedRiskLimits {
  /** Risk multiplier based on cluster strength (0.7-1.2) */
  risk_multiplier: number;
  /** Adjusted daily loss amount in base currency */
  max_daily_loss: number;
  /** Adjusted daily loss percentage */
  max_daily_loss_pct: number;
  /** Adjusted max position size in base currency */
  max_position_size: number;
  /** Adjusted max position size percentage */
  max_position_size_pct: number;
  /** Adjusted max concurrent positions */
  max_positions: number;
  /** Risk level description */
  risk_level: 'very_conservative' | 'conservative' | 'normal' | 'aggressive' | 'very_aggressive';
  /** Reasoning for risk adjustment */
  reasoning: string[];
}

/**
 * RiskLimitsOptimizer: Adjusts account risk parameters based on cluster conviction
 * 
 * Principle: Strong trends support higher exposure; weak trends require protection
 * - Strong cluster (>0.8): 1.2x risk multiplier (20% more exposure)
 * - Moderate cluster (0.6-0.8): 1.0x risk multiplier (normal)
 * - Weak cluster (<0.6): 0.7x risk multiplier (30% less exposure)
 */
export class RiskLimitsOptimizer {
  private config: Required<RiskLimitConfig>;

  constructor(config: RiskLimitConfig) {
    this.config = {
      base_daily_loss_pct: config.base_daily_loss_pct ?? 2.0,
      base_position_size_pct: config.base_position_size_pct ?? 5.0,
      base_max_positions: config.base_max_positions ?? 5,
      account_size: config.account_size,
    };
  }

  /**
   * Calculate adjusted risk limits based on cluster strength
   */
  calculateRiskLimits(metrics: ClusterRiskMetrics): AdjustedRiskLimits {
    const risk_multiplier = this.calculateRiskMultiplier(metrics);
    const reasoning: string[] = [];

    // Calculate adjusted limits
    const base_daily_loss = this.config.account_size * (this.config.base_daily_loss_pct / 100);
    const max_daily_loss = base_daily_loss * risk_multiplier;
    const max_daily_loss_pct = this.config.base_daily_loss_pct * risk_multiplier;

    const base_position_size = this.config.account_size * (this.config.base_position_size_pct / 100);
    const max_position_size = base_position_size * risk_multiplier;
    const max_position_size_pct = this.config.base_position_size_pct * risk_multiplier;

    const max_positions = Math.ceil(this.config.base_max_positions * risk_multiplier);

    // Determine risk level
    const risk_level = this.determineRiskLevel(risk_multiplier);

    // Build reasoning
    this._buildReasoning(metrics, risk_multiplier, reasoning);

    return {
      risk_multiplier,
      max_daily_loss,
      max_daily_loss_pct,
      max_position_size,
      max_position_size_pct,
      max_positions,
      risk_level,
      reasoning,
    };
  }

  /**
   * Batch calculate risk limits for multiple cluster states
   */
  calculateBatch(metricsArray: ClusterRiskMetrics[]): AdjustedRiskLimits[] {
    return metricsArray.map((metrics) => this.calculateRiskLimits(metrics));
  }

  /**
   * Check if current daily loss is within limits
   */
  isWithinDailyLimit(
    current_daily_loss: number,
    limits: AdjustedRiskLimits
  ): { within_limit: boolean; buffer_remaining: number; buffer_pct: number } {
    const buffer = limits.max_daily_loss - current_daily_loss;
    const buffer_pct = (buffer / limits.max_daily_loss) * 100;
    return {
      within_limit: buffer >= 0,
      buffer_remaining: Math.max(0, buffer),
      buffer_pct: Math.max(0, buffer_pct),
    };
  }

  /**
   * Recommend position size for entry based on current daily loss
   */
  recommendEntrySize(
    current_daily_loss: number,
    risk_per_trade_pct: number,
    limits: AdjustedRiskLimits
  ): {
    recommended_size: number;
    is_allowed: boolean;
    reason: string;
  } {
    const buffer = limits.max_daily_loss - current_daily_loss;

    if (buffer <= 0) {
      return {
        recommended_size: 0,
        is_allowed: false,
        reason: 'Daily loss limit already reached',
      };
    }

    const max_loss_for_trade = (limits.max_position_size * risk_per_trade_pct) / 100;

    if (max_loss_for_trade > buffer) {
      return {
        recommended_size: limits.max_position_size * (buffer / max_loss_for_trade),
        is_allowed: true,
        reason: 'Reduced position size to stay within daily limit',
      };
    }

    return {
      recommended_size: limits.max_position_size,
      is_allowed: true,
      reason: 'Full position size allowed',
    };
  }

  /**
   * Get risk profile summary for trader awareness
   */
  getRiskProfile(limits: AdjustedRiskLimits): {
    daily_loss_budget: string;
    position_size_range: string;
    max_concurrent_trades: number;
    recommendation: string;
  } {
    const daily_loss_str = `$${limits.max_daily_loss.toFixed(0)} (${limits.max_daily_loss_pct.toFixed(2)}%)`;
    const position_range_str = `$${limits.max_position_size.toFixed(0)} (${limits.max_position_size_pct.toFixed(2)}%)`;

    let recommendation = '';
    switch (limits.risk_level) {
      case 'very_conservative':
        recommendation = 'Only enter high-quality setups. Prioritize capital preservation.';
        break;
      case 'conservative':
        recommendation = 'Be selective with entries. Avoid marginal setups.';
        break;
      case 'normal':
        recommendation = 'Standard trading approach. Normal entry criteria.';
        break;
      case 'aggressive':
        recommendation = 'Can take more opportunistic entries. Strong trend conditions.';
        break;
      case 'very_aggressive':
        recommendation = 'Optimal trading environment. Can pyramid into strong trends.';
        break;
    }

    return {
      daily_loss_budget: daily_loss_str,
      position_size_range: position_range_str,
      max_concurrent_trades: limits.max_positions,
      recommendation,
    };
  }

  // Private helpers

  private calculateRiskMultiplier(metrics: ClusterRiskMetrics): number {
    const { cluster_strength, trend_formation } = metrics;

    // Base multiplier from cluster strength
    let multiplier = 1.0;

    if (cluster_strength > 0.8) {
      multiplier = 1.2; // 20% more risk in very strong trends
    } else if (cluster_strength > 0.6) {
      multiplier = 1.0; // Normal risk in moderate trends
    } else if (cluster_strength > 0.4) {
      multiplier = 0.85; // Moderately reduced (15% less)
    } else {
      multiplier = 0.7; // Significantly reduced (30% less) in weak trends
    }

    // Apply formation penalty
    if (!trend_formation) {
      multiplier *= 0.9; // Additional 10% reduction if no formation
    }

    return Math.max(0.5, Math.min(multiplier, 1.3)); // Clamp to 0.5-1.3 range
  }

  private determineRiskLevel(
    multiplier: number
  ): 'very_conservative' | 'conservative' | 'normal' | 'aggressive' | 'very_aggressive' {
    if (multiplier >= 1.15) return 'very_aggressive';
    if (multiplier >= 1.0) return 'aggressive';
    if (multiplier >= 0.85) return 'normal';
    if (multiplier >= 0.7) return 'conservative';
    return 'very_conservative';
  }

  private _buildReasoning(
    metrics: ClusterRiskMetrics,
    multiplier: number,
    reasoning: string[]
  ): void {
    const { cluster_strength, trend_formation, directional_ratio } = metrics;

    if (cluster_strength > 0.8) {
      reasoning.push(`Strong cluster formation (${cluster_strength.toFixed(2)}) → Increased risk tolerance`);
    } else if (cluster_strength > 0.6) {
      reasoning.push(`Moderate cluster strength (${cluster_strength.toFixed(2)}) → Normal risk`);
    } else if (cluster_strength > 0.4) {
      reasoning.push(`Weak cluster formation (${cluster_strength.toFixed(2)}) → Reduced exposure`);
    } else {
      reasoning.push(`Very weak clusters (${cluster_strength.toFixed(2)}) → Conservative mode`);
    }

    if (!trend_formation) {
      reasoning.push('No trend formation signal → Additional risk reduction applied');
    } else {
      reasoning.push('Trend formation confirmed → Risk multiplier can be applied');
    }

    if (directional_ratio > 0.7) {
      reasoning.push(`High directional consistency (${(directional_ratio * 100).toFixed(0)}%) → Supports higher conviction`);
    }

    reasoning.push(`Final risk multiplier: ${multiplier.toFixed(2)}x`);
  }
}

/**
 * Factory function for RiskLimitsOptimizer
 */
export function createRiskLimitsOptimizer(config: RiskLimitConfig): RiskLimitsOptimizer {
  return new RiskLimitsOptimizer(config);
}

/**
 * Quick helper: Calculate risk limits without instantiation
 */
export function calculateQuickRiskLimits(
  account_size: number,
  cluster_strength: number,
  trend_formation: boolean = true,
  directional_ratio: number = 0.5
): AdjustedRiskLimits {
  const optimizer = createRiskLimitsOptimizer({ account_size });
  return optimizer.calculateRiskLimits({
    cluster_strength,
    trend_formation,
    directional_ratio,
  });
}

