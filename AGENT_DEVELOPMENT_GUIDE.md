# Agent Development Guide

## Overview

This guide explains how to develop agents for Scanstream using the `DecisionContext` pattern. Agents in Scanstream are **perception-limited, constrained intelligence** — they see only what they're given and can only act within guardrails.

---

## 🧠 Core Concept: DecisionContext

Agents consume `DecisionContext`, not raw market data.

### What is DecisionContext?

```typescript
interface DecisionContext {
  symbol: string;                    // What we're analyzing
  timeframe: string;                 // At what granularity
  frame: Readonly<MarketFrame>;      // Market reality (immutable)
  signals: Readonly<SignalObject>;   // Derived signals (trend, breakout, etc.)
  quality: Readonly<QualityMetrics>; // Confidence, staleness, fallback flag
  constraints: Readonly<Constraints>;// Guardrails (maxSizeUsd, allowTrade)
  createdAt: number;                 // When was this built
  contextId: string;                 // Audit trail ID
}
```

**Key Properties:**
- ✅ **Frozen** — agents cannot mutate it
- ✅ **Scoped** — agents only see data relevant to this symbol/timeframe
- ✅ **Constrained** — constraints are enforced boundaries
- ✅ **Immutable** — `Readonly<T>` prevents accidental mutation
- ✅ **Auditable** — contextId enables full replay/analysis

---

## 🚀 Writing Your First Agent

### Pattern: Decision-Emission

```typescript
import { DecisionContext } from '../types/DecisionContext';
import { assertAgentCanTrade } from '../lib/timeAuthorityInvariants';

export function myTrendAgent(ctx: DecisionContext): AgentDecision | null {
  // ⚠️ CRITICAL: Check mode first — replay data must never trade
  if (ctx.mode === 'REPLAY') {
    return null; // Silent no-op in replay mode
  }

  // 1. Read context (safe, immutable)
  const { frame, signals, quality, constraints } = ctx;

  // 2. Check if trading is allowed
  if (!constraints.allowTrade) {
    console.log(`[MyAgent] Trading disabled (${constraints.reason}), skipping decision.`);
    return null;
  }

  // 3. Check quality
  if (quality.confidence < 0.7) {
    console.log(`[MyAgent] Low confidence (${quality.confidence}), skipping decision.`);
    return null;
  }

  // 4. Apply logic
  if (signals.trend === 'up' && frame.close > (frame.indicators?.ema?.ema20 ?? 0)) {
    return {
      symbol: ctx.symbol,
      action: 'BUY',
      sizeUsd: Math.min(1000, constraints.maxSizeUsd),
      confidence: quality.confidence,
      reason: 'Price above EMA20 and trend is up',
      contextId: ctx.contextId,
    };
  }

  // 5. Emit nothing by default
  return null;
}
```

**Key safety check:** `if (ctx.mode === 'REPLAY') return null;`

This is the **runtime guard** that prevents replay data from generating trading signals.

### Pattern: Multi-Signal Consensus

```typescript
export function consensusAgent(ctx: DecisionContext): AgentDecision | null {
  const { frame, signals, quality, constraints } = ctx;

  // Require multiple bullish signals
  const bullishCount = [
    signals.trend === 'up',
    signals.breakout === true,
    (frame.indicators?.rsi ?? 50) > 50,
  ].filter(Boolean).length;

  if (bullishCount >= 2 && quality.confidence > 0.6) {
    return {
      symbol: ctx.symbol,
      action: 'BUY',
      sizeUsd: 500,
      confidence: quality.confidence,
      reason: `${bullishCount} bullish signals confirmed`,
      contextId: ctx.contextId,
    };
  }

  return null;
}
```

---

## 🛡️ Safety Rules (ENFORCE THESE)

### ❌ DO NOT

```typescript
// ❌ Mutate the context
ctx.frame.close = 99999;  // ← TypeError: Cannot assign to read only property

// ❌ Access storage directly
const frames = await storage.queryFrames(ctx.symbol);  // ← Wrong

// ❌ Fetch external data inside decision logic
const binancePrice = await fetch('https://api.binance.com/...');  // ← Wrong

// ❌ Make trading decisions without checking constraints
if (mySignal) {
  trade(ctx.symbol, 100000);  // ← Ignores maxSizeUsd
}

// ❌ Ignore quality warnings
if (ctx.quality.isFallback) {
  // Still trade using stale data
}

// ❌ Trade in REPLAY mode
if (ctx.mode === 'REPLAY') {
  return { action: 'BUY', ... };  // ← NEVER do this
}
```

### ✅ DO

```typescript
// ✅ Check mode FIRST — replay can never trade
if (ctx.mode === 'REPLAY') {
  return null; // Silent no-op in replay mode
}

// ✅ Read context immutably
const { frame, signals, constraints } = ctx;

// ✅ Respect constraints
if (mySignal && constraints.allowTrade) {
  const size = Math.min(mySize, constraints.maxSizeUsd);
  return { symbol: ctx.symbol, action: 'BUY', sizeUsd: size };
}

// ✅ Check quality
if (ctx.quality.confidence < minThreshold) {
  return null; // Skip decision
}

// ✅ Check freshness
if (ctx.quality.isStale) {
  return null; // Skip decision on stale data
}

// ✅ Check fallback
if (ctx.quality.isFallback) {
  // Either skip or apply fallback strategy
  return { symbol: ctx.symbol, action: 'HOLD' };
}

// ✅ Include audit trail
return {
  symbol: ctx.symbol,
  action: 'BUY',
  contextId: ctx.contextId,  // ← Links decision to market state
};
```

