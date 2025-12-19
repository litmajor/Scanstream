/**
 * PHASE 4: RPG AGENT INTEGRATION
 * 
 * Add Reinforcement Learning Policy Gradient (RPG) agents as 4th signal source
 * 
 * Architecture:
 * - RPG agents learn from market data and trade outcomes
 * - Generate independent trading signals based on learned policies
 * - Integrate with existing Scanner/ML/RL sources (now 4 sources total)
 * - Combo activation bonuses when RPG agrees with other sources
 * - Confidence amplification through source agreement
 * 
 * Objectives:
 * - Add 25% weight to RPG signals
 * - Achieve 10-15% additional Sharpe improvement
 * - Reduce drawdown by additional 1-2%
 * - Combo bonuses: +5-10% confidence when 3+ sources aligned
 */

// Type definitions
export type RPGSignalType = 'BUY' | 'SELL' | 'HOLD';
export type RPGAgentStrategy = 'TREND_FOLLOWING' | 'MEAN_REVERSION' | 'MOMENTUM' | 'BREAKOUT';
export type AgentConfidence = number; // 0-1

export interface RPGAgentOutput {
  symbol: string;
  timestamp: number;
  action: RPGSignalType;
  confidence: number;        // 0-1: Agent confidence in action
  strategy: RPGAgentStrategy; // Which strategy the agent is using
  policyScore: number;       // 0-1: How well policy aligns with current market
  explorationBonus: number;  // 0-0.1: Bonus for exploring new strategies
  qValue: number;            // Q-learning value estimate
  reasoning: string;         // Human-readable explanation
}

export interface RPGComboBonus {
  hasCombo: boolean;
  comboType: 'UNANIMOUS' | 'STRONG_AGREEMENT' | 'MILD_AGREEMENT';
  alignedSources: number;      // How many sources agree (2-4)
  agreementScore: number;      // 0-1: How strongly they agree
  confidenceBoost: number;     // Multiplier applied to final confidence (1.0-1.5)
  bonusExplanation: string;
}

export interface RPGSignalAggregation {
  rpgOutput: RPGAgentOutput;
  comboBonus: RPGComboBonus;
  finalConfidence: number;     // After combo bonus applied
  sourceSummary: {
    scanner: number;           // Scanner confidence 0-1
    ml: number;               // ML confidence 0-1
    rl: number;               // RL confidence 0-1
    rpg: number;              // RPG confidence 0-1
    average: number;          // Average of all 4 sources
  };
}

// ============================================================================
// RPG AGENT SIMULATOR (For testing without actual RL training)
// ============================================================================

export class RPGAgentSimulator {
  private agentId: string;
  private strategy: RPGAgentStrategy;
  private qValues: Map<string, number> = new Map();
  private policyWeights: Map<string, number> = new Map();
  private explorationRate: number = 0.1; // 10% exploration

  constructor(agentId: string, strategy: RPGAgentStrategy = 'TREND_FOLLOWING') {
    this.agentId = agentId;
    this.strategy = strategy;
    this.initializePolicy();
  }

  /**
   * Generate RPG signal based on market conditions
   */
  generateSignal(
    symbol: string,
    currentPrice: number,
    adx: number,        // Trend strength
    rsi: number,        // 0-100
    momentum: number,   // -1 to +1
    volatility: number  // ATR%
  ): RPGAgentOutput {
    const timestamp = Date.now();

    // Determine action based on strategy
    const action = this.selectAction(adx, rsi, momentum, volatility);

    // Calculate policy score (how well does policy match conditions?)
    const policyScore = this.evaluatePolicyScore(adx, rsi, momentum, volatility, action);

    // Calculate confidence
    let confidence = policyScore;
    const isExploring = Math.random() < this.explorationRate;
    const explorationBonus = isExploring ? 0.05 : 0;

    confidence = Math.min(0.95, Math.max(0.1, confidence + explorationBonus));

    // Q-value estimate
    const qValue = this.getQValue(symbol) || 0.5;

    // Build reasoning
    const reasoning = this.buildReasoning(action, confidence, policyScore);

    return {
      symbol,
      timestamp,
      action,
      confidence,
      strategy: this.strategy,
      policyScore,
      explorationBonus,
      qValue,
      reasoning
    };
  }

