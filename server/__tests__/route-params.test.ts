import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { InvalidRouteParamError, respondToInvalidRouteParam, routeParam, routeParamEnum } from '../utils/route-params';

describe('route parameter validation', () => {
  it('returns bounded string parameters without coercing arrays', () => {
    expect(routeParam('BTC/USDT', 'symbol', 64)).toBe('BTC/USDT');
    expect(() => routeParam(['BTC/USDT'], 'symbol', 64)).toThrow(InvalidRouteParamError);
    expect(() => routeParam('x'.repeat(65), 'symbol', 64)).toThrow(InvalidRouteParamError);
  });

  it('narrows allowlisted parameters', () => {
    expect(routeParamEnum('GET', 'method', ['GET', 'POST'] as const)).toBe('GET');
    expect(() => routeParamEnum('TRACE', 'method', ['GET', 'POST'] as const)).toThrow(InvalidRouteParamError);
  });

  it('maps invalid parameters to a client error without handling other errors', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status };

    expect(respondToInvalidRouteParam(new InvalidRouteParamError('positionId'), response)).toBe(true);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid route parameter: positionId' });
    expect(respondToInvalidRouteParam(new Error('other failure'), response)).toBe(false);
  });
});
