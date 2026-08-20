/**
 * Signal Backtesting API Routes
 * 
 * Endpoints for validating trading signals against historical data
 */

import express, { type Request, type Response } from 'express';
import { getBacktester, BacktestSignal } from '../services/signal-backtester';
import { requireAuth } from '../middleware/auth';

const router = express.Router();
const backtester = getBacktester();

function isValidCandle(value: unknown): value is {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candle = value as Record<string, unknown>;
  return ['timestamp', 'open', 'high', 'low', 'close', 'volume'].every(
    (key) => typeof candle[key] === 'number' && Number.isFinite(candle[key]),
  );
}

function isValidSignal(value: unknown): value is BacktestSignal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.symbol === 'string' &&
    candidate.symbol.length > 0 &&
    candidate.symbol.length <= 32 &&
    typeof candidate.timestamp === 'number' &&
    Number.isFinite(candidate.timestamp) &&
    (candidate.type === 'BUY' || candidate.type === 'SELL') &&
    typeof candidate.entryPrice === 'number' &&
    Number.isFinite(candidate.entryPrice) &&
    candidate.entryPrice > 0 &&
    typeof candidate.confidence === 'number' &&
    Number.isFinite(candidate.confidence) &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    typeof candidate.stopLoss === 'number' &&
    Number.isFinite(candidate.stopLoss) &&
    typeof candidate.takeProfit === 'number' &&
    Number.isFinite(candidate.takeProfit)
  );
}

/**
 * POST /api/backtest/signal
 * 
 * Backtest a single signal
 */
router.post('/signal', requireAuth, async (req: Request, res: Response) => {
  try {
    const { signal, historicalData, timeoutMinutes = 60 } = req.body;

    if (!isValidSignal(signal) || !historicalData || !Array.isArray(historicalData)) {
      return res.status(400).json({
        error: 'Invalid request',
        required: ['signal', 'historicalData']
      });
    }

    if (
      historicalData.length < 5 ||
      historicalData.length > 5000 ||
      historicalData.some((candle: unknown) => !isValidCandle(candle)) ||
      typeof timeoutMinutes !== 'number' ||
      !Number.isFinite(timeoutMinutes) ||
      timeoutMinutes < 1 ||
      timeoutMinutes > 240
    ) {
      return res.status(400).json({
        error: 'Invalid backtest bounds',
        message: 'historicalData must contain 5-5000 candles and timeoutMinutes must be 1-240'
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
router.post('/signals', requireAuth, async (req: Request, res: Response) => {
  try {
    const { signals, historicalData, timeoutMinutes = 60 } = req.body;

    if (
      !signals ||
      !Array.isArray(signals) ||
      !signals.every((candidate: unknown) => isValidSignal(candidate)) ||
      !historicalData ||
      !Array.isArray(historicalData)
    ) {
      return res.status(400).json({
        error: 'Invalid request',
        required: ['signals (array)', 'historicalData (array)']
      });
    }

    if (
      historicalData.length < 5 ||
      historicalData.length > 5000 ||
      signals.length > 100 ||
      historicalData.some((candle: unknown) => !isValidCandle(candle)) ||
      typeof timeoutMinutes !== 'number' ||
      !Number.isFinite(timeoutMinutes) ||
      timeoutMinutes < 1 ||
      timeoutMinutes > 240
    ) {
      return res.status(400).json({
        error: 'Invalid backtest bounds',
        message: 'signals must contain at most 100 items, historicalData 5-5000 candles, and timeoutMinutes 1-240'
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
    const parsedLimit = Number.parseInt(String(limit), 10);
    if (
      (symbol !== undefined && (typeof symbol !== 'string' || symbol.length > 32)) ||
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 1000
    ) {
      return res.status(400).json({
        success: false,
        error: 'limit must be an integer from 1 to 1000 and symbol must be at most 32 characters',
      });
    }
    const history = backtester.getHistory(
      symbol as string | undefined,
      parsedLimit
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
router.post('/prune', requireAuth, (req: Request, res: Response) => {
  try {
    const { daysToKeep = 30 } = req.body;
    if (
      typeof daysToKeep !== 'number' ||
      !Number.isInteger(daysToKeep) ||
      daysToKeep < 1 ||
      daysToKeep > 3650
    ) {
      return res.status(400).json({
        success: false,
        error: 'daysToKeep must be an integer from 1 to 3650',
      });
    }
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
