# Scanstream: Developer Quick Reference

## Project Structure

```
e:\repos\litmajor\Scanstream
│
├── package.json                 # Project dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Frontend build configuration
├── tailwind.config.ts           # Styling configuration
├── drizzle.config.ts           # Database migration config
│
├── server/                     # Backend (Node.js + Express)
│   ├── index.ts               # Main server entry point
│   ├── agents/                # Trading agents
│   │   ├── base-agent.ts
│   │   ├── discovery-agent.ts
│   │   ├── arbitrage-agent.ts
│   │   └── portfolio-agent.ts
│   ├── backtest/              # Backtesting framework
│   ├── trading/               # Trading engines
│   │   ├── live-trading-manager.ts
│   │   └── live-deployment-config.ts
│   ├── routes/                # API endpoints
│   │   ├── scanner.ts         # Scanner API
│   │   ├── signal-api.ts      # Signal API
│   │   ├── ml-signals.ts      # ML signals API
│   │   ├── rl-signals.ts      # RL signals API
│   │   ├── paper-trading.ts   # Paper trading API
│   │   ├── ml-predictions.ts  # ML predictions API
│   │   ├── ml-training.ts     # ML training API
│   │   ├── backtest-runner.ts # Backtest runner
│   │   ├── flow-field.ts      # Flow field analysis
│   │   ├── physics-agents.ts  # Physics-based agents
│   │   └── [many more routes...]
│   ├── services/              # Business logic layer
│   │   ├── scanner/           # Pattern detection
│   │   ├── ml-lstm-trainer.ts # LSTM training
│   │   ├── lstm-inference-engine.ts # ML predictions
│   │   ├── ml-regime-ensemble.ts    # Regime detection
│   │   ├── unified-signal-aggregator.ts # Signal combining
│   │   ├── dynamic-position-sizer.ts   # Position sizing
│   │   ├── intelligent-exit-manager.ts # Exit optimization
│   │   ├── gateway/           # Market data gateway
│   │   ├── market-data/       # Price data fetching
│   │   ├── aggregator/        # Cross-exchange aggregation
│   │   ├── clustering/        # Agent clustering
│   │   ├── vfmd/             # Multi-frame analysis
│   │   ├── executing/         # Trade execution
│   │   ├── monitoring/        # System monitoring
│   │   ├── rpg-agents/        # RPG agent systems
│   │   ├── bayesian-belief-updater.ts   # Bayesian learning
│   │   └── [50+ more services...]
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Express middleware
│   ├── types/                 # Type definitions
│   ├── utils/                 # Utility functions
│   ├── lib/                   # Shared libraries
│   ├── db-storage.ts         # Database access
│   ├── storage.ts            # In-memory storage
│   ├── ml-engine.ts          # ML orchestration
│   ├── rl-position-agent.ts  # RL agent
│   ├── live-trading-engine.ts # Live trading
│   └── paper-trading-engine.ts # Paper trading
│
├── client/                    # Frontend (React)
│   ├── src/                  # React components
│   │   ├── App.tsx           # Root component
│   │   ├── main.tsx          # Entry point
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Frontend utilities
│   │   ├── types/            # Frontend types
│   │   └── [features...]
│   ├── public/               # Static assets
│   └── index.html            # HTML template
│
├── shared/                    # Shared code
│   ├── schema.ts             # Database schema
│   └── tracked-assets.ts     # Asset configuration
│
├── src/                      # Frontend source (legacy)
│   ├── App.tsx
│   └── main.tsx
│
├── prisma/                   # Prisma ORM (legacy)
│   ├── schema.prisma
│   └── seed.ts
│
├── scripts/                  # Utility scripts
├── e2e/                      # End-to-end tests
├── tests/                    # Unit tests
│
├── dist/                     # Built frontend
├── node_modules/             # Dependencies
│
├── docker-compose.yml        # Docker setup
├── Dockerfile                # Container image
├── .env                      # Environment variables
├── .env.example              # Example environment
│
├── SCANSTREAM_COMPLETE_END_TO_END_ARCHITECTURE.md  # This document
└── [Many documentation files...]
```

## Getting Started

### 1. Installation

```bash
# Clone repository
git clone <repo-url>
cd Scanstream

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration
```

### 2. Start Development

```bash
# Terminal 1: Start backend server
pnpm run server

# Terminal 2: Start frontend dev server
pnpm run dev

# Terminal 3: Optionally - database studio
pnpm run db:studio
```

### 3. Build for Production

```bash
# Build frontend
pnpm build

# Start production server
pnpm start
```

### 4. Docker Deployment

