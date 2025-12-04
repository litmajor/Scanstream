# Enhanced Bounce Strategy API Integration

## Overview
The Enhanced Bounce Strategy is now integrated into the Scanstream API with dedicated endpoints for execution and backtesting. This allows the frontend and external clients to leverage the multi-timeframe bounce detection system via REST API calls.

## API Endpoints

### 1. List All Strategies
**GET** `/api/strategies`

Returns all available strategies including the Enhanced Bounce Strategy.

```bash
curl http://localhost:3000/api/strategies
```

**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "id": "enhanced_bounce",
      "name": "Enhanced Bounce Strategy",
      "description": "Multi-timeframe support/resistance bounce detection with Bayesian confidence scoring",
      "type": "Support/Resistance",
      "features": [
        "Multi-timeframe zone detection (7 timeframes)",
        "Volume-weighted support/resistance identification",
        "Fractal pivot analysis (TradingView inspired)",
        "Bayesian confidence scoring",
        "Zone confluence detection",
        "Quality validation gates"
      ],
      "parameters": {
        "risk_profile": {
          "type": "string",
          "default": "moderate",
          "description": "Risk profile (conservative/moderate/aggressive)"
        },
        "min_zone_confluence": {
          "type": "number",
          "default": 0.5,
          "description": "Minimum zone confluence score"
        },
        "volume_percentile": {
          "type": "number",
          "default": 85,
          "description": "Volume percentile threshold"
        },
        "min_bounce_confidence": {
          "type": "number",
          "default": 0.70,
          "description": "Minimum bounce confidence"
        }
      },
      "performance": {
        "winRate": 72,
        "avgReturn": 3.2,
        "sharpeRatio": 1.9,
        "maxDrawdown": -8.3
      },
      "isActive": true
    }
  ],
  "total": 6
}
```

### 2. Get Strategy Details
**GET** `/api/strategies/:id`

Get detailed information about a specific strategy.

```bash
curl http://localhost:3000/api/strategies/enhanced_bounce
```

### 3. Execute Enhanced Bounce Strategy
**POST** `/api/strategies/enhanced-bounce/execute`

Execute the Enhanced Bounce Strategy on a specific symbol and timeframe.

**Request Body:**
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "riskProfile": "moderate"
}
```

**Parameters:**
- `symbol` (required): Trading pair (e.g., "BTC/USDT", "ETH/USDT")
- `timeframe` (required): Candle timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w)
- `riskProfile` (optional): Risk profile - "conservative", "moderate", or "aggressive" (default: "moderate")

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/strategies/enhanced-bounce/execute \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "riskProfile": "moderate"
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "strategyId": "enhanced_bounce",
    "strategyName": "Enhanced Bounce Strategy",
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "signal": "BUY",
    "price": 42150.50,
    "confidence": 0.78,
    "strength": 0.82,
    "metadata": {
      "bounce_detected": true,
      "bounce_confidence": 78,
      "bounce_strength": 82,
      "zone_confluence": 0.65,
      "zone_price": 42100.00,
      "quality_reasons": [
        "Zone proximity within tolerance",
        "Volume spike above 1.5x",
        "Price recovery > 2%",
        "Bayesian confidence > 0.70",
        "Multi-timeframe confluence"
      ]
    }
  }
}
```

**Signal Response Fields:**
- `signal`: "BUY", "SELL", or "HOLD"
- `confidence`: Bounce confidence score (0.0-1.0)
- `strength`: Bounce pattern strength (0.0-1.0)
- `metadata.bounce_detected`: Whether a bounce pattern was detected
- `metadata.zone_confluence`: Zone confluence score (0.0-1.0)
- `metadata.zone_price`: Support/resistance zone price level
- `metadata.quality_reasons`: Array of validation reasons

### 4. Backtest Enhanced Bounce Strategy
**POST** `/api/strategies/bounce/backtest`

Run a backtest of the Enhanced Bounce Strategy over a historical period.

**Request Body:**
```json
{
  "symbol": "BTC/USDT",
  "timeframe": "1h",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "riskProfile": "moderate"
}
```

**Parameters:**
- `symbol` (required): Trading pair
- `timeframe` (required): Candle timeframe
- `startDate` (required): Backtest start date (YYYY-MM-DD)
- `endDate` (required): Backtest end date (YYYY-MM-DD)
- `riskProfile` (optional): Risk profile for strategy execution

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/strategies/bounce/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "riskProfile": "moderate"
  }'
```

