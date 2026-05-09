# Cross-Exchange Scanning & Arbitrage Blueprint

This document describes the design and APIs for cross-exchange aggregation, discovery, arbitrage detection, healing, and portfolio handling — all implemented to fit the existing IntegrityGate/world.tick architecture.

Key principles:
- Agents still subscribe to `world.tick` (mandatory).
- Aggregator listens to `world.tick`, maintains per-exchange state, and provides a queryable aggregated view via `getAggregated(symbol)`.
- Agents use the Aggregator inside `onWorldTick` to reason about multi-exchange state.
- No agent reads raw adapter events or bypasses the gate.

## Components

- `CrossExchangeAggregator` (service)
  - Listens to `world.tick`
  - Keeps latest candle per exchange per symbol
  - Computes `AggregatedCandle` with `bestBid`, `bestAsk`, `spread`, `confidence`
  - API: `getAggregated(symbol)`, `getPerExchange(symbol)`, emits `aggregated.updated`

- `DiscoveryAgent` (agent)
  - Extends `BaseAgent` (mandatory)
  - On `world.tick` detects new symbols and updates `SymbolUniverse`
  - Emits `universe.added` and `universe.updated`

- `ArbitrageAgent` (agent)
  - Extends `BaseAgent` (mandatory)
  - On `world.tick` queries aggregator and computes spreads
  - Emits `arb.signal` for execution layer

- `PortfolioAgent` (agent)
  - Tracks positions per symbol/exchange
  - Reacts to `arb.signal` and to gap events
  - Applies risk rules based on `aggregator.getAggregated(symbol)` confidence

- `HealingService` (service)
  - Provides forward-fill and interpolation
  - Returns synthetic candles with confidence scores
  - Doesn't auto-commit healed candles — gives candidates to portfolio/agents

## Event Flow

```
IntegrityGate emits `world.tick` (per validated candle)
      │
      ├─ CrossExchangeAggregator (listens to world.tick)
      │     └─ updates aggregated cache, emits `aggregated.updated`
      │
      ├─ DiscoveryAgent (onWorldTick) → updates universe
      │
      ├─ ArbitrageAgent (onWorldTick) → queries aggregator.getAggregated() → emits `arb.signal`
      │
      └─ PortfolioAgent (onWorldTick) → uses aggregator + healing service
```

## Metrics & Observability

- `aggregated.updated` events for dashboards
- Spread per symbol
- Latency per exchange (derived from tick timestamps)
- `arb.signal` counts and average spread
- Synthetic candle confidence distribution

## Integration Notes

- Keep `world.tick` as the canonical event bus. Aggregated state is queryable and separate.
- Don't emit additional `world.tick` events from aggregator; keep IntegrityGate as source of world ticks.
- Aggregator may optionally write aggregated snapshots to storage if persistence is desired (for backtesting).

## Execution & Risk

- Execution should be handled by a separate execution service which subscribes to `arb.signal` and applies order-routing and slippage estimates.
- PortfolioAgent should maintain on-exchange balances (or read from exchange APIs) to ensure arbitrage is feasible.
- Risk checks: gap detection, latency window checks, per-exchange daily limits.

## Next Steps

1. Wire the `CrossExchangeAggregator` instance into startup (pass IntegrityGate event emitter to constructor).
2. Instantiate `DiscoveryAgent`, `ArbitrageAgent`, `PortfolioAgent` with `integrityGate` and `aggregator`.
3. Add small E2E test: publish a sequence of `world.tick` events for same symbol from different sources and assert aggregator produces expected `AggregatedCandle` and `arb.signal`.
4. Harden healing service and integrate with PortfolioAgent as a fallback.

