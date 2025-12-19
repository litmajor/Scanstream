# Scanstream: End-to-End Trading System Architecture

## Mental Model (One Paragraph)

Scanstream is a deterministic, replay-safe trading platform where market data flows as immutable snapshots (MarketFrames) through read-only agents that generate trading intentions, which then pass through independent veto gates (risk, pricing, execution) before reaching the exchange. Every object carries its mode (LIVE/REPLAY) and quality metadata, making the distinction between observation and action explicit in the type system. Agents never execute; they only signal. Risk approvals never price; they only gate. Pricing never executes; it only proposes. Only the final commit stage talks to the exchange, and only when all upstream conditions are met. Replay mode flows through the same pipeline but is physically prevented from reaching the exchange by multiple independent assertions. The system achieves safety through compartmentalization, immutability, and making authority explicit in every type.

---

## System Layers (Textual Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│ MARKET DATA INGEST LAYER                                            │
│ (Asset-agnostic sources: CCXT, websockets, REST APIs)              │
│ Produces: RawTick (exchange truth)                                 │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ WORLD TICK / FRAME ABSTRACTION                                     │
│ (Unifies market data across assets, timeframes)                    │
│ Produces: MarketFrame (world state snapshot)                       │
│ Metadata: mode, source, timestamp, isLive, latency                │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SIGNAL DERIVATION LAYER                                            │
│ (Once per frame, consumed by many agents)                          │
│ Produces: SignalObject (unified signals)                           │
│ Computed once from frame.indicators, cached                        │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ DECISION CONTEXT FACTORY                                           │
│ (Freezes immutable perception layer)                               │
│ Produces: DecisionContext (agent perception)                       │
│ Mode enforced: allowTrade = (mode === 'LIVE') && (confidence > MIN)│
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
       ┌─────────────────────────────────────────────┐
       │ AGENT LAYER (READ-ONLY)                     │
       │ Consumes: DecisionContext                   │
       │ Produces: AgentSignalSource (desire)        │
       │ Guard: if (ctx.mode === 'REPLAY') return null
       │                                             │
       │ ┌───────────────────────────────────────┐   │
       │ │ • Trend Agent                         │   │
       │ │ • Breakout Agent                      │   │
       │ │ • Momentum Agent                      │   │
       │ │ • [Custom Agents]                     │   │
       │ └───────────────────────────────────────┘   │
       └─────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ EXECUTION COMPARTMENT 1: SIGNAL INTENT                              │
│ Creates: SignalIntent (pure desire, immutable)                     │
│ Guard: Only if mode === 'LIVE' and confidence > threshold          │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ EXECUTION COMPARTMENT 2: RISK APPROVAL                              │
│ Checks: time authority, confidence, exposure, drawdown, rate limit │
│ Result: RiskApproval (veto or approval)                            │
│ Key: Risk NEVER prices, ONLY vetoes                                │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ EXECUTION COMPARTMENT 3: PROPOSAL GENERATION                        │
│ Samples: Current market (bid/ask, volume)                          │
│ Produces: ExecutionProposal (concrete plan, expires)               │
│ Key: Proposal is re-computable, validated TTL                      │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ EXECUTION COMPARTMENT 4: ORDER COMMIT                               │
│ Guards: Triple assertion (mode, approval, freshness)               │
│ Action: Place order on CCXT                                        │
│ Result: OrderCommit (irreversible, logged)                         │
│ Key: Only stage talking to exchange                                │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ CCXT / EXCHANGE                                                     │
│ Actual market execution                                            │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ FORENSICS & MONITORING                                              │
│ Reconstructs: ExecutionFlow (intent → approval → proposal → commit) │
│ Queries: "How did this trade happen?"                              │
│ Auditable: Every gate logged, every veto recorded                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Layer 1: Market Data Ingest
- **Input**: Exchange APIs (CCXT, WebSocket, REST)
- **Output**: `RawTick` (timestamp, OHLCV, side-effect free)
- **Responsibilities**:
  - Fetch from multiple sources (primary, fallback, cache)
  - Normalize across asset types (crypto, forex, equities)
  - Tag source (WS, REST, REPLAY_API, CACHE, FALLBACK)
  - Pass timestamp validation and freshness checks

