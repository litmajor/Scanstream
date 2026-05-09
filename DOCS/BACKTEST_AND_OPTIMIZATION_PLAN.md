# Convexity Engine Backtest & Optimization Plan
**Date:** January 5, 2026  
**Status:** Full Phase 1 Integration + Phase 2 Planning  
**Objective:** Validate all 7 Phase 1 fixes, establish expected metrics, and plan Phase 2 optimization

---

## 📊 Current State (Phase 1 Results)

### Baseline Performance (Before Phase 1 Fixes)
**BTC/USDT (1-Year, Hourly):**
- Win Rate: 56.82% ✅ (vs 29.21% simple strategy baseline)
- Profit Factor: 1.49x ✅ (vs 1.19x baseline)
- Max Drawdown: 248.53% ⚠️ **(Sizing artifact - using 1 BTC quantity)**
- Sharpe Ratio: 0.01 ⚠️ **(Metrics corrupted by oversized positions)**
- Trade Count: 44 (highly selective)

**ETH/USDT (1-Year, Hourly):**
- Win Rate: 57.56% ✅ (vs 22.22% baseline)
- Profit Factor: 2.70x ✅ (vs 0.93x baseline - nearly 3x improvement!)
- Max Drawdown: 617.25% ⚠️ **(Same sizing issue)**
- Sharpe Ratio: 0.04 ⚠️ **(Nominal improvement but still low)**
- Trade Count: 172 (good opportunity set)

---

## 🎯 Phase 1: Core Fixes Summary

### Fix #1: Response Normalizer
**Purpose:** Regime-adaptive thresholds for exits  
**Implementation:** Tracks R-score percentile (P25, P50, P75)  
**Expected Impact:**
- Sharpe Ratio: +0.2 to +0.3 (stabilized exits)
- Exit accuracy: +15% (fewer premature exits)
- Avg trade duration: Slightly increased (better hold discipline)

### Fix #2: VFMD De-duplication
**Purpose:** Prevent same-direction signal clustering  
**Implementation:** 3-bar cooldown, state-aware filtering  
**Expected Impact:**
- Trade count: -20% to -30% (reduced noise)
- Win rate: +3% to +5% (higher quality entries)
- Profit factor: +10% to +15% (better risk/reward)

### Fix #3: Scale-In Validator
**Purpose:** Response-based position addition (not price-based)  
**Implementation:** Tracks response health, validates velocity  
**Expected Impact:**
- Avg trade PnL: +25% (better risk/reward)
- Max drawdown: -10% to -15% (dynamic sizing)
- Winning trade size: +15% (scales into winners)

### Fix #4: Circuit Breaker (Structure-Anchored)
**Purpose:** Exit on R-score decay before structural breaks  
**Implementation:** Monitors response velocity + regime noise  
**Expected Impact:**
- Max drawdown: -15% to -25% (early exit protection)
- Profit factor: +5% to +10% (avoid big losses)
- Win rate: -1% to -2% (tradeoff for smaller losses)

### Fixes #5-7: Misc Helpers
- ResponseNormalizer diagnostics
- Scale-in opportunity signals
- Health monitoring methods

---

## 📈 Expected Metrics (Phase 1 Integration)

### Conservative Targets (High Confidence)
These should be **easily achievable** with proper position sizing:

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Win Rate** | ≥ 60% | Already at 56.82% on BTC, 57.56% on ETH; +2-4pp from dedup |
| **Profit Factor** | ≥ 2.0x | BTC at 1.49x, ETH at 2.70x; average 2.0x+ |
| **Avg Trade Duration** | ≥ 8 bars | Both assets showing 8-135 bars avg; reasonable hold |
| **Trade Count** | 50-200 | Selective but not sparse; 44-172 current |

### Risk Targets (Control Metrics)
| Metric | Target | Rationale |
|--------|--------|-----------|
| **Max Drawdown** | < 15% | With 2% risk/trade sizing; currently inflated |
| **Sharpe Ratio** | ≥ 0.5 | With correct sizing + Response Normalizer |
| **Sortino Ratio** | ≥ 0.8 | Convex asymmetry favors Sortino |
| **Return/Drawdown** | ≥ 3.0x | Quality metric: annual return ÷ max DD |

