/**
 * Convexity Agent
 * 
 * The Convex Engine: "This thing refuses to die"
 * 
 * Fires ONLY after VFMD has fired and survived
 * Holds through pain for convex payoffs
 * Smaller position size, fewer trades, bigger wins
 */

import { TradingAgent } from './TradingAgent.ts';
import type { AgentPersonality, AgentSignal } from './TradingAgent.ts';
import type { MarketTick } from '../vfmd/types.ts';
import { FlowRegime } from '../vfmd/regimeClassifier.ts';
import FailureOfReversionCalculator from '../vfmd/failureOfReversionCalculator.ts';
import { ConvexEngineState } from './convexEngine/ConvexEngineState.ts';
import { SurvivalFilter } from './convexEngine/SurvivalFilter.ts';
import { ConvexExitManager, type ExitSignal } from './convexEngine/ConvexExitManager.ts';
import { ResponseNormalizer } from './convexEngine/ResponseNormalizer.ts';
import { VFMDDeduplicator, type VFMDSignal } from './convexEngine/VFMDDeduplicator.ts';
import { ScaleInValidator } from './convexEngine/ScaleInValidator.ts';
import { CircuitBreakerStructureAnchored } from './convexEngine/CircuitBreakerStructureAnchored.ts';

export interface ConvexPositionState {
  isActive: boolean;
  entryPrice: number;
  entryBar: number;
  currentPnL: number;
  currentPnLPct: number;
  lastExitSignal?: ExitSignal;
}

export class ConvexityAgent extends TradingAgent {
  // Core FoR engine
  private forCalculator: FailureOfReversionCalculator;
  
  // State machine & filtering
  private engineState: ConvexEngineState;
  private survivalFilter: SurvivalFilter;
  private exitManager: ConvexExitManager;
  
  // Tracking
  private currentRegime: FlowRegime = FlowRegime.CONSOLIDATION;
  private fairPrice: number = 0;
  private barIndex: number = 0;
  private lastTicks: MarketTick[] = [];  // Store ticks for ATR calculation in callbacks
  private positionState: ConvexPositionState = {
    isActive: false,
    entryPrice: 0,
    entryBar: 0,
    currentPnL: 0,
    currentPnLPct: 0
  };

  // Phase 1 core fixes
  private responseNormalizer: ResponseNormalizer;
  private vfmdDeduplicator: VFMDDeduplicator;
  private scaleInValidator: ScaleInValidator | null = null;
  private circuitBreaker: CircuitBreakerStructureAnchored;
  
  // For R-score velocity tracking
  private lastRScore: number = 0;
  private lastRNormalized: number = 0;

  // Scout lifecycle diagnostics
  private diagnostics = {
    totalScoutsCreated: 0,
    scoutsExpired: 0,
    scoutsKilledByPnL: 0,
    scoutsKilledByOppositeSignal: 0,
    scoutsKilledByVolatility: 0,
    scoutsDeployed: 0,
    scoutsTradedSuccessfully: 0,
    watchingBarCounts: [] as number[]  // Track how many bars scouts spend watching
  };

  constructor(name: string, personality: AgentPersonality = 'balanced') {
    super(name, 'PHYSICS_VFMD', personality);

    // Convexity-specific abilities (unlock as level up)
    this.abilities.push('failure_of_reversion_detection');
    this.abilities.push('structural_persistence_analysis');
    this.abilities.push('asymmetric_position_scaling');
    this.abilities.push('pain_tolerance');

    this.forCalculator = new FailureOfReversionCalculator();
    this.engineState = new ConvexEngineState();
    this.survivalFilter = new SurvivalFilter();
    this.exitManager = new ConvexExitManager();
    
    // Phase 1 core fixes initialization
    this.responseNormalizer = new ResponseNormalizer(200);  // 200-bar lookback
    this.vfmdDeduplicator = new VFMDDeduplicator(3);        // 3-bar cooldown
    // scaleInValidator created when position enters (see processTick)
    
    // Initialize circuit breaker (configure per asset)
    this.circuitBreaker = new CircuitBreakerStructureAnchored({
      priceLossThreshold: 0.015,       // 1.5% for crypto (tune per asset)
      responseDecayThreshold: -0.05,   // R velocity must be > -5%
      regimeVolatilityThreshold: 4.0,  // ATR > 4% = noisy
      requireBothConditions: true      // Strict mode: both conditions must trigger
    });
  }

