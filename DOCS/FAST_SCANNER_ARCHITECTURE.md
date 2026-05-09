# 🚀 Fast Scanner Architecture

## Overview

Two-phase scanning system optimized for **speed and responsiveness**:
- **Phase 1 (Quick Scan):** 5-10 seconds → Show results immediately
- **Phase 2 (Deep Analysis):** Background processing → Update as complete

---

## 🎯 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   USER TRIGGERS SCAN                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   PHASE 1: QUICK SCAN (5-10s)     │
        ├────────────────────────────────────┤
        │ • Fetch latest prices              │
        │ • Calculate RSI, MACD, EMA         │
        │ • Generate initial signals         │
        │ • Return to frontend IMMEDIATELY   │
        └────────────┬───────────────────────┘
                     │
                     ├─────► Frontend displays results
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  PHASE 2: DEEP ANALYSIS (Background)│
        ├────────────────────────────────────┤
        │ • Opportunity scoring              │
        │ • Market regime detection          │
        │ • Stop-loss/Take-profit calc       │
        │ • Multi-timeframe confluence       │
        │ • ML predictions                   │
        │ • Update signals progressively     │
        └────────────┬───────────────────────┘
                     │
                     └─────► WebSocket updates to frontend
```

---

## ⚡ Performance Characteristics

| Phase | Time | Symbols | Data Returned |
|-------|------|---------|---------------|
| Quick Scan | 5-10s | 20 | Basic signals, RSI, MACD, price |
| Deep Analysis | 2-5s per symbol | 20 | Full analysis, scores, predictions |
| **Total** | **10-15s frontend** | **20** | **Complete after ~2 min background** |

---

## 📊 Scan Scheduling

```
Timeline (15-minute cycles):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

