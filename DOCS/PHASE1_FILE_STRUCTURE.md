# 📁 PHASE 1 FILE STRUCTURE

## Files Created

```
server/
│
├── types/
│   └── market-data.ts ........................... [NEW]
│       Interfaces & types for:
│       • MarketDataAdapter
│       • MarketDataIntegrity
│       • Candle, Ticker, OrderBook
│       • IntegrityResult, IntegrityIssue
│       • AdapterHealth
│       • WorldTick, WorldState
│       • MarketDataEventBus
│
└── services/
    └── market-data/
        │
        ├── ccxt-adapter.ts ..................... [NEW]
        │   Wraps CCXT behind adapter interface
        │   • CCXTMarketDataAdapter class
        │   • CCXTAdapterFactory
        │
        ├── integrity-checker.ts ............... [NEW]
        │   Validates candles
        │   • MarketDataIntegrityChecker class
        │   • IntegrityReporter class
        │
        └── market-data-layer.ts ............... [NEW]
            Main orchestrator
            • MarketDataLayer class
            • initializeMarketDataLayer()
            • getMarketDataLayer()

Root/
│
├── PHASE1_SUMMARY.md .......................... [NEW]
│   Overview of what was built
│
├── PHASE1_INTEGRATION_GUIDE.md ............... [NEW]
│   Step-by-step integration instructions
│
└── MDL_PHASE1_ARCHITECTURE.md ................ [NEW]
    Architecture diagrams & Phase 2+ roadmap
```

## Existing Files (Unchanged)

```
server/
├── index.ts .......................... ← Add MDL initialization here
├── trading-engine.ts ................. ← Can use mdl.fetchAndValidate()
├── live-trading-engine.ts ............ ← No changes needed
├── storage.ts ........................ ← No changes
└── db-storage.ts ..................... ← No changes

server/services/gateway/
├── exchange-aggregator.ts ............ ← Can use mdl.fetchAndValidate()
├── ccxt-scanner.ts ................... ← No changes needed
└── cache-manager.ts .................. ← No changes

server/routes/
├── ml-signals.ts ..................... ← Agents unchanged
├── rl-signals.ts ..................... ← Agents unchanged
├── physics-agents.ts ................. ← Agents unchanged
├── strategies.ts ..................... ← Strategies unchanged
├── gateway.ts ........................ ← Endpoints unchanged
└── scanner-analysis.ts ............... ← No changes
```

## Code Size

| File | Lines | Purpose |
|------|-------|---------|
| `market-data.ts` | 220 | Type definitions |
| `ccxt-adapter.ts` | 180 | CCXT wrapper |
| `integrity-checker.ts` | 250 | Validation logic |
| `market-data-layer.ts` | 280 | Main orchestrator |
| **Total** | **930** | Complete MDL |

---

## Dependencies

### New to Old
```
MarketDataLayer
    ├── MarketDataAdapter (interface)
    │   └── CCXTMarketDataAdapter
    │       └── ccxt library
    │
    ├── MarketDataIntegrity (interface)
    │   └── MarketDataIntegrityChecker
    │
    └── storage (existing)
        └── db-storage.ts
```

### Old to New (None!)
```
Agents, Strategies, Trading Engine
    ↓
storage.getMarketFrames() ← Still the same API
    ↓
No knowledge of MarketDataLayer
```

---

## Import Paths

```ts
// Type definitions
import type {
  MarketDataAdapter,
  Candle,
  WorldTick,
  WorldState,
  IntegrityResult,
  IntegrityIssue,
  AdapterHealth,
  MarketDataIntegrity,
  MarketDataEventBus
} from '../types/market-data'

// CCXT adapter
import { CCXTMarketDataAdapter, CCXTAdapterFactory } from '../services/market-data/ccxt-adapter'

// Integrity checker
import { 
  MarketDataIntegrityChecker, 
  IntegrityReporter 
} from '../services/market-data/integrity-checker'

// Main layer
import { 
  MarketDataLayer,
  initializeMarketDataLayer,
  getMarketDataLayer
} from '../services/market-data/market-data-layer'
```

---

## Integration Sequence

```
1. Create files (✅ Done)
   ├── types/market-data.ts
   ├── services/market-data/ccxt-adapter.ts
   ├── services/market-data/integrity-checker.ts
   └── services/market-data/market-data-layer.ts

2. Initialize in server (⏳ Next)
   └── server/index.ts
       • Create CCXT adapters
       • Initialize MDL
       • Attach event listeners

3. Optional: Update callers (⏳ Future)
   ├── server/trading-engine.ts
   └── services/gateway/exchange-aggregator.ts

4. Verify (⏳ After integration)
   • Build succeeds
   • Tests pass
   • Data flows correctly
   • No behavior changes
```

---

## Testing Checklist

After integration, verify:

- [ ] TypeScript compilation (`pnpm build`)
- [ ] Unit tests pass (`pnpm test`)
- [ ] Agents still work
  - [ ] ML signals endpoint
  - [ ] RL signals endpoint
  - [ ] Physics agents endpoint
- [ ] Gateway routes work
  - [ ] `/api/gateway/ohlcv/:symbol`
  - [ ] `/api/gateway/dataframe/:symbol`
- [ ] Trading engine runs
  - [ ] Fetches candles
  - [ ] Stores in database/memory
- [ ] No regressions
  - [ ] Charts display
  - [ ] Dashboard updates
  - [ ] Backtests run

---

## What Gets Enabled

After Phase 1, you can easily build:

### Phase 2: Multi-venue routing
```ts
const mdl = new MultiVenueMarketDataLayer(adapters)
const best = await mdl.fetchBestPrice('BTC/USDT', 3600)
```

### Phase 3: Forex (OANDA)
```ts
const oanda = new OandaMarketDataAdapter(config)
adapters.set('oanda', oanda)
const eur = await mdl.fetchAndValidate('EUR/USD', 3600)
```

### Phase 4: MT5
```ts
const mt5 = new MT5MarketDataAdapter(config)
adapters.set('mt5', mt5)
const trades = await mdl.fetchAndValidate('EURUSD', 3600)
```

### Phase 5: Replay
```ts
const replay = new ReplayMarketDataLayer('2024-01-01', '2024-12-31')
replay.on('world.tick', (tick) => rpg.process(tick))
await replay.run()
```

---

## Success Criteria

Phase 1 is complete when:

✅ All 4 files created and syntactically valid  
✅ Types compile without errors  
✅ CCXT adapter wraps existing CCXT code  
✅ Integrity checker validates all 5 rules  
✅ MarketDataLayer orchestrates correctly  
✅ MDL can be initialized at server startup  
✅ Zero behavior change to existing code  
✅ All tests continue to pass  
✅ Documentation is clear  

---

## Next Command

When ready to integrate:

```bash
# 1. Ensure no TypeScript errors
pnpm build

# 2. Initialize MDL in server/index.ts
# (See PHASE1_INTEGRATION_GUIDE.md)

# 3. Verify nothing broke
pnpm test

# 4. Check that candles are validated
curl http://localhost:5000/api/diagnostics/integrity
```

---

**Status: ✅ All files created and ready for integration**
