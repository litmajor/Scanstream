/**
 * Scanner Signal Routes
 * 
 * API endpoints for computing and managing scanner signals with risk management targets.
 * Exposes the ScannerSignalService functionality to clients.
 */

import { Router, Request, Response } from 'express';
import ScannerSignalService from '../services/scanner/scanner-signal-service';
import type {
  ComputeScannerSignalRequest,
  ComputeScannerSignalResponse,
  BatchComputeScannerSignalRequest,
  BatchComputeScannerSignalResponse,
} from '../services/scanner/scanner-signal';

const router = Router();

/**
 * POST /api/scanner/signal/compute
 * Compute a single scanner signal with risk management targets
 * 
 * Request body:
 * {
 *   "symbol": "BTC/USDT",
 *   "timeframe": "1h",
 *   "marketData": {
 *     "open": [40000, 40100, ...],
 *     "high": [40200, 40300, ...],
 *     "low": [39900, 40000, ...],
 *     "close": [40150, 40250, ...],
 *     "volume": [1000, 1100, ...],
 *     "timestamp": [1234567890000, 1234568490000, ...]
 *   },
 *   "accountBalance": 10000,
 *   "riskPerTradePct": 1,
 *   "leverage": 1,
 *   "riskRewardRatio": 2.5
 * }
 */
router.post('/signal/compute', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, marketData, accountBalance, riskPerTradePct, leverage, riskRewardRatio, atr, bbUpper, bbLower, supportLevel, resistanceLevel, feeRate } = req.body;

    // Validate required fields
    if (!symbol || !timeframe || !marketData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, timeframe, marketData',
      });
    }

    // Validate market data structure
    if (!marketData.open || !marketData.high || !marketData.low || !marketData.close) {
      return res.status(400).json({
        success: false,
        error: 'Invalid marketData structure: must include open, high, low, close arrays',
      });
    }

    // Validate array lengths match
    const dataLength = marketData.close.length;
    if (marketData.open.length !== dataLength || marketData.high.length !== dataLength || marketData.low.length !== dataLength) {
      return res.status(400).json({
        success: false,
        error: 'marketData arrays must have equal length',
      });
    }

    // Validate minimum data points
    if (dataLength < 5) {
      return res.status(400).json({
        success: false,
        error: 'Minimum 5 data points required for signal computation',
      });
    }

    const signalRequest: ComputeScannerSignalRequest = {
      symbol,
      timeframe,
      marketData,
      accountBalance,
      riskPerTradePct,
      leverage,
      riskRewardRatio,
      atr,
      bbUpper,
      bbLower,
      supportLevel,
      resistanceLevel,
      feeRate,
    };

    const result = ScannerSignalService.computeSignal(signalRequest);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('[Scanner Signal] Error computing signal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/scanner/signal/compute-batch
 * Compute multiple scanner signals
 * 
 * Request body:
 * {
 *   "signals": [
 *     { "symbol": "BTC/USDT", "timeframe": "1h", "marketData": {...} },
 *     { "symbol": "ETH/USDT", "timeframe": "1h", "marketData": {...} }
 *   ],
 *   "options": {
 *     "stopOnError": false,
 *     "parallel": true
 *   }
 * }
 */
router.post('/signal/compute-batch', async (req: Request, res: Response) => {
  try {
    const { signals, options } = req.body;

    if (!signals || !Array.isArray(signals)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: signals must be an array',
      });
    }

    if (signals.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one signal is required',
      });
    }

    if (signals.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 signals per batch request',
      });
    }

    const batchRequest: BatchComputeScannerSignalRequest = {
      signals,
      options,
    };

    const result = ScannerSignalService.computeSignalsBatch(batchRequest);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[Scanner Signal] Error computing batch signals:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/scanner/signal/cached/:symbol/:timeframe
 * Get cached signal for a symbol/timeframe combination
 */
router.get('/signal/cached/:symbol/:timeframe', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe } = req.params;

    if (!symbol || !timeframe) {
      return res.status(400).json({
        success: false,
        error: 'Missing symbol or timeframe',
      });
    }

    const cachedSignal = ScannerSignalService.getCachedSignal(symbol, timeframe);

    if (!cachedSignal) {
      return res.status(404).json({
        success: false,
        error: 'No cached signal found for this symbol/timeframe',
      });
    }

    res.json({
      success: true,
      signal: cachedSignal,
      cached: true,
    });
  } catch (error: any) {
    console.error('[Scanner Signal] Error retrieving cached signal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /api/scanner/signal/cache
 * Clear signal cache
 * 
 * Query parameters:
 * - symbol (optional): Clear cache for specific symbol only
 */
router.delete('/signal/cache', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;

    ScannerSignalService.clearCache(symbol as string);

    res.json({
      success: true,
      message: `Cache cleared ${symbol ? `for symbol ${symbol}` : 'for all symbols'}`,
    });
  } catch (error: any) {
    console.error('[Scanner Signal] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/scanner/signal/health
 * Check scanner signal service health
 */
router.get('/signal/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      service: 'scanner-signal-service',
      status: 'healthy',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Scanner Signal] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Service unavailable',
    });
  }
});

/**
 * POST /api/scanner/signal/validate
 * Validate signal request without computing
 */
router.post('/signal/validate', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, marketData } = req.body;
    const errors: string[] = [];

    // Validate required fields
    if (!symbol) errors.push('symbol is required');
    if (!timeframe) errors.push('timeframe is required');
    if (!marketData) errors.push('marketData is required');

    // Validate market data
    if (marketData) {
      if (!marketData.open || !marketData.high || !marketData.low || !marketData.close) {
        errors.push('marketData must include open, high, low, close arrays');
      } else {
        const dataLength = marketData.close.length;
        if (marketData.open.length !== dataLength || marketData.high.length !== dataLength || marketData.low.length !== dataLength) {
          errors.push('marketData arrays must have equal length');
        }
        if (dataLength < 5) {
          errors.push('Minimum 5 data points required');
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        errors,
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Signal request is valid',
    });
  } catch (error: any) {
    console.error('[Scanner Signal] Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
