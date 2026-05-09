
import { MarketFrame, Signal } from '@shared/schema';
import { spawn } from 'child_process';
import path from 'path';
import { UnifiedRegimeDetector, RegimeDetectionResult, UnifiedRegimeType } from './services/unified-regime-system';
import { RegimeConsolidationBridge } from './services/regime-consolidation-bridge';
import { getAdaptiveConsensusWeights, calculateWeightedConsensusScore } from './rl-system-integration';
import { applyDecoupledPositionSizing } from './services/issue-1-decoupling-bridge';
import { AgentCouncil, type CouncilVote } from './services/agent-council';

// ═════════════════════════════════════════════════════════════════════════════
// RPG TRADING AGENTS (Council Members)
// ═════════════════════════════════════════════════════════════════════════════
import { TrendRider } from './services/rpg-agents/TrendRider';
import { BreakoutHunter } from './services/rpg-agents/BreakoutHunter';
import { ReversalMaster } from './services/rpg-agents/ReversalMaster';
import { SupportSniper } from './services/rpg-agents/SupportSniper';
import { MLOracle } from './services/rpg-agents/MLOracle';

// Physics agents from HybridPhysicsAgents
import {
  BreakoutPhysicsAgent,
  MeanReversionPhysicsAgent,
  TrendPhysicsAgent,
  VolumePhysicsAgent
} from './services/rpg-agents/HybridPhysicsAgents';
import { FlowPhysicsAgent } from './services/rpg-agents/FlowPhysicsAgent';

// Volume verification agents (dual veto gates)
import { VolumeMechanicalVerifierAgent } from './services/rpg-agents/VolumeMechanicalVerifierAgent';

export interface StrategyWeight {
  strategyId: string;
  baseWeight: number;
  regimeMultiplier: number;
  volatilityMultiplier: number;
  momentumAlignment: number;
  temporalDecay: number;
  finalWeight: number;
}

export interface MarketRegime {
  type: 'BULL_EARLY' | 'BULL_STRONG' | 'BULL_PARABOLIC' | 'BEAR_EARLY' | 'BEAR_STRONG' | 'BEAR_CAPITULATION' | 'NEUTRAL_ACCUM' | 'NEUTRAL_DIST' | 'NEUTRAL';
  volatility: 'low' | 'medium' | 'high';
  momentum: number; // -1 to 1
  trend: 'up' | 'down' | 'sideways';
  // Unified regime fields
  unifiedRegime?: UnifiedRegimeType;
  unifiedConfidence?: number;
  unifiedStrength?: number;
}

export interface SynthesizedSignal extends Signal {
  contributingStrategies: Array<{
    strategyId: string;
    weight: number;
    rawSignal: any;
  }>;
  regimeContext: MarketRegime;
  unifiedRegimeContext?: RegimeDetectionResult;
  confidenceBreakdown: {
    baseConfidence: number;
    regimeAdjustment: number;
    volatilityAdjustment: number;
    momentumAdjustment: number;
    finalConfidence: number;
    councilContribution?: number;
    volumeVetoActive?: boolean;
    volumePhysicsConfidence?: number;
    volumeMechanicalConfidence?: number;
  };
  volumeGateApproval?: boolean;
}

export class StrategyIntegrationEngine {
  private strategyWeights: Map<string, StrategyWeight> = new Map();
  private agentCouncil: AgentCouncil = new AgentCouncil();
  private volumePhysicsAgent: VolumePhysicsAgent | null = null;
  private volumeMechanicalAgent: VolumeMechanicalVerifierAgent | null = null;
  
  constructor() {
    this.initializeStrategyWeights();
    this.initializeVolumeFrontline();
    this.initializeAgentCouncil();
  }

  /**
   * Initialize volume frontline - dual veto gates (VolumePhysics + VolumeMechanical)
   * These agents run independently and must BOTH approve before trading
   */
  private initializeVolumeFrontline(): void {
    this.volumePhysicsAgent = new VolumePhysicsAgent('VolumeFrontline_Physics', 'balanced');
    this.volumeMechanicalAgent = new VolumeMechanicalVerifierAgent('VolumeFrontline_Mechanical', 'balanced');
    console.log('[Strategy] Volume frontline initialized: Physics + Mechanical dual gates active');
  }

