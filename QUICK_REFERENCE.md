# Quick Reference Card - Unified 6-7 Source Framework

**Print this for your desk** 📋

---

## API Endpoints

### Generate Single Signal
```
POST /api/signal-generation/generate
```
**Body:** MarketData object with symbol, price, regime, technical indicators
**Response:** CompleteSignal with direction, confidence, regime, framework details

### Generate Batch Signals
```
POST /api/signal-generation/generate-batch
```
**Body:** `{ signals: [MarketData, ...] }`
**Response:** Array of CompleteSignal results

### Validate Parameters
```
POST /api/signal-generation/validate
```
**Body:** `{ symbol, currentPrice, timeframe, accountBalance }`
**Response:** `{ success: boolean, errors?: string[] }`

---

## Key Imports

```typescript
// Main signal generator
import CompletePipelineSignalGenerator from './lib/complete-pipeline-signal-generator';

// Regime router
import { RegimeAwareSignalRouter } from './services/regime-aware-signal-router';

// Individual components
import { PatternDetectionEngine } from './services/pattern-detection-contribution';
import { VolumeMetricsEngine } from './services/volume-metrics-contribution';

// Examples & validation
import UnifiedFrameworkExamples from './services/unified-framework-examples';
import { IntegrationValidator } from './lib/integration-validator';
```

---

## Core Data Structures

### MarketData (Input)
```typescript
{
  // Price
  currentPrice: number,
  prevPrice: number,
  highestPrice: number,
  lowestPrice: number,
  
  // Volume
  currentVolume: number,
  avgVolume: number,
  prevVolume: number,
  
  // Regime Indicators
  adx: number,                          // Trend strength 0-100
  volatilityLevel: 'LOW'|'MEDIUM'|'HIGH'|'EXTREME',
  volatilityTrend: 'RISING'|'STABLE'|'FALLING',
  priceVsMA: number,                    // -1 to +1
  recentSwings: number,
  rangeWidth: number                    // 0-1
}
```

### CompleteSignal (Output)
```typescript
{
  direction: 'BUY' | 'SELL' | 'HOLD',
  confidence: number,                   // 0-1
  regime: string,                       // TRENDING, SIDEWAYS, etc.
  sourceCount: number,                  // How many sources contributing
  primarySources: string[],             // Top 3 contributors
  framework: UnifiedSignalFramework,    // Full details
  reasoning: string,                    // Explanation
  finalPositionSize: number,            // Position amount
  risk: { level: string, score: number }
}
```

---

## Regime Types & Characteristics

| Regime | Trigger | Best Pattern | Best Weight | Risk |
|--------|---------|--------------|------------|------|
| **TRENDING** | ADX > 60 | Breakout, MA Cross | 35% Gradient | Lower |
| **SIDEWAYS** | ADX < 25, narrow | Support Bounce | 35% UT Bot | Medium |
| **BREAKOUT** | Structure + Vol | Structure Break | 25% Structure | Medium |
| **HIGH_VOL** | Volatility extreme | N/A | Reduce pos | High |
| **QUIET** | Low vol + weak | Wait/ML confirm | 22% ML | Lower |

---

## Pattern Detection (7 Types)

| Pattern | Entry Signal | Confidence Base | Volume Req | Price Action |
|---------|--------------|-----------------|------------|--------------|
| SUPPORT_BOUNCE | Price bounces off support | 0.75 | >1.5x | >2% recovery |
| RESISTANCE_BREAK | Price breaks resistance | 0.75 | Variable | Breakout |
| BREAKOUT | Outside BB bands | 0.75 | >1.5x | >2% |
| REVERSAL_BULLISH | RSI <30 + cross | 0.75 | >1.5x | Recovery |
| REVERSAL_BEARISH | RSI >70 + cross | 0.75 | >1.5x | Decline |
| MA_CROSSOVER | EMA20 > EMA50 | 0.75 | Variable | Cross |
| MACD_SIGNAL | Histogram cross | 0.75 | Variable | Cross |

**Confluence Boost:** 3+ patterns → +0.10 confidence per pattern (max 0.95)

---

## Volume Metrics

**Ratio Interpretation:**
- **< 0.7:** Weak volume (0.3 strength)
- **0.7-0.8:** Low volume (0.3-0.5)
- **0.8-1.2:** Normal volume (0.5-0.7)
- **1.2-1.5:** Strong volume (0.7)
- **1.5-2.0:** Very strong (0.8)
- **> 2.0:** Extreme (0.9)

**Position Sizing Impact:**
- **WEAK (< 0.8x avg):** 0.7x position
- **NORMAL (0.8-1.5x):** 1.0x position
- **STRONG (1.5-2.0x):** 1.5x position
- **EXTREME (> 2.0x):** 1.8x position

**Confirmation Rules:**
- Bullish: Volume + price up = confirmed
- Bearish: Volume + price down = confirmed
- Weak: Volume down, any price = not confirmed

---

## Position Sizing Formula

```
Base = Kelly Criterion calculation
Regime Multiplier = 0.7x to 1.5x (based on regime type)
Quality Multiplier = 0.8x to 1.2x (quality score 0-100)
Agreement Multiplier = 1.0x to 1.15x (source agreement)
Pattern/Volume Multiplier = 0.85x to 1.15x

Final Position = Base × Regime × Quality × Agreement × Pattern
```

**Cap Rules:**
- Position size ≤ 5% of account (risk management)
- EXTREME risk → position ÷ 5 (0.2x)
- HIGH risk → position ÷ 2 (0.5x)

