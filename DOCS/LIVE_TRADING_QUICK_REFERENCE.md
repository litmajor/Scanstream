# 📊 VFMD + Convexity Live Trading: Quick Reference Guide

**Last Updated:** January 6, 2026  
**Status:** PRODUCTION READY  

---

## 🚀 Quick Start (5 minutes)

### Starting Live Trading
```bash
# 1. Navigate to project
cd e:\repos\litmajor\Scanstream

# 2. Install dependencies
pnpm install

# 3. Start live trading
pnpm start

# 4. Monitor dashboard
# System will output live trading dashboard with:
# - Connection status
# - Active positions
# - Real-time P&L
# - Performance metrics
```

### Manual Start (if pnpm start doesn't work)
```bash
npx tsx server/trading/live-trading-manager.ts
```

---

## 📈 Daily Operations Checklist

### Morning (Pre-Market)
```
⏰ 7:00 AM - System startup
├─ [ ] Verify connection status
├─ [ ] Check balance (should show equity)
├─ [ ] Review previous day P&L
└─ [ ] Confirm trading mode: ACTIVE

⏰ 7:30 AM - Pre-market setup
├─ [ ] View dashboard
├─ [ ] Check for any alerts
├─ [ ] Verify no overnight issues
└─ [ ] Ready for market open
```

### Trading Hours (8:00 AM - 5:00 PM ET)
```
Every Hour:
├─ [ ] Quick dashboard check (1 minute)
├─ [ ] Current positions status
└─ [ ] Running P&L check

Alert Response:
├─ [ ] Loss streak detected? (auto-engages anti-streak)
├─ [ ] Position limit reached? (system waits for exit)
├─ [ ] Unusual price action? (increase monitoring)
└─ [ ] Any errors? (check logs immediately)
```

### Evening (After Market Close)
```
⏰ 5:15 PM - Market close review
├─ [ ] Final P&L for the day
├─ [ ] Review all closed trades
├─ [ ] Check for any pending closes
└─ [ ] Document performance

⏰ 5:30 PM - Daily report
├─ [ ] Total trades today
├─ [ ] Win rate for today
├─ [ ] Daily return %
├─ [ ] Current drawdown
└─ [ ] Status for tomorrow
```

---

## 🎯 Expected Daily Performance

### BTC Trading Target
```
Daily Return Goal:        +0.61%
Daily Loss Limit:         -3.00%
Trades per Day:           1-2
Average Win:              +2.5%
Average Loss:             -1.8%
Win Rate:                 45.24%
```

### ETH Trading Target
```
Daily Return Goal:        +0.40%
Daily Loss Limit:         -3.00%
Trades per Day:           1-2
Average Win:              +3.0%
Average Loss:             -2.0%
Win Rate:                 33.82%
```

### Combined Daily Target
```
Daily Return Goal:        +0.51%
Daily Loss Limit:         -3.00%
Total Trades:             2-4
Blended Win Rate:         39.53%
Monthly Projection:       +6% (from 414 trades, 145.51% total)
```

---

## 🔴 When to Intervene (Triggers)

### Loss Streak Alert
```
If 3+ consecutive losses occur:
├─ ✅ System auto-activates anti-streak logic
├─ Position sizes reduce to 75%
├─ Stop losses tighten to 1.5%
├─ Holding period reduces to 40 bars
└─ No manual action needed - system handles it

Recovery:
├─ Once back to 1 win, parameters reset gradually
├─ Takes ~5 trades to full normalization
└─ Monitor dashboard for "Loss Streak" status
```

### Daily Loss Limit Alert
```
If daily P&L drops below -3%:
├─ System STOPS new position entries
├─ All open positions get 1% stop
├─ Size reduces to 1% risk per trade
└─ Must manually reset (call trading lead)

Next Day:
├─ System resumes normal operations
├─ Full size positions return
└─ Parameters reset to base config
```

### Drawdown Alert (>10%)
```
If cumulative drawdown exceeds -10%:
├─ Slack alert sent immediately
├─ Position size cuts to 50%
├─ FoR confidence threshold increases to 60%
├─ Check logs for what went wrong
└─ May need to pause and diagnose

Recovery Mode:
├─ Smaller sizes until back to -5% drawdown
├─ Then gradually increase
└─ Full recovery once positive
```

### Critical: Drawdown Exceeds -15%
```
EMERGENCY STOP - Full trading halt:
├─ ❌ ALL position entries STOP immediately
├─ ❌ Existing positions close at market
├─ ❌ System enters ALERT mode
├─ ❌ Requires manual intervention to resume

Actions Required:
1. Alert team immediately
2. Full system audit
3. Root cause analysis
4. Parameter review
5. Resume only after team approval
```

---

## 📊 Key Metrics to Monitor

