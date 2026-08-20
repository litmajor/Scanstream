import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LiveTradingEngine } from '../live-trading-engine';
import { durabilityGate } from '../services/execution/durability-gate';
import { FundingAccounting } from '../services/execution/funding-accounting';
import { getConfidenceScorer } from '../services/market-data/confidence-scorer';
import { getModeDetector } from '../services/market-data/mode-detector';
import { TruthEngine } from '../services/aggregator/truth-engine';
import { getSharedService, setSharedService } from '../services/shared-service-registry';

const FIXTURE = {
  symbol: 'BTC/USDT',
  candle: { timestamp: 1_700_000_000_000, open: 100, high: 102, low: 99, close: 101, volume: 10 },
  ticker: { timestamp: 1_700_000_000_000, last: 101 },
  signal: {
    id: 'fixture-signal-1',
    symbol: 'BTC/USDT',
    type: 'BUY',
    price: 101,
    confidence: 0.95,
    timestamp: 1_700_000_000_000,
  },
};

function fixtureSignal() {
  return { ...FIXTURE.signal, timestamp: Date.now() };
}

function setLiveMode(): void {
  const modeDetector = getModeDetector();
  modeDetector.reset();
  modeDetector.setBackfillComplete(true);
  modeDetector.recordTick('ws');
  modeDetector.recordEmitLag(100);
  modeDetector.recordTick('ws');
  modeDetector.recordEmitLag(100);
  modeDetector.recordTick('ws');
  modeDetector.recordEmitLag(100);
}

function statePath(prefix: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), 'state.json');
}

function fakeExchange(createOrder: (...args: any[]) => Promise<any>) {
  return {
    id: 'fixture-venue',
    has: { fetchFundingHistory: true },
    markets: { [FIXTURE.symbol]: { type: 'spot', spot: true } },
    symbols: [FIXTURE.symbol],
    fetchBalance: async () => ({ total: { USDT: 10_000 } }),
    fetchTicker: async () => FIXTURE.ticker,
    fetchPositions: async () => [],
    fetchOpenOrders: async () => [],
    createOrder,
  };
}

function prepareEngine(testMode: boolean, createOrder: (...args: any[]) => Promise<any>): LiveTradingEngine {
  const engine = new LiveTradingEngine(
    { enabled: true, testMode },
    {
      localStatePath: statePath('scanstream-parity-local-'),
      realizedPnlLedgerPath: statePath('scanstream-parity-pnl-'),
      fundingAccountingPath: statePath('scanstream-parity-funding-'),
    },
  );
  // The engine has no public exchange injection seam; this is the only cast in
  // the harness, and it replaces the venue adapter without bypassing engine
  // startup, durable loaders, reconciliation or funding accounting.
  (engine as unknown as { exchange: unknown }).exchange = fakeExchange(createOrder);
  return engine;
}

function freshTruthEngine(symbol: string): TruthEngine {
  const gate = new EventEmitter();
  const sources = Object.fromEntries(
    ['venue-a', 'venue-b', 'venue-c', 'venue-d', 'venue-e'].map((venue) => [
      venue,
      { close: 101, ts: Date.now(), volume: 1 },
    ]),
  );
  const aggregator = {
    getPerExchange: () => sources,
    getAggregated: () => ({ venueHealthScores: {} }),
  };
  const truth = new TruthEngine(gate, aggregator as any);
  gate.emit('world.tick', { symbol });
  return truth;
}

function normalizeIntent(call: any[]): Record<string, unknown> {
  const [, type, side, amount, price, params] = call;
  return {
    type,
    side,
    amount,
    price: price ?? null,
    reduceOnly: params?.reduceOnly ?? null,
    clientOrderIdPresent: typeof params?.clientOrderId === 'string' &&
      params.clientOrderId.length > 0,
    clientOrderIdShape: typeof params?.clientOrderId === 'string'
      ? params.clientOrderId.replace(/[a-z0-9]/gi, 'x')
      : null,
  };
}

