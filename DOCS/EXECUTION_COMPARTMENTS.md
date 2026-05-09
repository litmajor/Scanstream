# EXECUTION COMPARTMENTS: Four-Stage Pipeline Architecture

## 🎯 Core Principle

> **Money should only move after surviving multiple independent vetoes.**

When intent, risk, pricing, and commitment collapse into one call, failure becomes atomic.

Execution is not an action. Execution is a **process with checkpoints**.

---

## 📐 The Four Compartments

```
Agent
  ↓
┌─────────────────────────────────────────────┐
│ STAGE 1: SignalIntent                       │
│ What I want to do (pure desire)             │
│ - No price, no size, no exchange            │
│ - Only moves forward if Stage 2 approves    │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ STAGE 2: RiskApproval                       │
│ Am I allowed? (authority filter)            │
│ - Confidence, exposure, drawdown, rate limit│
│ - Most signals die here (that's the job)    │
│ - Risk NEVER prices, ONLY vetoes            │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ STAGE 3: ExecutionProposal                  │
│ How exactly? (concrete plan)                │
│ - Market price, order size, slippage        │
│ - Expires (TTL), recomputed on retry        │
│ - Purely mechanical                         │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│ STAGE 4: OrderCommit                        │
│ Do it now (final, irreversible)             │
│ - Only stage that talks to CCXT             │
│ - Triple assertion before calling exchange  │
│ - Logs for forensics                        │
└─────────────────────────────────────────────┘
  ↓
  CCXT / Exchange
```

---

## 1️⃣ STAGE 1: SignalIntent

**Files:**
- Type definition: `client/src/types/ExecutionCompartments.ts`
- Factory: `client/src/lib/factories/signalIntentFactory.ts`

### What It Is

Pure expression of trading desire. Created by agents only.

**Properties:**
- `id` — unique identifier
- `ts` — creation timestamp
- `symbol` — what to trade
- `side` — buy or sell
- `rationale` — why the agent wants this
- `signalStrength` — 0..1, from signal processor
- `confidence` — 0..1, quality of decision
- `mode` — always 'LIVE' (REPLAY never creates intents)
- `agentId` — which agent wants this

