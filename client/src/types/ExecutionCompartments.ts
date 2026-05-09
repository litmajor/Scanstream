/**
 * EXECUTION COMPARTMENTS
 * 
 * Four-stage execution pipeline breaking the singularity:
 * 1. SignalIntent — what the agent wants (pure desire)
 * 2. RiskApproval — am I allowed? (strict veto)
 * 3. ExecutionProposal — how exactly? (concrete plan)
 * 4. OrderCommit — do it now (final, irreversible)
 * 
 * Each stage:
 * - has strict input/output
 * - can veto downstream
 * - is logged for forensics
 * - is replayable
 * - cannot mutate upstream state
 * 
 * Core principle:
 * > Money should only move after surviving multiple independent vetoes.
 */

import { UUID } from './Common.js';

// ============================================================================
// STAGE 1: SignalIntent — Pure, Immutable
// ============================================================================

/**
 * SignalIntent
 * 
 * Created by agents only. Represents the desire to trade, not the action.
 * 
 * Properties:
 * - NO price (market hasn't been sampled yet)
 * - NO size (risk hasn't approved)
 * - NO exchange (execution hasn't been proposed)
 * - NO slippage assumptions
 * 
 * Only moves forward if risk approves.
 * Never generated in REPLAY mode.
 */
export interface SignalIntent {
  // Identity
  id: UUID;
  ts: number;  // when intent was created
  
  // What I want
  symbol: string;
  side: 'buy' | 'sell';
  rationale: string;  // why the agent wants this
  
  // How much conviction
  signalStrength: number;  // 0..1, from signal processor
  confidence: number;      // 0..1, quality of decision
  
  // Execution context
  mode: 'LIVE';  // REPLAY never creates intents (this is hard-coded)
  agentId: string;
  
  // Optional context
  timeframe?: string;
  
  // Immutability marker
  __frozen: true;
}

// ============================================================================
// STAGE 2: RiskApproval — Authority Filter
// ============================================================================

/**
 * RiskApproval
 * 
 * Where most signals die. That's the job.
 * 
 * This stage checks:
 * - confidence thresholds
 * - exposure (notional USD)
 * - drawdown state
 * - replay/live mode
 * - kill switches
 * - cooldown (rate limiting)
 * 
 * Risk NEVER prices.
 * Risk NEVER executes.
 * Risk ONLY vetoes.
 */
export interface RiskApproval {
  // Backref
  intentId: UUID;
  
  // The decision
  approved: boolean;
  reason?: string;  // if rejected, why
  
  // If approved, what are the limits?
  limits?: {
    maxUsd: number;           // max notional exposure
    maxLeverage: number;      // max 1x, 2x, etc
    cooldownMs?: number;      // min time until next signal from same agent
    maxDrawdownPercent?: number;  // reject if underwater > this %
  };
  
  // Audit trail
  riskScore: number;  // 0..1, internal risk assessment
  checks: {
    timeAuthorityPassed: boolean;
    confidenceThresholdPassed: boolean;
    exposureWithinLimits: boolean;
    drawdownAcceptable: boolean;
    rateLimited: boolean;
  };
}

// ============================================================================
// STAGE 3: ExecutionProposal — Concrete Plan
// ============================================================================

/**
 * ExecutionProposal
 * 
 * Where market reality is applied.
 * 
 * This stage:
 * - samples current market price
 * - calculates order size based on risk limits
 * - estimates slippage impact
 * - proposes order type (limit vs market)
 * - sets expiration (TTL)
 * 
 * Key: proposal expires. Market drift invalidates it.
 * Cannot be reused. Re-computed on retry.
 */
export interface ExecutionProposal {
  // Backref
  intentId: UUID;
  approvalId: UUID;
  
  // Market snapshot at proposal time
  proposedAt: number;
  ttlMs: number;  // proposal validity window
  
  // Concrete order spec
  exchange: 'binance' | 'kraken' | 'coinbase';
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  price: number;      // market price or limit price
  size: number;       // quantity to trade
  
  // Market context at proposal time
  slippageModel: string;  // 'fixed_bps' | 'linear' | 'impact'
  estimatedSlippageBps: number;
  estimatedImpactUsd: number;
  
  // Order parameters
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?: boolean;
  
  // Audit trail
  marketCondition: {
    bidAsk: number;      // bid-ask spread in bps
    volatilityPercent24h: number;
  };
}

// ============================================================================
// STAGE 4: OrderCommit — Final, Irreversible
// ============================================================================

