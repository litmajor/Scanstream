import { Router, Request, Response } from 'express';
import { coinGeckoService } from '../services/coingecko';
import { apiRegistry } from '../services/api-registry';
import { priceCache } from '../../src/core/PriceCache';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CCXTScanner } from '../services/gateway/ccxt-scanner';
import { initAggregator } from '../../src/core/aggregator.singleton';
import MultiExchangeScanner from '../services/scanner/multi-exchange-scanner';
import ScannerPersistenceService from '../services/scanner/scanner-persistence';
import { respondToInvalidRouteParam, routeParam } from '../utils/route-params';

const router = Router();
// In-memory last scan results (for /results endpoint)
let lastScanResults: any[] = [];
let lastScanTimestamp: Date | null = null;
let isScanning = false;

// Helper: run scan in background and store results
async function runScanBackground(symbols: string[], timeframe: string, options: any = {}) {
  if (isScanning) {
    console.log('[Scanner] Scan already in progress; skipping new background scan');
    return;
  }

  isScanning = true;
  try {
    // Ensure aggregator is initialized (safe to call multiple times)
    const agg = await getScannerAggregator();

    const ccxtScanner = new CCXTScanner(agg, cacheManager, rateLimiter);
    const results = await ccxtScanner.scanSymbols(symbols, timeframe, options || {});
    lastScanResults = results;
    lastScanTimestamp = new Date();
    console.log(`[Scanner] Background scan completed: ${results.length} results`);
  } catch (err: any) {
    console.error('[Scanner] Background scan failed:', err?.message || err);
  } finally {
    isScanning = false;
  }
}

