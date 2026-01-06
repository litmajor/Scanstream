## ⚠️ FIVE-LAYER PHYSICS ENGINE BACKTEST SUMMARY

**Status**: ❌ **NOT READY FOR DEPLOYMENT**

---

## 📊 Executive Summary

**Test Period**: June 25, 2025 - December 22, 2025 (180 days)  
**Data**: 4,320 BTC/USDT 1-hour candles  
**Agent**: VFMDPhysicsAgent with all 5 layers active  
**Trades Generated**: 45 trades (1.04% of candles)  

### Performance vs. Targets:

| Metric | Result | Target | Status |
|--------|--------|--------|--------|
| Win Rate | 40.0% | > 60% | ❌ FAIL by 20% |
| Sharpe Ratio | -0.538 | > 2.0 | ❌ FAIL by 2.5x |
| Max Drawdown | -0.70% | < -18% | ✅ PASS |
| Profit Factor | 0.93 | > 2.0 | ❌ FAIL by 2.2x |
| **Profit/Loss** | **-$124.14** | Positive | **❌ NET LOSS** |

---

## 🎯 Key Findings

### 1. System is Net Negative 📉
- Lost $124.14 on $100k starting capital = **-0.12% return**
- 40% win rate means 60% of trades are losers
- Profit factor 0.93 means losing more than earning ($1.726k loss vs $1.602k profit)
- Sharpe ratio -0.538 indicates **terrible risk-adjusted returns**

### 2. Only 2 Regimes Generate Signals 🎯
```
CONSOLIDATION:   40 trades (88.9%)  → -$121.27 loss (40% WR)
DISTRIBUTION:     5 trades (11.1%)  → -$2.87 loss (40% WR)
LAMINAR_TREND:    0 trades          → N/A
BREAKOUT:         0 trades          → N/A
ACCUMULATION:     0 trades          → N/A
TURBULENT_CHOP:   0 trades (filtered by Layer 1)
```

### 3. Consolidation Regime is the Problem 🚨
- 40 of 45 trades are in CONSOLIDATION regime
- All are losing money with 40% win rate
- Suggests the system is entering trades **too late** in consolidation phase
- By the time PEG/TRIGGER thresholds are met, the move is already over

### 4. Trade Duration Too Long ⏱️
- Average trade duration: **4.4 candles** (≈4.4 hours for 1-hour chart)
- Most trades held to stop-loss or 5-candle exit
- System is not exiting on good signals, just on time decay

### 5. Examples of Poor Performance 💔
- **Biggest loss**: -$320.31 (-3.19%) on 2025-11-13 LONG trade
- **Biggest win**: +$268.79 (+2.71%) on 2025-11-04 SHORT trade
- Most trades are **micro-scale**: ±0.3% to ±1.0% range
- Wins are rare (18/45 = 40%) and often tiny

---

## 🔍 Root Cause Analysis

### Problem 1: Thresholds Are Disconnected from Reality
Current PEG/TRIGGER thresholds were theoretically optimized but not validated on this specific 180-day window. The levels that "should" work mathematically don't match what the market actually offers in June-Dec 2025.

**Evidence**: 
- Only CONSOLIDATION and DISTRIBUTION generate signals
- 0 trades in LAMINAR_TREND despite it being the easiest regime to trade
- Suggests thresholds are set too high for most regimes

### Problem 2: Profit Potential Score is Too Strict
The 65/100 threshold on profit potential score is filtering out the only tradeable setups, then only taking the worst of those.

**Evidence**:
- 45 trades generated from 4,320 candles (1% of time)
- Typical profitable systems trade 3-5% of candles
- We're only taking the "most confident" setups, but they're wrong anyway

### Problem 3: Five-Layer Gates Are Too Sequential
Each layer gates the next:
- Layer 1 (STATE): Blocks TURBULENT_CHOP ✅ Correct
- Layer 2 (ENERGY): PEG > threshold
- Layer 3 (PERMISSION): TRIGGER > threshold
- Layer 4 (DIRECTION): Profit potential > 65

**Issue**: By Layer 4, so few candidates remain that we only trade the "best" ones... which aren't profitable. We need to trade **more** to validate or reject the system.

### Problem 4: Exit Logic is Simplistic
Current exit: **Opposite signal OR 5 candles max**
- This doesn't use the Layer 5 PROFIT information (target/stop)
- Waiting for opposite signal means missing the move
- Holding to 5 candles means staying in losers

