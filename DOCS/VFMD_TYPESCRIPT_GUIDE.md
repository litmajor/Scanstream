/**
 * VFMD Physics System - Early Entry Detection Engine
 * 
 * Comprehensive ported TypeScript implementation of Python VFMD (Vector Field Market Dynamics)
 * with early entry specialization for the RPG agent system.
 */

# VFMD System Overview

## What is VFMD?

VFMD (Vector Field Market Dynamics) analyzes market price and volume data as a **vector field**—
mapping price levels (spatial dimension) across time (temporal dimension).

Rather than looking at prices linearly, VFMD treats the market as a continuous flow of forces:
- **Velocity**: Price changes per bar (momentum)
- **Acceleration**: Changes in velocity (changing momentum)
- **Divergence**: Where orders accumulate (sources) or dissipate (sinks)
- **Curl**: Rotational chaos (choppy vs trending)
- **Pressure**: Built-up energy before directional release

## Core Modules

### 1. **fieldConstructor.ts**
Builds the vector field from price/volume ticks.

```typescript
const constructor = new FieldConstructor(
  50,    // spatial bins (price levels)
  100,   // temporal window (bars to analyze)
  2.0    // smoothing sigma (gaussian blur)
);

const field = constructor.constructField(prices);
// Returns: VectorField {
//   data: number[][][],           // 3D array [spatial, temporal, 2 components]
//   spatialBins, temporalWindow,
//   priceMin, priceMax
// }
```

**FieldAnalyzer** provides operations:
- `computeGradientMagnitude(field)` → Shows regions of high force concentration
- `computeDivergence(field)` → Positive = accumulation, Negative = distribution
- `computeCurl(field)` → Vorticity / rotational chaos

### 2. **physicsCalculator.ts**
Computes physics metrics from the field.

```typescript
const metrics = PhysicsCalculator.computeAllMetrics(field);
// Returns: PhysicsMetrics {
//   peg,                 // Potential Energy Gradient (stored energy)
//   turbulenceIndex,     // Chaos/instability in flow
//   coherenceScore,      // How aligned is the field? (0-1)
//   dominantAngle,       // Direction in radians
//   divergenceScore,     // Accumulation bias
//   recentDivergence,    // Recent sources/sinks
//   curlScore,           // Vorticity magnitude
//   recentCurl,          // Recent rotational chaos
//   gradientMagnitude    // Peak gradient strength
// }
```

### 3. **earlyEntryDetector.ts** ⭐ (SPECIALIZED)
**Detects high-probability early entry opportunities** by analyzing field state.

```typescript
const detector = new EarlyEntryDetector();
const signal = detector.analyzeForEntry(ticks);

// Returns: EarlyEntrySignal {
//   type: 'bullish' | 'bearish' | 'neutral',
//   confidence: 0-1,
//   strength: 0-1,
//   volatilityRegime: 'low' | 'medium' | 'high',
//   imbalanceScore: -1 to +1,         // Buy vs sell pressure
//   pressureGradient: -1 to +1,       // Rate of energy change
//   flowMomentum: -1 to +1,           // Directional momentum
//   suggestedEntry, suggestedTarget, suggestedStop,
//   reason: string,
//   factors: string[]
// }
```

## Early Entry Detection Logic

The **VFMDPhysicsAgent** triggers signals when multiple conditions align:

### **BULLISH Setup**
```
✓ Positive divergence (accumulation)       [recentDivergence > 0.05]
✓ Clean flow (low turbulence)              [turbulenceIndex < 1.5]
✓ Building buy pressure                    [imbalanceScore > 0.1]
✓ Energy accelerating                      [pressureGradient > 0]
✓ Not in panic (low volatility)            [volatilityRegime ≠ 'high']
```

### **BEARISH Setup**
```
✓ Negative divergence (distribution)       [recentDivergence < -0.05]
✓ Clean flow (low turbulence)              [turbulenceIndex < 1.5]
✓ Building sell pressure                   [imbalanceScore < -0.1]
✓ Energy accelerating downward             [pressureGradient > 0]
✓ Not in panic (low volatility)            [volatilityRegime ≠ 'high']
```

## API Endpoints

All endpoints available at `/api/agents/physics/`

### **POST /vfmd-analyze**
Analyze market for early entries using VFMD system.

