# Drawdown Metrics & Recovery Factor Implementation
**Status:** Complete  
**Priority:** LOW  
**Date:** December 1, 2025

## Problem Solved
Previous system tracked win rate but ignored recovery efficiency:
- Strategy A: 60% win rate, 35% max drawdown (poor recovery) 
- Strategy B: 55% win rate, 12% max drawdown (quick recovery)
- Result: Strategy A appeared better (60% > 55%), but Strategy B is actually superior

## Solution Implemented

### 1. **Peak Price Tracking**
Every signal now tracks the highest price reached during its lifetime:
```typescript
peakPrice: number; // Highest price from entry to exit
```
- Initialized at entry price when signal is created
- Updated on every price update if current price exceeds peak

### 2. **Maximum Drawdown Calculation**
For each signal, we calculate the maximum percentage drop from peak:
```typescript
maxDrawdown = ((peakPrice - currentPrice) / peakPrice) * 100
```
Example:
- Entry: $100 → Peak: $120 → Current: $105
- Max Drawdown = (120 - 105) / 120 = 12.5%

### 3. **Recovery Factor (Risk-Adjusted Return)**
New metric: **Recovery Factor = Cumulative Returns / Max Drawdown**
```typescript
recoveryFactor = (finalPnL%) / (maxDrawdown%)
```
Example scenarios:
- Win +8% with 2% drawdown → RF = 4.0 (excellent recovery)
- Win +4% with 10% drawdown → RF = 0.4 (poor recovery)
- Loss -5% with 5% drawdown → RF = -1.0 (recovery failure)

### 4. **Risk-Adjusted Score**
Combined metric that considers both profitability and recovery:
```typescript
riskAdjustedScore = (winRate / 100) × recoveryFactor
```
This prioritizes strategies that:
- Win consistently (high win rate)
- Recover quickly from downturns (high recovery factor)

## Metrics Returned from `getPerformanceStats()`

| Metric | Type | Purpose |
|--------|------|---------|
| `avgMaxDrawdown` | % | Average max drawdown across all signals |
| `recoveryFactor` | Ratio | Total returns / total drawdown (risk-adjusted) |
| `riskAdjustedScore` | Score | Win rate × recovery efficiency (0-1+ range) |

Example output:
```json
{
  "totalSignals": 100,
  "activeSignals": 15,
  "winRate": 62.5,
  "avgPnl": 0.125,
  "avgPnlPercent": 0.65,
  "avgMaxDrawdown": 8.3,
  "recoveryFactor": 7.82,
  "riskAdjustedScore": 0.489
}
```

## How It Works

### Signal Lifecycle with Drawdown Tracking

1. **Signal Created** (Entry)
   - peakPrice = entry price
   - maxDrawdown = 0%
   - recoveryFactor = 0

2. **Price Updates** (Tracking)
   - If price > peakPrice → update peakPrice
   - Calculate drawdown from new peakPrice
   - Update recoveryFactor = currentPnL% / maxDrawdown%

3. **Signal Closed** (Exit)
   - Final maxDrawdown preserved
   - Final recoveryFactor stored
   - Included in performance stats

### Example: BTC Signal
```
Entry: $42,000
Peak: $43,500 (+3.6%)
Current: $41,200 (-1.9%)
Max Drawdown: (43,500 - 41,200) / 43,500 = 5.3%
Recovery Factor: -1.9 / 5.3 = -0.36 (losing signal)

vs

Alternative Scenario:
Entry: $42,000
Peak: $42,800 (+1.9%)
Current: $43,600 (+3.8%)
Max Drawdown: (42,800 - 43,600) / 42,800 = -1.9% (no drawdown)
Recovery Factor: 3.8 / 1% = 3.8 (quick recovery)
```

## Usage in Signal Evaluation

### Before (Win Rate Only)
```typescript
if (winRate > 0.60) {
  signal.quality = "EXCELLENT"; // Flawed - ignores recovery
}
```

### After (Risk-Adjusted)
```typescript
const riskAdjustedScore = getPerformanceStats().riskAdjustedScore;
if (riskAdjustedScore > 0.40) {
  signal.quality = "EXCELLENT"; // Better - accounts for drawdown recovery
}
```

## Integration Points

- **Performance Tracker**: Automatically calculates on every price update
- **API Response**: Included in `/api/portfolio-summary` and trading dashboards
- **Signal Quality Engine**: Can use recoveryFactor in confidence adjustments
- **Strategy Comparison**: Enables fair comparison of different strategies

## Benefits

1. **Better Risk Management**: Identifies strategies that recover quickly
2. **Fair Comparison**: Avoids favoring high win rates with poor recovery
3. **Drawdown-Aware**: Prioritizes capital preservation over pure returns
4. **Actionable Metrics**: Quantifies recovery efficiency for optimization

## Notes

- Recovery Factor = ∞ when max drawdown = 0% but PnL > 0% (capped at 1.0 for safety)
- Recovery Factor = 0 when no closed signals available
- Tracks per-signal recovery (can aggregate to portfolio level)
- Works for both BUY and SELL signals
