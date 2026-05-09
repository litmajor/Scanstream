# CoinGecko Integration - Quick Start 🚀

## 30-Second Setup

### 1. Start Your Server
```bash
npm run dev
```

### 2. Test the Integration
```bash
python test_coingecko_integration.py
```

### 3. Use Enhanced Scoring
```bash
curl -X POST http://localhost:3000/api/analytics/composite-score \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "rsi": 35,
    "macd": 0.5,
    "volumeRatio": 2.3,
    "priceChange24h": 3.2,
    "momentum": 0.6,
    "includeSentiment": true
  }'
```

Done! 🎉

## What You Just Got

### 8 New Endpoints

1. **Market Data**: `/api/coingecko/markets`
2. **Trending**: `/api/coingecko/trending`
3. **Global Metrics**: `/api/coingecko/global`
4. **Sentiment**: `/api/coingecko/sentiment/:symbol`
5. **Market Regime**: `/api/coingecko/regime`
6. **Composite Score**: `/api/analytics/composite-score`
7. **Batch Score**: `/api/analytics/batch-composite-score`
8. **Market Overview**: `/api/analytics/market-overview`

### Key Features

✅ **Sentiment Analysis** (0-100 score per symbol)
✅ **Market Regime Detection** (bull/bear/neutral/volatile)
✅ **Enhanced Composite Scoring** (technical + sentiment + regime)
✅ **Trending Coins** (social sentiment tracking)
✅ **Global Market Context** (BTC dominance, total mcap)

## 3 Most Useful Endpoints

### 1. Get Sentiment for Any Symbol

```bash
curl http://localhost:3000/api/coingecko/sentiment/BTC
```

**Response:**
```json
{
  "sentimentScore": 75,
  "interpretation": "bullish"
}
```

### 2. Enhanced Composite Score

```bash
curl -X POST http://localhost:3000/api/analytics/composite-score \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "rsi": 35,
    "includeSentiment": true
  }'
```

**Response:**
```json
{
  "compositeScore": 78.5,
  "recommendation": "strong_buy",
  "breakdown": {
    "technical": {"score": 75, "contribution": 37.5},
    "sentiment": {"score": 82, "contribution": 24.6},
    "marketRegime": {"score": 75, "contribution": 15}
  }
}
```

### 3. Market Overview Dashboard

```bash
curl http://localhost:3000/api/analytics/market-overview
```

**Response:**
```json
{
  "global": {
    "totalMarketCap": 2574000000000,
    "btcDominance": 52.4
  },
  "regime": {
    "current": "bull",
    "confidence": 75
  },
  "trending": [...]
}
```

## Python Integration

### Example 1: Enhance Your Scanner

```python
import requests

def enhance_signal(symbol, technical_data):
    response = requests.post(
        'http://localhost:3000/api/analytics/composite-score',
        json={
            'symbol': symbol,
            **technical_data,
            'includeSentiment': True
        }
    )
    
    return response.json()

# Use it
result = enhance_signal('BTC/USDT', {
    'rsi': 35,
    'macd': 0.5,
    'volumeRatio': 2.3
})

print(f"Score: {result['compositeScore']}")
print(f"Recommendation: {result['recommendation']}")
```

### Example 2: Batch Process Multiple Symbols

```python
import requests

symbols = [
    {'symbol': 'BTC/USDT', 'rsi': 35, 'macd': 0.5},
    {'symbol': 'ETH/USDT', 'rsi': 45, 'macd': -0.2},
    {'symbol': 'SOL/USDT', 'rsi': 75, 'macd': -0.8}
]

response = requests.post(
    'http://localhost:3000/api/analytics/batch-composite-score',
    json={'symbols': symbols, 'includeSentiment': True}
)

results = response.json()['results']

# Sort by score
top_signals = sorted(results, key=lambda x: x['compositeScore'], reverse=True)

for signal in top_signals[:3]:
    print(f"{signal['symbol']}: {signal['compositeScore']:.1f} ({signal['recommendation']})")
```

## JavaScript/TypeScript Integration

