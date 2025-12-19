/**
 * ORDER COMMIT FINALIZER
 * 
 * Only this stage talks to CCXT.
 * Only this stage creates real orders.
 * 
 * Guards before commit:
 * - assert mode === 'LIVE'
 * - assert approval.approved === true
 * - assert now - proposal.ts < proposal.ttlMs
 * 
 * If any guard fails, no order is created.
 * 
 * This is Stage 4 of the execution pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ExecutionProposal,
  OrderCommit,
  RiskApproval,
} from '../types/ExecutionCompartments';
import { DecisionContext } from '../types/DecisionContext';
import {
  assertExecutionAllowed,
} from './timeAuthorityInvariants';

// ============================================================================
// EXCHANGE INTERFACE (dependency)
// ============================================================================

/**
 * ExchangeAdapter
 * 
 * Abstraction over CCXT for placing orders.
 * Injected as dependency.
 */
export interface ExchangeAdapter {
  /**
   * placeOrder
   * 
   * Place an order on the exchange.
   * Returns exchange order ID or throws.
   */
  placeOrder(spec: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    amount: number;
    price?: number;
    timeInForce?: string;
    postOnly?: boolean;
  }): Promise<{
    id: string;
    status: string;
    [key: string]: any;
  }>;
}

// ============================================================================
// ORDER COMMITMENT
// ============================================================================

/**
 * commitOrder
 * 
 * Final execution gate.
 * 
 * Steps:
 * 1. Validate proposal is not expired
 * 2. Assert all time authority checks pass
 * 3. Assert risk approval was granted
 * 4. Call exchange to place order
 * 5. Log commitment
 * 
 * If ANY guard fails, throws immediately. No order is placed.
 */
export async function commitOrder(
  proposal: ExecutionProposal,
  approval: RiskApproval,
  ctx: DecisionContext,
  exchange: ExchangeAdapter
): Promise<OrderCommit> {
  // ========================================================================
  // GUARD 1: Proposal must be valid
  // ========================================================================

  if (!approval.approved) {
    throw new Error(
      `Cannot commit order: risk approval was rejected. Reason: ${approval.reason}`
    );
  }

  // ========================================================================
  // GUARD 2: Proposal must not be expired
  // ========================================================================

  const age = Date.now() - proposal.proposedAt;
  if (age > proposal.ttlMs) {
    throw new Error(
      `Proposal expired. Age ${age}ms > TTL ${proposal.ttlMs}ms. ` +
      'Recompute and retry.'
    );
  }

  // ========================================================================
  // GUARD 3: Time Authority (comprehensive)
  // ========================================================================
  // This checks:
  // - mode === 'LIVE'
  // - allowTrade === true
  // - confidence > MIN
  // - data not stale
  // Throws immediately on violation.

  try {
    assertExecutionAllowed(ctx);
  } catch (e: any) {
    throw new Error(`Time authority assertion failed: ${e.message}`);
  }

  // ========================================================================
  // CALL EXCHANGE
  // ========================================================================

  let exchangeResponse: any;
  let exchangeOrderId: string | undefined;

  try {
    exchangeResponse = await exchange.placeOrder({
      symbol: proposal.symbol,
      side: proposal.side,
      type: proposal.orderType,
      amount: proposal.size,
      price: proposal.orderType === 'limit' ? proposal.price : undefined,
      timeInForce: proposal.timeInForce,
      postOnly: proposal.postOnly,
    });

    exchangeOrderId = exchangeResponse.id;
  } catch (e: any) {
    // Exchange rejected order, log it but don't throw yet
    return {
      proposalId: proposal.intentId,
      committedAt: Date.now(),
      status: 'rejected',
      error: {
        code: e.code || 'UNKNOWN',
        message: e.message,
      },
    } as OrderCommit;
  }

  // ========================================================================
  // LOG COMMITMENT
  // ========================================================================

  const commit: OrderCommit = Object.freeze({
    proposalId: proposal.intentId,
    committedAt: Date.now(),
    exchangeOrderId,
    exchangeResponse,
    status: 'submitted',
  }) as OrderCommit;

  return commit;
}

/**
 * commitOrderBatch
 * 
 * Commit multiple orders.
 * Stops on first error.
 */
export async function commitOrderBatch(
  proposals: ExecutionProposal[],
  approvals: RiskApproval[],
  ctx: DecisionContext,
  exchange: ExchangeAdapter
): Promise<OrderCommit[]> {
  const commits: OrderCommit[] = [];

  for (let i = 0; i < proposals.length; i++) {
    const commit = await commitOrder(
      proposals[i],
      approvals[i],
      ctx,
      exchange
    );
    commits.push(commit);
  }

  return commits;
}

// ============================================================================
// COMMIT VALIDATION
// ============================================================================

/**
 * wasOrderCommitted
 * 
 * Check if commit resulted in an actual order.
 */
export function wasOrderCommitted(commit: OrderCommit): boolean {
  return commit.status === 'submitted' && !!commit.exchangeOrderId;
}

/**
 * wasOrderRejected
 * 
 * Check if exchange rejected the order.
 */
export function wasOrderRejected(commit: OrderCommit): boolean {
  return commit.status === 'rejected' && !!commit.error;
}

/**
 * explainCommit
 * 
 * Human-readable commit explanation.
 */
export function explainCommit(commit: OrderCommit): string {
  if (commit.status === 'rejected') {
    return (
      `❌ ORDER REJECTED\n` +
      `Error: ${commit.error?.code} - ${commit.error?.message}`
    );
  }

  if (commit.status === 'submitted') {
    return (
      `✅ ORDER SUBMITTED\n` +
      `Exchange Order ID: ${commit.exchangeOrderId}\n` +
      `Committed at: ${new Date(commit.committedAt).toISOString()}`
    );
  }

  return `Order status: ${commit.status}`;
}

// ============================================================================
// COMMIT GUARDS (for testing/replay)
// ============================================================================

/**
 * assertCanCommit
 * 
 * Check all preconditions for commit without actually committing.
 */
export function assertCanCommit(
  proposal: ExecutionProposal,
  approval: RiskApproval,
  ctx: DecisionContext
): void {
  // Proposal valid?
  if (!approval.approved) {
    throw new Error('Risk approval not granted');
  }

  // Not expired?
  const age = Date.now() - proposal.proposedAt;
  if (age > proposal.ttlMs) {
    throw new Error(`Proposal expired (${age}ms > ${proposal.ttlMs}ms)`);
  }

  // Time authority?
  try {
    assertExecutionAllowed(ctx);
  } catch (e: any) {
    throw new Error(`Time authority check failed: ${e.message}`);
  }
}

/**
 * dryRunCommit
 * 
 * Verify commit would succeed without actually calling exchange.
 */
export function dryRunCommit(
  proposal: ExecutionProposal,
  approval: RiskApproval,
  ctx: DecisionContext
): boolean {
  try {
    assertCanCommit(proposal, approval, ctx);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// REPLAY PROTECTION
// ============================================================================

/**
 * commitOrderReplayProtected
 * 
 * Commit order with explicit replay protection.
 * Throws if context is REPLAY mode.
 */
export async function commitOrderReplayProtected(
  proposal: ExecutionProposal,
  approval: RiskApproval,
  ctx: DecisionContext,
  exchange: ExchangeAdapter
): Promise<OrderCommit> {
  // Hard check: never commit in replay
  if (ctx.mode === 'REPLAY') {
    throw new Error(
      'FATAL: Cannot commit order in REPLAY mode. This is a critical safety violation.'
    );
  }

  return commitOrder(proposal, approval, ctx, exchange);
}
