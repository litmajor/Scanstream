import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const sentimentMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/coingecko', () => ({
  coinGeckoService: {
    getSentimentScore: sentimentMock,
  },
}));

import coingeckoRouter from '../coingecko';

let server: Server;
let base: string;

describe('review regression guards', () => {
  beforeAll(async () => {
    const app = express();
    app.use('/api/coingecko', coingeckoRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('maps malformed CoinGecko sentiment symbols to a client error', async () => {
    const response = await fetch(`${base}/api/coingecko/sentiment/${'x'.repeat(65)}`);

    expect(response.status).toBe(400);
    expect(sentimentMock).not.toHaveBeenCalled();
  });

  it('keeps a single centralized symbols mount', () => {
    const indexSource = readFileSync('server/index.ts', 'utf8');
    const routesSource = readFileSync('server/routes.ts', 'utf8');
    const mountPattern = /app\.use\(\s*['"]\/api\/symbols['"]/g;

    expect(indexSource.match(mountPattern)).toBeNull();
    expect(routesSource.match(mountPattern)).toHaveLength(1);
  });

  it('keeps AgentSignalHistory behind the lazy chart boundary', () => {
    const componentSource = readFileSync('client/src/components/AgentSignalHistory.tsx', 'utf8');
    const chartCoreSource = readFileSync('client/src/components/charts/BarChartCoreImpl.tsx', 'utf8');

    expect(componentSource).not.toMatch(/from ['"]recharts['"]/);
    expect(componentSource).toContain('barSeries=');
    expect(chartCoreSource).toContain('barSeries?: BarSeries[]');
    expect(chartCoreSource).toContain('{children ??');
  });
});
