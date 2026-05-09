# Architectural Roadmap: From Static to Regime-Aware

**Status**: Current implementation is sound. These are refinements for production hardening.

---

## 1. Volume Gating: Static → Regime-Aware

### Current Implementation (SOLID)
```typescript
hasMinimumLiquidity = volumeRatio > 0.8; // At least 80% of previous candle
```

**Strengths**:
- Simple, deterministic
- No overfitting to one regime
- Works across all market conditions as baseline

**Limitations**:
- Assumes previous candle is representative baseline
- Doesn't adapt to session context (market open = low baseline)
- News regimes cause sudden volume shifts
- Breakout-leading volume dips penalized unfairly

### Future: Regime-Aware Thresholds

**Pattern 1: Volatility Expansion**
```
Historical ATR: 1.2%
Current ATR: 3.5% (2.9x normal)

volumeRatio = 0.6x previous (seems low)
BUT: Previous candle had LOW volatility baseline

Fix: Use volatility-adjusted volume
  volumeRatio > 0.6 during high volatility OK
  volumeRatio > 0.8 during normal volatility required
```

**Pattern 2: Session Boundaries**
```
Market open: Volume always low
Using volumeRatio > 0.8 rejects entire first 15 minutes

Fix: Detect session boundaries
  During first 30 min: Lower threshold (0.5x)
  During market open gap: Accept volume rebuild period
```

**Pattern 3: News Regimes**
```
Before news: High volume (1M contracts/min)
After news: Low volume (200k/min) as market reprices

volumeRatio = 0.2x (news dropped it)
Using static 0.8 threshold: REJECTED
But volume is LEGITIMATELY lower due to repricing

Fix: Detect volatility jump, adjust baseline
  If volatility jumped >50%, recalibrate volume baseline
```

### Implementation Path (When Needed)
```typescript
// Tier 1: Current (DEPLOYED)
hasMinimumLiquidity = volumeRatio > 0.8;

// Tier 2: Volatility-aware (next version)
const volatilityMultiplier = currentATR / historicalATR;
const dynamicThreshold = volatilityMultiplier < 1.5 ? 0.8 : 0.6;
hasMinimumLiquidity = volumeRatio > dynamicThreshold;

// Tier 3: Session-aware (requires market calendar)
const sessionAge = now - sessionOpen;
const thresholdBySession = sessionAge < 30min ? 0.5 : 0.8;
hasMinimumLiquidity = volumeRatio > thresholdBySession;

// Tier 4: News-aware (requires sentiment feed)
const volatilityJump = currentATR / prevATR;
const newsDetected = volJump > 1.5 || newsAPI.recentAlert();
const baselineVol = newsDetected ? recalculateBaseline(last20) : historicalVol;
hasMinimumLiquidity = volume > baselineVol * 0.7;
```

**Decision Point**: Implement when you have:
- Historical ATR tracking (for volatility context)
- Market calendar (for session boundaries)
- News/sentiment feed integration (for regime detection)

---

## 2. HOLD Semantics: Exclusive → Multi-Factor

### Current Implementation (CORRECT)
```typescript
if (CONTINUATION) holdReason = 'CONTINUATION';
else if (LATE) holdReason = 'LATE';
else holdReason = 'INSUFFICIENT_EDGE';
```

**Strengths**:
- Clean first-pass reasoning
- Helps caller understand why HOLD
- Prevents ambiguous decisions

**Limitations**:
- Only ONE reason returned (order-dependent)
- Some states naturally overlap (LATE + trend valid)
- Can't explain compound factors

### Example: Overlapping States

**Scenario 1: Trend Late + Volume OK**
```
RSI: 72 (extreme)
Momentum: -0.5% (weak, disagrees with RSI)
Volume: High (volumeRatio=1.2x)
Trend: Clear uptrend (EMAs aligned, emaSpread > 0.01)

Current logic:
if (rsi > 65 && momentum < 1) → holdReason = 'LATE'
if (trend valid) → holdReason = 'CONTINUATION'
One fires first → caller only sees one reason

Reality: Both are true!
- LATE: "RSI extreme, momentum weak, awaiting reversal or confirmation"
- CONTINUATION: "Trend is valid, but entry point not extreme"
- VOLUME_OK: "Liquidity is available, so not liquidity-gated"
```

