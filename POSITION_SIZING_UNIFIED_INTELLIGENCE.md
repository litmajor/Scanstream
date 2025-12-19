# Position Sizing Unified Intelligence Framework

## Overview

Position sizing is the most critical risk management component. Your system has **multiple position sizing strategies** that can work together synergistically. This document:

1. **Catalogs all position sizing methods** in your system
2. **Explains how each works** and its unique advantages
3. **Shows how to combine them** for unified intelligence
4. **Provides unified decision logic** across all sources
5. **Tracks which method to use when**

---

## Part 1: Position Sizing Methods Inventory

### 1.1 Confidence-Based Position Sizing ✅ (ML & Automated Trading)

**File:** `server/services/ml-automated-trading-service.ts`

**Formula:**
```
position = maxSize * recommendation% * confidence

Where:
- maxSize = Maximum position size (e.g., $1000)
- recommendation% = 100% for CONFIRM, 50% for CAUTION
- confidence = 0-1 (from ML consensus)

Examples:
- Confidence 0.85, CONFIRM:  $1000 * 100% * 0.85 = $850
- Confidence 0.70, CAUTION:  $1000 * 50% * 0.70 = $350
- Confidence 0.50, CAUTION:  $1000 * 50% * 0.50 = $250
```

**Advantages:**
- ✅ Scales with signal certainty (high confidence = bigger position)
- ✅ Automatically reduces risk during uncertain periods
- ✅ Simple and interpretable
- ✅ Already implemented in ML service

**Disadvantages:**
- ❌ Ignores market volatility (same position size in calm/volatile markets)
- ❌ No account balance consideration
- ❌ Can't differentiate between signal types
- ❌ Linear scaling (no optimization)

**When to use:**
- Primary method for automated trading
- Quick execution needed
- Signal confidence is strong differentiator

---

### 1.2 Kelly Criterion Position Sizing ⏳ (Not Yet Implemented)

**Mathematical Foundation:**
```
f* = (p × b - q) / b

Where:
- f* = Optimal fraction of capital to wager
- p = Probability of win (from backtesting)
- b = Ratio of win to loss (payoff ratio)
- q = Probability of loss (1 - p)

Simplified (when win = loss):
f* = (2p - 1) / 1  →  f* = 2p - 1

Example:
- Win rate: 60% (p = 0.60)
- Average win: $100, Average loss: $50
- b = 100/50 = 2
- f* = (0.60 × 2 - 0.40) / 2 = (1.20 - 0.40) / 2 = 0.40
- Result: Risk 40% of account per trade
```

**Implementation:**
```typescript
function calculateKellyFraction(
  winRate: number,
  avgWin: number,
  avgLoss: number
): number {
  const p = winRate;
  const q = 1 - winRate;
  const b = avgWin / avgLoss;
  
  const kellyFraction = (p * b - q) / b;
  
  // Conservative: use half Kelly (reduce volatility)
  return Math.max(0, Math.min(kellyFraction / 2, 0.25)); // Cap at 25%
}

// Usage:
const kelly = calculateKellyFraction(0.60, 100, 50); // 0.20 (20%)
const position = accountBalance * kelly; // Size position at 20%
```

**Advantages:**
- ✅ **Mathematically optimal** for long-term growth
- ✅ Considers win rate + payoff ratio
- ✅ Proven in sports betting and professional trading
- ✅ Maximizes geometric mean return
- ✅ Data-driven (based on actual performance)

**Disadvantages:**
- ❌ Very aggressive in practice (full Kelly often ruinous)
- ❌ Requires accurate historical data
- ❌ Fails if win rate drops
- ❌ Can lead to huge drawdowns
- ❌ Requires continuous recalibration

**When to use:**
- After 50+ trades with stable win rate
- For conservative (half or quarter Kelly) position sizing
- To optimize across different signal types
- As secondary confirmation with other methods

