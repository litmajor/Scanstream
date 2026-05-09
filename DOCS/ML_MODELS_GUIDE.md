# ML Models Training Guide

## Overview

Your system has **two separate ML training systems** that serve different purposes:

1. **Python ML Pipeline** (`train_models.py`) - XGBoost models for signal prediction
2. **TypeScript ML Engine** (`server/ml-engine.ts`) - Simple neural network for signal enhancement

---

## 1. Python ML Training System (`train_models.py`)

### What Models Can Be Trained Here?

Currently trains **XGBoost models** for two purposes:

#### A. Return Prediction Model
- **Type**: XGBoost Regressor
- **Purpose**: Predict price returns for different timeframes
- **Features**: 
  - Momentum indicators
  - RSI, MACD, BB, Volume ratios
  - Composite scores and trend indicators
- **Output**: Predicted return percentage

#### B. Signal Consistency Model
- **Type**: XGBoost Classifier
- **Purpose**: Predict signal consistency across timeframes
- **Features**: Same as above
- **Output**: Binary (consistent/inconsistent)

### How to Add More Models

You can extend `train_models()` function to train additional models:

```python
def train_additional_models(df: pd.DataFrame, timeframe: str):
    """
    Train additional ML models for different purposes.
    """
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.neural_network import MLPRegressor
    import lightgbm as lgb
    
    features = [
        'momentum_short', 'momentum_long', 'rsi', 'macd', 
        'volume_ratio', 'composite_score'
    ]
    
    # 1. Random Forest for volatility prediction
    model_volatility = RandomForestRegressor(n_estimators=100)
    y_volatility = df['volatility']  # Calculate from price data
    model_volatility.fit(df[features], y_volatility)
    model_volatility.save_model(f'model_volatility_{timeframe}.json')
    
    # 2. LightGBM for trend prediction
    model_trend = lgb.LGBMRegressor()
    y_trend = df['trend_direction']  # 1 for up, -1 for down
    model_trend.fit(df[features], y_trend)
    model_trend.save_model(f'model_trend_{timeframe}.txt')
    
    # 3. Neural Network for complex pattern recognition
    model_nn = MLPRegressor(hidden_layer_sizes=(100, 50), max_iter=1000)
    y_return = df[f'{timeframe}_return']
    model_nn.fit(df[features], y_return)
    # Save using joblib or pickle
    import joblib
    joblib.dump(model_nn, f'model_nn_{timeframe}.pkl')
```

### Supported Model Types

You can train:
- ✅ **XGBoost** (regression/classification)
- ✅ **Random Forest** (regression/classification)
- ✅ **LightGBM** (regression/classification)
- ✅ **CatBoost** (regression/classification)
- ✅ **Neural Networks** (MLP, LSTM via libraries like Keras)
- ✅ **SVM** (support vector machines)
- ✅ **Logistic Regression** (classification)

### Where Models Are Saved

Models are saved as JSON files:
- `model_return_{timeframe}.json` - Return prediction
- `model_consistent_{timeframe}.json` - Signal consistency

---

## 2. TypeScript ML Training System (`server/ml-engine.ts`)

### What Models Can Be Trained Here?

Currently implements a **simple linear neural network**:

#### SimpleMLModel
- **Type**: Linear model with gradient descent
- **Purpose**: Enhance trading signals with ML predictions
- **Features**: Price, volume, technical indicators, order flow, market microstructure
- **Output**: Direction (UP/DOWN/NEUTRAL) with confidence

### How to Extend This System

You can add more sophisticated models in TypeScript:

```typescript
// server/ml-engine.ts

export class LSTMModel implements MLModel {
  private model: any; // TensorFlow.js or similar
  
  async train(data: MarketFrame[]): Promise<void> {
    // Implement LSTM training with TensorFlow.js
    // See: https://www.tensorflow.org/js
  }
  
  predict(features: number[]): MLPrediction {
    // LSTM prediction
  }
}

export class RandomForestModel implements MLModel {
  private trees: DecisionTree[] = [];
  
  async train(data: MarketFrame[]): Promise<void> {
    // Implement Random Forest in TypeScript
  }
  
  predict(features: number[]): MLPrediction {
    // Ensemble prediction
  }
}
```

### Where ML Engine Models Are Used

- **Signal Enhancement**: `MLSignalEnhancer` class enhances trading signals
- **Real-time Prediction**: Used during live trading
- **Feature Importance**: Calculates feature weights

---

## 3. ML Engine Frontend (`client/src/pages/ml-engine.tsx`)

### What's Displayed?

The frontend shows:
- **Model Status**: Trained, training, failed
- **Model Accuracy**: Percentage
- **Predictions**: Next hour, day, week prices
- **Feature Importance**: Which indicators matter most
- **Performance Metrics**: Total predictions, accuracy, confidence

### How to Connect to Backend

Currently uses **mock data**. To connect to real training:

```typescript
// In ml-engine.tsx

const { data: mlData, isLoading, error, refetch } = useQuery({
  queryKey: ['ml-data'],
  queryFn: async () => {
    const response = await fetch('/api/ml/models');
    return response.json();
  },
  refetchInterval: 10000,
});
```

Add backend endpoint in `server/routes.ts`:

```typescript
app.get('/api/ml/models', async (req, res) => {
  // Return trained models from Python or TypeScript
  res.json({
    models: [
      {
        id: '1',
        name: 'BTC Price Predictor',
        type: 'XGBoost',
        accuracy: 87.3,
        status: 'trained',
        // ... load from saved model files
      }
    ]
  });
});
```

---

## 4. Recommended Model Architecture

### For Python (`train_models.py`)

```
train_models.py
├── XGBoost Return Predictor
│   └── Used by: Strategy execution, backtesting
├── XGBoost Signal Consistency
│   └── Used by: Signal filtering, trade execution
├── Random Forest Volatility Predictor
│   └── Used by: Risk management, position sizing
└── LSTM Price Predictor
    └── Used by: Medium-term predictions
```

### For TypeScript (`server/ml-engine.ts`)

```
server/ml-engine.ts
├── Simple Linear Model
│   └── Used by: Real-time signal enhancement
├── Neural Network (future)
│   └── Used by: Complex pattern recognition
└── Ensemble Model (future)
    └── Used by: Combined predictions
```

---

## 5. How to Train New Models

### Option A: Add to Python Training Pipeline

1. **Create new training function**:

```python
def train_volatility_model(df: pd.DataFrame, timeframe: str):
    """Train model to predict volatility."""
    features = ['momentum_short', 'rsi', 'macd', 'volume_ratio']
    
    # Calculate volatility
    df['volatility'] = df['price'].rolling(window=20).std()
    
    # Train Random Forest
    from sklearn.ensemble import RandomForestRegressor
    model = RandomForestRegressor(n_estimators=100)
    model.fit(df[features], df['volatility'])
    
    # Save model
    model.save_model(f'model_volatility_{timeframe}.json')
    
    return model
```

2. **Call it in `main()`**:

```python
async def main():
    config = get_dynamic_config()
    dfs = await prepare_data(config)
    
    for tf, df in dfs.items():
        # Existing models
        model_return, model_consistent = train_models(df, tf)
        
        # New models
        model_volatility = train_volatility_model(df, tf)
```

### Option B: Add to TypeScript ML Engine

1. **Implement new model class**:

```typescript
export class VolatilityPredictor implements MLModel {
  predict(features: number[]): MLPrediction {
    // Implementation
  }
  
  async train(data: MarketFrame[]): Promise<void> {
    // Implementation
  }
  
  getFeatureImportance(): Record<string, number> {
    // Implementation
  }
}
```

2. **Use in MLSignalEnhancer**:

```typescript
export class MLSignalEnhancer {
  private model: MLModel;
  private volatilityModel: VolatilityPredictor;
  
  // Use both models for enhanced predictions
}
```

---

## 6. Integration with Strategy Execution

Models trained in `train_models.py` can be used by the execution engine:

```python
# In train_models.py

from xgboost import XGBRegressor

# Load trained model
return_model = XGBRegressor()
return_model.load_model('model_return_1h.json')

# Use in strategy execution
def predict_entry_exit(symbol, features):
    predicted_return = return_model.predict([features])[0]
    
    if predicted_return > 0.05:  # 5% expected return
        return "BUY"
    elif predicted_return < -0.05:
        return "SELL"
    else:
        return "HOLD"

# Integrate with StrategyExecutionEngine
engine = StrategyExecutionEngine()
if predict_entry_exit("BTC/USDT", features) == "BUY":
    engine.create_order(/* order parameters */)
```

---

## 7. Model Storage & Loading

### Python Models
- **Format**: JSON (XGBoost), PKL (scikit-learn)
- **Location**: Project root or `models/` directory
- **Loading**: Use model's `load_model()` or `pickle.load()`

### TypeScript Models
- **Format**: JavaScript objects in memory
- **Persistence**: Store weights in database or files
- **Loading**: Deserialize from JSON or database

---

## 8. Best Practices

1. **Model Versioning**: Track model versions and performance
2. **A/B Testing**: Compare old vs new models
3. **Backtesting**: Test models on historical data before live use
4. **Monitoring**: Track model performance in production
5. **Retraining**: Schedule regular model updates

---

## Summary

- **Python (`train_models.py`)**: Use for complex models (XGBoost, LSTM, ensemble)
- **TypeScript (`server/ml-engine.ts`)**: Use for real-time, lightweight models
- **Both can coexist**: Python for training, TypeScript for inference
- **Frontend (`ml-engine.tsx`)**: Display model status and predictions

You can add new models to either system depending on your needs. Python is better for complex ML, TypeScript is better for real-time integration.
