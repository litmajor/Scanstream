/**
 * Enhanced Signal Classifier with ARM (Asymmetric Reaction Model) Integration
 * 
 * Extends base signal classification with:
 * - ARM-based asymmetric pressure detection
 * - Market state persistence tracking
 * - Confidence amplification through consensus
 * - Signal confirmation edge detection
 * - Multi-state classification (momentum, regime, ARM state)
 */

import { detectArm, generateModuleSignal, type ArmDetectionInput, type ModuleState, type Signal } from '../arm-template';
import type { SignalClassificationResult, RegimeState } from './signal-classifier';

export interface ArmEnhancedSignalResult extends SignalClassificationResult {
  // ARM-based enhancements
  armSignal?: 'LONG' | 'SHORT' | null;
  armReason?: string;
  armConfidence?: number;
  
  // Multi-state tracking
  regimeState?: string;
  armState?: string;
  marketState?: string;
  
  // Composite scoring
  compositeScore?: number;
  stateAlignment?: number;
  
  // Persistence info
  persistenceTicks?: number;
  confirmationEdge?: boolean;
}

export interface SignalStateContext {
  // Current observation
  momentum1d: number;
  momentum7d: number;
  momentum30d: number;
  rsi: number;
  rsiSlope: number;
  macd: number;
  macdHistogram: number;
  macdHistSlope: number;
  atr: number;
  atrSlope: number;
  atrPercentile: number;
  
  // Volume metrics
  volume: number;
  volumeSlope: number;
  volumeRatio: number;
  
  // Regime info
  regime: 'BULL' | 'BEAR' | 'RANGING';
  trendStrength: number;
  volatilityClass: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Additional indicators
  ichimokuBullish?: boolean;
  bbPosition?: number;
  vwapAlignment?: number;
}

/**
 * ARM-Enhanced Signal Classifier
 * 
 * Integrates:
 * 1. Traditional technical analysis (momentum, RSI, MACD)
 * 2. ARM detection (asymmetric pressure shifts)
 * 3. State persistence (tracks momentum transitions)
 * 4. Confirmation edges (filters false signals)
 * 5. Regime alignment (Bull/Bear/Ranging context)
 */
export class ArmSignalClassifier {
  // Persistent state tracking
  private static moduleState: ModuleState = {
    armTicks: 0,
    lastSignal: 'HOLD'
  };

  /**
   * Classify signal with ARM enhancement
   * 
   * Full market analysis combining:
   * - Traditional momentum scoring
   * - ARM asymmetry detection
   * - State persistence
   * - Regime alignment
   */
  static classifyWithArm(
    context: SignalStateContext,
    baseClassification: SignalClassificationResult
  ): ArmEnhancedSignalResult {
    // === STEP 1: Detect ARM (Asymmetric Reaction Model) ===
    const armInput: ArmDetectionInput = {
      rsi: context.rsi,
      rsiSlope: context.rsiSlope,
      macd: context.macd,
      macdHistogram: context.macdHistogram,
      macdHistSlope: context.macdHistSlope,
      atr: context.atr,
      atrSlope: context.atrSlope,
      atrPercentile: context.atrPercentile,
      momentum: context.momentum1d,
      volume: context.volume,
      volumeSlope: context.volumeSlope,
      volumeRatio: context.volumeRatio
    };

    const armSignal = detectArm(armInput);

    // === STEP 2: Generate ARM Module Signal ===
    const armModuleSignal = generateModuleSignal({
      moduleName: 'momentum-scanner-arm',
      data: armInput,
      state: this.moduleState,
      volumeGate: context.volumeRatio > 0.8, // Sufficient volume

      // Long confirmation: Bullish alignment after ARM_LONG
      confirmLongCondition: (data) =>
        data.rsi !== undefined && data.rsi > 45 &&
        data.macd !== undefined && data.macd > 0 &&
        data.momentum !== undefined && data.momentum > -0.02,

      // Short confirmation: Bearish alignment after ARM_SHORT
      confirmShortCondition: (data) =>
        data.rsi !== undefined && data.rsi < 55 &&
        data.macd !== undefined && data.macd < 0 &&
        data.momentum !== undefined && data.momentum < 0.02,

      minArmTicks: 2,
      baseConfidence: 0.15,
      armConfidencePerTick: 0.1,
      confirmedConfidence: 0.75
    });

    // === STEP 3: Determine Market State ===
    const marketState = this.determineMarketState(context);

    // === STEP 4: Calculate State Alignment ===
    const stateAlignment = this.calculateStateAlignment(
      baseClassification,
      armModuleSignal,
      marketState,
      context
    );

    // === STEP 5: Determine Confirmation Edge ===
    const confirmationEdge = this.isConfirmationEdge(
      armModuleSignal,
      baseClassification,
      context
    );

    // === STEP 6: Amplify Confidence through Consensus ===
    const enhancedConfidence = this.amplifyConfidenceWithConsensus(
      baseClassification.confidence,
      armModuleSignal.confidence,
      stateAlignment,
      confirmationEdge
    );

    // === STEP 7: Calculate Composite Score ===
    const compositeScore = this.calculateCompositeScore(
      baseClassification.strength,
      armModuleSignal.confidence,
      stateAlignment,
      context.regime === 'BULL' ? 1 : context.regime === 'BEAR' ? -1 : 0
    );

    return {
      // Base classification (unchanged)
      ...baseClassification,
      confidence: Math.min(1, enhancedConfidence),

      // ARM enhancements
      armSignal,
      armReason: this.getArmReason(armInput, armSignal),
      armConfidence: armModuleSignal.confidence,

      // Market state tracking
      regimeState: marketState.regime,
      armState: armModuleSignal.type,
      marketState: marketState.description,

      // Composite metrics
      compositeScore,
      stateAlignment,
      persistenceTicks: this.moduleState.armTicks,
      confirmationEdge
    };
  }

