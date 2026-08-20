/**
 * User Settings Routes
 * Handles all user profile, preferences, trading, dashboard, advanced, and security settings
 */

import { Router, Request, Response, NextFunction, type ErrorRequestHandler } from 'express';
import {
  updateProfile,
  changePassword,
  deleteAccount,
  getPreferences,
  updatePreferences,
  getTradingSettings,
  updateTradingSettings,
  getDashboardSettings,
  updateDashboardSettings,
  getAdvancedSettings,
  updateAdvancedSettings,
  getSecuritySettings,
  updateSecuritySettings,
  getLoginSessions,
  revokeSession,
  getActivityLogs,
  exportUserData,
  getApiKeys,
  addApiKey,
  deleteApiKey,
  getUserSettingsAuditSnapshot,
} from '../controllers/user-settings-controller';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { requireTradingOperator } from '../middleware/require-trading-operator';
import { auditOperatorAction } from '../middleware/audit-operator-action';

const router = Router();

// Async middleware wrapper to handle promise rejection
const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const validTimeframes = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function boundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function finiteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validateBody(
  validator: (body: Record<string, unknown>) => boolean,
  message: string,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isRecord(req.body) || !validator(req.body)) {
      return res.status(400).json({ error: message });
    }
    next();
  };
}

const validateProfile = validateBody((body) =>
  hasOnlyKeys(body, ['firstName', 'lastName', 'email']) &&
  (body.firstName === undefined || boundedString(body.firstName, 100)) &&
  (body.lastName === undefined || boundedString(body.lastName, 100)) &&
  (body.email === undefined || boundedString(body.email, 320)),
  'Invalid profile payload',
);

const validatePreferences = validateBody((body) =>
  hasOnlyKeys(body, [
    'theme', 'defaultTimeframe', 'defaultExchange', 'notificationsEnabled',
    'emailAlerts', 'priceAlerts', 'signalAlerts', 'soundEnabled',
  ]) &&
  (body.theme === undefined || body.theme === 'light' || body.theme === 'dark') &&
  (body.defaultTimeframe === undefined ||
    (typeof body.defaultTimeframe === 'string' && validTimeframes.has(body.defaultTimeframe))) &&
  (body.defaultExchange === undefined || boundedString(body.defaultExchange, 32)) &&
  ['notificationsEnabled', 'emailAlerts', 'priceAlerts', 'signalAlerts', 'soundEnabled']
    .every((key) => body[key] === undefined || typeof body[key] === 'boolean'),
  'Invalid preferences payload',
);

const validateTradingSettings = validateBody((body) =>
  hasOnlyKeys(body, [
    'positionSize', 'defaultStopLoss', 'defaultTakeProfit', 'orderType',
    'slippageTolerance', 'commissionRate', 'riskRewardRatio', 'maxDailyLoss',
    'maxPositionsOpen',
  ]) &&
  (body.positionSize === undefined || finiteNumber(body.positionSize, 0.000001, 100)) &&
  (body.defaultStopLoss === undefined || finiteNumber(body.defaultStopLoss, 0.000001, 50)) &&
  (body.defaultTakeProfit === undefined || finiteNumber(body.defaultTakeProfit, 0.000001, 500)) &&
  (body.orderType === undefined || body.orderType === 'MARKET' || body.orderType === 'LIMIT') &&
  (body.slippageTolerance === undefined || finiteNumber(body.slippageTolerance, 0, 10)) &&
  (body.commissionRate === undefined || finiteNumber(body.commissionRate, 0, 1)) &&
  (body.riskRewardRatio === undefined || finiteNumber(body.riskRewardRatio, 0.5, 10)) &&
  (body.maxDailyLoss === undefined || finiteNumber(body.maxDailyLoss, 0.000001, 100)) &&
  (body.maxPositionsOpen === undefined || finiteNumber(body.maxPositionsOpen, 1, 100)),
  'Invalid trading settings payload',
);

const validateDashboardSettings = validateBody((body) =>
  hasOnlyKeys(body, ['widgets', 'layoutName', 'defaultIndicators', 'refreshInterval']) &&
  (body.widgets === undefined ||
    (Array.isArray(body.widgets) && body.widgets.length <= 50 &&
      body.widgets.every((value) => boundedString(value, 64)))) &&
  (body.layoutName === undefined || boundedString(body.layoutName, 64)) &&
  (body.defaultIndicators === undefined ||
    (Array.isArray(body.defaultIndicators) && body.defaultIndicators.length <= 50 &&
      body.defaultIndicators.every((value) => boundedString(value, 64)))) &&
  (body.refreshInterval === undefined || finiteNumber(body.refreshInterval, 1, 3600)),
  'Invalid dashboard settings payload',
);

