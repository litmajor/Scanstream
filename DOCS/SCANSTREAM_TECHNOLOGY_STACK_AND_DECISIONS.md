# Scanstream: Technology Stack & Architectural Decisions

## Technology Stack Overview

### Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 20+ | JavaScript execution environment |
| **Language** | TypeScript | 5.7.2 | Type-safe development |
| **Framework** | Express.js | 5.0+ | REST API server |
| **Module System** | ES Modules | - | Modern JavaScript modules |
| **Process Manager** | tsx/Node | - | Development & production running |
| **ORM** | Drizzle ORM | 6.18.0 | Type-safe database access |
| **Database Driver** | Neon | - | PostgreSQL serverless |
| **Database** | PostgreSQL | 14+ | Persistent data storage |
| **Real-Time** | WebSocket (ws) | 8.18+ | Bidirectional communication |
| **Async Processing** | Native Promises | - | Async/await support |
| **Data Processing** | Native JSON | - | Built-in JSON support |
| **Environment** | dotenv | - | Configuration management |

### ML/RL Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **LSTM Models** | TensorFlow.js / PyTorch | Time-series forecasting |
| **Transformer Models** | PyTorch / HuggingFace | Attention-based predictions |
| **Ensemble Voting** | Custom TypeScript | Model aggregation |
| **Regime Detection** | Hidden Markov Models | Market condition identification |
| **Reinforcement Learning** | DQN (Deep Q-Network) | Decision optimization |
| **Feature Engineering** | NumPy / Pandas (Python) | Data preparation |
| **Model Validation** | Scikit-learn | Cross-validation & metrics |

### Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Library** | React | 18+ | UI framework |
| **Language** | TypeScript | 5.7.2 | Type-safe components |
| **Build Tool** | Vite | 7.1.2 | Fast development & bundling |
| **Styling** | TailwindCSS | 4.1.12 | Utility-first CSS |
| **Component Library** | shadcn/ui | - | Pre-built components |
| **UI Primitives** | Radix UI | - | Accessible component base |
| **State Management** | TanStack Query | - | Server state management |
| **Routing** | Wouter | - | Lightweight client-side routing |
| **Charts** | Recharts | 1.8+ | Data visualization |
| **Icons** | Lucide Icons | - | Icon library |
| **Forms** | React Hook Form | - | Form state management |
| **Validation** | Zod | - | Runtime type validation |
| **HTTP Client** | Fetch API | - | HTTP requests |
| **HTTP Client (Legacy)** | axios | 0.9+ | Alternative HTTP client |

### DevOps Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Containerization** | Docker | Container orchestration |
| **Compose** | Docker Compose | Multi-container management |
| **Cloud Deployment** | Replit / Cloud Platform | Development & production |
| **Database Cloud** | Neon | Serverless PostgreSQL |
| **Registry** | npm / pnpm | Package management |
| **Version Control** | Git | Source code management |
| **CI/CD** | GitHub Actions (optional) | Continuous integration |

### External Services

| Service | Purpose | Integration |
|---------|---------|-----------|
| **CCXT** | Multi-exchange API | 25+ exchanges unified |
| **Binance API** | Primary exchange | Spot & futures trading |
| **Coinbase API** | Alternative exchange | Price data & trading |
| **Kraken API** | Alternative exchange | Price data & trading |
| **CoinGecko API** | Market data | Historical prices & metadata |
| **Polygon.io** | Market data (optional) | Stock/crypto data |

---

## Architectural Design Decisions

### 1. **Monolithic vs Microservices**

**Decision**: **Monolithic with modular service layer**

**Rationale**:
- ✅ Simpler deployment for trading application
- ✅ Easier to maintain state consistency
- ✅ Lower latency (in-process calls)
- ✅ Faster development iteration
- ⚠️ Scaling challenges mitigated by stateless design

**Alternative Rejected**: Full microservices
- ❌ Trading requires tight consistency
- ❌ Increased operational complexity
- ❌ Higher latency between services
- ❌ Overkill for current scale

---