**Calculation Dashboard:**
```typescript
// Track performance by signal source
interface SignalSourceMetrics {
  source: 'ML' | 'Scanner' | 'Gateway' | 'Agent';
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  kellyFraction: number;
  recommendedPosition: number;
  confidenceLevel: 'high' | 'medium' | 'low'; // Based on trade count
}

// Example metrics dashboard
const metrics: SignalSourceMetrics[] = [
  {
    source: 'ML',
    totalTrades: 150,
    winRate: 0.62,
    avgWin: 180,
    avgLoss: 95,
    kellyFraction: 0.18, // 18% full Kelly
    recommendedPosition: 0.09, // 9% (half Kelly - conservative)
    confidenceLevel: 'high'
  },
  {
    source: 'Scanner',
    totalTrades: 45,
    winRate: 0.58,
    avgWin: 220,
    avgLoss: 110,
    kellyFraction: 0.14,
    recommendedPosition: 0.07,
    confidenceLevel: 'medium' // Only 45 trades
  },
  {
    source: 'Gateway',
    totalTrades: 12,
    winRate: 0.50,
    avgWin: 150,
    avgLoss: 150,
    kellyFraction: 0.00, // Break-even
    recommendedPosition: 0.00,
    confidenceLevel: 'low' // Only 12 trades
  }
];
```

---

### 1.3 Volatility-Adjusted Position Sizing ⏳ (Not Yet Implemented)

**Foundation: ATR (Average True Range)**

```
position = baseSize * (targetVolatility / currentVolatility)

Where:
- baseSize = Base position size (e.g., $1000)
- targetVolatility = Your target risk per trade (e.g., 1%)
- currentVolatility = Measured by ATR as % of price

Formula:
ATR% = ATR / Current Price
adjustedSize = baseSize * (targetVolatility% / ATR%)

Example:
- Target volatility: 1% of account ($100 risk on $10K account)
- Current price: $45,000
- ATR (14-period): $1,500
- ATR% = $1,500 / $45,000 = 3.33%
- Adjustment factor = 1% / 3.33% = 0.30
- Position size = $1000 * 0.30 = $300
```

**Implementation:**
```typescript
function volatilityAdjustedSize(
  baseSize: number,
  atr: number,
  currentPrice: number,
  targetRiskPercent: number = 0.01 // 1% risk
): number {
  const atrPercent = atr / currentPrice;
  const adjustmentFactor = targetRiskPercent / atrPercent;
  const adjustedSize = baseSize * adjustmentFactor;
  
  // Cap at 1.5x base size (don't over-leverage in low volatility)
  return Math.min(adjustedSize, baseSize * 1.5);
}

// Example:
const size = volatilityAdjustedSize(1000, 1500, 45000, 0.01);
// size = $300 (scaled down due to high volatility)
```

**Advantages:**
- ✅ **Automatically adapts to market conditions**
- ✅ Larger positions in calm markets
- ✅ Smaller positions in volatile markets
- ✅ Maintains consistent risk per trade
- ✅ Professional traders use this extensively

**Disadvantages:**
- ❌ Requires accurate volatility measurement
- ❌ Can increase position during sudden volatility spikes
- ❌ Requires trailing ATR updates
- ❌ More complex calculation

**When to use:**
- Always (should be the foundation)
- Combined with confidence-based sizing
- For different asset classes (crypto vs stocks)
- During different market regimes

**Market Regime Adjustments:**
```typescript
interface VolatilityRegime {
  regime: 'low' | 'normal' | 'high' | 'extreme';
  atrThreshold: { min: number; max: number };
  positionMultiplier: number;
}

const regimes: VolatilityRegime[] = [
  { regime: 'low', atrThreshold: { min: 0, max: 1 }, positionMultiplier: 1.2 },
  { regime: 'normal', atrThreshold: { min: 1, max: 3 }, positionMultiplier: 1.0 },
  { regime: 'high', atrThreshold: { min: 3, max: 5 }, positionMultiplier: 0.7 },
  { regime: 'extreme', atrThreshold: { min: 5, max: 100 }, positionMultiplier: 0.3 }
];
```

---

### 1.4 Risk-to-Reward Adjusted Position Sizing ⏳ (Not Yet Implemented)

**Foundation: Risk/Reward Ratio**

```
position = targetRisk / distance_to_stop_loss

Where:
- targetRisk = Maximum $ to risk per trade (e.g., $100)
- distance_to_stop_loss = Price distance to SL in $

Formula:
riskPerPoint = 1 / (stopPrice - entryPrice)
position = targetRisk * riskPerPoint

Example:
- Target risk: $100
- Entry: $45,000
- Stop loss: $44,000
- Risk distance: $1,000
- Position = $100 / $1,000 = 0.1 BTC (not dollars)
- $ position = 0.1 BTC * $45,000 = $4,500 (but risking only $100)
```

