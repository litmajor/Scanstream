/**
 * Trend + Convexity Integration Engine
 * 
 * Validates trends BEFORE Convexity enters
 * Ensures structural acceptance confirmed via:
 * - Response Alignment (RA): Participant acceptance
 * - Displacement Validation (DV): Structural backing
 * - Acceptance Score (AS = RA × DV): Entry permission
 * - Persistence Score (PS): Hold duration & position sizing
 * - Rejection Flags: False breakout detection
 * 
 * Date: January 6, 2026
 * Status: Production Ready
 */

import type { MarketTick } from './types';

export interface TrendSignalState {
  acceptanceScore: number;
  signalType: 'REJECTED' | 'EARLY_TREND' | 'ACCEPTED_TREND' | 'STRONG_TREND';
  responseAlignment: number;
  displacementValidation: number;
  rejectionFlag: boolean;
  rejectionReason?: string;
  persistenceScore: number;
  confidence: number;
  timestamp: number;
  barIndex: number;
}

export class TrendConvexityEngine {
  private raHistory: number[] = [];
  private dvHistory: number[] = [];
  private asHistory: number[] = [];
  private psHistory: number[] = [];
  private rejectionHistory: boolean[] = [];
  private volatilitySpikeHistory: number[] = [];
  
  private readonly WINDOW_SIZE = 20;
  private readonly RA_THRESHOLD_WEAK = 0.3;
  private readonly RA_THRESHOLD_STRONG = 0.7;
  private readonly DV_THRESHOLD_WEAK = 0.4;
  private readonly DV_THRESHOLD_STRONG = 1.0;
  private readonly AS_THRESHOLD_REJECTION = 0.5;
  private readonly AS_THRESHOLD_EARLY = 1.0;
  private readonly AS_THRESHOLD_ACCEPTED = 1.5;

  constructor() {
    // Initialize history buffers
    this.raHistory = [];
    this.dvHistory = [];
    this.asHistory = [];
    this.psHistory = [];
    this.rejectionHistory = [];
    this.volatilitySpikeHistory = [];
  }

  /**
   * Calculate Response Alignment (RA)
   * Measures participant acceptance of trend direction via volume & momentum
   * 
   * RA = (Volume_in_direction / Total_Volume) × (Close_momentum / ATR)
   * Range: 0.0 → 1.5+
   */
  private calculateResponseAlignment(
    candles: MarketTick[],
    window: number = 5
  ): number {
    if (candles.length < window) return 0;

    const recent = candles.slice(-window);
    const direction = recent[window - 1].close > recent[0].open ? 1 : -1;

    // Volume in direction
    let volumeInDirection = 0;
    let totalVolume = 0;
    let closeMomentum = 0;

    for (const candle of recent) {
      const bodyDirection = candle.close > candle.open ? 1 : -1;
      const bodySize = Math.abs(candle.close - candle.open);
      
      if (bodyDirection === direction) {
        volumeInDirection += candle.volume;
      }
      totalVolume += candle.volume;
      closeMomentum += bodyDirection * bodySize;
    }

    // ATR normalization
    const atr = this.calculateATR(recent);
    
    // Combine metrics: 60% volume, 40% momentum
    const volumeRatio = volumeInDirection / (totalVolume + 1e-8);
    const momentumStrength = closeMomentum / (atr * window + 1e-8);

    const ra = volumeRatio * 0.6 + momentumStrength * 0.4;
    
    return Math.max(0, Math.min(1.5, ra));
  }

