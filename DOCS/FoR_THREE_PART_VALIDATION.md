# FoR (Failure of Reversion) Three-Part Validation Framework

## Problem Solved

**Original issue:** Without time limits, how do we prove FoR actually occurred?
- Scout stays open indefinitely if profitable
- But profitability alone doesn't prove mean reversion failed
- Could be: luck, normal pullback, or market noise

**Solution:** FoR only proven when **3 independent criteria align** (P + F + S)

---

## The Three Criteria

### 1. **Scout Profitability (P)** ✓
**What it measures:** Initial signal was correct
- Scout PnL > 0
- Price moved in our predicted direction
- Proves entry wasn't completely wrong

**Why it matters:** 
- Without P: Could be mean reversion still working normally
- With P: Means market initially agreed with our signal

### 2. **Force-Decay Metrics Fire (F)** ✓
**What it measures:** Market's elasticity is dying
- RTM engine detects: `forPermissionSlip = true`
  - Decay Strength > 0.55 (Reversion Quality degrading)
  - Depth Compression > 0.45 (Pullback shallowing)
  - Time Compression > 0.45 (Pullback speeding up)
  - Volatility Paradox = true (Price ↑, Vol ↓)

**Why it matters:**
- Without F: Could be momentum but not proof mean reversion broke
- With F: Physics prove the mean-reversion force is exhausted

### 3. **Structural Confirmation (S)** ✓
**What it measures:** Price staying in momentum direction, not reverting
- Current price > Entry × 1.001 (for BUY)
- Current price < Entry × 0.999 (for SELL)
- Price has NOT returned toward entry

**Why it matters:**
- Without S: RTM fired but market just mean-reverted anyway
- With S: Price staying away from mean confirms force decay is real

---

## FoR Proof Logic

```
┌─────────────────────────────────────────┐
│ Scout Entry at Bar 0                    │
└─────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │  Bars 0-5            │
         │ Physics Exits Check  │
         │ AGREEMENT_FAIL?      │
         │ REGIME_CHANGE?       │
         │ RESPONSE_DECAY?      │
         └──────────────────────┘
              ↓       ↓       ↓
         Exit?      Exit?    Exit?
             ║        ║        ║
         NO  ║ (continues)    ║
             ↓                ↓
         ┌────────────────────────────┐
         │  Bar 5 Profitability Check │
         └────────────────────────────┘
              ↓               ↓
         Profitable?    Unprofitable?
             YES            NO
              ↓              ↓
         Continue        EXIT TIMEOUT
         Tracking        (failed entry)
              ↓
      ┌──────────────────────────────────────┐
      │  Bars 6+: Continuous Tracking         │
      │  Check: P + F + S on every bar        │
      └──────────────────────────────────────┘
           ↓          ↓          ↓
      P Check    F Check    S Check
          
      P = Scout still profitable?
      F = RTM forPermissionSlip fires?
      S = Price still away from entry?
          
           ↓          ↓          ↓
    ┌────────────────────────────────────┐
    │  All 3 criteria met? (P∩F∩S)        │
    └────────────────────────────────────┘
           YES ↓                ↓ NO
              ↓                  ↓
    ┌──────────────────┐    Continue
    │ FoR PROVEN ✅     │    Tracking
    │ Deploy Convexity │    
    └──────────────────┘    
             ↓
    Hold position indefinitely
    (Convexity replaces scout)

Exit Triggers During Tracking:
├─ P breaks: Scout goes negative → EXIT PROFIT_LOSS
├─ REGIME_CHANGE fires → EXIT REGIME_CHANGE
└─ Convexity deploys → Scout stops tracking
```

---

## Exit Reasons During FoR Tracking

| Exit Reason | When | Why | Implication |
|---|---|---|---|
| **PROFIT_LOSS** | Scout PnL ≤ 0 | P criterion broke | Mean reversion actually worked |
| **REGIME_CHANGE** | Structural shift detected | Market structure changed | Thesis invalidated by larger forces |
| **AGREEMENT_FAIL** | Bars 3-4 physics fail | Early physics signals failed | Entry signal was too weak |
| **RESPONSE_DECAY** | R metric collapses | Response permanently weak | No momentum follow-through |
| **CONVEX_DEPLOYED** | P+F+S all met | FoR proven, Convexity takes over | Scout succeeded, Convexity continues |

---

## Example Scenarios

### Scenario 1: FoR Proven (P+F+S) ✅
```
Bar 0:  Scout BUY @ 100
Bar 5:  Price 101, P✓ profitable
Bar 7:  RTM fires, F✓ decay detected
Bar 8:  Price 102, S✓ still away from mean
        → P+F+S ALL MET
        → FoR PROVEN
        → Deploy Convexity
```

### Scenario 2: Mean Reversion Wins (P breaks) ❌
```
Bar 0:  Scout BUY @ 100
Bar 5:  Price 101, P✓ profitable
Bar 10: Price 99, P✗ back below entry
        → Exit PROFIT_LOSS
        → Convexity NOT deployed
        → Mean reversion was still valid
```

### Scenario 3: False Signal (F never fires) ❌
```
Bar 0:  Scout BUY @ 100
Bar 5:  Price 101, P✓ profitable
Bar 10: Price 102, P✓ still profitable
Bar 20: Price 103, P✓ still profitable
        But RTM F✗ never fires
        → Keep waiting indefinitely OR
        → Exit on REGIME_CHANGE or other
        → FoR never proven
```

### Scenario 4: Early Physics Fail (AGREEMENT_FAIL) ❌
```
Bar 0:  Scout BUY @ 100
Bar 3:  Coherence < 0.45
        → Exit AGREEMENT_FAIL
        → Entry signal too weak
        → Market disagreed immediately
```

---

## Why This Works

**Pure Physics Validation:**
1. ✅ No arbitrary time cutoffs
2. ✅ Multiple independent signals must align (reduces false positives)
3. ✅ Each criterion tests different aspect of thesis
4. ✅ FoR proven only when market structure fundamentally changed

**P (Profitability)** answers: "Was my direction right?"
**F (Force-Decay)** answers: "Is mean reversion elasticity dead?"
**S (Structure)** answers: "Is price confirming this change?"

Only when ALL three answer "YES" → **FoR PROVEN** → Deploy Convexity

---

## Key Parameters

```
Scout Entry: Always (VFMD signal)
Scout Exit Window: 
  - Bars 0-5: Physics checks (AGREEMENT_FAIL, REGIME_CHANGE, RESPONSE_DECAY)
  - Bar 5: Profitability checkpoint (exit losers, keep winners indefinitely)
  - Bar 6+: FoR tracking (no time limit, only physics)

FoR Criteria:
  - P: PnL > 0
  - F: RTM forPermissionSlip (decay > 0.55 OR compression > 0.45 OR paradox)
  - S: Price > Entry × 1.001 (BUY) or < Entry × 0.999 (SELL)

Result: P + F + S = FoR PROVEN → Deploy Convexity
```

---

## Next: Hypothesis Testing

With this framework, you can now test:

1. **How often does FoR prove?** (P+F+S rate)
2. **How long until FoR proves?** (Bar timing)
3. **Does S criterion really matter?** (Test without S)
4. **Convexity performance** (When FoR proves vs when it doesn't)

