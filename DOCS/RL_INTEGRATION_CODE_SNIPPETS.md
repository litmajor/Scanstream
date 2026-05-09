# 💻 RL Integration - Copy/Paste Code Snippets

Quick reference for wiring RL into your execution engine.

---

## 1️⃣ Import RL Integration (Add to Top of File)

```typescript
import {
  getAdaptiveConsensusWeights,
  calculateWeightedConsensusScore,
  getAdaptiveClusterThreshold,
  validateClusterGate,
  RLFeedbackCallbacks,
  getRLSystemStatus,
  logRLConvergenceStatus
} from './rl-system-integration';
```

---

## 2️⃣ When Signal Fires - Get Weighted Score

Replace this:
```typescript
// OLD: Static weighting
const score = scannerConf * 0.40 + mlConf * 0.35 + rlConf * 0.25;
```

With this:
```typescript
// NEW: RL-adaptive weighting
const rlWeights = getAdaptiveConsensusWeights(
  frames,           // Market frames
  mlConfidence,     // ML confidence score
  regime,           // Market regime (string)
  currentDrawdown   // Portfolio drawdown (0-1)
);

const score = calculateWeightedConsensusScore(
  scannerConfidence,
  mlConfidence,
  rlConfidence,
  rlWeights
);

if (rlWeights.isRLControlled) {
  console.log(
    `[RL-SOURCE] Using learned weights: ` +
    `Scanner=${rlWeights.scannerWeight.toFixed(2)}, ` +
    `ML=${rlWeights.mlWeight.toFixed(2)}, ` +
    `RL=${rlWeights.rlWeight.toFixed(2)}`
  );
}
```

---

## 3️⃣ When Validating Cluster - Use Adaptive Gate

Replace this:
```typescript
// OLD: Hardcoded threshold
if (clusterMetrics.cluster_strength >= 0.75) {
  // Signal passes
} else {
  // Signal rejected
}
```

With this:
```typescript
// NEW: RL-adaptive threshold
import { ClusterValidator } from './services/clustering/cluster-validator';

const validator = new ClusterValidator();

// Set market context for RL (MUST do this first)
validator.setMarketContext(
  frames,           // Market frames
  mlConfidence,     // ML confidence
  regime,           // Market regime
  currentDrawdown   // Portfolio drawdown
);

// Validate entry (uses RL thresholds if available)
const validation = validator.validateEntry(
  baseSignalQuality,  // 0-1 confidence
  clusterMetrics      // cluster metrics
);

// Check recommendation
if (validation.entry_recommendation === 'skip') {
  console.log('[RL-GATE] Entry rejected');
  console.log(validation.reasoning);
  return null; // Skip this signal
}

console.log(
  `[RL-THRESHOLD] Entry passed: ${validation.entry_recommendation} ` +
  `(quality: ${(validation.final_entry_quality * 100).toFixed(0)}%)`
);
```

---

## 4️⃣ After Entry Order Fills - Register Trade

```typescript
import { rlAgent } from './rl-system-integration';

// After your order fills and you have entry price
const tradeId = `${symbol}_${timestamp}`;

// Extract RL state
const rlState = rlAgent.extractState(
  frames,
  mlConfidence,
  regime,
  currentDrawdown
);

// Get full RL decision (for later reward calculation)
const rlDecision = rlAgent.getFullDecision(
  rlState,
  basePositionSize,  // e.g., 2000
  atr,               // ATR value
  entryPrice         // Current price
);

// Register with feedback loop
RLFeedbackCallbacks.onTradeOpen({
  tradeId,
  symbol,
  direction: 'BUY',  // or 'SELL'
  
  // Market state at entry
  entryState: rlState,
  
  // Prices
  signalPrice: orderRequest.price,      // Price when signal fired
  entryFillPrice: orderFill.price,      // Actual fill price
  entryTime: Date.now(),
  
  // RL decisions (save for later feedback)
  domainActions: {
    positionSizing: rlDecision.sizing,
    entryTiming: rlDecision.entryTiming,
    sourceWeights: rlDecision.sourceWeights,
    exitSequence: rlDecision.exitSequence,
    clusterThreshold: rlDecision.clusterThreshold
  },
  
  // Context for reward calculation
  consensusScoreAtEntry: score,  // From step 2
  clusterPassedGate: validation.entry_recommendation !== 'skip',  // From step 3
  basePositionSize,
  atr
});

console.log(`[ENTRY] Trade ${tradeId} registered with RL`);
```

---

## 5️⃣ Each Bar - Track Price (MFE/MAE)

In your position monitor loop:

```typescript
// Called every bar for each open trade
function updateOpenPosition(tradeId: string, currentPrice: number) {
  // Track MFE/MAE for reward calculation
  RLFeedbackCallbacks.onTradeTick(tradeId, currentPrice);
  
  // ... rest of your exit logic (TP/SL checks, etc.)
}
```

---

## 6️⃣ When Trade Closes - Report Outcome

After exit order fills:

```typescript
const pnlDollars = direction === 'BUY'
  ? (exitPrice - entryPrice)
  : (entryPrice - exitPrice);

const pnlPercent = (pnlDollars / entryPrice) * 100;

// Calculate R (risk/reward)
const riskAmount = (entryPrice - stopLossPrice);  // 1R distance
const riskRewardAchieved = Math.abs(pnlDollars) / riskAmount;

// Report to RL feedback loop
RLFeedbackCallbacks.onTradeClose(tradeId, {
  exitPrice,
  exitTime: Date.now(),
  exitReason: 'TP_HIT',  // or 'SL_HIT', 'MANUAL', etc.
  
  pnlDollars,
  pnlPercent,
  
  // These will be calculated internally from tick tracking
  mfe: 0,              // Don't calculate
  mae: 0,              // Don't calculate
  maxPossiblePnlPct: 0, // Don't calculate - IMPORTANT!
  
  riskRewardAchieved,
  holdingBars: Math.floor((exitTime - entryTime) / barDurationMs)
});

console.log(
  `[EXIT] Trade ${tradeId}: ${pnlPercent > 0 ? '✓' : '✗'} ` +
  `PnL=${pnlPercent.toFixed(2)}% | RR=${riskRewardAchieved.toFixed(2)}`
);
```