**Implementation:**
```typescript
function riskAdjustedSize(
  targetRiskUSD: number,
  entryPrice: number,
  stopLossPrice: number,
  assetPrice: number
): number {
  const riskDistance = Math.abs(entryPrice - stopLossPrice);
  if (riskDistance === 0) return 0;
  
  // Calculate quantity that risks exactly targetRiskUSD
  const quantity = targetRiskUSD / riskDistance;
  
  // Convert to position size in $
  const positionSize = quantity * entryPrice;
  
  return positionSize;
}

// Example:
const size = riskAdjustedSize(100, 45000, 44000, 45000);
// size = $4,500 position with $100 risk
```

**Advantages:**
- ✅ **Directly controls risk per trade**
- ✅ All positions have equal risk regardless of SL distance
- ✅ Professional traders use this method
- ✅ Works with any stop-loss level
- ✅ Simple and transparent

**Disadvantages:**
- ❌ Close stops = larger position (can increase slippage risk)
- ❌ Distant stops = tiny position (miss opportunity)
- ❌ Doesn't consider current market conditions
- ❌ Ignores win rate and payoff ratio

**When to use:**
- Base layer (ensures consistent risk)
- Combined with other methods
- When SL levels are clear (support/resistance)
- For mechanical traders with fixed rules

---

### 1.5 Account Equity Percentage Position Sizing ⏳ (Not Yet Implemented)

**Foundation: Fixed Percentage of Account**

```
position = accountEquity * riskPercent / (stopPrice - entryPrice) * entryPrice

Simplified (position as % of equity):
position = accountEquity * positionPercent

Where:
- accountEquity = Current account balance ($10,000)
- riskPercent = % of account to risk (e.g., 2%)
- positionPercent = % of account to allocate (e.g., 5%)

Examples:
- Account: $10,000
- Risk 2%: Position size should have $200 max loss
- Allocate 5%: Position = $500

Most conservative:
- Risk 1% per trade
- Max 5 concurrent positions
- Total risk: 5% max per day
```

**Implementation:**
```typescript
function equityPercentageSize(
  accountEquity: number,
  riskPercentPerTrade: number = 0.02, // 2% risk
  maxOpenPositions: number = 5
): number {
  // Ensure total daily risk ≤ 5%
  const maxDailyRisk = 0.05;
  const maxRiskPerTrade = Math.min(
    riskPercentPerTrade,
    maxDailyRisk / maxOpenPositions
  );
  
  const riskAmount = accountEquity * maxRiskPerTrade;
  return riskAmount;
}

// Track running totals
interface EquityTracker {
  accountEquity: number;
  dailyRiskUsed: number;
  dailyRiskRemaining: number;
  openPositions: number;
  maxDailyRisk: number;
  maxPositionsPerDay: number;
}

const tracker: EquityTracker = {
  accountEquity: 10000,
  dailyRiskUsed: 150,
  dailyRiskRemaining: 350, // 5% = $500 total
  openPositions: 2,
  maxDailyRisk: 500,
  maxPositionsPerDay: 5
};
```

**Advantages:**
- ✅ Scales with account growth
- ✅ Simple and consistent
- ✅ Prevents over-leverage
- ✅ Easy to communicate
- ✅ Aligns with industry standards (2% rule)

**Disadvantages:**
- ❌ Doesn't consider trade quality
- ❌ Doesn't adapt to volatility
- ❌ Fixed regardless of confidence
- ❌ Ignores correlation between open trades

**When to use:**
- Base layer for all trading
- Conservative approach (1-2% per trade)
- Risk management hard stop
- Account preservation priority

---

### 1.6 Reinforcement Learning Adaptive Position Sizing ⏳ (Proposed)

**Foundation: AI learns optimal position size from results**

```
position = ML_model(
  confidence,
  volatility,
  win_rate,
  drawdown_state,
  market_regime,
  signal_source,
  correlation_to_open_trades
) → suggested_size

Then apply:
position = base * suggested_ratio * risk_cap
```

