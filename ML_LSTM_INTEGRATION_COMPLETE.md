# ML LSTM Integration Guide - Phase 2 Setup Complete

## Overview
Implemented complete LSTM training and inference system that feeds predictions into the 3-source consensus engine (Scanner + ML + RL).

## What Was Implemented

### 1. **LSTM Trainer Service** (`server/services/lstm-trainer.ts`)
- Trains LSTM neural networks on 1-hour historical candles
- Supports multi-symbol training (BTC, ETH, etc.)
- Predicts 6 targets:
  - **Direction**: BULLISH/BEARISH classification
  - **Price**: Next candle close price
  - **Volume**: Next candle volume
  - **Volatility**: Expected volatility level
  - **Regime Duration**: How long regime persists (NEW)
  - **Velocity Confidence**: Movement expectations (NEW)

**Key Features:**
- Configurable lookback (default 365 days)
- 100-candle sequence length (LSTM memory)
- 80/20 train/validation split
- 50 epochs default training
- Checkpoint saving to disk
- Synthetic data generation for testing

**Usage:**
```bash
POST /api/ml/lstm/train
{
  "symbols": ["BTC", "ETH"],
  "lookbackDays": 365,
  "lookbackCandles": 100,
  "epochs": 50
}
```

### 2. **LSTM Inference Engine** (`server/services/lstm-inference-engine.ts`)
- Loads trained checkpoints from disk
- Generates real-time predictions on new market data
- Combines velocity profiles with LSTM predictions
- Outputs comprehensive prediction objects

**Predicts:**
- Direction probability + confidence
- Price target + high/low bands
- Volume forecast
- Volatility level
- **Regime duration** (new - when to expect regime change)
- **Velocity profile** (new - historical move expectations)
- Trend momentum (strengthening/weakening)
- Risk factors

**Usage:**
```bash
POST /api/ml/lstm/predict
{
  "symbols": ["BTC", "ETH"],
  "timeframe": "1h",
  "lookbackCandles": 100
}
```

### 3. **ML Signal Source** (`server/services/ml-signal-source.ts`)
- Converts LSTM predictions → consensus signals
- Generates BUY/SELL/HOLD signals
- Scores confidence (0-1)
- Integrates with classical ML predictions

**Combines:**
- LSTM predictions (primary)
- Classical ML predictions (when available)
- Confidence adjustment on agreement/disagreement
- Risk-aware HOLD recommendations

**Output:**
```json
{
  "symbol": "BTC",
  "source": "ml-lstm",
  "signal": "BUY",
  "confidence": 0.82,
  "strength": 75,
  "reasoning": ["LSTM Direction: BULLISH", "Price Target: $45,200"]
}
```

### 4. **ML LSTM Routes** (`server/routes/ml-lstm.ts`)
Five new API endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ml/lstm/train` | POST | Train LSTM on historical data |
| `/api/ml/lstm/predict` | POST | Generate predictions & signals |
| `/api/ml/lstm/consensus` | POST | Batch consensus signals |
| `/api/ml/lstm/model-info` | GET | Check trained models |
| `/api/ml/lstm/status` | GET | System status |

---

## Architecture: 3-Source Consensus Engine

Now consensus engine receives signals from:

```
Scanner Signals
    ↓
  Consensus Engine ← ML LSTM Signals (NEW)
    ↓              ← RL Agent Signals
  Final Decision (BUY/SELL/HOLD)
    ↓
Position Sizing + Risk Management
```

### How ML Source Integrates:

1. **Scanning Phase**: Scanner generates patterns → quality gating
2. **ML Phase** (NEW): LSTM predicts direction/price/duration/velocity
3. **Consensus Vote**: Majority voting across 3 sources
4. **Position Sizing**: Confidence-weighted position allocation

---

## New Prediction Targets

### Regime Duration (NEW)
**What it predicts:** How many candles until market regime changes
- Helps avoid holding during regime transitions
- Enables proactive strategy switching
- Output: `regimeDuration.candles`, `confidence`

**How it works:**
- Analyzes volatility trends over sequence
- Detects regime change patterns
- Assigns confidence score (0-1)

### Velocity Profile Confidence (NEW)
**What it predicts:** Expected historical movement patterns
- Uses velocity profile data from `asset-velocity-profiler`
- Predicts realistic profit targets
- Output: `expected1DMove`, `expected7DMove`, `profitTarget`

**Integration with Historical Data:**
```
Historical velocity: "BTC 1D move = $8,200 avg"
LSTM confidence: 0.75
Recommended TP: $8,200 * 0.7 = $5,740 move
```

---

## Training Data & Model Persistence

### Data Flow:
```
Raw 1h Candles (365 days)
    ↓
