# 🔗 Multi-Domain RL Integration Guide
## Connecting 5 Domains to Your Trading Pipeline

**Purpose**: Step-by-step integration patterns for deploying multi-domain RL decisions into live trading  
**Target Users**: Engineers integrating RL decisions into entry/exit logic  
**Status**: Implementation ready

---

## 📐 Architecture Overview

```
Trading Signal
      ↓
[SIGNAL EVALUATION]
      ↓
RL Agent State Extraction
  ├─ Volatility regime
  ├─ Trend momentum
  ├─ Portfolio drawdown
  ├─ ML/Scanner/RL confidence scores
  └─ Market microstructure
      ↓
[GET FULL DECISION] ← Get all 5 domains at once
      ↓
      ├→ CLUSTER_THRESHOLD domain
      │    ├─ Validates gate (cluster strength check)
      │    └─ → REJECT or CONTINUE
      │
      ├→ ENTRY_TIMING domain (if gate passed)
      │    ├─ Decides when to enter (NOW vs wait)
      │    └─ → Immediate or Delayed+Limit
      │
      ├→ SOURCE_WEIGHTING domain (if entering)
      │    ├─ Weights consensus (Scanner 35%, ML 40%, RL 25%)
      │    └─ → Confidence score for position sizing
      │
      ├→ POSITION_SIZING domain (if confidence high)
      │    ├─ Sizes position + SL/TP
      │    └─ → Size, Stop, Target
      │
      └→ EXIT_SEQUENCING domain (at entry)
           ├─ Plans exit splits (T1, T2, trail)
           └─ → T1%/T2%/trail config
               ↓
        [EXECUTE TRADE]
               ↓
        Trade closes / Stop hit
               ↓
        [RECORD OUTCOME]
               ↓
        Calculate 5 domain rewards
               ↓
        learnDomain() × 5 (parallel OK)
               ↓
        [UPDATE Q-TABLES]
```

---

## 🧬 Code Pattern 1: Entry Signal Processing

### Before (Static Decision)

```typescript
// Old: One RL agent = one position sizing decision
async function processEntrySignal(signal: Signal) {
  // ... validate signal here ...
  
  // Old approach: only RL sizing
  const rlDecision = rlAgent.selectAction(state);
  const position = {
    size: rlDecision.baseSize * rlDecision.sizeMultiplier,
    entry: signal.price,
    stopLoss: signal.price - rlDecision.stopMultiplier * atr,
    takeProfit1: signal.price + 1 * atr,
    takeProfit2: signal.price + 2 * atr,
    takeProfit3: signal.price + 3 * atr,
  };
  
  await executeOrder(position);
  
  return position;
}
```

### After (Multi-Domain Decision)

