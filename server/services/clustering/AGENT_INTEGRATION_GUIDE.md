/**
 * Agent Integration Guides
 * 
 * Step-by-step instructions for integrating clustering services into each agent
 * Use these patterns to modify TrendRider.ts, ReversalMaster.ts, BreakoutHunter.ts, SupportSniper.ts
 */

import {
  getClusteringProcessor,
  applyClusteringToSignal,
  getSizingMultiplier,
  type ClusterEnhancedAgentSignal
} from './agent-integration';
import type { ClusterMetrics } from './cluster-validator';

/**
 * ============================================================================
 * PATTERN 1: TrendRider Integration
 * ============================================================================
 * 
 * TrendRider needs:
 * 1. Entry Quality Scoring - Validate gradient signal with clusters
 * 2. Trend Confirmation - Require cluster trend_formation_signal
 * 3. Position Sizing - Scale by cluster_strength
 * 
 * Integration Points:
 * - processSignal() method (around line 42)
 * - calculateTarget() method (add sizing multiplier)
 * - Signal return (use applyClusteringToSignal)
 */

export const TRENDRI DER_INTEGRATION_PATTERN = `
// At top of file, add import
import { getClusteringProcessor, applyClusteringToSignal } from '../clustering/agent-integration';
import type { ClusterMetrics } from '../clustering/cluster-validator';

export class TrendRider extends TradingAgent {
  // ... existing code ...
  
  processSignal(marketData: any): AgentSignal | null {
    const { 
      price, ema20, ema50, ema200, adx, macd, volume, avg_volume, regime,
      high, low, close, price_history,
      // NEW: Add cluster metrics
      cluster_metrics  // From marketData.cluster_metrics
    } = marketData;
    
    // ... existing gradient analysis ...
    
    // IMPORTANT: Validate entry with clustering
    // If clusters aren't trending, reduce confidence even if gradient looks good
    if (cluster_metrics && cluster_metrics.trend_formation_signal) {
      // Clusters confirm trend - keep full quality
      quality *= 1.1;  // 10% bonus
    } else if (cluster_metrics && cluster_metrics.cluster_strength > 0.5) {
      // Clusters partially aligned - reduce confidence
      quality *= 0.8;  // 20% penalty
    } else {
      // Clusters weak - significant penalty or skip
      if (quality < 0.70) return null;
      quality *= 0.6;  // 40% penalty
    }
    
    // ... rest of signal calculation ...
    
    // Create base signal
    const baseSignal = {
      action: 'BUY' as const,
      confidence: Math.min(quality, 0.95),
      entry: price,
      target,
      stop,
      reason: \`...\`,
      agent_name: this.name,
      agent_level: this.level
    };
    
    // APPLY CLUSTERING ENHANCEMENT
    const processor = getClusteringProcessor();
    const enhancedSignal = processor.enhanceSignal(
      baseSignal,
      cluster_metrics,
      this.position_base_size || 100
    );
    
    // Optional: Filter out low-quality entries
    if (enhancedSignal.final_quality < 0.60) {
      return null;  // Skip this entry
    }
    
    // Return enhanced signal with clustering metrics
    return enhancedSignal as any;
  }
`;

/**
 * ============================================================================
 * PATTERN 2: ReversalMaster Integration
 * ============================================================================
 * 
 * ReversalMaster needs:
 * 1. Reversal Validation - Use cluster breakdown to filter false reversals
 * 2. Probability Adjustment - Multiply reversal_probability by cluster breakdown
 * 3. Confidence Filtering - Cluster breakdown strength adjusts final confidence
 * 
 * Integration Points:
 * - processSignal() method (around line 65)
 * - analyzeMeanReversion() method (add cluster filter)
 * - Signal return (filter with reversal detector)
 */

