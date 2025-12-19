# Scanner Signal Integration Guide

## Overview

The Scanner Signal Service provides a unified API for computing technical analysis signals with integrated risk management targets. It combines momentum-based signal classification with position sizing and risk/reward calculations to produce actionable trading signals.

## Architecture

### Components

1. **ScannerSignal Schema** (`scanner-signal.ts`)
   - Defines the complete signal structure with targets
   - Extends MomentumScoreResult with risk management fields
   - Supports batch operations and caching

2. **ScannerSignalService** (`scanner-signal-service.ts`)
   - Orchestrates signal computation
   - Integrates MomentumScanner with RiskManagement
   - Manages signal caching and statistics

3. **Scanner Signal Routes** (`routes/scanner-signal.ts`)
   - REST API endpoints for signal computation
   - Batch processing support
   - Cache management endpoints

### Data Flow

```
Market Data Input
       ↓
Market Frame Conversion
       ↓
MomentumScanner.computeScore() ──→ Momentum Signal
       ↓
RiskManagement.calculateStopLossTakeProfit() ──→ Targets
       ↓
ScannerSignalTargets Calculation
       ↓
Complete ScannerSignal Output
```

## API Endpoints

### 1. Compute Single Signal

**POST** `/api/scanner/signal/compute`

Compute a single scanner signal with risk management targets.

#### Request Body

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "marketData": {
    "open": [40000, 40100, 40200, 40300, 40400],
    "high": [40100, 40200, 40300, 40400, 40500],
    "low": [39900, 40000, 40100, 40200, 40300],
    "close": [40050, 40150, 40250, 40350, 40450],
    "volume": [1000, 1100, 1200, 1300, 1400],
    "timestamp": [1234567890000, 1234568490000, 1234569090000, 1234569690000, 1234570290000]
  },
  "accountBalance": 10000,
  "riskPerTradePct": 1,
  "leverage": 1,
  "riskRewardRatio": 2.5,
  "feeRate": 0.001
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Trading pair (e.g., "BTC/USDT") |
| timeframe | string | Yes | Candle timeframe (e.g., "1h", "4h", "1d") |
| marketData | object | Yes | OHLCV data arrays |
| marketData.open | number[] | Yes | Open prices |
| marketData.high | number[] | Yes | High prices |
| marketData.low | number[] | Yes | Low prices |
| marketData.close | number[] | Yes | Close prices |
| marketData.volume | number[] | No | Volume values |
| marketData.timestamp | number[] | No | Unix timestamps in ms |
| accountBalance | number | No | Account balance for position sizing |
| riskPerTradePct | number | No | Risk percentage per trade (0-100) |
| leverage | number | No | Leverage multiplier (default: 1) |
| riskRewardRatio | number | No | Target R:R ratio (default: 2.5) |
| atr | number | No | Pre-calculated ATR |
| bbUpper | number | No | Pre-calculated Bollinger Band upper |
| bbLower | number | No | Pre-calculated Bollinger Band lower |
| supportLevel | number | No | Support level override |
| resistanceLevel | number | No | Resistance level override |
| feeRate | number | No | Fee rate for calculations (default: 0.001) |

#### Response

