/**
 * Convex Engine State Machine
 * 
 * Lifecycle:
 * IDLE → VFMD_WATCHING → FoR_TRIGGERED → DEPLOYED → EXIT_READY
 * 
 * Tracks VFMD signal memory, hostile events, position scaling
 */

import type { AgentSignal } from '../TradingAgent';
import type { MarketTick } from '../../vfmd/types';
import { FlowRegime } from '../../vfmd/regimeClassifier';
import type { FailureOfReversionState } from '../../vfmd/failureOfReversionCalculator';

export type ConvexEngineStatus =
  | 'IDLE'
  | 'VFMD_WATCHING'
  | 'FoR_TRIGGERED'
  | 'DEPLOYED'
  | 'EXIT_READY';

/**
 * VFMD signal carried through the handoff window
 */
export interface VFMDSignalMemory {
  // Original signal
  signal: AgentSignal;
  entryPrice: number;
  entryTime: number;
  entryIndex: number;  // Bar index when VFMD fired

  // Scout status
  vfmdStatus: 'ACTIVE' | 'PROFIT' | 'LOSS' | 'EXITED';
  vfmdExitPrice: number | null;
  vfmdExitTime: number | null;
  vfmdPnL: number;  // Entry to exit profit/loss
  vfmdPnLPct: number;

  // Expiration
  expiresAt: number;  // Timestamp
  expiresAtBar: number;  // Bar index (5-candle window)
  expired?: boolean;
}

/**
 * Position sizing guidance from FoR
 */
export interface ConvexPositionGuidance {
  // Confidence in entry
  forScore: number;  // 0-1
  shouldDeploy: boolean;

  // Sizing
  basePositionSize: number;     // From VFMD
  convexMultiplier: number;     // 0.5-2.0x (smaller, fewer trades)
  adjustedPositionSize: number; // Final sizing

  // Risk profile
  stopDistance: number;  // % from entry
  targetDistance: number; // % from entry

  // Holding guidance
  maxHoldingBars: number;  // Until structure breaks
  partialTakeProfitLevels: number[];  // Price levels (%)
}

export class ConvexEngineState {
  private status: ConvexEngineStatus = 'IDLE';
  private vfmdSignalMemory: VFMDSignalMemory | null = null;
  private forState: FailureOfReversionState | null = null;
  private positionGuidance: ConvexPositionGuidance | null = null;

  // Configuration (locked at construction)
  private hostileEventThreshold: Record<string, number> = {
    [FlowRegime.TURBULENT_CHOP]: 2,
    [FlowRegime.CONSOLIDATION]: 3,
    [FlowRegime.ACCUMULATION]: 3,
    [FlowRegime.DISTRIBUTION]: 2,
    [FlowRegime.LAMINAR_TREND]: 3,
    [FlowRegime.BREAKOUT_TRANSITION]: 2
  };

  private vfmdSignalWindow: number = 5;  // Candles
  private minHostileEvents: number = 2;

  /**
   * Receive VFMD signal
   * Enters VFMD_WATCHING state, initializes signal memory
   */
  receiveVFMDSignal(signal: AgentSignal, entryIndex: number, currentBar: number): void {
    if (this.status !== 'IDLE' && this.status !== 'EXIT_READY') {
      console.warn(`[ConvexEngineState] Cannot receive VFMD signal in ${this.status} state`);
      return;
    }

    this.status = 'VFMD_WATCHING';
    this.vfmdSignalMemory = {
      signal,
      entryPrice: signal.entry,
      entryTime: Date.now(),
      entryIndex,
      vfmdStatus: 'ACTIVE',
      vfmdExitPrice: null,
      vfmdExitTime: null,
      vfmdPnL: 0,
      vfmdPnLPct: 0,
      expiresAtBar: entryIndex + this.vfmdSignalWindow,
      expiresAt: Date.now() + this.vfmdSignalWindow * 60 * 1000  // 5 candles @ 1h
    };
  }

