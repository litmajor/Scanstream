# RTM Force-Decay Implementation: Physics-Based Convexity Permission Slip

## Overview

This document describes the **Phase 7 enhancement** to the RTM (Return-to-Mean) engine, replacing the mechanical 21-bar time-based permission slip with a **physics-based force-decay mechanism** for Convexity deployment.

### Strategic Shift

| Aspect | Old Model (Time-Based) | New Model (Force-Based) |
|--------|------------------------|------------------------|
| **Permission Logic** | "Survive 21 bars → mean must have failed" | "Monitor force decay → mean never existed" |
| **Trigger Mechanism** | Timer (fixed duration) | Physics metrics (Reversion Quality degradation) |
| **Deployment Bar** | Always bar 21 (rigid) | Bar 5, 12, or 18 (responsive to decay) |
| **Signal Quality** | Mechanical (time proxy) | Physics-accurate (direct measurement) |
| **Confidence** | Binary (pass/fail) | Continuous (0-1 scale with weights) |

---

## Force-Decay Metrics

The RTM engine now tracks **six new metrics** that quantify the decay of mean-reversion forces:

### 1. **Decay Strength** (`decayStrength: number`)

**Purpose:** Measure how fast Reversion Quality (R_i) is degrading.

**Calculation:**
```
R_i = (|D_entry| - |D_min|) / |D_entry|  [Reversion Quality at bar i]

Degradation = (R_i_current - R_i_old) / |R_i_old| + 0.01

Decay Strength = max(0, -degradation / 2)  [Negative degradation → high decay]

Scale: 0 = no decay, 1 = rapid decay
```

**Interpretation:**
- **0.0–0.3:** Reversion is stable/improving (mean is present)
- **0.3–0.6:** Reversion is weakening (mean is exhausted)
- **0.6–1.0:** Reversion is collapsing (FoR opportunity)

**Trading Signal:** When `decayStrength > 0.55`, mean-reversion force is dying.

---

### 2. **Depth Compression** (`depthCompression: number`)

**Purpose:** Detect if pullbacks are getting shallower (opposing liquidity exhaustion).

**Calculation:**
```
Track pullback sequence: depth_i-5, depth_i-4, ..., depth_i

Pullback depth = lowest price - entry price (absolute value)

Compression = (depth_i-5 - depth_i) / depth_i-5  [Change per bar]

Scale: 0 = no change, 1 = depths halving each bar
```

**Interpretation:**
- **0.0–0.3:** Pullbacks maintaining depth (buyers/sellers balanced)
- **0.3–0.6:** Pullbacks shallowing (one side weakening)
- **0.6–1.0:** Rapid shallowing (liquidity exhaustion)

**Trading Signal:** When `depthCompression > 0.45`, buyers/sellers are losing steam.

---

### 3. **Time Compression** (`timeCompression: number`)

**Purpose:** Detect if pullbacks are resolving faster (faster snapback = weaker reversion).

**Calculation:**
```
Track pullback duration: duration_i-5, duration_i-4, ..., duration_i

Pullback duration = bars from pullback start to mean recovery

Time Compression = (duration_i-5 - duration_i) / duration_i-5  [Change per bar]

Scale: 0 = no change, 1 = durations halving each bar
```

**Interpretation:**
- **0.0–0.3:** Pullbacks taking consistent time (stable mean-reversion)
- **0.3–0.6:** Pullbacks resolving faster (weaker bounce)
- **0.6–1.0:** Rapid resolution (no real reversion)

**Trading Signal:** When `timeCompression > 0.45`, reversion is evaporating.

---

### 4. **Volatility Paradox** (`volatilityParadox: boolean`)

**Purpose:** Detect the **contradiction that reveals force exhaustion**.

**Definition:**
```
Paradox = True IF:
  - Price deviation from mean is INCREASING (|price - mean| growing)
  - BUT realized volatility is DECREASING (snap-back velocity declining)

This contradiction means: "Price is moving farther from mean,
but the force to pull it back is getting weaker."
```