**Implementation Concept:**
```typescript
interface PositionSizingState {
  confidence: number;
  atrPercent: number;
  recentWinRate: number;
  currentDrawdown: number;
  marketRegime: 'bullish' | 'bearish' | 'choppy';
  signalSource: 'ML' | 'Scanner' | 'Gateway';
  correlationToOpenTrades: number;
}

// RL model predicts optimal position multiplier (0.1 to 1.0)
function rlAdaptivePositionSize(state: PositionSizingState): number {
  // Neural network trained on historical trades
  const multiplier = rlModel.predict(state); // Returns 0.1-1.0
  
  // Apply to base size
  const baseSize = 1000;
  const position = baseSize * multiplier;
  
  return Math.min(position, 2000); // Hard cap
}

// Track performance for model improvement
interface TradeOutcome {
  positionSize: number;
  modelMultiplier: number;
  actualResult: 'win' | 'loss';
  profitLossPercent: number;
  state: PositionSizingState;
}
```

**Advantages:**
- ✅ Continuously learns from results
- ✅ Adapts to changing market conditions
- ✅ Combines all factors automatically
- ✅ No manual tuning needed
- ✅ Optimal over time

**Disadvantages:**
- ❌ Complex to implement correctly
- ❌ Requires significant training data
- ❌ Black box (hard to explain)
- ❌ Risk of overfitting
- ❌ Needs continuous monitoring

**When to use:**
- After 500+ trades
- As enhancement to other methods
- Long-term optimization
- Systematic trading only

---

## Part 2: Unified Position Sizing Framework

### 2.1 Decision Tree: Which Method to Use?

```
START: New trade signal
  ↓
Is it manual/discretionary trade?
  ├─ YES → Use Risk-to-Reward (trader controls SL)
  └─ NO → Continue
  ↓
Is it automated trade?
  ├─ YES → Use Confidence-Based (primary)
  │          └─ Combine with Volatility-Adjusted
  └─ NO → Continue
  ↓
Do we have 50+ historical trades from this source?
  ├─ YES → Use Kelly Criterion (half Kelly for safety)
  │          └─ Compare with Confidence-Based
  └─ NO → Use confidence-based, build history
  ↓
Is current volatility abnormal?
  ├─ YES → Apply Volatility-Adjusted multiplier
  │          └─ Reduce position by regime multiplier
  └─ NO → Continue
  ↓
Check Daily Risk Budget
  Current Daily Risk Used: $XXX / $500 max
  ├─ Used < 50% → OK, proceed
  ├─ Used 50-80% → Reduce position 30%
  └─ Used > 80% → Reduce position 50% or skip
  ↓
FINAL POSITION = base * confidence * volatility_adj * kelly_adj * daily_cap
```

### 2.2 Unified Intelligence Layer

