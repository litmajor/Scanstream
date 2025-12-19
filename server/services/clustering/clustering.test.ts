/**
 * Clustering Services Test Suite
 * 
 * Tests for:
 * - ClusterValidator (entry quality scoring)
 * - PositionSizer (position sizing multipliers)
 * - ReversalDetector (cluster breakdown detection)
 * - Agent Integration (end-to-end signal enhancement)
 */

import {
  ClusterValidator,
  PositionSizer,
  ReversalDetector,
  getClusteringProcessor,
  type ClusterMetrics,
  type ClusterSnapshot
} from '../clustering/index';

// ============================================================================
// TEST SUITE 1: ClusterValidator Tests
// ============================================================================

describe('ClusterValidator', () => {
  let validator: ClusterValidator;

  beforeEach(() => {
    validator = new ClusterValidator();
  });

  describe('Entry Quality Scoring', () => {
    it('should give high quality with strong cluster', () => {
      const clusterMetrics: ClusterMetrics = {
        trend_formation_signal: true,
        cluster_strength: 0.9,
        directional_ratio: 0.85,
        follow_through: 0.80,
        total_clusters: 5,
        bullish_clusters: 4,
        bearish_clusters: 1
      };

      const result = validator.validateEntry(0.7, clusterMetrics);

      expect(result.final_entry_quality).toBeGreaterThan(0.6);
      expect(result.confidence_level).toBe('high');
      expect(result.entry_recommendation).toBe('normal');
    });

    it('should give low quality with weak cluster', () => {
      const clusterMetrics: ClusterMetrics = {
        trend_formation_signal: false,
        cluster_strength: 0.2,
        directional_ratio: 0.35,
        follow_through: 0.25,
        total_clusters: 3,
        bullish_clusters: 1,
        bearish_clusters: 2
      };

      const result = validator.validateEntry(0.7, clusterMetrics);

      expect(result.final_entry_quality).toBeLessThan(0.5);
      expect(result.confidence_level).toBe('moderate');
      expect(result.entry_recommendation).toBe('small');
    });

    it('should reject entry below quality threshold', () => {
      const clusterMetrics: ClusterMetrics = {
        trend_formation_signal: false,
        cluster_strength: 0.1,
        directional_ratio: 0.2,
        follow_through: 0.15,
        total_clusters: 1,
        bullish_clusters: 0,
        bearish_clusters: 1
      };

      const result = validator.validateEntry(0.3, clusterMetrics);

      expect(result.final_entry_quality).toBeLessThan(0.5);
      expect(result.entry_recommendation).toBe('skip');
      expect(result.size_multiplier).toBe(0);
    });

    it('should apply confidence levels correctly', () => {
      const strongCluster: ClusterMetrics = {
        trend_formation_signal: true,
        cluster_strength: 0.9,
        directional_ratio: 0.9,
        follow_through: 0.9,
        total_clusters: 5,
        bullish_clusters: 5,
        bearish_clusters: 0
      };

      const result = validator.validateEntry(0.8, strongCluster);
      expect(result.confidence_level).toBe('very_high');
      expect(result.entry_recommendation).toBe('aggressive');
    });
  });

  describe('Position Size Calculation', () => {
    it('should correctly multiply position size', () => {
      const clusterMetrics: ClusterMetrics = {
        trend_formation_signal: true,
        cluster_strength: 0.5,
        directional_ratio: 0.6,
        follow_through: 0.5,
        total_clusters: 3,
        bullish_clusters: 2,
        bearish_clusters: 1
      };

      const size = validator.calculatePositionSize(100, 0.7, clusterMetrics);
      expect(size).toBeGreaterThan(50); // Minimum 0.5x
      expect(size).toBeLessThan(120); // Less than 1.2x
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple entries', () => {
      const signals = [
        {
          baseQuality: 0.8,
          cluster: {
            trend_formation_signal: true,
            cluster_strength: 0.8,
            directional_ratio: 0.8,
            follow_through: 0.8,
            total_clusters: 5,
            bullish_clusters: 4,
            bearish_clusters: 1
          } as ClusterMetrics
        },
        {
          baseQuality: 0.4,
          cluster: {
            trend_formation_signal: false,
            cluster_strength: 0.2,
            directional_ratio: 0.3,
            follow_through: 0.2,
            total_clusters: 2,
            bullish_clusters: 0,
            bearish_clusters: 2
          } as ClusterMetrics
        }
      ];

      const results = validator.validateEntries(signals);

      expect(results.length).toBe(2);
      expect(results[0].confidence_level).toBe('high');
      expect(results[1].confidence_level).toBe('low');
    });
  });
});

// ============================================================================
// TEST SUITE 2: PositionSizer Tests
// ============================================================================

