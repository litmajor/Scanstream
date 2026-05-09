# 📊 Orderbook & Microstructure Data Analysis

## Executive Summary

Your system has **comprehensive orderbook and microstructure infrastructure** with:
- **OrderBook interface**: Simple bid/ask depth structure
- **MarketMicrostructure embedded in MarketFrame**: Spread, depth, imbalance, toxicity metrics
- **4 services consuming microstructure data**: Exit optimizer, exit manager, adaptive holding, order flow analyzer
- **Event-driven architecture**: World Ticks emit microstructure data to all agents atomically

---

## 1. ORDERBOOK DATA STRUCTURE

### Definition
```typescript
interface OrderBook {
  symbol: string;                    // e.g., "BTC/USDT"
  timestamp: number;                 // Unix milliseconds
  bids: Array<[price, quantity]>;   // [[100.50, 1.5], [100.49, 2.0], ...]
  asks: Array<[price, quantity]>;   // [[100.51, 1.3], [100.52, 2.5], ...]
}
```

### Data Characteristics
- **Bids**: Sorted descending by price (highest first)
- **Asks**: Sorted ascending by price (lowest first)
- **Levels**: Typically 20-100 price levels per side
- **Real-time**: Updated via WebSocket for live mode
- **Snapshot**: REST fetch for historical/backtest mode

### Fetching Interface
```typescript
interface MarketDataAdapter {
  fetchOrderBook(symbol: string): Promise<OrderBook>;
  fetchOHLCV(symbol, timeframe, since, limit): Promise<Candle[]>;
  fetchTicker(symbol): Promise<Ticker>;
  getHealth(): Promise<AdapterHealth>;
}
```

### Current Implementation Status
✅ **OrderBook fetching**: Implemented in adapters (CCXT, OANDA, MT5)  
✅ **Storage**: Persisted via storage layer  
✅ **Visualization**: OrderbookPanel component in UI  
⚠️ **Depth analysis**: Minimal (only spread calculated from ticker)

---

## 2. MARKET MICROSTRUCTURE DATA

### Definition (Embedded in MarketFrame)
```typescript
interface MarketFrame {
  // ... candle + technical indicators ...
  
  orderFlow: {
    bidVolume: number;      // Total bid volume in orderbook
    askVolume: number;      // Total ask volume in orderbook
    netFlow: number;        // bidVolume - askVolume (buying pressure)
    largeOrders: number;    // Count of orders > threshold
    smallOrders: number;    // Count of orders < threshold
  };
  
  marketMicrostructure: {
    spread: number;         // Absolute spread in price units (e.g., 0.01)
    depth: number;          // Total liquidity on both sides
    imbalance: number;      // Ratio: bidVolume / (bidVolume + askVolume)
    toxicity: number;       // Adverse selection risk (0-1 scale)
  };
}
```

### Field Definitions

| Field | Type | Purpose | Range | Calculation |
|-------|------|---------|-------|-------------|
| **spread** | number | Bid-ask difference | 0.001-0.1 | `ask - bid` from orderbook |
| **depth** | number | Available liquidity | 100K-100M | Sum of bid+ask volumes |
| **imbalance** | number | Buy/sell ratio | 0-1 | `bidVol / (bidVol+askVol)` |
| **toxicity** | number | Adverse selection | 0-1 | Calculated by exit optimizer |

---

## 3. HOW MICROSTRUCTURE IS CALCULATED

### Step 1: Data Collection
```
MarketDataAdapter.fetchOrderBook()
  ↓
OrderBook {bids: [[price, qty], ...], asks: [[price, qty], ...]}
  ↓
Extract bid/ask volumes, calculate spread
```

### Step 2: Enrichment in Trading Engine
Location: `server/trading-engine.ts` lines 1220-1230

```typescript
marketMicrostructure: {
  spread: ticker.bid && ticker.ask ? ticker.ask - ticker.bid : 0,
  depth: 0,      // ⚠️ NOT POPULATED FROM ORDERBOOK
  imbalance: 0,  // ⚠️ NOT POPULATED FROM ORDERBOOK
  toxicity: 0    // ⚠️ NOT POPULATED FROM ORDERBOOK
}
```

