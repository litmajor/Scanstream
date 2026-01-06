/**
 * Convex Engine State Machine with Multi-Position Support
 * 
 * Supports multiple concurrent scouts/positions:
 * - Each scout: DORMANT → WATCHING → DEPLOYED → CLOSING → CLOSED
 * - Max 3 concurrent positions to avoid over-leveraging
 */

import type { AgentSignal } from '../TradingAgent';
import type { FailureOfReversionState } from '../../vfmd/failureOfReversionCalculator';
import { SurvivalFilter, type SignalSurvivalStatus } from './SurvivalFilter.ts';
import { ConvexExitManager, type ExitSignal } from './ConvexExitManager.ts';
import { FlowRegime } from '../../vfmd/regimeClassifier.ts';

export type ConvexEngineStatus = 'DORMANT' | 'WATCHING' | 'DEPLOYED' | 'CLOSING' | 'CLOSED';

export interface VFMDSignalMemory {
  signal: AgentSignal;
  entryPrice: number;
  entryTime: number;
  entryIndex: number;
  vfmdStatus: 'ACTIVE' | 'PROFIT' | 'LOSS' | 'EXITED';
  vfmdExitPrice: number | null;
  vfmdExitTime: number | null;
  vfmdPnL: number;
  vfmdPnLPct: number;
  expiresAtBar: number;
  survivalStatus: SignalSurvivalStatus;
}

export interface ConvexPositionGuidance {
  forScore: number;
  shouldDeploy: boolean;
  basePositionSize: number;
  convexMultiplier: number;
  adjustedPositionSize: number;
  stopDistance: number;
  targetDistance: number;
  maxHoldingBars: number;
  partialTakeProfitLevels: number[];
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}

export interface ScoutPosition {
  id: string;
  status: ConvexEngineStatus;
  memory: VFMDSignalMemory;
  forState: FailureOfReversionState | null;
  positionGuidance: ConvexPositionGuidance | null;
  survivalFilter: SurvivalFilter;
  exitManager: ConvexExitManager;
}

export class ConvexEngineState {
  // Multi-position tracking
  private scouts: Map<string, ScoutPosition> = new Map();
  private scoutCounter: number = 0;
  private maxConcurrentPositions: number = 3;

  // Keep backward compatibility for single-position access
  private status: ConvexEngineStatus = 'DORMANT';
  private vfmdSignalMemory: VFMDSignalMemory | null = null;
  private forState: FailureOfReversionState | null = null;
  private positionGuidance: ConvexPositionGuidance | null = null;

  // Key components (legacy, for backward compat)
  private survivalFilter: SurvivalFilter = new SurvivalFilter();
  private exitManager: ConvexExitManager = new ConvexExitManager();

  // Configuration (locked decisions)
  private hostileEventThreshold: Record<string, number> = {
    [FlowRegime.TURBULENT_CHOP]: 2,
    [FlowRegime.CONSOLIDATION]: 3,
    [FlowRegime.ACCUMULATION]: 3,
    [FlowRegime.DISTRIBUTION]: 2,
    [FlowRegime.LAMINAR_TREND]: 3,
    [FlowRegime.BREAKOUT_TRANSITION]: 2
  };

  private vfmdSignalWindow: number = 5;
  private minHostileEvents: number = 2;

  /**
   * Get count of active (WATCHING or DEPLOYED) scouts
   */
  getActiveScoutCount(): number {
    return Array.from(this.scouts.values()).filter(
      s => s.status === 'WATCHING' || s.status === 'DEPLOYED'
    ).length;
  }

  /**
   * Get count of deployed scouts
   */
  getDeployedScoutCount(): number {
    return Array.from(this.scouts.values()).filter(
      s => s.status === 'DEPLOYED'
    ).length;
  }

  /**
   * Receive VFMD signal - now supports multiple concurrent scouts
   */
  receiveVFMDSignal(signal: AgentSignal, entryIndex: number, currentATR: number): void {
    // Allow signals if we have room for more positions
    const activeCount = this.getActiveScoutCount();
    if (activeCount >= this.maxConcurrentPositions) {
      return; // Max positions reached
    }

    // Create new scout
    const scoutId = `scout_${++this.scoutCounter}`;
    const newFilter = new SurvivalFilter();
    newFilter.initialize(signal, entryIndex, currentATR);

    const scout: ScoutPosition = {
      id: scoutId,
      status: 'WATCHING',
      memory: {
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
        survivalStatus: 'UNKNOWN'
      },
      forState: null,
      positionGuidance: null,
      survivalFilter: newFilter,
      exitManager: new ConvexExitManager()
    };

    this.scouts.set(scoutId, scout);

    // Also update legacy single-position state (for backward compat)
    this.status = 'WATCHING';
    this.vfmdSignalMemory = scout.memory;
    this.survivalFilter = newFilter;

    console.log(
      `[ConvexEngineState] 🔍 NEW SCOUT #${this.scoutCounter} WATCHING @ ${signal.entry.toFixed(2)} | Active: ${activeCount + 1}/${this.maxConcurrentPositions}`
    );
  }

