/**
 * Decision Context Factory
 * 
 * Builds immutable DecisionContext from:
 * - MarketFrame (raw data with 67-column indicators)
 * - SignalObject (pre-computed signals)
 * - Constraints (trading guardrails)
 * 
 * Responsibility:
 * - Wrap frame + signals + quality + constraints
 * - Apply Object.freeze() for immutability
 * - Validate constraints
 * - Generate audittrail IDs
 * - Calculate confidence scores
 */

import type { DecisionContext } from '../../types/DecisionContext';
import type { MarketFrame } from '../../types/MarketFrame';
import type { SignalObject, SignalQuality, calculateSignalQuality } from '../../types/SignalObject';

/**
 * Constraints that bind agent behavior
 */
export interface DecisionContextConstraints {
  allowTrade: boolean; // Can agent execute trades?
  maxSizeUsd: number; // Maximum position size
  maxLeverage: number; // Maximum leverage (1.0 = no leverage)
  minConfidence?: number; // Minimum confidence threshold for signals
  [key: string]: any; // Per-strategy, per-agent custom constraints
}

/**
 * Quality metrics for the context
 */
export interface DecisionContextQuality {
  confidence: number; // 0–1, overall trust in this context
  isStale: boolean; // Data older than acceptable?
  isFallback: boolean; // Using degraded/fallback data?
  reason?: string; // Why quality is what it is
}

/**
 * Main factory: build DecisionContext from frame + signals
 * 
 * CRITICAL: This enforces time-authority rules:
 * - Replay mode ALWAYS has allowTrade=false
 * - Live mode's allowTrade depends on confidence
 * 
 * @param frame Market frame with indicators
 * @param signals Pre-computed signals
 * @param constraints Trading constraints
 * @param quality Optional quality override
 * @returns Frozen DecisionContext
 */
export function buildDecisionContext(
  frame: MarketFrame,
  signals: SignalObject,
  constraints: DecisionContextConstraints,
  quality?: Partial<DecisionContextQuality>
): DecisionContext {
  // Validate inputs
  validateDecisionContextInputs(frame, signals, constraints);

  // Calculate quality if not provided
  const calculatedQuality = calculateContextQuality(
    frame,
    signals,
    quality
  );

  // ENFORCE TIME AUTHORITY RULE:
  // Replay mode must never allow trading
  const enforcedConstraints = { ...constraints };
  let constraintReason = constraints.reason;

  if (frame.meta.mode === 'REPLAY') {
    enforcedConstraints.allowTrade = false;
    constraintReason = 'replay_mode_trading_disabled';
  } else if (frame.meta.mode === 'LIVE') {
    // Live mode: allowTrade depends on confidence
    const minConfidence = 0.5;
    if (calculatedQuality.confidence < minConfidence) {
      enforcedConstraints.allowTrade = false;
      constraintReason = `low_confidence (${calculatedQuality.confidence} < ${minConfidence})`;
    }
  }

  enforcedConstraints.reason = constraintReason;

  // Build the context object
  const ctx: DecisionContext = {
    mode: frame.meta.mode,
    symbol: frame.symbol,
    timeframe: frame.timeframe,
    frame: Object.freeze({ ...frame }), // Deep copy + freeze
    signals: Object.freeze({ ...signals }) as any, // Deep copy + freeze (type flexibility)
    quality: Object.freeze(calculatedQuality),
    constraints: Object.freeze(enforcedConstraints) as any,
    createdAt: Date.now(),
    contextId: generateContextId(frame),
  };

  // Freeze the entire context
  return Object.freeze(ctx);
}

/**
 * Build DecisionContext with strict quality requirements
 * Rejects stale or fallback data
 */
