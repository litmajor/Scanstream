/**
 * Audit trail for capital-moving operator endpoints.
 *
 * "Who stopped trading at 03:12 and what was the engine doing at the time" is
 * an incident question, so every authenticated action against a control
 * endpoint is recorded durably with the state before and after it, whether it
 * succeeded, and the reason the operator gave.
 *
 * The operator token is never recorded — only the fact that the request carried
 * it. Request bodies are not recorded wholesale either, to avoid capturing
 * anything sensitive an operator happens to post.
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { safetyEventLog, type OperatorAction } from '../services/observability/safety-event-log';

export interface AuditOptions {
  /** Snapshot of the state this action mutates, taken before and after. */
  snapshot?: (req?: Request) => unknown;
  /** What the action was aimed at (position id, symbol, config keys). */
  target?: (req: Request) => string | undefined;
}

export function auditOperatorAction(action: OperatorAction, options: AuditOptions = {}) {
  return function auditMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
    let previousState: unknown;
    try {
      previousState = options.snapshot?.(req);
    } catch {
      previousState = undefined;
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : undefined;
    let target: string | undefined;
    try {
      target = options.target?.(req);
    } catch {
      target = undefined;
    }

    res.on('finish', () => {
      let resultingState: unknown;
      try {
        resultingState = options.snapshot?.(req);
      } catch {
        resultingState = undefined;
      }
      safetyEventLog.recordOperatorAction({
        action,
        target,
        previousState,
        resultingState,
        success: res.statusCode < 400,
        reason,
        requestId,
        detail: `${req.method} ${req.originalUrl} -> ${res.statusCode}`,
      });
    });

    next();
  };
}

export default auditOperatorAction;
