# Multi-Timeframe Data Fetcher

Comprehensive script to fetch all timeframe data (1m to 1d) for BTC and ETH from Binance, including orderflow analysis.

## Features

✅ **Multi-Timeframe Support**
- All timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d
- Both BTC/USDT and ETH/USDT

✅ **Orderflow Data**
- Buy/Sell volume analysis
- Volume ratio (buy dominant vs sell dominant)
- Net volume calculations
- Trading count estimates
- Dominant side detection (BUY/SELL/NEUTRAL)

✅ **Performance**
- Parallel fetching with rate limiting
- Caching support (24-hour default)
- Data validation and quality checks
- Comprehensive error handling

✅ **Data Quality**
- Validates minimum data requirements
- Detects gaps and anomalies
- Reports zero-volume candles
- Identifies price anomalies

## Installation

```bash
# Install dependencies
pnpm install

# Create cache directory
mkdir -p data/cache/multi-timeframe
```

## Usage

### Method 1: Using NPM Script

```bash
pnpm run fetch:multi-tf
```

Add this to your `package.json`:
```json
{
  "scripts": {
    "fetch:multi-tf": "tsx scripts/fetch-multi-timeframe.ts"
  }
}
```

### Method 2: Direct TypeScript Execution

```bash
npx ts-node scripts/fetch-multi-timeframe.ts
```

### Method 3: Programmatic Usage

```typescript
import { BinanceDataFetcher } from './server/services/vfmd/binanceDataFetcher';

const fetcher = new BinanceDataFetcher();

// Fetch all timeframes for BTC and ETH with orderflow
const allData = await fetcher.fetchMultiTimeframeData(
  ['BTCUSDT', 'ETHUSDT'],  // symbols
  30,                       // days
  true                      // include orderflow
);

// Save to disk
await fetcher.saveMultiTimeframeData(allData, './data/cache/multi-timeframe');
```

## Output Structure

```
data/cache/multi-timeframe/
├── BTCUSDT/
│   ├── BTCUSDT_1m.json      (1-minute candles with orderflow)
│   ├── BTCUSDT_5m.json      (5-minute candles with orderflow)
│   ├── BTCUSDT_15m.json     (15-minute candles with orderflow)
│   ├── BTCUSDT_1h.json      (hourly candles with orderflow)
│   ├── BTCUSDT_4h.json      (4-hour candles with orderflow)
│   ├── BTCUSDT_1d.json      (daily candles with orderflow)
│   └── ... (all 13 timeframes)
└── ETHUSDT/
    ├── ETHUSDT_1m.json
    ├── ETHUSDT_5m.json
    └── ... (all 13 timeframes)
```

## Data Format

