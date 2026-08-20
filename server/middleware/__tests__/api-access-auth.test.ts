import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { requireAuth, type AuthRequest } from '../auth';
import { attachApiIdentity } from '../api-access-auth';
import { requireTradingOperator } from '../require-trading-operator';

const apiToken = 'route-test-api-token';
const operatorToken = 'route-test-operator-token';
let server: Server;
let base: string;

async function request(route: string, init: RequestInit = {}): Promise<number> {
  const response = await fetch(`${base}${route}`, {
    ...init,
    headers: { ...(init.headers ?? {}) },
  });
  return response.status;
}

describe('API access identity middleware', () => {
  beforeAll(async () => {
    process.env.TRADING_OPERATOR_TOKEN = operatorToken;
    const app = express();
    app.use(attachApiIdentity);
    app.get('/protected', requireAuth, (req, res) => {
      res.json({ id: (req as AuthRequest).user?.id });
    });
    app.get('/operator', requireTradingOperator, (_req, res) => {
      res.json({ success: true });
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(() => {
    delete process.env.API_ACCESS_TOKEN;
  });

  afterAll(async () => {
    delete process.env.API_ACCESS_TOKEN;
    delete process.env.TRADING_OPERATOR_TOKEN;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('fails closed when the API token is unset, absent, or incorrect', async () => {
    expect(await request('/protected')).toBe(401);

    process.env.API_ACCESS_TOKEN = apiToken;
    expect(await request('/protected')).toBe(401);
    expect(await request('/protected', {
      headers: { 'x-api-access-token': 'wrong-token' },
    })).toBe(401);
  });

  it('attaches a shared identity only for the API token and cannot satisfy operator auth', async () => {
    process.env.API_ACCESS_TOKEN = apiToken;
    expect(await request('/protected', {
      headers: { 'x-api-access-token': apiToken },
    })).toBe(200);
    expect(await request('/operator', {
      headers: { 'x-api-access-token': apiToken },
    })).toBe(401);
  });
});
