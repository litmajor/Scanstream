# EXECUTION COMPARTMENTS: Integration Guide

## 🔌 Wiring the Pipeline

The four-compartment execution pipeline is now ready to integrate into Scanstream.

---

## 1. Existing System → ExecutionOrchestrator

Your current system:
```
Agent → DecisionContext → Trade Execution
```

New system:
```
Agent → SignalIntent → RiskApproval → ExecutionProposal → OrderCommit → CCXT
```

### How to Connect

**Before (single call):**
```typescript
// Current way (danger: all authority in one place)
async function executeSignal(signal, ctx) {
  // ... price sampling ...
  // ... size calculation ...
  // ... slippage estimation ...
  // ... CCXT call ...
  // If anything fails, everything fails
}
```

**After (four gates):**
```typescript
const orchestrator = new OrchestratorBuilder()
  .withRiskState(riskState)
  .withExchange(exchange)
  .withLogger(logger)
  .build();

const flow = await orchestrator.executeSignal(agentSignal, ctx, market);
// Each stage is logged, rejections are audited
```

---

## 2. Replace Decision → Trade with Compartments

### Step 1: Update Agents

Your agents currently call something like:
```typescript
const decision = myAgent(ctx);
if (decision) {
  await executeSignal(decision);  // OLD
}
```

Change to:
```typescript
const decision = myAgent(ctx);
if (decision) {
  const source: AgentSignalSource = {
    symbol: decision.symbol,
    side: decision.side,
    rationale: decision.rationale,
    signalStrength: decision.strength,
    confidence: decision.confidence,
    agentId: 'my_agent_1h',
  };
  
  const flow = await orchestrator.executeSignal(source, ctx, market);
  // flow.stage tells you how far it got
  // flow.rejectionReason explains any veto
}
```

### Step 2: Inject Dependencies

```typescript
// Create risk state from existing portfolio/limits
const riskState: RiskState = {
  portfolioValueUsd: portfolio.usd,
  unrealizedPnlUsd: portfolio.unrealizedPnl,
  lastSignalByAgent: new Map(),
  positionsBySymbol: new Map(),
  killSwitchActive: false,
  maxDrawdownPct: 25,
  maxLeverageMultiplier: 1,
  maxUsdPerSignal: 5000,
  cooldownMs: 5000,
};

// Wrap your CCXT instance
class CCXTAdapter implements ExchangeAdapter {
  constructor(private ccxt: any) {}
  
  async placeOrder(spec: any) {
    return this.ccxt.createOrder(
      spec.symbol,
      spec.type,
      spec.side,
      spec.amount,
      spec.price,
      { postOnly: spec.postOnly, timeInForce: spec.timeInForce }
    );
  }
}

const orchestrator = new OrchestratorBuilder()
  .withRiskState(riskState)
  .withExchange(new CCXTAdapter(ccxt))
  .withLogger(console)
  .build();
```

### Step 3: Add Market Data

ExecutionProposal needs current market prices:

```typescript
interface MarketSnapshot {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24hUsd: number;
  volatilityPercent24h: number;
  timestamp: number;
}

// Feed from your existing price source
const market: MarketSnapshot = {
  symbol: 'BTC/USDT',
  bid: 45000,
  ask: 45010,
  last: 45005,
  volume24hUsd: 50000000,
  volatilityPercent24h: 2.5,
  timestamp: Date.now(),
};
```

---

## 3. Forensics Integration

### Dashboard Queries

Replace "how did this trade happen?" guessing with forensics:

```typescript
// Get all trades for a symbol
const trades = orchestrator.getFlowsBySymbol('BTC/USDT');

// See which were committed vs rejected
const committed = trades.filter(f => f.stage === 'committed');
const rejected = trades.filter(f => f.stage === 'rejected');

// For any trade, get the complete chain
for (const flow of committed) {
  const chain = queryExecutionChain(flow);
  console.log(chain.intent.rationale);   // why agent wanted it
  console.log(chain.approval.riskScore); // risk assessment
  console.log(chain.proposal.price);     // what price was used
  console.log(chain.commit.filledPrice); // what actually filled
}
```

### Incident Investigation

When something goes wrong:

