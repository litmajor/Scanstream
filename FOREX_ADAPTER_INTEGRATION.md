# FOREX ADAPTER INTEGRATION — Source-Agnostic Architecture

**Status:** Forex (OANDA) now flows through the same IntegrityGate as CCXT crypto data.

**Key Principle:** Agents do not know or care whether data came from forex or crypto. Same World Ticks. Same physics.

---

## 1. Architecture Overview

### Before (Source-Dependent)

```
CCXT Crypto ──→ [CCXT-specific logic] ──→ Agents
OANDA Forex ──→ [OANDA-specific logic] ──→ Agents
MT5 Equities ──→ [MT5-specific logic] ──→ Agents

Result: Three different code paths, three different agent behaviors
```

### After (Source-Agnostic — Phase 3+4)

```
CCXT Crypto ──→ ADAPTER ──→ INTEGRITY GATE ──→ WORLD TICKS ──→ AGENTS
OANDA Forex ──→ ADAPTER ──→ INTEGRITY GATE ──→ WORLD TICKS ──→ AGENTS
MT5 Equities ──→ ADAPTER ──→ INTEGRITY GATE ──→ WORLD TICKS ──→ AGENTS

Result: One code path, one set of agents, one physics engine
```

---

## 2. Component Responsibility Matrix

| Component | Responsibility | NOT Responsible |
|-----------|---|---|
| **OandaAdapter** | Convert OANDA format → Candle[] | Validation, storage, ticking |
| **OandaClient** | HTTP requests to OANDA API | Parsing, retries, caching |
| **IntegrityGate** | Validate, store, emit world ticks | Adapter details, OANDA API |
| **CandleIntegrityLayer** | Gap detection, finality, OHLC validation | API calls, storage |
| **Agents** | React to world ticks | Know which source data came from |

**Principle:** Each component has one responsibility. Clear boundaries enable swappable sources.

---

## 3. Canonical Candle Contract

All adapters must return this shape:

```typescript
type Candle = {
  ts: number;           // Open timestamp (milliseconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;       // Tick volume for forex (not standard)
  isFinal: boolean;     // Candle closed?
  source?: string;      // 'ccxt' | 'oanda' | 'mt5'
  venue?: string;       // 'binance' | 'oanda' | etc
  raw?: any;            // Raw source data for debugging
}
```

**OANDA Example:**

```typescript
{
  ts: 1705161600000,                    // 2024-01-13 16:00:00 UTC
  open: 1.0955,
  high: 1.0967,
  low: 1.0945,
  close: 1.0960,
  volume: 42000,                        // Tick count
  isFinal: true,
  source: 'oanda',
  venue: 'OANDA',
  raw: { time: "2024-01-13T16:00:00Z", complete: true, ... }
}
```

---

## 4. OANDA Adapter Implementation

### OandaClient (HTTP Wrapper)

```typescript
// server/services/gateway/forex/oanda-client.ts

class OandaClient {
  async getCandles(params: OandaCandlesRequest): Promise<OandaCandleResponse | null>
}
```

**Responsibility:**
- Pure HTTP calls to OANDA REST API
- No retry logic (caller handles retries)
- No caching (caller decides caching)
- Error logging only

**Example:**

```typescript
const client = new OandaClient({
  apiKey: process.env.OANDA_API_KEY,
  accountId: process.env.OANDA_ACCOUNT_ID,
  environment: 'practice', // sandbox
});

const response = await client.getCandles({
  instrument: 'EUR_USD',
  granularity: 'M1',
  count: 50,
  price: 'M', // mid price
});
```

### OandaAdapter (Normalization)

```typescript
// server/services/gateway/forex/oanda-adapter.ts

class OandaAdapter {
  async fetchCandles(
    symbol: string,
    timeframeSeconds: number,
    limit: number
  ): Promise<Candle[]>
}
```

**Responsibility:**
- Map timeframes: 60 → M1, 300 → M5, 3600 → H1, etc.
- Convert OANDA format → Candle[]
- Preserve metadata (source, isFinal)

**Example:**

