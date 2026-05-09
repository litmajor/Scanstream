# 🎯 PHASE 6: BACKTEST INFRASTRUCTURE AUDIT & ROADMAP

**Current Date**: December 18, 2025  
**Status**: Foundation Exists - Gaps Identified - Ready for Unified Hub Implementation

---

## 📊 EXECUTIVE SUMMARY

### What We Have
✅ **Multiple backtest engines** across the codebase (unified, signal, historical, flow-field)  
✅ **React backtest.tsx UI** with basic strategy selection  
✅ **5 RPG trading agents** (Trend, Mean Reversion, Momentum, Breakout, Volatility)  
✅ **6+ strategies** with configurable parameters (Gradient Trend, UT Bot, Mean Reversion, etc.)  
✅ **Portfolio simulator** with performance metrics calculation  
✅ **Historical data support** (2+ years available)

### What We're Missing
❌ **Multi-asset selection** - Currently limited, not unified  
❌ **Signal source selector** - Can't pick which signals to test (ML, Scanner, RL, RPG, combinations)  
❌ **Agent combinations** - Can't test agent combo performance  
❌ **Strategy combinations** - Can't run multiple strategies together  
❌ **Full parameter control** - Limited UI for tweaking backtest parameters  
❌ **Comparison mode** - Can't A/B test different configurations  
❌ **Results visualization** - Limited charting of backtest results  
❌ **Export/reporting** - No ability to export backtest reports

---

## 🏗️ CURRENT ARCHITECTURE BREAKDOWN

### 1. **Frontend Layer** (`client/src/pages/backtest.tsx`)

**File**: `e:\repos\litmajor\Scanstream\client\src\pages\backtest.tsx` (476 lines)

**Current Capabilities**:
- Strategy selection dropdown
- Symbol selection (BTC/USDT, etc.)
- Timeframe selection (1h, 4h, 1d, etc.)
- Date range picker (startDate, endDate)
- Initial capital input
- Run backtest button
- Delete backtest button
- BounceBacktestComponent integration

**UI Components**:
```tsx
- Strategy selector
- Symbol selector  
- Timeframe selector
- Date pickers
- Capital input
- Results table
- Delete action
```

**Data Flow**:
```
User Input
  ↓
runBacktestMutation (POST /api/strategies/backtest/run)
  ↓
Server processes backtest
  ↓
Results displayed in table
  ↓
Option to delete results
```

**Limitations**:
- No signal source selection
- No agent combo support
- No strategy combination
- Results shown only in table format
- Limited metrics visualization

---

### 2. **API Layer** - Multiple Routes

#### A. **Signal Backtesting** (`server/routes/signal-backtesting.ts`)

**Endpoints**:
```
POST /api/backtest/signal - Single signal backtest
POST /api/backtest/signals - Multiple signals backtest
GET /api/backtest/stats - Get statistics
```

**Features**:
- Takes raw signals + historical data
- Validates signal quality
- Calculates trade outcomes
- Returns win/loss metrics

**Limitations**:
- Doesn't integrate with Phase 5 signal sources
- No regime awareness
- No position sizing integration

---

#### B. **Historical Backtesting** (`server/routes/historical-backtest.ts`)

**Endpoints**:
```
POST /api/backtest/historical - Run 2+ years historical backtest
GET /api/backtest/historical/summary - Get cached results
```

**Features**:
- Tests across multiple assets
- Calculates Sharpe/Sortino ratios
- Identifies max drawdown
- Pattern analysis
- Algorithm quality scoring (1-10)

**Limitations**:
- Not connected to current UI
- Results not queryable by specific config
- No A/B comparison capability

---

#### C. **Flow-Field Backtesting** (`server/routes/flow-field-backtest.ts`)

**Endpoints**:
- Exists but not documented in current code

**Purpose**:
- Unclear from codebase inspection

---

### 3. **Service Layer** - Backtest Engines

#### A. **Unified Framework Backtest** (`server/services/unified-framework-backtest.ts`)

**Purpose**: Compare performance of multi-source systems

**Metrics Calculated**:
```typescript
- totalTrades
- winRate (%)
- lossRate (%)
- avgWin / avgLoss (%)
- profitFactor
- sharpeRatio
- maxDrawdown (%)
- averageReturn (%)
- totalReturn (%)
- recoveryFactor
```

**Capabilities**:
- Per-regime performance tracking
- Comparative analysis
- Trade history recording

**Limitations**:
- Focused on comparing systems, not individual backtests
- No UI integration

---

