# ARM Signal Examples - API Response Format

## Example 1: ARM_LONG Detected (Momentum Decay)

**Scenario**: BTC is still in downtrend (MACD < 0) but sellers are weakening (histogram rising)

### Request
```
GET /api/gateway/dataframe/BTC/USDT?timeframe=1h
```

### Response
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "dataframe": {
    // Price data...
    "close": 42500,
    "rsi": 35,
    "macdHistogram": -0.05,
    "momentum": 0.8,
    
    // Signal from generateSignalTypeWithScores()
    "signal": "ARM_LONG",
    "signalStrength": 15,
    "signalConfidence": 28,
    
    // NEW: ARM metadata
    "armReason": "MOMENTUM_DECAY",
    "signalHoldReason": "CONTINUATION",
    
    // Epistemic state
    "epistemicState": "UNCERTAIN",
    "epistemicReasons": ["ARM_DETECTED"]
  }
}
```

### Interpretation
- **Signal**: ARM_LONG
- **Reason**: MOMENTUM_DECAY (MACD histogram rising from negative)
- **Confidence**: 28% (capped at 50% for ARM)
- **Action**: Watch for BUY confirmation on next candle
- **Message**: "Sellers losing strength. Entry point forming. Await confirmation."

---

## Example 2: BUY After ARM Confirmation

**Scenario**: ARM_LONG persisted, now RSI > 50 and MACD > 0 (edge confirmed)

### Request
```
GET /api/gateway/dataframe/BTC/USDT?timeframe=1h
```

### Response (2 candles later)
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "dataframe": {
    "close": 42750,
    "rsi": 52,
    "macdHistogram": 0.12,
    "momentum": 1.2,
    
    // Edge now confirmed
    "signal": "BUY",
    "signalStrength": 45,
    "signalConfidence": 62,
    
    // No ARM data (signal is confirmed, not forming)
    "armReason": null,
    "signalHoldReason": "NORMAL",
    
    "epistemicState": "CONFIDENT",
    "epistemicReasons": []
  }
}
```

### Interpretation
- **Signal**: BUY (not ARM_LONG anymore)
- **Confidence**: 62% (now uncapped, higher than ARM)
- **Reason**: Edge confirmed (RSI > 50, MACD > 0, momentum positive)
- **Action**: Execute buy with conviction

---

## Example 3: ARM_SHORT Detected (RSI Slope Shift)

**Scenario**: BTC still above 50 RSI but momentum declining (sellers returning)

### Request
```
GET /api/gateway/dataframe/BTC/USDT?timeframe=1h
```

### Response
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "dataframe": {
    "close": 43200,
    "rsi": 65,
    "macdHistogram": 0.18,
    "momentum": -0.5,
    
    // Pressure shift downward detected
    "signal": "ARM_SHORT",
    "signalStrength": 12,
    "signalConfidence": 24,
    
    // ARM metadata
    "armReason": "RSI_SLOPE_SHIFT",
    "signalHoldReason": "LATE",
    
    "epistemicState": "UNCERTAIN",
    "epistemicReasons": ["ARM_DETECTED"]
  }
}
```

### Interpretation
- **Signal**: ARM_SHORT
- **Reason**: RSI_SLOPE_SHIFT (RSI trending down from overbought)
- **Confidence**: 24% (ARM formation phase)
- **Action**: Watch for SELL confirmation
- **Message**: "Buyers losing steam. Peak forming. Await confirmation."

---

## Example 4: HOLD (No Asymmetry)

**Scenario**: Mixed signals, no pressure shift detected

### Request
```
GET /api/gateway/dataframe/ETH/USDT?timeframe=1h
```

### Response
```json
{
  "symbol": "ETH/USDT",
  "timeframe": "1h",
  "dataframe": {
    "close": 2200,
    "rsi": 50,
    "macdHistogram": 0.05,
    "momentum": 0.2,
    
    // No edge, no pressure shift
    "signal": "HOLD",
    "signalStrength": 8,
    "signalConfidence": 15,
    
    // No ARM (neither forming nor confirmed)
    "armReason": null,
    "signalHoldReason": "INSUFFICIENT_EDGE",
    
    "epistemicState": "INSUFFICIENT",
    "epistemicReasons": ["LOW_ALIGNMENT"]
  }
}
```

### Interpretation
- **Signal**: HOLD
- **Reason**: INSUFFICIENT_EDGE (no directional asymmetry)
- **Confidence**: 15% (very low, system unsure)
- **Action**: Wait for clearer signal
- **Message**: "Market in equilibrium. No asymmetry to trade."

---

## Example 5: Volume Gate (ZERO_VOLUME)

**Scenario**: New asset with no trading activity

### Request
```
GET /api/gateway/dataframe/SHIB/USDT?timeframe=1h
```

### Response
```json
{
  "symbol": "SHIB/USDT",
  "timeframe": "1h",
  "dataframe": {
    "close": 0.00089,
    "volume": 0,
    "volumeRatio": 0.0,
    "rsi": 28,
    "macdHistogram": -0.8,
    "momentum": -5.2,
    
    // Forced to HOLD due to volume
    "signal": "HOLD",
    "signalStrength": 0,
    "signalConfidence": 5,
    
    // No ARM possible without volume
    "armReason": null,
    "signalHoldReason": "ZERO_VOLUME",
    
    "epistemicState": "INSUFFICIENT",
    "epistemicReasons": ["NO_LIQUIDITY"]
  }
}
```

### Interpretation
- **Signal**: HOLD
- **Reason**: ZERO_VOLUME (hard gate blocks all signals)
- **Confidence**: 5% (essentially invalid)
- **Action**: Cannot trade without liquidity
- **Message**: "No market participants. No liquidity to trade."

---

## Batch Signal Response with ARM

### Request
```
POST /api/gateway/signals/batch
Content-Type: application/json