```typescript
const adapter = new OandaAdapter(client);

const candles = await adapter.fetchCandles(
  'EUR_USD',    // OANDA symbol format
  300,          // 5 minutes (in seconds)
  100           // fetch 100 candles
);

// Returns: Candle[] with source='oanda'
```

---

## 5. IntegrityGate (Unchanged)

The gate works identically for all sources:

```typescript
const result = await integrityGate.storeValidatedCandles(
  symbol: 'EUR/USD',
  timeframe: 300,
  candles: forexCandles  // OANDA-sourced candles
);

// Returns: { stored, rejected, gaps, ticks }
```

**What the gate does (for forex):**
- ✅ Validates OHLC structure
- ✅ Enforces timestamp alignment
- ✅ Detects gaps (within-batch + cross-batch)
- ✅ Stores to database
- ✅ Emits World Ticks
- ❌ Never knows it's forex (source-agnostic)

---

## 6. ForexEngine (Orchestrator)

Mirrors CCXT Scanner pattern:

```typescript
// server/services/forex-engine.ts

class ForexEngine {
  async scanSymbols(options: ForexScanOptions): Promise<ForexScanResult[]>
  onWorldTick(listener: (tick: WorldTick) => void): void
  onGapDetected(listener: (event: any) => void): void
}
```

**Example:**

```typescript
const forexEngine = new ForexEngine(
  {
    oandaApiKey: process.env.OANDA_API_KEY,
    oandaAccountId: process.env.OANDA_ACCOUNT_ID,
    oandaEnvironment: 'practice',
  },
  integrityGate
);

// Fetch and validate forex candles
const results = await forexEngine.scanSymbols({
  symbols: ['EUR_USD', 'GBP_JPY', 'USD_CAD'],
  timeframeSeconds: 300,      // 5-minute candles
  limit: 100,
  parallel: true,
});

// Subscribe to world ticks (identical to CCXT)
forexEngine.onWorldTick((tick) => {
  console.log(`[Agent] ${tick.symbol} closed at ${tick.candle.close}`);
  // Agent logic is identical whether source is CCXT or OANDA
});

// Subscribe to gaps
forexEngine.onGapDetected((event) => {
  console.log(`[Alert] Gap detected: ${event.gap.missingCandles} candles`);
});
```

---

## 7. Timeframe Support

### Supported Timeframes

OANDA supports these granularities (mapped from seconds):

| Seconds | OANDA | Name |
|---------|-------|------|
| 60 | M1 | 1 minute |
| 300 | M5 | 5 minutes |
| 900 | M15 | 15 minutes |
| 1800 | M30 | 30 minutes |
| 3600 | H1 | 1 hour |
| 7200 | H2 | 2 hours |
| 10800 | H3 | 3 hours |
| 14400 | H4 | 4 hours |
| 21600 | H6 | 6 hours |
| 28800 | H8 | 8 hours |
| 43200 | H12 | 12 hours |
| 86400 | D | 1 day |
| 604800 | W | 1 week |
| 2592000 | M | 1 month |

### Usage

```typescript
// Check if timeframe is supported
if (OandaAdapter.isTimeframeSupported(300)) {
  console.log('5-minute candles supported');
}

// Get all supported timeframes
const supported = OandaAdapter.getSupportedTimeframes();
// [60, 300, 900, 1800, 3600, ...]
```

---

## 8. Data Flow Example

### Scenario: Real-time EUR/USD scanning

```typescript
// 1. Initialize engine
const forexEngine = new ForexEngine(config, integrityGate);

// 2. Fetch 5-minute candles from OANDA
const results = await forexEngine.scanSymbols({
  symbols: ['EUR_USD'],
  timeframeSeconds: 300,
  limit: 50,
});

// Behind the scenes:
// 
// OANDA API
//   ↓ (raw OANDA candles)
// OandaAdapter.fetchCandles()
//   ↓ (Candle[] { source: 'oanda', ... })
// IntegrityGate.storeValidatedCandles()
//   ├─ CandleIntegrityLayer.validateAndNormalize()
//   │   ├─ Validate OHLC
//   │   ├─ Check timestamps
//   │   ├─ Detect gaps (Phase 3)
//   │   └─ Enforce finality
//   ├─ storage.createMarketFrame() → database
//   ├─ emit 'world.tick' event
//   └─ emit 'gap.detected' event (if gaps found)
//   ↓
// Agent subscriptions
//   ├─ onWorldTick() → trading logic
//   └─ onGapDetected() → pause/adjust

// 3. Results
// {
//   symbol: 'EUR_USD',
//   timeframeSeconds: 300,
//   ticksEmitted: 45,      // 45 candles validated
//   gapsDetected: 0,       // No gaps
//   stored: 45,            // All stored
//   rejected: 5,           // 5 had issues (alignment, etc)
//   timestamp: Date
// }
```