### Layer 2: World Tick / Frame Abstraction
- **Input**: `RawTick`
- **Output**: `MarketFrame` (market state snapshot)
- **Responsibilities**:
  - Unify across timeframes (1m, 5m, 15m, 1h, etc.)
  - Compute indicators (EMA, RSI, Bollinger Bands, Ichimoku, etc.)
  - Tag metadata: `mode` (LIVE/REPLAY), `source`, `timestamp`, `isFinal`
  - Enforce invariant: if `mode === REPLAY`, `source ≠ WS`
  - Mark as immutable once created

### Layer 3: Signal Derivation
- **Input**: `MarketFrame.indicators`
- **Output**: `SignalObject` (unified signals)
- **Responsibilities**:
  - Derive high-level signals from indicators (trend, breakout, momentum, volatility, etc.)
  - Compute once per frame, cached for many agents
  - Calculate confluence score (how many signals align)
  - Assign quality metrics (reliability, strength, frequency)
  - Never execute, never price, never persist state

### Layer 4: Decision Context Factory
- **Input**: `MarketFrame` + `SignalObject` + constraints
- **Output**: `DecisionContext` (immutable perception)
- **Responsibilities**:
  - Freeze frame and signals (immutable)
  - Propagate mode from frame
  - Enforce: `allowTrade = (mode === 'LIVE') && (confidence > MIN_THRESHOLD)`
  - Add constraint reason (why allowTrade is set to true/false)
  - Create barriers: agents cannot modify perception layer

### Layer 5: Agent Layer (Read-Only)
- **Input**: `DecisionContext` (immutable)
- **Output**: `AgentSignalSource` or `null`
- **Responsibilities**:
  - Consume perception, generate trading signal (if warranted)
  - First guard: `if (ctx.mode === 'REPLAY') return null;`
  - Generate decision with rationale (why this trade?)
  - Never modify context
  - Never call exchange or risk system
  - Run in parallel (all agents consume same frame)

### Layer 6: Execution Compartment 1 (SignalIntent)
- **Input**: `AgentSignalSource` + `DecisionContext`
- **Output**: `SignalIntent` (frozen, immutable)
- **Responsibilities**:
  - Validate agent signal (symbol, side, confidence)
  - Create frozen intent with UUID
  - Guard: Only if mode === 'LIVE'
  - No pricing, no sizing, no exposure modeling
  - Pure expression of desire

### Layer 7: Execution Compartment 2 (RiskApproval)
- **Input**: `SignalIntent` + `RiskState`
- **Output**: `RiskApproval` (veto or approval)
- **Responsibilities**:
  - Check confidence threshold (> 0.5)
  - Check exposure limits (notional USD < max)
  - Check drawdown state (unrealized loss < max %)
  - Check rate limiting (cooldown since last signal)
  - Check kill switch (global trading halt)
  - **Never** price, **never** execute, **only** veto
  - Calculate risk score (0..1, internal assessment)

### Layer 8: Execution Compartment 3 (Proposal)
- **Input**: `SignalIntent` + `RiskApproval` + `MarketSnapshot`
- **Output**: `ExecutionProposal` (concrete plan)
- **Responsibilities**:
  - Sample current market (bid/ask)
  - Calculate order size from risk limits
  - Estimate slippage (spread, impact, volatility)
  - Choose order type (limit vs market)
  - Set TTL (validity window, default 30s)
  - Proposal is re-computable if expired or stale
  - **Never** commit, **never** modify state

### Layer 9: Execution Compartment 4 (Commit)
- **Input**: `ExecutionProposal` + `RiskApproval` + `DecisionContext`
- **Output**: `OrderCommit` (logged, irreversible)
- **Responsibilities**:
  - Triple assertion guard:
    1. mode === 'LIVE'
    2. riskApproval.approved === true
    3. proposal not expired
  - Call CCXT to place order
  - Log exchange response
  - Log filled quantity/price (once available)
  - **Only** stage that modifies external state