**Implementation:**
```typescript
interface UnifiedPositionSizingInput {
  // Signal data
  signal: {
    source: 'ML' | 'Scanner' | 'Gateway' | 'Agent';
    direction: 'LONG' | 'SHORT';
    confidence: number; // 0-1
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  };
  
  // Market data
  market: {
    currentPrice: number;
    atr: number;
    volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
    recentVolumeProfile: 'bullish' | 'neutral' | 'bearish';
  };
  
  // Account data
  account: {
    equity: number;
    dailyRiskUsed: number;
    dailyRiskBudget: number;
    openPositions: number;
    maxOpenPositions: number;
  };
  
  // Historical metrics by source
  historical: {
    [source: string]: {
      winRate: number;
      avgWin: number;
      avgLoss: number;
      tradeCount: number;
    };
  };
  
  // Risk preferences
  riskPreferences: {
    maxRiskPerTrade: number; // $
    maxRiskPercent: number; // %
    stopLossPrice: number;
  };
}

class UnifiedPositionSizingEngine {
  calculate(input: UnifiedPositionSizingInput): {
    position: number;
    reasoning: string;
    components: Record<string, number>;
  } {
    // Step 1: Confidence-based (always first)
    const confidenceSize = this.confidenceAdjusted(
      input.signal.confidence,
      input.signal.source
    );
    
    // Step 2: Volatility adjustment
    const volatilityAdjusted = this.volatilityAdjustSize(
      confidenceSize,
      input.market.atr,
      input.market.currentPrice,
      input.market.volatilityRegime
    );
    
    // Step 3: Kelly criterion (if enough historical data)
    const kellyAdjustment = this.applyKellyIfAvailable(
      input.signal.source,
      input.historical
    );
    
    // Step 4: Risk-to-reward based on SL
    const riskAdjusted = this.riskToRewardAdjustment(
      volatilityAdjusted,
      input.signal,
      input.riskPreferences
    );
    
    // Step 5: Daily budget constraint
    const dailyBudgetConstrained = this.applyDailyRiskLimit(
      riskAdjusted,
      input.account
    );
    
    // Step 6: Correlation check (if multiple open positions)
    const correlationAdjusted = this.adjustForCorrelation(
      dailyBudgetConstrained,
      input.account.openPositions,
      input.account.maxOpenPositions
    );
    
    return {
      position: correlationAdjusted,
      reasoning: this.buildReasoning(input),
      components: {
        confidence: confidenceSize,
        volatility: volatilityAdjusted,
        kelly: kellyAdjustment,
        riskReward: riskAdjusted,
        dailyBudget: dailyBudgetConstrained,
        correlation: correlationAdjusted
      }
    };
  }
  
  private confidenceAdjusted(confidence: number, source: string): number {
    const baseSize = 1000;
    const sourceWeight = {
      'ML': 1.0,
      'Scanner': 0.8,
      'Gateway': 0.6,
      'Agent': 0.5
    };
    return baseSize * confidence * (sourceWeight[source] || 0.5);
  }
  
  private volatilityAdjustSize(
    size: number,
    atr: number,
    price: number,
    regime: string
  ): number {
    const atrPercent = atr / price;
    const regimeMultipliers = {
      'low': 1.2,
      'normal': 1.0,
      'high': 0.7,
      'extreme': 0.3
    };
    return size * (regimeMultipliers[regime] || 1.0);
  }
  
  private applyKellyIfAvailable(
    source: string,
    historical: any
  ): number {
    if (!historical[source] || historical[source].tradeCount < 50) {
      return 1.0; // No adjustment
    }
    
    const { winRate, avgWin, avgLoss } = historical[source];
    const b = avgWin / avgLoss;
    const kellyFraction = (winRate * b - (1 - winRate)) / b;
    
    return Math.max(0, Math.min(kellyFraction / 2, 0.5)); // Half Kelly, max 50%
  }
  
  private riskToRewardAdjustment(
    size: number,
    signal: any,
    prefs: any
  ): number {
    const riskDistance = Math.abs(signal.entryPrice - prefs.stopLossPrice);
    if (riskDistance === 0) return size;
    
    const maxRiskSize = prefs.maxRiskPerTrade / riskDistance;
    return Math.min(size, maxRiskSize);
  }
  
  private applyDailyRiskLimit(size: number, account: any): number {
    const remainingBudget = account.dailyRiskBudget - account.dailyRiskUsed;
    if (remainingBudget <= 0) return 0;
    
    return Math.min(size, remainingBudget);
  }
  
  private adjustForCorrelation(
    size: number,
    openPositions: number,
    maxOpen: number
  ): number {
    if (openPositions >= maxOpen) return 0;
    
    const spreadFactor = 1 - (openPositions / maxOpen) * 0.3;
    return size * spreadFactor;
  }
  
  private buildReasoning(input: UnifiedPositionSizingInput): string {
    return `
      Position: ${input.signal.source} ${input.signal.direction}
      Confidence: ${(input.signal.confidence * 100).toFixed(0)}%
      Volatility: ${input.market.volatilityRegime} (ATR: ${input.market.atr.toFixed(2)})
      Daily Risk: ${input.account.dailyRiskUsed}/${input.account.dailyRiskBudget}
      Open Positions: ${input.account.openPositions}/${input.account.maxOpenPositions}
    `;
  }
}

// Usage
const engine = new UnifiedPositionSizingEngine();
const result = engine.calculate(input);
console.log(`Position: ${result.position}`);
console.log(`Reasoning: ${result.reasoning}`);
console.log(`Components:`, result.components);
```

---

## Part 3: Implementation Roadmap

### Phase 1: Foundation (Immediate)
- ✅ Confidence-based sizing (already implemented)
- ✅ Volatility-adjusted multipliers (add to existing)
- ✅ Daily risk budget tracking
- ❌ Unified decision engine (build)

### Phase 2: Analytics (1-2 weeks)
- ❌ Kelly criterion calculation per source
- ❌ Historical metrics dashboard
- ❌ Position sizing audit trail
- ❌ Per-source performance tracking

