# 🔒 LIVE MODE ARCHITECTURE
## Hard Boundary Between Backfill and Live Trading

**Last Updated**: December 20, 2025  
**Status**: Implementation Complete + Ready for Testing

---

## 📋 Executive Summary

Your system **cannot flip to TRUE LIVE** while continuously injecting historical candles.

This document defines a **5-phase state machine** that:
1. ✅ Separates BACKFILL (REST) from LIVE (WS) permanently
2. ✅ Enforces monotonic time per (symbol, timeframe)
3. ✅ Transitions through BACKFILL → ARMED → LIVE
4. ✅ Freezes confidence at 0 until LIVE is achieved
5. ✅ Refuses REST candles during LIVE mode

---

## 🎯 The Problem (Why MIXED Mode Won't End)

### Root Cause: Continuous REST Injection

Your `MarketDataFetcher` runs every 30 seconds and:

```typescript
// ❌ WRONG — This happens FOREVER
setInterval(() => {
  fetchAllData(); // Fetches historical candles AGAIN
}, 30 * 1000);
```

Results:
- REST fetches 200 candles for 1m → injects candles from Dec 19
- WS delivers Dec 20 candles
- Time regression: Dec 19 < Dec 20 → **tick suppressed**
- Confidence stays 0
- Mode stays MIXED

### Why This Breaks LIVE Mode

| Phase | What Should Happen | What Actually Happens |
|-------|-------------------|----------------------|
| **BACKFILL** | REST fetches historical once | REST fetches every 30s forever |
| **ARMED** | WS collects 3-5 clean candles | REST keeps injecting old data |
| **LIVE** | WS only | REST pollutes the stream |

---

## 🔵 Phase 1 — Introduce TimeAnchor (Done)

### What Is TimeAnchor?

A state machine per (symbol, timeframe) that enforces boundaries:

```typescript
interface TimeAnchor {
  symbol: string;
  timeframe: number;
  
  // Boundaries
  lastHistoricalTs: number;  // Last allowed REST timestamp
  liveAnchorTs: number | null; // First allowed WS timestamp
  
  // State machine: BACKFILL → ARMED → LIVE
  mode: 'BACKFILL' | 'ARMED' | 'LIVE';
  
  // ARMED probation tracking
  consecutiveWsCandles: number;
  lastWsEmitLag: number;
}
```

### How It Works

**BACKFILL Mode:**
```
REST:   allowed ✅
        only if: candle.ts ≤ lastHistoricalTs
        
WS:     forbidden ❌
        rejected with reason: "Only REST in BACKFILL"
```

**ARMED Mode:**
```
REST:   forbidden ❌
        rejected with reason: "Only WS in ARMED probation"
        
WS:     allowed ✅
        collected for 3-5 consecutive candles
        emit-lag must be < 2s each time
```

**LIVE Mode:**
```
REST:   STRICTLY FORBIDDEN ❌
        error: "REST not allowed in LIVE mode"
        triggers alert
        
WS:     allowed ✅
        only if: candle.ts ≥ liveAnchorTs
        monotonic time strictly enforced
```

### Key Files

| File | Purpose | Status |
|------|---------|--------|
| `time-anchor.ts` | TimeAnchor state machine | ✅ Created |
| `integrity-gate.ts` | Validates candles against anchor | ✅ Updated |
| `market-data-fetcher.ts` | Respects backfill boundaries | ✅ Updated |

---

## 🟡 Phase 2 — Hard Stop REST at Backfill Completion

### What Changed in MarketDataFetcher

**Before:**
```typescript
// ❌ Runs forever
setInterval(() => {
  fetchAllData(); // Fetches REST candles every 30s
}, 30_000);
```

**After:**
```typescript
// ✅ Runs until backfill complete, then STOPS
setInterval(() => {
  fetchAllData(); // Fetches REST
  checkAndTransitionBackfill(); // Checks if done
  if (allComplete) {
    disableRestFetching(); // STOPS polling
  }
}, 30_000);
```

### How To Track Backfill Per Symbol+Timeframe

