# ARM Template Application Guide

## Quick Start: Applying ARM to Your Signal Modules

This guide shows **exactly how** to convert any existing signal generator to use the ARM template.

---

## 1. Momentum Module Example

### Before (Original)
```typescript
// server/strategies/momentum-strategy.ts

export function generateMomentumSignal(data: MarketData): Signal {
  const rsi = calculateRSI(data.closes, 14);
  const macd = calculateMACD(data.closes);

  if (rsi > 70 && macd.histogram > 0) {
    return { type: 'SELL', confidence: 0.7 };
  }

  if (rsi < 30 && macd.histogram < 0) {
    return { type: 'BUY', confidence: 0.7 };
  }

  return { type: 'HOLD', confidence: 0.1 };
}
```

### After (ARM-enabled)
```typescript
// server/strategies/momentum-strategy.ts
import { 
  generateModuleSignal, 
  ArmInputs, 
  getModuleState 
} from '../lib/arm-signal-template';

const MODULE_NAME = 'momentum';

export function generateMomentumSignal(data: MarketData): Signal {
  const rsi = calculateRSI(data.closes, 14);
  const macd = calculateMACD(data.closes);
  const rsiSeries = data.closes.slice(-20).map((_, i) => calculateRSI(data.closes.slice(0, i + 1), 14));
  const macdHistSeries = data.closes.slice(-20).map((_, i) => calculateMACD(data.closes.slice(0, i + 1)).histogram);

  // Prepare ARM inputs
  const armInputs: ArmInputs = {
    rsi,
    macdHistogram: macd.histogram,
    rsiSeries,
    macdHistogramSeries: macdHistSeries,
    rsiPercentile: (rsi / 100) * 100, // 0-100 scale
    moduleScore: rsi < 30 ? -0.6 : rsi > 70 ? 0.6 : 0, // module-specific score
    moduleStrength: Math.abs(macd.histogram) * 100
  };

  // Volume gate
  const volumeGate = data.volume > data.volumeAverage * 0.8;

  // Confirmation logic for this module
  const confirmationLogic = {
    shouldConfirmLong: (inputs: ArmInputs) => 
      (inputs.rsi ?? 50) > 50 && 
      (inputs.macdHistogram ?? 0) >= 0,
    shouldConfirmShort: (inputs: ArmInputs) => 
      (inputs.rsi ?? 50) < 50 && 
      (inputs.macdHistogram ?? 0) <= 0
  };

  return generateModuleSignal(
    MODULE_NAME,
    armInputs,
    volumeGate,
    confirmationLogic
  );
}
```

**What changed:**
1. Import ARM template functions
2. Extract indicator series (for slope calculation)
3. Prepare `ArmInputs` object
4. Check volume gate condition
5. Define module-specific confirmation logic
6. Call `generateModuleSignal()` instead of manual logic

---

## 2. Flow Field Module Example

### Before (Original)
```typescript
// server/strategies/flow-field.ts

export function generateFlowSignal(flowData: FlowMetrics): Signal {
  const flowScore = flowData.dominance === 'BULLISH' ? 1 : -1;
  const force = flowData.force / 100;

  if (flowScore > 0 && force > 0.7) {
    return { type: 'BUY', confidence: force };
  }

  if (flowScore < 0 && force > 0.7) {
    return { type: 'SELL', confidence: force };
  }

  return { type: 'HOLD', confidence: 0.2 };
}
```

### After (ARM-enabled)
```typescript
// server/strategies/flow-field.ts
import { 
  generateModuleSignal, 
  ArmInputs 
} from '../lib/arm-signal-template';

const MODULE_NAME = 'flow-field';

export function generateFlowSignal(flowData: FlowMetrics): Signal {
  const flowScore = flowData.dominance === 'BULLISH' ? 0.8 : -0.8;
  const forceNorm = flowData.force / 100;

  // ARM inputs specific to flow module
  const armInputs: ArmInputs = {
    moduleScore: flowScore * forceNorm, // scaled by force intensity
    moduleStrength: Math.abs(flowScore * forceNorm) * 100,
    
    // Optional: if we have historical flow data
    momentumSeries: flowData.historicalForce?.slice(-10) || [forceNorm]
  };

  // Volume gate (if available)
  const volumeGate = flowData.volumeContext !== 'DEPLETED';

  // Flow-specific confirmation: momentum must be accelerating
  const confirmationLogic = {
    shouldConfirmLong: () => 
      flowData.dominance === 'BULLISH' && 
      flowData.energyTrend === 'ACCELERATING' &&
      flowData.force > 75,
    shouldConfirmShort: () => 
      flowData.dominance === 'BEARISH' && 
      flowData.energyTrend === 'ACCELERATING' &&
      flowData.force > 75
  };

  return generateModuleSignal(
    MODULE_NAME,
    armInputs,
    volumeGate,
    confirmationLogic
  );
}
```

