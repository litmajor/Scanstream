import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LiveTradingEngine } from '../live-trading-engine';
import { systemKillSwitch } from '../services/system-kill-switch';
import { liveCircuitBreaker } from '../services/live-circuit-breaker';
import { durabilityGate } from '../services/execution/durability-gate';
import { DurableLocalStateStore } from '../services/execution/durable-local-state';

/**
 * The barrier: a live engine may not start or place orders until it has
 * established what the exchange already holds.
 */

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

function attach(engine: LiveTradingEngine, exchange: Record<string, unknown>): void {
  (engine as unknown as { exchange: unknown }).exchange = {
    loadMarkets: async () => ({}),
    createOrder: vi.fn(),
    ...exchange,
  };
}

function healthyExchange(over: Record<string, unknown> = {}) {
  return {
    fetchBalance: async () => ({ total: { USDT: 10_000 } }),
    fetchPositions: async () => [],
    fetchOpenOrders: async () => [],
    ...over,
  };
}

function signal(id = 'sig-1') {
  return {
    id,
    symbol: 'BTC/USDT',
    type: 'BUY',
    price: 60_000,
    confidence: 0.95,
    timestamp: Date.now(),
  } as never;
}

describe('live startup reconciliation barrier', () => {
  let engine: LiveTradingEngine;
  let stateFile: string;

  beforeEach(() => {
    durabilityGate.reset();
    process.env.DATABASE_URL = 'postgresql://user:pw@localhost:5432/scanstream';
    durabilityGate.setProbe(async () => true);
    stateFile = path.join(os.tmpdir(), `startup-state-${Date.now()}-${Math.random()}.json`);
    engine = new LiveTradingEngine(
      { enabled: true, testMode: false },
      { localStateStore: new DurableLocalStateStore({ filePath: stateFile }) }
    );
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(false);
    vi.spyOn(liveCircuitBreaker, 'isActive').mockReturnValue(false);
  });

  afterEach(() => {
    engine.dispose();
    fs.rmSync(stateFile, { force: true });
    durabilityGate.reset();
    if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    vi.restoreAllMocks();
  });

  it('starts once the exchange state has been established', async () => {
    attach(engine, healthyExchange());

    await expect(engine.start()).resolves.toBeUndefined();
    expect(engine.getReconciliation()?.complete).toBe(true);
    expect(engine.getStatus().isRunning).toBe(true);
  });

  it('refuses to start when the exchange cannot be queried', async () => {
    attach(
      engine,
      healthyExchange({
        fetchOpenOrders: async () => {
          throw new Error('ETIMEDOUT');
        },
      })
    );
    const refused = vi.fn();
    engine.on('startRefused', refused);

    await expect(engine.start()).rejects.toThrow(/reconciliation incomplete/);
    expect(refused).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'reconciliation_incomplete' })
    );
    expect(engine.getStatus().isRunning).toBe(false);
  });

  it('refuses to start while an unattributed exchange order is open', async () => {
    attach(
      engine,
      healthyExchange({
        fetchOpenOrders: async () => [
          { id: 'x-unknown', symbol: 'BTC/USDT', side: 'buy', amount: 1, filled: 0, status: 'open' },
        ],
      })
    );

    await expect(engine.start()).rejects.toThrow(/reconciliation incomplete/);
  });

  it('blocks order placement when reconciliation has never run', async () => {
    attach(engine, healthyExchange());
    const blocked = vi.fn();
    engine.on('executionBlocked', blocked);

    const order = await engine.executeSignal(signal());

    expect(order).toBeNull();
    expect(blocked).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reconciliation', reason: 'reconciliation_incomplete' })
    );
  });

  it('adopts exchange positions found at startup so risk limits see them', async () => {
    attach(
      engine,
      healthyExchange({
        fetchPositions: async () => [
          {
            symbol: 'ETH/USDT',
            contracts: 5,
            side: 'long',
            entryPrice: 3_000,
            markPrice: 3_100,
            leverage: 5,
            initialMargin: 3_100,
            unrealizedPnl: 500,
          },
        ],
      })
    );

    await engine.start();

    const status = engine.getStatus();
    expect(status.positions.map((p: any) => p.symbol)).toEqual(['ETH/USDT']);
    // 5 @ 3,100 notional, not the posted margin.
    expect(status.totalExposure).toBeCloseTo(15_500, 6);
  });

  it('does not duplicate adopted positions when reconciliation runs again', async () => {
    attach(
      engine,
      healthyExchange({
        fetchPositions: async () => [
          {
            symbol: 'ETH/USDT',
            contracts: 5,
            side: 'long',
            entryPrice: 3_000,
            markPrice: 3_100,
            leverage: 5,
            initialMargin: 3_100,
            unrealizedPnl: 500,
          },
        ],
      })
    );

    await engine.reconcileWithExchange();
    await engine.reconcileWithExchange();
    await engine.reconcileWithExchange();

    expect(engine.getStatus().positions).toHaveLength(1);
  });

  it('allows a clean first live run when local state is absent', async () => {
    attach(engine, healthyExchange());
    await expect(engine.start()).resolves.toBeUndefined();
    expect(engine.getStatus().isRunning).toBe(true);
    expect(fs.existsSync(stateFile)).toBe(true);
  });

  it('refuses a corrupt local state file before querying the exchange', async () => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, '{"schemaVersion":1,"orders":');
    const fetchBalance = vi.fn(async () => ({ total: { USDT: 10_000 } }));
    attach(engine, { ...healthyExchange(), fetchBalance });

    await expect(engine.start()).rejects.toThrow(/local execution state is unreadable/);
    expect(fetchBalance).not.toHaveBeenCalled();
  });

  it('blocks restart when a previously open local order is absent from open orders', async () => {
    const store = new DurableLocalStateStore({ filePath: stateFile });
    store.persist([{
      id: 'local-order',
      exchangeOrderId: 'exchange-order',
      clientOrderId: 'ss-client-order',
      symbol: 'BTC/USDT',
      amount: 1,
      filled: 0,
      remaining: 1,
      status: 'open',
    }], []);
    attach(engine, healthyExchange());

    await expect(engine.start()).rejects.toThrow(/reconciliation incomplete/);
    expect(engine.getReconciliation()?.discrepancies.map((d) => d.kind))
      .toContain('order_terminal_on_exchange');
  });

  it('blocks restart when a local position is missing from exchange positions', async () => {
    const store = new DurableLocalStateStore({ filePath: stateFile });
    store.persist([], [{
      id: 'ETH/USDT',
      symbol: 'ETH/USDT',
      quantity: 2,
    }]);
    attach(engine, healthyExchange());

    await expect(engine.start()).rejects.toThrow(/reconciliation incomplete/);
    expect(engine.getReconciliation()?.discrepancies.map((d) => d.kind))
      .toContain('position_missing_on_exchange');
  });

  it('matches a restarted order by its persisted client order id', async () => {
    const store = new DurableLocalStateStore({ filePath: stateFile });
    store.persist([{
      id: 'local-order',
      exchangeOrderId: null,
      clientOrderId: 'ss-client-order',
      symbol: 'BTC/USDT',
      amount: 1,
      filled: 0,
      remaining: 1,
      status: 'open',
    }], []);
    attach(engine, healthyExchange({
      fetchOpenOrders: async () => [{
        id: 'exchange-order',
        clientOrderId: 'ss-client-order',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        filled: 0,
        status: 'open',
      }],
    }));

    await expect(engine.start()).resolves.toBeUndefined();
    expect(engine.getReconciliation()?.orders[0].knownLocally).toBe(true);
  });

  it('reloads state idempotently across repeated starts', async () => {
    const store = new DurableLocalStateStore({ filePath: stateFile });
    store.persist([], [{
      id: 'BTC/USDT',
      symbol: 'BTC/USDT',
      quantity: 1,
    }]);
    attach(engine, healthyExchange({
      fetchPositions: async () => [{
        symbol: 'BTC/USDT',
        contracts: 1,
        side: 'long',
        entryPrice: 60_000,
        markPrice: 60_100,
      }],
    }));

    await engine.start();
    engine.stop();
    await engine.start();
    expect(engine.getStatus().positions).toHaveLength(1);
  });

  it('fails closed when local state cannot be persisted', async () => {
    const store = new DurableLocalStateStore({ filePath: stateFile });
    vi.spyOn(store, 'persist').mockImplementation(() => {
      throw new Error('disk full');
    });
    engine.dispose();
    engine = new LiveTradingEngine(
      { enabled: true, testMode: false },
      { localStateStore: store }
    );
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(false);
    vi.spyOn(liveCircuitBreaker, 'isActive').mockReturnValue(false);
    attach(engine, healthyExchange());

    await expect(engine.start()).rejects.toThrow(/could not be persisted/);
    expect(engine.getStatus().isRunning).toBe(false);
  });

  it('does not require exchange reconciliation in paper/test mode', async () => {
    const paper = new LiveTradingEngine({ enabled: true, testMode: true });
    attach(paper, {});

    await expect(paper.start()).resolves.toBeUndefined();
    expect(paper.getStatus().isRunning).toBe(true);
    paper.dispose();
  });
});
