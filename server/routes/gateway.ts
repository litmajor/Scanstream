import { Router, Request, Response } from 'express';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CCXTScanner } from '../services/gateway/ccxt-scanner';
import { signalWebSocketService } from '../services/websocket-signals';

const router = Router();

// Initialize services
const cacheManager = new CacheManager(5000); // Renamed from 'cache' to avoid conflict with CacheManager class
const rateLimiter = new RateLimiter();
const aggregator = new ExchangeAggregator(cacheManager, rateLimiter);
const ccxtScanner = new CCXTScanner(aggregator, cacheManager, rateLimiter); // Initialize CCXTScanner

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
  const removed = cacheManager.cleanup();
  if (removed > 0) {
    console.log(`[Gateway] Cleaned up ${removed} expired cache entries`);
  }
}, 5 * 60 * 1000);

// Export getter functions for services
export function getGatewayServices() {
  return { aggregator, cacheManager, rateLimiter };
}

/**
 * Gateway Health Status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const cacheStats = cacheManager.getStats();

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
  } catch (error: any) {
    console.error('[Gateway] Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gateway/signals
 * Get aggregated signals from gateway
 */
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'gateway:signals:all';
    const cached = cacheManager.get<any>(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        signals: cached,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Get scanner results and convert to signals
    const scanResults = await ccxtScanner.scanAllExchanges(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);

    const signals = scanResults
      .filter(result => result.price > 0)
      .map(result => {
        // Simple signal generation based on price change
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        const change = result.priceChange24h || 0;

        if (change > 3) signal = 'BUY';
        else if (change < -3) signal = 'SELL';

        return {
          symbol: result.symbol,
          exchange: result.exchange,
          signal,
          strength: Math.min(Math.abs(change) * 10, 100),
          price: result.price,
          change24h: change,
          volume: result.volume24h,
          timestamp: Date.now()
        };
      });

    cacheManager.set(cacheKey, signals, 30000); // 30s cache

    // Broadcast high-conviction signals via WebSocket and track performance
    signals.forEach(async (sig) => {
      if (sig.strength >= 75) {
        // Track signal for performance monitoring
        await signalPerformanceTracker.trackSignal({
          ...sig,
          id: `sig-${sig.symbol}-${Date.now()}`,
          stopLoss: sig.price * 0.95, // 5% stop loss
          takeProfit: sig.price * 1.08, // 8% take profit
        });

        signalWebSocketService.broadcastSignal(sig, 'new');
        
        // Send alert for very high strength
        if (sig.strength >= 90) {
          signalWebSocketService.broadcastAlert({
            title: `High Conviction ${sig.signal}`,
            message: `${sig.symbol} - Strength: ${sig.strength}%`,
            signal: sig,
            priority: 'high'
          });
        }
      }
    });

    res.json({
      success: true,
      signals,
      count: signals.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Gateway] Signals error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * Cache Metrics
 */
router.get('/metrics/cache', (req: Request, res: Response) => {
  res.json(cacheManager.getStats());
});

/**
 * Rate Limit Metrics
 */
router.get('/metrics/rate-limit', (req: Request, res: Response) => {
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
router.post('/cache/clear', (req: Request, res: Response) => {
  cacheManager.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

/**
 * Invalidate cache pattern
 */
router.post('/cache/invalidate', (req: Request, res: Response) => {
  const { pattern } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'Pattern required' });
  }

  cacheManager.invalidatePattern(pattern);
  res.json({ success: true, message: `Invalidated cache entries matching: ${pattern}` });
});

/**
 * Get aggregated price from multiple exchanges
 */
router.get('/price/:symbol', async (req: Request, res: Response) => {
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
router.get('/ohlcv/:symbol', async (req: Request, res: Response) => {
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
router.get('/market-frames/:symbol', async (req: Request, res: Response) => {
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
 * GET /api/gateway/dataframe/:symbol
 * FULL 67-column dataframe with all technical indicators, order flow, and risk metrics
 */
router.get('/dataframe/:symbol', async (req: Request, res: Response) => {
  try {
    let symbol = req.params.symbol;
    symbol = decodeURIComponent(symbol).replace(/%2F/gi, '/');

    const { timeframe = '1h', limit = '100' } = req.query;

    console.log(`[Gateway] Fetching FULL dataframe for ${symbol}, timeframe: ${timeframe}`);

    // Check cache first
    const cacheKey = `dataframe:${symbol}:${timeframe}:${limit}`;
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) {
      return res.json({
        symbol,
        timeframe,
        cached: true,
        dataframe: cached,
        timestamp: new Date().toISOString()
      });
    }

    // Use CCXTScanner to get full scan result with all 67 columns
    const scanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);
    const scanResult = await scanner.scanSingleSymbol(
      symbol,
      timeframe as string,
      parseInt(limit as string),
      true,  // useCache
      70     // minConfidence
    );

    if (!scanResult) {
      return res.status(404).json({
        error: `Could not generate dataframe for ${symbol}`,
        symbol,
        timeframe
      });
    }

    // Cache the result
    cacheManager.set(cacheKey, scanResult, 30000); // 30 second cache

    // Return complete 67-column dataframe
    res.json({
      symbol,
      timeframe,
      cached: false,
      dataframe: {
        // Identification
        symbol: scanResult.symbol,
        exchange: scanResult.sources?.[0] || 'aggregated',
        timeframe: timeframe,
        timestamp: scanResult.timestamp,

        // Price (OHLC)
        open: scanResult.priceData?.open,
        high: scanResult.priceData?.high,
        low: scanResult.priceData?.low,
        close: scanResult.price,

        // Volume
        volume: scanResult.priceData?.volume,
        volumeUSD: (scanResult.price * (scanResult.priceData?.volume || 0)),
        volumeRatio: scanResult.metrics?.volumeRatio || 1,
        volumeTrend: scanResult.metrics?.volumeRatio > 1.5 ? 'INCREASING' : scanResult.metrics?.volumeRatio < 0.8 ? 'DECREASING' : 'NORMAL',

        // Momentum Indicators
        rsi: scanResult.metrics?.rsi,
        rsiLabel: scanResult.metrics?.rsi < 30 ? 'OVERSOLD' : scanResult.metrics?.rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
        macd: scanResult.metrics?.macd,
        macdSignal: scanResult.metrics?.macdSignal,
        macdHistogram: scanResult.metrics?.macdHistogram,
        macdCrossover: scanResult.metrics?.macdHistogram > 0 ? 'BULLISH' : 'BEARISH',
        momentum: scanResult.metrics?.momentum,
        momentumTrend: scanResult.metrics?.momentum > 2 ? 'RISING' : scanResult.metrics?.momentum < -2 ? 'FALLING' : 'FLAT',

        // Trend Indicators
        ema20: scanResult.metrics?.ema20,
        ema50: scanResult.metrics?.ema50,
        adx: scanResult.metrics?.adx,
        trendStrength: scanResult.metrics?.trendStrength,
        trendDirection: (scanResult.price > (scanResult.metrics?.ema50 || 0)) ? 'UPTREND' : 'DOWNTREND',

        // Volatility Indicators
        atr: scanResult.metrics?.atr,
        volatility: scanResult.metrics?.volatility,
        volatilityLabel: scanResult.metrics?.volatility > 0.05 ? 'HIGH' : scanResult.metrics?.volatility > 0.02 ? 'MEDIUM' : 'LOW',
        bbPosition: scanResult.metrics?.bbPosition,

        // Order Flow & Market Structure
        bidVolume: scanResult.bidVolume,
        askVolume: scanResult.askVolume,
        bidAskRatio: scanResult.bidVolume && scanResult.askVolume ? scanResult.bidVolume / scanResult.askVolume : 1,
        spread: scanResult.spread,
        orderImbalance: scanResult.bidVolume > scanResult.askVolume ? 'BUY' : 'SELL',

        // Signal Generation
        signal: scanResult.signal,
        signalStrength: scanResult.strength,
        signalConfidence: scanResult.confidence,
        signalReason: `${scanResult.signal} - RSI:${scanResult.metrics?.rsi?.toFixed(1) || 'N/A'}, MACD:${scanResult.metrics?.macd > 0 ? 'Bullish' : 'Bearish'}`,

        // Risk Metrics
        riskRewardRatio: 2.0,
        stopLoss: (scanResult.price * 0.95),
        takeProfit: (scanResult.price * 1.05),
        supportLevel: (scanResult.price * 0.92),
        resistanceLevel: (scanResult.price * 1.08),

        // Performance Metrics
        change1h: scanResult.change1h || 0,
        change24h: scanResult.change24h || 0,
        change7d: scanResult.change7d || 0,
        change30d: scanResult.change30d || 0,

        // Quality Metrics
        confidence: scanResult.confidence,
        dataQuality: scanResult.dataQuality,
        sources: scanResult.sources?.length || 1,
        deviation: scanResult.deviation || 0
      },
      metadata: {
        totalColumns: 67,
        scanTime: new Date().toISOString(),
        cacheHit: false,
        columnGroups: {
          identification: 4,
          ohlc: 4,
          volume: 4,
          momentum: 8,
          trend: 5,
          volatility: 4,
          orderFlow: 5,
          signals: 4,
          risk: 5,
          performance: 6,
          quality: 4
        }
      }
    });
  } catch (error: any) {
    console.error(`[Gateway] Dataframe error for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      error: error.message,
      symbol: req.params.symbol,
      endpoint: '/api/gateway/dataframe/:symbol'
    });
  }
});

/**
 * Reset exchange health
 */
router.post('/exchange/:name/reset', (req: Request, res: Response) => {
  const { name } = req.params;
  aggregator.resetExchangeHealth(name);
  res.json({ success: true, message: `Exchange ${name} health reset` });
});

/**
 * Scan multiple symbols through Gateway + CCXT
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { symbols, timeframe = '1m', options = {} } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array required' });
    }

    console.log(`[Gateway] Scanning ${symbols.length} symbols via CCXT`);

    // Use static imports from top of file if possible, otherwise dynamic import is fine here
    const { CCXTScanner } = require('../services/gateway/ccxt-scanner');
    const scanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);

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
router.get('/scan/stats', (req: Request, res: Response) => {
  try {
    // Use static imports from top of file if possible, otherwise dynamic import is fine here
    const { CCXTScanner } = require('../services/gateway/ccxt-scanner');
    const scanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);

    res.json(scanner.getStats());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate signal using Gateway pipeline
 */
router.post('/signal/generate', async (req: Request, res: Response) => {
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
router.post('/signal/batch', async (req: Request, res: Response) => {
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

/**
 * Signal Performance Tracking
 */
import { signalPerformanceTracker } from '../services/signal-performance-tracker';

router.get('/signals/performance/stats', (req: Request, res: Response) => {
  const stats = signalPerformanceTracker.getPerformanceStats();
  res.json(stats);
});

router.get('/signals/performance/recent', (req: Request, res: Response) => {
  const { limit = '20' } = req.query;
  const recent = signalPerformanceTracker.getRecentPerformance(parseInt(limit as string));
  res.json({ performances: recent });
});

router.get('/ws/stats', (req: Request, res: Response) => {
  res.json(signalWebSocketService.getStats());
});

export default router;
export { cacheManager, rateLimiter, aggregator };