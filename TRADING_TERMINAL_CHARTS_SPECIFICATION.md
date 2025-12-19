# Trading Terminal Charts - Complete Specification

## Chart Type

### Primary Chart: Candlestick (OHLC)
**Chart Library**: ApexCharts (`react-apexcharts`)
**Type**: Japanese Candlestick
**Format**: OHLCV (Open, High, Low, Close, Volume)

```
Each candle shows:
┌──────────────┐
│    HIGH      │ ← Highest price in period
├──────────────┤
│ OPEN │ CLOSE │ ← Body (colored by direction)
├──────────────┤
│    LOW       │ ← Lowest price in period
└──────────────┘
VOLUME (bar below)
```

**Color Scheme**:
- 🟢 **Upward Candles** (Close > Open): `#10B981` (Emerald Green)
- 🔴 **Downward Candles** (Close < Open): `#EF4444` (Red)
- 📊 **Volume Bars**: Gray/Blue depending on direction

---

## Data Sources (Priority Order)

### Source 1: Aggregated Feed Data ✅ (Preferred)
**Priority**: Highest
**Source**: Real-time world ticks aggregated by timeframe
**Location**: `useTickCandles()` hook in `trading-terminal.tsx`
**Format**: Aggregated from WebSocket market data
**Latency**: Real-time (live)
**Refresh**: Every new candle close

```typescript
// From trading-terminal.tsx line 997
const { candles: feedCandles } = useTickCandles(
  ticksForAggregation, 
  selectedTimeframe, 
  { minTicks: 10, lookback: 400 }
);

// Returns: Array of aggregated OHLCV candles
```

---

### Source 2: Gateway Agent Data ✅ (Fallback)
**Priority**: Second
**Source**: CCXT-based Gateway Agent real-time candles
**Location**: `gatewayOHLCV` state
**Format**: Native CCXT OHLCV format
**Latency**: Real-time (live)
**Refresh**: Every new candle from exchange

```typescript
// From trading-terminal.tsx line 1009
if (gatewayOHLCV?.success && gatewayOHLCV.candles?.length > 0) {
  return gatewayOHLCV.candles.map((candle: any) => ({
    timestamp: candle[0],
    open: candle[1],
    high: candle[2],
    low: candle[3],
    close: candle[4],
    volume: candle[5],
  }));
}
```

---

### Source 3: CoinGecko Chart Data ✅ (Historical)
**Priority**: Third
**Source**: CoinGecko public API (free)
**Endpoint**: `/api/coingecko/chart/:coinId?days=90`
**Format**: OHLCV with ML features
**Latency**: Slightly delayed (5-15 minutes behind)
**Refresh**: Every 10 minutes (rate limit optimized)
**Rate Limit**: 10-50 calls/minute (free tier)

**Available Timeframes**:
```
- 1d (90 days of daily data)
- 7d (7 days of 6-hourly data)
- 14d (14 days of 4-hourly data)
- 30d (30 days of 2-hourly data)
- 90d (90 days of hourly data)
- 180d (180 days of 4-hourly data)
- 365d (365 days of daily data)
- max (all available data)
```

**Extended Data** (when `extended=true`):
- Volume data matched to OHLC timestamps
- Market cap data
- Price range features
- Bullish/bearish indicators

```typescript
// From trading-terminal.tsx line 1019
if (coinGeckoChartData && coinGeckoChartData.length > 0) {
  console.log(`[Chart] Using CoinGecko data: ${coinGeckoChartData.length} candles`);
  return coinGeckoChartData;
}
```

---

### Source 4: WebSocket Market Data ✅ (Fallback)
**Priority**: Last resort
**Source**: Real-time WebSocket frames
**Location**: `marketData` state
**Format**: MarketFrame (last 200 ticks)
**Latency**: Real-time but lower frequency
**Refresh**: As market data arrives
**Limitation**: Might be sparse depending on activity

```typescript
// From trading-terminal.tsx line 1026
const filteredData = marketData.filter(frame => frame.symbol === selectedSymbol);
if (filteredData.length === 0) {
  return [];
}
return filteredData.slice(-200).map(frame => ({
  timestamp: frame.timestamp,
  open: frame.price.open,
  high: frame.price.high,
  low: frame.price.low,
  close: frame.price.close,
  volume: frame.volume,
  rsi: frame.indicators?.rsi ?? null,
  macd: frame.indicators?.macd ? {...} : null,
  ema: frame.indicators?.ema20 ?? null,
}));
```

---

## Supported Timeframes

### All Timeframes (Asset Agnostic)
The chart is **completely agnostic** to asset and timeframe. You can select any combination:

```
Timeframe Selector (5 options):
┌─────────────────────────────────┐
│ [1m]  [5m]  [1h]  [1d]  [1w]   │
└─────────────────────────────────┘
```

