# SYSTEM ARCHITECTURE DIAGRAM - SCANSTREAM

## High-Level Data Flow (9-Stage Pipeline)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MARKET DATA INGESTION (Stage 1)                         │
│                      CCXT Multi-Exchange Connector                          │
│                        Real-time + Historical Feeds                         │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ Raw OHLCV (Open, High, Low, Close, Volume)
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  INDICATOR COMPUTATION (Stage 2)                            │
│                     Feature Engineer (RPG Agent)                            │
│     ADX, RSI, Momentum, ATR, Bollinger Bands, OBV, CMF Extraction            │
│                    [Vectorized, Cached 30s TTL]                            │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ Computed Indicators
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   REGIME DETECTION (Stage 3)                                │
│              RegimeService + Market Oracle RPG Agent                        │
│              Volatility Level, Trend, Momentum Classification                │
│                    [Current Regime: LAMINAR_TREND/CHOPPY/etc]              │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ Regime Context
                 ▼
     ┌───────────────────────────────────────────────────────┐
     │  PARALLEL: 13 RPG AGENTS GENERATE SIGNALS (Stage 4)   │
     │  ┌──────────────────────────────────────────────────┐ │
     │  │ 1. VFMD Physics Agent      → Entry Signal        │ │
     │  │ 2. Convexity Agent        → Persistence Signal   │ │
     │  │ 3. Flow Physics Agent     → Energy Signal        │ │
     │  │ 4. Trend Rider            → Trend Entry Signal   │ │
     │  │ 5. Reversal Master        → Reversal Signal      │ │
     │  │ 6. Support Sniper         → Bounce Signal        │ │
     │  │ 7. Breakout Hunter        → Range Break Signal   │ │
     │  │ 8. Volume Mechanical      → Volume Confirmation  │ │
     │  │ 9. ML Oracle              → LSTM Prediction      │ │
     │  │ 10. Market Oracle         → Structure Signal     │ │
     │  │ 11. Feature Engineer      → Core Indicators      │ │
     │  │ 12. Python Strategy Agent → Legacy Strategies    │ │
     │  │ 13. Exit Agents           → Exit Timing Signal   │ │
     │  └──────────────────────────────────────────────────┘ │
     │             (Each: BUY/SELL/HOLD + Confidence)       │
     └───────────────┬───────────────────────────────────────┘
                     │ 13 Independent Signals
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SIGNAL AGGREGATION & RPG CONSENSUS (Stage 5)                   │
│                    RPG Signal Processor                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Agent Arena: Voting Mechanism                                       │   │
│  │  • Majority vote: BUY/SELL/HOLD consensus                           │   │
│  │  • Weighted by agent confidence scores                              │   │
│  │  • Consensus confidence = avg(confident agents)                     │   │
│  │  • Policy score from Q-value learning                               │   │
│  └──────────────────────┬──────────────────────────────────────────────┘   │
│                         │                                                   │
│  ┌──────────────────────▼──────────────────────────────────────────────┐   │
│  │ Combo Bonus Calculator: 4-Source Consensus                          │   │
│  │  • Scanner Source (Momentum): 0.25 weight                            │   │
│  │  • ML Source (LSTM Prediction): 0.25 weight                          │   │
│  │  • RL Source (Policy Learning): 0.25 weight                          │   │
│  │  • RPG Source (Agent Consensus): 0.25 weight                         │   │
│  │                                                                       │   │
│  │  Combo Types:                                                        │   │
│  │  • UNANIMOUS (4/4 agree): 1.30-1.40x confidence boost               │   │
│  │  • SUPER_STRONG (3/4 agree): 1.20-1.25x boost                       │   │
│  │  • STRONG (2/4 agree): 1.10-1.15x boost                             │   │
│  │  • WEAK (1/4 agree): 1.00x (no boost)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ RPG Aggregation { consensus, combo, finalConfidence }
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  QUALITY GATING - 5 LAYERS (Stage 6)                        │
│                       Quality Gating Engine                                  │
│                                                                              │
│  Layer 1: Base Confidence Scoring                                            │
│            ▼ Check: confidence > min_threshold                              │
│                                                                              │
│  Layer 2: 4-Source Consensus Validation                                      │
│            ▼ Check: combo bonus exists? → boost confidence                 │
│                                                                              │
│  Layer 3: Regime-Specific Thresholds                                         │
│            ▼ Check: threshold > regime_min (e.g., 0.40 in CHOPPY)           │
│                                                                              │
│  Layer 4: Source Agreement Verification                                      │
│            ▼ Check: 2+ sources agree? else hold                             │
│                                                                              │
│  Layer 5: Final Confidence Checks                                            │
│            ▼ Check: gated_confidence ∈ [0, 1] and > minimum_gate           │
│                                                                              │
│  OUTPUT: Gated Signal (PASS / HOLD / FAIL)                                   │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ Gated Signal
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  POSITION SIZING (Stage 7)                                   │
│            Dynamic Position Sizer / Unified Position Sizer                   │
│                                                                              │
│  Inputs:                                                                     │
│    • Gated signal confidence                                                 │
│    • ATR (volatility adjustment)                                             │
│    • Account risk limit                                                      │
│    • Portfolio exposure                                                      │
│                                                                              │
│  Outputs:                                                                    │
│    • Position size (notional)                                                │
│    • Leverage (if applicable)                                                │
│    • Stop loss level                                                         │
│    • Take profit target                                                      │
│                                                                              │
│  Formula: size = (account_risk / (entry - stop)) * confidence_multiplier    │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ Sized Trade
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  TRADE EXECUTION (Stage 8)                                   │
│         Paper Trading Engine / Live Trading Engine                           │
│                                                                              │
│  Paper Mode: Simulation without real capital                                 │
│  Live Mode: Real order submission to exchange                                │
│                                                                              │
│  Outputs:                                                                    │
│    • Order ID / Trade Fill Info                                              │
│    • Entry Price / Quantity                                                  │
│    • P&L Tracking                                                            │
└────────────────┬────────────────────────────────────────────────────────────┘
                 │ Trade Result { entry, exit, pnl }
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                LOGGING & FEEDBACK LOOP (Stage 9)                            │
│         Signal Archive + Daily Briefing System                               │
│                                                                              │
│  Feedback Path:                                                              │
│    1. Trade closes with profit/loss                                          │
│    2. Q-Value update: profitable +0.05, losing -0.10                         │
│    3. Exploration rate adjustment                                            │
│    4. Agent confidence recalibrated                                          │
│    5. Next cycle uses updated agent scores                                   │
│                                                                              │
│  Logging:                                                                    │
│    • All signals archived (symbol, timestamp, confidence, outcome)           │
│    • Agent performance metrics (win rate, profit factor, Sharpe)             │
│    • Daily briefing: Agent rankings, ability usage, synergies                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Engine Dependency Graph

