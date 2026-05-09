# Current Regime Status & Market Intelligence

**Last Updated:** December 16, 2025  
**Status:** Active Monitoring  
**System Health:** Operational

---

## Executive Summary

The Scanstream platform uses an advanced **Market Regime Detection System** to classify market conditions and inform trading decisions. This document provides a comprehensive overview of the current regime framework, how it works, and how to interpret regime signals.

---

## What is Market Regime?

A **market regime** describes the current market condition and behavior pattern. Rather than treating all markets as identical, the system recognizes that markets move through distinct phases:

- **Trending Regimes** - Strong directional movement (bullish or bearish)
- **Range-Bound Regimes** - Sideways movement within a band
- **Volatile Regimes** - High volatility with unclear direction
- **Low Volatility Regimes** - Calm, stable conditions

---

## Current Regime Types

The system classifies markets into these primary regimes:

### 1. **Bull Trending** (`bull_trending`)
- Market moving upward with conviction
- Higher lows and higher highs pattern
- Favors long positions
- **Characteristics:**
  - Price above all major moving averages
  - Positive momentum
  - Rising volume on up moves
  - ADX > 25 (strong trend)
- **Trading Bias:** Long-biased
- **Risk Level:** Moderate

### 2. **Bear Trending** (`bear_trending`)
- Market moving downward with conviction
- Lower highs and lower lows pattern
- Favors short positions
- **Characteristics:**
  - Price below all major moving averages
  - Negative momentum
  - Rising volume on down moves
  - ADX > 25 (strong trend)
- **Trading Bias:** Short-biased
- **Risk Level:** Moderate-High

### 3. **Bull Range-Bound** (`bull_range_bound`)
- Uptrend with consolidation phases
- Price oscillating within an upper band
- Mix of trend and mean-reversion opportunities
- **Characteristics:**
  - Price between EMA20 and EMA50
  - Low ADX (< 25)
  - Support/resistance levels defined
  - Volume declining
- **Trading Bias:** Bullish but cautious
- **Risk Level:** Low-Moderate

### 4. **Bear Range-Bound** (`bear_range_bound`)
- Downtrend with consolidation phases
- Price oscillating within a lower band
- Mix of trend and mean-reversion opportunities
- **Characteristics:**
  - Price between EMA20 and EMA50
  - Low ADX (< 25)
  - Support/resistance levels defined
  - Volume declining
- **Trading Bias:** Bearish but cautious
- **Risk Level:** Moderate

### 5. **Consolidation** (`consolidation`)
- No clear directional bias
- High uncertainty
- Prepare for breakout
- **Characteristics:**
  - Price near major moving average midpoints
  - Very low ADX (< 20)
  - Tight range
  - Decreasing volume
- **Trading Bias:** Neutral/Wait
- **Risk Level:** High (breakout risk)

### 6. **High Volatility** (`high_volatility`)
- Rapid swings in both directions
- Potential opportunity or extreme risk
- Requires defensive positioning
- **Characteristics:**
  - High volatility readings
  - Unclear momentum direction
  - Whipsaws common
  - Volume spikes
- **Trading Bias:** Defensive
- **Risk Level:** Very High

---

## Regime Direction Signals

Each regime now includes a **Trend Direction** indicator:

### Direction Types

```
↑ UP        - Market moving higher
↓ DOWN      - Market moving lower
→ SIDEWAYS  - Choppy/indecisive
```

### How Direction is Determined

1. **EMA Alignment Check**
   - Bull Signal: Price > EMA20 > EMA50 > EMA200
   - Bear Signal: Price < EMA20 < EMA50 < EMA200
   - Neutral Signal: Mixed alignment

2. **Momentum Confirmation**
   - 10-period return confirms direction
   - Recent gains = UP confirmation
   - Recent losses = DOWN confirmation

3. **ADX Level** (0-100 scale)
   - Measures trend strength regardless of direction
   - < 20 = Very weak/no trend
   - 20-25 = Weak trend
   - 25-40 = Moderate trend
   - 40+ = Strong trend

---

## Sample Regime Response

When you query the regime detector, you get comprehensive data:

```json
{
  "regime": "bull_trending",
  "trendDirection": "UP",
  "confidence": 0.85,
  "metrics": {
    "trendStrength": 0.72,
    "volatility": 0.018,
    "volume": 1.15,
    "momentum": 0.067,
    "trendDirection": "UP",
    "emaSlope": 12.45,
    "adxLevel": 45
  },
  "description": "Strong UPTREND (Direction: ↑ UP, ADX: 45)",
  "tradingImplications": [
    "📈 Favor long positions",
    "✅ Use tight stops",
    "💡 Buy dips within trend",
    "⚠️ Avoid shorting",
    "📊 Increasing volume expected"
  ],
  "suggestedActions": {
    "positionType": "LONG",
    "stopPlacement": "TIGHT",
    "riskLevel": "MODERATE",
    "volumeExpectation": "RISING"
  }
}
```

