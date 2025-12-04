
import { Router } from 'express';
import type { Request, Response } from 'express';
import { liveTradingEngine } from '../live-trading-engine';

const router = Router();

/**
 * GET /api/live-trading/status
 * Get current live trading status
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = liveTradingEngine.getStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/start
 * Start live trading engine (TESTNET ONLY by default)
 */
router.post('/start', async (_req: Request, res: Response) => {
  try {
    await liveTradingEngine.start();
    res.json({ 
      success: true, 
      message: 'Live trading engine started',
      warning: 'Running in TESTNET mode. Switch to live at your own risk.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/stop
 * Stop live trading engine
 */
router.post('/stop', (_req: Request, res: Response) => {
  try {
    liveTradingEngine.stop();
    res.json({ success: true, message: 'Live trading engine stopped' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/config
 * Update configuration (DANGEROUS - requires validation)
 */
router.post('/config', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    // Safety check: prevent disabling testMode without explicit confirmation
    if (updates.testMode === false && !req.body.confirmLiveTrading) {
      return res.status(400).json({
        success: false,
        error: 'Live trading requires explicit confirmation. Set confirmLiveTrading: true'
      });
    }

    liveTradingEngine.updateConfig(updates);
    res.json({ success: true, config: liveTradingEngine.getStatus().config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/live-trading/positions
 * Get open positions
 */
router.get('/positions', (_req: Request, res: Response) => {
  try {
    const status = liveTradingEngine.getStatus();
    res.json({ success: true, positions: status.positions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/close/:positionId
 * Close a specific position
 */
router.post('/close/:positionId', async (req: Request, res: Response) => {
  try {
    const { positionId } = req.params;
    const success = await liveTradingEngine.closePosition(positionId);
    
    if (success) {
      res.json({ success: true, message: 'Position closed' });
    } else {
      res.status(400).json({ success: false, error: 'Failed to close position' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/live-trading/execute
 * Execute a signal (CAUTION: Real money in live mode)
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const signal = req.body;
    
    if (!signal || !signal.symbol || !signal.type || !signal.price) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signal format'
      });
    }

    const order = await liveTradingEngine.executeSignal(signal);
    
    if (order) {
      res.json({ success: true, order });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Order not placed (check logs for details)' 
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
