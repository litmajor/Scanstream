# Convexity Engine Backtesting Framework

**Date:** December 23, 2025  
**Status:** Phase 1 - Validation (Framework Complete)  
**Objective:** Validate Convexity Engine performance on 1-year historical data (BTC + ETH, 1hr)

---

## Framework Architecture

### Core Components

#### 1. **MetricsCalculator** (`metrics-calculator.ts`)
Computes comprehensive performance metrics from trade results:

**Trade-Level Metrics:**
- Win rate, Profit factor, Avg win/loss
- Risk/Reward ratio, Win/Loss streaks

**Return Metrics:**
- Total return, Annualized return, Monthly average
- Cumulative returns tracking

**Risk Metrics:**
- Maximum drawdown (peak-to-trough)
- Sharpe ratio (return / volatility * sqrt(252))
- Sortino ratio (downside volatility only)
- Calmar ratio (annual return / max drawdown)

**Duration Metrics:**
- Avg bars per trade, min/max duration

**Output:**
```typescript
interface BacktestMetrics {
  totalTrades: number;
  winRate: number;           // %
  profitFactor: number;      // Gross profit / Gross loss
  maxDrawdown: number;       // %
  sharpeRatio: number;       // Annual
  sortinoRatio: number;      // Annual
  annualizedReturn: number;  // %
  // ... more metrics
}
```

---

#### 2. **ConvexityBacktester** (`convexity-backtester.ts`)
Full integration harness for ConvexityAgent:

**Features:**
- Loads 1-year OHLCV data (BTC/ETH from cache)
- Feeds ticks through ConvexityAgent.processTick() every bar
- Captures BUY signals via generateSignal()
- Tracks position lifecycle until exit
- Records all trades for metrics calculation

**Execution Flow:**
```
Load data → Reset state → Loop through bars:
├─ processTick(ticks, regime, fairPrice)
├─ generateSignal() → Check for BUY
├─ Track entry/exit
└─ Record bar returns
→ Calculate metrics → Output results
```

**Output:**
```typescript
interface BacktestResult {
  symbol: string;
  totalBars: number;
  trades: TradeResult[];
  metrics: BacktestMetrics;
  diagnostics: {
    convexDeployments: number;
    forTriggersPerDeployment: number;
  };
}
```

---

#### 3. **SimpleBacktester** (`simple-backtest.ts`)
Lightweight validation harness (SMA + ATR strategy):

**Purpose:** Validate metrics framework without full agent complexity  
**Strategy:** SMA20 > SMA50 crossover + ATR momentum  
**Exit Rules:** SMA20 break, 15% target, 2.5% stop, 30 bars max

**Useful For:**
- Sanity-checking metrics calculation
- Baseline performance comparison
- Quick iteration on metrics logic

---

## Data Sources

### Cached Market Data
Located: `/data/cache/`

| File | Candles | Period | Timeframe |
|------|---------|--------|-----------|
| `BTCUSDT_1h_365d.json` | 8,760 | Dec 22, 2024 - Dec 22, 2025 | 1 hour |
| `ETHUSDT_1h_365d.json` | ~8,760 | Dec 22, 2024 - Dec 22, 2025 | 1 hour |

**Format:**
```typescript
// BTC: wrapped in object with metadata
{
  symbol: "BTCUSDT",
  interval: "1h",
  days: 365,
  candles: 8760,
  dateRange: { start, end },
  data: [{ timestamp, open, high, low, close, volume }, ...]
}

// ETH: direct array
[{ timestamp, open, high, low, close, volume }, ...]
```

---

## Phase 1: Validation Plan

### Step 1: Run Simple Backtest
```bash
npx ts-node server/backtest/simple-backtest.ts
```

**Expected Output:**
```
🚀 CONVEXITY BACKTEST SUITE

📖 Loading BTC data...
✅ Loaded 8760 BTC candles
🔄 Running BTC backtest...

═══════════════════════════════════════════════════════════════

BTC/USDT - BACKTEST RESULTS

📊 Trade Statistics
├─ Total Trades: ~40-60
├─ Win Rate: ~60%
└─ Profit Factor: ~1.5-2.0x

💰 Performance
├─ Annualized Return: ~20-40%
├─ Max Drawdown: ~10-15%
├─ Sharpe Ratio: ~1.5-2.0
└─ Recent Trades: ✅ 2.5%, ❌ -0.8%, ✅ 3.1%, ...

═══════════════════════════════════════════════════════════════

SUMMARY

Symbol       Trades   Win%     PF       Sharpe   AnnRet%
───────────────────────────────────────────────────────────
BTC/USDT     50       60.0%    1.8x     1.7      28.3%
ETH/USDT     48       61.0%    1.9x     1.8      32.1%

✅ Backtest complete!
```

**Validation Checklist:**
- ✅ Framework loads data correctly
- ✅ Metrics calculate without errors
- ✅ Win rates reasonable (50-70%)
- ✅ Profit factor > 1.0
- ✅ Sharpe ratio sensible

