# RTM Documentation Master Index

Complete guide to Physics-Based RTM (Return-to-Mean) system and Force-Decay architecture.

---

## Quick Navigation

### 🚀 Getting Started (Start Here)

1. **RTM_FORCE_DECAY_QUICK_REF.md** ⭐  
   Quick reference with 6 metrics, thresholds, and code integration points.  
   *Read time: 5 min | Level: All*

2. **RTM_FORCE_DECAY_IMPLEMENTATION.md**  
   Detailed algorithm explanations with calculations, integration steps, and diagnostics.  
   *Read time: 20 min | Level: Developer*

3. **RTM_FORCE_DECAY_COMPLETION_SUMMARY.md**  
   Phase 7 completion summary with expectations and testing roadmap.  
   *Read time: 15 min | Level: All*

---

## Original RTM Documentation (Phase 6)

### Concept & Foundations

- **PHYSICS_BASED_RTM_VS_PRICE_STOPS.md** (10,000+ words)  
  Complete comparison: RTM physics vs. mechanical price stops  
  - Why physics-based metrics are superior
  - Four pillars explanation (Reversion Quality, Curl, Coherence, Turbulence)
  - Regime adaptation theory
  - Historical advantages

- **RTM_IMPLEMENTATION_GUIDE.md**  
  Original RTM engine deployment manual  
  - Architecture overview
  - Integration steps
  - Configuration guide
  - Hypothesis validation plan

### System Design

- **RTM_SYSTEM_DIAGRAMS.md**  
  7 visual flowcharts showing:
  - RTM calculation pipeline
  - Regime classification
  - Scout-level exit logic
  - Confidence scoring
  - Historical tracking

- **RTM_QUICK_REFERENCE.md** (Phase 6)  
  Original quick ref for RTM pillars  
  - Four pillars (Reversion Quality, Curl, Coherence, Turbulence)
  - Regime types (TRENDING, NEUTRAL, CHOPPY)
  - Thresholds and scales
  - Implementation checklist

### Validation & Testing

- **RTM_BACKTEST_VALIDATION_PLAN.md**  
  5 testable hypotheses for RTM validation  
  - Hypothesis 1: RTM triggers when mean doesn't recover
  - Hypothesis 2: Confidence scores align with outcomes
  - Hypothesis 3: Regime classification predicts performance
  - Hypothesis 4: Scout-level exits prevent overstays
  - Hypothesis 5: RTM improves Sharpe ratio vs. price stops

- **RTM_IMPLEMENTATION_COMPLETION.md**  
  Phase 6 delivery summary  
  - What was implemented
  - Code changes
  - Test results
  - Metrics validation

### Architecture & Organization

- **RTM_FILE_MANIFEST.md**  
  Complete inventory of RTM-related files  
  - Locations
  - Line ranges
  - Dependencies
  - Integration points

- **RTM_DOCUMENTATION_INDEX.md** (Phase 6)  
  Original documentation index  
  - File listings
  - Key concepts
  - Cross-references

- **PHYSICS_BASED_RTM_VS_PRICE_STOPS.md**  
  Extended comparison document  
  - Conceptual advantages (6 sections)
  - Implementation requirements
  - Historical validation
  - Risk management improvements

---

## Phase 7: Force-Decay Enhancement

### New Concepts

- **RTM_FORCE_DECAY_QUICK_REF.md** ⭐ START HERE  
  6 new metrics explained briefly with thresholds and logic

- **RTM_FORCE_DECAY_IMPLEMENTATION.md**  
  Complete algorithm documentation:
  - Decay Strength calculation
  - Pullback Compression (depth & time)
  - Volatility Paradox detection
  - FoR Permission Slip logic
  - Integration with backtester

### Phase 7 Summary

- **RTM_FORCE_DECAY_COMPLETION_SUMMARY.md**  
  Implementation complete + readiness for testing  
  - What was built (6 metrics)
  - Code changes (2 files modified)
  - Testing roadmap
  - Expected outcomes

---

## Code Reference

### Engine Implementation

**File:** `server/services/physics-based-rtm-engine.ts` (770 lines)

**Key Classes/Interfaces:**
- `PhysicsBasedRTMEngine` - Main calculation engine
- `RTMMetric` - Output interface (18 fields)
- `VectorFieldState` - Physics calculations

