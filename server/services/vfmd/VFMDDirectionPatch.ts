// ─────────────────────────────────────────────────────────────────────────────
// VFMDDirectionPatch.ts
// Drop-in replacement for sin(dominantAngle) direction logic
// Patches ProfitEstimator.ts + VFMDPhysicsAgent directional bias
// ─────────────────────────────────────────────────────────────────────────────

import { HTFTrendIndicator, HTFTrendState, HTFBar, DEFAULT_HTF_CONFIG } from "./HTFTrendIndicator";
import { SessionEntryFilter, SessionFilterResult, DEFAULT_SESSION_FILTER } from "./SessionEntryFilter";
import type { PhysicsMetrics as BasePhysicsMetrics } from "./types";

// ✅ Re-export HTFBar for use in VFMDPhysicsAgent imports
export type { HTFBar } from "./HTFTrendIndicator";

// ── Regime Definitions (from TradeConditionAnalyzer) ────────────────────────

export type MarketRegime =
  | "CONSOLIDATION"    // PF 1.97 — primary edge zone. PEG coiling, TRIGGER pending
  | "TRENDING_UP"      // Sustained directional flow, lower PEG variance
  | "TRENDING_DOWN"    // Same, opposite
  | "TURBULENT_CHOP"   // High TI, low coherence — no entries
  | "LOW_VOLATILITY"   // PEG flat, TRIGGER absent — wait
  | "UNKNOWN";

export interface RegimeState {
  regime:          MarketRegime;
  /** PEG level at regime classification */
  peg:             number;
  /** Turbulence Index */
  ti:              number;
  /** Field coherence [0–1] */
  coherence:       number;
  /** Allows any entry */
  tradeable:       boolean;
  /** Allows short entries specifically */
  shorts_allowed:  boolean;
}

// ── Regime Classifier ────────────────────────────────────────────────────────

export class RegimeClassifier {
  classify(peg: number, ti: number, coherence: number): RegimeState {
    let regime:       MarketRegime;
    let tradeable:    boolean;
    let shorts_allowed: boolean;

    if (ti > 0.6 || coherence < 0.3) {
      // High turbulence / low coherence → chop, no entries
      regime        = "TURBULENT_CHOP";
      tradeable     = false;
      shorts_allowed = false;

    } else if (peg > 0.30 && ti < 0.4 && coherence > 0.5) {
      // High stored energy, low turbulence, coherent field → consolidation coiling
      regime        = "CONSOLIDATION";
      tradeable     = true;
      shorts_allowed = true; // allowed but gated by HTF bias

    } else if (peg < 0.15 && ti < 0.3) {
      // Flat energy, quiet — wait for setup
      regime        = "LOW_VOLATILITY";
      tradeable     = false;
      shorts_allowed = false;

    } else if (coherence > 0.6 && ti < 0.35) {
      // Coherent directional flow — trending
      // Determine up vs down from PEG trajectory (caller should pass delta)
      regime        = "TRENDING_UP"; // default; caller can override with HTF
      tradeable     = true;
      shorts_allowed = true;

    } else {
      regime        = "UNKNOWN";
      tradeable     = false;
      shorts_allowed = false;
    }

    return { regime, peg, ti, coherence, tradeable, shorts_allowed };
  }
}

// ── Direction Patch — Full Gate Stack ────────────────────────────────────────

export interface PhysicsMetrics extends BasePhysicsMetrics {
  // Uses field names from actual PhysicsMetrics in types.ts:
  // peg, turbulenceIndex (mapped to ti), coherenceScore (mapped to coherence)
  // dominantAngle is kept for backward compat, no longer used for direction
  trigger?: number; // Optional trigger value, added by caller
}

export interface DirectionDecision {
  allowed:          boolean;
  direction:        "LONG" | "SHORT" | "NONE";
  /** Replaces flowMomentum from sin(dominantAngle) */
  direction_score:  number;
  regime:           RegimeState;
  htf_trend:        HTFTrendState;
  session_filter:   SessionFilterResult;
  block_reason:     string | null;
}

export class VFMDDirectionPatch {
  private htfIndicator   = new HTFTrendIndicator();
  private sessionFilter  = new SessionEntryFilter();
  private regimeClassifier = new RegimeClassifier();

