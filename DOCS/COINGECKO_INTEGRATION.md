# CoinGecko Integration Guide 🦎

## Overview

Scanstream now integrates **CoinGecko's market data and sentiment API** to provide 360° market intelligence by combining:

1. **Exchange Data** (Binance, OKX, etc.) - Price, volume, technical indicators
2. **Sentiment Data** (CoinGecko) - Social trends, community activity
3. **Macro Context** (CoinGecko) - BTC dominance, market regime, global metrics

This creates a **confluence scoring system** that identifies high-probability opportunities.

## 🎯 Key Features

### ✅ What You Get

- **Trending Coins**: Real-time social sentiment detection
- **Market Regime**: Bull/bear/neutral/volatile classification
- **Sentiment Scores**: 0-100 score per symbol based on multiple factors
- **Enhanced Composite Scoring**: Technical + Sentiment + Market Regime
- **Global Market Metrics**: Total market cap, BTC dominance, volume

### 📊 Data Sources Combined

```
Exchange Data          CoinGecko Data         Result
─────────────          ───────────────        ──────
RSI: 35 (oversold)  +  Sentiment: 75       →  Strong Buy Signal
Volume: 2.5x        +  Trending: Yes        →  High Confidence
MACD: Bullish       +  Market: Bull         →  Optimal Entry
                       BTC Dom: 42%
```

## 🚀 API Endpoints

### 1. Market Data

**GET** `/api/coingecko/markets`

Get top coins by market cap with price and volume data.

```bash
curl http://localhost:3000/api/coingecko/markets?per_page=50&page=1
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "current_price": 67421,
      "market_cap": 1320413250000,
      "total_volume": 38291900000,
      "price_change_percentage_24h": 1.42
    }
  ],
  "attribution": "Data provided by CoinGecko (coingecko.com)"
}
```

### 2. Trending Coins

**GET** `/api/coingecko/trending`

Get coins trending on social media and CoinGecko.

```bash
curl http://localhost:3000/api/coingecko/trending
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "item": {
        "id": "pepe",
        "symbol": "pepe",
        "name": "Pepe",
        "market_cap_rank": 45,
        "score": 0
      }
    }
  ]
}
```

### 3. Global Market Overview

**GET** `/api/coingecko/global`

Get macro market metrics.

```bash
curl http://localhost:3000/api/coingecko/global
```

**Response:**
```json
{
  "success": true,
  "data": {
    "active_cryptocurrencies": 12039,
    "markets": 821,
    "total_market_cap": { "usd": 2574000000000 },
    "total_volume": { "usd": 132000000000 },
    "market_cap_percentage": { "btc": 52.4, "eth": 16.9 }
  }
}
```

### 4. Sentiment Score

**GET** `/api/coingecko/sentiment/:symbol`

Get 0-100 sentiment score for a specific symbol.

```bash
curl http://localhost:3000/api/coingecko/sentiment/BTC
```

**Response:**
```json
{
  "success": true,
  "symbol": "BTC",
  "sentimentScore": 75,
  "interpretation": "bullish",
  "timestamp": "2025-10-24T12:34:56.789Z"
}
```

**Score Breakdown:**
- **0-30**: Bearish
- **30-70**: Neutral
- **70-100**: Bullish

### 5. Market Regime

**GET** `/api/coingecko/regime`

Get current market regime classification.

```bash
curl http://localhost:3000/api/coingecko/regime
```

**Response:**
```json
{
  "success": true,
  "regime": "bull",
  "confidence": 75,
  "btcDominance": 42.5,
  "totalMarketCap": 2574000000000,
  "totalVolume": 132000000000
}
```

**Regimes:**
- **bull**: Alt season, money flowing to alts (BTC dom < 45%)
- **bear**: Risk-off, money flowing to BTC (BTC dom > 55%)
- **volatile**: High volume/mcap ratio (> 6%)
- **neutral**: Normal market conditions

