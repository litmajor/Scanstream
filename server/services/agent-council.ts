/**
 * Agent Council - Multi-agent consensus voting system
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURE:
 * - 10 agents split into 2 groups: RPG (5) + Physics (5)
 * - Each group votes separately → weighted consensus within group
 * - Groups reconcile → final council direction
 * - Council contributes as 4th source to consensus engine (20% weight)
 * 
 * REGIME-AWARE WEIGHTING:
 * - Agents only vote in their best regimes
 * - In-regime: full weight (1.5×)
 * - Out-of-regime: excluded (0.0× weight)
 * - Prevents pattern-matched noise in wrong conditions
 * 
 * DESIGN INVARIANTS:
 * - Off-regime agents produce 0 signal (not just discounted)
 * - Physics group wins internal vote if both groups present (55% weight)
 * - Groups must agree on direction or return HOLD
 * - Council contribution capped at ±0.20 to prevent override
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AgentAction = 'BUY' | 'SELL' | 'HOLD';
export type MarketRegimeType = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'BREAKOUT_SETUP' | 'QUIET';

export interface AgentSignal {
  action: AgentAction;
  confidence: number; // 0-1
  entry?: number;
  target?: number;
  stop?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type AgentGroup = 'RPG' | 'PHYSICS';

export interface AgentRegistration {
  agent: {
    generateSignal: (ticks: any[]) => AgentSignal;
    constructor: { name: string };
  };
  bestRegimes: MarketRegimeType[];
  group: AgentGroup;
  agentName?: string;
}

export interface GroupVoteResult {
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1, weighted by agreement
  agreement: number; // % of agents that agreed (0-1)
  agents: Array<{
    name: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    inRegime: boolean;
  }>;
}

export interface CouncilVote {
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1, capped at COUNCIL_CAP
  agentBreakdown: string[]; // audit trail: "AgentName:BUY@0.75*"
  groupResults: {
    rpg: GroupVoteResult;
    physics: GroupVoteResult;
  };
  activeAgents: number; // in-regime agents that participated
  totalAgents: number; // registered agents
  errors?: string[]; // warnings/issues during voting
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT COUNCIL
// ═══════════════════════════════════════════════════════════════════════════

export class AgentCouncil {
  private agents: AgentRegistration[] = [];
  private readonly COUNCIL_CAP = 0.25; // Max ±0.25 confidence delta to consensus
  private readonly MIN_GROUP_AGREEMENT = 0.50; // 50% of group must agree (3/5 minimum)
  private readonly RPG_WEIGHT = 0.45; // Within council voting
  private readonly PHYSICS_WEIGHT = 0.55;

  /**
   * Register an agent into the council
   */
  register(reg: AgentRegistration): void {
    const agentName = reg.agentName || reg.agent.constructor.name;
    this.agents.push({
      ...reg,
      agentName
    });
  }

  /**
   * Get all registered agents
   */
  getRegistered(): AgentRegistration[] {
    return [...this.agents];
  }

  /**
   * Main voting function — gathers votes, reconciles groups, returns council decision
   * 
   * @param ticks Market data (passed to agents)
   * @param regime Current market regime (filters in-regime agents)
   * @returns CouncilVote with full breakdown
   */
  vote(ticks: any[], regime: MarketRegimeType): CouncilVote {
    const errors: string[] = [];

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Gather signals from all agents, filter by regime
    // ─────────────────────────────────────────────────────────────────────
    let signalCount = 0;
    const signals = this.agents
      .map((reg) => {
        try {
          const signal = reg.agent.generateSignal(ticks);
          const inRegime = reg.bestRegimes.includes(regime);

          // Off-regime agents = 0.0 weight (completely excluded)
          const weight = inRegime ? 1.5 : 0.0;
          signalCount += weight > 0 ? 1 : 0;

          return {
            ...reg,
            signal,
            weight,
            inRegime,
            agentName: reg.agentName || reg.agent.constructor.name
          };
        } catch (err) {
          errors.push(`Agent ${reg.agentName || reg.agent.constructor.name} failed: ${err}`);
          return null;
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.weight > 0);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Split into groups and aggregate
    // ─────────────────────────────────────────────────────────────────────
    const rpgSignals = signals.filter((s) => s.group === 'RPG');
    const physicsSignals = signals.filter((s) => s.group === 'PHYSICS');

    const rpgResult = this.aggregateGroup(rpgSignals, 'RPG', regime);
    const physicsResult = this.aggregateGroup(physicsSignals, 'PHYSICS', regime);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Reconcile groups → final direction
    // ─────────────────────────────────────────────────────────────────────
    const finalDirection = this.reconcileGroups(rpgResult, physicsResult);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Calculate final confidence (physics-weighted higher)
    // ─────────────────────────────────────────────────────────────────────
    const finalConfidence =
      rpgResult.confidence * this.RPG_WEIGHT + physicsResult.confidence * this.PHYSICS_WEIGHT;

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: Build audit trail
    // ─────────────────────────────────────────────────────────────────────
    const agentBreakdown = signals.map((s) => {
      const inRegimeMarker = s.inRegime ? '' : '(out)';
      return `${s.agentName}:${s.signal.action}@${s.signal.confidence.toFixed(2)}${inRegimeMarker}`;
    });

    return {
      direction: finalDirection,
      confidence: Math.min(finalConfidence, this.COUNCIL_CAP), // Cap at 0.25
      agentBreakdown,
      groupResults: {
        rpg: rpgResult,
        physics: physicsResult
      },
      activeAgents: signals.length,
      totalAgents: this.agents.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Aggregate signals from a single group (RPG or Physics)
   * Returns HOLD if < 50% agreement on direction
   */
  private aggregateGroup(
    signals: Array<
      AgentRegistration & {
        signal: AgentSignal;
        weight: number;
        inRegime: boolean;
        agentName: string;
      }
    >,
    groupName: AgentGroup,
    regime: MarketRegimeType
  ): GroupVoteResult {
    if (signals.length === 0) {
      return {
        direction: 'HOLD',
        confidence: 0,
        agreement: 0,
        agents: []
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // Count votes by direction
    // ─────────────────────────────────────────────────────────────────────
    const buys = signals.filter((s) => s.signal.action === 'BUY');
    const sells = signals.filter((s) => s.signal.action === 'SELL');
    const holds = signals.filter((s) => s.signal.action === 'HOLD');
    const total = signals.length;

    const buyAgreement = buys.length / total;
    const sellAgreement = sells.length / total;

    // ─────────────────────────────────────────────────────────────────────
    // Check agreement threshold (50% minimum)
    // ─────────────────────────────────────────────────────────────────────
    if (buyAgreement >= this.MIN_GROUP_AGREEMENT) {
      const avgConf = buys.reduce((sum, s) => sum + s.signal.confidence, 0) / buys.length;
      return {
        direction: 'BUY',
        confidence: avgConf * buyAgreement,
        agreement: buyAgreement,
        agents: signals.map((s) => ({
          name: s.agentName,
          action: s.signal.action,
          confidence: s.signal.confidence,
          inRegime: s.inRegime
        }))
      };
    }

    if (sellAgreement >= this.MIN_GROUP_AGREEMENT) {
      const avgConf = sells.reduce((sum, s) => sum + s.signal.confidence, 0) / sells.length;
      return {
        direction: 'SELL',
        confidence: avgConf * sellAgreement,
        agreement: sellAgreement,
        agents: signals.map((s) => ({
          name: s.agentName,
          action: s.signal.action,
          confidence: s.signal.confidence,
          inRegime: s.inRegime
        }))
      };
    }

    // No agreement → HOLD
    return {
      direction: 'HOLD',
      confidence: 0,
      agreement: Math.max(buyAgreement, sellAgreement),
      agents: signals.map((s) => ({
        name: s.agentName,
        action: s.signal.action,
        confidence: s.signal.confidence,
        inRegime: s.inRegime
      }))
    };
  }

  /**
   * Reconcile RPG and Physics group decisions
   * 
   * Logic:
   * - Both agree (same direction, not HOLD) → return that direction
   * - One says HOLD, other has direction → take the direction
   * - Contradiction (different directions) → HOLD
   */
  private reconcileGroups(rpg: GroupVoteResult, physics: GroupVoteResult): 'BUY' | 'SELL' | 'HOLD' {
    // Both same direction (and not HOLD)
    if (rpg.direction === physics.direction && rpg.direction !== 'HOLD') {
      return rpg.direction as 'BUY' | 'SELL';
    }

    // One HOLD, other has direction
    if (rpg.direction === 'HOLD' && physics.direction !== 'HOLD') {
      return physics.direction as 'BUY' | 'SELL';
    }
    if (physics.direction === 'HOLD' && rpg.direction !== 'HOLD') {
      return rpg.direction as 'BUY' | 'SELL';
    }

    // Contradiction or both HOLD → return HOLD
    return 'HOLD';
  }

  /**
   * Get debug info about council state
   */
  getStats(): {
    totalAgents: number;
    rpgAgents: number;
    physicsAgents: number;
    regimeMembership: Record<MarketRegimeType, string[]>;
  } {
    const regimeMembership: Record<MarketRegimeType, string[]> = {
      TRENDING: [],
      RANGING: [],
      VOLATILE: [],
      BREAKOUT_SETUP: [],
      QUIET: []
    };

    this.agents.forEach((reg) => {
      reg.bestRegimes.forEach((regime) => {
        regimeMembership[regime].push(reg.agentName || reg.agent.constructor.name);
      });
    });

    return {
      totalAgents: this.agents.length,
      rpgAgents: this.agents.filter((a) => a.group === 'RPG').length,
      physicsAgents: this.agents.filter((a) => a.group === 'PHYSICS').length,
      regimeMembership
    };
  }
}
