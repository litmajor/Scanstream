/**
 * Data Layer Invariant Guards
 * 
 * Hard rules enforced at runtime to prevent illegal data flows.
 * These assertions should fire in development/testing if violated.
 */

import type { RawTick } from '../types/RawTick';
import type { MarketFrame } from '../types/MarketFrame';
import type { DecisionContext } from '../types/DecisionContext';
import type { UITick } from '../types/UITick';

/**
 * INVARIANT 1: RawTick ❌→ Agent
 * 
 * Agents must never see raw, unprocessed exchange data.
 * They must only see DecisionContext.
 */
export function assertNoRawTickToAgent(data: any): void {
  if (data && 'exchange' in data && 'tradeId' in data && 'seq' in data) {
    throw new Error(
      '[INVARIANT VIOLATION] RawTick passed to agent code. ' +
      'Agents must only consume DecisionContext. ' +
      'Data: ' + JSON.stringify(data)
    );
  }
}

/**
 * INVARIANT 2: RawTick ❌→ UI
 * 
 * UI must never render raw exchange data.
 * It must only render UITick.
 */
export function assertNoRawTickToUI(data: any): void {
  if (data && 'exchange' in data && 'tradeId' in data && 'seq' in data) {
    throw new Error(
      '[INVARIANT VIOLATION] RawTick passed to UI rendering. ' +
      'UI must only consume UITick. ' +
      'Data: ' + JSON.stringify(data)
    );
  }
}

/**
 * Assert that data is a valid UITick.
 * Validates that UITick has required properties and correct structure.
 */
export function assertUITick(data: any): asserts data is UITick {
  if (!data || typeof data !== 'object') {
    throw new Error('[INVARIANT VIOLATION] UITick is not an object. Data: ' + typeof data);
  }

  // Check required UITick properties
  const requiredProps = ['timestamp', 'symbol', 'price', 'volume', 'state'];
  for (const prop of requiredProps) {
    if (!(prop in data)) {
      throw new Error(
        '[INVARIANT VIOLATION] UITick missing required property: ' + prop +
        '. Data: ' + JSON.stringify(data)
      );
    }
  }

  // Validate state structure for UITick
  if (!data.state || typeof data.state !== 'object') {
    throw new Error('[INVARIANT VIOLATION] UITick.state is missing or invalid');
  }

  if (!['LIVE', 'REPLAY'].includes(data.state.mode)) {
    throw new Error('[INVARIANT VIOLATION] UITick.state.mode is invalid: ' + data.state.mode);
  }

  // Validate price properties
  if (typeof data.price !== 'object' || !data.price) {
    throw new Error('[INVARIANT VIOLATION] UITick.price must be an object');
  }

  const priceProps = ['open', 'high', 'low', 'close'];
  for (const prop of priceProps) {
    if (typeof data.price[prop] !== 'number') {
      throw new Error(
        '[INVARIANT VIOLATION] UITick.price.' + prop + ' must be a number'
      );
    }
  }

  // Validate volume
  if (typeof data.volume !== 'number' || data.volume < 0) {
    throw new Error('[INVARIANT VIOLATION] UITick.volume must be a non-negative number');
  }

  // Validate timestamp
  if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
    throw new Error('[INVARIANT VIOLATION] UITick.timestamp must be a positive number');
  }

  // Validate symbol
  if (typeof data.symbol !== 'string' || !data.symbol.length) {
    throw new Error('[INVARIANT VIOLATION] UITick.symbol must be a non-empty string');
  }
}

/**
 * INVARIANT 3: Agent ❌→ Storage
 * 
 * Agents must never write directly to storage.
 * They can only emit decisions, which a coordinator persists.
 */
export function assertNoAgentWriteToStorage(source: string): void {
  if (source && source.includes('agent')) {
    console.warn(
      '[INVARIANT WARNING] Agent code attempting direct storage write. ' +
      'Agents should emit decisions, not persist data. ' +
      'Source: ' + source
    );
  }
}

/**
 * INVARIANT 4: UI ❌→ Decision
 * 
 * UI interactions should never directly influence trading logic.
 * UI can trigger workflows, but decisions come from agents/DecisionContext.
 */
