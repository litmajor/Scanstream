/**
 * WEIGHT TRANSITION MANAGER
 * 
 * Manages smooth transitions between regime-based weight adjustments.
 * Prevents sharp changes in weights that could disrupt trading stability.
 * 
 * Features:
 * - Linear interpolation over 3-5 candles
 * - Constraint enforcement (weights sum to 1.0)
 * - Maximum change limit per candle
 * - Regime alignment bonus/penalty
 */

export interface RegimeWeights {
  scanner: number;      // Scandium signal weight (0-1)
  ml: number;          // ML prediction weight (0-1)
  rl: number;          // RL decision weight (0-1)
  gradient?: number;   // Gradient signal weight (optional)
  structure?: number;  // Structure pattern weight (optional)
  flow?: number;       // Flow analysis weight (optional)
  volume?: number;     // Volume confirmation weight (optional)
  momentum?: number;   // Momentum indicator weight (optional)
}

export interface WeightTransitionState {
  fromWeights: RegimeWeights;
  toWeights: RegimeWeights;
  progress: number;           // 0-1 where 0=start, 1=complete
  candles: number;            // Candles in this transition (0-5)
  maxCandles: number;         // Target transition duration (3-5)
  currentWeights: RegimeWeights;
  isTransitioning: boolean;
}

/**
 * Default weight matrices by regime
 */
export const REGIME_WEIGHT_MATRICES: Record<string, RegimeWeights> = {
  // TRENDING: Focus on continuation signals
  'TRENDING_UP': {
    scanner: 0.40,     // Scanner detects trend
    ml: 0.30,         // ML confirms direction
    rl: 0.30          // RL capitalizes on trend
  },
  'TRENDING_DOWN': {
    scanner: 0.40,
    ml: 0.30,
    rl: 0.30
  },

  // RANGING: Focus on mean reversion (RL)
  'RANGING': {
    scanner: 0.30,    // Scanner caution
    ml: 0.35,        // ML finds reversals
    rl: 0.35         // RL exploits range
  },

  // VOLATILE: Focus on risk management (Scanner)
  'VOLATILE': {
    scanner: 0.50,    // Scanner is risk manager
    ml: 0.25,        // ML less reliable in chaos
    rl: 0.25         // RL less reliable in chaos
  },

  // CONSOLIDATING: Wait for breakout
  'CONSOLIDATING': {
    scanner: 0.35,
    ml: 0.35,
    rl: 0.30
  },

  // Default/Unknown
  'DEFAULT': {
    scanner: 0.35,
    ml: 0.35,
    rl: 0.30
  }
};

export class WeightTransitionManager {
  private transitionState: WeightTransitionState | null = null;
  private previousWeights: RegimeWeights;
  private readonly maxChangePerCandle = 0.01;  // 1% max change per candle
  private readonly transitionCandles = 5;      // 5-candle smooth transition

  constructor() {
    this.previousWeights = { ...REGIME_WEIGHT_MATRICES['DEFAULT'] };
  }

  /**
   * Start a new regime weight transition
   */
  startTransition(fromRegime: string, toRegime: string): RegimeWeights {
    const fromWeights = REGIME_WEIGHT_MATRICES[fromRegime] || REGIME_WEIGHT_MATRICES['DEFAULT'];
    const toWeights = REGIME_WEIGHT_MATRICES[toRegime] || REGIME_WEIGHT_MATRICES['DEFAULT'];

    this.transitionState = {
      fromWeights: { ...fromWeights },
      toWeights: { ...toWeights },
      progress: 0,
      candles: 0,
      maxCandles: this.transitionCandles,
      currentWeights: { ...fromWeights },
      isTransitioning: true
    };

    return this.getNextTransitionWeights();
  }

