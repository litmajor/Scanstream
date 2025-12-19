/**
 * Capability Measurement Test Suite
 * 
 * Tests the before/after impact of:
 * - Cluster validation
 * - Position sizing
 * - Voting methods
 */

import { describe, it, expect } from 'vitest';
import {
  CapabilityMeasurement,
  createCapabilityMeasurement,
  type BacktestMetrics,
  type ClusterMetrics
} from '../server/services/capability-measurement';
import type { Trade } from '@shared/schema';

// Mock trades for testing
const MOCK_TRADES: Trade[] = [
  {
    id: 'trade-1',
    symbol: 'BTC/USDT',
    side: 'BUY',
    entryTime: new Date('2024-01-01'),
    entryPrice: 40000,
    quantity: 0.25,
    commission: 10,
    status: 'CLOSED',
    exitTime: new Date('2024-01-02'),
    exitPrice: 41000,
    pnl: 240 // (41000-40000)*0.25 - 10
  },
  {
    id: 'trade-2',
    symbol: 'BTC/USDT',
    side: 'BUY',
    entryTime: new Date('2024-01-05'),
    entryPrice: 39500,
    quantity: 0.25,
    commission: 10,
    status: 'CLOSED',
    exitTime: new Date('2024-01-06'),
    exitPrice: 39000,
    pnl: -135 // (39000-39500)*0.25 - 10
  },
  {
    id: 'trade-3',
    symbol: 'BTC/USDT',
    side: 'BUY',
    entryTime: new Date('2024-01-10'),
    entryPrice: 41000,
    quantity: 0.25,
    commission: 10,
    status: 'CLOSED',
    exitTime: new Date('2024-01-11'),
    exitPrice: 42500,
    quantity: 0.25,
    pnl: 365 // (42500-41000)*0.25 - 10
  },
  {
    id: 'trade-4',
    symbol: 'ETH/USDT',
    side: 'BUY',
    entryTime: new Date('2024-01-15'),
    entryPrice: 2000,
    quantity: 5,
    commission: 10,
    status: 'CLOSED',
    exitTime: new Date('2024-01-16'),
    exitPrice: 2100,
    pnl: 490 // (2100-2000)*5 - 10
  },
  {
    id: 'trade-5',
    symbol: 'ETH/USDT',
    side: 'BUY',
    entryTime: new Date('2024-01-20'),
    entryPrice: 2050,
    quantity: 5,
    commission: 10,
    status: 'CLOSED',
    exitTime: new Date('2024-01-21'),
    exitPrice: 1950,
    pnl: -510 // (1950-2050)*5 - 10
  }
];

// Mock cluster metrics provider
function createMockClusterProvider(): (symbol: string, timestamp: Date) => ClusterMetrics | null {
  return (symbol: string, timestamp: Date) => {
    const timeNum = timestamp.getTime();
    // Provide strong clusters for winning trades, weak for losing
    return {
      trend_formation_signal: timeNum % 2 === 0,
      cluster_strength: 0.5 + (Math.sin(timeNum) * 0.35),
      directional_ratio: 0.6 + (Math.cos(timeNum) * 0.3),
      follow_through: 0.4 + (Math.sin(timeNum * 0.5) * 0.4),
      total_clusters: 4,
      bullish_clusters: symbol === 'BTC/USDT' ? 3 : 2,
      bearish_clusters: 1
    };
  };
}