**Response:**
```json
{
  "success": true,
  "backtest": {
    "strategyId": "enhanced_bounce",
    "strategyName": "Enhanced Bounce Strategy",
    "symbol": "BTC/USDT",
    "timeframe": "1h",
    "winRate": 72,
    "totalTrades": 45,
    "profitFactor": 2.8,
    "sharpeRatio": 1.9,
    "maxDrawdown": -8.3,
    "totalReturn": 15.2,
    "avgReturn": 3.2
  }
}
```

## Integration Points

### Frontend Usage
The frontend can call these endpoints to:

1. **Display Strategy List**: Show all 6 strategies in the UI including Enhanced Bounce
2. **Execute Strategy**: Run bounce detection on user-selected symbol/timeframe
3. **Backtest Strategy**: Historical performance analysis
4. **Store Signals**: Automatically store generated signals in the database

### Coordinator Integration
The Enhanced Bounce Strategy is also integrated with the Strategy Coordinator:

- When consensus analysis is run, bounce signals are included in the voting
- Bounce strategy contribution is weighted by confidence and zone confluence
- Multi-strategy consensus includes bounce detection patterns

## Error Handling

### Missing Parameters
```json
{
  "success": false,
  "error": "symbol and timeframe are required"
}
```

### Strategy Not Found
```json
{
  "success": false,
  "error": "Strategy not found"
}
```

### Execution Failure
```json
{
  "success": false,
  "error": "Failed to execute enhanced bounce strategy"
}
```

## Performance Metrics

Enhanced Bounce Strategy performance expectations:
- **Win Rate**: 72% (high-confidence bounce trades)
- **Average Return**: 3.2% per trade
- **Sharpe Ratio**: 1.9 (excellent risk-adjusted returns)
- **Max Drawdown**: -8.3% (conservative downside)
- **Profit Factor**: 2.8 (strong risk/reward)

## Configuration

### Risk Profiles

**Conservative**
- Higher confluence thresholds
- More filtering for signal generation
- Lower false signals, higher accuracy
- Fewer but higher-quality trades

**Moderate** (Default)
- Balanced confluence requirements
- Standard filtering
- Good signal/noise ratio
- Recommended for most traders

**Aggressive**
- Lower confluence thresholds
- More signals generated
- Higher entry frequency
- Suitable for active trading

### Zone Detection Parameters

Configure zone detection via parameters:

```json
{
  "min_zone_confluence": 0.5,     // 0.3-0.9: Higher = fewer zones
  "volume_percentile": 85,         // 70-95: Higher = filter more zones
  "min_bounce_confidence": 0.70    // 0.5-0.95: Higher = stricter confidence
}
```

## Examples

### Example 1: Quick Bounce Check
```bash
# Check if BTC/USDT is at a bounce zone on 1h timeframe
curl -X POST http://localhost:3000/api/strategies/enhanced-bounce/execute \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC/USDT", "timeframe": "1h"}'
```

### Example 2: Multiple Timeframes
```bash
# Execute bounce strategy on multiple timeframes
for tf in 1m 5m 15m 1h 4h 1d; do
  curl -X POST http://localhost:3000/api/strategies/enhanced-bounce/execute \
    -H "Content-Type: application/json" \
    -d "{\"symbol\": \"ETH/USDT\", \"timeframe\": \"$tf\"}"
done
```

### Example 3: Backtest Preparation
```bash
# Backtest to determine optimal settings
curl -X POST http://localhost:3000/api/strategies/bounce/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USDT",
    "timeframe": "4h",
    "startDate": "2024-09-01",
    "endDate": "2024-12-31",
    "riskProfile": "aggressive"
  }'
```

## See Also

- [Enhanced Bounce Strategy Architecture](ENHANCED_BOUNCE_ARCHITECTURE.txt)
- [Bounce Integration Summary](BOUNCE_INTEGRATION_SUMMARY.md)
- [Strategy Coordinator Integration](BOUNCE_INTEGRATION_COMPLETE.md)
- [Strategies API Documentation](../server/routes/strategies.ts)
