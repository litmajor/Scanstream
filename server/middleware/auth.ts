/**
 * Authentication Middleware
 * Handles user authentication checks for protected routes
 */

import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

/**
 * Middleware: Require Authentication
 * Checks if user is authenticated and attached to request
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }
  next();
}

/**
 * Middleware: Optional Authentication
 * Attaches user if available but doesn't require it
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // User may or may not be present
  next();
}

/**
 * Helper: Check if user has specific role
 */
export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

/**
 * Helper: Check if user owns the resource
 */
export function requireOwnership(userIdParam: string = 'userId') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const resourceUserId = req.params[userIdParam] || req.body.userId;
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this resource' });
    }
    next();
  };
}
