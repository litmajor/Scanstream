# Scanner Integration Setup Guide

This document explains how the real-time market scanner is integrated into your Scanstream application.

## Overview

The scanner system consists of three main components:

1. **Python Scanner Service** (`scanner_api.py`) - Flask API that wraps the momentum scanner
2. **Node.js Backend** (`server/routes.ts`) - Proxy endpoints to communicate with the scanner service
3. **React Frontend** (`client/src/pages/scanner.tsx`) - User interface for triggering scans and viewing results

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│                 │      │                  │      │                     │
│  React Frontend │ ───► │  Node.js Backend │ ───► │  Python Scanner API │
│  (Port 5173)    │      │  (Port 3000)     │      │  (Port 5001)        │
│                 │      │                  │      │                     │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
                                                             │
                                                             ▼
                                                    ┌────────────────┐
                                                    │  CCXT Pro      │
                                                    │  (Exchanges)   │
                                                    └────────────────┘
```

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Scanner API: http://localhost:5001

3. **Navigate to the Scanner page** and click **"Scan Now"** to trigger a real market scan.

### Option 2: Manual Setup (Development)

1. **Start the Python Scanner Service:**
   ```bash
   # Install Python dependencies
   pip install -r requirements.txt
   
   # Run the scanner API
   python scanner_api.py
   ```
   The scanner service will start on port 5001.

2. **Start the Node.js Backend:**
   ```bash
   # Install dependencies
   npm install
   
   # Set environment variable (optional, defaults to localhost:5001)
   export SCANNER_API_URL=http://localhost:5001
   
   # Run the backend
   npm run dev
   ```
   The backend will start on port 3000.

3. **Start the React Frontend:**
   ```bash
   # In the client directory
   cd client
   npm install
   npm run dev
   ```
   The frontend will start on port 5173.

## API Endpoints

### Scanner Service (Python - Port 5001)

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "scanner-api",
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

#### `POST /api/scanner/scan`
Trigger a new market scan.

**Request Body:**
```json
{
  "timeframe": "medium",
  "exchange": "binance",
  "signal": "all",
  "minStrength": 50,
  "fullAnalysis": true
}
```

**Parameters:**
- `timeframe`: "scalping" (1m), "short" (5m), "medium" (1h), "daily" (1d)
- `exchange`: "binance", "kucoinfutures", "coinbase", etc.
- `signal`: "all", "BUY", "SELL", "HOLD"
- `minStrength`: 0-100 (minimum signal strength percentage)
- `fullAnalysis`: true/false (enable full technical analysis)

**Response:**
```json
{
  "signals": [
    {
      "id": "BTC/USDT_1729771200",
      "symbol": "BTC/USDT",
      "exchange": "binance",
      "timeframe": "1h",
      "signal": "BUY",
      "strength": 85,
      "price": 45000,
      "change": 2.5,
      "volume": 1250000,
      "timestamp": "2025-10-24T12:00:00.000Z",
      "indicators": {
        "rsi": 35,
        "macd": "bullish",
        "ema": "above",
        "volume": "high"
      },
      "advanced": {
        "composite_score": 0.75,
        "trend_score": 0.82,
        "confidence_score": 0.88,
        "ichimoku_bullish": true,
        "vwap_bullish": true,
        "bb_position": 0.65
      }
    }
  ],
  "metadata": {
    "count": 15,
    "total_scanned": 460,
    "timeframe": "medium",
    "timestamp": "2025-10-24T12:00:00.000Z"
  }
}
```

#### `GET /api/scanner/signals`
Get latest scan results with optional filtering.

**Query Parameters:**
- `exchange`: Filter by exchange
- `timeframe`: Filter by timeframe
- `signal`: Filter by signal type (BUY/SELL/HOLD)
- `minStrength`: Minimum signal strength (0-100)

**Response:** Same format as `/api/scanner/scan`

#### `GET /api/scanner/status`
Get scanner service status.

**Response:**
```json
{
  "status": "active",
  "scanner_initialized": true,
  "last_scan": "2025-10-24T12:00:00.000Z",
  "results_count": 15,
  "timestamp": "2025-10-24T12:05:00.000Z"
}
```

### Node.js Backend (Port 3000)

The backend proxies all scanner requests to the Python service:

- `POST /api/scanner/scan` → `POST http://scanner:5001/api/scanner/scan`
- `GET /api/scanner/signals` → `GET http://scanner:5001/api/scanner/signals`
- `GET /api/scanner/status` → `GET http://scanner:5001/api/scanner/status`

## Frontend Usage

### Scanning for Signals

1. **Navigate** to the Scanner page from the dashboard
2. **Select filters:**
   - **Timeframe**: Choose scanning interval (Scalping, Short, Medium, Daily)
   - **Exchange**: Select exchange (currently defaults to Binance)
   - **Signal Type**: Filter by BUY/SELL/HOLD signals
   - **Min Strength**: Set minimum signal strength threshold (0-100)

3. **Click "Scan Now"** to trigger a new market scan
   - The button will show "Scanning..." with a pulse animation
   - This typically takes 30-120 seconds depending on timeframe and market conditions

4. **View Results:**
   - Signal cards display in a grid layout
   - Each card shows:
     - Symbol and current price
     - Signal type (BUY/SELL/HOLD) with color coding
     - Signal strength percentage
     - Price change
     - Volume
     - Technical indicators (RSI, MACD, EMA, Volume)
     - Action buttons (View Chart, Trade)

5. **Auto-Refresh:**
   - Results automatically refresh every 30 seconds
   - Click the refresh button for manual updates

