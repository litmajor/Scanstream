# Logging Setup

All server logs are now written to both console and log files for easier debugging.

## Log File Location

Logs are written to: `logs/server-YYYY-MM-DD.log` (rotates daily)

## Viewing Logs

### Real-time log monitoring:

**On Linux/Mac:**
```bash
pnpm logs
# or
tail -f logs/server-*.log
```

**On Windows (PowerShell):**
```powershell
pnpm logs:win
# or
Get-Content -Path logs/server-*.log -Tail 50 -Wait
```

### View specific log file:
```bash
cat logs/server-2025-12-19.log
```

## Log Features

- ✅ All console output (log, error, warn) written to file
- ✅ Timestamps included for all entries
- ✅ Request logging (filtered to exclude static assets)
- ✅ Reduced console noise - route registration debug logs disabled
- ✅ Daily log rotation
- ✅ Safe JSON serialization for objects

## Console Output

Console remains clean with:
- Only important startup messages
- Request logs (excluding /assets, .map files, /health)
- Errors and warnings
- Performance metrics

The verbose debug output is saved to the log file but not cluttering the console.
