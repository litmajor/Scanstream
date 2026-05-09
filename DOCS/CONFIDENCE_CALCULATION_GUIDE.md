# Signal Confidence Calculation Guide

## Overview
This document explains how confidence scores are calculated across different signal types in Scanstream. Confidence values are normalized to a 0-1 range (displayed as 0-100%).

---

## 1. ML Predictions Confidence

### A. Direction Confidence (Bullish/Bearish Signals)
**Formula**: `confidence = Math.abs(probability - 0.5) * 2`

**How it works**:
- Direction is predicted using a weighted score from 8 features:
  - Momentum (5-period): 0.35 weight
  - Momentum (10-period): 0.25 weight
  - MACD: 0.4 weight
  - Trend Strength: 0.30 weight
  - Volume Ratio: 0.15 weight
  - Price Change (5-period): 0.20 weight
  - RSI: -0.002 weight (inverse - overbought = bearish)
  - Mean Reversion: -0.10 weight

- Weighted features are normalized to probability (0-1)
- Confidence = distance from 50/50 fence × 2
  - If probability = 0.9 (90% bullish): confidence = |0.9 - 0.5| × 2 = 0.8 (80%)
  - If probability = 0.51 (barely bullish): confidence = |0.51 - 0.5| × 2 = 0.02 (2%)
  - If probability = 0.5 (50/50): confidence = 0 (0%)

**Range**: 0 to 1.0 (0% to 100%)
**Interpretation**: How far the prediction deviates from a coin flip

---

### B. Price Prediction Confidence
**Formula**: `confidence = Math.min(1, Math.abs(trendStrength) * (1 - volatility))`

**How it works**:
- Combines two factors:
  1. **Trend Strength** (0 to ~1.5): How strong the current trend is
  2. **Volatility** (0 to ~0.1): How volatile the market is
  
- Higher trend strength = more reliable prediction
- Lower volatility = more reliable prediction
- Both are multiplied, then capped at 1.0

**Example**:
- Strong trend (0.8), low volatility (0.05): confidence = min(1, 0.8 × 0.95) = 0.76 (76%)
- Weak trend (0.2), high volatility (0.08): confidence = min(1, 0.2 × 0.92) = 0.184 (18%)

**Range**: 0 to 1.0 (0% to 100%)
**Interpretation**: Reliability of price target based on trend and market stability

---

### C. Volatility Prediction Confidence
**Formula**: `confidence = Math.max(0.3, 1 - volatilityStandardDeviation * 10)`

**How it works**:
- Measures consistency of recent volatility (last 10 candles)
- If volatility has been stable: high confidence
- If volatility has been erratic: low confidence
- Minimum floor of 0.3 (30%) even when erratic

**Example**:
- Stable volatility (std = 0.01): confidence = 1 - (0.01 × 10) = 0.9 (90%)
- Erratic volatility (std = 0.08): confidence = 1 - (0.08 × 10) = 0.2 → 0.3 (floor = 30%)

**Range**: 0.3 to 1.0 (30% to 100%)
**Interpretation**: Reliability of volatility forecast based on recent consistency

---

### D. Holding Period Confidence
**Base**: 0.5 (50%)

**Adjustments**:
1. **Volatility Level**:
   - Low volatility: +0.3 → 0.8 (80%)
   - High volatility: +0.2 → 0.7 (70%)
   - Extreme volatility: +0.35 → 0.85 (85%)

2. **Trend Strength**:
   - Strong trend (>0.6): +0.1 (max 0.9 or 90%)
   - Weak trend (<0.2): unchanged

3. **Direction Confidence**:
   - If direction confidence > 0.8: use direction confidence as minimum

**Range**: 0.5 to 0.9 (50% to 90%)
**Interpretation**: How confident we are about the optimal time to exit

---

## 2. Risk Score (Not Confidence - Different Metric)

**Note**: Risk score is 0-100 points (not a confidence percentage)

**Breakdown**:
- **Volatility Risk**: 0-30 points
  - Extreme: 30 points
  - High: 20 points
  - Medium: 10 points
  - Low: 0 points

- **Trend Uncertainty**: 0-20 points
  - Weak trend (<0.2): 20 points
  - Medium trend (0.2-0.4): 10 points
  - Strong trend: 0 points

- **Prediction Confidence Risk**: 0-25 points
  - Low confidence (<0.4): 25 points
  - Medium confidence (0.4-0.6): 15 points
  - High confidence: 0 points

- **RSI Extremes**: 0-15 points
  - Very extreme (>75 or <25): 15 points
  - Moderate extreme (>70 or <30): 8 points

- **Volume Anomalies**: 0-10 points
  - Very high volume (>3x): 10 points
  - Low volume (<0.5x): 5 points

**Risk Level Classification**:
- 0-24: Low
- 25-49: Medium
- 50-74: High
- 75+: Extreme

---

## 3. Signal Quality Confidence (From signal-quality.ts)

**Formula**: Calculated from confidence scores at `/api/signal-quality/all`

Confidence for each signal type:
- Gateway Signals: Uses confidence from signal metadata
- ML Signals: Uses direction.confidence × 100
- Unified Signals: Average of available confidence scores

