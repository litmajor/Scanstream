# Feature Flags System Documentation

## Overview

The Feature Flags system provides centralized control over all system features, services, and experimental capabilities. This enables:

- **Easy toggle** of features on/off without code changes
- **Per-environment configuration** via environment variables
- **Runtime adjustment** in development mode
- **Safe rollback** of features without redeployment
- **Feature categorization** for organized management

## Quick Start

### Check Available Flags
```bash
curl http://localhost:5000/api/feature-flags
```

### Enable a Feature
```bash
curl -X POST http://localhost:5000/api/feature-flags/trade_duration_predictor/set \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

### Test Strategy Service
```bash
curl -X POST http://localhost:5000/api/strategies/predict-duration \
  -H "Content-Type: application/json" \
  -d '{
    "cluster_strength": 0.75,
    "trend_formation": true,
    "momentum_score": 0.5,
    "volatility_multiplier": 1.0
  }'
```

## Flag Categories

### 1. Strategy Features
These enable specific trading strategies and decision engines.

| Flag | Default | Description |
|------|---------|-------------|
| `trade_duration_predictor` | OFF | Predict holding period based on cluster strength |
| `pyramid_strategy` | OFF | Add to winning positions using cluster validation |
| `adaptive_holding_period` | OFF | Dynamically adjust position holding based on conditions |
| `regime_aware_trading` | OFF | Adjust parameters based on detected market regime |

### 2. Agent Core Services
Core RPG agent system features.

| Flag | Default | Description |
|------|---------|-------------|
| `agent_lifecycle` | ON | Agent spawning, leveling, and XP system |
| `agent_arena` | ON | Agent voting and consensus voting system |
| `agent_clustering` | ON | Cluster agents into specialist groups |
| `agent_synergy` | OFF | Detect cooperative trading opportunities |
| `agent_achievement_system` | OFF | Track achievements and agent progression |
| `agent_portfolio_manager` | OFF | Portfolio-level agent coordination |

### 3. Agent Abilities
Individual agent specializations and abilities.

| Flag | Default | Description |
|------|---------|-------------|
| `agent_ability_breakout_hunter` | ON | Catch breakout patterns |
| `agent_ability_reversal_master` | ON | Detect and trade reversals |
| `agent_ability_trend_rider` | ON | Follow trending markets |
| `agent_ability_support_sniper` | ON | Trade from support levels |
| `agent_ability_physics_flow` | OFF | Flow field physics analysis |
| `agent_ability_physics_vfmd` | OFF | VFMD physics patterns |
| `agent_ability_ml_oracle` | ON | ML-based predictions |
| `agent_ability_market_oracle` | OFF | Market-wide analysis |
| `agent_ability_volume_verifier` | OFF | Volume-based verification |
| `agent_ability_exit_orchestrator` | OFF | Coordinated exit strategies |
| `agent_ability_opposition_reader` | OFF | Read order flow opposition |
| `agent_ability_microstructure_specialist` | OFF | Analyze market microstructure |
| `agent_ability_feature_engineer` | OFF | Generate trading features |

### 4. RPG System Features
Advanced RPG game mechanics.

| Flag | Default | Description |
|------|---------|-------------|
| `commander_approval` | OFF | Commander approval system for major decisions |
| `daily_briefing` | OFF | Generate daily briefing reports |
| `information_channels` | OFF | Agent communication system |
| `online_learning_system` | OFF | Real-time agent learning and adaptation |

### 5. Analysis Features
Data analysis and model features.

| Flag | Default | Description |
|------|---------|-------------|
| `physics_validation` | ON | Physics-based model validation and scoring |
| `ml_lstm_consensus` | ON | ML LSTM consensus for signal prediction |
| `bayesian_belief_update` | OFF | Bayesian learning system for agent beliefs |
| `flow_field_analytics` | ON | Flow field market structure analysis |
| `cross_exchange_aggregation` | OFF | Aggregate data across multiple exchanges |

### 6. Experimental Features
Advanced features in development.

| Flag | Default | Description |
|------|---------|-------------|
| `advanced_risk_metrics` | OFF | VaR, CVaR and advanced risk calculations |
| `neural_network_signals` | OFF | Neural network based signal generation |
| `portfolio_optimization` | OFF | Portfolio-level optimization algorithms |

### 7. Admin Features
Development and operational tools.

| Flag | Default | Description |
|------|---------|-------------|
| `feature_flag_ui` | OFF | UI dashboard for flag management |
| `debug_logging` | varies | Verbose debug logging for all services |
| `metrics_collection` | ON | Service metrics collection and exposure |

## Environment Variable Configuration

Flags can be overridden via environment variables at startup:

```bash
FEATURE_FLAG_TRADE_DURATION_PREDICTOR=true \
FEATURE_FLAG_PYRAMID_STRATEGY=true \
FEATURE_FLAG_COMMANDER_APPROVAL=true \
npm start
```

Environment variable format: `FEATURE_FLAG_<FLAG_NAME_UPPERCASE>=true|false`

## API Endpoints

### GET /api/feature-flags
List all feature flags with current state.

**Response:**
```json
{
  "timestamp": "2025-12-22T15:30:45.123Z",
  "total": 19,
  "environment": "development",
  "flags": {
    "trade_duration_predictor": {
      "name": "trade_duration_predictor",
      "description": "Predict holding period based on cluster strength...",
      "enabled": false,
      "category": "strategy"
    },
    ...
  }
}
```

### GET /api/feature-flags/:flag
Check if a specific flag is enabled.

**Response:**
```json
{
  "flag": "trade_duration_predictor",
  "enabled": false,
  "description": "Predict holding period based on cluster strength...",
  "category": "strategy"
}
```

### GET /api/feature-flags/category/:category
Get all flags in a category (strategy, service, analysis, experimental, admin).

**Response:**
```json
{
  "category": "strategy",
  "count": 4,
  "flags": { ... }
}
```

### POST /api/feature-flags/:flag/toggle
Toggle a flag on/off (dev-only).

**Response:**
```json
{
  "flag": "trade_duration_predictor",
  "previous_state": false,
  "new_state": true,
  "description": "..."
}
```

### POST /api/feature-flags/:flag/set
Set a flag to a specific state (dev-only).

**Request:**
```json
{ "enabled": true }
```

### POST /api/feature-flags/reload
Reload all flags from environment variables (dev-only).

### POST /api/feature-flags/reset
Reset all flags to defaults (dev-only).

## Strategy Service Endpoints

When feature flags are enabled, strategy services are exposed via HTTP:

### POST /api/strategies/predict-duration
Predict trade duration based on cluster characteristics.

**Request:**
```json
{
  "cluster_strength": 0.75,      // 0-1
  "trend_formation": true,
  "momentum_score": 0.5,          // optional
  "volatility_multiplier": 1.0    // optional
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-12-22T15:30:45.123Z",
  "prediction": {
    "cluster_strength": 0.75,
    "predicted_duration_bars": 25,
    "prediction_confidence": 0.65,
    "management_strategy": "HOLD_AND_SCALE",
    "expected_profit_range": {
      "lower": -1.5,
      "typical": 2.5,
      "upper": 6.0
    },
    "duration_breakdown": [
      {
        "phase": "Entry",
        "bars": 2,
        "expected_action": "Enter, confirm trend"
      },
      ...
    ],
    "reasoning": [...]
  }
}
```

### POST /api/strategies/pyramid-decision
Decide whether to pyramid into a position.

**Request:**
```json
{
  "original_entry_price": 45000,
  "current_price": 45500,
  "original_position_size": 100,
  "cluster_strength": 0.75,
  "trend_formation": true
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-12-22T15:30:45.123Z",
  "decision": {
    "pyramid_recommended": true,
    "pyramid_size": 22,
    "pyramid_ratio": 0.22,
    "new_position_size": 122,
    "new_average_entry": 45091.8,
    "profit_pct": 1.11,
    "reasoning": [...],
    "risk_assessment": {
      "is_safe": true,
      "confidence_level": "high",
      "safety_score": 0.725
    }
  }
}
```

### GET /api/strategies/feature-enabled
List all enabled strategy services.

### GET /api/strategies/compare-durations?cluster_strength=0.75&trend_formation=true
Compare conservative, base case, and optimistic duration scenarios.

## Implementation Guide

### Using Flags in Services

```typescript
import { isFeatureEnabled, FLAGS } from '../config/featureFlags';