---

## 🔍 Understanding Constraints

Every `DecisionContext` has `constraints` that **bound agent behavior**:

```typescript
interface DecisionContextConstraints {
  allowTrade: boolean;      // Can agent execute any trades?
  maxSizeUsd: number;       // Max position size in USD
  maxLeverage: number;      // Max leverage multiplier (1.0 = no leverage)
  [key: string]: any;       // Custom constraints (per-agent, per-strategy)
}
```

### Using Constraints

```typescript
export function sizeAwareAgent(ctx: DecisionContext): AgentDecision | null {
  const { constraints } = ctx;

  // Respect max position size
  if (constraints.allowTrade === false) {
    return null; // Trading disabled globally
  }

  // Position size must never exceed maxSizeUsd
  const myDesiredSize = 5000;
  const actualSize = Math.min(myDesiredSize, constraints.maxSizeUsd);

  if (actualSize <= 0) {
    return null; // Constraints don't allow any size
  }

  return {
    symbol: ctx.symbol,
    action: 'BUY',
    sizeUsd: actualSize,
    leverage: Math.min(2.0, constraints.maxLeverage),
  };
}
```

---

## 📊 Understanding Quality Metrics

Every `DecisionContext` carries quality data:

```typescript
interface DecisionContextQuality {
  confidence: number;    // 0–1, how much trust in this data
  isStale: boolean;      // True if older than maxAgeMs
  isFallback: boolean;   // True if using degraded data (cache/replay)
  reason?: string;       // Human-readable explanation
}
```

### Responding to Quality

```typescript
export function qualityAwareAgent(ctx: DecisionContext): AgentDecision | null {
  const { quality, constraints } = ctx;

  // High confidence → full-size trade
  if (quality.confidence > 0.8 && !quality.isFallback) {
    return { symbol: ctx.symbol, action: 'BUY', sizeUsd: constraints.maxSizeUsd };
  }

  // Medium confidence → reduced size
  if (quality.confidence > 0.5) {
    return { symbol: ctx.symbol, action: 'BUY', sizeUsd: constraints.maxSizeUsd * 0.5 };
  }

  // Low confidence → skip
  return null;
}
```

---

## 🔗 Building Decisions with Context

### Factory Pattern

Use the `DecisionContextBuilder` to create contexts:

```typescript
import { buildDecisionContext, buildDecisionContextStrict } from '../lib/decisionContextBuilder';

// Normal mode (tolerates some staleness/fallback)
const ctx = buildDecisionContext(marketFrame, signals, {
  minConfidence: 0.5,
  maxAgeMs: 5 * 60 * 1000,
  maxSizeUsd: 10000,
  allowTrade: true,
});

// Strict mode (rejects stale/fallback data)
const strictCtx = buildDecisionContextStrict(marketFrame, signals, {
  minConfidence: 0.7,
  maxAgeMs: 60 * 1000,  // 1 minute max
});

// Replay mode (for backtesting)
const replayCtx = buildDecisionContextForReplay(replayFrame, signals, {
  maxSizeUsd: 50000,     // higher for backtest
  maxLeverage: 2.0,
});
```

---

## 🧪 Testing Agents

### Test Pattern

```typescript
import { buildDecisionContext } from '../lib/decisionContextBuilder';
import { createMarketFrame } from '../types/MarketFrame';

describe('myTrendAgent', () => {
  it('should buy when price is above EMA and trend is up', () => {
    // Arrange: build a test context
    const testFrame = createMarketFrame('BTCUSDT', '1h', {
      open: 40000,
      high: 42000,
      low: 39000,
      close: 41500,
      volume: 100,
    }, {
      source: 'live',
      isFinal: true,
    });
    testFrame.indicators = { ema20: 40500 };

    const ctx = buildDecisionContext(testFrame, [], {
      allowTrade: true,
      maxSizeUsd: 10000,
    });

    // Act
    const decision = myTrendAgent(ctx);

    // Assert
    expect(decision).not.toBeNull();
    expect(decision?.action).toBe('BUY');
    expect(decision?.sizeUsd).toBeLessThanOrEqual(10000);
    expect(decision?.contextId).toBeDefined();
  });

  it('should skip when confidence is low', () => {
    const testFrame = createMarketFrame('BTCUSDT', '1h', {
      open: 40000, high: 42000, low: 39000, close: 41500, volume: 100,
    });

    const ctx = buildDecisionContext(testFrame, [], {
      allowTrade: true,
      minConfidence: 0.9,  // high bar
    });

    const decision = myTrendAgent(ctx);
    expect(decision).toBeNull();
  });
});
```

---

## 📈 Agent Zoo

### Pattern 1: Simple Trend Following