---

## Key Metrics Explained

### Trend Strength (0-1)
- Normalized measure of how strong the trend is
- Combines ADX, momentum, and price action
- 0.7+ = Strong trend

### Volatility (0-1)
- Current price volatility as percentage
- 0.01 = 1% volatility
- 0.03+ = Above average
- < 0.02 = Calm conditions

### Volume (ratio)
- Current volume vs average
- 1.0 = Normal volume
- > 1.2 = High volume
- < 0.8 = Low volume

### Momentum (0-1)
- Rate of price change
- Positive = Up momentum
- Negative = Down momentum

### EMA Slope
- Rate of change in exponential moving average
- Positive = EMA rising (bullish)
- Negative = EMA falling (bearish)

### ADX Level (0-100)
- **0-20:** No trend (ranging market)
- **20-25:** Weak trend
- **25-40:** Moderate trend
- **40+:** Strong trend
- **50+:** Very strong trend

---

## How Agents Use Regime Information

### TrendRider Agent
- Increases confidence when in BULL_TRENDING with UP direction
- Reduces position size in CONSOLIDATION
- Avoids trades in HIGH_VOLATILITY

### ReversalMaster Agent
- Looks for reversals at edges of BULL_RANGE_BOUND
- More aggressive in BEAR_TRENDING reversals
- Sits out during strong trends (high ADX)

### BreakoutHunter Agent
- Waits for CONSOLIDATION regime
- Trades breakouts when ADX > 25
- Prefers high-volume breakouts

### ScalpingBot Agent
- Active in all regimes but scales size
- Most active in HIGH_VOLATILITY (wider spreads)
- Careful in CONSOLIDATION (less predictable)

### ExitMaster Agent
- Tightens stops when ADX > 40 (strong trend)
- Relaxes stops when ADX < 20 (no clear direction)
- Increases take-profit frequency in CONSOLIDATION

---

## Regime Transitions & Changepoints

The system tracks when regimes change:

### Common Transitions
```
BULL_TRENDING → CONSOLIDATION → BEAR_TRENDING
                (top formation)

BEAR_TRENDING → CONSOLIDATION → BULL_TRENDING
                (bottom formation)

BULL_RANGE_BOUND → CONSOLIDATION → HIGH_VOLATILITY
                  (breakdown risk)
```

### Early Warning Signs
- **ADX declining** = Trend weakening
- **Volatility expanding** = Potential breakout
- **Volume dropping** = Consolidation warning
- **Momentum divergence** = Reversal risk

---

## Trading Strategy by Regime

### In BULL_TRENDING (↑ UP)
✅ **Do:**
- Take long positions on dips
- Use tight trailing stops
- Buy higher lows
- Expect higher highs

❌ **Don't:**
- Short the trend
- Use wide stops
- Average down on losses
- Ignore support breaks

### In BEAR_TRENDING (↓ DOWN)
✅ **Do:**
- Take short positions on rallies
- Use tight trailing stops
- Short lower highs
- Expect lower lows

❌ **Don't:**
- Go long the trend
- Use wide stops
- Catch falling knives
- Ignore resistance breaks

### In CONSOLIDATION (→ SIDEWAYS)
✅ **Do:**
- Trade the range (buy support, sell resistance)
- Prepare for breakout
- Watch volume carefully
- Use mean-reversion strategies

❌ **Don't:**
- Trade breakout direction prematurely
- Use trend-following strategies
- Place wide stops
- Increase position size

### In HIGH_VOLATILITY
✅ **Do:**
- Reduce position size
- Use wider stops
- Trade smaller timeframes
- Watch for the next regime

❌ **Don't:**
- Hold large positions
- Expect smooth price action
- Chase moves
- Ignore risk management

---

## Confidence Score

Each regime detection includes a **confidence score** (0-1):

- **0.8-1.0:** Very confident - act on signals
- **0.6-0.8:** Moderately confident - proceed with caution
- **0.4-0.6:** Low confidence - wait for confirmation
- **< 0.4:** Very low confidence - sit out or reduce size

