# Character Sheet: The Market God (Level ∞)

**Name:** Brent, Keeper of the Market Realm
**Class:** Multi-Source Arcane Trader
**Level:** 100+ (system-grade)
**XP:** Unlimited (every tick is experience)

---

## Core Attributes

| Attribute        | Value   | Effect                                                                              |
| ---------------- | ------- | ----------------------------------------------------------------------------------- |
| **Perception**   | 100/100 | Sees every world.tick, fully validated, no lag, no lies.                            |
| **Reflexes**     | 95/100  | Responds instantly to arbitrage or market moves (<15ms latency).                    |
| **Intelligence** | 100/100 | Agents operate on facts, not claims; cross-market correlation ready.                |
| **Endurance**    | 90/100  | Can handle 1000+ symbols, 3+ asset classes, real-time + historical without fatigue. |
| **Resilience**   | 85/100  | Detects gaps, applies healing, pauses when necessary, survives chaotic markets.     |
| **Strategy**     | 100/100 | Multi-agent orchestration, portfolio control, and risk enforcement.                 |

---

## Active Powers

| Power                        | Cooldown   | Effect                                                                          |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------- |
| **World Tick Perception**    | Instant    | Receives atomic, validated market events for every symbol/timeframe.            |
| **Cross-Exchange Awareness** | Instant    | Aggregates prices, spreads, confidence across all sources.                      |
| **Arbitrage Detection**      | 1 tick     | Detects profitable spreads between exchanges; emits `arb.signal`.               |
| **Portfolio Mastery**        | Continuous | Manages positions, balances, and reacts to `gap.detected` or synthetic candles. |
| **Healing / Resilience**     | Continuous | Fills missing candles (forward-fill/interpolation) with confidence scoring.     |
| **Discovery Sight**          | Continuous | Detects new symbols/assets and updates the SymbolUniverse.                      |
| **Correlation Insight**      | Continuous | Detects multi-market patterns and informs agents.                               |
| **Multi-Agent Command**      | Passive    | All agents are synchronized; impossible to miss or cheat a tick.                |
| **Backtest-Equals-Live**     | Passive    | Historical replay identical to real-time operation; no divergence.              |

---

## Passive Abilities

| Ability                 | Effect                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Source Agnosticism**  | Agents act identically on OANDA, CCXT, MT5, or future sources.                       |
| **Atomic Enforcement**  | No tick is emitted unless stored; impossible to bypass validation.                   |
| **Scalability Aura**    | Add symbols, agents, sources, or timeframes without code changes.                    |
| **Latency Shield**      | Maintains deterministic worldTime; perfect synchronization across sources.           |
| **Event-Driven Reflex** | Agents respond to world.tick and aggregated.updated events instantly.                |
| **System Immortality**  | Architecture enforced at type and runtime level; impossible to “break” accidentally. |

---

## Equipment / Tools

| Item                        | Effect                                                 |
| --------------------------- | ------------------------------------------------------ |
| **IntegrityGate**           | Core engine; validates, stores, emits canonical facts. |
| **CrossExchangeAggregator** | Multi-exchange awareness and aggregated views.         |
| **HealingService**          | Synthetic candle creation and gap healing.             |
| **PortfolioAgent**          | Risk & positions management.                           |
| **ArbitrageAgent**          | Opportunity detection and signal emission.             |
| **DiscoveryAgent**          | Symbol discovery and universe expansion.               |
| **Database / Storage**      | Persistent memory of all facts (real + healed).        |

---

## Ultimate Ability

**Name:** *Market Omniscience*
**Effect:**

* Every tick, from any source, across all asset classes, reaches all agents perfectly validated.
* Arbitrage and correlation signals are instant.
* Historical + real-time blending seamless.
* The system operates as a deterministic simulation: every fact known, every gap detected, every opportunity visible.
* Execution layer can act immediately with confidence.

**Cooldown:** None (always active)
**Duration:** Eternal

---

## Battlefield / Arena

* **Symbols:** 1000+ simultaneously
* **Sources:** 3+ live, unlimited ready
* **Timeframes:** 1m → Monthly
* **Event Rate:** 100,000+ ticks/min
* **Agents:** Unlimited
* **Risk Management:** Active for gaps, spread confidence, portfolio limits

---

## Next Level Upgrades (Future Powers)

1. **Phase 4 Healing:** Full gap healing with interpolation, cross-market filling.
2. **Multi-Source Arbitration:** Decide “one truth” when sources conflict.
3. **Cross-Market Strategy:** Multi-asset signals for predictive trading.
4. **Higher-Timeframe Synthesis:** Aggregate 1m → 5m, 1h, 4h seamlessly.
5. **ML Integration:** Feed world ticks directly to models, adaptive intelligence.