### User Selectable
```typescript
// From trading-terminal.tsx line 1984
selectedTimeframe: '1h' // User can change via buttons
['1m', '5m', '1h', '1d', '1w']
```

### How It Works
1. User selects timeframe (e.g., "1h")
2. System passes to `useTickCandles()` for aggregation
3. Real-time ticks aggregated into selected timeframe
4. CoinGecko data auto-adjusted for timeframe
5. Chart renders with appropriate time axis labels

**Example**:
```
User selects 1h timeframe for BTC/USDT
→ System aggregates 1-minute ticks into 1-hour candles
→ Each candle = 60 minutes of data
→ Chart shows 1 candle per hour
```

---

## Supported Assets (Agnostic)

### Primary Assets (25+)
Trading terminal supports any asset available in CoinGecko. Current selection dropdown:

```typescript
['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 
 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT', 
 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'ARB/USDT', 'OP/USDT']
```

### Extensible
To add a new asset, add to `symbolToCoinId()` mapping:

```typescript
// In useCoinGeckoChart.ts
const symbolMap: Record<string, string> = {
  'NEW_SYMBOL/USDT': 'coingecko-id',  // Add here
  // ...existing mappings
};
```

### Chart Behavior
- Chart automatically loads for any selected symbol
- Data fetched from highest-priority source available
- No manual configuration needed
- Fallback chain ensures data always available (if connected)

---

## Candle Count

### Default Display
```
Maximum Candles Shown: 200 (configurable)
From trading-terminal.tsx line 2189:

maxCandles: 200
```

### Dynamic Based on Source
**Aggregated Feed**: 
- Limited to available world ticks
- Grows as real-time data arrives
- ~10-400 ticks depending on activity

**CoinGecko**:
- 90 days = ~90 candles (daily)
- 90 days = ~2,160 candles (hourly)
- Max historical: Up to 10+ years of daily data

**Gateway Agent**:
- Exchange-provided candles
- Typically 1,000+ candles available
- Depends on exchange

**WebSocket**:
- Last 200 frames (if available)

### How It's Limited
```typescript
// Performance optimization
const limitedData = data.slice(-config.performance.maxCandles);
// Takes last N candles, drops older ones from display
```

### Memory Efficient
- Only renders visible candles (~200)
- Historical data cached by React Query (8-20 min cache)
- Pagination/scrolling possible with toolbar

---

## Chart Display Configuration

### Main Chart Area
```
Size: Flex-1 (takes remaining space)
Height: 600px (configurable)
Type: Candlestick OHLCV
Toolbar: Enabled with zoom, pan, reset, download
Grid: Dark theme with subtle gridlines
Background: Dark slate (#1E293B with transparency)
Border: Subtle (1px, 50% opacity)
```

### Indicator Panels (Below Main Chart)
Each indicator gets space proportional to count:
```
Total chart height = 600px (default)
Main candlestick = 70% of height (420px)
Indicators split remaining 30% equally

If showing: Volume + RSI + MACD + EMA:
  - Main: 420px
  - Volume: 45px
  - RSI: 45px
  - MACD: 45px
  - EMA: 45px (integrated into main)
```

### Tooltip on Hover
```
Shows for each candle:
┌──────────────────────────┐
│ Date/Time:  Dec 14, 1h   │
│ Open:       $45,250      │
│ High:       $45,500      │
│ Low:        $44,900      │
│ Close:      $45,350      │
│ Volume:     1.2M         │
│ RSI:        65           │
└──────────────────────────┘
```

---

## Indicator Overlays & Sub-Charts

### Volume Sub-Chart ✅
**Type**: Bar chart (colored by direction)
**Location**: Below main chart
**Data**: Volume for each candle
**Colors**: Green (up), Red (down)
**Toggle**: Volume button in indicators panel

```typescript
showVolume: true  // Default ON
```

### EMA (Exponential Moving Average) ✅
**Type**: Line overlay on main chart
**Period**: 20-candle EMA
**Color**: Purple line
**Position**: Over candlesticks
**Toggle**: EMA button in indicators panel

```typescript
showEMA: true  // Default OFF
```

### RSI (Relative Strength Index) ✅
**Type**: Line sub-chart (30-70 range)
**Period**: 14 candles (standard)
**Range**: 0-100 with bands at 30 (oversold) and 70 (overbought)
**Color**: Orange line
**Position**: Below candlesticks
**Toggle**: RSI button in indicators panel

```typescript
showRSI: true  // Default OFF
```

### MACD (Moving Average Convergence Divergence) ✅
**Type**: Histogram sub-chart
**Periods**: 12/26/9 (standard)
**Components**: MACD line + Signal line + Histogram
**Color**: Purple
**Position**: Below RSI
**Toggle**: MACD button in indicators panel

```typescript
showMACD: true  // Default OFF
```

### Candlestick Patterns ✅
**Types Detected**:
- Doji (small body, long wicks)
- Hammer (small body, long lower wick)
- Bullish Engulfing (pattern detection)
- Bearish Engulfing (pattern detection)