### Real-Time Dashboard
```
┌─────────────────────────────────┐
│ 🔴 LIVE TRADING DASHBOARD       │
├─────────────────────────────────┤
│ Connection: ✅ ACTIVE           │
│ Trading: ✅ ENABLED             │
│ Positions Open: 2/5             │
│                                 │
│ Today's P&L: +$2,450 (+1.02%)  │
│ Monthly P&L: +$47,890 (+5.89%) │
│ Current Drawdown: -2.1%         │
│ Win Rate (Today): 3/4 (75%)    │
│                                 │
│ Active Positions:               │
│ 1. BTCUSDT: +1.25%             │
│ 2. ETHUSDT: -0.85% (stop 1.5%) │
└─────────────────────────────────┘
```

### Critical Metrics Reference
```
Daily Return %               Target: +0.51%
Current Drawdown            Limit: -15.00%
Win Rate (Current Month)     Target: >35%
Sharpe Ratio                 Target: >1.5
Max Consecutive Losses       Target: <11 bars
Current Losing Streak        Status: ?

Position Count               Max: 5
Position Size per Trade      Standard: 2% risk
Stop Loss (BTC)              Standard: 1.5%
Stop Loss (ETH)              Standard: 2.0%
Holding Period               Standard: 60 bars
```

---

## 🛡️ Safety Checks Before Trading

### Pre-Market Verification
```
System Health:
├─ [ ] Exchange API connected (green check)
├─ [ ] Market data streaming (green check)
├─ [ ] VFMD engine ready (green check)
├─ [ ] Convexity engine ready (green check)
└─ [ ] Risk management active (green check)

Account Status:
├─ [ ] Balance visible and correct
├─ [ ] No open orders from yesterday
├─ [ ] API keys valid
└─ [ ] Withdrawal limits not exceeded

Data Integrity:
├─ [ ] Latest 1-hour candles loaded
├─ [ ] Historical data complete
├─ [ ] No NaN or zero values
└─ [ ] 100-bar lookback available
```

### Hardware Readiness
```
Computer:
├─ [ ] Server running (CPU <20%, RAM <30%)
├─ [ ] No pending reboots
├─ [ ] Network connection stable
└─ [ ] UPS backup available

Internet:
├─ [ ] Primary connection active
├─ [ ] Backup 4G available
├─ [ ] DNS resolving correctly
└─ [ ] Ping to exchange <50ms

Monitoring:
├─ [ ] Terminal window visible
├─ [ ] Alerts configured (Slack/Email)
├─ [ ] Phone nearby for emergencies
└─ [ ] Emergency number posted
```

---

## 📱 Slack Alert Reference

### Alert Message Format

**Loss Streak Alert**
```
🔔 TRADING ALERT: Loss Streak Detected!
Consecutive Losses: 3
Auto-Action: Anti-streak logic ACTIVATED
├─ Position size: REDUCED to 75%
├─ Stop loss: TIGHTENED to 1.5%
└─ Next update: After next win

Status: No action needed - system managing
```

**Daily Limit Alert**
```
⚠️ WARNING: Daily Loss Limit Approaching
Current Daily Loss: -2.8%
Limit: -3.0%
Auto-Action: Position sizes REDUCED
├─ New position size: 1% risk per trade
├─ Stop loss: 1.0% on all positions
└─ Trading continues (reduced)

Recovery: Automatic at next market open
```

**Critical: Drawdown Alert**
```
🚨 CRITICAL: Max Drawdown Exceeded!
Current Drawdown: -15.2%
Hard Limit: -15.0%
System Status: ❌ EMERGENCY STOP

Action Required:
1. Team lead must approve resume
2. Full system audit required
3. Parameter review needed
4. Contact: [phone number]

TRADING DISABLED - Manual recovery only
```

---

## 🔧 Troubleshooting Quick Reference

### "No Positions Opening"
```
Possible Causes:
1. Market outside trading hours → Wait for open
2. Daily loss limit hit → Check daily P&L
3. Position limit reached (5/5) → Wait for closes
4. VFMD not generating signals → Check regime conf
5. FoR triggers failing → Check scout profitability

Quick Fixes:
├─ Restart system: npx tsx server/trading/live-trading-manager.ts
├─ Check dashboard for alerts
├─ Verify market data is updating
└─ Contact ops if issue persists
```

### "Positions Closing Unexpectedly"
```
Possible Causes:
1. Stop loss hit (normal) → Review price action
2. Target reached (normal) → Confirm in logs
3. Holding period exceeded → Check bar count
4. System pause → Check for alerts
5. Manual close → Check if team intervened

Check Logs:
├─ View trade exit reason
├─ Verify stop/target prices
├─ Check exit bar number
└─ Confirm P&L calculation
```

### "Connection Lost to Exchange"
```
Immediate Action:
1. Check internet connection (restart if needed)
2. Verify server still running
3. Check exchange status page
4. Restart system: npx tsx server/trading/live-trading-manager.ts

If Still Issues:
1. Call trading ops: [number]
2. Manual close of open positions via exchange
3. Disable auto trading until resolved
4. Full system audit needed
```

---

## 📅 Weekly Tasks

