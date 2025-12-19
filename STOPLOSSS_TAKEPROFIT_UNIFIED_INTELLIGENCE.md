# Stop Loss & Take Profit Unified Intelligence Framework

## Overview

Stop Loss (SL) and Take Profit (TP) are your risk management guardrails. Your system has **multiple strategies** for setting these levels. This document:

1. **Catalogs all SL/TP methods** in your system
2. **Explains advantages and disadvantages** of each
3. **Shows how to combine them** for optimal execution
4. **Provides decision logic** across different signal sources
5. **Tracks which method to use when**

---

## Part 1: Stop Loss Methods Inventory

### 1.1 Volatility-Based Stop Loss (ATR) ✅ Implemented

**File:** `server/services/ml-automated-trading-service.ts`

**Foundation: Average True Range (ATR)**

```
ATR = Average of True Range over N periods

True Range = max(
  high - low,
  abs(high - previous_close),
  abs(low - previous_close)
)

Stop Loss Formulas:

LONG Entry:
  SL = Entry - (1.5 × ATR)
  
SHORT Entry:
  SL = Entry + (1.5 × ATR)

Take Profit (LONG):
  TP = Entry + (3.0 × ATR)

Example:
  Entry Price: $45,000
  ATR (14-period): $1,500
  
  LONG:
    SL = $45,000 - (1.5 × $1,500) = $42,750
    TP = $45,000 + (3.0 × $1,500) = $49,500
    Risk/Reward: 1:2 ratio
```

**Implementation:**
```typescript
interface ATRStopLoss {
  entry: number;
  atr: number;
  direction: 'LONG' | 'SHORT';
  slMultiplier?: number; // Default 1.5
  tpMultiplier?: number; // Default 3.0
}

function calculateATRStopAndTarget(sl: ATRStopLoss): {
  stopLoss: number;
  takeProfit: number;
  riskDistance: number;
  rewardDistance: number;
  riskRewardRatio: number;
} {
  const slMult = sl.slMultiplier || 1.5;
  const tpMult = sl.tpMultiplier || 3.0;
  
  if (sl.direction === 'LONG') {
    const stopLoss = sl.entry - (slMult * sl.atr);
    const takeProfit = sl.entry + (tpMult * sl.atr);
    
    return {
      stopLoss,
      takeProfit,
      riskDistance: sl.entry - stopLoss,
      rewardDistance: takeProfit - sl.entry,
      riskRewardRatio: (takeProfit - sl.entry) / (sl.entry - stopLoss)
    };
  } else {
    const stopLoss = sl.entry + (slMult * sl.atr);
    const takeProfit = sl.entry - (tpMult * sl.atr);
    
    return {
      stopLoss,
      takeProfit,
      riskDistance: stopLoss - sl.entry,
      rewardDistance: sl.entry - takeProfit,
      riskRewardRatio: (sl.entry - takeProfit) / (stopLoss - sl.entry)
    };
  }
}
```

**Advantages:**
- ✅ **Dynamic to market conditions** (high vol = wider stops)
- ✅ Adapts automatically (no manual adjustment)
- ✅ Industry standard (used by professional traders)
- ✅ Data-driven (based on actual volatility)
- ✅ Reduces whipsaws in volatile markets
- ✅ Gives room to breathe during pullbacks

**Disadvantages:**
- ❌ Can be too wide in calm markets
- ❌ Can be too tight during spikes
- ❌ Doesn't consider support/resistance
- ❌ May create large position sizing variance
- ❌ Requires accurate ATR calculation

**When to use:**
- Primary method for automated trading
- When support/resistance not clear
- During volatile market conditions
- For ML-generated signals
- As fallback when technical levels fail

**Multiplier Variations:**
```typescript
interface ATRMultiplierRegime {
  regime: 'aggressive' | 'normal' | 'conservative';
  slMultiplier: number;
  tpMultiplier: number;
  description: string;
}

const multipliers: ATRMultiplierRegime[] = [
  {
    regime: 'aggressive',
    slMultiplier: 1.0, // Tight stops
    tpMultiplier: 2.0, // Early profits
    description: 'High win rate, smaller wins'
  },
  {
    regime: 'normal',
    slMultiplier: 1.5,
    tpMultiplier: 3.0,
    description: 'Balanced 1:2 risk/reward'
  },
  {
    regime: 'conservative',
    slMultiplier: 2.0, // Wide stops
    tpMultiplier: 4.0, // Let winners run
    description: 'Low win rate, larger wins'
  }
];
```

---

### 1.2 Support/Resistance Based Stop Loss ⏳ Not Yet Integrated

**Foundation: Technical Support/Resistance Levels**

