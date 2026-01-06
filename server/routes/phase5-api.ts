/**
 * PHASE 5: FRONTEND DATA API ENDPOINTS
 * 
 * Provides data for Phase 5 visualization components:
 * - Signal Transparency (source breakdown, confidence)
 * - Agent Leaderboard (performance metrics)
 * - Signal History (trade history, accuracy)
 * - Regime Display (market conditions, weights)
 */

import express, { Router, Request, Response } from 'express';
import { db } from '../db-storage';

const router = Router();

/**
 * GET /api/phase5/signal-transparency
 * Returns current signal breakdown across all 4 sources
 */
router.get('/signal-transparency', async (req: Request, res: Response) => {
  try {
    const latestSignal = await db.query(`
      SELECT 
        scanner_score,
        scanner_reasoning,
        ml_score,
        ml_reasoning,
        rl_score,
        rl_reasoning,
        rpg_score,
        rpg_reasoning,
        composite_quality,
        confidence_level,
        timestamp,
        signal_source_metrics
      FROM signals
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    if (latestSignal.rows.length === 0) {
      return res.status(404).json({
        error: 'No recent signals found'
      });
    }

    const signal = latestSignal.rows[0];

    res.json({
      scanner: {
        score: signal.scanner_score,
        reasoning: signal.scanner_reasoning,
        component: {
          volatility: signal.signal_source_metrics?.scanner?.volatility || 0,
          trend: signal.signal_source_metrics?.scanner?.trend || 0,
          support: signal.signal_source_metrics?.scanner?.support || 0,
          pattern: signal.signal_source_metrics?.scanner?.pattern || 0
        }
      },
      ml: {
        score: signal.ml_score,
        reasoning: signal.ml_reasoning,
        component: {
          predictions: signal.signal_source_metrics?.ml?.predictions || 0,
          confidence: signal.signal_source_metrics?.ml?.confidence || 0,
          accuracy: signal.signal_source_metrics?.ml?.accuracy || 0,
          consistency: signal.signal_source_metrics?.ml?.consistency || 0
        }
      },
      rl: {
        score: signal.rl_score,
        reasoning: signal.rl_reasoning,
        component: {
          exploitation: signal.signal_source_metrics?.rl?.exploitation || 0,
          exploration: signal.signal_source_metrics?.rl?.exploration || 0,
          reward: signal.signal_source_metrics?.rl?.reward || 0,
          convergence: signal.signal_source_metrics?.rl?.convergence || 0
        }
      },
      rpg: {
        score: signal.rpg_score,
        reasoning: signal.rpg_reasoning,
        component: {
          consensus: signal.signal_source_metrics?.rpg?.consensus || 0,
          combo: signal.signal_source_metrics?.rpg?.combo || 0,
          strength: signal.signal_source_metrics?.rpg?.strength || 0,
          coordination: signal.signal_source_metrics?.rpg?.coordination || 0
        }
      },
      composite: {
        quality: signal.composite_quality,
        confidence: signal.confidence_level
      },
      timestamp: signal.timestamp
    });
  } catch (error) {
    console.error('Error fetching signal transparency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/agent-leaderboard
 * Returns performance metrics for all 5 RPG agents
 */
router.get('/agent-leaderboard', async (req: Request, res: Response) => {
  try {
    const agents = await db.query(`
      SELECT 
        agent_id,
        agent_name,
        strategy,
        total_trades,
        winning_trades,
        sharpe_ratio,
        max_drawdown,
        profit_factor,
        last_active_time,
        achievements,
        performance_trend,
        status,
        active_signals,
        rank
      FROM agent_performance
      ORDER BY rank ASC
    `);

    const leaderboard = agents.rows.map((agent: any) => ({
      id: agent.agent_id,
      name: agent.agent_name,
      strategy: agent.strategy,
      rank: agent.rank,
      winRate: agent.total_trades > 0 ? (agent.winning_trades / agent.total_trades) * 100 : 0,
      totalTrades: agent.total_trades,
      sharpeRatio: agent.sharpe_ratio,
      maxDrawdown: agent.max_drawdown,
      profitFactor: agent.profit_factor,
      activeSignals: agent.active_signals,
      lastActiveTime: agent.last_active_time,
      achievements: agent.achievements || [],
      performanceTrend: agent.performance_trend,
      status: agent.status
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching agent leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/signal-history
 * Returns paginated signal history with filtering
 */
router.get('/signal-history', async (req: Request, res: Response) => {
  try {
    const { source, status, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        id,
        symbol,
        entry_price,
        exit_price,
        profit_loss,
        quality_score,
        confidence_level,
        signal_source,
        status,
        timestamp,
        actual_outcome,
        prediction_accuracy,
        duration_minutes,
        reasoning
      FROM signal_history
      WHERE 1=1
    `;

    const params: any[] = [];

    if (source) {
      query += ` AND signal_source = $${params.length + 1}`;
      params.push(source);
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const signals = result.rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      symbol: row.symbol,
      signalSource: row.signal_source,
      entryPrice: row.entry_price,
      exitPrice: row.exit_price,
      profitLoss: row.profit_loss,
      profitLossPercent: row.exit_price
        ? ((row.exit_price - row.entry_price) / row.entry_price) * 100
        : null,
      quality: row.quality_score,
      confidence: row.confidence_level,
      status: row.status,
      actualOutcome: row.actual_outcome,
      outcomeAccuracy: row.prediction_accuracy,
      duration: row.duration_minutes,
      reason: row.reasoning
    }));

    res.json(signals);
  } catch (error) {
    console.error('Error fetching signal history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/signal-history/stats
 * Returns statistics about signal accuracy and performance
 */
router.get('/signal-history/stats', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_signals,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_signals,
        SUM(CASE WHEN actual_outcome = 'WIN' THEN 1 ELSE 0 END) as winning_signals,
        AVG(profit_loss) as avg_pnl,
        SUM(CASE WHEN prediction_accuracy = true THEN 1 ELSE 0 END) as accurate_predictions,
        AVG(quality_score) as avg_quality,
        AVG(confidence_level) as avg_confidence
      FROM signal_history
      WHERE timestamp >= NOW() - INTERVAL '30 days'
    `);

    const row = result.rows[0];
    const closedSignals = parseInt(row.closed_signals) || 0;

    res.json({
      totalSignals: parseInt(row.total_signals),
      closedSignals: closedSignals,
      winRate: closedSignals > 0 ? (parseInt(row.winning_signals) / closedSignals) * 100 : 0,
      avgPnL: parseFloat(row.avg_pnl) || 0,
      accuracyRate: closedSignals > 0 ? (parseInt(row.accurate_predictions) / closedSignals) * 100 : 0,
      avgQuality: parseFloat(row.avg_quality) || 0,
      avgConfidence: parseFloat(row.avg_confidence) || 0
    });
  } catch (error) {
    console.error('Error fetching signal history stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/regime
 * Returns current market regime, weights, and transitions
 */
router.get('/regime', async (req: Request, res: Response) => {
  try {
    const regimeResult = await db.query(`
      SELECT 
        current_regime,
        regime_confidence,
        scanner_weight,
        ml_weight,
        rl_weight,
        rpg_weight,
        volatility_level,
        trend_strength,
        timestamp
      FROM market_regime
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    if (regimeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No regime data found'
      });
    }

    const regime = regimeResult.rows[0];

    // Get recent transitions
    const transitionsResult = await db.query(`
      SELECT 
        from_regime,
        to_regime,
        confidence,
        timestamp
      FROM regime_transitions
      ORDER BY timestamp DESC
      LIMIT 20
    `);

    res.json({
      currentRegime: regime.current_regime,
      regimeConfidence: regime.regime_confidence,
      weights: {
        scanner: regime.scanner_weight,
        ml: regime.ml_weight,
        rl: regime.rl_weight,
        rpg: regime.rpg_weight
      },
      volatilityLevel: regime.volatility_level,
      trendStrength: regime.trend_strength,
      regimeHistory: transitionsResult.rows.map((t: any) => ({
        timestamp: t.timestamp,
        fromRegime: t.from_regime,
        toRegime: t.to_regime,
        confidence: t.confidence
      })),
      timestamp: regime.timestamp
    });
  } catch (error) {
    console.error('Error fetching regime data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/regime/history
 * Returns historical regime data for charting
 */
router.get('/regime/history', async (req: Request, res: Response) => {
  try {
    const { hours = 24 } = req.query;

    const result = await db.query(
      `
      SELECT 
        current_regime,
        regime_confidence,
        scanner_weight,
        ml_weight,
        rl_weight,
        rpg_weight,
        volatility_level,
        trend_strength,
        timestamp
      FROM market_regime
      WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp ASC
    `
    );

    const history = result.rows.map((row: any) => ({
      timestamp: row.timestamp,
      regime: row.current_regime,
      confidence: row.regime_confidence,
      weights: {
        scanner: row.scanner_weight,
        ml: row.ml_weight,
        rl: row.rl_weight,
        rpg: row.rpg_weight
      },
      volatility: row.volatility_level,
      trend: row.trend_strength
    }));

    res.json(history);
  } catch (error) {
    console.error('Error fetching regime history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/quality-accuracy-correlation
 * Returns correlation between signal quality and actual outcomes
 */
router.get('/quality-accuracy-correlation', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        FLOOR(quality_score / 10) * 10 as quality_bucket,
        COUNT(*) as total_signals,
        SUM(CASE WHEN actual_outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
        AVG(profit_loss) as avg_pnl
      FROM signal_history
      WHERE status = 'closed' AND actual_outcome IS NOT NULL
      AND timestamp >= NOW() - INTERVAL '60 days'
      GROUP BY FLOOR(quality_score / 10) * 10
      ORDER BY quality_bucket ASC
    `);

    const correlation = result.rows.map((row: any) => ({
      qualityBucket: `${row.quality_bucket}-${row.quality_bucket + 9}%`,
      qualityMid: row.quality_bucket + 5,
      totalSignals: row.total_signals,
      winRate: row.total_signals > 0 ? (row.wins / row.total_signals) * 100 : 0,
      avgPnL: parseFloat(row.avg_pnl) || 0
    }));

    res.json(correlation);
  } catch (error) {
    console.error('Error calculating quality accuracy correlation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/phase5/confidence-pnl-correlation
 * Returns correlation between confidence level and P&L outcomes
 */
router.get('/confidence-pnl-correlation', async (req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT 
        FLOOR(confidence_level / 10) * 10 as confidence_bucket,
        COUNT(*) as total_signals,
        AVG(profit_loss) as avg_pnl,
        STDDEV(profit_loss) as pnl_stddev
      FROM signal_history
      WHERE status = 'closed' AND profit_loss IS NOT NULL
      AND timestamp >= NOW() - INTERVAL '60 days'
      GROUP BY FLOOR(confidence_level / 10) * 10
      ORDER BY confidence_bucket ASC
    `);

    const correlation = result.rows.map((row: any) => ({
      confidenceBucket: `${row.confidence_bucket}-${row.confidence_bucket + 9}%`,
      confidenceMid: row.confidence_bucket + 5,
      totalSignals: row.total_signals,
      avgPnL: parseFloat(row.avg_pnl) || 0,
      pnlStdDev: parseFloat(row.pnl_stddev) || 0
    }));

    res.json(correlation);
  } catch (error) {
    console.error('Error calculating confidence P&L correlation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
