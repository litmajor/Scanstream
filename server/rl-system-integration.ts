/**
 * RL System Integration Bridge
 *
 * Clean integration of multi-domain RL into existing trading systems.
 * - SOURCE_WEIGHTING domain → ConsensusEngine
 * - CLUSTER_THRESHOLD domain → ClusterValidator
 * - Full feedback loop → TradeLifecycleManager
 *
 * Integration is additive — RL controls specific decisions, legacy code unchanged.
 */

import { RLPositionAgent, SourceWeightAction, ClusterThresholdAction } from './rl-position-agent';
import { TradeLifecycleManager } from './rl-feedback-loop';
import { MarketFrame } from '@shared/schema';

// ─── Singleton instances (wire into your service layer) ─────────────────────

export const rlAgent = new RLPositionAgent();
export const rlFeedback = new TradeLifecycleManager(rlAgent);

// ─── Integration Point 1: Consensus Weighting ─────────────────────────────────
//
// Replace static 0.40 / 0.35 / 0.25 with RL-learned weights
// This closes Issue #3: Adaptive Signal Source Weighting

export interface ConsensusWeights {
  scannerWeight: number;
  mlWeight: number;
  rlWeight: number;
  isRLControlled: boolean; // Flag to indicate RL is making this decision
}

/**
 * Get adaptive consensus weights from RL agent
 * Falls back to static defaults if RL hasn't learned yet
 */
export function getAdaptiveConsensusWeights(
  frames: MarketFrame[],
  mlConfidence: number,
  regime: string,
  drawdown: number
): ConsensusWeights {
  try {
    // Extract RL state from current market
    const state = rlAgent.extractState(frames, mlConfidence, regime, drawdown);
    
    // Get SOURCE_WEIGHTING domain decision
    const action = rlAgent.selectActionForDomain(
      'SOURCE_WEIGHTING',
      state,
      false // exploration: use best action (no randomness) in production
    );
    
    const weights = action as SourceWeightAction;
    
    return {
      scannerWeight: weights.scannerWeight,
      mlWeight: weights.mlWeight,
      rlWeight: weights.rlWeight,
      isRLControlled: true
    };
  } catch (error) {
    console.warn('[RL-Integration] Failed to get RL weights, using defaults:', error);
    
    // Fallback to static defaults
    return {
      scannerWeight: 0.40,
      mlWeight: 0.35,
      rlWeight: 0.25,
      isRLControlled: false
    };
  }
}

/**
 * Calculate weighted consensus score using RL-adaptive weights
 *
 * This replaces the static weighting in ConsensusEngine.
 * Pass this into your existing signal synthesis logic.
 */
export function calculateWeightedConsensusScore(
  scannerConfidence: number,
  mlConfidence: number,
  rlConfidence: number,
  weights: ConsensusWeights
): number {
  return (
    scannerConfidence * weights.scannerWeight +
    mlConfidence * weights.mlWeight +
    rlConfidence * weights.rlWeight
  );
}

// ─── Integration Point 2: Cluster Threshold ────────────────────────────────────
//
// Replace hardcoded 0.75 threshold with RL-learned adaptive thresholds
// This closes Issue #1: Cluster Gate Calibration

export interface AdaptiveClusterThreshold {
  minClusterStrength: number;
  minFollowThrough: number;
  minDirectionalRatio: number;
  isRLControlled: boolean; // Flag to indicate RL is making this decision
}

/**
 * Get adaptive cluster thresholds from RL agent
 * Falls back to sensible defaults if RL hasn't learned yet
 */
export function getAdaptiveClusterThreshold(
  frames: MarketFrame[],
  mlConfidence: number,
  regime: string,
  drawdown: number
): AdaptiveClusterThreshold {
  try {
    // Extract RL state from current market
    const state = rlAgent.extractState(frames, mlConfidence, regime, drawdown);
    
    // Get CLUSTER_THRESHOLD domain decision
    const action = rlAgent.selectActionForDomain(
      'CLUSTER_THRESHOLD',
      state,
      false // exploration: use best action (no randomness) in production
    );
    
    const threshold = action as ClusterThresholdAction;
    
    return {
      minClusterStrength: threshold.minClusterStrength,
      minFollowThrough: threshold.minFollowThrough,
      minDirectionalRatio: threshold.minDirectionalRatio,
      isRLControlled: true
    };
  } catch (error) {
    console.warn('[RL-Integration] Failed to get RL thresholds, using defaults:', error);
    
    // Fallback to sensible defaults
    return {
      minClusterStrength: 0.70,
      minFollowThrough: 0.40,
      minDirectionalRatio: 0.60,
      isRLControlled: false
    };
  }
}

/**
 * Validate cluster metrics against adaptive thresholds
 *
 * This replaces the hardcoded checks in ClusterValidator.
 * Pass this into your existing entry validation logic.
 */
export function validateClusterGate(
  clusterMetrics: {
    cluster_strength: number;
    follow_through: number;
    directional_ratio: number;
  },
  threshold: AdaptiveClusterThreshold
): boolean {
  return (
    clusterMetrics.cluster_strength >= threshold.minClusterStrength &&
    clusterMetrics.follow_through >= threshold.minFollowThrough &&
    clusterMetrics.directional_ratio >= threshold.minDirectionalRatio
  );
}

// ─── Integration Point 3: Feedback Loop Registry ────────────────────────────────
//
// These are the 3 callbacks your execution engine must call