const validateAdvancedSettings = validateBody((body) =>
  hasOnlyKeys(body, [
    'apiRateLimit', 'webhookUrl', 'botScheduleEnabled', 'botScheduleStart',
    'botScheduleEnd', 'alertThrottling',
  ]) &&
  (body.apiRateLimit === undefined || finiteNumber(body.apiRateLimit, 1, 100000)) &&
  (body.webhookUrl === undefined || boundedString(body.webhookUrl, 2048)) &&
  (body.botScheduleEnabled === undefined || typeof body.botScheduleEnabled === 'boolean') &&
  (body.botScheduleStart === undefined || (boundedString(body.botScheduleStart, 5) && /^\d{2}:\d{2}$/.test(body.botScheduleStart))) &&
  (body.botScheduleEnd === undefined || (boundedString(body.botScheduleEnd, 5) && /^\d{2}:\d{2}$/.test(body.botScheduleEnd))) &&
  (body.alertThrottling === undefined || finiteNumber(body.alertThrottling, 0, 100000)),
  'Invalid advanced settings payload',
);

const validateSecuritySettings = validateBody((body) =>
  hasOnlyKeys(body, ['twoFactorEnabled', 'ipWhitelistEnabled', 'ipAddresses']) &&
  (body.twoFactorEnabled === undefined || typeof body.twoFactorEnabled === 'boolean') &&
  (body.ipWhitelistEnabled === undefined || typeof body.ipWhitelistEnabled === 'boolean') &&
  (body.ipAddresses === undefined ||
    (Array.isArray(body.ipAddresses) && body.ipAddresses.length <= 100 &&
      body.ipAddresses.every((value) => boundedString(value, 64)))),
  'Invalid security settings payload',
);

const validateApiKey = validateBody((body) =>
  hasOnlyKeys(body, ['exchange', 'name', 'apiKey', 'apiSecret', 'isTestnet']) &&
  boundedString(body.exchange, 32) &&
  boundedString(body.name, 100) &&
  boundedString(body.apiKey, 512) &&
  boundedString(body.apiSecret, 512) &&
  (body.isTestnet === undefined || typeof body.isTestnet === 'boolean'),
  'Invalid API key payload',
);

const validatePasswordBody = validateBody((body) =>
  hasOnlyKeys(body, ['currentPassword', 'newPassword']) &&
  boundedString(body.currentPassword, 512) &&
  boundedString(body.newPassword, 512),
  'Invalid password payload',
);

const validateSessionId = (req: Request, res: Response, next: NextFunction) => {
  if (!boundedString(req.params.sessionId, 128) || req.params.sessionId.length === 0) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  next();
};

const validateApiKeyId = (req: Request, res: Response, next: NextFunction) => {
  if (!boundedString(req.params.keyId, 128) || req.params.keyId.length === 0) {
    return res.status(400).json({ error: 'Invalid API key ID' });
  }
  next();
};

const operatorAudit = auditOperatorAction('config', {
  target: (req) => req.path.slice(0, 64),
  snapshot: (req) => getUserSettingsAuditSnapshot((req as AuthRequest).user?.id),
});

// Apply auth middleware to all routes
router.use(requireAuth);

// Profile Management
router.patch('/profile', validateProfile, asyncHandler(updateProfile));
router.post('/change-password', validatePasswordBody, asyncHandler(changePassword));
router.delete('/account', asyncHandler(deleteAccount));

// Preferences
router.get('/preferences', asyncHandler(getPreferences));
router.patch('/preferences', validatePreferences, asyncHandler(updatePreferences));

// Trading Settings
router.get('/trading-settings', asyncHandler(getTradingSettings));
router.patch('/trading-settings', requireTradingOperator, operatorAudit, validateTradingSettings, asyncHandler(updateTradingSettings));

// Dashboard Settings
router.get('/dashboard-settings', asyncHandler(getDashboardSettings));
router.patch('/dashboard-settings', validateDashboardSettings, asyncHandler(updateDashboardSettings));

// Advanced Settings
router.get('/advanced-settings', asyncHandler(getAdvancedSettings));
router.patch('/advanced-settings', validateAdvancedSettings, asyncHandler(updateAdvancedSettings));

// Security Settings
router.get('/security', asyncHandler(getSecuritySettings));
router.patch('/security', validateSecuritySettings, asyncHandler(updateSecuritySettings));

// Login Sessions
router.get('/login-sessions', asyncHandler(getLoginSessions));
router.post('/login-sessions/:sessionId/revoke', validateSessionId, asyncHandler(revokeSession));

// Activity Logs
router.get('/activity-logs', asyncHandler(getActivityLogs));

// Data Export
router.get('/export-data', asyncHandler(exportUserData));

// API Keys
router.get('/api-keys', asyncHandler(getApiKeys));
router.post('/api-keys', requireTradingOperator, operatorAudit, validateApiKey, asyncHandler(addApiKey));
router.delete('/api-keys/:keyId', requireTradingOperator, operatorAudit, validateApiKeyId, asyncHandler(deleteApiKey));

const handleUserSettingsError: ErrorRequestHandler = (_error, _req, res, _next) => {
  if (!res.headersSent) {
    res.status(500).json({ error: 'User settings request failed' });
  }
};

router.use(handleUserSettingsError);

export default router;
