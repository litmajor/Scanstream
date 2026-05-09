# Add NPM Script to package.json

To make it easier to run the multi-timeframe fetcher, add this line to your `package.json`:

## Location in package.json

Find the `"scripts"` section and add:

```json
{
  "scripts": {
    "fetch:multi-tf": "tsx scripts/fetch-multi-timeframe.ts",
    "fetch:btc-eth-all-tf": "tsx scripts/fetch-multi-timeframe.ts",
    "fetch:orderflow": "tsx scripts/fetch-multi-timeframe.ts"
  }
}
```

## Complete Example

Here's what your scripts section should look like:

```json
{
  "name": "scanstream",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node dist/server/index.js",
    
    "fetch:multi-tf": "tsx scripts/fetch-multi-timeframe.ts",
    "fetch:btc-eth-all-tf": "tsx scripts/fetch-multi-timeframe.ts",
    "fetch:orderflow": "tsx scripts/fetch-multi-timeframe.ts",
    
    "test": "vitest",
    "lint": "eslint src"
  }
}
```

## Usage

Once added, run with:

```bash
pnpm run fetch:multi-tf
```

Or simply:

```bash
npm run fetch:multi-tf
yarn run fetch:multi-tf
```

## What It Does

The script will:

1. 🔄 Fetch all 13 timeframes (1m to 1d)
2. 📊 Download data for BTCUSDT and ETHUSDT
3. 📈 Extract orderflow metrics (buy/sell volumes, ratios)
4. 💾 Save to `./data/cache/multi-timeframe/`
5. 📋 Display comprehensive summary with statistics

## Expected Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🚀 MULTI-TIMEFRAME DATA FETCHER                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

📊 Configuration:
   Symbols: BTCUSDT, ETHUSDT
   Timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d
   Period: 30 days
   Include Orderflow: Yes
   Cache Location: ./data/cache/multi-timeframe/

⏳ Starting fetch...

📊 MULTI-TIMEFRAME DATA FETCH STARTING...
================================================================================
Symbols: BTCUSDT, ETHUSDT
Timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d
Period: 30 days
Include OrderFlow: true

🔄 Fetching data for BTCUSDT...
  📍 BTCUSDT @ 1m...
    ✅ Fetched 43200 candles
  📍 BTCUSDT @ 3m...
    ✅ Fetched 14400 candles
  📍 BTCUSDT @ 5m...
    ✅ Fetched 8640 candles
  ... (continues for all timeframes)

💾 Saving data to disk...
    💾 BTCUSDT 1m: 45.32 MB
    💾 BTCUSDT 3m: 15.11 MB
    ... (continues for all timeframes)

✅ All data saved to: ./data/cache/multi-timeframe/

================================================================================
📈 FETCH SUMMARY
================================================================================

BTCUSDT:
  1m   │ Candles: 43200 │ Orderflow: 43200 │ Avg Buy Ratio: 52.3% │ Avg Net Vol: 2450.00
  3m   │ Candles: 14400 │ Orderflow: 14400 │ Avg Buy Ratio: 51.8% │ Avg Net Vol: 7350.00
  ... (all 13 timeframes)

ETHUSDT:
  1m   │ Candles: 43200 │ Orderflow: 43200 │ Avg Buy Ratio: 51.2% │ Avg Net Vol: 485.00
  ... (all 13 timeframes)

================================================================================
✅ FETCH COMPLETE
================================================================================

⏱️  Time elapsed: 242.5s
📁 Data location: ./data/cache/multi-timeframe/

📦 Data structure:
   data/cache/multi-timeframe/
   ├── BTCUSDT/
   │   ├── BTCUSDT_1m.json
   │   ├── BTCUSDT_5m.json
   │   ├── BTCUSDT_1h.json
   │   └── ... (all timeframes)
   └── ETHUSDT/
       ├── ETHUSDT_1m.json
       ├── ETHUSDT_5m.json
       ├── ETHUSDT_1h.json
       └── ... (all timeframes)

📊 Each file contains:
   - OHLCV data (Open, High, Low, Close, Volume)
   - Orderflow metrics (Buy/Sell volumes, ratios, dominant side)
   - Timestamp and metadata

🎯 Ready for analysis, backtesting, and strategy development!
```

## Data Files Created

```
26 JSON files created (~40-50 MB total):

BTCUSDT:
  ✓ BTCUSDT_1m.json   (1-min candles)
  ✓ BTCUSDT_3m.json   (3-min candles)
  ✓ BTCUSDT_5m.json   (5-min candles)
  ✓ BTCUSDT_15m.json  (15-min candles)
  ✓ BTCUSDT_30m.json  (30-min candles)
  ✓ BTCUSDT_1h.json   (1-hour candles)
  ✓ BTCUSDT_2h.json   (2-hour candles)
  ✓ BTCUSDT_4h.json   (4-hour candles)
  ✓ BTCUSDT_6h.json   (6-hour candles)
  ✓ BTCUSDT_8h.json   (8-hour candles)
  ✓ BTCUSDT_12h.json  (12-hour candles)
  ✓ BTCUSDT_1d.json   (1-day candles)
  ✓ BTCUSDT_1d.json   (1-week candles - if requested)

ETHUSDT:
  ✓ ETHUSDT_1m.json   (same structure as BTCUSDT)
  ✓ ETHUSDT_3m.json
  ... (all 13 timeframes)
```

## Next Steps After Running

1. **Verify data was created:**
   ```bash
   ls -la data/cache/multi-timeframe/
   ```

2. **Load data in your code:**
   ```typescript
   import { BinanceDataFetcher } from './server/services/vfmd/binanceDataFetcher';
   
   const data = BinanceDataFetcher.loadFromFile(
     './data/cache/multi-timeframe/BTCUSDT/BTCUSDT_1h.json'
   );
   
   console.log(`Loaded ${data.data.length} candles`);
   ```

3. **Use in strategies:**
   - Multi-timeframe confirmation
   - Orderflow analysis
   - Volume profile studies
   - Entry/exit signals

## Tips

- ✅ First run takes 2-4 minutes
- ✅ Subsequent runs use cached data (24-hour cache)
- ✅ Can modify `maxCacheAge` to refresh more frequently
- ✅ Safe to run multiple times per day
- ✅ No API keys required (public data only)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "tsx not found" | Run `pnpm install -D tsx` |
| "Permission denied" | Check file permissions |
| "ECONNREFUSED" | Check internet connection |
| "Status 429" | Rate limited - wait and retry |

---

For more details, see:
- `MULTI_TIMEFRAME_FETCHER_GUIDE.md` - Complete documentation
- `QUICK_START_MULTI_TF.md` - Quick reference
