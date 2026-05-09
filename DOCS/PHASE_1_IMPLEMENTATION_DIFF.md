# PHASE 1 IMPLEMENTATION: UNIFIED DIFF

This file shows exact code modifications needed to integrate Phase 1 fixes into ConvexityAgent.ts

---

## File 1: ConvexityAgent.ts - Import Statements (TOP OF FILE)

**Location**: Lines 1-20 (after existing imports)

```typescript
// EXISTING IMPORTS (keep these)
import { TradingAgent } from './TradingAgent.ts';
import type { AgentPersonality, AgentSignal } from './TradingAgent.ts';
import type { MarketTick } from '../vfmd/types.ts';
import { FlowRegime } from '../vfmd/regimeClassifier.ts';
import FailureOfReversionCalculator from '../vfmd/failureOfReversionCalculator.ts';
import { ConvexEngineState } from './convexEngine/ConvexEngineState.ts';
import { SurvivalFilter } from './convexEngine/SurvivalFilter.ts';
import { ConvexExitManager, type ExitSignal } from './convexEngine/ConvexExitManager.ts';

// ADD THESE NEW IMPORTS
import { ResponseNormalizer } from './convexEngine/ResponseNormalizer.ts';
import { VFMDDeduplicator, type VFMDSignal } from './convexEngine/VFMDDeduplicator.ts';
import { ScaleInValidator } from './convexEngine/ScaleInValidator.ts';
import { CircuitBreakerStructureAnchored } from './convexEngine/CircuitBreakerStructureAnchored.ts';
```

---

## File 2: ConvexityAgent.ts - Class Properties

**Location**: After `ConvexPositionState` interface, in the class definition

```typescript
export class ConvexityAgent extends TradingAgent {
  // EXISTING PROPERTIES (keep these)
  private forCalculator: FailureOfReversionCalculator;
  private engineState: ConvexEngineState;
  private survivalFilter: SurvivalFilter;
  private exitManager: ConvexExitManager;
  
  private currentRegime: FlowRegime = FlowRegime.CONSOLIDATION;
  private fairPrice: number = 0;
  private barIndex: number = 0;
  private positionState: ConvexPositionState = {
    isActive: false,
    entryPrice: 0,
    entryBar: 0,
    currentPnL: 0,
    currentPnLPct: 0
  };

  // ADD THESE NEW PROPERTIES
  private responseNormalizer: ResponseNormalizer;
  private vfmdDeduplicator: VFMDDeduplicator;
  private scaleInValidator: ScaleInValidator | null = null;
  private circuitBreaker: CircuitBreakerStructureAnchored;
  
  // For R-score velocity tracking
  private lastRScore: number = 0;
  private lastRNormalized: number = 0;
```

---

## File 3: ConvexityAgent.ts - Constructor

**Location**: In the constructor method

```typescript
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
    
    // ADD THESE NEW INITIALIZATIONS
    this.responseNormalizer = new ResponseNormalizer(200);  // 200-bar lookback
    this.vfmdDeduplicator = new VFMDDeduplicator(3);        // 3-bar cooldown
    // scaleInValidator created when position enters (see processTick)
    
    // Initialize circuit breaker
    // Configure per asset (these are crypto defaults; see PHASE_1_CORE_FIXES_INTEGRATION.md)
    this.circuitBreaker = new CircuitBreakerStructureAnchored({
      priceLossThreshold: 0.015,
      responseDecayThreshold: -0.05,
      regimeVolatilityThreshold: 4.0,
      requireBothConditions: true
    });
  }
```

---

## File 4: ConvexityAgent.ts - onVFMDSignalFired Method

**Location**: Replace entire `onVFMDSignalFired` method

```typescript
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

    // NEW: De-duplication check
    const vfmdSignalToCheck: VFMDSignal = {
      direction: vfmdSignal.action as 'BUY' | 'SELL',
      strength: vfmdSignal.confidence,
      bar: this.barIndex,
      price: vfmdSignal.entry,
      reason: 'VFMD Scout'
    };

    const engineStateMap = {
      'DORMANT': 'IDLE',
      'WATCHING': 'OBSERVATION',
      'DEPLOYED': 'POSITION_ACTIVE',
      'CLOSING': 'CLOSING'
    } as const;

    const currentEngineState = this.engineState.getState().status;
    const mappedState = engineStateMap[currentEngineState] || 'IDLE';

    const deduped = this.vfmdDeduplicator.filter(
      vfmdSignalToCheck,
      this.barIndex,
      mappedState as any
    );

    if (!deduped.shouldProcess) {
      console.log(
        `[ConvexityAgent ${this.name}] 🚫 VFMD DEDUP IGNORED: ${deduped.reason}`
      );
      return;  // Ignore this VFMD
    }

    // Record that we processed this VFMD
    this.vfmdDeduplicator.record(vfmdSignalToCheck, this.barIndex);

    this.currentRegime = regime;
    const currentATR = 0; // ATR not available in this callback; use 0 or update caller to provide ATR
    this.engineState.receiveVFMDSignal(vfmdSignal, this.barIndex, currentATR);

    console.log(
      `[ConvexityAgent ${this.name}] VFMD Scout entered: ${vfmdSignal.action} @ ${vfmdSignal.entry.toFixed(2)} | Watching for persistence...`
    );
  }
```