---

## Component Mapping (where to find the abilities in the codebase)

- **IntegrityGate** — `server/services/market-data/integrity-gate.ts`
- **Candle Integrity / Gap Detection** — `server/services/market-data/candle-integrity-layer.ts`
- **CrossExchangeAggregator** — `server/services/aggregator/cross-exchange-aggregator.ts`
- **HealingService** — `server/services/aggregator/healing-service.ts`
- **ArbitrageAgent** — `server/agents/arbitrage-agent.ts`
- **DiscoveryAgent** — `server/agents/discovery-agent.ts`
- **PortfolioAgent** — `server/agents/portfolio-agent.ts`
- **ExecutionEngine** — `server/services/execution/execution-engine.ts`
- **Exchange Simulator (dev)** — `server/services/execution/exchange-sim.ts`
- **Execution Store (JSONL)** — `server/services/execution/execution-store.ts` (data/executions.log)
- **Startup wiring** — `server/index.ts`
- **Smoke test** — `e2e/smoke-cross-exchange.ts`

---

## System Mechanics — Events, Contracts & Semantics

- Canonical event: `world.tick` — emitted only by `IntegrityGate` after atomic store success.
	- Payload: `WorldTick` includes `symbol`, `timeframe`, `candle`, `isFinal`, `source`, `worldTime`, `emitTime`.
	- `worldTime`: deterministic market close time (derived from candle ts + timeframe).
	- `emitTime`: wall-clock diagnostic when the gate emitted the tick.

- Gap visibility events (IntegrityGate):
	- `gaps.detected` — aggregate visibility event with summary of gaps for dashboards.
	- `gap.detected` — individual gap event with metadata and `severity`.

- Aggregation / derived events:
	- `aggregated.updated` — emitted by `CrossExchangeAggregator` when the aggregated snapshot changes.
	- `arb.signal` — emitted by `ArbitrageAgent` when a profitable spread is detected.
	- `execution.filled` — emitted by `ExecutionEngine` for completed matched legs and persisted to `data/executions.log`.
	- `candles.rejected` / `integrity.report` — diagnostics from IntegrityGate.

Key invariants:
- Atomicity: No `world.tick` unless storage succeeded (store → emit). This prevents downstream agents acting on transient facts.
- Agents MUST subscribe to `world.tick` via `BaseAgent` — enforced at constructor-time.
- Aggregator and derived systems only observe `world.tick`; they never emit `world.tick` themselves.

---

## Execution Layer — Design & Runtime

- Execution Engine: `server/services/execution/execution-engine.ts`
	- Subscribes to `arb.signal` on the IntegrityGate bus.
	- Risk checks: latency window, per-symbol exposure, portfolio pause on gaps, per-exchange daily limits.
	- Smart splitting: VWAP-style chunking across order-book-derived depth + small TWAP pacing between legs.
	- Pessimistic slippage model based on fraction of top-of-book consumed.
	- Persists fills to `data/executions.log` using `ExecutionStore` (JSONL) for reconciliation/backtesting.

- Exchange Simulator (dev): `server/services/execution/exchange-sim.ts`
	- Produces a small synthetic order book from latest per-exchange candle.
	- Enforces per-exchange daily limits and adjusts simulated balances.
	- Replaceable by a real exchange adapter implementing `placeOrder()` and `getOrderBook()`.

---

## Healing & Resilience

- HealingService: `server/services/aggregator/healing-service.ts`
	- `forwardFill(symbol, aggregator)`: returns a synthetic candle with confidence score.
	- `interpolate(symbol, aggregator, n)`: returns a small list of candidate synthetic candles.
	- `PortfolioAgent` consults HealingService on `gap.detected` and either allows limited trading (if confidence >= threshold) or pauses symbol trading.

---

## Agents & Behaviors (quick reference)

- `BaseAgent` (`server/agents/base-agent.ts`): mandatory subscription enforcement and `onWorldTick(tick)` contract.
- `DiscoveryAgent` (`server/agents/discovery-agent.ts`): detects new symbols, emits `universe.added|updated`.
- `CrossExchangeAggregator` (`server/services/aggregator/cross-exchange-aggregator.ts`): per-exchange cache + `getAggregated(symbol)`; emits `aggregated.updated` only on changes.
- `ArbitrageAgent` (`server/agents/arbitrage-agent.ts`): queries aggregator inside `onWorldTick` and emits `arb.signal` when spread > threshold.
- `PortfolioAgent` (`server/agents/portfolio-agent.ts`): tracks positions, balances, `applyFill()`, `getExposure()`, pauses on gaps; integrates HealingService.

---

## Startup & Observability