  /**
   * Select action based on strategy and market conditions
   */
  private selectAction(adx: number, rsi: number, momentum: number, volatility: number): RPGSignalType {
    switch (this.strategy) {
      case 'TREND_FOLLOWING':
        // Buy if strong uptrend, sell if strong downtrend
        if (adx > 25 && momentum > 0.3) return 'BUY';
        if (adx > 25 && momentum < -0.3) return 'SELL';
        return 'HOLD';

      case 'MEAN_REVERSION':
        // Buy if oversold, sell if overbought
        if (rsi < 30) return 'BUY';
        if (rsi > 70) return 'SELL';
        return 'HOLD';

      case 'MOMENTUM':
        // Buy/sell based on momentum strength
        if (momentum > 0.5) return 'BUY';
        if (momentum < -0.5) return 'SELL';
        return 'HOLD';

      case 'BREAKOUT':
        // Buy if volatility spike + positive momentum
        if (volatility > 1.5 && momentum > 0.2) return 'BUY';
        if (volatility > 1.5 && momentum < -0.2) return 'SELL';
        return 'HOLD';

      default:
        return 'HOLD';
    }
  }

  /**
   * Evaluate how well the policy matches current market conditions
   */
  private evaluatePolicyScore(adx: number, rsi: number, momentum: number, volatility: number, action: RPGSignalType): number {
    let score = 0.5; // Base score

    if (action === 'BUY') {
      // Upside policy: favor momentum > 0, ADX > 20, RSI not overbought
      if (momentum > 0.3) score += 0.15;
      if (adx > 25) score += 0.10;
      if (rsi < 70) score += 0.10;
      if (volatility < 2.0) score += 0.05;
    } else if (action === 'SELL') {
      // Downside policy: favor momentum < 0, ADX > 20, RSI not oversold
      if (momentum < -0.3) score += 0.15;
      if (adx > 25) score += 0.10;
      if (rsi > 30) score += 0.10;
      if (volatility < 2.0) score += 0.05;
    } else {
      // Hold: favor stable conditions
      if (Math.abs(momentum) < 0.2) score += 0.10;
      if (adx < 20) score += 0.10;
      if (30 < rsi && rsi < 70) score += 0.15;
      if (volatility < 1.5) score += 0.10;
    }

    return Math.min(1.0, Math.max(0.1, score));
  }

  /**
   * Build human-readable reasoning
   */
  private buildReasoning(action: RPGSignalType, confidence: number, policyScore: number): string {
    const strategy = this.strategy.toLowerCase().replace('_', ' ');
    const confPct = (confidence * 100).toFixed(0);
    const policyPct = (policyScore * 100).toFixed(0);

    return `${this.strategy}: ${action} signal (confidence: ${confPct}%, policy alignment: ${policyPct}%)`;
  }

  private getQValue(symbol: string): number {
    return this.qValues.get(symbol) || 0.5;
  }

  private initializePolicy(): void {
    // Initialize with default weights
    this.policyWeights.set('trend_strength', 0.25);
    this.policyWeights.set('momentum', 0.25);
    this.policyWeights.set('rsi_position', 0.20);
    this.policyWeights.set('volatility', 0.15);
    this.policyWeights.set('exploration', 0.15);
  }

  /**
   * Update policy based on trade outcomes (simple feedback)
   */
  updatePolicy(symbol: string, tradeResult: number): void {
    // Positive result: increase confidence in current policy
    // Negative result: decrease confidence, increase exploration
    const qValue = this.getQValue(symbol);
    const newQValue = qValue + (tradeResult > 0 ? 0.05 : -0.10);
    this.qValues.set(symbol, Math.min(0.95, Math.max(0.1, newQValue)));

    // Adjust exploration rate
    if (tradeResult > 0) {
      this.explorationRate = Math.max(0.05, this.explorationRate - 0.01);
    } else {
      this.explorationRate = Math.min(0.25, this.explorationRate + 0.02);
    }
  }

  getAgentId(): string {
    return this.agentId;
  }

  getStrategy(): RPGAgentStrategy {
    return this.strategy;
  }
}

// ============================================================================
// RPG SIGNAL AGGREGATOR
// ============================================================================