```
Raw Market Data
       │
       ▼
   ┌─────────────────────────────┐
   │  Feature Engineer (RPG)     │  ← Core dependency
   │  Computes all indicators    │
   └──────────┬──────────────────┘
              │ ADX, RSI, ATR, Momentum, ...
              │
    ┌─────────┴──────────┐
    │                    │
    ▼                    ▼
VFMD Physics      Flow Physics
  Agent                Agent
    │                    │
    │  [Scout Signal]    │
    │                    │
    ▼                    ▼
Convexity Agent   Market Oracle
[Waits for VFMD]  [Regime Detection]
                         │
     ┌───────────────────┼────────────────────┬──────────────┐
     │                   │                    │              │
     ▼                   ▼                    ▼              ▼
Trend Rider      Reversal Master      Support Sniper   Breakout Hunter
(Trend Following) (Mean Reversion)    (Bounce Detect)  (Range Breaks)
     │                   │                    │              │
     └───────────────────┼────────────────────┴──────────────┘
                         │
            Volume Mechanical Verifier
            (S/R Zone Confirmation)
                         │
                         │  All 13 Agents
                         │  (Independent BUY/SELL/HOLD)
                         │
                         ▼
              ┌──────────────────────┐
              │   Agent Arena        │
              │   (RPG Voting)       │
              │ Majority consensus   │
              └──────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │ RPG Signal Processor       │
            │ Combo Bonus Calculator     │
            │ 4-Source Consensus        │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  Quality Gating (5 Layers) │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │ Position Sizer             │
            │ Trade Execution            │
            │ Logging & Feedback         │
            └────────────────────────────┘
```

