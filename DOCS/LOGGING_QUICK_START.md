# Server Logging Quick Start

## Access Logs via API

### 1. Get Current Session Info
```bash
curl http://localhost:5173/api/logs/stats
```

### 2. View Last 50 Lines of Latest Log
```bash
curl "http://localhost:5173/api/logs/tail/server-$(date +%Y-%m-%d)-chunk-000.log?lines=50"
```

### 3. Search for Errors
```bash
curl "http://localhost:5173/api/logs/search?pattern=ERROR"
```

### 4. Search for Warnings (Case Insensitive)
```bash
curl "http://localhost:5173/api/logs/search?pattern=WARN&caseSensitive=false"
```

## Use CLI Tool

### 1. List All Logs
```bash
node scripts/logs-cli.js list
```

### 2. Show Statistics
```bash
node scripts/logs-cli.js stats
```

### 3. Tail Last 50 Lines
```bash
node scripts/logs-cli.js tail chunk-000 50
```

### 4. Search for Pattern
```bash
node scripts/logs-cli.js search ERROR
node scripts/logs-cli.js search "connection failed" --case-sensitive
```

### 5. Follow Log in Real-Time
```bash
node scripts/logs-cli.js follow
```

## Using ModuleLogger in Code

```typescript
import { ModuleLogger } from '../utils/logger';

const logger = new ModuleLogger('MyFeature');

// These all get logged to file automatically
logger.info('Operation started');      // [INFO] [MyFeature] Operation started
logger.warn('Deprecated method used');  // [WARN] [MyFeature] ⚠️ Deprecated method used
logger.error('Failed to connect');      // [ERROR] [MyFeature] ❌ Failed to connect
logger.debug('Variable value', data);   // [DEBUG] [MyFeature] 🔍 Variable value (only if DEBUG=1)
```

## Log File Structure

```
logs/
├── 2026-03-30_1711818245123/          ← Session ID (date + timestamp)
│   ├── server-2026-03-30-chunk-000.log  ← Auto-created at 10MB limit
│   ├── server-2026-03-30-chunk-001.log
│   └── server-2026-03-30-chunk-002.log
└── 2026-03-30_1711818901456/
    └── server-2026-03-30-chunk-000.log
```

## Configuration

To change log file chunk size and retention:

**File:** `server/utils/logger.ts`

```typescript
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024;  // 10 MB per chunk
const MAX_LOGS_TO_KEEP = 20;                  // Keep last 20 chunks
```

## Features

✅ Automatic console.log/error/warn capture  
✅ File-based logging with 10 MB chunks  
✅ Session-based organization  
✅ REST API for log access  
✅ Command-line tool for viewing  
✅ Search with regex support  
✅ Automatic cleanup of old chunks  
✅ Module-specific loggers  
✅ Color-coded output (ERROR=red, WARN=yellow)  

## Debugging Tips

### Find all errors from last session
```bash
node scripts/logs-cli.js search "ERROR"
```

### Monitor logs in real-time
```bash
node scripts/logs-cli.js follow chunk-000
```

### Get stats on current session
```bash
node scripts/logs-cli.js stats
```

### Search for specific feature issues
```bash
curl "http://localhost:5173/api/logs/search?pattern=%5BMarketData%5D%20ERROR"
```
