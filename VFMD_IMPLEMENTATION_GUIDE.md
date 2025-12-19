# VFMD Systems - Quick Reference & Usage Guide

## 📋 Checklist: What You Have Now

- ✅ **Validator** - Proves your physics works
- ✅ **RegimeClassifier** - Identifies 6 market states  
- ✅ **Enhanced Agent** - Uses regime-aware thresholds
- ✅ **Backtester** - Simulates on historical data with regime breakdown
- ✅ **Optimizer** - Finds optimal parameters per regime
- ✅ **Monitor** - Tracks live performance and alerts on drift

---

## 🚀 Quick Start (Copy & Paste Ready)

### 1. Validate Your Physics (10 minutes)

```typescript
import { VFMDValidator } from './server/services/vfmd/validator';
import { MarketTick } from './server/services/vfmd/types';

// Prepare data
const historicalData: MarketTick[] = [...]; // Your 1000+ tick data

// Identify known breakouts manually or from trade log
const knownBreakouts = [
  { barIndex: 150, direction: 'up' as const },
  { barIndex: 300, direction: 'down' as const },
  // ... more breakouts you manually identified
];

// Identify choppy vs trending periods
const chopPeriods = [
  { startBar: 50, endBar: 100 },
  { startBar: 400, endBar: 450 }
];

const trendPeriods = [
  { startBar: 100, endBar: 150 },
  { startBar: 250, endBar: 300 }
];

const rangePeriods = [
  { startBar: 150, endBar: 200 },
  { startBar: 350, endBar: 400 }
];

// Run validation
const report = await VFMDValidator.validateAll(
  historicalData,
  knownBreakouts,
  chopPeriods,
  trendPeriods,
  rangePeriods
);

// Check results
console.log(VFMDValidator.formatReport(report));

// EXPECTED OUTPUT:
// ✓ PEG Predictiveness [PASS]
//   PEG peaks 68% of time, 8.3 bars before breakout (expect 5-15)
//
// ✓ Turbulence Detection [PASS]
//   TI is 2.8x higher in chop vs trends (expect >1.8x)
//
// ✓ Coherence Detection [PASS]
//   Trend coherence 0.62 vs range 0.38 (expect 0.6 vs 0.4)

// If PASS: Your physics is valid! Continue to backtesting.
// If FAIL: Fix field construction, re-validate.
```

### 2. See Current Regime (5 seconds)

```typescript
import { VFMDPhysicsAgent } from './server/services/rpg-agents/VFMDPhysicsAgent';

const agent = new VFMDPhysicsAgent('VFMD_LIVE', 'balanced');
const analysis = agent.analyze(recentTicks);

console.log(`Current Regime: ${analysis.regime}`);
// Output: "laminar_trend" or "turbulent_chop" or etc.

// Get config for this regime
const config = agent.getRegimeConfig();
console.log(`Min Confidence: ${config.minConfidence * 100}%`);
console.log(`Risk Per Trade: ${config.riskPercentPerTrade * 100}%`);
console.log(`Trading Advice: ${config.tradingAdvice}`);

// Example output for LAMINAR_TREND:
// Current Regime: laminar_trend
// Min Confidence: 50%
// Risk Per Trade: 2%
// Trading Advice: AGGRESSIVE: Enter on any PEG signal, use wider stops
```

### 3. Backtest (1-5 minutes)

```typescript
import { VFMDBacktester } from './server/services/vfmd/backtester';

const agent = new VFMDPhysicsAgent('VFMD_BACKTEST', 'balanced');

const results = await VFMDBacktester.backtest(
  'BTC/USDT',           // Symbol
  historicalData,       // Your tick data
  agent,                // Agent to test
  100,                  // Start bar index (skip first 100 for warmup)
  0.02,                 // 2% stop loss
  0.04                  // 4% take profit
);

console.log(VFMDBacktester.formatReport(results));

// KEY STATS:
// - totalTrades: How many signals generated?
// - winRate: Overall accuracy (expect 50-70%)
// - sharpeRatio: Risk-adjusted return (expect >1.0)
// - maxDrawdown: Worst decline (watch <20%)
// - regimeStats['laminar_trend'].winRate: Should be 70%+
// - regimeStats['turbulent_chop'].winRate: Should be LOW
```

### 4. Find Optimal Thresholds (30 min - 6 hours)

```typescript
import { RegimeOptimizer } from './server/services/vfmd/optimizer';

const grids = RegimeOptimizer.getConservativeGrids(); // Fast

const agent = new VFMDPhysicsAgent('VFMD_OPT', 'balanced');

// Optimize all 6 regimes
const allResults = await RegimeOptimizer.optimizeAllRegimes(
  historicalData,
  agent,
  'default'
);

// See results
for (const [regime, report] of allResults.entries()) {
  console.log(RegimeOptimizer.formatReport(report));
}

// Compare across regimes
const comparison = RegimeOptimizer.compareRegimes(allResults);
console.log(`Best: ${comparison.bestRegime}`);
console.log(`Worst: ${comparison.worstRegime}`);
```

### 5. Deploy & Monitor (Ongoing)

```typescript
import { VFMDMonitor } from './server/services/vfmd/monitor';

const monitor = new VFMDMonitor();

// Record trades
tradeStream.on('closed', (trade) => {
  monitor.recordTrade({
    entryBar: trade.entryIndex,
    exitBar: trade.exitIndex,
    entryPrice: trade.entry,
    exitPrice: trade.exit,
    entryRegime: trade.regime,
    confidence: trade.confidence,
    direction: trade.direction,
    pnl: trade.pnl,
    pnlPercent: trade.pnlPercent,
    bars: trade.barCount,
    reason: trade.exitReason
  });
});

// Daily check
setInterval(() => {
  const stats = monitor.getPerformanceStats(
    historicalTrades,
    0.55,  // Expected win rate
    1.5    // Expected Sharpe
  );

  console.log(VFMDMonitor.formatReport(stats));
  
  if (stats.alerts.length > 0) {
    // Investigate performance degradation
  }
}, 24 * 60 * 60 * 1000);
```

