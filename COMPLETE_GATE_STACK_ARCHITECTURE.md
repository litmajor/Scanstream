# Scanstream Confidence Architecture: Complete Gate Stack

**Date**: December 15, 2025  
**Status**: All gates implemented and operational  

---

## The Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARKET DATA INGESTION                         │
│                   (OHLCV from exchanges)                         │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              1. INDICATOR CALCULATION (Honest)                   │
│                                                                  │
│  • RSI: Wilder's smoothing (proper formula)                      │
│  • MACD: Normalized % of price (cross-asset comparable)          │
│  • ATR: Normalized % of price (volatility risk context)          │
│  • EMA: Proper windowing (null if insufficient data)             │
│  • Data Quality: Detects zero volumes, flat markets, stale       │
│                                                                  │
│  ❌ Returns NULL for insufficient data (not defaults)            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│         2. COMPONENT SCORING (Expensive-to-Earn)                │
│                                                                  │
│  Technical Score:                                                │
│    • RSI: 0.45 if <30+MACD>0+above-EMA, 0 if neutral            │
│    • MACD: 0.3 if strong+confirmed, ignored if weak             │
│    • BB: 0.25 if at extremes, 0 if mid-range                    │
│    • EMA: 0.2 if aligned+spread, 0 if just one above            │
│                                                                  │
│  Order Flow Score:                                               │
│    • Momentum: 0.3 if strong (>2%), 0 if weak                   │
│                                                                  │
│  Micro Score:                                                    │
│    • Fixed at 0.5 (we don't have detailed microstructure)        │
│                                                                  │
│  Composite = 0.5×tech + 0.3×flow + 0.2×micro                    │
│  Range: -1.0 to +1.0                                             │
│                                                                  │
│  📊 NO PARTIAL CREDIT: 0 or full points                          │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           3. CONFIDENCE CALCULATION (Binding)                    │
│                                                                  │
│  Base: 10 (ultra-low floor, must be earned)                     │
│                                                                  │
│  Alignment points required:                                      │
│    • < 2 signals agree → max 40% confidence                      │
│    • 2 signals agree → max 60% confidence                        │
│    • 3+ signals agree → max 100% confidence                      │
│                                                                  │
│  Cheap-to-lose multipliers:                                      │
│    • Disagreement: 0.5-0.7x decay                               │
│    • Low sample: ×0.5 (strict penalty)                          │
│    • Weak signal: ×0.6                                          │
│                                                                  │
│  Epistemic state:                                                │
│    • < 30%: INSUFFICIENT                                        │
│    • 30-50%: UNCERTAIN                                          │
│    • 50%+: CONFIDENT                                            │
│                                                                  │
│  📈 HONEST: 10-100 range based on evidence quality              │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              4. VOLUME GATE (Hard Constraint)                    │
│                                                                  │
│  Check 1: hasNonZeroVolume = volume > 0                          │
│    ❌ ZERO_VOLUME → HOLD                                        │
│                                                                  │
│  Check 2: hasMinimumLiquidity = volumeRatio > 0.8               │
│    ❌ LOW_LIQUIDITY → HOLD                                      │
│                                                                  │
│  ⚠️  NO TRADES WITHOUT BUYERS/SELLERS                           │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            5. EDGE THRESHOLD (Logical Requirement)               │
│                                                                  │
│  Bullish: compositeScore > 0.35                                  │
│    (Eliminates midpoint bounces, requires clear oversold+conf)   │
│                                                                  │
│  Bearish: compositeScore < -0.35                                │
│    (Eliminates midpoint bounces, requires clear overbought+conf) │
│                                                                  │
│  No Edge: -0.35 ≤ compositeScore ≤ 0.35                         │
│    (Mixed signals, wait for clarity)                             │
│                                                                  │
│  📊 NOT JUST THRESHOLD: Requires edge + volume                  │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│          6. CONVICTION GATE (Belief Binding) ← NEW               │
│                                                                  │
│  Edge exists (compositeScore > ±0.35):                          │
│                                                                  │
│    IF confidence < 40%:                                          │
│      → HOLD | PROBE                                             │
│      Reason: "Edge exists but conviction too low"               │
│      Action: Watch without position                             │
│                                                                  │
│    IF confidence ≥ 40%:                                          │
│      → BUY or SELL                                              │
│      Reason: "Edge + conviction + volume approved"              │
│      Action: Enter position                                     │
│                                                                  │
│  🎯 CONVICTION GATES ACTION: 20% belief ≠ 60% belief            │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│          7. SEMANTIC HOLD CLASSIFICATION                         │
│                                                                  │
│  If signal = HOLD, classify reason:                              │
│                                                                  │
│    • ZERO_VOLUME: No market (data error)                        │
│    • LOW_LIQUIDITY: Volume dropped (execution risk)             │
│    • PROBE: Edge exists but low conviction (watch)              │
│    • CONTINUATION: Trend valid, no entry edge                   │
│    • LATE: Extreme reached, waiting for confirmation            │
│    • INSUFFICIENT_EDGE: Mixed signals (unclear)                 │
│                                                                  │
│  🏷️  SEMANTIC: Each HOLD tells caller exactly why               │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            8. FINAL SIGNAL + METADATA OUTPUT                     │
│                                                                  │
│  Return:                                                         │
│  {                                                               │
│    type: 'BUY' | 'SELL' | 'HOLD'                                │
│    strength: 0-100 (magnitude of edge)                          │
│    confidence: 10-100 (belief level)                            │
│    epistemicState: 'CONFIDENT'|'UNCERTAIN'|'INSUFFICIENT'      │
│    epistemicReasons: ['WEAK_TREND', 'LOW_ALIGNMENT', ...]      │
│    holdReason: 'ZERO_VOLUME'|'PROBE'|'CONTINUATION'|...        │
│    alignmentPoints: 0-5 (indicator agreement count)             │
│  }                                                               │
│                                                                  │
│  ✅ COMPLETE: Signal + reason + confidence + epistemic state    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Gate Sequence in Plain English

```
TRADER asks: "Should I buy BTC?"

SYSTEM:
1. Calculate honest indicators (RSI, MACD, ATR with proper normalization)
2. Score each component (0 for weak, full points for strong)
3. Calculate confidence from component agreement (starts at 10)
4. Check volume (must have buyers/sellers)
5. Check edge (must exceed ±0.35 threshold)
6. Check conviction (must have ≥40% belief)
7. Classify HOLD reason if signal rejected
8. Return decision + full reasoning

If any gate FAILS:
  → HOLD with semantic reason
  → Caller knows EXACTLY why (not just "failed threshold")
```

---

## The Three Types of Rejection

| Gate | Type | Reason | Caller Action |
|------|------|--------|---------------|
| Volume | Hard constraint | No liquidity | Wait for volume |
| Edge | Logical threshold | No clear edge | Wait for extremes |
| Conviction | Belief binding | Low confidence | PROBE, don't trade |

---

## Confidence Integrity Check

### Before (Honest Calculation, Non-Binding)
```
Confidence: 19%
compositeScore: 0.37 (> 0.35)
Signal: BUY
Problem: 19% conviction → full position entry
System: "I'm unsure but trading anyway"
```

### After (Honest Calculation, Binding)
```
Confidence: 19%
compositeScore: 0.37 (> 0.35)
Conviction check: 19% < 40% → DOWNGRADE
Signal: HOLD | PROBE
Reason: "Edge exists but conviction insufficient"
System: "I'm unsure, so I'm watching instead of trading"
```

---

## Summary: What Changed in Session

| Component | Before | After | Impact |
|-----------|--------|-------|--------|
| **Indicators** | Broken formulas | Proper calculations + null safety | Honest signals |
| **Confidence** | 0-100, informative | 10-100, honest + binding | Confidence matters |
| **Volume** | Soft weight | Hard gate | Can't trade zero-volume |
| **HOLD** | Threshold artifact | 6 semantic types | Caller understands why |
| **Edge** | 0.15 threshold | 0.35 threshold | Eliminates bounces |
| **Conviction** | Cosmetic | Binding gate | Belief controls action |
| **Data Quality** | Ignored | Penalizes confidence | Honest about uncertainty |
| **Epistemic State** | None | INSUFFICIENT/UNCERTAIN/CONFIDENT | Clarity on belief |

---

## System Properties (Now True)

✅ **Indicators are honest**: Proper formulas, null on insufficient data  
✅ **Confidence is honest**: Starts low, requires evidence, penalizes disagreement  
✅ **Confidence is binding**: Low belief → no trade (PROBE only)  
✅ **Volume is mandatory**: Can't trade without liquidity  
✅ **HOLD is semantic**: Each type explains exactly why  
✅ **Epistemic state is explicit**: System admits uncertainty  
✅ **Cross-asset comparable**: MACD/ATR normalized to %  
✅ **Edge and conviction separate**: Edge ≠ belief  

---

## Example: Complete Signal Flow

```
Input: BTC OHLCV for 1h timeframe

Step 1: Calculate indicators
  RSI(14) = 28 (Wilder's smoothing)
  MACD = -1.06% (normalized to price)
  ATR = 1.50% (normalized to price)
  EMA20 = 42,100; EMA50 = 41,950
  Data quality = GOOD (20+ candles)

Step 2: Score components
  RSI: 0.15 (just oversold, no confirmation)
  MACD: 0.0 (not strong enough to confirm alone)
  EMA: 0.0 (not aligned enough)
  Result: technicalScore = 0.15

Step 3: Calculate confidence
  alignmentPoints = 1 (only RSI)
  confidence = 10 + (0.15 * 50) = 17%
  epistemicState = 'INSUFFICIENT'

Step 4: Check volume
  volumeRatio = 0.0 (zero volume)
  hasNonZeroVolume = false
  → HOLD (ZERO_VOLUME)

Step 5: Check edge
  compositeScore = (0.15 * 0.5) + ... = 0.18
  Not needed (volume gate already rejected)

Step 6: Check conviction
  Not needed (volume gate already rejected)

Output:
{
  type: 'HOLD',
  holdReason: 'ZERO_VOLUME',
  confidence: 17,
  epistemicState: 'INSUFFICIENT',
  epistemicReasons: ['ZERO_VOLUME', 'LOW_ALIGNMENT'],
  strength: 15,
  alignmentPoints: 1
}

Caller interpretation:
"BTC shows some oversold signs, but:
1. Zero volume (no market)
2. Low confidence (only RSI, no confirmation)
Result: Cannot trade. Wait for volume + stronger alignment."
```

---

## What Traders See (After Gate Stack)

Instead of seeing just "BUY" or "SELL", traders now see:

```
PROBE: Edge exists, conviction too low
  Recommendation: Watch without position, re-evaluate if conviction rises

CONTINUATION: Trend valid, no entry edge
  Recommendation: Hold current position, wait for overextension

LATE: Reversal possibly coming
  Recommendation: Reduce position, prepare for trend change

ZERO_VOLUME: No market participants
  Recommendation: Wait for volume revival

LOW_LIQUIDITY: Volume below average
  Recommendation: Wait for liquidity increase

BUY: Edge + volume + conviction all confirmed
  Recommendation: Enter position with confidence
```

---

**Architecture Complete**: All gates implemented and tested  
**System Integrity**: Confidence now controls action  
**Ready for**: Position sizing, exit logic, portfolio weighting layers
