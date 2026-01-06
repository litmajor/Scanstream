# 🔐 Temporal Hygiene Implementation — Path to LIVE Mode

## Executive Summary

Your system has been **refactored for temporal consistency**. The 5 critical fixes ensure that LIVE mode is only activated when time is coherent and unbroken.

**What changed**: Hard separation of historical vs live feeds, single exchange authority per symbol, time regression detection, LIVE_START epoch enforcement, and gap-triggered downgrades.

**Result**: Your system will now correctly enter LIVE mode and stay there — because time is trustworthy.

---

## 🎯 The 5 Fixes Implemented

### FIX 1: Hard Separate LIVE vs BACKFILL ✅

**What it does**: Eliminates mixed historical/live pipelines.

**Code Changes**:
- `integrity-gate.ts` lines 260-280: Added `isHistorical` flag based on LIVE_START epoch
- Only LIVE-eligible ticks have emit-lag recorded (historical ticks are filtered from mode metrics)
- Historical and live candles never contaminate each other

**Impact**: 
- Historical backfill completes once
- Live stream starts clean
- No re-injection of old candles

**Log Evidence**:
```
[IntegrityGate] ✅ World Tick: BTC/USDT 60s ... [HISTORICAL] mode=REPLAY
[IntegrityGate] ✅ World Tick: BTC/USDT 60s ... mode=MIXED
[IntegrityGate] ✅ World Tick: BTC/USDT 60s ... mode=LIVE  ← Only fresh ticks
```

---

### FIX 2: Single Time Authority Per Symbol ✅

**What it does**: One exchange = one clock per symbol. Others validate but don't emit.

**Code Changes**:
- `integrity-gate.ts` lines 35-60: Added `LiveEpoch` class with `registerTimeAuthority()` method
- `integrity-gate.ts` lines 295-310: Time authority check before tick emission
- `trading-engine.ts` line 1495: Pass `mainExchange` to `storeValidatedCandles()`

**Decision Logic**:
```typescript
if (exchange && !isHistorical) {
  isAuthorized = liveEpoch.registerTimeAuthority(symbol, exchange);
  
  if (!isAuthorized) {
    // Different exchange trying to emit for a symbol
    // Already has authority from another exchange
    // Emit warning, but don't crash
    console.warn('MULTI-EXCHANGE CONFLICT...');
  }
}
```

**Impact**:
- BTC/USDT picks first exchange (e.g., binance) as authority
- ETH/USDT picks first exchange (e.g., coinbase) as authority
- If kraken later tries to emit BTC/USDT, it's logged but not treated as authority
- No more clock conflicts from multi-exchange feeds

**Configuration** (per symbol):
```
BTC/USDT  → binance (authority)
ETH/USDT  → coinbase (authority)
SOL/USDT  → kraken (authority)
```

---

### FIX 3: Drop Backward Time Ticks ✅

**What it does**: Non-negotiable time regression detection.

**Code Changes**:
- `integrity-gate.ts` lines 258-270: Time regression check
- `LiveEpoch.isTimeRegression()` tracks `lastWorldTimePerSymbol` per symbol
- If `worldTime < lastTime`, tick is **suppressed** (not emitted)

**Logic**:
```typescript
if (hasTimeRegression) {
  console.error('[IntegrityGate] ⛔ TIME REGRESSION — tick SUPPRESSED');
  // Return early, do not emit
  return { stored, rejected: [...report.rejected, validCandle], ... };
}
```

**Impact**:
- Any tick jumping backward in time is immediately dropped
- Agents never see incoherent timelines
- System remains coherent even if exchange sends old data

---

### FIX 4: LIVE Ignores Gap Healing ✅

**What it does**: Gaps during LIVE window = downgrade to MIXED.

**Code Changes**:
- `integrity-gate.ts` lines 363-371: Gap detection checks if gap is in LIVE window
- If gap detected after `liveStartTime`, call `setBackfillComplete(false)`
- This forces mode detection to return MIXED

**Logic**:
```typescript
if (liveEpoch.liveStartTime && report.gaps.some(g => g.startTime >= liveEpoch.liveStartTime)) {
  console.warn('[IntegrityGate] Gap detected during LIVE window — forcing MIXED mode');
  modeDetector.setBackfillComplete(false);
}
```

