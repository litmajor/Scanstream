
import express, { type Request, type Response } from 'express';
import { MLSignalEnhancer } from '../ml-engine';
import { db } from '../db-storage';
import type { MarketFrame } from '@shared/schema';

const router = express.Router();
const mlEnhancer = new MLSignalEnhancer();

/**
 * GET /api/ml-engine/predictions
 * Generate ML-based trading signals for active symbols
 */
router.get('/predictions', async (_req: Request, res: Response) => {
  try {
    // Get active symbols from recent market data
    const recentFrames = await db.getRecentFrames(100);
    
    if (!recentFrames || recentFrames.length === 0) {
      return res.json({ predictions: [] });
    }

    // Group by symbol
    const symbolFrames = new Map<string, MarketFrame[]>();
    for (const frame of recentFrames) {
      if (!symbolFrames.has(frame.symbol)) {
        symbolFrames.set(frame.symbol, []);
      }
      symbolFrames.get(frame.symbol)!.push(frame);
    }

    // Generate predictions for each symbol
    const predictions = [];
    
    for (const [symbol, frames] of symbolFrames.entries()) {
      if (frames.length < 20) continue; // Need minimum data
      
      // Sort by timestamp
      frames.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const currentIndex = frames.length - 1;
      const currentFrame = frames[currentIndex];
      
      // Get ML prediction
      const features = await mlEnhancer.getModelInsights();
      const prediction = await mlEnhancer.enhanceSignal(
        {
          symbol,
          type: 'BUY', // Placeholder, will be determined by ML
          price: currentFrame.price.close,
          confidence: 0.5,
          strength: 0.5,
          timestamp: new Date(),
          reasoning: []
        },
        frames,
        currentIndex
      );

      predictions.push({
        symbol,
        direction: prediction.type === 'BUY' ? 'UP' : 'DOWN',
        confidence: prediction.confidence,
        price: prediction.price,
        timestamp: prediction.timestamp.toISOString(),
        strength: prediction.strength,
        reasoning: prediction.reasoning
      });
    }

    res.json({ 
      success: true,
      predictions,
      count: predictions.length,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error('[ML Signals] Error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      predictions: []
    });
  }
});

/**
 * GET /api/ml-engine/status
 * Get ML engine status and statistics
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const insights = mlEnhancer.getModelInsights();
    
    res.json({
      status: 'active',
      featureImportance: insights,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
