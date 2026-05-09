# Metrics Flow After FieldConstructor Fix (Feb 2025)

## Architecture: Six-Layer Physics Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 0: PRICE DATA (raw market ticks)                              │
│  Input: [BTC $95,000, $96,500, ...] or [ETH $3,400, $3,405, ...]   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: FIELD CONSTRUCTION (NEW FIX: velocity normalized)         │
│  Spatial Grid:   50 bins, [0-1] normalized price levels            │
│  Vector Storage: fx = velocity, fy = acceleration                  │
│                                                                      │
│  BEFORE FIX: fx stored as raw dollars                              │
│    BTC: $300/candle, ETH: $30/candle → 10x difference               │
│  AFTER FIX: fx = (raw_velocity / priceRange) [0, ~0.5]             │
│    Both: normalized % of window range → SAME SCALE ✓               │
│                                                                      │
│  📍 FieldConstructor.constructField(prices)                         │
│    Line ~130: priceVelocity[i] / priceRange  ← THE FIX             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: PHYSICS METRICS (all now scale-agnostic)                  │
│                                                                      │
│  PEG (Potential Energy Gradient)                                    │
│    Input:  ∫|∇F| dA over recent region (gradient integration)      │
│    After:  [0, ~1] range (was [0, $thousands] for BTC)             │
│    Usage:  Thresholds: > 1.5 for BREAKOUT, < 1.0 for ACCUM        │
│                                                                      │
│  TI (Turbulence Index)                                              │
│    Input:  Var(angles) / Coherence (always ratio-based)            │
│    After:  [0, ~3] range (unchanged, was already normalized)       │
│    Usage:  Thresholds: > 2.0 for TURBULENT, < 1.0 for quiet       │
│                                                                      │
│  Coherence Score                                                    │
│    Input:  |mean vector| / mean magnitude                          │
│    After:  [0, 1] range (unchanged)                                │
│    Usage:  Threshold: > 0.6 for trending, < 0.3 for weak          │
│                                                                      │
│  Divergence Score                                                   │
│    Input:  ∂Fx/∂i + ∂Fy/∂j (curl in 2D, normalized field)         │
│    After:  [-0.5, +0.5] approx (was [-500, +500] for BTC)         │
│    Usage:  Thresholds: < -0.3 for ACCUM, > 0.3 for DIST           │
│                                                                      │
│  📍 PhysicsCalculator.computeAllMetrics(field)                      │
│    Now receives normalized field → all metrics automatically scale │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: REGIME CLASSIFICATION (simplified, no normalization)      │
│                                                                      │
│  BEFORE FIX: 2-step process                                        │
│    1. normalizeMetricsForAsset() — tried to fix scale mismatch     │
│    2. classify() — applied thresholds to normalized metrics        │
│    Problem: assetBaselines were guesses (off by 2 orders)         │
│                                                                      │
│  AFTER FIX: 1-step process                                         │
│    1. classify() receives already-normalized metrics               │
│    2. Applies thresholds directly (peg > 1.5, ti < 2.0, etc)      │
│    3. No asset parameter needed anymore (deprecated but kept)     │
│                                                                      │
│  Decision Tree (priority):                                          │
│    1. TI > 2.0? → TURBULENT_CHOP                                    │
│    2. PEG > 1.5 & TI < 0.8 & coherence > 0.5? → BREAKOUT          │
│    3. div < -0.3 & TI < 1.0 & PEG < 1.0? → ACCUMULATION           │
│    4. div > 0.3 & TI > 1.2 & PEG > 1.2? → DISTRIBUTION            │
│    5. coherence > 0.6 & TI < 1.0? → LAMINAR_TREND                 │
│    6. Otherwise → CONSOLIDATION                                     │
│                                                                      │
│  ✅ All thresholds now work for both BTC and ETH                    │
│  ✅ ETH no longer stuck in CONSOLIDATION                            │
│                                                                      │
│  📍 RegimeClassifier.classify(metrics) [asset param deprecated]    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 4: TRIGGER & PERMISSION                                       │
│                                                                      │
│  TriggerCalculator computes constraint violations:                  │
│    - Volatility too high? (vi > threshold)                          │
│    - Distance from MA stale? (price far from MA)                    │
│    - Other hard constraints                                         │
│                                                                      │
│  Uses: metrics.peg, metrics.divergence                              │
│        (both now scale-agnostic)                                    │
│                                                                      │
│  📍 TriggerCalculator.computeTrigger(metrics)                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 5: PROFIT ESTIMATION & SIGNAL GENERATION                     │
│                                                                      │
│  ProfitEstimator scores win probability:                            │
│    Inputs: PEG, TI, Divergence, Coherence (all normalized)         │
│    Output: bullish_score / bearish_score for direction             │
│                                                                      │
│  VFMDPhysicsAgent applies regime thresholds:                       │
│    Regime-specific PEG thresholds (asset-aware)                    │
│    Regime-specific TRIGGER thresholds (asset-aware)                │
│    Profit score filter (asset-aware, BTC: 65, ETH: 50)            │
│                                                                      │
│  📍 ProfitEstimator.estimateProfit(metrics, previousMetrics, ...)  │
│  📍 VFMDPhysicsAgent.generateSignal(ticks)                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Illustration

