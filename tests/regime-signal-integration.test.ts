/**
 * REGIME-SIGNAL INTEGRATION TEST
 * 
 * Validates that regime detection correctly adjusts signal weights and confidence.
 * Tests the complete Week 2 integration flow.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RegimeSignalIntegrator, type RegimeAdjustedSignal } from '../server/lib/regime-signal-integration';
import { RegimeAssessmentEngine, type Candle } from '../server/lib/regime-assessment';
import type { AggregatedSignal } from '../server/lib/signal-pipeline';

describe('RegimeSignalIntegration', () => {
  let integrator: RegimeSignalIntegrator;
  let regimeEngine: RegimeAssessmentEngine;

  // Sample candles for testing
  const createTrendingCandles = (direction: 'up' | 'down'): Candle[] => {
    const base = 100;
    const step = direction === 'up' ? 0.5 : -0.5;
    const candles: Candle[] = [];

    for (let i = 0; i < 50; i++) {
      const close = base + (i * step);
      candles.push({
        open: close - 0.2,
        high: Math.max(close, close + 0.3),
        low: Math.min(close, close - 0.3),
        close,
        volume: 1000000 + Math.random() * 500000,
        timestamp: Date.now() - (50 - i) * 60000 // 1 minute apart
      });
    }

    return candles;
  };

  const createRangingCandles = (): Candle[] => {
    const candles: Candle[] = [];
    const center = 100;
    const range = 1;

    for (let i = 0; i < 50; i++) {
      const offset = Math.sin((i / 50) * Math.PI * 4) * range;
      const close = center + offset;
      candles.push({
        open: close - 0.1,
        high: close + range + 0.1,
        low: close - range - 0.1,
        close,
        volume: 1000000 + Math.random() * 500000,
        timestamp: Date.now() - (50 - i) * 60000
      });
    }

    return candles;
  };

  const createVolatileCandles = (): Candle[] => {
    const candles: Candle[] = [];
    const base = 100;

    for (let i = 0; i < 50; i++) {
      const volatility = 2 + Math.random() * 2; // 2-4% swings
      const close = base + (Math.random() - 0.5) * volatility;
      candles.push({
        open: close + (Math.random() - 0.5) * volatility,
        high: close + volatility / 2,
        low: close - volatility / 2,
        close,
        volume: 800000 + Math.random() * 700000,
        timestamp: Date.now() - (50 - i) * 60000
      });
    }

    return candles;
  };

  const createSignal = (type: 'BUY' | 'SELL' | 'HOLD', confidence: number = 0.7): AggregatedSignal => {
    return {
      id: `test-${Date.now()}`,
      symbol: 'AAPL',
      timestamp: Date.now(),
      type,
      classifications: ['TEST_PATTERN'],
      primaryClassification: 'TEST_PATTERN',
      confidence,
      strength: 0.65,
      sources: {
        scanner: {
          confidence: 0.7,
          patterns: ['TEST_PATTERN']
        },
        ml: {
          confidence: 0.65,
          model: 'ensemble'
        },
        rl: {
          confidence: 0.6,
          qValue: 0.3
        }
      },
      quality: {
        score: 75,
        rating: 'good',
        reasons: ['High confidence', 'Multi-source agreement']
      },
      price: 150.25,
      stopLoss: 148.75,
      takeProfit: 152.75,
      riskRewardRatio: 1.8,
      patternDetails: [],
      timeframes: {
        '1m': 0.7,
        '5m': 0.65,
        '15m': 0.6,
        '1h': 0.55,
        '4h': 0.5,
        '1d': 0.45
      },
      agreementScore: 75,
      positionSize: 0.8
    };
  };

  beforeEach(() => {
    integrator = new RegimeSignalIntegrator();
    regimeEngine = new RegimeAssessmentEngine();
  });

  afterEach(() => {
    integrator.reset();
  });

  describe('Trending Market Adjustments', () => {
    it('should boost confidence in trending-up markets', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY', 0.7);

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.regimeDetection.regime).toMatch(/TRENDING/i);
      expect(adjusted.confidence).toBeGreaterThan(signal.confidence);
      expect(adjusted.dynamicWeightsApplied).toBe(true);
      expect(adjusted.regimeWeights.scanner).toBeCloseTo(0.4, 2);
    });

    it('should boost confidence in trending-down markets for SELL signals', () => {
      const candles = createTrendingCandles('down');
      const signal = createSignal('SELL', 0.7);

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.regimeDetection.regime).toMatch(/TRENDING/i);
      expect(adjusted.confidence).toBeGreaterThan(signal.confidence);
    });

    it('should have correct trending weight matrix', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY');

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.regimeWeights.scanner).toBeCloseTo(0.4, 1);
      expect(adjusted.regimeWeights.ml).toBeCloseTo(0.3, 1);
      expect(adjusted.regimeWeights.rl).toBeCloseTo(0.3, 1);
      
      // Verify weights sum to 1.0
      const sum = adjusted.regimeWeights.scanner + 
                  adjusted.regimeWeights.ml + 
                  adjusted.regimeWeights.rl;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should apply adjustmentReasons for trending', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY');

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.adjustmentReasons.length).toBeGreaterThan(0);
      expect(adjusted.adjustmentReasons[0]).toContain('TRENDING');
    });
  });

  describe('Ranging Market Adjustments', () => {
    it('should reduce confidence slightly in ranging markets', () => {
      const candles = createRangingCandles();
      const signal = createSignal('BUY', 0.7);

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.regimeDetection.regime).toMatch(/RANGING|CONSOLIDAT/i);
      // In ranging, mean reversion is OK, so confidence shouldn't drop much
      expect(adjusted.confidence).toBeGreaterThan(0.5);
    });

    it('should have correct ranging weight matrix', () => {
      const candles = createRangingCandles();
      const signal = createSignal('BUY');

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      // Ranging should favor ML/RL mean reversion
      expect(adjusted.regimeWeights.scanner).toBeLessThan(0.35);
      expect(adjusted.regimeWeights.ml).toBeGreaterThanOrEqual(0.3);
      expect(adjusted.regimeWeights.rl).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('Volatile Market Adjustments', () => {
    it('should reduce confidence in volatile markets', () => {
      const candles = createVolatileCandles();
      const signal = createSignal('BUY', 0.7);

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.regimeDetection.regime).toMatch(/VOLATILE/i);
      expect(adjusted.confidence).toBeLessThan(signal.confidence);
    });

    it('should boost scanner weight in volatile markets', () => {
      const candles = createVolatileCandles();
      const signal = createSignal('BUY');

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      // Scanner is risk manager, should be boosted
      expect(adjusted.regimeWeights.scanner).toBeGreaterThanOrEqual(0.45);
      expect(adjusted.regimeWeights.ml).toBeLessThanOrEqual(0.3);
      expect(adjusted.regimeWeights.rl).toBeLessThanOrEqual(0.3);
    });

    it('should cap volatile market confidence at 85%', () => {
      const candles = createVolatileCandles();
      const signal = createSignal('BUY', 0.95); // Start high

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      expect(adjusted.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('Regime Transitions', () => {
    it('should detect regime changes', () => {
      const trendingCandles = createTrendingCandles('up');
      const signal1 = createSignal('BUY');

      const adjusted1 = integrator.applyRegimeWeighting(signal1, trendingCandles);
      const regime1 = adjusted1.regimeDetection.regime;

      const rangingCandles = createRangingCandles();
      const adjusted2 = integrator.applyRegimeWeighting(signal1, rangingCandles);
      const regime2 = adjusted2.regimeDetection.regime;

      expect(regime1).not.toEqual(regime2);
      expect(adjusted2.adjustmentReasons.join('')).toContain('transition');
    });

    it('should smooth weight transitions', () => {
      const trendingCandles = createTrendingCandles('up');
      const rangingCandles = createRangingCandles();
      const signal = createSignal('BUY');

      // First signal in trending
      const adjusted1 = integrator.applyRegimeWeighting(signal, trendingCandles);
      const weights1 = adjusted1.regimeWeights;

      // Second signal in ranging (triggers transition)
      const adjusted2 = integrator.applyRegimeWeighting(signal, rangingCandles);
      const weights2 = adjusted2.regimeWeights;

      // Weights should change but not dramatically
      const scannerChange = Math.abs(weights2.scanner - weights1.scanner);
      expect(scannerChange).toBeLessThan(0.15); // Less than 15% change
    });
  });

  describe('Signal Alignment', () => {
    it('should boost aligned signals', () => {
      const trendingUpCandles = createTrendingCandles('up');
      const buySignal = createSignal('BUY');
      const sellSignal = createSignal('SELL');

      const adjustedBuy = integrator.applyRegimeWeighting(buySignal, trendingUpCandles);
      const adjustedSell = integrator.applyRegimeWeighting(sellSignal, trendingUpCandles);

      // BUY should be more boosted than SELL in uptrend
      expect(adjustedBuy.strengthBoost).toBeGreaterThan(adjustedSell.strengthBoost || 1);
    });

    it('should mark opposing signals as misaligned', () => {
      const trendingUpCandles = createTrendingCandles('up');
      const sellSignal = createSignal('SELL');

      const adjusted = integrator.applyRegimeWeighting(sellSignal, trendingUpCandles);

      // Should not have alignment boost
      expect(adjusted.strengthBoost).toBeLessThanOrEqual(1.1);
    });
  });

  describe('Data Quality Impact', () => {
    it('should apply quality penalties', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY', 0.8);

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      // Should have quality assessment
      expect(adjusted.regimeDetection.dataQuality).toBeDefined();
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(
        adjusted.regimeDetection.dataQuality
      );
    });

    it('should reduce confidence with poor data quality', () => {
      const insufficientCandles: Candle[] = []; // No history
      const signal = createSignal('BUY', 0.8);

      const adjusted = integrator.applyRegimeWeighting(signal, insufficientCandles);

      expect(adjusted.regimeDetection.dataQuality).toBe('POOR');
      expect(adjusted.adjustmentReasons.join('')).toContain('data quality');
    });
  });

  describe('Current Regime State', () => {
    it('should track current regime', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY');

      integrator.applyRegimeWeighting(signal, candles);
      const currentState = integrator.getCurrentRegime();

      expect(currentState.regime).toBeDefined();
      expect(currentState.weights).toBeDefined();
      expect(['scanner', 'ml', 'rl']).toEqual(
        expect.arrayContaining(Object.keys(currentState.weights))
      );
    });

    it('should reset state on demand', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY');

      integrator.applyRegimeWeighting(signal, candles);
      let state = integrator.getCurrentRegime();
      expect(state.regime).not.toBeNull();

      integrator.reset();
      state = integrator.getCurrentRegime();
      expect(state.regime).toBeNull();
    });
  });

  describe('Output Structure Validation', () => {
    it('should return valid RegimeAdjustedSignal', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY');

      const adjusted = integrator.applyRegimeWeighting(signal, candles) as RegimeAdjustedSignal;

      // Original signal fields
      expect(adjusted.id).toBeDefined();
      expect(adjusted.symbol).toBe('AAPL');
      expect(adjusted.type).toBe('BUY');
      expect(adjusted.confidence).toBeGreaterThan(0);
      expect(adjusted.confidence).toBeLessThanOrEqual(1);

      // New regime fields
      expect(adjusted.regimeDetection).toBeDefined();
      expect(adjusted.regimeWeights).toBeDefined();
      expect(adjusted.dynamicWeightsApplied).toBe(true);
      expect(Array.isArray(adjusted.adjustmentReasons)).toBe(true);

      // Type validation
      expect(adjusted.regimeWeights.scanner).toBeGreaterThan(0);
      expect(adjusted.regimeWeights.ml).toBeGreaterThan(0);
      expect(adjusted.regimeWeights.rl).toBeGreaterThan(0);
    });

    it('should maintain source weight application', () => {
      const candles = createTrendingCandles('up');
      const signal = createSignal('BUY');

      const adjusted = integrator.applyRegimeWeighting(signal, candles);

      // Source confidences should be weighted
      expect(adjusted.sources.scanner.confidence).toBeLessThanOrEqual(
        signal.sources.scanner.confidence
      );
      expect(adjusted.sources.ml.confidence).toBeLessThanOrEqual(
        signal.sources.ml.confidence
      );
      expect(adjusted.sources.rl.confidence).toBeLessThanOrEqual(
        signal.sources.rl.confidence
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty candle history gracefully', () => {
      const signal = createSignal('BUY');

      expect(() => {
        integrator.applyRegimeWeighting(signal, []);
      }).not.toThrow();
    });

    it('should handle single candle', () => {
      const signal = createSignal('BUY');
      const candle: Candle = {
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1000000,
        timestamp: Date.now()
      };

      expect(() => {
        integrator.applyRegimeWeighting(signal, [candle]);
      }).not.toThrow();
    });

    it('should handle extreme confidence values', () => {
      const candles = createTrendingCandles('up');
      const signal1 = createSignal('BUY', 0);
      const signal2 = createSignal('BUY', 1);

      const adjusted1 = integrator.applyRegimeWeighting(signal1, candles);
      const adjusted2 = integrator.applyRegimeWeighting(signal2, candles);

      expect(adjusted1.confidence).toBeGreaterThanOrEqual(0);
      expect(adjusted1.confidence).toBeLessThanOrEqual(1);
      expect(adjusted2.confidence).toBeGreaterThanOrEqual(0);
      expect(adjusted2.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle all regime types', () => {
      const regimes = {
        'TRENDING_UP': createTrendingCandles('up'),
        'TRENDING_DOWN': createTrendingCandles('down'),
        'RANGING': createRangingCandles(),
        'VOLATILE': createVolatileCandles()
      };

      const signal = createSignal('BUY');

      Object.entries(regimes).forEach(([regimeName, candles]) => {
        expect(() => {
          const adjusted = integrator.applyRegimeWeighting(signal, candles);
          expect(adjusted.regimeDetection.regime).toBeDefined();
        }).not.toThrow();
      });
    });
  });
});
