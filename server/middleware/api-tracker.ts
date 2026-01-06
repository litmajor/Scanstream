/**
 * API Registry Tracking Middleware
 * 
 * Automatically tracks all incoming requests and responses
 * to the API Registry for metrics collection
 */

import { Request, Response, NextFunction } from 'express';
import { apiRegistry } from '../services/api-registry';

/**
 * Middleware to track API requests
 * Captures latency, status codes, and errors
 */
export function apiTrackerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = performance.now();
  const originalSend = res.send;

  // Override send to capture response
  res.send = function(data: any) {
    const latency = performance.now() - startTime;
    const status = res.statusCode;
    
    // Extract error message if present
    let error: string | undefined;
    if (status >= 400 && typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        error = parsed.error || data;
      } catch {
        error = data;
      }
    }

    // Normalize the path (remove query params and IDs)
    let normalizedPath = req.path;
    
    // Track the request
    apiRegistry.trackRequest(
      req.method as any,
      normalizedPath,
      latency,
      status,
      error
    );

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Express middleware setup function
 */
export function setupAPITracking(app: any) {
  app.use(apiTrackerMiddleware);
  console.log('[APITracking] Middleware installed - tracking all requests');
}