describe('PositionSizer', () => {
  let sizer: PositionSizer;

  beforeEach(() => {
    sizer = new PositionSizer();
  });

  describe('Size Multiplier Calculation', () => {
    it('should calculate multiplier: 0.5x for no trend + weak cluster', () => {
      const result = sizer.calculateSize({
        baseSize: 100,
        cluster_strength: 0.2,
        trend_formation: false
      });

      expect(result.size_multiplier).toBeCloseTo(0.5, 1);
      expect(result.final_size).toBeCloseTo(50, 0);
    });

    it('should calculate multiplier: 1.25x for trend + moderate cluster', () => {
      const result = sizer.calculateSize({
        baseSize: 100,
        cluster_strength: 0.5,
        trend_formation: true
      });

      expect(result.size_multiplier).toBeGreaterThan(1.0);
      expect(result.size_multiplier).toBeLessThan(1.5);
    });

    it('should calculate multiplier: 1.85x for trend + strong cluster', () => {
      const result = sizer.calculateSize({
        baseSize: 100,
        cluster_strength: 0.9,
        trend_formation: true
      });

      expect(result.size_multiplier).toBeGreaterThan(1.7);
      expect(result.final_size).toBeCloseTo(185, 0);
    });

    it('should cap multiplier at 2.0x maximum', () => {
      const result = sizer.calculateSize({
        baseSize: 100,
        cluster_strength: 1.0,
        trend_formation: true
      });

      expect(result.size_multiplier).toBeLessThanOrEqual(2.0);
    });
  });

  describe('Conviction Levels', () => {
    it('should assign conviction levels correctly', () => {
      const veryHigh = sizer.calculateSize({
        baseSize: 100,
        cluster_strength: 0.95,
        trend_formation: true
      });

      expect(veryHigh.conviction_level).toBe('very_high');

      const moderate = sizer.calculateSize({
        baseSize: 100,
        cluster_strength: 0.5,
        trend_formation: true
      });

      expect(moderate.conviction_level).toBe('moderate');
    });
  });

  describe('Portfolio Heat Calculation', () => {
    it('should calculate total portfolio heat', () => {
      const results = [
        sizer.calculateSize({
          baseSize: 100,
          cluster_strength: 0.9,
          trend_formation: true
        }),
        sizer.calculateSize({
          baseSize: 100,
          cluster_strength: 0.5,
          trend_formation: true
        })
      ];

      const heat = sizer.calculatePortfolioHeat(results);

      expect(heat.total_heat).toBeGreaterThan(0);
      expect(heat.heat_status).toBeDefined();
    });
  });

  describe('Ranking by Conviction', () => {
    it('should rank positions by conviction', () => {
      const results = [
        sizer.calculateSize({
          baseSize: 100,
          cluster_strength: 0.5,
          trend_formation: true
        }),
        sizer.calculateSize({
          baseSize: 100,
          cluster_strength: 0.9,
          trend_formation: true
        }),
        sizer.calculateSize({
          baseSize: 100,
          cluster_strength: 0.2,
          trend_formation: false
        })
      ];

      const ranked = sizer.rankByConviction(results);

      expect(ranked[0].conviction_level).toBe('very_high');
      expect(ranked[1].conviction_level).toBe('moderate');
      expect(ranked[2].conviction_level).toBe('very_low');
    });
  });
});

// ============================================================================
// TEST SUITE 3: ReversalDetector Tests
// ============================================================================