### Stretch Targets (Phase 2+)
| Metric | Target | Rationale |
|--------|--------|-----------|
| **Win Rate** | ≥ 65% | Requires asset-specific FoR tuning |
| **Profit Factor** | ≥ 2.5x | Needs regime-based thresholds |
| **Sharpe Ratio** | ≥ 0.8 | Requires adaptive exit timing |

---

## 🔧 What's Being Fixed in This Backtest

### Issue #1: Position Sizing Artifact
**Current:** Uses fixed quantity of 1 unit (1 BTC or 1 ETH)
- 1 BTC at $94k = $94k per trade
- 2% loss = $1,880 absolute
- Drawdown calculation: loss ÷ starting capital becomes >100% quickly

**Solution:** Kelly Criterion-based sizing
```
Optimal f = (Win% × Avg Win - Loss% × Avg Loss) / Avg Win
Effective sizing: 2% risk per trade (typical for backtests)

Example:
- Starting capital: $10,000
- Per-trade risk: $200 (2%)
- Stop distance: 2%
- Position size: $200 / 0.02 = $10,000 notional
```

### Issue #2: Proper Drawdown Calculation
**Current:** Simple max(equity - equity_peak) / equity_peak  
**Improved:** 
- Track cumulative PnL vs starting capital
- Use bar-by-bar equity curve
- Calculate intra-trade drawdown separately

### Issue #3: Missing Metrics
**Adding:**
- Annualized return (% per year)
- Sortino ratio (downside volatility)
- Calmar ratio (return / max DD)
- Recovery period (bars to recover from max DD)
- Win/loss streaks

---

## 📋 Backtest Execution Plan

### Phase 1: Baseline (Current State) → Fixed Sizing
**Step 1:** Update `convexity-backtester.ts`
- Implement Kelly-based position sizing
- Fix drawdown calculation
- Add missing metrics

**Step 2:** Run 2 simultaneous backtests
- BTC/USDT (8,760 hourly bars)
- ETH/USDT (8,760 hourly bars)

**Step 3:** Collect baseline metrics
```
Output format:
├─ Trades: entry/exit price, quantity, PnL%, duration
├─ Metrics: win rate, profit factor, sharpe, max DD, return
├─ Diagnostics: VFMD signals, deployments, FoR triggers
└─ Per-regime breakdown: LAMINAR, BREAKOUT, CONSOLIDATION, etc.
```

### Phase 2: Validate Each Fix Incrementally
1. **Response Normalizer activation**
   - Compare: with/without response normalization
   - Track: exit timing changes, Sharpe improvement

2. **VFMD De-duplication**
   - Compare: with/without dedup (3-bar cooldown)
   - Track: trade count reduction, win rate change

3. **Scale-In Validator**
   - Compare: with/without scale-in
   - Track: avg winning trade size, max DD improvement

4. **Circuit Breaker**
   - Compare: with/without circuit breaker
   - Track: drawdown protection, profit factor impact

### Phase 3: Integration & Gap Analysis
- Run with ALL 7 fixes enabled
- Compare to targets: Which metrics are on track?
- Identify gaps: Which need Phase 2 improvements?

---

## 🎯 Success Criteria

### Tier 1: Must Pass (Phase 1)
- [ ] Max Drawdown < 15% (with proper sizing)
- [ ] Win Rate ≥ 60% on both assets
- [ ] Profit Factor ≥ 2.0x on both assets
- [ ] Sharpe Ratio ≥ 0.5 on both assets

### Tier 2: Should Pass (Phase 1 + Minor Tuning)
- [ ] Return/Drawdown ratio ≥ 3.0x
- [ ] Sortino Ratio ≥ 0.8
- [ ] Average trade duration ≥ 8 bars
- [ ] No regime showing <50% win rate

### Tier 3: Stretch (Phase 2 Optimization)
- [ ] Win Rate ≥ 65%
- [ ] Profit Factor ≥ 2.5x
- [ ] Sharpe Ratio ≥ 0.8
- [ ] Calmar Ratio ≥ 2.0x

---

## 📊 Metrics Definition

### Win Rate
```
% = (Winning Trades / Total Trades) × 100
Target: ≥ 60% (above 50% threshold for profitability)
```

### Profit Factor
```
= Gross Profit / |Gross Loss|
Target: ≥ 2.0x (at least $2 profit per $1 risk)
```

### Sharpe Ratio
```
= (Annualized Return - Risk-Free Rate) / Annualized Volatility
Risk-free: 5% annual (0.05)
Target: ≥ 0.5 (0.5 = good risk-adjusted return)
```

