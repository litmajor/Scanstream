# 🔥 Blast Radius Map — Updated

This document maps the data and execution blast radius for the Scanstream system (updated Dec 14, 2025).
It consolidates the original CCXT / storage / agents flow with client MarketDataLayer (MDL) requirements and replay contracts.

---

## High-level overview

```
MARKET DATA SOURCES  →  GATEWAY / AGGREGATOR  →  STORAGE  →  AGENTS  →  DECISION/EXECUTION  →  CCXT (exchanges)
                                         ↘
                                          →  MarketDataLayer (WS + /api/replay) → Frontend (Trading Terminal)
```

Key points:
- The Gateway provides REST endpoints for candles and frames and also publishes live messages via the WebSocket used by `MarketDataLayer`.
- The MarketDataLayer (MDL) is the single client-side subscription abstraction used by the UI for ticks, buffering, dedup, and replay.
- Agents and Execution layers (TradingEngine / LiveTradingEngine) rely on storage-derived MarketFrames; execution (CCXT) is the single blast-risk surface for live trading.

---

## ASCII Diagram — Core components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               EXTERNAL MARKETS                              │
│  (Binance, KuCoin, OKX, Bybit, Kraken, Coinbase, Forex sources, etc.)       │
└─────────────────────────────────────────────────────────────────────────────┘
             │                         │                         │
             ▼                         ▼                         ▼
    ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
    │  CCXT Crawls  │◄──────────┤  Trading     │◄──────────┤  LiveTrading  │
    │  (fetchOHLCV) │  writes   │  Engine      │  reads    │  Engine       │
    └──────────────┘  frames   └──────────────┘           └──────────────┘
             │                         │                         │
             ▼                         ▼                         ▼
       ┌────────────┐            ┌────────────┐           ┌───────────────┐
       │ Exchange   │───────────▶│ Gateway /  │──────────▶│ Storage (DB)  │
       │ Aggregator │  API/WS    │ Aggregator  │  writes   │ (MarketFrames)│
       └────────────┘            └────────────┘           └───────────────┘
                                     │  ▲
                                     │  │
                            WebSocket │  │ REST
                                     ▼  │
                      ┌──────────────────────────┐
                      │ MarketDataLayer (MDL)    │
                      │ - WS client + reconnect  │
                      │ - subscribe(symbol,opts) │
                      │ - validateWorldTick()    │
                      │ - buffering, rate-limit  │
                      │ - requestReplay(from,to) │
                      └──────────────────────────┘
                                     │
                                     ▼
                                Frontend UI
                                (TradingTerminal)

```

---

## Primary Paths (who writes / reads frames)

1) Gateway → Storage
- Gateway aggregates exchange data (parallel CCXT calls) → computes MarketFrames → writes to storage via `storage.createMarketFrame()`.

2) TradingEngine → Storage
- Periodic indicator computation and frame generation; writes frames for agents and historical queries.

3) LiveTradingEngine → CCXT
- Execution path. Signals from agents → decision layer → `LiveTradingEngine.executeSignal()` → CCXT createOrder()

4) MDL Live Path → Frontend
- Gateway / backend publishes live ticks via WS messages `{ type: 'tick', symbol, tick }`.
- Frontend subscribes via `marketDataLayer.subscribe(symbol, opts, handler)` and may call `requestReplay(from,to)`.

---

## Expected WS & Replay Contracts (server ↔ client)

- Live tick message shape required by MDL:

```json
{ "type": "tick", "symbol": "BTCUSDT", "tick": { "timestamp": 1700000000000, "symbol": "BTCUSDT", "price": 47000.12, "side": "buy", "size": 0.1 } }
```

- Notes:
  - `symbol` sent with the message should match the normalized symbol used by clients (recommended: uppercase, no `/` — e.g. `BTCUSDT`). MDL will also try to match `BTC/USDT`.
  - `tick.timestamp` should be epoch milliseconds (UTC). MDL accepts seconds and milliseconds defensively but server should aim for ms.

- Replay API (HTTP):

```
GET /api/replay?symbol=BTCUSDT&from=1700000000000&to=1700000600000
Response: 200 OK
[
  { "timestamp":1700000000000, "symbol":"BTCUSDT", "price":..., "side":..., "size":... },
  ...
]
```

---

## Who trusts the frames (consumers)

- ML Agents (training & inference)
- RL Agent(s)
- Physics / rule-based agents
- Strategy engine and backtesting
- Gateway endpoints used by external consumers

All of the above read `storage.getMarketFrames()`; if storage is stale/unavailable, agents degrade to cached/in-memory frames.

---

## Blast Radius Analysis — failure modes & mitigations

1) CCXT / Exchange connectivity loss
- Impact: high — Gateway endpoints (candles), TradingEngine, LiveTradingEngine may be affected. Execution may fail or use stale data.
- Mitigations: cache with TTL, in-memory fallback, health circuit breaker, degraded mode for execution (no live orders without quorum).

2) Storage (DB) unavailable
- Impact: high — Agents cannot read historical frames; model training/inference may degrade.
- Mitigations: SimpleFallbackStorage (in-memory), graceful failure modes, degrade to real-time signals only.

3) MarketDataLayer / WS feed interruption
- Impact: medium — frontend loses live ticks; charts may fall back to gateway OHLCV or CoinGecko.
- Mitigations: MDL reconnect/backoff, event emission (`connected`, `disconnected`, `retry`, `error`) for UI; `requestReplay` endpoint to backfill; client-side replay + buffer fallback.

4) Replay API missing or slow
- Impact: low→medium — analytics and playback features can't load historical ticks.
- Mitigations: MDL `requestReplay` falls back to local buffer, server should provide replay slices or stream; compress payloads and paginate large ranges.

5) LiveTradingEngine / Execution bug
- Impact: critical — may place incorrect orders or use stale signals.
- Mitigations: feature flags (simulate vs live), manual approvals, dry-run mode, per-exchange API key scopes and monitoring, automated kill-switch.

---

## Operational Recommendations

- Standardize on normalized symbols (UPPERCASE, no slash) in all WS messages and in `requestReplay` parameters.
- Ensure `tick.timestamp` uses epoch milliseconds. If seconds are possible, document clearly and keep server producing ms whenever feasible.
- Implement `/api/replay` with optional pagination and time-range chunking. Prefer streaming when large ranges are requested.
- Emit MDL lifecycle events for UI observability; surface them in `MarketStatusBar` or similar.
- Add monitoring & alerting around:
  - CCXT error rates per exchange
  - Storage write failures
  - MDL reconnect attempts and retry counts
  - High-latency `/api/replay` responses

---

## Quick checklist for server teams

- [ ] WS messages: adopt `{ type: 'tick', symbol, tick }` with normalized `symbol` and ms timestamps
- [ ] Support `GET /api/replay?symbol=&from=&to=` returning ticks in the MDL `WorldTick` schema
- [ ] Accept subscribe/unsubscribe messages from MDL (optional) or ignore them (MDL will still work client-side)
- [ ] Add basic rate limiting and pagination on replay to avoid OOM

---

## Appendix: Minimal `WorldTick` schema

```ts
interface WorldTick {
  timestamp: number; // epoch ms
  symbol: string;    // e.g. BTCUSDT
  price: number;
  side?: 'buy'|'sell'|'unknown';
  size?: number;
  indicators?: Record<string, number>;
}
```

---

This updated blast radius map is intended to be a live document — let me know if you'd like a variant that focuses specifically on execution risk (orders, key rotation, circuit breakers) or on data-chain resiliency (replication, cross-region storage, snapshotting).