---

## 3. Physics/Gradient Module Example

### Before (Original)
```typescript
// server/strategies/physics-gradient.ts

export function generatePhysicsSignal(gradient: GradientData): Signal {
  if (gradient.value > 0.2 && gradient.strength > 70) {
    return { type: 'BUY', confidence: 0.8 };
  }

  if (gradient.value < -0.2 && gradient.strength > 70) {
    return { type: 'SELL', confidence: 0.8 };
  }

  return { type: 'HOLD', confidence: 0.3 };
}
```

### After (ARM-enabled)
```typescript
// server/strategies/physics-gradient.ts
import { 
  generateModuleSignal, 
  ArmInputs 
} from '../lib/arm-signal-template';

const MODULE_NAME = 'physics-gradient';

export function generatePhysicsSignal(gradient: GradientData): Signal {
  // ARM inputs for physics module
  const armInputs: ArmInputs = {
    moduleScore: gradient.value,        // -1 to 1 directional score
    moduleStrength: gradient.strength,  // 0 to 100
    
    // If tracking gradient history
    momentumSeries: gradient.history?.map(g => g.value).slice(-10) || [gradient.value]
  };

  // Physics module always has data quality (no volume gate needed)
  const volumeGate = true;

  // Physics-specific confirmation
  const confirmationLogic = {
    shouldConfirmLong: () =>
      gradient.value > 0.35 &&          // strong bullish gradient
      gradient.strength > 70 &&         // high confidence
      !gradient.trendShiftDetected,     // no reversals
    shouldConfirmShort: () =>
      gradient.value < -0.35 &&
      gradient.strength > 70 &&
      !gradient.trendShiftDetected
  };

  return generateModuleSignal(
    MODULE_NAME,
    armInputs,
    volumeGate,
    confirmationLogic
  );
}
```

---

## 4. Multi-Module Aggregation Example

### Before (Original - Voting/Simple Average)
```typescript
// server/signal-aggregator.ts

export function aggregateSignals(signals: Signal[]): Signal {
  const buys = signals.filter(s => s.type === 'BUY').length;
  const sells = signals.filter(s => s.type === 'SELL').length;

  if (buys > sells) {
    const avgConfidence = signals
      .filter(s => s.type === 'BUY')
      .reduce((sum, s) => sum + s.confidence, 0) / buys;
    return { type: 'BUY', confidence: avgConfidence };
  }

  if (sells > buys) {
    const avgConfidence = signals
      .filter(s => s.type === 'SELL')
      .reduce((sum, s) => sum + s.confidence, 0) / sells;
    return { type: 'SELL', confidence: avgConfidence };
  }

  return { type: 'HOLD', confidence: 0.1 };
}
```

### After (ARM-aware Aggregation)
```typescript
// server/signal-aggregator.ts
import { 
  aggregateSignals as armAggregate,
  Signal 
} from '../lib/arm-signal-template';

export function aggregateSignals(signals: Signal[]): Signal {
  // Use ARM template aggregation with custom options
  return armAggregate(signals, {
    requireConfirmation: false,      // allow ARM signals
    requireMultipleModules: 1,       // any module can trigger
    armBoost: true                   // boost confidence when multiple modules agree
  });
}

// Example: Stricter aggregation for live trading
export function aggregateSignalsStrict(signals: Signal[]): Signal {
  return armAggregate(signals, {
    requireConfirmation: true,       // only BUY/SELL, no ARM
    requireMultipleModules: 2,       // need 2+ modules
    armBoost: false                  // no ARM boost
  });
}

// Example: Observation mode (show all ARM signals)
export function aggregateSignalsObservation(signals: Signal[]): Signal {
  return armAggregate(signals, {
    requireConfirmation: false,      // accept any signal
    requireMultipleModules: 1,       // single module sufficient
    armBoost: true                   // highlight aligned ARMs
  });
}
```

---

## 5. Integration Pattern

### In Your Main Signal Pipeline