**Current Status**: Only **spread** is populated from ticker data. Other fields populated as 0 (default).

### Step 3: Scoring for Signal Generation
Location: `server/trading-engine.ts` lines 655-668

```typescript
calculateMicrostructureScore(frame: MarketFrame): number {
  const { spread, depth, imbalance, toxicity } = frame.marketMicrostructure;
  
  // Component scores (0-1 scale)
  const spreadScore = Math.max(0, 1 - spread / frame.price.close);
  const depthScore = Math.min(1, depth / (frame.volume * 0.1));
  const imbalanceScore = Math.tanh(imbalance);
  const toxicityScore = Math.max(0, 1 - toxicity);
  
  // Weighted composite
  return spreadScore * 0.3 +      // 30% weight
         depthScore * 0.2 +       // 20% weight
         imbalanceScore * 0.3 +   // 30% weight
         toxicityScore * 0.2;     // 20% weight
}
```

**Weights**: Spread (30%) > Imbalance (30%) > Depth (20%) > Toxicity (20%)

---

## 4. DATA FLOW THROUGH SYSTEM

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MARKET DATA COLLECTION                                   │
├─────────────────────────────────────────────────────────────┤
│  Exchange (CCXT/OANDA/MT5)                                  │
│  ↓                                                           │
│  MarketDataAdapter.fetchOrderBook(symbol)                   │
│  ↓                                                           │
│  OrderBook {bids, asks, timestamp}                          │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CANDLE + MICROSTRUCTURE ENRICHMENT                       │
├─────────────────────────────────────────────────────────────┤
│  Trading Engine (trading-engine.ts)                         │
│  ↓                                                           │
│  Create MarketFrame:                                        │
│    ├─ OHLC from candle                                      │
│    ├─ Technical indicators (RSI, MACD, BB, EMAs, etc)      │
│    ├─ Order flow (bidVolume, askVolume, netFlow)           │
│    └─ Market microstructure (spread, depth, imbalance, ...)│
│  ↓                                                           │
│  Store to database                                          │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. INTEGRITY GATE + WORLD TICK EMISSION                     │
├─────────────────────────────────────────────────────────────┤
│  IntegrityGate (integrity-gate.ts)                          │
│  ↓                                                           │
│  Validate candles (timestamp, OHLC, finality)               │
│  ↓                                                           │
│  📍 EMIT WORLD TICK with:                                  │
│    ├─ symbol, timeframe, worldTime, emitTime               │
│    ├─ candle + all microstructure data                      │
│    └─ mode (REPLAY | MIXED | LIVE)                        │
│  ↓                                                           │
│  All agents subscribe to world.tick events                 │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. MICROSTRUCTURE CONSUMPTION                               │
├─────────────────────────────────────────────────────────────┤
│  Multiple services consume microstructure data:             │
│                                                             │
│  ┌─ MicrostructureExitOptimizer                            │
│  │   └─ Detects market deterioration → triggers exits      │
│  │                                                          │
│  ├─ IntelligentExitManager                                │
│  │   └─ Adjusts stop/target using microstructure           │
│  │                                                          │
│  ├─ AdaptiveHolding                                        │
│  │   └─ Calculates holding periods from microstructure     │
│  │                                                          │
│  └─ OrderFlowAnalyzer                                      │
│      └─ Analyzes bid/ask imbalance for position sizing     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. SERVICES CONSUMING MICROSTRUCTURE DATA

### 5.1 MicrostructureExitOptimizer
**File**: `server/services/microstructure-exit-optimizer.ts` (250+ lines)

**Purpose**: Detect market deterioration and trigger emergency exits

**Signals**:
1. **Spread Widening**: Sharp increase in bid-ask spread (illiquidity warning)
2. **Depth Collapse**: Sudden drop in order book depth
3. **Imbalance Reversal**: Order flow suddenly flips direction
4. **Toxicity Spike**: Sharp increase in adverse selection

**Thresholds**:
- Order imbalance: 30% significant imbalance
- Spread history: Tracks 20-bar rolling average
- Toxicity: Threshold configured per strategy

**Integration**:
```typescript
class MicrostructureExitOptimizer {
  evaluateExit(current: MarketFrame, previous: MarketFrame): ExitSignal | null {
    // Check all 4 microstructure signals
    // Return exit recommendation if triggered
  }
}
```

