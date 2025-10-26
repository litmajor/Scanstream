import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import flowFieldRouter from "./routes/flow-field";
import flowFieldBacktestRouter from "./routes/flow-field-backtest";
import fastScannerRouter from "./routes/fast-scanner";
import coinGeckoRouter from "./routes/coingecko";
import enhancedAnalyticsRouter from "./routes/enhanced-analytics";
import mlPredictionsRouter from "./routes/ml-predictions";
import analyticsRouter from './routes/analytics';
import { fastScanner } from "./services/fast-scanner";

const app = express();

// Trust proxy MUST be set before any rate limiting middleware
app.set('trust proxy', true);

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

// Register Flow Field analytics routes
app.use('/api/analytics', flowFieldRouter);
app.use('/api/analytics', flowFieldBacktestRouter);

// Register Enhanced Analytics (with CoinGecko sentiment)
app.use('/api/analytics', enhancedAnalyticsRouter);

// Register Fast Scanner routes
app.use('/api/scanner', fastScannerRouter);

// Register CoinGecko sentiment & market data routes
app.use('/api/coingecko', coinGeckoRouter);

// Register ML Predictions routes
app.use('/api/ml', mlPredictionsRouter);
console.log('[express] ML Predictions API registered at /api/ml/predictions');
app.use('/api/analytics', analyticsRouter);
console.log('[express] Analytics API registered at /api/analytics');

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
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