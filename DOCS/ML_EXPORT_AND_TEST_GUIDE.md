# Export & Test ML Models with Chart Data

**Goal:** Export real chart data from Trading Terminal, then test ML models manually  
**Time:** ~5-10 minutes  
**Output:** JSON file + ML predictions you can review before deploying

---

## Part 1: Export Chart Data from Trading Terminal

### Step 1: Load Chart Data

```
1. Open Trading Terminal:
   → http://localhost:5173/trading-terminal

2. Wait for market data to load
   → You should see candlesticks appearing on chart
   → Red/green candles with volume bars

3. Select a symbol (default: BTC/USDT)
   → Or use dropdown to pick ETH, SOL, etc.
```

### Step 2: Export as CSV

```
1. Look for "Export" button on chart panel
   → Usually in top-right of chart area
   
2. Click "Export Chart Data"
   → File downloads: chart-BTC-USDT-[timestamp].csv
   
3. File location:
   → Windows: Downloads folder
   → Example: Downloads/chart-BTC-USDT-1734354322000.csv
```

### Step 3: CSV File Format

Your exported file looks like:

```csv
timestamp,open,high,low,close,volume
1734340800000,42305.50,42450.25,42200.00,42380.75,1245.32
1734344400000,42380.75,42520.50,42300.25,42450.00,1456.78
1734348000000,42450.00,42600.75,42350.50,42580.25,1678.90
...
```

**Fields:**
- `timestamp` - Unix timestamp (milliseconds)
- `open` - Opening price for the candle
- `high` - Highest price during candle
- `low` - Lowest price during candle
- `close` - Closing price (most important)
- `volume` - Trading volume in that candle

---

## Part 2: Convert CSV to JSON for ML Testing

### Option 1: Automatic Conversion (Fastest)

**Create this PowerShell script:** `convert-csv-to-json.ps1`

```powershell
param(
    [string]$CsvPath = $null
)

if (-not $CsvPath) {
    Write-Host "=== CSV to JSON Converter ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage: .\convert-csv-to-json.ps1 -CsvPath 'path/to/chart.csv'"
    Write-Host ""
    Write-Host "Example: .\convert-csv-to-json.ps1 -CsvPath 'Downloads/chart-BTC-USDT-1734354322000.csv'"
    exit
}

if (-not (Test-Path $CsvPath)) {
    Write-Host "Error: File not found: $CsvPath" -ForegroundColor Red
    exit
}

Write-Host "Reading CSV: $CsvPath" -ForegroundColor Cyan

# Read CSV and convert to JSON
$csv = Import-Csv -Path $CsvPath
$jsonArray = @()

foreach ($row in $csv) {
    $point = @{
        timestamp = [long]$row.timestamp
        open = [double]$row.open
        high = [double]$row.high
        low = [double]$row.low
        close = [double]$row.close
        volume = [double]$row.volume
    }
    $jsonArray += $point
}

# Convert to JSON with pretty formatting
$json = $jsonArray | ConvertTo-Json -Depth 10

# Save to file
$OutputPath = $CsvPath -replace '\.csv$', '.json'
$json | Out-File -FilePath $OutputPath -Encoding UTF8

Write-Host "✅ Converted successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Input:  $CsvPath" -ForegroundColor Cyan
Write-Host "Output: $OutputPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "File size: $(([int](Get-Item $OutputPath).Length / 1KB).ToString('F1')) KB" -ForegroundColor Yellow
Write-Host "Data points: $($jsonArray.Count)" -ForegroundColor Yellow
```

**Usage:**
```powershell
# Make sure you're in the repo directory first
cd e:\repos\litmajor\Scanstream

# Then run the converter
.\convert-csv-to-json.ps1 -CsvPath "$env:USERPROFILE\Downloads\chart-BTC-USDT-1734354322000.csv"
```

**Output:**
```
Reading CSV: C:\Users\YourName\Downloads\chart-BTC-USDT-1734354322000.csv
✅ Converted successfully!

Input:  C:\Users\YourName\Downloads\chart-BTC-USDT-1734354322000.csv
Output: C:\Users\YourName\Downloads\chart-BTC-USDT-1734354322000.json

File size: 45.2 KB
Data points: 200
```

### Option 2: Manual Conversion (If script doesn't work)

Open the CSV in a text editor and manually format as JSON:

```json
[
  {
    "timestamp": 1734340800000,
    "open": 42305.50,
    "high": 42450.25,
    "low": 42200.00,
    "close": 42380.75,
    "volume": 1245.32
  },
  {
    "timestamp": 1734344400000,
    "open": 42380.75,
    "high": 42520.50,
    "low": 42300.25,
    "close": 42450.00,
    "volume": 1456.78
  },
  ...
]
```

---

## Part 3: Test ML Models with Your Data

### Method 1: Using API Endpoint (Best)