### 5.2 IntelligentExitManager
**File**: `server/services/intelligent-exit-manager.ts`

**Purpose**: Dynamically adjust stops and targets based on market conditions

**Method**:
```typescript
updateWithMicrostructure(
  price: number,
  microData: MarketMicrostructure,
  previousData: MarketMicrostructure,
  signalType: 'SPREAD_WIDENING' | 'DEPTH_COLLAPSE' | ...
): ExitAdjustment {
  // Tighten stops if spread widens
  // Extend targets if depth improves
  // Add urgency if toxicity spikes
}
```

**Adjustments**:
- Tighter spreads → Expand profit targets (more room to run)
- Wider spreads → Tighten stops (reduce slippage risk)
- Low depth → Reduce position size
- High toxicity → Immediate exit signal

### 5.3 AdaptiveHolding
**File**: `server/services/adaptive-holding.ts`

**Purpose**: Calculate holding periods based on microstructure health

**Scoring Method**:
```typescript
calculateMicrostructureHealth(spread: number, depth: number, volume: number): number {
  // Score = (1 - spread/price) * 0.40 +    // 40% weight on tight spread
  //         Math.min(1, depth/volume*0.1) * 0.35 +  // 35% on depth
  //         Math.min(1, volume/avgVol) * 0.25;      // 25% on volume
  
  // Good health (0.7+): Hold longer (3-5 bars)
  // Normal health (0.5-0.7): Hold medium (2-3 bars)
  // Poor health (<0.5): Exit immediately (0.5 bars)
}
```

**Holding Period Adjustments**:
- **Excellent microstructure** (spread tight, depth deep): Hold for full target, let winners run
- **Good microstructure**: Normal holding period
- **Poor microstructure** (spread wide, depth shallow): Exit at first sign of profit

### 5.4 OrderFlowAnalyzer
**File**: `server/services/order-flow-analyzer.ts` (266 lines)

**Purpose**: Analyze bid/ask imbalance for position sizing

**Components**:
1. **Bid-Ask Ratio** (35% weight): `bidVolume / askVolume`
   - > 1.2 = Strong buy signal alignment
   - < 0.83 = Strong sell signal alignment

2. **Net Flow Ratio** (35% weight): `(bidVol - askVol) / (bidVol + askVol)`
   - > 0.65 = Strong buying pressure
   - < 0.35 = Strong selling pressure

3. **Spread Score** (15% weight): Liquidity quality
   - < 0.05%: Excellent (1.0)
   - < 0.1%: Very good (0.9)
   - < 0.2%: Good (0.7)
   - < 0.5%: Moderate (0.5)
   - > 0.5%: Poor (0.3)

4. **Volume Score** (15% weight): Conviction indicator
   - > 2.0x average: Extreme conviction (1.0)
   - > 1.5x: High conviction (0.9)
   - > 1.0x: Above average (0.7)
   - < 0.7x: Very low conviction (0.3)

**Output**: Position multiplier (0.6x - 1.6x)
- 0.0 score → 0.6x position (reduce 40%)
- 0.5 score → 1.0x position (neutral)
- 1.0 score → 1.6x position (increase 60%)

**Example**:
```typescript
const analysis = OrderFlowAnalyzer.analyzeOrderFlow(
  { bidVolume: 1500, askVolume: 1000, netFlow: 500, spread: 0.01, ... },
  'BUY',
  'NORMAL'
);
// Result: { orderFlowScore: 0.82, orderFlowMultiplier: 1.42, strength: 'STRONG' }
```

---

## 6. SIGNAL GENERATION WITH MICROSTRUCTURE

### Composite Score Calculation
Location: `trading-engine.ts` lines 674-690

```typescript
const technicalScore = this.calculateTechnicalScore(frames, index);      // RSI, MACD, BB, etc
const orderFlowScore = this.calculateOrderFlowScore(current);            // Bid-ask imbalance
const microstructureScore = this.calculateMicrostructureScore(current);  // Spread, depth, etc
const volatility = current.indicators.atr / current.price.close;

// Weights adjust based on volatility regime
const techWeight = volatility < 0.02 ? 0.5 : 0.3;  // 50% in stable, 30% in volatile
const flowWeight = 0.3;   // Order flow always 30%
const microWeight = 0.2;  // Microstructure always 20%

const compositeScore = (
  technicalScore * techWeight +
  orderFlowScore * flowWeight +
  microstructureScore * microWeight
);

// Generate signal only if strong (>0.3) AND confident (>0.6)
if (strength < 0.3 || confidence < 0.6) return null;
```

