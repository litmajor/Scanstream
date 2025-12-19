# Data Sources - Quick Reference & Setup

## 🎯 TL;DR: What to Use

| Use Case | Data Source | API Key | Max History | Timeframes |
|----------|------------|---------|------------|-----------|
| Stock backtest (5-7y) | **Yahoo Finance** | ❌ None | 20+ years | 1d, 1w, 1mo |
| Crypto backtest (5-7y) | **Polygon.io** | ✅ Paid tier | 5-10 years | 1m-1d |
| Crypto backtest (free) | **CoinGecko** | ❌ None | 5+ years | 1d only |
| Real-time + backtest | **CCXT** (Binance) | ⚠️ Optional | 1-5 years | 1m-1d |
| Already have data? | **Local SQLite** | ❌ None | Whatever loaded | Any |

---

## 📦 What's Already Installed & Working

### ✅ Yahoo Finance (yfinance)
```typescript
// Already installed and ready to use
// Location: server/trading-engine.ts:74-116

// Supports:
- EURUSD (forex)
- EURUSD, GBPUSD, USDJPY, etc.
- AAPL, MSFT, etc. (stocks)
- BTC=F, GOLD (commodities)

// How to fetch:
import { ExchangeDataFeed } from '../trading-engine';
const feed = await ExchangeDataFeed.create();
const data = await feed.fetchMarketData('EURUSD', '1d', 2000);
// Returns: 2000 daily bars = ~5.5 years

// Limits: NONE (free, unlimited)
// Rate limit: ~1000 calls/hour
```

---

### ✅ CCXT (Multiple Exchanges)
```typescript
// Already installed: npm list ccxt
// Location: server/trading-engine.ts

// Supported exchanges by default:
- Binance (default, most liquid)
- Coinbase
- Kraken
- FTX
- Huobi
- And 100+ more

// How to fetch:
const feed = await ExchangeDataFeed.create();
const btcData = await feed.fetchMarketData('BTC/USDT', '1d', 1000);
// Returns: 1000 daily bars = ~2.7 years

// No setup needed for free tier
// Limits: varies by exchange (Binance: 1200 req/min)
```

---

### ✅ CoinGecko (Free)
```typescript
// Already integrated as fallback
// Location: server/routes/symbols.ts:234-280

// Supports: ALL cryptocurrencies
// History: 5+ years daily data
// Rate limit: 10-50 calls/min (free tier)
// Cost: FREE

// Integrated in:
- Trading terminal chart data
- Scanner fallback data
- Symbol lookup

// How to use (automatic):
// trading-terminal.tsx line 1019
if (coinGeckoChartData && coinGeckoChartData.length > 0) {
  return coinGeckoChartData; // Already loaded
}
```

---

### ⚙️ Polygon.io (Requires API Key)
```typescript
// Location: server/services/asset-velocity-profile.ts:1-100

// Setup:
// 1. Get API key from polygon.io/dashboard
// 2. Add to .env: POLYGON_API_KEY=pk_live_xxx

// Features:
- Crypto, Stocks, Forex, Commodities
- 5-20 years history
- 1m to 1mo timeframes
- ~0.5-2 second latency

// How to fetch:
const profile = await assetVelocityProfiler.getVelocityProfileLive(
  'BTC/USDT',
  730  // 2 years of data
);
// Returns: velocity metrics + full OHLCV data

// Pricing: Free tier (500 requests/day) or paid
// Rate limit: 5 requests/minute (free)
```

---

## 🚀 How to Load 5-7 Years of Data

### Option 1: Yahoo Finance (Fastest, No Setup)
```bash
# Already works! Just call:
curl http://localhost:5000/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "ma-crossover",
    "symbol": "EURUSD",
    "timeframe": "1d",
    "startDate": "2017-01-01",
    "endDate": "2024-12-19",
    "initialCapital": 10000
  }'
```

### Option 2: CCXT Binance (Crypto, No Setup)
```bash
curl http://localhost:5000/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "ma-crossover",
    "symbol": "BTC/USDT",
    "timeframe": "1d",
    "startDate": "2019-12-19",
    "endDate": "2024-12-19",
    "initialCapital": 10000
  }'
```

### Option 3: Load Via Phase 6 UI
1. Navigate to: `/backtest`
2. Select Strategy
3. Select Symbol (e.g., BTC/USDT or EURUSD)
4. Set Timeframe: **1d** (for 5-7 years)
5. Start Date: **7 years ago** (system will fetch)
6. End Date: **Today**
7. Click: "Run Backtest"
8. Wait for data to load...
9. View results in "📊 Results" tab