#### B. **Historical Backtester** (`server/services/historical-backtester.ts`)

**Purpose**: Validate algorithms against 2+ years of historical data

**Metrics**:
- Sharpe ratio
- Sortino ratio
- Max drawdown
- Win rate by asset
- Pattern performance

**Output**:
- Algorithm score (1-10)
- Recommendations
- Next steps
- Underperforming patterns

---

#### C. **Signal Backtester** (`server/services/signal-backtester.ts`)

**Purpose**: Test individual or batch signals

**Methods**:
- `backtestSignal()` - Single signal
- `backtestSignals()` - Multiple signals
- `getStats()` - Summary statistics

---

#### D. **LSTM Backtest Engine** (`server/services/lstm-backtest-engine.ts`)

**Purpose**: ML-based backtesting using LSTM predictions

**Current State**: Exists but unclear integration

---

### 4. **Core Backtesting Engine** (`server/backtest-runner.ts`)

**Interface**:
```typescript
interface BacktestOptions {
  initialCapital?: number;
  signals: Signal[];
  marketFrames: MarketFrame[];
  slippage?: number;
  commission?: number;
  positionSize?: number;
}
```

**Process**:
1. Takes signals + market data
2. Simulates trades using EnhancedPortfolioSimulator
3. Applies slippage and commission
4. Calculates exit points (SL/TP or next opposite signal)
5. Returns complete BacktestResult

**Limitations**:
- Generic, doesn't know about agents/strategies
- No regime awareness for position sizing

---

### 5. **Portfolio Simulator** (`server/portfolio-simulator.ts`)

**Purpose**: Core position tracking and P&L calculation

**Features**:
- Open/close positions
- Track portfolio equity
- Calculate performance metrics
- Support multiple assets

**Methods**:
- `openPosition(trade)`
- `closePosition(symbol, exitPrice, exitTime)`
- `getPerformanceMetrics()`
- `getClosedTrades()`
- `getEquityCurve()`

---

## 📋 DETAILED GAPS & REQUIREMENTS

### Gap 1: Multi-Asset Selection ❌

**Current State**:
- hardcoded `selectedSymbol` in backtest.tsx
- Limited dropdown (BTC/USDT, etc.)

**Need**:
- Select ANY asset
- Multi-asset selection (backtest SPY + QQQ + IWM together)
- Asset predefined lists (Top 10, Tech Sector, Crypto, etc.)
- Custom asset portfolios

**Implementation**:
```tsx
// NEW: AssetSelector component
<AssetSelector 
  selectedAssets={['AAPL', 'MSFT']}
  onSelect={setSelectedAssets}
  mode="multi" // or "single"
  presets={['top-10', 'tech-sector', 'crypto']}
/>
```

**Backend Support**:
- Modify backtest API to accept `assets: string[]`
- Pass assets to portfolio simulator

---

### Gap 2: Signal Source Selector ❌

**Current State**:
- No UI to choose which signals to test
- Always uses all signals by default

**Need**:
- Select individual sources: ML, Scanner, RL, RPG
- Select source combinations: ML+RL, Scanner+RPG, etc.
- Enable/disable per-source weighting
- Test signal confidence thresholds
- Compare signal quality across sources

**Implementation**:
```tsx
// NEW: SignalSourceSelector component
interface SignalSourceConfig {
  ML: { enabled: boolean; weight: number; minConfidence: number };
  SCANNER: { enabled: boolean; weight: number; minConfidence: number };
  RL: { enabled: boolean; weight: number; minConfidence: number };
  RPG: { enabled: boolean; weight: number; minConfidence: number };
}

<SignalSourceSelector 
  config={signalSourceConfig}
  onChange={setSignalSourceConfig}
/>
```

**Backend Changes**:
```typescript
// Filter signals based on selected sources
const filteredSignals = signals.filter(s => {
  const sourceConfig = config[s.source];
  return sourceConfig.enabled && s.confidence >= sourceConfig.minConfidence;
});
```

---

### Gap 3: Agent Combination Support ❌

**Current State**:
- 5 agents exist (Trend, Mean Reversion, Momentum, Breakout, Volatility)
- Can't test agents in backtest
- No agent-based backtesting UI

**Need**:
- Select single agent
- Select multiple agents (ensemble)
- Configure ensemble voting/averaging
- See per-agent contribution
- Test agent combo strategies

