/**
 * Convexity Policy
 *
 * Canonical rules for when Convexity positions are allowed to exit.
 * These predicates implement the philosophical constraints:
 *  - Convexity persists after VFMD exits
 *  - Convexity exits ONLY when persistence breaks (reversion works again,
 *    opposition volatility returns, or structure invalidates)
 */

import type { FailureOfReversionState } from '../../vfmd/failureOfReversionCalculator';

export type ConvexExitReason =
  | 'REVERSION_RESTORED'
  | 'OPPOSITION_VOLATILITY_RETURNED'
  | 'STRUCTURE_INVALIDATED'
  | 'NONE';

export const isReversionRestored = (
  prior: FailureOfReversionState | null,
  current: FailureOfReversionState
): { triggered: boolean; confidence: number; reason?: string } => {
  if (!prior) return { triggered: false, confidence: 0 };

  const decayBroke = prior.isDecaying && !current.isDecaying;
  const timeBroke = prior.timeCompressing && !current.timeCompressing;
  const depthBroke = prior.depthCompressing && !current.depthCompressing;
  const volatilityBroke = prior.volatilityParadox && !current.volatilityParadox;

  const breakCount = [decayBroke, timeBroke, depthBroke, volatilityBroke].filter(Boolean)
    .length;

  if (breakCount >= 2) {
    const reasons: string[] = [];
    if (decayBroke) reasons.push('reversion strength recovering');
    if (timeBroke) reasons.push('pullbacks slowing');
    if (depthBroke) reasons.push('pullbacks deepening');
    if (volatilityBroke) reasons.push('opposition awakening');

    return {
      triggered: true,
      confidence: Math.min(1, breakCount / 2),
      reason: `FoR broke: ${reasons.join(', ')}`
    };
  }

  return { triggered: false, confidence: 0 };
};

export const isOppositionVolatilityReturned = (
  priorOppositionWeakness: number,
  currentOppositionWeakness: number
): { triggered: boolean; spike?: number; confidence: number; reason?: string } => {
  const spike = priorOppositionWeakness / (currentOppositionWeakness + 1e-8);
  if (spike > 1.5 && currentOppositionWeakness < priorOppositionWeakness * 0.5) {
    return {
      triggered: true,
      spike,
      confidence: Math.min(1, (spike - 1.5) / 2),
      reason: `Opposition volatility returned (${spike.toFixed(2)}x spike)`
    };
  }
  return { triggered: false, spike: 0, confidence: 0 };
};

export const isStructureInvalidated = (
  entryPrice: number,
  currentPrice: number
): { triggered: boolean; confidence: number; reason?: string } => {
  const fromEntry = (currentPrice - entryPrice) / entryPrice;
  if (fromEntry < -0.05) {
    return {
      triggered: true,
      confidence: 0.6,
      reason: `Price fell below entry support (${(fromEntry * 100).toFixed(2)}%)`
    };
  }
  return { triggered: false, confidence: 0 };
};

export default {
  isReversionRestored,
  isOppositionVolatilityReturned,
  isStructureInvalidated
};
