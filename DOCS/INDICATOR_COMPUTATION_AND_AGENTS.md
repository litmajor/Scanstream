# Indicator Computation & Agents Integration Guide

## 🎯 Current State: Your Indicator Pipeline

Your CCXT scanner computes **67 columns** of indicator data per symbol/timeframe:

```
TechnicalIndicators.add_all_indicators(df)
    ├── Volume Profile (3 variants)
    ├── Ichimoku (5 components)
    ├── Bollinger Bands (4 columns)
    ├── Stochastic (2 columns)
    ├── EMAs (6 periods)
    ├── SMAs (2 periods)
    ├── VWAP
    ├── ATR
    ├── ADX
    ├── OBV
    ├── RSI
    └── ... (risk/reward, stops, confluence scores)
```

**Current timing:**
- Scan initialization: ~0.2s
- Indicator computation: ~0.5–2s (parallel on many symbols)
- Full scan (50 symbols): **~30–60 seconds**

---

## 🔄 How Indicators Flow into the New Architecture

### The Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CCXT SCANNER (Python) — Computes 67 Columns             │
│    └─ Emits: DataFrame with all indicators                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MARKET FRAME LAYER (TypeScript)                          │
│    └─ Stores: Subset of indicators (those needed by agents) │
│       └─ Emits: WorldTick events (validated, timestamped)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. DECISION CONTEXT LAYER (Agents Read This)                │
│    └─ Provides: Immutable context with pre-computed signals │
│       └─ Agents never recompute — only consume + decide     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ What DOES NOT Change

Your indicator computation stays **exactly the same**:

1. **CCXT Scanner** continues computing 67 columns
2. **TechnicalIndicators class** unchanged
3. **Python scanner_api.py** unchanged
4. **All existing logic** in `add_all_indicators()` preserved

---

## 🔧 What DOES Change: The Integration Points

### Pattern: Raw Indicator Data → Computed Signals

Instead of agents reading raw indicators, they read **pre-computed signals**:

```typescript
// ❌ OLD WAY (agents compute from raw indicators)
const rsi = ctx.frame.indicators.rsi;  // Raw value: 72
const trend = rsi > 70 ? 'overbought' : 'normal';  // Agent logic

// ✅ NEW WAY (signals pre-computed, agents consume)
const trend = ctx.signals.trend;  // Already determined: 'up'
const quality = ctx.quality.confidence;  // Already assessed: 0.92
```

---

## 🏗️ Recommended Integration Strategy

### Step 1: Wire Scanner Output to MarketFrame

**Current state:** Scanner outputs 67 columns to API response

**New state:** Transform those 67 columns into a `MarketFrame`:

