# Phase 2: Regime Detection & Dynamic Weighting - Implementation Checklist

**Duration**: 3 weeks  
**Status**: Ready to implement  
**Objective**: Detect market regimes and dynamically adjust source weights for optimal performance  

---

## Quick Summary

Phase 2 builds on Phase 1's unified pipeline by adding **market regime detection** and **dynamic weight adjustment**. Instead of using fixed weights (Scanner 35%, ML 35%, RL 30%), the system will detect the current market regime (TRENDING, RANGING, VOLATILE, CONSOLIDATING) and adjust weights accordingly:

- **TRENDING markets**: Boost Scanner to 50% (patterns work best)
- **RANGING markets**: Boost ML to 50% (mean-reversion predictions)
- **VOLATILE markets**: Boost RL to 50% (risk management critical)
- **CONSOLIDATING**: Balanced weights with Scanner bias (breakout patterns)

---

## Week 1: Regime Detection Framework

### Step 1.1: Enhance Regime Detection (Core Indicators)

**What to verify/update**:
1. `server/services/ml-regime-detector.ts` - Market regime detection
2. `server/services/regime-aware-signal-router.ts` - Regime routing
3. `server/services/live-velocity-calculator.ts` - Multi-timeframe regime

**Acceptance Criteria**:
- [ ] Detect 4 regimes: TRENDING, RANGING, VOLATILE, CONSOLIDATING
- [ ] Calculate ADX (trend strength 0-100)
- [ ] Calculate volatility (ATR, Bollinger Bands width)
- [ ] Detect trend direction (UP, DOWN, SIDEWAYS)
- [ ] Regime confidence score (0-1)

**Key Indicators to Check**:

```typescript
// ADX > 25 = Trending
// ADX 20-25 = Transition
// ADX < 20 = Ranging

// ATR > 1.5x normal = Volatile
// ATR < 0.8x normal = Consolidating

// Bollinger Bands width < 2% = Consolidating
// Bollinger Bands width > 5% = Volatile
```

**Test Cases**:
- [ ] Trending uptrend: ADX=35, price above MA, positive momentum
- [ ] Trending downtrend: ADX=32, price below MA, negative momentum
- [ ] Ranging: ADX=15, price oscillating between support/resistance
- [ ] Volatile: ATR > 1.5x normal, wide intrabar swings
- [ ] Consolidating: Decreasing ATR, Bollinger Bands tightening

---

### Step 1.2: Multi-Timeframe Regime Confirmation

**What to implement**:
1. Calculate regime on 1H, 4H, 24H timeframes
2. Create consensus mechanism across timeframes
3. Weight timeframes (24H=50%, 4H=30%, 1H=20%)

**Acceptance Criteria**:
- [ ] Calculate regime for each timeframe independently
- [ ] Agreement score (0-1) = how many timeframes agree
- [ ] Use strongest timeframe if conflict (24H > 4H > 1H)
- [ ] Reduce confidence if timeframes disagree

**Test Cases**:
- [ ] All timeframes agree: Use regime with high confidence
- [ ] 2/3 timeframes agree: Use majority, reduce confidence 15%
- [ ] All timeframes conflict: Use 24H, reduce confidence 30%

**Code Location**: Update `server/services/ml-regime-detector.ts`

```typescript
// Calculate regime for multiple timeframes
const regime1H = detectRegime(candles1H);
const regime4H = detectRegime(candles4H);
const regime24H = detectRegime(candles24H);

// Calculate agreement
const agreement = calculateTimeframeAgreement(regime1H, regime4H, regime24H);

// Return consensus
return {
  dominantRegime: regime24H.type,  // Use longest timeframe
  agreementScore: agreement,
  adjustedConfidence: regime24H.strength * agreement,
};
```

---

### Step 1.3: Regime Transition Detection & Hysteresis

**What to implement**:
1. Detect when regime is changing (not just single candle noise)
2. Add hysteresis: Require 2+ consecutive confirmation candles
3. Prevent false flips

**Acceptance Criteria**:
- [ ] Require 2 consecutive candles below/above threshold before regime flip
- [ ] Track transition progress (0-100%)
- [ ] Log regime changes with timestamp
- [ ] False flip rate < 5%

**Hysteresis Rules**:

```typescript
const hysteresisThresholds = {
  TRENDING_to_RANGING: {
    trigger: adx < 20,
    requireConfirmation: 2,  // Need 2 candles
    window: 5,               // Check last 5 candles
  },
  RANGING_to_TRENDING: {
    trigger: adx > 25,
    requireConfirmation: 2,
    window: 5,
  },
  // ... etc for all transitions
};
```