**What It Does NOT Have:**
- ❌ No price (market hasn't been sampled yet)
- ❌ No size (risk hasn't approved)
- ❌ No exchange (execution hasn't been proposed)
- ❌ No slippage assumptions

### Immutability

```typescript
const intent: SignalIntent = Object.freeze({
  id: uuidv4(),
  ts: Date.now(),
  symbol: 'BTC/USDT',
  side: 'buy',
  confidence: 0.85,
  // ...
  __frozen: true,
}) as SignalIntent;
```

Intent is frozen immediately after creation. Never modifiable.

### Guards

1. **Mode check**: Must be LIVE (Replay never creates intents)
2. **Confidence threshold**: confidence > MIN_APPROVAL_CONFIDENCE
3. **Signal validation**: Non-empty symbol, valid side, non-empty rationale
4. **Numeric validation**: signalStrength and confidence in [0, 1]

### Example

```typescript
const source: AgentSignalSource = {
  symbol: 'ETH/USDT',
  side: 'buy',
  rationale: 'BB position > 0.7, EMA aligned, volume surge',
  signalStrength: 0.8,
  confidence: 0.75,
  agentId: 'trend_agent_1h',
};

const intent = createSignalIntent(source, ctx);
// Creates frozen SignalIntent, ready for approval
```

---

## 2️⃣ STAGE 2: RiskApproval

**File:** `client/src/lib/factories/riskApprovalEngine.ts`

### What It Does

Veto power. Most signals die here. That's the entire job.

**Checks (in order):**

1. **Time Authority**: mode === 'LIVE'
2. **Confidence Threshold**: confidence > 0.5 (configurable)
3. **Exposure Limits**: notional USD < maxUsdPerSignal
4. **Drawdown State**: unrealized loss < maxDrawdownPercent
5. **Rate Limiting**: time since last signal from agent > cooldownMs
6. **Kill Switch**: killSwitchActive === false

### Output

```typescript
interface RiskApproval {
  intentId: string;
  approved: boolean;
  reason?: string;  // if rejected, why
  
  limits?: {
    maxUsd: number;
    maxLeverage: number;
    cooldownMs?: number;
    maxDrawdownPercent?: number;
  };
  
  riskScore: number;  // 0..1, internal assessment
  checks: {
    timeAuthorityPassed: boolean;
    confidenceThresholdPassed: boolean;
    exposureWithinLimits: boolean;
    drawdownAcceptable: boolean;
    rateLimited: boolean;
  };
}
```

### Key Property: Risk NEVER Prices

Risk approval does **not**:
- Sample market price
- Calculate order size
- Estimate slippage
- Execute anything

Risk approval **only** vetoes.

### Example

```typescript
const approval = approveSignalIntent(intent, riskState);

if (!approval.approved) {
  console.log(`Veto: ${approval.reason}`);
  // Signal dies here, no order created
  return;
}

console.log(`Approved with risk score ${approval.riskScore}`);
// Move to Stage 3
```

### Risk State (External Dependency)

```typescript
interface RiskState {
  portfolioValueUsd: number;
  unrealizedPnlUsd: number;
  lastSignalByAgent: Map<string, number>;
  positionsBySymbol: Map<string, number>;
  killSwitchActive: boolean;
  maxDrawdownPct: number;
  maxLeverageMultiplier: number;
  maxUsdPerSignal: number;
  cooldownMs: number;
}
```

---

## 3️⃣ STAGE 3: ExecutionProposal

**File:** `client/src/lib/factories/executionProposalGenerator.ts`

### What It Does

Applies market reality. Concrete trading plan.

**Responsibilities:**
- Sample current market price (bid/ask)
- Calculate order size from risk limits
- Estimate slippage impact
- Choose order type (limit vs market)
- Set expiration (TTL)

### Output

```typescript
interface ExecutionProposal {
  intentId: string;
  approvalId: string;
  proposedAt: number;
  ttlMs: number;  // validity window (default 30s)
  
  exchange: 'binance';
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  price: number;
  size: number;
  
  slippageModel: string;
  estimatedSlippageBps: number;
  estimatedImpactUsd: number;
}
```

### Key Properties

**TTL (Time To Live)**: Proposal validity window
- Default: 30 seconds
- If market moves significantly, proposal is recomputed
- Stale if price moved >50bps

**OrderType Selection**:
- Strong signals + calm market → limit (patient, better execution)
- Weak signals or volatile → market (urgent)

**Slippage Estimation**:
- Base: half bid-ask spread
- Adjustment for order size (larger → more impact)
- Adjustment for volatility

### Example

```typescript
const proposal = generateExecutionProposal(intent, approval, market);

if (!proposal) {
  console.log('Proposal generation failed (market or capital issue)');
  return;
}

console.log(
  `Proposal: ${proposal.symbol} ` +
  `${proposal.side} ${proposal.size} ` +
  `@ $${proposal.price} ` +
  `expires in ${proposal.ttlMs}ms`
);
// Move to Stage 4
```

### Proposal Expiration

```typescript
// Check if proposal is expired
if (isProposalExpired(proposal)) {
  console.log('Proposal expired, recompute');
  const newProposal = generateExecutionProposal(intent, approval, market);
}

// Check if market has moved too far
if (isProposalStaleForMarket(proposal, currentMarket)) {
  console.log('Market moved, recompute proposal');
}
```

---

## 4️⃣ STAGE 4: OrderCommit

**File:** `client/src/lib/factories/orderCommitFinalizer.ts`

### What It Does

Final execution gate. Only stage that calls CCXT.

**Guards (in order):**

1. **Approval Check**: risk approval was granted
2. **Expiration Check**: proposal not expired
3. **Time Authority**: assertExecutionAllowed(ctx)
   - mode === 'LIVE'
   - allowTrade === true
   - confidence > MIN
   - data not stale

If ANY guard fails, throws immediately. No order is placed.

### Output

```typescript
interface OrderCommit {
  proposalId: string;
  committedAt: number;
  status: 'submitted' | 'rejected' | 'filled' | 'partial' | 'failed';
  
  exchangeOrderId?: string;
  exchangeResponse?: any;
  
  filledSize?: number;
  filledPrice?: number;
  filledAt?: number;
  
  error?: {
    code: string;
    message: string;
  };
  
  __readonly: true;
}
```

### Replay Protection

```typescript
// Hard guard: never commit in replay
if (ctx.mode === 'REPLAY') {
  throw new Error(
    'FATAL: Cannot commit order in REPLAY mode'
  );
}
```

### Example

```typescript
try {
  const commit = await commitOrder(proposal, approval, ctx, exchange);
  
  if (commit.status === 'submitted') {
    console.log(`Order ${commit.exchangeOrderId} submitted`);
  } else {
    console.log(`Exchange rejected: ${commit.error?.message}`);
  }
} catch (e) {
  console.error(`Commit failed: ${e.message}`);
}
```

---

## 🎼 Orchestration

**File:** `client/src/lib/factories/executionOrchestrator.ts`

### ExecutionOrchestrator Class

Routes signals through all four stages with logging and error recovery.

```typescript
const orchestrator = new OrchestratorBuilder()
  .withRiskState(riskState)
  .withExchange(exchange)
  .withLogger(logger)
  .build();

const flow = await orchestrator.executeSignal(source, ctx, market);

// flow contains: intent → approval → proposal → commit
// Each stage is logged
// Rejections are audited
```

### Query Interface

```typescript
// Get all flows for a symbol
const flows = orchestrator.getFlowsBySymbol('BTC/USDT');

// Get all committed trades
const trades = orchestrator.getCommittedFlows();

// Get all rejected signals (for analysis)
const rejected = orchestrator.getRejectedFlows();

// Get statistics
const stats = orchestrator.getStatistics();
console.log(`Success rate: ${stats.successRate * 100}%`);
```

### Execution Flow

```typescript
interface ExecutionFlow {
  id: string;
  createdAt: number;
  
  intent: SignalIntent;
  approval: RiskApproval;
  proposal?: ExecutionProposal;
  commit?: OrderCommit;
  
  stage: 'intent' | 'approved' | 'proposed' | 'committed' | 'rejected';
  rejectedAt?: number;
  rejectionReason?: string;
  
  durationMs: number;
}
```

---

## 🔍 Forensics

**File:** `client/src/lib/factories/executionForensics.ts`

### Post-Mortem Analysis

Answer: **"How did this trade happen?"**

With compartmentalization, the answer is a simple walk through four stages.

```typescript
const chain = queryExecutionChain(flow);
console.log(chain.intent);   // why agent wanted it
console.log(chain.approval); // why risk approved it
console.log(chain.proposal); // how it was priced
console.log(chain.commit);   // what exchange said
```

### Rejection Path Analysis

For rejected orders, identify exact gate:

```typescript
const rejection = queryRejectionPath(flow);
if (rejection) {
  console.log(`Rejected at: ${rejection.rejectedBy}`);
  console.log(`Reason: ${rejection.reason}`);
}
```

### Trade Analysis

For committed orders:

```typescript
const analysis = queryTradeAnalysis(flow);
console.log(`Size: ${analysis.size}`);
console.log(`Price: ${analysis.price}`);
console.log(`Estimated Slippage: $${analysis.estimatedSlippageUsd}`);
if (analysis.filledPrice) {
  console.log(`Realized Slippage: $${analysis.realizedSlippageUsd}`);
}
```

### Loss Narrative

Understand why an order wasn't executed:

```typescript
const narrative = queryLossNarrative(flow);
console.log(narrative);
```

Example output:
```
Order was rejected at risk_approval stage.
Reason: Confidence 45% below threshold 50%

Risk system rejected signal.
Checks that failed:
  • Confidence too low
```

### Forensic Reports

Generate human-readable reports:

```typescript
// Single execution
const report = generateForensicReport(flow);
console.log(report);

// Batch analysis
const batchReport = generateBatchReport(flows);
console.log(batchReport);
```

---

## 🛡️ Blast Radius Comparison

| Failure | Single Call | Four-Stage |
|---------|------------|-----------|
| Agent bug | ❌ trades | ✅ intent logged, rejected |
| Risk misconfig | ❌ trade slips | ✅ veto |
| Pricing stale | ❌ bad fill | ✅ proposal expires |
| Execution crash | ❌ unknown | ✅ commit log |
| Post-mortem | ❌ guess | ✅ exact chain |
| Replay exploit | ❌ trades | ✅ blocked by 3 gates |

---

## 🔐 Replay Safety

Replay data can flow through all stages but **cannot acquire execution authority**.

**Gate 1 - Agent**: Agents check mode before creating intents
```typescript
if (ctx.mode === 'REPLAY') {
  return null;  // no intent created
}
```

**Gate 2 - Risk**: Risk approval checks mode
```typescript
if (intent.mode !== 'LIVE') {
  return { approved: false, reason: 'not LIVE mode' };
}
```

**Gate 3 - Execution**: assertExecutionAllowed checks mode
```typescript
assertExecutionAllowed(ctx);  // throws if mode === 'REPLAY'
```

Result: Replay data cannot reach CCXT, ever.

---

## 📊 Key Files

| File | Purpose |
|------|---------|
| `client/src/types/ExecutionCompartments.ts` | Type definitions |
| `client/src/lib/factories/signalIntentFactory.ts` | Stage 1 |
| `client/src/lib/factories/riskApprovalEngine.ts` | Stage 2 |
| `client/src/lib/factories/executionProposalGenerator.ts` | Stage 3 |
| `client/src/lib/factories/orderCommitFinalizer.ts` | Stage 4 |
| `client/src/lib/factories/executionOrchestrator.ts` | Orchestration |
| `client/src/lib/factories/executionForensics.ts` | Post-mortem |

---

## 🧪 Testing Strategy

### Stage 1: Intent Creation
Test intent validation and immutability:
```typescript
const intent = createSignalIntent(source, ctx);
validateSignalIntent(intent);  // asserts frozen
```

### Stage 2: Risk Approval
Test veto logic:
```typescript
const rejection = approveSignalIntent(intent, riskState);
expect(rejection.approved).toBe(false);
expect(rejection.reason).toContain('Confidence');
```

### Stage 3: Proposal Generation
Test expiration:
```typescript
const proposal = generateExecutionProposal(...);
expect(isProposalExpired(proposal)).toBe(false);
// wait 31 seconds
expect(isProposalExpired(proposal)).toBe(true);
```

### Stage 4: Commit Gates
Test replay protection:
```typescript
ctx.mode = 'REPLAY';
expect(() => commitOrder(...)).toThrow('REPLAY');
```

### Full Pipeline
Test end-to-end:
```typescript
const flow = await orchestrator.executeSignal(source, ctx, market);
expect(flow.stage).toBe('committed');
expect(flow.commit.exchangeOrderId).toBeDefined();
```

---

## 🚀 Integration Checklist

- [ ] Add ExecutionCompartments types to project
- [ ] Implement SignalIntent factory
- [ ] Implement RiskApproval engine
- [ ] Implement ExecutionProposal generator
- [ ] Implement OrderCommit finalizer
- [ ] Implement ExecutionOrchestrator
- [ ] Implement ExecutionForensics
- [ ] Connect orchestrator to agents
- [ ] Wire orchestrator to CCXT adapter
- [ ] Add logging/monitoring
- [ ] Test full pipeline with live data
- [ ] Enable forensics queries in dashboard
- [ ] Configure risk limits for production

---

## 📝 One-Liner Truth

> **If a trade happened, you can reconstruct exactly how in under 1 minute.**

Every stage is logged. Every veto is recorded. No guessing required.

This is trustworthy capital management.
