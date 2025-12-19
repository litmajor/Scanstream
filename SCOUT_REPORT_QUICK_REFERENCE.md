/**
 * SCOUT REPORT - QUICK REFERENCE CARD
 * 
 * Cheat sheet for understanding Scout Reports and their data structure
 */

# Scout Report - Quick Reference Card

## What is a Scout Report?

A **Scout Report** is a comprehensive, multi-source signal analysis that aggregates insights from:
- **ML** (machine learning predictions across 6 timeframes)
- **Scanner** (technical patterns, levels, volume)
- **Agents** (custom trading logic)
- **Price Action** (real-time market data)

**Into a single, unified view** showing:
- What each source says (with individual confidence)
- What they agree on (consensus)
- What could go wrong (alternatives)
- What trade types fit (scalp/day/swing)
- What the probability is (data-backed)

---

## Scout Report Structure at a Glance

```
┌─────────────────────────────────────────────────────────┐
│ SCOUT REPORT: BTC/USDT                                  │
├─────────────────────────────────────────────────────────┤
│ ⏰ Generated: 2024-12-17 15:30:00 UTC                  │
│ ⏱️ Valid Until: 2024-12-17 16:30:00 UTC               │
├─────────────────────────────────────────────────────────┤
│ 📊 EXECUTIVE SUMMARY                                    │
│    Direction: BULLISH                                   │
│    Confidence: 82%                                      │
│    Conviction: HIGH                                     │
│    Urgency: IMMINENT                                    │
├─────────────────────────────────────────────────────────┤
│ 🔍 SOURCE ANALYSIS                                      │
│    ├─ 🤖 ML: BULLISH (85% confidence)                  │
│    ├─ 📱 Scanner: BULLISH (78% confidence)             │
│    └─ 🤖 Agents: BULLISH (72% avg confidence)          │
├─────────────────────────────────────────────────────────┤
│ 🤝 CONSENSUS                                            │
│    Direction: BULLISH (75% agreement)                  │
│    Alternative: BEARISH (18% probability)              │
├─────────────────────────────────────────────────────────┤
│ 💡 OPPORTUNITIES                                        │
│    ├─ Scalp: Quick move in 5-15 min                   │
│    ├─ Day: Trend move in 1-4 hours                    │
│    └─ Swing: Sustained move in 1-5 days               │
├─────────────────────────────────────────────────────────┤
│ ⚠️ RISK ASSESSMENT                                      │
│    Stop Loss: $44,950                                   │
│    Risk/Reward: 1:2.5                                   │
│    Probability: 72%                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### 1. Source Analysis
**What it shows:** Each signal source separately with its own confidence

```
🤖 ML (Machine Learning)
   ├─ Timeframe: 1h
   ├─ Direction: BULLISH
   ├─ Confidence: 85%
   ├─ Top Indicator: RSI (68) - HIGH impact
   └─ Trend: ACCELERATING

📱 Scanner (Technical Patterns)
   ├─ Pattern: BULL_FLAG
   ├─ Confidence: 78%
   ├─ Target: $45,300
   ├─ Stop Loss: $44,950
   └─ Historical Win Rate: 68%

🤖 Agent-1 (Momentum Agent)
   ├─ Signal: LONG
   ├─ Confidence: 88%
   ├─ Reason: RSI > 70 + MACD positive
   └─ Track Record: 72% win rate
```

**Why it matters:**
- See which source is most confident
- Understand the reasoning behind each signal
- Compare different viewpoints
- Make informed decisions

---

### 2. Consensus + Alternatives

**What it shows:** Main direction (consensus) + minority views (alternatives)

```
✅ CONSENSUS (75% agreement)
   Direction: BULLISH
   Supporting Sources: ML, Scanner, Agent-1, Agent-2, Agent-4
   Confidence: 82%
   Probability: 75% (likelihood this is correct)

⚠️ ALTERNATIVE #1 (18% probability)
   Direction: BEARISH (instead of BULLISH)
   Supporting: Agent-3 (48% confidence)
   Trigger: "If price rejects $45,150"
   Target: $44,950

⚠️ ALTERNATIVE #2 (7% probability)
   Direction: NEUTRAL (no clear move)
   Supporting: None strong
   Trigger: "If price consolidates 30+ minutes"
   Duration: Several hours