## Configuration

### Environment Variables

#### Backend (Node.js)
```bash
SCANNER_API_URL=http://localhost:5001  # URL of the Python scanner service
```

#### Scanner Service (Python)
```bash
FLASK_ENV=production         # Flask environment
PYTHONUNBUFFERED=1          # Enable Python output buffering
```

### Scanner Configuration

The scanner can be configured in `scanner.py` through the `TradingConfig` class:

```python
config = TradingConfig(
    timeframes={
        "scalping": "1m",
        "short": "5m",
        "medium": "1h",
        "daily": "1d"
    },
    max_concurrent_requests=50,  # Parallel request limit
    retry_attempts=3,            # API retry attempts
    retry_delay=2,               # Seconds between retries
    rate_limit_delay=0.01,       # Delay between requests
    # ... more configuration options
)
```

## Technical Details

### Signal Classification

The scanner uses multiple technical indicators to classify signals:

1. **Momentum Indicators:**
   - Short-term momentum (default: 3 periods)
   - Long-term momentum (default: 10 periods)

2. **Oscillators:**
   - RSI (Relative Strength Index)
   - Stochastic Oscillator
   - MACD (Moving Average Convergence Divergence)

3. **Trend Indicators:**
   - EMA (Exponential Moving Average) crossovers
   - Ichimoku Cloud
   - ADX (Average Directional Index)

4. **Volume Analysis:**
   - Volume ratio vs. historical average
   - Volume Profile (POC - Point of Control)
   - VWAP (Volume Weighted Average Price)

5. **Volatility:**
   - Bollinger Bands position
   - Average True Range (ATR)

### Signal Strength Calculation

Signal strength (0-100%) is calculated using a composite scoring system:

```
strength = (
    composite_score * 0.5 +
    volume_composite_score * 0.3 +
    base_signal_strength * 0.2
) * 100
```

### Performance Optimization

The scanner uses several optimization techniques:

1. **Async/Await**: Concurrent market data fetching
2. **Semaphore**: Rate limiting to avoid exchange bans
3. **ThreadPoolExecutor**: CPU-bound indicator calculations
4. **Memoization**: Caching of repeated calculations
5. **Progress Tracking**: TQDM progress bars for monitoring

## Troubleshooting

### Scanner Service Not Responding

**Symptom:** "Scanner service is not responding" error in frontend

**Solutions:**
1. Check if scanner service is running:
   ```bash
   curl http://localhost:5001/health
   ```

2. Check scanner logs:
   ```bash
   docker-compose logs scanner
   # or for manual setup:
   tail -f momentum_scanner.log
   ```

3. Restart scanner service:
   ```bash
   docker-compose restart scanner
   # or for manual setup:
   python scanner_api.py
   ```

### No Signals Found

**Symptom:** Scan completes but returns 0 signals

**Possible Causes:**
1. **Filters too strict**: Lower the minimum strength threshold
2. **Market conditions**: No clear signals in current market
3. **API rate limits**: Check logs for rate limit errors
4. **Exchange connectivity**: Verify exchange APIs are accessible

### Slow Scan Performance

**Symptom:** Scans take longer than 2 minutes

**Solutions:**
1. Reduce concurrent request limit in config
2. Use shorter timeframes (scalping/short)
3. Reduce number of symbols scanned
4. Check network latency to exchanges

### Memory Issues

**Symptom:** Scanner crashes or becomes unresponsive

**Solutions:**
1. Reduce `top_n` parameter (number of results to keep)
2. Disable `full_analysis` for faster scans
3. Clear old scan results: `rm scan_results_*.csv`
4. Increase Docker memory limits

## Development

### Adding New Indicators

1. Add indicator calculation in `scanner.py`:
   ```python
   def calculate_custom_indicator(self, df: pd.DataFrame) -> float:
       # Your indicator logic
       return value
   ```

2. Include in signal formatting (`scanner_api.py`):
   ```python
   'custom_indicator': row.get('custom_indicator', 0)
   ```

3. Display in frontend (`scanner.tsx`):
   ```tsx
   <div>Custom: {signal.indicators.custom_indicator}</div>
   ```

### Testing

**Test the scanner API directly:**
```bash
# Health check
curl http://localhost:5001/health

# Trigger scan
curl -X POST http://localhost:5001/api/scanner/scan \
  -H "Content-Type: application/json" \
  -d '{
    "timeframe": "medium",
    "exchange": "binance",
    "signal": "all",
    "minStrength": 50,
    "fullAnalysis": true
  }'

# Get latest signals
curl http://localhost:5001/api/scanner/signals?minStrength=60
```

## Production Deployment

### Recommended Setup

1. **Use Docker Compose** for easy orchestration
2. **Set environment variables** for production:
   ```bash
   FLASK_ENV=production
   SCANNER_API_URL=http://scanner:5001
   ```

3. **Enable health checks** (already configured in docker-compose.yml)

4. **Monitor logs:**
   ```bash
   docker-compose logs -f scanner
   ```

5. **Set up auto-restart** (already configured with `restart: always`)

### Scaling

For high-traffic scenarios:

1. **Run multiple scanner instances** behind a load balancer
2. **Use Redis** for caching scan results
3. **Implement WebSocket** for real-time updates
4. **Add rate limiting** at the API gateway level

## Support

For issues or questions:
1. Check the logs: `momentum_scanner.log`
2. Review the scanner source: `scanner.py`
3. Test API endpoints directly using curl/Postman
4. Check exchange status and API limits

## License

This scanner integration is part of the Scanstream project.