```json
{
  "success": true,
  "signal": {
    "score": 0.45,
    "signal": "Buy",
    "signalStrength": 78,
    "confidence": 0.82,
    "reason": "signal:Buy | regime:Bull | state:Bullish | macd:0.000234 | rsi:65.2 | volRatio:1.15",
    "regime": "Bull",
    "regimeConfidence": 0.75,
    "passesQualityGate": true,
    "qualityGateReason": "Signal meets quality threshold",
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "timestamp": 1234570290000,
    "source": "momentum",
    "version": "2.0.0",
    "executionTimeMs": 12,
    "targets": {
      "entryPrice": 40450,
      "entryPriceConfidence": 0.95,
      "stopLoss": 39500,
      "takeProfit": 42000,
      "supportLevel": 38000,
      "resistanceLevel": 42500,
      "riskAmount": 950,
      "rewardAmount": 1550,
      "riskRewardRatio": 1.63,
      "stopLossPct": -2.35,
      "takeProfitPct": 3.81,
      "recommendedPositionSize": 0.25,
      "recommendedPositionValue": 10112.50,
      "recommendedRiskPercentage": 1,
      "marginRequired": 10112.50,
      "maximumLeverage": 10,
      "recommendedLeverage": 1,
      "liquidationPrice": null
    },
    "indicators": {
      "macdHistLast": 0.000234,
      "macdHistPrev": 0.000201,
      "macdMomentum": 0.000033,
      "rsiLast": 65.2,
      "slope": 0.0045,
      "momentum1d": 0.0125,
      "momentum7d": 0.0234,
      "momentum30d": 0.0567,
      "volRatio": 1.15,
      "meanPrice": 40250,
      "vwapLast": 40200,
      "vwapGap": 0.062,
      "bbPosition": 0.75,
      "bbUpper": 40800,
      "bbLower": 39700,
      "trendStrength": 0.68,
      "volatility": 0.45,
      "atrPct": 1.23,
      "compositeScore": 69.2,
      "fib": {
        "direction": "up",
        "nearestRetracement": 39850,
        "nearestExtension": 41200
      }
    }
  },
  "warnings": []
}
```

### 2. Compute Batch Signals

**POST** `/api/scanner/signal/compute-batch`

Compute multiple scanner signals in a single request.

#### Request Body

```json
{
  "signals": [
    {
      "symbol": "BTC/USDT",
      "timeframe": "1h",
      "marketData": { ... }
    },
    {
      "symbol": "ETH/USDT",
      "timeframe": "4h",
      "marketData": { ... }
    }
  ],
  "options": {
    "stopOnError": false,
    "parallel": true
  }
}
```

#### Response

```json
{
  "results": [
    {
      "success": true,
      "signal": { ... }
    },
    {
      "success": true,
      "signal": { ... }
    }
  ],
  "totalComputed": 2,
  "failedCount": 0,
  "executionTimeMs": 24
}
```

### 3. Get Cached Signal

**GET** `/api/scanner/signal/cached/:symbol/:timeframe`

Retrieve a previously computed signal from cache.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Trading pair (e.g., "BTC/USDT") |
| timeframe | string | Yes | Timeframe (e.g., "1h") |

#### Response

```json
{
  "success": true,
  "signal": { ... },
  "cached": true
}
```

### 4. Clear Cache

**DELETE** `/api/scanner/signal/cache`

Clear signal cache for optimization.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | No | Clear cache for specific symbol only |

#### Response

```json
{
  "success": true,
  "message": "Cache cleared for all symbols"
}
```

### 5. Service Health

**GET** `/api/scanner/signal/health`

Check scanner signal service health.

#### Response

```json
{
  "success": true,
  "service": "scanner-signal-service",
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2024-01-15T10:30:45Z"
}
```

### 6. Validate Signal Request

**POST** `/api/scanner/signal/validate`

Validate signal request without computing.

#### Request Body

```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "marketData": { ... }
}
```

#### Response

```json
{
  "success": true,
  "valid": true,
  "message": "Signal request is valid"
}
```

## Signal Structure

### MomentumScoreResult Fields

| Field | Type | Description |
|-------|------|-------------|
| score | number | Composite score from -1 (strong sell) to +1 (strong buy) |
| signal | string | Signal classification (Strong Buy/Buy/Weak Buy/Neutral/Weak Sell/Sell/Strong Sell) |
| signalStrength | number | Signal strength 0-100 |
| confidence | number | Confidence score 0-1 |
| reason | string | Detailed signal reason |
| regime | string | Market regime (Bull/Bear/Ranging) |
| regimeConfidence | number | Regime confidence 0-1 |
| passesQualityGate | boolean | Whether signal meets quality thresholds |
| qualityGateReason | string | Reason for quality gate pass/fail |
| indicators | object | Detailed indicator values |

### ScannerSignalTargets Fields

