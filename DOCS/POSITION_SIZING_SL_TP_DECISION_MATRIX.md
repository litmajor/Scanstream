# Position Sizing + SL/TP: Unified Decision Matrix

## Overview

This document shows how Position Sizing and SL/TP work together, and which combinations work best for different scenarios.

---

## Complete Decision Matrix

### ML Signals (6-Timeframe Consensus)

**Scenario:** ML predicts BULLISH on 1h timeframe with 85% confidence

```
┌────────────────────────────────────────────────────────────────┐
│ SIGNAL: ML CONSENSUS LONG (1h, 85% confidence)                │
├────────────────────────────────────────────────────────────────┤
│ POSITION SIZING                                                │
│ ├─ Method: Confidence-Based (primary)                         │
│ ├─ Calculation: $1,000 * 100% * 0.85 = $850                  │
│ ├─ Volatility Adjust: ATR = $1,500 (3% of price)             │
│ ├─ Multiplier: normal (1.0x) → $850                          │
│ ├─ Daily Budget: $320 / $500 used (64%) → OK ✓               │
│ └─ Final Position: $850                                       │
│                                                                 │
│ STOP LOSS & TAKE PROFIT                                       │
│ ├─ Method: ATR-based (primary)                                │
│ ├─ Entry: $45,000                                             │
│ ├─ ATR: $1,500                                                │
│ ├─ SL: $45,000 - (1.5 × $1,500) = $42,750                   │
│ ├─ Targets:                                                    │
│ │   T1: $45,750 (0.5 ATR) - Exit 25% = $212.50              │
│ │   T2: $48,000 (2.0 ATR) - Exit 40% = $340                 │
│ │   T3: $50,250 (3.5 ATR) - Exit 20% = $170                 │
│ │   Trail: $52,500 (5.0 ATR) - Exit 15% = $127.50           │
│ ├─ Risk: $850 × ($45,000-$42,750)/$45,000 = $42.50          │
│ ├─ Reward: $850 × avg = ~$200                                │
│ └─ Risk/Reward: 1 : 4.7 (excellent)                          │
│                                                                 │
│ TRADE SUMMARY                                                  │
│ ├─ Entry: 0.0189 BTC @ $45,000                               │
│ ├─ Position: $850                                              │
│ ├─ Risk: $42.50 (5% of $850)                                 │
│ ├─ Expected Reward: $200+                                     │
│ └─ Execution: PROCEED ✓                                       │
└────────────────────────────────────────────────────────────────┘
```

### Scanner Signals (Pattern-Based)

**Scenario:** Scanner detects bullish flag breakout, 78% confidence

```
┌────────────────────────────────────────────────────────────────┐
│ SIGNAL: SCANNER BULL FLAG BREAKOUT (78% confidence)           │
├────────────────────────────────────────────────────────────────┤
│ POSITION SIZING                                                │
│ ├─ Method: Confidence * Source Weight                          │
│ ├─ Base: $1,000                                                │
│ ├─ Source Weight: Scanner = 0.8 (vs ML = 1.0)                │
│ ├─ Calculation: $1,000 * 0.78 * 0.8 = $624                  │
│ ├─ Volatility: High (post-breakout) → 0.7x = $437           │
│ ├─ Daily Budget: $320 + $437 = $757 < $500 ✗                │
│ ├─ Adjusted: $500 - $320 = $180 remaining                     │
│ └─ Final Position: $180 (capped by daily budget)              │
│                                                                 │
│ STOP LOSS & TAKE PROFIT                                       │
│ ├─ Method: Hybrid (S/R + ATR)                                 │
│ ├─ Entry: $45,200 (breakout level)                            │
│ ├─ Support Below: $44,000 (flag low)                          │
│ ├─ ATR: $2,100 (high volatility post-break)                  │
│ ├─ SL Candidates:                                              │
│ │   ATR-based: $45,200 - (1.5 × $2,100) = $41,950           │
│ │   S/R-based: $44,000 - ($2,100 × 0.2 buffer) = $43,580   │
│ ├─ SL Used: $43,580 (tighter, respects support)             │
│ ├─ TP Targets:                                                │
│ │   T1: $45,800 (nearest resistance) - 25%                   │
│ │   T2: $47,000 (measured move target) - 40%                │
│ │   T3: $49,500 (extended target) - 20%                     │
│ │   Trail: Chandelier stop (5%) - 15%                       │
│ ├─ Risk: $180 × ($45,200-$43,580)/$45,200 = $6.40          │
│ ├─ Reward: $180 × avg = ~$85                                │
│ └─ Risk/Reward: 1 : 13.3 (excellent)                        │
│                                                                 │
│ TRADE SUMMARY                                                  │
│ ├─ Entry: 0.00398 BTC @ $45,200                              │
│ ├─ Position: $180 (reduced by daily cap)                      │
│ ├─ Risk: $6.40 (capped)                                       │
│ ├─ Expected Reward: $85                                        │
│ └─ Execution: PROCEED with reduced size ⚠                    │
└────────────────────────────────────────────────────────────────┘
```