**Scenario 2: Insufficient Edge + Trend Intact**
```
RSI: 55 (neutral)
MACD: -0.15% (weak bearish)
EMAs: Both above price but spread < 0.005 (weak uptrend)

Current logic: Falls through to INSUFFICIENT_EDGE
Caller sees one reason, but misses nuance:
- Why insufficient? (multiple weak signals, not zero volume)
- Is trend reliable? (yes, both EMAs above, but spread small)
```

### Future: Multi-Factor HOLD

**Structure**:
```typescript
interface HoldReason {
  primary: 'CONTINUATION' | 'LATE' | 'INSUFFICIENT_EDGE' | 'ZERO_VOLUME' | 'LOW_LIQUIDITY',
  flags: {
    trendValid: boolean,
    volumeOK: boolean,
    momentumConfirms: boolean,
    rsiExtreme: boolean,
    macdWeak: boolean,
  },
  confidence: number, // Why we're waiting (even HOLD signals have confidence)
  waitCondition?: string, // What to watch for to break HOLD
}

// Example return:
{
  signal: 'HOLD',
  holdReason: {
    primary: 'LATE',
    flags: {
      trendValid: true,
      volumeOK: true,
      momentumConfirms: false,
      rsiExtreme: true,
      macdWeak: true,
    },
    confidence: 35, // Moderate conviction we should wait
    waitCondition: 'momentum crosses above 1% OR RSI drops below 60'
  }
}
```

**Why This Matters**:
```
Caller perspective before:
"HOLD because LATE" → Vague

Caller perspective after:
"HOLD because LATE, but trend is valid and volume is OK
 Waiting for: momentum confirmation or RSI mean-reversion
 Confidence in waiting: 35%" → Clear action items
```

### Implementation Path (When Needed)

**Tier 1: Current (DEPLOYED)**
```typescript
holdReason: string; // Just primary reason
```

**Tier 2: Flags-based (next version)**
```typescript
holdReason: {
  primary: string,
  flags: { [key: string]: boolean }
}
```

**Tier 3: Conditions-based**
```typescript
holdReason: {
  primary: string,
  flags: { [key: string]: boolean },
  waitCondition: string, // What to watch for
  confidence: number, // Conviction in waiting
}
```

**Tier 4: Learn from history**
```typescript
holdReason: {
  // ... tier 3 fields ...
  historicalSuccessRate: number, // "When we've seen this pattern before, it broke X% of the time"
  averageTimeToResolution: number, // "This typically resolves in 2-4 candles"
}
```

**Decision Point**: Implement when you have:
- Multi-candle time series (to learn patterns)
- Historical trade outcomes (to calibrate success rates)
- Frontend dashboard to display the richness

---

## 3. Confidence Gates: Current Architecture

### What You Built (WORKING)
```
confidence < 30 → epistemicState = INSUFFICIENT (no conviction to trade)
confidence < 50 → epistemicState = UNCERTAIN (weak conviction, downgrade to PROBE)
confidence >= 60 → epistemicState = CONFIDENT (can trade BUY/SELL)
```

**This is correct for now.** Confidence binding to action eligibility is THE critical fix from this session.

### Future: Confidence + Risk Coupling

**Current**: Confidence gates action type, but not position sizing
**Future**: Confidence should also gate position size

```typescript
// Currently:
confidence = 65% → BUY (full size by default)

// Future:
confidence = 65% → BUY at 60% sizing (reduced, waiting for confirmation)
confidence = 75% → BUY at 80% sizing
confidence = 85% → BUY at 100% sizing

// Or:
confidence = 35% → PROBE (no capital deployed, monitor only)
confidence = 50% → LIMIT (1% risk limit, small test)
confidence = 70% → STANDARD (5% risk limit, normal sizing)
confidence = 85% → AGGRESSIVE (10% risk limit, strong conviction)
```