---

## 🎯 Common Scenarios

### Scenario 1: "Is my system broken?"

```typescript
// Step 1: Validate
const valid = await VFMDValidator.validateAll(...);
if (valid.overallStatus !== 'PASS') {
  console.log('❌ Physics broken - fix field construction');
  process.exit(1);
}

// Step 2: Backtest
const results = await VFMDBacktester.backtest(...);
if (results.totalTrades < 5) {
  console.log('⚠️ Not generating signals - lower confidence threshold');
}

if (results.regimeStats['turbulent_chop'].winRate > 0.6) {
  console.log('❌ BAD - Winning in turbulent regime (should avoid!)');
}

if (results.winRate > 0.5) {
  console.log('✅ System is working');
}
```

### Scenario 2: "Performance degrading"

```typescript
const stats = monitor.getPerformanceStats();

if (stats.driftSignificant) {
  // Win rate dropped 5%+
  console.log(`⚠️ Drift detected: ${stats.drift * 100}%`);
  
  // Cause analysis
  if (stats.regimeDistribution.turbulent_chop > 0.4) {
    console.log('→ Spending too much time in choppy markets');
  } else {
    console.log('→ Need re-optimization on recent data');
    const newOpt = await RegimeOptimizer.optimizeAllRegimes(
      recentData, agent, 'default'
    );
  }
}
```

### Scenario 3: "Want 10% better returns"

```typescript
// Baseline
const baseline = await VFMDBacktester.backtest(...);
console.log(`Current Sharpe: ${baseline.sharpeRatio}`);

// Optimize
const optimized = await RegimeOptimizer.optimizeAllRegimes(...);

// Deploy optimal and re-test
const improved = await VFMDBacktester.backtest(
  'BTC/USDT', historicalData, agent, 100,
  0.02, 0.04
);

console.log(`New Sharpe: ${improved.sharpeRatio}`);
console.log(`Improvement: ${(improved.sharpeRatio / baseline.sharpeRatio - 1) * 100}%`);
```

---

## 📊 Results Interpretation

### What Good Validation Looks Like:

```
✅ PEG Predictiveness: 72% success, 8.3 bar lead
✅ TI Validation: 2.8x ratio (chop vs trend)  
✅ Coherence: PASS (trend 0.62 vs range 0.38)
Status: PASS
```

### What Good Backtest Looks Like:

```
Total Trades: 47
Win Rate: 62%
Sharpe: 1.87
Max DD: 12%

REGIME BREAKDOWN:
laminar_trend: 72% WR, 3.5 PF ✅ (best)
accumulation: 65% WR, 2.8 PF ✅
breakout_transition: 68% WR, 3.2 PF ✅
consolidation: 48% WR, 1.2 PF (acceptable)
distribution: 45% WR, 1.0 PF (borderline)
turbulent_chop: 20% WR, 0.4 PF ❌ (avoid!)
```

### What Good Optimization Looks Like:

```
BACKTESTS RUN: 18,900

BEST PARAMETERS:
Min Confidence: 48%
Min PEG: 1.0
Max TI: 1.2

EXPECTED PERFORMANCE:
Sharpe Ratio: 2.15 (vs 1.87 baseline)
Win Rate: 68% (vs 62% baseline)
Profit Factor: 3.85 (vs 3.22 baseline)

Improvement: +14.9% Sharpe ✅
```

---

## 🚨 Red Flags

| Issue | What It Means | Fix |
|-------|---|---|
| PEG validation < 50% | Field construction broken | Debug fieldConstructor.ts |
| TI ratio < 1.5x | Can't distinguish chop | Fix turbulenceIndex calculation |
| Turbulent WR > 50% | Theory broken | Investigate - might be good? |
| Optimizer all configs similar | No clear best | Grid too narrow |
| Monitor drift > 10% | Major performance loss | Re-optimize immediately |
| > 30% time turbulent | Bad market | Reduce position size |

---

## 🏃 Implementation Timeline

| Phase | Time | What To Do | Success Criteria |
|-------|------|-----------|-----------------|
| **1** | Day 1 | Validate physics | 3/3 tests PASS |
| **2** | Day 2 | Backtest 6 months | Regimes have 20%+ difference |
| **3** | Day 3 | Optimize 1-2 regimes | 5%+ improvement |
| **4** | Day 4 | Optimize all 6 | Configs stored in DB |
| **5** | Day 5+ | Deploy + monitor | Alerts working, drift <5% |

---

## 💾 Save These Outputs

Create a database table for regime configs:

```sql
CREATE TABLE regime_configs (
  regime VARCHAR(50),
  min_confidence FLOAT,
  min_peg FLOAT,
  max_ti FLOAT,
  min_coherence FLOAT,
  risk_percent FLOAT,
  position_size FLOAT,
  expected_sharpe FLOAT,
  expected_win_rate FLOAT,
  created_at TIMESTAMP,
  backtests_run INT
);
```

Load on startup:

```typescript
const configs = await database.getRegimeConfigs();
const regimeMap = new Map(configs.map(c => [c.regime, c]));

// Agent uses optimal configs instead of defaults
```

---

**Ready to proceed? Start with Step 1: Validation** ✅