### Gateway Agent Signals (Rule-Based)

**Scenario:** Gateway agent recommends SHORT, 65% confidence

```
┌────────────────────────────────────────────────────────────────┐
│ SIGNAL: GATEWAY AGENT SHORT (65% confidence)                  │
├────────────────────────────────────────────────────────────────┤
│ POSITION SIZING                                                │
│ ├─ Method: Confidence * Source Weight + Kelly Check           │
│ ├─ Base: $1,000                                                │
│ ├─ Source Weight: Gateway = 0.6 (lowest)                      │
│ ├─ Confidence Calculation: $1,000 * 0.65 * 0.6 = $390       │
│ ├─ Kelly Available: Yes (Gateway has 120 trades)              │
│ ├─ Kelly Fraction: 0.08 (8% of account)                       │
│ ├─ Kelly Recommendation: $10,000 * 0.08 = $800               │
│ ├─ Conservative (half Kelly): $400                             │
│ ├─ Final: Min($390, $400) = $390                             │
│ ├─ Volatility: Low (2.0% ATR) → 1.2x = $468                 │
│ ├─ Daily Budget: $320 + $468 = $788 > $500 ✗                │
│ └─ Final Position: $180 (daily cap)                           │
│                                                                 │
│ STOP LOSS & TAKE PROFIT                                       │
│ ├─ Method: Risk-Based (account protection priority)           │
│ ├─ Entry: $44,800                                             │
│ ├─ Max Risk: 2% of $10,000 = $200                            │
│ ├─ Position: $180                                              │
│ ├─ Max SL Distance: $200 / 0.004 = $50,000 (way too wide)   │
│ ├─ Recalculate: $180 / (max risk $50) = entry ± $278        │
│ ├─ SL: $44,800 + $278 = $45,078                              │
│ ├─ TP: $44,800 - ($278 × 2) = $44,244                       │
│ │   (Maintaining 1:2 R/R minimum)                            │
│ ├─ Risk: $180 × ($278)/$44,800 = $1.12                      │
│ ├─ Reward: $180 × avg = ~$100                                │
│ └─ Risk/Reward: 1 : 89 (overkill, but safe)                 │
│                                                                 │
│ TRADE SUMMARY                                                  │
│ ├─ Entry: 0.00402 BTC SHORT @ $44,800                        │
│ ├─ Position: $180 (daily cap)                                 │
│ ├─ Risk: $1.12 (very tight)                                  │
│ ├─ Expected Reward: $100                                       │
│ └─ Execution: PROCEED (low confidence but size-capped) ⚠     │
└────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Position Size by Scenario

### By Confidence Level

```
Confidence | CONFIRM Signal | CAUTION Signal | Volatility | Net Position
──────────┼────────────────┼────────────────┼────────────┼──────────────
90-100%   | $850           | $425           | Low (1.2x) | $850 / $425
80-90%    | $720           | $360           | Normal (1x)| $720 / $360
70-80%    | $560           | $280           | High (0.7x)| $392 / $196
60-70%    | $360           | $180           | Extreme    | $108 / $54
50-60%    | $250           | $125           | -          | N/A (too low)
<50%      | SKIP           | SKIP           | -          | N/A
```

### By Signal Source

```
Source     | Multiplier | Confidence Needed | Max Position | Min R/R
───────────┼────────────┼───────────────────┼──────────────┼────────
ML         | 1.0x       | 70%+ (for execution) | $850     | 1.5:1
Scanner    | 0.8x       | 75%+              | $680       | 1.5:1
Gateway    | 0.6x       | 80%+              | $510       | 1.5:1
Agent      | 0.5x       | 85%+              | $425       | 2:1
Manual     | Variable   | 90%+ (trader call) | Per trade | 2:1+
```

### By Trade Type

```
Type        | Timeframe | Ideal Position | SL Method      | TP Method
────────────┼───────────┼────────────────┼────────────────┼────────────
Scalp       | 1m-5m     | $200-400       | Tight ATR 1.0x | % based
Day Trade   | 5m-1h     | $400-600       | ATR 1.5x       | Multi-target
Swing       | 1h-4h     | $600-800       | S/R + ATR      | Resistance
Position    | 4h+       | $800-1000      | S/R (wide)     | Chandelier
```

---

## Decision Flow: Real-Time Execution

```
NEW SIGNAL RECEIVED
  ↓
