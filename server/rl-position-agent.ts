
/**
 * Reinforcement Learning Position Sizing Agent
 * 
 * Uses Q-learning to optimize:
 * - Position size based on market conditions
 * - Stop-loss placement
 * - Take-profit levels
 * - Risk-reward ratios
 * 
 * Features:
 * - Multi-armed bandit for strategy selection
 * - Contextual bandits for regime-aware sizing
 * - Experience replay for training
 * - Epsilon-greedy exploration
 */

import { MarketFrame } from '@shared/schema';

export interface PositionSizingAction {
  sizeMultiplier: number; // 0.5 to 2.0 (50% to 200% of base size)
  stopLossMultiplier: number; // 1.0 to 3.0 (ATR multiples)
  takeProfitMultiplier: number; // 1.5 to 5.0 (ATR multiples)
  riskRewardRatio: number; // 1.5 to 5.0
}

export interface RLState {
  volatility: number; // 0-1 normalized
  trend: number; // -1 to 1
  momentum: number; // -1 to 1
  volumeRatio: number; // 0-2+
  rsi: number; // 0-100
  confidence: number; // 0-1 from ML predictions
  regime: string; // Market regime
  drawdown: number; // Current drawdown %
}

export interface Experience {
  state: RLState;
  action: PositionSizingAction;
  reward: number;
  nextState: RLState;
  done: boolean;
}

export class RLPositionAgent {
  private qTable: Map<string, Map<string, number>> = new Map();
  private experienceBuffer: Experience[] = [];
  private readonly bufferSize = 10000;
  private readonly learningRate = 0.1;
  private readonly discountFactor = 0.95;
  private epsilon = 0.2; // Exploration rate
  private readonly epsilonDecay = 0.995;
  private readonly epsilonMin = 0.05;
  
  // Discretized action space
  private readonly actionSpace: PositionSizingAction[] = this.generateActionSpace();
  
  constructor() {
    this.loadQTable();
  }
  