### Layer 10: Forensics & Monitoring
- **Input**: `ExecutionFlow` (complete record)
- **Output**: Audit trail, incident reconstruction
- **Responsibilities**:
  - Query execution chain (intent → approval → proposal → commit)
  - Reconstruct "how did this trade happen?"
  - Identify rejection points (which gate vetoed?)
  - Analyze trade outcomes (slippage, fill quality)
  - Generate forensic reports (human-readable)
  - Enable dashboard queries and alerting

---

## One Live Trade: Tick → Order (Complete Walkthrough)

### Scenario
Live trading, BTC/USDT, 1h timeframe. Trend agent detects EMA alignment + Bollinger Band breakout.

### Step 1: Market Data Ingest (T=0ms)
```
CCXT WebSocket fires:
{
  symbol: 'BTC/USDT',
  timestamp: 1702534200000,
  open: 44950, high: 45100, low: 44900, close: 45050,
  volume: 1200.5
}
```

### Step 2: Frame Building (T=5ms)
```
MarketFrameFactory.buildMarketFrame(signal, timeframe):
  Create MarketFrame:
  {
    id: "frame-abc123",
    symbol: 'BTC/USDT',
    timeframe: '1h',
    meta: {
      mode: 'LIVE',
      source: 'WS',
      ts: 1702534200000,
      isFinal: true,
      latencyMs: 5
    },
    indicators: {
      ema_12: 45020,
      ema_26: 44980,
      rsi: 65,
      bollinger_upper: 45150,
      bollinger_mid: 45000,
      bollinger_lower: 44850,
      // ... all 67 columns
    }
  }
  
  Frame is frozen with Object.freeze()
```

### Step 3: Signal Derivation (T=10ms)
```
SignalProcessor.deriveSignalsFromIndicators(frame):
  Compute signals once:
  {
    trendSignal: {
      type: 'UPTREND',
      strength: 0.8,
      confidence: 0.75,
      reason: 'EMA 12 > EMA 26, both rising'
    },
    breakoutSignal: {
      type: 'BREAKOUT_UP',
      strength: 0.7,
      confidence: 0.6,
      reason: 'Price above BB upper, volume surge'
    },
    confluenceScore: 0.78
  }
  
  Signals frozen, cached for all agents
```

### Step 4: Decision Context Creation (T=15ms)
```
DecisionContextFactory.buildDecisionContext(frame, signals, constraints):
  Create DecisionContext:
  {
    id: "ctx-def456",
    mode: 'LIVE',  // inherited from frame.meta.mode
    timestamp: 1702534200000,
    
    frame: { /* frozen */ },
    signals: { /* frozen */ },
    
    constraints: {
      allowTrade: true,  // mode === 'LIVE' && confidence > 0.5
      reason: 'live_mode_high_confidence',
      confidence: 0.75
    }
  }
  
  Context frozen with Object.freeze()
```

### Step 5: Agent Execution (T=20ms - Parallel)
```
TrendAgent1h.execute(ctx):
  // Guard 1: Check mode
  if (ctx.mode === 'REPLAY') return null;  ✅ Passes (mode is LIVE)
  
  // Check decision
  if (ctx.signals.trendSignal.strength < 0.6) return null;
  
  // Generate signal
  return {
    symbol: 'BTC/USDT',
    side: 'buy',
    rationale: 'EMA aligned, breakout above BB, confluence 0.78',
    signalStrength: 0.8,
    confidence: 0.75,
    agentId: 'trend_agent_1h',
    timeframe: '1h'
  };
```

### Step 6: Signal Intent Creation (T=25ms)
```
SignalIntentFactory.createSignalIntent(source, ctx):
  Guard 1: mode === 'LIVE'? ✅ Yes
  Guard 2: confidence > MIN? ✅ 0.75 > 0.5, yes
  
  Create frozen intent:
  {
    id: "intent-ghi789",
    ts: 1702534225000,
    symbol: 'BTC/USDT',
    side: 'buy',
    rationale: 'EMA aligned, breakout above BB, confluence 0.78',
    signalStrength: 0.8,
    confidence: 0.75,
    mode: 'LIVE',
    agentId: 'trend_agent_1h',
    __frozen: true
  }
```