```bash
# Build and start with docker-compose
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

---

## Key APIs

### Market Data APIs

#### GET `/api/markets/{symbol}`
Get current market data for a symbol

```typescript
Response {
  symbol: "BTC/USDT",
  price: 45230,
  volume: 1250000,
  change24h: 2.5,
  high24h: 46000,
  low24h: 44800,
  timestamp: 1234567890
}
```

#### GET `/api/markets/{symbol}/candles`
Get historical candles

```typescript
Query Parameters:
  timeframe: "1m" | "5m" | "1h" | "1d" | "1w"
  limit: number (default: 100)

Response {
  candles: [
    { 
      time: 1234567890, 
      open: 45000, 
      high: 45500, 
      low: 44800, 
      close: 45230, 
      volume: 1250000 
    },
    ...
  ]
}
```

### Signal APIs

#### GET `/api/signals/{symbol}`
Get current signals for a symbol

```typescript
Response {
  symbol: "BTC/USDT",
  direction: "BUY",
  qualityRating: "Good",
  confidence: 0.745,
  sources: {
    scanner: 0.75,
    mlEnsemble: 0.78,
    rlAgent: 0.72,
    volumeConfirm: 0.80,
    orderFlow: 0.65
  },
  riskReward: "1:3.5"
}
```

#### GET `/api/signals`
Get all signals across symbols

```typescript
Query Parameters:
  minQuality: "Excellent" | "Good" | "Fair" (default: "Good")
  minConfidence: 0-1 (default: 0.5)

Response {
  signals: [
    { symbol: "BTC/USDT", direction: "BUY", confidence: 0.745 },
    { symbol: "ETH/USDT", direction: "SELL", confidence: 0.62 },
    ...
  ],
  totalCount: 50
}
```

### Trading APIs

#### POST `/api/trades/execute`
Execute a trade

```typescript
Body {
  symbol: "BTC/USDT",
  direction: "BUY",
  size: 0.02,
  entry: 45230,
  stopLoss: 44980,
  takeProfit: [45580, 46230, 47000],
  mode: "PAPER" | "LIVE"
}

Response {
  tradeId: "trade_123abc",
  status: "FILLED",
  entry: {
    price: 45230,
    quantity: 0.02,
    cost: 904.60
  },
  timestamp: 1234567890
}
```

#### GET `/api/trades/{tradeId}`
Get trade details

```typescript
Response {
  tradeId: "trade_123abc",
  symbol: "BTC/USDT",
  status: "CLOSED",
  entry: { price: 45230, quantity: 0.02 },
  exit: { price: 45580, quantity: 0.02 },
  pnl: { absolute: 7.00, percentage: 0.77 },
  duration: 3600
}
```

#### GET `/api/trades`
Get trade history

```typescript
Query Parameters:
  limit: number (default: 50)
  symbol: string (optional)
  status: "OPEN" | "CLOSED" (optional)

Response {
  trades: [
    { tradeId: "...", symbol: "BTC/USDT", pnl: 7.00 },
    ...
  ],
  totalPnL: 245.50,
  winRate: 0.62
}
```

### Backtest APIs

#### POST `/api/backtest/start`
Start a backtest

```typescript
Body {
  strategyId: "strategy_123",
  cryptoSymbols: ["BTC/USDT", "ETH/USDT"],
  startDate: "2023-01-01",
  endDate: "2023-12-31",
  initialCapital: 10000,
  configuration: {
    riskPercentage: 2,
    maxDrawdown: 10,
    ...
  }
}

Response {
  backtestId: "backtest_abc123",
  status: "RUNNING",
  progress: 15
}
```

#### GET `/api/backtest/{backtestId}/results`
Get backtest results

```typescript
Response {
  backtestId: "backtest_abc123",
  status: "COMPLETED",
  results: {
    totalTrades: 250,
    winRate: 0.62,
    profitFactor: 2.15,
    sharpeRatio: 1.45,
    maxDrawdown: 8.3,
    totalReturn: 45.2,
    equityCurve: [...],
    trades: [...]
  }
}
```

### Analytics APIs

#### GET `/api/analytics/portfolio`
Get portfolio analytics

```typescript
Response {
  equity: 11000,
  initialEquity: 10000,
  totalPnL: 1000,
  winRate: 0.62,
  profitFactor: 2.15,
  sharpeRatio: 1.45,
  maxDrawdown: 8.3,
  openPositions: 3,
  positions: [
    { symbol: "BTC/USDT", size: 0.02, entryPrice: 45230, currentPnL: 7.00 }
  ]
}
```

#### GET `/api/analytics/signals/{symbol}`
Get signal analytics for a symbol

```typescript
Response {
  symbol: "BTC/USDT",
  totalSignalsGenerated: 156,
  accuracyRate: 0.62,
  averageRiskReward: 1.8,
  averageHoldingTime: 4.5,
  topPerformingPattern: "BREAKOUT",
  worstPerformingPattern: "RSI_OVERBOUGHT"
}
```

### ML APIs

#### POST `/api/ml/predict/{symbol}`
Get ML prediction for a symbol

```typescript
Query Parameters:
  timeframes: ["1m", "5m", "1h", "1d"] (optional)

