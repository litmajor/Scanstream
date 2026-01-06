/**
 * 🧪 MODE DETECTION INTEGRATION TEST
 * 
 * Verifies that mode detection and confidence scoring work correctly
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getModeDetector, ModeDetector } from '../server/services/market-data/mode-detector';
import { getConfidenceScorer } from '../server/services/market-data/confidence-scorer';
import { OperationMode } from '../server/types/market-data';
import type { WorldTick } from '../server/types/market-data';

describe('Mode Detection & Confidence Scoring', () => {
  let detector: ModeDetector;

  beforeEach(() => {
    detector = getModeDetector();
    detector.reset();
  });

  describe('ModeDetector', () => {
    it('should start in REPLAY mode (no data)', () => {
      const mode = detector.detectMode();
      expect(mode).toBe(OperationMode.REPLAY);
    });

    it('should transition to MIXED when backfill starts', () => {
      detector.setBackfillComplete(false);
      detector.recordTick('rest');
      detector.recordEmitLag(30000); // 30s lag
      
      const mode = detector.detectMode();
      expect(mode).toBe(OperationMode.MIXED);
    });

    it('should stay in MIXED during backfill', () => {
      detector.setBackfillComplete(false);
      for (let i = 0; i < 100; i++) {
        detector.recordTick('rest');
        detector.recordEmitLag(45000 + Math.random() * 15000);
      }
      
      const metrics = detector.getMetrics();
      expect(metrics.backfillComplete).toBe(false);
      expect(metrics.mode).toBe(OperationMode.MIXED);
    });

    it('should transition to LIVE after backfill completes', () => {
      // Simulate heavy WebSocket traffic after backfill
      detector.setBackfillComplete(true);
      detector.setMemoryFillLevel(85);
      detector.setMicrostructureActive(true);
      
      for (let i = 0; i < 50; i++) {
        detector.recordTick('ws');
        detector.recordEmitLag(800 + Math.random() * 400);
      }
      
      const mode = detector.detectMode();
      expect(mode).toBe(OperationMode.LIVE);
    });

    it('should detect REPLAY from large emit-lag', () => {
      detector.recordTick('rest');
      detector.recordEmitLag(456789); // 456 seconds ago
      
      const mode = detector.detectMode();
      expect(mode).toBe(OperationMode.REPLAY);
    });

    it('should track WS percentage correctly', () => {
      for (let i = 0; i < 80; i++) {
        detector.recordTick('ws');
      }
      for (let i = 0; i < 20; i++) {
        detector.recordTick('rest');
      }
      
      const metrics = detector.getMetrics();
      expect(metrics.wsPercentage).toBe(80);
    });
  });

  describe('ConfidenceScorer', () => {
    const scorer = getConfidenceScorer();

    it('should zero confidence in REPLAY mode', () => {
      const tick: WorldTick = {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 1000000, // 1M ms ago
        emitTime: Date.now(),
        mode: OperationMode.REPLAY,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      };

      const result = scorer.score(0.95, tick);
      expect(result.adjusted).toBe(0);
      expect(result.canTrade).toBe(false);
    });

    it('should cap confidence at 50% in MIXED mode', () => {
      const tick: WorldTick = {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 25000,
        emitTime: Date.now(),
        mode: OperationMode.MIXED,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      };

      const result = scorer.score(0.95, tick);
      expect(result.adjusted).toBe(0.5);
      expect(result.canTrade).toBe(true); // > 0.3
    });

    it('should allow full confidence in LIVE mode', () => {
      const tick: WorldTick = {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 500,
        emitTime: Date.now(),
        mode: OperationMode.LIVE,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      };

      const result = scorer.score(0.95, tick);
      expect(result.adjusted).toBe(0.95);
      expect(result.canTrade).toBe(true);
    });

    it('should reject low confidence regardless of mode', () => {
      const tick: WorldTick = {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 500,
        emitTime: Date.now(),
        mode: OperationMode.LIVE,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      };

      const result = scorer.score(0.2, tick); // Below 0.3 threshold
      expect(result.canTrade).toBe(false);
    });

    it('should generate meaningful reason strings', () => {
      const tick: WorldTick = {
        symbol: 'BTC/USDT',
        timeframe: 60,
        worldTime: Date.now() - 500,
        emitTime: Date.now(),
        mode: OperationMode.LIVE,
        candle: {} as any,
        isFinal: true,
        source: 'test',
      };

      const result = scorer.score(0.85, tick);
      expect(result.reason).toContain('LIVE');
      expect(result.reason).toContain('85');
    });
  });

  describe('Mode Transitions', () => {
    it('should handle full lifecycle: REPLAY → MIXED → LIVE', () => {
      // Start: REPLAY (no data)
      expect(detector.detectMode()).toBe(OperationMode.REPLAY);

      // Backfill starts: MIXED
      detector.setBackfillComplete(false);
      for (let i = 0; i < 10; i++) {
        detector.recordTick('rest');
        detector.recordEmitLag(30000);
      }
      expect(detector.detectMode()).toBe(OperationMode.MIXED);

      // Backfill completes, WS takes over: LIVE
      detector.setBackfillComplete(true);
      detector.setMemoryFillLevel(90);
      detector.setMicrostructureActive(true);
      for (let i = 0; i < 50; i++) {
        detector.recordTick('ws');
        detector.recordEmitLag(1000);
      }
      expect(detector.detectMode()).toBe(OperationMode.LIVE);

      // Verify metrics
      const metrics = detector.getMetrics();
      expect(metrics.wsPercentage).toBeGreaterThan(80);
      expect(metrics.avgEmitLag).toBeLessThan(2000);
      expect(metrics.backfillComplete).toBe(true);
    });

    it('should emit diagnostic string', () => {
      detector.setBackfillComplete(true);
      detector.setMemoryFillLevel(85);
      detector.setMicrostructureActive(true);
      for (let i = 0; i < 30; i++) {
        detector.recordTick('ws');
        detector.recordEmitLag(900);
      }

      const diag = detector.diagnostics();
      expect(diag).toContain('LIVE');
      expect(diag).toContain('WS:');
      expect(diag).toContain('Backfill:');
    });
  });

  describe('Confidence Scorer Diagnostics', () => {
    const scorer = getConfidenceScorer();

    it('should provide thresholds', () => {
      const diag = scorer.diagnostics();
      expect(diag).toContain('REPLAY');
      expect(diag).toContain('MIXED');
      expect(diag).toContain('LIVE');
      expect(diag).toContain('no trading');
      expect(diag).toContain('capped');
      expect(diag).toContain('unlimited');
    });

    it('should score with current mode', () => {
      detector.setBackfillComplete(true);
      detector.setMemoryFillLevel(90);
      detector.setMicrostructureActive(true);
      for (let i = 0; i < 30; i++) {
        detector.recordTick('ws');
        detector.recordEmitLag(900);
      }

      // Use scorer without tick
      const result = scorer.scoreWithCurrentMode(0.85);
      expect(result.mode).toBe(OperationMode.LIVE);
      expect(result.adjusted).toBe(0.85);
    });
  });
});