```typescript
// In MarketDataFetcher
private backfillComplete = new Set<string>(); // "symbol:timeframe"

// After first REST fetch succeeds
fetchSymbolData(symbol) {
  const results = await Promise.all(
    this.timeframes.map(tf => fetchOHLCV(symbol, tf))
  );
  
  // Mark complete
  this.timeframes.forEach(tf => {
    const key = `${symbol}:${tf}`;
    const anchor = anchorMgr.getOrCreateAnchor(symbol, tfSeconds);
    anchorMgr.transitionToArmed(symbol, tfSeconds);
    this.backfillComplete.add(key);
  });
}
```

### Behavior

1. **First fetch cycle (0-30s)**:
   - REST fetches all symbols × all timeframes
   - Each (symbol, timeframe) → `transitionToArmed()`
   - Log: `[TimeAnchor] SOL/USDT:3600 transitioned to ARMED`

2. **Subsequent cycles (30-60s, 60-90s, etc.)**:
   - If all anchors are ARMED/LIVE: **stop polling**
   - REST fetcher halts gracefully
   - Log: `[MarketDataFetcher] ✅ REST polling disabled — LIVE mode (WS only)`

3. **From this point forward**:
   - Only WS feeds data
   - REST is never called again
   - Time is clean and monotonic

---

## 🟢 Phase 3 — ARMED Probation (3-5 Clean WS Candles)

### What Happens in ARMED Mode

Once all anchors transition to ARMED:

1. **Ignore REST**: Any REST tick is rejected
2. **Count WS**: Each good WS candle increments counter
3. **Check emit-lag**: If emit-lag > 2s, reset counter to 0
4. **Promote to LIVE**: After 3 consecutive good candles

### Code

```typescript
recordWsCandle(symbol, timeframe, worldTime, emitLag) {
  const anchor = getAnchor(symbol, timeframe);
  
  if (anchor.mode !== 'ARMED') return;
  
  // Check emit-lag constraint
  if (emitLag > 2000) {
    anchor.consecutiveWsCandles = 0;
    console.warn(`ARMED probation reset (emit-lag ${emitLag}ms)`);
    return;
  }
  
  anchor.consecutiveWsCandles++;
  
  // Promote after 3 good candles
  if (anchor.consecutiveWsCandles >= 3) {
    transitionToLive(symbol, timeframe);
  }
}
```

### What This Looks Like in Logs

```
[TimeAnchor] SOL/USDT:3600 transitioned to ARMED (waiting for 3-5 WS candles with emit-lag < 2s)
[IntegrityGate] World Tick SOL/USDT 3600s (world=2025-12-19T18:32:00Z, emit-lag=812ms) mode=ARMED source=WS
[IntegrityGate] World Tick SOL/USDT 3600s (world=2025-12-19T18:33:00Z, emit-lag=634ms) mode=ARMED source=WS
[IntegrityGate] World Tick SOL/USDT 3600s (world=2025-12-19T18:34:00Z, emit-lag=751ms) mode=ARMED source=WS
[TimeAnchor] ✅ SOL/USDT:3600 → LIVE (anchor=2025-12-19T18:34:00Z, emit-lag=751ms)
```

---

## 🔴 Phase 4 — LIVE Mode (Enforce Purity)

### What LIVE Mode Means

Once `mode === 'LIVE'`:

1. **REST is forbidden**: Any REST tick fails immediately
   ```
   ⛔ REST not allowed in LIVE mode
   ```

2. **Time is frozen**: `liveAnchorTs` marks the anchor point
   ```
   if (worldTime < liveAnchorTs) reject();
   if (worldTime < lastWorldTime) reject();
   ```

3. **emit-lag is monitored**: If > 2s, downgrade to ARMED
   ```
   if (emitLag > MAX_LIVE_LAG) downgradeToArmed("emit-lag exceeded");
   ```

4. **Gaps trigger downgrade**: No healing with historical data
   ```
   if (gap detected in LIVE window) downgradeToArmed("gap detected");
   ```

### LIVE Mode Decision Tree

