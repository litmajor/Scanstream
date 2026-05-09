# Quick Start: CCXT + Multi-Timeframe Fetcher

## TL;DR - Get Running in 2 Commands

```bash
# 1. Run the fetcher
npx tsx scripts/fetch-multi-timeframe.ts

# 2. Data ready in ./data/cache/multi-timeframe/
```

## What You Just Got

✅ **13,120 candles** across 2 symbols, 12 timeframes  
✅ **Orderflow data** (buy/sell volumes, ratios) included  
✅ **CCXT ready** for real orderbook microstructure enrichment  
✅ **24 JSON files** ready for agent consumption  

## File Structure

```
data/cache/multi-timeframe/
├── BTCUSDT/
│   ├── BTCUSDT_1m.json   (1000 candles)
│   ├── BTCUSDT_3m.json
│   ├── BTCUSDT_5m.json
│   ├── BTCUSDT_15m.json
│   ├── BTCUSDT_30m.json
│   ├── BTCUSDT_1h.json   (720 candles - full 30 days)
│   ├── BTCUSDT_2h.json
│   ├── BTCUSDT_4h.json
│   ├── BTCUSDT_6h.json
│   ├── BTCUSDT_8h.json
│   ├── BTCUSDT_12h.json
│   └── BTCUSDT_1d.json   (30 candles)
└── ETHUSDT/
    └── (same 12 timeframes)
```

## Data Format Sample

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "candles": 720,
  "hasOrderFlow": true,
  "dateRange": {
    "start": "2025-12-10T14:00:00.000Z",
    "end": "2026-01-09T13:00:00.000Z"
  },
  "data": [
    {
      "timestamp": 1765375200000,
      "open": 92093.65,
      "high": 92112.57,
      "low": 91600.81,
      "close": 91831.24,
      "volume": 883.61,
      "orderFlow": {
        "timestamp": 1765375200000,
        "symbol": "BTCUSDT",
        "interval": "1h",
        "buyVolume": 380.58,
        "sellVolume": 503.03,
        "buyCount": 140532,
        "sellCount": 185750,
        "netVolume": -122.46,
        "volumeRatio": 0.431,
        "dominantSide": "SELL"
      }
    }
  ]
}
```

## Using Data in Your Code

### Load Data:
```typescript
import { BinanceDataFetcher } from './server/services/vfmd/binanceDataFetcher';

const fetcher = new BinanceDataFetcher();
const data = await fetcher.fetchMultiTimeframeData(
  ['BTCUSDT', 'ETHUSDT'],
  30,    // days
  true   // include orderflow
);
```

### Access Candles:
```typescript
// Get BTCUSDT 1h candles
const btcHourly = data.get('BTCUSDT').get('1h');

// Latest candle
const latest = btcHourly[btcHourly.length - 1];
console.log(`Close: $${latest.close}`);
console.log(`Volume: ${latest.volume} BTC`);

// Orderflow metrics
const flow = latest.orderFlow;
console.log(`Buy Ratio: ${(flow.volumeRatio * 100).toFixed(1)}%`);
console.log(`Dominant: ${flow.dominantSide}`);
console.log(`Net Volume: ${flow.netVolume.toFixed(2)} BTC`);
```

### Filter by Time:
```typescript
const oneHourAgo = Date.now() - 3600000;
const recentCandles = btcHourly.filter(
  c => c.timestamp > oneHourAgo
);
```

### Agent Integration:
```typescript
// Pass to VFMD agent
vfmdAgent.processOrderFlow(latest.orderFlow);

// Pass to microstructure agent
microstructureAgent.analyzeBuySellPressure(
  flow.buyVolume,
  flow.sellVolume
);

// Exit signal confirmation
if (flow.dominantSide === 'SELL') {
  exitAgent.confirmBearishSignal();
}
```

## CCXT Orderbook Microstructure

### Current Status:
- ✅ CCXT initialized (lazy)
- ✅ Method implemented
- ⏳ Live microstructure enrichment ready (latest candle only)

### Future Enrichment:
```typescript
// Will add to latest candle's orderFlow:
{
  bidVolume: 45678.90,     // Real bid depth (top 20 levels)
  askVolume: 43212.34,     // Real ask depth
  spread: 0.05,            // Bid-ask spread
  spreadPercent: 0.0001,   // Spread as % of price
  imbalance: 0.514,        // bidVolume / (bid + ask)
  bidAskRatio: 1.057,      // bidVolume / askVolume
  depth: 88891.24,         // Total liquidity
  hasMicrostructure: true  // Flag: real data present
}
```

## Key Metrics Explained

| Metric | Range | Meaning |
|--------|-------|---------|
| `volumeRatio` | 0.0 - 1.0 | Buy pressure (0.5 = neutral) |
| `dominantSide` | BUY/SELL/NEUTRAL | Trend direction |
| `netVolume` | -∞ to +∞ | Cumulative buy/sell difference |
| `buyCount` | 0 to ∞ | Number of buy trades |
| `sellCount` | 0 to ∞ | Number of sell trades |
| `spread` | + value | Bid-ask gap (cents) |
| `imbalance` | 0.0 - 1.0 | Order book tilt (0.5 = balanced) |
| `bidAskRatio` | + value | Bid depth / ask depth |

## Troubleshooting

**Q: How do I run this again?**
```bash
npx tsx scripts/fetch-multi-timeframe.ts
```

**Q: Can I fetch different symbols?**
```typescript
await fetcher.fetchMultiTimeframeData(
  ['BNBUSDT', 'SOLUSDT'],  // Your symbols
  30,
  true
);
```

**Q: Can I fetch different timeframes?**
Check `allTimeframes` in binanceDataFetcher.ts. Currently: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d

**Q: Where are the cache files?**
`./data/cache/multi-timeframe/` (automatically created)

**Q: Why no microstructure data yet?**
Live orderbook (hasMicrostructure:true) only for latest candle. Run test script to verify:
```bash
npx tsx scripts/test-ccxt-microstructure.ts
```

## Performance

- **Execution Time**: ~30 seconds for 2 symbols × 12 timeframes
- **Data Size**: ~7 MB total
- **Update Frequency**: As often as you run the script
- **Rate Limits**: Handled automatically (Binance API + CCXT)

## Next Steps

1. ✅ **Data fetched** - Done!
2. 📊 **Analyze** - Load in your agent systems
3. 🔄 **Schedule** - Set up automated fetches
4. 📈 **Backtest** - Use for strategy validation
5. 🚀 **Deploy** - Feed live agents with data

## Architecture Summary

```
BinanceDataFetcher
├─ Layer 1: Kline Orderflow (Historical)
│  ├─ Binance REST API → takerBuyBaseVolume
│  ├─ Calculate ratios & dominant side
│  └─ ✅ Implemented & active
│
└─ Layer 2: CCXT Orderbook (Live/Optional)
   ├─ CCXT Binance exchange
   ├─ Real bid/ask depth (top 20 levels)
   ├─ Spread, imbalance, depth metrics
   └─ ✅ Ready for enrichment (latest candles)
```

---

**For detailed docs, see:**
- `CCXT_INTEGRATION_GUIDE.md` - Comprehensive guide
- `MULTI_TIMEFRAME_EXECUTION_REPORT.md` - Full execution report
- `CCXT_QUICK_REFERENCE.txt` - Quick ref card

**Last Updated**: 2026-01-09  
**Status**: ✅ Production Ready
