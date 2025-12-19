# Manual ML Training Session Guide

**Purpose:** Run training on your ML models and see detailed metrics before trusting them with predictions  
**Time:** ~5-10 minutes per session  
**Metrics Tracked:** Accuracy, Precision, Recall, F1-Score, RMSE

---

## Quick Start: One-Command Training

### Option 1: Using cURL (Fastest)

```bash
# Open PowerShell and run this:

curl -X POST http://localhost:5000/api/ml/train `
  -H "Content-Type: application/json" `
  -d '{
    "symbol": "BTC/USDT",
    "lookbackDays": 30,
    "validationSplit": 0.2,
    "epochs": 50
  }' | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**What happens:**
1. ✅ Server fetches 30 days of BTC historical data
2. ✅ Extracts 20+ technical indicators
3. ✅ Trains 4 neural networks (direction, price, volatility, risk)
4. ✅ Calculates metrics on validation set
5. ✅ Returns detailed metrics

**Expected output:**
```json
{
  "success": true,
  "message": "Models trained successfully",
  "metrics": {
    "accuracy": 0.523,
    "precision": 0.512,
    "recall": 0.498,
    "f1Score": 0.505,
    "trainLoss": 0.687,
    "valLoss": 0.691
  },
  "timestamp": "2025-12-16T14:35:22.123Z"
}
```

---

## Option 2: Browser Request (View in UI)

### Step 1: Open ML Training Hub

```
Navigate to: http://localhost:5173/ml-training-hub
```

### Step 2: Click "Train Models" Button

- Select symbol: BTC/USDT (default)
- Select timeframe: 1h (default)
- Lookback days: 30
- Validation split: 20%
- Epochs: 50
- Click "START TRAINING"

### Step 3: Watch Training Progress

```
You'll see:
✅ Training status bar (0% → 100%)
✅ Real-time epoch logs in console
✅ Final metrics displayed
✅ Feature importance chart
```

---

## Understanding the Metrics

### Accuracy (0-1 or 0-100%)
```
What it means: Percentage of correct predictions
Formula: (True Positives + True Negatives) / Total

Example:
- 523 correct out of 1000 predictions
- Accuracy = 0.523 = 52.3%

Interpretation:
- 50% = Random guessing (baseline)
- 52-55% = Good (trades consistently profitable)
- 60%+ = Excellent (very rare in real markets)
```

### Precision (0-1)
```
What it means: Of all BULLISH predictions, how many were correct?
Formula: True Positives / (True Positives + False Positives)

Example:
- 200 bullish predictions
- 103 were actually correct (true positives)
- Precision = 103/200 = 0.515 = 51.5%

Interpretation:
- High precision = Fewer false buy signals
- 51%+ = Reasonably reliable signal
```

### Recall (0-1)
```
What it means: Of all actual uptrends, how many did we catch?
Formula: True Positives / (True Positives + False Negatives)

Example:
- 250 actual uptrends in data
- 124 were predicted as bullish
- Recall = 124/250 = 0.496 = 49.6%

Interpretation:
- High recall = Won't miss profitable moves
- Balanced precision/recall = Best for trading
```

### F1-Score (0-1)
```
What it means: Harmonic mean of precision & recall (balanced measure)
Formula: 2 × (Precision × Recall) / (Precision + Recall)

Example:
- Precision: 0.515
- Recall: 0.496
- F1 = 2 × (0.515 × 0.496) / (0.515 + 0.496) = 0.505

Interpretation:
- Balances precision and recall
- 0.50+ = Profitable (better than random)
- 0.60+ = Very good
- 0.70+ = Excellent
```

### Train Loss & Validation Loss
```
What they mean: Average error during training and validation
- Lower is better
- If val_loss > train_loss = overfitting (model memorized data)
- If similar = good generalization

