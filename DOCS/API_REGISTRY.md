# API Registry & Documentation System

Complete API endpoint documentation, tracking, and monitoring system for Scanstream.

## Features

✅ **Comprehensive Endpoint Documentation**
- Full endpoint details (method, path, description, parameters)
- Request/response schemas
- Authentication requirements
- Rate limiting info
- Deprecation tracking

✅ **Real-time Usage Tracking**
- Request counts per endpoint
- Success/failure rates
- Response latency metrics
- Error tracking and debugging
- Hourly request volume

✅ **Performance Monitoring**
- Detect slow endpoints (>1s latency)
- Identify unhealthy endpoints (high error rates)
- Performance timeline (requests per hour)
- Overall API health status

✅ **Documentation Export**
- OpenAPI/Swagger format
- Markdown documentation
- Easy integration with API documentation tools

✅ **Admin Dashboard Ready**
- Comprehensive statistics
- Health status monitoring
- Usage trends
- Performance analytics

## Setup & Integration

### 1. Register Endpoints

In your main server file (`server/index.ts`), register all endpoints:

```typescript
import { apiRegistry } from './services/api-registry';
import { setupAPITracking } from './middleware/api-tracker';

// Initialize app
const app = express();

// Install tracking middleware (must be early)
setupAPITracking(app);

// Register all API endpoints with documentation
apiRegistry.registerEndpoints([
  {
    method: 'POST',
    path: '/api/backtest/run',
    category: 'BACKTEST',
    name: 'Run Backtest',
    description: 'Execute a backtest with specified parameters',
    version: 'v1',
    tags: ['backtest', 'core'],
    isActive: true,
    isDeprecated: false,
    authentication: 'JWT',
    cacheable: false,
    timeout: 300000,
    queryParams: [
      {
        name: 'symbol',
        type: 'string',
        required: true,
        description: 'Trading pair (e.g., BTC/USDT)',
        example: 'BTC/USDT'
      }
    ],
    bodySchema: {
      type: 'object',
      properties: {
        strategy: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      },
      required: ['strategy'],
      example: {
        strategy: 'momentum',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }
    },
    responseSchema: [
      {
        status: 200,
        description: 'Backtest completed successfully',
        schema: { type: 'object' },
        example: { backtest_id: 'bt-123', status: 'completed' }
      }
    ]
  },
  // ... more endpoints
]);

// Mount documentation routes
import apiDocsRouter from './routes/api-docs';
app.use('/api/docs', apiDocsRouter);
```

### 2. Documentation Endpoints

Once registered and integrated, access documentation at:

#### View All Endpoints
```
GET /api/docs/endpoints
GET /api/docs/endpoints?category=BACKTEST
GET /api/docs/endpoints?tag=core
```

Response:
```json
{
  "total": 5,
  "endpoints": [
    {
      "id": "POST:/api/backtest/run",
      "method": "POST",
      "path": "/api/backtest/run",
      "name": "Run Backtest",
      "category": "BACKTEST",
      "isActive": true,
      "isDeprecated": false,
      "tags": ["backtest", "core"]
    }
  ]
}
```

#### Get Endpoint Details
```
GET /api/docs/endpoints/POST/api/backtest/run
```

#### API Statistics
```
GET /api/docs/stats
```

Response:
```json
{
  "summary": {
    "totalEndpoints": 45,
    "activeEndpoints": 43,
    "deprecatedEndpoints": 2,
    "totalRequests": 125000,
    "totalErrors": 250,
    "errorRate": 0.2,
    "avgUptime": 99.8,
    "avgLatency": 145.32
  },
  "byCategory": {
    "BACKTEST": 8,
    "SIGNAL": 12,
    "TRADING": 10,
    ...
  },
  "topEndpoints": [
    {
      "path": "/api/backtest/run",
      "method": "POST",
      "requests": 15000,
      "avgLatency": 2340,
      "uptime": 99.9
    }
  ]
}
```

#### Health Status
```
GET /api/docs/health
```

Response:
```json
{
  "timestamp": "2025-12-22T10:30:00Z",
  "overallHealth": "HEALTHY",
  "endpoints": [
    {
      "path": "/api/backtest/run",
      "method": "POST",
      "category": "BACKTEST",
      "status": "ACTIVE",
      "health": "EXCELLENT",
      "metrics": {
        "requests": 15000,
        "uptime": 99.9,
        "avgLatency": 2340,
        "lastCalled": "2025-12-22T10:29:55Z",
        "lastError": null
      }
    }
  ]
}
```

#### Performance Analytics
```
GET /api/docs/performance?hours=24
```

Response:
```json
{
  "timeline": [
    {
      "hour": "2025-12-22T00:00:00Z",
      "requestCount": 150,
      "errorCount": 2,
      "avgLatency": 123
    }
  ],
  "slowEndpoints": [
    {
      "path": "/api/backtest/run",
      "method": "POST",
      "avgLatencyMs": 2340,
      "maxLatencyMs": 5600,
      "requestCount": 15000
    }
  ],
  "unhealthyEndpoints": []
}
```