export function buildDecisionContextStrict(
  frame: MarketFrame,
  signals: SignalObject,
  constraints: DecisionContextConstraints
): DecisionContext {
  const ctx = buildDecisionContext(frame, signals, constraints);

  // Verify quality
  if (ctx.quality.isStale) {
    throw new Error(
      `[buildDecisionContextStrict] Data is stale (age: ${ctx.quality.reason})`
    );
  }

  if (ctx.quality.isFallback) {
    throw new Error(
      `[buildDecisionContextStrict] Using fallback data (${ctx.quality.reason})`
    );
  }

  if (ctx.quality.confidence < 0.7) {
    throw new Error(
      `[buildDecisionContextStrict] Low confidence (${ctx.quality.confidence}), below strict threshold of 0.7`
    );
  }

  return ctx;
}

/**
 * Build DecisionContext for replay / backtesting
 * Allows degraded quality but tracks it explicitly
 */
export function buildDecisionContextForReplay(
  frame: MarketFrame,
  signals: SignalObject,
  constraints: DecisionContextConstraints
): DecisionContext {
  const ctx = buildDecisionContext(frame, signals, constraints, {
    isFallback: frame.meta.source === 'REPLAY_API',
    reason: frame.meta.source === 'REPLAY_API' ? 'replay_data' : undefined,
  });

  return ctx;
}

/**
 * Calculate quality metrics for the context
 */
function calculateContextQuality(
  frame: MarketFrame,
  signals: SignalObject,
  override?: Partial<DecisionContextQuality>
): DecisionContextQuality {
  if (override) {
    return {
      confidence: override.confidence ?? 0.5,
      isStale: override.isStale ?? false,
      isFallback: override.isFallback ?? false,
      reason: override.reason,
    };
  }

  // Assess staleness
  const now = Date.now();
  const dataAge = now - (frame as any).createdAt || (frame as any).timestamp || now;
  const maxAgeMs = 60000; // 1 minute
  const isStale = dataAge > maxAgeMs;

  // Assess if using fallback (replay data)
  const isFallback = frame.meta.source === 'REPLAY_API';

  // Calculate confidence from multiple factors
  let confidence = 1.0;

  // Reduce confidence if stale
  if (isStale) {
    confidence *= 0.5;
  }

  // Reduce confidence if fallback
  if (isFallback) {
    confidence *= 0.7;
  }

  // Reduce confidence based on signal confluence
  confidence *= signals.confluenceScore;

  // Ensure confidence is 0–1
  confidence = Math.max(0, Math.min(confidence, 1));

  let reason: string | undefined;
  if (isStale) {
    reason = `stale_data (age: ${dataAge}ms)`;
  } else if (isFallback) {
    reason = `fallback_source (${frame.meta.source})`;
  } else if (confidence < 0.6) {
    reason = `low_confluence (score: ${signals.confluenceScore})`;
  }

  return {
    confidence,
    isStale,
    isFallback,
    reason,
  };
}

/**
 * Validate inputs before building context
 */
function validateDecisionContextInputs(
  frame: MarketFrame,
  signals: SignalObject,
  constraints: DecisionContextConstraints
): void {
  // Validate frame
  if (!frame.symbol) throw new Error('DecisionContext: frame.symbol required');
  if (!frame.timeframe) throw new Error('DecisionContext: frame.timeframe required');
  if (typeof frame.close !== 'number') throw new Error('DecisionContext: frame.close must be number');

  // Validate signals
  if (!signals.trend) throw new Error('DecisionContext: signals.trend required');
  if (!signals.momentum) throw new Error('DecisionContext: signals.momentum required');

  // Validate constraints
  if (constraints.maxSizeUsd <= 0) {
    throw new Error('DecisionContext: constraints.maxSizeUsd must be > 0');
  }
  if (constraints.maxLeverage < 1) {
    throw new Error('DecisionContext: constraints.maxLeverage must be >= 1');
  }
}

/**
 * Generate unique context ID for audit trail
 * Format: SYMBOL-TIMEFRAME-TIMESTAMP-HASH
 */
function generateContextId(frame: MarketFrame): string {
  const timestamp = Date.now();
  const hash = Math.random().toString(36).substring(2, 8);
  return `${frame.symbol}-${frame.timeframe}-${timestamp}-${hash}`;
}

/**
 * Validate that a DecisionContext is immutable
 * (For testing/verification)
 */