### Phase 3: Advanced (2-4 weeks)
- ❌ Correlation analysis between open trades
- ❌ Market regime detection integration
- ❌ Dynamic volatility multipliers
- ❌ RL model training pipeline

### Phase 4: Optimization (Ongoing)
- ❌ A/B testing different sizing methods
- ❌ Cross-exchange comparison
- ❌ Asset-specific optimization
- ❌ Drawdown recovery logic

---

## Part 4: Monitoring & Tracking Dashboard

**What to track for each method:**

```
POSITION SIZING INTELLIGENCE DASHBOARD

┌─────────────────────────────────────────────────────────────┐
│ CONFIDENCE-BASED (In Use)                                   │
├─────────────────────────────────────────────────────────────┤
│ Avg Position: $850  | Min: $250 | Max: $1,200              │
│ Correlation: 0.92 with confidence (very strong)             │
│ Performance: Win rate by confidence tier                     │
│   50-60%: 45% win rate                                      │
│   60-70%: 52% win rate                                      │
│   70-80%: 62% win rate                                      │
│   80-90%: 68% win rate                                      │
│   90%+ : 72% win rate                                       │
│ Insight: Higher confidence signals very predictive ✓        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ VOLATILITY-ADJUSTED (Ready to Deploy)                       │
├─────────────────────────────────────────────────────────────┤
│ ATR Range: $800 - $2,400                                    │
│ Position Adjustments: 30% - 120% of base                    │
│ Regime Distribution:                                         │
│   Low Vol: 25% of time (avg position +20%)                  │
│   Normal: 50% of time (avg position +0%)                    │
│   High Vol: 20% of time (avg position -30%)                 │
│   Extreme: 5% of time (avg position -70%)                   │
│ Benefit: Expected 15% reduction in drawdowns                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ KELLY CRITERION (Analysis Ready)                            │
├─────────────────────────────────────────────────────────────┤
│ By Source:                                                   │
│   ML (150 trades):       Kelly=18%, Half-Kelly=9%           │
│   Scanner (45 trades):   Kelly=14%, Half-Kelly=7%           │
│   Gateway (12 trades):   Kelly=0%, Insufficient data        │
│ Current vs Optimal:                                          │
│   ML: Using 6.5% (vs 9% Kelly) - CONSERVATIVE ✓             │
│   Scanner: Using 4% (vs 7% Kelly) - CONSERVATIVE ✓          │
│ Opportunity: Could increase ML sizing by 30%                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RISK-TO-REWARD (For Manual Trades)                          │
├─────────────────────────────────────────────────────────────┤
│ Target Risk Per Trade: $100                                 │
│ Distribution:                                                │
│   Close SL (<1% risk distance): $100 risk = $10K position   │
│   Normal SL (2-3% risk distance): $100 risk = $3-5K position│
│   Wide SL (5%+ risk distance): $100 risk = $2K position     │
│ Observation: Close stops create outsized positions          │
│ Recommendation: Prefer normal/wide stops for consistency    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DAILY RISK BUDGET (Active Control)                          │
├─────────────────────────────────────────────────────────────┤
│ Budget: $500/day (5% of $10K account)                      │
│ Used Today: $320 (64%)                                      │
│ Remaining: $180 (36%)                                       │
│ Next Position Allowed: $180 max                             │
│ Safety Zone: Yes (< 80% utilization)                        │
│ Trades Today: 4                                             │
│ Avg Position: $80 risk each                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary: Unified Position Sizing Strategy

| Method | Status | Use Case | Priority |
|--------|--------|----------|----------|
| **Confidence-Based** | ✅ Active | Automated trades | Primary |
| **Volatility-Adjusted** | ⏳ Ready | All trades | High |
| **Kelly Criterion** | ⏳ Ready | After 50+ trades | Medium |
| **Risk-to-Reward** | ⏳ Ready | Manual trades | High |
| **Equity Percentage** | ⏳ Ready | Risk limit | Essential |
| **RL Adaptive** | ⏳ Proposed | Long-term optimization | Low |

**Recommendation:**
1. Deploy in layers: Confidence → Volatility → Kelly (as data accumulates)
2. Always apply Daily Risk Budget constraint (hard stop)
3. Use Unified Engine to calculate final position
4. Track performance of each method separately
5. Adjust multipliers monthly based on results