**Key Methods:**
- `calculateRTMMetric(frame, frames, orderFlow, entryPrice)` - Main entry
- `calculateDecayStrength()` - NEW
- `calculateDepthCompression(depth)` - NEW
- `calculateTimeCompression(duration)` - NEW
- `detectVolatilityParadox(frames, deviation)` - NEW
- `evaluateFoRPermissionSlip(...)` - NEW
- `calculateReversionQuality(frame, frames, entryPrice)` - Pillar 1
- `calculateCurlScore(frames)` - Pillar 2
- `calculateCoherenceScore(frames)` - Pillar 3
- `calculateTurbulenceIndex(frames)` - Pillar 4

### Backtester Integration

**File:** `server/backtest/convexity-backtester-with-for.ts` (1423 lines)

**FoR Confirmation Logic (Lines 780–835):**
- RTM FoR check with fallback
- Diagnostic logging
- Trend validation
- Convexity deployment trigger

**Key Logic:**
```typescript
if (rtmMetric.forPermissionSlip === true) {
  // Deploy Convexity if trend validates
}
```

---

## Metric Definitions

### Original RTM Pillars

| Metric | Type | Range | Meaning |
|--------|------|-------|---------|
| reversionQuality | number | 0–1 | Pullback depth ratio |
| curlScore | number | 0–1 | Rotational chaos |
| coherenceScore | number | 0–1 | Directional alignment |
| turbulenceIndex | number | 0+ | Volatility concentration |

### New Force-Decay Metrics (Phase 7)

| Metric | Type | Range | Meaning | Threshold |
|--------|------|-------|---------|-----------|
| decayStrength | number | 0–1 | R_i degradation rate | > 0.55 |
| depthCompression | number | 0–1 | Pullback shallowing | > 0.45 |
| timeCompression | number | 0–1 | Pullback speedup | > 0.45 |
| volatilityParadox | boolean | T/F | Contradiction detection | = True |
| forPermissionSlip | boolean | T/F | Deploy Convexity? | = True |
| forConfidence | number | 0–1 | Decision certainty | > 0.70 |

---

## Testing & Validation

### Test Files

- `test-rtm-force-decay.ts` - Validation script for force-decay metrics
- `run-rtm-comparison.ts` - Comparative backtest (RTM vs. strategies)
- `convexity-backtester-with-for.ts` - Full backtester with RTM integration

### Running Tests

```bash
# Validate RTM structure
pnpm tsx test-rtm-force-decay.ts

# Run full backtest
pnpm tsx server/backtest/convexity-backtester-with-for.ts BTC USDT 2024-01-01

# Comparative analysis
pnpm tsx server/backtest/run-rtm-comparison.ts BTC USDT 2024-01-01
```

---

## Concept Hierarchy

```
Physics-Based Trading
├── Vector Field Market Dynamics (VFMD)
│   ├── Gradient (price slope)
│   ├── Divergence (expansion/contraction)
│   ├── Curl (rotational energy)
│   └── Laplacian (curvature)
│
├── Return-to-Mean (RTM) Signal
│   ├── Phase 6: Four Pillars
│   │   ├── Reversion Quality (R_i)
│   │   ├── Curl Score
│   │   ├── Coherence Score
│   │   └── Turbulence Index
│   │
│   └── Phase 7: Force-Decay Metrics
│       ├── Decay Strength
│       ├── Depth Compression
│       ├── Time Compression
│       ├── Volatility Paradox
│       ├── FoR Permission Slip
│       └── FoR Confidence
│
└── Convexity Deployment
    ├── Phase 1: Time-Based (21 bars)
    ├── Phase 2: RTM Scout Exits
    └── Phase 3: RTM Force-Decay Permission (NEW)
```

---

## Configuration Reference

### RTM Engine Thresholds

```typescript
// In evaluateFoRPermissionSlip():
const DECAY_THRESHOLD = 0.55;           // Decay strength min
const COMPRESSION_THRESHOLD = 0.45;     // Compression min (either metric)
const PARADOX_WEIGHT = 1.3;             // Paradox confidence boost

// Decision logic:
forPermissionSlip = (2+ conditions met) AND paradoxMet
```

### History Windows

