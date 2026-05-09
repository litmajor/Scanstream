
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

/** Entry timing decisions: when and how to enter */
export interface EntryTimingAction {
  waitBars: 0 | 1 | 2 | 3 | 5; // Bars to wait before entering
  entryType: 'MARKET' | 'LIMIT'; // Immediate or pullback limit order
  limitOffsetPct: 0 | 0.1 | 0.2 | 0.3; // % below signal price for limit
}

/** Dynamic source weighting: adaptive consensus weights per regime */
export interface SourceWeightAction {
  scannerWeight: number; // 0.20 to 0.50
  mlWeight: number; // 0.20 to 0.50
  rlWeight: number; // 0.15 to 0.35
  // Note: weights should sum to 1.0 (enforced in action space)
}

/** Exit sequencing: how to split exits across T1/T2/T3 */
export interface ExitSequenceAction {
  t1ExitPct: 0 | 0.25 | 0.33 | 0.50; // % of position to exit at T1
  t2ExitPct: 0 | 0.25 | 0.33 | 0.50; // % of position to exit at T2
  trailRemaining: boolean; // Trail or fixed exit for remainder
  trailActivationPct: 0 | 0.5 | 1.0 | 1.5; // % gain before trail kicks in (0 = no trail)
}

/** Cluster threshold adaptation: regime-aware gate tuning */
export interface ClusterThresholdAction {
  minClusterStrength: 0.55 | 0.60 | 0.65 | 0.70 | 0.75 | 0.80;
  minFollowThrough: 0.35 | 0.40 | 0.45 | 0.50;
  minDirectionalRatio: 0.50 | 0.55 | 0.60 | 0.65;
}

/** Union type of all possible RL actions */
export type RLAction = 
  | PositionSizingAction 
  | EntryTimingAction 
  | SourceWeightAction 
  | ExitSequenceAction 
  | ClusterThresholdAction;

/** RL decision domains — each learns independently */
export type RLDecisionDomain = 
  | 'POSITION_SIZING'
  | 'ENTRY_TIMING'
  | 'SOURCE_WEIGHTING'
  | 'EXIT_SEQUENCING'
  | 'CLUSTER_THRESHOLD';

export interface RLState {
  volatility: number; // 0-1 normalized
  trend: number; // -1 to 1
  momentum: number; // -1 to 1
  volumeRatio: number; // 0-2+
  rsi: number; // 0-100
  confidence: number; // 0-1 from ML predictions
  regime: string; // Market regime
  drawdown: number; // Current drawdown %
  
  // Enhanced state variables for better generalization
  equitySlope?: number; // Slope of recent equity curve (-1 to 1)
  lossStreak?: number; // Consecutive losses (0-10+)
  volSpike?: number; // Recent volatility change multiplier (0.5-2.0)
  patternDecay?: number; // Confidence decay of pattern (0-1)
  marketDrift?: number; // Drift in regime volatility (-1 to 1)
}

export interface Experience {
  state: RLState;
  action: PositionSizingAction;
  reward: number;
  nextState: RLState;
  done: boolean;
}

/** Domain-specific experience with action type preserved */
export interface DomainExperience extends Experience {
  domain: RLDecisionDomain;
  domainAction: RLAction;
}

export class RLPositionAgent {
  // Q-tables: global + per-regime
  private qTable: Map<string, Map<string, number>> = new Map();
  private regimeQTables: Map<string, Map<string, Map<string, number>>> = new Map(); // regime → state → action → Q-value
  
  // Multi-domain infrastructure: one Q-table per decision domain
  private domainQTables: Map<RLDecisionDomain, Map<string, Map<string, Map<string, number>>>> = new Map([
    ['POSITION_SIZING',   new Map()],   // regime → state → action → Q-value
    ['ENTRY_TIMING',      new Map()],
    ['SOURCE_WEIGHTING',  new Map()],
    ['EXIT_SEQUENCING',   new Map()],
    ['CLUSTER_THRESHOLD', new Map()],
  ]);
  