## 🧠 Enhanced Composite Scoring

### Endpoint

**POST** `/api/analytics/composite-score`

Calculate enhanced score combining technical + sentiment + market regime.

### Request

```bash
curl -X POST http://localhost:3000/api/analytics/composite-score \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "rsi": 35,
    "macd": 0.5,
    "volumeRatio": 2.3,
    "priceChange24h": 3.2,
    "momentum": 0.6,
    "includeSentiment": true,
    "weights": {
      "technical": 0.5,
      "sentiment": 0.3,
      "marketRegime": 0.2
    }
  }'
```

### Response

```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "compositeScore": 78.5,
  "breakdown": {
    "technical": {
      "score": 75.2,
      "weight": 0.5,
      "contribution": 37.6,
      "components": {
        "rsi": 35,
        "macd": 0.5,
        "volumeRatio": 2.3,
        "priceChange24h": 3.2,
        "momentum": 0.6
      }
    },
    "sentiment": {
      "score": 82.0,
      "weight": 0.3,
      "contribution": 24.6,
      "isTrending": true
    },
    "marketRegime": {
      "score": 75.0,
      "weight": 0.2,
      "contribution": 15.0,
      "regime": "bull",
      "btcDominance": 42.5
    }
  },
  "recommendation": "strong_buy"
}
```

### Recommendation Scale

- **strong_buy**: Score ≥ 75
- **buy**: Score ≥ 60
- **hold**: Score ≥ 40
- **sell**: Score ≥ 25
- **strong_sell**: Score < 25

## 📦 Batch Processing

**POST** `/api/analytics/batch-composite-score`

Calculate scores for multiple symbols efficiently.

```bash
curl -X POST http://localhost:3000/api/analytics/batch-composite-score \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": [
      {
        "symbol": "BTC/USDT",
        "rsi": 35,
        "macd": 0.5,
        "volumeRatio": 2.3,
        "priceChange24h": 3.2,
        "momentum": 0.6
      },
      {
        "symbol": "ETH/USDT",
        "rsi": 45,
        "macd": -0.2,
        "volumeRatio": 1.8,
        "priceChange24h": 1.5,
        "momentum": 0.3
      }
    ],
    "includeSentiment": true
  }'
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "symbol": "BTC/USDT",
      "compositeScore": 78.5,
      "recommendation": "strong_buy",
      "breakdown": { ... }
    },
    {
      "symbol": "ETH/USDT",
      "compositeScore": 65.2,
      "recommendation": "buy",
      "breakdown": { ... }
    }
  ],
  "count": 2,
  "globalRegime": {
    "marketRegime": "bull",
    "btcDominance": 42.5
  }
}
```

## 🎨 Market Overview Dashboard

**GET** `/api/analytics/market-overview`

Get comprehensive market snapshot.

```bash
curl http://localhost:3000/api/analytics/market-overview
```

**Response:**
```json
{
  "success": true,
  "global": {
    "totalMarketCap": 2574000000000,
    "totalVolume": 132000000000,
    "btcDominance": 52.4,
    "activeCryptocurrencies": 12039,
    "markets": 821
  },
  "regime": {
    "current": "bull",
    "confidence": 75,
    "btcDominance": 52.4
  },
  "trending": [
    {
      "id": "pepe",
      "symbol": "pepe",
      "name": "Pepe",
      "rank": 45,
      "score": 0
    }
  ]
}
```

## 💡 Usage Examples

### Example 1: Scanner Integration

Enhance your scanner results with sentiment:

```typescript
import axios from 'axios';

async function enhanceScannerResults(scanResults: any[]) {
  const response = await axios.post(
    'http://localhost:3000/api/analytics/batch-composite-score',
    {
      symbols: scanResults.map(r => ({
        symbol: r.symbol,
        rsi: r.rsi,
        macd: r.macd,
        volumeRatio: r.volume_ratio,
        priceChange24h: r.price_change_24h,
        momentum: r.momentum
      })),
      includeSentiment: true
    }
  );
  
  return response.data.results;
}
```

