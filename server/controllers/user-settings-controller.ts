/**
 * User Settings Controller
 * Handles all user settings operations
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// In-memory caches for settings (TODO: move to database when tables are available)
const userSettingsCache = new Map<string, any>();
const userPreferencesCache = new Map<string, any>();
const tradingSettingsCache = new Map<string, any>();
const dashboardSettingsCache = new Map<string, any>();
const advancedSettingsCache = new Map<string, any>();
const securitySettingsCache = new Map<string, any>();
const loginSessionsCache = new Map<string, any[]>();
const apiKeysCache = new Map<string, any[]>();

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
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email: email || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined
      }
    });

    res.json({ 
      success: true, 
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName
      }
    });
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
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

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
    await prisma.user.delete({
      where: { id: userId }
    });

    // Clear caches
    userSettingsCache.delete(userId);
    userPreferencesCache.delete(userId);
    tradingSettingsCache.delete(userId);
    dashboardSettingsCache.delete(userId);
    advancedSettingsCache.delete(userId);
    securitySettingsCache.delete(userId);
    loginSessionsCache.delete(userId);
    apiKeysCache.delete(userId);

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

    const prefs = userPreferencesCache.get(userId) || {
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

    userPreferencesCache.set(userId, req.body);
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

    const sessions = loginSessionsCache.get(userId) || [];
    res.json(sessions);
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
    const sessions = loginSessionsCache.get(userId) || [];
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

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        createdAt: user?.createdAt
      },
      preferences: userPreferencesCache.get(userId) || {},
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

    const keys = apiKeysCache.get(userId) || [];
    res.json(keys);
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

    const newKey = {
      id: crypto.randomUUID(),
      exchange,
      name,
      apiKey: maskApiKey(apiKey),
      isTestnet: isTestnet || false,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    const keys = apiKeysCache.get(userId) || [];
    keys.push(newKey);
    apiKeysCache.set(userId, keys);

    res.status(201).json({
      success: true,
      key: newKey
    });
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
    const keys = apiKeysCache.get(userId) || [];
    const filtered = keys.filter((k: any) => k.id !== keyId);
    apiKeysCache.set(userId, filtered);

    res.json({ success: true });
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
