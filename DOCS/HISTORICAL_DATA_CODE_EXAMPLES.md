# Historical Data Loading - Code Examples

## 🎯 Copy-Paste Solutions

### Load 7 Years of Daily Data (Crypto)

```typescript
// File: client/src/pages/backtest.tsx
// Add this to run a 7-year backtest via the existing API

const handleLoad7YearBacktest = async () => {
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

  const backtestConfig = {
    strategyId: 'ma-crossover', // or any strategy ID
    symbol: 'BTC/USDT',
    timeframe: '1d',
    startDate: sevenYearsAgo.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    advancedParams: {
      slippage: 0.001,
      commission: 0.001,
      maxDrawdown: -0.20,
      riskPerTrade: 0.02,
      positionSizingMethod: 'fixed',
      positionSize: 1.0,
      dailyLossLimit: -0.05,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      useTrailingStop: true,
      trailingStopPercent: 3,
      maxPositionSize: 3,
      minPositionSize: 0.1
    }
  };

  try {
    const response = await fetch('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backtestConfig)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Backtest complete!', {
      totalReturn: `${result.metrics.totalReturn.toFixed(2)}%`,
      sharpeRatio: result.metrics.sharpeRatio.toFixed(2),
      maxDrawdown: `${result.metrics.maxDrawdown.toFixed(2)}%`,
      trades: result.metrics.totalTrades,
      winRate: `${result.metrics.winRate.toFixed(1)}%`
    });

    return result;
  } catch (error) {
    console.error('❌ Backtest failed:', error);
    throw error;
  }
};
```

---

### Load 7 Years of Daily Data (Forex)

```typescript
// Yahoo Finance - Works for EURUSD, GBPUSD, etc.

const handleLoad7YearForexBacktest = async () => {
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

  const backtestConfig = {
    strategyId: 'range-mean-reversion',
    symbol: 'EURUSD', // Forex pair
    timeframe: '1d',
    startDate: sevenYearsAgo.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 50000,
    advancedParams: {
      slippage: 0.0002, // 2 pips for forex
      commission: 0.00005, // 0.5 pips
      maxDrawdown: -0.15,
      riskPerTrade: 0.01,
      positionSizingMethod: 'fixed',
      positionSize: 1.0,
      dailyLossLimit: -0.03,
      stopLossPercent: 2,
      takeProfitPercent: 5,
      useTrailingStop: false,
      trailingStopPercent: 0,
      maxPositionSize: 2,
      minPositionSize: 0.5
    }
  };

  // Call the existing backtest API
  return fetch('/api/backtest/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backtestConfig)
  }).then(r => r.json());
};
```

---

## 🔄 Data Source Selection Logic

### Backend: How Data is Selected

**File**: `server/routes/phase6-unified-backtest.ts:353-395`

```typescript
async function fetchHistoricalData(
  asset: string,
  startDate: Date,
  endDate: Date,
  timeframe: string
) {
  try {
    // ===== STEP 1: Try Local SQLite Database =====
    const dbPath = 'market_data.db';
    if (require('fs').existsSync(dbPath)) {
      const database = new db(dbPath);
      const table = `candles_${asset.replace('/', '_')}`;
      
      try {
        const data = database.prepare(
          `SELECT * FROM ${table} 
           WHERE timestamp >= ? AND timestamp <= ?
           ORDER BY timestamp ASC`
        ).all(startDate.getTime(), endDate.getTime());
        
        database.close();
        if (data.length > 100) {
          console.log(`✅ Loaded ${data.length} candles from database`);
          return data; // SUCCESS
        }
      } catch (e) {
        console.warn(`⚠️ Database table not found: ${table}`);
      }
    }

    // ===== STEP 2: Try ExchangeDataFeed (CCXT or yfinance) =====
    const feed = await ExchangeDataFeed.create();
    const limit = calculateCandles(startDate, endDate, timeframe);
    
    try {
      const data = await feed.fetchMarketData(asset, timeframe, limit);
      if (data && data.length > 100) {
        console.log(`✅ Loaded ${data.length} candles from API`);
        return data; // SUCCESS
      }
    } catch (apiError) {
      console.warn(`⚠️ API fetch failed:`, apiError);
    }

    // ===== STEP 3: Fallback to Mock Data =====
    console.log(`⚠️ All sources failed, using mock data`);
    return generateMockMarketData(asset, startDate, endDate);
    
  } catch (error) {
    console.error('Error in data fetch:', error);
    return generateMockMarketData(asset, startDate, endDate);
  }
}

// Helper: Calculate how many candles needed
function calculateCandles(start: Date, end: Date, tf: string): number {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  const multipliers: Record<string, number> = {
    '1m': 1440,
    '5m': 288,
    '15m': 96,
    '30m': 48,
    '1h': 24,
    '4h': 6,
    '1d': 1,
    '1w': 1/7,
    '1mo': 1/30
  };
  
  return Math.ceil(diffDays * (multipliers[tf] || 1)) + 100;
}
```

