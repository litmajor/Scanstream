# API Dashboard - System Architecture

## 🏗️ Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /admin/api-docs                                         │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  React AdminAPIDocsPanel Component               │  │   │
│  │  │  • 6 metric cards (endpoints, requests, etc)     │  │   │
│  │  │  • Alerts section (real-time issues)            │  │   │
│  │  │  • Top endpoints table                          │  │   │
│  │  │  • Slow endpoints table                         │  │   │
│  │  │  • Unhealthy endpoints table                    │  │   │
│  │  │  • Auto-refreshes every 30 seconds              │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                      │                                            │
│                      │ fetch() requests                           │
│                      ▼                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Calls to /api/docs/*                                │   │
│  │  • /stats → dashboard cards                             │   │
│  │  • /health → health badge                               │   │
│  │  • /performance → slow/unhealthy endpoints              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ HTTP/JSON
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS SERVER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1️⃣  Incoming Request                                    │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  All HTTP Requests (every endpoint)               │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                     │                                     │   │
│  │                     ▼                                     │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  2️⃣  API Tracking Middleware                       │  │   │
│  │  │  (server/middleware/api-tracker.ts)              │  │   │
│  │  │  • Measure: performance.now() latency            │  │   │
│  │  │  • Capture: HTTP status code                     │  │   │
│  │  │  • Record: Error messages if present             │  │   │
│  │  │  • Action: Call apiRegistry.trackRequest()       │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                     │                                     │   │
│  │                     ▼                                     │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  3️⃣  API Registry Service                          │  │   │
│  │  │  (server/services/api-registry.ts)               │  │   │
│  │  │                                                   │  │   │
│  │  │  In-Memory Database:                            │  │   │
│  │  │  ┌─────────────────────────────────────────┐    │  │   │
│  │  │  │ Endpoint 1: GET /api/signals            │    │  │   │
│  │  │  │   • totalRequests: 1,234                │    │  │   │
│  │  │  │   • successfulRequests: 1,210           │    │  │   │
│  │  │  │   • failedRequests: 24                  │    │  │   │
│  │  │  │   • avgLatency: 45ms                    │    │  │   │
│  │  │  │   • uptime: 98.1%                       │    │  │   │
│  │  │  │                                          │    │  │   │
│  │  │  │ Endpoint 2: POST /api/trading           │    │  │   │
│  │  │  │   • totalRequests: 567                  │    │  │   │
│  │  │  │   • successfulRequests: 540             │    │  │   │
│  │  │  │   • failedRequests: 27                  │    │  │   │
│  │  │  │   • avgLatency: 123ms                   │    │  │   │
│  │  │  │   • uptime: 95.2%                       │    │  │   │
│  │  │  │ ... (all endpoints tracked)             │    │  │   │
│  │  │  └─────────────────────────────────────────┘    │  │   │
│  │  │                                                   │  │   │
│  │  │  Methods:                                        │  │   │
│  │  │  • trackRequest(method, path, latency, ...)     │  │   │
│  │  │  • calculateHealth(endpoint)                    │  │   │
│  │  │  • getStats()                                  │  │   │
│  │  │  • getHealthStatus()                           │  │   │
│  │  │  • getSlowEndpoints()                          │  │   │
│  │  │  • getUnhealthyEndpoints()                     │  │   │
│  │  │  • exportAsOpenAPI()                           │  │   │
│  │  │  • exportAsMarkdown()                          │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                     │                                     │   │
│  │                     ▼                                     │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  4️⃣  Documentation Routes                          │  │   │
│  │  │  (server/routes/api-docs.ts)                      │  │   │
│  │  │                                                   │  │   │
│  │  │  GET /api/docs/endpoints                         │  │   │
│  │  │    ↓ Returns: List of all endpoints              │  │   │
│  │  │                                                   │  │   │
│  │  │  GET /api/docs/stats                             │  │   │
│  │  │    ↓ Returns: {                                   │  │   │
│  │  │      summary: {                                  │  │   │
│  │  │        totalEndpoints: 50,                       │  │   │
│  │  │        activeEndpoints: 48,                      │  │   │
│  │  │        totalRequests: 1234567,                   │  │   │
│  │  │        errorRate: 2.1%,                          │  │   │
│  │  │        avgLatency: 67ms,                         │  │   │
│  │  │        avgUptime: 97.8%                          │  │   │
│  │  │      },                                          │  │   │
│  │  │      topEndpoints: [...]                         │  │   │
│  │  │    }                                              │  │   │
│  │  │                                                   │  │   │
│  │  │  GET /api/docs/health                            │  │   │
│  │  │    ↓ Returns: Overall health + per-endpoint      │  │   │
│  │  │                                                   │  │   │
│  │  │  GET /api/docs/performance                       │  │   │
│  │  │    ↓ Returns: Slow endpoints, unhealthy, etc     │  │   │
│  │  │                                                   │  │   │
│  │  │  GET /api/docs/openapi                           │  │   │
│  │  │    ↓ Returns: OpenAPI 3.0 spec                   │  │   │
│  │  │                                                   │  │   │
│  │  │  GET /api/docs/markdown                          │  │   │
│  │  │    ↓ Returns: Markdown documentation             │  │   │
│  │  │                                                   │  │   │
│  │  │  [+ 7 more specialized endpoints]                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagram

```
                    TRACKING FLOW
                    
Every HTTP Request
        │
        ▼
    Middleware captures:
    • method (GET/POST/etc)
    • path (/api/signals)
    • latency (response time)
    • status (200/500/etc)
    • error message (if any)
        │
        ▼
    apiRegistry.trackRequest() stores in memory
        │
        ├─ Increments totalRequests
        ├─ Updates min/max/avg latency
        ├─ Calculates error rate
        ├─ Updates last called time
        └─ Records last error


                    QUERY FLOW
                    
Browser requests /api/docs/stats
        │
        ▼
    apiRegistry.getStats() calculates:
    • aggregate stats from all endpoints
    • top endpoints by traffic
    • error rate across system
        │
        ▼
    Returns JSON to frontend
        │
        ▼
    AdminAPIDocsPanel updates UI:
    • Populates metric cards
    • Shows endpoint tables
    • Displays health status
        │
        ▼
    User sees real-time dashboard
```

## 🔄 Request Lifecycle Example

```
1. User makes request: GET /api/signals
                │
                ▼
2. Middleware intercepts:
   - Start time: 1702800000000
                │
                ▼
3. Request processed (50ms)
                │
                ▼
4. Response sent: 200 OK
   - End time: 1702800000050
                │
                ▼
5. Middleware logs:
   - method: GET
   - path: /api/signals
   - latency: 50
   - status: 200
   - error: null
                │
                ▼
6. apiRegistry.trackRequest() updates:
   - /api/signals metrics
   - totalRequests: 1234 → 1235
   - successfulRequests: 1210 → 1211
   - Update latency stats
   - Update uptime %
                │
                ▼
7. Next dashboard refresh (30s):
   - Fetches /api/docs/stats
   - Shows updated metrics
   - User sees new request in stats
```

## 🛠️ Component Interactions

```
┌─────────────────────────────────────────────┐
│         AdminAPIDocsPanel (React)           │
│                                             │
│  • Manages local state (stats, health, perf)│
│  • Handles API calls                        │
│  • Renders 6 cards + 3 tables              │
│  • Auto-refreshes every 30s                │
└────────────┬────────────────────────────────┘
             │
             │ fetch(/api/docs/stats)
             │ fetch(/api/docs/health)
             │ fetch(/api/docs/performance?hours=1)
             │
             ▼
┌─────────────────────────────────────────────┐
│      Documentation Routes (Express)         │
│                                             │
│  • 13 REST endpoints                       │
│  • Query in-memory registry                │
│  • Calculate metrics on-demand             │
│  • Return JSON responses                   │
└────────────┬────────────────────────────────┘
             │
             │ Query apiRegistry
             │ • getAllEndpoints()
             │ • getStats()
             │ • getHealthStatus()
             │ • getPerformanceTimeline()
             │
             ▼
┌─────────────────────────────────────────────┐
│      API Registry Service (Memory)          │
│                                             │
│  • Stores all endpoint metrics             │
│  • Calculates health scores                │
│  • Tracks request history                  │
│  • Exports OpenAPI/Markdown                │
└────────────┬────────────────────────────────┘
             │
             │ Updated by trackRequest()
             │
             ▼
┌─────────────────────────────────────────────┐
│      Tracking Middleware (Express)          │
│                                             │
│  • Intercepts every request                │
│  • Measures latency                        │
│  • Captures status/errors                  │
│  • Calls apiRegistry.trackRequest()        │
└─────────────────────────────────────────────┘
```

## 📈 Metrics Hierarchy

```
All Endpoints
├─ Endpoint A (GET /api/signals)
│  ├─ totalRequests: 1,234
│  ├─ successfulRequests: 1,210
│  ├─ failedRequests: 24
│  ├─ latency metrics
│  │  ├─ min: 10ms
│  │  ├─ max: 500ms
│  │  └─ avg: 45ms
│  ├─ errorRate: 1.9%
│  ├─ uptime: 98.1%
│  ├─ lastCalledAt: 2024-12-22T10:30:45Z
│  └─ lastError: null
│
├─ Endpoint B (POST /api/trading)
│  ├─ totalRequests: 567
│  ├─ ... (same metrics)
│
└─ Endpoint N (...)
   └─ ...

Aggregated Stats
├─ totalEndpoints: 50
├─ totalRequests: 100,000+
├─ errorRate: 2.1%
├─ avgLatency: 67ms
├─ avgUptime: 97.8%
└─ topEndpoints: [A, B, C, ...]
```

## 🎯 Key Design Patterns

### 1. Singleton Pattern
- `apiRegistry` is a single instance
- Shared across all routes and middleware
- Maintains global state

### 2. Middleware Chain
```
Request → API Tracker → Business Logic → Response → Tracker Logs
```

### 3. On-Demand Calculation
- Metrics stored at granular level
- Stats aggregated when requested
- No pre-calculation overhead

### 4. Health Scoring Algorithm
```
uptime% → EXCELLENT (>99%)
         → GOOD (95-99%)
         → FAIR (85-95%)
         → POOR (<85%)
```

---

**System Status:** ✅ Production Ready | **Components:** 5 Core + 2 Optional | **Endpoints:** 13 REST APIs
