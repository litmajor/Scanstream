
# API Testing Guide

## Quick Health Check

```bash
# Backend health
curl http://0.0.0.0:3000/api/health

# Expected response:
# {"status":"UP","timestamp":"2025-01-31T..."}
```

## Core Endpoints

### 1. Signals API
```bash
# Get latest signals
curl http://0.0.0.0:3000/api/signals/latest

# Get signals with filters
curl "http://0.0.0.0:3000/api/signals/latest?symbol=BTC/USDT&minConfidence=0.7"

# Get signal quality
curl http://0.0.0.0:3000/api/signals/quality/BTC/USDT
```

### 2. Gateway API
```bash
# Get market data
curl http://0.0.0.0:3000/api/gateway/dataframe/BTC/USDT

# List exchanges
curl http://0.0.0.0:3000/api/gateway/exchanges

# Exchange health
curl http://0.0.0.0:3000/api/gateway/health
```

### 3. ML Engine
```bash
# Get predictions
curl http://0.0.0.0:3000/api/ml/predictions/BTC/USDT

# Get models
curl http://0.0.0.0:3000/api/ml/models

# Model performance
curl http://0.0.0.0:3000/api/model-performance/latest
```

### 4. Strategies
```bash
# List strategies
curl http://0.0.0.0:3000/api/strategies

# Get strategy details
curl http://0.0.0.0:3000/api/strategies/gradient_trend_filter

# Generate consensus
curl -X POST http://0.0.0.0:3000/api/strategies/consensus \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTC/USDT","timeframes":["1h","4h"]}'
```

### 5. Portfolio
```bash
# Get positions
curl http://0.0.0.0:3000/api/trades?status=OPEN

# Portfolio risk
curl http://0.0.0.0:3000/api/portfolio-risk/analysis

# Performance metrics
curl http://0.0.0.0:3000/api/portfolio/performance
```

## Advanced Testing

### Load Testing
```bash
# Install Apache Bench
apt-get install apache2-utils

# Test endpoint
ab -n 1000 -c 10 http://0.0.0.0:3000/api/health
```

### Integration Testing
```javascript
// test/api.test.js
const axios = require('axios');

describe('API Tests', () => {
  const baseURL = 'http://0.0.0.0:3000';
  
  test('Health check returns 200', async () => {
    const res = await axios.get(`${baseURL}/api/health`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('UP');
  });
  
  test('Signals endpoint returns data', async () => {
    const res = await axios.get(`${baseURL}/api/signals/latest`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});
```

### WebSocket Testing
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://0.0.0.0:3000/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket');
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'signals' }));
});

ws.on('message', (data) => {
  console.log('Received:', JSON.parse(data));
});
```

## Performance Benchmarks

### Target Response Times
- Health check: < 10ms
- Signal retrieval: < 100ms
- Market data: < 200ms
- ML predictions: < 500ms
- Backtesting: < 2s

### Testing Script
```bash
#!/bin/bash
# performance-test.sh

echo "Testing API performance..."

# Health check
time curl -s http://0.0.0.0:3000/api/health > /dev/null

# Signals
time curl -s http://0.0.0.0:3000/api/signals/latest > /dev/null

# Market data
time curl -s http://0.0.0.0:3000/api/gateway/dataframe/BTC/USDT > /dev/null

echo "Performance test complete"
```

## Common Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request completed |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Check authentication |
| 404 | Not Found | Verify endpoint URL |
| 429 | Rate Limited | Reduce request frequency |
| 500 | Server Error | Check server logs |
| 503 | Service Unavailable | Service restarting |

## Debugging Failed Requests

```bash
# Verbose curl output
curl -v http://0.0.0.0:3000/api/signals/latest

# With headers
curl -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     http://0.0.0.0:3000/api/signals/latest

# Save response
curl -o response.json http://0.0.0.0:3000/api/signals/latest
```