### 2. **Real-Time Communication: WebSocket vs Polling**

**Decision**: **WebSocket with fallback to polling**

**Rationale**:
- ✅ Low-latency signal delivery (<100ms)
- ✅ Bi-directional communication
- ✅ Efficient for high-frequency updates
- ✅ Reduced server load vs polling
- ✅ Better UX for real-time updates

**Implementation**:
```typescript
// WebSocket connection in frontend
const ws = new WebSocket('ws://localhost:3000');

// Fallback to polling if WebSocket unavailable
if (!ws) {
  setInterval(() => {
    fetch('/api/signals').then(r => r.json());
  }, 5000);
}
```

---

### 3. **State Management: Client vs Server**

**Decision**: **TanStack Query (Server-State) + React hooks (Client-State)**

**Rationale**:
- ✅ Automatic cache invalidation
- ✅ Background refetching
- ✅ Optimistic updates
- ✅ Reduces client-side complexity
- ✅ Built-in retry logic

**Alternative Rejected**: Redux/Zustand
- ❌ Overkill for mostly server-driven UI
- ❌ Manual cache management
- ❌ More boilerplate

---

### 4. **Database: PostgreSQL vs alternatives**

**Decision**: **PostgreSQL (Neon serverless)**

**Rationale**:
- ✅ ACID compliance for financial data
- ✅ JSON/JSONB support for complex data
- ✅ Strong indexing capabilities
- ✅ Serverless scaling (Neon)
- ✅ Excellent TypeScript ORM support (Drizzle)
- ✅ Time-series ready (TimescaleDB compatible)

**Alternatives Considered**:
- MongoDB: ❌ Not suitable for financial transactions
- DynamoDB: ❌ Expensive at scale, weaker querying
- SQLite: ❌ Not suitable for production multi-user app

---

### 5. **ORM: Drizzle vs Prisma**

**Decision**: **Drizzle ORM** (modern approach)

**Rationale**:
- ✅ Type-safe queries with inference
- ✅ No runtime type dependencies
- ✅ Lightweight (no Node.js-specific code)
- ✅ Better TypeScript support
- ✅ Faster query building

**Alternative Rejected**: Prisma
- ❌ Heavier runtime overhead
- ❌ Generated code complexity
- ❌ Less transparent query translation

---

### 6. **Build Tool: Vite vs Webpack**

**Decision**: **Vite**

**Rationale**:
- ✅ Lightning-fast HMR (Hot Module Replacement)
- ✅ Native ES modules
- ✅ Faster builds
- ✅ Better development experience
- ✅ Modern tooling standard

---

### 7. **ML Model Architecture: Ensemble**

**Decision**: **Multi-model ensemble (LSTM + Transformer)**

**Rationale**:
- ✅ Reduces model-specific biases
- ✅ Better generalization
- ✅ Redundancy if one model fails
- ✅ Can weight by recent performance
- ✅ Confidence calibration across models

**Weighting Strategy**:
```typescript
// Weighted ensemble based on recent performance
const lstm_weight = 0.3;
const transformer_weight = 0.4;
const recency_bonus = 0.1;

const ensemble = (lstm * lstm_weight) + 
                 (transformer * transformer_weight) +
                 (recent_model * recency_bonus);
```

---

### 8. **Signal Quality: Aggregation vs Majority Vote**

**Decision**: **Weighted aggregation with Bayesian updating**

**Rationale**:
- ✅ Accounts for source reliability
- ✅ Bayesian approach incorporates prior knowledge
- ✅ Continuous confidence (not binary)
- ✅ Learns from historical accuracy

**Formula**:
```
Final_Confidence = Prior_Accuracy × 
                   Likelihood_Of_Current_Signal ×
                   Multi_Source_Agreement ×
                   Risk_Adjusted_Score
```

---

### 9. **Position Sizing: Kelly vs Fixed Risk %**

**Decision**: **Fractional Kelly Criterion**

