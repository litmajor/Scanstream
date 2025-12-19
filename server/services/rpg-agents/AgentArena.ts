import { TradingAgent } from './TradingAgent';
import { MarketOracle } from './MarketOracle';
import { StrategyBridge } from './StrategyBridge';
import { AchievementSystem } from './AchievementSystem';
import { AgentSynergyDetector } from './AgentSynergyDetector';
import { AgentLifecycleManager } from './AgentLifecycleManager';
import { InformationChannelSystem } from './InformationChannelSystem';
import { MarketSage } from './MarketSage';
import { AgentPortfolioManager } from './AgentPortfolioManager';
import { OnlineLearningSystem } from './OnlineLearningSystem';
import { AgentSpawner, type SpawnDecision, type MarketRegime } from './AgentSpawner';
import { CommanderApprovalSystem } from './CommanderApprovalSystem';
import { TrendRider } from './TrendRider';
import { SupportSniper } from './SupportSniper';
import { ReversalMaster } from './ReversalMaster';
import { VolumeMechanicalVerifierAgent } from './VolumeMechanicalVerifierAgent';
import VFMDPhysicsAgent from './VFMDPhysicsAgent';
import FlowPhysicsAgent from './FlowPhysicsAgent';
import { PythonStrategyAgent } from './PythonStrategyAgent';
import { MLOracle } from './MLOracle';

export interface LeaderboardEntry {
  agent_name: string;
  rank: string;
  level: number;
  points: number;
  win_rate: number;
  profit_factor: number;
  sharpe: number;
  total_profit: number;
}

export interface AgentCombo {
  name: string;
  agents: string[];
  activation_condition: string;
  bonus_multiplier: number;
  historical_win_rate: number;
  historical_profit_factor: number;
  times_activated: number;
}

export class AgentArena {
  private agents: Map<string, any> = new Map();
  private combos: AgentCombo[] = [];
  private marketOracle: MarketOracle;
  private strategyBridge: StrategyBridge | null = null;
  private achievementSystem: AchievementSystem;
  private synergyDetector: AgentSynergyDetector;
  private lifecycleManager: AgentLifecycleManager;
  private channelSystem: InformationChannelSystem;

  private marketSage: MarketSage;
  private portfolioManager: AgentPortfolioManager;
  private learningSystem: OnlineLearningSystem;
  private agentSpawner: AgentSpawner;
  private currentRegime: MarketRegime = 'NEUTRAL';
  private approvalSystem: CommanderApprovalSystem;
  private strategyBridgeInstance: StrategyBridge | null = null;
  private volumeAgent: VolumeMechanicalVerifierAgent | null = null;

  constructor(approvalSystem?: CommanderApprovalSystem) {
    this.marketOracle = new MarketOracle();
    this.achievementSystem = new AchievementSystem();
    this.synergyDetector = new AgentSynergyDetector();
    this.lifecycleManager = new AgentLifecycleManager();
    this.channelSystem = new InformationChannelSystem();
    this.marketSage = new MarketSage();
    this.portfolioManager = new AgentPortfolioManager(100000);  // $100k initial capital
    this.learningSystem = new OnlineLearningSystem();
    this.agentSpawner = new AgentSpawner(this);
    this.approvalSystem = approvalSystem || new CommanderApprovalSystem();
    this.setupApprovalListeners();
    this.initializeAgents();
    this.initializeCombos();
  }

  /**
   * Set up event listeners for approval system
   */
  private setupApprovalListeners(): void {
    this.approvalSystem.on('decision:approved', (decision) => {
      console.log(`✅ Decision approved: ${decision.id}`);
      this.executeApprovedDecision(decision);
    });

    this.approvalSystem.on('decision:rejected', (decision) => {
      console.log(`❌ Decision rejected: ${decision.id}`);
    });

    this.approvalSystem.on('alert:created', (alert) => {
      console.log(`🚨 ALERT: ${alert.message}`);
      this.handleAlert(alert);
    });
  }

