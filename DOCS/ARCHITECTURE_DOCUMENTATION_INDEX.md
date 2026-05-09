# Scanstream Architecture Documentation Index

## Overview

This index documents the complete Scanstream trading platform architecture, built for safety, determinism, and auditability.

**Core Principle**: Money should only move after surviving multiple independent vetoes.

---

## Document Map

### 1. **System Architecture (Start Here)**
📄 **File**: `SYSTEM_ARCHITECTURE_END_TO_END.md`

- Mental model (one paragraph)
- Layered system diagram
- 10 layer responsibilities
- Complete live trade walkthrough (tick → order)
- Complete replay scenario + what's blocked
- 3 non-negotiable invariants
- Type system enforcement

**Read this first** if you want the complete picture.

---

### 2. **Execution Compartments Architecture**
📄 **File**: `EXECUTION_COMPARTMENTS.md`

- Problem statement (singularity danger)
- Four-compartment pipeline explained
- Stage 1: SignalIntent (pure desire)
- Stage 2: RiskApproval (veto gate)
- Stage 3: ExecutionProposal (concrete plan)
- Stage 4: OrderCommit (irreversible action)
- Orchestration and forensics
- Blast radius comparison (before/after)
- Testing strategy

**Read this** if you want deep understanding of execution stages.

---

### 3. **Execution Compartments Integration Guide**
📄 **File**: `EXECUTION_COMPARTMENTS_INTEGRATION_GUIDE.md`

- How to wire into existing system
- Dependency injection patterns
- Risk state management
- Market data integration
- Forensics queries for dashboard
- Incident investigation procedures
- Migration path (Phase 1 → 2 → 3)
- Monitoring and alerting
- Performance tuning

**Read this** when integrating into your codebase.

---

### 4. **Execution Compartments Implementation Status**
📄 **File**: `EXECUTION_COMPARTMENTS_IMPLEMENTATION_COMPLETE.md`

- Code artifacts (6 factories + 1 orchestrator)
- Safety features checklist
- Testing coverage summary
- Deployment checklist
- Code locations and line counts

**Read this** for implementation status and what was built.

---

### 5. **Time Authority Enforcement**
📄 **File**: `TIME_AUTHORITY_ENFORCEMENT.md`

- Why replay/live separation matters
- Eight critical invariants
- Three gates (agent, constraint, execution)
- Visual enforcement spec (UI design)
- Blast radius analysis
- Test examples

**Read this** for replay safety mechanisms.

---

### 6. **Agent Development Guide**
📄 **File**: `AGENT_DEVELOPMENT_GUIDE.md`

- Agent patterns and best practices
- Mode check first (gate 1)
- How to consume DecisionContext
- Safety rules for agent code
- Example agent implementations

**Read this** if you're building agents.

---

### 7. **Indicator Computation and Agents Integration**
📄 **File**: `INDICATOR_COMPUTATION_AND_AGENTS.md`

- 67-column CCXT scanner pipeline
- How indicators are computed
- Signal processor integration
- Agent consumption patterns
- Performance considerations

**Read this** to understand how data flows from CCXT → signals → agents.

---

## Code Locations

### Type Definitions
```
client/src/types/
├── ExecutionCompartments.ts     (555 lines)
├── DecisionContext.ts            (with mode field)
├── MarketFrame.ts               (with mode/source metadata)
└── UITick.ts                    (with mode validation)
```

### Execution Pipeline Factories
```
client/src/lib/factories/
├── signalIntentFactory.ts             (237 lines)
├── riskApprovalEngine.ts              (468 lines)
├── executionProposalGenerator.ts      (385 lines)
├── orderCommitFinalizer.ts            (251 lines)
├── executionOrchestrator.ts           (348 lines)
└── executionForensics.ts              (426 lines)
```

### Time Authority Guards
```
client/src/lib/
└── timeAuthorityInvariants.ts   (325 lines)
```

### Signal Processing
```
client/src/lib/factories/
├── signalProcessor.ts             (411 lines)
├── marketFrameFactory.ts          (302 lines)
└── decisionContextFactory.ts      (467 lines)
```

---

## Quick Start by Role

### **If You're an Architect**
1. Read: `SYSTEM_ARCHITECTURE_END_TO_END.md` (complete mental model)
2. Skim: `EXECUTION_COMPARTMENTS.md` (four stages explained)
3. Reference: `EXECUTION_COMPARTMENTS_IMPLEMENTATION_COMPLETE.md` (what was built)

### **If You're an Engineer Integrating**
1. Read: `EXECUTION_COMPARTMENTS_INTEGRATION_GUIDE.md` (wiring instructions)
2. Reference: Code in `client/src/lib/factories/` (implementation)
3. Test: Examples in `EXECUTION_COMPARTMENTS.md` (test strategy)

### **If You're Building Agents**
1. Read: `AGENT_DEVELOPMENT_GUIDE.md` (agent patterns)
2. Reference: `INDICATOR_COMPUTATION_AND_AGENTS.md` (data flow)
3. Understand: `TIME_AUTHORITY_ENFORCEMENT.md` (mode checks)

### **If You're Debugging a Trade Issue**
1. Query: `ExecutionForensics.generateForensicReport(flow)` (complete chain)
2. Reference: `EXECUTION_COMPARTMENTS.md` (how each stage works)
3. Check: `TIME_AUTHORITY_ENFORCEMENT.md` (was replay mode enforced?)

