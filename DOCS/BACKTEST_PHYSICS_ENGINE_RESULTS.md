## 🚀 Five-Layer Physics Engine Backtest Report

**Date**: December 22, 2025  
**Data Range**: June 25, 2025 - December 22, 2025 (180 days, 4,320 BTC/USDT 1-hour candles)  
**Test Agent**: VFMDPhysicsAgent with all 5 layers active  

---

## 📊 Overall Performance

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **Win Rate** | 40.00% (18/45 trades) | > 60% | ❌ FAIL |
| **Sharpe Ratio** | -0.538 | > 2.0 | ❌ FAIL |
| **Max Drawdown** | -0.70% | < -18% | ✅ PASS |
| **Profit Factor** | 0.93 | > 2.0 | ❌ FAIL |
| **Total PnL** | -$124.14 | Positive | ❌ FAIL |
| **Total Trades** | 45 | — | — |
| **Avg Trade Duration** | 4.4 candles | — | — |

### Key Findings:
- **Physics engine is currently net negative** with 40% win rate on 180-day test
- System is generating signals but not profitable ones
- Sharpe ratio is deeply negative (-0.538) indicating poor risk-adjusted returns
- Drawdown is minimal (0.7%) because system didn't stay in winning trades

---

## 🎯 Regime-Specific Performance

| Regime | Trades | Win Rate | Total PnL | Status |
|--------|--------|----------|-----------|--------|
| **CONSOLIDATION** | 40 | 40.0% | -$121.27 | ❌ LOSS |
| **DISTRIBUTION** | 5 | 40.0% | -$2.87 | ❌ LOSS |
| **LAMINAR_TREND** | 0 | — | — | No signals |
| **BREAKOUT_TRANSITION** | 0 | — | — | No signals |
| **ACCUMULATION** | 0 | — | — | No signals |
| **TURBULENT_CHOP** | 0 | Blocked | — | Filtered by Layer 1 |

### Signal Generation by Regime:
```json
{
  "CONSOLIDATION": 40,      // All 40 generated signals converted to trades
  "DISTRIBUTION": 5,         // All 5 generated signals converted to trades  
  "TURBULENT_CHOP": 0,       // Actively filtered out (Layer 1 STATE gate blocks)
  "LAMINAR_TREND": 0,        // Not occurring frequently enough in data
  "BREAKOUT_TRANSITION": 0,  // Not occurring or blocked by lower layers
  "ACCUMULATION": 0          // Not occurring or blocked by lower layers
}
```

### Analysis:
- System only trades in **CONSOLIDATION** (88.9%) and **DISTRIBUTION** (11.1%) regimes
- TURBULENT_CHOP regime is explicitly filtered out (Layer 1: STATE gate)
- Other regimes either not present in historical data or blocked by energy/permission thresholds
- **Consolidation regime performance is poor (40% win rate)** - suggests thresholds need tuning

---

## 🔧 Current Five-Layer Configuration

### **Layer 1: STATE (Regime Classification)**
- **Method**: RegimeClassifier analyzing flow patterns
- **Action on TURBULENT_CHOP**: Blocks all trades (returns HOLD)
- **Status**: ✅ Working as designed

### **Layer 2: ENERGY (PEG - Potential Energy Gradient)**
Current Thresholds by Regime:
```
LAMINAR_TREND:         PEG > 250
BREAKOUT_TRANSITION:   PEG > 240
ACCUMULATION:          PEG > 260
DISTRIBUTION:          PEG > 260
CONSOLIDATION:         PEG > 280
TURBULENT_CHOP:        PEG > 320 (not reached due to Layer 1 block)
```
- **Status**: ⚠️ Thresholds may be too low (letting weak signals through)

### **Layer 3: PERMISSION (TRIGGER - Constraint Failure)**
Current Thresholds by Regime:
```
LAMINAR_TREND:         TRIGGER > 0.30
BREAKOUT_TRANSITION:   TRIGGER > 0.25  ← Most permissive
ACCUMULATION:          TRIGGER > 0.40
DISTRIBUTION:          TRIGGER > 0.40
CONSOLIDATION:         TRIGGER > 0.45
TURBULENT_CHOP:        TRIGGER > 0.50
```
- **Status**: ⚠️ CONSOLIDATION threshold (0.45) may be too high relative to what data provides

### **Layer 4: DIRECTION (Directional Bias from ProfitEstimator)**
- **Status**: ✅ Included in signal generation
- **Issue**: Profit potential score (Layer 4 + 5) filtering may be removing good trades

