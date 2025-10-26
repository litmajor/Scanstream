# 🚀 Scanstream Startup Guide

## Quick Start

### Option 1: Automated Start (Windows)

**Start Backend Services:**
```bash
start.bat
```

This will automatically start:
1. PostgreSQL Database (Docker) - Port 5432
2. Python Scanner API - Port 5001
3. Node.js Backend - Port 5000

**Start Frontend (in separate terminal):**
```bash
start-frontend.bat
# or
npm run dev
```

---

### Option 2: Manual Start (All Platforms)

**Terminal 1 - Database:**
```bash
docker compose up db -d
```

**Terminal 2 - Scanner API:**
```bash
python scanner_api.py
```

**Terminal 3 - Backend:**
```bash
npm run server
```

**Terminal 4 - Frontend:**
```bash
npm run dev
```

---

## 🔧 Service URLs

| Service | URL | Status Check |
|---------|-----|--------------|
| **Frontend** | http://localhost:5173 | Open in browser |
| **Backend API** | http://localhost:5000 | `curl http://localhost:5000/api/health` |
| **Scanner API** | http://localhost:5001 | `curl http://localhost:5001/api/scanner/status` |
| **Database** | postgresql://localhost:5432/scandb | `docker exec scanstream-db-1 pg_isready` |

---

## 📋 Port Configuration

```
Frontend (Vite):        5173
Backend (Node.js):      5000
Scanner API (Python):   5001
Database (PostgreSQL):  5432
```

---

## 🐳 Docker Deployment

Start everything with Docker:

```bash
docker compose up -d
```

Access the full stack at: http://localhost:5000

---

## 🛑 Stopping Services

### Local Development

**Windows (if using start.bat):**
1. Close the Scanner API window
2. Close the Backend window
3. Stop database: `docker compose down`
4. Stop frontend: Press `Ctrl+C` in Vite terminal

**Manual (All Platforms):**
```bash
# Stop frontend: Ctrl+C in terminal

# Stop backend: Ctrl+C in terminal

# Stop scanner: Ctrl+C in terminal

# Stop database
docker compose down
```

### Docker

```bash
docker compose down
```

---

## ✅ Verification Steps

### 1. Check Database
```bash
docker ps | grep scanstream-db
docker exec scanstream-db-1 psql -U scanuser -d scandb -c "SELECT 1;"
```

### 2. Check Scanner API
```bash
curl http://localhost:5001/api/scanner/status
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-24T..."
}
```

### 3. Check Backend
```bash
curl http://localhost:5000/api/health
```

### 4. Check Frontend
Open http://localhost:5173 in your browser

---

## 🚨 Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Windows:**
```powershell
# Find process using the port
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9
```

### Scanner API Not Responding

**Check if Python dependencies are installed:**
```bash
pip install -r requirements.txt
```

**Verify scanner_api.py exists:**
```bash
ls scanner_api.py
```

### Database Connection Failed

**Check database container:**
```bash
docker ps | grep postgres
```

**Restart database:**
```bash
docker compose restart db
```

**Check logs:**
```bash
docker compose logs db
```

### Frontend Proxy Errors (404 on /api/*)

**Verify backend is running:**
```bash
curl http://localhost:5000/api/health
```

**Check vite.config.ts proxy settings:**
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  }
}
```

**Restart Vite dev server:**
```bash
# Press Ctrl+C, then:
npm run dev
```

---

## 📦 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite frontend dev server (5173) |
| `npm run server` | Start Node.js backend (5000) |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build |
| `npm run docker:up` | Start all Docker services |
| `npm run docker:down` | Stop all Docker services |
| `npm run docker:logs` | View Docker logs |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:migrate` | Run database migrations |
| `npm run db:generate` | Generate Prisma Client |

---

## 🔄 Development Workflow

### Daily Workflow

1. **Start backend services:**
   ```bash
   start.bat    # Windows
   # or manually start each service
   ```

2. **Start frontend dev server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   - Frontend: http://localhost:5173
   - Backend API docs: http://localhost:5000/api

4. **Develop!** 🚀
   - Edit frontend files in `client/src/`
   - Edit backend files in `server/`
   - Changes hot-reload automatically

5. **Stop services when done:**
   ```bash
   # Close terminal windows or Ctrl+C
   docker compose down    # Stop database
   ```

### Testing Workflow

1. **Run continuous scanner:**
   ```bash
   curl -X POST http://localhost:5001/api/scanner/continuous/start \
     -H "Content-Type: application/json" \
     -d '{"symbols": ["BTC/USDT", "ETH/USDT"]}'
   ```

2. **Check signals:**
   ```bash
   curl http://localhost:5001/api/scanner/continuous/signals?min_score=60
   ```

3. **Test multi-timeframe:**
   ```bash
   curl http://localhost:5001/api/scanner/continuous/confluence/BTC/USDT
   ```

---

## 🎯 Production Deployment

### Build for Production

```bash
# Build frontend
npm run build

# Build backend (TypeScript compilation)
npm run build
```

### Deploy with Docker

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Access Production

- Full Stack: http://localhost:5000
- Scanner API: http://localhost:5001
- Database: postgresql://localhost:5432/scandb

---

## 📖 Additional Resources

- **Port Configuration:** See `PORT_CONFIGURATION.md`
- **Database Setup:** See `DATABASE_STATUS.md`
- **Continuous Scanner:** See `CONTINUOUS_SCANNER_QUICKSTART.md`
- **API Documentation:** See `CONTINUOUS_SCANNER_GUIDE.md`

---

## ✅ Ready Checklist

Before starting development, ensure:

- [ ] Docker Desktop is running
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] Node dependencies installed (`npm install`)
- [ ] `.env` file exists (copy from `.env.example`)
- [ ] Database is migrated (`npm run db:generate`)

---

## 🎉 You're All Set!

Your Scanstream development environment is ready to go:

✅ **Unified port configuration** (5173/5000/5001/5432)  
✅ **Automated startup scripts** (start.bat)  
✅ **Environment variable driven** (.env)  
✅ **Docker-ready** (docker-compose.yml)  
✅ **Full documentation** (this guide)  

**Happy coding!** 🚀

