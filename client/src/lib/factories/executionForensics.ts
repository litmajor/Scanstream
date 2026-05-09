/**
 * EXECUTION FORENSICS
 * 
 * Query and reconstruct trade events for post-mortem analysis.
 * 
 * Answer: "How did this trade happen?"
 * 
 * Key insight: With compartmentalization, reconstruction is a simple walk
 * through the four stages. Every gate is logged. No guessing required.
 */

import {
  ExecutionFlow,
  ExecutionEvent,
  SignalIntent,
  RiskApproval,
  ExecutionProposal,
  OrderCommit,
} from '../../types/ExecutionCompartments';

// ============================================================================
// EXECUTION EVENT RECONSTRUCTION
// ============================================================================

/**
 * reconstructExecutionEvent
 * 
 * Convert ExecutionFlow into ExecutionEvent (forensic record).
 */
export function reconstructExecutionEvent(
  flow: ExecutionFlow
): ExecutionEvent {
  // Map flow.stage to valid ExecutionEvent finalStage values
  let finalStage: 'intent' | 'approved' | 'proposed' | 'committed' = 'intent';
  if (flow.stage === 'rejected') {
    finalStage = 'intent'; // Rejected means it never progressed past intent
  } else if (flow.stage === 'approved' || flow.stage === 'proposed' || flow.stage === 'committed') {
    finalStage = flow.stage as any;
  }

  const event: ExecutionEvent = {
    executionId: flow.id,
    ts: flow.createdAt,
    symbol: flow.intent.symbol,
    side: flow.intent.side,
    finalStage,
    rejectionReason: flow.rejectionReason,
    intentRationale: flow.intent.rationale,
    approvalReason: flow.approval?.reason || 'N/A',
    agentId: flow.intent.agentId,
  };

  if (flow.commit && flow.commit.exchangeOrderId) {
    event.orderDetails = {
      exchangeOrderId: flow.commit.exchangeOrderId,
      size: flow.proposal?.size || 0,
      price: flow.proposal?.price || 0,
      filledSize: flow.commit.filledSize,
    };
  }

  return event;
}

/**
 * reconstructExecutionEventBatch
 * 
 * Batch reconstruction.
 */
export function reconstructExecutionEventBatch(
  flows: ExecutionFlow[]
): ExecutionEvent[] {
  return flows.map(reconstructExecutionEvent);
}

// ============================================================================
// EXECUTION QUERIES
// ============================================================================

/**
 * queryExecutionChain
 * 
 * Trace complete execution chain: intent → approval → proposal → commit
 */
export function queryExecutionChain(flow: ExecutionFlow): {
  intent: IntentSnapshot;
  approval: ApprovalSnapshot;
  proposal: ProposalSnapshot | null;
  commit: CommitSnapshot | null;
} {
  return {
    intent: snapshotIntent(flow.intent),
    approval: snapshotApproval(flow.approval),
    proposal: flow.proposal ? snapshotProposal(flow.proposal) : null,
    commit: flow.commit ? snapshotCommit(flow.commit) : null,
  };
}

/**
 * queryRejectionPath
 * 
 * If execution was rejected, show the exact gate that rejected it.
 */
export function queryRejectionPath(flow: ExecutionFlow): {
  rejected: boolean;
  rejectedAt: string;
  rejectedBy: 'intent_creation' | 'risk_approval' | 'proposal_generation' | 'order_commit';
  reason: string;
} | null {
  if (flow.stage === 'committed') {
    return null;  // not rejected
  }

  let rejectedBy: 'intent_creation' | 'risk_approval' | 'proposal_generation' | 'order_commit';

  if (!flow.intent) {
    rejectedBy = 'intent_creation';
  } else if (!flow.approval?.approved) {
    rejectedBy = 'risk_approval';
  } else if (!flow.proposal) {
    rejectedBy = 'proposal_generation';
  } else {
    rejectedBy = 'order_commit';
  }

  return {
    rejected: true,
    rejectedAt: new Date(flow.rejectedAt || Date.now()).toISOString(),
    rejectedBy,
    reason: flow.rejectionReason || 'Unknown',
  };
}

/**
 * queryLossNarrative
 * 
 * For rejected orders, build narrative: "Why did this order not execute?"
 */
