
/**
 * ML Training API Routes
 * 
 * Endpoints for training and updating ML models
 */

import express, { type Request, type Response } from 'express';
import MLPredictionService from '../services/ml-predictions';

const router = express.Router();

/**
 * POST /api/ml/train
 * 
 * Train models on historical data
 */
router.post('/train', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT', lookbackDays = 30, validationSplit = 0.2, epochs = 50 } = req.body;
    
    // Validate inputs
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol parameter'
      });
    }

    if (lookbackDays < 1 || lookbackDays > 365) {
      return res.status(400).json({
        success: false,
        error: 'lookbackDays must be between 1 and 365'
      });
    }

    const MLModelTrainer = (await import('../services/ml-model-trainer')).default;
    
    const result = await MLModelTrainer.trainModels({
      symbol,
      lookbackDays,
      validationSplit,
      epochs
    });
    
    res.json({
      success: true,
      message: 'Models trained successfully',
      metrics: result.metrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[ML Training] Error:', err);
    
    // Provide more detailed error information
    const errorMessage = err.message || 'Training failed';
    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ml/model-info
 * 
 * Get information about trained models
 */
router.get('/model-info', (_req: Request, res: Response) => {
  res.json({
    models: [
      {
        name: 'Direction Classifier',
        type: 'Gradient Boosting Binary Classifier',
        features: 24,
        trained: true
      },
      {
        name: 'Price Predictor',
        type: 'LSTM-inspired Regressor',
        features: 24,
        trained: true
      },
      {
        name: 'Volatility Predictor',
        type: 'GARCH-inspired Model',
        features: 24,
        trained: true
      },
      {
        name: 'Risk Assessor',
        type: 'Ensemble Model',
        features: 24,
        trained: true
      }
    ],
    version: '2.0-production',
    timestamp: new Date().toISOString()
  });
});

export default router;
