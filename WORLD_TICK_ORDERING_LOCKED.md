# 🧭 WORLD TICK ORDERING — NON-NEGOTIABLE

## Executive Summary

The order in which data flows through your system determines whether your world is truthful or lies to itself.

This document locks the canonical ordering forever:

```
SOURCE (CCXT / OANDA / MT5)
  ↓
ADAPTER (normalizes raw data)
  ↓
INGESTION BUFFER
  ↓
INTEGRITY & GAP CHECKS
  ↓
CANDLE FINALITY LOGIC
  ↓
📍 WORLD TICK EMISSION ← Facts only, validated data
  ↓
storage.createMarketFrame() (historical record)
  ↓
RPG / AGENTS / STRATEGIES (subscribe to world.tick)
```

## The Critical Rule

```
No agent is allowed to react to raw adapter output.
Agents only react to World Ticks (validated, canonical facts).
```

If you emit a World Tick before validation, your agents see lies:
- Partial candles (not yet closed)
- Rewritten history (corrections)
- Inconsistent timelines (gaps)
- Duplicates and revisions

This breaks:
- RL reward signals (inconsistent world state)
- ML training integrity (poisoned labels)
- Physics simulations (violations of law)
- Strategy determinism (different replay produces different results)

## What Each Layer Does

### 1. SOURCE (CCXT / OANDA / MT5)
Fetches raw market data from venue APIs.

```typescript
// Raw claims from CCXT
{
  timestamp: 1702505400000,
  open: 45123.50,
  high: 45678.00,
  low: 45000.00,
  close: 45234.10,
  volume: 1234.56
}
```

These are **claims**, not yet truths.

### 2. ADAPTER (Normalizes)
Converts venue-specific formats to internal Candle format.

```typescript
interface Candle {
  ts: number;          // normalized timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal: boolean;    // Is candle closed?
  source: string;      // 'ccxt', 'oanda', etc
  venue: string;       // 'binance', 'kraken', etc
}
```

These are **normalized claims**.

### 3. INGESTION BUFFER
Accumulates candles from adapter. Allows time for finality checks.

```typescript
// Buffer holds up to 20 candles waiting for validation
const buffer = [
  { ts: 1702505400000, close: 45234.10, isFinal: false }, // Still open
  { ts: 1702505340000, close: 45123.45, isFinal: true },  // Closed ✅
];
```

### 4. INTEGRITY & GAP CHECKS
The truth gate. Answers critical questions:

- ✅ Is timestamp aligned to interval boundary?
  - 1h candle must close at :00:00, not :15:30
- ✅ Is candle continuous (no gaps)?
  - If previous close was 12:00, next open should be 12:01
- ✅ Is it finalized?
  - Only closed candles are canonical
- ✅ Is it duplicate or revised?
  - Same timestamp twice = reject first, use second
- ✅ Does OHLC make sense?
  - high >= low, close/open within range

```typescript
// Integrity layer validates each candle
const report = layer.validateAndNormalize(candles);

report.valid;    // Candles that passed all checks
report.rejected; // Candles that failed (with reasons)
report.gaps;     // Missing candles (opportunities to heal or alert)
```

### 5. CANDLE FINALITY LOGIC
Mark candles as final if:
- Timestamp is in the past (not current period)
- No revisions expected from venue

Current period candles (e.g., "we're still in the 12:05 minute") are NOT final.

```typescript
// Only closed candles advance the world
if (candle.isFinal && candle.ts < Date.now()) {
  // Safe to emit as World Tick
}
```

### 6. 📍 WORLD TICK EMISSION
**This is where the world advances.**

A World Tick is a fact: "The world reached this state at this time."

```typescript
interface WorldTick {
  symbol: string;
  timeframe: number;        // seconds
  timestamp: number;        // ms when this fact emerged
  candle: Candle;          // The validated candle
  isFinal: boolean;        // History is frozen
  source: string;          // 'ccxt', 'oanda', etc
}

// Emitted once per validated candle
globalMarketDataLayer.emit('world.tick', {
  symbol: 'BTC/USDT',
  timeframe: 3600,
  timestamp: Date.now(),
  candle: {
    ts: 1702505400000,
    open: 45123.50,
    high: 45678.00,
    low: 45000.00,
    close: 45234.10,
    volume: 1234.56,
    isFinal: true,
  },
  isFinal: true,
  source: 'ccxt:binance',
});
```

**Semantics:**
- `candle.ts` = canonical time (when did this happen in the market?)
- `isFinal: true` = history is frozen (agents may safely learn)
- **Emitted after storage write** = agents know data is persisted

### 7. storage.createMarketFrame()
Historical record. Already validated, so this is safe.

```typescript
// Only validated candles reach here
await storage.createMarketFrame({
  symbol: 'BTC/USDT',
  timeframe: 3600,
  timestamp: new Date(candle.ts),
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume,
  isFinal: candle.isFinal,
});
```

### 8. RPG / AGENTS / STRATEGIES
Only agents can react to World Ticks. Never to polling.

```typescript
// ✅ CORRECT: Subscribe to world ticks
globalMarketDataLayer.on('world.tick', (tick: WorldTick) => {
  rpg.process(tick);
  ml.train(tick);
  rl.reward(tick);
  physics.simulate(tick);
});

// ❌ WRONG: Polling raw storage
setInterval(async () => {
  const frames = await storage.getMarketFrames(symbol);
  agents.react(frames); // Agents see partial, unvalidated data!
}, 1000);
```

---

## Why This Order Prevents Lies

### Scenario 1: Emit World Tick Before Validation

