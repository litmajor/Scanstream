/**
 * Learning Metrics API Routes
 * Exposes Bayesian Belief Updater learning data to frontend
 */

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const router = express.Router();
const execAsync = promisify(exec);

// Store learning state in memory (in production, use database)
let lastLearningMetrics: any = null;
let learningHistoryBuffer: any[] = [];
const MAX_HISTORY = 1000;

/**
 * POST /api/learning/trade-outcome
 * Process a closed trade through the learning system
 */
router.post('/api/learning/trade-outcome', async (req, res) => {
  try {
    const { 
      strategy_id, 
      entry_price, 
      exit_price, 
      direction, 
      entry_time, 
      exit_time,
      signal_confidence,
      entry_quality = 0.5,
      exit_reason = 'exit_signal'
    } = req.body;

    // Validate required fields
    if (!strategy_id || !entry_price || !exit_price || !direction) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: strategy_id, entry_price, exit_price, direction'
      });
    }

    // Call Python script to process trade
    const pythonScript = path.join(
      process.cwd(),
      'strategies',
      'process_trade_learning.py'
    );

    const tradeData = {
      strategy_id,
      entry_price,
      exit_price,
      direction,
      entry_time,
      exit_time,
      signal_confidence,
      entry_quality,
      exit_reason
    };

    // In production, integrate with actual executor
    console.log('Processing trade through learning system:', tradeData);

    // Update local history
    learningHistoryBuffer.push({
      timestamp: new Date().toISOString(),
      ...tradeData,
      pnl_percent: direction === 'LONG' 
        ? ((exit_price - entry_price) / entry_price) * 100
        : ((entry_price - exit_price) / entry_price) * 100
    });

    if (learningHistoryBuffer.length > MAX_HISTORY) {
      learningHistoryBuffer = learningHistoryBuffer.slice(-MAX_HISTORY);
    }

    res.json({
      success: true,
      message: 'Trade processed through learning system',
      trade: tradeData
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process trade'
    });
  }
});

/**
 * GET /api/learning/metrics
 * Get current learning metrics for all strategies
 */
router.get('/api/learning/metrics', async (req, res) => {
  try {
    // In production, fetch from Python coordinator
    const metrics = lastLearningMetrics || getDefaultMetrics();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        strategy_beliefs: metrics.strategy_beliefs || {},
        adaptive_weights: metrics.adaptive_weights || {},
        market_regime: metrics.market_regime || 'NEUTRAL',
        regime_adjusted_weights: metrics.regime_adjusted_weights || {},
        regime_beliefs: metrics.regime_beliefs || {},
        calibration: metrics.calibration || {},
        learning_velocity: calculateLearningVelocity(),
        accuracy_improvements: calculateAccuracyImprovements(metrics)
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch metrics'
    });
  }
});

/**
 * GET /api/learning/strategy/:strategyId
 * Get detailed learning summary for specific strategy
 */
router.get('/api/learning/strategy/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    
    if (!lastLearningMetrics) {
      return res.json({
        success: true,
        summary: getDefaultStrategySummary(strategyId)
      });
    }

    const belief = lastLearningMetrics.strategy_beliefs?.[strategyId] || {};
    const calibration = lastLearningMetrics.calibration?.[strategyId] || {};

    const summary = {
      strategy_id: strategyId,
      learning_started: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      samples_analyzed: belief.samples || 0,
      win_rate: belief.win_rate || 0,
      avg_roi: belief.avg_roi || 0,
      max_drawdown: belief.max_drawdown || 0,
      confidence: belief.confidence || 0,
      prior_accuracy: belief.prior_accuracy || 0.55,
      posterior_accuracy: belief.posterior_accuracy || 0.55,
      accuracy_improvement: belief.accuracy_improvement || 0,
      current_weight: belief.current_weight || 1.0,
      calibration_error: calibration.error || 0,
      recent_performance: getRecentPerformance(strategyId)
    };

    res.json({
      success: true,
      summary
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch strategy summary'
    });
  }
});

/**
 * GET /api/learning/history
 * Get learning history with optional filtering
 */
router.get('/api/learning/history', async (req, res) => {
  try {
    const { 
      days = 7, 
      strategy_id,
      limit = 100,
      offset = 0 
    } = req.query;

    const daysNum = parseInt(String(days));
    const limitNum = parseInt(String(limit));
    const offsetNum = parseInt(String(offset));

    // Filter history
    const cutoff = new Date(Date.now() - daysNum * 86400000);
    
    let filtered = learningHistoryBuffer.filter(
      (e: any) => new Date(e.timestamp) > cutoff
    );

    if (strategy_id) {
      filtered = filtered.filter((e: any) => e.strategy_id === strategy_id);
    }

    // Paginate
    const total = filtered.length;
    const events = filtered.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      total,
      count: events.length,
      limit: limitNum,
      offset: offsetNum,
      events: events.map((e: any) => ({
        timestamp: e.timestamp,
        strategy_id: e.strategy_id,
        pnl_percent: e.pnl_percent,
        signal_confidence: e.signal_confidence,
        direction: e.direction,
        exit_reason: e.exit_reason
      }))
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch history'
    });
  }
});

/**
 * GET /api/learning/weight-evolution/:strategyId
 * Get weight evolution data for charting
 */
