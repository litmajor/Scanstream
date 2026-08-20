# Scanstream Production Readiness — Hardening Pass 1

Scope: make the **current** system safe, correct, observable and recoverable for
live CEX operation. No new strategies, agents, indicators or product surface.

Verification environment: Node 22.12.0, pnpm 10.15.0, PostgreSQL not attached
(storage fell back to in-memory, which is itself one of the findings below).

---

## 1. Red-flag assessment (verified against code, not docs)

| Claim | Verdict | Evidence |
| --- | --- | --- |
| `typescript@6.0.3`, `@types/node@25.9.1`, `zod@4.4.3` do not exist on npm | **Refuted** | `npm view` resolves all three; they are current releases |
| `prisma@7.8.0` unusable | **Confirmed (real P0)** | `prisma generate` failed: Prisma 7 removed `datasource.url` in schema and requires a driver adapter, while `prisma/schema.prisma` and `new PrismaClient()` in `server/db-storage.ts` are Prisma 6 style. The client could therefore never be generated, so **every** deployment silently ran on the in-memory fallback. Pinned `prisma`/`@prisma/client` to `6.19.3`, which matches the committed schema and client usage |
| Dual ORM confusion | **Partly confirmed, no migration needed** | `drizzle-orm` is imported **only** by `shared/schema.ts` (table + `drizzle-zod` insert-schema definitions used as types); server code imports it 0 times and there is no drizzle migration directory. Prisma is the sole runtime ORM (`server/db-storage.ts`). Authoritative path: **Prisma for persistence, Drizzle purely as schema/zod type source.** Documented rather than changed — removing Drizzle would touch 39 server type imports for no safety gain |
| Global state abuse | **Partially addressed in Pass 4E** | Capital-adjacent `truthEngine` handoffs now use the typed shared-service registry; non-capital bridges, analytics globals and legacy service publication remain inventoried below. A full DI refactor is intentionally out of scope |
| O(n²) indicator recalculation | **Measured in Pass 4E** | The committed fixed-fixture benchmark reports per-indicator median cost below; it is measurement evidence, not a CI performance gate |
| Disabled routes in main | **Confirmed** | `server/index.ts` has a ~200-line `BINARY SEARCH: TEMPORARILY DISABLE ALL ROUTERS` comment block covering ~25 route groups. Left disabled deliberately: re-enabling them blind would reintroduce whatever crash the binary search was chasing. Each group needs individual triage |
| No tests / no CI | **Confirmed, fixed** | No runner was configured. Vitest is now wired up (`pnpm test`) with 82 passing tests, and `.github/workflows/ci.yml` runs install → prisma generate → tests → build |
| No LICENSE despite MIT claim | **Confirmed, fixed** | `LICENSE` (MIT) added to match README |
| Zero community / over-engineering | Not a code defect | No action |

---

## 2. Fixes in this pass

### P0 — capital and execution safety

- **Non-overridable hard-limit gate** (`server/services/risk/hard-limit-gate.ts`):
  synchronous pre-trade boundary covering kill switch, live circuit breaker,
  engine-enabled state, signal staleness, position size, total exposure,
  per-symbol exposure, open-position count and leverage. Configuration can only
  *tighten* limits — `HARD_LIMIT_CEILINGS` are compiled ceilings that env vars
  and API config cannot widen. Unknown/NaN exposure inputs fail closed.
- **Second gate after final sizing** in `live-trading-engine.ts`: sizing logic
  downstream of the first check can no longer grow an order past the limits.
- **Fail-closed safety controls**: portfolio-risk evaluation errors and
  TruthEngine (market-data quality) errors now block execution instead of
  logging and continuing.
- **Ambiguous order outcomes** (`server/services/execution/order-reconciler.ts`):
  timeouts/5xx/socket errors are classified as ambiguous; the engine reconciles
  by client order id before any retry, adopts an order that already exists, and
  **aborts on `unknown`**. `absent` is only returned when every available
  listing succeeded — a partial answer is not proof of absence.
- **Retry sizing bug**: retries used `Math.max(1, Math.floor(qty * 0.75))`,
  which *increases* size for sub-unit quantities (e.g. 0.4 BTC → 1 BTC). Now
  reduces geometrically and aborts below the market minimum.
- **Persistent, restart-safe emergency stops**: kill switch and live circuit
  breaker persist to `data/`; unreadable state fails closed (killed/active); a
  clear that cannot be persisted is rolled back and rejected. Clearing the
  breaker no longer auto-resumes trading — an explicit operator resume is
  required, and resume is refused while either control is active.
- **Flatten-all** is idempotent under concurrency (concurrent calls join one
  sweep), disables new execution first, closes each position independently,
  reports partial failures (`207` from the endpoint) and emits
  `flattenAllIncomplete` with the positions still open.
- **Operator authentication** on capital-moving routes
  (`server/middleware/require-trading-operator.ts`): timing-safe
  `TRADING_OPERATOR_TOKEN` check on `start`, `stop`, `config`,
  `close/:positionId`, `execute`, `flatten-all`; returns `503` when the token is
  not configured (fail closed, never open). Provided tokens are never logged.

### P1 — market-data correctness

- **Precision corruption**: the CCXT adapter applied `Math.floor()` to OHLC
  prices — BTC/ETH decimals were discarded and sub-dollar assets floored to 0
  (and then rejected or traded at a nonsense price). Replaced with
  `candle-normalizer.ts`, which floors **only** timestamps, preserves price and
  volume precision, parses numeric strings, and rejects rows that are malformed,
  non-finite, non-positive, negative-volume or geometrically impossible
  (`high < low`, `high < open/close`, `low > open/close`).
- **Silent timeframe substitution**: unsupported timeframe seconds used to round
  to a neighbouring supported value (a 90m request silently became 1h). Now an
  explicit lookup that throws.
- **Integrity-gate bypasses removed**: `ccxt-scanner` no longer persists frames
  directly when the gate throws, and `exchange-aggregator` no longer returns raw
  unvalidated frames "as-is". Both drop the batch and record a safety metric.
- **Temporal correctness**: the gate persisted a MarketFrame *before* checking
  for time regression, so incoherent candles could become canonical data. The
  regression check now runs before storage; `worldTime` (candle close/market
  time) and `emitTime` (wall clock) stay distinct; a World Tick is emitted only
  after storage succeeds, and is suppressed on storage failure.
- **Crash-on-partial-data on the signal path**: `order-flow-analyzer` threw
  `TypeError` on missing order-flow fields and `multi-timeframe-confirmation`
  threw on a signal without per-timeframe analysis — both reachable from
  `SignalPipeline.aggregateSignals`. Both now degrade instead of throwing.
- **Module-init crash**: `rl-guard.ts` dereferenced `RLConfig` unguarded and
  crashed on import under circular-import resolution.

### Observability / operations

- `server/services/observability/safety-metrics.ts`: counters for integrity
  bypasses blocked, candles rejected (by reason), executions blocked (by reason),
  order reconciliations, flatten-all runs and failures.
- `GET /api/health/readiness`: reports DB connectivity (explicitly flags the
  in-memory fallback as not durable), kill switch, circuit breaker and integrity
  state; `503` when not ready.
- `GET /api/live-trading/safety`: kill switch, breaker and engine config.
- The static `/api/health` handler in `routes.ts` that shadowed the real health
  router (always `UP`) was reduced to `/api/live` liveness; the duplicate
  `/api/live-trading` mount was removed.
- Request logging no longer serialises response bodies (trading/config endpoints
  return account and exchange settings).

---

## 3. Tests

`pnpm test` — 82 tests, 6 files, all passing:

- `candle-normalizer` — BTC/ETH precision, sub-cent assets, small movements,
  stop-loss/take-profit arithmetic, string parsing, malformed/impossible rows,
  timeframe mapping.
- `hard-limit-gate` — each block reason, ceiling clamping, env config, unknown
  exposure, fail-closed when a control throws.
- `order-reconciler` — ambiguity classification, exists/absent/unknown,
  per-exchange client-id shapes, unknown on partial failure, id uniqueness.
- `integrity-gate` — store-before-emit ordering, tick suppressed on persistence
  failure, regression rejected before storage, historical backfill exempt,
  invalid OHLC never stored, dedupe.
- `live-trading-safety` — start/resume refusal, hard-limit block, execution
  blocked during flatten, multi-symbol flatten, partial-failure isolation,
  concurrent flatten joins one sweep, exchange-refresh outage.

Two pre-existing suites (`phase-1-integration`, `unified-regime-system`) were
never runnable (Jest imports, wrong relative paths). Their imports are fixed so
they execute, but they assert an interface the implementation does not provide
(e.g. `AggregatedSignal.action`, different regime confidence scales). They are
**excluded from the gate with a comment, not deleted** — the drift is real and
should be reconciled by the owner of that spec; the tests were not edited to
pass. The legacy top-level `tests/` and `__tests__/` trees still import modules
that no longer exist and are not wired into the runner.

---

## 4. Remaining risks / not done

| Priority | Item |
| --- | --- |
| P0 | `DATABASE_URL` must be set and `prisma migrate deploy` run before live use — without it `db-storage` runs in memory and **all** trade/position history is lost on restart. Readiness now surfaces this, but nothing prevents starting |
| P0 | Fills, fees, funding, slippage and realized/unrealized PnL accounting are unaudited; only limits and order state were hardened |
| P0 | Startup recovery (adopting positions/orders that exist on the exchange after a crash) is not implemented |
| P1 | `TRADING_OPERATOR_TOKEN` is a single shared secret with no rotation, per-user identity or audit trail — an interim guard, not an authz design. Read-only status routes remain unauthenticated |
| P1 | ~25 route groups remain commented out in `server/index.ts`; unknown functional gaps |
| P1 | Safety metrics are process-local and reset on restart; no Prometheus/OTel exporter, no correlation IDs end-to-end |
| P1 | The historical 362-error TypeScript baseline is classified below; the Pass 5 hardening work reduced the active baseline to zero without suppressions or dependency stubs |
| P2 | Capital-adjacent `truthEngine` handoffs are typed through a registry; remaining non-capital global handoffs are inventoried below and full DI remains open |
| P2 | Indicator cost is measured over a committed fixture; full market-data replay/MIXED parity remains unverified |
| P2 | Rich `/api/health` still contains hard-coded exchange counts and placeholder freshness values |

