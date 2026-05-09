/**
 * ML-Based Automated Trading System - Integration Guide
 * 
 * This document covers the complete integration of automated trading based on
 * ML consensus signals. It includes setup instructions, API examples, and best practices.
 */

# ML-Based Automated Trading Integration Guide

## Overview

The automated trading system executes real-time trades based on ML consensus recommendations. It combines:

- **ML Consensus Predictions** (6-timeframe weighted)
- **Confidence-based Position Sizing** (adjusts risk based on signal strength)
- **Automated Risk Management** (SL/TP, position limits, daily loss limits)
- **Real-time Monitoring** (active trades dashboard)
- **Real-time Notifications** (alignment alerts, signal changes)

## Architecture

```
ML Predictions (Multi-Timeframe Service)
        ↓
ML Consensus (Direction + Confidence)
        ↓
Trade Recommendation (CONFIRM/CAUTION)
        ↓
Risk Validation (Position sizing, limits)
        ↓
Trade Execution (Exchange API)
        ↓
Position Monitoring (Auto-close on SL/TP)
        ↓
Trade Analytics (Win rate, P&L tracking)
```

## Setup Instructions

### 1. Backend Setup

#### Step 1: Initialize Trading Service

```typescript
// In your main app initialization (app.ts or main server file)

import { MLAutomatedTradingService } from './services/ml-automated-trading-service';
import { MLMultiTimeframeService } from './services/multi-timeframe-ml-service';
import { LSTMBacktestEngine } from './services/lstm-backtest-engine';
import { PriceDataService } from './services/price-data-service';
import { TradeRepository } from './repositories/trade-repository';
import { PositionRepository } from './repositories/position-repository';

// Define risk configuration
const riskConfig = {
  maxPositionSizeUSD: 1000,        // Max $ per trade
  maxDailyLossUSD: 5000,           // Stop trading if daily loss exceeds this
  maxDrawdownPercent: 20,          // Max account drawdown %
  maxOpenPositions: 5,             // Max concurrent trades
  confirmConfidenceThreshold: 0.70, // Min confidence for CONFIRM signals
  cautionConfidenceThreshold: 0.60, // Min confidence for CAUTION signals
  confirmPositionSizePercent: 100,  // Use 100% of max for CONFIRM
  cautionPositionSizePercent: 50,   // Use 50% of max for CAUTION
  slippagePercent: 0.1,            // Expected slippage %
};

// Initialize service
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
```

#### Step 2: Create Trade Repositories