```typescript
// server/routes/gateway.ts

import { 
  generateMomentumSignal 
} from '../strategies/momentum-strategy';
import { 
  generateFlowSignal 
} from '../strategies/flow-field';
import { 
  generatePhysicsSignal 
} from '../strategies/physics-gradient';
import { 
  aggregateSignals,
  signalToAction 
} from '../lib/arm-signal-template';

async function generateCompleteSignal(symbol: string): Promise<Signal> {
  const marketData = await fetchMarketData(symbol);
  const flowData = await fetchFlowData(symbol);
  const gradientData = await fetchGradientData(symbol);

  // Generate signals from all modules (all ARM-enabled)
  const signals = [
    generateMomentumSignal(marketData),
    generateFlowSignal(flowData),
    generatePhysicsSignal(gradientData)
  ];

  // Aggregate using ARM template
  const finalSignal = aggregateSignals(signals);

  // Convert to actionable trading decision
  const action = signalToAction(finalSignal);

  return {
    ...finalSignal,
    action: action.action,
    tradingReasoning: action.reasoning
  };
}
```

### API Response
```json
{
  "symbol": "BTC/USDT",
  "type": "ARM_LONG",
  "armReason": "MOMENTUM_DECAY",
  "confidence": 0.35,
  "armTicks": 2,
  "module": "momentum+flow-field",
  "action": "WAIT",
  "tradingReasoning": "Pressure shift detected (MOMENTUM_DECAY). Waiting for confirmation.",
  "reasoning": [
    "ARM alignment: 2 modules agree on pressure shift",
    "Average ticks: 2.0"
  ]
}
```

---

## 6. Testing Checklist

After converting a module to ARM:

- [ ] Module imports ARM template correctly
- [ ] `ArmInputs` populated with all relevant indicator data
- [ ] Volume gate condition evaluated
- [ ] Confirmation logic matches module's trading rules
- [ ] Signal type is one of: BUY | SELL | HOLD | ARM_LONG | ARM_SHORT
- [ ] Confidence value is 0-1 range
- [ ] ARM confidence capped at 0.5 (automatically handled)
- [ ] BUY/SELL confidence >= 0.4
- [ ] `reasoning` array populated with diagnostic messages
- [ ] No TypeScript errors
- [ ] Signal flows through aggregator correctly

---

## 7. Migration Checklist for Entire System

1. **Week 1**: Update momentum module
2. **Week 2**: Update flow field module
3. **Week 3**: Update physics/gradient module
4. **Week 4**: Update secondary modules (if any)
5. **Week 5**: Test aggregation across all modules
6. **Week 6**: Deploy to production
7. **Week 7-8**: Monitor ARM vs BUY/SELL ratio (target 2-3:1)

---

## 8. Key Benefits

| Before | After |
|--------|-------|
| HOLD → BUY (abrupt) | HOLD → ARM → BUY (gradual) |
| No ARM persistence | ARM persists, confidence ramps |
| Blind to pressure shifts | Detects formation 1-3 candles early |
| Module-specific logic | Unified ARM across all modules |
| Hard to aggregate | Template-friendly aggregation |
| Confidence not binding | Confidence gates signal type |

---

## 9. Support Function Reference

### Core Functions

```typescript
// Detect ARM conditions
detectArm(inputs: ArmInputs): ArmDetectionResult

// Main signal generation
generateModuleSignal(
  moduleName: string,
  armInputs: ArmInputs,
  volumeGate: boolean,
  confirmationLogic?: ConfirmationLogic
): Signal

// Aggregate multiple module signals
aggregateSignals(
  signals: Signal[],
  options?: AggregationOptions
): Signal

// Convert to trading action
signalToAction(signal: Signal): TradingAction

// Utilities
slope(values: number[]): number
getModuleState(moduleId: string): ModuleState
resetModuleState(moduleId: string): void
```

---

## Example: Step-by-Step Conversion

### Original Module
```typescript
export function mySignal(data: Data): Signal {
  if (condition) return { type: 'BUY', confidence: 0.8 };
  if (opposite) return { type: 'SELL', confidence: 0.8 };
  return { type: 'HOLD', confidence: 0.1 };
}
```

### Step 1: Import template
```typescript
import { generateModuleSignal, ArmInputs } from '../lib/arm-signal-template';
```

### Step 2: Extract indicator series
```typescript
const indicator = calculateIndicator(data.closes);
const series = data.closes.map((c, i) => calculateIndicator(data.closes.slice(0, i+1)));
```

### Step 3: Build ArmInputs
```typescript
const armInputs: ArmInputs = {
  moduleScore: score,
  moduleStrength: strength,
  [indicator]Series: series
};
```

### Step 4: Check volume
```typescript
const volumeGate = data.volume > threshold;
```

### Step 5: Define confirmation
```typescript
const confirmationLogic = {
  shouldConfirmLong: (inputs) => condition,
  shouldConfirmShort: (inputs) => opposite
};
```

### Step 6: Replace logic
```typescript
return generateModuleSignal('mymodule', armInputs, volumeGate, confirmationLogic);
```

Done! Now your module is ARM-enabled.
