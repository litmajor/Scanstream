/**
 * Failure of Reversion Calculator
 * 
 * Detects when mean reversion stops being the dominant force
 * Tracks hostile events and measures their decay
 * Computes FoR score (0-1) as permission for Convex Engine
 */

import type { MarketTick } from './types';
import { FlowRegime } from './regimeClassifier.ts';

/**
 * A hostile event: any corrective move against the primary direction
 */
export interface HostileEvent {
  // Timing
  timestamp: number;
  barIndex: number;

  // Magnitude
  entryDeviation: number;      // |D_t| at pullback start
  minDeviation: number;          // |D_t| at max pullback depth
  recoveryDeviation: number;     // |D_t| after recovery

  // Duration
  durationBars: number;          // τ_i
  recoveryBars: number;          // time to recover

  // Volatility
  volatilityDuring: number;       // σ during pullback
  volatilityAgainstDirection: number; // σ_⊥ specific
}

/**
 * Reversion quality metrics for a single hostile event
 */
export interface ReversionQuality {
  // Reversion gain: R_i = |D_entry| - |D_min| / |D_entry|
  reversionGain: number;  // 0-1, higher = stronger reversion

  // Time efficiency: how fast did recovery happen
  recoverySpeed: number;  // bars recovered per bar elapsed

  // Depth: how shallow was the pullback
  depthEfficiency: number; // 0-1
}

/**
 * Failure of Reversion state
 */
export interface FailureOfReversionState {
  // Current hostile event sequence
  hostileEvents: HostileEvent[];

  // Quality decay analysis
  reversionQualities: ReversionQuality[];
  isDecaying: boolean;          // R_{i+1} < R_i consistently?
  decayStrength: number;        // 0-1, how strong is the decay pattern
  currentRegime?: FlowRegime;    // Market regime context

  // Time compression
  timeCompressing: boolean;     // τ_{i+1} < τ_i?
  timeCompressionRatio: number; // 0-1

  // Depth compression
  depthCompressing: boolean;    // Δ_{i+1} < Δ_i?
  depthCompressionRatio: number; // 0-1

  // Volatility paradox
  volatilityParadox: boolean;   // σ_⊥ ↓ while |D| ↑?
  oppositionWeakness: number;   // 0-1, how weak is opposition

  // FoR score (0-1)
  forScore: number;
  forConfidence: number;
  forReason: string;
}

export class FailureOfReversionCalculator {
  private equityWindow: number = 100;  // How many bars to track
  private deviationHistory: number[] = [];
  private volatilityHistory: number[] = [];
  private currentHostileEvents: HostileEvent[] = [];
  private priorDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  /**
   * Feed new tick into the calculator
   * Tracks deviations and identifies hostile events
   */
  processTick(
    tick: MarketTick,
    fairPrice: number,  // VFMD fair price or rolling mean
    currentPrice: number,
    atr: number
  ): void {
    const deviation = currentPrice - fairPrice;
    const absDeviation = Math.abs(deviation);

    // Track history
    this.deviationHistory.push(absDeviation);
    if (this.deviationHistory.length > this.equityWindow) {
      this.deviationHistory.shift();
    }

    // Track volatility
    const volatility = atr > 0 ? (tick.high - tick.low) / atr : 0;
    this.volatilityHistory.push(volatility);
    if (this.volatilityHistory.length > this.equityWindow) {
      this.volatilityHistory.shift();
    }

    // Determine direction
    const newDirection = deviation > 0 ? 'bullish' : deviation < 0 ? 'bearish' : 'neutral';
    if (newDirection !== this.priorDirection && newDirection !== 'neutral') {
      this.priorDirection = newDirection;
    }
  }

  /**
   * Calculate FoR score
   * Called periodically (every 5-10 bars) to evaluate reversion failure
   * Optionally accepts current market regime for context-aware analysis
   */
  calculateFoR(
    currentPrice: number,
    fairPrice: number,
    atr: number,
    currentRegime?: FlowRegime
  ): FailureOfReversionState {
    if (this.deviationHistory.length < 10) {
      return this.getEmptyFoRState('Insufficient history', currentRegime);
    }

    // Identify hostile events in recent history
    const hostileEvents = this.identifyHostileEvents();

    if (hostileEvents.length < 2) {
      return this.getEmptyFoRState('Need ≥2 hostile events', currentRegime);
    }

    // Calculate reversion quality for each event
    const reversionQualities = hostileEvents.map(event =>
      this.calculateReversionQuality(event)
    );

    // Check decay conditions
    const decayAnalysis = this.analyzeDecay(reversionQualities, hostileEvents);
    const timeCompressionAnalysis = this.analyzeTimeCompression(hostileEvents);
    const depthCompressionAnalysis = this.analyzeDepthCompression(hostileEvents);
    const volatilityParadoxAnalysis = this.analyzeVolatilityParadox(
      hostileEvents,
      currentPrice,
      fairPrice,
      atr
    );

    // Combine all conditions
    const forScore = this.combineFoRConditions(
      decayAnalysis,
      timeCompressionAnalysis,
      depthCompressionAnalysis,
      volatilityParadoxAnalysis
    );

    return {
      hostileEvents,
      reversionQualities,
      isDecaying: decayAnalysis.isDecaying,
      decayStrength: decayAnalysis.strength,
      timeCompressing: timeCompressionAnalysis.isCompressing,
      timeCompressionRatio: timeCompressionAnalysis.ratio,
      depthCompressing: depthCompressionAnalysis.isCompressing,
      depthCompressionRatio: depthCompressionAnalysis.ratio,
      volatilityParadox: volatilityParadoxAnalysis.paradoxDetected,
      oppositionWeakness: volatilityParadoxAnalysis.weakness,
      currentRegime,
      forScore,
      forConfidence: forScore * decayAnalysis.strength,
      forReason: this.buildFoRReason(
        decayAnalysis,
        timeCompressionAnalysis,
        depthCompressionAnalysis,
        volatilityParadoxAnalysis
      )
    };
  }