```typescript
async function processEntrySignal(signal: Signal) {
  const state = rlAgent.extractState(frames, mlConf, regime, dd);
  
  // Get ALL 5 domain decisions at once
  const fullDecision = rlAgent.getFullDecision(
    state,
    baseSize = 2000,
    atr = signal.atr,
    price = signal.price
  );
  
  const {
    sizing,           // POSITION_SIZING domain
    entryTiming,      // ENTRY_TIMING domain
    sourceWeights,    // SOURCE_WEIGHTING domain
    exitSequence,     // EXIT_SEQUENCING domain
    clusterThreshold  // CLUSTER_THRESHOLD domain
  } = fullDecision;
  
  // ─────────────────────────────────────────────────────
  // Step 1: Apply CLUSTER_THRESHOLD domain
  // ─────────────────────────────────────────────────────
  const clusterPasses = validateClusterGate(
    signal.cluster,
    clusterThreshold.minClusterStrength,
    clusterThreshold.minFollowThrough,
    clusterThreshold.minDirectionalRatio
  );
  
  if (!clusterPasses) {
    logger.info(`Signal rejected by cluster gate (RL threshold mode)`);
    
    // Record rejection for learning
    recordSignalRejectOutcome(signal, 'cluster_gate', true); // true = correct rejection
    return null; // Don't enter
  }
  
  // ─────────────────────────────────────────────────────
  // Step 2: Apply ENTRY_TIMING domain
  // ─────────────────────────────────────────────────────
  let entryOrder;
  
  if (entryTiming.waitBars === 0 && entryTiming.entryType === 'MARKET') {
    // Enter immediately at market
    entryOrder = await placeMarketOrder({
      signal,
      quantity: sizing.baseSize * sizing.sizeMultiplier,
      tag: 'entry_timing_immediate'
    });
    
  } else if (entryTiming.entryType === 'LIMIT') {
    // Place limit order, wait up to N candles
    const limitPrice = signal.price * 
      (1 - entryTiming.limitOffsetPct / 100);
    
    entryOrder = await placeLimitOrder({
      signal,
      quantity: sizing.baseSize * sizing.sizeMultiplier,
      limitPrice,
      expireAfterBars: entryTiming.waitBars,
      tag: `entry_timing_limit_wait${entryTiming.waitBars}`
    });
  }
  
  if (!entryOrder) {
    logger.warn(`Failed to place entry order via entry timing domain`);
    return null;
  }
  
  // ─────────────────────────────────────────────────────
  // Step 3: Calculate SOURCE_WEIGHTING domain confidence
  // ─────────────────────────────────────────────────────
  const weightedConfidence = 
    (signal.scannerConfidence ?? 0.5) * sourceWeights.scannerWeight +
    (signal.mlConfidence ?? 0.5) * sourceWeights.mlWeight +
    (signal.rlConfidence ?? 0.5) * sourceWeights.rlWeight;
  
  logger.info(
    `Weighted confidence: ${(weightedConfidence * 100).toFixed(1)}% ` +
    `(Scanner: ${(signal.scannerConfidence*100).toFixed(0)}% × ${(sourceWeights.scannerWeight*100).toFixed(0)}% + ...)`
  );
  
  // ─────────────────────────────────────────────────────
  // Step 4: Apply POSITION_SIZING domain
  // ─────────────────────────────────────────────────────
  const positionSize = sizing.baseSize * sizing.sizeMultiplier;
  const stopLoss = entryOrder.fillPrice - sizing.stopMultiplier * signal.atr;
  const riskAmount = positionSize * (entryOrder.fillPrice - stopLoss);
  
  const maximumRisk = portfolio.equity * 0.02; // Max 2% per trade
  
  if (riskAmount > maximumRisk) {
    logger.warn(`Position size ${positionSize} exceeds risk limit`);
    // Reduce size proportionally
    positionSize *= maximumRisk / riskAmount;
  }
  
  // ─────────────────────────────────────────────────────
  // Step 5: Apply EXIT_SEQUENCING domain
  // ─────────────────────────────────────────────────────
  const t1_target = entryOrder.fillPrice + 1.0 * signal.atr;
  const t2_target = entryOrder.fillPrice + 2.0 * signal.atr;
  const t3_target = entryOrder.fillPrice + 3.0 * signal.atr;
  
  // T1 exit
  if (exitSequence.t1ExitPct > 0) {
    const t1_size = positionSize * exitSequence.t1ExitPct;
    await placeExitOrder({
      type: 'LIMIT',
      price: t1_target,
      quantity: t1_size,
      tag: `exit_t1_seq`,
      source: 'exit_sequencing_domain'
    });
  }
  
  // T2 exit
  if (exitSequence.t2ExitPct > 0) {
    const t2_size = positionSize * exitSequence.t2ExitPct;
    await placeExitOrder({
      type: 'LIMIT',
      price: t2_target,
      quantity: t2_size,
      tag: `exit_t2_seq`,
      source: 'exit_sequencing_domain'
    });
  }
  
  // T3 exit (trail or fixed)
  const remaining_pct = 1 - exitSequence.t1ExitPct - exitSequence.t2ExitPct;
  if (remaining_pct > 0 && exitSequence.trailRemaining) {
    const trail_start = entryOrder.fillPrice + 
      exitSequence.trailActivationPct * signal.atr;
    
    await placeTrailingStopExit({
      quantity: positionSize * remaining_pct,
      activationPrice: trail_start,
      trailDistance: 0.5 * signal.atr,
      tag: `exit_t3_trail_seq`,
      source: 'exit_sequencing_domain'
    });
    
  } else if (remaining_pct > 0) {
    // Fixed exit at T3
    const t3_size = positionSize * remaining_pct;
    await placeExitOrder({
      type: 'LIMIT',
      price: t3_target,
      quantity: t3_size,
      tag: `exit_t3_fixed_seq`,
      source: 'exit_sequencing_domain'
    });
  }
  
  // Record position for learning later
  const position = {
    entryOrder,
    positionSize,
    stopLoss,
    entryState: state,
    domainDecisions: fullDecision,
    weightedConfidence,
    clusterThreshold: clusterThreshold,
    entryTiming: entryTiming,
    sourceWeights: sourceWeights,
    exitSequence: exitSequence,
    timestampEntered: Date.now()
  };
  
  activePositions.set(entryOrder.orderId, position);
  
  return position;
}
```

