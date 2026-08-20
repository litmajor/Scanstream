import express, { type Request, Response, NextFunction } from "express";
import { setupConsoleLogging, getLogPath, getSessionId, ModuleLogger } from "./utils/logger";
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
import physicsValidationRouter from './routes/physics-validation';
import missingApiEndpointsRouter from './routes/missing-api-endpoints';
import featureFlagsRouter from './routes/feature-flags';
import agentAbilitiesRouter from './routes/agent-abilities';
import gatewayRouter, { getGatewayServices } from './routes/gateway';
import metricsRouter from './routes/metrics';
import agentsRouter from './routes/agents';
import tradeExecutionRouter from './routes/trade-execution';
import modelPerformanceRouter from './routes/model-performance';
import scoutReportRouter from './routes/scout-report-routes';
import phase5Routes from './routes/phase5-api';
import multiTimeframeRouter from './routes/multi-timeframe-analysis';
import learningMetricsRouter from './routes/learning-metrics';
import exitAgentsRouter from './routes/exit-agents';
import agentInteractionsRouter from './routes/agent-interactions';
import optimizationRouter from './routes/optimization';
import signalBacktestingRouter from './routes/signal-backtesting';
import historicalBacktestRouter from './routes/historical-backtest';
import signalGenerationRouter from './routes/api/signal-generation';
import symbolUniverseRouter from './routes/api/symbol-universe';
import userSettingsRouter from './routes/user-settings';
import gatewayReadonlyRouter, { createGatewayStatusRouter } from './routes/gateway-readonly';
import strategiesCompatRouter from './routes/strategies-compat';
import { getSharedService, setSharedService } from './services/shared-service-registry';
// Removed fastScanner service import

// API Registry System imports
import { apiRegistry } from './services/api-registry';
import { setupAPITracking } from './middleware/api-tracker';
import apiDocsRouter from './routes/api-docs';
import { attachApiIdentity } from './middleware/api-access-auth';
import { routeParamErrorHandler } from './middleware/route-param-error-handler';

// Commander System imports
import { setupCommanderRoutes } from './routes/commander';
import { CommanderApprovalSystem } from './services/rpg-agents/CommanderApprovalSystem';
import { DailyBriefingSystem } from './services/rpg-agents/DailyBriefingSystem';

// Learning System imports
import { BayesianBeliefUpdater } from './services/bayesian-belief-updater';
import { LearningSystemIntegration } from './services/learning-system-integration';
import { RLPositionAgent } from './rl-position-agent';
import { getRLAgent } from '../src/agents/rl-agent.singleton';
import { adaptiveController } from './services/adaptive-controller';
import { dataQualityDetector } from './services/data-quality-detector';

// Cross-exchange aggregator & agents
import { CrossExchangeAggregator } from './services/aggregator/cross-exchange-aggregator';
import { DiscoveryAgent } from './agents/discovery-agent';
import { ArbitrageAgent } from './agents/arbitrage-agent';
import { PortfolioAgent } from './agents/portfolio-agent';

// Enable debug logging
process.env.DEBUG = 'express:*,server:*';

// Initialize file logging
setupConsoleLogging();
const sessionId = getSessionId();
console.log(`\n${'='.repeat(70)}`);
console.log(' SERVER STARTUP - Enhanced Logging System Active');
console.log(`${'='.repeat(70)}`);
console.log(` Session ID:   ${sessionId}`);
console.log(` Logs Dir:     ${getLogPath()}`);
console.log(`API Endpoint: /api/health/logs - View current session logs`);
console.log(` Search:      /api/health/logs?pattern=ERROR - Search logs`);
console.log(` Features:    Auto-chunking (10MB), Automatic rotation, Full history`);
console.log(`${'='.repeat(70)}\n`);

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

