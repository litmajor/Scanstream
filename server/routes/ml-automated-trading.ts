/**
 * ML Automated Trading Routes
 * 
 * REST API endpoints for executing, monitoring, and managing automated trades
 * based on ML consensus signals.
 * 
 * Endpoints:
 * - POST /execute - Execute new trade
 * - GET /active - List active trades
 * - GET /:id - Get trade details
 * - POST /:id/close - Close active trade
 * - GET /history - Trade history
 * - GET /statistics - Trade statistics
 * - POST /settings/risk - Update risk config
 * - POST /auto-close - Auto-close expired trades
 */

import { Router, Request, Response } from 'express';
import { MLAutomatedTradingService, TradeExecutionRequest, RiskManagementConfig } from '../services/ml-automated-trading-service';
import { Logger } from '../services/logger';

const router = Router();
const logger = new Logger('MLAutomatedTradingRoutes');

// Initialize service (dependency injection in main app)
let tradingService: MLAutomatedTradingService;

export function setTradingService(service: MLAutomatedTradingService) {
  tradingService = service;
}

/**
 * POST /trades/execute
 * Execute a new trade based on ML recommendation
 * 
 * Body:
 * {
 *   symbol: "BTC/USDT",
 *   direction: "LONG",
 *   confidence: 0.85,
 *   recommendation: "CONFIRM",
 *   entryPrice: 45000,
 *   currentPrice: 45100,
 *   reasonCode: "ML_CONSENSUS_6TF",
 *   metadata: { ... }
 * }
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const request: TradeExecutionRequest = req.body;

    // Validate request
    if (!request.symbol || !request.direction || request.confidence === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, direction, confidence',
      });
    }

    // Execute trade
    const trade = await tradingService.executeTrade(request);

    if (!trade) {
      return res.status(400).json({
        error: 'Trade execution failed - risk management rules prevented execution',
      });
    }

    res.json({
      success: true,
      trade,
      message: `Trade executed: ${trade.symbol} ${trade.direction} ${trade.quantity}@${trade.entryPrice}`,
    });
  } catch (error) {
    logger.error(`Error executing trade: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trades/active
 * Get list of active (open) trades
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const activeTrades = tradingService.getActiveTrades();

    res.json({
      count: activeTrades.length,
      trades: activeTrades,
      totalPositionSize: activeTrades.reduce((sum, t) => sum + t.positionSize, 0),
      totalUnrealized: activeTrades.reduce((sum, t) => {
        // Calculate unrealized P&L (requires current price)
        return sum;
      }, 0),
    });
  } catch (error) {
    logger.error(`Error fetching active trades: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trades/:id
 * Get trade details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const trade = await tradingService.getTrade(req.params.id);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    res.json(trade);
  } catch (error) {
    logger.error(`Error fetching trade: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trades/:id/close
 * Close an active trade
 * 
 * Body:
 * {
 *   exitPrice: 45500,
 *   reason: "MANUAL_CLOSE" or "TAKE_PROFIT_HIT" or "STOP_LOSS_HIT"
 * }
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const { exitPrice, reason = 'MANUAL_CLOSE' } = req.body;

    if (!exitPrice) {
      return res.status(400).json({ error: 'exitPrice is required' });
    }

    const trade = await tradingService.closeTrade(req.params.id, exitPrice, reason);

    if (!trade) {
      return res.status(400).json({ error: 'Failed to close trade' });
    }

    res.json({
      success: true,
      trade,
      message: `Trade closed: P&L $${trade.profitLoss?.toFixed(2)} (${trade.profitLossPercent?.toFixed(2)}%)`,
    });
  } catch (error) {
    logger.error(`Error closing trade: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trades/history
 * Get trade history with pagination and filtering
 * 
 * Query:
 * - symbol: Filter by symbol
 * - limit: Number of trades (default 100)
 * - status: Filter by status (active, closed, error)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { symbol, limit = 100, status } = req.query;

    const trades = await tradingService.getTradeHistory(symbol as string, parseInt(limit as string, 10));

    // Filter by status if provided
    const filtered =
      status && status !== 'all' ? trades.filter(t => t.status === status) : trades;

    res.json({
      count: filtered.length,
      trades: filtered,
    });
  } catch (error) {
    logger.error(`Error fetching trade history: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trades/statistics
 * Get trade statistics
 * 
 * Query:
 * - symbol: Optional filter by symbol
 * - period: "daily", "weekly", "monthly", "all" (default: all)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;

    const stats = await tradingService.getTradeStatistics(symbol as string);

    res.json({
      stats,
      interpretation: {
        winRate: {
          value: `${(stats.winRate * 100).toFixed(2)}%`,
          interpretation: stats.winRate > 0.55 ? 'Profitable' : 'Below breakeven',
        },
        profitFactor: {
          value: stats.profitFactor.toFixed(2),
          interpretation:
            stats.profitFactor > 1.5
              ? 'Excellent'
              : stats.profitFactor > 1.0
              ? 'Profitable'
              : 'Unprofitable',
        },
        sharpeRatio: {
          value: 'N/A',
          interpretation: 'Requires equity curve analysis',
        },
        averageTradeDuration: {
          value: `${stats.averageDurationMinutes.toFixed(0)} minutes`,
          interpretation: 'Average holding time per trade',
        },
      },
    });
  } catch (error) {
    logger.error(`Error fetching statistics: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trades/settings/risk
 * Update risk management configuration
 * 
 * Body:
 * {
 *   maxPositionSizeUSD: 1000,
 *   maxDailyLossUSD: 5000,
 *   maxDrawdownPercent: 20,
 *   maxOpenPositions: 5,
 *   confirmConfidenceThreshold: 0.70,
 *   cautionConfidenceThreshold: 0.60,
 *   confirmPositionSizePercent: 100,
 *   cautionPositionSizePercent: 50,
 *   slippagePercent: 0.1
 * }
 */
