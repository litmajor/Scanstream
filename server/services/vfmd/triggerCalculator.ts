/**
 * TRIGGER — Constraint Failure Dynamics
 * 
 * The missing physics layer that explains why PEG alone has low precision.
 * 
 * TRIGGER quantifies whether the market can still contain its stored energy,
 * answering: "Has the constraint system failed (or is it failing)?"
 * 
 * Key insight:
 * - PEG measures stored energy (potential)
 * - Regime measures market state (structure)
 * - TRIGGER measures constraint failure (permission)
 * 
 * Real volatility happens when: VOLATILITY ≈ PEG × TRIGGER
 */

import type { PhysicsMetrics } from './types';

/**
 * TRIGGER Components
 * Each represents a different axis of constraint failure
 */
export interface TriggerComponents {
  /** Liquidity Containment Failure: Can opposing liquidity still absorb flow? */
  liquidity: number; // [0, 1]

  /** Structural Boundary Breach: Are price constraints breaking? */
  structure: number; // [0, 1]

  /** Temporal Constraint Release: Has time unlocked movement? */
  temporal: number; // [0, 1]

  /** Control Fatigue: Has containment been exhausted? */
  fatigue: number; // [0, 1]
}

/**
 * TRIGGER State — full dynamics
 */
export interface TriggerState {
  /** Overall TRIGGER probability [0, 1] */
  trigger: number;

  /** Individual component scores */
  components: TriggerComponents;

  /** Confidence in trigger measurement */
  confidence: number;

  /** Interpretation of current constraint state */
  constraint_status: 'intact' | 'degrading' | 'failing' | 'collapsed';

  /** Timestamp when this was computed */
  timestamp: number;
}

/**
 * TRIGGER Calculator
 * 
 * Computes constraint failure probability from market metrics
 */
export class TriggerCalculator {
  /**
   * Compute TRIGGER state from physics metrics
   * 
   * Core equation (this is the law):
   * Market Motion Probability ∝ PEG × TRIGGER
   * 
   * Where:
   * - PEG ≥ 0 (stored potential energy)
   * - TRIGGER ∈ [0, 1] (constraint failure probability)
   * 
   * If TRIGGER = 0 → motion probability = 0, regardless of PEG
   * If TRIGGER ≈ 1 → stored energy is free to convert into motion
   */
  static computeTrigger(
    metrics: PhysicsMetrics,
    context?: {
      orderBookDepth?: number; // Recent average depth
      recentSpreadBps?: number; // Basis points
      volatilityTrend?: 'rising' | 'stable' | 'falling';
      levelTestCount?: number; // Times level tested recently
      sessionTime?: 'open' | 'midday' | 'close'; // Market session
      newsImpending?: boolean;
    }
  ): TriggerState {
    // Compute each constraint failure component
    const components: TriggerComponents = {
      liquidity: this.computeLiquidityFailure(metrics, context),
      structure: this.computeStructuralFailure(metrics, context),
      temporal: this.computeTemporalFailure(metrics, context),
      fatigue: this.computeFatigueFailure(metrics, context),
    };

    // Composite TRIGGER: One strong failure can activate, multiple weak failures accumulate
    // Formula: TRIGGER = 1 - ∏(1 - T_i)
    const trigger = 1 - 
      (1 - components.liquidity) *
      (1 - components.structure) *
      (1 - components.temporal) *
      (1 - components.fatigue);

    // Clamp to [0, 1]
    const clampedTrigger = Math.max(0, Math.min(1, trigger));

    // Determine constraint status
    const constraint_status = this.getConstraintStatus(clampedTrigger, components);

    return {
      trigger: clampedTrigger,
      components,
      confidence: this.calculateTriggerConfidence(metrics, context),
      constraint_status,
      timestamp: Date.now(),
    };
  }

  /**
   * TRIGGER Component A: Liquidity Containment Failure
   * 
   * Can opposing liquidity still absorb flow?
   * 
   * These are structural metrics of the order book, NOT motion proxies.
   * 
   * Pure liquidity signals:
   * - Depth collapse (fewer shares on both sides)
   * - Spread expansion (distance between bid/ask increasing)
   * - Failed absorption at key levels (price repels from depth)
   */
  private static computeLiquidityFailure(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // LIQUIDITY SIGNAL 1: Depth collapse (direct measurement)
    if (context?.orderBookDepth !== undefined) {
      if (context.orderBookDepth < 1000) {
        return 0.7; // Severe depth collapse = liquidity failure
      }
      if (context.orderBookDepth < 2500) {
        return 0.4; // Moderate depth reduction
      }
    }
    
    // LIQUIDITY SIGNAL 2: Spread expansion (direct measurement)
    if (context?.recentSpreadBps !== undefined) {
      if (context.recentSpreadBps > 5) {
        return 0.6; // Wide spread = liquidity drying up
      }
      if (context.recentSpreadBps > 2) {
        return 0.3; // Moderate spread widening
      }
    }

    // LIQUIDITY SIGNAL 3: If we have no order book data, return baseline
    // Do NOT use turbulence or other volatility proxies here
    return 0.1; // Baseline: assume reasonable liquidity without data
  }

