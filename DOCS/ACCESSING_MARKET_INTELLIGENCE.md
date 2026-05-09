# Accessing the Market Intelligence Dashboard

## 🎯 Quick Access

### Option 1: Direct URL
Navigate to:
```
http://localhost:5173/market-intelligence
```

### Option 2: From Navigation
If you have a navigation menu in your app, add a link to `/market-intelligence`

## 🖼️ What You'll See

The Market Intelligence page includes:

### 1. **Market Overview Card** (Left Side)
- Global market metrics (market cap, volume)
- BTC dominance indicator
- Current market regime (Bull/Bear/Neutral/Volatile)
- Top 5 trending coins

### 2. **Sentiment Analysis Chart** (Right Side)
- Real-time sentiment score (0-100)
- Visual gauge chart showing bearish/neutral/bullish zones
- Social sentiment breakdown
- Confidence level indicator

### 3. **Enhanced Signals Grid** (Bottom)
- Trading signals with composite scores
- Tabs for filtering: All/Buy/Sell/Trending
- Search functionality
- Click any signal card to view detailed sentiment

## 🔧 Current Status

### Rate Limiting
CoinGecko's free API has strict limits (10-30 requests/minute). The app now:
- ✅ Caches data for 5-10 minutes
- ✅ Shows cached data when rate limited
- ✅ Displays user-friendly messages during downtime
- ✅ Automatically retries with exponential backoff

### Expected Behavior

**First Load**:
- May show "Loading..." briefly
- If rate limited, displays: *"Rate limit reached. Data will refresh automatically."*
- Falls back to cached data when available

**After 5 Minutes**:
- Data refreshes automatically
- Fresh market metrics and sentiment scores

**During Rate Limit**:
- Yellow warning card: *"Market Data Temporarily Unavailable"*
- Stale cached data displayed
- All features remain functional

## 🚦 Testing

### 1. Check if Backend is Running
```bash
# Terminal 1: Backend server (port 3000)
cd server
npm run dev
```

### 2. Check if Frontend is Running
```bash
# Terminal 2: Frontend dev server (port 5173)
npm run dev
```

### 3. Navigate to Page
Open browser:
```
http://localhost:5173/market-intelligence
```

### 4. Open Developer Console
Press `F12` and check for:
- ✅ `[CoinGecko] Cache hit: ...` (data is cached)
- ✅ `[CoinGecko] Cache miss, fetching: ...` (fetching new data)
- ⚠️ `[CoinGecko] Rate limited (429)` (hit rate limit, will retry)

## 📊 Mock Data vs Real Data

Currently, the **scanner signals** in the dashboard use **mock data** (lines 42-81 in `market-intelligence.tsx`):

```typescript
signals: [
  {
    symbol: 'BTC/USDT',
    signal: 'BUY',
    strength: 85,
    // ... mock indicators
  }
]
```

### To Connect Real Scanner Data

Replace the mock `queryFn` with your actual scanner API:

```typescript
const { data: signals } = useQuery<{ signals: Signal[] }>({
  queryKey: ['scanner-signals'],
  queryFn: async () => {
    const response = await fetch('http://localhost:5001/api/scanner/latest-signals');
    if (!response.ok) throw new Error('Failed to fetch signals');
    return response.json();
  },
  refetchInterval: 60000,
});
```

## 🔗 Integration Points

### Backend Endpoints Used
- `GET /api/analytics/market-overview` - Global market metrics
- `GET /api/coingecko/sentiment/:symbol` - Per-symbol sentiment
- `GET /api/coingecko/regime` - Market regime detection

### Frontend Components
- `MarketOverview.tsx` - Global metrics card
- `SentimentChart.tsx` - Sentiment gauge chart
- `MarketRegimeBadge.tsx` - Bull/Bear indicator
- `EnhancedSignalCard.tsx` - Trading signal cards

## 🛠️ Troubleshooting

### Issue: "Market Data Temporarily Unavailable"
**Cause**: Rate limit exceeded  
**Solution**: Wait 1-2 minutes, data will auto-refresh

### Issue: Blank page or 404
**Cause**: Frontend not running or wrong URL  
**Solution**: 
1. Check `npm run dev` is running (port 5173)
2. Verify route is registered in `App.tsx`
3. Clear browser cache and reload

### Issue: No sentiment data for symbols
**Cause**: Symbol not recognized by CoinGecko  
**Solution**: 
- Use major pairs (BTC/USDT, ETH/USDT, SOL/USDT)
- Check `symbolToCoinId` mapping in `coingecko.ts`
- Add custom mappings if needed

### Issue: Console errors about CORS
**Cause**: Backend not running or wrong port  
**Solution**:
1. Verify backend is on port 3000
2. Check proxy settings in `vite.config.ts`

## 📈 Performance Tips

1. **Keep Browser Tab Active**: React Query pauses refetching on inactive tabs
2. **Monitor Console**: Look for excessive API calls
3. **Use Browser DevTools Network Tab**: Verify cache headers
4. **Clear Cache**: Call `coinGeckoService.clearCache()` in backend to reset

## ✨ Next Steps

1. **Connect real scanner signals** (replace mock data)
2. **Add navigation link** to Market Intelligence page
3. **Customize cache durations** per your trading frequency
4. **Consider CoinGecko Pro** for production ($129/mo for higher limits)
5. **Add WebSocket updates** for real-time sentiment changes

---

**Last Updated**: October 25, 2025

