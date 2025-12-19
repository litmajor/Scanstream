import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { SignalPersistenceService } from '../services/signal-persistence-service';

const prisma = new PrismaClient();
const router = Router();
const signalService = new SignalPersistenceService();

// Simple MA crossover signal
function checkMACrossover(prices: number[]): { signal: string; strength: number } {
  if (prices.length < 50) return { signal: 'insufficient_data', strength: 0 };

  const ma20 = prices.slice(-20).reduce((a, b) => a + b) / 20;
  const ma50 = prices.slice(-50).reduce((a, b) => a + b) / 50;
  const prevMa20 = prices.slice(-21, -1).reduce((a, b) => a + b) / 20;

  if (prevMa20 <= ma50 && ma20 > ma50) {
    return { signal: 'bullish', strength: Math.min(((ma20 - ma50) / ma50) * 100, 100) };
  }
  if (prevMa20 >= ma50 && ma20 < ma50) {
    return { signal: 'bearish', strength: Math.min(((ma50 - ma20) / ma50) * 100, 100) };
  }
  return { signal: 'neutral', strength: 0 };
}

// Simple RSI signal
function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period) return 50;

  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function checkRSI(prices: number[]): { signal: string; strength: number } {
  const rsi = calculateRSI(prices);

  if (rsi < 30) {
    return { signal: 'oversold', strength: (30 - rsi) / 30 * 100 };
  }
  if (rsi > 70) {
    return { signal: 'overbought', strength: (rsi - 70) / 30 * 100 };
  }
  return { signal: 'neutral', strength: 0 };
}

