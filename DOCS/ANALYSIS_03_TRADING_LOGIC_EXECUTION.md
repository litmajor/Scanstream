# RPG Trading Agent System - Part 3: Trading Logic & Execution

**Focus:** Signal generation, entry/exit logic, position sizing, risk management, learning

---

## 1. Signal Generation Pipeline

### 1.1 Complete Signal Generation Flow

```
Market Data (from Market Oracle)
    ↓
[Agent 1 Analysis]  [Agent 2 Analysis]  [Agent 3 Analysis] ...
├─ Pattern detection
├─ Confidence scoring
└─ Signal generation
    ↓
Agent Signals Array
    ├─ { agent: BreakoutHunter, action: BUY, confidence: 0.82, entry: 45230, target: 46235, stop: 44726 }
    ├─ { agent: TrendRider, action: BUY, confidence: 0.76, entry: 45230, target: 46100, stop: 44900 }
    └─ { agent: MLOracle, action: HOLD, confidence: 0.51, ... }
    ↓
Arena Aggregation
├─ Check for combos
├─ Calculate aggregate confidence
├─ Apply regime adjustments
└─ Generate final signal
    ↓
Risk Manager
├─ Check against exposure limits
├─ Verify Kelly Criterion compliance
└─ Determine position size
    ↓
Execution Decision (GO / NO-GO)
    ↓
Trade Execution or Paper Recording
```

### 1.2 Agent Signal Interface

```typescript
export interface AgentSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;           // 0-1
  entry: number;               // Entry price
  target: number;              // Profit target
  stop: number;                // Stop loss
  reason: string;              // "Breakout with 2.5x volume confirmation"
  agent_name: string;          // "BreakoutHunter_v1"
  agent_level: number;         // 12
}
```

---

## 2. Entry Conditions by Agent Type

### 2.1 BreakoutHunter Entry Logic

```typescript
processSignal(marketData): AgentSignal | null {
  const { price, resistance, volume, avg_volume, regime, atr, velocity } = marketData;
  
  // ✓ Condition 1: Price breaks resistance
  const is_breakout = price > resistance;
  if (!is_breakout) return null;
  
  // ✓ Condition 2: Volume confirmation (2-3x average)
  const volume_spike = volume > avg_volume * 2;
  if (!volume_spike) return null;
  
  // ✓ Condition 3: Pattern quality (skill-enhanced)
  let pattern_quality = this.detectBreakoutQuality(marketData);
  pattern_quality *= (this.skills.pattern_recognition / 10);
  
  // ✓ Condition 4: Regime-aware (if ability unlocked)
  if (this.abilities.includes('regime_adaptation')) {
    if (regime !== 'TRENDING' && regime !== 'BULL_TRENDING') {
      pattern_quality *= 0.7;  // Reduce confidence in non-trending
    }
  }
  
  // ✓ Condition 5: Multi-timeframe alignment (if ability unlocked)
  if (this.abilities.includes('multi_timeframe_confirmation')) {
    const mtf_score = this.checkMultipleTimeframes(marketData);
    pattern_quality *= mtf_score;  // 0.0-1.0
  }
  
  // ✓ Minimum quality threshold
  if (pattern_quality < 0.6) return null;
  
  // → GENERATE SIGNAL
  return {
    action: 'BUY',
    confidence: pattern_quality * this.confidence,
    entry: price,
    target: this.calculateTarget(marketData),
    stop: this.calculateStop(marketData),
    reason: `Breakout with ${(volume / avg_volume).toFixed(1)}x volume`,
    agent_name: this.name,
    agent_level: this.level
  };
}
```

**Quality Calculation:**
```
base_quality = 0.7

+ volume_ratio bonus:
  if volume > 3x: +0.15
  if volume > 2.5x: +0.10
  
+ breakout strength bonus:
  if breakout > 2%: +0.10
  
+ timing skill bonus:
  + (timing_precision / 10) * 0.1
  
= final_quality (capped at 1.0)
```

### 2.2 TrendRider Entry Logic

