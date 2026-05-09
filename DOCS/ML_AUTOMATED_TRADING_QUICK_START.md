/**
 * ML-Based Automated Trading - Quick Start Guide
 * 
 * Get automated trading up and running in 5 minutes.
 */

# 🤖 Automated Trading Quick Start (5 Minutes)

## What You Get

- **Automated Trade Execution** based on ML signals
- **Position Sizing** that scales with confidence
- **Risk Management** (stop-loss, take-profit, daily limits)
- **Real-time Monitoring Dashboard**
- **Trade Statistics & Analytics**

## Prerequisites

- ✅ ML Multi-Timeframe Service running (6-timeframe consensus)
- ✅ LSTM Backtest Engine available
- ✅ Price data service connected
- ✅ Trade database tables created

## 5-Minute Setup

### Step 1: Create Database Tables (30 seconds)

```sql
CREATE TABLE trades (
  id VARCHAR(255) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  direction ENUM('LONG', 'SHORT') NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  position_size DECIMAL(20, 2) NOT NULL,
  stop_loss DECIMAL(20, 8) NOT NULL,
  take_profit DECIMAL(20, 8) NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL,
  recommendation ENUM('CONFIRM', 'CAUTION') NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  status ENUM('active', 'closed', 'error') NOT NULL,
  exit_price DECIMAL(20, 8),
  exit_reason VARCHAR(100),
  profit_loss DECIMAL(20, 2),
  profit_loss_percent DECIMAL(5, 2),
  closed_at TIMESTAMP,
  metadata JSON,
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_executed_at (executed_at)
);

CREATE TABLE positions (
  id VARCHAR(255) PRIMARY KEY,
  trade_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  current_price DECIMAL(20, 8),
  unrealized_pl DECIMAL(20, 2),
  FOREIGN KEY (trade_id) REFERENCES trades(id)
);
```

### Step 2: Initialize Service in Backend (1 minute)

```typescript
// In your main app.ts or server file

import { MLAutomatedTradingService } from './services/ml-automated-trading-service';
import mlAutomatedTradingRoutes from './routes/ml-automated-trading';

// Risk configuration (start conservative!)
const riskConfig = {
  maxPositionSizeUSD: 500,         // Small initial size
  maxDailyLossUSD: 2000,           // Stop if losing > $2000/day
  maxDrawdownPercent: 20,          // Stop if account down 20%
  maxOpenPositions: 3,             // Max 3 simultaneous trades
  confirmConfidenceThreshold: 0.75, // Need 75%+ for auto trades
  cautionConfidenceThreshold: 0.65, // Need 65%+ for cautious trades
  confirmPositionSizePercent: 100,  // Use full allocation for CONFIRM
  cautionPositionSizePercent: 50,   // Use half allocation for CAUTION
  slippagePercent: 0.1,            // Expect 0.1% slippage
};

const tradingService = new MLAutomatedTradingService(
  mlService,
  backtestEngine,
  priceService,
  tradeRepository,
  positionRepository,
  riskConfig
);

// Register routes
import { setTradingService } from './routes/ml-automated-trading';
setTradingService(tradingService);
app.use('/api/ml/trades', mlAutomatedTradingRoutes);

// Optional: Auto-close expired trades every 60 seconds
setInterval(async () => {
  await tradingService.autoCloseExpiredTrades();
}, 60000);
```

### Step 3: Add Dashboard to Frontend (2 minutes)

```typescript
// Add to your signals page (pages/signals.tsx or similar)

import { AutomatedTradingDashboard } from '@/components/AutomatedTradingDashboard';
import { MLAlignmentMonitor } from '@/components/MLAlignmentMonitor';

export default function SignalsPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Real-time notifications */}
      <MLAlignmentMonitor 
        symbols={['BTC/USDT', 'ETH/USDT']}
        enableSoundNotifications={true}
      />

      {/* Automated trading dashboard */}
      <AutomatedTradingDashboard refreshInterval={30000} />
    </div>
  );
}
```

### Step 4: Start Your App (1 minute)

```bash
# Terminal
npm run build
npm start

# Server should log:
# ✓ ML Automated Trading Service initialized
# ✓ Trade routes registered
# ✓ Dashboard components loaded
```

## That's It! 🎉

You now have:
- ✅ Automated trade execution from ML signals
- ✅ Real-time trading dashboard
- ✅ Risk management safeguards
- ✅ Trade history and analytics

## First Trade Example

**ML Signal Detected:**
```
Symbol: BTC/USDT
Direction: LONG (consensus)
Confidence: 0.85 (85%)
Recommendation: CONFIRM (high-confidence signal)
```

**Automatic Trade Execution:**
```
1. Check risk limits ✓ (under daily loss limit, max positions not reached)
2. Calculate position size: $500 * 1.0 * 0.85 = $425
3. Calculate SL/TP from ATR
4. Execute trade on exchange
5. Entry: $45,100 | Qty: 0.0094 | SL: $43,900 | TP: $46,800
```

