/**
 * PHASE 3: ADAPTIVE HOLDING SERVICE TESTS
 * 
 * Comprehensive test coverage for adaptive holding calculation methods
 */

import AdaptiveHolding from '../services/adaptive-holding';
import { Trade, BacktestMetrics } from '../types';

describe('Adaptive Holding Service - Phase 3', () => {
  let service: AdaptiveHolding;

  beforeAll(() => {
    service = new AdaptiveHolding();
  });

  // =========================================================================
  // HOLDING PERIOD CALCULATION TESTS
  // =========================================================================

  describe('calculateHoldingPeriod', () => {
    const mockTrade: Trade = {
      id: 'test-1',
      symbol: 'BTC/USDT',
      entryTime: '2024-01-01T10:00:00Z',
      entryPrice: 100,
      quantity: 10,
      exitTime: '2024-01-02T10:00:00Z',
      exitPrice: 102,
      pnl: 20,
      commission: 0,
    };

    test('should calculate holding period for trending market with strong flow', () => {
      const result = service.calculateHoldingPeriod(mockTrade, 'trending', 85, 8);

      expect(result.holdingDays).toBeGreaterThan(14);
      expect(result.marketRegime).toBe('trending');
      expect(result.institutionalFlow).toBe(85);
      expect(result.convictionScore).toBeGreaterThan(0.7);
      expect(result.recommendedStopMultiplier).toBeGreaterThan(1.5);
    });

    test('should calculate holding period for ranging market with weak flow', () => {
      const result = service.calculateHoldingPeriod(mockTrade, 'ranging', 30, 5);

      expect(result.holdingDays).toBeLessThan(7);
      expect(result.marketRegime).toBe('ranging');
      expect(result.convictionScore).toBeLessThan(0.5);
      expect(result.recommendedStopMultiplier).toBeLessThan(1.5);
    });

    test('should calculate holding period for volatile market', () => {
      const result = service.calculateHoldingPeriod(mockTrade, 'volatile', 50, 18);

      expect(result.holdingDays).toBeLessThanOrEqual(2);
      expect(result.marketRegime).toBe('volatile');
      expect(result.recommendedStopMultiplier).toBeLessThan(1.2);
    });

    test('should cap holding period at 21 days maximum', () => {
      const result = service.calculateHoldingPeriod(mockTrade, 'trending', 95, 2);

      expect(result.holdingDays).toBeLessThanOrEqual(21);
    });

    test('should enforce minimum holding period of 1 day', () => {
      const result = service.calculateHoldingPeriod(mockTrade, 'ranging', 10, 25);

      expect(result.holdingDays).toBeGreaterThanOrEqual(1);
    });

    test('should scale holding period with institutional flow', () => {
      const weak = service.calculateHoldingPeriod(mockTrade, 'trending', 30, 8);
      const strong = service.calculateHoldingPeriod(mockTrade, 'trending', 85, 8);

      expect(strong.holdingDays).toBeGreaterThan(weak.holdingDays);
    });
  });

  // =========================================================================
  // CONVICTION SCORE TESTS
  // =========================================================================

  describe('calculateConvictionScore', () => {
    test('should calculate high conviction for strong parameters', () => {
      const score = service.calculateConvictionScore(85, 5, 2.5, 80);

      expect(score).toBeGreaterThan(0.75);
    });

    test('should calculate low conviction for weak parameters', () => {
      const score = service.calculateConvictionScore(30, 15, 0.5, 40);

      expect(score).toBeLessThan(0.5);
    });

    test('should weight institutional flow heavily (40%)', () => {
      const highFlow = service.calculateConvictionScore(90, 10, 1, 50);
      const lowFlow = service.calculateConvictionScore(20, 10, 1, 50);

      expect(highFlow).toBeGreaterThan(lowFlow);
    });

    test('should balance volatility in score calculation', () => {
      const lowVol = service.calculateConvictionScore(60, 3, 1, 60);
      const highVol = service.calculateConvictionScore(60, 20, 1, 60);

      expect(lowVol).toBeGreaterThan(highVol);
    });

    test('should return value between 0 and 1', () => {
      const score = service.calculateConvictionScore(50, 10, 1, 50);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // =========================================================================
  // MICROSTRUCTURE HEALTH TESTS
  // =========================================================================

  describe('calculateMicrostructureHealth', () => {
    test('should score healthy microstructure highly', () => {
      const score = service.calculateMicrostructureHealth(0.0005, 2000000, 80);

      expect(score).toBeGreaterThan(75);
    });

    test('should score degraded microstructure moderately', () => {
      const score = service.calculateMicrostructureHealth(0.015, 800000, 50);

      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(75);
    });

    test('should score poor microstructure low', () => {
      const score = service.calculateMicrostructureHealth(0.03, 200000, 20);

      expect(score).toBeLessThan(50);
    });

    test('should weight spread highly (40%)', () => {
      const tightSpread = service.calculateMicrostructureHealth(0.0005, 1000000, 50);
      const wideSpread = service.calculateMicrostructureHealth(0.02, 1000000, 50);

      expect(tightSpread).toBeGreaterThan(wideSpread);
    });

    test('should return value between 0 and 100', () => {
      const score = service.calculateMicrostructureHealth(0.01, 1000000, 50);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // =========================================================================
  // STRATEGY APPLICATION TESTS
  // =========================================================================

  describe('applyAdaptiveHolding', () => {
    const mockTrades: Trade[] = [
      {
        id: 'trade-1',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-01T10:00:00Z',
        entryPrice: 100,
        quantity: 10,
        exitTime: '2024-01-02T10:00:00Z',
        exitPrice: 102,
        pnl: 20,
        commission: 0,
      },
      {
        id: 'trade-2',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-03T10:00:00Z',
        entryPrice: 105,
        quantity: 8,
        exitTime: '2024-01-05T10:00:00Z',
        exitPrice: 103,
        pnl: -16,
        commission: 0,
      },
    ];

    test('should apply holding periods to all trades', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);

      expect(enhanced.length).toBe(2);
      expect(enhanced[0].holdingDays).toBeDefined();
      expect(enhanced[1].holdingDays).toBeDefined();
    });

    test('should set institutional flow for each trade', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);

      enhanced.forEach((trade) => {
        expect(trade.institutionalFlow).toBeDefined();
        expect(trade.institutionalFlow).toBeGreaterThanOrEqual(0);
        expect(trade.institutionalFlow).toBeLessThanOrEqual(100);
      });
    });

    test('should set microstructure score for each trade', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);

      enhanced.forEach((trade) => {
        expect(trade.microstructureScore).toBeDefined();
        expect(trade.microstructureScore).toBeGreaterThanOrEqual(0);
        expect(trade.microstructureScore).toBeLessThanOrEqual(100);
      });
    });

    test('should set exit timing score for each trade', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);

      enhanced.forEach((trade) => {
        expect(trade.exitTimingScore).toBeDefined();
        expect(trade.exitTimingScore).toBeGreaterThanOrEqual(0);
        expect(trade.exitTimingScore).toBeLessThanOrEqual(1);
      });
    });

    test('should set recommended stop for each trade', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);

      enhanced.forEach((trade) => {
        expect(trade.recommendedStop).toBeDefined();
        expect(trade.recommendedStop).toBeGreaterThan(0);
      });
    });
  });

  describe('applyFlowBasedHolding', () => {
    const mockTrades: Trade[] = [
      {
        id: 'trade-1',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-01T10:00:00Z',
        entryPrice: 100,
        quantity: 10,
        exitTime: '2024-01-02T10:00:00Z',
        exitPrice: 102,
        pnl: 20,
        commission: 0,
      },
    ];

    test('should apply flow-based holding periods', () => {
      const enhanced = service.applyFlowBasedHolding(mockTrades as any);

      expect(enhanced[0].holdingDays).toBeDefined();
      expect(enhanced[0].holdingDays).toBeGreaterThanOrEqual(3);
      expect(enhanced[0].holdingDays).toBeLessThanOrEqual(21);
    });

    test('should respect flow thresholds for holding periods', () => {
      const trades = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockTrades[0],
          id: `trade-${i}`,
        }));

      const enhanced = service.applyFlowBasedHolding(trades as any);

      const holdingDays = enhanced.map((t) => t.holdingDays || 0);
      expect(holdingDays.some((d) => d === 21)).toBe(true); // Some should be 21 (strong flow)
      expect(holdingDays.some((d) => d === 3)).toBe(true); // Some should be 3 (weak flow)
    });
  });

  describe('applyMicrostructureBasedHolding', () => {
    const mockTrades: Trade[] = [
      {
        id: 'trade-1',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-01T10:00:00Z',
        entryPrice: 100,
        quantity: 10,
        exitTime: '2024-01-02T10:00:00Z',
        exitPrice: 102,
        pnl: 20,
        commission: 0,
      },
    ];

    test('should apply microstructure-based holding periods', () => {
      const enhanced = service.applyMicrostructureBasedHolding(mockTrades as any);

      expect(enhanced[0].holdingDays).toBeDefined();
      expect(enhanced[0].microstructureScore).toBeDefined();
    });

    test('should set exit timing based on microstructure', () => {
      const enhanced = service.applyMicrostructureBasedHolding(mockTrades as any);

      expect(enhanced[0].exitTimingScore).toBeDefined();
      expect(enhanced[0].exitTimingScore).toBeGreaterThanOrEqual(0);
      expect(enhanced[0].exitTimingScore).toBeLessThanOrEqual(1);
    });
  });

  // =========================================================================
  // IMPACT CALCULATION TESTS
  // =========================================================================

  describe('calculateHoldingImpact', () => {
    const mockTrades: Trade[] = [
      {
        id: 'trade-1',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-01T10:00:00Z',
        entryPrice: 100,
        quantity: 10,
        exitTime: '2024-01-02T10:00:00Z',
        exitPrice: 102,
        pnl: 20,
        commission: 0,
      },
      {
        id: 'trade-2',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-03T10:00:00Z',
        entryPrice: 105,
        quantity: 8,
        exitTime: '2024-01-05T10:00:00Z',
        exitPrice: 103,
        pnl: -16,
        commission: 0,
      },
    ];

    const baseline: BacktestMetrics = {
      totalTrades: 2,
      winningTrades: 1,
      losingTrades: 1,
      totalReturn: 45.2,
      sharpeRatio: 1.23,
      maxDrawdown: 0.15,
      winRate: 0.5,
      avgReturn: 0.3,
      avgWin: 1.8,
      avgLoss: -0.9,
      profitFactor: 2.1,
    };

    test('should calculate return improvement', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const impact = service.calculateHoldingImpact(enhanced, baseline);

      expect(impact.totalReturn).toBeGreaterThanOrEqual(baseline.totalReturn);
      expect(impact.returnImprovement).toBeGreaterThanOrEqual(0);
    });

    test('should calculate Sharpe ratio improvement', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const impact = service.calculateHoldingImpact(enhanced, baseline);

      expect(impact.sharpeRatio).toBeGreaterThanOrEqual(0);
      expect(impact.sharpeImprovement).toBeDefined();
    });

    test('should calculate drawdown reduction', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const impact = service.calculateHoldingImpact(enhanced, baseline);

      expect(impact.maxDrawdown).toBeLessThanOrEqual(baseline.maxDrawdown);
      expect(impact.drawdownReduction).toBeGreaterThanOrEqual(0);
    });

    test('should calculate average holding days', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const impact = service.calculateHoldingImpact(enhanced, baseline);

      expect(impact.avgHoldingDays).toBeGreaterThan(0);
    });

    test('should calculate exit quality score', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const impact = service.calculateHoldingImpact(enhanced, baseline);

      expect(impact.exitQuality).toBeGreaterThanOrEqual(0);
      expect(impact.exitQuality).toBeLessThanOrEqual(100);
    });

    test('should handle empty trades array', () => {
      const impact = service.calculateHoldingImpact([], baseline);

      expect(impact.totalReturn).toBe(0);
      expect(impact.returnImprovement).toBe(0);
    });
  });

  // =========================================================================
  // PROFILE GENERATION TESTS
  // =========================================================================

  describe('generateHoldingProfile', () => {
    const mockTrades: Trade[] = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `trade-${i}`,
        symbol: 'BTC/USDT',
        entryTime: '2024-01-01T10:00:00Z',
        entryPrice: 100 + i * 2,
        quantity: 10,
        exitTime: '2024-01-02T10:00:00Z',
        exitPrice: 102 + i * 2,
        pnl: 20,
        commission: 0,
      }));

    test('should generate holding profile with correct structure', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const profile = service.generateHoldingProfile(enhanced);

      expect(profile.avgHoldingDays).toBeGreaterThan(0);
      expect(profile.avgInstitutionalFlow).toBeGreaterThan(0);
      expect(profile.avgMicrostructureScore).toBeGreaterThan(0);
      expect(profile.volatilityProfile).toBeDefined();
    });

    test('should distribute trades across regime buckets', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const profile = service.generateHoldingProfile(enhanced);

      const total = profile.regime1DayCount + profile.regime3DayCount + profile.regime7DayCount + profile.regime14DayCount + profile.regime21DayCount;
      expect(total).toBeGreaterThan(0);
    });

    test('should provide volatility distribution', () => {
      const enhanced = service.applyAdaptiveHolding(mockTrades as any);
      const profile = service.generateHoldingProfile(enhanced);

      const total = profile.volatilityProfile.low + profile.volatilityProfile.medium + profile.volatilityProfile.high;
      expect(total).toBeCloseTo(100, 1);
    });

    test('should handle empty trades array', () => {
      const profile = service.generateHoldingProfile([]);

      expect(profile.avgHoldingDays).toBe(0);
      expect(profile.avgInstitutionalFlow).toBe(0);
    });
  });

  // =========================================================================
  // REPORT GENERATION TESTS
  // =========================================================================

  describe('generateAdaptiveHoldingReport', () => {
    const mockTrades: Trade[] = [
      {
        id: 'trade-1',
        symbol: 'BTC/USDT',
        entryTime: '2024-01-01T10:00:00Z',
        entryPrice: 100,
        quantity: 10,
        exitTime: '2024-01-02T10:00:00Z',
        exitPrice: 102,
        pnl: 20,
        commission: 0,
      },
    ];

    const baseline: BacktestMetrics = {
      totalTrades: 1,
      winningTrades: 1,
      losingTrades: 0,
      totalReturn: 45.2,
      sharpeRatio: 1.23,
      maxDrawdown: 0.15,
      winRate: 1.0,
      avgReturn: 0.3,
      avgWin: 1.8,
      avgLoss: 0,
      profitFactor: 2.1,
    };

    test('should generate complete adaptive holding report', () => {
      const report = service.generateAdaptiveHoldingReport(mockTrades, baseline, true, true, true);

      expect(report.baseline).toBeDefined();
      expect(report.adaptiveHolding).toBeDefined();
      expect(report.flowBasedHolding).toBeDefined();
      expect(report.microstructureBasedHolding).toBeDefined();
      expect(report.combined).toBeDefined();
      expect(report.holdingProfile).toBeDefined();
      expect(report.riskMetrics).toBeDefined();
    });

    test('should respect enable flags', () => {
      const fullReport = service.generateAdaptiveHoldingReport(mockTrades, baseline, true, true, true);
      const adaptiveOnly = service.generateAdaptiveHoldingReport(mockTrades, baseline, true, false, false);

      expect(fullReport.adaptiveHolding).toBeDefined();
      expect(fullReport.flowBasedHolding).toBeDefined();
      expect(adaptiveOnly.adaptiveHolding).toBeDefined();
      expect(adaptiveOnly.flowBasedHolding).toBeUndefined();
    });

    test('should include risk metrics', () => {
      const report = service.generateAdaptiveHoldingReport(mockTrades, baseline);

      expect(report.riskMetrics).toBeDefined();
      expect(report.riskMetrics?.avgDrawdownRecovery).toBeDefined();
      expect(report.riskMetrics?.largestDrawdown).toBeDefined();
      expect(report.riskMetrics?.drawdownDuration).toBeDefined();
    });
  });

  // =========================================================================
  // MOCK DATA GENERATION TESTS
  // =========================================================================

  describe('generateMockAdaptiveHoldingProfile', () => {
    test('should generate realistic mock profile', () => {
      const profile = service.generateMockAdaptiveHoldingProfile();

      expect(profile.avgHoldingDays).toBeGreaterThan(5);
      expect(profile.avgHoldingDays).toBeLessThan(15);
      expect(profile.avgInstitutionalFlow).toBeGreaterThan(50);
      expect(profile.avgInstitutionalFlow).toBeLessThan(75);
    });

    test('should distribute regime counts correctly', () => {
      const profile = service.generateMockAdaptiveHoldingProfile();

      const total = profile.regime1DayCount + profile.regime3DayCount + profile.regime7DayCount + profile.regime14DayCount + profile.regime21DayCount;
      expect(total).toBe(100);
    });
  });
});
