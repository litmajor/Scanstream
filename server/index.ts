import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import flowFieldRouter from "./routes/flow-field";
import flowFieldBacktestRouter from "./routes/flow-field-backtest";
// Removed fastScannerRouter import
import coinGeckoRouter from "./routes/coingecko";
import enhancedAnalyticsRouter from "./routes/enhanced-analytics";
import mlPredictionsRouter from './routes/ml-predictions';
import mlTrainingRouter from './routes/ml-training';
import analyticsRouter from './routes/analytics';
import mlSignalsRouter from './routes/ml-signals';
import rlSignalsRouter from './routes/rl-signals';
import { registerMLLSTMRoutes } from './routes/ml-lstm';
import paperTradingRouter from './routes/paper-trading';
import scannerRouter from './routes/scanner';
import scannerAnalysisRouter from './routes/scanner-analysis';
import physicsAgentsRouter from './routes/physics-agents';
// Removed fastScanner service import

// Commander System imports
import { setupCommanderRoutes } from './routes/commander';
import { CommanderApprovalSystem } from './services/rpg-agents/CommanderApprovalSystem';
import { DailyBriefingSystem } from './services/rpg-agents/DailyBriefingSystem';

// Learning System imports
import { BayesianBeliefUpdater } from './services/bayesian-belief-updater';
import { LearningSystemIntegration } from './services/learning-system-integration';
import { RLPositionAgent } from './rl-position-agent';

// Cross-exchange aggregator & agents
import { CrossExchangeAggregator } from './services/aggregator/cross-exchange-aggregator';
import { DiscoveryAgent } from './agents/discovery-agent';
import { ArbitrageAgent } from './agents/arbitrage-agent';
import { PortfolioAgent } from './agents/portfolio-agent';

// Enable debug logging
process.env.DEBUG = 'express:*,server:*';

// Global learning system instance
let globalLearningSystem: LearningSystemIntegration | null = null;

export function getLearningSystem(): LearningSystemIntegration | null {
  return globalLearningSystem;
}

// Global Market Data Layer instance
let globalMarketDataLayer: any = null;

export function getMarketDataLayer(): any {
  return globalMarketDataLayer;
}

const app = express();
app.set('x-powered-by', false); // Disable X-Powered-By header

// Add request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Enable trust proxy for Replit's proxied environment (required for rate limiter)
app.set('trust proxy', 1);

// Global debug logging for all route registrations (with types)
const origAppUse = app.use;
app.use = function (path: any, ...args: any[]): any {
  if (typeof path === "string") {
    console.log("[DEBUG] app.use path:", path);
  }
  return (origAppUse as any).apply(this, [path, ...args]);
};
(["get", "post", "put", "delete", "patch", "all"] as const).forEach((method) => {
  const orig = (app as any)[method];
  (app as any)[method] = function (path: any, ...args: any[]): any {
    if (typeof path === "string") {
      console.log(`[DEBUG] app.${method} path:`, path);
    }
    return orig.call(this, path, ...args);
  };
});

// Serve frontend config
import path from 'path';
app.get('/config/frontend-config.json', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'config', 'frontend-config.json'));
});

// Register Flow Field analytics routes
app.use('/api/analytics', flowFieldRouter);
app.use('/api/analytics', flowFieldBacktestRouter);

// Register Enhanced Analytics (with CoinGecko sentiment)
app.use('/api/analytics', enhancedAnalyticsRouter);

// Removed Fast Scanner routes registration
// app.use('/api/scanner', fastScannerRouter);

// Register Scanner routes
app.use('/api/scanner', scannerRouter);
app.use('/api/scanner', scannerAnalysisRouter);
console.log('[express] Scanner API registered at /api/scanner');
console.log('[express] Scanner Analysis API registered at /api/scanner');

// Register CoinGecko sentiment & market data routes
app.use('/api/coingecko', coinGeckoRouter);
// Register Symbol Universe API
import symbolUniverseRouter from './routes/api/symbol-universe';
app.use('/api/symbol-universe', symbolUniverseRouter);
console.log('[express] Symbol Universe API registered at /api/symbol-universe');

