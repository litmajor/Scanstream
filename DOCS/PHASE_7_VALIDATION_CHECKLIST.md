# Phase 7 Implementation Validation Checklist

**Purpose:** Ensure RTM force-decay implementation is working correctly before deployment  
**Status:** Implementation complete, ready for validation  
**Next Step:** Execute this checklist in the next session

---

## Pre-Validation Setup

### Dependencies Check
- [ ] TypeScript compiler installed (`tsc --version`)
- [ ] PNPM available (`pnpm --version`)
- [ ] Node.js >= 18 (`node --version`)
- [ ] All dependencies installed (`pnpm install`)

### File Verification
- [ ] `server/services/physics-based-rtm-engine.ts` exists and is 770 lines
- [ ] `server/backtest/convexity-backtester-with-for.ts` exists and is ~1420 lines
- [ ] `test-rtm-force-decay.ts` exists in root
- [ ] All 4 documentation files created

---

## Compilation Checks

### Step 1: Verify RTM Engine Compiles
```bash
npx tsc --noEmit server/services/physics-based-rtm-engine.ts
```
**Expected:** No errors (import error for '../types' is pre-existing)

### Step 2: Verify Backtester Compiles
```bash
npx tsc --noEmit server/backtest/convexity-backtester-with-for.ts
```
**Expected:** Pre-existing errors only (not related to force-decay changes)

### Step 3: Run Validation Script
```bash
pnpm tsx test-rtm-force-decay.ts
```
**Expected Output:**
```
=== RTM Force-Decay Metrics Validation ===

✓ Generated 50 mock market frames
✓ All 18 RTMMetric fields defined
  - 12 original
  - 6 new force-decay metrics

[Lists all force-decay metrics]

=== Validation Complete ===
Status: ✓ All force-decay metrics defined and ready
```

---

## Functional Validation

### Step 4: Verify RTMMetric Interface
**File:** `server/services/physics-based-rtm-engine.ts:26–58`

Check these 6 new fields exist:
```typescript
export interface RTMMetric {
  // ... original 12 fields ...
  
  decayStrength: number;        // ⬅️ NEW
  depthCompression: number;     // ⬅️ NEW
  timeCompression: number;      // ⬅️ NEW
  volatilityParadox: boolean;   // ⬅️ NEW
  forPermissionSlip: boolean;   // ⬅️ NEW
  forConfidence: number;        // ⬅️ NEW
}
```

**Validation:**
- [ ] All 6 fields present
- [ ] Correct types (number/boolean)
- [ ] Comments explaining each field

---

### Step 5: Verify New Methods Exist
**File:** `server/services/physics-based-rtm-engine.ts:490–720`

Check these 5 private methods exist:
```typescript
private calculateDecayStrength(): number
private calculateDepthCompression(currentPullbackDepth: number): number
private calculateTimeCompression(currentPullbackDuration: number): number
private detectVolatilityParadox(frames: MarketFrame[], priceDeviation: number): boolean
private evaluateFoRPermissionSlip(...): { forPermissionSlip: boolean; forConfidence: number }
```

**Validation:**
- [ ] All 5 methods present
- [ ] Correct signatures
- [ ] Methods have JSDoc comments
- [ ] Methods have error handling

---

### Step 6: Verify calculateRTMMetric Updates
**File:** `server/services/physics-based-rtm-engine.ts:100–195`

Check that calculateRTMMetric() now:
```typescript
// Step 11: Calculate Force-Decay Metrics
const decayStrength = this.calculateDecayStrength();
const depthCompression = this.calculateDepthCompression(currentPullbackDepth);
const timeCompression = this.calculateTimeCompression(frames.length);
const volatilityParadox = this.detectVolatilityParadox(frames, priceDeviation);

// Step 12: Evaluate FoR Permission Slip
const forSlip = this.evaluateFoRPermissionSlip(...);

// Return all metrics
return {
  // ... existing fields ...
  decayStrength,
  depthCompression,
  timeCompression,
  volatilityParadox,
  forPermissionSlip: forSlip.forPermissionSlip,
  forConfidence: forSlip.forConfidence,
  reasoning
};
```

