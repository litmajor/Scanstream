# 🚀 PHASE 6A QUICK START GUIDE

**For Developers & Testers**

---

## 📝 TL;DR

**What**: Extended backtest.tsx to support multi-asset backtesting with ensemble voting  
**When**: Phase 6A (Week 1)  
**Files Changed**: 3 (backtest.tsx, server/index.ts, phase6-unified-backtest.ts)  
**Lines Added**: ~775 lines of code  
**User Requirement**: "Can backtest any asset, any signal, full complete control"  
**Status**: ✅ COMPLETE  

---

## 🔧 Quick Setup

### 1. Verify Files Are in Place

```bash
# Backend routes
ls server/routes/phase6-unified-backtest.ts
# Output: phase6-unified-backtest.ts ✓

# Frontend component
ls client/src/pages/backtest.tsx
# Output: backtest.tsx ✓

# Route registration
grep "phase6UnifiedBacktestRouter" server/index.ts
# Output: import phase6UnifiedBacktestRouter... ✓
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Navigate to Backtest Page

```
http://localhost:3000/backtest
```

---

## 🎮 Manual Testing Checklist

### Basic UI Test
- [ ] Open backtest page
- [ ] See new "🚀 PHASE 6A" banner
- [ ] Click checkbox to toggle multi-asset mode
- [ ] UI transforms to show multi-select boxes

### Multi-Asset Selection
- [ ] Toggle multi-asset mode on
- [ ] See 8 assets available
- [ ] Select 3 assets (e.g., BTC, ETH, SOL)
- [ ] Counter shows "3 selected"
- [ ] Can uncheck to deselect

### Signal Filtering
- [ ] Multi-select signal sources
- [ ] Options: All, ML, Scanner, RL, RPG
- [ ] Selecting specific source removes "All"
- [ ] Can select multiple sources (e.g., ML + Scanner)

### Voting Strategy
- [ ] Select voting strategy dropdown
- [ ] See 4 options: Majority, Weighted, Consensus, Unanimous
- [ ] Explanatory text appears for each
- [ ] Default is "Majority"

### Advanced Options
- [ ] Click "Advanced" button
- [ ] Panel expands to show slippage and commission
- [ ] Adjust values
- [ ] Click "Advanced" again to hide

### Backtest Execution
- [ ] Fill in all required fields
- [ ] Click "Run Multi-Asset Backtest"
- [ ] See loading spinner
- [ ] Success message: "Multi-asset backtest complete! X/X successful"

### Backward Compatibility
- [ ] Toggle OFF multi-asset mode
- [ ] UI returns to original single-symbol dropdown
- [ ] Original backtest workflow still works
- [ ] Single-asset backtest can be executed

---

## 🧪 API Testing

### Test 1: Multi-Asset Backtest with Voting

```bash
curl -X POST http://localhost:5000/api/backtest/unified/run \
  -H "Content-Type: application/json" \
  -d '{
    "assets": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
    "signalSources": ["ml", "scanner"],
    "votingStrategy": "majority",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "initialCapital": 10000,
    "slippage": 0.001,
    "commission": 0,
    "timeframe": "1h"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "summary": {
    "totalAssets": 3,
    "successfulBacktests": 3,
    "failedBacktests": 0,
    "configuration": {
      "assets": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
      "signalSources": ["ml", "scanner"],
      "votingStrategy": "majority",
      "timeframe": "1h",
      "dateRange": {
        "start": "2024-01-01T00:00:00.000Z",
        "end": "2024-12-31T00:00:00.000Z"
      }
    }
  },
  "results": [
    {
      "asset": "BTC/USDT",
      "success": true,
      "metrics": {...},
      "trades": 45,
      "storedResultId": "uuid-1"
    },
    ...
  ],
  "timestamp": "2024-12-19T..."
}
```

### Test 2: Get Available Assets

```bash
curl http://localhost:5000/api/backtest/unified/assets
```

**Expected Response**:
```json
{
  "success": true,
  "assets": [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "ADA/USDT",
    "DOT/USDT", "MATIC/USDT", "LINK/USDT", "XRP/USDT"
  ]
}
```

### Test 3: Get Signal Sources

```bash
curl http://localhost:5000/api/backtest/unified/signal-sources
```

**Expected Response**:
```json
{
  "success": true,
  "sources": [
    { "id": "ml", "label": "ML Pipeline", "icon": "🤖" },
    { "id": "scanner", "label": "Pattern Scanner", "icon": "🔍" },
    { "id": "rl", "label": "RL Agent", "icon": "🧠" },
    { "id": "rpg", "label": "RPG Agent", "icon": "⚔️" }
  ]
}
```

### Test 4: Voting Strategy Comparison

Test all 4 voting strategies with same backtest params:

```bash
# Test each voting strategy
for strategy in "majority" "weighted" "consensus" "unanimous"; do
  curl -X POST http://localhost:5000/api/backtest/unified/run \
    -H "Content-Type: application/json" \
    -d "{
      \"assets\": [\"BTC/USDT\"],
      \"signalSources\": [\"ml\", \"scanner\", \"rl\", \"rpg\"],
      \"votingStrategy\": \"$strategy\",
      \"startDate\": \"2024-01-01\",
      \"endDate\": \"2024-12-31\",
      \"initialCapital\": 10000
    }" | jq '.results[0].metrics'
