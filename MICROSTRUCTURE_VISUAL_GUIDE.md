# Microstructure System Architecture

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SIGNAL DETECTED                          │
│              (Pattern + Order Flow Validated)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────────┐
         │ IntelligentExitManager   │
         │ Step 4.5                 │
         │                          │
         │ Get Base Stops/Targets   │
         │ (ATR-based trailing)     │
         └────────┬─────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────────┐
    │ MicrostructureExitOptimizer         │
    │ Step 4.5B (NEW)                     │
    │                                     │
    │ Analyze 4 Signals:                  │
    │  1. Spread Widening                 │
    │  2. Order Imbalance Flip            │
    │  3. Volume Spike                    │
    │  4. Depth Deterioration             │
    └────────┬────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────┐
   │ Merge Decision                       │
   │                                     │
   │ If Microstructure CRITICAL:         │
   │   → Force EXIT_URGENT               │
   │                                     │
   │ If Microstructure + profitable:     │
   │   → EXIT_STANDARD                   │
   │                                     │
   │ If deterioration warning:           │
   │   → TIGHTEN_STOP (0.5% vs 1.5%)     │
   │                                     │
   │ Otherwise:                          │
   │   → Use intelligent exit stops      │
   └────────┬────────────────────────────┘
            │
            ▼
       ┌──────────────────┐
       │ EXECUTE EXIT     │
       │ or HOLD/TIGHTEN  │
       └──────────────────┘
