/**
 * VFMD Physics Calculator - TypeScript Port
 * Computes PEG (Potential Energy Gradient), TI (Turbulence Index), and Coherence
 */

import type { VectorField, PhysicsMetrics } from './types';
import { FieldAnalyzer } from './fieldConstructor';
import TriggerCalculator from './triggerCalculator';

export class PhysicsCalculator {
  /**
   * Compute Potential Energy Gradient (PEG)
   * Delegates to centralized TriggerCalculator.computeCompressionPEG for consistency
   * @param field Vector field
   * @param regionSize How many recent bars to integrate over
   * @returns PEG value, range [0, 1]
   */
  static computePEG(field: VectorField, regionSize: number = 10): number {
    return TriggerCalculator.computeCompressionPEG(field, regionSize);
  }

  /**
   * Compute Turbulence Index (TI)
   *
   * Measures chaotic instability in flow
   * TI = Var(local vector angles) / Mean(directional coherence)
   *
   * @param field Vector field
   * @param localWindow Recent bars to analyze
   * @returns TI value (higher = more turbulent/chaotic)
   */
  static computeTurbulenceIndex(
    field: VectorField,
    localWindow: number = 10
  ): number {
    const data = field.data;
    const startT = Math.max(0, field.temporalWindow - localWindow);

    // Collect angles and magnitudes from recent region
    const angles: number[] = [];
    const magnitudes: number[] = [];

    for (let i = 0; i < field.spatialBins; i++) {
      for (let j = startT; j < field.temporalWindow; j++) {
        const [fx, fy] = data[i][j];
        const angle = Math.atan2(fy, fx);
        const magnitude = Math.sqrt(fx * fx + fy * fy);

        angles.push(angle);
        magnitudes.push(magnitude);
      }
    }

    if (angles.length === 0) return 0;

    // Variance of angles (how inconsistent are directions?)
    const meanAngle =
      angles.reduce((a, b) => a + b, 0) / angles.length;
    const angleVariance =
      angles.reduce((sum, a) => sum + Math.pow(a - meanAngle, 2), 0) /
      angles.length;

    // Mean magnitude
    const meanMagnitude =
      magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;

    // Guard: pure flat market (zero magnitude) → zero turbulence
    if (meanMagnitude < 1e-8) return 0;

    // Directional coherence: how aligned are vectors?
    let meanVectorX = 0;
    let meanVectorY = 0;
    for (let i = 0; i < field.spatialBins; i++) {
      for (let j = startT; j < field.temporalWindow; j++) {
        const [fx, fy] = data[i][j];
        meanVectorX += fx;
        meanVectorY += fy;
      }
    }

    const count = field.spatialBins * (field.temporalWindow - startT);
    meanVectorX /= count;
    meanVectorY /= count;

    const coherence =
      Math.sqrt(meanVectorX * meanVectorX + meanVectorY * meanVectorY) /
      (meanMagnitude + 1e-8);

    // TI = chaos / alignment
    const ti = angleVariance / (coherence + 1e-8);

    // Cap TI at 10.0 — extreme TI values (587+) are measurement artifacts
    // preventing incorrect turbulent-regime classification
    return Math.min(10.0, Math.max(0, ti));
  }

  /**
   * Compute Directional Coherence
   *
   * How strongly field points in consistent direction
   *
   * @param field Vector field
   * @param window Recent bars
   * @returns [coherenceScore, dominantAngle]
   */
  static computeCoherence(
    field: VectorField,
    window: number = 10
  ): [number, number] {
    const data = field.data;
    const startT = Math.max(0, field.temporalWindow - window);

    // Calculate mean vector
    let meanX = 0;
    let meanY = 0;
    let maxMagnitude = 0;

    for (let i = 0; i < field.spatialBins; i++) {
      for (let j = startT; j < field.temporalWindow; j++) {
        const [fx, fy] = data[i][j];
        meanX += fx;
        meanY += fy;

        const mag = Math.sqrt(fx * fx + fy * fy);
        maxMagnitude = Math.max(maxMagnitude, mag);
      }
    }

    const count = field.spatialBins * (field.temporalWindow - startT);
    meanX /= count;
    meanY /= count;

    const coherence = Math.sqrt(meanX * meanX + meanY * meanY);
    const coherenceNormalized = coherence / (maxMagnitude + 1e-8);

    const angle = Math.atan2(meanY, meanX);

    return [
      Math.min(1, Math.max(0, coherenceNormalized)),
      angle
    ];
  }

