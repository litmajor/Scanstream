
import { Router } from 'express';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';

const router = Router();

// Initialize services
const cache = new CacheManager(5000);
const rateLimiter = new RateLimiter();
const aggregator = new ExchangeAggregator(cache, rateLimiter);

// Initialize aggregator with CCXT
aggregator.initialize().then(() => {
  console.log('[Gateway] Aggregator ready');
}).catch(err => {
  console.error('[Gateway] Aggregator initialization failed:', err);
});

// Initialize rate limits for exchanges
rateLimiter.initExchange('binance', 400);
rateLimiter.initExchange('coinbase', 200);
rateLimiter.initExchange('kraken', 100);
rateLimiter.initExchange('kucoinfutures', 50);
rateLimiter.initExchange('okx', 150);
rateLimiter.initExchange('bybit', 150);

// Cleanup cache every 5 minutes
setInterval(() => {
  const removed = cache.cleanup();
  if (removed > 0) {
    console.log(`[Gateway] Cleaned up ${removed} expired cache entries`);
  }
}, 5 * 60 * 1000);

/**
 * Gateway Health Status
 */
router.get('/health', async (req, res) => {
  const cacheStats = cache.getStats();
  
  const rateLimitStats = {
    binance: rateLimiter.getStats('binance'),
    coinbase: rateLimiter.getStats('coinbase'),
    kraken: rateLimiter.getStats('kraken'),
    kucoinfutures: rateLimiter.getStats('kucoinfutures'),
    okx: rateLimiter.getStats('okx'),
    bybit: rateLimiter.getStats('bybit')
  };

  const exchangeHealth = aggregator.getHealthStatus();

  const healthyCount = Object.values(exchangeHealth).filter(e => e.healthy).length;
  const status = healthyCount === 0 ? 'down' : 
                 healthyCount < 3 ? 'degraded' : 'healthy';

  res.json({
    status,
    exchanges: exchangeHealth,
    rateLimits: rateLimitStats,
    cache: {
      hitRate: cacheStats.hitRate,
      entries: cacheStats.entries
    },
    timestamp: new Date()
  });
});

/**
 * Cache Metrics
 */
router.get('/metrics/cache', (req, res) => {
  res.json(cache.getStats());
});

/**
 * Rate Limit Metrics
 */
router.get('/metrics/rate-limit', (req, res) => {
  const stats = {
    binance: rateLimiter.getStats('binance'),
    coinbase: rateLimiter.getStats('coinbase'),
    kraken: rateLimiter.getStats('kraken'),
    kucoinfutures: rateLimiter.getStats('kucoinfutures'),
    okx: rateLimiter.getStats('okx'),
    bybit: rateLimiter.getStats('bybit')
  };

  res.json(stats);
});

/**
 * Clear cache (admin endpoint)
 */
router.post('/cache/clear', (req, res) => {
  cache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

/**
 * Invalidate cache pattern
 */
router.post('/cache/invalidate', (req, res) => {
  const { pattern } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'Pattern required' });
  }

  cache.invalidatePattern(pattern);
  res.json({ success: true, message: `Invalidated cache entries matching: ${pattern}` });
});

/**
 * Get aggregated price from multiple exchanges
 */
router.get('/price/:symbol', async (req, res) => {
  try {
    let symbol = req.params.symbol;
    
    // Handle URL-encoded slashes (BTC%2FUSDT -> BTC/USDT)
    symbol = decodeURIComponent(symbol).replace(/%2F/gi, '/');
    
    console.log(`[Gateway] Fetching price for ${symbol}`);
    const priceData = await aggregator.getAggregatedPrice(symbol);
    res.json(priceData);
  } catch (error: any) {
    console.error(`[Gateway] Price fetch error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: error.message, symbol: req.params.symbol });
  }
});

/**
 * Get OHLCV data with smart fallback
 */
router.get('/ohlcv/:symbol', async (req, res) => {
  try {
    let symbol = req.params.symbol;
    
    // Handle URL-encoded slashes
    symbol = decodeURIComponent(symbol).replace(/%2F/gi, '/');
    
    const { timeframe = '1m', limit = '100' } = req.query;
    
    console.log(`[Gateway] Fetching OHLCV for ${symbol}, timeframe: ${timeframe}, limit: ${limit}`);
    
    const ohlcv = await aggregator.getOHLCV(
      symbol,
      timeframe as string,
      parseInt(limit as string)
    );
    
    res.json({
      symbol,
      timeframe,
      count: ohlcv.length,
      data: ohlcv
    });
  } catch (error: any) {
    console.error(`[Gateway] OHLCV fetch error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: error.message, symbol: req.params.symbol });
  }
});