export const REVERSALMASTER_INTEGRATION_PATTERN = `
// At top of file, add import
import { getClusteringProcessor } from '../clustering/agent-integration';
import type { ClusterMetrics } from '../clustering/cluster-validator';

export class ReversalMaster extends TradingAgent {
  // Add tracking for previous cluster state
  private prevClusterMetrics: ClusterMetrics | null = null;
  
  processSignal(marketData: any): AgentSignal | null {
    const {
      price, support, resistance, rsi, macd, volume, avg_volume, regime,
      price_history, rsi_history, high, low, close, ema20, ema50, atr,
      // NEW: Add cluster metrics
      cluster_metrics  // From marketData.cluster_metrics
    } = marketData;
    
    // ... existing mean reversion analysis ...
    
    const analysis = this.analyzeMeanReversion(marketData);
    
    if (analysis.confluence_score < 0.5) return null;
    
    // ... calculate quality ...
    
    // NEW: VALIDATE WITH CLUSTER BREAKDOWN
    // Check if clusters are breaking down (important for reversal confirmation)
    const processor = getClusteringProcessor();
    
    if (this.prevClusterMetrics && cluster_metrics) {
      const reversal_analysis = processor.analyzeReversal(
        marketData.symbol,
        this.prevClusterMetrics,
        cluster_metrics,
        quality  // Use existing quality as base
      );
      
      // Strong cluster breakdown = strong reversal signal
      if (reversal_analysis.breakdown.reversal_probability > 0.70) {
        quality *= 1.2;  // 20% bonus for strong breakdown
      } else if (reversal_analysis.breakdown.reversal_probability > 0.50) {
        quality *= 1.0;  // No bonus
      } else {
        // Weak breakdown - this reversal may be false
        quality *= 0.7;  // 30% penalty
      }
    }
    
    // Store current clusters for next iteration
    if (cluster_metrics) {
      this.prevClusterMetrics = cluster_metrics;
    }
    
    // ... rest of signal processing ...
    
    // IMPORTANT: Only enter reversals with strong cluster breakdown
    if (quality < 0.70 || !cluster_metrics?.trend_formation_signal) {
      return null;
    }
    
    const baseSignal = {
      action: is_bullish ? 'BUY' : 'SELL' as const,
      confidence: Math.min(quality, 0.95),
      entry: price,
      target,
      stop,
      reason: \`...\`,
      agent_name: this.name,
      agent_level: this.level
    };
    
    // Apply clustering
    const enhancedSignal = processor.enhanceSignal(
      baseSignal,
      cluster_metrics,
      this.position_base_size || 100
    );
    
    // Filter out if reversal confidence is low after cluster analysis
    if (!processor.passesClusteringFilters(enhancedSignal.entry_quality!)) {
      return null;
    }
    
    return enhancedSignal as any;
  }
`;

/**
 * ============================================================================
 * PATTERN 3: BreakoutHunter Integration
 * ============================================================================
 * 
 * BreakoutHunter needs:
 * 1. Breakout Confirmation - Cluster strength validates real breakout vs fake
 * 2. Momentum Validation - High cluster_strength = confirmed momentum
 * 3. Position Scaling - Scale breakout size by cluster_strength
 * 
 * Integration Points:
 * - processSignal() method
 * - breakoutValidation() method (add cluster check)
 * - Signal return (apply sizing)
 */

export const BREAKOUTHUNTER_INTEGRATION_PATTERN = `
// At top of file, add import
import { getClusteringProcessor, getSizingMultiplier } from '../clustering/agent-integration';
import type { ClusterMetrics } from '../clustering/cluster-validator';

export class BreakoutHunter extends TradingAgent {
  processSignal(marketData: any): AgentSignal | null {
    const {
      price, resistance, support, volume, avg_volume, atr,
      // NEW: cluster metrics
      cluster_metrics
    } = marketData;
    
    // ... existing breakout detection ...
    
    // Validate it's a real breakout, not just a spike
    if (cluster_metrics) {
      // Real breakout has strong clusters (0.7+) and trend forming
      if (!cluster_metrics.trend_formation_signal || 
          cluster_metrics.cluster_strength < 0.6) {
        // Weak clusters = fake breakout risk
        quality *= 0.5;  // Heavy penalty
      }
    }
    
    // ... rest of validation ...
    
    const baseSignal = {
      action: 'BUY' as const,
      confidence: quality,
      entry: price,
      target: resistance * 1.02,
      stop: support * 0.98,
      reason: \`Breakout above resistance\`,
      agent_name: this.name,
      agent_level: this.level
    };
    
    // Apply clustering
    const processor = getClusteringProcessor();
    const enhancedSignal = processor.enhanceSignal(
      baseSignal,
      cluster_metrics,
      this.position_base_size || 100
    );
    
    return enhancedSignal as any;
  }
`;

