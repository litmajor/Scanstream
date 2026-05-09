/**
 * SIGNAL INTENT FACTORY
 * 
 * Creates SignalIntent objects from agent signals.
 * 
 * Rules:
 * - Only created in LIVE mode (REPLAY never creates intents)
 * - Frozen immutable after creation
 * - Validates input from agents
 * - Never modifiable
 * 
 * This is Stage 1 of the execution pipeline.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SignalIntent,
  AgentSignalSource,
  EXECUTION_COMPARTMENT_CONSTANTS,
  isSignalIntent,
} from '../../types/ExecutionCompartments';
import { DecisionContext } from '../../types/DecisionContext';

// ============================================================================
// SIGNAL INTENT CREATION
// ============================================================================

/**
 * createSignalIntent
 * 
 * Create a SignalIntent from an agent signal.
 * 
 * Guards:
 * - context must be LIVE mode
 * - signal values must be in range [0, 1]
 * - symbol must be valid
 * - agentId must be non-empty
 * 
 * Result is frozen and immutable.
 */
export function createSignalIntent(
  source: AgentSignalSource,
  ctx: DecisionContext
): SignalIntent {
  // Guard 1: Must be LIVE mode
  if (ctx.mode !== 'LIVE') {
    throw new Error(
      `Cannot create SignalIntent in ${ctx.mode} mode. ` +
      'Replay never creates execution intents.'
    );
  }

  // Guard 2: Validate signal source
  validateAgentSignalSource(source);

  // Guard 3: Check confidence threshold
  if (source.confidence < EXECUTION_COMPARTMENT_CONSTANTS.MIN_APPROVAL_CONFIDENCE) {
    throw new Error(
      `Signal confidence ${source.confidence} below minimum ` +
      `${EXECUTION_COMPARTMENT_CONSTANTS.MIN_APPROVAL_CONFIDENCE}. ` +
      'Will be rejected downstream anyway; skip creation.'
    );
  }

  const intent: SignalIntent = Object.freeze({
    // Identity
    id: uuidv4(),
    ts: Date.now(),

    // What I want
    symbol: source.symbol.toUpperCase(),
    side: source.side,
    rationale: source.rationale,

    // Conviction
    signalStrength: source.signalStrength,
    confidence: source.confidence,

    // Context
    mode: 'LIVE',
    agentId: source.agentId,
    timeframe: source.timeframe || EXECUTION_COMPARTMENT_CONSTANTS.SIGNAL_INTENT_DEFAULT_TIMEFRAME,

    // Immutability marker
    __frozen: true,
  }) as SignalIntent;

  return intent;
}

/**
 * createSignalIntentBatch
 * 
 * Create multiple SignalIntents at once.
 * Stops on first error.
 */
export function createSignalIntentBatch(
  sources: AgentSignalSource[],
  ctx: DecisionContext
): SignalIntent[] {
  return sources.map((source) => createSignalIntent(source, ctx));
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * validateAgentSignalSource
 * 
 * Ensure signal meets minimum quality standards.
 */
export function validateAgentSignalSource(source: AgentSignalSource): void {
  // Symbol
  if (!source.symbol || source.symbol.trim().length === 0) {
    throw new Error('Signal must have non-empty symbol');
  }

  // Side
  if (source.side !== 'buy' && source.side !== 'sell') {
    throw new Error(`Invalid side: ${source.side}. Must be 'buy' or 'sell'.`);
  }

  // Rationale
  if (!source.rationale || source.rationale.trim().length === 0) {
    throw new Error('Signal must have non-empty rationale');
  }

  // Signal strength [0, 1]
  if (
    typeof source.signalStrength !== 'number' ||
    source.signalStrength < 0 ||
    source.signalStrength > 1
  ) {
    throw new Error(
      `signalStrength must be in [0, 1], got ${source.signalStrength}`
    );
  }

  // Confidence [0, 1]
  if (
    typeof source.confidence !== 'number' ||
    source.confidence < 0 ||
    source.confidence > 1
  ) {
    throw new Error(
      `confidence must be in [0, 1], got ${source.confidence}`
    );
  }

  // Agent ID
  if (!source.agentId || source.agentId.trim().length === 0) {
    throw new Error('Signal must have non-empty agentId');
  }
}

/**
 * validateSignalIntent
 * 
 * Verify intent integrity.
 */
export function validateSignalIntent(intent: SignalIntent): void {
  if (!isSignalIntent(intent)) {
    throw new Error('Object is not a valid SignalIntent');
  }

  // Verify immutability
  try {
    (intent as any).id = 'modified';
    throw new Error(
      'SignalIntent is not frozen! Immutability check failed.'
    );
  } catch (e: any) {
    if (e.message.includes('Cannot assign to read only property')) {
      // Good, it's frozen
      return;
    }
    throw e;
  }
}

// ============================================================================
// QUERIES & INSPECTION
// ============================================================================

/**
 * explainSignalIntent
 * 
 * Human-readable explanation of intent.
 */
export function explainSignalIntent(intent: SignalIntent): string {
  return (
    `SignalIntent ${intent.id}\n` +
    `  Agent: ${intent.agentId}\n` +
    `  Symbol: ${intent.symbol}\n` +
    `  Side: ${intent.side.toUpperCase()}\n` +
    `  Confidence: ${(intent.confidence * 100).toFixed(1)}%\n` +
    `  Strength: ${(intent.signalStrength * 100).toFixed(1)}%\n` +
    `  Rationale: ${intent.rationale}\n` +
    `  Created: ${new Date(intent.ts).toISOString()}`
  );
}

/**
 * compareIntents
 * 
 * Check if two intents are equivalent (ignoring ID and timestamp).
 */
export function compareIntents(a: SignalIntent, b: SignalIntent): boolean {
  return (
    a.symbol === b.symbol &&
    a.side === b.side &&
    a.confidence === b.confidence &&
    a.signalStrength === b.signalStrength &&
    a.agentId === b.agentId
  );
}

/**
 * extractIntentSummary
 * 
 * Get minimal fields for logging/display.
 */
export function extractIntentSummary(intent: SignalIntent) {
  return {
    id: intent.id,
    symbol: intent.symbol,
    side: intent.side,
    confidence: intent.confidence,
    agent: intent.agentId,
  };
}
