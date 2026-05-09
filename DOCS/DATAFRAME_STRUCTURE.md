# Complete Scanner Dataframe Structure

## Overview
Your scanner generates **70+ data points per symbol** with comprehensive technical, market microstructure, and risk analysis.

## Column Grouping (70 Columns Total)

### Group 1: Identification (4 columns)
```
symbol              - Trading pair (BTC/USDT, ETH/USDT, etc)
exchange            - Source exchange (coinbase, kucoinfutures, okx, kraken)
timeframe           - Candle period (1m, 5m, 1h, 1d)
timestamp           - ISO 8601 UTC timestamp
```

### Group 2: OHLC Price Data (4 columns)
```
open                - Opening price for period
high                - Highest price during period
low                 - Lowest price during period
close               - Closing price for period
```

### Group 3: Volume Analysis (4 columns)
```
volume              - Trading volume in base currency
volumeUSD           - Trading volume in USD
volumeRatio         - Current vol / 20-period average
volumeTrend         - INCREASING / NORMAL / DECREASING
```

### Group 4: Momentum Indicators (7 columns)
```
rsi                 - Relative Strength Index (0-100)
rsiLabel            - OVERSOLD (<30) / NEUTRAL / OVERBOUGHT (>70)
macd                - MACD value
macdSignal          - MACD signal line
macdHistogram       - MACD - Signal difference
macdCrossover       - BULLISH / BEARISH / NONE
momentum            - % price change over 10 periods
momentumTrend       - RISING / FALLING / FLAT
```

### Group 5: Trend Indicators (10 columns)
```
ema12               - 12-period exponential moving average
ema26               - 26-period exponential moving average
ema50               - 50-period exponential moving average
ema200              - 200-period exponential moving average
sma20               - 20-period simple moving average
sma50               - 50-period simple moving average
sma200              - 200-period simple moving average
adx                 - Average Directional Index (0-100)
adxTrend            - STRONG / WEAK
trendDirection      - UPTREND / DOWNTREND
trendStrength       - Composite strength (0-1)
```

### Group 6: Volatility Indicators (8 columns)
```
atr                 - Average True Range (absolute volatility)
atrPercent          - ATR as % of price
volatility          - Relative volatility (decimal)
volatilityLabel     - LOW / MEDIUM / HIGH
bbUpper             - Bollinger Band upper
bbMiddle            - Bollinger Band middle (SMA20)
bbLower             - Bollinger Band lower
bbPosition          - Position between bands (0-1)
bbBandwidth         - Band width as % of middle
```

### Group 7: Stochastic Oscillator (2 columns)
```
stochasticK         - Stochastic %K line
stochasticD         - Stochastic %D line
```

### Group 8: Order Flow & Market Structure (5 columns)
```
bidVolume           - Total bid side volume
askVolume           - Total ask side volume
bidAskRatio         - Bid volume / Ask volume
spread              - Bid-ask spread in price units
spreadPercent       - Bid-ask spread as % of price
orderImbalance      - BUY / SELL (which side is dominant)
```

### Group 9: Signal Generation (4 columns)
```
signal              - BUY / SELL / HOLD
signalStrength      - Signal strength (0-1)
signalConfidence    - Confidence score (0-100%)
signalReason        - Human-readable explanation
```

### Group 10: Risk Metrics (5 columns)
```
riskRewardRatio     - Potential profit / potential loss
stopLoss            - Recommended stop-loss price
takeProfit          - Recommended take-profit price
supportLevel        - Technical support level
resistanceLevel     - Technical resistance level
```

### Group 11: Performance Metrics (6 columns)
```
change1h            - Price change last 1 hour (%)
change24h           - Price change last 24 hours (%)
change7d            - Price change last 7 days (%)
change30d           - Price change last 30 days (%)
highestPrice24h     - Highest price in 24h
lowestPrice24h      - Lowest price in 24h
```

### Group 12: Data Quality (4 columns)
```
confidence          - Overall data confidence (0-100%)
dataQuality         - Quality score (0-100%)
sources             - Number of sources confirming data
deviation           - Price deviation across sources
```

---

## Example Row (Actual Data)