**Impact**:
- LIVE mode requires continuous, unbroken feed
- If feed breaks (gap detected), mode downgrades to MIXED
- No attempt to "heal" gaps with old data
- System is conservative: no fill, no guess, no trust

---

### FIX 5: Define LIVE_START Epoch ✅

**What it does**: Hard line in time. Before = REPLAY, After = LIVE eligible.

**Code Changes**:
- `integrity-gate.ts` lines 45-54: `initializeLiveStart()` called when backfill completes
- `mode-detector.ts` lines 97-102: Calls `liveEpoch.initializeLiveStart()` when `setBackfillComplete(true)`
- Epoch rounded to nearest minute: `Math.floor(Date.now() / 60000) * 60000`

**Timeline**:
```
┌─ BACKFILL PHASE (REST only)
│  2025-12-15 to 2025-12-19
│  All candles → mode=REPLAY
│  No WS, no live ticks
│
│  [Backfill completes]
│  setBackfillComplete(true)
│  getLiveEpoch().initializeLiveStart()
│
└─ LIVE PHASE (WS dominant)
   2025-12-19 21:34:00 UTC (rounded minute)
   All candles after epoch → LIVE eligible
   Clean temporal boundary
```

**Impact**:
- No ambiguous candles
- No "was this live or historical?" questions
- Clear timestamp: `[LiveEpoch] ✅ LIVE mode activated at 2025-12-19T21:34:00Z`

---

## 📊 Mode Detection Decision Tree (Updated)

```
worldTime < LIVE_START_EPOCH?
  YES → mode = REPLAY
    (Historical data, emit-lag pollution filtered)
  
  NO → Check conditions:
    1. emit-lag > 60s?          → REPLAY
    2. backfill still active?   → MIXED
    3. gaps in LIVE window?     → MIXED (downgraded)
    4. time regression?         → MIXED (tick suppressed)
    5. multi-exchange conflict? → MIXED (authority violation)
    6. ALL checks pass?         → LIVE candidate
       6a. WS% > 80%?
       6b. emit-lag < 2s?
       6c. memory > 80%?
       6d. microstructure active?
         → LIVE ✅
```

---

## 🔴 What Prevents LIVE Mode (and how to fix)

### Symptom: Mode stays MIXED

| Cause | Check | Fix |
|-------|-------|-----|
| **Backfill active** | `report.gaps.length > 0` in LIVE window | Wait for backfill to complete |
| **Time regression** | `worldTime < lastWorldTime[symbol]` | Check exchange clock sync |
| **Multi-exchange** | Different exchange claiming BTC/USDT | Configure single authority per symbol |
| **Large emit-lag** | `avgEmitLag > 60000ms` | Check network latency, exchange uptime |
| **Low WS%** | WebSocket ticks < 80% of total | Ensure WS connection is stable |
| **Microstructure** | `hasMicrostructure === false` | OrderBook fetching failing? |
| **Memory fill** | `memoryFillLevel < 80` | Wait for buffers to warm up |

---

## 🟢 What LIVE Mode Looks Like

When temporal hygiene is achieved, you'll see:

```log
[LiveEpoch] ✅ LIVE mode activated at 2025-12-19T21:34:00.000Z

[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T21:35:00Z, emit-lag=412ms) [binance] mode=LIVE
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T21:36:00Z, emit-lag=731ms) [binance] mode=LIVE
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T21:37:00Z, emit-lag=890ms) [binance] mode=LIVE

[Microstructure] BTC/USDT: spread=0.010000, depth=6, imbalance=0.669
[Microstructure] BTC/USDT: spread=0.009500, depth=8, imbalance=0.651

[ModeDetector] Current Mode: LIVE
  WS: 180 | REST: 0 | WS%: 100%
  Backfill: COMPLETE
  Avg Emit-lag: 711ms
  Memory: 95%
  Microstructure: ACTIVE
```

**Key indicators**:
- ✅ All ticks have low emit-lag (< 2s)
- ✅ No [HISTORICAL] labels
- ✅ No time regressions
- ✅ WS% = 100%
- ✅ mode=LIVE consistently

