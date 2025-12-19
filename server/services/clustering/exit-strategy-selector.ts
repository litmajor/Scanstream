/**
 * Exit Strategy Selector Service
 * Dynamically selects exit approach based on cluster state and market conditions
 * 
 * Phase 2 Feature #7: Exit Strategy Selection
 * 
 * Problem: All exits use the same strategy regardless of trend strength
 * Solution: Choose exit type (profit_target, trailing_stop, time_exit, cluster_breakdown)
 *           based on cluster strength, formation, and profit state
 */

export type ExitStrategy = 'profit_target' | 'trailing_stop' | 'time_exit' | 'cluster_breakdown';

export type ExitUrgency = 'low' | 'moderate' | 'high' | 'critical';

export interface ExitStrategyConfig {
  /** Minimum profit % before considering any exit (default: 0.5%) */
  min_profit_pct_for_exit?: number;
  /** Target profit % for profit_target exits (default: 2.0%) */
  target_profit_pct?: number;
  /** Max bars to hold for time_exit strategy (default: 20) */
  max_hold_bars?: number;
  /** Cluster breakdown threshold for exit (default: 0.35) */
  breakdown_threshold?: number;
}

export interface ExitConditions {
  current_profit_pct: number;
  cluster_strength: number;
  trend_formation: boolean;
  bars_held: number;
  directional_ratio: number;
  follow_through: number;
}

export interface ExitStrategyRecommendation {
  /** Primary exit strategy */
  strategy: ExitStrategy;
  /** How urgent the exit is */
  urgency: ExitUrgency;
  /** Target exit price or level */
  exit_target?: number;
  /** Stop loss price or level */
  stop_loss?: number;
  /** Trailing stop distance (if applicable) */
  trailing_stop_distance?: number;
  /** Max bars to hold */
  max_bars?: number;
  /** Why this strategy was chosen */
  reasoning: string[];
  /** Alternative strategies (fallback) */
  alternatives: {
    strategy: ExitStrategy;
    use_when: string;
  }[];
}

/**
 * ExitStrategySelector: Chooses optimal exit approach based on cluster analysis
 * 
 * Strategy Selection Logic:
 * 1. Strong trend (>0.75) + formation → Trailing stop (capture upside)
 * 2. Moderate trend (0.55-0.75) → Profit target (take what you can)
 * 3. Weak trend (<0.45) → Time exit (exit before breakdown)
 * 4. In profit + weak cluster → Cluster breakdown (escape on collapse)
 */
export class ExitStrategySelector {
  private config: Required<ExitStrategyConfig>;

  constructor(config: ExitStrategyConfig = {}) {
    this.config = {
      min_profit_pct_for_exit: config.min_profit_pct_for_exit ?? 0.5,
      target_profit_pct: config.target_profit_pct ?? 2.0,
      max_hold_bars: config.max_hold_bars ?? 20,
      breakdown_threshold: config.breakdown_threshold ?? 0.35,
    };
  }

  /**
   * Select exit strategy based on current conditions
   */
  selectStrategy(
    conditions: ExitConditions,
    entry_price: number,
    current_price: number
  ): ExitStrategyRecommendation {
    const reasoning: string[] = [];

    // Determine primary strategy
    const strategy = this._determineStrategy(conditions, reasoning);
    const urgency = this._assessUrgency(conditions, strategy);

    // Calculate exit levels
    const exit_target = this._calculateExitTarget(strategy, entry_price, current_price, conditions);
    const stop_loss = this._calculateStopLoss(strategy, entry_price, conditions);
    const trailing_stop_distance = strategy === 'trailing_stop' 
      ? this._calculateTrailingStop(conditions) 
      : undefined;
    const max_bars = strategy === 'time_exit' ? this.config.max_hold_bars : undefined;

    // Generate alternatives
    const alternatives = this._getAlternatives(strategy, conditions);

    return {
      strategy,
      urgency,
      exit_target,
      stop_loss,
      trailing_stop_distance,
      max_bars,
      reasoning,
      alternatives,
    };
  }

  /**
   * Batch select exit strategies for multiple positions
   */
  selectBatch(
    conditionsArray: Array<ExitConditions & { entry_price: number; current_price: number }>
  ): ExitStrategyRecommendation[] {
    return conditionsArray.map((item) =>
      this.selectStrategy(item, item.entry_price, item.current_price)
    );
  }

  /**
   * Check if position should be exited immediately
   */
  shouldExitImmediately(
    conditions: ExitConditions,
    entry_price: number,
    current_price: number
  ): { should_exit: boolean; reason: string; urgency: ExitUrgency } {
    const recommendation = this.selectStrategy(conditions, entry_price, current_price);

    const should_exit =
      recommendation.urgency === 'critical' || 
      (conditions.cluster_strength < 0.2 && conditions.current_profit_pct < -1);

    return {
      should_exit,
      reason: recommendation.reasoning[0] || 'No critical exit condition',
      urgency: recommendation.urgency,
    };
  }

