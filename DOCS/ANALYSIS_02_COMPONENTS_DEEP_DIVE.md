# RPG Trading Agent System - Part 2: Component Deep Dive

**Focus:** Agent types, Market Oracle, RPG mechanics, Skills & Abilities

---

## 1. Agent Types & Specializations

### 1.1 BreakoutHunter

**Role:** Momentum & Breakout Specialist  
**Personality:** Aggressive  
**Best For:** Volatile, trending markets

**Signal Logic:**
```
IF price > resistance AND volume > 2x avg_volume THEN BUY
```

**Key Features:**
- Volume confirmation (must see 2-3x volume spike)
- False breakout detection (skills-based)
- Velocity-based targets (if ability unlocked)
- Regime-aware confidence scaling

**Skill Progression:**
```
Level 1:  Pattern Recognition 1, basic breakout detection (51% win rate)
Level 5:  Unlock intelligent exits ability
Level 7:  Unlock multi-timeframe confirmation
Level 12: Reach Pattern Recognition 8, detect false breakouts early
Level 23: Max Pattern Recognition 10, 64% win rate
```

**File:** `server/services/rpg-agents/BreakoutHunter.ts` (98 lines)

---

### 1.2 TrendRider

**Role:** Trend Following Specialist  
**Personality:** Balanced  
**Best For:** Strong directional markets

**Signal Logic:**
```
IF multi-timeframe gradient UP (1H/4H/1D) AND EMA alignment confirms AND
   trend change detected AND ADX > 20 (trend strength)
THEN BUY (gradient strength + confluence score > 0.65)
```

**Key Features (ENHANCED with Multi-Timeframe Gradient Analysis):**
- **Triple EMA Smoothing** - EMAs on 25, 100, 240 periods (1H, 4H, 1D)
- **Gradient Trend Detection** - Calculates trend direction from EMA slope
- **Gradient Strength Scoring** - 0-1 score on steepness of gradient
- **Multi-Timeframe Confluence** - How many timeframes agree on direction
- **Fibonacci Bands** - Dynamic support/resistance from trend gradient
- **Trend Change Detection** - Identifies EMA crossovers
- **ADX Integration** - Verifies trend strength (must be > 20)

**Gradient Analysis Logic:**
```
For each timeframe (1H, 4H, 1D):
  1. Calculate 25-period EMA (short-term trend)
  2. Calculate 100-period EMA (medium-term trend)
  3. Calculate 240-period EMA (long-term trend)
  4. Compute slope: (current_ema - ema_20bars_ago) / 20
  5. Normalize slope to 0-1 gradient strength
  
Confluence: Count timeframes where all 3 EMAs aligned (short > medium > long or reverse)
Direction: UP if all timeframes show uptrend, DOWN if all downtrend, NEUTRAL otherwise
Strength: Average gradient strength × confluence_factor
```

**Signal Quality Calculation:**
```
quality = 
  (gradient_strength × 0.40) +
  (confluence_score × 0.25) +
  (ema_alignment × 0.15) +
  (adx_level × 0.15) +
  (trend_change_bonus × 0.15)

confluence_score = (aligned_timeframes / 3)  // 1/3, 2/3, or 3/3
trend_change_bonus = +0.15 if crossover detected recently

quality *= (1 + timing_precision_skill / 20)  // Skill enhancement
quality *= regime_multiplier:
  - TRENDING_UP: 1.2x (perfect regime for TrendRider)
  - TRENDING_DOWN: 1.2x (short opportunities)
  - RANGING: 0.5x (trends aren't forming)
  - VOLATILE: 0.8x (trend gets whipsawed)

Threshold: quality >= 0.65
```

**Ability Unlocks:**
- Level 5: Intelligent exits (use Fibonacci levels for profit taking)
- Level 10: Multi-timeframe visualization (see trends on all 3 TF)
- Level 15: Trend acceleration detection (identify strong breakouts)

**File:** `server/services/rpg-agents/TrendRider.ts` (280+ lines, gradient-based)

---

### 1.3 SupportSniper

**Role:** Support/Resistance & Bounce Specialist  
**Personality:** Conservative  
**Best For:** Range-bound, bouncy markets

**Signal Logic:**
```
IF price bounces from support AND volume confirms AND RSI recovers THEN BUY
IF resistance zone detected with confluence AND volume spike THEN SELL (bounces off resistance)
```

