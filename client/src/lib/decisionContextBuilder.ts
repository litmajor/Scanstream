/**
 * DecisionContext Factory & Builder
 * 
 * Responsible for:
 * 1. Building DecisionContext from MarketFrame + signals
 * 2. Applying quality checks and constraints
 * 3. Freezing context to prevent agent mutations
 * 4. Validating context for agent consumption
 */

import type { MarketFrame } from '../types/MarketFrame';
import type { Signal } from '../pages/trading-terminal'; // Import from your signal type
import {
  type DecisionContext,
  type DecisionContextSignals,
  type DecisionContextQuality,
  type DecisionContextConstraints,
  createDecisionContext,
  freezeDecisionContext,
  assertDecisionContext,
} from '../types/DecisionContext';
import { verifyDataLayerInvariants } from './invariants';

/**
 * Configuration for building DecisionContext.
 * Allows customization of quality thresholds and constraints per agent/strategy.
 */
export interface DecisionContextConfig {
  /** Min confidence to consider data quality acceptable (0-1, default 0.5) */
  minConfidence?: number;

  /** Max age of data before marking as stale (ms, default 5 minutes) */
  maxAgeMs?: number;

  /** Allow trading? (default true) */
  allowTrade?: boolean;

  /** Max position size in USD (default 10000) */
  maxSizeUsd?: number;

  /** Max leverage (default 1.0 = no leverage) */
  maxLeverage?: number;

  /** Custom constraints (extensible) */
  customConstraints?: Record<string, any>;

  /** Should context be frozen? (default true) */
  freeze?: boolean;
}

/**
 * Default configuration for DecisionContext building.
 */
const DEFAULT_CONFIG: DecisionContextConfig = {
  minConfidence: 0.5,
  maxAgeMs: 5 * 60 * 1000, // 5 minutes
  allowTrade: true,
  maxSizeUsd: 10000,
  maxLeverage: 1.0,
  freeze: true,
};

/**
 * Derive signals from a MarketFrame (heuristic approach).
 * In production, this would pull from your signal-pipeline service.
 */
function deriveSignalsFromFrame(frame: MarketFrame): DecisionContextSignals {
  const signals: DecisionContextSignals = {};

  // Trend: compare current close to EMA
  if (frame.indicators?.ema20) {
    if (frame.close > frame.indicators.ema20) {
      signals.trend = 'up';
    } else if (frame.close < frame.indicators.ema20) {
      signals.trend = 'down';
    } else {
      signals.trend = 'flat';
    }
  }

  // Breakout: simple check for close near high
  if (frame.high > 0 && frame.close / frame.high > 0.95) {
    signals.breakout = true;
  }

  // RSI-based signals
  if (frame.indicators?.rsi) {
    const rsi = frame.indicators.rsi;
    if (rsi > 70) {
      signals.overbought = true;
    } else if (rsi < 30) {
      signals.oversold = true;
    }
  }

  return signals;
}

/**
 * Compute quality metrics for a DecisionContext.
 */
function computeQuality(
  frame: MarketFrame,
  signals: Signal[] = [],
  config: DecisionContextConfig = {}
): DecisionContextQuality {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Freshness check
  const ageMs = Date.now() - frame.meta.tsClose;
  const isStale = ageMs > (cfg.maxAgeMs ?? 5 * 60 * 1000);

  // Fallback check
  const isFallback = frame.meta.source === 'fallback';

  // Confidence: average signal confidence + source quality
  const signalConfidence = signals.length > 0
    ? signals.reduce((sum, s) => sum + (s.confidence ?? 0.5), 0) / signals.length
    : 0.5;
  const sourceConfidence = frame.meta.source === 'live' ? 1.0 : (frame.meta.source === 'replay' ? 0.7 : 0.3);
  const confidence = (signalConfidence + sourceConfidence) / 2;

  return {
    confidence: Math.min(1, Math.max(0, confidence)),
    isStale,
    isFallback,
    reason: isStale ? `Data is ${ageMs}ms old (threshold: ${cfg.maxAgeMs}ms)` : undefined,
  };
}

/**
 * Build a DecisionContext from a MarketFrame and optional signals.
 * 
 * This is the primary entry point for agents to consume market data safely.
 * The returned context is frozen and validated before return.
 */