  /**
   * INTERNAL: Identify hostile events (pullback attempts against direction)
   */
  private identifyHostileEvents(): HostileEvent[] {
    const events: HostileEvent[] = [];
    const deviation = this.deviationHistory;

    // Look for local extrema: price moves away, then pulls back
    for (let i = 10; i < deviation.length - 5; i++) {
      const prior = i > 0 ? deviation[i - 1] : deviation[i];
      const current = deviation[i];
      const next = deviation[i + 1];

      // Hostile event = deviation shrinking (reversion attempt)
      if (prior > current && current < next) {
        // Found a local minimum = pullback
        const pullbackDepth = prior - current;
        const recoveryStart = i + 1;

        // Find recovery completion
        let recoveryEnd = i + 1;
        for (let j = i + 1; j < Math.min(i + 15, deviation.length); j++) {
          if (deviation[j] >= prior * 0.9) {
            recoveryEnd = j;
            break;
          }
        }

        events.push({
          timestamp: Date.now(),
          barIndex: i,
          entryDeviation: prior,
          minDeviation: current,
          recoveryDeviation: deviation[recoveryEnd] || prior,
          durationBars: recoveryEnd - i,
          recoveryBars: recoveryEnd - recoveryStart,
          volatilityDuring: this.volatilityHistory[i] || 1,
          volatilityAgainstDirection: this.volatilityHistory[i] || 1
        });
      }
    }

    return events.slice(-5); // Keep last 5 hostile events
  }

  /**
   * INTERNAL: Calculate reversion quality for a single hostile event
   */
  private calculateReversionQuality(event: HostileEvent): ReversionQuality {
    const reversionGain =
      event.entryDeviation > 0
        ? (event.entryDeviation - event.minDeviation) / event.entryDeviation
        : 0;

    const recoverySpeed =
      event.recoveryBars > 0
        ? (event.entryDeviation - event.minDeviation) / event.recoveryBars
        : 0;

    const depthEfficiency = 1 - Math.min(1, event.minDeviation / event.entryDeviation);

    return {
      reversionGain: Math.max(0, Math.min(1, reversionGain)),
      recoverySpeed: Math.max(0, recoverySpeed),
      depthEfficiency
    };
  }

  /**
   * INTERNAL: Check if reversion quality decays: R_{i+1} < R_i?
   */
  private analyzeDecay(
    qualities: ReversionQuality[],
    events: HostileEvent[]
  ): { isDecaying: boolean; strength: number } {
    if (qualities.length < 2) return { isDecaying: false, strength: 0 };

    let decayCount = 0;
    for (let i = 1; i < qualities.length; i++) {
      if (qualities[i].reversionGain < qualities[i - 1].reversionGain) {
        decayCount++;
      }
    }

    const decayRatio = decayCount / (qualities.length - 1);
    return {
      isDecaying: decayRatio > 0.5, // At least 50% of pairs show decay
      strength: decayRatio
    };
  }

  /**
   * INTERNAL: Check time compression: τ_{i+1} < τ_i?
   */
  private analyzeTimeCompression(events: HostileEvent[]): {
    isCompressing: boolean;
    ratio: number;
  } {
    if (events.length < 2) return { isCompressing: false, ratio: 0 };

    let compressionCount = 0;
    for (let i = 1; i < events.length; i++) {
      if (events[i].durationBars < events[i - 1].durationBars) {
        compressionCount++;
      }
    }

    const compressionRatio = compressionCount / (events.length - 1);
    return {
      isCompressing: compressionRatio > 0.5,
      ratio: compressionRatio
    };
  }

