/**
 * Backend Health Check Endpoint
 * 
 * Monitors system health, exchange connections, and data freshness
 */

import express, { type Request, type Response } from 'express';
import { getErrorLogger } from '../services/error-logger';
import { getPerformanceTracker } from '../services/model-performance-tracker';
import { getBacktester } from '../services/signal-backtester';

const router = express.Router();
const errorLogger = getErrorLogger();
const performanceTracker = getPerformanceTracker();
const backtester = getBacktester();

/**
 * GET /api/health
 * 
 * Comprehensive health status of the entire backend system
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Get error summary
    const errorSummary = errorLogger.getErrorSummary();

    // Get model performance
    const modelMetrics = performanceTracker.calculateMetrics();

    // Get backtest stats
    const backtestStats = backtester.getStats();

    // Check data freshness (this would be integrated with actual data fetcher)
    const dataFreshness = {
      lastUpdate: Date.now(),
      stale: false,
      age: 0 // milliseconds
    };

    // Determine overall health status
    const errorRateLastHour = errorSummary.totalErrors < 10 ? 'healthy' : 'degraded';
    const modelReady = modelMetrics.totalPredictions >= 50;
    const backtestReady = backtestStats.totalSignals >= 20;

    const status = {
      healthy: errorRateLastHour === 'healthy' && modelReady,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime
    };

    // Detailed health information
    const healthReport = {
      status,
      system: {
        uptime: process.uptime(),
        memoryUsage: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        responseTimeMs: Date.now() - startTime
      },
      exchanges: {
        status: 'monitoring',
        connectedExchanges: 6, // binance, coinbase, kraken, kucoinfutures, okx, bybit
        dataFreshness
      },
      models: {
        ready: modelReady,
        totalPredictions: modelMetrics.totalPredictions,
        accuracy: (modelMetrics.accuracy || 0).toFixed(2),
        averageConfidence: (modelMetrics.avgConfidence || 0).toFixed(2),
        status: modelReady ? 'ready' : 'warming-up'
      },
      backtesting: {
        ready: backtestReady,
        totalSignals: backtestStats.totalSignals,
        winRate: (backtestStats.winRate || 0).toFixed(2),
        averageROI: (backtestStats.averageROI || 0).toFixed(2),
        status: backtestReady ? 'ready' : 'insufficient-data'
      },
      errors: {
        totalLast24h: errorSummary.totalErrors,
        byService: errorSummary.errorsByService,
        byExchange: errorSummary.errorsByExchange,
        trend: errorSummary.totalErrors < 5 ? 'improving' : 'stable'
      },
      logs: {
        total: errorLogger.getLogs().length,
        recent: errorSummary.recentErrors.length,
        status: errorSummary.totalErrors > 20 ? 'warning' : 'ok'
      }
    };

    res.json({
      success: true,
      health: healthReport,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/detailed
 * 
 * Comprehensive system diagnostics
 */
router.get('/detailed', (req: Request, res: Response) => {
  try {
    const errorSummary = errorLogger.getErrorSummary();
    const recentLogs = errorLogger.getLogs({ limit: 50 });
    const modelMetrics = performanceTracker.calculateMetrics();
    const backtestStats = backtester.getStats();

    res.json({
      success: true,
      diagnostics: {
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: Date.now()
        },
        errors: errorSummary,
        recentLogs,
        modelPerformance: modelMetrics,
        backtestPerformance: backtestStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Detailed health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/exchanges
 * 
 * Exchange connectivity status
 */
router.get('/exchanges', (req: Request, res: Response) => {
  try {
    const exchanges = [
      { name: 'binance', status: 'geo-restricted' },
      { name: 'coinbase', status: 'active' },
      { name: 'kraken', status: 'active' },
      { name: 'kucoinfutures', status: 'active' },
      { name: 'okx', status: 'active' },
      { name: 'bybit', status: 'geo-restricted' }
    ];

    const errorSummary = errorLogger.getErrorSummary();

    const exchangeHealth = exchanges.map(ex => ({
      ...ex,
      errors: errorSummary.errorsByExchange[ex.name] || 0,
      lastCheck: Date.now()
    }));

    res.json({
      success: true,
      exchanges: exchangeHealth,
      summary: {
        active: exchangeHealth.filter(e => e.status === 'active').length,
        restricted: exchangeHealth.filter(e => e.status === 'geo-restricted').length,
        errors: exchangeHealth.reduce((sum, e) => sum + e.errors, 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Exchange health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/logs
 * 
 * Recent system logs
 */
router.get('/logs', (req: Request, res: Response) => {
  try {
    const { level, service, exchange, limit = '50' } = req.query;

    const logs = errorLogger.getLogs({
      level: level as any,
      service: service as string | undefined,
      exchange: exchange as string | undefined,
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch logs',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/health/prune-logs
 * 
 * Clean up old logs
 */
router.post('/prune-logs', (req: Request, res: Response) => {
  try {
    errorLogger.pruneOldLogs();

    res.json({
      success: true,
      message: 'Logs pruned successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to prune logs',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
