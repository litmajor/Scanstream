# 🔥 Blast Radius Map — Summary

This is a concise summary focused on the MarketDataLayer (MDL), WS/replay contract, and high-level blast-radius analysis. It is derived from the full blast-radius map and intended for quick sharing.

Key highlights:
- MDL is the single client-side subscription abstraction used by the UI for ticks, buffering, deduplication, rate-limiting, and replay.
- WS message shape recommended: `{ type: 'tick', symbol, tick }` with `symbol` normalized (UPPERCASE, no `/`) and `tick.timestamp` in epoch milliseconds.
- Provide `GET /api/replay?symbol=&from=&to=` to backfill playback; client will fall back to local buffer if server replay fails.
- Emit MDL lifecycle events (`connected`, `disconnected`, `retry`, `error`) so UI can surface reliability metrics.

Files and responsibilities (short):
- `trading-engine.ts`: fetch market data, compute frames
- `live-trading-engine.ts`: execute orders via CCXT
- `exchange-aggregator.ts`: parallel exchange fetches and aggregation
- `storage.ts` / `db-storage.ts`: persist MarketFrames
- `client/src/lib/marketDataLayer.ts`: client MDL implementation (subscribe/validate/requestReplay)
- `client/src/pages/trading-terminal.tsx`: UI wiring to MDL, replay controls

Failure modes & mitigations (short):
- CCXT/exchange outage: cache TTL, in-memory fallback, circuit breaker
- Storage outage: in-memory fallback, graceful degradation
- MDL interruption: reconnect/backoff, UI events, `requestReplay` + buffer fallback
- Replay API slow/missing: paginate/stream, compress responses, client fallback

See `BLAST_RADIUS_MAP_FULL.md` for the full merged reference with file-level line references, operational playbook, monitoring thresholds, and runbooks.
