# SHORT Position Support Implementation

**Date**: Session End  
**Status**: ✅ COMPLETED  
**File Updated**: `server/services/asset-velocity-profile.ts`

## Overview

Extended `AssetVelocityProfiler` to support SHORT (bearish) positions alongside existing LONG (bullish) position support. All profit target, stop loss, and exit logic now bidirectional.

## Changes Made

### 1. Updated `calculateProfitTarget()` Method

**New Signature**:
```typescript
calculateProfitTarget(
  symbol: string,
  entryPrice: number,
  tradeType: 'SCALP' | 'DAY' | 'SWING' | 'POSITION',
  velocity: AssetVelocityData,
  direction: 'LONG' | 'SHORT' = 'LONG'  // ← NEW PARAMETER
): number
```

**Logic**:
- **LONG**: Add velocity move to entry price (upside target)
  - Example: $100 entry + $8 expected move = $108 profit target
  
- **SHORT**: Subtract velocity move from entry price (downside target)
  - Example: $100 entry - $8 expected move = $92 profit target

**Timeframe Mappings** (unchanged):
- SCALP: 1D p75 × 0.5
- DAY: 1D p75
- SWING: 7D p75
- POSITION: 21D p90

---

### 2. Updated `calculateStopLoss()` Method

**New Signature**:
```typescript
calculateStopLoss(
  symbol: string,
  entryPrice: number,
  tradeType: string,
  velocity: AssetVelocityData,
  direction: 'LONG' | 'SHORT' = 'LONG'  // ← NEW PARAMETER
): number
```

**Logic**:
- **LONG**: Stop is BELOW entry (loss if price falls)
  - Formula: `entryPrice - (p25 × 1.2)`
  - Example: $100 entry - $2 stop cushion = $98 stop loss
  
- **SHORT**: Stop is ABOVE entry (loss if price rises)
  - Formula: `entryPrice + (p25 × 1.2)`
  - Example: $100 entry + $2 stop cushion = $102 stop loss

**Stop Distance Calculation**:
- Uses p25 (25th percentile move) with 1.2× buffer
- Lookback: 1D for SCALP/DAY trades, 7D for others

---

### 3. Updated `checkExitSignal()` Method

**New Signature**:
```typescript
checkExitSignal(
  entryPrice: number,
  currentPrice: number,
  daysHeld: number,
  tradeType: string,
  velocity: AssetVelocityData,
  direction: 'LONG' | 'SHORT' = 'LONG'  // ← NEW PARAMETER
): { shouldExit: boolean; reason: string; completionPercent: number }
```

**Logic**:
- **LONG**: Profit when price > entry (upside move detected)
  - `priceMovement = currentPrice - entryPrice`
  - Exit when: price moved favorably AND captured ≥80% of expected move
  
- **SHORT**: Profit when price < entry (downside move detected)
  - `priceMovement = entryPrice - currentPrice`
  - Exit when: price moved favorably AND captured ≥80% of expected move

**Exit Triggers**:
1. **Take Profit**: Captured ≥80% of expected move in favorable direction
   - Reason: `"Captured XX% of expected move (favorable)"`
   
2. **Timeout Stop**: Held 2× longer than trade type suggests with no favorable move
   - Reason: `"Trade exhausted - move not materializing"`

**Example Scenarios**:

| Scenario | Entry | Current | Direction | Expected Move | Exit? | Reason |
|----------|-------|---------|-----------|----------------|-------|--------|
| LONG profit | $100 | $108 | LONG | $10 | ✅ Yes | 80% captured |
| SHORT profit | $100 | $92 | SHORT | $10 | ✅ Yes | 80% captured |
| LONG against | $100 | $95 | LONG | $10 | ❌ No | Moving wrong way |
| SHORT against | $100 | $105 | SHORT | $10 | ❌ No | Moving wrong way |
| LONG timeout | $100 | $98 (day 4) | LONG | $10 | ✅ Yes | 2D hold, only 20% |
| SHORT timeout | $100 | $102 (day 4) | SHORT | $10 | ✅ Yes | 2D hold, no profit |

---

## Integration Pattern

### Before (LONG-Only)
```typescript
const profitTarget = velocityProfiler.calculateProfitTarget(
  'BTC/USDT',
  50000,
  'DAY',
  velocityData
  // Assumes LONG position
);

const stopLoss = velocityProfiler.calculateStopLoss(
  'BTC/USDT',
  50000,
  'DAY',
  velocityData
  // Assumes LONG position
);
```

### After (LONG or SHORT)
```typescript
// LONG trade (existing code still works - defaults to LONG)
const longTP = velocityProfiler.calculateProfitTarget(
  'BTC/USDT', 50000, 'DAY', velocityData, 'LONG'
);

// SHORT trade (new capability)
const shortTP = velocityProfiler.calculateProfitTarget(
  'BTC/USDT', 50000, 'DAY', velocityData, 'SHORT'
);

// Exit signal also supports direction
const shouldExit = velocityProfiler.checkExitSignal(
  50000, 49500, 2, 'DAY', velocityData, 'SHORT'
);
```