{
  "symbols": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
  "timeframe": "1h"
}
```

### Response
```json
{
  "success": true,
  "signals": [
    {
      "symbol": "BTC/USDT",
      "signal": "ARM_LONG",
      "armReason": "MOMENTUM_DECAY",
      "confidence": 28,
      "strength": 15
    },
    {
      "symbol": "ETH/USDT",
      "signal": "HOLD",
      "armReason": null,
      "confidence": 15,
      "strength": 8,
      "holdReason": "INSUFFICIENT_EDGE"
    },
    {
      "symbol": "SOL/USDT",
      "signal": "BUY",
      "armReason": null,
      "confidence": 48,
      "strength": 35
    }
  ],
  "timestamp": "2024-12-15T18:30:00Z"
}
```

---

## Dashboard Display Logic

### For Frontend

```typescript
// Signal type colors
const signalColors = {
  "BUY": "green",
  "SELL": "red",
  "HOLD": "gray",
  "ARM_LONG": "yellow-green",    // Light green (forming long)
  "ARM_SHORT": "yellow-red"      // Light red (forming short)
};

// ARM reason text
const armReasonText = {
  "MOMENTUM_DECAY": "Momentum reversing",
  "RSI_SLOPE_SHIFT": "Equilibrium shifting",
  "VOLATILITY_COMPRESSION": "Market coiling"
};

// Display template
{
  signal.type === 'ARM_LONG' ? (
    <SignalCard color={signalColors.ARM_LONG}>
      <Title>Pressure Shift: Bullish</Title>
      <Reason>{armReasonText[signal.armReason]}</Reason>
      <Confidence>{signal.confidence}% (forming)</Confidence>
      <Action>Watch for BUY confirmation</Action>
    </SignalCard>
  ) : signal.type === 'BUY' ? (
    <SignalCard color={signalColors.BUY}>
      <Title>Edge Confirmed: BUY</Title>
      <Confidence>{signal.confidence}% (ready)</Confidence>
      <Action>Execute position</Action>
    </SignalCard>
  ) : null
}
```

---

## Trading Rules With ARM

### Entry Rules

1. **Observe ARM**: Monitor for ARM_LONG / ARM_SHORT signal
2. **Confirm Edge**: Wait for compositeScore to cross threshold
3. **Execute BUY/SELL**: Only when edge confirmed (not in ARM phase)

```typescript
if (signal.type === 'ARM_LONG' && confidence < 40) {
  // Pre-entry phase: accumulate information
  logMessage("Pressure shift detected. Preparing entry signal.");
  watchForConfirmation();
} else if (signal.type === 'BUY' && confidence >= 40) {
  // Entry phase: execute with conviction
  executeEntry();
}
```

### Stop Loss & Take Profit

ARM signals don't execute trades, so standard SL/TP applies once BUY/SELL triggers.

```typescript
if (signal.type === 'BUY') {
  stopLoss = lastClose - (atr * 1.5);      // 1.5x ATR below entry
  takeProfit = lastClose + (atr * 3.0);    // 3x ATR above entry
}
```

---

## Summary: What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Signal Types | BUY, SELL, HOLD | **+ ARM_LONG, ARM_SHORT** |
| Signal Progression | HOLD → BUY (1 step) | HOLD → ARM → BUY (2 steps) |
| Early Warning | None | ✅ ARM provides 1-3 candle advance notice |
| Confidence Range | 10-100% | 10-50% (ARM), 40-100% (BUY/SELL) |
| Diagnostics | Why HOLD? | ✅ Why ARM? (MOMENTUM_DECAY, etc.) |
| Entry Precision | Catch bottom/top | ✅ Form pressure shift, confirm edge |

---

## Validation Checklist

After deployment, verify:

- [ ] ARM signals appear before every BUY/SELL
- [ ] ARM confidence capped at 50%
- [ ] armReason correctly identified (check candle-by-candle)
- [ ] BUY frequency ~40-50% of previous (high bar for confirmation)
- [ ] ARM ratio (ARM: BUY) ~2-3:1
- [ ] No false BUY without prior ARM (sanity check)
- [ ] Volume gates still blocking ZERO_VOLUME assets
- [ ] WebSocket broadcasts include armReason field

---
