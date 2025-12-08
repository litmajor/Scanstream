
/**
 * Agent Portfolio Manager
 * 
 * Manages individual capital allocation per agent based on:
 * - Performance metrics (Sharpe, win rate, profit factor)
 * - Risk-adjusted returns
 * - Correlation between agents
 * - Kelly Criterion optimization
 * - Drawdown limits
 */

import { TradingAgent } from './TradingAgent';

export interface AgentAllocation {
  agent_name: string;
  capital_allocated: number;
  allocation_percentage: number;
  max_position_size: number;
  risk_limit: number;
  reason: string;
}

export interface PortfolioMetrics {
  total_capital: number;
  allocated_capital: number;
  reserved_capital: number;
  portfolio_sharpe: number;
  portfolio_correlation: number;
  diversification_score: number;
}

export class AgentPortfolioManager {
  private totalCapital: number;
  private minAllocationPct: number = 0.05;  // 5% minimum
  private maxAllocationPct: number = 0.30;  // 30% maximum
  private reserveCapitalPct: number = 0.20;  // 20% reserve

  private allocations: Map<string, AgentAllocation> = new Map();

  constructor(totalCapital: number) {
    this.totalCapital = totalCapital;
  }

  /**
   * Calculate optimal capital allocation using Kelly Criterion + Risk Parity
   */
  allocateCapital(agents: TradingAgent[]): AgentAllocation[] {
    const eligibleAgents = agents.filter(a => 
      a.trades >= 20 && 
      a.win_rate > 0.5 && 
      a.profit_factor > 1.0
    );

    if (eligibleAgents.length === 0) {
      console.log('⚠️ No eligible agents for capital allocation');
      return [];
    }

    // Calculate Kelly percentages
    const kellyAllocations = eligibleAgents.map(agent => ({
      agent,
      kelly_pct: this.calculateKelly(agent)
    }));

    // Normalize to fit within total capital (minus reserve)
    const availableCapital = this.totalCapital * (1 - this.reserveCapitalPct);
    const totalKelly = kellyAllocations.reduce((sum, a) => sum + a.kelly_pct, 0);

    const allocations: AgentAllocation[] = kellyAllocations.map(({ agent, kelly_pct }) => {
      const normalizedPct = (kelly_pct / totalKelly) * (1 - this.reserveCapitalPct);
      const cappedPct = Math.min(Math.max(normalizedPct, this.minAllocationPct), this.maxAllocationPct);
      const allocatedCapital = this.totalCapital * cappedPct;

      return {
        agent_name: agent.name,
        capital_allocated: allocatedCapital,
        allocation_percentage: cappedPct,
        max_position_size: allocatedCapital * 0.2,  // 20% of agent capital per trade
        risk_limit: allocatedCapital * 0.15,  // 15% max drawdown
        reason: this.getAllocationReason(agent, kelly_pct, cappedPct)
      };
    });

    // Store allocations
    allocations.forEach(alloc => {
      this.allocations.set(alloc.agent_name, alloc);
    });

    console.log(`💰 Portfolio Manager allocated capital to ${allocations.length} agents`);
    this.logAllocationSummary(allocations);

    return allocations;
  }

  private calculateKelly(agent: TradingAgent): number {
    const winRate = agent.win_rate;
    const lossRate = 1 - winRate;

    // Calculate average win/loss sizes
    const wins = agent.recent_trades.filter(t => t.profit > 0);
    const losses = agent.recent_trades.filter(t => t.profit < 0);

    if (wins.length === 0 || losses.length === 0) return 0.05;

    const avgWin = wins.reduce((sum, t) => sum + t.profit_pct, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit_pct, 0) / losses.length);

    if (avgLoss === 0) return 0.05;

    // Kelly formula: (p * b - q) / b
    // where p = win rate, q = loss rate, b = win/loss ratio
    const winLossRatio = avgWin / avgLoss;
    const kelly = (winRate * winLossRatio - lossRate) / winLossRatio;

    // Apply fractional Kelly (50% of full Kelly for safety)
    const fractionalKelly = Math.max(0, Math.min(kelly * 0.5, 0.3));

