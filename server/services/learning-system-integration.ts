/**
 * Learning System Integration
 * 
 * Coordinates feedback from portfolio simulator to ML models, RL agent, and Bayesian updater.
 * This is the central hub that closes the learning loop.
 */

import { Trade } from '@shared/schema';
import { 
  BayesianBeliefUpdater, 
  Evidence, 
  MarketRegime 
} from './bayesian-belief-updater';
import { 
  extractTradeEvidence, 
  TradeContext,
  estimateMarketRegime 
} from './trade-evidence-extractor';
import { RLPositionAgent } from '../rl-position-agent';

export interface LearningUpdate {
  timestamp: Date;
  trade_id: string;
  evidence: Evidence;
  bayesian_update: {
    prior_accuracy: number;
    posterior_accuracy: number;
    confidence_change: number;
    weight: number;
  };
  rl_reward: number;
  ml_recalibration_needed: boolean;
  market_regime: MarketRegime;
  adaptive_weights: Record<string, number>;
}

export class LearningSystemIntegration {
  private bayesian_updater: BayesianBeliefUpdater;
  private rl_agent: RLPositionAgent;
  private learning_history: LearningUpdate[] = [];
  private model_accuracy_history: Map<string, number[]> = new Map();
  private regime_history: MarketRegime[] = [];

  constructor(
    bayesian_updater: BayesianBeliefUpdater,
    rl_agent: RLPositionAgent
  ) {
    this.bayesian_updater = bayesian_updater;
    this.rl_agent = rl_agent;
  }

  /**
   * Process a closed trade through the entire learning system
   */
  async process_trade_outcome(
    trade: Trade,
    context: TradeContext,
    ml_model_metrics?: {
      prediction_accuracy: number;
      confidence: number;
      model_id: string;
    }
  ): Promise<LearningUpdate> {
    // Step 1: Extract evidence from trade
    const evidence = extractTradeEvidence(trade, context);

    // Step 2: Update Bayesian beliefs
    const prior_accuracy = this.bayesian_updater.get_belief(context.strategy_id)
      ?.posterior_accuracy || 0.55;
    
    const belief = this.bayesian_updater.accumulate_evidence(
      context.strategy_id,
      evidence
    );
    
    const posterior_accuracy = belief.posterior_accuracy;
    const confidence_change = belief.confidence;

    // Step 3: Get updated adaptive weights
    const adaptive_weights = this.bayesian_updater.get_adaptive_weights(true);

    // Step 4: Calculate RL reward with Bayesian adjustment
    const rl_reward = this.calculate_bayesian_adjusted_reward(
      trade,
      evidence,
      belief.confidence
    );

    // Step 5: Update RL agent with Bayesian context
    if (this.rl_agent) {
      this.update_rl_agent_with_bayesian_context(
        rl_reward,
        context.market_regime,
        evidence.confidence_calibration
      );
    }

    // Step 6: Check if ML model needs retraining
    const ml_recalibration_needed = this.bayesian_updater.needs_retraining(
      context.strategy_id
    );

    // Step 7: Update regime estimate
    const estimated_regime = context.market_regime;
    this.bayesian_updater.set_regime(estimated_regime);
    this.regime_history.push(estimated_regime);

    // Step 8: Track model accuracy
    if (ml_model_metrics) {
      this.track_model_accuracy(
        ml_model_metrics.model_id,
        ml_model_metrics.prediction_accuracy
      );
    }

    // Create learning update record
    const learning_update: LearningUpdate = {
      timestamp: new Date(),
      trade_id: trade.id,
      evidence,
      bayesian_update: {
        prior_accuracy,
        posterior_accuracy,
        confidence_change,
        weight: this.bayesian_updater.get_weight(context.strategy_id),
      },
      rl_reward,
      ml_recalibration_needed,
      market_regime: estimated_regime,
      adaptive_weights,
    };

    this.learning_history.push(learning_update);

    return learning_update;
  }

  /**
   * Calculate reward for RL agent adjusted by Bayesian confidence
   */
  private calculate_bayesian_adjusted_reward(
    trade: Trade,
    evidence: Evidence,
    bayesian_confidence: number
  ): number {
    let reward = 0;

    // Base PnL reward
    const investmentAmount = trade.entryPrice * trade.quantity;
    const pnl_percent = investmentAmount > 0 ? ((trade.pnl || 0) / investmentAmount) : 0;
    reward += pnl_percent * 10; // Scale up

    // Bonus for good risk-reward
    const risk_reward = evidence.exit_quality / Math.max(0.1, evidence.entry_quality);
    if (risk_reward >= 2.0) {
      reward += 5;
    } else if (risk_reward >= 1.5) {
      reward += 2;
    }

    // Penalty for excessive drawdown
    if (pnl_percent < -0.05) {
      reward -= 10;
    } else if (pnl_percent < -0.03) {
      reward -= 5;
    }

    // Bayesian adjustment: Higher confidence in belief → Stronger reward signal
    reward *= (0.5 + bayesian_confidence * 0.5); // Range: 0.5x to 1.5x

    return reward;
  }