| Field | Type | Description |
|-------|------|-------------|
| entryPrice | number | Current entry price |
| entryPriceConfidence | number | Confidence in entry price (0-1) |
| stopLoss | number | Stop-loss level |
| takeProfit | number | Take-profit level |
| supportLevel | number | Support level (if available) |
| resistanceLevel | number | Resistance level (if available) |
| riskAmount | number | Risk amount in USD/quote |
| rewardAmount | number | Reward/profit amount |
| riskRewardRatio | number | Ratio of reward to risk |
| stopLossPct | number | Stop-loss as percentage |
| takeProfitPct | number | Take-profit as percentage |
| recommendedPositionSize | number | Position size in units |
| recommendedPositionValue | number | Position value in quote currency |
| recommendedRiskPercentage | number | Risk percentage of account |
| marginRequired | number | Margin required for position |
| maximumLeverage | number | Maximum allowed leverage |
| recommendedLeverage | number | Recommended leverage |
| liquidationPrice | number \| null | Liquidation price if leveraged |

## Usage Examples

### Example 1: Basic Signal Computation

```typescript
import ScannerSignalService from './services/scanner/scanner-signal-service';

const signal = ScannerSignalService.computeSignal({
  symbol: 'BTC/USDT',
  timeframe: '1h',
  marketData: {
    open: [40000, 40100, 40200, 40300, 40400],
    high: [40100, 40200, 40300, 40400, 40500],
    low: [39900, 40000, 40100, 40200, 40300],
    close: [40050, 40150, 40250, 40350, 40450],
    volume: [1000, 1100, 1200, 1300, 1400],
  },
});

if (signal.success) {
  console.log('Signal:', signal.signal.signal);
  console.log('Entry:', signal.signal.targets?.entryPrice);
  console.log('Stop Loss:', signal.signal.targets?.stopLoss);
  console.log('Take Profit:', signal.signal.targets?.takeProfit);
  console.log('R:R Ratio:', signal.signal.targets?.riskRewardRatio);
}
```

### Example 2: Signal with Position Sizing

```typescript
const signal = ScannerSignalService.computeSignal({
  symbol: 'ETH/USDT',
  timeframe: '4h',
  marketData: {
    open: [2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450],
    high: [2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450, 2500],
    low: [1950, 2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400],
    close: [2025, 2075, 2125, 2175, 2225, 2275, 2325, 2375, 2425, 2475],
    volume: [500, 550, 600, 650, 700, 750, 800, 850, 900, 950],
  },
  accountBalance: 10000,
  riskPerTradePct: 1.5,
  leverage: 2,
  riskRewardRatio: 3,
});

if (signal.success) {
  const targets = signal.signal.targets;
  console.log('Position Size:', targets?.recommendedPositionSize);
  console.log('Margin Required:', targets?.marginRequired);
  console.log('Liquidation Price:', targets?.liquidationPrice);
}
```

### Example 3: Batch Processing

```typescript
const batchResult = ScannerSignalService.computeSignalsBatch({
  signals: [
    {
      symbol: 'BTC/USDT',
      timeframe: '1h',
      marketData: { ... }
    },
    {
      symbol: 'ETH/USDT',
      timeframe: '1h',
      marketData: { ... }
    },
    {
      symbol: 'SOL/USDT',
      timeframe: '1h',
      marketData: { ... }
    }
  ],
});

console.log(`Computed: ${batchResult.totalComputed}, Failed: ${batchResult.failedCount}`);
batchResult.results.forEach(result => {
  if (result.success) {
    console.log(`${result.signal.symbol}: ${result.signal.signal}`);
  }
});
```

### Example 4: Cache Management

```typescript
// Get cached signal
const cached = ScannerSignalService.getCachedSignal('BTC/USDT', '1h');

if (cached) {
  console.log('Using cached signal');
} else {
  // Compute new signal
  const fresh = ScannerSignalService.computeSignal({...});
}

// Clear specific symbol cache
ScannerSignalService.clearCache('BTC/USDT');

// Clear all cache
ScannerSignalService.clearCache();
```

### Example 5: Signal Statistics

```typescript
const signals = [
  signal1,
  signal2,
  signal3,
  // ... more signals
];

const stats = ScannerSignalService.generateStatistics(signals);

console.log(`Total Signals: ${stats.totalSignals}`);
console.log(`Buy Signals: ${stats.buySignals}`);
console.log(`Sell Signals: ${stats.sellSignals}`);
console.log(`Average Confidence: ${stats.averageConfidence}`);
console.log(`Quality Gate Pass Rate: ${stats.qualityGatePassRate}%`);
console.log(`Average R:R: ${stats.averageRiskRewardRatio}`);
```