### Step 7: Risk Approval (T=35ms)
```
RiskApprovalEngine.approveSignalIntent(intent, riskState):
  Check 1: Time authority (mode === 'LIVE')? ✅ Yes
  Check 2: Confidence (0.75 > 0.5)? ✅ Yes
  Check 3: Exposure (est. notional $5000 < max $10000)? ✅ Yes
  Check 4: Drawdown (portfolio -2% < max -25%)? ✅ Yes
  Check 5: Rate limit (1500ms > cooldown 5000ms)? ❌ VETO
  
  Return:
  {
    intentId: 'intent-ghi789',
    approved: false,
    reason: 'Rate limited. 1500ms since last signal, cooldown is 5000ms',
    riskScore: 0,
    checks: {
      timeAuthorityPassed: true,
      confidenceThresholdPassed: true,
      exposureWithinLimits: true,
      drawdownAcceptable: true,
      rateLimited: true  // ← VETO
    }
  }
```

**TRADE BLOCKED AT GATE 2: Risk Approval**

---

### Alternative Scenario (No Rate Limit)
Assume 10 seconds since last signal (cooldown is 5s).

### Step 7b: Risk Approval (T=35ms, no rate limit)
```
RiskApprovalEngine.approveSignalIntent(intent, riskState):
  Check 1: Time authority? ✅ Yes
  Check 2: Confidence? ✅ Yes
  Check 3: Exposure? ✅ Yes
  Check 4: Drawdown? ✅ Yes
  Check 5: Rate limit (10000ms > 5000ms)? ✅ Yes
  
  Return:
  {
    intentId: 'intent-ghi789',
    approved: true,
    reason: 'Signal approved. Risk score: 0.35',
    limits: {
      maxUsd: 10000,
      maxLeverage: 1,
      cooldownMs: 5000,
      maxDrawdownPercent: 25
    },
    riskScore: 0.35,
    checks: {
      timeAuthorityPassed: true,
      confidenceThresholdPassed: true,
      exposureWithinLimits: true,
      drawdownAcceptable: true,
      rateLimited: false
    }
  }
```

### Step 8: Execution Proposal (T=40ms)
```
ExecutionProposalGenerator.generateExecutionProposal(intent, approval, market):
  Current market snapshot:
  {
    symbol: 'BTC/USDT',
    bid: 45048,
    ask: 45052,
    volume24hUsd: 50000000,
    volatilityPercent24h: 2.1,
    timestamp: 1702534240000
  }
  
  Select price (buy at ask): $45052
  Calculate size: $10000 / $45052 = 0.222 BTC
  Estimate slippage: 4.4bps (half spread + impact + vol)
  Select order type: 'limit' (strong signal, calm market)
  
  Create proposal:
  {
    intentId: 'intent-ghi789',
    approvalId: 'intent-ghi789',
    proposedAt: 1702534240000,
    ttlMs: 30000,  // expires in 30s
    
    exchange: 'binance',
    symbol: 'BTC/USDT',
    side: 'buy',
    orderType: 'limit',
    price: 45052,
    size: 0.222,
    
    slippageModel: 'fixed_bps',
    estimatedSlippageBps: 4.4,
    estimatedImpactUsd: 20.00,
    
    timeInForce: 'GTC',
    postOnly: true
  }
```