export const RLFeedbackCallbacks = {
  /**
   * Call this when a trade opens (after order fill confirmed)
   *
   * Example:
   *   const snapshot = {
   *     tradeId: `${symbol}_${timestamp}`,
   *     symbol,
   *     direction: 'BUY',
   *     entryState: rlAgent.extractState(...),
   *     signalPrice: 42550,
   *     entryFillPrice: 42560,
   *     entryTime: Date.now(),
   *     domainActions: { positionSizing, entryTiming, sourceWeights, exitSequence, clusterThreshold },
   *     consensusScoreAtEntry: 0.72,
   *     clusterPassedGate: true,
   *     basePositionSize: 2000,
   *     atr: 420
   *   };
   *   rlFeedback.onTradeOpen(snapshot);
   */
  onTradeOpen: (snapshot: any) => rlFeedback.onTradeOpen(snapshot),

  /**
   * Call this each bar while trade is open to track MFE/MAE
   *
   * Example:
   *   rlFeedback.onTradeTick(tradeId, currentPrice, Date.now());
   */
  onTradeTick: (tradeId: string, currentPrice: number) => 
    rlFeedback.onTradeTick(tradeId, currentPrice, Date.now()),

  /**
   * Call this when trade closes to calculate domain rewards
   *
   * Example:
   *   rlFeedback.onTradeClose(tradeId, {
   *     exitPrice: 42700,
   *     exitTime: Date.now(),
   *     exitReason: 'TP_HIT',
   *     pnlDollars: 140,
   *     pnlPercent: 0.329,
   *     mfe: 0,  // Will be filled from live tracking
   *     mae: 0,  // Will be filled from live tracking
   *     maxPossiblePnlPct: 0,  // Will be calculated internally
   *     riskRewardAchieved: 1.5,
   *     holdingBars: 12
   *   });
   */
  onTradeClose: (tradeId: string, record: any) => rlFeedback.onTradeClose(tradeId, record)
};

// ─── Health & Monitoring ──────────────────────────────────────────────────────

export function getRLSystemStatus() {
  const stats = rlAgent.getDomainStats();
  const domains = Array.from(stats.entries());
  
  return {
    openTrades: rlFeedback.openTradeCount,
    closedTrades: rlFeedback.closedTradeCount,
    pendingTradeIds: rlFeedback.pendingTradeIds,
    domainLearningStatus: Object.fromEntries(
      domains.map(([domain, stat]) => [
        domain,
        {
          qTableSize: stat.qTableSize,
          experienceCount: stat.experienceCount,
          convergencePercent: Math.min(100, (stat.experienceCount / 500) * 100),
          hasLearned: stat.experienceCount > 50
        }
      ])
    )
  };
}

/**
 * Log domain convergence status
 */
export function logRLConvergenceStatus() {
  const status = getRLSystemStatus();
  
  console.log('[RL-Integration] System Status:');
  console.log(`  Open trades: ${status.openTrades}`);
  console.log(`  Closed trades: ${status.closedTrades}`);
  
  for (const [domain, info] of Object.entries(status.domainLearningStatus)) {
    const bar = '█'.repeat(Math.floor(info.convergencePercent / 5)) + 
               '░'.repeat(20 - Math.floor(info.convergencePercent / 5));
    console.log(
      `  [${domain}] ${bar} ${info.convergencePercent.toFixed(1)}% ` +
      `(${info.experienceCount} samples, Q-table: ${info.qTableSize})`
    );
  }
}

// ─── Step-by-Step Integration Checklist ────────────────────────────────────────

/**
 * Integration Step 1: Update ConsensusEngine / SignalSynthesis
 *
 * In your synthesizeSignals() or consensus weighting code, replace:
 *
 *   // OLD: Static weights
 *   const score = scannerConf * 0.40 + mlConf * 0.35 + rlConf * 0.25;
 *
 * With:
 *
 *   // NEW: RL-adaptive weights
 *   const weights = getAdaptiveConsensusWeights(frames, mlConf, regime, dd);
 *   const score = calculateWeightedConsensusScore(scannerConf, mlConf, rlConf, weights);
 *   console.log(`[RL] Using ${weights.isRLControlled ? 'learned' : 'default'} weights`);
 */

/**
 * Integration Step 2: Update ClusterValidator
 *
 * In your cluster validation code, replace:
 *
 *   // OLD: Hardcoded threshold
 *   if (metrics.cluster_strength >= 0.75) { ... }
 *
 * With:
 *
 *   // NEW: RL-adaptive threshold
 *   const threshold = getAdaptiveClusterThreshold(frames, mlConf, regime, dd);
 *   if (validateClusterGate(metrics, threshold)) { ... }
 *   console.log(`[RL] Using ${threshold.isRLControlled ? 'learned' : 'default'} thresholds`);
 */

/**
 * Integration Step 3: Wire Feedback Callbacks
 *
 * In your trade execution engine:
 *
 *   // After entry order fills
 *   RLFeedbackCallbacks.onTradeOpen(snapshot);
 *
 *   // Each bar in position monitor
 *   RLFeedbackCallbacks.onTradeTick(tradeId, currentPrice);
 *
 *   // After exit order fills
 *   RLFeedbackCallbacks.onTradeClose(tradeId, closeRecord);
 */

/**
 * Integration Step 4: Monitor Learning
 *
 * In your dashboard or logging:
 *
 *   setInterval(() => {
 *     logRLConvergenceStatus();
 *   }, 60000); // Every minute
 */
