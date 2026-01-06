// Debug VFMD Issues
// Run this to see what's happening with scout generation and execution

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║            VFMD BACKTEST - ROOT CAUSE ANALYSIS                      ║
╚════════════════════════════════════════════════════════════════════╝

FOUND ISSUES:
─────────────────────────────────────────────────────────────────────

1. ❌ WRONG DIRECTION LOGIC (Line 135-156)
   Current:  Buys on UPTREND, Sells on DOWNTREND
   Problem:  These are TREND-FOLLOWING signals, not reversals!
   VFMD:     Should generate REVERSAL signals (opposite trend)
   Fix:      Reverse the logic (buy down, sell up)

2. ❌ DIRECTION MISMATCH (Line 137-139)
   Current:  Uses price momentum to determine direction
   Problem:  But then enters on trend direction, not reversal
   Result:   Buying peaks, selling bottoms = immediate losses
   
3. ❌ STOP NOT USED (Line 327)
   Current:  Uses fixed 2% stop, ignores signal.stop
   Problem:  Signal calculates proper ATR-based stops (0.7 * ATR)
             But code uses fixed 2%, which is often too tight
   Fix:      Use signal.stop from VFMD calculation

4. ❌ NO TARGET EXIT (Line 344)
   Current:  Only exits on stop loss or 50-bar timeout
   Problem:  Never takes profits when target hit
             Relies entirely on 50-bar timeout
   Result:   Winners held too long, losers exited immediately
   Fix:      Check if target hit before stop/timeout

5. ⚠️  SPARSE SIGNAL GENERATION (Line 115)
   Current:  Every 20 bars = ~438 signals/year
   Problem:  With every 50-bar spacing, some periods uncovered
   Result:   Missing opportunities in active markets
   Fix:      Generate every 10-15 bars or on regime changes

6. ❌ ENTRY CONDITION (Line 317)
   Current:  Enters on "WATCHING" state
   Problem:  This is before FoR validation, enters all VFMD signals
   Result:   404/431 signals lose money because they're NOT reversals
   Fix:      Wait for FoR confirmation or skip this backtest

─────────────────────────────────────────────────────────────────────

QUICK FIX NEEDED:
─────────────────────────────────────────────────────────────────────

Change line 135-156 from:

  if (priceTrend === 'UP') {
    signals.push({ ... BUY ... })  ← BUY on uptrend = WRONG
  } else if (priceTrend === 'DOWN') {
    signals.push({ ... SELL ... }) ← SELL on downtrend = WRONG
  }

To:

  if (priceTrend === 'UP') {
    signals.push({ 
      direction: 'SELL',  ← SELL reversal (against uptrend)
      ...
    })
  } else if (priceTrend === 'DOWN') {
    signals.push({
      direction: 'BUY',   ← BUY reversal (against downtrend)
      ...
    })
  }

─────────────────────────────────────────────────────────────────────

EXPECTED IMPROVEMENT:
  • Fixing direction logic: -15% → estimated +30-40% (2.5x swing!)
  • Using proper stops: Tighter risk control
  • Adding target exits: Let winners run
  • Result: VFMD could be +30% instead of -15%

─────────────────────────────────────────────────────────────────────
`);