---

## 5. Deployment checklist

1. Node 22, pnpm 10.15.0, `pnpm install --frozen-lockfile`.
2. `DATABASE_URL` set; generate the client and apply the committed migration
   history to a fresh database:
   `pnpm run db:generate && pnpm run db:migrate:deploy`.
   If the database already contains the schema from `prisma db push` (or an
   equivalent pre-migration deployment), baseline that existing schema once
   instead of replaying the initial DDL:
   `pnpm exec prisma migrate resolve --applied 0_init`.
3. Confirm `GET /api/health/readiness` returns `ready: true` with
   `database.ok === true` **before** enabling live trading.
4. Set `TRADING_OPERATOR_TOKEN` (32+ random bytes). Without it all trading
   control endpoints answer `503`.
   Configure explicit funding lookback and recheck intervals in the engine
   integration. A complete venue response can prove coverage when its first
   page is short at the requested boundary; otherwise funding older than the
   bounded initial lookback requires the authenticated
   (`TRADING_OPERATOR_TOKEN`), audited baseline attestation endpoint below:
   `POST /api/live-trading/funding/attest`.
5. Set risk limits explicitly — defaults are deliberately small:
   `RISK_MAX_POSITION_USD`, `RISK_MAX_TOTAL_EXPOSURE_USD`,
   `RISK_MAX_SYMBOL_EXPOSURE_USD`, `RISK_MAX_OPEN_POSITIONS`,
   `RISK_MAX_LEVERAGE`, `RISK_MAX_SIGNAL_AGE_MS`. Values above
   `HARD_LIMIT_CEILINGS` are clamped, not honoured.
6. Ensure `data/` is on durable, writable storage. Live execution state,
   `realized-pnl-ledger.json`, `funding-accounting.json`, the kill switch,
   circuit breaker and safety events persist there and fail closed if unreadable.
   Ticker snapshots, price/candle snapshots, gateway caches, indicator caches
   and velocity caches are memory-only optimizations; they start empty after a
   restart and are never treated as durable execution or exposure state.
7. For perpetual/swap markets, configure a venue that declares either
   `fetchFundingHistory` or `fetchLedger` (with funding-type rows). The only
   deliberate escape hatch is `ALLOW_UNACCOUNTED_FUNDING=1`; setting it accepts
   unknown funding risk and must be an explicitly documented operator decision.
   Configure `PNL_CONVERSION_MAX_AGE_MS` when the venue requires a tighter
   freshness bound than the conservative one-minute default.
8. Start in `testMode`/paper, verify signals and `executionBlocked` events, then
   hand over to live with a small `RISK_MAX_TOTAL_EXPOSURE_USD`.

## 6. Monitoring (minimum)

- `readiness` != UP, and `database.ok === false` in particular → page.
- `safety.executionsBlocked` by reason; a spike in `truth_check_error`,
  `max_*` or `stale_signal` means data or sizing is wrong.
- `safety.candlesRejected` / `integrityBypassBlocked` > 0 → feed quality alarm.
- `safety.flattenAllFailures` > 0 → **open exposure with no automation**;
  intervene manually on the exchange.
- `orderReconciliations.unknown` > 0 → an order may exist that the system does
  not know about; reconcile by hand.
- `realized_pnl_unknown`, `realized_pnl_ledger_unreadable` or
  `realized_pnl_persistence_failed` → daily loss is not provable; keep live
  execution stopped and use the entry-specific operator resolution procedure
  below only after exchange records are reviewed.
- `conversion_unknown` → a fee or funding conversion could not be proven from
  a fresh same-venue ticker. Bounded retries may self-heal, but live execution
  remains stopped while daily PnL is unknown.
- A ticker or market-data cache read that exceeds its caller-supplied age bound
  is unknown and must not satisfy a capital-adjacent gate; investigate the
  venue feed rather than widening the bound.
- `funding_unaccounted`, `funding_state_unreadable` or `funding_unknown` →
  perpetual/swap funding is not provable; reconcile the venue history before
  clearing the block. If older coverage cannot be proven from the venue
  response, use the symbol-specific baseline attestation procedure below after
  reviewing exchange evidence. Treat `ALLOW_UNACCOUNTED_FUNDING=1` as an
  incident-level exception, not normal operation.

## 7. Rollback and incident recovery

- **Immediate stop:** `POST /api/live-trading/stop`, then
  `POST /api/live-trading/flatten-all` (idempotent; `207` means positions remain
  — the response lists them). Escalate to the kill switch to block all new
  orders across restarts.
- **Rollback:** redeploy the previous image. The persisted kill switch/breaker
  files are forward-compatible; if `data/` state is unreadable the system starts
  killed, which is the intended direction of failure.
- **Unknown realized PnL:** keep execution stopped, identify the exact entry
  from the durable ledger, and call
  `POST /api/live-trading/realized-pnl/{entryId}/resolve` with the shared
  operator token. Use `{ "resolution": "attested_value", "pnl": <number>,
  "reason": "<evidence>" }` only when exchange evidence supports the value.
  Otherwise use `{ "resolution": "excluded_unknown", "reason": "<evidence>" }`.
  Wildcards, bulk clearing, automatic expiry and editing the original ledger
  record are forbidden. The request is audited as `shared-operator-token`, and
  both durable records must show the resolution before execution resumes.
- **Unknown funding baseline:** keep contract execution stopped and review the
  venue's funding export for the exact symbol. If the bounded initial query
  cannot prove older coverage, call
  `POST /api/live-trading/funding/attest` with the shared operator token and
  `{ "symbol": "<exact symbol>", "reason": "<evidence>" }`. The symbol must be
  specific; wildcard or bulk clearing is forbidden. The attestation is
  durably recorded in funding state and audited as `shared-operator-token`; it
  clears only that symbol's initial baseline gap. Failed or truncated later
  queries create a new unknown and must be investigated again.
- **Stale or corrupt market-data cache:** caches are disposable and
  memory-only. Restarting clears them; a cache read must never be used to
  reconstruct positions or exposure. Reinitialize the venue and reload
  markets before accepting new market-data reads.
- **Operator stop during execution:** keep the stop/kill switch active until
  the in-flight order appears in durable local state and exchange
  reconciliation agrees. A stop blocks subsequent placements; it does not
  cancel or hide an order already accepted by the venue. Resume is refused
  while the kill switch is active and otherwise re-runs normal durability,
  funding and reconciliation preconditions.
- **After an incident:** compare exchange positions/orders against
  `/api/live-trading/status` before clearing the kill switch — there is no
  automatic startup reconciliation yet (see §4). Clear the breaker, then resume
  explicitly; resume is refused while either control is active.

---

## 8. Hardening Pass 2

Pass 2 targets the question "after a crash, timeout, partial fill, restart,
duplicate event or exchange failure, can Scanstream determine what actually
happened and refuse to trade until it knows?". Everything below is code plus
tests in this branch; the phases listed as outstanding are *not* done.

### 8.1 Durable state is now a hard precondition for live execution

`server/services/execution/durability-gate.ts` is checked before live start,
before resume and immediately before every live order. Without `DATABASE_URL`,
or when a probe of the database fails, live paths fail closed
(`executionBlocked` with `durable_state_unavailable`) and a durable
`durability_failure` event is recorded. `testMode`/paper deliberately still runs
on the in-memory store. Failed durable writes invalidate the cached probe, so a
database lost *after* startup stops execution rather than being discovered later.

This closes the first P0 in §4: the gap was previously only *reported* by
readiness, never enforced. Readiness alone is still not a safety control.

### 8.2 Fill, fee and slippage accounting

`server/services/execution/fill-accounting.ts` accumulates fills per order:
duplicate fill IDs are idempotent, partial and late fills accumulate, average
execution price is cost-weighted, remaining quantity is explicit, maker and taker
volume are separated, and fees are kept **per currency**. Non-quote fees are
returned as `unconvertedFees` rather than converted with an invented rate.
Slippage is computed from requested versus achieved price and is `null` when
unknown. Cancelled-but-partially-filled orders keep their exposure.

Funding is **not** implemented and is not simulated anywhere.

### 8.3 Positions and risk

Positions are keyed by symbol, so repeated refreshes cannot duplicate exposure.
Exposure uses notional (`|qty| * price`) rather than margin alone. An exchange
response that is incomplete, unusable or failed never silently erases local
exposure — only an explicit flat position removes it.

### 8.4 Startup reconciliation barrier

`server/services/execution/startup-reconciler.ts` queries balances, positions and
open orders, diffs them against local state, and returns a report. Live start and
live order creation are refused unless the report is `complete`. Unknown exchange
positions are adopted; unknown open orders, locally-open orders missing from the
exchange, and any query failure block trading. Reconciliation is idempotent.
Conservative by design: an order missing from the open-order response is
*unknown*, never inferred as filled or cancelled.

### 8.5 Operator audit trail and durable safety events

`server/services/observability/safety-event-log.ts` appends JSONL to
`data/safety-events.jsonl` (8 MB rotation, one previous generation) so blocked
executions, rejected candles, unknown order states, flatten-all outcomes, kill
switch/breaker transitions, reconciliation results and durability failures
survive restart. `server/middleware/audit-operator-action.ts` records each
capital-moving request with previous state, resulting state, outcome, reason and
request ID. The operator token is never persisted; the identity is recorded as
`shared-operator-token`. Read them via
`GET /api/live-trading/safety-events` (operator auth).

