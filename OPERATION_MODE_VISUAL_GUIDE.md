# 🔄 OPERATION MODE — Visual Architecture

## System Flow

```
┌─────────────────────────────────────────────────────────┐
│ DATA SOURCES                                            │
├─────────────────────────────────────────────────────────┤
│  CCXT (Crypto)  │  OANDA (Forex)  │  MT5  │  FIX      │
└────────┬────────┴────────┬────────┴───┬────┴────┬──────┘
         │                 │            │         │
         └─────────────────┴────────────┴─────────┘
                           │
                ┌──────────▼──────────┐
                │  Market Data Layer  │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────────────────┐
                │  Integrity Gate (Validation)    │
                │  ✓ Continuity checks            │
                │  ✓ OHLC validation             │
                │  ✓ Finality logic              │
                └──────────┬─────────────────────┘
                           │
                ┌──────────▼──────────────────────┐
                │  🔄 MODE DETECTION              │
                │  - Emit-lag calculation         │
                │  - WS vs REST tracking          │
                │  - Backfill detection           │
                └──────────┬─────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐     ┌─────▼──────┐    ┌────▼────┐
    │ REPLAY  │     │   MIXED    │    │  LIVE   │
    │---------|     |------------|    |---------|
    │emit-lag │     │emit-lag    │    │emit-lag │
    │> 60s   │     │1-60s       │    │< 2s    │
    │---------|     |------------|    |---------|
    │Confid=0%│    │Confid≤50%  │    │Confid=∞│
    │No trade │    │Cap trading │    │Full go │
    └────┬────┘    └─────┬──────┘    └────┬────┘
         │               │                 │
         └───────────────┼─────────────────┘
                         │
                ┌────────▼──────────┐
                │ World Tick Emit   │
                │ (with mode label) │
                └────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼────┐      ┌────▼─────┐    ┌───▼────┐
    │ Agents │      │Strategies│    │Storage │
    └────────┘      └──────────┘    └────────┘
```

---

## Mode Transition Timeline

### Timeline: System Starting

```
Time:     0ms                    30s                    120s
Event:    STARTUP               WS CONNECT             BACKFILL DONE
          │                     │                      │
Mode:     REPLAY ──────────────►│ MIXED ──────────────►│ LIVE
          │                     │                      │
Logs:     emit-lag=456789ms    emit-lag=35000ms      emit-lag=800ms
          WS%=0%                WS%=45%                WS%=92%
          Backfill: IN PROGRESS │ Backfill: IN PROGRESS │ Backfill: COMPLETE
          │                     │                      │
Trading:  ❌ BLOCKED           ⚠️ LIMITED (30%)        ✅ FULL (100%)
```

---

## Mode Detection Decision Tree

```
                         ┌──────────────────────┐
                         │ Emit-lag received    │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼──────────┐
                         │ Is lag > 60 sec?    │
                         └──────────┬──────────┘
                         YES│      │NO
                ┌────────────┘      │
                │                   │
            ┌───▼──────┐            │
            │ REPLAY   │            │
            └──────────┘    ┌───────▼─────────┐
                            │ Backfill        │
                            │ still active?   │
                            └───────┬─────────┘
                         YES│      │NO
                ┌───────────┘      │
                │                  │
            ┌───▼──────┐           │
            │ MIXED    │    ┌──────▼──────────────┐
            └──────────┘    │ Check live criteria:│
                            │ • WS% > 80%        │
                            │ • emit-lag < 2s    │
                            │ • Memory > 80%     │
                            │ • Microstructure   │
                            │   active?          │
                            └──────┬─────────────┘
                         ALL YES│ │NO
                ┌───────────────┘ │
                │                 │
            ┌───▼──────┐     ┌────▼──┐
            │ LIVE     │     │ MIXED │
            └──────────┘     └───────┘
```

---

## Confidence Adjustment Flow

```
                   ┌──────────────────┐
                   │ Raw Confidence   │
                   │ (e.g., 0.95)     │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │ Check WorldTick  │
                   │ mode field       │
                   └────┬─┬─┬─────────┘
                        │ │ │
         ┌──────────────┘ │ └──────────────┐
         │                │                │
    ┌────▼────┐      ┌────▼────┐    ┌─────▼──┐
    │ REPLAY  │      │ MIXED   │    │ LIVE   │
    └────┬────┘      └────┬────┘    └────┬───┘
         │                │              │
    ┌────▼────────┐  ┌────▼────┐  ┌─────▼──────┐
    │ Cap = 0%    │  │Cap = 50%│  │Cap = 100%  │
    │-------------|  |---------|  |------------|
    │0.95 → 0.0  │  │0.95 → 0.5│  │0.95 → 0.95│
    └────┬────────┘  └────┬────┘  └─────┬──────┘
         │                │              │
         └────────────────┼──────────────┘
                          │
                   ┌──────▼──────────┐
                   │ Adjusted        │
                   │ Confidence      │
                   └──────┬──────────┘
                          │
                   ┌──────▼──────────┐
                   │ Is > 0.3?       │
                   │ Can trade?      │
                   └─────────────────┘
```

---

## Metrics Dashboard

### What ModeDetector Tracks