```
For each incoming candle:

1. Is this REST?
   YES → ⛔ REJECT "REST not allowed in LIVE"
   NO  → continue

2. Is worldTime < liveAnchorTs?
   YES → ⛔ REJECT "Candle before anchor"
   NO  → continue

3. Is worldTime < lastWorldTime?
   YES → ⛔ REJECT "Time regression"
   NO  → continue

4. Is emitLag > 2s?
   YES → DOWNGRADE to ARMED
   NO  → ✅ ACCEPT

5. Is gap detected?
   YES → DOWNGRADE to ARMED
   NO  → ✅ EMIT World Tick with mode=LIVE
```

### What This Looks Like in Logs

```
[TimeAnchor] ✅ BTC/USDT:60 → LIVE (anchor=2025-12-19T18:35:00Z, emit-lag=512ms)
[IntegrityGate] ✅ World Tick BTC/USDT 60s (world=2025-12-19T18:36:00Z, emit-lag=489ms) mode=LIVE source=WS
[IntegrityGate] ✅ World Tick BTC/USDT 60s (world=2025-12-19T18:37:00Z, emit-lag=601ms) mode=LIVE source=WS
[IntegrityGate] ✅ World Tick BTC/USDT 60s (world=2025-12-19T18:38:00Z, emit-lag=543ms) mode=LIVE source=WS
```

---

## 🟣 Phase 5 — Confidence Unfreezing

### Current Behavior

Confidence is **locked at 0** because mode ≠ LIVE:

```typescript
if (mode !== 'LIVE' || !microstructure.ready || gaps > 0) {
  confidence = 0; // ❌ Frozen
}
```

### After LIVE Mode Achieved

Confidence can rise naturally:

```typescript
if (mode === 'LIVE' && microstructure.ready && gaps === 0) {
  confidence = calculateConfidence(...); // ✅ Can be > 0
}
```

### When This Triggers

Only **after** all conditions met:
- ✅ mode == LIVE
- ✅ microstructure.spread, depth, imbalance populated
- ✅ zero gaps in LIVE window
- ✅ monotonic time for last 10+ candles
- ✅ emit-lag consistently < 2s

---

## 🛠️ Implementation Checklist

### Core Files

- [x] `time-anchor.ts` — TimeAnchor state machine created
  - [x] `BACKFILL` mode logic
  - [x] `ARMED` probation tracking
  - [x] `LIVE` enforcement with frozen anchor
  - [x] Transitions between modes

- [x] `integrity-gate.ts` — TimeAnchor validation integrated
  - [x] `validateCandle()` checks anchor constraints
  - [x] REST candles rejected if not BACKFILL
  - [x] WS candles rejected if not (ARMED or LIVE)
  - [x] Time regression detection in LIVE

- [x] `market-data-fetcher.ts` — REST fetching respects backfill
  - [x] `backfillComplete` tracking per (symbol, timeframe)
  - [x] `transitionToArmed()` called after first fetch
  - [x] `disableRestFetching()` halts polling
  - [x] Probation counter tracks consecutive good WS candles

### Monitoring

- [ ] Dashboard shows anchor state for each (symbol, timeframe)
  - [ ] Mode (BACKFILL | ARMED | LIVE)
  - [ ] Time since transition
  - [ ] consecutive WS candles (for ARMED)
  - [ ] emit-lag (for ARMED and LIVE)

- [ ] Alerts for downgrade events
  - [ ] LIVE → ARMED (gap detected)
  - [ ] LIVE → ARMED (emit-lag exceeded)
  - [ ] ARMED reset (emit-lag spike)

- [ ] Log verification
  - [ ] `[TimeAnchor]` messages
  - [ ] `[IntegrityGate]` mode labels
  - [ ] No time regression errors

---

## 🚀 Deployment Steps

### Step 1: Verify Code Compiles

```bash
pnpm run build
```

Expected output:
```
✅ Compilation successful (0 errors)
```

### Step 2: Start Server (Test Mode)

```bash
pnpm run server
```