  /**
   * Call this instead of sin(dominantAngle) to get a direction decision.
   *
   * Integration point in VFMDPhysicsAgent.generateSignal():
   * Replace the DIRECTION layer gate with this method.
   *
   * @param metrics    PhysicsMetrics from PhysicsCalculator
   * @param htf4hBars  Last N 4H candles (min 80 bars recommended)
   * @param utcTimestamp Current bar timestamp
   */
  evaluate(
    metrics:      PhysicsMetrics,
    htf4hBars:    HTFBar[],
    utcTimestamp: number
  ): DirectionDecision {
    // ── 1. Regime ────────────────────────────────────────────────────────────
    // Map field names: turbulenceIndex → ti, coherenceScore → coherence
    const regime = this.regimeClassifier.classify(
      metrics.peg,
      metrics.turbulenceIndex,  // Maps ti field name
      metrics.coherenceScore     // Maps coherence field name
    );

    if (!regime.tradeable) {
      return this._block("NONE", regime, this.htfIndicator.compute(htf4hBars), {
        allowed: false,
        reason: `Regime ${regime.regime} — not tradeable`,
        active_window: null,
        wait_mins: 0,
      }, `Regime gate: ${regime.regime}`);
    }

    // ── 2. HTF trend ─────────────────────────────────────────────────────────
    const htf = this.htfIndicator.compute(htf4hBars, DEFAULT_HTF_CONFIG);

    if (htf.bias === "NEUTRAL" || htf.confidence === "LOW") {
      return this._block("NONE", regime, htf, {
        allowed: false,
        reason: `HTF bias ${htf.bias} confidence ${htf.confidence} — no directional edge`,
        active_window: null,
        wait_mins: 0,
      }, `HTF gate: ${htf.bias} / ${htf.confidence}`);
    }

    const candidate_direction: "LONG" | "SHORT" =
      htf.bias === "BULLISH" ? "LONG" : "SHORT";

    // ── 3. Regime × Direction gate ───────────────────────────────────────────
    if (candidate_direction === "SHORT" && !regime.shorts_allowed) {
      return this._block("NONE", regime, htf, {
        allowed: false,
        reason: `Regime ${regime.regime} blocks short entries`,
        active_window: null,
        wait_mins: 0,
      }, `Regime blocks shorts in ${regime.regime}`);
    }

    // ── 4. Session filter ────────────────────────────────────────────────────
    const session = this.sessionFilter.evaluate(
      candidate_direction,
      utcTimestamp,
      DEFAULT_SESSION_FILTER
    );

    if (!session.allowed) {
      return this._block(candidate_direction, regime, htf, session, session.reason!);
    }

    // ── 5. All gates passed ───────────────────────────────────────────────────
    // direction_score replaces sin(dominantAngle):
    // Use HTF score directly — it's already [-1, +1] and causally linked to price
    const direction_score = htf.score;

    return {
      allowed:         true,
      direction:       candidate_direction,
      direction_score,
      regime,
      htf_trend:       htf,
      session_filter:  session,
      block_reason:    null,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _block(
    direction:     "LONG" | "SHORT" | "NONE",
    regime:        RegimeState,
    htf:           HTFTrendState,
    session:       SessionFilterResult,
    reason:        string
  ): DirectionDecision {
    return {
      allowed:         false,
      direction,
      direction_score: 0,
      regime,
      htf_trend:       htf,
      session_filter:  session,
      block_reason:    reason,
    };
  }
}

// ── Integration Shim ─────────────────────────────────────────────────────────
//
// In VFMDPhysicsAgent.generateSignal(), find the DIRECTION layer:
//
//   BEFORE (broken):
//   const flowMomentum = Math.sin(metrics.dominantAngle);
//   const direction = flowMomentum > 0 ? 'LONG' : 'SHORT';
//
//   AFTER (patched):
//   const directionPatch = new VFMDDirectionPatch();
//   const decision = directionPatch.evaluate(metrics, htf4hBars, bar.timestamp);
//   if (!decision.allowed) return null; // skip this bar
//   const direction = decision.direction;
//   const flowMomentum = decision.direction_score; // replaces sin(dominantAngle)
//
// In ProfitEstimator.ts, the directional bias input should be:
//   decision.direction_score  (not flowMomentum from physics)
//
// The regime state is also available for downstream use:
//   decision.regime.regime  → pass to your regime-aware position sizing