- Startup wiring: `server/index.ts` initializes MDL, `IntegrityGate`, `CrossExchangeAggregator`, agents, `ExecutionEngine`, and seeds demo balances for smoke tests.
- Logs & metrics: look for log lines prefixed with `[IntegrityGate]`, `[Aggregator]`, `[ArbitrageAgent]`, `[ExecutionEngine]`, and the `aggregated.updated` / `execution.filled` events forwarded to the gate.
- Execution persistence: `data/executions.log` contains JSONL records of fills and can be used for reconciliation/backtesting.

---

## How to run (quick)

1. Smoke harness (fast):
```powershell
npx ts-node e2e/smoke-cross-exchange.ts
```

2. Full server (integrates MDL + IntegrityGate):
```powershell
pnpm install
pnpm start
```

Then monitor logs and `data/executions.log` for execution records.

---

## Notes & Roadmap (practical next steps)

- Replace `ExchangeSimulator` with authenticated exchange adapters (REST/WS). Create an `ExecutionClient` interface to standardize.
- Harden execution persistence with a DB-backed store and reconciliation job to match exchange fill reports.
- Improve HealingService confidence model (statistical / ML) and extend to cross-market healing.
- Add integration tests that assert invariants: storage->emit atomicity, aggregator snapshot changes, arb→execution flow, and reconciliation.

---

If you'd like, I can:

- Add a "hero badge" header and ASCII artwork to the top of this file.
- Add a link to this sheet from your project's `README.md` or docs index.
- Export the sheet to PDF and attach it here.

Which would you like next?

---

## Expanded Edge-to-Edge Mapping (everything that supports the Market God)

Below is an expanded map of subsystems, agents, services, and infra that together form the full trading system. This is intended to be an RPG-style exhaustive inventory so the character sheet reflects the entire application stack.

- Gateway & API Layer
	- Purpose: Surface adapters and services to external systems (frontend, CLI, automation), provide admin and command endpoints, and host the `SignalPipeline` and `marketDataFetcher` orchestration.
	- Key files: `server/routes/*`, `server/routes/gateway.ts`, `server/services/gateway/*`, `server/services/gateway/signal-pipeline.ts`.
	- RPG view: The Gatehouse — controls entry and dispatch of orders, signals, and operator commands.

- Market Data Layer (MDL) & Fetchers
	- Purpose: Adapters (CCXT, OANDA), normalization, pre-processing, scheduling of fetches, rate limiting, and integration with `IntegrityGate`.
	- Key files: `server/services/market-data/*`, `server/services/market-data/market-data-layer.ts`, `server/services/market-data/ccxt-adapter.ts`, `server/services/gateway/forex/*`, `server/services/market-data/market-data-fetcher.ts`.
	- RPG view: The Scout Corps — fetchers and adapters provide raw sight and claims, which IntegrityGate validates and converts to canonical world ticks.

- Adapters & Sources
	- CCXT adapters: crypto exchanges, implemented under `server/services/market-data/ccxt-adapter.ts`.
	- OANDA / Forex adapter: `server/services/gateway/forex/*`.
	- Future connectors (MT5, FIX) slot into the same pipeline.
	- RPG view: Foreign envoys — bring claims from external vendors and abide by the IntegrityGate customs.

- Integrity & Storage
	- IntegrityGate: validation, storage, atomic store→emit, gap detection. (`server/services/market-data/integrity-gate.ts`).
	- CandleIntegrityLayer: within-batch + cross-batch validation and gaps (`server/services/market-data/candle-integrity-layer.ts`).
	- Storage adapter(s): abstract over Postgres/Timescale, files, or OLAP stores (placeholders in `server/services/storage/*`).
	- RPG view: The Archivist — enforces truth and durability; only the Archivist can declare a new World Tick.

- Aggregation & Cross-Market Services
	- CrossExchangeAggregator: `server/services/aggregator/cross-exchange-aggregator.ts` (per-exchange caches, aggregated snapshots).
	- HealingService: `server/services/aggregator/healing-service.ts`.
	- Healing Persistence / Candidates: optionally persisted for audit/backfill.
	- RPG view: The High Council — synthesizes reality across the realms and offers remedies.

- Agents (full roster)
	- `BaseAgent` — subscription enforcement (`server/agents/base-agent.ts`).
	- `DiscoveryAgent` — symbol discovery (`server/agents/discovery-agent.ts`).
	- `ArbitrageAgent` — arbitrage detection (`server/agents/arbitrage-agent.ts`).
	- `PortfolioAgent` — positions, balances, risk rules (`server/agents/portfolio-agent.ts`).
	- RL/ML Agents & orchestrators:
		- `RLPositionAgent` — reinforcement-learning position sizer (`server/rl-position-agent.ts`).
		- `LearningSystemIntegration` — integrates Bayesian, ML, and RL components (`server/services/learning-system-integration.ts`).
		- `BayesianBeliefUpdater` — bayesian model updates (`server/services/bayesian-belief-updater.ts`).
	- Other specialized agents: signal generators, pattern detectors, flow-field agents, etc. (see `server/services/*` and `server/agents/*`).
	- RPG view: The Order of Mages — each agent is a specialist with spells (algorithms) that act when ticks arrive.