Expected logs (first 30-90 seconds):
```
[MarketDataFetcher] Fetch completed: 15/15 symbols
[TimeAnchor] BTC/USDT:60 transitioned to ARMED
[TimeAnchor] ETH/USDT:60 transitioned to ARMED
...
[TimeAnchor] SOL/USDT:86400 transitioned to ARMED
[MarketDataFetcher] 🔒 Backfill complete for all symbols → transitioning to WS-only mode
[MarketDataFetcher] ✅ REST polling disabled — LIVE mode (WS only)
```

### Step 3: Monitor LIVE Transition

After REST polling stops, watch for:

```
[TimeAnchor] ✅ BTC/USDT:60 → LIVE (anchor=2025-12-19T18:35:00Z)
[TimeAnchor] ✅ BTC/USDT:300 → LIVE (anchor=2025-12-19T18:35:00Z)
[TimeAnchor] ✅ ETH/USDT:60 → LIVE (anchor=2025-12-19T18:35:00Z)
```

Once you see multiple `→ LIVE` messages, system is in true LIVE mode.

### Step 4: Verify Confidence Rise

In PortfolioAgent logs, confidence should no longer be frozen at 0:

```
❌ Before:
[PortfolioAgent] Confidence=0 mode=MIXED

✅ After:
[PortfolioAgent] Confidence=42 mode=LIVE
```

---

## 🧪 Testing Scenarios

### Scenario 1: Normal LIVE Activation

**Setup**: Server starts fresh with no backfill cache

**Expected Flow**:
1. REST fetches historical candles (30s)
2. All anchors transition to ARMED
3. REST polling stops
4. WS collects 3-5 clean candles (30-150s)
5. Anchors transition to LIVE
6. Confidence rises from 0

**Success Criteria**:
- `[MarketDataFetcher] ✅ REST polling disabled` appears in logs
- `[TimeAnchor] ✅ ... → LIVE` messages appear
- Confidence > 0 in portfolio agent

### Scenario 2: Gap During LIVE

**Setup**: System in LIVE mode, then gap occurs (feed break)

**Expected Flow**:
1. Gap detected by IntegrityGate
2. `[IntegrityGate] 📊 Detected 1 gaps for BTC/USDT:60`
3. Mode detection checks if gap is in LIVE window
4. If yes: `setBackfillComplete(false)` → anchors downgrade to ARMED
5. `[TimeAnchor] 🟡 BTC/USDT:60 downgraded to ARMED (reason: gap detected)`
6. Confidence forced back to 0
7. Once gap heals and 3 clean candles arrive: back to LIVE

**Success Criteria**:
- No time regression errors
- Clean downgrade/upgrade cycle
- Confidence returns to > 0 when LIVE restored

### Scenario 3: REST Injection Attempt

**Setup**: System in LIVE mode, rogue REST call attempts to inject

**Expected Flow**:
1. REST adapter tries to emit historical candle
2. IntegrityGate validates against anchor
3. Validation fails: `⛔ REST not allowed in LIVE mode`
4. Candle rejected, stored in `report.rejected`
5. No tick emitted

**Success Criteria**:
- Log shows rejection reason
- No World Tick for rejected candle
- Mode stays LIVE
- Time integrity preserved

---

## 📊 Diagnostics Commands

### Check All Anchors

```typescript
const anchorMgr = getTimeAnchorManager();
console.log(anchorMgr.diagnostics());
```

Output:
```
✅ BTC/USDT:60s
  mode=LIVE (45s)
  historical_until=2025-12-19T18:30:00.000Z
  live_since=2025-12-19T18:35:00.000Z
  rest_fetches=1

🟡 ETH/USDT:60s
  mode=ARMED (12s)
  historical_until=2025-12-19T18:32:00.000Z
  live_since=not_set
  probation=2/3 emit-lag=612ms
  rest_fetches=1
```

### Monitor One Symbol+Timeframe

```typescript
const anchor = anchorMgr.getAnchor('BTC/USDT', 60);
console.log(JSON.stringify(anchor, null, 2));
```