**Validation:**
- [ ] Steps 11–12 present in calculateRTMMetric
- [ ] All 6 force-decay metrics calculated
- [ ] All 6 metrics returned in RTMMetric object
- [ ] Reasoning strings updated

---

## Backtester Integration

### Step 7: Verify FoR Confirmation Logic
**File:** `server/backtest/convexity-backtester-with-for.ts:780–835`

Check that FoR confirmation now:
```typescript
// Try physics-based RTM FoR
let usePhysicsBasedFoR = false;

try {
  if (this.rtmEngine && recentCandles.length >= 10) {
    rtmMetric = this.rtmEngine.calculateRTMMetric(
      currentCandle,
      recentCandles,
      orderFlow,  // Placeholder
      scout.entryPrice
    );
    
    if (rtmMetric && rtmMetric.forPermissionSlip) {
      usePhysicsBasedFoR = true;
      // Log metrics
    }
  }
} catch (err) {
  console.warn(...);
}

// Fallback if RTM unavailable
if (!usePhysicsBasedFoR && scout.pnlPct !== undefined && scout.pnlPct > 0) {
  usePhysicsBasedFoR = true;
}

if (usePhysicsBasedFoR) {
  // Proceed to trend validation
}
```

**Validation:**
- [ ] RTM FoR logic present
- [ ] Fallback logic present
- [ ] No syntax errors
- [ ] Logging statements in place

---

## Diagnostic Output

### Step 8: Run Backtester and Check Logging
```bash
pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 2>/dev/null | grep -A2 "RTM FoR"
```

**Expected Output (when scout completes with FoR triggered):**
```
[RTM FoR] Bar XXXX: Force-decay signals detected
  - Decay: XX%
  - Compression: XX%
  - Paradox: DETECTED
  → FoR CONFIRMED (confidence: XX%)

[FoR+TREND] Bar XXXX: Scout completed (FoR) + Trend ACCEPTED → Convex ENTER
```

**Validation:**
- [ ] At least 5 RTM FoR triggers in backtester output
- [ ] All 6 metrics shown (decay, compression, paradox, confidence)
- [ ] Logging format matches expected pattern

---

## Hypothesis Tests (Ready to Run)

### Hypothesis 1: RTM Triggers Earlier Than Scout Exit
```bash
# Check average deployment bar
pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 | grep "Avg deployment"
```
**Expected:** < 15 bars (vs. 21 for time-based)
- [ ] Deployment bars < 15 on average

### Hypothesis 2: Force Metrics Predict Scout Profitability
```bash
# Manual inspection: Compare rtmMetric values to scout.pnlPct
# Check backtester logs for patterns
```
**Expected:** High decay/compression/paradox correlates with profitable scouts
- [ ] Visual correlation observed in logs
- [ ] Can proceed to correlation calculation

### Hypothesis 3: Volatility Paradox is High-Confidence Signal
```bash
# Count instances where paradox=true
grep "Paradox: DETECTED" backtester-output.log | wc -l
```
**Expected:** > 80% of these trigger FoR permission
- [ ] Run count and manually verify accuracy

### Hypothesis 4: 50% Faster Deployment
```bash
# Compare deployment bars: RTM vs. time-based
# Run run-rtm-comparison.ts for side-by-side
pnpm tsx server/backtest/run-rtm-comparison.ts BTC USDT 2024-01-01
```
**Expected:** RTM avg < 50% of time-based (avg 10 vs. 21)
- [ ] Comparative test shows 50% improvement

### Hypothesis 5: +8–20% Sharpe Improvement
```bash
# Check Sharpe ratio in backtester output
pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 | grep -i "sharpe\|return"
```
**Expected:** Sharpe ratio > 1.3 (baseline ~1.1)
- [ ] Sharpe improvement visible in output

---

## Documentation Validation

