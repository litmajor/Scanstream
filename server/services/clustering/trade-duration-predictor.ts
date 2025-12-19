/**
 * Trade Duration Predictor Service
 * Predicts holding period based on cluster strength and trend characteristics
 * 
 * Phase 3 Feature #9: Trade Duration Predictor
 * 
 * Problem: Agents don't know if trade will be quick scalp or sustained trend
 * Solution: Use cluster strength to predict probable holding period and exit strategy
 */

export type ManagementStrategy = 'QUICK_EXIT' | 'HOLD_AND_SCALE' | 'HOLD_AND_PYRAMID';

export interface DurationPredictionConfig {
  /** Scale factor for prediction calculations (default: 1.0) */
  prediction_scale?: number;
  /** Minimum predicted bars (default: 3) */
  min_bars?: number;
  /** Maximum predicted bars (default: 100) */
  max_bars?: number;
}

export interface ClusterCharacteristics {
  cluster_strength: number;      // 0-1
  trend_formation: boolean;
  directional_ratio: number;     // 0-1
  follow_through: number;        // 0-1
  total_clusters: number;        // Count
}

export interface TradeDurationPrediction {
  /** Cluster strength input */
  cluster_strength: number;
  /** Predicted holding period in bars */
  predicted_duration_bars: number;
  /** Confidence in prediction (0-1) */
  prediction_confidence: number;
  /** How to manage this trade */
  management_strategy: ManagementStrategy;
  /** Expected profit range for this duration */
  expected_profit_range: {
    lower: number;    // -X% pessimistic
    typical: number;  // +Y% typical
    upper: number;    // +Z% optimistic
  };
  /** Detailed duration breakdown */
  duration_breakdown: {
    phase: string;
    bars: number;
    expected_action: string;
  }[];
  /** Why this prediction was made */
  reasoning: string[];
}

/**
 * TradeDurationPredictor: Predicts trade holding period from cluster strength
 * 
 * Prediction Logic:
 * - Strong clusters (>0.85) with trend → 20-50 bars (momentum trade)
 * - Moderate clusters (0.65-0.85) → 10-30 bars (swing trade)
 * - Weak clusters (<0.45) → 3-10 bars (scalp/quick exit)
 * 
 * Benefits:
 * - Guides position management (hold vs. scale out)
 * - Adjusts stop loss tightness (quick exits need wider stops)
 * - Predicts profit taking levels
 * - Prepares trader for expected duration
 */
export class TradeDurationPredictor {
  private config: Required<DurationPredictionConfig>;

  constructor(config: DurationPredictionConfig = {}) {
    this.config = {
      prediction_scale: config.prediction_scale ?? 1.0,
      min_bars: config.min_bars ?? 3,
      max_bars: config.max_bars ?? 100,
    };
  }

  /**
   * Predict trade duration based on cluster characteristics
   */
  predictDuration(
    cluster_strength: number,
    trend_formation: boolean,
    momentum_score: number = 0.5, // Optional momentum multiplier (0-1)
    volatility_multiplier: number = 1.0 // Optional volatility adjustment
  ): TradeDurationPrediction {
    const reasoning: string[] = [];

    // Calculate base duration
    const base_duration = this._calculateBaseDuration(cluster_strength, trend_formation);
    const adjusted_duration = this._applyMultipliers(base_duration, momentum_score, volatility_multiplier);
    const clamped_duration = Math.round(
      Math.max(this.config.min_bars, Math.min(this.config.max_bars, adjusted_duration))
    );

    // Determine management strategy
    const management_strategy = this._determineStrategy(clamped_duration);

    // Calculate confidence
    const prediction_confidence = this._calculateConfidence(cluster_strength, trend_formation);

    // Estimate profit range
    const expected_profit_range = this._estimateProfitRange(
      clamped_duration,
      cluster_strength,
      management_strategy
    );

    // Build duration breakdown (phases)
    const duration_breakdown = this._buildDurationPhases(clamped_duration, management_strategy);

    // Build reasoning
    this._buildReasoning(
      cluster_strength,
      trend_formation,
      clamped_duration,
      management_strategy,
      reasoning
    );

    return {
      cluster_strength,
      predicted_duration_bars: clamped_duration,
      prediction_confidence,
      management_strategy,
      expected_profit_range,
      duration_breakdown,
      reasoning,
    };
  }

