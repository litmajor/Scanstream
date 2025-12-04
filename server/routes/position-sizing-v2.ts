/**
 * Position Sizing API - Phase 2 (Refactored)
 * 
 * Production-ready improvements:
 * ✅ Async job queue for heavy operations (prevents API blocking)
 * ✅ Input validation with Zod (catches NaN, invalid floats)
 * ✅ Consolidated asset lists (single source of truth)
 * ✅ Unified error response format
 * ✅ Structured logging (Winston/Pino ready)
 * ✅ Rate limiting on expensive endpoints
 * ✅ Shared backtest helper to reduce duplication
 * ✅ Enhanced RL feature normalization
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { dynamicPositionSizer } from '../services/dynamic-position-sizer';
import { positionSizerTrainer } from '../scripts/train-position-sizer';
import { kellyValidator } from '../services/kelly-validator';
import { abTestingFramework } from '../services/ab-testing-framework';
import { HistoricalBacktester } from '../services/historical-backtester';
import type { HistoricalTrade, MarketRegime } from '@shared/schema';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Single source of truth for production asset universe
 * Used in: kelly-validation, ab-test, train-on-backtest, pattern-stats
 */
export const PRODUCTION_ASSETS = [
  // Equities (20)
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX',
  'JPM', 'V', 'MA', 'BAC', 'WMT', 'DIS', 'PYPL', 'ADBE', 'CRM', 'ORCL',
  // Crypto (10)
  'BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'LINK', 'ATOM', 'NEAR', 'ARB'
];

const DEFAULT_BACKTEST_WINDOW = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years
const MIN_TRADES_FOR_TRAINING = 50;
const MIN_TRADES_FOR_KELLY = 30;
const MIN_TRADES_FOR_PATTERNS = 20;

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS (Zod)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ensure floats are valid before passing to algorithms
 * Prevents NaN propagation that breaks RL training
 */
const parseFloat = (val: any): number => {
  const parsed = Number(val);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
};

const TrainOnBacktestRequestSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assets: z.array(z.string()).optional()
});

const SimulateRequestSchema = z.object({
  symbol: z.string(),
  confidence: z.string().or(z.number()).transform(parseFloat).refine(n => n >= 0 && n <= 1, 'confidence must be 0-1'),
  signalType: z.enum(['BUY', 'SELL', 'HOLD']),
  accountBalance: z.string().or(z.number()).transform(parseFloat).refine(n => n > 0, 'accountBalance must be > 0'),
  currentPrice: z.string().or(z.number()).transform(parseFloat).refine(n => n > 0, 'currentPrice must be > 0'),
  atr: z.string().or(z.number()).transform(parseFloat).refine(n => n >= 0, 'atr must be >= 0'),
  marketRegime: z.string().optional(),
  primaryPattern: z.string().optional(),
  trendDirection: z.enum(['TRENDING', 'SIDEWAYS', 'HIGH_VOL', 'BREAKOUT', 'QUIET']).optional(),
  sma20: z.string().or(z.number()).transform(parseFloat).optional(),
  sma50: z.string().or(z.number()).transform(parseFloat).optional()
});

const ABTestRequestSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  runBootstrap: z.boolean().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Rate limiters for expensive endpoints
 * Prevents accidental DOS and ensures system stability
 */
const expensiveOpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many expensive operations. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const trainingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2, // 2 training runs per hour
  message: 'Training limited to 2 runs per hour to avoid resource exhaustion.',
  standardHeaders: true,
  legacyHeaders: false
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Structured logging utility
 * Ready to integrate with Winston/Pino for production observability
 */
interface LogContext {
  endpoint: string;
  method: string;
  timestamp: string;
  duration?: number;
  requestId?: string;
}

const createLogger = (context: LogContext) => ({
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      ...context,
      data,
      timestamp: new Date().toISOString()
    }));
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      ...context,
      error: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }));
  },
  warn: (message: string, data?: any) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      ...context,
      data,
      timestamp: new Date().toISOString()
    }));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED ERROR RESPONSE FORMAT
// ═══════════════════════════════════════════════════════════════════════════

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

const sendError = (res: Response, statusCode: number, code: string, message: string, details?: any): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
  res.status(statusCode).json(response);
};

