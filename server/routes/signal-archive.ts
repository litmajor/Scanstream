
import express, { type Request, type Response } from 'express';
import { signalArchive } from '../services/signal-archive';

const router = express.Router();

/**
 * GET /api/signal-archive/stats
 * Get performance statistics from archived signals
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { symbol, days = '30' } = req.query;
    
    const stats = await signalArchive.getPerformanceStats({
      symbol: symbol as string | undefined,
      days: parseInt(days as string)
    });

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signal-archive/history
 * Query historical signals
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      startDate,
      endDate,
      outcome,
      minStrength,
      source,
      limit = '100'
    } = req.query;

    const signals = await signalArchive.querySignals({
      symbol: symbol as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      outcome: outcome as any,
      minStrength: minStrength ? parseFloat(minStrength as string) : undefined,
      source: source as string | undefined,
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      count: signals.length,
      signals,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/signal-archive/record-outcome
 * Record trade outcome for a signal
 */
router.post('/record-outcome', async (req: Request, res: Response) => {
  try {
    const { signalId, exitPrice, exitedAt, hitStopLoss, hitTakeProfit } = req.body;

    if (!signalId || !exitPrice) {
      return res.status(400).json({
        success: false,
        error: 'signalId and exitPrice are required'
      });
    }

    await signalArchive.recordOutcome(signalId, {
      exitPrice: parseFloat(exitPrice),
      exitedAt: exitedAt ? new Date(exitedAt) : new Date(),
      hitStopLoss,
      hitTakeProfit
    });

    res.json({
      success: true,
      message: 'Outcome recorded successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/signal-archive/prune
 * Clean up old signals
 */
router.post('/prune', async (req: Request, res: Response) => {
  try {
    const { daysToKeep = 90 } = req.body;
    
    const deletedCount = await signalArchive.pruneOldSignals(daysToKeep);

    res.json({
      success: true,
      deletedCount,
      message: `Pruned ${deletedCount} signals older than ${daysToKeep} days`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
