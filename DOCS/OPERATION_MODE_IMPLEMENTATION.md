# 🔄 OPERATION MODE LABELING — Implementation Complete

## Overview

Your system now explicitly distinguishes between **REPLAY**, **MIXED**, and **LIVE** modes. This prevents the false confidence penalty and makes your system's state crystal clear.

---

## Key Insight: Professional-Grade Time Awareness

Most trading systems:
- Pretend time doesn't matter
- Assume everything is live
- Trade on stale data
- Suffer false confidence

**Your system now:**
- Knows when data is old (REPLAY)
- Knows when it's mixed (MIXED)
- Knows when it's truly live (LIVE)
- Refuses to lie to itself

---

## What Changed

### 1. **OperationMode Enum** (`server/types/market-data.ts`)

```typescript
export enum OperationMode {
  REPLAY = 'REPLAY',  // Historical backfill (REST API)
  MIXED = 'MIXED',    // REST backfill + WebSocket
  LIVE = 'LIVE',      // Pure WebSocket, memory filled
}
```

### 2. **WorldTick Now Carries Mode**

Every world tick now includes:
```typescript
interface WorldTick {
  // ... existing fields ...
  mode: OperationMode;  // ← NEW: What phase are we in?
}
```

### 3. **ModeDetector Service** (`server/services/market-data/mode-detector.ts`)

Tracks:
- WebSocket vs REST tick ratio
- Backfill completion
- Average emit-lag
- Memory fill level
- Microstructure activity

Decision tree:
```
emit-lag > 60s        → REPLAY (historical)
backfill active       → MIXED
WS% > 80% + emit-lag  → LIVE
default               → MIXED
```

### 4. **ConfidenceScorer** (`server/services/market-data/confidence-scorer.ts`)

**Mode-aware confidence adjustment:**

| Mode    | Threshold | Meaning |
|---------|-----------|---------|
| REPLAY  | 0%        | No trading (data is old) |
| MIXED   | 50%       | Capped (wait for LIVE) |
| LIVE    | 100%      | Full confidence allowed |

### 5. **Updated Logging**

World ticks now log with explicit mode:

```
[IntegrityGate] ✅ World Tick: ETH/USDT 60s 
(world=2025-12-19T17:15:00.000Z, emit-lag=800ms) 
mode=LIVE

[IntegrityGate] ✅ World Tick: BTC/USDT 60s 
(world=2025-12-11T10:30:00.000Z, emit-lag=456789ms) 
mode=REPLAY
```

---

## API Diagnostics Endpoints

### Get Current Mode
```bash
curl http://localhost:5000/api/diagnostics/mode

# Response:
{
  "ok": true,
  "data": {
    "wsTickCount": 1250,
    "restTickCount": 8500,
    "wsPercentage": 13,
    "backfillComplete": false,
    "timeSinceLastTick": 45,
    "avgEmitLag": 12500,
    "memoryFillLevel": 65,
    "microstructureActive": false,
    "mode": "MIXED"
  },
  "diagnostics": "[ModeDetector] Current Mode: MIXED\n  WS: 1250 | REST: 8500 | WS%: 13%\n  Backfill: IN PROGRESS\n  Avg Emit-lag: 12500ms\n  Memory: 65%\n  Microstructure: INACTIVE"
}
```

### Check Confidence Rules
```bash
curl http://localhost:5000/api/diagnostics/confidence

# Shows how 95% raw confidence is adjusted by mode:
# REPLAY:  95% → 0% (no trading)
# MIXED:   95% → 50% (capped during backfill)
# LIVE:    95% → 95% (allowed)
```

### Full System Diagnostics
```bash
curl http://localhost:5000/api/diagnostics/system

# Complete view of system state
```

---

## Using Mode in Your Code

### In Agents (Checking Mode)

```typescript
import type { WorldTick } from '../../types/market-data';
import { OperationMode } from '../../types/market-data';

class MyAgent extends BaseAgent {
  async onWorldTick(tick: WorldTick): Promise<void> {
    // Check what mode we're in
    if (tick.mode === OperationMode.REPLAY) {
      console.log('[MyAgent] Skipping - data is historical');
      return;
    }

    if (tick.mode === OperationMode.MIXED) {
      console.log('[MyAgent] Backfill in progress - limiting position size');
      // Take smaller positions during backfill
    }

    if (tick.mode === OperationMode.LIVE) {
      console.log('[MyAgent] Live mode - full trading allowed');
      // Full trading logic
    }

    const signal = await this.analyzeCandle(tick.candle);
    this.lastSignal = signal;
  }
}
```

### In Confidence Scoring

```typescript
import { getConfidenceScorer } from '../services/market-data/confidence-scorer';
import type { WorldTick } from '../../types/market-data';

class SignalOracle {
  private scorer = getConfidenceScorer();

  scoreSignal(rawConfidence: number, tick: WorldTick) {
    const result = this.scorer.score(rawConfidence, tick, {
      name: 'ML-Classifier',
      source: 'ml-engine',
    });

    console.log(
      `[SignalOracle] ${result.reason}`
    );

    // Only trade if confidence survived mode adjustment
    if (!result.canTrade) {
      console.log('Not trading - confidence too low for current mode');
      return null;
    }

    return {
      confidence: result.adjusted,
      signal: 'BUY',
      mode: result.mode,
    };
  }
}
```

### In Strategies