```
Key Levels:
- Support: Price floor where buying pressure appears
- Resistance: Price ceiling where selling pressure appears
- Swing Low/High: Recent pivot points

Stop Loss Rules:

LONG Entry (Entry > Support):
  SL = Support Level - Buffer
  Buffer = ATR * 0.2 (small buffer below support)
  
SHORT Entry (Entry < Resistance):
  SL = Resistance Level + Buffer
  
Take Profit Rules:
LONG: 
  T1 = Next Resistance (partial profit)
  T2 = Strong Resistance (more profit)
  T3 = Major Resistance (final target)

Example:
  Entry: $45,000 (breakout above resistance)
  Support below: $44,000
  ATR: $1,500
  Buffer: $1,500 * 0.2 = $300
  
  SL = $44,000 - $300 = $43,700
  Risk = $45,000 - $43,700 = $1,300
  
  TP Targets:
  T1 = Next resistance $45,800 (100 pips up)
  T2 = Strong resistance $47,200 (2200 pips)
  T3 = Major resistance $48,900 (3900 pips)
```

**Implementation:**
```typescript
interface TechnicalLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: 'weak' | 'medium' | 'strong';
  touches: number; // How many times tested
  distance: number; // Distance from current price
}

interface SupportResistanceStopLoss {
  entry: number;
  direction: 'LONG' | 'SHORT';
  supportResistanceLevels: TechnicalLevel[];
  atr: number;
}

function calculateTechnicalStopAndTargets(sl: SupportResistanceStopLoss) {
  if (sl.direction === 'LONG') {
    // Find nearest support below entry
    const supportLevels = sl.supportResistanceLevels
      .filter(l => l.type === 'support' && l.price < sl.entry)
      .sort((a, b) => b.price - a.price); // Closest first
    
    if (supportLevels.length === 0) {
      return null; // No clear support
    }
    
    const nearestSupport = supportLevels[0];
    const buffer = sl.atr * 0.2;
    const stopLoss = nearestSupport.price - buffer;
    
    // Find resistance levels for TP
    const resistanceLevels = sl.supportResistanceLevels
      .filter(l => l.type === 'resistance' && l.price > sl.entry)
      .sort((a, b) => a.price - b.price); // Lowest first
    
    const takeProfit1 = resistanceLevels[0]?.price; // Nearest
    const takeProfit2 = resistanceLevels[1]?.price; // Next
    const takeProfit3 = resistanceLevels[2]?.price; // Far
    
    return {
      stopLoss,
      takeProfit: [takeProfit1, takeProfit2, takeProfit3],
      supportUsed: nearestSupport,
      resistanceUsed: resistanceLevels.slice(0, 3),
      riskDistance: sl.entry - stopLoss
    };
  }
  
  // Similar logic for SHORT
}
```

**Advantages:**
- ✅ **Respects support/resistance** (natural levels)
- ✅ Smaller stops at strong levels (better R/R)
- ✅ Psychologically sound (traders watch these levels)
- ✅ Fits with technical analysis patterns
- ✅ Multiple TP targets (scale out strategy)
- ✅ Often captures reversal moves

**Disadvantages:**
- ❌ Requires accurate level detection
- ❌ Levels can break unexpectedly
- ❌ False breakouts can trigger stops
- ❌ Needs manual adjustment sometimes
- ❌ Doesn't work in choppy/ranging markets
- ❌ Can be too tight on breakouts

**When to use:**
- Scanner-generated signals (pattern-based)
- Clear support/resistance visible
- Trading breakouts/breakdowns
- Combined with ATR as backup
- For technical traders

**Combining ATR + S/R:**
```typescript
function hybridStopLoss(entry: number, direction: 'LONG' | 'SHORT', 
  atr: number, supportResistance: TechnicalLevel[]): number {
  
  // Get ATR-based SL
  const atrSL = direction === 'LONG' 
    ? entry - (1.5 * atr)
    : entry + (1.5 * atr);
  
  // Get S/R-based SL
  const srSL = calculateTechnicalStopAndTargets({
    entry,
    direction,
    supportResistanceLevels: supportResistance,
    atr
  });
  
  if (!srSL) return atrSL; // Fall back to ATR
  
  // Use whichever is closer (tighter SL)
  if (direction === 'LONG') {
    return Math.max(atrSL, srSL.stopLoss); // Farther from entry
  } else {
    return Math.min(atrSL, srSL.stopLoss);
  }
}
```

---

### 1.3 Chandelier Stop Loss ⏳ Not Yet Integrated

**Foundation: Dynamic trailing stop**