  /**
   * Compute all physics metrics at once
   */
  static computeAllMetrics(field: VectorField): PhysicsMetrics {
    const peg = this.computePEG(field);
    const ti = this.computeTurbulenceIndex(field);
    const [coherence, angle] = this.computeCoherence(field);

    const divergence = FieldAnalyzer.computeDivergence(field);
    const curl = FieldAnalyzer.computeCurl(field);

    // Recent statistics (last 10 bars)
    const startT = Math.max(0, field.temporalWindow - 10);

    let recentDivSum = 0;
    let recentCurlSum = 0;
    let count = 0;

    for (let i = 0; i < field.spatialBins; i++) {
      for (let j = startT; j < field.temporalWindow; j++) {
        recentDivSum += divergence[i][j];
        recentCurlSum += Math.abs(curl[i][j]);
        count++;
      }
    }

    const recentDiv = recentDivSum / (count || 1);
    const recentCurl = recentCurlSum / (count || 1);

    // Overall gradient magnitude
    const gradMag = FieldAnalyzer.computeGradientMagnitude(field);
    let maxGrad = 0;
    for (const row of gradMag) {
      for (const val of row) {
        maxGrad = Math.max(maxGrad, val);
      }
    }

    return {
      peg: Math.max(0, peg),
      turbulenceIndex: Math.max(0, ti),
      coherenceScore: coherence,
      dominantAngle: angle,
      divergenceScore: recentDiv,
      recentDivergence: recentDiv,
      curlScore: recentCurl,
      recentCurl,
      gradientMagnitude: maxGrad
    };
  }

  /**
   * Compute PEG derivatives for three-tier signal quality gating
   * 
   * Returns physics-based signal quality tier:
   * EXPLOSIVE:  PEG > 0.70× threshold AND ΔPEG > 0.03 AND Δ²PEG > 0
   *            → True breakout onset (pressure present, building, accelerating)
   *            → Position multiplier: 1.3x (highest conviction)
   * 
   * BUILDING:   PEG > 0.85× threshold AND ΔPEG > 0.03
   *            → Good entries (compression above floor, still accumulating)
   *            → Position multiplier: 1.1x (high conviction)
   * 
   * BASE:       PEG > threshold AND isBuilding = false
   *            → Current system default (still valid but lower conviction)
   *            → Position multiplier: 0.6x (reduced for spent energy)
   * 
   * @param pegHistory Rolling buffer of recent PEG values (needs ≥3 points)
   * @param pegThreshold Current regime's PEG threshold for signal gating
   * @returns { tier, multiplier, deltaPeg, delta2Peg, isBuilding, isExplosive }
   */
  static computePEGDerivatives(
    pegHistory: number[],
    pegThreshold: number = 0.20
  ): {
    tier: 'EXPLOSIVE' | 'BUILDING' | 'BASE';
    multiplier: number;
    deltaPeg: number;
    delta2Peg: number;
    pegMomentum: number;
    isBuilding: boolean;
    isExplosive: boolean;
  } {
    // Need at least 3 points for first and second derivatives
    if (pegHistory.length < 3) {
      return {
        tier: 'BASE',
        multiplier: 0.6,
        deltaPeg: 0,
        delta2Peg: 0,
        pegMomentum: 0,
        isBuilding: false,
        isExplosive: false
      };
    }

    // Use last 5 points for noise tolerance, EMA-smooth if available
    const recent = pegHistory.slice(-5);
    
    // First derivative: ΔPEG (jerk — is acceleration changing?)
    // Use last 3 points for stability
    const peg2 = recent[recent.length - 2];
    const peg1 = recent[recent.length - 1];
    const peg0 = recent[recent.length - 3];
    
    const deltaPeg = peg1 - peg0;  // First derivative (momentum)
    
    // Second derivative: Δ²PEG (snap — is jerk accelerating?)
    // Needs 3 consecutive deltas
    const delta2Peg = (peg1 - peg2) - (peg2 - peg0);

    // Combined momentum scalar: sign(ΔPEG) × √|ΔPEG|
    const pegMomentum = Math.sign(deltaPeg) * Math.sqrt(Math.abs(deltaPeg));

    // Current PEG (last value)
    const currentPeg = peg1;
    const pegNorm = currentPeg / Math.max(pegThreshold, 0.01); // Normalize to threshold

    // Gate thresholds
    const isExplosive = 
      pegNorm > 0.70 &&          // PEG > 70% of threshold
      deltaPeg > 0.03 &&         // Strong upward momentum
      delta2Peg > 0;             // Acceleration is positive

    const isBuilding = 
      !isExplosive &&
      pegNorm > 0.85 &&          // PEG > 85% of threshold
      deltaPeg > 0.03;           // Building momentum

    const tier = isExplosive ? 'EXPLOSIVE' : isBuilding ? 'BUILDING' : 'BASE';
    const multiplier = isExplosive ? 1.3 : isBuilding ? 1.1 : 0.6;

    return {
      tier,
      multiplier,
      deltaPeg,
      delta2Peg,
      pegMomentum,
      isBuilding,
      isExplosive
    };
  }
}
