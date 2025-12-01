import type { Express } from 'express';
import { assetVelocityProfiler } from '../services/asset-velocity-profile';
import { ALL_TRACKED_ASSETS } from '@shared/tracked-assets';

export function registerVelocityProfileRoutes(app: Express) {
  /**
   * GET /api/velocity/all
   * Returns velocity profiles for all tracked assets
   */
  app.get('/api/velocity/all', (req, res) => {
    try {
      const assets = ALL_TRACKED_ASSETS;
      const profiles: Record<string, any> = {};

      for (const asset of assets) {
        const symbol = asset.symbol;
        const profile = assetVelocityProfiler.getVelocityProfile(symbol);
        profiles[symbol] = profile;
      }

      res.json({
        success: true,
        count: assets.length,
        data: profiles,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch velocity profiles'
      });
    }
  });

  /**
   * GET /api/velocity/:symbol
   * Returns velocity profile for a specific asset
   */
  app.get('/api/velocity/:symbol', (req, res) => {
    try {
      const { symbol } = req.params;
      const profile = assetVelocityProfiler.getVelocityProfile(symbol);

      res.json({
        success: true,
        symbol,
        data: profile,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch velocity profile'
      });
    }
  });

  /**
   * GET /api/velocity/:symbol/target
   * Calculate profit target for a specific trade
   */
  app.get('/api/velocity/:symbol/target', (req, res) => {
    try {
      const { symbol } = req.params;
      const { entryPrice, tradeType = 'SWING' } = req.query;

      if (!entryPrice) {
        return res.status(400).json({
          success: false,
          error: 'entryPrice query parameter required'
        });
      }

      const entry = parseFloat(entryPrice as string);
      if (isNaN(entry)) {
        return res.status(400).json({
          success: false,
          error: 'entryPrice must be a valid number'
        });
      }

      const velocity = assetVelocityProfiler.getVelocityProfile(symbol);
      const target = assetVelocityProfiler.calculateProfitTarget(
        symbol,
        entry,
        tradeType as 'SCALP' | 'DAY' | 'SWING' | 'POSITION',
        velocity
      );
      const stop = assetVelocityProfiler.calculateStopLoss(
        symbol,
        entry,
        tradeType as string,
        velocity
      );

      res.json({
        success: true,
        symbol,
        entryPrice: entry,
        tradeType,
        profitTarget: target,
        stopLoss: stop,
        targetPercent: ((target - entry) / entry) * 100,
        stopPercent: ((entry - stop) / entry) * 100,
        velocityData: {
          '1D': {
            p75: velocity['1D'].p75,
            avgMove: velocity['1D'].avgDollarMove
          },
          '7D': {
            p75: velocity['7D'].p75,
            avgMove: velocity['7D'].avgDollarMove
          },
          '21D': {
            p90: velocity['21D'].p90,
            avgMove: velocity['21D'].avgDollarMove
          }
        },
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate profit target'
      });
    }
  });
}