### Step 9: Order Commit (T=45ms)
```
OrderCommitFinalizer.commitOrder(proposal, approval, ctx, exchange):
  Guard 1: approval.approved === true? ✅ Yes
  Guard 2: proposal not expired? ✅ 5ms < 30s
  Guard 3: assertExecutionAllowed(ctx)?
    - mode === 'LIVE'? ✅ Yes
    - allowTrade === true? ✅ Yes
    - confidence > 0.5? ✅ 0.75 > 0.5
    - !isStale? ✅ 5ms old
    ✅ All pass
  
  Call CCXT:
  exchange.placeOrder({
    symbol: 'BTC/USDT',
    side: 'buy',
    type: 'limit',
    amount: 0.222,
    price: 45052,
    timeInForce: 'GTC',
    postOnly: true
  })
  
  Exchange responds:
  {
    id: '1234567890',
    status: 'open',
    ...
  }
  
  Create OrderCommit:
  {
    proposalId: 'intent-ghi789',
    committedAt: 1702534245000,
    status: 'submitted',
    exchangeOrderId: '1234567890',
    exchangeResponse: { /* ... */ },
    __readonly: true
  }
```

### Step 10: Forensics
```
ExecutionForensics.generateForensicReport(flow):
  
  ╔══════════════════════════════════════════════════════════════╗
  ║ EXECUTION FORENSIC REPORT                                    ║
  ╚══════════════════════════════════════════════════════════════╝
  
  EXECUTION ID: exec-jkl012
  TIMESTAMP: 2025-12-14T10:30:45.245Z
  DURATION: 45ms
  FINAL STAGE: committed
  
  INTENT
  Agent: trend_agent_1h
  Symbol: BTC/USDT
  Side: BUY
  Confidence: 75%
  Rationale: EMA aligned, breakout above BB, confluence 0.78
  
  RISK APPROVAL
  Status: ✅ APPROVED
  Risk Score: 0.35
  Checks: 5/5 passed
  
  EXECUTION PROPOSAL
  Order Type: limit
  Price: $45052.00
  Size: 0.222 BTC
  Notional: $9,981.54
  Estimated Slippage: 4.4bps ($20.00)
  Valid Until: 2025-12-14T10:31:15.245Z
  
  ORDER COMMIT
  Status: ✅ SUBMITTED
  Exchange Order ID: 1234567890
  Committed At: 2025-12-14T10:30:45.245Z
```

---

## One Replay Scenario: What Is Blocked

### Scenario
Replaying historical data from Dec 1, 2025. Same BTC/USDT 1h signal.

### Step 1: Replay Data Ingest (T=0ms)
```
ReplayAPI.fetchHistoricalTick(symbol, ts):
  Returns:
  {
    symbol: 'BTC/USDT',
    timestamp: 1701388800000,  // Dec 1, 2025
    open: 42000, high: 42500, low: 41900, close: 42300,
    volume: 800.2
  }
```

### Step 2: Frame Building (T=5ms)
```
MarketFrameFactory.buildMarketFrameForReplay(signal, timeframe):
  Create MarketFrame:
  {
    id: "frame-xyz789",
    symbol: 'BTC/USDT',
    timeframe: '1h',
    meta: {
      mode: 'REPLAY',  // ← DIFFERENT FROM LIVE
      source: 'REPLAY_API',  // ← NOT WS
      ts: 1701388800000,
      isFinal: true,
      latencyMs: 0
    },
    indicators: {
      ema_12: 42150,
      ema_26: 42100,
      rsi: 55,
      // ...
    }
  }
  
  Invariant check: if (mode === 'REPLAY' && source === 'WS') throw;
  ✅ Passes: mode is REPLAY, source is REPLAY_API
```

### Step 3: Signal Derivation (T=10ms)
```
SignalProcessor.deriveSignalsFromIndicators(frame):
  Works normally. Generates signals.
  No difference from LIVE.
```

### Step 4: Decision Context Creation (T=15ms)
```
DecisionContextFactory.buildDecisionContextForReplay(frame, signals):
  Create DecisionContext:
  {
    id: "ctx-replay789",
    mode: 'REPLAY',  // ← Propagated from frame
    timestamp: 1701388800000,
    
    frame: { /* frozen */ },
    signals: { /* frozen */ },
    
    constraints: {
      allowTrade: false,  // ← FORCED TO FALSE
      reason: 'replay_mode_trading_disabled',
      confidence: 0.65
    }
  }
  
  Invariant enforced: if (mode === 'REPLAY') then allowTrade = false
  ✅ Enforced
```