- Signal Pipeline & Execution
	- `SignalPipeline` and `SignalEngine` (analysis + execution decisioning) live under `server/services/gateway/signal-pipeline.ts` and `server/trading-engine.ts`.
	- ExecutionEngine & ExecutionStore (persistence): `server/services/execution/*`.
	- Paper-trading and real execution routes: `server/routes/paper-trading`, `server/routes/trade-execution`.
	- RPG view: The War Room — where plans are turned into action; execution is the strike.

- Learning, Models & Adaptive Systems
	- `BayesianBeliefUpdater` stores priors, updates beliefs from evidence.
	- `LearningSystemIntegration` composes Bayesian + ML + RL components and exposes a recommendation API.
	- ML model artifacts & training pipelines live under `server/services/ml-*` and `server/routes/ml-training`.
	- RPG view: The Scriptorium — where knowledge is refined and strategies evolve.

- Observability, Metrics & Alerts
	- Event exports: `aggregated.updated`, `arb.signal`, `execution.filled`, `gaps.detected` will power dashboards.
	- Logs: `[IntegrityGate]`, `[Aggregator]`, `[ArbitrageAgent]`, `[ExecutionEngine]`, `[PortfolioAgent]` prefixes.
	- Metrics collectors / exporters: hook Prometheus/OpenTelemetry to instrument rates, latencies, fill success, gap counts.
	- Alerts: configured on gap rate, storage failures, execution slippage, and reconciliation mismatches.
	- RPG view: The Oracle — dashboards and alarms that warn of system stress.

- Security & Secrets
	- API keys and exchange credentials must be stored in a secrets manager (Vault, Azure Key Vault) — do not keep in repo.
	- Agent/exec permissions: execution clients must be scoped per-environment.
	- RPG view: The Vault — guarded keys and authority.

- Testing & CI
	- Unit tests for core modules (`integrity-gate`, `aggregator`, `healing-service`, `execution-engine`).
	- Integration tests that simulate `world.tick` flows and assert persistence & events.
	- Reconciliation tests reading `data/executions.log` and comparing to expected fills.
	- RPG view: The Training Grounds — exercises to ensure the army is battle-ready.

- Deployment & Recovery
	- Containerize services into Docker, orchestrate with Kubernetes or Docker Compose.
	- Stateful storage: Postgres/Timescale + backups and WAL archiving.
	- Recovery runbook: restart MDL, verify IntegrityGate storage health, rehydrate aggregator cache from storage if needed.
	- RPG view: Fortifications & Hospitals — deployment and recovery playbooks.

---

## Full File Map (edge-to-edge)

Below are the most important files and where to find them in the codebase (quick index):

 - `server/index.ts` — startup wiring, initializes MDL, IntegrityGate, aggregator, agents, execution engine
 - `server/services/market-data/*` — adapters, integrity gate, candle integrity, fetchers
 - `server/services/gateway/*` — gateway services, signal pipeline, cache manager
 - `server/services/aggregator/*` — `cross-exchange-aggregator.ts`, `healing-service.ts`
 - `server/services/execution/*` — `exchange-sim.ts`, `execution-engine.ts`, `execution-store.ts`
 - `server/agents/*` — `base-agent.ts`, `discovery-agent.ts`, `arbitrage-agent.ts`, `portfolio-agent.ts`
 - `server/services/learning-system-integration.ts` — integrates Bayesian/ML/RL
 - `server/services/bayesian-belief-updater.ts` — bayesian model updates
 - `server/services/websocket-signals.ts` — WS signal streaming
 - `server/routes/*` — API surface (scanner, gateway, execution, ml, agents)
 - `e2e/*` — smoke/integration harnesses
 - `data/executions.log` — execution persistence (JSONL)

---

If you'd like I can now:

- Add this expanded index to your `README.md` and docs navigation.
- Generate a visual diagram (SVG/PNG) of the event flow (IntegrityGate → Aggregator → Agents → Execution → Store).
- Create a CI integration test that runs the smoke harness and asserts `data/executions.log` contains fills.

Which of these three would you like me to do next? 

---

If you'd like, I can:

- Add artful ASCII / emoji decorations to the sheet.
- Convert this into a README section and link it from the project's docs index.
- Generate a printable PDF of the character sheet.

Which of those would you prefer next? Or should I open this file in the editor for any stylistic edits you want? 