---

## 9. Comparison: CCXT vs OANDA Path

Both follow identical flow:

### CCXT Path
```
CCXTScanner
  ├─ exchange.fetchOHLCV()
  ├─ returns: [[ts, o, h, l, c, v], ...]
  └─ maps to Candle[] { source: 'ccxt', ... }
       ↓
IntegrityGate.storeValidatedCandles()
```

### OANDA Path (New)
```
ForexEngine
  ├─ OandaAdapter.fetchCandles()
  ├─ client.getCandles()
  ├─ returns: { candles: [...] }
  └─ maps to Candle[] { source: 'oanda', ... }
       ↓
IntegrityGate.storeValidatedCandles()
```

**Result:** Identical downstream processing.

---

## 10. Gap Detection for Forex

### Why Forex Has Gaps

```
Friday 17:00 UTC: Last candle
                  [Market closes for weekend]
Monday 08:00 UTC: First candle

Gap = 55 hours = 660 x 5-minute candles missing
```

### Phase 3 Detection

The integrity layer automatically detects this:

```
Last stored: 2024-01-12 17:00:00 UTC (BID: 1.0950)
First new:  2024-01-15 08:00:00 UTC (BID: 1.0960)

Delta = 55 hours
Expected = 5 minutes
Missing = 660 candles

Emitted: gap.detected { 
  symbol: 'EUR/USD',
  gap: { from, to, missingCandles: 660 },
  severity: 'high',
}
```

### Agent Behavior (Recommended)

```typescript
forexEngine.onGapDetected((event) => {
  if (event.severity === 'high') {
    // Weekend/holiday gap
    agent.pauseTrading(event.gap.to);
    console.log(`⏸️ Pausing until ${new Date(event.gap.to).toISOString()}`);
  }
});
```

---

## 11. Configuration (Environment Variables)

```bash
# OANDA Credentials
OANDA_API_KEY=your-api-key-here
OANDA_ACCOUNT_ID=your-account-id-here
OANDA_ENVIRONMENT=practice  # or 'live'

# Integrity Gate (applies to all sources)
INTEGRITY_GATE_ENABLED=true
MAX_TIMESTAMP_DRIFT_MS=5000
```

---

## 12. Testing

### Unit Test: Adapter Normalization

```typescript
import { OandaAdapter } from './oanda-adapter';

describe('OandaAdapter', () => {
  it('normalizes OANDA candles to Candle[]', () => {
    const mockClient = {
      getCandles: async () => ({
        candles: [
          {
            time: '2024-01-13T16:00:00Z',
            complete: true,
            volume: 42000,
            mid: { o: '1.0950', h: '1.0967', l: '1.0945', c: '1.0960' },
          },
        ],
      }),
    };

    const adapter = new OandaAdapter(mockClient as any);
    const candles = await adapter.fetchCandles('EUR_USD', 3600, 1);

    expect(candles[0]).toEqual({
      ts: 1705161600000,
      open: 1.0950,
      high: 1.0967,
      low: 1.0945,
      close: 1.0960,
      volume: 42000,
      isFinal: true,
      source: 'oanda',
      venue: 'OANDA',
    });
  });

  it('maps timeframes correctly', () => {
    expect(OandaAdapter.isTimeframeSupported(300)).toBe(true);   // M5
    expect(OandaAdapter.isTimeframeSupported(123)).toBe(false);  // Unsupported
  });
});
```

### Integration Test: Full Flow

