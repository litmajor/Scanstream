# 📸 PHASE 6A UI WALKTHROUGH

## Before (Original backtest.tsx)
```
┌─────────────────────────────────────────────────┐
│ Run New Backtest                           [📊] │
├─────────────────────────────────────────────────┤
│ Strategy [Gradient Trend ▼]                     │
│ Symbol [BTC/USDT ▼]                            │
│ Timeframe [1h ▼]                               │
│ Initial Capital [$10000]                        │
├─────────────────────────────────────────────────┤
│ Start Date [2024-01-01]                         │
│ End Date [2024-12-31]                           │
│ [Run Backtest ▶]                                │
└─────────────────────────────────────────────────┘
```

**Limitations**:
- Single asset only
- Single strategy only
- No signal control
- Basic parameters

---

## After (Phase 6A Extended backtest.tsx)

### Main Panel
```
┌──────────────────────────────────────────────────────────┐
│ Run New Backtest                          [Advanced ✓]   │
├──────────────────────────────────────────────────────────┤
│ ☑ 🚀 PHASE 6A: Multi-Asset Backtest Mode                 │
│   • Backtest multiple assets simultaneously              │
│   • Apply ensemble voting • Full control & overview      │
└──────────────────────────────────────────────────────────┘
```

### Multi-Asset Mode OFF (Default)
```
┌──────────────────────────────────────────────────────────┐
│ Assets (Single)                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ BTC/USDT ▼                                         │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Strategy                  Timeframe         Capital      │
│ [Gradient Trend ▼]        [1h ▼]           [$10000]     │
│                                                          │
│ [Start: 2024-01-01]  [End: 2024-12-31]                  │
│                                                          │
│           [Run Backtest ▶]                              │
└──────────────────────────────────────────────────────────┘
```

### Multi-Asset Mode ON (Checked)
```
┌──────────────────────────────────────────────────────────┐
│ Assets (Multi-Select)      Strategy (Optional)           │
│ ┌────────────────────────┐ ┌─────────────────────────┐   │
│ │ ☑ BTC/USDT            │ │ Select Strategy ▼       │   │
│ │ ☑ ETH/USDT            │ │                         │   │
│ │ ☐ SOL/USDT            │ │ Timeframe        Capital│   │
│ │ ☐ ADA/USDT            │ │ [1h ▼]          [$10000]│   │
│ │ ☐ DOT/USDT            │ │                         │   │
│ │ ☐ MATIC/USDT          │ └─────────────────────────┘   │
│ │ ☐ LINK/USDT           │                              │
│ │ ☐ XRP/USDT            │                              │
│ │ [2 selected]           │                              │
│ └────────────────────────┘                              │
│                                                          │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Signal Filtering Panel (Blue Box)                  │   │
│ │ ┌────────────────────┐ ┌──────────────────────┐    │   │
│ │ │ Signal Sources     │ │ Voting Strategy      │    │   │
│ │ │ ☑ All Sources      │ │ ◉ Majority Vote      │    │   │
│ │ │ ☐ ML Pipeline      │ │ ○ Weighted Average   │    │   │
│ │ │ ☐ Pattern Scanner  │ │ ○ Consensus          │    │   │
│ │ │ ☐ RL Agent         │ │ ○ Unanimous          │    │   │
│ │ │ ☐ RPG Agent        │ │                      │    │   │
│ │ │                    │ │ Majority vote wins   │    │   │
│ │ └────────────────────┘ └──────────────────────┘    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                          │
│ Start [2024-01-01]  End [2024-12-31]                    │
│                                                          │
│        [Run Multi-Asset Backtest ▶]                     │
└──────────────────────────────────────────────────────────┘
```

### Advanced Options Panel
```
When "Advanced ✓" button is toggled:

┌──────────────────────────────────────────────────────┐
│ Slippage (%)      Commission ($)                     │
│ [0.001]           [0]                                │
│                                                       │
│ More options coming in Phase 6C:                     │
│ • Position Sizing Method                             │
│ • Max Drawdown Limit                                 │
│ • Risk Per Trade                                     │
│ • Kelly Criterion Support                            │
└──────────────────────────────────────────────────────┘
```