  /**
   * Execute an approved decision from commander
   */
  private executeApprovedDecision(decision: any): void {
    switch (decision.type) {
      case 'SPAWN_NEW_AGENT':
        console.log(`🎉 Spawning new agent: ${decision.content.name}`);
        this.registerAgent(decision.content);
        break;
      case 'EVOLVE_AGENT':
        const { agentName, newLevel } = decision.content;
        const agent = this.agents.get(agentName);
        if (agent) {
          agent.level = newLevel;
          console.log(`📈 ${agentName} evolved to level ${newLevel}`);
        }
        break;
      case 'RETIRE_AGENT':
        this.agents.delete(decision.content.agentName);
        console.log(`👋 ${decision.content.agentName} retired`);
        break;
      case 'HIBERNATION_REQUEST':
        const hibernateAgent = this.agents.get(decision.content.agentName);
        if (hibernateAgent) {
          hibernateAgent.state = 'HIBERNATING';
          console.log(`💤 ${decision.content.agentName} is now hibernating`);
        }
        break;
    }
  }

  /**
   * Handle commander alerts
   */
  private handleAlert(alert: any): void {
    switch (alert.type) {
      case 'DRAWDOWN_THRESHOLD_EXCEEDED':
        console.log(`⚠️ Drawdown exceeded: ${alert.details.currentDrawdown}`);
        this.pauseAllAgents();
        break;
      case 'AGENT_ANOMALY_DETECTED':
        console.log(`⚠️ Agent anomaly: ${alert.details.agentName}`);
        break;
      case 'CONFLICT_BETWEEN_AGENTS':
        console.log(`⚠️ Agent conflict detected on ${alert.details.symbol}`);
        break;
      case 'SYSTEM_BEHAVIOR_ANOMALY':
        console.log(`⚠️ System anomaly detected - pausing all agents`);
        this.pauseAllAgents();
        break;
    }
  }

  /**
   * Propose spawning a new agent (routed through approval system)
   */
  proposeNewAgent(agent: any): void {
    this.approvalSystem.proposeDecision({
      type: 'SPAWN_NEW_AGENT',
      proposedBy: 'MARKET_SAGE',
      content: agent,
      confidence: 0.78,
      expectedImpact: {
        pnl: 1500,
        capital: 8000
      }
    });
  }

  /**
   * Propose evolving an agent to higher level
   */
  proposeAgentEvolution(agentName: string, newLevel: number, reason: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    this.approvalSystem.proposeDecision({
      type: 'EVOLVE_AGENT',
      proposedBy: agentName,
      content: { agentName, currentLevel: agent.level, newLevel, reason },
      confidence: 0.82,
      expectedImpact: {
        pnl: 300
      }
    });
  }

  /**
   * Propose retiring an agent
   */
  proposeAgentRetirement(agentName: string, reason: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    this.approvalSystem.proposeDecision({
      type: 'RETIRE_AGENT',
      proposedBy: agentName,
      content: { agentName, reason },
      confidence: 0.95,
      expectedImpact: {
        capital: 5000
      }
    });
  }

  /**
   * Propose hibernating an agent
   */
  proposeAgentHibernation(agentName: string, reason: string, duration: string): void {
    this.approvalSystem.proposeDecision({
      type: 'HIBERNATION_REQUEST',
      proposedBy: agentName,
      content: { agentName, reason, duration },
      confidence: 0.88,
      expectedImpact: {
        pnl: 0
      }
    });
  }

  /**
   * Get the approval system instance
   */
  getApprovalSystem(): CommanderApprovalSystem {
    return this.approvalSystem;
  }

  /**
   * Initialize commander system with autonomy level (Phase 6)
   */
  initializeCommanderSystem(autonomyLevel: 'HYBRID_OPTIMAL' | 'FULL_AUTONOMY' | 'FULL_MANUAL_CONTROL' = 'HYBRID_OPTIMAL'): void {
    switch (autonomyLevel) {
      case 'FULL_AUTONOMY':
        this.approvalSystem.setFullAutonomy();
        console.log('🤖 Commander system: FULL AUTONOMY (hands-off mode)');
        break;
      case 'FULL_MANUAL_CONTROL':
        this.approvalSystem.setFullManualControl();
        console.log('👤 Commander system: FULL MANUAL CONTROL (hands-on mode)');
        break;
      case 'HYBRID_OPTIMAL':
      default:
        this.approvalSystem.setHybridMode();
        console.log('⚖️ Commander system: HYBRID OPTIMAL (recommended)');
        break;
    }
  }