Create `test-ml-with-data.ps1`:

```powershell
param(
    [string]$JsonPath = $null
)

if (-not $JsonPath) {
    Write-Host "Usage: .\test-ml-with-data.ps1 -JsonPath 'path/to/chart.json'"
    exit
}

Write-Host "=== ML Model Testing with Chart Data ===" -ForegroundColor Green
Write-Host ""

# Read the JSON file
if (-not (Test-Path $JsonPath)) {
    Write-Host "Error: File not found: $JsonPath" -ForegroundColor Red
    exit
}

Write-Host "Reading JSON file..." -ForegroundColor Cyan
$jsonContent = Get-Content -Path $JsonPath -Raw
$chartData = $jsonContent | ConvertFrom-Json

Write-Host "Loaded $($chartData.Count) data points" -ForegroundColor Cyan
Write-Host ""

# Show data preview
Write-Host "=== Data Preview ===" -ForegroundColor Yellow
Write-Host "First candle:"
Write-Host "  Close: $($chartData[0].close)"
Write-Host "  High: $($chartData[0].high)"
Write-Host "  Low: $($chartData[0].low)"
Write-Host "  Volume: $($chartData[0].volume)"
Write-Host ""
Write-Host "Last candle:"
Write-Host "  Close: $($chartData[-1].close)"
Write-Host "  High: $($chartData[-1].high)"
Write-Host "  Low: $($chartData[-1].low)"
Write-Host "  Volume: $($chartData[-1].volume)"
Write-Host ""

# Send to ML prediction endpoint
Write-Host "=== Sending to ML Models ===" -ForegroundColor Cyan
Write-Host "Making request to /api/ml/predictions/from-chart..."
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/ml/predictions/from-chart" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body ($chartData | ConvertTo-Json -Depth 10) `
        -TimeoutSec 30

    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ SUCCESS! ML Models Generated Predictions" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "=== PREDICTION RESULTS ===" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "DIRECTION PREDICTION:" -ForegroundColor Yellow
    Write-Host "  Signal: $($result.direction.prediction)" -ForegroundColor Cyan
    Write-Host "  Confidence: $([Math]::Round($result.direction.confidence * 100, 2))%"
    Write-Host "  Strength: $([Math]::Round($result.direction.strength, 4))"
    Write-Host ""
    
    Write-Host "PRICE PREDICTION:" -ForegroundColor Yellow
    Write-Host "  Predicted Close: `$$($result.price.predicted)" -ForegroundColor Cyan
    Write-Host "  Expected Change: $([Math]::Round($result.price.changePercent * 100, 2))%"
    Write-Host "  Range: $$($result.price.low) → $$($result.price.high)"
    Write-Host ""
    
    Write-Host "VOLATILITY PREDICTION:" -ForegroundColor Yellow
    Write-Host "  Level: $($result.volatility.level)" -ForegroundColor Cyan
    Write-Host "  Magnitude: $([Math]::Round($result.volatility.predicted * 100, 2))%"
    Write-Host "  Confidence: $([Math]::Round($result.volatility.confidence * 100, 2))%"
    Write-Host ""
    
    Write-Host "HOLDING PERIOD:" -ForegroundColor Yellow
    Write-Host "  Recommended: $($result.holdingPeriod.days) days ($($result.holdingPeriod.hours) hours)" -ForegroundColor Cyan
    Write-Host "  Duration: $($result.holdingPeriod.candles) candles"
    Write-Host "  Reason: $($result.holdingPeriod.reason)"
    Write-Host ""
    
    Write-Host "RISK ASSESSMENT:" -ForegroundColor Yellow
    Write-Host "  Level: $($result.risk.level)" -ForegroundColor Cyan
    Write-Host "  Score: $($result.risk.score) / 100"
    Write-Host "  Factors: $(($result.risk.factors | ConvertTo-Json) -replace '[\[\]"']','')"
    Write-Host ""
    
    Write-Host "=== CONFIDENCE SUMMARY ===" -ForegroundColor Yellow
    Write-Host "Direction confidence: $([Math]::Round($result.direction.confidence * 100, 2))% ✓" -ForegroundColor Cyan
    Write-Host "Price confidence: $([Math]::Round($result.price.confidence * 100, 2))% ✓" -ForegroundColor Cyan
    Write-Host "Volatility confidence: $([Math]::Round($result.volatility.confidence * 100, 2))% ✓" -ForegroundColor Cyan
    Write-Host ""
    
    # Recommendation
    if ($result.direction.confidence -gt 0.7) {
        Write-Host "✅ HIGH CONFIDENCE - Safe to use for trading" -ForegroundColor Green
    } elseif ($result.direction.confidence -gt 0.6) {
        Write-Host "⚠️  MODERATE CONFIDENCE - Use with caution" -ForegroundColor Yellow
    } else {
        Write-Host "❌ LOW CONFIDENCE - Wait for better signal" -ForegroundColor Red
    }
    
    # Save results to file
    $OutputPath = $JsonPath -replace '\.json$', '-predictions.json'
    $result | ConvertTo-Json -Depth 10 | Out-File -FilePath $OutputPath
    Write-Host ""
    Write-Host "Results saved to: $OutputPath" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. Server is running (pnpm dev)"
    Write-Host "  2. ML models are trained"
    Write-Host "  3. Chart data has at least 20 candles"
}
```

**Usage:**
```powershell
.\test-ml-with-data.ps1 -JsonPath "Downloads/chart-BTC-USDT-1734354322000.json"
```

**Output Example:**
```
=== ML Model Testing with Chart Data ===