/**
 * OrderCommit
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
 */
export interface OrderCommit {
  // Backref
  proposalId: UUID;
  
  // Commitment
  committedAt: number;
  status: 'submitted' | 'rejected' | 'filled' | 'partial' | 'failed';
  
  // Exchange response
  exchangeOrderId?: string;
  exchangeResponse?: Record<string, any>;
  
  // Fill info (once filled)
  filledSize?: number;
  filledPrice?: number;
  filledAt?: number;
  
  // Error (if failed)
  error?: {
    code: string;
    message: string;
  };
  
  // Immutability marker
  __readonly: true;
}

// ============================================================================
// EXECUTION FLOW
// ============================================================================

/**
 * ExecutionFlow
 * 
 * Complete record of an execution from intent to commit.
 * Everything is immutable and logged.
 * 
 * This is what forensics queries.
 */
export interface ExecutionFlow {
  id: UUID;
  createdAt: number;
  
  intent: SignalIntent;
  approval: RiskApproval;
  proposal?: ExecutionProposal;
  commit?: OrderCommit;
  
  // Status
  stage: 'intent' | 'approved' | 'proposed' | 'committed' | 'rejected';
  rejectedAt?: number;
  rejectionReason?: string;
  
  // Timing
  durationMs: number;  // from intent to final state
}

// ============================================================================
// EXECUTION QUERY RESULT (for forensics)
// ============================================================================

/**
 * ExecutionEvent
 * 
 * A single execution event for querying/reconstruction.
 * Used to answer: "How did this trade happen?"
 */
export interface ExecutionEvent {
  executionId: UUID;
  ts: number;
  
  symbol: string;
  side: 'buy' | 'sell';
  
  // Which stage did it reach?
  finalStage: 'intent' | 'approved' | 'proposed' | 'committed';
  
  // If committed, the order details
  orderDetails?: {
    exchangeOrderId: string;
    size: number;
    price: number;
    filledSize?: number;
  };
  
  // If rejected, why?
  rejectionReason?: string;
  
  // Forensic trail
  intentRationale: string;
  approvalReason: string;
  agentId: string;
}

// ============================================================================
// SIGNAL INTENT FACTORY INPUT
// ============================================================================

/**
 * AgentSignalSource
 * 
 * What an agent provides to create a SignalIntent.
 * Minimal, validation happens in factory.
 */
export interface AgentSignalSource {
  symbol: string;
  side: 'buy' | 'sell';
  rationale: string;
  signalStrength: number;  // 0..1
  confidence: number;       // 0..1
  agentId: string;
  timeframe?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSignalIntent(obj: any): obj is SignalIntent {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.__frozen === true &&
    typeof obj.id === 'string' &&
    typeof obj.ts === 'number' &&
    typeof obj.mode === 'string' &&
    obj.mode === 'LIVE'
  );
}

export function isRiskApproval(obj: any): obj is RiskApproval {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.intentId === 'string' &&
    typeof obj.approved === 'boolean'
  );
}

export function isExecutionProposal(obj: any): obj is ExecutionProposal {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.intentId === 'string' &&
    typeof obj.approvalId === 'string' &&
    typeof obj.price === 'number' &&
    typeof obj.size === 'number'
  );
}

export function isOrderCommit(obj: any): obj is OrderCommit {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.__readonly === true &&
    typeof obj.proposalId === 'string' &&
    typeof obj.status === 'string'
  );
}

export function isExecutionFlow(obj: any): obj is ExecutionFlow {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.stage === 'string' &&
    isSignalIntent(obj.intent) &&
    isRiskApproval(obj.approval)
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const EXECUTION_COMPARTMENT_CONSTANTS = {
  // SignalIntent
  SIGNAL_INTENT_DEFAULT_TIMEFRAME: '1h',
  
  // RiskApproval
  MIN_APPROVAL_CONFIDENCE: 0.5,
  DEFAULT_MAX_USD_PER_SIGNAL: 5000,
  DEFAULT_MAX_LEVERAGE: 1,
  DEFAULT_COOLDOWN_MS: 5000,  // 5 seconds between signals from same agent
  MAX_DRAWDOWN_PERCENT: 25,
  
  // ExecutionProposal
  DEFAULT_TTL_MS: 30000,  // 30 seconds — proposal validity window
  SLIPPAGE_MODEL_DEFAULT: 'fixed_bps',
  
  // OrderCommit
  COMMIT_TIMEOUT_MS: 5000,  // how long to wait for exchange response
};
