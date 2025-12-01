import express, { type Request, type Response } from 'express';
import { MLSignalEnhancer } from '../ml-engine';
import { storage } from '../storage';
import MLPredictionService from '../services/ml-predictions';
import type { MarketFrame } from '@shared/schema';
import { getPerformanceTracker } from '../services/model-performance-tracker';
import { signalPerformanceTracker } from '../services/signal-performance-tracker';

const router = express.Router();
const mlEnhancer = new MLSignalEnhancer();

/**
 * GET /api/ml-engine/predictions
 * Generate ML-based predictions using REAL market data with all 67 features
 */
router.get('/predictions', async (_req: Request, res: Response) => {
  try {
    // Get market data from multiple symbols using storage interface
    const defaultSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT', 'XRP/USDT'];
    const recentFrames: MarketFrame[] = [];

    for (const symbol of defaultSymbols) {
      const frames = await storage.getMarketFrames(symbol, 100);
      recentFrames.push(...frames);
    }

    if (!recentFrames || recentFrames.length === 0) {
      return res.json({ 
        predictions: [],
        message: 'No market data available. Run Gateway scanner first.',
        dataSource: 'database'
      });
    }

    // Group by symbol
    const symbolFrames = new Map<string, MarketFrame[]>();
    for (const frame of recentFrames) {
      if (!symbolFrames.has(frame.symbol)) {
        symbolFrames.set(frame.symbol, []);
      }
      symbolFrames.get(frame.symbol)!.push(frame);
    }

    // Generate REAL predictions for each symbol
    const predictions = [];
    const tracker = getPerformanceTracker(); // Get the performance tracker

    for (const [symbol, frames] of symbolFrames.entries()) {
      if (frames.length < 20) continue; // Need minimum data

      // Sort by timestamp
      frames.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const currentFrame = frames[frames.length - 1];

      // Convert MarketFrame to ChartDataPoint format
      const chartData = frames.map(f => ({
        timestamp: new Date(f.timestamp).getTime(),
        open: (f.price as any).open || 0,
        high: (f.price as any).high || 0,
        low: (f.price as any).low || 0,
        close: (f.price as any).close || 0,
        volume: f.volume,
        rsi: (f.indicators as any).rsi || null,
        macd: (f.indicators as any).macd?.macd || null,
        ema: (f.indicators as any).ema20 || null,
      }));

      // Generate ML predictions using ALL 67+ features
      const mlPrediction = await MLPredictionService.generatePredictions(chartData);

      // Calculate actual accuracy from historical predictions
      const accuracy = await calculateHistoricalAccuracy(symbol, frames);

      predictions.push({
        symbol,
        type: mlPrediction.direction.prediction === 'bullish' ? 'BUY' : 'SELL',
        direction: mlPrediction.direction.prediction.toUpperCase(),
        confidence: mlPrediction.direction.confidence,
        probability: mlPrediction.direction.probability,

        // Price predictions
        price: mlPrediction.price.predicted,
        priceHigh: mlPrediction.price.high,
        priceLow: mlPrediction.price.low,
        percentChange: mlPrediction.price.percentChange,

        // Volatility
        volatility: mlPrediction.volatility.predicted,
        volatilityLevel: mlPrediction.volatility.level,

        // NEW: Holding Period
        holdingPeriod: {
          candles: mlPrediction.holdingPeriod.candles,
          days: mlPrediction.holdingPeriod.days,
          hours: mlPrediction.holdingPeriod.hours,
          confidence: mlPrediction.holdingPeriod.confidence,
          reason: mlPrediction.holdingPeriod.reason
        },

        // Risk assessment
        riskScore: mlPrediction.risk.score,
        riskLevel: mlPrediction.risk.level,
        riskFactors: mlPrediction.risk.factors,

        // Metadata
        timestamp: new Date(mlPrediction.metadata.timestamp).toISOString(),
        dataPoints: mlPrediction.metadata.dataPoints,
        featuresUsed: mlPrediction.metadata.features,

        // Real accuracy (calculated from historical performance)
        accuracy: accuracy,

        // Data source indicators
        dataSource: 'real_market_data',
        model: 'MLPredictionService_v2',

        reasoning: [
          `${mlPrediction.direction.prediction.toUpperCase()} signal with ${(mlPrediction.direction.confidence * 100).toFixed(1)}% confidence`,
          `Expected price change: ${mlPrediction.price.percentChange > 0 ? '+' : ''}${mlPrediction.price.percentChange.toFixed(2)}%`,
          `Predicted price: $${mlPrediction.price.predicted.toFixed(2)} (Range: $${mlPrediction.price.low.toFixed(2)} - $${mlPrediction.price.high.toFixed(2)})`,
          `Volatility: ${mlPrediction.volatility.level.toUpperCase()}`,
          `Recommended hold: ${mlPrediction.holdingPeriod.days} days (${mlPrediction.holdingPeriod.hours}h) - ${mlPrediction.holdingPeriod.reason}`,
          `Risk level: ${mlPrediction.risk.level.toUpperCase()} (${mlPrediction.risk.score}/100)`,
          ...mlPrediction.risk.factors
        ]
      });

      // Record prediction for tracking
      tracker.recordPrediction({
        symbol,
        timestamp: Date.now(),
        prediction: {
          direction: mlPrediction.direction.prediction === 'bullish' ? 'UP' : 'DOWN',
          confidence: mlPrediction.direction.confidence,
          priceTarget: mlPrediction.price.predicted
        }
      });

      // Also track signal for live performance monitoring
      await signalPerformanceTracker.trackSignal({
        id: `ml-${symbol}-${Date.now()}`,
        symbol,
        price: mlPrediction.price.predicted,
        takeProfit: mlPrediction.price.high,
        stopLoss: mlPrediction.price.low,
        source: 'ml',
        timestamp: Date.now()
      }).catch(err => console.error('[ML Signals] Failed to track signal:', err));
    }

    res.json({ 
      success: true,
      predictions,
      count: predictions.length,
      timestamp: new Date().toISOString(),
      dataSource: 'gateway_real_data',
      totalFramesAnalyzed: recentFrames.length,
      symbolsAnalyzed: symbolFrames.size
    });

  } catch (err: any) {
    console.error('[ML Signals] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      predictions: [],
      dataSource: 'error'
    });
  }
});