export function buildDecisionContext(
  frame: MarketFrame,
  signals: Signal[] = [],
  config: DecisionContextConfig = {}
): DecisionContext {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Derive signals from frame if not provided
  const derivedSignals = deriveSignalsFromFrame(frame);

  // Compute quality
  const quality = computeQuality(frame, signals, cfg);

  // Build constraints
  const constraints: DecisionContextConstraints = {
    allowTrade: cfg.allowTrade ?? true,
    maxSizeUsd: cfg.maxSizeUsd ?? 10000,
    maxLeverage: cfg.maxLeverage ?? 1.0,
    ...cfg.customConstraints,
  };

  // Create base context
  const ctx = createDecisionContext(frame, derivedSignals, quality, constraints);

  // Validate context
  assertDecisionContext(ctx);

  // Verify invariants
  verifyDataLayerInvariants(ctx, { source: 'agent', mode: frame.meta.source === 'replay' ? 'backtest' : 'live' });

  // Freeze if requested
  if (cfg.freeze !== false) {
    return freezeDecisionContext(ctx);
  }

  return ctx;
}

/**
 * Build DecisionContext with strict safety checks (recommended for production).
 * 
 * Adds extra validation:
 * - Rejects stale data
 * - Rejects fallback data
 * - Requires minimum confidence
 * - Throws if invariants violated
 */
export function buildDecisionContextStrict(
  frame: MarketFrame,
  signals: Signal[] = [],
  config: DecisionContextConfig = {}
): DecisionContext {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Reject stale data
  const ageMs = Date.now() - frame.meta.tsClose;
  if (ageMs > (cfg.maxAgeMs ?? 5 * 60 * 1000)) {
    throw new Error(
      `[DecisionContext] Stale data rejected: ${ageMs}ms old (max: ${cfg.maxAgeMs}ms). Symbol: ${frame.symbol}`
    );
  }

  // Reject fallback data
  if (frame.meta.source === 'fallback') {
    throw new Error(
      `[DecisionContext] Fallback data rejected in strict mode. Symbol: ${frame.symbol}, Reason: ${frame.meta.fallbackReason}`
    );
  }

  // Check minimum confidence
  const quality = computeQuality(frame, signals, cfg);
  const minConf = cfg.minConfidence ?? 0.5;
  if (quality.confidence < minConf) {
    throw new Error(
      `[DecisionContext] Low confidence rejected: ${(quality.confidence * 100).toFixed(1)}% < ${(minConf * 100).toFixed(1)}%. Symbol: ${frame.symbol}`
    );
  }

  // Build and return context (will be frozen)
  return buildDecisionContext(frame, signals, cfg);
}

/**
 * Build DecisionContext with a time-limited replay mode (for backtesting).
 * 
 * Marks the context as replay and applies replay-specific constraints.
 */
export function buildDecisionContextForReplay(
  frame: MarketFrame,
  signals: Signal[] = [],
  config: DecisionContextConfig = {}
): DecisionContext {
  if (frame.meta.source !== 'replay') {
    console.warn('[DecisionContext] Building replay context from non-replay frame. Consider using frame with source="replay".');
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };

  // In replay, loosen some constraints (testing mode)
  cfg.allowTrade = cfg.allowTrade ?? true;
  cfg.maxSizeUsd = cfg.maxSizeUsd ?? 50000; // higher for backtest
  cfg.maxLeverage = cfg.maxLeverage ?? 2.0; // allow more leverage in backtest

  return buildDecisionContext(frame, signals, cfg);
}

/**
 * Validate that a DecisionContext is safe for consumption.
 * Checks immutability, constraint bounds, and invariants.
 */
export function validateDecisionContext(ctx: DecisionContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check frozen
  if (!Object.isFrozen(ctx)) {
    errors.push('DecisionContext is not frozen (mutable)');
  }

  // Check constraints sanity
  if (ctx.constraints.maxSizeUsd < 0) {
    errors.push('maxSizeUsd < 0 (invalid)');
  }
  if (ctx.constraints.maxLeverage < 0) {
    errors.push('maxLeverage < 0 (invalid)');
  }

  // Check quality bounds
  if (ctx.quality.confidence < 0 || ctx.quality.confidence > 1) {
    errors.push('confidence not in [0, 1]');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a "safe" wrapper around a raw DecisionContext.
 * Prevents accidental mutations and enforces read-only access.
 */
export function wrapDecisionContextSafely(ctx: DecisionContext): Readonly<DecisionContext> {
  if (!Object.isFrozen(ctx)) {
    console.warn('[DecisionContext] Wrapping unfrozen context. Recommend using buildDecisionContext() instead.');
    freezeDecisionContext(ctx);
  }
  return ctx as Readonly<DecisionContext>;
}
