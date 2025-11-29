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
// Removed fastScanner service import


const app = express();

// Trust proxy should be false in development to avoid express-rate-limit validation errors
app.set('trust proxy', false);

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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Register CoinGecko sentiment & market data routes
app.use('/api/coingecko', coinGeckoRouter);

// Register ML Predictions routes
app.use('/api/ml', mlPredictionsRouter);
console.log('[express] ML Predictions API registered at /api/ml/predictions');

// Register ML Training routes
app.use('/api/ml', mlTrainingRouter);
console.log('[express] ML Training API registered at /api/ml/training');

app.use('/api/analytics', analyticsRouter);
console.log('[express] Analytics API registered at /api/analytics');

// Register Optimization routes
import optimizationRouter from './routes/optimization';
app.use('/api/optimize', optimizationRouter);
console.log('[express] Optimization API registered at /api/optimize');

// Register Gateway routes
import gatewayRouter from './routes/gateway';
app.use('/api/gateway', gatewayRouter);
console.log('[express] Gateway API registered at /api/gateway');

// Initialize WebSocket service for real-time signal streaming
import { signalWebSocketService } from './services/websocket-signals';
import { signalPriceMonitor } from './services/signal-price-monitor';

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
  
  // Initialize WebSocket signal streaming
  signalWebSocketService.initialize(server);

  // Start signal price monitoring (updates every 5 seconds)
  signalPriceMonitor.start(5000);
  console.log('[SignalMonitor] Price monitoring started');

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

  // Backend server on port 5000
  const port = parseInt(process.env.PORT || '5000');
  const host = '0.0.0.0';

  server.listen(port, host, () => {
    console.log(`\n╔════════════════════════════════════════════════════════╗`);
    console.log(`║  🚀 Scanstream Backend Server                          ║`);
    console.log(`╠════════════════════════════════════════════════════════╣`);
    console.log(`║  Backend API:    http://0.0.0.0:${port.toString().padEnd(4)}                   ║`);
    console.log(`║  Scanner API:    http://localhost:5001                 ║`);
    console.log(`║  Frontend Dev:   http://localhost:5173                 ║`);
    console.log(`║  Database:       postgresql://localhost:5432/scandb    ║`);
    console.log(`║  WebSocket:      http://0.0.0.0:${port.toString().padEnd(4)}/ws               ║`);
    console.log(`╚════════════════════════════════════════════════════════╝\n`);
  });
})();