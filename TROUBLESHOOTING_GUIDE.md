
# Scanstream Troubleshooting Guide

## Quick Diagnostics

Run these commands to diagnose issues:
```bash
# Check dependencies
npm list tsx

# Check environment
node --version
npm --version

# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check port availability
lsof -i :3000
```

## Common Issues

### 1. Server Won't Start

#### Error: "tsx: not found"
```bash
# Solution
npm install
```

#### Error: "Port already in use"
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run server
```

#### Error: "Cannot connect to database"
```bash
# Check DATABASE_URL in .env
echo $DATABASE_URL

# Start database
docker-compose up -d db

# Run migrations
npm run db:migrate
```

### 2. Frontend Issues

#### Vite Connection Failed
**Symptoms**: `[vite] failed to connect to websocket`

**Causes**: 
- HTTPS/HTTP mismatch
- Wrong WebSocket URL

**Solutions**:
1. Check `.replit` configuration
2. Verify WebSocket URL in vite config
3. Use correct protocol (wss:// for HTTPS)

#### API Requests Failing
```bash
# Check backend is running
curl http://0.0.0.0:3000/api/health

# Check proxy configuration in vite.config.ts
# Should point to: http://localhost:5000
```

### 3. Database Issues

#### Migrations Failed
```bash
# Reset database
npm run db:migrate -- --schema-only

# Re-run migrations
npm run db:migrate
```

#### Connection Pool Exhausted
```bash
# Restart database
docker-compose restart db

# Check for hanging connections
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity"
```

### 4. Gateway/Scanner Issues

#### Exchange API Errors
**Error**: "RateLimitExceeded"
```typescript
// Solution: Already implemented in gateway/rate-limiter.ts
// Check configuration in config/exchange-config.json
```

#### No Market Data
```bash
# Check market data fetcher
curl http://0.0.0.0:3000/api/gateway/health

# Verify exchange connectivity
curl http://0.0.0.0:3000/api/gateway/exchanges
```

### 5. ML/Signal Issues

#### Models Not Loading
```bash
# Check model directory
ls -la data/ml-models/

# Retrain models
npm run ml:train
```

#### No Signals Generated
```bash
# Check signal generation
curl http://0.0.0.0:3000/api/signals/latest

# Check logs for errors
DEBUG=server:* npm run server
```

## Performance Issues

### High Memory Usage
```bash
# Monitor memory
node --expose-gc --max-old-space-size=4096 server/index.ts

# Check for memory leaks
npm install -g clinic
clinic doctor -- node server/index.ts
```

### Slow API Response
```bash
# Enable performance logging
DEBUG=express:* npm run server

# Check database queries
npm run db:studio
```

## Development Tips

### Clean Start
```bash
# Remove node_modules
rm -rf node_modules

# Clear cache
rm -rf .cache

# Reinstall
npm install

# Reset database
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

### Debug Mode
```bash
# Full debug output
DEBUG=* npm run server

# Specific modules
DEBUG=server:*,gateway:* npm run server
```

### Watch Mode Not Working
```bash
# Use nodemon instead of tsx watch
npm install -g nodemon
nodemon --exec tsx server/index.ts
```

## Error Codes Reference

| Code | Meaning | Solution |
|------|---------|----------|
| EADDRINUSE | Port in use | Kill process or use different port |
| ECONNREFUSED | Service not running | Start required service |
| ETIMEDOUT | Network timeout | Check firewall/network |
| ENOTFOUND | DNS resolution failed | Check service URL |
| EACCES | Permission denied | Check file permissions |

## Getting Help

1. **Check logs**: `npm run server` with DEBUG enabled
2. **Search issues**: Look in GitHub issues
3. **Check documentation**: See INDEX.md for all docs
4. **Ask community**: Replit forums or Discord
5. **Report bug**: Create GitHub issue with logs

## Health Checks

```bash
# Backend
curl http://0.0.0.0:3000/api/health

# Database
curl http://0.0.0.0:3000/api/health/db

# Gateway
curl http://0.0.0.0:3000/api/gateway/health

# ML Engine
curl http://0.0.0.0:3000/api/ml/health
```