### Example 2: Trading Decision

Use composite score for trade decisions:

```python
import requests

def should_trade(symbol, technical_data):
    response = requests.post(
        'http://localhost:3000/api/analytics/composite-score',
        json={
            'symbol': symbol,
            **technical_data,
            'includeSentiment': True
        }
    )
    
    data = response.json()
    
    if data['compositeScore'] >= 75:
        return 'BUY', data['breakdown']
    elif data['compositeScore'] <= 25:
        return 'SELL', data['breakdown']
    else:
        return 'HOLD', data['breakdown']
```

### Example 3: Market Timing

Check market regime before scanning:

```javascript
async function shouldScan() {
  const response = await fetch('http://localhost:3000/api/coingecko/regime');
  const data = await response.json();
  
  // Only scan during favorable regimes
  return data.regime === 'bull' || data.regime === 'volatile';
}
```

## ⚠️ Rate Limits & Best Practices

### Free Tier Limits

- **10-30 requests/minute per IP**
- Built-in caching (1-5 min TTL)
- Automatic cache management

### Best Practices

1. **Use batch endpoints** for multiple symbols
2. **Cache on your side** for frequently accessed data
3. **Respect rate limits** - use provided cache
4. **Handle errors gracefully** - fallback to default values
5. **Attribution required** - display "Data provided by CoinGecko"

### Cache Management

Clear cache manually if needed:

```bash
curl -X POST http://localhost:3000/api/coingecko/clear-cache
```

## 🎯 Integration Strategy

### Phase 1: Basic Integration
1. Add sentiment score to existing scanner results
2. Display trending coins in UI
3. Show market regime indicator

### Phase 2: Enhanced Scoring
1. Use composite score for ranking
2. Filter by recommendation level
3. Adjust weights based on strategy

### Phase 3: Advanced Features
1. Custom sentiment strategies
2. Regime-based auto-adjustment
3. Confluence detection across sources

## 📊 Score Components Explained

### Technical Score (0-100)
- RSI positioning
- MACD signals
- Volume analysis
- Price momentum
- Trend strength

### Sentiment Score (0-100)
- Trending status
- Price action sentiment
- Social activity
- Community size
- Developer activity

### Market Regime Score (0-100)
- Current regime type
- BTC dominance impact
- Volatility assessment
- Market breadth

## 🔧 Customization

### Adjust Weights

Different strategies need different weights:

**Scalping** (technical focused):
```json
{
  "technical": 0.7,
  "sentiment": 0.2,
  "marketRegime": 0.1
}
```

**Swing Trading** (balanced):
```json
{
  "technical": 0.5,
  "sentiment": 0.3,
  "marketRegime": 0.2
}
```

**Position Trading** (macro focused):
```json
{
  "technical": 0.3,
  "sentiment": 0.3,
  "marketRegime": 0.4
}
```

## 🚨 Error Handling

The integration is designed to fail gracefully:

- **CoinGecko unavailable**: Falls back to technical-only scoring
- **Rate limit exceeded**: Uses cached data
- **Symbol not found**: Returns neutral sentiment (50)
- **Network error**: Continues with default values

## 📈 Next Steps

1. **Test the endpoints** with example requests
2. **Integrate with your scanner** using batch endpoint
3. **Display sentiment data** in UI
4. **Optimize weights** for your strategy
5. **Monitor performance** and adjust

## 🎉 Benefits

✅ **Better Signal Quality**: Filter out false positives
✅ **Market Context**: Know when NOT to trade
✅ **Sentiment Edge**: Catch trends early
✅ **Risk Management**: Avoid bearish macro conditions
✅ **Confluence Detection**: Multiple confirmations

---

**Attribution**: Market data and sentiment provided by [CoinGecko](https://www.coingecko.com) 🦎