### Every Friday (After Market Close)
```
Performance Review:
├─ [ ] Calculate weekly return
├─ [ ] Review win rate vs target
├─ [ ] Check drawdown high
├─ [ ] Analyze losing trades
└─ [ ] Document insights

System Check:
├─ [ ] Full logs review
├─ [ ] Parameter drift analysis
├─ [ ] Connection stability check
└─ [ ] Database size review

Planning:
├─ [ ] Any parameter adjustments needed?
├─ [ ] Market regime change?
├─ [ ] Position size adjustments?
└─ [ ] Plan for next week
```

### Monthly Optimization (1st Sunday)
```
Full Analysis:
├─ Run complete backtest on latest data
├─ Identify parameter changes for next month
├─ Review best/worst trades
├─ Analyze market regime changes
└─ Plan optimization adjustments

Parameter Sweep:
├─ Test all combinations
├─ Identify new optima
├─ Compare to live results
└─ Plan deployment

Deployment:
├─ Update live parameters
├─ Run on paper trading first
├─ Monitor 24 hours
└─ Deploy to live if validated
```

---

## 🎓 Example Trade Walkthrough

### Example: BTC Scout Entry → FoR → Convex Exit

**Bar 1000: Scout Entry**
```
VFMD Signal Generated:
├─ Regime confidence: 42% (>40% threshold) ✅
├─ Scout direction: LONG ✅
├─ Divergence: +1.2% (within 3% limit) ✅
├─ Entry price: $42,500
├─ Scout size: 0.5 BTC (small probe)
└─ Target: $43,530 (1% gain)
    Stop: $41,625 (-2% loss)

Status: Scout OPEN
Timeout: Bar 1020 (20-bar window)
```

**Bar 1005: Scout Profitable**
```
Scout Status:
├─ Current price: $42,900
├─ Profit: +0.94% ✅ (profitable!)
├─ Entry at bar 1000
└─ Bars held: 5

Trigger Check: Is profit > 0%? YES
└─ FoR Condition MET ✅

Action: FoR trigger fires!
```

**Bar 1005: FoR Trigger → Convex Position**
```
FoR Detection:
├─ Scout profitable: +0.94%
├─ Mean reversion FAILED (price going up, not down)
├─ Convex entry SIGNAL activated
└─ 100% FoR conversion ✅

Convex Position Entry:
├─ Current scout: 0.5 BTC at $42,500 (keep it)
├─ Add convex position: 1.0 BTC at $42,900
├─ Total position: 1.5 BTC
├─ Average entry: $42,767
├─ Stop loss: $42,127 (1.5% BTC stop)
├─ Target: $46,186 (2.2x risk multiplier)
└─ Max hold: Bar 1065 (60 bars)

Status: Convex DEPLOYED
```

**Bar 1025: Position in Profit**
```
Position Update:
├─ Current price: $43,500
├─ Entry: $42,767
├─ Profit: +1.71%
├─ Bars held: 20
├─ Status: WINNING
└─ Still far from both target ($46,186) and stop ($42,127)

Monitor: Continue holding
Next: Bar 1030, 1040, 1050...
```

**Bar 1045: Position Hit Target**
```
Position Update:
├─ Current price: $46,250
├─ Target: $46,186
├─ Profit: +8.15% ✅ EXCEEDED TARGET!
├─ Bars held: 40
└─ Status: CLOSE

Exit Action:
├─ Close entire 1.5 BTC position
├─ Exit price: $46,250
├─ P&L: $2,215 (on $64,150 risk)
├─ Return: +8.15%
└─ Trade complete!

Log Entry:
├─ Entry: Bar 1000, Price $42,500
├─ Exit: Bar 1045, Price $46,250
├─ Reason: TARGET HIT
├─ Bars held: 45
├─ P&L: +$2,215 (+8.15%)
└─ Status: WIN ✅
```

---

## 🆘 Emergency Contact List

```
Primary Trading Lead:
├─ Name: [Name]
├─ Phone: [Number]
└─ Email: [Email]

Secondary Backup:
├─ Name: [Name]
├─ Phone: [Number]
└─ Email: [Email]

Exchange Support:
├─ Binance: support.binance.com (chat)
├─ Bybit: support.bybit.com (chat)
└─ Kraken: support.kraken.com (1-800-XXX-XXXX)

IT Support:
├─ Name: [Name]
├─ Phone: [Number]
└─ Slack: @it-support
```

---

## 📞 Support

**System Down?** → Call primary lead immediately  
**Unsure about Trade?** → Check dashboard and this guide  
**Performance Question?** → Review weekly summary  
**Parameter Change?** → Contact trading lead first  

**Remember:** When in doubt, the safest action is to:
1. Stop the system
2. Verify all positions closed
3. Contact trading lead
4. Plan next steps carefully

---

**Version:** 1.0 - PRODUCTION  
**Last Updated:** January 6, 2026  
**Status:** ✅ READY FOR DAILY USE
