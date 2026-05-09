# Frame Quality Envelope — Institutional-Grade Confidence

## 🎯 The Core Shift

**Before:**
> "If it's in storage, it's reliable."

**After:**
> **"How sure are we this happened?"**

Every MarketFrame carries an explicit quality envelope that answers this question deterministically.

---

## FrameQuality Interface

```typescript
interface FrameQuality {
  sourceCount: number;           // How many exchanges contributed?
  maxLatencyMs: number;          // Worst-case ingestion delay (ms)
  isFallback: boolean;           // Using degraded/cached data?
  confidence: number;            // 0–1, system belief score
  confidenceReason?: string;     // Explainable, for debugging
  evaluatedAt: number;           // When was this quality assessed?
}
```

**Attached to every MarketFrame.quality (non-optional).**

---

## How Confidence Is Computed

**Formula (deterministic, conservative):**

```
confidence = clamp(
  (sourceCount / expectedSources) *
  latencyScore *
  fallbackPenalty,
  minConfidence,
  1.0
)
```

Where:
- `latencyScore = max(0, 1 - maxLatencyMs / maxAcceptableMs) * 0.5 + 0.5`
- `fallbackPenalty = isFallback ? 0.5 : 1.0`
- `minConfidence = 0.1` (never go below this)

**Example scores:**

| Scenario | Sources | Latency | Fallback | Confidence |
|----------|---------|---------|----------|------------|
| Fresh live, 1 exchange | 1 | 10ms | No | 1.0 |
| Fresh live, multi-exchange | 3 | 50ms | No | 1.0 |
| Slightly delayed | 1 | 1000ms | No | 0.75 |
| Acceptable latency | 1 | 2000ms | No | 0.5 |
| Using cache | 1 | 5000ms | Yes | 0.25 |
| Exchange down (fallback) | 1 | Any | Yes | 0.5 |

---

## Where Quality Is Computed

**✅ CORRECT PLACES:**
- `ExchangeAggregator` (when assembling frames)
- `TradingEngine.fetchMarketData()` (when creating frames)
- Frame assembly time (deterministic, known inputs)