// Register ML Predictions routes
app.use('/api/ml', mlPredictionsRouter);
console.log('[express] ML Predictions API registered at /api/ml/predictions');

// Register ML Training routes
app.use('/api/ml', mlTrainingRouter);
console.log('[express] ML Training API registered at /api/ml/training');

// Register ML LSTM routes (training + inference for consensus)
registerMLLSTMRoutes(app);
console.log('[express] ML LSTM API registered at /api/ml/lstm/*');

// Register Live Velocity Calculator routes
import liveVelocityRouter, { initializeLiveVelocityRoutes } from './routes/live-velocity';
app.use('/api/velocity', liveVelocityRouter);
console.log('[express] Live Velocity API registered at /api/velocity');

// Initialize live velocity calculator
initializeLiveVelocityRoutes().catch(error => {
  console.warn('[express] Failed to initialize live velocity routes:', error);
});

app.use('/api/analytics', analyticsRouter);
console.log('[express] Analytics API registered at /api/analytics');

// Register ML and RL signal routes
app.use('/api/ml-engine', mlSignalsRouter);
console.log('[express] ML Signals API registered at /api/ml-engine');
app.use('/api/rl-agent', rlSignalsRouter);
console.log('[express] RL Signals API registered at /api/rl-agent');

// Register paper trading routes
app.use('/api/paper-trading', paperTradingRouter);
console.log('[express] Paper Trading API registered at /api/paper-trading');

// Register Physics Agents (VFMD and Flow) routes
app.use('/api/agents/physics', physicsAgentsRouter);
console.log('[express] Physics Agents API registered at /api/agents/physics');

// Register Exit Agents routes (Orchestrator, Opposition, Microstructure)
import exitAgentsRouter from './routes/exit-agents';
app.use('/api/agents/exit', exitAgentsRouter);
console.log('[express] Exit Agents API registered at /api/agents/exit');

// Register Scout Report routes (Phase 2)
import scoutReportRouter from './routes/scout-report-routes';
app.use('/api/scout', scoutReportRouter);
console.log('[express] Scout Report API registered at /api/scout');

// Register Agent Interactions & Visualization routes
import agentInteractionsRouter from './routes/agent-interactions';
app.use('/api/agents/interactions', agentInteractionsRouter);
console.log('[express] Agent Interactions API registered at /api/agents/interactions');

// Register Agent Signal Insights routes
import agentSignalInsightsRouter from './routes/agent-signal-insights';
app.use('/api/agents/signals', agentSignalInsightsRouter);
console.log('[express] Agent Signal Insights API registered at /api/agents/signals');

// Register Optimization routes
import optimizationRouter from './routes/optimization';
app.use('/api/optimize', optimizationRouter);
console.log('[express] Optimization API registered at /api/optimize');

// Register Model Performance & Backtesting routes
import modelPerformanceRouter from './routes/model-performance';
app.use('/api/model-performance', modelPerformanceRouter);
console.log('[express] Model Performance API registered at /api/model-performance');

// Register Signal Backtesting routes
import backtestingRouter from './routes/signal-backtesting';
import historicalBacktestRouter from './routes/historical-backtest';
app.use('/api/backtest', backtestingRouter);
app.use('/api/backtest', historicalBacktestRouter);
console.log('[express] Signal Backtesting API registered at /api/backtest');
console.log('[express] Historical Backtesting API registered at /api/backtest/historical');

