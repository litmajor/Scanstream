# Data Layer Architecture: RawTick → MarketFrame → DecisionContext → UITick

## Overview

Scanstream implements a **four-layer data metabolism** that ensures every piece of information is transformed through validated boundaries. This prevents silent failures, rogue intelligence, and data corruption.

```
Exchange Event
   ↓
RawTick          (truth, untrusted, noisy)
   ↓
MarketFrame      (aggregated, validated, time-bucketed)
   ↓
DecisionContext  (agent-ready, scoped, confidence-aware)
   ↓
UITick           (human-facing, annotated, safe)
```

Each layer **reduces entropy**, **adds meaning**, and **narrows responsibility**.

---

## 🟥 Layer 1: RawTick — Exchange Truth (Unstable by Design)

**Purpose:** Represent *exactly* what the exchange says — nothing more.

**Characteristics:**
- No indicators
- No interpretation
- No assumptions
- Can be wrong, duplicated, late, or missing

**Example:**
```typescript
{
  ts: 1702497850420,
  exchange: 'binance',
  symbol: 'BTCUSDT',
  price: 42567.89,
  size: 0.5,
  side: 'buy',
  tradeId: '12345678',
  seq: 9876543
}
```

**Rules:**
- ❌ Agents NEVER see RawTick
- ❌ UI NEVER sees RawTick
- ✅ Stored only in buffers/streams, never persisted to DB
- ✅ Immediately converted to MarketFrame or UITick

**Why:** Raw data is radioactive ☢️ — powerful but unsafe. It can be stale, duplicated, or misleading when taken out of context.

---

## 🟧 Layer 2: MarketFrame — World State (Reality Model)

**Purpose:** Describe *what the market looks like* at a moment in time. This is what your **system believes**, not what any single exchange said.

**Characteristics:**
- Time-bucketed (1s, 1m, 5m, etc.)
- Multi-exchange aware (optional)
- Deterministic and replayable
- Stored in database

**Example:**
```typescript
{
  symbol: 'BTCUSDT',
  timeframe: '1m',
  open: 42500.00,
  high: 42600.00,
  low: 42450.00,
  close: 42567.89,
  volume: 125.34,
  indicators: {
    ema20: 42520.00,
    vwap: 42555.00,
    atr: 150.00,
    rsi: 65.5,
    macd: { line: 45.20, signal: 42.10, histogram: 3.10 },
    bb: { upper: 42750, middle: 42600, lower: 42450 }
  },
  microstructure: {
    spread: 0.15,
    imbalance: 0.58,
    aggression: 0.62
  },
  meta: {
    tsOpen: 1702497600000,
    tsClose: 1702497660000,
    isFinal: true,
    exchangeCount: 1,
    latencyMs: 45,
    source: 'live'
  }
}
```

**Rules:**
- ✅ Stored in DB for replay and analysis
- ✅ Deterministic (same RawTicks → same MarketFrame)
- ✅ Replayable (can reconstruct from DB)
- ❌ No trading decisions yet (that's DecisionContext's job)

**Why:** MarketFrame is your **ground truth**. Once persisted, it's immutable and reproducible. Agents and the UI reference it, but they don't create it — a dedicated aggregator does.

---

## 🟨 Layer 3: DecisionContext — Agent Perception (Safety Boundary)

**Purpose:** Give agents *just enough reality* to act safely and predictably. This is where **risk, confidence, and scope** enter.

**Characteristics:**
- Read-only (frozen)
- Immutable
- Scoped to agent needs
- Confidence-aware
- Constrained (maxSizeUsd, allowTrade, etc.)

**Example:**
```typescript
{
  symbol: 'BTCUSDT',
  timeframe: '1m',
  frame: { /* MarketFrame */ },
  signals: {
    trend: 'up',
    breakout: true,
    momentum: 'strong'
  },
  quality: {
    confidence: 0.87,
    isStale: false,
    isFallback: false
  },
  constraints: {
    allowTrade: true,
    maxSizeUsd: 10000,
    maxLeverage: 1.0
  },
  createdAt: 1702497850420,
  contextId: 'ctx_BTCUSDT_1702497850420_a1b2c3d'
}
```

**Rules:**
- ❌ Agents NEVER mutate DecisionContext
- ❌ Agents NEVER fetch from storage directly
- ✅ Agents act ONLY on DecisionContext
- ✅ DecisionContext is frozen (immutable) in production

**Why:** Prevents **rogue intelligence**. By constraining what agents can see and do, you bound the blast radius of any agent bug. Constraints like `maxSizeUsd` and `allowTrade` provide hard limits on agent behavior.

---

## 🟩 Layer 4: UITick — Human Reality (Safe Display)

**Purpose:** Tell humans what's happening *without lying*. Only safe, annotated data reaches the human eye.

**Characteristics:**
- Annotated
- Opinionated
- Explicit uncertainty
- Never raw
- Explicitly marked as LIVE or REPLAY

