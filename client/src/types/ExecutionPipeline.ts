/**
 * Execution Pipeline Types
 * 
 * Execution is not a single action — it's a process with checkpoints.
 * 
 * Four compartments, each with strict inputs/outputs:
 * 1. SignalIntent — Pure desire (from agents only)
 * 2. RiskApproval — Authority filter (rejects or approves with limits)
 * 3. ExecutionProposal — Concrete market plan (prices, size, timing)
 * 4. OrderCommit — Final, irreversible (touches exchange APIs)
 * 
 * Each stage can veto downstream. Nothing bypasses the chain.
 */

/**
 * STAGE 1: SignalIntent
 * 
 * Created only by agents. Pure desire, no pricing, no commitment.
 * 
 * Properties:
 * ❌ no price
 * ❌ no size
 * ❌ no exchange
 * ❌ no slippage assumptions
 */
export interface SignalIntent {
  /** Unique ID for this intent (for tracing) */
  id: string;

  /** Timestamp when agent created this intent */
  ts: number;

  /** Which symbol */
  symbol: string;

  /** Buy or sell */
  side: 'BUY' | 'SELL';

  /** Why the agent wants this (human-readable) */
  rationale: string;

  /** How strong is this signal (0–1) */
  signalStrength: number;

  /** Agent's confidence in this signal (0–1) */
  confidence: number;

  /** CRITICAL: Must be LIVE (replay never creates intents) */
  mode: 'LIVE' | 'REPLAY';

  /** Which agent created this */
  agentId: string;

  /** Context ID for audit trail */
  contextId: string;

  /** Extra metadata for analysis */
  [key: string]: any;
}

/**
 * Type guard for SignalIntent
 */
export function isSignalIntent(obj: any): obj is SignalIntent {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.ts === 'number' &&
    typeof obj.symbol === 'string' &&
    (obj.side === 'BUY' || obj.side === 'SELL') &&
    typeof obj.rationale === 'string' &&
    typeof obj.signalStrength === 'number' &&
    typeof obj.confidence === 'number' &&
    (obj.mode === 'LIVE' || obj.mode === 'REPLAY') &&
    typeof obj.agentId === 'string'
  );
}

/**
 * Assert that obj is a valid SignalIntent
 */
export function assertSignalIntent(obj: any): asserts obj is SignalIntent {
  if (!isSignalIntent(obj)) {
    throw new Error(
      `Invalid SignalIntent: ${JSON.stringify(obj)}`
    );
  }
}

/**
 * STAGE 2: RiskApproval
 * 
 * Authority filter. This is where most signals die.
 * 
 * Purpose:
 * ✅ Check confidence thresholds
 * ✅ Check exposure limits
 * ✅ Check drawdown state
 * ✅ Check mode (block replay)
 * ✅ Check kill switches
 * 
 * ❌ Does NOT price
 * ❌ Does NOT execute
 * ❌ Does NOT access market data
 */
export interface RiskApproval {
  /** Which intent is this approving? */
  intentId: string;

  /** Approved or rejected? */
  approved: boolean;

  /** Why (if rejected) */
  reason?: string;

  /** If approved, what are the limits? */
  limits?: {
    /** Maximum USD size for this trade */
    maxUsd: number;

    /** Maximum leverage (1.0 = no leverage) */
    maxLeverage: number;

    /** Cooldown before next trade (optional) */
    cooldownMs?: number;
  };

  /** Risk score (0–1, higher = riskier, harder to approve) */
  riskScore: number;

  /** When was this decision made */
  ts: number;

  /** Who/what approved this (system name) */
  approver: string;

  /** Audit metadata */
  [key: string]: any;
}

/**
 * Type guard for RiskApproval
 */
export function isRiskApproval(obj: any): obj is RiskApproval {
  return (
    obj &&
    typeof obj.intentId === 'string' &&
    typeof obj.approved === 'boolean' &&
    typeof obj.riskScore === 'number' &&
    typeof obj.ts === 'number' &&
    typeof obj.approver === 'string'
  );
}

/**
 * Assert that obj is a valid RiskApproval
 */
export function assertRiskApproval(obj: any): asserts obj is RiskApproval {
  if (!isRiskApproval(obj)) {
    throw new Error(
      `Invalid RiskApproval: ${JSON.stringify(obj)}`
    );
  }
}

/**
 * STAGE 3: ExecutionProposal
 * 
 * Concrete market plan. Where pricing and market reality are applied.
 * 
 * Properties:
 * ✅ Specific price
 * ✅ Specific size
 * ✅ TTL (expires quickly)
 * ✅ Cannot be reused
 * ✅ Recomputed on retry
 */
export interface ExecutionProposal {
  /** Which intent and approval is this for? */
  intentId: string;
  approvalId: string;

  /** Unique proposal ID */
  id: string;

  /** Exchange to use */
  exchange: string;

  /** Symbol */
  symbol: string;

  /** Buy or sell */
  side: 'BUY' | 'SELL';

  /** Order type */
  orderType: 'limit' | 'market';

  /** Price (for limit orders) */
  price: number;

  /** Size in base currency */
  size: number;