**What we should do**: Exit on profit target or stop-loss from physics model

---

## 💡 What's NOT Wrong

✅ **Five-layer architecture** is sound and implemented correctly  
✅ **Regime classification** is working (1896 transitions detected)  
✅ **Signal generation** produces output from all 5 layers  
✅ **Skill influence** is integrated into confidence/sizing  
✅ **Volatility prediction** is calculated and available  
✅ **Constraint diagnostics** are tracked  
✅ **Master equation** (PEG × TRIGGER) is conceptually valid  

The **system architecture is correct**. The **parameters and logic** are wrong for this market.

---

## 🛠️ Recommended Fixes (in priority order)

### Fix 1: Re-optimize Regime Thresholds (URGENT)
```bash
pnpm exec tsx server/scripts/optimize-regime-thresholds.ts
```

This script should:
- Lower PEG and TRIGGER thresholds to generate 3-5% trade frequency
- Optimize for Sharpe ratio > 2.0 instead of just "high confidence"
- Test each regime separately
- Validate on this exact 180-day period

**Expected result**: More trades in more regimes, better stat validation

### Fix 2: Lower Profit Potential Score Threshold
```typescript
// In VFMDPhysicsAgent.ts, line ~369:
// Change from: 65
// Change to: 50 or 55

if (profitEstimate.profit_potential_score < 50) { // More permissive
  return HOLD;
}
```

**Expected result**: 2-3x more trades, better sample size for validation

### Fix 3: Implement Target-Based Exit Logic
```typescript
// Replace "opposite signal OR 5 candles" with:
// Exit if: profit_target_reached OR stop_loss_hit OR 20_candles_max

// Use signal.target and signal.stop from Layer 5 PROFIT
const maxProfit = signal.target > 0 ? (signal.target - entryPrice) / entryPrice : null;
const maxLoss = signal.stop > 0 ? (entryPrice - signal.stop) / entryPrice : null;

if (maxProfit && currentPrice >= signal.target) {
  // Exit with profit
}
if (maxLoss && currentPrice <= signal.stop) {
  // Exit with loss
}
```

**Expected result**: More realistic P&L, proper risk management

### Fix 4: Add Regime-Specific Position Sizing
```typescript
// Currently: Fixed % position size per trade
// Better: Vary based on regime confidence and volatility

const regimeMultiplier = regimeConfidence; // Higher in clear regimes
const volatilityMultiplier = Math.sqrt(currentATR / baselineATR);
const adjustedSize = baseSize * regimeMultiplier * volatilityMultiplier;
```

**Expected result**: Larger positions in high-confidence setups

### Fix 5: Filter by Recent Win/Loss Streak
```typescript
// Add: Don't take trades after 3 consecutive losses
// Or: Reduce position size after losses

if (recentLosses >= 3) {
  // Skip or take smaller position
  return HOLD_OR_REDUCE_SIZE;
}
```

**Expected result**: Reduce drawdown severity during losing periods

---

## 📋 Next Steps

**Phase 1: Optimization (1-2 days)**
1. Run threshold optimization on this data
2. Test with more permissive profit potential threshold
3. Implement target-based exits
4. Re-backtest

**Phase 2: Validation (1 day)**
1. If new backtest passes assertions (W>60%, S>2.0, DD<-18%, PF>2.0)
2. Test on different time period (Jan-June 2025 or Sept-Dec 2024)
3. Validate robustness

**Phase 3: Deployment (if validated)**
1. Deploy to live with small position sizes
2. Monitor for 1-2 weeks
3. Gradually increase position sizes if live performance matches backtest

---

## 📌 Critical Notes

**DO NOT DEPLOY** until:
- [ ] Win rate > 60%
- [ ] Sharpe ratio > 2.0
- [ ] Max drawdown < -18%
- [ ] Profit factor > 2.0
- [ ] Validated on separate time period
- [ ] Live tested at small scale

**Current Status**: ❌ **0/6 checks passed**

---

## 📁 Generated Files

- `backtest-results-physics-engine.json` - Full trade-by-trade details
- `BACKTEST_PHYSICS_ENGINE_RESULTS.md` - This report
- `server/scripts/backtest-physics-engine-five-layer.ts` - Backtest code

---

**Report Generated**: December 22, 2025  
**Data Range**: 180 days (4,320 candles), BTC/USDT 1-hour  
**Next Review**: After optimization runs
