import type { Express, Request, Response } from "express";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { rlGuard } from './rl-guard';
import { z } from 'zod';
import { db } from './db-storage';
import axios from 'axios'; // Import axios for CoinGecko API calls
import { coinGeckoService } from './services/coingecko';
import { Router } from 'express'; // Import Router for dynamic route registration

// Import paper trading routes
import paperTradingRoutes from './routes/paper-trading';
// Import notification routes
import notificationRoutes from './routes/notifications';
// Import user preferences routes

// Import Symbol Universe routes
import symbolsRouter from './routes/symbols';
import watchlistsRouter from './routes/watchlists';
import assetsRouter from './routes/assets';

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
// Import composite quality routes
import compositeQualityRouter from './routes/composite-quality';

// Import Live Trading routes
import liveTradingRouter from './routes/live-trading';
import { requireTradingOperator } from './middleware/require-trading-operator';
import { requireAuth } from './middleware/auth';
import { auditOperatorAction } from './middleware/audit-operator-action';
import { respondToInvalidRouteParam } from './utils/route-params';

// Import Portfolio Risk and Source Analytics routes
import portfolioRiskRouter from './routes/portfolio-risk';
import sourceAnalyticsRouter from './routes/source-analytics';

// Import audit logs and model drift routes
import auditLogsRoutes from "./routes/audit-logs";
import adaptiveRoutes from "./routes/adaptive";
import modelDriftRoutes from "./routes/model-drift";

// Import diagnostics routes
import diagnosticsModeRouter from "./routes/diagnostics-mode";

// Import Position Sizing API routes (Phase 2)
import positionSizingRouter from './routes/position-sizing';

// Import MTF confirmation routes
import mtfConfirmationRouter from './routes/mtf-confirmation';
// Import intelligent exits routes
import intelligentExitsRouter from './routes/intelligent-exits';
// Import correlation hedge routes
import correlationHedgeRouter from './routes/correlation-hedge';
// Import RPG agents routes
import rpgAgents from './routes/rpg-agents';
// Import feature engineering routes
import featureEngineeringRouter from './routes/feature-engineering';

// Import signal archive routes
import signalArchiveRouter from './routes/signal-archive';
// Import correlation boost router
import correlationBoostRouter from './routes/correlation-boost';
// Import strategy deployment router
import strategyDeploymentRouter from './routes/strategy-deployment';
// Import agent signal insights router
import { apiRegistry } from './services/api-registry';
// Import scanner signal router
import scannerSignalRouter from './routes/scanner-signal';
import { symbolRegistry } from '../src/core/SymbolRegistry';

// Use shared db.prisma when available
const prisma: any = (db as any).prisma || null;

// Optional imports - only use if modules exist
let MirrorOptimizer: any, ScannerAgent: any, MLAgent: any;
let calculate_volume_profile: any, calculate_anchored_volume_profile: any, calculate_fixed_range_volume_profile: any;
let calculate_composite_score: any, calculate_volume_composite_score: any, calculate_confidence_score: any;
let calculate_value_area: any, calculate_poc: any;

