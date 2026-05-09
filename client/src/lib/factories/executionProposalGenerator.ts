/**
 * EXECUTION PROPOSAL GENERATOR
 * 
 * Where market reality is applied.
 * 
 * This stage:
 * - samples current market price (bid/ask)
 * - calculates order size based on risk limits
 * - estimates slippage impact
 * - proposes order type (limit vs market)
 * - sets expiration (TTL)
 * 
 * Key: proposal expires. Market drift invalidates it.
 * Cannot be reused. Re-computed on retry.
 * 
 * This is Stage 3 of the execution pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SignalIntent,
  RiskApproval,
  ExecutionProposal,
  EXECUTION_COMPARTMENT_CONSTANTS,
} from '../../types/ExecutionCompartments';

// ============================================================================
// MARKET SNAPSHOT (external dependency)
// ============================================================================

/**
 * MarketSnapshot
 * 
 * Current market state for a symbol.
 * Injected as dependency.
 */
export interface MarketSnapshot {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  mid?: number; // Midpoint price, calculated as (bid + ask) / 2
  volume24hUsd: number;
  volatilityPercent24h: number;
  timestamp: number;
}

// ============================================================================
// PROPOSAL GENERATION
// ============================================================================

/**
 * generateExecutionProposal
 * 
 * Create a concrete execution plan from approved intent.
 * 
 * - Samples market price
 * - Calculates size from risk limits
 * - Estimates slippage
 * - Sets TTL for proposal validity
 * 
 * Returns proposal or null if market conditions invalid.
 */
export function generateExecutionProposal(
  intent: SignalIntent,
  approval: RiskApproval,
  market: MarketSnapshot
): ExecutionProposal | null {
  // ========================================================================
  // GUARD: Approval must be approved
  // ========================================================================

  if (!approval.approved || !approval.limits) {
    return null;  // silently fail, approval already has rejection reason
  }

  // ========================================================================
  // GUARD: Market must be valid
  // ========================================================================

  if (!isValidMarketSnapshot(market)) {
    throw new Error(`Invalid market snapshot for ${market.symbol}`);
  }

  // ========================================================================
  // PRICE SELECTION
  // ========================================================================

  const price = selectPrice(intent.side, market);

  // ========================================================================
  // SIZE CALCULATION
  // ========================================================================

  const size = calculateOrderSize(
    intent,
    approval,
    price,
    market
  );

  if (size <= 0) {
    return null;  // insufficient capital or other issue
  }

  // ========================================================================
  // SLIPPAGE ESTIMATION
  // ========================================================================

  const slippageModel = EXECUTION_COMPARTMENT_CONSTANTS.SLIPPAGE_MODEL_DEFAULT;
  const slippageBps = estimateSlippage(intent.side, market, size);
  const impactUsd = (slippageBps / 10000) * (price * size);

  // ========================================================================
  // ORDER TYPE SELECTION
  // ========================================================================

  const orderType = selectOrderType(intent.signalStrength, market.volatilityPercent24h);

  // ========================================================================
  // CREATE PROPOSAL
  // ========================================================================

  const proposal: ExecutionProposal = {
    intentId: intent.id,
    approvalId: approval.intentId,  // link back to approval
    proposedAt: Date.now(),
    ttlMs: EXECUTION_COMPARTMENT_CONSTANTS.DEFAULT_TTL_MS,

    exchange: 'binance',  // TODO: make configurable
    symbol: intent.symbol,
    side: intent.side,
    orderType,
    price,
    size,

    slippageModel,
    estimatedSlippageBps: slippageBps,
    estimatedImpactUsd: impactUsd,

    timeInForce: orderType === 'limit' ? 'GTC' : 'IOC',
    postOnly: orderType === 'limit',

    marketCondition: {
      bidAsk: ((market.ask - market.bid) / ((market.bid + market.ask) / 2)) * 10000,
      volatilityPercent24h: market.volatilityPercent24h,
    },
  };

  return proposal;
}

/**
 * generateProposalBatch
 * 
 * Generate proposals for multiple intents.
 */
export function generateProposalBatch(
  intents: Array<{ intent: SignalIntent; approval: RiskApproval }>,
  markets: Map<string, MarketSnapshot>
): Array<{ intent: SignalIntent; proposal: ExecutionProposal | null }> {
  return intents.map(({ intent, approval }) => {
    const market = markets.get(intent.symbol);
    if (!market) {
      return { intent, proposal: null };
    }
    const proposal = generateExecutionProposal(intent, approval, market);
    return { intent, proposal };
  });
}

// ============================================================================
// PROPOSAL HELPERS
// ============================================================================

/**
 * isValidMarketSnapshot
 * 
 * Ensure market data is fresh and consistent.
 */
function isValidMarketSnapshot(market: MarketSnapshot): boolean {
  // Bid-ask consistency
  if (market.bid >= market.ask) {
    return false;
  }

  // Prices are positive
  if (market.bid <= 0 || market.ask <= 0) {
    return false;
  }

  // Freshness (within 5 seconds)
  if (Date.now() - market.timestamp > 5000) {
    return false;
  }

  return true;
}

