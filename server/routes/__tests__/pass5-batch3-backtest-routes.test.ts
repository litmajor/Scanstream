import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { AuthRequest } from '../../middleware/auth';

const optimizeAllMock = vi.hoisted(() => vi.fn());
const fetchMarketDataMock = vi.hoisted(() => vi.fn());
const historicalRunMock = vi.hoisted(() => vi.fn());
const backtestSignalMock = vi.hoisted(() => vi.fn());
const backtestSignalsMock = vi.hoisted(() => vi.fn());
const getStatsMock = vi.hoisted(() => vi.fn());
const getHistoryMock = vi.hoisted(() => vi.fn());
const exportResultsMock = vi.hoisted(() => vi.fn());
const pruneOldResultsMock = vi.hoisted(() => vi.fn());

vi.mock('../../bayesian-optimizer', () => ({
  MirrorOptimizer: class {
    registerAgent() {}
    optimizeAll = optimizeAllMock;
    getOptimizationReport() {
      return { agents: {} };
    }
    getOptimizationHistory() {
      return {};
    }
  },
  ScannerAgent: {
    create: vi.fn().mockResolvedValue({}),
  },
  MLAgent: class {},
}));

vi.mock('../../trading-engine', () => ({
  ExchangeDataFeed: {
    create: vi.fn().mockResolvedValue({
      fetchMarketData: fetchMarketDataMock,
    }),
  },
}));

vi.mock('../../services/historical-backtester', () => ({
  historicalBacktester: {
    runHistoricalBacktest: historicalRunMock,
  },
}));

vi.mock('../../services/signal-backtester', () => ({
  getBacktester: vi.fn(() => ({
    backtestSignal: backtestSignalMock,
    backtestSignals: backtestSignalsMock,
    getStats: getStatsMock,
    getHistory: getHistoryMock,
    exportResults: exportResultsMock,
    pruneOldResults: pruneOldResultsMock,
  })),
}));

import optimizationRouter from '../optimization';
import signalBacktestingRouter from '../signal-backtesting';
import historicalBacktestRouter from '../historical-backtest';

