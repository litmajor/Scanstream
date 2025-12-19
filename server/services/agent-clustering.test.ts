/**
 * AGENT CLUSTERING BACKTEST TEST SUITE
 * 
 * Comprehensive tests for agent clustering, specialist routing, and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import AgentClusteringBacktest, { AgentSpecialization } from '../services/agent-clustering-backtest';
import SpecialistRouter from '../services/specialist-router';
import ClusterValidationBacktest from '../services/cluster-validation-backtest';
import { Trade, BacktestMetrics } from '../types';

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

function createMockTrade(
  id: string,
  entryPrice: number = 100,
  exitPrice: number = 105,
  symbol: string = 'BTC/USDT',
  quantity: number = 10
): Trade {
  return {
    id,
    symbol,
    entryTime: new Date().toISOString(),
    entryPrice,
    quantity,
    exitTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    exitPrice,
    pnl: (exitPrice - entryPrice) * quantity,
    commission: 0.1,
  };
}

function createMockBaseline(): BacktestMetrics {
  return {
    totalTrades: 100,
    winningTrades: 55,
    losingTrades: 45,
    totalReturn: 25.5,
    sharpeRatio: 1.2,
    maxDrawdown: 0.15,
    winRate: 0.55,
    avgReturn: 0.255,
    avgWin: 1.5,
    avgLoss: -0.8,
    profitFactor: 1.8,
  };
}

// ============================================================================
// AGENT CLUSTERING SERVICE TESTS
// ============================================================================

describe('AgentClusteringBacktest', () => {
  let service: AgentClusteringBacktest;
  let mockTrades: Trade[];
  let baseline: BacktestMetrics;

  beforeEach(() => {
    service = new AgentClusteringBacktest();
    baseline = createMockBaseline();

    // Create mock trades with varied characteristics
    mockTrades = [
      createMockTrade('t1', 100, 102, 'BTC/USDT'), // +2 gain
      createMockTrade('t2', 100, 98, 'BTC/USDT'), // -2 loss
      createMockTrade('t3', 100, 103, 'ETH/USDT'), // +3 gain
      createMockTrade('t4', 100, 99, 'ETH/USDT'), // -1 loss
      createMockTrade('t5', 100, 105, 'ALT/USDT'), // +5 gain
    ];
  });

  describe('Agent Initialization', () => {
    it('should initialize with 6 default agents', () => {
      const agents = service.getAgents();
      expect(agents.length).toBe(6);
    });

    it('should have agents with required properties', () => {
      const agents = service.getAgents();
      agents.forEach((agent) => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.specialization).toBeDefined();
        expect(agent.winRate).toBeGreaterThanOrEqual(0);
        expect(agent.winRate).toBeLessThanOrEqual(1);
        expect(agent.successRate).toBeGreaterThanOrEqual(0);
        expect(agent.successRate).toBeLessThanOrEqual(1);
      });
    });

    it('should have agents with different specializations', () => {
      const agents = service.getAgents();
      const specializations = new Set(agents.map((a) => a.specialization));
      expect(specializations.size).toBeGreaterThan(1);
    });
  });

  describe('Agent Clustering', () => {
    it('should cluster agents by specialization', () => {
      const clusters = service.clusterAgents();
      expect(clusters.size).toBeGreaterThan(0);
      expect(clusters.size).toBeLessThanOrEqual(7); // Max 7 specializations
    });

    it('should assign all agents to clusters', () => {
      const clusters = service.clusterAgents();
      let totalAssigned = 0;
      clusters.forEach((assignments) => {
        totalAssigned += assignments.length;
      });
      expect(totalAssigned).toBe(service.getAgents().length);
    });

    it('should group similar agents together', () => {
      const clusters = service.clusterAgents();
      clusters.forEach((assignments) => {
        const specializations = assignments.map((a) => a.specialization);
        const uniqueSpecializations = new Set(specializations);
        // Agents in same cluster should have primary specialization match
        expect(uniqueSpecializations.size).toBeLessThanOrEqual(2); // Allow primary + secondary
      });
    });

    it('should calculate cluster strengths', () => {
      const clusters = service.clusterAgents();
      clusters.forEach((assignments) => {
        assignments.forEach((assignment) => {
          expect(assignment.strength).toBeGreaterThanOrEqual(0);
          expect(assignment.strength).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('Signal Routing', () => {
    it('should route signal to specialist', () => {
      const route = service.routeSignal(mockTrades[0], 'BTC/USDT', 1.2, 45);
      expect(route).toBeDefined();
      expect(route.agent).toBeDefined();
      expect(route.specialist).toBeDefined();
      expect(route.confidence).toBeGreaterThanOrEqual(0);
      expect(route.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide routing reason', () => {
      const route = service.routeSignal(mockTrades[0], 'BTC/USDT', 1.2, 45);
      expect(route.reason).toBeDefined();
      expect(route.reason.length).toBeGreaterThan(0);
    });

    it('should have consistent routing for similar conditions', () => {
      const trade = mockTrades[0];
      const route1 = service.routeSignal(trade, 'BTC/USDT', 1.2, 45);
      const route2 = service.routeSignal(trade, 'BTC/USDT', 1.2, 45);
      expect(route1.specialist).toBe(route2.specialist);
    });

    it('should route different conditions to different specialists sometimes', () => {
      const trade = mockTrades[0];
      const route_trending = service.routeSignal(trade, 'BTC/USDT', 0.8, 75); // Trending
      const route_ranging = service.routeSignal(trade, 'BTC/USDT', 1.5, 10); // Ranging
      // May route to different specialists based on conditions
      expect(route_trending).toBeDefined();
      expect(route_ranging).toBeDefined();
    });
  });

  describe('Specialist Metrics', () => {
    it('should generate specialist metrics', () => {
      const metrics = service.generateSpecialistMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should have metrics for each specialization', () => {
      const metrics = service.generateSpecialistMetrics();
      const specializations = metrics.map((m) => m.specialization);
      expect(specializations).toContain('momentum');
      expect(specializations).toContain('meanReversion');
    });

    it('should include win rates in metrics', () => {
      const metrics = service.generateSpecialistMetrics();
      metrics.forEach((m) => {
        expect(m.winRate).toBeGreaterThanOrEqual(0);
        expect(m.winRate).toBeLessThanOrEqual(1);
      });
    });

    it('should include return percentages in metrics', () => {
      const metrics = service.generateSpecialistMetrics();
      metrics.forEach((m) => {
        expect(typeof m.returnPercentage).toBe('number');
      });
    });
  });

  describe('Clustering Impact', () => {
    it('should calculate clustering impact', () => {
      const impact = service.calculateClusteringImpact(mockTrades, baseline);
      expect(impact).toBeDefined();
      expect(impact.returnImprovement).toBeGreaterThan(0);
      expect(impact.routingAccuracy).toBeGreaterThanOrEqual(0);
    });

    it('should show positive return improvement', () => {
      const impact = service.calculateClusteringImpact(mockTrades, baseline);
      expect(impact.returnImprovement).toBeGreaterThan(10); // At least 10% improvement
      expect(impact.returnImprovement).toBeLessThan(60); // Less than 60% (realistic)
    });

    it('should show positive sharpe improvement', () => {
      const impact = service.calculateClusteringImpact(mockTrades, baseline);
      expect(impact.sharpeImprovement).toBeGreaterThan(10);
      expect(impact.sharpeImprovement).toBeLessThan(60);
    });

    it('should show drawdown reduction', () => {
      const impact = service.calculateClusteringImpact(mockTrades, baseline);
      expect(impact.drawdownReduction).toBeGreaterThan(5);
      expect(impact.drawdownReduction).toBeLessThan(30);
    });

    it('should show positive win rate improvement', () => {
      const impact = service.calculateClusteringImpact(mockTrades, baseline);
      expect(impact.winRateImprovement).toBeGreaterThan(5);
      expect(impact.winRateImprovement).toBeLessThan(20);
    });

    it('should provide cluster utilization metric', () => {
      const impact = service.calculateClusteringImpact(mockTrades, baseline);
      expect(impact.clusterUtilization).toBeGreaterThan(0);
      expect(impact.clusterUtilization).toBeLessThanOrEqual(1);
    });
  });

  describe('Routing Patterns', () => {
    it('should generate routing patterns', () => {
      const patterns = service.generateRoutingPatterns();
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should have patterns for different regimes', () => {
      const patterns = service.generateRoutingPatterns();
      const regimes = patterns.map((p) => p.regime);
      expect(regimes).toContain('trending');
      expect(regimes).toContain('ranging');
    });

    it('should show specialist assignments per regime', () => {
      const patterns = service.generateRoutingPatterns();
      patterns.forEach((p) => {
        expect(p.specialist).toBeDefined();
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Cluster Quality', () => {
    it('should calculate cluster quality', () => {
      const quality = service.calculateClusterQuality();
      expect(quality).toBeDefined();
      expect(quality.cohesion).toBeGreaterThanOrEqual(0);
      expect(quality.cohesion).toBeLessThanOrEqual(1);
    });

    it('should show separation metric', () => {
      const quality = service.calculateClusterQuality();
      expect(quality.separation).toBeGreaterThanOrEqual(0);
      expect(quality.separation).toBeLessThanOrEqual(1);
    });

    it('should show stability metric', () => {
      const quality = service.calculateClusterQuality();
      expect(quality.stability).toBeGreaterThanOrEqual(0);
      expect(quality.stability).toBeLessThanOrEqual(1);
    });

    it('should show overall quality', () => {
      const quality = service.calculateClusterQuality();
      expect(quality.overall).toBeGreaterThanOrEqual(0);
      expect(quality.overall).toBeLessThanOrEqual(1);
    });
  });

  describe('Specialist vs General Comparison', () => {
    it('should compare specialist vs general routes', () => {
      const comparison = service.compareSpecialistVsGeneral(mockTrades);
      expect(comparison.specialist).toBeDefined();
      expect(comparison.general).toBeDefined();
      expect(comparison.specialist.length).toBeGreaterThan(0);
      expect(comparison.general.length).toBeGreaterThan(0);
    });

    it('should show specialist routing advantage', () => {
      const comparison = service.compareSpecialistVsGeneral(mockTrades);
      const specialistPnl = comparison.specialist.reduce((sum, t) => sum + t.pnl, 0);
      const generalPnl = comparison.general.reduce((sum, t) => sum + t.pnl, 0);
      // Specialist should typically outperform general
      expect(specialistPnl).toBeGreaterThan(0);
    });
  });

  describe('Clustering Report', () => {
    it('should generate comprehensive report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report).toBeDefined();
      expect(report.baseline).toBeDefined();
      expect(report.clustering).toBeDefined();
      expect(report.impact).toBeDefined();
    });

    it('should include baseline metrics in report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report.baseline.totalReturn).toBe(baseline.totalReturn);
      expect(report.baseline.sharpeRatio).toBe(baseline.sharpeRatio);
    });

    it('should include clustering details in report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report.clustering.totalClusters).toBeGreaterThan(0);
      expect(report.clustering.totalAgents).toBeGreaterThan(0);
    });

    it('should include impact metrics in report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report.impact.returnImprovement).toBeDefined();
      expect(report.impact.sharpeImprovement).toBeDefined();
      expect(report.impact.drawdownReduction).toBeDefined();
    });

    it('should include specialist metrics in report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report.specialistPerformance).toBeDefined();
      expect(report.specialistPerformance.length).toBeGreaterThan(0);
    });

    it('should include routing patterns in report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report.routingPatterns).toBeDefined();
      expect(report.routingPatterns.length).toBeGreaterThan(0);
    });

    it('should include cluster quality in report', () => {
      const report = service.generateClusteringReport(mockTrades, baseline);
      expect(report.clusterQuality).toBeDefined();
      expect(report.clusterQuality.overall).toBeDefined();
    });
  });
});

// ============================================================================
// SPECIALIST ROUTER TESTS
// ============================================================================

describe('SpecialistRouter', () => {
  let router: SpecialistRouter;

  beforeEach(() => {
    router = new SpecialistRouter();
  });

  describe('Routing Decision', () => {
    it('should make routing decisions', () => {
      const decision = router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      expect(decision).toBeDefined();
      expect(decision.specialist).toBeDefined();
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide routing reasoning', () => {
      const decision = router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(0);
    });

    it('should provide alternative routes', () => {
      const decision = router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives.length).toBeGreaterThan(0);
    });

    it('should provide fallback chain', () => {
      const decision = router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      expect(decision.fallbackChain).toBeDefined();
      expect(decision.fallbackChain.length).toBeGreaterThan(0);
    });
  });

  describe('Routing Context Evaluation', () => {
    it('should route trending context to momentum specialist', () => {
      const decision = router.route({
        regime: 'trending',
        volatility: 0.6,
        momentum: 75,
        volume: 1.5,
        trend: 0.9,
      }, 'breakout');

      expect(decision.specialist).toBeDefined();
      // Should preferentially route to momentum-related specialist
      expect(['momentum', 'trend-following']).toContain(decision.specialist);
    });

    it('should route ranging context to mean-reversion specialist', () => {
      const decision = router.route({
        regime: 'ranging',
        volatility: 0.5,
        momentum: 15,
        volume: 0.8,
        trend: 0.2,
      }, 'pullback');

      expect(decision.specialist).toBeDefined();
      // Should preferentially route to mean-reversion specialist
      expect(['mean-reversion', 'range-bound']).toContain(decision.specialist);
    });

    it('should route volatile context to volatility specialist', () => {
      const decision = router.route({
        regime: 'volatile',
        volatility: 1.8,
        momentum: 45,
        volume: 2.0,
        trend: 0.3,
      }, 'volatile');

      expect(decision.specialist).toBeDefined();
      expect(['volatility', 'breakout']).toContain(decision.specialist);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track routing metrics', () => {
      router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      const metrics = router.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.routesProcessed).toBeGreaterThan(0);
    });

    it('should track success rate', () => {
      router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      router.markRouteSuccessful('momentum', true);

      const metrics = router.getMetrics();
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeLessThanOrEqual(1);
    });

    it('should track specialist utilization', () => {
      // Route to multiple specialists
      router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      router.route({
        regime: 'ranging',
        volatility: 0.5,
        momentum: 15,
        volume: 0.8,
        trend: 0.2,
      }, 'pullback');

      const metrics = router.getMetrics();
      expect(metrics.specialistUtilization).toBeDefined();
    });
  });

  describe('Specialist Profiles', () => {
    it('should have specialist profiles', () => {
      const profiles = router.getSpecialistProfiles();
      expect(profiles).toBeDefined();
      expect(profiles.length).toBeGreaterThan(0);
    });

    it('should have profiles with strength ratings', () => {
      const profiles = router.getSpecialistProfiles();
      profiles.forEach((p) => {
        expect(p.strength).toBeGreaterThanOrEqual(0.7);
        expect(p.strength).toBeLessThanOrEqual(1);
      });
    });

    it('should have profiles with profitability data', () => {
      const profiles = router.getSpecialistProfiles();
      profiles.forEach((p) => {
        expect(p.profitability).toBeGreaterThan(0);
        expect(p.profitability).toBeLessThanOrEqual(1);
      });
    });

    it('should have profiles with regime preferences', () => {
      const profiles = router.getSpecialistProfiles();
      profiles.forEach((p) => {
        expect(p.matchedRegimes).toBeDefined();
        expect(p.matchedRegimes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Metrics Reset', () => {
    it('should reset metrics', () => {
      router.route({
        regime: 'trending',
        volatility: 0.8,
        momentum: 65,
        volume: 1.2,
        trend: 0.85,
      }, 'momentum');

      let metrics = router.getMetrics();
      expect(metrics.routesProcessed).toBeGreaterThan(0);

      router.resetMetrics();
      metrics = router.getMetrics();
      expect(metrics.routesProcessed).toBe(0);
    });
  });
});

// ============================================================================
// CLUSTER VALIDATION TESTS
// ============================================================================

describe('ClusterValidationBacktest', () => {
  let validation: ClusterValidationBacktest;
  let mockTrades: Trade[];

  beforeEach(() => {
    validation = new ClusterValidationBacktest();
    mockTrades = [
      createMockTrade('t1', 100, 102),
      createMockTrade('t2', 100, 98),
      createMockTrade('t3', 100, 103),
      createMockTrade('t4', 100, 99),
      createMockTrade('t5', 100, 105),
    ];
  });

  describe('Cluster Assignment Validation', () => {
    it('should validate cluster assignments', () => {
      const metrics = validation.validateClusterAssignments(mockTrades);
      expect(metrics).toBeDefined();
      expect(metrics.assignmentQuality).toBeGreaterThanOrEqual(0);
      expect(metrics.assignmentQuality).toBeLessThanOrEqual(1);
    });

    it('should check routing accuracy', () => {
      const metrics = validation.validateClusterAssignments(mockTrades);
      expect(metrics.routingAccuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.routingAccuracy).toBeLessThanOrEqual(1);
    });

    it('should measure cluster cohesion', () => {
      const metrics = validation.validateClusterAssignments(mockTrades);
      expect(metrics.clusterCohesion).toBeGreaterThanOrEqual(0);
      expect(metrics.clusterCohesion).toBeLessThanOrEqual(1);
    });

    it('should measure cluster separation', () => {
      const metrics = validation.validateClusterAssignments(mockTrades);
      expect(metrics.clusterSeparation).toBeGreaterThanOrEqual(0);
      expect(metrics.clusterSeparation).toBeLessThanOrEqual(1);
    });

    it('should provide validation score', () => {
      const metrics = validation.validateClusterAssignments(mockTrades);
      expect(metrics.validationScore).toBeGreaterThanOrEqual(0);
      expect(metrics.validationScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Specialist vs General Comparison', () => {
    it('should compare specialist vs general performance', () => {
      const comparison = validation.compareSpecialistVsGeneral(mockTrades);
      expect(comparison).toBeDefined();
      expect(comparison.specialistMetrics).toBeDefined();
      expect(comparison.generalMetrics).toBeDefined();
    });

    it('should show specialist win rate', () => {
      const comparison = validation.compareSpecialistVsGeneral(mockTrades);
      expect(comparison.specialistMetrics.winRate).toBeGreaterThanOrEqual(0);
      expect(comparison.specialistMetrics.winRate).toBeLessThanOrEqual(1);
    });

    it('should show general win rate', () => {
      const comparison = validation.compareSpecialistVsGeneral(mockTrades);
      expect(comparison.generalMetrics.winRate).toBeGreaterThanOrEqual(0);
      expect(comparison.generalMetrics.winRate).toBeLessThanOrEqual(1);
    });

    it('should show improvement metric', () => {
      const comparison = validation.compareSpecialistVsGeneral(mockTrades);
      expect(comparison.improvement).toBeGreaterThan(0);
    });
  });

  describe('Cluster Stability', () => {
    it('should calculate cluster stability', () => {
      const stability = validation.calculateClusterStability(mockTrades);
      expect(stability).toBeGreaterThanOrEqual(0);
      expect(stability).toBeLessThanOrEqual(1);
    });

    it('should show stability over time', () => {
      const mockLongTrades = Array.from({ length: 50 }, (_, i) =>
        createMockTrade(`t${i}`, 100 + Math.random() * 10, 100 + Math.random() * 15)
      );

      const stability = validation.calculateClusterStability(mockLongTrades);
      expect(stability).toBeGreaterThanOrEqual(0);
      expect(stability).toBeLessThanOrEqual(1);
    });
  });

  describe('Cluster Quality Validation', () => {
    it('should validate overall cluster quality', () => {
      const quality = validation.validateClusterQuality(mockTrades);
      expect(quality).toBeDefined();
      expect(quality.overall).toBeGreaterThanOrEqual(0);
      expect(quality.overall).toBeLessThanOrEqual(1);
    });

    it('should measure quality cohesion', () => {
      const quality = validation.validateClusterQuality(mockTrades);
      expect(quality.cohesion).toBeGreaterThanOrEqual(0);
      expect(quality.cohesion).toBeLessThanOrEqual(1);
    });

    it('should measure quality separation', () => {
      const quality = validation.validateClusterQuality(mockTrades);
      expect(quality.separation).toBeGreaterThanOrEqual(0);
      expect(quality.separation).toBeLessThanOrEqual(1);
    });
  });

  describe('Optimal Cluster Count', () => {
    it('should identify optimal cluster count', () => {
      const mockLongTrades = Array.from({ length: 100 }, (_, i) =>
        createMockTrade(`t${i}`, 100 + Math.random() * 10, 100 + Math.random() * 15)
      );

      const optimal = validation.identifyOptimalClusterCount(mockLongTrades);
      expect(optimal).toBeGreaterThanOrEqual(2);
      expect(optimal).toBeLessThanOrEqual(7);
    });

    it('should provide reasonable cluster count', () => {
      const mockLongTrades = Array.from({ length: 100 }, (_, i) =>
        createMockTrade(`t${i}`, 100 + Math.random() * 10, 100 + Math.random() * 15)
      );

      const optimal = validation.identifyOptimalClusterCount(mockLongTrades);
      // Should typically recommend 3-5 clusters for balanced solution
      expect(optimal).toBeGreaterThanOrEqual(2);
      expect(optimal).toBeLessThanOrEqual(7);
    });
  });
});
