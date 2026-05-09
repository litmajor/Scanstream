# PHASE 3: QUALITY GATING SYSTEM
## Implementation Guide - 3 Weeks

**Objective:** Filter 80%+ of losing signals while preserving 90%+ of winning signals through 5-layer quality gating system.

**Current Status:** 
- ✅ Quality gating engine complete (quality-gating-engine.ts, 450+ lines)
- ✅ Comprehensive test suite ready (phase-3-quality-gating.test.ts, 500+ lines)
- ⏳ Signal pipeline integration pending

---

## Architecture Overview

### 5-Layer Quality Gating System

```
┌────────────────────────────────────────┐
│     Aggregated Signal from Phase 2     │
│  (regime detection + dynamic weights)  │
└─────────────────────┬──────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │  LAYER 1: TIER FILTERING   │
        │  (PREMIUM/STANDARD/SPEC)   │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼────────────────────┐
        │ LAYER 2: COMPOSITE QUALITY       │
        │ (7-factor weighted scoring)      │
        └─────────────┬────────────────────┘
                      │
        ┌─────────────▼─────────────────────┐
        │ LAYER 3: CLUSTERING VALIDATION    │
        │ (pattern uniqueness/redundancy)   │
        └─────────────┬─────────────────────┘
                      │
        ┌─────────────▼─────────────────┐
        │ LAYER 4: CONSENSUS FILTERING  │
        │ (multi-source agreement)      │
        └─────────────┬─────────────────┘
                      │
        ┌─────────────▼──────────────────┐
        │   LAYER 5: FINAL DECISION      │
        │   PASS/FILTERED (4/5 layers)   │
        └─────────────┬──────────────────┘
                      │
        ┌─────────────▼──────────────────────┐
        │  Quality-Gated Signal (Enhanced)   │
        │  - Confidence adjusted             │
        │  - Quality breakdown added         │
        │  - Pass/Filter decision included   │
        └────────────────────────────────────┘
```

---

## LAYER 1: TIER-BASED FILTERING

**Purpose:** Classify signals into quality tiers (PREMIUM/STANDARD/SPECULATIVE)

**Scoring Factors (100 points total):**
- Confidence level: 0-25 points
- Source agreement: 0-25 points
- Quality score: 0-25 points
- Pattern strength: 0-25 points

**Tier Definitions:**
- **PREMIUM:** Score ≥ 85 (threshold: 70 required)
  - All-source alignment
  - High confidence (>80%)
  - Excellent quality score (>85)
  - Strong pattern agreement

- **STANDARD:** Score 65-85 (threshold: 50 required)
  - Moderate source agreement
  - Good confidence (70-80%)
  - Good quality score (70-85)
  - Solid pattern agreement

- **SPECULATIVE:** Score < 65 (threshold: 30 required)
  - Lower source agreement
  - Lower confidence (<70%)
  - Fair/poor quality
  - Weak pattern agreement

**Code Location:** `TierBasedFilter.classifyTier()`

---

## LAYER 2: COMPOSITE ENTRY QUALITY

**Purpose:** Calculate comprehensive quality score from 7 weighted factors

**Quality Components:**
1. **Confidence Quality** (20% weight)
   - Based on aggregated signal confidence
   - Range: 0-100

2. **Source Agreement** (18% weight)
   - Measures consensus between scanner, ML, RL
   - Scored as 1 - sqrt(variance) = 0-100
   - Higher agreement = higher score

3. **Regime Alignment** (15% weight, adaptive)
   - How well signal aligns with current market regime
   - Trending: Trend-following signals score 90
   - Ranging: Mean-reversion signals score 80
   - Volatile: Conservative signals score lower

4. **Pattern Reliability** (15% weight)
   - Historical accuracy of detected patterns
   - Multiple confirmed patterns boost score
   - Bonus: +10 points per additional pattern

5. **Technical Structure** (12% weight)
   - Risk-reward ratio quality
   - R:R < 1.0 = 40 points
   - R:R 1.0-1.5 = 60 points
   - R:R 1.5-2.5 = 80 points
   - R:R > 2.5 = 95 points

6. **Volume Confirmation** (12% weight)
   - Based on agreement score proxy
   - High agreement = good volume confirmation

7. **Risk-Reward** (8% weight)
   - Final R:R assessment
   - Penalizes poor risk-reward

**Adaptive Weighting by Regime:**
- TRENDING: Emphasize pattern reliability (18%), regime alignment (20%)
- RANGING: Boost risk-reward (15%), technical structure (15%)
- VOLATILE: Increase source agreement (22%), risk-reward (15%)

**Rating Scale:**
- EXCELLENT: ≥ 80 (strong buy signal)
- GOOD: 65-80 (good signal)
- FAIR: 50-65 (marginal signal)
- POOR: < 50 (avoid signal)