**Signal Generation Logic**:
- **High volatility** (>2% ATR): Reduce technical weight (30%), lean on order flow (30%) + microstructure (20%)
- **Low volatility** (<2% ATR): Increase technical weight (50%), microstructure still important (20%)
- **Microstructure deterioration**: Automatically rejects signal (even if technical strong)

---

## 7. CURRENT GAPS & LIMITATIONS

### ⚠️ Gap 1: Incomplete Microstructure Enrichment
**Issue**: Only `spread` is populated from real data
```typescript
// Current (trading-engine.ts line 1224)
marketMicrostructure: {
  spread: ticker.ask - ticker.bid,  // ✅ POPULATED
  depth: 0,                         // ❌ NOT POPULATED (always 0)
  imbalance: 0,                     // ❌ NOT POPULATED (always 0)
  toxicity: 0                       // ❌ NOT POPULATED (always 0)
}
```

**Impact**: Depth/imbalance/toxicity scoring disabled (default 0 values)

**Fix**: Calculate from OrderBook data during MarketFrame creation

### ⚠️ Gap 2: Orderbook Data Not Persisted
**Issue**: OrderBook fetched but not stored for historical analysis

**Impact**: Cannot analyze historical microstructure patterns

**Fix**: Store OrderBook snapshots alongside MarketFrame data

### ⚠️ Gap 3: No Toxicity Calculation
**Issue**: `toxicity` field always 0 (adverse selection risk not calculated)

**Impact**: Missing key market deterioration signal

**Fix**: Implement toxicity calculation based on:
- Spread changes (widening = potential toxicity)
- Depth profile changes (deteriorating = adverse selection)
- Order flow reversals (sudden flips = toxic moves)

### ⚠️ Gap 4: Limited Microstructure History
**Issue**: Microstructure data stored but not aggregated for pattern detection

**Impact**: Cannot detect deterioration trends, only snapshot values

**Fix**: Maintain rolling 20-50 bar microstructure history for trend analysis

---

## 8. CURRENT INTEGRATIONS & USAGE

### Exit Optimization
```
Microstructure Deterioration → MicrostructureExitOptimizer → Exit Signal
├─ Spread widening: +50% from average → URGENT EXIT
├─ Depth collapse: -60% from average → URGENT EXIT
├─ Imbalance flip: Direction reverses → EXIT
└─ Toxicity spike: Adverse selection detected → EXIT
```

### Position Sizing
```
Order Flow Analysis → OrderFlowAnalyzer → Position Multiplier
├─ Strong alignment (score 0.8+): 1.5-1.6x size
├─ Moderate alignment (0.5-0.8): 1.0-1.2x size
├─ Weak alignment (0.3-0.5): 0.7-0.9x size
└─ Contradiction (< 0.3): 0.6x size (reduced)
```

### Signal Generation
```
BUY Signal (technical) +
Microstructure Score (0.2 weight) +
Order Flow Score (0.3 weight) +
Technical Score (0.5 weight in stable regime)
= Final signal strength & confidence
```

### Holding Period
```
Microstructure Health Score:
├─ Excellent (0.7+): Hold 3-5 bars (let it run)
├─ Good (0.5-0.7): Hold 2-3 bars
└─ Poor (<0.5): Exit on first profit
```

---

## 9. RECOMMENDED ENHANCEMENTS

### Priority 1: Complete Microstructure Enrichment
Calculate all 4 fields from OrderBook data:

```typescript
// From OrderBook {bids, asks}
const bidVolume = bids.reduce((sum, [_, qty]) => sum + qty, 0);
const askVolume = asks.reduce((sum, [_, qty]) => sum + qty, 0);
const totalDepth = bidVolume + askVolume;

marketMicrostructure: {
  spread: asks[0][0] - bids[0][0],
  depth: totalDepth,
  imbalance: bidVolume / (bidVolume + askVolume),
  toxicity: calculateToxicity(spread, depth, orderFlow)  // NEW
}
```

