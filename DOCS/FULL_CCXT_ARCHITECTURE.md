# Full CCXT Architecture for Scanstream

**Purpose**
This document describes the full CCXT-based exchange integration architecture for Scanstream: how exchanges are wrapped, normalized, routed to strategies and agents, rate-limited and executed, how state and persistence are handled, and how the client UI and scanner components integrate with this system.

**Audience**: Developers integrating exchange connectivity, maintainers of scanning/agent systems, and operators responsible for deployment and monitoring.

---

## 1. Goals
- Provide a single, consistent interface to multiple crypto exchanges using CCXT.
- Normalize market data and order primitives for the strategy engine and agents.
- Support REST and WebSocket data sources and combine them when available.
- Enforce rate limits and retry/backoff policies per exchange.
- Centralize order routing with pluggable risk controls and a persistent orders table.
- Expose a clean API to the scanner and to UI components (e.g., `StrategyPanel`).
- Support simulation/backtest flows and live execution with clear separation.

---

## 2. High-level Components

- **Exchange Adapter Layer (CCXT wrappers)**
  - Each exchange has an adapter module that instantiates a CCXT client and exposes a normalized API: `fetchTicker`, `fetchOHLCV`, `watchTicker` (if WS wrapper exists), `createOrder`, `cancelOrder`, `fetchOrder`, `fetchBalance`.
  - Responsibilities: auth, rate-limiter hooks, retries, error normalization, symbol mapping.

- **Market Data Aggregator**
  - Merges data from exchange adapters (REST polling) and WebSocket feeds when available.
  - Produces normalized tick / candle / orderbook events for the strategy engine.

- **Strategy Engine**
  - Receives normalized market events and runs strategy logic.
  - Decoupled from exchange specifics: strategies emit `OrderIntent` objects (symbol, side, size, price, type, meta).
  - Strategies live in `server/services/scanner/` and are registered in a `StrategyRegistry` (e.g., `strategy-router.ts`).

- **Order Router / Executor**
  - Receives `OrderIntent` from strategies and performs pre-execution checks via Risk Manager.
  - Chooses the exchange adapter and order method (market/limit/post-only) based on configurables.
  - Persists order requests, sends to CCXT client, records responses and reconciles with exchange fills.

- **Risk & Position Manager**
  - Implements per-strategy and per-account position limits, max drawdown checks, and order sizing rules.
  - Maintains an in-memory snapshot of positions and optionally persists to DB.

- **Rate Limiter**
  - Exchange-specific rate limiters enforce CCXT and exchange constraints; integrated into adapters.
  - Global worker queue to spread requests and avoid bursts.

- **Persistence Layer**
  - Stores orders, fills, balances, market snapshots, and strategy performance history.
  - DB tables: `orders`, `fills`, `positions`, `balances`, `market_snapshots`, `strategy_performance`.

- **Backtest / Simulation Layer**
  - Reuses the strategy engine but replaces the order router with a simulated executor.
  - Provides deterministic replay of historical candles and trades.

- **API Layer**
  - Exposes REST endpoints for scanner UI and administration: strategy registry, performance history, order status, account info.
  - Typical endpoints used by `StrategyPanel`: `GET /api/strategy/registry`, `POST /api/strategy/performance-history`.

- **UI Integration**
  - `client/src/components/StrategyPanel.tsx` shows strategies, filters, performance snapshots, manual snapshot POSTs.
  - Scanner pages call into the server API for registry data and to trigger live scans.

---

## 3. Data Flow (Sequence)

1. Exchange Adapter connects to exchange (REST/WS) and begins streaming/polling market data.
2. Market Data Aggregator normalizes incoming ticks/candles and emits events.
3. Strategy Engine receives events and evaluates signals; emits `OrderIntent`.
4. Order Router receives intent, consults Risk Manager, persists a pending `orders` record.
5. Order Router calls the chosen Exchange Adapter to create the order via CCXT.
6. Adapter returns raw exchange response; Router normalizes and persists results (`fills`, `status`).
7. Position Manager updates position snapshots and notifies UI/stateful components.
8. Strategy performance snapshotting records win-rate and expectancy to `strategy_performance` table and is available via API.