  /**
   * Calculate Displacement Validation (DV)
   * Confirms price movement is structurally backed (not noise)
   * 
   * DV = (ATR_displacement / Historical_ATR) × (Coherence / (1 + TI))
   * Range: 0.0 → 2.0+
   */
  private calculateDisplacementValidation(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number,
    window: number = 5
  ): number {
    if (candles.length < 20) return 0;

    const recent = candles.slice(-window);
    const atr = this.calculateATR(recent);
    
    // How far did price move relative to ATR?
    const displacement = atr * window;
    
    // Historical ATR reference (last 20 bars)
    const historicalAtr = this.calculateHistoricalATR(candles, 20);
    const displacementRatio = displacement / (historicalAtr + 1e-8);

    // Chaos penalty: higher TI = more chaos = lower DV
    const chaosPenalty = 1.0 / (turbulenceIndex + 1.0);
    
    // Coherence boost: higher coherence = more structural support
    const coherenceBoost = coherence;

    const dv = displacementRatio * chaosPenalty * coherenceBoost;
    
    return Math.max(0, Math.min(2.0, dv));
  }

  /**
   * Calculate Acceptance Score (AS)
   * Primary signal for Convexity entry permission
   * 
   * AS = RA × DV
   * Thresholds:
   *   < 0.5 = REJECTED
   *   0.5-1.0 = EARLY_TREND
   *   1.0-1.5 = ACCEPTED_TREND
   *   > 1.5 = STRONG_TREND
   */
  calculateAcceptanceScore(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number
  ): [number, TrendSignalState['signalType']] {
    const ra = this.calculateResponseAlignment(candles);
    const dv = this.calculateDisplacementValidation(candles, coherence, turbulenceIndex);
    
    const asScore = ra * dv;

    let signalType: TrendSignalState['signalType'];
    if (asScore < this.AS_THRESHOLD_REJECTION) {
      signalType = 'REJECTED';
    } else if (asScore < this.AS_THRESHOLD_EARLY) {
      signalType = 'EARLY_TREND';
    } else if (asScore < this.AS_THRESHOLD_ACCEPTED) {
      signalType = 'ACCEPTED_TREND';
    } else {
      signalType = 'STRONG_TREND';
    }

    return [asScore, signalType];
  }

  /**
   * Calculate Persistence Score (PS)
   * Measures how long trend acceptance persists
   * Guides Convexity hold duration and position sizing
   * 
   * PS = (Coherence_bars / Window) × (RA_current / RA_max) × (1 - Vol_spike)
   * Range: 0.0 → 1.0
   */
  calculatePersistenceScore(window: number = this.WINDOW_SIZE): number {
    if (this.asHistory.length < window) return 0;

    const recentAS = this.asHistory.slice(-window);
    const recentRA = this.raHistory.slice(-window);

    // How many bars has AS stayed > 0.5 (accepting)?
    const coherenceBars = recentAS.filter(as => as > 0.5).length;
    const coherenceRatio = coherenceBars / window;

    // RA decay: is acceptance weakening?
    const raCurrent = recentRA[recentRA.length - 1];
    const raMax = Math.max(...recentRA);
    const raRatio = raCurrent / (raMax + 1e-8);

    // Volatility impact: sudden spikes break persistence
    const recentVolSpikes = this.volatilitySpikeHistory.slice(-window);
    const avgSpike = recentVolSpikes.length > 0
      ? recentVolSpikes.reduce((a, b) => a + b, 0) / recentVolSpikes.length
      : 0;
    const volPenalty = 1.0 - Math.min(avgSpike, 1.0);

    const ps = coherenceRatio * raRatio * volPenalty;
    
    return Math.max(0, Math.min(1.0, ps));
  }

