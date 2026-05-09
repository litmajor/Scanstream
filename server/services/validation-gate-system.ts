/**
 * Validation Gate System - Decoupled from Confidence Scoring
 * ─────────────────────────────────────────────────────────
 * 
 * PROBLEM: Current system directly modifies confidence:
 *   Clustering: +0.08 boost
 *   Velocity:   +0.05 boost
 *   Result:     0.796 → 0.936 (+16% inflation)
 *   Impact:     positionSize scales with confidence → oversized positions
 * 
 * SOLUTION: Separate concerns
 *   - Confidence: Stays unchanged and auditable (0.796)
 *   - Gates: Return binary APPROVED/REJECTED + multipliers (1.0x to 2.0x)
 *   - Position sizing: Uses multipliers, not confidence
 * 
 * Benefits:
 * 1. Confidence remains pure (3-source voting only)
 * 2. Validation explicit (gates show reasoning)
 * 3. Service failures don't blow up positions
 * 4. Multipliers optional (can disable individually)
 */

import type { MarketFrame } from '@shared/schema';

// ============================================================================
// GATE DEFINITIONS
// ============================================================================

export enum GateStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED' // Service unavailable, neither approve nor reject
}

export interface ValidationGateResult {
  status: GateStatus;
  multiplier: number; // 1.0 (no boost) to 2.0 (max boost)
  confidence: number; // 0-1, how confident in this gate's decision
  reasoning: string[];
  raw_metrics?: Record<string, any>; // Debug data
}

export interface ValidationGateFeedback {
  gateId: string;
  isRLControlled: boolean; // True if using RL-learned thresholds
  learningEnabled: boolean; // Can this gate improve from trades?
}

// ============================================================================
// CLUSTERING VALIDATION GATE
// ============================================================================

export interface ClusteringGateConfig {
  minClusterStrength: number; // 0.55-0.80 (RL learnable)
  minFollowThrough: number;   // 0.45-0.75 (RL learnable)
  minDirectionalRatio: number; // 0.50-0.80 (RL learnable)
  
  // Multiplier bounds
  minMultiplier: number; // 1.0 (approved, no boost)
  maxMultiplier: number; // 2.0 (very strong clustering)
  
  // Fallback for service failures
  fallbackMultiplier: number; // Use if metrics unavailable
  fallbackStatus: GateStatus; // SKIPPED (degrade gracefully)
}

const DEFAULT_CLUSTERING_CONFIG: ClusteringGateConfig = {
  minClusterStrength: 0.70,
  minFollowThrough: 0.60,
  minDirectionalRatio: 0.65,
  minMultiplier: 1.0,
  maxMultiplier: 2.0,
  fallbackMultiplier: 1.0,
  fallbackStatus: GateStatus.SKIPPED
};

export class ClusteringValidationGate {
  private config: ClusteringGateConfig;
  private isRLControlled: boolean = false;
  private learningEnabled: boolean = true;

  constructor(config?: Partial<ClusteringGateConfig>) {
    this.config = { ...DEFAULT_CLUSTERING_CONFIG, ...config };
  }

  /**
   * Validate signal against clustering metrics
   * Returns gate result with multiplier (not confidence boost)
   */
  validate(
    clusterMetrics: {
      cluster_strength: number;
      follow_through: number;
      directional_ratio: number;
    } | null
  ): ValidationGateResult {
    // Handle missing data gracefully
    if (!clusterMetrics) {
      return {
        status: this.config.fallbackStatus,
        multiplier: this.config.fallbackMultiplier,
        confidence: 0,
        reasoning: ['Unable to fetch clustering metrics - degraded mode'],
        raw_metrics: {}
      };
    }

    const { cluster_strength, follow_through, directional_ratio } = clusterMetrics;

    // ─────────────────────────────────────────────────────────────────────
    // GATE LOGIC: Binary APPROVED/REJECTED (not continuous boost)
    // ─────────────────────────────────────────────────────────────────────
    const passes_strength = cluster_strength >= this.config.minClusterStrength;
    const passes_follow = follow_through >= this.config.minFollowThrough;
    const passes_direction = directional_ratio >= this.config.minDirectionalRatio;

    const all_pass = passes_strength && passes_follow && passes_direction;
    const some_pass = passes_strength || passes_follow || passes_direction;

    // Decision tree
    let status: GateStatus;
    let base_multiplier: number;
    let gate_confidence: number;

    if (all_pass) {
      // All metrics pass: Strong clustering
      status = GateStatus.APPROVED;
      base_multiplier = 2.0; // Max boost
      gate_confidence = 0.95; // Very confident
    } else if (some_pass) {
      // Partial pass: Moderate clustering
      status = GateStatus.APPROVED;
      const pass_count = [passes_strength, passes_follow, passes_direction].filter(x => x).length;
      base_multiplier = 1.0 + (pass_count / 3) * 0.5; // 1.0x to 1.5x
      gate_confidence = 0.70;
    } else {
      // All fail: No clustering support
      status = GateStatus.REJECTED;
      base_multiplier = 1.0; // No boost
      gate_confidence = 0.95; // Very confident in rejection
    }

    // Clamp multiplier to configured bounds
    const multiplier = Math.max(
      this.config.minMultiplier,
      Math.min(this.config.maxMultiplier, base_multiplier)
    );

    return {
      status,
      multiplier,
      confidence: gate_confidence,
      reasoning: [
        `Cluster strength: ${(cluster_strength * 100).toFixed(0)}% ${passes_strength ? '✓' : '✗'} (min: ${(this.config.minClusterStrength * 100).toFixed(0)}%)`,
        `Follow-through: ${(follow_through * 100).toFixed(0)}% ${passes_follow ? '✓' : '✗'} (min: ${(this.config.minFollowThrough * 100).toFixed(0)}%)`,
        `Directional ratio: ${(directional_ratio * 100).toFixed(0)}% ${passes_direction ? '✓' : '✗'} (min: ${(this.config.minDirectionalRatio * 100).toFixed(0)}%)`,
        `Decision: ${status} → Position multiplier: ${multiplier.toFixed(2)}x`
      ],
      raw_metrics: { cluster_strength, follow_through, directional_ratio }
    };
  }