**Implementation**:
```tsx
// NEW: AgentSelector component
interface AgentConfig {
  agents: {
    [agentId: string]: {
      enabled: boolean;
      weight: number;
      parameters: Record<string, any>;
    }
  };
  votingStrategy: 'majority' | 'weighted_avg' | 'consensus';
}

<AgentSelector 
  config={agentConfig}
  onChange={setAgentConfig}
  availableAgents={[
    { id: 'trend-follower', name: 'Trend Follower' },
    { id: 'mean-revert', name: 'Mean Reversion' },
    // ... 5 agents total
  ]}
/>
```

**Backend Changes**:
```typescript
// Run each agent's signal generation
const agentSignals = await Promise.all(
  enabledAgents.map(agent => agent.generateSignals(marketData))
);

// Combine signals based on voting strategy
const combinedSignals = combineAgentSignals(agentSignals, votingStrategy);
```

---

### Gap 4: Strategy Combination Support ❌

**Current State**:
- 6+ strategies defined
- Can only test one at a time
- No strategy combo testing

**Need**:
- Select single strategy
- Select multiple strategies
- Configure strategy weighting
- Test strategy ensemble
- See per-strategy metrics

**Implementation**:
```tsx
// NEW: StrategySelector component
interface StrategyConfig {
  strategies: {
    [strategyId: string]: {
      enabled: boolean;
      weight: number;
      parameters: Record<string, any>;
    }
  };
  votingStrategy: 'majority' | 'weighted_avg' | 'consensus';
}

<StrategySelector 
  config={strategyConfig}
  onChange={setStrategyConfig}
  availableStrategies={STRATEGIES}
/>
```

---

### Gap 5: Parameter Control UI ❌

**Current State**:
- Only basic inputs (capital, dates)
- Can't adjust strategy parameters
- Can't tweak position sizing
- Can't adjust slippage/commission

**Need**:
- Advanced parameters panel
- Slippage/commission settings
- Position sizing method selector
- Strategy-specific parameters
- Parameter ranges for sensitivity analysis

**Implementation**:
```tsx
// NEW: AdvancedParametersPanel component
interface BacktestParameters {
  initialCapital: number;
  slippage: number; // %
  commission: number; // per trade
  positionSizingMethod: 'fixed' | 'kelly' | 'volatility_adjusted' | 'risk_parity';
  positionSizePercent: number;
  maxPositions: number;
  riskPerTrade: number; // %
  strategyParameters: Record<string, any>;
}

<AdvancedParametersPanel 
  parameters={backTestParams}
  onChange={setBackTestParams}
/>
```

---

### Gap 6: Comparison Mode ❌

**Current State**:
- Results shown one at a time
- Can't compare side-by-side

**Need**:
- Select 2-4 previous backtests to compare
- Side-by-side metrics table
- Overlay equity curves
- Drawdown comparison
- Win rate comparison

**Implementation**:
```tsx
// NEW: ComparisonMode component
interface ComparisonConfig {
  backtestIds: string[]; // 2-4 IDs
  metricsToCompare: string[]; // [sharpe, maxDrawdown, winRate, etc]
}

<ComparisonMode 
  backtestResults={backtestResults}
  comparisonConfig={comparisonConfig}
/>
```

---

### Gap 7: Results Visualization ❌

**Current State**:
- Results shown in table format only
- Limited charts

**Need**:
- Equity curve chart (with underwater plot)
- Drawdown chart
- Win/loss distribution
- Monthly returns heatmap
- Trade scatter plot (entry/exit prices)
- Performance by hour/day/month

**Implementation**:
```tsx
// NEW: BacktestVisualization component
<BacktestVisualization 
  results={backtestResult}
  charts={[
    'equity_curve',
    'drawdown',
    'monthly_returns',
    'win_loss_distribution',
    'trade_scatter',
    'performance_calendar'
  ]}
/>
```

---

### Gap 8: Export & Reporting ❌

**Current State**:
- No export functionality
- No report generation

**Need**:
- Export to CSV/PDF
- Generate HTML report
- Email report
- Save configuration for replay
- Archive old backtests

**Implementation**:
```tsx
// NEW: ReportExport component
<ReportExport 
  results={backtestResult}
  exportFormats={['csv', 'pdf', 'json']}
  onExport={handleExport}
/>
```

---

### Gap 9: Historical Data Integration ❌

**Current State**:
- Multiple backtest engines exist
- Not integrated into UI
- Can't trigger 2+ year historical backtest from UI

**Need**:
- Button to run "Full Historical Analysis"
- Show 2+ year stats separately
- Identify underperforming patterns
- Compare current system to historical baseline