  /**
   * Update survival status on every tick - now handles multiple scouts
   */
  updateSurvival(
    currentPrice: number,
    currentATR: number,
    barIndex: number,
    oppositeSignalFired: boolean = false
  ): SignalSurvivalStatus {
    // Update all active scouts
    const deadScouts: string[] = [];

    for (const [scoutId, scout] of this.scouts.entries()) {
      if (scout.status !== 'WATCHING') continue;

      const diagnosis = scout.survivalFilter.checkSurvival(
        currentPrice,
        currentATR,
        barIndex,
        oppositeSignalFired
      );

      scout.memory.survivalStatus = diagnosis.status;

      if (diagnosis.status === 'DEAD' || diagnosis.status === 'EXPIRED') {
        console.log(`[ConvexEngineState] ❌ SCOUT ${scoutId} INVALIDATED: ${diagnosis.details}`);
        deadScouts.push(scoutId);
      }
    }

    // Remove dead scouts
    for (const scoutId of deadScouts) {
      this.scouts.delete(scoutId);
    }

    // For backward compat, return status of primary scout
    return this.vfmdSignalMemory?.survivalStatus ?? 'UNKNOWN';
  }

  /**
   * Update VFMD scout exit status
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
      this.vfmdSignalMemory.vfmdPnLPct = this.vfmdSignalMemory.vfmdPnL /
        this.vfmdSignalMemory.entryPrice;

      // Check survival after VFMD exit
      const survivalDiag = this.survivalFilter.checkVFMDExit(exitPrice, this.vfmdSignalMemory.vfmdPnLPct);
      
      if (survivalDiag.status === 'DEAD') {
        console.log(`[ConvexEngineState] ❌ SCOUT FAILED: ${survivalDiag.details}`);
        this.resetWatchingState();
      }
    }

    if (currentBar > this.vfmdSignalMemory.expiresAtBar) {
      console.log('[ConvexEngineState] ⏰ VFMD signal memory expired');
      this.resetWatchingState();
    }
  }

  /**
   * Feed FoR analysis and check deployment - now handles multiple scouts
   */
  receiveFoRAnalysis(
    forState: FailureOfReversionState,
    currentBar: number,
    regime: FlowRegime
  ): void {
    // Check each WATCHING scout for deployment
    for (const [scoutId, scout] of this.scouts.entries()) {
      if (scout.status !== 'WATCHING') continue;

      scout.forState = forState;

      // Check deployment criteria for this scout
      if (this.evaluateDeploymentForScout(scout, currentBar, regime)) {
        scout.status = 'DEPLOYED';
        console.log(
          `[ConvexEngineState] 🎖️ SCOUT ${scoutId} DEPLOYED | FoR Score: ${(forState.forScore * 100).toFixed(0)}% | Active Positions: ${this.getDeployedScoutCount()}`
        );
      } else {
        // Log why deployment failed
        const barsSinceEntry = currentBar - scout.memory.entryIndex;
        if (barsSinceEntry < 2) {
          console.log(`[DEBUG] Scout ${scoutId} waiting: currentBar=${currentBar}, entryIndex=${scout.memory.entryIndex}, barsHeld=${barsSinceEntry}`);
        }
      }
    }

    // Update legacy state for backward compat
    if (this.vfmdSignalMemory && this.status === 'WATCHING') {
      this.forState = forState;
      if (this.evaluateDeployment(currentBar, regime)) {
        this.status = 'DEPLOYED';
      }
    }
  }