  setRLControlled(isControlled: boolean): void {
    this.isRLControlled = isControlled;
  }

  getFeedback(): ValidationGateFeedback {
    return {
      gateId: 'clustering',
      isRLControlled: this.isRLControlled,
      learningEnabled: this.learningEnabled
    };
  }
}

// ============================================================================
// VELOCITY VALIDATION GATE
// ============================================================================

export interface VelocityGateConfig {
  minVelocityScore: number; // 0.55-0.85 (RL learnable)
  regimeAlignment: {
    BULL: number;    // How aligned must velocity be for bull regime?
    BEAR: number;
    RANGING: number;
  };
  
  // Multiplier bounds
  minMultiplier: number;
  maxMultiplier: number;
  fallbackMultiplier: number;
  fallbackStatus: GateStatus;
}

const DEFAULT_VELOCITY_CONFIG: VelocityGateConfig = {
  minVelocityScore: 0.65,
  regimeAlignment: {
    BULL: 0.70,
    BEAR: 0.70,
    RANGING: 0.60
  },
  minMultiplier: 1.0,
  maxMultiplier: 1.5,
  fallbackMultiplier: 1.0,
  fallbackStatus: GateStatus.SKIPPED
};

export class VelocityValidationGate {
  private config: VelocityGateConfig;
  private isRLControlled: boolean = false;
  private learningEnabled: boolean = true;

  constructor(config?: Partial<VelocityGateConfig>) {
    this.config = { ...DEFAULT_VELOCITY_CONFIG, ...config };
  }

  /**
   * Validate signal against velocity metrics
   * Returns gate result with multiplier (not confidence boost)
   */
  validate(
    velocityMetrics: {
      score: number; // 0-1
      alignment: number; // 0-1 (how aligned with regime)
      priceVelocity: number; // Price speed
      volumeVelocity: number; // Volume speed
    } | null,
    regime: 'BULL' | 'BEAR' | 'RANGING' = 'RANGING'
  ): ValidationGateResult {
    // Handle missing data gracefully
    if (!velocityMetrics) {
      return {
        status: this.config.fallbackStatus,
        multiplier: this.config.fallbackMultiplier,
        confidence: 0,
        reasoning: ['Unable to fetch velocity metrics - degraded mode'],
        raw_metrics: {}
      };
    }

    const { score, alignment } = velocityMetrics;
    const regime_threshold = this.config.regimeAlignment[regime] ?? 0.65;

    // ─────────────────────────────────────────────────────────────────────
    // GATE LOGIC: Binary APPROVED/REJECTED
    // ─────────────────────────────────────────────────────────────────────
    const velocity_ok = score >= this.config.minVelocityScore;
    const alignment_ok = alignment >= regime_threshold;

    let status: GateStatus;
    let multiplier: number;
    let gate_confidence: number;

    if (velocity_ok && alignment_ok) {
      // Strong approval
      status = GateStatus.APPROVED;
      multiplier = 1.5; // Full boost
      gate_confidence = 0.90;
    } else if (velocity_ok || alignment_ok) {
      // Partial approval
      status = GateStatus.APPROVED;
      multiplier = 1.25; // Half boost
      gate_confidence = 0.70;
    } else {
      // Rejection
      status = GateStatus.REJECTED;
      multiplier = 1.0; // No boost
      gate_confidence = 0.85;
    }

    return {
      status,
      multiplier,
      confidence: gate_confidence,
      reasoning: [
        `Velocity score: ${(score * 100).toFixed(0)}% ${velocity_ok ? '✓' : '✗'} (min: ${(this.config.minVelocityScore * 100).toFixed(0)}%)`,
        `Regime alignment (${regime}): ${(alignment * 100).toFixed(0)}% ${alignment_ok ? '✓' : '✗'} (min: ${(regime_threshold * 100).toFixed(0)}%)`,
        `Decision: ${status} → Position multiplier: ${multiplier.toFixed(2)}x`
      ],
      raw_metrics: velocityMetrics
    };
  }