```typescript
import { OperationMode } from '../../types/market-data';

class AdaptiveStrategy {
  executeTradeLogic(tick: WorldTick, signals: Signal[]) {
    // Risk adjustment based on mode
    const riskMultiplier = {
      [OperationMode.REPLAY]: 0.0,   // No trading
      [OperationMode.MIXED]: 0.3,    // 30% of normal risk
      [OperationMode.LIVE]: 1.0,     // Full risk
    }[tick.mode];

    const positionSize = this.basePositionSize * riskMultiplier;

    // Only execute if risk multiplier > 0
    if (riskMultiplier === 0) {
      return null;
    }

    // ... rest of logic ...
  }
}
```

---

## Key Signs of Each Mode

### ✅ REPLAY Mode
```
emit-lag > 60 seconds
worldTs = old date (hours/days in past)
No WebSocket ticks
Confidence = 0%
```

Expected log:
```
[IntegrityGate] ✅ World Tick: BTC/USDT 60s 
(world=2025-12-10T14:30:00.000Z, emit-lag=456789ms) 
mode=REPLAY
```

### ⚠️ MIXED Mode
```
emit-lag = 1-60 seconds
worldTs ≈ 10-60 seconds in past
WS% < 80%
Backfill in progress
Confidence capped at 50%
```

Expected log:
```
[IntegrityGate] ✅ World Tick: BTC/USDT 60s 
(world=2025-12-19T17:10:00.000Z, emit-lag=25000ms) 
mode=MIXED
```

### 🚀 LIVE Mode
```
emit-lag < 2 seconds
worldTs ≈ now (< 1 second in past)
WS% > 80%
Backfill complete
Memory filled
Microstructure active
Full confidence allowed
```

Expected log:
```
[IntegrityGate] ✅ World Tick: ETH/USDT 60s 
(world=2025-12-19T17:15:00.000Z, emit-lag=800ms) 
mode=LIVE
```

---

## How to Confirm You're Truly LIVE

### Checklist

- [ ] `emit-lag < 1-2 seconds` (diagnostic logs show this)
- [ ] `worldTs ≈ now` (market time is recent)
- [ ] `mode=LIVE` (explicitly stated in logs)
- [ ] No REST backfill in progress (backfill complete)
- [ ] WebSocket ticks arriving (WS% > 80%)
- [ ] Memory filled (OrderFlow, microstructure available)

### Quick Command

```bash
# Watch logs in real-time
tail -f logs/server-*.log | grep "World Tick"

# Should see:
# [IntegrityGate] ✅ World Tick: ETH/USDT 60s (world=2025-12-19T17:15:00.000Z, emit-lag=800ms) mode=LIVE
# [IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T17:15:00.000Z, emit-lag=750ms) mode=LIVE
```

### Query API

```bash
curl -s http://localhost:5000/api/diagnostics/mode | jq '.data | {mode, wsPercentage, avgEmitLag, backfillComplete, microstructureActive}'

# Should see:
# {
#   "mode": "LIVE",
#   "wsPercentage": 95,
#   "avgEmitLag": 850,
#   "backfillComplete": true,
#   "microstructureActive": true
# }
```

---

## Migration Guide

### If You Have Existing Code Accessing Ticks

**Old way (no mode):**
```typescript
const delay = tick.emitTime - tick.worldTime;
```

**New way (with mode awareness):**
```typescript
// Still works - delay calculation unchanged
const delay = tick.emitTime - tick.worldTime;

// But now also check mode
if (tick.mode === OperationMode.LIVE) {
  // Safe to trade with full confidence
}
```

### Update Confidence Calculations

**If you have confidence penalties:**
```typescript
// OLD: Always penalize
let adjustedConfidence = rawConfidence * 0.8;

// NEW: Don't penalize in LIVE
if (tick.mode === OperationMode.LIVE) {
  adjustedConfidence = rawConfidence;  // Allow it!
} else if (tick.mode === OperationMode.MIXED) {
  adjustedConfidence = rawConfidence * 0.5;  // Cap during backfill
} else {
  adjustedConfidence = 0;  // No trading in REPLAY
}
```

---

## The Semantic Guarantee

With explicit mode labeling, your system guarantees:

1. **REPLAY mode never allows trading** → You won't trade on 3-day-old data
2. **MIXED mode caps confidence** → You won't over-trade while backfilling
3. **LIVE mode allows full confidence** → When ready, you trade with full conviction
4. **No mode = no tick** → Every tick has a mode (no guessing)

---

## Troubleshooting

### "Why is my mode stuck at MIXED?"

Check:
```bash
curl http://localhost:5000/api/diagnostics/mode

# Look for:
# - backfillComplete: false? → REST API still loading
# - wsPercentage: low? → WebSocket not connected
# - memoryFillLevel: < 80? → OrderFlow/microstructure not ready
```

### "Why is confidence still 0 in LIVE?"

Verify:
```typescript
// Make sure you're using the scorer:
const result = scorer.score(rawConfidence, tick);
// Not just: const result = rawConfidence;
```

### "Can I force LIVE mode?"

No - it's calculated from real metrics:
- Only REST API exhaustion + recent emit-lag + high WS% forces it
- You can't lie to your system (that's the point!)

---

## Performance Notes

- **ModeDetector** stores last 100 emit-lags (minimal memory)
- **ConfidenceScorer** is stateless (instant lookup)
- **Mode detection** runs per-tick (microseconds)
- No performance impact

---

## Next Steps

1. **Monitor logs** - Watch for mode transitions
2. **Check API** - Use `/api/diagnostics/mode` to verify state
3. **Update agents** - Add mode checks to decision logic
4. **Test thoroughly** - Verify behavior in each mode before live trading

---

## Remember

This is not a limitation. It's professional-grade behavior.

Your system knows when it's safe to trade and when it's not.

That's worth more than any false confidence.
