# Scanstream Visual System Architecture

## System Component Diagram

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                            SCANSTREAM ECOSYSTEM                               ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL DATA SOURCES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐│
│  │   Binance    │  │   Coinbase   │  │    Kraken    │  │  Other Exchanges ││
│  │   (Spot)     │  │   (Spot)     │  │   (Futures)  │  │  (25+ via CCXT)  ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────────┐│
│  │   CoinGecko  │  │ Polygon APIs │  │  Blockchain APIs (chain-specific)    ││
│  └──────────────┘  └──────────────┘  └──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Raw Market Data
                                    │ (OHLCV, orderbook, trades)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LAYER 1: DATA GATEWAY & AGGREGATION                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  CCXT Multi-Exchange Adapter                                        │  │
│  │  ├─ Unified symbol normalization (BTC/USDT → btcusdt)             │  │
│  │  ├─ Multi-exchange price aggregation                               │  │
│  │  ├─ Order book depth fetching                                      │  │
│  │  └─ Market microstructure collection                               │  │
│  └─────────────────┬───────────────────────────────────────────────────┘  │
│                    │                                                       │
│  ┌─────────────────▼───────────────────────────────────────────────────┐  │
│  │  CrossExchangeAggregator                                            │  │
│  │  ├─ Weighted average pricing                                        │  │
│  │  ├─ Volume aggregation across exchanges                             │  │
│  │  ├─ Liquidity scoring                                               │  │
│  │  └─ Missing candle detection & interpolation                        │  │
│  └─────────────────┬───────────────────────────────────────────────────┘  │
│                    │                                                       │
│  ┌─────────────────▼───────────────────────────────────────────────────┐  │
│  │  Market Data Cache (TTL: 1-5 seconds)                               │  │
│  │  ├─ Latest candles (1m, 5m, 1h, 1d, 1w)                             │  │
│  │  ├─ Order book snapshots                                            │  │
│  │  ├─ Technical indicators (pre-computed)                             │  │
│  │  └─ Market metadata (liquidity, volatility)                         │  │
│  └─────────────────┬───────────────────────────────────────────────────┘  │
│                    │                                                       │
└────────────────────┼──────────────────────────────────────────────────────┘
                     │
                     │ MarketFrame[]
                     │ {symbol, price, volume, ohlc, microstructure}
                     │
    ┌────────────────┼────────────────┬──────────────────────┐
    │                │                │                      │
    ▼                ▼                ▼                      ▼
┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────────┐
│ LAYER 2     │  │ LAYER 3      │  │ LAYER 3B   │  │ LAYER 3C       │
│ SCANNER     │  │ ML ENGINE    │  │ RL ENGINE  │  │ REGIME DETECTOR│
└────┬────────┘  └──────┬───────┘  └──────┬─────┘  └────────┬───────┘
     │                  │                 │                 │


┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: TECHNICAL PATTERN SCANNER                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Input: MarketFrame with OHLCV + Volume + Order Flow                     │
│                                     │                                       │
│    ┌──────────────────────────────────────────────────────────────┐        │
│    │ Multi-Timeframe Pattern Detection (1m, 5m, 1h, 1d, 1w)      │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ 28+ Pattern Detectors                                       │        │
│    ├─ Breakout (simple, pullback, false)                         │        │
│    ├─ Reversal (support bounce, resistance break)                │        │
│    ├─ Continuation (trend setup, accumulation)                   │        │
│    ├─ Indicator-based (RSI, MACD, MA crossovers)                 │        │
│    ├─ Volume (spike, divergence)                                 │        │
│    ├─ Order Flow (imbalance, directional bias)                   │        │
│    ├─ Flow Field (directional accumulation)                      │        │
│    └─ Confluence (multiple confirmations)                        │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Confidence Scoring Engine                                   │        │
│    ├─ Per-pattern base confidence                                │        │
│    ├─ Echo/confluence boost                                      │        │
│    ├─ Volume confirmation weighting                              │        │
│    └─ Technical indicator alignment                              │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    Output: ScannerOutput {                                                │
│      patterns: [                                                         │
│        {type: "BREAKOUT", confidence: 0.82, strength: 82},              │
│        {type: "VOLUME_SPIKE", confidence: 0.75, strength: 78},          │
│        {type: "MA_CROSSOVER", confidence: 0.68, strength: 65}           │
│      ],                                                                  │
│      technicalScore: 0-100,                                             │
│      volumeScore: 0-100                                                 │
│    }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3A: ML INTELLIGENCE ENGINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Input: 1-year historical data + Current MarketFrame                     │
│                                     │                                       │
│    ┌──────────────────────────────────────────────────────────────┐        │
│    │ Feature Engineering Pipeline                                │        │
│    ├─ Technical Indicators                                       │        │
│    │  ├─ RSI, MACD, Bollinger Bands                              │        │
│    │  ├─ Moving Averages (SMA, EMA)                              │        │
│    │  ├─ ATR, CCI, Stochastic                                    │        │
│    │  └─ Custom indicators (Flow Field, Order Flow)              │        │
│    ├─ Market Microstructure Features                             │        │
│    │  ├─ Bid/Ask spread                                          │        │
│    │  ├─ Volume profile                                          │        │
│    │  ├─ Order flow imbalance                                    │        │
│    │  └─ Liquidity metrics                                       │        │
│    ├─ Temporal Features                                          │        │
│    │  ├─ Time of day patterns                                    │        │
│    │  ├─ Day of week effects                                     │        │
│    │  └─ Seasonality patterns                                    │        │
│    └─ Ensemble Features                                          │        │
│       └─ Previous prediction features                            │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Multi-Model Prediction Ensemble                             │        │
│    │                                                              │        │
│    ├─ Model 1: LSTM (Long Short-Term Memory)                    │        │
│    │  ├─ Trained on 1-year time series data                     │        │
│    │  ├─ Multi-timeframe sequence input                          │        │
│    │  ├─ State preservation across sequences                     │        │
│    │  └─ Output: direction probability + confidence              │        │
│    │                                                             │        │
│    ├─ Model 2: Transformer (Attention-based)                    │        │
│    │  ├─ Parallel processing architecture                        │        │
│    │  ├─ Cross-timeframe attention mechanisms                    │        │
│    │  ├─ Fast inference (<100ms)                                 │        │
│    │  └─ Output: direction probability + confidence              │        │
│    │                                                             │        │
│    ├─ Model 3: Hybrid (Ensemble voting)                         │        │
│    │  ├─ Combines predictions from LSTM & Transformer            │        │
│    │  ├─ Weighted by recent performance                          │        │
│    │  └─ Output: final direction + ensemble confidence           │        │
│    │                                                             │        │
│    └─ Model Drift Detection                                      │        │
│       ├─ Out-of-sample performance tracking                      │        │
│       ├─ Automatic retraining triggers (daily/weekly)            │        │
│       └─ Fallback to previous model if not improved              │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Multi-Timeframe Prediction Consolidation                    │        │
│    │ Generates predictions for 1m, 5m, 1h, 1d                    │        │
│    │ Then creates MTF confirmation matrix                         │        │
│    └─────────────────────────┬──────────────────────────────────┘        │
│                              │                                             │
│    Output: MLPrediction {                                                 │
│      direction: "BUY" | "SELL" | "HOLD",                                 │
│      probability: 0.78,                                                   │
│      models: { lstm: 0.75, transformer: 0.81, ensemble: 0.78 },          │
│      timeframeVotes: {                                                    │
│        "1m": "BUY" (0.72), "5m": "BUY" (0.74),                           │
│        "1h": "BUY" (0.85), "1d": "HOLD" (0.68)                           │
│      },                                                                   │
│      mtfAlignment: 0.75                                                  │
│    }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3B: RL DECISION ENGINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Input: Market state (price, indicators, positions, portfolio)           │
│                                     │                                       │
│    ┌──────────────────────────────────────────────────────────────┐        │
│    │ State Representation                                         │        │
│    ├─ Current position (size, entry price, P&L)                  │        │
│    ├─ Market state (price, momentum, volatility)                 │        │
│    ├─ Portfolio state (equity, margin used, heat)                │        │
│    ├─ Recent history (last 10 candles of data)                   │        │
│    └─ Regime indication (trend, consolidation, risk)             │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Deep Q-Network (DQN) Agent                                   │        │
│    │                                                              │        │
│    ├─ Input layer: State vector (50+ dimensions)                 │        │
│    ├─ Hidden layers: 3-4 dense layers with ReLU                  │        │
│    ├─ Output layer: Q-values for each action                     │        │
│    ├─ Epsilon-greedy exploration                                 │        │
│    └─ Experience replay memory for stability                     │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Action Selection                                             │        │
│    ├─ Action space: {BUY, SELL, HOLD, increase, decrease}       │        │
│    ├─ Position sizing: 0-1.0 (% of capital)                      │        │
│    ├─ Stop placement: relative to price                           │        │
│    └─ Take profit targets: multiple levels                        │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Reward Calculation                                           │        │
│    ├─ Base: +1 if profitable trade, -1 if loss                   │        │
│    ├─ Adjustments                                                 │        │
│    │  ├─ Risk-adjusted: reward / max_drawdown                     │        │
│    │  ├─ Time-adjusted: decay for holding too long                │        │
│    │  ├─ Consistency bonus: streak of profitable trades           │        │
│    │  └─ Sharp ratio reward: risk-adjusted returns                │        │
│    └─────────────────────────┬──────────────────────────────────┘        │
│                              │                                             │
│    Output: RLDecision {                                                   │
│      action: "BUY" | "SELL" | "HOLD",                                    │
│      positionSize: 0.02,                                                 │
│      confidence: 0.72,                                                   │
│      adjustedQValue: 0.65,                                               │
│      recommendedStop: 44980,                                             │
│      takeProfit: [45580, 46230, 47000],                                  │
│      episodeStats: {                                                     │
│        avgReward: 42.5,                                                  │
│        winRate: 0.62,                                                    │
│        sharpeRatio: 1.4                                                  │
│      }                                                                   │
│    }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3C: REGIME DETECTION ENGINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Input: 100+ candles of historical data                                  │
│                                     │                                       │
│    ┌──────────────────────────────────────────────────────────────┐        │
│    │ Statistical Analysis                                         │        │
│    ├─ Return volatility (standard deviation)                     │        │
│    ├─ Skewness and kurtosis of returns                           │        │
│    ├─ Autocorrelation patterns                                   │        │
│    └─ Drawdown sequence analysis                                 │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Hidden Markov Model (HMM)                                    │        │
│    ├─ 4-5 hidden states: Trend, Consolidation, Volatility, Risk  │        │
│    ├─ Trained on historical regime sequences                     │        │
│    ├─ Emits state probabilities                                  │        │
│    └─ Viterbi algorithm for most likely path                     │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Regime Identification                                        │        │
│    │                                                              │        │
│    ├─ STRONG_UPTREND (prob>0.7, returns>0.5%)                    │        │
│    ├─ STRONG_DOWNTREND (prob>0.7, returns<-0.5%)                 │        │
│    ├─ CONSOLIDATION (volatility <0.3%, sideways)                 │        │
│    ├─ VOLATILITY_SPIKE (volatility >1.5%)                        │        │
│    ├─ TRANSITIONAL (prob 0.4-0.6, regime uncertainty)            │        │
│    └─ CHOPPY (high noise, unclear direction)                     │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    ┌────────────────────────▼─────────────────────────────────────┐        │
│    │ Regime-Specific Parameter Adjustment                         │        │
│    │                                                              │        │
│    ├─ UPTREND regime → Aggressive entry, wide stops              │        │
│    ├─ DOWNTREND regime → Conservative entry, tight stops         │        │
│    ├─ CONSOLIDATION → Breakout focus, mean reversion            │        │
│    ├─ VOLATILITY → Reduced size, wider stops                     │        │
│    └─ TRANSITIONAL → Wait for confirmation                       │        │
│    └────────────────────────┬─────────────────────────────────────┘        │
│                             │                                              │
│    Output: RegimeDetection {                                              │
│      current: "STRONG_UPTREND",                                           │
│      probability: 0.82,                                                  │
│      confidenceLevel: "high",                                            │
│      transitionProbability: 0.12,                                         │
│      topAltRegime: "CONSOLIDATION",                                       │
│      thresholds: {                                                       │
│        entryBias: "aggressive",                                           │
│        stopPlacement: "wide_20pips",                                      │
│        targetAdjustment: 1.5x_normal                                      │
│      }                                                                   │
│    }                                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘


        Scanner        ML Engine       RL Engine       Regime Detector
         Output        Output          Output           Output
           │              │              │                   │
           └──────────────┼──────────────┼───────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 LAYER 4: SIGNAL QUALITY & AGGREGATION ENGINE                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌────────────────────────────────────────────────────────────────┐      │