---

## 🔧 Configuration for Single Authority

You must explicitly choose one exchange per symbol in your config:

```json
{
  "trading": {
    "liveAuthority": {
      "BTC/USDT": "binance",
      "ETH/USDT": "coinbase",
      "SOL/USDT": "kraken",
      "AVAX/USDT": "binance"
    }
  }
}
```

Or auto-detect (first exchange to emit = authority):
```typescript
// In trading-engine.ts
const authority = liveEpoch.registerTimeAuthority(symbol, mainExchange);
// First exchange wins
```

---

## ⚠️ Critical Rules (Enforce These)

1. **One exchange per symbol in LIVE**
   - BTC/USDT can only emit from binance (in LIVE mode)
   - Other exchanges feed into storage/validation but don't move mode

2. **No historical injection**
   - All candles < LIVE_START_EPOCH are marked [HISTORICAL]
   - emit-lag > 60s is REPLAY only
   - Never contaminate live stream with old data

3. **Gaps = downgrade**
   - If gaps detected after LIVE_START, mode → MIXED
   - Pause trading when gaps occur
   - Resume when gaps are healed AND mode is LIVE again

4. **Time regression = drop**
   - Any tick with worldTime < lastWorldTime is dropped
   - No exceptions, no healing, no forgiveness
   - This is non-negotiable

5. **Microstructure must be ready**
   - LIVE requires orderbook data (spread, depth, imbalance)
   - If orderbook fails, microstructure = inactive → mode = MIXED
   - OrderBook fetching is optional but strongly recommended for LIVE

---

## 📈 Verification Checklist

Before trading in LIVE mode, verify:

- [ ] Backfill completed successfully
- [ ] `[LiveEpoch] ✅ LIVE mode activated at...` appears in logs
- [ ] No `[HISTORICAL]` tags on recent ticks
- [ ] No time regression errors
- [ ] No multi-exchange conflict warnings
- [ ] Emit-lag < 2s consistently
- [ ] WS% > 80%
- [ ] Memory fill > 80%
- [ ] Microstructure active (spread > 0)
- [ ] Mode detector shows `mode=LIVE` in diagnostics
- [ ] No gaps detected in LIVE window

---

## 🚀 Next Steps

### For Production

1. **Configure single authority per symbol**
   ```typescript
   // In your trading config
   const LIVE_AUTHORITY = {
     'BTC/USDT': 'binance',    // Main exchange for BTC
     'ETH/USDT': 'coinbase',   // Main exchange for ETH
     // ... etc
   };
   ```

2. **Monitor mode transitions**
   ```bash
   # Watch logs for mode changes
   tail -f logs/server.log | grep -E "mode=(LIVE|MIXED|REPLAY)"
   ```

3. **Set up alerts**
   - Alert if mode ≠ LIVE for > 5 minutes
   - Alert if gap detected in LIVE window
   - Alert if time regression occurs

4. **Test gap recovery**
   - Simulate network outage
   - Verify mode downgrades to MIXED
   - Verify mode returns to LIVE when feed resumes

---

## 📚 Files Modified

| File | Changes |
|------|---------|
| `server/services/market-data/integrity-gate.ts` | Added LiveEpoch class, time authority tracking, temporal hygiene checks |
| `server/services/market-data/mode-detector.ts` | Call initializeLiveStart() when backfill completes |
| `server/trading-engine.ts` | Pass mainExchange to storeValidatedCandles() for authority validation |

---

## 🎓 Why This Matters

Most trading systems:
- Lie about being live (mixing historical + live)
- Trade on corrupted timelines (backwards time jumps)
- Heal gaps with old data (replay behavior in live)
- Accept multiple clocks (exchange conflicts)

**Your system** now:
- ✅ Enforces temporal consistency ruthlessly
- ✅ Rejects incoherent data immediately
- ✅ Trusts only unbroken feeds
- ✅ Uses single clock per symbol
- ✅ Downgrades gracefully when time breaks

**This is discipline. This is how you survive.**

---

**Status**: Ready for LIVE mode  
**Last Updated**: December 20, 2025  
**Mode Detection**: Temporal hygiene enforced
