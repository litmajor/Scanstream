
# Environment Configuration Guide

## Quick Start

1. Copy example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
```bash
nano .env  # or use Replit Secrets
```

## Required Variables

### Database
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/scandb"
```

### Server
```bash
PORT=3000
NODE_ENV=development
HOST=0.0.0.0
```

### Logging
```bash
DEBUG=server:*,express:*
LOG_LEVEL=info
```

## Optional Variables

### Exchange APIs
```bash
# Binance
BINANCE_API_KEY=your_key
BINANCE_SECRET=your_secret

# KuCoin
KUCOIN_API_KEY=your_key
KUCOIN_SECRET=your_secret
KUCOIN_PASSPHRASE=your_passphrase

# Bybit
BYBIT_API_KEY=your_key
BYBIT_SECRET=your_secret
```

### External Services
```bash
# CoinGecko (optional, public API by default)
COINGECKO_API_KEY=your_key

# OpenAI (for ML features)
OPENAI_API_KEY=your_key
```

### Performance
```bash
# Cache settings
CACHE_TTL=300
CACHE_MAX_SIZE=1000

# Rate limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Worker threads
WORKER_THREADS=4
```

## Environment-Specific Configs

### Development (.env.development)
```bash
NODE_ENV=development
DEBUG=*
PORT=3000
DATABASE_URL=postgresql://scanuser:scanpass@localhost:5432/scandb_dev
ENABLE_HOT_RELOAD=true
```

### Production (.env.production)
```bash
NODE_ENV=production
DEBUG=server:error
PORT=5000
DATABASE_URL=$REPLIT_DB_URL
ENABLE_HOT_RELOAD=false
CACHE_TTL=600
```

### Testing (.env.test)
```bash
NODE_ENV=test
DEBUG=server:test
DATABASE_URL=postgresql://scanuser:scanpass@localhost:5432/scandb_test
```

## Replit Secrets

For sensitive data, use Replit Secrets:

1. Open Secrets tab in Replit
2. Add key-value pairs
3. Access in code:
```typescript
const apiKey = process.env.BINANCE_API_KEY;
```

## Validation

Add to your server startup:

```typescript
// server/config-validator.ts
const requiredVars = ['DATABASE_URL', 'PORT'];

function validateEnv() {
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();
```

## Best Practices

1. **Never commit `.env`**: Add to `.gitignore`
2. **Use Secrets for production**: Replit Secrets > .env file
3. **Validate on startup**: Check required vars
4. **Document all vars**: Update this guide
5. **Use defaults**: Provide sensible fallbacks

## Common Issues

### Variable not loading
```bash
# Check if defined
echo $DATABASE_URL

# Restart server to reload
npm run server
```

### Wrong environment
```bash
# Force environment
NODE_ENV=production npm run server
```

### Secrets not accessible
1. Check Secrets tab in Replit
2. Verify exact key name (case-sensitive)
3. Restart Repl to reload secrets
