/**
 * Bayesian Belief Updater - TypeScript Implementation
 * 
 * Coordinates learning across ML models, RL agents, and trading strategies.
 * Uses Bayes theorem to update beliefs about strategy effectiveness based on trade outcomes.
 */

export enum MarketRegime {
  TRENDING = 'TRENDING',
  RANGING = 'RANGING',
  VOLATILE = 'VOLATILE',
  NEUTRAL = 'NEUTRAL',
}

/**
 * Evidence from a completed trade
 */
export interface Evidence {
  was_profitable: boolean;
  roi: number; // Return percentage
  risk_adjusted_return: number; // ROI / entry_confidence
  entry_quality: number; // 0-1, how good was entry signal
  exit_quality: number; // 0-1, how good was exit timing
  duration_efficiency: number; // 0-1, time to close efficiency
  regime_match: number; // 0-1, alignment with market regime
  confidence_calibration: number; // 0-1, ML model confidence
  strategy_id: string;
  timestamp: Date;
}

/**
 * Tracks belief about a strategy's effectiveness
 */
export class StrategyBelief {
  strategy_id: string;

  // Prior belief (initial assumption)
  prior_win_rate: number = 0.55;
  prior_sharpe: number = 1.0;
  prior_accuracy: number = 0.55;

  // Posterior belief (after evidence)
  posterior_win_rate: number = 0.55;
  posterior_sharpe: number = 1.0;
  posterior_accuracy: number = 0.55;

  // Confidence metrics
  confidence: number = 0.1; // Low initially, increases with evidence
  samples_analyzed: number = 0;

  // Performance tracking
  total_wins: number = 0;
  total_trades: number = 0;
  avg_roi: number = 0.0;
  max_drawdown: number = 0.0;

  // Learning history
  evidence_history: Evidence[] = [];
  weight_history: Array<{ timestamp: Date; weight: number }> = [];

  constructor(strategy_id: string, prior_win_rate: number = 0.55) {
    this.strategy_id = strategy_id;
    this.prior_win_rate = prior_win_rate;
    this.posterior_win_rate = prior_win_rate;
    this.prior_accuracy = prior_win_rate;
    this.posterior_accuracy = prior_win_rate;
  }

  get accuracy_improvement(): number {
    return (this.posterior_accuracy - this.prior_accuracy) / this.prior_accuracy;
  }

  get belief_convergence(): number {
    // Higher confidence with more samples
    return Math.min(1.0, this.samples_analyzed / 100.0);
  }

  reset_to_prior(): void {
    this.posterior_win_rate = this.prior_win_rate;
    this.posterior_sharpe = this.prior_sharpe;
    this.posterior_accuracy = this.prior_accuracy;
    this.confidence = 0.1;
    this.samples_analyzed = 0;
  }
}

/**
 * Tracks how well strategy confidence predicts outcomes
 */
export class CalibrationMetrics {
  high_confidence_win_rate: number = 0.0; // Signals >80% confidence
  medium_confidence_win_rate: number = 0.0; // Signals 50-80% confidence
  low_confidence_win_rate: number = 0.0; // Signals <50% confidence

  high_confidence_count: number = 0;
  medium_confidence_count: number = 0;
  low_confidence_count: number = 0;

  get calibration_error(): number {
    // Measure of confidence vs actual performance
    const expected_high = 0.80;
    const expected_medium = 0.65;
    const expected_low = 0.50;

    let error = 0.0;
    error += Math.abs(this.high_confidence_win_rate - expected_high) * 0.4;
    error += Math.abs(this.medium_confidence_win_rate - expected_medium) * 0.4;
    error += Math.abs(this.low_confidence_win_rate - expected_low) * 0.2;

    return error;
  }

  is_calibrated(): boolean {
    return this.calibration_error < 0.15; // Threshold for good calibration
  }
}

/**
 * Bayesian Belief Updater - Main Learning Coordinator
 */
export class BayesianBeliefUpdater {
  private strategy_beliefs: Map<string, StrategyBelief> = new Map();
  private learning_history: any[] = [];
  private regime_beliefs: Map<string, Map<MarketRegime, number>> = new Map();
  private calibration_metrics: Map<string, CalibrationMetrics> = new Map();

  private current_regime: MarketRegime = MarketRegime.NEUTRAL;

  // Hyperparameters
  private learning_rate: number = 0.1; // Speed of belief updates
  private confidence_growth: number = 0.02; // How quickly confidence increases
  private regime_adaptation_weight: number = 0.3; // Regime influence on weighting

  constructor() {
    this.learning_history = [];
  }