---

## File 5: ConvexityAgent.ts - processTick Method (MAIN CHANGES)

**Location**: Replace entire `processTick` method

```typescript
  /**
   * Process tick: feed FoR calculator, check for deployment
   * 
   * NOW WITH:
   * - Response normalization (regime-adaptive thresholds)
   * - Circuit breaker (structure-anchored exit)
   * - Scale-in validation (response-based, not price-based)
   */
  processTick(ticks: MarketTick[], currentRegime: FlowRegime, fairPrice: number = 0): void {
    if (ticks.length === 0) return;

    this.currentRegime = currentRegime;
    this.fairPrice = fairPrice || ticks[ticks.length - 1].close;
    this.barIndex = ticks.length - 1;

    const currentPrice = ticks[ticks.length - 1].close;
    const atr = this.calculateATR(ticks, 14);

    // NEW: Calculate R-score and normalize it
    const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
    const rScore = forState.failureScore || 0;
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

    // PHASE 3: Check FoR state every 5 bars (for deployment check)
    if (this.barIndex % 5 === 0) {
      const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
      this.engineState.receiveFoRAnalysis(forState, this.barIndex, currentRegime);
    }

    // PHASE 4: Check exits if DEPLOYED
    if (this.positionState.isActive && this.engineState.getState().status === 'DEPLOYED') {
      const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
      
      // NEW: Circuit breaker check (structure-anchored)
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
      
      // NEW: Scale-in opportunity check (response-based, not price-based)
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
```

---

## File 6: ConvexityAgent.ts - New Helper Method

**Location**: Add this new method to the class

```typescript
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
```

---

## File 7: ConvexityAgent.ts - Position Reset (OnClose)

**Location**: In existing `handleExitSignal` method, at cleanup

**Add** at the end of position cleanup:

```typescript
private handleExitSignal(signal: ExitSignal, exitPrice: number): void {
  // ... existing exit logic ...
  
  // At the end of position cleanup, add:
  
  // Reset validators for next position
  this.scaleInValidator = null;
  this.lastRScore = 0;
  this.lastRNormalized = 0;
}
```

---

## Summary of Changes

### New Files (4)
- ResponseNormalizer.ts
- VFMDDeduplicator.ts
- ScaleInValidator.ts
- CircuitBreakerStructureAnchored.ts

### Modified Files (1)
- ConvexityAgent.ts (additions: 6 imports, 4 properties, 1 updated method, 2 new methods)

### Total Lines Added
- New files: ~850 lines
- ConvexityAgent modifications: ~150 lines
- Total: ~1,000 lines (well-commented, fully typed)

### Estimated Implementation Time
- File creation: 2 hours (already done)
- ConvexityAgent updates: 3 hours
- Unit test writing: 4 hours
- Integration testing: 4 hours
- Backtest validation: 4 hours
- Paper trading setup: 2 hours
- **Total: ~19 hours over 2 weeks**

---

## Verification Checklist

After applying all changes:

- [ ] Code compiles without errors
- [ ] All imports resolve
- [ ] ResponseNormalizer initialized in constructor
- [ ] VFMDDeduplicator filtering in onVFMDSignalFired
- [ ] R-score normalization in processTick
- [ ] Circuit breaker check in processTick (position active)
- [ ] Scale-in validator in processTick
- [ ] Health diagnostics method exists
- [ ] New properties initialize correctly
- [ ] Unit tests pass (50+ test cases)
- [ ] Integration tests pass (50+ scenarios)
- [ ] Backtest passes (50+ symbols, multiple regimes)

---

## Notes

- All fixes are backward-compatible (can be rolled back individually)
- New modules are independent and testable in isolation
- Circuit breaker has "legacy mode" fallback if needed
- Response normalizer self-heals on regime changes (no re-optimization needed)
- Diagnostics log every 10 bars for easy monitoring