---

## 📊 Directly Fetch from Each Source

### Option 1: Direct CCXT (Binance)

```typescript
// File: server/trading-engine.ts
// Import and use ExchangeDataFeed

import { ExchangeDataFeed } from '../trading-engine';

async function fetchFromCCXT() {
  const feed = await ExchangeDataFeed.create();
  
  // Fetch BTC/USDT daily candles (7 years = ~2555 candles)
  const candles = await feed.fetchMarketData(
    'BTC/USDT',    // symbol
    '1d',          // timeframe
    3000,          // limit (gets ~7 years)
    'binance'      // exchange (optional, default is first)
  );
  
  console.log(`Fetched ${candles.length} candles`);
  
  // Returns: MarketFrame[]
  // [{
  //   symbol: 'BTC/USDT',
  //   timestamp: Date,
  //   price: { open, high, low, close },
  //   volume: number,
  //   indicators: { rsi, macd, ema20, ... }
  // }, ...]
  
  return candles;
}
```

### Option 2: Direct Yahoo Finance (Forex)

```typescript
// File: server/trading-engine.ts
// YFinanceForexAdapter is built-in

import { ExchangeDataFeed } from '../trading-engine';

async function fetchFromYFinance() {
  const feed = await ExchangeDataFeed.create();
  
  // Fetch EURUSD daily candles (7 years)
  const candles = await feed.fetchMarketData(
    'EURUSD',      // symbol
    '1d',          // timeframe: 1d, 1wk, 1mo
    2555,          // 2555 days = 7 years
    'yfinance-forex'  // Use Yahoo Finance adapter
  );
  
  return candles;
  // Works for: EURUSD, GBPUSD, USDJPY, AUDUSD, NZDUSD, CADUS, etc.
}
```

### Option 3: Direct CoinGecko (Crypto)

```typescript
// File: server/routes/symbols.ts (already integrated)

import axios from 'axios';

async function fetchFromCoinGecko(symbol: string) {
  try {
    // Search for coin
    const searchResponse = await axios.get(
      `https://api.coingecko.com/api/v3/search`,
      { params: { query: symbol } }
    );
    
    const coin = searchResponse.data.coins[0];
    
    // Get market data
    const detailResponse = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart`,
      {
        params: {
          vs_currency: 'usd',
          days: 2555,  // 7 years
          interval: 'daily'
        }
      }
    );
    
    const prices = detailResponse.data.prices;
    // Returns: [[timestamp, price], [timestamp, price], ...]
    
    return prices.map((point: any[]) => ({
      timestamp: new Date(point[0]),
      close: point[1]
    }));
    
  } catch (error) {
    console.error('CoinGecko fetch failed:', error);
    return [];
  }
}
```

### Option 4: Direct Polygon.io (Premium)

```typescript
// File: server/services/asset-velocity-profile.ts
// Requires: POLYGON_API_KEY environment variable

import axios from 'axios';

async function fetchFromPolygon(symbol: string, days: number = 2555) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error('POLYGON_API_KEY not set');
  
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/`,
      {
        params: {
          from: getDateDaysAgo(days),
          to: formatDate(new Date()),
          apikey: apiKey
        }
      }
    );
    
    return response.data.results.map((bar: any) => ({
      timestamp: new Date(bar.t),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v
    }));
    
  } catch (error) {
    console.error('Polygon fetch failed:', error);
    return [];
  }
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

### Option 5: Direct Database (SQLite)

```typescript
// File: server/routes/phase6-unified-backtest.ts

import Database from 'better-sqlite3';

function fetchFromDatabase(
  symbol: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const database = new Database('market_data.db');
    const tableName = `candles_${symbol.replace('/', '_')}`;
    
    // Create table if needed
    database.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        timestamp INTEGER PRIMARY KEY,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume REAL
      )
    `);
    
    // Fetch data
    const data = database.prepare(`
      SELECT * FROM ${tableName}
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `).all(startDate.getTime(), endDate.getTime());
    
    database.close();
    return data;
    
  } catch (error) {
    console.error('Database fetch failed:', error);
    return [];
  }
}
```

---

## 🚀 Integration with Phase 6 Backtest

### How Data Flows Through Backtest

```
User Input (Phase 6 UI)
  ↓
