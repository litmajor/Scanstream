# API Registry Quick Reference

Quick templates for registering your existing endpoints in the API Registry.

## How to Register Your Endpoints

Add these to your `server/index.ts` after setting up the app:

```typescript
import { apiRegistry } from './services/api-registry';

// Register all your endpoints here
apiRegistry.registerEndpoints([
  // ========================================================================
  // BACKTEST ENDPOINTS
  // ========================================================================
  {
    method: 'POST',
    path: '/api/backtest/run',
    category: 'BACKTEST',
    name: 'Run Backtest',
    description: 'Execute a backtest simulation with specified parameters',
    version: 'v1',
    tags: ['backtest', 'simulation'],
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
        description: 'Trading pair (e.g., BTC/USDT)'
      }
    ],
    bodySchema: {
      type: 'object',
      properties: {
        strategy: { type: 'string' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        initialCapital: { type: 'number' }
      },
      required: ['strategy']
    },
    responseSchema: [{
      status: 200,
      description: 'Backtest results',
      schema: { type: 'object' }
    }],
    rateLimit: {
      requestsPerMinute: 10,
      burstSize: 20
    }
  },

  {
    method: 'GET',
    path: '/api/backtest/results/:id',
    category: 'BACKTEST',
    name: 'Get Backtest Results',
    description: 'Retrieve results from a previously executed backtest',
    version: 'v1',
    tags: ['backtest', 'query'],
    isActive: true,
    isDeprecated: false,
    pathParams: [
      { name: 'id', type: 'string', description: 'Backtest ID' }
    ],
    responseSchema: [{
      status: 200,
      description: 'Backtest results',
      schema: { type: 'object' }
    }],
    cacheable: true,
    cacheTTLSeconds: 300
  },

  // ========================================================================
  // SIGNAL ENDPOINTS
  // ========================================================================
  {
    method: 'POST',
    path: '/api/signals/track',
    category: 'SIGNAL',
    name: 'Track Signal',
    description: 'Record a new signal when generated',
    version: 'v1',
    tags: ['signal', 'tracking'],
    isActive: true,
    isDeprecated: false,
    authentication: 'JWT',
    cacheable: false,
    bodySchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        type: { type: 'string', enum: ['BUY', 'SELL', 'HOLD'] },
        strength: { type: 'number' },
        confidence: { type: 'number' }
      },
      required: ['symbol', 'type']
    },
    responseSchema: [{
      status: 200,
      description: 'Signal recorded',
      schema: { type: 'object' }
    }]
  },

  {
    method: 'GET',
    path: '/api/signals',
    category: 'SIGNAL',
    name: 'List Signals',
    description: 'Retrieve generated signals with optional filtering',
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
      },
      {
        name: 'limit',
        type: 'integer',
        required: false,
        description: 'Max results to return',
        example: 100
      }
    ],
    responseSchema: [{
      status: 200,
      description: 'List of signals',
      schema: { type: 'array' }
    }],
    cacheable: true,
    cacheTTLSeconds: 60,
    rateLimit: {
      requestsPerMinute: 30,
      burstSize: 50
    }
  },

  // ========================================================================
  // SCOUT REPORT ENDPOINTS
  // ========================================================================
  {
    method: 'POST',
    path: '/api/scout/report',
    category: 'SCOUT',
    name: 'Generate Scout Report',
    description: 'Generate comprehensive scout report for a symbol',
    version: 'v1',
    tags: ['scout', 'analysis'],
    isActive: true,
    isDeprecated: false,
    authentication: 'JWT',
    cacheable: false,
    timeout: 60000,
    bodySchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        includeHistorical: { type: 'boolean' }
      },
      required: ['symbol']
    },
    responseSchema: [{
      status: 200,
      description: 'Scout report',
      schema: { type: 'object' }
    }],
    expectedLatencyMs: 5000,
    rateLimit: {
      requestsPerMinute: 5,
      burstSize: 10
    }
  },

  {
    method: 'GET',
    path: '/api/scout/report/:symbol',
    category: 'SCOUT',
    name: 'Get Scout Report',
    description: 'Retrieve a scout report for a symbol',
    version: 'v1',
    tags: ['scout', 'query'],
    isActive: true,
    isDeprecated: false,
    pathParams: [
      { name: 'symbol', type: 'string', description: 'Trading symbol' }
    ],
    responseSchema: [{
      status: 200,
      description: 'Scout report',
      schema: { type: 'object' }
    }],
    cacheable: true,
    cacheTTLSeconds: 300
  },

  // ========================================================================
  // FEATURE FLAGS
  // ========================================================================
  {
    method: 'GET',
    path: '/api/feature-flags',
    category: 'FEATURE_FLAGS',
    name: 'List Feature Flags',
    description: 'Get all feature flags and their status',
    version: 'v1',
    tags: ['features', 'config'],
    isActive: true,
    isDeprecated: false,
    responseSchema: [{
      status: 200,
      description: 'Feature flags list',
      schema: { type: 'object' }
    }],
    cacheable: true,
    cacheTTLSeconds: 60
  },

  {
    method: 'POST',
    path: '/api/feature-flags/:flag/toggle',
    category: 'FEATURE_FLAGS',
    name: 'Toggle Feature Flag',
    description: 'Toggle a feature flag on/off (dev mode only)',
    version: 'v1',
    tags: ['features', 'admin'],
    isActive: true,
    isDeprecated: false,
    authentication: 'API_KEY',
    pathParams: [
      { name: 'flag', type: 'string', description: 'Flag name' }
    ],
    responseSchema: [{
      status: 200,
      description: 'Flag toggled',
      schema: { type: 'object' }
    }]
  },

  // ========================================================================
  // AGENT ENDPOINTS
  // ========================================================================
  {
    method: 'GET',
    path: '/api/agents/abilities',
    category: 'AGENT',
    name: 'List Agent Abilities',
    description: 'Get all available agent abilities and their status',
    version: 'v1',
    tags: ['agents', 'abilities'],
    isActive: true,
    isDeprecated: false,
    responseSchema: [{
      status: 200,
      description: 'Abilities list',
      schema: { type: 'array' }
    }],
    cacheable: true,
    cacheTTLSeconds: 300
  },

  {
    method: 'GET',
    path: '/api/agents/abilities/:id',
    category: 'AGENT',
    name: 'Get Ability Details',
    description: 'Get detailed information about a specific ability',
    version: 'v1',
    tags: ['agents', 'abilities'],
    isActive: true,
    isDeprecated: false,
    pathParams: [
      { name: 'id', type: 'string', description: 'Ability ID' }
    ],
    responseSchema: [{
      status: 200,
      description: 'Ability details',
      schema: { type: 'object' }
    }],
    cacheable: true,
    cacheTTLSeconds: 300
  },

  // ========================================================================
  // ANALYTICS & TRADING
  // ========================================================================
  {
    method: 'POST',
    path: '/api/trading/execute',
    category: 'TRADING',
    name: 'Execute Trade',
    description: 'Execute a new trade',
    version: 'v1',
    tags: ['trading', 'execution'],
    isActive: true,
    isDeprecated: false,
    authentication: 'JWT',
    cacheable: false,
    timeout: 30000,
    bodySchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        direction: { type: 'string', enum: ['LONG', 'SHORT'] },
        entryPrice: { type: 'number' },
        stopLoss: { type: 'number' },
        takeProfit: { type: 'number' }
      },
      required: ['symbol', 'direction']
    },
    responseSchema: [{
      status: 200,
      description: 'Trade executed',
      schema: { type: 'object' }
    }],
    rateLimit: {
      requestsPerMinute: 60,
      burstSize: 100
    }
  },

  // ========================================================================
  // ADMIN/DIAGNOSTICS
  // ========================================================================
  {
    method: 'GET',
    path: '/api/health',
    category: 'ADMIN',
    name: 'Health Check',
    description: 'Check overall system health',
    version: 'v1',
    tags: ['health', 'monitoring'],
    isActive: true,
    isDeprecated: false,
    authentication: 'NONE',
    cacheable: true,
    cacheTTLSeconds: 30,
    responseSchema: [{
      status: 200,
      description: 'System health',
      schema: { type: 'object' }
    }]
  },

  {
    method: 'GET',
    path: '/api/diagnostics/performance',
    category: 'ADMIN',
    name: 'Performance Diagnostics',
    description: 'Get detailed performance metrics',
    version: 'v1',
    tags: ['diagnostics', 'monitoring'],
    isActive: true,
    isDeprecated: false,
    responseSchema: [{
      status: 200,
      description: 'Performance data',
      schema: { type: 'object' }
    }]
  },
]);

// Mount documentation routes
import apiDocsRouter from './routes/api-docs';
app.use('/api/docs', apiDocsRouter);

console.log('[Server] API Registry initialized with all endpoints');
```