  /**
   * Update VFMD scout status
   * Called when VFMD position closes
   */
  updateVFMDScoutStatus(
    status: 'ACTIVE' | 'PROFIT' | 'LOSS' | 'EXITED',
    exitPrice: number | null,
    currentBar: number
  ): void {
    if (!this.vfmdSignalMemory) return;

    this.vfmdSignalMemory.vfmdStatus = status;

    if (exitPrice) {
      this.vfmdSignalMemory.vfmdExitPrice = exitPrice;
      this.vfmdSignalMemory.vfmdExitTime = Date.now();
      this.vfmdSignalMemory.vfmdPnL = exitPrice - this.vfmdSignalMemory.entryPrice;
      this.vfmdSignalMemory.vfmdPnLPct =
        this.vfmdSignalMemory.vfmdPnL / this.vfmdSignalMemory.entryPrice;
    }

    // Check if signal memory is expired
    if (currentBar > this.vfmdSignalMemory.expiresAtBar) {
      console.log(
        `[ConvexEngineState] VFMD signal expired after ${currentBar - this.vfmdSignalMemory.entryIndex} bars`
      );
      // IMPORTANT: Do not clear VFMD memory if we're already DEPLOYED.
      // Convexity must persist after VFMD exits — keep the memory for context
      // but mark it as expired so downstream logic can differentiate.
      if (this.status !== 'DEPLOYED') {
        this.status = 'IDLE';
        this.vfmdSignalMemory = null;
      } else {
        this.vfmdSignalMemory.expired = true;
      }
    }
  }

  /**
   * Feed FoR state into the machine
   * Decides whether to transition to DEPLOYED
   */
  receiveFoRAnalysis(
    forState: FailureOfReversionState,
    currentBar: number,
    regime: FlowRegime
  ): void {
    if (!this.vfmdSignalMemory) {
      console.warn('[ConvexEngineState] Cannot process FoR without VFMD signal memory');
      return;
    }

    this.forState = forState;

    // Decision: should Convex Engine deploy?
    const shouldDeploy = this.evaluateDeployment(currentBar, regime);

    if (shouldDeploy) {
      this.status = 'FoR_TRIGGERED';
      // Next call to buildPositionGuidance() will transition to DEPLOYED
    }
  }

  /**
   * Check if VFMD signal is still alive
   */
  private isVFMDMemoryAlive(currentBar: number): boolean {
    if (!this.vfmdSignalMemory) return false;
    return currentBar <= this.vfmdSignalMemory.expiresAtBar;
  }

  /**
   * Evaluate deployment decision
   */
  private evaluateDeployment(currentBar: number, regime: FlowRegime): boolean {
    if (!this.vfmdSignalMemory || !this.forState) return false;

    // Requirement 1: VFMD signal memory still alive (5-candle window)
    if (!this.isVFMDMemoryAlive(currentBar)) {
      console.log('[ConvexEngineState] VFMD memory expired, cannot deploy');
      return false;
    }

    // Requirement 2: Minimum hostile events
    if (this.forState.hostileEvents.length < this.minHostileEvents) {
      console.log(
        `[ConvexEngineState] Insufficient hostile events: ${this.forState.hostileEvents.length} < ${this.minHostileEvents}`
      );
      return false;
    }

    // Requirement 3: Hostile event threshold (regime-aware)
    const threshold = this.hostileEventThreshold[regime] || 3;
    if (this.forState.hostileEvents.length < threshold) {
      console.log(
        `[ConvexEngineState] Below regime threshold: ${this.forState.hostileEvents.length} < ${threshold}`
      );
      return false;
    }

    // Requirement 4: VFMD scout P&L filter (conditional on profit)
    const pnlFilter = this.evaluatePnLFilter();
    if (!pnlFilter.allowed) {
      console.log(`[ConvexEngineState] P&L filter rejected: ${pnlFilter.reason}`);
      return false;
    }

    // Requirement 5: FoR score (minimum 0.35 for deployment)
    if (this.forState.forScore < 0.35) {
      console.log(
        `[ConvexEngineState] FoR score too low: ${(this.forState.forScore * 100).toFixed(0)}% < 35%`
      );
      return false;
    }

    console.log('[ConvexEngineState] ✅ All deployment conditions met, FoR_TRIGGERED');
    return true;
  }