**Rationale**:
- ✅ Mathematically optimal
- ✅ Risk-adjusted using win rate & R:R
- ✅ Safe with fractional application (0.25x Kelly)
- ✅ Adapts to market conditions

**Formula**:
```
f* = (bp - q) / b  where:
  b = odds (profit per unit risk)
  p = win probability
  q = loss probability (1 - p)

Then apply at 25% of f* for safety
```

---

### 10. **Backtesting: Walk-Forward vs Single Period**

**Decision**: **Walk-forward with multiple hold-out periods**

**Rationale**:
- ✅ Avoids look-ahead bias
- ✅ Tests on unseen data
- ✅ More realistic performance estimates
- ✅ Detects overfitting

**Implementation**:
```
1980-1990: Training | 1990-1991: Testing
1985-1995: Training | 1995-1996: Testing
1990-2000: Training | 2000-2001: Testing
...
Average metrics across all walk-forward periods
```

---

### 11. **Regime Detection: HMM vs Regime-Switching Model**

**Decision**: **Hidden Markov Model (HMM)**

**Rationale**:
- ✅ Well-studied for market regimes
- ✅ Probabilistic state transitions
- ✅ Interpretable states
- ✅ Efficient Viterbi algorithm
- ✅ Can detect changing regimes

---

### 12. **Feature Engineering: Static vs Dynamic**

**Decision**: **Dynamic feature engineering with sliding windows**

**Rationale**:
- ✅ Adapts to market conditions
- ✅ Captures non-stationarity
- ✅ Better generalization
- ✅ Reduces look-ahead bias

**Features Include**:
- Technical indicators (RSI, MACD, Bollinger Bands)
- Volume metrics (volume profile, OI)
- Order flow (bid-ask imbalance)
- Microstructure (spreads, depth)
- Market regime indicators

---

### 13. **Deployment: Single Server vs Load Balanced**

**Decision**: **Single server with load balancer readiness**

**Current**:
- ✅ Simple Docker container
- ✅ Cost-effective for current scale

**Future Scaling**:
- Horizontal scaling via load balancer
- Redis cache for distributed caching
- Database connection pooling
- WebSocket sticky sessions

---

### 14. **Logging & Monitoring: Centralized vs Local**

**Decision**: **Local file logging with structured JSON**

**Rationale**:
- ✅ No external dependencies
- ✅ Easy to debug development
- ✅ Searchable structured logs
- ✅ Easy to migrate to ELK stack later

**Log Format**:
```json
{
  "timestamp": "2026-03-10T12:34:56Z",
  "level": "INFO",
  "service": "signal-aggregator",
  "action": "signal_generated",
  "symbol": "BTC/USDT",
  "confidence": 0.745,
  "duration_ms": 145
}
```

---

### 15. **Error Handling: Graceful Degradation vs Fail Fast**

**Decision**: **Graceful degradation with circuit breakers**

**Rationale**:
- ✅ Ensures trading doesn't stop on single failure
- ✅ Fallback models/data sources
- ✅ Better user experience
- ✅ Prevents cascade failures

**Circuit Breaker Pattern**:
```
CLOSED (normal) → OPEN (too many failures) 
                → HALF_OPEN (test recovery)
                → CLOSED (recovered)
```

---

## Data Flow Decisions

### 1. **Caching Strategy**

```typescript
// Signal Cache: 10 seconds
// Reason: Signals don't change rapidly, but need freshness

// Market Cache: 1 second
// Reason: Prices update frequently, need real-time feel

// Model Cache: Per session
// Reason: ML models are expensive to load, reuse in session
```

### 2. **Update Frequency**

```
Market Data:  Every tick (100-500ms)
Signals:      Every minute (or on-demand)
ML Inference: Every 5 minutes
Regime Change: Every hour (or on-demand)
Model Update: Daily / weekly
```

### 3. **Data Retention**

```
Real-time signals:     7 days in cache
Trade history:         2 years in DB
Market data (OHLCV):   10 years in DB (compressed)
ML model versions:     Last 5 versions
Logs:                  30 days
```

---

## Security Decisions

### 1. **API Authentication**