  /**
   * Detect Rejection Flags
   * Identifies false breakouts and forced reversals
   * 
   * Rejects if:
   * 1. AS declining for 2+ bars
   * 2. Price moved 3+ ATR then reversed 2+ ATR in 3 bars (forced)
   * 3. Volume dropped >50% on breakout (fake-out)
   * 4. Coherence < 0.4 AND TI > 2.0 (chaos detected)
   */
  detectRejectionFlag(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number
  ): { rejected: boolean; reason?: string } {
    if (candles.length < 5) return { rejected: false };

    const recentAS = this.asHistory.slice(-3);
    const recent = candles.slice(-3);
    const atr = this.calculateATR(recent);

    // Condition 1: AS declining for 2+ bars (signal weakening)
    if (recentAS.length >= 2) {
      const isDeclinig = recentAS[recentAS.length - 1] < 0.5 &&
                         recentAS[recentAS.length - 1] < recentAS[recentAS.length - 2];
      if (isDeclinig) {
        return { rejected: true, reason: 'AS_DECLINING' };
      }
    }

    // Condition 2: Forced reversal (big move then pullback)
    if (recent.length >= 2) {
      const range1 = recent[0].high - recent[0].low;
      const range2 = recent[1].high - recent[1].low;
      if (range1 > 3 * atr && range2 < range1 - 2 * atr) {
        return { rejected: true, reason: 'FORCED_REVERSAL' };
      }
    }

    // Condition 3: Volume fake-out (volume drop >50%)
    if (candles.length >= 2) {
      const volCurrent = candles[candles.length - 1].volume;
      const volPrev = candles[candles.length - 2].volume;
      if (volPrev > 0 && volCurrent < volPrev * 0.5) {
        return { rejected: true, reason: 'VOLUME_FAKE_OUT' };
      }
    }

    // Condition 4: Chaos detection (coherence < 0.4 AND TI > 2.0)
    if (coherence < 0.4 && turbulenceIndex > 2.0) {
      return { rejected: true, reason: 'CHAOS_DETECTED' };
    }

    return { rejected: false };
  }

  /**
   * Main entry point: Calculate full trend state
   * Called once per bar with VFMD physics metrics
   */
  calculateTrendState(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number,
    barIndex: number,
    timestamp: number
  ): TrendSignalState {
    const ra = this.calculateResponseAlignment(candles);
    const dv = this.calculateDisplacementValidation(candles, coherence, turbulenceIndex);
    const [asScore, signalType] = this.calculateAcceptanceScore(candles, coherence, turbulenceIndex);
    const ps = this.calculatePersistenceScore();
    
    const { rejected, reason: rejectionReason } = this.detectRejectionFlag(
      candles,
      coherence,
      turbulenceIndex
    );

    // Update history
    this.raHistory.push(ra);
    this.dvHistory.push(dv);
    this.asHistory.push(asScore);
    this.psHistory.push(ps);
    this.rejectionHistory.push(rejected);

    // Track volatility spike
    const recentATR = this.calculateATR(candles.slice(-5));
    const historicalATR = this.calculateHistoricalATR(candles, 20);
    const volSpike = historicalATR > 0 ? recentATR / historicalATR : 1.0;
    this.volatilitySpikeHistory.push(volSpike);

    // Prune history if too large
    if (this.raHistory.length > this.WINDOW_SIZE * 2) {
      this.raHistory.shift();
      this.dvHistory.shift();
      this.asHistory.shift();
      this.psHistory.shift();
      this.rejectionHistory.shift();
      this.volatilitySpikeHistory.shift();
    }

    // Confidence = AS × (1 - rejection penalty)
    const rejectionPenalty = rejected ? 0.5 : 0;
    const confidence = asScore * (1 - rejectionPenalty);

    return {
      acceptanceScore: asScore,
      signalType: rejected ? 'REJECTED' : signalType,
      responseAlignment: ra,
      displacementValidation: dv,
      rejectionFlag: rejected,
      rejectionReason,
      persistenceScore: ps,
      confidence,
      timestamp,
      barIndex,
    };
  }

  /**
   * Get current trend state (latest calculation)
   */
  getCurrentTrendState(): Partial<TrendSignalState> | null {
    if (this.asHistory.length === 0) return null;

    const idx = this.asHistory.length - 1;
    return {
      acceptanceScore: this.asHistory[idx],
      responseAlignment: this.raHistory[idx],
      displacementValidation: this.dvHistory[idx],
      persistenceScore: this.psHistory[idx],
      rejectionFlag: this.rejectionHistory[idx],
    };
  }

  /**
   * Get history for analysis/logging
   */
  getHistory() {
    return {
      ra: [...this.raHistory],
      dv: [...this.dvHistory],
      as: [...this.asHistory],
      ps: [...this.psHistory],
      rejections: [...this.rejectionHistory],
      volSpikes: [...this.volatilitySpikeHistory],
    };
  }