```
Chandelier Stop = SAR (Stop and Reverse) variant

Calculation:
Chandelier = High (N periods) - ATR(N) × Multiplier

LONG Trade:
  Stop = Highest_High(N) - (ATR(N) × 3)
  Trails up as price makes new highs
  
SHORT Trade:
  Stop = Lowest_Low(N) + (ATR(N) × 3)
  Trails down as price makes new lows

Example (LONG):
  Last 22-period high: $46,500
  ATR (22-period): $1,200
  Chandelier = $46,500 - (3 × $1,200) = $42,900
  
  When price makes new high $47,000:
  New Chandelier = $47,000 - (3 × $1,200) = $43,400 (trails up)
```

**Implementation:**
```typescript
function calculateChandelierStop(
  candles: { high: number; low: number; close: number }[],
  direction: 'LONG' | 'SHORT',
  period: number = 22,
  atrMultiplier: number = 3
): number {
  // Get highest high (LONG) or lowest low (SHORT)
  if (direction === 'LONG') {
    const highestHigh = Math.max(...candles.slice(-period).map(c => c.high));
    const atr = calculateATR(candles.slice(-period));
    return highestHigh - (atr * atrMultiplier);
  } else {
    const lowestLow = Math.min(...candles.slice(-period).map(c => c.low));
    const atr = calculateATR(candles.slice(-period));
    return lowestLow + (atr * atrMultiplier);
  }
}

// Trailing stop (updates every candle)
class ChandelierStopTracker {
  private stopLevel: number;
  private direction: 'LONG' | 'SHORT';
  
  constructor(initialStop: number, direction: 'LONG' | 'SHORT') {
    this.stopLevel = initialStop;
    this.direction = direction;
  }
  
  update(candles: { high: number; low: number; close: number }[]): {
    stopLevel: number;
    updated: boolean;
  } {
    const newStop = calculateChandelierStop(candles, this.direction);
    
    const updated = this.direction === 'LONG'
      ? newStop > this.stopLevel
      : newStop < this.stopLevel;
    
    if (updated) {
      this.stopLevel = newStop;
    }
    
    return { stopLevel: this.stopLevel, updated };
  }
  
  getStopLevel(): number {
    return this.stopLevel;
  }
}
```

**Advantages:**
- ✅ **Trails automatically with price** (locks in profits)
- ✅ Gives room for pullbacks
- ✅ Prevents leaving money on the table
- ✅ Works well in trending markets
- ✅ Great for letting winners run
- ✅ Standard in professional trading

**Disadvantages:**
- ❌ Can get shaken out by false pullbacks
- ❌ Misses reversals where stop is too high
- ❌ Requires continuous updating
- ❌ Can be less effective in ranging markets
- ❌ Requires lookback period management

**When to use:**
- Trending market conditions
- When you want to maximize wins
- For swing trades (hold longer)
- To protect profits after move up
- Combined with other stops (belt and suspenders)

---

### 1.4 Time-Based Stop Loss ⏳ Not Yet Implemented

**Foundation: Exit if no movement after time period**

```
Rule:
If price hasn't moved X% in Y minutes, close trade

Rationale:
- Dead trades (no thesis playing out) should exit
- Ties up capital from better opportunities
- Reduces opportunity cost

Examples:

Aggressive Scalping:
  If no 0.5% move in 2 minutes → Exit
  
Day Trading:
  If no 1% move in 10 minutes → Exit
  
Swing Trading:
  If no 2% move in 1 hour → Exit

Implementation:
Entry price: $45,000
Stop level: $44,500 (1% below)
Time stop: 5 minutes

At 5 minutes:
  If price < $45,000 × 1.01 = $45,450
  AND price > $45,000 × 0.99 = $44,550
  → Exit at current market price
```

**Implementation:**
```typescript
interface TimeBasedStop {
  entry: number;
  timeWindow: number; // Minutes
  minimumMove: number; // % (e.g., 0.01 = 1%)
  entryTime: Date;
}

function checkTimeBasedStop(stop: TimeBasedStop, currentPrice: number, currentTime: Date): {
  shouldExit: boolean;
  reason: string;
} {
  const elapsedMinutes = (currentTime.getTime() - stop.entryTime.getTime()) / (1000 * 60);
  
  if (elapsedMinutes < stop.timeWindow) {
    return { shouldExit: false, reason: 'Time window not reached' };
  }
  
  const movePercent = Math.abs((currentPrice - stop.entry) / stop.entry);
  
  if (movePercent < stop.minimumMove) {
    return { 
      shouldExit: true, 
      reason: `No {minimumMove * 100}% move in {stop.timeWindow} min - Exit` 
    };
  }
  
  return { shouldExit: false, reason: 'Thesis still playing out' };
}

// Track time stops for all active trades
class TimeStopMonitor {
  private timeStops: Map<string, TimeBasedStop> = new Map();
  
  addTrade(tradeId: string, stop: TimeBasedStop) {
    this.timeStops.set(tradeId, stop);
  }
  
  checkAllTrades(prices: Map<string, number>): string[] {
    const exitTrades: string[] = [];
    const now = new Date();
    
    for (const [tradeId, stop] of this.timeStops) {
      const currentPrice = prices.get(tradeId);
      if (!currentPrice) continue;
      
      const result = checkTimeBasedStop(stop, currentPrice, now);
      if (result.shouldExit) {
        exitTrades.push(tradeId);
      }
    }
    
    return exitTrades;
  }
}
```

