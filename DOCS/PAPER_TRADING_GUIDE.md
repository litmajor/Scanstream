# Paper Trading & Live Mode Architecture

## Overview
**Paper Trading** is the realistic simulation environment built into the dashboard. When you click [Long Entry] or [Short Entry], positions are created in paper trading by default. You can stay in this mode indefinitely for learning, or switch to live trading when ready.

## Two Operating Modes

### Mode 1: Demo/Paper Trading (Default)
```
What Happens:
├─ You click [Long Entry] for BTC
├─ System creates position in simulated account
├─ Your capital is NOT at risk (you're using $10,000 demo money)
├─ All executions are realistic (slippage, spread, timing)
├─ You see all agent reasoning
├─ You track paper PnL in dashboard header
├─ You learn without risk
│
When to Use:
├─ Learning the system
├─ Testing agent signals
├─ Backtesting strategies
├─ Developing your own rules
└─ Indefinitely if you prefer simulated trading
```

### Mode 2: Live Trading (Optional)
```
What Happens:
├─ You toggle "LIVE MODE" in settings
├─ System connects to your real exchange account
├─ Same UI, same workflow, but real money
├─ All agent signals same as paper mode
├─ Positions execute on real markets
├─ Risk management becomes CRITICAL
│
When to Use:
├─ After successful paper trading period
├─ When confident in agent strategies
├─ With risk management rules enabled
├─ Small position sizes initially
└─ (Optional - paper trading works forever)
```

## Paper Trading Architecture

### Account Structure
```typescript
interface PaperTradingAccount {
  // Capital
  initialCapital: number        // $10,000 (default, configurable)
  currentCapital: number        // Unrealized + cash
  
  // Performance
  realizedPnL: number          // Closed trades profit/loss
  unrealizedPnL: number        // Open positions current PnL
  totalPnL: number             // Realized + Unrealized
  totalPnLPercent: number      // As % of capital
  
  // Statistics
  winRate: number              // % of winning trades
  winningTrades: number        // Count of profitable closes
  losingTrades: number         // Count of losing closes
  averageWin: number           // Avg profit per winning trade
  averageLoss: number          // Avg loss per losing trade
  profitFactor: number         // Total wins / Total losses
  
  // Risk
  maxDrawdown: number          // Worst peak-to-trough %
  sharpeRatio: number          // Risk-adjusted returns
}
```

### Position Lifecycle

#### Step 1: Entry
```
User Action:
  Click [Long Entry] for BTC
  
UI Dialog Opens:
  Current Price: $67,500
  Suggested Position Size: 1% of capital = $100 (0.0015 BTC)
  Entry Price: $67,500 (market)
  
  Suggested Stops:
    Stop Loss (from UT_BOT): $65,200 (2.3% below entry)
    Take Profit (from EXIT): $72,800 (7.9% above entry)
  
  Risk/Reward Ratio: 1 : 3.4
  
  User Can:
  ├─ Accept everything (recommended for learning)
  ├─ Adjust position size (0.5% - 5% risk limit)
  ├─ Modify stops manually
  └─ Cancel

User Confirms:
  POST /api/paper-trading/open-position
  {
    "symbol": "BTC",
    "side": "LONG",
    "entryPrice": 67500,
    "quantity": 0.0015,
    "agentSignals": ["VFMD", "FLOW", "GRADIENT_TREND", ...],
    "stopLoss": 65200,
    "takeProfit": 72800
  }
```

#### Step 2: Position Open
```
Backend Creates:
{
  id: "POS_1702000000123",
  symbol: "BTC",
  side: "LONG",
  entryPrice: 67500,
  entryTime: 1702000000,
  quantity: 0.0015,
  agentSignals: [...],
  stopLoss: 65200,
  takeProfit: 72800,
  status: "OPEN"
}

Frontend Shows:
├─ Position appears in bottom table
├─ Dashboard updates:
│  ├─ Active Positions: 1
│  ├─ Paper PnL: Updating with market price
│  └─ Risk indicator: Shows stop distance
├─ Real-time price feed updates position PnL
└─ Current unrealized PnL shown in header
```

