/**
 * Convex Exit Manager
 * 
 * Determines when to exit a Convex position.
 * 
 * Exit paths:
 * 1. FoR breaks (reversion reasserts) → EXIT_STRUCTURAL
 * 2. Opposition volatility returns → EXIT_OPPOSITION_RETURN
 * 3. Structural invalidation (new equilibrium) → EXIT_INVALIDATION
 * 4. Time limit exceeded → EXIT_TIMEOUT
 * 5. Profit target hit → EXIT_TARGET
 * 6. Stop loss hit → EXIT_STOP
 */

import type { FailureOfReversionState } from '../../vfmd/failureOfReversionCalculator';
import ConvexityPolicy from './ConvexityPolicy';

export type ExitSignal =
  | 'HOLD'
  | 'EXIT_STRUCTURAL'
  | 'EXIT_OPPOSITION_RETURN'
  | 'EXIT_INVALIDATION'
  | 'EXIT_TIMEOUT'
  | 'EXIT_TARGET'
  | 'EXIT_STOP';

export interface ExitAnalysis {
  signal: ExitSignal;
  confidence: number;  // 0-1
  reason: string;
  partialProfitLevel?: number;  // If taking partial profit
  details: {
    forBreak?: boolean;
    volatilitySpike?: number;
    structureInvalid?: boolean;
    barsHeld?: number;
    currentPnL?: number;
    currentPnLPct?: number;
  };
}

export class ConvexExitManager {
  private mode: 'STRICT' | 'LEGACY' = 'STRICT';
  // Entry state (captured at deployment)
  private entryPrice: number = 0;
  private entryIndex: number = 0;
  private stopPrice: number = 0;
  private targetPrice: number = 0;
  private maxHoldingBars: number = 15;

  // FoR state at entry
  private priorForState: FailureOfReversionState | null = null;
  private priorVolatilityPerp: number = 0;

  // Tracking
  private partialProfitLevels: number[] = [0.05, 0.10, 0.15];  // 5%, 10%, 15%
  private partialsTaken: Set<number> = new Set();

  /**
   * Initialize exit manager with entry parameters
   */
  initialize(
    entryPrice: number,
    stopPrice: number,
    targetPrice: number,
    entryIndex: number,
    maxHoldingBars: number,
    partialProfitLevels: number[] = [0.05, 0.10, 0.15]
  ): void {
    this.entryPrice = entryPrice;
    this.stopPrice = stopPrice;
    this.targetPrice = targetPrice;
    this.entryIndex = entryIndex;
    this.maxHoldingBars = maxHoldingBars;
    this.partialProfitLevels = partialProfitLevels;
    this.partialsTaken.clear();
  }

  constructor(mode?: 'STRICT' | 'LEGACY') {
    // Mode can be passed programmatically, otherwise read env override
    if (mode) this.mode = mode;
    else if (typeof process !== 'undefined' && process.env && process.env.CONVEXIT_MODE) {
      const m = process.env.CONVEXIT_MODE.toUpperCase();
      if (m === 'LEGACY') this.mode = 'LEGACY';
    }
  }

  /**
   * Set the FoR state at entry (baseline for exit detection)
   */
  setEntryFoRState(forState: FailureOfReversionState): void {
    this.priorForState = { ...forState };
    this.priorVolatilityPerp = forState.oppositionWeakness;
  }

  /**
   * Check exit conditions
   * Call on every tick or every N bars
   */
  checkExitConditions(
    currentPrice: number,
    currentIndex: number,
    forState: FailureOfReversionState
  ): ExitAnalysis {
    const barsHeld = currentIndex - this.entryIndex;
    const currentPnL = currentPrice - this.entryPrice;
    const currentPnLPct = currentPnL / this.entryPrice;
    // Mode: LEGACY -> old behavior (stops/targets/partials/timeouts + FoR checks)
    // Mode: STRICT  -> Convex policy (only reversion/opposition/structure)

    if (this.mode === 'LEGACY') {
      // EXIT 1: Hard stop (stop loss)
      if (currentPrice <= this.stopPrice) {
        return {
          signal: 'EXIT_STOP',
          confidence: 1.0,
          reason: `Stop loss hit (${(currentPrice).toFixed(2)} ≤ ${(this.stopPrice).toFixed(2)})`,
          details: {
            barsHeld,
            currentPnL,
            currentPnLPct
          }
        };
      }

      // EXIT 2: Hard target (take profit)
      if (currentPrice >= this.targetPrice) {
        return {
          signal: 'EXIT_TARGET',
          confidence: 1.0,
          reason: `Target hit (${(currentPrice).toFixed(2)} ≥ ${(this.targetPrice).toFixed(2)})`,
          details: {
            barsHeld,
            currentPnL,
            currentPnLPct
          }
        };
      }

      // EXIT 3: Partial profit taking
      const partialExit = this.checkPartialProfitLevels(currentPrice, currentPnLPct);
      if (partialExit) {
        return {
          signal: 'EXIT_TARGET',
          confidence: 0.5,
          reason: `Partial profit at ${(partialExit * 100).toFixed(1)}%`,
          partialProfitLevel: partialExit,
          details: {
            barsHeld,
            currentPnL,
            currentPnLPct
          }
        };
      }

      // EXIT 4: Time limit exceeded
      if (barsHeld > this.maxHoldingBars) {
        return {
          signal: 'EXIT_TIMEOUT',
          confidence: 0.8,
          reason: `Max holding time exceeded (${barsHeld} > ${this.maxHoldingBars} bars)`,
          details: {
            barsHeld,
            currentPnL,
            currentPnLPct
          }
        };
      }

      // FALLTHROUGH -> also check structural exits
    }

    // 1) Reversion restored
    const reversion = ConvexityPolicy.isReversionRestored(this.priorForState, forState);
    if (reversion.triggered) {
      return {
        signal: 'EXIT_STRUCTURAL',
        confidence: reversion.confidence,
        reason: reversion.reason || 'FoR restored',
        details: {
          forBreak: true,
          barsHeld,
          currentPnL,
          currentPnLPct
        }
      };
    }

    // 2) Opposition volatility returned
    const opposition = ConvexityPolicy.isOppositionVolatilityReturned(
      this.priorVolatilityPerp,
      forState.oppositionWeakness
    );
    if (opposition.triggered) {
      return {
        signal: 'EXIT_OPPOSITION_RETURN',
        confidence: opposition.confidence,
        reason: opposition.reason || 'Opposition volatility returned',
        details: {
          volatilitySpike: opposition.spike,
          barsHeld,
          currentPnL,
          currentPnLPct
        }
      };
    }

    // 3) Structural invalidation
    const structure = ConvexityPolicy.isStructureInvalidated(this.entryPrice, currentPrice);
    if (structure.triggered) {
      return {
        signal: 'EXIT_INVALIDATION',
        confidence: structure.confidence,
        reason: structure.reason || 'Structure invalidated',
        details: {
          structureInvalid: true,
          barsHeld,
          currentPnL,
          currentPnLPct
        }
      };
    }

    return {
      signal: 'HOLD',
      confidence: 0,
      reason: `Holding (${barsHeld} bars, ${(currentPnLPct * 100).toFixed(2)}% PnL)`,
      details: {
        barsHeld,
        currentPnL,
        currentPnLPct
      }
    };
  }

