/**
 * User Settings Middleware & Utilities
 * Security checks, validation, and helper functions
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

// Extended request interface
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    ipAddress?: string;
  };
}

const prisma = new PrismaClient();

// TODO: These tables need to be added to Prisma schema
// For now, storing in-memory until database tables are created
const securitySettingsCache = new Map<string, any>();
const activityLogsCache = new Map<string, any[]>();
const advancedSettingsCache = new Map<string, any>();
const auditTrailCache = new Map<string, any[]>();

/**
 * Middleware: IP Whitelist Validation
 * Checks if user has IP whitelist enabled and validates current IP
 */
export async function validateIpWhitelist(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's security settings from cache (TODO: move to database)
    const settings = securitySettingsCache.get(req.user.id);
    if (!settings?.ipWhitelistEnabled) {
      return next(); // Whitelist not enabled, continue
    }

    // Get client IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     req.socket.remoteAddress || 
                     '';

    // Check if IP is in whitelist
    if (settings.ipAddresses && Array.isArray(settings.ipAddresses)) {
      if (!settings.ipAddresses.includes(clientIp)) {
        return res.status(403).json({ 
          error: 'Access denied: Your IP address is not whitelisted',
          clientIp: clientIp // For debugging (remove in production)
        });
      }
    }

    next();
  } catch (error) {
    console.error('IP whitelist validation error:', error);
    next(); // Don't block on error
  }
}

/**
 * Middleware: Activity Logging
 * Automatically logs all user actions
 */
export async function logUserActivity(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return next();
  }

  const userId = req.user.id;
  const method = req.method;
  const path = req.path;

  // Capture response status code
  const originalJson = res.json;
  res.json = function(body: any) {
    logActivity(userId, method, path, res.statusCode);
    return originalJson.call(this, body);
  };

  next();
}

/**
 * Helper: Log activity to database
 */
async function logActivity(userId: string, method: string, path: string, statusCode: number) {
  try {
    const action = `${method} ${path}`;
    const details = `Status: ${statusCode}`;

    // Store in cache until database table is available
    if (!activityLogsCache.has(userId)) {
      activityLogsCache.set(userId, []);
    }
    activityLogsCache.get(userId)!.push({
      userId,
      action,
      details,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

/**
 * Helper: Validate rate limiting
 * Check if user has exceeded API rate limit
 */
export async function checkRateLimit(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return next();
  }

  try {
    // Get user's advanced settings from cache (TODO: move to database)
    const settings = advancedSettingsCache.get(req.user.id);
    const rateLimit = settings?.apiRateLimit || 1000;

    // Implementation: Use Redis or in-memory store for tracking
    // For now, just pass through
    req.user = { ...req.user, ...{ apiRateLimit: rateLimit } };
    next();
  } catch (error) {
    console.error('Rate limit check error:', error);
    next(); // Don't block on error
  }
}

/**
 * Helper: Get user's security context
 * Returns all security-related settings for validation
 */
export async function getUserSecurityContext(userId: string) {
  try {
    const security = securitySettingsCache.get(userId) || {};
    const advanced = advancedSettingsCache.get(userId) || {};
    const preferences = {}; // TODO: Add preferences cache when table is available

    return {
      security,
      advanced,
      preferences
    };
  } catch (error) {
    console.error('Get security context error:', error);
    return {
      security: {},
      advanced: {},
      preferences: {}
    };
  }
}

/**
 * Helper: Record audit trail change
 * Keeps comprehensive record of all data modifications
 */
export async function recordAuditTrail(
  userId: string,
  tableName: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
) {
  try {
    // Store in cache until database table is available
    if (!auditTrailCache.has(userId)) {
      auditTrailCache.set(userId, []);
    }
    auditTrailCache.get(userId)!.push({
      userId,
      tableName,
      operation,
      oldValues,
      newValues,
      changedAt: new Date()
    });
  } catch (error) {
    console.error('Audit trail recording error:', error);
  }
}

/**
 * Helper: Check session age
 * Determines if session should be refreshed or expired
 */
export async function getSessionAge(sessionId: string): Promise<number | null> {
  try {
    // TODO: Implement when login_sessions table is available
    return null;
  } catch (error) {
    console.error('Get session age error:', error);
    return null;
  }
}

/**
 * Helper: Auto-revoke expired sessions
 * Cleans up sessions older than specified days
 */
export async function autoRevokeExpiredSessions(userId: string, maxDaysOld: number = 30) {
  try {
    // TODO: Implement when login_sessions table is available
    return 0;
  } catch (error) {
    console.error('Auto-revoke sessions error:', error);
    return 0;
  }
}

/**
 * Helper: Validate webhook configuration
 * Ensures webhook URL is reachable and properly configured
 */
export async function validateWebhookUrl(url: string): Promise<boolean> {
  if (!url) return true; // Empty URL is ok (webhook disabled)

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Webhook validation error:', error);
    return false;
  }
}

/**
 * Helper: Encrypt sensitive data (for production)
 * Should replace base64 encoding with proper AES-256
 */
export function encryptSensitiveData(data: string, encryptionKey?: string): string {
  // TODO: Implement proper AES-256 encryption
  // For now, use base64 as temporary measure
  return Buffer.from(data).toString('base64');
}

/**
 * Helper: Decrypt sensitive data (for production)
 */
export function decryptSensitiveData(data: string, decryptionKey?: string): string {
  // TODO: Implement proper AES-256 decryption
  // For now, use base64 as temporary measure
  return Buffer.from(data, 'base64').toString('utf-8');
}

/**
 * Helper: Generate audit report for compliance
 */
export async function generateAuditReport(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  try {
    const logs = auditTrailCache.get(userId) || [];
    return logs.filter(log => log.changedAt >= startDate && log.changedAt <= endDate);
  } catch (error) {
    console.error('Generate audit report error:', error);
    return [];
  }
}

/**
 * Helper: Export user metadata
 * Used for compliance (GDPR) and account closure
 */
export async function exportUserMetadata(userId: string): Promise<any> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const activity = activityLogsCache.get(userId) || [];
    const security = securitySettingsCache.get(userId) || {};

    return {
      user,
      securitySettings: security,
      recentActivity: activity.slice(0, 100),
      exportDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('Export user metadata error:', error);
    throw error;
  }
}

/**
 * Helper: Anonymize user data
 * Used for account deletion to preserve analytics
 */
export async function anonymizeUserData(userId: string): Promise<boolean> {
  try {
    const anonymousEmail = `deleted_${userId}@scanstream.local`;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail,
        firstName: 'Deleted',
        lastName: 'User'
      }
    });

    return true;
  } catch (error) {
    console.error('Anonymize user data error:', error);
    return false;
  }
}

/**
 * Helper: Calculate settings usage statistics
 */
export async function getSettingsUsageStats(): Promise<any> {
  try {
    const stats = {
      total_users: securitySettingsCache.size,
      users_with_2fa: Array.from(securitySettingsCache.values()).filter(s => (s as any)?.twoFactorEnabled).length,
      users_with_ip_whitelist: Array.from(securitySettingsCache.values()).filter(s => (s as any)?.ipWhitelistEnabled).length,
      users_high_rate_limit: 0
    };

    return stats;
  } catch (error) {
    console.error('Get settings usage stats error:', error);
    return null;
  }
}