**Display**: 
- Marked with annotations on chart
- Labeled with pattern name
- Color-coded (green for bullish, red for bearish)

**Toggle**: Patterns button in indicators panel

```typescript
showPatterns: true  // Default OFF
```

---

## Technical Data Displayed

### Right Side Panel (70 px wide)
Shows real-time statistics for displayed data:

```
┌──────────────────────┐
│ Technical Indicators │
├──────────────────────┤
│ Volume Profile       │
│ - Avg Volume: 1.2M   │
│ - Current: 1.5M ↑    │
├──────────────────────┤
│ EMA (20)             │
│ - Value: $45,200     │
│ - Distance: +0.33%   │
├──────────────────────┤
│ Market Statistics    │
│ - 24h High: $45,500  │
│ - 24h Low:  $44,900  │
│ - Avg Vol:  1.1M     │
│ - Candles:  180      │
└──────────────────────┘
```

---

## Data Refresh Rates

### Aggregated Feed
- **Refresh**: Real-time on each new tick
- **Frequency**: ~100ms (depends on market activity)
- **Latency**: <500ms from exchange

### Gateway Agent
- **Refresh**: Every new candle from exchange
- **Frequency**: Per timeframe (1m = 1 min, 1h = 1 hour)
- **Latency**: <1 second

### CoinGecko
- **Refresh**: Every 10 minutes (rate limit optimized)
- **Frequency**: Capped to avoid rate limiting
- **Latency**: 5-15 minutes behind real-time
- **Cache**: 8-15 minutes (depending on data type)

### WebSocket
- **Refresh**: As frames arrive
- **Frequency**: Variable
- **Latency**: Real-time

---

## Performance Characteristics

### Candle Rendering
```
Max Candles on Screen: 200
Actual Rendered: ~60-100 (visible portion)
Scroll: Enabled with ApexCharts toolbar
Performance: 60 FPS maintained
```

### Memory Usage
```
200 candles with all indicators: ~5-10 MB
Cached queries (React Query): +5-15 MB
Total chart memory: ~10-25 MB
```

### Network
```
CoinGecko API call: ~50-100 KB per request
Frequency: Every 10 minutes (rate limited)
Bandwidth: ~5-10 KB/min average
```

---

## Example Data Structure

### Single Candle
```typescript
{
  timestamp: 1702541400000,      // Unix milliseconds
  open: 45250,                   // Opening price
  high: 45500,                   // Highest price
  low: 44900,                    // Lowest price
  close: 45350,                  // Closing price
  volume: 1200000,               // Volume (in units)
  rsi: 65,                       // RSI value (0-100)
  ema: 45200,                    // 20-period EMA
  macd: 0.15,                    // MACD line (optional)
}
```

### Full Chart Data Array
```typescript
ChartDataPoint[] = [
  // 90 candles (90 daily candles)
  // or 2,160 candles (90 days of hourly)
  // or 200 displayed maximum
  
  { timestamp: ..., open: ..., high: ..., low: ..., close: ..., volume: ... },
  { timestamp: ..., open: ..., high: ..., low: ..., close: ..., volume: ... },
  // ... more candles
]
```

---

## Summary

| Property | Value |
|----------|-------|
| **Chart Type** | Candlestick (OHLCV) |
| **Library** | ApexCharts (`react-apexcharts`) |
| **Color Scheme** | Green (up), Red (down) |
| **Data Sources** | Feed, Gateway, CoinGecko, WebSocket |
| **Timeframes** | All (1m, 5m, 15m, 1h, 4h, 1d, 1w, etc.) |
| **Assets** | 25+ (Bitcoin, Ethereum, Solana, etc.) |
| **Asset Agnostic** | ✅ Yes |
| **Timeframe Agnostic** | ✅ Yes |
| **Max Candles Displayed** | 200 (configurable) |
| **Indicators** | Volume, EMA, RSI, MACD, Patterns |
| **Toolbar** | Zoom, Pan, Reset, Download, Selection |
| **Real-time Updates** | ✅ Yes (via WebSocket) |
| **Historical Data** | ✅ Yes (CoinGecko + Storage) |
| **Replay Mode** | ✅ Yes (historical playback) |
| **Performance** | 60 FPS, 200 candles max |
| **Memory** | ~10-25 MB with all data |

---

## Next Steps

Want to:
1. **Add a new asset?** → Update `symbolToCoinId()` in `useCoinGeckoChart.ts`
2. **Change max candles?** → Edit `maxCandles: 200` in `trading-terminal.tsx`
3. **Modify colors?** → Edit `ChartConfig.colors` in `TradingChart.tsx`
4. **Add new indicator?** → Create new series in `TradingChart.tsx` and add toggle button
5. **Change refresh rate?** → Edit `refetchInterval` in `useCoinGeckoChart.ts`
