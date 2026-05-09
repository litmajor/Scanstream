# RTM Backtest Validation Plan

## 📋 Objective

Validate that the Physics-Based RTM Engine outperforms traditional 5% price stops by 8–20% Sharpe ratio on historical BTC/USDT and ETH/USDT data (2023–2025).

---

## 🎯 Hypotheses to Test

### H1: RTM Sharpe Improvement
**Null Hypothesis:** RTM Sharpe ≤ Baseline Sharpe  
**Alternative Hypothesis:** RTM Sharpe > Baseline Sharpe by 8–20%

**Validation:** 
- Run backtest on BTC/USDT and ETH/USDT
- Calculate Sharpe ratio for each strategy
- Measure improvement percentage
- Accept if: (RTM Sharpe / Baseline Sharpe - 1) ∈ [0.08, 0.25]

### H2: RTM Reduces Drawdown
**Null Hypothesis:** RTM Max Drawdown ≥ Baseline Max Drawdown  
**Alternative Hypothesis:** RTM Max Drawdown < Baseline by 10–30%

**Validation:**
- Measure max drawdown for each strategy
- Calculate reduction percentage
- Accept if: (Baseline DD - RTM DD) / Baseline DD ∈ [0.10, 0.30]

### H3: RTM Trigger Frequency
**Null Hypothesis:** RTM triggers < 10% of scouts  
**Alternative Hypothesis:** RTM triggers in 10–30% of scouts

**Validation:**
- Count RTM exits in backtest output
- Calculate ratio: RTM_exits / total_scouts
- Accept if: ratio ∈ [0.10, 0.30]

### H4: RTM False Positive Rate
**Null Hypothesis:** RTM false positive rate > 40%  
**Alternative Hypothesis:** RTM false positive rate < 30%

**Validation:**
- Count RTM exits that lose money
- Calculate: false_positives / total_RTM_exits
- Accept if: rate < 0.30

### H5: Regime Classification Accuracy
**Null Hypothesis:** Regime misclassification > 25%  
**Alternative Hypothesis:** Regime misclassification < 20%

**Validation:**
- Manually audit 50 sample bars
- Check coherence/turbulence classification vs. visual chart
- Calculate accuracy
- Accept if: accuracy > 0.80 (misclassification < 20%)

---

## 🔬 Experimental Design

### Setup

**Data:**
- BTC/USDT: 2023-01-01 to 2025-01-01 (1-minute OHLCV)
- ETH/USDT: 2023-01-01 to 2025-01-01 (1-minute OHLCV)
- Source: CCXT historical data via backtester

**Strategies:**
1. BASELINE_5PCT: Fixed 5% price stops (control)
2. RTM_ONLY: Physics-based RTM only (treatment A)
3. HYBRID_RTM_10PCT: RTM + 10% guard (treatment B)

**Parameters (Fixed Across All):**
- Starting equity: $10,000
- RISK_PER_TRADE: 3% per scout
- Scout target: 1.8–2.5x ATR (sweep varied)
- Scout stop: 0.7–1.4x ATR (sweep varied)
- Convex strategy: Disabled for this test (scout-only)

**Variations:**
- None (use same parameters for all three strategies)
- This isolates the exit mechanism impact

### Metrics to Collect

**Primary (Hypothesis-Driven):**
- [ ] Win Rate (%)
- [ ] Sharpe Ratio
- [ ] Max Drawdown (%)
- [ ] Final Equity ($)
- [ ] RTM Trigger Count
- [ ] RTM Win Rate (%)
- [ ] Regime Misclassification (%)

**Secondary (Diagnostic):**
- [ ] Total Trades
- [ ] Avg Holding Bars
- [ ] Avg Entry Confidence
- [ ] Avg RTM Signal Strength (when fired)
- [ ] Avg RTM Confidence (when fired)
- [ ] Total P&L ($)
- [ ] Profit Factor (gross profit / gross loss)
- [ ] Consecutive Losing Trades (max)
- [ ] Win Streak (max consecutive wins)

**Tertiary (Execution Quality):**
- [ ] Avg Slippage (expected exit price vs. actual)
- [ ] Whipsaw Rate (% of exits followed by reversal within 2 bars)
- [ ] Time to First RTM Exit (bar count before first RTM trigger)
- [ ] Regime Distribution (% TRENDING/NEUTRAL/CHOPPY bars)

---

## 📊 Data Collection & Analysis

### Step 1: Run Backtest
```bash
npx tsx server/backtest/run-rtm-comparison.ts
```

