# BLAST RADIUS MAP — FULL

Complete merged blast-radius map for Scanstream (Dec 14, 2025).
This document combines the original detailed map (file-level references and consumers), the new MarketDataLayer (MDL) client contract, replay API expectations, and an operational playbook with monitoring thresholds and runbooks.

---

**Table of contents**
- Overview & canonical diagram
- Complete data flow (file references & call sites)
- Primary paths with line-level notes
- Consumers (who trusts the frames)
- Execution & blast radius (who trades on them)
- MarketDataLayer (MDL) contract (WS + replay + client behaviors)
- Failure modes & mitigations (detailed)
- Ops playbook: monitoring, alerting, thresholds, runbooks
- Replay pagination & API examples
- Appendix: WorldTick schema, recommended server checklist

---

## Overview & canonical diagram

Canonical single-line diagram:

```
EXTERNAL MARKETS (CCXT) → ExchangeAggregator → Gateway API + WS → Storage (MarketFrames) → Agents → Decision/Execution → CCXT Orders
                                                    ↘
                                                     → MarketDataLayer (WS + /api/replay) → Frontend (Trading Terminal)
```

Purpose:
- Document the paths that, if broken or corrupted, create risk to trading operations (orders placed incorrectly, stale data used for decisions, or UI misrepresentation of live data).
- Provide prescriptive server/client contracts to reduce mismatch risk between backend producers and `client/src/lib/marketDataLayer.ts` consumers.

---

## Complete data flow (file references & call sites)

This section lists the main files that create or consume market frames and their responsibilities. Where available, the original map included line references; those are included here as guidance to maintainers.

- `routes/gateway.ts` — Gateway REST endpoints (e.g. `GET /api/gateway/ohlcv/:symbol`, `GET /api/gateway/dataframe/:symbol`) — primary external API for charts and frames.
- `exchange-aggregator.ts` — `getAggregatedPrice()`, `getAggregatedOHLCV()`, `getMarketFrames(symbol)` — parallel fetches from healthy exchanges with caching.
- `ccxt-scanner.ts` — scanning and pattern detection (drives storage writes in scanner flows).
- `trading-engine.ts` — TradingEngine; `fetchMarketData()` and frame construction (original mapping references lines around `L1150-L1200` for fetchMarketData and `L73+` for ExchangeDataFeed). Responsible for persistent frames and periodic processing.
- `live-trading-engine.ts` — LiveTradingEngine (initialize, executeSignal, createOrder, updatePositions). Execution-critical; original map references `L2` near start.
- `db-storage.ts` / `storage.ts` — Storage abstractions: `createMarketFrame()` and `getMarketFrames()`; may be implemented with PostgreSQL (Prisma) or a SimpleFallbackStorage (in-memory).
- `services/gateway/signal-pipeline.ts` — Prepares signals for client broadcast (reads frames to compute signals)
- `routes/ml-signals.ts`, `routes/rl-signals.ts`, `services/physics-agents` — Agent producers/consumers that read frames.

Notes on line references (from original map excerpts):
- The original BLAST_RADIUS_MAP.md included references such as `trading-engine.ts:L73+`, `live-trading-engine.ts:L2`, `storage.createMarketFrame()` called near `Line 137` in the scanning path, and `trading-engine.fetchMarketData()` around `Line 1150-1200`. Keep these references in your editor to quickly jump to relevant code.

---

## Primary paths (detailed)

1) Gateway → Scanner → Storage
- `routes/gateway.ts` receives REST calls and triggers aggregator flows. `ExchangeAggregator` parallel-fetches exchange data and writes MarketFrames via `storage.createMarketFrame()`.
- Storage contains MarketFrame rows/objects with: symbol, timeframe, timestamp, OHLCV, volume, indicators, orderFlow, microstructure data, and metadata.

2) TradingEngine → Storage
- `trading-engine.ts` periodically fetches OHLCV from exchanges (via CCXT helper code), computes indicators, and writes MarketFrames used by agents and the gateway.

3) LiveTradingEngine → CCXT
- `live-trading-engine.ts` accepts signals and turns them into orders via CCXT. This path has the highest execution blast radius (placing money on chain).

4) MarketDataLayer (MDL) Live Path → Frontend
- The backend publishes realtime tick messages to a WS endpoint consumed by MDL. The UI subscribes to normalized symbols and processes ticks into live charts and aggregated feed-candles for decision support.

---

## Consumers — who trusts the frames

