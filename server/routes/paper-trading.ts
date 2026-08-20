import { Router } from 'express';
import express, { type Request, type Response } from 'express';
import { storage } from '../storage';
import { paperTradingEngine } from '../paper-trading-engine';
import { db } from '../db-storage'; // Assuming db is imported from a config file
import { apiRegistry } from '../services/api-registry';
import { respondToInvalidRouteParam, routeParam } from '../utils/route-params';

const router = express.Router();

// POST /api/paper-trading/execute - Execute a position from a signal
router.post('/execute', async (req, res) => {
  try {
    const { symbol, side, quantity, price, stopLoss, takeProfit } = req.body;

    if (!symbol || !side || quantity === undefined || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, quantity, price'
      });
    }

    // normalize side values coming from UI (LONG/SHORT -> BUY/SELL)
    const sideNormalized = (side === 'LONG') ? 'BUY' : (side === 'SHORT') ? 'SELL' : side;

    // Create trade record. store stopLoss/takeProfit in `raw` metadata to avoid schema mismatch
    const rawMeta: any = {};
    if (stopLoss !== undefined) rawMeta.stopLoss = stopLoss;
    if (takeProfit !== undefined) rawMeta.takeProfit = takeProfit;
    const trade = await storage.createTrade({
      symbol,
      side: sideNormalized,
      entryPrice: price,
      quantity,
      status: 'OPEN',
      entryTime: new Date(),
      raw: rawMeta,
    } as any);

    console.log(`[Paper Trading] Executed ${sideNormalized} ${quantity} ${symbol} @ $${price}`);

    res.json({
      success: true,
      trade,
      message: `${sideNormalized} position opened for ${symbol}`
    });
  } catch (error) {
    console.error('Error executing paper trade:', error);
    res.status(500).json({ success: false, error: 'Failed to execute trade' });
  }
});

// GET /api/paper-trading/positions - Get all open positions
router.get('/positions', async (req: Request, res: Response) => {
  try {
    // Use storage layer to retrieve open trades as positions
    const openTrades = await storage.getTrades('OPEN');
    const positions = openTrades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      entryPrice: t.entryPrice,
      openedAt: (t as any).entryTime ?? null,
      status: t.status,
      raw: (t as any).raw ?? {},
    }));

    res.json({ positions });
  } catch (error) {
    console.error('[Paper Trading] Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Register important paper-trading endpoints
try {
  apiRegistry.registerEndpoint({ method: 'GET', path: '/api/paper-trading/positions', category: 'TRADING', name: 'Paper Trading Positions', description: 'List open paper trading positions', version: '1.0.0', tags: ['paper','trading'], isDeprecated: false, authentication: 'NONE', cacheable: false, isActive: true });
  apiRegistry.registerEndpoint({ method: 'GET', path: '/api/paper-trading/status', category: 'TRADING', name: 'Paper Trading Status', description: 'Paper trading engine status', version: '1.0.0', tags: ['paper','trading'], isDeprecated: false, authentication: 'NONE', cacheable: false, isActive: true });
} catch (e) {
  console.warn('[APIRegistry] Failed to register paper-trading endpoints', e);
}

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

    const { symbol, side, price, stopLoss, takeProfit, quantity } = req.body;

    if (!symbol || !side || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, side, price'
      });
    }

    const sideNormalized = (side === 'LONG') ? 'BUY' : (side === 'SHORT') ? 'SELL' : side;

    const tradeId = await paperTradingEngine.executeManuaTrade(
      symbol,
      sideNormalized,
      price,
      stopLoss,
      takeProfit,
      quantity
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
    const tradeId = routeParam(req.params.tradeId, 'tradeId');
    const { exitPrice } = req.body;

    if (exitPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: exitPrice'
      });
    }

    await paperTradingEngine.closeTrade(tradeId, exitPrice, 'MANUAL');
    res.json({ success: true });
  } catch (error: any) {
    if (respondToInvalidRouteParam(error, res)) return;
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

// POST /api/paper-trading/open-position - compatibility route used by some UIs
router.post('/open-position', async (req: Request, res: Response) => {
  try {
    const { symbol, side, price, quantity, stopLoss, takeProfit } = req.body;

    if (!symbol || price === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields: symbol, price' });
    }

    const sideNormalized = (side === 'LONG') ? 'BUY' : (side === 'SHORT') ? 'SELL' : side;

    const tradeId = await paperTradingEngine.executeManuaTrade(
      symbol,
      sideNormalized,
      price,
      stopLoss,
      takeProfit,
      quantity
    );

    if (!tradeId) return res.status(400).json({ success: false, error: 'Failed to open position' });

    res.json({ success: true, id: tradeId });
  } catch (err: any) {
    console.error('[Paper Trading] /open-position error:', err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
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