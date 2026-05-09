
# 🚀 Developer Quick Start Guide

## ⚡ Get Running in 30 Minutes

This guide gets you from zero to a running system in **30 minutes**.

---

## 📋 Prerequisites Checklist

- [ ] Node.js installed
- [ ] Git repository cloned
- [ ] Environment variables set (see `.env.example`)
- [ ] Database configured (PostgreSQL)

---

## 🎯 Quick Setup (30 min)

### Step 1: Install & Build (5 min)
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Verify build succeeded
ls -la dist/
```

### Step 2: Start Services (2 min)
```bash
# Start backend server
npm run server

# In another terminal, start frontend
npm run dev
```

**Verify**: 
- Backend running on port 5000
- Frontend running on port 5173

### Step 3: Test Basic Endpoints (3 min)
```bash
# Check health
curl http://localhost:5000/api/health

# Check gateway status
curl http://localhost:5000/api/gateway/health

# Test scanner
curl http://localhost:5000/api/scanner/symbols
```

### Step 4: Verify Data Flow (10 min)

1. **Open frontend**: http://localhost:5173
2. **Check dashboard**: Should see market data loading
3. **View scanner**: Navigate to `/scanner` page
4. **Check signals**: Navigate to `/signals` page

### Step 5: Configure Your First Strategy (10 min)

**Edit**: `config/trading-config.json`

```json
{
  "strategies": {
    "enabled": ["bounce", "breakout"],
    "bounce": {
      "minConfidence": 0.65,
      "maxPositionSize": 0.02
    }
  },
  "scanner": {
    "symbols": ["BTC/USDT", "ETH/USDT"],
    "interval": 60000
  }
}
```

**Restart server** to apply changes.

---

## 🔧 Key Files to Know

### Configuration
- `config/trading-config.json` - Trading parameters
- `config/signal-config.json` - Signal settings
- `config/exchange-config.json` - Exchange settings
- `.env` - Environment variables

### Backend Entry Points
- `server/index.ts` - Main server file
- `server/routes/` - API endpoints
- `server/services/` - Business logic
- `server/lib/signal-pipeline.ts` - Signal processing

### Frontend Entry Points
- `client/src/App.tsx` - Main app component
- `client/src/pages/` - Page components
- `client/src/components/` - Reusable components

---

## 📊 Understanding the Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER REQUEST                      │
└───────────────────┬─────────────────────────────────┘
                    │
            ┌───────▼────────┐
            │  Express API    │
            │  (server/index) │
            └───────┬────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
   ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
   │ Gateway │ │Scanner │ │Signals │
   │ Service │ │Service │ │Service │
   └────┬────┘ └───┬────┘ └───┬────┘
        │          │          │
   ┌────▼──────────▼──────────▼────┐
   │     Signal Pipeline            │
   │     (ML, RL, Analytics)        │
   └────┬───────────────────────────┘
        │
   ┌────▼────┐
   │Database │
   │(Postgres)│
   └─────────┘
```

---

## 🎯 Common Development Tasks

### Task: Add a New API Endpoint

**File**: `server/routes/my-feature.ts`

```typescript
import { Router } from 'express';

export const myFeatureRouter = Router();

myFeatureRouter.get('/status', async (req, res) => {
  res.json({ status: 'ok', feature: 'my-feature' });
});
```

**Register**: `server/index.ts`
```typescript
import { myFeatureRouter } from './routes/my-feature';
app.use('/api/my-feature', myFeatureRouter);
```

### Task: Add a New Service

**File**: `server/services/my-service.ts`

```typescript
export class MyService {
  async process(data: any) {
    // Your logic here
    return { result: 'processed' };
  }
}
```

**Use it**: `server/routes/my-feature.ts`
```typescript
import { MyService } from '../services/my-service';
const service = new MyService();
const result = await service.process(data);
```

### Task: Add a New Frontend Page

**File**: `client/src/pages/my-page.tsx`

```typescript
export default function MyPage() {
  return (
    <div className="p-6">
      <h1>My New Page</h1>
    </div>
  );
}
```

**Route**: `client/src/App.tsx`
```typescript
import MyPage from './pages/my-page';

// In routes array:
{ path: '/my-page', element: <MyPage /> }
```

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check port conflicts
lsof -i :5000

# Check logs
tail -f logs/server.log

# Verify environment
node -v
npm -v
```

### Database connection errors
```bash
# Check PostgreSQL is running
pg_isready

# Verify connection string in .env
cat .env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Frontend not loading data
```bash
# Check network tab in browser DevTools
# Verify API calls are hitting correct endpoints

# Check CORS settings in server/index.ts
# Ensure allowedOrigins includes your frontend URL
```

---

## 📚 Next Steps

After quick start, follow these paths:

### Path 1: Core Trading (Recommended First)
1. Read **GATEWAY_AGENT_IMPLEMENTATION.md**
2. Implement **CONTINUOUS_SCANNER_QUICKSTART.md**
3. Review **DYNAMIC_POSITION_SIZING_INTEGRATION.md**

### Path 2: Intelligence Layer
1. Setup **BBU_IMPLEMENTATION_QUICKSTART.md**
2. Add **ADAPTIVE_HOLDING_INTEGRATION_GUIDE.md**
3. Integrate **COINGECKO_QUICKSTART.md**

### Path 3: Production
1. Follow **DEPLOYMENT_GUIDE.md**
2. Complete **DEPLOYMENT_CHECKLIST.md**
3. Monitor with **DASHBOARD_TROUBLESHOOTING.md**

---

## 🎓 Learning Resources

- **Architecture Overview**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Complete File List**: [FILE_INVENTORY.md](FILE_INVENTORY.md)
- **API Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **All Guides**: [DOCUMENTATION_ARCHITECTURE.md](DOCUMENTATION_ARCHITECTURE.md)

---

## ✅ Success Checklist

After 30 minutes, you should have:

- [x] Server running on port 5000
- [x] Frontend running on port 5173
- [x] Dashboard loading market data
- [x] Scanner detecting symbols
- [x] Basic configuration understanding
- [x] Know where to find documentation

**You're ready to build!** 🚀

---

**Questions?** Check [DOCUMENTATION_ARCHITECTURE.md](DOCUMENTATION_ARCHITECTURE.md) for the right guide.

