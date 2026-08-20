import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { AuthRequest } from '../../middleware/auth';

const generateSignalMock = vi.hoisted(() => vi.fn());
const getSummaryMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/complete-pipeline-signal-generator', () => ({
  default: {
    generateSignal: generateSignalMock,
    getSummary: getSummaryMock,
  },
}));

import signalGenerationRouter from '../api/signal-generation';
import symbolUniverseRouter from '../api/symbol-universe';
import { symbolManager } from '../../services/symbol-manager';

async function startRouter(router: express.Router, mountPath: string): Promise<{
  server: Server;
  base: string;
}> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-test-user']) {
      (req as AuthRequest).user = {
        id: 'batch4a-user',
        email: 'batch4a@example.test',
      };
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
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
  };
}

function withOperator(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-trading-operator-token': 'batch4a-token',
    },
  };
}

function withUser(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-test-user': 'batch4a-user',
    },
  };
}

const signalRequest = {
  symbol: 'BTC/USDT',
  currentPrice: 42000,
  timeframe: '1h',
  accountBalance: 10000,
  chartData: [{ close: 42000 }],
};

describe('Pass 5 batch 4a signal and symbol-universe routes', () => {
  let signalServer: Server;
  let universeServer: Server;
  let signalBase: string;
  let universeBase: string;
  const previousToken = process.env.TRADING_OPERATOR_TOKEN;

  beforeAll(async () => {
    process.env.TRADING_OPERATOR_TOKEN = 'batch4a-token';
    generateSignalMock.mockResolvedValue({ symbol: 'BTC/USDT', type: 'BUY', confidence: 0.8 });
    getSummaryMock.mockReturnValue({ type: 'BUY', confidence: 0.8 });
    ({ server: signalServer, base: signalBase } = await startRouter(
      signalGenerationRouter,
      '/api/signal-generation',
    ));
    ({ server: universeServer, base: universeBase } = await startRouter(
      symbolUniverseRouter,
      '/api/symbol-universe',
    ));
  });

  afterAll(async () => {
    if (previousToken === undefined) delete process.env.TRADING_OPERATOR_TOKEN;
    else process.env.TRADING_OPERATOR_TOKEN = previousToken;
    await Promise.all([
      new Promise<void>((resolve) => signalServer.close(() => resolve())),
      new Promise<void>((resolve) => universeServer.close(() => resolve())),
    ]);
  });

  it('requires the operator and bounds signal generation', async () => {
    expect((await request(signalBase, '/generate', {
      method: 'POST',
      body: JSON.stringify(signalRequest),
    })).status).toBe(401);

    expect((await request(signalBase, '/generate', withOperator({
      method: 'POST',
      body: JSON.stringify({ ...signalRequest, chartData: Array.from({ length: 501 }, () => ({})) }),
    }))).status).toBe(400);

    const generated = await request(signalBase, '/generate', withOperator({
      method: 'POST',
      body: JSON.stringify(signalRequest),
    }));
    expect(generated.status).toBe(200);
    expect(generated.body.success).toBe(true);
    expect(generateSignalMock).toHaveBeenCalled();
  });

  it('bounds batch generation and validates the open validation route', async () => {
    expect((await request(signalBase, '/generate-batch', withOperator({
      method: 'POST',
      body: JSON.stringify({ signals: Array.from({ length: 21 }, () => signalRequest) }),
    }))).status).toBe(400);

    const batch = await request(signalBase, '/generate-batch', withOperator({
      method: 'POST',
      body: JSON.stringify({ signals: [signalRequest] }),
    }));
    expect(batch.status).toBe(200);
    expect(batch.body.total).toBe(1);

    expect((await request(signalBase, '/validate', {
      method: 'POST',
      body: JSON.stringify({ symbol: '', currentPrice: -1 }),
    })).status).toBe(400);
    expect((await request(signalBase, '/validate', {
      method: 'POST',
      body: JSON.stringify(signalRequest),
    })).status).toBe(200);
  });

  it('returns handled errors when generation or lookup services fail', async () => {
    generateSignalMock.mockRejectedValueOnce(new Error('generator failure'));
    const generationFailure = await request(signalBase, '/generate', withOperator({
      method: 'POST',
      body: JSON.stringify(signalRequest),
    }));
    expect(generationFailure.status).toBe(500);
    expect(generationFailure.body.error).toBe('Signal generation failed');
    expect(generationFailure.body.details).toBeUndefined();

    const lookupSpy = vi.spyOn(symbolManager, 'lookup').mockImplementationOnce(() => {
      throw new Error('lookup failure');
    });
    const lookupFailure = await request(universeBase, '/search?q=BTC');
    expect(lookupFailure.status).toBe(500);
    expect(lookupFailure.body.error).toBe('Symbol universe request failed');
    lookupSpy.mockRestore();
  });

  it('covers the symbol-universe read contracts and bounded transforms', async () => {
    for (const route of ['/state', '/symbols', '/groups', '/stats', '/ui-config']) {
      expect((await request(universeBase, route)).status).toBe(200);
    }
    expect((await request(universeBase, '/symbols?limit=1001')).status).toBe(400);
    expect((await request(universeBase, '/symbols/BTC%2FUSDT')).status).toBe(404);
    expect((await request(universeBase, '/format/BTC%2FUSDT')).status).toBe(404);
    expect((await request(universeBase, '/groups/missing')).status).toBe(404);
    expect((await request(universeBase, '/search?limit=0')).status).toBe(400);

    expect((await request(universeBase, '/normalize', {
      method: 'POST',
      body: JSON.stringify({ format: 'BTCUSDT', venue: 'binance' }),
    })).status).toBe(200);
    expect((await request(universeBase, '/denormalize', {
      method: 'POST',
      body: JSON.stringify({ canonical: 'BTC/USDT', venue: 'binance' }),
    })).status).toBe(200);
    expect((await request(universeBase, '/normalize', {
      method: 'POST',
      body: JSON.stringify({ format: '' }),
    })).status).toBe(400);
  });

  it('authenticates and validates the UI configuration mutation', async () => {
    expect((await request(universeBase, '/ui-config', {
      method: 'POST',
      body: JSON.stringify({ abbreviate: true }),
    })).status).toBe(401);
    expect((await request(universeBase, '/ui-config', withUser({
      method: 'POST',
      body: JSON.stringify({ unknown: true }),
    }))).status).toBe(400);
    const updated = await request(universeBase, '/ui-config', withUser({
      method: 'POST',
      body: JSON.stringify({ abbreviate: true }),
    }));
    expect(updated.status).toBe(200);
    expect(updated.body.abbreviate).toBe(true);
  });

  it('opens and closes the symbol change stream cleanly', async () => {
    const controller = new AbortController();
    const response = await fetch(`${universeBase}/changes`, { signal: controller.signal });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    controller.abort();
  });
});
