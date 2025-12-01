
import { Router } from 'express';
import type { Request, Response } from 'express';
import { paperTradingEngine } from '../paper-trading-engine';
import { db } from '../db-storage';

const router = Router();

/**
 * GET /api/portfolio/summary
 * Get portfolio summary with current value, metrics, and equity curve
 */
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const status = paperTradingEngine.getStatus();
    const metrics = status.metrics;
    const balance = status.balance;
    
    // Get equity curve data
    const equityCurve = paperTradingEngine.exportData().equityCurve;
    
    // Calculate day change
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEquity = equityCurve.filter(e => e.date >= today);
    const dayChange = todayEquity.length > 1 
      ? todayEquity[todayEquity.length - 1].value - todayEquity[0].value
      : 0;
    const dayChangePercent = todayEquity.length > 1 && todayEquity[0].value > 0
      ? (dayChange / todayEquity[0].value) * 100
      : 0;

    res.json({
      totalValue: balance,
      availableCash: balance,
      invested: 0, // Can calculate from open positions
      dayChange,
      dayChangePercent,
      performance: metrics
    });
  } catch (error: any) {
    console.error('[Portfolio] Error fetching summary:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch portfolio summary' });
  }
});

/**
 * GET /api/portfolio/data
 * Get complete portfolio data including equity curve, trades, drawdowns, and monte carlo
 */
router.get('/data', async (_req: Request, res: Response) => {
  try {
    const exportData = paperTradingEngine.exportData();
    const metrics = exportData.metrics;
    
    // Format equity curve
    const equityCurve = exportData.equityCurve.map(point => ({
      date: point.date,
      value: point.value
    }));

    // Format trades
    const trades = exportData.trades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || 0,
      quantity: trade.quantity,
      pnl: trade.pnl || 0,
      duration: trade.exitTime && trade.entryTime 
        ? (new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()) / (1000 * 60 * 60)
        : 0,
      returnPct: trade.pnl && trade.entryPrice && trade.quantity
        ? (trade.pnl / (trade.entryPrice * trade.quantity)) * 100
        : 0
    }));

    // Format drawdown periods
    const drawdownPeriods = exportData.drawdowns.map(dd => ({
      startDate: dd.startDate,
      endDate: dd.endDate,
      maxDrawdown: dd.maxDrawdown,
      duration: dd.duration
    }));

    // Get Monte Carlo results from simulator
    const simulator = (paperTradingEngine as any).simulator;
    const monteCarloResults = simulator?.getMonteCarloAnalysis 
      ? simulator.getMonteCarloAnalysis()
      : {
          percentiles: { 5: 0, 25: 0, 50: 0, 75: 0, 95: 0 },
          probabilityOfProfit: 0,
          worstCase: 0,
          bestCase: 0
        };

    res.json({
      equityCurve,
      metrics,
      trades,
      drawdownPeriods,
      monteCarloResults
    });
  } catch (error: any) {
    console.error('[Portfolio] Error fetching data:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch portfolio data' });
  }
});

/**
 * GET /api/portfolio/positions
 * Get current open positions
 */
router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const status = paperTradingEngine.getStatus();
    const positions = status.activeTrades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice,
      quantity: trade.quantity,
      entryTime: trade.entryTime,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      source: trade.source
    }));

    res.json({ positions });
  } catch (error: any) {
    console.error('[Portfolio] Error fetching positions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch positions' });
  }
});

/**
 * GET /api/portfolio/metrics
 * Get detailed performance metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const status = paperTradingEngine.getStatus();
    res.json({ metrics: status.metrics });
  } catch (error: any) {
    console.error('[Portfolio] Error fetching metrics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/portfolio/trades/history
 * Get trade history with pagination
 */
router.get('/trades/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const status = paperTradingEngine.getStatus();
    const allTrades = status.recentTrades;
    
    const trades = allTrades
      .slice(offset, offset + limit)
      .map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        pnl: trade.pnl,
        pnlPercent: trade.pnlPercent,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
        exitReason: trade.exitReason,
        source: trade.source
      }));

    res.json({
      trades,
      total: allTrades.length,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('[Portfolio] Error fetching trade history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch trade history' });
  }
});

/**
 * POST /api/portfolio/reset
 * Reset portfolio to initial state
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { initialBalance } = req.body;
    paperTradingEngine.reset(initialBalance);
    
    res.json({ 
      success: true, 
      message: 'Portfolio reset successfully',
      newBalance: initialBalance || 10000
    });
  } catch (error: any) {
    console.error('[Portfolio] Error resetting portfolio:', error);
    res.status(500).json({ error: error.message || 'Failed to reset portfolio' });
  }
});

/**
 * GET /api/portfolio/export
 * Export portfolio data as JSON
 */
router.get('/export', async (_req: Request, res: Response) => {
  try {
    const data = paperTradingEngine.exportData();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=portfolio-export.json');
    res.json(data);
  } catch (error: any) {
    console.error('[Portfolio] Error exporting data:', error);
    res.status(500).json({ error: error.message || 'Failed to export portfolio data' });
  }
});

export default router;
