// ─────────────────────────────────────────────
// VFMDEntryGate.ts
// Complete fixed entry logic — all patches composed
// Drop this into VFMDPhysicsAgent.generateSignal()
// ─────────────────────────────────────────────

import { PEGSlopeTracker, PEGState, DEFAULT_PEG_CONFIG } from "./PEGSlopeTracker";
import { VFMDDirectionPatch, type PhysicsMetrics, type DirectionDecision } from "./VFMDDirectionPatch";
import type { HTFBar } from "./HTFTrendIndicator";

// ── Gate Result ───────────────────────────────────────────────────────────────

export type GateStatus =
  | "ENTER"        // All gates pass — place trade
  | "WAIT"         // PEG not armed yet — hold
  | "BLOCKED";     // Hard block — regime, session, or HTF

export interface EntryGateResult {
  status:        GateStatus;
  direction:     "LONG" | "SHORT" | "NONE";
  block_reason:  string | null;

  // Layer outputs for logging/diagnostics
  peg_state:     PEGState;
  direction_decision: DirectionDecision;

  // Downstream inputs
  /** Pass this into PositionSizer instead of raw flowMomentum */
  direction_score: number;
  /** Regime for position sizing adjustments */
  regime_label:  string;
}

// ── Gate Config ───────────────────────────────────────────────────────────────

export interface EntryGateConfig {
  /** Minimum TRIGGER value to proceed (e.g. 0.25) */
  min_trigger: number;
}

export const DEFAULT_GATE_CONFIG: EntryGateConfig = {
  min_trigger: 0.25,
};

// ── Implementation ────────────────────────────────────────────────────────────

export class VFMDEntryGate {
  private pegTracker     = new PEGSlopeTracker();
  private directionPatch = new VFMDDirectionPatch();

  /**
   * Primary entry gate. Call once per 1H bar close.
   *
   * @param metrics      PhysicsMetrics from PhysicsCalculator (PEG, TI, coherence, trigger, dominantAngle)
   * @param htf4hBars    Last 80+ 4H candles for HTF trend state
   * @param utcTimestamp Current bar timestamp (ms)
   * @param config       Gate thresholds
   */
  evaluate(
    metrics:      PhysicsMetrics & { trigger: number },
    htf4hBars:    HTFBar[],
    utcTimestamp: number,
    config:       EntryGateConfig = DEFAULT_GATE_CONFIG
  ): EntryGateResult {

    // ── Gate 1: TRIGGER minimum ───────────────────────────────────────────────
    if (metrics.trigger < config.min_trigger) {
      const peg_state = this.pegTracker.update(metrics.peg, utcTimestamp);
      const direction_decision = this.directionPatch.evaluate(metrics, htf4hBars, utcTimestamp);
      return {
        status:              "WAIT",
        direction:           "NONE",
        block_reason:        `TRIGGER ${metrics.trigger.toFixed(3)} below minimum ${config.min_trigger}`,
        peg_state,
        direction_decision,
        direction_score:     0,
        regime_label:        direction_decision.regime.regime,
      };
    }

    // ── Gate 2: PEG arming state ──────────────────────────────────────────────
    const peg_state = this.pegTracker.update(metrics.peg, utcTimestamp);

    if (peg_state.phase === "SPENT") {
      const direction_decision = this.directionPatch.evaluate(metrics, htf4hBars, utcTimestamp);
      return {
        status:              "BLOCKED",
        direction:           "NONE",
        block_reason:        `PEG SPENT (${peg_state.peg.toFixed(3)} > 0.30) — energy already released, no entry`,
        peg_state,
        direction_decision,
        direction_score:     0,
        regime_label:        direction_decision.regime.regime,
      };
    }

    if (!peg_state.entry_armed) {
      const direction_decision = this.directionPatch.evaluate(metrics, htf4hBars, utcTimestamp);
      return {
        status:              "WAIT",
        direction:           "NONE",
        block_reason:        `PEG phase ${peg_state.phase} — armed: ${peg_state.arming_bar_count}/${DEFAULT_PEG_CONFIG.min_arming_bars} bars`,
        peg_state,
        direction_decision,
        direction_score:     0,
        regime_label:        direction_decision.regime.regime,
      };
    }

    // ── Gate 3: Turbulent Chop hard block ─────────────────────────────────────
    // Evaluated inside directionPatch via RegimeClassifier
    const direction_decision = this.directionPatch.evaluate(metrics, htf4hBars, utcTimestamp);

    if (!direction_decision.allowed) {
      return {
        status:              "BLOCKED",
        direction:           direction_decision.direction,
        block_reason:        direction_decision.block_reason,
        peg_state,
        direction_decision,
        direction_score:     0,
        regime_label:        direction_decision.regime.regime,
      };
    }

    // ── All gates passed ──────────────────────────────────────────────────────
    // direction_score replaces sin(dominantAngle):
    // Use HTF score directly — it's already [-1, +1] and causally linked to price
    const direction_score = direction_decision.direction_score;

    return {
      status:              "ENTER",
      direction:           direction_decision.direction,
      block_reason:        null,
      peg_state,
      direction_decision,
      direction_score,
      regime_label:        direction_decision.regime.regime,
    };
  }

  /**
   * Call on trade close to reset PEG tracker for next setup.
   * Prevents stale arming state carrying over after a breakout.
   */
  onTradeClosed(): void {
    this.pegTracker.reset();
  }
}

// ── Integration Guide ─────────────────────────────────────────────────────────
//
// In VFMDPhysicsAgent.generateSignal(), replace the entire
// DIRECTION layer and ENERGY layer with:
//
//   private entryGate = new VFMDEntryGate();
//
//   const result = this.entryGate.evaluate(
//     { ...physicsMetrics, trigger: triggerValue },
//     this.htf4hBars,       // ← you need to feed 4H bars into the agent
//     currentBar.timestamp
//   );
//
//   if (result.status !== "ENTER") {
//     this.logGateBlock(result.block_reason);
//     return null;
//   }
//
//   // Use result.direction instead of dominantAngle > 0 ? 'LONG' : 'SHORT'
//   // Use result.direction_score instead of flowMomentum
//   // Use result.regime_label for position sizing tier
//
// In VFMDPhysicsAgent, add a method to feed 4H bars:
//   setHTFBars(bars: HTFBar[]): void { this.htf4hBars = bars; }
//
// Call onTradeClosed() when a position exits:
//   this.entryGate.onTradeClosed();