```

**Why it matters:**
- Consensus isn't always 100% certain
- Know what could go wrong
- Plan for alternative scenarios
- Improve risk management

---

### 3. Trade Type Classification

**What it shows:** What trade style fits best (by timeframe)

```
🏃 SCALP (1-5 minutes)
   └─ Quick entry/exit
   └─ Small target ($50-200)
   └─ Tight stop loss
   └─ For impatient traders
   └─ High frequency

📊 DAYTRADE (1-4 hours)
   └─ Morning to afternoon
   └─ Medium target ($200-1000)
   └─ Wider stop loss
   └─ For active traders
   └─ Medium frequency

🏕️ SWING (1-5 days)
   └─ Multi-day holds
   └─ Large target ($1000+)
   └─ Wide stop loss
   └─ For patient traders
   └─ Low frequency
```

**Example:**
```
BTC/USDT Scout Report finds opportunities in:
├─ SCALP: $45,050-$45,300 (in 5-15 min)
├─ DAY: $45,100-$46,200 (in 2-4 hours)
└─ SWING: $45,100-$48,000 (in 2-5 days)

All valid, but suit different trading styles.
```

**Why it matters:**
- Know which setup matches your style
- Different targets for different timeframes
- Scale position size appropriately
- Plan time commitment

---

### 4. Confidence vs. Agreement

**What it shows:** How strong the signal is + how many sources agree

```
CONFIDENCE
├─ What: How certain are we of this direction
├─ Range: 0-100% (0-1.0 in code)
├─ Sources:
│  ├─ ML: Based on 18 technical indicators
│  ├─ Scanner: Based on pattern recognition
│  ├─ Agents: Based on custom rules
│  └─ Combined: Weighted average
└─ Example: "82% confident this is BULLISH"

AGREEMENT
├─ What: What % of sources support this direction
├─ Range: 0-100% (0-1.0 in code)
├─ Calculation: (Supporting sources) / (Total sources)
├─ Example: 5 out of 6 sources = 83% agreement
└─ Meaning: Strong consensus (but 1 source disagrees)
```

**Key Insight:**
```
High Confidence (85%) + High Agreement (90%) = VERY STRONG SIGNAL
High Confidence (85%) + Low Agreement (40%) = DISAGREEMENT (risk)
Low Confidence (50%) + High Agreement (90%) = WEAK BUT AGREED
Low Confidence (50%) + Low Agreement (40%) = WEAK AND DISAGREED
```

---

### 5. Risk/Reward Ratio

**What it shows:** How much you risk vs. how much you can make

```
RISK = Stop Loss - Entry Price
REWARD = Target - Entry Price

RISK/REWARD RATIO = REWARD / RISK

Example:
├─ Entry: $45,100
├─ Stop Loss: $44,950 (Risk: $150)
├─ Target: $45,300 (Reward: $200)
├─ Ratio: $200 / $150 = 1:1.33
└─ Meaning: For every $1 risked, you make $1.33

Common Ratios:
├─ 1:1 = Breakeven (not ideal)
├─ 1:1.5 = Fair (acceptable)
├─ 1:2.0 = Good (good)
├─ 1:2.5+ = Excellent (seek these)
└─ 1:3.0+ = Outstanding (rare but awesome)
```

**Why it matters:**
- Better risk/reward = better long-term profits
- Even if win rate is 50%, can be profitable with good R:R
- Scout Reports highlight best opportunities by R:R

---

### 6. Probability & Expected Value

**What it shows:** Likelihood of success + average profit per trade

```
PROBABILITY
├─ What: % chance the trade wins
├─ Source: Historical data (how often this pattern wins)
├─ Range: 0-100%
├─ Example: "Bull flag has 68% historical win rate"
└─ Meaning: 68 out of 100 similar setups win

EXPECTED VALUE (EV)
├─ Formula: (Probability × Profit) - ((1-Probability) × Loss)
├─ Example:
│  ├─ Win rate: 72%
│  ├─ Avg win: $200
│  ├─ Avg loss: $150
│  ├─ EV = (0.72 × $200) - (0.28 × $150)
│  ├─ EV = $144 - $42
│  └─ EV = +$102 per trade
└─ Meaning: Expect to make $102 on average

Positive EV = Trade this
Negative EV = Skip it
```

**Why it matters:**
- Scout Reports rank by EV (best first)
- Highest EV trades = best long-term returns
- Filter by minimum EV for quality setups

---

## Filter & View Options

### Available Filters

```
By Trade Type:
  GET /api/scout/BTC?type=SCALP
  GET /api/scout/BTC?type=DAY
  GET /api/scout/BTC?type=SWING

