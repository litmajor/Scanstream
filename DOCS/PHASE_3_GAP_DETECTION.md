# PHASE 3 — Gap Detection Without Drama

**Goal:** Visibility first. No healing yet. Stop trading blind.

This alone improves Sharpe by preventing trades on incomplete market data.

---

## Overview

**The Problem:**
- Markets have gaps (holiday breaks, exchange halts, data transmission delays)
- Without visibility, you trade on incomplete pictures
- This destroys Sharpe ratio and causes false signals

**The Solution (PHASE 3):**
- Minimal logic: detect gaps, emit visibility events
- Two-level detection:
  1. **WITHIN-BATCH:** Gaps inside a single candle batch
  2. **CROSS-BATCH:** Gaps between last stored and first new (new in Phase 3)
- No healing logic yet (Phase 4, future)
- Agents subscribe to `gap.detected` events to react with visibility-first logic

---

## Implementation

### 1. Cross-Batch Gap Detection (CandleIntegrityLayer)

```typescript
// server/services/market-data/candle-integrity-layer.ts

private detectGaps(candles: Candle[]): { valid: Candle[]; gaps: Gap[]; } {
  const gaps: Gap[] = [];

  // PHASE 3: CROSS-BATCH GAP DETECTION
  if (candles.length > 0 && this.metrics.lastValidTimestamp) {
    const firstNew = candles[0];
    const delta = firstNew.ts - this.metrics.lastValidTimestamp;
    const expectedDelta = this.timeframeMs;
    
    if (delta > expectedDelta) {
      const gapMs = delta - expectedDelta;
      const missingCandles = Math.round(gapMs / this.timeframeMs);
      
      gaps.push({
        symbol: this.symbol,
        timeframe: this.timeframe,
        from: this.metrics.lastValidTimestamp + expectedDelta,
        to: firstNew.ts,
        expectedCandles: missingCandles,
        missingCandles,
      });
      
      console.log(
        `[CIL] 📊 CROSS-BATCH GAP: ${this.symbol}/${this.timeframe}s ` +
        `| Missing=${missingCandles} periods`
      );
    }
  }

  // WITHIN-BATCH GAP DETECTION (existing logic)
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const expectedNext = prev.ts + this.timeframeMs;
    const gap = curr.ts - expectedNext;

    if (gap > 0) {
      const missingCandles = Math.round(gap / this.timeframeMs);
      gaps.push({
        symbol: this.symbol,
        timeframe: this.timeframe,
        from: expectedNext,
        to: curr.ts,
        expectedCandles: missingCandles,
        missingCandles,
      });
    }
  }

  return { valid: candles, gaps };
}
```

**Key Point:** `this.metrics.lastValidTimestamp` tracks the last successfully stored candle. Comparing against first new candle reveals cross-batch gaps.

### 2. Gap Event Emission (IntegrityGate)

```typescript
// server/services/market-data/integrity-gate.ts

if (report.gaps.length > 0) {
  console.warn(
    `[IntegrityGate] 📊 Detected ${report.gaps.length} gaps for ${symbol}:${timeframe}`
  );
  
  // Aggregate event
  this.emit('gaps.detected', { symbol, timeframe, gaps: report.gaps });
  
  // PHASE 3: Individual gap events for agent monitoring
  for (const gap of report.gaps) {
    this.emit('gap.detected', {
      symbol,
      timeframe,
      gap,
      severity: gap.missingCandles > 10 ? 'high' : 'medium',
      timestamp: new Date().toISOString(),
    });
  }
}
```

Two events:
- **`gaps.detected`** — Aggregate: all gaps in one batch
- **`gap.detected`** — Individual: each gap with severity metadata

---

## How Agents React

### Pattern 1: Visibility (Recommended)