  /**
   * Get current autonomy configuration
   */
  getAutonomyConfig() {
    return this.approvalSystem.getAutonomyConfig();
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals() {
    return this.approvalSystem.getPendingDecisions();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.approvalSystem.getActiveAlerts();
  }

  /**
   * Pause all agents (emergency control)
   */
  pauseAllAgents(): void {
    this.agents.forEach(agent => {
      agent.state = 'HIBERNATING';
    });
    console.log('⏸️ All agents paused by commander');
  }

  /**
   * Resume all agents
   */
  resumeAllAgents(): void {
    this.agents.forEach(agent => {
      agent.state = 'ACTIVE';
    });
    console.log('▶️ All agents resumed by commander');
  }

  /**
   * Register an agent in the arena
   */
  registerAgent(agent: any): void {
    try {
      const name = agent?.name || `agent-${Date.now()}`;
      agent.name = name;
      this.agents.set(name, agent);
      console.log(`🎮 ${name} joined the arena!`);
    } catch (e) {
      console.warn('[AgentArena] Failed to register agent', e);
    }
  }

  /**
   * Forcefully retire and remove an agent from the arena
   */
  retireAgent(agentName: string): boolean {
    const agent = this.agents.get(agentName);
    if (!agent) return false;

    try {
      // Mark as retired for downstream consumers
      agent.state = 'RETIRED';

      // perform simple cleanup hooks if present
      if (typeof (agent as any).onRetire === 'function') {
        try { (agent as any).onRetire(); } catch (e) { /* ignore */ }
      }

      this.agents.delete(agentName);
      console.log(`👋 ${agentName} retired from the arena`);
      return true;
    } catch (e) {
      console.error(`Failed to retire agent ${agentName}:`, e);
      return false;
    }
  }

  /**
   * Get leaderboard sorted by performance
   */
  getLeaderboard(): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    this.agents.forEach(agent => {
      const status = agent.getStatus();
      entries.push({
        agent_name: agent.name,
        rank: status.rank,
        level: status.level,
        points: this.calculatePoints(agent),
        win_rate: status.stats.win_rate,
        profit_factor: status.stats.profit_factor,
        sharpe: status.stats.sharpe,
        total_profit: status.stats.total_profit
      });
    });

    // Sort by points descending
    return entries.sort((a, b) => b.points - a.points);
  }

  private calculatePoints(agent: TradingAgent): number {
    const status = agent.getStatus();

    // Points formula
    let points = 0;
    points += status.level * 100;
    points += status.stats.wins * 10;
    points += status.stats.total_profit;
    points += status.stats.sharpe * 500;
    points += status.achievements.length * 50;

    return Math.floor(points);
  }

  /**
   * Check if multiple agents agree on a signal (combo activation)
   */
  checkComboActivation(signals: Array<{ agent_name: string; confidence: number }>): AgentCombo | null {
    for (const combo of this.combos) {
      const participating_agents = signals.filter(s =>
        combo.agents.includes(s.agent_name) && s.confidence > 0.7
      );

      if (participating_agents.length >= combo.agents.length) {
        combo.times_activated += 1;
        console.log(`🌊 COMBO ACTIVATED: ${combo.name}! (+${(combo.bonus_multiplier * 100 - 100).toFixed(0)}% bonus)`);
        return combo;
      }
    }

    return null;
  }

