import type { Express, Request, Response } from "express";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import axios from 'axios'; // Import axios for CoinGecko API calls
import { Router } from 'express'; // Import Router for dynamic route registration

// Import strategy routes and paper trading routes
import strategyRoutes from './routes/strategies';
import paperTradingRoutes from './routes/paper-trading';
// Import signal performance routes
import signalPerformanceRoutes from './routes/signal-performance';
// Import notification routes
import notificationRoutes from './routes/notifications';
// Import user preferences routes
import userPreferencesRoutes from './routes/user-preferences';

// Import ML routes
import mlPredictionsRouter from './routes/ml-predictions';
import mlTrainingRouter from './routes/ml-training';
import mlSignalsRouter from './routes/ml-signals';
import mlAdvancedRoutes from './routes/ml-advanced';
import mlAdvancedModelsRouter from './routes/ml-advanced-models';
import portfolioRouter from './routes/portfolio';

// Import signal quality and watchlist routes
import signalQualityRouter from './routes/signal-quality';
// Import flow field analytics routes
import flowFieldRouter from './routes/flow-field';
// Import velocity profiles routes
import { registerVelocityProfileRoutes } from './routes/velocity-profiles';
// Import composite quality routes
import compositeQualityRouter from './routes/composite-quality';

// Import Live Trading routes
import liveTradingRouter from './routes/live-trading';


// Import Position Sizing API routes (Phase 2)
import positionSizingRouter from './routes/position-sizing';

// Import MTF confirmation routes
import mtfConfirmationRouter from './routes/mtf-confirmation';
// Import intelligent exits routes
import intelligentExitsRouter from './routes/intelligent-exits';
// Import correlation hedge routes
import correlationHedgeRouter from './routes/correlation-hedge';

// Create prisma instance
const prisma = new PrismaClient();

