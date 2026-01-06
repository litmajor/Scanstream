/**
 * 🔍 MODE DIAGNOSTICS ROUTES
 * 
 * Endpoints for monitoring system mode, backfill progress, and confidence thresholds.
 */

import { Router } from 'express';
import { getModeDetector } from '../services/market-data/mode-detector';
import { getConfidenceScorer } from '../services/market-data/confidence-scorer';
import { OperationMode } from '../types/market-data';

const router = Router();

/**
 * GET /api/diagnostics/mode
 * 
 * Current mode and metrics
 */
router.get('/mode', (req, res) => {
  try {
    const detector = getModeDetector();
    const metrics = detector.getMetrics();

    res.json({
      ok: true,
      data: metrics,
      diagnostics: detector.diagnostics(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
});

/**
 * GET /api/diagnostics/confidence
 * 
 * Confidence scoring rules by mode
 */
router.get('/confidence', (req, res) => {
  try {
    const scorer = getConfidenceScorer();

    // Example scores
    const examples = {
      replay: scorer.score(0.95, {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 1000000,
        emitTime: Date.now(),
        mode: OperationMode.REPLAY,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      }),
      mixed: scorer.score(0.95, {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 10000,
        emitTime: Date.now(),
        mode: OperationMode.MIXED,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      }),
      live: scorer.score(0.95, {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 500,
        emitTime: Date.now(),
        mode: OperationMode.LIVE,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      }),
    };

    res.json({
      ok: true,
      data: {
        diagnostics: scorer.diagnostics(),
        examples,
        note: 'Shows how raw confidence (0.95) is adjusted by mode',
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
});

/**
 * GET /api/diagnostics/system
 * 
 * Full system diagnostics (mode + confidence)
 */
router.get('/system', (req, res) => {
  try {
    const detector = getModeDetector();
    const scorer = getConfidenceScorer();
    const modeMetrics = detector.getMetrics();

    res.json({
      ok: true,
      data: {
        mode: modeMetrics,
        confidence: {
          diagnostics: scorer.diagnostics(),
          currentMode: modeMetrics.mode,
        },
        interpretation: {
          'mode-REPLAY':
            'Historical backfill from REST API. No trading, confidence = 0%',
          'mode-MIXED':
            'REST backfill + WebSocket updates. Confidence capped at 50%.',
          'mode-LIVE':
            'Pure WebSocket, memory filled. Full confidence allowed.',
          'ws-percentage': `${modeMetrics.wsPercentage}% of ticks from WebSocket`,
          'emit-lag': `${modeMetrics.avgEmitLag}ms average (< 2s = LIVE, > 60s = REPLAY)`,
          'backfill': modeMetrics.backfillComplete ? 'COMPLETE' : 'IN PROGRESS',
          'microstructure': modeMetrics.microstructureActive ? 'ACTIVE' : 'INACTIVE',
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
});

/**
 * POST /api/diagnostics/mode/reset
 * 
 * Reset mode detector (for testing)
 */
router.post('/mode/reset', (req, res) => {
  try {
    const detector = getModeDetector();
    detector.reset();

    res.json({
      ok: true,
      message: 'Mode detector reset',
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: (err as any)?.message || String(err),
    });
  }
});

export default router;