  /**
   * Listen for VFMD signals
   * Entry point for scout → siege handoff
   * 
   * NOW WITH: De-duplication to prevent same-direction clustering
   */
  onVFMDSignalFired(vfmdSignal: AgentSignal, regime: FlowRegime): void {
    if (vfmdSignal.action === 'HOLD') {
      return;  // VFMD passed, nothing to watch
    }

    // Phase 1 Fix #2: De-duplication check
    const vfmdSignalToCheck: VFMDSignal = {
      direction: vfmdSignal.action as 'BUY' | 'SELL',
      strength: vfmdSignal.confidence,
      bar: this.barIndex,
      price: vfmdSignal.entry,
      reason: 'VFMD Scout'
    };

    const engineStateMap: Record<string, any> = {
      DORMANT: 'IDLE',
      WATCHING: 'OBSERVATION',
      DEPLOYED: 'POSITION_ACTIVE',
      CLOSING: 'CLOSING',
      CLOSED: 'IDLE'
    };
    const currentEngineState = this.engineState.getState().status;
    const mappedState = (engineStateMap as any)[currentEngineState] || 'IDLE';

    const deduped = this.vfmdDeduplicator.filter(
      vfmdSignalToCheck,
      this.barIndex,
      mappedState as any
    );

    // NOTE: Deduplicator disabled for backtest - we want to process all VFMD signals
    // In live trading, deduplication prevents noise. In backtest, we need full signal history.
    if (!deduped.shouldProcess && false) {  // Always true, effectively disabled
      console.log(
        `[ConvexityAgent ${this.name}] 🚫 VFMD DEDUP IGNORED: ${deduped.reason}`
      );
      return;  // Ignore this VFMD
    }

    // Record that we processed this VFMD
    this.vfmdDeduplicator.record(vfmdSignalToCheck, this.barIndex);

    this.currentRegime = regime;
    const currentATR = this.calculateATR(
      this.lastTicks || [],
      14
    );  // Get current ATR for survival filter initialization
    this.engineState.receiveVFMDSignal(vfmdSignal, this.barIndex, currentATR);
    
    // Track scout creation
    this.diagnostics.totalScoutsCreated++;

    console.log(
      `[ConvexityAgent ${this.name}] VFMD Scout entered: ${vfmdSignal.action} @ ${vfmdSignal.entry.toFixed(2)} | Watching for persistence... [Scout #${this.diagnostics.totalScoutsCreated}]`
    );
  }

  /**
   * Update scout exit status
   */
  onVFMDScoutExit(exitPrice: number, status: 'PROFIT' | 'LOSS'): void {
    const scoutStatus = status === 'PROFIT' ? 'PROFIT' : 'LOSS';
    this.engineState.updateVFMDScoutStatus(scoutStatus, exitPrice, this.barIndex);
  }

  /**
   * Notify agent of opposite VFMD signal (for survival validation)
   * Call this when opposite signal fires to check survival
   */
  onOppositeSignalFired(oppositeSignal: AgentSignal): void {
    if (this.engineState.getState().status === 'WATCHING') {
      console.log(
        `[ConvexityAgent ${this.name}] ⚠️ Opposite signal detected | Checking scout survival...`
      );
      const currentPrice = oppositeSignal.entry;
      const currentATR = 0; // Will use from processTick context
      
      // Signal engineer to validate survival
      this.engineState.updateSurvival(
        currentPrice,
        currentATR,
        this.barIndex,
        true  // oppositeSignalFired = true
      );
    }
  }