// Register User Settings routes
import userSettingsRouter from './routes/user-settings';
app.use('/api/user', userSettingsRouter);
console.log('[express] User Settings API registered at /api/user');

  // Register Health Check route
  import healthRouter from './routes/health';
  app.use('/api/health', healthRouter);
  console.log('[express] Health Check API registered at /api/health');

  // Register Learning System routes
  const learningRouter = express.Router();
  
  learningRouter.get('/status', (req, res) => {
    if (!globalLearningSystem) {
      return res.status(503).json({ error: 'Learning system not initialized' });
    }
    const stats = globalLearningSystem.get_learning_stats();
    res.json({ status: 'ok', data: stats, timestamp: new Date() });
  });
  
  learningRouter.get('/beliefs', (req, res) => {
    if (!globalLearningSystem) {
      return res.status(503).json({ error: 'Learning system not initialized' });
    }
    const beliefs = globalLearningSystem.get_strategy_beliefs();
    res.json({ status: 'ok', data: beliefs, timestamp: new Date() });
  });
  
  learningRouter.get('/evidence-log', (req, res) => {
    if (!globalLearningSystem) {
      return res.status(503).json({ error: 'Learning system not initialized' });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const log = globalLearningSystem.get_recent_learning_updates(limit);
    res.json({ status: 'ok', data: log, count: log.length, timestamp: new Date() });
  });
  
  learningRouter.get('/recommendations', (req, res) => {
    if (!globalLearningSystem) {
      return res.status(503).json({ error: 'Learning system not initialized' });
    }
    const recommendations = globalLearningSystem.get_system_recommendations();
    res.json({ status: 'ok', data: recommendations, timestamp: new Date() });
  });
  
  app.use('/api/learning', learningRouter);
  console.log('[express] Learning System API registered at /api/learning');// Register Multi-Timeframe Analysis routes
import multiTimeframeRouter from './routes/multi-timeframe-analysis';
app.use('/api/analysis/multi-timeframe', multiTimeframeRouter);
console.log('[express] Multi-Timeframe Analysis API registered at /api/analysis/multi-timeframe');

// Register Gateway routes
import gatewayRouter, { getGatewayServices } from './routes/gateway';
app.use('/api/gateway', gatewayRouter);
console.log('[express] Gateway API registered at /api/gateway');

// ============================================================================
// PHASE 5: FRONTEND VISUALIZATION & TRANSPARENCY API
// ============================================================================
import phase5Routes from './routes/phase5-api';
app.use('/api/phase5', phase5Routes);
console.log('[express] Phase 5 Frontend Visualization API registered at /api/phase5');
console.log('[express]   - signal-transparency: Real-time 4-source breakdown');
console.log('[express]   - agent-leaderboard: 5 RPG agents with live metrics');
console.log('[express]   - signal-history: Paginated signal history with filtering');
console.log('[express]   - regime: Current market regime and adaptive weights');

// ============================================================================
// PHASE 6: UNIFIED BACKTEST HUB API
// ============================================================================
import phase6UnifiedBacktestRouter from './routes/phase6-unified-backtest';
app.use('/api/backtest', phase6UnifiedBacktestRouter);
console.log('[express] Phase 6 Unified Backtest API registered at /api/backtest');
console.log('[express]   - unified/run: Multi-asset, multi-signal, ensemble backtesting');
console.log('[express]   - unified/assets: Available assets for backtesting');
console.log('[express]   - unified/signal-sources: ML, Scanner, RL, RPG sources');
console.log('[express]   - unified/agents: 5 trading agents');
console.log('[express]   - unified/strategies: 6+ trading strategies');
console.log('[express]   - unified/configurations: Saved backtest configurations');
console.log('[express]   - unified/results: Backtest results with filtering');

// Register Capability Measurement routes (Phase 1: Cluster, Position Sizing, Voting)
import capabilityMeasurementRouter from './routes/capability-measurement';
app.use('/api/backtest', capabilityMeasurementRouter);
console.log('[express] Capability Measurement API registered at /api/backtest');
console.log('[express]   - capability-measurement/run: Full measurement suite');
console.log('[express]   - capability-measurement/compare-voting-methods: Voting comparison');
console.log('[express]   - capability-measurement/cluster-impact: Cluster validation impact');
console.log('[express]   - capability-measurement/position-sizing-impact: Position sizing impact');

// Register Velocity Profile routes (Phase 2: Asset Velocity-Based Position Sizing)
import velocityProfileRouter from './routes/velocity-profile';
app.use('/api/backtest', velocityProfileRouter);
console.log('[express] Velocity Profile API registered at /api/backtest');
console.log('[express]   - velocity-profile/run: Full velocity profile measurement');
console.log('[express]   - velocity-profile/compare-strategies: Strategy comparison');
console.log('[express]   - velocity-profile/analyze-velocity: Velocity analysis');
console.log('[express]   - velocity-profile/metrics: Metrics explanation');

// Register Adaptive Holding routes (Phase 3a: Adaptive Holding Periods)
import adaptiveHoldingRouter from './routes/adaptive-holding';
app.use('/api/backtest', adaptiveHoldingRouter);
console.log('[express] Adaptive Holding API registered at /api/backtest');
console.log('[express]   - adaptive-holding/run: Full adaptive holding measurement');
console.log('[express]   - adaptive-holding/analyze-flow: Institutional flow analysis');
console.log('[express]   - adaptive-holding/compare-strategies: Strategy comparison');
console.log('[express]   - adaptive-holding/metrics: Metrics explanation');

// Register Agent Clustering routes (Phase 3b: Agent Clustering + Specialized Routing)
import agentClusteringRouter from './routes/agent-clustering';
app.use('/api/backtest', agentClusteringRouter);
console.log('[express] Agent Clustering API registered at /api/backtest');
console.log('[express]   - agent-clustering/run: Full clustering analysis');
console.log('[express]   - agent-clustering/compare-routing: Specialist vs general routing');
console.log('[express]   - agent-clustering/analyze-impact: Clustering impact analysis');
console.log('[express]   - agent-clustering/metrics: Metrics explanation');
console.log('[express]   - agent-clustering/agents: Agent profiles and specializations');

// Register Complete Signal Generation routes (regime-aware unified pipeline)
import signalGenerationRouter from './routes/api/signal-generation';
app.use('/api/signal-generation', signalGenerationRouter);
console.log('[express] Complete Signal Generation API registered at /api/signal-generation');

// Register Trade Execution routes (Loss Limiter, Drawdown Monitor, Win Amplifier)
import tradeExecutionRouter from './routes/trade-execution';
app.use('/api/execution', tradeExecutionRouter);
console.log('[express] Trade Execution API registered at /api/execution');

// Initialize WebSocket service for real-time signal streaming
import { signalWebSocketService } from './services/websocket-signals';
import { signalPriceMonitor } from './services/signal-price-monitor';
import { initializeMarketDataFetcher } from './services/market-data-fetcher';
import { SignalPipeline } from './services/gateway/signal-pipeline';
import { SignalEngine, defaultTradingConfig } from './trading-engine';
import { initializeWebsocketBridge } from './websocket-bridge';

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});