ASCII sequence:

  Market Data --> Aggregator --> Strategy Engine --> Order Router --> Exchange Adapter --> Exchange
                                                    ^                        |
                                                    |                        v
                                                  DB Orders <-- Persist <-- Exchange Response


---

## 4. Exchange Adapter Design

- Adapter responsibilities:
  - Instantiate CCXT client with credentials and options.
  - Provide a normalized symbol map (internal symbol -> exchange symbol).
  - Offer typed methods returning unified shapes.
  - Implement connection health checks and reconnection logic for WS.
  - Wrap CCXT errors into project-specific error types.

- Interface example (TypeScript):

  interface ExchangeAdapter {
    id: string; // e.g., 'binance', 'kraken'
    fetchTicker(symbol: string): Promise<Ticker>;
    fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<OHLVCandle[]>;
    createOrder(intent: OrderIntent): Promise<OrderResponse>;
    cancelOrder(orderId: string, symbol?: string): Promise<OrderResponse>;
    fetchBalance(): Promise<Balance>;
    watchTicker?(symbol: string, callback: (tick: Ticker) => void): void;
  }

- The adapter implements rate-limiter hooks: any method that calls exchange goes through a `requestWithRateLimit()` helper.

---

## 5. Strategy Engine & Registry

- `StrategyRegistry` holds metadata for all strategies (name, id, agent mapping, timeframes, indicators). The UI requests this registry.
- Strategies are pure functions/classes which accept normalized market state and return `Signal` objects.
- Strategies must not call CCXT directly; they return intents only.

Repo notes: strategies were implemented in `server/services/scanner/` and referenced by `strategy-router.ts` which routes strategies to the scanner.

---

## 6. Order Router, Risk & Position Manager

- Order Router workflow:
  - Validate `OrderIntent` fields.
  - Run risk checks (max order size, leverage limits, exposure per-account, circuit breakers).
  - Persist `orders` (status: pending) before sending to exchange.
  - Send to adapter and update order record with exchange response.
  - Start fill reconciliation loop (poll / ws events) to finalize order state.

- Position Manager:
  - Maintains in-memory positions for quick access.
  - Periodically persists aggregated exposures to DB.
  - Emits events on significant changes for the UI.

---

## 7. Rate Limiting and Throttling

- Implement per-exchange limiters using token-bucket or leaky-bucket.
- Prefer a centralized request queue so you can apply backpressure across the app.
- For high throughput, shard worker queues by exchange and function (market-data vs trading).

---

## 8. Error Handling & Reconciliation

- Standardize CCXT errors into `ExchangeError`, `RateLimitError`, `NetworkError`, `AuthError`.
- Order states: `pending -> placed -> partial -> filled -> canceled -> failed`.
- Reconciliation tasks:
  - Poll `fetchOrder` until final state.
  - Cross-check fills against exchange trade history if available.
  - If mismatch, emit an alert and mark order for manual review.

---

## 9. Persistence & Schema (recommended)

- Minimal tables:
  - `exchanges` (id, name, config)
  - `accounts` (account_id, exchange_id, api_key_masked, status)
  - `orders` (id, strategy_id, intent, exchange_id, exchange_order_id, status, meta)
  - `fills` (id, order_id, price, amount, fee, timestamp)
  - `positions` (id, symbol, side, size, updated_at)
  - `strategy_performance` (strategy_id, timestamp, sample) — used by `StrategyPanel` snapshots

- Use transactional writes for orders + pending-state persistence to avoid lost intents.

---

## 10. Backtesting & Simulation

- Use same strategy code but swap the exchange adapter for a `SimulatedAdapter` that consumes historical candles and returns deterministic fill behavior.
- Persist simulation results separately from live orders.

---

## 11. Monitoring, Metrics, and Alerts

- Track metrics:
  - API request latency & error rate per exchange
  - Orders/sec, fills/sec
  - Unreconciled orders
  - Strategy win-rate and expectancy over time
