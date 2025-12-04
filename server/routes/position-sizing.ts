
/**
 * Position Sizing API - Phase 2
 * Endpoints for monitoring, validating, and A/B testing Dynamic Position Sizer
 * Includes Kelly Criterion validation and statistical significance testing
 */

import { Router } from 'express';
import { dynamicPositionSizer } from '../services/dynamic-position-sizer';
import { positionSizerTrainer } from '../scripts/train-position-sizer';
import { kellyValidator } from '../services/kelly-validator';
import { abTestingFramework } from '../services/ab-testing-framework';
import { HistoricalBacktester } from '../services/historical-backtester';

const router = Router();

/**
 * GET /api/position-sizing/stats
 * Get RL Agent statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = dynamicPositionSizer.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/position-sizing/train
 * Trigger training on historical data
 */
router.post('/train', async (req, res) => {
  try {
    await positionSizerTrainer.trainOnHistoricalData();
    
    res.json({
      success: true,
      message: 'Training completed',
      stats: dynamicPositionSizer.getStats()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Training failed'
    });
  }
});

/**
 * POST /api/position-sizing/simulate
 * Simulate position sizing for given parameters
 */
router.post('/simulate', (req, res) => {
  try {
    const {
      symbol,
      confidence,
      signalType,
      accountBalance,
      currentPrice,
      atr,
      marketRegime,
      primaryPattern,
      trendDirection = 'SIDEWAYS',
      sma20 = 0,
      sma50 = 0
    } = req.body;
    
    const sizing = dynamicPositionSizer.calculatePositionSize({
      symbol,
      confidence: parseFloat(confidence),
      signalType,
      accountBalance: parseFloat(accountBalance),
      currentPrice: parseFloat(currentPrice),
      atr: parseFloat(atr),
      marketRegime,
      primaryPattern,
      trendDirection,
      sma20: parseFloat(sma20),
      sma50: parseFloat(sma50)
    });
    
    res.json({
      success: true,
      sizing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed'
    });
  }
});

/**
 * POST /api/position-sizing/train-on-backtest
 * Train RL agent on real historical backtest trades
 */
router.post('/train-on-backtest', async (req, res) => {
  try {
    const { startDate, endDate, assets } = req.body;
    
    const backtester = new HistoricalBacktester();
    backtester.clearCollectedTrades();
    
    const config = {
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      assets: assets || undefined
    };
    
    console.log('[Position Sizing API] Running backtest to collect trade records...');
    const result = await backtester.runHistoricalBacktest(config);
    const trades = backtester.getCollectedTrades();
    
    console.log(`[Position Sizing API] Collected ${trades.length} trades for RL training`);
    
    if (trades.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient trades for training (minimum 50 required)',
        tradesCollected: trades.length
      });
    }
    
    const rlTrades = trades.map(t => ({
      symbol: t.symbol,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      confidence: t.confidence,
      regime: t.regime,
      volatility: t.volatilityRatio,
      takeProfit: t.entryPrice * (1 + t.profitTargetPercent / 100),
      stopLoss: t.entryPrice * (1 - t.stopLossPercent / 100),
      sizeMultiplier: 1.0,
      maxDrawdown: t.hitStop ? -t.stopLossPercent / 100 : 0,
      pnlPercent: t.actualPnlPercent,
      riskReward: t.profitTargetPercent / t.stopLossPercent,
      holdingPeriodHours: t.holdingPeriodHours,
      trend: t.actualPnlPercent > 0 ? 1 : -1,
      momentum: t.actualPnlPercent / 10,
      volumeRatio: t.volumeRatio,
      rsi: t.rsi
    }));
    
    await dynamicPositionSizer.trainOnHistoricalTrades(rlTrades);
    
    res.json({
      success: true,
      message: `RL Agent trained on ${trades.length} real backtest trades`,
      tradesCollected: trades.length,
      backtestMetrics: result.metrics,
      rlStats: dynamicPositionSizer.getStats()
    });
  } catch (error) {
    console.error('[Position Sizing API] Training error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Training failed'
    });
  }
});

/**
 * GET /api/position-sizing/kelly-validation
 * Validate Kelly Criterion predictions vs actual performance
 */
router.get('/kelly-validation', async (req, res) => {
  try {
    const backtester = new HistoricalBacktester();
    backtester.clearCollectedTrades();
    
    // Use full production asset universe matching training endpoint
    const defaultAssets = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX',
      'JPM', 'V', 'MA', 'BAC', 'WMT', 'DIS', 'PYPL', 'ADBE', 'CRM', 'ORCL',
      'BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'LINK', 'ATOM', 'NEAR', 'ARB'
    ];
    
    const config = {
      startDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      assets: defaultAssets
    };
    
    await backtester.runHistoricalBacktest(config);
    const trades = backtester.getCollectedTrades();
    
    if (trades.length < 30) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient trades for Kelly validation',
        tradesCollected: trades.length
      });
    }
    
    const validation = kellyValidator.validateByPattern(trades);
    const patternStats = kellyValidator.getPatternStats(trades);
    
    res.json({
      success: true,
      validation,
      patternStats,
      tradesAnalyzed: trades.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    });
  }
});

/**
 * POST /api/position-sizing/ab-test
 * Run A/B test comparing flat vs dynamic sizing
 */
router.post('/ab-test', async (req, res) => {
  try {
    const { startDate, endDate, runBootstrap } = req.body;
    
    const backtester = new HistoricalBacktester();
    backtester.clearCollectedTrades();
    
    // Use full production asset universe matching training endpoint
    const defaultAssets = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX',
      'JPM', 'V', 'MA', 'BAC', 'WMT', 'DIS', 'PYPL', 'ADBE', 'CRM', 'ORCL',
      'BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'LINK', 'ATOM', 'NEAR', 'ARB'
    ];
    
    const config = {
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      assets: defaultAssets
    };
    
    await backtester.runHistoricalBacktest(config);
    const trades = backtester.getCollectedTrades();
    
    if (trades.length < 30) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient trades for A/B test (minimum 30 required)',
        tradesCollected: trades.length
      });
    }
    
    const abResult = abTestingFramework.runABTest(trades);
    
    let bootstrapResult = null;
    if (runBootstrap) {
      bootstrapResult = abTestingFramework.runBootstrapTest(trades, 500);
    }
    
    res.json({
      success: true,
      abTest: abResult,
      bootstrap: bootstrapResult,
      tradesAnalyzed: trades.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'A/B test failed'
    });
  }
});

/**
 * GET /api/position-sizing/pattern-stats
 * Get performance statistics by pattern for position sizing
 */
router.get('/pattern-stats', async (req, res) => {
  try {
    const backtester = new HistoricalBacktester();
    backtester.clearCollectedTrades();
    
    // Use full production asset universe matching training endpoint
    const defaultAssets = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX',
      'JPM', 'V', 'MA', 'BAC', 'WMT', 'DIS', 'PYPL', 'ADBE', 'CRM', 'ORCL',
      'BTC', 'ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'LINK', 'ATOM', 'NEAR', 'ARB'
    ];
    
    const config = {
      startDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      assets: defaultAssets
    };
    
    await backtester.runHistoricalBacktest(config);
    const trades = backtester.getCollectedTrades();
    
    const patternStats = kellyValidator.getPatternStats(trades);
    
    res.json({
      success: true,
      patternStats,
      tradesAnalyzed: trades.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pattern stats'
    });
  }
});

export default router;
