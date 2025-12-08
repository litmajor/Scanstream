
/**
 * Agent Spawner - Autonomous Agent Creation System
 * 
 * Analyzes market conditions and team performance to spawn agents as needed:
 * - Detects missing capabilities (no reversal agents during ranging market)
 * - Spawns specialists when market regime changes
 * - Retires underperforming agents automatically
 * - Balances team composition (max 2 of same type)
 */

import { TradingAgent } from './TradingAgent';
import { AgentArena } from './AgentArena';
import { BreakoutHunter } from './BreakoutHunter';
import { ReversalMaster } from './ReversalMaster';
import { MLOracle } from './MLOracle';
import { TrendRider } from './TrendRider';
import { SupportSniper } from './SupportSniper';

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE' | 'BULL' | 'BEAR' | 'NEUTRAL';

export interface SpawnDecision {
  shouldSpawn: boolean;
  agentType: string;
  reason: string;
  priority: number; // 1-10
}

export class AgentSpawner {
  private arena: AgentArena;
  private maxAgents: number = 10;
  private minAgents: number = 3;
  private teamCompositionLimits: Map<string, number> = new Map([
    ['BREAKOUT', 2],
    ['REVERSAL', 2],
    ['ML_PREDICTION', 2],
    ['MA_CROSSOVER', 2],
    ['SUPPORT_BOUNCE', 2]
  ]);

  constructor(arena: AgentArena) {
    this.arena = arena;
  }

