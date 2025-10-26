import type { Express, Request, Response } from "express";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// Optional imports - only use if modules exist
let MirrorOptimizer: any, ScannerAgent: any, MLAgent: any;
let calculate_volume_profile: any, calculate_anchored_volume_profile: any, calculate_fixed_range_volume_profile: any;
let calculate_composite_score: any, calculate_volume_composite_score: any, calculate_confidence_score: any;
let calculate_value_area: any, calculate_poc: any;
let runBacktest: any, ExchangeDataFeed: any, SignalEngine: any, defaultTradingConfig: any;
let MLSignalEnhancer: any, EnhancedMultiTimeframeAnalyzer: any;
let registerChartApi: any, registerAdvancedIndicatorApi: any;

try {
  const bayesianModule = await import('./bayesian-optimizer').catch(() => null);
  if (bayesianModule) {
    ({ MirrorOptimizer, ScannerAgent, MLAgent } = bayesianModule);
  }

  const analyticsModule = await import('./analytics-utils').catch(() => null);
  if (analyticsModule) {
    ({
      calculate_volume_profile, calculate_anchored_volume_profile, calculate_fixed_range_volume_profile,
      calculate_composite_score, calculate_volume_composite_score, calculate_confidence_score,
      calculate_value_area, calculate_poc
    } = analyticsModule);
  }

  const backtestModule = await import('./backtest-runner').catch(() => null);
  if (backtestModule) {
    ({ runBacktest } = backtestModule);
  }

  const tradingModule = await import('./trading-engine').catch(() => null);
  if (tradingModule) {
    ({ ExchangeDataFeed, SignalEngine, defaultTradingConfig } = tradingModule);
  }

  const mlModule = await import('./ml-engine').catch(() => null);
  if (mlModule) {
    ({ MLSignalEnhancer } = mlModule);
  }

  const multiTimeframeModule = await import('./multi-timeframe').catch(() => null);
  if (multiTimeframeModule) {
    ({ EnhancedMultiTimeframeAnalyzer } = multiTimeframeModule);
  }

  const chartModule = await import('./chart-api').catch(() => null);
  if (chartModule) {
    ({ registerChartApi } = chartModule);
  }

  const advancedIndicatorModule = await import('./advanced-indicator-api').catch(() => null);
  if (advancedIndicatorModule) {
    ({ registerAdvancedIndicatorApi } = advancedIndicatorModule);
  }
} catch (error) {
  console.warn('Some optional modules could not be loaded:', error);
}

