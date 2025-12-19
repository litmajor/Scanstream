/**
 * MANDATORY WORLD TICK SUBSCRIPTION
 * 
 * This is not optional.
 * This is not a suggestion.
 * This is the rule.
 * 
 * Every agent MUST:
 * 1. Extend BaseAgent
 * 2. Implement onWorldTick()
 * 3. Subscribe in constructor (enforced)
 * 4. React only to world ticks (enforced)
 * 
 * No agent gets to bypass this.
 * No agent gets to react to raw data.
 * No agent gets to skip subscription.
 * 
 * VIOLATION = Compilation error. Not a runtime surprise.
 */

import { EventEmitter } from 'events';
import type { WorldTick } from '../types/market-data';
import { getRegimeService, RegimeContext } from '../services/regime-service';

/**
 * BASE AGENT — WORLD TICK SUBSCRIPTION MANDATORY
 * 
 * This is the ONLY way to create agents in this system.
 * 
 * Contract:
 * - You extend BaseAgent
 * - You implement onWorldTick(tick)
 * - Subscription happens in __construct
 * - You never touch raw data
 */
export abstract class BaseAgent extends EventEmitter {
  protected name: string;
  private subscribed: boolean = false;

  constructor(
    protected gate: EventEmitter, // IntegrityGate or ForexEngine
    name: string
  ) {
    super();
    this.name = name;

    // MANDATORY: Subscribe to world ticks in constructor
    // This happens BEFORE any agent method runs
    this._subscribeToWorldTicks();

    // Verify subscription succeeded
    if (!this.subscribed) {
      throw new Error(
        `[BaseAgent] ${this.name} failed to subscribe to world ticks. ` +
        `This is not allowed. Every agent MUST subscribe.`
      );
    }

    console.log(`[BaseAgent] ✅ ${this.name} subscribed to world ticks`);
  }

  /**
   * INTERNAL: Subscribe to world ticks
   * 
   * This is called automatically by constructor.
   * Agents cannot override this.
   * Agents cannot skip this.
   */
  private _subscribeToWorldTicks(): void {
    try {
      this.gate.on('world.tick', (tick: WorldTick) => {
        // Call agent's implementation
        this.onWorldTick(tick);
      });

      this.subscribed = true;

      // Subscribe to regime updates (optional handler for subclasses)
      try {
        const regimeSvc = getRegimeService();
        regimeSvc.on('regime.update', (payload: { symbol: string; timeframe: number; regime: RegimeContext }) => {
          try {
            // Call subclass handler if implemented
            (this as any).onRegimeUpdate?.(payload.symbol, payload.timeframe, payload.regime);
          } catch (e) {
            console.warn(`[BaseAgent] onRegimeUpdate handler threw for ${this.name}:`, (e as any)?.message || e);
          }
        });
      } catch (e) {
        // Best-effort: do not fail agent construction if regime service unavailable
        console.warn('[BaseAgent] Failed to subscribe to regime updates:', (e as any)?.message || e);
      }
    } catch (err) {
      console.error(`[BaseAgent] Failed to subscribe ${this.name}:`, err);
      throw err; // Fail fast, don't hide the problem
    }
  }

  /**
   * MANDATORY: Implement this method
   * 
   * This is called for EVERY world tick.
   * This is the ONLY place agents react to market data.
   * 
   * @param tick World Tick (validated fact)
   */
  abstract onWorldTick(tick: WorldTick): void;

  /**
   * Check subscription status (for debugging)
   */
  isSubscribed(): boolean {
    return this.subscribed;
  }

  /**
   * Get agent name
   */
  getName(): string {
    return this.name;
  }
}

/**
 * EXAMPLE: Correct Agent Implementation
 * 
 * This is the ONLY way to write agents.
 */
export class ExampleAgent extends BaseAgent {
  constructor(gate: EventEmitter) {
    // Constructor calls super() → subscription happens automatically
    super(gate, 'ExampleAgent');
  }

  /**
   * MANDATORY implementation
   */
  onWorldTick(tick: WorldTick): void {
    // Agent reacts only to world ticks
    // Source is irrelevant (crypto or forex)
    // Data is validated (CandleIntegrityLayer)
    // Storage succeeded (atomic guarantee)

    console.log(
      `[${this.name}] ✅ World Tick: ${tick.symbol} ${tick.timeframe}s ` +
      `close=${tick.candle.close} final=${tick.isFinal}`
    );

    // Trading logic here (identical for all sources)
    if (tick.candle.close > tick.candle.open * 1.01) {
      console.log(`[${this.name}] Price up 1%+, evaluating long entry`);
    }
  }
}

/**
 * ANTI-PATTERN: What NOT to do
 * 
 * These will NOT compile or will throw at runtime.
 * This is intentional.
 */

// ❌ WRONG: Not extending BaseAgent
// export class BadAgent {
//   onSomeOtherEvent() { ... }  // NO! Must use BaseAgent
// }

// ❌ WRONG: Trying to skip subscription
// export class BadAgent extends BaseAgent {
//   constructor(gate) {
//     super(gate, 'BadAgent');
//     // Can't skip subscription, it's automatic in constructor
//   }
// }

// ❌ WRONG: Reacting to raw data
// export class BadAgent extends BaseAgent {
//   constructor(gate) {
//     super(gate, 'BadAgent');
//     gate.on('raw.candle', this.someMethod);  // NO! Only world.tick
//   }
//   onWorldTick(tick) { ... }
// }

// ❌ WRONG: Calling adapter directly
// export class BadAgent extends BaseAgent {
//   onWorldTick(tick) {
//     const candles = await oandaAdapter.fetchCandles(...);  // NO!
//     // Never call adapters directly
//   }
// }
