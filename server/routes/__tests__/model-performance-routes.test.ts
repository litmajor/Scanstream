import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import modelPerformanceRouter from '../model-performance';
import { ModelPerformanceTracker } from '../../services/model-performance-tracker';
import type { AuthRequest } from '../../middleware/auth';
import { safetyEventLog } from '../../services/observability/safety-event-log';

let server: Server;
let base: string;
const operatorToken = 'model-performance-operator-token';

async function request(
  route: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() };
}

function withOperator(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      'x-trading-operator-token': operatorToken,
    },
  };
}

describe('model performance route group', () => {
  beforeAll(async () => {
    process.env.TRADING_OPERATOR_TOKEN = operatorToken;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.headers['x-test-user']) {
        (req as AuthRequest).user = { id: 'model-user', email: 'model@example.test' };
      }
      next();
    });
    app.use('/api/model-performance', modelPerformanceRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/model-performance`;
  });

  afterEach(() => {
    safetyEventLog.setFilePath(
      path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), 'scanstream-model-performance-audit-')),
        'events.jsonl',
      ),
    );
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    delete process.env.TRADING_OPERATOR_TOKEN;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves metrics, history, and ensemble status contracts', async () => {
    const [metrics, history, status] = await Promise.all([
      request('/metrics'),
      request('/history?limit=5'),
      request('/ensemble-status'),
    ]);

    expect(metrics.status).toBe(200);
    expect(metrics.body).toEqual(expect.objectContaining({
      success: true,
      metrics: expect.any(Object),
      timestamp: expect.any(String),
    }));
    expect(history.status).toBe(200);
    expect(history.body).toEqual(expect.objectContaining({
      success: true,
      count: expect.any(Number),
      history: expect.any(Array),
    }));
    expect(status.status).toBe(200);
    expect(status.body.ensemble).toEqual(expect.objectContaining({
      models: expect.any(Array),
      totalModels: 5,
      ready: expect.any(Boolean),
    }));
  });

  it('validates ensemble input before invoking prediction work', async () => {
    const response = await request('/ensemble-predict', {
      method: 'POST',
      headers: { 'x-test-user': 'model-user' },
      body: JSON.stringify({ chartData: [] }),
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Insufficient data',
      message: expect.stringContaining('20'),
    }));
  });

  it('validates and records a prediction, then supports pruning', async () => {
    const validation = await request('/validate', {
      method: 'POST',
      headers: { 'x-test-user': 'model-user' },
      body: JSON.stringify({
        symbol: 'BTC/USDT',
        predictedDirection: 'UP',
        actualChange: 10,
        predictedPrice: 100,
        actualPrice: 110,
      }),
    });
    const prune = await request('/prune', {
      ...withOperator({
        method: 'POST',
        body: JSON.stringify({ daysToKeep: 30 }),
      }),
    });

    expect(validation.status).toBe(200);
    expect(validation.body).toEqual(expect.objectContaining({
      success: true,
      result: expect.objectContaining({
        symbol: 'BTC/USDT',
        correct: true,
      }),
    }));
    expect(prune.status).toBe(200);
    expect(prune.body.success).toBe(true);
    expect(safetyEventLog.tail()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'operator_action',
        action: 'prune_model_history',
        target: '30',
        success: true,
      }),
    ]));
  });

  it('requires authentication and bounds restored state-changing operations', async () => {
    const unauthenticated = await request('/validate', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'BTC/USDT', predictedDirection: 'UP', actualChange: 1 }),
    });
    const invalidValidation = await request('/validate', {
      method: 'POST',
      headers: { 'x-test-user': 'model-user' },
      body: JSON.stringify({ symbol: 'BTC/USDT', predictedDirection: 'UP', actualChange: Infinity }),
    });
    const invalidPrune = await request('/prune', {
      ...withOperator({
        method: 'POST',
        body: JSON.stringify({ daysToKeep: 3651 }),
      }),
    });
    const ordinaryPrune = await request('/prune', {
      method: 'POST',
      headers: { 'x-test-user': 'model-user' },
      body: JSON.stringify({ daysToKeep: 30 }),
    });
    const oversizedEnsemble = await request('/ensemble-predict', {
      method: 'POST',
      headers: { 'x-test-user': 'model-user' },
      body: JSON.stringify({ chartData: Array.from({ length: 1001 }, () => ({})) }),
    });

    expect(unauthenticated.status).toBe(401);
    expect(invalidValidation.status).toBe(400);
    expect(invalidPrune.status).toBe(400);
    expect(ordinaryPrune.status).toBe(401);
    expect(oversizedEnsemble.status).toBe(400);
  });

  it('converts tracker failures into a handled response', async () => {
    vi.spyOn(ModelPerformanceTracker.prototype, 'calculateMetrics').mockImplementation(() => {
      throw new Error('metrics unavailable');
    });

    const response = await request('/metrics');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('metrics unavailable');
  });
});