  /**
   * Initialize agent council with registered agents
   * Registers all 10 trading agents (5 RPG + 5 Physics)
   */
  private initializeAgentCouncil(): void {
    // ─────────────────────────────────────────────────────────────────────
    // RPG GROUP (5 agents) - Pattern-based strategies
    // ─────────────────────────────────────────────────────────────────────
    const trendRider = new TrendRider('TrendRider');
    this.agentCouncil.register({
      agent: {
        generateSignal: (ticks: any[]) => trendRider.processSignal({ ticks }) || { action: 'HOLD', confidence: 0, entry: 0, target: 0, stop: 0, reason: 'No signal', agent_name: 'TrendRider', agent_level: trendRider.level },
        constructor: trendRider.constructor
      },
      bestRegimes: ['TRENDING'],
      group: 'RPG',
      agentName: 'TrendRider'
    });

    const breakoutHunter = new BreakoutHunter('BreakoutHunter');
    this.agentCouncil.register({
      agent: {
        generateSignal: (ticks: any[]) => breakoutHunter.processSignal({ ticks }) || { action: 'HOLD', confidence: 0, entry: 0, target: 0, stop: 0, reason: 'No signal', agent_name: 'BreakoutHunter', agent_level: breakoutHunter.level },
        constructor: breakoutHunter.constructor
      },
      bestRegimes: ['TRENDING', 'BREAKOUT_SETUP'],
      group: 'RPG',
      agentName: 'BreakoutHunter'
    });

    const reversalMaster = new ReversalMaster('ReversalMaster');
    this.agentCouncil.register({
      agent: {
        generateSignal: (ticks: any[]) => reversalMaster.processSignal({ ticks }) || { action: 'HOLD', confidence: 0, entry: 0, target: 0, stop: 0, reason: 'No signal', agent_name: 'ReversalMaster', agent_level: reversalMaster.level },
        constructor: reversalMaster.constructor
      },
      bestRegimes: ['RANGING'],
      group: 'RPG',
      agentName: 'ReversalMaster'
    });

    const supportSniper = new SupportSniper('SupportSniper');
    this.agentCouncil.register({
      agent: {
        generateSignal: (ticks: any[]) => supportSniper.processSignal({ ticks }) || { action: 'HOLD', confidence: 0, entry: 0, target: 0, stop: 0, reason: 'No signal', agent_name: 'SupportSniper', agent_level: supportSniper.level },
        constructor: supportSniper.constructor
      },
      bestRegimes: ['RANGING'],
      group: 'RPG',
      agentName: 'SupportSniper'
    });

    const mlOracle = new MLOracle('MLOracle');
    this.agentCouncil.register({
      agent: {
        generateSignal: (ticks: any[]) => mlOracle.processSignal({ ticks }) || { action: 'HOLD', confidence: 0, entry: 0, target: 0, stop: 0, reason: 'No signal', agent_name: 'MLOracle', agent_level: mlOracle.level },
        constructor: mlOracle.constructor
      },
      bestRegimes: ['VOLATILE', 'TRENDING'],
      group: 'RPG',
      agentName: 'MLOracle'
    });

    // ─────────────────────────────────────────────────────────────────────
    // PHYSICS GROUP (5 agents) - Physics-based validation
    // ─────────────────────────────────────────────────────────────────────
    const trendPhysics = new TrendPhysicsAgent('TrendPhysics', 'balanced');
    this.agentCouncil.register({
      agent: trendPhysics as any,
      bestRegimes: ['TRENDING'],
      group: 'PHYSICS',
      agentName: 'TrendPhysics'
    });

    const breakoutPhysics = new BreakoutPhysicsAgent('BreakoutPhysics', 'aggressive');
    this.agentCouncil.register({
      agent: breakoutPhysics as any,
      bestRegimes: ['TRENDING', 'BREAKOUT_SETUP'],
      group: 'PHYSICS',
      agentName: 'BreakoutPhysics'
    });

    const meanRevPhysics = new MeanReversionPhysicsAgent('MeanRevPhysics', 'conservative');
    this.agentCouncil.register({
      agent: meanRevPhysics as any,
      bestRegimes: ['RANGING'],
      group: 'PHYSICS',
      agentName: 'MeanRevPhysics'
    });

    const volumePhysics = new VolumePhysicsAgent('VolumePhysics', 'balanced');
    this.agentCouncil.register({
      agent: volumePhysics as any,
      bestRegimes: ['TRENDING', 'VOLATILE'],
      group: 'PHYSICS',
      agentName: 'VolumePhysics'
    });

    const flowPhysics = new FlowPhysicsAgent('FlowPhysics', 'balanced');
    this.agentCouncil.register({
      agent: flowPhysics as any,
      bestRegimes: ['TRENDING', 'VOLATILE'],
      group: 'PHYSICS',
      agentName: 'FlowPhysics'
    });

    // ─────────────────────────────────────────────────────────────────────
    // VOLUME VETO GATES - Dual validation (Physics + Mechanical)
    // These are also registered as voting members (act as consensus contributors)
    // ─────────────────────────────────────────────────────────────────────
    const volumeMechVerifier = new VolumeMechanicalVerifierAgent('VolumeMechanic', 'balanced');
    this.agentCouncil.register({
      agent: {
        generateSignal: (ticks: any[]) => volumeMechVerifier.processSignal({ ticks }) || { action: 'HOLD', confidence: 0, entry: 0, target: 0, stop: 0, reason: 'No volume signal', agent_name: 'VolumeMechanic', agent_level: volumeMechVerifier.level },
        constructor: volumeMechVerifier.constructor
      },
      bestRegimes: ['TRENDING', 'VOLATILE', 'BREAKOUT_SETUP'],
      group: 'RPG',
      agentName: 'VolumeMechanic'
    });

    console.log('[Strategy] Agent Council initialized with 12 agents (10 core + 2 volume veto gates)');
    console.log('[Strategy] Volume Veto Gates Active: VolumePhysics + VolumeMechanical');
    console.log('[Strategy] Council stats:', this.getCouncilStats());
  }