---

## 🎯 Code Pattern 2: Position Close → Learning Update

### After Every Position Close

```typescript
async function onPositionClose(
  orderId: string,
  exitPrice: number,
  exitReason: 'STOP_HIT' | 'T1_HIT' | 'T2_HIT' | 'T3_HIT' | 'TRAIL_HIT' | 'MANUAL'
) {
  const position = activePositions.get(orderId);
  if (!position) return;
  
  // Calculate outcomes
  const entryPrice = position.entryOrder.fillPrice;
  const pnl = (exitPrice - entryPrice) * position.positionSize;
  const pnlPercent = (exitPrice - entryPrice) / entryPrice;
  const heldTimeMinutes = (Date.now() - position.timestampEntered) / 60000;
  
  const maxPossibleMove = calculateMaxPossibleMove(
    position.entryState,
    exitReason === 'STOP_HIT' ? 'downside' : 'upside'
  );
  
  // Calculate capture ratio
  const captureRatio = pnl / (maxPossibleMove * position.positionSize);
  
  // ─────────────────────────────────────────────────────
  // Build outcome object for reward calculations
  // ─────────────────────────────────────────────────────
  const outcome = {
    // Entry Timing rewards
    entryFillPrice: entryPrice,
    signalPrice: position.entryOrder.originalSignal.price,
    entrySlippage: Math.abs(entryPrice - position.entryOrder.originalSignal.price),
    
    // Source Weighting rewards
    weightedScore: position.weightedConfidence,
    actualOutcome: pnl > 0 ? 'WIN' : 'LOSS',
    
    // Exit Sequencing rewards
    maxPossiblePnl,
    actualExitPnl: pnl,
    captureRatio,
    
    // Cluster Threshold rewards
    signalPassed: true, // Already passed gate
    tradeWon: pnl > 0,
    tradeOutcome: exitReason,
    
    // Position Sizing rewards
    finalPnl: pnl,
    finalPnlPercent: pnlPercent,
    maxDrawdown: calculateMaxDD(position),
    held: heldTimeMinutes,
    reached2RR: pnl >= 2 * position.stopLoss * position.positionSize
  };
  
  // ─────────────────────────────────────────────────────
  // Calculate reward per domain
  // ─────────────────────────────────────────────────────
  const rewards = {};
  
  for (const domain of DOMAINS) {
    rewards[domain] = RLPositionAgent.calculateDomainReward(domain, outcome);
  }
  
  logger.info(`Trade closed: PnL=${pnl.toFixed(2)}, rewards=${JSON.stringify(rewards)}`);
  
  // ─────────────────────────────────────────────────────
  // Create domain experiences
  // ─────────────────────────────────────────────────────
  const nextState = rlAgent.extractState(
    latestFrames,
    lastMLConf,
    currentRegime,
    currentDD
  );
  
  for (const domain of DOMAINS) {
    const experience: DomainExperience = {
      domain,
      state: position.entryState,
      domainAction: position.domainDecisions[domain],
      reward: rewards[domain],
      nextState,
      done: true
    };
    
    // ─────────────────────────────────────────────────────
    // Learn: Update Q-table for this domain
    // ─────────────────────────────────────────────────────
    rlAgent.learnDomain(experience);
    
    logger.debug(
      `[${domain}] Learned: state→action earned reward=${rewards[domain].toFixed(3)}`
    );
  }
  
  // ─────────────────────────────────────────────────────
  // Record metrics for analysis
  // ─────────────────────────────────────────────────────
  await recordTradeOutcome({
    orderId,
    entryPrice,
    exitPrice,
    pnl,
    pnlPercent,
    exitReason,
    domainDecisions: position.domainDecisions,
    domainRewards: rewards,
    captureRatio,
    heldMinutes: heldTimeMinutes,
    timestamp: Date.now()
  });
  
  // Cleanup
  activePositions.delete(orderId);
}
```

