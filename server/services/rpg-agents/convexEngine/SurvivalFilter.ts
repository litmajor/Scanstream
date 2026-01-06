/**
 * SurvivalFilter
 * 
 * Answers: Is the VFMD signal still alive?
 * 
 * A VFMD signal dies if:
 * 1. Price crosses back through entry (bias invalidation)
 * 2. VFMD exits at a loss > -1% (scout failed)
 * 3. Opposite VFMD signal fires (regime reversal)
 * 4. Volatility spike invalidates structure (chaos)
 * 5. Time window expires (5-candle max)
 */

import type { AgentSignal } from '../TradingAgent';
import type { MarketTick } from '../../vfmd/types';

export type SignalSurvivalStatus = 'ALIVE' | 'DEAD' | 'UNKNOWN' | 'EXPIRED';

export interface SurvivalDiagnostics {
  status: SignalSurvivalStatus;
  killReason?: string;
  barsAlive: number;
  priceDistance: number;      // % from entry
  volatilityShock: number;    // ATR expansion
  oppositeSignalFired: boolean;
  details: string;
}

export class SurvivalFilter {
  private entryPrice: number = 0;
  private entryTime: number = 0;
  private entryIndex: number = 0;
  private direction: 'BUY' | 'SELL' = 'BUY';
  private initialATR: number = 0;

  // Configuration (these are your locked decisions)
  private maxSurvivalBars: number = 5;        // 5-candle window - scouts MUST survive this
  private priceInvalidationThreshold: number = 0.03;  // UNUSED - price moves don't kill scouts
  private volatilityInvalidationMultiplier: number = 999;  // DISABLED - volatility doesn't kill scouts either
  private vfmdLossThreshold: number = -0.01;  // Loss > 1% = don't watch

  /**
   * Initialize filter with a VFMD signal
   */
  initialize(signal: AgentSignal, barIndex: number, atr: number): void {
    this.entryPrice = signal.entry;
    this.entryTime = Date.now();
    this.entryIndex = barIndex;
    this.direction = signal.action as 'BUY' | 'SELL';
    this.initialATR = atr;
  }

  /**
   * Check if signal is still alive
   * Call this on every tick
   * 
   * ONLY kills on:
   * 1. Time expiration (5 bars)
   * 2. Opposite signal (regime reversal)
   * 3. Extreme volatility shock (2x+ ATR expansion)
   * 
   * Price moves do NOT kill scouts - they survive the full 5-bar window
   */
  checkSurvival(
    currentPrice: number,
    currentATR: number,
    barIndex: number,
    oppositeSignalFired: boolean = false
  ): SurvivalDiagnostics {
    const barsAlive = barIndex - this.entryIndex;
    const priceDistance = (currentPrice - this.entryPrice) / this.entryPrice;

    // KILL 1: Time expiration
    if (barsAlive > this.maxSurvivalBars) {
      return {
        status: 'EXPIRED',
        killReason: `Time limit exceeded (${barsAlive} > ${this.maxSurvivalBars} bars)`,
        barsAlive,
        priceDistance,
        volatilityShock: currentATR / this.initialATR,
        oppositeSignalFired,
        details: '⏰ VFMD signal memory expired, Convex cannot watch'
      };
    }

    // KILL 2: Opposite signal fires (regime collapse)
    if (oppositeSignalFired) {
      return {
        status: 'DEAD',
        killReason: 'Opposite VFMD signal fired (regime reversal)',
        barsAlive,
        priceDistance,
        volatilityShock: currentATR / this.initialATR,
        oppositeSignalFired: true,
        details: '🔄 Opposite signal fired, original scout invalidated'
      };
    }

    // KILL 3: Volatility shock invalidates structure
    if (this.volatilityShockDetected(currentATR)) {
      return {
        status: 'DEAD',
        killReason: `Volatility shock (${(currentATR / this.initialATR).toFixed(2)}x ATR)`,
        barsAlive,
        priceDistance,
        volatilityShock: currentATR / this.initialATR,
        oppositeSignalFired,
        details: `⚡ Volatility exploded ${(currentATR / this.initialATR).toFixed(2)}x, structure invalid`
      };
    }

    // Signal still alive - price moves don't matter, only time/opposite/volatility
    return {
      status: 'ALIVE',
      barsAlive,
      priceDistance,
      volatilityShock: currentATR / this.initialATR,
      oppositeSignalFired,
      details: `✅ Scout alive (${barsAlive}/${this.maxSurvivalBars} bars, ${(priceDistance * 100).toFixed(2)}% move)`
    };
  }

  /**
   * Check if VFMD exit kills the watch
   * Called when VFMD position closes
   */
  checkVFMDExit(exitPrice: number, exitPnLPct: number): SurvivalDiagnostics {
    // KILL 5: VFMD exits at loss > 1%
    if (exitPnLPct < this.vfmdLossThreshold) {
      return {
        status: 'DEAD',
        killReason: `VFMD loss exceeds threshold (${(exitPnLPct * 100).toFixed(2)}% < ${(this.vfmdLossThreshold * 100).toFixed(2)}%)`,
        barsAlive: 0,
        priceDistance: 0,
        volatilityShock: 0,
        oppositeSignalFired: false,
        details: `❌ Scout lost too much (${(exitPnLPct * 100).toFixed(2)}%), entry was wrong, do not watch`
      };
    }

    // Scout loss was acceptable (-1% to 0%) — can still watch but with higher N threshold
    if (exitPnLPct < 0) {
      return {
        status: 'ALIVE',
        barsAlive: 0,
        priceDistance: 0,
        volatilityShock: 0,
        oppositeSignalFired: false,
        details: `⚠️ Scout took loss (${(exitPnLPct * 100).toFixed(2)}%), can still watch with raised threshold`
      };
    }

    // Scout profitable — continue watching normally
    return {
      status: 'ALIVE',
      barsAlive: 0,
      priceDistance: 0,
      volatilityShock: 0,
      oppositeSignalFired: false,
      details: `✅ Scout profitable (${(exitPnLPct * 100).toFixed(2)}%), continue watching`
    };
  }

  /**
   * INTERNAL: Does price cross back through entry?
   */
  private priceInvalidatesEntry(currentPrice: number): boolean {
    const distanceFromEntry = Math.abs(currentPrice - this.entryPrice) / this.entryPrice;

    if (this.direction === 'BUY') {
      // BUY bias: price should not go below entry
      return currentPrice < this.entryPrice * (1 - this.priceInvalidationThreshold);
    } else {
      // SELL bias: price should not go above entry
      return currentPrice > this.entryPrice * (1 + this.priceInvalidationThreshold);
    }
  }

  /**
   * INTERNAL: Does volatility spike invalidate structure?
   */
  private volatilityShockDetected(currentATR: number): boolean {
    const atrExpansion = currentATR / this.initialATR;
    return atrExpansion > this.volatilityInvalidationMultiplier;
  }

  /**
   * Configure thresholds (for testing or adaptive modes)
   */
  setMaxSurvivalBars(bars: number): void {
    this.maxSurvivalBars = bars;
  }

  setPriceInvalidationThreshold(pct: number): void {
    this.priceInvalidationThreshold = pct;
  }

  setVolatilityInvalidationMultiplier(multiplier: number): void {
    this.volatilityInvalidationMultiplier = multiplier;
  }

  setVFMDLossThreshold(pct: number): void {
    this.vfmdLossThreshold = pct;
  }

  /**
   * Reset for next signal
   */
  reset(): void {
    this.entryPrice = 0;
    this.entryTime = 0;
    this.entryIndex = 0;
    this.initialATR = 0;
  }
}

export default SurvivalFilter;
