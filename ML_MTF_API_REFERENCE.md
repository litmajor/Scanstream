# Multi-Timeframe ML API Reference

Complete API documentation for multi-timeframe LSTM predictions and backtesting endpoints.

## Base URL

```
/api/ml/mtf
```

## Authentication

All endpoints support optional Bearer token authentication:

```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- **Predictions:** 100 requests per minute
- **Backtest:** 10 requests per minute
- **Cache Clear:** 5 requests per minute

## Endpoints

---

## 1. GET /predictions/:symbol

Get multi-timeframe LSTM predictions with consensus.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | Yes | - | Trading pair (e.g., BTC/USDT) |
| timeframe | string | No | - | Specific timeframe (1m, 5m, 15m, 1h, 4h, 1d) |
| includeReasons | boolean | No | true | Include reasoning text |

### Examples

#### All Timeframes Consensus
```bash
curl -X GET "https://api.example.com/api/ml/mtf/predictions/BTC/USDT"
```

#### Specific Timeframe (1h)
```bash
curl -X GET "https://api.example.com/api/ml/mtf/predictions/ETH/USDT?timeframe=1h"
```

#### Without Reasoning
```bash
curl -X GET "https://api.example.com/api/ml/mtf/predictions/SOL/USDT?includeReasons=false"
```

### Response: All Timeframes

**Status:** 200 OK

```json
{
  "symbol": "BTC/USDT",
  "timestamp": 1702800000000,
  "consensus": {
    "direction": "BULLISH",
    "confidence": 0.725,
    "strength": 72.5,
    "timeframesAgree": 5,
    "totalTimeframes": 6
  },
  "timeframes": [
    {
      "timeframe": "1m",
      "direction": "BEARISH",
      "confidence": 0.62,
      "strength": 62,
      "price": 42600,
      "priceChangePct": 0.12,
      "riskScore": 42,
      "riskLevel": "MODERATE",
      "volatility": 0.045,
      "regimeDuration": "15 minutes",
      "weight": 0.05
    },
    {
      "timeframe": "5m",
      "direction": "NEUTRAL",
      "confidence": 0.51,
      "strength": 51,
      "price": 42620,
      "priceChangePct": 0.18,
      "riskScore": 48,
      "riskLevel": "MODERATE",
      "volatility": 0.038,
      "regimeDuration": "25 minutes",
      "weight": 0.10
    },
    {
      "timeframe": "15m",
      "direction": "BULLISH",
      "confidence": 0.68,
      "strength": 68,
      "price": 42650,
      "priceChangePct": 0.35,
      "riskScore": 38,
      "riskLevel": "MODERATE",
      "volatility": 0.032,
      "regimeDuration": "1.3 hours",
      "weight": 0.15
    },
    {
      "timeframe": "1h",
      "direction": "BULLISH",
      "confidence": 0.78,
      "strength": 78,
      "price": 42680,
      "priceChangePct": 0.52,
      "riskScore": 35,
      "riskLevel": "MODERATE",
      "volatility": 0.032,
      "regimeDuration": "5.5 hours",
      "weight": 0.25
    },
    {
      "timeframe": "4h",
      "direction": "BULLISH",
      "confidence": 0.72,
      "strength": 72,
      "price": 42670,
      "priceChangePct": 0.48,
      "riskScore": 36,
      "riskLevel": "MODERATE",
      "volatility": 0.028,
      "regimeDuration": "18.5 hours",
      "weight": 0.25
    },
    {
      "timeframe": "1d",
      "direction": "BULLISH",
      "confidence": 0.68,
      "strength": 68,
      "price": 42750,
      "priceChangePct": 0.85,
      "riskScore": 40,
      "riskLevel": "MODERATE",
      "volatility": 0.025,
      "regimeDuration": "3.2 days",
      "weight": 0.20
    }
  ],
  "aggregatedMetrics": {
    "avgRiskScore": 38.2,
    "maxVolatility": 0.045,
    "shortestRegimeDuration": "15 minutes",
    "velocityConfidenceAvg": 0.68
  }
}
```

### Response: Single Timeframe

**Status:** 200 OK

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "timestamp": 1702800000000,
  "prediction": {
    "direction": "BULLISH",
    "confidence": 0.78,
    "strength": 78,
    "probability": 0.72,
    "price": {
      "predicted": 42680,
      "changePct": 0.52,
      "highBand": 42800,
      "lowBand": 42500
    },
    "riskScore": 35,
    "riskLevel": "MODERATE"
  },
  "weight": 0.25,
  "reasoning": {
    "direction": "Price momentum above 20-period MA with positive MACD divergence. RSI at 62 (not overbought)",
    "riskFactors": [
      "Moderate volatility (3.2%)",
      "Low regime change risk",
      "RSI not overbought (62/100)"
    ]
  }
}
```