/**
 * Get market frames for signal generation
 */
router.get('/market-frames/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { timeframe = '1m', limit = '100' } = req.query;
    
    const frames = await aggregator.getMarketFrames(
      symbol,
      timeframe as string,
      parseInt(limit as string)
    );
    
    res.json({
      symbol,
      timeframe,
      count: frames.length,
      frames
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset exchange health
 */
router.post('/exchange/:name/reset', (req, res) => {
  const { name } = req.params;
  aggregator.resetExchangeHealth(name);
  res.json({ success: true, message: `Exchange ${name} health reset` });
});

/**
 * Scan multiple symbols through Gateway + CCXT
 */
router.post('/scan', async (req, res) => {
  try {
    const { symbols, timeframe = '1m', options = {} } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array required' });
    }

    console.log(`[Gateway] Scanning ${symbols.length} symbols via CCXT`);

    const { CCXTScanner } = require('../services/gateway/ccxt-scanner');
    const scanner = new CCXTScanner(aggregator, cache, rateLimiter);

    const results = await scanner.scanSymbols(symbols, timeframe, options);

    res.json({
      scanned: results.length,
      total: symbols.length,
      timeframe,
      results,
      stats: scanner.getStats(),
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('[Gateway] Scan error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get scan statistics
 */
router.get('/scan/stats', (req, res) => {
  try {
    const { CCXTScanner } = require('../services/gateway/ccxt-scanner');
    const scanner = new CCXTScanner(aggregator, cache, rateLimiter);
    
    res.json(scanner.getStats());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate signal using Gateway pipeline
 */
router.post('/signal/generate', async (req, res) => {
  try {
    const { symbol, timeframe = '1m', limit = 100 } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }

    console.log(`[Gateway] Generating signal for ${symbol}, timeframe: ${timeframe}`);

    // Use static imports from top of file
    const { SignalEngine, defaultTradingConfig } = require('../trading-engine');
    const { EnhancedMultiTimeframeAnalyzer } = require('../multi-timeframe');
    const { SignalPipeline } = require('../services/gateway/signal-pipeline');

    const signalEngine = new SignalEngine(defaultTradingConfig);
    const analyzer = new EnhancedMultiTimeframeAnalyzer(signalEngine);
    const pipeline = new SignalPipeline(aggregator, signalEngine, analyzer);

    const signal = await pipeline.generateSignal(symbol, timeframe, limit);

    res.json({ 
      symbol, 
      timeframe,
      signal,
      generatedAt: new Date()
    });
  } catch (error: any) {
    console.error(`[Gateway] Signal generation error:`, error.message);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * Batch signal generation
 */
router.post('/signal/batch', async (req, res) => {
  try {
    const { symbols, timeframe = '1m' } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array required' });
    }

    console.log(`[Gateway] Batch signal generation for ${symbols.length} symbols`);

    const { SignalEngine, defaultTradingConfig } = require('../trading-engine');
    const { SignalPipeline } = require('../services/gateway/signal-pipeline');

    const signalEngine = new SignalEngine(defaultTradingConfig);
    const pipeline = new SignalPipeline(aggregator, signalEngine);

    const results = await pipeline.generateBatchSignals(symbols, timeframe);

    res.json({ 
      timeframe,
      count: results.length,
      results,
      generatedAt: new Date()
    });
  } catch (error: any) {
    console.error(`[Gateway] Batch signal error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
export { cache, rateLimiter, aggregator };