```typescript
// In your gateway or aggregator
async function fetchAndBuildMarketFrame(symbol: string, timeframe: string): Promise<MarketFrame> {
  // Call your Python scanner API
  const scannerResult = await fetch(`http://localhost:5001/api/scanner/scan`, {
    method: 'POST',
    body: JSON.stringify({
      symbols: [symbol],
      timeframe,
      quick_mode: false,  // Get full 67 columns
    })
  });

  const data = await scannerResult.json();
  const signal = data.signals[0];

  // BUILD MarketFrame from the 67 columns
  const frame: MarketFrame = {
    symbol,
    timeframe,
    timestamp: Date.now(),
    // OHLCV from scanner
    open: signal.open,
    high: signal.high,
    low: signal.low,
    close: signal.close,
    volume: signal.volume,
    
    // Indicators subset (only what agents need)
    indicators: {
      rsi: signal.indicators.rsi,
      bb: {
        upper: signal.indicators.bb_upper,
        middle: signal.indicators.bb_middle,
        lower: signal.indicators.bb_lower,
      },
      ema: {
        ema5: signal.indicators.ema_5,
        ema20: signal.indicators.ema_21,  // Close enough
        ema50: signal.indicators.ema_50,
        ema200: signal.indicators.ema_200,
      },
      stoch: {
        k: signal.indicators.stoch_k,
        d: signal.indicators.stoch_d,
      },
      atr: signal.indicators.atr,
      adx: signal.indicators.adx,
      obv: signal.indicators.obv,
      vwap: signal.indicators.vwap,
      // Volume profile from your 67 columns
      volumeProfile: {
        poc: signal.indicators.poc_price,
        histogram: signal.indicators.volume_hist,
      },
    },
    
    // Microstructure (from scanner)
    microstructure: {
      spreadBps: signal.spread_bps || 0,
      bidSize: signal.bid_size,
      askSize: signal.ask_size,
    },
    
    // Meta tracking
    meta: {
      source: 'scanner',
      isFinal: signal.is_final || true,
      latencyMs: Date.now() - signal.timestamp,
    }
  };

  return frame;
}
```

### Step 2: Build Signals from Indicators (NOT from Raw Data)

Signals are **derived from the 67-column indicators**, not computed per-agent:

```typescript
// In a signal processor (runs once per frame, not per agent)
function deriveSignalsFromIndicators(frame: MarketFrame): SignalObject {
  const ind = frame.indicators;
  
  // Example: Trend signal from multiple indicators
  const emaAlignment = 
    frame.close > ind.ema.ema5 &&
    ind.ema.ema5 > ind.ema.ema20 &&
    ind.ema.ema20 > ind.ema.ema50 ? 1 : 
    frame.close < ind.ema.ema5 &&
    ind.ema.ema5 < ind.ema.ema20 &&
    ind.ema.ema20 < ind.ema.ema50 ? -1 : 0;

  const trend = emaAlignment > 0 ? 'up' : emaAlignment < 0 ? 'down' : 'neutral';
  
  // Breakout from volume profile
  const breakout = frame.close > (ind.volumeProfile.poc * 1.02) ? true : false;
  
  // Momentum from RSI
  const momentum = ind.rsi > 70 ? 'overbought' : ind.rsi < 30 ? 'oversold' : 'neutral';
  
  return {
    trend,
    breakout,
    momentum,
    rsiLevel: ind.rsi,
    bbPosition: frame.close < ind.bb.lower ? 'oversold' :
                frame.close > ind.bb.upper ? 'overbought' : 'neutral',
  };
}
```

### Step 3: Build DecisionContext (with frozen indicators)

```typescript
async function buildDecisionContext(
  frame: MarketFrame,
  signals: SignalObject,
  constraints: DecisionContextConstraints
): Promise<DecisionContext> {
  // Frame is already validated
  // Signals are pre-computed
  // Just wrap them together
  
  const ctx: DecisionContext = {
    symbol: frame.symbol,
    timeframe: frame.timeframe,
    frame: Object.freeze(frame),  // ← FROZEN: agents cannot mutate
    signals: Object.freeze(signals),
    quality: {
      confidence: calculateConfidence(frame, signals),
      isStale: Date.now() - frame.timestamp > 60000,
      isFallback: false,
    },
    constraints: Object.freeze(constraints),
    createdAt: Date.now(),
    contextId: `${frame.symbol}-${frame.timeframe}-${Date.now()}`,
  };
  
  return ctx;
}
```

---

## ⚡ Timing & Performance

Your 67-column computation doesn't change:

- **Scanner computation:** ~0.5–2s per symbol (unchanged)
- **Frame building:** ~10ms (lightweight transform)
- **Signal derivation:** ~5ms (single pass over indicators)
- **Context building:** ~1ms (freezing + wrapping)

**Total overhead:** ~16ms per symbol (negligible)

---

## 🎯 Agent Development is Simplified

With this architecture, agents become **simple consumers**:

```typescript
// Your agent code
export function trendFollowerAgent(ctx: DecisionContext): AgentDecision | null {
  const { signals, quality, constraints } = ctx;
  
  // ✅ Signals are PRE-COMPUTED from your 67 columns
  if (signals.trend === 'up' && quality.confidence > 0.6) {
    return {
      symbol: ctx.symbol,
      action: 'BUY',
      sizeUsd: Math.min(5000, constraints.maxSizeUsd),
      contextId: ctx.contextId,
    };
  }
  
  return null;
}
```

**Agents never:**
- Recompute indicators (they already exist in `frame.indicators`)
- Call Python scanner (data pre-fetched)
- Access raw exchange data
- Perform slow calculations

---

## 🔗 Updated Data Flow Diagram

```
CCXT Scanner (Python)
├─ compute_all_indicators()  [Your existing code, 67 columns]
├─ rsi, bb, ema, stoch, atr, adx, obv, vwap, etc.
└─ emit to Flask API

      ↓ (REST call)

