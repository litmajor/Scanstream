# 📊 Agent Ecosystem Metrics Dashboard

**Purpose:** Real-time tracking of all system metrics with derivations, thresholds, and color-coded priorities  
**Update Frequency:** Every market tick (milliseconds) or every second (aggregated)  
**Data Source:** Agent events stream + WebSocket real-time updates

---

## 🎯 Metrics Hierarchy

### **TIER 1: Core Performance Metrics** (Most Important)

#### 1. **Win Rate** 🎯
```
Formula: (Total Wins) / (Total Trades) × 100
Range: 0-100%
Threshold: 50% = Breakeven

🟢 GREEN    (≥65%)  - Excellent trading
🟢 LIME     (55-64%) - Good
🟡 YELLOW   (50-54%) - Breakeven zone
🟠 ORANGE   (40-49%) - Struggling
🔴 RED      (<40%)   - Critical

Update: Real-time (every trade)
Sources: Trade execution events
Example: 243 wins / 360 trades = 67.5% ✅
```

#### 2. **Profit Factor** 💰
```
Formula: (Gross Profit) / (Gross Loss)
Range: 1.0+ (1.0 = breakeven, >2.0 = excellent)
Threshold: 1.5 = Good minimum

🟢 GREEN    (>2.0)   - Excellent profits
🟢 LIME     (1.7-2.0) - Very good
🟡 YELLOW   (1.5-1.69) - Good
🟠 ORANGE   (1.25-1.49) - Acceptable
🔴 RED      (<1.25)  - Losing money

Update: Real-time (every trade)
Sources: Trades collection (P&L calculations)
Example: $18,000 profit / $9,730 loss = 1.85 ✅
```

#### 3. **Sharpe Ratio** ⚡
```
Formula: (Mean Return - Risk-Free Rate) / Std Dev of Returns
Range: -∞ to +∞ (higher = better risk-adjusted returns)
Threshold: 1.0+ = Good

🟣 PURPLE   (>2.0)   - Exceptional risk management
🟢 GREEN    (1.5-2.0) - Excellent
🟢 LIME     (1.0-1.49) - Good
🟡 YELLOW   (0.5-0.99) - Acceptable
🟠 ORANGE   (0-0.49)  - Poor
🔴 RED      (<0)      - Negative returns

Update: Calculated every hour (rolling 30-day)
Sources: Daily returns, volatility
Example: (0.85% - 0.02%) / 0.38% = 2.18 ✅
```

#### 4. **Max Drawdown** 📉
```
Formula: (Peak Value - Trough Value) / Peak Value × 100
Range: 0-100% (how much you lost from peak)
Threshold: -10% = Warning level

🟢 GREEN    (0-5%)   - Excellent discipline
🟢 LIME     (5-10%)  - Good
🟡 YELLOW   (10-15%) - Acceptable
🟠 ORANGE   (15-20%) - High risk
🔴 RED      (>20%)   - Critical risk

Update: Real-time (every new high/low)
Sources: P&L historical data
Example: Lost 8.2% from peak = ⚠️ YELLOW
```

---

### **TIER 2: Agent Activity Metrics** (High Importance)

#### 5. **Active Agents** 🤖
```
Formula: Count(agents where status != 'paused') 
Range: 0-N agents
Threshold: >15 = Diversified, <5 = Concentrated

🟣 PURPLE   (16+)    - Full ecosystem active
🟢 GREEN    (12-15)  - Very good coverage
🟡 YELLOW   (8-11)   - Adequate
🟠 ORANGE   (5-7)    - Risky concentration
🔴 RED      (<5)     - Too concentrated

Update: Real-time (agent pause/resume events)
Sources: Agent status events
Example: 18 agents active ✅
```