```typescript
processSignal(marketData): AgentSignal | null {
  const { price, ema20, ema50, ema200, adx, regime } = marketData;
  
  // Condition 1: EMA alignment (uptrend)
  if (price < ema20 || ema20 < ema50 || ema50 < sma200) {
    return null;  // Not in uptrend
  }
  
  // Condition 2: Trend strength (ADX > 20 = strong trend)
  if (adx < 20) {
    return null;  // Trend too weak
  }
  
  // Condition 3: Price above all MAs
  const trend_alignment = 1.0;  // All 3 MAs aligned
  
  // Condition 4: Regime confirmation
  if (this.abilities.includes('regime_adaptation')) {
    if (regime !== 'TRENDING' && regime !== 'BULL_TRENDING') {
      return null;  // Don't trade trends in ranging markets
    }
  }
  
  // → GENERATE SIGNAL
  const confidence = trend_alignment * (this.skills.regime_awareness / 10);
  
  return {
    action: 'BUY',
    confidence: confidence * this.confidence,
    entry: price,
    target: price * 1.035,  // 3.5% upside target
    stop: price * (1 - (this.atr / price) * 1.5),
    reason: `Trend confirmed: ${(adx).toFixed(1)} ADX strength`,
    agent_name: this.name,
    agent_level: this.level
  };
}
```

### 2.3 SupportSniper Entry Logic

```typescript
processSignal(marketData): AgentSignal | null {
  const { price, support, volume, rsi, bounce_quality } = marketData;
  
  // Condition 1: Price at support
  const at_support = price < (support * 1.01);  // 1% buffer
  if (!at_support) return null;
  
  // Condition 2: Bounce confirmation
  if (!bounce_quality || bounce_quality < 0.65) return null;
  
  // Condition 3: Volume on bounce
  const volume_confirmed = volume > this.marketData[symbol].avg_volume * 1.5;
  if (!volume_confirmed) return null;
  
  // Condition 4: RSI recovery (from oversold)
  if (rsi > 50) return null;  // Too late, bounced already
  
  // → GENERATE SIGNAL
  const confidence = bounce_quality * 0.8 + (this.skills.timing_precision / 10) * 0.2;
  
  return {
    action: 'BUY',
    confidence: confidence * this.confidence,
    entry: price,
    target: price * 1.025,  // Conservative 2.5% target
    stop: support * 0.98,   // Below support
    reason: `Support bounce detected (${bounce_quality.toFixed(0)}%)`,
    agent_name: this.name,
    agent_level: this.level
  };
}
```

### 2.4 ReversalMaster Entry Logic

```typescript
processSignal(marketData): AgentSignal | null {
  const { price, rsi, macd, resistance, volume } = marketData;
  
  // Condition 1: RSI extreme (above 70 = overbought)
  if (rsi <= 70) return null;
  
  // Condition 2: Price at resistance
  if (price < (resistance * 0.99)) return null;
  
  // Condition 3: MACD divergence or cross-under
  const macd_bearish = macd.histogram < 0 && macd.macd > macd.signal;
  if (!macd_bearish) return null;
  
  // Condition 4: Pattern match (high-level reversal)
  const pattern_quality = this.detectReversalPattern(marketData);
  if (pattern_quality < 0.65) return null;
  
  // → GENERATE SIGNAL (SHORT)
  const confidence = 0.75 * (pattern_quality) * (this.skills.pattern_recognition / 10);
  
  return {
    action: 'SELL',
    confidence: confidence * this.confidence,
    entry: price,
    target: resistance * 0.97,  // 3% down from resistance
    stop: price * 1.02,         // Above price
    reason: `Reversal setup: RSI ${rsi.toFixed(0)}, ${pattern_quality.toFixed(0)}% pattern`,
    agent_name: this.name,
    agent_level: this.level
  };
}
```

### 2.5 MLOracle Entry Logic

```typescript
processSignal(marketData): AgentSignal | null {
  const { ml_prediction, price, atr, regime } = marketData;
  
  // Condition 1: ML ensemble exists
  if (!ml_prediction) return null;
  
  const { direction, probability, ensemble_confidence, pattern_similarity } = ml_prediction;
  
  // Condition 2: Minimum ML confidence
  if (probability < 0.65) return null;
  
  // Condition 3: Ensemble agreement
  if (ensemble_confidence < 0.75) return null;
  
  // Condition 4: Pattern similarity
  if (pattern_similarity < 0.80) return null;
  
  // Condition 5: Skill enhancement
  let quality = probability;
  if (ensemble_confidence > 0.8) quality += 0.1;
  if (pattern_similarity > 0.85) quality += 0.15;
  quality *= (this.skills.pattern_recognition / 10);
  
  // Condition 6: Regime bonus (ML excels in VOLATILE)
  if (this.abilities.includes('regime_adaptation')) {
    if (regime === 'VOLATILE' || regime === 'HIGH_VOL') {
      quality *= 1.2;
    }
  }
  
  if (quality < 0.70) return null;
  
  // → GENERATE SIGNAL
  return {
    action: direction === 'UP' ? 'BUY' : 'SELL',
    confidence: quality * this.confidence,
    entry: price,
    target: ml_prediction.predicted_price || (direction === 'UP' ? price * 1.025 : price * 0.975),
    stop: direction === 'UP' ? price - atr * 1.5 : price + atr * 1.5,
    reason: `ML Ensemble: ${(probability * 100).toFixed(0)}% ${direction}, pattern match ${(pattern_similarity * 100).toFixed(0)}%`,
    agent_name: this.name,
    agent_level: this.level
  };
}
```

