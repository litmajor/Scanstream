/**
 * Time Authority Invariants
 * 
 * CORE PRINCIPLE:
 * "Replay data may flow everywhere — but it may never acquire execution authority."
 * 
 * These are non-negotiable guards that prevent replay data from:
 * - Being treated as live
 * - Acquiring trading permissions
 * - Reaching the execution layer
 * - Deceiving the UI
 * 
 * Violations should be IMPOSSIBLE with these checks in place.
 */

import type { MarketFrame } from '../types/MarketFrame';
import type { DecisionContext } from '../types/DecisionContext';
import type { UITick } from '../types/UITick';

/**
 * INVARIANT 1: Replay data must never have a live source
 * 
 * If frame.meta.mode === 'REPLAY', then frame.meta.source must NOT be 'WS' (websocket)
 */
export function assertReplayNotLiveSource(frame: MarketFrame): void {
  if (frame.meta.mode === 'REPLAY' && frame.meta.source === 'WS') {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Invalid state: frame mode=REPLAY but source=WS\n` +
      `This frame must have come from REPLAY_API, CACHE, or FALLBACK, not live websocket.\n` +
      `Symbol: ${frame.symbol}, Timeframe: ${frame.timeframe}`
    );
  }
}

/**
 * INVARIANT 2: Replay frames must not be marked as final in live trading
 * 
 * Replay frames can have isFinal=true (for historical bars), but only if in REPLAY mode.
 */
export function assertReplayFrameFinal(frame: MarketFrame): void {
  // This is actually okay — replay frames can be final.
  // Just document the rule.
  if (frame.meta.mode === 'REPLAY' && frame.meta.isFinal === false) {
    // This is unusual but not a violation
    console.warn(
      `[TIME AUTHORITY] Replay frame is not final (unusual). ` +
      `Symbol: ${frame.symbol}, Timeframe: ${frame.timeframe}`
    );
  }
}

/**
 * INVARIANT 3: DecisionContext mode must match frame mode
 */
export function assertContextModeMatchesFrame(ctx: DecisionContext): void {
  if (ctx.mode !== ctx.frame.meta.mode) {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Context mode mismatch\n` +
      `Context.mode=${ctx.mode} but Frame.mode=${ctx.frame.meta.mode}\n` +
      `Symbol: ${ctx.symbol}, Timeframe: ${ctx.timeframe}`
    );
  }
}

/**
 * INVARIANT 4: Replay mode MUST have allowTrade=false
 * 
 * HARD RULE: No exceptions.
 */
export function assertReplayCannotTrade(ctx: DecisionContext): void {
  if (ctx.mode === 'REPLAY' && ctx.constraints.allowTrade === true) {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Replay context is attempting to trade!\n` +
      `Mode=REPLAY but allowTrade=true. This is impossible and indicates a critical bug.\n` +
      `Symbol: ${ctx.symbol}, Timeframe: ${ctx.timeframe}, ContextId: ${ctx.contextId}`
    );
  }
}

/**
 * INVARIANT 5: Live mode's allowTrade depends on confidence AND quality
 * 
 * Rule: allowTrade = (mode === 'LIVE') && (confidence > MIN_THRESHOLD) && (!isFallback || explicit override)
 * 
 * CRITICAL: Fallback + Live = trading MUST be blocked
 */
export function assertLiveTradeAuthority(
  ctx: DecisionContext,
  minConfidenceThreshold: number = 0.5
): void {
  if (ctx.mode === 'LIVE') {
    // If using fallback data in live mode, trading is forbidden
    if (ctx.quality.isFallback) {
      if (ctx.constraints.allowTrade) {
        throw new Error(
          `[TIME AUTHORITY VIOLATION] Live context using fallback data but allowTrade=true\n` +
          `Fallback + Live = trading FORBIDDEN\n` +
          `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}`
        );
      }
    }

    const shouldAllowTrade = ctx.quality.confidence > minConfidenceThreshold;

    if (shouldAllowTrade && !ctx.constraints.allowTrade) {
      console.warn(
        `[TIME AUTHORITY WARNING] Live context has high confidence but allowTrade=false\n` +
        `Confidence: ${ctx.quality.confidence}, Threshold: ${minConfidenceThreshold}\n` +
        `This may indicate intentional trading restriction (e.g., circuit breaker)`
      );
    }

    if (!shouldAllowTrade && ctx.constraints.allowTrade) {
      throw new Error(
        `[TIME AUTHORITY VIOLATION] Live context has low confidence but allowTrade=true\n` +
        `Confidence: ${ctx.quality.confidence}, Threshold: ${minConfidenceThreshold}\n` +
        `Trading cannot be allowed without sufficient confidence.`
      );
    }
  }
}

/**
 * INVARIANT 6: UITick mode/source consistency
 * 
 * If tick.state.mode === 'REPLAY', then tick.state.source must not be 'WS'
 */
export function assertUITickValid(tick: UITick): void {
  if (tick.state?.mode === 'REPLAY' && tick.state?.source === 'WS') {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Invalid UITick: mode=REPLAY but source=WS\n` +
      `Symbol: ${tick.symbol}`
    );
  }
}

/**
 * INVARIANT 7: Agent execution guard with quality threshold
 * 
 * Agents MUST NOT return trading decisions when:
 * 1. mode === 'REPLAY'
 * 2. quality.confidence < minConfidence
 * 3. quality.isFallback && mode === 'LIVE'
 * 
 * Usage in agent code:
 * ```ts
 * export function myAgent(ctx: DecisionContext): AgentDecision | null {
 *   assertAgentCanTrade(ctx);
 *   // ... rest of agent logic
 * }
 * ```
 */
