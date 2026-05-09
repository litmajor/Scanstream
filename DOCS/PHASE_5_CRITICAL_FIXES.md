# Phase 5: Critical Fixes for ARMED Mode & Data Flow

**Date**: December 20, 2025  
**Status**: ✅ All fixes implemented and compiled  
**Files Modified**: 4 core services

---

## Summary of Issues & Fixes

Three critical bugs were preventing BACKFILL→ARMED→LIVE progression:

### 1. Stale Data Rejection Too Aggressive (UNI/USDT, AAVE/USDT)
**Symptom**: Data with emit-lag 25-1 hours being rejected in ARMED mode
```
[IntegrityGate] ⛔ STALE DATA REJECTED: UNI/USDT:60 (mode=ARMED, emit-lag=25.1 hours)
```

**Root Cause**: 
- Stale data check applied in both ARMED and LIVE modes
- During ARMED transition, REST still fetches historical tail-end data (decades of candles)
- 1-hour threshold rejected legitimate backfill data (Dec 15-19 data fetched on Dec 20)

**Fix** (`integrity-gate.ts` lines 218-233):
```typescript
// OLD:
if (anchor_for_check && anchor_for_check.mode !== 'BACKFILL') {
  if (lag_check > 3600000) reject();
}

// NEW: Only apply threshold in LIVE mode
if (anchor_for_check && anchor_for_check.mode === 'LIVE') {
  if (lag_check > 3600000) reject();
}
```

**Result**: 
- BACKFILL: All data accepted (no threshold)
- ARMED: All data accepted (allows backfill tail + WS probation mix)
- LIVE: Data > 1 hour old rejected (maintains freshness)

---

### 2. ARMED Mode Rejecting REST Candles (Tail Backfill)
**Symptom**: BNB/USDT, LINK/USDT, XRP/USDT discovered but immediately rejected
```
[TimeAnchor] ⛔ BNB/USDT:60 rejected: Only WS allowed in ARMED probation
```

**Root Cause**:
- TimeAnchor validation logic said "WS only" in ARMED mode
- During ARMED transition, REST continues fetching historical tail-end data
- This is normal and expected — backfill doesn't stop abruptly at transition
- Both REST and WS are legitimate during ARMED probation period

**Fix** (`time-anchor.ts` lines 243-263):
```typescript
// OLD:
if (anchor.mode === 'ARMED') {
  if (source !== 'WS') reject();  // ← Too strict!
  return allowed;
}

// NEW: Allow both REST and WS during ARMED
if (anchor.mode === 'ARMED') {
  if (source === 'REST') {
    if (worldTime > anchor.lastHistoricalTs) reject();
    return allowed; // ← Tail backfill OK
  }
  if (source === 'WS') {
    return allowed; // ← Probation OK
  }
}
```

**Result**: 
- REST candles fetch tail of backfill (historical boundary respected)
- WS candles begin probation tracking (emit-lag monitored)
- Both flow through without rejection during ARMED

---

### 3. Unsafe Fallback Storage (TypeError at line 530)
**Symptom**: When all candles rejected, fallback code crashes
```
TypeError: Cannot read properties of undefined (reading 'ts')
at IntegrityGate.<anonymous> (integrity-gate.ts:530:70)
```

**Root Cause**:
- Integrity gate rejects all candles (legitimate: stale data, gaps, authority conflicts)
- Fallback in trading-engine.ts tries to store rejected candles anyway
- Uses `enrichedFrames` array which may not exist or be empty
- Crashes when accessing frame properties

**Fix** (`trading-engine.ts` lines 1513-1519):
```typescript
// OLD:
catch (integrityError) {
  console.warn('...falling back to direct storage...');
  for (const frame of enrichedFrames) {
    await storage.createMarketFrame({...}); // ← Can crash if frame undefined
  }
}

// NEW: Safe failure — no fallback storage
catch (integrityError) {
  console.error('[Trading] Integrity gate check failed:', integrityError);
  console.warn('[Trading] Cannot use fallback storage — rejecting all candles for safety');
  // Do NOT store directly after integrity failure
  // Next fetch cycle will retry if data becomes valid
}
```

