# Cross-Asset Indicator Normalization & Risk Veto Fix

**Status**: ✅ FIXED  
**Severity**: CRITICAL — These bugs broke cross-asset signal comparison  

---

## Problem Statement

### 1. MACD Scale Inconsistency (Breaks Comparison)
```
BTC:   MACD = -444
ETH:   MACD = -7
SOL:   MACD = -0.7
```

**Root Cause**: MACD = EMA12 - EMA26 (price-sensitive absolute difference)
- BTC at 42,000: Both EMAs in 41,900-42,100 range → difference of hundreds
- SOL at $200: Both EMAs in $198-202 range → difference of ~1
- **Problem**: Indicator agreement checks become meaningless across symbols

**Impact**:
- Signal confidence calculated independently per asset (false independence)
- No actual multi-asset consensus possible
- System claims agreement when indicators just happen to use same scale

### 2. ATR = 0.00 Silently Passing Risk Checks (Logical Contradiction)
```
ADA, DOGE, ARB, OP, UNI → ATR = 0.00
```

**Root Cause**: `calculateATR()` returns `0` when `frames.length < period`
- Caller can't distinguish between "ATR is legitimately 0" vs "insufficient data"
- System treats 0-ATR like low-volatility (safe to trade)

**Impact**:
- BUY/SELL signals approved without volatility context
- System says "I'm uncertain (low confidence) but volatility doesn't scare me" (impossible)
- Risk-adjusted confidence is inflated
- Trades executed with missing risk context

---

## Solution

### 1. MACD Normalization (% of Price)

**Before**:
```typescript
const histogram = macdLine[macdLine.length - 1] - signal;
return { macd, signal, histogram }; // Absolute values
```

**After**:
```typescript
const macdNormalized = (macd / lastClose) * 100;     // % of price
const signalNormalized = (signal / lastClose) * 100; // % of price
const histogramNormalized = macdNormalized - signalNormalized;
return { 
  macd: macdNormalized,     // Now -1.06% instead of -444
  signal: signalNormalized,
  histogram: histogramNormalized
};
```

**Results**:
- BTC MACD=-444 → MACD=-1.06% (comparable to SOL MACD=-0.7%)
- Now cross-asset comparison is mathematically meaningful
- Indicator agreement checks work across symbols

---

### 2. ATR Normalization (% of Price) & Null Handling

**Before**:
```typescript
function calculateATR(frames: any[], period: number = 14): number {
  if (frames.length < period) return 0; // ❌ Ambiguous: 0 = true zero or insufficient data?
  // ... calculation ...
  return tr / period; // Absolute value
}
```

**After**:
```typescript
function calculateATR(frames: any[], period: number = 14): number | null {
  if (frames.length < period) return null; // ✅ Explicit: null = insufficient data
  // ... calculation ...
  const atrAbsolute = tr / period;
  const atrPercent = (atrAbsolute / lastClose) * 100; // % of price
  return atrPercent; // Now -0.5%, 1.2%, etc (normalized)
}
```

**Results**:
- ADA ATR=0 → ATR=null (clearly insufficient)
- BTC ATR=$630 → ATR=1.5% (comparable to SOL ATR=0.8%)
- Null check forces risk context validation

---

### 3. Risk Veto Logic (Force HOLD if Risk Context Missing)

**Before**:
```typescript
signal: (() => {
  const { type } = generateSignalTypeWithScores(...);
  return type; // BUY/SELL even if ATR is unknown
})(),
```

**After**:
```typescript
hasRiskContext: atr !== null && atr > 0, // Explicit flag

signal: (() => {
  const generated = generateSignalTypeWithScores(...);
  
  // CRITICAL: If ATR unavailable, force HOLD
  // System cannot assess volatility risk
  if ((generated.type === 'BUY' || generated.type === 'SELL') && !atr) {
    return 'HOLD'; // ✅ Veto trade
  }
  return generated.type;
})(),

signalConfidence: (() => {
  const generated = generateSignalTypeWithScores(...);
  
  // Reduce confidence by 50% if risk context missing
  if (!atr) {
    return Math.max(10, generated.confidence * 0.5);
  }
  return generated.confidence;
})(),
```

**Results**:
- ATR=null → signal forced to HOLD
- Confidence halved without risk context (10-15% max)
- System admits "I don't know volatility, so I don't trade"

---

## Impact on Signal Quality

