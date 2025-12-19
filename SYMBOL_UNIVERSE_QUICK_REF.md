# Symbol Universe — Quick Reference

## 📁 Files Created

| File | Purpose |
|------|---------|
| `server/types/symbol-universe.ts` | Core type definitions |
| `server/services/symbol-manager.ts` | Central registry & validation |
| `server/services/symbol-formatter.ts` | Unified UI formatting |
| `server/services/symbol-normalizer.ts` | Exchange format conversion |
| `server/services/symbol-universe-api.ts` | API endpoint documentation |
| `client/src/hooks/useSymbolUniverse.ts` | React hooks |
| `SYMBOL_UNIVERSE_IMPLEMENTATION.md` | Full integration guide |
| `SYMBOL_UNIVERSE_BEFORE_AFTER.md` | Before/after comparison |
| `SYMBOL_UNIVERSE_QUICK_REF.md` | This file |

---

## 🎯 Core Concepts

### Symbol
A canonical, normalized identifier for any tradeable asset.
- Format: `BASE/QUOTE` for pairs (BTC/USDT, EUR/USD)
- Format: `TICKER` for equities (AAPL, GOOGL)
- Never raw broker formats

### Asset Class
The fundamental nature of the asset:
- `crypto` — Cryptocurrencies (BTC, ETH, SOL)
- `forex` — Currency pairs (EUR/USD, GBP/JPY)
- `equities` — Stocks (AAPL, MSFT, TSLA)
- `commodities` — Raw materials (Gold, Oil)
- `indices` — Market indices (SPX, DAX)

### Venue (Exchange)
Where the symbol is traded:
- `binance`, `kraken` (crypto)
- `oanda`, `mt5` (forex)
- `nasdaq`, `nyse` (equities)

### Canonical Symbol
The system's internal representation. Examples:
- `BTC/USDT` (not BTCUSDT, not BTC-USDT)
- `EUR/USD` (not EUR_USD, not EURUSD)
- `AAPL` (not AAPL-USD)

---

## ⚡ Quick Examples

### Register Symbols

```typescript
import { symbolManager } from './services/symbol-manager';
import { AssetClass } from './types/symbol-universe';

// Single symbol
symbolManager.registerSymbol({
  symbol: 'BTC/USDT',
  assetClass: AssetClass.CRYPTO,
  base: 'BTC',
  quote: 'USDT',
  name: 'Bitcoin',
  venues: { binance: 'BTCUSDT', kraken: 'XBTUSDT' },
  metadata: { precisionPrice: 2, precisionSize: 8 },
  active: true,
});

// Batch
symbolManager.registerBatch([
  { symbol: 'ETH/USDT', /* ... */ },
  { symbol: 'EUR/USD', /* ... */ },
  { symbol: 'AAPL', /* ... */ },
]);
```

### Format for Display

```typescript
import { useFormattedSymbol } from './hooks/useSymbolUniverse';

export function SymbolDisplay({ canonical }) {
  const formatted = useFormattedSymbol(canonical);
  
  return (
    <div style={{ color: formatted.color }}>
      <span>{formatted.assetClassIcon}</span>
      <strong>{formatted.displayName}</strong>
      <small>{formatted.pairDisplay}</small>
    </div>
  );
}
```

### Normalize Exchange Format

```typescript
import { symbolNormalizer } from './services/symbol-normalizer';

// Exchange format → Canonical
const result = symbolNormalizer.normalize('BTCUSDT', 'binance');
// result.canonical = 'BTC/USDT'

// Canonical → Exchange format
const result = symbolNormalizer.denormalize('BTC/USDT', 'binance');
// result.canonical = 'BTCUSDT' (in real code)
```

### Lookup Symbols

```typescript
import { useSymbolLookup } from './hooks/useSymbolUniverse';

export function CryptoList() {
  const { symbols } = useSymbolLookup({
    assetClass: 'crypto',
    limit: 50,
  });

  return symbols.map(s => (
    <SymbolDisplay key={s.symbol} canonical={s.symbol} />
  ));
}
```

### Validate Symbol

```typescript
try {
  symbolManager.registerSymbol({
    symbol: 'INVALID', // ❌ Missing /
    assetClass: 'forex',
    // ...
  });
} catch (err) {
  // Error: Symbol validation failed
}
```

---

## 🔗 Integration Points

### Backend API

```typescript
// server/index.ts
import symbolUniverseRoutes from './routes/api/symbol-universe';
app.use('/api/symbol-universe', symbolUniverseRoutes);

// Now available:
// GET /api/symbol-universe/state
// GET /api/symbol-universe/symbols
// POST /api/symbol-universe/normalize
// POST /api/symbol-universe/denormalize
// GET /api/symbol-universe/search
// EventSource /api/symbol-universe/changes
```

### React Components

```typescript
// Use hooks
import {
  useSymbolUniverse,
  useFormattedSymbol,
  useSymbolLookup,
} from './hooks/useSymbolUniverse';

// In any component
function MyComponent() {
  const { symbols, lookup } = useSymbolUniverse();
  const formatted = useFormattedSymbol('BTC/USDT');
  const results = useSymbolLookup({ symbol: 'EUR' });
  
  // ...
}
```