**Expected Output:**
- Console table with comparison
- CSV file: `backtest-results/rtm-comparison-results-YYYY-MM-DD.csv`

### Step 2: Parse Results

**CSV Columns (Validate Present):**
- Strategy ✓
- Symbol ✓
- WinRate ✓
- SharpeRatio ✓
- MaxDrawdown ✓
- TotalPnL ✓
- PnLPct ✓
- Trades ✓
- AvgHoldingBars ✓
- Runtime(ms) ✓

### Step 3: Hypothesis Testing

#### H1: Sharpe Improvement
```python
baseline_sharpe = [result for result in results if result['Strategy'] == 'BASELINE_5PCT']
rtm_sharpe = [result for result in results if result['Strategy'] == 'RTM_ONLY']

improvement = (mean(rtm_sharpe) / mean(baseline_sharpe) - 1) * 100

PASS if: 8 <= improvement <= 25
```

#### H2: Drawdown Reduction
```python
baseline_dd = [result['MaxDrawdown'] for result in results if result['Strategy'] == 'BASELINE_5PCT']
rtm_dd = [result['MaxDrawdown'] for result in results if result['Strategy'] == 'RTM_ONLY']

reduction = (mean(baseline_dd) - mean(rtm_dd)) / mean(baseline_dd) * 100

PASS if: 10 <= reduction <= 30
```

#### H3: Trigger Frequency
```
PASS if: 10% <= RTM_exits / total_scouts <= 30%
```

#### H4: False Positive Rate
```
false_positives = count(rtm_exit.pnl < 0)
total_rtm_exits = count(rtm_exit)
false_positive_rate = false_positives / total_rtm_exits

PASS if: false_positive_rate < 0.30
```

#### H5: Regime Accuracy
```
Sample 50 bars from the backtest
Manually verify regime classification (TRENDING/NEUTRAL/CHOPPY)
Compare with calculated coherence/turbulence
Calculate accuracy

PASS if: accuracy >= 0.80 (misclassification <= 20%)
```

### Step 4: Decision Matrix

| Hypothesis | Outcome | Action |
|-----------|---------|--------|
| H1: Sharpe +8–20% | PASS | Continue to H2 |
| H1: Sharpe <8% or >25% | FAIL | Iterate on weights |
| H2: DD reduce 10–30% | PASS | Continue to H3 |
| H2: DD not reduced | FAIL | Check trigger logic |
| H3: Trigger 10–30% | PASS | Continue to H4 |
| H3: Trigger <10% | WARNING | Increase sensitivity |
| H3: Trigger >30% | WARNING | Decrease sensitivity |
| H4: False pos <30% | PASS | Continue to H5 |
| H4: False pos >30% | FAIL | Strengthen pillars |
| H5: Accuracy >80% | PASS | Ready for paper trading |
| H5: Accuracy <80% | WARNING | Retrain regime classifier |

### Step 5: Generate Report

**Report Template:**

```
═════════════════════════════════════════════════════════════════════
           RTM Backtest Validation Report
═════════════════════════════════════════════════════════════════════

Test Date: [YYYY-MM-DD]
Data Period: 2023-01-01 to 2025-01-01
Symbols: BTC/USDT, ETH/USDT
Duration: [X hours]

─────────────────────────────────────────────────────────────────────
HYPOTHESIS VALIDATION RESULTS
─────────────────────────────────────────────────────────────────────

H1: RTM Sharpe Improvement (+8–20%)
   Status: [PASS / FAIL / WARNING]
   Result: RTM Sharpe = X.XX vs. Baseline = X.XX (+Y.Y%)
   Verdict: [Hypothesis accepted/rejected with confidence level]

H2: RTM Drawdown Reduction (10–30%)
   Status: [PASS / FAIL / WARNING]
   Result: RTM DD = X.X% vs. Baseline = X.X% (-Y.Y reduction)
   Verdict: [Hypothesis accepted/rejected]

H3: RTM Trigger Frequency (10–30%)
   Status: [PASS / FAIL / WARNING]
   Result: RTM exits = X (Y% of scouts)
   Verdict: [Hypothesis accepted/rejected]

H4: RTM False Positive Rate (<30%)
   Status: [PASS / FAIL / WARNING]
   Result: False positives = X (Z% of RTM exits)
   Verdict: [Hypothesis accepted/rejected]

H5: Regime Classification (>80% accuracy)
   Status: [PASS / FAIL / WARNING]
   Result: Regime accuracy = X.X%
   Verdict: [Hypothesis accepted/rejected]

─────────────────────────────────────────────────────────────────────
PERFORMANCE COMPARISON TABLE
─────────────────────────────────────────────────────────────────────

Strategy           │ Win Rate │ Sharpe │ Max DD │ Total P&L │ Trades
─────────────────────┼──────────┼────────┼────────┼───────────┼────────
BASELINE_5PCT      │  XX.X%   │ X.XX   │ X.X%   │ $X,XXX    │ XXX
RTM_ONLY           │  XX.X%   │ X.XX   │ X.X%   │ $X,XXX    │ XXX
HYBRID_RTM_10PCT   │  XX.X%   │ X.XX   │ X.X%   │ $X,XXX    │ XXX

─────────────────────────────────────────────────────────────────────
SECONDARY METRICS
─────────────────────────────────────────────────────────────────────

                    BASELINE        RTM_ONLY      HYBRID
Avg Holding Bars:   X.X bars        X.X bars      X.X bars
Profit Factor:      X.XX            X.XX          X.XX
Consecutive Wins:   X               X             X
Whipsaw Rate:       X.X%            X.X%          X.X%

─────────────────────────────────────────────────────────────────────
DECISION & NEXT STEPS
─────────────────────────────────────────────────────────────────────

Overall Result: [APPROVE FOR PAPER TRADING / ITERATE / REJECT]

Findings:
• [Key finding 1]
• [Key finding 2]
• [Key finding 3]

Recommendations:
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

Next Phase: [Paper Trading / Parameter Adjustment / Abort]

═════════════════════════════════════════════════════════════════════
```