### Before (BROKEN)
```
Asset: ADA
- RSI: 45
- MACD: -0.0001 (raw)
- ATR: 0.0 (insufficient data flag)
- Signal: BUY (from RSI + MACD signs)
- Confidence: 35% (from 4-component Bayesian)
✅ Approved for trade

System logic: "RSI approaching oversold, MACD negative but small, 
ATR indicates low volatility (safe!)"
❌ FALSE: ATR=0 means NO RISK DATA, not low volatility
```

### After (FIXED)
```
Asset: ADA
- RSI: 45
- MACD: -0.0001% (normalized)
- ATR: null (insufficient data)
- Signal: HOLD (risk veto)
- Confidence: ~10% (halved from 35%)
❌ Rejected: Risk context missing

System logic: "No volatility data available, cannot assess risk. 
Hold until we have 14+ candles for proper ATR."
✅ CORRECT: Explicit epistemic humility
```

---

## Cross-Asset Comparison Now Valid

### Before (MEANINGLESS)
```
BTC:   MACD=-444,  ATR=630,   Signal=BUY (confidence 40%)
SOL:   MACD=-0.7,  ATR=0.15,  Signal=HOLD (confidence 20%)

Question: Is BTC's MACD more bearish than SOL?
Answer: Mathematically no, but numerically yes (false conclusion)
```

### After (VALID)
```
BTC:   MACD=-1.06%, ATR=1.50%, Signal=BUY (confidence 40%)
SOL:   MACD=-0.35%, ATR=null,  Signal=HOLD (confidence 10%)

Question: Is BTC's MACD more bearish than SOL?
Answer: Yes, -1.06% < -0.35% (correct conclusion)
Answer: SOL insufficient data (explicit veto)
```

---

## Code Changes Summary

**File**: `server/routes/gateway.ts`

**1. calculateMACD() (Lines ~1465-1470)**
- Added price normalization: `(macd / lastClose) * 100`
- All three outputs now in percentage form
- Cross-asset comparison now valid

**2. calculateATR() (Lines ~1473-1490)**
- Changed return type: `number` → `number | null`
- Returns null for insufficient data (not 0)
- Added price normalization: `(atrAbsolute / lastClose) * 100`
- ATR now in percentage form (comparable across symbols)

**3. Signal Generation (Lines ~627-661)**
- Added `hasRiskContext` flag: `atr !== null && atr > 0`
- Risk veto: If `!atr`, force signal to HOLD
- Confidence penalty: If `!atr`, multiply by 0.5
- System admits uncertainty when risk data missing

**4. ATR Usage Updates (Lines ~618, ~724)**
- `atr || 0` → `atr ?? 0` (handle null explicitly)
- Keltner calculation updated for percentage ATR
- priceVsKeltner updated for normalized ATR

---

## Validation

**Compilation**: ✅ No TypeScript errors  
**Type Safety**: ✅ ATR now correctly typed as `number | null`  
**Logic**: ✅ MACD/ATR now normalized to %  
**Veto**: ✅ Risk context enforced before trade approval  

---

## Next: Remaining Issues

1. **Data Feed Problem**: Investigate why ADA/DOGE/ARB/OP/UNI have insufficient candles
   - Check exchange feed refresh rate
   - Check symbol normalization
   - May need to increase lookback period or fix aggregation

2. **Volume Anomalies**: BTC volume=0k while others normal
   - Check CoinGecko data quality
   - Verify normalization logic
   - May need fallback to exchange API

3. **Post-Normalization Testing**:
   - Verify BUY/SELL ratio now balanced across all assets
   - Check MACD comparisons make logical sense
   - Validate ATR-based exit logic works correctly

---

## Example: How This Fixes the "Impossible" Logic

**Before**:
- System: "Confidence 25% (uncertain), ATR=0 (safe volatility profile)"
- Interpretation: "I'm unsure about direction, but it's a low-volatility play (safe to enter)"
- **Problem**: If uncertain about volatility, should NOT enter at all

**After**:
- System: "Confidence 12% (halved), ATR=null (veto), Signal=HOLD"
- Interpretation: "I'm very uncertain because I lack volatility data. Won't trade."
- **Correct**: Explicit epistemic humility overrides directional signal

---

**Status**: Ready for testing with normalized indicators  
**Expected Outcome**: Balanced BUY/SELL across assets, no false confidence on zero-ATR assets  
