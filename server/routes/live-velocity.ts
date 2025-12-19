/**
 * Live Velocity API Routes
 * 
 * Endpoints for fetching real-time velocity profiles and regime detection
 * 
 * GET /api/velocity/live/:symbol - Fetch live velocity profile
 * GET /api/velocity/regime/:symbol - Get current regime + velocity
 * GET /api/velocity/regimes/:symbol - Compare velocity across regimes
 * GET /api/velocity/cache - Show cache statistics
 * POST /api/velocity/clear-cache - Clear cache (manual refresh)
 */

import express, { Router, Request, Response } from 'express';
import { liveVelocityCalculator } from '../services/live-velocity-calculator';
import { AssetVelocityProfiler } from '../services/asset-velocity-profile';

const router = Router();
const velocityProfiler = new AssetVelocityProfiler();

/**
 * Initialize live calculator on startup
 */
export async function initializeLiveVelocityRoutes() {
  await velocityProfiler.initializeLiveCalculator();
}

/**
 * GET /api/velocity/live/:symbol
 * 
 * Fetch live velocity profile for an asset
 * 
 * Query params:
 * - lookbackDays: number (default: 365)
 * - regime: 'BULL' | 'BEAR' | 'SIDEWAYS' (optional)
 * 
 * Example:
 * GET /api/velocity/live/BTC?lookbackDays=365
 * GET /api/velocity/live/BTC/USDT?regime=BULL&lookbackDays=730
 */