export function queryLossNarrative(flow: ExecutionFlow): string {
  const path = queryRejectionPath(flow);

  if (!path) {
    return 'Order was committed successfully. No losses to explain.';
  }

  let narrative = `Order was rejected at ${path.rejectedBy} stage.\n`;
  narrative += `Reason: ${path.reason}\n\n`;

  // Build gate-by-gate narrative
  if (path.rejectedBy === 'intent_creation') {
    narrative += 'Failed to create intent from agent signal.\n';
    narrative += 'This suggests a bug in agent code or signal validation.\n';
  }

  if (path.rejectedBy === 'risk_approval') {
    narrative += `Risk system rejected signal.\n`;
    narrative += `Checks that failed:\n`;
    if (!flow.approval?.checks.timeAuthorityPassed) {
      narrative += `  • Time authority: ${flow.approval?.reason}\n`;
    }
    if (!flow.approval?.checks.confidenceThresholdPassed) {
      narrative += `  • Confidence too low\n`;
    }
    if (!flow.approval?.checks.exposureWithinLimits) {
      narrative += `  • Exposure exceeds limits\n`;
    }
    if (!flow.approval?.checks.drawdownAcceptable) {
      narrative += `  • Drawdown too deep\n`;
    }
    if (flow.approval?.checks.rateLimited) {
      narrative += `  • Rate limited by cooldown\n`;
    }
  }

  if (path.rejectedBy === 'proposal_generation') {
    narrative += `Execution proposal could not be generated.\n`;
    narrative += `This usually means market conditions were invalid or capital insufficient.\n`;
  }

  if (path.rejectedBy === 'order_commit') {
    narrative += `Order passed all internal gates but exchange rejected it.\n`;
    narrative += `Exchange error: ${flow.commit?.error?.message}\n`;
  }

  return narrative;
}

/**
 * queryTradeAnalysis
 * 
 * For committed orders, analyze the trade outcome.
 */
export function queryTradeAnalysis(flow: ExecutionFlow): {
  committed: boolean;
  size: number;
  price: number;
  estimatedSlippageUsd: number;
  filledSize?: number;
  filledPrice?: number;
  realizedSlippageUsd?: number;
} | null {
  if (flow.stage !== 'committed' || !flow.proposal || !flow.commit) {
    return null;  // not committed
  }

  const analysis = {
    committed: true,
    size: flow.proposal.size,
    price: flow.proposal.price,
    estimatedSlippageUsd: flow.proposal.estimatedImpactUsd,
    filledSize: flow.commit.filledSize,
    filledPrice: flow.commit.filledPrice,
    realizedSlippageUsd: undefined as number | undefined,
  };

  if (analysis.filledSize && analysis.filledPrice) {
    analysis.realizedSlippageUsd =
      Math.abs((analysis.filledPrice - analysis.price) * analysis.filledSize);
  }

  return analysis;
}

// ============================================================================
// SNAPSHOTS (for forensic records)
// ============================================================================

interface IntentSnapshot {
  id: string;
  ts: number;
  symbol: string;
  side: string;
  confidence: number;
  agentId: string;
  rationale: string;
}

function snapshotIntent(intent: SignalIntent): IntentSnapshot {
  return {
    id: intent.id,
    ts: intent.ts,
    symbol: intent.symbol,
    side: intent.side,
    confidence: intent.confidence,
    agentId: intent.agentId,
    rationale: intent.rationale,
  };
}

interface ApprovalSnapshot {
  intentId: string;
  approved: boolean;
  reason?: string;
  riskScore: number;
  checksPassed: number;
  checksTotal: number;
}

function snapshotApproval(approval: RiskApproval): ApprovalSnapshot {
  const checks = approval.checks;
  const checksPassed =
    (checks.timeAuthorityPassed ? 1 : 0) +
    (checks.confidenceThresholdPassed ? 1 : 0) +
    (checks.exposureWithinLimits ? 1 : 0) +
    (checks.drawdownAcceptable ? 1 : 0) +
    (!checks.rateLimited ? 1 : 0);

  return {
    intentId: approval.intentId,
    approved: approval.approved,
    reason: approval.reason,
    riskScore: approval.riskScore,
    checksPassed,
    checksTotal: 5,
  };
}

interface ProposalSnapshot {
  intentId: string;
  symbol: string;
  orderType: string;
  price: number;
  size: number;
  estimatedSlippageBps: number;
  estimatedImpactUsd: number;
  validUntil: number;
  ageMs: number;
}

function snapshotProposal(proposal: ExecutionProposal): ProposalSnapshot {
  return {
    intentId: proposal.intentId,
    symbol: proposal.symbol,
    orderType: proposal.orderType,
    price: proposal.price,
    size: proposal.size,
    estimatedSlippageBps: proposal.estimatedSlippageBps,
    estimatedImpactUsd: proposal.estimatedImpactUsd,
    validUntil: proposal.proposedAt + proposal.ttlMs,
    ageMs: Date.now() - proposal.proposedAt,
  };
}

interface CommitSnapshot {
  proposalId: string;
  committedAt: number;
  status: string;
  exchangeOrderId?: string;
  filledSize?: number;
  filledPrice?: number;
  error?: string;
}

function snapshotCommit(commit: OrderCommit): CommitSnapshot {
  return {
    proposalId: commit.proposalId,
    committedAt: commit.committedAt,
    status: commit.status,
    exchangeOrderId: commit.exchangeOrderId,
    filledSize: commit.filledSize,
    filledPrice: commit.filledPrice,
    error: commit.error?.message,
  };
}

// ============================================================================
// FORENSIC REPORT
// ============================================================================

/**
 * generateForensicReport
 * 
 * Complete post-mortem analysis in text format.
 */