  /**
   * Update RL agent with Bayesian regime context
   */
  private update_rl_agent_with_bayesian_context(
    reward: number,
    regime: MarketRegime,
    confidence: number
  ): void {
    // This would integrate with RLPositionAgent's regime-aware update
    // For now, we're just passing the context
    // Future: Add regime-specific Q-tables to RLPositionAgent
  }

  /**
   * Track model accuracy over time
   */
  private track_model_accuracy(model_id: string, accuracy: number): void {
    if (!this.model_accuracy_history.has(model_id)) {
      this.model_accuracy_history.set(model_id, []);
    }
    this.model_accuracy_history.get(model_id)!.push(accuracy);
  }

  /**
   * Get learning statistics
   */
  get_learning_stats(): Record<string, any> {
    const beliefs = this.bayesian_updater.get_all_beliefs();
    const adaptive_weights = this.bayesian_updater.get_adaptive_weights(true);

    // Calculate average regime
    const regime_counts: Record<string, number> = {};
    for (const regime of this.regime_history) {
      regime_counts[regime] = (regime_counts[regime] || 0) + 1;
    }

    // Calculate model accuracy trends
    const model_stats: Record<string, any> = {};
    for (const [model_id, accuracies] of this.model_accuracy_history) {
      const avg_accuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      const trend = accuracies.slice(-10); // Last 10 trades
      const recent_avg = trend.reduce((a, b) => a + b, 0) / trend.length;
      
      model_stats[model_id] = {
        total_accuracy: avg_accuracy,
        recent_accuracy: recent_avg,
        samples: accuracies.length,
        trend: recent_avg - avg_accuracy, // Positive = improving
      };
    }

    return {
      total_trades_processed: this.learning_history.length,
      strategies_tracked: Object.keys(beliefs).length,
      adaptive_weights,
      model_accuracy: model_stats,
      regime_distribution: regime_counts,
      most_common_regime: Object.entries(regime_counts).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] || 'UNKNOWN',
      learning_history_size: this.learning_history.length,
      bayesian_summary: this.bayesian_updater.get_summary(),
    };
  }

  /**
   * Get recommendations for system adjustments
   */
  get_system_recommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.get_learning_stats();

    // Check for poorly calibrated models
    for (const [model_id, metrics] of Object.entries(stats.model_accuracy)) {
      if (typeof metrics === 'object' && metrics !== null) {
        const accuracy = (metrics as any).total_accuracy;
        if (accuracy < 0.50) {
          recommendations.push(
            `⚠️ Model ${model_id} has low accuracy (${(accuracy * 100).toFixed(1)}%). Consider retraining.`
          );
        }
      }
    }

    // Check for improving/declining models
    for (const [model_id, metrics] of Object.entries(stats.model_accuracy)) {
      if (typeof metrics === 'object' && metrics !== null) {
        const trend = (metrics as any).trend;
        if (trend > 0.1) {
          recommendations.push(
            `✅ Model ${model_id} is improving. Recent accuracy trend is positive.`
          );
        } else if (trend < -0.1) {
          recommendations.push(
            `⚠️ Model ${model_id} is declining. Consider updating its weights.`
          );
        }
      }
    }

    // Recommend strategy adjustments based on Bayesian weights
    const weights = stats.adaptive_weights;
    const min_weight = Math.min(...Object.values(weights as Record<string, number>));
    if (min_weight < 0.05) {
      recommendations.push(
        `💡 Some strategies have very low weight. Consider disabling underperforming strategies.`
      );
    }

    return recommendations;
  }

  /**
   * Reset learning state (careful - wipes all history!)
   */
  reset_learning_state(): void {
    this.learning_history = [];
    this.model_accuracy_history.clear();
    this.regime_history = [];
  }

  /**
   * Get recent learning updates (last N trades processed)
   */
  get_recent_learning_updates(limit: number = 50): LearningUpdate[] {
    return this.learning_history.slice(-limit);
  }

  /**
   * Get all strategy beliefs
   */
  get_strategy_beliefs(): Record<string, any> {
    return this.bayesian_updater.get_all_beliefs();
  }
}

// Singleton instance
let learning_integration: LearningSystemIntegration | null = null;

export function initialize_learning_system(
  bayesian_updater: BayesianBeliefUpdater,
  rl_agent: RLPositionAgent
): LearningSystemIntegration {
  learning_integration = new LearningSystemIntegration(
    bayesian_updater,
    rl_agent
  );
  return learning_integration;
}

export function get_learning_integration(): LearningSystemIntegration | null {
  return learning_integration;
}