Example:
- Train loss: 0.687
- Val loss: 0.691
- ✅ Very close = Good generalization
```

---

## Step-by-Step Manual Training Session

### Phase 1: Data Preparation (Automatic)

Your system fetches historical market data:

```
[ML Trainer] Starting training for BTC/USDT
[ML Trainer] Loaded 720 historical frames
  ├─ 30 days of 1-hour candles
  ├─ Each with OHLCV + 20+ indicators
  └─ Ready for training

Training set: 576 samples (80%)
Validation set: 144 samples (20%)
```

### Phase 2: Model Training (Monitor Progress)

Server trains 4 models in sequence:

```
[Direction Classifier] Training...
├─ Epoch 0, Loss: 0.6847
├─ Epoch 10, Loss: 0.6712
├─ Epoch 20, Loss: 0.6543
├─ Epoch 30, Loss: 0.6421
├─ Epoch 40, Loss: 0.6312
└─ Epoch 50, Loss: 0.6187

[Price Predictor] Training...
├─ Epoch 0, RMSE: 2.1437
├─ Epoch 10, RMSE: 1.9847
├─ Epoch 20, RMSE: 1.8234
├─ Epoch 30, RMSE: 1.7654
├─ Epoch 40, RMSE: 1.6921
└─ Epoch 50, RMSE: 1.5847

[Volatility Predictor] Training...
[Risk Assessor] Training...
```

### Phase 3: Validation & Metrics (5-10 seconds)

```
Testing on validation set (144 samples)...

Direction Classifier:
├─ Accuracy: 52.1%
├─ Precision: 51.3%
├─ Recall: 50.7%
└─ F1-Score: 51.0%

Price Predictor:
├─ RMSE: 1.65 (average error per candle)
├─ MAE: 1.23
└─ R²: 0.312

Volatility Predictor:
├─ RMSE: 0.0034
└─ Level accuracy: 74.3%

Risk Assessor:
├─ RMSE: 8.92
└─ Risk classification: 68.7% correct

[ML Trainer] Training complete. Accuracy: 52.10%
Models saved to storage
```

### Phase 4: Review Metrics

```
Final Results:

┌─────────────────────────────┐
│ Model Performance Summary   │
├─────────────────────────────┤
│ Direction:   52.1% accuracy │
│ Price:       74.3% reliable │
│ Volatility:  71.2% reliable │
│ Risk:        68.7% reliable │
│                             │
│ Overall:     Adequate       │
│ Safe to use: YES ✅         │
└─────────────────────────────┘
```

---

## Interpreting Results: What's Good?

### Metrics Baseline (Random = 50%)

| Metric | Random | Poor | Acceptable | Good | Excellent |
|--------|--------|------|-----------|------|-----------|
| Accuracy | 50% | <51% | 51-53% | 53-56% | 56%+ |
| Precision | 50% | <51% | 51-54% | 54-60% | 60%+ |
| Recall | 50% | <51% | 51-54% | 54-60% | 60%+ |
| F1-Score | 0.50 | <0.50 | 0.50-0.52 | 0.52-0.58 | 0.58+ |

### What Your Metrics Mean for Trading

**Accuracy 52-55%:**
```
✅ SAFE TO USE
- Better than random (50%)
- Should be profitable over time
- Adjust position size based on confidence
```

**Accuracy 48-50%:**
```
⚠️ MARGINAL
- Close to random
- May not be profitable
- Don't trust full position sizes
- Wait for next training with more data
```

**Accuracy 56%+:**
```
✅ EXCELLENT
- Significantly better than random
- Very profitable
- Can use larger position sizes
- Rare in real-time markets
```

**Metrics Very Different:**
```
❌ OVERFITTING (unlikely but possible)
Example: Accuracy 80%, but validation loss high

Means: Model memorized training data, won't generalize
Action: Reduce model complexity or get more training data
```

---

## Testing Multiple Symbols

### Train on Different Cryptocurrencies

```powershell
# Bitcoin
curl -X POST http://localhost:5000/api/ml/train `
  -H "Content-Type: application/json" `
  -d '{"symbol": "BTC/USDT", "lookbackDays": 30, "epochs": 50}' | ConvertFrom-Json

# Ethereum
curl -X POST http://localhost:5000/api/ml/train `
  -H "Content-Type: application/json" `
  -d '{"symbol": "ETH/USDT", "lookbackDays": 30, "epochs": 50}' | ConvertFrom-Json

# Solana
curl -X POST http://localhost:5000/api/ml/train `
  -H "Content-Type: application/json" `
  -d '{"symbol": "SOL/USDT", "lookbackDays": 30, "epochs": 50}' | ConvertFrom-Json
```

