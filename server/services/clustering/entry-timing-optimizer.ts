/**
 * Entry Timing Optimizer Service
 * Delays entry until cluster confirmation to filter false signals
 * 
 * Phase 3 Feature #8: Entry Timing Optimization
 * 
 * Problem: Agents enter on first signal without waiting for cluster confirmation
 * Solution: Track signal initiation and delay entry until clusters agree (max 3 bars)
 */

export interface EntryTimingConfig {
  /** Maximum bars to wait for cluster confirmation (default: 3) */
  max_confirmation_bars?: number;
  /** Minimum cluster strength to confirm entry (default: 0.60) */
  min_confirmation_strength?: number;
  /** Include trend formation in confirmation (default: true) */
  require_trend_formation?: boolean;
}

export interface ConfirmationHistory {
  bar_number: number;
  signal_strength: number;
  cluster_strength: number;
  trend_formation: boolean;
  action: 'WAIT' | 'ENTER' | 'CANCEL';
}

export interface DelayedEntryDecision {
  /** Whether initial signal was triggered */
  signal_triggered: boolean;
  /** Number of bars waited so far */
  bars_waiting: number;
  /** Is cluster confirmation achieved */
  cluster_confirmed: boolean;
  /** Combined signal × cluster quality */
  total_entry_quality: number;
  /** What to do now: WAIT/ENTER/CANCEL */
  action: 'WAIT' | 'ENTER' | 'CANCEL';
  /** Confidence level in this decision */
  confidence: number;
  /** Why this decision was made */
  reasoning: string[];
  /** History of decisions */
  history: ConfirmationHistory[];
}

/**
 * EntryTimingOptimizer: Waits for cluster confirmation before entering
 * 
 * Strategy:
 * 1. Signal triggered → Start waiting (WAIT)
 * 2. Each bar: Check if clusters confirm (trend_formation + strength > threshold)
 * 3. If confirmed within max_bars → ENTER with enhanced quality
 * 4. If not confirmed after max_bars → CANCEL (signal expired)
 * 
 * Benefits:
 * - Filters false signals where price moved but clusters didn't form
 * - Improves win rate by waiting for trend agreement
 * - Reduces early entries in choppy markets
 * - Increases average trade duration/profit
 */
export class EntryTimingOptimizer {
  private config: Required<EntryTimingConfig>;
  private signalHistory: Map<string, ConfirmationHistory[]>;

  constructor(config: EntryTimingConfig = {}) {
    this.config = {
      max_confirmation_bars: config.max_confirmation_bars ?? 3,
      min_confirmation_strength: config.min_confirmation_strength ?? 0.60,
      require_trend_formation: config.require_trend_formation ?? true,
    };
    this.signalHistory = new Map();
  }

  /**
   * Evaluate entry timing for a signal
   * Call this on each new bar if signal is pending
   */
  evaluateEntry(
    signal_id: string,
    signal_strength: number,
    cluster_strength: number,
    trend_formation: boolean,
    bars_since_signal: number
  ): DelayedEntryDecision {
    const reasoning: string[] = [];

    // Get history for this signal
    let history = this.signalHistory.get(signal_id) || [];

    // Determine if clusters confirm
    const clusters_confirm = this._clustersConfirm(cluster_strength, trend_formation);

    // Determine action
    let action: 'WAIT' | 'ENTER' | 'CANCEL';

    if (clusters_confirm) {
      action = 'ENTER';
      reasoning.push(`Cluster confirmation achieved after ${bars_since_signal} bars`);
    } else if (bars_since_signal >= this.config.max_confirmation_bars) {
      action = 'CANCEL';
      reasoning.push(`Signal expired: no confirmation after ${this.config.max_confirmation_bars} bars`);
    } else {
      action = 'WAIT';
      reasoning.push(`Waiting for cluster confirmation (${bars_since_signal}/${this.config.max_confirmation_bars} bars)`);
    }

    // Add to history
    const entry: ConfirmationHistory = {
      bar_number: bars_since_signal,
      signal_strength,
      cluster_strength,
      trend_formation,
      action,
    };
    history.push(entry);
    this.signalHistory.set(signal_id, history);

    // Calculate combined quality
    const total_entry_quality = signal_strength * (0.5 + cluster_strength * 0.5);
    const confidence = this._calculateConfidence(action, cluster_strength, bars_since_signal);

    // Build reasoning
    this._buildReasoning(
      signal_strength,
      cluster_strength,
      trend_formation,
      bars_since_signal,
      action,
      reasoning
    );

    return {
      signal_triggered: true,
      bars_waiting: bars_since_signal,
      cluster_confirmed: clusters_confirm,
      total_entry_quality,
      action,
      confidence,
      reasoning,
      history,
    };
  }

  /**
   * Check if entry is confirmed now (shorthand)
   */
  isEntryConfirmed(
    cluster_strength: number,
    trend_formation: boolean
  ): boolean {
    return this._clustersConfirm(cluster_strength, trend_formation);
  }

  /**
   * Get entry quality with timing bonus
   * Quicker confirmation = higher quality
   */
  getQualityWithTimingBonus(
    base_quality: number,
    cluster_strength: number,
    bars_waited: number
  ): {
    quality_with_bonus: number;
    timing_bonus: number;
    bonus_description: string;
  } {
    // Bonus: confirmed on first bar = +0.15, second bar = +0.10, third bar = +0.05
    const timing_bonuses = [0.15, 0.1, 0.05];
    const timing_bonus = bars_waited < timing_bonuses.length ? timing_bonuses[bars_waited] : 0;

    const quality_with_bonus = Math.min(base_quality + timing_bonus, 1.0);

    const bonus_description =
      bars_waited === 0
        ? 'Immediate confirmation (max bonus +15%)'
        : bars_waited === 1
          ? 'Quick confirmation (bonus +10%)'
          : bars_waited === 2
            ? 'Delayed confirmation (bonus +5%)'
            : 'Late confirmation (no bonus)';

    return {
      quality_with_bonus,
      timing_bonus,
      bonus_description,
    };
  }

