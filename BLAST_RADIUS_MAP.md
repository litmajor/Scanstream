# 🎯 CCXT → Execution Blast Radius Map

## Complete Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MARKET DATA SOURCES                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    ╔═══════════════════════════════════╗
                    ║      🔗 CCXT EXCHANGES            ║
                    ║  ├─ Binance                       ║
                    ║  ├─ KuCoin (Futures)              ║
                    ║  ├─ OKX                           ║
                    ║  ├─ Bybit                         ║
                    ║  ├─ Kraken                        ║
                    ║  └─ Coinbase                      ║
                    ║  (+ YahooFinance for Forex)       ║
                    ╚═══════════════════════════════════╝
                                    ▼
                    ┌───────────────────────────────┐
                    │   ExchangeDataFeed (CCXT)     │
                    │  (trading-engine.ts:L73+)     │
                    │  (live-trading-engine.ts:L2)  │
                    │                               │
                    │  ├─ fetchMarketData()         │
                    │  ├─ fetchTicker()             │
                    │  └─ fetchOHLCV()              │
                    └───────────────────────────────┘
                                    ▼
```

---

## 🔄 PRIMARY PATHS: Who Calls CCXT?

### Path 1️⃣ : Gateway → Scanner → Storage
```
┌──────────────────────────────────────┐
│  routes/gateway.ts                   │
│  GET /api/gateway/ohlcv/:symbol      │
│  GET /api/gateway/dataframe/:symbol  │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  ExchangeAggregator                  │
│  (exchange-aggregator.ts)            │
│                                      │
│  ├─ getAggregatedPrice()             │
│  ├─ getAggregatedOHLCV()             │
│  └─ getMarketFrames(symbol)          │
│     Parallel fetch from all          │
│     healthy exchanges with caching   │
└──────────────────────────────────────┘
         │
         ├──────────────────┬────────────────┐
         ▼                  ▼                ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ CCXTScanner  │  │Signal        │  │Prices        │
   │              │  │Pipeline      │  │Service       │
   └──────────────┘  └──────────────┘  └──────────────┘
         │
         │  Line 137: await storage.createMarketFrame()
         ▼
    ┌─────────────────────────────────────┐
    │  📦 DB/STORAGE                      │
    │  (db-storage.ts / storage.ts)       │
    │                                     │
    │  SimpleFallbackStorage (in-memory)  │
    │  OR PostgreSQL via Prisma           │
    └─────────────────────────────────────┘
         │
         │  Stored: symbol, timeframe, ohlcv, indicators, metadata
         │
         ▼
```

### Path 2️⃣ : Trading Engine → Market Data Fetching
```
┌──────────────────────────────────────┐
│  trading-engine.ts                   │
│  TradingEngine class                 │
│  fetchMarketData()                   │
│  Line 1150-1200                      │
└──────────────────────────────────────┘
         │
         ├─────────────────────────────┐
         │  For each symbol:           │
         │  ├─ fetch OHLCV via CCXT    │
         │  ├─ calculate indicators    │
         │  └─ create MarketFrame      │
         │
         │  Line 1185: await storage.createMarketFrame()
         ▼
    ┌─────────────────────────────────────┐
    │  📦 STORAGE                         │
    │  MarketFrame{                       │
    │    symbol, timeframe, timestamp,    │
    │    ohlcv, volume, indicators,       │
    │    orderFlow, microstructure,       │
    │    volatility, momentum, etc        │
    │  }                                  │
    └─────────────────────────────────────┘
         │
         ▼
```

### Path 3️⃣ : Live Trading Engine (Execution)
```
┌────────────────────────────────────┐
│  live-trading-engine.ts            │
│  LiveTradingEngine class           │
│                                    │
│  ├─ initialize()                   │
│  │  └─ ccxt[exchange]()            │
│  │     ├─ API keys from .env       │
│  │     ├─ Testnet/Live mode        │
│  │     └─ loadMarkets()            │
│  │                                 │
│  ├─ executeSignal(signal)          │
│  │  └─ createOrder()               │
│  │                                 │
│  ├─ updatePositions()              │
│  │  └─ fetchOpenOrders()           │
│  │  └─ fetchPosition()             │
│  │                                 │
│  └─ checkOrders()                  │
│     └─ Monitor via Monitor loop    │
└────────────────────────────────────┘
         │
         ├─ LIVE on: Binance, KuCoin, OKX, Bybit
         ├─ TESTNET on: Same exchanges (sandbox: true)
         │
         ▼
    ┌─────────────────────────────┐
    │  CCXT Order Execution       │
    │  ├─ Market Orders           │
    │  ├─ Limit Orders            │
    │  ├─ Stop Loss Orders        │
    │  └─ Take Profit Orders      │
    └─────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │  DB STORAGE                 │
    │  Trades {                   │
    │    symbol, side, quantity,  │
    │    entryPrice, status,      │
    │    pnl, timestamp           │
    │  }                          │
    └─────────────────────────────┘