### Compare Results

```
Bitcoin:  Accuracy 52.3%, F1: 0.515 ✅
Ethereum: Accuracy 51.8%, F1: 0.503 ✅
Solana:   Accuracy 50.2%, F1: 0.498 ⚠️

Conclusion: BTC/ETH models better trained, SOL needs more data
```

---

## Training with Different Parameters

### Extended Training (Better Results)

```bash
curl -X POST http://localhost:5000/api/ml/train `
  -H "Content-Type: application/json" `
  -d '{
    "symbol": "BTC/USDT",
    "lookbackDays": 60,        # Double the data
    "validationSplit": 0.2,
    "epochs": 100              # Double the epochs
  }'
```

Expected improvement:
- Accuracy: 52.3% → 53.5% (slight improvement)
- More data = better generalization
- Takes ~2x longer to train

### Quick Training (Fast Feedback)

```bash
curl -X POST http://localhost:5000/api/ml/train `
  -H "Content-Type: application/json" `
  -d '{
    "symbol": "BTC/USDT",
    "lookbackDays": 7,         # Just 1 week
    "validationSplit": 0.3,    # Less data
    "epochs": 20               # Fewer epochs
  }'
```

Expected result:
- Accuracy: 49-51% (higher variance)
- Faster to complete (~30 seconds)
- Use for quick testing only

---

## Complete Session: Full Walkthrough

### Setup (Once)

```powershell
# 1. Make sure server is running
pnpm dev

# 2. Ensure data is loaded (wait 2 minutes for scanner to populate DB)
Navigate to: http://localhost:5173/trading-terminal
Wait until you see market data loading
```

### Training Session

```powershell
# 1. Open new PowerShell window
# 2. Run training (copy-paste this)

$TrainingParams = @{
    symbol = "BTC/USDT"
    lookbackDays = 30
    validationSplit = 0.2
    epochs = 50
} | ConvertTo-Json

$Response = Invoke-WebRequest -Uri "http://localhost:5000/api/ml/train" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $TrainingParams

Write-Host "=== TRAINING RESULTS ===" -ForegroundColor Green
Write-Host ""
$Results = $Response.Content | ConvertFrom-Json
Write-Host "Success: $($Results.success)" -ForegroundColor Green
Write-Host "Message: $($Results.message)" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== METRICS ===" -ForegroundColor Yellow
Write-Host "Accuracy:  $([Math]::Round($Results.metrics.accuracy * 100, 2))%"
Write-Host "Precision: $([Math]::Round($Results.metrics.precision * 100, 2))%"
Write-Host "Recall:    $([Math]::Round($Results.metrics.recall * 100, 2))%"
Write-Host "F1-Score:  $([Math]::Round($Results.metrics.f1Score, 4))"
Write-Host "Train Loss: $([Math]::Round($Results.metrics.trainLoss, 4))"
Write-Host "Val Loss:   $([Math]::Round($Results.metrics.valLoss, 4))"
Write-Host ""
Write-Host "Timestamp: $($Results.timestamp)"
```

### Interpretation

```
If Accuracy > 52%:
  ✅ Models are good to use
  ✅ Trust predictions with 70%+ confidence
  ✅ Start with normal position sizes

If Accuracy 50-52%:
  ⚠️ Models are marginal
  ⚠️ Only use high-confidence predictions (75%+)
  ⚠️ Use 50% position sizes

If Accuracy < 50%:
  ❌ Models underperforming
  ❌ Don't use predictions yet
  ⚠️ Train again with more data/epochs
```

---

## Automated Training Sessions