---

## Engine Characteristics Matrix

| Engine | Input Type | Output | Latency | Confidence Range | Best For |
|--------|-----------|--------|---------|-----------------|----------|
| **VFMD** | Physics vectors | Early entries | Fast (instant) | 0.3-0.95 | Directional moves, early entry |
| **Convexity** | VFMD scout + opposite signal | Persistence signal | Slow (bars) | 0.4-0.85 | Asymmetric payoffs, patience |
| **Flow Field** | Force/acceleration | Directional bias | Fast (instant) | 0.2-0.80 | Energy trends, turbulence |
| **Volume Agent** | Volume profile | Zone confirmation | Medium (bars) | 0.5-0.95 | Support/resistance bounces |
| **Trend Rider** | ADX + Momentum | Trend entries | Fast (instant) | 0.4-0.90 | Strong directional trends |
| **Reversal Master** | RSI extremes | Reversal entries | Fast (instant) | 0.3-0.85 | Oversold/overbought bounces |
| **Support Sniper** | Price levels + volume | Bounce confirmations | Medium (bars) | 0.5-0.95 | Zone rejections |
| **Breakout Hunter** | Price extremes + volume | Range breaks | Medium (bars) | 0.4-0.90 | Volatility breakouts |
| **ML Oracle** | LSTM models | Price targets | Slow (inference) | 0.3-0.95 | Multi-timeframe consensus |
| **Market Oracle** | Market structure | Structure breaks | Medium (bars) | 0.5-0.90 | Regime transitions |
| **Microstructure** | Order flow | Exit timing | Fast (instant) | 0.6-0.95 | Optimal exit execution |

---

## Signal Routing Through Quality Gating

```
Raw Signal (from RPG Agents)
├─ Confidence: 0.65
├─ Sources: [Scanner, ML, RPG] (3/4)
├─ Regime: LAMINAR_TREND
└─ Combo Bonus: STRONG (1.12x)

                    ▼ Layer 1: Base Confidence
                 [0.65 > 0.30 ✓ PASS]

                    ▼ Layer 2: 4-Source Consensus
          [3/4 sources → STRONG bonus applied]
          [0.65 * 1.12 = 0.73 boosted confidence]

                    ▼ Layer 3: Regime Thresholds
          [LAMINAR_TREND regime_min = 0.35]
          [0.73 > 0.35 ✓ PASS]

                    ▼ Layer 4: Source Agreement
          [3/4 sources is good agreement ✓ PASS]

                    ▼ Layer 5: Final Checks
          [0.73 ∈ [0.0, 1.0] ✓ VALID]
          [0.73 > minimum_gate (0.40) ✓ PASS]

                    ▼
            ✅ GATED SIGNAL PASS
            (Ready for position sizing & execution)
```

---

## 4-Source Consensus Weighting

```
Trading Signal Generated

                ┌──────────────────────────────────────┐
                │  Source 1: SCANNER                   │
                │  (Momentum Scanner)                  │
                │  Confidence: 0.80                    │
                │  Weight: 0.25 (25%)                  │
                └──────────┬───────────────────────────┘
                           │
                ┌──────────▼───────────────────────────┐
                │  Source 2: ML (LSTM Inference)       │
                │  Confidence: 0.75                    │
                │  Weight: 0.25 (25%)                  │
                └──────────┬───────────────────────────┘
                           │
                ┌──────────▼───────────────────────────┐
                │  Source 3: RL (Policy Learning)      │
                │  Confidence: 0.78                    │
                │  Weight: 0.25 (25%)                  │
                └──────────┬───────────────────────────┘
                           │
                ┌──────────▼───────────────────────────┐
                │  Source 4: RPG (Agent Voting)        │
                │  Confidence: 0.76                    │
                │  Weight: 0.25 (25%)                  │
                └──────────┬───────────────────────────┘
                           │
                ┌──────────▼───────────────────────────┐
                │ 4-Source Consensus                   │
                │ = (0.80 + 0.75 + 0.78 + 0.76) / 4   │
                │ = 0.7725 (77.25% consensus)          │
                │                                      │
                │ Agreement: 4/4 sources align         │
                │ Combo Type: UNANIMOUS                │
                │ Bonus: 1.35x (30% boost)             │
                │                                      │
                │ Final Signal Confidence:             │
                │ = 0.7725 * 1.35 = 1.04 (capped 0.95)│
                └──────────────────────────────────────┘
```