  /**
   * Batch predict duration for multiple trades
   */
  predictBatch(
    trades: Array<{
      cluster_strength: number;
      trend_formation: boolean;
      momentum_score?: number;
      volatility_multiplier?: number;
    }>
  ): TradeDurationPrediction[] {
    return trades.map((trade) =>
      this.predictDuration(
        trade.cluster_strength,
        trade.trend_formation,
        trade.momentum_score ?? 0.5,
        trade.volatility_multiplier ?? 1.0
      )
    );
  }

  /**
   * Compare multiple duration scenarios
   */
  compareScenarios(
    base_cluster_strength: number,
    trend_formation: boolean,
    momentum_score: number
  ): {
    conservative: TradeDurationPrediction;
    base_case: TradeDurationPrediction;
    optimistic: TradeDurationPrediction;
  } {
    return {
      conservative: this.predictDuration(
        Math.max(0, base_cluster_strength - 0.15),
        trend_formation,
        momentum_score * 0.8
      ),
      base_case: this.predictDuration(base_cluster_strength, trend_formation, momentum_score),
      optimistic: this.predictDuration(
        Math.min(1.0, base_cluster_strength + 0.15),
        trend_formation,
        momentum_score * 1.2
      ),
    };
  }

  /**
   * Get management recommendations for predicted duration
   */
  getManagementPlan(prediction: TradeDurationPrediction): {
    strategy: ManagementStrategy;
    entry_note: string;
    mid_trade_action: string;
    exit_plan: string;
    profit_targets: number[];
  } {
    const plans = {
      QUICK_EXIT: {
        strategy: 'QUICK_EXIT' as ManagementStrategy,
        entry_note: 'Enter with tight stop. Expect quick profit or loss.',
        mid_trade_action: 'Monitor closely. Exit on first sign of weakness.',
        exit_plan: 'Time-based: Exit after max bars or on stop loss.',
        profit_targets: [0.5, 1.0, 1.5], // % targets for quick scalps
      },
      HOLD_AND_SCALE: {
        strategy: 'HOLD_AND_SCALE' as ManagementStrategy,
        entry_note: 'Standard entry. Expect moderate holding period.',
        mid_trade_action: 'Scale out at profit targets. Protect winners with trailing stop.',
        exit_plan: 'Profit target at +2-3% or cluster breakdown.',
        profit_targets: [1.0, 2.0, 3.0], // % targets for swing trades
      },
      HOLD_AND_PYRAMID: {
        strategy: 'HOLD_AND_PYRAMID' as ManagementStrategy,
        entry_note: 'Strong signal. Expect extended holding period.',
        mid_trade_action: 'Add on pullbacks in trend. Use trailing stop.',
        exit_plan: 'Trailing stop to capture full trend or cluster breakdown.',
        profit_targets: [2.0, 4.0, 6.0], // % targets for trend trades
      },
    };

    return plans[prediction.management_strategy];
  }

  /**
   * Estimate expected profit based on duration
   */
  estimateExpectedProfit(
    predicted_bars: number,
    entry_price: number,
    atr: number
  ): {
    expected_move: number;
    expected_price_target: number;
    expected_profit_pct: number;
  } {
    // Rule of thumb: Each bar of expected duration = 0.3x ATR of average move
    const bars_factor = (predicted_bars / 10) * 0.3; // Normalize to 10-bar baseline
    const expected_move = atr * bars_factor;
    const expected_price_target = entry_price + expected_move;
    const expected_profit_pct = (expected_move / entry_price) * 100;

    return {
      expected_move,
      expected_price_target,
      expected_profit_pct,
    };
  }