- Push critical alerts for:
  - Auth failures
  - Excessive rate limit hits
  - Large negative PnL / drawdown breaches

---

## 12. Integration points in the Scanstream repo

- `server/services/scanner/momentum-scanner.ts` — strategy logic for momentum; ensure adapter calls are removed from strategy logic and that this file emits intents.
- `server/services/scanner/strategy-router.ts` — registry and routing logic connecting scan results to strategy engine.
- `server/services/scanner/strategy-routing-routes.ts` — API endpoints exposing registry to UI.
- `client/src/components/StrategyPanel.tsx` — UI for strategy registry, snapshotting, and exporting; expects API endpoints like `GET /api/strategy/registry` and `POST /api/strategy/performance-history`.
- `multi-exchange-scanner.ts` (recommended place) — central scanner that coordinates adapters, aggregator, router, and persistence. If this file does not yet exist, create it as the orchestration entry point for multi-exchange scans.

(If these file names differ in your repository, adapt the references accordingly.)

---

## 13. Deployment & Environment

- Environment variables per exchange (stored securely):
  - `EXCHANGE_BINANCE_KEY`, `EXCHANGE_BINANCE_SECRET`, etc. Prefer vault or cloud secret manager.
- Runtime configuration:
  - `NODE_ENV`, `LOG_LEVEL`, `DB_URL`, `RATE_LIMITER_CONFIG`
- Deployment notes:
  - Run a worker process for each exchange to isolate rate limit and connection lifecycle.
  - Use process supervisors and health-check endpoints for orchestration.

---

## 14. Security & Secrets

- Never commit API keys. Mask/remove keys in logs.
- Store keys in a secrets manager and rotate periodically.
- Apply least-privilege API keys (e.g., disable withdrawals on trading keys).

---

## 15. Testing & Validation

- Unit tests for adapters: mock CCXT responses and assert normalization.
- Integration tests against a sandbox account (or paper trading) to validate order lifecycle.
- Backtest reproducibility tests to verify strategy determinism.

---

## 16. Example Adapter Snippet (TypeScript)

```ts
// simplified adapter factory
import CCXT from 'ccxt';

export function createAdapter(exchangeId: string, opts: any) {
  const client = new (CCXT as any)[exchangeId]({ apiKey: opts.key, secret: opts.secret });

  return {
    id: exchangeId,
    async fetchTicker(symbol: string) {
      const t = await client.fetchTicker(symbol);
      return {
        symbol: t.symbol,
        bid: t.bid,
        ask: t.ask,
        last: t.last,
        timestamp: t.timestamp
      };
    },
    async createOrder(intent: any) {
      // intent -> ccxt params mapping
      const order = await client.createOrder(intent.symbol, intent.type, intent.side, intent.amount, intent.price);
      return { id: order.id, status: order.status, filled: order.filled };
    }
  };
}
```

---

## 17. Scaling & Operational Tips

- Partition workers per exchange to avoid cascading rate limit issues.
- Use batching where possible for non-latency-critical calls (historical OHLCV fetches).
- Instrument and monitor rate limiter rejections.

---

## 18. Troubleshooting Checklist

- If orders are stuck `pending`: check adapter connectivity and exchange API quotas.
- If fills don't match: cross-check with exchange trade history and reconcile timestamps/timezones.
- If strategies behave differently in production vs backtest: check data alignment (timeframes, minute boundaries), and ensure adapter uses same candle aggregation.

---

## 19. Next Steps (recommended)

- Implement/verify `ExchangeAdapter` modules for the exchanges you plan to support.
- Add a `multi-exchange-scanner.ts` orchestrator that uses the `StrategyRegistry` to run strategies across exchanges.
- Fix the server `momentum-scanner.ts` syntax issue so builds succeed and strategies can be tested against live adapters.
- Add integration tests using a sandbox or paper-trading account.

---

## 20. Contact & Ownership

- Architecture owner: Scanstream Core Team
- For questions about specific adapters or rate-limiter configs, consult the adapter owners and your ops team.



(End of document)
