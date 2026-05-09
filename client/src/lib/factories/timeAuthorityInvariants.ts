/**
 * TIME AUTHORITY INVARIANTS
 * 
 * Guards to ensure execution only happens when it's allowed.
 * - REPLAY mode: no real markets, no trades
 * - LIVE mode: all systems go
 */

import { DecisionContext } from '../../types/DecisionContext';

export interface TimeAuthorityError extends Error {
  code: 'REPLAY_CANNOT_TRADE' | 'NOT_IN_LIVE_MODE' | 'EXECUTION_EXPIRED';
}

/**
 * assertExecutionAllowed
 * 
 * Throws if execution is not allowed in the current mode.
 */
export function assertExecutionAllowed(ctx: DecisionContext): void {
  if (ctx.mode !== 'LIVE') {
    const err = new Error(`Execution not allowed in ${ctx.mode} mode`) as TimeAuthorityError;
    err.code = 'NOT_IN_LIVE_MODE';
    throw err;
  }
}

/**
 * assertReplayCannotTrade
 * 
 * Throws if we're in REPLAY mode (no real trading).
 */
export function assertReplayCannotTrade(ctx: DecisionContext): void {
  if (ctx.mode === 'REPLAY') {
    const err = new Error('Cannot trade in REPLAY mode') as TimeAuthorityError;
    err.code = 'REPLAY_CANNOT_TRADE';
    throw err;
  }
}

/**
 * isExecutionAllowed
 * 
 * Returns true if execution is allowed.
 */
export function isExecutionAllowed(ctx: DecisionContext): boolean {
  return ctx.mode === 'LIVE';
}