/**
 * Calculate historical accuracy of predictions for a symbol
 */
async function calculateHistoricalAccuracy(symbol: string, frames: MarketFrame[]): Promise<number> {
  if (frames.length < 50) return 50; // Not enough data

  let correct = 0;
  let total = 0;

  // Check last 20 predictions
  for (let i = 30; i < Math.min(frames.length - 10, 50); i++) {
    const chartData = frames.slice(0, i + 1).map(f => ({
      timestamp: new Date(f.timestamp).getTime(),
      open: (f.price as any).open || 0,
      high: (f.price as any).high || 0,
      low: (f.price as any).low || 0,
      close: (f.price as any).close || 0,
      volume: f.volume,
      rsi: (f.indicators as any).rsi || null,
      macd: (f.indicators as any).macd?.macd || null,
      ema: (f.indicators as any).ema20 || null,
    }));

    try {
      const prediction = await MLPredictionService.generatePredictions(chartData);
      const futurePrice = (frames[i + 5].price as any).close;
      const currentPrice = (frames[i].price as any).close;
      const actualDirection = futurePrice > currentPrice ? 'bullish' : 'bearish';

      if (prediction.direction.prediction === actualDirection) {
        correct++;
      }
      total++;
    } catch (err) {
      // Skip failed predictions
    }
  }

  return total > 0 ? Math.round((correct / total) * 100) : 50;
}

/**
 * GET /api/ml-engine/status
 * Get ML engine status with real feature analysis
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const insights = mlEnhancer.getModelInsights();

    // Get market data from a few symbols
    const defaultSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    const recentFrames: MarketFrame[] = [];
    for (const symbol of defaultSymbols) {
      const frames = await storage.getMarketFrames(symbol, 30);
      recentFrames.push(...frames);
    }

    // Calculate feature coverage
    const featureCoverage = calculateFeatureCoverage(recentFrames);

    res.json({
      status: 'active',
      featureImportance: insights,
      featureCoverage,
      dataPoints: recentFrames.length,
      modelsActive: ['direction', 'price', 'volatility', 'holdingPeriod', 'risk'],
      timestamp: new Date().toISOString(),
      dataSource: 'real_market_data'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Calculate what percentage of the 67 features are available in data
 */
function calculateFeatureCoverage(frames: MarketFrame[]): any {
  if (frames.length === 0) {
    return { total: 67, available: 0, coverage: 0 };
  }

  const sampleFrame = frames[0];
  const indicators = sampleFrame.indicators as any;
  const orderFlow = sampleFrame.orderFlow as any;
  const microstructure = sampleFrame.marketMicrostructure as any;

  let available = 0;

  // Check indicator features (~19)
  if (indicators?.rsi) available++;
  if (indicators?.macd) available += 3;
  if (indicators?.bb) available += 3;
  if (indicators?.ema20) available++;
  if (indicators?.ema50) available++;
  if (indicators?.ema200) available++;
  if (indicators?.stoch_k) available++;
  if (indicators?.stoch_d) available++;
  if (indicators?.adx) available++;
  if (indicators?.vwap) available++;
  if (indicators?.atr) available++;

  // Check order flow features (~13)
  if (orderFlow?.bidVolume) available++;
  if (orderFlow?.askVolume) available++;
  if (orderFlow?.netFlow) available++;
  if (orderFlow?.largeOrders) available++;

  // Check microstructure features (~6)
  if (microstructure?.spread) available++;
  if (microstructure?.depth) available++;
  if (microstructure?.imbalance) available++;
  if (microstructure?.toxicity) available++;

  // Base features (price, volume, etc.)
  available += 10;

  return {
    total: 67,
    available,
    coverage: Math.round((available / 67) * 100)
  };
}

export default router;