# Symbol Universe — Before & After Comparison

## The Problem

### Before: Asset Classes Treated Differently

```typescript
// OLD CODE: Symbol handling split by asset class
// This is what you probably have scattered throughout your codebase

// In dashboard.tsx
export function TradingDashboard() {
  // Crypto-specific rendering
  if (assetClass === 'crypto') {
    return <CryptoSymbolCard symbol={ticker} price={price} />;
  }

  // Forex-specific rendering
  if (assetClass === 'forex') {
    return <ForexSymbolCard symbol={symbol} price={price} />;
  }

  // Equities-specific rendering
  if (assetClass === 'equities') {
    return <EquitySymbolCard symbol={ticker} price={price} />;
  }

  // ❌ Problem: Same asset rendered 3 different ways
  // ❌ Problem: UI bugs creep in (one class gets a feature, others don't)
  // ❌ Problem: Maintenance nightmare
}

// In symbol-mapper.ts
function normalizeSymbol(symbol: string, exchange: string) {
  // Exchange-specific logic scattered everywhere
  if (exchange === 'binance') {
    // Binance format: BTCUSDT
    return symbol.replace('/', '');
  }

  if (exchange === 'oanda') {
    // OANDA format: EUR_USD
    return symbol.replace('/', '_');
  }

  if (exchange === 'kraken') {
    // Kraken format: XBTUSDT
    return handleKrakenSpecifics(symbol);
  }

  // ❌ Problem: Manual venue handling
  // ❌ Problem: Format conversions mixed with data fetching
  // ❌ Problem: No validation
}

// In trading-engine.ts
function getPrice(symbol: string, source: string) {
  // Asset-class specific logic
  if (symbol.includes('USD')) {
    // Assume forex? Hope no symbols have USD in wrong place
    return fetchForexPrice(symbol);
  }

  // Assume crypto?
  return fetchCryptoPrice(symbol);

  // ❌ Problem: Guessing asset class from symbol format
  // ❌ Problem: Fragile logic
}

// In components
function SymbolDisplay({ symbol, assetClass }) {
  if (assetClass === 'crypto') {
    return <span className="crypto-badge">{symbol}</span>;
  }

  if (assetClass === 'forex') {
    return <span className="forex-badge">{symbol}</span>;
  }

  // ❌ Problem: Same symbol, different rendering
  // ❌ Problem: Bugs in one don't get fixed in others
}
```

### Common Issues

| Issue | Impact |
|-------|--------|
| **UI Inconsistency** | BTC/USDT card looks different from EUR/USD card even though they're the same asset |
| **Scattered Logic** | Symbol normalization code in 5 different files |
| **No Validation** | Invalid symbols slip through (wrong precision, missing venues) |
| **Exchange Coupling** | Adding new exchange requires changes in 10 places |
| **Asset Class Guessing** | Bugs when symbol format ambiguous |
| **Precision Errors** | Same component applies wrong decimal places to different assets |
| **Maintenance Burden** | Change to forex logic breaks crypto rendering (both use shared code) |

---

## The Solution: Symbol Universe

### After: Unified, Consistent System

