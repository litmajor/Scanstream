# TypeScript Scanner Port - Quick Reference

## ✅ COMPLETED (Ported from Python)

### Signal Classification (`signal-classifier.ts`)
- ✅ `classifyMomentumSignal()` - Strong Buy/Sell signals
- ✅ `classifyState()` - Granular regime states (BULL_PARABOLIC, BEAR_EARLY, etc.)
- ✅ `classifyLegacy()` - Backward-compatible labels
- ✅ `calculateSignalStrength()` - 0-100 metric
- ✅ `calculateConfidenceScore()` - 0-1 alignment metric
- ✅ `calculateOpportunityScore()` - Entry point quality
- ✅ `calculateCompositeScore()` - Multi-indicator combination

### Risk Management (`risk-management.ts`)
- ✅ `calculateStopLossTakeProfit()` - Multi-method SL/TP
- ✅ `calculatePositionSize()` - Account-aware sizing
- ✅ `calculateBBPosition()` - Bollinger Band zones
- ✅ `calculateVolumeRatio()` - Volume acceleration
- ✅ `calculateTrendScore()` - EMA quality metric

### Market Regime Detection (`market-regime-detector.ts`)
- ✅ `detectRegime()` - Bull/Bear/Ranging detection
- ✅ `calculateFibonacciLevels()` - Fib retracement/extension
- ✅ `calculateFibConfluenceScore()` - POC/VWAP/Fib confluence

### Enhanced Momentum Scanner (`momentum-scanner.ts`)
- ✅ `computeScore()` - Full scoring pipeline with:
  - Signal classification
  - Regime detection
  - Confidence metrics
  - Comprehensive indicator breakdown
- ✅ `calculateOpportunity()` - Entry quality scoring
- ✅ `calculateRiskLevels()` - Risk/reward extraction

### Technical Indicators (`indicators.ts` - pre-existing)
- ✅ MACD (line, signal, histogram)
- ✅ RSI
- ✅ Slope
- ✅ EMA, SMA, VWMA
- ✅ ATR, ADX
- ✅ Bollinger Bands
- ✅ VWAP
- ✅ Volume Profile
- ✅ Ichimoku
- ✅ Fibonacci levels

---

## 🚧 IN PROGRESS / TODO

### 1. Market Data Fetcher
```typescript
// TODO: Implement in market-data-fetcher.ts
- fetch_markets() - Symbol discovery by volume/type
- fetch_ohlcv() - Historical candle fetching
- Rate limiting (50 concurrent max)
- Circuit breaker (pause on 10 rate limit hits)
- Cache strategy (5 minute TTL)
- Retry logic (3 attempts with exponential backoff)
```

### 2. Multi-Timeframe Scanning
```typescript
// TODO: Implement in scanner.ts or new file
- scan_multi_timeframe() - Parallel timeframe analysis
  - Scan 1m, 5m, 1h, 1d timeframes
  - Convergence detection across timeframes
  - Cross-timeframe confirmation logic
- scan_market() - Market-wide scanning
  - Symbol filtering by 24h volume
  - Top-N result selection (default: 50)
  - Result ranking by composite score
```

### 3. Continuous Scanner
```typescript
// TODO: Port from continuous_scanner.py
- Multi-timeframe convergence analysis
- Data persistence (pickle → JSON)
- Candle clustering for trend formation
- Mean reversion exhaustion detection
- Streaming data updates via WebSocket
- Signal deduplication across timeframes
```

### 4. Database Integration
```typescript
// TODO: Create in database layer
- Store scan results with timestamps
- Query historical signals for ML training
- Track signal accuracy over time
- Persistence format: PostgreSQL or SQLite
```

### 5. API Endpoints
```typescript
// TODO: Create in API routes
GET  /api/scanner/signal/:symbol/:timeframe
GET  /api/scanner/scan-results
GET  /api/scanner/regime/:symbol
POST /api/scanner/backtest
```

---

## 📊 What Each Module Does

### Signal Classifier
Takes 5 core indicators and produces:
1. **Signal** - What to do (Buy/Sell/Neutral)
2. **Strength** - How confident (0-100)
3. **Confidence** - How aligned are indicators (0-1)
4. **State** - Detailed regime (BULL_EARLY, BEAR_STRONG, etc.)

**Indicator Inputs:**
- Momentum (1d, 7d, 30d)
- RSI (0-100)
- MACD histogram
- Bollinger Band position (0-1)
- Volume ratio

### Risk Management
Takes price & indicators and calculates:
1. **Stop Loss** - Where to exit if wrong
   - ATR-based (1.5-2x ATR)
   - Support-based (just below)
   - Percentage-based (2-3%)
2. **Take Profit** - Where to take gains
   - Risk/reward ratio (default: 2.5x)
   - Resistance-based
3. **Position Size** - How much to trade
   - Account risk % (default: 2%)
   - Leverage adjusted (default: 1.0x)
   - Fee-adjusted calculations

### Regime Detection
Analyzes 200+ candles and determines:
1. **Regime** - bull/bear/ranging
2. **Confidence** - 0-100 how sure
3. **Trend Strength** - ADX 0-100
4. **Volatility** - low/medium/high (ATR %)
5. **Opportunity Threshold** - 60-80% based on regime

