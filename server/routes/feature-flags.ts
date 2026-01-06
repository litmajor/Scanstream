/**
 * Feature Flags API Routes
 * Exposes feature flag management endpoints
 * 
 * GET  /api/feature-flags              - List all flags
 * GET  /api/feature-flags/:flag        - Get single flag status
 * GET  /api/feature-flags/category/:cat - Get flags by category
 * POST /api/feature-flags/:flag/toggle - Toggle a flag (dev-only)
 * POST /api/feature-flags/reload       - Reload from environment (dev-only)
 */

import { Router, Request, Response } from 'express';
import {
  isFeatureEnabled,
  getAllFlags,
  getFlagsByCategory,
  setFeatureFlag,
  reloadFlagsFromEnv,
  FLAGS,
} from '../config/featureFlags';

const router = Router();

/**
 * Middleware: Check if running in dev mode (for toggle endpoints)
 */
const devOnly = (req: Request, res: Response, next: Function) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Feature flag toggling disabled in production',
    });
  }
  next();
};

/**
 * GET /api/feature-flags
 * List all feature flags with their current state
 */
router.get('/', (req: Request, res: Response) => {
  const flags = getAllFlags();
  const response = {
    timestamp: new Date().toISOString(),
    total: Object.keys(flags).length,
    environment: process.env.NODE_ENV || 'development',
    flags: flags,
  };
  res.json(response);
});

/**
 * GET /api/feature-flags/:flag
 * Check if a specific flag is enabled
 */
router.get('/:flag', (req: Request, res: Response) => {
  const flagName = req.params.flag;
  const flags = getAllFlags();

  if (!flags[flagName]) {
    return res.status(404).json({
      error: `Flag '${flagName}' not found`,
      available_flags: Object.keys(flags),
    });
  }

  res.json({
    flag: flagName,
    enabled: isFeatureEnabled(flagName),
    description: flags[flagName].description,
    category: flags[flagName].category,
  });
});

/**
 * GET /api/feature-flags/category/:category
 * Get all flags in a specific category
 */
router.get(
  '/category/:category',
  (req: Request, res: Response) => {
    const category = req.params.category as any;
    const validCategories = ['strategy', 'service', 'analysis', 'experimental', 'admin'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category: ${category}`,
        valid_categories: validCategories,
      });
    }

    const flags = getFlagsByCategory(category);
    res.json({
      category,
      count: Object.keys(flags).length,
      flags,
    });
  }
);

/**
 * POST /api/feature-flags/:flag/toggle
 * Toggle a feature flag on/off (dev-only)
 */
router.post('/:flag/toggle', devOnly, (req: Request, res: Response) => {
  const flagName = req.params.flag;
  const flags = getAllFlags();

  if (!flags[flagName]) {
    return res.status(404).json({
      error: `Flag '${flagName}' not found`,
      available_flags: Object.keys(flags),
    });
  }

  const oldState = isFeatureEnabled(flagName);
  const newState = !oldState;
  setFeatureFlag(flagName, newState);

  res.json({
    flag: flagName,
    previous_state: oldState,
    new_state: newState,
    description: flags[flagName].description,
  });
});

/**
 * POST /api/feature-flags/:flag/set
 * Set a feature flag to a specific state (dev-only)
 */
router.post('/:flag/set', devOnly, (req: Request, res: Response) => {
  const flagName = req.params.flag;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      error: 'Request body must include "enabled" boolean field',
    });
  }

  const flags = getAllFlags();
  if (!flags[flagName]) {
    return res.status(404).json({
      error: `Flag '${flagName}' not found`,
      available_flags: Object.keys(flags),
    });
  }

  const oldState = isFeatureEnabled(flagName);
  setFeatureFlag(flagName, enabled);

  res.json({
    flag: flagName,
    previous_state: oldState,
    new_state: enabled,
    description: flags[flagName].description,
  });
});

/**
 * POST /api/feature-flags/reload
 * Reload all flags from environment variables (dev-only)
 */
router.post('/reload', devOnly, (req: Request, res: Response) => {
  reloadFlagsFromEnv();
  const flags = getAllFlags();

  res.json({
    message: 'Feature flags reloaded from environment',
    timestamp: new Date().toISOString(),
    total_flags: Object.keys(flags).length,
    flags: flags,
  });
});

/**
 * POST /api/feature-flags/reset
 * Reset all flags to defaults (dev-only)
 */
router.post('/reset', devOnly, (req: Request, res: Response) => {
  // Import here to avoid circular dependency
  const { resetAllFlags } = require('../config/featureFlags');
  resetAllFlags();
  const flags = getAllFlags();

  res.json({
    message: 'All feature flags reset to defaults',
    timestamp: new Date().toISOString(),
    total_flags: Object.keys(flags).length,
    flags: flags,
  });
});

export default router;
