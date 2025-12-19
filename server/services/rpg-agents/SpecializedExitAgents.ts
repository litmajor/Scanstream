/**
 * OPPOSITION MANAGEMENT & EXIT AGENTS
 * 
 * Transform your exit intelligence into specialized, learnable agents
 * Each module becomes an RPG agent with leveling, skills, and evolution
 */

import { TradingAgent } from './TradingAgent';
import { IntelligentExitManager, ExitUpdate } from '../intelligent-exit-manager';
import { MicrostructureExitOptimizer } from '../microstructure-exit-optimizer';

// ============================================================================
// AGENT 1: EXIT ORCHESTRATOR AGENT
// ============================================================================
/**
 * Master exit agent that coordinates all exit strategies
 * 
 * Skills:
 * - exit_timing: Know when to exit (0-10)
 * - stage_recognition: Identify which profit stage we're in (0-10)
 * - liquidation_detection: Spot liquidity crises early (0-10)
 * - profit_preservation: Maximize gains while protecting downside (0-10)
 */

export class ExitOrchestratorAgent extends TradingAgent {
  private exitManager: IntelligentExitManager;
  private microstructureOptimizer: MicrostructureExitOptimizer;

  // Skill thresholds for agent advancement
  readonly SKILL_THRESHOLDS = {
    // Early exit: detect exhaustion before reversal
    'early_exit_recognition': { level: 5, impact: 'Detect exhaustion 1-2 candles early' },
    // Profit scaling: lock profits at optimal times
    'profit_scaling_mastery': { level: 8, impact: 'Lock 60-80% of max profits' },
    // Liquidity reading: sense market depth
    'liquidity_sensing': { level: 7, impact: 'Exit before spread crisis hits' },
    // Time-based wisdom: know when to force exit
    'time_exit_mastery': { level: 10, impact: 'Perfect time-based exit timing' },
  };

  constructor(name: string = 'ExitOrchestrator', personality: 'aggressive' | 'balanced' | 'conservative' = 'balanced') {
    super(name, 'EXIT_ORCHESTRATOR', personality);
    this.exitManager = new IntelligentExitManager(0, 0); // Will be updated per trade
    this.microstructureOptimizer = MicrostructureExitOptimizer.create();

    this.skill_levels = {
      'exit_timing': personality === 'aggressive' ? 6 : personality === 'conservative' ? 4 : 5,
      'stage_recognition': 5,
      'liquidation_detection': personality === 'aggressive' ? 3 : 6,
      'profit_preservation': personality === 'conservative' ? 8 : 5,
    };
  }

  /**
   * Main exit decision logic
   * Called every candle/tick to determine exit action
   */
  analyzeExit(state: {
    entryPrice: number;
    currentPrice: number;
    atr: number;
    signalType: 'BUY' | 'SELL';
    profitPercent: number;
    timeHeldHours: number;
    // Microstructure data
    microstructure?: {
      spread: number;
      bidVolume: number;
      askVolume: number;
      netFlow: number;
      depth: number;
      volumeSpike: number;
    };
  }): ExitDecision {
    // Re-initialize exit manager for this trade
    this.exitManager = new IntelligentExitManager(state.entryPrice, state.atr, state.signalType);

    // ========== STAGE 1: Standard Exit Analysis ==========
    const standardExit = this.exitManager.update(state.currentPrice, state.signalType);

    // ========== STAGE 2: Microstructure Integration ==========
    let microstructureSignal: { action: 'HOLD' | 'EXIT'; reason: string } = { action: 'HOLD', reason: '' };

    if (state.microstructure) {
      // Map microstructure to required shape for updateWithMicrostructure
      const microstructureFull = {
        ...state.microstructure,
        spreadPercent: state.microstructure.spread / state.currentPrice,
        orderImbalance: (state.microstructure.bidVolume > state.microstructure.askVolume
          ? "BUY"
          : state.microstructure.bidVolume < state.microstructure.askVolume
            ? "SELL"
            : "BALANCED") as "BUY" | "SELL" | "BALANCED",
        volumeRatio: (state.microstructure.bidVolume + state.microstructure.askVolume) > 0
          ? state.microstructure.bidVolume / (state.microstructure.bidVolume + state.microstructure.askVolume)
          : 0,
        bidAskRatio: state.microstructure.askVolume > 0
          ? state.microstructure.bidVolume / state.microstructure.askVolume
          : 0,
        price: state.currentPrice,
      };

      const microUpdate = this.exitManager.updateWithMicrostructure(
        state.currentPrice,
        microstructureFull,
        microstructureFull, // previous (for now, use same)
        state.signalType
      );

      if (microUpdate.action === 'EXIT') {
        microstructureSignal = {
          action: 'EXIT',
          reason: microUpdate.reason || 'Microstructure deterioration'
        };
      }
    }

    // ========== STAGE 3: Skill-Based Adjustments ==========
    const skillAdjustedDecision = this.applySkillModifiers(
      standardExit,
      microstructureSignal,
      state
    );

    // ========== STAGE 4: Personality-Based Risk ==========
    const finalDecision = this.applyPersonalityBias(skillAdjustedDecision, state);

    // ========== LEARNING FEEDBACK ==========
    // Record this decision for learning
    this.recordExitDecision(finalDecision, state);

    return finalDecision;
  }

