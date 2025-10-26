# 🔌 Port Configuration - Scanstream

## 📊 Unified Port Layout

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Frontend (Vite Dev)** | 5173 | `http://localhost:5173` | React frontend development server |
| **Backend (Node.js)** | 3000 | `http://localhost:3000` | Express API server (local dev) - FIXED PORT |
| **Backend (Docker)** | 3000 | `http://localhost:3000` | Express API server (Docker) |
| **Scanner API (Python)** | 5001 | `http://localhost:5001` | Python Flask scanner API |
| **Database (PostgreSQL)** | 5432 | `postgresql://localhost:5432` | PostgreSQL database |

---

## 🚀 Local Development Setup

### 1. Start Services

```bash
# Terminal 1: Start Database (Docker)
docker compose up db

# Terminal 2: Start Scanner API (Python)
python scanner_api.py

# Terminal 3: Start Backend (Node.js)
npm run server

# Terminal 4: Start Frontend (Vite)
npm run dev
```

### 2. Access URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Scanner API**: http://localhost:5001/api/scanner
- **Database**: `postgresql://scanuser:scanpass@localhost:5432/scandb`

---

## 🐳 Docker Deployment

### Start All Services

```bash
docker compose up -d
```

### Access URLs

- **Full Stack**: http://localhost:3000
- **Scanner API**: http://localhost:5001
- **Database**: `postgresql://scanuser:scanpass@localhost:5432/scandb`

---

## 🔧 Environment Variables

### Local Development (`.env`)

```env
# Database
DATABASE_URL="postgresql://scanuser:scanpass@localhost:5432/scandb?schema=public"

# Backend
PORT=3000
NODE_ENV=development

# Scanner API
SCANNER_API_URL="http://localhost:5001"

# Frontend (Vite)
VITE_BACKEND_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000"
```

### Docker Deployment

Environment variables are configured in `docker-compose.yml`:

```yaml
backend:
  environment:
    DATABASE_URL: postgres://scanuser:scanpass@db:5432/scandb
    SCANNER_API_URL: http://scanner:5001
    PORT: 3000
```

---

## 📡 API Proxy Configuration

### Vite Frontend → Backend

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/ws': {
    target: 'ws://localhost:3000',
    ws: true,
  },
}
```

### Backend → Scanner API

```typescript
// server/routes.ts
const scannerApiUrl = process.env.SCANNER_API_URL || 'http://localhost:5001';
fetch(`${scannerApiUrl}/api/scanner/scan`)
```

---

## 🔀 Request Flow

### Frontend → Backend API

```
User Browser
    ↓
http://localhost:5173/api/scanner/scan
    ↓ (Vite proxy)
http://localhost:3000/api/scanner/scan
    ↓ (Node.js backend)
http://localhost:5001/api/scanner/scan
    ↓ (Python Scanner)
Response
```

### Frontend → WebSocket

```
User Browser
    ↓
ws://localhost:5173/ws
    ↓ (Vite proxy)
ws://localhost:3000/ws
    ↓ (Node.js WebSocket server)
Real-time updates
```

---

## 🛠️ Changing Ports

### Backend Port

**Local Development:**
```bash
# In .env
PORT=3000
```

**Docker:**
```yaml
# In docker-compose.yml
backend:
  environment:
    PORT: 3000
  ports:
    - "3000:3000"
```

### Scanner API Port

**Python Scanner:**
```python
# In scanner_api.py (line 779)
app.run(host='0.0.0.0', port=5001, debug=False)
```

**Backend Proxy:**
```bash
# In .env
SCANNER_API_URL="http://localhost:5001"
```

### Frontend Port

**Vite Dev Server:**
```typescript
// In vite.config.ts
server: {
  port: 5173,
}
```

---

## 🔒 Firewall & Security

### Development (localhost only)

All services bind to `localhost` or `0.0.0.0` (all interfaces):

- ✅ **Safe for local development**
- ⚠️ **Not exposed to internet**

### Production Deployment

**Recommendations:**
1. Use reverse proxy (Nginx/Caddy)
2. Enable HTTPS
3. Bind backend to `localhost` only
4. Expose only Nginx on ports 80/443

**Example Nginx Config:**
```nginx
server {
    listen 80;
    server_name scanstream.yourdomain.com;

    # Frontend (static files)
    location / {
        root /var/www/scanstream/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 🧪 Testing Ports

### Check Port Availability

**Windows (PowerShell):**
```powershell
netstat -ano | Select-String "3000|5001|5173|5432"
```

**Linux/Mac:**
```bash
lsof -i :3000
lsof -i :5001
lsof -i :5173
lsof -i :5432
```

### Test Endpoints

```bash
# Backend Health
curl http://localhost:3000/api/health

# Scanner Status
curl http://localhost:5001/api/scanner/status

# Frontend (in browser)
open http://localhost:5173
```

---

## 🚨 Common Issues

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using port
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F

# Or change port in .env
PORT=3001
```

### Cannot Connect to Scanner API

**Error:** `Failed to communicate with scanner service`

**Solution:**
1. Check scanner is running: `curl http://localhost:5001/api/scanner/status`
2. Verify `SCANNER_API_URL` in `.env`
3. Start scanner: `python scanner_api.py`

### Vite Proxy Not Working

**Error:** `404 Not Found` on `/api/*` routes

**Solution:**
1. Verify backend is running on port 3000
2. Check `vite.config.ts` proxy configuration
3. Restart Vite dev server: `npm run dev`

---

## 📝 Quick Reference

### Start Everything (Local Dev)

```bash
# 1. Database
docker compose up db -d

# 2. Scanner API
python scanner_api.py

# 3. Backend
npm run server

# 4. Frontend
npm run dev
```

### Start Everything (Docker)

```bash
docker compose up -d
```

### Check Status

```bash
# Backend
curl http://localhost:3000/api/health

# Scanner
curl http://localhost:5001/api/scanner/status

# Database
docker exec -it scanstream-db-1 psql -U scanuser -d scandb -c "SELECT 1;"
```

---

## ✅ Summary

**Unified Port Configuration:**
- Frontend: **5173** (Vite dev)
- Backend: **3000** (Node.js) - LOCKED & PERMANENT
- Scanner: **5001** (Python Flask)
- Database: **5432** (PostgreSQL)

**All configurations are now:**
- ✅ Environment variable driven
- ✅ Consistent across Docker and local dev
- ✅ Documented and easy to change
- ✅ Properly proxied for seamless integration

**Everything is ready to run!** 🚀