    return fractionalKelly;
  }

  private getAllocationReason(agent: TradingAgent, kelly: number, allocated: number): string {
    const reasons: string[] = [];

    if (agent.sharpe > 2.0) reasons.push('High Sharpe ratio');
    if (agent.win_rate > 0.65) reasons.push('Strong win rate');
    if (agent.profit_factor > 2.5) reasons.push('Excellent profit factor');
    if (agent.level >= 20) reasons.push('Experienced agent');
    if (allocated === this.maxAllocationPct) reasons.push('Capped at maximum');
    if (allocated === this.minAllocationPct) reasons.push('Minimum allocation');

    return reasons.length > 0 ? reasons.join(', ') : 'Standard allocation';
  }

  /**
   * Risk parity adjustment based on correlation
   */
  adjustForCorrelation(agents: TradingAgent[]): void {
    // Reduce allocation if agents are highly correlated
    const correlationMatrix = this.calculateCorrelationMatrix(agents);

    agents.forEach((agent, i) => {
      const allocation = this.allocations.get(agent.name);
      if (!allocation) return;

      let totalCorrelation = 0;
      agents.forEach((otherAgent, j) => {
        if (i !== j) {
          totalCorrelation += Math.abs(correlationMatrix[i][j]);
        }
      });

      const avgCorrelation = totalCorrelation / (agents.length - 1);

      // Reduce allocation if high correlation
      if (avgCorrelation > 0.7) {
        allocation.capital_allocated *= 0.8;  // 20% reduction
        allocation.allocation_percentage *= 0.8;
        allocation.reason += ', High correlation penalty';
        this.allocations.set(agent.name, allocation);
      }
    });
  }

  private calculateCorrelationMatrix(agents: TradingAgent[]): number[][] {
    const matrix: number[][] = [];

    agents.forEach((agent1, i) => {
      matrix[i] = [];
      agents.forEach((agent2, j) => {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          // Simplified correlation based on agent type
          const correlation = agent1.agent_type === agent2.agent_type ? 0.6 : 0.2;
          matrix[i][j] = correlation;
        }
      });
    });

    return matrix;
  }

  /**
   * Dynamic rebalancing based on performance
   */
  rebalance(agents: TradingAgent[]): AgentAllocation[] {
    console.log('🔄 Rebalancing portfolio based on recent performance...');

    // Reduce allocation for underperforming agents
    agents.forEach(agent => {
      const allocation = this.allocations.get(agent.name);
      if (!allocation) return;

      // Check recent performance (last 20 trades)
      const recentTrades = agent.recent_trades.slice(-20);
      if (recentTrades.length < 20) return;

      const recentWinRate = recentTrades.filter(t => t.profit > 0).length / recentTrades.length;

      if (recentWinRate < 0.45) {
        // Poor recent performance - reduce allocation by 30%
        allocation.capital_allocated *= 0.7;
        allocation.allocation_percentage *= 0.7;
        allocation.reason += ', Reduced due to recent underperformance';
        this.allocations.set(agent.name, allocation);
        console.log(`⬇️ Reduced ${agent.name} allocation due to ${(recentWinRate * 100).toFixed(1)}% recent win rate`);
      } else if (recentWinRate > 0.65) {
        // Strong recent performance - increase allocation by 20%
        const newAllocation = allocation.capital_allocated * 1.2;
        const newPct = newAllocation / this.totalCapital;
        
        if (newPct <= this.maxAllocationPct) {
          allocation.capital_allocated = newAllocation;
          allocation.allocation_percentage = newPct;
          allocation.reason += ', Increased due to strong performance';
          this.allocations.set(agent.name, allocation);
          console.log(`⬆️ Increased ${agent.name} allocation due to ${(recentWinRate * 100).toFixed(1)}% recent win rate`);
        }
      }
    });

    return Array.from(this.allocations.values());
  }

  /**
   * Get portfolio metrics
   */
  getPortfolioMetrics(agents: TradingAgent[]): PortfolioMetrics {
    const allocations = Array.from(this.allocations.values());
    const totalAllocated = allocations.reduce((sum, a) => sum + a.capital_allocated, 0);

    // Calculate portfolio Sharpe (weighted average)
    const portfolioSharpe = allocations.reduce((sum, alloc) => {
      const agent = agents.find(a => a.name === alloc.agent_name);
      if (!agent) return sum;
      return sum + (agent.sharpe * alloc.allocation_percentage);
    }, 0);

    return {
      total_capital: this.totalCapital,
      allocated_capital: totalAllocated,
      reserved_capital: this.totalCapital - totalAllocated,
      portfolio_sharpe: portfolioSharpe,
      portfolio_correlation: 0.3,  // Simplified
      diversification_score: allocations.length / 10  // More agents = better diversification
    };
  }

  private logAllocationSummary(allocations: AgentAllocation[]): void {
    console.log('\n📊 Capital Allocation Summary:');
    console.log('─'.repeat(80));
    allocations.forEach(alloc => {
      console.log(`${alloc.agent_name.padEnd(25)} $${alloc.capital_allocated.toFixed(0).padStart(10)} (${(alloc.allocation_percentage * 100).toFixed(1)}%)`);
    });
    console.log('─'.repeat(80));
  }

  getAllocation(agentName: string): AgentAllocation | undefined {
    return this.allocations.get(agentName);
  }

  getAllAllocations(): AgentAllocation[] {
    return Array.from(this.allocations.values());
  }
}
