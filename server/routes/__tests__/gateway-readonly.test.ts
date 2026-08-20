import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createGatewayReadonlyRouter, createGatewayStatusRouter } from '../gateway-readonly';

const candles = [
  [1, 100, 105, 95, 102, 10],
  [2, 102, 108, 99, 106, 12],
] as const;

function startRouter(dependencies: Parameters<typeof createGatewayReadonlyRouter>[0]) {
  const app = express();
  app.use('/api/gateway', createGatewayReadonlyRouter(dependencies));
  return new Promise<{ server: Server; base: string }>((resolve) => {
    const server = app.listen(0, () => resolve({
      server,
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/gateway`,
    }));
  });
}

async function request(
  base: string,
  route: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${route}`);
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

describe('gateway read-only compatibility routes', () => {
  let server: Server;
  let base: string;

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeAll(async () => {
    ({ server, base } = await startRouter({
      tickerCache: {
        get: (symbol) => symbol === 'BTC/USDT'
          ? {
            symbol,
            price: 106,
            timestamp: 2,
            exchange: 'test',
          }
          : null,
        getCandles: (symbol) => symbol === 'BTC/USDT'
          ? candles.map((candle) => [...candle])
          : [],
      },
      performanceTracker: {
        getPerformanceStats: () => ({
          totalSignals: 2,
          activeSignals: 1,
          winRate: 50,
        }),
        getRecentPerformance: (limit) => Array.from({ length: limit }, (_, index) => ({
          signalId: `signal-${index}`,
          symbol: 'BTC/USDT',
          status: 'active',
        })),
      },
    }));
  });

  it('serves bounded dataframe and price shapes for both symbol path forms', async () => {
    const dataframe = await request(base, '/dataframe/BTC%2FUSDT?timeframe=1h&limit=2');
    expect(dataframe.status).toBe(200);
    expect(dataframe.body.dataframe).toMatchObject({
      symbol: 'BTC/USDT',
      timeframe: '1h',
      close: 106,
    });

    const pairDataframe = await request(base, '/dataframe/BTC/USDT?timeframe=1h&limit=2');
    expect(pairDataframe.status).toBe(200);
    expect(pairDataframe.body.dataframe).toMatchObject({ symbol: 'BTC/USDT' });

    const price = await request(base, '/price/BTC/USDT');
    expect(price.status).toBe(200);
    expect(price.body).toMatchObject({
      symbol: 'BTC/USDT',
      price: 106,
      priceChange: 4,
    });
  });

  it('rejects malformed or over-limit read inputs without external work', async () => {
    for (const route of [
      '/dataframe/BTC%2FUSDT?timeframe=3h',
      '/dataframe/BTC%2FUSDT?limit=501',
      `/dataframe/${'x'.repeat(65)}?timeframe=1h`,
      '/price/not a symbol',
      '/signals/performance/recent?limit=101',
    ]) {
      expect((await request(base, route)).status).toBe(400);
    }

    expect((await request(base, '/dataframe/ETH%2FUSDT?timeframe=1h')).status).toBe(404);
  });

  it('preserves performance and exchange-status response contracts', async () => {
    const stats = await request(base, '/signals/performance/stats');
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ totalSignals: 2, activeSignals: 1 });

    const recent = await request(base, '/signals/performance/recent?limit=2');
    expect(recent.status).toBe(200);
    expect(recent.body).toEqual([
      { signalId: 'signal-0', symbol: 'BTC/USDT', status: 'active' },
      { signalId: 'signal-1', symbol: 'BTC/USDT', status: 'active' },
    ]);

    const statusApp = express();
    statusApp.use('/api/exchange', createGatewayStatusRouter({
      tickerCache: {
        get: () => ({ symbol: 'BTC/USDT', price: 106, timestamp: 2 }),
        getCandles: () => [],
      },
      performanceTracker: {
        getPerformanceStats: () => ({}),
        getRecentPerformance: () => [],
      },
    }));
    const statusServer = await new Promise<Server>((resolve) => {
      const started = statusApp.listen(0, () => resolve(started));
    });
    const statusBase = `http://127.0.0.1:${(statusServer.address() as AddressInfo).port}/api/exchange`;
    const status = await request(statusBase, '/status');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      exchange: 'aggregated',
      status: 'online',
      isOperational: true,
      latency: 0,
    });
    await new Promise<void>((resolve) => statusServer.close(() => resolve()));
  });

  it('converts underlying read failures to generic handled errors', async () => {
    const failing = await startRouter({
      tickerCache: {
        get: () => {
          throw new Error('secret provider failure');
        },
        getCandles: () => {
          throw new Error('secret candle failure');
        },
      },
      performanceTracker: {
        getPerformanceStats: () => {
          throw new Error('secret stats failure');
        },
        getRecentPerformance: vi.fn(),
      },
    });

    try {
      const response = await request(failing.base, '/price/BTC%2FUSDT');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Gateway read failed' });
      const stats = await request(failing.base, '/signals/performance/stats');
      expect(stats.status).toBe(500);
      expect(stats.body).toEqual({ error: 'Gateway read failed' });
    } finally {
      await new Promise<void>((resolve) => failing.server.close(() => resolve()));
    }
  });
});