**Example:**
```typescript
{
  ts: 1702497850420,
  symbol: 'BTCUSDT',
  price: 42567.89,
  priceChange: 67.89,
  priceChangePercent: 0.16,
  volume: 0.5,
  overlays: {
    signal: 'breakout',
    confidence: 0.87,
    label: 'Bullish breakout above 42500'
  },
  state: {
    mode: 'LIVE',
    isFinal: false,
    origin: 'WS'
  },
  warnings: []
}
```

**Rules:**
- ❌ UI NEVER infers missing data
- ❌ UI NEVER computes indicators on the fly
- ✅ UI ONLY renders declared truth from UITick
- ✅ UITick must include explicit source and uncertainty

**Why:** Prevents **user confusion** and **silent data corruption** in the display layer. If data is stale or from fallback, the UI must show it. The UI is the last defense against presenting lies to humans.

---

## 🔐 Hard Invariants (Very Important)

These are **enforced at runtime** in `client/src/lib/invariants.ts`:

1. **RawTick ❌→ Agent**: `assertNoRawTickToAgent()`
2. **RawTick ❌→ UI**: `assertNoRawTickToUI()`
3. **Agent ❌→ Storage**: `assertNoAgentWriteToStorage()`
4. **UI ❌→ Decision**: `assertNoUIToDecision()`
5. **Replay ≠ Live**: `assertReplayExplicit()`
6. **DecisionContext is Read-Only**: `assertDecisionContextImmutable()`
7. **MarketFrame Source Matches Mode**: `assertMarketFrameSourceMatchesMode()`

Violating any of these = **bug**. The invariant guards will throw in development/testing.

---

## 🧪 Mapping to Scanstream Components

| Step | Component | Responsibility |
|------|-----------|---|
| Exchange → RawTick | CCXT / WebSocket handler | Parse and validate raw trades |
| RawTick → MarketFrame | `ExchangeAggregator` / `storage.createMarketFrame()` | Time-bucket, aggregate, add indicators |
| MarketFrame → DecisionContext | `signal-pipeline.ts` / Agent coordinator | Apply risk constraints, freeze |
| DecisionContext → Decision | Agent / `MarketAgent` | Consume and emit trading signals |
| MarketFrame → UITick | `MarketDataLayer.subscribe()` / `createUITick()` | Annotate, mark source/mode, warn on issues |
| UITick → Render | React components / `trading-terminal.tsx` | Display declared truth only |

---

## 🧠 Why This Makes You Safer Than Most Platforms

**Most platforms:**
- Mix raw + derived data everywhere
- Let UI calculate indicators
- Let agents fetch DB directly
- Confuse replay with live data

**Scanstream (after this upgrade):**
- ✅ Raw data is isolated in buffers
- ✅ Only MarketFrames and UITicks reach agents/UI
- ✅ Agents receive constrained DecisionContext only
- ✅ Replay is explicitly marked (source='replay')
- ✅ UI renders only declared, annotated truth
- ✅ Invariants are enforced at runtime

You're building a **truth pipeline**, not a charting app.

---

## 📝 Implementation Checklist

- [x] Define `RawTick` interface + guards
- [x] Define `MarketFrame` interface + factory
- [x] Define `DecisionContext` interface + freeze
- [x] Define `UITick` interface + factories
- [x] Create `invariants.ts` with hard checks
- [ ] Update `marketDataLayer.ts` to emit UITick
- [ ] Update agents to consume DecisionContext
- [ ] Add type exports to `client/src/types/index.ts`
- [ ] Update documentation (this file)
- [ ] Add unit tests for invariants
- [ ] Add runtime enforcement in critical paths

---

## 🚀 Quick Start: Using These Types

### Agents

```typescript
import { DecisionContext } from '../types/DecisionContext';
import { verifyDataLayerInvariants } from '../lib/invariants';

export function myAgent(ctx: DecisionContext): void {
  // Verify invariants
  verifyDataLayerInvariants(ctx, { source: 'agent', mode: 'live' });

  // Read frame (immutable)
  const { frame, signals, constraints } = ctx;

  // Act only within constraints
  if (constraints.allowTrade && frame.meta.source === 'live') {
    // emit decision...
  }

  // NEVER do this:
  // ctx.frame.close = 99999;  // ❌ Frozen, will throw
  // storage.saveFrame(frame); // ❌ Agents don't write storage
}
```

### UI

```typescript
import { UITick, createLiveUITick } from '../types/UITick';
import { assertUITick } from '../types/UITick';

export function renderTick(raw: any): void {
  const tick = createLiveUITick(raw, 'WS');
  assertUITick(tick);

  return (
    <div>
      <span>{tick.symbol} ${tick.price}</span>
      {tick.warnings?.map(w => <Warning key={w}>{w}</Warning>)}
      <Badge mode={tick.state.mode} />
    </div>
  );
}
```

---

## 📚 Files

- `client/src/types/RawTick.ts` — Exchange truth
- `client/src/types/MarketFrame.ts` — System reality
- `client/src/types/DecisionContext.ts` — Agent perception
- `client/src/types/UITick.ts` — Human display
- `client/src/lib/invariants.ts` — Hard rules + runtime checks
- `DATA_LAYER_ARCHITECTURE.md` — This document