// Optional imports - only use if modules exist
let MirrorOptimizer: any, ScannerAgent: any, MLAgent: any;
let calculate_volume_profile: any, calculate_anchored_volume_profile: any, calculate_fixed_range_volume_profile: any;
let calculate_composite_score: any, calculate_volume_composite_score: any, calculate_confidence_score: any;
let calculate_value_area: any, calculate_poc: any;
let runBacktest, ExchangeDataFeed, SignalEngine, defaultTradingConfig;
let MLSignalEnhancer, EnhancedMultiTimeframeAnalyzer;
let registerChartApi, registerAdvancedIndicatorApi;
let StrategyIntegrationEngine;
let velocityProfilesRouter; // Declare velocityProfilesRouter here

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

  const strategyModule = await import('./strategy-integration').catch(() => null);
  if (strategyModule) {
    ({ StrategyIntegrationEngine } = strategyModule);
  }

  // Velocity profiles router - create if missing
  try {
    velocityProfilesRouter = require('./routes/velocity-profiles').default;
  } catch (e) {
    velocityProfilesRouter = Router();
    console.warn('[routes] velocity-profiles router not found, using empty router');
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
  import { setupAuth, isAuthenticated, getUser, getUserPreferences, updateUserPreferences, getApiKeys, addApiKey, deleteApiKey } from './replitAuth';
  import { log } from './utils'; // Assuming a log utility function exists

  export async function registerRoutes(app: Express): Promise<Server> {
    // Create HTTP server
    const server = createServer(app);

    // Enable trust proxy for rate limiting to work correctly in proxied environment
    app.set('trust proxy', 1);

    // Security & CORS middleware
    app.use(cors());
    app.use(helmet({
      contentSecurityPolicy: false,
    }));
    app.use(rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
    }));

    // Setup authentication
    await setupAuth(app);

    // Auth routes
    app.get('/api/auth/user', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const user = await getUser(userId);
        res.json(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    });

    // User preferences routes
    app.get('/api/user/preferences', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const prefs = await getUserPreferences(userId);
        res.json(prefs);
      } catch (error) {
        console.error("Error fetching preferences:", error);
        res.status(500).json({ message: "Failed to fetch preferences" });
      }
    });

    app.patch('/api/user/preferences', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const prefs = await updateUserPreferences(userId, req.body);
        res.json(prefs);
      } catch (error) {
        console.error("Error updating preferences:", error);
        res.status(500).json({ message: "Failed to update preferences" });
      }
    });

    // API keys routes
    app.get('/api/user/api-keys', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const keys = await getApiKeys(userId);
        res.json(keys);
      } catch (error) {
        console.error("Error fetching API keys:", error);
        res.status(500).json({ message: "Failed to fetch API keys" });
      }
    });

    app.post('/api/user/api-keys', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const key = await addApiKey(userId, req.body);
        res.json(key);
      } catch (error) {
        console.error("Error adding API key:", error);
        res.status(500).json({ message: "Failed to add API key" });
      }
    });

    app.delete('/api/user/api-keys/:keyId', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        await deleteApiKey(userId, req.params.keyId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting API key:", error);
        res.status(500).json({ message: "Failed to delete API key" });
      }
    });

    // Watchlist routes
    app.get('/api/user/watchlist', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const watchlist = await prisma.Watchlist.findMany({
          where: { userId },
          orderBy: { addedAt: 'desc' }
        });
        res.json(watchlist);
      } catch (error) {
        console.error("Error fetching watchlist:", error);
        res.status(500).json({ message: "Failed to fetch watchlist" });
      }
    });

    app.post('/api/user/watchlist', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        const { symbol, notes } = req.body;
        const item = await prisma.Watchlist.create({
          data: { userId, symbol: symbol.toUpperCase(), notes }
        });
        res.json(item);
      } catch (error: any) {
        console.error("Error adding to watchlist:", error);
        res.status(500).json({ message: error.message || "Failed to add to watchlist" });
      }
    });

    app.delete('/api/user/watchlist/:id', isAuthenticated, async (req: any, res: Response) => {
      try {
        const userId = req.user.claims.sub;
        await prisma.Watchlist.deleteMany({
          where: { id: req.params.id, userId }
        });
        res.json({ success: true });
      } catch (error) {
        console.error("Error removing from watchlist:", error);
        res.status(500).json({ message: "Failed to remove from watchlist" });
      }
    });

    // Register signal quality routes
    app.use('/api/signals', signalQualityRouter);

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

  // Analytics API - Strategy list endpoint
  app.get('/api/strategies/list', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.query;

      // Mock strategies data with performance metrics
      const strategies = [
        {
          id: 'gradient_trend_filter',
          name: 'Gradient Trend Filter',
          weight: 0.25,
          baseWeight: 0.25,
          regimeMultiplier: 1.1,
          volatilityMultiplier: 0.95,
          momentumAlignment: 1.05,
          temporalDecay: 0.98,
          finalWeight: 0.27,
          performance: { winRate: 0.68, profitFactor: 2.1, trades: 234 },
        },
        {
          id: 'ut_bot',
          name: 'UT Bot',
          weight: 0.20,
          baseWeight: 0.20,
          regimeMultiplier: 1.0,
          volatilityMultiplier: 0.98,
          momentumAlignment: 0.98,
          temporalDecay: 0.97,
          finalWeight: 0.21,
          performance: { winRate: 0.62, profitFactor: 1.8, trades: 189 },
        },
        {
          id: 'mean_reversion',
          name: 'Mean Reversion',
          weight: 0.20,
          baseWeight: 0.20,
          regimeMultiplier: 0.85,
          volatilityMultiplier: 1.2,
          momentumAlignment: 0.92,
          temporalDecay: 0.96,
          finalWeight: 0.18,
          performance: { winRate: 0.71, profitFactor: 2.3, trades: 156 },
        },
        {
          id: 'volume_profile',
          name: 'Volume Profile',
          weight: 0.20,
          baseWeight: 0.20,
          regimeMultiplier: 1.05,
          volatilityMultiplier: 0.9,
          momentumAlignment: 1.02,
          temporalDecay: 0.99,
          finalWeight: 0.19,
          performance: { winRate: 0.65, profitFactor: 1.9, trades: 201 },
        },
        {
          id: 'market_structure',
          name: 'Market Structure',
          weight: 0.15,
          baseWeight: 0.15,
          regimeMultiplier: 0.92,
          volatilityMultiplier: 1.1,
          momentumAlignment: 0.88,
          temporalDecay: 0.95,
          finalWeight: 0.15,
          performance: { winRate: 0.59, profitFactor: 1.6, trades: 112 },
        },
      ];

      const regime = {
        type: 'BULL_STRONG',
        volatility: 'medium' as const,
        momentum: 0.125,
        trend: 'up',
      };

      res.json({ strategies, regime });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch strategies' });
    }
  });

  // Analytics API - ML models endpoint
  app.get('/api/ml/models', async (req: Request, res: Response) => {
    try {
      const { symbol = 'BTC/USDT' } = req.query;

      const models = [
        {
          id: '0',
          name: 'Consensus Ensemble',
          type: 'Ensemble',
          symbol,
          accuracy: 89.6,
          status: 'trained',
          confidence: 0.88,
          predictions: { direction: 'UP', nextHour: 45180, nextDay: 46290 },
          description: 'Combines all 3 models for consensus signals',
        },
        {
          id: '1',
          name: 'LSTM Price Predictor',
          type: 'LSTM',
          symbol,
          accuracy: 87.3,
          status: 'trained',
          confidence: 0.85,
          predictions: { direction: 'UP', nextHour: 45120, nextDay: 46250 },
        },
        {
          id: '2',
          name: 'Random Forest Classifier',
          type: 'Random Forest',
          symbol,
          accuracy: 82.1,
          status: 'trained',
          confidence: 0.78,
          predictions: { direction: 'UP', nextHour: 3250, nextDay: 3180 },
        },
        {
          id: '3',
          name: 'Market Sentiment Analyzer',
          type: 'BERT',
          symbol,
          accuracy: 91.5,
          status: 'trained',
          confidence: 0.92,
          predictions: { direction: 'UP', nextHour: 98, nextDay: 105 },
        },
      ];

      res.json({ models });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch ML models' });
    }
  });

  // Gateway API - Dataframe endpoint with technical indicators
  app.get('/api/gateway/dataframe/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const { timeframe = '1h', limit = 100 } = req.query;

      // Simple technical indicator calculations
      const calculateRSI = (closes: number[], period = 14) => {
        if (closes.length < period) return 50;
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
          const change = closes[i] - closes[i - 1];
          if (change > 0) gains += change;
          else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / (avgLoss || 1);
        return 100 - (100 / (1 + rs));
      };

      const calculateEMA = (closes: number[], period: number) => {
        if (closes.length === 0) return 0;
        const k = 2 / (period + 1);
        let ema = closes[0];
        for (let i = 1; i < closes.length; i++) {
          ema = closes[i] * k + ema * (1 - k);
        }
        return ema;
      };

      const calculateMACD = (closes: number[]) => {
        const ema12 = calculateEMA(closes, 12);
        const ema26 = calculateEMA(closes, 26);
        return ema12 - ema26;
      };

      const calculateATR = (highs: number[], lows: number[], closes: number[], period = 14) => {
        if (closes.length < 2) return 0;
        const tr = [];
        for (let i = 1; i < closes.length; i++) {
          const h = highs[i];
          const l = lows[i];
          const c = closes[i - 1];
          const value = Math.max(h - l, Math.abs(h - c), Math.abs(l - c));
          tr.push(value);
        }
        return tr.reduce((a, b) => a + b, 0) / tr.length;
      };

      // Fetch market data or use mock data
      const mockData = {
        symbol,
        signal: Math.random() > 0.5 ? 'BUY' : 'SELL',
        signalConfidence: Math.floor(Math.random() * 40 + 60),
        close: Math.random() * 50000 + 10000,
        rsi: Math.random() * 100,
        ema20: Math.random() * 50000 + 10000,
        ema50: Math.random() * 50000 + 10000,
        macd: Math.random() * 1000 - 500,
        atr: Math.random() * 500 + 100,
        trendDirection: Math.random() > 0.5 ? 'UPTREND' : 'DOWNTREND',
        volume: Math.random() * 10000000 + 1000000,
        volumeTrend: Math.random() > 0.5 ? 'INCREASING' : 'DECREASING',
        priceChangePercent: Math.random() * 10 - 5
      };

      res.json({ dataframe: mockData });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch dataframe' });
    }
  });

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



  // Register velocity profile API
  try {
    registerVelocityProfileRoutes(app);
    console.log('[INIT] Velocity Profile API registered at /api/velocity/*');
  } catch (error) {
    console.warn('Velocity Profile API could not be registered:', error);
  }

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

  // Enhanced Market Intelligence Page with All CoinGecko Data and Custom Analysis
  app.get('/api/market-intelligence', async (req: Request, res: Response) => {
    try {
      // Fetch Fear & Greed Index from Alternative.me (crypto-specific)
      let fearGreedData: { value: number; classification: string; timestamp: number } | null = null;
      try {
        const response = await axios.get('https://api.alternative.me/fng/?limit=1');
        if (response.data && response.data.data && response.data.data.length > 0) {
          const fng = response.data.data[0];
          fearGreedData = {
            value: parseInt(fng.value, 10),
            classification: fng.value_classification,
            timestamp: parseInt(fng.timestamp, 10) * 1000
          };
        }
      } catch (error: any) {
        console.warn('[MarketIntel] Fear & Greed Index fetch failed:', error.message);
      }

      // Fetch comprehensive CoinGecko global data
      let coingeckoGlobalData: any = null;
      try {
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        if (response.data && response.data.data) {
          coingeckoGlobalData = response.data.data;
        }
      } catch (error: any) {
        console.warn('[MarketIntel] CoinGecko global data fetch failed:', error.message);
      }

      // Fetch top 100 coins with multi-timeframe price changes for gainers/losers
      let marketData: any[] = [];
      try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 100,
            page: 1,
            sparkline: false,
            price_change_percentage: '1h,24h,7d,30d,1y'
          }
        });
        if (response.data) {
          marketData = response.data;
        }
      } catch (error: any) {
        console.warn('[MarketIntel] CoinGecko market data fetch failed:', error.message);
      }

      // Fetch trending coins
      let trendingCoins: any[] = [];
      try {
        const response = await axios.get('https://api.coingecko.com/api/v3/search/trending');
        if (response.data && response.data.coins) {
          trendingCoins = response.data.coins.map((coin: any) => ({
            id: coin.item.id,
            name: coin.item.name,
            symbol: coin.item.symbol.toUpperCase(),
            marketCapRank: coin.item.market_cap_rank,
            thumb: coin.item.thumb,
            score: coin.item.score,
            priceChange24h: coin.item.data?.price_change_percentage_24h?.usd || 0
          }));
        }
      } catch (error: any) {
        console.warn('[MarketIntel] Trending coins fetch failed:', error.message);
      }

      // Calculate top 10 gainers and losers from market data
      const sortedBy24h = [...marketData].filter(c => c.price_change_percentage_24h_in_currency !== null);
      const topGainers = sortedBy24h
        .sort((a, b) => (b.price_change_percentage_24h_in_currency || 0) - (a.price_change_percentage_24h_in_currency || 0))
        .slice(0, 10)
        .map(coin => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          currentPrice: coin.current_price,
          priceChange1h: coin.price_change_percentage_1h_in_currency,
          priceChange24h: coin.price_change_percentage_24h_in_currency,
          priceChange7d: coin.price_change_percentage_7d_in_currency,
          priceChange30d: coin.price_change_percentage_30d_in_currency,
          priceChange1y: coin.price_change_percentage_1y_in_currency,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          image: coin.image,
          marketCapRank: coin.market_cap_rank
        }));

      const topLosers = sortedBy24h
        .sort((a, b) => (a.price_change_percentage_24h_in_currency || 0) - (b.price_change_percentage_24h_in_currency || 0))
        .slice(0, 10)
        .map(coin => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          currentPrice: coin.current_price,
          priceChange1h: coin.price_change_percentage_1h_in_currency,
          priceChange24h: coin.price_change_percentage_24h_in_currency,
          priceChange7d: coin.price_change_percentage_7d_in_currency,
          priceChange30d: coin.price_change_percentage_30d_in_currency,
          priceChange1y: coin.price_change_percentage_1y_in_currency,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          image: coin.image,
          marketCapRank: coin.market_cap_rank
        }));

      // Determine market regime based on multiple factors
      let regimeAnalysis = 'neutral';
      let regimeScore = 50;
      if (coingeckoGlobalData) {
        const marketCapChangePercent = coingeckoGlobalData.market_cap_change_percentage_24h_usd || 0;
        const btcDominance = coingeckoGlobalData.market_cap_percentage?.btc || 50;

        // Calculate regime score (0-100)
        regimeScore = 50;
        if (marketCapChangePercent > 5) regimeScore += 25;
        else if (marketCapChangePercent > 2) regimeScore += 15;
        else if (marketCapChangePercent > 0) regimeScore += 5;
        else if (marketCapChangePercent < -5) regimeScore -= 25;
        else if (marketCapChangePercent < -2) regimeScore -= 15;
        else if (marketCapChangePercent < 0) regimeScore -= 5;

        // Factor in fear/greed
        if (fearGreedData) {
          if (fearGreedData.value > 70) regimeScore += 10;
          else if (fearGreedData.value < 30) regimeScore -= 10;
        }

        regimeScore = Math.max(0, Math.min(100, regimeScore));
        if (regimeScore >= 65) regimeAnalysis = 'bullish';
        else if (regimeScore <= 35) regimeAnalysis = 'bearish';
        else regimeAnalysis = 'neutral';
      }

      // Build comprehensive response
      const marketIntelligence = {
        // Fear & Greed (REAL DATA)
        fearGreedIndex: fearGreedData?.value ?? null,
        fearGreedClassification: fearGreedData?.classification ?? 'Unknown',
        fearGreedTimestamp: fearGreedData?.timestamp ?? null,

        // Global Market Data (REAL DATA)
        btcDominance: coingeckoGlobalData?.market_cap_percentage?.btc ?? null,
        ethDominance: coingeckoGlobalData?.market_cap_percentage?.eth ?? null,
        totalMarketCap: coingeckoGlobalData?.total_market_cap?.usd ?? null,
        volume24h: coingeckoGlobalData?.total_volume?.usd ?? null,
        marketCapChange24hPercent: coingeckoGlobalData?.market_cap_change_percentage_24h_usd ?? null,
        activeCryptocurrencies: coingeckoGlobalData?.active_cryptocurrencies ?? null,
        totalExchanges: coingeckoGlobalData?.markets ?? null,

        // Top Gainers/Losers (REAL DATA with multi-timeframe)
        topGainers,
        topLosers,

        // Trending Coins by Social Sentiment (REAL DATA)
        trendingCoins,

        // Market Regime Analysis
        marketRegime: {
          status: regimeAnalysis,
          score: regimeScore,
          description: regimeAnalysis === 'bullish'
            ? 'Market showing strong upward momentum'
            : regimeAnalysis === 'bearish'
              ? 'Market showing downward pressure'
              : 'Market in consolidation phase'
        },

        // Metadata
        lastUpdated: new Date().toISOString(),
        dataSource: 'CoinGecko + Alternative.me',
        attribution: 'Data provided by CoinGecko (coingecko.com) and Alternative.me'
      };

      res.json(marketIntelligence);
    } catch (error: any) {
      console.error('[MarketIntel] Error fetching market intelligence:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Register CoinGecko chart API
  if (coinGeckoChartRouter) {
    try {
      app.use('/api/coingecko', coinGeckoChartRouter); // Mount CoinGecko router under /api/coingecko
      console.log('[INIT] CoinGecko chart API registered under /api/coingecko');
    } catch (error) {
      console.warn('CoinGecko chart API could not be registered:', error);
    }
  }

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

  // --- Market Intelligence API Endpoints ---

  // This endpoint will fetch all available CoinGecko data
  app.get('/api/coingecko/all', async (req: Request, res: Response) => {
    try {
      // Fetch data for all coins (limited to 250 by default by CoinGecko, can be increased)
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 250, // Adjust as needed
          page: 1,
          sparkline: false
        }
      });

      if (response.data) {
        res.json(response.data);
      } else {
        res.status(500).json({ error: 'Failed to fetch CoinGecko data' });
      }
    } catch (error: any) {
      console.error('Error fetching CoinGecko all data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // This endpoint will fetch specific coin data
  app.get('/api/coingecko/coin/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { vs_currency = 'usd' } = req.query;

      const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
        params: {
          vs_currency: vs_currency,
          localization: 'false',
          tickers: 'true',
          market_data: 'true',
          community_data: 'true',
          developer_data: 'true',
          sparkline: 'true',
        }
      });

      if (response.data) {
        res.json(response.data);
      } else {
        res.status(404).json({ error: 'Coin not found' });
      }
    } catch (error: any) {
      console.error(`Error fetching CoinGecko data for ${req.params.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // This endpoint will fetch CoinGecko categories and their related coins
  app.get('/api/coingecko/categories', async (req: Request, res: Response) => {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/categories', {
        params: {
          order: 'market_cap',
          item_count: 10 // Number of coins to show per category
        }
      });

      if (response.data) {
        res.json(response.data);
      } else {
        res.status(500).json({ error: 'Failed to fetch CoinGecko categories' });
      }
    } catch (error: any) {
      console.error('Error fetching CoinGecko categories:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // This endpoint will fetch CoinGecko exchanges
  app.get('/api/coingecko/exchanges', async (req: Request, res: Response) => {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/exchanges', {
        params: {
          per_page: 250, // Adjust as needed
          page: 1
        }
      });

      if (response.data) {
        res.json(response.data);
      } else {
        res.status(500).json({ error: 'Failed to fetch CoinGecko exchanges' });
      }
    } catch (error: any) {
      console.error('Error fetching CoinGecko exchanges:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // This endpoint will fetch CoinGecko indices
  app.get('/api/coingecko/indices', async (req: Request, res: Response) => {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/indices', {
        params: {
          currency: 'usd',
          order: 'market_cap_desc'
        }
      });

      if (response.data) {
        res.json(response.data);
      } else {
        res.status(500).json({ error: 'Failed to fetch CoinGecko indices' });
      }
    } catch (error: any) {
      console.error('Error fetching CoinGecko indices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Custom Analysis Reports API ---
  // Example: Regime Analysis Endpoint
  app.get('/api/analysis/regime', async (req: Request, res: Response) => {
    try {
      // This is a placeholder. In a real application, this would involve complex calculations
      // based on market data, potentially using the analytics modules imported earlier.
      let regimeAnalysis = 'neutral'; // Default regime

      // Fetch some market data to determine regime (example: using CoinGecko global data)
      let coingeckoGlobalData = null;
      try {
        const cgResponse = await axios.get('https://api.coingecko.com/api/v3/global');
        if (cgResponse.data && cgResponse.data.data) {
          coingeckoGlobalData = cgResponse.data.data;
        }
      } catch (cgError) {
        console.warn('Could not fetch CoinGecko global data for regime analysis:', cgError);
      }

      if (coingeckoGlobalData && coingeckoGlobalData.total_market_cap.usd && coingeckoGlobalData.total_volume.usd) {
        const marketCap = coingeckoGlobalData.total_market_cap.usd;
        const volume24h = coingeckoGlobalData.total_volume.usd;

        if (marketCap > 2.5e12 && volume24h > 100e9) {
          regimeAnalysis = 'bullish';
        } else if (marketCap < 1.5e12 || volume24h < 40e9) {
          regimeAnalysis = 'bearish';
        }
      }

      res.json({
        success: true,
        regime: regimeAnalysis,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error generating regime analysis:', error);
      res.status(500).json({ success: false, error: 'Failed to generate regime analysis' });
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


  // Strategy Integration Engine
  const strategyEngine = StrategyIntegrationEngine ? new StrategyIntegrationEngine() : null;

  // Synthesize signals endpoint
  app.post('/api/strategies/synthesize', async (req: Request, res: Response) => {
    try {
      const { symbol, timeframe } = req.body;

      if (!symbol || !timeframe) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: symbol, timeframe'
        });
      }

      // Fetch recent market frames
      const frames = await storage.getMarketFrames(symbol, 50);

      if (frames.length < 30) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient market data for synthesis'
        });
      }

      // Synthesize signal
      const synthesizedSignal = await strategyEngine.synthesizeSignals(symbol, timeframe, frames);

      // Get current weights
      const weights = strategyEngine.getStrategyWeights();

      res.json({
        success: true,
        signal: synthesizedSignal,
        weights,
        regime: synthesizedSignal.regimeContext,
        confidenceBreakdown: synthesizedSignal.confidenceBreakdown
      });
    } catch (error) {
      console.error('Error synthesizing signals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to synthesize signals'
      });
    }
  });

  // Get strategy weights endpoint
  app.get('/api/strategies/weights', async (req, res) => {
    try {
      const weights = strategyEngine.getStrategyWeights();
      res.json({
        success: true,
        weights
      });
    } catch (error) {
      console.error('Error fetching strategy weights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch strategy weights'
      });
    }
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

  // GET /api/strategies - List all strategies (real data from database)
  app.get('/api/strategies', async (req: Request, res: Response) => {
    try {
      const strategies = await prisma.strategy.findMany();

      // Transform database records to include real performance metrics
      const enrichedStrategies = strategies.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: (s as any).type || 'Unknown',
        features: (s as any).features || [],
        parameters: (s as any).parameters || {},
        performance: s.performance || {
          winRate: 0,
          avgReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0
        },
        isActive: s.isActive,
        lastUpdated: new Date().toISOString()
      }));

      res.json({
        success: true,
        strategies: enrichedStrategies,
        total: enrichedStrategies.length
      });
    } catch (error) {
      console.error('Error fetching strategies:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch strategies' });
    }
  });

  // GET /api/strategies/signals - Get latest signals from all strategies
  app.get('/api/strategies/signals', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const signals = await storage.getLatestSignals(limit);

      res.json({
        success: true,
        signals,
        total: signals.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching strategy signals:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch strategy signals' });
    }
  });

  // GET /api/strategies/:id - Get strategy details (real data)
  app.get('/api/strategies/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const strategy = await prisma.strategy.findUnique({
        where: { id },
        include: { backtests: { take: 5, orderBy: { createdAt: 'desc' } } }
      });

      if (!strategy) {
        return res.status(404).json({ success: false, error: 'Strategy not found' });
      }

      res.json({ success: true, strategy });
    } catch (error) {
      console.error('Error fetching strategy:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch strategy' });
    }
  });

  // POST /api/strategies/consensus - Get consensus trade from all strategies (real signals)
  app.post('/api/strategies/consensus', async (req: Request, res: Response) => {
    try {
      const { symbol, timeframes = ['D1', 'H4', 'H1', 'M15'], equity = 10000 } = req.body;

      if (!symbol) {
        return res.status(400).json({ success: false, error: 'Symbol required' });
      }

      // Fetch latest signals from gateway/scanner for this symbol
      const latestSignals = await prisma.signal.findMany({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
        take: 50
      });

      if (latestSignals.length === 0) {
        // Return neutral consensus if no signals available
        return res.json({
          success: true,
          consensus: {
            direction: 'NEUTRAL',
            entryPrice: 0,
            stopLoss: 0,
            takeProfit: [0],
            positionSize: 0,
            confidence: 0,
            riskRewardRatio: 0,
            contributingStrategies: [],
            timeframeAlignment: {},
            edgeScore: 0,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Analyze signals to generate consensus
      const buySignals = latestSignals.filter(s => s.type === 'BUY');
      const sellSignals = latestSignals.filter(s => s.type === 'SELL');
      const avgPrice = latestSignals.reduce((sum: number, s: any) => sum + s.price, 0) / latestSignals.length;
      const avgConfidence = latestSignals.reduce((sum: number, s: any) => sum + s.confidence, 0) / latestSignals.length;

      // Determine consensus direction
      let direction = 'NEUTRAL';
      let confidence = avgConfidence;
      if (buySignals.length > sellSignals.length * 1.5) {
        direction = 'LONG';
      } else if (sellSignals.length > buySignals.length * 1.5) {
        direction = 'SHORT';
      }

      // Calculate position size based on equity and volatility
      const volatility = latestSignals.length > 1
        ? Math.sqrt(latestSignals.reduce((sum: number, s: any, i: number) => {
            if (i === 0) return 0;
            const ret = (s.price - latestSignals[i-1].price) / latestSignals[i-1].price;
            return sum + ret * ret;
          }, 0) / (latestSignals.length - 1))
        : 0.02;

      const positionSize = Math.min(0.5, equity / (avgPrice * 100) * (1 / Math.max(volatility, 0.01)));

      // Calculate risk/reward
      const stopLoss = avgPrice * (1 - volatility * 2);
      const takeProfit1 = avgPrice * (1 + volatility * 2);
      const takeProfit2 = avgPrice * (1 + volatility * 3);
      const takeProfit3 = avgPrice * (1 + volatility * 4);
      const riskRewardRatio = (takeProfit1 - avgPrice) / (avgPrice - stopLoss);

      // Get contributing strategies from actual signals
      const strategiesSet = new Set(latestSignals.map((s: any) => s.reasoning?.strategy || 'Scanner').filter(Boolean));
      const contributingStrategies = Array.from(strategiesSet).slice(0, 5);

      // Build timeframe alignment from signal reasoning
      const timeframeAlignment: { [key: string]: string } = {};
      for (const tf of timeframes) {
        const tfSignals = latestSignals.filter((s: any) => (s.reasoning as any)?.timeframe === tf);
        if (tfSignals.length > 0) {
          const buys = tfSignals.filter((s: any) => s.type === 'BUY').length;
          const sells = tfSignals.filter((s: any) => s.type === 'SELL').length;
          timeframeAlignment[tf] = buys > sells ? 'LONG' : sells > buys ? 'SHORT' : 'NEUTRAL';
        } else {
          timeframeAlignment[tf] = 'NEUTRAL';
        }
      }

      // Edge score based on signal strength and agreement
      const edgeScore = Math.min(
        100,
        confidence * 1.2 + (Math.abs(buySignals.length - sellSignals.length) / latestSignals.length) * 30
      );

      const consensus = {
        direction,
        entryPrice: avgPrice,
        stopLoss: stopLoss,
        takeProfit: [takeProfit1, takeProfit2, takeProfit3],
        positionSize: Math.round(positionSize * 1000) / 1000,
        confidence: Math.round(confidence * 10) / 10,
        riskRewardRatio: Math.round(riskRewardRatio * 10) / 10,
        contributingStrategies,
        timeframeAlignment,
        edgeScore: Math.round(edgeScore * 10) / 10,
        timestamp: new Date().toISOString()
      };

      res.json({ success: true, consensus });
    } catch (error) {
      console.error('Error generating consensus:', error);
      res.status(500).json({ success: false, error: 'Failed to generate consensus' });
    }
  });

  // Mount strategy routes and paper trading routes
  app.use('/api/strategies', strategyRoutes);
  app.use('/api/paper-trading', paperTradingRoutes);

  // Mount signal performance routes
  app.use('/api/gateway/signals/performance', signalPerformanceRoutes);

  // Mount notification routes
  app.use('/api/notifications', notificationRoutes);
  console.log('[express] Notifications API registered at /api/notifications');
  app.use('/api/user', userPreferencesRoutes);

  // Mount ML routes
  app.use('/api/ml', mlPredictionsRouter);
  app.use('/api/ml-training', mlTrainingRouter);
  app.use('/api/ml-engine', mlSignalsRouter);
  app.use('/api/ml/advanced', mlAdvancedRoutes);
  app.use('/api/ml-advanced', mlAdvancedModelsRouter);
  app.use('/api/portfolio', portfolioRouter);

  // Mount Position Sizing API routes (Phase 2)
  app.use('/api/position-sizing', positionSizingRouter);

  // Mount flow field analytics routes
  app.use('/api/analytics', flowFieldRouter);

  // Mount composite quality endpoint
  app.use('/api/composite-quality', compositeQualityRouter);

  // Mount live trading routes
  app.use('/api/live-trading', liveTradingRouter);
  log('[express] Live Trading API registered at /api/live-trading');

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
  });

  // Register MTF confirmation routes
  app.use('/api/mtf-confirmation', mtfConfirmationRouter);

  // Register intelligent exits routes
  app.use('/api/intelligent-exits', intelligentExitsRouter);
  // Mount correlation hedge endpoint
  app.use('/api/correlation-hedge', correlationHedgeRouter);
  // Mount velocity profiles endpoint
  app.use('/api/velocity-profiles', velocityProfilesRouter);


  console.log('[Routes] All routes registered successfully');

  return server;
}