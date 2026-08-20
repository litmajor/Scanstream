/**
 * Shared API access identity for authenticated non-operator routes.
 *
 * This is a stopgap for deployments without session authentication. It
 * provides one fixed non-privileged identity and must not be treated as
 * per-user authentication.
 */

import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from './auth';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function attachApiIdentity(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.API_ACCESS_TOKEN;
  if (!expected) {
    next();
    return;
  }

  const header = req.headers['x-api-access-token'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (provided && timingSafeEqual(String(provided), expected)) {
    const authRequest = req as AuthRequest;
    authRequest.user ??= {
      id: 'shared-api-token',
      email: 'shared-api-token',
    };
  }

  next();
}

export default attachApiIdentity;
