/**
 * Trade Execution Routes
 * Unified execution API for Loss Limiting, Drawdown Monitoring, and Win Amplification
 */

import { Router, Request, Response } from 'express';
import { TradeExecutionManager } from '../services/trade-execution-manager';

const router = Router();
let executionManager = new TradeExecutionManager(100000); // Start with $100k

/**
 * POST /api/execution/decision
 * Get execution decision for new trade
 */
router.post('/decision', async (req: Request, res: Response) => {
  try {
    const { signal, portfolio, baseSize = 1000, winRate = 0.55 } = req.body;

    if (!signal) {
      return res.status(400).json({ error: 'Signal required' });
    }

    const decision = executionManager.makeExecutionDecision(
      signal,
      portfolio,
      baseSize,
      winRate
    );

    res.json({
      success: true,
      decision,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/execution/status
 * Get current execution status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const metrics = executionManager.getMetrics();

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/execution/record-outcome
 * Record trade outcome for learning
 */
router.post('/record-outcome', async (req: Request, res: Response) => {
  try {
    const { tradeId, signal, pnl, durationHours } = req.body;

    if (!tradeId || !signal || pnl === undefined) {
      return res.status(400).json({
        error: 'tradeId, signal, and pnl required'
      });
    }

    executionManager.recordTradeOutcome(tradeId, signal, pnl, durationHours || 1);

    res.json({
      success: true,
      message: 'Trade outcome recorded',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/execution/reset
 * Reset execution manager (start of day)
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { initialBalance = 100000 } = req.body;
    executionManager = new TradeExecutionManager(initialBalance);

    res.json({
      success: true,
      message: 'Execution manager reset',
      initialBalance,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
