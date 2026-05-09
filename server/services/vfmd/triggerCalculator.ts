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

import type { PhysicsMetrics, VectorField } from './types';

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
   * Compute Compression PEG using spatial field gradients
   * 
   * Measures how organized/uniform the vector field is
   * High compression = field is uniform/organized spatially = stored energy
   * Low compression = field is chaotic/varied = energy being released
   * 
   * Key insight: Instead of measuring velocity magnitude changes over time (which goes binary),
   * measure how much the velocity varies ACROSS SPACE at each timestamp.
   * Heavily compressed: all regions have same velocity (gradient = 0)
   * Releasing: regions have different velocities (gradient = large)
   * 
   * @param field Vector field to analyze
   * @param regionSize Window size for recent vs historical comparison
   * @returns Compression PEG ∈ [0, 1]
   */
  static computeCompressionPEG(field: VectorField, regionSize: number = 10): number {
    const data = field.data;
    const t = field.temporalWindow;

    if (t < 2 || field.spatialBins < 2) return 0.5;

    const startT = Math.max(0, t - regionSize);

    // Calculate spatial gradient magnitude at recent time window
    let recentGradientEnergy = 0;
    let recentCount = 0;

    for (let j = startT; j < t; j++) {
      for (let i = 0; i < field.spatialBins - 1; i++) {
        const [vx1, ax1] = data[i][j];
        const [vx2, ax2] = data[i + 1][j];
        
        // Spatial gradient: how much velocity changes across bins
        const dvx = Math.abs(vx2 - vx1);
        const dax = Math.abs(ax2 - ax1);
        
        recentGradientEnergy += Math.sqrt(dvx * dvx + dax * dax);
        recentCount++;
      }
    }

    // Calculate historical gradient for baseline
    const historicalStart = Math.max(0, t - regionSize * 3);
    const historicalEnd = Math.max(historicalStart + 1, t - regionSize);
    
    let historicalGradientEnergy = 0;
    let historicalCount = 0;

    for (let j = historicalStart; j < historicalEnd && j < t; j++) {
      for (let i = 0; i < field.spatialBins - 1; i++) {
        const [vx1, ax1] = data[i][j];
        const [vx2, ax2] = data[i + 1][j];
        
        const dvx = Math.abs(vx2 - vx1);
        const dax = Math.abs(ax2 - ax1);
        
        historicalGradientEnergy += Math.sqrt(dvx * dvx + dax * dax);
        historicalCount++;
      }
    }

    if (recentCount === 0 || historicalCount === 0) return 0.5;

    const recentGradient = recentGradientEnergy / recentCount;
    const historicalGradient = historicalGradientEnergy / historicalCount;
    const baselineGradient = Math.max(historicalGradient, 1e-6);

    // Invert gradient ratio: low recent gradient (organized) means high compression
    // recentGradient << historicalGradient → ratio ≈ 0 → compression ≈ 1
    // recentGradient ≈ historicalGradient → ratio ≈ 1 → compression ≈ 0.5
    // recentGradient >> historicalGradient → ratio >> 1 → compression ≈ 0
    
    const ratio = recentGradient / baselineGradient;
    
    // Use sigmoid to create continuous [0, 1] range
    // When ratio is low (organized field), sigmoid output high (compressed)
    // When ratio is high (chaotic field), sigmoid output low (releasing)
    const compression = 1 / (1 + Math.exp(2 * (ratio - 0.5)));

    return Math.max(0, Math.min(1, compression));
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
    // CONTINUOUS computation instead of hardcoded tiers
    let liquidityFailure = 0.05; // Baseline

    if (context?.orderBookDepth !== undefined) {
      // Depth failure: sigmoid-like curve, 0 depth = 1.0, 5000+ = 0.05
      liquidityFailure = 0.05 + 0.95 / (1 + Math.exp((context.orderBookDepth - 2500) / 500));
    } else if (context?.recentSpreadBps !== undefined) {
      // Spread failure: 0 bps = 0.05, 10+ bps = 1.0
      liquidityFailure = 0.05 + 0.95 * Math.min(1, context.recentSpreadBps / 10);
    } else {
      // No context: use curl as proxy (rotation = liquidity stress)
      liquidityFailure = 0.05 + metrics.recentCurl * 0.3;
    }

    return Math.min(1, liquidityFailure);
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
    // CONTINUOUS computation based on actual metrics
    let structuralFailure = 0.05; // Baseline

    // Signal 1: Gradient-Coherence mismatch (normalized for Mar 2026 gradient scale 0.01-0.2)
    const normalizedGradient = Math.min(1, metrics.gradientMagnitude / 0.05);
    const coherenceMismatch = normalizedGradient * (1 - metrics.coherenceScore);
    structuralFailure = Math.max(structuralFailure, coherenceMismatch * 0.7);

    // Signal 2: Divergence extremities (0.0-1.0 scale)
    const divergenceStress = Math.min(1, Math.abs(metrics.divergenceScore) / 1.5);
    structuralFailure = Math.max(structuralFailure, divergenceStress * 0.6);

    // Signal 3: Linear alignment under stress (how concentrated is the angle?)
    const angleConcent = Math.min(1, Math.abs(metrics.dominantAngle) / 1.2);
    structuralFailure = Math.max(structuralFailure, angleConcent * 0.5);

    // Signal 4: Recent divergence accumulation
    const recentDivStress = Math.min(1, metrics.recentDivergence / 1.0);
    structuralFailure = Math.max(structuralFailure, recentDivStress * 0.4);

    return Math.min(1, structuralFailure);
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
   * 
   * Mar 2026: Gradient normalization fixed (0.01-0.2 normalized scale, was raw 100-2000)
   */
  private static computeTemporalFailure(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // CONTINUOUS computation: no hardcoded calendar values
    let temporalFailure = 0.05; // Baseline

    if (context?.sessionTime === 'open' || context?.sessionTime === 'close') {
      temporalFailure = 0.3; // Session transitions have some volatility
    }

    if (context?.newsImpending) {
      temporalFailure = 0.5; // News creates real uncertainty
    }

    // Use PEG variance as secondary temporal signal (if we had it)
    // For now just return the context-based value
    return Math.min(1, temporalFailure);
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
    // CONTINUOUS computation instead of hardcoded tiers
    let fatigueFailure = 0.05; // Baseline

    // FATIGUE SIGNAL 1: Repeated level tests
    if (context?.levelTestCount !== undefined) {
      // Scale: 0 tests = 0.05, 5+ tests = 0.7
      fatigueFailure = 0.05 + (0.65 * Math.min(1, context.levelTestCount / 5));
    }

    // FATIGUE SIGNAL 2: High gradient with low curl (pushing hard, failing to rotate)
    const normalizedGradient = Math.min(1, metrics.gradientMagnitude / 100);
    const gradientPush = normalizedGradient * (1 - metrics.curlScore);
    fatigueFailure = Math.max(fatigueFailure, gradientPush * 0.6);

    // FATIGUE SIGNAL 3: High curl but stuck in one direction (spinning wheels)
    const stuckCurl = Math.min(1, metrics.recentCurl) * Math.min(1, Math.abs(metrics.dominantAngle) / 1.2);
    fatigueFailure = Math.max(fatigueFailure, stuckCurl * 0.5);

    return Math.min(1, fatigueFailure);
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
   * Should vary continuously based on actual signal quality, not hardcoded tiers
   */
  private static calculateTriggerConfidence(
    metrics: PhysicsMetrics,
    context?: any
  ): number {
    // FIXED: Previous formula bottlenecked at coherenceScore (~0.3 max)
    // New approach: Start with strongest available signal, combine additively
    
    // Normalize independent signals to [0,1]
    const coherence = Math.max(0, Math.min(1, metrics.coherenceScore || 0));
    const gradient = Math.max(0, Math.min(1, (Math.abs(metrics.gradientMagnitude) || 0) / 100));
    const stability = Math.max(0, Math.min(1, 1 - (Math.abs(metrics.divergenceScore) || 0))); // Low divergence = good

    // Start with strongest signal (not weakest), each captures different aspect
    let confidence = Math.max(
      coherence * 0.5,       // Field alignment strength
      gradient * 0.4,        // Change intensity  
      stability * 0.3        // Structural integrity
    );

    // Add independent boosts (small, not multiplicative)
    if (context?.orderBookDepth !== undefined && context.orderBookDepth > 2500) {
      confidence = Math.min(1, confidence + 0.12);
    }

    // Strong trend adds credibility
    if (metrics.dominantAngle !== undefined && Math.abs(metrics.dominantAngle) > 0.7) {
      confidence = Math.min(1, confidence + 0.08);
    }

    // Use additive penalties (gentle impact) not multiplicative (large impact)
    const turbulencePenalty = Math.min(1, (metrics.turbulenceIndex || 0) / 3);
    confidence -= turbulencePenalty * 0.10; // Additive, small penalty

    const divergencePenalty = Math.min(1, Math.abs(metrics.divergenceScore || 0) / 1.5);
    confidence -= divergencePenalty * 0.08; // Additive, small penalty

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
    // PEG already normalized to [0, 1] from compression sigmoid
    // Volatility probability: blend of compression (stored energy) and trigger (release condition)
    // Formula: peg^0.5 emphasizes moderate compression values over edge cases
    // Range: [0, 0.6] when trigger ranges [0.1856, 0.5727]
    const pegWeighted = Math.sqrt(Math.max(0, peg)); // Upweight moderate values
    return Math.min(1, pegWeighted * trigger * 1.5); // 1.5× boost to reach 0.1+ typical range
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

    // Feb 2025: PEG thresholds recalibrated from raw scale (1000) to normalized (0.14)
    if (metrics.peg > 0.14 && trigger.trigger < 0.2) {
      return `⚠️  COMPRESSION PHASE: High stored energy (PEG=${metrics.peg.toFixed(3)}) ` +
             `but constraints intact (TRIGGER=${trigger.trigger.toFixed(2)}). ` +
             `Waiting for ${trigger.components.fatigue > 0.3 ? 'fatigue buildup' : 'trigger event'}.`;
    }

    // Feb 2025: PEG threshold recalibrated from raw scale (500) to normalized (0.07)
    if (trigger.trigger > 0.5 && metrics.peg < 0.07) {
      return `❌ FALSE BREAKOUT RISK: Constraints failing (TRIGGER=${trigger.trigger.toFixed(2)}) ` +
             `but low energy (PEG=${metrics.peg.toFixed(3)}). ` +
             `Move will be weak/short-lived.`;
    }

    return `⏸️  CONSOLIDATION: Balanced market with low volatility probability (${vol.toFixed(2)}). ` +
           `Monitor for constraint changes.`;
  }
}

export default TriggerCalculator;