  /**
   * Initialize belief state for a new strategy
   */
  initialize_strategy(strategy_id: string, prior_win_rate: number = 0.55): void {
    const belief = new StrategyBelief(strategy_id, prior_win_rate);
    this.strategy_beliefs.set(strategy_id, belief);
    this.calibration_metrics.set(strategy_id, new CalibrationMetrics());

    // Initialize regime beliefs
    const regime_map = new Map<MarketRegime, number>();
    for (const regime of Object.values(MarketRegime)) {
      regime_map.set(regime as MarketRegime, prior_win_rate);
    }
    this.regime_beliefs.set(strategy_id, regime_map);
  }

  /**
   * Update belief using Bayes theorem
   * P(H|E) = P(E|H) * P(H) / P(E)
   */
  accumulate_evidence(strategy_id: string, evidence: Evidence): StrategyBelief {
    if (!this.strategy_beliefs.has(strategy_id)) {
      this.initialize_strategy(strategy_id);
    }

    const belief = this.strategy_beliefs.get(strategy_id)!;

    // Extract belief components
    const prior = belief.posterior_accuracy;

    // Calculate likelihood P(E|H) - probability of evidence given hypothesis
    let likelihood: number;
    if (evidence.was_profitable) {
      likelihood = evidence.risk_adjusted_return; // Higher ROI = stronger evidence
    } else {
      likelihood = 1.0 - Math.abs(evidence.roi); // Loss severity matters
    }
    likelihood = Math.max(0.01, Math.min(0.99, likelihood));

    // Calculate evidence strength P(E) - marginal likelihood
    const evidence_strength = 
      0.3 * (evidence.was_profitable ? 1.0 : 0.0) +
      0.2 * evidence.entry_quality +
      0.2 * evidence.exit_quality +
      0.15 * evidence.regime_match +
      0.15 * evidence.confidence_calibration;
    
    const normalized_strength = Math.max(0.01, Math.min(0.99, evidence_strength));

    // Apply Bayes theorem
    let posterior = (likelihood * prior) / normalized_strength;
    posterior = Math.max(0.0, Math.min(1.0, posterior));

    // Update with learning rate (don't swing wildly)
    const updated_posterior = 
      prior * (1 - this.learning_rate) +
      posterior * this.learning_rate;

    // Update belief state
    belief.posterior_accuracy = updated_posterior;
    belief.samples_analyzed += 1;
    belief.confidence = Math.min(
      0.95,
      belief.confidence + this.confidence_growth
    );
    belief.evidence_history.push(evidence);

    // Update win rate tracking
    if (evidence.was_profitable) {
      belief.total_wins += 1;
    }
    belief.total_trades += 1;
    belief.avg_roi = 
      (belief.avg_roi * (belief.total_trades - 1) + evidence.roi) / 
      belief.total_trades;

    // Track weight history
    const new_weight = this.get_weight(strategy_id);
    belief.weight_history.push({ timestamp: new Date(), weight: new_weight });

    // Update calibration
    this.update_calibration(strategy_id, evidence.confidence_calibration, evidence.was_profitable);

    // Update regime belief
    this.update_regime_belief(strategy_id, this.current_regime, evidence.was_profitable ? 0.7 : 0.3);

    return belief;
  }

  /**
   * Update how well strategy performs in specific regime
   */
  private update_regime_belief(
    strategy_id: string,
    regime: MarketRegime,
    performance: number
  ): void {
    if (!this.regime_beliefs.has(strategy_id)) {
      const regime_map = new Map<MarketRegime, number>();
      for (const r of Object.values(MarketRegime)) {
        regime_map.set(r as MarketRegime, 0.55);
      }
      this.regime_beliefs.set(strategy_id, regime_map);
    }

    const regime_map = this.regime_beliefs.get(strategy_id)!;
    const current = regime_map.get(regime) || 0.55;

    // Adaptive update based on performance
    const updated = 
      current * (1 - this.learning_rate) +
      performance * this.learning_rate;

    regime_map.set(regime, Math.max(0.0, Math.min(1.0, updated)));
  }