**Result**:
- Prevents database contamination
- Allows next fetch cycle to retry
- No crashes on rejections

---

## Enhanced MarketDataFetcher Transition Logic

**Change** (`market-data-fetcher.ts` lines 198-238):
```typescript
private checkAndTransitionBackfill(): void {
  // ... check completion ...
  
  if (allBackfillComplete && this.symbols.length > 0) {
    // Explicitly transition all anchors to ARMED
    for (const symbol of this.symbols) {
      for (const timeframe of this.timeframes) {
        anchorMgr.transitionToArmed(symbol, tf_seconds);
      }
    }
    // Then disable REST
    this.disableRestFetching();
  }
}
```

**Result**:
- Ensures atomic transition: BACKFILL → ARMED for all anchors
- Then REST polling stops
- No race conditions where some anchors in BACKFILL, others in ARMED

---

## Expected Behavior After Fixes

### Timeline (First 5 Minutes)
1. **0-30s (BACKFILL)**: 
   - REST fetches 100-200 historical candles per symbol
   - All data accepted (no stale threshold)
   - WS blocked: "Only REST allowed in BACKFILL"

2. **30s (TRANSITION)**:
   - All anchors transition to ARMED
   - REST polling disabled permanently
   - Stale data threshold de-activated

3. **30-120s (ARMED Probation)**:
   - WS candles arrive at 1m intervals
   - REST tail-backfill candles continue (last 10-50 per symbol)
   - Both streams mixed, both accepted
   - emit-lag monitored (must be < 2s for 3+ consecutive candles)

4. **120-150s (LIVE)**:
   - Once 3 good WS candles received
   - Anchors transition to LIVE
   - Stale data threshold activated (> 1h rejected)
   - Confidence unfrozen, trading can begin

5. **150s+ (LIVE)**:
   - Only WS data accepted
   - Stale data rejected
   - Confidence rises from 0

### Log Signatures to Expect
```
[MarketDataFetcher] BACKFILL: Fetched BTC/USDT (200 candles)
[TimeAnchor] ARMED: BTC/USDT:60 transitioned
[MarketDataFetcher] ✅ REST polling disabled — all anchors ARMED
[TimeAnchor] ARMED probation=1/3 emit-lag=512ms
[TimeAnchor] ARMED probation=2/3 emit-lag=634ms
[TimeAnchor] ARMED probation=3/3 emit-lag=751ms
[TimeAnchor] ✅ BTC/USDT:60 → LIVE
[IntegrityGate] ✅ World Tick: BTC/USDT 60s mode=LIVE
[PortfolioAgent] Confidence=42 mode=LIVE
```

---

## Testing Checklist

- [ ] Run `pnpm run server` and monitor logs
- [ ] Verify BACKFILL accepts all historical data (no rejections)
- [ ] Verify REST stops after ~30s ("REST polling disabled")
- [ ] Verify ARMED transition happens for all 90 anchors
- [ ] Verify mixed REST tail + WS probation flow (30-120s)
- [ ] Verify LIVE transition after 3 good WS candles (120-150s)
- [ ] Verify confidence rises from 0 in LIVE mode
- [ ] Verify stale data rejection only in LIVE (not ARMED/BACKFILL)
- [ ] Verify no crashes when candles rejected
- [ ] Monitor emit-lag: BACKFILL (hours), ARMED (< 2s), LIVE (< 100ms)

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `integrity-gate.ts` | 218-233 | Phase-aware stale data threshold (LIVE only) |
| `time-anchor.ts` | 243-263 | ARMED mode allows both REST + WS |
| `trading-engine.ts` | 1513-1519 | Safe fallback (no storage after integrity fail) |
| `market-data-fetcher.ts` | 198-238 | Explicit ARMED transition before REST disable |

**Compilation Status**: ✅ All 4 files compile cleanly (0 errors)

