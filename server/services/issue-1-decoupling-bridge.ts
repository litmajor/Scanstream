/**
 * Issue #1 Decoupling Bridge - Position Sizing Fix
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * PROBLEM:
 * - Clustering gate adds +0.08 to confidence
 * - Velocity gate adds +0.05 to confidence
 * - Total inflation: 0.796 → 0.936 (+16%)
 * - Position size: baseSize * (0.1 + confidence * 0.4)
 * - Result: 20% larger positions than intended
 * 
 * SOLUTION:
 * - Keep confidence pure (0.796, from 3-source voting)
 * - Apply gates as MULTIPLIERS only (1.0x to 2.5x)
 * - Position sizing: baseSize * multiplier (not baseSize + boost)
 */

import type { MarketFrame } from '@shared/schema';
import { ValidationGateSystem, type ValidationGateSystemResult, GateStatus } from './validation-gate-system';

export interface DecoupledPositionSizingResult {
  // Original confidence (unchanged from 3-source voting)
  originalConfidence: number;
  
  // Base position size (no inflation)
  basePositionSize: number;
  
  // Gate validation results
  gateMultiplier: number;
  overallStatus: 'APPROVED' | 'CONDITIONAL' | 'REJECTED';
  
  // Final corrected position size
  finalPositionSize: number;
  
  // Audit trail
  reasoning: string[];
  warnings: string[];
}

/**
 * Apply decoupled validation gates to position sizing
 * 
 * USAGE:
 * ```
 * const decoupled = await applyDecoupledPositionSizing(
 *   finalConfidence,
 *   frames,
 *   regime
 * );
 * const positionSize = decoupled.finalPositionSize;
 * ```
 */
export async function applyDecoupledPositionSizing(
  finalConfidence: number,
  frames: MarketFrame[],
  regime: any
): Promise<DecoupledPositionSizingResult> {
  const reasoning: string[] = [];
  const warnings: string[] = [];

  // ─────────────────────────────────────────────────────────────────────
  // STEP 1: Calculate base position size (no inflation)
  // ─────────────────────────────────────────────────────────────────────
  const basePositionSize = Math.min(0.5, 0.1 + finalConfidence * 0.4);
  reasoning.push(`Base position: 0.1 + (${(finalConfidence * 100).toFixed(1)}% × 0.40) = ${(basePositionSize * 100).toFixed(1)}%`);

  // ─────────────────────────────────────────────────────────────────────
  // STEP 2: Apply validation gates as multipliers
  // ─────────────────────────────────────────────────────────────────────
  const gateSystem = new ValidationGateSystem();
  
  // Extract metrics from latest frame
  const latestFrame = frames[frames.length - 1];
  const clusterMetrics = (latestFrame.indicators as any)?.clusterMetrics || null;
  const velocityMetrics = (latestFrame.indicators as any)?.velocityMetrics || null;
  const regimeType = regime?.type || 'RANGING';

  const gateResults = gateSystem.validate(clusterMetrics, velocityMetrics, regimeType);
  
  reasoning.push(`Clustering gate: ${gateResults.gateResults.clustering.status} (${gateResults.gateResults.clustering.multiplier.toFixed(2)}x)`);
  reasoning.push(`Velocity gate: ${gateResults.gateResults.velocity.status} (${gateResults.gateResults.velocity.multiplier.toFixed(2)}x)`);
  reasoning.push(`Combined multiplier: ${gateResults.combinedMultiplier.toFixed(2)}x`);

  // ─────────────────────────────────────────────────────────────────────
  // STEP 3: Calculate final position size
  // ─────────────────────────────────────────────────────────────────────
  const finalPositionSize = Math.min(0.5, Math.max(0.05, basePositionSize * gateResults.combinedMultiplier));
  reasoning.push(`Final position: ${(basePositionSize * 100).toFixed(1)}% × ${gateResults.combinedMultiplier.toFixed(2)}x = ${(finalPositionSize * 100).toFixed(1)}%`);

  // ─────────────────────────────────────────────────────────────────────
  // STEP 4: Safety checks
  // ─────────────────────────────────────────────────────────────────────
  if (gateResults.gateResults.clustering.status === 'REJECTED' && gateResults.gateResults.velocity.status === 'REJECTED') {
    warnings.push('Both gates REJECTED - position held at minimum');
  }

  if (gateResults.combinedMultiplier > 2.0) {
    warnings.push(`Gate multiplier ${gateResults.combinedMultiplier.toFixed(2)}x exceeds 2.0x - check gate metrics`);
  }

  if (clusterMetrics === null && velocityMetrics === null) {
    warnings.push('No gate metrics available - using base position size');
  }

  return {
    originalConfidence: finalConfidence,
    basePositionSize,
    gateMultiplier: gateResults.combinedMultiplier,
    overallStatus: gateResults.overallStatus,
    finalPositionSize,
    reasoning,
    warnings
  };
}
