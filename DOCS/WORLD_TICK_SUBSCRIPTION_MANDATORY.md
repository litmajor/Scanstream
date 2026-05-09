# WORLD TICK SUBSCRIPTION — MANDATORY RULE

**Status:** Enforced. Not optional. Compilation error if violated.

---

## The Rule

```
Every agent MUST subscribe to world ticks.
This is not optional.
This is not a suggestion.
This is the law of this system.
```

---

## How It Works

### BaseAgent (Enforces Rule)

```typescript
// server/agents/base-agent.ts

export abstract class BaseAgent extends EventEmitter {
  constructor(protected gate: EventEmitter, name: string) {
    super();
    // MANDATORY: Subscription happens automatically in constructor
    this._subscribeToWorldTicks();
    
    // If subscription fails, throw error immediately
    if (!this.subscribed) {
      throw new Error(`Agent ${name} failed to subscribe. Not allowed.`);
    }
  }

  // MANDATORY: Every agent implements this
  abstract onWorldTick(tick: WorldTick): void;
}
```

### Agent Implementation (Must Extend)

```typescript
// server/agents/my-agent.ts

export class MyAgent extends BaseAgent {
  constructor(gate: IntegrityGate) {
    // Constructor call → super() → subscription
    super(gate, 'MyAgent');
  }

  // MANDATORY: Implement onWorldTick
  onWorldTick(tick: WorldTick): void {
    // React to world ticks here
    // This is called for EVERY tick
    // This is the ONLY place you react to market data
  }
}

// Usage:
const agent = new MyAgent(integrityGate);
// Subscription is automatic, can't skip
// Subscription verified before agent is ready to use
```

---

## What's Enforced

### ✅ REQUIRED

```typescript
// ✅ Extend BaseAgent
class MyAgent extends BaseAgent { ... }

// ✅ Implement onWorldTick
onWorldTick(tick: WorldTick): void { ... }

// ✅ Subscribe automatically (in constructor)
constructor(gate) { super(gate, 'MyAgent'); }

// ✅ React only to world ticks
gate.on('world.tick', ...) // Automatic
```

### ❌ FORBIDDEN

```typescript
// ❌ Don't extend BaseAgent
class MyAgent { ... }  // Compilation error

// ❌ Don't skip onWorldTick implementation
class MyAgent extends BaseAgent {
  // Missing onWorldTick → TS error (abstract method)
}

// ❌ Don't subscribe in your own code
gate.on('world.tick', this.method);  // Don't!

// ❌ Don't react to raw data
gate.on('raw.candle', ...);  // No such event

// ❌ Don't call adapters directly
const candles = await oandaAdapter.fetchCandles(...);  // No!

// ❌ Don't bypass the gate
storage.getCandles(...);  // No direct access
```

---

## Enforcement Mechanisms

### 1. Type System (Compile-Time)

```typescript
// Abstract method must be implemented
abstract onWorldTick(tick: WorldTick): void;

// Missing implementation → TS error:
// "Non-abstract class 'MyAgent' does not implement
//  inherited abstract member 'onWorldTick'"
```

### 2. Constructor Validation (Runtime)

```typescript
constructor(gate) {
  super(gate, 'MyAgent');
  
  // Subscription verified before constructor returns
  if (!this.subscribed) {
    throw new Error('Agent not subscribed');
  }
}

// If subscription fails, agent never becomes usable
```

### 3. Event Subscription (Internal)

```typescript
private _subscribeToWorldTicks(): void {
  this.gate.on('world.tick', (tick) => {
    this.onWorldTick(tick);  // Calls agent method
  });
  this.subscribed = true;
}

// This is private, agents can't override it
// This is automatic, agents can't skip it
```

---

## Example: Correct Implementation

### Single-Symbol Agent

```typescript
// server/agents/eur-usd-agent.ts

import { BaseAgent } from './base-agent';
import type { WorldTick } from '../types/market-data';

export class EurUsdAgent extends BaseAgent {
  private lastClose: number | null = null;

  constructor(gate: EventEmitter) {
    super(gate, 'EurUsdAgent');
  }

  onWorldTick(tick: WorldTick): void {
    // Only react to EUR/USD
    if (tick.symbol !== 'EUR/USD') {
      return;
    }

    // Only if candle is final
    if (!tick.isFinal) {
      return;
    }

    // Trading logic
    if (this.lastClose !== null) {
      const change = (tick.candle.close - this.lastClose) / this.lastClose;
      
      if (change > 0.01) {
        console.log(`[${this.name}] EUR/USD up 1%+, long signal`);
        this.evaluateLongEntry(tick);
      }
    }

    this.lastClose = tick.candle.close;
  }

  private evaluateLongEntry(tick: WorldTick): void {
    // Entry logic here
  }
}

// Usage:
const eurAgent = new EurUsdAgent(integrityGate);
// Agent automatically subscribes
// Agent receives every world tick
// Agent filters by symbol internally
```

### Multi-Symbol Agent