---

## 3. Exit Conditions

### 3.1 Basic Exit Rules

**All agents follow these exit rules:**

```
EXIT WHEN:

1. PROFIT TARGET REACHED
   → Close at target price (lock in gains)
   
2. STOP LOSS HIT
   → Close at stop price (limit losses)
   
3. TIME-BASED STOP
   → If no profit within 4 hours, close trade
   
4. REVERSAL SIGNAL
   → If contrary agent signals opposite direction
   
5. DIVERGENCE
   → If price makes new high but indicators don't
```

### 3.2 Intelligent Exits (Ability @ Level 5)

When `intelligent_exits` ability is unlocked:

```typescript
manageExit(trade: OpenTrade, marketData: MarketSnapshot): ExitDecision {
  
  // Calculate exit options
  const trailing_stop = this.calculateTrailingStop(trade);
  const breakeven_stop = trade.entry_price;
  const atr_multiple = trade.entry_price - (marketData.atr * 1.0);
  
  // Smart selection
  if (this.isWinning(trade)) {
    // Use trailing stop to maximize gains
    return {
      action: 'MOVE_STOP',
      new_stop: trailing_stop,
      reason: 'Trailing stop activated to protect profits'
    };
  } else if (this.isBreaking(trade)) {
    // Move to breakeven if price recovers
    return {
      action: 'MOVE_STOP',
      new_stop: breakeven_stop + (marketData.atr * 0.5),
      reason: 'Breakeven stop to reduce loss'
    };
  }
  
  return null;  // Hold current stops
}
```

### 3.3 SpecializedExitAgents

For advanced exit management (Level 18+):

```typescript
// ExitOrchestrator: Manages all exits across portfolio
// OppositionReader: Detects when market turns against position
// MicrostructureExitOptimizer: Uses order flow for optimal exits

// Example: When to exit based on opposition
if (opposition_strength > 0.85) {
  // Market structure has turned against us
  // Exit immediately even if not at target
  return { action: 'EXIT_IMMEDIATELY' };
}
```

---

## 4. Position Sizing

### 4.1 Kelly Criterion Implementation

Position size determined by Kelly Criterion:

```typescript
function calculateKelly(agent: TradingAgent): number {
  const win_rate = agent.win_rate;
  const loss_rate = 1 - win_rate;
  
  // Calculate average win/loss sizes
  const avg_win = agent.recent_trades
    .filter(t => t.profit > 0)
    .reduce((sum, t) => sum + t.profit, 0) / agent.wins;
    
  const avg_loss = Math.abs(agent.recent_trades
    .filter(t => t.profit < 0)
    .reduce((sum, t) => sum + t.profit, 0)) / agent.losses;
  
  // Kelly = (win_rate * avg_win - loss_rate * avg_loss) / avg_win
  const kelly_fraction = (win_rate * avg_win - loss_rate * avg_loss) / avg_win;
  
  // Use half-Kelly for safety
  return kelly_fraction / 2;
}
```

### 4.2 Position Size Calculation

```typescript
function calculatePositionSize(
  agent: TradingAgent,
  signal: AgentSignal,
  portfolio_capital: number
): number {
  
  // Step 1: Calculate base size using Kelly
  const kelly_fraction = this.calculateKelly(agent);
  const base_size = portfolio_capital * kelly_fraction;
  
  // Step 2: Apply confidence multiplier
  const confidence_multiplier = signal.confidence;  // 0.5-1.0
  const sized_position = base_size * confidence_multiplier;
  
  // Step 3: Apply mood modifier
  const mood_multiplier = this.moodModifiers[agent.mood];
  const mood_adjusted = sized_position * mood_multiplier.position_size;
  
  // Step 4: Apply skill modifier (risk management)
  const risk_skill_factor = agent.skills.risk_management / 10;  // 0.1-1.0
  const skill_adjusted = mood_adjusted * (0.5 + (risk_skill_factor * 0.5));
  
  // Step 5: Cap at max exposure
  const max_exposure = portfolio_capital * 0.02;  // Max 2% per trade
  const final_size = Math.min(skill_adjusted, max_exposure);
  
  return final_size;
}
```