  /**
   * DECISION 3: P&L filter logic
   * - VFMD loss < -1%: refuse
   * - VFMD loss -1% to 0%: allow but N+1 threshold
   * - VFMD profit: standard
   */
  private evaluatePnLFilter(): { allowed: boolean; reason: string } {
    if (!this.vfmdSignalMemory) {
      return { allowed: false, reason: 'No VFMD signal' };
    }

    const pnlPct = this.vfmdSignalMemory.vfmdPnLPct;

    if (pnlPct < -0.01) {
      return {
        allowed: false,
        reason: `VFMD loss > 1% (${(pnlPct * 100).toFixed(2)}%)`
      };
    }

    if (pnlPct >= -0.01 && pnlPct < 0) {
      // Bump threshold by 1 hostile event
      this.minHostileEvents += 1;
      return {
        allowed: true,
        reason: `VFMD loss ${(pnlPct * 100).toFixed(2)}%, raised threshold to N+1`
      };
    }

    return { allowed: true, reason: 'VFMD profit' };
  }

  /**
   * Build position guidance for Convex deployment
   */
  buildPositionGuidance(
    vfmdBaseSize: number,
    currentPrice: number,
    regime: FlowRegime
  ): ConvexPositionGuidance | null {
    if (this.status !== 'FoR_TRIGGERED' || !this.forState) {
      return null;
    }

    // Convex trades smaller: 0.4x to 0.8x of VFMD size
    // But more aggressive in certain regimes
    const regimeMultipliers: Record<string, number> = {
      [FlowRegime.DISTRIBUTION]: 0.8,      // Smart money positioning
      [FlowRegime.TURBULENT_CHOP]: 0.4,    // Reduce in chaos
      [FlowRegime.LAMINAR_TREND]: 0.6,     // Standard
      [FlowRegime.ACCUMULATION]: 0.5,      // Cautious
      [FlowRegime.CONSOLIDATION]: 0.45,    // Very cautious
      [FlowRegime.BREAKOUT_TRANSITION]: 0.7
    };

    const convexMultiplier = regimeMultipliers[regime] || 0.5;
    const adjustedSize = vfmdBaseSize * convexMultiplier;

    // Risk profile: wider stops for convex, tight take profits
    const stopDistance = 0.025;  // 2.5% stop (accepts pain)
    const targetDistance = 0.15;  // 15% target (convex payoff)

    const guidance: ConvexPositionGuidance = {
      forScore: this.forState.forScore,
      shouldDeploy: true,
      basePositionSize: vfmdBaseSize,
      convexMultiplier,
      adjustedPositionSize: adjustedSize,
      stopDistance,
      targetDistance,
      maxHoldingBars: regime === FlowRegime.DISTRIBUTION ? 20 : 15,
      partialTakeProfitLevels: [0.05, 0.10, 0.15]  // 5%, 10%, 15%
    };

    this.positionGuidance = guidance;
    this.status = 'DEPLOYED';
    return guidance;
  }

  /**
   * Get current state for monitoring
   */
  getState(): {
    status: ConvexEngineStatus;
    vfmdMemory: VFMDSignalMemory | null;
    forScore: number;
    forReason: string;
  } {
    return {
      status: this.status,
      vfmdMemory: this.vfmdSignalMemory,
      forScore: this.forState?.forScore || 0,
      forReason: this.forState?.forReason || ''
    };
  }

  /**
   * Reset to IDLE
   */
  reset(): void {
    this.status = 'IDLE';
    this.vfmdSignalMemory = null;
    this.forState = null;
    this.positionGuidance = null;
  }
}

export default ConvexEngineState;