### 8.6 Disabled route groups — classified, not blindly re-enabled

Root cause found: `server/rl-guard.ts` built its singleton at module scope and
read `RLConfig` from `rl-system-integration` in the constructor. Those modules
form an import cycle, so the read hit a temporal dead zone and threw
`Cannot access 'RLConfig' before initialization`; optional chaining does not
protect against a TDZ. Every router transitively importing that chain crashed at
import, which is what the "BINARY SEARCH: TEMPORARILY DISABLE ALL ROUTERS"
comment was bisecting. Config is now resolved lazily on first use.

`npx tsx scripts/probe-disabled-routers.ts` mounts each formerly disabled router
in isolation and prints the real failure. After the import-cycle fix, all
remaining candidates import and mount cleanly, but import success is not route
safety evidence:

| Route group | Classification |
| --- | --- |
| `/api/health` | **Safe — restored** (read-only; readiness was unreachable, so no operator could verify durable storage). Covered by `server/routes/__tests__/health-routes.test.ts` |
| `/api/logs` | **Obsolete — deleted** — `server/routes/logs.ts` does not exist; logs are served by `/api/health/logs` |
| `/api/agents/services-api` | **Covered — restored** — route-level tests cover status/config contracts and handled unknown/disabled ability requests |
| `/api/execution` (trade execution) | **Covered — restored with operator guard** — `POST /decision`, `POST /record-outcome`, and `POST /reset` require `requireTradingOperator` and audited actions; read-only `GET /status` remains public |
| `/api/model-performance` | **Covered — restored** — metrics/history/status/validation/prune contracts and bounded ensemble input/error handling are tested |
| `/api/scout` | **Covered — restored** — all 14 read-only routes have success, validation, bounded-work, and handled service-failure coverage |
| `/api/phase5` | **Covered — restored** — all 8 read-only database-backed routes have response-shape and handled database-failure coverage; history inputs are bounded |
| `/api/analysis/multi-timeframe` | **Covered — restored** — the single read-only route has bounded three-timeframe coverage and handled exchange-feed failure coverage |
| `/api/symbols` | **Covered — restored** — both read-only CoinGecko-backed routes have pagination, detail, missing-symbol and handled provider-failure coverage |
| `/api/physics` | **Covered — restored with authentication** — `POST /validate` is authenticated and bounds the symbol input before heavy validation; `GET /validate-status` remains public |
| `/api/learning` | **Covered — restored with authentication** — all 8 routes are covered; state-mutating `trade-outcome`, `reset`, and `update-metrics` require authentication and validate trade inputs |
| `/api/agents/physics` | **Covered — restored with authentication** — the three bounded heavy-analysis POST routes require authentication; public agent/status reads remain open |
| `/api/agents/exit` | **Covered — restored with operator guard** — all six decision, coordination, and outcome mutations are treated as capital-adjacent and require `requireTradingOperator` plus audit; read-only status remains public |
| `/api/agents/interactions` | **Covered — restored with authentication** — the three process-global recording mutations require authentication and bounded payloads; visualization/history reads remain public |
| `/api/agents/signals` | **Covered but still disabled** — all six routes have isolated contract coverage and the recording mutation is authenticated, but five read routes fan out to multiple external/analytical pipelines without a uniform request deadline; keep disabled until that latency boundary is explicit |
| `/api/symbol-universe` | **Covered — restored with authenticated UI-config mutation** — all 13 routes have isolated contract coverage; the read-only state, lookup, formatting, group, stats, and change-stream routes are intentionally public because they expose bounded symbol metadata without secrets, pure normalization routes validate bounded inputs, and `POST /ui-config` requires authentication and validates the payload |
| `/api/optimize` | **Covered — restored with authentication and bounded cost** — `POST /run` is authenticated and caps iterations (1-50), market data (100-1000 candles), symbol length, timeframe, and boolean options; the four routes have isolated success, validation, and handled-failure coverage. The optimizer is process-local and no live/paper consumer of its report was found. |
| `/api/backtest` signal routes | **Covered — restored with authentication and bounded cost** — `POST /signal` and `POST /signals` require authentication and cap candles (5-5000), signals (100), and timeout (1-240 minutes); `POST /prune` requires authentication and caps retention (1-3650 days). Read-only stats/history/export routes have bounded query/input handling and isolated coverage. The signal backtester writes only its process-local result buffer; no live/paper consumer was found. |
| `/api/backtest/historical` | **Covered — restored with authentication and bounded cost** — the POST route requires authentication, caps assets at 20 and the date range at 730 days, and has isolated success, validation, and handled-failure coverage; the summary read is public. No live/paper consumer of the result was found. |
| `/api/backtest` phase 6 unified | **Still disabled** — `POST /unified/run` writes stored results and has request-controlled asset, signal-source, agent, strategy, timeframe, and gap-healing fan-out without a complete enforceable cost contract; its stored result consumer relationship needs a separate design review. |
| `/api/backtest` capability measurement | **Still disabled** — the run route performs multi-asset historical fetches and backtests without asset/date/trade caps; impact routes accept arbitrary trade arrays. |
| `/api/backtest` velocity profile | **Still disabled** — compute routes synthesize and process 150 trades internally regardless of request bounds and expose no request-controlled enforceable cost boundary. |
| `/api/backtest` adaptive holding | **Still disabled** — routes load real trades and market data with fallback/synthetic paths, with no request-controlled cap on the underlying work or uniform latency boundary. |
| `/api/backtest` agent clustering | **Still disabled** — routes load up to 200 trades and may fall back to synthetic generation, but do not validate bounded date/timeframe work or expose a complete failure/latency contract. |
| `server/routes/backtesting.ts` | **Absent** — no such source file exists; the mounted signal backtesting implementation is `signal-backtesting.ts`. |
| `server/routes/flow-field-backtest.ts` | **Dead/unregistered** — imported and wrapped by `server/index.ts` but never mounted; its `/api/analytics/backtest/*` routes therefore have no active registration and remain disabled. |
| `/api/signal-generation` | **Covered — restored with operator guard and bounded cost** — signal-producing routes require `requireTradingOperator` plus audit; single requests cap symbols/chart data and batch generation caps requests at 20; `/validate` is read-only |
| `/api/strategies` legacy router | **Partially restored through `strategies-compat.ts`** — safe reads and bounded authenticated analysis are mounted separately; the original router remains unmounted so its signal-injecting and destructive routes cannot become active accidentally. The route's static strategy metadata is not consumed by live/paper engines: `server/routes/strategies.ts` owns `STRATEGIES`, while `server/strategy-integration.ts` uses separate in-process weights. |
| `/api/user` user settings | **Covered — restored with authenticated ownership and operator guards where execution-adjacent** — all 20 routes derive the owner from `req.user.id`; session revocation and API-key deletion verify persisted ownership. Trading-settings and API-key mutations require `requireTradingOperator` plus audit; other mutations require authentication and bounded payloads. API-key responses expose only masked public-key metadata and never `apiSecret`. |
| `/api/gateway` | **Still disabled** — all 35 original routes remain behind the disabled registration. The router initializes exchange aggregators, scanner/liquidity/security services, cache warming, and recurring refresh intervals at import time; it also mixes signal persistence, venue resets, cache invalidation, unbounded external fan-out, and raw-error paths. A safe subset cannot be restored without splitting the router and adding uniform service deadlines. |
| Gateway read-only compatibility surfaces | **Covered — restored without importing `gateway.ts`** — `/api/gateway/dataframe/:symbol`, `/api/gateway/price/:symbol`, `/api/gateway/signals/performance/stats`, `/api/gateway/signals/performance/recent`, and `/api/exchange/status` use bounded cache/tracker reads only. Symbols are capped at 64 characters, timeframes use an allowlist, dataframe limits cap at 500 candles, and performance limits cap at 100 records. No signal persistence, venue reset, or external provider call occurs on these paths. `/api/exchange/status` matches the terminal contract, but `trading_pairs` and `api_latency_ms` are currently hardcoded zero values. |
| `/api/strategies` read/analysis compatibility | **Covered — restored** — `GET /`, `/signals`, `/:id`, `/backtest/results`, `/feature-enabled`, and `/compare-durations` are mounted from `strategies-compat.ts`; static routes precede `/:id`, query/identifier inputs are bounded, and handled failures are generic. Authenticated `POST /consensus`, `/backtest/run`, `/bounce/backtest`, `/:id/backtest`, `/predict-duration`, and `/pyramid-decision` are restored with bounded inputs. The subprocess-backed backtests/consensus use a 15-second timeout and 1 MB output cap. |
| `/api/strategies` signal-injecting and unbounded mutation routes | **Still disabled and actually unmounted** — `POST /enhanced-bounce/execute`, `POST /:id/execute`, and `POST /execute-all` remain unmounted because they call `storage.createSignal()` without established downstream execution ownership; `/execute-all` also permits unbounded symbol fan-out. `DELETE /backtest/:id` remains unmounted because it mutates stored results and has no authenticated, owner-scoped deletion contract. |

Pass 5 Batch 4b user-settings route classification:

