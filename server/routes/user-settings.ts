/**
 * User Settings Routes
 * Handles all user profile, preferences, trading, dashboard, advanced, and security settings
 */

import { Router, Request, Response, NextFunction } from 'express';
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
} from '../controllers/user-settings-controller';

// Simple auth middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated (this will be set by Express auth)
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const router = Router();

// Async middleware wrapper to handle promise rejection
const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply auth middleware to all routes
router.use(requireAuth);

// Profile Management
router.patch('/profile', asyncHandler(updateProfile));
router.post('/change-password', asyncHandler(changePassword));
router.delete('/account', asyncHandler(deleteAccount));

// Preferences
router.get('/preferences', asyncHandler(getPreferences));
router.patch('/preferences', asyncHandler(updatePreferences));

// Trading Settings
router.get('/trading-settings', asyncHandler(getTradingSettings));
router.patch('/trading-settings', asyncHandler(updateTradingSettings));

// Dashboard Settings
router.get('/dashboard-settings', asyncHandler(getDashboardSettings));
router.patch('/dashboard-settings', asyncHandler(updateDashboardSettings));

// Advanced Settings
router.get('/advanced-settings', asyncHandler(getAdvancedSettings));
router.patch('/advanced-settings', asyncHandler(updateAdvancedSettings));

// Security Settings
router.get('/security', asyncHandler(getSecuritySettings));
router.patch('/security', asyncHandler(updateSecuritySettings));

// Login Sessions
router.get('/login-sessions', asyncHandler(getLoginSessions));
router.post('/login-sessions/:sessionId/revoke', asyncHandler(revokeSession));

// Activity Logs
router.get('/activity-logs', asyncHandler(getActivityLogs));

// Data Export
router.get('/export-data', asyncHandler(exportUserData));

// API Keys
router.get('/api-keys', asyncHandler(getApiKeys));
router.post('/api-keys', asyncHandler(addApiKey));
router.delete('/api-keys/:keyId', asyncHandler(deleteApiKey));

export default router;
