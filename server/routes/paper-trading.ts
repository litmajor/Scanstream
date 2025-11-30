
import express, { type Request, type Response } from 'express';
import { paperTradingEngine } from '../paper-trading-engine';

const router = express.Router();

/**
 * GET /api/paper-trading/status
 * Get current paper trading status
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const status = paperTradingEngine.getStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paper-trading/start
 * Start auto-execution engine
 */
router.post('/start', (_req: Request, res: Response) => {
  try {
    paperTradingEngine.start();
    res.json({ success: true, message: 'Paper trading engine started' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paper-trading/stop
 * Stop auto-execution engine
 */
router.post('/stop', (_req: Request, res: Response) => {
  try {
    paperTradingEngine.stop();
    res.json({ success: true, message: 'Paper trading engine stopped' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paper-trading/config
 * Update configuration
 */
router.post('/config', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    paperTradingEngine.updateConfig(updates);
    res.json({ success: true, config: paperTradingEngine.getStatus().config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paper-trading/trade
 * Execute manual trade
 */
router.post('/trade', async (req: Request, res: Response) => {
  try {
    const { symbol, side, price, stopLoss, takeProfit } = req.body;
    
    if (!symbol || !side || !price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: symbol, side, price' 
      });
    }

    const tradeId = await paperTradingEngine.executeManuaTrade(
      symbol,
      side,
      price,
      stopLoss,
      takeProfit
    );

    if (!tradeId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to execute trade (insufficient funds or position limit reached)' 
      });
    }

    res.json({ success: true, tradeId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paper-trading/close/:tradeId
 * Close a specific trade
 */
router.post('/close/:tradeId', async (req: Request, res: Response) => {
  try {
    const { tradeId } = req.params;
    const { exitPrice } = req.body;

    if (!exitPrice) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: exitPrice' 
      });
    }

    await paperTradingEngine.closeTrade(tradeId, exitPrice, 'MANUAL');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/paper-trading/reset
 * Reset paper trading account
 */
router.post('/reset', (req: Request, res: Response) => {
  try {
    const { initialBalance } = req.body;
    paperTradingEngine.reset(initialBalance);
    res.json({ success: true, message: 'Paper trading account reset' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/paper-trading/export
 * Export paper trading data
 */
router.get('/export', (_req: Request, res: Response) => {
  try {
    const data = paperTradingEngine.exportData();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
