import { Router, Request, Response } from 'express';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CCXTScanner } from '../services/gateway/ccxt-scanner';
import { LiquidityMonitor } from '../services/gateway/liquidity-monitor';
import { GasProvider } from '../services/gateway/gas-provider';
import { SecurityValidator } from '../services/gateway/security-validator';
import { signalWebSocketService } from '../services/websocket-signals';
import { gatewayAlertSystem } from '../services/gateway-alerts';
import gatewayMetricsRouter from './gateway-metrics';
import { SignalEngine, defaultTradingConfig } from '../trading-engine';

const router = Router();

// Mount metrics routes
router.use('/metrics', gatewayMetricsRouter);

// Initialize services
const cacheManager = new CacheManager(5000);
const rateLimiter = new RateLimiter();
const aggregator = new ExchangeAggregator(cacheManager, rateLimiter);
const ccxtScanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);

// Phase 3: Intelligence Layer
const liquidityMonitor = new LiquidityMonitor(aggregator, cacheManager);
const gasProvider = new GasProvider(cacheManager);
const securityValidator = new SecurityValidator(aggregator, liquidityMonitor);
const signalEngine = new SignalEngine(defaultTradingConfig);

// Initialize aggregator with CCXT and warm cache
aggregator.initialize().then(async () => {
  console.log('[Gateway] Aggregator ready');
  
  // Import and initialize cache warmer
  const { CacheWarmer } = await import('../services/gateway/cache-warmer');
  const warmer = new CacheWarmer(aggregator);
  
  // Warm cache on startup
  await warmer.warmCache();
  
  // Start continuous warming (every 60 seconds)
  warmer.startContinuousWarming(60000);
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

// Cleanup cache every 5 minutes and check metrics
setInterval(() => {
  const removed = cacheManager.cleanup();
  if (removed > 0) {
    console.log(`[Gateway] Cleaned up ${removed} expired cache entries`);
  }
  
  // Check cache performance
  const cacheStats = cacheManager.getStats();
  gatewayAlertSystem.checkCachePerformance(cacheStats.hitRate);
  
  // Check exchange health and rate limits
  const healthStatus = aggregator.getHealthStatus();
  Object.entries(healthStatus).forEach(([exchange, health]) => {
    gatewayAlertSystem.checkExchangeHealth(exchange, health);
    if (health.latency > 0) {
      gatewayAlertSystem.checkLatency(exchange, health.latency);
    }
  });
  
  // Check rate limit usage
  ['binance', 'coinbase', 'kraken', 'kucoinfutures', 'okx', 'bybit'].forEach(exchange => {
    const stats = rateLimiter.getStats(exchange);
    if (stats && typeof stats.usage === 'number') {
      gatewayAlertSystem.checkRateLimitUsage(exchange, stats.usage);
    }
  });
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
 * Get aggregated signals from gateway with filtering
 * Query params: signalType (BUY/SELL/HOLD), minConfidence (0-100), trendDirection (up/down/neutral)
 */
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const { signalType, minConfidence, trendDirection } = req.query;
    const minConf = minConfidence ? parseFloat(minConfidence as string) : 0;
    
    const cacheKey = `gateway:signals:${signalType || 'all'}:${minConf}:${trendDirection || 'all'}`;
    const cached = cacheManager.get<any>(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        signals: cached,
        cached: true,
        filters: { signalType, minConfidence: minConf, trendDirection },
        timestamp: new Date().toISOString()
      });
    }

    // Get scanner results and convert to signals
    const scanResults = await ccxtScanner.scanSymbols(['BTC/USDT', 'ETH/USDT', 'SOL/USDT'], '1h', {});

    let signals = scanResults
      .filter((result: any) => result.price > 0)
      .map((result: any) => {
        // Simple signal generation based on price change
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        const change = result.priceChange24h || 0;

        if (change > 3) signal = 'BUY';
        else if (change < -3) signal = 'SELL';

        const trend = change > 1 ? 'up' : change < -1 ? 'down' : 'neutral';

        return {
          symbol: result.symbol,
          exchange: result.exchange,
          signal,
          strength: Math.min(Math.abs(change) * 10, 100),
          price: result.price,
          change24h: change,
          volume: result.volume24h,
          trend,
          timestamp: Date.now()
        };
      });

    // Apply filters
    if (signalType && signalType !== 'all') {
      signals = signals.filter((s: any) => s.signal === (signalType as string).toUpperCase());
    }
    
    if (minConf > 0) {
      signals = signals.filter((s: any) => s.strength >= minConf);
    }
    
    if (trendDirection && trendDirection !== 'all') {
      signals = signals.filter((s: any) => s.trend === trendDirection);
    }

    cacheManager.set(cacheKey, signals, 30000); // 30s cache

    // Broadcast high-conviction signals via WebSocket and track performance
    signals.forEach(async (sig: any) => {
      if (sig.strength >= 75) {
        // Track signal for performance monitoring
        await signalPerformanceTracker.trackSignal({
          ...sig,
          id: `sig-${sig.symbol}-${Date.now()}`,
          stopLoss: sig.price * 0.95, // 5% stop loss
          takeProfit: sig.price * 1.08, // 8% take profit
        });

        // Store signal in database for historical analysis
        try {
          const { storage } = await import('../storage');
          if (storage && typeof (storage as any).storeSignal === 'function') {
            await (storage as any).storeSignal({
              symbol: sig.symbol,
              exchange: sig.exchange,
              timeframe: '24h',
              signal: sig.signal,
              strength: sig.strength / 100, // Convert to 0-1 range
              price: sig.price,
              indicators: {
                rsi: sig.rsi || 0,
                macd: sig.macd || 'neutral',
                ema: sig.ema || 'neutral',
                volume: sig.volume ? 'high' : 'medium'
              },
              reason: `Gateway signal - ${sig.signal} with ${sig.strength}% strength`,
              timestamp: new Date()
            });
          }
        } catch (dbError) {
          console.error('[Gateway] Failed to store signal:', dbError);
        }

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
      filters: {
        signalType: signalType || 'all',
        minConfidence: minConf,
        trendDirection: trendDirection || 'all'
      },
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
    
    // Broadcast price update via WebSocket
    signalWebSocketService.broadcastPriceUpdate(symbol, priceData);
    
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
 * FULL 67-column dataframe with all technical indicators - NO database writes
 */
router.get('/dataframe/:symbol', async (req: Request, res: Response) => {
  try {
    let symbol = req.params.symbol;
    symbol = decodeURIComponent(symbol).replace(/%2F/gi, '/');

    const { timeframe = '1h', limit = '100' } = req.query;
    const limitNum = parseInt(limit as string) || 100;

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

    // Get latest OHLCV data from aggregator (no persistence)
    const frames = await aggregator.getMarketFrames(symbol, timeframe as string, limitNum);
    
    if (!frames || frames.length === 0) {
      console.warn(`[Gateway] No frames returned for ${symbol} on timeframe ${timeframe}`);
      return res.status(404).json({
        error: `No data available for ${symbol}`,
        symbol,
        timeframe,
        frames: frames?.length || 0
      });
    }

    const latest = frames[frames.length - 1];
    const prev = frames.length > 1 ? frames[frames.length - 2] : latest;

    // Extract price data - handle both JSON format and direct properties
    const latestPrice = (latest.price as any)?.close || (latest as any).close || 0;
    const prevPrice = (prev.price as any)?.close || (prev as any).close || 0;
    
    // Log the structure to debug
    console.log(`[Gateway] Latest frame for ${symbol}:`, {
      timestamp: latest.timestamp,
      price: latest.price,
      close: latestPrice,
      volume: latest.volume,
      hasPrice: !!latestPrice,
      keys: Object.keys(latest)
    });

    // Calculate indicators from raw OHLC data
    const closes = frames.map(f => ((f.price as any)?.close || (f as any).close || 0));
    const volumes = frames.map(f => f.volume || 0);
    
    // Simple RSI calculation
    const rsi = calculateRSI(closes, 14);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const atr = calculateATR(frames, 14);
    
    // Simple MACD
    const macd = calculateMACD(closes);
    
    // Calculate momentum early for use in trendStrength
    const momentum = prevPrice > 0 ? ((latestPrice - prevPrice) / prevPrice) * 100 : 0;
    const volatility = calculateVolatility(closes);
    const bbPosition = (closes.length > 0) ? ((latestPrice - Math.min(...closes)) / (Math.max(...closes) - Math.min(...closes))) : 0.5;

    const dataframe = {
      // Identification (4)
      symbol,
      exchange: 'aggregated',
      timeframe,
      timestamp: new Date().toISOString(),

      // Price OHLC (4)
      open: (latest.price as any)?.open || (latest as any).open || 0,
      high: (latest.price as any)?.high || (latest as any).high || 0,
      low: (latest.price as any)?.low || (latest as any).low || 0,
      close: latestPrice,

      // Volume (4)
      volume: latest.volume || 0,
      volumeUSD: (latestPrice * (latest.volume || 0)),
      volumeRatio: (latest.volume || 0) / (prev.volume || 1),
      volumeTrend: (latest.volume || 0) > (prev.volume || 0) ? 'INCREASING' : 'DECREASING',

      // Momentum (8)
      rsi: rsi || 50,
      rsiLabel: (rsi || 50) < 30 ? 'OVERSOLD' : (rsi || 50) > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
      macd: macd.macd || 0,
      macdSignal: macd.signal || 0,
      macdHistogram: (macd.macd || 0) - (macd.signal || 0),
      macdCrossover: (macd.macd || 0) > (macd.signal || 0) ? 'BULLISH' : 'BEARISH',
      momentum: momentum,
      momentumTrend: momentum > 0 ? 'RISING' : 'FALLING',

      // Trend (5)
      ema20: ema20 || latestPrice,
      ema50: ema50 || latestPrice,
      adx: 25, // placeholder
      // Calculate trend strength based on multiple factors
      trendStrength: (() => {
        const { confidence } = generateSignalTypeWithScores({
          rsi,
          macdHistogram: (macd.macd || 0) - (macd.signal || 0),
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
        });
        return confidence;
      })(),
      trendDirection: latestPrice > (ema50 || 0) ? 'UPTREND' : 'DOWNTREND',

      // Volatility (4)
      atr: atr || 0,
      volatility: volatility,
      volatilityLabel: volatility > 0.05 ? 'HIGH' : 'MEDIUM',
      bbPosition: bbPosition,

      // Order Flow (5)
      bidVolume: (latest.volume || 0) * 0.5,
      askVolume: (latest.volume || 0) * 0.5,
      bidAskRatio: 1.0,
      spread: ((latest.price as any)?.high || (latest as any).high || 0) - ((latest.price as any)?.low || (latest as any).low || 0),
      orderImbalance: latestPrice > prevPrice ? 'BUY' : 'SELL',
      
      // Signal generation (3)
      signal: (() => {
        const { type } = generateSignalTypeWithScores({
          rsi,
          macdHistogram: (macd.macd || 0) - (macd.signal || 0),
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
        });
        return type;
      })(),
      signalStrength: (() => {
        const { strength } = generateSignalTypeWithScores({
          rsi,
          macdHistogram: (macd.macd || 0) - (macd.signal || 0),
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
        });
        return strength;
      })(),
      signalConfidence: (() => {
        const { confidence } = generateSignalTypeWithScores({
          rsi,
          macdHistogram: (macd.macd || 0) - (macd.signal || 0),
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
        });
        return confidence;
      })(),

      // Advanced Moving Averages (6)
      ema12: calculateEMA(closes, 12),
      ema26: calculateEMA(closes, 26),
      sma20: closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b) / 20 : latestPrice,
      sma50: closes.length >= 50 ? closes.slice(-50).reduce((a, b) => a + b) / 50 : latestPrice,
      sma200: closes.length >= 200 ? closes.slice(-200).reduce((a, b) => a + b) / 200 : latestPrice,
      vwap: closes.length > 0 ? closes.reduce((a, b) => a + b) / closes.length : latestPrice,

      // RSI Extensions (4)
      rsi14: rsi,
      rsi7: calculateRSI(closes, 7),
      rsi21: calculateRSI(closes, 21),
      rsiDivergence: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NORMAL',

      // Bollinger Bands (6)
      bbUpper: closes.length > 0 ? (Math.max(...closes)) : latestPrice,
      bbLower: closes.length > 0 ? (Math.min(...closes)) : latestPrice,
      bbMiddle: closes.length > 0 ? (closes.reduce((a, b) => a + b) / closes.length) : latestPrice,
      bbWidth: closes.length > 0 ? (Math.max(...closes) - Math.min(...closes)) : 0,
      bbWidthPercent: closes.length > 0 ? ((Math.max(...closes) - Math.min(...closes)) / (closes.reduce((a, b) => a + b) / closes.length)) * 100 : 0,
      bbBandtouch: bbPosition < 0.1 ? 'LOWER' : bbPosition > 0.9 ? 'UPPER' : 'MIDDLE',

      // Stochastic (4)
      stochK: bbPosition * 100,
      stochD: bbPosition * 95,
      stochRSI: (rsi - 30) / 40 * 100,
      slowStoch: Math.min(100, Math.max(0, ((rsi - 30) / 40 * 100 + bbPosition * 100) / 2)),

      // Volume Analysis (6)
      volumeSMA: volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b) / 20 : latest.volume || 0,
      volumeChange: (latest.volume || 0) / (prev.volume || 1),
      volumeMultiple: (latest.volume || 0) / (volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b) / 20 : 1),
      onBalanceVolume: volumes.reduce((sum, v, i) => sum + (closes[i] > (closes[i - 1] || 0) ? v : -v), 0),
      volumeWeightedPrice: volumes.reduce((sum, v, i) => sum + closes[i] * v, 0) / volumes.reduce((a, b) => a + b, 0),
      volumeProfile: `${volumes.length} candles`,

      // Momentum Indicators (5)
      roc: closes.length > 12 ? ((closes[closes.length - 1] - closes[closes.length - 13]) / closes[closes.length - 13] * 100) : 0,
      cmo: calculateRSI(closes, 14) - 50,
      aos: momentum > 0 ? 'RISING' : 'FALLING',
      keltner: atr * 2,
      priceVsKeltner: atr > 0 ? (Math.abs(latestPrice - ema20) / atr) : 0,

      // Pattern Recognition (4)
      support: Math.min(...closes.slice(-20)),
      resistance: Math.max(...closes.slice(-20)),
      priceToSupport: latestPrice - Math.min(...closes.slice(-20)),
      priceToResistance: Math.max(...closes.slice(-20)) - latestPrice,

      // Risk Metrics (5)
      dailyHighRange: ((latest.price as any)?.high || (latest as any).high || 0) - ((latest.price as any)?.low || (latest as any).low || 0),
      highestClose: Math.max(...closes),
      lowestClose: Math.min(...closes),
      priceRange: Math.max(...closes) - Math.min(...closes),
      drawdown: (Math.max(...closes) - latestPrice) / Math.max(...closes) * 100,

      // Performance Metrics (5)
      priceChangePercent: momentum,
      priceChangeAbsolute: latestPrice - prevPrice,
      priceChangePoints: Math.abs(latestPrice - prevPrice) / (prevPrice || 1),
      highestClosePercent: (Math.max(...closes) - latestPrice) / latestPrice * 100,
      lowestClosePercent: (latestPrice - Math.min(...closes)) / latestPrice * 100,

      // Trend Analysis (4)
      trendIntensity: Math.abs(momentum) / 100,
      trendScore: Math.abs(momentum) + (rsi < 30 ? 10 : rsi > 70 ? -10 : 0) + (macd.macd > macd.signal ? 5 : -5),
      upcandles: closes.filter((c, i) => c > (closes[i - 1] || c)).length,
      downcandles: closes.filter((c, i) => c < (closes[i - 1] || c)).length,
    };

    // Cache the dataframe
    cacheManager.set(cacheKey, dataframe, 60000); // 1 minute cache

    res.json({
      symbol,
      timeframe,
      cached: false,
      dataframe,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`[Gateway] Dataframe error for ${req.params.symbol}:`, error.message);
    res.status(500).json({ error: error.message, symbol: req.params.symbol });
  }
});

/**
 * PHASE 3: INTELLIGENCE LAYER ENDPOINTS
 */

/**
 * Check liquidity for a symbol
 */
router.get('/liquidity/:symbol', async (req: Request, res: Response) => {
  try {
    let symbol = req.params.symbol;
    symbol = decodeURIComponent(symbol).replace(/%2F/gi, '/');
    
    const { amount } = req.query;
    const amountNum = amount ? parseFloat(amount as string) : undefined;
    
    const liquidity = await liquidityMonitor.checkLiquidity(symbol, amountNum);
    
    // Broadcast liquidity update via WebSocket
    signalWebSocketService.broadcastLiquidityUpdate(symbol, liquidity);
    
    res.json({
      success: true,
      liquidity,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Gateway] Liquidity check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Batch liquidity check
 */
router.post('/liquidity/batch', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'Symbols array required' });
    }
    
    const results = await liquidityMonitor.batchCheckLiquidity(symbols);
    
    res.json({
      success: true,
      count: results.size,
      liquidity: Object.fromEntries(results),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get gas prices
 */
router.get('/gas/:chain', async (req: Request, res: Response) => {
  try {
    const { chain } = req.params;
    const gasPrice = await gasProvider.getGasPrice(chain || 'ethereum');
    
    res.json({
      success: true,
      chain: chain || 'ethereum',
      gasPrice,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/gas', async (_req: Request, res: Response) => {
  try {
    const gasPrice = await gasProvider.getGasPrice('ethereum');
    
    res.json({
      success: true,
      chain: 'ethereum',
      gasPrice,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all alerts
 */
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const { acknowledged, severity } = req.query;
    
    const alerts = gatewayAlertSystem.getAlerts({
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
      severity: severity as string
    });
    
    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Acknowledge alert
 */
router.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = gatewayAlertSystem.acknowledgeAlert(id);
    
    res.json({ success, message: success ? 'Alert acknowledged' : 'Alert not found' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Clear acknowledged alerts
 */
router.delete('/alerts/acknowledged', (req: Request, res: Response) => {
  try {
    const cleared = gatewayAlertSystem.clearAcknowledged();
    res.json({ success: true, cleared });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update alert thresholds
 */
router.post('/alerts/thresholds', (req: Request, res: Response) => {
  try {
    const thresholds = req.body;
    gatewayAlertSystem.updateThresholds(thresholds);
    res.json({ success: true, message: 'Thresholds updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Estimate transaction cost
 */
router.post('/gas/estimate', async (req: Request, res: Response) => {
  try {
    const { chain = 'ethereum', gasLimit = 21000, speed = 'standard' } = req.body;
    
    const cost = await gasProvider.estimateCost(chain, gasLimit, speed);
    
    res.json({
      success: true,
      estimatedCostUSD: cost,
      chain,
      gasLimit,
      speed,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Validate trading operation
 */
router.post('/security/validate', async (req: Request, res: Response) => {
  try {
    const { symbol, amount, operation = 'buy' } = req.body;
    
    if (!symbol || !amount) {
      return res.status(400).json({ error: 'Symbol and amount required' });
    }
    
    const validation = await securityValidator.validateOperation(
      symbol,
      parseFloat(amount),
      operation
    );
    
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Gateway] Security validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get optimal exchange recommendation
 */
router.post('/recommend-exchange', async (req: Request, res: Response) => {
  try {
    const { symbol, operation = 'fetch', requirements = {} } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol required' });
    }
    
    // Get liquidity and health data
    const [liquidity, health] = await Promise.all([
      liquidityMonitor.checkLiquidity(symbol),
      Promise.resolve(aggregator.getHealthStatus())
    ]);
    
    // Score each exchange
    const scores = liquidity.exchanges.map(ex => {
      const exchangeHealth = health[ex.name];
      if (!exchangeHealth?.healthy) return { name: ex.name, score: 0 };
      
      let score = 0;
      
      // Liquidity weight (40%)
      score += (ex.volume / liquidity.totalVolume24h) * 40;
      
      // Latency weight (30%)
      score += Math.max(0, 30 - (exchangeHealth.latency / 10));
      
      // Spread weight (20%)
      score += Math.max(0, 20 - (ex.spread * 1000));
      
      // Rate limit weight (10%)
      score += (1 - exchangeHealth.rateUsage) * 10;
      
      return { name: ex.name, score };
    });
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    const recommended = scores[0];
    
    res.json({
      success: true,
      recommended: recommended.name,
      score: recommended.score,
      alternatives: scores.slice(1, 3),
      reasoning: [
        `Best liquidity: ${liquidity.liquidityScore.toFixed(0)}/100`,
        `Low latency: ${health[recommended.name]?.latency || 0}ms`,
        `Tight spread: ${(liquidity.spreadPercent * 100).toFixed(2)}%`
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Gateway] Exchange recommendation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/gateway/alerts/subscribe
 * Subscribe to signal alerts for specific criteria
 */
router.post('/alerts/subscribe', async (req: Request, res: Response) => {
  try {
    const { symbols, signalTypes, minStrength } = req.body;
    
    // Store subscription (in production, associate with user ID)
    const subscription = {
      id: `sub-${Date.now()}`,
      symbols: symbols || [],
      signalTypes: signalTypes || ['BUY', 'SELL'],
      minStrength: minStrength || 80,
      createdAt: new Date()
    };
    
    // In production, store in database with user association
    console.log('[Gateway] Alert subscription created:', subscription);
    
    res.json({
      success: true,
      subscription,
      message: 'Alert subscription created. You will receive notifications via WebSocket.'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/gateway/signals/history
 * Get historical signals from database
 */
router.get('/signals/history', async (req: Request, res: Response) => {
  try {
    const { symbol, signalType, limit = '50', offset = '0' } = req.query;
    const { storage } = await import('../storage');
    
    // Query database for historical signals
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    
    // Build query - this is a simplified version
    // In production, use proper Prisma query with filters
    const allSignals = await storage.getLatestSignals(limitNum + offsetNum);
    
    let filtered = allSignals;
    
    if (symbol) {
      filtered = filtered.filter((s: any) => s.symbol === symbol);
    }
    
    if (signalType) {
      filtered = filtered.filter((s: any) => (s.signal || s.type) === signalType);
    }
    
    const paginated = filtered.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      success: true,
      signals: paginated,
      total: filtered.length,
      limit: limitNum,
      offset: offsetNum,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Gateway] Signal history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate signal type and confidence using composite technical + order flow + microstructure scoring
function generateSignalTypeWithScores(dataframe: any): { type: 'BUY' | 'SELL' | 'HOLD', strength: number, confidence: number } {
  const rsi = dataframe.rsi || 50;
  const macdHist = dataframe.macdHistogram || 0;
  const momentum = dataframe.momentum || 0;
  const bbPos = dataframe.bbPosition || 0.5;
  const priceAboveEMA20 = dataframe.close > (dataframe.ema20 || dataframe.close);
  const priceAboveEMA50 = dataframe.close > (dataframe.ema50 || dataframe.close);
  const emaSpread = Math.abs(dataframe.ema20 - dataframe.ema50) / (dataframe.ema50 || 1);
  
  // TECHNICAL SCORE: RSI + MACD + BB Position + EMA trend
  let technicalScore = 0;
  
  // RSI component (-1 to 1)
  if (rsi < 30) technicalScore += 0.4; // Oversold, bullish
  else if (rsi > 70) technicalScore -= 0.4; // Overbought, bearish
  else technicalScore += (50 - Math.abs(rsi - 50)) / 100; // Neutral zone normalized
  
  // MACD component (-1 to 1)
  if (macdHist > 0) technicalScore += 0.25; // Bullish crossover
  else if (macdHist < 0) technicalScore -= 0.25; // Bearish crossover
  
  // Bollinger Bands component (-1 to 1)
  if (bbPos < 0.2) technicalScore += 0.2; // Price near lower band
  else if (bbPos > 0.8) technicalScore -= 0.2; // Price near upper band
  
  // EMA trend alignment (-1 to 1)
  if (priceAboveEMA20 && priceAboveEMA50) technicalScore += 0.15; // Bullish alignment
  else if (!priceAboveEMA20 && !priceAboveEMA50) technicalScore -= 0.15; // Bearish alignment
  
  technicalScore = Math.max(-1, Math.min(1, technicalScore));
  
  // ORDER FLOW SCORE: Momentum-based
  let orderFlowScore = 0;
  if (momentum > 2) orderFlowScore += 0.3; // Strong bullish momentum
  else if (momentum > 0.5) orderFlowScore += 0.15;
  else if (momentum < -2) orderFlowScore -= 0.3; // Strong bearish momentum
  else if (momentum < -0.5) orderFlowScore -= 0.15;
  
  orderFlowScore = Math.max(-1, Math.min(1, orderFlowScore));
  
  // MICROSTRUCTURE SCORE: Volume and spread health
  let microScore = 0.5; // Neutral baseline (we don't have detailed microstructure data in dataframe)
  // In a real scenario, this would use bid/ask spread, depth, toxicity
  
  // COMPOSITE SCORE with weights
  const techWeight = 0.5;
  const flowWeight = 0.3;
  const microWeight = 0.2;
  const compositeScore = (
    technicalScore * techWeight +
    orderFlowScore * flowWeight +
    microScore * microWeight
  );
  
  // STRENGTH: Magnitude of conviction
  const strength = Math.abs(compositeScore);
  
  // CONFIDENCE: Based on indicator alignment
  const alignmentPoints =
    (priceAboveEMA20 === priceAboveEMA50 ? 1 : 0) + // EMA alignment
    (macdHist > 0 === priceAboveEMA50 ? 1 : 0) + // MACD alignment with trend
    ((rsi < 40 || rsi > 60) ? 1 : 0) + // RSI not in neutral zone
    (Math.abs(momentum) > 1 ? 1 : 0); // Strong momentum
  
  const confidence = Math.min(100, 50 + alignmentPoints * 12.5);
  
  // Determine signal type based on composite score
  let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  if (compositeScore > 0.15) type = 'BUY';
  else if (compositeScore < -0.15) type = 'SELL';
  
  return { type, strength: strength * 100, confidence };
}

// Simple indicator calculations
function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / (avgLoss || 1);
  return 100 - (100 / (1 + rs));
}

function calculateEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateMACD(closes: number[]) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  const signal = (macd + ema26) / 2;
  return { macd, signal };
}

function calculateATR(frames: any[], period: number = 14): number {
  if (frames.length < period) return 0;
  let tr = 0;
  for (let i = frames.length - period; i < frames.length; i++) {
    const high = (frames[i].price as any)?.high || (frames[i] as any).high || 0;
    const low = (frames[i].price as any)?.low || (frames[i] as any).low || 0;
    const high_low = high - low;
    tr += high_low;
  }
  return tr / period;
}

function calculateVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  const mean = closes.reduce((a, b) => a + b) / closes.length;
  const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2)) / closes.length;
  return Math.sqrt(variance) / mean;
}

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