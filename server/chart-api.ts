// chart-api.ts
// API endpoint for chart data and server-side chart image generation
import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

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
    const symbol = req.params.symbol;
    const limit = parseInt(req.query.limit as string) || 100;
    const data = await getChartData(symbol, limit);
    res.json(data);
  });

  // Chart image endpoint (PNG)
  console.log('Registering GET /api/chart-image/:symbol');
  app.get("/api/chart-image/:symbol", async (req: Request, res: Response) => {
    const symbol = req.params.symbol;
    const limit = parseInt(req.query.limit as string) || 100;
    const data = await getChartData(symbol, limit);
    const width = parseInt(req.query.width as string) || 800;
    const height = parseInt(req.query.height as string) || 400;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
    // Import ChartConfiguration type from chart.js
    // import type { ChartConfiguration } from 'chart.js'; // Add this import at the top if not already present

    const configuration: import('chart.js').ChartConfiguration<'line', number[], unknown> = {
      type: 'line',
      data: {
        labels: data.map(d => new Date(d.timestamp).toLocaleDateString()),
        datasets: [
          { label: 'Close', data: data.map(d => d.close), borderColor: '#8884d8', fill: false },
          { label: 'EMA', data: data.map(d => d.ema), borderColor: '#ff7300', fill: false },
          { label: 'RSI', data: data.map(d => d.rsi), borderColor: '#0088FE', fill: false, yAxisID: 'y1' },
          { label: 'MACD', data: data.map(d => d.macd), borderColor: '#00C49F', fill: false, yAxisID: 'y1' },
        ],
      },
      options: {
        scales: {
          y: { beginAtZero: false, position: 'left' },
          y1: { beginAtZero: false, position: 'right', grid: { drawOnChartArea: false } },
        },
      },
    };
    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    res.set('Content-Type', 'image/png');
    res.send(image);
  });
}