### Response: No Model

**Status:** 404 Not Found

```json
{
  "error": "No trained model available for this symbol",
  "symbol": "XYZ/USDT",
  "message": "Train model first using POST /api/ml/mtf/train"
}
```

### Response: Invalid Timeframe

**Status:** 404 Not Found

```json
{
  "error": "No prediction for timeframe 30m",
  "available": ["1m", "5m", "15m", "1h", "4h", "1d"]
}
```

---

## 2. POST /enhance-signal

Enhance scanner signal with ML metrics and alignment check.

### Body

```json
{
  "symbol": "BTC/USDT",
  "direction": "LONG",
  "entry": 42500,
  "stopLoss": 42000,
  "takeProfit": 43500
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| direction | string | Yes | LONG or SHORT |
| entry | number | Yes | Entry price |
| stopLoss | number | Yes | Stop loss price |
| takeProfit | number | Yes | Take profit price |

### Examples

```bash
curl -X POST "https://api.example.com/api/ml/mtf/enhance-signal" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "direction": "LONG",
    "entry": 42500,
    "stopLoss": 42000,
    "takeProfit": 43500
  }'
```

### Response: Aligned Signal

**Status:** 200 OK

```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "scannerSignal": "LONG",
  "mlConsensus": "BULLISH",
  "enhanced": {
    "direction": "LONG",
    "entry": 42500,
    "stopLoss": 42000,
    "takeProfit": 43500,
    "riskRewardRatio": 2.0,
    "adjustedStopLoss": 42100
  },
  "alignment": {
    "aligned": true,
    "agreement": "83% timeframes agree",
    "conflictAnalysis": "All timeframes bullish - strong consensus"
  },
  "recommendation": {
    "action": "CONFIRM",
    "reason": "ML consensus BULLISH aligns with scanner LONG",
    "confidenceLevel": 0.83,
    "combinedScore": 78.5,
    "riskAdjustment": "Use standard risk parameters"
  }
}
```

### Response: Conflicted Signal

**Status:** 200 OK

```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "scannerSignal": "LONG",
  "mlConsensus": "BEARISH",
  "enhanced": {
    "direction": "LONG",
    "entry": 42500,
    "stopLoss": 42000,
    "takeProfit": 43500,
    "riskRewardRatio": 2.0,
    "adjustedStopLoss": 41900
  },
  "alignment": {
    "aligned": false,
    "agreement": "40% timeframes agree",
    "conflictAnalysis": "Only 4h and daily bullish; shorter timeframes bearish"
  },
  "recommendation": {
    "action": "CAUTION",
    "reason": "ML consensus BEARISH conflicts with scanner LONG",
    "confidenceLevel": 0.40,
    "combinedScore": 45.2,
    "riskAdjustment": "Consider tighter stops or smaller position"
  }
}
```

### Response: Missing Fields

**Status:** 400 Bad Request

```json
{
  "error": "Missing required fields: symbol, direction, entry, stopLoss, takeProfit"
}
```

---

## 3. GET /backtest

Get historical backtest results.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | Yes | - | Trading pair |
| timeframe | string | Yes | - | 1m, 5m, 15m, 1h, 4h, 1d |
| limit | number | No | 100 | Max trades to return |

### Examples

```bash
# Get last 100 trades
curl -X GET "https://api.example.com/api/ml/mtf/backtest?symbol=BTC/USDT&timeframe=1h"

