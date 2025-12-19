# 🌌 Symbol Universe Dashboard - Specification

## Overview
Centralized asset discovery, monitoring, and intelligent filtering tool for traders to explore, analyze, and manage trading universes across multiple exchanges.

---

## Core Features

### 1. **Universe Selection & Filtering**
- **Exchange Filter**: Select primary exchange (Binance, Coinbase, Kraken, OKX, Bybit, KuCoin)
- **Asset Class Filter**: Spot, Futures, Perpetual Swaps
- **Market Cap Range**: Small cap ($0-$100M), Mid cap ($100M-$1B), Large cap ($1B+)
- **Liquidity Filter**: Show only assets with minimum trading volume (e.g., $1M daily volume)
- **Quote Asset**: Filter by quote currency (USDT, USD, EUR, etc.)
- **Trending Filter**: New listings, trending up, trending down, highest volume

### 2. **Symbol Library** (Table View)
Display all available trading pairs with columns:
- Symbol (clickable for details)
- Current Price
- 24h Change (%)
- 24h Volume
- Market Cap
- Liquidity Score (0-100)
- Bid-Ask Spread (%)
- 1h/4h/24h Volatility
- In Watchlist (star button)
- Quick Trade (one-click entry to Trading Terminal)

**Features**:
- Sortable columns
- Search/autocomplete by symbol name
- Bulk actions (add multiple to watchlist)
- Export to CSV

### 3. **Watchlist Management**
- Create multiple watchlists (e.g., "DCA Daily", "Scalping Pairs", "Long Holds")
- Drag-and-drop organization
- Quick-add from symbol table
- Remove with confirmation
- Combine watchlists
- Share watchlist (copy URL)
- Set price alerts per symbol per watchlist

### 4. **Market Coverage Heatmap**
Visualization of trading pairs by:
- **X-axis**: Asset (symbols ordered by volume)
- **Y-axis**: Exchange
- **Color**: Liquidity/Spread quality
  - 🟢 Green: Excellent (spread < 0.05%, depth > $100k)
  - 🟡 Yellow: Good (spread < 0.1%, depth > $50k)
  - 🔴 Red: Poor (spread > 0.1%, low depth)

**Use Case**: Identify which symbols have best execution on which exchanges

### 5. **Pair Analysis**
#### Correlation Matrix
- Select 5-20 symbols
- Show correlation coefficients (-1 to +1)
- Heatmap visualization
- **Use Case**: Avoid correlated positions, find hedges

#### Causality Analysis
- Detect lead-lag relationships
- Which symbols move first?
- Example: When BTC moves up, which alts follow immediately?

#### Co-movement Metrics
- Synchronicity score (how often pairs move together)
- Beta relative to BTC/ETH
- Decoupling events (when usually correlated pairs diverge)

### 6. **New Listings Monitor**
- Real-time alerts for new token listings
- Filter by exchange
- Quick analysis: Contract age, initial price, volume trend
- Pre-listing hype detection
- Add to watchlist before official launch

### 7. **Volume Profile**
- **By Symbol**: Which trading pairs have highest volume today?
- **By Timeframe**: Intraday volume distribution
- **By Exchange**: Where is volume concentrated?
- **By Quote**: USDT vs BUSD vs USDC volume trends

### 8. **Liquidity Metrics**
Per-symbol detailed analysis:
- **Bid-Ask Spread**: Historical spread comparison
- **Order Book Depth**: How much can you buy/sell at current price without slippage?
- **Slippage Estimator**: "Buying $10k worth would incur X% slippage"
- **Volume VWAP**: Volume-weighted average price
- **Market Depth Chart**: Visual representation of buy/sell orders

**Use Case**: Optimize execution, avoid slippage on large orders

### 9. **Symbol Details Panel** (Side Drawer)
When clicking a symbol, show:
- Price chart (1h, 4h, 1d)
- Basic stats (price, volume, cap, supply)
- Available on exchanges (checkmarks)
- Volatility percentile (vs market)
- RSI, MACD, BB (simple indicators)
- Recent price action (up/down/sideways)
- Add to watchlist button
- Open in Trading Terminal button

### 10. **Smart Recommendations**
Based on portfolio/trading style:
- "High Volatility Scalping Pairs" - Assets with 5-10% daily moves
- "Low Correlation Diversifiers" - Assets uncorrelated to your portfolio
- "Emerging Opportunities" - Low market cap, increasing volume
- "Stable Staking Candidates" - Low volatility, strong support levels