| Routes | Classification and evidence |
| --- | --- |
| `PATCH /profile`, `POST /change-password`, `DELETE /account` | Authenticated, user-self state mutations. No user-id selector is accepted; handlers use `req.user.id`. Payloads are bounded and malformed objects return `400`. |
| `GET /preferences`, `PATCH /preferences` | Authenticated user-self reads/writes. The controller queries/upserts `UserPreference` by `req.user.id`; timeframe, exchange, booleans, and object keys are bounded. No live/paper consumer of this controller cache or preference row was found; the separate unguarded `user-preferences.ts` router was removed from `registerRoutes`. |
| `GET /trading-settings`, `PATCH /trading-settings` | Authenticated user-self read and execution-adjacent configuration mutation. The fields include position sizing, stops, slippage, and daily-loss/position limits; the write requires operator authentication and audit even though no direct live-engine read of this controller cache was found. |
| `GET /dashboard-settings`, `PATCH /dashboard-settings` | Authenticated user-self UI state. Widget, indicator, layout, and refresh payloads have array/string/count bounds; no execution consumer was found. |
| `GET /advanced-settings`, `PATCH /advanced-settings`, `GET /security`, `PATCH /security` | Authenticated user-self state. Known fields, strings, time formats, booleans, and IP-list size are bounded; no live/paper execution consumer was found. |
| `GET /login-sessions`, `POST /login-sessions/:sessionId/revoke` | Authenticated user-self session access. Reads filter persisted session JSON by the authenticated user; revocation checks the persisted session owner and returns `403` for another owner and `404` for unknown sessions. |
| `GET /activity-logs`, `GET /export-data` | Authenticated user-self reads. Activity output is capped by the controller; export queries only the authenticated user and excludes API credentials. |
| `GET /api-keys`, `POST /api-keys`, `DELETE /api-keys/:keyId` | Credential metadata is user-owned and reads mask `apiKey` and omit `apiSecret`. Creation/deletion are treated as execution-adjacent venue credential mutations and require operator authentication plus audit; deletion verifies `ApiKey.userId` before deleting. |

Gateway routes deliberately left disabled:

| Route(s) | Reason |
| --- | --- |
| `GET /health`, `GET /metrics/cache`, `GET /metrics/rate-limit`, `GET /exchanges/status`, `GET /scan/stats`, `GET /ws/stats` | Read/status surfaces, but the router has import-time external initialization and recurring refresh side effects; they are not separable from the unsafe gateway mount without a dedicated read-only router and handled-error tests. |
| `GET /signals`, `POST /signal/generate`, `POST /signal/batch` | Generate, persist, broadcast, or batch signal inputs. `GET /signals` calls `ccxtScanner.scanSymbols` and `storage.storeSignal`; generation routes create signal pipelines. They require operator guard/audit and bounded external work not yet enforced for the complete group. |
| `POST /cache/clear`, `POST /cache/invalidate`, `POST /exchange/:name/reset`, `POST /exchanges/:name/reset-rate-limit` | Mutate gateway cache or exchange/rate-limit state used by market-data/execution surfaces. They require operator guard/audit; invalidation patterns and reset contracts are not fully covered. |
| `GET /price/:symbol`, `GET /ohlcv/:symbol`, `GET /market-frames/:symbol`, `GET /dataframe/:symbol`, `GET /dataframe-validated/:symbol` | Market-data/analytical reads accept request-controlled limits/timeframes without complete caps and expose raw provider errors in existing handlers. |
| `GET /liquidity/:symbol`, `POST /liquidity/batch` | External liquidity work; batch symbols are unbounded and provider deadlines are not uniform. |
| `GET /gas/:chain`, `GET /gas`, `POST /gas/estimate` | External provider calls lack complete input validation/deadline/error-contract coverage; estimate values are unbounded. |
| `GET /alerts`, `POST /alerts/:id/acknowledge`, `DELETE /alerts/acknowledged`, `POST /alerts/thresholds`, `POST /alerts/subscribe` | Alert mutations are unauthenticated/global or caller-ownedness is absent; subscription arrays and threshold payloads are unbounded. Reads remain coupled to the same unsafe import-time gateway initialization. |
| `POST /security/validate`, `POST /recommend-exchange` | External/security and exchange recommendation work lacks complete bounded request and handled-failure coverage. |
| `GET /signals/history`, `GET /signals/archive`, `GET /signals/performance/stats`, `GET /signals/performance/recent` | Query limits/offsets are not uniformly capped and existing handlers can return raw internal errors. |
| `POST /scan` | Has a 30-second race timeout but accepts unbounded symbols, symbol lengths, timeframe, and options; same-process external scan cost remains unsafe. |

Gateway consumer-relationship evidence:

- `GET /signals` in `server/routes/gateway.ts:231` calls `ccxtScanner.scanSymbols`; high-strength results are tracked by `signalPerformanceTracker` and persisted through `storage.storeSignal` at `server/routes/gateway.ts:291-302`. This is execution-adjacent signal state even though no direct live-engine read of the stored records was established.
- Gateway cache state is consumed by `server/services/market-data-fetcher.ts:366-427` for candle reads/writes and by `server/services/scanner/multi-exchange-scanner.ts` through its `CacheManager`; clearing or invalidating it therefore affects market-data/scanner behavior used by the live-path services.
- `POST /exchange/:name/reset` calls `aggregator.resetExchangeHealth(name)` at `server/routes/gateway.ts:2004`; venue health and reinitialization are operationally adjacent to execution even where the isolated engine does not share the same cache instance.

Registration sweep and disabled semantics:

- `server/routes/strategies.ts` was the prior discrepancy: its mount was removed in Batch 4a.
- `server/routes/agent-signal-insights.ts` was also commented in the `server/index.ts` disabled block but actively mounted by `registerRoutes(app)` in `server/routes.ts`. That active mount was removed in this batch; the group is now actually disabled pending its missing uniform latency deadline.
- `server/routes/user-preferences.ts` was actively mounted at `/api/user` by `registerRoutes(app)` while `server/routes/user-settings.ts` was commented in `server/index.ts`. It accepted arbitrary `x-user-id` values and could read/write another user's in-memory preferences. The mount was removed; the covered `user-settings.ts` router is now the sole `/api/user` registration.
- `server/routes/gateway.ts` has no remaining alternate route mount in `server/routes.ts`. The previously active direct `/api/gateway/dataframe/:symbol` handler, `/api/gateway/signals/performance` mount, and `/api/gateway/price/:base/:quote` missing-endpoint route were removed because they bypassed the disabled gateway group; bounded replacements now live in `server/routes/gateway-readonly.ts` and do not import `gateway.ts`. The old `/api/exchange/status` missing-endpoint handler was also removed and replaced by that compatibility router. The main gateway module is nevertheless imported by `server/index.ts`, and `gateway-metrics.ts`/`websocket-signals.ts` retain shared-service imports for other startup/diagnostic paths, so import-time initialization still occurs even while its main route mount remains disabled. This is a side-effect finding, not evidence that the unsafe gateway route group is active.
- `server/routes/velocity-profile.ts` is disabled in the `/api/backtest` block, but the distinct `server/routes/velocity-profiles.ts` registration helper had been active through `registerRoutes(app)` at `/api/velocity/*`. That sibling exposed three read/calculation routes without complete input/error coverage. Its registration was removed in this batch; the source remains disabled pending dedicated coverage.
- In this route track, **disabled means actually unmounted**. The four prior “disabled in appearance only” findings were legacy strategies, agent signal insights, user preferences, and velocity-profile helper routes; each alternate active registration was removed or replaced by its covered router.

Pass 5 Batch 4c client compatibility sweep:

- Restored bounded read-only compatibility paths for the client calls at `client/src/components/UnifiedSignalDisplay.tsx:276`, `client/src/pages/signal-performance.tsx:38,49`, `client/src/hooks/useGatewaySignals.ts:41`, `client/src/pages/gateway-scanner.tsx:152`, and `client/src/pages/trading-terminal.tsx:719-720,749-752`.
- `POST /api/strategies/synthesize` is authenticated rather than operator-guarded. `client/src/pages/strategy-synthesis.tsx:67` now reaches the bounded analytical route; the route only synthesizes and returns data, with no signal persistence or engine-state mutation/consumer found. The existing audit record is retained for traceability.
- The covered strategy reads now serve `client/src/components/UnifiedSignalDisplay.tsx:252`, `client/src/pages/strategies.tsx:90`, `client/src/pages/analytics-dashboard.tsx:99`, `client/src/pages/signals.tsx:79`, `client/src/pages/signal-structures.tsx:92`, and `client/src/pages/backtest.tsx:178,188`. `POST /api/strategies/consensus` and `POST /api/strategies/backtest/run` are authenticated and bounded for the corresponding `strategies.tsx:100` and `backtest.tsx:205` callers.
- Deliberately broken strategy actions remain `POST /api/strategies/enhanced-bounce/execute` (`client/src/components/BounceStrategyCard.tsx:43`) and `POST /api/strategies/execute-all` (`client/src/pages/strategies.tsx:214`): those routes inject signals or permit unbounded fan-out and are actually unmounted. The UI should hide or disable those actions. `DELETE /api/strategies/backtest/:id` (`client/src/pages/backtest.tsx:224`) also remains unavailable because the destructive route has no owner-scoped deletion contract.
- No client call to `/api/signal-generation` or its generate routes was found.
- The restored exit-agent router does not define the client-requested `GET /api/agents/exit/consensus-history`, `/interaction-flow`, or `/activity-log` paths used at `client/src/pages/agent-interactions.tsx:307,322,335`; those calls remain `404` because the endpoints were never part of the covered seven-route router. The six guarded exit POST routes have no client call sites in `client/src`.

The Pass 5 Batch 1 restored set adds `/api/scout`, `/api/phase5`,
`/api/analysis/multi-timeframe`, `/api/symbols`, authenticated `/api/physics`,
and authenticated `/api/learning` to the previously restored routes. Batch 2
also restored authenticated `/api/agents/physics`, operator-guarded
`/api/agents/exit`, and authenticated `/api/agents/interactions`. The
`/api/agents/signals` group remains disabled because its external fan-out lacks
a uniform deadline. The obsolete `/api/logs` registration was deleted.
`server/routes/api/symbol-universe.ts` was audited as a separate group and is
now restored with the UI-config mutation authenticated and bounded. Pass 5
Batch 3 additionally restored `/api/optimize`, the signal backtesting routes,
and `/api/backtest/historical` after isolated route coverage and bounded
authenticated execution were added. Pass 5 Batch 4a restores bounded,
operator-authenticated signal generation. Pass 5 Batch 4d restores the
bounded strategy compatibility reads and analysis routes while keeping the
signal-injecting and destructive legacy routes unmounted.