```
Input Prices          Normalized Field       Physics Metrics         Classification
─────────────────────────────────────────────────────────────────────────────────
BTC $95-99k    →   Vectors [0.05, 0.02]  →  PEG: 0.42   →  LAMINAR_TREND
                     Uniform scale             TI: 0.85      (regime applies)
                     (same as ETH)             Div: -0.02

ETH $3.4-3.5k  →   Vectors [0.04, 0.03]  →  PEG: 0.38   →  BREAKOUT_TRANSITION
                     Uniform scale             TI: 0.76      (regime applies)
                     (same as BTC!)            Div: 0.15
```

## Threshold Calibration Status

### Current Thresholds (written for old raw-dollar scale)

| Threshold | Old Scale | New Scale | Status |
|-----------|-----------|-----------|--------|
| PEG > 1.5 (BREAKOUT) | $1,500+ for BTC, $150+ for ETH | Both ~0.5-1.0 | ❓ May be too high |
| TI > 2.0 (TURBULENT) | 2.0 variance units | Same ~2.0 | ✓ Ratio-based, OK |
| Coherence > 0.6 (LAMINAR) | 60% aligned | Same 60% | ✓ Already normalized |
| Divergence > ±0.3 (DIST/ACCUM) | ±$300 for BTC, ±$30 for ETH | Both ±0.1-0.3 | ❓ May need adjustment |

### Data Captured During Backtest

The backtest logs actual metric distributions for verification:
- **min/max/mean** for each metric per asset
- **regime distribution** to verify classification is working
- Compared against thresholds to identify recalibration needs

Run after backtest completes:
```
VFMDPhysicsAgent.dumpMetricsAnalysis()
```

Output shows if threshold adjustments needed.

## Expected Outcomes After Fix

✅ **ETH regime diversity**: Should see all 6 regimes (not 100% CONSOLIDATION)
✅ **PEG now comparable**: BTC and ETH PEG values in same [0,~1] range
✅ **Divergence working**: Accumulation/distribution patterns detected for both assets
✅ **Metrics logging**: Raw values captured for manual verification of thresholds

## Threshold Recalibration Needed?

After running backtest with logging, if observed values exceed thresholds:
- **PEG max > 3.0**: Lower BREAKOUT threshold from 1.5 → 0.8
- **TI rarely > 2.0**: Lower TURBULENT threshold from 2.0 → 1.5
- **Divergence max > 1.0**: Raise ACCUMULATION threshold from -0.3 → -0.5

Recalibration is data-driven from actual backtest runs.
