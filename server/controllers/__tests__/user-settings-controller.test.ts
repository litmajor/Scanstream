import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';

const query = vi.hoisted(() => vi.fn());

vi.mock('../../db-storage', () => ({
  db: { query },
}));

import {
  deleteApiKey,
  getApiKeys,
  revokeSession,
} from '../user-settings-controller';

function request(userId: string, params: Record<string, string>): AuthRequest {
  return {
    user: { id: userId, email: `${userId}@example.test` },
    params,
  } as AuthRequest;
}

function response() {
  const result = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      result.statusCode = code;
      return result;
    },
    json(body: unknown) {
      result.body = body;
      return result;
    },
  };
  return result as Response & typeof result;
}

describe('user settings controller ownership and secret handling', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('rejects revoking a session owned by another user', async () => {
    query.mockResolvedValueOnce({
      rows: [{ sid: 'session-other', sess: { userId: 'other-user' } }],
    });
    const res = response();

    await revokeSession(request('owner-user', { sessionId: 'session-other' }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden: You do not own this session' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects deleting an API key owned by another user', async () => {
    query.mockResolvedValueOnce({ rows: [{ userId: 'other-user' }] });
    const res = response();

    await deleteApiKey(request('owner-user', { keyId: 'key-other' }), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden: You do not own this API key' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('masks API keys and excludes API secrets from responses', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'key-owner',
        exchange: 'binance',
        name: 'primary',
        isTestnet: false,
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastValidated: null,
        apiKey: 'public-key-123456',
        apiSecret: 'secret-value',
      }],
    });
    const res = response();

    await getApiKeys(request('owner-user', {}), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({
      id: 'key-owner',
      apiKey: 'publ****3456',
    })]);
    expect(JSON.stringify(res.body)).not.toContain('secret-value');
  });
});
