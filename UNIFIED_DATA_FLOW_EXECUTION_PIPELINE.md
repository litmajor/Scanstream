# Data Flow: Unified Market Feed → All Agents → Execution Pipeline

## Single Source of Truth Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ UNIFIED MARKET DATA SOURCE                                   │
│ (MarketDataLayer + IntegrityGate)                           │
│                                                              │
│ • CCXT WebSocket (live)                                     │
│ • REST API fallback                                         │
│ • Cache layer                                               │
│ • Replay API (historical)                                   │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ WORLD TICK                                                   │
│ (Validated, immutable snapshot)                             │
│                                                              │
│ {                                                            │
│   symbol: 'BTC/USDT',                                       │
│   timeframe: '1h',                                           │
│   candle: { open, high, low, close, volume },              │
│   timestamp: 1702534200000,                                │
│   mode: 'LIVE' | 'REPLAY',                                 │
│   source: 'WS' | 'REPLAY_API' | 'CACHE' | 'FALLBACK',      │
│   isFinal: true                                            │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ MARKET FRAME (67-column indicator computation)              │
│                                                              │
│ • EMA 12, EMA 26                                            │
│ • RSI, Stochastic                                           │
│ • Bollinger Bands                                           │
│ • Ichimoku Cloud                                            │
│ • ATR, Volume Profile                                       │
│ • ADX, MACD                                                 │
│ • [all 67 CCXT scanner columns]                            │
│                                                              │
│ mode: 'LIVE' | 'REPLAY' (propagated)                       │
│ source: (propagated)                                        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ SIGNAL OBJECT (once per frame, cached)                      │
│                                                              │
│ • Trend Signal (EMA alignment, direction, strength)         │
│ • Breakout Signal (price action vs bands)                   │
│ • Momentum Signal (RSI, Stochastic)                         │
│ • Volatility Signal (ATR, Bollinger width)                  │
│ • Volume Profile Signal                                     │
│ • Mean Reversion Signal                                     │
│ • Ichimoku Status                                           │
│ • Confluence Score (how many signals align)                 │
│                                                              │
│ Computed ONCE, used by MANY agents                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ DECISION CONTEXT (immutable perception layer)               │
│                                                              │
│ • frame (MarketFrame, frozen)                              │
│ • signals (SignalObject, frozen)                           │
│ • mode: 'LIVE' | 'REPLAY'                                  │
│ • allowTrade: boolean                                       │
│   = (mode === 'LIVE') && (confidence > 0.5)               │
│                                                              │
│ Entire context frozen with Object.freeze()                 │
└──────────────────────────────────────────────────────────────┘
                    ↓ (BROADCAST TO ALL AGENTS)
        ┌───────────┼───────────┬───────────┬────────────┐
        ↓           ↓           ↓           ↓            ↓
    ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────┐ ┌─────────┐
    │BREAKOUT│ │REVERSAL│ │ML AGENT │ │TREND │ │SUPPORT  │
    │AGENT   │ │AGENT   │ │(RPG)    │ │AGENT │ │AGENT    │
    └────────┘ └────────┘ └─────────┘ └──────┘ └─────────┘
        ↓           ↓           ↓           ↓            ↓
    ALL AGENTS RECEIVE SAME DATA (MarketFrame + Signals)
    ALL AGENTS ARE READ-ONLY (cannot modify context)
    ALL AGENTS GENERATE AGENTSIGNALSOURCE (or null)
        ↓           ↓           ↓           ↓            ↓
        └───────────┼───────────┴───────────┴────────────┘
                    ↓
    ┌───────────────────────────────────────────────────────┐
    │ AGENT SIGNALS CONVERGE                                │
    │                                                       │
    │ • BreakoutAgent: "BUY, confidence 0.8"              │
    │ • TrendAgent: "BUY, confidence 0.75"                │
    │ • MLAgent: "BUY, confidence 0.82"                   │
    │ • ReversalAgent: null (no signal)                    │
    │ • SupportAgent: null (no signal)                     │
    │                                                       │
    │ Each agent independently analyzes SAME DATA          │
    │ Each agent independently decides to signal or not    │
    └───────────────────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────────────────────────┐
    │ CONSENSUS / FILTERING (Optional RPG Layer)           │
    │                                                       │
    │ • Count approving agents                             │
    │ • Weight by agent level/experience                   │
    │ • Check for combo patterns                           │
    │ • Calculate aggregate confidence                     │
    │                                                       │
    │ Result: Composite signal or individual signals       │
    └───────────────────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────────────────────────┐
    │ EXECUTION PIPELINE (NEW SAFETY LAYER)                │
    │                                                       │
    │ Stage 1: SignalIntent (frozen)                      │
    │ Stage 2: RiskApproval (veto check)                  │
    │ Stage 3: ExecutionProposal (market-aware plan)      │
    │ Stage 4: OrderCommit (place order + log)            │
    │                                                       │
    │ If ANY stage rejects → no trade, no error           │
    │ If ALL stages pass → order placed, logged            │
    └───────────────────────────────────────────────────────┘
                    ↓
    ┌───────────────────────────────────────────────────────┐
    │ CCXT EXCHANGE                                         │
    │                                                       │
    │ Actual trade execution                               │
    └───────────────────────────────────────────────────────┘
```

---

## Key Points: Keep This Architecture

### ✅ ONE unified market feed
- **Source**: MarketDataLayer (handles CCXT, fallback, cache)
- **Gate**: IntegrityGate (validates candles, emits world ticks)
- **Result**: All agents receive SAME data at SAME time

### ✅ ALL agents consume from ONE place
- **Breakout Agent** reads: frame.indicators + signals
- **Reversal Agent** reads: frame.indicators + signals
- **ML Agent** reads: frame.indicators + signals
- **Trend Agent** reads: frame.indicators + signals
- **Support Agent** reads: frame.indicators + signals
- **RL Agent** (if you have one) reads: frame.indicators + signals

### ✅ Signals are gateway events (what you're keeping)
- Agents **generate** signals on market data
- Signals are **independent per agent** (no coordination yet)
- Signals **feed into execution pipeline** (new layer)
- Execution pipeline **gates which signals become orders**

### ✅ Execution pipeline sits BETWEEN agents and CCXT
```
Agents generate signals → Execution gates check signals → CCXT places orders
```

This is **not** replacing your agent signals. It's **protecting them** with veto gates.

---

## Code: How This Works End-to-End

### 1. World Tick Arrives (Unified Source)
```typescript
// From MarketDataLayer → IntegrityGate
const worldTick: WorldTick = {
  symbol: 'BTC/USDT',
  timeframe: '1h',
  candle: { open: 44950, high: 45100, low: 44900, close: 45050, volume: 1200 },
  timestamp: 1702534200000,
  mode: 'LIVE',
  source: 'WS',
  isFinal: true
};

// Emitted to ALL subscribers
integrityGate.emit('world.tick', worldTick);
```

### 2. Market Frame Computed (Once)
```typescript
// From MarketFrameFactory
const frame: MarketFrame = {
  id: 'frame-abc123',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  meta: {
    mode: 'LIVE',
    source: 'WS',
    ts: 1702534200000,
    isFinal: true
  },
  indicators: {
    ema_12: 45020,
    ema_26: 44980,
    rsi: 65,
    // ... all 67 columns
  }
};

Object.freeze(frame);  // Immutable
```

### 3. Signals Computed (Once, Cached)
```typescript
// From SignalProcessor
const signals: SignalObject = {
  trendSignal: { type: 'UPTREND', strength: 0.8, confidence: 0.75 },
  breakoutSignal: { type: 'BREAKOUT_UP', strength: 0.7, confidence: 0.6 },
  confluenceScore: 0.78
  // ... all signals
};

Object.freeze(signals);  // Immutable
```

### 4. Decision Context Created (Frozen)
```typescript
// From DecisionContextFactory
const ctx: DecisionContext = {
  id: 'ctx-def456',
  mode: 'LIVE',
  timestamp: 1702534200000,
  frame: { /* frozen */ },
  signals: { /* frozen */ },
  constraints: {
    allowTrade: true,  // mode === 'LIVE' && confidence > 0.5
    reason: 'live_mode_high_confidence'
  }
};

Object.freeze(ctx);  // Entire context frozen
```

### 5. ALL Agents Consume SAME Context (Read-Only)
```typescript
// Breakout Agent
export class BreakoutAgent extends BaseAgent {
  async onWorldTick(tick: WorldTick) {
    // Gets the frozen context
    const signal = await this.generateSignal(ctx);
    if (signal) {
      // BUY, confidence 0.8
      return signal;
    }
  }
}

// Reversal Agent
export class ReversalAgent extends BaseAgent {
  async onWorldTick(tick: WorldTick) {
    // Gets THE SAME frozen context
    const signal = await this.generateSignal(ctx);
    if (signal) {
      // Maybe BUY, maybe null
      return signal;
    }
  }
}

// ML Agent
export class MLAgent extends BaseAgent {
  async onWorldTick(tick: WorldTick) {
    // Gets THE SAME frozen context
    const signal = await this.generateSignal(ctx);
    if (signal) {
      // BUY, confidence 0.82
      return signal;
    }
  }
}

// All agents cannot modify ctx
// ctx is frozen, immutable, read-only
```

### 6. Signals Collected (Agent-Independent)
```typescript
const agentSignals = [
  { agentId: 'breakout', symbol: 'BTC/USDT', side: 'buy', confidence: 0.8 },
  { agentId: 'trend', symbol: 'BTC/USDT', side: 'buy', confidence: 0.75 },
  { agentId: 'ml', symbol: 'BTC/USDT', side: 'buy', confidence: 0.82 },
  // reversal, support returned null (no signal)
];
```

### 7. Execution Pipeline (New Safety Layer)
```typescript
for (const signal of agentSignals) {
  // Stage 1: Create SignalIntent
  const intent = createSignalIntent(signal, ctx);
  
  // Stage 2: Risk Approval
  const approval = approveSignalIntent(intent, riskState);
  if (!approval.approved) {
    console.log(`Signal from ${signal.agentId} vetoed: ${approval.reason}`);
    continue;  // Skip this signal, try next
  }
  
  // Stage 3: Execution Proposal
  const proposal = generateExecutionProposal(intent, approval, market);
  if (!proposal) {
    console.log(`Proposal generation failed for ${signal.agentId}`);
    continue;
  }
  
  // Stage 4: Order Commit
  const commit = await commitOrder(proposal, approval, ctx, exchange);
  if (commit.status === 'submitted') {
    console.log(`Order from ${signal.agentId} placed: ${commit.exchangeOrderId}`);
  }
}
```

---

## What Stays the Same (Your RPG System)

✅ **Agents** still analyze market data independently
✅ **Signals** still generated per agent
✅ **Consensus** still computed if you want
✅ **Combos** still detected from agent agreements
✅ **Leveling** still happens based on trade results
✅ **XP** still awarded for good decisions

---

## What Changes (Execution Safety)

✅ **Before**: Agent signal → CCXT (direct)
✅ **After**: Agent signal → Intent → Risk → Proposal → Commit → CCXT

Each agent signal is now:
- **Gated** (risk approval checks it)
- **Priced** (proposal generates concrete plan)
- **Logged** (commit records what happened)
- **Auditable** (forensics reconstructs the chain)

---

## In Plain English

Your system is:

```
All Agents See The Same Market Data
         ↓
Each Agent Independently Says "BUY" or "Null"
         ↓
Those Signals Go Through Safety Gates
         ↓
Only Approved Signals Reach The Exchange
         ↓
Every Trade Is Logged
```

**You're not changing how agents work.**
**You're adding safety gates AFTER they signal.**

This is the right architecture.