│    │ Signal Collection & Normalization                              │      │
│    │ ├─ Scanner: Direction + Pattern confidence                     │      │
│    │ ├─ ML: Direction + Probability + Confidence                    │      │
│    │ ├─ RL: Action + Position size + QValue                         │      │
│    │ ├─ Regime: Condition + Threshold adjustments                   │      │
│    │ └─ Additional: Volume, OrderFlow, ATR confirmations            │      │
│    └────────────────┬─────────────────────────────────────────────────┘      │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Historical Accuracy Database                                     │     │
│    │ ├─ Win rate per pattern type (learned over time)               │     │
│    │ ├─ Win rate per ML model type                                  │     │
│    │ ├─ Regime-specific accuracy adjustments                         │     │
│    │ └─ Recency weighting (recent patterns more reliable)            │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Confidence Adjustment Engine                                    │     │
│    │ ├─ Apply historical accuracy boost/penalty                     │     │
│    │ ├─ Confluence bonus (multiple signals agree)                   │     │
│    │ ├─ Volume confirmation weighting                               │     │
│    │ ├─ Multi-timeframe alignment scoring                           │     │
│    │ ├─ Risk/reward ratio evaluation                                │     │
│    │ └─ Model conflict resolution                                    │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Bayesian Belief Updating                                        │     │
│    │ ├─ Prior belief: historical pattern accuracy                   │     │
│    │ ├─ Likelihood: current signal strength                          │     │
│    │ ├─ Posterior: updated confidence after all signals              │     │
│    │ └─ Evidence tracking: validate against actual outcomes          │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Quality Rating Assignment                                       │     │
│    │ ├─ Excellent (85-100): Multiple sources, high consensus         │     │
│    │ ├─ Good (70-84): Solid signal with moderate support             │     │
│    │ ├─ Fair (55-69): Mixed signals, use with caution                │     │
│    │ └─ Poor (<55): Weak signal, consider waiting                    │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    Output: FinalSignal {                                                   │
│      symbol: "BTC/USDT",                                                   │
│      timestamp: 1234567890,                                                │
│      direction: "BUY",                                                     │
│      qualityRating: "Good",                                                │
│      overallConfidence: 0.745,                                             │
│      sourceBreakdown: {                                                    │
│        scanner: { weight: 0.20, contribution: 0.75 },                     │
│        mlEnsemble: { weight: 0.30, contribution: 0.78 },                  │
│        rl: { weight: 0.20, contribution: 0.72 },                          │
│        volumeConfirm: { weight: 0.15, contribution: 0.80 },               │
│        orderFlow: { weight: 0.15, contribution: 0.65 }                    │
│      },                                                                   │
│      mtfAlignment: {                                                     │
│        "1m": { direction: "BUY", prob: 0.72 },                            │
│        "5m": { direction: "BUY", prob: 0.75 },                            │
│        "1h": { direction: "BUY", prob: 0.88 },                            │
│        "1d": { direction: "HOLD", prob: 0.65 }                            │
│      },                                                                   │
│      regimeContext: "STRONG_UPTREND (82% prob)",                          │
│      reasonForDecision: "Confluence of 4 signals in alignment"             │
│    }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  LAYER 5: RISK MANAGEMENT ENGINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌────────────────────────────────────────────────────────────────┐      │
│    │ Position Sizing Calculator                                     │      │
│    │ ├─ Kelly Criterion: f* = (bp - q) / b                        │      │
│    │ │  (optimal fraction of capital to risk)                      │      │
│    │ ├─ Fractional Kelly: Use 0.25x Kelly for safety              │      │
│    │ ├─ Risk % allocation: Max 2% risk per trade                   │      │
│    │ ├─ Account heat management: Max 5-10% heat                    │      │
│    │ ├─ Maximum position size: 5-10% per symbol                    │      │
│    │ └─ Dynamic adjustment based on recent performance             │      │
│    └────────────────┬─────────────────────────────────────────────────┘      │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Entry Price & Stop Loss Determination                           │     │
│    │ ├─ Entry: Aggregate of Scanner + RL + regime suggestions        │     │
│    │ ├─ Stop Loss Placement:                                         │     │
│    │ │  ├─ Technical (support/resistance levels)                     │     │
│    │ │  ├─ Volatility-based (ATR * 2-3)                             │     │
│    │ │  ├─ Time-based (adaptive decay from entry)                   │     │
│    │ │  ├─ Microstructure-aware (order flow extremes)               │     │
│    │ │  └─ Physics-based (momentum decay)                           │     │
│    │ └─ Ensure: Risk % = (entry - stop) / position_size             │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Take Profit Targets Generation                                  │     │
│    │ ├─ Multi-level targets (50% / 30% / 20% of position)            │     │
│    │ ├─ TP1 (50%): 1x risk (1:1 R:R)                                 │     │
│    │ ├─ TP2 (30%): 2.5x risk (1:2.5 R:R)                             │     │
│    │ ├─ TP3 (20%): 4-5x risk (1:4-5 R:R)                             │     │
│    │ ├─ Breakeven stop: Move to entry after TP1 hit                 │     │
│    │ └─ Trailing stop: Follow price after TP1                        │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    ┌────────────────▼─────────────────────────────────────────────────┐     │
│    │ Portfolio Risk Checks                                           │     │
│    │ ├─ Current drawdown vs max allowed (10%)                        │     │
│    │ ├─ Daily loss limit ($500)                                     │     │
│    │ ├─ Correlation with existing positions                          │     │
│    │ ├─ Total portfolio heat (max 15%)                               │     │
│    │ └─ Margin usage (leverage cap at 2x)                            │     │
│    └────────────────┬─────────────────────────────────────────────────┘     │
│                     │                                                       │
│    Output: RiskManagementSignal {                                          │
│      symbol: "BTC/USDT",                                                   │
│      positionSize: 0.02,                                                  │
│      positionCost: 904.60,                                                │
│      percentOfAccount: 0.02,                                              │
│      riskPercent: 2.0,                                                    │
│      entry: 45230,                                                        │
│      stopLoss: 44980,                                                     │
│      stopDistance: 250,                                                   │
│      riskAmount: 18.09,                                                   │
│      takeProfit: [                                                        │
│        { level: 1, price: 45580, size: 0.01, reward: 350 },             │
│        { level: 2, price: 46230, size: 0.006, reward: 1200 },           │
│        { level: 3, price: 47000, size: 0.004, reward: 1900 }            │
│      ],                                                                   │
│      riskRewardRatio: "1:3.5",                                            │
│      recommendedHoldingPeriod: "4-8 hours",                              │
│      portfolioRiskCheck: {                                                │
│        currentDrawdown: 3.2,                                              │
│        remainingCapital: 18.0,                                            │
│        correlationWarning: false,                                         │
│        marginUsage: 0.04                                                  │
│      },                                                                   │
│      approvalStatus: "APPROVED - Ready to execute"                        │
│    }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 6: EXECUTION ENGINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────┐         │
│    │ Execution Mode Router                                       │         │
│    ├─ Paper Trading (simulation, no real capital)               │         │
│    ├─ Live Trading (real exchange execution)                    │         │
│    └─ Backtesting (historical replay)                           │         │
│    └──────────┬──────────────────────────────────────────────────┘         │
│               │                                                             │
│    ┌──────────┴──────────┐                                                 │
│    │                     │                                                 │
│    ▼                     ▼                                                 │
│ ┌─────────────┐    ┌──────────────┐                                       │
│ │Live Trading │    │Paper Trading │                                       │
│ └─────────────┘    └──────────────┘                                       │
│      │                   │                                                 │
│    ┌─┴─────────────────────┴──────────────────────────────────────┐       │
│    │ Order Execution                                              │       │
│    ├─ Entry Order                                                 │       │
│    │  ├─ Limit order placement                                   │       │
│    │  ├─ Wait for partial fills                                  │       │
│    │  ├─ Slippage calculation                                    │       │
│    │  └─ Average fill price computation                          │       │
│    ├─ Stop Loss & Take Profit Setup                              │       │
│    │  ├─ Create OCO (One Cancels Other) order                   │       │
│    │  ├─ Stop loss level enforcement                             │       │
│    │  └─ Take profit multi-leg execution                         │       │
│    └────────────────┬──────────────────────────────────────────┘       │
│                     │                                                   │
│    ┌────────────────▼──────────────────────────────────────────┐       │
│    │ Position Management                                        │       │
│    │ ├─ Real-time P&L tracking                                 │       │
│    │ ├─ Stop loss movement (trailing, breakeven)               │       │
│    │ ├─ Take profit adjustment                                  │       │
│    │ ├─ Partial close on milestones                            │       │
│    │ └─ Emergency stop on margin/loss limit                    │       │
│    └────────────────┬──────────────────────────────────────────┘       │
│                     │                                                   │
│    ┌────────────────▼──────────────────────────────────────────┐       │
│    │ Trade Closure & Post-Analysis                              │       │
│    │ ├─ Final P&L calculation                                   │       │
│    │ ├─ Trade duration & efficiency                             │       │
│    │ ├─ Signal accuracy assessment                              │       │
│    │ ├─ Fee impact analysis                                     │       │
│    │ └─ Data storage for future model training                  │       │
│    └────────────────┬──────────────────────────────────────────┘       │
│                     │                                                   │
└─────────────────────┼───────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 7: USER INTERFACE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  React 18 + TypeScript Frontend                                             │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ Dashboard                        │  │ Signals Page                    │ │
│  │ ├─ Portfolio overview            │  │ ├─ Signal list (all symbols)    │ │
│  │ ├─ P&L tracking (daily/monthly)  │  │ ├─ Quality rating display       │ │
│  │ ├─ Signal heatmap                │  │ ├─ Source breakdown chart       │ │
│  │ └─ Asset allocation pie chart    │  │ ├─ Multi-timeframe matrix       │ │
│  └──────────────────────────────────┘  │ └─ Real-time update streaming   │ │
│                                        └─────────────────────────────────┘ │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ Trading Terminal                 │  │ Analytics Dashboard             │ │
│  │ ├─ Technical chart (candles)     │  │ ├─ Win rate metrics             │ │
│  │ ├─ Order book visualization      │  │ ├─ Drawdown analysis            │ │
│  │ ├─ Order placement interface     │  │ ├─ Risk metrics                 │ │
│  │ └─ Position management controls  │  │ └─ Equity curve                 │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ Backtester                       │  │ Strategy Manager                │ │
│  │ ├─ Parameter configuration       │  │ ├─ Strategy creation            │ │
│  │ ├─ Historical performance        │  │ ├─ Live vs backtest comparison  │ │
│  │ ├─ Equity curve plotting         │  │ ├─ Parameter tuning             │ │
│  │ └─ Trade statistics table        │  │ └─ Deployment controls          │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  State Management: TanStack Query (React Query)                             │
│  ├─ Server state caching & synchronization                                 │
│  ├─ Background refetching                                                  │
│  ├─ Optimistic updates for UX                                              │
│  └─ Automatic retry on failure                                             │
│                                                                              │
│  Real-Time Updates: WebSocket Bridge                                        │
│  ├─ Live price ticks                                                       │
│  ├─ Signal generation notifications                                        │
│  ├─ Trade execution confirmations                                          │
│  └─ Portfolio update broadcasts                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAYER 8: DATA PERSISTENCE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PostgreSQL Database (Neon Serverless)                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │ Core Tables                                                      │      │
│  ├─ market_frames: OHLCV data + indicators (timestamped)           │      │
│  ├─ signals: Generated signals + metadata (searchable)             │      │
│  ├─ trades: Executed trades + P&L (historical archive)             │      │
│  ├─ strategies: Strategy configurations + parameters               │      │
│  ├─ backtest_results: Performance analytics                        │      │
│  ├─ model_metadata: ML model versions + performance                │      │
│  ├─ signal_archive: Historical signal tracking                     │      │
│  └─ user_settings: Preferences & configurations                    │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ORM: Drizzle                                                               │
│  ├─ Type-safe schema definition                                     │      │
│  ├─ Query builder with inference                                    │      │
│  ├─ Migrations management                                           │      │
│  └─ Automatic schema validation                                     │      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════