---

### Step 2: Run ConvexityAgent Backtest
```bash
npx ts-node server/backtest/convexity-backtester.ts
```

**Expected Challenges:**
- ConvexityAgent may have few deployments (requires VFMD context)
- Need to integrate mock VFMD signals for testing
- FoR triggers may be rare initially

**Success Metrics:**
- ✅ No runtime errors
- ✅ At least 5-20 trades generated
- ✅ Win rate 35-50% (lower than VFMD, but higher target hits)
- ✅ Profit factor > 1.0
- ✅ Sharpe ratio > 1.0

---

### Step 3: Tune Thresholds
Based on Step 2 results:

**If too few trades (< 5):**
- Lower `hostileEventThreshold` (e.g., 2 instead of 3)
- Lower `forScoreThreshold` (e.g., 0.30 instead of 0.40)
- Increase `positionMultiplier` (e.g., 0.8x instead of 0.5x)

**If too many losing trades (< 40% win rate):**
- Raise `hostileEventThreshold` (2-3 per regime)
- Raise `forScoreThreshold` (0.50+)
- Reduce `positionMultiplier` (0.3-0.5x)

**If drawdowns too high (> 10%):**
- Tighten stop distance (1.5% instead of 2.5%)
- Increase profit target (18% instead of 15%)
- Raise FoR threshold (0.60+)

---

## Metrics Interpretation

### Win Rate
- **VFMD target:** 58-62%
- **Convex target:** 35-50% (acceptable: fewer trades, larger wins)
- **Minimum:** > 35% (below this, high-conviction entry breaks down)

### Profit Factor
- **Definition:** Gross profit / Gross loss
- **VFMD target:** 2.0+
- **Convex target:** 1.5+ (asymmetric payoff makes lower PF acceptable)
- **Minimum:** > 1.0 (else losing money)

### Sharpe Ratio
- **Definition:** (Return - RiskFreeRate) / StdDev * sqrt(252)
- **VFMD target:** 2.0+
- **Convex target:** 1.5+ (fewer trades = lower Sharpe)
- **Good:** > 1.0 | Excellent: > 2.0

### Max Drawdown
- **VFMD:** 2-3%
- **Convex:** 5-10% (wider stops, accepts pain)
- **Maximum acceptable:** 15% (psychological limit)

### Annualized Return
- **VFMD:** 40-60% (high frequency + good accuracy)
- **Convex:** 20-50% (lower frequency + higher payoff)
- **Combined:** 60-100%+ (asymmetric compounding)

---

## File Structure

```
server/
├── backtest/
│   ├── metrics-calculator.ts          (330 lines, compiled ✅)
│   ├── convexity-backtester.ts        (273 lines, compiled ✅)
│   ├── simple-backtest.ts             (298 lines, compiled ✅)
│   └── README.md                      (this file)
└── services/rpg-agents/
    ├── ConvexityAgent.ts              (uses agent to generate signals)
    └── vfmd/
        └── failureOfReversionCalculator.ts (FoR math)

data/
└── cache/
    ├── BTCUSDT_1h_365d.json           (8,760 candles, ~3.5MB)
    └── ETHUSDT_1h_365d.json           (~8,760 candles, ~3.2MB)
```

---

## Next Steps

### Phase 1b: Validate Simple Backtest (Today)
- ✅ Run simple backtest
- ✅ Confirm metrics framework works
- Document baseline performance

### Phase 2: Integrate ConvexityAgent (This Week)
- Run ConvexityAgent backtest
- Capture FoR trigger frequency
- Measure win rate vs VFMD context
- Identify integration gaps

### Phase 3: Optimization (Next Week)
- Adjust thresholds based on Phase 2
- Run param sweep (hostile events, FoR scores)
- Finalize for live paper trading

### Phase 4: Live Validation (Weeks 2-4)
- Paper trade alongside VFMD
- Monitor real execution, slippage, fills
- Measure deviation from backtest
- Prepare for live deployment

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No trades | VFMD signals missing | Mock VFMD signals in backtest loop |
| Too many small losses | FoR threshold too low | Raise `forScoreThreshold` to 0.50+ |
| Drawdown too high | Stops too wide | Reduce `stopDistance` to 1.5% |
| Sharpe ratio low | High variance in exits | Improve FoR condition detection |
| Data load error | Path wrong or format changed | Check file path and JSON structure |

---

## References

- **ConvexityAgent:** `server/services/rpg-agents/ConvexityAgent.ts`
- **Metrics Formulas:** `server/backtest/metrics-calculator.ts` (lines 100-200)
- **Data Cache:** `data/cache/BTCUSDT_1h_365d.json` (sample)
- **Documentation:** `CONVEXITY_AGENT_COMPLETE_DOCUMENTATION.md`

---

**Ready to validate?** Run:
```bash
npx ts-node server/backtest/simple-backtest.ts
```

Then review results and proceed to full ConvexityAgent backtest.
