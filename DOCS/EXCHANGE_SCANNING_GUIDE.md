# Exchange Scanning Guide

## Overview

The scanner now supports **single-exchange scanning** with detailed performance logging. This allows you to scan any supported exchange individually and track exactly how long each operation takes.

## Supported Exchanges

- `binance` - Binance (default)
- `kucoinfutures` - KuCoin Futures
- `coinbase` - Coinbase
- `kraken` - Kraken

## API Usage

### Scan Endpoint

**POST** `/api/scanner/scan`

#### Request Body

```json
{
  "exchange": "binance",           // NEW: Select exchange (default: "binance")
  "timeframe": "medium",            // Options: "scalping", "short", "medium", "daily"
  "signal": "all",                  // Options: "all", "BUY", "SELL", "HOLD"
  "minStrength": 60,                // 0-100
  "fullAnalysis": true              // true/false
}
```

#### Response Body

```json
{
  "signals": [...],
  "metadata": {
    "count": 25,
    "total_scanned": 150,
    "timeframe": "medium",
    "exchange": "binance",          // NEW: Exchange that was scanned
    "timestamp": "2025-10-24T12:34:56.789Z",
    "duration_seconds": 45.23,      // NEW: Total scan duration
    "performance": {                 // NEW: Performance breakdown
      "initialization_seconds": 2.5,
      "scan_execution_seconds": 40.1,
      "filtering_seconds": 2.63,
      "total_seconds": 45.23
    },
    "filters_applied": {
      "signal": "all",
      "minStrength": 60,
      "exchange": "binance"
    }
  }
}
```

## Examples

### Example 1: Scan Binance (Default)

```bash
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "binance",
    "timeframe": "medium",
    "minStrength": 60
  }'
```

### Example 2: Scan KuCoin Futures

```bash
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "kucoinfutures",
    "timeframe": "short",
    "minStrength": 70
  }'
```

### Example 3: Python Request

```python
import requests

response = requests.post(
    "http://localhost:5001/api/scanner/scan",
    json={
        "exchange": "binance",
        "timeframe": "medium",
        "signal": "BUY",
        "minStrength": 65,
        "fullAnalysis": True
    }
)

data = response.json()
print(f"Found {data['metadata']['count']} signals")
print(f"Scan took {data['metadata']['duration_seconds']:.2f} seconds")
```

## Detailed Logging

Every scan now logs comprehensive timing information:

### Scan Start Log

```
================================================================================
🚀 SCAN STARTED
   Exchange: binance
   Timeframe: medium
   Signal Filter: all
   Min Strength: 60.0%
   Full Analysis: True
   Start Time: 2025-10-24 12:34:56.123
================================================================================
```

### During Scan

```
⏱️  Exchange initialization took: 2.50 seconds
⏱️  Market scan execution took: 40.10 seconds
⏱️  Filtering and formatting took: 2.63 seconds
```

### Scan Completion Log

```
================================================================================
✅ SCAN COMPLETED SUCCESSFULLY
   Exchange: binance
   Timeframe: medium
   Total Symbols Scanned: 150
   Signals After Filtering: 25
   End Time: 2025-10-24 12:35:41.346
   Total Duration: 45.23 seconds
   Performance Breakdown:
     - Initialization: 2.50s (5.5%)
     - Scan Execution: 40.10s (88.7%)
     - Filtering: 2.63s (5.8%)
================================================================================
```

### Error Log (if scan fails)

```
================================================================================
❌ SCAN FAILED
   Exchange: binance
   Timeframe: medium
   Error: Connection timeout
   End Time: 2025-10-24 12:35:15.000
   Duration Before Failure: 18.50 seconds
================================================================================
```

## Testing

### Using the Test Script

1. Start the scanner API:
```bash
python scanner_api.py
```

2. In another terminal, run the test script:
```bash
python test_exchange_scan.py
```

### Manual Testing with cURL

```bash
# Test Binance
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{"exchange": "binance", "timeframe": "medium"}'

# Test KuCoin Futures
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{"exchange": "kucoinfutures", "timeframe": "short"}'
```

## Performance Optimization Tips

Based on the detailed logs, you can:

1. **Identify Bottlenecks**: Check which phase takes the most time
   - Initialization issues? → Network/API connection problems
   - Scan execution slow? → Too many symbols, consider filtering
   - Filtering slow? → Optimize filter criteria

2. **Compare Exchanges**: Run scans on different exchanges and compare durations
   - Some exchanges may be faster due to better API performance
   - Some may have rate limits that slow down scans

3. **Optimize Timeframes**: Different timeframes have different data requirements
   - `scalping` = More data points, potentially slower
   - `daily` = Fewer data points, typically faster

4. **Adjust Parameters**:
   - Reduce `top_n` if scanning too many symbols
   - Increase `min_volume_usd` to filter out low-volume pairs
   - Use `fullAnalysis: false` for faster but less detailed scans

## Configuration

The scanner configuration is in the `get_scanner()` function:

```python
scanner_instance = MomentumScanner(
    exchange=exchange,
    config=config,
    market_type='crypto',
    quote_currency='USDT',
    top_n=50,              # Adjust: number of symbols to scan
    min_volume_usd=100000  # Adjust: minimum 24h volume
)
```

## ⚡ Parallel Scanning (NEW!)

**NOW AVAILABLE!** Scan multiple exchanges simultaneously for 3-5x speedup!

### Quick Example
```bash
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{"exchange": ["binance", "okx", "bybit"], "timeframe": "medium"}'
```

### Performance
- **Sequential**: 5 exchanges × 50s = 250s (4+ minutes)
- **Parallel**: 5 exchanges in ~60s (1 minute) ⚡
- **Speedup**: 3-5x faster
- **Time Saved**: ~70% reduction

### Documentation
- **Quick Start**: See [PARALLEL_SCAN_QUICKSTART.md](PARALLEL_SCAN_QUICKSTART.md)
- **Full Guide**: See [PARALLEL_SCANNING_GUIDE.md](PARALLEL_SCANNING_GUIDE.md)
- **Test**: Run `python test_exchange_scan.py` (option 2 or 3)

## Troubleshooting

### "Failed to initialize exchange"
- Check internet connection
- Verify exchange ID is correct
- Some exchanges may require API keys (configure in `initialize_exchange()`)

### "Scan completed but no results found"
- Lower `minStrength` parameter
- Check if the exchange has sufficient USDT pairs
- Try a different timeframe

### Very slow scans
- Check the performance breakdown in logs
- Consider reducing `top_n` parameter
- Verify network latency to exchange API
- Some exchanges have rate limits that slow down data fetching

## Questions?

Check the logs for detailed timing information - they'll help you understand exactly where time is being spent and how to optimize your scanning strategy.