GET SIGNAL DATA
├─ Source: ML / Scanner / Gateway / Agent
├─ Direction: LONG / SHORT
├─ Confidence: 0-100%
└─ Timeframe: 1m / 5m / 15m / 1h / 4h / 1d

  ↓
POSITION SIZING DECISION
├─ Base size by source weight
├─ Adjust by confidence
├─ Apply volatility multiplier
├─ Check daily budget remaining
├─ Check max open positions
└─ Final position size = F(confidence, vol, budget)

  ↓
SL/TP CALCULATION
├─ Select SL method:
│  ├─ ML Signal → ATR-based
│  ├─ Scanner Signal → S/R + ATR
│  └─ Other → Risk-based
├─ Calculate SL price
├─ Ensure max risk respected
├─ Calculate TP targets (multi-level)
└─ Verify minimum 1.5:1 R/R

  ↓
RISK VALIDATION
├─ Position risk ≤ 2% account per trade
├─ Daily risk used + this trade ≤ $500
├─ Max SL doesn't exceed account equity
├─ Correlation to open trades < 0.7
└─ All checks pass? → EXECUTE : REJECT

  ↓
EXECUTE TRADE
├─ Entry at marked price
├─ Set SL at calculated level
├─ Set TP targets
├─ Log to trade ledger
├─ Add to active monitoring
└─ Send confirmation
```

---

## Unified Intelligence Dashboard Example

```
┌──────────────────────────────────────────────────────────────────┐
│ UNIFIED POSITION SIZING & SL/TP DASHBOARD                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ACCOUNT STATUS                                                   │
│ ├─ Equity: $10,000                                               │
│ ├─ Daily Risk Budget: $500 max                                   │
│ ├─ Used Today: $320 (64%) - CAUTION ZONE                        │
│ ├─ Remaining: $180                                               │
│ ├─ Open Positions: 2/5                                           │
│ └─ Open P&L: +$125 (1.25%)                                       │
│                                                                    │
│ POSITION 1: ML SIGNAL (1h, 85% confidence)                       │
│ ├─ Symbol: BTC/USDT                                              │
│ ├─ Direction: LONG                                               │
│ ├─ Entry: $45,000                                                │
│ ├─ Position: $850 (8.5% of account)                             │
│ ├─ SL: $42,750 | TP1: $45,750 | TP2: $48,000 | TP3: $50,250   │
│ ├─ Risk/Reward: 1:4.7                                           │
│ ├─ Current: $45,200 (+$47.78)                                   │
│ ├─ Method: Confidence-Based + ATR                               │
│ └─ Status: ACTIVE ✓                                             │
│                                                                    │
│ POSITION 2: SCANNER SIGNAL (78% confidence)                      │
│ ├─ Symbol: ETH/USDT                                              │
│ ├─ Direction: LONG                                               │
│ ├─ Entry: $2,850                                                 │
│ ├─ Position: $180 (1.8% of account, daily-capped)              │
│ ├─ SL: $2,690 | TP1: $2,920 | TP2: $3,050 | TP3: $3,250       │
│ ├─ Risk/Reward: 1:13.3                                          │
│ ├─ Current: $2,880 (+$77.50 so far in simulation)              │
│ ├─ Method: Hybrid S/R + ATR                                     │
│ └─ Status: ACTIVE ✓                                             │
│                                                                    │
│ INCOMING SIGNAL (Pending Decision)                              │
│ ├─ Source: Gateway Agent                                        │
│ ├─ Symbol: SOL/USDT                                             │
│ ├─ Direction: SHORT                                              │
│ ├─ Confidence: 65%                                              │
│ ├─ Proposed Position: $180 (daily limit)                        │
│ ├─ Proposed SL: $109 | TP: $105                                │
│ ├─ Risk/Reward: 1:89 (overkill, but acceptable)               │
│ ├─ Daily Risk If Added: $320 + $50 = $370 / $500              │
│ └─ Decision: ✓ APPROVE (within limits)                          │
│                                                                    │
│ STATISTICS                                                        │
│ ├─ Total Trades Today: 8                                        │
│ ├─ Win Rate: 62.5% (5W/3L)                                     │
│ ├─ Avg Win: $145 | Avg Loss: $75                               │
│ ├─ Profit Factor: 1.9                                           │
│ ├─ Largest Win: $380 (ML signal 1h)                            │
│ ├─ Daily P&L: +$125                                             │
│ └─ Efficiency: 68% (using 64% of budget)                        │
│                                                                    │
│ RECOMMENDATIONS                                                  │
│ ├─ Daily budget near threshold (64/100)                         │
│ ├─ Consider reducing Gateway/Agent sizes (lower confidence)     │
│ ├─ ML signals performing best (2.15x profit factor)             │
│ ├─ Consider increasing ML position multiplier                   │
│ └─ Hold at current allocation, monitor closely                  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Integration Checklist