---

## 📊 Code Pattern 3: Monitoring & Diagnostics

### Dashboard Query Methods

```typescript
class RLDiagnosticsDashboard {
  private rlAgent: RLPositionAgent;
  
  // ─────────────────────────────────────────────────────
  // 1. Domain Learning Progress
  // ─────────────────────────────────────────────────────
  getDomainProgress() {
    const stats = this.rlAgent.getDomainStats();
    const progress = {};
    
    for (const [domain, stat] of stats) {
      progress[domain] = {
        qTableSize: stat.qTableSize,
        experienceCount: stat.experienceCount,
        convergencePercent: Math.min(100, (stat.experienceCount / 500) * 100)
      };
    }
    
    return progress;
    
    // Output:
    // {
    //   "ENTRY_TIMING": {
    //     "qTableSize": 2340,
    //     "experienceCount": 487,
    //     "convergencePercent": 97.4
    //   },
    //   "SOURCE_WEIGHTING": {
    //     "qTableSize": 1120,
    //     "experienceCount": 487,
    //     "convergencePercent": 97.4
    //   }
    // }
  }
  
  // ─────────────────────────────────────────────────────
  // 2. Verify Exploration Happening
  // ─────────────────────────────────────────────────────
  checkExplorationRates() {
    const regimes = ['TRENDING', 'RANGING', 'VOLATILE', 'NEUTRAL'];
    const exploration = {};
    
    for (const domain of DOMAINS) {
      exploration[domain] = {};
      
      for (const regime of regimes) {
        const count = this.rlAgent.getDomainExperienceCount(domain, regime);
        let explorationRate = 0.5; // Default
        
        if (count > 500) explorationRate = 0.05;
        else if (count > 200) explorationRate = 0.15;
        else if (count > 50) explorationRate = 0.30;
        
        exploration[domain][regime] = {
          experiences: count,
          expectedExplorationRate: explorationRate
        };
      }
    }
    
    return exploration;
    
    // Output:
    // {
    //   "ENTRY_TIMING": {
    //     "TRENDING": { "experiences": 234, "expectedExplorationRate": 0.15 },
    //     "RANGING": { "experiences": 23, "expectedExplorationRate": 0.5 }
    //   }
    // }
  }
  
  // ─────────────────────────────────────────────────────
  // 3. Win Rate Per Domain (Basic)
  // ─────────────────────────────────────────────────────
  getWinRatePerDomain() {
    // Requires tracking winning/losing trades per domain
    // This is pseudo-code for the concept:
    
    const outcomes = await db.query(`
      SELECT 
        domain,
        COUNT(*) as total_trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades
      FROM trade_outcomes
      WHERE timestamp > NOW() - INTERVAL 7 DAY
      GROUP BY domain
    `);
    
    const winRates = {};
    for (const row of outcomes) {
      winRates[row.domain] = (row.winning_trades / row.total_trades * 100).toFixed(1);
    }
    
    return winRates;
    
    // Output:
    // {
    //   "ENTRY_TIMING": "67.3",
    //   "SOURCE_WEIGHTING": "64.2",
    //   "EXIT_SEQUENCING": "61.8"
    // }
  }
  
  // ─────────────────────────────────────────────────────
  // 4. Compare Decision Frequency
  // ─────────────────────────────────────────────────────
  getDecisionFrequency() {
    // Which actions are actually being selected?
    
    const outcomes = await db.query(`
      SELECT 
        domain_decisions->'entryTiming'->>'waitBars' as entry_wait,
        COUNT(*) as frequency
      FROM trade_outcomes
      WHERE timestamp > NOW() - INTERVAL 7 DAY
      GROUP BY entry_wait
      ORDER BY frequency DESC
    `);
    
    const entryTimingOptions = {};
    for (const row of outcomes) {
      entryTimingOptions[`waitBars_${row.entry_wait}`] = row.frequency;
    }
    
    return entryTimingOptions;
    
    // Output if converging well:
    // {
    //   "waitBars_1": 45,    ← Most common (converged)
    //   "waitBars_0": 12,    ← Still exploring
    //   "waitBars_2": 8,
    //   "waitBars_3": 2,
    //   "waitBars_5": 1
    // }
    
    // Output if still exploring:
    // {
    //   "waitBars_0": 18,    ← Spread out
    //   "waitBars_1": 16,    (Not converged yet)
    //   "waitBars_2": 14,
    //   "waitBars_3": 12,
    //   "waitBars_5": 6
    // }
  }
  
  // ─────────────────────────────────────────────────────
  // 5. Sanity: Verify Decisions Are Being Used
  // ─────────────────────────────────────────────────────
  verifySanityChecks() {
    const lastTrade = await db.query(`
      SELECT domain_decisions FROM trade_outcomes
      ORDER BY timestamp DESC LIMIT 1
    `);
    
    if (!lastTrade) {
      return { status: 'ERROR', message: 'No trades recorded' };
    }
    
    const decisions = JSON.parse(lastTrade[0].domain_decisions);
    
    // Check all 5 domains present
    const domains = Object.keys(decisions);
    const missingDomains = DOMAINS.filter(d => !domains.includes(d));
    
    if (missingDomains.length > 0) {
      return {
        status: 'ERROR',
        message: `Missing domains: ${missingDomains.join(', ')}`
      };
    }
    
    // Check domain properties
    const checks = {
      entry_timing_has_action: !!decisions.entryTiming?.waitBars != null,
      source_weighting_sums_to_1: 
        Math.abs(
          decisions.sourceWeights.scannerWeight +
          decisions.sourceWeights.mlWeight +
          decisions.sourceWeights.rlWeight - 1.0
        ) < 0.01,
      exit_sequence_has_t1: decisions.exitSequence?.t1ExitPct != null,
      cluster_threshold_realistic: decisions.clusterThreshold?.minClusterStrength >= 0.5
    };
    
    const allPass = Object.values(checks).every(v => v === true);
    
    return {
      status: allPass ? 'OK' : 'WARNING',
      checks
    };
  }
}

// Usage:
const dashboard = new RLDiagnosticsDashboard(rlAgent);
console.log(dashboard.getDomainProgress());
console.log(dashboard.checkExplorationRates());
console.log(dashboard.getDecisionFrequency());
console.log(dashboard.verifySanityChecks());
```