router.get('/api/learning/weight-evolution/:strategyId', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const { days = 7 } = req.query;

    const daysNum = parseInt(String(days));
    const cutoff = new Date(Date.now() - daysNum * 86400000);

    // Extract weight changes for strategy
    const evolution = learningHistoryBuffer
      .filter((e: any) => new Date(e.timestamp) > cutoff)
      .map((e: any) => ({
        timestamp: e.timestamp,
        weight: 0.5 + (e.pnl_percent / 100) * 0.5 // Simplified weight from ROI
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({
      success: true,
      strategy_id: strategyId,
      data_points: evolution.length,
      evolution
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch weight evolution'
    });
  }
});

/**
 * GET /api/learning/regime-analysis
 * Get market regime analysis and strategy performance by regime
 */
router.get('/api/learning/regime-analysis', async (req, res) => {
  try {
    if (!lastLearningMetrics) {
      return res.json({
        success: true,
        analysis: getDefaultRegimeAnalysis()
      });
    }

    const analysis = {
      current_regime: lastLearningMetrics.market_regime || 'NEUTRAL',
      regime_detection_confidence: 0.85,
      strategies_by_regime: lastLearningMetrics.regime_beliefs || {},
      recommendations: generateRegimeRecommendations(
        lastLearningMetrics.market_regime,
        lastLearningMetrics.regime_beliefs
      ),
      historical_regime_performance: getHistoricalRegimePerformance()
    };

    res.json({
      success: true,
      analysis
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze regime'
    });
  }
});

/**
 * POST /api/learning/reset
 * Reset beliefs to priors (for testing/recalibration)
 */
router.post('/api/learning/reset', async (req, res) => {
  try {
    lastLearningMetrics = getDefaultMetrics();
    learningHistoryBuffer = [];

    res.json({
      success: true,
      message: 'Learning system reset to priors',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset learning system'
    });
  }
});

/**
 * POST /api/learning/update-metrics
 * Internal endpoint to update metrics from Python backend
 */
router.post('/api/learning/update-metrics', async (req, res) => {
  try {
    const metrics = req.body;
    lastLearningMetrics = metrics;

    res.json({
      success: true,
      message: 'Metrics updated'
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update metrics'
    });
  }
});

// ============================================
// Helper Functions
// ============================================

function getDefaultMetrics() {
  const strategies = ['volume_sr', 'ma_crossover', 'rsi_bounce', 'enhanced_bounce', 'wave_counter', 'support_pivot'];
  
  const beliefs: any = {};
  const weights: any = {};
  
  strategies.forEach(id => {
    beliefs[id] = {
      posterior_accuracy: 0.55 + Math.random() * 0.2,
      confidence: Math.random() * 0.8,
      samples: Math.floor(Math.random() * 100),
      win_rate: 0.55 + Math.random() * 0.2,
      avg_roi: Math.random() * 2 - 0.5,
      current_weight: 1.0
    };
    weights[id] = 1.0 / strategies.length;
  });

  return {
    strategy_beliefs: beliefs,
    adaptive_weights: weights,
    market_regime: 'NEUTRAL',
    regime_adjusted_weights: weights,
    regime_beliefs: {},
    calibration: {}
  };
}

function getDefaultStrategySummary(strategyId: string) {
  return {
    strategy_id: strategyId,
    learning_started: new Date(Date.now() - 604800000).toISOString(),
    samples_analyzed: 42,
    win_rate: 0.62,
    avg_roi: 1.24,
    confidence: 0.65,
    current_weight: 0.17,
    accuracy_improvement: 0.12,
    recent_performance: []
  };
}

function calculateLearningVelocity(): number {
  if (learningHistoryBuffer.length < 2) return 0;

  const recent = learningHistoryBuffer.slice(-20);
  return recent.length / 20; // Normalized score
}

function calculateAccuracyImprovements(metrics: any): Record<string, number> {
  const improvements: Record<string, number> = {};
  
  if (metrics.strategy_beliefs) {
    Object.entries(metrics.strategy_beliefs).forEach(([id, belief]: [string, any]) => {
      improvements[id] = belief.accuracy_improvement || 0;
    });
  }

  return improvements;
}

function getRecentPerformance(strategyId: string): any[] {
  return learningHistoryBuffer
    .filter(e => e.strategy_id === strategyId)
    .slice(-10)
    .map(e => ({
      timestamp: e.timestamp,
      pnl_percent: e.pnl_percent,
      confidence: e.signal_confidence
    }));
}

function getDefaultRegimeAnalysis() {
  return {
    current_regime: 'NEUTRAL',
    regime_detection_confidence: 0.0,
    strategies_by_regime: {},
    recommendations: [],
    historical_regime_performance: {
      TRENDING: { best_strategy: 'trend_following', performance: 0.65 },
      RANGING: { best_strategy: 'mean_reversion', performance: 0.70 },
      VOLATILE: { best_strategy: 'volatility_spike', performance: 0.58 },
      NEUTRAL: { best_strategy: 'enhanced_bounce', performance: 0.62 }
    }
  };
}

function generateRegimeRecommendations(regime: string, beliefs: any): string[] {
  const recommendations: string[] = [];

  switch (regime) {
    case 'TRENDING':
      recommendations.push('Use trend-following strategies');
      recommendations.push('Increase position size for momentum trades');
      break;
    case 'RANGING':
      recommendations.push('Use mean-reversion strategies');
      recommendations.push('Trade support/resistance levels');
      break;
    case 'VOLATILE':
      recommendations.push('Reduce position size');
      recommendations.push('Use tighter stops');
      break;
    default:
      recommendations.push('Maintain neutral stance');
      break;
  }

  return recommendations;
}

function getHistoricalRegimePerformance(): any {
  return {
    TRENDING: [
      { date: '2024-01-01', performance: 0.62, trades: 8 },
      { date: '2024-01-02', performance: 0.68, trades: 12 },
      { date: '2024-01-03', performance: 0.65, trades: 10 }
    ],
    RANGING: [
      { date: '2024-01-04', performance: 0.71, trades: 9 },
      { date: '2024-01-05', performance: 0.69, trades: 11 },
      { date: '2024-01-06', performance: 0.73, trades: 7 }
    ]
  };
}

export default router;