# Get last 50 trades
curl -X GET "https://api.example.com/api/ml/mtf/backtest?symbol=ETH/USDT&timeframe=4h&limit=50"
```

### Response

**Status:** 200 OK

```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "totalTrades": 87,
  "stats": {
    "overall": {
      "winRate": "57.5%",
      "avgProfit": "1.24%",
      "totalProfit": "107.88%",
      "sharpeRatio": "1.8",
      "maxDrawdown": "-3.2%"
    },
    "byDirection": {
      "long": {
        "trades": 45,
        "wins": 26,
        "winRate": "57.8%"
      },
      "short": {
        "trades": 42,
        "wins": 24,
        "winRate": "57.1%"
      }
    }
  },
  "recent": [
    {
      "timestamp": 1702799400000,
      "direction": "LONG",
      "entryPrice": 42500,
      "exitPrice": 42700,
      "result": "0.47%"
    },
    {
      "timestamp": 1702795800000,
      "direction": "SHORT",
      "entryPrice": 42600,
      "exitPrice": 42550,
      "result": "0.12%"
    }
  ]
}
```

### Response: No Data

**Status:** 404 Not Found

```json
{
  "error": "No backtest data available",
  "symbol": "XYZ/USDT",
  "timeframe": "1h",
  "message": "Run backtest first using POST /api/ml/mtf/backtest/run"
}
```

---

## 4. POST /backtest/run

Run backtest for a symbol/timeframe period.

### Body

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "startDate": "2023-09-01T00:00:00Z",
  "endDate": "2023-12-01T00:00:00Z",
  "targetProfit": 2.0,
  "stopLoss": 1.0,
  "commission": 0.1
}
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| symbol | string | Yes | - | Trading pair |
| timeframe | string | Yes | - | 1m, 5m, 15m, 1h, 4h, 1d |
| startDate | string | Yes | - | ISO 8601 date |
| endDate | string | Yes | - | ISO 8601 date |
| targetProfit | number | No | 2.0 | Target profit % |
| stopLoss | number | No | 1.0 | Stop loss % |
| commission | number | No | 0.1 | Commission % |

### Examples

```bash
curl -X POST "https://api.example.com/api/ml/mtf/backtest/run" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "startDate": "2023-09-01T00:00:00Z",
    "endDate": "2023-12-01T00:00:00Z"
  }'
```

### Response

**Status:** 200 OK

```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "dateRange": {
    "start": "2023-09-01T00:00:00Z",
    "end": "2023-12-01T00:00:00Z"
  },
  "results": {
    "summary": {
      "totalTrades": 87,
      "winRate": "57.5%",
      "avgProfit": "1.24%",
      "totalProfit": "107.88%"
    },
    "byDirection": {
      "long": {
        "trades": 45,
        "wins": 26,
        "winRate": "57.8%",
        "avgProfit": "1.35%"
      },
      "short": {
        "trades": 42,
        "wins": 24,
        "winRate": "57.1%",
        "avgProfit": "1.12%"
      }
    },
    "quality": {
      "sharpeRatio": "1.8",
      "maxDrawdown": "-3.2%",
      "profitFactor": "2.1",
      "recoveryFactor": "5.8"
    }
  }
}
```

---

## 5. GET /confidence/:symbol

Get confidence metrics by timeframe.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Trading pair |

### Examples

```bash
curl -X GET "https://api.example.com/api/ml/mtf/confidence/BTC/USDT"
```

### Response

**Status:** 200 OK

```json
{
  "symbol": "BTC/USDT",
  "timestamp": 1702800000000,
  "consensus": {
    "direction": "BULLISH",
    "confidence": 0.725,
    "strength": 72.5,
    "alignment": "5/6 timeframes agree",
    "quality": "Strong"
  },
  "byTimeframe": [
    {
      "timeframe": "1m",
      "direction": "BEARISH",
      "confidence": 0.62,
      "strength": 62,
      "probability": 0.58,
      "riskScore": 42,
      "volatility": 0.045,
      "regimeDuration": "15 minutes",
      "weight": 0.05
    },
    {
      "timeframe": "1h",
      "direction": "BULLISH",
      "confidence": 0.78,
      "strength": 78,
      "probability": 0.72,
      "riskScore": 35,
      "volatility": 0.032,
      "regimeDuration": "5.5 hours",
      "weight": 0.25
    }
  ],
  "aggregated": {
    "avgRiskScore": 38.2,
    "maxVolatility": 0.045,
    "shortestRegimeDuration": "15 minutes",
    "velocityConfidenceAvg": 0.68
  }
}
```

---

## 6. POST /backtest/multi-exchange

Compare backtest results across exchanges.

### Body

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "startDate": "2023-09-01T00:00:00Z",
  "endDate": "2023-12-01T00:00:00Z",
  "exchanges": ["binance", "coinbase", "kraken"]
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Trading pair |
| timeframe | string | Yes | 1m, 5m, 15m, 1h, 4h, 1d |
| startDate | string | Yes | ISO 8601 date |
| endDate | string | Yes | ISO 8601 date |
| exchanges | array | Yes | Exchange names |

### Examples

```bash
curl -X POST "https://api.example.com/api/ml/mtf/backtest/multi-exchange" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "startDate": "2023-09-01T00:00:00Z",
    "endDate": "2023-12-01T00:00:00Z",
    "exchanges": ["binance", "coinbase", "kraken"]
  }'