// Explicitly type optional dynamic imports to avoid implicit 'any' locations
let runBacktest: ((opts: import('./backtest-runner').BacktestOptions) => Promise<import('./backtest-runner').BacktestResult>) | undefined = undefined;
let ExchangeDataFeed: (typeof import('./trading-engine').ExchangeDataFeed) | undefined = undefined;
let SignalEngine: (typeof import('./trading-engine').SignalEngine) | undefined = undefined;
let defaultTradingConfig: any = undefined;
let MLSignalEnhancer: (typeof import('./ml-engine').MLSignalEnhancer) | undefined = undefined;
let EnhancedMultiTimeframeAnalyzer: (typeof import('./multi-timeframe').EnhancedMultiTimeframeAnalyzer) | undefined = undefined;
let registerChartApi: ((app: import('express').Express) => void) | undefined = undefined;
let registerAdvancedIndicatorApi: ((app: import('express').Express) => void) | undefined = undefined;
let StrategyIntegrationEngine: (typeof import('./strategy-integration').StrategyIntegrationEngine) | undefined = undefined;
let velocityProfilesRouter: import('express').Router | undefined; // Declare velocityProfilesRouter here

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
  // REPLIT AUTH DISABLED FOR TESTING
  // import { setupAuth, isAuthenticated, getUser, getUserPreferences, updateUserPreferences, getApiKeys, addApiKey, deleteApiKey } from './replitAuth';

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
    // await setupAuth(app); // DISABLED FOR TESTING

    // AUTHROUTES DISABLED FOR TESTING
    // Mock user for development
    const mockUser = {
      id: 'dev-user-001',
      email: 'dev@test.com',
      firstName: 'Dev',
      lastName: 'User',
      profileImageUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        theme: 'dark',
        defaultTimeframe: '1h',
        defaultExchange: 'binance',
        notificationsEnabled: true,
        emailAlerts: false,
        priceAlerts: true,
        signalAlerts: true,
        soundEnabled: true,
      }
    };

    app.get('/api/auth/user', async (req: any, res: Response) => {
      res.json(mockUser);
    });

    try {
      apiRegistry.registerEndpoint({ method: 'GET', path: '/api/auth/user', category: 'CORE', name: 'Get Current User', description: 'Return current authenticated user (mock)', version: '1.0.0', tags: ['auth','user'], isDeprecated: false, authentication: 'NONE', cacheable: false, isActive: true });
    } catch (e) {
      console.warn('[APIRegistry] Failed to register /api/auth/user', e);
    }

    app.get('/api/user/preferences', async (req: any, res: Response) => {
      res.json(mockUser.preferences);
    });

    app.patch('/api/user/preferences', async (req: any, res: Response) => {
      res.json({ ...mockUser.preferences, ...req.body });
    });

    app.get('/api/user/api-keys', async (req: any, res: Response) => {
      res.json([]);
    });

    app.post('/api/user/api-keys', async (req: any, res: Response) => {
      res.json({ id: 'mock-key', ...req.body });
    });

    app.delete('/api/user/api-keys/:keyId', async (req: any, res: Response) => {
      res.json({ success: true });
    });

    app.get('/api/user/watchlist', async (req: any, res: Response) => {
      res.json([]);
    });

    // RL Guard status for monitoring
    app.get('/api/rl/guard-status', async (_req: Request, res: Response) => {
      try {
        const status = rlGuard.getStatus();
        res.json({ ok: true, status });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    // Diagnostics: LiveEpoch and TimeAnchor dump
    app.get('/api/diagnostics/time-anchors', async (_req: Request, res: Response) => {
      try {
        const { dumpLiveEpochDiagnostics } = await import('./services/market-data/integrity-gate');
        const { getTimeAnchorManager } = await import('./services/market-data/time-anchor');
        const { getModeDetector } = await import('./services/market-data/mode-detector');

        const live = dumpLiveEpochDiagnostics();
        const anchorMgr = getTimeAnchorManager();
        const anchors = typeof anchorMgr.diagnostics === 'function' ? anchorMgr.diagnostics() : { note: 'no diagnostics available' };
        const mode = getModeDetector().getMetrics ? getModeDetector().getMetrics() : { backfillComplete: 'unknown' };

        res.json({ ok: true, liveEpoch: live, anchors, mode });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: (err as any)?.message || err });
      }
    });

    // Trace retrieval: return full artifact chain for a given trace id
    app.get('/api/trace/:traceId', async (req: Request, res: Response) => {
      try {
        const traceId = Array.isArray(req.params.traceId) ? req.params.traceId[0] : req.params.traceId;
        if (!traceId) return res.status(400).json({ ok: false, error: 'traceId required' });
        const trace = await storage.getTraceChain(traceId);
        res.json({ ok: true, trace });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: (err as any).message || err });
      }
    });

    app.post('/api/user/watchlist', async (req: any, res: Response) => {
      res.json({ id: 'mock-item', ...req.body });
    });

    app.delete('/api/user/watchlist/:id', async (req: any, res: Response) => {
      res.json({ success: true });
    });

    // Register signal quality routes
    app.use('/api/signals', signalQualityRouter);

    // Register agent signal insights routes

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

  // List all assets and their latest performance/metrics
