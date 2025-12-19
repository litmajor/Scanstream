# LSTM Trainer v2: Real Data Integration Guide

## Overview

The Enhanced LSTM Trainer v2 now includes a **multi-source data fallback chain** that intelligently routes data requests through your infrastructure's real-time and historical sources. This ensures production training always uses real market data—never synthetic fallbacks.

## Data Source Architecture

### Priority Chain

The trainer attempts to fetch data in this strict order:

```
worldtick (primary)
    ↓ (if fails with retry)
mdl (market data layer)
    ↓ (if fails with retry)
dall (distributed aggregation)
    ↓ (if fails with retry)
ccxt (multi-exchange)
    ↓ (if fails with retry)
yfinance (historical data)
    ↓
❌ FAIL (no synthetic fallback)
```

**Key Principle:** Each source gets 2 retry attempts with exponential backoff before moving to the next source. If all sources fail, training fails with a clear error—no silent fallback to synthetic data.

### Source Details

| Source | Purpose | Priority | Use Case |
|--------|---------|----------|----------|
| **worldtick** | Real-time broker data | 1 (Highest) | Live trading signals |
| **mdl** | Market data layer aggregation | 2 | Normalized market data |
| **dall** | Distributed aggregation layer | 3 | Fault-tolerant access |
| **ccxt** | Multi-exchange crypto/stocks | 4 | Exchange fallback |
| **yfinance** | Free historical data | 5 (Lowest) | Offline testing/backfill |

---

## Configuration

### New Config Options

```typescript
interface LSTMTrainingConfig {
  // ... existing fields ...

  // Data source priority chain (optional)
  dataSourcePriority?: ('worldtick' | 'mdl' | 'dall' | 'ccxt' | 'yfinance')[];
  
  // Minimum data points required (optional)
  requireMinDataPoints?: number; // Default: 150 candles (1.5h at 1h timeframe)
  
  // Validate data for gaps and quality (optional)
  validateDataContinuity?: boolean; // Default: true
  
  // Exchange for CCXT fallback (optional)
  exchange?: string; // Default: 'binance'
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: Partial<LSTMTrainingConfig> = {
  dataSourcePriority: ['worldtick', 'mdl', 'dall', 'ccxt', 'yfinance'],
  requireMinDataPoints: 150,       // 1.5 hours of 1h candles
  validateDataContinuity: true,    // Check for gaps
  exchange: 'binance',             // CCXT default exchange
};
```

### Example Usage

#### Use default priority chain (recommended):

```typescript
const trainer = new EnhancedLSTMTrainer();
const result = await trainer.trainModel({
  symbols: ['BTC/USDT', 'ETH/USDT'],
  lookbackDays: 30,
  lookbackCandles: 100,
  epochs: 50,
  // ... other config ...
  // Omit dataSourcePriority to use defaults
});
```

#### Custom source priority:

```typescript
await trainer.trainModel({
  symbols: ['BTC/USDT'],
  lookbackDays: 30,
  lookbackCandles: 100,
  epochs: 50,
  // Custom priority: offline-first, then online
  dataSourcePriority: ['ccxt', 'yfinance', 'worldtick', 'mdl', 'dall'],
  requireMinDataPoints: 200, // 2 hours minimum
  validateDataContinuity: true,
  exchange: 'kraken', // Use Kraken for CCXT
  // ... other config ...
});
```

#### Strict production mode:

```typescript
await trainer.trainModel({
  symbols: ['BTC/USDT'],
  lookbackDays: 30,
  lookbackCandles: 100,
  epochs: 50,
  // Only primary sources: no fallback to yfinance
  dataSourcePriority: ['worldtick', 'mdl', 'dall'],
  requireMinDataPoints: 500, // 5 hours minimum
  validateDataContinuity: true,
  // ... other config ...
});
```

---

## Data Fetch Flow

### High-Level Flow