Batch 4a consumer audit:

- The legacy strategy metadata and `isActive` values are local to
  `server/routes/strategies.ts` (`STRATEGIES` and its route handlers). No live
  or paper engine reads that constant or its stored backtest records.
  `server/strategy-integration.ts` maintains separate `strategyWeights` and
  `synthesizeSignals()` state; it does not load the route's strategy records.
  The legacy router nevertheless creates persisted signals at
  `server/routes/strategies.ts:592`, `:647`, and `:924`. Since the downstream
  execution ownership of those injected signals is not established, the
  original router remains unmounted rather than exposing those writes through
  the compatibility surface.
- `server/routes/api/signal-generation.ts` calls
  `CompletePipelineSignalGenerator.generateSignal()` and returns the result;
  it does not persist or enqueue a signal. The active strategy synthesis
  endpoint is separately guarded in `server/routes.ts:1318`, and live signal
  generation is implemented directly by `server/trading-engine.ts:844-981`.
  Because generated signals are execution inputs by policy, the restored
  generation endpoints require the operator token and audit despite not
  writing durable state.
- The symbol-universe router exposes no add/remove tradable-symbol mutation.
  Its only mutation is UI configuration. Runtime consumers read symbol
  definitions through `server/services/market-data/market-data-layer.ts:293-301`
  and `server/services/symbol-runtime-manager.ts:92`; order-side symbol
  canonicalization occurs at `server/trading-engine.ts:8`. The restored router
  therefore leaves read-only lookups open, validates bounded transform/query
  inputs, and authenticates only the UI-config state mutation.

Batch 3 path-collision audit: the signal and historical routers are mounted in
that order under `/api/backtest`, but their route prefixes are disjoint
(`/signal`, `/signals`, `/stats`, `/history`, `/export`, `/prune` versus
`/historical` and `/historical/summary`), so no cross-router shadowing was
found. The phase 6, capability, velocity, adaptive-holding, and clustering
routers use distinct static prefixes. `flow-field-backtest.ts` is not mounted;
its import alone does not create an active route.

Batch 3 write-target audit: optimization state is a process-local
`MirrorOptimizer`; signal backtest results are a process-local bounded buffer;
historical results are returned directly and not persisted by its route.
Phase 6 writes result records through `storeBacktestResult`, but that group
remains disabled pending a consumer and cost review. Searches found no
live/paper execution consumer for the restored optimization, signal
backtesting, or historical outputs. Consequently those mutations are
authenticated non-capital state changes, not operator-controlled capital
actions.

Batch 3 bounded-cost findings: restored compute routes enforce explicit request
caps and tests stub the heavy engines. The disabled groups cannot honestly be
called bounded because their handlers either fan out historical work without
caps, accept arbitrary trade arrays, or create internal synthetic workloads
independent of request bounds.

### 8.7 Health endpoint no longer publishes fabricated data

`/api/health` previously reported `connectedExchanges: 6` and a synthetic
`dataFreshness` of "0 ms old, not stale" without contacting anything, and
`/api/health/exchanges` returned a hardcoded active/geo-restricted list. Those
now report `unknown`/`null` with an explicit note. The liveness (`/api/health`
in `routes.ts`), readiness (`/api/health/readiness`) and live-trading gate
distinctions are unchanged.

### 8.8 Still outstanding (Pass 3)

| Priority | Item |
| --- | --- |
| P0 | **Closed in Hardening Pass 3 Phase A:** local positions/orders are atomically persisted under `data/`, loaded before live exchange queries, and included in the startup reconciliation barrier |
| P0 | **Closed in Hardening Pass 3 Phase B:** fill-aware close orders and durable realized PnL/daily-loss accounting are covered in §9.2 |
| P0 | **Closed in Hardening Pass 3 Phase B:** funding accounting and the unknown-funding gate are covered in §9.3; venue support remains a Pass 4 item |
| P1 | **Closed in Hardening Pass 3 Phase A:** `resume()` awaits startup and reports failure when durability, local state, initialization or reconciliation refuses the start |
| P1 | **Closed in Pass 4B:** cache key uniqueness, TTL, invalidation, stampede and memory-only restart semantics; no persisted live cache was found, so persisted-cache corruption is not applicable |
| P1 | **Partially closed in Pass 4C:** fixture-driven paper/live gate observations and order-intent parity; full market-data replay and MIXED-mode parity remain unexercised |
| P1 | **Partially closed in Pass 4C:** concurrent flatten, operator stop during an in-flight order, and stale TruthEngine refusal are covered; the ticker cache has no capital-adjacent consumer, so cache-specific gate wiring remains unproven |
| P1 | **Partially closed through Pass 5 Batch 4d:** the previously restored route groups plus authenticated/bounded `/api/optimize`, signal backtesting, historical backtesting, symbol-universe, operator-guarded signal generation, authenticated/ownership-checked user settings, and the bounded strategy compatibility surface are covered and restored; signal-injecting/destructive legacy strategy routes and the gateway router remain disabled because their signal, import-time initialization, venue/cache, ownership, and cost boundaries are not established, while `/api/agents/signals` and the remaining heavy backtest groups stay disabled pending explicit latency, ownership, complete coverage, or safety review |
| P2 | **Partially closed in Pass 4E:** the 362-error baseline is classified below; safe registry and measurement work is complete, while legacy type errors and non-capital global handoffs remain open |

Scanstream is **not** production-ready for live capital on this branch. The
direction of failure is now defensive — it refuses to trade when it cannot prove
state — but route coverage, legacy typecheck classification, venue-specific
validation and the remaining Pass 4 items in §9.5 remain open.

## 9. Hardening Pass 3

Pass 3 closes the restart-state and asynchronous-resume failures identified in
§8.8, then carries fill-aware close accounting through daily loss and funding
gates. It does not claim that venue-specific accounting or the wider
production-readiness programme is complete.

### 9.1 Phase A — durable local execution state

The Phase A defect was that `this.orders` and `this.positions` were memory-only.
After a process restart, startup reconciliation received empty local views and
could pass vacuously: a locally open order missing from the exchange response or
a locally known position absent from the exchange could not block trading.

`durable-local-state.ts` now stores the local order and symbol-keyed position
view under `data/live-execution-state.json` with schema-version metadata,
written-at metadata, temp-file plus fsync plus rename persistence, and
injectable test seams. Live startup loads it before any exchange query.
`absent`, `ok` and `unreadable` are distinct outcomes; unreadable state and
failed writes block live execution and create durable safety events. Client order
IDs are persisted so ambiguous orders can be matched after restart.
`resume()` awaits startup, durability and reconciliation instead of reporting
success before asynchronous work finishes. Paper/test mode remains intentionally
less strict.

The review fixes in this phase also ensure a confirmed exchange order is still
returned and emitted when its local persistence fails, unchanged order polls do
not rewrite the state file, and exchange reconciliation updates the fill ledger
instead of bypassing it.

### 9.2 Phase B — fills, realized PnL and daily loss

The remaining defect was that closing a position discarded the exchange response,
deleted exposure on partial or ambiguous outcomes, and sent mark-price PnL to
the RL callback. Close orders now carry client IDs, use reduce-only parameters
when the loaded market is contract-based, retain their own fill account and
fees, and reconcile ambiguous placement before any decision. Unknown outcomes
retain the position and block execution. Confirmed partial fills reduce
quantity; only a confirmed full fill removes the position.

`realized-pnl-ledger.ts` computes long and short close PnL from entry cost basis
and actual exit fills. Quote fees are subtracted. Non-quote fees remain
unconverted until the same-venue conversion path proves a fresh direct or
inverse market price. Conversion accepts only a positive finite ticker price
with an explicit timestamp inside `PNL_CONVERSION_MAX_AGE_MS` (one minute by
default), and never uses a stale, timestamp-less, cross-venue, or estimated
rate. Each successful fee or funding conversion is an immutable append-only
ledger record containing the source amount, quote amount, rate, market,
direction, ticker timestamp and original entry reference; failed conversion
keeps the original entry unknown.
The ledger is append-only by event ID, atomically persisted under
`data/realized-pnl-ledger.json`, loaded before live exchange access, and treated
as unknown if corrupt or unreadable. Daily loss uses ledger PnL and the more
conservative of balance-derived and ledger-derived results; unknown daily PnL
blocks live execution. The RL callback receives realized PnL or explicit null.
Unknown entries can be resolved only one at a time through the authenticated,
audited operator endpoint in §7. Numeric attestations and explicit
unknown-and-excluded decisions are durable and immutable; unresolved entries
continue to make the daily summary unknown. Both balance and ledger daily
windows use UTC calendar dates.

### 9.3 Phase B — funding