```

### Response

**Status:** 200 OK

```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "dateRange": {
    "start": "2023-09-01T00:00:00Z",
    "end": "2023-12-01T00:00:00Z"
  },
  "consensus": {
    "bestExchange": "binance",
    "avgWinRate": "57.5%",
    "avgSharpe": "1.8",
    "recommendation": "Strong historical performance"
  },
  "byExchange": [
    {
      "exchange": "binance",
      "trades": 87,
      "wins": 50,
      "winRate": "57.5%",
      "avgProfit": "1.24%",
      "sharpe": 1.8,
      "maxDD": "-3.2%"
    },
    {
      "exchange": "coinbase",
      "trades": 85,
      "wins": 48,
      "winRate": "56.5%",
      "avgProfit": "1.18%",
      "sharpe": 1.7,
      "maxDD": "-3.4%"
    },
    {
      "exchange": "kraken",
      "trades": 83,
      "wins": 46,
      "winRate": "55.4%",
      "avgProfit": "1.10%",
      "sharpe": 1.6,
      "maxDD": "-3.6%"
    }
  ],
  "recommendation": {
    "bestPerformer": "binance",
    "reason": "binance showed highest Sharpe ratio"
  }
}
```

---

## 7. GET /health

Check ML service health.

### Response

**Status:** 200 OK

```json
{
  "success": true,
  "status": "operational",
  "services": {
    "multiTimeframeML": "active",
    "backtestEngine": "ready"
  },
  "capabilities": {
    "timeframes": ["1m", "5m", "15m", "1h", "4h", "1d"],
    "features": ["predictions", "backtesting", "consensus", "multi-exchange"],
    "cacheEnabled": true,
    "cacheTTL": "5 minutes"
  },
  "endpoints": {
    "predictions": "GET /api/ml/mtf/predictions/:symbol",
    "enhanceSignal": "POST /api/ml/mtf/enhance-signal",
    "backtest": "GET /api/ml/mtf/backtest",
    "backtestRun": "POST /api/ml/mtf/backtest/run",
    "confidence": "GET /api/ml/mtf/confidence/:symbol",
    "multiExchange": "POST /api/ml/mtf/backtest/multi-exchange"
  }
}
```

---

## 8. POST /cache/clear

Clear prediction cache (manual refresh).

### Response

**Status:** 200 OK

```json
{
  "success": true,
  "message": "ML prediction cache cleared",
  "timestamp": "2023-12-17T10:30:00Z"
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid request parameters",
  "details": "Missing required field: symbol"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found",
  "details": "No model available for XYZ/USDT"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to process request",
  "details": "Database connection timeout"
}
```

### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Data Types

### Direction Enum
- `BULLISH`: Upward price movement expected
- `BEARISH`: Downward price movement expected
- `NEUTRAL`: No clear directional bias

### Risk Levels
- `LOW`: Score 0-30
- `MODERATE`: Score 30-50
- `HIGH`: Score 50-70
- `CRITICAL`: Score 70-100

### Timeframe Type
- `1m`: 1 minute
- `5m`: 5 minutes
- `15m`: 15 minutes
- `1h`: 1 hour
- `4h`: 4 hours
- `1d`: 1 day

---

## Common Workflows

### 1. Get Consensus & Check Alignment

```bash
# Get consensus
curl -X GET "https://api.example.com/api/ml/mtf/predictions/BTC/USDT"

# Enhance with scanner signal
curl -X POST "https://api.example.com/api/ml/mtf/enhance-signal" \
  -d '{"symbol":"BTC/USDT","direction":"LONG","entry":42500,...}'
```

### 2. Backtest & Compare

```bash
# Run backtest for specific timeframe
curl -X POST "https://api.example.com/api/ml/mtf/backtest/run" \
  -d '{"symbol":"BTC/USDT","timeframe":"1h",...}'

# Compare across exchanges
curl -X POST "https://api.example.com/api/ml/mtf/backtest/multi-exchange" \
  -d '{"symbol":"BTC/USDT",...,"exchanges":["binance","coinbase"]}'
```

### 3. Monitor Confidence

```bash
# Check confidence by timeframe
curl -X GET "https://api.example.com/api/ml/mtf/confidence/BTC/USDT"

# Track changes over time
for i in {1..5}; do
  curl -X GET "https://api.example.com/api/ml/mtf/confidence/BTC/USDT"
  sleep 60
done
```