```
trainModel(config)
  ├─ validateConfig()
  │  └─ Verify data sources available
  │  └─ Check minimum data points setting
  │
  └─ trainSymbol(symbol, config) [per symbol]
     └─ fetchHistoricalDataWithRetry()
        ├─ For each source in dataSourcePriority:
        │  ├─ For each retry (up to 2 attempts):
        │  │  ├─ Attempt fetch with 30s timeout
        │  │  ├─ Validate data points ≥ requireMinDataPoints
        │  │  ├─ If enabled: validateDataContinuity()
        │  │  ├─ If success: return data
        │  │  ├─ If fail: exponential backoff (2^attempt sec)
        │  │  └─ Log attempt
        │  └─ Move to next source
        │
        └─ All sources exhausted
           └─ Throw error with detailed attempt log
```

### Detailed Retry Logic

For each data source:

```
Attempt 1:
  ├─ Fetch data
  ├─ Wait for response (max 30s)
  ├─ If success & valid: return
  └─ If fail: wait 1s, retry

Attempt 2:
  ├─ Fetch data
  ├─ Wait for response (max 30s)
  ├─ If success & valid: return
  └─ If fail: move to next source (wait 2s before trying next)

Next Source: (exponential backoff before attempting next source)
  └─ Same 2-attempt process
```

---

## Data Validation

### Minimum Data Points

```typescript
// Example: requireMinDataPoints = 150
// At 1h timeframe = 150 hours = ~6.25 days minimum required

const MIN_CANDLES = config.requireMinDataPoints || 150;
if (frames.length < MIN_CANDLES) {
  throw new Error(
    `Insufficient data: ${frames.length} candles, need ${MIN_CANDLES}`
  );
}
```

### Data Continuity Check (Optional)

```typescript
// Detects gaps between candles
// For 1h timeframe, max gap = 2 hours (120 minutes)

const MAX_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

for (let i = 1; i < frames.length; i++) {
  const gap = frames[i].timestamp - frames[i-1].timestamp;
  if (gap > MAX_GAP_MS) {
    console.warn(`Data gap detected: ${gap / 60000} minutes`);
  }
}
```

---

## Error Handling & Troubleshooting

### Configuration Validation

Errors thrown during config validation:

```typescript
// ✗ Invalid: no data sources specified
dataSourcePriority: []
→ "At least one data source required in dataSourcePriority"

// ✗ Invalid: unknown source
dataSourcePriority: ['worldtick', 'invalid_source']
→ "Invalid data sources: invalid_source. Valid: worldtick, mdl, dall, ccxt, yfinance"

// ✗ Invalid: insufficient minimum
requireMinDataPoints: 30
→ "requireMinDataPoints must be >= 50 candles"
```

### Runtime Errors

#### Scenario 1: All sources fail

```
[LSTM Trainer] Starting multi-source data fetch for BTC/USDT. 
  Source priority: worldtick → mdl → dall → ccxt → yfinance

[LSTM Trainer] Attempting worldtick for BTC/USDT (attempt 1/2)...
[LSTM Trainer] worldtick attempt 1 failed: ECONNREFUSED
[LSTM Trainer] Backing off 1000ms before retry on worldtick...
[LSTM Trainer] Attempting worldtick for BTC/USDT (attempt 2/2)...
[LSTM Trainer] worldtick attempt 2 failed: ECONNREFUSED
[LSTM Trainer] Source worldtick exhausted after 2 attempts. 
  Trying next source...

[LSTM Trainer] Attempting mdl for BTC/USDT (attempt 1/2)...
[LSTM Trainer] mdl attempt 1 failed: Timeout after 30s
[LSTM Trainer] Backing off 1000ms before retry on mdl...
[LSTM Trainer] Attempting mdl for BTC/USDT (attempt 2/2)...
[LSTM Trainer] mdl attempt 2 failed: Timeout after 30s
[LSTM Trainer] Source mdl exhausted after 2 attempts. 
  Trying next source...

[... more sources ...]

Error: Failed to fetch sufficient data for BTC/USDT from any source:
worldtick: 2 attempts (ECONNREFUSED)
mdl: 2 attempts (Timeout after 30s)
dall: 2 attempts (No data returned)
ccxt: 2 attempts (Exchange not available)
yfinance: 2 attempts (No yfinance data for BTC/USDT)

Data source chain exhausted. No synthetic data fallback available.
```