By Source:
  GET /api/scout/BTC?source=ML
  GET /api/scout/BTC?source=SCANNER
  GET /api/scout/BTC?source=AGENTS

By Confidence:
  GET /api/scout/BTC?minConfidence=0.75
  GET /api/scout/BTC?minConfidence=0.85

By Agreement:
  GET /api/scout/BTC?minAgreement=0.70

By Risk/Reward:
  GET /api/scout/BTC?minRiskReward=2.0

By Probability:
  GET /api/scout/BTC?minProbability=0.65

Combinations:
  GET /api/scout/BTC?type=SCALP&minConfidence=0.80&minRiskReward=2.0
  └─ Find scalps with 80%+ confidence and 2:1 risk/reward
```

---

## Scout Report Fields Explained

### Executive Summary

```typescript
{
  primaryOpportunity: "BULLISH",  // Main direction
  confidence: 0.82,                // 0-1 scale (82%)
  conviction: "HIGH",              // VERY_HIGH, HIGH, MEDIUM, LOW
  urgency: "IMMINENT",             // IMMEDIATE, IMMINENT, DEVELOPING, LOW
}
```

| Field | Meaning | Use |
|-------|---------|-----|
| Confidence | How sure we are (0-1) | Higher = better |
| Conviction | Strength of opinion | HIGH = act on it |
| Urgency | How soon it happens | IMMEDIATE = act now |

---

### Source Analysis

```typescript
// Each source has:
{
  direction: "BULLISH",           // BULLISH, BEARISH, NEUTRAL
  confidence: 0.85,                // How confident this source is
  reasoning: "RSI > 70, MACD pos", // Why this source thinks so
  indicators: [...],               // What indicators support it
  trackRecord: {
    winRate: 0.72,                 // Historical win %
    profitFactor: 2.15,            // Profit/loss ratio
  }
}
```

---

### Trade Opportunities

```typescript
{
  type: "SCALP",                   // SCALP, DAY, SWING
  timeframe: "1m",                 // 1m, 5m, 15m, 1h, 4h, 1d
  
  entry: {
    price: 45100,                  // Entry price
    trigger: "Breakout above 45150" // When to enter
  },
  
  targets: {
    primary: 45300,                // First target
    secondary: 45500,              // Second target
    tertiary: 45700                // Third target (if running)
  },
  
  stopLoss: 44950,                 // Stop loss level
  
  metrics: {
    riskReward: 2.5,               // Risk/Reward ratio
    probability: 0.72,             // Win probability %
    expectedValue: 255,            // Expected profit
  }
}
```

---

### Consensus

```typescript
{
  direction: "BULLISH",            // Main consensus
  confidence: 0.82,                // Consensus confidence
  agreementLevel: 0.75,            // % sources agreeing (75%)
  
  alternativeViews: [
    {
      direction: "BEARISH",        // Alternative direction
      probability: 0.18,           // Chance this happens
      trigger: "Rejection at $46k", // What would cause it
      description: "Lower high pattern"
    }
  ]
}
```

---

## Examples: Reading Scout Reports

### Example 1: STRONG Signal

```
Scout Report: BTC/USDT

Executive Summary:
├─ Direction: BULLISH
├─ Confidence: 87%
├─ Conviction: VERY_HIGH
├─ Urgency: IMMEDIATE

Sources:
├─ ML (1h): BULLISH (85%)
├─ Scanner: BULLISH (81%)
└─ Agents: BULLISH (88% avg)

Consensus:
├─ Direction: BULLISH
├─ Agreement: 100% (all agree!)
└─ Alternative: BEARISH (5% probability)

Interpretation:
✅ Everything points BULLISH
✅ No disagreement
✅ Very high conviction
✅ Act on it!
```

### Example 2: MIXED Signal

```
Scout Report: ETH/USDT

Executive Summary:
├─ Direction: BULLISH
├─ Confidence: 62%
├─ Conviction: MEDIUM
├─ Urgency: DEVELOPING

Sources:
├─ ML (1h): BULLISH (68%)
├─ Scanner: NEUTRAL (52%)
└─ Agents: MIXED (55% avg)

Consensus:
├─ Direction: BULLISH (slight)
├─ Agreement: 50% (split decision)
└─ Alternative: BEARISH (35% probability)

Interpretation:
⚠️ Mixed signals
⚠️ Disagreement present
⚠️ Lower conviction
⚠️ Higher risk - consider waiting
```

### Example 3: WEAK Signal (SKIP)

```
Scout Report: SOL/USDT

