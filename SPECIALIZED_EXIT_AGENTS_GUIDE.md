/**
 * INTEGRATED OPPOSITION & EXIT AGENT SYSTEM
 * 
 * Real-world usage: Coordinate 3 specialized agents for perfect exits
 */

import { ExitOrchestratorAgent, OppositionResistanceAgent, MicrostructureSpecialistAgent } from './SpecializedExitAgents';
import FlowPhysicsAgent from './FlowPhysicsAgent';
import VFMDPhysicsAgent from './VFMDPhysicsAgent';

// ============================================================================
// PATTERN 1: ENTRY-TO-EXIT PIPELINE
// ============================================================================
/**
 * Complete trading flow:
 * 1. Entry agents (Flow + VFMD) generate entry signal
 * 2. Exit agent determines stop/target structure
 * 3. Opposition agent alerts when support breaks
 * 4. Microstructure agent exits early on liquidity warnings
 */

class TradeExecutionPipeline {
  private entryFlow: FlowPhysicsAgent;
  private entryVFMD: VFMDPhysicsAgent;
  private exitOrchestrator: ExitOrchestratorAgent;
  private oppositionReader: OppositionResistanceAgent;
  private microstructureSpecialist: MicrostructureSpecialistAgent;

  constructor() {
    this.entryFlow = new FlowPhysicsAgent('EntryFlow', 'balanced');
    this.entryVFMD = new VFMDPhysicsAgent('EntryVFMD');
    this.exitOrchestrator = new ExitOrchestratorAgent('ExitMaster', 'balanced');
    this.oppositionReader = new OppositionResistanceAgent('OppositionReader', 'balanced');
    this.microstructureSpecialist = new MicrostructureSpecialistAgent('Microstructure', 'conservative');
  }

  /**
   * Full trade lifecycle
   */
  async executeTrade(
    entryData: any,
    supportLevels: number[],
    resistanceLevels: number[],
    microstructure: any
  ) {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║           TRADE EXECUTION PIPELINE                  ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    // ========== STEP 1: ENTRY GENERATION ==========
    console.log('1️⃣  ENTRY STAGE');
    console.log('─'.repeat(50));

    const flowEntry = this.entryFlow.generateSignal(entryData);
    const vfmdEntry = this.entryVFMD.generateSignal(entryData);

    if (flowEntry.action === 'HOLD' || vfmdEntry.action === 'HOLD') {
      console.log('❌ No entry signal. Agents disagree or low confidence.');
      return;
    }

    console.log(`✅ Flow: ${flowEntry.action} (${(flowEntry.confidence * 100).toFixed(0)}%)`);
    console.log(`✅ VFMD: ${vfmdEntry.action} (${(vfmdEntry.confidence * 100).toFixed(0)}%)`);

    const entryPrice = (flowEntry.entry + vfmdEntry.entry) / 2;
    console.log(`📍 Entry Price: $${entryPrice.toFixed(2)}`);

    // ========== STEP 2: EXIT STRUCTURE ==========
    console.log('\n2️⃣  EXIT STRUCTURE (Set by ExitOrchestrator)');
    console.log('─'.repeat(50));

    const exitAnalysis = this.exitOrchestrator.analyzeExit({
      entryPrice,
      currentPrice: entryPrice,
      atr: 0.5, // example
      signalType: 'BUY',
      profitPercent: 0,
      timeHeldHours: 0,
    });

    console.log(`🛑 Initial Stop: ${exitAnalysis.exitPrice.toFixed(2)}`);
    console.log(`📊 Stage: ${exitAnalysis.exitStage}`);
    console.log(`💡 Strategy: ${this.exitOrchestrator.personality} exit approach`);

    // ========== STEP 3: OPPOSITION MAPPING ==========
    console.log('\n3️⃣  OPPOSITION MAPPING (OppositionReader)');
    console.log('─'.repeat(50));

    const opposition = this.oppositionReader.analyzeOpposition({
      currentPrice: entryPrice,
      supportLevels,
      resistanceLevels,
      volume: 10000,
      priceVelocity: 0.005,
      volatility: 0.02,
      timeToSupport: 5,
    });

    console.log(`🛡️  Nearest Support: $${opposition.nearestSupport.toFixed(2)} (Strength: ${(opposition.supportStrength * 100).toFixed(0)}%)`);
    console.log(`⛔ Nearest Resistance: $${opposition.nearestResistance.toFixed(2)} (Strength: ${(opposition.resistanceStrength * 100).toFixed(0)}%)`);
    console.log(`💥 Breakout Probability: ${(opposition.breakoutProbability * 100).toFixed(0)}%`);

    // ========== STEP 4: MICROSTRUCTURE MONITORING ==========
    console.log('\n4️⃣  MICROSTRUCTURE MONITORING');
    console.log('─'.repeat(50));

    const microStatus = this.microstructureSpecialist.analyzeMicrostructure(microstructure);

    console.log(`📊 Order Flow Bias: ${microStatus.orderFlowBias > 0 ? '🟢 BUY' : '🔴 SELL'} (${Math.abs(microStatus.orderFlowBias * 100).toFixed(0)}%)`);
    console.log(`💧 Liquidity: ${microStatus.depthStatus}`);
    console.log(`📈 Spread Warning: ${microStatus.spreadWarning ? '⚠️ YES' : '✅ NO'}`);
    console.log(`🚨 Urgency: ${microStatus.exitUrgency}`);

    // ========== STEP 5: REAL-TIME MONITORING LOOP ==========
    console.log('\n5️⃣  MONITORING (Continuous)');
    console.log('─'.repeat(50));
    console.log('Agents will monitor:');
    console.log('  • ExitOrchestrator: Profit stage transitions, time limits');
    console.log('  • OppositionReader: Support/resistance breaks');
    console.log('  • Microstructure: Order flow reversals, spread widening');

    return {
      entryPrice,
      exit: exitAnalysis,
      opposition,
      microStructure: microStatus,
      readyToTrade: true,
    };
  }
}