  /**
   * Get trader-friendly description of predicted duration
   */
  getDescription(prediction: TradeDurationPrediction): string {
    const bars = prediction.predicted_duration_bars;

    if (bars <= 5) {
      return `Very Quick Trade (${bars} bars): Scalp-like entry. Expect quick profits or loss.`;
    } else if (bars <= 15) {
      return `Short Trade (${bars} bars): Swing-like. Hold through minor pullbacks, exit on profit target.`;
    } else if (bars <= 40) {
      return `Medium Trade (${bars} bars): Sustained trend. Pyramid into strength, use trailing stop.`;
    } else {
      return `Extended Trade (${bars} bars): Major trend. Be patient, let profits run, only exit on breakdown.`;
    }
  }

  // Private helpers

  private _calculateBaseDuration(cluster_strength: number, trend_formation: boolean): number {
    let duration: number;

    // Base calculation from cluster strength
    if (cluster_strength > 0.85 && trend_formation) {
      // Very strong trend → 20-50 bars
      duration = 20 + cluster_strength * 30;
    } else if (cluster_strength > 0.65) {
      // Moderate trend → 10-30 bars
      duration = 10 + cluster_strength * 20;
    } else if (cluster_strength > 0.45) {
      // Weak trend → 5-15 bars
      duration = 5 + cluster_strength * 10;
    } else {
      // Very weak → 3-8 bars (scalps)
      duration = 3 + cluster_strength * 5;
    }

    // Apply trend formation bonus
    if (trend_formation) {
      duration *= 1.2; // 20% longer if trend is confirmed
    }

    return duration;
  }

  private _applyMultipliers(
    base_duration: number,
    momentum_score: number,
    volatility_multiplier: number
  ): number {
    // Momentum multiplier: higher momentum → longer trades
    const momentum_factor = 0.7 + momentum_score * 0.3; // 0.7-1.0x

    // Volatility: higher volatility → shorter trades (tighter stops)
    const volatility_factor = 1.0 / volatility_multiplier; // Inverse relationship

    // Scale factor from config
    return base_duration * momentum_factor * volatility_factor * this.config.prediction_scale;
  }

  private _determineStrategy(predicted_bars: number): ManagementStrategy {
    if (predicted_bars > 30) {
      return 'HOLD_AND_PYRAMID'; // Long duration → pyramid in
    } else if (predicted_bars > 10) {
      return 'HOLD_AND_SCALE'; // Medium duration → scale out
    } else {
      return 'QUICK_EXIT'; // Short duration → quick exit
    }
  }

  private _calculateConfidence(cluster_strength: number, trend_formation: boolean): number {
    let confidence = cluster_strength * 0.7; // 70% weight to cluster strength

    if (trend_formation) {
      confidence += 0.2; // Additional 20% if trend forming
    }

    return Math.min(confidence, 1.0); // Cap at 100%
  }

  private _estimateProfitRange(
    predicted_bars: number,
    cluster_strength: number,
    strategy: ManagementStrategy
  ): { lower: number; typical: number; upper: number } {
    // Base profit from bars (longer = more profit expected)
    const bars_factor = predicted_bars / 10; // Normalize

    // Cluster strength multiplier
    const cluster_factor = 0.5 + cluster_strength; // 0.5x-1.5x

    // Strategy multiplier
    let strategy_factor = 1.0;
    if (strategy === 'QUICK_EXIT') strategy_factor = 0.8; // Conservative
    else if (strategy === 'HOLD_AND_SCALE') strategy_factor = 1.0; // Normal
    else strategy_factor = 1.3; // Optimistic

    const base_return = bars_factor * cluster_factor * strategy_factor;

    return {
      lower: Math.max(-3, -base_return * 0.5), // Pessimistic
      typical: base_return * 1.5, // Typical
      upper: base_return * 3.0, // Optimistic
    };
  }