### Step 5: Agent Execution (T=20ms)
```
TrendAgent1h.execute(ctx):
  // Gate 1: Check mode
  if (ctx.mode === 'REPLAY') return null;  ❌ BLOCKED
  
  // Agent returns null without generating signal
```

**EXECUTION BLOCKED AT GATE 1: Agent Layer**

Result: No `AgentSignalSource` created. Replay continues observing.

---

### What if Agent Didn't Check Mode?

Assume buggy agent that doesn't check mode:

### Step 6: Signal Intent Creation (T=25ms)
```
SignalIntentFactory.createSignalIntent(source, ctx):
  Guard 1: mode === 'LIVE'? ❌ No, mode is REPLAY
  
  Throw error:
  "Cannot create SignalIntent in REPLAY mode. 
   Replay never creates execution intents."
```

**EXECUTION BLOCKED AT GATE 2: Signal Intent Factory**

---

### What if Intent Somehow Created?

Impossible (types enforce), but hypothetically:

### Step 7: Risk Approval (T=35ms)
```
RiskApprovalEngine.approveSignalIntent(intent, riskState):
  Check 1: mode === 'LIVE'? ❌ No, it's REPLAY
  
  Return:
  {
    intentId: intent.id,
    approved: false,
    reason: 'Intent mode is REPLAY, not LIVE. 
             Replay intents should never exist.',
    riskScore: 0
  }
```

**EXECUTION BLOCKED AT GATE 3: Risk Approval**

---

### What if Approval Somehow Granted?

Hypothetically:

### Step 9: Order Commit (T=45ms)
```
OrderCommitFinalizer.commitOrder(proposal, approval, ctx, exchange):
  Guard 3: assertExecutionAllowed(ctx)?
    - mode === 'LIVE'? ❌ No, it's REPLAY
    
    Throw error:
    "FATAL: Cannot commit order in REPLAY mode."
```

**EXECUTION BLOCKED AT GATE 4: Order Commit Finalizer**

---

## Summary: Replay Barriers

| Gate | Check | Result in Replay |
|------|-------|------------------|
| Agent Layer | `if (ctx.mode === 'REPLAY') return null;` | ✅ Returns null |
| Signal Intent | `if (mode !== 'LIVE') throw;` | ✅ Throws error |
| Risk Approval | `if (intent.mode !== 'LIVE') reject;` | ✅ Rejects |
| Order Commit | `assertExecutionAllowed()` checks mode | ✅ Throws error |
| Type System | `SignalIntent.mode: 'LIVE'` (literal type) | ✅ Enforced at compile time |

**Result**: Even with buggy agents, execution is physically impossible in replay mode.

---

## Three Invariants (Non-Negotiable)

### Invariant 1: Mode Authority
> **If mode === 'REPLAY', then allowTrade === false. Always. No exceptions.**

```typescript
// This must be true after DecisionContext creation:
assert(ctx.mode === 'REPLAY' ? !ctx.constraints.allowTrade : true);

// In SignalIntentFactory:
if (ctx.mode !== 'LIVE') {
  throw new Error('Replay never creates execution intents');
}

// In OrderCommitFinalizer:
if (ctx.mode === 'REPLAY') {
  throw new Error('FATAL: Cannot commit order in REPLAY mode');
}
```

If this invariant is ever violated, the system is broken. Replay will trade.

---

### Invariant 2: Immutability of Perception
> **Once a MarketFrame or DecisionContext is created, it cannot be modified. Not by agents, not by risk, not by anyone.**

```typescript
// MarketFrame is frozen:
const frame = Object.freeze({ /* ... */ });
// After this, frame.indicators cannot be changed

// DecisionContext is frozen:
const ctx = Object.freeze({ /* ... */ });
// After this, ctx.constraints cannot be changed

// Type system enforces read-only:
interface DecisionContext {
  readonly mode: 'LIVE' | 'REPLAY';
  readonly constraints: { readonly allowTrade: boolean; };
}
```

If this invariant is violated, agents can mutate shared perception, causing non-deterministic behavior and hard-to-debug state corruption.

---