// Diagnostic wrapper: detect accidental full-URL route registrations (e.g., "https://...")
// This prevents path-to-regexp from throwing and logs the offending value for debugging.
const origUse = app.use.bind(app) as any;
app.use = function (pathOrMiddleware: any, ...args: any[]) {
  try {
    if (typeof pathOrMiddleware === 'string') {
      const p = pathOrMiddleware as string;
      if (p.includes('://') || p.startsWith('http')) {
        console.warn('[DIAGNOSTIC] Skipping registration of invalid route path (looks like URL):', p);
        return app; // skip registering this invalid route
      }
    }
  } catch (e) {
    console.warn('[DIAGNOSTIC] Error in route wrapper check', e);
  }
  return origUse(pathOrMiddleware, ...args);
};

// Also wrap top-level HTTP method registrations to catch non-string paths
['get','post','put','delete','patch','all'].forEach((method) => {
  const orig = (app as any)[method];
  (app as any)[method] = function (pathOrHandler: any, ...rest: any[]) {
    if (typeof pathOrHandler === 'string') {
      const p = pathOrHandler as string;
      if (p.includes('://') || p.startsWith('http')) {
        console.warn(`[DIAGNOSTIC] Skipping ${method.toUpperCase()} registration of invalid route path:`, p);
        return app;
      }
    }
    return orig.call(this, pathOrHandler, ...rest);
  };
});

// Install API tracking middleware EARLY - before any route handlers
try {
  setupAPITracking(app);
  console.log('[API Registry] Tracking middleware installed');
} catch (err) {
  console.warn('[API Registry] Failed to install tracking middleware:', (err as any).message);
}