  /**
   * Apply agent's skills to improve exit decisions
   */
  private applySkillModifiers(
    standardExit: ExitUpdate,
    microstructure: { action: string; reason: string },
    state: any
  ): ExitDecision {
    const decision: ExitDecision = {
      action: standardExit.action,
      reason: standardExit.reason || '',
      confidence: this.calculateConfidence(standardExit),
      exitPrice: state.currentPrice,
      exitStage: standardExit.stage,
      factors: [],
    };

    // SKILL 1: Early Exit Recognition
    // Level 5+: Detect exit 1-2 candles before reversal
    if (this.skill_levels['early_exit_recognition'] >= 5) {
      if (microstructure.action === 'EXIT' && decision.action === 'HOLD') {
        decision.action = 'EXIT';
        decision.reason = `[Early Recognition] ${microstructure.reason}`;
        decision.factors.push('Early exit recognition activated');
      }
    }

    // SKILL 2: Profit Scaling Mastery
    // Level 8+: Lock more of profits at key levels
    if (this.skill_levels['profit_scaling_mastery'] >= 8) {
      if (state.profitPercent > 0.04 && standardExit.stage === 'AGGRESSIVE_TRAIL') {
        // Reduce trail tightness by 20% to let it run more
        decision.factors.push('Profit scaling mastery: Widened trail for max gains');
      }
    }

    // SKILL 3: Liquidity Sensing
    // Level 7+: Exit before spread crisis
    if (this.skill_levels['liquidation_detection'] >= 7) {
      if (state.microstructure?.spread > state.microstructure?.spread * 3) {
        decision.action = 'EXIT';
        decision.reason = 'Liquidity crisis sensed - exiting before spread blows out';
        decision.factors.push('Liquidity sensing: Market health deteriorating');
      }
    }

    // SKILL 4: Time-Based Wisdom
    // Level 10: Perfect time-based exits
    if (this.skill_levels['time_exit_mastery'] >= 10 && state.timeHeldHours > 168) {
      if (state.profitPercent < 0.01) {
        decision.action = 'EXIT';
        decision.reason = 'Time exit mastery: Trade exhausted, capital needed elsewhere';
        decision.factors.push('Time exit wisdom: 7+ days, minimal profit');
      }
    }

    return decision;
  }

  /**
   * Apply personality to exit decisions
   * Aggressive: Hold longer, take more risk
   * Conservative: Exit earlier, protect gains
   */
  private applyPersonalityBias(decision: ExitDecision, state: any): ExitDecision {
    const adjusted = { ...decision };

    if (this.personality === 'aggressive') {
      // Hold longer on winners, accept larger stops
      if (state.profitPercent > 0.02) {
        adjusted.reason += ' [Aggressive: Holding for max gains]';
        adjusted.confidence *= 0.95; // Accept slightly lower confidence
      }
    } else if (this.personality === 'conservative') {
      // Exit earlier, protect small wins
      if (state.profitPercent > 0.01) {
        adjusted.reason = 'Conservative exit: Profit locked at optimal level';
        adjusted.action = 'EXIT';
      }
    } else {
      // Balanced: Follow standard logic
    }

    return adjusted;
  }