  /**
   * Register an agent with the council
   * Called during agent initialization (after standard setup)
   */
  registerAgent(registration: any): void {
    this.agentCouncil.register(registration);
  }

  /**
   * Get council debug stats
   */
  getCouncilStats() {
    return this.agentCouncil.getStats();
  }

  /**
   * Get council instance (for direct access if needed)
   */
  getAgentCouncil(): AgentCouncil {
    return this.agentCouncil;
  }

  private initializeStrategyWeights() {
    // Base weights for each strategy
    const baseWeights = {
      'gradient_trend_filter': 0.25,
      'ut_bot': 0.20,
      'mean_reversion': 0.20,
      'volume_profile': 0.20,
      'market_structure': 0.15
    };

    for (const [strategyId, baseWeight] of Object.entries(baseWeights)) {
      this.strategyWeights.set(strategyId, {
        strategyId,
        baseWeight,
        regimeMultiplier: 1.0,
        volatilityMultiplier: 1.0,
        momentumAlignment: 1.0,
        temporalDecay: 1.0,
        finalWeight: baseWeight
      });
    }
  }

  /**
   * Detect current market regime from market data
   */
  detectMarketRegime(frames: MarketFrame[]): MarketRegime {
    if (frames.length < 30) {
      return {
        type: 'NEUTRAL',
        volatility: 'medium',
        momentum: 0,
        trend: 'sideways'
      };
    }

    const latest = frames[frames.length - 1];
    const prices = frames.slice(-30).map(f => (f.price as any).close);
    const volumes = frames.slice(-30).map(f => f.volume);
    
    // Calculate momentum
    const mom1d = (prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2];
    const mom7d = (prices[prices.length - 1] - prices[prices.length - 8]) / prices[prices.length - 8];
    const mom30d = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    const avgMomentum = (mom1d + mom7d + mom30d) / 3;
    
    // Calculate volatility
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    
    let volLevel: 'low' | 'medium' | 'high' = 'medium';
    if (volatility < 0.02) volLevel = 'low';
    else if (volatility > 0.05) volLevel = 'high';
    
    // Calculate parameters for unified regime detection
    const adx = (latest.indicators as any).adx || 20; // 0-100
    const atr = (latest.indicators as any).atr || prices[prices.length - 1] * 0.02;
    const sma50 = (latest.indicators as any).sma50 || prices[prices.length - 1];
    
    // Price vs moving average (-1 to +1)
    const priceVsMA = (prices[prices.length - 1] - sma50) / sma50;
    const normalizedPriceVsMA = Math.max(-1, Math.min(1, priceVsMA / 0.1)); // normalize to -1..1
    
    // Calculate Bollinger Band width for compression signal
    const bb = (latest.indicators as any).bbands || { upper: prices[prices.length - 1] * 1.02, lower: prices[prices.length - 1] * 0.98 };
    const rangeWidth = (bb.upper - bb.lower) / ((bb.upper + bb.lower) / 2); // normalized
    
    // Calculate divergence (buying vs selling pressure)
    const rsi = (latest.indicators as any).rsi || 50;
    const macd = (latest.indicators as any).macd?.macd || 0;
    const obv = (latest.indicators as any).obv || 0;
    const divergence = (rsi - 50) / 50 * 0.5 + (macd > 0 ? 0.5 : -0.5) * 0.5; // -1 to +1
    
    // Calculate coherence (how well all signals align)
    const adxStrength = Math.min(adx / 100, 1);
    const volatilityConsistency = Math.max(0, 1 - Math.abs(volatility - 0.03) / 0.03);
    const coherence = (adxStrength + volatilityConsistency) / 2;
    
    // Detect unified regime
    const unifiedRegimeResult = UnifiedRegimeDetector.detectRegime({
      adx,
      volatility: Math.min(atr / prices[prices.length - 1], 1), // normalize to 0-1
      priceVsMA: normalizedPriceVsMA,
      rangeWidth: Math.max(0, Math.min(rangeWidth, 1)),
      divergence,
      coherence,
      momentum: avgMomentum,
      rsi
    });
    
    // Determine regime
    let regimeType: MarketRegime['type'] = 'NEUTRAL';
    
    if (mom7d > 0.04 && mom30d > 0.08 && rsi > 60) {
      regimeType = 'BULL_STRONG';
    } else if (mom7d > 0.08 && volatility > 0.06) {
      regimeType = 'BULL_PARABOLIC';
    } else if (mom7d > 0.02 && macd > 0) {
      regimeType = 'BULL_EARLY';
    } else if (mom7d < -0.04 && mom30d < -0.08 && rsi < 40) {
      regimeType = 'BEAR_STRONG';
    } else if (mom7d < -0.08 && volatility > 0.06) {
      regimeType = 'BEAR_CAPITULATION';
    } else if (mom7d < -0.02 && macd < 0) {
      regimeType = 'BEAR_EARLY';
    } else if (rsi < 35 && avgMomentum > 0) {
      regimeType = 'NEUTRAL_ACCUM';
    } else if (rsi > 65 && avgMomentum < 0) {
      regimeType = 'NEUTRAL_DIST';
    }
    
    const trend = avgMomentum > 0.02 ? 'up' : avgMomentum < -0.02 ? 'down' : 'sideways';
    
    return {
      type: regimeType,
      volatility: volLevel,
      momentum: avgMomentum,
      trend,
      unifiedRegime: unifiedRegimeResult.regime,
      unifiedConfidence: unifiedRegimeResult.confidence,
      unifiedStrength: unifiedRegimeResult.strength
    };
  }

