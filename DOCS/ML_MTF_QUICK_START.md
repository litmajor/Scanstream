# Multi-Timeframe ML Quick Start

Get LSTM multi-timeframe predictions and backtesting running in 5 minutes.

## Installation (1 min)

### 1. Verify Services Exist
```bash
# Check multi-timeframe service
ls -la server/services/multi-timeframe-ml-service.ts

# Check backtest engine
ls -la server/services/lstm-backtest-engine.ts

# Check API routes
ls -la server/routes/ml-mtf-predictions.ts
```

### 2. Register Routes in Express App

Add to your main Express app file (e.g., `server/app.ts` or `server/index.ts`):

```typescript
import mlMtfRouter from './routes/ml-mtf-predictions';

// Register routes
app.use('/api/ml/mtf', mlMtfRouter);

console.log('[App] ML Multi-Timeframe API routes registered on /api/ml/mtf');
```

### 3. Start Server

```bash
npm run dev
# or
pnpm dev
```

## Basic Usage (2 min)

### Get Multi-Timeframe Consensus

```bash
curl -X GET "http://localhost:3000/api/ml/mtf/predictions/BTC/USDT"
```

**Quick Response:**
```json
{
  "symbol": "BTC/USDT",
  "consensus": {
    "direction": "BULLISH",
    "confidence": 0.725,
    "strength": 72.5,
    "timeframesAgree": 5
  },
  "timeframes": [
    {"timeframe": "1h", "direction": "BULLISH", "confidence": 0.78},
    {"timeframe": "4h", "direction": "BULLISH", "confidence": 0.72}
  ]
}
```

### Get Single Timeframe

```bash
curl -X GET "http://localhost:3000/api/ml/mtf/predictions/BTC/USDT?timeframe=1h"
```

### Enhance Scanner Signal with ML

```bash
curl -X POST "http://localhost:3000/api/ml/mtf/enhance-signal" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "direction": "LONG",
    "entry": 42500,
    "stopLoss": 42000,
    "takeProfit": 43500
  }'
```

**Quick Response:**
```json
{
  "success": true,
  "mlConsensus": "BULLISH",
  "alignment": {"aligned": true, "agreement": "83%"},
  "recommendation": {"action": "CONFIRM"}
}
```

## Backtesting (1 min)

### Run Backtest

```bash
curl -X POST "http://localhost:3000/api/ml/mtf/backtest/run" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "startDate": "2023-09-01T00:00:00Z",
    "endDate": "2023-12-01T00:00:00Z"
  }'
```

**Quick Response:**
```json
{
  "success": true,
  "results": {
    "summary": {
      "totalTrades": 87,
      "winRate": "57.5%",
      "avgProfit": "1.24%"
    },
    "quality": {
      "sharpeRatio": "1.8",
      "maxDrawdown": "-3.2%"
    }
  }
}
```

### Get Backtest Results

```bash
curl -X GET "http://localhost:3000/api/ml/mtf/backtest?symbol=BTC/USDT&timeframe=1h"
```

### Compare Across Exchanges

```bash
curl -X POST "http://localhost:3000/api/ml/mtf/backtest/multi-exchange" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "startDate": "2023-09-01T00:00:00Z",
    "endDate": "2023-12-01T00:00:00Z",
    "exchanges": ["binance", "coinbase"]
  }'
```

## Check Status (30 sec)

### Health Check

```bash
curl -X GET "http://localhost:3000/api/ml/mtf/health"
```

**Quick Response:**
```json
{
  "status": "operational",
  "services": {
    "multiTimeframeML": "active",
    "backtestEngine": "ready"
  }
}
```

### Get Confidence Metrics

```bash
curl -X GET "http://localhost:3000/api/ml/mtf/confidence/BTC/USDT"
```

**Quick Response:**
```json
{
  "consensus": {
    "direction": "BULLISH",
    "confidence": 0.725,
    "alignment": "5/6 timeframes agree"
  },
  "byTimeframe": [
    {"timeframe": "1h", "confidence": 0.78},
    {"timeframe": "4h", "confidence": 0.72}
  ]
}
```

## Common Patterns

### 1. Monitor Signal + Get Prediction

```typescript
// Get scanner signal
const signal = await fetch('/api/signals/BTC/USDT').then(r => r.json());

// Enhance with ML
const enhanced = await fetch('/api/ml/mtf/enhance-signal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: signal.symbol,
    direction: signal.direction,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit
  })
}).then(r => r.json());

// Check if aligned
if (enhanced.recommendation.action === 'CONFIRM') {
  console.log('Signal confirmed by ML!');
}
```

### 2. Backtest Multiple Symbols