  /**
   * Simulate entry timing for a sequence of bars
   * Useful for backtesting
   */
  simulateEntrySequence(
    signal_id: string,
    signal_strength: number,
    barSequence: Array<{ cluster_strength: number; trend_formation: boolean }>
  ): {
    final_decision: DelayedEntryDecision;
    all_decisions: DelayedEntryDecision[];
  } {
    const all_decisions: DelayedEntryDecision[] = [];

    for (let i = 0; i < barSequence.length && i < this.config.max_confirmation_bars; i++) {
      const bar = barSequence[i];
      const decision = this.evaluateEntry(
        signal_id,
        signal_strength,
        bar.cluster_strength,
        bar.trend_formation,
        i
      );
      all_decisions.push(decision);

      if (decision.action !== 'WAIT') {
        return { final_decision: decision, all_decisions };
      }
    }

    // If we get here, signal expired without confirmation
    const final_decision = all_decisions[all_decisions.length - 1];
    return { final_decision, all_decisions };
  }

  /**
   * Clear history for a signal (e.g., after entry or cancel)
   */
  clearSignal(signal_id: string): void {
    this.signalHistory.delete(signal_id);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): void {
    this.signalHistory.clear();
  }

  /**
   * Get stats on signal confirmation rates
   */
  getConfirmationStats(): {
    total_signals: number;
    confirmed_signals: number;
    confirmation_rate: number;
    avg_bars_to_confirmation: number;
  } {
    let total_signals = 0;
    let confirmed_signals = 0;
    let total_bars = 0;

    for (const history of this.signalHistory.values()) {
      total_signals++;
      const last_decision = history[history.length - 1];
      if (last_decision.action === 'ENTER') {
        confirmed_signals++;
        total_bars += history.length;
      }
    }

    const confirmation_rate = total_signals > 0 ? confirmed_signals / total_signals : 0;
    const avg_bars = confirmed_signals > 0 ? total_bars / confirmed_signals : 0;

    return {
      total_signals,
      confirmed_signals,
      confirmation_rate,
      avg_bars_to_confirmation: avg_bars,
    };
  }

  // Private helpers

  private _clustersConfirm(cluster_strength: number, trend_formation: boolean): boolean {
    const strength_ok = cluster_strength > this.config.min_confirmation_strength;
    const formation_ok = !this.config.require_trend_formation || trend_formation;
    return strength_ok && formation_ok;
  }

  private _calculateConfidence(
    action: 'WAIT' | 'ENTER' | 'CANCEL',
    cluster_strength: number,
    bars_waited: number
  ): number {
    if (action === 'ENTER') {
      // Higher confidence if confirmed quickly with strong clusters
      const strength_factor = cluster_strength;
      const timing_factor = Math.max(0, 1 - bars_waited * 0.2); // Reduce for delays
      return Math.min(strength_factor * timing_factor, 1.0);
    } else if (action === 'CANCEL') {
      return 0.0; // No confidence in cancelled signal
    } else {
      // WAIT: confidence based on how likely confirmation is
      const strength_factor = cluster_strength / this.config.min_confirmation_strength;
      return Math.min(strength_factor * 0.6, 0.6); // Cap at 60% while waiting
    }
  }

  private _buildReasoning(
    signal_strength: number,
    cluster_strength: number,
    trend_formation: boolean,
    bars_waited: number,
    action: 'WAIT' | 'ENTER' | 'CANCEL',
    reasoning: string[]
  ): void {
    reasoning.push(`Signal strength: ${signal_strength.toFixed(2)}`);
    reasoning.push(`Cluster strength: ${cluster_strength.toFixed(2)}`);

    if (!trend_formation && this.config.require_trend_formation) {
      reasoning.push('No trend formation signal → confirmation not yet achieved');
    }

    if (cluster_strength < this.config.min_confirmation_strength) {
      reasoning.push(
        `Clusters too weak (${cluster_strength.toFixed(2)} < ${this.config.min_confirmation_strength.toFixed(2)})`
      );
    }

    if (action === 'ENTER') {
      const quality = signal_strength * (0.5 + cluster_strength * 0.5);
      reasoning.push(`Entry quality: ${quality.toFixed(2)} (signal × cluster agreement)`);
    } else if (action === 'CANCEL') {
      reasoning.push(`Max wait bars exceeded (${this.config.max_confirmation_bars})`);
    }
  }
}

/**
 * Factory function for EntryTimingOptimizer
 */
export function createEntryTimingOptimizer(config: EntryTimingConfig = {}): EntryTimingOptimizer {
  return new EntryTimingOptimizer(config);
}

/**
 * Quick helper: Evaluate single entry without instance
 */
export function evaluateQuickEntryTiming(
  signal_strength: number,
  cluster_strength: number,
  trend_formation: boolean,
  bars_since_signal: number = 0,
  max_bars: number = 3,
  min_strength: number = 0.60
): {
  action: 'WAIT' | 'ENTER' | 'CANCEL';
  total_quality: number;
  reasoning: string;
} {
  const optimizer = createEntryTimingOptimizer({
    max_confirmation_bars: max_bars,
    min_confirmation_strength: min_strength,
  });

  const decision = optimizer.evaluateEntry(
    'quick_eval',
    signal_strength,
    cluster_strength,
    trend_formation,
    bars_since_signal
  );

  return {
    action: decision.action,
    total_quality: decision.total_entry_quality,
    reasoning: decision.reasoning[0] || 'Unknown',
  };
}