  setRLControlled(isControlled: boolean): void {
    this.isRLControlled = isControlled;
  }

  getFeedback(): ValidationGateFeedback {
    return {
      gateId: 'velocity',
      isRLControlled: this.isRLControlled,
      learningEnabled: this.learningEnabled
    };
  }
}

// ============================================================================
// VALIDATION GATE SYSTEM (Orchestrator)
// ============================================================================

export interface ValidationGateSystemConfig {
  clusteringConfig?: Partial<ClusteringGateConfig>;
  velocityConfig?: Partial<VelocityGateConfig>;
  combinationMode: 'conservative' | 'moderate' | 'aggressive';
}

export interface ValidationGateSystemResult {
  gateResults: {
    clustering: ValidationGateResult;
    velocity: ValidationGateResult;
  };
  combinedMultiplier: number; // Final position size multiplier
  overallStatus: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  reasoning: string[];
}

export class ValidationGateSystem {
  private clustering: ClusteringValidationGate;
  private velocity: VelocityValidationGate;
  private config: ValidationGateSystemConfig;

  constructor(config?: Partial<ValidationGateSystemConfig>) {
    this.config = {
      clusteringConfig: {},
      velocityConfig: {},
      combinationMode: 'moderate',
      ...config
    };

    this.clustering = new ClusteringValidationGate(this.config.clusteringConfig);
    this.velocity = new VelocityValidationGate(this.config.velocityConfig);
  }

  /**
   * Run all gates and combine results
   */
  validate(
    clusterMetrics: any,
    velocityMetrics: any,
    regime: string = 'RANGING'
  ): ValidationGateSystemResult {
    const clustering_result = this.clustering.validate(clusterMetrics);
    const velocity_result = this.velocity.validate(velocityMetrics, regime as any);

    // ─────────────────────────────────────────────────────────────────────
    // COMBINE MULTIPLIERS BASED ON MODE
    // ─────────────────────────────────────────────────────────────────────
    let combined_multiplier: number;
    let overall_status: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';

    switch (this.config.combinationMode) {
      case 'conservative':
        // Both must approve
        if (clustering_result.status === GateStatus.APPROVED && velocity_result.status === GateStatus.APPROVED) {
          combined_multiplier = Math.min(clustering_result.multiplier, velocity_result.multiplier);
          overall_status = 'APPROVED';
        } else if (clustering_result.status !== GateStatus.REJECTED && velocity_result.status !== GateStatus.REJECTED) {
          combined_multiplier = 1.0; // Neutral if either skipped
          overall_status = 'CONDITIONAL';
        } else {
          combined_multiplier = 1.0;
          overall_status = 'REJECTED';
        }
        break;

      case 'moderate':
        // At least one approves
        if (clustering_result.status === GateStatus.APPROVED || velocity_result.status === GateStatus.APPROVED) {
          combined_multiplier = Math.min(
            1.0 + (clustering_result.multiplier - 1.0) * 0.5 + (velocity_result.multiplier - 1.0) * 0.5,
            2.0
          );
          overall_status = 'APPROVED';
        } else if (clustering_result.status !== GateStatus.REJECTED || velocity_result.status !== GateStatus.REJECTED) {
          combined_multiplier = 1.0;
          overall_status = 'CONDITIONAL';
        } else {
          combined_multiplier = 1.0;
          overall_status = 'REJECTED';
        }
        break;

      case 'aggressive':
        // Either approve → boost
        combined_multiplier = Math.max(clustering_result.multiplier, velocity_result.multiplier);
        if (clustering_result.status === GateStatus.APPROVED || velocity_result.status === GateStatus.APPROVED) {
          overall_status = 'APPROVED';
        } else if (clustering_result.status !== GateStatus.REJECTED || velocity_result.status !== GateStatus.REJECTED) {
          overall_status = 'CONDITIONAL';
        } else {
          overall_status = 'REJECTED';
        }
        break;

      default:
        combined_multiplier = 1.0;
        overall_status = 'CONDITIONAL';
    }

    // Clamp to reasonable bounds
    combined_multiplier = Math.max(0.5, Math.min(2.5, combined_multiplier));

    return {
      gateResults: {
        clustering: clustering_result,
        velocity: velocity_result
      },
      combinedMultiplier: combined_multiplier,
      overallStatus: overall_status,
      reasoning: [
        `Mode: ${this.config.combinationMode}`,
        `Clustering: ${clustering_result.status} (×${clustering_result.multiplier.toFixed(2)})`,
        `Velocity: ${velocity_result.status} (×${velocity_result.multiplier.toFixed(2)})`,
        `Combined multiplier: ×${combined_multiplier.toFixed(2)}`,
        `Overall: ${overall_status}`
      ]
    };
  }
}

// ============================================================================
// EXPORT FOR INTEGRATION
// ============================================================================

export const createValidationGateSystem = (mode: 'conservative' | 'moderate' | 'aggressive' = 'moderate') => {
  return new ValidationGateSystem({ combinationMode: mode });
};

export default ValidationGateSystem;