```typescript
describe('ForexEngine Integration', () => {
  it('emits world ticks for forex candles', async () => {
    const engine = new ForexEngine(config, integrityGate);
    const ticks: WorldTick[] = [];

    engine.onWorldTick((tick) => ticks.push(tick));

    const results = await engine.scanSymbols({
      symbols: ['EUR_USD'],
      timeframeSeconds: 300,
      limit: 10,
    });

    expect(results[0].ticksEmitted).toBeGreaterThan(0);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].source).toContain('oanda');
  });
});
```

---

## 13. Performance Impact

### Per-Symbol Fetch

| Operation | Time | Cost |
|-----------|------|------|
| HTTP request (OANDA) | ~100ms | Minimal |
| Candle normalization | <1ms | Negligible |
| Integrity validation | ~10ms | Per-candle overhead |
| Storage | ~5ms | Database write |
| World Tick emission | <1ms | Event overhead |
| **Total per symbol** | ~115ms | Acceptable |

### Parallel Scanning

```
Sequential: 10 symbols × 115ms = 1.15 seconds
Parallel:   10 symbols ∥ 115ms = ~115ms (+ overhead)

Improvement: 10x faster with parallel=true
```

---

## 14. Error Handling

### Network Errors

```typescript
const candles = await adapter.fetchCandles('EUR_USD', 300, 50);

if (candles.length === 0) {
  // OANDA unreachable or returned error
  console.error('[ForexEngine] Failed to fetch EUR_USD');
  // Fallback: skip this symbol, retry on next cycle
}
```

### Validation Errors

```typescript
// Adapter returns malformed candles
const result = await gate.storeValidatedCandles(..., badCandles);

console.log(`Rejected: ${result.rejected.length}`);
// Gate handles validation, adapter doesn't need to
```

---

## 15. Future Expansions

Now that forex is source-agnostic, these become easy:

### 1. Multi-Source Arbitration
```typescript
// OANDA + MT5 for same pair → one truth
const sources = ['oanda', 'mt5'];
const trustedCandle = arbitrate(sources);
```

### 2. Session-Aware Rules
```typescript
// Different validation rules for Asia/London/NY sessions
const rules = sessionAwareRules(symbol, time);
```

### 3. Cross-Asset Correlation
```typescript
// BTC movement correlated with EUR/USD strength
const correlation = await analyzeCorrelation('BTC', 'EUR_USD');
```

### 4. Healing Strategies (Phase 4)
```typescript
// Fill forex gaps with interpolation
const healed = await healGaps(gapEvent, strategy='linear');
```

---

## 16. Summary

| Aspect | Status |
|--------|--------|
| **OANDA Adapter** | ✅ Complete |
| **OandaClient** | ✅ Complete |
| **ForexEngine** | ✅ Complete |
| **IntegrityGate Integration** | ✅ No changes needed (source-agnostic) |
| **Gap Detection** | ✅ Phase 3 (both sources) |
| **World Ticks** | ✅ Identical for all sources |
| **Agent Integration** | ✅ No source awareness needed |
| **Testing** | 🟡 Ready for manual validation |

---

## 17. Quick Start

```typescript
// 1. Initialize
const forexEngine = new ForexEngine(
  {
    oandaApiKey: process.env.OANDA_API_KEY,
    oandaAccountId: process.env.OANDA_ACCOUNT_ID,
  },
  integrityGate
);

// 2. Fetch forex candles
const results = await forexEngine.scanSymbols({
  symbols: ['EUR_USD', 'GBP_JPY'],
  timeframeSeconds: 300,
});

// 3. Agents react (identical to crypto)
forexEngine.onWorldTick((tick) => {
  agent.evaluateTrade(tick);  // Same logic for forex
});

// Done. No special cases. Same world.
```

---

## Architecture Lock (MAINTAINED)

PHASE 2 + 3 + 4 ordering is PRESERVED:

```
SOURCE (CCXT / OANDA / MT5)
   ↓
ADAPTER (normalizes)
   ↓
INTEGRITY & GATES
   ↓
WORLD TICK EMISSION
   ↓
AGENTS
```

Forex is just another source, not a special case.

