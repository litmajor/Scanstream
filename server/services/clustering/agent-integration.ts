/**
 * Agent Clustering Integration Layer
 * 
 * Integrates ClusterValidator, PositionSizer, and ReversalDetector
 * into trading agents (TrendRider, BreakoutHunter, ReversalMaster, SupportSniper)
 * 
 * This module serves as the middleware between:
 * - Clustering services (cluster-validator, position-sizer, reversal-detector)
 * - Trading agents (need to use cluster metrics)
 * - Signal pipeline (needs to pass cluster data through)
 */

import {
  ClusterValidator,
  type ClusterMetrics,
  type ClusterEnhancedEntry,
  createClusterValidator
} from './cluster-validator';

import {
  PositionSizer,
  type PositionSizingInput,
  type PositionSizingResult,
  createPositionSizer
} from './position-sizer';

import {
  ReversalDetector,
  type ClusterBreakdown,
  type ClusterSnapshot,
  createReversalDetector
} from './reversal-detector';

/**
 * Cluster-enhanced agent signal (extends base AgentSignal)
 */
export interface ClusterEnhancedAgentSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  entry: number;
  target: number;
  stop: number;
  confidence: number; // 0-1
  reason: string;
  agent_name: string;
  agent_level: number;
  
  // Clustering additions
  cluster_metrics?: ClusterMetrics;
  entry_quality?: ClusterEnhancedEntry;
  position_sizing?: PositionSizingResult;
  reversal_analysis?: ClusterBreakdown;
  
  // Combined metrics
  final_quality: number; // 0-1 (after all clustering validation)
  recommended_size_multiplier: number; // 0.5-2.0
  risk_level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
}

/**
 * Integrated Cluster Signal Processor
 * 
 * Used by agents to process signals with clustering validation
 */
export class ClusteringSignalProcessor {
  private validator: ClusterValidator;
  private sizer: PositionSizer;
  private detector: ReversalDetector;
  private reversal_history: Map<string, ClusterSnapshot[]> = new Map();

  constructor() {
    this.validator = createClusterValidator();
    this.sizer = createPositionSizer();
    this.detector = createReversalDetector();
  }

  /**
   * Enhance agent signal with clustering validation
   */
  enhanceSignal(
    baseSignal: {
      action: 'BUY' | 'SELL' | 'HOLD';
      entry: number;
      target: number;
      stop: number;
      confidence: number;
      reason: string;
      agent_name: string;
      agent_level: number;
    },
    clusterMetrics: ClusterMetrics,
    basePositionSize: number = 100
  ): ClusterEnhancedAgentSignal {
    // 1. Validate entry with clustering
    const entry_quality = this.validator.validateEntry(
      baseSignal.confidence,
      clusterMetrics
    );

    // 2. Calculate position size with clustering
    const position_sizing = this.sizer.calculateSize({
      baseSize: basePositionSize,
      cluster_strength: clusterMetrics.cluster_strength,
      trend_formation: clusterMetrics.trend_formation_signal,
      signal_quality: baseSignal.confidence
    });

    // 3. Calculate final quality (combining base signal + clustering)
    const final_quality = baseSignal.confidence * entry_quality.final_entry_quality;

    // 4. Determine risk level
    const risk_level = this.getRiskLevel(
      final_quality,
      clusterMetrics.cluster_strength,
      clusterMetrics.trend_formation_signal
    );

    return {
      action: baseSignal.action,
      entry: baseSignal.entry,
      target: baseSignal.target,
      stop: baseSignal.stop,
      confidence: baseSignal.confidence,
      reason: this.buildEnhancedReason(
        baseSignal.reason,
        entry_quality,
        position_sizing
      ),
      agent_name: baseSignal.agent_name,
      agent_level: baseSignal.agent_level,
      
      cluster_metrics: clusterMetrics,
      entry_quality,
      position_sizing,
      
      final_quality,
      recommended_size_multiplier: position_sizing.size_multiplier,
      risk_level
    };
  }

  /**
   * Analyze reversal with cluster breakdown detection
   */
  analyzeReversal(
    symbol: string,
    prevCluster: ClusterMetrics,
    currCluster: ClusterMetrics,
    baseReversalConfidence: number
  ): {
    breakdown: ClusterBreakdown;
    filtered_confidence: number;
    reversal_conviction: 'low' | 'moderate' | 'high' | 'very_high';
  } {
    const prevSnapshot: ClusterSnapshot = {
      cluster_strength: prevCluster.cluster_strength,
      trend_formation_signal: prevCluster.trend_formation_signal,
      directional_ratio: prevCluster.directional_ratio,
      follow_through: prevCluster.follow_through,
      timestamp: Date.now()
    };

    const currSnapshot: ClusterSnapshot = {
      cluster_strength: currCluster.cluster_strength,
      trend_formation_signal: currCluster.trend_formation_signal,
      directional_ratio: currCluster.directional_ratio,
      follow_through: currCluster.follow_through,
      timestamp: Date.now()
    };

    const breakdown = this.detector.detectBreakdown(prevSnapshot, currSnapshot);
    
    // Filter base confidence through reversal probability
    const filter_result = this.detector.filterSignal(
      baseReversalConfidence,
      breakdown
    );

    const reversal_conviction = breakdown.reversal_confidence;

    return {
      breakdown,
      filtered_confidence: filter_result.filtered_confidence,
      reversal_conviction
    };
  }