**Test Cases**:
- [ ] Single ADX dip from 30→18: No flip (stays TRENDING)
- [ ] Two consecutive ADX <20 (30→18→15): Flip to RANGING
- [ ] ADX: 30,28,32,19,28,32 (spike down, recovery): No flip

**Code Location**: New method in `server/services/ml-regime-detector.ts`

```typescript
private shouldFlipRegime(history: RegimeHistory, currentRegime: string, candidateRegime: string): boolean {
  const threshold = this.hysteresisThresholds[`${currentRegime}_to_${candidateRegime}`];
  
  // Check if last N candles confirm the flip
  const recentCandles = history.getLastN(threshold.window);
  const confirmationCount = recentCandles.filter(c => this.matchesRegime(c, candidateRegime)).length;
  
  return confirmationCount >= threshold.requireConfirmation;
}
```

---

## Week 2: Dynamic Weight Adjustment

### Step 2.1: Implement Regime-Specific Weight Matrices

**What to implement**:
1. Create weight matrix for each regime
2. Store in configuration/database
3. Apply weights in signal aggregation

**Weight Matrices**:

```typescript
const regimeWeights = {
  TRENDING: {
    scanner: 0.50,  // Patterns dominate
    ml: 0.25,
    rl: 0.25,
  },
  RANGING: {
    scanner: 0.30,  // Support/Resistance
    ml: 0.50,       // Mean-reversion
    rl: 0.20,
  },
  VOLATILE: {
    scanner: 0.35,  // Breakout patterns
    ml: 0.15,       // Unreliable
    rl: 0.50,       // Risk management
  },
  CONSOLIDATING: {
    scanner: 0.40,  // Breakout patterns
    ml: 0.35,
    rl: 0.25,
  },
};
```

**Acceptance Criteria**:
- [ ] Weights created for all 4 regimes
- [ ] Each regime weights sum to 1.0
- [ ] Documented rationale for each regime
- [ ] Easy to adjust weights based on backtest results

**Code Location**: Update `server/lib/signal-pipeline.ts` aggregateSignals method

**Test Cases**:
- [ ] TRENDING: Scanner gets highest weight
- [ ] RANGING: ML gets highest weight
- [ ] VOLATILE: RL gets highest weight
- [ ] All regimes: weights sum to 1.0

---

### Step 2.2: Implement Smooth Weight Transitions

**What to implement**:
1. Linear interpolation between weight matrices over 3-5 candles
2. Prevent sudden weight jumps (max 1% per candle)
3. Maintain weight sum = 1.0 during transitions

**Acceptance Criteria**:
- [ ] Weight change < 1% per candle during transition
- [ ] Transition duration 3-5 candles (configurable)
- [ ] All transition weights sum to 1.0
- [ ] Smooth curve, no jumps

**Smooth Transition Example**:

```typescript
const transitionCandles = 4;

// Linear interpolation
for (let i = 0; i <= transitionCandles; i++) {
  const t = i / transitionCandles;  // Progress 0 to 1
  
  const transitionalWeights = {
    scanner: oldWeights.scanner * (1 - t) + newWeights.scanner * t,
    ml: oldWeights.ml * (1 - t) + newWeights.ml * t,
    rl: oldWeights.rl * (1 - t) + newWeights.rl * t,
  };
  
  // Normalize to ensure sum = 1.0
  const sum = transitionalWeights.scanner + transitionalWeights.ml + transitionalWeights.rl;
  return {
    scanner: transitionalWeights.scanner / sum,
    ml: transitionalWeights.ml / sum,
    rl: transitionalWeights.rl / sum,
  };
}
```

**Code Location**: New class `server/lib/weight-transition-manager.ts`

**Test Cases**:
- [ ] Transition from RANGING (ML=50%) to TRENDING (Scanner=50%)
- [ ] Each candle weight change < 1%
- [ ] Final weights match target
- [ ] Weights always sum to 1.0

---

### Step 2.3: Apply Regime Weights to Phase 1 Signals

**What to update**:
1. In `aggregateSignals()` method, get current regime
2. Replace fixed 35/35/30 weights with regime weights
3. Apply during transition if applicable

**Acceptance Criteria**:
- [ ] Phase 1 signals now use dynamic weights
- [ ] Confidence adjusted by regime alignment
- [ ] Signals conflicting with regime get penalty
- [ ] Test that TRENDING signals in TRENDING regime get +boost

**Code Example**:

```typescript
async aggregateSignals(...) {
  // Step 1: Detect current regime
  const regime = this.detectMarketRegime(candles);
  
  // Step 2: Get appropriate weights
  const weights = this.getRegimeWeights(regime.type);
  
  // Step 3: Check if in transition
  if (this.isInTransition()) {
    const transitionalWeights = this.getTransitionalWeights();
    // Use transitional weights
  }
  
  // Step 4: Apply weights (replace old 0.35/0.35/0.30)
  const aggregatedConfidence =
    scanner.score * weights.scanner +
    ml.score * weights.ml +
    rl.score * weights.rl;
    
  // Step 5: Apply regime alignment boost/penalty
  const regimeBoost = this.calculateRegimeBoost(scannerScore, regime);
  const finalConfidence = aggregatedConfidence + regimeBoost;
  
  return { ...signal, confidence: finalConfidence };
}
```