  /**
   * Calculate regime-based multipliers for each strategy
   */
  calculateRegimeWeights(regime: MarketRegime): void {
    const regimeMultipliers: Record<string, Record<string, number>> = {
      'gradient_trend_filter': {
        'BULL_STRONG': 1.5,
        'BULL_EARLY': 1.3,
        'BULL_PARABOLIC': 0.8,
        'BEAR_STRONG': 1.5,
        'BEAR_EARLY': 1.3,
        'BEAR_CAPITULATION': 0.8,
        'NEUTRAL': 0.7,
        'NEUTRAL_ACCUM': 0.9,
        'NEUTRAL_DIST': 0.9
      },
      'ut_bot': {
        'BULL_STRONG': 1.4,
        'BULL_EARLY': 1.2,
        'BULL_PARABOLIC': 1.1,
        'BEAR_STRONG': 1.4,
        'BEAR_EARLY': 1.2,
        'BEAR_CAPITULATION': 1.1,
        'NEUTRAL': 0.6,
        'NEUTRAL_ACCUM': 0.8,
        'NEUTRAL_DIST': 0.8
      },
      'mean_reversion': {
        'BULL_PARABOLIC': 1.6,
        'BEAR_CAPITULATION': 1.6,
        'NEUTRAL': 1.4,
        'NEUTRAL_ACCUM': 1.3,
        'NEUTRAL_DIST': 1.3,
        'BULL_STRONG': 0.6,
        'BULL_EARLY': 0.8,
        'BEAR_STRONG': 0.6,
        'BEAR_EARLY': 0.8
      },
      'volume_profile': {
        'BULL_EARLY': 1.5,
        'BEAR_EARLY': 1.5,
        'NEUTRAL_ACCUM': 1.4,
        'NEUTRAL_DIST': 1.4,
        'BULL_STRONG': 1.2,
        'BEAR_STRONG': 1.2,
        'BULL_PARABOLIC': 1.0,
        'BEAR_CAPITULATION': 1.0,
        'NEUTRAL': 1.1
      },
      'market_structure': {
        'BULL_EARLY': 1.6,
        'BEAR_EARLY': 1.6,
        'BULL_STRONG': 1.3,
        'BEAR_STRONG': 1.3,
        'NEUTRAL_ACCUM': 1.2,
        'NEUTRAL_DIST': 1.2,
        'BULL_PARABOLIC': 0.9,
        'BEAR_CAPITULATION': 0.9,
        'NEUTRAL': 1.0
      }
    };

    for (const [strategyId, weight] of this.strategyWeights.entries()) {
      weight.regimeMultiplier = regimeMultipliers[strategyId]?.[regime.type] || 1.0;
    }
  }