  /**
   * Get exit strategy description for trader awareness
   */
  getStrategyDescription(strategy: ExitStrategy): {
    name: string;
    description: string;
    best_for: string;
    typical_duration: string;
  } {
    const descriptions = {
      profit_target: {
        name: 'Profit Target Exit',
        description: 'Exit at predetermined profit level. Simple, mechanical, no emotion.',
        best_for: 'Moderate trends where you want guaranteed profit vs risk reward',
        typical_duration: '5-15 bars average',
      },
      trailing_stop: {
        name: 'Trailing Stop Exit',
        description: 'Stop trails behind price. Lets winners run while protecting gains.',
        best_for: 'Strong trends where upside is unlimited but trend might end suddenly',
        typical_duration: '15-50+ bars (trend dependent)',
      },
      time_exit: {
        name: 'Time-Based Exit',
        description: 'Exit after N bars regardless of profit. Exit before trend collapses.',
        best_for: 'Weak trends that might reverse. Scalp-like trades.',
        typical_duration: '3-20 bars maximum',
      },
      cluster_breakdown: {
        name: 'Cluster Breakdown Exit',
        description: 'Exit when clusters collapse. Escape before sharp reversal.',
        best_for: 'Taking profits before obvious trend reversal. Risk management.',
        typical_duration: 'Varies (triggered by cluster change)',
      },
    };

    return descriptions[strategy] || descriptions.profit_target;
  }

  /**
   * Compare exit strategies for a position
   */
  compareStrategies(
    conditions: ExitConditions,
    entry_price: number,
    current_price: number
  ): {
    primary: ExitStrategyRecommendation;
    comparison: Array<{
      strategy: ExitStrategy;
      expected_outcome: string;
      pros: string[];
      cons: string[];
    }>;
  } {
    const primary = this.selectStrategy(conditions, entry_price, current_price);

    const strategies: ExitStrategy[] = ['profit_target', 'trailing_stop', 'time_exit', 'cluster_breakdown'];

    const comparison = strategies.map((strategy) => ({
      strategy,
      expected_outcome: this._getExpectedOutcome(strategy, conditions, entry_price, current_price),
      pros: this._getStrategyPros(strategy),
      cons: this._getStrategyCons(strategy),
    }));

    return { primary, comparison };
  }

  // Private helpers

  private _determineStrategy(conditions: ExitConditions, reasoning: string[]): ExitStrategy {
    const { cluster_strength, trend_formation, current_profit_pct, bars_held } = conditions;

    // Critical condition: cluster breakdown with profit
    if (
      current_profit_pct > 2 &&
      cluster_strength < this.config.breakdown_threshold
    ) {
      reasoning.push(`Cluster collapse detected (${cluster_strength.toFixed(2)}) + ${current_profit_pct.toFixed(1)}% profit → Cluster breakdown exit`);
      return 'cluster_breakdown';
    }

    // Strong trend: let it run
    if (trend_formation && cluster_strength > 0.75) {
      reasoning.push(`Strong forming trend (${cluster_strength.toFixed(2)}) → Trailing stop to capture upside`);
      return 'trailing_stop';
    }

    // Moderate trend: take what you can
    if (cluster_strength > 0.55) {
      reasoning.push(`Moderate cluster strength (${cluster_strength.toFixed(2)}) → Profit target strategy`);
      return 'profit_target';
    }

    // Weak trend: time to leave
    if (cluster_strength < 0.45) {
      reasoning.push(`Weak clusters (${cluster_strength.toFixed(2)}) → Time exit (avoid breakdown)`);
      return 'time_exit';
    }

    // Default: moderate approach
    reasoning.push('Unclear conditions → Profit target as default');
    return 'profit_target';
  }

  private _assessUrgency(conditions: ExitConditions, strategy: ExitStrategy): ExitUrgency {
    const { cluster_strength, current_profit_pct, bars_held } = conditions;

    // Critical: about to break down
    if (cluster_strength < 0.2) {
      return 'critical';
    }

    // High: weak trend + losing money or time running out
    if (cluster_strength < 0.35 || (strategy === 'time_exit' && bars_held > this.config.max_hold_bars * 0.8)) {
      return 'high';
    }

    // Moderate: approaching targets or some degradation
    if (cluster_strength < 0.55 || (current_profit_pct > 1.5 && cluster_strength < 0.65)) {
      return 'moderate';
    }

    return 'low';
  }

  private _calculateExitTarget(
    strategy: ExitStrategy,
    entry_price: number,
    current_price: number,
    conditions: ExitConditions
  ): number | undefined {
    if (strategy === 'profit_target') {
      // Target profit: entry + (entry × target_profit_pct)
      return entry_price * (1 + this.config.target_profit_pct / 100);
    }

    if (strategy === 'cluster_breakdown') {
      // Cluster breakdown: exit at market (use current price as target)
      return current_price;
    }

    // Other strategies don't have fixed exit targets
    return undefined;
  }