**Request:**
```json
{
  "symbol": "BTC/USDT"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "signal": {
      "type": "bullish",
      "confidence": "78.5%",
      "strength": "65.2%",
      "recommendation": "Early accumulation detected - bullish setup"
    },
    "entry_guidance": {
      "suggested_entry": "42500.50",
      "profit_target": "43800.00",
      "stop_loss": "41900.00",
      "risk_reward": "2.45"
    },
    "field_metrics": {
      "coherence": "72.3%",
      "peg_energy": "0.0845",
      "turbulence_index": "0.89",
      "divergence": "0.0623",
      "curl": "0.0012",
      "gradient_magnitude": "0.1234"
    },
    "market_state": {
      "volatility_regime": "medium",
      "imbalance_score": "34.2%",
      "pressure_gradient": "12.5%",
      "flow_momentum": "58.3%"
    },
    "factors": [
      "High energy accumulation (PEG=0.0845)",
      "Clean directional flow",
      "Strong buy pressure building",
      "Energy accelerating upward",
      "Highly coherent directional flow"
    ]
  },
  "agentLevel": 1,
  "agentName": "VFMD-Analyst",
  "timestamp": "2025-12-08T14:30:00.000Z",
  "dataPoints": 200
}
```

### **POST /flow-analyze**
Analyze using Flow Field engine (complementary approach).

### **POST /compare**
Run both VFMD and Flow agents on same data, get consensus signals.

### **GET /agents**
List available physics agents and capabilities.

### **GET /status**
Health check and agent status.

## Integration with RPG Agents

Both agents extend `TradingAgent` and integrate with the RPG system:

```typescript
import VFMDPhysicsAgent from './server/services/rpg-agents/VFMDPhysicsAgent';
import { AgentSpawner } from './server/services/rpg-agents/AgentSpawner';

const vfmd = new VFMDPhysicsAgent('VFMD-Scout');

// Analyze ticks
const signal = vfmd.generateSignal(ticks);
console.log(signal);
// AgentSignal {
//   action: 'BUY',
//   confidence: 0.785,
//   entry: 42500.50,
//   target: 43800.00,
//   stop: 41900.00,
//   reason: 'Early accumulation detected - bullish setup'
// }

// Access detailed analysis
const analysis = vfmd.getAnalysisForUI(ticks);
// Includes all metrics, factors, and interpretable output
```

## Specialization: Early Entry Focus

Unlike general signal generators, VFMD specializes in **identifying entries BEFORE major moves**:

1. **Divergence Detection**: Spots when order flow begins accumulating (sources) or distributing (sinks)
2. **Coherence Analysis**: Ensures directional alignment before entering
3. **Pressure Gradient**: Triggers on accelerating energy, not just absolute levels
4. **Imbalance Scoring**: Quantifies buy vs sell pressure on 0-1 scale
5. **Volatility Regime**: Filters out panic conditions where early entries fail

## Data Requirements

- **Minimum 100 bars** for reliable field construction
- **Recommended 200+ bars** for stable metrics
- **OHLCV data** (Open, High, Low, Close, Volume) required
- **Order flow data** optional but improves imbalance scoring

## Performance & Tuning

Field parameters can be adjusted per market:

```typescript
// More granular price levels (better for low-volatility assets)
const fineTuned = new FieldConstructor(
  100,  // More spatial bins
  150,  // Longer temporal window
  1.5   // Less smoothing
);

// Simpler field (better for high-volatility assets)
const robust = new FieldConstructor(
  30,   // Fewer bins
  80,   // Shorter window
  3.0   // More smoothing
);
```

## Files

```
server/services/vfmd/
├── types.ts                 # TypeScript interfaces
├── fieldConstructor.ts      # Field construction & analysis
├── physicsCalculator.ts     # Physics metrics (PEG, TI, coherence)
└── earlyEntryDetector.ts    # ⭐ Early entry specialization

server/services/rpg-agents/
├── VFMDPhysicsAgent.ts      # RPG agent wrapper (full system)
└── FlowPhysicsAgent.ts      # Complementary flow agent

server/routes/
└── physics-agents.ts        # API endpoints
```

## Example Usage

```typescript
// Create agent
const vfmd = new VFMDPhysicsAgent('EarlyBird', 'aggressive');

// Get recent data from storage
const frames = await storage.getMarketFrames('BTC/USDT', 200);
const ticks = frames.map(frame => ({
  timestamp: new Date(frame.timestamp).getTime(),
  open: frame.price.open,
  high: frame.price.high,
  low: frame.price.low,
  close: frame.price.close,
  volume: frame.volume
}));

// Analyze for early entry
const signal = vfmd.generateSignal(ticks);
console.log(`Signal: ${signal.action} @ ${signal.entry} → ${signal.target}`);

// Get detailed UI-ready analysis
const analysis = vfmd.getAnalysisForUI(ticks);
console.log(JSON.stringify(analysis, null, 2));
```

## Next Steps

- **Backtest**: Use `/api/agents/physics/vfmd-analyze` endpoint with historical data
- **Paper Trade**: Generate signals live and track performance
- **Optimize**: Tune field parameters (spatial bins, temporal window) per asset
- **Enhance**: Add multi-timeframe analysis by running detector on multiple scales
- **Learn**: Agent levels up as it generates accurate signals, unlocking advanced abilities

---

**Built for Scanstream RPG Agent System**  
*Vector Field Market Dynamics - Early Entry Specialization*