---

## Usage Examples

### Example 1: LONG SCALP Trade
```typescript
const entry = 43500;  // BTC entry price
const velocity = await profiler.getVelocityProfile('BTC/USDT');

// Get profit target (add 1D volatility)
const profitTarget = profiler.calculateProfitTarget(
  'BTC/USDT',
  entry,
  'SCALP',
  velocity,
  'LONG'
);
// Result: 43500 + (p75 × 0.5) = ~43650

// Get stop loss (protect downside)
const stopLoss = profiler.calculateStopLoss(
  'BTC/USDT',
  entry,
  'SCALP',
  velocity,
  'LONG'
);
// Result: 43500 - (p25 × 1.2) = ~43300
```

### Example 2: SHORT SWING Trade
```typescript
const entry = 43500;  // BTC entry price (short)
const velocity = await profiler.getVelocityProfile('BTC/USDT');

// Get profit target (subtract 7D volatility from entry)
const profitTarget = profiler.calculateProfitTarget(
  'BTC/USDT',
  entry,
  'SWING',
  velocity,
  'SHORT'
);
// Result: 43500 - (p75) = ~41700

// Get stop loss (protect upside risk)
const stopLoss = profiler.calculateStopLoss(
  'BTC/USDT',
  entry,
  'SWING',
  velocity,
  'SHORT'
);
// Result: 43500 + (p25 × 1.2) = ~44200
```

### Example 3: SHORT Trade Exit Evaluation
```typescript
const entry = 100;
const current = 95;  // Price down 5, favorable for SHORT
const daysHeld = 1;
const velocity = getVelocityData();
const expectedMove = 10;  // $10 expected move

const exitSignal = profiler.checkExitSignal(
  entry,
  current,
  daysHeld,
  'DAY',
  velocity,
  'SHORT'
);

if (exitSignal.shouldExit && exitSignal.completionPercent >= 80) {
  console.log(`Take profit! Captured ${exitSignal.completionPercent.toFixed(0)}% of move`);
}
// Output: "Take profit! Captured 50% of move" (not exit yet, needs 80%)
```

---

## Type Definitions

All methods now accept direction parameter (optional, defaults to 'LONG'):

```typescript
type TradeDirection = 'LONG' | 'SHORT';

interface CalculateProfitTargetParams {
  symbol: string;
  entryPrice: number;
  tradeType: 'SCALP' | 'DAY' | 'SWING' | 'POSITION';
  velocity: AssetVelocityData;
  direction?: TradeDirection;  // optional, default 'LONG'
}

interface CalculateStopLossParams {
  symbol: string;
  entryPrice: number;
  tradeType: string;
  velocity: AssetVelocityData;
  direction?: TradeDirection;  // optional, default 'LONG'
}

interface CheckExitSignalParams {
  entryPrice: number;
  currentPrice: number;
  daysHeld: number;
  tradeType: string;
  velocity: AssetVelocityData;
  direction?: TradeDirection;  // optional, default 'LONG'
}
```

---

## Backward Compatibility

✅ **Fully backward compatible** - All existing code continues to work:

```typescript
// Old code (LONG-only) still works
velocityProfiler.calculateProfitTarget(symbol, price, type, velocity);
// Automatically treats as LONG
```

---

## Testing Checklist

- [x] TypeScript compiles with no errors
- [x] All three methods updated with direction parameter
- [x] Math verified:
  - LONG TP: entry + move ✓
  - LONG SL: entry - move ✓
  - SHORT TP: entry - move ✓
  - SHORT SL: entry + move ✓
- [x] Exit logic handles favorable/unfavorable price direction
- [x] Backward compatible (defaults to LONG)

---

## Next Steps

1. **Update RL Agent**: Integrate SHORT position support in `rl-position-agent.ts`
2. **Update Scanner**: Emit SHORT signals when bearish patterns detected
3. **Update Consensus Engine**: Accept SHORT positions in consensus voting
4. **Live Testing**: Backtest on historical SHORT data (2022-2025 includes major downtrends)
5. **Position Sizing**: Verify SHORT position sizing matches LONG equivalents

---

## Related Files

- `server/services/asset-velocity-profile.ts` - Main implementation
- `server/services/rl-position-agent.ts` - Next integration point
- `server/services/scanner/momentum-scanner.ts` - Signal source

---

## Notes

- **Direction Parameter**: Optional for backward compatibility, defaults to 'LONG'
- **Stop Cushion**: 1.2× p25 move protects against random noise while staying tight
- **Exit Threshold**: 80% completion prevents premature exits but exits before diminishing returns
- **Favorable Direction**: LONG trades profit on up moves, SHORT trades profit on down moves