### Step 9: Verify All Documentation Files
- [ ] `RTM_FORCE_DECAY_QUICK_REF.md` exists (500+ words)
- [ ] `RTM_FORCE_DECAY_IMPLEMENTATION.md` exists (2000+ words)
- [ ] `RTM_FORCE_DECAY_COMPLETION_SUMMARY.md` exists (1500+ words)
- [ ] `RTM_DOCUMENTATION_MASTER_INDEX.md` exists (2000+ words)

### Step 10: Check Documentation Quality
For each file:
- [ ] Table of contents/navigation present
- [ ] Code examples provided
- [ ] Algorithms explained with formulas
- [ ] Integration points documented
- [ ] Expected outputs described

---

## Error Handling Validation

### Step 11: Test Error Cases
```bash
# Run backtester with different symbols/dates to trigger edge cases
pnpm tsx server/backtest/convexity-backtester-with-for.ts ETH USDT 2024-01-01  # Different symbol
pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2023-01-01  # Old date
```

**Validation:**
- [ ] No crashes with different symbols
- [ ] Fallback works when RTM unavailable
- [ ] Error messages are informative
- [ ] Backtester completes without hanging

---

## Performance Validation

### Step 12: Check Backtest Performance
```bash
# Measure execution time
time pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01
```

**Expected:**
- Execution time: < 30 seconds
- Memory usage: < 500MB
- No performance degradation vs. previous version

**Validation:**
- [ ] Execution time acceptable
- [ ] Memory usage reasonable
- [ ] No memory leaks

---

## Post-Validation Sign-Off

### Final Checklist

#### Code Quality
- [ ] No new TypeScript errors (only pre-existing)
- [ ] All new methods have comments
- [ ] Error handling in place
- [ ] Type safety verified

#### Functionality
- [ ] RTMMetric interface extended correctly
- [ ] All 6 metrics calculated in engine
- [ ] Backtester receives and uses metrics
- [ ] FoR logic triggers correctly

#### Testing
- [ ] Validation script passes
- [ ] Backtester compiles and runs
- [ ] Diagnostic logging works
- [ ] No crashes or hanging

#### Documentation
- [ ] 4 documentation files created
- [ ] 5,000+ words of documentation
- [ ] Code examples provided
- [ ] Integration points documented

#### Hypotheses Ready
- [ ] All 5 hypotheses can be tested
- [ ] Expected outputs documented
- [ ] Backtests run successfully
- [ ] Metrics visible in logs

---

## Next Actions After Validation

### If All Checks Pass ✅
1. Run full hypothesis validation tests
2. Generate performance reports
3. Document any threshold adjustments needed
4. Plan paper trading validation

### If Issues Found ❌
1. Document issue details
2. Identify root cause
3. Make necessary fixes
4. Re-run relevant checks

---

## Sign-Off Template

```
Phase 7 RTM Force-Decay Implementation Validation

Date: _______________
Validator: _____________
Status: [ ] PASS [ ] FAIL

Checks Completed:
✓ Compilation ___________
✓ RTMMetric Interface ___________
✓ New Methods ___________
✓ calculateRTMMetric Updates ___________
✓ Backtester Integration ___________
✓ Diagnostic Logging ___________
✓ Documentation ___________
✓ Error Handling ___________
✓ Performance ___________

Issues Found: ___________

Next Steps: ___________

Sign-off: _____________
```

---

## Quick Reference: Command Cheat Sheet

```bash
# Validate structure
pnpm tsx test-rtm-force-decay.ts

# Run full backtest
pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01

# Run comparative test
pnpm tsx server/backtest/run-rtm-comparison.ts BTC USDT 2024-01-01

# Check for RTM triggers in output
grep "RTM FoR" output.log | head -10

# Count total RTM triggers
grep -c "RTM FoR" output.log

# Check Sharpe ratio
grep -i "sharpe" output.log

# Check deployment bars
grep "Convex ENTER" output.log | wc -l
```

---

**Total Estimated Validation Time:** 1–2 hours  
**Ready to Begin:** Yes ✅

When you're ready to validate, start with Step 1 above.

---

*Checklist created for Phase 7 validation session*
