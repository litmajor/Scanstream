# 🎯 PHASE 6: QUICK REFERENCE GUIDE

**Date**: December 18, 2025  
**For**: Fast lookup of Phase 6 architecture and implementation

---

## 📍 QUICK NAVIGATION

| Document | Purpose |
|----------|---------|
| **PHASE_6_BACKTEST_AUDIT_COMPLETE.md** | Full audit with gaps, requirements, architecture |
| **PHASE_6_TECHNICAL_SPECIFICATIONS.md** | Detailed tech specs, data models, code examples |
| **PHASE_6_QUICK_REFERENCE_GUIDE.md** | This file - Quick lookup |

---

## 🎯 WHAT YOU CAN DO WITH PHASE 6

```
┌─────────────────────────────────────────────────────┐
│           PHASE 6 UNIFIED BACKTEST HUB              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✅ Test ANY Asset (AAPL, MSFT, SPY, BTC, ETH...)  │
│  ✅ Test ANY Signal Source (ML, Scanner, RL, RPG)  │
│  ✅ Test ANY Agent Combo (single or ensemble)      │
│  ✅ Test ANY Strategy Combo (single or ensemble)   │
│  ✅ Full Parameter Control (slippage, commission)  │
│  ✅ Compare Results (A/B testing)                  │
│  ✅ Rich Visualization (equity, drawdown, etc)     │
│  ✅ Export Reports (CSV, JSON, PDF, HTML)          │
│  ✅ Walk-Forward Validation (prevent overfitting)  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔴 CURRENT GAPS (To Fix)

| Gap | Impact | Priority |
|-----|--------|----------|
| No multi-asset selector | Can't test portfolios | HIGH |
| No signal source picker | Can't compare signals | HIGH |
| No agent combo support | Can't test ensembles | HIGH |
| No strategy combo support | Can't combine strategies | HIGH |
| Limited parameter control | Can't tune backtest | HIGH |
| No comparison mode | Can't A/B test | MEDIUM |
| Limited visualization | Poor analysis | MEDIUM |
| No export | Can't share results | MEDIUM |
| No walk-forward | Can't validate | LOW |

---

## 📂 FILE STRUCTURE (New)

```
client/src/
├── pages/
│   └── phase6-backtest-hub.tsx (NEW - Main page)
│
└── components/phase6/
    ├── BacktestConfigPanel.tsx
    ├── AssetSelector.tsx
    ├── SignalSourceSelector.tsx
    ├── AgentSelector.tsx
    ├── StrategySelector.tsx
    ├── AdvancedParametersPanel.tsx
    ├── BacktestExecutor.tsx
    ├── BacktestResults.tsx
    ├── BacktestVisualization.tsx
    ├── ComparisonMode.tsx
    └── HistoricalAnalysisPanel.tsx

server/
├── routes/
│   └── phase6-backtest.ts (NEW - API routes)
│
└── services/
    └── phase6-unified-backtester.ts (NEW - Core logic)
```

---

## 🔌 NEW API ENDPOINTS

```bash
# Run backtest with full config
POST /api/backtest/unified/run
→ { backtestRunId, progress, results }

# Get backtest progress (WebSocket)
WS /events
← { type: 'backtest:progress', progress, metrics }

# Compare multiple backtests
POST /api/backtest/unified/compare
→ { comparison, bestByMetric, recommendations }

# Export results
POST /api/backtest/unified/export
→ File download (CSV/JSON/PDF/HTML)

# Get historical analysis
POST /api/backtest/unified/historical
→ { algorithm_score, sharpe, sortino, maxDrawdown }

# Get available configs
GET /api/backtest/unified/configs
→ [{ id, name, assets, ... }]

# Save config
POST /api/backtest/unified/configs
→ { configId }

# Load config
GET /api/backtest/unified/configs/:configId
→ { Full config object }
```

---

## 🗄️ NEW DATABASE TABLES

```sql
-- Configuration templates
backtest_configurations
├── id (PK)
├── name, description
├── assets, signal_sources, agents, strategies
├── parameters (slippage, commission, etc)
└── timestamps

-- Backtest runs
backtest_runs
├── id (PK)
├── configuration_id (FK)
├── status (queued/running/completed/failed)
├── metrics (results)
└── timestamps

-- Individual trades
backtest_trades
├── id (PK)
├── backtest_run_id (FK)
├── trade details (entry/exit, P&L)
└── signals used