#### 6. **Average Agent Win Rate** 📊
```
Formula: Sum(agent.winRate) / Count(agents)
Range: 0-100%
Threshold: 60% = Good average

🟢 GREEN    (>65%)  - Excellent collective performance
🟡 YELLOW   (55-64%) - Good
🟠 ORANGE   (45-54%) - Mixed results
🔴 RED      (<45%)   - Poor collective performance

Update: Real-time (aggregated every 10 trades)
Sources: Individual agent statistics
Example: (67% + 58% + 72% ... ) / 18 = 62.4% 🟡
```

#### 7. **Total XP Earned (Session)** ⭐
```
Formula: Sum(xp_gain events in session)
Range: 0-∞
Threshold: Rate = XP per hour

🟢 GREEN    (>1000/hr) - Excellent learning
🟡 YELLOW   (500-1000/hr) - Good
🟠 ORANGE   (100-499/hr) - Moderate
🔴 RED      (<100/hr)  - Slow learning

Update: Real-time (every xp_gain event)
Sources: XP gain events
Example: +12,450 XP this session ✅
```

#### 8. **Agents at Elite Tier (Diamond+)** 👑
```
Formula: Count(agents where rank in [Diamond, Master])
Range: 0-N
Threshold: >3 = Strong elite force

🟣 PURPLE   (5+)     - Legendary team
🟢 GREEN    (3-4)    - Strong elite
🟡 YELLOW   (2)      - One elite
🟠 ORANGE   (1)      - Building elite
🔴 RED      (0)      - No elites yet

Update: Real-time (level_up events crossing thresholds)
Sources: Agent tier tracking
Example: 4 Diamond agents + 1 Master = 5 elite ✅
```

---

### **TIER 3: Synergy & Combo Metrics** (Medium Importance)

#### 9. **Active Combo Multiplier** ⚡
```
Formula: Max(active_combo.multiplier) or Avg(active_combos.multiplier)
Range: 1.0-3.0x
Threshold: 2.0x = Strong multiplier

🟣 PURPLE   (>2.5x)  - Legendary combo
🟢 GREEN    (2.0-2.5x) - Excellent synergy
🟡 YELLOW   (1.5-1.99x) - Good combo
🟠 ORANGE   (1.2-1.49x) - Moderate combo
🔴 RED      (<1.2x)   - Weak combo

Update: Real-time (combo activation events)
Sources: Combo system events
Example: Perfect Storm = 2.5x ✅
```

#### 10. **Total Combo Activations (Session)** 🔗
```
Formula: Count(combo_activation events)
Range: 0-∞
Threshold: Rate = Combos per hour

🟢 GREEN    (>5/hr)  - Excellent synergy
🟡 YELLOW   (2-5/hr) - Good coordination
🟠 ORANGE   (1-2/hr) - Moderate
🔴 RED      (<1/hr)  - Rare combos

Update: Real-time (every combo activation)
Sources: Combo activation events
Example: 23 combos activated today ✅
```

#### 11. **Unique Combo Types** 🎯
```
Formula: Count(distinct combo_names activated)
Range: 0-N possible combos
Threshold: >5 = Diverse synergies

🟢 GREEN    (>8)     - Highly adaptive
🟡 YELLOW   (5-8)    - Good diversity
🟠 ORANGE   (3-5)    - Limited combos
🔴 RED      (<3)     - Repetitive

Update: Real-time (first activation of each combo type)
Sources: Combo database + activation history
Example: 12 different combo types active ✅
```

#### 12. **Average Combo Impact Score** 📈
```
Formula: Avg(combo.impact) across all activations
Range: 0-100%
Threshold: 70% = Strong impact

🟢 GREEN    (>75%)  - Highly impactful
🟡 YELLOW   (60-75%) - Good impact
🟠 ORANGE   (40-60%) - Moderate impact
🔴 RED      (<40%)   - Low impact

Update: Real-time (aggregated every 10 combos)
Sources: Combo activation events with impact scores
Example: Average impact 87% ✅
```

---

### **TIER 4: Risk & Health Metrics** (Important)