// ============================================================================
// PATTERN 2: AGENT CONSENSUS SYSTEM
// ============================================================================
/**
 * Use all 3 exit agents to reach consensus exit decision
 * Only exit if majority agree (2/3)
 */

class ExitConsensusVoting {
  private exitOrchestrator: ExitOrchestratorAgent;
  private oppositionReader: OppositionResistanceAgent;
  private microstructureSpecialist: MicrostructureSpecialistAgent;

  constructor() {
    this.exitOrchestrator = new ExitOrchestratorAgent('ExitMaster');
    this.oppositionReader = new OppositionResistanceAgent('OppositionReader');
    this.microstructureSpecialist = new MicrostructureSpecialistAgent('Microstructure');
  }

  /**
   * Get consensus exit decision from all 3 agents
   */
  getConsensusExit(tradeState: any, market: any): {
    consensusAction: 'HOLD' | 'EXIT';
    confidence: number;
    votes: Record<string, string>;
    majorityReason: string;
  } {
    // Get individual votes
    const exitVote = this.exitOrchestrator.analyzeExit(tradeState);
    const oppositionVote = this.oppositionReader.analyzeOpposition(market.opposition);
    const microVote = this.microstructureSpecialist.analyzeMicrostructure(market.microstructure);

    const votes = {
      ExitOrchestrator: exitVote.action,
      OppositionReader:
        oppositionVote.supportStrength < 0.3 ? 'EXIT' : 'HOLD',
      Microstructure: microVote.exitUrgency === 'EXIT_URGENT' || microVote.exitUrgency === 'EXIT_STANDARD' ? 'EXIT' : 'HOLD',
    };

    // Count votes
    const exitVotes = Object.values(votes).filter(v => v === 'EXIT').length;
    const consensusAction = exitVotes >= 2 ? 'EXIT' : 'HOLD';
    const confidence = exitVotes / 3;

    const majorityReason =
      exitVotes === 3
        ? 'All agents agree: EXIT'
        : exitVotes === 2
          ? 'Majority consensus: EXIT (2/3 agents)'
          : 'Hold: Minority exit vote';

    console.log('\n📋 CONSENSUS EXIT VOTING:');
    console.log(`  ExitOrchestrator: ${votes.ExitOrchestrator}`);
    console.log(`  OppositionReader: ${votes.OppositionReader}`);
    console.log(`  Microstructure: ${votes.Microstructure}`);
    console.log(`\n💡 Result: ${consensusAction} (${(confidence * 100).toFixed(0)}% confidence)`);
    console.log(`📢 Reason: ${majorityReason}`);

    return {
      consensusAction,
      confidence,
      votes,
      majorityReason,
    };
  }
}

// ============================================================================
// PATTERN 3: AGENT SPECIALIZATION BY SCENARIO
// ============================================================================
/**
 * Route to specialized agent based on market conditions
 */