  /**
   * TRIGGER Component B: Structural Boundary Breach
   * 
   * Are price constraints breaking?
   * 
   * This measures STRUCTURAL INTEGRITY, not motion.
   * 
   * Pure constraint signals:
   * - Extreme divergence (gradient breaking coherence = boundary stress)
   * - Low recentCurl with high dominantAngle (fixed direction trying to bend)
   * - Field becoming linearly oriented (losing rotational complexity = structure failing)
   */
  private static computeStructuralFailure(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // ORTHOGONAL SIGNAL 1: Gradient vs Coherence Mismatch
    // High gradient but low coherence = strong containment effort but failing
    // This is the sign of boundary stress, not motion itself
    const gradientCoherenceMismatch = 
      (metrics.gradientMagnitude / 200) * (1 - metrics.coherenceScore);
    
    if (gradientCoherenceMismatch > 0.4) {
      return 0.6; // Boundary is under stress
    }

    // ORTHOGONAL SIGNAL 2: Extreme Divergence
    // Very high positive divergence = gradient trying to overcome coherence
    // This is structural pressure, not velocity
    if (Math.abs(metrics.divergenceScore) > 0.8) {
      return 0.5; // Structural pressure building
    }

    // ORTHOGONAL SIGNAL 3: Field becoming linearly aligned
    // dominantAngle concentration = vector field losing complexity = structure constraining flow
    // When it breaks, it releases suddenly
    if (metrics.dominantAngle > 0.9) {
      return 0.4; // Linear alignment under stress = constraint integrity degraded
    }

    // ORTHOGONAL SIGNAL 4: Recent divergence accumulation
    // recentDivergence trending high = structure is being stressed over time
    if (metrics.recentDivergence > 0.6) {
      return 0.3; // Cumulative structural stress
    }

    return 0.05; // Clean structural integrity
  }

  /**
   * TRIGGER Component C: Temporal Constraint Release
   * 
   * Has time unlocked movement?
   * 
   * These are calendar/clock constraints, NOT volatility proxies.
   * 
   * Pure temporal signals:
   * - Session boundaries (funding opens/closes movement windows)
   * - Macro event windows
   * - Time-of-day patterns
   */
  private static computeTemporalFailure(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // TEMPORAL SIGNAL 1: Session transitions
    // Market opens/closes have natural volatility windows
    if (context?.sessionTime === 'open' || context?.sessionTime === 'close') {
      return 0.4; // Calendar event = time constraint releasing
    }

    // TEMPORAL SIGNAL 2: Macro news/events
    if (context?.newsImpending) {
      return 0.6; // News removes time-based containment
    }

    // TEMPORAL SIGNAL 3: Nothing else — don't use volatility metrics here
    // Return baseline if no calendar constraints detected
    return 0.05; // No temporal triggers
  }

  /**
   * TRIGGER Component D: Control Fatigue
   * 
   * Has containment been exhausted?
   * 
   * This measures the EFFORT to hold a constraint, not the result.
   * 
   * Pure fatigue signals:
   * - Repeated rejection tests at a level (increasing defense attempts)
   * - Gradient magnitude increasing (pushing harder to contain)
   * - Curl increasing but failing to rotate (spinning wheels = containment exhaustion)
   */
  private static computeFatigueFailure(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // FATIGUE SIGNAL 1: Repeated level tests
    // Each test represents a containment attempt; exhaustion comes from repetition
    if (context?.levelTestCount !== undefined) {
      const testFatigue = Math.min(1, context.levelTestCount / 5); // 5+ tests = exhausted
      if (testFatigue > 0.6) {
        return 0.7; // Containment exhausted from repeated attempts
      }
      return testFatigue * 0.5; // Scale linearly with test count
    }

    // FATIGUE SIGNAL 2: High gradient with low curl (pushing hard but not rotating)
    // This is defensive desperation: forcing price to stay aligned
    const gradientPushWithoutRotation = 
      (metrics.gradientMagnitude / 200) * (1 - metrics.curlScore);
    
    if (gradientPushWithoutRotation > 0.6) {
      return 0.5; // Containment exhaustion: pushing hard, failing to contain rotation
    }

    // FATIGUE SIGNAL 3: Very high recentCurl in fixed direction (constraint spinning wheels)
    // Extreme curl that isn't changing the dominant angle = fatigue
    if (metrics.recentCurl > 0.8 && metrics.dominantAngle > 0.8) {
      return 0.4; // Rotation attempting but contained = system fatigue
    }

    return 0.05; // Containment fresh and capable
  }

