import type { Express, Request, Response } from "express";

export function registerAdvancedIndicatorApi(app: Express) {
  // Advanced Indicator/Pattern Detection API
  console.log('Registering POST /api/indicators/detect-pattern');
  app.post("/api/indicators/detect-pattern", async (req: Request, res: Response) => {
    try {
      const { prices, volumes } = req.body;
      if (!Array.isArray(prices) || prices.length < 10) {
        return res.status(400).json({ error: "'prices' array required (min 10)" });
      }
      // Optional: volumes for volume acceleration
      const { TechnicalIndicators } = await import('./trading-engine');
      const result = {
        emaCrossover: TechnicalIndicators.detectEMACrossover(prices),
        rsiDivergence: TechnicalIndicators.detectRSIDivergence(prices),
        macdBullishCross: TechnicalIndicators.detectMACDBullishCross(prices),
        trendReversal: TechnicalIndicators.detectTrendReversal(prices),
        volumeAcceleration: volumes ? TechnicalIndicators.detectVolumeAcceleration(volumes) : undefined
      };
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Higher Timeframe Trend Overlay API
  console.log('Registering POST /api/indicators/overlay-trend');
  app.post("/api/indicators/overlay-trend", async (req: Request, res: Response) => {
    try {
      const { lowerFrames, higherFrames, higherTimeframe } = req.body;
      if (!Array.isArray(lowerFrames) || !Array.isArray(higherFrames)) {
        return res.status(400).json({ error: "lowerFrames and higherFrames arrays required" });
      }
      const { TechnicalIndicators } = await import('./trading-engine');
      const overlayed = TechnicalIndicators.overlayHigherTimeframeTrend(lowerFrames, higherFrames, higherTimeframe);
      res.json(overlayed);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dynamic Threshold Adjustment API
  console.log('Registering POST /api/indicators/adjust-thresholds');
  app.post("/api/indicators/adjust-thresholds", async (req: Request, res: Response) => {
    try {
      const { base, sentiment, volatility } = req.body;
      if (typeof base !== 'number' || typeof sentiment !== 'number' || typeof volatility !== 'number') {
        return res.status(400).json({ error: "base, sentiment, volatility (all numbers) required" });
      }
      const { TechnicalIndicators } = await import('./trading-engine');
      const adjusted = TechnicalIndicators.adjustThresholds(base, sentiment, volatility);
      res.json({ adjusted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