```typescript
// Get the forensic report
const report = generateForensicReport(flow);
console.log(report);

// Output:
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ EXECUTION FORENSIC REPORT                                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// EXECUTION ID: a1b2c3d4-...
// TIMESTAMP: 2025-12-14T10:30:45.123Z
// FINAL STAGE: committed
//
// INTENT
// Agent: trend_agent_1h
// Symbol: BTC/USDT
// Side: BUY
// Confidence: 85%
// Rationale: BB position > 0.7, EMA aligned, volume surge
//
// RISK APPROVAL
// Status: ✅ APPROVED
// Risk Score: 0.32
// Checks: 5/5 passed
//
// EXECUTION PROPOSAL
// Order Type: limit
// Price: $45010.00
// Size: 0.1
// Estimated Slippage: 10bps ($450.00)
//
// ORDER COMMIT
// Status: ✅ SUBMITTED
// Exchange Order ID: 123456789
```

---

## 4. Risk Management

### Adjust Risk Limits

Risk approval uses configurable limits:

```typescript
riskState.maxUsdPerSignal = 10000;      // max notional per signal
riskState.maxLeverageMultiplier = 2;    // max 2x leverage
riskState.maxDrawdownPct = 15;          // stop if down 15%
riskState.cooldownMs = 10000;           // min 10s between signals
```

### Activate Kill Switch

```typescript
riskState.killSwitchActive = true;  // reject all new signals
// or
riskState.killSwitchActive = false; // resume trading
```

### Monitor Risk Scores

```typescript
const stats = orchestrator.getStatistics();
console.log(`Avg risk score: ${stats.avgRiskScore}`);
console.log(`Success rate: ${stats.successRate * 100}%`);

// Alert if success rate drops
if (stats.successRate < 0.6) {
  console.log('⚠️  Success rate below 60%, check system');
}
```

---

## 5. Replay Mode Integration

Replay can simulate execution without actually trading:

```typescript
// Replay context
const replayCtx: DecisionContext = {
  ...ctx,
  mode: 'REPLAY',
  timestamp: historicalTime,
};

// All four stages work
const flow = await orchestrator.executeSignal(source, replayCtx, market);

// But Stage 4 (OrderCommit) is impossible
// assertExecutionAllowed throws: mode === 'REPLAY'
// Therefore flow.stage will never be 'committed' in replay

// Result: you can test the entire pipeline without placing orders
```

---

## 6. Testing the Pipeline

### Unit Tests

```typescript
// Test intent creation
const intent = createSignalIntent(source, ctx);
expect(intent.id).toBeDefined();
expect(intent.__frozen).toBe(true);

// Test risk approval veto
const rejection = approveSignalIntent(intent, riskState);
expect(rejection.approved).toBe(false);

// Test proposal generation
const proposal = generateExecutionProposal(intent, approval, market);
expect(proposal.ttlMs).toBe(30000);

// Test commit guards
const dryRun = dryRunCommit(proposal, approval, ctx);
expect(dryRun).toBe(true);
```

### Integration Test

```typescript
// Test full pipeline
const flow = await orchestrator.executeSignal(source, ctx, market);

// Verify all stages completed
expect(flow.stage).toBe('committed');
expect(flow.intent).toBeDefined();
expect(flow.approval.approved).toBe(true);
expect(flow.proposal).toBeDefined();
expect(flow.commit.exchangeOrderId).toBeDefined();

// Verify forensics work
const chain = queryExecutionChain(flow);
expect(chain.commit.exchangeOrderId).toBe(flow.commit.exchangeOrderId);
```

### Replay Test (No Orders)

```typescript
// Same pipeline, but replay mode
const replayCtx = { ...ctx, mode: 'REPLAY' };
const replayFlow = await orchestrator.executeSignal(
  source,
  replayCtx,
  market
);

// All stages work except commit
expect(replayFlow.stage).toBe('proposed');  // stops before OrderCommit
expect(replayFlow.commit).toBeUndefined();  // no order created
```

---

## 7. Performance Tuning

### Async/Await

ExecutionOrchestrator.executeSignal() is async (CCXT call is blocking).

Optimize with:
```typescript
// Execute multiple signals in parallel
const flows = await Promise.all([
  orchestrator.executeSignal(source1, ctx, market1),
  orchestrator.executeSignal(source2, ctx, market2),
  orchestrator.executeSignal(source3, ctx, market3),
]);
```

### Logging

Orchestrator logs every transition by default.

