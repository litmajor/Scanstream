
import express, { type Request, type Response } from 'express';
import AdvancedMLService from '../services/ml-advanced-models';

const router = express.Router();

/**
 * POST /api/ml/advanced/predictions
 * 
 * Generate advanced ML predictions (5 new models)
 */
router.post('/predictions', async (req: Request, res: Response) => {
  try {
    const { chartData } = req.body;
    
    if (!chartData || !Array.isArray(chartData)) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'chartData must be an array'
      });
    }
    
    if (chartData.length < 30) {
      return res.status(400).json({ 
        error: 'Insufficient data',
        message: 'At least 30 data points required for advanced predictions'
      });
    }
    
    const predictions = await AdvancedMLService.generateAdvancedPredictions(chartData);
    
    res.json({
      success: true,
      predictions,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[Advanced ML] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message || 'Advanced prediction generation failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ml/advanced/status
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Advanced ML Predictions Engine',
    models: [
      'Market Regime Detector',
      'Breakout Probability Predictor',
      'Order Flow Imbalance Analyzer',
      'Multi-Timeframe Momentum Synthesizer',
      'Liquidity Squeeze Detector'
    ],
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;