  private initializeCombos(): void {
    // Expanded combo library to increase coverage of multi-agent synergies
    this.combos = [
      {
        name: 'Tsunami',
        agents: ['BREAKOUT_HUNTER', 'TREND_RIDER', 'ML_ORACLE'],
        activation_condition: 'All 3 agents agree with >70% confidence',
        bonus_multiplier: 1.25,
        historical_win_rate: 0.68,
        historical_profit_factor: 3.2,
        times_activated: 0
      },
      {
        name: 'Perfect Storm',
        agents: ['BREAKOUT_HUNTER', 'ML_ORACLE', 'SUPPORT_SNIPER', 'TREND_RIDER'],
        activation_condition: 'All 4 agents agree',
        bonus_multiplier: 1.5,
        historical_win_rate: 0.75,
        historical_profit_factor: 4.1,
        times_activated: 0
      },
      {
        name: 'Reversal Thunder',
        agents: ['REVERSAL_MASTER', 'SUPPORT_SNIPER'],
        activation_condition: 'Both agents detect mean reversion',
        bonus_multiplier: 1.15,
        historical_win_rate: 0.62,
        historical_profit_factor: 2.4,
        times_activated: 0
      },
      {
        name: 'Mean Reversion Pair',
        agents: ['REVERSAL_MASTER', 'ML_ORACLE'],
        activation_condition: 'ML and reversal both signal oversold/overbought',
        bonus_multiplier: 1.2,
        historical_win_rate: 0.66,
        historical_profit_factor: 2.8,
        times_activated: 0
      },
      {
        name: 'Momentum Surge',
        agents: ['TREND_RIDER', 'BREAKOUT_HUNTER'],
        activation_condition: 'Trend and breakout align with rising volume',
        bonus_multiplier: 1.3,
        historical_win_rate: 0.70,
        historical_profit_factor: 3.0,
        times_activated: 0
      },
      {
        name: 'Liquidity Sweep',
        agents: ['SUPPORT_SNIPER', 'VFMD_PHYSICS', 'FLOW_PHYSICS'],
        activation_condition: 'Support + flow/physics indicate liquidity takeout and follow-through',
        bonus_multiplier: 1.18,
        historical_win_rate: 0.64,
        historical_profit_factor: 2.5,
        times_activated: 0
      },
      {
        name: 'Stealth Accumulator',
        agents: ['ML_ORACLE', 'PY_STRATEGY_AGENT'],
        activation_condition: 'Low-vol accumulation pattern detected by ML and python strategy',
        bonus_multiplier: 1.22,
        historical_win_rate: 0.65,
        historical_profit_factor: 2.7,
        times_activated: 0
      },
      {
        name: 'Countertrend Duo',
        agents: ['REVERSAL_MASTER', 'SUPPORT_SNIPER'],
        activation_condition: 'Quick countertrend entry around strong support/resistance',
        bonus_multiplier: 1.12,
        historical_win_rate: 0.63,
        historical_profit_factor: 2.2,
        times_activated: 0
      },
      {
        name: 'Scalper Sync',
        agents: ['VFMD_PHYSICS', 'FLOW_PHYSICS', 'TREND_RIDER'],
        activation_condition: 'Micro-momentum confirmed across physics agents and trend rider',
        bonus_multiplier: 1.08,
        historical_win_rate: 0.58,
        historical_profit_factor: 1.8,
        times_activated: 0
      },
      {
        name: 'Volume Validated Breakout',
        agents: ['VOLUME_VERIFIER', 'BREAKOUT_HUNTER'],
        activation_condition: 'Breakout confirmed with volume surge (>1.5x avg volume)',
        bonus_multiplier: 1.35,
        historical_win_rate: 0.72,
        historical_profit_factor: 3.5,
        times_activated: 0
      },
      {
        name: 'Climax Reversal',
        agents: ['VOLUME_VERIFIER', 'REVERSAL_MASTER'],
        activation_condition: 'Extreme volume at price extremes signals exhaustion and reversal',
        bonus_multiplier: 1.40,
        historical_win_rate: 0.74,
        historical_profit_factor: 3.8,
        times_activated: 0
      },
      {
        name: 'Smart Money Flow',
        agents: ['VOLUME_VERIFIER', 'ML_ORACLE', 'SUPPORT_SNIPER'],
        activation_condition: 'Accumulation/distribution + smart money positioning + support/resistance',
        bonus_multiplier: 1.28,
        historical_win_rate: 0.70,
        historical_profit_factor: 3.2,
        times_activated: 0
      },
      {
        name: 'Volume Conviction Buy',
        agents: ['VOLUME_VERIFIER', 'TREND_RIDER', 'BREAKOUT_HUNTER'],
        activation_condition: 'High conviction buyers with volume support and trend alignment',
        bonus_multiplier: 1.32,
        historical_win_rate: 0.71,
        historical_profit_factor: 3.4,
        times_activated: 0
      },
      {
        name: 'Fakeout Guard',
        agents: ['VOLUME_VERIFIER', 'SUPPORT_SNIPER'],
        activation_condition: 'Detects and avoids fakeout traps - price break on weak volume',
        bonus_multiplier: 1.10,
        historical_win_rate: 0.68,
        historical_profit_factor: 2.1,
        times_activated: 0
      }
    ];
  }

  /**
   * Get all active combos
   */
  getCombos(): AgentCombo[] {
    return this.combos;
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): any | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAllAgents(): any[] {
    return Array.from(this.agents.values());
  }

