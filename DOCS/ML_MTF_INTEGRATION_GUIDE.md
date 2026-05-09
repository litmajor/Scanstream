# Multi-Timeframe ML Integration Guide

Complete guide for integrating multi-timeframe LSTM predictions into the scanner pipeline with backtesting capability.

## Overview

This integration adds:
- **6-Timeframe Consensus** predictions (1m, 5m, 15m, 1h, 4h, 1d)
- **Dynamic Confidence** scoring based on model variance
- **Scanner Signal Enhancement** with ML alignment checking
- **LONG/SHORT Backtesting** against historical data
- **Multi-Exchange Comparison** for validation

## Architecture

### Services

#### 1. MultiTimeframeMLService
**File:** `server/services/multi-timeframe-ml-service.ts`

Manages LSTM predictions across all timeframes with consensus calculation.

**Key Methods:**
```typescript
// Get predictions for all timeframes in parallel
async getPredictions(symbol: string): Promise<MultiTimeframePrediction>

// Calculate weighted consensus direction
calculateConsensus(predictions: Map): ConsensusPrediction

// Blend scanner signal with ML metrics
async enhanceScannerSignal(
  symbol: string,
  direction: 'LONG' | 'SHORT',
  entry: number,
  stopLoss: number,
  takeProfit: number
): Promise<MLSignalEnhancedOutput>

// Store and retrieve backtest results
recordBacktestPrediction(prediction: BacktestPrediction): void
getBacktestedPredictions(symbol: string, timeframe: string): BacktestPrediction[]
```

**Weights (Configurable):**
```typescript
{
  '1m': 0.05,    // 5% - Real-time noise filtering
  '5m': 0.10,    // 10% - Short-term scalps
  '15m': 0.15,   // 15% - Short-term swings
  '1h': 0.25,    // 25% - Primary direction
  '4h': 0.25,    // 25% - Primary direction
  '1d': 0.20     // 20% - Long-term trend
}
```

#### 2. LSTMBacktestEngine
**File:** `server/services/lstm-backtest-engine.ts`

Simulates LSTM predictions against historical OHLCV data.

**Key Methods:**
```typescript
// Run backtest for symbol/timeframe/period
async backtest(config: BacktestConfig): Promise<BacktestResult>

// Simulate LONG/SHORT trades with TP/SL
simulateTrades(
  candles: OHLCV[],
  predictions: LSTMPredictionOutput[]
): TradeSimulation[]

// Calculate Sharpe ratio, max DD, profit factor
calculateStatistics(trades: TradeSimulation[]): BacktestStatistics

// Compare results across multiple exchanges
async backtestMultiExchange(
  symbol: string,
  timeframe: string,
  startDate: Date,
  endDate: Date,
  exchanges: string[]
): Promise<MultiExchangeBacktestResult>
```

**Output Metrics:**
- **Direction-Specific:** LONG wins, SHORT wins, directional accuracy
- **Performance:** Sharpe ratio, max drawdown, profit factor, recovery factor
- **Detail:** By-timeframe breakdown, by-exchange comparison

### API Routes

**File:** `server/routes/ml-mtf-predictions.ts`

#### GET /api/ml/mtf/predictions/:symbol

Get multi-timeframe LSTM predictions.

**Query Parameters:**
- `timeframe`: Optional (1m, 5m, 15m, 1h, 4h, 1d) - return single timeframe
- `includeReasons`: Include reasoning text (default: true)

**Response (All Timeframes):**
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
      "timeframe": "1h",
      "direction": "BULLISH",
      "confidence": 0.78,
      "strength": 78,
      "price": 42650.25,
      "priceChangePct": 0.85,
      "riskScore": 35,
      "riskLevel": "MODERATE",
      "volatility": 0.032,
      "regimeDuration": "5.5 hours",
      "weight": 0.25
    },
    // ... more timeframes
  ],
  "aggregatedMetrics": {
    "avgRiskScore": 38.2,
    "maxVolatility": 0.045,
    "shortestRegimeDuration": "45 minutes",
    "velocityConfidenceAvg": 0.68
  }
}
```

**Response (Single Timeframe):**
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
      "predicted": 42650.25,
      "changePct": 0.85,
      "highBand": 42800,
      "lowBand": 42500
    },
    "riskScore": 35,
    "riskLevel": "MODERATE"
  },
  "weight": 0.25,
  "reasoning": {
    "direction": "Price momentum above 20-period MA with positive MACD divergence",
    "riskFactors": [
      "Moderate volatility (3.2%)",
      "Low regime change risk",
      "RSI not overbought (62/100)"
    ]
  }
}
```