export function decideStrategy(signal: Signal): Decision {
  // Check flag before using service
  if (isFeatureEnabled(FLAGS.TRADE_DURATION_PREDICTOR)) {
    const predictor = getTradeDurationPredictor();
    const duration = predictor.predictDuration(...);
    // Use duration in decision logic
  }

  // Fallback if feature disabled
  return defaultDecision();
}
```

### Using Strategy Registry

```typescript
import { getTradeDurationPredictor, getPyramidStrategy } from '../services/strategy-registry';

// Services return null if feature is disabled
const predictor = getTradeDurationPredictor();
if (predictor) {
  const prediction = predictor.predictDuration(...);
}

// Alternative: check flag first
import { isStrategyAvailable } from '../services/strategy-registry';
if (isStrategyAvailable('pyramid')) {
  const strategy = getPyramidStrategy();
  const decision = strategy.decidePyramid(...);
}
```

### Creating New Flags

1. Add flag to `DEFAULT_FLAGS` in `server/config/featureFlags.ts`
2. Add constant to `FLAGS` export for type safety
3. Use `isFeatureEnabled()` checks in code
4. Register service in `strategy-registry.ts` if applicable
5. Document in this README

## Best Practices

1. **Default to OFF for experimental features** - Conservative approach prevents bugs
2. **Use FLAGS constants** - Provides type safety and prevents typos
3. **Document default state** - Make assumptions clear
4. **Test with flags ON and OFF** - Ensure fallbacks work
5. **Include timeout handling** - Services might be slow if unoptimized
6. **Log flag state changes** - Helps debug production issues
7. **Version flag configs** - Track when flags were added/changed

## Common Workflows

### Enable all strategies for testing
```bash
curl -X POST http://localhost:5000/api/feature-flags/trade_duration_predictor/set \
  -H "Content-Type: application/json" -d '{"enabled": true}'