### For Position Sizing

- [x] Confidence-based calculation implemented
- [ ] Volatility adjustment multipliers (ATR-based)
- [ ] Daily risk budget tracking
- [ ] Kelly criterion calculator (for sources with 50+ trades)
- [ ] Position size UI display
- [ ] Position history for analysis

### For Stop Loss & Take Profit

- [x] ATR-based SL/TP implemented
- [ ] Support/Resistance level detection
- [ ] Chandelier stop implementation
- [ ] Multiple target execution
- [ ] SL/TP adjustment UI
- [ ] Trade outcome analysis by method

### For Unified Intelligence

- [ ] Combined decision engine
- [ ] Real-time dashboard
- [ ] Performance tracking by method
- [ ] Recommendation engine
- [ ] Alert system (high risk, budget full, etc.)
- [ ] Historical backtesting

---

## Summary: Key Takeaways

**Position Sizing Method Selection:**
1. **Confidence-based** (primary) - Always use for automated signals
2. **Volatility-adjusted** (multiplier) - Adapt to market conditions
3. **Kelly criterion** (optimization) - Use after 50+ trades per source
4. **Risk-based** (constraint) - Hard floor for position size
5. **Daily budget** (guard rail) - Never exceed $500/day risk

**SL/TP Method Selection:**
1. **ATR-based** (primary) - Automatic, adapts to volatility
2. **S/R levels** (confirmation) - Use for pattern-based signals
3. **Multi-target** (execution) - Standard for all TP (3 levels)
4. **Chandelier trail** (optimization) - Let big winners run
5. **Risk minimum** (constraint) - Never < 1.5:1 R/R

**Unified Approach:**
- Combine methods in layers
- Use decision tree for clarity
- Track performance by method
- Continuously optimize
- Always respect risk limits