// Import CoinGecko chart router
let coinGeckoChartRouter: any;
try {
  const coinGeckoModule = await import('./routes/coingecko-charts').catch(() => null);
  if (coinGeckoModule) {
    coinGeckoChartRouter = coinGeckoModule.default;
  }
} catch (error) {
  console.warn('CoinGecko chart router could not be loaded:', error);
}

  // For hot-reload DX, use tsx --watch or nodemon --exec node -r esbuild-register
  // npm i cors helmet express-rate-limit
  export async function registerRoutes(app: Express): Promise<Server> {
    // Trust proxy for proper IP detection behind reverse proxy (MUST be set before rate limiting)
    app.set('trust proxy', true);

    // Security & CORS middleware
    app.use(cors());
    app.use(helmet());
    app.use(rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per windowMs
    }));

    // --- Advanced Volume Profile & Composite Analytics API ---
  console.log('Registering POST /api/analytics/volume-profile');



  // Zod schemas for analytics endpoints
  const volumeProfileSchema = z.object({
    prices: z.array(z.number()),
    volumes: z.array(z.number()),
    bins: z.number()
  });

  app.post('/api/analytics/volume-profile', (req: Request, res: Response) => {
    try {
      if (!calculate_volume_profile) {
        return res.status(501).json({ error: 'Analytics module not available' });
      }
      const result = volumeProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { prices, volumes, bins } = result.data;
      const profile = calculate_volume_profile(prices, volumes, bins);
      res.json({ profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/anchored-volume-profile');


  const anchoredVolumeProfileSchema = z.object({
    prices: z.array(z.number()),
    volumes: z.array(z.number()),
    anchorIndex: z.number(),
    bins: z.number()
  });

  app.post('/api/analytics/anchored-volume-profile', (req: Request, res: Response) => {
    try {
      const result = anchoredVolumeProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { prices, volumes, anchorIndex, bins } = result.data;
      const profile = calculate_anchored_volume_profile(prices, volumes, anchorIndex, bins);
      res.json({ profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/fixed-range-volume-profile');


  const fixedRangeVolumeProfileSchema = z.object({
    prices: z.array(z.number()),
    volumes: z.array(z.number()),
    minPrice: z.number(),
    maxPrice: z.number(),
    bins: z.number()
  });

  app.post('/api/analytics/fixed-range-volume-profile', (req: Request, res: Response) => {
    try {
      const result = fixedRangeVolumeProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { prices, volumes, minPrice, maxPrice, bins } = result.data;
      const profile = calculate_fixed_range_volume_profile(prices, volumes, minPrice, maxPrice, bins);
      res.json({ profile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/composite-score');


  const compositeScoreSchema = z.object({
    scores: z.array(z.number()),
    weights: z.array(z.number())
  });

  app.post('/api/analytics/composite-score', (req: Request, res: Response) => {
    try {
      const result = compositeScoreSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { scores, weights } = result.data;
      const score = calculate_composite_score(scores, weights);
      res.json({ score });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/volume-composite-score');


  const volumeCompositeScoreSchema = z.object({
    volumeScores: z.array(z.number()),
    weights: z.array(z.number())
  });

  app.post('/api/analytics/volume-composite-score', (req: Request, res: Response) => {
    try {
      const result = volumeCompositeScoreSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { volumeScores, weights } = result.data;
      const score = calculate_volume_composite_score(volumeScores, weights);
      res.json({ score });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/confidence-score');


  const confidenceScoreSchema = z.object({
    volumeConfirmation: z.number(),
    volatility: z.number(),
    microHealth: z.number(),
    weights: z.array(z.number())
  });

  app.post('/api/analytics/confidence-score', (req: Request, res: Response) => {
    try {
      const result = confidenceScoreSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { volumeConfirmation, volatility, microHealth, weights } = result.data;
      const score = calculate_confidence_score(volumeConfirmation, volatility, microHealth, weights);
      res.json({ score });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/value-area');


  const valueAreaSchema = z.object({
    profile: z.array(z.object({
      price: z.number(),
      volume: z.number()
    })),
    valueAreaPercent: z.number()
  });

  app.post('/api/analytics/value-area', (req: Request, res: Response) => {
    try {
      const result = valueAreaSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { profile, valueAreaPercent } = result.data;
      const area = calculate_value_area(profile, valueAreaPercent);
      res.json(area);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Registering POST /api/analytics/poc');


  const pocSchema = z.object({
    profile: z.array(z.object({
      price: z.number(),
      volume: z.number()
    }))
  });

  app.post('/api/analytics/poc', (req: Request, res: Response) => {
    try {
      const result = pocSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: 'Invalid payload', details: result.error.issues });
      }
      const { profile } = result.data;
      const poc = calculate_poc(profile);
      res.json({ poc });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  // --- End Advanced Volume Profile & Composite Analytics API ---
  // List all assets and their latest performance/metrics
app.get('/api/assets/performance', async (req: Request, res: Response) => {
  const db = new PrismaClient();
  try {
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    // Query params
    const {
      symbol,
      minPrice,
      maxPrice,
      minVolume,
      maxVolume,
      sortBy = 'symbol',
      sortOrder = 'asc',
      limit = 100
    } = req.query;

    // Get all distinct symbols
    let symbols: { symbol: string }[] = await db.marketFrame.findMany({
      distinct: ['symbol'],
      select: { symbol: true },
    });
    if (symbol) {
      const symbolArr = Array.isArray(symbol) ? symbol : [symbol];
      symbols = symbols.filter(s => symbolArr.includes(s.symbol));
    }
    // For each symbol, get the latest and previous market frame for metrics
    let results = (await Promise.all(symbols.map(async (row: { symbol: string }) => {
      const latest = await db.marketFrame.findFirst({
        where: { symbol: row.symbol },
        orderBy: { timestamp: 'desc' },
      });
      if (!latest) return null;
      // Previous close for percent change
      const prev = await db.marketFrame.findFirst({
        where: { symbol: row.symbol, NOT: { timestamp: latest.timestamp } },
        orderBy: { timestamp: 'desc' },
      });
      const close = latest.price?.close ?? 0;
      const prevClose = prev?.price?.close ?? close;
      const percentChange = prevClose !== 0 ? ((close - prevClose) / prevClose) * 100 : 0;
      // Volatility: stddev of close over last 10 frames
      const last10 = await db.marketFrame.findMany({
        where: { symbol: row.symbol },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
      const closes = last10.map((f: any) => f.price?.close ?? 0);
      const mean = closes.reduce((a: number, b: number) => a + b, 0) / (closes.length || 1);
      const variance = closes.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / (closes.length || 1);
      const volatility = Math.sqrt(variance);
      // Momentum: close - close n frames ago
      const momentum = closes.length >= 2 ? closes[0] - closes[closes.length - 1] : 0;
      // 7d and 30d momentum (if available)
      const last7 = await db.marketFrame.findMany({
        where: { symbol: row.symbol },
        orderBy: { timestamp: 'desc' },
        take: 7
      });
      const last30 = await db.marketFrame.findMany({
        where: { symbol: row.symbol },
        orderBy: { timestamp: 'desc' },
        take: 30
      });
      const mom7d = last7.length >= 2 ? (last7[0].price?.close ?? 0) - (last7[last7.length - 1].price?.close ?? 0) : 0;
      const mom30d = last30.length >= 2 ? (last30[0].price?.close ?? 0) - (last30[last30.length - 1].price?.close ?? 0) : 0;
      // Change (absolute)
      const change = close - prevClose;
      return {
        ...latest,
        percentChange,
        volatility,
        momentum,
        change,
        mom7d,
        mom30d
      };
    }))).filter(Boolean);
    // Filtering
    if (minPrice) results = results.filter((a: any) => a.price?.close >= Number(minPrice));
    if (maxPrice) results = results.filter((a: any) => a.price?.close <= Number(maxPrice));
    if (minVolume) results = results.filter((a: any) => a.volume >= Number(minVolume));
    if (maxVolume) results = results.filter((a: any) => a.volume <= Number(maxVolume));
    // Sorting
    results.sort((a: any, b: any) => {
      let vA = a[sortBy as string];
      let vB = b[sortBy as string];
      // Support nested fields
      if (typeof sortBy === 'string' && sortBy.includes('.')) {
        const [outer, inner] = (sortBy as string).split('.');
        vA = a[outer]?.[inner];
        vB = b[outer]?.[inner];
      }
      if (typeof vA === 'string') return sortOrder === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      return sortOrder === 'asc' ? vA - vB : vB - vA;
    });
    // Limit
    results = results.slice(0, Number(limit));
    res.json({ assets: results });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  } finally {
    await db.$disconnect();
  }
});



  // Register chart and advanced indicator APIs (conditionally)
  if (registerChartApi) {
    try {
      registerChartApi(app);
    } catch (error) {
      console.warn('Chart API could not be registered:', error);
    }
  }
  if (registerAdvancedIndicatorApi) {
    try {
      registerAdvancedIndicatorApi(app);
    } catch (error) {
      console.warn('Advanced Indicator API could not be registered:', error);
    }
  }

  // Register CoinGecko chart API
  if (coinGeckoChartRouter) {
    try {
      app.use(coinGeckoChartRouter);
      console.log('[INIT] CoinGecko chart API registered');
    } catch (error) {
      console.warn('CoinGecko chart API could not be registered:', error);
    }
  }

    // Initialize engines (conditionally)
    let exchangeDataFeed: any = null;
    let signalEngine: any = null;
    let mlEnhancer: any = null;
    let multiTimeframeAnalyzer: any = null;
    let optimizer: any = null;

    try {
      if (ExchangeDataFeed) {
        console.log('[INIT] Creating ExchangeDataFeed...');
        exchangeDataFeed = await ExchangeDataFeed.create();
        console.log('[INIT] ExchangeDataFeed created successfully');

        // Log available exchanges
        if (exchangeDataFeed && exchangeDataFeed.exchanges) {
          const exchangeIds = Array.from(exchangeDataFeed.exchanges.keys());
          console.log('[INIT] Available exchanges in ExchangeDataFeed:', exchangeIds);
          console.log('[INIT] KuCoin Futures available:', exchangeDataFeed.exchanges.has('kucoinfutures') ? '✅ YES' : '❌ NO');
        }
      } else {
        console.warn('[INIT] ExchangeDataFeed class not available');
      }

      if (SignalEngine && defaultTradingConfig) {
        signalEngine = new SignalEngine(defaultTradingConfig);
      }
      if (MLSignalEnhancer) {
        mlEnhancer = new MLSignalEnhancer();
      }
      if (EnhancedMultiTimeframeAnalyzer && signalEngine) {
        multiTimeframeAnalyzer = new EnhancedMultiTimeframeAnalyzer(signalEngine);
      }
      if (MirrorOptimizer) {
        optimizer = new MirrorOptimizer();
        if (ScannerAgent) {
          optimizer.registerAgent('scanner', await ScannerAgent.create());
        }
        if (MLAgent) {
          optimizer.registerAgent('ml', new MLAgent());
        }
      }
    } catch (error) {
      console.error('❌ Error initializing trading engines:', error);
      console.warn('Some trading engines could not be initialized:', error);
    }

    // Signal Strength Calculation API
  console.log('Registering POST /api/signal-strength');

  app.post("/api/signal-strength", async (req: Request, res: Response) => {
    try {
      const { momentumShort, momentumLong, rsi, macd, volumeRatio } = req.body;
      if (
        typeof momentumShort !== 'number' ||
        typeof momentumLong !== 'number' ||
        typeof rsi !== 'number' ||
        typeof macd !== 'number'
      ) {
        return res.status(400).json({ error: "All fields (momentumShort, momentumLong, rsi, macd) are required and must be numbers." });
      }

      try {
        const { calculateSignalStrength } = await import('./lib/signal-strength');
        const score = calculateSignalStrength(momentumShort, momentumLong, rsi, macd, volumeRatio ?? 1.0);
        res.json({ score });
      } catch (importError) {
        // Fallback calculation if signal-strength module is not available
        const score = (momentumShort + momentumLong + (rsi - 50) / 50 + macd) / 4 * (volumeRatio ?? 1.0);
        res.json({ score: Math.max(-1, Math.min(1, score)) });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


    // API endpoints that frontend expects
  app.get('/api/signals/latest', async (req: Request, res: Response) => {
    try {
      const signals = await storage.getLatestSignals(10);
      res.json(signals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/trades', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const trades = await storage.getTrades(status as string);
      res.json(trades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/market-sentiment', async (req: Request, res: Response) => {
    try {
      // Mock data for now - you can replace with real API calls
      const sentiment = {
        fearGreedIndex: Math.floor(Math.random() * 100),
        btcDominance: 45 + Math.random() * 10,
        totalMarketCap: 2.1e12 + Math.random() * 0.5e12,
        volume24h: 50e9 + Math.random() * 20e9
      };
      res.json(sentiment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scanner API endpoints - proxy to Python scanner service
  app.post('/api/scanner/scan', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const response = await fetch(`${scannerApiUrl}/api/scanner/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Scanner API error:', error);
      res.status(500).json({
        error: error.message,
        message: 'Failed to communicate with scanner service. Ensure scanner_api.py is running on port 5001.'
      });
    }
  });

  app.get('/api/scanner/signals', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${scannerApiUrl}/api/scanner/signals${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Scanner API error:', error);
      res.status(500).json({
        error: error.message,
        message: 'Failed to communicate with scanner service. Ensure scanner_api.py is running on port 5001.'
      });
    }
  });

  app.get('/api/scanner/status', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const response = await fetch(`${scannerApiUrl}/api/scanner/status`);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Scanner API error:', error);
      res.status(503).json({
        status: 'unavailable',
        error: error.message,
        message: 'Scanner service is not responding. Ensure scanner_api.py is running on port 5001.'
      });
    }
  });

  app.get('/api/portfolio-summary', async (req: Request, res: Response) => {
    try {
      const portfolio = await storage.getPortfolioSummary();
      res.json(portfolio);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/exchange/status', async (req: Request, res: Response) => {
    try {
      if (!exchangeDataFeed) {
        return res.status(503).json({
          error: 'Exchange data feed not initialized',
          exchanges: []
        });
      }

      const status = Object.entries(exchangeDataFeed.exchanges).map(([id, ex]) => {
        const exchange = ex as any; // Type assertion for CCXT exchange object
        return {
          id,
          markets: Object.keys(exchange.markets || {}).length,
          rateLimit: exchange.rateLimit,
          enableRateLimit: exchange.enableRateLimit,
          hasThrottler: typeof exchange.throttle === 'function',
          timeout: exchange.timeout,
          isConnected: exchange.has && exchange.has.spot ? 'spot' : exchange.has && exchange.has.futures ? 'futures' : 'unknown'
        };
      });

      const overallHealth = status.every(ex => ex.hasThrottler && ex.markets > 0);

      res.json({
        exchanges: status,
        overallHealth,
        timestamp: new Date().toISOString(),
        totalExchanges: status.length,
        healthyExchanges: status.filter(ex => ex.hasThrottler && ex.markets > 0).length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/ml/insights', async (req: Request, res: Response) => {
    try {
      const insights = {
        predictions: [],
        confidence: 0.75 + Math.random() * 0.2,
        features: {
          momentum: Math.random(),
          volatility: Math.random(),
          volume: Math.random()
        }
      };
      res.json(insights);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/analysis/multi-timeframe', async (req: Request, res: Response) => {
    try {
      const analysis = {
        overallTrend: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)],
        confluenceScore: Math.random(),
        timeframeAnalysis: [
          { timeframe: '1m', trend: 'bullish', strength: Math.random() },
          { timeframe: '5m', trend: 'neutral', strength: Math.random() },
          { timeframe: '1h', trend: 'bearish', strength: Math.random() }
        ]
      };
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Continuous scanner endpoints
  app.post('/api/scanner/continuous/start', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const response = await fetch(`${scannerApiUrl}/api/scanner/continuous/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Continuous scanner start error:', error);
      res.status(500).json({
        error: error.message,
        message: 'Failed to start continuous scanner'
      });
    }
  });

  app.post('/api/scanner/continuous/stop', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const response = await fetch(`${scannerApiUrl}/api/scanner/continuous/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Continuous scanner stop error:', error);
      res.status(500).json({
        error: error.message,
        message: 'Failed to stop continuous scanner'
      });
    }
  });

  app.get('/api/scanner/continuous/status', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const response = await fetch(`${scannerApiUrl}/api/scanner/continuous/status`);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Continuous scanner status error:', error);
      res.status(503).json({
        running: false,
        error: error.message,
        message: 'Continuous scanner not available'
      });
    }
  });

  app.get('/api/scanner/continuous/signals', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${scannerApiUrl}/api/scanner/continuous/signals${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Continuous signals error:', error);
      res.status(500).json({
        error: error.message,
        signals: [],
        message: 'Failed to get continuous signals'
      });
    }
  });

  app.get('/api/scanner/continuous/market-state', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const response = await fetch(`${scannerApiUrl}/api/scanner/continuous/market-state`);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Market state error:', error);
      res.status(500).json({
        error: error.message,
        message: 'Failed to get market state'
      });
    }
  });

  app.get('/api/scanner/training-data/:symbol', async (req: Request, res: Response) => {
    try {
      const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
      const symbol = req.params.symbol;
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const url = `${scannerApiUrl}/api/scanner/training-data/${symbol}${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Scanner API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Training data error:', error);
      res.status(500).json({
        error: error.message,
        message: 'Failed to get training data'
      });
    }
  });

  // Backtest API endpoint
  app.post('/api/backtest/run', async (req: Request, res: Response) => {
    try {
      if (!runBacktest) {
        return res.status(501).json({ error: 'Backtest engine not available' });
      }
      const { strategy, symbol, timeframe, startDate, endDate } = req.body;
      const results = await runBacktest(strategy, symbol, timeframe, startDate, endDate);
      res.json(results);
    } catch (error: any) {
      console.error('Backtest error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ML Signal Enhancement endpoint
  app.post('/api/ml/enhance-signal', async (req: Request, res: Response) => {
    try {
      if (!mlEnhancer) {
        return res.status(501).json({ error: 'ML enhancer not available' });
      }
      const { signal, marketData } = req.body;
      const enhanced = await mlEnhancer.enhanceSignal(signal, marketData);
      res.json(enhanced);
    } catch (error: any) {
      console.error('ML enhancement error:', error);
      res.status(500).json({ error: error.message });
    }
  });

    // Global error handler middleware
    app.use((err: any, _req: Request, res: Response, _next: any) => {
      console.error(err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    });


  // --- Strategy Management API ---
  console.log('Registering Strategy Management API');

  // Strategy metadata
  const STRATEGIES = [
    {
      id: 'gradient_trend_filter',
      name: 'Gradient Trend Filter',
      description: 'Advanced trend-following strategy using gradient analysis for precise trend identification',
      type: 'Trend Following',
      features: [
        'Multi-timeframe gradient analysis',
        'Adaptive trend strength calculation',
        'Dynamic support/resistance levels',
        'Volatility-adjusted entries'
      ],
      parameters: {
        fast_period: { type: 'number', default: 10, description: 'Fast EMA period', min: 5, max: 50 },
        slow_period: { type: 'number', default: 50, description: 'Slow EMA period', min: 20, max: 200 },
        threshold: { type: 'number', default: 0.002, description: 'Trend threshold', min: 0.001, max: 0.01 }
      },
      performance: {
        winRate: 68,
        avgReturn: 4.2,
        sharpeRatio: 1.8,
        maxDrawdown: -12.5
      },
      isActive: true,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'ut_bot',
      name: 'UT Bot Strategy',
      description: 'ATR-based trailing stop system for capturing trends with dynamic risk management',
      type: 'Trend Following',
      features: [
        'Multiple ATR calculation methods',
        'Position tracking with P&L',
        'Dynamic trailing stops',
        'Configurable stop loss behavior'
      ],
      parameters: {
        sensitivity: { type: 'number', default: 1.0, description: 'ATR multiplier', min: 0.5, max: 3.0 },
        atr_period: { type: 'number', default: 10, description: 'ATR period', min: 5, max: 30 },
        atr_method: { type: 'string', default: 'RMA', description: 'ATR method (RMA/SMA/EMA/WMA)' }
      },
      performance: {
        winRate: 62,
        avgReturn: 3.8,
        sharpeRatio: 1.6,
        maxDrawdown: -15.2
      },
      isActive: true,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'mean_reversion',
      name: 'Mean Reversion Engine',
      description: 'Multi-indicator reversal system combining Bollinger Bands, Z-Score, and RSI',
      type: 'Mean Reversion',
      features: [
        'Bollinger Bands for volatility levels',
        'Z-Score for statistical extremes',
        'RSI momentum confirmation',
        'Market regime detection'
      ],
      parameters: {
        bb_period: { type: 'number', default: 20, description: 'Bollinger Bands period', min: 10, max: 50 },
        bb_std: { type: 'number', default: 2.0, description: 'Standard deviation multiplier', min: 1.5, max: 3.0 },
        rsi_period: { type: 'number', default: 14, description: 'RSI period', min: 7, max: 28 },
        oversold: { type: 'number', default: 30, description: 'RSI oversold level', min: 20, max: 40 },
        overbought: { type: 'number', default: 70, description: 'RSI overbought level', min: 60, max: 80 }
      },
      performance: {
        winRate: 72,
        avgReturn: 2.9,
        sharpeRatio: 1.4,
        maxDrawdown: -9.8
      },
      isActive: true,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'volume_profile',
      name: 'Volume Profile Engine',
      description: 'Order flow and volume profile analysis for high-probability trade zones',
      type: 'Volume Analysis',
      features: [
        'Point of Control (POC) identification',
        'Cumulative Volume Delta (CVD)',
        'Order flow imbalance detection',
        'Value area analysis'
      ],
      parameters: {
        profile_bins: { type: 'number', default: 24, description: 'Volume profile bins', min: 10, max: 50 },
        cvd_period: { type: 'number', default: 20, description: 'CVD lookback period', min: 10, max: 50 },
        imbalance_threshold: { type: 'number', default: 1.5, description: 'Order flow imbalance threshold', min: 1.2, max: 3.0 }
      },
      performance: {
        winRate: 65,
        avgReturn: 3.5,
        sharpeRatio: 1.5,
        maxDrawdown: -11.3
      },
      isActive: true,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'market_structure',
      name: 'Market Structure Engine',
      description: 'Price action analysis using market structure breaks, higher highs, and lower lows',
      type: 'Price Action',
      features: [
        'Structure break detection',
        'Higher high/lower low identification',
        'Trend reversal signals',
        'Continuation pattern recognition'
      ],
      parameters: {
        swing_period: { type: 'number', default: 20, description: 'Swing point lookback', min: 10, max: 50 },
        break_threshold: { type: 'number', default: 0.001, description: 'Structure break threshold', min: 0.0005, max: 0.005 },
        confirmation_bars: { type: 'number', default: 3, description: 'Confirmation bars required', min: 1, max: 10 }
      },
      performance: {
        winRate: 70,
        avgReturn: 4.0,
        sharpeRatio: 1.7,
        maxDrawdown: -10.5
      },
      isActive: true,
      lastUpdated: new Date().toISOString()
    }
  ];

  // GET /api/strategies - List all strategies
  app.get('/api/strategies', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        strategies: STRATEGIES,
        total: STRATEGIES.length
      });
    } catch (error) {
      console.error('Error fetching strategies:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch strategies' });
    }
  });

  // GET /api/strategies/:id - Get strategy details
  app.get('/api/strategies/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const strategy = STRATEGIES.find((s: any) => s.id === id);

      if (!strategy) {
        return res.status(404).json({ success: false, error: 'Strategy not found' });
      }

      res.json({ success: true, strategy });
    } catch (error) {
      console.error('Error fetching strategy:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch strategy' });
    }
  });

  // POST /api/strategies/consensus - Get consensus trade from all strategies
  app.post('/api/strategies/consensus', async (req: Request, res: Response) => {
    try {
      const { symbol, timeframes, equity } = req.body;

      // Mock consensus response (will connect to Python later)
      const consensus = {
        direction: 'LONG',
        entryPrice: 42850.50,
        stopLoss: 42200.00,
        takeProfit: [43800.00, 44500.00, 45600.00],
        positionSize: 0.15,
        confidence: 78.5,
        riskRewardRatio: 2.8,
        contributingStrategies: ['Gradient Trend Filter', 'UT Bot', 'Volume Profile'],
        timeframeAlignment: {
          'D1': 'LONG',
          'H4': 'LONG',
          'H1': 'LONG',
          'M15': 'NEUTRAL'
        },
        edgeScore: 82.3,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        consensus
      });
    } catch (error) {
      console.error('Error generating consensus:', error);
      res.status(500).json({ success: false, error: 'Failed to generate consensus' });
    }
  });

  // At the end, create and return the httpServer:
  const httpServer = createServer(app);

  // WebSocket server on the same port as HTTP server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Import Fast Scanner for event broadcasting
  let fastScanner: any;
  try {
    const fastScannerModule = await import('./services/fast-scanner');
    fastScanner = fastScannerModule.fastScanner;

    // Connect Fast Scanner events to broadcast to all WebSocket clients
    if (fastScanner) {
      fastScanner.on('quickScanComplete', (data: any) => {
        console.log(`[WebSocket] Broadcasting quick scan complete: ${data.signals.length} signals`);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'quickScanComplete',
              data
            }));
          }
        });
      });

      fastScanner.on('symbolAnalyzed', (data: any) => {
        console.log(`[WebSocket] Broadcasting symbol analyzed: ${data.symbol}`);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'symbolAnalyzed',
              data
            }));
          }
        });
      });

      fastScanner.on('analysisProgress', (data: any) => {
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'analysisProgress',
              data
            }));
          }
        });
      });

      fastScanner.on('deepAnalysisComplete', (data: any) => {
        console.log(`[WebSocket] Broadcasting deep analysis complete: ${data.scanId}`);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'deepAnalysisComplete',
              data
            }));
          }
        });
      });

      console.log('[WebSocket] Fast Scanner events connected');
    }
  } catch (err) {
    console.log('[WebSocket] Fast Scanner not available:', err);
  }

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    // Heartbeat/timeout mechanism
    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });
    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        ws.terminate();
        clearInterval(heartbeatInterval);
      } else {
        isAlive = false;
        ws.ping();
      }
    }, 30000); // 30s heartbeat

    // Send initial data
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to QuantumScanner Pro'
    }));

    // Track selected exchange per client
    let clientExchange = 'kucoinfutures';

    ws.on('message', async (msg) => {
      try {
        const strMsg = typeof msg === 'string' ? msg : msg.toString();
        const data = JSON.parse(strMsg);

        if (data.type === 'set_exchange' && typeof data.exchange === 'string') {
          clientExchange = data.exchange;
          ws.send(JSON.stringify({ type: 'exchange_set', exchange: clientExchange }));
        }

        // Handle Fast Scanner requests
        if (data.type === 'requestQuickScan' && fastScanner) {
          console.log('[WebSocket] Quick scan requested by client');
          try {
            const results = await fastScanner.triggerScan();
            ws.send(JSON.stringify({
              type: 'quickScanComplete',
              data: {
                signals: results,
                timestamp: new Date()
              }
            }));
          } catch (error: any) {
            ws.send(JSON.stringify({
              type: 'scanError',
              error: error.message
            }));
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    // Real-time market data updates using ExchangeDataFeed (sequential fetch to prevent throttler overflow)
    let fetching = false; // Guard against overlapping jobs
    const marketDataInterval = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN && !fetching) {
        fetching = true;
        try {
          if (!exchangeDataFeed) {
            console.log('[WebSocket] ExchangeDataFeed not available, sending mock data');
            // Send mock data if exchange data feed is not available
            const mockData = {
              symbol: 'BTC/USDT',
              timestamp: Date.now(),
              price: {
                open: 50000 + Math.random() * 1000,
                high: 51000 + Math.random() * 1000,
                low: 49000 + Math.random() * 1000,
                close: 50500 + Math.random() * 1000
              },
              volume: Math.random() * 1000
            };
            ws.send(JSON.stringify({
              type: 'market_data',
              data: mockData
            }));
            fetching = false;
            return;
          }

          // Use correct symbols for kucoinfutures, fallback to spot symbols for others
          let symbols: string[];
          if (clientExchange === 'kucoinfutures') {
            symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT'];
          } else {
            symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
          }

          console.log(`[WebSocket] Fetching market data for ${clientExchange}: ${symbols[0]}`);

          // Check if exchange is available
          if (!exchangeDataFeed.exchanges.has(clientExchange)) {
            console.error(`[WebSocket] Exchange ${clientExchange} not found in ExchangeDataFeed`);
            console.log('[WebSocket] Available exchanges:', Array.from(exchangeDataFeed.exchanges.keys()));
            fetching = false;
            return;
          }

          // Process symbols sequentially to avoid throttler queue overflow
          const results = [];
          for (const symbol of symbols) {
            try {
              const frames = await exchangeDataFeed.fetchMarketData(symbol, '1m', 1, clientExchange);
              console.log(`[WebSocket] Fetched ${frames.length} frames for ${symbol} from ${clientExchange}`);
              if (frames.length === 0) {
                console.warn(`[WebSocket] No frames returned for ${symbol}`);
                results.push(null);
                continue;
              }

              const marketFrame = frames[0];
              await storage.createMarketFrame(marketFrame);
              ws.send(JSON.stringify({
                type: 'market_data',
                data: marketFrame
              }));

              // Generate signal using SignalEngine
              if (signalEngine) {
                const index = frames.length - 1;
                const signal = await signalEngine.generateSignal(frames, index);
                if (signal) {
                  await storage.createSignal(signal);
                  ws.send(JSON.stringify({
                    type: 'signal',
                    data: signal
                  }));
                }
              }

              results.push(marketFrame);

              // Add delay between requests to prevent throttler overflow
              await new Promise(resolve => setTimeout(resolve, 300));

            } catch (symbolError) {
              console.error(`Error processing symbol ${symbol}:`, symbolError);
              results.push(null);
              // Continue processing other symbols even if one fails
            }
          }
        } catch (error) {
          console.error('Error sending market data:', error);
        } finally {
          fetching = false; // Reset the guard flag
        }
      }
    }, 2000);

    // Portfolio updates
    const portfolioInterval = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          const portfolio = await storage.getPortfolioSummary();
          ws.send(JSON.stringify({
            type: 'portfolio_update',
            data: portfolio
          }));
        } catch (error) {
          console.error('Error sending portfolio update:', error);
        }
      }
    }, 5000);

    function cleanup() {
      clearInterval(marketDataInterval);
      clearInterval(portfolioInterval);
      clearInterval(heartbeatInterval);
    }

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
      cleanup();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      cleanup();
    });
  });

  return httpServer;
  }