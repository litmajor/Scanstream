/**
 * Trade Execution Routes
 * Unified execution API for Loss Limiting, Drawdown Monitoring, and Win Amplification
 */

import { Router, Request, Response } from 'express';
import { TradeExecutionManager } from '../services/trade-execution-manager';
import { requireTradingOperator } from '../middleware/require-trading-operator';
import { auditOperatorAction } from '../middleware/audit-operator-action';

const router = Router();
let executionManager = new TradeExecutionManager(100000); // Start with $100k

const executionSnapshot = () => executionManager.getMetrics();
const audit = (
  action: Parameters<typeof auditOperatorAction>[0],
  target?: (req: Request) => string | undefined,
) => auditOperatorAction(action, { snapshot: executionSnapshot, target });

/**
 * POST /api/execution/decision
 * Get execution decision for new trade
 */
router.post(
  '/decision',
  requireTradingOperator,
  audit('execution_decision', (req) => String(req.body?.signal?.symbol ?? '')),
  async (req: Request, res: Response) => {
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
  },
);

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
router.post(
  '/record-outcome',
  requireTradingOperator,
  audit('record_outcome', (req) => String(req.body?.tradeId ?? '')),
  async (req: Request, res: Response) => {
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
  },
);

/**
 * POST /api/execution/reset
 * Reset execution manager (start of day)
 */
router.post(
  '/reset',
  requireTradingOperator,
  audit('reset_execution'),
  async (req: Request, res: Response) => {
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
  },
);

export default router;