describe('Pass 4C paper/live parity fixtures', () => {
  afterEach(() => {
    durabilityGate.reset();
    vi.restoreAllMocks();
  });

  it('matches paper and live decision paths and order intents for the committed fixture', async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ??
      'postgresql://scanstream:scanstream_dev_password@localhost:5432/scanstream?schema=public';
    durabilityGate.setProbe(async () => true);
    setLiveMode();
    const previousTruth = getSharedService('truthEngine');
    setSharedService('truthEngine', freshTruthEngine(FIXTURE.symbol));
    const durabilityObservations: Array<{ testMode: boolean; durable: boolean; detail?: string }> = [];
    const gateSequences: Record<'paper' | 'live', string[]> = { paper: [], live: [] };
    const originalRequireForLive = durabilityGate.requireForLive.bind(durabilityGate);
    vi.spyOn(durabilityGate, 'requireForLive').mockImplementation(async (testMode) => {
      const result = await originalRequireForLive(testMode);
      durabilityObservations.push({ testMode, durable: result.durable, detail: result.detail });
      gateSequences[testMode ? 'paper' : 'live'].push('durability');
      return result;
    });
    const fundingObservations: Array<{ symbol: string; status: string; reason?: string }> = [];
    const originalFundingReconcile = FundingAccounting.prototype.reconcile;
    vi.spyOn(FundingAccounting.prototype, 'reconcile').mockImplementation(async function (exchange, symbol) {
      const result = await originalFundingReconcile.call(this, exchange, symbol);
      fundingObservations.push({ symbol, status: result.status, reason: 'reason' in result ? result.reason : undefined });
      gateSequences.live.push('funding');
      return result;
    });
    const hardLimitObservations: Record<'paper' | 'live', any[]> = { paper: [], live: [] };
    const observeHardLimits = (engine: LiveTradingEngine, mode: 'paper' | 'live') => {
      const original = engine.checkHardLimits.bind(engine);
      vi.spyOn(engine, 'checkHardLimits').mockImplementation((...args) => {
        const result = original(...args);
        gateSequences[mode].push('hard_limit');
        hardLimitObservations[mode].push(result);
        return result;
      });
    };

    const paperCalls: any[] = [];
    const liveCalls: any[] = [];
    const response = async (calls: any[], ...args: any[]) => {
      calls.push(args);
      const amount = args[3];
      return {
        id: 'fixture-order',
        status: 'closed',
        filled: amount,
        remaining: 0,
        price: FIXTURE.signal.price,
        average: FIXTURE.signal.price,
        cost: amount * FIXTURE.signal.price,
        timestamp: FIXTURE.ticker.timestamp,
        trades: [{ id: 'fixture-fill', amount, price: FIXTURE.signal.price, cost: amount * FIXTURE.signal.price }],
      };
    };
    const paper = prepareEngine(true, (...args) => response(paperCalls, ...args));
    const live = prepareEngine(false, (...args) => response(liveCalls, ...args));
    const paperShadow = vi.spyOn((paper as any).slippageModel, 'applySlippage');
    const liveShadow = vi.spyOn((live as any).slippageModel, 'applySlippage');
    observeHardLimits(paper, 'paper');
    observeHardLimits(live, 'live');

    const signal = fixtureSignal();
    const blocked: Record<'paper' | 'live', any[]> = { paper: [], live: [] };
    paper.on('executionBlocked', (event) => blocked.paper.push({ type: event.type, reason: event.reason }));
    live.on('executionBlocked', (event) => blocked.live.push({ type: event.type, reason: event.reason }));
    try {
      await paper.start();
      await live.start();
      gateSequences.paper.length = 0;
      gateSequences.live.length = 0;
      hardLimitObservations.paper.length = 0;
      hardLimitObservations.live.length = 0;

      const [paperOrder, liveOrder] = await Promise.all([
        paper.executeSignal({ ...signal } as any),
        live.executeSignal({ ...signal } as any),
      ]);

      expect(paperOrder).not.toBeNull();
      expect(liveOrder).not.toBeNull();
      expect(blocked.paper).toEqual([]);
      expect(blocked.live).toEqual([]);
      expect(hardLimitObservations.paper).toEqual(hardLimitObservations.live);
      expect(gateSequences.paper).toEqual(['durability', 'hard_limit', 'hard_limit']);
      expect(gateSequences.live).toEqual(['durability', 'funding', 'hard_limit', 'hard_limit']);
      expect(normalizeIntent(paperCalls[0])).toEqual(normalizeIntent(liveCalls[0]));
      expect(paperOrder?.symbol).toBe(liveOrder?.symbol);
      expect(paperOrder?.side).toBe(liveOrder?.side);
      expect(paperOrder?.amount).toBe(liveOrder?.amount);
      expect(paperOrder?.type).toBe(liveOrder?.type);
      expect(durabilityObservations).toEqual(expect.arrayContaining([
        expect.objectContaining({ testMode: true, durable: true, detail: 'test/paper mode' }),
        expect.objectContaining({ testMode: false, durable: true }),
      ]));
      expect(fundingObservations).toEqual([
        expect.objectContaining({ symbol: FIXTURE.symbol, status: 'not_required' }),
      ]);
      // The paper path invokes the same fake venue and then applies its
      // shadow-fidelity fill adjustment; it is not an internal no-order path.
      expect(paperCalls).toHaveLength(1);
      expect(liveCalls).toHaveLength(1);
      expect(paperShadow).toHaveBeenCalled();
      expect(liveShadow).not.toHaveBeenCalled();
    } finally {
      paper.dispose();
      live.dispose();
      setSharedService('truthEngine', previousTruth);
    }
  });

  it('uses the mode detector honestly for replay fixtures', async () => {
    const modeDetector = getModeDetector();
    modeDetector.reset();
    modeDetector.recordTick('rest');
    modeDetector.recordEmitLag(120_000);
    expect(modeDetector.detectMode()).toBe('REPLAY');
    const previousTruth = getSharedService('truthEngine');
    setSharedService('truthEngine', freshTruthEngine(FIXTURE.symbol));
    const createOrder = vi.fn(async () => ({ id: 'replay-order' }));
    const paper = prepareEngine(true, createOrder);
    const blocked: any[] = [];
    paper.on('executionBlocked', (event) => blocked.push(event));
    try {
      const score = getConfidenceScorer().scoreWithCurrentMode(FIXTURE.signal.confidence, 'fixture-replay');
      expect(score.mode).toBe('REPLAY');
      expect(score.canTrade).toBe(false);
      expect(score.reason).toContain('REPLAY mode');
      await expect(paper.executeSignal(fixtureSignal() as any)).resolves.toBeNull();
      expect(createOrder).not.toHaveBeenCalled();
      expect(blocked).toEqual([expect.objectContaining({
        type: 'confidence',
        reason: 'confidence_scorer_refused',
        detail: expect.stringContaining('REPLAY mode'),
      })]);
    } finally {
      paper.dispose();
      setSharedService('truthEngine', previousTruth);
    }
  });
});