Loaded 200 data points

=== Data Preview ===
First candle:
  Close: 42305.50
  High: 42450.25
  Low: 42200.00
  Volume: 1245.32

Last candle:
  Close: 42850.75
  High: 42920.00
  Low: 42750.50
  Volume: 1580.25

=== PREDICTION RESULTS ===

DIRECTION PREDICTION:
  Signal: BULLISH
  Confidence: 72.34%
  Strength: 0.4567

PRICE PREDICTION:
  Predicted Close: $42920.50
  Expected Change: 0.82%
  Range: $42750.00 → $43050.25

VOLATILITY PREDICTION:
  Level: medium
  Magnitude: 1.85%
  Confidence: 68.90%

HOLDING PERIOD:
  Recommended: 1 days (24 hours)
  Duration: 24 candles
  Reason: Strong trend with moderate volatility

RISK ASSESSMENT:
  Level: MEDIUM
  Score: 45 / 100
  Factors: Volatility spike detected, trend strength good

=== CONFIDENCE SUMMARY ===
Direction confidence: 72.34% ✓
Price confidence: 65.78% ✓
Volatility confidence: 68.90% ✓

✅ HIGH CONFIDENCE - Safe to use for trading

Results saved to: Downloads/chart-BTC-USDT-1734354322000-predictions.json
```

### Method 2: Testing in Browser Console

If the API endpoint isn't available, you can test directly in browser:

```javascript
// Open browser console on Trading Terminal page
// Paste this code:

const testMLWithData = async (chartData) => {
  const response = await fetch('/api/ml/predictions/from-chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chartData)
  });
  
  const result = await response.json();
  
  console.log('=== ML PREDICTIONS ===');
  console.log('Direction:', result.direction.prediction);
  console.log('Confidence:', (result.direction.confidence * 100).toFixed(2) + '%');
  console.log('Price Target:', '$' + result.price.predicted.toFixed(2));
  console.log('Volatility:', result.volatility.level);
  console.log('Holding Period:', result.holdingPeriod.days + ' days');
  console.log('Full Result:', result);
};

// Then call it with your chart data:
// testMLWithData(YOUR_CHART_DATA_ARRAY);
```

---

## Part 4: Interpreting ML Results

### Direction Prediction

```
BULLISH + 72% confidence
↓
Interpretation:
✅ Model thinks price will go UP
✅ 72% confidence is GOOD (better than 50% random)
✅ Safe to take BUY position

Trading action:
- Open LONG position
- Use 72% confidence to adjust size (smaller if lower confidence)
- Place SL/TP based on price prediction range
```

### Price Prediction

```
Predicted: $42920.50, Range: $42750 → $43050

Current price: $42850
Expected change: +70.50 (+0.82%)

↓
Interpretation:
✅ Model expects modest upside move
✅ Range is realistic (only ~1% width)
✅ Use upper range as take-profit target

Trading action:
- Entry: Market or limit at current price
- Target: $43050 (upper range)
- Stop: $42750 (lower range)
- R:R = 300:100 = 3:1 (excellent)
```

### Volatility Prediction

```
MEDIUM volatility, 1.85% magnitude

↓
Interpretation:
✅ Not a spike, but above baseline
✅ Good for trending (not choppy)
✅ Stop-loss can be at 2x volatility

Trading action:
- If ATR = 1%, then SL = 2% below entry
- Position size: Normal (not reduced)
- Expect 1.85% swings (plan for them)
```

### Holding Period

```
Recommended: 1 day (24 candles at 1h timeframe)
Reason: "Strong trend with moderate volatility"

↓
Interpretation:
✅ Trend strong enough for multi-hour hold
✅ Don't expect day-long holding
✅ Close position within 24 hours

Trading action:
- Set take-profit for 24 hours out
- If no profit by then, close anyway
- Prevents overnight risk
```

---

## Part 5: Complete Testing Workflow

### Full Test Session

```powershell
# Step 1: Convert CSV to JSON
.\convert-csv-to-json.ps1 -CsvPath "$env:USERPROFILE\Downloads\chart-BTC-USDT-1734354322000.csv"

