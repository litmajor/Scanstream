/**
 * RISK APPROVAL ENGINE
 * 
 * Where most signals die. That's the job.
 * 
 * Checks:
 * - Time authority (mode, not REPLAY)
 * - Confidence thresholds
 * - Exposure (notional USD)
 * - Drawdown state
 * - Rate limits (cooldown)
 * - Kill switches
 * 
 * Risk NEVER prices.
 * Risk NEVER executes.
 * Risk ONLY vetoes.
 * 
 * This is Stage 2 of the execution pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SignalIntent,
  RiskApproval,
  EXECUTION_COMPARTMENT_CONSTANTS,
} from '../../types/ExecutionCompartments';
import {
  assertExecutionAllowed,
  assertReplayCannotTrade,
} from './timeAuthorityInvariants';

// ============================================================================
// RISK STATE (external dependencies)
// ============================================================================

/**
 * RiskState
 * 
 * External state that risk approval queries.
 * Injected as dependency.
 */
export interface RiskState {
  // Current portfolio
  portfolioValueUsd: number;
  unrealizedPnlUsd: number;
  
  // Per-agent tracking
  lastSignalByAgent: Map<string, number>;  // agentId -> timestamp
  positionsBySymbol: Map<string, number>;  // symbol -> quantity
  
  // Global limits
  killSwitchActive: boolean;
  maxDrawdownPct: number;
  maxLeverageMultiplier: number;
  maxUsdPerSignal: number;
  cooldownMs: number;
}

// ============================================================================
// APPROVAL LOGIC
// ============================================================================

/**
 * approveSignalIntent
 * 
 * Run intent through risk checks.
 * 
 * Returns approval with detailed reasoning.
 * Intent is not modified.
 */
export function approveSignalIntent(
  intent: SignalIntent,
  riskState: RiskState
): RiskApproval {
  const checks = {
    timeAuthorityPassed: false,
    confidenceThresholdPassed: false,
    exposureWithinLimits: false,
    drawdownAcceptable: false,
    rateLimited: false,
  };

  // ========================================================================
  // CHECK 1: Time Authority
  // ========================================================================
  // Intent must be in LIVE mode (Replay never creates intents anyway,
  // but double-check)

  if (intent.mode !== 'LIVE') {
    return {
      intentId: intent.id,
      approved: false,
      reason: `Intent mode is ${intent.mode}, not LIVE. Replay intents should never exist.`,
      riskScore: 0,
      checks,
    };
  }

  checks.timeAuthorityPassed = true;

  // ========================================================================
  // CHECK 2: Confidence Threshold
  // ========================================================================

  const minConfidence = EXECUTION_COMPARTMENT_CONSTANTS.MIN_APPROVAL_CONFIDENCE;
  if (intent.confidence < minConfidence) {
    return {
      intentId: intent.id,
      approved: false,
      reason: `Confidence ${(intent.confidence * 100).toFixed(1)}% below threshold ${(minConfidence * 100).toFixed(1)}%`,
      riskScore: intent.confidence,
      checks,
    };
  }

  checks.confidenceThresholdPassed = true;

  // ========================================================================
  // CHECK 3: Exposure Limits
  // ========================================================================
  // For now, simple: assume 1 unit = $1000 notional
  // Real system would use actual market prices

  const estimatedNotionalUsd = calculateEstimatedNotional(intent, riskState);
  const maxUsd = riskState.maxUsdPerSignal;

  if (estimatedNotionalUsd > maxUsd) {
    return {
      intentId: intent.id,
      approved: false,
      reason: `Estimated notional $${estimatedNotionalUsd.toFixed(0)} exceeds limit $${maxUsd}`,
      riskScore: Math.min(1, estimatedNotionalUsd / maxUsd),
      checks: { ...checks, exposureWithinLimits: false },
    };
  }

  checks.exposureWithinLimits = true;

  // ========================================================================
  // CHECK 4: Drawdown State
  // ========================================================================

  const drawdownPct = calculateDrawdownPercent(riskState);
  if (drawdownPct > riskState.maxDrawdownPct) {
    return {
      intentId: intent.id,
      approved: false,
      reason: `Drawdown ${drawdownPct.toFixed(1)}% exceeds max ${riskState.maxDrawdownPct}%`,
      riskScore: 0,
      checks: { ...checks, drawdownAcceptable: false },
    };
  }

  checks.drawdownAcceptable = true;

  // ========================================================================
  // CHECK 5: Rate Limiting (Cooldown)
  // ========================================================================

  const lastSignalTs = riskState.lastSignalByAgent.get(intent.agentId);
  if (lastSignalTs !== undefined) {
    const timeSinceLastSignal = intent.ts - lastSignalTs;
    if (timeSinceLastSignal < riskState.cooldownMs) {
      return {
        intentId: intent.id,
        approved: false,
        reason: `Rate limited. ${timeSinceLastSignal}ms since last signal, cooldown is ${riskState.cooldownMs}ms`,
        riskScore: 0,
        checks: { ...checks, rateLimited: true },
      };
    }
  }

  checks.rateLimited = false;  // either no previous signal, or cooldown passed

  // ========================================================================
  // CHECK 6: Kill Switch
  // ========================================================================

  if (riskState.killSwitchActive) {
    return {
      intentId: intent.id,
      approved: false,
      reason: 'Kill switch is active. No trading allowed.',
      riskScore: 0,
      checks,
    };
  }

  // ========================================================================
  // ALL CHECKS PASSED
  // ========================================================================

  const riskScore = calculateRiskScore(intent, riskState, drawdownPct);

  return {
    intentId: intent.id,
    approved: true,
    reason: `Signal approved. Risk score: ${riskScore.toFixed(2)}`,
    limits: {
      maxUsd: riskState.maxUsdPerSignal,
      maxLeverage: riskState.maxLeverageMultiplier,
      cooldownMs: riskState.cooldownMs,
      maxDrawdownPercent: riskState.maxDrawdownPct,
    },
    riskScore,
    checks,
  };
}