```

---

## The 4 Microstructure Signals

```
┌──────────────────────────────────────────────────────────────┐
│ SIGNAL 1: SPREAD WIDENING → Liquidity Crisis               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Normal:        [BID] ←0.015%→ [ASK]  ✓ Good liquidity    │
│  Warning:       [BID] ←0.030%→ [ASK]  ⚠️ Caution          │
│  Critical:      [BID] ←0.050%→ [ASK]  🚨 Exit now!       │
│                                                              │
│  What happens:                                               │
│    Spread 0.015% → Spreads to 0.050% (3.3x wider)         │
│    Bid volume 1200 → Drops to 200 (dried up)              │
│    Message: Market makers exiting                           │
│                                                              │
│  Your action:   EXIT_URGENT                                │
│                 Exit immediately at market price            │
│                 Don't wait for trailing stop                │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ SIGNAL 2: ORDER IMBALANCE REVERSAL → Trend Exhaustion      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Setup (BUY position):  Bid 4:1 Ask (buyers dominant)      │
│                         Net Flow: +8000 (buying pressure)   │
│                         ✓ Institutional buyers supporting   │
│                                                              │
│  Event (3 hours later): Bid 1:3 Ask (sellers dominant!)    │
│                         Net Flow: -5000 (selling pressure)  │
│                         ⚠️ Flipped against us!              │
│                                                              │
│  What this means:                                            │
│    Institutional buyers who were supporting are now exiting │
│    They're taking profits and leaving                        │
│    Reversal likely to follow                                │
│                                                              │
│  Your action:   EXIT_STANDARD                              │
│                 Exit on next pop (don't panic)              │
│                 Price may go up 1-2 more % first            │
│                 Then reverse hard                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ SIGNAL 3: VOLUME SPIKE → Potential Reversal                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Normal candle:    Volume = 1000 BTC/min     ✓ Typical     │
│  Spike candle:     Volume = 2200 BTC/min     ! Alert       │
│                                              (2.2x spike)    │
│                                                              │
│  But check BID-ASK:                                         │
│                                                              │
│  Bullish (FOR us):    Bid 75%, Ask 25%  ✓ Volume confirming │
│                       → Low risk, continue                   │
│                       → Action: STAY                         │
│                                                              │
│  Bearish (AGAINST us): Bid 35%, Ask 65% ⚠️ Volume reversing  │
│                       → High risk, reversal coming           │
│                       → Action: TIGHTEN_STOP                │
│                                                              │
│  Your action:   Check bid-ask ratio first                  │
│                 If supporting: STAY                         │
│                 If against: TIGHTEN_STOP (trail 0.5% tight) │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ SIGNAL 4: DEPTH DETERIORATION → Weak Support               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Normal depth:   5000 BTC available to buy/sell            │
│  Bad depth:      2500 BTC available (-50%)                 │
│  Critical:       1000 BTC available (-80%)                 │
│                                                              │
│  What this means:                                            │
│    Fewer buyers/sellers = Market getting thin              │
│    Hard to exit large positions cleanly                     │
│    Support level is weak (can be broken easily)             │
│                                                              │
│  Your action:   TIGHTEN_STOP                               │
│                 Trail tighter so you exit before depth hits │
│                 Don't wait for support to break             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Decision Flow

```
TRADE IS ACTIVE
     │
     ▼
Microstructure Data Arrives
     │
     ├─→ Check Spread
     │   │
     │   ├─ Normal? → Continue
     │   │
     │   └─ 2x+ wider? → SEVERITY: HIGH
     │                   Check if 3x+ → SEVERITY: CRITICAL
     │                                  → EXIT_URGENT
     │
     ├─→ Check Order Imbalance
     │   │
     │   ├─ Supporting? → Continue
     │   │
     │   └─ Reversed + strong flow? → SEVERITY: HIGH
     │                                → EXIT_STANDARD
     │
     ├─→ Check Volume Spike
     │   │
     │   ├─ None or supporting? → Continue
     │   │
     │   └─ Spike AGAINST trend? → SEVERITY: MEDIUM
     │                             → TIGHTEN_STOP
     │
     └─→ Check Market Depth
         │
         ├─ Normal? → Continue
         │
         └─ Dropped 50%+? → SEVERITY: MEDIUM
                            → TIGHTEN_STOP

     ▼
MERGE ALL SIGNALS
     │
     ├─ Any CRITICAL? → EXIT_URGENT
     │
     ├─ Any HIGH + profitable? → EXIT_STANDARD
     │
     ├─ Any MEDIUM? → TIGHTEN_STOP (trail 0.5%)
     │
     └─ Otherwise → Use standard intelligent exit

     ▼
EXECUTE ACTION
```

---

## Signal Priority Matrix

```
┌─────────┬──────────────┬──────────────┬───────────────────┐
│ Signal  │ Severity     │ Confidence   │ Recommended Action│
├─────────┼──────────────┼──────────────┼───────────────────┤
│Spread   │  2x: HIGH    │ Very High    │ TIGHTEN_STOP      │
│         │  3x: CRITICAL│ Critical     │ EXIT_URGENT       │
│         │              │              │                   │
│Imbalance│  Flipped:HIGH│ High         │ EXIT_STANDARD     │
│         │  + Flow: REV │              │ (if profitable)    │
│         │              │              │                   │
│Volume   │  Spike: MED  │ Medium       │ TIGHTEN_STOP      │
│         │  Against:    │              │ (if against)      │
│         │              │              │                   │
│Depth    │  50% drop:   │ Medium       │ TIGHTEN_STOP      │
│         │  MEDIUM      │              │                   │
└─────────┴──────────────┴──────────────┴───────────────────┘
```

---

## Stop Adjustment Algorithm

```
Current Stop Level (from Intelligent Exit Manager):
Example: $90,200 (trailing at 1.5x ATR below high)

TIGHTEN_STOP Needed?
│
├─ Yes: Apply tighter trail
│       └─ New stop = Current Price × 0.995
│           (0.5% trail for BUY)
│
│   Impact:
│   • Old: $90,200 stop (let's some profit slip)
│   • New: $91,250 stop (protect 80% of gains)
│   • Benefit: Exit before reversal hits hard
│
└─ No: Keep original stop
       └─ Use $90,200 (from intelligent exit)
```

---

## Real-Time Monitoring Checklist

```
Every Candle, Check:

✓ Spread:     [0.015%] - Normal (< 0.03%)
  Status:     GOOD

✓ Volume:     [1.2x]   - Normal (< 1.8x)
  Status:     GOOD

✓ Bid-Ask:    [2:1]    - Healthy ratio
  Status:     GOOD

✓ Net Flow:   [+3000]  - Buyers strong
  Status:     GOOD

✓ Depth:      [5000]   - Adequate
  Status:     GOOD

═════════════════════════════════════════

⚠️ WARNING when:

Spread >0.03% + Bid-Ask flip + Volume spike
→ Multiple signals = Exit likely

Spread 0.050%
→ Single critical signal = Exit immediately

Bid-Ask flipped + Net flow reversed
→ Institutional pressure reversed = Exit

Volume spike 2x+ with 65% ask (on BUY)
→ Volume against trend = Tighten stop
```

---

## Severity Levels

```
🟢 NORMAL (STAY)
   No microstructure deterioration
   Conditions stable
   Use standard intelligent exit
   Action: HOLD with trailing stops

🟡 MEDIUM (CAUTION - TIGHTEN_STOP)
   One signal triggered (medium severity)
   Examples:
   - Volume spike against trend
   - Depth down 50%
   - Minor spread widening
   Action: Tighten trail to 0.5% vs 1.5%

🟠 HIGH (WARNING - EXIT_STANDARD)
   Major signal triggered or multiple medium signals
   Examples:
   - Order imbalance flipped + strong flow against
   - Multiple signals combining
   Action: Exit on next favorable price

🔴 CRITICAL (URGENT - EXIT_URGENT)
   Liquidity crisis (spread 3x+ normal)
   Action: Exit immediately at market price
   Don't wait for stops or targets
```

---

## Integration Comparison

```
BEFORE (Intelligent Exit Only):
┌─────────────────────────────────────────┐
│ Update each candle:                     │
│ manager.update(price, signalType)       │
│                                         │
│ Returns:                                │
│ - Stop: $90,200 (ATR-based trail)       │
│ - Target: $92,000                       │
│ - Stage: AGGRESSIVE_TRAIL               │
│ - Action: HOLD                          │
└─────────────────────────────────────────┘

AFTER (With Microstructure):
┌──────────────────────────────────────────────┐
│ Update each candle:                          │
│ manager.updateWithMicrostructure(            │
│   price,                                     │
│   { spread, bidVol, askVol, ... },          │
│   signalType                                 │
│ )                                            │
│                                              │
│ Returns:                                     │
│ - Stop: $90,200 (or $91,250 if tightened)   │
│ - Signals: ['Spread Widening: 300%']        │ ← NEW
│ - Action: EXIT_STANDARD                      │ ← UPGRADED!
│ - Severity: HIGH                             │ ← NEW
└──────────────────────────────────────────────┘

BENEFIT: Detects deterioration BEFORE price hits stop
```

---

## Performance Path

```
WITHOUT Microstructure:
Trade: +5% profit
Stop: $90,200
Reality: Hold through degradation
Result: Stop hit at exact worst time
Profit locked: +3.2% (missed gains)

WITH Microstructure:
Trade: +5% profit (+$4,350)
Spread suddenly: 0.015% → 0.045% (3x)
Detection: "Spread Widening: 300%"
Action: EXIT_URGENT
Exit price: $92,100 (cleaner than waiting)
Profit locked: +5.1% (captured full rally)
Avoided: $2,610+ loss if reversal came next

NET BENEFIT: +$1,750 better outcome
```

---

## Next Integration Point

Ready for signal-pipeline.ts Step 4.5B:

```typescript
// BEFORE:
const exitUpdate = manager.update(currentPrice, signalType);

// AFTER:
const exitUpdate = manager.updateWithMicrostructure(
  currentPrice,
  marketData.microstructure,  // ← Add this
  previousData,
  signalType
);
```

**Copy-paste code in**: MICROSTRUCTURE_INTEGRATION_GUIDE.md