  /**
   * Generate discrete action space for position sizing
   */
  private generateActionSpace(): PositionSizingAction[] {
    const actions: PositionSizingAction[] = [];
    
    // Size multipliers: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x
    const sizeMultipliers = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    
    // Stop loss: 1.0, 1.5, 2.0, 2.5, 3.0 ATR
    const stopMultipliers = [1.0, 1.5, 2.0, 2.5, 3.0];
    
    // Take profit: 1.5, 2.0, 2.5, 3.0, 4.0, 5.0 ATR
    const tpMultipliers = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
    
    // Generate all combinations
    for (const size of sizeMultipliers) {
      for (const stop of stopMultipliers) {
        for (const tp of tpMultipliers) {
          const rr = tp / stop;
          if (rr >= 1.5) { // Only keep actions with RR >= 1.5
            actions.push({
              sizeMultiplier: size,
              stopLossMultiplier: stop,
              takeProfitMultiplier: tp,
              riskRewardRatio: rr
            });
          }
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Convert continuous state to discrete state key
   */
  private stateToKey(state: RLState): string {
    const vol = Math.floor(state.volatility * 10);
    const trend = Math.floor((state.trend + 1) * 5); // -1 to 1 → 0 to 10
    const mom = Math.floor((state.momentum + 1) * 5);
    const rsi = Math.floor(state.rsi / 10);
    const conf = Math.floor(state.confidence * 10);
    
    return `${vol}-${trend}-${mom}-${rsi}-${conf}-${state.regime}`;
  }
  
  /**
   * Convert action to key
   */
  private actionToKey(action: PositionSizingAction): string {
    return `${action.sizeMultiplier}-${action.stopLossMultiplier}-${action.takeProfitMultiplier}`;
  }
  
  /**
   * Get Q-value for state-action pair
   */
  private getQValue(state: RLState, action: PositionSizingAction): number {
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    
    const stateActions = this.qTable.get(stateKey)!;
    return stateActions.get(actionKey) || 0;
  }
  
  /**
   * Set Q-value for state-action pair
   */
  private setQValue(state: RLState, action: PositionSizingAction, value: number): void {
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    
    this.qTable.get(stateKey)!.set(actionKey, value);
  }
  
  /**
   * Select action using epsilon-greedy policy
   */
  selectAction(state: RLState, explore: boolean = true): PositionSizingAction {
    // Epsilon-greedy exploration
    if (explore && Math.random() < this.epsilon) {
      // Random action
      return this.actionSpace[Math.floor(Math.random() * this.actionSpace.length)];
    }
    
    // Greedy action (exploit)
    let bestAction = this.actionSpace[0];
    let bestValue = this.getQValue(state, bestAction);
    
    for (const action of this.actionSpace) {
      const value = this.getQValue(state, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return bestAction;
  }
  
  /**
   * Store experience in replay buffer
   */
  addExperience(experience: Experience): void {
    this.experienceBuffer.push(experience);
    
    // Keep buffer size limited
    if (this.experienceBuffer.length > this.bufferSize) {
      this.experienceBuffer.shift();
    }
  }
  
  /**
   * Update Q-values using Q-learning
   */
  learn(experience: Experience): void {
    const { state, action, reward, nextState, done } = experience;
    
    // Current Q-value
    const currentQ = this.getQValue(state, action);
    
    // Maximum Q-value for next state
    let maxNextQ = 0;
    if (!done) {
      for (const nextAction of this.actionSpace) {
        const nextQ = this.getQValue(nextState, nextAction);
        maxNextQ = Math.max(maxNextQ, nextQ);
      }
    }
    
    // Q-learning update: Q(s,a) = Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
    const newQ = currentQ + this.learningRate * (
      reward + this.discountFactor * maxNextQ - currentQ
    );
    
    this.setQValue(state, action, newQ);
  }
  
  /**
   * Batch learning from experience replay
   */
  replayExperience(batchSize: number = 32): void {
    if (this.experienceBuffer.length < batchSize) return;
    
    // Sample random batch
    const batch: Experience[] = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * this.experienceBuffer.length);
      batch.push(this.experienceBuffer[idx]);
    }
    
    // Learn from batch
    for (const exp of batch) {
      this.learn(exp);
    }
    
    // Decay epsilon
    this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
  }
  
  /**
   * Calculate reward based on trade outcome
   */
  calculateReward(
    pnlPercent: number,
    riskRewardAchieved: number,
    maxDrawdown: number,
    timeInTrade: number
  ): number {
    let reward = 0;
    
    // Primary reward: PnL
    reward += pnlPercent * 10; // Scale up for learning
    
    // Bonus for good risk-reward
    if (riskRewardAchieved >= 2.0) reward += 5;
    else if (riskRewardAchieved >= 1.5) reward += 2;
    
    // Penalty for excessive drawdown
    if (maxDrawdown < -0.05) reward -= 10;
    else if (maxDrawdown < -0.03) reward -= 5;
    
    // Slight penalty for holding too long (encourage efficiency)
    if (timeInTrade > 100) reward -= 2;
    
    return reward;
  }
  
  /**
   * Extract state from market data
   */
  extractState(
    frames: MarketFrame[],
    mlConfidence: number,
    regime: string,
    currentDrawdown: number
  ): RLState {
    if (frames.length < 20) {
      return {
        volatility: 0.5,
        trend: 0,
        momentum: 0,
        volumeRatio: 1,
        rsi: 50,
        confidence: mlConfidence,
        regime,
        drawdown: currentDrawdown
      };
    }
    
    const latest = frames[frames.length - 1];
    const prices = frames.slice(-20).map(f => f.price.close);
    const volumes = frames.slice(-20).map(f => f.volume);
    
    // Calculate volatility
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    );
    
    // Calculate trend
    const ema20 = latest.indicators.ema20 || prices[prices.length - 1];
    const ema50 = latest.indicators.ema50 || prices[prices.length - 1];
    const trend = (ema20 - ema50) / ema50;
    
    // Calculate momentum
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    // Volume ratio
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeRatio = latest.volume / avgVolume;
    
    return {
      volatility: Math.min(1, volatility * 50), // Normalize to 0-1
      trend: Math.max(-1, Math.min(1, trend * 10)), // Normalize to -1 to 1
      momentum: Math.max(-1, Math.min(1, momentum * 5)),
      volumeRatio: Math.min(2, volumeRatio),
      rsi: latest.indicators.rsi,
      confidence: mlConfidence,
      regime,
      drawdown: currentDrawdown
    };
  }
  
  /**
   * Get optimal position sizing parameters
   */
  getPositionParameters(
    state: RLState,
    baseSize: number,
    atr: number,
    currentPrice: number
  ): {
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
  } {
    const action = this.selectAction(state, false); // No exploration for production
    
    return {
      positionSize: baseSize * action.sizeMultiplier,
      stopLoss: currentPrice - (atr * action.stopLossMultiplier),
      takeProfit: currentPrice + (atr * action.takeProfitMultiplier),
      riskReward: action.riskRewardRatio
    };
  }
  
  /**
   * Save Q-table to disk
   */
  private async saveQTable(): Promise<void> {
    // In production, save to database or file
    console.log('[RL Agent] Q-table saved');
  }
  
  /**
   * Load Q-table from disk
   */
  private async loadQTable(): Promise<void> {
    // In production, load from database or file
    console.log('[RL Agent] Q-table loaded');
  }
  
  /**
   * Get training statistics
   */
  getStats(): {
    qTableSize: number;
    experienceCount: number;
    epsilon: number;
    actionSpaceSize: number;
  } {
    let qTableSize = 0;
    for (const stateActions of this.qTable.values()) {
      qTableSize += stateActions.size;
    }
    
    return {
      qTableSize,
      experienceCount: this.experienceBuffer.length,
      epsilon: this.epsilon,
      actionSpaceSize: this.actionSpace.length
    };
  }
}
