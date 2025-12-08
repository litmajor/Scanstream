import { TradingAgent } from './TradingAgent';
import { MarketOracle } from './MarketOracle';
import { StrategyBridge } from './StrategyBridge';
import { AchievementSystem } from './AchievementSystem';

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
  private agents: Map<string, TradingAgent> = new Map();
  private combos: AgentCombo[] = [];
  private marketOracle: MarketOracle;
  private strategyBridge: StrategyBridge;
  private achievementSystem: AchievementSystem;

  constructor() {
    this.marketOracle = new MarketOracle();
    this.strategyBridge = new StrategyBridge();
    this.achievementSystem = new AchievementSystem();
    this.initializeAgents();
  }

  /**
   * Register an agent in the arena
   */
  registerAgent(agent: TradingAgent): void {
    this.agents.set(agent.name, agent);
    console.log(`🎮 ${agent.name} joined the arena!`);
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
  getAgent(name: string): TradingAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAllAgents(): TradingAgent[] {
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
    const marketIntel = await this.marketOracle.analyzeMarket(data);

    // Distribute to all agents
    for (const agent of this.agents.values()) {
      await agent.analyze(data, marketIntel);
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
   * Get all active combos
   */
  getCombos(): AgentCombo[] {
    return this.combos;
  }

  /**
   * Get agent by name
   */
  getAgent(name: string): TradingAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAllAgents(): TradingAgent[] {
    return Array.from(this.agents.values());
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
}