---

## 🔧 Code Pattern 4: Handling Edge Cases

### Entry Gets Rejected After RL Decision

```typescript
async function handleRejectedEntry(
  position: Position,
  reason: string
) {
  // We made an RL decision, but market filled us unfavorably
  // Should we still learn? For some domains, YES.
  
  // PROBLEM: We decided to enter at LIMIT $42,540
  // Market never came down, cancel order expired
  // Did we make a bad ENTRY_TIMING decision?
  
  // Analysis: Entry Timing would say "YES, bad action"
  // because we didn't get the price improvement we expected
  
  const lastDecision = position.domainDecisions;
  
  // Recalculate what WOULD have happened if we forced entry
  // at market price instead of limit
  const marketPrice = getCurrentPrice(); // $42,560 (didn't come down)
  
  const hypotheticalSlippage = (marketPrice - position.entryOrder.originalSignal.price) 
    / position.entryOrder.originalSignal.price;
  
  // Create "counterfactual" experience for Entry Timing domain
  if (lastDecision.entryTiming.entryType === 'LIMIT') {
    const counterfactualExperience: DomainExperience = {
      domain: 'ENTRY_TIMING',
      state: position.entryState,
      domainAction: lastDecision.entryTiming,
      reward: hypotheticalSlippage * -50 + -2, // Penalty for missed opportunity
      nextState: getCurrentState(),
      done: true
    };
    
    rlAgent.learnDomain(counterfactualExperience);
    
    logger.info(`Entry Timing: Learned from rejected limit order`);
  }
}
```

### Multi-Leg Close (Not All at Once)

```typescript
async function onPartialClose(
  orderId: string,
  closedQuantity: number,
  closePrice: number,
  closedPercentOfPosition: number // 0.33 for T1, etc
) {
  const position = activePositions.get(orderId);
  
  // Create partial experience for learning
  const partialPnl = (closePrice - position.entryOrder.fillPrice) * closedQuantity;
  
  // Only record if this is final close
  if (closedPercentOfPosition < 1.0) {
    logger.debug(
      `[Partial close] ${closedPercentOfPosition * 100}% at ${closePrice}`
    );
    
    // Don't learn yet; wait for full close
    position.partialCloses.push({
      percentage: closedPercentOfPosition,
      price: closePrice,
      pnl: partialPnl
    });
    
    return;
  }
  
  // Final close - calculate total PnL
  const totalPnl = position.partialCloses.reduce((sum, close) => 
    sum + close.pnl, 
    (closePrice - position.entryOrder.fillPrice) * closedQuantity
  );
  
  // NOW learn
  // ... standard onPositionClose(...) logic ...
}
```