Executive Summary:
├─ Direction: BULLISH
├─ Confidence: 48%
├─ Conviction: LOW
├─ Urgency: LOW

Sources:
├─ ML (1h): NEUTRAL (52%)
├─ Scanner: BEARISH (45%)
└─ Agents: MIXED (48% avg)

Consensus:
├─ Direction: NEUTRAL (weak bullish)
├─ Agreement: 35% (most disagree)
└─ Alternative: BEARISH (48% probability)

Interpretation:
❌ Weak signal
❌ High disagreement
❌ Low conviction
❌ SKIP - wait for clarity
```

---

## Scout Report Decision Matrix

Use this to decide what to do with a Scout Report:

```
┌────────────────────┬─────────────┬──────────────┐
│ Confidence × Agree │ What to Do  │ Position     │
├────────────────────┼─────────────┼──────────────┤
│ 85%+ × 90%+        │ ✅ EXECUTE  │ LARGE/FULL   │
│ 75-85% × 75-90%    │ ✅ EXECUTE  │ MEDIUM       │
│ 65-75% × 60-75%    │ ⚠️  CAUTION │ SMALL        │
│ 55-65% × 40-60%    │ ⚠️  WAIT    │ SKIP/SMALL   │
│ < 55% × < 40%      │ ❌ SKIP     │ NONE         │
└────────────────────┴─────────────┴──────────────┘
```

---

## Common Scout Report Patterns

### Pattern 1: All Green ✅
```
Direction: BULLISH
ML: 85% (BULLISH)
Scanner: 80% (BULLISH)
Agents: 82% avg (BULLISH)
Agreement: 95%
→ Very strong signal. Execute full size.
```

### Pattern 2: Mixed with Consensus ⚠️
```
Direction: BULLISH
ML: 75% (BULLISH)
Scanner: 68% (NEUTRAL)
Agents: 65% avg (BULLISH)
Agreement: 60%
→ Moderate signal. Execute smaller size, tighter stops.
```

### Pattern 3: Disagreement ⚠️⚠️
```
Direction: BULLISH
ML: 72% (BULLISH)
Scanner: 45% (BEARISH)
Agents: 55% avg (NEUTRAL)
Agreement: 40%
→ Weak signal. Skip or wait for clarity.
```

### Pattern 4: Contrarian ⭐
```
Direction: BULLISH
ML: 52% (NEUTRAL)
Scanner: 48% (BEARISH)
Agents: 45% avg (BEARISH)
Agreement: 20%
Alternative BEARISH: 75% probability
→ Actually BEARISH is stronger. Reverse the signal!
```

---

## Using Scout Reports Effectively

### Daily Workflow

```
1. MORNING (Market open)
   └─ Review high-conviction scouts (80%+ confidence)
   └─ Filter by SCALP for quick morning setups
   └─ Action: Place a few scalps

2. MID-DAY
   └─ Check for DAYTRADE setups (4+ hours to close)
   └─ Look at intraday breakouts
   └─ Action: Enter daytrades with medium conviction

3. AFTERNOON
   └─ Scout for SWING setups (overnight holds)
   └─ Look at daily timeframes
   └─ Action: Plan entries for tomorrow/next week

4. END OF DAY
   └─ Review all scouts for next day
   └─ Update price levels
   └─ Prepare entry points
```

### Smart Filtering

```
"Give me the best scalp setups"
→ GET /api/scout/multi?type=SCALP&minConfidence=0.80

"Show me daytrade setups with 2:1+ risk/reward"
→ GET /api/scout/multi?type=DAY&minRiskReward=2.0

"Which scouts have strongest ML but weak scanner?"
→ Compare sources side-by-side

"Find scout where all 4 agents agree"
→ GET /api/scout/multi?agents=UNANIMOUS
```

---

## Summary

**Scout Reports = Professional Trading Intelligence**

They show you:
- ✅ What each source predicts (ML, Scanner, Agents)
- ✅ What they agree on (Consensus)
- ✅ What could go wrong (Alternatives)
- ✅ What trade type fits (Scalp/Day/Swing)
- ✅ How likely it is (Probability + EV)
- ✅ What the risk/reward is (R:R ratios)

**Use them to:**
- Make faster decisions
- Reduce losses (see alternatives)
- Improve win rate (filter by probability)
- Choose best opportunities (rank by EV)
- Trade multiple styles (scalp/day/swing)

**Key Rule:** Higher confidence + higher agreement = act sooner, larger position

---

**Start using Scout Reports and transform raw signals into actionable intelligence.** 🚀
