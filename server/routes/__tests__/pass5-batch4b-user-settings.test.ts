import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { AuthRequest } from '../../middleware/auth';
import { safetyEventLog } from '../../services/observability/safety-event-log';

const handlers = vi.hoisted(() => {
  const names = [
    'updateProfile', 'changePassword', 'deleteAccount', 'getPreferences',
    'updatePreferences', 'getTradingSettings', 'updateTradingSettings',
    'getDashboardSettings', 'updateDashboardSettings', 'getAdvancedSettings',
    'updateAdvancedSettings', 'getSecuritySettings', 'updateSecuritySettings',
    'getLoginSessions', 'revokeSession', 'getActivityLogs', 'exportUserData',
    'getApiKeys', 'addApiKey', 'deleteApiKey',
  ] as const;
  return Object.fromEntries(
    names.map((name) => [name, vi.fn((_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json({ success: true, route: name });
    })]),
  ) as Record<(typeof names)[number], ReturnType<typeof vi.fn>> & {
    getUserSettingsAuditSnapshot: ReturnType<typeof vi.fn>;
  };
});

handlers.getUserSettingsAuditSnapshot = vi.fn((userId: string | undefined) => ({
  userId,
  tradingSettings: null,
  apiKeys: [],
}));
handlers.addApiKey.mockImplementation((_req: unknown, res: {
  status: (code: number) => { json: (body: unknown) => void };
}) => res.status(201).json({ success: true, route: 'addApiKey' }));

vi.mock('../../controllers/user-settings-controller', () => handlers);

import userSettingsRouter from '../user-settings';

async function startRouter(): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-test-user']) {
      (req as AuthRequest).user = {
        id: 'batch4b-user',
        email: 'batch4b@example.test',
      };
    }
    next();
  });
  app.use('/api/user', userSettingsRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unhandled route error' });
  });
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  return {
    server,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/user`,
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

function withUser(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...(init.headers ?? {}), 'x-test-user': 'batch4b-user' },
  };
}

function withOperator(init: RequestInit = {}): RequestInit {
  return {
    ...withUser(init),
    headers: {
      ...(init.headers ?? {}),
      'x-test-user': 'batch4b-user',
      'x-trading-operator-token': 'batch4b-token',
    },
  };
}

describe('Pass 5 batch 4b user-settings routes', () => {
  let server: Server;
  let base: string;
  const previousToken = process.env.TRADING_OPERATOR_TOKEN;

  beforeAll(async () => {
    process.env.TRADING_OPERATOR_TOKEN = 'batch4b-token';
    ({ server, base } = await startRouter());
  });

  afterAll(async () => {
    if (previousToken === undefined) delete process.env.TRADING_OPERATOR_TOKEN;
    else process.env.TRADING_OPERATOR_TOKEN = previousToken;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects unauthenticated requests and covers all read routes', async () => {
    expect((await request(base, '/preferences')).status).toBe(401);

    for (const route of [
      '/preferences',
      '/trading-settings',
      '/dashboard-settings',
      '/advanced-settings',
      '/security',
      '/login-sessions',
      '/activity-logs',
      '/export-data',
      '/api-keys',
    ]) {
      const response = await request(base, route, withUser());
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }
  });

  it('covers authenticated non-capital mutations with bounded payloads', async () => {
    const mutations: Array<[string, string]> = [
      ['/profile', 'PATCH'],
      ['/dashboard-settings', 'PATCH'],
      ['/advanced-settings', 'PATCH'],
      ['/security', 'PATCH'],
    ];
    for (const [route, method] of mutations) {
      const response = await request(base, route, withUser({
        method,
        body: JSON.stringify({}),
      }));
      expect(response.status).toBe(200);
    }

    const preferences = await request(base, '/preferences', withUser({
      method: 'PATCH',
      body: JSON.stringify({ theme: 'dark', defaultTimeframe: '1h' }),
    }));
    expect(preferences.status).toBe(200);

    const password = await request(base, '/change-password', withUser({
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'OldPassword1', newPassword: 'NewPassword1' }),
    }));
    expect(password.status).toBe(200);

    const account = await request(base, '/account', withUser({ method: 'DELETE' }));
    expect(account.status).toBe(200);
  });

  it('guards execution-affecting settings and credential mutations', async () => {
    expect((await request(base, '/trading-settings', {
      method: 'PATCH',
      body: JSON.stringify({ positionSize: 5 }),
    })).status).toBe(401);
    expect((await request(base, '/api-keys', withUser({
      method: 'POST',
      body: JSON.stringify({
        exchange: 'binance',
        name: 'primary',
        apiKey: 'key',
        apiSecret: 'secret',
      }),
    }))).status).toBe(401);

    expect((await request(base, '/trading-settings', withOperator({
      method: 'PATCH',
      body: JSON.stringify({ positionSize: 5, maxDailyLoss: 10 }),
    }))).status).toBe(200);
    const audit = safetyEventLog.tail().find((event) => event.type === 'operator_action') as {
      action?: string;
      previousState?: unknown;
      resultingState?: unknown;
    } | undefined;
    expect(audit?.action).toBe('config');
    expect(audit?.previousState).toBeDefined();
    expect(audit?.resultingState).toBeDefined();
    expect((await request(base, '/trading-settings', withOperator({
      method: 'PATCH',
      body: JSON.stringify({ positionSize: 1000 }),
    }))).status).toBe(400);

    const apiKey = await request(base, '/api-keys', withOperator({
      method: 'POST',
      body: JSON.stringify({
        exchange: 'binance',
        name: 'primary',
        apiKey: 'key',
        apiSecret: 'secret',
      }),
    }));
    expect(apiKey.status).toBe(201);
    expect((apiKey.body as Record<string, unknown>).apiSecret).toBeUndefined();

    expect((await request(base, '/api-keys/key-1', withOperator({
      method: 'DELETE',
    }))).status).toBe(200);
  });

  it('rejects malformed settings, credentials, and identifiers', async () => {
    expect((await request(base, '/preferences', withUser({
      method: 'PATCH',
      body: JSON.stringify({ unexpected: true }),
    }))).status).toBe(400);
    expect((await request(base, '/dashboard-settings', withUser({
      method: 'PATCH',
      body: JSON.stringify({ widgets: Array.from({ length: 51 }, () => 'chart') }),
    }))).status).toBe(400);
    expect((await request(base, '/change-password', withUser({
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'x'.repeat(513), newPassword: 'valid' }),
    }))).status).toBe(400);
    expect((await request(base, `/login-sessions/${'x'.repeat(129)}/revoke`, withUser({
      method: 'POST',
      body: JSON.stringify({}),
    }))).status).toBe(400);
    expect((await request(base, `/api-keys/${'x'.repeat(129)}`, withOperator({
      method: 'DELETE',
    }))).status).toBe(400);
  });

  it('converts controller rejection into a handled error response', async () => {
    handlers.getPreferences.mockRejectedValueOnce(new Error('settings failure'));
    const response = await request(base, '/preferences', withUser());
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('User settings request failed');
  });
});
