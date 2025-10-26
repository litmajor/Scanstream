# CoinGecko Rate Limit Handling

## ⚠️ Problem

CoinGecko's **free tier API** has strict rate limits:
- **10-30 requests per minute per IP address**
- **HTTP 429 (Too Many Requests)** returned when limit exceeded
- **`retry-after` header** indicates wait time in seconds

## 🛠️ Solutions Implemented

### 1. **Backend Service Improvements** (`server/services/coingecko.ts`)

#### a. Increased Cache Duration
```typescript
const CACHE_DURATION_MS = 300000; // 5 minutes (increased from 1 min)
```

#### b. Exponential Backoff Retry Logic
```typescript
private async retryWithBackoff<T>(
  fetcher: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T>
```

- Automatically retries failed requests up to 3 times
- Respects `retry-after` header from CoinGecko
- Uses exponential backoff: 1s, 2s, 4s delays
- Only retries on 429 errors, throws immediately for other errors

#### c. Stale Cache Fallback
```typescript
try {
  const data = await this.retryWithBackoff(() => fetcher());
  this.cache.set(key, { data, timestamp: now });
  return data;
} catch (error) {
  // If rate limited and we have stale cache, return stale data
  if (cached && axios.isAxiosError(error) && error.response?.status === 429) {
    console.warn(`[CoinGecko] Rate limited, returning stale cache for: ${key}`);
    return cached.data as T;
  }
  throw error;
}
```

When rate limited, the service will return stale cached data instead of failing completely.

#### d. Per-Endpoint Cache Tuning
- **Trending Coins**: 10 minutes (changes slowly)
- **Global Market Data**: 10 minutes (macro data)
- **Market Data**: 5 minutes (top coins)
- **Coin Details**: 10 minutes (metadata)
- **OHLC**: 5 minutes (price data)

### 2. **Frontend Query Optimization**

#### a. Reduced Refetch Intervals
All CoinGecko queries now use:
```typescript
{
  refetchInterval: 300000, // 5 minutes (was 1 minute)
  staleTime: 180000,       // 3 minutes
  retry: 2,                // Only retry twice
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
}
```

#### b. Graceful Error Handling
Components now show user-friendly messages when rate limited:

**MarketOverview.tsx**:
```tsx
<Card className="w-full bg-slate-800/40 border-yellow-500/50 backdrop-blur-sm">
  <CardHeader>
    <CardTitle className="text-yellow-400 text-sm">Market Data Temporarily Unavailable</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-xs text-slate-400">
      Rate limit reached. Data will refresh automatically.
    </p>
    <p className="text-xs text-slate-500 mt-1">
      Using cached data where available.
    </p>
  </CardContent>
</Card>
```

**SentimentChart.tsx**:
```tsx
if (error || !sentimentData?.success) {
  return (
    <Card className="w-full bg-transparent border-0">
      <CardContent className="py-4">
        <p className="text-xs text-slate-400 text-center">
          Sentiment data unavailable for {symbol}
        </p>
      </CardContent>
    </Card>
  );
}
```

## 📊 Impact

### Before
- **Refetch Interval**: 60 seconds (60 requests/hour per endpoint)
- **Cache Duration**: 60 seconds
- **Retry Logic**: None (immediate failure)
- **Error Handling**: Components break on 429

### After
- **Refetch Interval**: 300 seconds (12 requests/hour per endpoint)
- **Cache Duration**: 300-600 seconds
- **Retry Logic**: 3 attempts with exponential backoff + stale cache fallback
- **Error Handling**: Graceful degradation with user-friendly messages

### Result
- **~83% reduction** in API calls
- Stale data served during rate limits instead of failure
- Better user experience with clear error messages

## 🚀 Alternative Solutions

### Option 1: CoinGecko Pro API (Paid)
- **Cost**: ~$129-499/month
- **Benefits**:
  - 500-10,000 calls/minute
  - WebSocket support
  - Historical data access
  - Priority support
- **When to Upgrade**: 
  - Production deployment with many users
  - Real-time sentiment crucial for trading decisions

### Option 2: Cache Persistence
Store cache in Redis/database to survive server restarts:
```typescript
// Instead of in-memory Map
private cache: RedisCache;
```

### Option 3: Request Queuing
Implement a request queue with rate limiting:
```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  minTime: 2000, // Min 2 seconds between requests
  maxConcurrent: 1
});
```

### Option 4: Mock Data Fallback
For development, use mock data when rate limited:
```typescript
if (process.env.NODE_ENV === 'development' && error.response?.status === 429) {
  return MOCK_MARKET_DATA;
}
```

## 📝 Best Practices

1. **Always cache aggressively** for slow-changing data (trending, global metrics)
2. **Use `staleTime`** in React Query to prevent unnecessary refetches
3. **Implement graceful degradation** - show stale data rather than errors
4. **Monitor rate limit headers** - CoinGecko returns usage info
5. **Batch requests** when possible (e.g., batch composite score calculations)
6. **Consider upgrading** to Pro tier for production deployments

## 🔍 Monitoring Rate Limits

CoinGecko returns these headers:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1635724800
```

You can log these to track usage:
```typescript
const remaining = response.headers['x-ratelimit-remaining'];
const reset = response.headers['x-ratelimit-reset'];
console.log(`[CoinGecko] Rate limit: ${remaining} remaining, resets at ${new Date(reset * 1000)}`);
```

## ✅ Testing

To test rate limit handling:

1. **Clear cache**: `coinGeckoService.clearCache()`
2. **Rapidly refresh** Market Intelligence page
3. **Observe**: 
   - Console logs show retry attempts
   - UI shows graceful error messages
   - Stale data returned when available

## 📞 Support

If you continue to hit rate limits after these fixes:
1. Check if multiple users/IPs are sharing the same server
2. Verify cache is working (check console logs for cache hits)
3. Consider implementing request queuing
4. Evaluate upgrading to CoinGecko Pro

---

**Documentation Updated**: October 25, 2025

