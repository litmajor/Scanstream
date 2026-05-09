# Scanner Modules Quick Reference

**Overview**: All scanner modules are production-ready in `server/services/scanner/`. Use this guide to understand which module to use for your needs.

---

## 1. Signal Classifier

**Location**: `server/services/scanner/signal-classifier.ts`  
**What it does**: Classifies market signals and generates trading recommendations

### Key Methods

```typescript
import SignalClassifier from './signal-classifier';

// Main classification - returns one of 7 signal levels
SignalClassifier.classifyMomentumSignal(
  momentum1d: number,     // 1-day momentum (-1 to +1)
  momentum7d: number,     // 7-day momentum
  rsi: number,            // RSI (0-100)
  macdHist: number,       // MACD histogram value
  config?: Config         // optional thresholds
): SignalClassificationResult
// Returns: { signal, level, strength, confidence }
// Signals: "Strong Buy" | "Buy" | "Weak Buy" | "Neutral" | "Weak Sell" | "Sell" | "Strong Sell"

// Get market state (9 possible states)
SignalClassifier.classifyState(
  momentum: number,
  rsi: number,
  trend: string,
  volatility: number
): RegimeState
// Returns: BULL_PARABOLIC | BULL_BREAKOUT | BULL_ESTABLISHED | BULL_WEAKENING |
//          NEUTRAL_ACCUM | NEUTRAL_DIST |
//          BEAR_BREAKDOWN | BEAR_CAPITULATION | BEAR_ESTABLISHED

// Legacy 13-label classification (backward compat)
SignalClassifier.classifyLegacy(
  momentum: number,
  rsi: number
): LegacyLabel

// Get confidence score (0-1)
SignalClassifier.calculateConfidenceScore(
  strength: number,
  momentum: number,
  trend: string
): number

// Entry opportunity score (0-100, higher = better entry)
SignalClassifier.calculateOpportunityScore(
  signal: string,
  strength: number,
  reward: number,
  risk: number
): number

// Composite indicator score
SignalClassifier.calculateCompositeScore(
  macd: number,
  rsi: number,
  momentum: number,
  trend: number
): number
```

### Example Usage

```typescript
const result = SignalClassifier.classifyMomentumSignal(
  0.05,  // momentum1d: +5%
  0.15,  // momentum7d: +15%
  65,    // RSI: overbought
  0.25   // MACD: positive histogram
);

if (result.signal === "Buy" && result.confidence > 0.7) {
  console.log("Entry opportunity with high confidence");
}
```

---

## 2. Risk Management

**Location**: `server/services/scanner/risk-management.ts`  
**What it does**: Calculates stop losses, take profits, position sizes, and risk metrics

### Key Methods

```typescript
import RiskManagement from './risk-management';
import type { MarketData } from './risk-management';

// Calculate stop loss and take profit levels
RiskManagement.calculateStopLossTakeProfit(
  entryPrice: number,
  marketData: MarketData,      // { high, low, close, volume, atr }
  riskPercent?: number         // default 2%
): StopLossTakeProfitResult
// Returns: { stopLoss, takeProfit, riskRewardRatio, method }
// Methods: "ATR" | "SUPPORT_RESISTANCE" | "PERCENTAGE"

// Size position based on account risk
RiskManagement.calculatePositionSize(
  accountSize: number,         // total account balance
  entryPrice: number,
  stopLoss: number,
  riskPercent?: number,        // default 2% per trade
  leverage?: number            // default 1x
): PositionSizeResult
// Returns: { positionSize, notionalValue, liquidationPrice, warning }

// Bollinger Band position analysis
RiskManagement.calculateBBPosition(
  price: number,
  bbUpper: number,
  bbLower: number
): number
// Returns: -1 (below), 0 (middle), +1 (above)

// Volume acceleration metric
RiskManagement.calculateVolumeRatio(
  volumes: number[],           // last N volumes
  lookback?: number            // default 20
): number
// Returns: 0.5-2.0 (0.5x = weak, 2.0x = strong)

// Trend quality metric
RiskManagement.calculateTrendScore(
  closes: number[],
  lookback?: number            // default 20
): number
// Returns: 0-10 (10 = strong trend)
```

### Example Usage

```typescript
const riskResult = RiskManagement.calculateStopLossTakeProfit(
  100,  // entry at $100
  {
    high: 102,
    low: 98,
    close: 101,
    volume: 1000000,
    atr: 2
  }
);

const positionSize = RiskManagement.calculatePositionSize(
  10000,        // $10k account
  100,          // entry price
  riskResult.stopLoss,
  2,            // risk 2% per trade
  2             // 2x leverage
);

console.log(`Position: ${positionSize.positionSize} coins`);
console.log(`Risk/Reward: ${riskResult.riskRewardRatio}:1`);
```

---

## 3. Market Regime Detector

**Location**: `server/services/scanner/market-regime-detector.ts`  
**What it does**: Detects bull/bear/ranging markets and calculates support/resistance levels

### Key Methods

