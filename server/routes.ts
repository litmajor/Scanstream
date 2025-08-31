import { MirrorOptimizer, ScannerAgent, MLAgent } from './bayesian-optimizer';
import {
  calculate_volume_profile,
  calculate_anchored_volume_profile,
  calculate_fixed_range_volume_profile,
  calculate_composite_score,
  calculate_volume_composite_score,
  calculate_confidence_score,
  calculate_value_area,
  calculate_poc
} from './analytics-utils';


import type { Express, Request, Response } from "express";
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMarketFrameSchema, insertSignalSchema, insertTradeSchema, insertBacktestResultSchema } from "@shared/schema";
import { z } from 'zod';
import { runBacktest } from './backtest-runner';
import { ExchangeDataFeed, SignalEngine, defaultTradingConfig } from './trading-engine';
import { MLSignalEnhancer } from './ml-engine';
import { EnhancedMultiTimeframeAnalyzer } from './multi-timeframe';
import { PrismaClient } from '@prisma/client';


import { registerChartApi } from './chart-api';
// Import registerAdvancedIndicatorApi at the top
import { registerAdvancedIndicatorApi } from './advanced-indicator-api';





  // For hot-reload DX, use tsx --watch or nodemon --exec node -r esbuild-register
  // npm i cors helmet express-rate-limit
  export async function registerRoutes(app: Express): Promise<Server> {
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



  // Register chart and advanced indicator APIs
  registerChartApi(app);
  registerAdvancedIndicatorApi(app);

    // Initialize engines
  const exchangeDataFeed = await ExchangeDataFeed.create();
    const signalEngine = new SignalEngine(defaultTradingConfig);
    const mlEnhancer = new MLSignalEnhancer();
    const multiTimeframeAnalyzer = new EnhancedMultiTimeframeAnalyzer(signalEngine);
    const optimizer = new MirrorOptimizer();
  optimizer.registerAgent('scanner', await ScannerAgent.create());
    optimizer.registerAgent('ml', new MLAgent());

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
      const { calculateSignalStrength } = await import('./lib/signal-strength');
      const score = calculateSignalStrength(momentumShort, momentumLong, rsi, macd, volumeRatio ?? 1.0);
      res.json({ score });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


    // ...all other app.get/app.post route registrations and logic go here...

    // Global error handler middleware
    app.use((err: any, _req: Request, res: Response, _next: any) => {
      console.error(err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    });


  // At the end, create and return the httpServer:
  const httpServer = createServer(app);

  // WebSocket server for real-time data on a separate port
  const wsPort = 8765;
  const wsServer = createServer();
  wsServer.listen(wsPort, () => {
    console.log(`WebSocket server listening on ws://localhost:${wsPort}`);
  });
  const wss = new WebSocketServer({ server: wsServer, path: '/ws' });

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

    ws.on('message', (msg) => {
      try {
        const strMsg = typeof msg === 'string' ? msg : msg.toString();
        const data = JSON.parse(strMsg);
        if (data.type === 'set_exchange' && typeof data.exchange === 'string') {
          clientExchange = data.exchange;
          ws.send(JSON.stringify({ type: 'exchange_set', exchange: clientExchange }));
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    // Real-time market data updates using ExchangeDataFeed (parallel fetch)
    const marketDataInterval = setInterval(async () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Use correct symbols for kucoinfutures, fallback to spot symbols for others
          let symbols: string[];
          if (clientExchange === 'kucoinfutures') {
            symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT'];
          } else {
            symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
          }
          const results = await Promise.all(symbols.map(async (symbol) => {
            const frames = await exchangeDataFeed.fetchMarketData(symbol, '1m', 1, clientExchange);
            if (frames.length === 0) return null;
            const marketFrame = frames[0];
            await storage.createMarketFrame(marketFrame);
            ws.send(JSON.stringify({
              type: 'market_data',
              data: marketFrame
            }));

            // Generate signal using SignalEngine
            const index = frames.length - 1;
            const signal = await signalEngine.generateSignal(frames, index);
            if (signal) {
              await storage.createSignal(signal);
              ws.send(JSON.stringify({
                type: 'signal',
                data: signal
              }));
            }
            return marketFrame;
          }));
        } catch (error) {
          console.error('Error sending market data:', error);
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