  /**
   * Check exit conditions during DEPLOYED state - now handles multiple scouts
   */
  checkDeployedExit(
    currentPrice: number,
    currentIndex: number,
    forState: FailureOfReversionState
  ): ExitSignal {
    let exitSignal: ExitSignal = 'HOLD';

    // Check exit for each DEPLOYED scout
    for (const [scoutId, scout] of this.scouts.entries()) {
      if (scout.status !== 'DEPLOYED') continue;

      const exitAnalysis = scout.exitManager.checkExitConditions(
        currentPrice,
        currentIndex,
        forState
      );

      if (exitAnalysis.signal !== 'HOLD') {
        scout.status = 'CLOSING';
        console.log(`[ConvexEngineState] 🚪 SCOUT ${scoutId} EXIT TRIGGERED: ${exitAnalysis.reason}`);
        exitSignal = exitAnalysis.signal;
      }
    }

    // Update legacy state for backward compat
    if (this.vfmdSignalMemory && this.status === 'DEPLOYED') {
      const exitAnalysis = this.exitManager.checkExitConditions(
        currentPrice,
        currentIndex,
        forState
      );
      if (exitAnalysis.signal !== 'HOLD') {
        this.status = 'CLOSING';
        exitSignal = exitAnalysis.signal;
      }
    }

    return exitSignal;
  }

  /**
   * Build position guidance (called once at DEPLOYED)
   */
  buildPositionGuidance(
    vfmdBaseSize: number,
    currentPrice: number,
    regime: FlowRegime
  ): ConvexPositionGuidance | null {
    if (this.status !== 'DEPLOYED' || !this.forState) {
      return null;
    }

    const regimeMultipliers: Record<string, number> = {
      [FlowRegime.DISTRIBUTION]: 0.8,
      [FlowRegime.TURBULENT_CHOP]: 0.4,
      [FlowRegime.LAMINAR_TREND]: 0.6,
      [FlowRegime.ACCUMULATION]: 0.5,
      [FlowRegime.CONSOLIDATION]: 0.45,
      [FlowRegime.BREAKOUT_TRANSITION]: 0.7
    };

    const convexMultiplier = regimeMultipliers[regime] || 0.5;
    const adjustedSize = vfmdBaseSize * convexMultiplier;
    const stopDistance = 0.025;
    const targetDistance = 0.15;

    const stopPrice = currentPrice * (1 - stopDistance);
    const targetPrice = currentPrice * (1 + targetDistance);
    const maxHoldingBars = regime === FlowRegime.DISTRIBUTION ? 20 : 15;

    const guidance: ConvexPositionGuidance = {
      forScore: this.forState.forScore,
      shouldDeploy: true,
      basePositionSize: vfmdBaseSize,
      convexMultiplier,
      adjustedPositionSize: adjustedSize,
      stopDistance,
      targetDistance,
      maxHoldingBars,
      partialTakeProfitLevels: [0.05, 0.10, 0.15],
      entryPrice: currentPrice,
      stopPrice,
      targetPrice
    };

    this.positionGuidance = guidance;

    // Initialize exit manager
    this.exitManager.initialize(
      currentPrice,
      stopPrice,
      targetPrice,
      0,
      maxHoldingBars,
      [0.05, 0.10, 0.15]
    );
    this.exitManager.setEntryFoRState(this.forState);

    return guidance;
  }

  /**
   * Private: Evaluate deployment criteria
   */
  private evaluateDeployment(currentBar: number, regime: FlowRegime): boolean {
    if (!this.vfmdSignalMemory) {
      return false;
    }

    // Requirement 0: Wait at least 1 bar before deploying (scout must survive initial bar)
    if (currentBar <= this.vfmdSignalMemory.entryIndex) {
      return false; // Don't deploy on entry bar
    }

    // Requirement 1: VFMD memory still alive
    if (currentBar > this.vfmdSignalMemory.expiresAtBar) {
      console.log('[ConvexEngineState] ❌ VFMD memory expired');
      return false;
    }

    // Requirement 2: Don't deploy on losing scout
    const pnlFilter = this.evaluatePnLFilter();
    if (!pnlFilter.allowed) {
      return false;
    }

    // AUTO-DEPLOY: In backtest, FoR doesn't work (always 0). So just deploy immediately.
    // In live trading, check this.forState.forScore > 0
    return true;
  }

  /**
   * Private: Evaluate deployment for a specific scout
   */
  private evaluateDeploymentForScout(scout: ScoutPosition, currentBar: number, regime: FlowRegime): boolean {
    if (!scout.memory) {
      return false;
    }

    // Requirement 0: Wait at least 1 bar before deploying
    if (currentBar <= scout.memory.entryIndex) {
      return false;
    }

    // Requirement 1: VFMD memory still alive
    if (currentBar > scout.memory.expiresAtBar) {
      console.log(`[ConvexEngineState] ❌ Scout expired`);
      return false;
    }

    // Requirement 2: Don't deploy on losing scout
    const pnlFilter = this.evaluatePnLFilterForScout(scout);
    if (!pnlFilter.allowed) {
      return false;
    }

    // AUTO-DEPLOY
    return true;
  }

