# PHASE 1 CORE FIXES: INTEGRATION GUIDE

**Status**: Ready for implementation  
**Timeline**: 2 weeks  
**Effort**: ~19 hours  

---

## Quick Summary of Changes

### File Additions (4 new core modules)
1. **ResponseNormalizer.ts** - Regime-adaptive R-score thresholds
2. **VFMDDeduplicator.ts** - Prevent VFMD clustering
3. **ScaleInValidator.ts** - Response-based scale-in (not price)
4. **CircuitBreakerStructureAnchored.ts** - Thesis-aware exits

### File Modifications (1 existing agent)
1. **ConvexityAgent.ts** - Wire in the 4 new modules

---

## PHASE 1 IMPLEMENTATION STEPS

### Step 1: Update ConvexityAgent Constructor

**Location**: `ConvexityAgent.ts`, constructor method

**Change**:
```typescript
// ADD THESE IMPORTS at top
import { ResponseNormalizer } from './convexEngine/ResponseNormalizer';
import { VFMDDeduplicator } from './convexEngine/VFMDDeduplicator';
import { ScaleInValidator } from './convexEngine/ScaleInValidator';
import { CircuitBreakerStructureAnchored } from './convexEngine/CircuitBreakerStructureAnchored';

// IN CONSTRUCTOR, add these instance variables
private responseNormalizer: ResponseNormalizer;
private vfmdDeduplicator: VFMDDeduplicator;
private scaleInValidator: ScaleInValidator | null = null;
private circuitBreaker: CircuitBreakerStructureAnchored;

// INITIALIZE in constructor
constructor(name: string, personality: AgentPersonality = 'balanced') {
  super(name, 'PHYSICS_VFMD', personality);

  // ... existing abilities ...

  // NEW: Initialize core fixes
  this.responseNormalizer = new ResponseNormalizer(200);  // 200-bar lookback
  this.vfmdDeduplicator = new VFMDDeduplicator(3);        // 3-bar cooldown
  // scaleInValidator created when position enters
  
  // NEW: Circuit breaker for this asset (configure per asset)
  this.circuitBreaker = new CircuitBreakerStructureAnchored({
    priceLossThreshold: 0.015,       // 1.5% for crypto (tune per asset)
    responseDecayThreshold: -0.05,   // R velocity must be > -5%
    regimeVolatilityThreshold: 4.0,  // ATR > 4% = noisy
    requireBothConditions: true      // Strict mode: both conditions must trigger
  });
}
```

---

### Step 2: Update onVFMDSignalFired with De-duplication

**Location**: `ConvexityAgent.ts`, `onVFMDSignalFired()` method

**Change**: Add de-duplication check

```typescript
onVFMDSignalFired(vfmdSignal: AgentSignal, regime: FlowRegime): void {
  if (vfmdSignal.action === 'HOLD') {
    return;
  }

  // NEW: De-duplication check
  const deduped = this.vfmdDeduplicator.filter(
    {
      direction: vfmdSignal.action as 'BUY' | 'SELL',
      strength: vfmdSignal.confidence,
      bar: this.barIndex,
      price: vfmdSignal.entry,
      reason: 'VFMD Scout'
    },
    this.barIndex,
    this.engineState.getState().status as any  // Map to engine state
  );

  if (!deduped.shouldProcess) {
    console.log(`[ConvexityAgent ${this.name}] VFMD DEDUP: ${deduped.reason}`);
    return;  // Ignore this VFMD
  }

  // Record that we processed this VFMD
  this.vfmdDeduplicator.record(
    {
      direction: vfmdSignal.action as 'BUY' | 'SELL',
      strength: vfmdSignal.confidence,
      bar: this.barIndex,
      price: vfmdSignal.entry,
      reason: 'VFMD Scout'
    },
    this.barIndex
  );

  this.currentRegime = regime;
  const currentATR = 0;
  this.engineState.receiveVFMDSignal(vfmdSignal, this.barIndex, currentATR);

  console.log(
    `[ConvexityAgent ${this.name}] VFMD Scout entered: ${vfmdSignal.action} @ ${vfmdSignal.entry.toFixed(2)} | Watching for persistence...`
  );
}
```

---

### Step 3: Add Response Normalization to processTick

**Location**: `ConvexityAgent.ts`, `processTick()` method

**Change**: Update R-score checking with normalized thresholds