---

## Technical Implementation

### Data Sources
- Real-time: WebSocket for price, volume updates
- Static: Exchange APIs for symbol lists, specs
- Cached: Correlation matrices (update hourly)
- DB: Watchlists (stored per user)

### Components to Build
1. `SymbolUniverse.tsx` - Main page layout
2. `SymbolTable.tsx` - Filterable symbol table
3. `WatchlistManager.tsx` - Watchlist CRUD
4. `LiquidityHeatmap.tsx` - Exchange/symbol grid
5. `CorrelationMatrix.tsx` - Symbol correlation viz
6. `SymbolDetailsPanel.tsx` - Side drawer details
7. `NewListingsAlert.tsx` - Real-time alerts
8. `VolumeProfile.tsx` - Volume distribution chart
9. `LiquidityMetrics.tsx` - Depth, spread analysis

### API Endpoints Needed
```
GET /api/symbols - List all available symbols with filters
GET /api/symbols/:symbol - Detailed symbol info
GET /api/symbols/correlation - Correlation matrix
GET /api/symbols/volume-profile - Volume distribution
GET /api/symbols/liquidity/:symbol - Liquidity metrics
GET /api/symbols/new-listings - Recent listings
POST /api/watchlists - Create watchlist
GET /api/watchlists - List user watchlists
PUT /api/watchlists/:id - Update watchlist
DELETE /api/watchlists/:id - Delete watchlist
```

---

## UI/UX Layout

```
┌─────────────────────────────────────────────────────┐
│ 🌌 Symbol Universe                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Exchange ▼] [Asset Class ▼] [Market Cap ▼]      │
│ [Liquidity ▼] [Volatility ▼] [Search...]         │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Symbol Table (sortable):                          │
│  ┌─ Symbol ─ Price ─ Change ─ Volume ─ Cap ─ ... │
│  │ BTC      $45,000  +2.5%   $25.3B  $900B       │
│  │ ETH      $2,500   +1.2%   $12.1B  $300B       │
│  │ SOL      $98      +3.1%   $1.2B   $40B        │
│  │ ...                                             │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Tabs: [Heatmap] [Correlation] [Volume] [Liquidity]│
│                                                     │
│ [Heatmap View / Correlation Matrix / Volume Chart]│
│                                                     │
└─────────────────────────────────────────────────────┘
  Side Panel (when symbol selected):
  ├─ Price Chart
  ├─ Symbol Details
  ├─ Liquidity Metrics
  └─ [Add to Watchlist] [Trade]
```

---

## Acceptance Criteria

- [ ] Display 100+ symbols with real-time price updates
- [ ] Filter by 5+ dimensions (exchange, asset class, cap, liquidity, trend)
- [ ] Search/autocomplete functionality
- [ ] Watchlist CRUD with persistence
- [ ] Correlation matrix calculation and viz
- [ ] Liquidity heatmap showing 6+ exchanges
- [ ] Symbol details panel with chart
- [ ] New listings real-time alerts
- [ ] Volume profile visualization
- [ ] Slippage estimator accuracy
- [ ] Mobile responsive
- [ ] Performance: Load 1000+ symbols in < 3s

---

## Priority (MVP to Advanced)

### Phase 1 (MVP)
- Symbol table with filtering and search
- Watchlist creation/management
- Basic symbol details panel
- Price/volume real-time updates

### Phase 2
- Correlation matrix
- Liquidity heatmap
- New listings alerts
- Volume profile

### Phase 3
- Advanced recommendations
- Causality analysis
- Slippage simulator
- Share watchlists
- Mobile optimization

---

## Example Use Cases

**Scenario 1: Day Trader Building Scalping Universe**
1. Filter: High volatility (>5% daily), High volume (>$100M/day)
2. Add 15 symbols to "Scalping Universe" watchlist
3. Check correlation matrix to avoid correlated pairs
4. Open Trading Terminal, select from watchlist, trade

**Scenario 2: Portfolio Manager Diversifying**
1. Filter: Low correlation to portfolio (< 0.3)
2. Focus on mid-cap assets ($100M-$1B market cap)
3. Check liquidity heatmap for best execution venues
4. Monitor price alerts

**Scenario 3: Researcher Finding Trading Opportunities**
1. Browse new listings (last 7 days)
2. Analyze volume trajectory and early adopter activity
3. Check correlation with related sector
4. Save to "Emerging" watchlist for further research