**Advantages:**
- ✅ **Prevents dead money** (capital tied up)
- ✅ Reduces opportunity cost
- ✅ Cuts losses from "thesis failed" trades
- ✅ Simple to implement and understand
- ✅ Works for all timeframes

**Disadvantages:**
- ❌ Can exit winners that take time to develop
- ❌ Requires careful tuning
- ❌ May not work for long-term swings
- ❌ Arbitrary time windows

**When to use:**
- Scalp trades (short time windows)
- Day trades (within-day windows)
- Prevent capital waste
- Combined with price-based stops

---

### 1.5 Percentage-Based Stop Loss ⏳ Partially Implemented

**Foundation: Simple % distance from entry**

```
Rule:
Stop = Entry - (Entry × stopPercent)

Variations:

Fixed Percentage (simple):
  Entry: $45,000
  Stop: 2%
  SL = $45,000 - ($45,000 × 0.02) = $44,100

Risk % of Account (professional):
  Account: $10,000
  Max risk per trade: 2% = $200
  Entry: $45,000
  SL must be set so loss = $200
  Max SL distance: $200 / position_quantity
```

**Implementation:**
```typescript
function fixedPercentageStop(entry: number, stopPercent: number, direction: 'LONG' | 'SHORT'): number {
  const distance = entry * stopPercent;
  return direction === 'LONG' ? entry - distance : entry + distance;
}

function riskPercentStop(entry: number, accountEquity: number, riskPercent: number, 
  direction: 'LONG' | 'SHORT'): number {
  const riskAmount = accountEquity * riskPercent;
  const riskDistance = riskAmount / entry; // This is wrong - needs position quantity
  return direction === 'LONG' ? entry - riskDistance : entry + riskDistance;
}

// Better: Risk-based (ensures fixed risk %)
interface RiskPercentStop {
  entry: number;
  accountEquity: number;
  maxRiskPercent: number; // E.g., 0.02 = 2% of account
  direction: 'LONG' | 'SHORT';
}

function calculateRiskPercentStop(params: RiskPercentStop): {
  stopLoss: number;
  maxQuantity: number;
} {
  const maxRisk = params.accountEquity * params.maxRiskPercent;
  
  // SL distance needed to limit risk
  const slDistance = maxRisk / (params.entry * params.maxQuantity);
  
  const stopLoss = params.direction === 'LONG'
    ? params.entry - slDistance
    : params.entry + slDistance;
  
  return { stopLoss, maxQuantity: params.maxRiskPercent };
}
```

**Advantages:**
- ✅ Simple to understand
- ✅ Scales with price level
- ✅ Easy to communicate
- ✅ Works across different price ranges

**Disadvantages:**
- ❌ Same % stop in calm and volatile markets
- ❌ Doesn't adapt to conditions
- ❌ Can be too tight or too wide
- ❌ Ignores support/resistance

**When to use:**
- Simplistic / mechanical systems
- Multiple asset classes (standardize)
- As secondary confirmation
- Risk management hard stop

---

## Part 2: Take Profit Methods Inventory

### 2.1 Multiple Target Take Profit (Scaling Out) ✅

**Foundation: Exit in stages, lock in profits, let winners run**

```
Strategy: Divide position into 3-4 targets

T1: Early profit target (25% position)
  Take profit at first resistance
  Locks in gains quickly
  
T2: Main target (40% position)
  Expected move target
  Most important TP
  
T3: Extended target (20% position)
  Trend continuation target
  If momentum continues
  
Trail: Remaining (15% position)
  Trailing stop
  Ride the trend

Example (LONG Entry $45,000):
  Position: 1.0 BTC
  ATR: $1,500
  
  T1: $45,400 (0.88% up) - Sell 0.25 BTC
       Lock in quick win
       
  T2: $46,500 (3.33% up) - Sell 0.40 BTC
       Main target, 2:1 R/R
       
  T3: $48,000 (6.67% up) - Sell 0.20 BTC
       Extended move
       
  Trail: Remaining 0.15 BTC
       Chandelier stop
       Let it run
```