---

## 4. Validation & Quality Checks

### What Makes Confidence TRUSTWORTHY:
✅ **High Direction Confidence (>70%)**
- Far from 50/50 prediction
- Strong feature agreement
- Clear bullish or bearish signal

✅ **High Price Confidence (>60%)**
- Strong trend present
- Low volatility environment
- Predictable price movement

✅ **High Volatility Confidence (>70%)**
- Recent volatility has been consistent
- Market is stable
- Easier to predict next move

✅ **High Holding Period Confidence (>75%)**
- Exit timing is clear
- Market conditions favor specific holding duration
- Good risk/reward potential

---

### What Makes Confidence UNRELIABLE:
❌ **Low Direction Confidence (<30%)**
- Near 50/50 prediction
- Conflicting feature signals
- Unclear market direction

❌ **High Volatility + High Risk Score (>50)**
- Unpredictable market
- Many warning factors present
- Whipsaw risk

❌ **Extreme Volatility Level**
- Market is chaotic
- Predictions less reliable
- Holding period = 2 candles (scalp only)

❌ **Low Volume**
- Thin market
- Easy to move prices
- Liquidity concerns

---

## 5. Recommendation for Using Confidence

### STRONG SIGNALS (Trust Level: HIGH)
- Direction Confidence > 75%
- Price Confidence > 70%
- Risk Score < 30
- Volatility Level: Low or Medium
- Volume Ratio: 0.8 to 2.0

### MODERATE SIGNALS (Trust Level: MEDIUM)
- Direction Confidence: 50-75%
- Price Confidence: 50-70%
- Risk Score: 30-50
- Can trade with smaller position size

### WEAK SIGNALS (Trust Level: LOW)
- Direction Confidence < 50%
- Price Confidence < 40%
- Risk Score > 50
- Consider skipping trade or using very tight stops

---

## 6. Feature Meanings (For Understanding Confidence)

| Feature | Range | Interpretation |
|---------|-------|-----------------|
| Momentum (5/10) | -1 to +1 | Recent price direction. Positive = upward |
| RSI | 0-100 | 30-70 = normal, <30 = oversold, >70 = overbought |
| MACD | -∞ to +∞ | Momentum & trend. Positive = bullish, Negative = bearish |
| Trend Strength | 0 to ~1.5 | How strong the current trend is. Higher = stronger |
| Volume Ratio | 0 to +∞ | 1.0 = normal, >1.5 = high, <0.5 = low |
| Volatility | 0 to ~0.1 | Price variation. Higher = more chaotic |

---

## 7. Example Signal Analysis

### Example 1: HIGH CONFIDENCE SIGNAL
```
Direction Confidence: 85%
- Probability: 0.925 bullish
- Calculation: |0.925 - 0.5| × 2 = 0.85 ✅

Price Confidence: 78%
- Trend Strength: 0.92
- Volatility: 0.05
- Calculation: min(1, 0.92 × 0.95) = 0.874 ✅

Risk Score: 15 (Low)
- Slight high volatility (+10)
- Strong trend (0)
- High confidence (-25 reduction)
- RSI normal (0)
- Normal volume (0)

Assessment: STRONG BUY
- Clear bullish signal
- Reliable price target
- Low risk environment
- Good for 1% account risk trade
```

### Example 2: LOW CONFIDENCE SIGNAL
```
Direction Confidence: 22%
- Probability: 0.51 bullish (barely)
- Calculation: |0.51 - 0.5| × 2 = 0.02 ❌

Price Confidence: 18%
- Trend Strength: 0.15 (weak)
- Volatility: 0.08 (high)
- Calculation: min(1, 0.15 × 0.92) = 0.138 ❌

Risk Score: 65 (High)
- High volatility (+20)
- Weak trend (+20)
- Low confidence (+25)
- RSI near extremes (+8)
- Volume spike (+5)

Assessment: SKIP OR SMALL POSITION
- Coin-flip direction prediction
- Unreliable price target
- High risk environment
- Better signals likely available
```

---

## 8. Troubleshooting

### Confidence Seems Too Low?
- Check **Volatility Level**: Extreme volatility reduces confidence
- Check **Trend Strength**: Weak trends reduce confidence  
- Check **Risk Score**: High risk indicators penalize confidence
- Check **Volume**: Unusual volume reduces reliability

### Confidence Seems Too High?
- Verify **Direction Confidence** calculation (should be 0 at 50/50)
- Check if **Volatility is unusually low** (can artificially boost confidence)
- Review **recent performance**: Confidence should match win rate

### Discrepancy Between Different Confidence Values?
- **Direction vs Price Confidence** may differ - normal
  - Direction = how clear the direction is
  - Price = how predictable the price movement is
- Combine multiple signals for better assessment

---

## 9. Validation Data

Last updated: 2025-12-04

The ML prediction service uses:
- 20+ technical features per signal
- Weighted scoring system
- Multi-model approach (Direction, Price, Volatility, Holding Period, Risk)
- Real market data from storage

**Important**: Confidence is a statistical measure, not a guarantee. Always use proper risk management.