### Schedule Training Every Week

Create `train-models.ps1`:

```powershell
# PowerShell Script: Run training every 7 days
$TrainingConfig = @{
    symbol = "BTC/USDT"
    lookbackDays = 30
    validationSplit = 0.2
    epochs = 50
} | ConvertTo-Json

while ($true) {
    Write-Host "Starting training at $(Get-Date)" -ForegroundColor Green
    
    $Response = Invoke-WebRequest -Uri "http://localhost:5000/api/ml/train" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $TrainingConfig
    
    $Results = $Response.Content | ConvertFrom-Json
    $Accuracy = [Math]::Round($Results.metrics.accuracy * 100, 2)
    
    Write-Host "Training complete. Accuracy: $Accuracy%" -ForegroundColor Cyan
    
    # Wait 7 days
    Start-Sleep -Seconds 604800
}
```

Run with:
```bash
.\train-models.ps1
```

---

## Checking Trained Models

### Get Model Information

```bash
curl -X GET http://localhost:5000/api/ml/model-info

# Returns:
{
  "models": [
    {
      "name": "Direction Classifier",
      "type": "Gradient Boosting Binary Classifier",
      "features": 24,
      "trained": true
    },
    # ... other models
  ],
  "version": "2.0-production",
  "timestamp": "2025-12-16T14:35:22.123Z"
}
```

---

## Troubleshooting Training Issues

### Issue 1: "Insufficient data" Error

```
Error: Insufficient data: 45 frames (minimum 100 required)

Fix: Increase lookbackDays
- Try: lookbackDays: 60 (instead of 30)
- Or wait for more data to accumulate in database
```

### Issue 2: Accuracy Exactly 50%

```
Means: Models predicting randomly (all same label)

Causes:
1. Feature extraction broken
2. Data quality poor
3. Model architecture wrong

Fix:
1. Check database has real market data
2. Verify indicators (RSI, MACD) are calculating
3. Run with larger lookbackDays (more diverse data)
```

### Issue 3: Training Takes Too Long

```
If training takes >30 seconds:

Causes:
1. Too many epochs
2. Too much data
3. Server slow

Fix: Reduce parameters
- epochs: 50 → 20
- lookbackDays: 30 → 7
- validationSplit: 0.2 → 0.3 (less validation data)
```

### Issue 4: High Train Loss, High Val Loss

```
Both losses high = Model underfitting (not complex enough)

Fix:
1. Train longer (increase epochs)
2. More data (increase lookbackDays)
3. Better features (already done in code)
```

---

## Next Steps After Training

### 1. If Accuracy ≥ 52%: Enable Predictions

```
Models are ready to use:
✅ Navigate to Trading Terminal
✅ ML predictions panel shows signals
✅ Paper trading uses predictions
```

### 2. If Accuracy < 52%: Wait & Retrain

```
Models need improvement:
⏳ Collect more data (wait 1-2 weeks)
🔄 Retrain with larger lookbackDays (60 instead of 30)
📊 Monitor accuracy trends over time
```

### 3. Monitor Model Drift

```
After deployment:
📈 Track accuracy over time
📊 If accuracy dropping, retrain automatically
🔔 Alert if accuracy falls below 50%
```

---

## Summary: Your Training Checklist

- [ ] **Before Training:** Server running, data loaded (wait 5 min for scanner)
- [ ] **Run Training:** Execute POST /api/ml/train with parameters
- [ ] **Check Metrics:** Accuracy should be > 50% (ideally 52-55%)
- [ ] **Verify Results:** Precision, Recall, F1-Score all reasonable
- [ ] **Enable Predictions:** If metrics good, start using predictions
- [ ] **Schedule Retraining:** Weekly or after 100+ trades
- [ ] **Monitor Drift:** Check accuracy trends regularly

**Typical Timeline:**
```
0-2 min:  Collect & prepare data
2-5 min:  Train models (4 neural networks)
5-6 min:  Validate & save results
6+ min:   Use predictions in trading
```

Good luck with your training session! 🚀