#### 13. **System Confidence Score** 🎯
```
Formula: Avg(signal.confidence) across active signals
Range: 0-100%
Threshold: 70% = Good confidence

🟣 PURPLE   (>90%)  - Extremely confident
🟢 GREEN    (75-90%) - Very confident
🟡 YELLOW   (60-74%) - Confident
🟠 ORANGE   (45-59%) - Uncertain
🔴 RED      (<45%)   - Low confidence

Update: Real-time (every signal generation)
Sources: Agent signal confidence values
Example: Average confidence 72% 🟡
```

#### 14. **Paused Agents** ⏸️
```
Formula: Count(agents where status = 'paused')
Range: 0-N
Threshold: >0 = Something's wrong

🟢 GREEN    (0)      - All agents trading
🟡 YELLOW   (1-2)    - Minor pause
🟠 ORANGE   (3-5)    - Moderate pause
🔴 RED      (>5)     - Major issues

Update: Real-time (pause/resume events)
Sources: Agent pause events (gap detected, low confidence)
Example: 2 agents paused (gap on SPY) 🟡
```

#### 15. **Portfolio Heat** 🔥
```
Formula: Sum(|position_size|) / total_capital × 100
Range: 0-∞%
Threshold: 100% = Full capital deployed

🟢 GREEN    (<50%)   - Conservative
🟡 YELLOW   (50-100%) - Moderate
🟠 ORANGE   (100-150%) - Aggressive
🔴 RED      (>150%)   - Extreme leverage

Update: Real-time (every position change)
Sources: Portfolio agent position tracking
Example: 87% capital deployed 🟡
```

#### 16. **Risk-Adjusted Return** 💹
```
Formula: (Total Return %) / Max Drawdown %
Range: 0-∞
Threshold: >3.0 = Excellent

🟣 PURPLE   (>5.0)   - Exceptional
🟢 GREEN    (3.0-5.0) - Excellent
🟡 YELLOW   (2.0-2.99) - Good
🟠 ORANGE   (1.0-1.99) - Acceptable
🔴 RED      (<1.0)    - Poor

Update: Real-time (depends on return + drawdown)
Sources: P&L data + drawdown tracking
Example: 15% return / 8% max DD = 1.875 🟡
```

---

### **TIER 5: Achievement & Progression** (Nice to Have)

#### 17. **Total Achievements Unlocked** 🏆
```
Formula: Count(achievements where unlocked = true)
Range: 0-N total achievements
Threshold: N/2 = Half unlocked

🟣 PURPLE   (>75%)  - Nearly complete
🟢 GREEN    (50-75%) - Excellent progress
🟡 YELLOW   (25-50%) - Good progress
🟠 ORANGE   (10-25%) - Building up
🔴 RED      (<10%)   - Just starting

Update: Real-time (achievement_unlock events)
Sources: Achievement system
Example: 34 of 42 achievements unlocked ✅
```

#### 18. **Tier Distribution** 📊
```
Formula: [Bronze%, Silver%, Gold%, Platinum%, Diamond%, Master%]
Range: 0-100% each
Threshold: Pyramid distribution expected

Display as horizontal bar:
🟤 Bronze: 30%
⚫ Silver: 25%
🟡 Gold: 20%
🟦 Platinum: 15%
💎 Diamond: 8%
👑 Master: 2%

Update: Real-time (tier changes)
Sources: Agent level/tier data
```

#### 19. **Average Agent Level** 📈
```
Formula: Sum(agent.level) / Count(agents)
Range: 1-∞
Threshold: Depends on session age

🟢 GREEN    (>20)    - Very experienced team
🟡 YELLOW   (15-20)  - Experienced team
🟠 ORANGE   (10-15)  - Growing team
🔴 RED      (<10)    - New agents

Update: Real-time (level_up events)
Sources: Agent level tracking
Example: Average level 22 🟢
```