---

## Agent Learning Feedback Loop

```
Trade Executed
       │
       ▼
Trade Closes with Result
       │
   ┌───┴────────────────────────────────────┐
   │                                         │
   ▼ (PROFIT)                               ▼ (LOSS)
                                            
Agent Confidence Update              Agent Confidence Update
+0.05 (encourage repeat)              -0.10 (discourage)

   │                                        │
   ▼ Bounds check                           ▼ Bounds check
[0.1 ≤ confidence ≤ 0.95]           [0.1 ≤ confidence ≤ 0.95]

   │                                        │
   ▼ Exploration Rate Update                ▼ Exploration Rate Update
-0.01 (exploit winners)               +0.02 (try new approaches)
[5% ≤ exploration ≤ 25%]             [5% ≤ exploration ≤ 25%]

   │                                        │
   ├────────────────┬──────────────────────┤
   │                ▼                      │
   │          Policy Updated               │
   │                                       │
   └───────────────────────────────────────┘
                   │
                   ▼
         Next Trade Cycle
    (Agent uses updated confidence
     in RPG consensus voting)
```

---

## Regime-Aware VFMD Thresholds

```
Market Regime Classification
        │
    ┌───┴──────────────────────────────────────┐
    │                                           │
    ▼ LAMINAR_TREND                            ▼ TURBULENT_CHOP
 (Strong directional)              (Choppy, low signal quality)
 
 PEG Threshold: 250                PEG Threshold: 350
 TRIGGER: 0.20                     TRIGGER: 0.20
 Confidence: HIGH (VFMD works)     Confidence: LOW (many false breaks)
 
    │                                           │
    ├──────────────────────────────────────────┤
    │                                           │
    ▼ BREAKOUT_TRANSITION                      ▼ ACCUMULATION/DISTRIBUTION
 (Range → Trend change)              (Distribution zone building)
 
 PEG: 400                            PEG: 260
 TRIGGER: 0.25                       TRIGGER: 0.40
 Confidence: VERY HIGH (early)       Confidence: MEDIUM (buildup)
 
    │                                           │
    ├──────────────────────────────────────────┤
    │                                           │
    ▼ CONSOLIDATION
 (Tight range, low volume)
 
 PEG: 150
 TRIGGER: 0.20
 Confidence: LOW (many false breaks)


Asset-Specific Tuning (Example: ETH vs BTC)
    │
    ├─── BTC (Standard thresholds)
    │    ├─ LAMINAR_TREND: PEG=250, TRIGGER=0.20
    │    ├─ CONSOLIDATION: PEG=150, TRIGGER=0.20
    │    └─ Risk: Requires larger moves to trigger
    │
    └─── ETH (Aggressive tuning - 1/10x BTC)
         ├─ LAMINAR_TREND: PEG=15, TRIGGER=0.08  (VeryAggressive)
         ├─ CONSOLIDATION: PEG=15, TRIGGER=0.08  (VeryAggressive)
         └─ Advantage: Catches smaller moves, higher frequency
```

---

## File Structure Reference