# Step 2: Test ML models
.\test-ml-with-data.ps1 -JsonPath "$env:USERPROFILE\Downloads\chart-BTC-USDT-1734354322000.json"

# Step 3: Check results
# - Read the output in PowerShell
# - Review the -predictions.json file created
```

### What to Look For

```
✅ Confidence > 70%        → SAFE to use
⚠️  Confidence 60-70%      → Use with caution
❌ Confidence < 60%        → Wait for better signal

✅ Multiple predictions agree → STRONG signal
❌ Predictions conflict      → SKIP this signal

✅ Risk score < 50          → Low risk
⚠️  Risk score 50-70        → Moderate risk
❌ Risk score > 70          → High risk, skip
```

---

## Part 6: Testing Multiple Symbols

### Test Different Cryptocurrencies

```powershell
# Export BTC data
# Export ETH data
# Export SOL data

# Then test each:
.\test-ml-with-data.ps1 -JsonPath "Downloads/chart-BTC-USDT.json"
.\test-ml-with-data.ps1 -JsonPath "Downloads/chart-ETH-USDT.json"
.\test-ml-with-data.ps1 -JsonPath "Downloads/chart-SOL-USDT.json"

# Compare results:
# BTC: 72% confidence, BULLISH
# ETH: 65% confidence, NEUTRAL
# SOL: 58% confidence, BULLISH

# Conclusion: BTC is strongest signal
```

---

## Part 7: Saving & Analyzing Results

### Results File Format

When you run testing, it creates a JSON file with full results:

```json
{
  "direction": {
    "prediction": "BULLISH",
    "probability": [0.28, 0.72],
    "confidence": 0.7234,
    "strength": 0.4567
  },
  "price": {
    "predicted": 42920.50,
    "change": 70.50,
    "changePercent": 0.00824,
    "percentChange": 0.824,
    "high": 43050.25,
    "low": 42750.00,
    "confidence": 0.6578,
    "target": "UP"
  },
  "volatility": {
    "predicted": 0.0185,
    "level": "medium",
    "confidence": 0.6890
  },
  "holdingPeriod": {
    "candles": 24,
    "days": 1.0,
    "hours": 24,
    "reason": "Strong trend with moderate volatility"
  },
  "risk": {
    "level": "MEDIUM",
    "score": 45,
    "factors": ["Volatility spike detected", "Trend strength good"]
  }
}
```

### Compare Predictions Over Time

Track multiple tests in a spreadsheet:

```
Symbol    | Timestamp      | Direction | Conf  | Price Target | Actual Next | Correct?
----------|----------------|-----------|-------|--------------|------------|----------
BTC/USDT  | 2025-12-16 14h | BULLISH   | 72%   | $42920       | $42850 ✓   | YES
ETH/USDT  | 2025-12-16 14h | NEUTRAL   | 65%   | $2480        | $2475 ✓    | YES
SOL/USDT  | 2025-12-16 14h | BULLISH   | 58%   | $185         | $187 ✓     | YES
```

---

## Troubleshooting

### Error: "ChartDataPoint undefined"

```
Solution:
1. Make sure JSON file has correct format
2. Each object needs: timestamp, open, high, low, close, volume
3. Numbers should be numeric, not strings
```

### Error: "Insufficient data"

```
Solution:
1. ML models need minimum 20 candles
2. Your CSV/JSON should have at least 20 rows
3. Try exporting more history (scroll chart left to get older candles)
```

### Error: "Connection refused"

```
Solution:
1. Server must be running: pnpm dev
2. Wait for server to fully start (check terminal)
3. Verify http://localhost:5000 is accessible
```

### Predictions seem random

```
Solution:
1. This is normal - ML is ~50% baseline
2. Train models first: POST /api/ml/train
3. Then test again with trained models
```

---

## Next Steps

**After testing with exported data:**

1. ✅ **If predictions good (>70% confidence):**
   - Enable predictions in trading
   - Use them for actual trades
   - Monitor performance

2. ⚠️ **If predictions marginal (60-70%):**
   - Retrain models with more data
   - Test again with different symbols
   - Use smaller position sizes

3. ❌ **If predictions poor (<60%):**
   - Collect more training data
   - Wait 1-2 weeks for more history
   - Retrain and test again

---

## Quick Command Reference

```powershell
# Export CSV from Trading Terminal UI
# Then convert & test:

$csvPath = "$env:USERPROFILE\Downloads\chart-BTC-USDT-1734354322000.csv"
.\convert-csv-to-json.ps1 -CsvPath $csvPath
.\test-ml-with-data.ps1 -JsonPath ($csvPath -replace '\.csv$', '.json')
```

That's it! You now have a complete ML testing workflow with real chart data. 🚀