```typescript
import MarketRegimeDetector from './market-regime-detector';

// Detect current market regime
MarketRegimeDetector.detectRegime(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes?: number[]
): RegimeDetectionResult
// Returns: { regime, confidence, adx, emaTrend, volatility }
// Regimes: "BULL" | "BEAR" | "RANGING"

// Calculate Fibonacci levels
MarketRegimeDetector.calculateFibonacciLevels(
  highs: number[],
  lows: number[],
  closes: number[],
  lookback?: number            // default 55
): FibonacciLevels
// Returns: { level0, level23_6, level38_2, ..., level161_8 }

// Score confluence (POC, VWAP, Fib)
MarketRegimeDetector.calculateFibConfluenceScore(
  price: number,
  fibonacciLevels: FibonacciLevels,
  vwap: number,
  poc: number,                 // point of control (from volume profile)
  tolerance?: number           // default 0.002 = 0.2%
): number
// Returns: 0-100 (higher = more support/resistance)
```

### Example Usage

```typescript
const regime = MarketRegimeDetector.detectRegime(
  closes,  // last N close prices
  highs,   // last N high prices
  lows,    // last N low prices
  volumes  // optional
);

if (regime.regime === "BULL" && regime.confidence > 0.8) {
  // Use bullish thresholds for signal classification
}

const fib = MarketRegimeDetector.calculateFibonacciLevels(
  highs,
  lows,
  closes
);

const confluence = MarketRegimeDetector.calculateFibConfluenceScore(
  currentPrice,
  fib,
  vwapValue,
  pocValue
);

// Levels with high confluence are strong support/resistance
```

---

## 4. Momentum Scanner

**Location**: `server/services/scanner/momentum-scanner.ts`  
**What it does**: Central scoring engine integrating all modules

### Key Methods

```typescript
import { MomentumScanner } from './momentum-scanner';
import type { MarketFrame } from './continuous-scanner';

// Compute comprehensive momentum score
MomentumScanner.computeScore(
  frames: MarketFrame[]        // OHLCV data
): MomentumScoreResult
// Returns: {
//   score: number (-1 to +1),
//   signal: string ("Strong Buy" | "Buy" | ... | "Strong Sell"),
//   signalStrength: number (0-100),
//   confidence: number (0-1),
//   regime: string ("BULL" | "BEAR" | "RANGING"),
//   regimeConfidence: number,
//   indicators: { macd, rsi, momentum1d, ... }
// }
```

### Example Usage

```typescript
const ohlcvData: MarketFrame[] = [
  {
    timestamp: 1698432000000,
    price: { open: 100, high: 102, low: 99, close: 101 },
    volume: 1000000
  },
  // ... more frames
];

const result = MomentumScanner.computeScore(ohlcvData);

console.log(`Signal: ${result.signal}`);
console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
console.log(`Regime: ${result.regime}`);
console.log(`Indicators: ${JSON.stringify(result.indicators, null, 2)}`);
```

---

## 5. Indicators Library

**Location**: `server/services/scanner/indicators.ts`  
**What it does**: Provides 46+ technical indicator calculations

### Available Indicators

```typescript
import * as indicators from './indicators';

// Trend Indicators
indicators.macd(closes)                    // → { macd, signal, histogram }
indicators.ema(values, period)             // → number[]
indicators.sma(values, period)             // → number[]
indicators.slope(values, period)           // → number

// Momentum Indicators
indicators.rsi(closes)                     // → number[]
indicators.adx(highs, lows, closes)        // → number
indicators.stochastic(closes)              // → { k, d }

// Volatility Indicators
indicators.bbUpper(closes, period)         // → number[]
indicators.bbLower(closes, period)         // → number[]
indicators.atr(highs, lows, closes)        // → number[]

// Volume Indicators
indicators.vwap(closes, volumes, period)   // → number[]
indicators.volumeProfile(...)              // → ProfileData

// Fibonacci & Levels
indicators.fibLevels(highs, lows, closes)  // → FibonacciLevels

// Ichimoku & Others
indicators.ichimoku(closes)                // → IchimokuData
indicators.obv(closes, volumes)            // → number[]
// ... and 30+ more
```

---

## 6. Continuous Scanner

**Location**: `server/services/scanner/continuous-scanner.ts`  
**What it does**: Multi-timeframe scanning framework for continuous monitoring

### Key Methods

```typescript
import { ContinuousMultiTimeframeScanner } from './continuous-scanner';

const scanner = new ContinuousMultiTimeframeScanner(
  ['BTC/USDT', 'ETH/USDT'],        // symbols
  ['1m', '5m', '1h', '1d'],        // timeframes
  {
    pollIntervalMs: 30000,          // poll every 30s
    lookbackCandles: 200,           // use 200 candles per timeframe
    persistIntervalMs: 5 * 60000    // persist every 5 mins
  }
);

// Listen for scan results
scanner.on('scan_complete', (result) => {
  console.log(`Scan complete:`, result);
});

scanner.on('signal', (signal) => {
  console.log(`New signal: ${signal.symbol} - ${signal.action}`);
});

// Start scanning
await scanner.start();

// Stop when done
scanner.stop();
```

---

## 7. Data Flow Integration

### How the Modules Work Together

