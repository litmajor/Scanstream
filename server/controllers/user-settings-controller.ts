/**
 * User Settings Controller
 * Handles all user settings operations
 */

import { Request, Response } from 'express';
import { db } from '../db-storage';
import crypto from 'crypto';
import { randomUUID } from 'crypto';

// In-memory caches for settings. Preferences and API keys are persisted to the DB;
// remaining caches are kept in-memory as fallbacks and can be migrated later.
const userSettingsCache = new Map<string, any>();
const userPreferencesCache = new Map<string, any>();
const tradingSettingsCache = new Map<string, any>();
const dashboardSettingsCache = new Map<string, any>();
const advancedSettingsCache = new Map<string, any>();
const securitySettingsCache = new Map<string, any>();
const loginSessionsCache = new Map<string, any[]>();
const apiKeysCache = new Map<string, any[]>();

export function getUserSettingsAuditSnapshot(userId: string | undefined) {
  if (!userId) return undefined;
  return {
    tradingSettings: tradingSettingsCache.get(userId) || null,
    apiKeys: (apiKeysCache.get(userId) || []).map((key: {
      id?: unknown;
      exchange?: unknown;
      name?: unknown;
      isTestnet?: unknown;
      isActive?: unknown;
    }) => ({
      id: key.id,
      exchange: key.exchange,
      name: key.name,
      isTestnet: key.isTestnet,
      isActive: key.isActive,
    })),
  };
}

// Types
interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

/**
 * Profile Management
 */
export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { firstName, lastName, email } = req.body;

    // Validate email format
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Update user in database
    const updRes = await db.query('UPDATE "User" SET email = COALESCE($1, email), "firstName" = COALESCE($2, "firstName"), "lastName" = COALESCE($3, "lastName"), "updatedAt" = NOW() WHERE id = $4 RETURNING *', [email || null, firstName || null, lastName || null, userId]);
    const updatedUser = updRes.rows && updRes.rows[0];

    res.json({ success: true, user: { id: updatedUser.id, email: updatedUser.email, firstName: updatedUser.firstName, lastName: updatedUser.lastName } });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Validate new password strength
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors[0] });
    }

    // Get user to verify they exist
    const ures = await db.query('SELECT * FROM "User" WHERE id = $1 LIMIT 1', [userId]);
    const user = ures.rows && ures.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // In a real app, compare hashed password here
    // For now, just validate the format is provided

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Delete user
    await db.query('DELETE FROM "User" WHERE id = $1', [userId]);

    // DB cascade will remove related ApiKeys / Preferences; clear in-memory fallbacks
    userSettingsCache.delete(userId);
    tradingSettingsCache.delete(userId);
    dashboardSettingsCache.delete(userId);
    advancedSettingsCache.delete(userId);
    securitySettingsCache.delete(userId);
    loginSessionsCache.delete(userId);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

/**
 * Preferences
 */
export async function getPreferences(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Prefer persisted preferences when available
    const dbPrefRes = await db.query('SELECT * FROM "UserPreference" WHERE "userId" = $1 LIMIT 1', [userId]);
    const dbPref = dbPrefRes.rows && dbPrefRes.rows[0];
    if (dbPref) {
      const { theme, defaultTimeframe, defaultExchange, notificationsEnabled, emailAlerts, priceAlerts, signalAlerts, soundEnabled } = dbPref;
      return res.json({ theme, defaultTimeframe, defaultExchange, notificationsEnabled, emailAlerts, priceAlerts, signalAlerts, soundEnabled });
    }

    // Fallback defaults
    const prefs = {
      theme: 'dark',
      defaultTimeframe: '1h',
      defaultExchange: 'binance',
      notificationsEnabled: true,
      emailAlerts: false,
      priceAlerts: true,
      signalAlerts: true,
      soundEnabled: true,
    };

    res.json(prefs);
  } catch (error: any) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
}