---

## Flow Diagram: Single Asset vs Multi-Asset

### Single Asset Mode (Original)
```
┌─────────────┐
│ Select 1    │
│ Asset (BTC) │
│             │
│ Strategy    │
│ (Gradient)  │
└──────┬──────┘
       │
       v
┌─────────────────────────┐
│ Run Backtest            │
│ Call original endpoint  │
│ /api/strategies/        │
│   backtest/run          │
└──────┬──────────────────┘
       │
       v
┌──────────────────────────┐
│ Results Card             │
│ - Total Return           │
│ - Sharpe Ratio          │
│ - Max Drawdown          │
│ - Win Rate              │
│ - Total Trades          │
└──────────────────────────┘
```

### Multi-Asset Mode (Phase 6A)
```
┌────────────────────┐
│ Select Multiple    │
│ Assets             │
│ (BTC, ETH, SOL)    │
│                    │
│ Choose Signal      │
│ Sources            │
│ (ML + Scanner)     │
│                    │
│ Pick Voting        │
│ Strategy           │
│ (Majority)         │
└────────┬───────────┘
         │
         v
┌────────────────────────────────────┐
│ Run Unified Backtest               │
│ Call new unified endpoint          │
│ /api/backtest/unified/run          │
│                                    │
│ For each asset:                    │
│ 1. Fetch market data               │
│ 2. Get signals (filter by source)  │
│ 3. Apply voting strategy           │
│ 4. Run backtest                    │
│ 5. Store results                   │
└────────┬───────────────────────────┘
         │
         v
┌──────────────────────────────┐
│ Summary Results              │
│                              │
│ ✓ Multi-Asset Complete       │
│ 3/3 Successful               │
│                              │
│ Asset Results:               │
│ • BTC: +12.5% | 1.8 Sharpe   │
│ • ETH: +8.3%  | 1.5 Sharpe   │
│ • SOL: +15.2% | 2.1 Sharpe   │
└──────────────────────────────┘
```

---

## Voting Strategy Visualization

### Scenario: 4 Signal Sources at Same Timestamp

```
Timestamp: 2024-06-15 10:00

Signal Sources:
┌──────────────────┐
│ ML: BUY (0.95)   │
│ Scanner: BUY (0.87)
│ RL: SELL (0.72)  │
│ RPG: BUY (0.81)  │
└──────────────────┘

3 BUY, 1 SELL

--- VOTING STRATEGIES ---

1. MAJORITY VOTE
   ┌─────────────────────────┐
   │ BUY (3 votes)           │
   │ SELL (1 vote)           │
   ├─────────────────────────┤
   │ Decision: BUY           │
   │ Confidence: 75% (3/4)   │
   └─────────────────────────┘

2. WEIGHTED AVERAGE
   ┌─────────────────────────┐
   │ Avg Confidence:         │
   │ (0.95+0.87+0.72+0.81)/4 │
   │ = 0.8375 (83.75%)       │
   ├─────────────────────────┤
   │ Decision: BUY (majority)│
   │ Confidence: 83.75%      │
   └─────────────────────────┘

3. CONSENSUS
   ┌─────────────────────────┐
   │ Not all agree           │
   │ 3 BUY, 1 SELL           │
   ├─────────────────────────┤
   │ Decision: SKIP          │
   │ No consensus reached    │
   └─────────────────────────┘

4. UNANIMOUS
   ┌─────────────────────────┐
   │ All must agree          │
   │ 3 BUY ≠ 1 SELL          │
   ├─────────────────────────┤
   │ Decision: SKIP          │
   │ Not unanimous           │
   └─────────────────────────┘
```

---

## API Call Example

### Before Phase 6A
```json
{
  "strategyId": "gradient-trend",
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 10000
}
↓
POST /api/strategies/backtest/run
```

### After Phase 6A (Unified)
```json
{
  "assets": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
  "signalSources": ["ml", "scanner"],
  "votingStrategy": "majority",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 10000,
  "slippage": 0.001,
  "commission": 0,
  "timeframe": "1h",
  "strategies": ["gradient-trend"],
  "agents": [],
  "positionSizingMethod": "fixed",
  "positionSize": 0.1
}
↓
POST /api/backtest/unified/run
```

