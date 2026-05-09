/**
 * EXECUTION ORCHESTRATOR
 * 
 * Manages the four-compartment pipeline:
 * 1. SignalIntent (agent desire)
 * 2. RiskApproval (authority filter)
 * 3. ExecutionProposal (concrete plan)
 * 4. OrderCommit (final action)
 * 
 * Responsibilities:
 * - Route intents through all stages
 * - Log each transition
 * - Stop on rejection
 * - Provide forensic audit trail
 * - Handle errors gracefully
 * 
 * This is the conductor of the execution symphony.
 */

import { v4 as uuidv4 } from 'uuid';
import { DecisionContext } from '../../types/DecisionContext';
import { UUID } from '../../types/Common';
import {
  SignalIntent,
  RiskApproval,
  ExecutionProposal,
  OrderCommit,
  ExecutionFlow,
  AgentSignalSource,
  EXECUTION_COMPARTMENT_CONSTANTS,
} from '../../types/ExecutionCompartments';
import { createSignalIntent } from './signalIntentFactory';
import { approveSignalIntent, RiskState } from './riskApprovalEngine';
import { generateExecutionProposal, MarketSnapshot } from './executionProposalGenerator';
import { commitOrder, ExchangeAdapter } from './orderCommitFinalizer';

// ============================================================================
// EXECUTION ORCHESTRATOR
// ============================================================================

/**
 * ExecutionOrchestrator
 * 
 * Stateful manager of the execution pipeline.
 * Handles routing, logging, and error recovery.
 */
export class ExecutionOrchestrator {
  private executions: Map<string, ExecutionFlow> = new Map();
  private riskState: RiskState;
  private exchange: ExchangeAdapter;
  private logger: Logger;

  constructor(riskState: RiskState, exchange: ExchangeAdapter, logger?: Logger) {
    this.riskState = riskState;
    this.exchange = exchange;
    this.logger = logger || new ConsoleLogger();
  }

  /**
   * executeSignal
   * 
   * Main entry point: route signal through all four compartments.
   * 
   * Returns ExecutionFlow describing what happened.
   */
  async executeSignal(
    source: AgentSignalSource,
    ctx: DecisionContext,
    market: MarketSnapshot
  ): Promise<ExecutionFlow> {
    const flow: ExecutionFlow = {
      id: uuidv4() as any as UUID,
      createdAt: Date.now(),
      stage: 'intent',
      durationMs: 0,
      intent: null as any,  // will be filled
      approval: null as any,
      proposal: undefined,
      commit: undefined,
    };

    try {
      // ====================================================================
      // STAGE 1: Create SignalIntent
      // ====================================================================

      this.logger.log(`[${flow.id}] Creating intent from agent ${source.agentId}`);

      let intent: SignalIntent;
      try {
        intent = createSignalIntent(source, ctx);
        flow.intent = intent;
        this.logger.log(`[${flow.id}] ✅ Intent created: ${intent.id}`);
      } catch (e: any) {
        flow.stage = 'rejected';
        flow.rejectionReason = `Failed to create intent: ${e.message}`;
        flow.rejectedAt = Date.now();
        this.logger.error(`[${flow.id}] ❌ Intent creation failed: ${e.message}`);
        return this.finalizeFlow(flow);
      }

      // ====================================================================
      // STAGE 2: Risk Approval
      // ====================================================================

      this.logger.log(`[${flow.id}] Submitting to risk approval`);

      const approval = approveSignalIntent(intent, this.riskState);
      flow.approval = approval;

      if (!approval.approved) {
        flow.stage = 'approved';  // reached approval stage, but rejected
        flow.rejectionReason = `Risk approval rejected: ${approval.reason}`;
        flow.rejectedAt = Date.now();
        this.logger.log(
          `[${flow.id}] ⛔ Risk veto: ${approval.reason}`
        );
        return this.finalizeFlow(flow);
      }

      this.logger.log(`[${flow.id}] ✅ Risk approval granted (score: ${approval.riskScore.toFixed(2)})`);

      // ====================================================================
      // STAGE 3: Generate Execution Proposal
      // ====================================================================

      this.logger.log(`[${flow.id}] Generating execution proposal`);

      const proposal = generateExecutionProposal(intent, approval, market);

      if (!proposal) {
        flow.stage = 'approved';
        flow.rejectionReason = 'Proposal generation returned null (market conditions or limits)';
        flow.rejectedAt = Date.now();
        this.logger.log(`[${flow.id}] ⛔ Proposal generation failed`);
        return this.finalizeFlow(flow);
      }

      flow.proposal = proposal;
      this.logger.log(
        `[${flow.id}] ✅ Proposal generated: ${proposal.symbol} ` +
        `${proposal.side} ${proposal.size} @ $${proposal.price.toFixed(8)}`
      );

      // ====================================================================
      // STAGE 4: Commit Order
      // ====================================================================

      this.logger.log(`[${flow.id}] Committing order to exchange`);

      let commit: OrderCommit;
      try {
        commit = await commitOrder(proposal, approval, ctx, this.exchange);
        flow.commit = commit;
      } catch (e: any) {
        flow.stage = 'proposed';
        flow.rejectionReason = `Commit failed: ${e.message}`;
        flow.rejectedAt = Date.now();
        this.logger.error(`[${flow.id}] ❌ Order commit failed: ${e.message}`);
        return this.finalizeFlow(flow);
      }

      if (commit.status === 'rejected') {
        flow.stage = 'proposed';
        flow.rejectionReason = `Exchange rejected order: ${commit.error?.message}`;
        flow.rejectedAt = Date.now();
        this.logger.log(`[${flow.id}] ⛔ Exchange rejection: ${commit.error?.message}`);
        return this.finalizeFlow(flow);
      }

      // Success!
      flow.stage = 'committed';
      this.logger.log(
        `[${flow.id}] ✅ Order committed: ${commit.exchangeOrderId}`
      );

      return this.finalizeFlow(flow);

    } catch (e: any) {
      this.logger.error(`[${flow.id}] Unexpected error: ${e.message}`);
      flow.rejectionReason = `Unexpected: ${e.message}`;
      flow.stage = flow.stage || 'intent';
      return this.finalizeFlow(flow);
    }
  }