```typescript
processTick(ticks: MarketTick[], currentRegime: FlowRegime, fairPrice: number = 0): void {
  if (ticks.length === 0) return;

  this.currentRegime = currentRegime;
  this.fairPrice = fairPrice || ticks[ticks.length - 1].close;
  this.barIndex = ticks.length - 1;

  const currentPrice = ticks[ticks.length - 1].close;
  const atr = this.calculateATR(ticks, 14);

  // NEW: Calculate R-score and normalize it
  const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
  const rScore = forState.failureScore || 0;  // Get raw R-score from FoR
  const rNormalized = this.responseNormalizer.update(rScore);  // Normalize it
  
  // Log percentile for diagnostics
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
      false
    );

    if (survivalStatus === 'DEAD' || survivalStatus === 'EXPIRED') {
      console.log(`[ConvexityAgent ${this.name}] Scout invalidated, stopping watch`);
    }
  }

  // PHASE 2: Feed FoR calculator (existing)
  this.forCalculator.processTick(
    ticks[ticks.length - 1],
    this.fairPrice,
    currentPrice,
    atr
  );

  // PHASE 3: Check FoR state every 5 bars (existing)
  if (this.barIndex % 5 === 0) {
    const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
    this.engineState.receiveFoRAnalysis(forState, this.barIndex, currentRegime);
  }

  // PHASE 4: Check exits if DEPLOYED
  if (this.positionState.isActive && this.engineState.getState().status === 'DEPLOYED') {
    const forState = this.forCalculator.calculateFoR(currentPrice, this.fairPrice, atr);
    
    // NEW: Check circuit breaker with structure anchoring
    const rVelocity = (rScore - this.lastRScore) || 0;
    const breaker = this.circuitBreaker.check(
      currentPrice,
      rNormalized,
      this.lastRNormalized || rNormalized,
      atr / currentPrice * 100  // ATR as % of price
    );
    
    if (breaker.triggered) {
      console.log(`[ConvexityAgent ${this.name}] ⚠️ CIRCUIT BREAKER: ${breaker.reason}`);
      this.handleExitSignal('EXIT_STOP', currentPrice);
      return;
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
    
    // Track R-score for velocity calculation
    this.lastRScore = rScore;
    this.lastRNormalized = rNormalized;
  }
}
```

**Add these instance variables to ConvexityAgent**:
```typescript
private lastRScore: number = 0;
private lastRNormalized: number = 0;
```

---

### Step 4: Implement Response-Based Scale-In

**Location**: `ConvexityAgent.ts`, in `processTick()` after circuit breaker check

**Add**: New scale-in validation logic

```typescript
// In processTick, after position tracking:

// NEW: Scale-in opportunity check (response-based, not price-based)
if (this.positionState.isActive && !this.scaleInValidator) {
  // Initialize scale-in validator on first tick
  this.scaleInValidator = new ScaleInValidator(this.responseNormalizer);
}

if (this.positionState.isActive && this.scaleInValidator) {
  // Record current R-score
  this.scaleInValidator.recordRScore(rNormalized);
  
  // Check if scale-in is valid
  const rVelocity = rNormalized - (this.lastRNormalized || rNormalized);
  const scaleInValidation = this.scaleInValidator.validate(
    rNormalized,
    rVelocity
  );
  
  if (scaleInValidation.canScaleIn) {
    console.log(`[ConvexityAgent ${this.name}] 📈 SCALE-IN OPPORTUNITY`);
    console.log(scaleInValidation.details.join(' | '));
    
    // Signal to position manager to scale in
    // This would integrate with your position sizing system
    this.signalScaleIn(scaleInValidation.confidence);
  }
}
```

**Add this helper method**:
```typescript
private signalScaleIn(confidence: number): void {
  // TODO: Integrate with PositionManager
  // This should:
  // 1. Calculate additional size (e.g., 25% of original)
  // 2. Place order at current price (or limit slightly better)
  // 3. Update position tracking
  // 4. Log scale-in for analysis
  console.log(`[Scale-in signal] Confidence: ${(confidence * 100).toFixed(0)}%`);
}
```

---

### Step 5: Add Health Monitoring Integration

**Location**: `ConvexityAgent.ts`, in `generateSignal()` or new method

**Add**: Log diagnostics periodically

