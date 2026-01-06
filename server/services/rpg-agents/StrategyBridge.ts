/**
 * Strategy Bridge
 * 
 * Integrates Python strategies with RPG Agent system:
 * 1. Converts Python strategy signals to RPG agent format
 * 2. Feeds RPG agent results back to StrategyCoordinator
 * 3. Syncs with Bayesian Belief Updater for weight adjustments
 */

import { getMarketOracle } from './MarketOracle.ts';
import { AgentArena } from './AgentArena.ts';
import { BreakoutHunter } from './BreakoutHunter.ts';
import { ReversalMaster } from './ReversalMaster.ts';
import { MLOracle } from './MLOracle.ts';
import { TrendRider } from './TrendRider.ts';
import { SupportSniper } from './SupportSniper.ts';

import { createAgentFromPythonStrategy } from './PythonStrategyAgent.ts';

export class StrategyBridge {
  private arena: AgentArena | null = null;
  private gatewayAggregator: any;
  private initialized: boolean = false;
  
  constructor(gatewayAggregator?: any, arena?: AgentArena) {
    this.arena = arena || null;
    this.gatewayAggregator = gatewayAggregator;
    
    // Initialize Market Oracle with Gateway
    if (gatewayAggregator) {
      getMarketOracle().initialize(gatewayAggregator);
    }
    
    // Only initialize agents if arena is provided
    if (this.arena) {
      this.initializeAgents();
    }
  }
  
  /**
   * Set arena and initialize agents if not already done
   */
  setArena(arena: AgentArena): void {
    if (!this.arena && !this.initialized) {
      this.arena = arena;
      this.initializeAgents();
    }
  }
  
  private initializeAgents(): void {
    if (!this.arena || this.initialized) return;
    
    // Native TypeScript RPG agents
    this.arena.registerAgent(new BreakoutHunter('BREAKOUT_HUNTER'));
    this.arena.registerAgent(new ReversalMaster('REVERSAL_MASTER'));
    this.arena.registerAgent(new MLOracle('ML_ORACLE'));
    this.arena.registerAgent(new TrendRider('TREND_RIDER'));
    this.arena.registerAgent(new SupportSniper('SUPPORT_SNIPER'));
    
    // Python strategy agents (inheriting Python traits)
    this.arena.registerAgent(createAgentFromPythonStrategy('gradient_trend'));
    this.arena.registerAgent(createAgentFromPythonStrategy('ut_bot'));
    this.arena.registerAgent(createAgentFromPythonStrategy('mean_reversion'));
    this.arena.registerAgent(createAgentFromPythonStrategy('volume_profile'));
    
    this.initialized = true;
    console.log('[Strategy Bridge] Initialized 9 RPG agents (5 native + 4 Python-trait)');
  }
  
  /**
   * Process market data and get RPG agent signals
   */
  async processMarketData(marketData: any): Promise<any> {
    if (!this.arena) {
      return { error: 'Arena not initialized' };
    }
    
    // Update Market Oracle
    getMarketOracle().updateMarketData(marketData.symbol, marketData);
    
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
    if (!this.arena) return;
    
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
    if (!this.arena) return [];
    return this.arena.getLeaderboard();
  }
  
  /**
   * Get combos for UI
   */
  getCombos() {
    if (!this.arena) return [];
    return this.arena.getCombos();
  }
  
  /**
   * Get data formatted for Bayesian Belief Updater
   */
  getWeightsForBayesian(): Record<string, number> {
    const weights: Record<string, number> = {};
    
    if (!this.arena) return weights;
    
    for (const agent of this.arena.getAllAgents()) {
      const status = agent.getStatus();
      // Weight based on performance
      weights[agent.name] = status.stats.win_rate * status.confidence;
    }
    
    return weights;
  }
}

let _strategyBridgeInstance: StrategyBridge | null = null;

export function getStrategyBridge(): StrategyBridge {
  if (!_strategyBridgeInstance) {
    _strategyBridgeInstance = new StrategyBridge();
  }
  return _strategyBridgeInstance;
}

// For backward compatibility
export const strategyBridge = { get instance() { return getStrategyBridge(); } };
