# 🚀 Scanner Features Guide

## New Features Implemented

This guide covers the 4 new features added to enhance your trading workflow:

1. **Stop-Loss & Take-Profit Calculator** - Automated risk management
2. **Watchlist & Favorites** - Track specific symbols
3. **Export to CSV** - Data analysis and record keeping
4. **TradingView Chart Integration** - Instant chart visualization

---

## 1. 📊 Stop-Loss & Take-Profit Calculator

### What It Does

Automatically calculates optimal entry, stop-loss, and take-profit levels for every signal using multiple methods:

- **ATR-based**: 1.5x ATR for dynamic stops based on volatility
- **Support/Resistance-based**: Uses Bollinger Bands and swing levels
- **Percentage-based**: Conservative 2-3% stops
- **Risk/Reward optimization**: Targets minimum 2.5:1 R:R ratio

### How It Works

The calculator uses three methods and selects the optimal stop:

```
For Long Positions:
1. ATR Stop = Entry - (1.5 × ATR)
2. Support Stop = Support Level - 0.5%
3. Percentage Stop = Entry × 0.97 (3% stop)

→ Selects tightest reasonable stop (0.5% - 8% range)

Take Profit:
- Based on Risk × 2.5 (for 2.5:1 R:R)
- Adjusted if resistance is closer
```

### Where to Find It

Every signal card now shows a **"Trade Plan"** section with:

```
┌─────────────────────────────────┐
│ Trade Plan           R:R 2.75   │
│                                 │
│ Entry        Stop Loss    Take Profit
│ $45,000      $43,200       $49,950
│              -4.0%          +11.0%
└─────────────────────────────────┘
```

### Color Coding

- 🟢 **Green badge** (R:R ≥ 2.5): Excellent risk/reward
- 🟡 **Yellow badge** (R:R 1.5-2.5): Acceptable risk/reward
- 🔴 **Red badge** (R:R < 1.5): Poor risk/reward - avoid

### How to Use

1. **Check R:R ratio** - Aim for 2.5 or higher
2. **Verify stop-loss** - Make sure you're comfortable with the risk
3. **Plan position size** - Risk only 1-2% of account on the trade
4. **Set orders**:
   - Entry: Market or limit at suggested price
   - Stop: Just below suggested stop-loss
   - Target: At or before take-profit level

### Example

```
Signal: BTC/USDT - BUY
Entry Quality: 88/100 🟢

Trade Plan:           R:R 2.85
Entry:      $44,500
Stop Loss:  $43,000  (-3.37%)
Take Profit: $48,775  (+9.61%)

Support:    $42,850
Resistance: $49,200

Position Sizing:
Account: $10,000
Risk: 2% = $200
Stop Distance: $1,500
Position Size: $200 / $1,500 = 0.133 BTC
```

---

## 2. ⭐ Watchlist & Favorites

### What It Does

Save and track specific symbols across scans. Perfect for:
- Monitoring favorite trading pairs
- Following high-opportunity setups
- Focusing on your best markets

### How to Use

#### Adding to Watchlist

Click the **star icon** (⭐) next to any symbol:
- **Gray star**: Not in watchlist
- **Yellow star**: In watchlist

#### Viewing Watchlist Only

Click the **watchlist button** in the header:

```
[⭐ 5] ← Shows watchlist count
```

- **Gray button**: Showing all signals
- **Yellow button**: Showing only watchlist

#### Managing Your Watchlist

- **Add**: Click star on any signal
- **Remove**: Click filled star to remove
- **Filter**: Toggle watchlist button to view only favorites
- **Persistent**: Saved to browser localStorage (survives refreshes)

### Tips

1. **Start small** - Add 5-10 high-volume pairs you know well
2. **Quality over quantity** - Focus on best opportunities
3. **Regular review** - Remove inactive pairs weekly
4. **Multi-timeframe** - Scan daily for trend, 1h for entry

### Example Workflow

```
1. Run daily scan → Find BTC showing opportunity 85+
2. Click star ⭐ to add BTC to watchlist
3. Switch to 1h timeframe
4. Click [⭐ 1] to show only BTC
5. Wait for ideal entry (opp score 75+)
6. Execute trade with provided stop/target
```

---

## 3. 📥 Export to CSV

### What It Does

Downloads all current scan results as a CSV file for:
- External analysis (Excel, Python, R)
- Performance tracking
- Record keeping
- Backtesting

### How to Use

Click the **"CSV" button** in the header:

```
[📥 CSV] ← Green button
```