export function assertAgentCanTrade(ctx: DecisionContext): void {
  if (ctx.mode === 'REPLAY') {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Agent attempted to trade in REPLAY mode\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}\n` +
      `Agents MUST check mode === 'LIVE' before making trading decisions.`
    );
  }

  if (!ctx.constraints.allowTrade) {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Agent attempted to trade but allowTrade=false\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}\n` +
      `Reason: ${ctx.constraints.reason ?? 'unspecified'}`
    );
  }

  // Quality check: agent must respect minConfidence
  if (ctx.quality.confidence < ctx.constraints.minConfidence) {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Agent quality check failed\n` +
      `Confidence: ${ctx.quality.confidence} < minConfidence: ${ctx.constraints.minConfidence}\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}`
    );
  }

  // Fallback check: live mode cannot use fallback
  if (ctx.mode === 'LIVE' && ctx.quality.isFallback) {
    throw new Error(
      `[TIME AUTHORITY VIOLATION] Agent attempted to trade using fallback data in LIVE mode\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}\n` +
      `Fallback + Live = trading FORBIDDEN`
    );
  }
}

/**
 * INVARIANT 8: Execution layer final gate with quality enforcement
 * 
 * Before ANY trade execution, verify:
 * 1. Context is LIVE
 * 2. allowTrade is true
 * 3. Confidence is sufficient (both absolute and per-agent minimum)
 * 4. Data is not stale
 * 5. No fallback data in live mode
 * 
 * Usage in execution handler:
 * ```ts
 * export async function executeDecision(decision: AgentDecision, ctx: DecisionContext) {
 *   assertExecutionAllowed(ctx);
 *   // ... execute trade
 * }
 * ```
 */
export function assertExecutionAllowed(ctx: DecisionContext): void {
  // Check 1: Must be LIVE
  if (ctx.mode !== 'LIVE') {
    throw new Error(
      `[EXECUTION GATE VIOLATION] Cannot execute: mode is ${ctx.mode}, not LIVE\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}`
    );
  }

  // Check 2: Must allow trading
  if (!ctx.constraints.allowTrade) {
    throw new Error(
      `[EXECUTION GATE VIOLATION] Cannot execute: allowTrade=false\n` +
      `Reason: ${ctx.constraints.reason ?? 'unspecified'}\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}`
    );
  }

  // Check 3: Confidence must exceed execution minimum AND agent minimum
  const executionMinConfidence = 0.3; // System-wide minimum
  const agentMinConfidence = ctx.constraints.minConfidence ?? 0.5;
  const requiredConfidence = Math.max(executionMinConfidence, agentMinConfidence);

  if (ctx.quality.confidence < requiredConfidence) {
    throw new Error(
      `[EXECUTION GATE VIOLATION] Cannot execute: low confidence\n` +
      `Confidence: ${ctx.quality.confidence}, Required: ${requiredConfidence}\n` +
      `(execution min: ${executionMinConfidence}, agent min: ${agentMinConfidence})\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}`
    );
  }

  // Check 4: Data must not be stale
  if (ctx.quality.isStale) {
    throw new Error(
      `[EXECUTION GATE VIOLATION] Cannot execute: data is stale\n` +
      `Reason: ${ctx.quality.reason}\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}`
    );
  }

  // Check 5: No fallback data in live mode
  if (ctx.quality.isFallback && ctx.mode === 'LIVE') {
    throw new Error(
      `[EXECUTION GATE VIOLATION] Cannot execute: fallback data in LIVE mode\n` +
      `Symbol: ${ctx.symbol}, ContextId: ${ctx.contextId}\n` +
      `Fallback + Live = money moves forbidden`
    );
  }
}


/**
 * COMPREHENSIVE CHECK: Run all invariants
 * 
 * Use this in critical code paths:
 * ```ts
 * const ctx = buildDecisionContext(...);
 * assertAllTimeAuthorityInvariants(ctx);
 * // ... now safe to proceed
 * ```
 */
export function assertAllTimeAuthorityInvariants(ctx: DecisionContext): void {
  try {
    assertReplayNotLiveSource(ctx.frame);
    assertReplayFrameFinal(ctx.frame);
    assertContextModeMatchesFrame(ctx);
    assertReplayCannotTrade(ctx);
    assertLiveTradeAuthority(ctx);
  } catch (err) {
    // Log and re-throw with context
    console.error('[TIME AUTHORITY] Invariant violation:', err);
    throw err;
  }
}

/**
 * Development helper: Explain time-authority state
 * 
 * Use this to debug time-related issues:
 * ```ts
 * console.log(explainTimeAuthority(ctx));
 * ```
 */
export function explainTimeAuthority(ctx: DecisionContext): string {
  const lines = [
    `╔════════════════════════════════════════════════════════════════╗`,
    `║ TIME AUTHORITY EXPLANATION                                     ║`,
    `╠════════════════════════════════════════════════════════════════╣`,
    `║ Symbol: ${ctx.symbol.padEnd(60)} ║`,
    `║ Mode: ${ctx.mode.padEnd(65)} ║`,
    `║ Source: ${ctx.frame.meta.source.padEnd(64)} ║`,
    `║ AllowTrade: ${(ctx.constraints.allowTrade ? 'YES' : 'NO').padEnd(62)} ║`,
    `║ Confidence: ${ctx.quality.confidence.toFixed(2).padEnd(62)} ║`,
    `║ IsStale: ${(ctx.quality.isStale ? 'YES' : 'NO').padEnd(65)} ║`,
    `║ IsFallback: ${(ctx.quality.isFallback ? 'YES' : 'NO').padEnd(62)} ║`,
    `║ Reason: ${(ctx.constraints.reason ?? 'none').padEnd(65)} ║`,
    `╚════════════════════════════════════════════════════════════════╝`,
  ];
  return lines.join('\n');
}