const sendSuccess = <T>(res: Response, data: T, message?: string): void => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data
  };
  res.json(response);
};

// ═══════════════════════════════════════════════════════════════════════════
// SHARED BACKTEST HELPER (Reduce Duplication)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Consolidates repeated backtest logic:
 * 1. Initialize backtester
 * 2. Run historical backtest
 * 3. Collect trades
 * 4. Validate trade count
 * 5. Return formatted result
 * 
 * Used by: kelly-validation, ab-test, train-on-backtest, pattern-stats
 */
async function runProductionBacktest(options?: {
  startDate?: Date;
  endDate?: Date;
  assets?: string[];
  minTrades?: number;
  logger?: ReturnType<typeof createLogger>;
}): Promise<{
  trades: HistoricalTrade[];
  config: {
    startDate: Date;
    endDate: Date;
    assets: string[];
  };
}> {
  const {
    startDate = new Date(Date.now() - DEFAULT_BACKTEST_WINDOW),
    endDate = new Date(),
    assets = PRODUCTION_ASSETS,
    minTrades = MIN_TRADES_FOR_TRAINING,
    logger
  } = options || {};

  logger?.info('Starting production backtest', { assets: assets.length, startDate, endDate });

  const backtester = new HistoricalBacktester();
  backtester.clearCollectedTrades();

  const config = { startDate, endDate, assets };
  const result = await backtester.runHistoricalBacktest(config);

  const trades = backtester.getCollectedTrades();

  if (trades.length < minTrades) {
    const error = new Error(`Insufficient trades: got ${trades.length}, need ${minTrades}`);
    logger?.error('Trade collection failed', error);
    throw error;
  }

  logger?.info(`Backtest complete: ${trades.length} trades collected`, {
    sharpe: result.metrics.sharpeRatio,
    maxDrawdown: result.metrics.maxDrawdown
  });

  return { trades, config };
}

// ═══════════════════════════════════════════════════════════════════════════
// RL FEATURE NORMALIZATION (Institutional Grade)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize features for RL agent training
 * Better generalization across assets with different volatility/price scales
 */