// Add request logger - only log non-static requests
app.use((req, res, next) => {
  // Skip logging for static assets and health checks
  if (!req.url.startsWith('/assets') && !req.url.includes('map') && !req.url.startsWith('/health')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(attachApiIdentity);

// Enable trust proxy for Replit's proxied environment (required for rate limiter)
app.set('trust proxy', 1);

// Global debug logging for all route registrations (with types) - disabled to reduce noise
const origAppUse = app.use;
// Prevent accidental duplicate route mounts by tracking mounted base paths
const _mountedPaths = new Set<string>();
app.use = function (path: any, ...args: any[]): any {
  // Only handle string route mounts (ignore middleware functions)
  if (typeof path === 'string' && path.startsWith('/')) {
    if (_mountedPaths.has(path)) {
      console.warn(`[DIAGNOSTIC] Duplicate mount detected for ${path} — skipping duplicate registration.`);
      return app;
    }
    _mountedPaths.add(path);
    console.log('[DEBUG] app.use path:', path);
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

// Prometheus metrics endpoint (aggregates available module registries)
try {
  app.use('/metrics', metricsRouter);
  console.log('[express] Metrics endpoint registered at /metrics');
} catch (e) {
  console.warn('[express] Failed to register metrics endpoint', e);
}

// Register Documentation API (after tracking middleware but before other routes)
// Wrap imported routers to detect accidental full-URL registrations on Router instances
function wrapRouter(router: any, name = 'router') {
  if (!router || typeof router !== 'object') return;
  ['use','get','post','put','delete','patch','all'].forEach((method) => {
    if (!router[method]) return;
    const orig = router[method].bind(router);
    router[method] = function (pathOrHandler: any, ...args: any[]) {
      if (typeof pathOrHandler === 'string') {
        const p = pathOrHandler as string;
        if (p.includes('://') || p.startsWith('http')) {
          console.warn(`[DIAGNOSTIC] Skipping ${name}.${method} registration of invalid route path:`, p);
          return router;
        }
      }
      return orig(pathOrHandler, ...args);
    };
  });
}

// Apply wrapper to main routers imported above
[
  apiDocsRouter, featureFlagsRouter, agentAbilitiesRouter, flowFieldRouter,
  flowFieldBacktestRouter, enhancedAnalyticsRouter, mlPredictionsRouter,
  mlTrainingRouter, analyticsRouter, mlSignalsRouter, rlSignalsRouter,
  paperTradingRouter, scannerRouter, scannerAnalysisRouter, coinGeckoRouter
].forEach((r: any) => wrapRouter(r));

console.log('[express]   - GET /api/docs/endpoints - List all endpoints');
console.log('[express]   - GET /api/docs/stats - Statistics and metrics');
console.log('[express]   - GET /api/docs/health - Health status');
console.log('[express]   - GET /api/docs/performance - Performance data');
console.log('[express]   - GET /api/docs/openapi - OpenAPI/Swagger export');
console.log('[express]   - GET /api/docs/markdown - Markdown documentation');
console.log('[express] Dashboard available at /admin/api-docs');

// Register Feature Flags API (early - needed by all other routes)
app.use('/api/docs', apiDocsRouter);
console.log('[express] API Documentation registered at /api/docs');

// Feature flags are lightweight and can remain mounted here
app.use('/api/feature-flags', featureFlagsRouter);
console.log('[express] Feature Flags API registered at /api/feature-flags');

// Core API routers (analytics, scanner, ml, coinGecko, paper-trading, live-trading, etc.)
// are registered centrally inside registerRoutes(app) to avoid duplicate mounts.
console.log('[express] Core API router mounting deferred to registerRoutes() to avoid duplicates');
// Register Symbol Universe API
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

// Register missing frontend API endpoints
app.use('/api', missingApiEndpointsRouter);
console.log('[express] Missing API endpoints registered at /api');

// Register paper trading routes
app.use('/api/paper-trading', paperTradingRouter);
console.log('[express] Paper Trading API registered at /api/paper-trading');

// Health / readiness / live-readiness router. Restored from the disabled block
// below: without it there is no readiness endpoint at all, so an operator cannot
// tell whether storage is durable before enabling live trading. Read-only.
import healthRouter from './routes/health';
app.use('/api/health', healthRouter);
console.log('[express] Health Check API registered at /api/health');

// Route groups restored after isolated route-contract coverage:
// - /api/agents/services-api exposes public status reads, while the simulated
//   ability endpoint requires authentication and a bounded ability parameter.
// - /api/execution guards every state-changing endpoint with operator auth and
//   audits the action; its status endpoint remains read-only.
// - /api/model-performance exposes public metrics/status reads, while
//   validation, ensemble prediction, and destructive pruning require
//   authentication and bounded inputs.
app.use('/api/agents/services-api', agentsRouter);
console.log('[express] Agent Services API registered at /api/agents/services-api');
app.use('/api/execution', tradeExecutionRouter);
console.log('[express] Trade Execution API registered at /api/execution');
app.use('/api/model-performance', modelPerformanceRouter);
console.log('[express] Model Performance API registered at /api/model-performance');

// Batch 1 read-mostly routes restored with isolated route-contract coverage.
app.use('/api/scout', scoutReportRouter);
console.log('[express] Scout Report API registered at /api/scout');
app.use('/api/phase5', phase5Routes);
console.log('[express] Phase 5 API registered at /api/phase5');
app.use('/api/analysis/multi-timeframe', multiTimeframeRouter);
console.log('[express] Multi-Timeframe Analysis API registered at /api/analysis/multi-timeframe');
// Symbols are mounted centrally in registerRoutes().
app.use(learningMetricsRouter);
console.log('[express] Learning Metrics API registered at /api/learning');
app.use('/api/physics', physicsValidationRouter);
console.log('[express] Physics Validation API registered at /api/physics');
app.use('/api/agents/physics', physicsAgentsRouter);
console.log('[express] Physics Agents API registered at /api/agents/physics');
app.use('/api/agents/exit', exitAgentsRouter);
console.log('[express] Exit Agents API registered at /api/agents/exit');
app.use('/api/agents/interactions', agentInteractionsRouter);
console.log('[express] Agent Interactions API registered at /api/agents/interactions');
app.use('/api/optimize', optimizationRouter);
console.log('[express] Optimization API registered at /api/optimize');
app.use('/api/backtest', signalBacktestingRouter);
app.use('/api/backtest', historicalBacktestRouter);
console.log('[express] Signal and Historical Backtesting APIs registered at /api/backtest');
app.use('/api/user', userSettingsRouter);
console.log('[express] User Settings API registered at /api/user');
app.use('/api/strategies', strategiesCompatRouter);
console.log('[express] Strategies read/analysis compatibility API registered at /api/strategies');
app.use('/api/gateway', gatewayReadonlyRouter);
console.log('[express] Gateway read-only compatibility API registered at /api/gateway');
app.use('/api/exchange', createGatewayStatusRouter());
console.log('[express] Exchange status compatibility API registered at /api/exchange/status');

// Remaining disabled routers (see PRODUCTION_READINESS.md "Disabled route groups").
// Import-time probing is not route-level safety evidence. Each group below
// remains disabled until every route has bounded contract/error coverage and
// any state-changing or capital-adjacent endpoint has the required operator
// guard.
// ============================================================================
/*
// Register Agent Signal Insights routes
import agentSignalInsightsRouter from './routes/agent-signal-insights';
app.use('/api/agents/signals', agentSignalInsightsRouter);
console.log('[express] Agent Signal Insights API registered at /api/agents/signals');

// Register Strategy routes (including feature-flag-enabled strategies)
import strategiesRouter from './routes/strategies';
app.use('/api/strategies', strategiesRouter);
console.log('[express] Strategies API registered at /api/strategies');

  // Health Check route: RESTORED above, outside this disabled block.

  // Register Cache Monitoring routes
  app.get('/api/monitoring/cache-stats', (req, res) => {
    try {
      const { getTickerCache } = require('./services/ticker-snapshot-cache');
      const cache = getTickerCache();
      res.json({
        status: 'ok',
        tickerCache: cache.getStats(),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // Register Gateway routes
  app.use('/api/gateway', gatewayRouter);
  console.log('[express] Gateway API registered at /api/gateway');

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

*/

// Register bounded, operator-authenticated signal generation routes.
app.use('/api/signal-generation', signalGenerationRouter);
console.log('[express] Complete Signal Generation API registered at /api/signal-generation');

// Initialize WebSocket service for real-time signal streaming
import { signalWebSocketService } from './services/websocket-signals';
import { signalPriceMonitor } from './services/signal-price-monitor';
import { initializeMarketDataFetcher } from './services/market-data-fetcher';
import { SignalPipeline } from './services/gateway/signal-pipeline';
import { SignalEngine, defaultTradingConfig } from './trading-engine';
import { initializeWebsocketBridge } from './websocket-bridge';
import { getBridgeHealth } from './websocket-bridge';
import executionMetrics from './metrics-execution';

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Response bodies are deliberately NOT logged: trading and config
      // endpoints return exchange settings and account data.
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});


(async () => {
  const server = await registerRoutes(app);

  // Initialize Scout Report Service
  try {
    const { ScoutReportService } = await import('./services/scout-report-service');
    
    try {
      const { MultiTimeframeMLService } = await import('./services/multi-timeframe-ml-service');
      const { ScannerSignalService } = await import('./services/scanner/scanner-signal-service');
      const { TradeClassifier } = await import('./services/trade-classifier');

      // Initialize all required services with error handling
      let mlService: any;
      let scannerService: any;
      let tradeClassifier: any;

      try {
        mlService = new MultiTimeframeMLService();
      } catch (mlError) {
        console.warn('[Scout Report] Failed to initialize ML Service, using stub:', (mlError as any).message);
        mlService = { predict: async () => ({ direction: 'NEUTRAL', confidence: 0 }) };
      }

      try {
        scannerService = new ScannerSignalService();
      } catch (scannerError) {
        console.warn('[Scout Report] Failed to initialize Scanner Service, using stub:', (scannerError as any).message);
        scannerService = { computeSignal: () => ({ success: false, error: 'Not initialized' }) };
      }

      try {
        tradeClassifier = new TradeClassifier();
      } catch (tcError) {
        console.warn('[Scout Report] Failed to initialize Trade Classifier, using stub:', (tcError as any).message);
        tradeClassifier = { classify: async () => ({ type: 'SWING' as const, factors: {} }) };
      }
      
      // Create a minimal price service if it doesn't exist
      const priceService = {
        async getCurrentPrice() { return 0; },
        async getOHLCV() { return []; }
      } as any;
      
      // Create scout report service with all dependencies
      const scoutReportService = new ScoutReportService(
        mlService,
        scannerService,
        priceService,
        tradeClassifier
      );
      
      // Store in global for route access
      (global as any).scoutReportService = scoutReportService;
      console.log('[Scout Report] Service initialized and registered globally');
    } catch (serviceError) {
      console.error('[Scout Report] Failed to initialize services:', (serviceError as any).message);
      console.warn('[Scout Report] Scout Report routes will use fallback responses');
      
      // Create a minimal fallback scout report service
      (global as any).scoutReportService = null;
    }
  } catch (err) {
    console.error('[Scout Report] Failed to import Scout Report Service:', (err as any).message);
  }

  // Initialize Learning System
  try {
    const bayesianUpdater = new BayesianBeliefUpdater();
    const rlAgent = getRLAgent();
    
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
    // Update popularity scores from market data: use recent hourly volume to set popularity
    globalMarketDataLayer.on('world.tick', async (tick: any) => {
      try {
        const frames = await globalMarketDataLayer.getSnapshot(tick.symbol, 3600, 24);
        const totalVol = frames.reduce((acc: number, c: any) => acc + (c.volume || 0), 0);
        const avgVol = frames.length ? Math.round(totalVol / frames.length) : 0;
        // setPopularity will bound the value
        try { (await import('./services/symbol-manager')).symbolManager.setPopularity(tick.symbol, avgVol); } catch (e) { /* ignore */ }
      } catch (err) {
        // non-fatal
      }
    });
    
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

      // Register CCXT adapters with the aggregator so it can track venue health
      for (const [venue, adapter] of adapters.entries()) {
        try {
          crossAggregator.registerAdapter(adapter as any, venue);
        } catch (e) {
          console.warn(`[CrossExchange] failed to register adapter for ${venue}: ${String(e)}`);
        }
      }

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
      // Expose TruthEngine globally so agents and engines can access canonical consensus
      setSharedService('truthEngine', truthEngine);
      console.log('[TruthEngine] registered in shared service registry');

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
  
  // TEMPORARILY DISABLED: Setup Commander Routes
  // const router = express.Router();
  // setupCommanderRoutes(router, approvalSystem, briefingSystem as any, null as any, null as any);
  // app.use('/api', router);
  // console.log('[Commander] Routes registered at /api/commander');

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

  // Start AdaptiveController service (meta-adaptive policy)
  try {
    if (adaptiveController && typeof adaptiveController.start === 'function') {
      adaptiveController.start();
      console.log('[AdaptiveController] started');
    }
  } catch (err) {
    console.warn('[AdaptiveController] failed to start', err);
  }

  // Start DataQualityDetector service for world.tick monitoring
  try {
    if (dataQualityDetector && typeof dataQualityDetector.start === 'function') {
      dataQualityDetector.start(globalMarketDataLayer);
      console.log('[DataQualityDetector] started');
    }
  } catch (err) {
    console.warn('[DataQualityDetector] failed to start', err);
  }

  // Initialize and start market data fetcher (auto-fetches BTC, ETH, SOL, etc)
  const { aggregator, cacheManager, rateLimiter } = getGatewayServices();

  if (!aggregator) {
    throw new Error('[MarketDataFetcher] Gateway aggregator is not ready');
  }

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

  // Start scanner scheduler (periodic autonomous scans)
  try {
    const ScannerScheduler = (await import('./services/scanner/scanner-scheduler')).default;
    const scannerIntervalMinutes = Number(process.env.SCANNER_INTERVAL_MINUTES || '10');
    const scannerScheduler = new ScannerScheduler(aggregator, cacheManager);
    scannerScheduler.start(scannerIntervalMinutes);
    (global as any).scannerScheduler = scannerScheduler;
    console.log(`[ScannerScheduler] Scheduled every ${scannerIntervalMinutes} minutes`);
  } catch (e) {
    console.warn('[ScannerScheduler] Failed to initialize scanner scheduler:', (e as any).message || e);
  }

  // Register API documentation dashboard (admin panel)
  app.get('/admin/api-docs', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    try {
      const dashboardPath = path.join(process.cwd(), 'docs', 'API_DASHBOARD_TEMPLATE.html');
      const html = fs.readFileSync(dashboardPath, 'utf-8');
      res.header('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      res.status(404).json({
        error: 'Dashboard not found',
        message: 'API documentation dashboard template not found. Run build setup.',
        hint: 'Place API_DASHBOARD_TEMPLATE.html in docs/ directory'
      });
    }
  });
  console.log('[express] API Dashboard registered at /admin/api-docs');

  // Lightweight websocket health endpoint (root-level)
  app.get('/health/ws', (req, res) => {
    try {
      const bridge = getBridgeHealth();
      const exec = executionMetrics.getExecutionStats();
      res.json({
        status: 'ok',
        websocket: bridge,
        execution: exec,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(503).json({ status: 'unavailable', error: err.message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isProduction = process.env.NODE_ENV === "production";
  const serveFrontend = process.env.SERVE_FRONTEND !== 'false';
  if (isProduction && serveFrontend) {
    serveStatic(app);
    console.log('[express] Frontend static assets enabled');
  } else if (isProduction && !serveFrontend) {
    console.log('[express] Frontend static assets disabled via SERVE_FRONTEND=false');
  } else {
    console.log('[express] Setting up Vite dev server...');
    await setupVite(app, server);
    console.log('[express] Vite dev server ready');
  }

  // Error handler LAST, after all other middleware and static serving
  app.use(routeParamErrorHandler);
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
  // Global unhandled rejection and uncaught exception handlers
  process.on('unhandledRejection', (reason, promise) => {
    try { require('./services/scanner/scanner-metrics').incUnhandledRejection(); } catch (e) {}
    console.error('[process] UnhandledRejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[process] UncaughtException:', err);
    // attempt graceful shutdown
    const graceful = async () => {
      try {
        console.log('[process] Attempting graceful shutdown due to uncaughtException');
        // try to stop known global services
        const globals: any = global as any;
        const maybeStop = async (o: any) => {
          if (!o) return;
          try { if (typeof o.shutdown === 'function') await o.shutdown(); } catch (e) {}
          try { if (typeof o.stop === 'function') await o.stop(); } catch (e) {}
          try { if (typeof o.close === 'function') await o.close(); } catch (e) {}
        };
        await maybeStop(globalMarketDataLayer);
        await maybeStop((global as any).crossExchangeAggregator);
        await maybeStop((global as any).executionEngine);
        await maybeStop(getSharedService('truthEngine'));
      } catch (e) {
        console.error('[process] Error during graceful shutdown:', e);
      } finally {
        process.exit(1);
      }
    };
    void graceful();
  });

  // SIGINT/SIGTERM handlers
  const shutdownHandler = (signal: string) => {
    console.log(`[process] Received ${signal}, shutting down...`);
    (async () => {
      try {
        const globals: any = global as any;
        const maybeStop = async (o: any) => {
          if (!o) return;
          try { if (typeof o.shutdown === 'function') await o.shutdown(); } catch (e) {}
          try { if (typeof o.stop === 'function') await o.stop(); } catch (e) {}
          try { if (typeof o.close === 'function') await o.close(); } catch (e) {}
        };
        await maybeStop(globalMarketDataLayer);
        await maybeStop((global as any).crossExchangeAggregator);
        await maybeStop((global as any).executionEngine);
        await maybeStop(getSharedService('truthEngine'));
        server.close(() => {
          console.log('[process] HTTP server closed');
          process.exit(0);
        });
        // Fallback exit if server.close doesn't finish
        setTimeout(() => { console.warn('[process] Forcing exit'); process.exit(0); }, 5000);
      } catch (e) {
        console.error('[process] Error during shutdown:', e);
        process.exit(1);
      }
    })();
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
})();