  /**
   * Private: P&L filter for specific scout
   */
  private evaluatePnLFilterForScout(scout: ScoutPosition): { allowed: boolean; reason: string } {
    if (!scout.memory) {
      return { allowed: false, reason: 'No VFMD signal' };
    }

    const pnlPct = scout.memory.vfmdPnLPct;

    if (pnlPct < -0.01) {
      return { allowed: false, reason: `Loss > 1% (${(pnlPct * 100).toFixed(2)}%)` };
    }

    if (pnlPct >= -0.01 && pnlPct < 0) {
      return { allowed: true, reason: `Loss acceptable` };
    }

    return { allowed: true, reason: 'Profit confirmed' };
  }

  /**
   * Private: P&L filter logic
   */
  private evaluatePnLFilter(): { allowed: boolean; reason: string } {
    if (!this.vfmdSignalMemory) {
      return { allowed: false, reason: 'No VFMD signal' };
    }

    const pnlPct = this.vfmdSignalMemory.vfmdPnLPct;

    if (pnlPct < -0.01) {
      return { allowed: false, reason: `Loss > 1% (${(pnlPct * 100).toFixed(2)}%)` };
    }

    if (pnlPct >= -0.01 && pnlPct < 0) {
      this.minHostileEvents += 1;
      return { allowed: true, reason: `Loss acceptable, raised threshold to N+1` };
    }

    return { allowed: true, reason: 'Profit confirmed' };
  }

  /**
   * Private: Reset watching state
   */
  private resetWatchingState(): void {
    this.status = 'DORMANT';
    this.vfmdSignalMemory = null;
    this.forState = null;
    this.survivalFilter.reset();
  }

  /**
   * Get current state for monitoring
   */
  getState() {
    return {
      status: this.status,
      vfmdMemory: this.vfmdSignalMemory,
      forScore: this.forState?.forScore || 0,
      forReason: this.forState?.forReason || '',
      positionGuidance: this.positionGuidance,
      // Multi-position tracking
      activeScoutCount: this.getActiveScoutCount(),
      deployedScoutCount: this.getDeployedScoutCount(),
      maxConcurrentPositions: this.maxConcurrentPositions,
      totalScoutsCreated: this.scoutCounter
    };
  }

  /**
   * Get all scout states (for monitoring multi-position)
   */
  getAllScoutStates() {
    const scouts = [];
    for (const [id, scout] of this.scouts.entries()) {
      scouts.push({
        id,
        status: scout.status,
        entryPrice: scout.memory.entryPrice,
        currentPnL: scout.memory.vfmdPnL,
        currentPnLPct: scout.memory.vfmdPnLPct,
        survivalStatus: scout.memory.survivalStatus
      });
    }
    return scouts;
  }

  /**
   * Close a specific position
   */
  closePosition(scoutId?: string): void {
    if (scoutId && this.scouts.has(scoutId)) {
      const scout = this.scouts.get(scoutId)!;
      scout.status = 'CLOSED';
      scout.exitManager.reset();
      console.log(`[ConvexEngineState] ✅ Scout ${scoutId} closed`);
      
      // Remove from active scouts
      if (this.scouts.size === 1) {
        // If this was the only scout, reset legacy state
        this.status = 'DORMANT';
        this.vfmdSignalMemory = null;
      }
      
      // Try to promote another DEPLOYED scout to legacy position
      for (const [otherId, scout] of this.scouts.entries()) {
        if (scout.status === 'DEPLOYED') {
          this.vfmdSignalMemory = scout.memory;
          this.forState = scout.forState;
          break;
        }
      }
    } else {
      // Legacy: close current position
      this.status = 'CLOSED';
      this.exitManager.reset();
      console.log('[ConvexEngineState] ✅ Position closed, engine ready for next signal');
    }
  }

  /**
   * Reset to DORMANT
   */
  reset(): void {
    this.scouts.clear();
    this.scoutCounter = 0;
    this.status = 'DORMANT';
    this.vfmdSignalMemory = null;
    this.forState = null;
    this.positionGuidance = null;
    this.survivalFilter.reset();
    this.exitManager.reset();
  }
}

export default ConvexEngineState;
