# WORLD TICK SUBSCRIPTION ENFORCEMENT CHECKLIST

**Rule:** Every agent MUST subscribe to world ticks. This is not optional.

---

## For New Agents

### Checklist Before Shipping Code

- [ ] Agent extends `BaseAgent`
  ```typescript
  export class MyAgent extends BaseAgent { ... }
  ```

- [ ] Agent implements `onWorldTick()`
  ```typescript
  onWorldTick(tick: WorldTick): void { ... }
  ```

- [ ] Constructor calls `super(gate, name)`
  ```typescript
  constructor(gate: EventEmitter) {
    super(gate, 'MyAgent');
  }
  ```

- [ ] No direct event subscription in agent code
  ```typescript
  // ❌ Don't do this:
  gate.on('world.tick', ...);
  
  // ✅ Already done by BaseAgent
  ```

- [ ] No raw data access
  ```typescript
  // ❌ Don't do this:
  gate.on('raw.candle', ...);
  
  // ✅ Only subscribe to world ticks
  ```

- [ ] No adapter calls in agent
  ```typescript
  // ❌ Don't do this:
  const candles = await oandaAdapter.fetchCandles(...);
  
  // ✅ Only react to world ticks
  ```

- [ ] No direct storage access
  ```typescript
  // ❌ Don't do this:
  const data = await storage.getCandles(...);
  
  // ✅ Only react to world ticks
  ```

---

## For Code Review

### Checklist Before Approval

- [ ] Agent extends `BaseAgent` (not custom EventEmitter)
- [ ] `onWorldTick()` is implemented (not optional)
- [ ] Constructor calls `super()` properly
- [ ] No inline event subscriptions
- [ ] No raw data event subscriptions
- [ ] No adapter access in agent code
- [ ] No storage access in agent code
- [ ] All logic is in `onWorldTick()` or private methods called from it
- [ ] Source parameter is never used for conditional logic
  ```typescript
  // ✅ Acceptable (diagnostic):
  console.log(`Data from ${tick.source}`);
  
  // ❌ Not acceptable (logic depends on source):
  if (tick.source === 'oanda') { special logic }
  ```

---

## For Testing

### Unit Test Checklist

- [ ] Test agent subscribes in constructor
  ```typescript
  const agent = new MyAgent(gate);
  expect(agent.isSubscribed()).toBe(true);
  ```

- [ ] Test onWorldTick is called for each tick
  ```typescript
  mockGate.emit('world.tick', tick);
  expect(agent.handleCalled).toBe(true);
  ```

- [ ] Test constructor throws if subscription fails
  ```typescript
  const badGate = { on: () => { throw new Error(); } };
  expect(() => new MyAgent(badGate)).toThrow();
  ```

- [ ] Test agent filters correctly
  ```typescript
  agent.onWorldTick(eurTick);
  agent.onWorldTick(btcTick);
  expect(agent.processedCount).toBe(2);
  ```

---

## For Integration

### Integration Test Checklist

- [ ] Agent receives ticks from IntegrityGate
  ```typescript
  const agent = new MyAgent(integrityGate);
  // Fetch and validate candles
  const result = await integrityGate.storeValidatedCandles(...);
  // Agent should have received world ticks
  ```

- [ ] Agent receives ticks from ForexEngine
  ```typescript
  const agent = new MyAgent(forexEngine);
  // Scan forex symbols
  const results = await forexEngine.scanSymbols(...);
  // Agent should have received world ticks
  ```

- [ ] Agent receives ticks from multiple sources
  ```typescript
  const agent = new MyAgent(integrityGate);
  // Process CCXT candles
  // Process OANDA candles
  // Agent handles both identically
  ```

---

## Red Flags (Do Not Approve)

- ❌ Agent doesn't extend BaseAgent
- ❌ Agent doesn't implement onWorldTick
- ❌ Agent has custom event subscription code
- ❌ Agent calls gate.on('world.tick', ...)
- ❌ Agent subscribes to raw data events
- ❌ Agent calls adapter methods
- ❌ Agent accesses storage directly
- ❌ Agent has source-specific logic paths
- ❌ Agent constructor doesn't call super()
- ❌ Agent has logic outside onWorldTick()

---

## Template (Copy-Paste)

```typescript
// server/agents/new-agent.ts

import { BaseAgent } from './base-agent';
import type { WorldTick } from '../types/market-data';
import { EventEmitter } from 'events';

/**
 * New Agent Name
 * 
 * Purpose: What does this agent do?
 * Sources: Crypto/Forex/Both
 * Symbols: Which symbols does it trade?
 */
export class NewAgent extends BaseAgent {
  // State (if needed)
  private state: any = {};

  constructor(gate: EventEmitter) {
    super(gate, 'NewAgent');
  }

  /**
   * MANDATORY: Called for every world tick
   */
  onWorldTick(tick: WorldTick): void {
    // Filter by symbol (if single-symbol agent)
    if (tick.symbol !== 'TARGET_SYMBOL') {
      return;
    }

    // Filter by finality (if needed)
    if (!tick.isFinal) {
      return;
    }

    // Your trading logic here
    this.evaluate(tick);
  }

  private evaluate(tick: WorldTick): void {
    // Logic implementation
  }
}
```

---

## Verification Commands

### Check Agent Extends BaseAgent

```bash
grep "class.*Agent extends BaseAgent" server/agents/*.ts
# Should show all agents
```

### Check onWorldTick Implemented

```bash
grep -A 1 "class.*Agent extends BaseAgent" server/agents/*.ts | grep -B 1 "onWorldTick"
# Should show all agents have onWorldTick
```

### Check No Direct Subscriptions

```bash
grep "gate.on('world.tick'" server/agents/*.ts
# Should be EMPTY (subscription is in BaseAgent)
```

### Check No Raw Data Access

```bash
grep "gate.on('raw" server/agents/*.ts
# Should be EMPTY
```

### Check No Adapter Calls

```bash
grep "\.fetchCandles\|\.getCandles\|Adapter\|Client" server/agents/*.ts | grep -v "// \|import"
# Should be EMPTY (except imports)
```

---

## Before Merge

1. ✅ All new agents extend BaseAgent
2. ✅ All new agents implement onWorldTick
3. ✅ All new agents pass checklist above
4. ✅ All new agents pass tests
5. ✅ All new agents have no raw data access
6. ✅ All new agents have no adapter access
7. ✅ All new agents have no storage access
8. ✅ Review passed (checklist verified)

---

## After Merge

Monitor for violations:

```typescript
// Monitor logs for subscription errors
[BaseAgent] ✅ MyAgent subscribed to world ticks
[BaseAgent] ❌ MyAgent failed to subscribe // <- ALERT

// Monitor for unhandled world ticks
[IntegrityGate] ✅ World Tick: EUR/USD...
// If no agent logs appear → agent not processing ticks → ALERT
```

---

## Summary

**Rule:** All agents must subscribe to world ticks.

**Enforcement:** 
- Compile-time: TypeScript (extends BaseAgent, onWorldTick)
- Runtime: Constructor validation
- Code review: Checklist above

**No exceptions. No bypasses.**

