# Symbol Universe - Quick Start Guide

## 🚀 Accessing Symbol Universe

### From the Sidebar
1. **Navigate** to the left sidebar
2. **Look for "Tools" section** (below Portfolio)
3. **Click "Symbol Universe"** button

### Direct URL
- Go to: `http://localhost:5000/symbol-universe` (or your deployment URL)

---

## 📋 Main Features

### 1. Symbol Discovery Tab
**Default View** - Search and browse symbols

#### Search
- Type symbol name in search bar at top (e.g., "Bitcoin", "BTC")
- Real-time search results

#### Filter Options
- **Exchange**: Binance, Coinbase, Kraken, OKX, Bybit, KuCoin
- **Asset Class**: Spot, Futures, Perpetual Swaps
- **Market Cap**: All, Mega (>$1T), Large (>$100B), Mid (>$10B), Small (<$10B)
- **Min 24h Volume**: Custom dollar amount
- **Min Liquidity**: Slider 0-100
- **Volatility Range**: Slider for price volatility

#### View Modes
- **Table View**: 8 columns (Symbol, Price, 24h Change, Volume, Market Cap, Liquidity, Spread, Actions)
- **Grid View**: Card layout with visual indicators

#### Symbol Actions
- **Star Icon**: Add/remove from watchlist
- **Info Icon**: View detailed symbol information
- **Trade Icon**: Quick access to trading terminal

---

### 2. Liquidity Heatmap Tab
**Market Microstructure Analysis**

Shows which exchanges have best liquidity for each symbol:
- **Rows**: Different symbols
- **Columns**: 6 major exchanges
- **Color**: 4-tier liquidity scale
  - 🟢 Green: Excellent liquidity (80+)
  - 🟡 Amber: Good liquidity (60-80)
  - 🔴 Red: Fair liquidity (40-60)
  - ⚪ Gray: Not available

**Use Case**: Find best execution venue to minimize slippage

---

### 3. Correlation Matrix Tab
**Portfolio Diversification Analysis**

Shows correlation between selected symbols:
- **Interactive Grid**: Click symbols to add/remove from analysis
- **Color Coding**:
  - 🟢 Green: Strong positive correlation (>0.7)
  - 🟡 Amber: Moderate positive (0.3-0.7)
  - ⚪ Gray: Weak correlation (-0.3 to 0.3)
  - 🔴 Red: Negative correlation (<-0.3)

**Insights Provided**:
- Diversification recommendations
- Hedging opportunities
- Momentum correlations

**Use Case**: Build diversified portfolio and identify hedges

---

### 4. Volume Profile Tab
**Volume Distribution Analysis**

Three views available:

#### Profile View
- Volume at each price level
- Buy volume (green) vs Sell volume (red)
- Identifies key support/resistance areas

#### History View
- Time-series volume chart
- Selectable timeframes: 1H, 4H, 1D, 1W
- Peak/average/min volume statistics

#### Anomalies View
- Detects unusual volume spikes (statistical outliers)
- Shows standard deviation from average
- Lists most recent anomalies

**Use Case**: Identify volume accumulation zones and spot unusual trading activity

---

### 5. Watchlists Tab
**Organize Your Trading Universe**

#### Create Watchlist
1. Click ➕ button in watchlist panel
2. Enter watchlist name
3. Click "Create"

#### Manage Watchlist
- **Edit Name**: Click pencil icon
- **Add Symbols**: From symbol table, click star icon
- **Remove Symbols**: Click ✕ on symbol card
- **Delete Watchlist**: Click trash icon (with confirmation)
- **Share**: Click share icon to copy shareable URL

#### View Options
- Select watchlist from left panel
- View all symbols in center panel
- See total symbol count

**Use Case**: Organize symbols by trading strategy or market segment

---

## 💡 Usage Tips

### Finding the Right Symbols
1. Start with **Symbol Discovery** tab
2. Use filters to narrow down candidates
3. View **Market Cap** to understand scale
4. Check **Volume** to ensure liquidity

### Analyzing Trading Universe
1. Create **Watchlist** for your trading strategy
2. Check **Liquidity Heatmap** for execution venues
3. Review **Correlation Matrix** for risk management
4. Monitor **Volume Profile** for entry opportunities

### Quick Trading
1. Find symbol in search
2. Click info icon to view details
3. Click trade icon to open trading terminal
4. Execute trade with complete market information

---

## ⚙️ Filter Examples

### Conservative Portfolio
- Market Cap: Large (>$100B)
- Min Volume: $500M
- Min Liquidity: 80+
- Volatility: 0-30%

### High Volume Trader
- Asset Class: Spot
- Min Volume: $10B+
- Min Liquidity: 70+
- Volatility: Any

### Emerging Assets
- Market Cap: Small (<$10B)
- Min Volume: $100M
- Min Liquidity: 40+
- Volatility: 30%+

### Arbitrage Opportunities
- Check **Liquidity Heatmap** for exchange differences
- Use **Correlation** to find pairs

---

## 🔄 Real-time Updates

The dashboard is ready for real-time updates:
- Price updates via WebSocket
- Volume refreshes every 30 seconds
- Correlation updates on demand

(Requires backend API integration)

---

## 📱 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open search (when implemented) |
| `Esc` | Close details panel |
| `↵ Enter` | Create watchlist (from dialog) |

---

## ❓ FAQ

**Q: How do I add a symbol to a watchlist?**
A: Click the star icon (⭐) next to any symbol in the Symbol Discovery tab.

**Q: Can I compare multiple symbols' correlations?**
A: Yes! In the Correlation Matrix tab, click on symbol names to toggle which ones to include (up to 15).

**Q: What does the liquidity score mean?**
A: 0-100 scale where 100 = highest liquidity on that exchange. Higher = tighter spreads and easier execution.

**Q: How often are the heatmap colors updated?**
A: Currently showing mock data. With backend integration, will update in real-time.

**Q: Can I export my watchlist?**
A: Currently can share via URL. Export feature coming soon!

---

## 🐛 Troubleshooting

**Symbols not appearing?**
- Check filter settings aren't too restrictive
- Refresh the page
- Ensure you have internet connectivity

**Details panel won't open?**
- Click symbol row again to toggle
- Check browser console for errors

**Watchlist not saving?**
- Currently stores in browser session memory
- Will persist to database once backend integration complete

---

## 📞 Support

For issues or feature requests, contact the development team or check the project documentation.

**Happy trading! 🚀**
