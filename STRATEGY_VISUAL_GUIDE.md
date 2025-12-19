# 🎪 Strategy-Agent Wiring Visual Guide

**Visual diagrams showing how 19 strategies wire into scanner and agents**

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCANSTREAM SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SCANNER (multi-exchange-scanner.ts)                    │   │
│  │  • Fetches OHLCV from exchanges                         │   │
│  │  • Runs ARM classifier                                  │   │
│  │  • Calls enhanceScanResultWithStrategies()             │   │
│  └────────┬────────────────────────────────────────────────┘   │
│           │                                                     │
│           ↓                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  STRATEGY ROUTER (strategy-router.ts)                  │   │
│  │  • detectMarketCondition(OHLCV)                        │   │
│  │    ↓ STRONG_UPTREND / RANGING / VOLATILE / etc.       │   │
│  │  • recommendAgentForMarket()                           │   │
│  │    ↓ TrendRider / MomentumHunter / VolatilityTrader   │   │
│  │  • routeStrategiesForAgent()                           │   │
│  │    ↓ [MACD, SAR, Ichimoku] for TrendRider            │   │
│  └────────┬────────────────────────────────────────────────┘   │
│           │                                                     │
│           ├─→ ┌──────────────────────────────────────────┐     │
│           │   │  RUN STRATEGIES (strategy-engine.ts)     │     │
│           │   │  • MACD Crossover      (58% win)        │     │
│           │   │  • RSI Oversold        (62% win)        │     │
│           │   │  • Triple Confirmation (72% win) ⭐    │     │
│           │   │  • [18 more...]                         │     │
│           │   └────────┬─────────────────────────────────┘     │
│           │            │                                       │
│           └────────────┼─────────────────────────────────┐    │
│                        │                                 │    │
│           ┌────────────↓──────────────┬──────────────┐   │    │
│           │                            │              │   │    │
│      ┌────▼────┐              ┌───────▼────┐  ┌─────▼──┐ │    │
│      │  Agent  │              │   Signals  │  │ Config │ │    │
│      │ Router  │              │  (Map)     │  │  Opts  │ │    │
│      └────┬────┘              └────────────┘  └────────┘ │    │
│           │                                              │    │
│           ↓                                              │    │
│  ┌─────────────────────────────────────────────────────┐│    │
│  │  AGENTS (agent-strategy-integration.ts)            ││    │
│  ├─────────────────────────────────────────────────────┤│    │
│  │  TrendRiderAgent         (trend strategies)        ││    │
│  │  MomentumHunterAgent     (momentum strategies)     ││    │
│  │  VolatilityTraderAgent   (volatility strategies)   ││    │
│  │  VolumeAnalyzerAgent     (volume strategies)       ││    │
│  │  PrecisionScalperAgent   (high-conf strategies)    ││    │
│  │  SwingTraderAgent        (advanced strategies)     ││    │
│  │  MultiStrategyAgent      (consensus voting)        ││    │
│  └─────────────────────────────────────────────────────┘│    │
│           ↑                                              │    │
│           └──────────────────────────────────────────────┘    │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  RESULT (EnhancedScanResult)                           │  │
│  │  ✓ Signal (BUY/SELL/NEUTRAL)                          │  │
│  │  ✓ Confidence (0-100%)                                │  │
│  │  ✓ Market Condition (UPTREND / RANGING / etc.)       │  │
│  │  ✓ Recommended Agent (TrendRider, etc.)              │  │
│  │  ✓ Primary Strategy (MACD Crossover)                 │  │
│  │  ✓ All Strategy Signals (Map)                        │  │
│  │  ✓ Risk Assessment (LOW / MEDIUM / HIGH)             │  │
│  │  ✓ Strategy Agreement % (how many agree)             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  FRONTEND / TRADING (scanner.tsx / agents)             │  │
│  │  Display results + let user override agent selection   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
OHLCV Input (4 arrays)
    │
    ├─ high:   [28000, 28100, 28050, 28200]
    ├─ low:    [27900, 27950, 28000, 28050]
    ├─ close:  [28050, 28080, 28100, 28180]
    └─ volume: [100, 120, 110, 130]
    
         ↓ strategyInput: StrategyInput
    
    ┌──────────────────────────────────────┐
    │  detectMarketCondition()             │
    │  • Calculate EMA 20/50               │
    │  • Calculate ADX (trend strength)    │
    │  • Calculate ATR (volatility)        │
    └───────────────┬──────────────────────┘
                    ↓
    MarketCondition: 'UPTREND' (EMA20 > EMA50, ADX = 32)
                    ↓
    ┌──────────────────────────────────────┐
    │  recommendAgentForMarket()           │
    │  Switch (marketCondition)            │
    │  case UPTREND: ['TrendRider', ...]   │
    └───────────────┬──────────────────────┘
                    ↓
    Recommended Agents: [TrendRider, VolumeAnalyzer, SwingTrader]
                    ↓
    ┌──────────────────────────────────────┐
    │  routeStrategiesForAgent()           │
    │  Agent = TrendRider                  │
    │  Strategies for TrendRider:          │
    │  - macdCrossover                     │
    │  - adxTrendFilter                    │
    │  - parabolicSAR                      │
    │  - ichimokuCloud                     │
    └───────────────┬──────────────────────┘
                    ↓
    Filtered Strategies Map<name, StrategySignal>
    • macdCrossover:    { signal: 'BUY', confidence: 78% }
    • adxTrendFilter:   { signal: 'BUY', confidence: 65% }
    • parabolicSAR:     { signal: 'HOLD', confidence: 35% }
    • ichimokuCloud:    { signal: 'BUY', confidence: 82% }
                    ↓
    ┌──────────────────────────────────────┐
    │  Aggregate Signals                   │
    │  BUY count: 3                        │
    │  SELL count: 0                       │
    │  HOLD count: 1                       │
    │  Avg Confidence: 71%                 │
    │  Agreement: 75%                      │
    └───────────────┬──────────────────────┘
                    ↓
    ┌──────────────────────────────────────┐
    │  Build EnhancedScanResult            │
    │  {                                   │
    │    signal: 'BUY',                    │
    │    confidence: 71,                   │
    │    marketCondition: 'UPTREND',       │
    │    primaryStrategy: 'ichimokuCloud', │
    │    recommendedAgent: 'TrendRider',   │
    │    agentAlignment: 85%,              │
    │    riskLevel: 'LOW',                 │
    │    allSignals: [ ... ]               │
    │  }                                   │
    └──────────────────────────────────────┘