**Current**: Session-based (dev environment)

**Production**: 
- JWT tokens with expiration
- Refresh token rotation
- Rate limiting per user
- HTTPS only

### 2. **API Keys Management**

```
Exchange API Keys:
├─ Stored in .env (development)
├─ Environment variables (production)
├─ Encrypted in database (future)
└─ Rotated quarterly
```

### 3. **Database Security**

```
├─ Neon serverless (managed security)
├─ Connection pooling
├─ SQL injection prevention (via ORM)
├─ Row-level security (future)
└─ Audit logging (future)
```

### 4. **Secrets Management**

```bash
# Development
.env file (gitignored)

# Production  
Environment variables
├─ Docker secrets
├─ Kubernetes secrets
└─ Cloud platform secrets
```

---

## Performance Considerations

### 1. **Latency Targets**

```
API Request:           < 100ms (p95)
Signal Generation:     < 2 seconds (end-to-end)
ML Inference:          < 500ms (GPU accelerated)
WebSocket Message:     < 50ms
Database Query:        < 50ms
```

### 2. **Throughput Targets**

```
Concurrent Users:      100+
API Requests/min:      10,000+
WebSocket Connections: 1,000+
Signals/minute:        5,000+
```

### 3. **Database Indexing Strategy**

```sql
-- Primary lookup keys
CREATE INDEX idx_signals_symbol_timestamp 
  ON signals(symbol, timestamp DESC);

CREATE INDEX idx_trades_status 
  ON trades(status);

CREATE INDEX idx_market_frames_symbol_time 
  ON market_frames(symbol, time DESC);

-- Full-text search (future)
CREATE INDEX idx_signals_direction 
  ON signals(direction);
```

### 4. **Frontend Optimization**

```
├─ Code splitting (route-based)
├─ Component lazy loading
├─ Image optimization (charts)
├─ Cache busting (version hash)
└─ Gzip compression
```

---

## Scalability Strategy

### Current Architecture
- **Cost**: Low
- **Complexity**: Low
- **Max Throughput**: 10,000 signals/minute

### Phase 1: Vertical Scaling
- Increase container resources
- Database read replicas
- Redis caching layer

### Phase 2: Horizontal Scaling
- Load balanced container instances
- Database sharding (by symbol)
- Message queue (RabbitMQ/Kafka)
- Distributed caching (Redis cluster)

### Phase 3: Advanced
- Microservices per domain (Scanner, ML, RL)
- Time-series database (TimescaleDB)
- Stream processing (Kafka Streams)
- Real-time data warehouse

---

## Monitoring & Observability Strategy

### 1. **Key Metrics**

```
System:
├─ API latency (p50, p95, p99)
├─ Database query time
├─ WebSocket connection health
└─ Container metrics (CPU, memory)

Trading:
├─ Signal accuracy
├─ Model prediction accuracy
├─ P&L by signal source
└─ Trade execution success rate

ML:
├─ Model drift score
├─ Inference latency
├─ Model retraining frequency
└─ Ensemble confidence distribution
```

### 2. **Alert Thresholds**

```
Critical:
├─ API error rate > 5%
├─ Database connection pool exhausted
├─ Model accuracy drops > 20%
└─ Daily loss limit exceeded

Warning:
├─ API latency p95 > 500ms
├─ WebSocket disconnects > 10%
├─ Model drift score > 0.3
└─ Signal cache miss rate > 15%
```

---

## Testing Strategy

### 1. **Test Coverage**

```
Frontend:          40%+ coverage
Backend Services:  70%+ coverage
ML Models:         80%+ coverage (on test set)
Integration:       50%+ coverage
```

### 2. **Test Types**

```
Unit Tests:
├─ Pattern detectors
├─ Signal aggregation
├─ Position sizing
└─ Risk calculations

Integration Tests:
├─ Database operations
├─ API endpoints
├─ Exchange connectivity
└─ WebSocket communication

E2E Tests:
├─ Full signal generation pipeline
├─ Trade execution
├─ Backtesting
└─ User workflows
```