backtest.tsx: handleRunBacktest()
  ↓
POST /api/backtest/run {symbol, startDate, endDate, timeframe}
  ↓
phase6-unified-backtest.ts:run()
  ↓
fetchHistoricalData(symbol, startDate, endDate, timeframe)
  ↓
  ├─ Try Database
  ├─ Try ExchangeDataFeed (CCXT/yfinance)
  ├─ Try Polygon.io (if key set)
  └─ Fallback to Mock
  ↓
MarketFrame[] normalized data
  ↓
Signal Pipeline (6-source ensemble)
  ↓
Backtest Engine (execute trades)
  ↓
Calculate Metrics (Sharpe, Drawdown, etc.)
  ↓
Return BacktestResult
  ↓
Display in Phase 6 UI
```

---

## 📈 Example: Load BTC Data for 7 Years, Run with Multiple Strategies

```typescript
// Comprehensive example: Load data once, run multiple backtests

async function runMultipleBacktests() {
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
  
  const dateRange = {
    startDate: sevenYearsAgo.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    symbol: 'BTC/USDT',
    timeframe: '1d',
    initialCapital: 10000
  };
  
  const strategies = [
    'ma-crossover',
    'rsi-overbought',
    'bollinger-bands',
    'momentum',
    'mean-reversion'
  ];
  
  // Run all strategies on same data
  const results = await Promise.all(
    strategies.map(strategyId =>
      fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId,
          ...dateRange
        })
      }).then(r => r.json())
    )
  );
  
  // Compare results
  const bestStrategy = results.reduce((best, current) =>
    (current.metrics.sharpeRatio > best.metrics.sharpeRatio) ? current : best
  );
  
  console.log('🏆 Best Strategy:', {
    strategy: bestStrategy.strategyId,
    return: `${bestStrategy.metrics.totalReturn.toFixed(2)}%`,
    sharpeRatio: bestStrategy.metrics.sharpeRatio.toFixed(2),
    trades: bestStrategy.metrics.totalTrades
  });
  
  return { results, bestStrategy };
}
```

---

## ✅ Verification Checklist

```typescript
// Verify everything is working:

async function verifyDataSources() {
  console.log('\n📋 Data Source Verification');
  console.log('─'.repeat(50));
  
  // 1. Check database
  const fs = require('fs');
  if (fs.existsSync('market_data.db')) {
    console.log('✅ SQLite Database: PRESENT');
  } else {
    console.log('❌ SQLite Database: NOT FOUND');
  }
  
  // 2. Check CCXT
  try {
    const ccxt = require('ccxt');
    console.log(`✅ CCXT: READY (${Object.keys(ccxt).length} exchanges)`);
  } catch {
    console.log('❌ CCXT: NOT INSTALLED');
  }
  
  // 3. Check yfinance
  try {
    require('yahoo-finance2');
    console.log('✅ Yahoo Finance: READY');
  } catch {
    console.log('❌ Yahoo Finance: NOT INSTALLED');
  }
  
  // 4. Check Polygon key
  if (process.env.POLYGON_API_KEY) {
    console.log('✅ Polygon.io: CONFIGURED');
  } else {
    console.log('⚠️  Polygon.io: NOT CONFIGURED (optional)');
  }
  
  // 5. Try a test fetch
  try {
    const response = await fetch('/api/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'test',
        symbol: 'BTC/USDT',
        timeframe: '1d',
        startDate: '2024-11-19',
        endDate: '2024-12-19',
        initialCapital: 1000
      })
    });
    
    if (response.ok) {
      console.log('✅ Backtest API: WORKING');
    } else {
      console.log(`❌ Backtest API: ERROR ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Backtest API: FAILED - ${error.message}`);
  }
  
  console.log('─'.repeat(50) + '\n');
}

// Run verification
verifyDataSources();
```

---

## 🎓 Next Steps

1. ✅ Phase 6D Integration complete
2. 📊 Historical data loading verified
3. 🔄 Ready for Phase 6G (Walk Forward Validation)
4. 📈 Can now backtest 5-7 years of data

**When ready for Phase 6G:**
- Split data into train/test periods
- Measure overfitting
- Implement walk-forward testing
- Validate ensemble robustness
