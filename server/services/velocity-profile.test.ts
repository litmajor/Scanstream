/**
 * Velocity Profile Service Tests
 */

import VelocityProfile from '../velocity-profile';
import { Trade, BacktestMetrics } from '../capability-measurement';

describe('VelocityProfile Service', () => {
  let velocityService: VelocityProfile;

  beforeEach(() => {
    velocityService = new VelocityProfile();
  });

  describe('calculateVelocityMetrics', () => {
    test('should calculate basic velocity metrics', () => {
      const metrics = velocityService.calculateVelocityMetrics(
        45000, // current price
        44500, // previous price
        1500000, // current volume
        1200000, // previous volume
        1350000, // volume MA
        44800 // price MA
      );

      expect(metrics).toHaveProperty('priceVelocity');
      expect(metrics).toHaveProperty('volumeVelocity');
      expect(metrics).toHaveProperty('momentumVelocity');
      expect(metrics).toHaveProperty('acceleration');
      expect(metrics).toHaveProperty('volatility');
      expect(metrics).toHaveProperty('convictionScore');

      // Conviction score should be normalized 0-1
      expect(metrics.convictionScore).toBeGreaterThanOrEqual(0);
      expect(metrics.convictionScore).toBeLessThanOrEqual(1);
    });

    test('should handle zero previous price', () => {
      const metrics = velocityService.calculateVelocityMetrics(
        45000,
        0,
        1500000,
        1200000,
        1350000,
        44800
      );

      expect(metrics.acceleration).toBeDefined();
      expect(isNaN(metrics.acceleration)).toBe(false);
    });

    test('should calculate higher conviction for upward momentum with volume', () => {
      const lowConviction = velocityService.calculateVelocityMetrics(
        45000,
        45050, // price down
        1000000,
        1100000, // volume down
        1050000,
        45000
      );

      const highConviction = velocityService.calculateVelocityMetrics(
        46000,
        45000, // price up
        1500000,
        1200000, // volume up
        1350000,
        45000
      );

      expect(highConviction.convictionScore).toBeGreaterThan(lowConviction.convictionScore);
    });
  });

  describe('calculateVelocityProfile', () => {
    test('should generate velocity profile for price history', () => {
      const priceHistory = [45000, 45100, 45050, 45200, 45150, 45300];
      const volumeHistory = [1000000, 1200000, 1100000, 1300000, 1250000, 1400000];

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        priceHistory,
        volumeHistory
      );

      expect(profile.symbol).toBe('BTC/USDT');
      expect(profile.timeframe).toBe('1h');
      expect(profile.velocityScores.length).toBe(priceHistory.length - 1);
      expect(profile.avgVelocity).toBeGreaterThanOrEqual(0);
      expect(profile.avgVelocity).toBeLessThanOrEqual(1);
    });

    test('should calculate volatility distribution', () => {
      const priceHistory = Array.from({ length: 100 }, (_, i) => 45000 + Math.sin(i / 10) * 500);
      const volumeHistory = Array.from({ length: 100 }, () => 1200000);

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        priceHistory,
        volumeHistory
      );

      const totalVolatility =
        profile.volatilityProfile.low +
        profile.volatilityProfile.medium +
        profile.volatilityProfile.high;

      expect(Math.abs(totalVolatility - 100)).toBeLessThan(1); // Should sum to ~100%
    });
  });

  describe('applyVelocityProfileSizing', () => {
    test('should apply velocity-based multipliers to trades', () => {
      const mockTrades: Trade[] = [
        {
          id: '1',
          entryPrice: 45000,
          exitPrice: 45500,
          quantity: 1,
          profit: 500,
          profitPercent: 1.11,
          entryTime: new Date(),
          exitTime: new Date(),
          duration: 3600000,
          side: 'long',
          status: 'closed'
        }
      ];

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        [45000, 45100, 45050],
        [1200000, 1300000, 1250000]
      );

      const enhanced = velocityService.applyVelocityProfileSizing(mockTrades, profile);

      expect(enhanced.length).toBe(1);
      expect(enhanced[0].velocityMultiplier).toBeGreaterThanOrEqual(0.5);
      expect(enhanced[0].velocityMultiplier).toBeLessThanOrEqual(2.0);
      expect(enhanced[0].adjustedQuantity).toBe(mockTrades[0].quantity * enhanced[0].velocityMultiplier);
    });

    test('should scale multiplier based on conviction score', () => {
      const mockTrades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade-${i}`,
        entryPrice: 45000,
        exitPrice: 45500,
        quantity: 1,
        profit: 500,
        profitPercent: 1.11,
        entryTime: new Date(),
        exitTime: new Date(),
        duration: 3600000,
        side: 'long',
        status: 'closed'
      }));

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        Array.from({ length: 20 }, (_, i) => 45000 + Math.sin(i / 5) * 1000),
        Array.from({ length: 20 }, () => 1200000)
      );

      const enhanced = velocityService.applyVelocityProfileSizing(mockTrades, profile);

      // Verify all trades have valid multipliers
      enhanced.forEach(trade => {
        expect(trade.velocityMultiplier).toBeGreaterThanOrEqual(0.5);
        expect(trade.velocityMultiplier).toBeLessThanOrEqual(2.0);
      });
    });
  });

  describe('applyAdaptiveVelocitySizing', () => {
    test('should apply adaptive velocity sizing with trend', () => {
      const mockTrades: Trade[] = Array.from({ length: 5 }, (_, i) => ({
        id: `trade-${i}`,
        entryPrice: 45000,
        exitPrice: 45500,
        quantity: 1,
        profit: 500,
        profitPercent: 1.11,
        entryTime: new Date(),
        exitTime: new Date(),
        duration: 3600000,
        side: 'long',
        status: 'closed'
      }));

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        Array.from({ length: 10 }, (_, i) => 45000 + i * 100), // Uptrend
        Array.from({ length: 10 }, (_, i) => 1200000 + i * 50000) // Volume increase
      );

      const enhanced = velocityService.applyAdaptiveVelocitySizing(mockTrades, profile);

      expect(enhanced.length).toBe(5);
      enhanced.forEach(trade => {
        expect(trade.velocityMultiplier).toBeGreaterThanOrEqual(0.5);
        expect(trade.velocityMultiplier).toBeLessThanOrEqual(2.0);
      });
    });
  });

  describe('applyHighFrequencyVelocitySizing', () => {
    test('should apply aggressive high-frequency sizing', () => {
      const mockTrades: Trade[] = Array.from({ length: 5 }, (_, i) => ({
        id: `trade-${i}`,
        entryPrice: 45000,
        exitPrice: 45500,
        quantity: 1,
        profit: 500,
        profitPercent: 1.11,
        entryTime: new Date(),
        exitTime: new Date(),
        duration: 3600000,
        side: 'long',
        status: 'closed'
      }));

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        Array.from({ length: 10 }, (_, i) => 45000 + Math.sin(i / 2) * 2000), // High volatility
        Array.from({ length: 10 }, (_, i) => 1200000 + Math.cos(i / 2) * 500000) // Volume spikes
      );

      const enhanced = velocityService.applyHighFrequencyVelocitySizing(mockTrades, profile);

      expect(enhanced.length).toBe(5);
      enhanced.forEach(trade => {
        expect(trade.velocityMultiplier).toBeGreaterThanOrEqual(0.5);
        expect(trade.velocityMultiplier).toBeLessThanOrEqual(2.0);
      });
    });
  });

  describe('calculateVelocityImpact', () => {
    test('should calculate impact metrics correctly', () => {
      const mockTrades: Trade[] = [
        {
          id: '1',
          entryPrice: 45000,
          exitPrice: 45500,
          quantity: 1,
          profit: 500,
          profitPercent: 1.11,
          entryTime: new Date(),
          exitTime: new Date(),
          duration: 3600000,
          side: 'long',
          status: 'closed'
        }
      ];

      const baselineMetrics: BacktestMetrics = {
        totalReturn: 10,
        annualizedReturn: 12,
        sharpeRatio: 1.5,
        maxDrawdown: 0.15,
        winRate: 0.6,
        profitFactor: 2,
        totalTrades: 1
      };

      const enhancedMetrics: BacktestMetrics = {
        totalReturn: 12,
        annualizedReturn: 14.4,
        sharpeRatio: 1.8,
        maxDrawdown: 0.12,
        winRate: 0.65,
        profitFactor: 2.4,
        totalTrades: 1
      };

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        [45000, 45100],
        [1200000, 1300000]
      );

      const enhanced = velocityService.applyVelocityProfileSizing(mockTrades, profile);
      const impact = velocityService.calculateVelocityImpact(baselineMetrics, enhanced, enhancedMetrics);

      expect(impact.metrics).toHaveProperty('returnImprovement');
      expect(impact.metrics).toHaveProperty('sharpeImprovement');
      expect(impact.metrics).toHaveProperty('drawdownReduction');
      expect(impact.metrics).toHaveProperty('winRateImprovement');
      expect(impact).toHaveProperty('avgMultiplier');
      expect(impact).toHaveProperty('velocityDistribution');
      expect(impact).toHaveProperty('timeInHighVelocity');

      // Return improvement should be positive
      expect(impact.metrics.returnImprovement).toBeGreaterThan(0);
      // Drawdown reduction should be positive (lower is better)
      expect(impact.metrics.drawdownReduction).toBeGreaterThan(0);
    });
  });

  describe('generateVelocityReport', () => {
    test('should generate comprehensive velocity report', () => {
      const mockTrades: Trade[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade-${i}`,
        entryPrice: 45000,
        exitPrice: 45500,
        quantity: 1,
        profit: 500,
        profitPercent: 1.11,
        entryTime: new Date(),
        exitTime: new Date(),
        duration: 3600000,
        side: 'long',
        status: 'closed'
      }));

      const baselineMetrics: BacktestMetrics = {
        totalReturn: 10,
        annualizedReturn: 12,
        sharpeRatio: 1.5,
        maxDrawdown: 0.15,
        winRate: 0.6,
        profitFactor: 2,
        totalTrades: 10
      };

      const profile = velocityService.calculateVelocityProfile(
        'BTC/USDT',
        '1h',
        '2024',
        Array.from({ length: 20 }, (_, i) => 45000 + Math.sin(i / 5) * 1000),
        Array.from({ length: 20 }, (_, i) => 1200000 + Math.cos(i / 5) * 300000)
      );

      const metricsFunc = (trades: any[]) => baselineMetrics;

      const report = velocityService.generateVelocityReport(
        baselineMetrics,
        profile,
        mockTrades,
        metricsFunc
      );

      expect(report).toHaveProperty('baseline');
      expect(report).toHaveProperty('withVelocityProfile');
      expect(report).toHaveProperty('adaptiveVelocity');
      expect(report).toHaveProperty('highFrequencyVelocity');
      expect(report).toHaveProperty('combined');

      // All should have metrics and multipliers
      Object.values(report).forEach((section: any) => {
        if (section.metrics) {
          expect(section.metrics).toHaveProperty('returnImprovement');
          expect(section).toHaveProperty('avgMultiplier');
        }
      });
    });
  });

  describe('generateMockVelocityProfile', () => {
    test('should generate realistic mock velocity profile', () => {
      const profile = velocityService.generateMockVelocityProfile('BTC/USDT', 100);

      expect(profile.symbol).toBe('BTC/USDT');
      expect(profile.velocityScores.length).toBe(99); // One less than trade count
      expect(profile.avgVelocity).toBeGreaterThanOrEqual(0);
      expect(profile.avgVelocity).toBeLessThanOrEqual(1);

      // All velocity scores should be valid
      profile.velocityScores.forEach(score => {
        expect(score.convictionScore).toBeGreaterThanOrEqual(0);
        expect(score.convictionScore).toBeLessThanOrEqual(1);
      });
    });
  });
});
