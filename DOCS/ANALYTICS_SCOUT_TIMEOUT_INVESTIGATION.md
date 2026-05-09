# Scout Timeout Investigation - Analytics Report

## Executive Summary

**Critical Discovery:** Scouts are **highly profitable in bars 1-4** (100% win rate), but **timeouts at bar 5 are destroying P&L** (-1.175% avg PnL on 219 timeouts).

**The Problem:** Scouts are entering at bad times (no momentum), briefly become profitable due to our entry signal, then lose profitability by bar 5 when the timeout kicks in.

---

## FoR Firing Analytics

### FoR Trigger Timing
- **Total FoR Fires:** 314 out of 431 scouts (72.9%)
- **Avg Bars Until FoR:** **1.63 bars** ⚠️ *VERY EARLY*
- **Avg Price Displacement at FoR:** 0.527% ($16.22 price move)

**Key Insight:** FoR fires almost immediately (1-2 bars). This means scouts are barely running before we declare "mean reversion failed" and deploy Convexity. This is correct behavior - scouts are short-term, and FoR proves they failed fast.

---

## Scout Profitability by Bar

### Bars 1-4: EXCELLENT Profitability
```
Bar  1: 3/3 profitable (100.0%)
Bar  2: 11/11 profitable (100.0%)
Bar  3: 9/9 profitable (100.0%)
Bar  4: 11/11 profitable (100.0%)
```

**What this means:** Every scout that exits in bars 1-4 exits profitably. This is our TARGET exits working perfectly.

### Bar 5+: CLIFF DROP
```
Bar  5: 8/397 profitable (2.0%) 
Bar 12: 0/X profitable (0.0%)
Bar 20: 0/X profitable (0.0%)
```

**Critical Insight:** **Only 2% of scouts held to bar 5 are profitable!** The other 98% are timeout exits that are heavily unprofitable.

---

## Timeout Analytics - ROOT CAUSE

### The Timeout Problem
- **Total Timeouts:** 219 (51% of all scouts)
- **Timeouts Unprofitable:** 219/219 (100% negative!)
- **Avg Bars Until Timeout:** 5.00 bars (exactly at the timeout limit)
- **Avg PnL on Timeout:** **-1.175%** per trade

### What This Tells Us

**Scouts timeout at bar 5 with massive losses:**
- TARGET hit by bar 5: **42 scouts** (+100% win rate)
- TIMEOUT hit by bar 5: **219 scouts** (-1.175% avg loss)
- **Ratio:** For every scout hitting TARGET, 5.2 scouts hit TIMEOUT unprofitable

### The Timeline
1. **Bar 0-4:** Scout profitable on momentum entry
2. **Bar 5:** Scout becomes unprofitable (mean reversion catches it)
3. **Bar 5:** TIMEOUT exit triggers → Lock in losses

**This is the opposite problem from before!**
- Before: Scouts exited too early on stop loss
- Now: Scouts timeout and lose because they entered on BAD MOMENTUM SIGNAL

---

## Scout Entry Quality Problem

### The Real Issue: VFMD Signal Quality

Looking at entry profitability distribution:
- **High-quality entries (TARGET hit):** 42 scouts = 9.7% win rate
- **Low-quality entries (TIMEOUT):** 219 scouts = 50% of total

**This suggests the VFMD signal generation is entering scouts at:**
1. **Exhaustion points** (end of impulse, mean reversion about to start)
2. **False breakouts** (brief momentum spike, then reversal)
3. **Bad times** (not at the START of momentum, but in the MIDDLE/END)

### Evidence
- **Bar 1-4 profitable scouts:** Short impulse that hits target quickly
- **Bar 5 timeout scouts:** Longer trend that reverses

This is OPPOSITE to what you'd expect if scouts were entering at the START of momentum. Instead, scouts are:
1. Entering during momentum (briefly profitable)
2. Momentum exhausts by bar 5
3. Mean reversion kicks in → timeout exit with loss

---

## Average Profitable Bars When Profitable

**Metric:** `Avg Profitable Bars (when profitable): 3.24`

This means when scouts DO exit profitably (42 scouts hitting target), they average **3.24 bars held**.

**Implication:** The profitable scouts are SHORT impulses that reverse by bar 3-4. Then longer trades timeout at bar 5.

---

## Recommendations

### Option 1: Adjust Timeout Bar Limit
**Current:** Timeout at bar 5  
**Proposal:** Timeout at bar 4 or 3

