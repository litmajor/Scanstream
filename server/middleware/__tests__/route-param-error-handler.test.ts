import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Server } from 'http';
import { respondToInvalidRouteParam, routeParam } from '../../utils/route-params';
import { routeParamErrorHandler } from '../route-param-error-handler';

let server: Server;
let base: string;

async function request(route: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${route}`);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe('route parameter error handling', () => {
  beforeAll(async () => {
    const app = express();

    app.get('/propagates/:value', (req: Request, res: Response) => {
      res.json({ value: routeParam(req.params.value, 'value', 8) });
    });

    app.get('/catches/:value', (req: Request, res: Response) => {
      try {
        res.json({ value: routeParam(req.params.value, 'value', 8) });
      } catch (error: unknown) {
        if (respondToInvalidRouteParam(error, res)) return;
        res.status(500).json({ error: 'unexpected failure' });
      }
    });

    app.get('/generic-failure', () => {
      throw new Error('generic failure');
    });

    app.use(routeParamErrorHandler);
    app.use((
      _error: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      res.status(500).json({ error: 'internal failure' });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('maps a propagated invalid route parameter to 400', async () => {
    const response = await request(`/propagates/${'x'.repeat(9)}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid route parameter: value' });
  });

  it('maps an invalid route parameter caught by the handler to 400', async () => {
    const response = await request(`/catches/${'x'.repeat(9)}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid route parameter: value' });
  });

  it('preserves the generic 500 error contract', async () => {
    const response = await request('/generic-failure');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'internal failure' });
  });
});
