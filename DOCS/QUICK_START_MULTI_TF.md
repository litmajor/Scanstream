# 🚀 Quick Start: Multi-Timeframe Data Fetcher

## One-Command Setup

```bash
# Run the multi-timeframe fetcher
pnpm run fetch:multi-tf
```

That's it! This will:
- ✅ Fetch all 13 timeframes (1m to 1d)
- ✅ Download data for BTCUSDT and ETHUSDT
- ✅ Collect orderflow metrics
- ✅ Save to `./data/cache/multi-timeframe/`
- ✅ Provide detailed summary and statistics

## What Gets Fetched

```
13 Timeframes × 2 Symbols = 26 Files
├── 1m, 3m, 5m, 15m, 30m        (Intra-hour)
├── 1h, 2h, 4h, 6h, 8h, 12h     (Intra-day)
└── 1d                            (Daily)

For:
├── BTCUSDT (Bitcoin)
└── ETHUSDT (Ethereum)

Each contains:
✓ OHLCV data (Open, High, Low, Close, Volume)
✓ Orderflow metrics
  - Buy/Sell volumes
  - Volume ratio (0-1, >0.55 = buy bias)
  - Dominant side (BUY/SELL/NEUTRAL)
  - Net volume
```

## Output Location

```
data/cache/multi-timeframe/
├── BTCUSDT/
│   ├── BTCUSDT_1m.json      ← 1-minute candles + orderflow
│   ├── BTCUSDT_5m.json      ← 5-minute candles + orderflow
│   ├── BTCUSDT_1h.json      ← hourly candles + orderflow
│   ├── BTCUSDT_4h.json      ← 4-hour candles + orderflow
│   ├── BTCUSDT_1d.json      ← daily candles + orderflow
│   └── ...                   (11 more timeframes)
└── ETHUSDT/
    └── ... (same structure for Ethereum)
```

## JSON File Format

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "candles": 720,
  "hasOrderFlow": true,
  "dateRange": {
    "start": "2025-12-10T00:00:00.000Z",
    "end": "2026-01-09T23:00:00.000Z"
  },
  "data": [
    {
      "timestamp": 1702176000000,
      "open": 42150.25,
      "high": 42500.75,
      "low": 42000.00,
      "close": 42350.50,
      "volume": 1250.5,
      "orderFlow": {
        "buyVolume": 750.3,
        "sellVolume": 500.2,
        "buyCount": 1250,
        "sellCount": 950,
        "netVolume": 250.1,
        "volumeRatio": 0.60,        // 60% buy volume
        "dominantSide": "BUY"       // >55% buy bias
      }
    },
    ...
  ]
}
```

## Usage in Code

### Load cached data
```typescript
import { BinanceDataFetcher } from './server/services/vfmd/binanceDataFetcher';

const data = BinanceDataFetcher.loadFromFile(
  './data/cache/multi-timeframe/BTCUSDT/BTCUSDT_1h.json'
);

// Use in your strategy
for (const candle of data.data) {
  console.log(`Price: ${candle.close}, Buy%: ${(candle.orderFlow?.volumeRatio * 100).toFixed(1)}%`);
}
```

### Fetch fresh data programmatically
```typescript
const fetcher = new BinanceDataFetcher();

const allData = await fetcher.fetchMultiTimeframeData(
  ['BTCUSDT', 'ETHUSDT'],
  30,      // 30 days
  true     // with orderflow
);

await fetcher.saveMultiTimeframeData(allData, './custom/path/');
```

## Orderflow Interpretation

| volumeRatio | dominantSide | Interpretation |
|------------|--------------|----------------|
| > 0.55 | BUY | Strong buyer pressure |
| 0.45-0.55 | NEUTRAL | Balanced |
| < 0.45 | SELL | Strong seller pressure |

## Performance

- **Duration**: 2-4 minutes
- **API Requests**: ~52-65
- **Total Data Size**: 15-25 MB
- **Candles per symbol**: ~9,360 (30 days × 13 timeframes)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Command not found" | Run `pnpm install` first |
| "Rate limit" | Increases delay automatically, wait & retry |
| "No data" | Check internet, verify Binance API accessible |
| "Wrong date range" | Data defaults to last 30 days |

## Files Added

```
✅ server/services/vfmd/binanceDataFetcher.ts
   - New: fetchMultiTimeframeData() method
   - New: fetchOrderFlowData() method
   - New: saveMultiTimeframeData() method
   - New: OrderFlowData interface
   - New: MarketDataWithOrderFlow interface

✅ scripts/fetch-multi-timeframe.ts
   - Standalone executable script
   - Rich console output with progress
   - Data summary and statistics

✅ MULTI_TIMEFRAME_FETCHER_GUIDE.md
   - Complete reference documentation
   - API details
   - Examples and troubleshooting
```

## Integration Points

- **Backtesting Engine**: Load historical data with orderflow
- **Real-Time Scanner**: Compare with live data
- **Strategy Development**: Multi-timeframe confirmation signals
- **Risk Analysis**: Volume profile analysis
- **Market Microstructure**: Buy/sell pressure analysis

## Next Steps

1. ✅ Run fetch: `pnpm run fetch:multi-tf`
2. ✅ Verify data in `data/cache/multi-timeframe/`
3. ✅ Load in your strategy/analysis code
4. ✅ Use for backtesting or live trading

## Additional Info

For full documentation, see: `MULTI_TIMEFRAME_FETCHER_GUIDE.md`