#### 20. **Mood Distribution** 😊
```
Formula: [Focused%, Cautious%, Aggressive%, Tilted%]
Range: 0-100% each
Threshold: Balanced = good

Display as pie/donut:
🎯 Focused: 40%
⚠️ Cautious: 25%
🔥 Aggressive: 30%
😤 Tilted: 5%

Target: Minimize tilted, balance others
Update: Real-time (mood_change events)
```

---

## 🎨 Visual Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│              📊 SYSTEM METRICS COMMAND CENTER 📊                 │
│                    🟢 HEALTHY | Real-Time                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ CORE PERFORMANCE ────────┐  ┌─ AGENT ACTIVITY ──────────┐  │
│  │ Win Rate: 67.5%        🟢 │  │ Active Agents: 18/18   🟣 │  │
│  │ Profit Factor: 1.85    🟢 │  │ Avg Win Rate: 62.4%    🟡 │  │
│  │ Sharpe: 2.18          🟣 │  │ Total XP: 12,450 ⭐     🟢 │  │
│  │ Max DD: -8.2%         🟡 │  │ Elite (D+): 5 agents    🟢 │  │
│  └───────────────────────────┘  └────────────────────────────┘  │
│                                                                   │
│  ┌─ SYNERGY & COMBOS ────────┐  ┌─ RISK & HEALTH ───────────┐  │
│  │ Active Combo Mult: 2.5x ✅ 🟢 │ Confidence: 72%       🟡 │  │
│  │ Combos (Session): 23    🟢 │  │ Paused Agents: 2      🟡 │  │
│  │ Unique Combos: 12       🟢 │  │ Portfolio Heat: 87%   🟡 │  │
│  │ Combo Impact: 87%       🟢 │  │ Risk-Adj Return: 1.88 🟡 │  │
│  └───────────────────────────┘  └────────────────────────────┘  │
│                                                                   │
│  ┌─ ACHIEVEMENTS ────────────┐  ┌─ PROGRESSION ─────────────┐  │
│  │ Unlocked: 34/42        🟢 │  │ Avg Level: 22         🟢 │  │
│  │                            │  │ Mood: 🎯40% ⚠️25%       │  │
│  │ Tier Distribution:         │  │       🔥30% 😤5%       │  │
│  │ 🟤 30% ⚫ 25% 🟡 20%        │  │                        │  │
│  │ 🟦 15% 💎 8%  👑 2%        │  │ Session Time: 2h 34m  │  │
│  └───────────────────────────┘  └────────────────────────────┘  │
│                                                                   │
│  ┌─ SYSTEM ALERTS (3 ACTIVE) ────────────────────────────────┐  │
│  │ ⚠️ YELLOW: 2 agents paused (SPY gap detected)              │  │
│  │ ⚠️ YELLOW: Low confidence BTC at 42%                        │  │
│  │ ℹ️ INFO: BreakoutHunter achieved Elite status              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Real-Time Update Flow

```
EVENT STREAM (WebSocket)
    ↓
Event Type → Metric Calculation
    ├─ xp_gain → Total XP, Avg Agent WR
    ├─ level_up → Avg Level, Elite Count, Tier Distribution
    ├─ trade_result → Win Rate, Profit Factor, Sharpe, Max DD
    ├─ combo_activation → Combo Count, Avg Multiplier, Impact Score
    ├─ achievement_unlocked → Achievement Count
    ├─ mood_change → Mood Distribution
    └─ gap_detected → Paused Agents
    ↓
METRICS DATABASE (Update)
    ↓
DASHBOARD REFRESH (1-2s debounce)
    ↓
UI COMPONENTS REPAINT
    ├─ Color changes
    ├─ Number animations
    ├─ Alert updates
    └─ Sparkle effects
```

---

## 🎯 Alert System

