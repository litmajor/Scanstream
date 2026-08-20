import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createStrategiesCompatRouter } from '../strategies-compat';
import { TradeDurationPredictor } from '../../services/clustering/trade-duration-predictor';

function startRouter(
  authenticated: boolean,
  overrides: Partial<Parameters<typeof createStrategiesCompatRouter>[0]> = {},
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (authenticated) {
      Object.assign(req, {
        user: { id: 'test-user', email: 'test@example.com' },
      });
    }
    next();
  });
  app.use('/api/strategies', createStrategiesCompatRouter({
    getSignals: async () => [],
    getBacktestResults: async () => [],
    runBacktest: async () => ({ totalReturn: 1 }),
    runConsensus: async () => ({ signal: 'HOLD' }),
    getEnabledStrategies: () => [],
    getTradeDurationPredictor: () => null,
    getPyramidStrategy: () => null,
    ...overrides,
  }));
  return new Promise<{ server: Server; base: string }>((resolve) => {
    const server = app.listen(0, () => resolve({
      server,
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/strategies`,
    }));
  });
}

async function request(
  base: string,
  route: string,
  init?: RequestInit,
) {
  const response = await fetch(`${base}${route}`, init);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function close(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

afterEach(() => vi.restoreAllMocks());

describe('strategies compatibility routes', () => {
  it('restores bounded read contracts and resolves static paths before ids', async () => {
    const started = await startRouter(false, {
      getTradeDurationPredictor: () => new TradeDurationPredictor(),
      getSignals: async () => [{
        id: 'signal-1',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        symbol: 'BTC/USDT',
        type: 'BUY',
        classifications: [],
        strength: 80,
        confidence: 0.8,
        price: 100,
        reasoning: ['test'],
        riskReward: 2,
        stopLoss: 95,
        takeProfit: 110,
        momentumLabel: null,
        regimeState: 'TRENDING',
        legacyLabel: null,
        signalStrengthScore: null,
        patternDetails: null,
        timeframeAlignment: null,
        agreementScore: 50,
        positionSize: 0.5,
      }],
    });
    try {
      const listed = await request(started.base, '/');
      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({ success: true, total: 6 });

      const signals = await request(started.base, '/signals');
      expect(signals.status).toBe(200);
      expect(signals.body).toMatchObject({ success: true });
      expect(signals.body.signals).toHaveLength(1);

      const results = await request(started.base, '/backtest/results');
      expect(results.status).toBe(200);
      expect(results.body).toEqual({ results: [] });

      const feature = await request(started.base, '/feature-enabled');
      expect(feature.status).toBe(200);

      const comparison = await request(started.base, '/compare-durations');
      expect(comparison.status).toBe(200);
      expect(comparison.body).toMatchObject({ success: true });

      const strategy = await request(started.base, '/gradient_trend_filter');
      expect(strategy.status).toBe(200);
      expect(strategy.body).toMatchObject({ success: true });
    } finally {
      await close(started.server);
    }
  });

  it('requires authentication for analysis and bounds the backtest inputs', async () => {
    const unauthenticated = await startRouter(false);
    try {
      const response = await request(unauthenticated.base, '/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'BTC/USDT', timeframes: ['H1'] }),
      });
      expect(response.status).toBe(401);
    } finally {
      await close(unauthenticated.server);
    }

    const runBacktest = vi.fn(async () => ({ trades: [], totalReturn: 3 }));
    const authenticated = await startRouter(true, { runBacktest });
    try {
      const invalidRange = await request(authenticated.base, '/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'gradient_trend_filter',
          symbol: 'BTC/USDT',
          timeframe: '1h',
          startDate: '2020-01-01',
          endDate: '2023-01-01',
        }),
      });
      expect(invalidRange.status).toBe(400);
      expect(runBacktest).not.toHaveBeenCalled();

      const success = await request(authenticated.base, '/bounce/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USDT',
          timeframe: '1h',
          startDate: '2024-01-01',
          endDate: '2024-01-10',
        }),
      });
      expect(success.status).toBe(200);
      expect(success.body).toMatchObject({
        success: true,
        backtest: { strategyId: 'enhanced_bounce', symbol: 'BTC/USDT' },
      });
      expect(runBacktest).toHaveBeenCalledTimes(1);
    } finally {
      await close(authenticated.server);
    }
  });

  it('validates consensus inputs and handles bounded engine failures generically', async () => {
    const runConsensus = vi.fn(async () => {
      throw new Error('provider secret');
    });
    const started = await startRouter(true, { runConsensus });
    try {
      const malformed = await request(started.base, '/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC/USDT',
          timeframes: ['H1', 'H4', 'D1', 'M15', '1m'],
          equity: 10000,
        }),
      });
      expect(malformed.status).toBe(400);
      expect(runConsensus).not.toHaveBeenCalled();

      const failed = await request(started.base, '/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'BTC/USDT', timeframes: ['H1'] }),
      });
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual({ error: 'Strategy request failed' });
    } finally {
      await close(started.server);
    }
  });
});