export function generateForensicReport(flow: ExecutionFlow): string {
  const chain = queryExecutionChain(flow);
  const rejection = queryRejectionPath(flow);
  const trade = queryTradeAnalysis(flow);

  let report = `
╔══════════════════════════════════════════════════════════════════════════╗
║ EXECUTION FORENSIC REPORT                                                ║
╚══════════════════════════════════════════════════════════════════════════╝

EXECUTION ID: ${flow.id}
TIMESTAMP: ${new Date(flow.createdAt).toISOString()}
DURATION: ${flow.durationMs}ms
FINAL STAGE: ${flow.stage}

─────────────────────────────────────────────────────────────────────────────
INTENT (Stage 1)
─────────────────────────────────────────────────────────────────────────────
Agent: ${chain.intent.agentId}
Symbol: ${chain.intent.symbol}
Side: ${chain.intent.side.toUpperCase()}
Confidence: ${(chain.intent.confidence * 100).toFixed(1)}%
Rationale: ${chain.intent.rationale}

─────────────────────────────────────────────────────────────────────────────
RISK APPROVAL (Stage 2)
─────────────────────────────────────────────────────────────────────────────
Status: ${chain.approval.approved ? '✅ APPROVED' : '❌ REJECTED'}
Reason: ${chain.approval.reason || 'N/A'}
Risk Score: ${chain.approval.riskScore.toFixed(2)}
Checks Passed: ${chain.approval.checksPassed}/${chain.approval.checksTotal}

`;

  if (chain.proposal) {
    report += `
─────────────────────────────────────────────────────────────────────────────
EXECUTION PROPOSAL (Stage 3)
─────────────────────────────────────────────────────────────────────────────
Order Type: ${chain.proposal.orderType}
Price: $${chain.proposal.price.toFixed(8)}
Size: ${chain.proposal.size.toFixed(8)}
Notional: $${(chain.proposal.price * chain.proposal.size).toFixed(2)}
Estimated Slippage: ${chain.proposal.estimatedSlippageBps.toFixed(1)}bps ($${chain.proposal.estimatedImpactUsd.toFixed(2)})
Valid Until: ${new Date(chain.proposal.validUntil).toISOString()}
Age: ${chain.proposal.ageMs}ms

`;
  }

  if (chain.commit) {
    report += `
─────────────────────────────────────────────────────────────────────────────
ORDER COMMIT (Stage 4)
─────────────────────────────────────────────────────────────────────────────
Status: ${chain.commit.status}
Exchange Order ID: ${chain.commit.exchangeOrderId || 'N/A'}
Committed At: ${new Date(chain.commit.committedAt).toISOString()}
`;

    if (chain.commit.error) {
      report += `Error: ${chain.commit.error}\n`;
    }

    if (chain.commit.filledSize !== undefined) {
      report += `Filled Size: ${chain.commit.filledSize}\n`;
      report += `Filled Price: $${chain.commit.filledPrice}\n`;
    }

    report += '\n';
  }

  if (rejection) {
    report += `
─────────────────────────────────────────────────────────────────────────────
REJECTION ANALYSIS
─────────────────────────────────────────────────────────────────────────────
${queryLossNarrative(flow)}

`;
  }

  if (trade) {
    report += `
─────────────────────────────────────────────────────────────────────────────
TRADE ANALYSIS
─────────────────────────────────────────────────────────────────────────────
Status: ✅ COMMITTED
Size: ${trade.size}
Price: $${trade.price.toFixed(8)}
Estimated Slippage: $${trade.estimatedSlippageUsd.toFixed(2)}
`;

    if (trade.realizedSlippageUsd !== undefined) {
      report += `Realized Slippage: $${trade.realizedSlippageUsd.toFixed(2)}\n`;
    }

    report += '\n';
  }

  return report;
}

/**
 * generateBatchReport
 * 
 * Aggregate forensic report for multiple executions.
 */
export function generateBatchReport(flows: ExecutionFlow[]): string {
  const committed = flows.filter((f) => f.stage === 'committed');
  const rejected = flows.filter((f) => f.stage === 'rejected');

  let report = `
╔══════════════════════════════════════════════════════════════════════════╗
║ BATCH EXECUTION REPORT                                                   ║
╚══════════════════════════════════════════════════════════════════════════╝

Total Executions: ${flows.length}
Committed: ${committed.length}
Rejected: ${rejected.length}
Success Rate: ${((committed.length / flows.length) * 100).toFixed(1)}%

${rejected.length > 0 ? `
REJECTION SUMMARY
─────────────────────────────────────────────────────────────────────────────
${rejected
  .map((f) => {
    const path = queryRejectionPath(f);
    return `${f.intent.symbol} (${f.intent.side}): ${path?.rejectedBy} - ${path?.reason}`;
  })
  .join('\n')}
` : ''}

${committed.length > 0 ? `
COMMITTED TRADES
─────────────────────────────────────────────────────────────────────────────
${committed
  .map((f) => {
    const trade = queryTradeAnalysis(f);
    return `${f.intent.symbol} (${f.intent.side}): ${trade?.size} @ $${trade?.price.toFixed(8)}`;
  })
  .join('\n')}
` : ''}
`;

  return report;
}
