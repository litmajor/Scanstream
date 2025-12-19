# 🏗️ PHASE 6: VISUAL ARCHITECTURE & FLOW DIAGRAMS

**Date**: December 18, 2025  
**Purpose**: Visual reference for understanding Phase 6 architecture

---

## 📊 SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 6: UNIFIED BACKTEST HUB                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐        ┌──────────────────────────────┐  │
│  │   FRONTEND LAYER     │        │   BACKEND LAYER              │  │
│  │                      │        │                              │  │
│  │ phase6-backtest-hub  │◄──────►│ phase6-backtest.ts (routes) │  │
│  │                      │        │                              │  │
│  │ ┌────────────────┐   │        │ ┌────────────────────────┐   │  │
│  │ │ Config Panel   │   │        │ │  Unified Backtester   │   │  │
│  │ │ • Assets       │   │        │ │                        │   │  │
│  │ │ • Signals      │   │        │ │ • Signal generation    │   │  │
│  │ │ • Agents       │   │        │ │ • Voting logic         │   │  │
│  │ │ • Strategies   │   │        │ │ • Trade simulation     │   │  │
│  │ │ • Parameters   │   │        │ │ • Metric calculation   │   │  │
│  │ └────────────────┘   │        │ └────────────────────────┘   │  │
│  │                      │        │                              │  │
│  │ ┌────────────────┐   │        │ ┌────────────────────────┐   │  │
│  │ │ Results Panel  │   │        │ │ Backtest Runner (ext) │   │  │
│  │ │ • Charts       │   │        │ │                        │   │  │
│  │ │ • Metrics      │   │        │ │ • Trade execution      │   │  │
│  │ │ • Trades       │   │        │ │ • P&L calculation      │   │  │
│  │ │ • Export       │   │        │ │                        │   │  │
│  │ └────────────────┘   │        │ └────────────────────────┘   │  │
│  │                      │        │                              │  │
│  └──────────────────────┘        └──────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐        ┌──────────────────────────────┐  │
│  │   WebSocket Events   │        │   DATABASE LAYER             │  │
│  │                      │        │                              │  │
│  │ • Progress updates   │◄──────►│ backtest_configurations      │  │
│  │ • Live metrics       │        │ backtest_runs                │  │
│  │ • Status changes     │        │ backtest_trades              │  │
│  │                      │        │ backtest_comparisons         │  │
│  └──────────────────────┘        │                              │  │
│                                   └──────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 DATA FLOW DIAGRAM

```
USER INPUT
    │
    ├─ Select Assets: AAPL, MSFT, SPY
    ├─ Select Signals: ML (70% weight), Scanner (30% weight)
    ├─ Select Agents: Trend (50%), Mean-Revert (50%)
    ├─ Set Parameters: slippage=0.1%, capital=$100k
    └─ Click "Run Backtest"
            │
            ▼
    HTTP POST to /api/backtest/unified/run
            │
            ▼
    BACKEND PROCESSING
    ├─ 1. Fetch historical data (AAPL, MSFT, SPY)
    ├─ 2. Generate ML signals + Scanner signals
    ├─ 3. Filter by confidence thresholds
    ├─ 4. Generate signals from Trend agent + Mean-Revert agent
    ├─ 5. Combine all signals using voting (70% ML, 30% Scanner, agents vote)
    ├─ 6. Run backtest simulation (trade execution, P&L)
    ├─ 7. Calculate metrics (Sharpe, drawdown, win rate, etc)
    ├─ 8. Store in database (backtest_runs, backtest_trades)
    └─ Return backtestRunId + initial results
            │
            ▼
    WEBWOCKET PROGRESS UPDATES (every 1-2 seconds)
    ├─ 25% complete: "Processing 91 / 365 days..."
    ├─ 50% complete: "Current Equity: $105,240 (+5.2%)"
    ├─ 75% complete: "Trades so far: 47, Win Rate: 61%"
    └─ 100% complete: "Backtest complete!"
            │
            ▼
    RESULTS DISPLAYED
    ├─ Metrics table (Sharpe, Drawdown, Win Rate, etc)
    ├─ Equity curve chart
    ├─ Drawdown chart
    ├─ Trade scatter plot
    ├─ Monthly returns heatmap
    └─ Individual trade details (sortable, filterable)
            │
            ▼
    USER OPTIONS
    ├─ Compare with previous backtest
    ├─ Export to CSV/JSON/PDF
    ├─ Save configuration
    ├─ Adjust parameters and re-run
    └─ Share report
```