The file will download as: `scanner-signals-2025-10-24.csv`

### File Contents

The CSV includes all critical data:

```csv
Symbol,Signal,Strength,Opportunity Score,Price,Change %,RSI,MACD,Volume,Entry,Stop Loss,Take Profit,R:R,Timeframe,Timestamp
BTC/USDT,BUY,85,92,45000,2.5,42,bullish,1250000,45000,43200,49950,2.75,1h,2025-10-24 14:30:00
ETH/USDT,BUY,78,88,3200,-0.5,38,bullish,890000,3200,3100,3480,2.58,1h,2025-10-24 14:30:00
...
```

### Use Cases

#### 1. Track Historical Signals

```python
import pandas as pd

# Load all your exported scans
df = pd.concat([
    pd.read_csv('scanner-signals-2025-10-20.csv'),
    pd.read_csv('scanner-signals-2025-10-21.csv'),
    pd.read_csv('scanner-signals-2025-10-22.csv')
])

# Analyze which opportunity scores perform best
print(df.groupby('Signal')['Opportunity Score'].mean())
```

#### 2. Performance Analysis

Track which signals actually hit take-profit vs stop-loss to validate your system.

#### 3. Pattern Recognition

Find patterns in successful trades:
- What RSI ranges work best?
- Which timeframes have highest win rate?
- Does opportunity score correlate with success?

#### 4. Reporting

Share signals with team or create trading journals.

---

## 4. 📈 TradingView Chart Integration

### What It Does

Opens professional charts for any signal directly in TradingView with one click.

### How to Use

Click the **"Chart" button** on any signal card:

```
[📊 Chart] ← Opens TradingView in new tab
```

### What Opens

Direct link to TradingView chart with:
- ✅ Correct symbol (e.g., BINANCE:BTCUSDT)
- ✅ Correct exchange
- ✅ Ready for analysis

### Features in TradingView

Once opened, you can:

1. **Verify the setup**
   - Check support/resistance visually
   - Confirm trend direction
   - Look for patterns

2. **Add indicators**
   - RSI, MACD, Volume (same as scanner)
   - Custom indicators
   - Drawing tools

3. **Set alerts**
   - Price alerts at stop/target
   - Indicator-based alerts
   - Divergence alerts

4. **Execute trades**
   - Many brokers integrate with TradingView
   - Paper trading available
   - One-click trading (if configured)

### Best Practice Workflow

```
1. Scanner shows: BTC/USDT - Opp Score 92 🟢
2. Review Trade Plan:
   - Entry: $45,000
   - Stop: $43,200
   - Target: $49,950
   - R:R: 2.75 ✓

3. Click [📊 Chart] button

4. In TradingView:
   ✓ Confirm uptrend on higher TF
   ✓ Check for clean break of resistance
   ✓ Verify volume increasing
   ✓ Set price alerts

5. If confirmed → Execute trade
   If not → Wait or pass
```

### URL Format

The scanner opens charts with this format:
```
https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT
```

You can customize:
- Add `/` for different layouts
- Add `?interval=60` for specific timeframe
- Save chart templates in TradingView

---

## 🎯 Putting It All Together

### Complete Trading Workflow

**Step 1: Initial Scan**
```
1. Open Scanner
2. Select timeframe: "Medium (1h)"
3. Set min strength: 50%
4. Click "Scan Now"
5. Wait 30-60 seconds
```

**Step 2: Filter & Select**
```
6. Look for Opportunity Score 70+ 🟢
7. Check Trade Plan R:R > 2.5
8. Add promising setups to watchlist ⭐
```

**Step 3: Analyze**
```
9. Click "Chart" button
10. Verify on TradingView:
    - Trend direction
    - Support/resistance
    - Volume profile
11. Check multiple timeframes
```

**Step 4: Execute**
```
12. If confirmed:
    - Enter at suggested price
    - Set stop-loss order
    - Set take-profit order
    - Risk 1-2% of account
13. If not → Remove from watchlist or wait
```

**Step 5: Track**
```
14. Export to CSV daily
15. Track which setups work
16. Refine filters based on results
17. Build your edge over time
```

### Pro Tips

1. **Morning Routine**
   - Scan Daily timeframe for trends
   - Add strong setups to watchlist
   - Set alerts for entry levels

2. **Intraday Trading**
   - Filter watchlist only
   - Scan 1h timeframe
   - Look for opp score 75+
   - Quick chart verification
   - Execute best setups

