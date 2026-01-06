/**
 * 🎯 MODE-AWARE CONFIDENCE SCORER
 * 
 * Key insight: Don't penalize confidence in LIVE mode
 * 
 * Phases:
 * 1. REPLAY (historical backfill): Confidence = 0 (data is old)
 * 2. MIXED (backfill + live): Confidence = capped (wait for LIVE to rise)
 * 3. LIVE (pure WS + filled memory): Confidence = natural rise (allow it!)
 * 
 * This prevents the false confidence penalty in live trading.
 */

import { OperationMode } from '../../types/market-data';
import type { WorldTick } from '../../types/market-data';
import { getModeDetector } from './mode-detector';

export interface ConfidenceScoreResult {
  /** Raw confidence (before mode adjustment) */
  raw: number;

  /** Mode-adjusted confidence */
  adjusted: number;

  /** Why was it adjusted? */
  reason: string;

  /** Current operation mode */
  mode: OperationMode;

  /** Should trading proceed? */
  canTrade: boolean;
}

export class ModeAwareConfidenceScorer {
  private static instance: ModeAwareConfidenceScorer;

  /**
   * Confidence thresholds by mode
   */
  private readonly thresholds = {
    [OperationMode.REPLAY]: 0, // Historical data = no trading
    [OperationMode.MIXED]: 0.5, // Cap at 50% during backfill
    [OperationMode.LIVE]: 1.0, // Unlimited in LIVE
  };

  private constructor() {}

  static getInstance(): ModeAwareConfidenceScorer {
    if (!ModeAwareConfidenceScorer.instance) {
      ModeAwareConfidenceScorer.instance = new ModeAwareConfidenceScorer();
    }
    return ModeAwareConfidenceScorer.instance;
  }

  /**
   * Score confidence taking mode into account
   *
   * @param rawConfidence Original confidence (0-1)
   * @param tick World tick with mode info
   * @param signal Signal context (optional metadata)
   * @returns Adjusted confidence and reasoning
   */
  score(
    rawConfidence: number,
    tick: WorldTick,
    signal?: { name?: string; source?: string }
  ): ConfidenceScoreResult {
    const mode = tick.mode;
    const threshold = this.thresholds[mode];
    const capped = Math.min(rawConfidence, threshold);
    const canTrade = capped > 0.3; // Minimum to trade

    const reason = this.getReason(mode, rawConfidence, capped);

    return {
      raw: rawConfidence,
      adjusted: capped,
      reason,
      mode,
      canTrade,
    };
  }

  /**
   * Alternative: Score without tick (use current mode)
   */
  scoreWithCurrentMode(rawConfidence: number, signalName?: string): ConfidenceScoreResult {
    const detector = getModeDetector();
    const mode = detector.detectMode();
    const threshold = this.thresholds[mode];
    const capped = Math.min(rawConfidence, threshold);
    const canTrade = capped > 0.3;

    const reason = this.getReason(mode, rawConfidence, capped);

    return {
      raw: rawConfidence,
      adjusted: capped,
      reason,
      mode,
      canTrade,
    };
  }

  /**
   * Generate human-readable reason for adjustment
   */
  private getReason(mode: OperationMode, raw: number, adjusted: number): string {
    if (mode === OperationMode.REPLAY) {
      return `REPLAY mode: Historical data, no trading (raw=${(raw * 100).toFixed(1)}%)`;
    }

    if (mode === OperationMode.MIXED) {
      if (adjusted < raw) {
        return `MIXED mode: Backfill in progress, capped at 50% (raw=${(raw * 100).toFixed(1)}% → adjusted=${(adjusted * 100).toFixed(1)}%)`;
      }
      return `MIXED mode: Backfill active, confidence within limits (${(adjusted * 100).toFixed(1)}%)`;
    }

    if (mode === OperationMode.LIVE) {
      return `LIVE mode: Full confidence allowed (${(adjusted * 100).toFixed(1)}%)`;
    }

    return 'Unknown mode';
  }

  /**
   * Is this signal tradeable?
   *
   * Criteria:
   * - Mode-adjusted confidence > 30%
   * - REPLAY always non-tradeable
   * - MIXED only if confidence > 50%
   * - LIVE allows normal thresholds
   */
  isTradeworthy(confidence: number, mode: OperationMode): boolean {
    if (mode === OperationMode.REPLAY) return false;
    if (mode === OperationMode.MIXED) return confidence > 0.5;
    if (mode === OperationMode.LIVE) return confidence > 0.3;
    return false;
  }

  /**
   * Diagnostic: Show thresholds by mode
   */
  diagnostics(): string {
    return [
      '[ConfidenceScorer] Thresholds by Mode:',
      `  REPLAY: ${(this.thresholds[OperationMode.REPLAY] * 100).toFixed(0)}% (no trading)`,
      `  MIXED:  ${(this.thresholds[OperationMode.MIXED] * 100).toFixed(0)}% (capped)`,
      `  LIVE:   ${(this.thresholds[OperationMode.LIVE] * 100).toFixed(0)}% (unlimited)`,
    ].join('\n');
  }
}

export function getConfidenceScorer(): ModeAwareConfidenceScorer {
  return ModeAwareConfidenceScorer.getInstance();
}
