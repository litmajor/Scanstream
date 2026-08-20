import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const getMarketFramesMock = vi.hoisted(() => vi.fn());

vi.mock('../storage', () => ({
  storage: {
    getMarketFrames: getMarketFramesMock,
  },
}));

import {
  CHART_IMAGE_UNAVAILABLE_MESSAGE,
  getChartData,
  registerChartApi,
} from '../chart-api';

let server: Server;
let base: string;

describe('chart API optional image rendering', () => {
  beforeAll(async () => {
    getMarketFramesMock.mockResolvedValue([{
      timestamp: 1700000000000,
      price: { open: 99, high: 105, low: 97, close: 102 },
      volume: 42,
      indicators: {
        rsi: 55,
        macd: { line: 1.2 },
        ema20: 101,
      },
    }]);

    const app = express();
    registerChartApi(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('imports successfully and keeps chart data reachable', async () => {
    expect(getChartData).toBeTypeOf('function');

    const response = await fetch(`${base}/api/chart-data/BTC`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{
      timestamp: 1700000000000,
      open: 99,
      high: 105,
      low: 97,
      close: 102,
      volume: 42,
      rsi: 55,
      macd: 1.2,
      ema: 101,
    }]);
  });

  it('reports server-side chart images as unavailable', async () => {
    const response = await fetch(`${base}/api/chart-image/BTC`);

    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error: CHART_IMAGE_UNAVAILABLE_MESSAGE,
    });
  });
});