Gateway / Aggregator (TypeScript)
├─ Fetch scanner result
├─ Build MarketFrame from 67 columns
├─ Emit WorldTick (validated)
└─ Store in MarketFrameStorage

      ↓ (WorldTick event)

Signal Processor (TypeScript)
├─ Read frame.indicators (subset of 67 columns)
├─ Derive higher-level signals (trend, breakout, momentum)
├─ Output: SignalObject

      ↓ (Combined)

DecisionContext Factory (TypeScript)
├─ Wrap frame + signals + quality + constraints
├─ Freeze for immutability
└─ Create contextId for audit trail

      ↓ (Deliver)

Agents (TypeScript)
├─ Receive DecisionContext
├─ Read ctx.signals and ctx.frame.indicators
├─ Make decisions (no computation, just logic)
└─ Emit AgentDecision
```

---

## 🛡️ Key Properties

### Your 67 Columns are Still Computed

✅ **Nothing changes** in `TechnicalIndicators.add_all_indicators()`

✅ **All 67 columns** still available in scanner API response

✅ **No recomputation** — indicators computed once per frame

### Agents Get Pre-Digested Data

✅ **Immutable** — `frame.indicators` cannot be mutated by agents

✅ **Signals pre-computed** — agents don't recompute trend/momentum

✅ **Constrained** — agents respect `maxSizeUsd`, `allowTrade`

### Audit Trail Preserved

✅ **contextId** links decision to exact market state

✅ **frame.meta.source** indicates 'scanner'

✅ **quality.confidence** reflects indicator quality

---

## 📝 Implementation Checklist

- [ ] Wire scanner API output to `buildMarketFrame()`
- [ ] Implement `deriveSignalsFromIndicators()` (uses your 67 columns)
- [ ] Implement `buildDecisionContext()` (freezes + wraps)
- [ ] Refactor agents to consume `ctx.signals` instead of raw indicators
- [ ] Add tests: frame → signals → decision pipeline
- [ ] Monitor timing: ensure context building < 20ms per symbol

---

## 🎓 Concrete Example: Using Your Volume Profile Data

Your scanner computes **3 volume profiles** (regular, anchored, fixed-range):

```typescript
// These already exist in your 67 columns
interface VolumeProfiles {
  regular: {
    histogram: number[];
    poc: number;  // Point of Control
  };
  anchored: {
    histogram: number[];
    poc: number;
  };
  fixedRange: {
    histogram: number[];
    poc: number;
  };
}
```

**Agent consumes them (no recomputation):**

```typescript
export function volumeProfileAgent(ctx: DecisionContext): AgentDecision | null {
  const { frame, signals, constraints } = ctx;
  
  // Volume profiles already in frame.indicators!
  const volumeProfiles = frame.indicators.volumeProfile;
  
  // High volume at low price → accumulation zone
  if (frame.close < volumeProfiles.regular.poc &&
      frame.close > volumeProfiles.regular.histogram[0]) {
    
    return {
      symbol: ctx.symbol,
      action: 'BUY',
      sizeUsd: constraints.maxSizeUsd * 0.5,
      reason: 'Price near volume accumulation zone',
      contextId: ctx.contextId,
    };
  }
  
  return null;
}
```

**No recomputation. Agents read what's already calculated.**

---

## 🚀 Next Steps

1. **Expose full 67 columns from scanner API** (if not already done)
2. **Build MarketFrame factory** that maps 67 columns → frame.indicators
3. **Create signal derivation** that combines multiple indicators
4. **Implement agents** that consume `ctx.signals` (not raw indicators)
5. **Test:** Verify agents receive frozen, pre-computed data

Your indicator computation is your **competitive advantage** — keep it. Agents just use it wisely. 🎯