---

## Available Assets (8 Total)

```
Multi-Select Checkboxes:
☐ BTC/USDT    - Bitcoin
☐ ETH/USDT    - Ethereum
☐ SOL/USDT    - Solana
☐ ADA/USDT    - Cardano
☐ DOT/USDT    - Polkadot
☐ MATIC/USDT  - Polygon
☐ LINK/USDT   - Chainlink
☐ XRP/USDT    - XRP

Users can select any combination (1-8)
```

---

## Signal Sources (4 Total)

```
ML Pipeline 🤖
• Machine learning models
• Trained on historical data
• Confidence score included

Pattern Scanner 🔍
• Technical pattern detection
• Support/resistance analysis
• Visual pattern recognition

RL Agent 🧠
• Reinforcement learning
• Adaptive to market regime
• Continuous learning

RPG Agent ⚔️
• Rule-based gaming agents
• Multiple agents competing
• Ensemble of strategies
```

---

## Phase 6A Success Story

```
USER JOURNEY:

1. Opens backtest page (existing)
   ↓
2. Sees new "🚀 PHASE 6A" banner
   ↓
3. Thinks: "I want to backtest BTC, ETH, SOL together
           using ML + Scanner signals with majority voting"
   ↓
4. Checks "Multi-Asset Mode"
   ↓
5. Selects: BTC, ETH, SOL (3 assets)
   ↓
6. Chooses: ML, Scanner (2 sources)
   ↓
7. Picks: Majority Vote strategy
   ↓
8. Sets: Dates, Capital, Timeframe
   ↓
9. Clicks: "Run Multi-Asset Backtest"
   ↓
10. Sees: "Multi-asset backtest complete! 3/3 successful"
    ↓
    ✅ Results show:
       • BTC: +12.5% return, 1.8 Sharpe
       • ETH: +8.3% return, 1.5 Sharpe
       • SOL: +15.2% return, 2.1 Sharpe

PHASE 6A GOAL ACHIEVED:
"CAN BACKTEST ANY ASSET" ✅
"FULL COMPLETE CONTROL & OVERVIEW" ✅
```

---

## Code Structure at a Glance

```
frontend/
  pages/
    backtest.tsx ✏️ (MODIFIED - added 250+ lines)
      • New state: selectedSignalSources, votingStrategy, etc.
      • New JSX: signal selector, voting selector, advanced panel
      • Updated handleRunBacktest() to call unified API

backend/
  routes/
    phase6-unified-backtest.ts 🆕 (NEW - 500+ lines)
      • POST /api/backtest/unified/run (main endpoint)
      • GET /api/backtest/unified/assets
      • GET /api/backtest/unified/signal-sources
      • GET /api/backtest/unified/agents
      • GET /api/backtest/unified/strategies
      • Helper functions: voting, signal filtering, etc.

  index.ts ✏️ (MODIFIED - added 25 lines)
    • Import phase6UnifiedBacktestRouter
    • Register at /api/backtest
    • Log all endpoints
```

---

## What's Next (Phase 6B)

```
Phase 6B: Visualization & Advanced Parameters

New Components:
  ├─ BacktestVisualization.tsx
  │  ├─ Equity curve chart
  │  ├─ Drawdown chart
  │  ├─ Monthly returns heatmap
  │  └─ Trade scatter plot
  │
  ├─ ComparisonMode.tsx
  │  ├─ Side-by-side results
  │  ├─ Metric comparison
  │  └─ Export options
  │
  └─ AdvancedParametersPanel.tsx
     ├─ Position sizing method
     ├─ Risk controls
     ├─ Parameter tuning
     └─ Batch configuration

User Gains:
  ✓ See equity curve evolution
  ✓ Analyze drawdown patterns
  ✓ Compare multiple backtests
  ✓ Export results (CSV, PDF, HTML)
  ✓ Fine-tune parameters
  ✓ Run multiple configs in batch
```

---

**Document**: Phase 6A UI Walkthrough  
**Created**: December 19, 2025  
**Status**: ✅ COMPLETE  