  /** Size in quote currency (USD) */
  sizeUsd: number;

  /** Which slippage model was used */
  slippageModel: string;

  /** Estimated market impact (%) */
  estimatedImpact: number;

  /** Time to live (ms) — proposal expires after this */
  ttlMs: number;

  /** When was this proposal created */
  ts: number;

  /** Audit metadata */
  [key: string]: any;
}

/**
 * Type guard for ExecutionProposal
 */
export function isExecutionProposal(obj: any): obj is ExecutionProposal {
  return (
    obj &&
    typeof obj.intentId === 'string' &&
    typeof obj.id === 'string' &&
    typeof obj.exchange === 'string' &&
    typeof obj.symbol === 'string' &&
    (obj.side === 'BUY' || obj.side === 'SELL') &&
    (obj.orderType === 'limit' || obj.orderType === 'market') &&
    typeof obj.price === 'number' &&
    typeof obj.size === 'number' &&
    typeof obj.ts === 'number'
  );
}

/**
 * Assert that obj is a valid ExecutionProposal
 */
export function assertExecutionProposal(obj: any): asserts obj is ExecutionProposal {
  if (!isExecutionProposal(obj)) {
    throw new Error(
      `Invalid ExecutionProposal: ${JSON.stringify(obj)}`
    );
  }
}

/**
 * Check if proposal has expired
 */
export function isProposalExpired(proposal: ExecutionProposal): boolean {
  const age = Date.now() - proposal.ts;
  return age > proposal.ttlMs;
}

/**
 * STAGE 4: OrderCommit
 * 
 * Final, irreversible. Only this stage talks to CCXT.
 * 
 * Guards:
 * ✅ mode === 'LIVE'
 * ✅ riskApproval.approved === true
 * ✅ now - proposal.ts < ttlMs
 * 
 * No proposal → no order.
 */
export interface OrderCommit {
  /** Which proposal created this order? */
  proposalId: string;

  /** Unique commit ID */
  id: string;

  /** When did we commit */
  committedAt: number;

  /** Exchange-issued order ID (if filled) */
  exchangeOrderId?: string;

  /** Current status */
  status: 'submitted' | 'rejected' | 'filled' | 'canceled';

  /** Why was it rejected (if rejected) */
  rejectionReason?: string;

  /** Filled price (if filled) */
  filledPrice?: number;

  /** Filled size (if filled) */
  filledSize?: number;

  /** Audit metadata */
  [key: string]: any;
}

/**
 * Type guard for OrderCommit
 */
export function isOrderCommit(obj: any): obj is OrderCommit {
  return (
    obj &&
    typeof obj.proposalId === 'string' &&
    typeof obj.id === 'string' &&
    typeof obj.committedAt === 'number' &&
    (obj.status === 'submitted' ||
      obj.status === 'rejected' ||
      obj.status === 'filled' ||
      obj.status === 'canceled')
  );
}

/**
 * Assert that obj is a valid OrderCommit
 */
export function assertOrderCommit(obj: any): asserts obj is OrderCommit {
  if (!isOrderCommit(obj)) {
    throw new Error(
      `Invalid OrderCommit: ${JSON.stringify(obj)}`
    );
  }
}

/**
 * Execution Chain — immutable record of entire flow
 */
export interface ExecutionChain {
  /** Unique ID for this execution attempt */
  chainId: string;

  /** All stages in order */
  intent: SignalIntent;
  approval?: RiskApproval;
  proposal?: ExecutionProposal;
  commit?: OrderCommit;

  /** Timeline */
  createdAt: number;
  completedAt?: number;

  /** Final status */
  status: 'pending' | 'approved' | 'proposed' | 'executed' | 'rejected' | 'canceled';

  /** Audit trail */
  audit: Array<{
    stage: string;
    ts: number;
    result: string;
  }>;
}

/**
 * Export execution chain for analysis
 */
export function exportExecutionChainForAnalysis(chain: ExecutionChain): Record<string, any> {
  return {
    chainId: chain.chainId,
    status: chain.status,
    symbol: chain.intent.symbol,
    side: chain.intent.side,
    
    intent: {
      agentId: chain.intent.agentId,
      confidence: chain.intent.confidence,
      signalStrength: chain.intent.signalStrength,
    },
    
    approval: chain.approval ? {
      approved: chain.approval.approved,
      reason: chain.approval.reason,
      riskScore: chain.approval.riskScore,
      maxUsd: chain.approval.limits?.maxUsd,
    } : null,
    
    proposal: chain.proposal ? {
      price: chain.proposal.price,
      size: chain.proposal.size,
      sizeUsd: chain.proposal.sizeUsd,
      ttlMs: chain.proposal.ttlMs,
    } : null,
    
    commit: chain.commit ? {
      status: chain.commit.status,
      exchangeOrderId: chain.commit.exchangeOrderId,
      filledPrice: chain.commit.filledPrice,
      filledSize: chain.commit.filledSize,
    } : null,
    
    timeline: {
      createdAt: new Date(chain.createdAt).toISOString(),
      completedAt: chain.completedAt ? new Date(chain.completedAt).toISOString() : null,
    },
    
    audit: chain.audit,
  };
}
