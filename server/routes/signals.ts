import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const router = Router();

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
          reasoning: {
            maCrossover: maCrossover.signal,
            rsi: rsi.signal,
            rsiValue: calculateRSI(prices),
            combined: combinedSignal
          }
        }
      });

      res.json(signal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

export default router;