```

---

## 🎯 WHO TRUSTS THE CANDLES?

### Direct Consumers of storage.getMarketFrames():

```
┌─────────────────────────────────────────────────────────┐
│              AGENTS READING FROM STORAGE                │
└─────────────────────────────────────────────────────────┘

1. 📊 ML Signals Agent (routes/ml-signals.ts:L29)
   ├─ storage.getMarketFrames(symbol, 200)
   ├─ Trains ensemble models (LSTM, GRU, Linear)
   └─ Returns confidence scores for BUY/SELL/HOLD

2. 🎲 RL Agent (routes/rl-signals.ts:L27)
   ├─ storage.getMarketFrames(symbol, 50)
   ├─ Q-learning on stored frames
   └─ Returns policy actions

3. 🔬 Physics Agents (routes/physics-agents.ts)
   ├─ VFMD Agent (L53): storage.getMarketFrames(symbol, 200)
   │  └─ Vector force momentum divergence
   ├─ FLOW Agent (L142): storage.getMarketFrames(symbol, 200)
   │  └─ Pressure/force field analysis
   └─ Both perform physics-based signal generation

4. 🎮 RPG Market Oracle (services/rpg-agents/MarketOracle.ts:L101)
   ├─ aggregator.getMarketFrames(symbol, '1m', 100)
   ├─ Clustering-based pattern recognition
   └─ Reward/penalty scoring

5. 📈 ML Model Trainer (services/ml-model-trainer.ts:L52)
   ├─ storage.getMarketFrames()
   ├─ Trains models on historical data
   └─ Saves models to disk

6. 🔍 Strategy Engine (routes/strategies.ts:L700+)
   ├─ executeStrategy(id, symbol, timeframe)
   ├─ Queries frames for strategy execution
   └─ Returns trade signals

7. 📊 Signal Pipeline (services/gateway/signal-pipeline.ts:L36)
   ├─ aggregator.getMarketFrames()
   ├─ Prepares signals for client broadcast
   └─ WebSocket delivery to frontend

8. 🎯 Gateway Analysis (routes.ts:L1330)
   ├─ storage.getMarketFrames(symbol, 50)
   ├─ Real-time chart data
   └─ Returns to /api/chart-data/:symbol

9. 🚨 Signal Performance Tracker (services/signal-performance-tracker.ts)
   ├─ Compares stored signals vs. actual price movement
   └─ Calculates win rates, accuracy metrics
```

---

## 🚀 WHO TRADES ON THEM?

### Execution Paths (BLAST RADIUS):

```
┌──────────────────────────────────────────────────────────┐
│          EXECUTION LAYER (WHO ACTS ON CANDLES)           │
└──────────────────────────────────────────────────────────┘

Agent Signal → Decision Layer → Execution Layer → CCXT Orders
    ▼              ▼                  ▼              ▼

[ ML Signal ]  → Confidence > 0.7? → LiveTradingEngine.executeSignal()
               ↓
[ RL Signal ]  → Q-Value > Threshold? → createOrder(symbol, side, amount, price)
               ↓
[ Physics ]    → Force > Threshold? → CCXT.createMarketOrder()
               ↓                     → CCXT.createLimitOrder()
[ Strategy ]   → Rule Match? → CCXT.createStopOrder()
               ↓               → CCXT.createStopLimitOrder()
[ Manual ]     → Trader Click → 
                ↓
            ┌──────────────────────────────┐
            │  LiveTradingEngine           │
            │  ├─ executeSignal()          │
            │  ├─ placeOrder()             │
            │  ├─ modifyOrder()            │
            │  └─ cancelOrder()            │
            └──────────────────────────────┘
                     ▼
            ┌──────────────────────────────┐
            │  CCXT Exchange Interface     │
            │  (Binance/KuCoin/OKX/etc)    │
            │  ├─ Real Mode: LIVE ORDERS   │
            │  └─ Test Mode: SANDBOX       │
            └──────────────────────────────┘
                     ▼
            ┌──────────────────────────────┐
            │  Order Execution             │
            │  ├─ Order ID returned        │
            │  ├─ Status tracked           │
            │  └─ Fills monitored          │
            └──────────────────────────────┘
                     ▼
            ┌──────────────────────────────┐
            │  Position Management         │
            │  ├─ updatePositions()        │
            │  ├─ calculatePnL()           │
            │  ├─ updateStopLoss()         │
            │  └─ updateTakeProfit()       │
            └──────────────────────────────┘
                     ▼
            ┌──────────────────────────────┐
            │  Broadcast Results           │
            │  ├─ WebSocket signals        │
            │  ├─ Store trades in DB       │
            │  └─ Calculate performance    │
            └──────────────────────────────┘
