# 🎯 COMPLETE SIGNAL SYSTEM MAPPING
## Scanstream: All Signal Structures, Flows, Gating, Quality & Unification

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Signal Taxonomy](#signal-taxonomy)
3. [Signal Generation Pipeline](#signal-generation-pipeline)
4. [Quality Gating Framework](#quality-gating-framework)
5. [Signal Unification Engine](#signal-unification-engine)
6. [Data Structures](#data-structures)
7. [Complete Signal Flows](#complete-signal-flows)
8. [Quality Scoring System](#quality-scoring-system)
9. [Integration Points](#integration-points)

---

## EXECUTIVE SUMMARY

Scanstream processes signals through **three distinct sources**:
- **Scanner**: Technical pattern + momentum detection (TypeScript)
- **ML Engine**: Machine learning predictions (Python + TypeScript)
- **RL Module**: Reinforcement learning decisions (Python)

All signals converge into a **unified aggregation pipeline** that:
1. **Classifies** signals into categories
2. **Weights** by regime (trending/sideways/volatile)
3. **Gates** by quality thresholds
4. **Combines** for consensus entry decisions
5. **Enriches** with metadata for execution

---

## SIGNAL TAXONOMY

### 1. SIGNAL TYPES (By Source)

#### A. Scanner Signals (Technical)
```
Types:
├── BREAKOUT
├── REVERSAL
├── CONTINUATION
├── PULLBACK
├── DIVERGENCE
├── SUPPORT_BOUNCE
├── RESISTANCE_BREAK
├── TREND_CONFIRMATION
├── CONSOLIDATION_BREAK
├── MA_CROSSOVER
├── RSI_EXTREME
├── MACD_SIGNAL
├── CONFLUENCE (Multiple confirmations)
├── ML_PREDICTION
├── PARABOLIC
├── BULL_EARLY / BEAR_EARLY
├── ACCUMULATION / DISTRIBUTION
├── SPIKE
├── TOPPING / BOTTOMING
├── RANGING
├── LAGGING / LEADING
├── TREND_EXHAUSTION / ESTABLISHMENT
├── RETEST
└── FLIP

Metadata:
├── Strength: 0-100 score
├── Confidence: 0-1 probability
├── Pattern: SignalClassification
└── Reasoning: String explanation
```

#### B. ML Signals (Predictive)
```
Types:
├── TREND_SIGNAL (0-1 probability)
├── MOMENTUM_SIGNAL
├── VOLATILITY_SIGNAL
├── REGIME_SIGNAL
├── ANOMALY_DETECTION
└── ENSEMBLE_PREDICTION

Features:
├── ML Confidence: 0-1
├── Model Type: LSTM, TreeBased, Ensemble
├── Feature Importance: Top 5 features
├── Historical Accuracy: %
└── Predicted Timeframe: Hours/Days
```

#### C. RL Signals (Adaptive)
```
Types:
├── ENTRY_SIGNAL
├── EXIT_SIGNAL
├── POSITION_SIZE_SIGNAL
└── RISK_ADJUSTMENT_SIGNAL

Attributes:
├── Action: BUY/SELL/HOLD
├── Confidence: 0-1
├── Suggested Size: % of portfolio
└── Justification: Policy explanation
```

#### D. 13-Agent System Signals
```
Core Agents (8):
├── 1. Price Action Agent (Support/Resistance, Trend)
├── 2. Volume Profile Agent (Volume Imbalance)
├── 3. Order Flow Agent (Footprint Analysis)
├── 4. Volatility Agent (IV, ATR, Regime)
├── 5. Market Structure Agent (Swings, Breaks)
├── 6. Momentum Agent (RSI, Stoch, MACD)
├── 7. Correlation Agent (Asset correlations)
└── 8. Sentiment Agent (Aggregate sentiment)

Python Strategy Agents (5):
├── 9. Market Structure Engine (Swing detection)
├── 10. Pattern Recognition
├── 11. Mean Reversion
├── 12. Breakout Trading
└── 13. ML Predictions

Each Agent Returns:
├── Signal: LONG/SHORT/HOLD
├── Confidence: 0-100%
├── Strength: 0-100
├── Reasoning: String array
└── Historical Win Rate: %
```

---

## SIGNAL GENERATION PIPELINE

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SIGNAL GENERATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

LAYER 1: DATA ACQUISITION
  Market Data (OHLCV)
    ↓
  ┌────────────────────────────────────────────────────────────┐
  │ Raw Frame Assembly (server/lib/signal-pipeline.ts)        │
  │ - Timestamp synchronization                                │
  │ - Quality envelope calculation                              │
  │ - Latency tracking (for confidence adjustment)              │
  └────────────────────────────────────────────────────────────┘
    ↓
LAYER 2: FEATURE EXTRACTION
  ┌──────────────────┬──────────────────┬──────────────────┐
  │   SCANNER        │     ML ENGINE      │   RL MODULE      │
  │   (TypeScript)   │  (Python Bridge)   │   (Python)       │
  ├──────────────────┼──────────────────┼──────────────────┤
  │ Momentum Calc    │ Feature Matrix    │ State Space      │
  │ Pattern Detect   │ Model Inference   │ Policy Lookup    │
  │ Structure Breaks │ Confidence Calc   │ Value Function   │
  │ Indicator Pack   │ Uncertainty Est   │ Exploration      │
  └──────────────────┴──────────────────┴──────────────────┘
    ↓
LAYER 3: CLASSIFICATION & WEIGHTING
  ┌─────────────────────────────────────────────────────────────┐
  │ Regime Detection (RegimeAwareSignalRouter)                  │
  │ - Market Type: TRENDING / SIDEWAYS / HIGH_VOLATILITY / ...  │
  │ - Regime-Specific Weighting:                                │
  │   - TRENDING: Gradient=30%, UT_Bot=25%, ML=25%             │
  │   - SIDEWAYS: Structure=30%, Flow=20%, RL=25%              │
  │   - VOLATILE: Volatility Measures prioritized              │
  └─────────────────────────────────────────────────────────────┘
    ↓
LAYER 4: CONSENSUS & QUALITY GATING
  ┌──────────────────────────────────────────┐
  │ MultiSource Agreement Scoring             │
  │ ├─ Agreement Score = % of sources align  │
  │ ├─ Min Required (regime-dependent)       │
  │ └─ Filter if below threshold             │
  └──────────────────────────────────────────┘
    ↓
LAYER 5: QUALITY SCORING
  ┌──────────────────────────────────────────┐
  │ CompositeQualityEngine                   │
  │ ├─ Trend Alignment (25%)                 │
  │ ├─ Momentum Quality (25%)                │
  │ ├─ Order Flow (20%)                      │
  │ ├─ Risk/Reward (20%)                     │
  │ └─ Volatility (10%)                      │
  │ = Composite Score 0-100                  │
  └──────────────────────────────────────────┘
    ↓
LAYER 6: ENRICHMENT
  ┌──────────────────────────────────────────┐
  │ Trade Classification                      │
  │ ├─ Type: SCALP/DAY/SWING/POSITION       │
  │ ├─ Holding Period: Hours                 │
  │ ├─ Profit Target: %                      │
  │ └─ Stop Loss: %                          │
  └──────────────────────────────────────────┘
    ↓
LAYER 7: EXECUTION PREP
  ┌──────────────────────────────────────────┐
  │ Position Sizing & Risk Calc              │
  │ ├─ Entry Price Detection                 │
  │ ├─ SL/TP Calculation                     │
  │ ├─ Risk/Reward Validation                │
  │ └─ Position Size Multiplier              │
  └──────────────────────────────────────────┘
    ↓
OUTPUT: AggregatedSignal
  {
    id, symbol, type, direction, price, timestamp,
    strength, confidence, agreementScore,
    regime, contributions[], classifications[],
    tradingTargets: {stopLoss, takeProfit1-3},
    tradeClassification: {type, holdingPeriodHours},
    reasoning, primarySources[]
  }
```

### File Locations for Each Layer

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Data Acquisition | `signal-pipeline.ts` | Frame assembly |
| Scanner | `momentum-scanner.ts`, `signal-classifier.ts` | Pattern detection |
| ML Engine | `server/ml/` folder + Python bridge | ML predictions |
| RL Module | `server/rl/` folder | Adaptive decisions |
| Regime Detection | `regime-aware-signal-router.ts` | Market context |
| Consensus | `signal-pipeline.ts` | Multi-source voting |
| Quality | `signal-quality.ts`, `composite-entry-quality.ts` | Score calculation |
| Classification | `trade-classifier.ts` | Trade type detection |
| Gating | `quality-gating.ts` | Threshold filtering |
| Archive | `signal-persistence-service.ts`, `signal-archive.ts` | Storage |

---

## QUALITY GATING FRAMEWORK

### 1. ENTRY-POINT GATING

Located in: `server/services/scanner/quality-gating.ts`

```typescript
QUALITY_GATE_THRESHOLDS = {
  // Tier-1 assets (BTC, ETH, etc.)
  TIER_1: {
    minConfidence: 0.70,    // 70% minimum
    minStrength: 65,        // 65/100 minimum
    description: 'Tier-1 (BTC, ETH, etc.)'
  },
  // Standard assets (alts)
  STANDARD: {
    minConfidence: 0.60,    // 60% minimum
    minStrength: 55,        // 55/100 minimum
    description: 'Standard assets'
  },
  // Meme/lower liquidity
  MEME: {
    minConfidence: 0.50,    // 50% minimum
    minStrength: 45,        // 45/100 minimum
    description: 'Meme tokens'
  }
}

// Check: passesQualityGate(confidence, strength, symbol)
// Returns: { passesGate: boolean, rejectionReason?: string }
```

### 2. PATTERN QUALITY GATE

```typescript
passesPatternQualityGate(
  confidence: number,      // 0-1 signal confidence
  strength: number,        // 0-100 pattern strength
  patternCount: number,    // How many patterns detected
  symbol: string           // Asset tier lookup
): GatedSignalResult

Logic:
├─ Pattern Confluence Bonus:
│  ├─ 1 pattern: Base threshold
│  ├─ 2+ patterns: +5% confidence boost
│  └─ 3+ patterns: +10% confidence boost (highest strength)
│
├─ Risk Adjustment:
│  ├─ Pattern known to fail: -15% confidence
│  ├─ Pattern over-used: -10% confidence (diminishing returns)
│  └─ Pattern in low-volume: -5% confidence
│
└─ Final Decision:
   If (confidence * bonusMultiplier) >= tierThreshold
     → PASS
   Else
     → FILTERED with rejection reason
```

### 3. MULTI-TIMEFRAME CONFIRMATION GATING

```typescript
// Located: server/lib/signal-quality.ts

Quality increases when:
├─ 1TF confirms: Base quality = 60%
├─ 2TF confirm: Quality +15% = 75%
├─ 3+ TF confirm: Quality +25% = 85%
└─ Divergence: Quality -30% (conflicting signals)

Applied to:
├─ Trend signals
├─ Support/Resistance bounces
├─ Breakout confirmations
└─ Reversal patterns
```

### 4. COMPOSITE ENTRY QUALITY GATING

Located in: `server/services/composite-entry-quality.ts`

```typescript
Composite Score = 
  (Trend Alignment × 0.25) +
  (Momentum Quality × 0.25) +
  (Order Flow × 0.20) +
  (Risk/Reward × 0.20) +
  (Volatility Adjustment × 0.10)

Range: 0-100

QUALITY RATINGS:
├─ 85-100: EXCELLENT   → Enter full size
├─ 70-84:  GOOD        → Enter 75% size
├─ 55-69:  FAIR        → Enter 50% size
├─ 40-54:  POOR        → Enter 25% size
└─ 0-39:   FILTERED    → DO NOT ENTER
```

### 5. REGIME-SPECIFIC GATING

```typescript
TRENDING regime:
├─ Min Agreement: 55%
├─ Prioritize: Gradient descent, UT Bot, MA patterns
├─ Filter: Consolidation signals (noise in trends)
└─ Confidence Boost: +10% for trend-following patterns

SIDEWAYS regime:
├─ Min Agreement: 60%
├─ Prioritize: Support/Resistance bounces, oscillators
├─ Filter: Breakout signals (false breakouts)
└─ Confidence Boost: +10% for mean-reversion patterns

VOLATILE regime:
├─ Min Agreement: 70% (stricter)
├─ Prioritize: Volatility measures, structure breaks
├─ Filter: Weakness-heavy signals (noise)
└─ Confidence Boost: +15% for volatility confirmations
```

---

## SIGNAL UNIFICATION ENGINE

### Architecture

Located in: `server/services/unified-signal-aggregator.ts`

```
┌─────────────────────────────────────────────────────────────┐
│         UNIFIED SIGNAL AGGREGATION & ROUTING                │
└─────────────────────────────────────────────────────────────┘

STEP 1: SOURCE COLLECTION
  Scanner Output
    + ML Predictions
    + RL Decisions
    = Raw Signal Bundle

        ↓

STEP 2: STANDARDIZATION
  Convert all sources to common format:
  ├─ Type: BUY | SELL | HOLD
  ├─ Strength: 0-100
  ├─ Confidence: 0-1
  ├─ Direction: LONG | SHORT | NEUTRAL
  ├─ Reasoning: String[]
  └─ Timestamp: ISO string

        ↓

STEP 3: REGIME DETECTION
  Determine market context:
  ├─ TRENDING: Clear uptrend/downtrend
  ├─ SIDEWAYS: Range-bound
  ├─ BREAKOUT: Breaking structure
  ├─ HIGH_VOLATILITY: Extreme moves
  └─ REVERSAL: Top/bottom formation

        ↓

STEP 4: REGIME-AWARE WEIGHTING
  Apply dynamic weights to sources:
  
  IF regime == TRENDING:
    Scanner: 35% (best at technical patterns)
    ML: 35% (good at trend prediction)
    RL: 30% (learns from adaptivity)
  
  ELIF regime == SIDEWAYS:
    Scanner: 40% (support/resistance edges)
    ML: 25% (struggles sideways)
    RL: 35% (mean-reversion edge)
  
  ELIF regime == VOLATILE:
    Scanner: 25% (patterns break down)
    ML: 30% (captures regime shifts)
    RL: 45% (adaptive to volatility)

        ↓

STEP 5: CONSENSUS SCORING
  Calculate agreement:
  ├─ All 3 sources agree: 100% agreement
  ├─ 2 sources agree: 66% agreement
  ├─ 1 source: 33% agreement
  └─ Conflicting: 0% agreement

  Check against regime minimum:
  ├─ TRENDING: Need 55% min
  ├─ SIDEWAYS: Need 60% min
  ├─ VOLATILE: Need 70% min
  └─ BREAKOUT: Need 65% min
  
  If below minimum → FILTERED

        ↓

STEP 6: QUALITY CALCULATION
  Run through CompositeEntryQualityEngine:
  ├─ Trend Alignment Score
  ├─ Momentum Quality
  ├─ Order Flow Quality
  ├─ Risk/Reward Validation
  └─ Volatility Adjustment
  = Composite Quality (0-100)

  Minimum thresholds:
  ├─ Tier-1 assets: 70 quality
  ├─ Standard assets: 65 quality
  ├─ Meme assets: 55 quality

        ↓

STEP 7: PATTERN ENRICHMENT
  Add metadata:
  ├─ Primary pattern type
  ├─ Secondary confirmations
  ├─ Support/Resistance levels
  ├─ Pattern accuracy history
  └─ Confluence count

        ↓

STEP 8: CLASSIFICATION
  Determine trade type:
  ├─ SCALP: 5m-1h, target 1-3%
  ├─ DAY: 1h-4h, target 3-5%
  ├─ SWING: 4h-1d, target 5-10%
  └─ POSITION: 1d+, target 10%+

  Based on:
  ├─ Volatility level
  ├─ ADX strength
  ├─ Volume profile
  └─ Market regime

        ↓

STEP 9: POSITION SIZING
  Calculate size multiplier:
  ├─ Base size: 1.0
  ├─ Quality multiplier: 0.5-1.5x
  ├─ Regime multiplier: varies
  ├─ Volatility multiplier: varies
  └─ Account risk limit: applied

        ↓

OUTPUT: AGGREGATED SIGNAL
  {
    id: UUID,
    symbol: string,
    type: 'BUY' | 'SELL' | 'HOLD',
    direction: 'LONG' | 'SHORT' | 'NEUTRAL',
    strength: 0-100,
    confidence: 0-1,
    agreementScore: 0-100,
    
    regime: {
      type: RegimeType,
      trendStrength: 0-100,
      characteristics: string[]
    },
    
    contributions: [{
      source: 'SCANNER' | 'ML' | 'RL',
      signal: string,
      weight: 0-1,
      strength: 0-100
    }],
    
    classifications: string[],
    primaryPattern: string,
    
    tradingTargets: {
      stopLoss: number,
      takeProfit1: number,
      takeProfit2: number,
      takeProfit3: number
    },
    
    tradeClassification: {
      type: 'SCALP' | 'DAY' | 'SWING' | 'POSITION',
      holdingPeriodHours: number,
      profitTargetPercent: number,
      stopLossPercent: number,
      pyramidStrategy: string
    },
    
    reasoning: string[],
    primarySources: string[],
    timestamp: ISO string,
    price: number
  }
```

### Key Functions

```typescript
// Main unification entry point
async aggregateSignals(
  symbol: string,
  marketData: RawMarketData,
  scannerOutput: ScannerOutput,
  mlPredictions: MLPrediction[],
  rlDecision: RLDecision
): Promise<AggregatedSignal | null>

// Regime-aware weighting
async getRegimeWeighting(regimeType: string): Promise<{
  scanner: number,
  ml: number,
  rl: number
}>

// Consensus calculation
calculateAgreementScore(
  scannerSignal: string,
  mlSignal: string,
  rlSignal: string,
  weights: Record<string, number>
): number

// Quality filtering
async filterByQuality(
  signals: AggregatedSignal[],
  minQuality: number = 65
): Promise<AggregatedSignal[]>
```

---

## DATA STRUCTURES

### Core Signal Interfaces

```typescript
// ============================================================================
// BASE SIGNAL STRUCTURE
// ============================================================================

export interface SignalMetrics {
  id: string;
  symbol: string;
  type: string;                    // BUY, SELL, HOLD
  strength: number;                // 0-100 score
  confidence: number;              // 0-1 probability
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  price: number;                   // Entry price
  timestamp: Date;
  reasoning: Record<string, any>;  // Why signal was generated
}

// ============================================================================
// QUALITY SCORE
// ============================================================================

export interface QualityScore {
  overallScore: number;            // 0-100
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'filtered';
  reasons: string[];
  components: {
    convergence: number;           // Agreement between sources
    historicalAccuracy: number;    // Pattern win rate
    recency: number;               // Recent performance
    marketAlignment: number;       // Trend/consolidation fit
  };
}

// ============================================================================
// AGGREGATED SIGNAL (FINAL OUTPUT)
// ============================================================================

export interface AggregatedSignal {
  // Identification
  id: string;
  symbol: string;
  timestamp: Date;
  price: number;

  // Signal Content
  type: 'BUY' | 'SELL' | 'HOLD';
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: number;                // 0-100
  confidence: number;              // 0-1

  // Source Information
  contributions: StrategyContribution[];  // Weight per source
  agreementScore: number;          // % of sources aligned
  primarySources: string[];        // Which sources led

  // Regime Context
  regime: {
    type: 'TRENDING' | 'SIDEWAYS' | 'VOLATILE' | 'BREAKOUT' | 'REVERSAL';
    trendStrength: number;
    volatility: number;
    characteristics: string[];
  };

  // Classification
  classifications: string[];       // Pattern types detected
  primaryPattern: string;
  patternDetails: PatternDetail[];

  // Trading Specifics
  tradingTargets: {
    stopLoss: number;
    takeProfit1: number;
    takeProfit2?: number;
    takeProfit3?: number;
    riskReward: number;
  };

  tradeClassification: {
    type: 'SCALP' | 'DAY' | 'SWING' | 'POSITION';
    holdingPeriodHours: number;
    profitTargetPercent: number;
    stopLossPercent: number;
    pyramidStrategy: string;
  };

  // Metadata
  reasoning: string[];
  timeframeAlignment: number;      // Multi-TF confirmation
  positionSize?: number;
}

// ============================================================================
// PATTERN DETAIL
// ============================================================================

export interface PatternDetail {
  pattern: string;
  accuracy: number;                // Historical win rate
  levels: {
    name: string;
    value: number;
  }[];
  strength: number;                // 0-100
  description: string;
}

// ============================================================================
// TRADE CLASSIFICATION
// ============================================================================

export interface TradeClassification {
  type: 'SCALP' | 'DAY' | 'SWING' | 'POSITION';
  holdingPeriodHours: number;
  profitTargetPercent: number;
  stopLossPercent: number;
  pyramidStrategy: 'all-at-once' | 'pyramid-3' | 'pyramid-5';
  timeframePreference: string[];
  adxThreshold: number;
  volatilityAdjustment: number;
}

// ============================================================================
// REGIME STATE
// ============================================================================

export interface RegimeState {
  type: 'TRENDING' | 'SIDEWAYS' | 'VOLATILE' | 'BREAKOUT' | 'REVERSAL';
  trendStrength: number;           // ADX 0-100
  volatility: number;              // ATR % or IV
  momentum: number;                // Oscillator reading
  confidence: number;              // 0-1 how sure we are
  suggestedOpportunityThreshold: number;  // Minimum quality gate
  characteristics: string[];       // Descriptive attributes
}

// ============================================================================
// CLUSTERING ENHANCED SIGNAL (Advanced)
// ============================================================================

export interface ClusterEnhancedAgentSignal {
  // Original agent signal
  baseSignal: AgentSignal;
  
  // Cluster validation
  clusterValidation: {
    trendForming: boolean;
    formationStrength: number;     // 0-1
    candleConsistency: number;     // 0-1
    volumeConfirmation: boolean;
  };
  
  // Final quality
  finalEntryQuality: number;       // 0-1
  confidence: 'low' | 'moderate' | 'high' | 'very_high';
  entryRecommendation: 'enter' | 'wait' | 'skip';
  sizeMultiplier: number;          // 0.5-2.0x
  
  // Reasoning
  reasoning: string[];
}
```

---

## COMPLETE SIGNAL FLOWS

### Flow 1: Simple BUY Signal (Trending Market)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SCENARIO: BTC trending upward, no major resistance ahead            │
└─────────────────────────────────────────────────────────────────────┘

T+0:00 SCANNER DETECTS
  ├─ Price breaks MA20 above
  ├─ RSI > 50 and rising
  ├─ Volume increases 20%
  ├─ Pattern: BREAKOUT
  ├─ Strength: 72/100
  └─ Confidence: 0.68
      ↓
T+0:01 ML PREDICTS
  ├─ LSTM predicts bullish
  ├─ Momentum features: positive
  ├─ Confidence: 0.65
  └─ Predicted Timeframe: 4-6 hours
      ↓
T+0:02 RL SUGGESTS
  ├─ Policy says: ENTER
  ├─ Action: BUY
  ├─ Suggested size: 0.1 BTC
  └─ Confidence: 0.70
      ↓
T+0:03 REGIME DETECTION
  ├─ Trend strength (ADX): 45
  ├─ Market type: TRENDING
  ├─ Volatility: Normal
  └─ Regime classification: UPTREND
      ↓
T+0:04 REGIME-AWARE WEIGHTING
  ├─ TRENDING regime detected
  ├─ Apply weights:
  │  ├─ Scanner: 35% (0.72 * 0.35 = 0.252)
  │  ├─ ML: 35% (0.65 * 0.35 = 0.228)
  │  └─ RL: 30% (0.70 * 0.30 = 0.210)
  └─ Weighted consensus: 0.69 confidence
      ↓
T+0:05 AGREEMENT SCORING
  ├─ All 3 sources: BUY
  ├─ Agreement score: 100%
  ├─ Minimum required: 55% (for TRENDING)
  └─ Status: ✅ PASSED
      ↓
T+0:06 QUALITY GATING
  Pass 1: Pattern Quality Gate
  ├─ Pattern: BREAKOUT (known edge)
  ├─ Base confidence: 0.68
  ├─ Confluence bonus: +5% (2 patterns)
  ├─ Final: 0.71 > 0.70 (BTC threshold)
  └─ Status: ✅ PASSED
  
  Pass 2: Multi-TF Confirmation
  ├─ 1M chart: ✅ breakout
  ├─ 5M chart: ✅ confirmation
  ├─ 15M chart: ✅ uptrend
  ├─ Bonus: +15% quality
  └─ Status: ✅ PASSED
      ↓
T+0:07 COMPOSITE QUALITY
  ├─ Trend Alignment: 85/100 (breakout + MA)
  ├─ Momentum: 82/100 (RSI + volume)
  ├─ Order Flow: 75/100 (volume rise confirms)
  ├─ Risk/Reward: 78/100 (SL tight, TP clear)
  ├─ Volatility: 70/100 (normal environment)
  └─ Composite: (85×0.25 + 82×0.25 + 75×0.20 + 78×0.20 + 70×0.10) = 79
      ↓
T+0:08 CLASSIFICATION
  ├─ Volatility ratio: 1.0 (normal)
  ├─ ADX: 45 (moderate-strong)
  ├─ Trend state: UPTREND
  └─ Determination: DAY trade
      └─ Holding period: 4-6 hours
      └─ Profit target: 3-5%
      └─ Stop loss: 1.5%
      ↓
T+0:09 POSITION SIZING
  ├─ Base size: 0.1 BTC
  ├─ Quality multiplier: 1.2x (79/65 baseline)
  ├─ Regime bonus: 1.0x (neutral in trends)
  ├─ Final size: 0.12 BTC
  └─ Account risk: 2% (within limit)
      ↓
T+0:10 EXECUTION OPTIMIZATION
  ├─ Entry price: 43,200 (breakout level)
  ├─ Stop loss: 42,550 (below swing low)
  ├─ Take profit 1: 43,650 (0.5R target)
  ├─ Take profit 2: 44,000 (1R target)
  ├─ Risk/Reward: 1:1.8
  └─ Slippage estimate: $15
      ↓
T+0:11 OUTPUT: AGGREGATED SIGNAL
{
  type: 'BUY',
  direction: 'LONG',
  strength: 79,
  confidence: 0.71,
  agreementScore: 100,
  regime: { type: 'TRENDING', trendStrength: 45 },
  classifications: ['BREAKOUT', 'VOLUME_SPIKE'],
  primaryPattern: 'BREAKOUT',
  tradingTargets: {
    stopLoss: 42550,
    takeProfit1: 43650,
    takeProfit2: 44000,
    riskReward: 1.8
  },
  tradeClassification: {
    type: 'DAY',
    holdingPeriodHours: 4,
    profitTargetPercent: 3.5,
    stopLossPercent: 1.5
  },
  reasoning: [
    'Breakout above MA20 confirmed',
    'Volume surge validates',
    'RSI > 50 in uptrend',
    'All 3 sources agree: BUY'
  ],
  timestamp: '2025-12-18T10:00:00Z'
}
      ↓
T+0:12 STORAGE
  ├─ Archive to signal history
  ├─ Track for outcome measurement
  ├─ Update pattern win rate
  └─ Monitor until closed
```

### Flow 2: FILTERED Signal (Conflicting Sources)

```
┌──────────────────────────────────────────────────────────────┐
│ SCENARIO: Mixed signals in sideways market (consolidation)  │
└──────────────────────────────────────────────────────────────┘

T+0:00 SCANNER DETECTS
  ├─ Price at resistance: 43,500
  ├─ RSI = 70 (overbought)
  ├─ Volume declining
  ├─ Signal: RESISTANCE_BREAK (potential)
  ├─ Strength: 62/100
  └─ Confidence: 0.58 (weak)
      ↓
T+0:01 ML PREDICTS
  ├─ Bollinger bands: price at upper
  ├─ ML model: consolidation likely
  ├─ Signal: HOLD
  ├─ Confidence: 0.55
  └─ Note: High uncertainty
      ↓
T+0:02 RL SUGGESTS
  ├─ Policy: avoid (volatility too high)
  ├─ Action: HOLD
  └─ Confidence: 0.60
      ↓
T+0:03 REGIME DETECTION
  ├─ ADX: 28 (weak trend)
  ├─ BB width: narrow
  ├─ ATR: declining
  ├─ Type: SIDEWAYS
  └─ Classification: CONSOLIDATION
      ↓
T+0:04 REGIME-AWARE WEIGHTING
  ├─ SIDEWAYS regime
  ├─ Apply weights:
  │  ├─ Scanner: 40% (0.58 * 0.40 = 0.232)
  │  ├─ ML: 25% (0.55 * 0.25 = 0.138)
  │  └─ RL: 35% (0.60 * 0.35 = 0.210)
  └─ Weighted: 0.58 confidence
      ↓
T+0:05 AGREEMENT SCORING
  ├─ Scanner: BUY (resistance break)
  ├─ ML: HOLD (consolidation)
  ├─ RL: HOLD (volatility)
  ├─ Agreement: 67% (2/3 agree on HOLD)
  ├─ Minimum required: 60% (for SIDEWAYS)
  └─ Status: ✅ BARELY PASSED (but mixed signals)
      ↓
T+0:06 QUALITY GATING - PATTERN GATE
  ├─ Pattern: RESISTANCE_BREAK
  ├─ Base confidence: 0.58
  ├─ Pattern history: 48% win rate (underperforming)
  ├─ Divergence penalty: -15% (sources disagree)
  ├─ Final: (0.58 - 0.15) * 0.85 = 0.37
  ├─ Threshold (BTC): 0.70
  └─ Status: ❌ FAILED PATTERN GATE
      ↓
T+0:07 FILTERING DECISION
  ├─ Reason: Weak pattern + source disagreement
  ├─ Quality too low: 0.37 < 0.70
  ├─ Rejection: FILTERED_LOW_QUALITY
  └─ Action: DO NOT TRADE
      ↓
T+0:08 OUTPUT: FILTERED
{
  status: 'FILTERED',
  reason: 'Insufficient quality - conflicting sources + weak pattern',
  originalSignal: {
    type: 'BUY',
    strength: 62,
    confidence: 0.58,
    agreementScore: 67
  },
  rejectionReasons: [
    'Pattern gate failed (0.37 < 0.70 threshold)',
    'Sources disagree (2/3 on HOLD)',
    'RESISTANCE_BREAK has 48% historical win rate',
    'Divergence detected: Scanner bullish, ML/RL cautious'
  ],
  waitingFor: [
    'Clear breakout with volume',
    'ML model to confirm bullish',
    'RSI to reset below 70'
  ]
}
      ↓
T+0:09 TRACKING
  ├─ Record rejection for analysis
  ├─ Monitor for breaking conditions
  ├─ Update pattern accuracy stats
  └─ Alert user to watch for confirmation
```

### Flow 3: ENHANCED Signal (With Clustering Validation)

```
┌────────────────────────────────────────────────────────┐
│ Highest confidence signals passed through clustering  │
└────────────────────────────────────────────────────────┘

Base Signal: BUY, Strength: 78, Confidence: 0.75
   ↓
Clustering Validator:
├─ Trend formation check
│  ├─ Recent candles show consistency
│  ├─ Higher highs + higher lows established
│  ├─ Formation strength: 0.85/1.0
│  └─ ✅ Trend is FORMING
│
├─ Candle consistency
│  ├─ Last 3 candles: bullish direction
│  ├─ Consistency score: 0.8/1.0
│  └─ ✅ Consistent pattern
│
├─ Volume confirmation
│  ├─ Volume > 20-day avg
│  ├─ Volume supports breakout
│  └─ ✅ Volume CONFIRMED
│
└─ Final Cluster Quality
   ├─ Cluster quality score: 0.85
   ├─ Final entry quality: 0.75 * 0.85 = 0.64
   ├─ Confidence level: HIGH
   ├─ Entry recommendation: ENTER
   ├─ Size multiplier: 1.3x (confidence boost)
   └─ ✅ ENHANCED SIGNAL

OUTPUT:
{
  baseSignal: { strength: 78, confidence: 0.75 },
  clusterValidation: {
    trendForming: true,
    formationStrength: 0.85,
    candleConsistency: 0.80,
    volumeConfirmation: true
  },
  finalEntryQuality: 0.64,
  confidence: 'high',
  entryRecommendation: 'enter',
  sizeMultiplier: 1.3,
  reasoning: [
    'Base signal quality confirmed by cluster',
    'Trend formation is strong (0.85)',
    'Candle consistency validates (0.80)',
    'Volume supports the move',
    'Size multiplier 1.3x due to high validation'
  ]
}
```

---

## QUALITY SCORING SYSTEM

### Component Breakdown

```
COMPOSITE QUALITY SCORE = 
  (Trend Alignment × 0.25) +
  (Momentum Quality × 0.25) +
  (Order Flow Quality × 0.20) +
  (Risk/Reward Validation × 0.20) +
  (Volatility Adjustment × 0.10)

──────────────────────────────────────────────────────────

1. TREND ALIGNMENT (25% weight)
   ├─ Checks: Is entry aligned with primary trend?
   ├─ Scoring:
   │  ├─ Strong uptrend + LONG entry: 95-100
   │  ├─ Weak uptrend + LONG entry: 70-80
   │  ├─ Sideways + any entry: 40-60
   │  └─ Against trend: 0-30
   └─ Data from: ADX, EMAs, trend lines

2. MOMENTUM QUALITY (25% weight)
   ├─ Checks: Is momentum confirming the signal?
   ├─ Scoring:
   │  ├─ RSI extreme + MACD agreeing: 95-100
   │  ├─ RSI 40-60 + oscillator supporting: 60-80
   │  ├─ RSI conflicting with MACD: 30-50
   │  └─ Weak/divergent momentum: 0-30
   └─ Data from: RSI, MACD, Stochastic

3. ORDER FLOW QUALITY (20% weight)
   ├─ Checks: Does volume/flow support the move?
   ├─ Scoring:
   │  ├─ Volume spike + OBV rising: 90-100
   │  ├─ Volume average + OBV supporting: 70-85
   │  ├─ Low volume with signal: 40-60
   │  └─ Volume declining on signal: 0-30
   └─ Data from: Volume, OBV, CMF, VWAP

4. RISK/REWARD VALIDATION (20% weight)
   ├─ Checks: Is the trade setup reasonable?
   ├─ Scoring:
   │  ├─ R/R > 2:1 + clean levels: 95-100
   │  ├─ R/R 1.5-2:1 + reasonable levels: 80-90
   │  ├─ R/R 1:1 + questionable levels: 50-70
   │  └─ R/R < 1:1 or no clear levels: 0-40
   └─ Data from: Support/Resistance, ATR

5. VOLATILITY ADJUSTMENT (10% weight)
   ├─ Checks: Is volatility favorable?
   ├─ Scoring (adaptive):
   │  ├─ Stable volatility + setup: +10%
   │  ├─ Normal volatility: no adjustment
   │  ├─ High volatility (but not extreme): -5%
   │  └─ Extreme volatility: -15%
   └─ Data from: ATR%, Bollinger Band width

──────────────────────────────────────────────────────────

HISTORICAL FACTORS APPLIED:

Pattern Win Rate Multiplier:
├─ Excellent pattern (>65% WR): × 1.15
├─ Good pattern (55-65% WR): × 1.05
├─ Average pattern (50-55% WR): × 1.0
├─ Weak pattern (<50% WR): × 0.85

Convergence Bonus:
├─ 3+ patterns detected: +10%
├─ 2 patterns detected: +5%
├─ 1 pattern: no bonus

Divergence Penalty:
├─ Sources strongly disagree: -15%
├─ Conflicting timeframes: -10%
├─ Price vs indicator divergence: -5%

Multi-Timeframe Bonus:
├─ All timeframes aligned: +15%
├─ 2 TF aligned: +10%
├─ Single TF only: no bonus

──────────────────────────────────────────────────────────

FINAL RATING SCALE:
├─ 85-100: EXCELLENT  (Strong buy/sell)
├─ 70-84:  GOOD       (Solid setup)
├─ 55-69:  FAIR       (Viable but weaker)
├─ 40-54:  POOR       (Questionable)
└─ 0-39:   FILTERED   (Do not trade)
```

---

## INTEGRATION POINTS

### API Endpoints

```
// Scanner Signal API
POST /api/scanner/signal
  Generate signal from technical patterns
  Input: Symbol, timeframe
  Output: ScannerOutput

// ML Signal API
POST /api/ml/signal
  Get ML predictions
  Input: Symbol, features
  Output: MLPrediction[]

// Aggregated Signal API
POST /api/signals/aggregate
  Get unified signal
  Input: Symbol, marketData, scannerOutput, mlPredictions, rlDecision
  Output: AggregatedSignal

// Quality Analysis API
POST /api/signals/analyze-quality
  Score signal quality
  Input: Signals
  Output: QualityScore[]

// Composite Quality API
POST /api/composite-quality/analyze
  Full composite quality
  Input: MarketData, direction
  Output: CompositeQualityMetrics

// Consolidation API
POST /api/signals/consolidate
  Get best signal per symbol
  Input: Signals[]
  Output: Map<symbol, { signal, quality }>

// Ranking API
POST /api/signals/rank
  Rank signals by quality
  Input: Signals[]
  Output: Ranked signals with quality

// Clustering API
POST /api/clustering/validate
  Cluster-enhanced validation
  Input: Signal, cluster metrics
  Output: ClusterEnhancedSignal
```

### Database Storage

```
Signals Table:
├─ id (UUID)
├─ symbol (string)
├─ type (BUY/SELL/HOLD)
├─ strength (0-100)
├─ confidence (0-1)
├─ timestamp
├─ reasoning (JSON)
├─ classifications (string[])
├─ patternDetails (JSON)
├─ regimeState (string)
├─ momentumLabel (string)
├─ timeframeAlignment (number)
├─ agreementScore (number)
├─ signalStrengthScore (number)
├─ positionSize (number)
└─ outcome (WIN/LOSS/OPEN)

Signal Archive:
├─ id
├─ symbol
├─ type
├─ strength, confidence
├─ price, stopLoss, takeProfit
├─ riskReward
├─ timestamp
├─ outcome

Performance Stats:
├─ pattern_type
├─ win_rate
├─ avg_r_multiple
├─ sample_size
└─ last_updated
```

### Dashboard Components

- **Agent Signal Insights Page**: Shows all 13 agents with signals
- **Scanner Results**: Live pattern detection
- **ML Predictions**: Current model forecasts
- **Quality Display**: Visual quality scoring
- **Clustering Validation**: Formation strength indicators
- **Trade Opportunity List**: Ranked by composite quality

---

## NEXT STEPS

1. **Implement Signal Unification Engine** - Route all sources through aggregator
2. **Enhance Quality Gating** - Add more validation rules
3. **Build Clustering Integration** - Validate signals with formation strength
4. **Create Dashboard** - Visualize all signal components
5. **Establish Feedback Loop** - Track outcomes → improve weights
6. **Add A/B Testing** - Test different weighting schemes
7. **Multi-Timeframe** - Confirm signals across TF hierarchy

---

Generated: 2025-12-18
Scanstream Complete Signal System Mapping v1.0