export function assertContextImmutable(ctx: DecisionContext): void {
  try {
    // Try to mutate frame (should fail)
    (ctx.frame as any).close = 99999;
    throw new Error('DecisionContext.frame is mutable (should be frozen)');
  } catch (err) {
    if ((err as any).message.includes('Cannot assign')) {
      // Good, it's frozen
      return;
    }
    throw err;
  }
}

/**
 * Merge multiple DecisionContexts (for multi-timeframe agents)
 * Returns a new context with merged signals
 */
export function mergeDecisionContexts(
  contexts: DecisionContext[],
  primaryContext: DecisionContext
): DecisionContext {
  if (contexts.length === 0) return primaryContext;
  if (contexts.length === 1) return contexts[0];

  // Merge signals: consensus across timeframes
  const mergedSignals = {
    ...primaryContext.signals,
    
    // Average confidence across all contexts
    trendStrength: contexts.reduce((sum, c) => sum + c.signals.trendStrength, 0) / contexts.length,
    confluenceScore: contexts.reduce((sum, c) => sum + c.signals.confluenceScore, 0) / contexts.length,
  };

  // Merge constraints: use most restrictive
  const mergedConstraints = {
    allowTrade: contexts.every(c => c.constraints.allowTrade),
    maxSizeUsd: Math.min(...contexts.map(c => c.constraints.maxSizeUsd)),
    maxLeverage: Math.min(...contexts.map(c => c.constraints.maxLeverage)),
  };

  // Merge quality: lowest confidence wins
  const minConfidence = Math.min(...contexts.map(c => c.quality.confidence));

  return buildDecisionContext(
    primaryContext.frame,
    mergedSignals as any,
    mergedConstraints,
    {
      confidence: minConfidence,
      isStale: contexts.some(c => c.quality.isStale),
      isFallback: contexts.some(c => c.quality.isFallback),
    }
  );
}

/**
 * Clone a DecisionContext (for testing/modification)
 */
export function cloneDecisionContext(ctx: DecisionContext): DecisionContext {
  return buildDecisionContext(
    ctx.frame,
    ctx.signals as any,
    ctx.constraints,
    {
      confidence: ctx.quality.confidence,
      isStale: ctx.quality.isStale,
      isFallback: ctx.quality.isFallback,
    }
  );
}

/**
 * Batch build DecisionContexts
 */
export function buildDecisionContextsBatch(
  frames: MarketFrame[],
  signals: SignalObject[],
  constraints: DecisionContextConstraints
): DecisionContext[] {
  if (frames.length !== signals.length) {
    throw new Error('buildDecisionContextsBatch: frames and signals length must match');
  }

  return frames.map((frame, i) =>
    buildDecisionContext(frame, signals[i], constraints)
  );
}

/**
 * Export context for debugging/analysis
 */
export function exportContextForAnalysis(ctx: DecisionContext): Record<string, any> {
  return {
    contextId: ctx.contextId,
    symbol: ctx.symbol,
    timeframe: ctx.timeframe,
    timestamp: new Date(ctx.createdAt).toISOString(),
    
    // Frame data
    frame: {
      close: ctx.frame.close,
      volume: ctx.frame.volume,
      source: ctx.frame.meta.source,
      isFinal: ctx.frame.meta.isFinal,
    },
    
    // Signals
    signals: {
      trend: ctx.signals.trend,
      trendStrength: ctx.signals.trendStrength,
      breakout: ctx.signals.breakout,
      momentum: ctx.signals.momentum,
      confluenceScore: ctx.signals.confluenceScore,
    },
    
    // Quality
    quality: {
      confidence: ctx.quality.confidence,
      isStale: ctx.quality.isStale,
      isFallback: ctx.quality.isFallback,
    },
    
    // Constraints
    constraints: {
      allowTrade: ctx.constraints.allowTrade,
      maxSizeUsd: ctx.constraints.maxSizeUsd,
      maxLeverage: ctx.constraints.maxLeverage,
    },
  };
}