  // Experience buffers per domain
  private domainExperienceBuffers: Map<RLDecisionDomain, DomainExperience[]> = new Map([
    ['POSITION_SIZING',   []],
    ['ENTRY_TIMING',      []],
    ['SOURCE_WEIGHTING',  []],
    ['EXIT_SEQUENCING',   []],
    ['CLUSTER_THRESHOLD', []],
  ]);
  
  // Experience count per domain/regime for adaptive exploration
  private domainExperienceCounts: Map<string, number> = new Map(); // "DOMAIN_REGIME" → count
  
  private experienceBuffer: Experience[] = [];
  private readonly bufferSize = 10000;
  private readonly learningRate = 0.1;
  private readonly discountFactor = 0.95;
  private epsilon = 0.2; // Exploration rate
  private readonly epsilonDecay = 0.995;
  private readonly epsilonMin = 0.05;
  
  // Regime-specific learning rates
  private regimeLearningRates: Map<string, number> = new Map([
    ['TRENDING', 0.12], // Trending markets: faster learning
    ['RANGING', 0.08], // Ranging markets: slower learning (more ambiguous)
    ['VOLATILE', 0.10], // Volatile: moderate learning
    ['NEUTRAL', 0.10], // Neutral: default
  ]);
  
  // Discretized action spaces (populated at construction)
  private readonly actionSpace: PositionSizingAction[] = this.generateActionSpace();
  private readonly entryTimingActionSpace: EntryTimingAction[] = this.generateEntryTimingSpace();
  private readonly sourceWeightActionSpace: SourceWeightAction[] = this.generateSourceWeightSpace();
  private readonly exitSequenceActionSpace: ExitSequenceAction[] = this.generateExitSequenceSpace();
  private readonly clusterThresholdActionSpace: ClusterThresholdAction[] = this.generateClusterThresholdSpace();
  
  // Action space map (populated in constructor)
  private domainActionSpaces: Map<RLDecisionDomain, RLAction[]> = new Map();
  
  // Regime performance tracking
  private regimePerformance: Map<string, { wins: number; trades: number }> = new Map();
  
  constructor() {
    this.loadQTable();
    this.initializeRegimeQTables();
    this.initializeRegimeTracking();
    this.initializeDomainActionSpaces();
  }
  
  /**
   * Initialize regime-specific Q-tables
   */
  private initializeRegimeQTables(): void {
    const regimes = ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'];
    for (const regime of regimes) {
      this.regimeQTables.set(regime, new Map());
    }
  }
  
  /**
   * Initialize regime performance tracking
   */
  private initializeRegimeTracking(): void {
    const regimes = ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'];
    for (const regime of regimes) {
      this.regimePerformance.set(regime, { wins: 0, trades: 0 });
    }
  }
  