**Confidence is reduced when:**
- ADX is ambiguous (20-25 range)
- Momentum divergence detected
- Multiple timeframes disagree
- Recent regime change
- High volatility spike

---

## Real-Time Monitoring

The system continuously monitors:

1. **Per-Symbol Regime** - Each trading pair gets its own regime
2. **Multi-Timeframe** - Regime on 1H, 4H, 1D, 1W
3. **Regime Persistence** - How long has it been in current regime?
4. **Regime Stability** - Is regime likely to persist?
5. **Upcoming Transitions** - Early warnings of regime changes

---

## Integration Points

### Market Oracle
```typescript
snapshot.regime = 'bull_trending';
snapshot.regimeDirection = 'UP';
snapshot.regimeStrength = 45; // ADX
snapshot.regimeConfidence = 0.85;
```

### Agent Decision Making
```typescript
if (regimeData.regime === 'bull_trending' && 
    regimeData.trendDirection === 'UP' && 
    regimeData.metrics.adxLevel > 30) {
  // Strong uptrend - high confidence long
  return { action: 'LONG', confidence: 0.95 };
}
```

### UI Display
- Regime badge shows current classification
- Direction arrow (↑/↓/→) shows trend direction
- ADX bar shows trend strength
- Confidence indicator shows reliability
- Color coding: Green (bull), Red (bear), Yellow (neutral)

---

## Technical Implementation

### Detection Method
Located in: `server/services/ml-regime-detector.ts`

**Core Calculations:**
1. Calculate EMA20, EMA50, EMA200
2. Calculate ADX (14-period standard)
3. Measure momentum (10-bar return)
4. Calculate volatility (standard deviation)
5. Measure volume trend
6. Classify into regime category
7. Determine direction based on EMA alignment
8. Set confidence based on metric alignment

### Data Sources
- OHLCV price data from market data layer
- 100+ candles for complete calculation
- Real-time updates on each new candle

### Computation Time
- ~20-50ms per symbol
- Can handle 100+ symbols simultaneously
- Non-blocking async operation

---

## Dashboard Interpretation

When viewing the regime dashboard:

| Field | Meaning | Good Value |
|-------|---------|-----------|
| Regime | Market condition | Trending > Ranging |
| Direction | Price direction | ↑ or ↓ (not →) |
| ADX | Trend strength | > 25 |
| Confidence | Signal reliability | > 0.75 |
| Volatility | Price movement variance | Context-dependent |
| Volume | Trading activity | > 1.0x average |
| Momentum | Rate of change | Aligned with direction |

---

## Alerts & Notifications

The system generates alerts for:

1. **Regime Change** - "Switched from BULL to CONSOLIDATION"
2. **Strong ADX** - "Very strong uptrend (ADX: 52)"
3. **Confidence Drop** - "Regime confidence fell below 0.5"
4. **Volatility Spike** - "High volatility regime detected"
5. **Momentum Divergence** - "Direction signal weakening"

---

## Best Practices

### ✅ DO
- Always check regime before trading
- Align strategy with current regime
- Respect regime transitions
- Scale position size with ADX
- Use regime for stop-loss placement
- Monitor regime changes in real-time

### ❌ DON'T
- Ignore regime classification
- Trade against clear trends
- Use same strategy in all regimes
- Place tight stops in high-volatility
- Assume regime persists forever
- Trade on low-confidence signals

---

## FAQ

**Q: How often does regime change?**  
A: Varies by asset and timeframe. Can change daily (intraday) or persist for weeks (longer timeframes).

**Q: Which regime is best for trading?**  
A: BULL_TRENDING with high ADX is ideal for directional traders. CONSOLIDATION is ideal for range traders.

**Q: Can I trust low-confidence signals?**  
A: Not recommended. Wait for confidence > 0.75 or take smaller positions.

**Q: What if regimes disagree across timeframes?**  
A: Trade in the direction of the larger timeframe. Example: 1D bull but 1H bear = take small longs on 1H dips.

**Q: How does regime affect risk management?**  
A: High-trend regimes (high ADX) = wider stops acceptable. Low-trend regimes = tighter stops needed.

---

## Summary

The regime detection system provides:
- ✅ Clear market classification (trending vs ranging)
- ✅ Direction signals (up/down/sideways)
- ✅ Trend strength metrics (ADX 0-100)
- ✅ Confidence scores for reliability
- ✅ Actionable trading implications
- ✅ Agent decision support
- ✅ Risk management guidance

**Use regime information to align your trading with market conditions, not against them.**

---

**Status:** Active  
**Last Update:** December 16, 2025  
**Next Review:** Quarterly