Output:
```json
{
  "symbol": "BTC/USDT",
  "timeframe": 60,
  "lastHistoricalTs": 1671468600000,
  "liveAnchorTs": 1671468900000,
  "mode": "LIVE",
  "modeChangedAt": 1671468920000,
  "consecutiveWsCandles": 5,
  "lastWsEmitLag": 543,
  "lastWorldTime": 1671468900000,
  "lastWsTime": 1671468900000,
  "restFetchCount": 1
}
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Calling transitionToArmed() Multiple Times

```typescript
// WRONG
if (backfillComplete) {
  anchorMgr.transitionToArmed(symbol, tf);
  anchorMgr.transitionToArmed(symbol, tf); // Called twice
}
```

**Fix**: Only call once, after first successful REST fetch.

### ❌ Mistake 2: Not Checking Mode Before Accepting REST

```typescript
// WRONG
if (source === 'REST') {
  store(candle); // Accepts REST even in LIVE
}

// RIGHT
const validation = anchor.validateCandle(symbol, tf, ts, source);
if (!validation.allowed) reject();
store(candle);
```

### ❌ Mistake 3: Mixing Historical + LIVE Timestamps

```typescript
// WRONG
const liveAnchor = Date.now(); // Now
const historicalCandle = fetch(); // 3 days ago
// Both go through same pipeline

// RIGHT
const liveAnchor = now().floorToTimeframe();
historicalCandle → rejected (ts < liveAnchor)
liveCandle → accepted (ts >= liveAnchor)
```

### ❌ Mistake 4: Allowing REST During ARMED

```typescript
// WRONG
if (mode === 'ARMED') {
  if (source === 'REST') {
    store(candle); // Allows REST
  }
}

// RIGHT
if (mode === 'ARMED') {
  if (source === 'REST') {
    reject("Only WS allowed in ARMED probation");
  }
}
```

---

## 🔮 What Happens After LIVE

Once in LIVE mode **and holding**:

1. **Every new WS tick**:
   - Validated against anchor (time, source, emit-lag)
   - Stored in database
   - Emitted as World Tick with `mode=LIVE`
   - Aggregated into signals

2. **Confidence rising**:
   - No longer frozen at 0
   - Driven by technical + microstructure + order flow
   - Can reach 100 for strong signals

3. **Trading decisions**:
   - Portfolio agent makes trades on LIVE signals
   - Risk limits enforced
   - Outcomes recorded

4. **Downgrade scenarios**:
   - Gap detected → ARMED
   - emit-lag spike → ARMED
   - Time regression → tick rejected

---

## 📚 Files Modified

| File | Changes |
|------|---------|
| `time-anchor.ts` | NEW: 300 lines, state machine |
| `integrity-gate.ts` | +50 lines, anchor validation |
| `market-data-fetcher.ts` | +40 lines, backfill tracking + REST disable |
| `trading-engine.ts` | (unchanged) |
| `mode-detector.ts` | (unchanged) |

Total new code: ~390 lines.

---

## 📞 Monitoring & Support

### Key Metrics to Track

1. **Anchor Mode Distribution**:
   - % of anchors in BACKFILL
   - % of anchors in ARMED
   - % of anchors in LIVE

2. **Emission Patterns**:
   - REST ticks/sec (should drop to 0)
   - WS ticks/sec (should stabilize)
   - Tick rejection rate (should drop to 0)

3. **Confidence**:
   - Min/max/avg confidence across symbols
   - Time until confidence > 0
   - Time until confidence > 50

### Alert Thresholds

- 🔴 Any REST candle during LIVE → immediate alert
- 🔴 Time regression in any anchor → immediate alert
- 🟡 Anchor stuck in ARMED > 5 min → warning
- 🟡 emit-lag > 2s for > 3 consecutive candles → warning

---

## ✅ Summary

This architecture enforces:

1. **Temporal purity**: No mixing of historical + live
2. **Single source of truth**: LIVE epoch per system
3. **Conservative defaults**: Confidence starts at 0
4. **Graceful degradation**: Downgrades on anomaly
5. **Clean restart**: REST stops after backfill

Result: **True LIVE mode** (not false MIXED).
