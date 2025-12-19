/**
 * PHASE 5: ADAPTIVE POSITION SIZING - COMPREHENSIVE TEST SUITE
 * 
 * Test coverage for:
 * - Kelly Criterion calculation
 * - Volatility-based sizing
 * - Signal strength adjustment
 * - Correlation-based sizing
 * - Integrated position sizing
 * Target: 50+ tests
 */

import {
  KellyCriterionCalculator,
  VolatilityBasedSizer,
  SignalStrengthSizer,
  CorrelationBasedSizer,
  AdaptivePositionSizer,
  type PositionSizingInput,
  type PortfolioPosition
} from '../server/lib/adaptive-position-sizer';

describe('Phase 5: Adaptive Position Sizing', () => {
  // ========================================================================
  // KELLY CRITERION TESTS
  // ========================================================================

  describe('KellyCriterionCalculator', () => {
    let calculator: KellyCriterionCalculator;

    beforeEach(() => {
      calculator = new KellyCriterionCalculator();
    });

    it('should calculate Kelly fraction for winning strategy', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 0.60,
        avgWin: 0.02,      // 2% average win
        avgLoss: 0.01,     // 1% average loss
        riskRewardRatio: 2.0
      });

      expect(result.kellyFraction).toBeGreaterThan(0);
      expect(result.kellyFraction).toBeLessThanOrEqual(0.25); // Capped at 25%
      expect(result.safeKellyFraction).toBeLessThan(result.fractionalKelly);
    });

    it('should handle break-even strategy (50% win rate)', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 0.50,
        avgWin: 0.01,
        avgLoss: 0.01,
        riskRewardRatio: 1.0
      });

      expect(result.kellyFraction).toBeCloseTo(0, 1);
    });

    it('should return 0 for losing strategy', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 0.40,
        avgWin: 0.01,
        avgLoss: 0.02,
        riskRewardRatio: 0.5
      });

      expect(result.kellyFraction).toBe(0);
    });

    it('should cap Kelly at 25%', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 0.80,
        avgWin: 0.05,
        avgLoss: 0.01,
        riskRewardRatio: 5.0
      });

      expect(result.kellyFraction).toBeLessThanOrEqual(0.25);
    });

    it('should provide safe Kelly (quarter) and fractional Kelly', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 0.60,
        avgWin: 0.02,
        avgLoss: 0.01,
        riskRewardRatio: 2.0
      });

      expect(result.safeKellyFraction).toBe(result.kellyFraction / 4);
      expect(result.fractionalKelly).toBe(result.kellyFraction / 2);
    });

    it('should reject invalid input (win rate > 1)', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 1.5,
        avgWin: 0.02,
        avgLoss: 0.01,
        riskRewardRatio: 2.0
      });

      expect(result.kellyFraction).toBe(0);
    });

    it('should reject invalid input (win rate < 0)', () => {
      const result = calculator.calculateKellyFraction({
        winRate: -0.1,
        avgWin: 0.02,
        avgLoss: 0.01,
        riskRewardRatio: 2.0
      });

      expect(result.kellyFraction).toBe(0);
    });

    it('should reject zero wins/losses', () => {
      const result = calculator.calculateKellyFraction({
        winRate: 0.60,
        avgWin: 0,
        avgLoss: 0.01,
        riskRewardRatio: 2.0
      });

      expect(result.kellyFraction).toBe(0);
    });
  });

  // ========================================================================
  // VOLATILITY-BASED SIZER TESTS
  // ========================================================================

  describe('VolatilityBasedSizer', () => {
    let sizer: VolatilityBasedSizer;

    beforeEach(() => {
      sizer = new VolatilityBasedSizer();
    });

    it('should increase size for very low volatility', () => {
      const result = sizer.calculateVolatilityAdjustment(0.3);
      expect(result.adjustment).toBe(1.3);
    });

    it('should increase size for low volatility', () => {
      const result = sizer.calculateVolatilityAdjustment(0.75);
      expect(result.adjustment).toBe(1.1);
    });

    it('should use base size for normal volatility', () => {
      const result = sizer.calculateVolatilityAdjustment(1.2);
      expect(result.adjustment).toBe(1.0);
    });

    it('should decrease size for high volatility', () => {
      const result = sizer.calculateVolatilityAdjustment(1.8);
      expect(result.adjustment).toBe(0.85);
    });

    it('should decrease size for very high volatility', () => {
      const result = sizer.calculateVolatilityAdjustment(2.2);
      expect(result.adjustment).toBe(0.7);
    });

    it('should minimize size for extreme volatility', () => {
      const result = sizer.calculateVolatilityAdjustment(3.0);
      expect(result.adjustment).toBe(0.5);
    });

    it('should adjust size based on market regime - trending up', () => {
      const result = sizer.calculateRegimeAdjustment('TRENDING_UP');
      expect(result.adjustment).toBeGreaterThan(1.0);
    });

    it('should reduce size in ranging market', () => {
      const result = sizer.calculateRegimeAdjustment('RANGING');
      expect(result.adjustment).toBeLessThan(1.0);
    });

    it('should handle unknown regime', () => {
      const result = sizer.calculateRegimeAdjustment('UNKNOWN');
      expect(result.adjustment).toBe(1.0);
    });
  });

  // ========================================================================
  // SIGNAL STRENGTH SIZER TESTS
  // ========================================================================

  describe('SignalStrengthSizer', () => {
    let sizer: SignalStrengthSizer;

    beforeEach(() => {
      sizer = new SignalStrengthSizer();
    });

    it('should reject signals below 0.3 strength', () => {
      const result = sizer.calculateSignalAdjustment(0.2);
      expect(result.shouldTrade).toBe(false);
      expect(result.adjustment).toBe(0);
    });

    it('should size weak signals (0.3-0.5) at 50%', () => {
      const result = sizer.calculateSignalAdjustment(0.4);
      expect(result.shouldTrade).toBe(true);
      expect(result.adjustment).toBe(0.5);
    });

    it('should size moderate signals (0.5-0.65) at 75%', () => {
      const result = sizer.calculateSignalAdjustment(0.6);
      expect(result.shouldTrade).toBe(true);
      expect(result.adjustment).toBe(0.75);
    });

    it('should size good signals (0.65-0.8) at 100%', () => {
      const result = sizer.calculateSignalAdjustment(0.75);
      expect(result.shouldTrade).toBe(true);
      expect(result.adjustment).toBe(1.0);
    });

    it('should size strong signals (0.8-0.9) at 115%', () => {
      const result = sizer.calculateSignalAdjustment(0.85);
      expect(result.shouldTrade).toBe(true);
      expect(result.adjustment).toBe(1.15);
    });

    it('should size very strong signals (0.9+) at 130%', () => {
      const result = sizer.calculateSignalAdjustment(0.95);
      expect(result.shouldTrade).toBe(true);
      expect(result.adjustment).toBe(1.3);
    });
  });

  // ========================================================================
  // CORRELATION-BASED SIZER TESTS
  // ========================================================================

  describe('CorrelationBasedSizer', () => {
    let sizer: CorrelationBasedSizer;

    beforeEach(() => {
      sizer = new CorrelationBasedSizer();
    });

    it('should boost size for strong negative correlation (hedge)', () => {
      const result = sizer.calculateCorrelationAdjustment(-0.7);
      expect(result.adjustment).toBe(1.25);
    });

    it('should slightly boost for mild negative correlation', () => {
      const result = sizer.calculateCorrelationAdjustment(-0.3);
      expect(result.adjustment).toBe(1.1);
    });

    it('should use base size for low correlation', () => {
      const result = sizer.calculateCorrelationAdjustment(0.1);
      expect(result.adjustment).toBe(1.0);
    });

    it('should reduce size for moderate positive correlation', () => {
      const result = sizer.calculateCorrelationAdjustment(0.5);
      expect(result.adjustment).toBe(0.85);
    });

    it('should significantly reduce for high correlation', () => {
      const result = sizer.calculateCorrelationAdjustment(0.7);
      expect(result.adjustment).toBe(0.7);
    });

    it('should minimize for very high correlation', () => {
      const result = sizer.calculateCorrelationAdjustment(0.85);
      expect(result.adjustment).toBe(0.5);
    });

    it('should detect same symbol as highly correlated', () => {
      const positions: PortfolioPosition[] = [
        { symbol: 'BTC/USD', quantity: 1, entryPrice: 50000, currentPrice: 51000, unrealizedPnL: 1000 }
      ];

      const correlation = sizer.estimatePortfolioCorrelation('BTC/USD', positions);
      expect(correlation).toBeGreaterThan(0.9);
    });

    it('should detect same asset class as moderately correlated', () => {
      const positions: PortfolioPosition[] = [
        { symbol: 'BTC/USD', quantity: 1, entryPrice: 50000, currentPrice: 51000, unrealizedPnL: 1000 }
      ];

      const correlation = sizer.estimatePortfolioCorrelation('ETH/USD', positions);
      expect(correlation).toBeGreaterThan(0.3);
    });

    it('should detect different asset class as low correlated', () => {
      const positions: PortfolioPosition[] = [
        { symbol: 'BTC/USD', quantity: 1, entryPrice: 50000, currentPrice: 51000, unrealizedPnL: 1000 }
      ];

      const correlation = sizer.estimatePortfolioCorrelation('EURUSD', positions);
      expect(correlation).toBeLessThan(0.3);
    });

    it('should return 0 correlation for empty portfolio', () => {
      const correlation = sizer.estimatePortfolioCorrelation('BTC/USD', []);
      expect(correlation).toBe(0);
    });
  });

  // ========================================================================
  // ADAPTIVE POSITION SIZER INTEGRATION TESTS
  // ========================================================================

  describe('AdaptivePositionSizer', () => {
    let sizer: AdaptivePositionSizer;

    beforeEach(() => {
      sizer = new AdaptivePositionSizer();
    });

    const createBasicInput = (overrides?: Partial<PositionSizingInput>): PositionSizingInput => {
      return {
        symbol: 'BTC/USD',
        signalStrength: 0.75,
        signalAction: 'BUY',
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 55000,
        accountEquity: 100000,
        accountRiskPercentage: 1.0,
        volatility: 1.2,
        regime: 'TRENDING_UP',
        existingPositions: [],
        correlationWithPortfolio: 0.1,
        sizingStrategy: 'ADAPTIVE',
        riskLevel: 'MODERATE',
        ...overrides
      };
    };

    it('should calculate position size for basic input', () => {
      const input = createBasicInput();
      const output = sizer.calculatePositionSize(input);

      expect(output.symbol).toBe('BTC/USD');
      expect(output.recommendedQuantity).toBeGreaterThan(0);
      expect(output.recommendedSize).toBeGreaterThan(0);
      expect(output.riskAmount).toBeGreaterThan(0);
    });

    it('should reject signals below minimum strength', () => {
      const input = createBasicInput({ signalStrength: 0.2 });
      const output = sizer.calculatePositionSize(input);

      expect(output.recommendedQuantity).toBe(0);
      expect(output.warnings).toContain(expect.stringContaining('TRADE REJECTED'));
    });

    it('should apply signal strength adjustment', () => {
      const strong = sizer.calculatePositionSize(createBasicInput({ signalStrength: 0.9 }));
      const weak = sizer.calculatePositionSize(createBasicInput({ signalStrength: 0.4 }));

      expect(strong.recommendedSize).toBeGreaterThan(weak.recommendedSize);
    });

    it('should apply volatility adjustment', () => {
      const lowVol = sizer.calculatePositionSize(createBasicInput({ volatility: 0.5 }));
      const highVol = sizer.calculatePositionSize(createBasicInput({ volatility: 2.5 }));

      expect(lowVol.recommendedSize).toBeGreaterThan(highVol.recommendedSize);
    });

    it('should respect risk percentage limit', () => {
      const input = createBasicInput({ accountRiskPercentage: 1.0 });
      const output = sizer.calculatePositionSize(input);

      const riskAmount = output.riskAmount;
      const maxRisk = input.accountEquity * (input.accountRiskPercentage / 100);

      expect(riskAmount).toBeLessThanOrEqual(maxRisk * 1.5); // Allow 50% buffer
    });

    it('should handle correlation with existing positions', () => {
      const sameAsset = sizer.calculatePositionSize(
        createBasicInput({
          symbol: 'BTC/USD',
          existingPositions: [
            { symbol: 'BTC/USD', quantity: 1, entryPrice: 49000, currentPrice: 50000, unrealizedPnL: 1000 }
          ]
        })
      );

      const differentAsset = sizer.calculatePositionSize(
        createBasicInput({
          symbol: 'ETH/USD',
          existingPositions: [
            { symbol: 'BTC/USD', quantity: 1, entryPrice: 49000, currentPrice: 50000, unrealizedPnL: 1000 }
          ]
        })
      );

      expect(sameAsset.recommendedSize).toBeLessThan(differentAsset.recommendedSize);
    });

    it('should calculate risk-reward ratio correctly', () => {
      const input = createBasicInput();
      const output = sizer.calculatePositionSize(input);

      const expectedRR = (input.takeProfit - input.entryPrice) / (input.entryPrice - input.stopLoss);
      expect(output.riskRewardRatio).toBeCloseTo(expectedRR, 1);
    });

    it('should warn on unusual risk percentages', () => {
      const tooHigh = sizer.calculatePositionSize(createBasicInput({ accountRiskPercentage: 5.5 }));
      const tooLow = sizer.calculatePositionSize(createBasicInput({ accountRiskPercentage: 0.05 }));

      expect(tooHigh.warnings.length).toBeGreaterThan(0);
      expect(tooLow.warnings.length).toBeGreaterThan(0);
    });

    it('should handle zero position risk (invalid stop loss)', () => {
      const input = createBasicInput({ stopLoss: 50000 }); // Same as entry
      const output = sizer.calculatePositionSize(input);

      expect(output.recommendedQuantity).toBe(0);
      expect(output.warnings).toContain(expect.stringContaining('Stop loss'));
    });

    it('should apply Kelly Criterion when specified', () => {
      const input = createBasicInput({ sizingStrategy: 'KELLY' });
      const output = sizer.calculatePositionSize(input);

      expect(output.kellyFraction).toBeDefined();
      expect(output.kellyFraction).toBeLessThanOrEqual(0.1); // Conservative Kelly
    });

    it('should provide detailed rationale', () => {
      const input = createBasicInput();
      const output = sizer.calculatePositionSize(input);

      expect(output.rationale.length).toBeGreaterThan(0);
      expect(output.rationale.some(r => r.includes('size'))).toBe(true);
    });

    it('should recommend risk percentage based on account size', () => {
      const small = sizer.getRecommendedRiskPercentage(5000);
      const medium = sizer.getRecommendedRiskPercentage(50000);
      const large = sizer.getRecommendedRiskPercentage(250000);
      const xlarge = sizer.getRecommendedRiskPercentage(500000);

      expect(small).toBe(2.0);
      expect(medium).toBe(1.5);
      expect(large).toBe(1.0);
      expect(xlarge).toBe(0.75);
    });

    it('should cap final size at risk limit', () => {
      const input = createBasicInput({
        signalStrength: 0.95,
        volatility: 0.3,
        regime: 'TRENDING_UP'
      });
      const output = sizer.calculatePositionSize(input);

      const maxRiskPercentage = input.accountEquity * (input.accountRiskPercentage / 100) * 1.5;
      expect(output.riskAmount).toBeLessThanOrEqual(maxRiskPercentage);
    });

    it('should set max drawdown limit', () => {
      const input = createBasicInput();
      const output = sizer.calculatePositionSize(input);

      expect(output.maxDrawdownLimit).toBe(input.accountEquity * -0.10);
    });

    it('should handle multiple risk adjustments together', () => {
      // Strong signal + low volatility + high trend strength + low correlation
      const optimized = sizer.calculatePositionSize(
        createBasicInput({
          signalStrength: 0.88,
          volatility: 0.6,
          regime: 'TRENDING_UP',
          existingPositions: [
            { symbol: 'EURUSD', quantity: 1, entryPrice: 1.08, currentPrice: 1.09, unrealizedPnL: 0.01 }
          ]
        })
      );

      expect(optimized.recommendedSize).toBeGreaterThan(0);
      expect(optimized.rationale.length).toBeGreaterThan(3);
    });
  });

  // ========================================================================
  // EDGE CASES & STRESS TESTS
  // ========================================================================

  describe('Edge Cases', () => {
    let sizer: AdaptivePositionSizer;

    beforeEach(() => {
      sizer = new AdaptivePositionSizer();
    });

    it('should handle very large account equity', () => {
      const input: PositionSizingInput = {
        symbol: 'BTC/USD',
        signalStrength: 0.75,
        signalAction: 'BUY',
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 55000,
        accountEquity: 10000000, // $10M
        accountRiskPercentage: 0.5,
        volatility: 1.2,
        regime: 'TRENDING_UP',
        existingPositions: [],
        correlationWithPortfolio: 0.1,
        sizingStrategy: 'ADAPTIVE',
        riskLevel: 'MODERATE'
      };

      const output = sizer.calculatePositionSize(input);
      expect(output.recommendedSize).toBeGreaterThan(0);
    });

    it('should handle very small account equity', () => {
      const input: PositionSizingInput = {
        symbol: 'BTC/USD',
        signalStrength: 0.75,
        signalAction: 'BUY',
        entryPrice: 50000,
        stopLoss: 48000,
        takeProfit: 55000,
        accountEquity: 1000, // $1K
        accountRiskPercentage: 2.0,
        volatility: 1.2,
        regime: 'TRENDING_UP',
        existingPositions: [],
        correlationWithPortfolio: 0.1,
        sizingStrategy: 'ADAPTIVE',
        riskLevel: 'MODERATE'
      };

      const output = sizer.calculatePositionSize(input);
      expect(output.recommendedSize).toBeGreaterThan(0);
    });

    it('should handle tight stop loss', () => {
      const input: PositionSizingInput = {
        symbol: 'BTC/USD',
        signalStrength: 0.75,
        signalAction: 'BUY',
        entryPrice: 50000,
        stopLoss: 49900, // Very tight
        takeProfit: 55000,
        accountEquity: 100000,
        accountRiskPercentage: 1.0,
        volatility: 1.2,
        regime: 'TRENDING_UP',
        existingPositions: [],
        correlationWithPortfolio: 0.1,
        sizingStrategy: 'ADAPTIVE',
        riskLevel: 'MODERATE'
      };

      const output = sizer.calculatePositionSize(input);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
    });

    it('should handle wide stop loss', () => {
      const input: PositionSizingInput = {
        symbol: 'BTC/USD',
        signalStrength: 0.75,
        signalAction: 'BUY',
        entryPrice: 50000,
        stopLoss: 40000, // Very wide
        takeProfit: 55000,
        accountEquity: 100000,
        accountRiskPercentage: 1.0,
        volatility: 1.2,
        regime: 'TRENDING_UP',
        existingPositions: [],
        correlationWithPortfolio: 0.1,
        sizingStrategy: 'ADAPTIVE',
        riskLevel: 'MODERATE'
      };

      const output = sizer.calculatePositionSize(input);
      expect(output.recommendedQuantity).toBeGreaterThan(0);
      expect(output.recommendedQuantity).toBeLessThan(1); // Should be fractional
    });
  });
});
