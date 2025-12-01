/**
 * Signal Backtesting API Routes
 * 
 * Endpoints for validating trading signals against historical data
 */

import express, { type Request, type Response } from 'express';
import { getBacktester, BacktestSignal } from '../services/signal-backtester';

const router = express.Router();
const backtester = getBacktester();

/**
 * POST /api/backtest/signal
 * 
 * Backtest a single signal
 */
router.post('/signal', async (req: Request, res: Response) => {
  try {
    const { signal, historicalData, timeoutMinutes = 60 } = req.body;

    if (!signal || !historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({
        error: 'Invalid request',
        required: ['signal', 'historicalData']
      });
    }

    if (historicalData.length < 5) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'At least 5 candles required for backtesting'
      });
    }

    const result = backtester.backtestSignal(signal, historicalData, timeoutMinutes);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Backtest failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/backtest/signals
 * 
 * Backtest multiple signals
 */
router.post('/signals', async (req: Request, res: Response) => {
  try {
    const { signals, historicalData, timeoutMinutes = 60 } = req.body;

    if (!signals || !Array.isArray(signals) || !historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({
        error: 'Invalid request',
        required: ['signals (array)', 'historicalData (array)']
      });
    }

    if (historicalData.length < 5) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'At least 5 candles required for backtesting'
      });
    }

    const results = backtester.backtestSignals(signals, historicalData);
    const stats = backtester.getStats();

    res.json({
      success: true,
      results,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Batch backtest failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/backtest/stats
 * 
 * Get backtest statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;
    const stats = backtester.getStats(symbol as string | undefined);

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get stats',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/backtest/history
 * 
 * Get backtest history
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const { symbol, limit = '100' } = req.query;
    const history = backtester.getHistory(
      symbol as string | undefined,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      count: history.length,
      history,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch history',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/backtest/export
 * 
 * Export backtest results
 */
router.post('/export', (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.body;

    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json({
        error: 'Invalid format',
        supported: ['json', 'csv']
      });
    }

    const exported = backtester.exportResults(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="backtest-results.csv"');
    } else {
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(exported);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Export failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/backtest/prune
 * 
 * Clean up old backtest results
 */
router.post('/prune', (req: Request, res: Response) => {
  try {
    const { daysToKeep = 30 } = req.body;
    backtester.pruneOldResults(daysToKeep);

    res.json({
      success: true,
      message: `Pruned backtest results older than ${daysToKeep} days`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Prune failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