  private _calculateStopLoss(
    strategy: ExitStrategy,
    entry_price: number,
    conditions: ExitConditions
  ): number | undefined {
    const stop_pct = conditions.cluster_strength < 0.4 ? 2.0 : 1.5;
    return entry_price * (1 - stop_pct / 100);
  }

  private _calculateTrailingStop(conditions: ExitConditions): number {
    // Trailing stop distance: tighter in strong trends, wider in weak
    const base_distance = 1.0; // 1% trailing stop
    const adjustment = Math.max(0.5, Math.min(1.5, conditions.cluster_strength * 1.5));
    return base_distance * adjustment;
  }

  private _getAlternatives(
    primary: ExitStrategy,
    conditions: ExitConditions
  ): Array<{ strategy: ExitStrategy; use_when: string }> {
    const alternatives: Array<{ strategy: ExitStrategy; use_when: string }> = [];

    if (primary !== 'profit_target') {
      alternatives.push({
        strategy: 'profit_target',
        use_when: 'If you want mechanical exit with guaranteed profit',
      });
    }

    if (primary !== 'trailing_stop') {
      alternatives.push({
        strategy: 'trailing_stop',
        use_when: 'If trend strengthens further and you want unlimited upside',
      });
    }

    if (primary !== 'time_exit') {
      alternatives.push({
        strategy: 'time_exit',
        use_when: 'If you want to exit before time decay or bars limit',
      });
    }

    if (primary !== 'cluster_breakdown') {
      alternatives.push({
        strategy: 'cluster_breakdown',
        use_when: 'If clusters collapse and you need emergency exit',
      });
    }

    return alternatives;
  }

  private _getExpectedOutcome(
    strategy: ExitStrategy,
    conditions: ExitConditions,
    entry_price: number,
    current_price: number
  ): string {
    const current_profit = ((current_price - entry_price) / entry_price) * 100;

    switch (strategy) {
      case 'profit_target':
        const target_profit = this.config.target_profit_pct;
        return `Exit at +${target_profit.toFixed(1)}% (${(entry_price * (1 + target_profit / 100)).toFixed(2)})`;
      case 'trailing_stop':
        return 'Let trade run, exit on momentum loss (potentially 5-20%+ gain)';
      case 'time_exit':
        return `Exit after ${this.config.max_hold_bars} bars maximum`;
      case 'cluster_breakdown':
        return `Exit when clusters collapse (protect ${current_profit.toFixed(1)}% profit)`;
      default:
        return 'Unknown outcome';
    }
  }

  private _getStrategyPros(strategy: ExitStrategy): string[] {
    const pros = {
      profit_target: [
        'Mechanical and emotion-free',
        'Known risk/reward upfront',
        'Works in any market condition',
        'Easy to backtest',
      ],
      trailing_stop: [
        'Lets winners run',
        'Protects against sharp reversals',
        'Captures full trend',
        'Best for strong trends',
      ],
      time_exit: [
        'Avoids holding through reversals',
        'Disciplined exit before decay',
        'Good for weak trends',
        'Prevents holding losers',
      ],
      cluster_breakdown: [
        'Exits before collapse',
        'Protects accumulated profits',
        'Data-driven exit signal',
        'Avoids sharp reversals',
      ],
    };

    return pros[strategy] || [];
  }

  private _getStrategyCons(strategy: ExitStrategy): string[] {
    const cons = {
      profit_target: [
        'May exit too early in strong trends',
        'Leaves money on table',
        'Fixed target regardless of conditions',
        'Ignores trend strength',
      ],
      trailing_stop: [
        'Complex to execute manually',
        'Can get stopped out in noise',
        'Requires real-time monitoring',
        'Hard to backtest accurately',
      ],
      time_exit: [
        'Might exit winners too early',
        'Misses extended trends',
        'Arbitrary time limit',
        'Doesn\'t use price action',
      ],
      cluster_breakdown: [
        'Requires cluster monitoring',
        'Breakdowns can be delayed',
        'May exit with large slippage',
        'Depends on data quality',
      ],
    };

    return cons[strategy] || [];
  }
}

/**
 * Factory function for ExitStrategySelector
 */
export function createExitStrategySelector(config: ExitStrategyConfig = {}): ExitStrategySelector {
  return new ExitStrategySelector(config);
}

/**
 * Quick helper: Select exit strategy without instantiation
 */
export function selectQuickExitStrategy(
  cluster_strength: number,
  trend_formation: boolean,
  current_profit_pct: number,
  bars_held: number = 0,
  directional_ratio: number = 0.5,
  follow_through: number = 0.5,
  entry_price: number = 100,
  current_price: number = 102
): ExitStrategyRecommendation {
  const selector = createExitStrategySelector();
  return selector.selectStrategy(
    {
      current_profit_pct,
      cluster_strength,
      trend_formation,
      bars_held,
      directional_ratio,
      follow_through,
    },
    entry_price,
    current_price
  );
}