  /**
   * Calculate exit confidence (affects signal weight)
   */
  private calculateConfidence(exitUpdate: ExitUpdate): number {
    let confidence = 0.5;

    // Stage-based confidence
    switch (exitUpdate.stage) {
      case 'INITIAL_RISK':
        confidence = 0.6; // Lower confidence on first stage
        break;
      case 'BREAKEVEN':
        confidence = 0.7;
        break;
      case 'PROFIT_LOCK':
        confidence = 0.8;
        break;
      case 'AGGRESSIVE_TRAIL':
        confidence = 0.75; // Trail can be risky
        break;
    }

    // Boost for clear reasoning
    if (exitUpdate.reason && exitUpdate.reason.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Record decision for learning
   */
  private recordExitDecision(decision: ExitDecision, state: any): void {
    // This will feed into agent.updatePerformance()
    this.decisions_made.push({
      timestamp: Date.now(),
      type: 'EXIT',
      decision: decision.action,
      confidence: decision.confidence,
      reason: decision.reason,
      state,
    });
  }

  getStatus() {
    return {
      ...super.getStatus(),
      specialist: 'Exit Orchestration',
      key_skills: {
        exit_timing: this.skill_levels['exit_timing'],
        stage_recognition: this.skill_levels['stage_recognition'],
        liquidation_detection: this.skill_levels['liquidation_detection'],
        profit_preservation: this.skill_levels['profit_preservation'],
      },
      specialization: `${this.personality} exit strategy, ${this.personality === 'aggressive' ? 'maximum gain extraction' : 'risk protection focused'}`,
    };
  }
}

// ============================================================================
// AGENT 2: OPPOSITION RESISTANCE AGENT
// ============================================================================
/**
 * Specialist in reading opposition (resistance levels, support zones)
 * Detects when opposition is weakening or strengthening
 * 
 * Skills:
 * - opposition_sensing: Feel when support/resistance will fail (0-10)
 * - level_identification: Spot key technical levels (0-10)
 * - breakout_timing: Know when levels will break (0-10)
 * - consolidation_detection: Identify pause zones (0-10)
 */

export class OppositionResistanceAgent extends TradingAgent {
  readonly SKILL_THRESHOLDS = {
    'opposition_breakdown_detection': { level: 6, impact: 'Detect support breakdown 1 candle early' },
    'resistance_break_prediction': { level: 8, impact: '85% accuracy on resistance breaks' },
    'support_zone_mapping': { level: 7, impact: 'Identify 5+ support levels' },
    'consolidation_mastery': { level: 9, impact: 'Exit consolidations with 90% accuracy' },
  };

  constructor(name: string = 'OppositionReader', personality: 'aggressive' | 'balanced' | 'conservative' = 'balanced') {
    super(name, 'OPPOSITION_READER', personality);

    this.skill_levels = {
      'opposition_sensing': personality === 'aggressive' ? 3 : 6,
      'level_identification': 5,
      'breakout_timing': personality === 'aggressive' ? 7 : 4,
      'consolidation_detection': 5,
    };
  }

  /**
   * Analyze opposition strength and predict failure points
   */
  analyzeOpposition(state: {
    currentPrice: number;
    supportLevels: number[];
    resistanceLevels: number[];
    volume: number;
    priceVelocity: number; // rate of change
    volatility: number;
    timeToSupport: number; // candles until price reaches support
  }): OppositionAnalysis {
    const analysis: OppositionAnalysis = {
      nearestSupport: Math.max(...state.supportLevels),
      nearestResistance: Math.min(...state.resistanceLevels),
      supportStrength: this.calculateSupportStrength(state),
      resistanceStrength: this.calculateResistanceStrength(state),
      breakoutProbability: this.calculateBreakoutProbability(state),
      exitRecommendation: this.getExitRecommendation(state),
      factors: [],
    };

    // Apply skill modifiers
    analysis.supportStrength *= (1 + this.skill_levels['opposition_sensing'] * 0.05);
    analysis.resistanceStrength *= (1 + this.skill_levels['opposition_sensing'] * 0.05);
    analysis.breakoutProbability = this.applyBreakoutSkill(analysis.breakoutProbability);

    return analysis;
  }

  /**
   * Calculate how strong support is (will it hold?)
   * Based on: distance, volume, price velocity
   */
  private calculateSupportStrength(state: any): number {
    let strength = 0.5;

    // Distance factor: closer = stronger
    const distance = state.currentPrice - Math.max(...state.supportLevels);
    if (distance < state.volatility * 0.5) strength += 0.3; // Very close
    else if (distance < state.volatility * 2) strength += 0.15; // Medium distance

    // Velocity factor: slower approach = stronger support
    if (state.priceVelocity < -0.005) strength -= 0.2; // Fast down = weak support
    else if (state.priceVelocity > -0.002) strength += 0.1; // Slow down = strong

    // Volume factor: high volume at support = strong
    if (state.volume > 10000) strength += 0.15;

    return Math.max(0, Math.min(1, strength));
  }

  /**
   * Calculate how strong resistance is (will it hold?)
   */
  private calculateResistanceStrength(state: any): number {
    let strength = 0.5;

    // Distance factor
    const distance = Math.min(...state.resistanceLevels) - state.currentPrice;
    if (distance < state.volatility * 0.5) strength += 0.3;
    else if (distance < state.volatility * 2) strength += 0.15;

    // Velocity factor: fast approach = strong resistance (will test it hard)
    if (state.priceVelocity > 0.005) strength += 0.2; // Fast up = tests resistance
    else if (state.priceVelocity < 0.002) strength -= 0.1; // Slow = weak

    return Math.max(0, Math.min(1, strength));
  }

  /**
   * Predict likelihood of breaking through resistance/support
   */
  private calculateBreakoutProbability(state: any): number {
    let probability = 0.5;

    // High volume + approaching level = likely breakout
    if (state.volume > 15000 && state.timeToSupport < 3) {
      probability += 0.3;
    }

    // High volatility = more breakouts
    if (state.volatility > 0.02) probability += 0.15;

    // Price velocity factor
    if (Math.abs(state.priceVelocity) > 0.01) probability += 0.1;

    return Math.min(probability, 0.95); // Cap at 95%
  }

  /**
   * Apply breakout timing skill
   */
  private applyBreakoutSkill(baseProbability: number): number {
    const skillBoost = this.skill_levels['breakout_timing'] * 0.02; // 2% per level
    return Math.min(baseProbability + skillBoost, 0.95);
  }

  /**
   * Determine when to exit based on opposition analysis
   */
  private getExitRecommendation(state: any): string {
    if (this.skill_levels['consolidation_detection'] >= 7) {
      // Can detect consolidations
      if (state.volatility < 0.005) {
        return 'CONSOLIDATION: Wait for breakout';
      }
    }

    // Level-based recommendations
    const nearestSupport = Math.max(...state.supportLevels);
    const distance = state.currentPrice - nearestSupport;

    if (distance < state.volatility * 0.3) {
      return 'NEAR_SUPPORT: Exit to avoid test';
    }

    if (this.skill_levels['opposition_breakdown_detection'] >= 6) {
      if (state.priceVelocity < -0.01) {
        return 'BREAKDOWN: Support failing, exit NOW';
      }
    }

    return 'HOLD';
  }

  getStatus() {
    return {
      ...super.getStatus(),
      specialist: 'Opposition & Resistance',
      key_skills: {
        opposition_sensing: this.skill_levels['opposition_sensing'],
        level_identification: this.skill_levels['level_identification'],
        breakout_timing: this.skill_levels['breakout_timing'],
        consolidation_detection: this.skill_levels['consolidation_detection'],
      },
    };
  }
}

// ============================================================================
// AGENT 3: MARKET MICROSTRUCTURE SPECIALIST
// ============================================================================
/**
 * Reads order book and market structure
 * Detects when a move is running out of gas
 * 
 * Skills:
 * - order_flow_reading: Interpret bid/ask imbalance (0-10)
 * - liquidity_sensing: Feel when market depth disappears (0-10)
 * - spread_interpretation: Read spread widening warnings (0-10)
 * - momentum_exhaustion: Know when moves are tiring (0-10)
 */

export class MicrostructureSpecialistAgent extends TradingAgent {
  readonly SKILL_THRESHOLDS = {
    'order_flow_mastery': { level: 8, impact: 'Predict reversals from order flow' },
    'liquidity_crisis_detection': { level: 6, impact: 'Exit before spread crisis' },
    'depth_reading': { level: 7, impact: 'Read full depth picture' },
    'momentum_exhaustion_sensing': { level: 9, impact: 'Detect momentum death 2 candles early' },
  };

  constructor(name: string = 'Microstructure', personality: 'aggressive' | 'balanced' | 'conservative' = 'balanced') {
    super(name, 'MICROSTRUCTURE_SPECIALIST', personality);

    this.skill_levels = {
      'order_flow_reading': personality === 'aggressive' ? 4 : 7,
      'liquidity_sensing': personality === 'conservative' ? 8 : 5,
      'spread_interpretation': 5,
      'momentum_exhaustion': personality === 'aggressive' ? 3 : 7,
    };
  }

  /**
   * Analyze microstructure deterioration
   */
  analyzeMicrostructure(market: {
    bidVolume: number;
    askVolume: number;
    spread: number;
    normalSpread: number;
    netFlow: number; // cumulative bid-ask flow
    depth: number; // sum of bid+ask volume
    volumeSpike: number;
    momentum: number; // directional strength
  }): MicrostructureSignal {
    const signal: MicrostructureSignal = {
      healthScore: 0.7,
      orderFlowBias: this.calculateOrderFlowBias(market),
      liquidityAlert: this.checkLiquidityCrisis(market),
      spreadWarning: this.checkSpreadWarning(market),
      depthStatus: this.analyzeDepth(market),
      exitUrgency: 'HOLD',
      reason: '',
    };

    // Combine signals
    if (signal.liquidityAlert) signal.exitUrgency = 'EXIT_URGENT';
    else if (signal.spreadWarning) signal.exitUrgency = 'TIGHTEN_STOP';
    else if (signal.orderFlowBias < -0.3) signal.exitUrgency = 'EXIT_STANDARD';

    return signal;
  }

  private calculateOrderFlowBias(market: any): number {
    const ratio = (market.bidVolume - market.askVolume) / (market.bidVolume + market.askVolume);
    const skill = this.skill_levels['order_flow_reading'];

    // Higher skill = better at reading subtle flows
    const sensitivity = 1 + skill * 0.05;

    return ratio * sensitivity;
  }

  private checkLiquidityCrisis(market: any): boolean {
    const spreadMultiple = market.spread / market.normalSpread;
    const depthDropPercent = 1 - market.depth / 10000; // vs normal

    // Skill 6+: Detect crisis earlier
    const threshold = this.skill_levels['liquidity_sensing'] >= 6 ? 2.5 : 3.0;

    return spreadMultiple > threshold || depthDropPercent > 0.5;
  }

  private checkSpreadWarning(market: any): boolean {
    const spreadMultiple = market.spread / market.normalSpread;
    return spreadMultiple > 2.0 && spreadMultiple < 3.0;
  }

  private analyzeDepth(market: any): 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HEALTHY' {
    if (market.depth < 1000) return 'CRITICAL';
    if (market.depth < 5000) return 'LOW';
    if (market.depth < 10000) return 'MEDIUM';
    return 'HEALTHY';
  }

  getStatus() {
    return {
      ...super.getStatus(),
      specialist: 'Market Microstructure',
      key_skills: {
        order_flow_reading: this.skill_levels['order_flow_reading'],
        liquidity_sensing: this.skill_levels['liquidity_sensing'],
        spread_interpretation: this.skill_levels['spread_interpretation'],
        momentum_exhaustion: this.skill_levels['momentum_exhaustion'],
      },
    };
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExitDecision {
  action: 'HOLD' | 'EXIT' | 'REDUCE';
  reason: string;
  confidence: number;
  exitPrice: number;
  exitStage: string;
  factors: string[];
  // Optional metadata
  timestamp?: number; // epoch ms when decision was made
  agentId?: string;
  severity?: number; // 0-1 indicating urgency
}

export interface OppositionAnalysis {
  nearestSupport: number;
  nearestResistance: number;
  supportStrength: number; // 0-1
  resistanceStrength: number; // 0-1
  breakoutProbability: number; // 0-1
  exitRecommendation: string;
  factors: string[];
  // Optional metadata
  timestamp?: number;
  confidence?: number; // overall confidence 0-1
}

export interface MicrostructureSignal {
  healthScore: number; // 0-1
  orderFlowBias: number; // -1 to +1
  liquidityAlert: boolean;
  spreadWarning: boolean;
  depthStatus: 'CRITICAL' | 'LOW' | 'MEDIUM' | 'HEALTHY';
  exitUrgency: 'HOLD' | 'TIGHTEN_STOP' | 'EXIT_STANDARD' | 'EXIT_URGENT';
  reason: string;
  // Optional market metrics
  timestamp?: number;
  bidAskImbalance?: number;
  vwap?: number;
  volume?: number;
  lastUpdated?: number;
}

// Classes are exported inline above; no additional re-exports required.
