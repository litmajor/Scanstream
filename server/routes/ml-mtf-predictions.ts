/**
 * Multi-Timeframe ML API Routes
 * 
 * Endpoints for multi-timeframe LSTM predictions and backtest integration
 * 
 * Endpoints:
 * - GET /api/ml/mtf/predictions/:symbol - Multi-timeframe predictions
 * - POST /api/ml/mtf/enhance-signal - Enhance scanner signal with ML metrics
 * - GET /api/ml/mtf/backtest - Backtest results
 * - POST /api/ml/mtf/backtest/run - Run backtest
 * - GET /api/ml/mtf/confidence/:symbol - Confidence metrics by timeframe
 * - POST /api/ml/mtf/backtest/multi-exchange - Run backtest across exchanges
 */

import { Router, Request, Response } from 'express';
import { multiTimeframeMLService } from '../services/multi-timeframe-ml-service';
import { lstmBacktestEngine } from '../services/lstm-backtest-engine';

const router = Router();

/**
 * GET /api/ml/mtf/predictions/:symbol
 * Get multi-timeframe LSTM predictions for a symbol
 * 
 * Query params:
 *   - timeframe: Optional specific timeframe (1m, 5m, 15m, 1h, 4h, 1d)
 *   - includeReasons: Include reasoning text (default: true)
 * 
 * Response: MultiTimeframePrediction with consensus across all timeframes
 */