  /**
   * Reset engine (for new backtests)
   */
  reset(): void {
    this.raHistory = [];
    this.dvHistory = [];
    this.asHistory = [];
    this.psHistory = [];
    this.rejectionHistory = [];
    this.volatilitySpikeHistory = [];
  }

  // ========== UTILITY METHODS ==========

  /**
   * Calculate ATR (Average True Range)
   * Used to normalize displacement and volatility
   */
  private calculateATR(candles: MarketTick[], period: number = 14): number {
    if (candles.length < period) {
      return candles.reduce((sum, c) => sum + (c.high - c.low), 0) / candles.length;
    }

    const recent = candles.slice(-period);
    let trSum = 0;

    for (let i = 0; i < recent.length; i++) {
      const candle = recent[i];
      const prevClose = i > 0 ? recent[i - 1].close : candle.close;

      const tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose)
      );
      trSum += tr;
    }

    return trSum / period;
  }

  /**
   * Calculate Historical ATR (reference for comparison)
   */
  private calculateHistoricalATR(candles: MarketTick[], window: number): number {
    if (candles.length < window) {
      return this.calculateATR(candles);
    }

    let totalATR = 0;
    let count = 0;

    // Calculate ATR for each point in the window
    for (let i = 0; i < window; i++) {
      const startIdx = Math.max(0, candles.length - window + i - 14);
      const endIdx = candles.length - window + i;
      
      if (endIdx > startIdx) {
        const slice = candles.slice(startIdx, endIdx);
        totalATR += this.calculateATR(slice);
        count++;
      }
    }

    return count > 0 ? totalATR / count : this.calculateATR(candles);
  }

  /**
   * Static helper: Calculate confidence multiplier for position sizing
   */
  static calculateConfidenceMultiplier(acceptanceScore: number, persistenceScore: number): number {
    // Signal multiplier (0.5x to 1.5x)
    let signalMult: number;
    if (acceptanceScore < 0.5) {
      signalMult = 0.5;
    } else if (acceptanceScore < 1.0) {
      signalMult = 1.0;
    } else if (acceptanceScore < 1.5) {
      signalMult = 1.2;
    } else {
      signalMult = 1.5;
    }

    // Persistence multiplier (0.3x to 1.2x hold time)
    let persistenceMult: number;
    if (persistenceScore < 0.2) {
      persistenceMult = 0.3;  // Failing persistence
    } else if (persistenceScore < 0.6) {
      persistenceMult = 0.7;
    } else {
      persistenceMult = 1.2;
    }

    return signalMult * persistenceMult;
  }

  /**
   * Static helper: Calculate hold duration based on trend metrics
   */
  static calculateHoldDuration(
    baseHoldBars: number,
    persistenceScore: number,
    acceptanceScore: number
  ): number {
    const persistenceFactor = 1.0 + persistenceScore * 0.4;
    const acceptanceFactor = 1.0 + Math.min(acceptanceScore, 3.0) / 5.0;

    const holdBars = Math.floor(baseHoldBars * persistenceFactor * acceptanceFactor);

    // Cap at 2x base
    return Math.min(holdBars, baseHoldBars * 2);
  }

  /**
   * Static helper: Calculate dynamic stop loss
   */
  static calculateDynamicStop(
    entryPrice: number,
    signalType: TrendSignalState['signalType'],
    baseStopPercent: number
  ): number {
    // Adjust stop tightness based on signal confidence
    const stopMultipliers = {
      'EARLY_TREND': 1.5,        // Tighter stop (risky early entry)
      'ACCEPTED_TREND': 1.0,     // Normal stop
      'STRONG_TREND': 0.8,       // Looser stop (high conviction)
      'REJECTED': 1.0,
    };

    const multiplier = stopMultipliers[signalType] || 1.0;
    const adjustedStop = baseStopPercent * multiplier;

    return entryPrice * (1 - adjustedStop);
  }
}