  /**
   * Process tick: feed FoR calculator, check for deployment
   * 
   * NOW WITH:
   * - Response normalization (regime-adaptive thresholds)
   * - Circuit breaker (structure-anchored exit)
   * - Scale-in validation (response-based, not price-based)
   */
  processTick(ticks: MarketTick[], currentRegime: FlowRegime, fairPrice: number = 0, barIndex?: number): void {
    if (ticks.length === 0) return;

    this.currentRegime = currentRegime;
    this.fairPrice = fairPrice || ticks[ticks.length - 1].close;
    // If barIndex is provided, use it (from backtester); otherwise derive from ticks length
    if (barIndex !== undefined) {
      this.barIndex = barIndex;
    } else {
      this.barIndex = ticks.length - 1;
    }
    this.lastTicks = ticks;  // Store for use in callbacks

    const currentPrice = ticks[ticks.length - 1].close;
    const atr = this.calculateATR(ticks, 14);

    // Phase 1 Fix #1: Calculate R-score and normalize it
    const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
    const rScore = (forState as any).failureScore || 0;
    const rNormalized = this.responseNormalizer.update(rScore);
    
    // Log percentile for diagnostics (every 10 bars)
    if (this.barIndex % 10 === 0) {
      const health = this.responseNormalizer.getHealthIndicators();
      console.log(
        `[ConvexityAgent ${this.name}] R-Score: ${(rScore * 100).toFixed(1)}% ` +
        `→ Normalized: ${(rNormalized * 100).toFixed(0)}th percentile ` +
        `(P25: ${(health.p25 * 100).toFixed(0)}%, P50: ${(health.p50 * 100).toFixed(0)}%, P75: ${(health.p75 * 100).toFixed(0)}%)`
      );
    }

    // PHASE 1: Validate survival if WATCHING
    if (this.engineState.getState().status === 'WATCHING') {
      const survivalStatus = this.engineState.updateSurvival(
        currentPrice,
        atr,
        this.barIndex,
        false  // oppositeSignalFired (will be called separately if needed)
      );

      if (survivalStatus === 'DEAD' || survivalStatus === 'EXPIRED') {
        console.log(
          `[ConvexityAgent ${this.name}] Scout invalidated, stopping watch`
        );
        // Engine state already reset internally, nothing more to do
      }
    }

    // PHASE 2: Feed FoR calculator
    this.forCalculator.processTick(
      ticks[ticks.length - 1],
      this.fairPrice,
      currentPrice,
      atr
    );

    // PHASE 3: Check FoR state
    // When WATCHING: check every bar (scouts expire in 5 bars, can't miss deployment window)
    // When DEPLOYED: check every 5 bars (already in position)
    const shouldCheckFoR = 
      this.engineState.getState().status === 'WATCHING' || 
      this.barIndex % 5 === 0;
    
    if (shouldCheckFoR) {
      const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
      if (this.engineState.getState().status === 'WATCHING') {
        console.log(`[ConvexityAgent ${this.name}] FoR check: bar=${this.barIndex}, score=${forState.forScore.toFixed(2)}, status=WATCHING`);
      }
      this.engineState.receiveFoRAnalysis(forState, this.barIndex, currentRegime);
    }

    // PHASE 4: Check exits if DEPLOYED
    if (this.positionState.isActive && this.engineState.getState().status === 'DEPLOYED') {
      const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
      
      // Phase 1 Fix #4: Circuit breaker check (structure-anchored)
      const rVelocity = rNormalized - this.lastRNormalized;
      const atrPercent = atr / currentPrice * 100;
      
      const breaker = this.circuitBreaker.check(
        currentPrice,
        rNormalized,
        this.lastRNormalized || rNormalized,
        atrPercent
      );
      
      if (breaker.triggered) {
        console.log(
          `[ConvexityAgent ${this.name}] ⚠️ CIRCUIT BREAKER TRIGGERED: ${breaker.reason}`
        );
        console.log(
          `   Conditions - Price Loss: ${breaker.conditions.priceLossTriggered} | ` +
          `R Decay: ${breaker.conditions.responseWeakening} | ` +
          `Regime Noisy: ${breaker.conditions.regimeNoisy}`
        );
        this.handleExitSignal('EXIT_STOP', currentPrice);
        this.lastRScore = rScore;
        this.lastRNormalized = rNormalized;
        return;  // Exit on circuit breaker
      }
      
      // Standard exits if breaker not triggered
      const exitSignal = this.engineState.checkDeployedExit(
        currentPrice,
        this.barIndex,
        forState
      );

      if (exitSignal !== 'HOLD') {
        this.handleExitSignal(exitSignal, currentPrice);
      }

      // Update position PnL tracking
      this.positionState.currentPnL = currentPrice - this.positionState.entryPrice;
      this.positionState.currentPnLPct = this.positionState.currentPnL / this.positionState.entryPrice;
      
      // Phase 1 Fix #3: Scale-in opportunity check (response-based, not price-based)
      if (!this.scaleInValidator) {
        // Initialize scale-in validator on first tick in position
        this.scaleInValidator = new ScaleInValidator(this.responseNormalizer);
      }

      this.scaleInValidator.recordRScore(rNormalized);
      
      const scaleInValidation = this.scaleInValidator.validate(
        rNormalized,
        rVelocity
      );
      
      if (scaleInValidation.canScaleIn) {
        console.log(
          `[ConvexityAgent ${this.name}] 📈 SCALE-IN OPPORTUNITY (confidence: ${(scaleInValidation.confidence * 100).toFixed(0)}%)`
        );
        console.log(scaleInValidation.details.join(' | '));
        // TODO: Integrate with position manager to actually scale in
        this.signalScaleIn(scaleInValidation.confidence);
      }
      
      // Track R-score for velocity calculation
      this.lastRScore = rScore;
      this.lastRNormalized = rNormalized;
    }
  }