#### Export OpenAPI/Swagger
```
GET /api/docs/openapi
GET /api/docs/openapi?format=yaml
```

#### Export Markdown
```
GET /api/docs/markdown
```

#### Summary Dashboard
```
GET /api/docs/summary
```

Response:
```json
{
  "timestamp": "2025-12-22T10:30:00Z",
  "overview": {
    "totalEndpoints": 45,
    "activeEndpoints": 43,
    "totalRequests": 125000,
    "errorRate": "0.20%",
    "avgLatency": "145ms",
    "avgUptime": "99.80%"
  },
  "health": {
    "overallStatus": "HEALTHY",
    "slowEndpoints": 2,
    "unhealthyEndpoints": 0
  },
  "topEndpoints": [
    {
      "path": "/api/backtest/run",
      "method": "POST",
      "requests": 15000,
      "avgLatency": 2340,
      "uptime": 99.9
    }
  ]
}
```

## API Endpoint Categories

| Category | Purpose |
|----------|---------|
| **CORE** | Core API functionality |
| **BACKTEST** | Backtesting engine endpoints |
| **SIGNAL** | Signal generation & tracking |
| **TRADING** | Trade execution & management |
| **STRATEGY** | Strategy configuration & deployment |
| **AGENT** | AI agent endpoints |
| **ANALYTICS** | Reporting & analytics |
| **SCOUT** | Scout report generation |
| **FEATURE_FLAGS** | Feature flag management |
| **ADMIN** | Administrative endpoints |

## Metrics Captured

For each endpoint, the system tracks:

- **Request Metrics**
  - Total requests
  - Successful requests
  - Failed requests
  - Error rate

- **Performance Metrics**
  - Average latency
  - Max latency
  - Min latency
  - Requests per hour

- **Availability**
  - Uptime percentage
  - Last called timestamp
  - Last error info

## Usage Examples

### Register a New Endpoint

```typescript
apiRegistry.registerEndpoint({
  method: 'GET',
  path: '/api/signals',
  category: 'SIGNAL',
  name: 'List Signals',
  description: 'Retrieve all generated signals',
  version: 'v1',
  tags: ['signal', 'query'],
  isActive: true,
  isDeprecated: false,
  queryParams: [
    {
      name: 'symbol',
      type: 'string',
      required: false,
      description: 'Filter by trading symbol'
    }
  ],
  responseSchema: [{
    status: 200,
    description: 'List of signals',
    schema: { type: 'array' }
  }]
});
```

### Deprecate an Endpoint

```typescript
apiRegistry.deprecateEndpoint(
  'GET',
  '/api/old-signals',
  'This endpoint is no longer supported',
  '/api/signals'
);
```

### Update Endpoint Documentation

```typescript
apiRegistry.updateEndpoint('GET', '/api/signals', {
  description: 'Enhanced signal retrieval with filtering',
  queryParams: [
    {
      name: 'symbol',
      type: 'string',
      required: false,
      description: 'Filter by trading symbol'
    },
    {
      name: 'limit',
      type: 'integer',
      required: false,
      description: 'Max results to return'
    }
  ]
});
```

### Get Slow Endpoints

```typescript
const slowEndpoints = apiRegistry.getSlowEndpoints(1000);
slowEndpoints.forEach(ep => {
  console.log(`${ep.method} ${ep.path} - ${ep.metrics.averageLatencyMs}ms avg`);
});
```

### Get Unhealthy Endpoints

```typescript
const unhealthy = apiRegistry.getUnhealthyEndpoints(0.05); // 5% error threshold
unhealthy.forEach(ep => {
  console.log(`${ep.method} ${ep.path} - ${(ep.metrics.failedRequests / ep.metrics.totalRequests * 100).toFixed(1)}% error rate`);
});
```

## Monitoring & Alerts

### Integration with Admin Dashboard

The stats/health endpoints can be polled to build a real-time dashboard:

```typescript
// Dashboard could poll every 30 seconds
const stats = await fetch('/api/docs/stats').then(r => r.json());
const health = await fetch('/api/docs/health').then(r => r.json());

// Display alerts for issues
if (health.overallHealth === 'CRITICAL') {
  showAlert('API Health Critical!');
}

if (stats.summary.avgLatency > 500) {
  showWarning('API latency is elevated');
}
```

## Performance Tuning

Use the metrics to optimize:

1. **Slow Endpoints** - Check query optimization, caching strategies
2. **Error-Prone Endpoints** - Review error handling, validation
3. **High-Traffic Endpoints** - Optimize database queries, add caching
4. **Deprecated Endpoints** - Migrate users to new versions

## Best Practices

✅ Register endpoints when creating routes  
✅ Update documentation as APIs evolve  
✅ Monitor health dashboard regularly  
✅ Use request metrics to identify bottlenecks  
✅ Document all query/body parameters  
✅ Provide clear deprecation paths  
✅ Keep response schemas current  

---

**Last Updated:** December 22, 2025  
**Version:** 1.0.0
