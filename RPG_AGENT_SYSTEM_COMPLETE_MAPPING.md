# 🎮 RPG AGENTS SYSTEM - COMPLETE SIGNAL MAPPING
## Autonomous Trading Agent Ecosystem with Gamification, Progression & Consensus

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [RPG Agent Types](#rpg-agent-types)
3. [Agent Signal Generation](#agent-signal-generation)
4. [RPG Game Mechanics](#rpg-game-mechanics)
5. [Agent Lifecycle & Progression](#agent-lifecycle--progression)
6. [Consensus & Voting System](#consensus--voting-system)
7. [Agent Synergies & Combos](#agent-synergies--combos)
8. [Integration with Unified Signal System](#integration-with-unified-signal-system)
9. [Data Structures](#data-structures)
10. [Complete Signal Flows](#complete-signal-flows)

---

## EXECUTIVE SUMMARY

The **RPG Agents System** is a complete autonomous trading ecosystem where agents:
- **Generate their own signals** independently (not just filter/gate)
- **Evolve through gameplay** (levels 1-50+, skill trees, achievements)
- **Vote on decisions** (consensus weighting by performance)
- **Form synergies** (combos activate when agents agree)
- **Manage themselves** (spawn sub-agents, learn, retire underperformers)
- **Manage portfolio** (dynamic capital allocation via Kelly Criterion)

**18+ Total Agents:**
- **5 Core RPG Agents** (Breakout, Trend, Support, Reversal, ML Oracle)
- **4 Specialist Physics Agents** (VFMD, Flow, Tick-Based)
- **5+ Python-Derived Strategy Agents** (Generated from Python strategies)
- **4+ Exit/Optimization Agents**

---

## RPG AGENT TYPES

### 1. CORE RPG AGENTS (5 Types)

#### A. BreakoutHunter
```typescript
Location: server/services/rpg-agents/BreakoutHunter.ts

Specialization: Entry pattern detection (breakouts, structure breaks)

Signal Generation:
├─ Pattern Detection
│  ├─ Breakout above resistance
│  ├─ Structure break (HH/HL or LL/LH)
│  └─ Consolidation break
│
├─ Metrics Analyzed
│  ├─ Volume surge (>120% avg)
│  ├─ Price action (break with authority)
│  ├─ Momentum (oscillators confirming)
│  └─ Timeframe alignment (multiple TF)
│
└─ Signal Output
   ├─ Action: BUY/SELL
   ├─ Confidence: 0-1
   ├─ Entry Price: Level where pattern triggered
   ├─ Stop Loss: Below consolidation/structure
   └─ Target: Previous swing/resistance

Win Rate: ~58-65% (historically)
Best Market: TRENDING, BREAKOUT regimes
Weakness: Sideways markets (false breakouts)
```

#### B. TrendRider
```typescript
Location: server/services/rpg-agents/TrendRider.ts

Specialization: Trend-following, MA-based entries

Signal Generation:
├─ Trend Detection
│  ├─ EMA alignment (20 > 50 > 200)
│  ├─ Price above SMAs
│  ├─ ADX > 25 (directional)
│  └─ Momentum bars rising
│
├─ Entry Conditions
│  ├─ Pullback to MA + bounce
│  ├─ Initial trend break (if early)
│  ├─ MA retest confirmation
│  └─ Volume support
│
└─ Signal Output
   ├─ Action: BUY/SELL (trend direction)
   ├─ Confidence: 0-1 (ADX-weighted)
   ├─ Entry: Previous swing/MA bounce
   ├─ Stop: Below MA or swing low
   └─ Target: Next resistance/swing high

Win Rate: ~62-68% (very consistent)
Best Market: TRENDING (strong directional bias)
Weakness: Whipsaws at trend changes
```

#### C. SupportSniper
```typescript
Location: server/services/rpg-agents/SupportSniper.ts

Specialization: Support/Resistance bounces, mean reversion

Signal Generation:
├─ Level Identification
│  ├─ Previous swing lows (support)
│  ├─ Pivot points (daily/weekly)
│  ├─ Fibonacci retracements
│  └─ Volume profile POC (point of control)
│
├─ Bounce Detection
│  ├─ Price tests level with rejection
│  ├─ Candle wick rejects (no close below)
│  ├─ Volume spike at level (accumulation)
│  └─ RSI extreme at level
│
└─ Signal Output
   ├─ Action: BUY at support / SELL at resistance
   ├─ Confidence: 0-1 (confluence count)
   ├─ Entry: Level itself (tested but rejected)
   ├─ Stop: 0.5% below level
   └─ Target: Next resistance/swing

Win Rate: ~60-66%
Best Market: SIDEWAYS, RANGING
Weakness: Breakdowns (support breaks hard)
```

#### D. ReversalMaster
```typescript
Location: server/services/rpg-agents/ReversalMaster.ts

Specialization: Reversal patterns, top/bottom formations

Signal Generation:
├─ Pattern Recognition
│  ├─ Double tops/bottoms (2 peaks rejected)
│  ├─ Head & shoulders patterns
│  ├─ Divergences (price vs momentum)
│  ├─ Exhaustion signals (extreme bars)
│  └─ Rejection wicks (high/low rejected)
│
├─ Confirmation
│  ├─ Multiple timeframe alignment
│  ├─ Volume diminishing on failed breakout
│  ├─ Momentum turning (RSI < 50 after rally)
│  └─ Structure break on opposite side
│
└─ Signal Output
   ├─ Action: SELL at top / BUY at bottom
   ├─ Confidence: 0-1 (pattern + confirmation)
   ├─ Entry: After pattern confirmation candle
   ├─ Stop: Above pattern high/low
   └─ Target: 1.5-2x of pattern height

Win Rate: ~55-62% (harder to trade)
Best Market: REVERSAL, VOLATILE swings
Weakness: Early (trend can continue)
```

#### E. MLOracle
```typescript
Location: server/services/rpg-agents/MLOracle.ts

Specialization: Machine learning predictions, ensemble forecasting

Signal Generation:
├─ ML Models Integrated
│  ├─ LSTM neural network (trend prediction)
│  ├─ Random Forest (classification)
│  ├─ XGBoost (probability estimation)
│  ├─ Attention mechanism (feature importance)
│  └─ Ensemble voting (consensus)
│
├─ Feature Set
│  ├─ Technical indicators (50+ features)
│  ├─ Market structure (trend, regime)
│  ├─ Order flow signals (volume profile)
│  ├─ Sentiment (optional integration)
│  └─ Macro factors (if available)
│
└─ Signal Output
   ├─ Action: BUY/SELL/HOLD
   ├─ Confidence: 0-1 (model probability)
   ├─ Probability: Up/Down percentage
   ├─ Entry: Market price
   ├─ Holding Period: Hours (model estimated)
   └─ Target: Predicted move magnitude

Win Rate: ~59-65% (depends on training)
Best Market: All (adaptive)
Weakness: Overfitting, regime change
```

### 2. PHYSICS-BASED AGENTS (Advanced)

#### VFMDPhysicsAgent
```typescript
Location: server/services/rpg-agents/VFMDPhysicsAgent.ts

Specialization: Volume Flux Momentum Dynamics (tick-level physics)

Key Features:
├─ Tick Analysis
│  ├─ Buy/sell pressure (individual ticks)
│  ├─ Order imbalance (signed volume)
│  ├─ Momentum trajectory (velocity + acceleration)
│  └─ Volume distribution (clusters)
│
├─ Physics Equations
│  ├─ Momentum = Volume × Price Change
│  ├─ Acceleration = Change in Momentum
│  ├─ Pressure Differential = Buy Vol - Sell Vol
│  └─ Inertia = Persistence (how long trend continues)
│
└─ Signal: Early accumulation/distribution detection

Win Rate: ~61-67%
Edge: Earliest detection (tick-level)
```

#### FlowPhysicsAgent
```typescript
Location: server/services/rpg-agents/FlowPhysicsAgent.ts

Specialization: Smart money flow detection, order clustering

Key Features:
├─ Flow Analysis
│  ├─ Large order detection (whale trades)
│  ├─ Flow direction (accumulation vs distribution)
│  ├─ Flow persistence (continuity)
│  └─ Flow-price divergence (reversal signal)
│
├─ Signal Generation
│  ├─ Bullish flow clusters → BUY
│  ├─ Bearish flow clusters → SELL
│  ├─ Flow-price mismatch → Reversal coming
│  └─ Flow exhaustion → Continuation ending

Win Rate: ~62-68%
Edge: Institutional activity detection
```

### 3. PYTHON-DERIVED STRATEGY AGENTS (5+)

Created dynamically from Python strategies via `StrategyBridge`:

```typescript
Location: server/services/rpg-agents/StrategyBridge.ts

Conversion Process:
├─ Python Strategy → Signal
├─ Signal → RPG Agent wrapper
├─ Agent registered in Arena
└─ Now participates in consensus voting

Example Agents Created:
├─ PythonStrategyAgent("MarketStructureEngine")
├─ PythonStrategyAgent("MeanReversion")
├─ PythonStrategyAgent("Breakout")
├─ PythonStrategyAgent("PatternRecognition")
└─ PythonStrategyAgent("ML")

Each:
├─ Inherits RPG progression system
├─ Tracks individual win rate
├─ Levels up independently
├─ Can spawn sub-agents (L25+)
└─ Votes in consensus
```

### 4. EXIT & OPTIMIZATION AGENTS

```
├─ ExitAgent: Intelligent exit timing
├─ TargetCalculator: Dynamic TP placement
├─ StopLossOptimizer: Adaptive SL
└─ PositionSizer: Risk-adjusted sizing
```

---

## AGENT SIGNAL GENERATION

### Signal Generation Pipeline (Per Agent)

```
┌─────────────────────────────────────────────────────────┐
│           INDIVIDUAL AGENT SIGNAL PIPELINE               │
└─────────────────────────────────────────────────────────┘

STEP 1: Market Data Input
├─ Tick data (if applicable)
├─ OHLCV data (candle-based)
└─ Indicators pre-calculated

STEP 2: Agent Processes
├─ Apply agent-specific logic
├─ Calculate confidence
└─ Determine entry conditions

STEP 3: Signal Generation
├─ Action: BUY / SELL / HOLD
├─ Confidence: 0-1 probability
├─ Entry: Price or level
├─ Stop Loss: Risk point
├─ Take Profit: Target price(s)
├─ Reasoning: String explanation
└─ Timestamp: When signal generated

STEP 4: Quality Feedback (Learning Loop)
├─ Track actual trade outcome
├─ Update win rate (agent accuracy)
├─ Adjust confidence thresholds
├─ Learn pattern effectiveness
└─ Feed into agent evolution

STEP 5: Arena Registration
├─ Signal added to voting pool
├─ Agent weight updated (by win rate)
├─ Combo checks run
└─ Consensus recalculated
```

### Example: BreakoutHunter Signal

```typescript
async generateSignal(marketData: MarketFrame): AgentSignal {
  // Step 1: Detect breakout pattern
  const breakoutDetected = this.detectBreakout(
    marketData.price,
    this.resistance,
    marketData.volume
  );

  if (!breakoutDetected) {
    return null; // No signal this candle
  }

  // Step 2: Confirm with volume
  const volumeConfirmed = marketData.volume > this.avgVolume * 1.2;
  
  // Step 3: Check momentum
  const momentumStrength = this.calculateMomentum(
    marketData.rsi,
    marketData.macd
  );

  // Step 4: Calculate confidence
  const baseConfidence = 0.6;
  const volumeBonus = volumeConfirmed ? 0.15 : 0;
  const momentumBonus = momentumStrength > 0.7 ? 0.15 : 0.05;
  const confidence = Math.min(
    baseConfidence + volumeBonus + momentumBonus,
    0.95 // Cap at 95%
  );

  // Step 5: Generate signal
  return {
    agent_name: this.name,
    action: 'BUY',
    confidence: confidence,
    entry_price: marketData.price,
    stop_loss: this.calculateStop(marketData),
    target_price: this.calculateTarget(marketData),
    reasoning: [
      `Breakout above ${this.resistance} with authority`,
      `Volume spike: ${(marketData.volume / this.avgVolume).toFixed(1)}x avg`,
      `Momentum: ${momentumStrength.toFixed(2)}`
    ],
    timestamp: Date.now(),
    
    // RPG specific
    expertise_level: this.level,
    experience_bonus: 1 + (this.level - 1) * 0.05 // +5% per level
  };
}
```

---

## RPG GAME MECHANICS

### 1. AGENT PROGRESSION SYSTEM

#### Leveling (1-50+)

```typescript
Level Progression:
├─ Level 1: Rookie trader
├─ Level 5: Unlock intelligent exits
├─ Level 10: Unlock regime adaptation
├─ Level 15: Unlock correlation hedging
├─ Level 20: Unlock portfolio optimization
├─ Level 25: ⭐ Unlock strategy creation (can spawn sub-agents!)
├─ Level 30: Unlock advanced risk management
├─ Level 40: Unlock team leadership
└─ Level 50+: Legendary status, maximum abilities

XP Calculation:
├─ Win trade: +100 XP
├─ Loss trade: +20 XP (learning penalty)
├─ High confidence win: +150 XP
├─ Low confidence win: +50 XP
├─ Streak bonus: 10 consecutive wins = +500 XP
└─ Level up: +10,000 XP required per level

Stat Gains Per Level:
├─ Confidence: +0.02 (capped at 0.95)
├─ Accuracy: +0.5% win rate potential
├─ Speed: -5% execution time
└─ Skill Points: +1 per level (to upgrade skills)
```

#### Skill Trees

```typescript
Agent Skills (Upgradeable with Skill Points):

CORE SKILLS:
├─ Pattern Recognition (1-10)
│  └─ Improved accuracy on pattern detection
├─ Risk Management (1-10)
│  └─ Better stop loss placement
├─ Market Reading (1-10)
│  └─ Faster regime detection
└─ Entry Timing (1-10)
    └─ Lower false signal rate

ADVANCED SKILLS (Unlock at Level 10+):
├─ Regime Adaptation (1-5)
│  └─ Better weighting in different markets
├─ Divergence Detection (1-5)
│  └─ Spot reversals earlier
├─ Volume Profiling (1-5)
│  └─ Order flow signal improvement
└─ Machine Learning (1-5)
    └─ Prediction model accuracy (for ML agents)

MASTERY SKILLS (Unlock at Level 20+):
├─ Portfolio Hedging (1-3)
├─ Capital Allocation (1-3)
├─ Strategy Innovation (1-3)
└─ Team Leadership (1-3)

Cost to Upgrade: 1 Skill Point per upgrade
```

#### Ranks (Status Levels)

```typescript
Based on Performance Metrics:

RANK_TIERS = {
  'Bronze': { minWinRate: 0, maxWinRate: 0.49 },
  'Silver': { minWinRate: 0.50, maxWinRate: 0.59 },
  'Gold': { minWinRate: 0.60, maxWinRate: 0.69 },
  'Platinum': { minWinRate: 0.70, maxWinRate: 0.79 },
  'Diamond': { minWinRate: 0.80, maxWinRate: 0.89 },
  'Grandmaster': { minWinRate: 0.90, maxWinRate: 1.00 }
}

Rank Bonuses:
├─ Execution speed (Diamond: -20% latency)
├─ Position size (Grandmaster: +30% base allocation)
├─ Confidence boost (Platinum+: +0.1 confidence floor)
└─ Combo activation easier (Gold+: lower threshold)
```

### 2. AGENT MOODS & PERSONALITY

#### Mood System

```typescript
Mood States:
├─ CONFIDENT: After win streak (3+ wins)
│  └─ Effect: +0.15 confidence, slightly more aggressive
├─ CAUTIOUS: After 2 losses in row
│  └─ Effect: -0.1 confidence, more conservative
├─ NEUTRAL: Default state
│  └─ Effect: No bonus/penalty
├─ TILTED: After 3+ losses
│  └─ Effect: Skip signals (safety mechanism)
└─ AGGRESSIVE: After high-confidence wins (80%+ confidence)
    └─ Effect: +0.2 confidence (with approval check)

Mood Decay:
├─ Each hour: mood drifts 10% toward neutral
├─ Each trade opposite outcome: mood shifts toward cautious
└─ Achievements reached: mood boost
```

#### Personality Types

```typescript
Agent personalities affect decision-making:

AGGRESSIVE (Risk tolerance: 0.66+)
├─ Takes larger position sizes
├─ Higher confidence threshold for entry
├─ Longer holding periods
└─ More likely to pyramid

BALANCED (Risk tolerance: 0.33-0.66)
├─ Standard position sizing
├─ Moderate confidence for entry
├─ Optimal risk/reward seeking
└─ Calculated scaling

CONSERVATIVE (Risk tolerance: 0.33)
├─ Smaller position sizes
├─ Higher confidence required
├─ Quick exits on uncertainty
└─ Capital preservation focus
```

### 3. ACHIEVEMENT SYSTEM

#### Achievement Types (20+)

```typescript
BRONZE TIER:
├─ First Win: Win your first trade
├─ 10 Wins: Accumulate 10 winning trades
├─ Streak of 5: 5 consecutive wins
├─ Breakeven Master: 50 trades with >= 50% win rate
└─ Consistency: 100 trades with <= 5% variance

SILVER TIER:
├─ 50 Wins: 50 winning trades total
├─ High Roller: Single trade profit > 1% portfolio
├─ Survivor: Recover from 50% drawdown
├─ Double Profit: 2x starting capital
└─ Specialist: 70% win rate in specialization

GOLD TIER:
├─ 100 Wins: Century milestone
├─ Perfect Month: 100% win rate for 20 trades
├─ Diversified: Win in 5+ different patterns
├─ Expert: 80% win rate with 100+ trades
└─ Master Technician: All skills at level 8+

PLATINUM TIER:
├─ Profit King: 10x starting capital
├─ Legend in Making: 90% win rate
├─ Teaching Master: Teach 5 sub-agents to level 10
└─ Champion: Win major portfolio achievement

DIAMOND TIER:
├─ Immortal: Reach Level 50
├─ Living Legend: 80%+ win rate with 100+ trades
└─ Hall of Fame: All achievements unlocked

Rewards per achievement:
├─ XP: 100-15000 depending on tier
├─ Skill Points: 1-15 depending on tier
├─ Title: "Specialist", "Legend", etc.
├─ Multiplier: +5-50% on future XP gains
└─ Special Badge: Displayed on profile
```

---

## AGENT LIFECYCLE & PROGRESSION

### States

```typescript
export type AgentStatus = 'ACTIVE' | 'PROBATION' | 'HIBERNATING' | 'RETIRED';
export type LifecycleStage = 'ROOKIE' | 'JOURNEYMAN' | 'EXPERT' | 'MASTER' | 'LEGEND';

Timeline:
├─ ACTIVE: Normal operation
│  └─ Generating signals, trading, leveling up
│
├─ PROBATION: 30-day observation (triggered by performance drop)
│  └─ Criteria: Win rate < 45%, profit factor < 1.0, 8+ losses in row
│  └─ During: Can trade but limited size, requires approval
│  └─ After: Review performance, rejuvenate or retire
│
├─ HIBERNATING: Temporary deactivation for learning
│  └─ Triggered: Regime change detection, learning system request
│  └─ Duration: 1-7 days
│  └─ During: Not trading, retraining models
│  └─ After: Wake up if recovered
│
└─ RETIRED: Permanent removal
    └─ Triggered: Unrecoverable underperformance (3+ failed probations)
    └─ Effect: Removed from voting pool
    └─ Legacy: Stats preserved, achievements kept
```

### Probation System

```typescript
Performance Review Criteria:
├─ Win Rate: Must maintain >= 45%
├─ Profit Factor: Must maintain >= 1.0 (profit/loss)
├─ Sharpe Ratio: Must maintain >= 0.5
├─ Drawdown: Maximum drawdown <= 15%
├─ Losing Streak: Max 8 consecutive losses triggers review

Probation Actions:
├─ Retraining: Agent model gets retrained
├─ Skill Adjustment: Reduce certain skill levels
├─ Size Reduction: Limit position sizes to 0.5x
├─ Approval Required: All trades need commander sign-off
└─ Knowledge Sharing: Get mentored by top agent

Exit Probation:
├─ Option 1: Recovery → Performance restored → Back to ACTIVE
├─ Option 2: Learning → Skills upgraded → Unbanned
├─ Option 3: Deterioration → 30 days no improvement → RETIRED
```

### Sub-Agent Spawning (Level 25+)

```typescript
Unlock at: Level 25

Capability:
├─ Level 25+ agents can create specialized sub-agents
├─ Clone parent with modified specialization
└─ Cost: 5000 XP from parent (no level loss)

Parent Requirements:
├─ Win rate >= 60%
├─ Profit factor >= 1.5
├─ Level >= 25
├─ Status = ACTIVE (not probation)
└─ 2+ sub-agents already managed

Sub-Agent Properties:
├─ Starts at Level 5 (head start)
├─ Inherits 50% of parent's win rate
├─ Can specialize in different pattern
├─ Reports to parent (portfolio hierarchy)
└─ If sub-agent wins, parent gets 20% of credit

Example:
BreakoutHunter (Level 30) spawns:
├─ BreakoutHunter_Sub_1 (Level 5, same spec)
├─ Or: ReversalFocused_Sub (Level 5, modified)
└─ Reports back: Success compounds parent evolution
```

---

## CONSENSUS & VOTING SYSTEM

### Voting Mechanism

```typescript
┌─────────────────────────────────────────────────────┐
│     MULTI-AGENT CONSENSUS VOTING SYSTEM              │
└─────────────────────────────────────────────────────┘

STEP 1: Signal Collection
├─ BreakoutHunter (L22, 62% WR): BUY, confidence 0.78
├─ TrendRider (L18, 65% WR): BUY, confidence 0.72
├─ SupportSniper (L15, 58% WR): HOLD
├─ MLOracle (L20, 61% WR): BUY, confidence 0.68
└─ FlowPhysics (L12, 60% WR): SELL, confidence 0.55

STEP 2: Calculate Agent Weights
├─ Weight = (Win Rate × 0.5) + (Level / 50 × 0.3) + (Rank bonus × 0.2)
│
├─ BreakoutHunter: (0.62 × 0.5) + (22/50 × 0.3) + 0.02 = 0.397
├─ TrendRider: (0.65 × 0.5) + (18/50 × 0.3) + 0.02 = 0.393
├─ SupportSniper: (0.58 × 0.5) + (15/50 × 0.3) + 0.01 = 0.316
├─ MLOracle: (0.61 × 0.5) + (20/50 × 0.3) + 0.01 = 0.386
└─ FlowPhysics: (0.60 × 0.5) + (12/50 × 0.3) + 0 = 0.372

STEP 3: Normalize Weights
├─ Total weight: 0.397 + 0.393 + 0.316 + 0.386 + 0.372 = 1.864
├─ BreakoutHunter: 0.397 / 1.864 = 0.213 (21.3%)
├─ TrendRider: 0.393 / 1.864 = 0.211 (21.1%)
├─ SupportSniper: 0.316 / 1.864 = 0.170 (17.0%)
├─ MLOracle: 0.386 / 1.864 = 0.207 (20.7%)
└─ FlowPhysics: 0.372 / 1.864 = 0.200 (20.0%)

STEP 4: Aggregate Signals (Weighted Voting)
├─ BUY votes: 0.213 + 0.211 + 0.207 = 0.631 (63.1%)
├─ SELL votes: 0.200 (20.0%)
├─ HOLD votes: 0.170 (17.0%)
├─ Consensus Direction: BUY (63.1% agreement)
└─ Consensus Confidence: Weighted avg confidence = 0.723

STEP 5: Check Combo Activation
├─ 3+ agents (BreakoutHunter, TrendRider, MLOracle) agree on BUY
├─ All confidence >= 0.68
├─ Combo Match: "Breakout + Trend Confirmation"
├─ Combo Bonus: +0.15 confidence multiplier
└─ New consensus confidence: 0.723 × 1.15 = 0.831

STEP 6: Final Decision
├─ Action: BUY
├─ Confidence: 0.831
├─ Consensus: "3-agent combo detected: Breakout + Trend alignment"
├─ Position Size Multiplier: 1.3x (combo bonus)
└─ Key Agents: BreakoutHunter (lead), TrendRider (support)
```

### Consensus Rules

```typescript
Signal Weighted Consensus:
├─ All agent signals aggregated
├─ Weights = f(win_rate, level, rank, recent_performance)
├─ Final confidence = weighted average of all confidences
└─ Action = majority vote (weighted)

Minimum Thresholds:
├─ Required Agreement: 50%+ of voting weight
├─ Minimum Consensus Confidence: 0.60
├─ Minimum Active Agents: 2 (require 2+ signals)
├─ Maximum Dissent: Allow up to 30% disagreement

Special Cases:
├─ Unanimous (95%+): No combo needed, high confidence
├─ Strong Majority (75%+): Single strong signal, bonus confidence
├─ Weak Majority (50-75%): Requires combo or high win rate agent
├─ Dissent: Below 50%, signal FILTERED
```

---

## AGENT SYNERGIES & COMBOS

### Combo Detection System

```typescript
Location: server/services/rpg-agents/AgentSynergyDetector.ts

Concept:
When 2+ agents agree on same signal with high confidence,
they form a "combo" that amplifies confidence and position size.

Combo Database:
├─ "Breakout + Trend": BreakoutHunter + TrendRider agree
│  └─ Activation: Both confidence >= 0.70, same direction
│  └─ Bonus: +0.15 confidence, 1.3x position size
│  └─ Historical Win Rate: 68%
│  └─ Times Activated: 47
│
├─ "Support + Reversal": SupportSniper + ReversalMaster
│  └─ Activation: Both detect at support level
│  └─ Bonus: +0.12 confidence, 1.25x position size
│  └─ Historical Win Rate: 65%
│  └─ Times Activated: 23
│
├─ "ML Ensemble": MLOracle + 2+ other agents
│  └─ Activation: ML confidence >= 0.70, 2+ others agree
│  └─ Bonus: +0.10 confidence, 1.2x position size
│  └─ Historical Win Rate: 62%
│  └─ Times Activated: 156
│
├─ "Physics Flow": VFMDPhysics + FlowPhysics
│  └─ Activation: Both detect same directional pressure
│  └─ Bonus: +0.18 confidence, 1.4x position size
│  └─ Historical Win Rate: 71%
│  └─ Times Activated: 12
│
└─ "Market Consensus": 5+ agents agree (rare!)
    └─ Activation: 5+ different agents, >= 0.65 avg confidence
    └─ Bonus: +0.25 confidence, 1.5x position size
    └─ Historical Win Rate: 78%
    └─ Times Activated: 8

Combo Eligibility:
├─ Agent 1 must have win rate >= 55%
├─ Agent 2 must have win rate >= 55%
├─ Both must be ACTIVE (not PROBATION/HIBERNATING)
├─ Both confidence >= threshold for combo
└─ Same direction (BUY/SELL), same timeframe
```

### Synergy Tracking

```typescript
Each Combo Maintained:
├─ Activation Count (how many times occurred)
├─ Historical Win Rate (% of combo signals that won)
├─ Historical Profit Factor (avg profit / avg loss)
├─ Most Recent Activation (timestamp)
├─ Performance by Market Regime
│  ├─ TRENDING: 72% win rate
│  ├─ SIDEWAYS: 58% win rate
│  ├─ VOLATILE: 65% win rate
│  └─ REVERSAL: 70% win rate
└─ Evolutionary Score
    └─ Score = (win_rate × 0.5) + (times_activated / 100 × 0.3) + (pf × 0.2)

Strategic Use:
├─ High-score combos get auto-approved by Commander
├─ Special dashboard showing live combo detections
├─ Alerts sent when rare combos form (e.g., Market Consensus)
└─ Combo-specific risk management (higher stops, lower targets)
```

---

## INTEGRATION WITH UNIFIED SIGNAL SYSTEM

### How RPG Agents Feed Into Main Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│         INTEGRATION: RPG AGENTS → UNIFIED SYSTEM              │
└──────────────────────────────────────────────────────────────┘

LAYER 1: RPG Agent Layer (This system)
├─ All agents generate signals independently
├─ Consensus voting produces AggregatedSignal
├─ Combos detected and recorded
└─ Output: RPG Consensus Signal

        ↓

LAYER 2: Signal Aggregation (Unified Signal Pipeline)
├─ RPG Consensus treated as 4th SOURCE (alongside Scanner, ML, RL)
├─ Weight = 0.25 (equal to other 3 sources)
├─ Combine with Scanner, ML, RL signals
├─ Agreement scoring
└─ Output: Multi-source consensus

        ↓

LAYER 3: Quality Gating
├─ RPG consensus confidence used as input
├─ Combo bonus multiplies confidence
├─ Agent win rates influence quality score
└─ Output: Quality-gated signal

        ↓

LAYER 4: Final Execution
├─ Position size: Base × Quality multiplier × Combo multiplier
├─ Entries/exits informed by agent specializations
├─ Stop losses: Agent-recommended levels
└─ Output: Trade execution

STEP BY STEP:

1. Market data arrives → All agents process independently
2. Each agent generates signal (BreakoutHunter, TrendRider, etc.)
3. AgentArena.generateConsensusSignal() aggregates all signals
4. Returns consensus: action, confidence, participating agents, combo info
5. This consensus is passed to unified SignalPipeline
6. Mixed with Scanner/ML/RL signals
7. Final AggregatedSignal is produced
8. Trade is executed with RPG-informed parameters
```

### Data Flow Diagram

```
Market Data
    ↓
┌─────────────────────────────────────────────┐
│     RPG AGENT ARENA (This Document)         │
│                                              │
│  BreakoutHunter → Signal               │
│  TrendRider → Signal                   │
│  SupportSniper → Signal                │
│  ReversalMaster → Signal               │
│  MLOracle → Signal                     │
│  VFMDPhysicsAgent → Signal             │
│  FlowPhysicsAgent → Signal             │
│  PythonStrategyAgents (5+) → Signals   │
│                       ↓                      │
│  AgentArena.generateConsensusSignal()       │
│  ├─ Weighted voting                         │
│  ├─ Combo detection                         │
│  ├─ Confidence aggregation                  │
│  └─ → Consensus (action, confidence, combos)│
└──────────────────┬──────────────────────────┘
                   ↓
        ┌──────────────────────────┐
        │ UNIFIED SIGNAL PIPELINE   │
        │ (Main COMPLETE_SIGNAL_..  │
        │  document)                │
        │                           │
        │ Sources:                  │
        │ 1. Scanner (35%)          │
        │ 2. ML (35%)               │
        │ 3. RL (30%)               │
        │ 4. RPG Agents (25%) ← NEW │
        │       ↓                   │
        │ Multi-source voting       │
        │ Quality scoring           │
        │ Classification            │
        │ → Final AggregatedSignal  │
        └────────────┬─────────────┘
                     ↓
        ┌──────────────────────────┐
        │  TRADE EXECUTION LAYER    │
        │                           │
        │ Position size × multipliers
        │ Entry/Exit points         │
        │ Risk management           │
        │ → Trade placed            │
        └──────────────────────────┘
```

---

## DATA STRUCTURES

### AgentSignal (Per Agent Output)

```typescript
interface AgentSignal {
  // Identification
  agent_name: string;
  agent_type: 'BreakoutHunter' | 'TrendRider' | 'SupportSniper' | 'ReversalMaster' | 'MLOracle' | 'Physics' | 'Python';
  
  // Signal Content
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;              // 0-1
  reasoning: string[];             // Explanation
  
  // Price Targets
  entry_price: number;
  stop_loss: number;
  target_price: number;            // TP1
  target_price_2?: number;         // TP2
  target_price_3?: number;         // TP3
  
  // RPG System
  expertise_level: number;         // Agent's current level (1-50+)
  experience_bonus: number;        // Level multiplier
  skill_bonuses: {                 // Active skill boosts
    pattern_recognition: number;
    risk_management: number;
    market_reading: number;
    entry_timing: number;
  };
  
  // Metadata
  timestamp: number;
  market_regime: string;
  patterns_detected: string[];
  
  // Session Info
  session_id: string;
  signal_id: string;
}
```

### ConsensusSignal (Arena Output)

```typescript
interface ConsensusSignal {
  // Decision
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;              // 0-1, weighted average
  consensus_percentage: number;    // % of agents agreeing
  
  // Participants
  participating_agents: Array<{
    name: string;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    weight: number;                // Voting weight
  }>;
  
  // Combo Information
  combo_activated?: {
    name: string;                  // e.g., "Breakout + Trend"
    agents_involved: string[];
    bonus_multiplier: number;      // 1.1x - 1.5x
    historical_win_rate: number;
  };
  
  // Weighted Targets (from top agents)
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2?: number;
  target_3?: number;
  
  // Reasoning
  reasoning: string[];
  key_agents: string[];            // Top 3 contributing agents
  
  timestamp: number;
}
```

### AgentStatus

```typescript
interface AgentStatus {
  // Basic Info
  name: string;
  type: string;
  level: number;                   // 1-50+
  rank: string;                    // Bronze, Silver, Gold, etc.
  status: 'ACTIVE' | 'PROBATION' | 'HIBERNATING' | 'RETIRED';
  
  // Experience
  experience: number;
  xp_to_next_level: number;
  skill_points_available: number;
  
  // Performance
  total_trades: number;
  win_rate: number;                // 0-1
  loss_rate: number;               // 0-1
  profit_factor: number;           // Total profit / total loss
  sharpe_ratio: number;
  max_drawdown: number;            // Max loss from peak
  
  // Skills
  skills: {
    pattern_recognition: number;   // 1-10
    risk_management: number;       // 1-10
    market_reading: number;        // 1-10
    entry_timing: number;          // 1-10
    [key: string]: number;
  };
  
  // Psychology
  mood: 'CONFIDENT' | 'CAUTIOUS' | 'NEUTRAL' | 'TILTED' | 'AGGRESSIVE';
  personality: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE';
  
  // Achievements
  achievements_unlocked: string[];
  titles: string[];
  
  // Sub-agents (if Level 25+)
  sub_agents: string[];
  parent_agent?: string;
  
  // Recent Activity
  last_trade_time: number;
  trades_this_session: number;
  winning_streak: number;
  losing_streak: number;
  
  timestamp: number;
}
```

### LeaderboardEntry

```typescript
interface LeaderboardEntry {
  rank: number;                    // 1st, 2nd, 3rd...
  agent_name: string;
  agent_type: string;
  level: number;
  
  // Scoring
  points: number;                  // Overall score
  win_rate: number;
  profit_factor: number;
  sharpe: number;
  total_profit: number;
  
  // Badges
  badges: string[];                // Achievements
  titles: string[];
}
```

---

## COMPLETE SIGNAL FLOWS

### Flow 1: Simple RPG Signal → Consensus

```
SCENARIO: BreakoutHunter detects breakout at 43,500 with volume spike

T+0:00 BreakoutHunter Processes Market Data
├─ Price: 43,500
├─ Previous resistance: 43,200
├─ Volume: 2.5M (vs avg 1.2M = 2.08x)
├─ RSI: 65
└─ Detects: Breakout above resistance with volume

T+0:01 BreakoutHunter.generateSignal()
├─ Base confidence: 0.60
├─ Volume bonus (2.08x > 1.2x): +0.15
├─ Momentum bonus (RSI 65 > 50): +0.08
├─ Final confidence: 0.83
├─ Level bonus (Agent level 22): +5% = 0.87
└─ Generates Signal:
    {
      agent_name: "BREAKOUT_HUNTER",
      action: "BUY",
      confidence: 0.87,
      entry_price: 43500,
      stop_loss: 42800,
      target_price: 44500,
      expertise_level: 22,
      experience_bonus: 1.105,
      reasoning: [
        "Breakout above 43200 resistance",
        "Volume 2.08x average confirming",
        "RSI 65 showing bullish momentum"
      ]
    }

T+0:02 Other Agents Process (In Parallel)
├─ TrendRider:
│  ├─ Sees: EMA 20 > 50 > 200 aligned
│  ├─ ADX: 35 (moderate trend)
│  ├─ Signal: BUY, confidence 0.72
│  └─ Expertise bonus applied (level 18): 0.75
│
├─ SupportSniper:
│  ├─ Sees: Price above support cluster
│  ├─ No immediate reversal signal
│  ├─ Signal: HOLD
│  └─ No vote
│
└─ MLOracle:
   ├─ Model predicts: 65% probability up
   ├─ Signal: BUY, confidence 0.70
   └─ Expertise bonus applied (level 20): 0.72

T+0:03 AgentArena.generateConsensusSignal()

Step 1: Collect Signals
├─ BreakoutHunter: BUY @ 0.87
├─ TrendRider: BUY @ 0.75
├─ SupportSniper: HOLD
└─ MLOracle: BUY @ 0.72

Step 2: Calculate Weights
├─ BreakoutHunter: (0.62 WR × 0.5) + (22/50 × 0.3) + 0.02 = 0.397
├─ TrendRider: (0.65 × 0.5) + (18/50 × 0.3) + 0.01 = 0.386
├─ SupportSniper: Not voting (HOLD)
└─ MLOracle: (0.61 × 0.5) + (20/50 × 0.3) + 0.01 = 0.376
   Total weights for voting agents: 1.159

Step 3: Normalize
├─ BreakoutHunter: 0.397/1.159 = 0.343 (34.3%)
├─ TrendRider: 0.386/1.159 = 0.333 (33.3%)
└─ MLOracle: 0.376/1.159 = 0.324 (32.4%)

Step 4: Aggregate
├─ BUY votes: 0.343 + 0.333 + 0.324 = 1.0 (100%!)
├─ Confidence average: (0.87 + 0.75 + 0.72) / 3 = 0.78
└─ Consensus confidence: 0.78

Step 5: Check Combos
├─ Combo: "Breakout + Trend Confirmation"
├─ Agents: BreakoutHunter + TrendRider match
├─ Criteria: Both confidence >= 0.70 ✅
├─ Bonus: +0.15 confidence
├─ Combo Bonus Multiplier: 1.25x
└─ New confidence: 0.78 × 1.25 = 0.975 → Capped at 0.95

Step 6: Final Consensus
{
  action: "BUY",
  confidence: 0.95,
  consensus_percentage: 100,
  participating_agents: [
    { name: "BREAKOUT_HUNTER", signal: "BUY", confidence: 0.87, weight: 0.343 },
    { name: "TREND_RIDER", signal: "BUY", confidence: 0.75, weight: 0.333 },
    { name: "ML_ORACLE", signal: "BUY", confidence: 0.72, weight: 0.324 }
  ],
  combo_activated: {
    name: "Breakout + Trend Confirmation",
    agents_involved: ["BREAKOUT_HUNTER", "TREND_RIDER"],
    bonus_multiplier: 1.25,
    historical_win_rate: 0.68
  },
  entry_price: 43500,
  stop_loss: 42800,
  target_1: 44500,
  target_2: 45200,
  key_agents: ["BREAKOUT_HUNTER", "TREND_RIDER"],
  reasoning: [
    "3-agent consensus on BUY",
    "Breakout + Trend combo detected (68% historical WR)",
    "100% agreement from voting agents",
    "Confidence amplified by combo match"
  ]
}

T+0:04 Signal Goes to Unified Pipeline
├─ RPG Consensus treated as 4th SOURCE
├─ Mixed with Scanner, ML, RL outputs
├─ Multi-source agreement scoring
├─ Quality gating applied
└─ Output: Final AggregatedSignal

T+0:05 Trade Execution
├─ Position size: Base × Quality × Combo multiplier
├─ Size: 0.1 BTC × 1.2 (quality) × 1.25 (combo) = 0.15 BTC
├─ Entry: Market order at 43,500
├─ Stops: 42,800 (2.7% risk)
├─ Targets:
│  ├─ TP1 (50%): 44,500 (2.3% gain)
│  └─ TP2 (50%): 45,200 (4.0% gain)
└─ Risk/Reward: 1:2.1

T+0:06 Track Trade for Learning
├─ Signal recorded
├─ Agents watching for outcome
├─ When closed: Update all agent win rates
├─ If WIN:
│  ├─ BreakoutHunter: +100 XP
│  ├─ TrendRider: +100 XP
│  ├─ MLOracle: +100 XP
│  ├─ Combo stats updated
│  └─ Agents' confidence refined
└─ If LOSS:
   ├─ Agents: +20 XP (learning penalty)
   ├─ Confidence thresholds adjusted
   └─ Probation check triggered if streak
```

### Flow 2: Combo Activation (Rare Market Consensus)

```
SCENARIO: 5+ agents unanimously signal BUY (rare!)

T+0:00 Five Agents Detect Same Signal
├─ BreakoutHunter: BUY, confidence 0.82
├─ TrendRider: BUY, confidence 0.79
├─ MLOracle: BUY, confidence 0.76
├─ VFMDPhysicsAgent: BUY, confidence 0.78
└─ FlowPhysicsAgent: BUY, confidence 0.75

T+0:01 All Signals Reach Arena

T+0:02 Combo Detection
├─ Combo Match 1: "Breakout + Trend" ✓
├─ Combo Match 2: "Physics Flow" (VFMD + Flow) ✓
├─ Combo Match 3: "ML Ensemble" ✓
├─ Meta Combo: "Market Consensus" (5+ agents, rare!)
│  └─ Bonus multiplier: 1.50x (!!)
└─ Combined bonus: 1.25 + 1.35 + 1.20 + 1.50 = ... → Capped

T+0:03 Final Consensus
├─ Action: BUY
├─ Confidence: 0.78 (avg) × 1.50 (mega combo) = 1.17 → Capped at 0.95
├─ Consensus: 100% (5/5 agents)
├─ Decision: MAXIMUM CONVICTION SIGNAL
└─ Combos Active:
   ├─ "Breakout + Trend" (68% WR)
   ├─ "Physics Flow" (71% WR)
   ├─ "ML Ensemble" (62% WR)
   └─ "Market Consensus" (78% WR) ← RARE!

T+0:04 Position Sizing (Special)
├─ Base size: 0.1 BTC
├─ Quality multiplier: 1.5x (0.95 confidence)
├─ Combo multiplier: 1.5x (mega combo bonus)
├─ Final: 0.1 × 1.5 × 1.5 = 0.225 BTC
├─ Account risk: 5% (elevated for high conviction)
└─ Size approved by Commander (approval system)

T+0:05 Trade Execution
├─ Entry: 43,500
├─ Stop: 42,500 (2.3% risk)
├─ Target 1: 44,500 (2.3% gain)
├─ Target 2: 45,500 (4.6% gain)
├─ Target 3: 46,500 (6.9% gain)
└─ Risk/Reward: 1:3.0 (premium setup)

T+0:06 Special Event
├─ "Market Consensus" alert sent to frontend
├─ All 5 agents highlighted
├─ Combo bonus explained
├─ Trade tracked for achievement
└─ If win: All agents get bonus XP (175 each)
     If loss: Learning opportunity (50 XP)
```

### Flow 3: Probation Entry (Performance Degradation)

```
SCENARIO: BreakoutHunter hits probation threshold

Trigger Event:
├─ 8 consecutive losses (losing_streak = 8)
├─ Or: Win rate drops to 42% (below 45% threshold)
├─ Or: Profit factor drops to 0.85 (below 1.0 threshold)
└─ Or: Max drawdown exceeds 15%

T+0:00 AgentLifecycleManager.reviewPerformance()
├─ Pull stats: Recent 50 trades
├─ Win rate: 44% (below 45% threshold ❌)
├─ Profit factor: 0.98 (close to 1.0 limit)
├─ Recent streak: 5 losses in last 8 trades
└─ Verdict: PUT ON PROBATION

T+0:01 Probation Initiated
├─ Status change: ACTIVE → PROBATION
├─ Duration: 30 days
├─ Restrictions:
│  ├─ Position size capped at 50%
│  ├─ All trades require commander approval
│  ├─ Confidence floor removed (might not vote if < 0.50)
│  └─ No sub-agent privileges
│
└─ Actions:
   ├─ Retraining: Model retrained on last 100 trades
   ├─ Mentor assignment: Matched with top agent (TrendRider)
   ├─ Skill adjustment: Pattern recognition reduced 2 levels
   └─ Hibernation option offered

T+0:02 Probation Period (30 days)

During probation:
├─ Trades restricted to 0.5x normal size
├─ Each trade requires approval (commander checks)
├─ Learning mode active
├─ Model refinement continuous
└─ Community chat: Mentored by top agents

Probation Exit Scenarios:

SCENARIO A: Recovery ✅
├─ After 20 days: Win rate restored to 52%
├─ Profit factor: 1.3
├─ Sentiment: Positive recovery
├─ Result: Probation lifted early (day 22)
├─ Reward: +500 XP bonus
└─ Status: Back to ACTIVE

SCENARIO B: Learning → Hibernation
├─ After 15 days: Performance still 44%
├─ Decision: Needs deeper learning
├─ Action: Enter HIBERNATION for 5 days
├─ During: Full retraining on new data
├─ After: Back to probation for 15 more days
└─ Goal: Recover before end of original 30

SCENARIO C: Deterioration → Retirement
├─ After 30 days: Win rate still 42%
├─ Total probations failed: 3 times
├─ Verdict: Cannot recover
├─ Action: RETIRED (permanent)
├─ Legacy: Stats preserved, achievements kept
└─ New agent spawned if slot available

T+0:03 Impact on Consensus Voting
├─ While in probation:
│  ├─ Agent weight reduced by 50%
│  ├─ Confidence threshold raised (must be > 0.70 to vote)
│  ├─ Less influence on final decision
│  └─ Votes recorded separately (for learning)
│
└─ Arena notes: "BreakoutHunter probation signals: 5 wins, 7 losses (41% WR)"
```

---

## API ENDPOINTS

### Agent Management

```
GET  /api/rpg-agents/leaderboard
     → Returns ranked agents by points

GET  /api/rpg-agents/status/:agentName
     → Detailed agent status + performance

GET  /api/rpg-agents/all
     → All agents with current status

POST /api/rpg-agents/process-market
     → Get consensus signal from all agents
     Input: { symbol, market_data }
     Output: ConsensusSignal

POST /api/rpg-agents/spawn
     → Spawn new agent
     Input: { parentAgentName?, type, config }

POST /api/rpg-agents/upgrade-skill
     → Upgrade agent skill
     Input: { agentName, skill }

POST /api/rpg-agents/update-performance
     → Record trade outcome
     Input: { agentName, tradeResult }

POST /api/rpg-agents/force-spawn-team
     → Spawn multiple agents at once
     Input: { composition: [{type, count, config}] }

POST /api/rpg-agents/:agentName/force-retire
     → Retire an agent

GET  /api/rpg-agents/combos
     → Get all combo statistics

GET  /api/rpg-agents/team/composition
     → Team statistics and breakdown

POST /api/rpg-agents/team/reset
     → Retire all agents, start fresh
```

---

## WHY IT WAS MISSING

The original `COMPLETE_SIGNAL_SYSTEM_MAPPING.md` focused on:
1. **Traditional signal sources** (Scanner, ML, RL)
2. **Quality gating** mechanisms
3. **Unification engine** architecture

But **didn't include the RPG layer** because:
- RPG agents are a **semi-autonomous system** (generate signals + manage themselves)
- They have their own **progression mechanics** (levels, skills, achievements)
- They use **consensus voting** (not just filtering like quality gates)
- They form **combos** (synergies beyond simple aggregation)
- They have **lifecycle management** (probation, hibernation, retirement)

The RPG system exists **ALONGSIDE** the unified signal pipeline, as a 4th signal source that feeds into it.

---

Generated: December 18, 2025
Scanstream RPG Agent System Complete Documentation v1.0
