# Historical Data Sources & Loading Guide

## Overview
Scanstream supports loading historical market data from **multiple sources** with support for **up to 5-7 years** of data depending on the source.

---

## 📊 Available Data Sources (Priority Order)

### 1. **Polygon.io** ⭐ (Recommended for Stocks/Crypto)
**Status**: Integrated  
**Type**: Real-time + Historical OHLCV  
**Supported**: Crypto, Stocks, Forex  
**Historical Depth**: 5-20 years (depending on asset)  
**Timeframes**: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1mo  

**Location**: `server/services/asset-velocity-profile.ts`
```typescript
// Automatic fallback to Polygon.io if available
// Used for live velocity calculations
const profile = await assetVelocityProfiler.getVelocityProfileLive(
  'BTC/USDT',
  lookbackDays: 730  // 2 years
);
```

**Advantages**:
- Very deep historical data (5+ years)
- High data quality
- Low latency for live data
- Supports multiple asset classes

---

### 2. **Yahoo Finance (yfinance)** ✅ (Best for Forex)
**Status**: Integrated  
**Type**: Historical OHLCV  
**Supported**: Forex pairs, Stocks, Commodities  
**Historical Depth**: 10-20 years  
**Timeframes**: 1d, 1wk, 1mo  

**Location**: `server/trading-engine.ts` (lines 74-116)
```typescript
class YFinanceForexAdapter {
  async fetchOHLCV(symbol: string, timeframe = '1d', since?: number, limit = 100)
  // Supports all major forex pairs (EURUSD, GBPUSD, etc.)
}

// Usage in backtest:
const data = await exchangeDataFeed.fetchMarketData('EURUSD', '1d', 2000);
// Gets 2000 daily candles = ~5.5 years of data
```

**Advantages**:
- Free and unlimited
- Very deep historical data
- No API keys needed
- Perfect for backtesting

---

### 3. **CCXT Exchanges** 🔗 (Multi-Exchange Crypto)
**Status**: Integrated  
**Type**: Real-time + Limited Historical  
**Supported**: 
- Binance
- Coinbase
- Kraken
- And 100+ other exchanges

**Historical Depth**: 1-5 years (varies by exchange)  
**Timeframes**: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w  

**Location**: `server/trading-engine.ts` (CCXTMarketDataAdapter)
```typescript
class ExchangeDataFeed {
  async fetchMarketData(
    symbol: string,
    timeframe: string = '1m',
    limit: number = 100,
    exchangeName?: string
  ): Promise<MarketFrame[]>
  
  // Returns OHLCV data from any configured exchange
}
```

**Advantages**:
- Direct exchange data
- Real-time + historical
- Multi-exchange aggregation

---

### 4. **CoinGecko API** 🪙 (Free Crypto)
**Status**: Integrated (Fallback)  
**Type**: Historical price data only  
**Supported**: All cryptocurrencies  
**Historical Depth**: 5+ years (free tier)  
**Timeframes**: 1d only  

**Location**: `server/routes/symbols.ts`
```typescript
async function fetchSymbolFromCoingecko(symbol: string): Promise<any | null> {
  const detailResponse = await axios.get(
    `https://api.coingecko.com/api/v3/coins/${coin.id}`,
    { params: { market_data: true } }
  );
}

// Used as fallback in trading-terminal.tsx for chart data
```

**Advantages**:
- Free (no API key)
- Deep history
- Global cryptocurrency coverage

---

### 5. **Database (SQLite)** 💾 (Local Historical)
**Status**: Integrated  
**Type**: Pre-loaded historical data  
**Supported**: Any symbol with prior seeding  
**Historical Depth**: As much as loaded  
**Timeframes**: Configurable  

**Location**: `server/routes/phase6-unified-backtest.ts` (lines 350-395)
```typescript
async function fetchHistoricalData(
  asset: string,
  startDate: Date,
  endDate: Date,
  timeframe: string
) {
  // 1. Try database first
  const data = database.prepare(
    `SELECT * FROM candles_${asset} 
     WHERE timestamp >= ? AND timestamp <= ?
     ORDER BY timestamp ASC`
  ).all(startDate.getTime(), endDate.getTime());
  
  // 2. Falls back to mock data if not found
}
```

**Location**: `server/types/market-data.ts` (MarketDataAdapter interface)

---

## 📈 Supported Timeframes

| Timeframe | Minutes | Use Case |
|-----------|---------|----------|
| **1m** | 1 | Scalping, high-frequency |
| **5m** | 5 | Day trading |
| **15m** | 15 | Swing trading |
| **30m** | 30 | Short-term analysis |
| **1h** | 60 | Day/swing trading |
| **4h** | 240 | Medium-term |
| **1d** | 1440 | Swing/position trading |
| **1w** | 10080 | Long-term |
| **1mo** | 43200 | Long-term trends |

---

## 🔄 How Historical Data Flows in Backtest

### Backtest Data Pipeline

```
User selects dates + timeframe (Phase 6 UI)
        ↓
   phase6-unified-backtest.ts
        ↓
   fetchHistoricalData() function
        ↓
   ┌──────────────────────────────────┐
   │  1. Check SQLite Database        │
   │  2. Try API sources (Polygon)    │
   │  3. Fallback to yfinance         │
   │  4. Generate mock data           │
   └──────────────────────────────────┘
        ↓
   MarketFrame[] (normalized format)
        ↓
   Signal Pipeline (6-source ensemble)
        ↓
   Backtest Results + Metrics
        ↓
   Save to Database
        ↓
   Display in Phase 6 UI
