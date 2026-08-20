// chart-api.ts
// API endpoint for chart data and the intentionally unavailable server-side image route
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { routeParam } from "./utils/route-params";

export const CHART_IMAGE_UNAVAILABLE_MESSAGE =
  'Server-side chart image rendering is not available in this build';

// Helper to get chart data for a symbol
export async function getChartData(symbol: string, limit: number = 100) {
  const frames = await storage.getMarketFrames(symbol, limit);
  return frames.map((frame: any) => ({
    timestamp: typeof frame.timestamp === 'number' ? frame.timestamp : new Date(frame.timestamp).getTime(),
    open: frame.price.open,
    high: frame.price.high,
    low: frame.price.low,
    close: frame.price.close,
    volume: frame.volume,
    rsi: frame.indicators?.rsi,
    macd: frame.indicators?.macd?.line,
    ema: frame.indicators?.ema20,
  }));
}

// Express route registration
export function registerChartApi(app: Express) {
  // Raw chart data endpoint
  console.log('Registering GET /api/chart-data/:symbol');
  app.get("/api/chart-data/:symbol", async (req: Request, res: Response) => {
    const symbol = routeParam(req.params.symbol, 'symbol', 64);
    const limit = parseInt(req.query.limit as string) || 100;
    const data = await getChartData(symbol, limit);
    res.json(data);
  });

  // Chart image endpoint (PNG)
  console.log('Registering GET /api/chart-image/:symbol');
  app.get("/api/chart-image/:symbol", async (req: Request, res: Response) => {
    routeParam(req.params.symbol, 'symbol', 64);
    res.status(501).json({ error: CHART_IMAGE_UNAVAILABLE_MESSAGE });
  });
}