Response {
  symbol: "BTC/USDT",
  predictions: {
    "1m": { direction: "BUY", probability: 0.72 },
    "5m": { direction: "BUY", probability: 0.75 },
    "1h": { direction: "BUY", probability: 0.88 },
    "1d": { direction: "HOLD", probability: 0.65 }
  },
  ensembleVote: "BUY",
  confidence: 0.78,
  models: {
    lstm: 0.75,
    transformer: 0.81,
    ensemble: 0.78
  }
}
```

#### POST `/api/ml/train`
Trigger model retraining

```typescript
Body {
  symbols: ["BTC/USDT", "ETH/USDT"],
  daysOfData: 365,
  testSize: 0.2,
  forceRetrain: false
}

Response {
  trainingId: "train_123",
  status: "STARTED",
  estimatedTime: "45 minutes"
}
```

#### GET `/api/ml/model-status`
Get ML model status

```typescript
Response {
  models: {
    lstm: {
      version: "v2.1",
      lastTraining: "2026-03-09",
      performance: { accuracy: 0.62, sharpeRatio: 1.4 },
      status: "ACTIVE"
    },
    transformer: {
      version: "v1.5",
      lastTraining: "2026-03-08",
      performance: { accuracy: 0.58, sharpeRatio: 1.2 },
      status: "ACTIVE"
    }
  }
}
```

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost/scanstream
NEON_DATABASE_URL=postgresql://...@db.neon.tech/...

# Exchange APIs
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
COINBASE_API_KEY=your_key
COINBASE_API_SECRET=your_secret
KRAKEN_API_KEY=your_key
KRAKEN_API_SECRET=your_secret

# Data Sources
COINGECKO_API_KEY=your_key
POLYGON_API_KEY=your_key

# ML/RL Configuration
ML_MODEL_PATH=./models
LSTM_MODEL_SIZE=medium
TRANSFORMER_MODEL_SIZE=medium

# Trading Configuration
PAPER_TRADING_INITIAL_CAPITAL=10000
LIVE_TRADING_INITIAL_CAPITAL=50000
MAX_POSITION_SIZE=0.05
MAX_ACCOUNT_HEAT=0.15
MAX_DAILY_LOSS=500

# Frontend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

---

## Common Development Tasks

### Adding a New Pattern Detector

1. Create detector file: `server/services/scanner/pattern-detectors/my-pattern.ts`

```typescript
import { MarketFrame } from '../../types';

export function detectMyPattern(frame: MarketFrame): { detected: boolean; confidence: number } {
  const { close, volume, high, low } = frame;
  
  // Your pattern detection logic
  const condition1 = close > volume * 0.5;
  const condition2 = high > low * 1.02;
  
  if (condition1 && condition2) {
    return { detected: true, confidence: 0.75 };
  }
  
  return { detected: false, confidence: 0 };
}
```

2. Add to scanner: `server/services/scanner/index.ts`

```typescript
import { detectMyPattern } from './pattern-detectors/my-pattern';

export function runPatternDetectors(frame: MarketFrame) {
  return {
    patterns: [
      ...otherPatterns,
      {
        type: 'MY_PATTERN',
        detected: detectMyPattern(frame).detected,
        confidence: detectMyPattern(frame).confidence
      }
    ]
  };
}
```

### Adding ML Training Data

1. Create training script in `server/services/`

```typescript
import { MarketDataFetcher } from './market-data/market-data-fetcher';
import { LSTMTrainer } from './lstm-trainer';

const fetcher = new MarketDataFetcher();
const trainer = new LSTMTrainer();

// Fetch 1 year of data
const data = await fetcher.fetchHistorical('BTC/USDT', '1d', 365);

// Prepare features
const features = data.map(candle => [
  candle.close,
  candle.volume,
  candle.rsi,
  candle.macd
]);

// Train model
await trainer.train(features);
```

### Adding New API Endpoint

1. Create route file: `server/routes/my-feature.ts`

```typescript
import { Router } from 'express';

