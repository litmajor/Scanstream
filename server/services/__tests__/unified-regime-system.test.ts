/// <reference types="jest" />
// @ts-nocheck
// Unified Regime System Test Suite
// Tests regime detection accuracy, mapping correctness, and characteristics assignment
// File is excluded from TypeScript compilation (see tsconfig.json **/*.test.ts exclude)
// Run with: npm test unified-regime-system.test.ts (after Jest is installed)


import {
  UnifiedRegimeDetector,
  UnifiedRegimes,
  RegimeMapper,
  type UnifiedRegimeType,
  type RegimeDetectionResult,
} from '../unified-regime-system';
import {
  RegimeConsolidationBridge,
} from '../regime-consolidation-bridge';

describe('UnifiedRegimeDetector', () => {
  describe('detectRegime()', () => {
    // Test TRENDING_UP
    it('should detect TRENDING_UP with high ADX and positive price momentum', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 40,
        volatility: 0.025,
        priceVsMA: 0.15,
        rangeWidth: 0.03,
        divergence: 0.3,
        coherence: 0.85,
        momentum: 0.8,
      });

      expect(result.regime).toBe('TRENDING_UP');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.strength).toBeGreaterThan(30);
    });

    // Test TRENDING_DOWN
    it('should detect TRENDING_DOWN with high ADX and negative price momentum', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 45,
        volatility: 0.028,
        priceVsMA: -0.18,
        rangeWidth: 0.03,
        divergence: -0.4,
        coherence: 0.8,
        momentum: -0.85,
      });

      expect(result.regime).toBe('TRENDING_DOWN');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    // Test RANGING
    it('should detect RANGING with low ADX and balanced signals', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 18,
        volatility: 0.022,
        priceVsMA: 0.02,
        rangeWidth: 0.035,
        divergence: 0.05,
        coherence: 0.65,
        momentum: 0.1,
      });

      expect(result.regime).toBe('RANGING');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    // Test VOLATILE
    it('should detect VOLATILE with extreme volatility', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 25,
        volatility: 0.095,
        priceVsMA: 0.3,
        rangeWidth: 0.08,
        divergence: 0.7,
        coherence: 0.5,
        momentum: 0.9,
      });

      expect(result.regime).toBe('VOLATILE');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    // Test CONSOLIDATING
    it('should detect CONSOLIDATING with tight compression and low ADX', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 12,
        volatility: 0.012,
        priceVsMA: -0.003,
        rangeWidth: 0.011,
        divergence: 0,
        coherence: 0.9,
        momentum: 0,
      });

      expect(result.regime).toBe('CONSOLIDATING');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    // Test BREAKOUT_TRANSITION
    it('should detect BREAKOUT_TRANSITION with maximum compression', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 10,
        volatility: 0.008,
        priceVsMA: 0,
        rangeWidth: 0.007,
        divergence: 0.1,
        coherence: 0.92,
        momentum: 0.05,
      });

      expect(result.regime).toBe('BREAKOUT_TRANSITION');
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    // Test ACCUMULATION
    it('should detect ACCUMULATION with buying pressure at lows', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 15,
        volatility: 0.02,
        priceVsMA: -0.12,
        rangeWidth: 0.025,
        divergence: 0.45,
        coherence: 0.75,
        momentum: 0.1,
        rsi: 35,
      });

      expect(result.regime).toBe('ACCUMULATION');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    // Test DISTRIBUTION
    it('should detect DISTRIBUTION with selling pressure at highs', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 16,
        volatility: 0.019,
        priceVsMA: 0.14,
        rangeWidth: 0.028,
        divergence: -0.5,
        coherence: 0.8,
        momentum: -0.05,
        rsi: 62,
      });

      expect(result.regime).toBe('DISTRIBUTION');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    // Test result structure
    it('should return complete RegimeDetectionResult with all fields', () => {
      const result = UnifiedRegimeDetector.detectRegime({
        adx: 35,
        volatility: 0.025,
        priceVsMA: 0.1,
        rangeWidth: 0.03,
        divergence: 0.2,
        coherence: 0.8,
        momentum: 0.5,
      });

      expect(result).toHaveProperty('regime');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('strength');
      expect(result).toHaveProperty('indicators');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(100);
    });

    // Test confidence levels
    it('should return high confidence for clear signals', () => {
      const strongTrend = UnifiedRegimeDetector.detectRegime({
        adx: 55,
        volatility: 0.025,
        priceVsMA: 0.25,
        rangeWidth: 0.035,
        divergence: 0.5,
        coherence: 0.95,
        momentum: 0.9,
      });

      expect(strongTrend.confidence).toBeGreaterThan(0.85);
    });

    it('should return low confidence for ambiguous signals', () => {
      const ambiguous = UnifiedRegimeDetector.detectRegime({
        adx: 22,
        volatility: 0.04,
        priceVsMA: 0.01,
        rangeWidth: 0.032,
        divergence: -0.02,
        coherence: 0.52,
        momentum: 0.03,
      });

      expect(ambiguous.confidence).toBeLessThan(0.7);
    });
  });

  describe('mapToUnified()', () => {
    // Test VFMD mapping
    it('should map VFMD LAMINAR_TREND to TRENDING_UP', () => {
      const result = UnifiedRegimeDetector.mapToUnified('LAMINAR_TREND', 'vfmd');
      expect(result).toBe('TRENDING_UP');
    });

    it('should map VFMD CONSOLIDATION to CONSOLIDATING', () => {
      const result = UnifiedRegimeDetector.mapToUnified('consolidation', 'vfmd');
      expect(result).toBe('CONSOLIDATING');
    });

    it('should map VFMD ACCUMULATION to ACCUMULATION', () => {
      const result = UnifiedRegimeDetector.mapToUnified('accumulation', 'vfmd');
      expect(result).toBe('ACCUMULATION');
    });

    // Test Scanner mapping
    it('should map scanner BULL to TRENDING_UP', () => {
      const result = UnifiedRegimeDetector.mapToUnified('bull', 'scanner');
      expect(result).toBe('TRENDING_UP');
    });

    it('should map scanner BEAR to TRENDING_DOWN', () => {
      const result = UnifiedRegimeDetector.mapToUnified('bear', 'scanner');
      expect(result).toBe('TRENDING_DOWN');
    });

    // Test ML mapping
    it('should map ML TRENDING_UP to TRENDING_UP', () => {
      const result = UnifiedRegimeDetector.mapToUnified('TRENDING_UP', 'ml');
      expect(result).toBe('TRENDING_UP');
    });

    it('should map ML UNKNOWN to RANGING', () => {
      const result = UnifiedRegimeDetector.mapToUnified('UNKNOWN', 'ml');
      expect(result).toBe('RANGING');
    });

    // Test Router mapping
    it('should map router TRENDING to TRENDING_UP', () => {
      const result = UnifiedRegimeDetector.mapToUnified('TRENDING', 'router');
      expect(result).toBe('TRENDING_UP');
    });

    // Test Velocity mapping
    it('should map velocity BULL to TRENDING_UP', () => {
      const result = UnifiedRegimeDetector.mapToUnified('BULL', 'velocity');
      expect(result).toBe('TRENDING_UP');
    });

    // Test case insensitivity
    it('should handle case insensitive mapping', () => {
      const result1 = UnifiedRegimeDetector.mapToUnified('laminar_trend', 'vfmd');
      const result2 = UnifiedRegimeDetector.mapToUnified('LAMINAR_TREND', 'vfmd');
      const result3 = UnifiedRegimeDetector.mapToUnified('Laminar_Trend', 'vfmd');

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    // Test unknown regime fallback
    it('should default to RANGING for unknown regimes', () => {
      const result = UnifiedRegimeDetector.mapToUnified('UNKNOWN_REGIME_XYZ', 'vfmd');
      expect(result).toBe('RANGING');
    });
  });

  describe('getCharacteristics()', () => {
    it('should return characteristics for TRENDING_UP', () => {
      const chars = UnifiedRegimeDetector.getCharacteristics('TRENDING_UP');

      expect(chars).toHaveProperty('description');
      expect(chars).toHaveProperty('positionSize');
      expect(chars).toHaveProperty('stopDistance');
      expect(chars).toHaveProperty('targetSize');
      expect(chars.positionSize).toBe(1.0); // Full size in uptrend
      expect(chars.aggressiveness).toBe('AGGRESSIVE');
    });

    it('should return characteristics for VOLATILE', () => {
      const chars = UnifiedRegimeDetector.getCharacteristics('VOLATILE');

      expect(chars.positionSize).toBe(0.4); // Reduced size in volatile
      expect(chars.stopDistance).toBe(1.5); // Larger stops
      expect(chars.aggressiveness).toBe('PASSIVE');
    });

    it('should return characteristics for BREAKOUT_TRANSITION', () => {
      const chars = UnifiedRegimeDetector.getCharacteristics('BREAKOUT_TRANSITION');

      expect(chars.positionSize).toBe(1.2); // Maximum size at breakout
      expect(chars.targetSize).toBe(1.8); // Largest targets
      expect(chars.aggressiveness).toBe('AGGRESSIVE');
    });

    it('all characteristics should have valid ranges', () => {
      for (const regimeName of Object.values(UnifiedRegimes)) {
        const chars = UnifiedRegimeDetector.getCharacteristics(regimeName);

        expect(chars.positionSize).toBeGreaterThan(0);
        expect(chars.positionSize).toBeLessThanOrEqual(2);
        expect(chars.stopDistance).toBeGreaterThan(0);
        expect(chars.targetSize).toBeGreaterThan(0);
        expect(chars.profitFactor).toBeGreaterThan(1);
        expect(chars.maxDrawdown).toBeGreaterThan(0);
        expect(chars.tradingImplications.length).toBeGreaterThan(0);
      }
    });
  });

  describe('detectTransition()', () => {
    it('should detect transition from RANGING to TRENDING_UP', () => {
      const transition = UnifiedRegimeDetector.detectTransition(
        'RANGING',
        'TRENDING_UP',
        0.85
      );

      expect(transition).not.toBeNull();
      expect(transition?.from).toBe('RANGING');
      expect(transition?.to).toBe('TRENDING_UP');
      expect(transition?.confidence).toBe(0.85);
    });

    it('should return null for same regime', () => {
      const transition = UnifiedRegimeDetector.detectTransition('RANGING', 'RANGING', 0.8);
      expect(transition).toBeNull();
    });

    it('should return null for low confidence transitions', () => {
      const transition = UnifiedRegimeDetector.detectTransition(
        'RANGING',
        'TRENDING_UP',
        0.45
      );
      expect(transition).toBeNull();
    });

    it('should include timestamp in transition', () => {
      const transition = UnifiedRegimeDetector.detectTransition(
        'CONSOLIDATING',
        'BREAKOUT_TRANSITION',
        0.9
      );

      expect(transition?.timestamp).toBeLessThanOrEqual(Date.now());
      expect(transition?.timestamp).toBeGreaterThan(Date.now() - 1000);
    });
  });

  describe('multiTimeframeVoting()', () => {
    it('should return consensus from multiple timeframes', () => {
      const regimes = [
        { regime: 'TRENDING_UP' as UnifiedRegimeType, confidence: 0.9, timeframe: '1H' },
        { regime: 'TRENDING_UP' as UnifiedRegimeType, confidence: 0.85, timeframe: '4H' },
        { regime: 'TRENDING_UP' as UnifiedRegimeType, confidence: 0.8, timeframe: '1D' },
      ];

      const result = UnifiedRegimeDetector.multiTimeframeVoting(regimes);

      expect(result.consensus).toBe('TRENDING_UP');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.agreement).toBeGreaterThanOrEqual(66); // All 3 agree
    });

    it('should weight daily timeframe most heavily', () => {
      const regimes = [
        { regime: 'RANGING' as UnifiedRegimeType, confidence: 0.9, timeframe: '1H' },
        { regime: 'TRENDING_UP' as UnifiedRegimeType, confidence: 0.9, timeframe: '1D' },
      ];

      const result = UnifiedRegimeDetector.multiTimeframeVoting(regimes);

      // Daily should win despite 1H strong signal
      expect(result.consensus).toBe('TRENDING_UP');
    });

    it('should handle empty regime list', () => {
      const result = UnifiedRegimeDetector.multiTimeframeVoting([]);

      expect(result.consensus).toBe('RANGING');
      expect(result.confidence).toBe(0.5);
      expect(result.agreement).toBe(0);
    });

    it('should calculate agreement percentage correctly', () => {
      const regimes = [
        { regime: 'RANGING' as UnifiedRegimeType, confidence: 0.7, timeframe: '1H' },
        { regime: 'TRENDING_UP' as UnifiedRegimeType, confidence: 0.8, timeframe: '4H' },
        { regime: 'TRENDING_UP' as UnifiedRegimeType, confidence: 0.9, timeframe: '1D' },
      ];

      const result = UnifiedRegimeDetector.multiTimeframeVoting(regimes);

      expect(result.agreement).toBe(66); // 2 out of 3 agree on TRENDING_UP
    });
  });

  describe('calculateRegimeStrength()', () => {
    it('should calculate high strength for strong trending', () => {
      const strength = UnifiedRegimeDetector.calculateRegimeStrength({
        adx: 60,
        volatility: 0.025,
        divergence: 0.7,
        coherence: 0.9,
        compression: 0.03,
      });

      expect(strength).toBeGreaterThan(50);
    });

    it('should calculate low strength for ambiguous signals', () => {
      const strength = UnifiedRegimeDetector.calculateRegimeStrength({
        adx: 15,
        volatility: 0.04,
        divergence: 0.05,
        coherence: 0.5,
        compression: 0.035,
      });

      expect(strength).toBeLessThan(40);
    });

    it('should return value in 0-100 range', () => {
      for (let i = 0; i < 20; i++) {
        const strength = UnifiedRegimeDetector.calculateRegimeStrength({
          adx: Math.random() * 100,
          volatility: Math.random() * 0.1,
          divergence: (Math.random() - 0.5) * 2,
          coherence: Math.random(),
          compression: Math.random() * 0.05,
        });

        expect(strength).toBeGreaterThanOrEqual(0);
        expect(strength).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe('RegimeConsolidationBridge', () => {
  beforeEach(() => {
    if (RegimeConsolidationBridge.clearLog) {
      (RegimeConsolidationBridge.clearLog as any)();
    }
  });

  describe('fromVFMD()', () => {
    it('should convert VFMD regimes', () => {
      const result = RegimeConsolidationBridge.fromVFMD('LAMINAR_TREND');
      expect(result).toBe('TRENDING_UP');
    });

    it('should log conversions', () => {
      RegimeConsolidationBridge.fromVFMD('CONSOLIDATION');

      const stats = RegimeConsolidationBridge.getConversionStats();
      expect(stats.totalConversions).toBeGreaterThan(0);
    });
  });

  describe('fromScanner()', () => {
    it('should convert scanner regimes', () => {
      expect(RegimeConsolidationBridge.fromScanner('bull')).toBe('TRENDING_UP');
      expect(RegimeConsolidationBridge.fromScanner('bear')).toBe('TRENDING_DOWN');
      expect(RegimeConsolidationBridge.fromScanner('ranging')).toBe('RANGING');
    });
  });

  describe('toVFMD()', () => {
    it('should convert unified back to VFMD', () => {
      const result = RegimeConsolidationBridge.toVFMD('TRENDING_UP');
      expect(result).toBe('LAMINAR_TREND');
    });
  });

  describe('validateConversionRoundTrip()', () => {
    it('should validate round trips between systems', () => {
      const validation = RegimeConsolidationBridge.validateConversionRoundTrip(
        'LAMINAR_TREND',
        'vfmd',
        'ml'
      );

      expect(validation.valid).toBe(true);
      expect(validation.original).toBe('LAMINAR_TREND');
      expect(validation.unified).toBe('TRENDING_UP');
    });
  });

  describe('getConversionStats()', () => {
    it('should track conversion statistics', () => {
      RegimeConsolidationBridge.fromVFMD('consolidation');
      RegimeConsolidationBridge.fromML('TRENDING_UP');
      RegimeConsolidationBridge.fromScanner('bull');

      const stats = RegimeConsolidationBridge.getConversionStats();

      expect(stats.totalConversions).toBe(3);
      expect(stats.bySystem).toHaveProperty('vfmd');
      expect(stats.bySystem).toHaveProperty('ml');
      expect(stats.bySystem).toHaveProperty('scanner');
    });
  });
});

describe('Helper functions', () => {
  describe('UnifiedRegimeDetector.mapToUnified()', () => {
    it('should map regime using unified mapper', () => {
      const result = UnifiedRegimeDetector.mapToUnified('LAMINAR_TREND', 'vfmd');
      expect(result).toBe('TRENDING_UP');
    });
  });

  describe('UnifiedRegimeDetector.getCharacteristics()', () => {
    it('should get characteristics for regime', () => {
      const config = UnifiedRegimeDetector.getCharacteristics('TRENDING_UP');
      expect(config.positionSize).toBe(1.0);
    });
  });
});

describe('Edge cases and stress tests', () => {
  it('should handle extreme market data', () => {
    const extremes = [
      {
        adx: 100,
        volatility: 0.15,
        priceVsMA: 1,
        rangeWidth: 0.1,
        divergence: 1,
        coherence: 1,
        momentum: 1,
      },
      {
        adx: 0,
        volatility: 0,
        priceVsMA: -1,
        rangeWidth: 0,
        divergence: -1,
        coherence: 0,
        momentum: -1,
      },
    ];

    for (const data of extremes) {
      const result = UnifiedRegimeDetector.detectRegime(data);
      expect(result.regime).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should handle all 9 regime types', () => {
    const scenarios = [
      { regime: 'TRENDING_UP', adx: 45, momentum: 0.9 },
      { regime: 'TRENDING_DOWN', adx: 45, momentum: -0.9 },
      { regime: 'RANGING', adx: 18, momentum: 0 },
      { regime: 'VOLATILE', volatility: 0.1, rangeWidth: 0.08 },
      { regime: 'CONSOLIDATING', rangeWidth: 0.01, coherence: 0.9 },
      { regime: 'BREAKOUT_TRANSITION', rangeWidth: 0.007, coherence: 0.95 },
      { regime: 'ACCUMULATION', divergence: 0.5, priceVsMA: -0.1, rsi: 35 },
      { regime: 'DISTRIBUTION', divergence: -0.5, priceVsMA: 0.1, rsi: 65 },
    ];

    for (const scenario of scenarios) {
      // Build minimal params for detection
      const params = {
        adx: 25,
        volatility: 0.025,
        priceVsMA: 0,
        rangeWidth: 0.03,
        divergence: 0,
        coherence: 0.75,
        momentum: 0,
        ...scenario,
      };

      const result = UnifiedRegimeDetector.detectRegime(params as any);
      expect(result.regime).toBeDefined();
    }
  });
});
