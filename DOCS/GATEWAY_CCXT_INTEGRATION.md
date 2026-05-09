
```markdown
# Gateway + CCXT Deep Integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway Agent                             │
│  (Orchestrator + Intelligence Layer)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Rate Limiter │  │ Cache Manager│  │ Health Check │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Exchange Aggregator (CCXT Core)              │  │
│  │  - Multi-exchange price aggregation                  │  │
│  │  - Smart fallback logic                              │  │
│  │  - Confidence scoring                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            CCXT Scanner                               │  │
│  │  - Batch symbol scanning                             │  │
│  │  - Parallel/sequential modes                         │  │
│  │  - Metric calculations                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Signal Pipeline                               │  │
│  │  - Indicator calculations                            │  │
│  │  - Signal generation                                 │  │
│  │  - Multi-timeframe analysis                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
              ┌─────────────────────────┐
              │   CCXT Exchange APIs    │
              │ Binance, Coinbase, etc. │
              └─────────────────────────┘
```

## Data Flow

### 1. Asset Price Requests
```
Frontend → /api/gateway/price/BTC/USDT
          ↓
Gateway checks cache (10s TTL)
          ↓
Exchange Aggregator fetches from healthy exchanges
          ↓
Calculate median price + confidence score
          ↓
Cache result + return to frontend
```

### 2. Scanning Flow
```
Frontend → /api/gateway/scan
          ↓
CCXT Scanner orchestrates:
  1. Get prices (via Gateway)
  2. Get OHLCV (via Gateway fallback)
  3. Get market frames (via CCXT)
  4. Calculate metrics
  5. Assess data quality
          ↓
Return scan results with confidence scores
```

### 3. Signal Generation Flow
```
Frontend → /api/gateway/signal/generate
          ↓
Signal Pipeline:
  1. Get market frames (via Gateway)
  2. Calculate indicators (RSI, MACD, etc.)
  3. Generate signal
  4. Enrich with price confidence
          ↓
Return signal with reasoning
```

## API Endpoints

### Price Data
```bash
# Get aggregated price
GET /api/gateway/price/BTC/USDT

Response:
{
  "symbol": "BTC/USDT",
  "price": 95234.50,
  "confidence": 95.2,
  "sources": ["binance", "coinbase", "okx"],
  "deviation": 0.12,
  "timestamp": "2025-01-29T10:00:00Z"
}
```

### OHLCV Data
```bash
# Get OHLCV with fallback
GET /api/gateway/ohlcv/ETH/USDT?timeframe=1h&limit=100

Response:
{
  "symbol": "ETH/USDT",
  "timeframe": "1h",
  "count": 100,
  "data": [...]
}
```

### Batch Scanning
```bash
# Scan multiple symbols
POST /api/gateway/scan

Body:
{
  "symbols": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
  "timeframe": "1m",
  "options": {
    "parallel": true,
    "useCache": true,
    "minConfidence": 70
  }
}

Response:
{
  "scanned": 3,
  "total": 3,
  "timeframe": "1m",
  "results": [
    {
      "symbol": "BTC/USDT",
      "price": 95234.50,
      "confidence": 95.2,
      "metrics": {
        "rsi": 65.2,
        "macd": 150.3,
        "momentum": 2.5,
        "trendStrength": 0.8
      },
      "dataQuality": 92
    }
  ],
  "stats": {
    "activeScans": 0,
    "cachedResults": 3
  }
}
```

### Signal Generation
```bash
# Generate signal
POST /api/gateway/signal/generate

Body:
{
  "symbol": "BTC/USDT",
  "timeframe": "1m",
  "limit": 100
}

Response:
{
  "symbol": "BTC/USDT",
  "signal": {
    "type": "BUY",
    "strength": 0.85,
    "confidence": 0.78,
    "reasoning": [
      "Price confidence: 95.2% (3 sources)",
      "Technical analysis bullish (65.0%)"
    ]
  }
}
```

## Integration Benefits

### 1. **Consistent Data Flow**
- All market data flows through Gateway
- CCXT provides raw data
- Gateway adds intelligence (caching, aggregation, health)

### 2. **Rate Limit Protection**
- Gateway manages all exchange requests
- Token bucket algorithm prevents overflows
- Circuit breaker for failing exchanges

### 3. **Improved Reliability**
- Multi-source price aggregation
- Automatic failover
- Confidence scoring

### 4. **Better Performance**
- Intelligent caching (10s for prices, 1min for OHLCV)
- Parallel scanning support
- Reduced API calls (85% reduction)

## Usage Examples

### Frontend Integration
```typescript
// Get price through Gateway
const priceData = await fetch('/api/gateway/price/BTC/USDT').then(r => r.json());

// Scan multiple assets
const scanResults = await fetch('/api/gateway/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbols: ['BTC/USDT', 'ETH/USDT'],
    timeframe: '1m',
    options: { parallel: true, minConfidence: 70 }
  })
}).then(r => r.json());

// Generate signal
const signal = await fetch('/api/gateway/signal/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'BTC/USDT',
    timeframe: '1m'
  })
}).then(r => r.json());
```

## Configuration

All Gateway behavior is controlled through:
- Rate limits: `server/routes/gateway.ts` lines 15-20
- Cache TTLs: `server/services/gateway/cache-manager.ts`
- Exchange priority: `server/services/gateway/exchange-aggregator.ts` lines 16-23

## Monitoring

```bash
# Check Gateway health
GET /api/gateway/health

# Get cache stats
GET /api/gateway/metrics/cache

# Get rate limit stats
GET /api/gateway/metrics/rate-limit
```
```