  /**
   * Initialize domain-specific action spaces
   */
  private initializeDomainActionSpaces(): void {
    this.domainActionSpaces.set('POSITION_SIZING', this.actionSpace);
    this.domainActionSpaces.set('ENTRY_TIMING', this.entryTimingActionSpace);
    this.domainActionSpaces.set('SOURCE_WEIGHTING', this.sourceWeightActionSpace);
    this.domainActionSpaces.set('EXIT_SEQUENCING', this.exitSequenceActionSpace);
    this.domainActionSpaces.set('CLUSTER_THRESHOLD', this.clusterThresholdActionSpace);
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
   * Convert action to key (supports all action types)
   */
  private actionToKey(action: PositionSizingAction | RLAction): string {
    // For PositionSizingAction (backward compat)
    if ('sizeMultiplier' in action) {
      return `${action.sizeMultiplier}-${action.stopLossMultiplier}-${action.takeProfitMultiplier}`;
    }
    // For all other action types, use JSON hash
    return JSON.stringify(action);
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
   * Select action using epsilon-greedy policy (globally)
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
   * Select action using regime-aware Q-table
   * Automatically selects from the Q-table specific to current market regime
   */
  selectActionRegimeAware(state: RLState, explore: boolean = true): PositionSizingAction {
    const regime = state.regime;
    const stateKey = this.stateToKey(state);
    
    // Get epsilon for this regime (based on regime performance)
    const regimeStats = this.regimePerformance.get(regime);
    const regimeWinRate = regimeStats ? regimeStats.wins / Math.max(1, regimeStats.trades) : 0.5;
    const adaptiveEpsilon = this.epsilon * (1 - regimeWinRate * 0.5); // Reduce exploration in winning regimes
    
    // Epsilon-greedy with regime adaptation
    if (explore && Math.random() < adaptiveEpsilon) {
      // Random action
      return this.actionSpace[Math.floor(Math.random() * this.actionSpace.length)];
    }
    
    // Get regime-specific Q-table
    let regimeQTable = this.regimeQTables.get(regime);
    if (!regimeQTable) {
      regimeQTable = new Map();
      this.regimeQTables.set(regime, regimeQTable);
    }
    
    // Greedy action (exploit from regime-specific table)
    let bestAction = this.actionSpace[0];
    let bestValue = this.getRegimeQValue(regime, state, bestAction);
    
    for (const action of this.actionSpace) {
      const value = this.getRegimeQValue(regime, state, action);
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return bestAction;
  }
  
  /**
   * Get regime-specific Q-value
   */
  private getRegimeQValue(regime: string, state: RLState, action: PositionSizingAction): number {
    const regimeQTable = this.regimeQTables.get(regime);
    if (!regimeQTable) return 0;
    
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    
    if (!regimeQTable.has(stateKey)) {
      regimeQTable.set(stateKey, new Map());
    }
    
    return regimeQTable.get(stateKey)?.get(actionKey) || 0;
  }
  
  /**
   * Set regime-specific Q-value
   */
  private setRegimeQValue(regime: string, state: RLState, action: PositionSizingAction, value: number): void {
    let regimeQTable = this.regimeQTables.get(regime);
    if (!regimeQTable) {
      regimeQTable = new Map();
      this.regimeQTables.set(regime, regimeQTable);
    }
    
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    
    if (!regimeQTable.has(stateKey)) {
      regimeQTable.set(stateKey, new Map());
    }
    
    regimeQTable.get(stateKey)!.set(actionKey, value);
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
   * Update Q-values using Q-learning (global)
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
   * Update Q-values using regime-aware Q-learning
   * Learns in regime-specific table with adaptive learning rate
   */
  learnRegimeAware(experience: Experience): void {
    const { state, action, reward, nextState, done } = experience;
    const regime = state.regime;
    
    // Use regime-specific learning rate
    const regimeLR = this.regimeLearningRates.get(regime) || this.learningRate;
    
    // Current regime Q-value
    const currentQ = this.getRegimeQValue(regime, state, action);
    
    // Maximum regime Q-value for next state
    let maxNextQ = 0;
    if (!done) {
      for (const nextAction of this.actionSpace) {
        const nextQ = this.getRegimeQValue(regime, nextState, nextAction);
        maxNextQ = Math.max(maxNextQ, nextQ);
      }
    }
    
    // Q-learning update with regime-specific learning rate
    const newQ = currentQ + regimeLR * (
      reward + this.discountFactor * maxNextQ - currentQ
    );
    
    this.setRegimeQValue(regime, state, action, newQ);
    
    // Track regime performance for adaptive epsilon
    const regimeStats = this.regimePerformance.get(regime)!;
    regimeStats.trades += 1;
    if (reward > 0) {
      regimeStats.wins += 1;
    }
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
    
    const latest = frames[frames.length - 1] as any;
    const prices = frames.slice(-20).map(f => (f as any).price?.close ?? (f as any).close ?? 0);
    const volumes = frames.slice(-20).map(f => (f as any).volume ?? 0);
    
    // Calculate volatility
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = Math.sqrt(
      returns.reduce((sum, r) => sum + r * r, 0) / returns.length
    );
    
    // Calculate trend
    const ema20 = (latest.indicators?.ema20 as number) || prices[prices.length - 1];
    const ema50 = (latest.indicators?.ema50 as number) || prices[prices.length - 1];
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
      rsi: (latest.indicators?.rsi as number) ?? 50,
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

  // =====================================================================
  // MULTI-DOMAIN RL ARCHITECTURE
  // =====================================================================

  /**
   * Select action for a specific decision domain
   * Uses regime-specific Q-table and adaptive epsilon
   */
  selectActionForDomain(
    domain: RLDecisionDomain,
    state: RLState,
    explore: boolean = true
  ): RLAction {
    const actionSpace = this.domainActionSpaces.get(domain);
    if (!actionSpace || actionSpace.length === 0) {
      throw new Error(`No action space defined for domain: ${domain}`);
    }

    const regime = state.regime;
    const domainEpsilon = this.getDomainEpsilon(domain, regime);

    if (explore && Math.random() < domainEpsilon) {
      return actionSpace[Math.floor(Math.random() * actionSpace.length)];
    }

    // Greedy selection from regime-specific Q-table
    const qTable = this.domainQTables.get(domain);
    if (!qTable) return actionSpace[0];

    const stateKey = this.stateToKey(state);
    const regimeMaps = qTable.get(regime) || new Map();

    let bestAction = actionSpace[0];
    let bestValue = -Infinity;

    for (const action of actionSpace) {
      const actionKey = this.actionToKey(action);
      const qVal = regimeMaps.get(stateKey)?.get(actionKey) ?? 0;
      if (qVal > bestValue) {
        bestValue = qVal;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Learn in a specific decision domain
   * Updates regime-specific Q-table with regime-specific learning rate
   */
  learnDomain(experience: DomainExperience): void {
    const { state, domainAction, reward, nextState, done, domain } = experience;
    const regime = state.regime;
    const lr = this.regimeLearningRates.get(regime) ?? this.learningRate;

    const qTable = this.domainQTables.get(domain);
    if (!qTable) return;

    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(domainAction);
    const nextStateKey = this.stateToKey(nextState);

    // Initialize regime map if needed
    if (!qTable.has(regime)) {
      qTable.set(regime, new Map());
    }
    const regimeMap = qTable.get(regime)!;
    if (!regimeMap.has(stateKey)) {
      regimeMap.set(stateKey, new Map());
    }
    const stateActions = regimeMap.get(stateKey)!;

    const current = stateActions.get(actionKey) ?? 0;

    // Get maximum Q-value for next state
    let maxNext = 0;
    if (!done) {
      const actionSpace = this.domainActionSpaces.get(domain);
      if (actionSpace) {
        const nextRegimeMap = qTable.get(regime) || new Map();
        const nextStateActions = nextRegimeMap.get(nextStateKey) || new Map();
        const nextValues = Array.from(nextStateActions.values()) as number[];
        maxNext = nextValues.length > 0 ? Math.max(...nextValues, 0) : 0;
      }
    }

    // Q-learning update: Q(s,a) = Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
    const newQ = current + lr * (reward + this.discountFactor * maxNext - current);
    stateActions.set(actionKey, newQ);

    // Update experience count for adaptive epsilon
    const countKey = `${domain}_${regime}`;
    const currentCount = this.domainExperienceCounts.get(countKey) ?? 0;
    this.domainExperienceCounts.set(countKey, currentCount + 1);

    // Store in buffer for batch replay
    const buffers = this.domainExperienceBuffers.get(domain);
    if (buffers) {
      buffers.push(experience);
      if (buffers.length > this.bufferSize) {
        buffers.shift();
      }
    }
  }

  /**
   * Get complete decision across all domains
   * Called once per candle for entry setup
   */
  getFullDecision(
    state: RLState,
    baseSize: number,
    atr: number,
    price: number
  ): {
    sizing: {
      positionSize: number;
      stopLoss: number;
      takeProfit: number;
      riskReward: number;
    };
    entryTiming: EntryTimingAction;
    sourceWeights: SourceWeightAction;
    exitSequence: ExitSequenceAction;
    clusterThreshold: ClusterThresholdAction;
  } {
    return {
      sizing: this.getPositionParameters(state, baseSize, atr, price),
      entryTiming: this.selectActionForDomain('ENTRY_TIMING', state, false) as EntryTimingAction,
      sourceWeights: this.selectActionForDomain('SOURCE_WEIGHTING', state, false) as SourceWeightAction,
      exitSequence: this.selectActionForDomain('EXIT_SEQUENCING', state, false) as ExitSequenceAction,
      clusterThreshold: this.selectActionForDomain('CLUSTER_THRESHOLD', state, false) as ClusterThresholdAction,
    };
  }

  /**
   * Get domain-specific epsilon (exploration rate)
   * Explores more heavily when domain has few samples in this regime
   */
  private getDomainEpsilon(domain: RLDecisionDomain, regime: string): number {
    const countKey = `${domain}_${regime}`;
    const counts = this.domainExperienceCounts.get(countKey) ?? 0;
    
    if (counts < 50) return 0.5;   // Heavy exploration, few samples
    if (counts < 200) return 0.3;  // Moderate exploration
    if (counts < 500) return 0.15; // Light exploration
    return this.epsilon;           // Default epsilon with decay
  }

  /**
   * Generate entry timing action space
   */
  private generateEntryTimingSpace(): EntryTimingAction[] {
    return [
      { waitBars: 0, entryType: 'MARKET', limitOffsetPct: 0 },
      { waitBars: 1, entryType: 'MARKET', limitOffsetPct: 0 },
      { waitBars: 2, entryType: 'MARKET', limitOffsetPct: 0 },
      { waitBars: 1, entryType: 'LIMIT',  limitOffsetPct: 0.1 },
      { waitBars: 2, entryType: 'LIMIT',  limitOffsetPct: 0.2 },
      { waitBars: 3, entryType: 'LIMIT',  limitOffsetPct: 0.3 },
      { waitBars: 5, entryType: 'LIMIT',  limitOffsetPct: 0.3 },
    ];
  }

  /**
   * Generate source weight action space
   * Pre-computed combinations that sum to 1.0
   */
  private generateSourceWeightSpace(): SourceWeightAction[] {
    return [
      { scannerWeight: 0.40, mlWeight: 0.35, rlWeight: 0.25 }, // Default balanced
      { scannerWeight: 0.50, mlWeight: 0.30, rlWeight: 0.20 }, // Scanner heavy
      { scannerWeight: 0.30, mlWeight: 0.45, rlWeight: 0.25 }, // ML heavy
      { scannerWeight: 0.30, mlWeight: 0.30, rlWeight: 0.40 }, // RL heavy
      { scannerWeight: 0.33, mlWeight: 0.33, rlWeight: 0.34 }, // Equal weight
      { scannerWeight: 0.20, mlWeight: 0.50, rlWeight: 0.30 }, // Volatile preset (ML dominant)
      { scannerWeight: 0.45, mlWeight: 0.35, rlWeight: 0.20 }, // Trending preset (Scanner dominant)
    ];
  }

  /**
   * Generate exit sequence action space
   */
  private generateExitSequenceSpace(): ExitSequenceAction[] {
    return [
      { t1ExitPct: 0.33, t2ExitPct: 0.33, trailRemaining: true,  trailActivationPct: 1.0 },
      { t1ExitPct: 0.50, t2ExitPct: 0.25, trailRemaining: true,  trailActivationPct: 0.5 },
      { t1ExitPct: 0.25, t2ExitPct: 0.25, trailRemaining: true,  trailActivationPct: 1.5 },
      { t1ExitPct: 0,    t2ExitPct: 0.50, trailRemaining: true,  trailActivationPct: 1.0 },
      { t1ExitPct: 0.50, t2ExitPct: 0.50, trailRemaining: false, trailActivationPct: 0 },
    ];
  }

  /**
   * Generate cluster threshold action space
   */
  private generateClusterThresholdSpace(): ClusterThresholdAction[] {
    return [
      { minClusterStrength: 0.75, minFollowThrough: 0.50, minDirectionalRatio: 0.65 }, // Strict
      { minClusterStrength: 0.65, minFollowThrough: 0.45, minDirectionalRatio: 0.60 }, // Moderate
      { minClusterStrength: 0.55, minFollowThrough: 0.40, minDirectionalRatio: 0.55 }, // Relaxed
      { minClusterStrength: 0.70, minFollowThrough: 0.40, minDirectionalRatio: 0.55 }, // Mixed
      { minClusterStrength: 0.60, minFollowThrough: 0.35, minDirectionalRatio: 0.50 }, // Very relaxed
    ];
  }

  /**
   * Get reward signals for each domain
   * Called after trade outcome to generate domain-specific rewards
   */
  static calculateDomainReward(
    domain: RLDecisionDomain,
    context: {
      entryFillPrice?: number;
      signalPrice?: number;
      finalPnl?: number;
      weightedScore?: number;
      actualOutcome?: 'WIN' | 'LOSS';
      maxPossiblePnl?: number;
      signalPassedGate?: boolean;
      tradeWon?: boolean;
    }
  ): number {
    switch (domain) {
      case 'ENTRY_TIMING': {
        if (!context.entryFillPrice || !context.signalPrice || context.finalPnl === undefined) return 0;
        const slippage = Math.abs(context.entryFillPrice - context.signalPrice) / context.signalPrice;
        const slippagePenalty = slippage * -50;
        const pnlBonus = context.finalPnl > 0 ? +2 : -2;
        return slippagePenalty + pnlBonus;
      }

      case 'SOURCE_WEIGHTING': {
        if (!context.weightedScore || !context.actualOutcome) return 0;
        const correct = (context.weightedScore > 0.6 && context.actualOutcome === 'WIN') ||
                        (context.weightedScore < 0.4 && context.actualOutcome === 'LOSS');
        return correct ? +3 : -3;
      }

      case 'EXIT_SEQUENCING': {
        if (!context.maxPossiblePnl || context.finalPnl === undefined) return 0;
        const captureRatio = context.maxPossiblePnl > 0 ? context.finalPnl / context.maxPossiblePnl : 0;
        return (captureRatio - 0.5) * 10; // -5 to +5 range
      }

      case 'CLUSTER_THRESHOLD': {
        if (context.signalPassedGate && context.tradeWon) return +4;  // Correct pass
        if (context.signalPassedGate && !context.tradeWon) return -6;  // False positive
        if (!context.signalPassedGate && context.tradeWon) return -2;  // False negative
        return +1; // Correct block
      }

      case 'POSITION_SIZING':
      default:
        // Position sizing reward handled in calculateReward method
        return 0;
    }
  }

  /**
   * Get domain experience count for a specific domain/regime
   */
  getDomainExperienceCount(domain: RLDecisionDomain, regime: string): number {
    return this.domainExperienceCounts.get(`${domain}_${regime}`) ?? 0;
  }

  /**
   * Get stats across all domains
   */
  getDomainStats(): Map<RLDecisionDomain, { qTableSize: number; experienceCount: number }> {
    const stats = new Map<RLDecisionDomain, { qTableSize: number; experienceCount: number }>();

    for (const domain of ['POSITION_SIZING', 'ENTRY_TIMING', 'SOURCE_WEIGHTING', 'EXIT_SEQUENCING', 'CLUSTER_THRESHOLD'] as RLDecisionDomain[]) {
      let qTableSize = 0;
      const qTable = this.domainQTables.get(domain);
      if (qTable) {
        for (const regimeMap of qTable.values()) {
          for (const stateActions of regimeMap.values()) {
            qTableSize += stateActions.size;
          }
        }
      }

      const buffer = this.domainExperienceBuffers.get(domain);
      const experienceCount = buffer?.length ?? 0;

      stats.set(domain, { qTableSize, experienceCount });
    }

    return stats;
  }
}