### Data Fetching

```typescript
import { symbolNormalizer } from './services/symbol-normalizer';

async function fetchPrice(exchangeFormat, venue) {
  // Always normalize first
  const normalized = symbolNormalizer.normalize(exchangeFormat, venue);
  if (!normalized.success) throw new Error(normalized.error);

  // Use canonical internally
  const canonical = normalized.canonical;

  // Fetch data...
  return { canonical, data: /* ... */ };
}
```

---

## 📊 Type Definitions

### Symbol Interface
```typescript
interface Symbol {
  symbol: string;              // 'BTC/USDT'
  assetClass: AssetClass;      // 'crypto'
  base: string;                // 'BTC'
  quote?: string;              // 'USDT'
  name: string;                // 'Bitcoin'
  venues: Record<string, string>; // { binance: 'BTCUSDT' }
  metadata: {
    precisionPrice: number;    // 2
    precisionSize: number;     // 8
    volume24h?: number;
    tradingHours?: string;
    tags?: string[];
  };
  active: boolean;
}
```

### FormattedSymbol Interface
```typescript
interface FormattedSymbol {
  canonical: string;           // 'BTC/USDT'
  displayName: string;         // 'Bitcoin'
  shortCode: string;           // 'BTC'
  pairDisplay: string;         // 'BTC / USDT'
  assetClassBadge: string;     // 'CRYPTO'
  assetClassIcon: string;      // '₿'
  color: string;               // '#F7931A'
  volumeDisplay?: string;      // '$28.5B'
  meta: { /* ... */ };
}
```

---

## ✅ Checklist for Integration

- [ ] Copy files to your repo
- [ ] Run: `npm install` (no new dependencies needed)
- [ ] Create bootstrap file to register symbols
- [ ] Add API endpoints (or use provided example)
- [ ] Update React components to use hooks
- [ ] Test normalization for your venues
- [ ] Verify all asset classes render identically
- [ ] Remove old symbol handling code

---

## 🐛 Troubleshooting

### Symbol Registration Fails
**Cause:** Validation rule violated
**Solution:** Check error message, ensure symbol format matches (BASE/QUOTE)

### Normalization Returns No Match
**Cause:** Format not recognized for venue
**Solution:** Register symbol with correct venue mapping

### React Hook Returns Undefined
**Cause:** Symbol not registered
**Solution:** Verify symbol exists in universe

### UI Looks Different for Same Asset Class
**Cause:** Old component not using symbol formatter
**Solution:** Replace with useFormattedSymbol hook

---

## 🎓 Key Rules

1. **Single Source of Truth**
   - Register symbols once at startup
   - Reference by canonical name everywhere

2. **Never Raw Broker Formats**
   - Always normalize to canonical
   - Only denormalize when submitting to exchanges

3. **No Asset Class Logic**
   - UI components don't check asset class
   - Use formatter for consistency

4. **Validation Rules**
   - Symbols validated on registration
   - No invalid symbols slip through

5. **Consistent Formatting**
   - Same component for all asset classes
   - Icons, colors, precision automatic

---

## 📚 Documentation Files

| Document | Read When |
|----------|-----------|
| `SYMBOL_UNIVERSE_IMPLEMENTATION.md` | First time integrating |
| `SYMBOL_UNIVERSE_BEFORE_AFTER.md` | Understanding the why |
| `SYMBOL_UNIVERSE_QUICK_REF.md` | Quick lookup (this file) |
| API source code comments | Implementing endpoints |
| Hook source code comments | Using in components |

---

## 🚀 Next Steps

1. **Register your symbols**
   - Create `server/bootstrap/symbols.ts`
   - Import and call `symbolManager.registerBatch()`

2. **Implement API endpoints**
   - Create `server/routes/api/symbol-universe.ts`
   - Use example from `symbol-universe-api.ts`

3. **Update React components**
   - Import `useSymbolUniverse` hook
   - Replace old symbol handling

4. **Test**
   - Verify UI consistent across asset classes
   - Test normalization both directions
   - Validate error handling

---

## 💡 Pro Tips

- Use `displayVariant` parameter for different UI contexts:
  - `compact`: Just symbol (BTC/USDT)
  - `standard`: With badge (BTC/USDT [CRYPTO])
  - `full`: Rich display (Bitcoin BTC/USDT [CRYPTO] ₿)
  - `card`: Rich card

- Cache normalizations automatically (built-in)
- Symbol statistics available via `/api/symbol-universe/stats`
- Subscribe to changes via EventSource `/api/symbol-universe/changes`
- Groups organize symbols for navigation (watchlists, major pairs, etc)

---

## ❓ FAQ

**Q: Do I need to register every symbol my users trade?**
A: Recommended but not required. Unknown symbols fall back to pattern matching.

**Q: Can I update symbol metadata?**
A: Yes, use `symbolManager.updateSymbol()`

**Q: What if a symbol trades on multiple exchanges differently?**
A: Register with all venues in the `venues` map. System picks primary automatically.

**Q: How do I add a new asset class?**
A: Add to `AssetClass` enum, update UI config colors/icons, register symbols.

**Q: Does this work with existing data?**
A: Yes! Normalize old formats to canonical on import.