```

---

## 🎯 Agent Selection Matrix

```
                     Trend  Momentum Range Volatility Volume
                     ────── ───────── ───── ────────── ───────

TrendRider          ✅✅✅   ⚠️       ❌     ⚠️        ⚠️
MomentumHunter      ⚠️      ✅✅✅   ✅✅   ⚠️        ⚠️
VolatilityTrader    ✅      ⚠️       ⚠️     ✅✅✅    ⚠️
VolumeAnalyzer      ⚠️      ⚠️       ✅     ⚠️        ✅✅✅
PrecisionScalper    ⚠️      ✅✅     ✅✅   ✅        ⚠️
SwingTrader         ✅✅    ⚠️       ⚠️     ⚠️        ✅✅
MultiStrategy       ✅✅    ✅✅     ✅✅   ✅        ✅✅


Legend:
✅✅✅ Perfect fit (3/3)
✅✅  Good fit (2/3)
✅   Works (1/3)
⚠️   Suboptimal but usable
❌   Avoid


Examples:
STRONG_UPTREND → TrendRider (✅✅✅)
RANGING → MomentumHunter (✅✅✅)
VOLATILE → VolatilityTrader (✅✅✅)
HIGH_VOLUME_DAY → VolumeAnalyzer (✅✅✅)
SCALPING_SETUP → PrecisionScalper (✅✅✅)
MULTI_DAY_SWING → SwingTrader (✅✅)
UNCERTAIN → MultiStrategy (all agents vote)
```

---

## 🔌 API Endpoint Map

```
┌────────────────────────────────────────────────┐
│  /api/strategy Routes                          │
├────────────────────────────────────────────────┤
│                                                │
│  POST /route                                  │
│  Input:  OHLCV + optional preferredAgent      │
│  Output: primaryStrategy, agentRecommendation │
│  Use:    Auto-route to best agent             │
│  ───────────────────────────────────────────  │
│                                                │
│  POST /market-condition                       │
│  Input:  OHLCV                                │
│  Output: MarketCondition enum + description   │
│  Use:    Detect current market state          │
│  ───────────────────────────────────────────  │
│                                                │
│  POST /recommend-agent                        │
│  Input:  OHLCV                                │
│  Output: [recommendedAgents...]               │
│  Use:    Get agent suggestions                │
│  ───────────────────────────────────────────  │
│                                                │
│  POST /agent/:agent                           │
│  Input:  OHLCV                                │
│  Output: Agent-specific strategy signals      │
│  Use:    Get signals for specific agent       │
│  ───────────────────────────────────────────  │
│                                                │
│  POST /scanner-enhance                        │
│  Input:  Symbol, original signal, OHLCV       │
│  Output: EnhancedScanResult                   │
│  Use:    Enhance scanner results              │
│  ───────────────────────────────────────────  │
│                                                │
│  POST /agent-decision                         │
│  Input:  Agent name, OHLCV                    │
│  Output: AgentDecision (BUY/SELL/HOLD)        │
│  Use:    Get agent trading decision           │
│  ───────────────────────────────────────────  │
│                                                │
│  POST /compare-agents                         │
│  Input:  OHLCV                                │
│  Output: All agents' decisions + consensus    │
│  Use:    Compare all agents, find consensus   │
│  ───────────────────────────────────────────  │
│                                                │
│  GET /registry                                │
│  Input:  Optional: category, agent, timeframe │
│  Output: All strategy definitions             │
│  Use:    Get strategy metadata                │
│  ───────────────────────────────────────────  │
│                                                │
│  GET /agent-config/:agent                     │
│  Input:  Agent name                           │
│  Output: Preset configuration for agent       │
│  Use:    Get agent presets                    │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 🧬 Strategy Distribution