  /**
   * Generate Convex signal (only if FoR triggered and VFMD conditions met)
   */
  generateSignal(ticks: MarketTick[], vfmdBaseSize: number = 0.1): AgentSignal {
    if (ticks.length === 0) {
      return this.holdSignal('Insufficient data');
    }

    const currentPrice = ticks[ticks.length - 1].close;
    const atr = this.calculateATR(ticks, 14);

    // Try to build position guidance
    const guidance = this.engineState.buildPositionGuidance(
      vfmdBaseSize,
      currentPrice,
      this.currentRegime
    );

    if (!guidance) {
      const state = this.engineState.getState();
      return this.holdSignal(
        `Waiting for FoR trigger (Status: ${state.status} | FoR: ${(state.forScore * 100).toFixed(0)}%)`
      );
    }

    // ✅ DEPLOY: Generate Convex signal
    const targetPrice = currentPrice * (1 + guidance.targetDistance);
    const stopPrice = currentPrice * (1 - guidance.stopDistance);

    // Initialize exit manager with position parameters
    this.exitManager.initialize(
      currentPrice,
      stopPrice,
      targetPrice,
      this.barIndex,
      guidance.maxHoldingBars,
      guidance.partialTakeProfitLevels
    );

    // Set FoR baseline for exit detection
    const forState = this.forCalculator.calculateFoR(
      currentPrice,
      this.fairPrice,
      atr
    );
    this.exitManager.setEntryFoRState(forState);

    // Track active position
    this.positionState = {
      isActive: true,
      entryPrice: currentPrice,
      entryBar: this.barIndex,
      currentPnL: 0,
      currentPnLPct: 0
    };

    const reasoning = [
      `🎖️ CONVEX ENGINE DEPLOYED`,
      `Scout survived | FoR: ${(guidance.forScore * 100).toFixed(0)}%`,
      `Position: ${(guidance.adjustedPositionSize * 100).toFixed(1)}% (${(guidance.convexMultiplier * 100).toFixed(0)}% of VFMD)`,
      `Risk/Reward: ${(guidance.targetDistance / guidance.stopDistance).toFixed(1)}:1`,
      `Max hold: ${guidance.maxHoldingBars} bars | Partials @ ${guidance.partialTakeProfitLevels.map((l: number) => `${(l * 100).toFixed(0)}%`).join(', ')}`
    ];

    return {
      action: 'BUY',  // Always align with VFMD direction
      confidence: guidance.forScore * 0.9,  // FoR score drives confidence
      entry: currentPrice,
      target: targetPrice,
      stop: stopPrice,
      reason: reasoning.join(' | '),
      agent_name: this.name,
      agent_level: this.level,
      size_multiplier: guidance.convexMultiplier,
      metadata: {
        engine_status: 'DEPLOYED',
        for_score: guidance.forScore,
        position_size: guidance.adjustedPositionSize,
        stop_distance_pct: guidance.stopDistance * 100,
        target_distance_pct: guidance.targetDistance * 100,
        max_holding_bars: guidance.maxHoldingBars,
        partial_profit_levels: guidance.partialTakeProfitLevels
      }
    } as AgentSignal & { metadata?: any };
  }

  /**
   * Signal position manager to scale in
   * Called when scale-in validation passes
   */
  private signalScaleIn(confidence: number): void {
    // TODO: Integrate with PositionManager
    // This should:
    // 1. Calculate additional size (e.g., 25% of original position)
    // 2. Place order at current market price (or better limit)
    // 3. Update position tracking in positionState
    // 4. Log scale-in for trade journal
    console.log(
      `[ConvexityAgent ${this.name}] Scale-in signal (confidence: ${(confidence * 100).toFixed(0)}%)`
    );
  }

  /**
   * Get health diagnostics
   * Call periodically for monitoring
   */
  getHealthDiagnostics(): string {
    const dedupStats = this.vfmdDeduplicator.getStats();
    const normalizeHealth = this.responseNormalizer.getHealthIndicators();
    
    return [
      `VFMD Dedup: ${dedupStats.processed} processed, ${dedupStats.ignored} ignored (${(dedupStats.ignoreRate * 100).toFixed(1)}%)`,
      `R-Score Regime: P25=${(normalizeHealth.p25 * 100).toFixed(0)}%, ` +
      `P50=${(normalizeHealth.p50 * 100).toFixed(0)}%, P75=${(normalizeHealth.p75 * 100).toFixed(0)}%`,
      `Response Samples: ${normalizeHealth.responseCount}`,
      this.circuitBreaker.getDiagnostics()
    ].join(' | ');
  }