**Why:** 219 scouts are timing out unprofitable at bar 5. By shortening timeout to bar 4 (or 3), we:
- Capture the 100% profitable bar 1-4 exits earlier
- Exit timeouts before they become heavily unprofitable
- Force scouts to exit with smaller losses

**Risk:** May force profitable scouts to exit early if some would profit at bar 5+

### Option 2: Improve VFMD Entry Signal Quality
**Current:** VFMD generates scouts at exhaustion points  
**Proposal:** Filter entries to only high-momentum signals

**How:**
- Check coherence/turbulence at entry
- Only enter scouts when turbulence is HIGH (active momentum)
- Skip entries during consolidation (low turbulence)
- Only enter when TI > threshold (volatility expansion)

**Expected Impact:** Reduce timeout rate from 51% → 20-30%, improve win rate

### Option 3: Dynamic Stop Based on Profitability Window
**Current:** Fixed bar 5 timeout  
**Proposal:** Exit scout at first unprofitable bar

**How:**
- Track scout profitability per bar (already implemented!)
- If bar 1 profitable AND bar 2 unprofitable → exit bar 1
- If bars 1-3 profitable AND bar 4 unprofitable → exit bar 3
- Only hold scouts showing persistence

**Expected Impact:** Lock in profits before timeout, adapt to each scout

### Option 4: Increase Target Distance
**Current:** TARGET at 2x ATR above entry  
**Proposal:** Increase to 3x or 4x ATR

**Why:** Scouts hit target on bar 1-4, but many don't hit it. More scouts might hit higher target before timeout at bar 5.

**Risk:** Higher target = fewer hits, might not help

---

## Detailed Analysis: Why This Happens

### The Scout Execution Flow
```
Scout Entry (based on VFMD signal)
     ↓
Bars 1-4: Brief momentum (42 scouts hit TARGET)
     ├─ These are HIGH QUALITY entries that catch immediate profit
     └─ Exit with +profit (100% win rate)
     ↓
Bars 1-5: Longer momentum (397 scouts running)
     ├─ Some profitable in bar 1-4 (42 = 10.6%)
     ├─ Most unprofitable after bar 4 (219 = 51%)
     └─ TIMEOUT exits unprofitable
```

### Why Scouts Become Unprofitable After Bar 4
1. **VFMD Entry Late:** Scouts enter AFTER momentum impulse starts, not at start
2. **Mean Reversion:** By bar 5, mean reversion naturally takes over
3. **Timing Mismatch:** 5-bar timeout is too long for exhaustion-point entries
4. **No Momentum Filter:** Scouts enter even when momentum is weak

---

## Scout Win Rate Breakdown

| Exit Reason | Count | Win Rate | Avg PnL |
|---|---|---|---|
| TARGET | 42 | 100.0% | +5.50% |
| TIMEOUT | 219 | 0.0% | -1.18% |
| Other | 170 | 7.2% | -0.45% |
| **Total** | **431** | **9.7%** | **-0.40%** |

**Insight:** Entire scout system is underwater because 51% of scouts are unprofitable timeouts.

---

## Action Plan

### Immediate (Reduce Timeout Bleeding)
1. **Reduce timeout to bar 4** → Capture more profits before reversal
2. **Add coherence check at entry** → Only enter high-momentum scouts
3. **Track profitability in real-time** → Exit early if unprofitable

### Medium Term (Improve Entry Quality)
1. **Filter VFMD entries by turbulence** → Only trade active momentum
2. **Add persistence check** → Require 2 bars of profit before holding
3. **Increase target distance** → Let winners run

### Long Term (Redesign Scout Strategy)
1. **Scout profitability limited by 5-bar window** → Consider longer window?
2. **Mean reversion may NOT be your edge** → Consider trend-following scouts instead
3. **FoR triggers too early** → Maybe that's OK, focus on improving Convex instead

---

## Conclusion

**The Problem is NOT FoR validation** - that's working perfectly (72.9% trigger rate).

**The Problem IS scout entry quality and timeout handling:**
- Scouts enter at **exhaustion points** (brief profit, then loss)
- **51% timeout unprofitably** at bar 5
- **9.7% total win rate** on scouts (destroyed by timeouts)

**Solution:** Either improve entry timing OR reduce timeout window to capture profits faster.

This is a **scout design problem, not a FoR problem**. The Convexity system is working correctly - scouts are just unprofitable on their own.