```typescript
// repositories/trade-repository.ts

import { ExecutedTrade } from '../services/ml-automated-trading-service';
import { Database } from '../database';

export class TradeRepository {
  constructor(private db: Database) {}

  async save(trade: ExecutedTrade): Promise<void> {
    await this.db.query(
      `INSERT INTO trades (id, symbol, direction, entry_price, quantity, position_size, 
       stop_loss, take_profit, confidence, recommendation, executed_at, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status=?, exit_price=?, exit_reason=?, profit_loss=?, 
       profit_loss_percent=?, closed_at=?`,
      [
        trade.id, trade.symbol, trade.direction, trade.entryPrice, trade.quantity,
        trade.positionSize, trade.stopLoss, trade.takeProfit, trade.confidence,
        trade.recommendation, trade.executedAt, trade.status, JSON.stringify(trade.metadata),
        trade.status, trade.exitPrice, trade.exitReason, trade.profitLoss,
        trade.profitLossPercent, trade.closedAt,
      ]
    );
  }

  async findById(id: string): Promise<ExecutedTrade | null> {
    const rows = await this.db.query(
      'SELECT * FROM trades WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async findBySymbol(symbol: string | undefined, limit: number): Promise<ExecutedTrade[]> {
    const query = symbol 
      ? 'SELECT * FROM trades WHERE symbol = ? ORDER BY executed_at DESC LIMIT ?'
      : 'SELECT * FROM trades ORDER BY executed_at DESC LIMIT ?';
    
    const params = symbol ? [symbol, limit] : [limit];
    return await this.db.query(query, params);
  }
}
```

#### Step 3: Add Trade Execution Gateway

```typescript
// services/exchange-connector.ts

export class ExchangeConnector {
  async placeTrade(trade: ExecutedTrade): Promise<{ orderId: string }> {
    // Connect to your exchange API (Binance, Kraken, etc.)
    // This example uses Binance
    
    const order = await this.binance.createOrder(
      trade.symbol,
      'limit',
      trade.direction === 'LONG' ? 'buy' : 'sell',
      trade.quantity,
      trade.entryPrice,
      {
        stopPrice: trade.stopLoss,
        // Set take profit using post-only order or advanced order types
      }
    );

    return { orderId: order.id };
  }

  async closeTrade(trade: ExecutedTrade, exitPrice: number): Promise<void> {
    await this.binance.createOrder(
      trade.symbol,
      'market',
      trade.direction === 'LONG' ? 'sell' : 'buy',
      trade.quantity
    );
  }
}
```

### 2. Frontend Setup

#### Step 1: Add Dashboard Component

```typescript
// pages/trading-dashboard.tsx

import { AutomatedTradingDashboard } from '@/components/AutomatedTradingDashboard';

export default function TradingDashboardPage() {
  return (
    <div>
      <AutomatedTradingDashboard refreshInterval={30000} />
    </div>
  );
}
```

#### Step 2: Add Real-Time Monitoring to Signals Page

```typescript
// pages/signals.tsx

import { MLConsensusWidget } from '@/components/MLConsensusWidget';
import { MLAlignmentMonitor } from '@/components/MLAlignmentMonitor';
import { AutomatedTradingDashboard } from '@/components/AutomatedTradingDashboard';

export default function SignalsPage() {
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

  return (
    <div className="space-y-6">
      {/* Real-time alignment notifications */}
      <MLAlignmentMonitor 
        symbols={symbols}
        enableSoundNotifications={true}
        showToast={true}
      />

      {/* ML consensus for each symbol */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {symbols.map(symbol => (
          <MLConsensusWidget 
            key={symbol}
            symbol={symbol}
          />
        ))}
      </div>

      {/* Automated trading dashboard */}
      <AutomatedTradingDashboard />
    </div>
  );
}
```

## API Endpoints

### Execute Trade

```
POST /api/ml/trades/execute
Content-Type: application/json

{
  "symbol": "BTC/USDT",
  "direction": "LONG",
  "confidence": 0.85,
  "recommendation": "CONFIRM",
  "entryPrice": 45000,
  "currentPrice": 45100,
  "reasonCode": "ML_CONSENSUS_6TF",
  "metadata": {
    "timeframes": ["1m", "5m", "15m", "1h", "4h", "1d"],
    "averageConfidence": 0.85,
    "alignmentStrength": "very_strong"
  }
}

Response:
{
  "success": true,
  "trade": {
    "id": "trade_1699564800000_xyz123",
    "symbol": "BTC/USDT",
    "direction": "LONG",
    "entryPrice": 45100.50,
    "quantity": 0.022,
    "positionSize": 1000,
    "stopLoss": 43900.00,
    "takeProfit": 46800.00,
    "confidence": 0.85,
    "executedAt": "2024-11-10T15:00:00Z",
    "status": "active"
  },
  "message": "Trade executed: BTC/USDT LONG 0.022@45100.50"
}
```

### Get Active Trades

```
GET /api/ml/trades/active

Response:
{
  "count": 2,
  "trades": [
    {
      "id": "trade_1699564800000_xyz123",
      "symbol": "BTC/USDT",
      "direction": "LONG",
      "entryPrice": 45100.50,
      "quantity": 0.022,
      "positionSize": 1000,
      "confidence": 0.85,
      "executedAt": "2024-11-10T15:00:00Z",
      "currentPrice": 45200,
      "unrealizedPL": 22.22,
      "unrealizedPLPercent": 2.22
    }
  ],
  "totalPositionSize": 2000
}
```

### Close Trade

```
POST /api/ml/trades/{tradeId}/close
Content-Type: application/json

{
  "exitPrice": 45500,
  "reason": "TAKE_PROFIT_HIT"
}

Response:
{
  "success": true,
  "trade": {
    "id": "trade_1699564800000_xyz123",
    "symbol": "BTC/USDT",
    "exitPrice": 45500,
    "exitReason": "TAKE_PROFIT_HIT",
    "profitLoss": 88.00,
    "profitLossPercent": 8.8,
    "closedAt": "2024-11-10T15:30:00Z",
    "status": "closed"
  },
  "message": "Trade closed: P&L $88.00 (8.8%)"
}
```

### Get Trade Statistics

```
GET /api/ml/trades/statistics?symbol=BTC/USDT

Response:
{
  "stats": {
    "totalTrades": 47,
    "winningTrades": 31,
    "losingTrades": 16,
    "winRate": 0.66,
    "averageProfitUSD": 145.32,
    "averageLossUSD": -89.45,
    "profitFactor": 2.15,
    "totalProfitLoss": 3456.78,
    "largestWin": 892.50,
    "largestLoss": -456.30,
    "maxConsecutiveWins": 7,
    "maxConsecutiveLosses": 3,
    "averageDurationMinutes": 127
  },
  "interpretation": {
    "winRate": { "value": "66%", "interpretation": "Profitable" },
    "profitFactor": { "value": "2.15", "interpretation": "Excellent" }
  }
}
```

### Auto-Close Trades

```
POST /api/ml/trades/auto-close

Response:
{
  "success": true,
  "closedCount": 3,
  "closedTrades": [
    {
      "id": "trade_1699564800000_xyz123",
      "symbol": "BTC/USDT",
      "exitPrice": 43900,
      "exitReason": "STOP_LOSS_HIT",
      "profitLoss": -1000,
      "profitLossPercent": -100
    }
  ],
  "totalProfitLoss": 456.78
}
```

### Update Risk Configuration

```
POST /api/ml/trades/settings/risk
Content-Type: application/json

{
  "maxPositionSizeUSD": 2000,
  "maxDailyLossUSD": 10000,
  "maxDrawdownPercent": 25,
  "maxOpenPositions": 10,
  "confirmConfidenceThreshold": 0.75,
  "cautionConfidenceThreshold": 0.65,
  "confirmPositionSizePercent": 100,
  "cautionPositionSizePercent": 60
}

Response:
{
  "success": true,
  "message": "Risk configuration updated",
  "config": { ... }
}
```

## Position Sizing Logic

The system implements confidence-based position sizing:

```typescript
// Base calculation
baseSize = maxPositionSize * (recommendation === 'CONFIRM' ? 100% : 50%)

// Confidence adjustment (0-1 scale)
finalSize = baseSize * confidence

// Example:
// - Confidence 0.85, CONFIRM: 1000 * 1.0 * 0.85 = $850
// - Confidence 0.70, CAUTION: 1000 * 0.5 * 0.70 = $350
```

**Why This Approach?**
- High confidence → Larger position
- Low confidence → Smaller position
- CONFIRM trades get full allocation
- CAUTION trades get half allocation
- Automatically reduces risk during uncertain market conditions

## Risk Management Rules

### Daily Loss Limit
- Stops trading if daily P&L falls below `-maxDailyLossUSD`
- Resets at midnight UTC
- Prevents catastrophic loss accumulation

### Maximum Drawdown
- Monitors peak-to-trough account drawdown
- Halts trading if drawdown exceeds threshold
- Helps preserve capital during losing streaks

### Max Open Positions
- Limits concurrent open trades
- Prevents over-leverage
- Default: 5 positions

### Per-Trade Limits
- Maximum position size: `maxPositionSizeUSD`
- Stop-loss: 1.5 × ATR below entry
- Take-profit: 3 × ATR above entry

## Best Practices

### 1. Start Conservative
```typescript
const initialConfig = {
  maxPositionSizeUSD: 500,        // Small initial size
  maxDailyLossUSD: 2000,          // Tight daily limit
  confirmConfidenceThreshold: 0.75, // High threshold
  cautionConfidenceThreshold: 0.70, // Rigorous filtering
};
```

### 2. Monitor Correlation
- Track if trades are highly correlated
- Adjust position sizing if too many same-direction trades
- Consider directional exposure limits

### 3. Regular Backtest
- Run backtests weekly/monthly
- Compare live performance to backtest
- Investigate if live performance diverges

### 4. Fine-tune Thresholds
```typescript
// Monitor win rate by confidence level
// Adjust thresholds to optimize Sharpe ratio
// Track Consecutive losses to identify regime changes
```

### 5. Use Notifications
```typescript
<MLAlignmentMonitor 
  symbols={['BTC/USDT', 'ETH/USDT']}
  enableSoundNotifications={true}  // Alert on direction changes
  onNotification={(notif) => {
    // Send to monitoring system
    console.log(`Alert: ${notif.message}`);
  }}
/>
```

## Monitoring Checklist

**Daily:**
- [ ] Check active trade count
- [ ] Monitor daily P&L
- [ ] Verify no emergency stops hit
- [ ] Review closed trades from previous day

**Weekly:**
- [ ] Analyze win rate trend
- [ ] Check profit factor
- [ ] Verify drawdown is within limits
- [ ] Compare live vs backtest performance

**Monthly:**
- [ ] Run fresh backtest
- [ ] Analyze best/worst performing symbols
- [ ] Review confidence threshold effectiveness
- [ ] Adjust risk config if needed

## Troubleshooting

**Problem: Trades not executing**
- Check ML confidence meets threshold
- Verify risk limits not exceeded
- Check exchange connectivity

**Problem: Large unexpected loss**
- Review trade entry/exit prices
- Check for slippage/gap issues
- Verify SL/TP levels

**Problem: Win rate dropped**
- Check market regime change
- Verify ML models still calibrated
- Consider temporary halt to investigate

## Summary

The automated trading system:
- ✅ Executes trades based on ML consensus
- ✅ Sizes positions based on confidence
- ✅ Implements comprehensive risk management
- ✅ Provides real-time monitoring
- ✅ Offers detailed analytics

Start conservative, monitor carefully, and adjust gradually as you gain confidence.