#### POST /api/ml/mtf/enhance-signal

Enhance scanner signal with ML metrics and alignment check.

**Request:**
```json
{
  "symbol": "BTC/USDT",
  "direction": "LONG",
  "entry": 42500,
  "stopLoss": 42000,
  "takeProfit": 43500
}
```

**Response:**
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

#### GET /api/ml/mtf/backtest

Retrieve historical backtest results.

**Query Parameters:**
- `symbol`: Trading pair (required)
- `timeframe`: 1m, 5m, 15m, 1h, 4h, 1d (required)
- `limit`: Number of trades (default: 100)

**Response:**
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
    }
  ]
}
```

#### POST /api/ml/mtf/backtest/run

Run backtest for symbol/timeframe period.

**Request:**
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

**Response:**
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

#### GET /api/ml/mtf/confidence/:symbol

Get confidence metrics by timeframe.

**Response:**
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
      "timeframe": "1h",
      "direction": "BULLISH",
      "confidence": 0.78,
      "strength": 78,
      "probability": 0.72,
      "riskScore": 35,
      "volatility": 0.032,
      "regimeDuration": "5.5 hours",
      "weight": 0.25
    },
    // ... more timeframes
  ],
  "aggregated": {
    "avgRiskScore": 38.2,
    "maxVolatility": 0.045,
    "shortestRegimeDuration": "45 minutes",
    "velocityConfidenceAvg": 0.68
  }
}
```

#### POST /api/ml/mtf/backtest/multi-exchange

Compare backtest results across exchanges.

**Request:**
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "startDate": "2023-09-01T00:00:00Z",
  "endDate": "2023-12-01T00:00:00Z",
  "exchanges": ["binance", "coinbase", "kraken"]
}
```

**Response:**
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

## Implementation Steps

### 1. Initialize Services

In your main Express app:

```typescript
// server/app.ts or main entry point
import mlMtfPredictionsRouter from './routes/ml-mtf-predictions';

// Register routes
app.use('/api/ml/mtf', mlMtfPredictionsRouter);

console.log('[App] ML Multi-Timeframe routes registered');
```

### 2. Integrate with Scanner Signal Endpoint

Update scanner signal endpoint to include ML metrics:

```typescript
// server/routes/scanner-signal.ts
import { multiTimeframeMLService } from '../services/multi-timeframe-ml-service';