router.post('/settings/risk', async (req: Request, res: Response) => {
  try {
    const config = req.body as Partial<RiskManagementConfig>;

    // Validate config values
    if (config.maxPositionSizeUSD && config.maxPositionSizeUSD <= 0) {
      return res.status(400).json({ error: 'maxPositionSizeUSD must be positive' });
    }

    if (config.confirmConfidenceThreshold && (config.confirmConfidenceThreshold < 0 || config.confirmConfidenceThreshold > 1)) {
      return res.status(400).json({ error: 'Confidence threshold must be 0-1' });
    }

    if (config.confirmPositionSizePercent && (config.confirmPositionSizePercent < 0 || config.confirmPositionSizePercent > 100)) {
      return res.status(400).json({ error: 'Position size percent must be 0-100' });
    }

    tradingService.updateRiskConfig(config);

    res.json({
      success: true,
      message: 'Risk configuration updated',
      config,
    });
  } catch (error) {
    logger.error(`Error updating risk config: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trades/auto-close
 * Auto-close trades based on SL/TP and re-evaluation
 * 
 * Triggers automatic closing of:
 * - Trades that have hit stop-loss
 * - Trades that have hit take-profit
 * - Trades with confidence drop below threshold
 */
router.post('/auto-close', async (req: Request, res: Response) => {
  try {
    const closedTrades = await tradingService.autoCloseExpiredTrades();

    res.json({
      success: true,
      closedCount: closedTrades.length,
      closedTrades,
      totalProfitLoss: closedTrades.reduce((sum, t) => sum + (t.profitLoss || 0), 0),
    });
  } catch (error) {
    logger.error(`Error auto-closing trades: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /trades/health
 * Get trading service health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const activeTrades = tradingService.getActiveTrades();

    res.json({
      status: 'healthy',
      activeTrades: activeTrades.length,
      totalOpenPositionSize: activeTrades.reduce((sum, t) => sum + t.positionSize, 0),
      lastCheck: new Date(),
    });
  } catch (error) {
    logger.error(`Error checking health: ${error}`);
    res.status(500).json({ status: 'error', error: String(error) });
  }
});

export default router;
