
/**
 * Online Learning System
 * 
 * Continuous learning and adaptation for RPG agents:
 * - Real-time performance tracking
 * - Experience replay buffer
 * - Q-learning for strategy optimization
 * - Adaptive parameter tuning
 * - Pattern recognition learning
 */

import { TradingAgent, TradeResult } from './TradingAgent';
import { VolumeMechanicalVerifierAgent } from './VolumeMechanicalVerifierAgent';

export interface ExperienceMemory {
  state: MarketState;
  action: TradeAction;
  reward: number;
  next_state: MarketState;
  timestamp: Date;
}

export interface MarketState {
  regime: string;
  volatility: number;
  trend_strength: number;
  rsi: number;
  volume_ratio: number;
  agent_confidence: number;
}

export interface TradeAction {
  action: 'BUY' | 'SELL' | 'HOLD';
  position_size: number;
  entry_price: number;
}

export interface LearningMetrics {
  total_experiences: number;
  learning_rate: number;
  exploration_rate: number;
  avg_q_value: number;
  recent_performance: number;
  pattern_accuracy: Map<string, number>;
}

export class OnlineLearningSystem {
  private replayBuffer: ExperienceMemory[] = [];
  private maxBufferSize: number = 10000;
  
  // Q-learning parameters
  private learningRate: number = 0.1;
  private discountFactor: number = 0.95;
  private explorationRate: number = 0.2;
  private explorationDecay: number = 0.995;
  
  // Q-table: state -> action -> value
  private qTable: Map<string, Map<string, number>> = new Map();
  
  // Pattern recognition
  private patternSuccessRate: Map<string, { wins: number; total: number }> = new Map();
  
  // Agent-specific learning histories
  private agentLearningHistory: Map<string, LearningMetrics> = new Map();

  /**
   * Record experience for learning
   */
  recordExperience(
    agent: TradingAgent,
    state: MarketState,
    action: TradeAction,
    reward: number,
    nextState: MarketState
  ): void {
    const experience: ExperienceMemory = {
      state,
      action,
      reward,
      next_state: nextState,
      timestamp: new Date()
    };

    this.replayBuffer.push(experience);

    // Maintain buffer size
    if (this.replayBuffer.length > this.maxBufferSize) {
      this.replayBuffer.shift();
    }

    // Update Q-table
    this.updateQValue(state, action, reward, nextState);

    console.log(`🧠 Recorded experience for learning: reward=${reward.toFixed(3)}`);
  }

  /**
   * Q-learning update
   */
  private updateQValue(
    state: MarketState,
    action: TradeAction,
    reward: number,
    nextState: MarketState
  ): void {
    const stateKey = this.serializeState(state);
    const actionKey = this.serializeAction(action);

    // Initialize Q-values if not exists
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }

    const stateActions = this.qTable.get(stateKey)!;
    const currentQ = stateActions.get(actionKey) || 0;

    // Find max Q-value for next state
    const nextStateKey = this.serializeState(nextState);
    const nextStateActions = this.qTable.get(nextStateKey);
    const maxNextQ = nextStateActions 
      ? Math.max(...Array.from(nextStateActions.values()))
      : 0;

    // Q-learning formula: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);