`funding-accounting.ts` queries CCXT `fetchFundingHistory` for swap/perpetual
markets and falls back to funding-type entries from `fetchLedger` when the
venue declares that capability. It persists payment IDs idempotently under
`data/funding-accounting.json`, and feeds quote-currency payments into the
realized ledger as a separate funding category with its source recorded.
Unsupported sources, failed queries and unusable responses are unknown, not
zero; a venue declaring neither source produces the explicit
`funding_source_unsupported` refusal for contract markets. Spot markets do not
require funding accounting. `ALLOW_UNACCOUNTED_FUNDING=1` is the sole
deliberate escape hatch;
it is recorded as an operator-visible safety event and must not be treated as a
normal operating mode. The first reconciliation uses an explicit bounded
initial lookback. Coverage becomes known without attestation only when the
venue response proves the requested window (for example, a short first page
at the boundary); a symbol whose older history remains unprovable stays
unknown until an operator-attested baseline is recorded through
`POST /api/live-trading/funding/attest`. The attestation requires one exact
symbol and a reason, is durable and audited, and cannot clear another
symbol's gap. The default initial window is 24 hours and is bounded to seven
days; the default minimum recheck interval is one hour. Known answers are
cached only within the recheck interval. Unknown answers are never reused,
and failed or truncated later queries return to unknown.
Subsequent queries page until a short response, advance the cursor only after
complete pagination, and reuse only a durable known answer within the minimum
recheck interval; unknown answers are never cached.

### 9.4 Pass 4B — cache hardening

`TickerSnapshotCache` is explicitly venue-scoped: keys contain the venue and
symbol, and values record the venue source. Calls without an explicit venue
return unknown rather than selecting whichever exchange answers first. Reads
accept a caller-provided maximum age and never return an expired value. The
cache retains single-flight requests per venue/symbol, bounds concurrent
upstream fetches, does not store failed fetches, and applies a short per-key
failure backoff. Per-key, per-venue and global invalidation are available and
are invoked on venue initialization/reload, venue switching and kill-switch
activation.

The ticker cache, `PriceCache`, gateway `CacheManager`, scanner indicator and
signal caches, and velocity caches are process-memory optimizations. They start
empty at boot; none is a source of truth for exposure or durable local
execution state. No cache file or database persistence is used by these paths,
so there is no persisted cache to restore after corruption. The gateway cache
manager records TTL as a duration from insertion and supports an explicit
read-age bound. Historical/VFMD files under `data/cache/` are offline
backtest/training artifacts, not live execution inputs.

### 9.4.1 Deliberately unimplemented

This pass does not invent exchange rates, use cross-venue prices, or triangulate
through an unrelated asset. It does not add Prisma models or restore route
groups without the required contract, bounded-cost, and authentication
evidence. The remaining work is tracked below rather than hidden by this pass.

### 9.5 Pass 4

| Priority | Item |
| --- | --- |
| P0 | **Closed in Pass 4A:** same-venue direct/inverse conversion for non-quote fees and funding; stale or unavailable prices remain unknown |
| P0 | **Partially closed in Pass 4A and corrected in Pass 5:** funding source fallback is fail-closed and now queries ledger by settle currency, but it only works on venues whose funding ledger rows carry resolvable market attribution. The original symbol-scoped call and unconditional symbol check made the fallback non-functional; venues without attributable rows remain funding-unsupported and refuse explicitly |
| P1 | **Closed in Pass 4B:** venue-scoped keys, explicit age bounds, invalidation, concurrency limits, single-flight, failure backoff and memory-only restart semantics. No persisted live cache was found, so persisted-cache corruption is not applicable |
| P1 | **Partially closed in Pass 4C:** fixture-driven paper/live gate observations and order-intent parity, plus a REPLAY confidence-scorer oracle; the full historical pipeline and MIXED mode are not reproducible in-process |
| P1 | **Partially closed through Pass 5 Batch 4d:** route-level contracts restored `/api/scout`, `/api/phase5`, `/api/analysis/multi-timeframe`, `/api/symbols`, authenticated `/api/physics`, authenticated `/api/learning`, authenticated `/api/agents/physics`, operator-guarded `/api/agents/exit`, authenticated `/api/agents/interactions`, authenticated/bounded `/api/optimize`, signal backtesting, historical backtesting, symbol-universe, operator-guarded signal generation, authenticated/ownership-checked `/api/user`, and the bounded strategy compatibility surface; signal-injecting/destructive legacy strategy routes, `/api/gateway`, `/api/agents/signals`, and remaining heavy backtest groups stay disabled pending explicit consumer, latency, ownership, coverage, or safety review |
| P2 | **Partially closed in Pass 4E:** 362-error classification is committed; capital-adjacent `truthEngine` handoffs use a typed registry; indicator costs are measured. Legacy errors, non-capital globals and full DI remain open |

#### Pass 4E typecheck classification

The fresh Pass 4E baseline is 362 errors. Counts are semantic rather than
duplicates of TypeScript error codes; an error is assigned to the first
applicable cause in this table.

| Cause | Total | `server/routes` | other `server/` | `tests/` | `client/` | Assessment |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Express 5 `req.params`/path values remain `string \| string[]` | 97 | 95 | 2 | 0 | 0 | Typing gap, but each route needs a correctly typed parameter contract; blanket coercion could hide malformed requests |
| Implicit-any callback or handler parameters | 65 | 37 | 2 | 0 | 26 | Typing gaps where the surrounding API shape is known; scattered legacy callbacks need local domain types |
| Missing module or path | 8 | 0 | 2 | 5 | 1 | Five legacy `tests/` imports target removed/moved modules; no unambiguous replacement was found, so files remain as findings |
| Missing name/import or dead symbol | 53 | 0 | 11 | 0 | 42 | Requires distinguishing a removed feature from a missing import before changing behavior |
| Null/undefined flow not narrowed | 14 | 12 | 2 | 0 | 0 | Several gateway singleton checks are safety-sensitive and require an explicit unavailable-service response |
| Domain/API/type-shape mismatch, including possible latent defects | 125 | 28 | 23 | 0 | 74 | Not treated as cosmetic: wrong model fields, method names, interface implementations and argument shapes require owner review |
| **Total** | **362** | **172** | **40** | **5** | **145** | Baseline |

The raw TypeScript-code counts are TS2345 85, TS2339 83, TS7006 65,
TS2304 53, TS18047 13, TS2349 11, TS2554 11, TS2307 8, TS2538 7,
TS2367 6, TS2322 5, TS2552 4, TS2769 3, TS2353 2, and one each of
TS2459, TS2664, TS18048, TS2420, TS2739 and TS2341.

One safe legacy error was reduced without changing behavior: the disabled
`server/routes/user-settings.ts` auth middleware now uses the existing
`AuthRequest` domain type, removing its `req.user` property error. No error was
reduced by suppression, `any`, an unsafe double cast, signature widening, or
test deletion. The safe reduction count is 1: `server/routes` is 171 and the
post-change total is 361; `other server/` remains 40, `tests/` remains 5, and
`client/` remains 145. The registry and benchmark changes do not alter the
other legacy errors. In particular, the five missing test
modules are reported rather than papered over:

| File | Missing import |
| --- | --- |
| `tests/test-backtest.ts` | `./server/services/historical-backtester.js` |
| `tests/test-physics-validation-standalone.ts` | `./server/services/vfmd/types` |
| `tests/test-rtm-force-decay.ts` | `./server/services/physics-based-rtm-engine` |
| `tests/test-validation-improvements.ts` | `./server/services/rpg-agents/VFMDPhysicsAgent` |
| `tests/test-validation-improvements.ts` | `./server/services/vfmd/types` |

#### Pass 4E typed shared-service registry

`server/services/shared-service-registry.ts` declares the typed
`SharedServiceMap` and `getSharedService`/`setSharedService` operations.
Missing services return `undefined`; callers must retain their existing
fail-closed or optional behavior. The capital-adjacent `truthEngine` handoff
was converted at:

- `server/services/clustering/cluster-validator.ts`
- `server/services/gateway/exchange-aggregator.ts`
- `server/live-trading-engine.ts`
- `server/paper-trading-engine.ts`
- `server/rl-position-agent.ts`
- `server/index.ts`
- `server/__tests__/pass4c-parity-failure-injection.test.ts`

The registry intentionally does not perform a dependency-injection refactor.
Remaining global handoffs are unchanged and inventoried here:

- `server/live-trading-engine.ts`: `rlPositionAgent` (three reads)
- `server/routes/scout-report-routes.ts`: `scoutReportService`
- `server/services/websocket-signals.ts`: `__wss_bridge`, `__bridgeBroadcast`
- `server/services/coingecko.ts`: market-cap/volume aggregate globals
- `server/websocket-bridge.ts`: bridge initialization, websocket instances,
  broadcast and client-count globals
- `server/index.ts`: `scoutReportService`, `executionEngine`,
  `crossExchangeAggregator`, `discoveryAgent`, `arbitrageAgent`,
  `portfolioAgent`, `marketDataFetcher`, `signalPipeline`, and
  `scannerScheduler` publication/cleanup

These remaining handoffs are non-capital shared infrastructure, analytics,
or legacy lifecycle publication. They remain a separate migration decision;
they were not widened or silently replaced with an untyped registry entry.

#### Pass 4E indicator computation measurement

`scripts/measure-indicator-cost.ts` runs the production
`OptimizedMomentumScanner.computeScore` path and measures each dependency-free
indicator over a committed deterministic 256-frame `FIXTURE/USDT` 1-minute
fixture. It uses five warmups and 40 samples, reporting the median per
indicator. On this machine (Linux x86_64, two Intel Xeon Platinum 8559C
vCPUs, Node v22.12.0), the scanner path computed 22 indicators in
`1.0389 ms`; `ichimoku` and `volumeProfile` were explicitly deferred by the
aggressive profile.