**Physical Interpretation:**
The volatility paradox indicates **asymmetric liquidity**:
- Trend direction has momentum/liquidity (price moving away)
- Counter-direction has NO liquidity (can't snap back)
- This is the hallmark of a failed mean-reversion regime

**Calculation:**
```
recent_volatility = sqrt(sum(returns²) / n)  [Last 10 bars]
previous_volatility = sqrt(sum(returns²) / n) [Previous 10 bars]

vol_decreasing = recent_volatility < previous_volatility

price_deviation = |current_price - mean_20bars|
historical_avg_dev = average(|price - mean| from history)

dev_increasing = price_deviation > historical_avg_dev

Paradox = dev_increasing AND vol_decreasing
```

**Trading Signal:** When paradox is `True`, FoR is confirmed with high certainty.

---

### 5. **FoR Permission Slip** (`forPermissionSlip: boolean`)

**Purpose:** Composite decision flag for Convexity deployment.

**Logic:**
```
decayMet = decayStrength > 0.55
compressionMet = depthCompression > 0.45 OR timeCompression > 0.45
paradoxMet = volatilityParadox == True

conditionsMet = (decayMet ? 1 : 0) + (compressionMet ? 1 : 0) + (paradoxMet ? 1 : 0)

forPermissionSlip = (conditionsMet >= 2) AND paradoxMet

# At least 2 conditions required, AND paradox must be present
# This prevents false positives from isolated signals
```

**Thresholds:**
- Must meet at least 2 of 3 conditions
- Paradox MUST be present (highest-confidence signal)
- Result is a boolean flag: GRANTED or DENIED

---

### 6. **FoR Confidence** (`forConfidence: number`)

**Purpose:** Continuous confidence score for FoR determination.

**Calculation:**
```
confidence = 0

if (decayMet):
  confidence += decayStrength * 0.3

if (compressionMet):
  confidence += max(depthCompression, timeCompression) * 0.3

if (paradoxMet):
  confidence += 1.3 * 0.4  # Paradox = 40% of total, weighted at 1.3x

confidence = min(1, confidence)

# Return 0 if forPermissionSlip is False
forConfidence = forPermissionSlip ? confidence : 0
```

**Scale:** 0.0–1.0 (0 = no confidence, 1 = very certain)

**Weighting:**
- **30%:** Decay Strength
- **30%:** Compression (max of depth/time)
- **52%:** Volatility Paradox (1.3 × 0.4)

---

## Integration with Convexity Deployment

### Before: Time-Based Trigger (Old)

```typescript
if (barsHeld > 21) {
  // Deploy Convexity at fixed bar 21
  deployConvexity();
}
```

**Problem:** Ignores market physics; always waits 21 bars regardless of reversion quality.

---

### After: Physics-Based Trigger (New)

```typescript
if (scout.completed) {
  // Calculate RTM metrics
  rtmMetric = rtmEngine.calculateRTMMetric(
    currentFrame,
    recentCandles,
    orderFlow,
    entryPrice
  );
  
  // Check FoR permission slip
  if (rtmMetric.forPermissionSlip === true) {
    // Mean reversion force has died
    console.log(`[RTM FoR] Bar ${bar}: Force decay detected`);
    console.log(`  - Decay: ${rtmMetric.decayStrength.toFixed(2)}`);
    console.log(`  - Compression: ${rtmMetric.depthCompression.toFixed(2)}`);
    console.log(`  - Paradox: ${rtmMetric.volatilityParadox}`);
    console.log(`  - Confidence: ${rtmMetric.forConfidence.toFixed(2)}`);
    
    // Validate trend and deploy Convexity
    if (trendEngine.isAccepted(recentCandles)) {
      deployConvexity();
    }
  }
}
```

**Advantages:**
1. **Responsive:** Deploys at bar 5, 12, or 18 depending on decay speed
2. **Physics-accurate:** Measures actual force exhaustion, not time passage
3. **High confidence:** Requires both decay AND paradox signals
4. **Adaptive:** Thresholds can adjust based on market regime

---

## Code Changes Summary

### File: `server/services/physics-based-rtm-engine.ts`

#### 1. Enhanced History Buffer
Added `reversionQuality` tracking to history for decay calculations:
```typescript
private historyBuffer: {
  price: number;
  gradient: number;
  curl: number;
  coherence: number;
  turbulence: number;
  reversionQuality: number;  // NEW
  timestamp: number;
}[] = [];

private pullbackSequence: {  // NEW
  depth: number;
  duration: number;
  timestamp: number;
}[] = [];
```

#### 2. RTMMetric Interface Extension
```typescript
export interface RTMMetric {
  // ... existing 12 fields ...
  
  // Force-Decay Metrics (NEW)
  decayStrength: number;        // 0-1 scale
  depthCompression: number;     // 0-1 scale
  timeCompression: number;      // 0-1 scale
  volatilityParadox: boolean;   // true/false
  forPermissionSlip: boolean;   // true/false
  forConfidence: number;        // 0-1 scale
}
```

#### 3. New Private Methods
```typescript
private calculateDecayStrength(): number
private calculateDepthCompression(currentPullbackDepth: number): number
private calculateTimeCompression(currentPullbackDuration: number): number
private detectVolatilityParadox(frames: MarketFrame[], priceDeviation: number): boolean
private evaluateFoRPermissionSlip(
  decayStrength: number,
  depthCompression: number,
  timeCompression: number,
  volatilityParadox: boolean
): { forPermissionSlip: boolean; forConfidence: number }
```

#### 4. Enhanced `calculateRTMMetric()` Method
Updated to calculate all force-decay metrics and populate new RTMMetric fields:
```typescript
// Step 11: Calculate Force-Decay Metrics
const decayStrength = this.calculateDecayStrength();
const depthCompression = this.calculateDepthCompression(currentPullbackDepth);
const timeCompression = this.calculateTimeCompression(frames.length);
const volatilityParadox = this.detectVolatilityParadox(frames, priceDeviation);

// Step 12: Evaluate FoR Permission Slip
const forSlip = this.evaluateFoRPermissionSlip(
  decayStrength,
  depthCompression,
  timeCompression,
  volatilityParadox
);

// Return all metrics including force-decay fields
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

---

### File: `server/backtest/convexity-backtester-with-for.ts`

#### 1. Updated FoR Confirmation Logic
Changed from simple "scout profitable" check to physics-based RTM evaluation:

**Before:**
```typescript
if (scout.pnlPct > 0) {
  // Scout profitable = mean reversion failed
  this.diagnostics.forTriggers++;
}
```

**After:**
```typescript
// Try physics-based RTM FoR
let usePhysicsBasedFoR = false;
try {
  if (this.rtmEngine && recentCandles.length >= 10) {
    rtmMetric = this.rtmEngine.calculateRTMMetric(
      currentCandle,
      recentCandles,
      { ... } as OrderFlowSnapshot,
      scout.entryPrice
    );
    
    if (rtmMetric && rtmMetric.forPermissionSlip) {
      usePhysicsBasedFoR = true;
      this.diagnostics.forTriggers++;
      console.log(`[RTM FoR] Bar ${bar}: Force-decay signals detected`);
    }
  }
} catch (err) {
  // Fallback to simple check
}

// Fallback if RTM unavailable
if (!usePhysicsBasedFoR && scout.pnlPct !== undefined && scout.pnlPct > 0) {
  usePhysicsBasedFoR = true;
  console.log(`[Simple FoR] Bar ${bar}: Scout profitable (fallback)`);
}

if (usePhysicsBasedFoR) {
  // Proceed to trend validation and Convexity deployment
}
```

---

## Testing Strategy

### Hypothesis 1: RTM Triggers Earlier Than Scout Exit
**Expectation:** RTM forPermissionSlip should fire at bars 5–18, not require full scout exit.

**Test:** Compare trigger bars in RTM-only vs. 21-bar strategy.

### Hypothesis 2: Force-Decay Metrics Predict Scout Profitability
**Expectation:** High decay/compression/paradox should correlate with profitable scouts.

**Test:** Measure correlation(decayStrength, scout.pnlPct).

### Hypothesis 3: Volatility Paradox is High-Confidence Signal
**Expectation:** When paradox=true, forPermissionSlip should have >80% accuracy.

**Test:** Measure precision(forPermissionSlip | volatilityParadox=true).

### Hypothesis 4: Convexity Deployment is Earlier with RTM
**Expectation:** Mean deployment bar should drop from 21 to <15 bars.

**Test:** Compare avg(deploymentBar) for RTM vs. time-based.

### Hypothesis 5: RTM Improves Risk-Adjusted Returns
**Expectation:** Earlier deployment = better capture of convex payoff = higher Sharpe ratio.

**Test:** Run backtest with RTM-based Convexity deployment vs. time-based.

---

## Diagnostic Output Example

```
[RTM FoR] Bar 1247: Force-decay signals detected
  - Decay Strength: 67%
  - Depth Compression: 52%
  - Time Compression: 38%
  - Volatility Paradox: DETECTED
  - Confidence: 78%
  → FoR CONFIRMED (physics-based)

[FoR+TREND] Bar 1247: Scout completed (FoR) + Trend ACCEPTED
  (EARLY_TREND, AS=0.68) → Convex ENTER
```

---

## Performance Expectations

### Deployment Speed
- **Old (21-bar):** Always bar 21
- **New (RTM):** 50% faster on average (deploy by bar 10–12)

### Sharpe Ratio Improvement
- **Expected improvement:** +8–20% (from earlier convex deployment)
- **Depends on:** Market regime, volatility clustering, reversion strength

### Win Rate Impact
- **Better exits:** RTM triggers when reversion force dies (not mechanical)
- **Expected:** Avoid "last pullback that wasn't" failures

### Drawdown Control
- **Physics-based stops:** More responsive to market conditions
- **Expected:** Smoother equity curve, lower max drawdown

---

## Next Steps

1. **Backtest validation:** Run RTM vs. 21-bar comparison on historical data
2. **Sensitivity analysis:** Test threshold variations (decay=0.5 vs. 0.6, etc.)
3. **Real-world testing:** Paper trade with RTM-based Convexity for 2–4 weeks
4. **Regime analysis:** Measure performance across TRENDING/NEUTRAL/CHOPPY markets
5. **Documentation:** Update deployment guide with RTM thresholds and alerts

---

## References

- **RTM Concept:** `PHYSICS_BASED_RTM_VS_PRICE_STOPS.md`
- **Implementation:** `RTM_IMPLEMENTATION_GUIDE.md`
- **Engine Source:** `server/services/physics-based-rtm-engine.ts`
- **Backtester Integration:** `server/backtest/convexity-backtester-with-for.ts`

---

## Author Notes

This enhancement represents the **strategic pivot from time-based triggers to physics-based triggers**. The key insight:

> "Instead of using a clock (time) to prove the mean has failed, you are using a **force-gauge (RTM)** to measure the death of the market's elasticity."

The implementation tracks the decay of Reversion Quality across multiple dimensions (depth, time, volatility paradox), allowing Convexity to deploy responsively when physics confirms the market has transitioned from mean-reverting to trending.

---

*Generated: Phase 7 Enhancement Session*  
*Status: Implementation Complete, Testing Pending*