### **Layer 5: PROFIT (Position Sizing & Kelly Criterion)**
- **Profit Potential Score Threshold**: Score must be > 65/100 to take trade
- **Status**: ⚠️ This threshold may be eliminating profitable opportunities

---

## ❌ Why System Is Underperforming

### Root Causes Identified:

1. **Consolidation Regime is Challenging**
   - 40 trades generated but only 40% win rate
   - Consolidation-specific thresholds may not match market data
   - System may be entering late in consolidation phase (after energy release)

2. **Profit Potential Score Filter May Be Too Strict**
   - Threshold: 65/100 is high
   - May be filtering out trades with acceptable risk/reward
   - Profit potential composite: 40% volatility prob + 25% direction conf + 20% move conf + 15% R:R

3. **Thresholds Not Optimized for This Data**
   - Regime-specific thresholds were theoretical, not validated on this 180-day window
   - PEG and TRIGGER thresholds need re-tuning for actual market conditions

4. **Five-Layer Gates Are Too Restrictive Together**
   - STATE gate blocks TURBULENT_CHOP (appropriate)
   - ENERGY gate (PEG threshold) blocks weak energy phases
   - PERMISSION gate (TRIGGER threshold) blocks weak constraint failures
   - DIRECTION + PROFIT gates filter further
   - **Net effect**: Only 45 trades in 4,320 candles (1% trade frequency)

---

## 🛠️ Next Steps to Fix

### Option 1: Re-optimize Regime Thresholds
```typescript
// Run threshold optimization on this specific data
pnpm exec tsx server/scripts/optimize-regime-thresholds.ts

// This will adjust PEG and TRIGGER values to maximize Sharpe ratio
// on historical data while maintaining > 60% win rate
```

### Option 2: Reduce Profit Potential Score Threshold
```typescript
// Current: Must be > 65/100
// Try: > 55/100 or > 50/100
// This allows more trades with acceptable (not perfect) profit potential
```

### Option 3: Lower Energy & Permission Thresholds
```typescript
// Current example (CONSOLIDATION):
// PEG > 280, TRIGGER > 0.45

// Try:
// PEG > 260, TRIGGER > 0.40
// More permissive = more trades = better stat estimation
```

### Option 4: Different Exit Strategy
```typescript
// Current: Exit on opposite signal or 5 candles max
// Try: Exit on profit target or stop loss (from Layer 5)
// Use signal.target and signal.stop from physics engine
```

### Option 5: Add Trade Filtering
```typescript
// Only take trades when:
// - Regime confidence > 75%
// - Volatility context is favorable (expand vs contract phase)
// - Recent win/loss ratio doesn't suggest drawdown period
```

---

## 📋 Backtest Configuration

| Setting | Value |
|---------|-------|
| Initial Capital | $100,000 |
| Max Position Size | 10% per trade |
| Slippage | 2 bps on entry |
| Commission | 1 bps per side (2 bps round trip) |
| Signal Confidence Threshold | > 0.30 (30%) |
| Trade Duration | Exit on opposite signal OR 5 candles |
| Data Points | 4,320 candles (180 days × 24 hours) |

---

## 💡 Key Insights

1. **System is too selective** - Only 45 trades in 4,320 candles is extremely low
2. **Consolidation regime needs work** - 40% win rate suggests bad timing
3. **Other regimes underutilized** - 0 trades in LAMINAR, BREAKOUT, ACCUMULATION
4. **Master equation validation needed** - PEG × TRIGGER may not be sufficient for profitability
5. **Signal generation is working** - System generates signals, but they're not profitable

---

## ✅ What's Working

- ✅ Five-layer architecture is implemented and active
- ✅ Regime classification (Layer 1) is working correctly
- ✅ Signal generation (all 5 layers) is producing output
- ✅ Skill influence integrated into confidence/sizing
- ✅ Volatility prediction exposed for weighting
- ✅ Constraint diagnostics available in reasoning
- ✅ Backtest framework is comprehensive and accurate

---

## 🎯 Recommendation

**The physics engine needs threshold optimization before live deployment.**

Recommended approach:
1. Run `optimize-regime-thresholds.ts` to find better PEG/TRIGGER values
2. Lower profit potential score threshold to generate more trades
3. Re-test with optimized parameters
4. If still < 60% win rate, consider:
   - Different exit logic (target-based not signal-based)
   - Regime-specific entry conditions (not just threshold-based)
   - Market regime context in sizing decisions

**Current Status**: ❌ **NOT READY FOR DEPLOYMENT** - Assertions not met