For high-throughput, reduce logging:
```typescript
class SilentLogger implements Logger {
  log() {}
  warn(msg: string) { console.warn(msg); }  // only warnings/errors
  error(msg: string) { console.error(msg); }
}

const orchestrator = new OrchestratorBuilder()
  .withLogger(new SilentLogger())
  .build();
```

### Caching Market Data

Avoid re-fetching market data for every signal:

```typescript
// Fetch once per 1-second tick
const markets = new Map<string, MarketSnapshot>();

for (const symbol of symbols) {
  markets.set(symbol, {
    bid: ticker[symbol].bid,
    ask: ticker[symbol].ask,
    // ...
  });
}

// Then batch execute with cached data
const flows = await orchestrator.executeBatch(
  allSignals,
  ctx,
  markets  // reuse same snapshot for all signals
);
```

---

## 8. Migration Path

### Phase 1: Parallel (Low Risk)

Run both old and new systems simultaneously:
```typescript
// OLD
const oldResult = await executeSignal(decision);

// NEW
const newFlow = await orchestrator.executeSignal(source, ctx, market);

// Compare results, verify alignment
if (oldResult.orderID !== newFlow.commit.exchangeOrderId) {
  console.log('ALERT: Results differ');
}
```

### Phase 2: Shadow (Gradually Switch)

New system executes in shadow mode (log only, no trading):
```typescript
// Live trading still uses old system
const order = await executeSignal(decision);

// But log what new system would have done
const shadowFlow = await orchestrator.executeSignal(source, ctx, market);
logger.info('Shadow execution would have:', shadowFlow);
```

### Phase 3: Switchover (Full Integration)

Flip to new system for all trading:
```typescript
// All signals now go through compartments
const flow = await orchestrator.executeSignal(source, ctx, market);
```

---

## 9. Monitoring & Alerts

### Success Rate Monitoring

```typescript
setInterval(() => {
  const stats = orchestrator.getStatistics();
  
  if (stats.successRate < 0.7) {
    alert('Trading success rate < 70%, investigate');
  }
  
  if (stats.avgDurationMs > 1000) {
    alert('Avg execution time > 1s, check latency');
  }
}, 60000);  // every minute
```

### Rejection Analysis

```typescript
const rejected = orchestrator.getRejectedFlows();
const reasonCounts = {};

for (const flow of rejected) {
  const path = queryRejectionPath(flow);
  reasonCounts[path.rejectedBy] = (reasonCounts[path.rejectedBy] || 0) + 1;
}

console.log('Rejections by gate:', reasonCounts);
// { risk_approval: 45, proposal_generation: 2, order_commit: 1 }
```

### Daily Report

```typescript
const committed = orchestrator.getCommittedFlows();
const totalNotional = committed.reduce(
  (sum, flow) => sum + (flow.proposal.price * flow.proposal.size),
  0
);

console.log(`
Daily Summary:
- Trades executed: ${committed.length}
- Total notional: $${totalNotional}
- Success rate: ${orchestrator.getStatistics().successRate * 100}%
`);
```

---

## 🎯 Summary

The four-compartment pipeline:

1. **Breaks the singularity** — no single function has all authority
2. **Provides forensics** — "how did this trade happen?" answered in 1 minute
3. **Enables testing** — each stage independently testable
4. **Improves safety** — multiple independent vetoes
5. **Preserves performance** — minimal overhead, async throughout

---

## 📚 Reference

- **Architecture**: `EXECUTION_COMPARTMENTS.md`
- **Stage 1**: `client/src/lib/factories/signalIntentFactory.ts`
- **Stage 2**: `client/src/lib/factories/riskApprovalEngine.ts`
- **Stage 3**: `client/src/lib/factories/executionProposalGenerator.ts`
- **Stage 4**: `client/src/lib/factories/orderCommitFinalizer.ts`
- **Orchestration**: `client/src/lib/factories/executionOrchestrator.ts`
- **Forensics**: `client/src/lib/factories/executionForensics.ts`
- **Types**: `client/src/types/ExecutionCompartments.ts`

---

## 🚀 Next Steps

1. Copy all files into your codebase
2. Update CCXT adapter implementation
3. Wire orchestrator into agent loop
4. Run integration tests
5. Migrate from old to new system (Phase 1 → 2 → 3)
6. Enable forensics dashboard
7. Monitor success rates and alerts
8. Celebrate trustworthy capital management 🎉