```
CRITICAL (🔴 RED) - Immediate action needed
├─ Max DD exceeded -25%
├─ Profit Factor < 1.0 (losing money)
├─ >10 agents paused
└─ System confidence < 30%

WARNING (🟠 ORANGE) - Monitor closely
├─ Max DD > -15%
├─ Win rate < 45%
├─ Profit Factor < 1.25
├─ >5 agents paused
└─ System confidence 30-50%

CAUTION (🟡 YELLOW) - Be aware
├─ Max DD > -10%
├─ Win rate 45-54%
├─ Profit Factor 1.25-1.5
├─ 1-2 agents paused
└─ System confidence 50-70%

INFO (ℹ️ BLUE) - Good to know
├─ Achievement unlocked
├─ Agent level up
├─ Combo activated (notable)
└─ Tier upgraded
```

---

## 📊 Data Sources & Collection

```
Real-Time Streaming (WebSocket):
  - xp_gain events
  - level_up events
  - trade_result events
  - combo_activation events
  - mood_change events
  - achievement_unlocked events
  - gap_detected events

Periodic Aggregation (every 10s):
  - Active agent count
  - Average win rate
  - Portfolio positions
  - Confidence scores

Historical Calculation (hourly):
  - Sharpe ratio (30-day rolling)
  - Profit factor (session)
  - Max drawdown (session)

Database Queries:
  - Achievements database
  - Agent tier/level data
  - Session start time
```

---

## 💾 Storage Schema

```typescript
interface SystemMetrics {
  // Core Performance
  winRate: number;                    // 0-100
  profitFactor: number;               // 1.0+
  sharpeRatio: number;                // -∞ to +∞
  maxDrawdown: number;                // -100 to 0
  
  // Activity
  activeAgents: number;               // Count
  avgAgentWinRate: number;            // 0-100
  totalXpEarned: number;              // 0-∞
  eliteAgentCount: number;            // Count
  
  // Synergy
  activeComboBias: number;            // 1.0-3.0x
  totalComboActivations: number;      // Count
  uniqueComboCount: number;           // Count
  avgComboImpact: number;             // 0-100
  
  // Risk
  systemConfidence: number;           // 0-100
  pausedAgentCount: number;           // Count
  portfolioHeat: number;              // 0-∞%
  riskAdjustedReturn: number;         // 0-∞
  
  // Achievement
  achievementsUnlocked: number;       // Count
  tierDistribution: Record<string, number>;  // %
  avgAgentLevel: number;              // 0-∞
  moodDistribution: Record<string, number>;  // %
  
  // Metadata
  sessionStartTime: Date;
  lastUpdated: Date;
  healthStatus: 'CRITICAL' | 'WARNING' | 'CAUTION' | 'HEALTHY';
}
```

---

## 🎮 Interactive Features

```
Click on any metric:
  → Show derivation formula
  → Show historical graph (1h, 1d, 1w)
  → Show affected agents/trades
  → Show alert threshold ranges

Hover on metric:
  → Tooltip with definition
  → Color meaning explanation
  → What affects this metric

Drag metric card:
  → Reorder dashboard
  → Pin frequently used
  → Hide less important

Color legend:
  → Click to show all metrics of that priority
  → Toggle between tiles and list view
```

---

## 🚀 Implementation Priority

```
Phase 1 (MVP):
  ✅ Win Rate
  ✅ Profit Factor
  ✅ Max Drawdown
  ✅ Active Agents
  ✅ Combo Count
  ✅ System Alerts

Phase 2:
  ⏳ Sharpe Ratio
  ⏳ Risk-Adjusted Return
  ⏳ Achievement Progress
  ⏳ Tier Distribution

Phase 3:
  ⏳ Sonification
  ⏳ Historical graphs
  ⏳ Predictive alerts
  ⏳ Custom thresholds
```

---

This gives you a **complete metrics system** with:
- ✅ 20 key metrics covering all aspects
- ✅ Color-coded priorities & meanings
- ✅ Derivation formulas for transparency
- ✅ Real-time updates from WebSocket
- ✅ Alert system for quick action
- ✅ Visual dashboard layout
- ✅ Interactive features

Want me to build the dashboard component now?