### 3. **Backtesting Validation**

```
Walk-Forward Analysis:
├─ In-sample: Train on 80%, validate
├─ Out-of-sample: Test on 20% (unseen)
├─ Multiple periods: Avoid data snooping
└─ Compare to baselines
```

---

## Migration Path: Python → TypeScript

The project includes both:

**Python** (legacy):
- ML model training
- Historical analysis
- Data processing scripts
- `scanner.py`, `continuous_scanner.py`

**TypeScript** (modern):
- REST API server
- React frontend
- Real-time processing
- `server/`, `client/`

**Migration Strategy**:
1. Keep Python for batch ML training
2. Implement ML inference in TypeScript/WASM
3. Gradually migrate scanner patterns to TypeScript
4. Deprecate Python scripts in favor of TypeScript

---

## Compliance & Risk Management

### 1. **Data Integrity**

- ✅ Atomic transactions for trades
- ✅ Audit logging for all changes
- ✅ Point-in-time recovery
- ✅ Database backups (daily)

### 2. **Risk Management**

- ✅ Stop-loss enforcement
- ✅ Position size limits
- ✅ Daily loss limits
- ✅ Margin requirements
- ✅ Correlation checks

### 3. **Compliance**

- ⚠️ GDPR: User data handling (future)
- ⚠️ KYC: User verification (future)
- ⚠️ AML: Transaction monitoring (future)
- ⚠️ Exchange compliance: API terms adherence

---

## Cost Analysis

### Infrastructure Costs

```
Monthly Estimate:

Development:
├─ PostgreSQL (Neon):     ~$10-50
├─ Container hosting:     ~$20-100
├─ CDN/API gateway:       ~$10-50
└─ Monitoring:            ~$0-20
Total Dev:                ~$40-220/month

Production (scaled):
├─ PostgreSQL (Neon):     ~$100-500
├─ Container hosting:     ~$200-1000
├─ CDN/API gateway:       ~$50-200
├─ Monitoring:            ~$50-200
└─ Backups:               ~$10-50
Total Prod:               ~$400-2000/month
```

### Development Costs

```
Initial:
├─ Architecture:          ~40 hours
├─ Frontend:              ~200 hours
├─ Backend Services:      ~300 hours
├─ ML/RL Integration:     ~200 hours
└─ Testing:               ~100 hours
Total Initial:           ~840 hours

Ongoing:
├─ Maintenance:           ~20 hours/month
├─ Feature development:   ~40 hours/month
├─ ML retraining:         ~10 hours/month
└─ Monitoring:            ~10 hours/month
Total Ongoing:            ~80 hours/month
```

---

## Summary Table: Key Decisions

| Decision | Choice | Why | Alternative |
|----------|--------|-----|-------------|
| Architecture | Monolithic | Fast, consistent | Microservices |
| Real-Time | WebSocket | Low latency | Polling |
| State | TanStack Query | Auto cache mgmt | Redux |
| Database | PostgreSQL | ACID, JSON | MongoDB |
| ORM | Drizzle | Type-safe | Prisma |
| Build | Vite | Fast HMR | Webpack |
| ML Model | Ensemble | Better accuracy | Single model |
| Position Sizing | Kelly | Optimal | Fixed % |
| Backtesting | Walk-forward | Unbiased | Single period |
| Regime | HMM | Interpretable | Regime switching |
| Frontend | React | Ecosystem | Vue/Svelte |
| Deployment | Docker | Standard | VM/Native |
| Logging | Local JSON | Simple | ELK/Cloud |
| Error Handling | Graceful degrade | Availability | Fail fast |

---

This architecture is designed to provide:
- **Reliability**: Multiple data sources, fallback mechanisms, error handling
- **Performance**: Caching, efficient algorithms, optimized queries
- **Maintainability**: Type-safe languages, modular design, clear separation
- **Scalability**: Stateless design, caching strategy, horizontal scaling readiness
- **Learning**: Continuous model improvement, signal accuracy tracking, Bayesian updates