**Example:**
```
Portfolio Capital: $100,000
Agent Win Rate: 60%
Kelly Fraction: 0.04 (4%)
Base Size = $100,000 * 0.04 = $4,000

Signal Confidence: 0.85
× 0.85 = $3,400

Mood: AGGRESSIVE (1.3x)
× 1.3 = $4,420

Risk Management Skill: Level 5/10 = 0.5 factor
× 0.75 = $3,315

Final Position: $3,315 (3.3% of portfolio)
```

### 4.3 Dynamic Position Sizing (Ability @ Level 3)

With `dynamic_position_sizing` ability:

```typescript
// Scales 0.5% to 2% based on confidence
if (signal.confidence < 0.60) {
  position_size *= 0.5;   // Very conservative
} else if (signal.confidence < 0.75) {
  position_size *= 0.8;   // Conservative
} else if (signal.confidence > 0.90) {
  position_size *= 1.5;   // Aggressive
}
```

---

## 5. Portfolio Capital Allocation

### 5.1 Portfolio Manager Architecture

```typescript
class AgentPortfolioManager {
  totalCapital: number = 100000;  // $100k
  reserveCapitalPct: number = 0.20;  // Keep 20% in reserve
  minAllocationPct: number = 0.05;  // Min 5% per agent
  maxAllocationPct: number = 0.30;  // Max 30% per agent
}
```

### 5.2 Allocation Algorithm

```typescript
allocateCapital(agents: TradingAgent[]): AgentAllocation[] {
  // Step 1: Filter eligible agents
  const eligible = agents.filter(a =>
    a.trades >= 20 &&           // Min 20 trades
    a.win_rate > 0.50 &&        // Min 50% win rate
    a.profit_factor > 1.0       // Profitable
  );
  
  // Step 2: Calculate Kelly for each
  const kellyAllocations = eligible.map(agent => ({
    agent,
    kelly_pct: calculateKelly(agent)
  }));
  
  // Step 3: Normalize to fit capital
  const availableCapital = totalCapital * (1 - reserveCapitalPct);
  const totalKelly = kellyAllocations.reduce((sum, a) => sum + a.kelly_pct, 0);
  
  // Step 4: Allocate with bounds
  const allocations = kellyAllocations.map(({ agent, kelly_pct }) => {
    let allocation_pct = (kelly_pct / totalKelly) * (1 - reserveCapitalPct);
    
    // Enforce min/max bounds
    allocation_pct = Math.min(
      Math.max(allocation_pct, minAllocationPct),
      maxAllocationPct
    );
    
    const capital_allocated = totalCapital * allocation_pct;
    
    return {
      agent_name: agent.name,
      capital_allocated: capital_allocated,
      allocation_percentage: allocation_pct,
      max_position_size: capital_allocated * 0.2,  // 20% of agent capital per trade
      risk_limit: capital_allocated * 0.15,         // 15% max drawdown
      reason: `Kelly-based: ${(kelly_pct * 100).toFixed(1)}% → ${(allocation_pct * 100).toFixed(1)}%`
    };
  });
  
  return allocations;
}
```

**Example Portfolio:**
```
Total Capital: $100,000
Reserve: $20,000 (20%)
Available: $80,000

BreakoutHunter:  Kelly 5% → Allocated 20% → $20,000
TrendRider:      Kelly 4% → Allocated 16% → $16,000
MLOracle:        Kelly 3% → Allocated 12% → $12,000
SupportSniper:   Kelly 2% → Allocated 8%  → $8,000
ReversalMaster:  Kelly 2% → Allocated 8%  → $8,000
(Not eligible): -              (4% slack)  → $4,000 (reserve buffer)

TOTAL ALLOCATED: $76,000
RESERVE:         $24,000
```

---

## 6. Risk Management

### 6.1 Risk Limits Per Agent

```typescript
interface RiskLimits {
  max_drawdown_pct: number;        // Max 15% drawdown before pause
  max_loss_per_trade_pct: number;  // Max 2% loss on single trade
  max_consecutive_losses: number;  // Max 5 losses in a row
  max_daily_loss_pct: number;      // Max 3% daily loss
  min_win_rate_threshold: number;  // Min 48% or put on probation
}
```

