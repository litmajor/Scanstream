# 🔄 OPERATION MODE — Quick Reference for Traders

## At a Glance

Your system has three modes. Know which one you're in.

| Mode | Meaning | Trading | Confidence | Log | 
|------|---------|---------|------------|-----|
| **REPLAY** | Historical data (REST API backfill) | ❌ No | 0% | `mode=REPLAY` |
| **MIXED** | REST + WebSocket (transition) | ⚠️ Limited | 50% cap | `mode=MIXED` |
| **LIVE** | Pure WebSocket, ready | ✅ Yes | Unlimited | `mode=LIVE` |

---

## Logs to Watch

### Starting Up

```
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-10T14:30:00.000Z, emit-lag=456789ms) mode=REPLAY
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-10T14:31:00.000Z, emit-lag=455789ms) mode=REPLAY
```

You're loading old data. **Not trading yet.**

### Backfilling

```
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T16:00:00.000Z, emit-lag=75000ms) mode=MIXED
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T16:01:00.000Z, emit-lag=73000ms) mode=MIXED
```

Catching up with WebSocket. **Trading limited to 50% confidence.**

### Going Live

```
[IntegrityGate] ✅ World Tick: ETH/USDT 60s (world=2025-12-19T17:15:00.000Z, emit-lag=800ms) mode=LIVE
[IntegrityGate] ✅ World Tick: BTC/USDT 60s (world=2025-12-19T17:15:00.000Z, emit-lag=750ms) mode=LIVE
```

**You're live.** Ready for full trading.

---

## Quick Status Check

### Option 1: Watch Logs
```bash
tail -f logs/server-*.log | grep "World Tick"
```

### Option 2: API Query
```bash
curl http://localhost:5000/api/diagnostics/mode | jq '.data | {mode, wsPercentage, avgEmitLag}'
```

Should show:
```json
{
  "mode": "LIVE",
  "wsPercentage": 95,
  "avgEmitLag": 850
}
```

### Option 3: Full Diagnostics
```bash
curl http://localhost:5000/api/diagnostics/system | jq '.data'
```

---

## When You're LIVE

### Confirm These Signs

✅ `mode=LIVE` in logs
✅ `emit-lag < 1-2 seconds`
✅ `wsPercentage > 80%`
✅ `backfillComplete: true`
✅ `microstructureActive: true`

### You Can Now
- Trade with full confidence
- Use all agents
- Scale position sizes
- Trust the system

---

## When You're MIXED

### What's Happening
- Still loading historical data
- WebSocket arriving but not dominant
- Memory not fully filled

### What To Do
- Monitor progress
- Run agents in limited mode
- Don't scale positions
- Check logs for transition to LIVE

---

## When You're REPLAY

### What's Happening
- System just started
- Loading data from hours/days ago
- No WebSocket yet

### What To Do
- Let it load
- Don't trade
- Monitor `[ModeDetector]` logs
- Wait for MIXED or LIVE

---

## Position Sizing by Mode

Use this multiplier:

```
REPLAY: 0%   (don't trade)
MIXED:  30%  (light trading)
LIVE:   100% (full trading)
```

Example:
```
basePositionSize = $1,000
REPLAY: $0      (skip)
MIXED:  $300    (test)
LIVE:   $1,000  (go)
```

---

## Troubleshooting

### "Stuck in MIXED"
```bash
curl http://localhost:5000/api/diagnostics/mode | jq '.data'
```

Look for:
- `backfillComplete: false` → REST API still loading
- `wsPercentage: low` → WebSocket not connected
- `memoryFillLevel: low` → OrderFlow not ready

### "Mode not updating"
Check server logs:
```bash
tail -f logs/server-*.log | grep ModeDetector
```

### "Still REPLAY after startup"
This is normal if backfilling from old data. Can take minutes.

---

## The Safety Guarantee

Your system will **never** lie about its state:

- ❌ Won't trade in REPLAY
- ❌ Won't over-trade in MIXED
- ✅ Will trade fully in LIVE

This prevents:
- Trading on 3-day-old data
- Over-leveraging during startup
- False confidence signals

---

## Key Numbers

| Threshold | Meaning |
|-----------|---------|
| emit-lag > 60s | REPLAY (very old data) |
| emit-lag < 2s | LIVE (recent) |
| WS% > 80% | High WebSocket ratio |
| Memory > 80% | OrderFlow ready |
| Confidence > 30% | Tradeable (mode permitting) |

---

## Common Scenarios

### Scenario 1: Clean Startup
```
time=00:00  mode=REPLAY (loading 24h of data)
time=02:15  mode=MIXED  (WS catching up)
time=03:10  mode=LIVE   (ready to trade)
```

### Scenario 2: Reconnection
```
time=10:00  mode=LIVE   (trading)
time=10:45  connection lost
time=10:46  mode=MIXED  (syncing)
time=10:50  mode=LIVE   (back online)
```

### Scenario 3: Backfill Large Gap
```
time=14:00  mode=LIVE   (trading normally)
time=14:15  missing data detected
time=14:16  mode=MIXED  (backfilling gap)
time=14:25  mode=LIVE   (resume trading)
```

---

## Remember

This is **not** a limitation. It's **professional-grade** behavior.

Most systems pretend to be live when they're not.

Yours knows better.

**That's why you can trust it.**