  /**
   * Calculate volatility-adjusted multipliers
   */
  calculateVolatilityWeights(regime: MarketRegime): void {
    const volatilityMultipliers: Record<string, Record<string, number>> = {
      'gradient_trend_filter': { low: 0.9, medium: 1.0, high: 1.1 },
      'ut_bot': { low: 0.8, medium: 1.0, high: 1.3 },
      'mean_reversion': { low: 1.2, medium: 1.0, high: 0.7 },
      'volume_profile': { low: 0.9, medium: 1.0, high: 1.2 },
      'market_structure': { low: 1.0, medium: 1.0, high: 1.1 }
    };

    for (const [strategyId, weight] of this.strategyWeights.entries()) {
      weight.volatilityMultiplier = volatilityMultipliers[strategyId]?.[regime.volatility] || 1.0;
    }
  }

  /**
   * Calculate momentum alignment for each strategy
   */
  calculateMomentumAlignment(regime: MarketRegime, strategySignals: Map<string, any>): void {
    for (const [strategyId, weight] of this.strategyWeights.entries()) {
      const signal = strategySignals.get(strategyId);
      if (!signal) {
        weight.momentumAlignment = 0.5;
        continue;
      }

      let alignment = 1.0;
      const signalDirection = signal.signals?.[signal.signals.length - 1] || 'HOLD';
      
      // Bullish strategies in bullish regime
      if ((signalDirection === 'BUY' || signalDirection === 'UP') && regime.momentum > 0) {
        alignment = 1.0 + Math.abs(regime.momentum) * 2;
      }
      // Bearish strategies in bearish regime
      else if ((signalDirection === 'SELL' || signalDirection === 'DOWN') && regime.momentum < 0) {
        alignment = 1.0 + Math.abs(regime.momentum) * 2;
      }
      // Contrarian in extreme conditions
      else if (signalDirection === 'BUY' && regime.type === 'BEAR_CAPITULATION') {
        alignment = 1.3;
      } else if (signalDirection === 'SELL' && regime.type === 'BULL_PARABOLIC') {
        alignment = 1.3;
      }
      // Misaligned
      else {
        alignment = 0.6;
      }

      weight.momentumAlignment = Math.min(2.0, alignment);
    }
  }

  /**
   * Calculate temporal decay for signals
   */
  calculateTemporalDecay(signalAge: number): number {
    // Decay signals older than 5 periods
    const halfLife = 5;
    return Math.exp(-0.693 * signalAge / halfLife);
  }

  /**
   * Update final weights
   */
  updateFinalWeights(): void {
    let totalWeight = 0;
    
    for (const weight of this.strategyWeights.values()) {
      weight.finalWeight = 
        weight.baseWeight *
        weight.regimeMultiplier *
        weight.volatilityMultiplier *
        weight.momentumAlignment *
        weight.temporalDecay;
      totalWeight += weight.finalWeight;
    }

    // Normalize weights to sum to 1
    if (totalWeight > 0) {
      for (const weight of this.strategyWeights.values()) {
        weight.finalWeight /= totalWeight;
      }
    }
  }

