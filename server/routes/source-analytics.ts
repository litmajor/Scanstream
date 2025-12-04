
import { Router } from 'express';
import type { Request, Response } from 'express';
import { signalSourceAnalytics } from '../services/signal-source-analytics';

const router = Router();

/**
 * POST /api/source-analytics/record-trade
 * Record a completed trade for analytics
 */
router.post('/record-trade', (req: Request, res: Response) => {
  try {
    const trade = {
      ...req.body,
      entryTime: new Date(req.body.entryTime),
      exitTime: new Date(req.body.exitTime)
    };
    signalSourceAnalytics.recordTrade(trade);
    res.json({ success: true, message: 'Trade recorded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/source-analytics/metrics/:source
 * Get metrics for a specific signal source
 */
router.get('/metrics/:source', (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    const metrics = signalSourceAnalytics.getSourceMetrics(source.toUpperCase());
    res.json({ success: true, metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/source-analytics/metrics
 * Get metrics for all signal sources
 */
router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const allMetrics = signalSourceAnalytics.getAllSourceMetrics();
    res.json({ 
      success: true, 
      metrics: Object.fromEntries(allMetrics)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/source-analytics/best-source
 * Get best performing source
 */
router.get('/best-source', (req: Request, res: Response) => {
  try {
    const metric = (req.query.metric as 'winRate' | 'sharpeRatio' | 'profitFactor') || 'sharpeRatio';
    const bestSource = signalSourceAnalytics.getBestSource(metric);
    const metrics = signalSourceAnalytics.getSourceMetrics(bestSource);
    res.json({ success: true, bestSource, metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/source-analytics/export
 * Export all analytics data
 */
router.get('/export', (_req: Request, res: Response) => {
  try {
    const data = signalSourceAnalytics.exportData();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