```
Scanstream/
├─ server/
│  ├─ services/
│  │  ├─ vfmd/                    ← VFMD Physics Engine
│  │  │  ├─ physicsCalculator.ts
│  │  │  ├─ fieldConstructor.ts
│  │  │  ├─ regimeClassifier.ts
│  │  │  ├─ triggerCalculator.ts
│  │  │  └─ ...
│  │  │
│  │  ├─ rpg-agents/              ← All 13 RPG Agents
│  │  │  ├─ VFMDPhysicsAgent.ts
│  │  │  ├─ ConvexityAgent.ts
│  │  │  ├─ FlowPhysicsAgent.ts
│  │  │  ├─ TrendRider.ts
│  │  │  ├─ ReversalMaster.ts
│  │  │  ├─ SupportSniper.ts
│  │  │  ├─ BreakoutHunter.ts
│  │  │  ├─ VolumeMechanicalVerifierAgent.ts
│  │  │  ├─ MLOracle.ts
│  │  │  ├─ MarketOracle.ts
│  │  │  ├─ FeatureEngineer.ts
│  │  │  ├─ PythonStrategyAgent.ts
│  │  │  ├─ SpecializedExitAgents.ts
│  │  │  ├─ AgentArena.ts          ← Voting mechanism
│  │  │  ├─ AchievementSystem.ts
│  │  │  ├─ OnlineLearningSystem.ts
│  │  │  ├─ DailyBriefingSystem.ts
│  │  │  └─ convexityEngine/
│  │  │
│  │  ├─ scanner/                 ← Scanner Pipeline
│  │  │  ├─ scanner-signal-service.ts
│  │  │  ├─ momentum-scanner.ts
│  │  │  ├─ risk-management.ts
│  │  │  └─ ...
│  │  │
│  │  ├─ lstm-inference-engine.ts  ← ML Inference
│  │  ├─ enhanced-lstm-trainer.ts  ← ML Training
│  │  ├─ regime-service.ts
│  │  ├─ dynamic-position-sizer.ts
│  │  ├─ learning-system-integration.ts
│  │  └─ ...
│  │
│  ├─ lib/
│  │  ├─ signal-pipeline.ts        ← Main 9-stage pipeline
│  │  ├─ rpg-signal-processor.ts   ← RPG consensus & combo bonus
│  │  ├─ quality-gating-engine.ts  ← 5-layer gating
│  │  └─ ...
│  │
│  ├─ routes/
│  │  ├─ scanner-analysis.ts
│  │  ├─ ml-predictions.ts
│  │  ├─ agent-abilities.ts
│  │  └─ ...
│  │
│  └─ index.ts                     ← Server entrypoint
│
├─ strategies/
│  ├─ gradient_trend_filter.py     ← Legacy Python strategies
│  ├─ ut_bot.py
│  ├─ mean_reversion.py
│  ├─ volume_profile.py
│  ├─ market_engine.py
│  ├─ enhanced_bounce_strategy.py
│  ├─ volume_sr_agent.py
│  └─ executor.py                  ← Strategy execution wrapper
│
├─ SYSTEM_REVERSE_ENGINEERING_COMPLETE.json  ← This document (JSON format)
└─ SYSTEM_ARCHITECTURE_DIAGRAM_COMPLETE.md   ← This document (visual)
```

---

## Summary Statistics

- **Total Engines Implemented**: 12 + RPG system with 13 agents = 25 total entities
- **Data Sources**: 4 (Scanner, ML, RL, RPG)
- **Pipeline Stages**: 9
- **Quality Gating Layers**: 5
- **Agent Types**: 8 (Physics, Trend, Reversal, Zone, Breakout, Volume, ML, Structure)
- **Learning Feedback Loops**: 2 (RPG policy learning + LSTM retraining capability)
- **Regime Classifications**: 6 (LAMINAR_TREND, BREAKOUT_TRANSITION, ACCUMULATION, DISTRIBUTION, CONSOLIDATION, TURBULENT_CHOP)
- **Combo Bonus Types**: 4 (UNANIMOUS 1.30-1.40x, SUPER_STRONG 1.20-1.25x, STRONG 1.10-1.15x, WEAK 1.00x)
- **Lines of Core Code**: 50,000+ (TypeScript + Python combined)
- **Test Coverage**: 50+ unit tests for Phase 4 RPG integration alone
