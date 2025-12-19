# 🛠️ PHASE 6: TECHNICAL SPECIFICATIONS & IMPLEMENTATION GUIDE

**Date**: December 18, 2025  
**Status**: Ready for Implementation

---

## 📋 TABLE OF CONTENTS

1. [Database Schema Extensions](#database-schema-extensions)
2. [Component Specifications](#component-specifications)
3. [API Specifications](#api-specifications)
4. [Service Layer Design](#service-layer-design)
5. [Data Models](#data-models)
6. [Integration Points](#integration-points)
7. [Code Examples](#code-examples)

---

## 💾 DATABASE SCHEMA EXTENSIONS

### New Tables Required

#### 1. **backtest_configurations**
```sql
CREATE TABLE backtest_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by VARCHAR(100),
  
  -- Time Period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Assets
  assets TEXT[] NOT NULL, -- ['AAPL', 'MSFT', 'SPY']
  
  -- Signal Config
  signal_sources JSONB NOT NULL, -- { "ML": { "enabled": true, "weight": 0.35, "minConfidence": 0.7 }, ... }
  
  -- Agent Config
  agents JSONB NOT NULL, -- { "trend-follower": { "enabled": true, "weight": 0.25 }, ... }
  
  -- Strategy Config
  strategies JSONB NOT NULL, -- { "gradient-trend": { "enabled": true, "parameters": {...} }, ... }
  
  -- Backtest Parameters
  initial_capital DECIMAL(12, 2) NOT NULL DEFAULT 10000.00,
  slippage_percent DECIMAL(5, 4) NOT NULL DEFAULT 0.001,
  commission_per_trade DECIMAL(10, 4) NOT NULL DEFAULT 0.0,
  position_sizing_method VARCHAR(50) CHECK (position_sizing_method IN ('fixed', 'kelly', 'volatility_adjusted', 'risk_parity')) DEFAULT 'fixed',
  position_size_percent DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
  max_positions INTEGER DEFAULT 5,
  risk_per_trade_percent DECIMAL(5, 2) DEFAULT 1.0,
  
  -- Walk-Forward Settings
  enable_walk_forward BOOLEAN DEFAULT FALSE,
  train_period_days INTEGER,
  test_period_days INTEGER,
  walk_forward_step_days INTEGER,
  
  -- Status
  is_template BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_configs_created_by ON backtest_configurations(created_by);
CREATE INDEX idx_backtest_configs_created_at ON backtest_configurations(created_at DESC);
```

#### 2. **backtest_runs**
```sql
CREATE TABLE backtest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  configuration_id UUID NOT NULL REFERENCES backtest_configurations(id),
  
  -- Status
  status VARCHAR(20) CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
  progress_percent INTEGER DEFAULT 0,
  
  -- Results Summary
  final_capital DECIMAL(12, 2),
  total_return_percent DECIMAL(8, 4),
  annual_return_percent DECIMAL(8, 4),
  max_drawdown_percent DECIMAL(8, 4),
  sharpe_ratio DECIMAL(8, 4),
  sortino_ratio DECIMAL(8, 4),
  calmar_ratio DECIMAL(8, 4),
  win_rate_percent DECIMAL(8, 4),
  profit_factor DECIMAL(8, 4),
  total_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  avg_win DECIMAL(10, 4),
  avg_loss DECIMAL(10, 4),
  
  -- Detailed Results
  results JSONB, -- Full detailed backtest results
  
  -- Error Info
  error_message TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_runs_config ON backtest_runs(configuration_id);
CREATE INDEX idx_backtest_runs_status ON backtest_runs(status);
CREATE INDEX idx_backtest_runs_completed ON backtest_runs(completed_at DESC);
```

#### 3. **backtest_trades**
```sql
CREATE TABLE backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  backtest_run_id UUID NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
  
  -- Trade Details
  symbol VARCHAR(20) NOT NULL,
  entry_price DECIMAL(12, 4) NOT NULL,
  exit_price DECIMAL(12, 4),
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  quantity DECIMAL(12, 4) NOT NULL,
  side VARCHAR(10) CHECK (side IN ('BUY', 'SELL')) NOT NULL,
  
  -- P&L
  entry_value DECIMAL(12, 2) NOT NULL,
  exit_value DECIMAL(12, 2),
  profit_loss DECIMAL(12, 2),
  profit_loss_percent DECIMAL(8, 4),
  
  -- Trade Info
  signal_source VARCHAR(50), -- 'ML', 'SCANNER', 'RL', 'RPG', 'STRATEGY', 'AGENT'
  strategy_id VARCHAR(100),
  agent_id VARCHAR(100),
  reason TEXT, -- Why trade was entered/exited
  duration_minutes INTEGER,
  status VARCHAR(20) CHECK (status IN ('open', 'closed', 'cancelled')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_trades_run ON backtest_trades(backtest_run_id);
CREATE INDEX idx_backtest_trades_symbol ON backtest_trades(symbol);
CREATE INDEX idx_backtest_trades_entry_time ON backtest_trades(entry_time DESC);
```

#### 4. **backtest_comparisons**
```sql
CREATE TABLE backtest_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Comparison Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Runs Being Compared
  backtest_run_ids UUID[] NOT NULL, -- Array of 2-4 run IDs
  
  -- Comparison Analysis
  metrics_compared JSONB, -- Which metrics to compare
  winner_run_id UUID, -- Which run had best performance
  analysis_summary TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_comparisons_runs ON backtest_comparisons USING GIN(backtest_run_ids);
```

---

## 🎨 COMPONENT SPECIFICATIONS

### AssetSelector Component

**File**: `client/src/components/phase6/AssetSelector.tsx`

**Props**:
```typescript
interface AssetSelectorProps {
  selectedAssets: string[];
  onSelect: (assets: string[]) => void;
  mode?: 'single' | 'multi'; // default: 'multi'
  
  // Presets
  presets?: {
    label: string;
    assets: string[];
  }[];
  
  // Search/filter
  searchable?: boolean;
  showHistory?: boolean;
}
```

**Features**:
- Multi-select asset picker
- Search functionality
- Preset asset groups (Top 10, Tech Sector, Crypto, etc.)
- Recent assets list
- Asset info popover (current price, 52w high/low)

**State**:
```typescript
const [selectedAssets, setSelectedAssets] = useState<string[]>(['AAPL']);
const [searchTerm, setSearchTerm] = useState('');
const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
```

---

### SignalSourceSelector Component

**File**: `client/src/components/phase6/SignalSourceSelector.tsx`

**Props**:
```typescript
interface SignalSourceConfig {
  ML: { enabled: boolean; weight: number; minConfidence: number };
  SCANNER: { enabled: boolean; weight: number; minConfidence: number };
  RL: { enabled: boolean; weight: number; minConfidence: number };
  RPG: { enabled: boolean; weight: number; minConfidence: number };
}

interface SignalSourceSelectorProps {
  config: SignalSourceConfig;
  onChange: (config: SignalSourceConfig) => void;
  showWeightingHelp?: boolean;
  showHistoricalAccuracy?: boolean;
}
```

**Features**:
- Enable/disable each source
- Adjust weight per source (0-1)
- Set minimum confidence threshold (0-100)
- Show historical accuracy per source
- Visual representation of weighting

**Display**:
```tsx
ML         [✓] Weight: 35% Confidence: 70%  [Historical Win Rate: 58%]
SCANNER    [✓] Weight: 20% Confidence: 50%  [Historical Win Rate: 52%]
RL         [✗] Weight:  0% Confidence:  0%  [Historical Win Rate: 54%]
RPG        [✓] Weight: 15% Confidence: 60%  [Historical Win Rate: 48%]
```

---

### AgentSelector Component

**File**: `client/src/components/phase6/AgentSelector.tsx`

**Props**:
```typescript
interface AgentConfig {
  agents: {
    [agentId: string]: {
      enabled: boolean;
      weight: number;
      parameters: Record<string, any>;
    }
  };
  votingStrategy: 'majority' | 'weighted_avg' | 'unanimous' | 'consensus_threshold';
  consensusThreshold?: number; // For consensus_threshold voting
}

interface AgentSelectorProps {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  availableAgents: Agent[];
  showHistoricalPerformance?: boolean;
}
```

**Available Agents**:
```typescript
[
  {
    id: 'trend-follower-1',
    name: 'Trend Follower',
    strategy: 'TREND_FOLLOWING',
    winRate: 68,
    avgReturn: 4.2,
    sharpeRatio: 1.8
  },
  // ... 4 more agents
]
```

**Features**:
- Enable/disable individual agents
- Set agent weights in ensemble
- Choose voting strategy
- Agent parameter tuning
- See historical performance metrics
- Live agent leaderboard integration

---

### StrategySelector Component

**File**: `client/src/components/phase6/StrategySelector.tsx`

**Props**:
```typescript
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

interface StrategySelectorProps {
  config: StrategyConfig;
  onChange: (config: StrategyConfig) => void;
  availableStrategies: Strategy[];
  showParameters?: boolean;
}
```

**Available Strategies** (from `server/routes/strategies.ts`):
```typescript
[
  {
    id: 'gradient_trend_filter',
    name: 'Gradient Trend Filter',
    type: 'Trend Following',
    winRate: 68,
    sharpeRatio: 1.8,
    parameters: {
      fast_period: { type: 'number', default: 10, min: 5, max: 50 },
      slow_period: { type: 'number', default: 50, min: 20, max: 200 },
      threshold: { type: 'number', default: 0.002, min: 0.001, max: 0.01 }
    }
  },
  // ... 5+ more strategies
]
```

**Features**:
- Enable/disable strategies
- Adjust strategy weights
- Configure strategy-specific parameters
- Parameter range sliders
- Reset to defaults
- Performance history per strategy

---

### AdvancedParametersPanel Component

**File**: `client/src/components/phase6/AdvancedParametersPanel.tsx`

**Props**:
```typescript
interface BacktestParameters {
  initialCapital: number;
  slippage: number; // %
  commission: number; // per trade
  positionSizingMethod: 'fixed' | 'kelly' | 'volatility_adjusted' | 'risk_parity';
  positionSizePercent: number;
  maxPositions: number;
  riskPerTrade: number; // %
  
  // Walk-Forward
  enableWalkForward: boolean;
  trainPeriodDays: number;
  testPeriodDays: number;
  walkForwardStepDays: number;
}

interface AdvancedParametersPanelProps {
  parameters: BacktestParameters;
  onChange: (params: BacktestParameters) => void;
  showHelp?: boolean;
  showWalkForward?: boolean;
}
```

**Sections**:
1. Capital & Risk
2. Costs (Slippage, Commission)
3. Position Sizing
4. Walk-Forward Settings

---

### BacktestVisualization Component

**File**: `client/src/components/phase6/BacktestVisualization.tsx`

**Props**:
```typescript
interface BacktestResult {
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: Array<{ timestamp: Date; value: number }>;
  drawdowns: Array<{ timestamp: Date; drawdown: number }>;
  monthlyReturns: Record<string, number>;
  performanceByAsset: Record<string, BacktestMetrics>;
}

interface BacktestVisualizationProps {
  results: BacktestResult;
  charts?: ('equity_curve' | 'drawdown' | 'monthly' | 'distribution' | 'scatter' | 'calendar')[];
  height?: number;
}
```

**Charts** (using Recharts):
1. **Equity Curve** - Line chart with underwater plot
2. **Drawdown** - Negative area chart
3. **Monthly Returns** - Bar chart
4. **Win/Loss Distribution** - Histogram
5. **Trade Scatter** - Scatter plot of entry/exit prices
6. **Performance Calendar** - Heatmap of monthly returns

---

### ComparisonMode Component

**File**: `client/src/components/phase6/ComparisonMode.tsx`

**Props**:
```typescript
interface ComparisonConfig {
  backtestIds: string[]; // 2-4 IDs
  metricsToCompare?: string[]; // Default: all major metrics
}

interface ComparisonModeProps {
  backtestResults: BacktestResult[];
  comparisonConfig: ComparisonConfig;
  onExport?: (data: any) => void;
}
```

**Display**:
```
Metrics          | Backtest 1  | Backtest 2  | Backtest 3  | Winner
─────────────────┼─────────────┼─────────────┼─────────────┼──────
Total Return     | +28.5%      | +32.1%      | +24.3%      | ✓
Sharpe Ratio     | 1.45        | 1.62        | 1.28        | ✓
Max Drawdown     | -12.3%      | -15.2%      | -10.5%      | ✓
Win Rate         | 62%         | 58%         | 65%         | ✓
...
```

---

## 🔌 API SPECIFICATIONS

### Core Backtest Endpoint

**Route**: `POST /api/backtest/unified/run`

**Request Body**:
```typescript
{
  // Config Reference
  configurationId?: string; // If using saved config
  
  // Assets
  assets: string[];
  
  // Time Period
  startDate: string; // ISO 8601
  endDate: string;
  
  // Signal Configuration
  signalSources: {
    ML?: { enabled: boolean; weight: number; minConfidence: number };
    SCANNER?: { enabled: boolean; weight: number; minConfidence: number };
    RL?: { enabled: boolean; weight: number; minConfidence: number };
    RPG?: { enabled: boolean; weight: number; minConfidence: number };
  };
  
  // Agent Configuration
  agents?: {
    [agentId: string]: {
      enabled: boolean;
      weight: number;
      parameters?: Record<string, any>;
    }
  };
  agentVotingStrategy?: 'majority' | 'weighted_avg' | 'unanimous';
  
  // Strategy Configuration
  strategies?: {
    [strategyId: string]: {
      enabled: boolean;
      weight: number;
      parameters?: Record<string, any>;
    }
  };
  strategyVotingStrategy?: 'majority' | 'weighted_avg' | 'consensus';
  
  // Backtest Parameters
  initialCapital: number;
  slippage: number;
  commission: number;
  positionSizingMethod: 'fixed' | 'kelly' | 'volatility_adjusted' | 'risk_parity';
  positionSizePercent: number;
  maxPositions?: number;
  riskPerTrade?: number;
  
  // Walk-Forward
  enableWalkForward?: boolean;
  trainPeriodDays?: number;
  testPeriodDays?: number;
  walkForwardStepDays?: number;
}
```

**Response**:
```typescript
{
  success: boolean;
  backtestRunId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  results?: {
    metrics: BacktestMetrics;
    trades: Trade[];
    equityCurve: EquityCurvePoint[];
    monthlyReturns: Record<string, number>;
    performanceByAsset: Record<string, BacktestMetrics>;
    performanceBySource: Record<string, BacktestMetrics>;
  };
  error?: string;
  estimatedTimeRemaining?: number; // seconds
}
```

---

### Progress Streaming (WebSocket)

**Event**: `backtest:progress`

```typescript
{
  type: 'backtest:progress',
  backtestRunId: string,
  progress: number, // 0-100
  status: string, // "Processing 150/365 days..."
  currentMetrics?: {
    equity: number;
    returnPercent: number;
    trades: number;
    winRate: number;
  }
}
```

---

### Comparison Endpoint

**Route**: `POST /api/backtest/unified/compare`

**Request**:
```typescript
{
  backtestIds: string[]; // 2-4 IDs
  metricsToCompare?: string[];
}
```

**Response**:
```typescript
{
  success: boolean;
  comparisonId: string;
  results: {
    [backtestId: string]: BacktestResult;
  };
  comparison: {
    bestByMetric: Record<string, string>; // metric → backtestId
    summary: string;
    recommendations: string[];
  };
}
```

---

### Export Endpoint

**Route**: `POST /api/backtest/unified/export`

**Request**:
```typescript
{
  backtestRunId: string;
  format: 'csv' | 'json' | 'pdf' | 'html';
  includeCharts?: boolean;
  includeTradeDetails?: boolean;
}
```

**Response**: File download (CSV/JSON/PDF/HTML)

---

## 🏢 SERVICE LAYER DESIGN

### Phase6UnifiedBacktester Service

**File**: `server/services/phase6-unified-backtester.ts`

```typescript
export class Phase6UnifiedBacktester {
  /**
   * Main entry point for unified backtesting
   */
  async runUnifiedBacktest(config: BacktestConfig): Promise<BacktestResult> {
    // 1. Fetch historical data for all assets
    const historicalData = await this.fetchHistoricalData(
      config.assets,
      config.startDate,
      config.endDate
    );

    // 2. Generate/filter signals from selected sources
    const signals = await this.generateSignals(
      historicalData,
      config.signalSources
    );

    // 3. Generate signals from agents (if enabled)
    if (config.agents) {
      const agentSignals = await this.generateAgentSignals(
        historicalData,
        config.agents
      );
      signals.push(...agentSignals);
    }

    // 4. Generate signals from strategies (if enabled)
    if (config.strategies) {
      const strategySignals = await this.generateStrategySignals(
        historicalData,
        config.strategies
      );
      signals.push(...strategySignals);
    }

    // 5. Combine signals based on voting strategy
    const combinedSignals = this.combineSignals(signals, config);

    // 6. Run core backtest engine
    const result = await this.runBacktest(
      historicalData,
      combinedSignals,
      config
    );

    // 7. Calculate comprehensive metrics
    result.metrics = this.calculateMetrics(result.trades);

    // 8. Store results in database
    await this.storeResults(result);

    return result;
  }

  /**
   * Fetch historical market data
   */
  private async fetchHistoricalData(
    assets: string[],
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalData> {
    // Query database or external API
    // Return: { [symbol]: MarketFrame[] }
  }

  /**
   * Generate and filter signals from selected sources
   */
  private async generateSignals(
    data: HistoricalData,
    config: SignalSourceConfig
  ): Promise<Signal[]> {
    const signals: Signal[] = [];

    // ML Signals
    if (config.ML.enabled) {
      const mlSignals = await this.mlEngine.generateSignals(data);
      signals.push(
        ...mlSignals.filter(s => s.confidence >= config.ML.minConfidence)
      );
    }

    // Scanner Signals
    if (config.SCANNER.enabled) {
      const scannerSignals = await this.scanner.generateSignals(data);
      signals.push(
        ...scannerSignals.filter(s => s.confidence >= config.SCANNER.minConfidence)
      );
    }

    // RL Signals
    if (config.RL.enabled) {
      const rlSignals = await this.rlEngine.generateSignals(data);
      signals.push(
        ...rlSignals.filter(s => s.confidence >= config.RL.minConfidence)
      );
    }

    // RPG Signals (from Phase 5)
    if (config.RPG.enabled) {
      const rpgSignals = await this.rpgEngine.generateSignals(data);
      signals.push(
        ...rpgSignals.filter(s => s.confidence >= config.RPG.minConfidence)
      );
    }

    return signals;
  }

  /**
   * Generate signals from agent ensemble
   */
  private async generateAgentSignals(
    data: HistoricalData,
    config: AgentConfig
  ): Promise<Signal[]> {
    const enabledAgents = Object.entries(config.agents)
      .filter(([_, cfg]) => cfg.enabled)
      .map(([id, cfg]) => ({ id, ...cfg }));

    const agentSignalSets = await Promise.all(
      enabledAgents.map(agent =>
        this.agents[agent.id].generateSignals(data, agent.parameters)
      )
    );

    return this.combineAgentSignals(
      agentSignalSets,
      enabledAgents,
      config.votingStrategy
    );
  }

  /**
   * Combine signals based on voting strategy
   */
  private combineSignals(signals: Signal[], config: BacktestConfig): Signal[] {
    // Group signals by timestamp and symbol
    const grouped = this.groupSignals(signals);

    const combined: Signal[] = [];

    for (const [key, groupedSignals] of grouped) {
      if (groupedSignals.length === 0) continue;

      // Calculate weighted vote
      const buys = groupedSignals.filter(s => s.type === 'BUY').length;
      const sells = groupedSignals.filter(s => s.type === 'SELL').length;

      let decision: 'BUY' | 'SELL' | null = null;
      let confidence = 0;

      if (config.votingStrategy === 'majority') {
        decision = buys > sells ? 'BUY' : sells > buys ? 'SELL' : null;
        confidence = Math.max(buys, sells) / groupedSignals.length;
      } else if (config.votingStrategy === 'weighted_avg') {
        const avgConfidence =
          groupedSignals.reduce((sum, s) => sum + s.confidence, 0) /
          groupedSignals.length;
        const avgSignal =
          groupedSignals.reduce((sum, s) => sum + (s.type === 'BUY' ? 1 : -1), 0) /
          groupedSignals.length;
        decision = avgSignal > 0 ? 'BUY' : 'SELL';
        confidence = Math.abs(avgSignal) * avgConfidence;
      }

      if (decision) {
        combined.push({
          ...groupedSignals[0],
          type: decision,
          confidence
        });
      }
    }

    return combined;
  }

  /**
   * Calculate comprehensive backtest metrics
   */
  private calculateMetrics(trades: Trade[]): BacktestMetrics {
    // Reuse existing metric calculation logic from Phase 5/unified-framework-backtest.ts
    // Add per-source, per-asset breakdown
  }

  /**
   * Generate comparison report
   */
  async generateComparisonReport(backtestIds: string[]): Promise<ComparisonReport> {
    const results = await Promise.all(
      backtestIds.map(id => this.getBacktestResult(id))
    );

    return {
      bestByMetric: this.findBestPerMetric(results),
      summary: this.generateSummary(results),
      recommendations: this.generateRecommendations(results)
    };
  }

  /**
   * Run walk-forward analysis
   */
  async runWalkForwardAnalysis(config: BacktestConfig): Promise<WalkForwardResult> {
    const { startDate, endDate, trainPeriodDays, testPeriodDays, walkForwardStepDays } = config;

    const results: BacktestResult[] = [];
    let currentDate = startDate;

    while (currentDate < endDate) {
      const trainEnd = new Date(currentDate.getTime() + trainPeriodDays * 24 * 60 * 60 * 1000);
      const testEnd = new Date(trainEnd.getTime() + testPeriodDays * 24 * 60 * 60 * 1000);

      // Run backtest on train period (or optimize if parameters allowed)
      // Evaluate on test period
      const result = await this.runUnifiedBacktest({
        ...config,
        startDate: currentDate,
        endDate: testEnd
      });

      results.push(result);
      currentDate = new Date(currentDate.getTime() + walkForwardStepDays * 24 * 60 * 60 * 1000);
    }

    return {
      results,
      outOfSampleMetrics: this.aggregateOutOfSample(results),
      overfittingDetection: this.detectOverfitting(results)
    };
  }
}
```

---

## 📊 DATA MODELS

### TypeScript Interfaces

```typescript
// === BACKTEST CONFIGURATION ===

interface BacktestConfig {
  assets: string[];
  startDate: Date;
  endDate: Date;

  signalSources: {
    [source: string]: {
      enabled: boolean;
      weight: number;
      minConfidence: number;
    }
  };

  agents?: {
    [agentId: string]: {
      enabled: boolean;
      weight: number;
      parameters?: Record<string, any>;
    }
  };
  agentVotingStrategy?: 'majority' | 'weighted_avg' | 'unanimous';

  strategies?: {
    [strategyId: string]: {
      enabled: boolean;
      weight: number;
      parameters?: Record<string, any>;
    }
  };
  strategyVotingStrategy?: 'majority' | 'weighted_avg';

  initialCapital: number;
  slippage: number;
  commission: number;
  positionSizingMethod: 'fixed' | 'kelly' | 'volatility_adjusted' | 'risk_parity';
  positionSizePercent: number;
  maxPositions?: number;
  riskPerTrade?: number;

  enableWalkForward?: boolean;
  trainPeriodDays?: number;
  testPeriodDays?: number;
  walkForwardStepDays?: number;
}

// === BACKTEST RESULTS ===

interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  averageReturn: number;
  totalReturn: number;
  annualizedReturn: number;
  recoveryFactor: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  quantity: number;
  profitLoss: number;
  profitLossPercent: number;
  duration: number; // minutes
  signalSource: string;
  strategyId?: string;
  agentId?: string;
}

interface BacktestResult {
  id: string;
  configurationId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: Array<{ timestamp: Date; value: number }>;
  drawdowns: Array<{ timestamp: Date; drawdown: number }>;
  monthlyReturns: Record<string, number>;
  performanceByAsset: Record<string, BacktestMetrics>;
  performanceBySource: Record<string, BacktestMetrics>;
  finalCapital: number;
  totalReturn: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// === WALK-FORWARD ===

interface WalkForwardResult {
  results: BacktestResult[];
  outOfSampleMetrics: BacktestMetrics;
  overfittingDetection: {
    insampleSharpe: number;
    outOfSampleSharpe: number;
    overfittingScore: number; // 0-1, higher = more overfitting
    recommendation: string;
  };
}
```

---

## 🔗 INTEGRATION POINTS

### 1. Phase 5 Signal Integration
- Use existing `/api/phase5/signal-transparency` for ML signals
- Use signal_history table for historical signal data
- Leverage unified signal weighting system

### 2. Agent Integration
- Use existing 5 RPG agents from Phase 5
- Integrate with agent_performance table
- Use agent ranking for weighting

### 3. Strategy Integration
- Use 6+ existing strategies from `server/routes/strategies.ts`
- Map strategy parameters to UI

### 4. Database Integration
- Store configurations in `backtest_configurations` table
- Store runs in `backtest_runs` table
- Store individual trades in `backtest_trades` table

### 5. Real-time Updates
- Use Phase 5 WebSocket bridge for progress
- Emit `backtest:progress` events
- Update UI with live metrics

---

## 💻 CODE EXAMPLES

### Example: Running Unified Backtest from Frontend

```typescript
// client/src/pages/phase6-backtest-hub.tsx

const handleRunBacktest = async () => {
  setIsRunning(true);
  
  try {
    const response = await fetch('/api/backtest/unified/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assets: selectedAssets,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        
        signalSources: signalSourceConfig,
        agents: agentConfig,
        strategies: strategyConfig,
        
        initialCapital,
        slippage,
        commission,
        positionSizingMethod,
        positionSizePercent
      })
    });

    const result = await response.json();
    setBacktestResult(result);
    
    // Poll for updates
    pollBacktestProgress(result.backtestRunId);
    
  } finally {
    setIsRunning(false);
  }
};
```

### Example: WebSocket Progress Monitoring

```typescript
// client/src/hooks/useBacktestProgress.ts

export function useBacktestProgress(backtestRunId: string) {
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/events`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'backtest:progress' && data.backtestRunId === backtestRunId) {
        setProgress(data.progress);
        setMetrics(data.currentMetrics);
      }
    };

    return () => ws.close();
  }, [backtestRunId]);

  return { progress, metrics };
}
```

### Example: Signal Combination Logic

```typescript
// server/services/phase6-unified-backtester.ts

private combineAgentSignals(
  agentSignalSets: Signal[][],
  agents: AgentConfig[],
  votingStrategy: string
): Signal[] {
  const combined: Signal[] = [];

  // Group by timestamp + symbol
  const grouped = new Map<string, Signal[]>();

  for (const signals of agentSignalSets) {
    for (const signal of signals) {
      const key = `${signal.timestamp}-${signal.symbol}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(signal);
    }
  }

  // Vote on each group
  for (const [_, groupSignals] of grouped) {
    if (votingStrategy === 'majority') {
      const buys = groupSignals.filter(s => s.type === 'BUY').length;
      const sells = groupSignals.filter(s => s.type === 'SELL').length;

      if (buys > sells) {
        const avgConfidence = groupSignals
          .filter(s => s.type === 'BUY')
          .reduce((sum, s) => sum + s.confidence, 0) / buys;

        combined.push({
          ...groupSignals[0],
          type: 'BUY',
          confidence: avgConfidence,
          source: 'AGENT_ENSEMBLE'
        });
      }
    }
  }

  return combined;
}
```

---

**End of Technical Specifications**

**Next Steps**: Use these specifications to implement Phase 6 unified backtest hub
