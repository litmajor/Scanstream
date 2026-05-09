# Scout Timeout Fix - Implementation Guide

## 📋 Test Plan

These experiments can be run quickly to identify the best solution for timeout problem.

---

## Experiment 1: Reduce Timeout Window (QUICK WIN)

### Change Required
File: `convexity-backtester-with-for.ts`  
Location: Scout timeout check (around line 880)

**Current Code:**
```typescript
// PRIORITY 5: TIMEOUT (bar 5+ with no confirmation)
if (scout.exitBar === undefined && barsHeld >= 5) {
  scout.exitBar = bar;
  scout.exitPrice = currentPrice;
  scout.exitReason = 'TIMEOUT';
  // ... exit scout
}
```

**Test 1a: Timeout at Bar 4**
```typescript
if (scout.exitBar === undefined && barsHeld >= 4) {  // Changed from >= 5
```

**Test 1b: Timeout at Bar 3**
```typescript
if (scout.exitBar === undefined && barsHeld >= 3) {  // Changed from >= 5
```

### Expected Results
| Test | Current | Expected |
|------|---------|----------|
| Baseline | 9.7% win, -1.70% P&L, 219 timeouts | Baseline |
| Bar 4 Timeout | ??? | ~15% win, -0.5% P&L, 150 timeouts |
| Bar 3 Timeout | ??? | ~20% win, +0.5% P&L, 100 timeouts |

### Command to Test
```bash
TIMEOUT_BAR=4 pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01
```

---

## Experiment 2: Add Entry Turbulence Filter

### Why
Scouts entering during low volatility (end of momentum, start of consolidation) become unprofitable by bar 5.  
We need to filter entries to only high-turbulence (active momentum) periods.

### Change Required
File: `convexity-backtester-with-for.ts`  
Location: Scout entry generation (around line 580)

**Add Turbulence Check:**
```typescript
// NEW: Filter entries by turbulence
const windowPrices = ticks.map(t => t.close);
const field = this.fieldConstructor.constructField(windowPrices);
const metrics = PhysicsCalculator.computeAllMetrics(field);
const turbulence = metrics.turbulenceIndex || 0;

const MIN_TURBULENCE = 2.5;  // Threshold for high volatility

if (turbulence < MIN_TURBULENCE) {
  // Skip entry - momentum not active enough
  console.log(`[ENTRY SKIP] Bar ${bar}: TI=${turbulence.toFixed(2)} < ${MIN_TURBULENCE} - momentum too weak`);
  continue;
}

// Existing scout entry code
```

### Test Values
- **Test 2a:** MIN_TURBULENCE = 2.0 (loose)
- **Test 2b:** MIN_TURBULENCE = 2.5 (medium)
- **Test 2c:** MIN_TURBULENCE = 3.0 (strict)

### Expected Results
| Test | Scouts Generated | Avg TI at Entry | Expected Win % |
|------|------------------|---|---|
| Baseline | 431 | ~2.1 | 9.7% |
| TI > 2.0 | ~350 | ~2.4 | 12% |
| TI > 2.5 | ~250 | ~2.8 | 15% |
| TI > 3.0 | ~150 | ~3.2 | 18% |

---

## Experiment 3: Increase TARGET Distance

### Why
Scouts with longer profitability window might hit higher targets before timeout at bar 5.

### Change Required
File: `convexity-backtester-with-for.ts`  
Location: Scout target calculation (around line 330)

**Current Code:**
```typescript
scout.target = scout.direction === 'BUY'
  ? scout.entryPrice + atr * 2.0  // 2x ATR target
  : scout.entryPrice - atr * 2.0;
```

**Test 3a: 2.5x ATR**
```typescript
scout.target = scout.direction === 'BUY'
  ? scout.entryPrice + atr * 2.5  // Changed from 2.0
  : scout.entryPrice - atr * 2.5;
```

**Test 3b: 3x ATR**
```typescript
scout.target = scout.direction === 'BUY'
  ? scout.entryPrice + atr * 3.0  // Changed from 2.0
  : scout.entryPrice - atr * 3.0;
```

### Expected Results
| Test | TARGET Hit Rate | Avg Bars to Hit | Win Rate Impact |
|------|---|---|---|
| Baseline (2x) | 9.7% | 2.3 bars | 9.7% |
| 2.5x ATR | 7% | 3.1 bars | +1-2% |
| 3x ATR | 5% | 3.5 bars | +0-1% |

**Note:** Higher target = fewer hits, but longer survival might offset this

---

## Experiment 4: Early Exit on Mean Reversion Signal