```

---

## 🌐 COMPLETE DATA FLOW DIAGRAM

```
EXCHANGE LAYER
──────────────

    Binance ─────┐
    KuCoin ──────┤
    OKX ─────────┼─→ CCXT fetchOHLCV()
    Bybit ───────┤   │
    Kraken ──────┤   │
    Coinbase ────┘   │
                     │
                     ▼
GATEWAY LAYER
──────────────
                ┌──────────────────────┐
                │ ExchangeAggregator   │─→ Parallel Fetch
                │ ├─ Cache             │   ├─ Best Price
                │ ├─ Rate Limit        │   ├─ Confidence
                │ └─ Health Monitor    │   └─ Deviation Alert
                └──────────────────────┘
                     │
     ┌───────────────┼───────────────┬─────────────┐
     ▼               ▼               ▼             ▼
  Gateway      CCXTScanner     TradingEngine   LiveTrading
  Routes       (Analysis)      (Indicators)    (Execution)
     │               │             │              │
     │               │             │              │
     └───────────────┼─────────────┴──────────────┘
                     │
STORAGE LAYER
──────────────
                ┌──────────────────────┐
                │  storage.create      │
                │  MarketFrame()       │
                │                      │
                │  └─ In-Memory        │
                │  OR PostgreSQL       │
                └──────────────────────┘
                        │
        ┌───────────────┼───────────────┬────────────────┬─────────────┐
        ▼               ▼               ▼                ▼             ▼
      ML Signals    RL Signals     Physics Agents  Strategies      Backtesting
      (L:ml-       (L:rl-         (L:physics-     (L:strategies)  (L:routes)
       signals)     signals)        agents)
        │               │               │                │             │
        │               │               │                │             │
        └───────────────┼───────────────┴────────────────┴─────────────┘
                        │
                        ▼
ANALYSIS & CONSENSUS LAYER
──────────────────────────
                ┌──────────────────────────┐
                │ Agent Signal Insights    │
                │ (routes/agent-signal-    │
                │  insights.ts)            │
                │                          │
                │ ├─ Fetch from all agents │
                │ ├─ Calculate consensus   │
                │ └─ Confidence weighting  │
                └──────────────────────────┘
                        │
                        ▼
DECISION & EXECUTION LAYER
──────────────────────────
                ┌──────────────────────────┐
                │ Signal Filter            │
                │ ├─ Min Confidence: 50%   │
                │ ├─ Min Agreement: 3/13   │
                │ └─ Signal Type: BUY/SELL │
                └──────────────────────────┘
                        │
                        ▼
                ┌──────────────────────────┐
                │ LiveTradingEngine        │
                │ ├─ executeSignal()       │
                │ ├─ placeOrder()          │
                │ ├─ updatePositions()     │
                │ └─ monitorLoop (5s)      │
                └──────────────────────────┘
                        │
                        ▼
                ┌──────────────────────────┐
                │ CCXT Order Placement     │
                │ ├─ Market Orders         │
                │ ├─ Limit Orders          │
                │ ├─ Stop Orders           │
                │ └─ Stop-Limit Orders     │
                └──────────────────────────┘
                        │
EXECUTION
──────────
                        ▼
                ┌──────────────────────────┐
                │ LIVE TRADING             │
                │ (Binance/KuCoin/OKX...)  │
                │ OR SANDBOX TESTING       │
                └──────────────────────────┘
                        │
                        ▼
                ┌──────────────────────────┐
                │ Order Status Monitoring  │
                │ ├─ Pending               │
                │ ├─ Open                  │
                │ ├─ Filled                │
                │ ├─ Closed                │
                │ └─ Rejected/Expired      │
                └──────────────────────────┘
                        │
                        ▼
                ┌──────────────────────────┐
                │ Position & P&L Tracking  │
                │ ├─ Entry Price           │
                │ ├─ Current Price         │
                │ ├─ P&L %                 │
                │ ├─ Stop Loss             │
                │ └─ Take Profit           │
                └──────────────────────────┘
                        │
                        ▼
                ┌──────────────────────────┐
                │ DB Storage               │
                │ └─ Trade Record          │
                │    └─ Signal Performance │
                └──────────────────────────┘
```

---

## 💥 BLAST RADIUS ANALYSIS

### If CCXT becomes unavailable:
```
IMPACT SEVERITY: 🔴 CRITICAL