**Key Features (ENHANCED with VBSR):**
- **Volume-Based Zone Detection** - Multi-timeframe support/resistance zones
- **ATR-Dynamic Zone Sizing** - Zones expand/contract with volatility
- **Zone Strength Scoring** - 0-1 score based on volume + touches + age
- **Bounce Quality Scoring** - Validates zones have been tested
- **Confluence Detection** - Multiple timeframes = higher probability
- **Touch Tracking** - Monitors how many times a zone is tested
- **Zone Merging** - Combines nearby zones with volume weighting

**VBSR Settings:**
```
- Zone width: 0.5 * ATR (dynamic sizing)
- Volume threshold: Top 15% volume only
- Minimum zone width: 0.25%
- Zone merge distance: 0.5%
- Max zones tracked: 20 per type (memory management)
- Multi-timeframe: 1H, 4H, 1D zones
```

**Ability Unlocks:**
- Level 5: Intelligent exits (tighter stops at support)
- Level 15: Correlation hedging (identify risky support levels)
- Level 20: Multi-timeframe zone visualization

**File:** `server/services/rpg-agents/SupportSniper.ts` (450+ lines, VBSR enhanced)

---

### 1.4 ReversalMaster

**Role:** Mean Reversion Specialist  
**Personality:** Aggressive  
**Best For:** Overbought/oversold conditions

**Signal Logic:**
```
IF RSI extremes/divergence AND MACD divergence AND hidden divergence AND
   momentum exhaustion AND volume exhaustion AND excessive move detected AND
   BB out-of-range AND support proximity
THEN BUY/SELL (7-factor confluence system)
```

**Key Features (ENHANCED with 7-Factor Ensemble):**
- **RSI Divergence** - Bullish/bearish divergence (price vs RSI) - 25% weight
- **MACD Divergence** - Price moves but MACD doesn't - component of 25%
- **Hidden Divergence** - Pullback patterns and reversal signals - 15% weight
- **Momentum Exhaustion** - 4+ consecutive moves in same direction = exhaustion - 20% weight
- **Volume Exhaustion** - Volume spike followed by decline = energy spent - 15% weight
- **Excessive Move Detection** - 15%+ price move in 5 periods = reversal likely - 15% weight
- **Bollinger Bands Analysis** - Position within bands (overbought/oversold) - 10% weight

**Confluence Scoring:**
```
Minimum 3/7 factors must align for entry signal
Quality score = (aligned_factors / 7) * base_confidence
Confluence bonus = +15% if 5+ factors align
Support proximity bonus = +10% if at identified support/resistance
```

**Signal Quality Calculation:**
```
quality = 
  (rsi_strength × 0.25) +
  (divergence × 0.25) +
  (hidden_div × 0.15) +
  (momentum_exhaustion × 0.20) +
  (volume_exhaustion × 0.15) +
  (excessive_move × 0.15) +
  (bb_position × 0.10) +
  (support_proximity × 0.10)

quality *= (1 + pattern_recognition_skill / 20)  // Skill enhancement
quality *= regime_multiplier:
  - RANGING: 1.3x (reversals excel in sideways)
  - VOLATILE: 1.2x (reversals happen at extremes)
  - TRENDING_UP: 0.7x (harder to reverse up trends)
  - TRENDING_DOWN: 0.8x (harder to reverse down trends)

Threshold: quality >= 0.55 (5+ confluent factors required)
```

**Ability Unlocks:**
- Level 5: Detect false reversals early (filter out failed patterns)
- Level 12: Multi-factor ensemble weighting (optimize factor contributions)
- Level 20: Hidden divergence detection across timeframes

**File:** `server/services/rpg-agents/ReversalMaster.ts` (450+ lines, 7-factor ensemble)

---

### 1.5 MLOracle

**Role:** Machine Learning Predictions Specialist  
**Personality:** Conservative  
**Best For:** Complex, non-linear relationships

**Signal Logic:**
```
IF ml_ensemble_probability > 65% AND pattern_similarity > 85% THEN BUY/SELL
```

**Key Features:**
- LSTM predictions
- Transformer attention models
- Ensemble voting (multiple models)
- Pattern similarity scoring
- Ensemble agreement detection

**Abilities:**
- Level 7: Velocity-based targets (uses ML predicted price)
- Level 10: Regime adaptation (ML excels in volatile regimes)

**File:** `server/services/rpg-agents/MLOracle.ts`

---

### 1.6 FlowPhysicsAgent (NEW)

**Role:** Order Flow & Market Microstructure  
**Personality:** Balanced  
**Best For:** Detecting order imbalances