  /**
   * Track how well confidence predicts results
   */
  private update_calibration(
    strategy_id: string,
    confidence: number,
    actual_outcome: boolean
  ): void {
    if (!this.calibration_metrics.has(strategy_id)) {
      this.calibration_metrics.set(strategy_id, new CalibrationMetrics());
    }

    const calibration = this.calibration_metrics.get(strategy_id)!;

    if (confidence > 0.8) {
      calibration.high_confidence_count += 1;
      if (actual_outcome) {
        calibration.high_confidence_win_rate =
          (calibration.high_confidence_win_rate * 
            (calibration.high_confidence_count - 1) +
            1.0) /
          calibration.high_confidence_count;
      }
    } else if (confidence > 0.5) {
      calibration.medium_confidence_count += 1;
      if (actual_outcome) {
        calibration.medium_confidence_win_rate =
          (calibration.medium_confidence_win_rate * 
            (calibration.medium_confidence_count - 1) +
            1.0) /
          calibration.medium_confidence_count;
      }
    } else {
      calibration.low_confidence_count += 1;
      if (actual_outcome) {
        calibration.low_confidence_win_rate =
          (calibration.low_confidence_win_rate * 
            (calibration.low_confidence_count - 1) +
            1.0) /
          calibration.low_confidence_count;
      }
    }
  }

  /**
   * Get adaptive weight for strategy based on belief
   */
  get_weight(strategy_id: string): number {
    if (!this.strategy_beliefs.has(strategy_id)) {
      const total = this.strategy_beliefs.size;
      return total > 0 ? 1.0 / total : 1.0;
    }

    const belief = this.strategy_beliefs.get(strategy_id)!;

    // Weight = posterior accuracy * confidence
    // Higher accuracy and confidence = higher weight
    const base_weight = belief.posterior_accuracy * belief.confidence;

    return Math.max(0.0, Math.min(2.0, base_weight));
  }

  /**
   * Get all strategy weights normalized
   */
  get_adaptive_weights(normalize: boolean = true): Record<string, number> {
    const weights: Record<string, number> = {};

    for (const [strategy_id] of this.strategy_beliefs) {
      weights[strategy_id] = this.get_weight(strategy_id);
    }

    if (normalize && Object.keys(weights).length > 0) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (const key in weights) {
          weights[key] = weights[key] / total;
        }
      }
    }

    return weights;
  }

  /**
   * Get weights optimized for current market regime
   */
  get_regime_adjusted_weights(
    regime: MarketRegime,
    normalize: boolean = true
  ): Record<string, number> {
    const weights: Record<string, number> = {};

    for (const [strategy_id] of this.strategy_beliefs) {
      const base_weight = this.get_weight(strategy_id);
      const regime_beliefs = this.regime_beliefs.get(strategy_id);
      const regime_factor = regime_beliefs?.get(regime) || 0.55;

      // Blend base weight with regime-specific performance
      const adjusted_weight =
        base_weight * (1 - this.regime_adaptation_weight) +
        regime_factor * this.regime_adaptation_weight;

      weights[strategy_id] = adjusted_weight;
    }

    if (normalize && Object.keys(weights).length > 0) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (const key in weights) {
          weights[key] = weights[key] / total;
        }
      }
    }

    return weights;
  }

  /**
   * Set current market regime
   */
  set_regime(regime: MarketRegime): void {
    this.current_regime = regime;
  }

  /**
   * Get calibration metrics for a strategy
   */
  get_calibration(strategy_id: string): CalibrationMetrics | null {
    return this.calibration_metrics.get(strategy_id) || null;
  }

  /**
   * Check if model needs retraining
   */
  needs_retraining(strategy_id: string): boolean {
    const calibration = this.calibration_metrics.get(strategy_id);
    if (!calibration) return false;
    return !calibration.is_calibrated();
  }

  /**
   * Get belief for a strategy
   */
  get_belief(strategy_id: string): StrategyBelief | null {
    return this.strategy_beliefs.get(strategy_id) || null;
  }

  /**
   * Get all beliefs
   */
  get_all_beliefs(): Record<string, StrategyBelief> {
    const result: Record<string, StrategyBelief> = {};
    for (const [id, belief] of this.strategy_beliefs) {
      result[id] = belief;
    }
    return result;
  }

  /**
   * Get summary of learning state
   */
  get_summary(): Record<string, any> {
    const beliefs = this.get_all_beliefs();
    const summary: Record<string, any> = {
      current_regime: this.current_regime,
      total_strategies: this.strategy_beliefs.size,
      strategies: {},
    };

    for (const [id, belief] of Object.entries(beliefs)) {
      const calibration = this.calibration_metrics.get(id);
      summary.strategies[id] = {
        posterior_accuracy: belief.posterior_accuracy,
        confidence: belief.confidence,
        samples: belief.samples_analyzed,
        win_rate: belief.total_wins / Math.max(1, belief.total_trades),
        weight: this.get_weight(id),
        calibrated: calibration?.is_calibrated() || false,
        calibration_error: calibration?.calibration_error || 0,
      };
    }

    return summary;
  }
}

// Singleton instance
export const bayesianUpdater = new BayesianBeliefUpdater();