**Implementation:**
```typescript
interface MultiTargetTP {
  entry: number;
  direction: 'LONG' | 'SHORT';
  atr: number;
  targets: Array<{
    price: number;
    exitPercent: number; // % of position
    name: string;
  }>;
}

function calculateMultiTargets(params: MultiTargetTP): MultiTargetTP['targets'] {
  if (params.direction === 'LONG') {
    return [
      {
        price: params.entry + (params.atr * 0.5), // T1: 0.5 ATR
        exitPercent: 0.25,
        name: 'Quick Win (25%)'
      },
      {
        price: params.entry + (params.atr * 2.0), // T2: 2.0 ATR
        exitPercent: 0.40,
        name: 'Main Target (40%)'
      },
      {
        price: params.entry + (params.atr * 3.5), // T3: 3.5 ATR
        exitPercent: 0.20,
        name: 'Extended (20%)'
      },
      {
        price: params.entry + (params.atr * 5.0), // Trail: Chandelier
        exitPercent: 0.15,
        name: 'Trail (15%)'
      }
    ];
  } else {
    // SHORT logic (inverted)
    return [
      {
        price: params.entry - (params.atr * 0.5),
        exitPercent: 0.25,
        name: 'Quick Win (25%)'
      },
      {
        price: params.entry - (params.atr * 2.0),
        exitPercent: 0.40,
        name: 'Main Target (40%)'
      },
      {
        price: params.entry - (params.atr * 3.5),
        exitPercent: 0.20,
        name: 'Extended (20%)'
      },
      {
        price: params.entry - (params.atr * 5.0),
        exitPercent: 0.15,
        name: 'Trail (15%)'
      }
    ];
  }
}

class MultiTargetExecution {
  private targets: MultiTargetTP['targets'];
  private executed: Set<string> = new Set();
  
  constructor(targets: MultiTargetTP['targets']) {
    this.targets = targets;
  }
  
  checkPriceLevels(currentPrice: number, direction: 'LONG' | 'SHORT'): Array<{
    target: string;
    shouldExit: boolean;
  }> {
    const results = [];
    
    for (const target of this.targets) {
      if (this.executed.has(target.name)) continue;
      
      const shouldExit = direction === 'LONG'
        ? currentPrice >= target.price
        : currentPrice <= target.price;
      
      results.push({
        target: target.name,
        shouldExit
      });
      
      if (shouldExit) {
        this.executed.add(target.name);
      }
    }
    
    return results;
  }
}
```

**Advantages:**
- ✅ **Locks in profits systematically**
- ✅ Reduces emotion (pre-planned exits)
- ✅ Captures quick wins (T1)
- ✅ Lets winners run (trail)
- ✅ Optimal risk/reward (avg 2:1+)
- ✅ Professional approach

**Disadvantages:**
- ❌ Can exit too early (miss big moves)
- ❌ Multiple trades = more fees
- ❌ Complex to manage
- ❌ Requires position management
- ❌ Timing is critical

**When to use:**
- All trades (should be standard)
- Swing trades (multiple exits)
- To reduce emotion
- Maximize compounding

---

### 2.2 Percentage Gain Take Profit ⏳

**Foundation: Exit after X% gain**

```
Rule:
If price has moved X% from entry → Exit

Variations:

Aggressive (Quick profits):
  2% gain → Exit all
  (High win rate, small wins)
  
Normal (Balanced):
  3-5% gain → Exit all
  (Good balance)
  
Conservative (Let winners run):
  7-10% gain → Exit all
  (Fewer wins, bigger wins)

Time-sensitive:
  Exit at X% gain within Y minutes
  If time expires without X% gain → Exit at market

Example:
  Entry: $45,000
  Target: +3% gain
  TP: $45,000 × 1.03 = $46,350
```

**Implementation:**
```typescript
function percentageGainTP(entry: number, gainPercent: number, direction: 'LONG' | 'SHORT'): number {
  const distance = entry * gainPercent;
  return direction === 'LONG' ? entry + distance : entry - distance;
}

// Risk-adjusted version: Set TP based on SL distance
interface RiskRewardTP {
  entry: number;
  stopLoss: number;
  riskRewardRatio: number; // e.g., 2.0 for 2:1
  direction: 'LONG' | 'SHORT';
}

function riskRewardTP(params: RiskRewardTP): number {
  const riskDistance = Math.abs(params.entry - params.stopLoss);
  const rewardDistance = riskDistance * params.riskRewardRatio;
  
  return params.direction === 'LONG'
    ? params.entry + rewardDistance
    : params.entry - rewardDistance;
}

// Example:
// Entry: $45,000, SL: $44,000 (risk $1,000)
// For 2:1 R/R: TP = $45,000 + (2 × $1,000) = $47,000
```