**Code Location:** `CompositeQualityScorer.scoreEntryQuality()`

---

## LAYER 3: CLUSTERING VALIDATION

**Purpose:** Detect pattern redundancy and maintain signal diversity

**Clustering Metrics:**

1. **Pattern Tracking**
   - Maintains sliding window of 100 recent signals
   - Counts occurrences of each pattern type
   - Auto-decays old patterns

2. **Cluster Classification**
   - **UNIQUE:** First occurrence of pattern
     - Redundancy score: 0.0
     - Uniqueness rank: 95-100

   - **COMMON:** 1-3 recent occurrences
     - Redundancy score: 0.3-0.6
     - Uniqueness rank: 50-90
     - Still acceptable (diversity maintained)

   - **REDUNDANT:** 4+ recent occurrences
     - Redundancy score: 0.5-1.0
     - Uniqueness rank: 20-50
     - Should be filtered

3. **Filtering Rule**
   - UNIQUE/COMMON patterns PASS
   - REDUNDANT patterns FILTERED
   - Prevents "pattern fatigue"

**Benefits:**
- Ensures portfolio diversity
- Prevents over-concentration in single patterns
- Maintains signal freshness

**Code Location:** `ClusteringValidator.validateClustering()`

---

## LAYER 4: CONSENSUS FILTERING

**Purpose:** Validate multi-source agreement (scanner, ML, RL)

**Consensus Score Calculation:**
```
Consensus = (scanner_confidence + ml_confidence + rl_confidence) / 3
```

**Pass Criteria:**
- Consensus ≥ 0.60 (60% agreement)
- No single source deviates >20% from average

**Dissent Handling:**
- Identifies which source disagrees most
- Logs dissenting source for debugging
- Does not filter, but flags for review

**Dynamic Thresholds:**
- Default: 0.60 minimum
- Can adjust via `setConsensusThreshold()`
- Tighter thresholds for VOLATILE regimes

**Example:**
```typescript
Scanner: 0.75
ML:      0.78
RL:      0.70
─────────────
Average: 0.74 ✅ Passes (>0.60)
Max deviation: 0.08 (8%) ✅ No dissent
```

**Code Location:** `ConsensusFilter.validateConsensus()`

---

## LAYER 5: QUALITY GATING ENGINE (ORCHESTRATOR)

**Purpose:** Combine all 4 layers into unified quality decision

**Gating Logic:**
```
Layer 1 (Tier):        Score ≥ 50 → PASS
Layer 2 (Composite):   Score ≥ 50 → PASS
Layer 3 (Clustering):  Cluster ≠ REDUNDANT → PASS
Layer 4 (Consensus):   Consensus ≥ 0.60 → PASS

Final Decision: Must pass ≥ 3/4 layers → FINAL PASS
```

**Confidence Adjustment:**
- **PASS signals:** +0 to +30% confidence boost
  - Formula: `1 + (composite_score / 100 * 0.3)`
  - Example: 80/100 score = 1.24x boost

- **FILTERED signals:** -0 to -50% confidence penalty
  - Formula: `max(0.5, 1 - (100 - composite_score) / 200)`
  - Example: 40/100 score = 0.7x penalty

**Aggregated Score:**
```
Aggregated = (
  tier_score * 0.25 +
  composite_score * 0.30 +
  uniqueness_rank * 0.20 +
  consensus_score * 0.25
) / 100
```

**Quality Metrics Dashboard:**
- Filter rate: % of signals filtered
- Pass rate: % of signals passing
- Average quality score: Across all signals
- Passed signal avg confidence
- Filtered signal avg confidence

**Code Location:** `QualityGatingEngine.gateSignal()`

---

## Implementation Checklist

### Week 1: Integration & Testing
- [ ] Import QualityGatingEngine into signal-pipeline.ts
- [ ] Add gating call after regime weighting
- [ ] Update return type to include quality_gating metadata
- [ ] Run phase-3-quality-gating tests (target: all passing)
- [ ] Verify confidence adjustments working correctly
- [ ] Log gating decisions to console

### Week 2: Calibration & Optimization
- [ ] Analyze filter rate across signal types
- [ ] Adjust tier thresholds if needed
- [ ] Tune component weights for regime alignment
- [ ] Test consensus threshold variations
- [ ] Measure impact on losing signal filtering
- [ ] Create quality metrics dashboard

### Week 3: Validation & Backtest
- [ ] Run complete backtest with quality gating
- [ ] Compare: with vs without quality gating
- [ ] Target metrics:
  - Filter rate: 75-85% of losing signals
  - Preserve rate: 85%+ of winning signals
  - Overall Sharpe improvement: +3-5%
  - Drawdown reduction: -1-2%
- [ ] Document final parameters
- [ ] Create calibration report

---

## Integration with Signal Pipeline

### Where to Add:

**File:** `server/lib/signal-pipeline.ts`
**Location:** After regime weighting, before final signal return