done

# Compare returned metrics for each strategy
```

---

## 🐛 Troubleshooting

### Issue: Multi-asset selector not showing

**Solution**: Clear browser cache and reload
```bash
# Clear cache in DevTools (Ctrl+Shift+Delete)
# Or restart dev server: npm run dev
```

### Issue: "Cannot find module phase6-unified-backtest"

**Solution**: Restart dev server
```bash
npm run dev
```

### Issue: API returns 500 error

**Check server logs**:
```bash
# Look for error in terminal running `npm run dev`
# Check for TypeScript compilation errors
npm run build
```

### Issue: Voting strategy not working

**Verify**:
1. Multiple signal sources are selected
2. Signals exist in database for date range
3. votingStrategy parameter is one of: "majority", "weighted", "consensus", "unanimous"

---

## 📊 Performance Testing

### Test Multi-Asset Load

```bash
# Single asset (baseline)
time curl -X POST http://localhost:5000/api/backtest/unified/run \
  -H "Content-Type: application/json" \
  -d '{
    "assets": ["BTC/USDT"],
    "signalSources": ["all"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'

# Multi-asset (should be ~3x slower for 3 assets)
time curl -X POST http://localhost:5000/api/backtest/unified/run \
  -H "Content-Type: application/json" \
  -d '{
    "assets": ["BTC/USDT", "ETH/USDT", "SOL/USDT"],
    "signalSources": ["all"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```

**Expected Performance**:
- Single asset: < 5 seconds
- 3 assets: 10-15 seconds
- 5 assets: 20-30 seconds
- 8 assets: 40-60 seconds

---

## 🔍 Code Overview

### New File: `server/routes/phase6-unified-backtest.ts`

```typescript
// Main endpoint
router.post('/unified/run', async (req, res) => {
  // 1. Validate input
  // 2. For each asset:
  //    a. Fetch market data
  //    b. Get filtered signals
  //    c. Apply voting strategy
  //    d. Run backtest
  //    e. Store results
  // 3. Return summary
});

// Supporting endpoints
router.get('/unified/assets', ...);
router.get('/unified/signal-sources', ...);
router.get('/unified/agents', ...);
router.get('/unified/strategies', ...);
router.get('/unified/configurations', ...);
router.get('/unified/results', ...);

// Helper functions
function applyVotingStrategy(signals, strategy) { ... }
function getFilteredSignals(asset, sources, dates) { ... }
function fetchHistoricalData(asset, start, end) { ... }
function storeBacktestResult(data) { ... }
```

### Modified File: `client/src/pages/backtest.tsx`

```typescript
// New state variables
const [selectedSignalSources, setSelectedSignalSources] = useState(['all']);
const [votingStrategy, setVotingStrategy] = useState('majority');
const [useMultiAsset, setUseMultiAsset] = useState(false);
const [showAdvanced, setShowAdvanced] = useState(false);

// New UI sections
- Phase 6A banner (toggle)
- Multi-asset selector (conditional render)
- Signal source selector (conditional render)
- Voting strategy selector (conditional render)
- Advanced options panel (conditional render)

// Updated handleRunBacktest()
if (useMultiAsset) {
  // Call unified API
} else {
  // Call original API
}
```

### Modified File: `server/index.ts`

```typescript
import phase6UnifiedBacktestRouter from './routes/phase6-unified-backtest';
app.use('/api/backtest', phase6UnifiedBacktestRouter);

// Logs all new endpoints
console.log('[express] Phase 6 Unified Backtest API...');
```

---

## 🧬 Voting Strategy Logic

### Majority Vote
```
BUY: 3 votes, SELL: 1 vote → Decision: BUY, Confidence: 75%
BUY: 2 votes, SELL: 2 votes → Decision: BUY (first > wins)
```

### Weighted Average
```
BUY (0.95) + BUY (0.87) + SELL (0.72) + BUY (0.81)
= Average confidence: 0.8375 (83.75%)
= Decision: BUY (majority by sources)
```

### Consensus
```
All 4 agree BUY → Decision: BUY, Confidence: 1.0
3 BUY, 1 SELL → Skip (no consensus)
All 4 agree SELL → Decision: SELL, Confidence: 1.0
```

### Unanimous
```
Same as Consensus (all must agree on same direction)
Skips if any disagreement
```

---

## 📈 Expected Outcomes

### UI Enhancements
✅ Users see Phase 6A banner  
✅ Multi-asset mode toggles on/off  
✅ Asset selector updates appropriately  
✅ Signal filtering appears in multi-asset mode  
✅ Voting strategy selector works  
✅ Advanced options panel toggles  
✅ Button text changes based on mode  

### API Functionality
✅ Unified endpoint receives requests  
✅ Fetches data for multiple assets  
✅ Applies voting strategy correctly  
✅ Stores results in database  
✅ Returns aggregated summary  
✅ All helper endpoints work  

### Data Quality
✅ Results stored with proper schema  
✅ Metrics calculated correctly  
✅ Trading signals preserved  
✅ Historical data fetched successfully  

---

## 🎯 Next Steps (Phase 6B)

After Phase 6A is verified, proceed to:

1. **Visualization Components**
   - Equity curve chart
   - Drawdown analysis
   - Monthly returns heatmap
   - Trade scatter plot

2. **Advanced Parameters**
   - Position sizing method selector
   - Risk controls (max drawdown, daily loss limit)
   - Parameter persistence

3. **Results Comparison**
   - Side-by-side backtest comparison
   - Metric diff highlighting
   - Export functionality (CSV, JSON, PDF)

---

## 📚 Documentation Files

- ✅ **PHASE_6A_IMPLEMENTATION_COMPLETE.md** - Full technical details
- ✅ **PHASE_6A_UI_WALKTHROUGH.md** - Visual UI guide
- ✅ **PHASE_6A_QUICK_START_GUIDE.md** - This file
- ✅ **PHASE_6_TECHNICAL_SPECIFICATIONS.md** - Architecture reference
- ✅ **PHASE_6_QUICK_REFERENCE_GUIDE.md** - Config formats & examples

---

## ✨ Summary

| Item | Status |
|------|--------|
| Backend API | ✅ Complete (500+ lines) |
| Frontend UI | ✅ Complete (250+ lines) |
| Route Registration | ✅ Complete (25 lines) |
| Multi-asset Support | ✅ Yes (1-8 assets) |
| Signal Filtering | ✅ Yes (4 sources) |
| Voting Strategies | ✅ Yes (4 types) |
| Backward Compatible | ✅ Yes |
| Error Handling | ✅ Yes |
| Documentation | ✅ Yes (5 files) |
| Ready for Testing | ✅ YES |
| Ready for Phase 6B | ✅ YES |

---

**Quick Start Guide v1.0**  
**Created**: December 19, 2025  
**For**: Developers & QA Testing  
**Status**: ✅ READY TO TEST  
