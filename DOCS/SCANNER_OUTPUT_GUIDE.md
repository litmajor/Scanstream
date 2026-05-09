# Scanner Output Guide - Complete Data Reference

## Scanner Logic Overview

Your system uses **2-phase scanning**:

### Phase 1: Quick Scan (5-10 seconds)
- Fetches latest prices from multiple exchanges
- Calculates basic technical indicators (RSI, MACD, EMA)
- Generates initial BUY/SELL/HOLD signals
- Returns results to frontend immediately

### Phase 2: Background Processing
- Deep technical analysis
- ML predictions
- Complex scoring
- State tracking & persistence

---

## Scanner Output CSV Columns

Generated every 30 seconds for all 15 trading pairs.

### Core Data (9 columns)
| Column | Type | Range | Description |
|--------|------|-------|-------------|
| **symbol** | string | BTC/USDT, ETH/USDT, etc | Trading pair |
| **timeframe** | string | 1m, 5m, 1h, 4h, 1d | Candle timeframe |
| **price** | float | 0-∞ | Current market price |
| **confidence** | float | 0-100% | Data quality confidence |
| **sources** | integer | 1-6 | Number of exchanges confirming |
| **deviation** | float | 0-1 | Price deviation across sources |
| **timestamp** | ISO8601 | - | UTC timestamp of scan |
| **dataQuality** | float | 0-100 | Overall data quality score |

### Technical Indicators (13 columns)

**Momentum Indicators:**
- **rsi**: 0-100 (Relative Strength Index - oversold <30, overbought >70)
- **macd**: -∞ to +∞ (Momentum - crossing above/below signal = buy/sell)
- **macdSignal**: -∞ to +∞ (MACD signal line)
- **macdHistogram**: -∞ to +∞ (MACD - Signal = strength)
- **momentum**: % (Rate of price change over 10 periods)

**Trend Indicators:**
- **ema20**: price (Exponential Moving Average 20 periods)
- **ema50**: price (Exponential Moving Average 50 periods)
- **trendStrength**: 0-1 (How strong the trend is)
- **adx**: 0-100 (Average Directional Index - trend strength)

**Volatility Indicators:**
- **volatility**: decimal (ATR / Price - market stability)
- **atr**: price (Average True Range - volatility measure)
- **bbPosition**: 0-1 (Position between Bollinger Bands)

**Volume Indicators:**
- **volumeRatio**: 0-∞ (Current vol vs 20-period average)

---

## How to Use This Data

### 1. **Signal Generation**
```
RSI > 70 && MACD crosses above signal = STRONG BUY
RSI < 30 && MACD crosses below signal = STRONG SELL
Price > EMA20 > EMA50 && Trend > 0.6 = BULLISH
```

### 2. **Data Quality Check**
```
Confidence > 80% = Use data
Sources >= 3 = Reliable cross-exchange verification
Deviation < 0.3 = Prices aligned across exchanges
DataQuality > 75% = High-quality analysis
```

### 3. **Risk Assessment**
```
Volatility > 0.05 = HIGH RISK (use smaller positions)
Volatility < 0.02 = LOW RISK (safer entry)
ADX < 20 = No clear trend (avoid trending strategies)
ADX > 40 = Strong trend (good for trend following)
```

### 4. **Opportunity Detection**
```
RSI 30-50 + Positive Momentum + Trend > 0.5 = ACCUMULATION
Volume Ratio > 2 = Unusual activity (breakout setup)
BB Position near 0 or 1 = Bounce setup
```

---

## Integration Points

### Real-time Updates
- **WebSocket**: `/ws` broadcasts signals every 30 seconds
- **REST API**: `/api/signals/latest` - last 10 signals
- **Market Data**: `/api/gateway/market-frames/:symbol` - detailed candles

### Database Storage
- All scans stored in `market_frames` table with full JSON indicators
- Signals persisted in `signals` table with reasoning

### Frontend Display
Currently shows:
- Symbol, Timeframe, Price
- Confidence, Data Quality
- Latest Signal (BUY/SELL/HOLD)
- Technical Indicators (charts)

### Planned Enhancements
- [ ] Add volume profile visualization
- [ ] Add order flow heatmap
- [ ] Add ML prediction overlay
- [ ] Add backtest results integration
- [ ] Add performance tracking per signal

---

## Sample Data Interpretation

Looking at the sample CSV output:

**Best Signals (High Quality):**
- OP/USDT: RSI 38.56, DataQuality 94.8%, Confidence 86.8%
- ARB/USDT: RSI 51.67, DataQuality 86.2%, Confidence 83.9%
- AAVE/USDT: RSI 61.58, DataQuality 86.1%, Confidence 90.7%

**Indicator Alignment:**
- ATOM/USDT: RSI 67.66 (HIGH), Momentum -0.30% (CONSOLIDATING), TrendStrength 0.57 (MODERATE)
- UNI/USDT: RSI 55.07 (NEUTRAL), Momentum 4.60% (RISING), TrendStrength 0.41 (WEAK)

**Risk Factors:**
- SOL/USDT: High Volatility 0.0354, VolumeRatio 2.55 (SPIKY)
- ADA/USDT: Low Volatility 0.01, VolumeRatio 0.95 (STABLE)

---

## Accessing the Data

### CSV Export (This file)
- Contains sample from latest scan cycle
- 15 trading pairs × 19 columns

### Real-time API Access
```bash
# Get all latest signals
curl http://localhost:5000/api/signals/latest

# Get market frames for BTC
curl http://localhost:5000/api/gateway/market-frames/BTC%2FUSDT?limit=100

# Get gateway health & stats
curl http://localhost:5000/api/gateway/health
```

### Database Query
```sql
SELECT symbol, timestamp, indicators->>'rsi' as rsi, 
       indicators->>'macd' as macd,
       volume, price->>'close' as close_price
FROM market_frames
WHERE symbol = 'BTC/USDT'
ORDER BY timestamp DESC
LIMIT 100;
```

---

## FAQ

**Q: Why multiple sources?**
A: Reduces exchange API errors, validates prices, ensures redundancy

**Q: How often is this scanned?**
A: Every 30 seconds (configurable in MarketDataFetcher)

**Q: Can I trade on these signals directly?**
A: Yes - signals include stop-loss, take-profit, and risk/reward ratios

**Q: What's the confidence score?**
A: Weighted combination of:
- Price confidence across sources (40%)
- Data completeness (30%)
- Source diversity (20%)
- Low price deviation bonus (10%)

**Q: Can this data be included in frontend charts?**
A: Yes - all indicators are ready for TradingView, Recharts, or ApexCharts

---

Generated: 2025-11-29
Update frequency: Every 30 seconds
Data retention: Last 100 candles per symbol (≈100 hours at 1h timeframe)