COMPLETE DATA FLOW CYCLE
═══════════════════════════════════════════════════════════════════════════════

    Start (Every market tick or on-demand)
            │
            ▼
    ┌─ Market Data Gateway
    │  └─ Fetch latest candles from 25+ exchanges
    │     └─ Aggregate across exchanges
    │        └─ Cache candle data
    │
    ├─ Technical Scanner
    │  └─ Run 28+ pattern detectors
    │     └─ Calculate technical score
    │        └─ Volume confirmation
    │
    ├─ ML Engine
    │  └─ LSTM prediction (1m, 5m, 1h, 1d)
    │     └─ Transformer prediction
    │        └─ Ensemble voting
    │
    ├─ RL Engine
    │  └─ State representation
    │     └─ Q-network forward pass
    │        └─ Action selection with confidence
    │
    ├─ Regime Detector
    │  └─ Statistical regime analysis
    │     └─ HMM state probability
    │        └─ Threshold adjustments
    │
    ├─ Quality Engine
    │  └─ Combine all signals
    │     └─ Historical accuracy boost
    │        └─ Bayesian update
    │           └─ Quality rating assignment
    │
    ├─ Risk Management
    │  └─ Position sizing calculation
    │     └─ Entry/stop/TP determination
    │        └─ Portfolio risk check
    │
    ├─ Execution
    │  └─ Order placement
    │     └─ Fill monitoring
    │        └─ P&L tracking
    │
    ├─ UI Update
    │  └─ WebSocket signal broadcast
    │     └─ Component re-render
    │        └─ Real-time chart update
    │
    └─ Database Storage
       └─ Signal archival
          └─ Trade recording
             └─ Model retraining check