**Signal Logic:**
```
IF bid_volume >> ask_volume AND momentum confirms THEN BUY
```

**Capabilities:**
- Order flow imbalance detection
- Bid-ask spread analysis
- Market depth interpretation
- Microstructure-based timing

**File:** `server/services/rpg-agents/FlowPhysicsAgent.ts`

---

### 1.7 VFMDPhysicsAgent (NEW)

**Role:** Velocity-Flow-Momentum-Direction Analysis  
**Personality:** Aggressive  
**Best For:** Momentum extremes

**Signal Logic:**
```
Combines velocity profiling + flow analysis + momentum + direction
```

**Advanced Features:**
- Asset velocity profiling (7-day move estimation)
- Flow field physics (order flow dynamics)
- Momentum extremes detection
- Direction confidence scoring

**File:** `server/services/rpg-agents/VFMDPhysicsAgent.ts`

---

### 1.8 MarketSage (EVOLUTION)

**Role:** Meta-Agent (Level 20+ evolution)  
**Personality:** Varies  
**Special Ability:** Portfolio optimization

**What is MarketSage?**
A special agent that emerges when:
- Any agent reaches Level 20+
- Conditions: 20+ trades, 55%+ win rate, Sharpe > 1.0

**Capabilities:**
- Portfolio-level decision making
- Cross-agent coordination
- Risk/reward optimization across portfolio
- Market regime meta-analysis

**File:** `server/services/rpg-agents/MarketSage.ts`

---

### 1.9 Specialized Exit Agents

**ExitOrchestrator:** Manages all exits across the portfolio
**OppositionReader:** Detects when market structure turns against position
**MicrostructureExitOptimizer:** Exits using order flow dynamics

**File:** `server/services/rpg-agents/SpecializedExitAgents.ts`

---

## 2. Market Oracle: The Intelligence Hub

### 2.1 Architecture

MarketOracle is the **central nervous system**:
- Aggregates multi-source market data
- Computes technical indicators
- Detects market regime
- Broadcasts data to agents via channels

**File:** `server/services/rpg-agents/MarketOracle.ts` (221 lines)

### 2.2 Data Channels (Information Distribution)

MarketOracle maintains 5+ information channels:

```
CHANNEL SUBSCRIPTION SYSTEM:

┌─────────────────────────────────┐
│     Market Oracle               │
│  (Central Data Hub)             │
└──────────────┬──────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┐
    ↓          ↓          ↓          ↓          ↓
[BREAKOUT]  [TREND]   [REVERSAL] [SUPPORT] [ML]
   │          │          │          │         │
   ↓          ↓          ↓          ↓         ↓
 Volume    MA Cross   RSI Extreme  Bounce  Ensemble
 Spike     Direction  MACD Cross   Quality Probability
 Momentum  ADX Level  Divergence   VolumeConf  Agreement
   │          │          │          │         │
   ↓          ↓          ↓          ↓         ↓
[BreakoutHunter] [TrendRider] [ReversalMaster] [SupportSniper] [MLOracle]
```

### 2.3 Market Snapshot Structure

```typescript
interface MarketSnapshot {
  // Identity
  symbol: "BTC/USDT"
  timestamp: number
  
  // Price data
  price: 45230
  open: 45100
  high: 45500
  low: 44900
  volume: 1250000
  
  // Technical indicators
  rsi: 65
  macd: { macd: 0.045, signal: 0.038, histogram: 0.007 }
  ema20: 45150
  ema50: 45000
  ema200: 44800
  adx: 35  // Trend strength (0-100, <20=ranging, 20-40=trending, >40=strong trend)
  atr: 320  // Volatility
  
  // Support/Resistance
  support: 44500
  resistance: 45700
  
  // Volume analysis
  avg_volume: 950000
  volume_ratio: 1.31  // Current / Average
  
  // Regime detection (ENHANCED with direction)
  regime: "TRENDING"  // or RANGING, VOLATILE, BULL, BEAR
  trendDirection: "UP"  // or DOWN, SIDEWAYS (NEW - always explicit direction)
  emaSlope: 0.0245  // Slope of EMA alignment (positive = up, negative = down) (NEW)
  adxLevel: 35  // Professional ADX calculation, 0-100 (NEW)
  regimeDescription: "Strong UPTREND (Direction: ↑ UP, ADX: 35)" // (NEW)
  
  // ML predictions (optional)
  ml_prediction?: {
    direction: "UP"
    probability: 0.87
    ensemble_confidence: 0.91
    pattern_similarity: 0.89
    predicted_price: 45800
  }
  
  // Asset velocity (for realistic targets)
  expected_7d_move?: 1250  // Expected 7-day movement
  
  // Historical data
  price_history: [45000, 45100, 45200, ...]
  rsi_history: [62, 64, 65, ...]
  
  // Bounce quality (for support trades)
  bounce_quality?: 0.85
  
  // Volume zones (from SupportSniper VBSR analysis)
  volume_zones?: {
    support_zones: [
      { price: 44500, strength: 0.85, timeframes: ['1h', '4h'] }
    ],
    resistance_zones: [
      { price: 45700, strength: 0.72, timeframes: ['1h'] }
    ]
  }
}
```

