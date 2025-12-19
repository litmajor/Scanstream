# Scanner UI Enhancement - Quick Start Guide

**Objective**: Wire `scanner.tsx` to new ARM-enhanced multi-exchange scanner  
**Estimated Time**: 2-3 hours  
**Status**: Ready to begin

---

## Quick Overview

Your new backend has 3 powerful components:

| Component | Purpose | File |
|-----------|---------|------|
| **ARM Classifier** | Detects market pressure + 9 market states | `signal-classifier-arm.ts` |
| **Multi-Scanner** | Scans 5 exchanges in parallel | `multi-exchange-scanner.ts` |
| **Persistence** | Stores results and queries history | `scanner-persistence.ts` |

**6 new API endpoints** are ready in `routes/scanner.ts` to use.

---

## Current scanner.tsx Status

✅ **Already Has**:
- Exchange selector (single)
- Signal filtering
- Basic scanning infrastructure (1947 lines)
- WebSocket integration
- Result display table

❌ **Needs**:
- Multi-exchange selection (checkbox group)
- ARM data fields in results table
- Top assets ranking display
- Cross-exchange signals panel
- Statistics sidebar

---

## Step-by-Step Implementation

### Step 1: Add API Service Layer

Create `client/src/services/scannerService.ts`:

```typescript
// NEW FILE
import axios from 'axios';

const API_BASE = '/api/scanner';

export const scannerService = {
  // Scan multiple exchanges
  async multiExchangeScan(symbols: string[], exchanges?: string[], options?: any) {
    const { data } = await axios.post(`${API_BASE}/multi-exchange-scan`, {
      symbols,
      exchanges,
      options
    });
    return data;
  },

  // Get symbol statistics
  async getSymbolStats(symbol: string, days = 7) {
    const { data } = await axios.get(`${API_BASE}/symbol/${symbol}/stats?days=${days}`);
    return data;
  },

  // Get symbol history
  async getSymbolHistory(symbol: string, exchange?: string, hours = 24) {
    const query = new URLSearchParams();
    if (exchange) query.append('exchange', exchange);
    query.append('hours', hours.toString());
    const { data } = await axios.get(`${API_BASE}/symbol/${symbol}/history?${query}`);
    return data;
  },

  // Get cross-exchange signals
  async getCrossExchangeSignals(symbol: string, days = 7) {
    const { data } = await axios.get(`${API_BASE}/symbol/${symbol}/cross-exchange?days=${days}`);
    return data;
  },

  // Get top performers
  async getTopPerformers(days = 7, limit = 10) {
    const { data } = await axios.get(`${API_BASE}/top-performers?days=${days}&limit=${limit}`);
    return data;
  },

  // Get scanner config
  async getConfig() {
    const { data } = await axios.get(`${API_BASE}/config`);
    return data;
  }
};

export default scannerService;
```

### Step 2: Update scanner.tsx State

In `client/src/pages/scanner.tsx`, add state for multi-exchange:

```typescript
// EXISTING: Keep what you have, ADD these:
import scannerService from '../services/scannerService';

// In your component state:
const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['binance']);
const [topAssets, setTopAssets] = useState<any[]>([]);
const [crossExchangeSignals, setCrossExchangeSignals] = useState<any[]>([]);
const [scanStats, setScanStats] = useState<any>(null);
const [scanSessionId, setScanSessionId] = useState<string>('');
const [isMultiExchangeMode, setIsMultiExchangeMode] = useState(false);
```

### Step 3: Update Scan Handler

Replace the existing scan handler:

```typescript
// IN scanner.tsx
const handleMultiExchangeScan = async () => {
  if (selectedSymbols.length === 0) {
    alert('Please enter symbols');
    return;
  }

  try {
    setIsScanning(true);
    const result = await scannerService.multiExchangeScan(
      selectedSymbols,
      selectedExchanges,
      {
        timeframe: '1h',
        limit: 100,
        minVolume: 100000,
        topN: 10
      }
    );

    setScanSessionId(result.sessionId);
    setTopAssets(result.topAssets || []);
    setCrossExchangeSignals(result.crossExchangeSignals || []);
    
    // Show summary
    console.log('Scan Summary:', result.signalSummary);
    
    // You can immediately show some results
    setAllExchangeSignals([...result.topAssets]); // Use topAssets in existing display
  } catch (error) {
    console.error('Scan failed:', error);
    alert('Scan failed: ' + (error as any).message);
  } finally {
    setIsScanning(false);
  }
};
```

### Step 4: Add Exchange Multi-Select UI

Add to your existing exchange selector area:

```typescript
// ADD TO scanner.tsx JSX
<div className="exchange-selector">
  <h3>Select Exchanges</h3>
  <div className="exchange-checkboxes">
    {['binance', 'coinbase', 'kucoinfutures', 'okx', 'bybit'].map(exchange => (
      <label key={exchange}>
        <input
          type="checkbox"
          checked={selectedExchanges.includes(exchange)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedExchanges([...selectedExchanges, exchange]);
            } else {
              setSelectedExchanges(selectedExchanges.filter(ex => ex !== exchange));
            }
          }}
        />
        {exchange.toUpperCase()}
      </label>
    ))}
  </div>
</div>
```

### Step 5: Add Results Display Areas

Add new sections in the results area:

```typescript
// ADD TO scanner.tsx JSX (in results section)

{/* Cross-Exchange Signals Panel */}
{crossExchangeSignals.length > 0 && (
  <div className="cross-exchange-signals">
    <h3>🔗 Cross-Exchange Signals</h3>
    <div className="signals-grid">
      {crossExchangeSignals.map((signal, idx) => (
        <div key={idx} className={`signal-card ${signal.type.toLowerCase()}`}>
          <span className="signal-type">{signal.type}</span>
          <span className="symbol">{signal.symbol}</span>
          <span className="confidence">
            {(signal.confidence * 100).toFixed(0)}% confidence
          </span>
          <span className="exchanges">
            {signal.exchanges.join(', ')}
          </span>
        </div>
      ))}
    </div>
  </div>
)}

{/* Top Assets Ranking */}
{topAssets.length > 0 && (
  <div className="top-assets">
    <h3>📈 Top Assets</h3>
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Signal</th>
          <th>Score</th>
          <th>ARM</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        {topAssets.map((asset, idx) => (
          <tr key={idx}>
            <td>{asset.symbol}</td>
            <td>{asset.signal}</td>
            <td>{(asset.compositeScore || 0).toFixed(1)}</td>
            <td>{asset.armSignal || '-'}</td>
            <td>{(asset.confidence * 100).toFixed(0)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

### Step 6: Update Existing Results Table

Add ARM fields to your existing signals table:

```typescript
// In your existing signals table, ADD these columns:
<th>Regime</th>           {/* marketState */}
<th>ARM Signal</th>        {/* armSignal */}
<th>State Align</th>       {/* stateAlignment */}
<th>Composite</th>         {/* compositeScore */}

// And in the table body:
<td>{signal.marketState || '-'}</td>
<td>{signal.armSignal || '-'}</td>
<td>{(signal.stateAlignment * 100 || 0).toFixed(0)}%</td>
<td>{(signal.compositeScore || 0).toFixed(1)}</td>
```

### Step 7: Add Styling (Quick CSS)

```css
/* In your scanner.tsx styles or separate CSS file */

