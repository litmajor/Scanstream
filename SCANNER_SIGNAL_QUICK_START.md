# Scanner Signal Integration - Quick Start Guide

## 30-Second Overview

The Scanner Signal Service computes trading signals with built-in risk management targets. It combines technical analysis with position sizing to provide complete trade setup information.

## Installation

The service is built into the Scanstream project. No additional installation needed.

## Quick Start

### 1. Import the Service

```typescript
import ScannerSignalService from './services/scanner/scanner-signal-service';
```

### 2. Compute a Signal

```typescript
const result = ScannerSignalService.computeSignal({
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

if (result.success) {
  const signal = result.signal;
  console.log('Signal:', signal.signal); // "Buy", "Sell", etc.
  console.log('Entry:', signal.targets?.entryPrice);
  console.log('Stop:', signal.targets?.stopLoss);
  console.log('Target:', signal.targets?.takeProfit);
}
```

### 3. Via REST API

```bash
curl -X POST http://localhost:3000/api/scanner/signal/compute \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "marketData": {
      "open": [40000, 40100, 40200, 40300, 40400],
      "high": [40100, 40200, 40300, 40400, 40500],
      "low": [39900, 40000, 40100, 40200, 40300],
      "close": [40050, 40150, 40250, 40350, 40450],
      "volume": [1000, 1100, 1200, 1300, 1400]
    }
  }'
```

## Core Concepts

### Signal Levels

| Signal | Meaning | Action |
|--------|---------|--------|
| **Strong Buy** | Very strong bullish signal | Consider LONG entry |
| **Buy** | Bullish signal | LONG entry candidate |
| **Weak Buy** | Slight bullish bias | Wait for confirmation |
| **Neutral** | No clear direction | Hold or pass |
| **Weak Sell** | Slight bearish bias | Wait for confirmation |
| **Sell** | Bearish signal | SHORT entry candidate |
| **Strong Sell** | Very strong bearish signal | Consider SHORT entry |

### Target Fields Explained

```typescript
{
  entryPrice: 40450,        // Current price (entry point)
  stopLoss: 39500,          // Exit if price drops below this
  takeProfit: 42000,        // Exit if price rises above this
  riskAmount: 950,          // Loss if stop hit
  rewardAmount: 1550,       // Profit if target hit
  riskRewardRatio: 1.63,    // Risk:Reward ratio (higher is better)
  stopLossPct: -2.35,       // Stop as % of entry
  takeProfitPct: 3.81,      // Target as % of entry
}
```

## Common Tasks

### Get Signals for Multiple Coins

```typescript
const batchResult = ScannerSignalService.computeSignalsBatch({
  signals: [
    { symbol: 'BTC/USDT', timeframe: '1h', marketData: {...} },
    { symbol: 'ETH/USDT', timeframe: '1h', marketData: {...} },
    { symbol: 'SOL/USDT', timeframe: '1h', marketData: {...} },
  ],
});

batchResult.results.forEach(result => {
  if (result.success) {
    console.log(`${result.signal.symbol}: ${result.signal.signal}`);
  }
});
```

### Include Account Risk Management

```typescript
const result = ScannerSignalService.computeSignal({
  symbol: 'BTC/USDT',
  timeframe: '1h',
  marketData: {...},
  
  // Risk management
  accountBalance: 10000,      // $10,000 account
  riskPerTradePct: 1,         // Risk 1% per trade
  leverage: 2,                // 2x leverage
  riskRewardRatio: 2.5,       // Target 2.5:1 risk/reward
});

// Now includes position sizing
console.log('Position Size:', result.signal.targets?.recommendedPositionSize);
console.log('Margin Req:', result.signal.targets?.marginRequired);
```

### Check Cached Signal

```typescript
// Signals are cached for 5 minutes
const cached = ScannerSignalService.getCachedSignal('BTC/USDT', '1h');

if (cached) {
  console.log('Using cached signal (fast)');
} else {
  const fresh = ScannerSignalService.computeSignal({...});
}
```

### Clear Cache If Needed

```typescript
// Clear for one symbol
ScannerSignalService.clearCache('BTC/USDT');

// Clear everything
ScannerSignalService.clearCache();
```

## Trading Rules

### For Buy Signals