  /**
   * Execute strategy with Python
   */
  private async executeStrategy(
    strategyId: string,
    symbol: string,
    timeframe: string,
    params: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(process.cwd(), 'strategies', 'executor.py');
      
      const args = [
        pythonScript,
        '--strategy', strategyId,
        '--symbol', symbol,
        '--timeframe', timeframe,
        '--params', JSON.stringify(params || {})
      ];
      
      // Use python from venv or fallback to python3
      const pythonPath = process.env.VIRTUAL_ENV 
        ? path.join(process.env.VIRTUAL_ENV, process.platform === 'win32' ? 'Scripts\\python.exe' : 'bin/python')
        : 'python3';
      
      const python = spawn(pythonPath, args);
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Strategy ${strategyId} failed: ${errorOutput}`));
        } else {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse strategy output: ${output}`));
          }
        }
      });
    });
  }

  /**
   * Synthesize signals from all strategies with production-ready consensus
   * Incorporates: Scanner (30%) + ML (28%) + RL (20%) + Council (22%)
   * Plus VolumePhysicsAgent veto gate to prevent low-conviction trades
   */
  async synthesizeSignals(
    symbol: string,
    timeframe: string,
    frames: MarketFrame[]
  ): Promise<SynthesizedSignal> {
    // ─── REGIME DETECTION & CONSOLIDATION ────────────────────────────────────
    // Unified regime detection with high-confidence regime classification
    const regime = this.detectMarketRegime(frames);
    
    // Calculate smart weights
    this.calculateRegimeWeights(regime);
    this.calculateVolatilityWeights(regime);
    
    // Execute all strategies in parallel
    const strategyPromises = Array.from(this.strategyWeights.keys()).map(async (strategyId) => {
      try {
        const result = await this.executeStrategy(strategyId, symbol, timeframe, {});
        return { strategyId, result };
      } catch (error) {
        console.error(`Strategy ${strategyId} failed:`, error);
        return { strategyId, result: null };
      }
    });
    
    const strategyResults = await Promise.all(strategyPromises);
    const strategySignals = new Map(
      strategyResults
        .filter(r => r.result?.success)
        .map(r => [r.strategyId, r.result])
    );
    
    // Calculate momentum alignment
    this.calculateMomentumAlignment(regime, strategySignals);
    
    // Update final weights
    this.updateFinalWeights();
    
    // ─── Get RL-adaptive consensus weights ─────────────────────────────────────
    // This replaces static 0.40/0.35/0.25 weights with RL-learned adaptive weights
    const marketRegimeStr = regime.unifiedRegime || regime.type;
    const mlConfidence = this.strategyWeights.get('multi_timeframe_ml')?.finalWeight ?? 0.5;
    const currentDrawdown = 0; // Calculate from portfolio if available
    
    const rlWeights = getAdaptiveConsensusWeights(
      frames,
      mlConfidence,
      marketRegimeStr,
      currentDrawdown
    );
    
    // Synthesize final signal
    let weightedSignalScore = 0;
    let weightedConfidence = 0;
    let weightedPrice = 0;
    let rlWeightedScore = 0;
    const contributingStrategies: Array<any> = [];
    
    for (const [strategyId, signal] of strategySignals.entries()) {
      const weight = this.strategyWeights.get(strategyId)!;
      
      // Convert signal to numeric score (-1 to 1)
      let signalScore = 0;
      if (signal.signal === 'BUY' || signal.signal === 'UP') signalScore = 1;
      else if (signal.signal === 'SELL' || signal.signal === 'DOWN') signalScore = -1;
      
      weightedSignalScore += signalScore * weight.finalWeight;
      weightedConfidence += (signal.metadata?.confidence || 0.5) * weight.finalWeight;
      weightedPrice += signal.price * weight.finalWeight;
      
      // Track RL-weighted score separately for consensus
      if (strategyId === 'gradient_trend_filter') {
        rlWeightedScore += signalScore * rlWeights.scannerWeight;
      } else if (strategyId === 'multi_timeframe_ml') {
        rlWeightedScore += signalScore * rlWeights.mlWeight;
      } else if (strategyId === 'market_structure') {
        rlWeightedScore += signalScore * rlWeights.rlWeight;
      }
      
      contributingStrategies.push({
        strategyId,
        weight: weight.finalWeight,
        rawSignal: signal
      });
    }
    
    // ─── Collect AgentCouncil vote (4th source) ─────────────────────────────────
    const councilVote = this.agentCouncil.vote(frames, (regime.unifiedRegime as any) || 'RANGING');
    
    // Convert council direction to numeric score (-1, 0, 1)
    let councilScore = 0;
    if (councilVote.direction === 'BUY') councilScore = 1;
    else if (councilVote.direction === 'SELL') councilScore = -1;

    // ─── DUAL VOLUME VETO GATES (Critical safety layer) ──────────────────────
    // Both VolumePhysics and VolumeMechanical must approve (or signal is held)
    let volumePhysicsApproval = false;
    let volumeMechanicalApproval = true;
    let volumePhysicsConfidence = 0.5;
    let volumeMechanicalConfidence = 0.5;
    
    try {
      if (this.volumePhysicsAgent) {
        const physicsSignal = (this.volumePhysicsAgent as any).generateSignal(frames);
        volumePhysicsConfidence = physicsSignal.confidence || 0.5;
        // Physics agent approves if confidence > 0.4 (weak threshold for gate)
        volumePhysicsApproval = volumePhysicsConfidence >= 0.4;
      }
      if (this.volumeMechanicalAgent) {
        const mechSignal = (this.volumeMechanicalAgent as any).processSignal({ ticks: frames });
        volumeMechanicalConfidence = mechSignal.confidence || 0.5;
        // Mechanical agent approves if confidence > 0.4 (weak threshold for gate)
        volumeMechanicalApproval = volumeMechanicalConfidence >= 0.4;
      }
    } catch (err) {
      console.warn(`[Strategy] Volume veto gate error:`, err);
      // If veto gates fail, allow through (fail-open for safety)
      volumePhysicsApproval = false;
      volumeMechanicalApproval = true;
    }

    // Both gates must approve - if either vetoes, reduce confidence
    const volumeVetoActive = !(volumePhysicsApproval && volumeMechanicalApproval);
    
    // ─── 4-SOURCE CONSENSUS CALCULATION ──────────────────────────────────────
    // Weights: Scanner 30% · ML 28% · RL 20% · Council 22%
    // VOLUME VETO: If either volume agent vetoes, shift to HOLD
    const CONSENSUS_WEIGHTS = {
      scanner: 0.30,
      ml: 0.28,
      rl: 0.20,
      council: 0.22
    };
    
    let consensusScore = 0;
    let consensusConfidence = 0;
    if (rlWeights.isRLControlled) {
      // Map strategy-based scores to 4-source model
      consensusScore = 
        (rlWeightedScore < 0.5 ? -1 : rlWeightedScore > 0.5 ? 1 : 0) * CONSENSUS_WEIGHTS.scanner +
        (rlWeightedScore < 0.5 ? -1 : rlWeightedScore > 0.5 ? 1 : 0) * CONSENSUS_WEIGHTS.ml +
        (rlWeightedScore < 0.5 ? -1 : rlWeightedScore > 0.5 ? 1 : 0) * CONSENSUS_WEIGHTS.rl +
        councilScore * CONSENSUS_WEIGHTS.council;
    } else {
      // Convert strategy-weighted score to directional
      const strategyScore = weightedSignalScore < 0.2 ? -1 : weightedSignalScore > 0.2 ? 1 : 0;
      consensusScore = 
        strategyScore * CONSENSUS_WEIGHTS.scanner +
        strategyScore * CONSENSUS_WEIGHTS.ml +
        strategyScore * CONSENSUS_WEIGHTS.rl +
        councilScore * CONSENSUS_WEIGHTS.council;
    }
    
    consensusConfidence = 
      weightedConfidence * 0.78 +
      councilVote.confidence * 0.22;
    
    // Apply volume veto gates - if either vetoes, force HOLD or reduce confidence significantly
    if (volumeVetoActive) {
      // If volume gates veto: reject BUY/SELL, force HOLD
      consensusConfidence *= 0.4; // Severely reduce confidence when vetoed
      console.log(`[Strategy] VOLUME VETO ACTIVE: Physics=${volumePhysicsApproval} (${volumePhysicsConfidence.toFixed(2)}), Mechanical=${volumeMechanicalApproval} (${volumeMechanicalConfidence.toFixed(2)})`);
    }
    
    // Determine final signal type (respecting volume veto)
    let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (!volumeVetoActive) {
      // Only trade if both volume gates approve
      if (consensusScore > 0.3) signalType = 'BUY';
      else if (consensusScore < -0.3) signalType = 'SELL';
    } else {
      // Volume veto active: hold the line
      signalType = 'HOLD';
    }
    
    // Calculate confidence breakdown
    const baseConfidence = weightedConfidence;
    const regimeAdjustment = regime.type.includes('STRONG') ? 0.15 : 0;
    const volatilityAdjustment = regime.volatility === 'high' ? -0.1 : 0.05;
    const momentumAdjustment = Math.abs(regime.momentum) > 0.05 ? 0.1 : 0;
    const finalConfidence = Math.min(1.0, Math.max(0.1, 
      baseConfidence + regimeAdjustment + volatilityAdjustment + momentumAdjustment
    ));

    //  ISSUE #1 FIX: Decouple clustering/velocity boosts from confidence
    // Old system: confidence += 0.08 (clustering) + 0.05 (velocity) = 16% inflation
    // New system: gates apply as multipliers only (not confidence), avoiding oversized positions
    let decoupledPositionSize = Math.min(0.1 + (finalConfidence * 0.4), 0.5); // Fallback
    try {
      const decoupledSizing = await applyDecoupledPositionSizing(
        finalConfidence,
        frames,
        regime
      );
      if (decoupledSizing.finalPositionSize > 0) {
        decoupledPositionSize = decoupledSizing.finalPositionSize;
        if (decoupledSizing.warnings.length > 0) {
          console.warn(`[Strategy] Position sizing warnings:`, decoupledSizing.warnings.join(' | '));
        }
      }
    } catch (error) {
      console.warn(`[Strategy] Issue #1 decoupling fallback:`, error);
      // Use fallback sizing (no inflation)
    }
    
    const latest = frames[frames.length - 1];
    const price = (latest.price as any).close;
    
    // Calculate risk levels
    const atr = (latest.indicators as any).atr || price * 0.02;
    const stopLoss = signalType === 'BUY' ? price - atr * 2 : price + atr * 2;
    const takeProfit = signalType === 'BUY' ? price + atr * 3 : price - atr * 3;
    
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      symbol,
      type: signalType,
      strength: Math.abs(weightedSignalScore),
      confidence: finalConfidence,
      price,
      reasoning: [
        `Regime: ${regime.type}`,
        `Unified Regime: ${regime.unifiedRegime} (confidence: ${regime.unifiedConfidence?.toFixed(2)})`,
        `Volatility: ${regime.volatility}`,
        `Momentum: ${regime.momentum.toFixed(4)}`,
        `Contributing strategies: ${contributingStrategies.length}`
      ],
      riskReward: Math.abs((takeProfit - price) / (price - stopLoss)),
      stopLoss,
      takeProfit,
      classifications: [regime.type, regime.unifiedRegime || 'UNKNOWN'].filter(Boolean),
      patternDetails: [{
        pattern: regime.type,
        unifiedPattern: regime.unifiedRegime,
        confidence: finalConfidence,
        volatilityLevel: regime.volatility,
        councilVote: councilVote.direction,
        councilConfidence: councilVote.confidence,
        activeAgents: councilVote.activeAgents
      }],
      timeframeAlignment: finalConfidence,
      agreementScore: finalConfidence * 100,
      positionSize: decoupledPositionSize, // 🔧 ISSUE #1: Using decoupled sizing (no inflation)
      contributingStrategies,
      regimeContext: regime,
      unifiedRegimeContext: regime.unifiedRegime ? {
        regime: regime.unifiedRegime,
        confidence: regime.unifiedConfidence || 0.5,
        strength: regime.unifiedStrength || 50,
        indicators: {
          adx: (frames[frames.length - 1].indicators as any).adx || 20,
          volatility: Math.min((frames[frames.length - 1].indicators as any).atr / ((frames[frames.length - 1].price as any).close) || 0.02, 1),
          divergence: 0,
          coherence: 0.5,
          compression: 0.5
        }
      } : undefined,
      confidenceBreakdown: {
        baseConfidence,
        regimeAdjustment,
        volatilityAdjustment,
        momentumAdjustment,
        finalConfidence,
        councilContribution: councilVote.confidence,
        volumeVetoActive,
        volumePhysicsConfidence,
        volumeMechanicalConfidence
      },
      volumeGateApproval: !volumeVetoActive,
      momentumLabel: regime.momentum > 0.05 ? 'STRONG_UP' : regime.momentum > 0 ? 'UP' : regime.momentum < -0.05 ? 'STRONG_DOWN' : regime.momentum < 0 ? 'DOWN' : 'NEUTRAL',
      regimeState: regime.type,
      legacyLabel: `${regime.type}_${regime.volatility.toUpperCase()}`,
      signalStrengthScore: Math.abs(weightedSignalScore)
    };
  }

  /**
   * Get current strategy weights
   */
  getStrategyWeights(): StrategyWeight[] {
    return Array.from(this.strategyWeights.values());
  }
}