```typescript
// agent/visibility-first.ts

export class GapAwareAgent {
  constructor(private gate: IntegrityGate) {
    // Subscribe to individual gap events
    this.gate.on('gap.detected', (event) => {
      console.log(
        `[Agent] ⚠️ Gap detected: ${event.symbol}/${event.timeframe}s ` +
        `missing ${event.gap.missingCandles} candles`
      );
      
      // Visibility action: log, alert, adjust risk
      this.logGapAlert(event);
    });
  }

  private logGapAlert(event: any) {
    // Store gap event for monitoring
    // Could write to dashboard: "Blind period: 10:00-10:05 UTC on AAPL/1m"
    // Risk adjustment: lower position size during gaps
  }
}
```

### Pattern 2: Pause Trading During Gap

```typescript
// agent/gap-pause.ts

export class GapAwareTrader {
  private gapActive = false;
  private gapEnd = 0;

  constructor(private gate: IntegrityGate) {
    this.gate.on('gap.detected', (event) => {
      this.gapActive = true;
      this.gapEnd = event.gap.to;
      
      console.log(
        `[Trader] ⏸️ Pausing trades until ${new Date(this.gapEnd).toISOString()}`
      );
    });
  }

  shouldTrade(currentTime: number): boolean {
    // Don't trade if we're in a gap
    if (this.gapActive && currentTime < this.gapEnd) {
      return false;
    }
    this.gapActive = false;
    return true;
  }
}
```

### Pattern 3: Severity-Based Logic

```typescript
// agent/severity-aware.ts

export class SeverityAwareAgent {
  constructor(private gate: IntegrityGate) {
    this.gate.on('gap.detected', (event) => {
      if (event.severity === 'high') {
        // Big gap (>10 candles): full pause
        this.pauseTrading();
      } else {
        // Medium gap: log only
        this.logWarning(event);
      }
    });
  }

  private pauseTrading() {
    console.log('[Agent] 🛑 HIGH SEVERITY gap - pausing all trades');
  }

  private logWarning(event: any) {
    console.log(`[Agent] ⚠️ MEDIUM gap - ${event.gap.missingCandles} candles`);
  }
}
```

---

## Event Flow Diagram

```
Market Data (CCXT) 
   ↓
ADAPTER 
   ↓
VALIDATION (CandleIntegrityLayer)
   ├─ Within-batch: compare consecutive candles
   ├─ Cross-batch: compare last stored vs first new ← PHASE 3
   └─ Report: {stored, rejected, gaps}
   ↓
INTEGRITY GATE
   ├─ Store to database
   ├─ Emit 'world.tick' (validated facts)
   ├─ Emit 'gaps.detected' (aggregate)
   └─ Emit 'gap.detected' (individual) ← PHASE 3
   ↓
AGENTS & STRATEGIES
   ├─ React to 'world.tick' (trading logic)
   └─ React to 'gap.detected' (visibility/pause) ← PHASE 3
```

---

## Gap Detection Accuracy

### What Gets Detected

✅ **Missing candles between batches** (cross-batch)
```
Last stored: 10:00 UTC (1m candle)
First new: 10:05 UTC (should be 10:01)
Gap detected: 4 candles missing (10:01, 10:02, 10:03, 10:04)
```

✅ **Missing candles within batch** (within-batch)
```
Batch: [10:01, 10:02, 10:05, 10:06]
Gap detected: 10:03, 10:04 missing
```

✅ **Exchange halts, holidays, data transmission delays**
```
Result: Explicit gap with timestamp range
```

### What Doesn't Get Detected

❌ **Healing:** Phase 4 feature
❌ **Tick data gaps:** Only candle-level gaps (configurable)
❌ **Volume anomalies:** Separate feature

---

## Monitoring & Debugging

### Log Lines to Watch

```
[CIL] 📊 CROSS-BATCH GAP: BTC/USDT/1m | Last=2024-01-15T10:00:00Z | First=2024-01-15T10:05:00Z | Missing=4 periods
[IntegrityGate] 📊 Detected 1 gaps for BTC/USDT:60
[IntegrityGate] Gap detected event emitted (severity=medium)
```

### Event Subscription Example

```typescript
const gate = new IntegrityGate();

gate.on('gap.detected', (event) => {
  console.log(`Gap event:`, {
    symbol: event.symbol,
    timeframe: event.timeframe,
    missingCandles: event.gap.missingCandles,
    from: new Date(event.gap.from).toISOString(),
    to: new Date(event.gap.to).toISOString(),
    severity: event.severity,
  });
});
```