---

## Risk Levels

```
LOW:       Signal agreement ≥ 70% + quality ≥ 70% → 1.5x size
MEDIUM:    Normal conditions → 1.0x size
HIGH:      Quality < 60% OR volatility high → 0.5x size
EXTREME:   Vol extreme + ADX low + quality < 50% → 0.2x size
```

---

## Testing Commands

```bash
# Validate integration
npm run validate:integration

# Run examples
npm run examples

# Test regime detection
npm run test:regimes

# Test pattern detection
npm run test:patterns

# Build & compile
npm run build

# Start service
npm start
```

---

## Common API Calls

### Test Signal Generation
```bash
curl -X POST http://localhost:3000/api/signal-generation/generate \
  -H "Content-Type: application/json" \
  -d '{
    "symbol":"BTCUSDT","currentPrice":42000,"timeframe":"1h",
    "accountBalance":10000,"volatilityLevel":"MEDIUM","trendStrength":65,
    "rangeWidth":0.03,"volatilityTrend":"RISING","priceVsMA":1.02,
    "recentSwings":4,"gradientValue":0.15,"gradientStrength":78,
    "atr":420,"trailingStop":41000,"utBuyCount":3,"utSellCount":1,
    "flowDominant":"BULLISH","flowForce":75,"currentVolume":1500,
    "avgVolume":1000
  }'
```

### Validate Parameters
```bash
curl -X POST http://localhost:3000/api/signal-generation/validate \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","currentPrice":42000,"timeframe":"1h","accountBalance":10000}'
```

---

## Performance Targets

### Per-Regime Win Rates
```
TRENDING:        60-65% win rate
SIDEWAYS:        55-60% win rate
BREAKOUT:        58-62% win rate
HIGH_VOLATILITY: 52-56% win rate
QUIET:           54-58% win rate
OVERALL:         58-62% win rate (+5-7% vs baseline)
```

### Per-Regime Sharpe Ratios
```
TRENDING:        1.5-2.0 (baseline: 1.1)  → +40% improvement
SIDEWAYS:        1.2-1.5 (baseline: 0.8)  → +50% improvement
BREAKOUT:        1.7-2.0 (baseline: 1.1)  → +45% improvement
HIGH_VOLATILITY: 0.8-1.2 (baseline: 0.9)  → 0-20% improvement
QUIET:           1.0-1.4 (baseline: 0.9)  → +25% improvement
OVERALL:         1.4-1.7 (baseline: 0.9)  → +60% improvement
```

---

## File Quick Locations

| File | Purpose | Location |
|------|---------|----------|
| Main Generator | Signal generation | `/server/lib/complete-pipeline-signal-generator.ts` |
| API Routes | REST endpoints | `/server/routes/api/signal-generation.ts` |
| Regime Router | Regime detection | `/server/services/regime-aware-signal-router.ts` |
| Patterns | 7 pattern types | `/server/services/pattern-detection-contribution.ts` |
| Volume | Volume metrics | `/server/services/volume-metrics-contribution.ts` |
| Examples | Test scenarios | `/server/services/unified-framework-examples.ts` |
| Validator | Integration tests | `/server/lib/integration-validator.ts` |

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Low confidence | In QUIET regime | Wait for regime shift or reduce threshold |
| No patterns detected | Market in QUIET | Normal, increase time window |
| Volume not confirming | Low volume period | Check volume > 1.5x threshold |
| Position size too small | EXTREME risk or low quality | Check data quality and regime |
| Win rate low | Wrong regime classification | Validate ADX, volatility, range calculations |
| API slow | CPU usage high | Check parallel requests, reduce batch size |

---

## Checklist Before Trading

- [ ] Run integration-validator.ts and confirm PASS
- [ ] Test API endpoints with sample data
- [ ] Run 5 examples and review outputs
- [ ] Monitor signal generation for 24 hours
- [ ] Verify regime detection accuracy
- [ ] Verify pattern detection working
- [ ] Check volume metrics calculating
- [ ] Validate position sizing multipliers
- [ ] Review risk level assignments
- [ ] Compare performance vs baseline
- [ ] Enable gradual trading (25% → 50% → 100%)

---

## Emergency Procedures

**Signal Generation Failing?**
1. Check API logs: `tail -f logs/signal-generation.log`
2. Validate market data input
3. Restart service: `npm start`
4. Run validator: `npm run validate:integration`

**Performance Degrading?**
1. Monitor metrics: Query results database
2. Check regime detection: Run examples
3. Review pattern thresholds
4. Check volume data quality

**Need to Rollback?**
1. Stop trading: `curl /admin/emergency-stop -X POST`
2. Revert code: `git revert <commit>`
3. Rebuild: `npm run build`
4. Restart: `npm start`

---

## Documentation Map

```
START_HERE.md
    ↓
FRAMEWORK_SUMMARY.md (visual overview)
    ↓
UNIFIED_FRAMEWORK_README.md (deep technical)
    ↓
INTEGRATION_GUIDE.md (step-by-step)
    ↓
DEPLOYMENT_GUIDE.md (production)
```

**For specific questions:**
- How framework works → UNIFIED_FRAMEWORK_README.md
- How to integrate → INTEGRATION_GUIDE.md
- How to deploy → DEPLOYMENT_GUIDE.md
- How to run examples → unified-framework-examples.ts
- How to validate → integration-validator.ts

---

**Version:** 1.0
**Status:** Production Ready ✅
**Last Updated:** December 2, 2025

*Keep this card handy while working with the framework!*