**Implementation**:
```tsx
// NEW: HistoricalAnalysisPanel component
<HistoricalAnalysisPanel 
  onRunAnalysis={handleRunHistorical}
  results={historicalResults}
  algorithm_score={algorithmScore}
/>
```

---

### Gap 10: Walk-Forward Validation ❌

**Current State**:
- Only supports full period backtest
- No out-of-sample validation

**Need**:
- Split data into train/test periods
- Walk-forward optimization
- Out-of-sample performance stats
- Overfitting detection

**Implementation**:
```tsx
// NEW: WalkForwardConfig component
interface WalkForwardSettings {
  enabled: boolean;
  trainPeriod: number; // days
  testPeriod: number; // days
  step: number; // days to advance
}

<WalkForwardConfig 
  settings={walkForwardSettings}
  onChange={setWalkForwardSettings}
/>
```

---

## 🏢 CURRENT TECH STACK

### Frontend
- React (Hooks)
- React Query (data fetching)
- TailwindCSS (styling)
- Recharts (charting)
- Lucide Icons

### Backend
- Express.ts
- PostgreSQL (for caching results)
- TypeScript
- Prisma ORM

### Core Libraries
- Portfolio Simulator (custom)
- Backtest Runners (custom)
- Agent/Strategy modules (custom)

---

## 🔗 EXISTING INFRASTRUCTURE TO LEVERAGE

### 1. **Phase 5 Components** (Already Built)
- SignalTransparency.tsx - Show signal breakdown
- ExtendedAgentLeaderboard.tsx - Show agent performance
- RegimeDisplay.tsx - Market regime info
- Can be reused in backtest hub

### 2. **Database Schema** (Phase 5 migrations)
```sql
- signal_history - Store backtest signals
- agent_performance - Store agent metrics
- market_regime - Store regime data
- Can extend with backtest_runs, backtest_results tables
```

### 3. **Unified Position Sizing Engine** (Phase 5)
- `UnifiedPositionSizingEngine` in `server/lib/adaptive-position-sizer.ts`
- Already integrated into signal pipeline
- Can be used in backtest

### 4. **WebSocket Real-time Updates** (Phase 5)
- `phase5EventBridge` - Real-time event emitter
- Can emit backtest progress updates
- Enable live backtest result streaming

### 5. **API Routes Infrastructure**
- `/api/strategies` - Strategy definitions
- `/api/phase5/*` - Phase 5 data
- `/api/backtest/*` - Backtest routes
- Can add `/api/backtest/unified` for new hub

---

## 📐 PROPOSED UNIFIED BACKTEST HUB ARCHITECTURE

### New Structure:
```
client/src/pages/phase6-backtest-hub.tsx
├── Components/
│   ├── BacktestConfigPanel.tsx
│   │   ├── AssetSelector.tsx
│   │   ├── SignalSourceSelector.tsx
│   │   ├── AgentSelector.tsx
│   │   ├── StrategySelector.tsx
│   │   └── AdvancedParametersPanel.tsx
│   ├── BacktestExecutor.tsx
│   ├── BacktestResults.tsx
│   │   ├── BacktestMetricsTable.tsx
│   │   └── BacktestVisualization.tsx
│   ├── ComparisonMode.tsx
│   └── HistoricalAnalysisPanel.tsx
└── hooks/
    ├── useBacktestRunner.ts
    └── useBacktestComparison.ts

server/routes/phase6-backtest.ts
├── POST /api/backtest/unified/run - Run unified backtest
├── GET /api/backtest/unified/results - Get results
├── POST /api/backtest/unified/compare - Compare backtests
├── POST /api/backtest/unified/export - Export results
└── POST /api/backtest/unified/historical - Full historical analysis

server/services/phase6-unified-backtester.ts
├── runUnifiedBacktest()
├── generateComparisonReport()
├── runWalkForwardAnalysis()
└── validateResults()
```

---

## 🎯 IMPLEMENTATION ROADMAP

### Phase 6A: Foundation (Week 1)
- [ ] Create `phase6-backtest-hub.tsx` main page
- [ ] Build `BacktestConfigPanel` component
- [ ] Create `AssetSelector` component
- [ ] Create basic backend route: `/api/backtest/unified/run`
- [ ] Connect to existing backtest-runner.ts

**Deliverable**: Can select assets and run basic backtest

---

### Phase 6B: Signal Control (Week 1-2)
- [ ] Build `SignalSourceSelector` component
- [ ] Implement signal filtering logic
- [ ] Add signal confidence threshold control
- [ ] Update backtest API to filter signals

