# Main Dashboard & Paper Trading — Complete Setup

## 🎯 What's Ready to Use

### New Main Dashboard
**File**: `client/src/pages/dashboard.tsx` (600+ lines)

Your new home page features:
- **13 Agent Consensus Hub** - All agents analyzing same asset
- **Market Watchlist** - Curated by Top Volume, Top Confidence, High Conviction
- **Real-time Alerts** - Filtered by type and severity
- **Active Positions** - Quick view of open trades
- **Paper Trading Ready** - Click [Long Entry] or [Short Entry] to trade

### How It Works

1. **Open Dashboard** (it's now the homepage)
2. **Select Asset** from left panel (or search)
3. **See Consensus** - All 13 agents analyzed by center panel
4. **Read Agent Cards** - Why each agent says BUY/SELL/HOLD
5. **Click [Long Entry] or [Short Entry]**
6. **Paper Trading** creates position (or live if enabled)
7. **Track in Bottom Table** - Live PnL updates

## 📊 Dashboard Layout

```
┌───────────────────────────────────────────────────────────┐
│ HEADER: Portfolio $10,000 | 0 Active | 15 High Conviction │
├─────────────────────┬──────────────────────┬──────────────┤
│ LEFT (25%)          │ CENTER (50%)         │ RIGHT (25%)  │
├─────────────────────┼──────────────────────┼──────────────┤
│ Market Watch        │ BTC Consensus        │ Alerts       │
│ • Search            │                      │ • Filter     │
│ • Top Volume        │ CONSENSUS CARD:      │ • HIGH_CONV  │
│ • Top Confidence    │ ├─ Signal: BUY       │ • ENTRY      │
│ • High Conviction   │ ├─ 73% Confidence   │ • LIQUIDITY  │
│                     │ ├─ Risk: LOW         │              │
│ Asset List:         │ └─ 9/13 Bullish      │ Alert List:  │
│ BTC ▼ $67,500       │                      │ [HIGH_CONV]  │
│ ETH ▼ $3,400        │ AGENT GRID (2 cols): │ BTC bullish  │
│ SOL ▼ $180          │ ├─ VFMD: BUY 84%    │ [Act Now]    │
│ ... (15 total)      │ ├─ FLOW: BUY 79%    │              │
│                     │ ├─ GRADIENT: BUY 76% │ ... (active  │
│                     │ ├─ SCANNER: SELL 62% │ alerts)     │
│                     │ ├─ ML: HOLD 58%      │              │
│                     │ ├─ RL: BUY 71%       │              │
│                     │ ├─ EXIT: BUY 68%     │              │
│                     │ ├─ OPPOSITION: BUY   │              │
│                     │ ├─ MICRO: HOLD 61%   │              │
│                     │ ├─ UT_BOT: BUY 82%   │              │
│                     │ ├─ MEAN_REV: BUY 69% │              │
│                     │ ├─ VOL_PROF: BUY 73% │              │
│                     │ └─ MKT_STRUCT: BUY   │              │
│                     │                      │              │
│                     │ [Long Entry] [Short] │              │
└─────────────────────┴──────────────────────┴──────────────┘
│ BOTTOM (100%):                                             │
│ Active Positions Table                                     │
│ Symbol | Side | Entry | Current | PnL | Agents | Action   │
├────────────────────────────────────────────────────────────┤
│ (Your open positions would show here)                      │
└────────────────────────────────────────────────────────────┘
```

## 🎮 Quick Start Guide

### First Time Using Dashboard

1. **App starts** → You see dashboard
2. **Left panel shows** → Top 15 assets by volume
3. **Click any asset** (e.g., BTC)
4. **Center updates** → All 13 agents analyzing BTC
5. **Read the consensus** → "BUY 73% confidence"
6. **Check the cards** → Why each agent says what it says
7. **Click [Long Entry]** → Dialog for position size
8. **Confirm** → Position appears in bottom table
9. **Watch PnL** → Updates live as price moves
10. **Close anytime** → Click [Close] in table

### Asset Selection Methods

**Method 1: Scroll & Click**
```
Left panel shows 15 assets sorted by volume
Scroll down, click any asset
→ Center updates immediately
```

**Method 2: Search**
```
Type "ETH" in search box
→ Filters to show only ETH and related
→ Click to select
```

**Method 3: Filter Categories**
```
"Top Volume" (default)
- Shows highest volume assets first
- Good for liquidity, safer trading

"Top Confidence" 
- Shows highest agent confidence scores
- Consensus says "most sure about these"

"High Conviction"
- Only shows 8+ agents bullish
- Filtered for high-probability entries
```

## 🔧 Features Explained

### Consensus Signal Card
```
Shown in center panel, top section:

┌──────────────────────────────────┐
│ BTC                              │
│ $67,500 (↑ 2.3%)                │
├──────────────────────────────────┤
│ Consensus: BUY                   │ ← Final signal
│ Confidence: 73%                  │ ← Avg of 13 agents
│ Risk Level: LOW                  │ ← Based on spread
│ Agents: 9 Buy, 2 Hold, 2 Sell   │ ← Vote breakdown
├──────────────────────────────────┤
│ [Long Entry]  [Short Entry]      │ ← Click to trade
└──────────────────────────────────┘
```

### Agent Signal Cards
```
Each agent gets a color-coded card:

VFMD (Red tone)              UT_BOT (Emerald tone)
┌─────────────────┐          ┌─────────────────┐
│ 👁️ VFMD          │          │ 🛑 UT_BOT        │
│ Entry Specialist │          │ Stop Specialist │
├─────────────────┤          ├─────────────────┤
│ BUY (84%)       │          │ BUY (82%)       │
│                 │          │                 │
│ Why:            │          │ Why:            │
│ Divergence      │          │ ATR stop        │
│ detected        │          │ placed well     │
│ in vector       │          │ Risk: $1,200    │
│ field           │          │                 │
│                 │          │                 │
│ Accuracy: 76%   │          │ Accuracy: 84%   │
└─────────────────┘          └─────────────────┘

FLOW (Blue tone)
┌─────────────────┐
│ 🌀 FLOW          │
│ Momentum        │
├─────────────────┤
│ BUY (79%)       │
│                 │
│ Why:            │
│ Momentum        │
│ building fast   │
│ Force vectors   │
│ aligned up      │
│                 │
│ Accuracy: 71%   │
└─────────────────┘

... (13 total cards, 2 columns)
```

Each card shows:
- **Icon** - Visual identifier
- **Name** - Agent name
- **Type** - What it specializes in
- **Signal** - BUY/SELL/HOLD
- **Confidence** - % certainty (top of card)
- **Why** - Primary reasoning (1-2 sentences)
- **Accuracy** - Historical success rate
- **Color** - Agent type color scheme

### Watchlist Panel Features

**Search Box**
```
Type to filter assets real-time:
- "BTC" → Shows only BTC
- "sol" → Shows SOL/USDC pairs
- Clear to see all again
```

**Filter Buttons** (pick one)
```
Top Volume (default)
├─ BTC (Highest volume)
├─ ETH
├─ SOL
└─ ... (sorted by trading volume)

Top Confidence
├─ BTC (Agent consensus highest)
├─ ETH
├─ XRP
└─ ... (sorted by agent confidence)

High Conviction
├─ Only assets with 8+ agents bullish
├─ BTC (9/13 bullish)
├─ ETH (8/13 bullish)
└─ ... (pre-filtered for strong setups)
```

**Asset Cards** (clickable)
```
Each asset shows:
┌────────────────────────┐
│ BTC           ▼ BUY   │ ← Symbol & Signal
├────────────────────────┤
│ Price: $67,500         │ ← Current price
│ Agents: 9/13 bullish   │ ← How many agree
│ Conf: 73%              │ ← Agent consensus
└────────────────────────┘
```

### Alerts Center

**Filter Buttons** (pick one)
```
All Alerts
├─ HIGH_CONVICTION (8+ agents agree)
├─ ENTRY_READY (setups complete)
├─ LIQUIDITY_WARNING (slippage risk)
└─ (all active alerts)

High Conviction Only
├─ CRITICAL severity only
├─ 8+ agents bullish

Entry Ready Only
├─ Position sizing suggested
├─ Stops calculated
├─ Ready to trade now

Liquidity Warnings Only
├─ Low volume detected
├─ Spread too wide
├─ Risk warning
```

**Alert Card**
```
┌──────────────────────────────────┐
│ BTC          HIGH_CONVICTION    │ ← Type
├──────────────────────────────────┤
│ 11/13 agents bullish at $67,500 │ ← Message
│ Entry confidence: 78%            │
│ Risk: LOW | Stop: $65,200        │
│ Take Profit: $72,800            │
├──────────────────────────────────┤
│ [Act Now]                        │ ← Click to trade
└──────────────────────────────────┘

Colors:
CRITICAL (Red) - High risk alert
WARNING (Yellow) - Caution needed
INFO (Blue) - Just information
```

## 📍 How to Find Things

### Where is the Dashboard?
```
Open app → You're on it (homepage /)
In sidebar → "Dashboard" at the top
Direct URL → localhost:5000/
```

### How to Get to Other Pages?
```
From Dashboard:
├─ Sidebar [Signals] → /signals
├─ Sidebar [Scanner] → /scanner (for manual scans)
├─ Sidebar [Paper Trading] → /paper-trading (detail view)
├─ Sidebar [Portfolio] → /portfolio (historical stats)
└─ Sidebar [Settings] → /settings (configure)

TradingTerminal Moved:
└─ Now at /trading-terminal (was homepage before)
```

## 💰 Paper Trading Explained

### Entry Flow
```
1. Click [Long Entry] or [Short Entry]
   ↓
2. Entry Price: $67,500 (current market)
   Position Size: 1% of capital = $100
   Stop Loss: $65,200 (suggested by UT_BOT)
   Take Profit: $72,800 (suggested by EXIT agent)
   ↓
3. Can adjust any value before confirming
   ↓
4. Click [Confirm Entry]
   ↓
5. Position created in paper trading
   Capital: $10,000 - $100 = $9,900 available
   Unrealized PnL: Updates with price
```

### Realistic Features
```
Paper trading simulates:
✓ Slippage (0.05-0.1% on entry)
✓ Spread (bid/ask difference)
✓ Fees (0.025-0.05% per trade)
✓ Timing (instant market orders)
✓ Stop losses (auto-close at price)
✓ Take profits (auto-close at price)
✓ Position sizing rules (max 5% per trade)
✓ Risk management (mandatory stops)
```

### Position Tracking
```
In bottom table, each position shows:
│ Symbol │ Side  │ Entry  │ Current │ PnL      │ Signal │ Action │
├────────┼───────┼────────┼─────────┼──────────┼────────┼────────┤
│ BTC    │ LONG  │ 67,500 │ 67,523  │ +$35     │ BUY    │ Close  │
│ ETH    │ SHORT │ 3,400  │ 3,388   │ +$18     │ SELL   │ Close  │
│ SOL    │ LONG  │ 180    │ 175     │ -$2.50   │ HOLD   │ Close  │

- Price updates every second
- PnL updates in real-time
- Close button to exit position
- Agent signal shown for transparency
```

## ⚙️ Configuration (Settings)

### Available Settings
```
Paper Trading Account:
├─ Initial Capital: $10,000 (can change)
├─ Max Position Size: 5% per trade
├─ Min Risk/Reward: 1:2
└─ Daily Loss Limit: Optional

Alerts:
├─ Min Agent Consensus: 5/13 (can set to 8/13)
├─ Auto-Alert on: High conviction only
└─ Sound/Visual: On/Off

Scanner Integration:
├─ Auto-run scans: Off (manual only)
├─ Alert on results: Yes
└─ Default criteria: Oversold reversals

Agent Weights:
├─ VFMD: 100% (can weight entry agents more)
├─ UT_BOT: 150% (weight exit agents more)
└─ ... (customize per agent)
```

### To Change Settings
```
1. Click Settings in sidebar
2. Find "Paper Trading" section
3. Adjust values
4. Click [Save]
5. Dashboard updates immediately
```

## 🚀 When Ready: Live Trading

### To Switch to Live Mode
```
1. Successful paper trading (2+ weeks)
2. Open Settings → Trading Mode
3. Click [Enable Live Trading]
4. Connect exchange account (API key)
5. Confirm warnings
6. Done - same UI, real money
```

### Important Notes
```
Live Trading:
✓ Same dashboard UI
✓ Real money at risk
✓ Stricter position limits (2% instead of 5%)
✓ Mandatory stops enforced
✓ Real slippage & fees
✓ Can switch back to demo anytime
```

## 📈 Performance Tracking

### What Gets Tracked
```
For each trade:
├─ Entry time & price
├─ Exit time & price
├─ Win/loss amount
├─ Win/loss percent
├─ Agent signals at entry
├─ Hold time
├─ Reason for exit (stop, TP, manual)
└─ Agent accuracy (did they predict right?)

Account Statistics:
├─ Win rate (% of profitable trades)
├─ Profit factor (wins vs losses)
├─ Max drawdown (worst loss)
├─ Sharpe ratio (risk-adjusted returns)
└─ Equity curve (growth over time)
```

### View Stats
```
Dashboard Header:
├─ Paper Capital: $10,000
├─ Total PnL: +$250 (+2.5%)
└─ Unrealized: +$50 (from open positions)

Account Summary (click link):
├─ Win Rate: 62%
├─ Profit Factor: 2.3
├─ Avg Win: +$125
├─ Avg Loss: -$85
└─ Max Drawdown: -8.5%
```

## 🎓 Learning Path

### Week 1: Observation
```
Day 1-2: Just look
├─ Open dashboard
├─ Read agent signals
├─ Don't trade yet
├─ Understand why agents vote

Day 3-5: Small trades
├─ Enter 3-5 small positions ($50-$100)
├─ Use suggested stops/profits
├─ Close manually to learn timing
├─ Review each trade

Day 6-7: Pattern finding
├─ Look at 7 trades from the week
├─ Which agents were right?
├─ Which were wrong?
├─ What patterns do you notice?
```

### Week 2-4: Strategy Development
```
├─ Test different filter combinations
├─ Find your best agents
├─ Set personal rules (when to ignore an agent)
├─ Track accuracy vs confidence
├─ Adjust position sizing
├─ Backtest your rules
└─ When confident → consider live
```

### Beyond: Mastery
```
├─ Custom agent weighting
├─ Multi-position strategies
├─ Time-of-day optimization
├─ Drawdown management
├─ Live trading rules
└─ Continuous improvement
```

## 🆘 Troubleshooting

### "I don't see the dashboard"
```
✓ Refresh page (Ctrl+R)
✓ Check URL: localhost:5000/
✓ Check browser console for errors
✓ Make sure you're logged in
```

### "Asset list is empty"
```
✓ API might not be running
✓ Check server console for errors
✓ /api/agents/signals/asset-insights endpoint
✓ Try refreshing
```

### "Alerts not showing"
```
✓ Check if there are any active alerts
✓ Verify filter is correct (not filtering them out)
✓ Check API response in browser Network tab
```

### "Price won't update"
```
✓ Real-time feed might be paused
✓ Manually refresh (Ctrl+R)
✓ Check browser Network tab
✓ Verify price feed API is running
```

## 📞 Next Steps

1. **Try Dashboard Now**
   - App is ready
   - Open localhost:5000
   - Click around, get familiar

2. **Make Your First Trade**
   - Paper trading is safe
   - Small position ($50-$100)
   - Use suggested stops
   - Learn the flow

3. **Review & Adjust**
   - After 5-10 trades
   - See what worked
   - Identify patterns
   - Refine your approach

4. **Scale Up (Optional)**
   - More positions
   - Larger sizes (5-10% of capital)
   - Multiple assets
   - Live mode when ready

## Summary

**Your trading dashboard is ready.**

It shows:
- ✅ 13 agents analyzing every asset
- ✅ Real-time consensus signals
- ✅ One-click entry to paper trading
- ✅ Live position tracking
- ✅ Alert notifications
- ✅ Historical performance stats

**You can:**
- ✅ Paper trade without risk
- ✅ Switch to live when ready
- ✅ Learn agent patterns
- ✅ Backtest your strategies
- ✅ Stay in demo forever if preferred

**Next: Open the app and start exploring.**