**Test Cases**:
- [ ] TRENDING signal in TRENDING regime: Confidence +boost
- [ ] RANGING signal in RANGING regime: Confidence +boost
- [ ] RANGING signal in TRENDING regime: Confidence -penalty
- [ ] No regime data available: Use baseline weights (0.35/0.35/0.30)

---

## Week 3: Validation & Calibration

### Step 3.1: Source Win Rate Analysis by Regime

**What to measure**:
1. Scanner accuracy in each regime (separate)
2. ML accuracy in each regime (separate)
3. RL accuracy in each regime (separate)

**Test Plan**:
- [ ] Run 100+ historical signals in TRENDING regime
- [ ] Measure each source's win rate individually
- [ ] Run 100+ historical signals in RANGING regime
- [ ] Repeat for VOLATILE and CONSOLIDATING
- [ ] Expected: SCANNER wins TRENDING, ML wins RANGING, RL wins VOLATILE

**Acceptance Criteria**:
- [ ] SCANNER win rate TRENDING > RANGING > VOLATILE
- [ ] ML win rate RANGING > TRENDING > VOLATILE
- [ ] RL win rate VOLATILE > TRENDING > RANGING
- [ ] Differences significant (>10% variance)

**Metrics to Track**:

```typescript
interface SourcePerformance {
  regime: string;
  sources: {
    scanner: { winRate: number; avgProfit: number; maxLoss: number };
    ml: { winRate: number; avgProfit: number; maxLoss: number };
    rl: { winRate: number; avgProfit: number; maxLoss: number };
  };
}
```

**Code Location**: `server/lib/regime-performance-analyzer.ts` (new)

---

### Step 3.2: Backtest Dynamic Weights vs Fixed Weights

**What to test**:
1. Run 1+ year of historical signals with fixed weights (baseline)
2. Run same 1+ year with dynamic regime-adjusted weights
3. Compare Sharpe ratios, max drawdown, win rates

**Test Setup**:

```typescript
// Baseline: Fixed weights
const fixedWeightStrategy = runBacktest(signals, {
  scanner: 0.35,
  ml: 0.35,
  rl: 0.30,
});

// Dynamic: Regime-adjusted
const dynamicWeightStrategy = runBacktest(signals, {
  getWeights: (regime) => getRegimeWeights(regime),
});

// Compare
const improvement = {
  sharpe: dynamicWeightStrategy.sharpe - fixedWeightStrategy.sharpe,
  maxDD: fixedWeightStrategy.maxDD - dynamicWeightStrategy.maxDD,
  winRate: dynamicWeightStrategy.winRate - fixedWeightStrategy.winRate,
};
```

**Success Criteria**:
- [ ] Dynamic Sharpe > Fixed Sharpe (target +15%)
- [ ] Dynamic Max DD < Fixed Max DD
- [ ] Dynamic Win Rate > Fixed Win Rate
- [ ] Improvement holds across multiple symbols
- [ ] Improvement holds across different time periods

**Acceptance Criteria**:
- [ ] Sharpe improvement ≥ 10%
- [ ] Drawdown reduction ≥ 3%
- [ ] Win rate improvement ≥ 2%
- [ ] Statistical significance confirmed (p-value < 0.05)

---

### Step 3.3: Edge Case Testing

**Test all failure scenarios**:

1. **Insufficient Data** (<20 candles)
   - [ ] Fallback to baseline weights
   - [ ] Log warning "Using baseline weights due to insufficient data"
   - [ ] No crashes or errors

2. **Missing Volume Data**
   - [ ] Detect regime without volume (ADX + momentum based)
   - [ ] Reduce confidence by 10%
   - [ ] Still produce valid signals

3. **Data Gaps/Missing Candles**
   - [ ] Skip missing period, continue regime detection
   - [ ] Don't flip regime on gap
   - [ ] Resume normal operation

4. **Extreme Volatility (Flash Crash)**
   - [ ] Detect but don't flip regime
   - [ ] Use ATR smoothing (14-period SMA)
   - [ ] Single spike ≠ regime change

5. **Regime Oscillation (Whipsaw)**
   - [ ] Hysteresis prevents flipping more than once per hour
   - [ ] Maximum flip frequency: 1 per 60 candles
   - [ ] Track false flips, keep < 5%

**Code Location**: `tests/phase-2-edge-cases.test.ts` (new)

