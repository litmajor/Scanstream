# VFMD Multi-Timeframe Enhancement - Architecture Analysis

## Current Architecture Understanding

### Core Components

**1. VFMDPhysicsAgent** (`server/services/rpg-agents/VFMDPhysicsAgent.ts`)
- Extends TradingAgent (RPG base class)
- Main entry point: `generateSignal(ticks: MarketTick[])`
- Current limitation: **Only processes single timeframe at a time**
- Calls `analyzeVFMD(ticks)` which does:
  - Constructs vector field from prices
  - Computes physics metrics (PEG, Turbulence, Coherence, etc.)
  - Classifies market regime
  - Calculates TRIGGER constraint state
  - Estimates profit potential

**2. Analysis Pipeline** (5-Layer Physics)
```
Input: MarketTick[]
  ↓
[Layer 1] STATE - RegimeClassifier.classify()
  ↓
[Layer 2] ENERGY - PhysicsCalculator.computeAllMetrics() [PEG]
  ↓
[Layer 3] PERMISSION - TriggerCalculator.computeTrigger()
  ↓
[Layer 4] DIRECTION - ProfitEstimator.estimateProfit()
  ↓
[Layer 5] PROFIT - GenerateSignal() [sizing, confidence]
```

**3. Key Classes**
- `FieldConstructor`: Builds 2D vector field from price series
- `PhysicsCalculator`: Computes PEG, Turbulence, Coherence, etc.
- `RegimeClassifier`: Classifies FlowRegime (LAMINAR_TREND, CONSOLIDATION, etc.)
- `TriggerCalculator`: Detects constraint failures (liquidityFailure, structuralBreak)
- `EarlyEntryDetector`: Supplementary entry signal generation
- `ProfitEstimator`: Risk/reward and profit potential scoring

**4. Data Flow**
```
1-hour candles → analyzeVFMD() → generateSignal() → AgentSignal (BUY/SELL/HOLD)
```

### Current Limitation

The agent processes **one timeframe at a time** (currently 1h). To support multi-timeframe:
- Would need to accept data from multiple timeframes
- Would need to cross-confirm signals across timeframes
- Would need to weight signals by timeframe importance

### Types & Interfaces

**MarketTick** (what flows in):
```typescript
{
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bidVolume?: number;  // From orderflow data
  askVolume?: number;  // From orderflow data
}
```

**AgentSignal** (what flows out):
```typescript
{
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entry: number;
  target: number;
  stop: number;
  reason: string;
  agent_name: string;
  agent_level: number;
  size_multiplier?: number;
  estimated_duration_hours?: number;
}
```

## Multi-Timeframe Enhancement Strategy

### Option A: Sequential Processing (Recommended for VFMD)
```typescript
// Process each timeframe independently, then fuse results
const signals = new Map<string, AgentSignal>();

for (const timeframe of ['5m', '15m', '1h', '4h', '1d']) {
  const candles = multiTFData.get(symbol).get(timeframe);
  const signal = agent.generateSignal(candles);
  signals.set(timeframe, signal);
}

// Fuse signals: weight by timeframe importance
const fusedSignal = fuseMultiTimeframeSignals(signals);
```

**Advantages:**
- Leverages existing single-TF analysis perfectly
- Physics-based (VFMD works naturally on any timeframe)
- Easy to debug (see each TF's analysis)
- Asset-specific thresholds already per-TF
- Confidence increases with multi-TF alignment

**Implementation:**
1. Create `analyzeMultiTimeframe(symbol, multiTFData)` method
2. For each timeframe, call existing `generateSignal(candles)`
3. Implement `fuseSignals()` that:
   - Checks alignment across timeframes
   - Weights by timeframe (1d > 4h > 1h > etc.)
   - Boosts confidence if all TFs agree
   - Flags conflicts (e.g., 1h SELL but 1d BUY)

### Option B: Hybrid Field Construction
```typescript
// Build combined field from multiple timeframes
// Weight higher timeframes more heavily
const combinedField = constructHybridField(
  candles_1h, candles_4h, candles_1d,
  weights: [1.0, 1.5, 2.0]
);
const metrics = computeMetrics(combinedField);
```

**Advantages:**
- Single unified analysis
- Natural timeframe weighting
- Captures inter-TF relationships

**Disadvantages:**
- More complex field construction
- Need to synchronize different-length candle series
- Harder to debug failures

## Recommended Implementation Path

### Step 1: Data Preparation
Modify BinanceDataFetcher (already supports multi-TF):
```typescript
// Already fetches all TF data
const data = await fetcher.fetchMultiTimeframeData(
  ['BTCUSDT'],
  365,
  true  // Include orderflow
);
// Returns: Map<symbol, Map<timeframe, MarketTick[]>>
```

### Step 2: Multi-Timeframe Analysis Method
Add to VFMDPhysicsAgent:
```typescript
analyzeMultiTimeframe(
  symbol: string,
  timeframeData: Map<string, MarketTick[]>
): MultiTimeframeAnalysis {
  const timeframes = ['5m', '15m', '1h', '4h', '1d'];
  const analyses = new Map<string, Analysis>();
  
  for (const tf of timeframes) {
    const candles = timeframeData.get(tf);
    if (candles && candles.length >= 100) {
      analyses.set(tf, this.analyzeVFMD(candles));
    }
  }
  
  return {
    individual: analyses,
    fused: fuseAnalyses(analyses),
    timestamp: Date.now()
  };
}
```

### Step 3: Signal Fusion
```typescript
private fuseMultiTimeframeSignals(
  signals: Map<string, AgentSignal>
): AgentSignal {
  const timeframeWeights = {
    '5m': 1.0,
    '15m': 1.2,
    '1h': 1.5,
    '4h': 2.0,
    '1d': 3.0
  };
  
  // Check alignment and boost confidence
  // Weight by timeframe importance
  // Return fused signal
}
```

### Step 4: Integration Points
- VFMDPhysicsAgent.analyzeMultiTimeframe() → new method
- VFMDPhysicsAgent.generateSignal() → keep as single-TF for compatibility
- Add new method: VFMDPhysicsAgent.generateMultiTimeframeSignal()
- Backtester to support multi-TF analysis

## Expected Benefits

1. **Stronger Signals**: BUY if 1h, 4h, 1d all aligned
2. **Better Regime Detection**: Daily timeframe shows true regime
3. **Improved Risk Management**: Hourly TRIGGER + daily PEG
4. **Realistic Backtesting**: Test on full TF spectrum
5. **Entry Quality**: Daily permission + hourly timing
6. **Exit Signals**: Use 4h/1d for stop placement, 1h for profit-taking

## No Architecture Changes Needed

The current architecture is **already well-designed**:
- ✅ MarketTick interface supports both single and multi-TF
- ✅ Physics calculations work on any timeframe
- ✅ Regime classification is timeframe-aware
- ✅ Asset-specific thresholds allow customization
- ✅ AgentSignal format supports multi-TF reasoning

Just need to add **one orchestration layer** to coordinate across timeframes.

## Timeline

1. **Phase 1** (1-2 hours): Implement analyzeMultiTimeframe()
2. **Phase 2** (1 hour): Implement signal fusion logic
3. **Phase 3** (1 hour): Update backtester for multi-TF
4. **Phase 4** (30 min): Test on 1-year data
5. **Phase 5** (30 min): Tune fusion weights and thresholds

Total: ~4 hours for full multi-timeframe VFMD system
