import { Router, Request, Response } from 'express';
import { signalQualityEngine, type SignalMetrics } from '../lib/signal-quality';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * Analyze quality of signals
 * POST /api/signals/analyze-quality
 */
router.post('/analyze-quality', async (req: Request, res: Response) => {
  try {
    const { signals, minScore = 60 } = req.body;

    if (!Array.isArray(signals)) {
      return res.status(400).json({ error: 'Signals must be an array' });
    }

    const qualityResults = await Promise.all(
      signals.map(async (signal: SignalMetrics) => {
        const quality = await signalQualityEngine.calculateQualityScore(signal, signals);
        return { signal, quality };
      })
    );

    const filtered = qualityResults.filter(
      ({ quality }) => quality.overallScore >= minScore && quality.rating !== 'filtered'
    );

    res.json({
      total: signals.length,
      qualified: filtered.length,
      signals: filtered.map(({ signal, quality }) => ({
        signal,
        quality,
        status: 'passed'
      })),
      filtered: qualityResults
        .filter(({ quality }) => quality.overallScore < minScore || quality.rating === 'filtered')
        .map(({ signal, quality }) => ({
          symbol: signal.symbol,
          reason: quality.rating === 'filtered' ? 'Insufficient quality' : 'Below minimum score',
          score: quality.overallScore
        }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get consolidated best signal per symbol
 * POST /api/signals/consolidate
 */
router.post('/consolidate', async (req: Request, res: Response) => {
  try {
    const { signals } = req.body;

    if (!Array.isArray(signals)) {
      return res.status(400).json({ error: 'Signals must be an array' });
    }

    const consolidated = await signalQualityEngine.consolidateSignals(signals);
    const result = Array.from(consolidated.entries()).map(([symbol, { signal, quality }]) => ({
      symbol,
      signal,
      quality,
      recommendation: quality.rating === 'excellent' ? 'strong_buy/sell' : quality.rating === 'good' ? 'buy/sell' : 'hold'
    }));

    res.json({
      total: consolidated.size,
      signals: result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Rank signals by quality
 * POST /api/signals/rank
 */
router.post('/rank', async (req: Request, res: Response) => {
  try {
    const { signals, limit = 10 } = req.body;

    if (!Array.isArray(signals)) {
      return res.status(400).json({ error: 'Signals must be an array' });
    }

    const ranked = await signalQualityEngine.rankSignals(signals);
    const topSignals = ranked.slice(0, limit);

    res.json({
      total: signals.length,
      top: topSignals.map(({ signal, quality, rank }) => ({
        rank,
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: quality.confidenceScore,
        score: quality.overallScore,
        rating: quality.rating,
        reasons: quality.reasons
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get signals filtered by quality
 * GET /api/signals/high-quality
 */
router.get('/high-quality', async (req: Request, res: Response) => {
  try {
    const { symbol, minScore = 70, limit = 20 } = req.query;

    let query: any = { orderBy: { timestamp: 'desc' }, take: parseInt(limit as string) };

    if (symbol) {
      query.where = { symbol: (symbol as string).toUpperCase() };
    }

    const dbSignals = await prisma.signal.findMany(query);

    const signals: SignalMetrics[] = dbSignals.map(s => ({
      id: s.id,
      symbol: s.symbol,
      type: s.type,
      strength: s.strength,
      confidence: s.confidence,
      direction: (s.reasoning as any)?.direction || 'hold',
      price: s.price,
      timestamp: s.timestamp,
      reasoning: s.reasoning as Record<string, any>
    }));

    const qualified = await signalQualityEngine.filterByQuality(signals, parseInt(minScore as string));

    const withQuality = await Promise.all(
      qualified.map(async (signal) => ({
        signal,
        quality: await signalQualityEngine.calculateQualityScore(signal, signals)
      }))
    );

    res.json({
      total: signals.length,
      qualified: qualified.length,
      signals: withQuality.map(({ signal, quality }) => ({
        ...signal,
        qualityScore: quality.overallScore,
        rating: quality.rating,
        reasons: quality.reasons
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Compare signals and show alignment
 * POST /api/signals/compare
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Get multiple types of signals for the same symbol
    const signals = await prisma.signal.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    if (signals.length === 0) {
      return res.status(404).json({ error: 'No signals found for this symbol' });
    }

    // Convert to SignalMetrics
    const typedSignals: SignalMetrics[] = signals.map(s => ({
      id: s.id,
      symbol: s.symbol,
      type: s.type,
      strength: s.strength,
      confidence: s.confidence,
      direction: (s.reasoning as any)?.direction || 'hold',
      price: s.price,
      timestamp: s.timestamp,
      reasoning: s.reasoning as Record<string, any>
    }));

    // Group by type
    const byType = new Map<string, SignalMetrics[]>();
    typedSignals.forEach(signal => {
      if (!byType.has(signal.type)) {
        byType.set(signal.type, []);
      }
      byType.get(signal.type)!.push(signal);
    });

    // Analyze each type
    const comparison = Array.from(byType.entries()).map(([type, typeSignals]) => {
      const buySignals = typeSignals.filter(s => s.direction === 'buy').length;
      const sellSignals = typeSignals.filter(s => s.direction === 'sell').length;
      const holdSignals = typeSignals.filter(s => s.direction === 'hold').length;
      const avgStrength = typeSignals.reduce((sum, s) => sum + s.strength, 0) / typeSignals.length;
      const avgConfidence = typeSignals.reduce((sum, s) => sum + s.confidence, 0) / typeSignals.length;

      return {
        type,
        count: typeSignals.length,
        consensus: buySignals > sellSignals ? 'buy' : sellSignals > buySignals ? 'sell' : 'hold',
        distribution: { buy: buySignals, sell: sellSignals, hold: holdSignals },
        avgStrength,
        avgConfidence,
        latestSignal: typeSignals[0]
      };
    });

    res.json({
      symbol,
      totalSignalTypes: comparison.length,
      comparison,
      overallConsensus: comparison.filter(c => c.consensus === 'buy').length > comparison.filter(c => c.consensus === 'sell').length ? 'buy' : 'sell'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