---

## 🧩 COMPONENT HIERARCHY

```
phase6-backtest-hub.tsx (Main Page)
│
├─ BacktestConfigPanel.tsx
│  ├─ AssetSelector.tsx
│  │  ├─ Search input
│  │  ├─ Multi-select checkboxes
│  │  └─ Preset buttons (Top 10, Tech, Crypto)
│  │
│  ├─ SignalSourceSelector.tsx
│  │  ├─ Toggle switches (ML, Scanner, RL, RPG)
│  │  ├─ Weight sliders (0-100%)
│  │  └─ Confidence threshold sliders
│  │
│  ├─ AgentSelector.tsx
│  │  ├─ Agent checkboxes (5 agents)
│  │  ├─ Weight controls
│  │  ├─ Voting strategy dropdown
│  │  └─ Parameter inputs
│  │
│  ├─ StrategySelector.tsx
│  │  ├─ Strategy checkboxes (6+ strategies)
│  │  ├─ Weight controls
│  │  ├─ Parameter controls (per-strategy)
│  │  └─ Voting strategy dropdown
│  │
│  ├─ AdvancedParametersPanel.tsx
│  │  ├─ Capital input
│  │  ├─ Slippage input
│  │  ├─ Commission input
│  │  ├─ Position sizing method dropdown
│  │  ├─ Position size % input
│  │  ├─ Walk-forward toggle
│  │  └─ Walk-forward parameters
│  │
│  ├─ Date range pickers (from, to)
│  ├─ Run button
│  └─ Clear button
│
├─ BacktestResults.tsx
│  ├─ Status indicator (queued/running/done)
│  ├─ Progress bar (0-100%)
│  │
│  ├─ BacktestMetricsTable.tsx
│  │  ├─ Total Return
│  │  ├─ Sharpe Ratio
│  │  ├─ Max Drawdown
│  │  ├─ Win Rate
│  │  ├─ Profit Factor
│  │  ├─ Avg Win / Avg Loss
│  │  └─ More metrics...
│  │
│  ├─ BacktestVisualization.tsx
│  │  ├─ Tab 1: Equity Curve
│  │  │  ├─ Line chart
│  │  │  └─ Underwater plot (drawdown)
│  │  │
│  │  ├─ Tab 2: Drawdown
│  │  │  └─ Area chart of max drawdown
│  │  │
│  │  ├─ Tab 3: Monthly Returns
│  │  │  ├─ Bar chart
│  │  │  └─ Heatmap calendar
│  │  │
│  │  ├─ Tab 4: Trade Scatter
│  │  │  └─ Scatter plot (entry/exit prices)
│  │  │
│  │  ├─ Tab 5: Distribution
│  │  │  └─ Histogram of win/loss sizes
│  │  │
│  │  └─ Tab 6: Performance by Asset
│  │     └─ Multi-series bar chart
│  │
│  ├─ Trades table
│  │  ├─ Entry price, Exit price
│  │  ├─ P&L, P&L %
│  │  ├─ Duration
│  │  ├─ Signal source
│  │  └─ Strategy/Agent used
│  │
│  ├─ ComparisonMode.tsx (if comparing)
│  │  └─ Side-by-side metrics for 2-4 backtests
│  │
│  └─ Export options
│     ├─ Download CSV
│     ├─ Download JSON
│     ├─ Download PDF report
│     └─ Download HTML report
│
└─ HistoricalAnalysisPanel.tsx (Optional)
   ├─ Button: "Run Full Historical Analysis"
   ├─ Algorithm Score (1-10)
   ├─ 2-Year Statistics
   ├─ Underperforming patterns
   └─ Recommendations
```

---

## 📈 SIGNAL COMBINATION FLOW

