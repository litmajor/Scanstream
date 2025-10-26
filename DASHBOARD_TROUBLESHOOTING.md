# Dashboard Chart Troubleshooting Guide

## ✅ Changes Made

1. **Frontend**: Changed default exchange from `kucoinfutures` → `binance`
   - File: `client/src/pages/trading-terminal.tsx` (line 327)

2. **Backend WebSocket**: Changed default exchange from `kucoinfutures` → `binance`
   - File: `server/routes.ts` (line 1120)

3. **Backend Engine**: Already defaults to `binance` (line 1020 in `trading-engine.ts`)

---

## 🔍 Why Charts Might Not Show

### 1. **Browser Cache** (Most Common)
Your browser may be using the old JavaScript with `kucoinfutures`.

**Solution**:
```bash
# Hard reload the page
Ctrl + Shift + R   (Windows/Linux)
Cmd + Shift + R    (Mac)

# Or clear cache
F12 → Application → Clear Storage → Clear site data
```

### 2. **WebSocket Not Connected**
**Check Browser Console** (F12):
```javascript
// You should see:
[WebSocket] Connecting to: ws://localhost:5173/ws
[WebSocket] Connected successfully
[WebSocket] Message received: connection
[WebSocket] Message received: market_data
```

**If you see**:
- ❌ `WebSocket connection failed` → Backend not running on port 3000
- ❌ `Connection refused` → Backend WebSocket not initialized
- ❌ No `market_data` messages → ExchangeDataFeed not sending data

### 3. **ExchangeDataFeed Not Initialized**
**Check Backend Console**:
```bash
# You should see on startup:
[INIT] Initializing binance...
[INIT] binance initialized successfully
✅ CoinGecko service initialized
```

**If missing**:
- Backend failed to initialize Binance
- Check for API key errors
- Check `config/exchange-config.json`

### 4. **Binance API Keys Not Set**
If you have API keys in `.env`:
```bash
BINANCE_API_KEY=your_key
BINANCE_SECRET=your_secret
```

**Without API keys**: Public data should still work for most symbols.

---

## 🧪 Testing Steps

### Step 1: Restart Backend
```bash
cd server
npm run dev
```

Look for:
```
[INIT] Initializing binance...
[INIT] binance initialized successfully
```

### Step 2: Restart Frontend
```bash
# In root directory
npm run dev
```

### Step 3: Hard Reload Browser
```
Ctrl + Shift + R
```

### Step 4: Open Browser Console (F12)

Check for:
```javascript
[WebSocket] Connecting to: ws://localhost:5173/ws
[WebSocket] Connected successfully
[WebSocket] Message received: market_data
```

### Step 5: Check Network Tab (F12 → Network → WS)

Click on the WebSocket connection and check **Messages**:
- You should see incoming messages every few seconds
- Messages should include `type: "market_data"`

---

## 📊 Expected Data Flow

```
Backend (port 3000)
  ↓
ExchangeDataFeed (Binance)
  ↓
WebSocket (/ws)
  ↓
Frontend (port 5173)
  ↓
Trading Terminal (/)
  ↓
Charts Update
```

---

## 🐛 Common Errors

### Error: "Cannot read property 'close' of undefined"
**Cause**: Market data structure mismatch  
**Solution**: Check if `validateMarketFrame` is passing (line 382 in trading-terminal.tsx)

### Error: "WebSocket is already in CLOSING or CLOSED state"
**Cause**: Multiple WebSocket connections  
**Solution**: 
- Close other tabs with the app
- Hard reload
- Restart backend

### Error: "Exchange binance not found"
**Cause**: Binance not in exchanges Map  
**Solution**: Check backend logs for initialization errors

### No Errors, But No Data
**Likely Cause**: WebSocket receiving data but UI not updating  
**Debug**:
```javascript
// Add to browser console:
window.addEventListener('message', (e) => console.log('Message:', e.data));
```

---

## 🔧 Manual Testing

### Test WebSocket Connection
Open browser console and run:
```javascript
const ws = new WebSocket('ws://localhost:5173/ws');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('📨 Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('❌ Error:', e);
```

### Test If Binance is Working
```bash
curl http://localhost:3000/api/exchanges/available
```

Should return:
```json
{
  "exchanges": ["binance", "coinbase", "kraken", "kucoinfutures", ...]
}
```

---

## ✨ Alternative: Check Fast Scanner Data

If the Trading Terminal charts aren't showing, you can still see scanner signals:

**Navigate to**: `http://localhost:5173/scanner`

This page shows the Fast Scanner results which are working (based on your backend logs).

---

## 📝 What Your Backend Logs Show

From your logs:
```
[FastScanner] Quick scan completed in 35969ms - 20 symbols
[WebSocket] Broadcasting quick scan complete: 20 signals
[CoinGecko] Cache miss, fetching: global
```

✅ **Scanner is working**  
✅ **WebSocket is broadcasting**  
✅ **CoinGecko is fetching**  

The issue is likely:
1. Frontend not connected to WebSocket
2. Browser cache showing old code
3. UI component not updating with received data

---

## 🚀 Quick Fix Checklist

- [ ] Restart backend (`npm run dev` in server/)
- [ ] Restart frontend (`npm run dev` in root)
- [ ] Hard reload browser (Ctrl+Shift+R)
- [ ] Check browser console for WebSocket messages
- [ ] Check Network tab for WS connection
- [ ] Verify you're on `http://localhost:5173/` (root path)
- [ ] Try `http://localhost:5173/scanner` as alternative

---

## 📞 Still Not Working?

Share these details:
1. **Browser console output** (F12 → Console)
2. **Network tab WS messages** (F12 → Network → WS)
3. **Backend startup logs** (first 20 lines)
4. **Current URL** you're viewing

---

**Last Updated**: October 25, 2025