---

### Step 3.4: Performance Dashboard Metrics

**What to track**:

```typescript
interface Phase2Metrics {
  // Regime Detection
  currentRegime: string;
  regimeConfidence: number;
  regimeAge: number;  // Candles since regime started
  multiTimeframeAgreement: number;  // 0-1
  lastRegimeFlip: timestamp;
  regimeFlipFrequency: number;  // Flips per day
  
  // Weight Application
  currentWeights: { scanner: number; ml: number; rl: number };
  inTransition: boolean;
  transitionProgress: number;  // 0-1
  
  // Performance
  sourceWinRates: { scanner: number; ml: number; rl: number };
  dynamicWeightSharpe: number;
  fixedWeightSharpe: number;
  improvement: number;  // %
}
```

**Dashboard Updates**:
- [ ] Show current regime + confidence
- [ ] Show current weights + transition progress
- [ ] Show source win rates by regime
- [ ] Show Sharpe improvement vs baseline
- [ ] Alerts: Low regime confidence, frequent flips

**Code Location**: Update `server/routes/signals.ts` with `/api/signals/regime-metrics`

---

## Debugging Guide

### Issue: Regime Detection Always Returns RANGING

**Diagnosis**:
1. Check data quality: `console.log('Recent ADX values:', adxHistory.slice(-10))`
2. Verify calculations: ADX = `(14 * prevADX + currentDI) / 15`
3. Check thresholds: TRENDING requires ADX > 25

**Fix**:
```typescript
// Verify ADX calculation
const adx = calculateADX(candles, 14);
console.log('ADX:', adx, 'Should be > 25 for TRENDING');

// Check input data
console.log('Candle range:', high - low, 'Should be > ATR for trending');
```

---

### Issue: Weights Flip Suddenly (Not Smooth)

**Diagnosis**:
1. Check if transition manager is enabled
2. Verify transition duration > 0
3. Check weight sum normalization

**Fix**:
```typescript
// Enable smooth transitions
const enableTransitions = true;
const transitionDuration = 4;  // candles

// Verify normalization
const sum = weights.scanner + weights.ml + weights.rl;
if (Math.abs(sum - 1.0) > 0.01) {
  // Renormalize
  return normalize(weights);
}
```

---

### Issue: Dynamic Weights Not Beating Baseline

**Diagnosis**:
1. Check if regime weights are correct
2. Verify weight adjustment is actually happening
3. Check for off-by-one errors in confidence calculation

**Fix**:
```typescript
// Log at aggregation point
console.log('Regime:', regime);
console.log('Weights:', weights);
console.log('Baseline weights:', [0.35, 0.35, 0.30]);
console.log('Different?', JSON.stringify(weights) !== JSON.stringify(baseline));
```

---

## Testing Command

```bash
# Run all Phase 2 tests
npm test -- --testPathPattern=phase-2-integration

# Run specific test section
npm test -- --testPathPattern=phase-2-integration --testNamePattern="Regime Types"

# Run with coverage
npm test -- --testPathPattern=phase-2-integration --coverage
```

---

## Success Checklist

By end of Phase 2, verify:

- [ ] All 4 regimes detected correctly (TRENDING, RANGING, VOLATILE, CONSOLIDATING)
- [ ] Multi-timeframe confirmation working (1H/4H/24H agreement)
- [ ] Hysteresis prevents false flips (require 2 consecutive confirmations)
- [ ] Weight matrices defined and tested for all regimes
- [ ] Smooth transitions: < 1% weight change per candle
- [ ] Weight sum always = 1.0 (normalized correctly)
- [ ] Regime-specific boost/penalties applied to signals
- [ ] Source win rates show expected patterns (Scanner→TRENDING, ML→RANGING, RL→VOLATILE)
- [ ] Dynamic weights beat fixed weights in backtest (>10% Sharpe improvement)
- [ ] False flip rate < 5% (hysteresis working)
- [ ] All edge cases handled gracefully
- [ ] Performance dashboard tracking regime metrics
- [ ] Documentation complete and tested

---

## Next Phase Preview

Once Phase 2 complete, Phase 3 adds **5-layer quality gating**:
- Tier-based confidence filtering (70%/65%/50% by asset tier)
- Composite entry quality scoring (trend + momentum + order flow + risk/reward)
- Clustering validation (multi-timeframe confluence)
- Consensus filtering (source agreement required)
- Performance dashboard with signal quality metrics

---

## Questions / Troubleshooting

See `PHASE_2_ARCHITECTURE.md` for visual diagrams and detailed explanations.

Check `CURRENT_REGIME_STATUS.md` for live regime definitions and examples.

Review `SIGNAL_SYSTEM_IMPLEMENTATION_ROADMAP.md` for overall context and dependencies.