Files and systems that read `storage.getMarketFrames()` and therefore depend on correct frame data:
- ML Signals Agent (`routes/ml-signals.ts`) — training/inference for model predictions
- RL Agent (`routes/rl-signals.ts`) — policy decisions
- Physics Agents (`services/physics-agents/*`) — vector/momentum analysis
- Strategy Engine (`routes/strategies.ts`) — on-demand strategy execution
- Signal Pipeline (`services/gateway/signal-pipeline.ts`) — publishes signals to clients
- Backtesting frameworks and model trainers (`services/ml-model-trainer.ts`)

All of the above can suffer degraded correctness if frames are stale, misaligned between exchanges, or truncated.

---

## Execution & Blast Radius

Execution path summary (signal → order):

Signal Generated (agent) → Decision Layer → Filter (confidence/quorum) → LiveTradingEngine.executeSignal() → CCXT.createOrder() → Position Tracking & PnL

Blast radius implications:
- LiveTradingEngine bugs or stale frames can cause mis-priced or erroneous orders (CRITICAL).
- CCXT credentials compromise or misuse causes direct monetary loss (CRITICAL).

Mitigations (brief): feature flags, simulate mode, manual approvals for critical sizes, kill-switch, per-exchange key scoping.

---

## MarketDataLayer (MDL) — contract and client behaviors

This section defines the expected WS message shapes, client behaviors implemented in `client/src/lib/marketDataLayer.ts`, and the HTTP replay contract.

Client responsibilities (already implemented in MDL client):
- Maintain a single WS connection with reconnect/backoff.
- Provide `subscribe(symbol, opts, handler)` which returns `{ unsubscribe(), pause(), resume(), requestReplay(from,to) }`.
- Buffer incoming ticks per-subscription, dedupe/out-of-order suppression, basic rate-limit delivery to handlers.
- Emit lifecycle events: `connected`, `disconnected`, `retry`, `error` for UI observability.
- `validateWorldTick(t)` type guard: expects fields (timestamp, symbol, price) and accepts seconds or ms timestamps defensively.

WS message contract (recommended):

```json
{ "type": "tick", "symbol": "BTCUSDT", "tick": { "timestamp": 1700000000000, "symbol": "BTCUSDT", "price": 47000.12, "side": "buy", "size": 0.1 } }
```

Notes:
- `symbol` should be normalized (UPPERCASE, no slash) — e.g. `BTCUSDT` — to match client subscription patterns. MDL will attempt to match `BTC/USDT` defensively.
- `tick.timestamp` should be epoch milliseconds. MDL accepts seconds and will normalize when necessary, but server should send ms to avoid ambiguity.

Replay API contract (HTTP):

```
GET /api/replay?symbol=BTCUSDT&from=1700000000000&to=1700000600000
Response: 200 OK
[
  { "timestamp":1700000000000, "symbol":"BTCUSDT", "price":..., "side":..., "size":... },
  ...
]
```

MDL client behavior for `requestReplay(from,to)`:
- Attempt to fetch server-side replay via `/api/replay` using normalized symbol.
- If server call fails/returns non-OK, MDL falls back to delivering the local in-memory subscription buffer to the handler.
- Returned ticks should be validated and timestamps normalized (seconds→ms) if required.

---

## Failure modes & mitigations (detailed)

1) CCXT / Exchange connectivity loss
- Impact: High (gateway endpoints, trading engine, execution)
- Mitigations:
  - Cache layer (5–10 minute TTL) to serve stale-but-safe frames
  - In-memory SimpleFallbackStorage to respond to requests while DB is down
  - Circuit breaker for per-exchange failures, mark exchange degraded and skip
  - Alerting: CCXT error rate > 5% across exchanges over 5m triggers paging

2) Storage unavailable / write failures
- Impact: High (agents/readers require frames)
- Mitigations:
  - Fallback storage (in-memory) with reduced retention
  - Background replication of writes to durable store when available
  - Alerting: storage write error rate or >1s write latency triggers P1

3) MarketDataLayer / WS feed interruption
- Impact: Medium (frontend live feed affected)
- Mitigations:
  - Client: reconnect/backoff; emit `retry` events for UI visibility
  - Server: support idempotent re-subscribe messages from client
  - Provide `/api/replay` to backfill missed ticks
  - Client fallbacks: CoinGecko/OHLCV for chart rendering if live tick feed missing
  - Alerting: MDL reconnect attempts > 3 within 2m triggers warning; >10 retries triggers page-on-call

4) Replay API missing / slow
- Impact: Low–Medium (analytics, playback)
- Mitigations:
  - Server: implement pagination/chunking for replay responses and optionally streaming
  - Client: request limited windows (e.g., 5–15 minutes per request) and stitch locally
  - Alerting: average `/api/replay` latency > 500ms over 1m triggers threshold