---

## 📊 Data Source Priority Chain

When you run a backtest, Scanstream automatically tries:

```
1. Local SQLite Database (fastest)
   ↓ (if not found)
2. Polygon.io API (if POLYGON_API_KEY set)
   ↓ (if not available)
3. CCXT Exchange (Binance for crypto)
   ↓ (if not available)
4. Yahoo Finance / yfinance (forex, stocks)
   ↓ (if all else fails)
5. Generate Mock Data (for testing)
```

---

## 🔧 Configuration Files

### To add Polygon.io API key:
```bash
# File: .env
POLYGON_API_KEY=pk_live_your_key_here
```

### To add API keys for CCXT:
```typescript
// File: server/trading-engine.ts around line 1070
const exchange = new ccxt[exchangeName]({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET,
  enableRateLimit: true
});
```

### To pre-seed SQLite database:
```typescript
// File: server/routes/data-seeding.ts
// Uses internal data generator to seed historical data
// Already integrated - runs automatically on startup
```

---

## 📈 Example: Load 7 Years BTC Data

```typescript
// Direct API call
const response = await fetch('/api/backtest/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    strategyId: 'momentum',
    symbol: 'BTC/USDT',
    timeframe: '1d',
    startDate: '2017-12-19',  // 7 years ago
    endDate: '2024-12-19',
    initialCapital: 10000,
    advancedParams: {
      slippage: 0.001,
      commission: 0.001,
      maxDrawdown: -0.20,
      riskPerTrade: 0.02
    }
  })
});

// Response includes:
{
  id: 'backtest-xxx',
  symbol: 'BTC/USDT',
  totalReturn: 2485.5,           // 2,485% return
  sharpeRatio: 1.87,
  maxDrawdown: -0.42,
  winRate: 0.58,
  totalTrades: 247,
  equityCurve: [{timestamp, value}, ...],  // 2555 points (7 years)
  trades: [{...}, ...],           // Trade-by-trade results
  metrics: { ... }
}
```

---

## ⚡ Performance Tips

| Task | Recommended | Why |
|------|------------|-----|
| Quick test | 6 months data | 130 candles, runs in <1s |
| Medium backtest | 2 years data | 730 candles, runs in 2-5s |
| Full historical | 5-7 years data | 1825-2555 candles, runs in 10-30s |
| Real-time fetch | Daily timeframe | Reduces API calls |
| Multi-asset test | Use Batch mode | Phase 6C feature |

---

## 🆘 Troubleshooting

### "No data returned"
```
1. Check startDate is earlier than endDate
2. Verify symbol format: "BTC/USDT" or "EURUSD" (exchange-specific)
3. Try a shorter period first (6 months)
4. Check API key in .env if using Polygon
5. Fall back to CCXT: it always has some data
```

### "Requests are slow"
```
1. Reduce timeframe request (try '1h' instead of '1m')
2. Reduce data range (try 1 year instead of 7)
3. Use local database if data already loaded
4. Enable caching in .env: CACHE_RESPONSES=true
```

### "API rate limit hit"
```
1. Wait 5-10 minutes for rate limit reset
2. Use a different data source (fallback chain handles this)
3. Consider paid tier of Polygon.io ($1000/month)
4. Use local SQLite database for frequently tested data
```

---

## 📞 Status Check

To verify which data sources are available:
```bash
# Check configuration
curl http://localhost:5000/api/gateway/health

# Should show available sources:
{
  "status": "healthy",
  "sources": {
    "ccxt": "ready",           ✅
    "yfinance": "ready",       ✅
    "coingecko": "ready",      ✅
    "polygon": "not configured" (optional)
  }
}
```

---

## 📌 Recommended Setup for 5-7 Year Backtests

### Minimum (Free)
✅ Yahoo Finance + CoinGecko + CCXT  
= Unlimited historical data, no setup

### Recommended (Small Cost)
✅ + Polygon.io free tier ($0)  
= Better data quality, same unlimited

### Professional (Optional)
✅ + Polygon.io paid ($129-$489/month)  
= Intraday data (1m-15m), fastest queries

---

## 🎓 Next: Walk Forward Validation (Phase 6G)

Once historical data is loaded:
1. Split data into: train (70%) + test (30%)
2. Train ensemble on historical data
3. Validate on out-of-sample period
4. Measure overfitting via metrics
5. Adjust parameters to reduce overfitting

When ready for Phase 6G, all data infrastructure is ready!
