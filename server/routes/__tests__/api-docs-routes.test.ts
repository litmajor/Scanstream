import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import apiDocsRouter from '../api-docs';
import { apiRegistry } from '../../services/api-registry';

let server: Server;
let base: string;

async function request(route: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${route}`);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe('API documentation wildcard routes', () => {
  beforeAll(async () => {
    apiRegistry.registerEndpoint({
      method: 'GET',
      path: '/api/docs-fixture/foo/bar',
      category: 'CORE',
      name: 'Docs fixture',
      description: 'Wildcard route fixture',
      version: '1.0.0',
      tags: ['fixture'],
      isDeprecated: false,
      authentication: 'NONE',
      cacheable: false,
      isActive: true,
    });
    const app = express();
    app.use('/api/docs', apiDocsRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/docs`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('resolves lowercase endpoint and uppercase health wildcard methods', async () => {
    const endpoint = await request('/endpoints/get/api/docs-fixture/foo/bar');
    const health = await request('/health/GET/api/docs-fixture/foo/bar');

    expect(endpoint.status).toBe(200);
    expect(endpoint.body.path).toBe('/api/docs-fixture/foo/bar');
    expect(health.status).toBe(200);
    expect(health.body).toEqual(expect.objectContaining({
      endpoint: { method: 'GET', path: '/api/docs-fixture/foo/bar' },
    }));
  });

  it('rejects unknown methods and overlong wildcard paths as bad input', async () => {
    const unknownMethod = await request('/endpoints/TRACE/api/docs-fixture/foo/bar');
    const overlongPath = await request(`/health/get/${'a'.repeat(257)}`);

    expect(unknownMethod.status).toBe(400);
    expect(overlongPath.status).toBe(400);
  });
});