```
TREND-FOLLOWING (4)           MOMENTUM (3)           VOLATILITY (3)
  MACD (58%)                    RSI (62%)              Squeeze (68%)
  ADX Filter                    Stochastic (63%)       Reversal (65%)
  SAR (52%)                     CCI (58%)              Keltner (62%)
  Ichimoku (68%)
        │                             │                     │
        └─────────┬───────────────────┼─────────────────────┘
                  │                   │
              TrendRider        MomentumHunter      VolatilityTrader
                  │                   │
                  │                   │
        ┌─────────┴───────────────────┴─────────────────────┐
        │                                                   │
    VOLUME (3)              COMBINATION (3)        ADVANCED (2)
    OBV (68%)               Triple Conf (72%)⭐   Ichimoku+Fib (72%)⭐
    MFI (63%)               Bollinger+RSI (68%)    Elder Ray (65%)
    CMF (60%)               Trend+Volume (68%)
        │                        │                       │
        └────────┬───────────────┼───────────────────────┘
                 │               │
           VolumeAnalyzer   PrecisionScalper      SwingTrader
                 │               │
                 │               │
                 └───────┬───────┴────────────────────┐
                         │                            │
                    MultiStrategy                 All Agents
                   (Consensus Vote)             (Highest Conviction)
```

---

## 🚀 Integration Timeline