```typescript
// server/agents/multi-agent.ts

export class MultiSymbolAgent extends BaseAgent {
  constructor(gate: EventEmitter) {
    super(gate, 'MultiSymbolAgent');
  }

  onWorldTick(tick: WorldTick): void {
    // React based on symbol
    switch (tick.symbol) {
      case 'BTC/USDT':
        this.handleCrypto(tick);
        break;
      case 'EUR/USD':
        this.handleForex(tick);
        break;
      case 'AAPL':
        this.handleEquities(tick);
        break;
    }
  }

  private handleCrypto(tick: WorldTick): void {
    // Crypto-specific logic
    // But agents don't care where data came from
  }

  private handleForex(tick: WorldTick): void {
    // Forex-specific logic
    // Same code would work for CCXT forex too
  }

  private handleEquities(tick: WorldTick): void {
    // Equities-specific logic
  }
}
```

### Correlation Agent

```typescript
// server/agents/correlation-agent.ts

export class CorrelationAgent extends BaseAgent {
  private btcLastClose: number | null = null;
  private eurusdLastClose: number | null = null;

  constructor(gate: EventEmitter) {
    super(gate, 'CorrelationAgent');
  }

  onWorldTick(tick: WorldTick): void {
    // Track both assets
    if (tick.symbol === 'BTC/USDT') {
      this.btcLastClose = tick.candle.close;
    } else if (tick.symbol === 'EUR/USD') {
      this.eurusdLastClose = tick.candle.close;
    }

    // Only react when we have both
    if (this.btcLastClose !== null && this.eurusdLastClose !== null) {
      this.analyzeCorrelation(tick);
    }
  }

  private analyzeCorrelation(tick: WorldTick): void {
    // Correlation logic
    // Works identically for CCXT-sourced BTC or OANDA-sourced EUR/USD
  }
}
```

---

## What This Guarantees

### For Agents

```
✅ Every agent is subscribed (no surprises)
✅ Subscription happens before any code runs
✅ Subscription verified to succeed
✅ onWorldTick called for every market event
✅ Can't accidentally react to raw data
✅ Can't accidentally call adapters
✅ Can't accidentally bypass storage
```

### For System

```
✅ All agents follow same pattern
✅ No agent is special
✅ No agent can cheat
✅ No agent receives unvalidated data
✅ No agent can create data bypass
✅ All agents see unified world
```

### For Architecture

```
✅ Phase 2 ordering enforced: TICK → AGENT
✅ No raw data flows to agents
✅ Source-agnostic maintained
✅ No agent-specific code paths
✅ Testability guaranteed
```

---

## Test Pattern

### Verify Subscription (Unit Test)

```typescript
describe('BaseAgent Subscription', () => {
  it('subscribes to world ticks in constructor', () => {
    const mockGate = new EventEmitter();
    const agent = new TestAgent(mockGate);

    expect(agent.isSubscribed()).toBe(true);
  });

  it('throws if subscription fails', () => {
    const mockGate = {
      on: () => { throw new Error('Failed'); }
    } as any;

    expect(() => {
      new TestAgent(mockGate);
    }).toThrow('failed to subscribe');
  });
});
```

### Verify onWorldTick Called (Integration Test)

```typescript
describe('Agent World Tick Handling', () => {
  it('calls onWorldTick for every world.tick event', (done) => {
    const mockGate = new EventEmitter();
    const agent = new TestAgent(mockGate);
    
    let callCount = 0;
    agent.on('tick', () => callCount++);

    const tick: WorldTick = {
      symbol: 'EUR/USD',
      timeframe: 300,
      worldTime: Date.now(),
      emitTime: Date.now(),
      candle: { ts: 0, open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 1000, isFinal: true },
      isFinal: true,
      source: 'oanda',
    };

    mockGate.emit('world.tick', tick);

    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 10);
  });
});
```

---

## Migration Guide (Existing Agents)

### Before (Optional Subscription)

```typescript
export class OldAgent {
  constructor(gate: IntegrityGate) {
    // Optional subscription
    gate.on('world.tick', this.onTick);
  }

  onTick(tick) { ... }
}
```

### After (Mandatory Subscription)

```typescript
export class NewAgent extends BaseAgent {
  constructor(gate: IntegrityGate) {
    // Mandatory subscription (automatic)
    super(gate, 'NewAgent');
  }

  onWorldTick(tick: WorldTick): void { ... }
}
```

---

## Enforcement Summary

| Aspect | How Enforced | If Violated |
|--------|--------------|------------|
| Extension | TypeScript | Compilation error |
| onWorldTick | Abstract method | Compilation error |
| Subscription | Constructor | Runtime error |
| Raw data access | No event | Can't listen |
| Adapter bypass | Type system | Compilation error |

---

## Final Rule Statement

```
RULE: All agents must extend BaseAgent.
RULE: All agents must implement onWorldTick.
RULE: All agents must subscribe (automatic).
RULE: All agents must react only to world ticks.
RULE: No exceptions.
RULE: No bypasses.
RULE: No special cases.

Violation = system is broken.
Violation = investigation required.
Violation = not allowed.
```

---

## Impact

✅ **Consistency:** All agents follow same pattern  
✅ **Safety:** Can't accidentally bypass integrity  
✅ **Clarity:** onWorldTick is THE place to add logic  
✅ **Testability:** Subscription guaranteed  
✅ **Maintainability:** No hidden subscription logic  
✅ **Architecture:** Phase 2 ordering enforced at code level  