-- Comparisons
backtest_comparisons
├── id (PK)
├── backtest_run_ids (array of IDs)
└── comparison analysis
```

---

## 💾 SIGNAL SOURCE CONFIG FORMAT

```typescript
{
  ML: {
    enabled: true,
    weight: 0.35,
    minConfidence: 0.70
  },
  SCANNER: {
    enabled: true,
    weight: 0.20,
    minConfidence: 0.50
  },
  RL: {
    enabled: false,
    weight: 0.00,
    minConfidence: 0.60
  },
  RPG: {
    enabled: true,
    weight: 0.15,
    minConfidence: 0.60
  }
}
```

---

## 👥 AGENT ENSEMBLE CONFIG

```typescript
{
  agents: {
    "trend-follower": { enabled: true, weight: 0.25 },
    "mean-revert": { enabled: true, weight: 0.25 },
    "momentum-trader": { enabled: false, weight: 0 },
    "breakout-scout": { enabled: true, weight: 0.25 },
    "volatility-hunter": { enabled: true, weight: 0.25 }
  },
  votingStrategy: "weighted_avg",
  consensusThreshold: 0.6
}
```

---

## 📊 STRATEGY ENSEMBLE CONFIG

```typescript
{
  strategies: {
    "gradient_trend_filter": {
      enabled: true,
      weight: 0.4,
      parameters: {
        fast_period: 10,
        slow_period: 50,
        threshold: 0.002
      }
    },
    "ut_bot": {
      enabled: true,
      weight: 0.3,
      parameters: {
        sensitivity: 1.0,
        atr_period: 10
      }
    },
    "mean_reversion": {
      enabled: false,
      weight: 0
    }
  },
  votingStrategy: "weighted_avg"
}
```

---

## 📈 BACKTEST METRICS CALCULATED

```
Total Return %          - Cumulative gain/loss
Annualized Return %     - Yearly average return
Sharpe Ratio            - Risk-adjusted return (higher = better)
Sortino Ratio           - Downside risk adjusted (higher = better)
Calmar Ratio            - Return / Max Drawdown
Max Drawdown %          - Biggest peak-to-trough loss
Win Rate %              - Percent of profitable trades
Profit Factor           - (Sum of wins) / (Sum of losses)
Average Win %           - Mean return on winning trades
Average Loss %          - Mean loss on losing trades
Total Trades            - Number of trades executed
Winning Trades          - Count of profitable trades
Recovery Factor         - Total Return / Max Drawdown
```

---

## 🔄 VOTING STRATEGIES

### Signal Source Voting
- **Majority**: Need > 50% signals to agree
- **Weighted Avg**: Average confidence across sources
- **Unanimous**: All sources must agree

### Agent Ensemble Voting
- **Majority**: > 50% agents vote for direction
- **Weighted Avg**: Weighted average of agent confidence
- **Unanimous**: All agents must agree
- **Consensus**: Need N% (configurable) agreement

### Strategy Ensemble Voting
- **Majority**: > 50% strategies vote for direction
- **Weighted Avg**: Weighted average of strategy signals
- **Consensus**: Configurable threshold

---

## 🚀 IMPLEMENTATION PHASES

### Phase 6A: Foundation (Week 1)
- [ ] Create backtest hub page
- [ ] Asset selector component
- [ ] Basic backend route
- [ ] Hook up to existing backtest-runner

### Phase 6B: Signal Control (Week 1-2)
- [ ] Signal source selector
- [ ] Signal filtering logic
- [ ] Confidence threshold control

### Phase 6C: Agent/Strategy (Week 2)
- [ ] Agent selector + ensemble
- [ ] Strategy selector + ensemble
- [ ] Voting logic

### Phase 6D: Parameters (Week 2-3)
- [ ] Advanced parameters panel
- [ ] Slippage/commission UI
- [ ] Position sizing options

### Phase 6E: Visualization (Week 3)
- [ ] Equity curve chart
- [ ] Drawdown chart
- [ ] Performance calendar
- [ ] Trade scatter plot

### Phase 6F: Comparison & Export (Week 3-4)
- [ ] Comparison mode
- [ ] CSV/JSON export
- [ ] HTML report generation

---

## 🎨 UI/UX GUIDELINES

### Color Scheme
- Win Rate: Green (#10b981)
- Loss/Drawdown: Red (#ef4444)
- Neutral/Cash: Gray (#6b7280)
- Positive Return: Green gradient
- Negative Return: Red gradient

### Layout
- Left Panel: Configuration (30%)
- Right Panel: Results/Charts (70%)
- Header: Status, Progress bar
- Footer: Run button, Export button

### Responsive
- Desktop: Two-column layout
- Tablet: Stacked panels, scrollable
- Mobile: Full stacked, scrollable

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] Signal filtering logic
- [ ] Vote combination logic
- [ ] Metric calculations
- [ ] Position sizing calculations

### Integration Tests
- [ ] Full backtest flow
- [ ] Database storage/retrieval
- [ ] WebSocket progress updates
- [ ] API endpoint responses

### E2E Tests
- [ ] Run single-asset backtest
- [ ] Run multi-asset backtest
- [ ] Test all voting strategies
- [ ] Export results
- [ ] Compare backtests

---

## ⚡ PERFORMANCE TARGETS

| Operation | Target |
|-----------|--------|
| Single asset, 1 year | < 5 seconds |
| Multi-asset (5), 1 year | < 15 seconds |
| Full 5 year historical | < 60 seconds |
| Comparison of 4 results | < 2 seconds |
| UI responsiveness | < 100ms latency |
| WebSocket updates | Every 1-2 seconds |

---

## 🔗 DEPENDENCIES & LEVERAGE

### Reuse from Phase 5
- Signal sources (ML, Scanner, RL, RPG)
- Agent definitions and performance
- RegimeDisplay component
- ExtendedAgentLeaderboard component
- WebSocket real-time updates
- Database tables (extend, don't replace)

### Existing Infrastructure
- backtest-runner.ts (core engine)
- portfolio-simulator.ts (position tracking)
- strategies.ts (strategy definitions)
- signal-backtester.ts (signal testing)

---

## 📝 CONFIGURATION EXAMPLE

```typescript
// Full backtest configuration
const config = {
  // Assets
  assets: ['AAPL', 'MSFT', 'SPY'],
  
  // Time period
  startDate: '2023-01-01',
  endDate: '2024-12-31',
  
  // Signal sources
  signalSources: {
    ML: { enabled: true, weight: 0.35, minConfidence: 0.70 },
    SCANNER: { enabled: true, weight: 0.20, minConfidence: 0.50 },
    RL: { enabled: false, weight: 0, minConfidence: 0.60 },
    RPG: { enabled: true, weight: 0.15, minConfidence: 0.60 }
  },
  
  // Agent ensemble
  agents: {
    'trend-follower': { enabled: true, weight: 0.25 },
    'mean-revert': { enabled: true, weight: 0.25 },
    'momentum-trader': { enabled: false, weight: 0 },
    'breakout-scout': { enabled: true, weight: 0.25 },
    'volatility-hunter': { enabled: true, weight: 0.25 }
  },
  agentVotingStrategy: 'weighted_avg',
  
  // Parameters
  initialCapital: 100000,
  slippage: 0.001, // 0.1%
  commission: 0.0, // No commission
  positionSizingMethod: 'fixed',
  positionSizePercent: 2.0, // 2% per trade
  maxPositions: 5,
  
  // Advanced
  enableWalkForward: true,
  trainPeriodDays: 252, // 1 year
  testPeriodDays: 63, // ~3 months
  walkForwardStepDays: 21 // ~1 month steps
};

// POST /api/backtest/unified/run
const response = await fetch('/api/backtest/unified/run', {
  method: 'POST',
  body: JSON.stringify(config)
});

const { backtestRunId, results } = await response.json();
```

---

## 🎓 KEY LEARNINGS

**From Phase 5**:
- Signal sources have different strengths (ML=58%, Scanner=52%, RL=54%, RPG=48%)
- Ensemble voting improves results
- Regime awareness is critical
- Real-time updates improve UX

**For Phase 6**:
- Multi-asset testing reveals diversification insights
- Parameter sensitivity is high
- Walk-forward validation prevents overfitting
- Comparison mode is essential for strategy selection

---

## 📞 QUICK COMMANDS

```bash
# Start development
npm run dev

# Run tests
npm test -- --testPathPattern=phase-6

# Build
npm run build

# Database migration
psql -U scanuser -d scandb -f server/migrations/003_phase6_backtest.sql

# Seed test data
npx tsx server/scripts/seed-phase6-data.ts
```

---

**End of Quick Reference**

**Status**: Ready to start Phase 6 Implementation  
**Next Step**: Review full audit document, then begin Phase 6A