    stateActions.set(actionKey, newQ);
    this.qTable.set(stateKey, stateActions);
  }

  /**
   * Get optimal action for a given state (exploitation)
   */
  getOptimalAction(agent: TradingAgent, state: MarketState): TradeAction | null {
    const stateKey = this.serializeState(state);
    const stateActions = this.qTable.get(stateKey);

    if (!stateActions || stateActions.size === 0) return null;

    // Find action with highest Q-value
    let maxQ = -Infinity;
    let bestAction: string | null = null;

    stateActions.forEach((qValue, actionKey) => {
      if (qValue > maxQ) {
        maxQ = qValue;
        bestAction = actionKey;
      }
    });

    if (!bestAction) return null;

    return this.deserializeAction(bestAction);
  }

  /**
   * Epsilon-greedy exploration
   */
  shouldExplore(): boolean {
    const explore = Math.random() < this.explorationRate;
    
    // Decay exploration rate over time
    this.explorationRate *= this.explorationDecay;
    this.explorationRate = Math.max(0.05, this.explorationRate);  // Minimum 5%

    return explore;
  }

  /**
   * Experience replay - learn from past experiences
   */
  replayExperiences(batchSize: number = 32): void {
    if (this.replayBuffer.length < batchSize) return;

    // Sample random batch
    const batch: ExperienceMemory[] = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * this.replayBuffer.length);
      batch.push(this.replayBuffer[idx]);
    }

    // Learn from batch
    batch.forEach(exp => {
      this.updateQValue(exp.state, exp.action, exp.reward, exp.next_state);
    });

    console.log(`📚 Replayed ${batchSize} experiences for learning`);
  }

  /**
   * Update pattern recognition accuracy
   */
  updatePatternAccuracy(pattern: string, success: boolean): void {
    if (!this.patternSuccessRate.has(pattern)) {
      this.patternSuccessRate.set(pattern, { wins: 0, total: 0 });
    }

    const stats = this.patternSuccessRate.get(pattern)!;
    stats.total += 1;
    if (success) stats.wins += 1;

    this.patternSuccessRate.set(pattern, stats);
  }

  /**
   * Get pattern accuracy
   */
  getPatternAccuracy(pattern: string): number {
    const stats = this.patternSuccessRate.get(pattern);
    if (!stats || stats.total === 0) return 0;
    return stats.wins / stats.total;
  }

  /**
   * Adaptive learning rate based on performance
   */
  adaptLearningRate(recentPerformance: number): void {
    // Increase learning rate if performance is poor
    if (recentPerformance < 0.5) {
      this.learningRate = Math.min(0.3, this.learningRate * 1.1);
    } else {
      // Decrease learning rate if performance is good (fine-tuning)
      this.learningRate = Math.max(0.01, this.learningRate * 0.95);
    }
  }

  /**
   * Get learning metrics for an agent
   */
  getLearningMetrics(agent: TradingAgent): LearningMetrics {
    const patternAccuracy = new Map<string, number>();
    this.patternSuccessRate.forEach((stats, pattern) => {
      patternAccuracy.set(pattern, stats.wins / stats.total);
    });

    return {
      total_experiences: this.replayBuffer.length,
      learning_rate: this.learningRate,
      exploration_rate: this.explorationRate,
      avg_q_value: this.calculateAvgQValue(),
      recent_performance: agent.win_rate,
      pattern_accuracy: patternAccuracy
    };
  }

  private calculateAvgQValue(): number {
    let sum = 0;
    let count = 0;

    this.qTable.forEach(stateActions => {
      stateActions.forEach(qValue => {
        sum += qValue;
        count += 1;
      });
    });

    return count > 0 ? sum / count : 0;
  }

  /**
   * Serialize state for Q-table key
   */
  private serializeState(state: MarketState): string {
    return JSON.stringify({
      regime: state.regime,
      volatility: Math.round(state.volatility * 100),
      trend: Math.round(state.trend_strength * 10),
      rsi: Math.round(state.rsi / 10) * 10
    });
  }

  private serializeAction(action: TradeAction): string {
    return JSON.stringify({
      action: action.action,
      size: Math.round(action.position_size * 10) / 10
    });
  }

  private deserializeAction(actionKey: string): TradeAction {
    const parsed = JSON.parse(actionKey);
    return {
      action: parsed.action,
      position_size: parsed.size,
      entry_price: 0  // Will be filled by caller
    };
  }

  /**
   * Export Q-table for persistence
   */
  exportQTable(): any {
    const exported: any = {};
    this.qTable.forEach((stateActions, stateKey) => {
      const actions: any = {};
      stateActions.forEach((qValue, actionKey) => {
        actions[actionKey] = qValue;
      });
      exported[stateKey] = actions;
    });
    return exported;
  }

  /**
   * Import Q-table from saved state
   */
  importQTable(data: any): void {
    this.qTable.clear();
    Object.entries(data).forEach(([stateKey, actions]: [string, any]) => {
      const stateActions = new Map<string, number>();
      Object.entries(actions).forEach(([actionKey, qValue]: [string, any]) => {
        stateActions.set(actionKey, qValue);
      });
      this.qTable.set(stateKey, stateActions);
    });
    console.log(`📥 Imported Q-table with ${this.qTable.size} states`);
  }

  /**
   * Gradient-Based Agent Threshold Tuning
   * Adjusts agent parameters based on recent Sharpe ratio performance
   * Implements adaptive learning: improving performance → reduce learning rate (fine-tune)
   * Poor performance → increase learning rate (explore more)
   */
  tuneAgentThresholds(agent: TradingAgent, recentTrades: TradeResult[], regime: string): void {
    if (recentTrades.length < 8) return;

    const sharpe = this.calculateSharpe(recentTrades);
    const agentName = agent.name;

    // Gradient-style adjustment for VolumeMechanicalVerifierAgent
    if ('volumeThreshold' in agent) {
      const improvement = sharpe > 1.2 ? 0.03 : (sharpe < 0.8 ? -0.03 : 0);
      const oldThreshold = (agent as any).volumeThreshold;
      (agent as any).volumeThreshold = Math.max(1.2, Math.min(2.0, oldThreshold + improvement));
      
      const oldConviction = (agent as any).minConvictionThreshold;
      (agent as any).minConvictionThreshold = Math.max(50, Math.min(80, oldConviction + improvement * 10));
      
      console.log(
        `⚙️ [OnlineLearning] Tuned ${agentName} (${regime}) | Sharpe=${sharpe.toFixed(2)} | ` +
        `volumeThreshold: ${oldThreshold.toFixed(2)}→${(agent as any).volumeThreshold.toFixed(2)} | ` +
        `conviction: ${oldConviction.toFixed(0)}→${(agent as any).minConvictionThreshold.toFixed(0)}`
      );
    }

    // Auto-skill evolution: boost specialized skills on high Sharpe
    if (sharpe > 1.5 && agent.skill_levels) {
      const skillLevels = agent.skill_levels as any;
      
      // Domain-specific skill improvements
      if ('climax_detection' in skillLevels) {
        skillLevels.climax_detection = Math.min(10, skillLevels.climax_detection + 1);
        console.log(`🎯 ${agentName}: climax_detection skill → ${skillLevels.climax_detection}`);
      }
      if ('conviction_check' in skillLevels && sharpe > 1.8) {
        skillLevels.conviction_check = Math.min(10, skillLevels.conviction_check + 1);
        console.log(`🎯 ${agentName}: conviction_check skill → ${skillLevels.conviction_check}`);
      }
      if ('breakout_integrity' in skillLevels && sharpe > 1.7) {
        skillLevels.breakout_integrity = Math.min(10, skillLevels.breakout_integrity + 1);
        console.log(`🎯 ${agentName}: breakout_integrity skill → ${skillLevels.breakout_integrity}`);
      }
    }
  }

  /**
   * Helper: Calculate Sharpe ratio from recent trades
   * Sharpe = (avg_return / std_dev_returns) * sqrt(252) for annual
   */
  private calculateSharpe(trades: TradeResult[]): number {
    if (trades.length === 0) return 0;

    // Use profit_pct from TradeResult (already in decimal 0-1 range)
    const returns = trades.map(t => t.profit_pct / 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    return (avgReturn / stdDev) * Math.sqrt(252); // Annualized
  }
}
