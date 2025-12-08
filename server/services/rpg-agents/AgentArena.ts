
import { TradingAgent } from './TradingAgent';

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
  
  constructor() {
    // Initialize special combos
    this.initializeCombos();
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
}
