
/**
 * Strategy Bridge
 * 
 * Integrates Python strategies with RPG Agent system:
 * 1. Converts Python strategy signals to RPG agent format
 * 2. Feeds RPG agent results back to StrategyCoordinator
 * 3. Syncs with Bayesian Belief Updater for weight adjustments
 */

import { marketOracle } from './MarketOracle';
import { AgentArena } from './AgentArena';
import { BreakoutHunter } from './BreakoutHunter';
import { ReversalMaster } from './ReversalMaster';
import { MLOracle } from './MLOracle';
import { TrendRider } from './TrendRider';
import { SupportSniper } from './SupportSniper';

export class StrategyBridge {
  private arena: AgentArena;
  
  constructor() {
    this.arena = new AgentArena();
    this.initializeAgents();
  }
  
  private initializeAgents(): void {
    // Create RPG agents
    this.arena.registerAgent(new BreakoutHunter('BREAKOUT_HUNTER'));
    this.arena.registerAgent(new ReversalMaster('REVERSAL_MASTER'));
    this.arena.registerAgent(new MLOracle('ML_ORACLE'));
    this.arena.registerAgent(new TrendRider('TREND_RIDER'));
    this.arena.registerAgent(new SupportSniper('SUPPORT_SNIPER'));
    
    console.log('[Strategy Bridge] Initialized 5 RPG agents');
  }
  
  /**
   * Process market data and get RPG agent signals
   */
  async processMarketData(marketData: any): Promise<any> {
    // Update Market Oracle
    marketOracle.updateMarketData(marketData.symbol, marketData);
    
    // Get signals from all agents
    const agentSignals = [];
    
    for (const agent of this.arena.getAllAgents()) {
      const signal = agent.processSignal(marketData);
      if (signal) {
        agentSignals.push({ agent, signal });
      }
    }
    
    // Generate consensus
    const consensus = this.arena.generateConsensusSignal(agentSignals);
    
    return {
      consensus,
      individual_signals: agentSignals,
      agents_status: this.arena.getAllAgents().map(a => a.getStatus())
    };
  }
  
  /**
   * Update agent performance after trade closes
   */
  updateAgentPerformance(agentName: string, tradeResult: any): void {
    const agent = this.arena.getAgent(agentName);
    if (!agent) return;
    
    agent.updatePerformance({
      profit: tradeResult.profit,
      profit_pct: tradeResult.profit_pct,
      market_difficulty: tradeResult.market_difficulty || 1.0,
      execution_quality: tradeResult.execution_quality || 0.8,
      regime: tradeResult.regime || 'NEUTRAL',
      duration_hours: tradeResult.duration_hours || 24
    });
  }
  
  /**
   * Get leaderboard for UI
   */
  getLeaderboard() {
    return this.arena.getLeaderboard();
  }
  
  /**
   * Get combos for UI
   */
  getCombos() {
    return this.arena.getCombos();
  }
  
  /**
   * Get data formatted for Bayesian Belief Updater
   */
  getWeightsForBayesian(): Record<string, number> {
    const weights: Record<string, number> = {};
    
    for (const agent of this.arena.getAllAgents()) {
      const status = agent.getStatus();
      // Weight based on performance
      weights[agent.name] = status.stats.win_rate * status.confidence;
    }
    
    return weights;
  }
}

export const strategyBridge = new StrategyBridge();