```
BEFORE VALIDATION:
12:01:00 - CCXT claims: open=100, close=105, volume=1000

Your code:
emit('world.tick', { close: 105 })  // ❌ NO VALIDATION YET

Then validation discovers:
  ❌ Gap: Previous close was 102, this opens at 100 (huge jump)
  ❌ OHLC invalid: close=105 but high=103 (contradiction!)

But agents already reacted to the lie:
- ML trained on fake jump (100→105)
- RL earned reward for action based on gap
- Physics calculated work assuming continuity

Later when corrected: Different simulation = Different replay = Lost trust
```

### Scenario 2: Correct Order (Validation First)

```
CCXT claims: open=100, close=105, volume=1000

Integrity layer checks:
  ✅ Timestamp aligned to :01:00
  ✅ Continuous from previous (102→100 is a correction, mark as revision)
  ✅ OHLC valid after correction
  ✅ Finalized (candle closed 1 minute ago)

emit('world.tick', { close: 105, isFinal: true, isRevision: true })

Agents react to the FACT:
- ML trained on validated data
- RL earned reward from corrected state
- Physics obeyed conservation laws
- Replay is deterministic (same input = same output)
```

---

## Implementation Pattern

### Integrity Gate Emits World Ticks

```typescript
// server/services/market-data/integrity-gate.ts

async storeValidatedCandles(
  symbol: string,
  timeframe: number,
  candles: Candle[]
): Promise<{
  stored: ValidatedCandle[];
  rejected: Candle[];
  gaps: any[];
  ticks: WorldTick[];  // NEW: Return ticks
}> {
  // 1. Validate
  const report = layer.validateAndNormalize(candles);

  // 2. Store only valid candles
  const stored = [];
  const ticks = [];
  
  for (const validCandle of report.valid) {
    // 2a. Write to storage
    await storage.createMarketFrame({ ...validCandle });
    stored.push(validCandle);

    // 2b. Emit World Tick (FACTS ONLY)
    const tick: WorldTick = {
      symbol,
      timeframe,
      timestamp: Date.now(),
      candle: validCandle,
      isFinal: validCandle.isFinal,
      source: validCandle.source,
    };

    ticks.push(tick);
    this.emit('world.tick', tick);  // ✅ Agents see this
  }

  return { stored, rejected, gaps, ticks };
}
```

### Data Sources Use This Pattern

All three data sources (trading-engine, exchange-aggregator, ccxt-scanner) follow:

```typescript
// server/trading-engine.ts

async function fetchAndValidate() {
  // Step 1: Fetch from CCXT
  const frames = await this.exchangeDataFeed.fetchMarketData(symbol);

  // Step 2: Convert to Candle format
  const candles = frames.map(f => ({
    ts: f.timestamp,
    open: f.open,
    // ...
  }));

  // Step 3: Pass through integrity gate
  const gate = getIntegrityGate();
  const result = await gate.storeValidatedCandles(
    symbol,
    60, // timeframe
    candles
  );

  // ✅ World Ticks emitted automatically by integrity gate
  // ✅ Storage written by integrity gate
  // ✅ Agents already reacting to world.tick events

  return result.ticks;  // Return for monitoring if needed
}
```

### Agents Subscribe to World Ticks

```typescript
// server/agents/ml-agent.ts

import { getMarketDataLayer } from '../services/market-data/market-data-layer';

class MLAgent {
  constructor() {
    const mdl = getMarketDataLayer();

    // ✅ Only react to validated facts
    mdl.on('world.tick', (tick: WorldTick) => {
      // tick.candle is guaranteed to be:
      // - Aligned to interval boundary
      // - Continuous from history
      // - Finalized (not subject to revision)
      // - Valid OHLC values
      
      this.trainOnCandle(tick.candle);
    });
  }
}
```

---

## Verification Checklist

- [ ] Integrity gate is initialized at server startup
- [ ] All three data sources (trading-engine, exchange-aggregator, ccxt-scanner) use integrity gate
- [ ] Integrity gate calls `this.emit('world.tick', tick)` after storing each validated candle
- [ ] RPG, ML, RL agents subscribe to 'world.tick' event
- [ ] No agent calls `storage.getMarketFrames()` directly (polling is dead)
- [ ] Server logs show: `[IntegrityGate] ✅ World Tick: BTC/USDT 60s close=45234.10 final=true`
- [ ] Test: Stop server, replay logs, verify World Ticks are emitted only after validation

---

## Example Log Output (Correct)

```
[MDL] Market Data Layer initialized
[Phase 2] Candle Integrity Layer initialized
[Trading] Fetching BTC/USDT from binance
[IntegrityGate] Validating 10 candles for BTC/USDT:60s
[IntegrityGate] ✅ World Tick: BTC/USDT 60s close=45234.10 final=true
[IntegrityGate] ✅ World Tick: BTC/USDT 60s close=45245.50 final=true
[ML] Received world.tick for BTC/USDT, training...
[RL] Received world.tick for BTC/USDT, calculating reward...
[Physics] Received world.tick for BTC/USDT, running simulation...
```

---

## Example Log Output (WRONG — Detect This!)

```
❌ [Trading] Emitting world tick BEFORE integrity check
❌ [Gateway] Sending candles to client without validation
❌ [Agent] Polling storage directly: getMarketFrames() called
❌ [RL] Training on unvalidated data (gaps, duplicates)
```

---

## References

See implementation in:
- `server/services/market-data/integrity-gate.ts` — Emits world ticks
- `server/types/market-data.ts` — WorldTick interface
- `server/services/market-data/market-data-layer.ts` — MDL event emitter
- `server/trading-engine.ts` — Uses integrity gate
- `server/services/gateway/exchange-aggregator.ts` — Uses integrity gate
- `server/services/gateway/ccxt-scanner.ts` — Uses integrity gate

---

**Last Updated:** 2025-12-13  
**Status:** 🔒 LOCKED (Non-negotiable ordering)