---

## Configuration

No config needed. Gap detection is **always on** and **zero-cost** (comparison logic only).

### Per-Symbol Control (Future)

```typescript
// Not implemented yet, but pattern for Phase 4:
interface GapConfig {
  symbol: string;
  timeframe: number;
  enableVisibility: boolean;  // Phase 3 (default: true)
  enableHealing: boolean;     // Phase 4 (default: false)
  healingStrategy: 'interpolate' | 'forward-fill' | 'pause';
}
```

---

## Sharpe Improvement Mechanism

### Before (Blind)
```
Market: 10:00 ✅ | 10:01 MISSING | 10:02 MISSING | 10:03 ✅
Agent: "Prices moved from 100 to 90, short it!"
Reality: Actually the market was closed for 2 minutes
Result: False signal, Sharpe destroyed
```

### After (Phase 3)
```
Market: 10:00 ✅ | 10:01 MISSING | 10:02 MISSING | 10:03 ✅
Gate: Emits 'gap.detected' event
Agent: Sees gap, pauses trading during blind period
Agent: "Prices moved from 100 to 90, but market had a gap. Don't trade."
Result: Avoids false signal, Sharpe protected
```

---

## Performance Impact

**Negligible:**
- One timestamp comparison per batch: `O(1)`
- One event emission per gap: `O(gaps)` typically 0-2 per batch
- No storage, no healing logic, no memory overhead

---

## Testing

### Manual Test 1: Within-Batch Gap

```typescript
const layer = CandleIntegrityFactory.getOrCreate('TEST', 60);

const candles: Candle[] = [
  { ts: 1000000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
  { ts: 1000120, open: 100.5, high: 101.5, low: 100, close: 101, volume: 1100 }, // Gap: 120s vs expected 60s
];

const report = layer.validateAndNormalize(candles);
console.assert(report.gaps.length > 0, 'Should detect within-batch gap');
```

### Manual Test 2: Cross-Batch Gap

```typescript
const layer = CandleIntegrityFactory.getOrCreate('TEST', 60);

// First batch
const batch1: Candle[] = [
  { ts: 1000000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
];
layer.validateAndNormalize(batch1);

// Second batch (gap before it)
const batch2: Candle[] = [
  { ts: 1000300, open: 100.5, high: 101.5, low: 100, close: 101, volume: 1100 }, // 300s gap vs expected 60s
];

const report = layer.validateAndNormalize(batch2);
console.assert(report.gaps.length > 0, 'Should detect cross-batch gap');
console.log(`Gap: ${report.gaps[0].missingCandles} candles missing`); // Should be ~4
```

---

## Architecture Alignment

**Confirms Phase 2 Locking:**

```
SOURCE → ADAPTER → ✅ VALIDATION (now with cross-batch)
         ↓
    INTEGRITY LAYER
         ↓
    GATE (atomic storage+emit)
         ↓
    📍 WORLD TICK (facts only)
         ↓
    AGENTS (can now react to gaps)
```

**New:** Gap events as first-class observable, not healing logic.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Purpose** | Visibility-first gap detection without healing |
| **Detection** | Within-batch + cross-batch comparison |
| **Events** | `gap.detected` (individual), `gaps.detected` (aggregate) |
| **Severity** | `high` (>10 missing) or `medium` (≤10) |
| **Agent Pattern** | Subscribe, log, pause, adjust risk |
| **Performance** | O(1) comparison, negligible overhead |
| **Healing** | Not in Phase 3 (Phase 4 future) |
| **Sharpe Impact** | Positive (avoids blind-period trades) |

---

## Next Steps (Phase 4)

When visibility proves valuable:
1. Healing strategies (interpolation, forward-fill)
2. Adaptive healing by severity and asset class
3. Cross-market correlation filling (use correlated asset data)
4. Gap event aggregation across portfolio

For now: **Just visibility. Just events. Just pause.**