  /**
   * executeBatch
   * 
   * Execute multiple signals.
   */
  async executeBatch(
    sources: AgentSignalSource[],
    ctx: DecisionContext,
    markets: Map<string, MarketSnapshot>
  ): Promise<ExecutionFlow[]> {
    const flows: ExecutionFlow[] = [];

    for (const source of sources) {
      const market = markets.get(source.symbol);
      if (!market) {
        this.logger.warn(`No market data for ${source.symbol}, skipping`);
        continue;
      }

      const flow = await this.executeSignal(source, ctx, market);
      flows.push(flow);
    }

    return flows;
  }

  /**
   * finalizeFlow
   * 
   * Calculate final metrics and store flow.
   */
  private finalizeFlow(flow: ExecutionFlow): ExecutionFlow {
    flow.durationMs = Date.now() - flow.createdAt;
    this.executions.set(flow.id, flow);
    return flow;
  }

  // ========================================================================
  // QUERY INTERFACE
  // ========================================================================

  /**
   * getFlow
   * 
   * Retrieve execution flow by ID.
   */
  getFlow(flowId: string): ExecutionFlow | undefined {
    return this.executions.get(flowId);
  }

  /**
   * getFlowsByStage
   * 
   * Query all flows that reached a certain stage.
   */
  getFlowsByStage(stage: ExecutionFlow['stage']): ExecutionFlow[] {
    return Array.from(this.executions.values()).filter((f) => f.stage === stage);
  }

  /**
   * getFlowsByAgent
   * 
   * Query all flows from a specific agent.
   */
  getFlowsByAgent(agentId: string): ExecutionFlow[] {
    return Array.from(this.executions.values()).filter(
      (f) => f.intent?.agentId === agentId
    );
  }

  /**
   * getFlowsBySymbol
   * 
   * Query all flows for a specific symbol.
   */
  getFlowsBySymbol(symbol: string): ExecutionFlow[] {
    return Array.from(this.executions.values()).filter(
      (f) => f.intent?.symbol === symbol
    );
  }

  /**
   * getCommittedFlows
   * 
   * Get all flows that resulted in actual orders.
   */
  getCommittedFlows(): ExecutionFlow[] {
    return this.getFlowsByStage('committed');
  }

  /**
   * getRejectedFlows
   * 
   * Get all flows that were rejected.
   */
  getRejectedFlows(): ExecutionFlow[] {
    return this.getFlowsByStage('rejected');
  }

  /**
   * getStatistics
   * 
   * Get pipeline statistics.
   */
  getStatistics() {
    const all = Array.from(this.executions.values());
    const byStage = {
      intent: all.filter((f) => f.stage === 'intent').length,
      approved: all.filter((f) => f.stage === 'approved').length,
      proposed: all.filter((f) => f.stage === 'proposed').length,
      committed: all.filter((f) => f.stage === 'committed').length,
      rejected: all.filter((f) => f.stage === 'rejected').length,
    };

    const avgDuration =
      all.length > 0 ? all.reduce((sum, f) => sum + f.durationMs, 0) / all.length : 0;

    return {
      total: all.length,
      byStage,
      avgDurationMs: avgDuration,
      successRate: byStage.committed / all.length,
    };
  }
}

// ============================================================================
// LOGGER INTERFACE
// ============================================================================

/**
 * Logger
 * 
 * Abstraction over logging.
 */
export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * ConsoleLogger
 * 
 * Default logger implementation.
 */
class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(`[ExecutionOrchestrator] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[ExecutionOrchestrator] ⚠️  ${message}`);
  }

  error(message: string): void {
    console.error(`[ExecutionOrchestrator] ❌ ${message}`);
  }
}

// ============================================================================
// BUILDER PATTERN
// ============================================================================

/**
 * OrchestratorBuilder
 * 
 * Fluent interface for creating orchestrators with custom dependencies.
 */
export class OrchestratorBuilder {
  private riskState: RiskState | null = null;
  private exchange: ExchangeAdapter | null = null;
  private logger: Logger | null = null;

  withRiskState(state: RiskState): this {
    this.riskState = state;
    return this;
  }

  withExchange(exchange: ExchangeAdapter): this {
    this.exchange = exchange;
    return this;
  }

  withLogger(logger: Logger): this {
    this.logger = logger;
    return this;
  }

  build(): ExecutionOrchestrator {
    if (!this.riskState) {
      throw new Error('RiskState is required');
    }
    if (!this.exchange) {
      throw new Error('Exchange adapter is required');
    }

    return new ExecutionOrchestrator(
      this.riskState,
      this.exchange,
      this.logger || undefined
    );
  }
}