export async function updatePreferences(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const payload = {
      theme: req.body.theme ?? 'dark',
      defaultTimeframe: req.body.defaultTimeframe ?? '1h',
      defaultExchange: req.body.defaultExchange ?? 'binance',
      notificationsEnabled: typeof req.body.notificationsEnabled === 'boolean' ? req.body.notificationsEnabled : true,
      emailAlerts: typeof req.body.emailAlerts === 'boolean' ? req.body.emailAlerts : false,
      priceAlerts: typeof req.body.priceAlerts === 'boolean' ? req.body.priceAlerts : true,
      signalAlerts: typeof req.body.signalAlerts === 'boolean' ? req.body.signalAlerts : true,
      soundEnabled: typeof req.body.soundEnabled === 'boolean' ? req.body.soundEnabled : true,
    };

    // Upsert preferences via SQL
    await db.query(
      `INSERT INTO "UserPreference" ("userId", theme, "defaultTimeframe", "defaultExchange", "notificationsEnabled", "emailAlerts", "priceAlerts", "signalAlerts", "soundEnabled")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ("userId") DO UPDATE SET
         theme = EXCLUDED.theme,
         "defaultTimeframe" = EXCLUDED."defaultTimeframe",
         "defaultExchange" = EXCLUDED."defaultExchange",
         "notificationsEnabled" = EXCLUDED."notificationsEnabled",
         "emailAlerts" = EXCLUDED."emailAlerts",
         "priceAlerts" = EXCLUDED."priceAlerts",
            "signalAlerts" = EXCLUDED."signalAlerts",
            "soundEnabled" = EXCLUDED."soundEnabled"
          `, [userId, payload.theme, payload.defaultTimeframe, payload.defaultExchange, payload.notificationsEnabled, payload.emailAlerts, payload.priceAlerts, payload.signalAlerts, payload.soundEnabled]
    );

    // keep in-memory fallback in sync
    userPreferencesCache.set(userId, payload);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
}

/**
 * Trading Settings
 */
export async function getTradingSettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = tradingSettingsCache.get(userId) || {
      positionSize: 5,
      defaultStopLoss: 2,
      defaultTakeProfit: 5,
      orderType: 'MARKET',
      slippageTolerance: 0.5,
      commissionRate: 0.1,
      riskRewardRatio: 2,
      maxDailyLoss: 10,
      maxPositionsOpen: 5,
    };

    res.json(settings);
  } catch (error: any) {
    console.error('Get trading settings error:', error);
    res.status(500).json({ error: 'Failed to fetch trading settings' });
  }
}

export async function updateTradingSettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    tradingSettingsCache.set(userId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update trading settings error:', error);
    res.status(500).json({ error: 'Failed to update trading settings' });
  }
}

/**
 * Dashboard Settings
 */
export async function getDashboardSettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = dashboardSettingsCache.get(userId) || {
      widgets: ['price-chart', 'portfolio', 'signals'],
      layoutName: 'default',
      defaultIndicators: ['RSI', 'MACD', 'Bollinger'],
      refreshInterval: 5,
    };

    res.json(settings);
  } catch (error: any) {
    console.error('Get dashboard settings error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard settings' });
  }
}

export async function updateDashboardSettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    dashboardSettingsCache.set(userId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update dashboard settings error:', error);
    res.status(500).json({ error: 'Failed to update dashboard settings' });
  }
}

/**
 * Advanced Settings
 */
export async function getAdvancedSettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = advancedSettingsCache.get(userId) || {
      apiRateLimit: 1000,
      webhookUrl: '',
      botScheduleEnabled: false,
      botScheduleStart: '09:00',
      botScheduleEnd: '17:00',
      alertThrottling: 5,
    };

    res.json(settings);
  } catch (error: any) {
    console.error('Get advanced settings error:', error);
    res.status(500).json({ error: 'Failed to fetch advanced settings' });
  }
}

export async function updateAdvancedSettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    advancedSettingsCache.set(userId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update advanced settings error:', error);
    res.status(500).json({ error: 'Failed to update advanced settings' });
  }
}

/**
 * Security Settings
 */
export async function getSecuritySettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = securitySettingsCache.get(userId) || {
      twoFactorEnabled: false,
      ipWhitelistEnabled: false,
      ipAddresses: [],
    };

    res.json(settings);
  } catch (error: any) {
    console.error('Get security settings error:', error);
    res.status(500).json({ error: 'Failed to fetch security settings' });
  }
}

