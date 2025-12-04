/**
 * Signal Generation API Routes
 * 
 * Exposes the complete pipeline signal generator with regime-aware weighting,
 * unified aggregation, and ensemble predictions.
 */

import express, { Request, Response } from 'express';
import CompletePipelineSignalGenerator, { type CompleteSignal } from '../../lib/complete-pipeline-signal-generator';

const router = express.Router();

/**
 * POST /api/signal-generation/generate
 * 
 * Generate complete signal through entire pipeline with all components
 * 
 * Request body:
 * {
 *   "symbol": "BTCUSDT",
 *   "currentPrice": 42000,
 *   "timeframe": "1h",
 *   "accountBalance": 10000,
 *   
 *   // Market regime indicators
 *   "volatilityLevel": "MEDIUM",
 *   "trendStrength": 65,
 *   "rangeWidth": 0.03,
 *   "volatilityTrend": "RISING",
 *   "priceVsMA": 1.02,
 *   "recentSwings": 4,
 *   
 *   // Gradient direction
 *   "gradientValue": 0.15,
 *   "gradientStrength": 78,
 *   "trendShiftDetected": false,
 *   
 *   // UT Bot
 *   "atr": 420,
 *   "trailingStop": 41000,
 *   "utBuyCount": 3,
 *   "utSellCount": 1,
 *   "utMomentum": 0.65,
 *   
 *   // Market structure
 *   "structureTrend": "UPTREND",
 *   "structureBreak": false,
 *   
 *   // Flow field
 *   "flowDominant": "BULLISH",
 *   "flowForce": 75,
 *   "flowTurbulence": "medium",
 *   "flowEnergyTrend": "ACCELERATING",
 *   
 *   // Chart data for ML
 *   "chartData": [...array of price candles...]
 * }
 * 
 * Response: CompleteSignal object with full transparency
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      currentPrice,
      timeframe,
      accountBalance,
      
      volatilityLevel,
      trendStrength,
      rangeWidth,
      volatilityTrend,
      priceVsMA,
      recentSwings,
      
      gradientValue,
      gradientStrength,
      trendShiftDetected,
      
      atr,
      trailingStop,
      utBuyCount,
      utSellCount,
      utMomentum,
      
      structureTrend,
      structureBreak,
      
      flowDominant,
      flowForce,
      flowTurbulence,
      flowEnergyTrend,
      
      chartData
    } = req.body;

    // Validate required fields
    if (!symbol || !currentPrice || !timeframe || !accountBalance) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, currentPrice, timeframe, accountBalance'
      });
    }

    // Generate complete signal
    const signal = await CompletePipelineSignalGenerator.generateSignal(
      symbol,
      currentPrice,
      timeframe,
      accountBalance,

      volatilityLevel || 'MEDIUM',
      trendStrength || 50,
      rangeWidth || 0.05,
      volatilityTrend || 'STABLE',
      priceVsMA || 1.0,
      recentSwings || 2,

      gradientValue || 0,
      gradientStrength || 50,
      trendShiftDetected || false,

      atr || currentPrice * 0.02,
      trailingStop || currentPrice * 0.98,
      utBuyCount || 0,
      utSellCount || 0,
      utMomentum || 0,

      structureTrend || 'RANGING',
      structureBreak || false,

      flowDominant || 'BULLISH',
      flowForce || 50,
      flowTurbulence || 'low',
      flowEnergyTrend || 'STABLE',

      chartData || []
    );

    res.json({
      success: true,
      signal,
      summary: CompletePipelineSignalGenerator.getSummary(signal)
    });
  } catch (error) {
    console.error('[Signal API] Generation failed:', error);
    res.status(500).json({
      error: 'Signal generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/signal-generation/generate-batch
 * 
 * Generate signals for multiple symbols at once
 */
router.post('/generate-batch', async (req: Request, res: Response) => {
  try {
    const { signals: signalRequests } = req.body;

    if (!Array.isArray(signalRequests) || signalRequests.length === 0) {
      return res.status(400).json({
        error: 'Expected array of signal requests in "signals" field'
      });
    }

    const results = await Promise.allSettled(
      signalRequests.map(request =>
        CompletePipelineSignalGenerator.generateSignal(
          request.symbol,
          request.currentPrice,
          request.timeframe,
          request.accountBalance,
          request.volatilityLevel || 'MEDIUM',
          request.trendStrength || 50,
          request.rangeWidth || 0.05,
          request.volatilityTrend || 'STABLE',
          request.priceVsMA || 1.0,
          request.recentSwings || 2,
          request.gradientValue || 0,
          request.gradientStrength || 50,
          request.trendShiftDetected || false,
          request.atr || request.currentPrice * 0.02,
          request.trailingStop || request.currentPrice * 0.98,
          request.utBuyCount || 0,
          request.utSellCount || 0,
          request.utMomentum || 0,
          request.structureTrend || 'RANGING',
          request.structureBreak || false,
          request.flowDominant || 'BULLISH',
          request.flowForce || 50,
          request.flowTurbulence || 'low',
          request.flowEnergyTrend || 'STABLE',
          request.chartData || []
        )
      )
    );

    const signals = results.map((result, index) => ({
      symbol: signalRequests[index].symbol,
      status: result.status,
      signal: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? (result.reason as Error).message : null
    }));

    res.json({
      success: true,
      total: signalRequests.length,
      succeeded: signals.filter(s => s.status === 'fulfilled').length,
      signals
    });
  } catch (error) {
    console.error('[Signal API] Batch generation failed:', error);
    res.status(500).json({
      error: 'Batch signal generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/signal-generation/validate
 * 
 * Validate signal request parameters without generating full signal
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { symbol, currentPrice, timeframe, accountBalance } = req.body;

    const errors: string[] = [];

    if (!symbol || typeof symbol !== 'string') errors.push('symbol: required string');
    if (!currentPrice || typeof currentPrice !== 'number' || currentPrice <= 0) errors.push('currentPrice: required positive number');
    if (!timeframe || typeof timeframe !== 'string') errors.push('timeframe: required string');
    if (!accountBalance || typeof accountBalance !== 'number' || accountBalance <= 0) errors.push('accountBalance: required positive number');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    res.json({
      success: true,
      message: 'Signal request parameters are valid'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