### **If You're Doing Post-Mortem Analysis**
1. Use: `ExecutionForensics.queryExecutionChain(flow)` (trace flow)
2. Use: `ExecutionForensics.queryRejectionPath(flow)` (why rejected?)
3. Use: `ExecutionForensics.generateBatchReport(flows)` (aggregate view)
4. Reference: `EXECUTION_COMPARTMENTS.md` (understand each gate)

---

## Key Concepts

### Mental Model
**Scanstream = Deterministic, replay-safe trading where market data flows as immutable snapshots through read-only agents that generate trading intentions, which then pass through independent veto gates (risk, pricing, execution) before reaching the exchange.**

### The Four Execution Compartments
1. **SignalIntent** — Pure desire (agent says "I want to buy BTC")
2. **RiskApproval** — Authority gate (risk system says "approved" or "vetoed")
3. **ExecutionProposal** — Concrete plan (system says "here's how: limit order at $45052")
4. **OrderCommit** — Irreversible action (only stage calling CCXT)

### Three Invariants
1. **Mode Authority**: If mode === 'REPLAY', allowTrade === false. Always.
2. **Immutability**: MarketFrames and DecisionContexts cannot be modified after creation.
3. **Compartmentalization**: No stage performs another's responsibility.

### Replay Safety
Multiple independent gates prevent replay from reaching execution:
- **Gate 1 (Agent)**: if (ctx.mode === 'REPLAY') return null;
- **Gate 2 (RiskApproval)**: if (intent.mode !== 'LIVE') reject;
- **Gate 3 (Intent Factory)**: if (mode !== 'LIVE') throw;
- **Gate 4 (Commit)**: assertExecutionAllowed(ctx) throws if mode === 'REPLAY'
- **Gate 5 (Type System)**: SignalIntent.mode: 'LIVE' (literal type)

---

## System Layers (Brief)

```
Market Ingest → MarketFrame → SignalDerivation → DecisionContext
                                                       ↓
                    Agents (read-only) ← ────────────┘
                         ↓
                   SignalIntent (frozen)
                         ↓
                   RiskApproval (veto)
                         ↓
                 ExecutionProposal (plan)
                         ↓
                   OrderCommit (irreversible)
                         ↓
                    CCXT / Exchange
```

---

## Testing Strategy

### Unit Tests
- Intent creation and validation
- Risk approval veto logic
- Proposal expiration and staleness
- Commit guard assertions
- Type system immutability

### Integration Tests
- Full pipeline (intent → approval → proposal → commit)
- Forensics reconstruction
- Batch execution
- Replay mode blocking

### Property Tests
- Invariant 1: mode=REPLAY ⇒ allowTrade=false
- Invariant 2: No perception mutations
- Invariant 3: No stage leakage

---

## Monitoring & Alerts

### Key Metrics
- Success rate (% of signals reaching commit)
- Avg execution time (ms from intent to commit)
- Rejection rate by gate (which are rejecting most?)
- Risk scores distribution (are we conservative?)

### Critical Alerts
- Success rate < 70% (investigate system health)
- Execution time > 1000ms (latency issue)
- Replay execution attempted (security breach)
- Invariant violation (type system failed)

---

## Deployment Checklist

### Code
- [x] All type definitions created
- [x] All factories implemented
- [x] Orchestrator implemented
- [x] Forensics module implemented

### Documentation
- [x] Architecture guide
- [x] Integration guide
- [x] Implementation status

### Integration (Next)
- [ ] Wire orchestrator to agent loop
- [ ] Implement CCXT adapter
- [ ] Configure risk state
- [ ] Add monitoring/alerting
- [ ] Run integration tests
- [ ] Migrate (Phase 1 → 2 → 3)

---

## Troubleshooting

### "Why was my signal rejected?"
→ Use `ExecutionForensics.queryRejectionPath(flow)` to see which gate vetoed it.

### "How much slippage did I pay?"
→ Use `ExecutionForensics.queryTradeAnalysis(flow)` to see estimated vs realized.

### "Can I execute in replay mode?"
→ No. Multiple independent gates prevent it. That's the point.

### "What if I ignore mode checks in my agent?"
→ It doesn't matter. Gates 2, 3, 4 will still stop it. Compartmentalization is failsafe.

### "Why is replay slower than live?"
→ It's not. Same pipeline. Replay just returns null from agents (no execution overhead).

---

## References & Dependencies

### Type System
- `client/src/types/ExecutionCompartments.ts` — core types
- `client/src/types/DecisionContext.ts` — decision context with mode
- `client/src/types/MarketFrame.ts` — market frame with mode/source

### Factories
- `signalIntentFactory.ts` — creates frozen intents
- `riskApprovalEngine.ts` — veto logic
- `executionProposalGenerator.ts` — pricing and slippage
- `orderCommitFinalizer.ts` — CCXT execution
- `executionOrchestrator.ts` — orchestration and logging

### Guards
- `timeAuthorityInvariants.ts` — 8 critical invariants
- `decisionContextFactory.ts` — enforces allowTrade rule

### Forensics
- `executionForensics.ts` — forensic queries and reports

---

## One-Liner Summary

> **Scanstream separates desire from decision from execution, making each stage independently testable, veto-able, and auditable.**

---

## Final Thought

Most trading systems are:
```
Agent → [magic happens] → CCXT
```

Scanstream is:
```
Agent → Intent → Risk → Proposal → Commit → CCXT
         ↓       ↓       ↓         ↓
       frozen  veto?   pricing  logged
```

Each stage is small, has one job, and is auditable.

That's the entire architecture.