**Advantages:**
- ✅ Simple to calculate
- ✅ Ensures consistent R/R
- ✅ Professional approach
- ✅ Easy to automate
- ✅ Works across all instruments

**Disadvantages:**
- ❌ Misses extending trends
- ❌ One-size-fits-all (ignores conditions)
- ❌ Can be too aggressive or conservative
- ❌ Doesn't scale with volatility

**When to use:**
- Primary TP method (ensure minimum 1.5:1 R/R)
- Combined with trailing stops
- Automated trading
- All signal types

---

### 2.3 Resistance Level Take Profit ⏳ Not Yet Integrated

**Foundation: Exit at nearest resistance level**

```
Rules:
T1: Nearest resistance above entry
T2: Next strong resistance
T3: Major resistance (trend target)

Example:
  Entry: $45,000
  Resistances: $45,500, $46,200, $47,500, $49,000
  
  T1: $45,500 (exit 25%)
  T2: $46,200 (exit 40%)
  T3: $47,500 (exit 20%)
  Trail: $49,000 (exit 15% on break)
```

**Implementation:**
```typescript
function resistanceLevelTP(entry: number, direction: 'LONG' | 'SHORT', 
  resistanceLevels: number[]): number[] {
  
  if (direction === 'LONG') {
    return resistanceLevels
      .filter(r => r > entry)
      .sort((a, b) => a - b)
      .slice(0, 3); // First 3 targets
  } else {
    return resistanceLevels
      .filter(r => r < entry)
      .sort((a, b) => b - a)
      .slice(0, 3);
  }
}
```

**Advantages:**
- ✅ Aligns with technical levels
- ✅ Natural TP points
- ✅ Reduces rejection at resistance
- ✅ Works well for breakout trades

**Disadvantages:**
- ❌ Requires accurate level detection
- ❌ Levels can be surpassed
- ❌ May exit too early
- ❌ False breakouts

**When to use:**
- Scanner signals (pattern-based)
- Breakout/breakdown trades
- Technical analysis setups
- Combined with ATR targets

---

## Part 3: Unified SL/TP Framework

### 3.1 Decision Matrix: Which Method When?

```
┌──────────────────────────────────────────────────────────────┐
│ Signal Source vs SL/TP Method Selection                      │
├──────────────────────┬──────────────────────────────────────┤
│ ML Predictions       │ SL: ATR-based (1.5×)                 │
│ (6-timeframe)        │ TP: Multi-target + Trail             │
│                      │ Reason: Volatility matters, dynamic  │
├──────────────────────┼──────────────────────────────────────┤
│ Scanner Signals      │ SL: S/R levels (with ATR buffer)     │
│ (Pattern-based)      │ TP: Resistance levels (T1/T2/T3)     │
│                      │ Reason: Patterns have clear targets  │
├──────────────────────┼──────────────────────────────────────┤
│ Gateway Agents       │ SL: Risk % of account (2%)           │
│ (Rule-based)         │ TP: Fixed R/R (2:1 minimum)          │
│                      │ Reason: Conservative, consistent     │
├──────────────────────┼──────────────────────────────────────┤
│ Scalp Trade          │ SL: Tight ATR (1.0×)                 │
│ (1m-5m)              │ TP: Quick percentages (0.5-1.5%)     │
│                      │ Reason: High win rate priority       │
├──────────────────────┼──────────────────────────────────────┤
│ Day Trade            │ SL: ATR (1.5×)                       │
│ (5m-1h)              │ TP: Multi-target (3 levels)          │
│                      │ Reason: Medium holding time          │
├──────────────────────┼──────────────────────────────────────┤
│ Swing Trade          │ SL: S/R levels (wide)                │
│ (1h-4h)              │ TP: Chandelier trail (long term)     │
│                      │ Reason: Allow room for moves         │
├──────────────────────┼──────────────────────────────────────┤
│ Position Trade       │ SL: Major S/R (very wide)            │
│ (4h+)                │ TP: Technical targets (multi-year)   │
│                      │ Reason: Maximize profit potential    │
└──────────────────────┴──────────────────────────────────────┘
```

### 3.2 Unified SL/TP Calculator

