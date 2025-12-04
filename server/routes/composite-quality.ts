
import { Router } from 'express';
import { compositeEntryQualityEngine } from '../services/composite-entry-quality';
import { storage } from '../storage';

const router = Router();

/**
 * GET /api/composite-quality/:symbol
 * Calculate composite entry quality for a symbol
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { direction = 'LONG' } = req.query;

    // Get latest market data
    const frames = await storage.getMarketFrames(symbol, 1);
    if (frames.length === 0) {
      return res.status(404).json({ error: 'No market data available' });
    }

    const marketData = frames[0];
    const quality = compositeEntryQualityEngine.calculateEntryQuality(
      marketData,
      direction as 'LONG' | 'SHORT'
    );

    res.json({
      symbol,
      direction,
      timestamp: marketData.timestamp,
      quality,
      recommendation: quality.quality === 'excellent' || quality.quality === 'good'
        ? 'ENTER'
        : quality.quality === 'fair'
        ? 'CAUTION'
        : 'AVOID'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/composite-quality/batch
 * Batch analyze multiple signals
 */
router.post('/batch', async (req, res) => {
  try {
    const { signals } = req.body; // Array of { symbol, direction }
    
    const results = await Promise.all(
      signals.map(async (signal: any) => {
        const frames = await storage.getMarketFrames(signal.symbol, 1);
        if (frames.length === 0) return null;

        const quality = compositeEntryQualityEngine.calculateEntryQuality(
          frames[0],
          signal.direction
        );

        return {
          symbol: signal.symbol,
          direction: signal.direction,
          quality,
          recommendation: quality.quality === 'excellent' || quality.quality === 'good'
            ? 'ENTER'
            : quality.quality === 'fair'
            ? 'CAUTION'
            : 'AVOID'
        };
      })
    );

    const filtered = results.filter(r => r !== null);

    res.json({
      total: signals.length,
      analyzed: filtered.length,
      results: filtered,
      summary: {
        excellent: filtered.filter(r => r.quality.quality === 'excellent').length,
        good: filtered.filter(r => r.quality.quality === 'good').length,
        fair: filtered.filter(r => r.quality.quality === 'fair').length,
        poor: filtered.filter(r => r.quality.quality === 'poor').length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/composite-quality/filter/:minQuality
 * Get all signals above minimum quality threshold
 */
router.get('/filter/:minQuality', async (req, res) => {
  try {
    const minQuality = parseFloat(req.params.minQuality);
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']; // Example symbols

    const allSignals = await Promise.all(
      symbols.map(async symbol => {
        const frames = await storage.getMarketFrames(symbol, 1);
        if (frames.length === 0) return null;

        return {
          marketData: frames[0],
          direction: 'LONG' as const,
          symbol
        };
      })
    );

    const validSignals = allSignals.filter(s => s !== null);
    const filtered = compositeEntryQualityEngine.filterByQuality(
      validSignals,
      minQuality
    );

    res.json({
      minQuality,
      totalScanned: symbols.length,
      qualifiedSignals: filtered.length,
      signals: filtered.map(item => ({
        symbol: item.symbol,
        direction: item.direction,
        quality: item.quality,
        price: item.marketData.price.close
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