**Real-time Monitoring:**
- Watch active trade on dashboard
- See real-time P&L updates
- Receive alerts if price hits SL/TP
- Manual close option available

## Dashboard Features

**Active Trades Table:**
| Symbol | Dir | Entry | Current | P&L | Conf | Action |
|--------|-----|-------|---------|-----|------|--------|
| BTC/USDT | LONG | $45,100 | $45,200 | +$22 (2.2%) | 85% | Close |
| ETH/USDT | SHORT | $2,850 | $2,800 | +$45 (1.6%) | 78% | Close |

**Risk Metrics:**
- Active Trades: 2/5
- Total Position Size: $925/5000 (18.5%)
- Unrealized P&L: +$67
- Win Rate: 65% (31W/16L)

**Performance Charts:**
- Win/Loss pie chart
- P&L history
- Trade distribution

## Configuration Examples

### Conservative Setup (Beginners)
```typescript
const riskConfig = {
  maxPositionSizeUSD: 250,
  maxDailyLossUSD: 1000,
  maxOpenPositions: 2,
  confirmConfidenceThreshold: 0.80,  // Very high bar
  cautionConfidenceThreshold: 0.70,
};
```

### Aggressive Setup (Experienced)
```typescript
const riskConfig = {
  maxPositionSizeUSD: 2000,
  maxDailyLossUSD: 10000,
  maxOpenPositions: 10,
  confirmConfidenceThreshold: 0.65,  // Lower bar
  cautionConfidenceThreshold: 0.55,
};
```

### Balanced Setup (Recommended)
```typescript
const riskConfig = {
  maxPositionSizeUSD: 750,
  maxDailyLossUSD: 3000,
  maxOpenPositions: 5,
  confirmConfidenceThreshold: 0.72,
  cautionConfidenceThreshold: 0.62,
};
```

## Test Your Setup

### 1. Manual Test Trade

```bash
# Execute a test trade
curl -X POST http://localhost:3000/api/ml/trades/execute \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "direction": "LONG",
    "confidence": 0.85,
    "recommendation": "CONFIRM",
    "entryPrice": 45000,
    "currentPrice": 45100,
    "reasonCode": "TEST_TRADE"
  }'
```

### 2. Check Active Trades

```bash
curl http://localhost:3000/api/ml/trades/active
```

Expected response:
```json
{
  "count": 1,
  "trades": [{
    "id": "trade_1699564800000_xyz123",
    "symbol": "BTC/USDT",
    "direction": "LONG",
    "status": "active"
  }]
}
```

### 3. Check Dashboard

Visit: `http://localhost:3000/trading-dashboard`

You should see your test trade listed!

## Common Issues

**Q: No trades executing?**
A: Check if ML confidence meets threshold (default 75% for CONFIRM)

**Q: Dashboard shows no trades?**
A: Run test trade first (see above)

**Q: Getting "Daily loss limit exceeded"?**
A: Increase `maxDailyLossUSD` in risk config or close losing trades

**Q: Trades not closing on SL/TP?**
A: Check if auto-close job is running (happens every 60 seconds)

## Next Steps

1. **Monitor for 1 day** - Watch dashboard, verify trades executing correctly
2. **Increase position size** - If comfortable, increase `maxPositionSizeUSD`
3. **Adjust thresholds** - Fine-tune confidence levels based on win rate
4. **Add more symbols** - Trade multiple assets simultaneously
5. **Review statistics** - Check `/api/ml/trades/statistics` endpoint

## Quick API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/trades/execute` | POST | Execute new trade |
| `/trades/active` | GET | List open trades |
| `/trades/{id}` | GET | Trade details |
| `/trades/{id}/close` | POST | Close trade |
| `/trades/history` | GET | Trade history |
| `/trades/statistics` | GET | Win rate, P&L stats |
| `/trades/auto-close` | POST | Close expired trades |
| `/trades/settings/risk` | POST | Update risk config |

## What's Happening Behind The Scenes

```
Every minute (1m candle close):
  1. ML system generates 6-timeframe predictions
  2. Calculates weighted consensus (direction + confidence)
  3. Checks if confidence meets threshold
  4. Validates against risk management rules
  5. Auto-executes trade if all checks pass
  6. Updates active trades on dashboard
  7. Checks for SL/TP hits on existing trades

Every 60 seconds:
  1. Re-evaluates all open positions
  2. Auto-closes if SL/TP hit
  3. Auto-closes if ML confidence dropped too low
  4. Updates performance statistics
  5. Sends notifications if alignment changed
```

## Support

See full documentation: `ML_AUTOMATED_TRADING_INTEGRATION_GUIDE.md`

Questions? Check the troubleshooting section or review API examples.

---

**🚀 Ready to go!** Start trading with confidence-based position sizing.