```csv
BTC/USDT,coinbase,1d,2025-11-29T12:00:37Z,59835.31,62050.45,59200.10,60927.22,
1250.50,50250000,0.83,NORMAL,
38.08,NEUTRAL,44.07,-16.34,3.14,NONE,-0.41,FLAT,
58638.60,59708.68,60667.12,69946.02,58040.25,59099.41,69721.40,
24.95,WEAK,UPTREND,0.66,
1196.71,1.96,0.0442,HIGH,58638.60,60927.22,59099.41,0.76,8.5,
65.25,62.10,
250000,215000,1.16,0.25,0.0006,BUY,
BUY,0.72,87.5,"BUY - RSI:38, MACD:Bullish",
0.65,58400.00,62100.00,57800.00,62500.00,
2.30,1.50,3.25,8.75,61200.00,59800.00,
78.88,84.25,3,0.06
```

---

## Usage Examples

### 1. Identify Best Trading Opportunities
```python
# Find high-confidence BUY signals with strong momentum
df = pd.read_csv('processed_scan_results_1d.csv')
opportunities = df[
    (df['signal'] == 'BUY') & 
    (df['signalConfidence'] > 85) & 
    (df['momentum'] > 2) &
    (df['volumeRatio'] > 1.2)
]
print(opportunities[['symbol', 'close', 'signal', 'signalReason']])
```

### 2. Risk Assessment
```python
# Find low-risk, high-reward setups
df = pd.read_csv('processed_scan_results_1d.csv')
low_risk = df[
    (df['volatilityLabel'] == 'LOW') &
    (df['riskRewardRatio'] > 2.0) &
    (df['dataQuality'] > 80)
]
```

### 3. Trend Analysis
```python
# Find strong uptrend with confirmation
df = pd.read_csv('processed_scan_results_1d.csv')
strong_trends = df[
    (df['trendDirection'] == 'UPTREND') &
    (df['adxTrend'] == 'STRONG') &
    (df['momentum'] > 3)
]
```

### 4. Volume Analysis
```python
# Find unusual volume activity
df = pd.read_csv('processed_scan_results_1d.csv')
volume_spike = df[df['volumeTrend'] == 'INCREASING']
print(volume_spike[['symbol', 'volume', 'volumeRatio', 'signal']])
```

### 5. Filter by Data Quality
```python
# Only use high-quality data
df = pd.read_csv('processed_scan_results_1d.csv')
quality_data = df[
    (df['confidence'] > 80) &
    (df['sources'] >= 2) &
    (df['deviation'] < 0.2)
]
```

---

## Real-time Integration

### Access via API
```bash
# Get latest scan results
curl http://localhost:5000/api/signals/latest

# Get detailed market frames
curl 'http://localhost:5000/api/gateway/market-frames/BTC%2FUSDT?limit=100'

# Get gateway health/stats
curl http://localhost:5000/api/gateway/health
```

### WebSocket Streaming
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');
ws.onmessage = (event) => {
  const signal = JSON.parse(event.data);
  // Signal contains all 70+ fields
  console.log(signal.symbol, signal.signal, signal.signalConfidence);
};
```

### Database Query
```sql
SELECT 
  symbol,
  indicators->>'rsi' as rsi,
  indicators->>'macd' as macd,
  indicators->>'adx' as adx,
  price->>'close' as close,
  volume,
  timestamp
FROM market_frames
WHERE symbol = 'BTC/USDT'
ORDER BY timestamp DESC
LIMIT 100;
```

---

## Scanner Processing Steps

1. **Fetch OHLCV** (100 candles from exchange)
2. **Calculate Momentum** (RSI, MACD, Stochastic)
3. **Calculate Trend** (EMA, SMA, ADX)
4. **Calculate Volatility** (ATR, Bollinger Bands)
5. **Analyze Order Flow** (Bid/Ask volume, spread)
6. **Generate Signal** (BUY/SELL/HOLD + confidence)
7. **Calculate Risk** (Stop-loss, take-profit, R/R)
8. **Assess Quality** (Confidence, deviation, sources)
9. **Broadcast** (WebSocket + API + Database)

---

## CSV Files Available

- `processed_scan_results_1d.csv` - Daily timeframe (15 symbols)
- `processed_scan_results_1h.csv` - Hourly timeframe
- `processed_scan_results_5m.csv` - 5-minute timeframe
- `processed_scan_results_1m.csv` - 1-minute timeframe
- `processed_scan_results_1w.csv` - Weekly timeframe
- `predictions_*.csv` - ML prediction results
- `scan_results_*_latest.csv` - Latest scan per timeframe

Each file contains the complete 70-column dataframe for all 15 symbols.