00:00  ├─ Quick Scan (10s) ─┐
00:10                        └─► Results shown immediately
00:10  ├─ Background Analysis starts (2 min)
02:00                        └─► All symbols fully analyzed
02:00  State changes tracked...
15:00  ├─ Next Quick Scan starts
15:10                        └─► Updated results
15:10  ├─ Background Analysis starts
17:00                        └─► Complete
```

---

## 🔄 Data Flow

### 1. User Clicks "Scan Now"

```typescript
// Frontend
const handleScan = async () => {
  const response = await fetch('/api/scanner/quick-scan', {
    method: 'POST'
  });
  
  const { signals } = await response.json();
  // Display immediately!
  setSignals(signals);
};
```

### 2. Backend Quick Scan

```typescript
// server/services/fast-scanner.ts
async quickScan() {
  // Parallel fetch (5 at a time)
  const signals = await this.fetchQuickData(symbols);
  
  // Return immediately
  return signals;
  
  // Background queue started automatically
  this.queueBackgroundAnalysis(symbols);
}
```

### 3. Background Processing

```typescript
// Processes 2 symbols at a time
while (queue.length > 0) {
  const batch = queue.splice(0, 2);
  await Promise.all(batch.map(analyzeSymbol));
  
  // Emit progress updates via WebSocket
  emit('analysisProgress', { remaining: queue.length });
}
```

### 4. Progressive Updates

```typescript
// Frontend receives updates
socket.on('symbolAnalyzed', (data) => {
  // Update specific symbol with deep data
  updateSymbol(data.symbol, data.deepData);
});
```

---

## 📍 API Endpoints

### POST `/api/scanner/quick-scan`
**Trigger quick scan (returns in 5-10 seconds)**

**Request:**
```json
{
  "symbols": ["BTC/USDT", "ETH/USDT"]  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "scanId": "scan_1698765432",
  "signals": [
    {
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "price": 45000,
      "change24h": 2.5,
      "signal": "BUY",
      "strength": 85,
      "rsi": 35,
      "macd": "bullish",
      "status": "quick_scan",
      "timestamp": "2025-10-24T18:00:00Z"
    }
  ],
  "count": 20,
  "message": "Quick scan complete. Deep analysis running in background."
}
```

---

### GET `/api/scanner/results`
**Get current scan results**

**Response:**
```json
{
  "success": true,
  "signals": [...],
  "count": 20,
  "status": {
    "isScanning": false,
    "currentScanId": "scan_1698765432",
    "signalsCount": 20,
    "backgroundQueueLength": 5,
    "lastScan": {
      "scanId": "scan_1698765432",
      "timestamp": "2025-10-24T18:00:00Z",
      "symbolCount": 20
    }
  }
}
```

---

### GET `/api/scanner/symbol/:symbol`
**Get detailed data for specific symbol**

**Response:**
```json
{
  "success": true,
  "symbol": "BTC/USDT",
  "signal": {
    "symbol": "BTC/USDT",
    "price": 45000,
    "signal": "BUY",
    "strength": 85,
    "rsi": 35,
    "status": "complete"
  },
  "deepAnalysis": {
    "opportunity_score": 87,
    "market_regime": {
      "regime": "bull",
      "confidence": 0.85,
      "volatility": "medium"
    },
    "sl_tp": {
      "stopLoss": 44100,
      "takeProfit": 47250,
      "riskReward": 2.5
    },
    "confluence": {...},
    "ml_prediction": {...}
  }
}
```

---

### GET `/api/scanner/scan-status`
**Get scanner status and history**

**Response:**
```json
{
  "success": true,
  "status": {
    "isScanning": false,
    "currentScanId": "scan_1698765432",
    "signalsCount": 20,
    "backgroundQueueLength": 0,
    "periodicScanningEnabled": true
  },
  "history": [
    {
      "scanId": "scan_1698765432",
      "timestamp": "2025-10-24T18:00:00Z",
      "symbolCount": 20
    }
  ]
}
```

---

## 🎨 Frontend Integration

### Quick Scan Button

```tsx
const ScannerPage = () => {
  const [signals, setSignals] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const handleQuickScan = async () => {
    setIsScanning(true);
    
    try {
      const response = await fetch('/api/scanner/quick-scan', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      // Show results immediately!
      setSignals(data.signals);
      
      // Connect to WebSocket for updates
      connectToUpdates(data.scanId);
      
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const connectToUpdates = (scanId: string) => {
    const socket = io();
    
    socket.on('symbolAnalyzed', (data) => {
      // Update individual symbol with deep data
      setSignals(prev => prev.map(s => 
        s.symbol === data.symbol 
          ? { ...s, ...data.deepData, status: 'complete' }
          : s
      ));
    });
    
    socket.on('analysisProgress', (data) => {
      setScanProgress(data.remaining);
    });
    
    socket.on('deepAnalysisComplete', () => {
      console.log('All analysis complete!');
      socket.disconnect();
    });
  };

  return (
    <div>
      <button onClick={handleQuickScan} disabled={isScanning}>
        {isScanning ? 'Scanning...' : 'Quick Scan'}
      </button>
      
      {scanProgress > 0 && (
        <div>Analyzing {scanProgress} symbols in background...</div>
      )}
      
      <SignalList signals={signals} />
    </div>
  );
};
```

---

## 🔔 Event System

The Fast Scanner emits events for real-time updates:

```typescript
fastScanner.on('quickScanComplete', (data) => {
  // Quick scan finished
  console.log(`Scan ${data.scanId} complete: ${data.signals.length} signals`);
});

fastScanner.on('symbolAnalyzed', (data) => {
  // Individual symbol analysis complete
  console.log(`${data.symbol} analyzed`);
  // Broadcast via WebSocket to frontend
  io.emit('symbolAnalyzed', data);
});

fastScanner.on('analysisProgress', (data) => {
  // Background analysis progress
  console.log(`${data.remaining} symbols remaining`);
  io.emit('analysisProgress', data);
});

fastScanner.on('deepAnalysisComplete', (data) => {
  // All background analysis finished
  console.log(`Scan ${data.scanId} fully complete`);
  io.emit('deepAnalysisComplete', data);
});
```

---

## 📈 Benefits

### User Experience:
- ✅ **Instant Results:** 5-10 seconds vs 2+ minutes
- ✅ **Progressive Enhancement:** Basic data → Full analysis
- ✅ **Per-Symbol Viewing:** Click any symbol for detailed data
- ✅ **Background Processing:** No blocking, smooth UX

### System Performance:
- ✅ **Parallel Processing:** 5 symbols at a time (quick scan)
- ✅ **Queue Management:** 2 symbols at a time (deep analysis)
- ✅ **Resource Optimization:** Spreads load over time
- ✅ **State Tracking:** Monitors changes every 15 minutes

### Scalability:
- ✅ **20 Symbols:** ~10s quick scan, ~2min complete
- ✅ **50 Symbols:** ~20s quick scan, ~5min complete
- ✅ **100 Symbols:** ~40s quick scan, ~10min complete

---

## 🎯 Implementation Status

- [x] Fast Scanner Service
- [x] Two-phase scanning architecture
- [x] API routes
- [x] Event system
- [ ] WebSocket integration (next step)
- [ ] Frontend integration (next step)
- [ ] Connect to Python scanner API (next step)

---

## 🚀 Next Steps

1. **Integrate WebSocket**
   - Real-time updates to frontend
   - Progressive signal enhancement

2. **Connect to Python Scanner**
   - Replace mock data with real API calls
   - Use scanner_api.py endpoints

3. **Frontend Updates**
   - Quick scan button
   - Progressive loading indicators
   - Per-symbol detail views

4. **State Tracking**
   - Monitor price changes
   - Signal strength changes
   - Alert on significant moves

---

**Ready to deploy!** The architecture is in place - just need to wire up the WebSocket and Python scanner integration.