  /**
   * Handle exit signals from ConvexExitManager
   */
  private handleExitSignal(exitSignal: ExitSignal, currentPrice: number): void {
    this.positionState.lastExitSignal = exitSignal;

    const exitReasons: Record<ExitSignal, string> = {
      'HOLD': 'Holding',
      'EXIT_STOP': '❌ Stop loss triggered',
      'EXIT_TARGET': '✅ Profit target hit',
      'EXIT_STRUCTURAL': '🔄 FoR broke - reversion reasserted',
      'EXIT_OPPOSITION_RETURN': '⚡ Opposition volatility returned',
      'EXIT_INVALIDATION': '📍 Structural support broken',
      'EXIT_TIMEOUT': '⏰ Max holding time exceeded'
    };

    console.log(
      `[ConvexityAgent ${this.name}] ${exitReasons[exitSignal]} @ ${currentPrice.toFixed(2)} | PnL: ${(this.positionState.currentPnLPct * 100).toFixed(2)}%`
    );

    // Close position
    this.positionState.isActive = false;
    this.engineState.closePosition();
    this.exitManager.reset();
    
    // Reset validators for next position
    this.scaleInValidator = null;
    this.lastRScore = 0;
    this.lastRNormalized = 0;
  }

  /**
   * Helper: HOLD signal
   */
  private holdSignal(reason: string): AgentSignal {
    return {
      action: 'HOLD',
      confidence: 0,
      entry: 0,
      target: 0,
      stop: 0,
      reason,
      agent_name: this.name,
      agent_level: this.level
    };
  }

  /**
   * Calculate ATR
   */
  private calculateATR(ticks: MarketTick[], period: number = 14): number {
    if (ticks.length < period) return 0;

    let tr_sum = 0;
    for (let i = Math.max(1, ticks.length - period); i < ticks.length; i++) {
      const curr = ticks[i];
      const prev = ticks[i - 1];
      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );
      tr_sum += tr;
    }

    return tr_sum / Math.min(period, ticks.length - Math.max(0, ticks.length - period));
  }

  /**
   * Get engine state for UI/monitoring
   */
  getEngineState() {
    return this.engineState.getState();
  }

  /**
   * Get current position state
   */
  getPositionState(): ConvexPositionState {
    return { ...this.positionState };
  }

  /**
   * Get complete convex engine diagnostics
   */
  getDiagnostics() {
    const engineState = this.engineState.getState();
    const scoutConversionRate = this.diagnostics.totalScoutsCreated > 0 
      ? ((engineState.totalScoutsCreated || this.diagnostics.scoutsDeployed) / this.diagnostics.totalScoutsCreated * 100).toFixed(1)
      : '0';
    
    return {
      agent: this.name,
      level: this.level,
      status: engineState.status,
      position: this.positionState,
      vfmdMemory: engineState.vfmdMemory,
      forScore: engineState.forScore,
      forReason: engineState.forReason,
      positionGuidance: engineState.positionGuidance,
      timestamp: Date.now(),
      barIndex: this.barIndex,
      // Scout lifecycle diagnostics
      scouts: {
        totalCreated: this.diagnostics.totalScoutsCreated,
        expired: this.diagnostics.scoutsExpired,
        killedByPnL: this.diagnostics.scoutsKilledByPnL,
        killedByOppositeSignal: this.diagnostics.scoutsKilledByOppositeSignal,
        killedByVolatility: this.diagnostics.scoutsKilledByVolatility,
        deployed: this.diagnostics.scoutsDeployed,
        traded: this.diagnostics.scoutsTradedSuccessfully,
        conversionRate: `${scoutConversionRate}%`,
        avgWatchingBars: this.diagnostics.watchingBarCounts.length > 0 
          ? (this.diagnostics.watchingBarCounts.reduce((a, b) => a + b, 0) / this.diagnostics.watchingBarCounts.length).toFixed(1)
          : '0'
      },
      activeScouts: engineState.activeScoutCount,
      deployedScouts: engineState.deployedScoutCount
    };
  }

  /**
   * Reset engine
   */
  resetEngine(): void {
    this.engineState.reset();
    this.survivalFilter.reset();
    this.exitManager.reset();
    // FailureOfReversionCalculator has no reset method; re-create the instance to reset internal state
    this.forCalculator = new FailureOfReversionCalculator();
    this.positionState = {
      isActive: false,
      entryPrice: 0,
      entryBar: 0,
      currentPnL: 0,
      currentPnLPct: 0
    };
    console.log(`[ConvexityAgent ${this.name}] Engine reset to DORMANT`);
  }
}

export default ConvexityAgent;