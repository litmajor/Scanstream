# Quick Start Guide - Scanner Integration

## 🚀 Running the Scanner

### Method 1: Using Start Scripts (Easiest)

#### Windows:
```cmd
start_scanner.bat
```

#### Mac/Linux:
```bash
./start_scanner.sh
```

### Method 2: Manual Start

```bash
# Install dependencies (first time only)
pip install -r requirements.txt

# Run the scanner API
python scanner_api.py
```

The scanner will start on **http://localhost:5001**

## 🖥️ Running the Full Application

### Option A: Docker Compose (Recommended)

```bash
# Start all services (database, scanner, backend, frontend)
docker-compose up --build

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f scanner

# Stop all services
docker-compose down
```

### Option B: Manual Development Setup

**Terminal 1 - Scanner Service:**
```bash
python scanner_api.py
```

**Terminal 2 - Backend:**
```bash
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd client
npm run dev
```

## 📊 Using the Scanner

1. **Open the application:** http://localhost:5173
2. **Navigate to Scanner** page from the sidebar
3. **Select your filters:**
   - Timeframe: Scalping (1m), Short (5m), Medium (1h), or Daily (1d)
   - Signal Type: All, BUY, SELL, or HOLD
   - Min Strength: 0-100%
4. **Click "Scan Now"** button
5. **Wait 30-120 seconds** for the scan to complete
6. **View results** in the signal cards

## ✅ Verify Scanner is Working

### Test 1: Health Check
```bash
curl http://localhost:5001/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "scanner-api",
  "timestamp": "2025-10-24T..."
}
```

### Test 2: Trigger a Quick Scan
```bash
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "medium", "minStrength": 50}'
```

### Test 3: Check via Frontend
1. Open http://localhost:5173/scanner
2. Click "Scan Now"
3. Watch for "Scanning..." message
4. Results should appear within 30-120 seconds

## 🔧 Troubleshooting

### Scanner Won't Start

**Error: `ModuleNotFoundError: No module named 'flask'`**

Solution:
```bash
pip install -r requirements.txt
```

**Error: `Port 5001 already in use`**

Solution:
```bash
# Find and kill the process using port 5001
# Windows:
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :5001
kill -9 <PID>
```

### Frontend Shows "Scanner service is not responding"

**Check if scanner is running:**
```bash
curl http://localhost:5001/health
```

If this fails, restart the scanner service.

### Scan Returns No Results

1. **Lower the minimum strength** threshold (try 30% instead of 50%)
2. **Change timeframe** - try "medium" (1h) as it usually has more signals
3. **Check logs** for errors:
   ```bash
   tail -f momentum_scanner.log
   ```

## 📝 What Gets Scanned

By default, the scanner:
- ✅ Scans **460 crypto trading pairs** (USDT pairs)
- ✅ Uses **Binance** exchange data
- ✅ Calculates **15+ technical indicators** per symbol
- ✅ Returns **top 50 signals** ranked by composite score
- ✅ Filters by minimum volume (100K USD)

## 🎯 Understanding Signal Strength

- **80-100%**: Very strong signal, high confidence
- **60-79%**: Good signal, moderate confidence
- **50-59%**: Weak signal, low confidence
- **Below 50%**: Filtered out (unless you lower the threshold)

## 📦 What Was Installed

### New Files Created:
- `scanner_api.py` - Flask API wrapper for scanner
- `Dockerfile.scanner` - Docker container for scanner service
- `start_scanner.sh` / `start_scanner.bat` - Quick start scripts
- `SCANNER_SETUP.md` - Detailed documentation
- `QUICK_START.md` - This file

### Modified Files:
- `client/src/pages/scanner.tsx` - Now calls real API
- `server/routes.ts` - Added scanner proxy endpoints
- `docker-compose.yml` - Added scanner service
- `requirements.txt` - Added Flask dependencies

## 🌐 API Endpoints

Once running, you can access:

- **Scanner API:** http://localhost:5001
  - Health: `GET /health`
  - Scan: `POST /api/scanner/scan`
  - Get Signals: `GET /api/scanner/signals`
  - Status: `GET /api/scanner/status`

- **Backend API:** http://localhost:3000
  - Scan (proxy): `POST /api/scanner/scan`
  - Get Signals (proxy): `GET /api/scanner/signals`
  - Status (proxy): `GET /api/scanner/status`

- **Frontend:** http://localhost:5173
  - Scanner Page: http://localhost:5173/scanner

## 💡 Pro Tips

1. **First scan is slow** - Scanner initializes exchange connections
2. **Shorter timeframes are faster** - Use "scalping" or "short" for quick tests
3. **Results are cached** - Click "Scan Now" to get fresh data
4. **Auto-refresh** - Results auto-update every 30 seconds
5. **Filter after scanning** - Use filters to narrow down large result sets

## 📖 Need More Help?

See the detailed documentation:
- **Full Setup Guide:** [SCANNER_SETUP.md](SCANNER_SETUP.md)
- **Scanner Source:** [scanner.py](scanner.py)
- **API Wrapper:** [scanner_api.py](scanner_api.py)

## 🎉 Next Steps

Now that scanning is working:

1. ✅ Try different timeframes
2. ✅ Experiment with filters
3. ✅ Check the "View Chart" button (if implemented)
4. ✅ Use signals for trading decisions
5. ✅ Set up alerts for high-strength signals

Happy Trading! 📈

