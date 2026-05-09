# Trend + Convexity Integration Blueprint

**Date:** January 6, 2026  
**Status:** Complete Design Specification  
**Purpose:** Transform Convexity into a structurally-validated persistence engine by partnering with a Trend Engine that confirms acceptance before entry.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Metrics & Formulas](#core-metrics--formulas)
3. [Trend Engine Implementation](#trend-engine-implementation)
4. [Convexity Integration](#convexity-integration)
5. [Signal Flow & Decision Trees](#signal-flow--decision-trees)
6. [Backtest Configuration](#backtest-configuration)
7. [Logging & Visualization](#logging--visualization)
8. [RPG & Position Sizing Hooks](#rpg--position-sizing-hooks)

---

## Architecture Overview

### Synergy Model

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKET DATA (OHLCV)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              VFMD (Early Engagement Detection)               │
│  - Detects "something is happening" in structure/flow       │
└────────────┬──────────────────────────────────┬─────────────┘
             │                                  │
             ▼                                  ▼
     ┌──────────────────┐          ┌────────────────────────┐
     │   Scout Trades   │          │  Trend Engine v2       │
     │   (VFMD Entry)   │          │  (Validation Layer)    │
     └────────┬─────────┘          └─────────┬──────────────┘
              │                              │
              │ Scout PnL                    │ Calculates:
              │ (Entry validation)           │ - Acceptance Score (RA × DV)
              │                              │ - Rejection Flags
              │                              │ - Persistence Score
              │                              │ - Trend Confidence
              │                              │
              └──────────────┬───────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │  FoR Trigger (Failure Detected)│
            │  + Trend Acceptance Confirmed  │
            └────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  Convexity Entry (FoR + Trend)     │
        │  - Only trades accepted signals    │
        │  - Sizes by Persistence Score      │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │  RPG Layer (Risk Management)       │
        │  - Dynamic stops (trend-aligned)   │
        │  - Position sizing (confidence)    │
        │  - Exit on persistence loss        │
        └────────────────────────────────────┘
```

---

## Core Metrics & Formulas

### 1. **Response Alignment (RA)**

**Purpose:** Measure participant acceptance of the new trend direction.

**Formula:**
```
RA = (Volume_ith_direction / Total_Volume) × (Close_momentum / ATR)

Where:
- Volume_ith_direction: Volume bars in the trend direction (last 5 bars)
- Total_Volume: Total volume in the window
- Close_momentum: Sum of directional closes
- ATR: Average True Range (volatility normalization)

Range: 0.0 → 1.5+
Interpretation:
  < 0.3 = Weak acceptance (avoid)
  0.3 → 0.7 = Moderate acceptance
  > 0.7 = Strong acceptance (ideal)
```

**Implementation:**
```python
def response_alignment(candles: List[Candle], window: int = 5) -> float:
    """Calculate Response Alignment for trend acceptance."""
    if len(candles) < window:
        return 0.0
    
    recent = candles[-window:]
    
    # Direction detection
    direction = 1 if recent[-1].close > recent[0].open else -1
    
    # Volume in direction
    vol_in_direction = sum(
        c.volume for c in recent 
        if (direction == 1 and c.close > c.open) or 
           (direction == -1 and c.close < c.open)
    )
    
    total_volume = sum(c.volume for c in recent)
    
    # Close momentum
    close_momentum = sum(
        direction * (c.close - c.open) for c in recent
    )
    
    # ATR normalization
    atr = mean_true_range(recent)
    
    # Combine metrics
    volume_ratio = vol_in_direction / (total_volume + 1e-8)
    momentum_strength = close_momentum / (atr * window + 1e-8)
    
    # RA = weighted combination
    ra = volume_ratio * 0.6 + momentum_strength * 0.4
    
    return max(0.0, min(1.5, ra))  # Cap at 1.5 for extreme cases
```

---

### 2. **Displacement Validation (DV)**

**Purpose:** Confirm price movement is structurally backed (not noise).

**Formula:**
```
DV = (ATR_displacement / Historical_ATR) × 
     (Coherence_score / Turbulence_index)

Where:
- ATR_displacement: Current ATR * recent_bars (how far did price move?)
- Historical_ATR: 20-bar SMA of ATR
- Coherence_score: VFMD coherence metric (0-1)
- Turbulence_index: VFMD TI metric (measures chaos)

Range: 0.0 → 2.0+
Interpretation:
  < 0.4 = Weak displacement (noise)
  0.4 → 1.0 = Moderate displacement
  > 1.0 = Strong, backed displacement (ideal)
```

**Implementation:**
```python
def displacement_validation(
    candles: List[Candle],
    coherence: float,
    turbulence_index: float,
    window: int = 5
) -> float:
    """Calculate Displacement Validation for structural backing."""
    if len(candles) < 20:
        return 0.0
    
    recent = candles[-window:]
    
    # ATR displacement
    atr = mean_true_range(recent)
    displacement = atr * window  # How far did price move?
    
    # Historical ATR reference
    atr_history = [mean_true_range(candles[i:i+5]) 
                   for i in range(len(candles)-20, len(candles))]
    historical_atr = mean(atr_history)
    
    # Displacement ratio
    displacement_ratio = displacement / (historical_atr + 1e-8)
    
    # Coherence vs chaos
    chaos_penalty = 1.0 / (turbulence_index + 1.0)  # TI > 2 = chaos penalty
    coherence_boost = coherence  # VFMD coherence (0-1)
    
    # Combine
    dv = displacement_ratio * chaos_penalty * coherence_boost
    
    return max(0.0, min(2.0, dv))
```

---

### 3. **Acceptance Score (AS)**

**Purpose:** Combined signal for trend acceptance — the gateway for Convexity entry.

**Formula:**
```
AS = RA × DV

Where:
- RA: Response Alignment (0-1.5)
- DV: Displacement Validation (0-2.0)

Result Range: 0.0 → 3.0
Thresholds:
  < 0.5 = REJECTED (skip Convexity)
  0.5 → 1.0 = EARLY_TREND (Convexity enters with caution)
  1.0 → 1.5 = ACCEPTED_TREND (Convexity enters with confidence)
  > 1.5 = STRONG_TREND (Convexity enters maximally)
```

**Implementation:**
```python
def acceptance_score(
    candles: List[Candle],
    coherence: float,
    turbulence_index: float
) -> Tuple[float, str]:
    """Calculate Acceptance Score and classify trend signal."""
    ra = response_alignment(candles)
    dv = displacement_validation(candles, coherence, turbulence_index)
    
    as_score = ra * dv
    
    # Classify signal
    if as_score < 0.5:
        signal_type = "REJECTED"
    elif as_score < 1.0:
        signal_type = "EARLY_TREND"
    elif as_score < 1.5:
        signal_type = "ACCEPTED_TREND"
    else:
        signal_type = "STRONG_TREND"
    
    return as_score, signal_type
```

---

### 4. **Persistence Score (PS)**

**Purpose:** Measure how long trend acceptance persists — drives Convexity hold duration and position sizing.

**Formula:**
```
PS = (Days_coherence_held / Window) × 
     (RA_current / RA_max) × 
     (1 - volatility_spike_ratio)

Where:
- Days_coherence_held: Bars where AS > threshold (decay tracking)
- Window: Reference window (default 20 bars)
- RA_current / RA_max: Ratio of current RA to peak RA
- volatility_spike_ratio: Sudden volatility increases (0-1)

Range: 0.0 → 1.0
Interpretation:
  < 0.2 = Persistence failing (exit signal)
  0.2 → 0.6 = Declining persistence (reduce size)
  0.6 → 1.0 = Strong persistence (hold/increase size)
```

**Implementation:**
```python
def persistence_score(
    acceptance_scores: List[float],  # History of AS values
    ra_history: List[float],
    volatility_spikes: List[float],
    window: int = 20
) -> float:
    """Calculate Persistence Score — guides Convexity hold duration."""
    if len(acceptance_scores) < window:
        return 0.0
    
    recent_as = acceptance_scores[-window:]
    
    # How many bars has AS stayed > 0.5?
    coherence_bars = sum(1 for as_val in recent_as if as_val > 0.5)
    coherence_ratio = coherence_bars / window
    
    # RA decay
    recent_ra = ra_history[-window:]
    ra_current = recent_ra[-1]
    ra_max = max(recent_ra)
    ra_ratio = ra_current / (ra_max + 1e-8)
    
    # Volatility impact (sudden spikes = persistence broken)
    recent_vol_spikes = volatility_spikes[-window:]
    avg_spike = mean(recent_vol_spikes)
    vol_penalty = 1.0 - min(avg_spike, 1.0)
    
    # Combine
    ps = coherence_ratio * ra_ratio * vol_penalty
    
    return max(0.0, min(1.0, ps))
```

---

### 5. **Rejection Flag**

**Purpose:** Identify false breakouts and forced reversals that Convexity should ignore.

**Formula:**
```
REJECT if ANY of:
1. AS < 0.5 AND moving lower (AS_t < AS_{t-1} for 2+ bars)
2. Price moves 3+ ATR then reverses 2+ ATR within 3 bars (forced)
3. Volume drops >50% on breakout bar but recovers next bar (fake out)
4. Coherence drops below 0.4 while TI spikes above 2.0 (chaos)

Action: Set REJECTION_FLAG = True, skip Convexity entry
```

**Implementation:**
```python
def detect_rejection_flag(
    candles: List[Candle],
    acceptance_scores: List[float],
    coherence: float,
    turbulence_index: float
) -> bool:
    """Detect false breakouts and forced reversals."""
    if len(candles) < 5:
        return False
    
    recent = candles[-3:]
    recent_as = acceptance_scores[-3:]
    
    # Condition 1: AS declining for 2+ bars
    if len(recent_as) >= 2:
        if recent_as[-1] < 0.5 and recent_as[-1] < recent_as[-2]:
            return True
    
    # Condition 2: Forced reversal (big move then pullback)
    atr = mean_true_range(recent)
    range_1 = abs(recent[0].high - recent[0].low)
    range_2 = abs(recent[1].high - recent[1].low)
    if range_1 > 3 * atr and range_2 < range_1 - 2 * atr:
        return True
    
    # Condition 3: Volume fake-out
    if len(candles) >= 2:
        vol_current = candles[-1].volume
        vol_prev = candles[-2].volume
        if vol_prev > vol_current * 2:  # Volume drop >50%
            return True
    
    # Condition 4: Chaos detection
    if coherence < 0.4 and turbulence_index > 2.0:
        return True
    
    return False
```

---

## Trend Engine Implementation

### Core Class: `TrendConvexityEngine`

```typescript
/**
 * Trend + Convexity Integration Engine
 * 
 * Validates trends BEFORE Convexity enters
 * Ensures structural acceptance confirmed
 * Drives position sizing and hold duration via persistence
 */

import type { MarketTick, VectorField, PhysicsMetrics } from '../vfmd/types';

export interface TrendSignalState {
  acceptanceScore: number;
  signalType: 'REJECTED' | 'EARLY_TREND' | 'ACCEPTED_TREND' | 'STRONG_TREND';
  responseAlignment: number;
  displacementValidation: number;
  rejectionFlag: boolean;
  rejectionReason?: string;
  persistenceScore: number;
  confidence: number;
  timestamp: number;
  barIndex: number;
}

export class TrendConvexityEngine {
  private raHistory: number[] = [];
  private dvHistory: number[] = [];
  private asHistory: number[] = [];
  private psHistory: number[] = [];
  private rejectionHistory: boolean[] = [];
  private volatilitySpikeHistory: number[] = [];
  
  private readonly WINDOW_SIZE = 20;
  private readonly RA_THRESHOLD_WEAK = 0.3;
  private readonly RA_THRESHOLD_STRONG = 0.7;
  private readonly DV_THRESHOLD_WEAK = 0.4;
  private readonly DV_THRESHOLD_STRONG = 1.0;
  private readonly AS_THRESHOLD_REJECTION = 0.5;
  private readonly AS_THRESHOLD_EARLY = 1.0;
  private readonly AS_THRESHOLD_ACCEPTED = 1.5;

  /**
   * Calculate Response Alignment
   * Measures participant acceptance of trend direction
   */
  private calculateResponseAlignment(
    candles: MarketTick[],
    window: number = 5
  ): number {
    if (candles.length < window) return 0;

    const recent = candles.slice(-window);
    const direction = recent[window - 1].close > recent[0].open ? 1 : -1;

    // Volume in direction
    let volumeInDirection = 0;
    let totalVolume = 0;
    let closeMomentum = 0;

    for (const candle of recent) {
      const bodyDirection = candle.close > candle.open ? 1 : -1;
      const bodySize = Math.abs(candle.close - candle.open);
      
      if (bodyDirection === direction) {
        volumeInDirection += candle.volume;
      }
      totalVolume += candle.volume;
      closeMomentum += bodyDirection * bodySize;
    }

    // ATR normalization
    const atr = this.calculateATR(recent);
    
    // Combine metrics
    const volumeRatio = volumeInDirection / (totalVolume + 1e-8);
    const momentumStrength = closeMomentum / (atr * window + 1e-8);

    const ra = volumeRatio * 0.6 + momentumStrength * 0.4;
    
    return Math.max(0, Math.min(1.5, ra));
  }

  /**
   * Calculate Displacement Validation
   * Confirms price movement is structurally backed
   */
  private calculateDisplacementValidation(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number,
    window: number = 5
  ): number {
    if (candles.length < 20) return 0;

    const recent = candles.slice(-window);
    const atr = this.calculateATR(recent);
    
    // Displacement check
    const displacement = atr * window;
    
    // Historical ATR reference
    const historicalAtr = this.calculateHistoricalATR(candles, 20);
    const displacementRatio = displacement / (historicalAtr + 1e-8);

    // Chaos penalty and coherence boost
    const chaosPenalty = 1.0 / (turbulenceIndex + 1.0);
    const coherenceBoost = coherence;

    const dv = displacementRatio * chaosPenalty * coherenceBoost;
    
    return Math.max(0, Math.min(2.0, dv));
  }

  /**
   * Calculate Acceptance Score
   * Primary signal for Convexity entry permission
   */
  calculateAcceptanceScore(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number
  ): [number, TrendSignalState['signalType']] {
    const ra = this.calculateResponseAlignment(candles);
    const dv = this.calculateDisplacementValidation(candles, coherence, turbulenceIndex);
    
    const asScore = ra * dv;

    let signalType: TrendSignalState['signalType'];
    if (asScore < this.AS_THRESHOLD_REJECTION) {
      signalType = 'REJECTED';
    } else if (asScore < this.AS_THRESHOLD_EARLY) {
      signalType = 'EARLY_TREND';
    } else if (asScore < this.AS_THRESHOLD_ACCEPTED) {
      signalType = 'ACCEPTED_TREND';
    } else {
      signalType = 'STRONG_TREND';
    }

    return [asScore, signalType];
  }

  /**
   * Calculate Persistence Score
   * Guides Convexity hold duration and position sizing
   */
  calculatePersistenceScore(window: number = this.WINDOW_SIZE): number {
    if (this.asHistory.length < window) return 0;

    const recentAS = this.asHistory.slice(-window);
    const recentRA = this.raHistory.slice(-window);

    // Coherence bars (AS > 0.5)
    const coherenceBars = recentAS.filter(as => as > 0.5).length;
    const coherenceRatio = coherenceBars / window;

    // RA decay
    const raCurrent = recentRA[recentRA.length - 1];
    const raMax = Math.max(...recentRA);
    const raRatio = raCurrent / (raMax + 1e-8);

    // Volatility impact
    const recentVolSpikes = this.volatilitySpikeHistory.slice(-window);
    const avgSpike = recentVolSpikes.reduce((a, b) => a + b, 0) / recentVolSpikes.length;
    const volPenalty = 1.0 - Math.min(avgSpike, 1.0);

    const ps = coherenceRatio * raRatio * volPenalty;
    
    return Math.max(0, Math.min(1.0, ps));
  }

  /**
   * Detect Rejection Flags
   * Identifies false breakouts and forced reversals
   */
  detectRejectionFlag(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number
  ): { rejected: boolean; reason?: string } {
    if (candles.length < 5) return { rejected: false };

    const recentAS = this.asHistory.slice(-3);
    const recent = candles.slice(-3);
    const atr = this.calculateATR(recent);

    // Condition 1: AS declining for 2+ bars
    if (recentAS.length >= 2) {
      if (recentAS[recentAS.length - 1] < 0.5 &&
          recentAS[recentAS.length - 1] < recentAS[recentAS.length - 2]) {
        return { rejected: true, reason: 'AS_DECLINING' };
      }
    }

    // Condition 2: Forced reversal
    if (recent.length >= 2) {
      const range1 = recent[0].high - recent[0].low;
      const range2 = recent[1].high - recent[1].low;
      if (range1 > 3 * atr && range2 < range1 - 2 * atr) {
        return { rejected: true, reason: 'FORCED_REVERSAL' };
      }
    }

    // Condition 3: Volume fake-out
    if (candles.length >= 2) {
      const volCurrent = candles[candles.length - 1].volume;
      const volPrev = candles[candles.length - 2].volume;
      if (volPrev > volCurrent * 2) {
        return { rejected: true, reason: 'VOLUME_FAKE_OUT' };
      }
    }

    // Condition 4: Chaos detection
    if (coherence < 0.4 && turbulenceIndex > 2.0) {
      return { rejected: true, reason: 'CHAOS_DETECTED' };
    }

    return { rejected: false };
  }

  /**
   * Main entry point: Calculate full trend state
   */
  calculateTrendState(
    candles: MarketTick[],
    coherence: number,
    turbulenceIndex: number,
    barIndex: number,
    timestamp: number
  ): TrendSignalState {
    const ra = this.calculateResponseAlignment(candles);
    const dv = this.calculateDisplacementValidation(candles, coherence, turbulenceIndex);
    const [asScore, signalType] = this.calculateAcceptanceScore(candles, coherence, turbulenceIndex);
    const ps = this.calculatePersistenceScore();
    
    const { rejected, reason: rejectionReason } = this.detectRejectionFlag(
      candles,
      coherence,
      turbulenceIndex
    );

    // Update history
    this.raHistory.push(ra);
    this.dvHistory.push(dv);
    this.asHistory.push(asScore);
    this.psHistory.push(ps);
    this.rejectionHistory.push(rejected);

    if (this.raHistory.length > this.WINDOW_SIZE * 2) {
      this.raHistory.shift();
      this.dvHistory.shift();
      this.asHistory.shift();
      this.psHistory.shift();
      this.rejectionHistory.shift();
    }

    // Confidence = asScore * (1 - rejection penalty)
    const rejectionPenalty = rejected ? 0.5 : 0;
    const confidence = asScore * (1 - rejectionPenalty);

    return {
      acceptanceScore: asScore,
      signalType: rejected ? 'REJECTED' : signalType,
      responseAlignment: ra,
      displacementValidation: dv,
      rejectionFlag: rejected,
      rejectionReason,
      persistenceScore: ps,
      confidence,
      timestamp,
      barIndex,
    };
  }

  // Utility methods
  private calculateATR(candles: MarketTick[], period: number = 14): number {
    if (candles.length < period) {
      return candles.reduce((sum, c) => sum + (c.high - c.low), 0) / candles.length;
    }

    const recent = candles.slice(-period);
    let trSum = 0;

    for (const candle of recent) {
      const tr = Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - (candles[candles.length - 2]?.close || candle.close)),
        Math.abs(candle.low - (candles[candles.length - 2]?.close || candle.close))
      );
      trSum += tr;
    }

    return trSum / period;
  }

  private calculateHistoricalATR(candles: MarketTick[], window: number): number {
    if (candles.length < window) {
      return this.calculateATR(candles);
    }

    let totalATR = 0;
    for (let i = 0; i < window; i++) {
      const slice = candles.slice(candles.length - window + i - 14, candles.length - window + i);
      totalATR += this.calculateATR(slice);
    }

    return totalATR / window;
  }
}
```

---

## Convexity Integration

### Decision: When Convexity Can Trade

```
Convexity Entry Permission Matrix:

┌──────────────────────┬─────────────┬────────────────┬─────────────┐
│ Trend Signal Type    │ FoR Signal  │ Rejection Flag │ Permission  │
├──────────────────────┼─────────────┼────────────────┼─────────────┤
│ REJECTED             │ -           │ -              │ ❌ NO       │
│ EARLY_TREND          │ YES         │ NO             │ ✅ YES*     │
│ ACCEPTED_TREND       │ YES         │ NO             │ ✅ YES      │
│ STRONG_TREND         │ YES         │ NO             │ ✅ YES      │
└──────────────────────┴─────────────┴────────────────┴─────────────┘

* EARLY_TREND: Trade with reduced position size (PS < 0.5)
  Rationale: Early entry before traditional signals, but needs
  rapid FoR confirmation + low rejection risk
```

### Position Sizing by Confidence

```python
def calculate_convex_position_size(
    base_risk: float,  # Default: 0.03 (3% risk per trade)
    trend_confidence: float,  # Acceptance Score / max
    persistence_score: float,  # 0-1
    for_confidence: float,  # FoR confidence 0-1
) -> float:
    """
    Scale position based on multiple confidence factors.
    
    Position Size = Base Risk × Signal Multiplier × Persistence Factor
    """
    
    # Signal multiplier (0.5x to 1.5x)
    if trend_confidence < 0.5:
        signal_mult = 0.5
    elif trend_confidence < 1.0:
        signal_mult = 1.0
    else:
        signal_mult = 1.5
    
    # Persistence factor (0.3x to 1.2x hold time)
    if persistence_score < 0.2:
        persistence_mult = 0.3  # Failing persistence, reduce size
    elif persistence_score < 0.6:
        persistence_mult = 0.7
    else:
        persistence_mult = 1.2
    
    # FoR boost
    for_mult = 0.5 + (for_confidence * 0.5)  # 0.5x to 1.0x
    
    # Final size
    position_size = (
        base_risk * 
        signal_mult * 
        persistence_mult * 
        for_mult
    )
    
    return min(position_size, base_risk * 2.0)  # Cap at 2x base
```

### Convexity Hold Duration

```python
def calculate_convex_hold_bars(
    base_hold: int,  # Default: 50 bars
    persistence_score: float,  # 0-1
    acceptance_score: float,  # 0-3
) -> int:
    """
    Scale hold duration based on trend persistence and acceptance.
    
    Hold = Base × (1 + Persistence × 0.4) × (1 + Acceptance / 5)
    """
    
    persistence_factor = 1.0 + (persistence_score * 0.4)
    acceptance_factor = 1.0 + (min(acceptance_score, 3.0) / 5.0)
    
    hold_bars = int(base_hold * persistence_factor * acceptance_factor)
    
    return min(hold_bars, base_hold * 2)  # Cap at 2x base
```

---

## Signal Flow & Decision Trees

### Bar-by-Bar Flow

```
FOR EACH MARKET BAR:
  
  1. LOAD MARKET DATA
     ├─ OHLCV candle
     ├─ Calculate ATR
     └─ Update VFMD field

  2. VFMD ANALYSIS
     ├─ FieldConstructor → vector field
     ├─ PhysicsCalculator → coherence, TI, PEG
     └─ If PEG spike → signal "something happening"

  3. SCOUT EXECUTION (VFMD)
     ├─ Check: PEG > threshold & coherence > 0.5
     ├─ If YES → Generate scout signal
     │   ├─ Direction: based on PEG vector
     │   ├─ Entry: current price
     │   ├─ Target: +2.5 ATR (bullish) or -2.5 ATR (bearish)
     │   └─ Stop: ±0.7 ATR
     └─ Execute scout trade (2-3 bar window)

  4. TREND ENGINE (NEW)
     ├─ Calculate Response Alignment (RA)
     ├─ Calculate Displacement Validation (DV)
     ├─ Compute Acceptance Score (AS = RA × DV)
     ├─ Detect Rejection Flags
     ├─ Update Persistence Score (PS)
     └─ Output: TrendSignalState

  5. FoR TRIGGER
     ├─ Feed scout PnL → FailureOfReversionCalculator
     ├─ Identify hostile events (pullbacks)
     ├─ Check: Reversion quality decaying?
     ├─ Output: FoR score (0-1)
     └─ If FoR > threshold → "Permission to deploy Convexity"

  6. CONVEXITY DECISION
     ├─ Check: Trend Signal = EARLY/ACCEPTED/STRONG?
     ├─ Check: FoR score > threshold?
     ├─ Check: Rejection flag = false?
     ├─ If ALL YES:
     │   ├─ Calculate position size (trend_confidence × persistence)
     │   ├─ Enter Convexity trade
     │   ├─ Set stop loss: -1% (BTC) or -2% (ETH)
     │   ├─ Set max hold: base_hold × persistence_mult
     │   └─ Record: entry_trend_signal, entry_as_score, entry_ps
     └─ Else: Wait for next signal

  7. CONVEXITY HOLD
     ├─ FOR EACH BAR:
     │   ├─ Update Persistence Score
     │   ├─ If PS < 0.2 (persistence failing):
     │   │   └─ Exit trade (trend lost)
     │   ├─ If FoR completion signal:
     │   │   └─ Exit trade (reversion resumed)
     │   ├─ If max hold exceeded:
     │   │   └─ Exit trade (time limit)
     │   └─ If stop loss hit:
     │       └─ Exit trade (risk limit)
     └─ Record: exit_reason, pnl, pnlPct

  8. LOGGING & METRICS
     ├─ Log trend signal: barIndex, AS, RA, DV, PS, signalType
     ├─ Log scout result: entry/exit price, pnl
     ├─ Log FoR state: score, hostile_events, decay_analysis
     ├─ Log Convexity: entry/exit, position_size, pnl
     └─ Update: win_rate, sharpe_ratio, max_drawdown

END FOR
```

### Decision Tree: Should Convexity Enter?

```
START
  │
  ├─ Is Acceptance Score (AS) < 0.5?
  │  └─ YES → REJECT (signal too weak)
  │
  ├─ Is Rejection Flag = TRUE?
  │  └─ YES → REJECT (false breakout detected)
  │
  ├─ Is FoR Score > 0.40?
  │  └─ NO → WAIT (reversion still strong, no permission)
  │
  ├─ Is Signal Type in [EARLY_TREND, ACCEPTED_TREND, STRONG_TREND]?
  │  └─ NO → REJECT (trend not accepted)
  │
  └─ All conditions pass:
     ├─ Calculate position_size = base_risk × trend_confidence × persistence
     ├─ Calculate hold_bars = base_hold × (1 + PS × 0.4)
     ├─ Set stop_loss = ±1% (BTC) or ±2% (ETH)
     ├─ ENTER Convexity trade
     └─ Success ✅

```

---

## Backtest Configuration

### BTC Optimized Parameters (From Grid Search)

```typescript
export const BTC_CONVEXITY_PARAMS = {
  // Scout parameters
  scoutTargetMultiplier: 2.0,      // 2.0 ATR target
  scoutStopMultiplier: 0.7,        // 0.7 ATR stop
  
  // Convexity parameters
  convexStopLossPercent: 0.01,     // 1.0% stop (OPTIMIZED)
  convexMaxHoldingBars: 60,        // 60 bars (OPTIMIZED)
  forConfidenceThreshold: 0.30,    // 30% FoR min (OPTIMIZED)
  
  // Trend Engine parameters
  raThresholdWeak: 0.3,
  raThresholdStrong: 0.7,
  dvThresholdWeak: 0.4,
  dvThresholdStrong: 1.0,
  asThresholdRejection: 0.5,
  asThresholdEarly: 1.0,
  asThresholdAccepted: 1.5,
  
  // Persistence tracking
  persistenceWindow: 20,            // 20-bar window
  persistenceMinThreshold: 0.2,     // Exit if PS < 0.2
  
  // Rejection detection
  asDeclineWindow: 3,               // 3 bars of AS decline = rejection
  volumeFakeOutRatio: 2.0,          // 50% volume drop = fake-out
  coherenceChaosBoundary: 0.4,      // Coherence < 0.4 + TI > 2 = chaos
};
```

### ETH Optimized Parameters

```typescript
export const ETH_CONVEXITY_PARAMS = {
  // Scout parameters
  scoutTargetMultiplier: 2.5,
  scoutStopMultiplier: 0.7,
  
  // Convexity parameters
  convexStopLossPercent: 0.02,      // 2% stop (volatility higher)
  convexMaxHoldingBars: 50,         // Shorter hold (faster momentum)
  forConfidenceThreshold: 0.60,     // Higher FoR threshold (more selective)
  
  // Trend Engine parameters (same as BTC)
  raThresholdWeak: 0.3,
  raThresholdStrong: 0.7,
  dvThresholdWeak: 0.4,
  dvThresholdStrong: 1.0,
  asThresholdRejection: 0.5,
  asThresholdEarly: 1.0,
  asThresholdAccepted: 1.5,
  
  // Persistence tracking
  persistenceWindow: 20,
  persistenceMinThreshold: 0.2,
  
  // Rejection detection
  asDeclineWindow: 3,
  volumeFakeOutRatio: 2.0,
  coherenceChaosBoundary: 0.4,
};
```

---

## Logging & Visualization

### Comprehensive Trade Log

```json
{
  "backtest": {
    "symbol": "BTC/USDT",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "totalBars": 8760,
    "params": { "convexStopLossPercent": 0.01, "convexMaxHoldingBars": 60 }
  },
  "trades": [
    {
      "tradeIndex": 1,
      "entryBar": 100,
      "entryTimestamp": "2024-01-05T14:00:00Z",
      "entryPrice": 42500.00,
      "direction": "BUY",
      
      "trendSignal": {
        "acceptanceScore": 1.25,
        "signalType": "ACCEPTED_TREND",
        "responseAlignment": 0.75,
        "displacementValidation": 1.67,
        "persistenceScore": 0.65,
        "rejectionFlag": false,
        "confidence": 1.25
      },
      
      "forSignal": {
        "forScore": 0.52,
        "forConfidence": 0.35,
        "hostileEventCount": 2,
        "decayStrength": 0.48,
        "timeCompressing": true,
        "depthCompressing": false,
        "volatilityParadox": false
      },
      
      "positionSizing": {
        "baseRisk": 0.03,
        "trendConfidenceMultiplier": 1.2,
        "persistenceMultiplier": 1.1,
        "forMultiplier": 1.0,
        "finalPositionSize": 0.0396,
        "dollarsRisked": 1653.00
      },
      
      "exitBar": 125,
      "exitTimestamp": "2024-01-06T13:00:00Z",
      "exitPrice": 43000.00,
      "exitReason": "TAKE_PROFIT",
      
      "resultMetrics": {
        "pnl": 166.50,
        "pnlPct": 1.01,
        "holdingBars": 25,
        "maxPnL": 210.00,
        "maxDrawdown": -65.00,
        "finalPersistenceScore": 0.52,
        "didPersistenceDecay": false
      }
    }
  ],
  "summary": {
    "totalTrades": 45,
    "winningTrades": 31,
    "losingTrades": 14,
    "winRate": 0.6889,
    "totalPnL": 8245.30,
    "avgWin": 312.50,
    "avgLoss": -98.75,
    "profitFactor": 2.58,
    "sharpeRatio": 1.85,
    "maxDrawdown": -1245.00,
    "maxDrawdownPct": -12.45
  }
}
```

### Visualization Outputs

```python
# 1. Trend Signal Overlay Chart
def plot_trend_signals(candles, trend_states):
    """
    Chart showing:
    - Candlesticks
    - Acceptance Score (0-3 scale, color coded)
    - Trend signal type (REJECTED/EARLY/ACCEPTED/STRONG)
    - Rejection flags (red X marks)
    - Scout entries/exits
    - Convexity entries/exits
    """
    pass

# 2. Signal Quality Dashboard
def plot_signal_quality():
    """
    4-panel dashboard:
    - Panel 1: RA (Response Alignment) over time
    - Panel 2: DV (Displacement Validation) over time
    - Panel 3: AS (Acceptance Score) vs. Convexity PnL
    - Panel 4: PS (Persistence Score) vs. Convexity hold duration
    """
    pass

# 3. FoR vs. Trend Alignment
def plot_for_trend_correlation():
    """
    Shows:
    - FoR score (blue line)
    - Trend signal type (colored bars)
    - Convexity entry points (green +)
    - Convexity exit points (red X)
    - Correlation stat (FoR confidence × trend confidence)
    """
    pass

# 4. Position Sizing Heat Map
def plot_position_sizing_analysis():
    """
    Heat map showing:
    - X-axis: Trend Confidence (0-1)
    - Y-axis: Persistence Score (0-1)
    - Color: Position size (darker = larger)
    - Overlay: Win rate in each cell
    """
    pass
```

---

## RPG & Position Sizing Hooks

### Integration with RPG (Risk Position Growth)

```typescript
/**
 * RPG Hook: Convexity position sizing and exit rules
 * 
 * RPG controls:
 * 1. Position size based on account equity and risk
 * 2. Stop loss levels (time-based or fixed)
 * 3. Take profit targets
 * 4. Exit triggers (time, P&L, trend loss)
 */

export interface ConvexityRPGConfig {
  // Risk management
  riskPerTrade: number;              // % of equity at risk
  maxPositionSize: number;            // Max $ per trade
  maxConcurrentPositions: number;     // Max trades open
  
  // Stop loss
  fixedStopPercent: number;           // ±1% (BTC) or ±2% (ETH)
  timeBasedAdaptiveStops: boolean;    // Enable adaptive tightening
  
  // Exit triggers
  trendPersistenceMinThreshold: number;  // Exit if PS < this
  forCompletionExit: boolean;         // Exit when FoR says reversion complete
  maxHoldBars: number;                // Hard stop on hold duration
  
  // Scaling rules
  trendConfidenceScaling: (score: number) => number;  // RA × DV scaling
  persistenceScaling: (score: number) => number;      // PS scaling
}

class ConvexityRPGIntegration {
  /**
   * Called when Convexity wants to enter
   * RPG validates position size and risk
   */
  validateAndSizePosition(
    baseRisk: number,
    trendState: TrendSignalState,
    forConfidence: number,
    currentEquity: number
  ): { approved: boolean; positionSize: number; reason?: string } {
    
    // Scale position by trend and FoR confidence
    const trendMult = this.scaleTrendConfidence(trendState.acceptanceScore);
    const persistenceMult = this.scalePersistence(trendState.persistenceScore);
    const forMult = 0.5 + (forConfidence * 0.5);
    
    let positionSize = baseRisk * trendMult * persistenceMult * forMult;
    
    // Cap by max position
    const maxPosition = (currentEquity * 0.05) / 100;  // 5% of equity max
    positionSize = Math.min(positionSize, maxPosition);
    
    // Approve if risk reasonable
    const riskAmount = currentEquity * positionSize;
    if (riskAmount < currentEquity * 0.03) {
      return { approved: true, positionSize };
    }
    
    return { 
      approved: false,
      positionSize: 0,
      reason: 'Risk too high'
    };
  }

  /**
   * Called each bar: Check if Convexity should exit
   */
  shouldExitConvexity(
    currentTrendState: TrendSignalState,
    entryTrendState: TrendSignalState,
    holdingBars: number,
    maxHoldBars: number,
    currentPnL: number,
    entryPrice: number
  ): { exit: boolean; reason?: string } {
    
    // Exit if persistence failing
    if (currentTrendState.persistenceScore < 0.2) {
      return { exit: true, reason: 'PERSISTENCE_FAILURE' };
    }
    
    // Exit if trend rejected
    if (currentTrendState.signalType === 'REJECTED') {
      return { exit: true, reason: 'TREND_REJECTED' };
    }
    
    // Exit if time limit exceeded
    if (holdingBars >= maxHoldBars) {
      return { exit: true, reason: 'MAX_HOLD_EXCEEDED' };
    }
    
    // Exit on significant loss
    if (currentPnL < -0.02 * entryPrice) {  // 2% loss
      return { exit: true, reason: 'LOSS_LIMIT' };
    }
    
    return { exit: false };
  }

  private scaleTrendConfidence(acceptanceScore: number): number {
    if (acceptanceScore < 0.5) return 0.5;
    if (acceptanceScore < 1.0) return 1.0;
    if (acceptanceScore < 1.5) return 1.2;
    return 1.5;
  }

  private scalePersistence(persistenceScore: number): number {
    if (persistenceScore < 0.2) return 0.3;
    if (persistenceScore < 0.6) return 0.7;
    return 1.2;
  }
}
```

### Dynamic Stop Loss (Trend-Aware)

```python
def calculate_trend_aware_stop(
    entry_price: float,
    entry_trend_state: TrendSignalState,
    current_bars_held: int,
    base_stop_percent: float = 0.01,  # 1% for BTC
) -> float:
    """
    Stop loss adapts as trend acceptance changes.
    
    During strong acceptance: looser stops (let winners run)
    During weak acceptance: tighter stops (protect winners)
    """
    
    # Base stop
    stop_loss = entry_price * (1 - base_stop_percent)
    
    # Adjust for entry signal strength
    signal_mult = {
        'EARLY_TREND': 1.5,       # Tighter stop (risky entry)
        'ACCEPTED_TREND': 1.0,    # Normal stop
        'STRONG_TREND': 0.8,      # Looser stop (high conviction)
    }
    
    multiplier = signal_mult.get(entry_trend_state.signalType, 1.0)
    stop_loss = entry_price * (1 - (base_stop_percent * multiplier))
    
    return stop_loss
```

---

## Next Steps for Implementation

1. **Create `TrendConvexityEngine` class** (TypeScript)
   - Implement all metric calculations
   - Wire into `ConvexityBacktesterWithFoR`

2. **Integrate with Convexity entry logic**
   - Add trend signal check before FoR deployment
   - Scale position size by trend confidence & persistence

3. **Add comprehensive logging**
   - Log trend state each bar
   - Track AS, RA, DV, PS history
   - Record rejection flags and reasons

4. **Backtest on BTC/ETH with optimized params**
   - Compare: Convexity alone vs. Convexity + Trend Engine
   - Measure: Win rate improvement, reduced false entries

5. **Visualize signal quality**
   - Create overlay charts (AS, RA, DV, PS)
   - Dashboard showing correlation between trend metrics and PnL

6. **Tune thresholds per asset**
   - Run parameter sweep on AS thresholds
   - Optimize PS persistence window
   - Calibrate rejection flag sensitivity

---

## Summary: The Synergy

| Aspect | Benefit |
|--------|---------|
| **Entry Validation** | Convexity only trades ACCEPTED trends (AS > 1.0) |
| **Noise Filtering** | Rejection flag catches false breakouts automatically |
| **Early Window** | EARLY_TREND signals capture moves 3-8 bars before traditional MA alignment |
| **Persistence Riding** | PS drives hold duration — longer holds when acceptance is strong |
| **Risk Control** | Position size scales with trend confidence & persistence (max 2x base risk) |
| **Structural Backing** | DV ensures price moves are backed by coherence & low chaos (TI < 2.0) |
| **Dynamic Exits** | Convexity exits when PS < 0.2 (persistence failing) not just on fixed stops |

---

**The Trend Engine is Convexity's structural validator.** It ensures every trade is accepted by the market before risking capital, then guides position sizing and hold duration based on how long that acceptance persists. This transforms Convexity from a reactive momentum trader into a **persistence rider with market acceptance confirmation**.

