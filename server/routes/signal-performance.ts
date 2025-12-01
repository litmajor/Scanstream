
import express, { type Request, type Response } from 'express';
import { signalPerformanceTracker } from '../services/signal-performance-tracker';

const router = express.Router();

/**
 * GET /api/gateway/signals/performance/stats
 * Get overall performance statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = signalPerformanceTracker.getPerformanceStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[Signal Performance] Error fetching stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  }
});

/**
 * GET /api/gateway/signals/performance/recent
 * Get recent signal performance
 */
router.get('/recent', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const recent = signalPerformanceTracker.getRecentPerformance(limit);
    res.json(recent);
  } catch (error: any) {
    console.error('[Signal Performance] Error fetching recent:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recent performance' });
  }
});

export default router;