```typescript
// NEW CODE: Single source of truth

// Step 1: Register symbols once (at startup)
import { symbolManager } from './services/symbol-manager';
import { AssetClass } from './types/symbol-universe';

symbolManager.registerBatch([
  {
    symbol: 'BTC/USDT',
    assetClass: AssetClass.CRYPTO,
    base: 'BTC',
    quote: 'USDT',
    name: 'Bitcoin',
    venues: {
      binance: 'BTCUSDT',
      kraken: 'XBTUSDT',
      kucoinfutures: 'BTC/USDT:USDT',
    },
    metadata: {
      precisionPrice: 2,
      precisionSize: 8,
    },
    active: true,
  },
  {
    symbol: 'EUR/USD',
    assetClass: AssetClass.FOREX,
    base: 'EUR',
    quote: 'USD',
    name: 'Euro / US Dollar',
    venues: {
      oanda: 'EUR_USD',
    },
    metadata: {
      precisionPrice: 5,
      precisionSize: 2,
    },
    active: true,
  },
  // ... more symbols
]);

// Step 2: Use in React components (IDENTICAL CODE for all assets)
import { useFormattedSymbol } from './hooks/useSymbolUniverse';

export function SymbolCard({ canonical }: { canonical: string }) {
  // ✅ Works for BTC/USDT, EUR/USD, AAPL, etc
  const formatted = useFormattedSymbol(canonical);

  if (!formatted) return null;

  // ✅ SAME COMPONENT for all asset classes
  // ✅ UI automatically consistent
  // ✅ Icons, colors, precision all handled
  return (
    <div style={{ background: formatted.color }}>
      <span>{formatted.assetClassIcon}</span>
      <h3>{formatted.displayName}</h3>
      <p>{formatted.pairDisplay}</p>
      <p>{formatted.volumeDisplay}</p>
    </div>
  );
}

// Step 3: Normalize symbols from exchanges
import { symbolNormalizer } from './services/symbol-normalizer';

async function fetchMarketData(format: string, venue: string) {
  // ✅ Universal normalization
  const result = symbolNormalizer.normalize(format, venue);

  if (!result.success) {
    throw new Error(result.error);
  }

  // ✅ Now using canonical symbol internally
  const canonical = result.canonical!;

  return {
    canonical,
    data: await fetchFromVenue(format, venue),
  };
}

// Step 4: Submit orders (denormalization)
async function submitOrder(canonical: string, venue: string) {
  // ✅ Convert canonical back to exchange format
  const result = symbolNormalizer.denormalize(canonical, venue);

  if (!result.success) {
    throw new Error(`Symbol ${canonical} not on ${venue}`);
  }

  // ✅ Submit with exchange format
  return await submitToVenue({
    symbol: result.canonical, // Actually the exchange format
    venue,
    // ...
  });
}

// Step 5: List/search symbols
import { useSymbolLookup } from './hooks/useSymbolUniverse';

export function AssetExplorer() {
  const { symbols } = useSymbolLookup({
    assetClass: AssetClass.FOREX,
    limit: 50,
  });

  return (
    <div>
      {symbols.map(symbol => (
        // ✅ SAME RENDERING for all
        <SymbolCard key={symbol.symbol} canonical={symbol.symbol} />
      ))}
    </div>
  );
}
```

---

## Side-by-Side Comparison

### 1. UI Rendering

```typescript
// ❌ BEFORE
function renderSymbol(symbol, assetClass) {
  if (assetClass === 'crypto') {
    return (
      <div className="crypto-header">
        <span className="bitcoin-icon">₿</span>
        {symbol}
        <span className="crypto-badge">CRYPTO</span>
      </div>
    );
  }
  
  if (assetClass === 'forex') {
    return (
      <div className="forex-header">
        <span className="currency-icon">💱</span>
        {symbol}
        <span className="forex-badge">FOREX</span>
      </div>
    );
  }
  // ...more branches
}

// ✅ AFTER
function renderSymbol(canonical) {
  const formatted = symbolFormatter.format(canonical);
  return (
    <div style={{ color: formatted.color }}>
      <span>{formatted.assetClassIcon}</span>
      {formatted.canonical}
      <span>{formatted.assetClassBadge}</span>
    </div>
  );
}
```

### 2. Symbol Normalization

```typescript
// ❌ BEFORE (scattered, manual)
function normalizeForBinance(symbol) {
  return symbol.replace('/', '');
}

function normalizeForOANDA(symbol) {
  return symbol.replace('/', '_');
}

function normalizeForKraken(symbol) {
  // Special handling...
  if (symbol === 'BTC/USD') return 'XBT/USD';
  return symbol;
}

// Call different functions depending on exchange
const formatted = exchange === 'binance'
  ? normalizeForBinance(symbol)
  : exchange === 'oanda'
  ? normalizeForOANDA(symbol)
  : normalizeForKraken(symbol);

// ✅ AFTER (unified, automatic)
const result = symbolNormalizer.normalize(exchangeFormat, venue);
// Works for any combination automatically
```

### 3. Price Precision

```typescript
// ❌ BEFORE
function formatPrice(price, assetClass) {
  if (assetClass === 'crypto') {
    return price.toFixed(2); // Bitcoin usually 2 decimals
  }
  
  if (assetClass === 'forex') {
    return price.toFixed(5); // EUR/USD usually 5
  }
  
  if (assetClass === 'equities') {
    return price.toFixed(2); // Stocks usually 2
  }
  // ...
  
  // ❌ Problem: Hardcoded assumptions
  // ❌ Problem: What if BTC/USD has different precision?
}

// ✅ AFTER
function formatPrice(canonical, price) {
  const symbol = symbolManager.getSymbol(canonical);
  return price.toFixed(symbol.metadata.precisionPrice);
  // ✅ Precision tied to symbol definition
  // ✅ No assumptions
}

// Even better: Use PriceFormatter
const formatter = new PriceFormatter(symbol);
const formatted = formatter.format(price);
```