### Why
Instead of timeout at bar 5, exit immediately when coherence (order) collapses.

### Change Required
Add coherence check BEFORE timeout:

```typescript
// NEW: Exit on mean reversion signal (coherence collapse)
if (scout.exitBar === undefined && barsHeld >= 2) {  // Wait 2 bars first
  const windowPrices = ticks.map(t => t.close);
  const field = this.fieldConstructor.constructField(windowPrices);
  const metrics = PhysicsCalculator.computeAllMetrics(field);
  const coherence = metrics.coherenceScore || 0;
  
  // If order collapses, mean reversion is taking over
  if (coherence < 0.3) {
    scout.exitBar = bar;
    scout.exitPrice = currentPrice;
    scout.exitReason = 'MEAN_REVERSION_DETECTED';
    scout.pnl = scout.direction === 'BUY'
      ? currentPrice - scout.entryPrice
      : scout.entryPrice - currentPrice;
    scout.pnlPct = scout.pnl / scout.entryPrice;
    console.log(`[MR EXIT] Bar ${bar}: Mean reversion detected (coherence=${coherence.toFixed(2)})`);
  }
}

// OLD: TIMEOUT (still applies if MR not detected)
if (scout.exitBar === undefined && barsHeld >= 5) {
  // ... timeout logic
}
```

### Expected Results
- Earlier exits before timeouts fully develop
- Better loss capture on mean reversion
- Expected win rate: 15-20%

---

## Experiment 5: COMBINATION TEST

### The Winning Formula
Test all three together:
1. **Bar 4 Timeout** (instead of 5)
2. **Turbulence Filter** (TI > 2.5 at entry)
3. **3x ATR Target** (instead of 2x)

### Expected Results
```
Baseline:  431 scouts, 9.7% win, -1.70% P&L, 219 timeouts
Combined:  250 scouts, 22% win, +1.5% P&L, 80 timeouts
                       ↑ 2.3x better
```

---

## Quick Test Script

Create `test-scout-params.sh`:
```bash
#!/bin/bash

echo "Testing Scout Parameter Variations..."

# Test 1: Bar 4 Timeout
echo "Test 1: Timeout at Bar 4"
TIMEOUT_BAR=4 pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 2>&1 | grep -E "SCOUT|Win Rate|P&L|Timeouts"

# Test 2: Bar 3 Timeout
echo ""
echo "Test 2: Timeout at Bar 3"
TIMEOUT_BAR=3 pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 2>&1 | grep -E "SCOUT|Win Rate|P&L|Timeouts"

# Test 3: Higher TARGET
echo ""
echo "Test 3: 3x ATR Target"
TARGET_MULT=3.0 pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 2>&1 | grep -E "SCOUT|Win Rate|P&L|Timeouts"

# Test 4: Turbulence Filter
echo ""
echo "Test 4: Turbulence > 2.5 at Entry"
MIN_TURB=2.5 pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 2>&1 | grep -E "SCOUT|Win Rate|P&L|Timeouts"

# Test 5: Combined
echo ""
echo "Test 5: COMBINED (Bar 4 + TI > 2.5 + 3x ATR)"
TIMEOUT_BAR=4 TARGET_MULT=3.0 MIN_TURB=2.5 pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01 2>&1 | grep -E "SCOUT|Win Rate|P&L|Timeouts"
```

---

## Priority Ranking for Implementation

| Priority | Test | Effort | Expected Gain | Risk |
|---|---|---|---|---|
| 1 🔴 | **Bar 4 Timeout** | 5 min | 2-5% win rate | Low |
| 2 🔴 | **Turbulence Filter** | 30 min | 3-5% win rate | Low |
| 3 🟠 | **3x ATR Target** | 5 min | 1-2% win rate | Medium |
| 4 🟠 | **Early MR Exit** | 1 hour | 2-3% win rate | Medium |
| 5 🟡 | **All Combined** | 1.5 hours | 10-15% win rate | Low |

---

## Success Criteria

Each test should improve:
1. **Scout win rate:** 9.7% → 15%+ ✅
2. **Timeout rate:** 51% → 30% ✅
3. **Avg timeout PnL:** -1.18% → -0.3% ✅
4. **Total scout P&L:** -1.70% → +0.5% ✅

---

## After Testing

Once you identify the best combination:
1. **Update the backtester config** with new parameters
2. **Run full test suite** (BTC + ETH, multiple date ranges)
3. **Compare to baseline** from previous run
4. **Document the changes** in config comments
5. **Prepare for live deployment** with these parameters