  /**
   * Determine detailed market state (9 states)
   */
  private static determineMarketState(context: SignalStateContext): {
    regime: string;
    description: string;
    substateConfidence: number;
  } {
    const { momentum1d, momentum7d, rsi, macd, regime, trendStrength, volatilityClass } = context;

    // BULL states
    if (regime === 'BULL') {
      if (momentum1d > 0.05 && momentum7d > 0.03 && rsi > 70 && trendStrength > 0.8) {
        return {
          regime: 'BULL_PARABOLIC',
          description: 'Strong uptrend with potential exhaustion',
          substateConfidence: 0.9
        };
      } else if (momentum7d > 0.03 && rsi > 60 && macd > 0) {
        return {
          regime: 'BULL_BREAKOUT',
          description: 'Recent bullish breakout momentum',
          substateConfidence: 0.85
        };
      } else if (momentum7d > 0 && rsi > 50) {
        return {
          regime: 'BULL_ESTABLISHED',
          description: 'Established uptrend',
          substateConfidence: 0.8
        };
      } else {
        return {
          regime: 'BULL_WEAKENING',
          description: 'Uptrend losing momentum',
          substateConfidence: 0.6
        };
      }
    }

    // BEAR states
    if (regime === 'BEAR') {
      if (momentum1d < -0.05 && momentum7d < -0.03 && rsi < 30 && trendStrength > 0.8) {
        return {
          regime: 'BEAR_CAPITULATION',
          description: 'Strong downtrend with potential reversal',
          substateConfidence: 0.9
        };
      } else if (momentum7d < -0.03 && rsi < 40 && macd < 0) {
        return {
          regime: 'BEAR_BREAKDOWN',
          description: 'Recent bearish breakdown',
          substateConfidence: 0.85
        };
      } else if (momentum7d < 0 && rsi < 50) {
        return {
          regime: 'BEAR_ESTABLISHED',
          description: 'Established downtrend',
          substateConfidence: 0.8
        };
      } else {
        return {
          regime: 'BEAR_WEAKENING',
          description: 'Downtrend losing momentum',
          substateConfidence: 0.6
        };
      }
    }

    // RANGING states
    if (regime === 'RANGING') {
      if (volatilityClass === 'HIGH') {
        return {
          regime: 'RANGING_VOLATILE',
          description: 'Volatile consolidation',
          substateConfidence: 0.7
        };
      } else if (volatilityClass === 'LOW' && Math.abs(momentum7d) < 0.01) {
        return {
          regime: 'RANGING_ACCUMULATION',
          description: 'Quiet accumulation phase',
          substateConfidence: 0.75
        };
      } else {
        return {
          regime: 'RANGING_DISTRIBUTION',
          description: 'Distribution/equilibrium',
          substateConfidence: 0.7
        };
      }
    }

    return {
      regime: 'NEUTRAL',
      description: 'Market in transition',
      substateConfidence: 0.5
    };
  }