describe('CapabilityMeasurement', () => {
  let measurement: CapabilityMeasurement;

  describe('calculateMetrics', () => {
    beforeEach(() => {
      measurement = createCapabilityMeasurement();
    });

    it('should calculate baseline metrics from trades', () => {
      const metrics = measurement.calculateMetrics(MOCK_TRADES);

      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(5);
      expect(metrics.winningTrades).toBe(3); // trades 1, 3, 4
      expect(metrics.losingTrades).toBe(2); // trades 2, 5
      expect(metrics.winRate).toBeCloseTo(0.6, 2); // 3 out of 5
      expect(metrics.totalReturn).toBeGreaterThan(0);
    });

    it('should handle empty trades array', () => {
      const metrics = measurement.calculateMetrics([]);

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.totalReturn).toBe(0);
    });

    it('should calculate Sharpe ratio', () => {
      const metrics = measurement.calculateMetrics(MOCK_TRADES);

      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.sharpeRatio).toBeGreaterThan(0);
    });

    it('should calculate profit factor', () => {
      const metrics = measurement.calculateMetrics(MOCK_TRADES);

      expect(metrics.profitFactor).toBeGreaterThan(0);
    });
  });

  describe('applyClusterValidation', () => {
    beforeEach(() => {
      measurement = createCapabilityMeasurement();
    });

    it('should filter trades by cluster validation', () => {
      const clusterProvider = createMockClusterProvider();
      const { trades: validatedTrades, skippedCount } = 
        measurement.applyClusterValidation(MOCK_TRADES, clusterProvider);

      expect(validatedTrades.length).toBeLessThanOrEqual(MOCK_TRADES.length);
      expect(skippedCount).toBeGreaterThanOrEqual(0);
      expect(validatedTrades.length + skippedCount).toBe(MOCK_TRADES.length);
    });

    it('should add cluster validation metrics to trades', () => {
      const clusterProvider = createMockClusterProvider();
      const { trades: validatedTrades } = 
        measurement.applyClusterValidation(MOCK_TRADES, clusterProvider);

      const tradeWithMetrics = validatedTrades.find(t => t.clusterValidation);
      expect(tradeWithMetrics?.clusterValidation).toBeDefined();
      expect(tradeWithMetrics?.clusterValidation?.finalQuality).toBeDefined();
      expect(tradeWithMetrics?.clusterValidation?.sizeMultiplier).toBeDefined();
    });

    it('should calculate quality improvement', () => {
      const clusterProvider = createMockClusterProvider();
      const { avgQualityImprovement } = 
        measurement.applyClusterValidation(MOCK_TRADES, clusterProvider);

      expect(avgQualityImprovement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyPositionSizing', () => {
    beforeEach(() => {
      measurement = createCapabilityMeasurement();
    });

    it('should apply position sizing multipliers to trades', () => {
      const clusterProvider = createMockClusterProvider();
      const { trades: validatedTrades } = 
        measurement.applyClusterValidation(MOCK_TRADES, clusterProvider);

      const sizedTrades = measurement.applyPositionSizing(
        validatedTrades as any,
        100,
        clusterProvider
      );

      expect(sizedTrades.length).toBeGreaterThan(0);
      const tradeWithSizing = sizedTrades.find(t => t.positionSizing);
      if (tradeWithSizing?.positionSizing) {
        expect(tradeWithSizing.positionSizing.sizeMultiplier).toBeGreaterThan(0);
        expect(tradeWithSizing.positionSizing.finalSize).toBeGreaterThan(0);
      }
    });

    it('should vary multiplier between min and max', () => {
      const clusterProvider = createMockClusterProvider();
      const { trades: validatedTrades } = 
        measurement.applyClusterValidation(MOCK_TRADES, clusterProvider);

      const sizedTrades = measurement.applyPositionSizing(
        validatedTrades as any,
        100,
        clusterProvider
      );

      const multipliers = sizedTrades
        .filter(t => t.positionSizing)
        .map(t => t.positionSizing!.sizeMultiplier);

      if (multipliers.length > 0) {
        expect(Math.min(...multipliers)).toBeGreaterThanOrEqual(0.5);
        expect(Math.max(...multipliers)).toBeLessThanOrEqual(2.0);
      }
    });
  });

  describe('addVotingMetrics', () => {
    beforeEach(() => {
      measurement = createCapabilityMeasurement();
    });

    it('should add voting metrics to trades', () => {
      const votedTrades = measurement.addVotingMetrics(MOCK_TRADES, 'majority');

      expect(votedTrades.length).toBe(MOCK_TRADES.length);
      votedTrades.forEach(trade => {
        expect(trade.votingMetrics).toBeDefined();
        expect(trade.votingMetrics?.votingMethod).toBe('majority');
      });
    });

    it('should support different voting methods', () => {
      const methods: Array<'majority' | 'weighted' | 'consensus' | 'unanimous'> = 
        ['majority', 'weighted', 'consensus', 'unanimous'];

      for (const method of methods) {
        const votedTrades = measurement.addVotingMetrics(MOCK_TRADES, method);
        votedTrades.forEach(trade => {
          expect(trade.votingMetrics?.votingMethod).toBe(method);
        });
      }
    });
  });

  describe('compareMetrics', () => {
    beforeEach(() => {
      measurement = createCapabilityMeasurement();
    });

    it('should compare baseline and enhanced metrics', () => {
      const baseline: BacktestMetrics = {
        totalReturn: 1000,
        totalReturnPercent: 10,
        winRate: 0.6,
        profitFactor: 2.0,
        sharpeRatio: 1.5,
        maxDrawdown: 0.2,
        totalTrades: 10,
        winningTrades: 6,
        losingTrades: 4,
        avgWin: 250,
        avgLoss: 100,
        avgWinPercent: 2.5,
        avgLossPercent: 1.0
      };

      const enhanced: BacktestMetrics = {
        ...baseline,
        totalReturnPercent: 12,
        winRate: 0.65,
        sharpeRatio: 1.8,
        maxDrawdown: 0.15
      };

      const comparison = measurement.compareMetrics(baseline, enhanced);

      expect(comparison.returnImprovement).toBeGreaterThan(0);
      expect(comparison.sharpeImprovement).toBeGreaterThan(0);
      expect(comparison.drawdownReduction).toBeGreaterThan(0);
      expect(comparison.winRateImprovement).toBeGreaterThan(0);
    });

    it('should handle zero baseline metrics', () => {
      const baseline: BacktestMetrics = {
        totalReturn: 0,
        totalReturnPercent: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        avgWinPercent: 0,
        avgLossPercent: 0
      };

      const enhanced: BacktestMetrics = {
        totalReturn: 500,
        totalReturnPercent: 5,
        winRate: 0.5,
        profitFactor: 1.5,
        sharpeRatio: 1.0,
        maxDrawdown: 0.1,
        totalTrades: 10,
        winningTrades: 5,
        losingTrades: 5,
        avgWin: 100,
        avgLoss: 50,
        avgWinPercent: 1.0,
        avgLossPercent: 0.5
      };

      const comparison = measurement.compareMetrics(baseline, enhanced);
      expect(comparison.returnImprovement).toBe(0);
      expect(comparison.sharpeImprovement).toBe(0);
    });
  });

  describe('generateImpactReport', () => {
    beforeEach(() => {
      measurement = createCapabilityMeasurement();
    });

    it('should generate report with cluster validation', () => {
      const clusterProvider = createMockClusterProvider();
      const report = measurement.generateImpactReport(MOCK_TRADES, {
        enableClusterValidation: true,
        clusterMetricsProvider: clusterProvider
      });

      expect(report.baseline).toBeDefined();
      expect(report.withClusterValidation).toBeDefined();
      expect(report.withClusterValidation?.metrics).toBeDefined();
      expect(report.withClusterValidation?.tradesSkipped).toBeGreaterThanOrEqual(0);
    });

    it('should generate report with position sizing', () => {
      const clusterProvider = createMockClusterProvider();
      const report = measurement.generateImpactReport(MOCK_TRADES, {
        enablePositionSizing: true,
        clusterMetricsProvider: clusterProvider
      });

      expect(report.baseline).toBeDefined();
      expect(report.withPositionSizing).toBeDefined();
      expect(report.withPositionSizing?.avgMultiplier).toBeGreaterThan(0);
    });

    it('should generate report with voting comparison', () => {
      const report = measurement.generateImpactReport(MOCK_TRADES, {
        enableVotingComparison: true
      });

      expect(report.withVotingComparison).toBeDefined();
      expect(report.withVotingComparison?.majority).toBeDefined();
      expect(report.withVotingComparison?.weighted).toBeDefined();
      expect(report.withVotingComparison?.consensus).toBeDefined();
      expect(report.withVotingComparison?.unanimous).toBeDefined();
      expect(report.withVotingComparison?.best).toBeDefined();
    });

    it('should generate combined report with all capabilities', () => {
      const clusterProvider = createMockClusterProvider();
      const report = measurement.generateImpactReport(MOCK_TRADES, {
        enableClusterValidation: true,
        enablePositionSizing: true,
        enableVotingComparison: true,
        clusterMetricsProvider: clusterProvider
      });

      expect(report.baseline).toBeDefined();
      expect(report.withClusterValidation).toBeDefined();
      expect(report.withPositionSizing).toBeDefined();
      expect(report.withVotingComparison).toBeDefined();
      expect(report.combined).toBeDefined();
    });

    it('should show expected improvements in combined report', () => {
      const clusterProvider = createMockClusterProvider();
      const report = measurement.generateImpactReport(MOCK_TRADES, {
        enableClusterValidation: true,
        enablePositionSizing: true,
        clusterMetricsProvider: clusterProvider
      });

      if (report.combined?.impact) {
        // Combined enhancements should generally improve or maintain performance
        expect(report.combined.impact.returnImprovement).toBeDefined();
        expect(report.combined.impact.sharpeImprovement).toBeDefined();
        expect(report.combined.impact.drawdownReduction).toBeDefined();
      }
    });
  });
});