#### Scenario 2: Insufficient data (below minimum)

```
[LSTM Trainer] Attempting worldtick for BTC/USDT (attempt 1/2)...
[LSTM Trainer] worldtick attempt 1 failed: 
  Insufficient data: got 50 points, need 150

Error: Failed to fetch sufficient data for BTC/USDT from any source:
worldtick: 2 attempts (Insufficient data: got 50 points...)

Data source chain exhausted. No synthetic data fallback available. 
Please ensure at least one real data source is configured...
```

#### Scenario 3: Data continuity warning

```
[LSTM Trainer] ✓ Successfully fetched 200 candles for BTC/USDT from worldtick
[LSTM Trainer] Data gap detected: 120m gap at candle 45
[LSTM Trainer] Data gap detected: 90m gap at candle 120
[LSTM Trainer] Continuing with training (gaps logged for analysis)
```

### Troubleshooting Guide

| Problem | Symptoms | Solution |
|---------|----------|----------|
| **worldtick down** | "ECONNREFUSED" on worldtick | Use mdl/dall fallback or retry later |
| **mdl timeout** | "Timeout after 30s" | Check network, mdl service status |
| **Insufficient data** | "Insufficient data: X points, need Y" | Increase `lookbackDays` or lower `requireMinDataPoints` |
| **No yfinance package** | "yfinance not available" | `npm install yfinance-node`, or remove from priority chain |
| **CCXT exchange offline** | "Exchange not available" | Check CCXT status, try different `exchange` |
| **Data gaps** | "Data gap detected: X minutes" | Normal for market data; logged for analysis |

---

## Implementation Details

### Source Fetch Methods

Each data source has its own fetch implementation:

#### worldtick (Primary)

```typescript
private async fetchFromWorldtick(
  symbol: string,
  lookbackDays: number
): Promise<any[]> {
  const frames = await storage.getMarketFrames(
    symbol,
    lookbackDays * 24  // Convert days to hours
  );
  if (!frames || frames.length === 0) {
    throw new Error('No worldtick data available');
  }
  return frames;
}
```

#### mdl (Market Data Layer)

```typescript
private async fetchFromMDL(
  symbol: string,
  lookbackDays: number
): Promise<any[]> {
  // MDL uses same storage backend with MDL-specific formatting
  const frames = await storage.getMarketFrames(
    symbol,
    lookbackDays * 24
  );
  if (!frames || frames.length === 0) {
    throw new Error('No MDL data available');
  }
  return frames;
}
```

#### ccxt (Multi-Exchange)

```typescript
private async fetchFromCCXT(
  symbol: string,
  lookbackDays: number
): Promise<any[]> {
  if (!ccxtScanner) {
    throw new Error('CCXT scanner not available');
  }

  const exchange = DEFAULT_CONFIG.exchange || 'binance';
  const frames = await ccxtScanner.fetchOHLCV(
    symbol,
    '1h',
    lookbackDays * 24,
    { exchange }
  );

  if (!frames || frames.length === 0) {
    throw new Error(`No CCXT data for ${symbol} on ${exchange}`);
  }
  return frames;
}
```

#### yfinance (Historical Fallback)

```typescript
private async fetchFromYfinance(
  symbol: string,
  lookbackDays: number
): Promise<any[]> {
  if (!yfinance) {
    throw new Error('yfinance not available');
  }

  const frames = await yfinance.download(symbol, {
    period: `${lookbackDays}d`,
    interval: '1h',
  });

  if (!frames || frames.length === 0) {
    throw new Error(`No yfinance data for ${symbol}`);
  }
  return frames;
}
```

---

## Monitoring & Logging