5) LiveTradingEngine bugs / unsafe orders
- Impact: Critical
- Mitigations:
  - Feature gates / simulate mode
  - Order size thresholds, manual approvals for >X USD per order
  - Pre-order sanity checks (price drift, slippage guards)
  - Post-order verification and automated cancel if conditions violated
  - Alerting: failed order confirmations, unexpected large fills

---

## Ops playbook (monitoring, thresholds, runbooks)

Monitoring targets and alert thresholds (suggested):

- CCXT error rate per exchange: alert if > 5% errors in 5m
- Gateway `GET /api/gateway/ohlcv` 95th percentile latency: alert if > 500ms
- Storage write latency (p99): alert if > 1s
- MDL WS reconnect attempts: warn if > 3 in 2m, page on > 10 retries
- `/api/replay` 95th percentile latency: alert if > 500ms
- Any LiveTradingEngine failed order or unexpected rejection: P1 page on-call

Runbook snippets (playbook actions):

- CCXT outage (quick):
  1. Identify exchange(s) with elevated errors in dashboards.
 2. Check CCXT API keys / rate limits / IP blocking.
 3. Open circuit for affected exchange in `ExchangeAggregator` config.
 4. Re-route loads to remaining healthy exchanges; notify product/ops.

- Storage outage (quick):
  1. Verify DB server availability and connection settings.
 2. Switch to `SimpleFallbackStorage` (in-memory) via feature flag.
 3. Prioritize async persistence of critical frames once DB available.
 4. Alert DB team and monitor replication backlog.

- MDL feed interruption (quick):
  1. Check backend WS server health and recent errors (logs) for rejected messages.
 2. Trigger MDL server restart if memory or thread pool issues observed.
 3. If `/api/replay` is up, use it for immediate backfill: `GET /api/replay?symbol=...&from=...&to=...` and verify tick alignment.
 4. Surface MDL `retry`/`error` metrics in the UI and inform on-call.

- Unsafe order placed (critical):
  1. Immediately evaluate open orders and cancel if clearly erroneous (size/price mismatch).
 2. Pause LiveTradingEngine (feature flag) to prevent further orders.
 3. Reconcile trades and notify finance/ops for manual remediation.

---

## Replay pagination & API examples

Recommendations for server `/api/replay` implementation:
- Require normalized `symbol` query param (uppercase, no slash).
- Accept `from` and `to` in epoch milliseconds.
- Limit single reply to a safe chunk (e.g., 100k ticks or 5–15 minutes depending on symbol liquidity).
- Support `limit` and `cursor` or `page` params for pagination, or provide streaming (chunked transfer-encoding).

Example request (single chunk):

```bash
curl 'https://your-host/api/replay?symbol=BTCUSDT&from=1700000000000&to=1700000600000'
```

Example paginated approach (server responds with `next` link):

Request:
```
GET /api/replay?symbol=BTCUSDT&from=1700000000000&to=1700003600000&limit=600000
```

Response (200):
```json
{
  "ticks": [ /* up to limit */ ],
  "next": "/api/replay?symbol=BTCUSDT&from=1700003600000&to=1700007200000&limit=600000"
}
```

Streaming approach (recommended for large ranges):
- Server returns chunked JSON arrays with `buffered` or newline-delimited JSON (NDJSON) to reduce memory pressure.

---

## Appendix: WorldTick schema & server checklist

WorldTick (recommended canonical shape):

```ts
interface WorldTick {
  timestamp: number; // epoch ms (UTC)
  symbol: string;    // e.g. BTCUSDT
  price: number;
  side?: 'buy'|'sell'|'unknown';
  size?: number;
  indicators?: Record<string, number>;
}
```

Server checklist for compatibility with `client/src/lib/marketDataLayer.ts`:

- [ ] WS messages: emit `{ type: 'tick', symbol, tick }` where `symbol` is normalized uppercase without slashes (e.g. `BTCUSDT`).
- [ ] `tick.timestamp` in epoch milliseconds; if seconds are unavoidable, document and ensure caller normalizes.
- [ ] Implement `GET /api/replay?symbol=&from=&to=`; prefer paged or streaming responses for large ranges.
- [ ] Accept or ignore subscribe/unsubscribe messages sent by MDL; server-side resubscribe is optional but recommended for efficiency.
- [ ] Add rate limiting and size limits on replay to avoid OOM.

---

If you'd like, I can:
- scan the repository to refresh line-level references and update the inline `L:####` pointers to exact current locations, or
- generate a PDF or HTML version of this full map for sharing with ops and engineering.

End of merged map.
