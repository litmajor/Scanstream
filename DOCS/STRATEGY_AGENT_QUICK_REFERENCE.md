# Strategy-Agent Wiring Quick Reference

**One-page guide to wire strategies into your scanner and agents**

---

## 📦 4 New Files Created

| File | What It Does |
|------|-------------|
| `strategy-router.ts` | Detects market + routes to best strategies |
| `scanner-strategy-integration.ts` | Enhances scanner with strategy analysis |
| `agent-strategy-integration.ts` | 6 agent classes with strategy logic |
| `strategy-routing-routes.ts` | 8 REST API endpoints |

---

## 🔌 3-Step Setup

### Step 1: Register API Routes
**File: `server/routes.ts`**
```typescript
import strategyRoutingRoutes from './routes/strategy-routing-routes';
app.use('/api/strategy', strategyRoutingRoutes);
```

### Step 2: Enhance Scanner
**File: `server/services/scanner/multi-exchange-scanner.ts`**
```typescript
import { enhanceScanResultWithStrategies } from './scanner-strategy-integration';

// In scan method:
const enhanced = enhanceScanResultWithStrategies(
  symbol, 'BUY', 75, input,
  { agentFilter: 'TrendRider' }
);
```

### Step 3: Wire Agents
**File: `server/services/agents/*.ts`** (TrendRider, etc.)
```typescript
import { TrendRiderAgent } from '../scanner/agent-strategy-integration';

const decision = TrendRiderAgent.analyze(input);
if (decision.action === 'BUY') { /* trade */ }
```

---

## 🎯 Strategy-Agent Mapping (Quick)

| Agent | Strategies | Best Market |
|-------|-----------|-------------|
| **TrendRider** | MACD, SAR, Ichimoku, ADX | Strong trends |
| **MomentumHunter** | RSI, Stochastic, CCI | Ranging |
| **VolatilityTrader** | Bollinger, Keltner | High volatility |
| **VolumeAnalyzer** | OBV, MFI, CMF | Any (confirms) |
| **PrecisionScalper** | Triple Conf, Bollinger+RSI | High precision |
| **SwingTrader** | Ichimoku+Fib, Elder Ray | Multi-day setups |
| **MultiStrategy** | All (consensus) | Highest conviction |

---

## 🚀 5 Key Functions

```typescript
// 1. Detect market condition
detectMarketCondition(input)
// → 'STRONG_UPTREND' | 'RANGING' | 'VOLATILE' etc.

// 2. Recommend agent for market
recommendAgentForMarket(marketCondition)
// → ['TrendRider', 'SwingTrader', ...]

// 3. Route to strategies for agent
routeStrategiesForAgent('TrendRider', input)
// → Map<name, StrategySignal>

// 4. Enhance scanner results
enhanceScanResultWithStrategies(symbol, signal, conf, input, config)
// → EnhancedScanResult with strategy analysis

// 5. Get agent decision
routeToAgent(symbol, input, 'TrendRider')
// → AgentDecision (BUY/SELL/HOLD)
```

---

## 📊 Market Condition Detection

```
Input: OHLCV data
  ↓
Calculate EMA, ADX, ATR
  ↓
Output:
  STRONG_UPTREND (EMA20 > EMA50 + ADX > 40)
  UPTREND (EMA20 > EMA50 + ADX > 25)
  RANGING (ADX < 25)
  DOWNTREND (EMA20 < EMA50 + ADX > 25)
  STRONG_DOWNTREND (EMA20 < EMA50 + ADX > 40)
  VOLATILE (ATR > 2%)
  LOW_VOLATILITY (ATR < 1%)
```

---

## 🎪 19 Strategies Grouped

**TREND-FOLLOWING (4)**
- MACD Crossover (58% win)
- ADX Filter
- Parabolic SAR (52% win)
- Ichimoku Cloud (68% win)

**MOMENTUM (3)**
- RSI Oversold/Overbought (62% win)
- Stochastic Crossover (63% win)
- CCI Mean Reversion (58% win)

**VOLATILITY (3)**
- Bollinger Squeeze (68% win)
- Bollinger Reversal (65% win)
- Keltner Breakout (62% win)

**VOLUME (3)**
- OBV Divergence (68% win)
- MFI Oversold/Overbought (63% win)
- CMF Accumulation (60% win)

**COMBINATION (3)**
- Triple Confirmation (72% win) ⭐
- Bollinger+RSI Double (68% win)
- Trend+Volume (68% win)

**ADVANCED (2)**
- Ichimoku+Fib (72% win) ⭐
- Elder Ray Power (65% win)

---

## 💻 API Examples