❌ Gateway Routes stop serving data
   └─ /api/gateway/ohlcv/* → 404
   └─ /api/gateway/dataframe/* → 404
   
❌ Candles stop being stored
   └─ Storage.getMarketFrames() returns stale data
   
❌ All agents wait on empty market data
   └─ ML: No training data
   └─ RL: No state observations
   └─ Physics: No vector calculations
   └─ Strategies: No execution signals
   
⚠️  Fallback: Uses cached data (expires every ~5-10 min)

✅ MITIGATIONS IN PLACE:
   • Cache layer with 5-10 min TTL
   • In-memory SimpleFallbackStorage
   • Graceful error handling
   • Circuit breaker pattern
```

### If Storage becomes unavailable:
```
IMPACT SEVERITY: 🟠 HIGH

❌ Agents can't read historical data
   └─ ML: Can't train models
   └─ RL: Can't learn patterns
   
⚠️  Execution: May proceed if using real-time signals only
   └─ LiveTradingEngine still works if signals come from cache

✅ MITIGATIONS:
   • In-memory fallback storage
   • Caching layer prevents immediate failure
   • Graceful degradation (returns empty instead of crash)
```

### If LiveTradingEngine fails:
```
IMPACT SEVERITY: 🟢 MEDIUM

⚠️  No live orders placed
   ✓ Dashboard still shows signals
   ✓ Paper trading still runs
   ✓ Backtesting still works
   
✅ Can restart engine and resume
```

---

## 📋 KEY FILES & RESPONSIBILITIES

| File | Role | CCXT Dependency |
|------|------|-----------------|
| `trading-engine.ts` | Data fetch, indicator calc | HIGH |
| `live-trading-engine.ts` | Order execution | HIGH |
| `exchange-aggregator.ts` | Multi-exchange aggregation | HIGH |
| `ccxt-scanner.ts` | Pattern scanning | HIGH |
| `db-storage.ts` | Data persistence | MEDIUM |
| `storage.ts` | Storage abstraction | MEDIUM |
| `ml-signals.ts` | ML model predictions | LOW (reads from storage) |
| `rl-signals.ts` | RL agent decisions | LOW (reads from storage) |
| `physics-agents.ts` | Physics simulations | LOW (reads from storage) |
| `strategies.ts` | Strategy execution | LOW (reads from storage) |
| `gateway.ts` | API routes | HIGH |

---

## 🔗 CRITICAL DEPENDENCY CHAIN

```
CCXT Exchanges
    │
    ├─→ ExchangeDataFeed (trading-engine.ts)
    │   │
    │   ├─→ ExchangeAggregator
    │   │   │
    │   │   ├─→ Gateway Routes (/api/gateway/*)
    │   │   │
    │   │   └─→ CCXTScanner
    │   │
    │   └─→ TradingEngine.fetchMarketData()
    │
    └─→ LiveTradingEngine (live-trading-engine.ts)
        │
        └─→ CCXT Order Placement
            │
            └─→ Position Tracking
```

---

## ✅ SUMMARY: Data Trust Chain

```
CCXT Exchanges
    ↓
    storage.createMarketFrame()
    ↓
    [Candles in DB/Memory]
    ↓
    Agents read via storage.getMarketFrames()
    ↓
    Agent Signals + Confidence
    ↓
    13-Agent Consensus Calculator
    ↓
    Filter: Confidence ≥ 50%, Agreement ≥ 3/13
    ↓
    LiveTradingEngine.executeSignal()
    ↓
    CCXT.createOrder()
    ↓
    LIVE TRADING
```

---

## 🎯 ANSWER TO YOUR QUESTIONS

1. **Where does CCXT live?**
   - `trading-engine.ts` (ExchangeDataFeed class)
   - `live-trading-engine.ts` (LiveTradingEngine class)

2. **Who calls it?**
   - ExchangeAggregator (for data fetching)
   - TradingEngine (for market data)
   - LiveTradingEngine (for order execution)
   - CCXTScanner (for analysis)

3. **Where are candles stored?**
   - PostgreSQL via Prisma (if DB running)
   - SimpleFallbackStorage (in-memory fallback)
   - CacheManager (5-10 minute TTL)

4. **Who trusts them?**
   - ML Signals Agent
   - RL Agent
   - Physics Agents (VFMD, FLOW)
   - Strategies Engine
   - Signal Pipeline
   - Backtesting

5. **Who trades on them?**
   - LiveTradingEngine
   - Manual orders via dashboard
   - All execution paths funnel through CCXT

**FINAL FLOW:**
```
CCXT → ExchangeAggregator → storage.createMarketFrame() → DB/Memory 
     → agents.getMarketFrames() → signals → consensus → LiveTradingEngine 
     → CCXT.createOrder() → LIVE TRADING
```
