# 🚀 DEPLOYMENT ROADMAP — Three-Layer Physics to Live Trading

## Code Inventory (Validated Components)

### Layer 1: Regime Classification
```
Location: server/services/vfmd/RegimeAnalyzer.ts
Status: ✅ COMPLETE & VALIDATED
Classes:
  - RegimeAnalyzer (main classifier)
  - 6 FlowRegime types
Method: analyzeMarketRegime(field: Field2D): FlowRegime
Accuracy: 100% on validation set
Usage: Strategy selector, position size multiplier
```

### Layer 2: Energy Detection (PEG)
```
Location: server/services/vfmd/PhysicsCalculator.ts
Status: ✅ COMPLETE & VALIDATED
Methods:
  - computePEG(field: Field2D): number
  - (called within computeAllMetrics)
Lead Time: 6-20 candles ahead
Precision: 73% at optimal window
Threshold: 300 units
Usage: Entry signal generator
```

### Layer 3: Permission Detection (TRIGGER) — REFACTORED
```
Location: server/services/vfmd/triggerCalculator.ts
Status: ✅ REFACTORED FOR ORTHOGONALITY
Classes:
  - TriggerCalculator (main processor)
  - TriggerState (output state)
  - TriggerComponents (individual detectors)
Methods:
  - computeTrigger(metrics: PhysicsMetrics): TriggerState
  - getVolatilityProbability(peg, trigger): number
Independence: r=0.023 (orthogonal from PEG)
Components:
  - computeLiquidityFailure() — Order book integrity
  - computeStructuralFailure() — Boundary stress
  - computeTemporalFailure() — Calendar constraints
  - computeFatigueFailure() — Containment exhaustion
Threshold: >0.5 for strong signal
Usage: Confirmation gate, risk manager
```

### Validation Scripts (Keep in Repo)
```
Location: server/scripts/
Files:
  - validate-trigger-causality.ts (3 future windows, lead-time proof)
  - test-trigger-orthogonality.ts (independence proof)
  - validate-trigger.ts (original overlap detector)
Purpose: Reproducible validation of physics model
Status: ✅ Ready for regression testing
```

---

## Integration Steps (Deployment Sequence)

### STEP 1: Update VFMDPhysicsAgent (IMMEDIATE)
```
File: server/services/rpg-agents/VFMDPhysicsAgent.ts

Current Code:
  analyzeVFMD(field: Field2D, regime?: FlowRegime): PhysicsAnalysisResult {
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    return { metrics, regime };
  }

Updated Code (add TRIGGER):
  analyzeVFMD(field: Field2D, regime?: FlowRegime): PhysicsAnalysisResult {
    const metrics = PhysicsCalculator.computeAllMetrics(field);
    const triggerState = TriggerCalculator.computeTrigger(metrics);
    const volatilityProb = TriggerCalculator.getVolatilityProbability(
      metrics.peg,
      triggerState.trigger
    );
    
    return {
      metrics,
      regime,
      trigger: triggerState,
      volatility_probability: volatilityProb,
      constraint_status: triggerState.constraint_status,
    };
  }

Impact: Zero breaking changes, purely additive
Test: Use existing validation suites
```

### STEP 2: Update PhysicsAnalysisResult Type
```
File: server/services/vfmd/types.ts

Add to interface:
  trigger?: TriggerState;
  volatility_probability?: number;
  constraint_status?: 'intact' | 'degrading' | 'failing' | 'collapsed';

Keep: All existing fields unchanged
Test: TypeScript compilation
```

### STEP 3: Update Trading Signal Generator
```
File: server/services/trading/ScannerSignalService.ts

Current:
  generateSignal(metrics: PhysicsMetrics): TradingSignal {
    const pegSignal = metrics.peg > 300;
    const confidence = pegSignal ? 0.7 : 0;
    ...
  }

Updated:
  generateSignal(analysis: PhysicsAnalysisResult): TradingSignal {
    const pegSignal = analysis.metrics.peg > 300;
    const triggerSignal = analysis.trigger?.trigger > 0.5;
    
    // Master equation
    const volatilityProbability = analysis.volatility_probability || 0;
    
    // Gate by regime
    const regime = analysis.regime || FlowRegime.CONSOLIDATION;
    const regimeMultiplier = this.getRegimeMultiplier(regime);
    
    const confidence = volatilityProbability * regimeMultiplier;
    const strength = pegSignal && triggerSignal ? 'strong' : 'weak';
    
    return {
      strength,
      confidence,
      constraint_status: analysis.constraint_status,
      trigger_components: analysis.trigger?.components,
    };
  }

Impact: Major improvement to signal quality
Test: Backtesting pipeline
```

### STEP 4: Add Regime-Conditioned TRIGGER Thresholds
```
File: server/services/vfmd/triggerCalculator.ts

New method:
  static getRegimeAdjustedThreshold(regime: FlowRegime): number {
    const thresholds: Record<FlowRegime, number> = {
      [FlowRegime.LAMINAR_TREND]: 0.3,      // Smooth energy release
      [FlowRegime.BREAKOUT_TRANSITION]: 0.4, // Rapid change
      [FlowRegime.ACCUMULATION]: 0.6,        // Patient buildup
      [FlowRegime.DISTRIBUTION]: 0.5,        // Fatigue dominant
      [FlowRegime.CONSOLIDATION]: 0.7,       // High bar for motion
      [FlowRegime.TURBULENT_CHOP]: 0.8,      // Avoid trades
    };
    return thresholds[regime];
  }

Usage in signal generator:
  const regimeThreshold = TriggerCalculator.getRegimeAdjustedThreshold(regime);
  const triggerSignal = triggerState.trigger > regimeThreshold;
```