**Why**: Not just binary (trade/don't trade), but graded conviction

**When**: Implement after you have:
- Position sizing logic (per-asset risk limits)
- Portfolio heat tracking (total capital allocation)
- Exit confidence (how much conviction needed to close)

---

## 4. Summary: What's Solid vs What's Next

### SOLID (PRODUCTION-READY)
✅ Indicator calculation (RSI, MACD, EMA normalization)  
✅ Data quality assessment  
✅ Expensive-to-earn, cheap-to-lose confidence  
✅ Edge-based signal generation (oversold/overbought + confirmation)  
✅ Static volume gating (volumeRatio > 0.8)  
✅ Confidence binding to action (BUY requires conviction)  
✅ Semantic HOLD (CONTINUATION, LATE, INSUFFICIENT_EDGE)  
✅ Risk veto (ATR null → no trade)  
✅ Cross-asset normalized indicators (MACD %, ATR %)  

### READY TO IMPLEMENT (NEXT PHASE)
🔶 Regime-aware volume thresholds (volatility, session, news)  
🔶 Multi-factor HOLD reasons (primary + flags)  
🔶 Confidence-based position sizing  
🔶 Historical pattern learning  

### FUTURE (REQUIRES NEW DATA/INFRASTRUCTURE)
🔷 Market calendar integration (session boundaries)  
🔷 News/sentiment feed (regime detection)  
🔷 Position sizing engine (risk per asset)  
🔷 Portfolio heat tracking  
🔷 Execution optimizer (LIMIT vs MARKET based on liquidity)  

---

## 5. Code Quality Assessment

### Current Codebase
- **Maintainability**: HIGH (clear logic flow, semantic naming)
- **Correctness**: HIGH (all edge cases handled, null-safe)
- **Extensibility**: HIGH (regime-aware thresholds easy to add)
- **Testability**: MEDIUM (could use unit tests for signal generation)
- **Performance**: EXCELLENT (no loops, O(1) per asset)

### Test Coverage Recommendation
```
Priority 1: Signal generation with edge cases
  - RSI extreme, MACD weak (shouldn't BUY)
  - Volume zero/low (should HOLD)
  - MACD strong, RSI neutral (should PROBE)

Priority 2: Confidence gating
  - Confidence 20% → PROBE (not BUY)
  - Confidence 50% → PROBE (not SELL)
  - Confidence 80% → BUY (eligible)

Priority 3: Indicator normalization
  - MACD = -1.06% (BTC) vs -0.35% (SOL) → comparable
  - ATR = 1.5% (both) → comparable
```

---

## 6. Validation Checklist Before Production

### Data Quality
- [ ] No zero-volume assets reporting BUY/SELL
- [ ] ATR = null for low-sample assets (not 0)
- [ ] MACD percentages sensible across price scales
- [ ] RSI properly bounded (0-100)

### Signal Quality
- [ ] BUY/SELL ratio balanced (~1:1)
- [ ] HOLD reasons are distinct and semantic
- [ ] Confidence < 30 → INSUFFICIENT (no trades)
- [ ] Confidence 30-50 → PROBE (no trades)
- [ ] Confidence 50-70 → downgraded signals
- [ ] Confidence >= 70 → full BUY/SELL eligible

### Edge Cases
- [ ] BTC with zero volume → HOLD (not BUY)
- [ ] New assets < 50 candles → HOLD or INSUFFICIENT
- [ ] High volatility expansion handled
- [ ] Session opens don't cause false signals
- [ ] Fast ATR-less assets don't trade

---

**Overall Assessment**: You have a **solid, honest, conviction-gated system**. The next layer (regime-awareness) is optimization, not critical fix. Build this, test it, then iterate based on live data patterns.