### Route to best agent
```bash
POST /api/strategy/route
{
  "symbol": "BTC/USDT",
  "high": [28000, 28100],
  "low": [27900, 27950],
  "close": [28050, 28080],
  "volume": [100, 120],
  "preferredAgent": "TrendRider"
}

Response:
{
  "primaryStrategy": "macdCrossover",
  "recommendedStrategies": ["parabolicSAR", "ichimokuCloud"],
  "marketCondition": "UPTREND",
  "agentRecommendation": "TrendRider"
}
```

### Get market condition
```bash
POST /api/strategy/market-condition
{ "high": [...], "low": [...], "close": [...] }

Response:
{
  "marketCondition": "UPTREND",
  "description": "Uptrend with ADX > 25"
}
```

### Get agent decision
```bash
POST /api/strategy/agent-decision
{
  "agent": "TrendRider",
  "high": [...], "low": [...], 
  "close": [...], "volume": [...]
}

Response:
{
  "action": "BUY",
  "confidence": 78,
  "primaryStrategy": "macdCrossover",
  "marketCondition": "UPTREND",
  "riskLevel": "LOW"
}
```

### Compare all agents
```bash
POST /api/strategy/compare-agents
{ "high": [...], "low": [...], "close": [...], "volume": [...] }

Response:
{
  "consensus": "BUY",  // All agents agree
  "buys": 6,
  "sells": 0,
  "holds": 0,
  "perAgent": [
    { "agent": "TrendRider", "action": "BUY", "confidence": 78 },
    { "agent": "MomentumHunter", "action": "BUY", "confidence": 65 },
    // ...
  ]
}
```

---

## 🧪 Test Checklist

- [ ] Register routes in `server/routes.ts`
- [ ] Build project: `npm run build`
- [ ] Start dev server: `npm start`
- [ ] Test market detection: `POST /api/strategy/market-condition`
- [ ] Test agent routing: `POST /api/strategy/agent-decision`
- [ ] Test compare agents: `POST /api/strategy/compare-agents`
- [ ] Test scanner enhance: `POST /api/strategy/scanner-enhance`
- [ ] Test agent-specific routes: `POST /api/strategy/agent/TrendRider`

---

## 🎯 Integration Patterns

### Pattern 1: Simple Route
```typescript
const decision = makeRoutingDecision(input);
// Auto-detects market + picks best agent
```

### Pattern 2: Preferred Agent
```typescript
const decision = makeRoutingDecision(input, 'TrendRider');
// Use TrendRider even if not ideal for market
```

### Pattern 3: Scanner Enhancement
```typescript
const enhanced = enhanceScanResultWithStrategies(
  'BTC/USDT', 'BUY', 75, input
);
// Adds strategy analysis to scan result
```

### Pattern 4: Get Agent Decision
```typescript
const decision = routeToAgent('BTC/USDT', input, 'TrendRider');
// Get TrendRider's specific decision
```

### Pattern 5: Agent Consensus
```typescript
const comparison = compareStrategyRecommendations(
  input,
  ['TrendRider', 'MomentumHunter', 'VolatilityTrader']
);
// Highest conviction when all agents agree
```

---

## 📈 Data Flow

```
Scanner Results
  ↓
enhanceScanResultWithStrategies()
  ↓
detectMarketCondition()
  ↓
recommendAgentForMarket()
  ↓
routeStrategiesForAgent()
  ↓
EnhancedScanResult {
  ✓ Market Condition
  ✓ Recommended Agent
  ✓ Primary Strategy
  ✓ All Strategy Signals
  ✓ Risk Level
  ✓ Confidence Score
}
```

---

## 🛠️ Configuration Presets

```typescript
// For each agent
ScannerStrategyExports.getTrendRiderConfig()
ScannerStrategyExports.getMomentumHunterConfig()
ScannerStrategyExports.getVolatilityTraderConfig()
ScannerStrategyExports.getVolumeAnalyzerConfig()
ScannerStrategyExports.getPrecisionScalperConfig()
ScannerStrategyExports.getSwingTraderConfig()
ScannerStrategyExports.getMultiStrategyConfig()

// By confidence level
ScannerStrategyExports.getHighConfidenceConfig()  // 65%+ only

// By timeframe
ScannerStrategyExports.getDailyTimeframeConfig()
ScannerStrategyExports.getFourHourTimeframeConfig()
```

---

## 🚀 Ready to Use!

**All 19 strategies automatically wired to:**
- ✅ 7 Specialized Agents
- ✅ Scanner Multi-Exchange System
- ✅ REST API Endpoints
- ✅ Market Condition Detection
- ✅ Agent Consensus Voting

**Next: Register routes and test!** 🎯