class ScenarioRoutingSystem {
  private exitOrchestrator: ExitOrchestratorAgent;
  private oppositionReader: OppositionResistanceAgent;
  private microstructureSpecialist: MicrostructureSpecialistAgent;

  constructor() {
    this.exitOrchestrator = new ExitOrchestratorAgent('ExitMaster');
    this.oppositionReader = new OppositionResistanceAgent('OppositionReader');
    this.microstructureSpecialist = new MicrostructureSpecialistAgent('Microstructure');
  }

  /**
   * Route to best agent for current scenario
   */
  decideExitAgent(tradeState: any, market: any) {
    const scenario = this.detectScenario(market);

    switch (scenario) {
      case 'CONSOLIDATION_BREAK':
        // Opposition agent excels: knows when consolidation will break
        console.log('📊 Scenario: Consolidation Break');
        console.log('👤 Active Agent: OppositionReader');
        console.log('   Will watch for breakout and exit on false breakouts');
        return this.oppositionReader;

      case 'MOMENTUM_EXHAUSTION':
        // Microstructure agent: detects when momentum is dying
        console.log('⚡ Scenario: Momentum Exhaustion');
        console.log('👤 Active Agent: MicrostructureSpecialist');
        console.log('   Will detect order flow reversal before price reversal');
        return this.microstructureSpecialist;

      case 'PROFIT_EXTRACTION':
        // Exit orchestrator: manages trailing stops and profit locking
        console.log('💰 Scenario: Profit Extraction');
        console.log('👤 Active Agent: ExitOrchestrator');
        console.log('   Will maximize gains with intelligent trailing');
        return this.exitOrchestrator;

      case 'CRISIS_MODE':
        // All agents active: need full consensus
        console.log('🚨 Scenario: Crisis/Liquidity Event');
        console.log('👤 Active Agents: All (Full Consensus)');
        console.log('   Will exit immediately on 2/3 consensus');
        return null; // Signal consensus needed

      default:
        return this.exitOrchestrator; // Default to exit orchestrator
    }
  }

  private detectScenario(market: any): string {
    // Consolidation: low volatility, flat
    if (market.volatility < 0.005) {
      return 'CONSOLIDATION_BREAK';
    }

    // Momentum dying: spread widening, order flow reversing
    if (market.microstructure.spreadWarning && market.orderFlowBias < -0.2) {
      return 'MOMENTUM_EXHAUSTION';
    }

    // Profit stage: significant gains, normal conditions
    if (market.tradeState.profitPercent > 0.02 && market.microstructure.depthStatus === 'HEALTHY') {
      return 'PROFIT_EXTRACTION';
    }

    // Crisis: liquidity drying up
    if (market.microstructure.liquidityAlert) {
      return 'CRISIS_MODE';
    }

    return 'NORMAL';
  }
}

// ============================================================================
// PATTERN 4: AGENT LEARNING FROM EXITS
// ============================================================================
/**
 * Agents learn what exit decisions work best
 * Level up for correct calls, down for poor exits
 */

class AgentExitLearning {
  private agents: {
    exitOrchestrator: ExitOrchestratorAgent;
    oppositionReader: OppositionResistanceAgent;
    microstructureSpecialist: MicrostructureSpecialistAgent;
  };

  constructor() {
    this.agents = {
      exitOrchestrator: new ExitOrchestratorAgent('ExitMaster'),
      oppositionReader: new OppositionResistanceAgent('OppositionReader'),
      microstructureSpecialist: new MicrostructureSpecialistAgent('Microstructure'),
    };
  }

  /**
   * Record exit outcome and update agent knowledge
   */
  recordExitOutcome(outcome: {
    agentName: 'exitOrchestrator' | 'oppositionReader' | 'microstructureSpecialist';
    exitDecision: string; // What the agent decided
    actualPrice: number; // Where we exited
    optimalPrice: number; // Best we could have done
    reason: string; // Why we exited
  }): void {
    const agent = this.agents[outcome.agentName];

    // Calculate how good the exit was
    const slippage = Math.abs(outcome.actualPrice - outcome.optimalPrice) / outcome.optimalPrice;
    const quality = Math.max(0, 1 - slippage * 10); // 0-1 score

    console.log(`\n📊 EXIT OUTCOME RECORDED:`);
    console.log(`   Agent: ${outcome.agentName}`);
    console.log(`   Decision: ${outcome.exitDecision}`);
    console.log(`   Quality Score: ${(quality * 100).toFixed(0)}%`);
    console.log(`   Slippage: ${(slippage * 100).toFixed(2)}%`);

    // Update agent performance
    agent.updatePerformance({
      profit: outcome.actualPrice - outcome.optimalPrice, // +/- from perfect
      profit_pct: (outcome.actualPrice - outcome.optimalPrice) / outcome.optimalPrice * 100,
      market_difficulty: 1.0,
      execution_quality: quality,
      regime: 'EXIT_LEARNING',
      duration_hours: 1,
    });

    console.log(`   New Level: ${agent.level}`);
    console.log(`   New Skills: ${JSON.stringify(agent.skill_levels, null, 2)}`);
  }