```typescript
// Fetch market overview
const overview = await fetch('http://localhost:3000/api/analytics/market-overview')
  .then(res => res.json());

console.log(`Market: ${overview.regime.current}`);
console.log(`BTC Dominance: ${overview.global.btcDominance}%`);

// Calculate composite score
const score = await fetch('http://localhost:3000/api/analytics/composite-score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol: 'BTC/USDT',
    rsi: 35,
    includeSentiment: true
  })
}).then(res => res.json());

console.log(`Score: ${score.compositeScore}`);
console.log(`Recommendation: ${score.recommendation}`);
```

## Common Use Cases

### Use Case 1: Filter Scanner Results

```python
# Get scanner results
scanner_results = get_scanner_results()

# Enhance with sentiment
for signal in scanner_results:
    sentiment = requests.get(
        f'http://localhost:3000/api/coingecko/sentiment/{signal["symbol"]}'
    ).json()
    
    signal['sentiment'] = sentiment['sentimentScore']

# Filter by sentiment
high_sentiment = [s for s in scanner_results if s['sentiment'] > 70]
```

### Use Case 2: Market Timing

```python
# Check market regime before trading
regime = requests.get('http://localhost:3000/api/coingecko/regime').json()

if regime['regime'] == 'bear':
    print("⚠️ Bearish regime - reduce position sizes")
elif regime['regime'] == 'bull':
    print("✅ Bullish regime - favorable for longs")
```

### Use Case 3: Trending Opportunities

```python
# Get trending coins
trending = requests.get('http://localhost:3000/api/coingecko/trending').json()

# Cross-reference with scanner
for coin in trending['data'][:5]:
    symbol = f"{coin['item']['symbol'].upper()}/USDT"
    print(f"Checking trending coin: {symbol}")
    # Run your scanner on this symbol
```

## Performance Tips

### 1. Use Batch Endpoint
❌ Don't: Call composite-score 100 times
✅ Do: Use batch-composite-score once with 100 symbols

### 2. Leverage Caching
- Data is cached for 1-5 minutes
- Multiple calls within TTL are instant
- Cache is managed automatically

### 3. Parallel Requests
```python
import asyncio
import aiohttp

async def get_sentiments(symbols):
    async with aiohttp.ClientSession() as session:
        tasks = [
            session.get(f'http://localhost:3000/api/coingecko/sentiment/{s}')
            for s in symbols
        ]
        responses = await asyncio.gather(*tasks)
        return [await r.json() for r in responses]
```

## Troubleshooting

### Issue: "Failed to fetch"
**Solution**: Make sure server is running
```bash
npm run dev
```

### Issue: Rate limit errors
**Solution**: CoinGecko has 10-30 req/min limit
- Use caching (built-in)
- Use batch endpoints
- Wait between calls if needed

### Issue: Symbol not found
**Solution**: Use exchange-formatted symbols
- ✅ "BTC/USDT", "ETH/USDT"
- ❌ "BTCUSDT", "Bitcoin"

## Next Steps

1. **Read Full Docs**: [COINGECKO_INTEGRATION.md](COINGECKO_INTEGRATION.md)
2. **Run Tests**: `python test_coingecko_integration.py`
3. **Integrate with Scanner**: Add sentiment to your pipeline
4. **Build UI**: Show sentiment scores and regime
5. **Optimize Weights**: Tune technical/sentiment/regime weights

## Quick Reference

### Sentiment Score Meaning
- **0-30**: Bearish 🔴
- **30-70**: Neutral ⚪
- **70-100**: Bullish 🟢

### Market Regimes
- **bull** 🚀: Alt season, high risk-on
- **bear** 🐻: Risk-off, BTC flight
- **volatile** ⚡: High volume, opportunities
- **neutral** 😐: Normal conditions

### Composite Score Weights
Default:
- Technical: 50%
- Sentiment: 30%
- Market Regime: 20%

Customize based on your strategy!

## Attribution

Remember to display in your UI:
```
"Data provided by CoinGecko (coingecko.com)"
```

---

**That's it! You're ready to use CoinGecko data in your trading intelligence. 🎉**

For detailed documentation, see [COINGECKO_INTEGRATION.md](COINGECKO_INTEGRATION.md)