curl -X POST http://localhost:5000/api/feature-flags/pyramid_strategy/set \
  -H "Content-Type: application/json" -d '{"enabled": true}'
```

### Enable all experimental features
```bash
curl -X POST http://localhost:5000/api/feature-flags/advanced_risk_metrics/set \
  -H "Content-Type: application/json" -d '{"enabled": true}'

curl -X POST http://localhost:5000/api/feature-flags/neural_network_signals/set \
  -H "Content-Type: application/json" -d '{"enabled": true}'

curl -X POST http://localhost:5000/api/feature-flags/portfolio_optimization/set \
  -H "Content-Type: application/json" -d '{"enabled": true}'
```

### Test specific strategy
```bash
# Enable feature
curl -X POST http://localhost:5000/api/feature-flags/trade_duration_predictor/set \
  -H "Content-Type: application/json" -d '{"enabled": true}'

# Call endpoint
curl -X POST http://localhost:5000/api/strategies/predict-duration \
  -H "Content-Type: application/json" \
  -d '{"cluster_strength": 0.8, "trend_formation": true}'

# Compare scenarios
curl "http://localhost:5000/api/strategies/compare-durations?cluster_strength=0.8&trend_formation=true"
```

## Troubleshooting

### Feature flag endpoint returns 403 (Production mode)
Feature flag toggling is disabled in production. Use environment variables instead.

### Strategy endpoint returns 403 (Feature disabled)
Check flag status: `curl http://localhost:5000/api/feature-flags/<flag_name>`

Then enable: `curl -X POST http://localhost:5000/api/feature-flags/<flag_name>/set -d '{"enabled": true}'`

### Flag not overriding from environment variable
Ensure environment variable format is correct: `FEATURE_FLAG_FLAG_NAME=true|false` (not `FEATURE_FLAG_flag-name`)

Restart server after setting environment variables.