const router = Router();

router.get('/api/my-feature/:symbol', async (req, res) => {
  const { symbol } = req.params;
  
  try {
    const result = await myFeatureLogic(symbol);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

2. Register in `server/index.ts`

```typescript
import myFeatureRouter from './routes/my-feature';

app.use(myFeatureRouter);
```

### Adding Frontend Component

1. Create component: `client/src/components/MyComponent.tsx`

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';

export function MyComponent({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-feature', symbol],
    queryFn: () => fetch(`/api/my-feature/${symbol}`).then(r => r.json())
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
}
```

2. Use in page: `client/src/pages/MyPage.tsx`

```typescript
import { MyComponent } from '../components/MyComponent';

export function MyPage() {
  return <MyComponent symbol="BTC/USDT" />;
}
```

---

## Performance Optimization

### Cache Strategies

```typescript
// Signal caching (10 seconds TTL)
const signalCache = new Map<string, CachedSignal>();
const SIGNAL_CACHE_TTL = 10000;

// Market data caching (1 second TTL)
const marketCache = new Map<string, CachedMarket>();
const MARKET_CACHE_TTL = 1000;
```

### Query Optimization

```typescript
// Use database indexes
CREATE INDEX idx_signals_symbol ON signals(symbol);
CREATE INDEX idx_signals_timestamp ON signals(timestamp);
CREATE INDEX idx_trades_status ON trades(status);

// Batch queries instead of N+1
const signals = await db.query.signals.findMany({
  where: eq(signals.symbol, 'BTC/USDT')
});
```

### Frontend Optimization

```typescript
// Use React.memo for expensive components
export const SignalCard = React.memo(({ signal }) => {
  return <div>Signal: {signal.direction}</div>;
});

// Debounce search input
const debouncedSearch = useCallback(
  debounce((value: string) => {
    fetchSignals(value);
  }, 300),
  []
);
```

---

## Testing

### Run Tests

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Write Unit Test

```typescript
// tests/services/signal-aggregator.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateSignals } from '../../server/services/unified-signal-aggregator';

describe('Signal Aggregator', () => {
  it('should combine multiple signal sources', () => {
    const signals = aggregateSignals([
      { source: 'scanner', confidence: 0.8 },
      { source: 'ml', confidence: 0.75 }
    ]);
    
    expect(signals.confidence).toBeGreaterThan(0.7);
  });
});
```

---

## Monitoring & Debugging

### View Logs

```bash
# Backend logs (macOS/Linux)
pnpm run logs

# Backend logs (Windows)
pnpm run logs:win

# View specific log file
cat logs/server-*.log
```

### Enable Debug Mode

```bash
# Enable debug logging
DEBUG=server:* pnpm run server

# Enable all debug
DEBUG=* pnpm run server
```

### Database Inspection

```bash
# Open Prisma Studio (if using Prisma)
pnpm run db:studio

# Or use Drizzle Studio
npx drizzle-kit studio
```

---

## Common Issues & Solutions

### Issue: WebSocket Connection Fails
**Solution**: Ensure WebSocket server is running on same port as Express server. Check in `server/index.ts`.

### Issue: ML Model Not Found
**Solution**: Set `MODEL_PATH` environment variable pointing to `/models` directory. Ensure models are downloaded.

### Issue: Exchange API Rate Limits
**Solution**: Add rate limiting middleware in `server/middleware/rate-limiter.ts` and implement request queuing.

### Issue: Database Connection Timeout
**Solution**: Check DATABASE_URL in `.env`, ensure PostgreSQL is running, check firewall rules.

### Issue: Frontend Blank Page
**Solution**: Check browser console for errors, ensure backend is running on port 3000, check VITE_API_URL.

---

## Resources

- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Express.js Guide**: https://expressjs.com/
- **React 18 Docs**: https://react.dev/
- **Drizzle ORM**: https://orm.drizzle.team/
- **CCXT Documentation**: https://github.com/ccxt/ccxt
- **TensorFlow.js**: https://www.tensorflow.org/js
- **Recharts**: https://recharts.org/

---

## Contributing Guidelines

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and write tests
3. Commit with clear messages: `git commit -m "Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Create Pull Request with description

---

## Additional Documentation

- [Complete Architecture](./SCANSTREAM_COMPLETE_END_TO_END_ARCHITECTURE.md)
- [Visual Architecture](./SCANSTREAM_VISUAL_ARCHITECTURE.md)
- [API Documentation](./API_TESTING_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Performance Tuning](./PERFORMANCE_OPTIMIZATION_GUIDE.md)