```
┌─────────────────────────────────────────┐
│ MODE DETECTOR METRICS                   │
├─────────────────────────────────────────┤
│                                         │
│ Tick Counts:                            │
│   WS Ticks:        1,250                │
│   REST Ticks:      8,500                │
│   WS Percentage:   13% ⚠️               │
│                                         │
│ Timing:                                 │
│   Avg Emit-lag:    12,500ms ⚠️         │
│   Time Since Last:  45ms                │
│                                         │
│ System State:                           │
│   Backfill Status: IN PROGRESS ⚠️      │
│   Memory Fill:     65% 📊               │
│   Microstructure:  INACTIVE ⚠️         │
│                                         │
│ Current Mode:      MIXED ⚠️             │
│   Reason: Backfill active, WS% low     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Code Integration Points

### 1. IntegrityGate (Validation)
```
integrityGate.ts
├─ Calculate worldTime
├─ Calculate emitTime
├─ Detect mode via ModeDetector  ← NEW
├─ Create WorldTick with mode   ← NEW
└─ Log with explicit mode       ← NEW
```

### 2. ModeDetector (Decision)
```
mode-detector.ts
├─ recordTick(source)
├─ recordEmitLag(lag)
├─ detectMode()
└─ getMetrics()
```

### 3. ConfidenceScorer (Adjustment)
```
confidence-scorer.ts
├─ score(rawConfidence, tick)
│  ├─ Check tick.mode
│  ├─ Apply threshold
│  └─ Return adjusted
└─ isTradeworthy(confidence, mode)
```

### 4. API (Monitoring)
```
diagnostics-mode.ts
├─ GET /api/diagnostics/mode
├─ GET /api/diagnostics/confidence
└─ GET /api/diagnostics/system
```

---

## Real-World Example: Trading Sequence

### Session 1: Clean Startup

```
10:00:00  │ Server starts
          │ [ModeDetector] Starting...
          │
10:00:05  │ REST backfill begins
          │ [IntegrityGate] Loading 24h of data
          │ (worldTime = 2025-12-18 10:00:00)
          │ (emit-lag = 456,789ms)
          │ mode=REPLAY
          │ → Trading disabled
          │
10:02:15  │ WebSocket connects
          │ [ModeDetector] WS connection detected
          │ [ModeDetector] WS%: 5% → 45%
          │ [IntegrityGate] emit-lag = 35,000ms
          │ mode=MIXED
          │ → Trading at 30% position size
          │
10:03:45  │ Memory filled, microstructure active
          │ [ModeDetector] Backfill complete!
          │ [ModeDetector] WS%: 92%
          │ [ModeDetector] emit-lag: 1,200ms
          │ mode=LIVE
          │ → Trading at 100% position size
          │
10:04:00  │ System live and trading normally
```

---

## Confidence Penalty Comparison

### Before Mode Labeling (❌ Old Way)

```
Raw Confidence: 0.95
Always apply: 0.95 × 0.8 = 0.76 (penalty)
Problem: Confidence penalized even in LIVE mode!
```

### After Mode Labeling (✅ New Way)

```
Raw Confidence: 0.95

If REPLAY:  0.95 → 0.00 (no trading)
If MIXED:   0.95 → 0.50 (capped)
If LIVE:    0.95 → 0.95 (no penalty!)
```

---

## System State Visualization

```
                    REPLAY               MIXED               LIVE
                    ──────               ─────               ────
Emit-lag:          456s                  35s                 1s
World Time:        2d ago                1m ago              now
WS %:              0%                    45%                 92%
Backfill:          LOADING               LOADING             COMPLETE
Memory:            0%                    65%                 90%
Microstructure:    INACTIVE              INACTIVE            ACTIVE
Confidence Cap:    0%                    50%                 100%
Position Size:     0%                    30%                 100%
Trading Status:    ❌ NO                 ⚠️ LIMITED          ✅ YES
```

---

## Logs Reading Guide

### Parse This Log

```
[IntegrityGate] ✅ World Tick: BTC/USDT 60s
(world=2025-12-19T17:15:00.000Z, emit-lag=800ms)
mode=LIVE
```

**Breakdown:**
- `World Tick: BTC/USDT 60s` → 1-hour candle for Bitcoin
- `world=2025-12-19T17:15:00.000Z` → Market time when candle closed
- `emit-lag=800ms` → Wall-clock time to emit was 800ms later
- `mode=LIVE` → System is live (not backfilling, WS dominant, recent data)

**Interpretation:**
✅ Live data  
✅ Recent market time  
✅ Short emit-lag  
✅ Safe to trade  

---

## Troubleshooting Flowchart

```
System not trading?
│
├─ Check logs for mode
│  │
│  ├─ mode=REPLAY → Wait for WS connection
│  ├─ mode=MIXED → Wait for backfill complete
│  └─ mode=LIVE → Check confidence scoring
│
├─ Query API
│  curl http://localhost:5000/api/diagnostics/mode
│  │
│  ├─ backfillComplete=false → REST API still loading
│  ├─ wsPercentage < 80 → WebSocket not connected
│  ├─ microstructureActive=false → Wait for OrderFlow
│  └─ memoryFillLevel < 80 → Memory not ready
│
└─ Check confidence
   scoreWithCurrentMode(0.95)
   │
   ├─ adjusted=0.00 → Data is old, skip
   ├─ adjusted=0.50 → Backfill active, cap at 50%
   └─ adjusted=0.95 → Live, confidence OK
```

---

## The Key Guarantees

```
┌─────────────────────────────────────────┐
│ YOUR SYSTEM GUARANTEES                  │
├─────────────────────────────────────────┤
│                                         │
│ 🔒 NEVER trades in REPLAY              │
│    (emit-lag > 60s or backfilling)     │
│                                         │
│ 🔒 NEVER over-leverages in MIXED       │
│    (position size capped at 30%)        │
│                                         │
│ 🔒 NEVER ignores mode detection         │
│    (explicitly labeled on every tick)   │
│                                         │
│ 🔒 NEVER lies about system state        │
│    (metrics drive mode, not guessing)   │
│                                         │
└─────────────────────────────────────────┘
```

This is what professional-grade trading infrastructure looks like.
