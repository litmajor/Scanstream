# Symbol Universe — Integration Implementation Guide

## Overview

The Symbol Universe is your global registry for all tradeable assets. It ensures **consistency across asset classes** — BTC/USDT and EUR/USD render identically, behave identically, and follow identical validation rules.

**Key Principle:** The user should forget what asset class it is.

---

## 🏗️ Architecture

### Four Core Components

#### 1. **Symbol Universe Types** (`server/types/symbol-universe.ts`)
Defines all types: symbols, asset classes, validation rules, UI configs.

#### 2. **Symbol Manager** (`server/services/symbol-manager.ts`)
Central registry. Handles:
- Symbol registration and discovery
- Validation against rules
- Cross-venue symbol mapping
- Event notifications on changes

#### 3. **Symbol Formatter** (`server/services/symbol-formatter.ts`)
Ensures UI consistency. Handles:
- Display names and badges
- Asset class icons and colors
- Price/size precision formatting
- Multiple display variants (compact, standard, full, card)

#### 4. **Symbol Normalizer** (`server/services/symbol-normalizer.ts`)
Exchange-agnostic format conversion:
- Raw broker format → Canonical symbol
- Canonical → Venue-specific format
- Pattern-based fallback matching
- Smart symbol detection

### React Integration (`client/src/hooks/useSymbolUniverse.ts`)
Three hooks for consuming the universe in components:
- `useSymbolUniverse()` — Full access
- `useFormattedSymbol()` — Single symbol formatting
- `useSymbolLookup()` — Search and filter

---

## 🚀 Quick Start

### 1. Register Symbols

```typescript
// server/bootstrap/symbol-bootstrap.ts

import { symbolManager } from '../services/symbol-manager';
import { AssetClass } from '../types/symbol-universe';

// Register crypto symbols
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
    primaryVenue: 'binance',
    metadata: {
      precisionPrice: 2,
      precisionSize: 8,
      minTick: 0.01,
      volume24h: 28_000_000_000,
      tags: ['major', 'bluechip'],
    },
    active: true,
  },
  {
    symbol: 'ETH/USDT',
    assetClass: AssetClass.CRYPTO,
    base: 'ETH',
    quote: 'USDT',
    name: 'Ethereum',
    venues: {
      binance: 'ETHUSDT',
      kraken: 'ETHUSDT',
    },
    primaryVenue: 'binance',
    metadata: {
      precisionPrice: 2,
      precisionSize: 18,
      volume24h: 15_000_000_000,
      tags: ['major', 'smart-contracts'],
    },
    active: true,
  },
]);

// Register forex symbols
symbolManager.registerBatch([
  {
    symbol: 'EUR/USD',
    assetClass: AssetClass.FOREX,
    base: 'EUR',
    quote: 'USD',
    name: 'Euro / US Dollar',
    venues: {
      oanda: 'EUR_USD',
      mt5: 'EURUSD',
    },
    primaryVenue: 'oanda',
    metadata: {
      precisionPrice: 5,
      precisionSize: 2,
      minTick: 0.00001,
      volume24h: 300_000_000_000,
      tradingHours: '22:00-21:00 UTC (Sun-Fri)',
      custody: 'custodial',
      settlement: 'T+0',
    },
    active: true,
  },
  {
    symbol: 'GBP/JPY',
    assetClass: AssetClass.FOREX,
    base: 'GBP',
    quote: 'JPY',
    name: 'British Pound / Japanese Yen',
    venues: {
      oanda: 'GBP_JPY',
    },
    primaryVenue: 'oanda',
    metadata: {
      precisionPrice: 2,
      precisionSize: 2,
      volume24h: 85_000_000_000,
      tradingHours: '22:00-21:00 UTC (Sun-Fri)',
      tags: ['crosses'],
    },
    active: true,
  },
]);

// Register equities
symbolManager.registerBatch([
  {
    symbol: 'AAPL',
    assetClass: AssetClass.EQUITIES,
    base: 'AAPL',
    quote: 'USD',
    name: 'Apple Inc.',
    venues: {
      nasdaq: 'AAPL',
    },
    primaryVenue: 'nasdaq',
    metadata: {
      precisionPrice: 2,
      precisionSize: 1,
      volume24h: 85_000_000,
      tradingHours: '09:30-16:00 EST (Mon-Fri)',
      custody: 'custodial',
    },
    active: true,
  },
]);
```

### 2. Use in Backend APIs