### 6.2 Drawdown Monitoring

```typescript
monitorDrawdown(agent: TradingAgent): string {
  const peak_equity = agent.peak_equity;
  const current_equity = agent.total_profit;
  const drawdown_pct = ((peak_equity - current_equity) / peak_equity) * 100;
  
  if (drawdown_pct > 20) {
    return 'HIBERNATION';  // Put agent on pause
  } else if (drawdown_pct > 15) {
    return 'PROBATION';    // Reduce position size
  } else if (drawdown_pct > 10) {
    return 'WARNING';      // Alert only
  }
  
  return 'ACTIVE';
}
```

---

## 7. Learning System

### 7.1 Online Learning Loop

```
Trade Execution
    ↓
Outcome Recorded {
  state: MarketSnapshot,
  action: BUY,
  reward: +150,          // Profit or loss
  nextState: MarketSnapshot,
  done: true
}
    ↓
Experience Replay
├─ Store in buffer (1000 max)
├─ Sample batch (32 experiences)
├─ Update Q-values
└─ Update model weights
    ↓
Parameter Evolution
├─ Bayesian updates to agent thresholds
├─ Adaptive learning rates
└─ Drift detection
    ↓
Agent Adaptation
├─ Better entry signals
├─ Better exits
└─ Better position sizing
```

### 7.2 Parameter Learning

Agents learn and adapt parameters:

```typescript
class OnlineLearningSystem {
  recordExperience(
    agent: TradingAgent,
    state: MarketSnapshot,
    action: AgentSignal,
    reward: number,
    nextState: MarketSnapshot
  ): void {
    // Store experience
    this.experienceBuffer.push({
      state, action, reward, nextState, done: true
    });
    
    // If buffer full, sample and learn
    if (this.experienceBuffer.length >= 32) {
      this.updateQValues();
      this.adaptParameters(agent);
    }
  }
  
  private adaptParameters(agent: TradingAgent): void {
    // Update thresholds based on success
    if (agent.win_rate > 0.58) {
      agent.entry_threshold -= 0.01;  // Lower threshold, more trades
      agent.position_size_multiplier += 0.05;
    }
    
    // Reduce if performance drops
    if (agent.win_rate < 0.48) {
      agent.entry_threshold += 0.02;  // Higher threshold, fewer trades
      agent.position_size_multiplier -= 0.1;
    }
  }
}
```

---

## 8. Synergy System (Combos)

### 8.1 Combo Definition

```typescript
interface AgentCombo {
  name: string;
  agents: string[];                    // List of agents involved
  activation_condition: string;         // Trigger for combo
  bonus_multiplier: number;            // Bonus when activated
  historical_win_rate: number;         // Measured over time
  historical_profit_factor: number;
  times_activated: number;
}
```

### 8.2 Registered Combos

```
1. TSUNAMI
   Agents: [BREAKOUT_HUNTER, TREND_RIDER, ML_ORACLE]
   Condition: All 3 agree with >70% confidence
   Bonus: +25% position size
   Historical Win Rate: 68%
   Historical Profit Factor: 3.2x

2. PERFECT STORM
   Agents: [TREND_RIDER, ML_ORACLE, REVERSAL_MASTER]
   Condition: All 3 agree on direction
   Bonus: +20% position size, +0.15 confidence
   Historical Win Rate: 65%

3. DOUBLE BOUNCE
   Agents: [SUPPORT_SNIPER, REVERSAL_MASTER]
   Condition: Both identify same level as key
   Bonus: +15% position size
   Historical Win Rate: 61%

... 5+ more combos
```

### 8.3 Combo Activation Logic

```typescript
checkComboActivation(signals: AgentSignal[]): AgentCombo | null {
  for (const combo of this.combos) {
    const participating = signals.filter(s =>
      combo.agents.includes(s.agent_name) &&
      s.confidence > 0.70
    );
    
    if (participating.length >= combo.agents.length) {
      // COMBO ACTIVATED!
      combo.times_activated += 1;
      
      console.log(`🌊 COMBO ACTIVATED: ${combo.name}!`);
      console.log(`Position size bonus: +${(combo.bonus_multiplier - 1) * 100}%`);
      
      return combo;
    }
  }
  
  return null;
}
```

---

## 9. Next Section

**→ Part 4: Database, API, Frontend & Deployment** covers:
- Database schema (20+ tables)
- All API endpoints (40+ routes)
- Frontend pages and components
- Real-time WebSocket updates
- Deployment & configuration
- Testing & quality