```typescript
/**
 * Get current health diagnostics
 * Call periodically or on demand
 */
getHealthDiagnostics(): string {
  const dedupStats = this.vfmdDeduplicator.getStats();
  const normalizeHealth = this.responseNormalizer.getHealthIndicators();
  
  return [
    `VFMD Dedup: ${dedupStats.processed} processed, ${dedupStats.ignored} ignored`,
    `Dedup Rate: ${(dedupStats.ignoreRate * 100).toFixed(1)}%`,
    `R-Score Regime: P25=${(normalizeHealth.p25 * 100).toFixed(0)}%, ` +
    `P50=${(normalizeHealth.p50 * 100).toFixed(0)}%, P75=${(normalizeHealth.p75 * 100).toFixed(0)}%`,
    `Response Samples: ${normalizeHealth.responseCount}`,
    this.circuitBreaker.getDiagnostics()
  ].join(' | ');
}
```

---

## Testing Checklist

### Unit Tests

- [ ] ResponseNormalizer: Percentile calculation accuracy
- [ ] ResponseNormalizer: Self-healing on regime change
- [ ] VFMDDeduplicator: Cooldown logic per state
- [ ] VFMDDeduplicator: State machine transitions
- [ ] ScaleInValidator: All 3 check conditions
- [ ] CircuitBreakerStructureAnchored: Price + response logic
- [ ] CircuitBreakerStructureAnchored: Legacy mode fallback

### Integration Tests

- [ ] ConvexityAgent starts with all 4 modules initialized
- [ ] VFMD dedup filters same-direction signals
- [ ] R-score normalization updates every tick
- [ ] Scale-in validator blocks weak responses
- [ ] Circuit breaker requires both conditions in STRICT mode
- [ ] Logging shows all diagnostic messages

### Backtest Validation

- [ ] 50+ backtests on different symbols
- [ ] 50+ backtests across different market regimes
- [ ] Verify: fewer entries (dedup working)
- [ ] Verify: longer holds (price PnL gate removed)
- [ ] Verify: circuit breaker doesn't over-trigger (wicks pass)
- [ ] Win rate: 35-45% expected
- [ ] Profit factor: > 1.5x expected

### Paper Trading

- [ ] 100+ paper trades before live deployment
- [ ] Monitor metrics:
  - Top 10% trades = 70%+ of profits
  - Avg hold time = 8-20 bars
  - Entry R-score avg = 0.65+
  - Dedup ignore rate < 40%

---

## Configuration Tuning (Per Asset)

### Crypto (BTC/ETH)
```typescript
new CircuitBreakerStructureAnchored({
  priceLossThreshold: 0.015,       // 1.5%
  responseDecayThreshold: -0.05,
  regimeVolatilityThreshold: 4.0,  // 4% ATR
  requireBothConditions: true
})
```

### Stocks (SPY/QQQ)
```typescript
new CircuitBreakerStructureAnchored({
  priceLossThreshold: 0.008,       // 0.8%
  responseDecayThreshold: -0.05,
  regimeVolatilityThreshold: 2.5,  // 2.5% ATR
  requireBothConditions: true
})
```

### Forex (EUR/USD)
```typescript
new CircuitBreakerStructureAnchored({
  priceLossThreshold: 0.003,       // 0.3%
  responseDecayThreshold: -0.05,
  regimeVolatilityThreshold: 2.0,  // 2% ATR
  requireBothConditions: true
})
```

---

## Rollback Plan

If issues occur during implementation:

1. **Dedup over-filtering** → Increase `dedupCooldown` from 3 to 5 bars
2. **Scale-in never triggers** → Loosen `scaleIn` threshold from 0.75 to 0.65
3. **Circuit breaker too strict** → Set `requireBothConditions: false` (legacy mode)
4. **R-score normalization unstable** → Increase lookback from 200 to 300 bars

---

## Success Criteria

System is working correctly when:

✅ Dedup ignore rate 15-25% (removes noise, not valid signals)  
✅ Scale-in happens on 20-30% of trades (confirmed on pullbacks)  
✅ Circuit breaker triggers < 5% of time (only pathological losses)  
✅ Win rate stable 35-45% (low but consistent)  
✅ Profit factor improves to 1.5-2.0x  
✅ All diagnostics logging cleanly every 10 bars  

---

## Next Steps After Phase 1

**Phase 2** (after 100 live trades):
- Add ConvexityHealthMonitor
- Track meta-statistics for system degradation detection
- Dashboard integration

**Phase 3** (after 500 live trades):
- Asset-specific threshold tuning
- Regime-specific parameter optimization
- Performance analysis by market type
