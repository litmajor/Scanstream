import { Router, Request, Response } from 'express';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CCXTScanner } from '../services/gateway/ccxt-scanner';

const router = Router();

// Initialize services
const cacheManager = new CacheManager(5000);
const rateLimiter = new RateLimiter();
const aggregator = new ExchangeAggregator(cacheManager, rateLimiter);

/**
 * GET /api/scanner/signals
 * Get scanner signals - unified with gateway scanner results
 */
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'scanner:signals:all';
    const cached = cacheManager.get<any>(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        signals: cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Use CCXT Scanner to get market data
    const ccxtScanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);
    
    const symbols = [
      'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'ADA/USDT',
      'DOT/USDT', 'LINK/USDT', 'XRP/USDT', 'DOGE/USDT', 'ATOM/USDT',
      'ARB/USDT', 'OP/USDT', 'AAVE/USDT', 'UNI/USDT', 'NEAR/USDT'
    ];

    const scanResults = await ccxtScanner.scanSymbols(symbols, '1h', {});

    const signals = scanResults
      .filter((result: any) => result.symbol && result.price > 0)
      .map((result: any) => {
        // Simple signal generation based on price change
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        const change = (result as any).priceChange24h || 0;
        const changePercent = ((change / (result.price || 1)) * 100);

        if (changePercent > 2) signal = 'BUY';
        else if (changePercent < -2) signal = 'SELL';

        const strength = Math.min(Math.abs(changePercent) * 10, 100);

        return {
          symbol: result.symbol,
          exchange: result.exchange || 'ccxt',
          signal,
          strength: strength || 0,
          price: result.price || 0,
          currentPrice: result.price || 0,
          change: changePercent || 0,
          priceChange: changePercent || 0,
          change24h: changePercent || 0,
          volume: (result as any).volume24h || 0,
          volume24h: (result as any).volume24h || 0,
          timestamp: Date.now(),
          source: 'scanner'
        };
      });

    // Cache for 30 seconds
    cacheManager.set(cacheKey, signals, 30000);

    res.json({
      success: true,
      signals: signals,
      cached: false,
      count: signals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Scanner API] Error fetching signals:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch scanner signals',
      signals: []
    });
  }
});

/**
 * GET /api/scanner/scan
 * Trigger a new scan
 */
router.get('/scan', async (req: Request, res: Response) => {
  try {
    const { symbols = 'BTC/USDT,ETH/USDT,SOL/USDT', timeframe = '1h' } = req.query;
    
    const symbolList = (symbols as string).split(',').map(s => s.trim());
    const ccxtScanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);
    
    const results = await ccxtScanner.scanSymbols(symbolList, timeframe as string, {});

    res.json({
      success: true,
      results: results.map((r: any) => ({
        symbol: r.symbol,
        price: r.price,
        change24h: (r as any).priceChange24h || 0,
        volume24h: (r as any).volume24h || 0,
        rsi: (r as any).rsi || 0,
        macd: (r as any).macd || 0,
      })),
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Scanner API] Scan error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Scanner failed',
      results: []
    });
  }
});

export default router;