```
                    HISTORICAL MARKET DATA
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
      ML Engine        Scanner Engine        RL Engine
         │                  │                  │
         │ (ML signals      │ (Scanner       │ (RL signals
         │  confidence:     │  confidence:   │  confidence:
         │  85%)            │  62%)          │  58%)
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │                                     │
         ▼                                     ▼
    SIGNAL FILTERING                    AGENT ENSEMBLE
    ├─ ML: 85% > 70% ✓                  ├─ Trend agent signals
    ├─ Scanner: 62% > 50% ✓             ├─ Mean-Revert signals
    └─ RL: 58% > 60% ✗ (skip)           └─ Momentum signals
         │                                     │
         └─────────────────┬────────────────────┘
                           │
                           ▼
                    VOTING (Majority)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    Time: 14:30      Time: 14:32       Time: 14:35
    AAPL: BUY vote    MSFT: SELL vote   SPY: BUY vote
    ML: BUY (85%)     ML: HOLD          ML: SELL (75%)
    Scanner: BUY     Scanner: SELL     Scanner: BUY (50%)
    (62%)             (55%)             Trend: BUY
    Trend: BUY        Trend: HOLD       Result: BUY (2/3)
                                        Confidence: 62%
    Result: BUY      Result: SELL
    Confidence: 82%  Confidence: 55%
         │                 │
         └─────────────────┼─────────────────┘
                           │
                           ▼
                   COMBINED SIGNALS
                   ├─ AAPL: BUY @ $185.50
                   ├─ MSFT: SELL @ $380.20
                   └─ SPY: BUY @ $456.30
                           │
                           ▼
                   BACKTEST SIMULATION
                   ├─ Execute trades
                   ├─ Calculate slippage
                   ├─ Track P&L
                   └─ Close positions
                           │
                           ▼
                   RESULTS & METRICS
```

---

## 🎯 BACKTEST VOTING STRATEGIES

### Majority Voting
```
Signal A: BUY
Signal B: BUY
Signal C: HOLD
Signal D: SELL

Vote: BUY wins (2 > 1, HOLD ignored)
Confidence: 2/4 = 50%
```

### Weighted Average
```
Signal A (weight 0.35): BUY = +1
Signal B (weight 0.20): SELL = -1
Signal C (weight 0.25): BUY = +1
Signal D (weight 0.20): HOLD = 0

Weighted sum: (0.35 × 1) + (0.20 × -1) + (0.25 × 1) + (0.20 × 0) = 0.40
Result: BUY (positive)
Confidence: |0.40| = 40%
```

### Consensus (Configurable Threshold)
```
Threshold: 70%

Votes for BUY: 3 out of 4 = 75%
75% > 70% ✓ → Execute BUY

Votes for SELL: 1 out of 4 = 25%
25% < 70% ✗ → Skip SELL
```

---

## 📊 METRICS CALCULATION FLOW

```
TRADES EXECUTED
│
├─ Trade 1: Entry $100, Exit $105 → Profit $5 (5%)
├─ Trade 2: Entry $100, Exit $95 → Loss -$5 (-5%)
├─ Trade 3: Entry $100, Exit $108 → Profit $8 (8%)
├─ Trade 4: Entry $100, Exit $102 → Profit $2 (2%)
└─ Trade 5: Entry $100, Exit $98 → Loss -$2 (-2%)
            │
            ▼
    BASIC METRICS
    ├─ Total Trades: 5
    ├─ Winning Trades: 3
    ├─ Losing Trades: 2
    └─ Win Rate: 3/5 = 60%
            │
            ▼
    RETURN METRICS
    ├─ Total Return: (5 - 5 + 8 + 2 - 2) = 8%
    ├─ Average Return per Trade: 8/5 = 1.6%
    ├─ Average Win: (5 + 8 + 2) / 3 = 5%
    ├─ Average Loss: (-5 - 2) / 2 = -3.5%
    └─ Profit Factor: 15 / 7 = 2.14
            │
            ▼
    RISK METRICS
    ├─ Max Drawdown: Historical peak to trough
    ├─ Volatility: Std dev of returns
    ├─ Sharpe Ratio: (Return - Risk-free) / Volatility
    ├─ Sortino Ratio: (Return - Risk-free) / Downside Volatility
    └─ Calmar Ratio: Return / Max Drawdown
            │
            ▼
    FINAL METRICS TABLE
    ┌────────────────────┬────────┐
    │ Total Return       │ 8.0%   │
    │ Annualized Return  │ 23.5%  │
    │ Win Rate           │ 60%    │
    │ Sharpe Ratio       │ 1.45   │
    │ Max Drawdown       │ -12.3% │
    │ Profit Factor      │ 2.14   │
    └────────────────────┴────────┘
```

---

## 🔄 COMPARISON FLOW

