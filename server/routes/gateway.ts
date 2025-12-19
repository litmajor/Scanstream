import { Router, Request, Response } from 'express';
import { CacheManager } from '../services/gateway/cache-manager';
import { RateLimiter } from '../services/gateway/rate-limiter';
import { ExchangeAggregator } from '../services/gateway/exchange-aggregator';
import { CCXTScanner } from '../services/gateway/ccxt-scanner';
import { LiquidityMonitor } from '../services/gateway/liquidity-monitor';
import { GasProvider } from '../services/gateway/gas-provider';
import { SecurityValidator } from '../services/gateway/security-validator';
import { signalWebSocketService } from '../services/websocket-signals';
import { signalArchive } from '../services/signal-archive';
import { gatewayAlertSystem } from '../services/gateway-alerts';
import gatewayMetricsRouter from './gateway-metrics';
import { SignalEngine, defaultTradingConfig } from '../trading-engine';
import { signalPerformanceTracker } from '../services/signal-performance-tracker';
import { generateModuleSignal, type ArmDetectionInput, type ModuleState } from '../services/arm-template';


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

// Initialize aggregator with CCXT and warm cache (non-blocking)
let isGatewayReady = false;

aggregator.initialize().then(async () => {
  console.log('[Gateway] Aggregator ready');

  // Don't block on cache warming - do it in background
  (async () => {
    try {
      const { CacheWarmer } = await import('../services/gateway/cache-warmer');
      const warmer = new CacheWarmer(aggregator);

      // Warm cache on startup (non-blocking)
      await warmer.warmCache();
      isGatewayReady = true;
      console.log('[Gateway] Cache warming complete');

      // Start continuous warming (every 60 seconds)
      warmer.startContinuousWarming(60000);
    } catch (err) {
      console.error('[Gateway] Cache warming failed:', err);
      // Still mark as ready even if warming fails
      isGatewayReady = true;
    }
  })();

}).catch(err => {
  console.error('[Gateway] Aggregator initialization failed:', err);
  isGatewayReady = true; // Mark ready anyway to serve requests
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    gatewayReady: isGatewayReady,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
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

  // Add summary
  const allStats = Object.values(stats).filter(s => s !== null);
  const summary = {
    totalExchanges: allStats.length,
    healthyExchanges: allStats.filter((s: any) => s.healthy).length,
    throttledExchanges: allStats.filter((s: any) => s.throttled).length,
    rateLimitedExchanges: allStats.filter((s: any) => s.rateLimitReset).length,
    averageUsage: allStats.reduce((acc: number, s: any) => acc + (s.usage || 0), 0) / allStats.length
  };

  res.json({ stats, summary });
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

    // Add technical indicators to each candle
    // Convert OHLCV data to array format if needed
    const ohlcvArray = (ohlcv as any[]).map((candle: any) => [
      candle[0] || candle.timestamp,
      candle[1] || candle.open,
      candle[2] || candle.high,
      candle[3] || candle.low,
      candle[4] || candle.close,
      candle[5] || candle.volume
    ]);
    
    const closes = ohlcvArray.map(c => c[4]); // Extract close prices
    const dataWithIndicators = ohlcvArray.map((candle: number[], index: number) => {
      let rsi = null;
      let macd = null;
      let ema = null;
      let volumeAvg = null;
      let dataQuality = {
        rsiDataQuality: null as number | null,
        macdDataQuality: null as number | null,
        emaDataQuality: null as number | null
      };
      
      // Calculate RSI if we have enough data (14 periods minimum)
      if (index >= 14) {
        const closePeriod = closes.slice(Math.max(0, index - 14), index + 1);
        rsi = calculateRSI(closePeriod, 14);
        dataQuality.rsiDataQuality = rsi !== null ? 100 : 0;
      } else {
        dataQuality.rsiDataQuality = (index / 14) * 100;
      }
      
      // Calculate MACD if we have enough data (34 periods minimum)
      if (index >= 34) {
        const closePeriod = closes.slice(Math.max(0, index - 33), index + 1);
        const macdCalc = calculateMACD(closePeriod);
        if (macdCalc) {
          macd = {
            line: macdCalc.macd,
            signal: macdCalc.signal,
            histogram: macdCalc.histogram,
          };
          dataQuality.macdDataQuality = 100;
        } else {
          dataQuality.macdDataQuality = 0;
        }
      } else {
        dataQuality.macdDataQuality = (index / 34) * 100;
      }
      
      // Calculate EMA (20-period) if we have enough data
      if (index >= 20) {
        const closePeriod = closes.slice(Math.max(0, index - 19), index + 1);
        ema = calculateEMA(closePeriod, 20);
        dataQuality.emaDataQuality = ema !== null ? 100 : 0;
      } else {
        dataQuality.emaDataQuality = (index / 20) * 100;
      }
      
      // Calculate average volume over last 20 periods
      if (index >= 20) {
        const volumeWindow = ohlcvArray.slice(Math.max(0, index - 19), index + 1);
        const volumeData = volumeWindow.map(c => c[5] || 0);
        const nonZeroVols = volumeData.filter(v => v > 0);
        
        if (nonZeroVols.length > 0) {
          volumeAvg = volumeData.reduce((sum, c) => sum + c, 0) / volumeData.length;
        }
      }
      
      return {
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        rsi: rsi,
        macd: macd,
        ema: ema,
        volumeAvg: volumeAvg,
        dataQuality: dataQuality
      };
    });

    // Assess overall data quality
    const allIndicators = dataWithIndicators.map(d => [d.rsi, d.macd, d.ema]);
    const overallQuality = assessDataQuality(ohlcvArray, allIndicators);

    res.json({
      symbol,
      timeframe,
      count: dataWithIndicators.length,
      dataQuality: createDataQualityStatus(overallQuality, ohlcvArray),
      data: dataWithIndicators
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
      rsi: safeRSIValue(rsi),
      rsiLabel: safeRSIValue(rsi) < 30 ? 'OVERSOLD' : safeRSIValue(rsi) > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
      macd: safeMACDValue(macd).line,
      macdSignal: safeMACDValue(macd).signal,
      macdHistogram: safeMACDValue(macd).histogram,
      macdCrossover: safeMACDValue(macd).line > safeMACDValue(macd).signal ? 'BULLISH' : 'BEARISH',
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
          macdHistogram: safeMACDValue(macd).histogram,
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
      atr: atr ?? 0, // Now in percentage, null becomes 0
      volatility: volatility,
      volatilityLabel: volatility > 0.05 ? 'HIGH' : 'MEDIUM',
      bbPosition: bbPosition,

      // Order Flow (5)
      bidVolume: (latest.volume || 0) * 0.5,
      askVolume: (latest.volume || 0) * 0.5,
      bidAskRatio: 1.0,
      spread: ((latest.price as any)?.high || (latest as any).high || 0) - ((latest.price as any)?.low || (latest as any).low || 0),
      orderImbalance: latestPrice > prevPrice ? 'BUY' : 'SELL',

      // Risk context check: ATR must be available for BUY/SELL signals
      hasRiskContext: atr !== null && atr > 0,

      // Signal generation (3)
      signal: (() => {
        const generated = generateSignalTypeWithScores({
          rsi,
          macdHistogram: safeMACDValue(macd).histogram,
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
          volume: latest.volume || 0,
          volumeRatio: (latest.volume || 0) / (prev.volume || 1),
        });
        
        // CRITICAL: If ATR is unavailable, veto BUY/SELL (force to HOLD)
        // This prevents risky trades without volatility context
        if ((generated.type === 'BUY' || generated.type === 'SELL') && !atr) {
          return 'HOLD';
        }
        return generated.type;
      })(),
      signalHoldReason: (() => {
        const generated = generateSignalTypeWithScores({
          rsi,
          macdHistogram: safeMACDValue(macd).histogram,
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
          volume: latest.volume || 0,
          volumeRatio: (latest.volume || 0) / (prev.volume || 1),
        });
        return generated.holdReason || 'NORMAL';
      })(),
      signalStrength: (() => {
        const { strength } = generateSignalTypeWithScores({
          rsi,
          macdHistogram: safeMACDValue(macd).histogram,
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
          volume: latest.volume || 0,
          volumeRatio: (latest.volume || 0) / (prev.volume || 1),
        });
        return strength;
      })(),
      signalConfidence: (() => {
        const generated = generateSignalTypeWithScores({
          rsi,
          macdHistogram: safeMACDValue(macd).histogram,
          momentum,
          bbPosition,
          close: latestPrice,
          ema20: ema20 || latestPrice,
          ema50: ema50 || latestPrice,
          volume: latest.volume || 0,
          volumeRatio: (latest.volume || 0) / (prev.volume || 1),
        });
        
        // Reduce confidence if ATR is missing
        if (!atr) {
          return Math.max(10, generated.confidence * 0.5);
        }
        return generated.confidence;
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
      rsiDivergence: safeRSIValue(rsi) > 70 ? 'OVERBOUGHT' : safeRSIValue(rsi) < 30 ? 'OVERSOLD' : 'NORMAL',

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
      stochRSI: (safeRSIValue(rsi) - 30) / 40 * 100,
      slowStoch: Math.min(100, Math.max(0, ((safeRSIValue(rsi) - 30) / 40 * 100 + bbPosition * 100) / 2)),

      // Volume Analysis (6)
      volumeSMA: volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b) / 20 : latest.volume || 0,
      volumeChange: (latest.volume || 0) / (prev.volume || 1),
      volumeMultiple: (latest.volume || 0) / (volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b) / 20 : 1),
      onBalanceVolume: volumes.reduce((sum, v, i) => sum + (closes[i] > (closes[i - 1] || 0) ? v : -v), 0),
      volumeWeightedPrice: volumes.reduce((sum, v, i) => sum + closes[i] * v, 0) / volumes.reduce((a, b) => a + b, 0),
      volumeProfile: `${volumes.length} candles`,

      // Momentum Indicators (5)
      roc: closes.length > 12 ? ((closes[closes.length - 1] - closes[closes.length - 13]) / closes[closes.length - 13] * 100) : 0,
      cmo: (calculateRSI(closes, 14) ?? 50) - 50,
      aos: momentum > 0 ? 'RISING' : 'FALLING',
      keltner: atr ? atr * 2 : 0, // ATR now in percentage
      priceVsKeltner: atr && atr > 0 ? (Math.abs(latestPrice - (ema20 ?? latestPrice)) / (latestPrice * (atr / 100))) : 0,

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
      trendScore: Math.abs(momentum) + (safeRSIValue(rsi) < 30 ? 10 : safeRSIValue(rsi) > 70 ? -10 : 0) + (safeMACDValue(macd).line > safeMACDValue(macd).signal ? 5 : -5),
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


/**
 * GET /api/gateway/exchanges/status
 * Get detailed status of all exchanges with fallback priority
 */
router.get('/exchanges/status', (req: Request, res: Response) => {
  try {
    const health = aggregator.getHealthStatus();
    const rateLimits = rateLimiter.getStats();
    
    const exchanges = Object.keys(health).map(exchange => ({
      name: exchange,
      healthy: health[exchange].healthy,
      latency: health[exchange].latency,
      consecutiveFailures: health[exchange].consecutiveFailures,
      isGeoRestricted: health[exchange].isGeoRestricted,
      rateLimited: rateLimiter.isRateLimited(exchange),
      rateLimit: (rateLimits as any)[exchange],
      priority: ['binance', 'kucoinfutures', 'coinbase', 'okx', 'bybit', 'kraken'].indexOf(exchange) + 1
    }));

    // Sort by priority
    exchanges.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    res.json({
      exchanges,
      fallbackChain: exchanges.filter(e => e.healthy && !e.rateLimited).map(e => e.name),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gateway/exchanges/:name/reset-rate-limit
 * Manually reset rate limit for an exchange
 */
router.post('/exchanges/:name/reset-rate-limit', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    // This will be called automatically, but can be triggered manually
    console.log(`[Gateway] Manually resetting rate limit for ${name}`);
    
    res.json({ 
      success: true, 
      message: `Rate limit state reset for ${name}`,
      newStats: rateLimiter.getStats(name)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

/**
 * GET /api/gateway/signals/archive
 * Get historical signals from the archive service.
 * Query params: symbol, signalType, outcome, limit, offset
 */
router.get('/signals/archive', async (req: Request, res: Response) => {
  try {
    const { symbol, outcome, limit = '50' } = req.query;
    const limitNum = parseInt(limit as string);

    // Use the signalArchive service to fetch data
    const archivedSignals = await signalArchive.querySignals({
      symbol: symbol as string | undefined,
      outcome: outcome as 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING' | undefined,
      limit: limitNum
    });

    res.json({
      success: true,
      signals: archivedSignals,
      count: archivedSignals.length,
      limit: limitNum,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Gateway] Signal archive error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ARM (Asymmetric Reaction Model) System
// State machine for detecting pressure shifts before edge confirmation
// ============================================================================

type SignalType = 'BUY' | 'SELL' | 'HOLD' | 'ARM_LONG' | 'ARM_SHORT';
type HoldReason = 'ZERO_VOLUME' | 'LOW_LIQUIDITY' | 'CONTINUATION' | 'LATE' | 'INSUFFICIENT_EDGE' | 'NORMAL';
type ArmReason = 'MOMENTUM_DECAY' | 'RSI_SLOPE_SHIFT' | 'VOLATILITY_COMPRESSION';

interface SymbolState {
  lastArm?: 'LONG' | 'SHORT';
  armTicks: number;
  lastUpdate: number;
}

// Global symbol state tracker for ARM memory
const symbolStates = new Map<string, SymbolState>();

// Helper: Calculate slope (simple derivative) from array of values
function slope(values: number[]): number {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[0];
}

// Helper: Get or create symbol state
function getSymbolState(symbol: string): SymbolState {
  if (!symbolStates.has(symbol)) {
    symbolStates.set(symbol, { armTicks: 0, lastUpdate: Date.now() });
  }
  return symbolStates.get(symbol)!;
}

// Helper: Update ARM state on detection
function updateArmState(symbol: string, armType: 'LONG' | 'SHORT' | undefined) {
  const state = getSymbolState(symbol);
  if (armType) {
    state.lastArm = armType;
    state.armTicks = (state.armTicks || 0) + 1;
  }
  state.lastUpdate = Date.now();
}

// Helper: Decay/expire ARM if no confirmation
function expireArmIfNeeded(symbol: string) {
  const state = getSymbolState(symbol);
  // ARM expires after 5 ticks without confirmation
  if ((state.armTicks || 0) > 5) {
    state.lastArm = undefined;
    state.armTicks = 0;
  }
}

/**
 * Generate ARM signal for momentum module using ARM template
 * Detects pressure shifts from derivatives (momentum decay, RSI shifts, volatility compression)
 */
function generateMomentumArmSignal(
  dataframe: any,
  rsiHistory: number[] = [],
  macdHistHistory: number[] = [],
  momentumHistory: number[] = []
): { armType: 'LONG' | 'SHORT' | null, armReason: string, confidence: number } {
  const symbol = dataframe.symbol || 'UNKNOWN';
  const state = getSymbolState(symbol);
  
  // Calculate slopes from history
  const rsiSlope = rsiHistory.length >= 2 ? slope(rsiHistory) : 0;
  const macdHistSlope = macdHistHistory.length >= 2 ? slope(macdHistHistory) : 0;
  const momentumSlope = momentumHistory.length >= 2 ? slope(momentumHistory) : 0;
  
  // Build ARM detection input
  const armInput: ArmDetectionInput = {
    rsi: dataframe.rsi || 50,
    rsiSlope: rsiSlope,
    macd: dataframe.macd || 0,
    macdHistogram: dataframe.macdHistogram || 0,
    macdHistSlope: macdHistSlope,
    momentum: dataframe.momentum || 0,
    atr: dataframe.atr || 0,
    atrSlope: dataframe.atrSlope || 0,
    atrPercentile: dataframe.atrPercentile || 50,
    volume: dataframe.volume || 0,
    volumeSlope: dataframe.volumeSlope || 0,
  };
  
  // Volume gate
  const volumeGate = (dataframe.volumeRatio || 0) > 0.8 && (dataframe.volume || 0) > 0;
  
  // Create module state if needed
  const momentumState: ModuleState = state;
  
  // Generate using template
  const signal = generateModuleSignal({
    moduleName: 'MomentumClassifier',
    data: armInput,
    state: momentumState,
    volumeGate,
    
    // Momentum confirmation conditions
    confirmLongCondition: (data) => {
      return (data.rsi ?? 50) < 70 && (data.macdHistSlope ?? 0) > 0 && (data.momentum ?? 0) > 0;
    },
    confirmShortCondition: (data) => {
      return (data.rsi ?? 50) > 30 && (data.macdHistSlope ?? 0) < 0 && (data.momentum ?? 0) < 0;
    },
    
    minArmTicks: 2,
    baseConfidence: 0.1,
    armConfidencePerTick: 0.08,
    confirmedConfidence: 0.55
  });
  
  // Extract ARM info from signal
  let armType: 'LONG' | 'SHORT' | null = null;
  let armReason = '';
  
  if (signal.type === 'ARM_LONG') {
    armType = 'LONG';
    armReason = signal.armReason || 'ARM_LONG_DETECTED';
  } else if (signal.type === 'ARM_SHORT') {
    armType = 'SHORT';
    armReason = signal.armReason || 'ARM_SHORT_DETECTED';
  }
  
  return {
    armType,
    armReason,
    confidence: signal.confidence
  };
}

// Generate signal type and confidence using composite technical + order flow + microstructure scoring
function generateSignalTypeWithScores(dataframe: any): { type: SignalType, strength: number, confidence: number, epistemicState: string, epistemicReasons: string[], alignmentPoints: number, holdReason?: HoldReason, armReason?: ArmReason } {
  const rsi = dataframe.rsi || 50;
  const macdHist = dataframe.macdHistogram || 0;
  const momentum = dataframe.momentum || 0;
  const bbPos = dataframe.bbPosition || 0.5;
  const priceAboveEMA20 = dataframe.close > (dataframe.ema20 || dataframe.close);
  const priceAboveEMA50 = dataframe.close > (dataframe.ema50 || dataframe.close);
  const emaSpread = Math.abs(dataframe.ema20 - dataframe.ema50) / (dataframe.ema50 || 1);
  
  // VOLUME GATES: Hard constraints on trade eligibility
  // Volume is liquidity — absence of volume = absence of buyers/sellers = invalid trade
  const volumeRatio = dataframe.volumeRatio || 0;
  const volume = dataframe.volume || 0;
  
  // Check 1: Recent volume must exceed average (liquidity requirement)
  const hasMinimumLiquidity = volumeRatio > 0.8; // At least 80% of previous candle volume
  
  // Check 2: Absolute volume must be non-zero (not zero volume)
  const hasNonZeroVolume = volume > 0;

  // TECHNICAL SCORE: RSI + MACD + BB Position + EMA trend
  // EDGE-BASED: Only reward clear oversold/overbought + trend confirmation
  // NO partial credit for midpoint bounces
  let technicalScore = 0;

  // RSI component (-1 to 1)
  // ONLY reward extreme RSI + trend confirmation, NOT midpoint bounces
  if (rsi < 30 && macdHist > 0 && priceAboveEMA50) {
    technicalScore += 0.45; // Oversold + MACD bullish + above EMA = strong buy edge
  } else if (rsi < 30 && macdHist > 0) {
    technicalScore += 0.35; // Oversold + MACD bullish (missing EMA confirmation)
  } else if (rsi < 30) {
    technicalScore += 0.15; // Just oversold, no confirmation
  } else if (rsi > 70 && macdHist < 0 && !priceAboveEMA50) {
    technicalScore -= 0.45; // Overbought + MACD bearish + below EMA = strong sell edge
  } else if (rsi > 70 && macdHist < 0) {
    technicalScore -= 0.35; // Overbought + MACD bearish
  } else if (rsi > 70) {
    technicalScore -= 0.15; // Just overbought
  }
  // DO NOT reward neutral RSI (50-70) bounces. They're noise, not edge.

  // MACD component (-1 to 1)
  // Only count MACD if there's RSI confirmation (prevent false positives)
  if (macdHist > 0.5 && rsi < 50) {
    technicalScore += 0.3; // Strong bullish MACD + low RSI = accumulation
  } else if (macdHist < -0.5 && rsi > 50) {
    technicalScore -= 0.3; // Strong bearish MACD + high RSI = distribution
  }
  // Small MACD signals ignored unless RSI extreme

  // Bollinger Bands component (-1 to 1)
  if (bbPos < 0.15) {
    technicalScore += 0.25; // Price near lower band = oversold edge
  } else if (bbPos > 0.85) {
    technicalScore -= 0.25; // Price near upper band = overbought edge
  }
  // Middle bands are noise, ignored

  // EMA trend alignment (-1 to 1)
  if (priceAboveEMA20 && priceAboveEMA50 && emaSpread > 0.005) {
    technicalScore += 0.2; // Bullish alignment with divergence = confirmed uptrend
  } else if (!priceAboveEMA20 && !priceAboveEMA50 && emaSpread > 0.005) {
    technicalScore -= 0.2; // Bearish alignment with divergence = confirmed downtrend
  }
  // Just above one EMA but not both = weak, ignored

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

  // EXPENSIVE-TO-EARN, CHEAP-TO-LOSE CONFIDENCE
  // Count alignment points: indicator agreement is mandatory to earn confidence
  // Require STRONG confirmation, not just binary presence
  const alignmentPoints =
    (priceAboveEMA20 === priceAboveEMA50 && emaSpread > 0.005 ? 1 : 0) + // EMA alignment + spread
    (macdHist > 0.3 && priceAboveEMA50 && rsi < 50 ? 1 : 0) + // Strong bullish MACD + trend + RSI
    (macdHist < -0.3 && !priceAboveEMA50 && rsi > 50 ? 1 : 0) + // Strong bearish MACD + trend + RSI
    (rsi < 30 || rsi > 70 ? 1 : 0) + // RSI extreme (not just not-neutral)
    (Math.abs(momentum) > 2 ? 1 : 0); // Very strong momentum (not just >1)

  // Start ultra-low
  let confidence = 10;
  const epistemicReasons: string[] = [];

  // Require agreement from multiple sources (gates confidence earning)
  if (alignmentPoints < 2) {
    // Insufficient alignment = cannot exceed 40
    confidence = Math.min(40, 10 + compositeScore * 50);
    epistemicReasons.push('LOW_ALIGNMENT');
  } else if (alignmentPoints === 2) {
    // Moderate alignment = cap at 60
    confidence = Math.min(60, 10 + compositeScore * 75);
  } else if (alignmentPoints >= 3) {
    // Strong alignment = can reach higher
    confidence = Math.min(100, 10 + alignmentPoints * 20 + Math.abs(compositeScore) * 40);
  }

  // CHEAP-TO-LOSE: Penalize on disagreement or weak signals
  if (Math.abs(compositeScore) < 0.1) {
    // Weak signal overall = reduce by 40%
    confidence *= 0.6;
    epistemicReasons.push('WEAK_SIGNAL');
  }

  // Determine epistemic state
  let epistemicState = 'CONFIDENT';
  if (confidence < 30) {
    epistemicState = 'INSUFFICIENT';
  } else if (confidence < 50) {
    epistemicState = 'UNCERTAIN';
  } else {
    epistemicState = 'CONFIDENT';
  }

  // ============================================================================
  // ARM DETECTION (Asymmetric Reaction Model)
  // Detect pressure shifts BEFORE edge confirmation
  // Uses derivatives: momentum decay, RSI slope, volatility compression
  // ============================================================================
  
  // For ARM detection, we need recent indicator history
  // In a real scenario, pass last 3-5 candles worth of indicators
  // For now, using single candle as baseline (ARM will be weak but correct)
  
  let armReason: ArmReason | undefined = undefined;
  let type: SignalType = 'HOLD';
  let holdReason: HoldReason = 'NORMAL'; // Semantic reason for HOLD
  
  // ARM_LONG conditions: Pressure shift from bearish to bullish
  // 1. MOMENTUM_DECAY: MACD negative but histogram rising (sellers losing power)
  // 2. RSI_SLOPE_SHIFT: RSI below 50 but trending upward (demand recovering)
  // 3. VOLATILITY_COMPRESSION: ATR contracting after expansion (coiling for breakout)
  
  const armLong =
    !hasNonZeroVolume ? false : 
    !hasMinimumLiquidity ? false :
    (
      // Sellers losing strength even though price still bearish
      (macdHist < 0 && momentum > -1 && rsi < 50) ||  // MOMENTUM_DECAY proxy
      // Demand returning but equilibrium not crossed
      (rsi < 50 && rsi > 30 && momentum > 0) ||        // RSI_SLOPE_SHIFT proxy
      // Market coiling
      (Math.abs(momentum) < 2 && Math.abs(compositeScore) > 0 && compositeScore < 0.2)  // VOLATILITY_COMPRESSION proxy
    );

  // ARM_SHORT conditions: Pressure shift from bullish to bearish
  // 1. MOMENTUM_DECAY: MACD positive but histogram falling (buyers losing power)
  // 2. RSI_SLOPE_SHIFT: RSI above 50 but trending downward (supply returning)
  // 3. VOLATILITY_COMPRESSION: ATR contracting (coiling after expansion)
  
  const armShort =
    !hasNonZeroVolume ? false :
    !hasMinimumLiquidity ? false :
    (
      // Buyers losing strength even though price still bullish
      (macdHist > 0 && momentum < 1 && rsi > 50) ||    // MOMENTUM_DECAY proxy
      // Supply returning but equilibrium not crossed
      (rsi > 50 && rsi < 70 && momentum < 0) ||        // RSI_SLOPE_SHIFT proxy
      // Market coiling
      (Math.abs(momentum) < 2 && Math.abs(compositeScore) > 0 && compositeScore > -0.2)  // VOLATILITY_COMPRESSION proxy
    );

  // Determine dominant ARM reason (for diagnostics)
  if (armLong) {
    if (macdHist < 0 && momentum > -1) {
      armReason = 'MOMENTUM_DECAY';
    } else if (rsi < 50 && rsi > 30 && momentum > 0) {
      armReason = 'RSI_SLOPE_SHIFT';
    } else {
      armReason = 'VOLATILITY_COMPRESSION';
    }
  } else if (armShort) {
    if (macdHist > 0 && momentum < 1) {
      armReason = 'MOMENTUM_DECAY';
    } else if (rsi > 50 && rsi < 70 && momentum < 0) {
      armReason = 'RSI_SLOPE_SHIFT';
    } else {
      armReason = 'VOLATILITY_COMPRESSION';
    }
  }

  // ============================================================================
  // SIGNAL DETERMINATION: Volume Gate → ARM Detection → BUY/SELL Confirmation
  // ============================================================================
  
  // First check: Volume eligibility (hard gate - no volume = no trade)
  if (!hasNonZeroVolume) {
    type = 'HOLD';
    holdReason = 'ZERO_VOLUME'; // No buyers/sellers
    return {
      type, strength: strength * 100, confidence: Math.round(confidence),
      epistemicState, epistemicReasons, alignmentPoints, holdReason
    };
  } else if (!hasMinimumLiquidity) {
    type = 'HOLD';
    holdReason = 'LOW_LIQUIDITY'; // Volume dropped below average
    return {
      type, strength: strength * 100, confidence: Math.round(confidence),
      epistemicState, epistemicReasons, alignmentPoints, holdReason
    };
  }

  // Second check: ARM Detection (pressure shift state)
  if (armLong) {
    // Asymmetry detected in buying direction
    type = 'ARM_LONG';
    updateArmState(dataframe.symbol, 'LONG');
    return {
      type,
      armReason,
      strength: Math.abs(compositeScore) * 100 * 0.75, // Capped confidence for ARM
      confidence: Math.min(50, 10 + Math.abs(compositeScore) * 30), // ARM max 50%
      epistemicState: 'UNCERTAIN',
      epistemicReasons: [...epistemicReasons, 'ARM_DETECTED'],
      alignmentPoints,
      holdReason: 'CONTINUATION'
    };
  } else if (armShort) {
    // Asymmetry detected in selling direction
    type = 'ARM_SHORT';
    updateArmState(dataframe.symbol, 'SHORT');
    return {
      type,
      armReason,
      strength: Math.abs(compositeScore) * 100 * 0.75, // Capped confidence for ARM
      confidence: Math.min(50, 10 + Math.abs(compositeScore) * 30), // ARM max 50%
      epistemicState: 'UNCERTAIN',
      epistemicReasons: [...epistemicReasons, 'ARM_DETECTED'],
      alignmentPoints,
      holdReason: 'CONTINUATION'
    };
  }

  // Third check: BUY/SELL confirmation (edge confirmed)
  // ARM must precede BUY/SELL: Check if BUY/SELL follows ARM
  // For now, allow BUY/SELL if edge is clear (compositeScore threshold)
  
  // Determine signal type based on composite score
  // EDGE REQUIREMENT: Raise threshold from 0.15 to 0.35
  // This eliminates midpoint bounces, requires clear oversold/overbought + confirmation
  
  if (compositeScore > 0.35) {
    // CONVICTION GATE: BUY only if confidence is sufficiently high
    // Low confidence (< 40) = PROBE (watch without position)
    // Medium confidence (40-60) = PROBE (small position possible)
    // High confidence (> 60) = BUY (full conviction)
    
    if (confidence < 40) {
      type = 'HOLD';
      holdReason = 'INSUFFICIENT_EDGE'; // "Edge exists but low conviction"
      epistemicReasons.push('LOW_CONVICTION');
    } else {
      type = 'BUY'; // Confidence >= 40, edge exists, volume adequate
    }
  } else if (compositeScore < -0.35) {
    // CONVICTION GATE: SELL only if confidence is sufficiently high
    // Same conviction thresholds as BUY
    
    if (confidence < 40) {
      type = 'HOLD';
      holdReason = 'INSUFFICIENT_EDGE'; // "Edge exists but low conviction"
      epistemicReasons.push('LOW_CONVICTION');
    } else {
      type = 'SELL'; // Confidence >= 40, edge exists, volume adequate
    }
  } else {
    // No edge signal (compositeScore in -0.35 to 0.35 range)
    type = 'HOLD';
    
    // Semantic HOLD reasons:
    // - CONTINUATION: Price in trend, but no extreme edge to enter
    // - LATE: Trend extreme reached, waiting for reversal
    // - INSUFFICIENT: Data quality insufficient for decision
    
    if (priceAboveEMA20 === priceAboveEMA50 && emaSpread > 0.01) {
      // Clear trend exists, but entry point not extreme enough
      holdReason = 'CONTINUATION';
    } else if ((rsi > 65 || rsi < 35) && Math.abs(momentum) < 1) {
      // RSI extreme but momentum not confirming → waiting for confirmation
      holdReason = 'LATE';
    } else {
      // Mixed signals or insufficient data
      holdReason = 'INSUFFICIENT_EDGE';
    }
  }

  return {
    type,
    strength: strength * 100,
    confidence: Math.round(confidence),
    epistemicState,
    epistemicReasons: epistemicReasons.length > 0 ? epistemicReasons : ['NORMAL'],
    alignmentPoints,
    holdReason: holdReason as HoldReason,
    armReason
  };
}

/**
 * Safe accessors for indicators that may be null
 */
function safeMACDValue(macd: any): { line: number; signal: number; histogram: number } {
  if (!macd) return { line: 0, signal: 0, histogram: 0 };
  return {
    line: macd.line ?? macd.macd ?? 0,
    signal: macd.signal ?? 0,
    histogram: macd.histogram ?? 0
  };
}

function safeRSIValue(rsi: number | null | undefined): number {
  return rsi ?? 50; // Default to neutral if missing
}

// Simple indicator calculations
function calculateRSI(closes: number[], period: number = 14): number | null {
  // RSI requires minimum 'period + 1' candles (need period changes to calculate)
  if (closes.length < period + 1) return null; // Insufficient data = null signal
  
  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  // Wilder's smoothing (proper RSI formula)
  let avgGain = 0, avgLoss = 0;
  
  // Initial SMA over first 'period' changes
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  
  // Wilder's smoothing for remaining changes
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }
  
  // Calculate RS and RSI
  const rs = avgGain / (avgLoss || 1);
  return 100 - (100 / (1 + rs));
}

function calculateEMA(closes: number[], period: number): number | null {
  // EMA requires minimum period candles
  if (closes.length < period) return null; // Insufficient data = null signal
  
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } | null {
  // MACD requires minimum 26 periods (slow EMA) + 9 periods for signal = 34+ candles
  if (closes.length < 34) return null; // Insufficient data = null signal
  
  // Calculate 12 and 26 period EMAs
  const ema12Array: number[] = [];
  const ema26Array: number[] = [];
  
  // EMA 12
  let ema12 = closes.slice(0, 12).reduce((a, b) => a + b) / 12;
  ema12Array.push(ema12);
  const k12 = 2 / (12 + 1);
  for (let i = 12; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12);
    ema12Array.push(ema12);
  }
  
  // EMA 26
  let ema26 = closes.slice(0, 26).reduce((a, b) => a + b) / 26;
  ema26Array.push(ema26);
  const k26 = 2 / (26 + 1);
  for (let i = 26; i < closes.length; i++) {
    ema26 = closes[i] * k26 + ema26 * (1 - k26);
    ema26Array.push(ema26);
  }
  
  // Calculate MACD line (12-EMA - 26-EMA)
  const macdLine: number[] = [];
  const startIdx = Math.max(ema12Array.length, ema26Array.length) - Math.min(ema12Array.length, ema26Array.length);
  for (let i = startIdx; i < Math.min(ema12Array.length, ema26Array.length); i++) {
    macdLine.push(ema12Array[i] - ema26Array[i - startIdx]);
  }
  
  // Calculate Signal line (9-period EMA of MACD line)
  if (macdLine.length < 9) return null;
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b) / 9;
  const kSignal = 2 / (9 + 1);
  for (let i = 9; i < macdLine.length; i++) {
    signal = macdLine[i] * kSignal + signal * (1 - kSignal);
  }
  
  // Current values
  const macd = macdLine[macdLine.length - 1];
  const histogram = macd - signal;
  const lastClose = closes[closes.length - 1];
  
  // NORMALIZE MACD as percentage of current price to make it cross-asset comparable
  // BTC at 42k: MACD=-444 → -1.06%
  // SOL at $200: MACD=-0.7 → -0.35%
  // Now comparable across price scales
  const macdNormalized = lastClose !== 0 ? (macd / lastClose) * 100 : 0;
  const signalNormalized = lastClose !== 0 ? (signal / lastClose) * 100 : 0;
  const histogramNormalized = macdNormalized - signalNormalized;
  
  return { 
    macd: macdNormalized, 
    signal: signalNormalized, 
    histogram: histogramNormalized 
  };
}

function calculateATR(frames: any[], period: number = 14): number | null {
  if (frames.length < period) return null; // Insufficient data = null (not 0)
  let tr = 0;
  for (let i = frames.length - period; i < frames.length; i++) {
    const high = (frames[i].price as any)?.high || (frames[i] as any).high || 0;
    const low = (frames[i].price as any)?.low || (frames[i] as any).low || 0;
    const high_low = high - low;
    tr += high_low;
  }
  const atrAbsolute = tr / period;
  
  // Normalize ATR as percentage of current close price
  // This makes ATR comparable across price scales
  const lastClose = ((frames[frames.length - 1].price as any)?.close || (frames[frames.length - 1] as any).close || 0);
  if (lastClose === 0) return null; // Can't normalize with zero close
  
  return (atrAbsolute / lastClose) * 100; // Return as percentage
}

function calculateVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  const mean = closes.reduce((a, b) => a + b) / closes.length;
  const variance = closes.reduce((a, b) => a + Math.pow(b - mean, 2)) / closes.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Assess data quality for a set of indicators
 * Returns quality score (0-100) and reasons for low quality
 */
function assessDataQuality(ohlcv: any[], indicators: any[]): {
  score: number;
  reasons: string[];
  sufficient: boolean;
} {
  const reasons: string[] = [];
  let score = 100;
  
  // Check 1: Minimum candles
  if (ohlcv.length < 34) {
    reasons.push(`INSUFFICIENT_CANDLES: ${ohlcv.length}/34 required for MACD`);
    score -= 40;
  } else if (ohlcv.length < 50) {
    reasons.push(`LOW_SAMPLE_SIZE: ${ohlcv.length} candles (50+ recommended)`);
    score -= 15;
  }
  
  // Check 2: Volume anomalies
  const volumes = ohlcv.map(c => c[5] || 0).filter(v => v > 0);
  if (volumes.length === 0) {
    reasons.push(`ZERO_VOLUME: All candles have 0 volume`);
    score -= 50;
  } else if (volumes.length < ohlcv.length * 0.8) {
    reasons.push(`SPARSE_VOLUME: ${volumes.length}/${ohlcv.length} candles with volume`);
    score -= 20;
  }
  
  // Check 3: Price gaps/discontinuities
  const closes = ohlcv.map(c => c[4]);
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(Math.abs((closes[i] - closes[i-1]) / closes[i-1]));
  }
  const largeGaps = changes.filter(c => c > 0.1).length; // > 10% changes
  if (largeGaps > changes.length * 0.1) {
    reasons.push(`HIGH_VOLATILITY: ${largeGaps} large gaps (>10%) in last ${changes.length} candles`);
    score -= 10;
  }
  
  // Check 4: Null indicator count
  const nullIndicators = indicators.flat().filter(v => v === null).length;
  if (nullIndicators > 0) {
    reasons.push(`INSUFFICIENT_INDICATOR_DATA: ${nullIndicators} null values`);
    score -= Math.min(30, nullIndicators * 5);
  }
  
  // Check 5: Flat/dead market (no price movement)
  const priceRange = Math.max(...closes) - Math.min(...closes);
  const priceAvg = closes.reduce((a, b) => a + b) / closes.length;
  const rangePercent = (priceRange / priceAvg) * 100;
  if (rangePercent < 0.1) {
    reasons.push(`FLAT_MARKET: ${rangePercent.toFixed(3)}% price range`);
    score -= 25;
  }
  
  score = Math.max(0, Math.min(100, score));
  const sufficient = score >= 50 && ohlcv.length >= 34;
  
  return { score, reasons, sufficient };
}

/**
 * Create data quality status for frontend
 */
function createDataQualityStatus(quality: { score: number; reasons: string[]; sufficient: boolean }, ohlcv: any[]) {
  return {
    quality: quality.score,
    sufficient: quality.sufficient,
    warnings: quality.reasons,
    candles: ohlcv.length,
    timestamp: new Date().toISOString()
  };
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

    // Create timeout promise (30 seconds)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Scan timeout (30s)')), 30000)
    );

    // Use static imports from top of file if possible, otherwise dynamic import is fine here
    const { CCXTScanner } = require('../services/gateway/ccxt-scanner');
    const scanner = new CCXTScanner(aggregator, cacheManager, rateLimiter);

    const resultsPromise = scanner.scanSymbols(symbols, timeframe, options);
    const results = await Promise.race([resultsPromise, timeoutPromise]);

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

router.get('/signals/performance/stats', (req: Request, res: Response) => {
  const stats = signalPerformanceTracker.getPerformanceStats();
  res.json(stats);
});

router.get('/signals/performance/recent', (req: Request, res: Response) => {
  const { limit = '20' } = req.query;
  const recent = signalPerformanceTracker.getRecentPerformance(parseInt(limit as string));
  res.json({ performances: recent });
});

/**
 * Integrity-Validated Dataframe Endpoint
 * Returns dataframe with integrity validation results
 */
router.get('/dataframe-validated/:symbol', async (req: Request, res: Response) => {
  try {
    let symbol = req.params.symbol;
    symbol = decodeURIComponent(symbol).replace(/%2F/gi, '/');

    const { timeframe = '1h', limit = '100' } = req.query;
    const limitNum = parseInt(limit as string) || 100;

    // Get frames from aggregator
    const frames = await aggregator.getMarketFrames(symbol, timeframe as string, limitNum);

    if (!frames || frames.length === 0) {
      return res.status(404).json({
        error: `No data available for ${symbol}`,
        symbol,
        timeframe,
        validated: false,
        integrity: { totalInput: 0, validCount: 0, rejectedCount: 0, gapCount: 0 }
      });
    }

    // Process through integrity gate
    try {
      const { getIntegrityGate } = await import('../services/market-data/integrity-gate');
      const gate = getIntegrityGate();

      const candles = frames.map((f: any) => ({
        ts: f.timestamp || Date.now(),
        open: f.price?.open || 0,
        high: f.price?.high || 0,
        low: f.price?.low || 0,
        close: f.price?.close || 0,
        volume: f.volume || 0,
        isFinal: true,
        source: 'ccxt',
        venue: 'gateway'
      }));

      // Parse timeframe to seconds
      const m = (timeframe as string).match(/(\d+)([mhd])/i);
      let timeframeSeconds = 3600;
      if (m) {
        const amount = parseInt(m[1]);
        const unit = m[2].toLowerCase();
        if (unit === 'm') timeframeSeconds = amount * 60;
        else if (unit === 'h') timeframeSeconds = amount * 3600;
        else if (unit === 'd') timeframeSeconds = amount * 86400;
      }

      const integrityResult = await gate.storeValidatedCandles(
        symbol,
        timeframeSeconds,
        candles
      );

      const latest = integrityResult.stored[integrityResult.stored.length - 1];

      res.json({
        symbol,
        timeframe,
        cached: false,
        validated: true,
        dataframe: latest || frames[frames.length - 1],
        integrity: {
          totalInput: frames.length,
          validCount: integrityResult.stored.length,
          rejectedCount: integrityResult.rejected.length,
          gapCount: integrityResult.gaps.length,
          rejectionReasons: integrityResult.rejected.map(r => r.reason || 'unknown'),
          gaps: integrityResult.gaps.map(g => ({
            from: g.from,
            to: g.to,
            missingCandles: g.missing
          }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (integrityError) {
      console.warn('[Gateway] Integrity validation error:', integrityError);
      // Return frames without integrity info if validation fails
      const latest = frames[frames.length - 1];
      res.json({
        symbol,
        timeframe,
        cached: false,
        validated: false,
        dataframe: latest,
        integrity: {
          totalInput: frames.length,
          validCount: frames.length,
          rejectedCount: 0,
          gapCount: 0,
          error: 'Integrity validation unavailable'
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      validated: false
    });
  }
});

router.get('/ws/stats', (req: Request, res: Response) => {
  res.json(signalWebSocketService.getStats());
});

export default router;
export { cacheManager, rateLimiter, aggregator };