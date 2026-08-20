
import { Router } from 'express';
import { compositeEntryQualityEngine } from '../services/composite-entry-quality';
import { storage } from '../storage';
import type { MarketFrame } from '@shared/schema';
import { respondToInvalidRouteParam, routeParam } from '../utils/route-params';

const router = Router();

interface CompositeSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
}

interface CompositeResult {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  quality: { quality: 'excellent' | 'good' | 'fair' | 'poor' };
  recommendation: 'ENTER' | 'CAUTION' | 'AVOID';
}

/**
 * GET /api/composite-quality/:symbol
 * Calculate composite entry quality for a symbol
 */
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = routeParam(req.params.symbol, 'symbol', 64);
    const { direction = 'LONG' } = req.query;

    // Get latest market data
    const frames = await storage.getMarketFrames(symbol, 1);
    if (frames.length === 0) {
      return res.status(404).json({ error: 'No market data available' });
    }

    const marketData = frames[0] as any;
    const quality = compositeEntryQualityEngine.calculateEntryQuality(
      marketData as any,
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
    if (respondToInvalidRouteParam(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/composite-quality/batch
 * Batch analyze multiple signals
 */
router.post('/batch', async (req, res) => {
  try {
    const signals = req.body.signals as CompositeSignal[]; // Array of { symbol, direction }
    
    // Batch fetch market frames for all requested signals to avoid N+1
    const uniqueSymbols: string[] = Array.from(new Set(signals.map((s) => s.symbol)));
    const framesMap = (storage.getMarketFramesForSymbols
      ? await storage.getMarketFramesForSymbols(uniqueSymbols, 1)
      : await Promise.all(uniqueSymbols.map(async (sym: string) => ({ [sym]: await storage.getMarketFrames(sym, 1) })))) as Record<string, MarketFrame[]>;

    const results: Array<CompositeResult | null> = signals.map((signal) => {
      const frames = framesMap[signal.symbol] || [];
      if (frames.length === 0) return null;

      const quality = compositeEntryQualityEngine.calculateEntryQuality(
        frames[0] as any,
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
    });

    const filtered = results.filter((r): r is CompositeResult => r !== null);

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
    const minQuality = parseFloat(routeParam(req.params.minQuality, 'minQuality', 16));
    const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT']; // Example symbols

    // Batch fetch frames for symbols
    const framesMap2 = (storage.getMarketFramesForSymbols
      ? await storage.getMarketFramesForSymbols(symbols, 1)
      : await Promise.all(symbols.map(async (sym: string) => ({ [sym]: await storage.getMarketFrames(sym, 1) })))) as Record<string, MarketFrame[]>;

    const allSignals = symbols.map(symbol => {
      const frames = framesMap2[symbol] || [];
      if (frames.length === 0) return null;
      return {
        marketData: frames[0],
        direction: 'LONG' as const,
        symbol
      };
    });

    const validSignals = allSignals.filter(s => s !== null) as any[];
    const filtered = compositeEntryQualityEngine.filterByQuality(
      validSignals as any,
      minQuality
    );

    res.json({
      minQuality,
      totalScanned: symbols.length,
      qualifiedSignals: filtered.length,
      signals: filtered.map(item => ({
        symbol: item.marketData.symbol || 'UNKNOWN',
        direction: item.direction,
        quality: item.quality,
        price: item.marketData.price.close
      }))
    });
  } catch (err: any) {
    if (respondToInvalidRouteParam(err, res)) return;
    res.status(500).json({ error: err.message });
  }
});

export default router;
