import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import agentsRouter from '../agents';
import type { AuthRequest } from '../../middleware/auth';

let server: Server;
let base: string;

async function get(route: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${base}${route}`);
  return { status: response.status, body: await response.json() };
}

async function post(
  route: string,
  body: unknown,
  authenticated = false,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authenticated ? { 'x-test-user': 'agent-user' } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe('agent services route group', () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.headers['x-test-user']) {
        (req as AuthRequest).user = { id: 'agent-user', email: 'agent@example.test' };
      }
      next();
    });
    app.use('/api/agents/services-api', agentsRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/services-api`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves every read-only status contract', async () => {
    const responses = await Promise.all([
      get('/services'),
      get('/abilities'),
      get('/status'),
      get('/abilities/available'),
      get('/services/available'),
      get('/config'),
    ]);

    for (const response of responses) expect(response.status).toBe(200);
    expect(responses[0].body).toEqual(expect.objectContaining({
      timestamp: expect.any(String),
      services: expect.any(Array),
      total: expect.any(Number),
    }));
    expect(responses[1].body).toEqual(expect.objectContaining({
      timestamp: expect.any(String),
      abilities: expect.any(Array),
      total: expect.any(Number),
    }));
    expect(responses[2].body.agent_system).toEqual(expect.objectContaining({
      total_services: expect.any(Number),
      total_abilities: expect.any(Number),
    }));
    expect(responses[3].body.abilities).toEqual(expect.any(Array));
    expect(responses[4].body.services).toEqual(expect.any(Array));
    expect(responses[5].body).toEqual(expect.objectContaining({
      configuration: expect.any(Object),
      stats: expect.any(Object),
      features: expect.any(Object),
    }));
  });

  it('returns a handled 404 for unknown ability and service names', async () => {
    const [ability, service] = await Promise.all([
      get('/ability/not-a-real-ability'),
      get('/service/not-a-real-service'),
    ]);

    expect(ability.status).toBe(404);
    expect(ability.body.error).toContain('not found');
    expect(ability.body.available_abilities).toEqual(expect.any(Array));
    expect(service.status).toBe(404);
    expect(service.body.error).toContain('not found');
    expect(service.body.available_services).toEqual(expect.any(Array));
  });

  it('reports disabled ability use without invoking heavy work', async () => {
    const response = await post('/ability/not-a-real-ability/use', {}, true);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('disabled or not available');
    expect(response.body.enable_instructions).toContain('feature-flags');
  });

  it('requires authentication and bounds the ability parameter', async () => {
    const unauthenticated = await post('/ability/not-a-real-ability/use', {});
    const oversized = await post(`/ability/${'x'.repeat(129)}/use`, {}, true);

    expect(unauthenticated.status).toBe(401);
    expect(oversized.status).toBe(400);
  });
});
