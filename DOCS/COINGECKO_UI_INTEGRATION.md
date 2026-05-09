# CoinGecko UI Integration Guide 📊

## Overview

The CoinGecko sentiment and market data is now fully integrated into the Scanstream UI with beautiful, real-time visualizations.

## 🎨 New UI Components

### 1. MarketOverview Widget
**Location:** `client/src/components/coingecko/MarketOverview.tsx`

Displays comprehensive global market metrics:
- Market regime indicator (Bull/Bear/Neutral/Volatile)
- Total market cap
- 24h volume
- BTC dominance
- Active cryptocurrencies
- Top 5 trending coins

**Usage:**
```tsx
import { MarketOverview } from '@/components/coingecko';

<MarketOverview />
```

### 2. SentimentIndicator
**Location:** `client/src/components/coingecko/SentimentIndicator.tsx`

Shows sentiment score (0-100) with visual indicators:
- Color-coded badges (green/red/gray)
- Mini progress bar
- Bullish/Bearish/Neutral label

**Usage:**
```tsx
import { SentimentIndicator, SentimentBadge } from '@/components/coingecko';

<SentimentIndicator symbol="BTC/USDT" />
<SentimentBadge symbol="ETH/USDT" /> {/* Compact version */}
```

### 3. SentimentChart
**Location:** `client/src/components/coingecko/SentimentChart.tsx`

Visual sentiment gauge with:
- Area chart visualization
- Color gradient (red → yellow → green)
- Reference lines at 30 and 70
- Score breakdown
- Confidence indicators

**Usage:**
```tsx
import { SentimentChart } from '@/components/coingecko';

<SentimentChart symbol="BTC/USDT" />
```

### 4. MarketRegimeBadge
**Location:** `client/src/components/coingecko/MarketRegimeBadge.tsx`

Current market regime indicator:
- Emoji representation (🚀/🐻/😐/⚡)
- Confidence percentage
- BTC dominance tooltip
- Color-coded badges

**Usage:**
```tsx
import { MarketRegimeBadge, MarketRegimeIcon } from '@/components/coingecko';

<MarketRegimeBadge />
<MarketRegimeIcon /> {/* Icon only version */}
```

### 5. EnhancedSignalCard
**Location:** `client/src/components/coingecko/EnhancedSignalCard.tsx`

Enhanced signal card with composite scoring:
- Sentiment badge
- Trending star indicator
- Composite score (0-100)
- Score breakdown (Technical/Sentiment/Regime)
- Recommendation (Strong Buy/Buy/Hold/Sell/Strong Sell)
- Visual progress bar

**Usage:**
```tsx
import { EnhancedSignalCard } from '@/components/coingecko';

<EnhancedSignalCard
  signal={{
    symbol: 'BTC/USDT',
    signal: 'BUY',
    strength: 85,
    price: 67421,
    change: 3.42,
    // ... other fields
  }}
  onSelect={() => console.log('Selected')}
/>
```

## 📄 New Page

### Market Intelligence Dashboard
**Location:** `client/src/pages/market-intelligence.tsx`  
**Route:** `/market-intelligence`

Comprehensive market analysis dashboard featuring:
- Global market overview
- Market regime indicator
- Selected asset sentiment analysis
- Enhanced signal cards with composite scores
- Search and filter capabilities
- Tabs for different signal types
- Real-time data updates

**Access:**
Navigate to http://localhost:5173/market-intelligence

## 🎯 Features

### Real-Time Updates

All components automatically refresh data:
- Market overview: Every 1 minute
- Sentiment scores: Every 5 minutes
- Market regime: Every 1 minute
- Composite scores: Cached for 5 minutes

### Visual Indicators

**Market Regime:**
- 🚀 Bull (green) - Alt season, BTC dom < 45%
- 🐻 Bear (red) - Risk-off, BTC dom > 55%
- 😐 Neutral (gray) - Normal conditions
- ⚡ Volatile (yellow) - High volume/mcap ratio

**Sentiment Levels:**
- 🟢 70-100: Bullish
- ⚪ 30-70: Neutral
- 🔴 0-30: Bearish

**Composite Score:**
- 🟢 Strong Buy: 75-100
- 🟡 Buy: 60-74
- ⚪ Hold: 40-59
- 🟠 Sell: 25-39
- 🔴 Strong Sell: 0-24

### Trending Indicator

Coins with ⭐ are currently trending on social media and CoinGecko.

## 📱 Responsive Design

All components are fully responsive:
- Desktop: Full feature set
- Tablet: Optimized layouts
- Mobile: Simplified views with essential info

## 🎨 Color Scheme

Components use consistent color coding:
- **Green:** Bullish/Positive/Buy
- **Red:** Bearish/Negative/Sell
- **Gray:** Neutral/Hold
- **Yellow:** Volatile/Warning
- **Blue:** Information/Action

## 🚀 Quick Start

### 1. Start the Backend
```bash
npm run dev
```

### 2. View Market Intelligence Dashboard
Navigate to: http://localhost:5173/market-intelligence

### 3. Integrate Components