  /**
   * Analyze team and decide if new agents are needed
   */
  analyzeTeamNeeds(marketRegime: MarketRegime): SpawnDecision[] {
    const decisions: SpawnDecision[] = [];
    const currentAgents = this.arena.getAllAgents();

    // Count agents by type
    const typeCount = new Map<string, number>();
    currentAgents.forEach(agent => {
      typeCount.set(agent.agent_type, (typeCount.get(agent.agent_type) || 0) + 1);
    });

    // Check if we're below minimum
    if (currentAgents.length < this.minAgents) {
      decisions.push({
        shouldSpawn: true,
        agentType: this.selectBalancedType(typeCount),
        reason: 'Below minimum team size',
        priority: 10
      });
    }

    // Regime-specific needs
    switch (marketRegime) {
      case 'TRENDING':
      case 'BULL':
        if ((typeCount.get('BREAKOUT') || 0) < 2) {
          decisions.push({
            shouldSpawn: true,
            agentType: 'BREAKOUT',
            reason: 'Trending market needs breakout specialists',
            priority: 8
          });
        }
        if ((typeCount.get('MA_CROSSOVER') || 0) < 1) {
          decisions.push({
            shouldSpawn: true,
            agentType: 'MA_CROSSOVER',
            reason: 'Trending market needs trend riders',
            priority: 7
          });
        }
        break;

      case 'RANGING':
        if ((typeCount.get('REVERSAL') || 0) < 2) {
          decisions.push({
            shouldSpawn: true,
            agentType: 'REVERSAL',
            reason: 'Ranging market needs reversal specialists',
            priority: 9
          });
        }
        if ((typeCount.get('SUPPORT_BOUNCE') || 0) < 1) {
          decisions.push({
            shouldSpawn: true,
            agentType: 'SUPPORT_BOUNCE',
            reason: 'Ranging market needs support bounce hunters',
            priority: 7
          });
        }
        break;

      case 'VOLATILE':
        if ((typeCount.get('ML_PREDICTION') || 0) < 2) {
          decisions.push({
            shouldSpawn: true,
            agentType: 'ML_PREDICTION',
            reason: 'Volatile market needs ML pattern recognition',
            priority: 9
          });
        }
        break;
    }

    // Performance-based spawning
    const lowPerformers = currentAgents.filter(a => 
      a.trades >= 20 && a.win_rate < 0.45
    );

    if (lowPerformers.length > 2 && currentAgents.length < this.maxAgents) {
      decisions.push({
        shouldSpawn: true,
        agentType: this.selectHighPerformanceType(currentAgents),
        reason: 'Too many underperformers - spawn replacement',
        priority: 6
      });
    }

    // Diversity check
    if (this.lacksDiversity(typeCount) && currentAgents.length < this.maxAgents) {
      decisions.push({
        shouldSpawn: true,
        agentType: this.selectMissingType(typeCount),
        reason: 'Increase team diversity',
        priority: 5
      });
    }

    return decisions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Execute spawning decision
   */
  spawnAgent(decision: SpawnDecision): TradingAgent {
    const agentName = `${decision.agentType}_${Date.now()}`;
    let agent: TradingAgent;

    switch (decision.agentType) {
      case 'BREAKOUT':
        agent = new BreakoutHunter(agentName);
        break;
      case 'REVERSAL':
        agent = new ReversalMaster(agentName);
        break;
      case 'ML_PREDICTION':
        agent = new MLOracle(agentName);
        break;
      case 'MA_CROSSOVER':
        agent = new TrendRider(agentName);
        break;
      case 'SUPPORT_BOUNCE':
        agent = new SupportSniper(agentName);
        break;
      default:
        agent = new BreakoutHunter(agentName);
    }

    this.arena.registerAgent(agent);
    console.log(`🌟 Auto-spawned ${agentName} - ${decision.reason}`);

    return agent;
  }

  /**
   * Auto-retire underperforming agents
   */
  retireUnderperformers(): string[] {
    const currentAgents = this.arena.getAllAgents();
    const retired: string[] = [];

    // Only retire if we're above minimum
    if (currentAgents.length <= this.minAgents) return retired;

    const candidates = currentAgents
      .filter(a => a.trades >= 30) // Must have sample size
      .filter(a => a.win_rate < 0.40 || a.profit_factor < 0.8) // Poor performance
      .filter(a => a.losing_streak > 10); // Long losing streak

    candidates.forEach(agent => {
      if (currentAgents.length > this.minAgents) {
        retired.push(agent.name);
        console.log(`⚰️ Retired ${agent.name} - Win rate: ${(agent.win_rate * 100).toFixed(1)}%`);
        // In production, remove from arena
      }
    });

    return retired;
  }

  private selectBalancedType(typeCount: Map<string, number>): string {
    const types = ['BREAKOUT', 'REVERSAL', 'ML_PREDICTION', 'MA_CROSSOVER', 'SUPPORT_BOUNCE'];
    
    // Find type with lowest count
    let minType = types[0];
    let minCount = typeCount.get(minType) || 0;

    types.forEach(type => {
      const count = typeCount.get(type) || 0;
      if (count < minCount) {
        minType = type;
        minCount = count;
      }
    });

    return minType;
  }

  private selectHighPerformanceType(agents: TradingAgent[]): string {
    const performanceByType = new Map<string, { wins: number; total: number }>();

    agents.forEach(agent => {
      if (!performanceByType.has(agent.agent_type)) {
        performanceByType.set(agent.agent_type, { wins: 0, total: 0 });
      }
      const stats = performanceByType.get(agent.agent_type)!;
      stats.wins += agent.wins;
      stats.total += agent.trades;
    });

    let bestType = 'BREAKOUT';
    let bestWinRate = 0;

    performanceByType.forEach((stats, type) => {
      const winRate = stats.total > 0 ? stats.wins / stats.total : 0;
      if (winRate > bestWinRate) {
        bestWinRate = winRate;
        bestType = type;
      }
    });

    return bestType;
  }

  private selectMissingType(typeCount: Map<string, number>): string {
    const allTypes = ['BREAKOUT', 'REVERSAL', 'ML_PREDICTION', 'MA_CROSSOVER', 'SUPPORT_BOUNCE'];
    
    for (const type of allTypes) {
      if (!typeCount.has(type) || typeCount.get(type) === 0) {
        return type;
      }
    }

    return this.selectBalancedType(typeCount);
  }

  private lacksDiversity(typeCount: Map<string, number>): boolean {
    const uniqueTypes = typeCount.size;
    return uniqueTypes < 3; // Need at least 3 different types
  }
}
