import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// In-memory store (in production, use database)
const userPreferences = new Map<string, any>();

const FilterPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  criteria: z.object({
    signalType: z.string(),
    minStrength: z.number(),
    maxStrength: z.number(),
    trendDirection: z.string(),
    exchanges: z.array(z.string()),
    sources: z.array(z.string()),
    timeframe: z.string(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    minChange: z.number().optional(),
    maxChange: z.number().optional(),
    minRSI: z.number().optional(),
    maxRSI: z.number().optional(),
    hasStopLoss: z.boolean(),
    hasTakeProfit: z.boolean(),
  }),
  isFavorite: z.boolean(),
  createdAt: z.number(),
});

// Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default';
    let prefs = userPreferences.get(userId);

    // If no preferences found for the user, set default preferences
    if (!prefs) {
      prefs = {
        filterPresets: [],
        theme: 'dark',
        defaultTimeframe: '1h',
        defaultExchange: 'binance', // Added default exchange
        notificationsEnabled: true, // Added notification settings
        emailAlerts: false,
        priceAlerts: true,
        signalAlerts: true,
        soundEnabled: true,
      };
      userPreferences.set(userId, prefs);
    }

    res.json(prefs);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Save filter preset
router.post('/preferences/filter-presets', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default';
    const preset = FilterPresetSchema.parse(req.body);

    const prefs = userPreferences.get(userId) || { filterPresets: [] };
    const existing = prefs.filterPresets || [];

    // Check if preset with same ID exists
    const index = existing.findIndex((p: any) => p.id === preset.id);
    if (index >= 0) {
      existing[index] = preset;
    } else {
      existing.push(preset);
    }

    prefs.filterPresets = existing;
    userPreferences.set(userId, prefs);

    res.json({ success: true, preset });
  } catch (error) {
    console.error('Error saving filter preset:', error);
    res.status(400).json({ error: 'Invalid preset data' });
  }
});

// Delete filter preset
router.delete('/preferences/filter-presets/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default';
    const { id } = req.params;

    const prefs = userPreferences.get(userId) || { filterPresets: [] };
    prefs.filterPresets = (prefs.filterPresets || []).filter((p: any) => p.id !== id);
    userPreferences.set(userId, prefs);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting filter preset:', error);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Update user settings
router.post('/preferences/settings', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default';
    const settings = req.body;

    const prefs = userPreferences.get(userId) || {};
    Object.assign(prefs, settings);
    userPreferences.set(userId, prefs);

    res.json({ success: true, settings: prefs });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;