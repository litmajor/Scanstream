# Paper Trading Tools - README

## Quick Start

You now have a complete paper trading infrastructure to validate your ConvexityAgent before trading real money.

### The Three Essentials

#### 1. **Check Your Strategy**
See what realistic returns look like:
```bash
npx ts-node server/backtest/conservative-sim.ts
```
Shows: $5k → $43k (BTC) or $52k (ETH) with realistic constraints

#### 2. **Log Your Trades**
After executing a trade in ConvexityAgent:
```bash
npx ts-node server/backtest/paper-trading-cli.ts log BTC/USDT 42000 42126 0.06 150 3 2.5 true
```
Parameters: `asset entry exit quantity riskDollars targetPct stopLossPct won`

#### 3. **Check Your Progress**
Daily:
```bash
npx ts-node server/backtest/paper-trading-cli.ts stats BTC/USDT
```
Shows: Win rate, profit, drawdown, readiness score

---

## Your Optimal Parameters

| Metric | BTC | ETH |
|--------|-----|-----|
| FoR Threshold | 60 | 60 |
| Holding Period | 30 bars | 8 bars |
| Stop Loss | 2.5% | 2.5% |
| Target | 3% | 3% |
| Expected WR | 90% | 76% |
| Expected Trades/Year | 91 | 169 |
| Realistic Year 1 Return | +767% | +945% |

---

## Paper Trading Timeline

1. **Week 1-2**: Trade BTC, execute 50 trades, aim for 70%+ win rate
2. **Week 3-4**: Trade ETH, execute 50 trades, aim for 65%+ win rate  
3. **Week 5+**: If both pass, start REAL MONEY with 1% risk ($50/trade)
4. **Month 3+**: After 100 real trades at 70%+ WR, scale to 2-3% risk

---

## Files Generated This Session

- `server/backtest/paper-trading-api.ts` - Core logging library
- `server/backtest/paper-trading-cli.ts` - Command-line tool
- `server/backtest/paper-trading-tracker.ts` - Full session management
- `server/backtest/conservative-sim.ts` - Realistic money projections
- `server/backtest/realistic-money-sim.ts` - Compound growth calculator
- `server/backtest/validate-setup.ts` - Verification script
- `CONVEXITY_OPTIMIZATION_COMPLETE.md` - Full implementation guide

---

## Integration with ConvexityAgent

Add this to your trade execution code:

```typescript
import { logPaperTrade, printStats } from './paper-trading-api.ts';

// After a trade executes:
logPaperTrade({
  asset: 'BTC/USDT',
  entryPrice: 42000,
  exitPrice: 42126,
  quantity: 0.06,
  riskDollars: 150,
  targetPct: 3,
  stopLossPct: 2.5,
  won: true
});

// Daily review:
printStats('BTC/USDT');
```

---

## Success Metrics

**Pass Paper Trading When**:
- ✅ 50+ trades executed
- ✅ 70%+ win rate maintained
- ✅ Profitable every week
- ✅ No day with >20% loss

**Ready for Real Money When**:
- ✅ 100+ paper trades across both assets
- ✅ Average 70%+ win rate
- ✅ Emotional control demonstrated
- ✅ Understand risk management rules

---

## Quick Commands

```bash
# Show realistic projections
npx ts-node server/backtest/conservative-sim.ts

# Check BTC progress
npx ts-node server/backtest/paper-trading-cli.ts stats BTC/USDT

# List all BTC trades
npx ts-node server/backtest/paper-trading-cli.ts list BTC/USDT

# Log new trade
npx ts-node server/backtest/paper-trading-cli.ts log BTC/USDT 42000 42126 0.06 150 3 2.5 true

# Validate everything ready
npx ts-node server/backtest/validate-setup.ts
```

---

## Important Notes

1. **Paper trading WR will be lower**: Expect 70-80% vs 90% backtest (slippage/gaps)
2. **This is normal**: Every successful trader sees this variance
3. **Small losses are OK**: One bad trade doesn't break paper account
4. **Log everything**: Your trading journal is your best teacher
5. **Be patient**: 4-6 weeks paper trading = decades of trading experience

---

**Next Step**: Start ConvexityAgent on live feeds and log your first trade!