  /**
   * Get next weights in transition sequence
   */
  getNextTransitionWeights(): RegimeWeights {
    if (!this.transitionState || !this.transitionState.isTransitioning) {
      return { ...this.previousWeights };
    }

    // Increment progress
    this.transitionState.candles++;
    this.transitionState.progress = this.transitionState.candles / this.transitionState.maxCandles;

    // Linear interpolation
    const weights: RegimeWeights = {
      scanner: this.lerp(
        this.transitionState.fromWeights.scanner,
        this.transitionState.toWeights.scanner,
        this.transitionState.progress
      ),
      ml: this.lerp(
        this.transitionState.fromWeights.ml,
        this.transitionState.toWeights.ml,
        this.transitionState.progress
      ),
      rl: this.lerp(
        this.transitionState.fromWeights.rl,
        this.transitionState.toWeights.rl,
        this.transitionState.progress
      )
    };

    // Ensure sum = 1.0
    const sum = weights.scanner + weights.ml + weights.rl;
    if (sum !== 0) {
      weights.scanner /= sum;
      weights.ml /= sum;
      weights.rl /= sum;
    }

    // Check if transition complete
    if (this.transitionState.progress >= 1.0) {
      this.transitionState.isTransitioning = false;
      this.transitionState = null;
    }

    this.previousWeights = weights;
    return weights;
  }

  /**
   * Get current weights (either transitioning or static)
   */
  getCurrentWeights(regime: string): RegimeWeights {
    if (this.transitionState?.isTransitioning) {
      return this.getNextTransitionWeights();
    }

    const weights = REGIME_WEIGHT_MATRICES[regime] || REGIME_WEIGHT_MATRICES['DEFAULT'];
    this.previousWeights = { ...weights };
    return { ...weights };
  }

  /**
   * Snap to new regime weights (no transition)
   */
  snapToRegimeWeights(regime: string): RegimeWeights {
    this.transitionState = null;  // Cancel any ongoing transition
    const weights = REGIME_WEIGHT_MATRICES[regime] || REGIME_WEIGHT_MATRICES['DEFAULT'];
    this.previousWeights = { ...weights };
    return { ...weights };
  }

  /**
   * Apply regime alignment bonus/penalty
   * Boosts weight of signal most aligned with current regime
   */
  applyRegimeAlignmentBonus(weights: RegimeWeights, regime: string, alignmentScores: { scanner: number; ml: number; rl: number }): RegimeWeights {
    // Find which signal is most aligned
    const scores = alignmentScores;
    const totalScore = scores.scanner + scores.ml + scores.rl;

    if (totalScore === 0) return weights;

    // Normalize scores
    const normalized = {
      scanner: scores.scanner / totalScore,
      ml: scores.ml / totalScore,
      rl: scores.rl / totalScore
    };

    // Apply small bonus to most-aligned signal (+2%, take from others)
    const bonus = 0.02;
    const maxScore = Math.max(normalized.scanner, normalized.ml, normalized.rl);

    let boosted = { ...weights };

    if (normalized.scanner === maxScore) {
      boosted.scanner = Math.min(1.0, boosted.scanner + bonus);
      boosted.ml = Math.max(0, boosted.ml - bonus / 2);
      boosted.rl = Math.max(0, boosted.rl - bonus / 2);
    } else if (normalized.ml === maxScore) {
      boosted.ml = Math.min(1.0, boosted.ml + bonus);
      boosted.scanner = Math.max(0, boosted.scanner - bonus / 2);
      boosted.rl = Math.max(0, boosted.rl - bonus / 2);
    } else {
      boosted.rl = Math.min(1.0, boosted.rl + bonus);
      boosted.scanner = Math.max(0, boosted.scanner - bonus / 2);
      boosted.ml = Math.max(0, boosted.ml - bonus / 2);
    }

    // Normalize to sum = 1.0
    const sum = boosted.scanner + boosted.ml + boosted.rl;
    if (sum !== 0) {
      boosted.scanner /= sum;
      boosted.ml /= sum;
      boosted.rl /= sum;
    }

    return boosted;
  }

  /**
   * Get transition metadata
   */
  getTransitionInfo(): { isTransitioning: boolean; progress: number; fromRegime?: string; toRegime?: string } {
    if (!this.transitionState) {
      return { isTransitioning: false, progress: 0 };
    }

    return {
      isTransitioning: this.transitionState.isTransitioning,
      progress: this.transitionState.progress
    };
  }

  /**
   * Linear interpolation helper
   */
  private lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  /**
   * Validate weights sum to 1.0
   */
  private validateWeights(weights: RegimeWeights): boolean {
    const sum = (weights.scanner ?? 0) + (weights.ml ?? 0) + (weights.rl ?? 0);
    return Math.abs(sum - 1.0) < 0.01;  // Allow 1% tolerance
  }
}

export const weightTransitionManager = new WeightTransitionManager();
export default weightTransitionManager;