---

## 🧪 Integration Validation Checklist

Before going live multi-domain:

- [ ] **Compile Check**: TypeScript compiles without errors
  ```bash
  tsc --noEmit src/rl-position-agent.ts
  ```

- [ ] **Unit Test**: Each domain action space generates valid actions
  ```typescript
  const entryTimingActions = rlAgent.generateEntryTimingSpace();
  assert(entryTimingActions.length === 7);
  assert(entryTimingActions.every(a => a.waitBars != null));
  ```

- [ ] **Q-Table Init Check**: All domain Q-tables initialize as empty maps
  ```typescript
  const stats = rlAgent.getDomainStats();
  assert(stats.size === 5);
  stats.forEach(stat => assert(stat.qTableSize === 0));
  ```

- [ ] **Domain Decision Check**: `getFullDecision()` returns all 5 domains
  ```typescript
  const decision = rlAgent.getFullDecision(state, 2000, atr, price);
  assert(decision.sizing != null);
  assert(decision.entryTiming != null);
  assert(decision.sourceWeights != null);
  assert(decision.exitSequence != null);
  assert(decision.clusterThreshold != null);
  ```

- [ ] **Learning Check**: After calling `learnDomain()` 5 times, Q-tables grow
  ```typescript
  for (let i = 0; i < 5; i++) {
    rlAgent.learnDomain(mockExperience);
  }
  const statsBefore = rlAgent.getDomainStats();
  // Each domain should have qTableSize > 0
  ```

- [ ] **Reward Calculation Check**: All reward functions return reasonable values
  ```typescript
  const r1 = RLPositionAgent.calculateDomainReward('ENTRY_TIMING', outcome1);
  assert(r1 >= -50 && r1 <= 2);
  
  const r2 = RLPositionAgent.calculateDomainReward('SOURCE_WEIGHTING', outcome2);
  assert(r2 >= -3 && r2 <= 3);
  ```

- [ ] **Epsilon Decay Check**: Exploration rate decreases with experience
  ```typescript
  const eps1 = rlAgent.getDomainEpsilon('ENTRY_TIMING', 'TRENDING', 10);
  const eps2 = rlAgent.getDomainEpsilon('ENTRY_TIMING', 'TRENDING', 500);
  assert(eps1 > eps2); // Less experienced = more exploration
  ```

---

## 🎬 Deployment Stages

### Stage 1: Internal Validation (Days 1-3)
- Run multi-domain against historical data (paper trading)
- Verify all 5 domains update Q-tables
- Check reward signals make sense per trade type
- Baseline performance vs static decisions

### Stage 2: Paper Trading (Week 1)
- Deploy to paper account with real-time signals
- Monitor domain decision frequency per regime
- Verify convergence (decisions stabilizing by day 5)
- Compare metrics: win rate, avg profit, Sharpe ratio

### Stage 3: Live Phased Rollout (Week 2+)
- **Week 2**: Enable 3 domains (sizing + entry + source)
- **Week 3**: Add exit sequencing domain
- **Week 4**: Add cluster threshold domain
- Gradual rollout minimizes downside if domain misbehaves

### Stage 4: Monitoring (Ongoing)
- Daily: Check domain stats convergence
- Weekly: Win rate per domain analysis
- Monthly: Reward signal recalibration
- Quarterly: Ablation testing (measure each domain's contribution)

---

## 🚀 Expected Timeline

| Timeline | Milestone | Status |
|----------|-----------|--------|
| Day 1 | Code change merge to main | ✅ |
| Day 2-3 | Paper trading validation | → When ready |
| Week 1 | Paper trading metrics baseline | → |
| Week 2 | Live phased rollout (3 domains) | → |
| Week 3 | Add exit sequencing | → |
| Week 4 | Add cluster threshold (full 5) | → |
| Month 2+ | Performance analysis & tuning | → |

---

This integration guide provides concrete patterns for deploying the multi-domain RL system into actual trading logic.