---

## 7️⃣ Optional: Monitor RL Learning

```typescript
// Log every minute during trading
setInterval(() => {
  logRLConvergenceStatus();
}, 60000);

// Or on-demand in dashboard
function showRLStatus() {
  const status = getRLSystemStatus();
  
  console.log('=== RL System Status ===');
  console.log(`Open trades: ${status.openTrades}`);
  console.log(`Closed trades: ${status.closedTrades}`);
  
  for (const [domain, info] of Object.entries(status.domainLearningStatus)) {
    const pct = info.convergencePercent.toFixed(1);
    const bar = '█'.repeat(Math.floor(info.convergencePercent / 5)) + 
               '░'.repeat(20 - Math.floor(info.convergencePercent / 5));
    console.log(`${domain}: [${bar}] ${pct}%`);
  }
}
```

---

## 🎯 Full Flow Example

```typescript
// ===== ENTRY =====
const frames = getMarketFrames(symbol, '1h');
const mlScore = runMLModel(symbol);
const regime = detectRegime(frames);

// Step 2: Get adaptive weights
const rlWeights = getAdaptiveConsensusWeights(frames, mlScore, regime, dd);
const score = calculateWeightedConsensusScore(scannerConf, mlConf, rlConf, rlWeights);

// Step 3: Validate cluster gate
const validator = new ClusterValidator();
validator.setMarketContext(frames, mlScore, regime, dd);
const validation = validator.validateEntry(baseQuality, clusterMetrics);
if (validation.entry_recommendation === 'skip') return;

// Execute order
const order = await placeOrder(symbol, 'BUY', size, price);
const entryPrice = order.fill.price;
const tradeId = `${symbol}_${Date.now()}`;

// Step 4: Register with RL
const rlState = rlAgent.extractState(frames, mlScore, regime, dd);
const rlDecision = rlAgent.getFullDecision(rlState, baseSize, atr, entryPrice);

RLFeedbackCallbacks.onTradeOpen({
  tradeId, symbol, direction: 'BUY',
  entryState: rlState, signalPrice: price, entryFillPrice: entryPrice,
  entryTime: Date.now(),
  domainActions: {
    positionSizing: rlDecision.sizing,
    entryTiming: rlDecision.entryTiming,
    sourceWeights: rlDecision.sourceWeights,
    exitSequence: rlDecision.exitSequence,
    clusterThreshold: rlDecision.clusterThreshold
  },
  consensusScoreAtEntry: score,
  clusterPassedGate: validation.entry_recommendation !== 'skip',
  basePositionSize: baseSize,
  atr
});

// ===== MONITORING =====
while (trade.isOpen) {
  const currentPrice = getPrice(symbol);
  
  // Step 5: Track MFE/MAE
  RLFeedbackCallbacks.onTradeTick(tradeId, currentPrice);
  
  // Check exits
  if (currentPrice >= takeProfit) {
    exitTrade(tradeId, currentPrice, 'TP_HIT');
    break;
  }
  if (currentPrice <= stopLoss) {
    exitTrade(tradeId, currentPrice, 'SL_HIT');
    break;
  }
}

// ===== EXIT =====
async function exitTrade(tradeId, exitPrice, exitReason) {
  const pnlDollars = exitPrice - entryPrice;
  const pnlPercent = (pnlDollars / entryPrice) * 100;
  const riskRewardAchieved = Math.abs(pnlDollars) / riskAmount;
  
  // Step 6: Report outcome
  RLFeedbackCallbacks.onTradeClose(tradeId, {
    exitPrice, exitTime: Date.now(), exitReason,
    pnlDollars, pnlPercent,
    mfe: 0, mae: 0, maxPossiblePnlPct: 0,
    riskRewardAchieved,
    holdingBars: Math.floor((Date.now() - entryTime) / barDurationMs)
  });
  
  console.log(`[${tradeId}] ${pnlPercent > 0 ? '✓' : '✗'} ${pnlPercent.toFixed(2)}%`);
  
  // Step 7: Monitor learning (optional)
  if (trade.totalClosed % 10 === 0) {
    logRLConvergenceStatus();
  }
}
```

---

## ⚠️ Critical Details

### Do NOT calculate maxPossiblePnlPct
```typescript
// ❌ WRONG
RLFeedbackCallbacks.onTradeClose(tradeId, {
  maxPossiblePnlPct: (max_price - entry_price) / entry_price,  // Don't do this!
});

// ✅ CORRECT
RLFeedbackCallbacks.onTradeClose(tradeId, {
  maxPossiblePnlPct: 0,  // Always 0 - manager calculates from live tracking
});
```

### Market context MUST be set before validation
```typescript
// ❌ WRONG
const result = validator.validateEntry(quality, metrics);

// ✅ CORRECT
validator.setMarketContext(frames, mlScore, regime, dd);  // This first!
const result = validator.validateEntry(quality, metrics);   // Then this
```

### All 3 callbacks must be called
```typescript
// Missing onTradeClose means NO LEARNING
RLFeedbackCallbacks.onTradeOpen(snapshot);    // ✅
// ... many onTradeTick calls ...
// RLFeedbackCallbacks.onTradeClose(...);     // ❌ If missing, RL doesn't learn!
```

---

That's it! Copy these snippets into your execution engine and you're wired up.
