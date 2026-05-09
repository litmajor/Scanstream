# Enhanced Bounce Strategy - Quick Reference

## 🚀 Quick Start

### Option 1: Direct Executor Use
```bash
python strategies/executor.py \
  --strategy enhanced_bounce \
  --symbol BTC/USDT \
  --timeframe 1h \
  --params '{"risk_profile":"moderate"}'
```

### Option 2: Bridge Integration
```python
from strategies.bounce_bridge import BounceStrategyBridge

bridge = BounceStrategyBridge(risk_profile='moderate')
signal = bridge.generate_signal(df_dict, current_price, '1h')
consensus_vote = bridge.get_consensus_contribution(signal)
```

### Option 3: Direct Strategy Use
```python
from strategies.enhanced_bounce_strategy import EnhancedBounceStrategy

strategy = EnhancedBounceStrategy(risk_profile='moderate')
result = strategy.evaluate(df_dict, current_price)
print(f"Signal: {result['signal']}")
print(f"Confidence: {result['confidence']:.1%}")
```

---

## 📊 Output Format

### Executor Output (JSON)
```json
{
  "success": true,
  "signal": "BUY",
  "price": 42500.50,
  "timestamp": "2025-12-04T10:30:00",
  "metadata": {
    "bounce_confidence": 0.82,
    "bounce_strength": 0.75,
    "bounce_detected": true,
    "zone_confluence": 0.67,
    "zone_price": 42100.00,
    "quality_reasons": [
      "Price near support",
      "Volume spike: 2.3x",
      "Price recovery: 2.45%"
    ]
  },
  "data_points": 500
}
```

### Strategy Direct Output
```python
{
    'signal': 'BUY',
    'strength': 0.75,
    'confidence': 0.82,
    'bounce_detected': True,
    'zone_details': {
        'type': 'support',
        'price': 42100.00,
        'volume': 1500000,
        'strength': 3,
        'touches': 5
    },
    'timeframe_confluence': [
        {'price': 42100.00, 'timeframes': ['1h', '4h'], 'strength': 0.67}
    ],
    'quality_reasons': ['Price near support', 'Volume spike: 2.3x'],
    'weighted_position': 0.62
}
```

---

## 🔧 Configuration

### Risk Profiles

**Conservative**
```python
EnhancedBounceStrategy(risk_profile='conservative')
# Lower position sizing
# Higher confidence thresholds
# More zone confluence required
```

**Moderate** (default)
```python
EnhancedBounceStrategy(risk_profile='moderate')
# Balanced risk/reward
# Standard thresholds
# Multi-TF alignment required
```

**Aggressive**
```python
EnhancedBounceStrategy(risk_profile='aggressive')
# Higher position sizing
# Lower confidence thresholds
# Single TF confirmation acceptable
```

### Zone Detection Settings
```python
MultiTimeframeZoneDetector(
    timeframes=['1m', '5m', '15m', '1h', '4h', 'D', 'W'],
    settings={
        'volume_threshold_percentile': 0.85,  # Top 15% volume
        'merge_distance_pct': 0.005,  # 0.5% clustering
        'min_zone_width': 0.0025,  # 0.25% minimum
        'fractal_lookback': 5  # 5-bar fractal
    }
)
```

---

## 📈 Key Metrics

### Detection Quality Scores

**High Quality Bounce** (Signal = BUY)
- Zone confluence score: ≥ 0.6
- Bounce confidence: ≥ 0.75
- Volume confirmation: ✓ (ratio > 1.5)
- Price recovery: ≥ 2.0%

**Medium Quality** (Signal = HOLD)
- Zone confluence score: 0.4-0.6
- Bounce confidence: 0.6-0.75
- Partial confirmations

**Low Quality** (Signal = PASS)
- Zone confluence score: < 0.4
- Bounce confidence: < 0.6
- Insufficient validations

---

## 🎯 Integration Checklist

- [x] Executor integration (`strategies/executor.py`)
- [x] Bridge creation (`strategies/bounce_bridge.py`)
- [x] Standalone testing ready
- [ ] Coordinator integration (on demand)
- [ ] API routes (optional)
- [ ] UI visualization (optional)

---

## 🧪 Testing Commands

### Test Executor
```bash
python strategies/executor.py \
  --strategy enhanced_bounce \
  --symbol BTC/USDT \
  --timeframe 4h
```

### Test Bridge
```python
from strategies.bounce_bridge import BounceStrategyBridge
bridge = BounceStrategyBridge()
metrics = bridge.backtest(df_dict, '1h')
print(f"Sharpe: {metrics['sharpe_ratio']:.2f}")
print(f"Win Rate: {metrics['win_rate']:.1f}%")
```

### Test Directly
```python
from strategies.enhanced_bounce_strategy import EnhancedBounceStrategy
strategy = EnhancedBounceStrategy()
result = strategy.evaluate(df_dict, current_price)
print(result)
```

---

## 📚 File Structure

```
strategies/
├── enhanced_bounce_strategy.py       ← Core strategy
│   ├── MultiTimeframeZoneDetector
│   ├── BayesianBeliefUpdaterEnhanced
│   └── EnhancedBounceStrategy
├── bounce_bridge.py                 ← Coordinator bridge
│   └── BounceStrategyBridge
├── executor.py                      ← Integration point
├── volume_sr_agent.py               ← Volume SR zones
├── advanced_strategies.py           ← Bayesian updater
└── strategy_coop.py                 ← Coordinator (optional integration)
```

---

## 🚀 Next Steps

1. **Test in Executor:**
   ```bash
   python strategies/executor.py --strategy enhanced_bounce --symbol BTC/USDT --timeframe 1h
   ```

2. **Verify Bridge Integration:**
   ```python
   from strategies.bounce_bridge import BounceStrategyBridge
   bridge = BounceStrategyBridge()
   print("Bridge ready for coordinator")
   ```

3. **Add to Coordinator** (when ready):
   ```python
   from strategies.bounce_bridge import BounceStrategyBridge
   self.bounce_bridge = BounceStrategyBridge()
   ```

4. **Run Backtests:**
   ```python
   metrics = bridge.backtest(df_dict, '1h')
   ```

---

## 💡 Pro Tips

1. **Zone Confluence Score:** Higher score (>0.6) = more reliable bounce
2. **Volume Confirmation:** Essential for institutional-backed bounces
3. **Multi-Timeframe:** Best signals align across 4+ timeframes
4. **Bayesian Updates:** Confidence increases with confirming evidence
5. **Quality Filtering:** Rejects weak bounces without proper validation

---

**Status:** ✅ Ready for Production  
**Last Updated:** December 4, 2025