export function assertNoUIToDecision(uiAction: any, thenApplyToDecision: boolean): void {
  if (thenApplyToDecision) {
    throw new Error(
      '[INVARIANT VIOLATION] UI action directly influenced trading decision. ' +
      'UI can trigger workflows, but decisions must come from agents/signals. ' +
      'Action: ' + JSON.stringify(uiAction)
    );
  }
}

/**
 * INVARIANT 5: Replay ≠ Live (Must Be Explicit)
 * 
 * Replay/backtest data must be explicitly marked and cannot be
 * confused with live market data in decision logic.
 */
export function assertReplayExplicit(tick: UITick | MarketFrame): void {
  if ('state' in tick) {
    // UITick: has explicit state.mode
    if (tick.state.mode !== 'LIVE' && tick.state.mode !== 'REPLAY') {
      throw new Error('[INVARIANT VIOLATION] UITick has invalid mode: ' + (tick.state as any).mode);
    }
  } else if ('meta' in tick) {
    // MarketFrame: has explicit meta.source
    const frame = tick as MarketFrame;
    if (!['live', 'replay', 'fallback'].includes(frame.meta.source)) {
      throw new Error('[INVARIANT VIOLATION] MarketFrame has invalid source: ' + frame.meta.source);
    }
  }
}

/**
 * INVARIANT 6: DecisionContext is Read-Only
 * 
 * Agents must not mutate a DecisionContext.
 * If they need to change perception, they must emit a new signal/event.
 */
export function assertDecisionContextImmutable(ctx: DecisionContext, attempted: string): void {
  if (Object.isFrozen(ctx)) {
    // This is good — context is frozen.
    return;
  }

  console.warn(
    '[INVARIANT WARNING] DecisionContext is not frozen. ' +
    'Agents could mutate it. Attempted mutation: ' + attempted + '. ' +
    'Recommend using freezeDecisionContext() at creation.'
  );
}

/**
 * INVARIANT 7: MarketFrame Source Must Match Usage
 * 
 * Live trading should never use fallback data without explicit decision.
 * Backtest must explicitly use 'replay' source.
 */
export function assertMarketFrameSourceMatchesMode(
  frame: MarketFrame,
  mode: 'live' | 'backtest'
): void {
  const isLive = frame.meta.source === 'live';
  const isReplay = frame.meta.source === 'replay';
  const isFallback = frame.meta.source === 'fallback';

  if (mode === 'live' && isReplay) {
    throw new Error(
      '[INVARIANT VIOLATION] Live trading mode using replay data. ' +
      'Symbol: ' + frame.symbol + ', Source: ' + frame.meta.source
    );
  }

  if (mode === 'live' && isFallback) {
    console.warn(
      '[INVARIANT WARNING] Live trading using fallback data. ' +
      'Should have explicit user override. ' +
      'Symbol: ' + frame.symbol + ', Reason: ' + frame.meta.fallbackReason
    );
  }

  if (mode === 'backtest' && isLive) {
    throw new Error(
      '[INVARIANT VIOLATION] Backtest mode using live data. ' +
      "Must use 'replay' or 'fallback' source. " +
      'Symbol: ' + frame.symbol
    );
  }
}

/**
 * Enable/disable invariant enforcement globally.
 * Useful for testing or if performance is critical.
 */
let invariantEnforcementEnabled = true;

export function setInvariantEnforcement(enabled: boolean): void {
  invariantEnforcementEnabled = enabled;
}

export function isInvariantEnforcementEnabled(): boolean {
  return invariantEnforcementEnabled;
}

/**
 * Composite check: verify all hard invariants.
 * Call this when receiving data from an untrusted source.
 */
export function verifyDataLayerInvariants(
  data: any,
  context: { source: 'agent' | 'ui' | 'storage' | 'network'; mode: 'live' | 'backtest' }
): void {
  if (!invariantEnforcementEnabled) return;

  try {
    if (context.source === 'agent') {
      assertNoRawTickToAgent(data);
      if ('frame' in data) {
        assertDecisionContextImmutable(data, 'verifyDataLayerInvariants');
      }
    }

    if (context.source === 'ui') {
      assertNoRawTickToUI(data);
      if ('state' in data && data.state) {
        assertReplayExplicit(data);
      }
    }

    if ('meta' in data && data.meta) {
      assertMarketFrameSourceMatchesMode(data, context.mode);
      assertReplayExplicit(data);
    }
  } catch (err) {
    console.error('[INVARIANT ERROR]', err);
    throw err;
  }
}