```typescript
// PHASE 3 WEEK 1: Apply quality gating
try {
  const gatedSignal = qualityGatingEngine.gateSignal(
    regimeAdjustedSignal,
    regimeAdjustedSignal.regimeDetection
  );

  // Log quality decision
  console.log(`[QualityGating] ${symbol}:`, {
    decision: gatedSignal.quality_gating.finalDecision,
    tier: gatedSignal.quality_gating.tier.tier,
    compositeScore: gatedSignal.quality_gating.compositeQuality.overallScore,
    confidenceAdjustment: gatedSignal.quality_gating.confidenceAdjustment,
    filterReason: gatedSignal.quality_gating.filterReason
  });

  // Optional: Skip filtered signals from trading
  if (gatedSignal.quality_gating.finalDecision === 'FILTERED') {
    console.log(`[QualityGating] Signal filtered: ${gatedSignal.quality_gating.filterReason}`);
    // Can skip sending to traders or mark for review-only
  }

  return gatedSignal;
} catch (error) {
  console.warn(`[QualityGating] Error applying quality gates:`, error);
  return regimeAdjustedSignal; // Fall back without gating
}
```

### Imports Needed:

```typescript
import { qualityGatingEngine, type QualityGatedSignal } from './quality-gating-engine';
```

---

## Success Metrics

**Must Achieve:**
- [ ] All phase-3-quality-gating tests pass (55+ tests)
- [ ] Quality gating executes in <10ms per signal
- [ ] Filter rate: 75-85% of low-quality signals
- [ ] Preserve rate: 85%+ of high-quality signals
- [ ] Confidence adjustments boost passed signals
- [ ] Filter reasons logged and useful

**Should Achieve:**
- [ ] Backtest shows +3-5% Sharpe improvement
- [ ] Drawdown reduced by 1-2%
- [ ] Win rate improved by 2-3%
- [ ] False signal rate reduced by 15%+

**Nice to Have:**
- [ ] Real-time quality metrics dashboard
- [ ] Adaptive threshold tuning
- [ ] Per-pattern quality history
- [ ] Signal-by-signal audit trail

---

## Troubleshooting

### If filter rate is too high (>90%):
1. Lower tier threshold from 50 to 40
2. Lower composite quality threshold from 50 to 45
3. Loosen consensus threshold from 0.60 to 0.55
4. Check regime alignment scoring

### If filter rate is too low (<50%):
1. Raise tier threshold from 50 to 60
2. Raise composite quality threshold from 50 to 55
3. Tighten consensus threshold from 0.60 to 0.65
4. Increase weight on pattern reliability

### If confidence adjustments seem wrong:
1. Verify composite score is 0-100
2. Check adjustment formula: `1 + (score / 100 * 0.3)`
3. Ensure filtered signals use penalty: `max(0.5, ...)`
4. Log intermediate values

---

## Key Concepts

**Quality Tiers:** Stratify signals into quality bands (PREMIUM → STANDARD → SPECULATIVE)

**Composite Quality:** 7-factor weighted scoring with adaptive regime-based weights

**Clustering:** Track pattern diversity; filter redundant patterns

**Consensus:** Ensure all 3 sources (scanner, ML, RL) generally agree

**Final Decision:** Pass ≥3/4 layers to be considered quality signal

**Confidence Adjustment:** Boost passed signals, penalize filtered signals

---

## File Structure

```
server/lib/
├── regime-assessment.ts              ✅ Complete (1100+ lines)
├── regime-signal-integration.ts      ✅ Complete (170+ lines)
├── signal-pipeline.ts                ✅ Complete (with regime weighting)
└── quality-gating-engine.ts          ✅ Complete (450+ lines)

tests/
├── phase-3-quality-gating.test.ts    ✅ Complete (500+ lines, 55+ tests)
└── regime-signal-integration.test.ts ✅ Complete (350+ lines)
```

---

## Phase 3 Timeline

**Week 1 (This Week): Infrastructure Ready** ✅
- Create quality-gating-engine.ts (5 layers)
- Create phase-3-quality-gating.test.ts (comprehensive tests)
- Document architecture and implementation guide

**Week 2: Integration & Calibration** ⏳
- Integrate into signal-pipeline.ts
- Run tests and validate
- Adjust thresholds based on results
- Create quality metrics dashboard

**Week 3: Validation & Backtest** ⏳
- Run full backtest with/without quality gating
- Compare performance metrics
- Document final parameters
- Create calibration report

---

## Expected Impact

**After Week 3:**
- Filter 80%+ of losing signals
- Preserve 85%+ of winning signals
- Reduce false signal rate by 15%+
- Improve Sharpe ratio by +3-5%
- Reduce maximum drawdown by 1-2%

**System is then ready for Phase 4:** RPG Integration as 4th signal source