export class RPGSignalAggregator {
  private agents: Map<string, RPGAgentSimulator> = new Map();
  private readonly defaultAgentCount = 4; // 1 per strategy

  constructor() {
    this.initializeAgents();
  }

  /**
   * Initialize default set of RPG agents (one per strategy)
   */
  private initializeAgents(): void {
    const strategies: RPGAgentStrategy[] = [
      'TREND_FOLLOWING',
      'MEAN_REVERSION',
      'MOMENTUM',
      'BREAKOUT'
    ];

    strategies.forEach((strategy, idx) => {
      this.agents.set(`rpg_agent_${idx}`, new RPGAgentSimulator(`rpg_agent_${idx}`, strategy));
    });
  }

  /**
   * Aggregate signals from all RPG agents
   */
  aggregateRPGSignals(
    symbol: string,
    adx: number,
    rsi: number,
    momentum: number,
    volatility: number
  ): RPGAgentOutput {
    const signals: RPGAgentOutput[] = [];

    // Get signals from all agents
    for (const agent of this.agents.values()) {
      const signal = agent.generateSignal(symbol, 0, adx, rsi, momentum, volatility);
      signals.push(signal);
    }

    // Aggregate: find consensus action
    const buyCount = signals.filter(s => s.action === 'BUY').length;
    const sellCount = signals.filter(s => s.action === 'SELL').length;
    const holdCount = signals.filter(s => s.action === 'HOLD').length;

    // Consensus action
    let action: RPGSignalType = 'HOLD';
    if (buyCount > sellCount && buyCount > holdCount) action = 'BUY';
    else if (sellCount > buyCount && sellCount > holdCount) action = 'SELL';

    // Average confidence from agents agreeing with consensus
    const consensusSignals = signals.filter(s => s.action === action);
    const avgConfidence = consensusSignals.length > 0
      ? consensusSignals.reduce((sum, s) => sum + s.confidence, 0) / consensusSignals.length
      : 0.3;

    // Average policy score
    const avgPolicyScore = signals.reduce((sum, s) => sum + s.policyScore, 0) / signals.length;

    // Average Q-value
    const avgQValue = signals.reduce((sum, s) => sum + s.qValue, 0) / signals.length;

    return {
      symbol,
      timestamp: Date.now(),
      action,
      confidence: Math.min(0.95, Math.max(0.2, avgConfidence)),
      strategy: 'TREND_FOLLOWING', // Meta-strategy: aggregation
      policyScore: avgPolicyScore,
      explorationBonus: 0,
      qValue: avgQValue,
      reasoning: `RPG consensus: ${action} (${consensusSignals.length}/${signals.length} agents agree)`
    };
  }

  addAgent(agent: RPGAgentSimulator): void {
    this.agents.set(agent.getAgentId(), agent);
  }

  updateAgentPolicy(agentId: string, symbol: string, tradeResult: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.updatePolicy(symbol, tradeResult);
    }
  }

  getAgentCount(): number {
    return this.agents.size;
  }
}

// ============================================================================
// RPG COMBO BONUS CALCULATOR
// ============================================================================

export class RPGComboBonusCalculator {
  /**
   * Calculate combo bonus based on how many sources agree
   */
  calculateComboBonus(
    scannerConfidence: number,
    mlConfidence: number,
    rlConfidence: number,
    rpgConfidence: number
  ): RPGComboBonus {
    const sources = [scannerConfidence, mlConfidence, rlConfidence, rpgConfidence];
    const avgConfidence = sources.reduce((a, b) => a + b, 0) / sources.length;

    // Count how many sources agree (within 20% of average)
    const threshold = 0.20;
    const alignedCount = sources.filter(c => Math.abs(c - avgConfidence) <= threshold).length;

    // Determine combo type and bonus
    let comboType: 'UNANIMOUS' | 'STRONG_AGREEMENT' | 'MILD_AGREEMENT';
    let confidenceBoost: number;
    let bonusExplanation: string;

    if (alignedCount === 4) {
      // All sources agree - maximum bonus
      comboType = 'UNANIMOUS';
      confidenceBoost = 1.40; // +40% confidence
      bonusExplanation = 'All 4 sources (Scanner, ML, RL, RPG) unanimously aligned';
    } else if (alignedCount === 3) {
      // Strong agreement - good bonus
      comboType = 'STRONG_AGREEMENT';
      confidenceBoost = 1.25; // +25% confidence
      bonusExplanation = '3/4 sources strongly aligned';
    } else if (alignedCount >= 2) {
      // Mild agreement - small bonus
      comboType = 'MILD_AGREEMENT';
      confidenceBoost = 1.10; // +10% confidence
      bonusExplanation = '2/4 sources aligned';
    } else {
      // No alignment - no bonus
      comboType = 'MILD_AGREEMENT';
      confidenceBoost = 1.0; // No bonus
      bonusExplanation = 'Sources divergent - no combo bonus';
    }

    return {
      hasCombo: alignedCount >= 2,
      comboType,
      alignedSources: alignedCount,
      agreementScore: Math.min(1, avgConfidence),
      confidenceBoost,
      bonusExplanation
    };
  }

