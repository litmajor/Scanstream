import type { Response } from 'express';

export class InvalidRouteParamError extends Error {
  constructor(name: string) {
    super(`Invalid route parameter: ${name}`);
    this.name = 'InvalidRouteParamError';
  }
}

export function respondToInvalidRouteParam(error: unknown, res: Pick<Response, 'status'>): boolean {
  if (!(error instanceof InvalidRouteParamError)) return false;
  res.status(400).json({ error: error.message });
  return true;
}

export function routeParam(
  value: string | string[] | undefined,
  name: string,
  maxLength = 128,
): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new InvalidRouteParamError(name);
  }

  return value;
}

export function routeParamWildcard(
  value: string | string[] | undefined,
  name: string,
  maxLength = 128,
): string {
  const normalized = Array.isArray(value) ? value.join('/') : value;
  return routeParam(normalized, name, maxLength);
}

export function routeParamEnum<const T extends string>(
  value: string | string[] | undefined,
  name: string,
  allowed: readonly T[],
): T {
  const param = routeParam(value, name);
  if (!allowed.includes(param as T)) {
    throw new InvalidRouteParamError(name);
  }
  return param as T;
}
