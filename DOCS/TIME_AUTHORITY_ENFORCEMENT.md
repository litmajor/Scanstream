# Time Authority Enforcement — Mandatory Mode Segregation

## 🔐 The Core Rule

> **Replay data may flow everywhere — but it may never acquire execution authority.**

## Why This Matters (in plain system terms)

Without explicit time-state separation:

- **Live** and **Replay** share the same semantic surface
- Validators, handlers, and agents can't distinguish between them
- System relies on **human discipline**, not code
- One mistake = real money moves on simulated data

**This is how people get burned.**

---

## The Architecture Fix

Every object after RawTick carries **three critical fields**:

```typescript
mode: 'LIVE' | 'REPLAY'           // Execution authority
source: 'WS' | 'REPLAY_API' | ... // Data provenance
isFinal: boolean                  // Data state
```

This is **not metadata.** This is **execution control state.**

---

## Where Mode/Source Exist (Every Layer)

### 1. MarketFrame (Ground Truth)

```typescript
interface MarketFrameMeta {
  mode: 'LIVE' | 'REPLAY';
  source: 'WS' | 'REPLAY_API' | 'CACHE' | 'FALLBACK';
  isFinal: boolean;
  // ...
}
```

**Invariant:**
```typescript
if (frame.meta.mode === 'REPLAY') {
  assert(frame.meta.source !== 'WS')  // Replay can't come from live websocket
}
```

### 2. DecisionContext (Agent Perception)

```typescript
interface DecisionContext {
  mode: 'LIVE' | 'REPLAY';  // Inherited from frame.meta.mode
  
  constraints: {
    allowTrade: boolean;  // Always false if mode === 'REPLAY'
    reason?: string;      // Why allowTrade is what it is
  }
}
```

**Hard Rule:**
```typescript
allowTrade = (mode === 'LIVE') && (confidence > MIN_CONFIDENCE)
```

No exceptions. No overrides. No special cases.

### 3. UITick (Human Perception)

```typescript
interface UITickState {
  mode: 'LIVE' | 'REPLAY';
  source: 'WS' | 'REPLAY_API' | 'CACHE' | 'FALLBACK';
  isFinal: boolean;
}
```

**Invariant:**
```typescript
if (tick.mode === 'REPLAY' && tick.source === 'WS') {
  throw new Error('Invalid state: replay from live websocket')
}
```

---

## The Three Gates (Defense in Depth)

### Gate 1: Agent Runtime Guard

**Location:** Inside every agent

```typescript
export function myAgent(ctx: DecisionContext): AgentDecision | null {
  // CHECK MODE FIRST
  if (ctx.mode === 'REPLAY') {
    return null;  // Silent no-op in replay
  }

  // ... rest of agent logic
}
```

**What it does:**
- Agents CANNOT generate trading decisions in REPLAY mode
- Even if everything else fails, this blocks execution
- Fast check (single boolean comparison)

### Gate 2: Constraint Enforcement

**Location:** Factory that builds DecisionContext

```typescript
function buildDecisionContext(frame, signals, constraints) {
  // ENFORCE: Replay mode => no trading
  if (frame.meta.mode === 'REPLAY') {
    constraints.allowTrade = false;
    constraints.reason = 'replay_mode_trading_disabled';
  }

  // ENFORCE: Live mode => only if confident
  if (frame.meta.mode === 'LIVE') {
    if (confidence < MIN_THRESHOLD) {
      constraints.allowTrade = false;
      constraints.reason = `low_confidence (${confidence})`;
    }
  }

  return ctx;
}
```

**What it does:**
- Makes allowTrade = false for all REPLAY contexts
- Makes allowTrade depend on confidence for LIVE contexts
- Occurs at context creation, not at execution time

### Gate 3: Execution Layer Final Gate

**Location:** Execution handler (before any trade)

```typescript
export async function executeDecision(decision: AgentDecision, ctx: DecisionContext) {
  // FINAL VERIFICATION
  assertExecutionAllowed(ctx);  // Throws if:
                                 // - mode !== 'LIVE'
                                 // - allowTrade !== true
                                 // - confidence < MIN
                                 // - data is stale

  // NOW we can execute
  await exchange.placeOrder(...);
}
```

**What it does:**
- Final safety check before touching exchange APIs
- Impossible to bypass without editing code
- Comprehensive: checks mode, permissions, quality, freshness

---

## Time-Authority Invariants (Comprehensive List)

All defined in `client/src/lib/timeAuthorityInvariants.ts`:

| Invariant | Rule | Consequence |
|-----------|------|-------------|
| **ReplayNotLiveSource** | If mode=REPLAY, source ≠ WS | Throws immediately |
| **ContextModeMatchesFrame** | ctx.mode === frame.meta.mode | Throws immediately |
| **ReplayCannotTrade** | If mode=REPLAY, allowTrade=false | Throws if violated |
| **LiveTradeAuthority** | If mode=LIVE, allowTrade ⟺ confidence > MIN | Throws if violated |
| **UITickValid** | If mode=REPLAY and source=WS, invalid | Throws immediately |
| **AgentCanTrade** | If mode=REPLAY, agent returns null | Enforced in agent |
| **ExecutionAllowed** | mode=LIVE AND allowTrade=true AND confidence>MIN AND !isStale | Throws before execution |

---

## Visual Enforcement (UI Layer)

Replay must be **visually unmissable**:

### Banner
```typescript
{mode === 'REPLAY' && (
  <div className="replay-mode-banner">
    ⏪ REPLAY MODE — TRADING DISABLED
  </div>
)}
```

### Visual Changes
```typescript
{mode === 'REPLAY' && (
  <div className="replay-mode-desaturated">
    {/* Charts, prices, signals all desaturated/blue */}
    {/* No green/red trade colors */}
    {/* No "LIVE" labels */}
  </div>
)}
```

### Watermark
```typescript
{mode === 'REPLAY' && (
  <div className="replay-watermark">
    ⏪ REPLAY
  </div>
)}
```

### Playback Controls
```typescript
{mode === 'REPLAY' && (
  <div className="replay-controls">
    <input type="range" /> {/* Time scrubber */}
    <button>Play/Pause</button>
    <button>Speed</button>
  </div>
)}
```

---

## Blast Radius After This Fix

| Failure Mode | Before | After |
|---|---|---|
| Replay looks live | ❌ Possible | ✅ Impossible |
| Agent trades on replay | ❌ Possible | ✅ Blocked by gate 1 |
| Constraints ignored | ❌ Possible | ✅ Blocked by gate 2 |
| Execution without checks | ❌ Possible | ✅ Blocked by gate 3 |
| UI ambiguity | ❌ Subtle | ✅ Explicit banner |
| Human misclick | ❌ Costly | ✅ Harmless (no trading allowed) |

---

## Testing Time-Authority

### Test: Replay context must not allow trading

```typescript
describe('Time Authority', () => {
  it('replay context always has allowTrade=false', () => {
    const frame = buildMarketFrame(..., { mode: 'REPLAY', source: 'REPLAY_API' });
    const ctx = buildDecisionContext(frame, signals, { allowTrade: true });
    
    expect(ctx.constraints.allowTrade).toBe(false);
    expect(ctx.constraints.reason).toBe('replay_mode_trading_disabled');
  });

  it('agent returns null in replay mode', () => {
    const ctx = { mode: 'REPLAY', ... };
    const decision = myAgent(ctx);
    
    expect(decision).toBeNull();
  });

  it('execution layer blocks replay', () => {
    const ctx = { mode: 'REPLAY', constraints: { allowTrade: false }, ... };
    
    expect(() => assertExecutionAllowed(ctx)).toThrow('mode is REPLAY');
  });

  it('replay and WS source together is invalid', () => {
    const tick = createUITick(..., { mode: 'REPLAY', source: 'WS' });
    
    expect(() => assertUITickValid(tick)).toThrow('Invalid UITick');
  });
});
```

---

## Deployment Checklist

- [ ] MarketFrame carries mode and source
- [ ] DecisionContext inherits mode from frame
- [ ] DecisionContext enforces allowTrade = (mode='LIVE') && (confidence > MIN)
- [ ] All agents check `if (ctx.mode === 'REPLAY') return null;`
- [ ] Execution handler calls `assertExecutionAllowed(ctx)`
- [ ] UITick carries mode and source
- [ ] UI shows prominent REPLAY banner in replay mode
- [ ] UI desaturates/watermarks replay data
- [ ] Tests verify replay cannot trade
- [ ] Tests verify UI clearly indicates mode

---

## One-Liner to Burn Into Code

> **Replay data may flow everywhere — but it may never acquire execution authority.**

This is the entire philosophy. Every guard, every invariant, every check traces back to this sentence.

You're not just separating data. You're separating **time authority**. Most systems never reach this level of rigor.

You have. 🎯

