import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveTradingEngine } from '../live-trading-engine';

/**
 * Exercises the engine's order-state reconciliation loop (checkOrders ->
 * applyOrderSnapshot) against exchange snapshots that partially fill, refill,
 * repeat themselves, cancel with exposure, or fail to answer at all.
 */

interface SeededOrder {
  id: string;
  exchangeOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  requestedPrice: number;
}

function seedOpenOrder(engine: LiveTradingEngine, o: SeededOrder): void {
  const orders = (engine as unknown as { orders: Map<string, unknown> }).orders;
  orders.set(o.id, {
    ...o,
    type: 'market',
    status: 'open',
    filled: 0,
    remaining: o.amount,
    cost: 0,
    timestamp: Date.now(),
  });
}

function getOrder(engine: LiveTradingEngine, id: string): any {
  return (engine as unknown as { orders: Map<string, any> }).orders.get(id);
}

async function poll(engine: LiveTradingEngine): Promise<void> {
  await (engine as unknown as { checkOrders(): Promise<void> }).checkOrders();
}

function attach(engine: LiveTradingEngine, fetchOrder: (...args: any[]) => any): void {
  (engine as unknown as { exchange: unknown }).exchange = { fetchOrder };
}

describe('live order accounting', () => {
  let engine: LiveTradingEngine;

  beforeEach(() => {
    engine = new LiveTradingEngine({ enabled: true, testMode: true });
    seedOpenOrder(engine, {
      id: 'o1',
      exchangeOrderId: 'x1',
      symbol: 'BTC/USDT',
      side: 'buy',
      amount: 1,
      requestedPrice: 60_000,
    });
  });

  afterEach(() => {
    engine.dispose();
    vi.restoreAllMocks();
  });

  it('accumulates partial fills that arrive while the order stays open', async () => {
    let trades = [{ id: 'f1', amount: 0.4, price: 60_100, cost: 24_040 }];
    attach(engine, async () => ({ status: 'open', trades, filled: 0.4, cost: 24_040 }));

    await poll(engine);
    expect(getOrder(engine, 'o1').filled).toBe(0.4);
    expect(getOrder(engine, 'o1').outcome).toBe('partially_filled');

    trades = [...trades, { id: 'f2', amount: 0.6, price: 60_200, cost: 36_120 }];
    await poll(engine);

    const order = getOrder(engine, 'o1');
    expect(order.filled).toBe(1);
    expect(order.remaining).toBe(0);
    expect(order.avgPrice).toBeCloseTo(60_160, 6);
    expect(order.outcome).toBe('filled');
  });

  it('does not double count when the same snapshot is polled repeatedly', async () => {
    const trades = [{ id: 'f1', amount: 0.5, price: 60_000, cost: 30_000 }];
    attach(engine, async () => ({ status: 'open', trades, filled: 0.5, cost: 30_000 }));

    await poll(engine);
    await poll(engine);
    await poll(engine);

    const order = getOrder(engine, 'o1');
    expect(order.filled).toBe(0.5);
    expect(order.cost).toBe(30_000);
  });

  it('measures real slippage against the requested price', async () => {
    attach(engine, async () => ({
      status: 'closed',
      trades: [{ id: 'f1', amount: 1, price: 60_600, cost: 60_600 }],
    }));

    await poll(engine);
    // Bought 1% above the decision price.
    expect(getOrder(engine, 'o1').slippagePct).toBeCloseTo(1, 6);
  });

  it('keeps multi-currency fees separate as fills arrive', async () => {
    attach(engine, async () => ({
      status: 'closed',
      trades: [
        { id: 'f1', amount: 0.5, price: 60_000, cost: 30_000, fee: { cost: 3, currency: 'USDT' } },
        { id: 'f2', amount: 0.5, price: 60_000, cost: 30_000, fee: { cost: 0.001, currency: 'BNB' } },
      ],
    }));

    await poll(engine);
    expect(getOrder(engine, 'o1').fees).toEqual([
      { currency: 'USDT', cost: 3 },
      { currency: 'BNB', cost: 0.001 },
    ]);
  });

  it('flags a cancel that left a partial position behind', async () => {
    const canceledWithFills = vi.fn();
    engine.on('orderCanceledWithFills', canceledWithFills);
    attach(engine, async () => ({
      status: 'canceled',
      trades: [{ id: 'f1', amount: 0.3, price: 60_000, cost: 18_000 }],
    }));

    await poll(engine);

    expect(getOrder(engine, 'o1').outcome).toBe('canceled_partially_filled');
    expect(canceledWithFills).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'BTC/USDT', filled: 0.3 })
    );
  });

  it('does not raise a partial-position alert on a clean cancel', async () => {
    const canceledWithFills = vi.fn();
    engine.on('orderCanceledWithFills', canceledWithFills);
    attach(engine, async () => ({ status: 'canceled', filled: 0, cost: 0 }));

    await poll(engine);

    expect(getOrder(engine, 'o1').outcome).toBe('canceled_unfilled');
    expect(canceledWithFills).not.toHaveBeenCalled();
  });

  it('reports an unqueryable order as unknown instead of leaving it silently open', async () => {
    const unknown = vi.fn();
    engine.on('orderStateUnknown', unknown);
    attach(engine, async () => {
      throw new Error('exchange timeout');
    });

    await poll(engine);

    expect(unknown).toHaveBeenCalledWith(expect.objectContaining({ exchangeOrderId: 'x1' }));
    // Still open, so the next poll retries rather than assuming completion.
    expect(getOrder(engine, 'o1').status).toBe('open');
  });

  it('falls back to absolute snapshot values when the exchange reports no trades', async () => {
    attach(engine, async () => ({ status: 'open', filled: 0.25, average: 60_400 }));

    await poll(engine);

    const order = getOrder(engine, 'o1');
    expect(order.filled).toBe(0.25);
    expect(order.avgPrice).toBeCloseTo(60_400, 6);
    expect(order.remaining).toBeCloseTo(0.75, 12);
  });

  it('derives an average price for sub-unit quantities instead of returning cost', async () => {
    seedOpenOrder(engine, {
      id: 'o2',
      exchangeOrderId: 'x2',
      symbol: 'BTC/USDT',
      side: 'buy',
      amount: 0.01,
      requestedPrice: 60_000,
    });
    attach(engine, async (exchangeOrderId: string) =>
      exchangeOrderId === 'x2'
        ? { status: 'closed', trades: [{ id: 'g1', amount: 0.01, price: 60_000, cost: 600 }] }
        : { status: 'open', filled: 0, cost: 0 }
    );

    await poll(engine);

    expect(getOrder(engine, 'o2').avgPrice).toBe(60_000);
  });

  it('does not fabricate an average when a restart discovers additional unpriced fills', async () => {
    attach(engine, async () => ({ status: 'open', filled: 1, cost: 60_000 }));
    await poll(engine);
    expect(getOrder(engine, 'o1').avgPrice).toBe(60_000);

    attach(engine, async () => ({ status: 'open', filled: 2 }));
    await poll(engine);

    const order = getOrder(engine, 'o1');
    expect(order.filled).toBe(2);
    expect(order.cost).toBe(0);
    expect(order.avgPrice).toBeNull();
    expect(order.slippagePct).toBeNull();
  });
});