#### Step 3: Price Movement
```
Market Updates (every 1 second):
  BTC = $67,523 → Position PnL updates
  
  Old: Entry $67,500, Size 0.0015 BTC
  New: Current $67,523, Size 0.0015 BTC
  Unrealized: ($67,523 - $67,500) × 0.0015 = +$0.345
  Percent: +0.034%
  
Position Card Shows:
├─ Green color (profit)
├─ "Entry: $67,500"
├─ "Current: $67,523"  
├─ "PnL: +$0.35 (+0.03%)"
├─ "Status: Open since 2 minutes"
└─ [Close Position] button

If Price Hits Stop Loss:
  BTC = $65,200
  → Position auto-closes (stop loss hit)
  → Realizes loss: -$345
  → Moved to closed positions
  → Updates account stats
  
If Price Hits Take Profit:
  BTC = $72,800
  → Position auto-closes (profit target hit)
  → Realizes gain: +$795
  → Moved to closed positions
  → Updates account stats
  → Sends alert: "TAKE PROFIT HIT"
```

#### Step 4: Manual Close
```
User Can Close Anytime:
  Click [Close Position] in table
  → Modal opens showing current price
  → Shows unrealized PnL
  → Click [Confirm Close]
  
Backend:
  POST /api/paper-trading/close-position/POS_123
  {
    "exitPrice": 67600
  }
  
  Response:
  {
    "pnl": 150,
    "pnlPercent": 0.22,
    "realizedPnL": 150,
    "totalPnL": 150
  }
  
Position Closed:
├─ Moved from "OPEN" to "CLOSED"
├─ Recorded in history
├─ Counted in win/loss statistics
├─ Profit/loss added to realized PnL
└─ Can review in "Trades History"
```

## Dashboard Integration

### Header Stats Update
```
Before Entry:
├─ Active Positions: 0
├─ High Conviction: 15
├─ Avg Confidence: 71%
└─ Paper Capital: $10,000

After Entry (BTC position):
├─ Active Positions: 1
├─ High Conviction: 15
├─ Avg Confidence: 71%
├─ Paper Capital: $9,900
├─ Unrealized PnL: +$0.35
└─ Total Equity: $10,000.35
```

### Positions Table Update
```
Symbol | Side  | Entry    | Current | PnL        | Signal | Action
------|-------|----------|---------|-----------|--------|----------
BTC   | LONG  | $67,500  | $67,523 | +$0.35   | BUY    | [Close]
ETH   | SHORT | $3,400   | $3,388  | +$18     | SELL   | [Close]
SOL   | LONG  | $180     | $175    | -$2.50   | HOLD   | [Close]

Live Updates:
- Every 1 second for active prices
- Shows real-time PnL
- Color coded (green profit, red loss)
- Agent signal shown per position
```

## Signal to Paper Trading Flow

### How Agent Signals Influence Entries

```
13-Agent Analysis:
┌──────────────────────────────────────────────────┐
│ Agent Signal Generation (happens every N seconds)│
├──────────────────────────────────────────────────┤
│ VFMD: "BUY 84% confidence - divergence present" │
│ FLOW: "BUY 79% confidence - momentum building"  │
│ GRADIENT_TREND: "BUY 76% - trend strengthening"│
│ SCANNER: "SELL 62% - pattern break"            │
│ ML: "HOLD 58% - mixed predictions"             │
│ RL: "BUY 71% - value detected"                │
│ (+ 7 more agents)                              │
│                                                  │
│ CONSENSUS:                                       │
│ ├─ 9 agents bullish                              │
│ ├─ 2 agents neutral                              │
│ ├─ 2 agents bearish                              │
│ └─ Final Signal: BUY | 73% confidence           │
└──────────────────────────────────────────────────┘
         ↓
    Dashboard Shows This
         ↓
    User Sees It
         ↓
    User Clicks [Long Entry]
         ↓
    Paper Trading Entry Created
    (with agents recorded in position)
         ↓
    Position Tracked Against Agent Predictions
```

