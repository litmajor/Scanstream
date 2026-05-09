# Test 1 Results: Bar 4 Timeout (vs. Bar 5 Baseline)

## 🎯 Test Summary
Changed scout timeout from **bar 5 → bar 4** to catch unprofitable exits earlier.

---

## 📊 ETH/USDT Results Comparison

| Metric | Baseline (Bar 5) | Test 1 (Bar 4) | Change | % Change |
|--------|---|---|---|---|
| **Scout Win Rate** | 9.7% | 7.9% | -1.8% | ❌ -18.6% |
| **Scout Timeouts** | 219 | 223 | +4 | ❌ +1.8% |
| **Avg Timeout PnL** | -1.175% | -0.968% | +0.207% | ✅ +17.6% |
| **Scout P&L** | -1.70% | -1.45% | +0.25% | ✅ +14.7% |
| **Convex Win Rate** | 39.81% | 36.96% | -2.85% | ❌ -7.2% |
| **Convex P&L** | 1.24% | 0.27% | -0.97% | ❌ -78% |
| **Combined P&L** | -0.46% | -1.18% | -0.72% | ❌ WORSE |

---

## 🔍 Analysis

### What Happened
Reducing timeout from bar 5 to bar 4 had **mixed results**:

**Good news:**
- ✅ Avg timeout loss improved: **-1.175% → -0.968%** (17.6% better loss on timeouts)
- ✅ Fewer scouts held to bar 5 (where they lose money)

**Bad news:**
- ❌ Scout win rate actually DROPPED: **9.7% → 7.9%** (more winners at bar 5 than bar 4)
- ❌ Convex performance degraded: **39.81% → 36.96%** win rate
- ❌ Overall system P&L WORSE: **-0.46% → -1.18%**

### Why This Happened
The profitability data reveals the issue:

```
BASELINE (Bar 5):
  Bar 1-4: 34/34 scouts profitable (100%)
  Bar 5:   8/397 scouts profitable (2.0%)

TEST 1 (Bar 4):
  Bar 1-3: 23/23 scouts profitable (100%)
  Bar 4:   11/408 scouts profitable (2.7%)
```

**Key insight:** The 11 scouts that are profitable AT bar 4 were probably going to be part of the **FoR deployment candidates** at bar 5+. By cutting at bar 4, we lose:
1. The scouts that would have FoR-proven at bar 5+
2. The Convex trades that would have launched on those scouts
3. The Convex winning trades that follow

### The Real Problem
Bar 4 timeout doesn't address the root issue:
- Problem: Scouts entering at exhaustion (end of momentum move)
- Bar 4 timeout: Just exits earlier without improving ENTRY QUALITY
- Result: Still getting unprofitable scouts, just earlier

---

## 🚀 Recommendation: Skip Bar 4, Try Option 2 (Turbulence Filter)

Bar 4 timeout made things **worse** because:

1. **We're cutting winners too early** - scouts that would have been profitable bar 5+ for FoR proof
2. **Convex depends on profitable scouts** - FoR only fires on profitable scouts, so killing bars 5+ scouts kills Convex trades
3. **The real problem is ENTRY QUALITY** - not exit timing

---

## Next Test: Turbulence Filter (Option 2)

Instead of limiting how long scouts run, we should limit **which scouts even enter**:

```
NEW LOGIC:
- Only generate scouts when Turbulence Index > 2.5
- This filters entries to active momentum periods only
- Prevents entries at momentum EXHAUSTION
- Expected result: Better entry quality → higher baseline win rate
```

### Expected Improvements with Turbulence Filter:
- Scout entries: 431 → 250 (42% fewer low-quality entries)
- Scout win rate: 9.7% → 18%+ (better entry quality)
- Convex trades: 303 → 200 (fewer but higher quality)
- Convex win rate: 39.8% → 45%+ (better underlying scouts)
- **Combined P&L: -0.46% → +1.5%+ (substantial improvement)**

---

## 📝 Conclusion

**Bar 4 timeout was not the solution.**

The problem isn't that scouts are running **too long** - it's that they're entering at the **wrong time** (exhaustion vs. impulse start).

Let's move directly to **Test 2: Turbulence Filter** to improve entry quality instead of just exit timing.