## Signal Quality Indicators

### Confidence Score (0-1)

- **0.9-1.0**: Very High - Strong signal with clear indicators
- **0.7-0.89**: High - Reliable signal
- **0.5-0.69**: Medium - Moderate signal
- **0.3-0.49**: Low - Weak signal
- **< 0.3**: Very Low - Unreliable signal

### Signal Strength (0-100)

- **80-100**: Very Strong
- **60-79**: Strong
- **40-59**: Moderate
- **20-39**: Weak
- **< 20**: Very Weak

### Risk/Reward Ratio

- **3:1 or higher**: Excellent (3+ profit for 1 risk)
- **2:1**: Good (2+ profit for 1 risk)
- **1.5:1**: Fair (1.5+ profit for 1 risk)
- **1:1**: Break-even risk/reward
- **Below 1:1**: Unfavorable (avoid trading)

## Error Handling

### Common Error Scenarios

| Error | Description | Solution |
|-------|-------------|----------|
| Insufficient Data | Less than 5 data points provided | Provide at least 5 candles |
| Invalid Array Lengths | OHLCV arrays have different lengths | Ensure all arrays equal length |
| Missing Required Fields | Required field not provided | Check request parameters |
| Invalid Market Data | Price data is NaN or invalid | Validate input data quality |

### Error Response Example

```json
{
  "success": false,
  "error": "Insufficient market data. Minimum 5 candles required.",
  "signal": null
}
```

## Performance Considerations

### Caching

- Signals are cached for 5 minutes by default
- Cache is automatically cleaned when reaching 10,000 entries
- Use `clearCache()` to manually manage memory

### Batch Processing

- Maximum 100 signals per batch request
- Parallel processing enabled by default
- Recommended batch size: 10-50 signals

### Computational Time

- Single signal: 5-15ms
- Batch of 10: 20-50ms
- Batch of 100: 150-300ms

## Integration with Trading Systems

### With Paper Trading

```typescript
// Compute signal
const result = ScannerSignalService.computeSignal(request);

// Execute paper trade
if (result.success) {
  const signal = result.signal;
  const trade = await paperTrading.enterTrade({
    symbol: signal.symbol,
    type: signal.signal.includes('Buy') ? 'LONG' : 'SHORT',
    entryPrice: signal.targets.entryPrice,
    stopLoss: signal.targets.stopLoss,
    takeProfit: signal.targets.takeProfit,
    positionSize: signal.targets.recommendedPositionSize,
  });
}
```

### With Live Trading

```typescript
// Always validate before live trading
const validation = await fetch('/api/scanner/signal/validate', {
  method: 'POST',
  body: JSON.stringify(request)
});

if (validation.ok && validation.body.valid) {
  const result = ScannerSignalService.computeSignal(request);
  // Execute live trade with strict risk management
}
```

## Best Practices

1. **Always validate** signals before trading
2. **Check quality gate** - Ensure `passesQualityGate` is true
3. **Monitor confidence** - Trade only high confidence signals
4. **Use batching** for multiple symbols
5. **Cache signals** to reduce computation
6. **Validate R:R** - Ensure favorable risk/reward
7. **Check regime** - Consider market conditions
8. **Monitor indicators** - Review indicator values
9. **Test thoroughly** - Use paper trading first
10. **Track performance** - Monitor signal win rate

## Troubleshooting

### No Targets Generated

- Ensure market data has at least 14 periods (for ATR calculation)
- Verify data quality (no NaN or infinite values)
- Check if signal meets minimum requirements

### Low Confidence Signals

- May indicate choppy market conditions
- Consider waiting for stronger signals
- Review market regime

### Inconsistent Targets

- Can occur with limited historical data
- Ensure sufficient data points (20+ recommended)
- Consider longer timeframes for stability

## API Rate Limiting

- Compute Single: 100 requests/minute
- Compute Batch: 20 requests/minute
- Cache operations: Unlimited

## Support and Contributing

For issues, suggestions, or contributions, please refer to the main project documentation.

---

**Version**: 2.0.0  
**Last Updated**: 2024-01-15  
**Maintainers**: Scanner Integration Team