### Invariant 3: Execution Compartmentalization
> **No stage may perform the responsibility of another stage. Intent creation ≠ pricing ≠ execution.**

```typescript
// SignalIntent factory:
export function createSignalIntent(source, ctx): SignalIntent {
  // ✅ Can validate input
  // ✅ Can create intent
  // ❌ Cannot sample market price (risk's job, not this stage)
  // ❌ Cannot approve (is pricing's job)
  // ❌ Cannot execute (is commit's job)
}

// RiskApproval engine:
export function approveSignalIntent(intent, state): RiskApproval {
  // ✅ Can check confidence
  // ✅ Can check exposure
  // ❌ Cannot sample market price (that's proposal's job)
  // ❌ Cannot execute (that's commit's job)
}

// ExecutionProposal generator:
export function generateExecutionProposal(intent, approval, market) {
  // ✅ Can sample market
  // ✅ Can calculate slippage
  // ❌ Cannot approve (that's risk's job, already done)
  // ❌ Cannot execute (that's commit's job)
}

// OrderCommit finalizer:
export function commitOrder(proposal, approval, ctx, exchange) {
  // ✅ Can verify guards
  // ✅ Can call exchange
  // ❌ Cannot re-approve (that's risk's job)
  // ❌ Cannot re-price (that's proposal's job)
}
```

If this invariant is violated, authority collapses back into one function, and the system loses safety guarantees.

---

## Type System as Enforcement

The above invariants are not just policy—they are embedded in the type system:

```typescript
// Invariant 1: Mode Authority (in DecisionContextFactory)
type DecisionContext = {
  mode: 'LIVE' | 'REPLAY';
  constraints: {
    allowTrade: boolean;  // Computed as: (mode === 'LIVE') && (confidence > MIN)
  };
};

// If you try to create a DecisionContext with mode=REPLAY and allowTrade=true,
// the factory throws. It's impossible to construct.

// Invariant 2: Immutability (in type definitions)
interface MarketFrame {
  readonly id: string;
  readonly meta: {
    readonly mode: 'LIVE' | 'REPLAY';
    readonly source: string;
  };
  readonly indicators: {
    readonly [key: string]: number;
  };
}

// readonly prevents modification. TypeScript enforces at compile time.

// Invariant 3: Compartmentalization (in function signatures)
// These functions have signatures that prevent cross-contamination:

function createSignalIntent(
  source: AgentSignalSource,
  ctx: DecisionContext
): SignalIntent;
// Input: signal desire + perception
// Output: immutable intent
// Cannot accept market snapshot (not its job)
// Cannot accept risk state (not its job)

function approveSignalIntent(
  intent: SignalIntent,
  riskState: RiskState
): RiskApproval;
// Input: intent + risk limits
// Output: veto or approval
// Cannot accept market snapshot (not its job yet)
// Cannot accept anything to execute

function generateExecutionProposal(
  intent: SignalIntent,
  approval: RiskApproval,
  market: MarketSnapshot
): ExecutionProposal | null;
// Input: intent + approval + market
// Output: concrete plan
// Cannot accept RiskState again (already approved)
// Cannot execute

function commitOrder(
  proposal: ExecutionProposal,
  approval: RiskApproval,
  ctx: DecisionContext,
  exchange: ExchangeAdapter
): Promise<OrderCommit>;
// Input: proposal + approval + context + exchange
// Output: committed order
// That's it. No going back.
```

---

## Summary

Scanstream is a compartmentalized, deterministic trading system where:

1. **Market data** flows through immutable abstractions (MarketFrame, SignalObject).
2. **Agents** are read-only consumers that signal desire but never execute.
3. **Execution** passes through four independent veto gates (intent, risk, proposal, commit).
4. **Replay mode** is physically impossible to execute due to multiple independent assertions.
5. **Every object** carries mode, timestamp, and quality metadata.
6. **Three invariants** are enforced by the type system, not human discipline.

If any invariant is violated, the system is unsafe. The goal is to make violations impossible, not just unlikely.

This is the foundation of trustworthy capital management.