**New Regime Fields (MarketOracle Enhancement):**
- **trendDirection:** Always returns 'UP' | 'DOWN' | 'SIDEWAYS' (never undefined)
- **emaSlope:** Numerical slope of EMA alignment (positive=uptrend, negative=downtrend)
- **adxLevel:** Professional ADX calculation (0-100 scale)
- **regimeDescription:** Human-readable summary with direction symbols

**Direction Detection Algorithm:**
```
1. Calculate EMA alignments on 1H/4H/1D timeframes
2. Compute momentum from 20-bar price change
3. If all EMAs UP AND momentum > 0.05: trendDirection = UP
4. Else if all EMAs DOWN AND momentum < -0.05: trendDirection = DOWN
5. Else: trendDirection = SIDEWAYS (unclear or mixed signals)
```

---

### 2.4 Data Flow Through Channels

1. **Gateway Aggregator** fetches raw data from exchanges
2. **Market Oracle** receives raw data, processes it:
   - Normalizes across exchanges
   - Computes all indicators
   - Detects regime
   - Updates snapshots
3. **Publishes** to channels:
   - `updateBreakoutChannel(snapshot)`
   - `updateTrendChannel(snapshot)`
   - `updateReversalChannel(snapshot)`
   - `updateSupportChannel(snapshot)`
   - `updateMLChannel(snapshot)`
4. **Agents subscribe** and process data:
   ```typescript
   oracle.onBreakoutChannel(snapshot => {
     const signal = this.processSignal(snapshot);
     if (signal) this.generateTrade(signal);
   });
   ```

### 2.5 Regime Detection (Now with Direction!)

**ENHANCED:** System now **always detects trend DIRECTION** (UP, DOWN, or SIDEWAYS)

System detects 6 market regimes with directional clarity:

```
BULL_TRENDING   - Strong UPTREND (↑)
                → ADX > 25, Price > EMAs, EMA20 > EMA50 > EMA200
                → Agents: TrendRider, BreakoutHunter (aggressive)
                → Position size: Aggressive
                → Strategy: Trail stops, buy dips, follow trend
           
BEAR_TRENDING   - Strong DOWNTREND (↓)
                → ADX > 25, Price < EMAs, EMA20 < EMA50 < EMA200
                → Agents: MLOracle (stay out or short)
                → Position size: Minimal/Conservative
                → Strategy: Wait for reversal, tight stops
           
RANGING         - Sideways consolidation (→)
                → ADX < 20, Low volatility
                → Agents: SupportSniper, ReversalMaster
                → Position size: Conservative
                → Strategy: Buy support, sell resistance
           
HIGH_VOLATILITY - Whipsaw environment (⚡)
                → Volatility > 5%, unclear direction
                → Agents: MLOracle (excels here)
                → Position size: Reduced
                → Strategy: Quick scalps, tight stops

ACCUMULATION    - Low activity with UP bias (⛏️)
                → Volume rising, trend hidden
                → Agents: Watch for breakout
                
DISTRIBUTION    - Low activity with DOWN bias (📉)
                → Volume falling after moves
                → Agents: Take profits on longs
```

**New Detection Method:**

Each regime detection now returns:
```typescript
interface RegimeMetrics {
  regime: MarketRegime;
  trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';  // NEW!
  adxLevel: number;                             // Trend strength 0-100
  description: string;                          // e.g., "Strong UPTREND (↑ UP, ADX: 45)"
  confidence: number;                           // 0-1
}
```

**Example Output:**
```json
{
  "regime": "bull_trending",
  "trendDirection": "UP",
  "adxLevel": 45,
  "description": "Strong UPTREND (Direction: ↑ UP, ADX: 45)",
  "confidence": 0.85,
  "tradingImplications": [
    "📈 Favor long positions",
    "✅ Use tight stops",
    "📊 Trail stops as trend continues",
    "🎯 Look for pullback entries (buy dips)"
  ]
}
```