router.get('/live/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;
    const regime = req.query.regime as 'BULL' | 'BEAR' | 'SIDEWAYS' | undefined;

    console.log(
      `[VelocityAPI] Fetching live velocity for ${symbol} (${lookbackDays}D, regime: ${regime || 'auto'})`
    );

    const profile = await velocityProfiler.getVelocityProfileLive(
      symbol,
      lookbackDays,
      regime
    );

    res.json({
      success: true,
      symbol,
      lookbackDays,
      regime: regime || 'auto',
      profile,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[VelocityAPI] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/velocity/regime/:symbol
 * 
 * Get current market regime + velocity profile for that regime
 * 
 * Query params:
 * - lookbackDays: number (default: 365)
 * 
 * Returns:
 * - Current regime (BULL/BEAR/SIDEWAYS)
 * - Volatility level
 * - Trend strength
 * - Velocity metrics for that regime
 * 
 * Example:
 * GET /api/velocity/regime/BTC
 * GET /api/velocity/regime/ETH?lookbackDays=730
 */
router.get('/regime/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 365;

    console.log(`[VelocityAPI] Detecting regime for ${symbol}`);

    const result = await velocityProfiler.getVelocityProfileRegimeAware(
      symbol,
      lookbackDays
    );

    res.json({
      success: true,
      symbol,
      lookbackDays,
      regime: result.regime,
      profile: result.profile,
      note: `Velocity profile calculated for ${result.regime} regime only`,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[VelocityAPI] Regime detection error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/velocity/regimes/:symbol
 * 
 * Compare velocity profiles across BULL, BEAR, and SIDEWAYS regimes
 * Shows how velocity changes depending on market regime
 * 
 * Query params:
 * - lookbackDays: number (default: 730 = 2 years)
 * 
 * Returns:
 * - bull: VelocityProfile for bull regime
 * - bear: VelocityProfile for bear regime
 * - sideways: VelocityProfile for sideways regime
 * 
 * Example:
 * GET /api/velocity/regimes/BTC
 * GET /api/velocity/regimes/ETH?lookbackDays=1095
 */
router.get('/regimes/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const lookbackDays = parseInt(req.query.lookbackDays as string) || 730;

    console.log(`[VelocityAPI] Comparing regimes for ${symbol}`);

    const regimes = await velocityProfiler.compareRegimeVelocities(
      symbol,
      lookbackDays
    );

    // Format response to show key differences
    const comparison = {
      '1D': {
        bull: {
          avgMove: regimes.bull['1D'].avgDollarMove,
          p75: regimes.bull['1D'].p75,
        },
        bear: {
          avgMove: regimes.bear['1D'].avgDollarMove,
          p75: regimes.bear['1D'].p75,
        },
        sideways: {
          avgMove: regimes.sideways['1D'].avgDollarMove,
          p75: regimes.sideways['1D'].p75,
        },
      },
      '7D': {
        bull: {
          avgMove: regimes.bull['7D'].avgDollarMove,
          p75: regimes.bull['7D'].p75,
        },
        bear: {
          avgMove: regimes.bear['7D'].avgDollarMove,
          p75: regimes.bear['7D'].p75,
        },
        sideways: {
          avgMove: regimes.sideways['7D'].avgDollarMove,
          p75: regimes.sideways['7D'].p75,
        },
      },
      '30D': {
        bull: {
          avgMove: regimes.bull['30D'].avgDollarMove,
          p75: regimes.bull['30D'].p75,
        },
        bear: {
          avgMove: regimes.bear['30D'].avgDollarMove,
          p75: regimes.bear['30D'].p75,
        },
        sideways: {
          avgMove: regimes.sideways['30D'].avgDollarMove,
          p75: regimes.sideways['30D'].p75,
        },
      },
    };

    res.json({
      success: true,
      symbol,
      lookbackDays,
      message: 'Velocity varies by regime - use appropriate targets per market condition',
      comparison,
      fullProfiles: regimes,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[VelocityAPI] Regime comparison error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/velocity/cache
 * 
 * Show cache statistics and what's currently cached
 */
router.get('/cache', (req: Request, res: Response) => {
  try {
    const stats = liveVelocityCalculator.getCacheStats();

    res.json({
      success: true,
      cache: stats,
      note: 'Cache TTL is 24 hours. Clear to fetch fresh data.',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/velocity/clear-cache
 * 
 * Clear velocity cache (all or for specific symbol)
 * 
 * Body:
 * {
 *   "symbol": "BTC" // optional - if not provided, clears all
 * }
 */
router.post('/clear-cache', (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;

    if (symbol) {
      liveVelocityCalculator.clearCache(symbol);
      res.json({
        success: true,
        message: `Cleared cache for ${symbol}`,
      });
    } else {
      liveVelocityCalculator.clearCache();
      res.json({
        success: true,
        message: 'Cleared all cache',
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/velocity/info
 * 
 * Info about velocity API capabilities
 */
router.get('/info', (req: Request, res: Response) => {
  res.json({
    service: 'Live Velocity Calculator',
    description:
      'Fetches real-time historical data and calculates velocity profiles on-demand',
    endpoints: {
      'GET /api/velocity/live/:symbol':
        'Fetch live velocity profile (optional: ?lookbackDays=365&regime=BULL)',
      'GET /api/velocity/regime/:symbol':
        'Get current regime + velocity for that regime (?lookbackDays=365)',
      'GET /api/velocity/regimes/:symbol':
        'Compare velocity across BULL/BEAR/SIDEWAYS (?lookbackDays=730)',
      'GET /api/velocity/cache': 'Show current cache statistics',
      'POST /api/velocity/clear-cache': 'Clear cache (body: {symbol?: string})',
      'GET /api/velocity/info': 'This endpoint',
    },
    features: [
      'Real-time data fetching from Polygon.io API',
      'Automatic regime detection (BULL/BEAR/SIDEWAYS)',
      'Compare velocity across regimes',
      '24-hour caching to minimize API calls',
      'Fallback to conservative defaults if API unavailable',
    ],
    dataSource: 'Polygon.io Daily OHLCV candles',
    cacheTTL: '24 hours',
    examples: {
      liveProfile: 'GET /api/velocity/live/BTC?lookbackDays=365',
      regimeProfile: 'GET /api/velocity/regime/ETH?lookbackDays=730',
      regimeComparison: 'GET /api/velocity/regimes/BTC?lookbackDays=1095',
    },
  });
});

export default router;
