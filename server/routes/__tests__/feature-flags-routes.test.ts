import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import featureFlagsRouter from '../feature-flags';

let server: Server;
let base: string;

async function request(route: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${route}`);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe('feature flag category routes', () => {
  beforeAll(async () => {
    const app = express();
    app.use('/api/feature-flags', featureFlagsRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/feature-flags`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves valid categories and reports unknown categories as validation errors', async () => {
    const valid = await request('/category/strategy');
    const unknown = await request('/category/unknown');
    const overlong = await request(`/category/${'x'.repeat(33)}`);

    expect(valid.status).toBe(200);
    expect(valid.body.category).toBe('strategy');
    expect(unknown.status).toBe(400);
    expect(unknown.body).toEqual(expect.objectContaining({
      error: 'Invalid category: unknown',
      valid_categories: ['strategy', 'service', 'analysis', 'experimental', 'admin'],
    }));
    expect(overlong.status).toBe(400);
    expect(overlong.body).toEqual(expect.objectContaining({
      error: `Invalid category: ${'x'.repeat(33)}`,
      valid_categories: ['strategy', 'service', 'analysis', 'experimental', 'admin'],
    }));
  });
});