**EMA Alignment Checked:**
- Price > EMA20/50/200
- EMA20 > EMA50 > EMA200
- Bullish signals (4/5 = strong bull)
- Bearish signals (4/5 = strong bear)

---

## 🔄 Signal Flow

```
Market Data (OHLCV candles)
        ↓
Technical Indicators (MACD, RSI, Slope, Volume, etc.)
        ↓
Momentum Calculation (1d, 7d, 30d periods)
        ↓
┌─────────────────────────────────────┐
│  Signal Classifier                  │
│  - Classify momentum signal          │
│  - Detect market state              │
│  - Calculate signal strength        │
│  - Calculate confidence score       │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│  Market Regime Detector             │
│  - Detect bull/bear/ranging        │
│  - Calculate trend strength         │
│  - Assess volatility               │
│  - Fibonacci confluence            │
└─────────────────────────────────────┘
        ↓
┌─────────────────────────────────────┐
│  Risk Management                    │
│  - Calculate SL/TP levels          │
│  - Determine position size         │
│  - Assess opportunity quality      │
└─────────────────────────────────────┘
        ↓
Trading Decision Output:
{
  signal: 'Buy',
  strength: 75,
  confidence: 0.82,
  regime: 'bull',
  stopLoss: 95,
  takeProfit: 110,
  positionSize: 0.5,
  riskRewardRatio: 2.5
}
```

---

## 📈 Usage Flow Examples

### Example 1: Quick Signal Check
```typescript
import MomentumScanner from './momentum-scanner';

const frames = [...]; // 50+ candles with OHLCV
const result = MomentumScanner.computeScore(frames);

if (result.signal === 'Buy' && result.confidence > 0.7) {
  console.log(`BUY SIGNAL: ${result.signalStrength}/100 confidence`);
  console.log(`Regime: ${result.regime}`);
}
```

### Example 2: Full Trade Setup
```typescript
import SignalClassifier from './signal-classifier';
import RiskManagement from './risk-management';

// Step 1: Get signal
const classifier = SignalClassifier.classifyMomentumSignal(...);

// Step 2: If good signal, calculate risk levels
if (classifier.signal.includes('Buy')) {
  const riskLevels = RiskManagement.calculateStopLossTakeProfit(
    currentPrice, marketData, classifier.signal
  );
  
  // Step 3: Size position
  const posSize = RiskManagement.calculatePositionSize(
    accountBalance, 2, riskLevels.entryPrice, riskLevels.stopLoss
  );
  
  console.log({
    entry: riskLevels.entryPrice,
    stopLoss: riskLevels.stopLoss,
    takeProfit: riskLevels.takeProfit,
    positionValue: posSize.positionValue,
    units: posSize.units,
    safe: posSize.safeToTrade
  });
}
```

### Example 3: Regime Assessment
```typescript
import MarketRegimeDetector from './market-regime-detector';

const regime = MarketRegimeDetector.detectRegime(closes, highs, lows);

// Adjust scanner thresholds based on regime
const opportunityThreshold = regime.suggestedOpportunityThreshold; // 60-80

if (opportunity < opportunityThreshold) {
  console.log(`Skip entry (opportunity ${opportunity} < threshold ${opportunityThreshold})`);
}
```

---

## 🎯 Key Differences from Python

| Aspect | Python | TypeScript |
|--------|--------|-----------|
| DataFrame | pandas.DataFrame | `number[]` arrays |
| Class Design | Instance methods | Static utility functions |
| Async | Heavy async/await | Sync by default |
| Type Safety | Type hints | Full TypeScript types |
| Dependencies | pandas, numpy, ta | None (pure TS) |
| Performance | Slower (DSL overhead) | Faster (native) |
| Testing | pytest | Jest (ready for) |

---

## ✨ Features Implemented

1. **Volatility-Adjusted Thresholds**
   - Thresholds scale 0.5x - 2.0x based on volume ratio
   - Prevents whipsaws in low-volume markets
   - Finds signals in high-volatility markets

2. **Regime-Aware Scanning**
   - Bull: 60% opportunity threshold (easier entries)
   - Bear: 75% opportunity threshold (harder entries)
   - Ranging: 80% opportunity threshold (very selective)

3. **Entry Quality Optimization**
   - Reward pullbacks in trends
   - Penalize overbought/oversold extremes
   - Ichimoku + Fibonacci confluence scoring

4. **Risk/Reward Protection**
   - Tight SL validation (0.5-8% distance)
   - Liquidation price warnings
   - Margin usage alerts
   - Fee-adjusted calculations

5. **Confidence Metrics**
   - Signal strength (0-100)
   - Indicator alignment (0-1)
   - Regime confidence (0-1)
   - Opportunity score (0-100)

---

## 📝 Next Priority

**Most Important:**
1. Implement `MarketDataFetcher` - Can't scan without data source
2. Implement `scan_multi_timeframe()` - Core scanning logic
3. Implement `scan_market()` - Top-N filtering and ranking

**Then:**
4. Database persistence layer
5. API endpoints
6. Real-time streaming updates

**Finally:**
7. ML model integration
8. Advanced pattern detection
9. Agent-based ensemble

---

**Status**: 🟢 CORE PORTED - Ready for market data integration and multi-timeframe scanning
