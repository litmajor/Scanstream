/**
 * Historical Backtesting API Routes
 * 
 * Endpoints for validating algorithm against 2+ years of historical data
 * Calculates Sharpe/Sortino ratios and identifies underperforming patterns
 */

import express, { type Request, type Response } from 'express';
import { historicalBacktester } from '../services/historical-backtester';
import { ALL_TRACKED_ASSETS } from '@shared/tracked-assets';

const router = express.Router();

/**
 * POST /api/backtest/historical
 * 
 * Run backtest on historical data (2+ years)
 * Returns: Sharpe/Sortino ratios, max drawdown, pattern analysis
 */
router.post('/historical', async (req: Request, res: Response) => {
  try {
    const {
      startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago
      endDate = new Date(),
      assets = ALL_TRACKED_ASSETS.map(a => a.symbol),
      riskFreeRate = 0.05
    } = req.body;

    console.log('[HistoricalBacktestAPI] Request received');
    console.log(`[HistoricalBacktestAPI] Period: ${new Date(startDate).toISOString()} to ${new Date(endDate).toISOString()}`);

    const result = await historicalBacktester.runHistoricalBacktest({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      assets,
      riskFreeRate
    });

    res.json({
      success: true,
      data: result,
      summary: {
        algorithmScore: calculateAlgorithmScore(result.metrics),
        recommendation: getRecommendation(result.metrics, result.underperformingPatterns),
        nextSteps: generateNextSteps(result)
      }
    });
  } catch (error: any) {
    console.error('[HistoricalBacktestAPI] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Historical backtest failed'
    });
  }
});

/**
 * GET /api/backtest/historical/summary
 * 
 * Get cached backtest results summary
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // In production, this would query cached results from database
    res.json({
      success: true,
      message: 'Use POST /api/backtest/historical to run new backtest',
      note: 'Backtest results are computed on demand'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Calculate overall algorithm quality score (1-10)
 */
function calculateAlgorithmScore(metrics: any): number {
  let score = 5; // Base score

  // Sharpe Ratio contribution (0-3 points)
  if (metrics.sharpeRatio >= 2) score += 3;
  else if (metrics.sharpeRatio >= 1) score += 2;
  else if (metrics.sharpeRatio >= 0.5) score += 1;

  // Win Rate contribution (0-2 points)
  if (metrics.winRate >= 60) score += 2;
  else if (metrics.winRate >= 50) score += 1;

  // Max Drawdown contribution (0-2 points, lower is better)
  if (metrics.maxDrawdown <= 15) score += 2;
  else if (metrics.maxDrawdown <= 25) score += 1;

  // Sortino Ratio bonus (0-1 point)
  if (metrics.sortinoRatio >= 1.5) score += 1;

  return Math.min(10, Math.round(score * 10) / 10);
}

/**
 * Generate recommendation based on backtest results
 */
function getRecommendation(metrics: any, underperformingPatterns: string[]): string {
  if (metrics.sharpeRatio >= 1.5 && metrics.maxDrawdown <= 20 && metrics.winRate >= 55) {
    return '✓ EXCELLENT - Algorithm ready for live trading';
  } else if (metrics.sharpeRatio >= 1 && metrics.maxDrawdown <= 30 && metrics.winRate >= 50) {
    return '◐ GOOD - Fine-tune risk management before live trading';
  } else if (underperformingPatterns.length > 5) {
    return '✗ NEEDS WORK - Remove underperforming patterns first';
  } else {
    return '◐ REVIEW - Address underperforming patterns and optimize thresholds';
  }
}

/**
 * Generate actionable next steps
 */
function generateNextSteps(result: any): string[] {
  const steps: string[] = [];

  if (result.metrics.sharpeRatio < 1) {
    steps.push('Improve risk-adjusted returns: increase win rate or reduce volatility');
  }

  if (result.metrics.maxDrawdown > 30) {
    steps.push('Reduce maximum drawdown: implement better stop-loss logic');
  }

  if (result.underperformingPatterns.length > 0) {
    steps.push(`Remove ${result.underperformingPatterns.length} underperforming patterns: ${result.underperformingPatterns.slice(0, 3).join(', ')}`);
  }

  if (result.metrics.winRate < 50) {
    steps.push('Increase win rate: improve signal quality filtering');
  }

  if (steps.length === 0) {
    steps.push('✓ Algorithm is optimized - consider live trading with small position sizes');
  }

  return steps;
}

export default router;
