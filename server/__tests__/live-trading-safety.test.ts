import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveTradingEngine } from '../live-trading-engine';
import { systemKillSwitch } from '../services/system-kill-switch';
import { liveCircuitBreaker } from '../services/live-circuit-breaker';
import { durabilityGate } from '../services/execution/durability-gate';

interface FakePosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  marginUsed: number;
}

function seedPosition(engine: LiveTradingEngine, pos: FakePosition): void {
  const positions = (engine as unknown as { positions: Map<string, unknown> }).positions;
  positions.set(pos.id, {
    ...pos,
    entryPrice: 100,
    currentPrice: 100,
    leverage: 1,
    pnl: 0,
    pnlPercent: 0,
    openTime: Date.now(),
    orders: [],
  });
}

function attachExchange(engine: LiveTradingEngine, exchange: unknown): void {
  (engine as unknown as { exchange: unknown }).exchange = exchange;
}

function positionCount(engine: LiveTradingEngine): number {
  return (engine as unknown as { positions: Map<string, unknown> }).positions.size;
}

describe('live trading engine safety controls', () => {
  let engine: LiveTradingEngine;

  beforeEach(() => {
    engine = new LiveTradingEngine({ enabled: true, testMode: true });
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(false);
    vi.spyOn(liveCircuitBreaker, 'isActive').mockReturnValue(false);
  });

  afterEach(() => {
    engine.dispose();
    vi.restoreAllMocks();
  });

  it('refuses to start while the kill switch is active', async () => {
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(true);
    vi.spyOn(systemKillSwitch, 'getState').mockReturnValue({ killed: true, reason: 'drawdown' });

    const refused = vi.fn();
    engine.on('startRefused', refused);

    await expect(engine.start()).rejects.toThrow(/kill-switch active/);
    expect(refused).toHaveBeenCalledOnce();
  });

  it('refuses to resume while the kill switch is active', async () => {
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(true);
    vi.spyOn(systemKillSwitch, 'getState').mockReturnValue({ killed: true, reason: 'manual' });
    await expect(engine.resume()).resolves.toBe(false);
  });

  it('refuses to resume while the circuit breaker is active', async () => {
    vi.spyOn(liveCircuitBreaker, 'isActive').mockReturnValue(true);
    vi.spyOn(liveCircuitBreaker, 'getState').mockReturnValue({ active: true, reason: 'loss_streak' });
    await expect(engine.resume()).resolves.toBe(false);
  });

  it('does not re-enable trading when the circuit breaker clears', () => {
    engine.dispose();
    liveCircuitBreaker.emit('cleared', { prev: { active: true }, now: { active: false } });
    expect(engine.getStatus().config.enabled).toBe(false);
  });

  it('blocks execution through the hard limit gate when the kill switch is active', async () => {
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(true);
    vi.spyOn(systemKillSwitch, 'getState').mockReturnValue({ killed: true, reason: 'manual' });

    const createOrder = vi.fn();
    attachExchange(engine, { createOrder });

    const blocked = vi.fn();
    engine.on('executionBlocked', blocked);

    const order = await engine.executeSignal({
      id: 'sig-1',
      symbol: 'BTC/USDT',
      type: 'BUY',
      price: 67_000,
      confidence: 0.9,
      timestamp: Date.now(),
    } as never);

    expect(order).toBeNull();
    expect(createOrder).not.toHaveBeenCalled();
    expect(blocked).toHaveBeenCalled();
  });

  it('refuses to execute while a flatten-all sweep is running', async () => {
    (engine as unknown as { flattening: boolean }).flattening = true;
    const createOrder = vi.fn();
    attachExchange(engine, { createOrder });

    const order = await engine.executeSignal({
      id: 'sig-2',
      symbol: 'BTC/USDT',
      type: 'BUY',
      price: 67_000,
      confidence: 0.9,
      timestamp: Date.now(),
    } as never);

    expect(order).toBeNull();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('refuses to execute when no exchange has been initialized', async () => {
    const order = await engine.executeSignal({
      id: 'sig-3',
      symbol: 'BTC/USDT',
      type: 'BUY',
      price: 67_000,
      confidence: 0.9,
      timestamp: Date.now(),
    } as never);
    expect(order).toBeNull();
  });
});

describe('flattenAll', () => {
  let engine: LiveTradingEngine;

  beforeEach(() => {
    engine = new LiveTradingEngine({ enabled: true, testMode: true });
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(false);
    vi.spyOn(liveCircuitBreaker, 'isActive').mockReturnValue(false);
  });

  afterEach(() => {
    engine.dispose();
    vi.restoreAllMocks();
  });

  it('closes every position across multiple symbols and disables the engine', async () => {
    const createOrder = vi.fn(async () => ({ id: 'x' }));
    attachExchange(engine, { createOrder, fetchPositions: async () => [] });
    seedPosition(engine, { id: 'p1', symbol: 'BTC/USDT', side: 'long', quantity: 0.5, marginUsed: 500 });
    seedPosition(engine, { id: 'p2', symbol: 'ETH/USDT', side: 'short', quantity: 3, marginUsed: 300 });

    const result = await engine.flattenAll('test');

    expect(result.requested).toBe(2);
    expect(result.closed.sort()).toEqual(['p1', 'p2']);
    expect(result.failed).toEqual([]);
    expect(createOrder).toHaveBeenCalledTimes(2);
    expect(engine.getStatus().config.enabled).toBe(false);
    expect(positionCount(engine)).toBe(0);
  });

  it('isolates a failing close and reports the remaining exposure', async () => {
    const createOrder = vi.fn(async (symbol: string) => {
      if (symbol === 'ETH/USDT') throw new Error('exchange rejected');
      return { id: 'x' };
    });
    attachExchange(engine, { createOrder, fetchPositions: async () => [] });
    seedPosition(engine, { id: 'p1', symbol: 'BTC/USDT', side: 'long', quantity: 0.5, marginUsed: 500 });
    seedPosition(engine, { id: 'p2', symbol: 'ETH/USDT', side: 'short', quantity: 3, marginUsed: 300 });

    const incomplete = vi.fn();
    engine.on('flattenAllIncomplete', incomplete);

    const result = await engine.flattenAll('test');

    expect(result.closed).toEqual(['p1']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].symbol).toBe('ETH/USDT');
    expect(incomplete).toHaveBeenCalledOnce();
    // The unclosed position must remain visible rather than being forgotten.
    expect(positionCount(engine)).toBe(1);
  });

  it('is a no-op when already flat', async () => {
    const createOrder = vi.fn();
    attachExchange(engine, { createOrder, fetchPositions: async () => [] });

    const result = await engine.flattenAll('test');

    expect(result).toMatchObject({ requested: 0, closed: [], failed: [] });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('joins concurrent requests into one sweep instead of double-closing', async () => {
    let closes = 0;
    const createOrder = vi.fn(async () => {
      closes += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { id: 'x' };
    });
    attachExchange(engine, { createOrder, fetchPositions: async () => [] });
    seedPosition(engine, { id: 'p1', symbol: 'BTC/USDT', side: 'long', quantity: 0.5, marginUsed: 500 });

    const [a, b, c] = await Promise.all([
      engine.flattenAll('first'),
      engine.flattenAll('second'),
      engine.flattenAll('third'),
    ]);

    expect(closes).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.reason).toBe('first');
  });

  it('still sweeps the local view when the exchange refresh fails', async () => {
    const createOrder = vi.fn(async () => ({ id: 'x' }));
    attachExchange(engine, {
      createOrder,
      fetchPositions: async () => {
        throw new Error('exchange down');
      },
    });
    seedPosition(engine, { id: 'p1', symbol: 'BTC/USDT', side: 'long', quantity: 0.5, marginUsed: 500 });

    const result = await engine.flattenAll('outage');
    expect(result.closed).toEqual(['p1']);
  });
});

describe('live trading requires durable persistence', () => {
  const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
  let engine: LiveTradingEngine;

  function liveSignal(id: string) {
    return {
      id,
      symbol: 'BTC/USDT',
      type: 'BUY',
      price: 67_000,
      confidence: 0.95,
      timestamp: Date.now(),
    } as never;
  }

  beforeEach(() => {
    durabilityGate.reset();
    delete process.env.DATABASE_URL;
    // testMode false = real capital, so durable persistence is mandatory.
    engine = new LiveTradingEngine({ enabled: true, testMode: false });
    vi.spyOn(systemKillSwitch, 'isKilled').mockReturnValue(false);
    vi.spyOn(liveCircuitBreaker, 'isActive').mockReturnValue(false);
  });

  afterEach(() => {
    engine.dispose();
    durabilityGate.reset();
    if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    vi.restoreAllMocks();
  });

  it('refuses to start live trading when storage is not durable', async () => {
    const refused = vi.fn();
    engine.on('startRefused', refused);

    await expect(engine.start()).rejects.toThrow(/durable persistence unavailable/);
    expect(refused).toHaveBeenCalledOnce();
    expect(engine.getStatus().isRunning).toBe(false);
  });

  it('refuses to place a live order when storage is not durable', async () => {
    const createOrder = vi.fn();
    attachExchange(engine, { createOrder });
    const blocked = vi.fn();
    engine.on('executionBlocked', blocked);

    const order = await engine.executeSignal(liveSignal('sig-durability'));

    expect(order).toBeNull();
    expect(createOrder).not.toHaveBeenCalled();
    expect(blocked).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'durability', reason: 'durable_state_unavailable' })
    );
  });

  it('blocks live execution when the database is lost after a healthy start', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pw@localhost:5432/scanstream';
    let healthy = true;
    durabilityGate.setProbe(async () => healthy);
    attachExchange(engine, { createOrder: vi.fn(), loadMarkets: vi.fn() });

    expect((await durabilityGate.check()).durable).toBe(true);

    healthy = false;
    durabilityGate.invalidate('write failed');

    const order = await engine.executeSignal(liveSignal('sig-lost-db'));
    expect(order).toBeNull();
  });

  it('resume awaits startup and reports the actual startup result', async () => {
    const refused = vi.fn();
    engine.on('startRefused', refused);

    await expect(engine.resume()).resolves.toBe(false);
    expect(refused).toHaveBeenCalled();
    expect(engine.getStatus().isRunning).toBe(false);
  });

  it('allows paper/test mode to run without durable storage', async () => {
    const paper = new LiveTradingEngine({ enabled: true, testMode: true });
    attachExchange(paper, { createOrder: vi.fn(), loadMarkets: vi.fn() });

    await expect(paper.start()).resolves.toBeUndefined();
    expect(paper.getStatus().isRunning).toBe(true);
    paper.dispose();
  });
});