```typescript
const bufferSize = 100;           // Keep last 100 candles
const decayWindow = 20;           // R_i degradation check
const compressionWindow = 10;     // Pullback trend (up to 15 samples)
const volatilityWindow = 10;      // Vol calculation window
```

### Regime Thresholds (From Phase 6)

- **TRENDING:** Coherence < 0.4, TI < 0.8
- **NEUTRAL:** Coherence 0.4–0.6, TI 0.8–1.5
- **CHOPPY:** Coherence > 0.6, TI > 1.5

---

## Performance Expectations

### Speed

- **Old deployment:** Always bar 21
- **New deployment:** Bar 5–18 (avg 10–12)
- **Improvement:** ~50% faster

### Returns

- **Sharpe ratio:** +8–20% improvement
- **Drawdown:** Smoother equity curve
- **Win rate:** Better exits via physics vs. mechanics

---

## Roadmap & Future

### Immediate (Post-Validation)

1. ✅ Implement force-decay metrics - **DONE (Phase 7)**
2. ✅ Integrate with backtester - **DONE (Phase 7)**
3. ⏳ Run validation backtests
4. ⏳ Sensitivity analysis (thresholds)
5. ⏳ Paper trading validation

### Medium-term

6. ⏳ Regime-specific threshold tuning
7. ⏳ Live trading deployment (25% → 100%)
8. ⏳ Performance monitoring

### Long-term (Optional)

9. ⏳ Advanced visualization
10. ⏳ Database persistence
11. ⏳ Multi-pair portfolio optimization

---

## Key Insights

### Why Force-Decay > Time-Based

> "Instead of using a clock (time) to prove the mean has failed, you are using a **force-gauge (RTM)** to measure the death of the market's elasticity."

### The Four Signals

1. **Decay Strength** - Reversion elasticity fading
2. **Depth Compression** - Buyer/seller liquidity exhaustion
3. **Time Compression** - Faster snapback = weaker force
4. **Volatility Paradox** - Contradiction = smoking gun

### Composite Decision

Requires at least 2 signals + paradox to deploy Convexity. Prevents false positives from isolated metrics.

---

## Support & Questions

### For Concepts
See: `PHYSICS_BASED_RTM_VS_PRICE_STOPS.md`

### For Implementation
See: `RTM_FORCE_DECAY_IMPLEMENTATION.md`

### For Quick Reference
See: `RTM_FORCE_DECAY_QUICK_REF.md`

### For Code
See: `server/services/physics-based-rtm-engine.ts`

---

## Document Organization

### By Purpose

| Purpose | Document | Level |
|---------|----------|-------|
| Quick start | Quick Ref | All |
| Deep dive | Implementation | Dev |
| Validation | Backtest Plan | Dev |
| Summary | Completion | All |
| Comparison | Physics vs Stops | Conceptual |

### By Audience

| Audience | Start With | Then Read |
|----------|-----------|-----------|
| Trader | Quick Ref | Quick Summary |
| Developer | Implementation | Code + Comments |
| Manager | Completion Summary | Expected Outcomes |
| Researcher | Physics vs Stops | All docs |

---

## File Statistics

### Code Files
- `physics-based-rtm-engine.ts` - 770 lines (Phase 6 + 7)
- `convexity-backtester-with-for.ts` - 1,423 lines (updated Phase 7)
- `test-rtm-force-decay.ts` - 120 lines (validation script)

### Documentation Files
- Phase 6 docs: 8 files, 10,000+ words
- Phase 7 docs: 4 files (this index + 3 main docs), 5,000+ words
- **Total:** 12+ files, 15,000+ words

---

## Version History

### Phase 6: RTM Foundation
- 4 pillars: Reversion Quality, Curl, Coherence, Turbulence
- Regime classification: TRENDING, NEUTRAL, CHOPPY
- Scout-level RTM exits
- 8 comprehensive documentation files

### Phase 7: Force-Decay Enhancement (Current)
- 6 force-decay metrics for dynamic permission
- Composite FoR logic with paradox requirement
- Backtester integration with fallback
- Physics-based Convexity deployment trigger
- 4 new documentation files

---

**Last Updated:** Phase 7  
**Status:** ✅ Implementation Complete  
**Next:** Validation Testing  

---

For latest updates, see `RTM_FORCE_DECAY_COMPLETION_SUMMARY.md`