  /**
   * Agent Spawning System (Level 25+ agents can create sub-agents)
   */
  spawnSubAgent(parentAgent: TradingAgent, specialization: string): TradingAgent | null {
    if (parentAgent.level < 25) {
      console.log(`❌ ${parentAgent.name} needs level 25+ to spawn (currently ${parentAgent.level})`);
      return null;
    }

    if (!parentAgent.abilities.includes('strategy_creation')) {
      console.log(`❌ ${parentAgent.name} hasn't unlocked strategy_creation ability yet`);
      return null;
    }

    // Create new agent with parent's DNA
    const subAgentName = `${parentAgent.name}_${specialization}_${Date.now()}`;

    // Inherit some parent skills
    const subAgent = new (parentAgent.constructor as any)(subAgentName);
    subAgent.skills = {
      pattern_recognition: Math.floor(parentAgent.skills.pattern_recognition * 0.7),
      timing_precision: Math.floor(parentAgent.skills.timing_precision * 0.7),
      risk_management: Math.floor(parentAgent.skills.risk_management * 0.7),
      exit_optimization: Math.floor(parentAgent.skills.exit_optimization * 0.7),
      regime_awareness: Math.floor(parentAgent.skills.regime_awareness * 0.7)
    };

    // Register in arena
    this.registerAgent(subAgent);

    console.log(`🎉 ${parentAgent.name} spawned ${subAgentName}!`);

    return subAgent;
  }

  /**
   * Agent Voting/Consensus Mechanism
   * Combines signals from multiple agents with weighted voting
   */
  generateConsensusSignal(signals: Array<{ agent: TradingAgent; signal: any }>): {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reasoning: string[];
    participating_agents: string[];
    combo_activated?: any;
  } | null {
    if (signals.length === 0) return null;

    let buy_score = 0;
    let sell_score = 0;
    const reasoning: string[] = [];
    const participating_agents: string[] = [];

    // Weighted voting based on agent performance
    for (const { agent, signal } of signals) {
      if (!signal) continue;

      const weight = this.calculateAgentWeight(agent);
      const vote_strength = signal.confidence * weight;

      if (signal.action === 'BUY') {
        buy_score += vote_strength;
        participating_agents.push(agent.name);
        reasoning.push(`${agent.name} (L${agent.level}): BUY ${(signal.confidence * 100).toFixed(0)}% - ${signal.reason}`);
      } else if (signal.action === 'SELL') {
        sell_score += vote_strength;
        participating_agents.push(agent.name);
        reasoning.push(`${agent.name} (L${agent.level}): SELL ${(signal.confidence * 100).toFixed(0)}% - ${signal.reason}`);
      }
    }

    // Determine consensus
    const total_score = buy_score + sell_score;
    if (total_score === 0) return null;

    const action = buy_score > sell_score ? 'BUY' : 'SELL';
    const confidence = Math.max(buy_score, sell_score) / total_score;

    // Check for combo activation
    const combo = this.checkComboActivation(
      signals.map(s => ({ agent_name: s.agent.name, confidence: s.signal?.confidence || 0 }))
    );

    return {
      action,
      confidence,
      reasoning,
      participating_agents,
      combo_activated: combo
    };
  }

  private calculateAgentWeight(agent: TradingAgent): number {
    // Weight = level bonus × performance bonus × rank bonus
    const level_bonus = 1 + (agent.level * 0.02); // +2% per level
    const performance_bonus = agent.win_rate > 0 ? agent.win_rate : 0.5;
    const rank_multiplier = {
      'Master': 2.0,
      'Diamond': 1.7,
      'Platinum': 1.4,
      'Gold': 1.2,
      'Silver': 1.0,
      'Bronze': 0.8
    }[agent.rank] || 1.0;

    return level_bonus * performance_bonus * rank_multiplier;
  }

  // Process incoming market data
  async processMarketData(data: any): Promise<void> {
    // Update market oracle with incoming snapshot and fetch enriched intel
    try {
      if (data && data.symbol) {
        this.marketOracle.updateMarketData(data.symbol, data);
      }
    } catch (e) {
      // ignore update errors
    }

    const marketIntel = data && data.symbol ? this.marketOracle.getMarketData(data.symbol) : null;

    // Distribute to all agents (agents may be heterogeneous)
    for (const agent of this.agents.values()) {
      try {
        if (typeof agent.analyze === 'function') {
          await agent.analyze(data, marketIntel);
        }
      } catch (e) {
        console.warn(`[AgentArena] agent analyze error for ${agent?.name}:`, e);
      }
    }
  }