### Log Levels

**INFO** - Normal operation:
```
[LSTM Trainer] Starting multi-source data fetch for BTC/USDT...
[LSTM Trainer] ✓ Successfully fetched 200 candles for BTC/USDT from worldtick
```

**WARN** - Degraded but operational:
```
[LSTM Trainer] worldtick attempt 1 failed: ECONNREFUSED
[LSTM Trainer] Data gap detected: 120m gap at candle 45
[LSTM Trainer] Backing off 1000ms before retry...
```

**ERROR** - Training cannot proceed:
```
Error: Failed to fetch sufficient data for BTC/USDT from any source...
Error: Config validation failed: At least one data source required...
```

### Metrics to Monitor

- **Data fetch latency** per source (should be <5s for primary sources)
- **Fallback trigger rate** (how often sources fail)
- **Data point count** (verify consistency across runs)
- **Training time impact** (should be <50% of training duration)

---

## Migration from Old Config

### Old Configuration (v1)

```typescript
const config = {
  symbols: ['BTC/USDT'],
  dataSource: 'worldtick',           // Single source
  requireMinimumData: true,           // Boolean only
  strictDataValidation: true,         // Boolean only
  // ...
};
```

### New Configuration (v2)

```typescript
const config = {
  symbols: ['BTC/USDT'],
  dataSourcePriority: [               // Array of sources with priority
    'worldtick',
    'mdl',
    'dall',
    'ccxt',
    'yfinance'
  ],
  requireMinDataPoints: 150,          // Explicit numeric minimum
  validateDataContinuity: true,       // Data quality checking
  exchange: 'binance',                // CCXT exchange selection
  // ...
};
```

### Backward Compatibility

The v2 trainer is **fully backward compatible**. If you don't specify the new fields, defaults are used:

```typescript
// Old config still works!
const trainer = new EnhancedLSTMTrainer();
const result = await trainer.trainModel({
  symbols: ['BTC/USDT'],
  lookbackDays: 30,
  // ... no dataSourcePriority, requireMinDataPoints, etc.
  // Uses defaults: priority chain + 150 min points
});
```

---

## Production Deployment Checklist

- [ ] All 5 data sources are accessible from production environment
- [ ] Fallback chain matches expected availability (not just default)
- [ ] Minimum data points set appropriately for your use case
- [ ] Data continuity validation enabled for safety
- [ ] Exchange choice correct for CCXT (if using)
- [ ] Error handling tested: verify behavior when each source fails
- [ ] Logging configured to capture source-level details
- [ ] Monitoring alerts set for persistent data fetch failures
- [ ] Documentation updated with custom priority chain
- [ ] Load testing completed with expected data volumes

---

## FAQ

**Q: What if yfinance breaks after I remove it from the chain?**
A: Explicitly set `dataSourcePriority` to exclude yfinance. This ensures training fails fast instead of timing out.

**Q: Can I use only one source?**
A: Yes! Set `dataSourcePriority: ['worldtick']` for strictly primary source only.

**Q: Why exponential backoff instead of immediate retry?**
A: Gives temporary issues (rate limits, transient failures) time to resolve. Prevents hammering failing services.

**Q: Can I increase minimum data points requirement?**
A: Yes, use `requireMinDataPoints`. Higher values = more robust training but longer initial data collection.

**Q: What's the total maximum timeout per symbol?**
A: Approximately 3-5 minutes in worst case: 5 sources × 2 attempts × (30s timeout + backoff) = worst case ~300-500s.

---

## See Also

- [LSTM Trainer v2 Technical Guide](./LSTM_TRAINER_V2_TECHNICAL_GUIDE.md) - Deep dive into LSTM architecture
- [LSTM Trainer v2 Migration Guide](./LSTM_TRAINER_V2_MIGRATION.md) - v1 to v2 migration details
- [Scanner Signal Integration Guide](./SCANNER_SIGNAL_INTEGRATION_GUIDE.md) - How signals feed into training pipeline