  /**
   * Build enhanced reasoning combining base signal + clustering insights
   */
  private buildEnhancedReason(
    baseReason: string,
    entryQuality: ClusterEnhancedEntry,
    positioning: PositionSizingResult
  ): string {
    const parts: string[] = [baseReason];

    // Add clustering insights
    if (entryQuality.confidence_level === 'very_high') {
      parts.push('✓ Very high entry quality (clustering confirmed)');
    } else if (entryQuality.confidence_level === 'high') {
      parts.push('✓ High entry quality (clusters aligned)');
    } else if (entryQuality.confidence_level === 'moderate') {
      parts.push('⚠️ Moderate entry quality (partial clustering support)');
    } else {
      parts.push('✗ Low entry quality (weak clustering support)');
    }

    // Add sizing recommendation
    if (positioning.size_multiplier > 1.2) {
      parts.push(`🔥 Aggressive sizing (${(positioning.size_multiplier * 100).toFixed(0)}%)`);
    } else if (positioning.size_multiplier > 1.0) {
      parts.push(`Normal sizing (${(positioning.size_multiplier * 100).toFixed(0)}%)`);
    } else if (positioning.size_multiplier > 0.6) {
      parts.push(`Conservative sizing (${(positioning.size_multiplier * 100).toFixed(0)}%)`);
    } else {
      parts.push(`⚠️ Reduced sizing (${(positioning.size_multiplier * 100).toFixed(0)}%)`);
    }

    return parts.join(' • ');
  }

  /**
   * Determine risk level from quality metrics
   */
  private getRiskLevel(
    quality: number,
    clusterStrength: number,
    trendForming: boolean
  ): 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' {
    // High quality + strong clusters + trend = very low risk
    if (quality > 0.80 && clusterStrength > 0.75 && trendForming) {
      return 'very_low';
    }

    // Moderate quality + moderate clusters = moderate risk
    if (quality > 0.60 && clusterStrength > 0.5 && trendForming) {
      return 'low';
    }

    // Borderline quality = moderate risk
    if (quality > 0.50) {
      return 'moderate';
    }

    // Low quality + weak clusters = high risk
    if (quality > 0.35) {
      return 'high';
    }

    return 'very_high';
  }

  /**
   * Check if entry passes all clustering filters
   */
  passesClusteringFilters(
    entryQuality: ClusterEnhancedEntry,
    minQuality: number = 0.60
  ): boolean {
    return entryQuality.final_entry_quality >= minQuality &&
           entryQuality.entry_recommendation !== 'skip';
  }

  /**
   * Get all services for agent access
   */
  getServices() {
    return {
      validator: this.validator,
      sizer: this.sizer,
      detector: this.detector
    };
  }
}

/**
 * Create a singleton processor instance
 */
let processorInstance: ClusteringSignalProcessor | null = null;

export function getClusteringProcessor(): ClusteringSignalProcessor {
  if (!processorInstance) {
    processorInstance = new ClusteringSignalProcessor();
  }
  return processorInstance;
}

/**
 * Helper: Apply clustering to any agent signal
 */
export function applyClusteringToSignal(
  baseSignal: any,
  clusterMetrics: ClusterMetrics,
  basePositionSize?: number
): ClusterEnhancedAgentSignal {
  const processor = getClusteringProcessor();
  return processor.enhanceSignal(baseSignal, clusterMetrics, basePositionSize);
}

/**
 * Helper: Check if clustering passes quality threshold
 */
export function passesClusteringQuality(
  entryQuality: ClusterEnhancedEntry,
  minQuality: number = 0.60
): boolean {
  const processor = getClusteringProcessor();
  return processor.passesClusteringFilters(entryQuality, minQuality);
}

/**
 * Helper: Get sizing multiplier from clustering
 */
export function getSizingMultiplier(
  clusterMetrics: ClusterMetrics,
  baseSignalQuality: number = 0.7
): number {
  const processor = getClusteringProcessor();
  const sizing = processor as any;
  
  const result = sizing.sizer.calculateSize({
    baseSize: 1, // Use 1 as base to get pure multiplier
    cluster_strength: clusterMetrics.cluster_strength,
    trend_formation: clusterMetrics.trend_formation_signal,
    signal_quality: baseSignalQuality
  });
  
  return result.size_multiplier;
}