  /**
   * Calculate alignment between base signal, ARM signal, and market regime
   * Higher alignment = stronger conviction
   */
  private static calculateStateAlignment(
    baseSignal: SignalClassificationResult,
    armSignal: Signal,
    marketState: any,
    context: SignalStateContext
  ): number {
    let alignment = 0.5; // baseline

    // ARM alignment boost
    if (
      (armSignal.type === 'ARM_LONG' && baseSignal.signal.includes('Buy')) ||
      (armSignal.type === 'ARM_SHORT' && baseSignal.signal.includes('Sell'))
    ) {
      alignment += 0.2;
    }

    // Regime alignment boost
    if (
      (context.regime === 'BULL' && baseSignal.signal.includes('Buy')) ||
      (context.regime === 'BEAR' && baseSignal.signal.includes('Sell')) ||
      (context.regime === 'RANGING' && baseSignal.signal === 'Neutral')
    ) {
      alignment += 0.15;
    }

    // Volume confirmation boost
    if (context.volumeRatio > 1.5) {
      alignment += 0.1;
    }

    // Multi-indicator convergence boost
    const indicatorScore =
      (baseSignal.strength / 100) * 0.3 +
      (context.rsi > 30 && context.rsi < 70 ? 0.2 : 0) +
      (Math.abs(context.macdHistSlope) > 0.1 ? 0.15 : 0);

    alignment += indicatorScore * 0.1;

    return Math.min(1, alignment);
  }

  /**
   * Detect confirmation edges (signal crossovers, reversals)
   * True when transitioning from one state to another with volume confirmation
   */
  private static isConfirmationEdge(
    armSignal: Signal,
    baseSignal: SignalClassificationResult,
    context: SignalStateContext
  ): boolean {
    const isArmEdge = armSignal.type === 'ARM_LONG' || armSignal.type === 'ARM_SHORT';
    const isSignalStrong = baseSignal.strength > 70;
    const hasVolume = context.volumeRatio > 1.2;

    return isArmEdge && isSignalStrong && hasVolume;
  }

  /**
   * Amplify confidence through multi-layer consensus
   */
  private static amplifyConfidenceWithConsensus(
    baseConfidence: number,
    armConfidence: number,
    stateAlignment: number,
    confirmationEdge: boolean
  ): number {
    let amplified = baseConfidence;

    // ARM consensus boost
    amplified = amplified * (1 + armConfidence * 0.3);

    // Alignment boost
    amplified = amplified * (1 + stateAlignment * 0.2);

    // Confirmation edge boost
    if (confirmationEdge) {
      amplified = amplified * 1.25;
    }

    return Math.min(1, amplified);
  }

  /**
   * Calculate composite score combining all factors
   */
  private static calculateCompositeScore(
    baseStrength: number,
    armConfidence: number,
    stateAlignment: number,
    regimeBias: number
  ): number {
    return (
      (baseStrength / 100) * 0.3 +
      armConfidence * 0.25 +
      stateAlignment * 0.25 +
      (0.5 + regimeBias * 0.5) * 0.2
    ) * 100;
  }

  /**
   * Generate ARM reason string for explanation
   */
  private static getArmReason(input: ArmDetectionInput, armSignal: 'LONG' | 'SHORT' | null): string {
    if (!armSignal) return 'No asymmetry detected';

    const reasons: string[] = [];

    if (armSignal === 'LONG') {
      if (input.macdHistSlope !== undefined && input.macdHistSlope > 0) {
        reasons.push('sellers-weakening');
      }
      if (input.rsiSlope !== undefined && input.rsiSlope > 0) {
        reasons.push('demand-recovering');
      }
      if (input.atrSlope !== undefined && input.atrSlope < 0) {
        reasons.push('volatility-compressing');
      }
    } else {
      if (input.macdHistSlope !== undefined && input.macdHistSlope < 0) {
        reasons.push('buyers-weakening');
      }
      if (input.rsiSlope !== undefined && input.rsiSlope < 0) {
        reasons.push('supply-returning');
      }
      if (input.atrSlope !== undefined && input.atrSlope < 0) {
        reasons.push('volatility-compressing');
      }
    }

    return reasons.length > 0 ? reasons.join('+') : `ARM_${armSignal}`;
  }

  /**
   * Reset state (for new scan/market)
   */
  static resetState(): void {
    this.moduleState = {
      armTicks: 0,
      lastSignal: 'HOLD'
    };
  }

  /**
   * Get current state for debugging
   */
  static getState(): ModuleState {
    return { ...this.moduleState };
  }
}

export default ArmSignalClassifier;