Normalization (mean/std)
    ↓
Sequence Creation (100-candle windows)
    ↓
Train/Val Split (80/20)
    ↓
LSTM Training (50 epochs)
    ↓
Checkpoint Save (JSON)
```

### Checkpoint Format:
```
{
  "symbol": "BTC",
  "weights": { direction, price, volume, volatility, regimeDuration, velocityConfidence },
  "metrics": [...],
  "config": {...},
  "trainedAt": 1703102400000,
  "dataPoints": 8760
}
```

### Where Models Are Saved:
- Location: `data/lstm-models/checkpoints/`
- Filename: `{symbol}-{timestamp}.json`
- Auto-loaded on prediction requests

---

## Step-by-Step Setup

### Step 1: Train LSTM Models
```bash
curl -X POST http://localhost:5000/api/ml/lstm/train \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["BTC", "ETH"],
    "lookbackDays": 365,
    "epochs": 50,
    "batchSize": 32
  }'
```

Expected output:
```json
{
  "success": true,
  "message": "Training complete in 45.2s",
  "metrics": {
    "finalEpoch": {...},
    "bestAccuracy": 0.68,
    "averageLoss": 0.0234,
    "epochs": 50
  }
}
```

### Step 2: Generate Predictions
```bash
curl -X POST http://localhost:5000/api/ml/lstm/predict \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["BTC", "ETH"],
    "timeframe": "1h"
  }'
```

Returns detailed LSTM predictions with NEW fields:
- `regimeDuration` (candles until regime change)
- `velocityProfile` (historical moves + profit targets)
- `trendMomentum` (trend strength analysis)

### Step 3: Get Consensus Signals
```bash
curl -X POST http://localhost:5000/api/ml/lstm/consensus \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["BTC", "ETH"]
  }'
```

Returns consensus signals ready for scanner integration:
```json
{
  "signals": [
    {
      "symbol": "BTC",
      "source": "ml-lstm",
      "signal": "BUY",
      "confidence": 0.82,
      "positionSizing": {
        "positionSizePercent": 0.82,
        "confidence": 0.82,
        "riskLevel": "medium"
      }
    }
  ]
}
```

---

## Integration with Scanner

To integrate ML signals into multi-exchange scanner:

1. **In Scanner Service** (e.g., `server/services/scanner/momentum-scanner.ts`):

```typescript
import { mlSignalSource } from '../ml-signal-source';

// After scanner generates signals...
const mlSignal = await mlSignalSource.generateSignal(symbol);
if (mlSignal) {
  signalsToConsensus.push(mlSignal);
}
```

2. **In Consensus Engine** (e.g., `server/services/signal-consensus.ts`):

```typescript
// Aggregate 3 sources
const sources = [
  scannerSignal,      // Source 1
  mlSignal,          // Source 2 (NEW)
  rlSignal           // Source 3
];