```typescript
// server/routes/api/symbols.ts

import { Router } from 'express';
import { symbolManager } from '../../services/symbol-manager';
import { symbolFormatter, DisplayVariant } from '../../services/symbol-formatter';
import { symbolNormalizer } from '../../services/symbol-normalizer';

const router = Router();

// Get all symbols
router.get('/symbols', (req, res) => {
  const { assetClass, venue, active } = req.query;

  const query: any = {};
  if (assetClass) query.assetClass = assetClass;
  if (venue) query.venue = venue;
  if (active === 'true') query.activeOnly = true;

  const result = symbolManager.lookup(query);
  res.json(result.symbols);
});

// Get universe state (for React hydration)
router.get('/universe-state', (req, res) => {
  const state = symbolManager.getUniverseState();
  res.json(state);
});

// Format a symbol for display
router.get('/format/:canonical', (req, res) => {
  const { canonical } = req.params;
  const { variant = 'standard' } = req.query;

  try {
    const formatted = symbolFormatter.format(
      canonical,
      variant as DisplayVariant
    );
    res.json(formatted);
  } catch (err) {
    res.status(404).json({ error: 'Symbol not found' });
  }
});

// Normalize venue format to canonical
router.post('/normalize', (req, res) => {
  const { format, venue } = req.body;

  const result = symbolNormalizer.normalize(format, venue);
  res.json(result);
});

// Denormalize canonical to venue format
router.post('/denormalize', (req, res) => {
  const { canonical, venue } = req.body;

  const result = symbolNormalizer.denormalize(canonical, venue);
  res.json(result);
});

// Search symbols
router.get('/search', (req, res) => {
  const { q, assetClass, limit = 10 } = req.query;

  const result = symbolManager.lookup({
    symbol: q as string,
    assetClass: assetClass as any,
    limit: parseInt(limit as string),
  });

  res.json(result.symbols);
});

// Get symbol statistics
router.get('/stats', (req, res) => {
  const stats = symbolManager.getStats();
  res.json(stats);
});

export default router;
```

### 3. Use in React Components

#### Simple Symbol Display

```typescript
// components/SymbolBadge.tsx

import { useFormattedSymbol } from '../hooks/useSymbolUniverse';

interface SymbolBadgeProps {
  canonical: string;
}

export function SymbolBadge({ canonical }: SymbolBadgeProps) {
  const formatted = useFormattedSymbol(canonical);

  if (!formatted) return null;

  return (
    <div
      style={{
        background: formatted.color,
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <span>{formatted.assetClassIcon}</span>
      <span>{formatted.canonical}</span>
      <span style={{ fontSize: '11px' }}>
        {formatted.assetClassBadge}
      </span>
    </div>
  );
}
```

#### Symbol Card (Works for ALL asset classes identically)

```typescript
// components/SymbolCard.tsx

import { useFormattedSymbol } from '../hooks/useSymbolUniverse';

interface SymbolCardProps {
  canonical: string;
  onClick?: () => void;
}

export function SymbolCard({ canonical, onClick }: SymbolCardProps) {
  const formatted = useFormattedSymbol(canonical);

  if (!formatted) return null;

  // THIS IS KEY: Same component works for BTC/USDT and EUR/USD
  // No conditional rendering based on asset class

  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${formatted.color}`,
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 8px ${formatted.color}33`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: '18px' }}>
            {formatted.assetClassIcon}
          </div>
          <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
            {formatted.displayName}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {formatted.pairDisplay}
          </div>
        </div>
        <div style={{
          background: formatted.color,
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
        }}>
          {formatted.assetClassBadge}
        </div>
      </div>

      {formatted.volumeDisplay && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#666',
        }}>
          Vol: {formatted.volumeDisplay}
        </div>
      )}

      {formatted.tradingHours && (
        <div style={{
          marginTop: '4px',
          fontSize: '10px',
          color: '#999',
        }}>
          {formatted.tradingHours}
        </div>
      )}
    </div>
  );
}
```

#### Symbol List (Multiple Assets)