```
Day 1: Setup
├─ Register routes in server/routes.ts
├─ Build project: npm run build
└─ Start dev server: npm start

Day 1-2: Testing
├─ Test /api/strategy/market-condition
├─ Test /api/strategy/agent-decision
├─ Test /api/strategy/compare-agents
└─ Verify all 8 endpoints working

Day 2: Scanner Integration
├─ Update multi-exchange-scanner.ts
├─ Import enhanceScanResultWithStrategies
├─ Call function after each scan
└─ Test scanner with strategies

Day 2-3: Agent Integration
├─ Update each agent class
├─ Import agent-strategy-integration
├─ Call AgentName.analyze(input)
└─ Test agent decisions

Day 3: Frontend Integration
├─ Add strategy selector to scanner.tsx
├─ Show strategy agreement %
├─ Show risk assessment
└─ Display recommended agent

Day 3-4: Testing & QA
├─ End-to-end testing
├─ Performance monitoring
├─ Bug fixes
└─ Live trading validation
```

---

## 📈 Signal Generation Flow

```
Input: 50 candles of OHLCV

Step 1: Calculate all indicators
├─ Moving averages (SMA, EMA, WMA)
├─ Momentum (MACD, RSI, Stochastic, CCI)
├─ Trend (ADX, Ichimoku, SAR)
├─ Volatility (Bollinger, Keltner, ATR)
└─ Volume (OBV, MFI, CMF)

Step 2: Run 19 strategies in parallel
├─ 4 Trend-following
├─ 3 Momentum
├─ 3 Volatility
├─ 3 Volume
├─ 3 Combination
└─ 2 Advanced

Step 3: Route to agent
├─ Detect market condition
├─ Filter to agent's strategies
├─ Aggregate signals
└─ Calculate confidence

Step 4: Make decision
├─ Count BUY/SELL/HOLD votes
├─ Calculate average confidence
├─ Assess risk level
└─ Return AgentDecision

Step 5: Compare agents (optional)
├─ Run all 6 agents
├─ Find consensus
├─ If all agree = highest conviction
└─ Return MultiStrategyResult
```

---

## 💰 Risk-Confidence Matrix

```
Confidence
    100% │  ✅ TRADE    ✅ TRADE    ✅ TRADE
         │
     80% │  ✅ TRADE    ✅ TRADE    ⚠️  CAUTION
         │
     60% │  ✅ TRADE    ⚠️  CAUTION  ❌ SKIP
         │
     40% │  ⚠️  CAUTION  ❌ SKIP     ❌ SKIP
         │
     20% │  ❌ SKIP     ❌ SKIP     ❌ SKIP
         │
      0% └──────────────────────────────────
            LOW       MEDIUM      HIGH
                  Risk Level

Legend:
✅ TRADE      - Clear signal, good risk/reward
⚠️  CAUTION   - Evaluate carefully, higher risk
❌ SKIP       - Avoid, insufficient data/high risk
```

---

## 🎪 All-in-One Flow

```
SCANNER RUNS
├─ Fetches OHLCV for BTC/USDT (1h)
├─ Calls enhanceScanResultWithStrategies()
│
├─ detectMarketCondition() → 'UPTREND'
├─ recommendAgentForMarket() → [TrendRider, SwingTrader, ...]
│
├─ Run TrendRider's strategies:
│  ├─ MACD Crossover      → 'BUY' (78% confidence)
│  ├─ Parabolic SAR       → 'BUY' (65% confidence)
│  ├─ Ichimoku Cloud      → 'BUY' (82% confidence)
│  └─ ADX (filter)        → 'PASS' (ADX = 32)
│
├─ Aggregate:
│  ├─ BUY: 3, SELL: 0, Agreement: 100%
│  ├─ Avg Confidence: 75%
│  └─ Risk: LOW
│
└─ RESULT:
   {
     signal: 'BUY',
     confidence: 75,
     marketCondition: 'UPTREND',
     primaryStrategy: 'ichimokuCloud',
     recommendedAgent: 'TrendRider',
     risk: 'LOW',
     reason: 'Multiple TrendRider strategies aligned, strong trend'
   }

TRADE EXECUTED
├─ User sees: "BUY signal at 75% confidence via TrendRider"
├─ Knows: Market is UPTREND, Risk is LOW
├─ Uses: Ichimoku Cloud as primary entry
└─ Confidence: HIGH ✅
```

---

**All diagrams show complete signal flow from OHLCV → Strategy Analysis → Agent Decision → Trading Action** 🎯