3. **Risk Management**
   - Never risk > 2% per trade
   - Use provided stop-loss levels
   - Adjust position size: `Risk $ / Stop Distance`
   - Track R:R on all trades

4. **Data-Driven Improvement**
   - Export CSV after each trading session
   - Track win rate by opportunity score range
   - Note which timeframes work best
   - Adjust filters based on results

---

## 📊 Feature Comparison: Before vs After

| Feature | Before | After |
|---------|--------|-------|
| **Stop-Loss** | Manual calculation | ✅ Auto-calculated (ATR + Support) |
| **Take-Profit** | Guesswork | ✅ Optimized for 2.5:1 R:R |
| **R:R Ratio** | Unknown | ✅ Displayed with color coding |
| **Watchlist** | ❌ None | ✅ Persistent favorites with filter |
| **Export** | Copy-paste | ✅ One-click CSV download |
| **Charts** | Open manually | ✅ Direct TradingView link |
| **Trade Planning** | External tools | ✅ Built-in complete trade plan |

---

## 🆘 Troubleshooting

### Watchlist Not Saving

**Issue**: Watchlist resets on refresh

**Solutions**:
1. Check browser localStorage is enabled
2. Not in private/incognito mode
3. Clear browser cache and try again

### Export CSV Not Working

**Issue**: CSV button disabled or file won't download

**Solutions**:
1. Ensure scan has completed
2. Check signals are displayed
3. Allow pop-ups/downloads in browser
4. Try different browser

### TradingView Opens Wrong Symbol

**Issue**: Chart shows incorrect pair

**Solutions**:
1. Check exchange in scanner (should match TV)
2. Symbol format: BTCUSDT not BTC/USDT
3. Try manual search in TradingView
4. Some exchanges might not be on TV

### Stop-Loss Seems Too Wide

**Issue**: 8% stop on a crypto trade

**Solutions**:
1. This is ATR-based for high volatility
2. Use shorter timeframe (5m, 15m) for tighter stops
3. Reduce position size instead
4. Check if market is ranging (wider stops normal)

---

## 📝 Quick Reference

### Keyboard Shortcuts

None currently, but you can:
- `Ctrl/Cmd + F` to search symbols in results
- Click star multiple times to toggle fast

### Button Guide

| Button | Icon | Action |
|--------|------|--------|
| Scan Now | 🔍 | Trigger new market scan |
| Watchlist | ⭐ | Toggle watchlist-only view |
| Export CSV | 📥 | Download all signals |
| Refresh | 🔄 | Reload latest data |
| Chart | 📊 | Open TradingView |
| Star (card) | ⭐ | Add/remove from watchlist |

### Color Codes

**Opportunity Score**:
- 🟢 80-100: Excellent
- 🟡 60-79: Good
- 🟠 40-59: Fair
- 🔴 0-39: Poor

**Risk/Reward Ratio**:
- 🟢 R:R ≥ 2.5: Take the trade
- 🟡 R:R 1.5-2.5: Acceptable
- 🔴 R:R < 1.5: Pass

**RSI**:
- 🟢 < 30: Oversold (potential bounce)
- ⚪ 30-70: Normal
- 🔴 > 70: Overbought (avoid)

**BB Position**:
- 🟢 < 30%: Good entry (value)
- ⚪ 30-70%: Normal
- 🔴 > 70%: Extended (avoid)

---

## 🎓 Learning Resources

Want to learn more about these features?

1. **Stop-Loss Science**: Read about ATR-based stops
2. **Risk Management**: Search "position sizing calculator"
3. **TradingView**: Free tutorials on tradingview.com
4. **CSV Analysis**: Learn pandas for Python or Excel pivot tables

---

## 🔄 Updates & Improvements

These features will continue to evolve:

**Coming Soon**:
- Position size calculator
- Auto-alerts for watchlist
- Historical performance tracking
- PDF report generation
- Multi-exchange support for charts

**Feedback**:
Found a bug or have a feature request? Let us know!

---

## ✅ Summary

You now have 4 powerful new tools:

1. ✅ **Automated Stop/TP** - Never guess risk/reward again
2. ✅ **Watchlist** - Focus on your best opportunities
3. ✅ **CSV Export** - Track and improve over time
4. ✅ **TradingView Integration** - Instant chart verification

**Next Steps**:
1. Run your first scan
2. Add 3-5 symbols to watchlist
3. Export your first CSV
4. Open a chart and verify a setup
5. Execute your first data-driven trade!

Happy Trading! 📈