**❌ WRONG PLACES:**
- Inside agents (agents consume, don't evaluate)
- Inside storage (storage persists, doesn't judge)
- At execution time (too late, decisions already made)

---

## Agent Consumption Pattern

Agents **never** read from storage directly. They receive `DecisionContext` with quality already computed:

```typescript
export function myAgent(ctx: DecisionContext): AgentDecision | null {
  // Check mode first
  if (ctx.mode === 'REPLAY') return null;

  // Check quality vs agent minimum
  if (ctx.quality.confidence < ctx.constraints.minConfidence) {
    return null;  // This agent needs higher confidence
  }

  // Check fallback rule
  if (ctx.quality.isFallback && ctx.mode === 'LIVE') {
    return null;  // Fallback + Live = no trading
  }

  // NOW apply logic
  if (ctx.signals.trend === 'up') {
    return { symbol: ctx.symbol, action: 'BUY', ... };
  }

  return null;
}
```

**Different agents can have different `minConfidence` thresholds** — this is true autonomy.

---

## Critical Safety Invariant

**Hard rule:**

```typescript
if (frame.quality.isFallback && mode === 'LIVE') {
  constraints.allowTrade = false;  // Absolute
}
```

Fallback + Live = **no money moves, period.**

---

## Execution Layer Guard

Final defense before any trade:

```typescript
export function assertExecutionAllowed(ctx: DecisionContext): void {
  // 1. Must be LIVE
  // 2. allowTrade must be true
  // 3. Confidence >= max(executionMin, agentMin)
  // 4. Data not stale
  // 5. No fallback in live mode
}
```

Even if an agent breaks rules, this catches it.

---

## What This Solves (Immediately)

| Failure Mode | Before | After |
|---|---|---|
| Silent stale frames | ❌ Invisible | ✅ Detected (confidence drops) |
| Fallback trading | ❌ Possible | ✅ Blocked (isFallback + LIVE = no trade) |
| Partial exchange outage | ❌ Risky | ✅ Dampened (sourceCount < expected → lower confidence) |
| Overconfident agents | ❌ Common | ✅ Bounded (agent respects minConfidence) |
| Agent misbehavior | ❌ Reaches execution | ✅ Caught at execution gate |

---

## DecisionContext Now Includes

```typescript
interface DecisionContext {
  mode: 'LIVE' | 'REPLAY';
  quality: FrameQuality;  // Explicit confidence + reasons
  
  constraints: {
    allowTrade: boolean;           // Set based on mode + confidence + fallback
    minConfidence: number;         // Agent-specific threshold
    reason?: string;               // Why allowTrade = what it is
    maxSizeUsd: number;
    maxLeverage: number;
  }
}
```

**Rule:** `allowTrade = (mode === 'LIVE') && (confidence >= minConfidence) && (!isFallback)`

---

## Code Example: Frame Assembly

```typescript
// In ExchangeAggregator or TradingEngine
function assembleMarketFrame(
  exchangeFrames: MarketFrame[]
): MarketFrame {
  // Aggregate OHLCV, indicators, etc.
  const aggregated = {
    symbol: 'BTCUSDT',
    close: 43500,
    volume: 1000,
    // ... more fields
  };

  // Compute quality
  const quality = buildFrameQuality(
    exchangeFrames.length,  // sourceCount
    Math.max(...exchangeFrames.map(f => f.meta.latencyMs)),  // maxLatencyMs
    exchangeFrames.some(f => f.meta.source === 'FALLBACK'),  // isFallback
    DEFAULT_CONFIDENCE_CONFIG
  );

  return {
    ...aggregated,
    quality,  // Attach envelope
    meta: { ... }
  };
}
```

---

## Testing Quality

```typescript
describe('Frame Quality Envelope', () => {
  it('computes confidence deterministically', () => {
    const quality = buildFrameQuality(
      1,      // single source
      500,    // 500ms latency
      false   // not fallback
    );
    
    expect(quality.confidence).toBeGreaterThan(0.7);  // Should be ~0.8
  });

  it('penalizes fallback data', () => {
    const liveQuality = buildFrameQuality(1, 500, false);
    const fallbackQuality = buildFrameQuality(1, 500, true);
    
    expect(fallbackQuality.confidence).toBe(liveQuality.confidence * 0.5);
  });

  it('agent respects minConfidence', () => {
    const ctx = {
      quality: { confidence: 0.4, ... },
      constraints: { minConfidence: 0.6 }
    };
    
    expect(() => assertAgentCanTrade(ctx)).toThrow();
  });

  it('execution blocks fallback in live mode', () => {
    const ctx = {
      mode: 'LIVE',
      quality: { isFallback: true, confidence: 0.9, ... },
      constraints: { allowTrade: true, ... }
    };
    
    expect(() => assertExecutionAllowed(ctx)).toThrow('fallback data in LIVE mode');
  });
});
```

---

## UI Bonus: Visual Confidence

Optional but powerful — expose confidence visually:

```typescript
<div className="confidence-indicator">
  {/* Thin bar under chart showing confidence */}
  <div 
    className="confidence-bar"
    style={{ width: `${ctx.quality.confidence * 100}%` }}
  />
  
  {/* Badge for low confidence */}
  {ctx.quality.confidence < 0.6 && (
    <div className="warning-badge">
      ⚠️ LOW DATA CONFIDENCE
    </div>
  )}
  
  {/* Opacity scaling */}
  <div 
    className="price-display"
    style={{ opacity: 0.5 + ctx.quality.confidence * 0.5 }}
  >
    ${ctx.frame.close}
  </div>
</div>
```

Now **humans also respect uncertainty**.

---

## Deployment Checklist

- [ ] FrameQuality added to MarketFrame type
- [ ] buildFrameQuality() used at frame assembly (not in agents, not in storage)
- [ ] DecisionContext includes quality envelope
- [ ] Agents check `ctx.quality.confidence >= ctx.constraints.minConfidence`
- [ ] Agents return null if `ctx.quality.isFallback && ctx.mode === 'LIVE'`
- [ ] Execution layer calls `assertExecutionAllowed(ctx)`
- [ ] Tests verify confidence scoring is deterministic
- [ ] Tests verify fallback blocks live trading
- [ ] Tests verify agent quality thresholds are enforced
- [ ] (Optional) UI shows confidence bar and LOW CONFIDENCE warning

---

## The Architecture Upgrade

You've moved from:

> "Storage as truth"

To:

> **"Storage as memory, quality as belief"**

This is a cognitive architecture shift. It separates:
- **Data** (what happened)
- **Quality** (how sure we are)
- **Execution** (what we'll do about it)

That's institution-grade thinking. 🎯

---

## Hard Rule to Encode

> **No decision without declared confidence.**

If something can't explain how sure it is — it doesn't get to act.