### 4. Validation

```typescript
// ❌ BEFORE (no validation)
function addSymbol(name) {
  symbols.push(name); // Anything goes
}

addSymbol('BTC'); // Missing quote
addSymbol('INVALID'); // Invalid format
addSymbol('EUR/USD'); // Missing exchanges

// ✅ AFTER (automatic validation)
try {
  symbolManager.registerSymbol({
    symbol: 'BTC/USDT',
    assetClass: AssetClass.CRYPTO,
    // ... required fields
  });
  // ✅ Passes all validation rules
} catch (err) {
  // ✅ Error: [symbol-format] Symbol must match expected format
  // ✅ Error: [venues-not-empty] Must be available somewhere
}
```

---

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **UI Consistency** | Manual per asset class | Automatic across all classes |
| **Symbol Normalization** | Scattered, venue-by-venue | Unified normalizer with caching |
| **Validation** | None | Automatic rule-based |
| **Precision Handling** | Hardcoded | Tied to symbol metadata |
| **New Asset Support** | Requires code changes | Register symbol, works everywhere |
| **Bug Fixes** | Must update multiple places | Fix once, applies everywhere |
| **Exchange Support** | Add code per exchange | Normalizer learns pattern |
| **Type Safety** | Loose strings | Strong types |
| **Testing** | Complex, asset-specific | Simple, unified tests |

---

## Migration Path

### Phase 1: Bootstrap (Day 1)
```typescript
// 1. Create symbol universe
import { symbolManager } from './services/symbol-manager';

// 2. Register your symbols
symbolManager.registerBatch([/* ... */]);

// 3. That's it!
```

### Phase 2: Use in New Components (This Week)
```typescript
// Build new components with useSymbolUniverse()
// Don't migrate old ones yet
```

### Phase 3: Refactor Existing Components (Next Week)
```typescript
// Gradually replace old symbol handling with new system
// One component at a time
// All old code continues to work
```

### Phase 4: Remove Old Code (End of Sprint)
```typescript
// Delete normalizeForBinance(), normalizeForOANDA(), etc.
// Delete asset-class-specific components
// Archive old formatting logic
```

---

## Real-World Example

### Before: BTC and EUR/USD are Different

```typescript
// Dashboard.tsx
if (asset.type === 'crypto') {
  return <TradingCard>{asset.symbol}</TradingCard>;
}

// TradingTerminal.tsx
if (assetClass === 'forex') {
  return <ForexWidget>{pair}</ForexWidget>;
}

// Chart.tsx
if (symbol.includes('/')) {
  // Assume it's forex?
  useForexAdapter();
} else {
  // Assume crypto?
  useCryptoAdapter();
}

// Scanner.tsx
async function scanSymbol(symbol) {
  // Crypto scanner doesn't understand forex
  const result = await ccxtScanner.scan(symbol);
  // OANDA symbols fail here
}
```

### After: BTC and EUR/USD are the Same

```typescript
// Dashboard.tsx
const formatted = useFormattedSymbol(canonical);
return <UnifiedSymbolCard {...formatted} />;

// TradingTerminal.tsx
const formatted = useFormattedSymbol(canonical);
return <UnifiedSymbolCard {...formatted} />;

// Chart.tsx
const symbol = symbolManager.getSymbol(canonical);
useAdapter(symbol.assetClass);
// Works for any asset class

// Scanner.tsx
async function scanSymbol(canonical) {
  const symbol = symbolManager.getSymbol(canonical);
  const format = symbolNormalizer.denormalize(canonical, venue);
  // Works for crypto, forex, equities...
}
```

---

## Conclusion

Symbol Universe transforms your system from:
- **Scattered, manual, inconsistent** → **Unified, automatic, consistent**

The same UI components work for crypto, forex, equities, commodities, indices.

Adding a new asset class? No code changes. Just register symbols.

That's the power of treating all assets as **canonical symbols**.