  /**
   * Apply combo bonus to confidence
   */
  applyComboBonus(confidence: number, combo: RPGComboBonus): number {
    return Math.min(0.99, Math.max(0.1, confidence * combo.confidenceBoost));
  }
}

// ============================================================================
// INTEGRATED RPG SIGNAL PROCESSOR
// ============================================================================

export class RPGSignalProcessor {
  private rpgAggregator: RPGSignalAggregator;
  private comboBonusCalc: RPGComboBonusCalculator;
  private readonly rpgWeight = 0.25; // RPG is 25% of signal weight

  constructor() {
    this.rpgAggregator = new RPGSignalAggregator();
    this.comboBonusCalc = new RPGComboBonusCalculator();
  }

  /**
   * Process RPG signals and integrate with existing sources
   */
  processRPGSignals(
    symbol: string,
    adx: number,
    rsi: number,
    momentum: number,
    volatility: number,
    scannerConfidence: number,
    mlConfidence: number,
    rlConfidence: number
  ): RPGSignalAggregation {
    // Get RPG consensus signal
    const rpgOutput = this.rpgAggregator.aggregateRPGSignals(
      symbol,
      adx,
      rsi,
      momentum,
      volatility
    );

    // Calculate combo bonus (4-source agreement)
    const comboBonus = this.comboBonusCalc.calculateComboBonus(
      scannerConfidence,
      mlConfidence,
      rlConfidence,
      rpgOutput.confidence
    );

    // Apply combo bonus to RPG confidence
    const finalConfidence = this.comboBonusCalc.applyComboBonus(
      rpgOutput.confidence,
      comboBonus
    );

    return {
      rpgOutput,
      comboBonus,
      finalConfidence,
      sourceSummary: {
        scanner: scannerConfidence,
        ml: mlConfidence,
        rl: rlConfidence,
        rpg: rpgOutput.confidence,
        average: (scannerConfidence + mlConfidence + rlConfidence + rpgOutput.confidence) / 4
      }
    };
  }

  /**
   * Calculate weighted consensus from all 4 sources
   */
  calculateFourSourceConsensus(
    scannerConfidence: number,
    mlConfidence: number,
    rlConfidence: number,
    rpgConfidence: number
  ): {
    consensus: number;
    weight: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'QUATERNARY';
  } {
    // Weighted consensus: RPG is 25%, others are 25% each
    const consensus = (
      scannerConfidence * 0.25 +
      mlConfidence * 0.25 +
      rlConfidence * 0.25 +
      rpgConfidence * 0.25
    );

    // Weight determination based on source agreement
    let weight: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'QUATERNARY';
    if (consensus > 0.80) {
      weight = 'PRIMARY'; // Very high confidence signal
    } else if (consensus > 0.65) {
      weight = 'SECONDARY'; // Good signal
    } else if (consensus > 0.50) {
      weight = 'TERTIARY'; // Moderate signal
    } else {
      weight = 'QUATERNARY'; // Low confidence signal
    }

    return { consensus, weight };
  }

  updateAgentPolicy(agentId: string, symbol: string, tradeResult: number): void {
    this.rpgAggregator.updateAgentPolicy(agentId, symbol, tradeResult);
  }

  getRPGAggregator(): RPGSignalAggregator {
    return this.rpgAggregator;
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

export const rpgSignalProcessor = new RPGSignalProcessor();