/**
 * ============================================================================
 * PATTERN 4: SupportSniper Integration
 * ============================================================================
 * 
 * SupportSniper needs:
 * 1. Zone Strength Validation - Cluster strength validates support level
 * 2. Bounce Confirmation - Cluster trend_forming = real bounce
 * 3. Position Scaling - Cluster strength scales bounce size
 * 
 * Integration Points:
 * - processSignal() method
 * - identifyBounceZone() method
 * - Signal return (apply sizing)
 */

export const SUPPORTSNIPER_INTEGRATION_PATTERN = `
// At top of file, add import
import { getClusteringProcessor } from '../clustering/agent-integration';
import type { ClusterMetrics } from '../clustering/cluster-validator';

export class SupportSniper extends TradingAgent {
  processSignal(marketData: any): AgentSignal | null {
    const {
      price, support, resistance,
      // NEW: cluster metrics
      cluster_metrics
    } = marketData;
    
    // ... existing bounce/support detection ...
    
    // Validate bounce with clusters
    if (cluster_metrics) {
      if (cluster_metrics.trend_formation_signal && 
          cluster_metrics.directional_ratio > 0.7) {
        // Strong bounce confirmation
        quality *= 1.2;
      } else if (cluster_metrics.cluster_strength > 0.5) {
        // Moderate confirmation
        quality *= 1.0;
      } else {
        // Weak clusters = weak bounce signal
        quality *= 0.6;
      }
    }
    
    // ... rest of validation ...
    
    const baseSignal = {
      action: 'BUY' as const,
      confidence: quality,
      entry: price,
      target: resistance,
      stop: support * 0.99,
      reason: \`Support bounce\`,
      agent_name: this.name,
      agent_level: this.level
    };
    
    // Apply clustering
    const processor = getClusteringProcessor();
    const enhancedSignal = processor.enhanceSignal(
      baseSignal,
      cluster_metrics,
      this.position_base_size || 100
    );
    
    return enhancedSignal as any;
  }
`;

/**
 * ============================================================================
 * COMMON IMPLEMENTATION STEPS (For all agents)
 * ============================================================================
 * 
 * 1. Add imports at top of agent file:
 *    import { getClusteringProcessor, applyClusteringToSignal } from '../clustering/agent-integration';
 *    import type { ClusterMetrics } from '../clustering/cluster-validator';
 * 
 * 2. In processSignal() method:
 *    - Destructure cluster_metrics from marketData
 *    - Add cluster-based quality adjustments (lines shown above)
 *    - Use cluster_strength to validate core signal
 * 
 * 3. Before returning signal:
 *    - Use processor.enhanceSignal() to apply clustering validation
 *    - Check if signal passes clustering filters
 *    - Return enhanced signal with sizing multipliers
 * 
 * 4. Optional: Add cluster history tracking
 *    - Store previous cluster state
 *    - Detect cluster breakdowns
 *    - Use for reversal/exhaustion signals
 * 
 * ============================================================================
 */

/**
 * Quick test to verify integration
 */
export function testClusteringIntegration() {
  console.log('Testing clustering integration...');
  
  const processor = getClusteringProcessor();
  
  // Mock cluster metrics
  const clusterMetrics: ClusterMetrics = {
    trend_formation_signal: true,
    cluster_strength: 0.75,
    directional_ratio: 0.80,
    follow_through: 0.70,
    total_clusters: 5,
    bullish_clusters: 4,
    bearish_clusters: 1
  };
  
  // Mock base signal
  const baseSignal = {
    action: 'BUY' as const,
    entry: 100,
    target: 105,
    stop: 95,
    confidence: 0.70,
    reason: 'Test signal',
    agent_name: 'TestAgent',
    agent_level: 1
  };
  
  // Enhance with clustering
  const enhanced = processor.enhanceSignal(baseSignal, clusterMetrics, 100);
  
  console.log('✓ Enhanced signal:', enhanced);
  console.log('  - Entry quality:', enhanced.entry_quality?.confidence_level);
  console.log('  - Final quality:', (enhanced.final_quality * 100).toFixed(0) + '%');
  console.log('  - Recommended size:', (enhanced.recommended_size_multiplier * 100).toFixed(0) + '%');
  console.log('  - Risk level:', enhanced.risk_level);
  
  return enhanced;
}
`;

export default {
  TRENDRI DER_INTEGRATION_PATTERN,
  REVERSALMASTER_INTEGRATION_PATTERN,
  BREAKOUTHUNTER_INTEGRATION_PATTERN,
  SUPPORTSNIPER_INTEGRATION_PATTERN
};