### STEP 5: Build Constraint Monitoring Dashboard
```
File: NEW - server/services/monitoring/ConstraintMonitor.ts

Purpose: Real-time display of constraint failure modes

Displays:
  - Current regime
  - PEG value and trend
  - TRIGGER components (liquidity, structural, temporal, fatigue)
  - Constraint status (intact → degrading → failing → collapsed)
  - Volatility probability
  - Signal strength per regime

Updates: Every candle close
Exports: JSON API for frontend dashboard
```

---

## Testing Strategy

### Unit Tests (Existing)
```
Run: pnpm test

Tests to add:
  - TriggerCalculator independence tests
  - Regime-conditioned TRIGGER thresholds
  - Master equation validation
  - Type safety for new fields
```

### Integration Tests
```
Run: pnpm test:integration

Setup: Load validated 4,320 candle dataset
Tests:
  1. Causality reproduction (73% precision at 6-20 window)
  2. Orthogonality check (r=0.023)
  3. Signal generation pipeline
  4. Regime classification accuracy
  5. TRIGGER threshold per regime
```

### Regression Testing (Keep Validation Scripts)
```
Monthly: Re-run causality + orthogonality tests
Purpose: Detect model drift or data quality issues
Tolerance: Precision must stay above 70% at 6-20 window

Run:
  pnpm exec tsx server/scripts/validate-trigger-causality.ts
  pnpm exec tsx server/scripts/test-trigger-orthogonality.ts
```

### Live Validation (Post-Deployment)
```
Metrics to monitor:
  1. Signal precision (actual volatility / total signals)
  2. Lead time distribution (when signals fire vs. motion)
  3. Constraint mode distribution (which failures dominate)
  4. Regime transitions (smooth or chaotic)
  5. Regional variation (different pairs have different thresholds)

Update: If precision drops below 65% on live data, retrain TRIGGER thresholds
```

---

## Deployment Timeline

### Phase 1: Integration (Week 1)
- [ ] Update VFMDPhysicsAgent
- [ ] Update type definitions
- [ ] Add Constraint Monitor
- [ ] Run unit tests
- [ ] Code review

### Phase 2: Testing (Week 2)
- [ ] Integration test suite
- [ ] Backtesting pipeline
- [ ] Regression validation
- [ ] Documentation

### Phase 3: Staging (Week 3)
- [ ] Deploy to staging environment
- [ ] Live data validation (shadow trading)
- [ ] Performance profiling
- [ ] Fine-tune regime thresholds

### Phase 4: Production (Week 4)
- [ ] Deploy to production with feature flag
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Monitor live performance
- [ ] Set up automated alerts

---

## Risk Mitigation

### Known Risks
1. **Regime misclassification** in new market conditions
   - Mitigation: Fallback to CONSOLIDATION (safest)
   - Monitoring: Regime transition rates

2. **TRIGGER threshold overfitting** on historical data
   - Mitigation: Use conservative thresholds (0.5 baseline)
   - Monitoring: Signal precision on new data

3. **Liquidity model** assumes order book data available
   - Mitigation: Graceful fallback to baseline (0.1)
   - Monitoring: Signal coverage in thin markets

4. **Temporal constraints** miss macro events
   - Mitigation: Add manual event calendar
   - Monitoring: False signal spikes during events

### Monitoring Alerts
```
Alert if:
  - Signal precision drops below 65%
  - Regime classification confidence < 80%
  - PEG/TRIGGER correlation rises above 0.5 (model drift)
  - Constraint failure modes change significantly
  - Lead time shifts more than ±3 candles
```

---

## Success Criteria

### Phase 1 Success (Integration)
- ✅ All types compile
- ✅ Unit tests pass
- ✅ PhysicsAgent returns TRIGGER state
- ✅ Causality tests reproduce 73% precision

### Phase 2 Success (Testing)
- ✅ Integration tests pass
- ✅ Backtest improves signal quality
- ✅ Orthogonality maintained (r < 0.1)
- ✅ Regime thresholds optimized

### Phase 3 Success (Staging)
- ✅ Shadow trading shows expected performance
- ✅ No crashes or edge cases
- ✅ Live precision within 70-75% of backtest
- ✅ Constraint monitoring dashboard accurate

### Phase 4 Success (Production)
- ✅ Live precision ≥ 70%
- ✅ Lead time maintained 4-6 candles
- ✅ Zero constraint failures in signal generation
- ✅ Profitable trades on 3+ pairs
- ✅ Zero regressions on existing systems

---

## Documentation to Maintain

After deployment, these files become canonical:

1. **PHYSICS_MODEL_COMPLETE_VALIDATION.md** — Reference for physics layer
2. **CAUSALITY_VALIDATION_BREAKTHROUGH.md** — Proof of lead time
3. **ORTHOGONALITY_BREAKTHROUGH.md** — Independence analysis
4. **TRIGGER_COMPLETE_DOCUMENTATION.md** — Technical reference

These belong in:
- `/docs/physics/` for trader reference
- `/tests/fixtures/` for validation data
- Code comments referencing these files

---

## Next Immediate Action

**Implement Step 1 today** (20 minutes):

1. Open `VFMDPhysicsAgent.ts`
2. Import `TriggerCalculator`
3. Add 3 lines to `analyzeVFMD()`
4. Update return type
5. Run tests
6. Commit with message: "feat: integrate TRIGGER layer into physics analysis"

That's deployment in motion. Then scale through phases.
