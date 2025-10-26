
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
    const { chartData, modelType } = req.body;
    
    if (!chartData || !Array.isArray(chartData)) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'chartData must be an array'
      });
    }
    
    if (chartData.length < 100) {
      return res.status(400).json({ 
        error: 'Insufficient data',
        message: 'At least 100 data points required for training'
      });
    }
    
    // Trigger model training
    await (MLPredictionService as any).trainModels(chartData);
    
    res.json({
      success: true,
      message: 'Models trained successfully',
      dataPoints: chartData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[ML Training] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message || 'Training failed',
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
