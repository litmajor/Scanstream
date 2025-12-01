/**
 * Multi-Timeframe Analysis API
 * 
 * Provides comprehensive multi-timeframe analysis for crypto pairs
 */

import express, { type Request, type Response } from 'express';
import { getExchangeDataFeed } from '../trading-engine';

const router = express.Router();

/**
 * GET /api/analysis/multi-timeframe
 * 
 * Analyze a symbol across multiple timeframes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC/USDT' } = req.query;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Symbol parameter required',
        example: '/api/analysis/multi-timeframe?symbol=BTC/USDT'
      });
    }

    const dataFeed = getExchangeDataFeed();
    const timeframes = ['1h', '4h', '1d'];
    
    // Fetch data for each timeframe
    const timeframeData = await Promise.all(
      timeframes.map(async (tf) => {
        try {
          const data = await dataFeed.fetchOHLCV(symbol, tf, 50);
          
          if (!data || data.length < 2) {
            return { timeframe: tf, error: 'Insufficient data' };
          }

          // Calculate basic metrics
          const closes = data.map((d: any) => d[4]);
          const volumes = data.map((d: any) => d[5]);
          const current = closes[closes.length - 1];
          const previous = closes[closes.length - 2];
          const change = ((current - previous) / previous) * 100;

          // Determine trend
          const ema5 = calculateEMA(closes, 5);
          const ema21 = calculateEMA(closes, 21);
          const trend = ema5 > ema21 ? 'BULLISH' : ema5 < ema21 ? 'BEARISH' : 'NEUTRAL';

          // Support and resistance
          const high = Math.max(...closes);
          const low = Math.min(...closes);
          const resistance = [high, (high + current) / 2];
          const support = [low, (low + current) / 2];

          // Volume analysis
          const avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;
          const currentVolume = volumes[volumes.length - 1];
          const volumeRatio = currentVolume / avgVolume;

          // Strength calculation
          const strength = Math.min(Math.max(volumeRatio * 0.5 + (ema5 > ema21 ? 0.5 : 0), 0), 1);

          return {
            timeframe: tf,
            trend,
            strength: parseFloat(strength.toFixed(2)),
            price: parseFloat(current.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            resistance: resistance.map(r => parseFloat(r.toFixed(2))),
            support: support.map(s => parseFloat(s.toFixed(2))),
            volume: {
              current: parseInt(currentVolume.toString()),
              average: parseInt(avgVolume.toString()),
              ratio: parseFloat(volumeRatio.toFixed(2))
            },
            signals: []
          };
        } catch (error: any) {
          return {
            timeframe: tf,
            error: error.message || 'Failed to analyze timeframe',
            trend: 'NEUTRAL',
            strength: 0
          };
        }
      })
    );

    // Calculate overall confluence
    const validAnalysis = timeframeData.filter((t: any) => !t.error);
    const bullishCount = validAnalysis.filter((t: any) => t.trend === 'BULLISH').length;
    const confluenceScore = validAnalysis.length > 0 ? bullishCount / validAnalysis.length : 0;

    const overallTrend = bullishCount > validAnalysis.length / 2 ? 'BULLISH' : 
                         bullishCount < validAnalysis.length / 2 ? 'BEARISH' : 'NEUTRAL';

    res.json({
      success: true,
      symbol,
      timestamp: Date.now(),
      overallTrend,
      multiTimeframeAnalysis: {
        confluenceScore: parseFloat(confluenceScore.toFixed(2)),
        timeframeAnalysis: validAnalysis
      },
      summary: {
        timeframesAnalyzed: validAnalysis.length,
        bullishTimeframes: bullishCount,
        bearishTimeframes: validAnalysis.length - bullishCount
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Multi-timeframe analysis failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Helper: Calculate EMA (Exponential Moving Average)
 */
function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1];

  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }

  return ema;
}

export default router;
