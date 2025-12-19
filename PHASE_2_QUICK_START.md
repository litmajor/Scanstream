# Phase 2: Regime Detection & Dynamic Weighting - Quick Start

**Status**: Ready to start  
**Duration**: 3 weeks  
**Goal**: Enhance Phase 1 signals with regime-aware dynamic weighting

---

## What Is Phase 2?

**Phase 1** = Unified pipeline: Scanner (35%) + ML (35%) + RL (30%) = AggregatedSignal

**Phase 2** = Make those weights **dynamic** based on market regime:
- TRENDING market → Boost Scanner to 50% (patterns work best)
- RANGING market → Boost ML to 50% (mean-reversion)
- VOLATILE market → Boost RL to 50% (risk management critical)

**Result**: Same 3 sources, but optimized weights per market condition = 10-15% Sharpe improvement

---

## Quick Run

### Test Infrastructure (Already Created)

```bash
# Run Phase 2 test suite (32 tests)
npm test -- --testPathPattern=phase-2-integration

# Expected: PASS (tests ready, code implementation next)
```

### Test Files Created

1. **phase-2-integration.test.ts** (600+ lines)
   - 5 sections: Regime detection, dynamic weights, effectiveness, edge cases, integration
   - 32 tests validating all Phase 2 requirements
   - Mock data generators (trending, ranging, volatile candles)

2. **PHASE_2_WEEK_1_CHECKLIST.md** (detailed implementation guide)
   - Step-by-step instructions for each component
   - Acceptance criteria for validation
   - Debugging tips for common issues

3. **PHASE_2_QUICK_START.md** (this file)
   - High-level overview
   - File locations to implement
   - Key milestones

---

## Implementation Roadmap (3 Weeks)

### Week 1: Regime Detection Framework ✅ (Planning Done)

**Files to implement/enhance**:
1. `server/services/ml-regime-detector.ts` - Core regime detection
2. `server/services/regime-aware-signal-router.ts` - Routing by regime
3. `server/services/live-velocity-calculator.ts` - Multi-timeframe regimes

**Deliverables**:
- Detect 4 regimes: TRENDING, RANGING, VOLATILE, CONSOLIDATING
- Calculate confidence per regime (0-1)
- Multi-timeframe confirmation (1H, 4H, 24H)
- Transition detection with hysteresis (prevent false flips)

**Success Metrics**:
- [ ] Regime detection accuracy > 80%
- [ ] False flips < 5% (hysteresis working)
- [ ] Confidence ranges 0-1 (normalized)

---

### Week 2: Dynamic Weight Adjustment ✅ (Planning Done)

**Files to implement**:
1. Update `server/lib/signal-pipeline.ts` - Apply dynamic weights
2. New file: `server/lib/weight-transition-manager.ts` - Smooth transitions
3. Update aggregation logic - Use regime weights instead of fixed 35/35/30

**Deliverables**:
- Weight matrices for all 4 regimes
- Smooth transitions (< 1% jump per candle)
- Apply to Phase 1 aggregateSignals() method
- Regime alignment boost/penalty

**Success Metrics**:
- [ ] All weights sum to 1.0 (always)
- [ ] Transitions smooth (< 1% per candle)
- [ ] Dynamic weights visible in output

---

### Week 3: Validation & Calibration ✅ (Planning Done)

**Files to implement**:
1. New file: `server/lib/regime-performance-analyzer.ts` - Analyze win rates
2. Backtest framework updates - Compare dynamic vs fixed
3. Update dashboard - Show regime metrics

**Deliverables**:
- Source win rates by regime (separate analysis)
- Backtest comparison: Dynamic vs Fixed weights
- Edge case testing (insufficient data, gaps, crashes)
- Dashboard metrics: Current regime, weights, confidence

**Success Criteria**:
- [ ] Dynamic Sharpe > Fixed Sharpe (+10-15%)
- [ ] Max Drawdown reduced
- [ ] Win Rate improved
- [ ] All edge cases handled

---

## Key Concepts Quick Reference

### Market Regimes

| Regime | ADX | ATR | Pattern | Best Source |
|--------|-----|-----|---------|------------|
| **TRENDING** | >25 | Normal | Consecutive HH/LL | Scanner (50%) |
| **RANGING** | <20 | Low | Bounces S/R | ML (50%) |
| **VOLATILE** | Any | >1.5x | Wide swings | RL (50%) |
| **CONSOLIDATING** | <20 | Falling | Compression | Scanner (40%) |

### Weight Adjustment Formula

```typescript
// Get regime
const regime = detectMarketRegime(candles);

// Get weights for regime
const weights = getRegimeWeights(regime);  // e.g., {scanner: 0.50, ml: 0.25, rl: 0.25}

// Apply to sources
const confidence = 
  scannerScore * weights.scanner +
  mlScore * weights.ml +
  rlScore * weights.rl;
```

### Smooth Transition (Prevent Whipsaw)

```typescript
// Don't flip regime on single candle
// Require 2+ consecutive confirmations before changing weights

if (adx < 20) {
  confirmationCount++;
} else {
  confirmationCount = 0;
}

if (confirmationCount >= 2) {
  flipRegime();  // Now safe to flip
}
```

---

## Files to Check/Implement