```typescript
export function trendFollowerAgent(ctx: DecisionContext): AgentDecision | null {
  const { signals, quality, constraints } = ctx;

  if (quality.confidence < 0.6) return null;
  if (!constraints.allowTrade) return null;

  if (signals.trend === 'up') {
    return {
      symbol: ctx.symbol,
      action: 'BUY',
      sizeUsd: constraints.maxSizeUsd * 0.7,
      contextId: ctx.contextId,
    };
  }

  if (signals.trend === 'down') {
    return {
      symbol: ctx.symbol,
      action: 'SELL',
      sizeUsd: constraints.maxSizeUsd * 0.5,
      contextId: ctx.contextId,
    };
  }

  return null;
}
```

### Pattern 2: Mean Reversion

```typescript
export function meanReversionAgent(ctx: DecisionContext): AgentDecision | null {
  const { frame, signals, quality, constraints } = ctx;

  if (quality.isFallback) return null;  // Only live data

  const rsi = frame.indicators?.rsi ?? 50;
  const bb = frame.indicators?.bb;

  // Oversold + price at lower band → buy
  if (rsi < 30 && bb && frame.close < bb.lower && quality.confidence > 0.6) {
    return {
      symbol: ctx.symbol,
      action: 'BUY',
      sizeUsd: Math.min(5000, constraints.maxSizeUsd),
      confidence: quality.confidence,
      contextId: ctx.contextId,
    };
  }

  return null;
}
```

### Pattern 3: Multi-Timeframe Confirmation

```typescript
export function multiTimeframeAgent(
  fastCtx: DecisionContext,   // 1m timeframe
  slowCtx: DecisionContext    // 1h timeframe
): AgentDecision | null {
  // Both contexts must agree
  const fastTrend = fastCtx.signals.trend;
  const slowTrend = slowCtx.signals.trend;

  if (fastTrend === 'up' && slowTrend === 'up') {
    return {
      symbol: fastCtx.symbol,
      action: 'BUY',
      sizeUsd: fastCtx.constraints.maxSizeUsd,
      confidence: Math.min(fastCtx.quality.confidence, slowCtx.quality.confidence),
      contextId: fastCtx.contextId,
    };
  }

  return null;
}
```

---

## 🔐 Invariant Enforcement

Agents are protected by invariants (they're enforced at runtime):

1. **DecisionContext is frozen** — you cannot mutate `ctx.frame.close` or add properties
2. **No storage access** — agents don't fetch/write data directly
3. **Constraints are enforceable** — `maxSizeUsd` is a hard limit
4. **Replay ≠ Live** — `quality.isFallback` tells you when data is degraded

### What Happens if You Violate Invariants?

In **dev/test**: ❌ ERROR thrown, breaks execution

In **production**: ⚠️ WARNING logged, execution continues (but flag set)

Toggle with:
```typescript
import { setEnvironmentMode } from '../lib/invariantEnforcement';

setEnvironmentMode('production');  // Warnings only
setEnvironmentMode('development'); // Errors
```

---

## 📝 Agent Decision Output

Every agent decision should include:

```typescript
interface AgentDecision {
  symbol: string;           // Which symbol
  action: 'BUY' | 'SELL' | 'HOLD';
  sizeUsd?: number;         // Respect maxSizeUsd
  leverage?: number;        // Respect maxLeverage
  stopLoss?: number;        // Optional: risk management
  takeProfit?: number;      // Optional: profit target
  confidence?: number;      // How confident in this decision
  reason?: string;          // Human-readable rationale
  contextId: string;        // Link to the market state (IMPORTANT)
}
```

The **`contextId`** is critical — it links the decision back to the exact market state that produced it. Use it for:
- Audit trails
- Replay and analysis
- Attribution (which market condition drove this decision)
- Backtesting

---

## ✅ Checklist: Before Deploying an Agent

- [ ] Agent reads from `DecisionContext` only
- [ ] Agent respects `constraints.maxSizeUsd` and `constraints.maxLeverage`
- [ ] Agent checks `quality.confidence` and `quality.isFallback`
- [ ] Agent returns early if `constraints.allowTrade === false`
- [ ] Agent includes `contextId` in every decision
- [ ] Agent has unit tests
- [ ] Agent is tested with low-confidence and fallback contexts
- [ ] Agent gracefully handles `isStale` data
- [ ] Agent never mutates `ctx.frame` or `ctx.signals`
- [ ] Agent never calls `storage.query()` or `fetch()` inside decision logic

---

## 🎓 Further Reading

- **DATA_LAYER_ARCHITECTURE.md** — understand the four-layer data model
- **invariants.ts** — the hard rules your agent must follow
- **DecisionContext type** — full type definition and factory functions
- **Examples** — check `agents/` folder for more pattern examples

---

## Support & Questions

If your agent breaks an invariant, you'll see errors like:

```
[INVARIANT VIOLATION] RawTick passed to agent code.
Agents must only consume DecisionContext.
```

Or:

```
[INVARIANT WARNING] DecisionContext is not frozen.
Agents could mutate it.
```

These are **good** — they're helping you stay safe. Fix them and move forward.

**Happy agent building! 🚀**