export function setupSignalRoutes(app: any) {
  const isAuthenticated = (req: any, res: Response, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // Get signals for a symbol
  app.get('/api/signals/:symbol', async (req: any, res: Response) => {
    try {
      const signals = await prisma.signal.findMany({
        where: { symbol: req.params.symbol.toUpperCase() },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
      res.json(signals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate signals for symbol
  app.post('/api/signals/generate', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { symbol, timeframe = '1h' } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
      }

      const upperSymbol = symbol.toUpperCase();

      // Fetch price data from a simple API or stored data
      let prices: number[] = [];
      try {
        // Try CoinGecko for demo data
        const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${symbol.toLowerCase()}/market_chart`, {
          params: { vs_currency: 'usd', days: 90 }
        });
        prices = response.data.prices.map((p: any) => p[1]);
      } catch (e) {
        return res.status(400).json({ error: 'Could not fetch price data' });
      }

      const currentPrice = prices[prices.length - 1];
      const maCrossover = checkMACrossover(prices);
      const rsi = checkRSI(prices);

      let combinedSignal = 'neutral';
      let strength = 0;

      if (maCrossover.signal === 'bullish' && rsi.signal === 'oversold') {
        combinedSignal = 'strong_buy';
        strength = 90;
      } else if (maCrossover.signal === 'bullish') {
        combinedSignal = 'buy';
        strength = maCrossover.strength;
      } else if (maCrossover.signal === 'bearish' && rsi.signal === 'overbought') {
        combinedSignal = 'strong_sell';
        strength = 90;
      } else if (maCrossover.signal === 'bearish') {
        combinedSignal = 'sell';
        strength = maCrossover.strength;
      }

      const signal = await prisma.signal.create({
        data: {
          symbol: upperSymbol,
          type: 'ma_crossover_rsi',
          strength: strength,
          confidence: Math.min(strength / 100 * 0.95, 1),
          price: currentPrice,
          stopLoss: currentPrice * 0.95,
          takeProfit: currentPrice * 1.1,
          entryPrice: currentPrice,
          riskReward: (currentPrice * 1.1 - currentPrice) / (currentPrice - currentPrice * 0.95),
          reasoning: {
            maCrossover: maCrossover.signal,
            rsi: rsi.signal,
            rsiStrength: rsi.strength,
            combined: combinedSignal,
          },
        },
      });

      res.json(signal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// ============================================================================
// SIGNAL PERSISTENCE TRACKING ROUTES
// ============================================================================

/**
 * POST /api/signals/track
 * Record a new signal from scanner/generator
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      type,
      strength,
      confidence,
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward,
      primaryPattern,
      patterns,
      qualityScore,
      qualityRating,
      regimeState,
      reasoning,
      timeframe,
      userId
    } = req.body;

    // Validate required fields
    if (!symbol || !type || strength === undefined || confidence === undefined || !entryPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: symbol, type, strength, confidence, entryPrice'
      });
    }

    // Record signal
    const signal = await signalService.recordSignal({
      symbol,
      type: type as 'BUY' | 'SELL' | 'HOLD',
      strength,
      confidence,
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward,
      primaryPattern,
      patterns: patterns || [],
      qualityScore,
      qualityRating: qualityRating as any,
      regimeState,
      reasoning,
      timeframe,
      userId
    });

    res.json({
      success: true,
      signalId: signal.id,
      message: `Signal recorded: ${symbol} ${type} @ ${entryPrice}`
    });
  } catch (error: any) {
    console.error('[SignalAPI] Error recording signal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/signals/:id/outcome
 * Update signal with exit outcome
 */
router.put('/:id/outcome', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      exitPrice,
      outcome,
      realizedPnL,
      realizedPnLPercent,
      durationSeconds,
      tradeId,
      notes
    } = req.body;

    // Validate
    if (!exitPrice || !outcome) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: exitPrice, outcome'
      });
    }

    if (!['WIN', 'LOSS', 'BREAKEVEN'].includes(outcome)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outcome. Must be: WIN, LOSS, or BREAKEVEN'
      });
    }

    // Update signal
    const signal = await signalService.updateSignalOutcome({
      signalId: id,
      exitPrice,
      outcome: outcome as 'WIN' | 'LOSS' | 'BREAKEVEN',
      realizedPnL: realizedPnL || 0,
      realizedPnLPercent: realizedPnLPercent || 0,
      durationSeconds,
      tradeId,
      notes
    });

    res.json({
      success: true,
      message: `Signal outcome updated: ${outcome}`,
      pnl: signal.realizedPnL,
      pnlPercent: signal.realizedPnLPercent
    });
  } catch (error: any) {
    console.error('[SignalAPI] Error updating signal outcome:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signals/stats/:symbol
 * Get signal statistics for a symbol
 */
router.get('/stats/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const stats = await signalService.getSignalStats(symbol.toUpperCase());

    if (!stats) {
      return res.json({
        success: true,
        message: 'No closed signals for this symbol',
        stats: null
      });
    }

    res.json({
      success: true,
      symbol: stats.symbol,
      stats: {
        totalSignals: stats.totalSignals,
        winRate: (stats.winRate * 100).toFixed(2) + '%',
        profitFactor: stats.profitFactor.toFixed(2),
        avgPnL: stats.avgPnL.toFixed(2),
        totalPnL: stats.totalPnL.toFixed(2),
        patternAccuracy: Object.entries(stats.patternAccuracy).map(([pattern, data]: any) => ({
          pattern,
          ...data,
          winRate: (data.winRate * 100).toFixed(2) + '%'
        })),
        qualityVsWinRate: Object.entries(stats.qualityVsWinRate).map(([quality, winRate]: any) => ({
          quality,
          winRate: (winRate * 100).toFixed(2) + '%'
        }))
      }
    });
  } catch (error: any) {
    console.error('[SignalAPI] Error getting signal stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signals/open/:symbol
 * Get open signals for a symbol (not yet closed)
 */
router.get('/open/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const signals = await signalService.getOpenSignals(symbol.toUpperCase());

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      openSignals: signals.length,
      signals: signals.map((s: any) => ({
        id: s.id,
        type: s.type,
        entryPrice: s.entryPrice,
        strength: s.strength,
        confidence: (s.confidence * 100).toFixed(2) + '%',
        primaryPattern: s.primaryPattern,
        qualityRating: s.qualityRating,
        entryTimestamp: s.entryTimestamp,
        duration: Math.floor((Date.now() - s.entryTimestamp.getTime()) / 1000) + 's'
      }))
    });
  } catch (error: any) {
    console.error('[SignalAPI] Error getting open signals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signals/recent/:symbol
 * Get recent signals (closed or open)
 */
router.get('/recent/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    
    const signals = await signalService.getRecentSignals(symbol.toUpperCase(), limit);

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: signals.length,
      signals: signals.map((s: any) => ({
        id: s.id,
        type: s.type,
        outcome: s.outcome,
        entryPrice: s.entryPrice,
        exitPrice: s.exitPrice,
        strength: s.strength,
        confidence: (s.confidence * 100).toFixed(2) + '%',
        primaryPattern: s.primaryPattern,
        qualityRating: s.qualityRating,
        pnl: s.realizedPnL,
        pnlPercent: s.realizedPnLPercent ? (s.realizedPnLPercent * 100).toFixed(2) + '%' : null,
        entryTimestamp: s.entryTimestamp,
        exitTimestamp: s.exitTimestamp,
        duration: s.durationSeconds ? s.durationSeconds + 's' : null
      }))
    });
  } catch (error: any) {
    console.error('[SignalAPI] Error getting recent signals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/signals/patterns/:symbol
 * Get pattern performance breakdown
 */
router.get('/patterns/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const performance = await signalService.getPatternPerformance(symbol.toUpperCase());

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      patterns: Object.entries(performance).map(([pattern, stats]: any) => ({
        pattern,
        ...stats,
        winRate: (stats.winRate * 100).toFixed(2) + '%',
        avgPnL: stats.avgPnL.toFixed(2),
        totalPnL: stats.totalPnL.toFixed(2)
      }))
    });
  } catch (error: any) {
    console.error('[SignalAPI] Error getting pattern performance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