  /**
   * INTERNAL: Check if FoR conditions broke
   */
  private analyzeFoRBreak(forState: FailureOfReversionState): {
    broke: boolean;
    confidence: number;
    reason: string;
  } {
    if (!this.priorForState) {
      return { broke: false, confidence: 0, reason: '' };
    }

    // FoR breaks when conditions go from true → false
    const decayBroke = this.priorForState.isDecaying && !forState.isDecaying;
    const timeBroke = this.priorForState.timeCompressing && !forState.timeCompressing;
    const depthBroke = this.priorForState.depthCompressing && !forState.depthCompressing;
    const volatilityBroke =
      this.priorForState.volatilityParadox && !forState.volatilityParadox;

    const breakCount = [decayBroke, timeBroke, depthBroke, volatilityBroke].filter(Boolean)
      .length;

    if (breakCount >= 2) {
      const reasons: string[] = [];
      if (decayBroke) reasons.push('reversion strength recovering');
      if (timeBroke) reasons.push('pullbacks slowing');
      if (depthBroke) reasons.push('pullbacks deepening');
      if (volatilityBroke) reasons.push('opposition awakening');

      return {
        broke: true,
        confidence: Math.min(1, breakCount / 2),
        reason: `FoR broke: ${reasons.join(', ')}`
      };
    }

    return { broke: false, confidence: 0, reason: '' };
  }

  /**
   * INTERNAL: Check if opposition volatility returned
   */
  private analyzeOppositionReturn(forState: FailureOfReversionState): {
    returned: boolean;
    spike: number;
    confidence: number;
    reason: string;
  } {
    const currentOppWeakness = forState.oppositionWeakness;
    const spike = this.priorVolatilityPerp / (currentOppWeakness + 0.0001);

    // Opposition returned if weakness dropped significantly
    if (spike > 1.5 && currentOppWeakness < this.priorVolatilityPerp * 0.5) {
      return {
        returned: true,
        spike,
        confidence: Math.min(1, (spike - 1.5) / 2),
        reason: `Opposition volatility returned (${spike.toFixed(2)}x spike)`
      };
    }

    return {
      returned: false,
      spike: 0,
      confidence: 0,
      reason: ''
    };
  }

  /**
   * INTERNAL: Check if price broke structural level
   * (For now, just check if price went below entry by 5% - simple heuristic)
   */
  private analyzeStructuralInvalidation(currentPrice: number): {
    invalid: boolean;
    confidence: number;
    reason: string;
  } {
    const fromEntry = (currentPrice - this.entryPrice) / this.entryPrice;

    // Structure breaks if price moves back below entry
    if (fromEntry < -0.05) {
      return {
        invalid: true,
        confidence: 0.6,
        reason: `Price fell below entry support (${(fromEntry * 100).toFixed(2)}%)`
      };
    }

    return { invalid: false, confidence: 0, reason: '' };
  }

  /**
   * INTERNAL: Check partial profit levels
   */
  private checkPartialProfitLevels(currentPrice: number, pnlPct: number): number | null {
    for (const level of this.partialProfitLevels) {
      if (pnlPct >= level && !this.partialsTaken.has(level)) {
        this.partialsTaken.add(level);
        return level;
      }
    }
    return null;
  }

  /**
   * Reset for next position
   */
  reset(): void {
    this.entryPrice = 0;
    this.entryIndex = 0;
    this.stopPrice = 0;
    this.targetPrice = 0;
    this.priorForState = null;
    this.priorVolatilityPerp = 0;
    this.partialsTaken.clear();
  }
}

export default ConvexExitManager;
