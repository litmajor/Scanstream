/**
 * ML Predictions API Routes
 * 
 * Endpoints for ML predictions on chart data
 */

import express, { type Request, type Response } from 'express';
import MLPredictionService from '../services/ml-predictions';

const router = express.Router();

/**
 * POST /api/ml/predictions
 * 
 * Generate ML predictions from chart data
 * 
 * Request body:
 * {
 *   chartData: ChartDataPoint[]
 * }
 */
router.post('/predictions', async (req: Request, res: Response) => {
  try {
    const { chartData } = req.body;
    
    // Validate input
    if (!chartData || !Array.isArray(chartData)) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'chartData must be an array'
      });
    }
    
    if (chartData.length < 20) {
      return res.status(400).json({ 
        error: 'Insufficient data',
        message: 'At least 20 data points required for predictions'
      });
    }
    
    // Generate predictions
    const predictions = await MLPredictionService.generatePredictions(chartData);
    
    res.json({
      success: true,
      predictions: {
        ...predictions,
        // Ensure holding period is explicitly included
        holdingPeriod: predictions.holdingPeriod
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[ML Predictions] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message || 'Prediction generation failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ml/predictions/status
 * 
 * Health check endpoint
 */
router.get('/predictions/status', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ML Predictions Engine',
    models: [
      'Direction Classifier',
      'Price Predictor',
      'Volatility Predictor',
      'Risk Assessor'
    ],
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;