app.get('/api/assets/performance', async (req: Request, res: Response) => {
  const prismaLocal: any = prisma;
  try {
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
    let symbols: { symbol: string }[] = await prismaLocal.marketFrame.findMany({
      distinct: ['symbol'],
      select: { symbol: true },
    });
    if (symbol) {
      const symbolArr = Array.isArray(symbol) ? symbol : [symbol];
      symbols = symbols.filter(s => symbolArr.includes(s.symbol));
    }
    // For each symbol, get the latest and previous market frame for metrics
    let results = (await Promise.all(symbols.map(async (row: { symbol: string }) => {
      const latest = await prismaLocal.marketFrame.findFirst({
        where: { symbol: row.symbol },
        orderBy: { timestamp: 'desc' },
      });
      if (!latest) return null;
      // Previous close for percent change
      const prev = await prismaLocal.marketFrame.findFirst({
        where: { symbol: row.symbol, NOT: { timestamp: latest.timestamp } },
        orderBy: { timestamp: 'desc' },
      });
      const close = latest.price?.close ?? 0;
      const prevClose = prev?.price?.close ?? close;
      const percentChange = prevClose !== 0 ? ((close - prevClose) / prevClose) * 100 : 0;
      // Volatility: stddev of close over last 10 frames
      const last10 = await prismaLocal.marketFrame.findMany({
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
      const last7 = await prismaLocal.marketFrame.findMany({
        where: { symbol: row.symbol },
        orderBy: { timestamp: 'desc' },
        take: 7
      });
      const last30 = await prismaLocal.marketFrame.findMany({
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
    try { if ((db as any).prisma && typeof (db as any).prisma.$disconnect === 'function') await (db as any).prisma.$disconnect(); } catch (_) {}
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
  // COMMENTED OUT - Routes are already registered with full paths at line 1099
  // if (coinGeckoChartRouter) {
  //   try {
  //     app.use(coinGeckoChartRouter);
  //     console.log('[INIT] CoinGecko chart API registered');
  //   } catch (error) {
  //     console.warn('CoinGecko chart API could not be registered:', error);
  //   }
  // }

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
          try {
            // Seed SymbolRegistry from loaded exchange markets to avoid waiting for discovery
            symbolRegistry.populateFromExchanges(exchangeDataFeed.exchanges);
            console.log('[INIT] SymbolRegistry seeded from ExchangeDataFeed:', symbolRegistry.getAll().length, 'symbols');
          } catch (e) { console.warn('[INIT] Could not seed SymbolRegistry from ExchangeDataFeed', (e as any)?.message || e); }
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
        const data = await coinGeckoService.getGlobalMarket({ timeout: 8000, retries: 3 });
        coingeckoGlobalData = data;
      } catch (error: any) {
        console.warn('[MarketIntel] CoinGecko global data fetch failed:', error.message);
      }

      // Fetch top 100 coins with multi-timeframe price changes for gainers/losers
      let marketData: any[] = [];
      try {
        marketData = await coinGeckoService.getMarketData('usd', 1, 100);
      } catch (error: any) {
        console.warn('[MarketIntel] CoinGecko market data fetch failed:', error.message);
      }

      // Fetch trending coins
      let trendingCoins: any[] = [];
      try {
        const trending = await coinGeckoService.getTrendingCoins();
        trendingCoins = (trending || []).map((coin: any) => ({
          id: coin.item.id,
          name: coin.item.name,
          symbol: coin.item.symbol.toUpperCase(),
          marketCapRank: coin.item.market_cap_rank,
          thumb: coin.item.thumb,
          score: coin.item.score,
          priceChange24h: coin.item.data?.price_change_percentage_24h?.usd || 0
        }));
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
      const data = await coinGeckoService.getMarketData('usd', 1, 250);
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching CoinGecko all data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // This endpoint will fetch specific coin data
  app.get('/api/coingecko/coin/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const { vs_currency = 'usd' } = req.query;
      const details = await coinGeckoService.getCoinDetails(idStr);
      if (details) {
        res.json(details);
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
      const data = await coinGeckoService.getCategories();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching CoinGecko categories:', error);
      res.status(500).json({ error: error.message });
    }
    });

  // This endpoint will fetch CoinGecko exchanges
  app.get('/api/coingecko/exchanges', async (req: Request, res: Response) => {
    try {
      const data = await coinGeckoService.getExchanges(1, 250);
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching CoinGecko exchanges:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // This endpoint will fetch CoinGecko indices
  app.get('/api/coingecko/indices', async (req: Request, res: Response) => {
    try {
      const data = await coinGeckoService.getIndices();
      res.json(data);
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
        const cgData = await coinGeckoService.getGlobalMarket({ timeout: 8000, retries: 3 });
        coingeckoGlobalData = cgData;
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
      const { signals, marketFrames, initialCapital, slippage, commission } = req.body;
      const results = await runBacktest({ signals, marketFrames, initialCapital, slippage, commission });
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
      if (respondToInvalidRouteParam(err, res)) return;
      console.error(err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    });


  // Strategy Integration Engine
  const strategyEngine = StrategyIntegrationEngine ? new StrategyIntegrationEngine() : null;

  // If a MirrorOptimizer instance exists, provide it with the shared StrategyIntegrationEngine
  try {
    if (optimizer && typeof (optimizer as any).setStrategyEngine === 'function') {
      (optimizer as any).setStrategyEngine(strategyEngine);
    }
  } catch (e) { /* ignore */ }
  // Synthesize signals endpoint
  app.post(
    '/api/strategies/synthesize',
    // Analytical only: this returns synthesized output without persisting a signal
    // or mutating/feeding live or paper engine state.
    requireAuth,
    auditOperatorAction('signal_generate', {
      target: (req) => typeof req.body?.symbol === 'string' ? req.body.symbol.slice(0, 32) : undefined,
    }),
    async (req: Request, res: Response) => {
    try {
      const { symbol, timeframe } = req.body;

      if (
        typeof symbol !== 'string' ||
        symbol.trim().length === 0 ||
        symbol.length > 32 ||
        typeof timeframe !== 'string' ||
        !new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']).has(timeframe)
      ) {
        return res.status(400).json({
          success: false,
          error: 'symbol and timeframe must be bounded and valid'
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

      // Ensure strategy engine is available
      if (!strategyEngine) {
        return res.status(501).json({ success: false, error: 'Strategy engine not available' });
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
    },
  );

  // Get strategy weights endpoint
  app.get('/api/strategies/weights', async (req, res) => {
    try {
      if (!strategyEngine) {
        return res.status(501).json({ success: false, error: 'Strategy engine not available' });
      }
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

  // The legacy strategy router remains disabled until its subprocess work,
  // signal writes, and consumer relationship have complete route-level review.
  app.use('/api/paper-trading', paperTradingRoutes);

  // Mount Symbol Universe routes
  app.use('/api/symbols', symbolsRouter);
  app.use('/api/watchlists', watchlistsRouter);
  app.use('/api/assets', assetsRouter);
  console.log('[express] Symbol Universe APIs registered at /api/symbols, /api/watchlists, /api/assets');

  // Mount notification routes
  app.use('/api/notifications', notificationRoutes);
  console.log('[express] Notifications API registered at /api/notifications');

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
  console.log('[express] Live Trading API registered at /api/live-trading');

  // Liveness only: process is up and the event loop is responsive. Real health
  // and readiness live on the /api/health router (see routes/health.ts), which
  // reports subsystem state and fails a probe when storage or integrity is bad.
  app.get('/api/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'UP', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  try {
    apiRegistry.registerEndpoint({ method: 'GET', path: '/api/health', category: 'CORE', name: 'Health Check', description: 'Service health check', version: '1.0.0', tags: ['core','health'], isDeprecated: false, authentication: 'NONE', cacheable: false, isActive: true });
  } catch (e) {
    console.warn('[APIRegistry] Failed to register /api/health', e);
  }

  // Read-only regime analysis endpoint
  // Example: GET /api/analysis/regime?symbol=BTC/USDT&timeframe=60
  app.get('/api/analysis/regime', async (req: Request, res: Response) => {
    const symbol = (req.query.symbol as string) || (req.query.s as string);
    const timeframe = Number(req.query.timeframe || req.query.tf || 60);

    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Missing symbol query param' });
    }

    try {
      const { getRegimeService } = await import('./services/regime-service');
      const regimeSvc = getRegimeService();
      const regime = await regimeSvc.computeRegime(symbol, timeframe);
      if (!regime) return res.status(204).json({ success: true, regime: null });
      return res.json({ success: true, regime });
    } catch (error: any) {
      console.error('[routes] /api/analysis/regime error:', error?.message || error);
      return res.status(500).json({ success: false, error: 'Failed to compute regime' });
    }
  });

  try {
    apiRegistry.registerEndpoint({ method: 'GET', path: '/api/analysis/regime', category: 'ANALYTICS', name: 'Regime Analysis', description: 'Compute market regime for a symbol/timeframe', version: '1.0.0', tags: ['analysis','regime'], isDeprecated: false, authentication: 'NONE', cacheable: true, cacheTTLSeconds: 5, isActive: true });
  } catch (e) {
    console.warn('[APIRegistry] Failed to register /api/analysis/regime', e);
  }

  // Register MTF confirmation routes
  app.use('/api/mtf-confirmation', mtfConfirmationRouter);
  // Mount position sizing v2 endpoint
  app.use('/api/position-sizing-v2', positionSizingRouter); // Assuming positionSizingRouter is intended for v2 as well
  // (live trading routes are mounted once, above)

  // Register portfolio risk and source analytics routes
  app.use('/api/portfolio-risk', portfolioRiskRouter);
  app.use('/api/source-analytics', sourceAnalyticsRouter);

  // Import and register signal archive routes
  app.use("/api/signal-archive", signalArchiveRouter);
  app.use("/api/strategy-deployment", strategyDeploymentRouter);
  app.use("/api/correlation-boost", correlationBoostRouter);
  app.use("/api/audit-logs", auditLogsRoutes);
  app.use('/api/adaptive', adaptiveRoutes);
  app.use("/api/model-drift", modelDriftRoutes);
  
  // 🔄 Register mode diagnostics routes
  app.use("/api/diagnostics", diagnosticsModeRouter);
  
  // Mount RPG agents routes
  app.use('/api/rpg-agents', rpgAgents);
  // Mount feature engineering routes
  app.use('/api/feature-engineering', featureEngineeringRouter);
  // Mount scanner signal routes
  app.use('/api/scanner', scannerSignalRouter);

  console.log('[Routes] All routes registered successfully');

  return server;
}