### Already Exist (Verify Working)

- ✅ `server/services/ml-regime-detector.ts` - Has regime detection
- ✅ `server/services/regime-aware-signal-router.ts` - Has routing logic
- ✅ `server/services/live-velocity-calculator.ts` - Multi-timeframe support
- ✅ `server/lib/signal-pipeline.ts` - Main aggregation point

### To Create/Update

- ⚠️ `server/lib/weight-transition-manager.ts` - Smooth transitions (NEW)
- ⚠️ `server/lib/regime-performance-analyzer.ts` - Win rate analysis (NEW)
- ⚠️ Update `server/lib/signal-pipeline.ts` - Apply dynamic weights
- ⚠️ Update `server/routes/signals.ts` - Add regime metrics endpoint

### Already Planned

- ✅ `phase-2-integration.test.ts` - Test suite (CREATED)
- ✅ `PHASE_2_WEEK_1_CHECKLIST.md` - Implementation guide (CREATED)
- ⚠️ `PHASE_2_ARCHITECTURE.md` - Visual diagrams (TO CREATE)

---

## Testing as You Go

### Test 1: Regime Detection

```bash
npm test -- --testPathPattern=phase-2.*Regime.*Detection
# Should see: PASS (or failing if not implemented yet)
```

### Test 2: Weight Adjustment

```bash
npm test -- --testPathPattern=phase-2.*Dynamic.*Weight
# Should see: PASS (or failing if weights not applied)
```

### Test 3: Full Integration

```bash
npm test -- --testPathPattern=phase-2-integration
# Should see: 32/32 PASS when Phase 2 fully implemented
```

---

## Success Definition

By end of Phase 2, the system must:

1. **Detect regime** with >80% accuracy
   - [ ] TRENDING when ADX > 25
   - [ ] RANGING when ADX < 20
   - [ ] VOLATILE when ATR > 1.5x normal
   - [ ] CONSOLIDATING when ATR falling

2. **Adjust weights smoothly**
   - [ ] Weights change < 1% per candle
   - [ ] All weights sum to 1.0
   - [ ] Transitions over 3-5 candles

3. **Apply to Phase 1 signals**
   - [ ] TRENDING signals get Scanner boost
   - [ ] RANGING signals get ML boost
   - [ ] VOLATILE signals get RL boost
   - [ ] Confidence adjusted accordingly

4. **Beat fixed weights**
   - [ ] Dynamic Sharpe > Fixed Sharpe (+10%)
   - [ ] Max DD reduced by 2-3%
   - [ ] Win rate improved by 2+%
   - [ ] Improvement holds across symbols/periods

5. **Handle edge cases**
   - [ ] < 20 candles: fallback to baseline
   - [ ] Missing volume: still detect regime
   - [ ] Data gaps: skip, don't flip
   - [ ] Flash crashes: ignore single spikes
   - [ ] False flips: hysteresis prevents (<5%)

---

## Common Questions

**Q: Why dynamic weights?**  
A: Different sources excel in different markets. Scanner dominates trends, ML dominates ranges, RL dominates chaos. Adjusting weights captures each source's strength.

**Q: How much improvement expected?**  
A: Historical data suggests 10-15% Sharpe improvement, 2-3% less drawdown, 2-3% higher win rate.

**Q: What if regime detection wrong?**  
A: Hysteresis (2-candle confirmation) prevents false flips. Fallback to baseline weights if confidence low.

**Q: How long to implement?**  
A: 3 weeks following the weekly breakdown in checklist. Test each component as you go.

**Q: Do I need Phase 1 complete first?**  
A: Yes, Phase 2 depends on Phase 1 signals existing and flowing correctly.

---

## Next Steps

1. **Start Week 1**: Enhance regime detection
   - Review existing code in ml-regime-detector.ts
   - Add multi-timeframe confirmation
   - Add hysteresis to prevent false flips
   - Run tests: `npm test -- --testPathPattern=Regime`

2. **Then Week 2**: Implement dynamic weights
   - Create weight matrices
   - Update signal-pipeline.ts aggregation
   - Implement smooth transitions
   - Run tests: `npm test -- --testPathPattern=Dynamic`

3. **Finally Week 3**: Validate & calibrate
   - Analyze source win rates by regime
   - Backtest dynamic vs fixed weights
   - Test all edge cases
   - Run full suite: `npm test -- --testPathPattern=phase-2`

4. **Then Phase 3**: Quality gating
   - 5-tier quality system
   - Multi-layer filtering
   - Performance tracking
   - Next milestone after Phase 2 complete

---

## Reference Docs

- **Full Checklist**: See `PHASE_2_WEEK_1_CHECKLIST.md` (detailed step-by-step)
- **Architecture**: See `PHASE_2_ARCHITECTURE.md` (coming next - visual diagrams)
- **Regime Reference**: See `CURRENT_REGIME_STATUS.md` (regime definitions)
- **Roadmap Context**: See `SIGNAL_SYSTEM_IMPLEMENTATION_ROADMAP.md` (full project)
- **Test Suite**: See `phase-2-integration.test.ts` (all 32 tests)

---

**Ready to build?** Start with Week 1 implementation. See `PHASE_2_WEEK_1_CHECKLIST.md` for detailed steps.
