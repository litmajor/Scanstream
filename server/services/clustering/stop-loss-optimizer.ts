/**
 * Stop Loss Optimizer Service
 * 
 * Cluster-aware stop loss calculation
 * Dynamically adjusts stop loss levels based on:
 * - Cluster strength and trend formation
 * - Entry price and volatility
 * - Risk tolerance settings
 * 
 * Range: Entry - (0.5% to 3.0% of entry price)
 */

export interface StopLossInput {
  entry_price: number;
  cluster_strength: number; // 0-1
  trend_formation: boolean;
  recent_volatility: number; // Standard deviation as % of price
  risk_tolerance?: 'aggressive' | 'moderate' | 'conservative'; // Default: moderate
  account_size?: number; // For position-based calculations
  max_loss_per_trade?: number; // Max loss in currency
}

export interface OptimalStop {
  stop_loss_price: number;
  stop_loss_percent: number; // As % below entry
  stop_loss_basis: string; // What determined this level
  distance_from_entry: number; // In currency units
  cluster_adjusted: boolean;
  volatility_buffer: number;
  recommendation: string;
}

export interface StopLossConfig {
  min_stop_percent: number; // Minimum 0.5%
  max_stop_percent: number; // Maximum 3.0%
  volatility_multiplier: number; // How much volatility affects stop
  cluster_multiplier: number; // How much cluster strength affects stop
  trend_buffer: number; // Additional buffer if trend forming
}

export class StopLossOptimizer {
  private config: StopLossConfig;

  constructor(config?: Partial<StopLossConfig>) {
    this.config = {
      min_stop_percent: config?.min_stop_percent ?? 0.5,
      max_stop_percent: config?.max_stop_percent ?? 3.0,
      volatility_multiplier: config?.volatility_multiplier ?? 0.3,
      cluster_multiplier: config?.cluster_multiplier ?? 0.5,
      trend_buffer: config?.trend_buffer ?? 0.2,
    };
  }

  /**
   * Calculate optimal stop loss level
   */
  calculateStop(input: StopLossInput): OptimalStop {
    const volatility = input.recent_volatility ?? 1.5; // Default 1.5% daily vol
    const riskTolerance = input.risk_tolerance ?? 'moderate';
    
    // Base stop calculation
    let stopPercent = this.getBaseStop(riskTolerance);
    
    // Adjust for volatility
    const volatilityAdjustment = this.calculateVolatilityAdjustment(
      volatility,
      input.cluster_strength
    );
    stopPercent += volatilityAdjustment;
    
    // Adjust for cluster strength (tighter stop if strong cluster)
    const clusterAdjustment = this.calculateClusterAdjustment(
      input.cluster_strength,
      input.trend_formation
    );
    stopPercent -= clusterAdjustment;
    
    // Clamp to valid range
    stopPercent = Math.max(this.config.min_stop_percent, 
                          Math.min(this.config.max_stop_percent, stopPercent));
    
    // Calculate actual stop price
    const distance = input.entry_price * (stopPercent / 100);
    const stop_loss_price = input.entry_price - distance;
    
    // Determine basis
    let basis = 'base_risk_tolerance';
    if (volatilityAdjustment > 0.3) basis = 'high_volatility';
    if (clusterAdjustment > 0.3) basis = 'strong_cluster';
    if (input.trend_formation) basis = 'trend_formation';
    
    return {
      stop_loss_price: Number(stop_loss_price.toFixed(8)),
      stop_loss_percent: Number(stopPercent.toFixed(2)),
      stop_loss_basis: basis,
      distance_from_entry: Number(distance.toFixed(8)),
      cluster_adjusted: clusterAdjustment > 0,
      volatility_buffer: Number(volatilityAdjustment.toFixed(2)),
      recommendation: this.generateRecommendation(
        stopPercent,
        input.cluster_strength,
        input.trend_formation
      ),
    };
  }

  /**
   * Get base stop percentage by risk tolerance
   */
  private getBaseStop(riskTolerance: string): number {
    switch (riskTolerance) {
      case 'aggressive':
        return 0.8; // 0.8% stop
      case 'conservative':
        return 2.0; // 2.0% stop
      case 'moderate':
      default:
        return 1.2; // 1.2% stop
    }
  }

  /**
   * Adjust stop for volatility
   * Higher volatility = higher stop needed
   * But strong cluster can tighten it
   */
  private calculateVolatilityAdjustment(
    volatility: number,
    clusterStrength: number
  ): number {
    // Volatility increases stop by 0.1% per 1% daily vol, but cluster reduces it
    const baseAdjustment = Math.min(volatility * 0.1, 1.0);
    const clusterReduction = clusterStrength * this.config.cluster_multiplier;
    return Math.max(0, baseAdjustment - clusterReduction);
  }

  /**
   * Adjust stop based on cluster conviction
   * Strong cluster = tighter stop possible
   */
  private calculateClusterAdjustment(
    clusterStrength: number,
    trendForming: boolean
  ): number {
    let adjustment = clusterStrength * this.config.cluster_multiplier;
    if (trendForming) {
      adjustment += this.config.trend_buffer;
    }
    return Math.min(adjustment, 0.8); // Max 0.8% tightening
  }

  /**
   * Generate human-readable recommendation
   */
  private generateRecommendation(
    stopPercent: number,
    clusterStrength: number,
    trendForming: boolean
  ): string {
    if (stopPercent <= 0.7) {
      return 'Very tight stop - strong conviction signal';
    } else if (stopPercent <= 1.2) {
      return 'Normal stop - good risk/reward setup';
    } else if (stopPercent <= 2.0) {
      return 'Wide stop - high volatility environment';
    } else {
      return 'Very wide stop - extreme volatility, consider smaller size';
    }
  }
}

/**
 * Factory function
 */
export function createStopLossOptimizer(
  config?: Partial<StopLossConfig>
): StopLossOptimizer {
  return new StopLossOptimizer(config);
}

/**
 * Quick calculation without optimizer instance
 */
export function quickCalculateStop(input: StopLossInput): OptimalStop {
  const optimizer = new StopLossOptimizer();
  return optimizer.calculateStop(input);
}