router.get('/signals/:symbol', async (req, res) => {
  try {
    const scannerSignal = await scannerSignalService.computeSignal(symbol);
    
    // Add ML metrics
    const mlMetrics = await multiTimeframeMLService.getPredictions(symbol);
    const enhanced = mlMetrics 
      ? await multiTimeframeMLService.enhanceScannerSignal(
          symbol,
          scannerSignal.direction,
          scannerSignal.entry,
          scannerSignal.stopLoss,
          scannerSignal.takeProfit
        )
      : null;

    return res.json({
      ...scannerSignal,
      mlMetrics: enhanced || { message: 'No ML data available' },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
```

### 3. Create Backtest Worker (Optional)

For async backtest execution:

```typescript
// server/jobs/backtest-worker.ts
import { Queue } from 'bullmq';
import { lstmBacktestEngine } from '../services/lstm-backtest-engine';

const backtestQueue = new Queue('backtest', {
  connection: { host: 'localhost', port: 6379 }
});

backtestQueue.process(async (job) => {
  const { symbol, timeframe, startDate, endDate } = job.data;
  
  console.log(`[Backtest Worker] Starting: ${symbol} ${timeframe}`);
  
  const result = await lstmBacktestEngine.backtest({
    symbol,
    timeframe,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  
  return result;
});

export default backtestQueue;
```

### 4. Update Frontend Components

Display ML predictions on signals page:

```typescript
// frontend/components/SignalDetail.tsx
import { useQuery } from '@tanstack/react-query';

export function SignalDetail({ symbol }: { symbol: string }) {
  const { data: predictions } = useQuery({
    queryKey: ['ml-predictions', symbol],
    queryFn: () => fetch(`/api/ml/mtf/predictions/${symbol}`).then(r => r.json()),
  });

  return (
    <div>
      <h2>ML Consensus</h2>
      <p>Direction: {predictions?.consensus.direction}</p>
      <p>Confidence: {(predictions?.consensus.confidence * 100).toFixed(1)}%</p>
      
      <h3>By Timeframe</h3>
      <table>
        <thead>
          <tr>
            <th>Timeframe</th>
            <th>Direction</th>
            <th>Confidence</th>
            <th>Risk Score</th>
            <th>Weight</th>
          </tr>
        </thead>
        <tbody>
          {predictions?.timeframes.map(tf => (
            <tr key={tf.timeframe}>
              <td>{tf.timeframe}</td>
              <td>{tf.direction}</td>
              <td>{(tf.confidence * 100).toFixed(1)}%</td>
              <td>{tf.riskScore}</td>
              <td>{(tf.weight * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Configuration

### MultiTimeframeMLService Config

```typescript
// server/config/ml-config.ts
export const ML_CONFIG = {
  // Timeframe weights (must sum to 1.0)
  timeframeWeights: {
    '1m': 0.05,
    '5m': 0.10,
    '15m': 0.15,
    '1h': 0.25,
    '4h': 0.25,
    '1d': 0.20,
  },
  
  // Consensus thresholds
  consensus: {
    strongBullish: 0.70,  // 70% bullish predictions
    strongBearish: 0.70,  // 70% bearish predictions
    neutral: 0.50,        // Between 50-70% either way
  },
  
  // Cache settings
  cache: {
    ttl: 300000,          // 5 minutes
    maxSize: 1000,        // Max cached symbols
  },
  
  // Risk thresholds
  riskLevels: {
    LOW: 30,
    MODERATE: 50,
    HIGH: 70,
    CRITICAL: 85,
  },
};
```

### Backtest Config

```typescript
// Default backtest parameters
const defaultBacktestConfig = {
  targetProfitPercent: 2.0,    // 2% profit target
  stopLossPercent: 1.0,        // 1% stop loss
  commissionPercent: 0.1,      // 0.1% commission per trade
  maxHoldCandles: 10,          // Close trade after 10 candles
};
```

## Consensus Logic

### Direction Determination

```
IF bullishTimeframes > bearishTimeframes * 1.5
  Direction = BULLISH
ELSE IF bearishTimeframes > bullishTimeframes * 1.5
  Direction = BEARISH
ELSE
  Direction = NEUTRAL
```

### Confidence Calculation

```
confidence = SUM(timeframe prediction confidence × timeframe weight)

Example:
- 1h confidence 0.78 × weight 0.25 = 0.195
- 4h confidence 0.72 × weight 0.25 = 0.180
- 1d confidence 0.68 × weight 0.20 = 0.136
- Total confidence = 0.511 + other timeframes = 0.725
```

### Alignment Scoring

```
alignment_score = (timeframes_agreeing / total_timeframes) × 100

Example:
- 5 out of 6 timeframes bullish
- alignment_score = (5 / 6) × 100 = 83%
```

## Backtest Metrics Explained

### Win Rate
- **Formula:** `(Winning Trades / Total Trades) × 100%`
- **Interpretation:** Percentage of profitable trades
- **Target:** > 50% indicates statistical edge

### Sharpe Ratio
- **Formula:** `(Average Return - Risk-Free Rate) / Standard Deviation`
- **Interpretation:** Risk-adjusted returns
- **Target:** > 1.0 is good, > 2.0 is excellent

### Max Drawdown
- **Formula:** `(Peak Value - Trough Value) / Peak Value × 100%`
- **Interpretation:** Largest peak-to-trough decline
- **Target:** < -5% is acceptable for crypto

### Profit Factor
- **Formula:** `Gross Profit / Gross Loss`
- **Interpretation:** Profit generated per unit risk
- **Target:** > 1.5 indicates profitable system

### Recovery Factor
- **Formula:** `Net Profit / Max Drawdown`
- **Interpretation:** How quickly gains recover from drawdowns
- **Target:** > 3.0 is good

## Error Handling

### Common Issues

**1. No Model Available**
```json
{
  "error": "No trained model available for this symbol",
  "message": "Train model first using POST /api/ml/mtf/train",
  "symbol": "XYZ/USDT"
}
```

**Solution:** Ensure LSTM model is trained for the symbol.

**2. Insufficient Historical Data**
```json
{
  "error": "Not enough historical data for backtest",
  "required": 500,
  "available": 150
}
```

**Solution:** Use earlier start date or different timeframe.

**3. Invalid Timeframe**
```json
{
  "error": "Invalid timeframe. Must be one of: 1m, 5m, 15m, 1h, 4h, 1d"
}
```

**Solution:** Use valid timeframe from the list.

## Performance Optimization

### Caching Strategy

1. **Predictions Cache (5 min TTL)**
   - Key: `ml:predictions:{symbol}`
   - Stores: Latest predictions for all timeframes
   - Invalidate: On new model training

2. **Backtest Results Cache (24 hr TTL)**
   - Key: `ml:backtest:{symbol}:{timeframe}:{date_range}`
   - Stores: Complete backtest results
   - Invalidate: Manual or on data update

### Batch Operations

Get predictions for multiple symbols:

```typescript
const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const predictions = await Promise.all(
  symbols.map(s => multiTimeframeMLService.getPredictions(s))
);
```

### Parallel Backtests

Run backtests across multiple timeframes:

```typescript
const timeframes = ['1h', '4h', '1d'];
const results = await Promise.all(
  timeframes.map(tf => 
    lstmBacktestEngine.backtest({
      symbol: 'BTC/USDT',
      timeframe: tf,
      startDate, endDate
    })
  )
);
```

## Monitoring & Logging

### Key Metrics to Monitor

1. **Prediction Accuracy**
   - Track directional accuracy against actual price
   - Monthly accuracy trend

2. **Consensus Quality**
   - Distribution of confidence scores
   - How often 100% of timeframes agree

3. **Backtest Performance**
   - Win rate consistency across timeframes
   - Drawdown patterns

4. **System Health**
   - Cache hit rate
   - API response times
   - Error rates

### Log Levels

```typescript
console.log('[ML MTF API] Normal operation')       // INFO
console.warn('[ML MTF API] Degraded performance') // WARN
console.error('[ML MTF API] Failed operation')     // ERROR
```

## Testing

### Unit Tests

```typescript
// test/ml-mtf.test.ts
import { multiTimeframeMLService } from '../services/multi-timeframe-ml-service';

describe('MultiTimeframeMLService', () => {
  test('should calculate consensus correctly', () => {
    // ... test implementation
  });

  test('should enhance scanner signal with ML', () => {
    // ... test implementation
  });
});
```

### Integration Tests

```typescript
// test/ml-mtf-integration.test.ts
describe('ML MTF Integration', () => {
  test('GET /api/ml/mtf/predictions/:symbol returns consensus', async () => {
    const res = await request(app).get('/api/ml/mtf/predictions/BTC/USDT');
    expect(res.status).toBe(200);
    expect(res.body.consensus).toBeDefined();
  });
});
```

## Production Checklist

- [ ] All services initialized and registered
- [ ] Routes mounted on main Express app
- [ ] Cache configured and tested
- [ ] Backtest data source verified
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Rate limiting applied
- [ ] API documentation deployed
- [ ] Frontend components updated
- [ ] Load testing completed
- [ ] Monitoring alerts configured
- [ ] Disaster recovery plan in place

## Next Steps

1. **Real-Time Updates:** Stream predictions to connected clients
2. **Alert System:** Notify on high-confidence signals
3. **Portfolio Analysis:** Aggregate predictions across portfolio symbols
4. **Strategy Optimization:** Backtest parameter variations
5. **Machine Learning Feedback:** Improve predictions based on backtest results