  /**
   * After 10 exits, analyze which agent had best performance
   */
  analyzeAgentSpecialization(exitResults: any[]): void {
    console.log('\n🏆 AGENT SPECIALIZATION ANALYSIS:');

    const exitOrchestratorScore = exitResults
      .filter(r => r.agentName === 'exitOrchestrator')
      .reduce((sum, r) => sum + r.quality, 0) / 10;

    const oppositionScore = exitResults
      .filter(r => r.agentName === 'oppositionReader')
      .reduce((sum, r) => sum + r.quality, 0) / 10;

    const microScore = exitResults
      .filter(r => r.agentName === 'microstructureSpecialist')
      .reduce((sum, r) => sum + r.quality, 0) / 10;

    console.log(`  ExitOrchestrator: ${(exitOrchestratorScore * 100).toFixed(1)}%`);
    console.log(`  OppositionReader: ${(oppositionScore * 100).toFixed(1)}%`);
    console.log(`  MicrostructureSpecialist: ${(microScore * 100).toFixed(1)}%`);

    if (microScore > oppositionScore && microScore > exitOrchestratorScore) {
      console.log(`\n✨ Best for exits: MICROSTRUCTURE SPECIALIST`);
      console.log(`   → Use for momentum exhaustion detection`);
    }
  }
}

// ============================================================================
// PATTERN 5: MULTI-POSITION EXIT COORDINATION
// ============================================================================
/**
 * Coordinate exits across multiple open positions
 * Don't exit all at once - spread them out
 */

class PortfolioExitCoordination {
  private exitOrchestrator: ExitOrchestratorAgent;
  private positions: Map<string, any> = new Map();

  constructor() {
    this.exitOrchestrator = new ExitOrchestratorAgent('PortfolioExitMaster');
  }

  /**
   * Coordinate exits across all positions
   * Priority: close losers first, then trailing winners
   */
  coordinateExits(allPositions: any[]): {
    exitPriority: string[];
    recommendations: Record<string, string>;
  } {
    const exitPriority: string[] = [];
    const recommendations: Record<string, string> = {};

    // PRIORITY 1: Stop losses hit
    allPositions
      .filter(p => p.profitPercent < -0.02)
      .forEach(p => {
        exitPriority.push(p.symbol);
        recommendations[p.symbol] = '❌ Stop loss hit - EXIT IMMEDIATELY';
      });

    // PRIORITY 2: Losing trades about to hit stop
    allPositions
      .filter(p => p.profitPercent < -0.01 && p.profitPercent > -0.02)
      .forEach(p => {
        exitPriority.push(p.symbol);
        recommendations[p.symbol] = '⚠️ Near stop loss - PREPARE EXIT';
      });

    // PRIORITY 3: Winning trades at profit targets
    allPositions
      .filter(p => p.profitPercent > 0.04)
      .forEach(p => {
        exitPriority.push(p.symbol);
        recommendations[p.symbol] = '💰 At target - TAKE PROFIT';
      });

    // PRIORITY 4: Everything else - let run
    allPositions
      .filter(
        p =>
          p.profitPercent >= -0.01 &&
          p.profitPercent <= 0.04 &&
          !exitPriority.includes(p.symbol)
      )
      .forEach(p => {
        recommendations[p.symbol] = '⏳ Hold for development';
      });

    console.log('\n📊 PORTFOLIO EXIT COORDINATION:');
    console.log(exitPriority.map((s, i) => `  ${i + 1}. ${s}: ${recommendations[s]}`).join('\n'));

    return { exitPriority, recommendations };
  }
}

export {
  TradeExecutionPipeline,
  ExitConsensusVoting,
  ScenarioRoutingSystem,
  AgentExitLearning,
  PortfolioExitCoordination,
};
