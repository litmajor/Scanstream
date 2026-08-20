import type { NextFunction, Request, Response } from 'express';
import { InvalidRouteParamError } from '../utils/route-params';

export function routeParamErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof InvalidRouteParamError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}

export default routeParamErrorHandler;
