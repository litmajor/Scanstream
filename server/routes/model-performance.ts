/**
 * Model Performance & Backtesting API
 * 
 * Tracks model accuracy, performs backtesting, and provides performance metrics
 */

import express, { type Request, type Response } from 'express';
import { getPerformanceTracker } from '../services/model-performance-tracker';
import EnsemblePredictor from '../services/ensemble-predictor';
import { requireAuth } from '../middleware/auth';
import { requireTradingOperator } from '../middleware/require-trading-operator';
import { auditOperatorAction } from '../middleware/audit-operator-action';

const router = express.Router();
const tracker = getPerformanceTracker();
const MAX_SYMBOL_LENGTH = 64;
const MAX_DIRECTION_LENGTH = 32;
const MAX_ENSEMBLE_POINTS = 1000;
const MAX_PRUNE_DAYS = 3650;

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function predictionDirection(value: unknown): value is 'UP' | 'DOWN' | 'NEUTRAL' {
  return value === 'UP' || value === 'DOWN' || value === 'NEUTRAL';
}

/**
 * GET /api/model-performance/metrics
 * Get model performance metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;
    const metrics = tracker.calculateMetrics(symbol as string | undefined);

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to calculate metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/model-performance/history
 * Get prediction history for backtesting
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const { symbol, limit = '100' } = req.query;
    const history = tracker.getPredictionHistory(
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
      error: error.message || 'Failed to fetch history',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/model-performance/validate
 * Validate prediction against actual market movement
 */
router.post('/validate', requireAuth, (req: Request, res: Response) => {
  try {
    const { 
      symbol, 
      predictedDirection, 
      actualChange, 
      predictedPrice, 
      actualPrice 
    } = req.body;

    if (
      typeof symbol !== 'string'
      || symbol.length === 0
      || symbol.length > MAX_SYMBOL_LENGTH
      || !predictionDirection(predictedDirection)
      || predictedDirection.length > MAX_DIRECTION_LENGTH
      || !finiteNumber(actualChange)
      || (predictedPrice !== undefined && !finiteNumber(predictedPrice))
      || (actualPrice !== undefined && !finiteNumber(actualPrice))
    ) {
      return res.status(400).json({
        error: 'Invalid validation input',
        required: ['symbol', 'predictedDirection', 'actualChange']
      });
    }

    const result = tracker.validatePrediction(
      symbol,
      predictedDirection,
      actualChange,
      predictedPrice,
      actualPrice
    );

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Validation failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/model-performance/ensemble-status
 * Get ensemble model status and readiness
 */
router.get('/ensemble-status', (_req: Request, res: Response) => {
  try {
    const metrics = tracker.calculateMetrics();

    res.json({
      success: true,
      ensemble: {
        models: [
          'Direction Classifier',
          'Price Predictor',
          'Volatility Predictor',
          'Risk Assessor',
          'RL Position Agent'
        ],
        totalModels: 5,
        status: metrics.totalPredictions > 0 ? 'active' : 'warming-up',
        performanceMetrics: metrics,
        ready: metrics.totalPredictions >= 50, // Need at least 50 predictions to be reliable
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to get ensemble status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/model-performance/ensemble-predict
 * Generate ensemble prediction
 */
router.post('/ensemble-predict', requireAuth, async (req: Request, res: Response) => {
  try {
    const { chartData } = req.body;

    if (!chartData || !Array.isArray(chartData)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'chartData must be an array'
      });
    }

    if (chartData.length < 20 || chartData.length > MAX_ENSEMBLE_POINTS) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: `Chart data must contain between 20 and ${MAX_ENSEMBLE_POINTS} data points`
      });
    }

    const prediction = await EnsemblePredictor.generateEnsemblePrediction(chartData);

    res.json({
      success: true,
      prediction,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Ensemble prediction failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/model-performance/prune
 * Clean up old predictions. This is operator-gated because it destroys
 * process-global history without an ownership model.
 */
router.post(
  '/prune',
  requireTradingOperator,
  auditOperatorAction('prune_model_history', {
    target: (req) => String(req.body?.daysToKeep ?? 30),
  }),
  (req: Request, res: Response) => {
    try {
      const { daysToKeep = 30 } = req.body;
      if (!finiteNumber(daysToKeep) || !Number.isInteger(daysToKeep) || daysToKeep < 1 || daysToKeep > MAX_PRUNE_DAYS) {
        return res.status(400).json({
          error: 'Invalid daysToKeep',
          message: `daysToKeep must be an integer between 1 and ${MAX_PRUNE_DAYS}`,
        });
      }
      tracker.pruneOldPredictions(daysToKeep);

      res.json({
        success: true,
        message: `Pruned predictions older than ${daysToKeep} days`,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Prune operation failed',
        timestamp: new Date().toISOString()
      });
    }
  },
);

export default router;