  // Agent voting system for signal consensus
  async voteOnSignal(signal: any): Promise<{
    consensus: boolean;
    confidence: number;
    votes: { agent: string; vote: boolean; confidence: number }[];
    reasoning: string;
  }> {
    const votes: { agent: string; vote: boolean; confidence: number }[] = [];

    for (const agent of this.agents.values()) {
      // Only agents level 10+ can vote
      if (agent.level < 10) continue;

      const vote = await this.getAgentVote(agent, signal);
      votes.push({
        agent: agent.name,
        vote: vote.approve,
        confidence: vote.confidence
      });
    }

    // Calculate consensus (60% approval needed)
    const approvals = votes.filter(v => v.vote).length;
    const approvalRate = approvals / votes.length;
    const consensus = approvalRate >= 0.6;

    // Weighted confidence
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

    let reasoning = '';
    if (consensus) {
      reasoning = `${approvals}/${votes.length} agents approve (${(approvalRate * 100).toFixed(1)}%)`;
    } else {
      reasoning = `Insufficient consensus: ${approvals}/${votes.length} agents (need 60%)`;
    }

    return {
      consensus,
      confidence: avgConfidence,
      votes,
      reasoning
    };
  }

  private async getAgentVote(agent: any, signal: any): Promise<{ approve: boolean; confidence: number }> {
    // Agent votes based on its expertise and signal pattern
    const patternMatch = signal.pattern === agent.agentType;
    const confidenceThreshold = 0.65;

    const baseConfidence = patternMatch ? 0.8 : 0.5;
    const levelBonus = (agent.level / 100) * 0.2; // Up to +20%
    const winRateBonus = (agent.stats.winRate / 100) * 0.1; // Up to +10%

    const totalConfidence = Math.min(1, baseConfidence + levelBonus + winRateBonus);

    return {
      approve: totalConfidence >= confidenceThreshold,
      confidence: totalConfidence
    };
  }

  // Get voting power distribution
  getVotingPower(): { agent: string; level: number; winRate: number; votingPower: number }[] {
    return Array.from(this.agents.values())
      .filter(a => a.level >= 10)
      .map(agent => ({
        agent: agent.name,
        level: agent.level,
        winRate: agent.stats.winRate,
        votingPower: (agent.level / 100) + (agent.stats.winRate / 200) // Max 1.5
      }))
      .sort((a, b) => b.votingPower - a.votingPower);
  }
 

  /**
   * Record trade result for an agent
   */
  recordTrade(agentName: string, result: { win: boolean; profit: number }): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.recordTrade(result);