describe('Pass 4C failure injection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('joins concurrent flatten sweeps and retains an ambiguous failure', async () => {
    const engine = new LiveTradingEngine({ enabled: true, testMode: true });
    const positions = (engine as any).positions as Map<string, any>;
    positions.set('BTC/USDT', {
      id: 'BTC/USDT', symbol: 'BTC/USDT', side: 'long', quantity: 1,
      entryPrice: 100, currentPrice: 100, leverage: 1, pnl: 0, pnlPercent: 0,
      openTime: Date.now(), orders: [],
    });
    let closes = 0;
    (engine as any).exchange = {
      fetchPositions: async () => [],
      createOrder: async () => {
        closes += 1;
        throw new Error('request timeout');
      },
    };
    const [first, second] = await Promise.all([
      engine.flattenAll('first'),
      engine.flattenAll('second'),
    ]);
    expect(first).toBe(second);
    expect(closes).toBe(1);
    expect(first.failed).toHaveLength(1);
    expect(positions.has('BTC/USDT')).toBe(true);
    engine.dispose();
  });

  it('does not place an in-flight order after the operator stop', async () => {
    setLiveMode();
    process.env.DATABASE_URL = process.env.DATABASE_URL ??
      'postgresql://scanstream:scanstream_dev_password@localhost:5432/scanstream?schema=public';
    durabilityGate.setProbe(async () => true);
    let started!: () => void;
    const startedSignal = new Promise<void>((resolve) => { started = resolve; });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const createOrder = vi.fn(async (..._args: any[]) => {
      started();
      await gate;
      return { id: 'stop-order', status: 'closed', filled: 1, price: 101, cost: 101 };
    });
    const engine = prepareEngine(false, createOrder);
    try {
      await engine.start();
      const execution = engine.executeSignal({ ...fixtureSignal(), id: 'stop-signal' } as any);
      await startedSignal;
      engine.stop();
      release();
      const order = await execution;
      expect(createOrder).toHaveBeenCalledOnce();
      expect(order).not.toBeNull();
      expect((engine as any).orders.size).toBe(1);
      expect(engine.getStatus().config.enabled).toBe(false);
      const stateFile = (engine as any).localStateStore.getPath();
      expect(fs.existsSync(stateFile)).toBe(true);

      const persistedState = fs.readFileSync(stateFile, 'utf8');
      fs.writeFileSync(stateFile, '{corrupt', 'utf8');
      await expect(engine.resume()).resolves.toBe(false);
      expect(engine.getStatus().isRunning).toBe(false);

      fs.writeFileSync(stateFile, persistedState, 'utf8');
      await expect(engine.resume()).resolves.toBe(true);
      expect(engine.getStatus().isRunning).toBe(true);
    } finally {
      engine.dispose();
    }
  });

  it('refuses stale TruthEngine consensus at a capital-adjacent gate', async () => {
    const truth = getSharedService('truthEngine');
    const actualTruth = freshTruthEngine(FIXTURE.symbol);
    // Use the real TruthEngine store and gate; only the consensus timestamp is
    // aged here to inject the stale condition without replacing isTradeable.
    const consensus = actualTruth.getConsensus(FIXTURE.symbol);
    if (!consensus) {
      throw new Error('fixture TruthEngine did not produce consensus');
    }
    consensus.timestamp = Date.now() - 120_000;
    setSharedService('truthEngine', actualTruth);
    const createOrder = vi.fn(async () => ({ id: 'stale-order' }));
    const engine = prepareEngine(true, createOrder);
    setLiveMode();
    const blocked = vi.fn();
    engine.on('executionBlocked', blocked);
    try {
      expect(actualTruth.isTradeable(FIXTURE.symbol, { maxAgeMs: 1_000 })).toEqual({
        ok: false,
        reason: expect.stringMatching(/^stale:/),
      });
      await engine.executeSignal({ ...fixtureSignal(), id: 'stale-signal' } as any);
      expect(createOrder).not.toHaveBeenCalled();
      expect(blocked).toHaveBeenCalledWith(expect.objectContaining({
        type: 'truth',
        reason: expect.stringMatching(/^stale:/),
      }));
    } finally {
      setSharedService('truthEngine', truth);
      engine.dispose();
    }
  });
});