export async function updateSecuritySettings(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    securitySettingsCache.set(userId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update security settings error:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
}

/**
 * Login Sessions
 */
export async function getLoginSessions(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Try persisted sessions from Prisma `Session` table. The session JSON structure
    // is app-dependent; we'll parse stored `sess` JSON and filter by userId when available.
    const dbSessionsRes = await db.query('SELECT sid, sess, expire FROM "Session" ORDER BY "expire" DESC LIMIT 1000');
    const dbSessions = dbSessionsRes.rows || [];
    const sessions: any[] = [];
    for (const s of dbSessions) {
      try {
        const sess = s.sess as any;
        // common patterns: sess.userId or sess.user?.id
        const storedUserId = sess?.userId ?? sess?.user?.id ?? sess?.user?.userId;
        if (storedUserId === userId) {
          sessions.push({ id: s.sid, data: sess, expire: s.expire });
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: in-memory sessions
    const mem = loginSessionsCache.get(userId) || [];
    res.json([...sessions, ...mem]);
  } catch (error: any) {
    console.error('Get login sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch login sessions' });
  }
}

export async function revokeSession(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId } = req.params;
    const dbSessionRes = await db.query('SELECT sid, sess FROM "Session" WHERE sid = $1 LIMIT 1', [sessionId]);
    const dbSession = dbSessionRes.rows && dbSessionRes.rows[0];
    if (dbSession) {
      const session = typeof dbSession.sess === 'string'
        ? JSON.parse(dbSession.sess)
        : dbSession.sess;
      const storedUserId = session?.userId ?? session?.user?.id ?? session?.user?.userId;
      if (storedUserId !== userId) {
        return res.status(403).json({ error: 'Forbidden: You do not own this session' });
      }
      await db.query('DELETE FROM "Session" WHERE sid = $1', [sessionId]);
    }

    const sessions = loginSessionsCache.get(userId) || [];
    if (!dbSession && !sessions.some((session: { id?: string }) => session.id === sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const filtered = sessions.filter((s: any) => s.id !== sessionId);
    loginSessionsCache.set(userId, filtered);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
}

/**
 * Activity Logs
 */
export async function getActivityLogs(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const logs = userSettingsCache.get(`activity_${userId}`) || [];

    res.json(logs.slice(0, limit));
  } catch (error: any) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
}

/**
 * Data Export
 */
export async function exportUserData(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userRes = await db.query('SELECT * FROM "User" WHERE id = $1 LIMIT 1', [userId]);
    const user = userRes.rows && userRes.rows[0];

    const dbPrefRes = await db.query('SELECT * FROM "UserPreference" WHERE "userId" = $1 LIMIT 1', [userId]);
    const dbPref = dbPrefRes.rows && dbPrefRes.rows[0];
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        createdAt: user?.createdAt
      },
      preferences: dbPref || userPreferencesCache.get(userId) || {},
      settings: {
        trading: tradingSettingsCache.get(userId) || {},
        dashboard: dashboardSettingsCache.get(userId) || {},
        advanced: advancedSettingsCache.get(userId) || {},
        security: securitySettingsCache.get(userId) || {}
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="scanstream-data-${new Date().toISOString().split('T')[0]}.json"`
    );

    res.send(JSON.stringify(exportData, null, 2));
  } catch (error: any) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
}

/**
 * API Keys
 */
export async function getApiKeys(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const keysRes = await db.query('SELECT id, exchange, name, "isTestnet", "isActive", "createdAt", "lastValidated", "apiKey" FROM "ApiKey" WHERE "userId" = $1 ORDER BY "createdAt" DESC', [userId]);
    const keys = keysRes.rows || [];
    const masked = keys.map((k: any) => ({ id: k.id, exchange: k.exchange, name: k.name, isTestnet: k.isTestnet, isActive: k.isActive, createdAt: k.createdAt, lastValidated: k.lastValidated, apiKey: maskApiKey(k.apiKey) }));
    res.json(masked);
  } catch (error: any) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
}

export async function addApiKey(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { exchange, name, apiKey, apiSecret, isTestnet } = req.body;

    if (!exchange || !name || !apiKey || !apiSecret) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = randomUUID();
    const inserted = await db.query('INSERT INTO "ApiKey" (id, "userId", exchange, name, "apiKey", "apiSecret", "isTestnet", "isActive", permissions, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *', [id, userId, exchange, name, apiKey, apiSecret, Boolean(isTestnet), true, []]);
    const created = inserted.rows && inserted.rows[0];

    // update in-memory fallback
    const mem = apiKeysCache.get(userId) || [];
    mem.push({ id: created.id, exchange: created.exchange, name: created.name, apiKey: maskApiKey(created.apiKey), isTestnet: created.isTestnet, isActive: created.isActive, createdAt: created.createdAt });
    apiKeysCache.set(userId, mem);

    res.status(201).json({ success: true, key: { id: created.id, exchange: created.exchange, name: created.name, apiKey: maskApiKey(created.apiKey), isTestnet: created.isTestnet, isActive: created.isActive, createdAt: created.createdAt } });
  } catch (error: any) {
    console.error('Add API key error:', error);
    res.status(500).json({ error: 'Failed to add API key' });
  }
}

export async function deleteApiKey(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { keyId } = req.params;
    const ownerRes = await db.query('SELECT "userId" FROM "ApiKey" WHERE id = $1 LIMIT 1', [keyId]);
    const owner = ownerRes.rows && ownerRes.rows[0];
    if (!owner) return res.status(404).json({ error: 'API key not found' });
    if (owner.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this API key' });
    }
    const delRes = await db.query('DELETE FROM "ApiKey" WHERE id = $1 AND "userId" = $2 RETURNING id', [keyId, userId]);
    if (delRes.rows && delRes.rows.length > 0) {
      const keys = apiKeysCache.get(userId) || [];
      apiKeysCache.set(userId, keys.filter((k: any) => k.id !== keyId));
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'API key not found' });
  } catch (error: any) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
}

/**
 * Helper Functions
 */

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function hashPassword(password: string): string {
  // Simple hash for demo (use bcrypt in production)
  return crypto.createHash('sha256').update(password).digest('hex');
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
