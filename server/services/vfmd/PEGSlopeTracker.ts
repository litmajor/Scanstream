// ─────────────────────────────────────────────
// PEGSlopeTracker.ts
// Detects the coiling phase: PEG rising from low baseline
// Entry arm condition — replaces BREAKOUT_TRANSITION (too late)
// ─────────────────────────────────────────────

export type PEGPhase =
  | "FLAT"         // PEG < 0.15, ΔPEG near zero — waiting
  | "ARMING"       // PEG [0.15–0.30], ΔPEG > 0 — coiling, arm for entry
  | "SPENT"        // PEG > 0.30 — energy already peaked, do not enter
  | "DECAYING"     // ΔPEG < 0 after peak — post-breakout, reset
  | "UNKNOWN";

export interface PEGState {
  phase:            PEGPhase;
  peg:              number;
  delta_peg:        number;    // PEG[n] - PEG[n-1]
  delta2_peg:       number;    // Acceleration: ΔPEG[n] - ΔPEG[n-1]
  /** True only when phase === ARMING — this is the entry gate */
  entry_armed:      boolean;
  /** How many consecutive bars in ARMING phase */
  arming_bar_count: number;
  timestamp:        number;
}

export interface PEGTrackerConfig {
  flat_threshold:    number;   // PEG below this = FLAT. Default: 0.15
  arming_min:        number;   // Coiling range lower bound. Default: 0.15
  arming_max:        number;   // Coiling range upper bound. Default: 0.30
  spent_threshold:   number;   // Above this = SPENT. Default: 0.30
  /** Minimum positive ΔPEG to count as rising */
  min_delta:         number;   // Default: 0.005
  /** Minimum bars in ARMING before entry_armed = true */
  min_arming_bars:   number;   // Default: 2
  /** Smoothing alpha for PEG history (0 = no smooth, 1 = full smooth) */
  smooth_alpha:      number;   // Default: 0.3
}

export const DEFAULT_PEG_CONFIG: PEGTrackerConfig = {
  flat_threshold:   0.15,
  arming_min:       0.15,
  arming_max:       0.30,
  spent_threshold:  0.30,
  min_delta:        0.005,
  min_arming_bars:  2,
  smooth_alpha:     0.3,
};

// ── Implementation ───────────────────────────────────────────────────────────

export class PEGSlopeTracker {
  private smoothed_peg_history: number[] = [];
  private arming_count = 0;

  /**
   * Feed PEG values bar by bar.
   * Call once per bar close with the latest raw PEG value.
   */
  update(raw_peg: number, timestamp: number, config: PEGTrackerConfig = DEFAULT_PEG_CONFIG): PEGState {
    // Smooth PEG to prevent noise-driven phase flips
    const prev_smooth = this.smoothed_peg_history.length > 0
      ? this.smoothed_peg_history[this.smoothed_peg_history.length - 1]
      : raw_peg;

    const smooth_peg = config.smooth_alpha * raw_peg + (1 - config.smooth_alpha) * prev_smooth;
    this.smoothed_peg_history.push(smooth_peg);

    // Keep last 20 bars
    if (this.smoothed_peg_history.length > 20) {
      this.smoothed_peg_history.shift();
    }

    const n = this.smoothed_peg_history.length;
    const peg      = smooth_peg;
    const prev_peg = n >= 2 ? this.smoothed_peg_history[n - 2] : peg;
    const prev2    = n >= 3 ? this.smoothed_peg_history[n - 3] : prev_peg;

    const delta_peg  = peg - prev_peg;
    const prev_delta = prev_peg - prev2;
    const delta2_peg = delta_peg - prev_delta;

    // ── Phase classification ──────────────────────────────────────────────────
    let phase: PEGPhase;

    if (peg >= config.spent_threshold) {
      phase = delta_peg < 0 ? "DECAYING" : "SPENT";
      this.arming_count = 0;

    } else if (
      peg >= config.arming_min &&
      peg <  config.arming_max &&
      delta_peg >= config.min_delta
    ) {
      phase = "ARMING";
      this.arming_count++;

    } else if (peg < config.flat_threshold) {
      phase = "FLAT";
      this.arming_count = 0;

    } else if (delta_peg < 0 && peg < config.arming_max) {
      phase = "DECAYING";
      this.arming_count = 0;

    } else {
      phase = "UNKNOWN";
      this.arming_count = 0;
    }

    const entry_armed = phase === "ARMING" && this.arming_count >= config.min_arming_bars;

    return {
      phase,
      peg,
      delta_peg,
      delta2_peg,
      entry_armed,
      arming_bar_count: this.arming_count,
      timestamp,
    };
  }

  reset(): void {
    this.smoothed_peg_history = [];
    this.arming_count = 0;
  }
}