Each JSON file contains:

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
  "fetchedAt": "2026-01-09T14:30:45.123Z",
  "data": [
    {
      "timestamp": 1702176000000,
      "open": 42150.25,
      "high": 42500.75,
      "low": 42000.00,
      "close": 42350.50,
      "volume": 1250.5,
      "orderFlow": {
        "timestamp": 1702176000000,
        "symbol": "BTCUSDT",
        "interval": "1h",
        "buyVolume": 750.3,
        "sellVolume": 500.2,
        "buyCount": 1250,
        "sellCount": 950,
        "netVolume": 250.1,
        "volumeRatio": 0.60,
        "dominantSide": "BUY"
      }
    },
    ...
  ]
}
```

## Orderflow Metrics Explained

| Metric | Description |
|--------|-------------|
| `buyVolume` | Total volume of buy orders (taker) |
| `sellVolume` | Total volume of sell orders (taker) |
| `buyCount` | Approximate count of buy trades |
| `sellCount` | Approximate count of sell trades |
| `netVolume` | buyVolume - sellVolume (buy/sell pressure) |
| `volumeRatio` | buyVolume / totalVolume (0-1, >0.55 = buy bias) |
| `dominantSide` | BUY (>55%), SELL (<45%), or NEUTRAL (45-55%) |

## Configuration

### Fetch Parameters

```typescript
fetchMultiTimeframeData(
  symbols: string[] = ['BTCUSDT', 'ETHUSDT'],  // Symbols to fetch
  days: number = 30,                          // Historical days
  includeOrderFlow: boolean = true            // Include orderflow data
): Promise<Map<string, Map<string, MarketDataWithOrderFlow[]>>>
```

### Timeframes Supported

- **Minutes**: 1m, 3m, 5m, 15m, 30m
- **Hours**: 1h, 2h, 4h, 6h, 8h, 12h
- **Days**: 1d

## API Rate Limiting

The fetcher implements automatic rate limiting:
- 100ms delay between timeframe requests (per symbol)
- Automatic retry on failure
- Respects Binance's 1200 requests/minute limit

## Error Handling

```typescript
// Automatic retry on network errors
// Graceful degradation if orderflow fetch fails
// Validation warnings for data quality issues
// Detailed error logging
```

## Data Validation

The script validates:
- ✓ Minimum 100 candles per timeframe
- ✓ Data gaps (alerts if >5% missing)
- ✓ Zero-volume candles (alerts if >1%)
- ✓ Price anomalies (alerts if >20% instant moves)

## Performance Metrics

Typical fetch times (with 30-day historical data):

| Metric | Value |
|--------|-------|
| Total timeframes | 13 |
| Symbols | 2 (BTC + ETH) |
| Total files | 26 |
| Total candles | ~37,440 |
| API requests | ~52-65 |
| Typical duration | 2-4 minutes |
| Total data size | 15-25 MB |

## Advanced Usage

### Fetch Only Specific Timeframes

```typescript
const fetcher = new BinanceDataFetcher();
const data = await fetcher.fetchHistoricalData(
  'BTCUSDT',
  30,
  '1h'  // Single timeframe
);
```

### Custom Caching

```typescript
const data = await fetcher.fetchWithCache(
  'BTCUSDT',
  30,
  '1h',
  './custom/cache/path',
  24 * 60 * 60 * 1000  // 24-hour cache validity
);
```

### Load Cached Data

```typescript
const ticks = BinanceDataFetcher.loadFromFile(
  './data/cache/multi-timeframe/BTCUSDT/BTCUSDT_1h.json'
);
```

## Troubleshooting

### "Rate limit exceeded"
- Increase delay between requests
- Reduce number of symbols/timeframes
- Wait 1 minute before retrying

### "No data available"
- Check internet connection
- Verify symbol spelling (BTCUSDT, ETHUSDT)
- Check if Binance API is accessible

### "Cache file not found"
- Run fetch first: `pnpm run fetch:multi-tf`
- Verify cache directory exists
- Check file permissions

## Integration Examples

### With Strategy Backtesting

```typescript
import { BinanceDataFetcher } from './server/services/vfmd/binanceDataFetcher';

const fetcher = new BinanceDataFetcher();
const data = BinanceDataFetcher.loadFromFile(
  './data/cache/multi-timeframe/BTCUSDT/BTCUSDT_1h.json'
);

// Use data for backtesting
for (const candle of data.data) {
  const marketData = {
    price: candle.close,
    volume: candle.volume,
    orderFlow: candle.orderFlow
  };
  // Run strategy logic
}
```

### With Real-Time Monitoring

```typescript
// Load latest cached data
const historicalData = BinanceDataFetcher.loadFromFile(
  './data/cache/multi-timeframe/BTCUSDT/BTCUSDT_1h.json'
);

// Combine with real-time data
const allData = [...historicalData.data, ...realtimeCandles];
```

## API Reference

### BinanceDataFetcher

**Methods:**

- `fetchMultiTimeframeData()` - Fetch all timeframes for multiple symbols
- `fetchHistoricalData()` - Fetch single timeframe
- `fetchWithCache()` - Fetch with caching support
- `saveToFile()` - Save single timeframe data
- `saveMultiTimeframeData()` - Save all timeframes
- `loadFromFile()` - Load cached data
- `validateData()` - Validate data quality

**Interfaces:**

- `OrderFlowData` - Orderflow metrics
- `MarketDataWithOrderFlow` - Combined OHLCV + orderflow
- `MarketTick` - Standard OHLCV format

## License

Part of Scanstream trading platform

## Support

For issues or questions:
1. Check data validation output
2. Review error messages
3. Check Binance API status
4. Verify network connectivity