/**
 * selectPrice
 * 
 * Choose between bid/ask based on side.
 * Buy at ask (pay asking price).
 * Sell at bid (receive bidding price).
 */
function selectPrice(side: 'buy' | 'sell', market: MarketSnapshot): number {
  return side === 'buy' ? market.ask : market.bid;
}

/**
 * calculateOrderSize
 * 
 * Determine quantity based on:
 * - Available capital
 * - Risk approval limits
 * - Market impact
 * - Position limits
 */
function calculateOrderSize(
  intent: SignalIntent,
  approval: RiskApproval,
  price: number,
  market: MarketSnapshot
): number {
  if (!approval.limits) {
    return 0;
  }

  // Max notional from risk approval
  const maxNotional = approval.limits.maxUsd;

  // Size = notional / price
  let size = maxNotional / price;

  // Round down to reasonable precision (0.01 units)
  size = Math.floor(size * 100) / 100;

  return size;
}

/**
 * estimateSlippage
 * 
 * Estimate slippage in basis points.
 * Depends on side, spread, and order size.
 */
function estimateSlippage(
  side: 'buy' | 'sell',
  market: MarketSnapshot,
  size: number
): number {
  // Base: half-spread
  const mid = (market.bid + market.ask) / 2;
  const halfSpreadBps = ((market.ask - market.bid) / mid * 10000) / 2;

  // Adjustment for size (larger orders have more impact)
  const sizeImpactBps = Math.min(
    50,  // cap at 50bps
    (size / 1000) * 10  // rough estimate
  );

  // Adjustment for volatility (more volatile = higher slippage)
  const volAdjustmentBps = (market.volatilityPercent24h / 100) * 10;

  return halfSpreadBps + sizeImpactBps + volAdjustmentBps;
}

/**
 * selectOrderType
 * 
 * Choose between limit and market.
 * Strong signals + calm market → limit (patient)
 * Weak signals or volatile market → market (urgent)
 */
function selectOrderType(
  signalStrength: number,
  volatilityPercent24h: number
): 'limit' | 'market' {
  const isStrongSignal = signalStrength > 0.7;
  const isCalm = volatilityPercent24h < 5;

  if (isStrongSignal && isCalm) {
    return 'limit';
  }

  return 'market';
}

// ============================================================================
// PROPOSAL VALIDATION
// ============================================================================

/**
 * isProposalExpired
 * 
 * Check if proposal validity window has passed.
 */
export function isProposalExpired(proposal: ExecutionProposal): boolean {
  const age = Date.now() - proposal.proposedAt;
  return age > proposal.ttlMs;
}

/**
 * isProposalStaleForMarket
 * 
 * Check if market has moved significantly since proposal.
 * If price moved >50bps, consider stale.
 */
export function isProposalStaleForMarket(
  proposal: ExecutionProposal,
  currentMarket: MarketSnapshot
): boolean {
  const currentPrice = proposal.side === 'buy'
    ? currentMarket.ask
    : currentMarket.bid;

  const priceMovePercent = Math.abs(
    (currentPrice - proposal.price) / proposal.price
  ) * 100;

  // Stale if price moved >50bps
  return priceMovePercent > 0.5;
}

/**
 * canRecomputeProposal
 * 
 * Check if proposal should be recomputed.
 * Recompute if expired or market stale.
 */
export function canRecomputeProposal(
  proposal: ExecutionProposal,
  currentMarket: MarketSnapshot
): boolean {
  return (
    isProposalExpired(proposal) ||
    isProposalStaleForMarket(proposal, currentMarket)
  );
}

// ============================================================================
// PROPOSAL INSPECTION
// ============================================================================

/**
 * explainProposal
 * 
 * Human-readable proposal explanation.
 */
export function explainProposal(proposal: ExecutionProposal): string {
  const expiresIn = Math.max(
    0,
    proposal.ttlMs - (Date.now() - proposal.proposedAt)
  );

  return (
    `ExecutionProposal\n` +
    `  Symbol: ${proposal.symbol}\n` +
    `  Side: ${proposal.side.toUpperCase()}\n` +
    `  Order Type: ${proposal.orderType}\n` +
    `  Price: $${proposal.price.toFixed(8)}\n` +
    `  Size: ${proposal.size.toFixed(8)}\n` +
    `  Notional: $${(proposal.price * proposal.size).toFixed(2)}\n` +
    `  Estimated Impact: $${proposal.estimatedImpactUsd.toFixed(2)} (${proposal.estimatedSlippageBps.toFixed(1)}bps)\n` +
    `  Expires in: ${expiresIn}ms\n` +
    `  Market Condition: ${proposal.marketCondition.bidAsk.toFixed(1)}bps spread, ${proposal.marketCondition.volatilityPercent24h.toFixed(1)}% vol`
  );
}

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

/**
 * Extend MarketSnapshot with computed fields.
 */
declare global {
  interface MarketSnapshot {
    mid?: number;
  }
}

// Ensure MarketSnapshot has mid price
export function enrichMarketSnapshot(market: MarketSnapshot): MarketSnapshot {
  return {
    ...market,
    mid: (market.bid + market.ask) / 2,
  } as any;
}
