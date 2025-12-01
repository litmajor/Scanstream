
/**
 * Position Sizing API
 * Endpoints for monitoring and validating Dynamic Position Sizer
 */

import { Router } from 'express';
import { dynamicPositionSizer } from '../services/dynamic-position-sizer';
import { positionSizerTrainer } from '../scripts/train-position-sizer';

const router = Router();

/**
 * GET /api/position-sizing/stats
 * Get RL Agent statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = dynamicPositionSizer.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/position-sizing/train
 * Trigger training on historical data
 */
router.post('/train', async (req, res) => {
  try {
    await positionSizerTrainer.trainOnHistoricalData();
    
    res.json({
      success: true,
      message: 'Training completed',
      stats: dynamicPositionSizer.getStats()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Training failed'
    });
  }
});

/**
 * POST /api/position-sizing/simulate
 * Simulate position sizing for given parameters
 */
router.post('/simulate', (req, res) => {
  try {
    const {
      symbol,
      confidence,
      signalType,
      accountBalance,
      currentPrice,
      atr,
      marketRegime,
      primaryPattern
    } = req.body;
    
    const sizing = dynamicPositionSizer.calculatePositionSize({
      symbol,
      confidence: parseFloat(confidence),
      signalType,
      accountBalance: parseFloat(accountBalance),
      currentPrice: parseFloat(currentPrice),
      atr: parseFloat(atr),
      marketRegime,
      primaryPattern
    });
    
    res.json({
      success: true,
      sizing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed'
    });
  }
});

export default router;