(async () => {
  const server = await registerRoutes(app);

  // Initialize Scout Report Service
  try {
    const { ScoutReportService } = await import('./services/scout-report-service');
    const { TradeClassifier } = await import('./services/trade-classifier');

    const tradeClassifier = new TradeClassifier();
    const scoutReportService = new ScoutReportService(tradeClassifier);
    
    // Store in global for route access
    (global as any).scoutReportService = scoutReportService;
    console.log('[Scout Report] Service initialized and registered globally');
  } catch (err) {
    console.error('[Scout Report] Failed to initialize:', err);
  }

  // Initialize Learning System
  try {
    const bayesianUpdater = new BayesianBeliefUpdater();
    const rlAgent = new RLPositionAgent();
    
    // Initialize strategies with prior beliefs
    bayesianUpdater.initialize_strategy('ml-direction-model', 0.55);
    bayesianUpdater.initialize_strategy('ml-price-model', 0.54);
    bayesianUpdater.initialize_strategy('ml-volatility-model', 0.52);
    bayesianUpdater.initialize_strategy('pattern-detection', 0.60);
    bayesianUpdater.initialize_strategy('rl-position-sizer', 0.55);
    
    globalLearningSystem = new LearningSystemIntegration(bayesianUpdater, rlAgent);
    console.log('[Learning] System initialized with 5 strategies');
    console.log('[Learning] Bayesian updater ready');
    console.log('[Learning] RL agent ready with regime-aware Q-tables');
  } catch (err) {
    console.error('[Learning] Failed to initialize:', err);
  }

  // Initialize Market Data Layer (MDL) - Phase 1 Trust Boundary
  try {
    const { CCXTAdapterFactory } = await import('./services/market-data/ccxt-adapter');
    const { initializeMarketDataLayer } = await import('./services/market-data/market-data-layer');
    const { initializeIntegrityGate } = await import('./services/market-data/integrity-gate');
    
    const exchanges = ['binance', 'kucoinfutures', 'okx', 'bybit', 'kraken', 'coinbase'];
    const adapters = CCXTAdapterFactory.createMultiple(exchanges);
    
    globalMarketDataLayer = initializeMarketDataLayer(adapters, exchanges);
    
    // Initialize Phase 2: Candle Integrity Layer
    const integrityGate = initializeIntegrityGate();
    
    // Listen for integrity issues
    globalMarketDataLayer.on('integrity.issue', (issue: any) => {
      if (issue.severity === 'error') {
        console.warn(`[MDL] Integrity issue (${issue.type}): ${issue.details}`);
      }
    });

    // Listen for gap detection from Phase 2
    integrityGate.on('gaps.detected', (data: any) => {
      console.warn(`[Phase 2] Gap detected: ${data.symbol} ${data.timeframe}s`);
    });

    integrityGate.on('candles.rejected', (data: any) => {
      console.warn(`[Phase 2] Rejected ${data.rejected.length} candles for ${data.symbol}`);
    });

    // --- Cross-Exchange Aggregation & Agents (wire into IntegrityGate) ---
    try {
      const crossAggregator = new CrossExchangeAggregator(integrityGate, 90_000);

      // Minimal observability bridge
      crossAggregator.on('aggregated.updated', ({ symbol, aggregated }: any) => {
        console.debug('[Aggregator] aggregated.updated', symbol, 'spread=', aggregated.spread, 'confidence=', aggregated.confidence);
        // Forward aggregated snapshots onto the IntegrityGate event bus for dashboards
        integrityGate.emit('aggregated.updated', { symbol, aggregated });
      });

      // Instantiate agents and forward their signals to the IntegrityGate bus
      const discoveryAgent = new DiscoveryAgent(integrityGate);

      // Initialize TruthEngine (multi-source arbitration / one-truth)
      const { TruthEngine } = await import('./services/aggregator/truth-engine');
      const truthEngine = new TruthEngine(integrityGate, crossAggregator);

      // Healing service for forward-fill / interpolation
      const { HealingService } = await import('./services/aggregator/healing-service');
      const healingService = new HealingService();

      const arbitrageAgent = new ArbitrageAgent(integrityGate, crossAggregator, /*arbThreshold=*/0.5, truthEngine as any);
      const portfolioAgent = new PortfolioAgent(integrityGate, crossAggregator, healingService as any);

      // Forward arb signals emitted by the ArbitrageAgent to the global gate
      arbitrageAgent.on('arb.signal', (sig: any) => {
        integrityGate.emit('arb.signal', sig);
      });

      // Ensure PortfolioAgent hears arb signals via the IntegrityGate bus
      integrityGate.on('arb.signal', (sig: any) => {
        (portfolioAgent as any).emit('arb.signal', sig);
      });

      // Initialize Execution Engine with a simple ExchangeSimulator
      try {
        const { ExchangeSimulator } = await import('./services/execution/exchange-sim');
        const { ExecutionEngine } = await import('./services/execution/execution-engine');

        const exchangeSim = new ExchangeSimulator(crossAggregator as any);
        // Setup per-exchange daily limits for the simulator
        exchangeSim.setDailyLimit('exchangeA', 1000);
        exchangeSim.setDailyLimit('exchangeB', 1000);
        exchangeSim.setDailyLimit('exchangeC', 1000);
        // Seed some balances for the simulator and portfolio agent
        ['exchangeA', 'exchangeB', 'exchangeC'].forEach(ex => {
          exchangeSim.setBalance(ex, 'USD', 100000);
          exchangeSim.setBalance(ex, 'BTC', 10);
          // Mirror to portfolio agent balances so portfolio and sim align
          (portfolioAgent as any).setBalance(ex, 'USD', 100000);
          (portfolioAgent as any).setBalance(ex, 'BTC', 10);
        });

        const exec = new ExecutionEngine(integrityGate, crossAggregator as any, portfolioAgent as any, exchangeSim, { maxLatencyMs: 5000, maxExposurePerSymbol: 5, defaultOrderSize: 0.5 });

        exec.on('execution.filled', (data: any) => {
          console.log('[ExecutionEngine] execution.filled', data.sig?.symbol || '(sig)', data);
        });

        console.log('[CrossExchange] ExecutionEngine initialized');
        (global as any).executionEngine = exec;
      } catch (err) {
        console.error('[CrossExchange] Failed to initialize ExecutionEngine:', err);
      }

      console.log('[CrossExchange] Aggregator and agents initialized (Discovery/Arb/Portfolio + Execution)');
      (global as any).crossExchangeAggregator = crossAggregator;
      (global as any).discoveryAgent = discoveryAgent;
      (global as any).arbitrageAgent = arbitrageAgent;
      (global as any).portfolioAgent = portfolioAgent;
    } catch (err) {
      console.error('[CrossExchange] Failed to initialize aggregator or agents:', err);
    }

    // Optional: Listen for world ticks
    globalMarketDataLayer.on('world.tick', (tick: any) => {
      console.debug(`[MDL] Tick: ${tick.symbol} ${tick.timeframe}s close=${tick.candle.close}`);
    });

    console.log('[MDL] Market Data Layer initialized with adapters:', exchanges.join(', '));
    console.log('[MDL] ✅ Integrity validation enabled');
    console.log('[MDL] ✅ Gap healing enabled');
    console.log('[MDL] ✅ World tick events enabled');
    console.log('[Phase 2] ✅ Candle Integrity Layer initialized');
    console.log('[Phase 2] ✅ Timestamp alignment enabled');
    console.log('[Phase 2] ✅ Continuity check enabled');
    console.log('[Phase 2] ✅ Deduplication enabled');
    console.log('[Phase 2] ✅ Finality enforcement enabled');
  } catch (err) {
    console.error('[MDL] Failed to initialize Market Data Layer:', err);
    console.warn('[MDL] ⚠️  Proceeding without MDL - system will fall back to direct CCXT');
  }

  // Initialize Commander Approval System
  const approvalSystem = new CommanderApprovalSystem();
  console.log('[Commander] Approval System initialized');

  // Initialize Daily Briefing System (will be created after arena is available)
  let briefingSystem: DailyBriefingSystem | null = null;
  
  // Setup Commander Routes
  const router = express.Router();
  setupCommanderRoutes(router, approvalSystem, briefingSystem as any, null as any, null as any);
  app.use('/api', router);
  console.log('[Commander] Routes registered at /api/commander');

  // MDL Diagnostics endpoint
  app.get('/api/diagnostics/mdl', (req, res) => {
    if (!globalMarketDataLayer) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Market Data Layer not initialized',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'initialized',
      message: 'Market Data Layer is operational',
      timestamp: new Date().toISOString(),
      features: {
        integrityValidation: true,
        gapHealing: true,
        worldTicks: true
      },
      adapters: ['binance', 'kucoinfutures', 'okx', 'bybit', 'kraken', 'coinbase']
    });
  });

  // Phase 2: Candle Integrity Layer diagnostics
  app.get('/api/diagnostics/integrity', async (req, res) => {
    try {
      const { getIntegrityGate } = await import('./services/market-data/integrity-gate');
      const gate = getIntegrityGate();
      const metrics = gate.getMetrics();

      res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        phase2: 'Candle Integrity Layer',
        features: {
          timestampAlignment: true,
          continuityCheck: true,
          deduplication: true,
          finalityEnforcement: true,
          ohlcValidation: true,
        },
        metrics: metrics,
        summary: {
          pairs: metrics.length,
          totalProcessed: metrics.reduce((sum: number, m: any) => sum + (m.totalProcessed || 0), 0),
          totalValid: metrics.reduce((sum: number, m: any) => sum + (m.totalValid || 0), 0),
          totalRejected: metrics.reduce((sum: number, m: any) => sum + (m.totalRejected || 0), 0),
          avgValidityRate: metrics.length > 0
            ? (metrics.reduce((sum: number, m: any) => {
              const rate = parseFloat(m.validityRate || '0');
              return sum + (isNaN(rate) ? 0 : rate);
            }, 0) / metrics.length).toFixed(1) + '%'
            : 'N/A'
        }
      });
    } catch (err) {
      res.status(503).json({
        status: 'unavailable',
        message: 'Integrity Layer not initialized',
        error: (err as any).message
      });
    }
  });

  // Initialize WebSocket signal streaming service (Socket.IO)
  signalWebSocketService.initialize(server);
  console.log('[WebSocket] Signal streaming service initialized');

  // Initialize the IntegrityGate -> WebSocket bridge for UI event streaming
  try {
    initializeWebsocketBridge(server, '/events');
    console.log('[WS-Bridge] initialized at /events');
  } catch (err) {
    console.warn('[WS-Bridge] failed to initialize:', err);
  }

  // Start signal price monitoring (updates every 5 seconds)
  signalPriceMonitor.start(5000);
  console.log('[SignalMonitor] Price monitoring started');

  // Initialize and start market data fetcher (auto-fetches BTC, ETH, SOL, etc)
  const { aggregator, cacheManager, rateLimiter } = getGatewayServices();

  // Initialize signal engine for analysis
  const signalEngine = new SignalEngine(defaultTradingConfig);

  // Initialize signal pipeline
  const signalPipeline = new SignalPipeline(aggregator, signalEngine);

  const marketDataFetcher = initializeMarketDataFetcher(aggregator, cacheManager, rateLimiter);
  marketDataFetcher.setSignalPipeline(signalPipeline);
  await marketDataFetcher.start();

  // Expose for other services
  (global as any).marketDataFetcher = marketDataFetcher;
  (global as any).signalPipeline = signalPipeline;

  console.log('[MarketDataFetcher] Auto-fetch service started with signal generation');

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    serveStatic(app);
  } else {
    console.log('[express] Setting up Vite dev server...');
    await setupVite(app, server);
    console.log('[express] Vite dev server ready');
  }

  // Error handler LAST, after all other middleware and static serving
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error(err); // Don't rethrow, just log
  });

  // Backend server on port 5000 (required for Replit webview)
  const port = parseInt(process.env.PORT || '5000');
  // Bind to all IPv4 addresses including localhost (127.0.0.1)
  const host = '0.0.0.0';

  server.listen(port, host, () => {
    console.log(`\n╔════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 Scanstream Backend Server                          ║`);
    console.log(`╠════════════════════════════════════════════════════════╣`);
    console.log(`║  Backend API:    http://0.0.0.0:${port.toString().padEnd(4)}                   ║`);
    console.log(`║  Scanner API:    http://localhost:3001                 ║`);
    console.log(`║  Frontend Dev:   http://localhost:3173                 ║`);
    console.log(`║  Database:       postgresql://localhost:5432/scandb    ║`);
    console.log(`║  WebSocket:      http://0.0.0.0:${port.toString().padEnd(4)}/ws               ║`);
    console.log(`╚════════════════════════════════════════════════════════╝\n`);
    
    console.log('[Server] ✅ HTTP server listening');
    console.log('[Server] ✅ Environment:', process.env.NODE_ENV || 'development');
    console.log('[Server] ✅ Database URL:', process.env.DATABASE_URL ? 'configured' : 'missing');
  });
})();