---

## 3. XP & Leveling System

### 3.1 XP Calculation

XP awarded after each trade:

```typescript
function calculateXP(trade_result: TradeResult): number {
  const base_xp = 100;
  
  // Profit multiplier: +20% XP per 1% profit
  const profit_multiplier = 1 + (trade_result.profit_pct / 5);
  
  // Difficulty multiplier: Market conditions (1-3x)
  // VOLATILE = 1.5x, TRENDING = 1.2x, RANGING = 1.0x
  const difficulty_multiplier = trade_result.market_difficulty;
  
  // Execution quality: How well was the trade executed (0-50 XP)
  const execution_bonus = trade_result.execution_quality * 50;
  
  // Winning streak bonus: 10 XP per win in streak
  const streak_bonus = Math.min(this.winning_streak * 10, 100);
  
  const total_xp = 
    base_xp * profit_multiplier * difficulty_multiplier + 
    execution_bonus + 
    streak_bonus;
  
  return Math.floor(total_xp);
}
```

### 3.2 Level Progression

```
Level 1 → 2:   1,000 XP needed
Level 2 → 3:   1,500 XP
Level 3 → 4:   2,250 XP
...
(Each level costs 1.5x previous)
...
Level 24 → 25: 59,604 XP  ← MILESTONE
Level 25 → 26: 89,406 XP
```

### 3.3 Level-Up Mechanics

When an agent levels up:
1. **XP Reset:** Current XP rolls over, XP_to_next_level recalculated
2. **Skill Point:** Agent receives +1 skill point (can upgrade any skill)
3. **Ability Unlock:** Check if new abilities unlock (see table below)
4. **Achievement:** Award "Level X Master" achievement
5. **At Level 25:** Unlock sub-agent spawning ability

---

## 4. Skill Tree System

### 4.1 Five Core Skills

Each agent has 5 skills, each ranging **1-10 levels**:

| Skill | Effect | Progression |
|-------|--------|-------------|
| **Pattern Recognition** | Improves signal quality by +10% per level | L1→L10: 10%→100% |
| **Timing Precision** | Better entry/exit points, tighter stops | L1→L10: 0%→30% improvement |
| **Risk Management** | Reduces stop loss distance, tighter position sizing | L1→L10: 2% base → 0.4% base |
| **Exit Optimization** | Better profit-taking, trailing stops | L1→L10: Basic → Advanced |
| **Regime Awareness** | Market regime adaptation bonus | L1→L10: 0% → 30% confidence boost |

### 4.2 Skill Upgrade Mechanism

```typescript
upgradeSkill(skill: keyof AgentSkills): boolean {
  // Requirements
  if (this.skill_points <= 0) return false;      // Need skill point
  if (this.skills[skill] >= 10) return false;    // Already maxed
  
  // Upgrade
  this.skills[skill] += 1;
  this.skill_points -= 1;
  
  // Effect
  this.recalculateSignalQuality();  // Signal strength increases
  this.recalculateStopPlacement();  // Stops get tighter
  
  return true;
}
```

### 4.3 Skill Impact Examples

**Pattern Recognition 1 vs 10:**
```
Signal Quality: 0.70 * (1/10)  = 0.70 confidence (Level 1)
Signal Quality: 0.70 * (10/10) = 0.70 confidence (Level 10)
Plus skill bonus multiplier...
```

Actual effect:
- L1: Base signal quality * 0.1 multiplier = 10% pattern detection
- L10: Base signal quality * 1.0 multiplier = 100% pattern detection

**Risk Management Impact:**
```
Level 1:  Stop loss = price * 2%    (0.02 distance)
Level 5:  Stop loss = price * 1.3%  (1.3 distance)
Level 10: Stop loss = price * 0.4%  (tightest)
```

---

## 5. Ability Unlock Timeline

Abilities unlock at **specific levels** and provide new capabilities:

```
LEVEL 3
└─ 🔓 Dynamic Position Sizing
   Ability to scale position size based on confidence
   Before: Fixed 1% per trade
   After: 0.5% to 2% based on signal quality

LEVEL 5
└─ 🔓 Intelligent Exits
   Smart profit-taking and stop placement
   Before: Fixed 2% target, 2% stop
   After: Dynamic based on ATR, volatility, regime

LEVEL 7
└─ 🔓 Multi-Timeframe Confirmation
   Requires alignment across multiple timeframes
   Before: Single timeframe analysis
   After: Checks 5m, 1h, 1d for alignment

LEVEL 10
└─ 🔓 Regime Adaptation
   Adjusts confidence based on market regime
   Before: Same confidence in all regimes
   After: Bullish in TRENDING, cautious in VOLATILE

LEVEL 12
└─ 🔓 Velocity-Based Targets
   Uses asset velocity profiling for realistic targets
   Before: Fixed 2% target
   After: Uses expected 7-day move for smart targets

LEVEL 15
└─ 🔓 Correlation Hedging
   Detects and hedges against correlated assets
   Before: No hedging
   After: Identifies correlation risks

LEVEL 18
└─ 🔓 Pattern Discovery
   Identifies new, emerging patterns
   Before: Fixed patterns only
   After: Discovers patterns not in original codebook

LEVEL 20
└─ 🔓 Portfolio Optimization
   Can optimize across multiple positions
   Before: Single position focus
   After: Portfolio-level thinking

LEVEL 25
└─ 🔓 Strategy Creation
   Can spawn sub-agents with specializations
   Before: Can't create agents
   After: Can spawn specialized child agents
```

---

## 6. Agent Moods

### 6.1 Mood Types

Moods affect confidence scaling:

```typescript
type AgentMood = 'focused' | 'cautious' | 'aggressive' | 'tilted';

interface MoodModifiers {
  'focused':     { confidence_multiplier: 1.0,  position_size: 1.0 }
  'cautious':    { confidence_multiplier: 0.8,  position_size: 0.7 }
  'aggressive':  { confidence_multiplier: 1.2,  position_size: 1.3 }
  'tilted':      { confidence_multiplier: 0.5,  position_size: 0.3 }
}
```

### 6.2 Mood Transitions

```
FOCUSED (default)
├─ After 3+ wins → AGGRESSIVE
├─ After 2+ losses → CAUTIOUS
└─ After 4+ losses → TILTED

CAUTIOUS
├─ After 2+ wins → FOCUSED
└─ After 4+ losses → TILTED

AGGRESSIVE
├─ After 2+ losses → FOCUSED
└─ After 4+ losses → TILTED

TILTED
├─ After 3+ wins → CAUTIOUS
└─ Cools down over 1 hour
```

### 6.3 Mood Display

UI shows mood emoji:
- 🎯 Focused
- ⚠️ Cautious
- 🔥 Aggressive
- 😤 Tilted

---

## 7. Agent Ranks

Ranks are displayed on agent cards, calculated from overall performance:

```
BRONZE        (Level 1-5)    ← Starting rank
SILVER        (Level 6-12)   ← Apprentice rank
GOLD          (Level 13-18)  ← Experienced
PLATINUM      (Level 19-22)  ← Expert
DIAMOND       (Level 23-24)  ← Master
MASTER        (Level 25+)    ← Legend
```

Rank is also influenced by:
- Win rate (must be >55% for advanced ranks)
- Profit factor (must be >1.5)
- Sharpe ratio (must be >1.0)

If performance drops, rank can be demoted.

---

## 8. Achievement System

### 8.1 Achievement Categories

**Milestone Achievements:**
- Level 5 Master, Level 10 Master, ... Level 25 Master
- First Win, 10 Wins, 50 Wins, 100 Wins
- 1,000 XP, 10,000 XP, 100,000 XP

**Performance Achievements:**
- "Hot Streak" - 5+ wins in a row
- "Perfect Day" - All trades profitable
- "Profit Factor Titan" - Profit factor > 3.0
- "Sharpe Specialist" - Sharpe > 2.0

**Skill Achievements:**
- "Pattern Master" - Pattern Recognition at level 10
- "Timing Virtuoso" - Timing Precision at level 10
- "Risk Guardian" - Risk Management at level 10

**Ability Achievements:**
- "Portfolio King" - Unlock portfolio optimization
- "Strategy Creator" - Unlock strategy creation
- "Sage Ascension" - Become MarketSage

**File:** `server/services/rpg-agents/AchievementSystem.ts`

---

## 9. Next Section

**→ Part 3: Trading Logic, Execution & Learning** covers:
- How signals are generated
- Entry/exit rules per agent type
- Position sizing (Kelly Criterion)
- Risk management rules
- Portfolio allocation
- Online learning system
- Backtesting capabilities