```

## System Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT ENVIRONMENT                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Local Machine                                                   │
│  ├─ Frontend: Vite dev server (http://localhost:5173)           │
│  ├─ Backend: Node.js server (http://localhost:3000)             │
│  ├─ Database: PostgreSQL local or Neon cloud                    │
│  └─ Python: ML/RL training scripts (optional local GPU)          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   PRODUCTION ENVIRONMENT                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Docker Container (deployed on cloud platform)                  │
│  ├─ Frontend Assets                                             │
│  │  └─ Vite bundle (static files)                               │
│  ├─ Express.js Server                                           │
│  │  ├─ REST API endpoints                                       │
│  │  ├─ WebSocket server                                         │
│  │  └─ Signal processing routes                                 │
│  ├─ PostgreSQL Connection                                       │
│  │  └─ Neon serverless driver                                   │
│  └─ Environment Variables                                       │
│     ├─ API keys (exchanges, CoinGecko)                          │
│     ├─ Database connection string                               │
│     ├─ ML model paths                                           │
│     └─ Configuration overrides                                  │
│                                                                  │
│  Load Balancer (for scaling)                                    │
│  ├─ Distribute traffic across multiple container instances      │
│  ├─ Health check endpoints                                      │
│  └─ Auto-scaling triggers                                       │
│                                                                  │
│  External Services                                              │
│  ├─ Neon Database (PostgreSQL serverless)                       │
│  ├─ Exchange APIs (CCXT)                                        │
│  ├─ CoinGecko API                                               │
│  └─ Optional: Redis cache, TimescaleDB                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