## Documentation Dashboard URLs

Once integrated, access at:

| URL | Purpose |
|-----|---------|
| `GET /api/docs/summary` | Quick dashboard overview |
| `GET /api/docs/endpoints` | List all endpoints |
| `GET /api/docs/stats` | Detailed statistics |
| `GET /api/docs/health` | Health status |
| `GET /api/docs/performance` | Performance metrics |
| `GET /api/docs/categories` | Endpoints by category |
| `GET /api/docs/tags` | Endpoints by tag |
| `GET /api/docs/usage` | Usage analytics |
| `GET /api/docs/openapi` | OpenAPI/Swagger export |
| `GET /api/docs/markdown` | Markdown export |

## Verify Registration

After registering endpoints, verify with:

```bash
# Get summary
curl http://localhost:3001/api/docs/summary

# List all endpoints
curl http://localhost:3001/api/docs/endpoints

# Get statistics
curl http://localhost:3001/api/docs/stats

# Check health
curl http://localhost:3001/api/docs/health

# Export as OpenAPI
curl http://localhost:3001/api/docs/openapi > api-spec.json
```

## Next Steps

1. ✅ Copy endpoint definitions above into `server/index.ts`
2. ✅ Mount API docs router: `app.use('/api/docs', apiDocsRouter)`
3. ✅ Install tracking middleware: `setupAPITracking(app)`
4. ✅ Start server and test documentation endpoints
5. ✅ Build admin dashboard using stats endpoints

---

**Pro Tip:** Use the OpenAPI export to generate interactive API documentation with SwaggerUI or ReDoc
