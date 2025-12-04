
import { Router } from 'express';
import type { Request, Response } from 'express';
import { assetCorrelationAnalyzer } from '../services/asset-correlation-analyzer';

const router = Router();

/**
 * POST /api/correlation-boost/analyze
 * Analyze correlation boost for a signal
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { symbol, direction, confidence } = req.body;

    if (!symbol || !direction || confidence === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, direction, confidence'
      });
    }

    const boostResult = await assetCorrelationAnalyzer.getCorrelationBoost(
      symbol,
      direction as 'BUY' | 'SELL' | 'HOLD',
      confidence
    );

    res.json({
      success: true,
      boost: boostResult,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Correlation Boost] Error:', error);
    res.status(500).json({
      error: error.message,
      message: 'Failed to analyze correlation boost'
    });
  }
});

/**
 * POST /api/correlation-boost/track
 * Track a signal for correlation analysis
 */
router.post('/track', (req: Request, res: Response) => {
  try {
    const { symbol, direction, confidence } = req.body;

    if (!symbol || !direction || confidence === undefined) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    assetCorrelationAnalyzer.trackSignal(
      symbol,
      direction as 'BUY' | 'SELL' | 'HOLD',
      confidence
    );

    res.json({
      success: true,
      message: 'Signal tracked for correlation analysis'
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/correlation-boost/report/:symbol
 * Get correlation report for a symbol
 */
router.get('/report/:symbol', (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const report = assetCorrelationAnalyzer.getCorrelationReport(symbol);

    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;