// Health endpoint for scanner (lightweight)
router.get('/health', (req: Request, res: Response) => {
  try {
    const status = aggregator ? 'initialized' : 'not-initialized';
    res.json({ status: 'ok', scanner: status, lastScanTimestamp, isScanning, timestamp: new Date() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Initialize services
const cacheManager = new CacheManager(5000);
const rateLimiter = new RateLimiter();
let aggregator: ExchangeAggregator | null = null;

async function getScannerAggregator(): Promise<ExchangeAggregator> {
  if (aggregator) return aggregator;
  aggregator = await initAggregator(cacheManager, rateLimiter);
  return aggregator;
}

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
    const agg = await getScannerAggregator();
    const ccxtScanner = new CCXTScanner(agg, cacheManager, rateLimiter);
    
    const symbols = [
      'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'ADA/USDT',
      'DOT/USDT', 'LINK/USDT', 'XRP/USDT', 'DOGE/USDT', 'ATOM/USDT',
      'ARB/USDT', 'OP/USDT', 'AAVE/USDT', 'UNI/USDT', 'NEAR/USDT'
    ];

    const scanResults = await ccxtScanner.scanSymbols(symbols, '1h', {});

    // Fetch 24h price change data from CoinGecko
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'AVAX': 'avalanche-2',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'ATOM': 'cosmos',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'AAVE': 'aave',
      'UNI': 'uniswap',
      'NEAR': 'near'
    };

    let priceChanges: Record<string, number> = {};
    try {
      const ids = Object.values(symbolMap).join(',');
      // Use coinGeckoService which has retry/backoff and caching
      const coingeckoData = await coinGeckoService.getMarketDataByIds(ids, 'usd');
      if (coingeckoData && Array.isArray(coingeckoData)) {
        for (const item of coingeckoData) {
          const sym = Object.entries(symbolMap).find(([, id]) => id === item.id)?.[0];
          if (sym) {
            priceChanges[sym] = item.price_change_percentage_24h || 0;
          }
        }
      }
    } catch (error) {
      console.warn(
        '[Scanner API] Failed to fetch CoinGecko price changes via service:',
        error instanceof Error ? error.message : String(error),
      );
    }

    const signals = scanResults
      .filter((result: any) => result.symbol && result.price > 0)
      .map((result: any) => {
        // Get symbol name from trading pair (e.g., 'BTC/USDT' -> 'BTC')
        const symbolName = result.symbol.split('/')[0];
        
        // Get 24h change from CoinGecko or use momentum as fallback
        let changePercent = priceChanges[symbolName] ?? result.metrics?.momentum ?? 0;

        // Simple signal generation based on price change
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

        if (changePercent > 2) signal = 'BUY';
        else if (changePercent < -2) signal = 'SELL';

        const strength = Math.min(Math.abs(changePercent) * 10, 100);

        return {
          symbol: result.symbol,
          exchange: result.sources?.[0] || 'ccxt',
          signal,
          strength: strength || 0,
          price: result.price || 0,
          currentPrice: result.price || 0,
          change: changePercent || 0,
          priceChange: changePercent || 0,
          change24h: changePercent || 0,
          volume: (result.metrics?.volume || 0),
          volume24h: (result.metrics?.volume || 0),
          timestamp: Date.now(),
          source: 'scanner',
          rsi: result.metrics?.rsi || 0,
          macd: result.metrics?.macd || 0,
          confidence: result.confidence || 0,
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

// Register scanner endpoints with API registry
try {
  apiRegistry.registerEndpoint({
    method: 'GET',
    path: '/api/scanner/signals',
    category: 'SIGNAL',
    name: 'Scanner Signals',
    description: 'Return fast scanner signals for core universe',
    version: '1.0.0',
    tags: ['scanner','signals'],
    isDeprecated: false,
    authentication: 'NONE',
    cacheable: true,
    cacheTTLSeconds: 30,
    isActive: true
  });
} catch (e) {
  console.warn('[APIRegistry] Failed to register /api/scanner/signals', e);
}

/**
 * GET /api/scanner/quick/:symbol
 * Lightweight quick lookup using authoritative `priceCache` (no external calls)
 */
router.get('/quick/:symbol', (req: Request, res: Response) => {
  try {
    const raw = routeParam(req.params.symbol, 'symbol', 64);
    const symbol = raw.toUpperCase().includes('/') ? raw.toUpperCase() : `${raw.toUpperCase()}/USDT`;
    const cached = priceCache.get(symbol) || priceCache.get(symbol.replace('/USDT','/USD'));
    if (!cached) return res.status(404).json({ success: false, error: 'Symbol not in cache' });
    return res.json({ success: true, symbol, data: cached, timestamp: new Date().toISOString() });
  } catch (err: any) {
    if (respondToInvalidRouteParam(err, res)) return;
    console.error('[Scanner /quick] Error:', err?.message || err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

try {
  apiRegistry.registerEndpoint({
    method: 'GET',
    path: '/api/scanner/quick/:symbol',
    category: 'SIGNAL',
    name: 'Quick scanner symbol lookup',
    description: 'Quick symbol lookup from PriceCache (no external API calls)',
    version: '1.0.0',
    tags: ['scanner','quick','priceCache'],
    isDeprecated: false,
    authentication: 'NONE',
    cacheable: true,
    cacheTTLSeconds: 3,
    isActive: true
  });
} catch (e) {
  console.warn('[APIRegistry] Failed to register /api/scanner/quick/:symbol', e);
}

/**
 * GET /api/scanner/scan
 * Trigger a new scan
 */
router.get('/scan', async (req: Request, res: Response) => {
  try {
    const { symbols = 'BTC/USDT,ETH/USDT,SOL/USDT', timeframe = '1h' } = req.query;
    
    const symbolList = (symbols as string).split(',').map(s => s.trim());
    const agg = await getScannerAggregator();
    const ccxtScanner = new CCXTScanner(agg, cacheManager, rateLimiter);
    
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


/**
 * POST /api/scanner/scan
 * Accepts JSON body: { symbols: string[] | string, timeframe?: string, background?: boolean, options?: object }
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { symbols = ['BTC/USDT'], timeframe = '1h', background = false, options = {} } = req.body;
    const symbolList = Array.isArray(symbols) ? symbols : (String(symbols) || 'BTC/USDT').split(',').map((s: string) => s.trim());

    if (background) {
      // Start background scan and return accepted
      runScanBackground(symbolList, timeframe, options);
      return res.status(202).json({ success: true, message: 'Scan started in background', timestamp: new Date().toISOString() });
    }

    // Ensure aggregator is initialized
    const agg = await getScannerAggregator();
    const ccxtScanner = new CCXTScanner(agg, cacheManager, rateLimiter);
    const results = await ccxtScanner.scanSymbols(symbolList, timeframe, options || {});

    // Store last results
    lastScanResults = results;
    lastScanTimestamp = new Date();

    res.json({ success: true, results, count: results.length, timestamp: lastScanTimestamp });
  } catch (error: any) {
    console.error('[Scanner API] POST /scan error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Scan failed' });
  }
});


/**
 * GET /api/scanner/results
 * Return last background or synchronous scan results
 */
router.get('/results', (req: Request, res: Response) => {
  try {
    return res.json({ success: true, timestamp: lastScanTimestamp, count: lastScanResults.length, results: lastScanResults });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to return results' });
  }
});

/**
 * POST /api/scanner/multi-exchange-scan
 * Enhanced multi-exchange scan with ARM architecture
 * 
 * Body:
 * {
 *   symbols: string[]
 *   exchanges?: string[]
 *   options?: {
 *     timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
 *     limit: number
 *     minVolume: number
 *     topN: number
 *   }
 * }
 */
router.post('/multi-exchange-scan', async (req: Request, res: Response) => {
  try {
    const { symbols, exchanges, options } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'symbols array is required and must not be empty'
      });
    }

    console.log(`[ScannerAPI] Starting multi-exchange scan for ${symbols.length} symbols on ${exchanges?.join(',') || 'all exchanges'}`);

    // Initialize services
    const agg = await getScannerAggregator();
    const multiScanner = new MultiExchangeScanner(agg, cacheManager);
    
    // Try to initialize persistence service if available
    let persistence: ScannerPersistenceService | null = null;
    try {
      // Note: In production, inject prisma client
      persistence = new ScannerPersistenceService(null as any);
    } catch (e) {
      console.warn('[ScannerAPI] Persistence service not available');
    }

    // Create scan session
    let sessionId = 'session_' + Date.now();
    if (persistence) {
      try {
        const session = await persistence.createScanSession(
          exchanges || ['binance', 'coinbase', 'kucoinfutures', 'okx', 'bybit'],
          symbols.length
        );
        sessionId = session.id || `session_${Date.now()}`;
      } catch (e) {
        console.warn('[ScannerAPI] Could not create scan session:', (e as Error).message);
      }
    }

    // Run multi-exchange scan
    const results = await multiScanner.scanExchanges(symbols, exchanges, options);

    // Store results if persistence available
    if (persistence && results.allResults.length > 0) {
      try {
        await persistence.storeScanResults(results.allResults, sessionId);
        if (results.crossExchangeSignals.length > 0) {
          await persistence.storeCrossExchangeSignals(results.crossExchangeSignals, sessionId);
        }
        await persistence.completeScanSession(
          sessionId,
          results.allResults.length,
          results.allResults.reduce((sum: number, r: any) => sum + (r.compositeScore || 0), 0) / results.allResults.length
        );
      } catch (e) {
        console.warn('[ScannerAPI] Could not store results:', (e as Error).message);
      }
    }

    console.log(
      `[ScannerAPI] Multi-exchange scan completed: ${results.allResults.length} results, ` +
      `${results.crossExchangeSignals.length} cross-exchange signals`
    );

    res.json({
      success: true,
      sessionId,
      timestamp: results.timestamp,
      totalResults: results.allResults.length,
      exchanges: Array.from(results.exchanges.entries()).map(([exchange, data]: any) => ({
        exchange,
        scanned: data.totalScanned,
        success: data.successCount,
        avgConfidence: (data.avgConfidence || 0).toFixed(4),
        topAssets: data.topAssets.slice(0, 5)
      })),
      crossExchangeSignals: results.crossExchangeSignals.slice(0, 10),
      topAssets: results.topAssets.slice(0, 10),
      signalSummary: {
        total: results.allResults.length,
        strongBuy: results.allResults.filter((r: any) => r.signal === 'Strong Buy').length,
        buy: results.allResults.filter((r: any) => r.signal === 'Buy').length,
        neutral: results.allResults.filter((r: any) => r.signal === 'Neutral').length,
        sell: results.allResults.filter((r: any) => r.signal === 'Sell').length,
        strongSell: results.allResults.filter((r: any) => r.signal === 'Strong Sell').length
      }
    });
  } catch (error: any) {
    console.error('[ScannerAPI] Multi-exchange scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Multi-exchange scan failed',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/scanner/symbol/:symbol/stats
 * Get signal statistics for a symbol
 */
router.get('/symbol/:symbol/stats', async (req: Request, res: Response) => {
  try {
    const symbol = routeParam(req.params.symbol, 'symbol', 64);
    const { days } = req.query;
    const daysNum = parseInt(days as string) || 7;

    // Try to get stats from persistence service
    let stats: any = null;
    try {
      const persistence = new ScannerPersistenceService(null as any);
      stats = await persistence.getSignalStats(symbol, daysNum);
    } catch (e) {
      console.warn('[ScannerAPI] Could not retrieve stats from persistence');
    }

    res.json({
      success: true,
      symbol,
      period: `${daysNum} days`,
      stats: stats || {
        totalScans: 0,
        avgConfidence: 0,
        signalCounts: {},
        topExchange: 'N/A',
        trend: 'N/A'
      }
    });
  } catch (error: any) {
    if (respondToInvalidRouteParam(error, res)) return;
    res.status(500).json({
      success: false,
      error: 'Failed to compute statistics',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/scanner/symbol/:symbol/history
 * Get recent scan results for a symbol
 */
router.get('/symbol/:symbol/history', async (req: Request, res: Response) => {
  try {
    const symbol = routeParam(req.params.symbol, 'symbol', 64);
    const { exchange, hours } = req.query;
    const hoursNum = parseInt(hours as string) || 24;

    let history: any[] = [];
    try {
      const persistence = new ScannerPersistenceService(null as any);
      history = await persistence.getRecentResults(
        symbol,
        exchange as string,
        hoursNum
      );
    } catch (e) {
      console.warn('[ScannerAPI] Could not retrieve history from persistence');
    }

    res.json({
      success: true,
      symbol,
      exchange: exchange || 'all',
      period: `${hoursNum} hours`,
      history
    });
  } catch (error: any) {
    if (respondToInvalidRouteParam(error, res)) return;
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve history',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/scanner/symbol/:symbol/cross-exchange
 * Get cross-exchange signals for a symbol
 */
router.get('/symbol/:symbol/cross-exchange', async (req: Request, res: Response) => {
  try {
    const symbol = routeParam(req.params.symbol, 'symbol', 64);
    const { days } = req.query;
    const daysNum = parseInt(days as string) || 7;

    let signals: any[] = [];
    try {
      const persistence = new ScannerPersistenceService(null as any);
      signals = await persistence.getCrossExchangeSignalHistory(symbol, daysNum);
    } catch (e) {
      console.warn('[ScannerAPI] Could not retrieve cross-exchange signals');
    }

    res.json({
      success: true,
      symbol,
      period: `${daysNum} days`,
      signals
    });
  } catch (error: any) {
    if (respondToInvalidRouteParam(error, res)) return;
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cross-exchange signals',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/scanner/top-performers
 * Get top performing symbols across exchanges
 */
router.get('/top-performers', async (req: Request, res: Response) => {
  try {
    const { days, limit } = req.query;
    const daysNum = parseInt(days as string) || 7;
    const limitNum = parseInt(limit as string) || 10;

    let performers: any[] = [];
    try {
      const persistence = new ScannerPersistenceService(null as any);
      performers = await persistence.getTopPerformers(daysNum, limitNum);
    } catch (e) {
      console.warn('[ScannerAPI] Could not retrieve top performers');
    }

    res.json({
      success: true,
      period: `${daysNum} days`,
      limit: limitNum,
      performers
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top performers',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/scanner/config
 * Get scanner configuration and defaults
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    defaults: {
      timeframe: '1h',
      limit: 100,
      minVolume: 100000,
      topN: 10
    },
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
    signals: [
      'Strong Buy',
      'Buy',
      'Weak Buy',
      'Neutral',
      'Weak Sell',
      'Sell',
      'Strong Sell'
    ],
    regimes: [
      'BULL_PARABOLIC',
      'BULL_BREAKOUT',
      'BULL_ESTABLISHED',
      'BULL_WEAKENING',
      'BEAR_CAPITULATION',
      'BEAR_BREAKDOWN',
      'BEAR_ESTABLISHED',
      'BEAR_WEAKENING',
      'RANGING_VOLATILE',
      'RANGING_ACCUMULATION',
      'RANGING_DISTRIBUTION'
    ],
    crossExchangeSignalTypes: [
      'CONSENSUS',
      'DIVERGENCE',
      'ARBITRAGE',
      'ACCUMULATION',
      'DISTRIBUTION'
    ],
    availableExchanges: [
      'binance',
      'coinbase',
      'kucoinfutures',
      'okx',
      'bybit',
      'kraken'
    ]
  });
});

export default router;

// Backwards-compatible alias: /api/scanner/top -> top-performers
router.get('/top', async (req: Request, res: Response) => {
  try {
    const { days, limit } = req.query;
    const daysNum = parseInt(String(days || '7')) || 7;
    const limitNum = parseInt(String(limit || '10')) || 10;

    let performers: any[] = [];
    try {
      const persistence = new (require('../services/scanner/scanner-persistence').default)(null as any);
      performers = await persistence.getTopPerformers(daysNum, limitNum);
    } catch (e) {
      console.warn('[ScannerAPI] Could not retrieve top performers for alias /top');
    }

    res.json({
      period: `${daysNum} days`,
      limit: limitNum,
      performers
    });
  } catch (error: any) {
    console.error('[Scanner API] /top alias error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve top performers' });
  }
});