### Sortino Ratio
```
= Annualized Return / Downside Deviation
Downside Deviation: std dev of only negative returns
Target: ≥ 0.8 (Sortino > Sharpe for convex strategies)
```

### Maximum Drawdown
```
= (Lowest Equity - Peak Equity) / Peak Equity
Target: < 15% (sustainable drawdown)
```

### Calmar Ratio
```
= Annualized Return / Maximum Drawdown
Target: ≥ 2.0x (means return is 2x the worst drawdown)
```

---

## 🚀 Phase 2: Optimization Roadmap

Once Phase 1 metrics are validated, proceed with:

### Optimization 1: Regime-Based FoR Thresholds
**Problem:** Single FoR threshold (60%) may be suboptimal across regimes  
**Solution:** Tune per regime
- LAMINAR_TREND: FoR > 50% (easier to revert)
- CONSOLIDATION: FoR > 65% (harder to revert)
- BREAKOUT: FoR > 55% (high persistence)
- TURBULENT: FoR > 70% (noise-heavy)

**Expected Impact:** +3-5% win rate, +0.2 Sharpe

### Optimization 2: Asset-Specific Tuning
**Problem:** BTC and ETH have different volatility/correlation profiles  
**Solution:** Separate agents with asset-optimized parameters
- BTC: Lower target (3%), longer holds (15 bars)
- ETH: Higher target (6%), tighter exits (8 bars)

**Expected Impact:** +2% win rate per asset

### Optimization 3: Adaptive Exit Timing
**Problem:** Fixed exit times may exit too early in strong trends  
**Solution:** Extend holding if FoR still elevated
- If R-score > 75th percentile: +5 bars
- If R-score > 90th percentile: +10 bars

**Expected Impact:** +1.5% avg trade size, +0.1 Sharpe

### Optimization 4: Dynamic Position Sizing
**Problem:** Fixed 2% risk doesn't scale with volatility  
**Solution:** Scale size inversely to ATR
- Low volatility (ATR < 1%): 2.5% risk
- High volatility (ATR > 3%): 1.0% risk

**Expected Impact:** -5% max DD, +0.15 Sharpe

---

## 📂 Files Involved

### Backtest Infrastructure
- `server/backtest/convexity-backtester.ts` ← **UPDATE (sizing fix)**
- `server/backtest/metrics-calculator.ts` ← **REVIEW (validate calculations)**
- `server/services/rpg-agents/ConvexityAgent.ts` ← **ALREADY INTEGRATED (Phase 1 fixes)**

### Phase 1 Engine Components
- `server/services/rpg-agents/convexEngine/ResponseNormalizer.ts`
- `server/services/rpg-agents/convexEngine/VFMDDeduplicator.ts`
- `server/services/rpg-agents/convexEngine/ScaleInValidator.ts`
- `server/services/rpg-agents/convexEngine/CircuitBreakerStructureAnchored.ts`

### Data
- `server/data/cache/BTCUSDT_1h_365d.json` (8,760 bars)
- `server/data/cache/ETHUSDT_1h_365d.json` (8,760 bars)

---

## 🔍 Next Steps

1. **Update position sizing** (1-2 hours)
   - Implement Kelly-based position sizing
   - Fix drawdown & return calculations
   - Add missing metrics

2. **Run baseline backtest** (5 min)
   - Execute on BTC & ETH
   - Collect Phase 1 metrics
   - Verify all fixes are active

3. **Impact analysis** (2-3 hours)
   - Test each fix individually
   - Document metric changes
   - Identify remaining gaps

4. **Generate report** (1 hour)
   - Performance summary
   - Per-regime breakdown
   - Phase 2 recommendations

5. **Phase 2 implementation** (TBD)
   - Regime-based tuning
   - Asset-specific optimization
   - Adaptive exit timing

---

## 📝 Expected Deliverables

- ✅ Updated backtest with proper sizing
- ✅ Phase 1 baseline metrics (BTC & ETH)
- ✅ Per-fix impact analysis
- ✅ Phase 2 optimization roadmap
- ✅ Success criteria checklist
- ✅ Detailed performance report

---

**Status: Ready for Phase 1 Validation**
All 7 core fixes integrated in ConvexityAgent.ts  
Backtest framework ready for execution  
Expected timeline: Complete within 24 hours