### Priority 2: Implement Toxicity Calculation
```typescript
calculateToxicity(spread: number, depth: number, netFlow: number): number {
  // Toxicity = (widening spread + collapsing depth) / history
  const spreadRatio = currentSpread / (avgSpread || 0.0001);
  const depthRatio = currentDepth / (avgDepth || 1);
  const flowReversal = flowChanged ? 1.0 : 0.0;
  
  return (
    (spreadRatio - 1) * 0.4 +     // Spread widening = toxicity
    (1 - depthRatio) * 0.4 +       // Depth collapse = toxicity
    flowReversal * 0.2             // Flow reversal = toxicity
  );
}
```

### Priority 3: Store OrderBook History
Persist bid/ask snapshots for microstructure analysis:
```typescript
await storage.createOrderBookSnapshot({
  symbol,
  timestamp,
  bids: [...],
  asks: [...],
  bidVolume,
  askVolume,
  spread,
  depth
});
```

### Priority 4: Microstructure Regime Detection
Track microstructure "health" over 50-100 bars:
```typescript
enum MicrostructureRegime {
  EXCELLENT,  // Tight spread, deep book, steady flow
  NORMAL,     // Moderate conditions
  DEGRADING,  // Worsening conditions (exit preparation)
  CRISIS      // Extreme conditions (emergency exit)
}
```

---

## 10. SUMMARY TABLE

| Aspect | Status | Source | Notes |
|--------|--------|--------|-------|
| **OrderBook Interface** | ✅ Defined | market-data.ts | Simple [price, qty] structure |
| **Spread Calculation** | ✅ Implemented | trading-engine.ts L1224 | From ticker bid/ask |
| **Depth Calculation** | ❌ Not Implemented | N/A | Should come from OrderBook |
| **Imbalance Calc** | ❌ Not Implemented | N/A | Should be bidVol / (bidVol + askVol) |
| **Toxicity Calc** | ❌ Not Implemented | N/A | Needs adverse selection logic |
| **OrderFlow Analyzer** | ✅ Full Implementation | order-flow-analyzer.ts | 4-component scoring system |
| **Exit Optimization** | ✅ Implemented | microstructure-exit-optimizer.ts | Spread, depth, imbalance triggers |
| **Position Sizing** | ✅ Integrated | order-flow-analyzer.ts | 0.6x - 1.6x multiplier |
| **Holding Periods** | ✅ Implemented | adaptive-holding.ts | Health-based duration adjustment |
| **Signal Generation** | ✅ Integrated | trading-engine.ts L655+ | Weights microstructure 20% |
| **Data Persistence** | ⚠️ Partial | storage layer | MarketFrame stored, OrderBook not |
| **World Tick Emission** | ✅ Implemented | integrity-gate.ts | Mode-aware, fully atomic |

---

## 11. KEY FILES REFERENCE

| File | Purpose | Key Functions |
|------|---------|---|
| `server/types/market-data.ts` | Type definitions | OrderBook, MarketFrame, WorldTick |
| `server/trading-engine.ts` | Signal generation | calculateMicrostructureScore(), generateSignal() |
| `server/services/order-flow-analyzer.ts` | Order flow analysis | analyzeOrderFlow(), position multiplier |
| `server/services/microstructure-exit-optimizer.ts` | Exit optimization | evaluateExit(), spread/depth/toxicity signals |
| `server/services/intelligent-exit-manager.ts` | Dynamic stop/target | updateWithMicrostructure() |
| `server/services/adaptive-holding.ts` | Holding periods | calculateMicrostructureHealth() |
| `server/services/market-data/integrity-gate.ts` | Data validation | storeValidatedCandles(), emit world.tick |
| `server/services/market-data/mode-detector.ts` | Mode detection | detectMode() returns REPLAY|MIXED|LIVE |

---

**Last Updated**: Current session  
**System Status**: Production-ready for spread-based signals; enhancement needed for complete depth/imbalance/toxicity  
**Next Phase**: Implement remaining microstructure enrichment to unlock full market microstructure intelligence