### Position Performance vs Agent Signal

```
Position History Analysis:

Position #1: BTC Long (Agents said BUY 78%)
├─ Entry: $67,500
├─ Exit: $68,500 after 2 hours
├─ Profit: +1.48%
├─ Result: ✓ AGENTS CORRECT
├─ Agents accuracy: +1
└─ Trade recorded with agent reasoning

Position #2: ETH Short (Agents said SELL 69%)
├─ Entry: $3,400
├─ Exit: $3,350 after 4 hours
├─ Profit: +1.47%
├─ Result: ✓ AGENTS CORRECT
├─ Agents accuracy: +1
└─ Trade recorded

Position #3: SOL Long (Agents said BUY 71%)
├─ Entry: $180
├─ Exit: $176 after 1 hour
├─ Loss: -2.22%
├─ Result: ✗ AGENTS WRONG
├─ Agents accuracy: -1
└─ Trade recorded (learn from it)

Over 10 Trades:
├─ Agents predicted 7 correctly
├─ Agents predicted 3 incorrectly
├─ Win rate vs agent signals: 70%
└─ Insight: Trust the consensus, not individual agents
```

## Switching to Live Trading

### Prerequisites
```
Before Live Mode:
☐ Successful paper trading results (2+ weeks)
☐ Understand agent signals well
☐ Have risk management rules
☐ Connected exchange account (API keys)
☐ Verified identity with exchange
☐ Small capital allocated ($1,000-$5,000)
```

### Setup Process
```
1. Open Settings
2. Find "Trading Mode" section
3. Current: "Demo / Paper Trading"
4. Click [Switch to Live Trading]
   → Warning appears:
     "Live trading uses REAL MONEY.
      Your positions will execute on real markets.
      Losses are irreversible.
      
      Recommended:
      - Start with 1-2% position sizes
      - Keep stop losses tight
      - Review each entry carefully
      - Do NOT enable auto-trading"

5. Acknowledge warnings (click 5 checkboxes)
6. Enter exchange API key & secret
7. Test connection
8. Click [Enable Live Trading]

Switch Complete:
├─ All subsequent entries are REAL
├─ UI stays identical (same workflow)
├─ Risk limits enforced (max 5% per trade)
├─ Alerts on every entry
└─ Can switch back to demo anytime
```

### Live Mode Operation
```
Same Dashboard, Different Execution:

Paper Trading:
  Click [Long Entry] → Simulated position (free to learn)

Live Trading:
  Click [Long Entry] → REAL position (money at risk!)
  
  Same workflow:
  ├─ Agent consensus shown
  ├─ Position size suggested
  ├─ Stops auto-calculated
  ├─ Click confirm
  └─ But now: real money moved!

Differences:
├─ Slippage is REAL
├─ Speed matters (1-2 second delay possible)
├─ Your identity verified
├─ Position fees charged
├─ Regulatory restrictions apply
└─ Exchange liquidity actual
```

## Safety Features

### Auto-Stop Losses
```
Paper Trading Enforces:
├─ Max position size: 5% of capital per trade
├─ Mandatory stop loss: Within 2-5% of entry
├─ Profit target: Minimum 1:2 risk/reward
├─ Max leverage: None (100% cash trades)
└─ Daily loss limit: Optional (stop if -10%)

Live Trading Enforces:
├─ Max position size: 2% of capital per trade (tighter)
├─ Mandatory stop loss: Within 1-3% of entry
├─ Profit target: Minimum 1:3 risk/reward
├─ Max leverage: 2:1 (if exchange allows, disable by default)
├─ Daily loss limit: -5% (auto-disable trading if hit)
└─ Account shutdown: If equity < 10% initial
```