```
Backtest 1: ML signals only          Backtest 2: ML + Scanner ensemble
─────────────────────────             ──────────────────────────────
Returns: +25%                         Returns: +28% ✓ Winner
Sharpe: 1.45                          Sharpe: 1.62 ✓ Winner
Drawdown: -15%                        Drawdown: -12% ✓ Winner
Win Rate: 58%                         Win Rate: 62% ✓ Winner
Trades: 87                            Trades: 92
P.Factor: 1.95                        P.Factor: 2.15 ✓ Winner
             │                                   │
             └───────────────┬───────────────────┘
                             │
                             ▼
                  COMPARISON RESULTS
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    Winner per metric   Summary              Recommendation
    ├─ Return: #2       Backtest #2           "Ensemble approach
    ├─ Sharpe: #2       outperforms           with Scanner +
    ├─ Drawdown: #2     Backtest #1           ML performs better
    ├─ Win Rate: #2     across almost         across all metrics.
    └─ P.Factor: #2     all metrics.          Use #2 for live trading."
```

---

## 💾 DATABASE SCHEMA OVERVIEW

```
backtest_configurations
├─ id (UUID) - Primary key
├─ name - "Tesla 2023 Test"
├─ assets - ['TSLA', 'QQQ'] - Array
├─ signal_sources - JSON object
│  ├─ ML: {enabled, weight, minConfidence}
│  ├─ SCANNER: {...}
│  └─ ...
├─ agents - JSON object
│  ├─ trend-follower: {enabled, weight}
│  └─ ...
├─ parameters - JSON object
│  ├─ slippage, commission
│  ├─ positionSizingMethod
│  └─ ...
└─ created_at, updated_at

        │
        ├────────────────────────┐
        │                        │
        ▼                        ▼

backtest_runs              backtest_trades
├─ id (UUID)              ├─ id (UUID)
├─ configuration_id (FK)  ├─ backtest_run_id (FK)
├─ status                 ├─ symbol
├─ progress_percent       ├─ entry_price, exit_price
├─ metrics (JSON)         ├─ profit_loss, profit_loss_pct
│  ├─ sharpe_ratio        ├─ entry_time, exit_time
│  ├─ max_drawdown        ├─ signal_source
│  ├─ win_rate            ├─ strategy_id, agent_id
│  └─ ...                 └─ created_at
├─ results (JSON)
└─ timestamps

        │
        └────────────────┐
                         │
                         ▼

backtest_comparisons
├─ id (UUID)
├─ name - "Ensemble vs Single"
├─ backtest_run_ids - [id1, id2, id3]
├─ metrics_compared - ['sharpe', 'return', 'drawdown']
├─ winner_run_id - id2
├─ analysis_summary
└─ created_at
```

---

## 🚀 DEPLOYMENT FLOW

```
User Interface Ready
         │
         ▼
   Frontend Build
   ├─ React components compiled
   ├─ TypeScript checked
   └─ Bundled
         │
         ▼
   Backend Build
   ├─ TypeScript compiled
   ├─ Services tested
   └─ Routes registered
         │
         ▼
   Database Setup
   ├─ Run migrations
   ├─ Create tables
   └─ Create indexes
         │
         ▼
   Seed Data (Optional)
   ├─ Sample configs
   ├─ Historical data
   └─ Test backtests
         │
         ▼
   Production Deploy
   ├─ Start server
   ├─ Enable WebSocket
   └─ Ready for trading research!
```

---

## ✅ SUCCESS CHECKLIST

```
Phase 6A: Foundation ✓
├─ [ ] Config panel UI
├─ [ ] Asset selector
├─ [ ] Backend routes
└─ [ ] Basic backtest running

Phase 6B: Signals ✓
├─ [ ] Signal source selector
├─ [ ] Filtering logic
├─ [ ] Voting mechanism
└─ [ ] Backend filtering

Phase 6C: Ensemble ✓
├─ [ ] Agent selector
├─ [ ] Strategy selector
├─ [ ] Ensemble voting
└─ [ ] Parameter UI

Phase 6D: Parameters ✓
├─ [ ] Advanced panel
├─ [ ] All controls available
├─ [ ] Persistence
└─ [ ] Validation

Phase 6E: Visualization ✓
├─ [ ] Equity curve
├─ [ ] Drawdown chart
├─ [ ] Monthly returns
├─ [ ] Trade details

Phase 6F: Comparison ✓
├─ [ ] Comparison UI
├─ [ ] CSV export
├─ [ ] PDF export
└─ [ ] Reports

Phase 6G: Advanced ✓
├─ [ ] Walk-forward
├─ [ ] Sensitivity
├─ [ ] Optimization
└─ [ ] Risk analysis
```

---

**End of Architecture Diagrams**

Use these visual references while implementing Phase 6!