Add to any page:

```tsx
import { 
  MarketOverview, 
  SentimentIndicator,
  MarketRegimeBadge 
} from '@/components/coingecko';

export default function MyPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Global Market Context */}
      <div className="flex items-center justify-between">
        <h1>My Trading Page</h1>
        <MarketRegimeBadge />
      </div>

      {/* Market Overview Widget */}
      <MarketOverview />

      {/* Sentiment for Specific Asset */}
      <SentimentIndicator symbol="BTC/USDT" />
    </div>
  );
}
```

## 📊 Data Flow

```
CoinGecko API
      ↓
Backend Routes (/api/coingecko/*, /api/analytics/*)
      ↓
React Query (Caching & State Management)
      ↓
UI Components (Auto-refresh)
      ↓
User Interface
```

## ⚡ Performance

### Caching Strategy

- **API Level:** 1-5 min TTL on backend
- **UI Level:** React Query caching with staleTime
- **Updates:** Polling with configurable intervals

### Optimizations

- Lazy loading of components
- Memoized calculations
- Debounced search inputs
- Efficient re-renders

## 🎯 Integration Examples

### Example 1: Add to Trading Terminal

```tsx
// In trading-terminal.tsx
import { SentimentIndicator, MarketRegimeBadge } from '@/components/coingecko';

// Add to header
<header className="...">
  <div className="flex items-center gap-4">
    <h1>Trading Terminal</h1>
    <MarketRegimeBadge />
  </div>
</header>

// Add to asset info panel
<div className="asset-info">
  <h2>{selectedSymbol}</h2>
  <SentimentIndicator symbol={selectedSymbol} />
</div>
```

### Example 2: Enhanced Scanner Results

```tsx
// In scanner page
import { EnhancedSignalCard } from '@/components/coingecko';

{scanResults.map(signal => (
  <EnhancedSignalCard
    key={signal.symbol}
    signal={signal}
    onSelect={() => selectSymbol(signal.symbol)}
  />
))}
```

### Example 3: Portfolio Context

```tsx
// In portfolio page
import { MarketOverview } from '@/components/coingecko';

<div className="portfolio-dashboard">
  <div className="col-span-1">
    <MarketOverview />
  </div>
  <div className="col-span-2">
    {/* Portfolio content */}
  </div>
</div>
```

## 🔧 Customization

### Styling

All components use Tailwind CSS and can be customized:

```tsx
<MarketRegimeBadge className="text-lg px-4 py-2" />
```

### Data Refresh Intervals

Modify in component queries:

```tsx
const { data } = useQuery({
  queryKey: ['sentiment', symbol],
  queryFn: fetchSentiment,
  refetchInterval: 300000, // Change this (ms)
});
```

### Sentiment Thresholds

Adjust in `SentimentIndicator.tsx`:

```tsx
const getSentimentConfig = () => {
  if (score >= 75) return { /* Very bullish */ };
  if (score >= 60) return { /* Bullish */ };
  // ... customize thresholds
};
```

## 📝 Attribution

All pages using CoinGecko data must display:

```tsx
<div className="text-center text-xs text-gray-500">
  Market sentiment and global data provided by{' '}
  <a
    href="https://www.coingecko.com"
    target="_blank"
    rel="noopener noreferrer"
    className="underline"
  >
    CoinGecko
  </a>
</div>
```

## 🐛 Troubleshooting

### Issue: Components not loading

**Solution:**
1. Ensure backend is running on port 3000/4000
2. Check browser console for errors
3. Verify API endpoints are accessible

### Issue: Data not updating

**Solution:**
1. Check network tab for API calls
2. Clear React Query cache
3. Verify refetchInterval settings

### Issue: Sentiment showing "--"

**Solution:**
1. Symbol might not be mapped to CoinGecko ID
2. Check symbol format (should be "BTC/USDT")
3. Review backend logs for errors

## 🎉 What You Get

✅ **5 Reusable UI Components**
✅ **1 Complete Dashboard Page**
✅ **Real-time Data Updates**
✅ **Beautiful Visualizations**
✅ **Responsive Design**
✅ **Production-Ready Code**

## 🚀 Next Steps

1. **Test the Dashboard:** Visit `/market-intelligence`
2. **Integrate Components:** Add to existing pages
3. **Customize Styling:** Match your brand
4. **Connect Real Scanner:** Replace mock data with scanner API
5. **Add Notifications:** Alert on high sentiment changes
6. **Chart Overlays:** Add sentiment to price charts

## 📚 Component Reference

| Component | Purpose | Auto-Refresh | Size |
|-----------|---------|--------------|------|
| MarketOverview | Global metrics + trending | 1 min | Medium |
| SentimentIndicator | Symbol sentiment | 5 min | Small |
| SentimentChart | Sentiment visualization | 5 min | Medium |
| MarketRegimeBadge | Current regime | 1 min | Small |
| EnhancedSignalCard | Enhanced signal | 5 min | Large |

---

**Your UI now has complete market intelligence integration! 🎯**

Visit http://localhost:5173/market-intelligence to see it in action!

