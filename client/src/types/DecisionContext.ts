/**
 * DecisionContext — Agent Perception Layer (Safety Boundary)
 * 
 * Gives agents JUST ENOUGH REALITY to act safely and predictably.
 * This is where risk, confidence, and scope constraints enter.
 * 
 * RULES (Enforced):
 * ❌ Agents NEVER mutate a DecisionContext
 * ❌ Agents NEVER pull from storage directly (must go through API)
 * ✅ Agents act ONLY on DecisionContext
 * ✅ DecisionContext is read-only (frozen in production)
 * 
 * Why: Prevents rogue intelligence and bounds the blast radius of agent decisions.
 */

import type { MarketFrame } from './MarketFrame';

export interface DecisionContextSignals {
  /** Trend direction inferred from indicators (optional) */
  trend?: 'up' | 'down' | 'flat';

  /** Is there a breakout or significant event? */
  breakout?: boolean;

  /** Mean-reversion opportunity detected? */
  meanReversion?: boolean;

  /** Custom signals (extensible) */
  [key: string]: any;
}

export interface DecisionContextQuality {
  /** Overall confidence in this context (0–1) */
  confidence: number;

  /** Is the data stale? (older than threshold for this timeframe) */
  isStale: boolean;

  /** Is this derived from fallback data (cache/replay/degraded service)? */
  isFallback: boolean;

  /** Additional quality notes */
  reason?: string;
}

export interface DecisionContextConstraints {
  /** EXECUTION CONTROL: Is trading allowed? This is set based on mode === 'LIVE' && confidence > MIN */
  allowTrade: boolean;

  /** Why was allowTrade set to this value? (e.g., 'replay_mode', 'low_confidence', 'fallback_data') */
  reason?: string;

  /** QUALITY GATE: Minimum confidence required for this agent to act (0–1) */
  minConfidence: number;

  /** Maximum position size (USD equivalent) the agent can take */
  maxSizeUsd: number;

  /** Maximum leverage allowed (1.0 = no leverage) */
  maxLeverage: number;

  /** Custom constraints (stop-loss requirements, etc.) */
  [key: string]: any;
}

export interface DecisionContext {
  /** EXECUTION CONTROL: Is this LIVE (tradeable) or REPLAY (non-tradeable)? Inherited from frame.meta.mode */
  mode: 'LIVE' | 'REPLAY';

  /** Symbol being analyzed */
  symbol: string;

  /** Timeframe of analysis */
  timeframe: string;

  /** The underlying MarketFrame (read-only reference) */
  frame: Readonly<MarketFrame>;

  /** Derived signals and insights (read-only) */
  signals: Readonly<DecisionContextSignals>;

  /** Data quality metrics (read-only) */
  quality: Readonly<DecisionContextQuality>;

  /** Constraints and permissions (read-only) */
  constraints: Readonly<DecisionContextConstraints>;

  /** Timestamp this context was created */
  createdAt: number;

  /** Unique context ID for audit trails */
  contextId: string;
}

/**
 * Type guard: validate DecisionContext structure.
 */
export function isDecisionContext(obj: any): obj is DecisionContext {
  return (
    obj &&
    typeof obj.mode === 'string' &&
    ['LIVE', 'REPLAY'].includes(obj.mode) &&
    typeof obj.symbol === 'string' &&
    typeof obj.timeframe === 'string' &&
    obj.frame &&
    typeof obj.frame.symbol === 'string' &&
    obj.signals &&
    typeof obj.signals === 'object' &&
    obj.quality &&
    typeof obj.quality.confidence === 'number' &&
    typeof obj.quality.isStale === 'boolean' &&
    typeof obj.quality.isFallback === 'boolean' &&
    obj.constraints &&
    typeof obj.constraints.allowTrade === 'boolean' &&
    typeof obj.constraints.maxSizeUsd === 'number' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.contextId === 'string'
  );
}

/**
 * Assert: obj is a valid DecisionContext.
 * @throws Error if validation fails
 */
export function assertDecisionContext(obj: any): asserts obj is DecisionContext {
  if (!isDecisionContext(obj)) {
    throw new Error(
      `Invalid DecisionContext: expected { symbol, timeframe, frame, signals, quality, constraints, createdAt, contextId }, got ${JSON.stringify(obj)}`
    );
  }
}

/**
 * Make DecisionContext read-only (recursive freeze).
 * Prevents accidental mutations by agents.
 */
export function freezeDecisionContext<T extends DecisionContext>(ctx: T): Readonly<T> {
  Object.freeze(ctx);
  Object.freeze(ctx.frame);
  Object.freeze(ctx.signals);
  Object.freeze(ctx.quality);
  Object.freeze(ctx.constraints);
  return ctx as Readonly<T>;
}

/**
 * Factory: create a DecisionContext from a MarketFrame.
 */
export function createDecisionContext(
  frame: MarketFrame,
  signals: Partial<DecisionContextSignals> = {},
  quality: Partial<DecisionContextQuality> = {},
  constraints: Partial<DecisionContextConstraints> = {}
): DecisionContext {
  const ctx: DecisionContext = {
    symbol: frame.symbol,
    timeframe: frame.timeframe,
    frame: frame,
    signals: signals as DecisionContextSignals,
    quality: {
      confidence: quality.confidence ?? 0.5,
      isStale: quality.isStale ?? false,
      isFallback: quality.isFallback ?? frame.meta.source !== 'live',
      reason: quality.reason,
    },
    constraints: {
      allowTrade: constraints.allowTrade ?? true,
      maxSizeUsd: constraints.maxSizeUsd ?? 10000,
      maxLeverage: constraints.maxLeverage ?? 1.0,
      ...constraints,
    },
    createdAt: Date.now(),
    contextId: `ctx_${frame.symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  };

  return freezeDecisionContext(ctx);
}
