/**
 * VFMD Physics Calculator - TypeScript Port
 * Computes PEG (Potential Energy Gradient), TI (Turbulence Index), and Coherence
 */

import type { VectorField, PhysicsMetrics } from './types';
import { FieldAnalyzer } from './fieldConstructor';

export class PhysicsCalculator {
  /**
   * Compute Potential Energy Gradient (PEG)
   *
   * Measures stored energy before directional release
   * PEG = ∫|∇F| dA over recent region
   *
   * @param field Vector field
   * @param regionSize How many recent bars to integrate over
   * @returns PEG value (higher = more energy accumulated)
   */
  static computePEG(field: VectorField, regionSize: number = 10): number {
    const gradientMag = FieldAnalyzer.computeGradientMagnitude(field);

    // Integrate over recent temporal region
    const recentRegion = gradientMag.map(spatial =>
      spatial.slice(Math.max(0, field.temporalWindow - regionSize))
    );

    let sum = 0;
    for (const spatial of recentRegion) {
      sum += spatial.reduce((a, b) => a + b, 0);
    }

    // Normalize by region size
    const peg = sum / regionSize;
    return peg;
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

    return ti;
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
}