```
Raw OHLCV Data (from MarketDataFetcher)
       ↓
Momentum Scanner (computeScore)
       ├─→ indicators.ts (46+ calculations)
       ├─→ MarketRegimeDetector (detect regime)
       ├─→ SignalClassifier (classify signal)
       └─→ RiskManagement (calculate risk/reward)
       ↓
MomentumScoreResult {
  signal: "Buy" | "Sell" | ...
  confidence: 0.85
  regime: "BULL"
  indicators: { macd, rsi, momentum, ... }
  score: +0.7
}
       ↓
Trading System / WebSocket / Frontend
```

---

## 8. Configuration Options

### Volatility-Adjusted Thresholds

All modules support dynamic threshold scaling based on volatility:

```typescript
// Volume ratio 0.5x-2.0x affects thresholds
// Low volume (0.5x):  More conservative thresholds
// High volume (2.0x): More aggressive thresholds

const volRatio = RiskManagement.calculateVolumeRatio(volumes);
// Returns: 0.5 (weak) to 2.0 (strong)

// Thresholds automatically scale in SignalClassifier
```

### Regime-Specific Adjustments

```typescript
// Different opportunity thresholds per regime
// BULL:    60% confidence needed
// BEAR:    75% confidence needed
// RANGING: 80% confidence needed

const regime = MarketRegimeDetector.detectRegime(closes, highs, lows);
const confidence = SignalClassifier.calculateConfidenceScore(...);

if (confidence >= REGIME_THRESHOLDS[regime.regime]) {
  // Signal is valid for this regime
}
```

---

## 9. Performance Tips

### For Real-Time Scoring
```typescript
// Use optimized variants
import MomentumScanner from './momentum-scanner-optimized';
// 20-30% faster than standard version
```

### For Heavy Calculations
```typescript
// Use worker pool for large symbol sets
import { HeavyIndicatorWorkerPool } from './heavy-indicator-worker-pool';

const pool = new HeavyIndicatorWorkerPool(4);  // 4 workers
const result = await pool.compute(ohlcvData);
```

### For Caching
```typescript
import { IndicatorCache } from './indicator-cache';

const cache = new IndicatorCache();
const indicator = cache.getOrCompute('MACD', closes);
// Reuses recent computations if available
```

---

## 10. Integration Checklist

Use this to integrate scanner into your system:

- [ ] Import `MomentumScanner` for score calculations
- [ ] Import `SignalClassifier` for signal generation
- [ ] Import `RiskManagement` for risk calculations
- [ ] Set up `MarketDataFetcher` for continuous data
- [ ] Set up `ContinuousMultiTimeframeScanner` for polling
- [ ] Wire WebSocket to broadcast results
- [ ] Test with 5-10 symbols before scaling
- [ ] Monitor performance (should be <50ms per symbol)
- [ ] Set up logging/monitoring for signals
- [ ] Create alerts for high-confidence signals

---

## 11. Common Patterns

### Pattern 1: Real-Time Signal Generation
```typescript
const fetcher = new MarketDataFetcher(aggregator, cache, limiter, pipeline);
await fetcher.start();
// Auto-fetches every 30s → generates signals → broadcasts via WebSocket
```

### Pattern 2: Batch Processing
```typescript
const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const results = await Promise.all(
  symbols.map(async sym => {
    const frames = await getOHLCVData(sym);
    return MomentumScanner.computeScore(frames);
  })
);
```

### Pattern 3: Multi-Timeframe Convergence
```typescript
const result1m = MomentumScanner.computeScore(frames1m);
const result5m = MomentumScanner.computeScore(frames5m);
const result1h = MomentumScanner.computeScore(frames1h);

// Check if all agree
const consensus = (result1m.signal === result5m.signal && 
                   result5m.signal === result1h.signal);

if (consensus && result1h.confidence > 0.8) {
  // High-conviction trade
}
```

### Pattern 4: Risk-Adjusted Entry
```typescript
const momentum = MomentumScanner.computeScore(frames);
const riskResult = RiskManagement.calculateStopLossTakeProfit(
  entryPrice,
  marketData
);

const position = RiskManagement.calculatePositionSize(
  accountSize,
  entryPrice,
  riskResult.stopLoss,
  riskPercent
);

if (momentum.confidence > 0.7 && position.warning === null) {
  // Safe to enter
}
```

---

## 12. Troubleshooting

### Low Confidence Scores
- Check: Are you using enough historical data? (min 50-100 candles)
- Check: Is volatility too high? (markets consolidating)
- Check: Is regime detection working? (should match actual market)

### Mismatched Signals Across Timeframes
- This is expected during transitions (5m might turn before 1h)
- Use multi-timeframe convergence for confirmation
- Look for regime alignment for best results

### Performance Issues
- Use worker pool for >50 symbols
- Use cached indicators
- Use optimized scanner variants
- Check rate limiting isn't causing delays

### WebSocket Connection Issues
- Check MarketDataLayer connection
- Verify WebSocket URL is correct
- Check rate limiting on server
- Review browser console for errors

---

**Last Updated**: October 27, 2024  
**Status**: All modules production-ready ✅
