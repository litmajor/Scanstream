# RTM Force-Decay Quick Reference

## What Changed?

**Old:** Deploy Convexity at bar 21 (time-based)  
**New:** Deploy Convexity when RTM detects force decay (physics-based)

---

## The Six New Metrics

| Metric | Range | Meaning | Threshold |
|--------|-------|---------|-----------|
| **Decay Strength** | 0–1 | How fast R_i is degrading | > 0.55 = signal |
| **Depth Compression** | 0–1 | Pullbacks getting shallower | > 0.45 = signal |
| **Time Compression** | 0–1 | Pullbacks resolving faster | > 0.45 = signal |
| **Volatility Paradox** | T/F | Price up, snap-back vol down | True = strong signal |
| **FoR Permission Slip** | T/F | Deploy Convexity? | True = YES |
| **FoR Confidence** | 0–1 | How certain? | > 0.70 = high |

---

## FoR Permission Logic

```
✓ Deploy Convexity IF:
  ├─ Decay Strength > 0.55     (R_i degrading)
  ├─ Compression > 0.45         (depth or time)
  ├─ Volatility Paradox = True  (contradiction detected)
  └─ At least 2 of 3 conditions MET
  └─ AND Paradox MUST be present
```

---

## Code Integration Points

### RTM Engine
- File: `server/services/physics-based-rtm-engine.ts`
- Method: `calculateRTMMetric()`
- Returns: RTMMetric with 6 new force-decay fields

### Backtester
- File: `server/backtest/convexity-backtester-with-for.ts`
- Logic: Lines 800–835 (FoR confirmation)
- Now checks: `rtmMetric.forPermissionSlip` instead of time window

---

## Diagnostic Logging

When RTM triggers:
```
[RTM FoR] Bar 1247: Force-decay signals detected
  - Decay: 67%
  - Compression: 52%
  - Paradox: DETECTED
  → FoR CONFIRMED (confidence: 78%)
```

---

## Expected Behavior

| Condition | Old Behavior | New Behavior |
|-----------|--------------|--------------|
| Fast reversion (bar 5) | Wait 16 bars | Deploy immediately |
| Slow reversion (bar 18) | Wait 3 bars | Deploy immediately |
| No reversion (bar 25) | Wrong trigger | Skip (physics detected failure) |

---

## Performance Targets

- **Deployment speed:** 50% faster (avg bar 10–12 vs. 21)
- **Sharpe improvement:** +8–20%
- **Win rate:** Better exits via physics, not mechanics

---

## Configuration

**Thresholds (adjustable in code):**
```typescript
const DECAY_THRESHOLD = 0.55;      // R_i degradation speed
const COMPRESSION_THRESHOLD = 0.45; // Pullback shrinking
const PARADOX_WEIGHT = 1.3;        // Paradox confidence boost
```

**History windows:**
- Decay: Last 20 bars of R_i
- Compression: Last 15 pullbacks
- Paradox: 10-bar volatility window

---

## Testing Checklist

- [ ] RTM engine calculates all 6 metrics
- [ ] Backtester receives RTM metrics without error
- [ ] FoR permission slip triggers correctly
- [ ] Convexity deployment happens at RTM signal
- [ ] Logging shows decay metrics at trigger points
- [ ] Backtest runs without crashes

---

## Quick Start: Run RTM Backtest

```bash
# Run comparative backtest: RTM vs. 21-bar vs. Hybrid
pnpm tsx server/backtest/run-rtm-comparison.ts BTC USDT 2024-01-01

# Check RTM metrics in backtester logs
grep "RTM FoR" backtest-output.log | head -20
```

---

## Questions?

See full docs:
- `RTM_FORCE_DECAY_IMPLEMENTATION.md` - Detailed explanation
- `PHYSICS_BASED_RTM_VS_PRICE_STOPS.md` - Conceptual foundation
- `RTM_IMPLEMENTATION_GUIDE.md` - Original RTM system

---

*Quick Ref v1.0 - Phase 7*