.exchange-selector {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.exchange-checkboxes {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.exchange-checkboxes label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cross-exchange-signals {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.signals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.signal-card {
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #999;
  background: white;
}

.signal-card.consensus {
  border-left-color: #00aa00;
  background: #f0fff0;
}

.signal-card.divergence {
  border-left-color: #ff6600;
  background: #fff5f0;
}

.signal-card.arbitrage {
  border-left-color: #0066ff;
  background: #f0f5ff;
}

.top-assets {
  margin-top: 2rem;
}

.top-assets table {
  width: 100%;
  border-collapse: collapse;
}

.top-assets th, .top-assets td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.top-assets th {
  background: #f5f5f5;
  font-weight: bold;
}
```

---

## Testing Checklist

After implementing, test these scenarios:

- [ ] Single exchange scan works (verify backwards compatibility)
- [ ] Multi-exchange selection shows all 5 exchanges
- [ ] Multi-exchange scan returns results from all exchanges
- [ ] Cross-exchange signals panel displays correctly
- [ ] Top assets ranked by composite score
- [ ] ARM fields show in results table
- [ ] Signal summary counts match UI display
- [ ] Results persist when navigating away (use sessionId)

---

## API Response Data Structure

When you call `scannerService.multiExchangeScan()`, you get:

```json
{
  "success": true,
  "sessionId": "session_1702822800000",
  "timestamp": "2025-12-17T12:00:00Z",
  "totalResults": 9,
  
  "exchanges": [
    {
      "exchange": "binance",
      "scanned": 3,
      "success": 3,
      "avgConfidence": 0.72,
      "topAssets": [
        {
          "symbol": "BTC/USDT",
          "signal": "Strong Buy",
          "strength": 85,
          "confidence": 0.92,
          "compositeScore": 90,
          "armSignal": "LONG",
          "armConfidence": 0.88,
          "price": 45123.45,
          "volume24h": 1234567890
        }
      ]
    }
  ],

  "crossExchangeSignals": [
    {
      "symbol": "BTC/USDT",
      "type": "CONSENSUS",
      "confidence": 0.95,
      "exchanges": ["binance", "coinbase", "okx"],
      "description": "3/3 exchanges showing Strong Buy",
      "avgCompositeScore": 92
    }
  ],

  "topAssets": [
    {
      "symbol": "SOL/USDT",
      "signal": "Strong Buy",
      "compositeScore": 92,
      "confidence": 0.91,
      "armSignal": "LONG",
      "armConfidence": 0.89
    }
  ],

  "signalSummary": {
    "total": 9,
    "strongBuy": 3,
    "buy": 2,
    "neutral": 1,
    "sell": 2,
    "strongSell": 1
  }
}
```

---

## Common Issues & Solutions

### Issue: "symbols array is required"
**Solution**: Pass actual symbol list, not empty array
```typescript
const selectedSymbols = ['BTC/USDT', 'ETH/USDT']; // Don't leave empty
```

### Issue: Cross-exchange signals empty
**Solution**: They only appear if there are consensus/divergence patterns
- Scan 5+ symbols across 5+ exchanges for better signal generation

### Issue: ARM fields showing as undefined
**Solution**: New database migration needed
```bash
npx prisma migrate dev --name add_scanner_models
```

### Issue: API 404 error
**Solution**: Ensure routes are imported in `server/app.ts` or `server/main.ts`
```typescript
import scannerRoutes from './routes/scanner';
app.use('/api/scanner', scannerRoutes);
```

---

## File Locations

```
scanner.tsx enhancement:
- client/src/pages/scanner.tsx ← UPDATE THIS

New service file:
- client/src/services/scannerService.ts ← CREATE THIS

Backend already ready:
✅ server/routes/scanner.ts (updated)
✅ server/services/scanner/multi-exchange-scanner.ts (new)
✅ server/services/scanner/signal-classifier-arm.ts (new)
✅ server/services/scanner/scanner-persistence.ts (new)
✅ prisma/schema.prisma (updated)
```

---

## Next Phase After UI

Once scanner.tsx is updated, you can:

1. **Create React Components** for specialized displays
2. **Implement WebSocket** for real-time updates
3. **Add Charting** for signal history visualization
4. **Run Database Migration** to enable persistence
5. **Create Alerts** for high-confidence signals

---

**Ready to start? Begin with Step 1: Create `scannerService.ts`**

