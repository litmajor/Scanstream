# Server Logging System Documentation

## Overview

The Scanstream server now includes an enhanced logging system with automatic chunking, session management, and debugging capabilities.

## Features

- **Automatic File Logging**: All console output (log, error, warn) is automatically written to log files
- **Session-based Organization**: Each server startup creates a new session with unique ID
- **Automatic Chunking**: Log files are automatically split when they exceed 10 MB
- **History Retention**: Keeps the last 20 chunks per session
- **API Access**: Full REST API for viewing, searching, and downloading logs
- **Module Logger**: Typed logger for better organization

## Log Structure

```
logs/
├── YYYY-MM-DD_TIMESTAMP_1/
│   ├── server-YYYY-MM-DD-chunk-000.log
│   ├── server-YYYY-MM-DD-chunk-001.log
│   └── ...
└── YYYY-MM-DD_TIMESTAMP_2/
    ├── server-YYYY-MM-DD-chunk-000.log
    └── ...
```

## API Endpoints

### Get Log Statistics
```bash
GET /api/logs/stats

Response:
{
  "success": true,
  "sessionId": "2026-03-30_1234567890",
  "sessionDir": "/path/to/logs/2026-03-30_1234567890",
  "totalChunks": 3,
  "totalSize": 24567890,
  "chunks": [
    {
      "file": "server-2026-03-30-chunk-000.log",
      "size": 10485760,
      "created": "2026-03-30T12:00:00.000Z"
    }
  ]
}
```

### Get Current Session Info
```bash
GET /api/logs/session

Response:
{
  "sessionId": "2026-03-30_1234567890",
  "timestamp": "2026-03-30T12:30:45.123Z"
}
```

### List All Log Files
```bash
GET /api/logs/list

Response:
{
  "success": true,
  "count": 3,
  "files": [
    {
      "name": "server-2026-03-30-chunk-000.log",
      "path": "/full/path/to/server-2026-03-30-chunk-000.log",
      "size": 10485760
    }
  ]
}
```

### Download a Log File
```bash
GET /api/logs/download/server-2026-03-30-chunk-000.log

# Returns file as attachment
```

### Read a Log File
```bash
GET /api/logs/read/server-2026-03-30-chunk-000.log?lines=100

Response:
{
  "success": true,
  "file": "server-2026-03-30-chunk-000.log",
  "size": 10485760,
  "totalLines": 50234,
  "requestedLines": 100,
  "returnedLines": 100,
  "content": "... last 100 lines ..."
}
```

### Tail a Log File (Last N Lines)
```bash
GET /api/logs/tail/server-2026-03-30-chunk-000.log?lines=50

Response:
{
  "file": "server-2026-03-30-chunk-000.log",
  "timestamp": "2026-03-30T12:30:45.123Z",
  "lines": ["line1", "line2", ...],
  "count": 50
}
```

### Search Logs
```bash
GET /api/logs/search?pattern=ERROR&caseSensitive=false

Response:
{
  "success": true,
  "pattern": "ERROR",
  "caseSensitive": false,
  "totalMatches": 142,
  "filesWithMatches": 2,
  "results": [
    {
      "file": "server-2026-03-30-chunk-001.log",
      "matches": [
        {
          "line": 234,
          "content": "[2026-03-30T12:30:45.123Z] [ERROR] Database connection failed"
        }
      ]
    }
  ]
}
```

## Using the Module Logger

For better organization in your code, use the `ModuleLogger` class instead of `console.log()`:

```typescript
import { ModuleLogger } from '../utils/logger';

const logger = new ModuleLogger('MyComponent');

logger.info('Starting process', { userId: 123 });
logger.error('Failed to fetch data', { statusCode: 500 });
logger.warn('Deprecated API used', { api: 'old_endpoint' });
logger.debug('Processing item', { itemId: 456 }); // Only logs if DEBUG env is set
```

Output will be automatically prefixed with `[MyComponent]` for easy identification.

## Using the Logging API from Client

### Get Current Logs
```javascript
fetch('/api/logs/stats')
  .then(r => r.json())
  .then(data => {
    console.log(`Current session: ${data.sessionId}`);
    console.log(`Total log size: ${data.totalSize} bytes`);
    console.log(`Number of chunks: ${data.totalChunks}`);
  });
```

### Search for Errors
```javascript
fetch('/api/logs/search?pattern=ERROR')
  .then(r => r.json())
  .then(data => {
    console.log(`Found ${data.totalMatches} errors`);
    data.results.forEach(result => {
      console.log(`In ${result.file}:`);
      result.matches.forEach(match => {
        console.log(`  Line ${match.line}: ${match.content}`);
      });
    });
  });
```

### Download All Logs (as ZIP - Future Enhancement)
```
POST /api/logs/download-session
# Will create a ZIP file of all current session logs
```

## Configuration

Edit `server/utils/logger.ts` to customize:

```typescript
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10 MB chunks
const MAX_LOGS_TO_KEEP = 20; // Keep 20 chunks per session
```

## Log Levels

Logs are categorized by level:
- `[INFO]` - General information messages
- `[ERROR]` - Error messages (console.error)
- `[WARN]` - Warning messages (console.warn)
- `[DEBUG]` - Debug messages (only when DEBUG env var is set)

## Best Practices

1. **Use ModuleLogger for clarity**: Developers can quickly identify which system logged a message
2. **Keep sessions manageable**: Each session creates a new directory, making it easy to correlate logs with server runs
3. **Search frequently**: Use the search API to find issues quickly
4. **Monitor file size**: The automatic chunking prevents any single file from growing too large

## Performance Considerations

- Log writes are non-blocking (write streams)
- Old chunks are automatically cleaned up (max 20 per session)
- Search operations are limited to 50 matches per file to prevent memory issues
- Reading is limited to 1000 lines max per request

## Future Enhancements

- [ ] Log aggregation dashboard in admin panel
- [ ] Real-time log streaming via WebSocket
- [ ] Automatic error analysis and alerting
- [ ] Compression of completed sessions
- [ ] Log rotation by time (hourly, daily)
- [ ] Structured logging (JSON format)
- [ ] Log level filtering
- [ ] Performance metrics from logs