async function startRouter(router: express.Router, mountPath: string): Promise<{
  server: Server;
  base: string;
}> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-test-user']) {
      (req as AuthRequest).user = { id: 'batch3-user', email: 'batch3@example.test' };
    }
    next();
  });
  app.use(mountPath, router);
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  return {
    server,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}${mountPath}`,
  };
}

async function request(
  base: string,
  route: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

function withUser(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...(init.headers ?? {}), 'x-test-user': 'batch3-user' },
  };
}

const candles = Array.from({ length: 5 }, (_, index) => ({
  timestamp: index,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 1000,
}));

const signal = {
  symbol: 'BTC/USDT',
  timestamp: 0,
  type: 'BUY',
  entryPrice: 100,
  confidence: 0.8,
  stopLoss: 98,
  takeProfit: 105,
};

describe('Pass 5 batch 3 backtest routes', () => {
  let optimizationServer: Server;
  let signalServer: Server;
  let historicalServer: Server;
  let optimizationBase: string;
  let signalBase: string;
  let historicalBase: string;

  beforeAll(async () => {
    ({ server: optimizationServer, base: optimizationBase } = await startRouter(
      optimizationRouter,
      '/api/optimize',
    ));
    ({ server: signalServer, base: signalBase } = await startRouter(
      signalBacktestingRouter,
      '/api/backtest',
    ));
    ({ server: historicalServer, base: historicalBase } = await startRouter(
      historicalBacktestRouter,
      '/api/backtest',
    ));
  });

  beforeEach(() => {
    optimizeAllMock.mockResolvedValue({ scanner: { score: 1 } });
    fetchMarketDataMock.mockResolvedValue(Array.from({ length: 100 }, () => ({})));
    historicalRunMock.mockResolvedValue({
      metrics: { sharpeRatio: 1.2, winRate: 55, maxDrawdown: 10, sortinoRatio: 1 },
      underperformingPatterns: [],
    });
    backtestSignalMock.mockReturnValue({ signal, roi: 1 });
    backtestSignalsMock.mockReturnValue([{ signal, roi: 1 }]);
    getStatsMock.mockReturnValue({ totalSignals: 1 });
    getHistoryMock.mockReturnValue([{ signal, roi: 1 }]);
    exportResultsMock.mockReturnValue('[]');
    pruneOldResultsMock.mockReturnValue(undefined);
  });

  afterAll(async () => {
    await Promise.all([
      new Promise<void>((resolve) => optimizationServer.close(() => resolve())),
      new Promise<void>((resolve) => signalServer.close(() => resolve())),
      new Promise<void>((resolve) => historicalServer.close(() => resolve())),
    ]);
  });

  it('covers optimization status and bounded authenticated execution', async () => {
    expect((await request(optimizationBase, '/status')).status).toBe(200);
    expect((await request(optimizationBase, '/strategies')).status).toBe(200);
    expect((await request(optimizationBase, '/history')).status).toBe(200);
    expect((await request(optimizationBase, '/run', {
      method: 'POST',
      body: JSON.stringify({}),
    })).status).toBe(401);
    expect((await request(optimizationBase, '/run', withUser({
      method: 'POST',
      body: JSON.stringify({ iterations: 51 }),
    }))).status).toBe(400);

    const response = await request(optimizationBase, '/run', withUser({
      method: 'POST',
      body: JSON.stringify({ iterations: 2, dataPoints: 100 }),
    }));
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(optimizeAllMock).toHaveBeenCalledTimes(1);

    optimizeAllMock.mockRejectedValueOnce(new Error('fixture optimizer failure'));
    const failed = await request(optimizationBase, '/run', withUser({
      method: 'POST',
      body: JSON.stringify({ iterations: 2, dataPoints: 100 }),
    }));
    expect(failed.status).toBe(500);
    expect(failed.body.error).toBe('fixture optimizer failure');
  });

  it('covers signal backtest auth, bounds, reads, export, prune, and failures', async () => {
    expect((await request(signalBase, '/signal', {
      method: 'POST',
      body: JSON.stringify({ signal, historicalData: candles }),
    })).status).toBe(401);

    const oversized = Array.from({ length: 5001 }, () => null);
    expect((await request(signalBase, '/signal', withUser({
      method: 'POST',
      body: JSON.stringify({ signal, historicalData: oversized }),
    }))).status).toBe(400);
    expect((await request(signalBase, '/signal', withUser({
      method: 'POST',
      body: JSON.stringify({ signal, historicalData: [null, null, null, null, null] }),
    }))).status).toBe(400);

    const single = await request(signalBase, '/signal', withUser({
      method: 'POST',
      body: JSON.stringify({ signal, historicalData: candles }),
    }));
    expect(single.status).toBe(200);
    expect(single.body.success).toBe(true);

    const batch = await request(signalBase, '/signals', withUser({
      method: 'POST',
      body: JSON.stringify({ signals: [signal], historicalData: candles }),
    }));
    expect(batch.status).toBe(200);
    expect(batch.body.success).toBe(true);

    expect((await request(signalBase, '/stats')).status).toBe(200);
    expect((await request(signalBase, '/history?limit=1001')).status).toBe(400);
    expect((await request(signalBase, '/history?limit=10')).status).toBe(200);
    expect((await request(signalBase, '/export', {
      method: 'POST',
      body: JSON.stringify({ format: 'json' }),
    })).status).toBe(200);
    expect((await request(signalBase, '/prune', withUser({
      method: 'POST',
      body: JSON.stringify({ daysToKeep: 31 }),
    }))).status).toBe(200);

    backtestSignalMock.mockImplementationOnce(() => {
      throw new Error('fixture backtester failure');
    });
    const failed = await request(signalBase, '/signal', withUser({
      method: 'POST',
      body: JSON.stringify({ signal, historicalData: candles }),
    }));
    expect(failed.status).toBe(500);
    expect(failed.body.error).toBe('fixture backtester failure');
  });

  it('covers historical summary, authenticated bounded execution, and failure handling', async () => {
    expect((await request(historicalBase, '/summary')).status).toBe(200);
    expect((await request(historicalBase, '/historical', {
      method: 'POST',
      body: JSON.stringify({ startDate: '2020-01-01', endDate: '2024-01-01' }),
    })).status).toBe(401);
    expect((await request(historicalBase, '/historical', withUser({
      method: 'POST',
      body: JSON.stringify({ startDate: '2020-01-01', endDate: '2024-01-01' }),
    }))).status).toBe(400);

    const defaultAssets = await request(historicalBase, '/historical', withUser({
      method: 'POST',
      body: JSON.stringify({
        startDate: '2024-01-01',
        endDate: '2024-06-01',
      }),
    }));
    expect(defaultAssets.status).toBe(200);
    expect(defaultAssets.body.assets).toEqual(expect.any(Array));
    expect((defaultAssets.body.assets as unknown[]).length).toBeLessThanOrEqual(20);
    expect(historicalRunMock).toHaveBeenCalledWith(expect.objectContaining({
      assets: defaultAssets.body.assets,
    }));

    const response = await request(historicalBase, '/historical', withUser({
      method: 'POST',
      body: JSON.stringify({
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        assets: ['BTC/USDT'],
      }),
    }));
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    historicalRunMock.mockRejectedValueOnce(new Error('fixture historical failure'));
    const failed = await request(historicalBase, '/historical', withUser({
      method: 'POST',
      body: JSON.stringify({
        startDate: '2024-01-01',
        endDate: '2024-06-01',
        assets: ['BTC/USDT'],
      }),
    }));
    expect(failed.status).toBe(500);
    expect(failed.body.error).toBe('fixture historical failure');
  });
});
