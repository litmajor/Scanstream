/**
 * Commander Approval API Routes
 * Endpoints for approval system, briefings, alerts, manual trades, and emergency controls
 */

import express, { type Request, type Response, type Router } from 'express';
import { CommanderApprovalSystem } from '../services/rpg-agents/CommanderApprovalSystem';
import { DailyBriefingSystem } from '../services/rpg-agents/DailyBriefingSystem';
import { AgentArena } from '../services/rpg-agents/AgentArena';
import { PaperTradingEngine } from '../paper-trading-engine';
import { ExchangeDataFeed } from '../trading-engine';
import { PatternDetectionEngine } from '../services/pattern-detection-contribution';
import MLPredictionService from '../services/ml-predictions';
import { EnhancedPortfolioSimulator } from '../portfolio-simulator';

export function setupCommanderRoutes(
  router: Router,
  approvalSystem: CommanderApprovalSystem,
  briefingSystem: DailyBriefingSystem,
  arena: AgentArena,
  tradingEngine: PaperTradingEngine
) {
  // ============================================
  // 1. GET PENDING DECISIONS
  // ============================================

  /**
   * GET /api/commander/decisions/pending
   * Get all decisions awaiting commander approval
   */
  router.get('/commander/decisions/pending', async (req: Request, res: Response) => {
    try {
      const pending = approvalSystem.getPendingDecisions();

      res.json({
        success: true,
        total: pending.length,
        daily: pending.filter(d => d.type.includes('AGENT') || d.type.includes('CAPITAL')),
        alerts: pending.filter(d => d.autonomyCheck.required === 'NONE'),
        decisions: pending
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 2. GET DAILY BRIEFING
  // ============================================

  /**
   * GET /api/commander/briefing/daily
   * Get commander's daily briefing
   */
  router.get('/commander/briefing/daily', async (req: Request, res: Response) => {
    try {
      const briefing = await briefingSystem.generateDailyBriefing();

      res.json({
        success: true,
        briefing
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 3. APPROVE/REJECT DECISION
  // ============================================

  /**
   * POST /api/commander/decisions/:decisionId/approve
   * Commander approves, rejects, or modifies a decision
   */
  router.post('/commander/decisions/:decisionId/approve', async (req: Request, res: Response) => {
    try {
      const { decisionId } = req.params;
      const { decision, notes, modifiedParameters } = req.body;

      // decision: "APPROVE", "REJECT", "MODIFY"
      const result = approvalSystem.reviewDecision(
        decisionId,
        decision,
        notes,
        modifiedParameters
      );

      if (!result) {
        return res.status(404).json({ error: 'Decision not found' });
      }

      res.json({
        success: true,
        decision: result.commanderReview,
        message: `Decision ${decision} successfully`,
        executedAt: new Date()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 4. GET ALERTS
  // ============================================

  /**
   * GET /api/commander/alerts/active
   * Get active alerts requiring attention
   */
  router.get('/commander/alerts/active', async (req: Request, res: Response) => {
    try {
      const alerts = approvalSystem.getActiveAlerts();

      res.json({
        success: true,
        total: alerts.length,
        alerts
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/commander/alerts/:alertId/respond
   * Commander responds to an alert
   */
  router.post('/commander/alerts/:alertId/respond', async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const { action, reason } = req.body;

      const result = approvalSystem.respondToAlert(alertId, action, reason);

      if (!result) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({
        success: true,
        alert: result.commanderResponse,
        message: `Alert responded with action: ${action}`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 5. MANUAL TRADE EXECUTION
  // ============================================

  /**
   * POST /api/commander/manual-trade
   * Commander executes a manual trade
   */
  router.post('/commander/manual-trade', async (req: Request, res: Response) => {
    try {
      const { symbol, side, price, size, stopLoss, takeProfit, reason } = req.body;

      // Validate input
      if (!symbol || !side || !price || !size) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Execute trade
      const tradeId = await tradingEngine.executeManuaTrade(
        symbol,
        side,
        price,
        stopLoss,
        takeProfit
      );

      res.json({
        success: true,
        trade: {
          id: tradeId,
          agent: 'COMMANDER_MANUAL',
          symbol,
          side,
          entryPrice: price,
          size,
          stopLoss,
          takeProfit,
          reason,
          status: 'OPEN',
          executedAt: new Date()
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 6. AGENT MANAGEMENT
  // ============================================

  /**
   * POST /api/commander/agent/:agentName/hibernate
   * Command: Hibernate an agent
   */
  router.post('/commander/agent/:agentName/hibernate', async (req: Request, res: Response) => {
    try {
      const { agentName } = req.params;
      const { reason, duration } = req.body;

      arena.hibernateAgent(agentName, reason);

      res.json({
        success: true,
        message: `${agentName} hibernated`,
        duration: duration || '7 days',
        reason
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/commander/agent/:agentName/wake
   * Command: Wake/activate an agent
   */
  router.post('/commander/agent/:agentName/wake', async (req: Request, res: Response) => {
    try {
      const { agentName } = req.params;

      arena.wakeAgent(agentName);

      res.json({
        success: true,
        message: `${agentName} awakened`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 7. STRATEGIC DIRECTION
  // ============================================

  /**
   * POST /api/commander/strategy/direction
   * Set strategic direction for the system
   */
  router.post('/commander/strategy/direction', async (req: Request, res: Response) => {
    try {
      const { direction, parameters } = req.body;

      // Examples:
      // direction: "FOCUS_ON_BREAKOUTS"
      // parameters: { capitalAllocation, hibernateAgents, etc }

      // Execute strategy changes
      if (parameters.hibernateAgents) {
        parameters.hibernateAgents.forEach((agentName: string) => {
          arena.hibernateAgent(agentName, 'Strategic direction change');
        });
      }

      if (parameters.capitalAllocationAdjustment) {
        // Update portfolio allocation
        arena.allocateCapital();
      }

      res.json({
        success: true,
        direction,
        newAllocation: parameters.capitalAllocationAdjustment,
        message: 'Strategic direction updated',
        estimatedImpact: parameters.estimatedImpact || 'TBD'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 8. EMERGENCY CONTROLS
  // ============================================

  /**
   * POST /api/commander/emergency/pause-all
   * Emergency: Pause all trading
   */
  router.post('/commander/emergency/pause-all', async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;

      // Pause all agent trading
      arena.pauseAllAgents();

      res.json({
        success: true,
        status: 'ALL_TRADING_PAUSED',
        reason,
        timestamp: new Date(),
        message: 'All trading operations paused immediately'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/commander/emergency/resume-all
   * Emergency: Resume all trading
   */
  router.post('/commander/emergency/resume-all', async (req: Request, res: Response) => {
    try {
      arena.resumeAllAgents();

      res.json({
        success: true,
        status: 'ALL_TRADING_RESUMED',
        timestamp: new Date(),
        message: 'All trading operations resumed'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/commander/emergency/close-all-positions
   * Emergency: Close all open positions immediately
   */
  router.post('/commander/emergency/close-all-positions', async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;

      // Get all open trades and close them
      const status = tradingEngine.getStatus();
      const trades = status.activeTrades || [];
      const closed: any[] = [];

      for (const trade of trades) {
        await tradingEngine.closeTrade(
          trade.id,
          trade.entryPrice,
          'MANUAL'
        );
        closed.push(trade.id);
      }

      res.json({
        success: true,
        status: 'ALL_POSITIONS_CLOSED',
        positionsClosed: closed.length,
        reason,
        timestamp: new Date()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 9. AUTONOMY CONFIGURATION
  // ============================================

  /**
   * GET /api/commander/autonomy/current
   * Get current autonomy configuration
   */
  router.get('/commander/autonomy/current', async (req: Request, res: Response) => {
    try {
      const config = approvalSystem.getAutonomyConfig();

      res.json({
        success: true,
        config,
        mode: determineMode(config)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/commander/autonomy/set
   * Set autonomy level (FULL, HYBRID, NONE)
   */
  router.post('/commander/autonomy/set', async (req: Request, res: Response) => {
    try {
      const { mode } = req.body;

      // mode: "FULL_AUTONOMY", "HYBRID_OPTIMAL", "FULL_MANUAL_CONTROL"

      if (mode === 'FULL_AUTONOMY') {
        approvalSystem.setFullAutonomy();
      } else if (mode === 'FULL_MANUAL_CONTROL') {
        approvalSystem.setFullManualControl();
      } else if (mode === 'HYBRID_OPTIMAL') {
        approvalSystem.setHybridMode();
      }

      const config = approvalSystem.getAutonomyConfig();

      res.json({
        success: true,
        mode,
        config,
        message: `Autonomy level set to ${mode}`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 10. DECISION HISTORY
  // ============================================

  /**
   * GET /api/commander/decisions/history
   * Get decision history
   */
  router.get('/commander/decisions/history', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = approvalSystem.getDecisionHistory(limit);

      res.json({
        success: true,
        total: history.length,
        history
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 11. REAL MARKET DATA
  // ============================================

  /**
   * GET /api/commander/market-data
   * Fetch real market data from exchanges
   */
  router.get('/commander/market-data', async (req: Request, res: Response) => {
    try {
      const feed = await ExchangeDataFeed.create();

      // Fetch real market data for top symbols
      const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'ADA/USDT', 'XRP/USDT'];
      const marketData = await Promise.all(
        symbols.map(async (symbol: string) => {
          try {
            const frames = await feed.fetchMarketData(symbol, '1h', 50);
            if (!frames || frames.length < 2) return null;
            
            const latest = frames[frames.length - 1];
            const first = frames[0];

            return {
              symbol,
              price: latest.price.close,
              open: latest.price.open,
              high: latest.price.high,
              low: latest.price.low,
              volume: latest.volume,
              rsi: latest.indicators.rsi || 0,
              macd: latest.indicators.macd.macd || 0,
              ema20: latest.indicators.ema20 || 0,
              ema200: latest.indicators.ema200 || 0,
              timestamp: latest.timestamp,
              changePercent: ((latest.price.close - first.price.open) / first.price.open) * 100
            };
          } catch (error) {
            console.error(`Failed to fetch ${symbol}:`, error);
            return null;
          }
        })
      );

      res.json({
        success: true,
        marketData: marketData.filter((m: any) => m !== null),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 12. REAL ML PREDICTIONS
  // ============================================

  /**
   * GET /api/commander/ml-insights
   * Get real ML predictions for a symbol
   */
  router.get('/commander/ml-insights', async (req: Request, res: Response) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTC/USDT';
      const feed = await ExchangeDataFeed.create();

      // Get real market data
      const frames = await feed.fetchMarketData(symbol, '1h', 100);
      if (!frames || frames.length === 0) {
        return res.json({ success: false, error: 'No market data available' });
      }

      // Convert to chart data format
      const chartData = frames.map((f: any) => ({
        timestamp: f.timestamp,
        open: f.price.open,
        high: f.price.high,
        low: f.price.low,
        close: f.price.close,
        volume: f.volume
      }));

      // Generate REAL ML predictions
      const predictions = await MLPredictionService.generatePredictions(chartData);

      res.json({
        success: true,
        symbol,
        predictions,
        latestPrice: frames[frames.length - 1].price.close,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 13. REAL PATTERN DETECTION
  // ============================================

  /**
   * GET /api/commander/patterns
   * Detect real patterns from market data
   */
  router.get('/commander/patterns', async (req: Request, res: Response) => {
    try {
      const symbol = (req.query.symbol as string) || 'BTC/USDT';
      const feed = await ExchangeDataFeed.create();

      // Get real market data
      const frames = await feed.fetchMarketData(symbol, '1h', 50);
      if (!frames || frames.length < 2) {
        return res.json({ success: false, error: 'Insufficient data for pattern detection' });
      }
      
      const latest = frames[frames.length - 1];
      const prev = frames[frames.length - 2];

      // Detect REAL patterns from actual market data
      const patternResult = PatternDetectionEngine.detectPatterns(
        latest.price.close,
        prev.price.close,
        latest.price.low,
        latest.price.high,
        latest.volume,
        prev.volume,
        latest.indicators.rsi,
        latest.indicators.macd,
        latest.indicators.ema20,
        latest.indicators.ema50,
        latest.indicators.ema200,
        latest.indicators.bb,
        latest.indicators.atr,
        latest.indicators.atr
      );

      res.json({
        success: true,
        symbol,
        patterns: patternResult,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // 14. REAL PORTFOLIO METRICS
  // ============================================

  /**
   * GET /api/commander/portfolio-metrics
   * Get real portfolio performance metrics
   */
  router.get('/commander/portfolio-metrics', async (req: Request, res: Response) => {
    try {
      const simulator = new EnhancedPortfolioSimulator();
      const metrics = simulator.getPerformanceMetrics();
      const trades = simulator.getClosedTrades();
      const equityCurve = simulator.getEquityCurve();

      res.json({
        success: true,
        metrics,
        totalTrades: trades.length,
        recentTrades: trades.slice(-10),
        equityCurve: equityCurve.slice(-30), // Last 30 data points
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function determineMode(config: any): string {
  if (
    config.tradeExecution.autonomy === 'FULL' &&
    config.agentProposal.autonomy === 'FULL' &&
    config.strategyChange.autonomy === 'FULL'
  ) {
    return 'FULL_AUTONOMY';
  }

  if (
    config.tradeExecution.autonomy === 'NONE' &&
    config.agentProposal.autonomy === 'NONE' &&
    config.strategyChange.autonomy === 'NONE'
  ) {
    return 'FULL_MANUAL_CONTROL';
  }

  return 'HYBRID_OPTIMAL';
}