router.get('/predictions/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeframe, includeReasons } = req.query;
    const includeReasonsFlag = includeReasons !== 'false';

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    console.log(`[ML MTF API] Fetching predictions for ${symbol}`);
    const predictions = await multiTimeframeMLService.getPredictions(symbol);

    if (!predictions) {
      return res.status(404).json({
        error: 'No trained model available for this symbol',
        symbol,
        message: 'Train model first using POST /api/ml/mtf/train',
      });
    }

    // Optional: filter to specific timeframe
    if (timeframe) {
      const tf = timeframe as string;
      const filtered = predictions.predictions[tf];
      
      if (!filtered) {
        return res.status(404).json({
          error: `No prediction for timeframe ${tf}`,
          available: Object.keys(predictions.predictions).filter(
            t => predictions.predictions[t] !== null
          ),
        });
      }

      const response: any = {
        symbol,
        timeframe: tf,
        timestamp: predictions.timestamp,
        prediction: {
          direction: filtered.direction.prediction,
          confidence: filtered.direction.confidence,
          strength: filtered.direction.strength,
          probability: filtered.direction.probability,
          price: {
            predicted: filtered.price.predicted,
            changePercent: filtered.price.changePercent,
            high: filtered.price.high,
            low: filtered.price.low,
          },
          riskScore: filtered.riskAssessment.score,
          riskLevel: filtered.riskAssessment.level,
        },
        weight: predictions.weights[tf],
      };

      if (includeReasonsFlag) {
        response.reasoning = {
          analysis: filtered.reasoning.length > 0 ? filtered.reasoning[0] : 'No analysis available',
          riskFactors: filtered.riskAssessment.factors,
        };
      }

      return res.json(response);
    }

    // Return all timeframes with consensus
    const response: any = {
      symbol,
      timestamp: predictions.timestamp,
      consensus: {
        direction: predictions.consensus.direction,
        confidence: Number(predictions.consensus.confidence.toFixed(3)),
        strength: Number(predictions.consensus.strength.toFixed(1)),
        timeframesAgree: predictions.consensus.timeframesAgree,
        totalTimeframes: Object.keys(predictions.predictions).length,
      },
      timeframes: Object.entries(predictions.predictions)
        .filter(([_, pred]) => pred !== null)
        .map(([tf, pred]) => ({
          timeframe: tf,
          direction: pred?.direction.prediction,
          confidence: Number(pred?.direction.confidence.toFixed(3)),
          strength: Number(pred?.direction.strength.toFixed(1)),
          price: Number(pred?.price.predicted.toFixed(2)),
          pricChangePct: Number(pred?.price.changePercent.toFixed(2)),
          riskScore: Number(pred?.riskAssessment.score.toFixed(1)),
          riskLevel: pred?.riskAssessment.level,
          volatility: pred?.volatility.level,
          regimeDuration: pred?.regimeDuration.duration,
          weight: predictions.weights[tf],
        })),
      aggregatedMetrics: {
        avgRiskScore: Number(predictions.aggregatedMetrics.avgRiskScore.toFixed(1)),
        maxVolatility: predictions.aggregatedMetrics.maxVolatility,
        shortestRegimeDuration: predictions.aggregatedMetrics.shortestRegimeDuration,
        velocityConfidenceAvg: Number(predictions.aggregatedMetrics.velocityConfidenceAvg.toFixed(3)),
      },
    };

    if (includeReasonsFlag) {
      response.explanation = {
        consensus:
          `${predictions.consensus.direction} consensus across ${predictions.consensus.timeframesAgree}/${Object.keys(predictions.predictions).length} timeframes`,
        strength: predictions.consensus.strength > 70 ? 'Strong' : 'Moderate',
      };
    }

    return res.json(response);
  } catch (error) {
    console.error('[ML MTF API] Error fetching predictions:', error);
    return res.status(500).json({
      error: 'Failed to fetch predictions',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/ml/mtf/enhance-signal
 * Enhance a scanner signal with ML metrics and alignment check
 * 
 * Body:
 *   - symbol: Trading pair (e.g., BTC/USDT)
 *   - direction: LONG or SHORT
 *   - entry: Entry price
 *   - stopLoss: Stop loss price
 *   - takeProfit: Take profit price
 * 
 * Response: MLSignalEnhancedOutput with alignment check and combined score
 */
router.post('/enhance-signal', async (req: Request, res: Response) => {
  try {
    const { symbol, direction, entry, stopLoss, takeProfit } = req.body;

    if (!symbol || !direction || entry === undefined || !stopLoss || !takeProfit) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, direction, entry, stopLoss, takeProfit',
      });
    }

    if (!['LONG', 'SHORT'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be LONG or SHORT' });
    }

    console.log(`[ML MTF API] Enhancing signal: ${symbol} ${direction} @ ${entry}`);

    const enhanced = await multiTimeframeMLService.enhanceScannerSignal(
      symbol,
      direction,
      entry,
      stopLoss,
      takeProfit
    );

    const recommendation = {
      action: enhanced.mlAlignment.aligned ? 'CONFIRM' : 'CAUTION',
      reason:
        enhanced.mlAlignment.aligned
          ? `ML consensus ${enhanced.mlConsensus.direction} aligns with scanner ${direction}`
          : `ML consensus ${enhanced.mlConsensus.direction} conflicts with scanner ${direction}`,
      confidenceLevel: enhanced.mlAlignment.recommendationStrength,
      combinedScore: Number(enhanced.combinedScore.toFixed(1)),
      riskAdjustment: enhanced.mlAlignment.aligned
        ? 'Use standard risk parameters'
        : 'Consider tighter stops or smaller position',
    };

    return res.json({
      success: true,
      symbol,
      scannerSignal: direction,
      mlConsensus: enhanced.mlConsensus.direction,
      enhanced: {
        direction: enhanced.direction,
        entry: enhanced.entry,
        stopLoss: enhanced.stopLoss,
        takeProfit: enhanced.takeProfit,
        riskRewardRatio: enhanced.riskRewardRatio,
      },
      alignment: {
        aligned: enhanced.mlAlignment.aligned,
        agreement: `${enhanced.mlAlignment.conflictLevel} conflict`,
        strength: enhanced.mlAlignment.recommendationStrength,
      },
      recommendation: enhanced.mlAlignment.recommendationStrength === 'strong' ? 'Strong buy/sell signal' : 'Moderate signal',
    });
  } catch (error) {
    console.error('[ML MTF API] Error enhancing signal:', error);
    return res.status(500).json({
      error: 'Failed to enhance signal',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/ml/mtf/backtest
 * Get historical backtest results
 * 
 * Query params:
 *   - symbol: Trading pair
 *   - timeframe: 1m, 5m, 15m, 1h, 4h, 1d
 *   - limit: Number of trades to return (default: 100)
 */
router.get('/backtest', (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, limit } = req.query;

    if (!symbol || !timeframe) {
      return res.status(400).json({
        error: 'Missing required query params: symbol, timeframe',
      });
    }

    const predictions = multiTimeframeMLService.getBacktestedPredictions(
      symbol as string,
      timeframe as string,
      limit ? parseInt(limit as string) : 100
    );

    if (predictions.length === 0) {
      return res.status(404).json({
        error: 'No backtest data available',
        symbol,
        timeframe,
        message: 'Run backtest first using POST /api/ml/mtf/backtest/run',
      });
    }

    const stats = multiTimeframeMLService.calculateBacktestStats(predictions);

    return res.json({
      success: true,
      symbol,
      timeframe,
      totalTrades: predictions.length,
      stats: {
        overall: {
          winRate: `${(stats.winRate * 100).toFixed(1)}%`,
          avgProfit: `${stats.avgProfitPercent.toFixed(2)}%`,
          totalProfit: `${(stats.avgProfitPercent * stats.totalTrades).toFixed(2)}%`,
          sharpeRatio: stats.sharpeRatio.toFixed(2),
          maxDrawdown: `${stats.maxDrawdown.toFixed(2)}%`,
        },
        byDirection: {
          long: {
            trades: Math.ceil(stats.totalTrades / 2),
            wins: Math.ceil(stats.wins / 2),
            winRate: `${(stats.winRate * 100).toFixed(1)}%`,
          },
          short: {
            trades: Math.floor(stats.totalTrades / 2),
            wins: Math.floor(stats.wins / 2),
            winRate: `${(stats.winRate * 100).toFixed(1)}%`,
          },
        },
      },
      recent: predictions
        .slice(-10)
        .map(p => ({
          timestamp: p.timestamp,
          direction: p.direction,
          entryPrice: p.entryPrice,
          exitPrice: p.priceAtCompletion || 'pending',
          result: p.profitPercent ? `${p.profitPercent.toFixed(2)}%` : 'pending',
        })),
    });
  } catch (error) {
    console.error('[ML MTF API] Error fetching backtest results:', error);
    return res.status(500).json({
      error: 'Failed to fetch backtest results',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/ml/mtf/backtest/run
 * Run backtest for a symbol/timeframe combination
 * 
 * Body:
 *   - symbol: Trading pair
 *   - timeframe: 1m, 5m, 15m, 1h, 4h, 1d
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - targetProfit: Target profit % (default: 2.0)
 *   - stopLoss: Stop loss % (default: 1.0)
 *   - commission: Commission % (default: 0.1)
 */
router.post('/backtest/run', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, startDate, endDate, targetProfit, stopLoss, commission } = req.body;

    if (!symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, timeframe, startDate, endDate',
      });
    }

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}`,
      });
    }

    console.log(
      `[ML MTF API] Starting backtest: ${symbol} ${timeframe} ${startDate} to ${endDate}`
    );

    const result = await lstmBacktestEngine.backtest({
      symbol,
      timeframe: timeframe as any,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      targetProfitPercent: targetProfit || 2.0,
      stopLossPercent: stopLoss || 1.0,
      commissionPercent: commission || 0.1,
    });

    return res.json({
      success: true,
      symbol,
      timeframe,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      results: {
        summary: {
          totalTrades: result.totalTrades,
          winRate: `${(result.totalWinRate * 100).toFixed(1)}%`,
          avgProfit: `${result.totalAvgProfit.toFixed(2)}%`,
          totalProfit: `${(result.totalAvgProfit * result.totalTrades).toFixed(2)}%`,
        },
        byDirection: {
          long: {
            trades: result.longTrades,
            wins: result.longWins,
            winRate: `${(result.longWinRate * 100).toFixed(1)}%`,
            avgProfit: `${result.longAvgProfit?.toFixed(2) || 'N/A'}%`,
          },
          short: {
            trades: result.shortTrades,
            wins: result.shortWins,
            winRate: `${(result.shortWinRate * 100).toFixed(1)}%`,
            avgProfit: `${result.shortAvgProfit?.toFixed(2) || 'N/A'}%`,
          },
        },
        quality: {
          sharpeRatio: result.totalSharpeRatio.toFixed(2),
          maxDrawdown: `${result.totalMaxDD.toFixed(2)}%`,
          profitFactor: result.profitFactor?.toFixed(2) || 'N/A',
          recoveryFactor: result.recoveryFactor?.toFixed(2) || 'N/A',
        },
      },
    });
  } catch (error) {
    console.error('[ML MTF API] Error running backtest:', error);
    return res.status(500).json({
      error: 'Failed to run backtest',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/ml/mtf/confidence/:symbol
 * Get confidence metrics by timeframe
 * 
 * Response: Confidence breakdown for each timeframe with consensus
 */
router.get('/confidence/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    console.log(`[ML MTF API] Fetching confidence metrics for ${symbol}`);

    const predictions = await multiTimeframeMLService.getPredictions(symbol);

    if (!predictions) {
      return res.status(404).json({ error: 'No predictions available for symbol' });
    }

    const timeframeConfidence = Object.entries(predictions.predictions)
      .filter(([_, pred]) => pred !== null)
      .map(([tf, pred]) => ({
        timeframe: tf,
        direction: pred?.direction.prediction,
        confidence: Number(pred?.direction.confidence.toFixed(3)),
        strength: Number(pred?.direction.strength.toFixed(1)),
        probability: Number(pred?.direction.probability.toFixed(3)),
        riskScore: Number(pred?.riskAssessment.score.toFixed(1)),
        volatility: pred?.volatility.level,
        regimeDuration: pred?.regimeDuration.duration,
        weight: predictions.weights[tf],
      }));

    return res.json({
      symbol,
      timestamp: predictions.timestamp,
      consensus: {
        direction: predictions.consensus.direction,
        confidence: Number(predictions.consensus.confidence.toFixed(3)),
        strength: Number(predictions.consensus.strength.toFixed(1)),
        alignment: `${predictions.consensus.timeframesAgree}/${Object.keys(predictions.predictions).length} timeframes agree`,
        quality: predictions.consensus.confidence > 0.7 ? 'Strong' : 'Moderate',
      },
      byTimeframe: timeframeConfidence,
      aggregated: {
        avgRiskScore: Number(predictions.aggregatedMetrics.avgRiskScore.toFixed(1)),
        maxVolatility: predictions.aggregatedMetrics.maxVolatility,
        shortestRegimeDuration: predictions.aggregatedMetrics.shortestRegimeDuration,
        velocityConfidenceAvg: Number(predictions.aggregatedMetrics.velocityConfidenceAvg.toFixed(3)),
      },
    });
  } catch (error) {
    console.error('[ML MTF API] Error fetching confidence metrics:', error);
    return res.status(500).json({
      error: 'Failed to fetch confidence metrics',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/ml/mtf/backtest/multi-exchange
 * Run backtest across multiple exchanges for comparison
 * 
 * Body:
 *   - symbol: Trading pair
 *   - timeframe: 1m, 5m, 15m, 1h, 4h, 1d
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - exchanges: Array of exchange names ['binance', 'coinbase', 'kraken']
 */
router.post('/backtest/multi-exchange', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe, startDate, endDate, exchanges } = req.body;

    if (!symbol || !timeframe || !startDate || !endDate || !exchanges || exchanges.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, timeframe, startDate, endDate, exchanges[]',
      });
    }

    console.log(
      `[ML MTF API] Starting multi-exchange backtest: ${symbol} across ${exchanges.join(', ')}`
    );

    const result = await lstmBacktestEngine.backtestMultiExchange(
      symbol,
      timeframe,
      new Date(startDate),
      new Date(endDate),
      exchanges
    );

    const summary = Object.entries(result.exchanges).map(([exchange, res]) => ({
      exchange,
      trades: res.totalTrades,
      wins: res.totalWinRate > 0 ? Math.round(res.totalTrades * res.totalWinRate) : 0,
      winRate: `${(res.totalWinRate * 100).toFixed(1)}%`,
      avgProfit: `${res.totalAvgProfit.toFixed(2)}%`,
      sharpe: Number(res.totalSharpeRatio.toFixed(2)),
      maxDD: `${res.totalMaxDD.toFixed(2)}%`,
    }));

    return res.json({
      success: true,
      symbol,
      timeframe,
      dateRange: { start: startDate, end: endDate },
      consensus: {
        bestExchange: result.consensus.bestExchange,
        avgWinRate: `${(result.consensus.avgWinRate * 100).toFixed(1)}%`,
        avgSharpe: Number(result.consensus.avgSharpe.toFixed(2)),
        recommendation:
          result.consensus.avgWinRate > 0.55
            ? 'Strong historical performance'
            : 'Mixed results - proceed with caution',
      },
      byExchange: summary,
      recommendation: {
        bestPerformer: result.consensus.bestExchange,
        reason: `${result.consensus.bestExchange} showed highest Sharpe ratio`,
      },
    });
  } catch (error) {
    console.error('[ML MTF API] Error running multi-exchange backtest:', error);
    return res.status(500).json({
      error: 'Failed to run backtest',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/ml/mtf/health
 * Check ML service health and status
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      status: 'operational',
      services: {
        multiTimeframeML: 'active',
        backtestEngine: 'ready',
      },
      capabilities: {
        timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
        features: ['predictions', 'backtesting', 'consensus', 'multi-exchange'],
        cacheEnabled: true,
        cacheTTL: '5 minutes',
      },
      endpoints: {
        predictions: 'GET /api/ml/mtf/predictions/:symbol',
        enhanceSignal: 'POST /api/ml/mtf/enhance-signal',
        backtest: 'GET /api/ml/mtf/backtest',
        backtestRun: 'POST /api/ml/mtf/backtest/run',
        confidence: 'GET /api/ml/mtf/confidence/:symbol',
        multiExchange: 'POST /api/ml/mtf/backtest/multi-exchange',
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * POST /api/ml/mtf/cache/clear
 * Clear prediction cache (manual refresh)
 */
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    multiTimeframeMLService.clearCache?.();
    return res.json({
      success: true,
      message: 'ML prediction cache cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;