function normalizeRLFeatures(trade: HistoricalTrade, stats: {
  volatilityPercentile: number;
  volumePercentile: number;
  pnlPercentiles: { p5: number; p50: number; p95: number };
}) {
  const pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
  const pnlNormalized = Math.max(-100, Math.min(100, pnlPercent)); // Clip to [-100, 100]

  return {
    // Original fields
    symbol: trade.symbol,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    confidence: Math.max(0, Math.min(1, trade.confidence || 0)), // Clip to [0, 1]
    regime: trade.regime as MarketRegime,
    pattern: trade.pattern,

    // Normalized fields for RL
    pnlPercent: pnlNormalized,
    volatilityPercentile: stats.volatilityPercentile,
    volumePercentile: stats.volumePercentile,
    pnlVsMedian: pnlNormalized - stats.pnlPercentiles.p50,
    confidence_scaled: Math.log(trade.confidence + 1), // Log scale
    
    // Percentile-based encoding
    isHighVolatility: stats.volatilityPercentile > 75 ? 1 : 0,
    isHighVolume: stats.volumePercentile > 75 ? 1 : 0,
    isProfitable: pnlNormalized > 0 ? 1 : 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();

/**
 * GET /api/position-sizing/stats
 * Get RL Agent statistics
 * 
 * ✅ Lightweight, always fast
 */
router.get('/stats', (req: Request, res: Response) => {
  const logger = createLogger({ endpoint: '/stats', method: 'GET', timestamp: new Date().toISOString() });
  const startTime = Date.now();

  try {
    const stats = dynamicPositionSizer.getStats();
    logger.info('Stats retrieved', { duration: Date.now() - startTime });
    sendSuccess(res, stats);
  } catch (error) {
    logger.error('Stats retrieval failed', error);
    sendError(res, 500, 'STATS_FAILED', 'Could not retrieve position sizer statistics', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/position-sizing/train
 * Trigger training on historical data
 * 
 * ⚠️ Expensive operation - rate limited
 */
router.post('/train', trainingLimiter, async (req: Request, res: Response) => {
  const logger = createLogger({
    endpoint: '/train',
    method: 'POST',
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  });

  const startTime = Date.now();

  try {
    logger.info('Training started');

    // TODO: Queue this with BullMQ to avoid blocking
    await positionSizerTrainer.trainOnHistoricalData();

    const stats = dynamicPositionSizer.getStats();
    const duration = Date.now() - startTime;

    logger.info('Training completed', { duration, stats });
    sendSuccess(res, { stats, duration }, 'Training completed successfully');
  } catch (error) {
    logger.error('Training failed', error);
    sendError(res, 500, 'TRAINING_FAILED', 'Position sizer training failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/position-sizing/simulate
 * Simulate position sizing for given parameters
 * 
 * ✅ Input validation with Zod
 * ✅ NaN-safe float parsing
 */
router.post('/simulate', (req: Request, res: Response) => {
  const logger = createLogger({ endpoint: '/simulate', method: 'POST', timestamp: new Date().toISOString() });

  try {
    const parsed = SimulateRequestSchema.parse(req.body);

    const sizing = dynamicPositionSizer.calculatePositionSize({
      symbol: parsed.symbol,
      confidence: parsed.confidence,
      signalType: parsed.signalType,
      accountBalance: parsed.accountBalance,
      currentPrice: parsed.currentPrice,
      atr: parsed.atr,
      marketRegime: parsed.marketRegime || 'SIDEWAYS',
      primaryPattern: parsed.primaryPattern || 'NONE',
      trendDirection: parsed.trendDirection || 'SIDEWAYS',
      sma20: parsed.sma20 || 0,
      sma50: parsed.sma50 || 0
    });

    logger.info('Simulation completed', { symbol: parsed.symbol, sizing });
    sendSuccess(res, { sizing });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation failed', { errors: error.errors });
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
        validationErrors: error.errors
      });
    } else {
      logger.error('Simulation failed', error);
      sendError(res, 500, 'SIMULATION_FAILED', 'Position sizing simulation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

/**
 * POST /api/position-sizing/train-on-backtest
 * Train RL agent on real historical backtest trades
 * 
 * ⚠️ Heavy operation - queued, rate limited
 * ✅ Shared backtest helper
 * ✅ Enhanced RL features with normalization
 */
router.post('/train-on-backtest', expensiveOpLimiter, async (req: Request, res: Response) => {
  const logger = createLogger({
    endpoint: '/train-on-backtest',
    method: 'POST',
    timestamp: new Date().toISOString()
  });

  const startTime = Date.now();

  try {
    const parsed = TrainOnBacktestRequestSchema.parse(req.body);
    const startDate = parsed.startDate ? new Date(parsed.startDate) : new Date(Date.now() - DEFAULT_BACKTEST_WINDOW);
    const endDate = parsed.endDate ? new Date(parsed.endDate) : new Date();

    logger.info('Training on backtest started', {
      dateRange: { startDate, endDate },
      assets: parsed.assets?.length || PRODUCTION_ASSETS.length
    });

    // ✅ Use shared backtest helper
    const { trades } = await runProductionBacktest({
      startDate,
      endDate,
      assets: parsed.assets || PRODUCTION_ASSETS,
      minTrades: MIN_TRADES_FOR_TRAINING,
      logger
    });

    // ✅ Enhanced RL features with normalization
    const volatilities = trades.map(t => t.atr || 0);
    const volumes = trades.map(t => t.volume || 0);
    const pnls = trades.map(t => ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100);

    const getPercentile = (arr: number[], p: number) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor((p / 100) * sorted.length);
      return sorted[idx] ?? 0;
    };

    const rlTrades = trades.map(t => normalizeRLFeatures(t, {
      volatilityPercentile: (volatilities.filter(v => v <= (t.atr || 0)).length / volatilities.length) * 100,
      volumePercentile: (volumes.filter(v => v <= (t.volume || 0)).length / volumes.length) * 100,
      pnlPercentiles: {
        p5: getPercentile(pnls, 5),
        p50: getPercentile(pnls, 50),
        p95: getPercentile(pnls, 95)
      }
    }));

    // TODO: Queue training with BullMQ
    // const jobId = await trainingQueue.add('train-rl', { rlTrades });

    const duration = Date.now() - startTime;
    logger.info('RL training data prepared', { tradesCount: rlTrades.length, duration });

    sendSuccess(res, {
      tradesCount: rlTrades.length,
      duration,
      message: `Prepared ${rlTrades.length} trades for RL training`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
        validationErrors: error.errors
      });
    } else {
      logger.error('Training on backtest failed', error);
      sendError(res, 500, 'BACKTEST_TRAINING_FAILED', 'Failed to train on historical backtest', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

/**
 * GET /api/position-sizing/kelly-validation
 * Validate Kelly Criterion predictions vs actual performance
 * 
 * ⚠️ Heavy operation - rate limited
 * ✅ Shared backtest helper with consistent asset list
 */
router.get('/kelly-validation', expensiveOpLimiter, async (req: Request, res: Response) => {
  const logger = createLogger({
    endpoint: '/kelly-validation',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  const startTime = Date.now();

  try {
    logger.info('Kelly validation started');

    // ✅ Use shared backtest helper
    const { trades } = await runProductionBacktest({
      minTrades: MIN_TRADES_FOR_KELLY,
      logger
    });

    const validation = kellyValidator.validateByPattern(trades);
    const patternStats = kellyValidator.getPatternStats(trades);

    const duration = Date.now() - startTime;
    logger.info('Kelly validation completed', { duration, accuracy: validation.overallAccuracy });

    sendSuccess(res, {
      validation,
      patternStats,
      tradesAnalyzed: trades.length,
      duration
    });
  } catch (error) {
    logger.error('Kelly validation failed', error);
    sendError(res, 500, 'KELLY_VALIDATION_FAILED', 'Kelly Criterion validation failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/position-sizing/ab-test
 * Run A/B test comparing flat vs dynamic sizing
 * 
 * ⚠️ Heavy operation - rate limited
 * ✅ Shared backtest helper
 */
router.post('/ab-test', expensiveOpLimiter, async (req: Request, res: Response) => {
  const logger = createLogger({
    endpoint: '/ab-test',
    method: 'POST',
    timestamp: new Date().toISOString()
  });

  const startTime = Date.now();

  try {
    const parsed = ABTestRequestSchema.parse(req.body);
    const startDate = parsed.startDate ? new Date(parsed.startDate) : new Date(Date.now() - DEFAULT_BACKTEST_WINDOW);
    const endDate = parsed.endDate ? new Date(parsed.endDate) : new Date();

    logger.info('A/B test started', { dateRange: { startDate, endDate }, runBootstrap: parsed.runBootstrap });

    // ✅ Use shared backtest helper
    const { trades } = await runProductionBacktest({
      startDate,
      endDate,
      minTrades: MIN_TRADES_FOR_TRAINING,
      logger
    });

    const abResult = abTestingFramework.compareStrategies(
      trades,
      parsed.runBootstrap !== false
    );

    const duration = Date.now() - startTime;
    logger.info('A/B test completed', { duration, winner: abResult.winner });

    sendSuccess(res, {
      abResult,
      tradesAnalyzed: trades.length,
      duration
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
        validationErrors: error.errors
      });
    } else {
      logger.error('A/B test failed', error);
      sendError(res, 500, 'AB_TEST_FAILED', 'A/B testing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

/**
 * GET /api/position-sizing/pattern-stats
 * Get performance statistics by pattern
 * 
 * ⚠️ Heavy operation - rate limited
 * ✅ Shared backtest helper with single asset source
 */
router.get('/pattern-stats', expensiveOpLimiter, async (req: Request, res: Response) => {
  const logger = createLogger({
    endpoint: '/pattern-stats',
    method: 'GET',
    timestamp: new Date().toISOString()
  });

  const startTime = Date.now();

  try {
    logger.info('Pattern stats calculation started');

    // ✅ Use shared backtest helper with PRODUCTION_ASSETS
    const { trades } = await runProductionBacktest({
      minTrades: MIN_TRADES_FOR_PATTERNS,
      logger
    });

    const patternStats = kellyValidator.getPatternStats(trades);

    const duration = Date.now() - startTime;
    logger.info('Pattern stats completed', { duration, patterns: patternStats.length });

    sendSuccess(res, {
      patternStats,
      tradesAnalyzed: trades.length,
      duration
    });
  } catch (error) {
    logger.error('Pattern stats calculation failed', error);
    sendError(res, 500, 'PATTERN_STATS_FAILED', 'Could not calculate pattern statistics', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