    // Check for newly unlocked achievements
    const newAchievements = this.achievementSystem.checkAchievements(agent);
    if (newAchievements.length > 0) {
      console.log(`🎊 ${agentName} unlocked ${newAchievements.length} new achievement(s)!`);
    }
  }

  // Get achievements for an agent
  getAgentAchievements(agentName: string) {
    return this.achievementSystem.getAgentAchievements(agentName);
  }

  // Get achievement leaderboard
  getAchievementLeaderboard() {
    return this.achievementSystem.getAchievementLeaderboard();
  }

  // Synergy system methods
  checkSynergies(activeAgents: TradingAgent[], signal: any) {
    return this.synergyDetector.checkForCombos(activeAgents, signal);
  }

  getSynergyStats() {
    return this.synergyDetector.getComboStats();
  }

  // Lifecycle management methods
  reviewAgentPerformance(agentName: string) {
    const agent = this.agents.get(agentName);
    if (!agent) return null;
    return this.lifecycleManager.reviewPerformance(agent);
  }

  putAgentOnProbation(agentName: string) {
    this.lifecycleManager.putOnProbation(agentName);
  }

  hibernateAgent(agentName: string, reason: string) {
    this.lifecycleManager.hibernateAgent(agentName, reason);
  }

  wakeAgent(agentName: string) {
    this.lifecycleManager.wakeAgent(agentName);
  }

  getTeamHealthReport() {
    return this.lifecycleManager.generateTeamReport(Array.from(this.agents.values()));
  }

  // Information channel methods
  subscribeAgentToChannel(agentName: string, channelType: any) {
    this.channelSystem.subscribe(agentName, channelType);
  }

  processMarketDataThroughChannels(marketData: any) {
    this.channelSystem.processMarketData(marketData);
  }

  getChannelStats() {
    return this.channelSystem.getChannelStats();
  }

  getChannelSystem() {
    return this.channelSystem;
  }

  // Market Sage methods
  async discoverNewStrategies() {
    return await this.marketSage.discoverPatterns(Array.from(this.agents.values()));
  }

  getDiscoveredPatterns() {
    return this.marketSage.getDiscoveredPatterns();
  }

  evolveStrategies(generation: number) {
    return this.marketSage.evolveStrategies(generation);
  }

  // Portfolio Manager methods
  allocateCapital() {
    return this.portfolioManager.allocateCapital(Array.from(this.agents.values()));
  }

  rebalancePortfolio() {
    return this.portfolioManager.rebalance(Array.from(this.agents.values()));
  }

  getPortfolioMetrics() {
    return this.portfolioManager.getPortfolioMetrics(Array.from(this.agents.values()));
  }

  getAgentAllocation(agentName: string) {
    return this.portfolioManager.getAllocation(agentName);
  }

  // Online Learning methods
  recordLearningExperience(agentName: string, state: any, action: any, reward: number, nextState: any) {
    const agent = this.agents.get(agentName);
    if (!agent) return;
    // Record experience into the learning system
    this.learningSystem.recordExperience(agent, state, action, reward, nextState);
  }
  /**
   * Auto-manage team composition based on market regime
   */
  autoManageTeam(marketRegime: MarketRegime): {
    spawned: TradingAgent[];
    retired: string[];
    decisions: SpawnDecision[];
  } {
    this.currentRegime = marketRegime;
    
    // Update volume agent regime awareness for threshold adjustments
    if (this.volumeAgent) {
      const regimeForVolume = marketRegime === 'TRENDING' ? 'trending' : 'ranging';
      this.volumeAgent.setRegime(regimeForVolume);
    }
    
    // Analyze what the team needs
    const decisions = this.agentSpawner.analyzeTeamNeeds(marketRegime);
    
    // Execute top priority spawns (max 2 per cycle)
    const spawned: TradingAgent[] = [];
    const topDecisions = decisions.filter(d => d.shouldSpawn).slice(0, 2);
    
    topDecisions.forEach(decision => {
      const agent = this.agentSpawner.spawnAgent(decision);
      spawned.push(agent);
    });
    
    // Retire underperformers
    const retired = this.agentSpawner.retireUnderperformers();
    
    console.log(`🎮 Team auto-management: spawned ${spawned.length}, retired ${retired.length}`);
    
    return { spawned, retired, decisions };
  }

  /**
   * Get team composition analysis
   */
  getTeamAnalysis(): {
    totalAgents: number;
    byType: Record<string, number>;
    avgLevel: number;
    avgWinRate: number;
    needsAttention: boolean;
    recommendations: string[];
  } {
    const agents = this.getAllAgents();
    const byType: Record<string, number> = {};
    
    let totalLevel = 0;
    let totalWinRate = 0;
    let tradesCount = 0;
    
    agents.forEach(agent => {
      byType[agent.agent_type] = (byType[agent.agent_type] || 0) + 1;
      totalLevel += agent.level;
      if (agent.trades > 0) {
        totalWinRate += agent.win_rate;
        tradesCount += 1;
      }
    });
    
    const avgLevel = agents.length > 0 ? totalLevel / agents.length : 0;
    const avgWinRate = tradesCount > 0 ? totalWinRate / tradesCount : 0;
    
    const recommendations: string[] = [];
    const needsAttention = avgWinRate < 0.50 || agents.length < 3;
    
    if (agents.length < 3) {
      recommendations.push('Team too small - spawn more agents');
    }
    if (avgWinRate < 0.50) {
      recommendations.push('Low team win rate - consider regime shift or retraining');
    }
    if (Object.keys(byType).length < 3) {
      recommendations.push('Low diversity - spawn different agent types');
    }
    
    return {
      totalAgents: agents.length,
      byType,
      avgLevel: Math.round(avgLevel * 10) / 10,
      avgWinRate: Math.round(avgWinRate * 1000) / 1000,
      needsAttention,
      recommendations
    };
  }

  getCurrentRegime(): MarketRegime {
    return this.currentRegime;
  }
  getOptimalAction(agentName: string, state: any) {
    const agent = this.agents.get(agentName);
    if (!agent) return null;
    return this.learningSystem.getOptimalAction(agent, state);
  }

  getLearningMetrics(agentName: string) {
    const agent = this.agents.get(agentName);
    if (!agent) return null;
    return this.learningSystem.getLearningMetrics(agent);
  }

  replayExperiences() {
    this.learningSystem.replayExperiences(32);
  }

  // New method to get recent activities for the live feed
  getRecentActivities(limit: number = 20) {
    // Collect recent activities from all agents
    const activities: any[] = [];

    this.agents.forEach((agent: any) => {
      // Recent trades
      const recentTrades = agent.tradeHistory?.slice(-5) || [];
      recentTrades.forEach((trade: any) => {
        activities.push({
          timestamp: trade.timestamp || Date.now(),
          agent: agent.name,
          action: trade.profit > 0 ? `Closed ${trade.symbol} trade` : `Stopped out of ${trade.symbol}`,
          result: trade.profit > 0 ? `+${(trade.profit * 100).toFixed(1)}%` : `${(trade.profit * 100).toFixed(1)}%`,
          type: trade.profit > 0 ? 'win' : 'loss'
        });
      });

      // Status changes
      if (agent.state === 'HIBERNATING') {
        activities.push({
          timestamp: Date.now(),
          agent: agent.name,
          action: 'Entered hibernation',
          result: 'Resting',
          type: 'status'
        });
      } else if (agent.state === 'ACTIVE') {
        activities.push({
          timestamp: Date.now(),
          agent: agent.name,
          action: 'Active and hunting',
          result: 'Ready',
          type: 'active'
        });
      }
    });

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(a => ({
        ...a,
        time: this.formatTimeAgo(a.timestamp)
      }));
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds} sec ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

    // Add a placeholder for initializeAgents if it's not defined elsewhere
  private async initializeAgents(): Promise<void> {
    // Create and register the standard set of agents used across the system.
    // Wrap each registration in try/catch to avoid failing startup if a specialist has issues.
    console.log('Initializing default agents...');

    try {
      const brk = new (require('./BreakoutHunter').BreakoutHunter)('BREAKOUT_HUNTER');
      this.registerAgent(brk);
    } catch (err) {
      console.warn('Failed to register BreakoutHunter in arena initializeAgents', err);
    }

    try {
      const trend = new TrendRider('TREND_RIDER');
      this.registerAgent(trend);
    } catch (err) {
      console.warn('Failed to register TrendRider', err);
    }

    try {
      const support = new SupportSniper('SUPPORT_SNIPER');
      this.registerAgent(support);
    } catch (err) {
      console.warn('Failed to register SupportSniper', err);
    }

    try {
      const rev = new ReversalMaster('REVERSAL_MASTER');
      this.registerAgent(rev);
    } catch (err) {
      console.warn('Failed to register ReversalMaster', err);
    }

    try {
      // Volume agent: System-wide truth verifier with regime awareness
      const regimeForVolume = this.currentRegime === 'TRENDING' ? 'trending' : 'ranging';
      this.volumeAgent = new VolumeMechanicalVerifierAgent('VOLUME_VERIFIER', 'balanced', regimeForVolume);
      this.registerAgent(this.volumeAgent);
    } catch (err) {
      console.warn('Failed to register VolumeMechanicalVerifierAgent', err);
    }

    try {
      // physics agents
      const vfmd = new VFMDPhysicsAgent('VFMD_PHYSICS');
      this.registerAgent(vfmd);
    } catch (err) {
      console.warn('Failed to register VFMDPhysicsAgent', err);
    }

    try {
      const flow = new FlowPhysicsAgent('FLOW_PHYSICS');
      this.registerAgent(flow);
    } catch (err) {
      console.warn('Failed to register FlowPhysicsAgent', err);
    }

    try {
      // Register a default set of Python-strategy-derived agents
      const { createAgentFromPythonStrategy } = await import('./PythonStrategyAgent');
      this.registerAgent(createAgentFromPythonStrategy('gradient_trend'));
      this.registerAgent(createAgentFromPythonStrategy('ut_bot'));
      this.registerAgent(createAgentFromPythonStrategy('mean_reversion'));
      this.registerAgent(createAgentFromPythonStrategy('volume_profile'));
    } catch (err) {
      console.warn('Failed to register PythonStrategyAgent(s)', err);
    }

    try {
      const ml = new MLOracle('ML_ORACLE');
      this.registerAgent(ml);
    } catch (err) {
      console.warn('Failed to register MLOracle', err);
    }

    // Keep generic TradingAgent registrations optional elsewhere if needed
  }
}