  private _buildDurationPhases(
    predicted_bars: number,
    strategy: ManagementStrategy
  ): Array<{ phase: string; bars: number; expected_action: string }> {
    const phases: Array<{ phase: string; bars: number; expected_action: string }> = [];

    if (strategy === 'QUICK_EXIT') {
      // Quick scalps: entry → profit target → exit
      phases.push({ phase: 'Entry', bars: 1, expected_action: 'Enter with tight stop' });
      phases.push({
        phase: 'Action',
        bars: predicted_bars - 2,
        expected_action: 'Monitor for quick profit',
      });
      phases.push({ phase: 'Exit', bars: 1, expected_action: 'Exit on profit target or stop' });
    } else if (strategy === 'HOLD_AND_SCALE') {
      // Swing trades: entry → build position → scale out
      phases.push({ phase: 'Entry', bars: 2, expected_action: 'Enter, confirm trend' });
      phases.push({
        phase: 'Build',
        bars: Math.floor(predicted_bars * 0.5),
        expected_action: 'Hold position, add on dips',
      });
      phases.push({
        phase: 'Scale',
        bars: Math.floor(predicted_bars * 0.4),
        expected_action: 'Scale out at profit targets',
      });
      phases.push({ phase: 'Final', bars: 2, expected_action: 'Exit trailing stop or close' });
    } else {
      // Trend trades: entry → pyramid → hold → exit on breakdown
      phases.push({ phase: 'Entry', bars: 2, expected_action: 'Enter, confirm strong trend' });
      phases.push({
        phase: 'Pyramid',
        bars: Math.floor(predicted_bars * 0.3),
        expected_action: 'Add 1-2 pyramids on pullbacks',
      });
      phases.push({
        phase: 'Hold',
        bars: Math.floor(predicted_bars * 0.5),
        expected_action: 'Let winners run with trailing stop',
      });
      phases.push({
        phase: 'Exit',
        bars: Math.floor(predicted_bars * 0.2),
        expected_action: 'Exit on cluster breakdown or trend loss',
      });
    }

    return phases;
  }

  private _buildReasoning(
    cluster_strength: number,
    trend_formation: boolean,
    predicted_bars: number,
    strategy: ManagementStrategy,
    reasoning: string[]
  ): void {
    if (cluster_strength > 0.85) {
      reasoning.push('Very strong clusters → Expect sustained trend');
    } else if (cluster_strength > 0.65) {
      reasoning.push('Moderate clusters → Medium-duration trade expected');
    } else if (cluster_strength > 0.45) {
      reasoning.push('Weak clusters → Shorter trade, watch for breakdown');
    } else {
      reasoning.push('Very weak clusters → Quick scalp, tight stop recommended');
    }

    if (trend_formation) {
      reasoning.push('Trend formation confirmed → Duration estimate extended +20%');
    }

    reasoning.push(`Duration prediction: ${predicted_bars} bars average`);

    const desc = this.getDescription({
      cluster_strength,
      predicted_duration_bars: predicted_bars,
      prediction_confidence: 0.5,
      management_strategy: strategy,
      expected_profit_range: { lower: 0, typical: 0, upper: 0 },
      duration_breakdown: [],
      reasoning: [],
    });
    reasoning.push(desc);
  }
}

/**
 * Factory function for TradeDurationPredictor
 */
export function createTradeDurationPredictor(config: DurationPredictionConfig = {}): TradeDurationPredictor {
  return new TradeDurationPredictor(config);
}

/**
 * Quick helper: Predict duration without instantiation
 */
export function predictQuickDuration(
  cluster_strength: number,
  trend_formation: boolean,
  momentum_score: number = 0.5
): {
  predicted_bars: number;
  strategy: ManagementStrategy;
  description: string;
} {
  const predictor = createTradeDurationPredictor();
  const prediction = predictor.predictDuration(cluster_strength, trend_formation, momentum_score);

  return {
    predicted_bars: prediction.predicted_duration_bars,
    strategy: prediction.management_strategy,
    description: predictor.getDescription(prediction),
  };
}