| Indicator | Median ms | Relative |
| --- | ---: | ---: |
| `adx` | 0.0892 | 19.04% |
| `vwap` | 0.0358 | 7.65% |
| `tsi` | 0.0508 | 10.84% |
| `macd` | 0.0503 | 10.72% |
| `parabolicSAR` | 0.0305 | 6.52% |
| `atr` | 0.0292 | 6.22% |
| `keltnerChannels` | 0.0256 | 5.45% |
| `elderRay` | 0.0176 | 3.75% |
| `aroon` | 0.0166 | 3.54% |
| `sma` | 0.0117 | 2.49% |
| `obv` | 0.0117 | 2.50% |
| `cmf` | 0.0109 | 2.33% |
| `stochastic` | 0.0078 | 1.66% |
| `slope` | 0.0079 | 1.68% |
| `mfi` | 0.0070 | 1.50% |
| `bollingerBands` | 0.0068 | 1.45% |
| `williamsR` | 0.0063 | 1.35% |
| `vwma` | 0.0050 | 1.06% |
| `cci` | 0.0049 | 1.05% |
| `fibLevels` | 0.0024 | 0.52% |
| `ema` | 0.0012 | 0.25% |
| **Summed per-indicator medians** | **0.4687** | **100%** |

The summed per-indicator medians are below the `1.0389 ms` scanner-path
measurement, so the table is consistent with the production path rather than
claiming that one component costs more than the complete computation. The
script also asserts that every measured indicator produces at least one finite
numeric output on the fixture. Its `computations` calls were checked against
the indicator signatures in `server/services/scanner/indicators.ts`; in
particular, `vwap` uses `(close, volume)` and no longer receives the OHLC
arrays. The benchmark is evidence for relative cost, not a CI performance
gate.

`pnpm run typecheck` does not include `scripts/`: `tsconfig.json` includes
`client`, `shared`, `server`, `tests` and `tools`, while its exclusions omit
the measurement script. A standalone script-inclusive check initially found
three errors in the script's optional `diagnostics` access; those are now
fixed with an explicit production-result guard. The corrected standalone
check still finds six pre-existing errors outside the script:
four missing symbols in `server/rl-metrics.ts` and one private
`SignalClassifier.sharedInstance` access, plus the existing nullable
`exchange.symbols` access in `server/services/live-velocity-calculator.ts`.
The repository-wide baseline intentionally remains scoped by `tsconfig.json`
and is unchanged by those unrelated errors.

The parity fixture intentionally records the legitimate paper/live differences:
live-only durability, funding and conversion gates; generated client-order IDs;
paper shadow-fidelity post-processing versus live exchange-reported fills; and
wall-clock timestamps. Any other observed gate or intent-field divergence fails
the fixture. Funding and durability observations come from the real engine
calls; this spot fixture observes funding as `not_required`, and conversion is
not exercised because there is no non-quote fee or funding payment. The
successful reconciliation, exposure, daily-loss and final sizing gates do not
emit individual success events; the fixture observes their non-blocking path
and the resulting order amount rather than fabricating per-gate "passed"
labels.
mode-detector `REPLAY` path is verified through the confidence scorer's
explicit no-trade result, but `executeSignal` currently returns without an
`executionBlocked` event for that branch. The engine consumes signals rather
than `WorldTick` directly, so the full historical market-data pipeline and
`MIXED` mode (REST backfill plus live WebSocket updates) remain operational
validation items.

The stale-data failure fixture uses the production `TruthEngine.isTradeable`
path and observes its `stale:<age>` refusal. `TickerSnapshotCache` remains a
memory-only optimization with no capital-adjacent consumer in the current
engine, so no test claims that the cache itself gates execution.

Scanstream remains **not production-ready for live capital**. The hardening
direction is fail-closed, but route coverage, legacy typecheck classification,
venue-specific operational validation and the unexercised `MIXED` pipeline
remain required.

### 9.6 Pass 5 — route hardening and type baseline

Pass 5 is complete as a classification and hardening pass. It does not
change the readiness conclusion above: Scanstream remains **not production-ready
for live capital**.

#### Route track final inventory

The route track's rule is now explicit: **disabled means actually unmounted**.
Commenting a router out in one registration path is not sufficient when a
second `registerRoutes(app)` path still mounts it. The final restored and
disabled groups are:

| Group | Final status | Authentication and boundary |
| --- | --- | --- |
| `/api/health`, `/api/agents/services-api`, `/api/scout`, `/api/phase5`, `/api/analysis/multi-timeframe`, `/api/symbols` | Restored | Public read-only routes with bounded inputs, handled failures, and route-level coverage; the simulated ability mutation under `/api/agents/services-api` is separately authenticated below |
| `POST /api/agents/services-api/ability/:ability/use` | Restored | Simulated state-changing ability use requires `requireAuth` and a bounded `routeParam()` ability name; it is not an execution or capital route |
| `/api/model-performance` | Restored | Metrics/history/status reads remain public; `POST /validate` and `POST /ensemble-predict` require `requireAuth`, while destructive process-global `POST /prune` requires `requireTradingOperator`, an operator audit, and finite retention-day bounds |
| `/api/execution` | Restored | `GET /status` is public; decision, outcome, and reset mutations require the trading-operator guard and audit |
| `/api/physics`, `/api/learning`, `/api/agents/physics` | Restored | Public status/read routes remain open; heavy or state-changing operations require authentication and bounded inputs |
| `/api/agents/exit` | Restored | Status is public; decision, coordination, and outcome mutations require the trading-operator guard and audit |
| `/api/agents/interactions` | Restored | Reads are public; process-global recording mutations require authentication and bounded payloads |
| `/api/symbol-universe` | Restored | Read-only lookups are intentionally public: they are bounded metadata reads with no secrets; the UI-configuration mutation requires authentication |
| `/api/optimize`, `/api/backtest/signal`, `/api/backtest/historical` | Restored | Compute mutations require authentication and enforce explicit symbol, date, candle, signal, iteration, and timeout bounds; reads are bounded and covered |
| `/api/signal-generation` | Restored | Generation routes require the trading-operator guard and audit because their output is an execution input, even though the route itself does not persist a signal |
| `/api/user` settings | Restored | Authenticated user-self access; trading settings and venue-credential mutations require operator authentication and audit, with persisted ownership checks |
| `/api/strategies` compatibility reads and analysis | Restored | Read-only strategy metadata, signals, feature state, duration comparison, and result reads are public; consensus, backtest, duration, and pyramid analysis require authentication and bounded inputs |
| `POST /api/strategies/synthesize` | Restored | `requireAuth` rather than operator authentication; the route only synthesizes and returns analytical output, does not call `storage.createSignal()`, does not mutate engine state, and no engine consumer of its returned value was found. Audit remains attached |
| Read-only gateway compatibility (`/api/gateway/signals/performance/*`, `/api/gateway/dataframe/*`, `/api/gateway/price/*`, `/api/exchange/status`) | Restored | Intentionally public, bounded read-only compatibility router; it does not import `gateway.ts`, initialize the gateway, persist signals, mutate venues, or fetch through unbounded provider paths. The exchange-status shape is compatible, but `trading_pairs` and `api_latency_ms` remain known-degraded zero values |
| `/api/agents/signals` | Disabled/unmounted | Although isolated contract tests exist and recording is authenticated, the read paths fan out into multiple external/analytical pipelines without one enforceable request deadline |
| Main `/api/gateway` router | Disabled/unmounted | Its routes remain coupled to import-time `initializeGateway()` and recurring refresh intervals, cache/venue mutations, external fan-out, signal persistence, and incomplete cost/error contracts |
| `/api/backtest` phase 6 unified | Disabled/unmounted | Stored-result writes and request-controlled asset, agent, strategy, timeframe, and gap-healing fan-out lack a complete enforceable cost and consumer contract |
| `/api/backtest` capability measurement | Disabled/unmounted | Multi-asset historical work and arbitrary trade-array impact routes lack complete asset, date, trade, and cost caps |
| `/api/backtest` velocity profile, adaptive holding, and clustering | Disabled/unmounted | Heavy analytical work lacks the required explicit latency/cost boundaries and complete route contracts |
| `POST /api/strategies/enhanced-bounce/execute`, `POST /api/strategies/:id/execute`, `POST /api/strategies/execute-all` | Disabled/unmounted | These inject signals; `execute-all` also permits unbounded caller fan-out, and downstream ownership is not established |
| `DELETE /api/strategies/backtest/:id` | Disabled/unmounted | Destructive stored-state mutation has no owner-scoped deletion contract |

The restored `requireAuth` routes use a shared-token stopgap rather than
sessions: when `API_ACCESS_TOKEN` is configured, the app-wide
`x-api-access-token` middleware attaches the fixed non-privileged identity
`shared-api-token`; missing or incorrect tokens remain unauthenticated. This
identity is not per-user authentication, cannot satisfy the separate trading
operator token, and is not sufficient for a multi-user deployment. Ownership
scopes therefore remain isolated to that one shared identity until session
authentication exists.

Four routers were found to be disabled in appearance only and were fixed as
registration findings, not treated as documentation footnotes:

1. **Legacy strategies:** a second registration path kept the router live.
   Its handlers reached `storage.createSignal()` at
   `server/routes/strategies.ts:592`, `:647`, and `:924` without established
   downstream ownership. The signal-injecting routes therefore remain
   unmounted.
2. **Agent signal insights:** the router was commented in the apparent
   disabled block but mounted by `registerRoutes(app)`. Its alternate mount
   was removed because the read paths lack a uniform latency deadline.
3. **User preferences:** `server/routes/user-preferences.ts` was active at
   `/api/user` and accepted arbitrary `x-user-id` headers, allowing
   cross-user reads and writes to in-memory preferences. That mount was
   removed; the owner-scoped `user-settings` router is now the sole
   registration.
4. **Velocity-profile helper:** the distinct `velocity-profiles.ts`
   registration helper exposed `/api/velocity/*` through `registerRoutes(app)`
   despite the primary velocity router being disabled. Its registration was
   removed pending dedicated bounded-work coverage.

Ownership gaps found and closed in the restored user surface:

- Session revocation now verifies persisted session ownership, returning
  `403` for another user's session and `404` for an unknown session.
- API-key deletion now verifies `ApiKey.userId` before deletion, with the
  same cross-owner/unknown-record distinction.