  /**
   * Determine constraint status from TRIGGER and components
   */
  private static getConstraintStatus(
    trigger: number,
    components: TriggerComponents
  ): 'intact' | 'degrading' | 'failing' | 'collapsed' {
    if (trigger > 0.7) {
      return 'collapsed'; // Constraints have failed
    }
    if (trigger > 0.5) {
      return 'failing'; // Active failure in progress
    }
    if (trigger > 0.25) {
      return 'degrading'; // Integrity compromised
    }
    return 'intact'; // Constraints holding
  }

  /**
   * Calculate confidence in TRIGGER measurement
   */
  private static calculateTriggerConfidence(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    let confidence = 0.6; // Baseline confidence

    // More confidence with better data
    if (context?.orderBookDepth !== undefined) {
      confidence += 0.2; // Real order book data improves confidence
    }

    if (context?.levelTestCount !== undefined) {
      confidence += 0.1; // Fatigue data adds confidence
    }

    // Less confidence in highly turbulent conditions
    if (metrics.turbulenceIndex > 2.0) {
      confidence -= 0.2; // Can't trust anything in chaos
    }

    return Math.max(0.3, Math.min(1, confidence));
  }

  /**
   * The Master Equation: Real Volatility Probability
   * 
   * This is what was missing from the physics model.
   * 
   * VOLATILITY_PROBABILITY ≈ PEG × TRIGGER
   * 
   * Where:
   * - PEG ∈ [energy available]
   * - TRIGGER ∈ [permission to release]
   * 
   * Result:
   * - High PEG + Low TRIGGER → Energy stays latent (compression)
   * - Low PEG + High TRIGGER → False breakout (weak move)
   * - High PEG + High TRIGGER → Real volatility (the move)
   */
  static getVolatilityProbability(peg: number, trigger: number): number {
    // Normalize PEG to comparable scale [0, 1]
    // Using approximate P50=863 as baseline
    const normalizedPeg = Math.min(1, peg / 2000);
    
    return normalizedPeg * trigger;
  }

  /**
   * Diagnostic table showing all constraint states
   */
  static diagnoseConstraints(
    metrics: PhysicsMetrics,
    context?: any
  ): object {
    const trigger = this.computeTrigger(metrics, context);

    return {
      timestamp: new Date(trigger.timestamp).toISOString(),
      
      // Energy Layer
      peg: metrics.peg,
      
      // Permission Layer
      trigger: {
        overall: trigger.trigger.toFixed(3),
        liquidity: trigger.components.liquidity.toFixed(3),
        structure: trigger.components.structure.toFixed(3),
        temporal: trigger.components.temporal.toFixed(3),
        fatigue: trigger.components.fatigue.toFixed(3),
        confidence: trigger.confidence.toFixed(2),
      },
      
      // Constraint Status
      constraint_status: trigger.constraint_status,
      
      // Real Volatility Probability
      volatility_probability: this.getVolatilityProbability(
        metrics.peg,
        trigger.trigger
      ).toFixed(3),
      
      // Interpretation
      interpretation: this.interpretConstraintState(trigger, metrics),
    };
  }

  /**
   * Human-readable interpretation
   */
  private static interpretConstraintState(trigger: TriggerState, metrics: PhysicsMetrics): string {
    const vol = this.getVolatilityProbability(metrics.peg, trigger.trigger);

    if (vol > 0.6) {
      return `✅ HIGH VOLATILITY PROBABILITY: Energy exists (PEG=${metrics.peg.toFixed(0)}) ` +
             `and constraints are failing (TRIGGER=${trigger.trigger.toFixed(2)}). ` +
             `Real motion likely soon.`;
    }

    if (metrics.peg > 1000 && trigger.trigger < 0.2) {
      return `⚠️  COMPRESSION PHASE: High stored energy (PEG=${metrics.peg.toFixed(0)}) ` +
             `but constraints intact (TRIGGER=${trigger.trigger.toFixed(2)}). ` +
             `Waiting for ${trigger.components.fatigue > 0.3 ? 'fatigue buildup' : 'trigger event'}.`;
    }

    if (trigger.trigger > 0.5 && metrics.peg < 500) {
      return `❌ FALSE BREAKOUT RISK: Constraints failing (TRIGGER=${trigger.trigger.toFixed(2)}) ` +
             `but low energy (PEG=${metrics.peg.toFixed(0)}). ` +
             `Move will be weak/short-lived.`;
    }

    return `⏸️  CONSOLIDATION: Balanced market with low volatility probability (${vol.toFixed(2)}). ` +
           `Monitor for constraint changes.`;
  }
}

export default TriggerCalculator;