1. ✅ Entry at `entryPrice`
2. ✅ Stop loss at `stopLoss`
3. ✅ Take profit at `takeProfit`
4. ✅ Position size: `recommendedPositionSize` units

```
              takeProfit ─────────────── Exit if profit hit
                    ↑
    Entry Price ────── Buy Here
                    ↓
               stopLoss ─────────────── Exit if loss hit
```

### For Sell Signals

1. ✅ Entry at `entryPrice`
2. ✅ Stop loss at `stopLoss` (above entry)
3. ✅ Take profit at `takeProfit` (below entry)
4. ✅ Position size: `recommendedPositionSize` units

```
               stopLoss ─────────────── Exit if loss hit
                    ↑
    Entry Price ────── Sell Here
                    ↓
             takeProfit ─────────────── Exit if profit hit
```

## Quality Checks

### Before Trading

```typescript
if (result.success && result.signal.passesQualityGate) {
  // Check confidence
  if (result.signal.confidence > 0.7) {
    // Check risk/reward
    if (result.signal.targets?.riskRewardRatio > 1.5) {
      // Signal is good to trade
      console.log('✅ Signal cleared for trading');
    }
  }
}
```

### Signal Quality Levels

- **Confidence > 0.8**: Excellent
- **Confidence > 0.7**: Good
- **Confidence > 0.5**: Fair
- **Confidence < 0.5**: Weak (consider skipping)

## Response Status Codes

```typescript
// SUCCESS
{
  success: true,
  signal: { ... },
  warnings: []
}

// VALIDATION ERROR
{
  success: false,
  error: "Insufficient market data. Minimum 5 candles required.",
  signal: null
}

// SERVER ERROR
{
  success: false,
  error: "Internal server error",
  signal: null
}
```

## Performance Tips

1. **Use batching** for multiple symbols (faster than individual calls)
2. **Check cache** before computing new signals
3. **Limit batch size** to 50-100 signals per request
4. **Use longer timeframes** for stability (4h, 1d)
5. **Cache signals** for 5 minutes minimum

## Typical Response Time

- **Single Signal**: 10-15ms
- **Batch of 10**: 30-50ms
- **Batch of 100**: 200-300ms

## Data Requirements

**Minimum**: 5 candles
**Recommended**: 50+ candles for stability
**Optimal**: 100+ candles for best results

## Common Issues & Solutions

### Issue: "Insufficient market data"
- **Solution**: Provide at least 5 data points

### Issue: Low confidence signal
- **Solution**: Market is choppy, wait for clearer signal

### Issue: High R:R but no position recommended
- **Solution**: Check account risk settings

### Issue: Signal changes rapidly
- **Solution**: Use longer timeframes (4h, 1d instead of 1m)

## Next Steps

1. **Read Full Guide**: [SCANNER_SIGNAL_INTEGRATION_GUIDE.md](./SCANNER_SIGNAL_INTEGRATION_GUIDE.md)
2. **Run Tests**: `pnpm test scanner-signal`
3. **Try Examples**: Check `/examples` directory
4. **Monitor Performance**: Track signal win rate
5. **Optimize Settings**: Adjust risk/reward ratios

## Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/scanner/signal/compute` | Compute single signal |
| POST | `/api/scanner/signal/compute-batch` | Compute multiple signals |
| GET | `/api/scanner/signal/cached/:symbol/:timeframe` | Get cached signal |
| DELETE | `/api/scanner/signal/cache` | Clear cache |
| GET | `/api/scanner/signal/health` | Check service health |
| POST | `/api/scanner/signal/validate` | Validate request |

## API Key Points

- **All prices**: In quote currency (e.g., USDT for BTC/USDT)
- **All volumes**: In base currency (e.g., BTC for BTC/USDT)
- **All percentages**: As decimals (0.5 = 0.5%, 1.5 = 1.5%)
- **All arrays**: Must have equal length
- **Timestamps**: Unix milliseconds

## Support

- Check logs: Look for `[Scanner Signal]` entries
- Health check: `GET /api/scanner/signal/health`
- Performance metrics: Available in signal response

---

**Quick Reference Version**: 2.0.0  
**For full documentation**: See SCANNER_SIGNAL_INTEGRATION_GUIDE.md
