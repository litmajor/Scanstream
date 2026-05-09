
# Server Logging Guide

## Overview
This guide explains how to configure and troubleshoot server logging in the Scanstream application.

## Common Issues

### 1. "tsx: not found" Error

**Problem**: Dependencies not installed
**Solution**:
```bash
npm install
```

### 2. No Console Output

**Problem**: Logging disabled or redirected
**Solution**: Enable debug mode in `.env`:
```bash
DEBUG=express:*,server:*
NODE_ENV=development
```

## Log Levels

### Production
```bash
NODE_ENV=production
DEBUG=server:error
```

### Development
```bash
NODE_ENV=development
DEBUG=express:*,server:*
```

### Verbose Debugging
```bash
NODE_ENV=development
DEBUG=*
```

## Key Logging Points

### 1. Startup Logs
- HTTP server port binding
- Database connection status
- WebSocket initialization
- Route registration

### 2. Request Logs
- HTTP method and path
- Response status codes
- Request duration
- Error details

### 3. Service Logs
- Market data fetching
- Signal generation
- Trade execution
- Gateway operations

## Custom Logger Usage

```typescript
import { log } from './vite';

// Info level
log('Server started on port 3000');

// With data
log('Signal generated:', { symbol: 'BTC/USDT', confidence: 0.85 });

// Error level
console.error('[Error]', error.message);

// Debug level (only in development)
if (process.env.NODE_ENV === 'development') {
  console.debug('[Debug]', details);
}
```

## Troubleshooting

### No logs appearing
1. Check `DEBUG` environment variable
2. Verify `tsx watch` is running
3. Check console output redirection
4. Ensure proper error handling

### Too many logs
1. Set specific DEBUG filters: `DEBUG=server:*`
2. Use production mode: `NODE_ENV=production`
3. Implement log levels

### Performance impact
1. Disable verbose logging in production
2. Use structured logging
3. Implement log sampling for high-volume endpoints

## Log Rotation

For production deployments:
```bash
# Install winston for advanced logging
npm install winston winston-daily-rotate-file

# Configure in server/index.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new DailyRotateFile({
      filename: 'logs/server-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d'
    })
  ]
});
```

## Monitoring Best Practices

1. **Structured Logging**: Use JSON format for easy parsing
2. **Context**: Include request IDs, user IDs, timestamps
3. **Performance**: Log request duration and database queries
4. **Errors**: Always log stack traces
5. **Security**: Never log sensitive data (API keys, passwords)