Client compatibility and deliberate breakage are recorded explicitly:

| Client surface | Path/action | Result |
| --- | --- | --- |
| `UnifiedSignalDisplay`, signal-performance, gateway-scanner, trading-terminal | Restored read-only strategy/gateway compatibility calls | Restored with bounded, handled read routes |
| `strategy-synthesis.tsx:67` | `POST /api/strategies/synthesize` | Restored for authenticated users after the no-persistence/no-engine-effect review |
| `BounceStrategyCard.tsx:43` | `POST /api/strategies/enhanced-bounce/execute` | Deliberately non-functional; the UI should hide or disable this signal-injection action |
| `strategies.tsx:214` | `POST /api/strategies/execute-all` | Deliberately non-functional; signal injection and unbounded fan-out remain disabled |
| `backtest.tsx:224` | `DELETE /api/strategies/backtest/:id` | Deliberately non-functional; destructive deletion has no ownership contract |
| `agent-interactions.tsx:307,322,335` | Exit-agent `consensus-history`, `interaction-flow`, and `activity-log` reads | Remain `404`; these paths are not part of the covered seven-route exit router |

#### Type track

The classified TypeScript baseline moved from **362 errors to 0**:

| Area | Pass 4E baseline | After T1 defects | After T2 mechanical server pass | Pass 5 final |
| --- | ---: | ---: | ---: | ---: |
| Total | 362 | 304 | 168 | 0 |
| `server/routes` | 172 | 143 | 14 | 0 |
| Other `server/` | 40 | 11 | 9 | 0 |
| Client | 145 | 145 | 145 | 0 |
| Tests | 5 | 5 | 0 | 0 |
| Execution | 0 | 0 | 0 | 0 |
| Risk | 0 | 0 | 0 | 0 |
| Observability | 0 | 0 | 0 | 0 |

The typecheck baseline is now genuinely **0**. Server-side PNG rendering in
`server/chart-api.ts` is deliberately not implemented in this build rather
than carried as an absent dependency: `chartjs-node-canvas` would require
native Cairo/Pango libraries, and its failed optional import previously made
the entire chart API unavailable, including the independent chart-data route.
`GET /api/chart-data/:symbol` remains registered; `GET
/api/chart-image/:symbol` remains registered and returns HTTP 501 with an
explicit server-side-rendering-unavailable error.

##### T1 confirmed runtime defects

The defect-first pass verified reachability before changing behavior:

| Defect | Reachability evidence | Fix and regression coverage |
| --- | --- | --- |
| Missing `priceCache` binding in `ccxt-scanner.ts` | `scanSymbols()` defaults to the cache path; active scanner routes call it | Imported the established `PriceCache` singleton; `server/services/gateway/__tests__/ccxt-scanner.test.ts` covers the cache path |
| `rl-metrics.ts` module-local metrics were out of scope | `rl-feedback-loop.ts` calls `recordDomainReward()` and `recordEpisode()` | Moved typed bindings to module scope; no stable isolated test seam |
| Nullable `exchange.symbols` in live velocity | `calculateLiveVelocityProfile()` is reached through asset-velocity and strategy integration paths | Loads markets before symbol access and retains a defensive empty-symbol path; no stable isolated test seam |
| Missing `scanLoop` in continuous scanner | `examples.ts` starts the scanner and the undeclared scheduler call ran during startup | Removed the nonexistent call; `continuous-scanner-optimized.test.ts` covers startup/scan |
| Nullable aggregator in signal-price monitor | `server/index.ts` starts the monitor while gateway aggregation initializes asynchronously | Defers a tick until the aggregator is available; no stable isolated test seam |
| OANDA candle source mismatch | Forex engine consumes the adapter's REST candle output | Uses historical-source metadata with OANDA origin; `oanda-adapter.test.ts` covers the shape |
| Invalid adaptive-controller drift audit payload | `adaptiveController` is initialized and used from `server/index.ts` | Sends the declared drift metrics and stale flag; no stable isolated test seam |
| Static calls to instance ML services/models | `server/routes.ts` mounts the ML advanced, training, and advanced-model routes | Instantiates the services/models and narrows route parameters; no stable isolated test seam for the ML routes |

The remaining T1 fixes were domain/type safety corrections rather than
separately demonstrated runtime failures: declared trade fields replaced
nonexistent fields, arbitrary thrown values in `AgentArena` are described
safely, the `MLModel` persistence contract is implemented, Yahoo candle
results are typed, `RLPositionAgent` is imported as a type, and the signal
classifier singleton visibility matches its existing runtime use. The five
without a stable regression-test seam are explicitly acknowledged above:
RL metrics, live velocity, signal-price monitor, adaptive controller, and the
ML routes.

##### Boundary and client contract fixes

The shared `routeParam()`/`routeParamEnum()` boundary rejects arrays, empty
values, overlong values, and non-allowlisted values rather than coercing them.
The active groups tightened by this boundary include agent abilities,
API-docs, CoinGecko and CoinGecko charts, commander, composite quality,
correlation boost, fast scanner, feature flags, live trading, live velocity,
ML automated trading, ML multi-timeframe predictions, MTF confirmation,
paper trading, RPG agents, scanner, scanner analysis, scanner signal,
source analytics, strategy deployment, and chart API. Ordinary client
call-sites remain within the accepted contracts; malformed values now receive
validation errors rather than reaching handlers. Repo-wide, malformed route
parameters answer 400 through local `respondToInvalidRouteParam()` handling
where broad catches would otherwise swallow them and the app-wide
`routeParamErrorHandler` mounted after route registration for propagated errors.
Disabled gateway surfaces
were typed without being mounted or given new behavior.

The ML consensus client contract was corrected against the server response:
the client now accepts `price`, `pricChangePct`, `riskLevel`, string-valued
`volatility`, `regimeDuration`, and string-valued `maxVolatility` instead of
the stale `probability` and numeric volatility fields. Before this fix, Zod
rejected the server response and the widget stayed in its error state; it now
renders the server's risk and volatility values.

The follow-up review fixes preserve the same fail-closed boundaries:

- `CacheManager` now treats a caller-supplied `maxAgeMs` as absolute. A
  caller-bound miss does not evict an entry that remains valid for a looser
  caller; entry-TTL expiry is separately stale-readable only when
  `allowStale` is enabled. `ticker-snapshot-cache.ts` already applies its
  requested age bound independently and has no equivalent stale-override
  path.
- Ledger funding fallback now resolves the requested market, queries CCXT by
  its settle currency (or quote only when settle is absent), and resolves
  row identifiers through the venue's own market lookup/index. Rows for
  another market sharing the currency are skipped only when exactly one
  contract market is resolved; rows with no contract attribution return
  `funding_ledger_unattributable`, and rows resolving to multiple contract
  markets return `funding_ledger_attribution_ambiguous`. Both remain
  `unknown` and block execution. The earlier Pass 4A ledger claim was
  therefore corrected: the fallback had been non-functional when it queried
  by market symbol and required a direct symbol field, and it works only on
  venues with resolvable, unambiguous contract attribution.
- The model-performance mutations (`validate` and `ensemble-predict`) and
  simulated agent ability use are authenticated with `requireAuth`; numeric
  fields are finite, ensemble input is capped, and the ability name uses
  bounded `routeParam()` validation. Destructive `prune` operates on
  process-global history with no ownership model, so it requires
  `requireTradingOperator` and records the `prune_model_history` operator
  audit action with its `daysToKeep` target.

`RealtimeContext` no longer contains cache-update branches for
`world_tick`, `tick`, `ui_tick`, `orderbook_update`, `market_frame`, and
`positions_update`. The client type did not admit these event names, and a
server-wide search found no server emission, so these were stale unreachable
branches rather than an omitted active event contract. Separately, the
`useWorldTicks` and `useMarketFrames` are intentionally cache-only React Query
v5 hooks: `enabled: false` prevents the default query function from issuing
requests for their non-HTTP keys while preserving cache subscriptions and
`select` behavior, and `trading-terminal.tsx` still populates both caches
through its MDL subscription. This was reviewed and dismissed as a regression.

Two additional review items were checked and dismissed:

- `user-settings.ts` records operator audits on `res.on('finish')`, with
  `success: res.statusCode < 400`; downstream validator rejection is therefore
  recorded as a failed operator attempt, which is the intended audit behavior.
- The stochastic call in `server/multi-timeframe.ts` matches the declared
  `calculateStochastic(prices, highs, lows, kPeriod, dPeriod)` signature in
  `server/trading-engine.ts`; its argument order is correct.

The Python-helper hardening in `server/routes/strategies.ts` remains inert:
that router is still unmounted, so its subprocess bounds are not an active
mitigation for a live route.

#### What Pass 5 does not close

Pass 5 does not claim production readiness. The following remain open or
deliberately disabled:

- The main gateway router remains unmounted; importing its module still has
  the `initializeGateway()` import-time side effect and recurring refresh
  intervals, so the read-only compatibility router is intentionally separate.
- Agent signal insights remain disabled until a uniform request latency
  deadline exists.
- Phase 6 unified backtesting, capability measurement, velocity profile,
  adaptive holding, and clustering remain disabled pending explicit cost,
  timeout, ownership, and consumer contracts.
- The three signal-injection strategy routes and `DELETE /backtest/:id`
  remain unmounted for the ownership/safety reasons above.
- Full historical replay and `MIXED`-mode parity remain incomplete.
- Venue-specific validation and operational validation remain outstanding.
- Server-side chart PNG rendering remains deliberately unavailable and is
  exposed as an explicit HTTP 501 response; the chart-data route remains
  active and the typecheck baseline is clean.

The hardening direction is fail-closed, but these remaining route, cost,
replay, venue, and dependency gaps mean Scanstream remains **not production-ready
for live capital**.