```typescript
interface UnifiedSLTPInput {
  // Signal data
  signal: {
    source: 'ML' | 'Scanner' | 'Gateway' | 'Agent';
    confidence: number;
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  };
  
  // Price data
  market: {
    entry: number;
    currentPrice: number;
    atr: number;
    volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
    supportLevels: number[];
    resistanceLevels: number[];
  };
  
  // Trade parameters
  trade: {
    direction: 'LONG' | 'SHORT';
    quantity: number;
    maxRiskUSD: number;
    minRiskRewardRatio: number; // Minimum 1.5
  };
}

class UnifiedSLTPEngine {
  calculate(input: UnifiedSLTPInput): {
    stopLoss: number;
    takeProfits: number[];
    riskReward: number;
    totalRisk: number;
    totalReward: number;
    reasoning: string;
  } {
    let stopLoss: number;
    let takeProfits: number[];
    
    // Select SL method based on source
    switch (input.signal.source) {
      case 'ML':
        // ATR-based for ML
        stopLoss = this.calculateATRStopLoss(input, 1.5);
        break;
      case 'Scanner':
        // Support/resistance for scanner
        stopLoss = this.calculateSRStopLoss(input);
        break;
      case 'Gateway':
        // Risk-based for gateway
        stopLoss = this.calculateRiskBasedStopLoss(input);
        break;
      default:
        // Hybrid approach
        stopLoss = this.calculateHybridStopLoss(input);
    }
    
    // Validate SL doesn't risk too much
    stopLoss = this.constrainToMaxRisk(stopLoss, input);
    
    // Calculate TP based on source
    switch (input.signal.source) {
      case 'ML':
        takeProfits = this.calculateMultipleTargets(input, stopLoss, [0.25, 0.40, 0.20, 0.15]);
        break;
      case 'Scanner':
        takeProfits = this.calculateResistanceTargets(input, stopLoss);
        break;
      default:
        takeProfits = this.calculateMinimumRRTargets(input, stopLoss);
    }
    
    // Calculate metrics
    const riskDistance = Math.abs(input.market.entry - stopLoss);
    const averageReward = takeProfits.reduce((a, b) => a + b, 0) / takeProfits.length;
    const rewardDistance = Math.abs(averageReward - input.market.entry);
    const riskReward = rewardDistance / riskDistance;
    
    // Ensure minimum R/R
    if (riskReward < input.trade.minRiskRewardRatio) {
      // Adjust TP upward
      takeProfits = takeProfits.map(tp => 
        input.trade.direction === 'LONG'
          ? input.market.entry + (riskDistance * input.trade.minRiskRewardRatio)
          : input.market.entry - (riskDistance * input.trade.minRiskRewardRatio)
      );
    }
    
    return {
      stopLoss,
      takeProfits,
      riskReward,
      totalRisk: riskDistance * input.trade.quantity,
      totalReward: (rewardDistance / riskDistance) * riskDistance * input.trade.quantity,
      reasoning: this.buildReasoning(input)
    };
  }
  
  private calculateATRStopLoss(input: UnifiedSLTPInput, multiplier: number): number {
    if (input.trade.direction === 'LONG') {
      return input.market.entry - (input.market.atr * multiplier);
    } else {
      return input.market.entry + (input.market.atr * multiplier);
    }
  }
  
  private calculateSRStopLoss(input: UnifiedSLTPInput): number {
    if (input.trade.direction === 'LONG') {
      const support = input.market.supportLevels
        .filter(s => s < input.market.entry)
        .sort((a, b) => b - a)[0];
      
      if (!support) return this.calculateATRStopLoss(input, 1.5);
      
      const buffer = input.market.atr * 0.2;
      return support - buffer;
    } else {
      const resistance = input.market.resistanceLevels
        .filter(r => r > input.market.entry)
        .sort((a, b) => a - b)[0];
      
      if (!resistance) return this.calculateATRStopLoss(input, 1.5);
      
      const buffer = input.market.atr * 0.2;
      return resistance + buffer;
    }
  }
  
  private calculateRiskBasedStopLoss(input: UnifiedSLTPInput): number {
    const riskDistance = input.trade.maxRiskUSD / input.trade.quantity;
    
    if (input.trade.direction === 'LONG') {
      return input.market.entry - riskDistance;
    } else {
      return input.market.entry + riskDistance;
    }
  }
  
  private calculateHybridStopLoss(input: UnifiedSLTPInput): number {
    // Combine ATR and S/R
    const atrSL = this.calculateATRStopLoss(input, 1.5);
    const srSL = this.calculateSRStopLoss(input);
    
    if (input.trade.direction === 'LONG') {
      return Math.max(atrSL, srSL); // Farther stop
    } else {
      return Math.min(atrSL, srSL);
    }
  }
  
  private constrainToMaxRisk(sl: number, input: UnifiedSLTPInput): number {
    const riskDistance = Math.abs(input.market.entry - sl);
    const riskAmount = riskDistance * input.trade.quantity;
    
    if (riskAmount > input.trade.maxRiskUSD) {
      const maxDistance = input.trade.maxRiskUSD / input.trade.quantity;
      
      return input.trade.direction === 'LONG'
        ? input.market.entry - maxDistance
        : input.market.entry + maxDistance;
    }
    
    return sl;
  }
  
  private calculateMultipleTargets(input: UnifiedSLTPInput, sl: number, 
    exitPercents: number[]): number[] {
    
    const riskDistance = Math.abs(input.market.entry - sl);
    const targets: number[] = [];
    
    // T1: 0.5 × risk
    // T2: 2.0 × risk
    // T3: 3.5 × risk
    // Trail: 5.0 × risk
    const multipliers = [0.5, 2.0, 3.5, 5.0];
    
    multipliers.forEach(mult => {
      const target = input.trade.direction === 'LONG'
        ? input.market.entry + (riskDistance * mult)
        : input.market.entry - (riskDistance * mult);
      targets.push(target);
    });
    
    return targets;
  }
  
  private calculateResistanceTargets(input: UnifiedSLTPInput, sl: number): number[] {
    if (input.trade.direction === 'LONG') {
      return input.market.resistanceLevels
        .filter(r => r > input.market.entry)
        .sort((a, b) => a - b)
        .slice(0, 3);
    } else {
      return input.market.supportLevels
        .filter(s => s < input.market.entry)
        .sort((a, b) => b - a)
        .slice(0, 3);
    }
  }
  
  private calculateMinimumRRTargets(input: UnifiedSLTPInput, sl: number): number[] {
    const riskDistance = Math.abs(input.market.entry - sl);
    const minRR = input.trade.minRiskRewardRatio;
    
    return [
      input.trade.direction === 'LONG'
        ? input.market.entry + (riskDistance * minRR)
        : input.market.entry - (riskDistance * minRR)
    ];
  }
  
  private buildReasoning(input: UnifiedSLTPInput): string {
    return `
      Signal: ${input.signal.source} (${(input.signal.confidence * 100).toFixed(0)}%)
      Timeframe: ${input.signal.timeframe}
      Volatility: ${input.market.volatilityRegime} (ATR: ${input.market.atr.toFixed(2)})
      Trade Type: ${input.trade.direction} ${input.trade.quantity} at ${input.market.entry}
    `;
  }
}
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Immediate)
- ✅ ATR-based SL/TP (already implemented)
- ✅ Multiple targets / Scaling (add to existing)
- ❌ Unified SL/TP calculator (build)
- ❌ Dashboard for SL/TP tracking

### Phase 2: Integration (1 week)
- ❌ S/R levels detection
- ❌ Chandelier stop implementation
- ❌ Time-based stops
- ❌ Hybrid SL method

### Phase 3: Optimization (2-3 weeks)
- ❌ ML-suggested SL/TP adjustments
- ❌ A/B testing different methods
- ❌ Performance tracking by method
- ❌ Dynamic regime-based adjustment

### Phase 4: Advanced (Ongoing)
- ❌ Correlation-aware stops (widen if correlated)
- ❌ Volatility surface modeling
- ❌ Pre-earnings SL widening
- ❌ Momentum stops

---

## Summary: When to Use Each Method

| Method | SL | TP | Best For | Status |
|--------|----|----|----------|--------|
| **ATR-based** | ✅ | ✅ | ML signals, all trades | Active |
| **S/R Levels** | ⏳ | ⏳ | Scanner signals, patterns | Ready |
| **Chandelier** | ⏳ | - | Trending markets, trails | Ready |
| **Time-based** | ⏳ | - | Dead money prevention | Ready |
| **Percentage** | ⏳ | ✅ | Simple/mechanical | Ready |
| **Multi-target** | - | ✅ | All swing trades | Ready |
| **Risk-based** | ✅ | - | Account protection | Ready |
| **R/R Ratio** | - | ✅ | Professional minimum | Ready |

---

## Key Recommendations

1. **Always use minimum 1.5:1 Risk/Reward ratio** (non-negotiable)
2. **Combine SL methods:** ATR + S/R (choose tighter for safety)
3. **Use multiple TP targets:** Lock profits at T1, main at T2, trail at T3
4. **Adjust for timeframe:** Tighter SL for scalps, wider for swings
5. **Track by source:** Different signals need different settings
6. **Backtest everything:** Optimize SL/TP multipliers historically
7. **Monitor correlation:** Widen stops if multiple correlated trades open