```bash
# BTC
curl -X POST "http://localhost:3000/api/ml/mtf/backtest/run" \
  -d '{"symbol":"BTC/USDT","timeframe":"1h",...}'

# ETH
curl -X POST "http://localhost:3000/api/ml/mtf/backtest/run" \
  -d '{"symbol":"ETH/USDT","timeframe":"1h",...}'

# SOL
curl -X POST "http://localhost:3000/api/ml/mtf/backtest/run" \
  -d '{"symbol":"SOL/USDT","timeframe":"1h",...}'
```

### 3. Monitor Timeframe Consensus

```bash
# Check all timeframes
curl "http://localhost:3000/api/ml/mtf/predictions/BTC/USDT" | jq '.timeframes[] | {timeframe, direction, confidence}'

# Output:
# {
#   "timeframe": "1m",
#   "direction": "BEARISH",
#   "confidence": 0.62
# }
# {
#   "timeframe": "1h",
#   "direction": "BULLISH",
#   "confidence": 0.78
# }
```

### 4. Check Different Timeframes

```bash
# 1 minute
curl "http://localhost:3000/api/ml/mtf/predictions/BTC/USDT?timeframe=1m"

# 1 hour
curl "http://localhost:3000/api/ml/mtf/predictions/BTC/USDT?timeframe=1h"

# 1 day
curl "http://localhost:3000/api/ml/mtf/predictions/BTC/USDT?timeframe=1d"
```

## Response Fields Explained

### Consensus Object
- **direction**: BULLISH, BEARISH, or NEUTRAL
- **confidence**: 0-1 (0.725 = 72.5% confident)
- **strength**: 0-100 (same as confidence * 100)
- **timeframesAgree**: Count of timeframes with majority direction

### Timeframe Prediction
- **direction**: Predicted direction
- **confidence**: How sure the model is (0-1)
- **price**: Predicted price target
- **riskScore**: 0-100 (higher = riskier)
- **volatility**: Expected volatility (0-1)
- **weight**: Importance in consensus calculation (0.05-0.25)

### Backtest Results
- **winRate**: % of profitable trades
- **avgProfit**: Average profit per trade
- **sharpeRatio**: Risk-adjusted return (>1 is good)
- **maxDrawdown**: Worst peak-to-trough decline
- **profitFactor**: Profit/loss ratio (>1.5 is good)

## Troubleshooting

### "No trained model available"
**Problem:** Model not trained for symbol
**Solution:** Train LSTM model first with historical data
```bash
POST /api/ml/train
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "lookbackDays": 90
}
```

### "Insufficient historical data for backtest"
**Problem:** Not enough candles for date range
**Solution:** Use more recent start date or larger timeframe
```bash
# Use more recent date
"startDate": "2023-11-01T00:00:00Z"  # Instead of 2023-01-01

# Or use larger timeframe
"timeframe": "4h"  # Instead of 1m
```

### "Invalid timeframe"
**Problem:** Using unsupported timeframe
**Solution:** Use valid timeframes: 1m, 5m, 15m, 1h, 4h, 1d

### "Rate limit exceeded"
**Problem:** Too many requests
**Solution:** Wait 60 seconds or reduce request frequency

## Next Steps

1. **Display ML on UI:** Add ML consensus widget to signals page
2. **Automated Trading:** Use CONFIRM recommendations for entries
3. **Portfolio Analysis:** Aggregate predictions across symbols
4. **Alert System:** Notify on high-confidence signals
5. **Optimization:** Backtest parameter variations

## Files Created

- `server/services/multi-timeframe-ml-service.ts` - Multi-timeframe prediction service
- `server/services/lstm-backtest-engine.ts` - Backtest simulation engine
- `server/routes/ml-mtf-predictions.ts` - API endpoints
- `ML_MTF_INTEGRATION_GUIDE.md` - Complete integration guide
- `ML_MTF_API_REFERENCE.md` - Full API documentation

## Configuration

Default parameters:

```typescript
// Timeframe weights
weights = {
  '1m': 0.05,   // 5% - real-time noise
  '5m': 0.10,   // 10% - short-term
  '15m': 0.15,  // 15% - short-term swings
  '1h': 0.25,   // 25% - primary
  '4h': 0.25,   // 25% - primary
  '1d': 0.20    // 20% - long-term trend
}

// Backtest defaults
targetProfit = 2.0%     // Take profit at +2%
stopLoss = 1.0%         // Stop loss at -1%
commission = 0.1%       // 0.1% per trade
```

## Support

For issues or questions:
1. Check `ML_MTF_API_REFERENCE.md` for detailed endpoint docs
2. Review `ML_MTF_INTEGRATION_GUIDE.md` for implementation details
3. Check server logs for detailed error messages
4. Verify model is trained: `GET /api/ml/mtf/health`