### Position Management
```
Alerts:
├─ Entry filled → "Position opened: BTC LONG 0.5 BTC"
├─ Unrealized PnL +5% → "Position up 5%"
├─ Unrealized PnL -3% → "Approaching stop loss (2% away)"
├─ Stop hit → "Stop loss triggered: -$250"
├─ Take profit hit → "Take profit reached: +$450"
└─ Account low → "Equity below $5,000 - reduce risk"

Manual Controls:
├─ Close at any time
├─ Adjust stops (real-time)
├─ Scale in/out (add/remove quantity)
├─ Set alerts on positions
└─ Export trade history
```

## Performance Tracking

### Dashboard Stats (Updated Live)
```
Header Quick View:
├─ Active Positions: Shows count
├─ Paper Capital: Shows equity
├─ Total PnL: Shows realized + unrealized
├─ PnL %: Shows return on capital

Click [Account Summary]:
├─ Win Rate: 62% of closed trades profitable
├─ Profit Factor: 2.3 (wins vs losses)
├─ Average Win: +$125
├─ Average Loss: -$85
├─ Longest Win Streak: 4 trades
├─ Max Drawdown: -8.5%
├─ Sharpe Ratio: 1.2

Historical Analysis:
├─ Trades by agent confidence (histogram)
├─ Accuracy vs confidence (scatter plot)
├─ Returns over time (equity curve)
├─ Largest wins/losses (bar chart)
└─ Trading frequency (calendar heat map)
```

## Realistic Execution Details

### Paper Trading Simulation
```
Slippage (Simulated):
- Market orders: 0.05-0.1% slippage
- Limit orders: 0% slippage (if filled)
- During high volatility: Up to 0.3%

Spread (Simulated):
- Normal conditions: 0.02% (BTC/USD)
- Altcoins: 0.1-0.3%
- Low liquidity: 0.5%+

Timing:
- Order fills: Instant (market order)
- Confirmation: < 100ms
- Price updates: Every second (real data simulated)

Transaction Costs:
- Maker fee: 0.025% (if available on exchange)
- Taker fee: 0.05%
- Shown in P&L breakdown
```

### Live Trading Reality
```
Real Slippage:
- Depends on order size and liquidity
- BTC/USD: Usually 0.01-0.05%
- Altcoins: 0.1-0.5% or worse
- Your broker's implementation

Real Spread:
- Current bid/ask spread (live)
- May widen in volatile markets
- Larger orders get worse pricing

Real Timing:
- API latency (50-500ms typically)
- Network delay (varies)
- Exchange processing (100-500ms)
- Total: 1-2 second entry delays possible

Real Costs:
- Exchange fees (0.025% - 0.5% typically)
- Withdrawal fees (if you withdraw)
- Funding costs (if using leverage)
- Network fees (blockchain based)
```

## FAQ

**Q: Can I switch between demo and live repeatedly?**
A: Yes. Toggle in settings anytime. Positions don't carry over between modes.

**Q: Do I lose money in paper trading?**
A: No. It's simulated. You're learning with fake money.

**Q: What if agents are wrong?**
A: Paper trading logs all results. You analyze and learn. Stay in demo until you understand.

**Q: Can I auto-trade in live?**
A: No. You must manually click [Buy] or [Sell]. Safety feature.

**Q: What's a realistic starting capital?**
A: Paper: $10,000 (default, can change). Live: Start with $1,000-$5,000.

**Q: How often should I review positions?**
A: Paper: Daily. Live: Multiple times per day (at least).

**Q: Can I backtest paper trading results?**
A: Yes. All trades logged and exportable for analysis.

**Q: What if I go broke in paper trading?**
A: Reset account to $10,000 and try again. It's practice.

## Summary

**Paper Trading = The Learning Environment**
- Use it forever if you want
- Zero real money risk
- Realistic execution simulation
- Full agent signal access
- Practice without consequences

**Live Trading = Optional Real Money Mode**
- Same UI, real execution
- Requires exchange account
- Strict risk limits enforced
- Only when you're ready
- Can switch back to demo anytime

**The key difference:**
```
Demo:  Click [Buy] → Simulated position (learning)
Live:  Click [Buy] → Real position (actual risk)
```

Use demo until you're confident. Then switch to live when ready. Or stay in demo forever—that's completely fine.