/**
 * approveBatch
 * 
 * Approve multiple intents.
 */
export function approveBatch(
  intents: SignalIntent[],
  riskState: RiskState
): RiskApproval[] {
  return intents.map((intent) => approveSignalIntent(intent, riskState));
}

// ============================================================================
// RISK CALCULATIONS
// ============================================================================

/**
 * calculateEstimatedNotional
 * 
 * Rough estimate of notional USD exposure.
 * Real system would use actual market price.
 */
function calculateEstimatedNotional(
  intent: SignalIntent,
  riskState: RiskState
): number {
  // Simple model: assume 1 unit = $1000 * signal strength
  return 1000 * intent.signalStrength;
}

/**
 * calculateDrawdownPercent
 * 
 * Calculate current drawdown from peak.
 */
function calculateDrawdownPercent(riskState: RiskState): number {
  if (riskState.portfolioValueUsd === 0) {
    return 0;
  }

  const drawdown = riskState.unrealizedPnlUsd;
  if (drawdown >= 0) {
    return 0;  // not in drawdown
  }

  return Math.abs((drawdown / riskState.portfolioValueUsd) * 100);
}

/**
 * calculateRiskScore
 * 
 * Aggregate risk assessment (0..1, lower is safer).
 */
function calculateRiskScore(
  intent: SignalIntent,
  riskState: RiskState,
  drawdownPct: number
): number {
  // Components
  const confidenceScore = 1 - intent.confidence;  // lower confidence = higher risk
  const drawdownScore = Math.min(1, drawdownPct / 100);  // deeper drawdown = higher risk
  const notionalScore = Math.min(1, calculateEstimatedNotional(intent, riskState) / riskState.maxUsdPerSignal);

  // Weighted average
  return (
    confidenceScore * 0.4 +
    drawdownScore * 0.3 +
    notionalScore * 0.3
  );
}

// ============================================================================
// VETO QUERIES
// ============================================================================

/**
 * wasApprovalVetoed
 * 
 * Check if approval was rejected and why.
 */
export function wasApprovalVetoed(approval: RiskApproval): boolean {
  return !approval.approved;
}

/**
 * getVetoReason
 * 
 * Human-readable explanation of veto.
 */
export function getVetoReason(approval: RiskApproval): string {
  if (approval.approved) {
    return 'No veto';
  }
  return approval.reason || 'Unknown reason';
}

/**
 * explainApproval
 * 
 * Detailed approval explanation.
 */
export function explainApproval(approval: RiskApproval): string {
  const status = approval.approved ? '✅ APPROVED' : '❌ REJECTED';

  let output =
    `${status}\n` +
    `Risk Score: ${approval.riskScore.toFixed(2)}\n` +
    `Reason: ${approval.reason}\n` +
    `\nCheck Results:\n`;

  output += `  Time Authority: ${approval.checks.timeAuthorityPassed ? '✅' : '❌'}\n`;
  output += `  Confidence: ${approval.checks.confidenceThresholdPassed ? '✅' : '❌'}\n`;
  output += `  Exposure: ${approval.checks.exposureWithinLimits ? '✅' : '❌'}\n`;
  output += `  Drawdown: ${approval.checks.drawdownAcceptable ? '✅' : '❌'}\n`;
  output += `  Rate Limit: ${approval.checks.rateLimited ? '❌' : '✅'}\n`;

  if (approval.limits) {
    output +=
      `\nApproved Limits:\n` +
      `  Max USD: $${approval.limits.maxUsd}\n` +
      `  Max Leverage: ${approval.limits.maxLeverage}x\n` +
      `  Cooldown: ${approval.limits.cooldownMs}ms\n` +
      `  Max Drawdown: ${approval.limits.maxDrawdownPercent}%\n`;
  }

  return output;
}

// ============================================================================
// DEFAULT RISK STATE
// ============================================================================

/**
 * createDefaultRiskState
 * 
 * Create a reasonable default risk state for testing/demo.
 */
export function createDefaultRiskState(): RiskState {
  return {
    portfolioValueUsd: 100000,
    unrealizedPnlUsd: 0,
    lastSignalByAgent: new Map(),
    positionsBySymbol: new Map(),
    killSwitchActive: false,
    maxDrawdownPct: EXECUTION_COMPARTMENT_CONSTANTS.MAX_DRAWDOWN_PERCENT,
    maxLeverageMultiplier: EXECUTION_COMPARTMENT_CONSTANTS.DEFAULT_MAX_LEVERAGE,
    maxUsdPerSignal: EXECUTION_COMPARTMENT_CONSTANTS.DEFAULT_MAX_USD_PER_SIGNAL,
    cooldownMs: EXECUTION_COMPARTMENT_CONSTANTS.DEFAULT_COOLDOWN_MS,
  };
}