describe('ReversalDetector', () => {
  let detector: ReversalDetector;

  beforeEach(() => {
    detector = new ReversalDetector();
  });

  describe('Cluster Breakdown Detection', () => {
    it('should detect mild breakdown', () => {
      const prev: ClusterSnapshot = {
        cluster_strength: 0.8,
        trend_formation_signal: true,
        directional_ratio: 0.8,
        follow_through: 0.8,
        timestamp: 0
      };

      const curr: ClusterSnapshot = {
        cluster_strength: 0.7,
        trend_formation_signal: true,
        directional_ratio: 0.7,
        follow_through: 0.7,
        timestamp: 1000
      };

      const breakdown = detector.detectBreakdown(prev, curr);

      expect(breakdown.breakdown_severity).toBe('mild');
      expect(breakdown.strength_decline).toBeCloseTo(0.1, 1);
    });

    it('should detect severe breakdown (trend ending)', () => {
      const prev: ClusterSnapshot = {
        cluster_strength: 0.9,
        trend_formation_signal: true,
        directional_ratio: 0.9,
        follow_through: 0.9,
        timestamp: 0
      };

      const curr: ClusterSnapshot = {
        cluster_strength: 0.3,
        trend_formation_signal: false,
        directional_ratio: 0.35,
        follow_through: 0.3,
        timestamp: 1000
      };

      const breakdown = detector.detectBreakdown(prev, curr);

      expect(breakdown.breakdown_severity).toBe('severe');
      expect(breakdown.formation_loss).toBe(true);
      expect(breakdown.reversal_probability).toBeGreaterThan(0.65);
    });

    it('should calculate reversal probability correctly', () => {
      const prev: ClusterSnapshot = {
        cluster_strength: 0.8,
        trend_formation_signal: true,
        directional_ratio: 0.8,
        follow_through: 0.8,
        timestamp: 0
      };

      const curr: ClusterSnapshot = {
        cluster_strength: 0.2,
        trend_formation_signal: false,
        directional_ratio: 0.25,
        follow_through: 0.2,
        timestamp: 1000
      };

      const breakdown = detector.detectBreakdown(prev, curr);

      // With 0.6 decline + formation loss = ~0.8 probability
      expect(breakdown.reversal_probability).toBeGreaterThan(0.75);
    });
  });

  describe('Multi-Period Breakdown Detection', () => {
    it('should detect consecutive declines', () => {
      const snapshots: ClusterSnapshot[] = [
        { cluster_strength: 0.9, trend_formation_signal: true, directional_ratio: 0.9, follow_through: 0.9, timestamp: 0 },
        { cluster_strength: 0.8, trend_formation_signal: true, directional_ratio: 0.8, follow_through: 0.8, timestamp: 1000 },
        { cluster_strength: 0.6, trend_formation_signal: true, directional_ratio: 0.6, follow_through: 0.6, timestamp: 2000 },
        { cluster_strength: 0.4, trend_formation_signal: false, directional_ratio: 0.4, follow_through: 0.4, timestamp: 3000 }
      ];

      snapshots.forEach(s => detector.addSnapshot(s));
      const multi = detector.detectMultiPeriodBreakdown(2);

      expect(multi.is_multi_period).toBe(true);
      expect(multi.consecutive_declines).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Trend Strength Trend Analysis', () => {
    it('should detect accelerating trend', () => {
      const snapshots: ClusterSnapshot[] = [
        { cluster_strength: 0.5, trend_formation_signal: true, directional_ratio: 0.5, follow_through: 0.5, timestamp: 0 },
        { cluster_strength: 0.7, trend_formation_signal: true, directional_ratio: 0.7, follow_through: 0.7, timestamp: 1000 },
        { cluster_strength: 0.9, trend_formation_signal: true, directional_ratio: 0.9, follow_through: 0.9, timestamp: 2000 }
      ];

      snapshots.forEach(s => detector.addSnapshot(s));
      const trend = detector.getTrendStrengthTrend();

      expect(trend).toBe('accelerating');
    });
  });

  describe('History Statistics', () => {
    it('should calculate breakdown statistics', () => {
      const snapshots: ClusterSnapshot[] = [
        { cluster_strength: 0.5, trend_formation_signal: true, directional_ratio: 0.5, follow_through: 0.5, timestamp: 0 },
        { cluster_strength: 0.7, trend_formation_signal: true, directional_ratio: 0.7, follow_through: 0.7, timestamp: 1000 },
        { cluster_strength: 0.6, trend_formation_signal: true, directional_ratio: 0.6, follow_through: 0.6, timestamp: 2000 }
      ];

      snapshots.forEach(s => detector.addSnapshot(s));
      const stats = detector.getBreakdownStatistics();

      expect(stats.total_snapshots).toBe(3);
      expect(stats.average_strength).toBeGreaterThan(0.5);
      expect(stats.strength_range.min).toBe(0.5);
      expect(stats.strength_range.max).toBe(0.7);
    });
  });
});

// ============================================================================
// TEST SUITE 4: Agent Integration Tests
// ============================================================================

describe('Agent Integration', () => {
  it('should enhance signal with clustering', () => {
    const processor = getClusteringProcessor();

    const baseSignal = {
      action: 'BUY' as const,
      entry: 100,
      target: 105,
      stop: 95,
      confidence: 0.7,
      reason: 'Test signal',
      agent_name: 'TestAgent',
      agent_level: 1
    };

    const clusterMetrics: ClusterMetrics = {
      trend_formation_signal: true,
      cluster_strength: 0.75,
      directional_ratio: 0.8,
      follow_through: 0.7,
      total_clusters: 5,
      bullish_clusters: 4,
      bearish_clusters: 1
    };

    const enhanced = processor.enhanceSignal(baseSignal, clusterMetrics, 100);

    expect(enhanced.final_quality).toBeGreaterThan(0);
    expect(enhanced.recommended_size_multiplier).toBeGreaterThan(0.5);
    expect(enhanced.recommended_size_multiplier).toBeLessThanOrEqual(2.0);
    expect(enhanced.risk_level).toBeDefined();
  });

  it('should filter out low-quality entries', () => {
    const processor = getClusteringProcessor();

    const baseSignal = {
      action: 'BUY' as const,
      entry: 100,
      target: 105,
      stop: 95,
      confidence: 0.3,
      reason: 'Weak signal',
      agent_name: 'TestAgent',
      agent_level: 1
    };

    const weakCluster: ClusterMetrics = {
      trend_formation_signal: false,
      cluster_strength: 0.2,
      directional_ratio: 0.3,
      follow_through: 0.2,
      total_clusters: 2,
      bullish_clusters: 0,
      bearish_clusters: 2
    };

    const enhanced = processor.enhanceSignal(baseSignal, weakCluster, 100);

    expect(enhanced.final_quality).toBeLessThan(0.3);
    expect(enhanced.risk_level).toBe('very_high');
  });
});

/**
 * Run all tests
 */
if (typeof describe !== 'undefined') {
  console.log('✓ All clustering service tests defined');
  console.log('  Run with: npm test -- clustering.test.ts');
}