```

---

## 💡 Load 5-7 Years of Data: Implementation

### Using the Backtest API

```typescript
// Load 7 years of daily data
const startDate = new Date();
startDate.setFullYear(startDate.getFullYear() - 7);
const endDate = new Date();

const backtestRequest = {
  symbol: 'BTC/USDT',
  timeframe: '1d',  // Daily candles
  startDate: startDate.toISOString().split('T')[0],
  endDate: endDate.toISOString().split('T')[0],
  initialCapital: 10000
};

// API call
const response = await fetch('/api/backtest/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(backtestRequest)
});

// Results will include:
// - 2555 daily candles (7 years × 365 days)
// - Full market metrics for period
// - Strategy equity curve
// - Performance statistics
```

### Calculate Data Point Count

| Period | Daily Candles | Hourly Candles | 5-min Candles |
|--------|--------------|----------------|--------------|
| 5 years | 1,825 | 43,800 | 525,600 |
| 6 years | 2,190 | 52,560 | 630,720 |
| 7 years | 2,555 | 61,320 | 735,840 |

---

## 🔑 Configuration by Data Source

### Polygon.io Setup
```typescript
// Location: server/services/asset-velocity-profile.ts
// Requires: POLYGON_API_KEY environment variable
// Automatic: Used by LiveVelocityCalculator
// Feature: Regime-aware velocity (bull/bear/sideways)
```

### Yahoo Finance Setup
```typescript
// Location: server/trading-engine.ts
// No setup required: npm install yahoo-finance2 (already in package)
// Available as: 'yfinance-forex' exchange
// Supports: EURUSD, GBPUSD, USDJPY, and 100+ forex pairs
```

### CCXT Exchanges Setup
```typescript
// Location: server/trading-engine.ts (ExchangeDataFeed)
// Configure in: server/types/gateway.ts
// Supported: Binance, Coinbase, Kraken, etc.
// Default: Binance (most liquid)

class ExchangeDataFeed {
  private exchanges: Map<string, Exchange>;
  // Automatically initialized with multiple exchanges
}
```

### Database Setup
```typescript
// Location: server/routes/phase6-unified-backtest.ts
// Format: SQLite (market_data.db)
// Tables: candles_BTC_USDT, candles_ETH_USDT, etc.
// Schema: timestamp, open, high, low, close, volume
// Query: Uses prepared statements (safe from injection)
```

---

## 📊 Data Source Selection Guide

**Choose based on your needs:**

| Need | Recommended Source | Timeframe | History |
|------|-------------------|-----------|---------|
| Stock backtest | Yahoo Finance | 1d, 1wk, 1mo | 20+ years |
| Crypto backtest | Polygon.io or CCXT | 1h, 4h, 1d | 5-10 years |
| Forex backtest | Yahoo Finance | 1d | 10-20 years |
| Quick test | Local Database | Any | Varies |
| Real-time + history | CCXT exchanges | 1m-1d | 1-5 years |
| No API keys needed | Yahoo Finance + CoinGecko | 1d | 10-20 years |

---

## 🚀 Getting Started: Load Historical Data

### Step 1: Navigate to Backtest Page
```
Home → "Backtesting" (from dashboard)
```

### Step 2: Configure Historical Period
```
Strategy: Select any strategy
Symbol: BTC/USDT (or any asset)
Timeframe: 1d (for 5-7 years, daily is best)
Start Date: 7 years ago
End Date: Today
Initial Capital: $10,000 (or your amount)
```

### Step 3: Run Backtest
Click "Run Backtest" button in Phase 6 UI  
System automatically:
- ✅ Fetches historical data from best available source
- ✅ Calculates all 67 technical indicators
- ✅ Runs signal pipeline (6-source ensemble)
- ✅ Executes backtest simulation
- ✅ Generates performance metrics

### Step 4: View Results
- 📊 Equity curve over 7 years
- 📈 Returns, Sharpe ratio, drawdown
- 📋 Trade-by-trade breakdown
- 🎯 Risk metrics and statistics

---

## 🔍 Advanced: Multi-Timeframe Analysis

```typescript
// Load multiple timeframes simultaneously
const timeframes = ['1h', '4h', '1d'];
const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000); // 2 years
const endDate = new Date();

const analysis = await Promise.all(
  timeframes.map(tf => 
    fetchHistoricalData('BTC/USDT', startDate, endDate, tf)
  )
);

// Returns:
// [hourly_data[], 4h_data[], daily_data[]]
```

---

## ⚠️ Limitations & Considerations

| Aspect | Limitation | Workaround |
|--------|-----------|-----------|
| **Free tier depth** | CoinGecko: 5y, yfinance: varies | Use Polygon.io (paid) |
| **Rate limits** | API calls throttled | Use local database cache |
| **Data gaps** | Weekends, holidays | Handled automatically |
| **Delisted assets** | No historical data | Use similar active pair |
| **Extreme events** | Historic data may skip gaps | Normalized by indicators |

---

## 📝 Summary

✅ **Can load 5-7 years of historical data?** YES  
✅ **Multiple timeframes supported?** YES (1m to 1mo)  
✅ **Multiple data sources?** YES (Polygon, yfinance, CCXT, CoinGecko, Database)  
✅ **Automatic fallback chain?** YES  
✅ **No API keys needed?** YES (Yahoo Finance + CoinGecko)  
✅ **Already integrated in backtest?** YES (Phase 6)  

**Next Steps**:
- Phase 6D Integration: ✅ COMPLETE (ensemble voting, parameter tuning)
- Phase 6G: Walk Forward Validation (you mentioned later)
- Phase 7: Live Trading Integration (when ready)