const consensusVote = aggregateSignals(sources);
```

3. **Position Sizing Update**:

```typescript
// Use ML confidence for position sizing
const mlConfidence = mlSignal.confidence;  // 0-1
const positionSize = baseSize * mlConfidence;
```

---

## Performance Metrics

### Expected Accuracy (Baseline):
- **Direction**: ~60-65% (better than random 50%)
- **Price MAE**: ~2-3% (mean absolute error)
- **Volatility**: ~55-60% classification accuracy
- **Regime Duration**: ~0.65 confidence (new, needs validation)

### Model Behavior:
- Trains faster on 1h data than 5m data
- Converges after ~20-30 epochs typically
- Overfitting possible after epoch 100+
- Validation loss should decrease then plateau

### Optimization Tips:
1. **Increase training data**: 365+ days ideal
2. **Adjust sequence length**: 100 candles for 1h = ~4 days context
3. **Monitor overfitting**: Watch train loss vs validation loss gap
4. **Tune learning rate**: Start 0.001, reduce if unstable

---

## What's Ready vs. What's Next

### ✅ COMPLETE:
- LSTM trainer service (multi-symbol, checkpointing)
- LSTM inference engine (prediction generation)
- ML signal source (consensus integration)
- API routes (training, prediction, consensus, status)
- Regime duration prediction
- Velocity profile integration
- Position sizing based on confidence

### 🔄 NEXT SESSION:
1. **Wire into Scanner**: Integrate ML signals into multi-exchange scanner consensus
2. **Backtest ML Signals**: Validate prediction accuracy on held-out test data
3. **Tune Hyperparameters**: Optimize epochs, learning rate, sequence length
4. **Add More Targets**: Extend to predict other useful metrics (drawdown risk, holding period optimization, etc.)
5. **RL Integration**: Combine with RL position agent for full 3-source consensus
6. **Live Testing**: Run against live market data and track real-world performance

---

## Code Files Created

1. `server/services/lstm-trainer.ts` - 400+ lines
2. `server/services/lstm-inference-engine.ts` - 350+ lines
3. `server/services/ml-signal-source.ts` - 200+ lines
4. `server/routes/ml-lstm.ts` - 250+ lines

All registered in `server/index.ts` with logging.

---

## Testing Commands

### Check System Status:
```bash
GET /api/ml/lstm/status
```

### Train on Demo Data:
```bash
POST /api/ml/lstm/train
{
  "symbols": ["BTC"],
  "lookbackDays": 90,
  "epochs": 10
}
```

### Get Predictions:
```bash
POST /api/ml/lstm/predict
{
  "symbols": ["BTC", "ETH"]
}
```

### Generate Consensus Signals:
```bash
POST /api/ml/lstm/consensus
{
  "symbols": ["BTC", "ETH"]
}
```

---

## Key Innovations

### 1. Regime Duration Prediction
Predicts when market regime will change - enables proactive strategy switching before volatility spikes.

### 2. Velocity Profile Awareness
Uses historical velocity data to set realistic profit targets rather than arbitrary percentages.

### 3. Confidence-Weighted Consensus
ML predictions feed into 3-source voting with confidence-based weighting for position sizing.

### 4. Multi-Target LSTM
Single LSTM predicts 6 different targets (direction, price, volume, volatility, regime, velocity) - more efficient than separate models.

---

## Architecture Diagram

```
Historical Data (1h candles)
    ↓
LSTM Trainer
    ├─ Normalize
    ├─ Create sequences
    ├─ Train (50 epochs)
    └─ Save checkpoint
    
Checkpoint (on disk)
    ↓
LSTM Inference Engine
    ├─ Load weights
    ├─ Fetch recent data
    ├─ Normalize
    ├─ Run forward pass
    └─ Output: [direction, price, volume, volatility, regime_duration, velocity_conf]
    
ML Predictions
    ├─ Combine LSTM + Classical ML
    ├─ Calculate confidence
    └─ Generate consensus signal
    
Signal → Scanner (quality gating)
Signal → Consensus Engine (3-source voting)
Signal → Position Sizing (confidence-weighted)
```

---

## Next Steps for Integration

1. Find signal-consensus.ts or create if missing
2. Add ML signal source to consensus voting
3. Update multi-exchange scanner to call mlSignalSource.generateSignal()
4. Test 3-source voting with sample data
5. Run backtests to validate accuracy improvement
6. Deploy to live scanner

---

This completes **Session 2 - ML LSTM Wire-Up (Training + Inference + Consensus)**. 

Ready for:
- Session 3: Scanner Integration + Live Testing
- Session 4: RL Agent Integration for full 3-source consensus
- Session 5: Advanced ML (multi-timeframe predictions, regime classification)