---

## ✅ Pre-Backtest Checklist

- [ ] Code compiles without errors
- [ ] Data files exist (BTC/USDT, ETH/USDT CSV)
- [ ] Backtest script runs without crash
- [ ] RTM engine initializes correctly
- [ ] Scout exit logic triggers on test data
- [ ] CSV output generation confirmed
- [ ] Comparison table displays in console
- [ ] Metrics calculations verified

---

## 🚨 Failure Scenarios & Recovery

### Scenario 1: RTM Sharpe < Baseline (No Improvement)
**Likely Cause:** Pillars not aligned, or weights incorrect  
**Recovery:**
1. Check regime classification (print coherence/turbulence)
2. Verify pillar thresholds (increase trigger sensitivity)
3. Re-run with adjusted weights
4. If still fails: RTM may not work on this data; revert to baseline

### Scenario 2: RTM False Positive Rate > 40%
**Likely Cause:** Trigger conditions too loose  
**Recovery:**
1. Increase `MIN_REVERSION_QUALITY` threshold (0.60 → 0.70)
2. Increase `MIN_CURL_SCORE` threshold (0.65 → 0.75)
3. Increase `MIN_TURBULENCE_INDEX` threshold (1.7 → 2.0)
4. Re-run and re-evaluate

### Scenario 3: RTM Triggers < 5% (Too Few)
**Likely Cause:** Thresholds too strict  
**Recovery:**
1. Decrease trigger thresholds (lower all percentages by 5–10%)
2. Relax pillar AND logic to OR logic (any 3 of 4 pillars)
3. Re-run and re-evaluate

### Scenario 4: Backtest Crashes
**Likely Cause:** RTM calculation error or type mismatch  
**Recovery:**
1. Check error log for specific line
2. Verify MarketFrame type compatibility
3. Add null checks in RTM calculation
4. Rebuild and re-run

---

## 📈 Success Criteria (Final)

**APPROVE for Paper Trading if:**
- ✅ H1 PASS (Sharpe improvement 8–20%)
- ✅ H2 PASS (Drawdown reduction 10–30%)
- ✅ H3 PASS (Trigger frequency 10–30%)
- ✅ H4 PASS (False positive rate < 30%)
- ✅ H5 PASS (Regime accuracy > 80%)

**ITERATE if:**
- ⚠️ 3–4 hypotheses pass (adjust weights, re-test)

**ABORT if:**
- ❌ ≤2 hypotheses pass (RTM may not fit this strategy)

---

## 📞 Troubleshooting Contacts

- **RTM Engine Issues:** Check `server/services/physics-based-rtm-engine.ts` logic
- **Backtest Integration:** Check scout exit logic in `convexity-backtester-with-for.ts` (~644–704)
- **Data Issues:** Verify CSV format in `data/market-data-csv/`
- **Performance Issues:** Profile with `pnpm build --watch` and run single-symbol test

---

**Expected Runtime:** 2–5 minutes per backtest (3 strategies × 2 symbols)

**Ready to proceed?** Run:
```bash
npx tsx server/backtest/run-rtm-comparison.ts
```

---