**Deliverable**: Can select which signals to include in backtest

---

### Phase 6C: Agent/Strategy Support (Week 2)
- [ ] Build `AgentSelector` component
- [ ] Build `StrategySelector` component
- [ ] Create agent ensemble logic
- [ ] Create strategy ensemble logic
- [ ] Update backtest engine for combos

**Deliverable**: Can test single/multiple agents and strategies

---

### Phase 6D: Parameter Control (Week 2-3)
- [ ] Build `AdvancedParametersPanel` component
- [ ] Add slippage/commission UI
- [ ] Add position sizing method selector
- [ ] Implement parameter persistence

**Deliverable**: Full control over backtest parameters

---

### Phase 6E: Visualization (Week 3)
- [ ] Build `BacktestVisualization` component
- [ ] Add equity curve chart
- [ ] Add drawdown chart
- [ ] Add monthly returns heatmap
- [ ] Add trade scatter plot

**Deliverable**: Rich visualization of backtest results

---

### Phase 6F: Comparison & Export (Week 3-4)
- [ ] Build `ComparisonMode` component
- [ ] Side-by-side results display
- [ ] Build `ReportExport` component
- [ ] CSV/JSON export
- [ ] HTML report generation

**Deliverable**: Can compare and export backtest results

---

### Phase 6G: Advanced Features (Week 4)
- [ ] Historical analysis integration
- [ ] Walk-forward validation
- [ ] Sensitivity analysis
- [ ] Parameter optimization

**Deliverable**: Production-ready Phase 6 backtest hub

---

## 📊 SUCCESS CRITERIA

### Functionality
- ✅ Can backtest any asset
- ✅ Can select any signal source(s)
- ✅ Can test agent combos
- ✅ Can test strategy combos
- ✅ Full parameter control
- ✅ Results comparison
- ✅ Rich visualization
- ✅ Export capabilities

### Performance
- Results under 10s for 1 year data
- Results under 30s for 2-5 years data
- WebSocket progress updates every 1-2s
- UI responsive during backtest

### User Experience
- Intuitive configuration panels
- Clear metric explanations
- Professional-grade reports
- Save/load configurations

---

## 🔄 DATA FLOW (Proposed)

```
User Configuration
├── Asset Selection
├── Signal Source Selection
├── Agent Selection
├── Strategy Selection
└── Advanced Parameters

↓

Backend Processing
├── Fetch historical market data
├── Generate signals from selected sources
├── Run agent logic (if selected)
├── Run strategy logic (if selected)
├── Run unified backtest
└── Calculate metrics

↓

Real-time Updates
├── WebSocket progress: "Processing 100/365 days"
├── WebSocket update: "Equity: $12,450 (+24.5%)"
└── WebSocket completion: "Backtest complete"

↓

Result Display
├── Metrics table
├── Equity curve chart
├── Drawdown chart
├── Trade details
└── Export options

↓

Comparison/Export
├── Store in database
├── Compare with previous runs
├── Generate reports
└── Download/email results
```

---

## 📚 KEY FILES TO EXTEND

### Frontend
1. **client/src/pages/backtest.tsx** (476 lines)
   - Extend or create new phase6-backtest-hub.tsx
   - Add all new components

2. **client/src/components/** (NEW)
   - AssetSelector.tsx
   - SignalSourceSelector.tsx
   - AgentSelector.tsx
   - StrategySelector.tsx
   - AdvancedParametersPanel.tsx
   - BacktestVisualization.tsx
   - ComparisonMode.tsx
   - etc.

### Backend
1. **server/routes/strategies.ts** (900 lines)
   - Already has strategy definitions
   - Add agent definitions

2. **server/routes/phase6-backtest.ts** (NEW)
   - Create unified backtest routes
   - Handle multi-source/agent/strategy configs

3. **server/services/phase6-unified-backtester.ts** (NEW)
   - Core backtest logic
   - Signal filtering
   - Agent/strategy ensemble
   - Result aggregation

4. **server/backtest-runner.ts** (EXTEND)
   - Already exists
   - Add agent/strategy integration

---

## 🚀 NEXT STEPS

1. **Review this audit document** with requirements
2. **Decision**: Extend backtest.tsx or create phase6-backtest-hub.tsx?
3. **Prioritize gaps** - Which features are most critical?
4. **Start Phase 6A** - Foundation implementation
5. **Iterative rollout** - Build feature by feature

---

**Document Version**: 1.0  
**Last Updated**: December 18, 2025  
**Status**: Ready for Implementation Planning