  /**
   * INTERNAL: Check depth compression: Δ_{i+1} < Δ_i?
   */
  private analyzeDepthCompression(events: HostileEvent[]): {
    isCompressing: boolean;
    ratio: number;
  } {
    if (events.length < 2) return { isCompressing: false, ratio: 0 };

    let compressionCount = 0;
    for (let i = 1; i < events.length; i++) {
      const depth_i = events[i - 1].entryDeviation - events[i - 1].minDeviation;
      const depth_i1 = events[i].entryDeviation - events[i].minDeviation;
      if (depth_i1 < depth_i) {
        compressionCount++;
      }
    }

    const compressionRatio = compressionCount / (events.length - 1);
    return {
      isCompressing: compressionRatio > 0.5,
      ratio: compressionRatio
    };
  }

  /**
   * INTERNAL: Detect volatility paradox: σ_⊥ ↓ while |D| ↑?
   */
  private analyzeVolatilityParadox(
    events: HostileEvent[],
    currentPrice: number,
    fairPrice: number,
    atr: number
  ): {
    paradoxDetected: boolean;
    weakness: number;
  } {
    if (events.length < 2) return { paradoxDetected: false, weakness: 0 };

    // Recent volatility against direction
    const recentVolatility = this.volatilityHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;

    // Prior volatility
    const priorVolatility =
      this.volatilityHistory.length > 10
        ? this.volatilityHistory.slice(-15, -5).reduce((a, b) => a + b, 0) / 10
        : recentVolatility;

    // Current deviation vs prior max
    const currentDeviation = Math.abs(currentPrice - fairPrice);
    const maxPriorDeviation = Math.max(
      ...events.map(e => e.entryDeviation)
    );

    // Paradox: price moved more, volatility weaker
    const paradoxDetected = currentDeviation > maxPriorDeviation && recentVolatility < priorVolatility;
    const weakness = Math.max(0, 1 - recentVolatility / (priorVolatility + 0.0001));

    return {
      paradoxDetected,
      weakness: Math.min(1, weakness)
    };
  }

  /**
   * INTERNAL: Combine all FoR conditions into final score
   */
  private combineFoRConditions(
    decayAnalysis: { isDecaying: boolean; strength: number },
    timeCompressionAnalysis: { isCompressing: boolean; ratio: number },
    depthCompressionAnalysis: { isCompressing: boolean; ratio: number },
    volatilityParadoxAnalysis: { paradoxDetected: boolean; weakness: number }
  ): number {
    let score = 0;

    // Decay: 40% weight (most critical)
    if (decayAnalysis.isDecaying) {
      score += 0.4 * decayAnalysis.strength;
    }

    // Time compression: 25% weight
    if (timeCompressionAnalysis.isCompressing) {
      score += 0.25 * timeCompressionAnalysis.ratio;
    }

    // Depth compression: 25% weight
    if (depthCompressionAnalysis.isCompressing) {
      score += 0.25 * depthCompressionAnalysis.ratio;
    }

    // Volatility paradox: 10% bonus (high confidence amplifier)
    if (volatilityParadoxAnalysis.paradoxDetected) {
      score += 0.1 * volatilityParadoxAnalysis.weakness;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * INTERNAL: Build human-readable FoR reason
   */
  private buildFoRReason(
    decayAnalysis: any,
    timeCompressionAnalysis: any,
    depthCompressionAnalysis: any,
    volatilityParadoxAnalysis: any
  ): string {
    const reasons: string[] = [];

    if (decayAnalysis.isDecaying) {
      reasons.push(`⚙️ Reversion weakening (${(decayAnalysis.strength * 100).toFixed(0)}%)`);
    }

    if (timeCompressionAnalysis.isCompressing) {
      reasons.push(`⚡ Pullbacks speeding up (${(timeCompressionAnalysis.ratio * 100).toFixed(0)}%)`);
    }

    if (depthCompressionAnalysis.isCompressing) {
      reasons.push(`📊 Pullbacks shallowing (${(depthCompressionAnalysis.ratio * 100).toFixed(0)}%)`);
    }

    if (volatilityParadoxAnalysis.paradoxDetected) {
      reasons.push(`🔒 Liquidity trapped (opposition weakening)`);
    }

    return reasons.length > 0 ? reasons.join(' + ') : '❌ FoR conditions not met';
  }

  /**
   * INTERNAL: Empty FoR state for insufficient data
   * Returns neutral FoR state with optional regime context
   */
  private getEmptyFoRState(reason: string, regime?: FlowRegime): FailureOfReversionState {
    return {
      hostileEvents: [],
      reversionQualities: [],
      isDecaying: false,
      decayStrength: 0,
      timeCompressing: false,
      timeCompressionRatio: 0,
      depthCompressing: false,
      depthCompressionRatio: 0,
      volatilityParadox: false,
      oppositionWeakness: 0,      currentRegime: regime,      forScore: 0,
      forConfidence: 0,
      forReason: reason
    };
  }
}

export default FailureOfReversionCalculator;