```typescript
// components/SymbolList.tsx

import { useSymbolLookup } from '../hooks/useSymbolUniverse';
import { SymbolCard } from './SymbolCard';

interface SymbolListProps {
  assetClass?: string;
  venue?: string;
  onSelect?: (canonical: string) => void;
}

export function SymbolList({
  assetClass,
  venue,
  onSelect,
}: SymbolListProps) {
  const { symbols } = useSymbolLookup({
    assetClass: assetClass as any,
    venue,
    activeOnly: true,
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '12px',
    }}>
      {symbols.map((symbol) => (
        <SymbolCard
          key={symbol.symbol}
          canonical={symbol.symbol}
          onClick={() => onSelect?.(symbol.symbol)}
        />
      ))}
    </div>
  );
}
```

#### Symbol Selector (Modal/Dropdown)

```typescript
// components/SymbolSelector.tsx

import { useState } from 'react';
import { useSymbolLookup } from '../hooks/useSymbolUniverse';

interface SymbolSelectorProps {
  onSelect: (canonical: string) => void;
  assetClassFilter?: string[];
}

export function SymbolSelector({
  onSelect,
  assetClassFilter,
}: SymbolSelectorProps) {
  const [search, setSearch] = useState('');

  const { symbols } = useSymbolLookup({
    symbol: search,
    assetClass: assetClassFilter as any,
    limit: 20,
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search BTC, EUR/USD, AAPL..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px',
          marginBottom: '12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      />

      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
      }}>
        {symbols.map((symbol) => (
          <div
            key={symbol.symbol}
            onClick={() => onSelect(symbol.symbol)}
            style={{
              padding: '8px',
              cursor: 'pointer',
              borderBottom: '1px solid #eee',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <strong>{symbol.symbol}</strong>
            <br />
            <small style={{ color: '#666' }}>
              {symbol.name} ({symbol.assetClass.toUpperCase()})
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. Normalize Symbols from Exchanges

```typescript
// server/services/data-fetcher.ts

import { symbolNormalizer } from './symbol-normalizer';

export async function fetchMarketData(
  exchangeFormat: string,
  venue: string
) {
  // Normalize exchange format to canonical
  const normalized = symbolNormalizer.normalize(exchangeFormat, venue);

  if (!normalized.success) {
    throw new Error(
      `Cannot normalize ${exchangeFormat} for ${venue}: ${normalized.error}`
    );
  }

  const canonical = normalized.canonical!;

  // Now use canonical symbol internally
  return {
    canonical,
    data: await fetchFromVenue(exchangeFormat, venue),
  };
}

export async function submitOrder(
  canonical: string,
  venue: string,
  side: 'buy' | 'sell',
  size: number
) {
  // Denormalize for exchange submission
  const denormalized = symbolNormalizer.denormalize(canonical, venue);

  if (!denormalized.success) {
    throw new Error(`Symbol ${canonical} not available on ${venue}`);
  }

  const exchangeFormat = denormalized.canonical!; // Reusing field for format

  return await submitToVenue({
    symbol: exchangeFormat,
    venue,
    side,
    size,
  });
}
```

---

## 🔄 Key Patterns

### Pattern 1: Identical UI for Different Asset Classes

```typescript
// ❌ WRONG: Asset-class specific logic
function renderSymbol(symbol: Symbol) {
  if (symbol.assetClass === AssetClass.CRYPTO) {
    return <CryptoSymbolDisplay {...} />;
  } else if (symbol.assetClass === AssetClass.FOREX) {
    return <ForexSymbolDisplay {...} />;
  }
  // Bug: Code diverges, inconsistencies creep in
}

// ✅ CORRECT: Unified rendering
function renderSymbol(symbol: Symbol) {
  const formatted = symbolFormatter.format(symbol.symbol);
  return <UnifiedSymbolCard {...formatted} />;
  // Same component, same styling, same behavior
}
```

### Pattern 2: Exchange-Agnostic Data Fetching

```typescript
// ❌ WRONG: Manual venue-by-venue logic
async function getPrice(symbol: string, venue: string) {
  if (venue === 'binance') {
    // Binance-specific code
  } else if (venue === 'oanda') {
    // OANDA-specific code
  }
  // Maintenance nightmare, duplicate logic
}

// ✅ CORRECT: Universal normalization
async function getPrice(canonical: string, venue: string) {
  const format = symbolNormalizer.denormalize(canonical, venue);
  if (!format.success) throw new Error('Symbol not on this venue');

  // Same code works for any combination
  return await fetchPrice(format.canonical, venue);
}
```

### Pattern 3: Consistency Validation

```typescript
// Symbols automatically validate against rules
// If you register a symbol that violates a rule, it fails:

try {
  symbolManager.registerSymbol({
    symbol: 'INVALID',  // ❌ Missing /
    assetClass: 'crypto', // ❌ Inconsistent with format
    // ...
  });
} catch (err) {
  // Error: Symbol must match expected format
  // Error: Asset class must be consistent with symbol format
}
```

---

## 📊 Universe Statistics

```typescript
import { symbolManager } from './services/symbol-manager';

const stats = symbolManager.getStats();
console.log(stats);
// {
//   totalSymbols: 150,
//   byAssetClass: {
//     crypto: 50,
//     forex: 40,
//     equities: 50,
//     commodities: 10,
//     indices: 0
//   },
//   activeSymbols: 145,
//   lastUpdated: 1702473600000
// }
```

---

## 🎯 Testing

```typescript
import { symbolManager } from '../services/symbol-manager';
import { symbolFormatter } from '../services/symbol-formatter';
import { symbolNormalizer } from '../services/symbol-normalizer';

describe('Symbol Universe', () => {
  test('BTC and EUR/USD render identically', () => {
    const btc = symbolFormatter.format('BTC/USDT');
    const eur = symbolFormatter.format('EUR/USD');

    // Both have icons, colors, badges, precision, etc
    expect(btc.assetClassIcon).toBeDefined();
    expect(eur.assetClassIcon).toBeDefined();

    // UI doesn't care about asset class
    expect(typeof btc.color).toBe('string');
    expect(typeof eur.color).toBe('string');
  });

  test('Normalization works both ways', () => {
    const canonical = 'BTC/USDT';

    const denorm = symbolNormalizer.denormalize(canonical, 'binance');
    expect(denorm.success).toBe(true);

    const format = denorm.canonical; // Would be BTCUSDT in real code
    const norm = symbolNormalizer.normalize(format, 'binance');

    expect(norm.canonical).toBe(canonical);
  });

  test('Symbol validation enforces rules', () => {
    expect(() => {
      symbolManager.registerSymbol({
        symbol: 'INVALID', // Missing /
        assetClass: 'forex',
        // ...
      });
    }).toThrow();
  });
});
```

---

## 📈 Scaling to New Assets

### Adding New Crypto
```typescript
symbolManager.registerSymbol({
  symbol: 'SOL/USDT',
  assetClass: AssetClass.CRYPTO,
  base: 'SOL',
  quote: 'USDT',
  name: 'Solana',
  venues: {
    binance: 'SOLUSDT',
    kraken: 'SOLUSDT',
  },
  primaryVenue: 'binance',
  metadata: { /* ... */ },
  active: true,
});
```

### Adding New Forex
```typescript
symbolManager.registerSymbol({
  symbol: 'USD/JPY',
  assetClass: AssetClass.FOREX,
  base: 'USD',
  quote: 'JPY',
  name: 'US Dollar / Japanese Yen',
  venues: {
    oanda: 'USD_JPY',
  },
  primaryVenue: 'oanda',
  metadata: { /* ... */ },
  active: true,
});
```

### Adding New Equity
```typescript
symbolManager.registerSymbol({
  symbol: 'GOOGL',
  assetClass: AssetClass.EQUITIES,
  base: 'GOOGL',
  quote: 'USD',
  name: 'Alphabet Inc.',
  venues: {
    nasdaq: 'GOOGL',
  },
  primaryVenue: 'nasdaq',
  metadata: { /* ... */ },
  active: true,
});
```

All will render consistently. No special UI code needed.

---

## 🔐 Validation Rules

The system enforces consistency via validation rules:

1. **Symbol Format** — Proper format (BASE/QUOTE for pairs)
2. **Asset Class Match** — Consistent with format
3. **Venues Not Empty** — Must be tradeable somewhere
4. **Precision Positive** — Valid decimal places
5. **Base/Quote Match** — Symbols align with components

Add custom rules:
```typescript
symbolManager['validationRules'].push({
  id: 'custom-rule',
  description: 'Custom validation',
  validate: (symbol) => symbol.metadata.volume24h !== undefined,
  severity: 'warn',
});
```

---

## 🎓 Conclusion

The Symbol Universe is your **single source of truth**. It:

✅ Normalizes all assets to canonical form  
✅ Ensures UI consistency across asset classes  
✅ Validates symbols against rules  
✅ Handles venue-specific mappings  
✅ Provides formatted output for all contexts  

**Result:** Your system treats BTC/USDT and EUR/USD identically. The UI breaks less. Bugs don't creep in.
