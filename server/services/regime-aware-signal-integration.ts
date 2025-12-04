/**
 * Regime-Aware Signal Generation - Integration Example
 * 
 * Shows how to combine:
 * 1. RegimeAwareSignalRouter (detects market regime, adjusts weights)
 * 2. UnifiedSignalAggregator (combines strategies with dynamic weights)
 * 3. DynamicPositionSizer (sizes positions based on regime)
 * 
 * This creates a complete, adaptive signal system that performs well in all markets.
 */

import { UnifiedSignalAggregator } from './unified-signal-aggregator';
import { RegimeAwareSignalRouter, type MarketRegime } from './regime-aware-signal-router';
import { DynamicPositionSizer } from './dynamic-position-sizer';
import type { StrategyContribution } from './unified-signal-aggregator';

/**
 * Complete regime-aware signal generation pipeline
 */
export async function generateRegimeAwareSignal(
  symbol: string,
  currentPrice: number,
  timeframe: string,
  
  // Market data needed for regime detection
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME',
  trendStrength: number, // 0-100 (ADX)
  rangeWidth: number, // 0-1
  volatilityTrend: 'RISING' | 'STABLE' | 'FALLING',
  priceVsMA: number, // -1 to +1
  recentSwings: number, // count of recent structure breaks
  
  // All strategy contributions (unweighted)
  gradientValue: number,
  gradientStrength: number,
  trendShiftDetected: boolean,
  atr: number,
  trailingStop: number,
  utBuyCount: number,
  utSellCount: number,
  utMomentum: number,
  structureTrend: 'UPTREND' | 'DOWNTREND' | 'RANGING',
  structureBreak: boolean,
  flowDominant: 'BULLISH' | 'BEARISH',
  flowForce: number,
  flowTurbulence: 'low' | 'medium' | 'high' | 'extreme',
  flowEnergyTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING',
  mlDirection: 'BULLISH' | 'BEARISH',
  mlConfidence: number,
  mlPriceChange: number,
  mlVolatility: number,
  
  // Account info for position sizing
  accountBalance: number
) {
  // ========== STEP 1: Detect market regime ==========
  const regime = RegimeAwareSignalRouter.detectRegime(
    volatilityLevel,
    trendStrength,
    rangeWidth,
    volatilityTrend,
    priceVsMA,
    recentSwings
  );

  console.log(`[RegimeRouter] Detected: ${regime.type}`);
  console.log(`[RegimeRouter] Characteristics: ${regime.characteristics.join(', ')}`);

  // ========== STEP 2: Get initial strategy contributions ==========
  // (Using default weights - will be reweighted by regime)
  
  const contributions: StrategyContribution[] = [
    {
      name: 'Gradient Direction',
      weight: 0.35, // Will be reweighted by regime
      trend: gradientValue > 0.1 ? 'BULLISH' : gradientValue < -0.1 ? 'BEARISH' : 'SIDEWAYS',
      strength: gradientStrength,
      confidence: 0.7,
      trendShiftMarker: trendShiftDetected,
      reason: `Gradient ${gradientValue.toFixed(2)} with ${gradientStrength.toFixed(0)}% strength`
    },
    {
      name: 'UT Bot Volatility',
      weight: 0.20,
      trend: trailingStop < currentPrice * 0.98 ? 'BULLISH' : 'BEARISH',
      volatility: (atr / currentPrice) * 100 / 100,
      momentum: utMomentum,
      confidence: 0.6,
      buySignals: utBuyCount,
      sellSignals: utSellCount,
      reason: `ATR ${atr.toFixed(4)}, ${utBuyCount} buy / ${utSellCount} sell signals`
    },
    {
      name: 'Market Structure',
      weight: 0.25,
      trend: structureTrend === 'UPTREND' ? 'BULLISH' : structureTrend === 'DOWNTREND' ? 'BEARISH' : 'SIDEWAYS',
      strength: 75,
      confidence: 0.8,
      reason: `${structureTrend}${structureBreak ? ' (structure break)' : ''}`
    },
    {
      name: 'Flow Field Energy',
      weight: 0.15,
      trend: flowDominant,
      confidence: Math.min(100, flowForce) / 100,
      volatility: flowTurbulence === 'extreme' ? 0.08 : flowTurbulence === 'high' ? 0.05 : 0.025,
      energyTrend: flowEnergyTrend,
      reason: `${flowDominant} force ${flowForce.toFixed(0)}/100, ${flowTurbulence} turbulence`
    },
    {
      name: 'ML Predictions',
      weight: 0.05,
      trend: mlDirection === 'BULLISH' ? 'BULLISH' : 'BEARISH',
      confidence: mlConfidence,
      volatility: Math.abs(mlVolatility),
      momentum: Math.sign(mlPriceChange) * Math.min(1, Math.abs(mlPriceChange) / 0.05),
      reason: `${mlDirection} with ${(mlConfidence * 100).toFixed(0)}% confidence`
    }
  ];

  // ========== STEP 3: Reweight contributions based on regime ==========
  const reweightedContributions = RegimeAwareSignalRouter.reweightContributions(
    contributions,
    regime
  );

  console.log('[RegimeRouter] Reweighted contributions:');
  reweightedContributions.forEach(c => {
    console.log(`  ${c.name}: ${(c.weight * 100).toFixed(1)}%`);
  });

  // ========== STEP 4: Aggregate into unified signal ==========
  const unifiedSignal = UnifiedSignalAggregator.aggregate(
    symbol,
    currentPrice,
    timeframe,
    reweightedContributions
  );

  console.log(`[UnifiedSignal] ${unifiedSignal.direction}: ${(unifiedSignal.confidence * 100).toFixed(0)}% confidence`);
  console.log(`[UnifiedSignal] Agreement: ${unifiedSignal.agreementScore.toFixed(0)}%`);

  // ========== STEP 5: Apply regime-specific filters ==========
  const minAgreement = RegimeAwareSignalRouter.getMinAgreementThreshold(regime);
  
  if (unifiedSignal.agreementScore < minAgreement * 100) {
    console.log(`[RegimeRouter] Signal filtered: ${unifiedSignal.agreementScore.toFixed(0)}% < ${(minAgreement * 100).toFixed(0)}% threshold for ${regime.type}`);
    
    // Return neutral signal instead
    return {
      ...unifiedSignal,
      direction: 'HOLD',
      reason: `Insufficient agreement for ${regime.type} market (${unifiedSignal.agreementScore.toFixed(0)}% < ${(minAgreement * 100).toFixed(0)}%)`
    };
  }

  // ========== STEP 6: Apply regime-specific position sizing ==========
  const regimeSizingMult = RegimeAwareSignalRouter.getRegimeSizingMultiplier(regime);
  const positionSizing = new DynamicPositionSizer().calculatePositionSize({
    symbol,
    confidence: unifiedSignal.confidence,
    signalType: unifiedSignal.direction === 'BUY' ? 'BUY' : 'SELL',
    accountBalance,
    currentPrice,
    atr,
    marketRegime: regime.type,
    primaryPattern: 'MULTI_STRATEGY',
    trendDirection: unifiedSignal.trend.direction,
    sma20: currentPrice, // Placeholder
    sma50: currentPrice  // Placeholder
  });

  // Apply regime multiplier
  const adjustedPositionSize = positionSizing.positionSize * regimeSizingMult;
  const adjustedPositionPercent = positionSizing.positionPercent * regimeSizingMult;

  console.log(`[PositionSizing] Base: ${(positionSizing.positionPercent * 100).toFixed(2)}% → Regime adjusted: ${(adjustedPositionPercent * 100).toFixed(2)}% (${regimeSizingMult.toFixed(1)}x)`);

  // ========== STEP 7: Get regime-specific entry/exit rules ==========
  const rules = RegimeAwareSignalRouter.getRegimeRules(regime);

  console.log(`[RegimeRouter] Entry: ${rules.entryRule}`);
  console.log(`[RegimeRouter] Exit: ${rules.exitRule}`);

  // ========== RETURN COMPLETE REGIME-AWARE SIGNAL ==========
  return {
    // Original unified signal
    ...unifiedSignal,

    // Regime information
    regime,
    regimeWeights: RegimeAwareSignalRouter.getRegimeAdjustedWeights(regime),

    // Regime-adjusted sizing
    positionSizing: {
      basePositionSize: positionSizing.positionSize,
      basePositionPercent: positionSizing.positionPercent,
      regimeSizingMultiplier: regimeSizingMult,
      finalPositionSize: adjustedPositionSize,
      finalPositionPercent: adjustedPositionPercent,
      reasoning: [
        ...positionSizing.reasoning,
        `Regime multiplier (${regime.type}): ${regimeSizingMult.toFixed(1)}x`
      ]
    },

    // Regime-specific rules
    entryRule: rules.entryRule,
    exitRule: rules.exitRule,
    stoplossATRMultiplier: rules.stoplossMultiplier,
    takeprofitATRMultiplier: rules.takeprofitMultiplier,

    // Recommendation
    recommendation: {
      action: unifiedSignal.direction,
      strength: unifiedSignal.strength,
      regime: regime.type,
      minAgreementMet: unifiedSignal.agreementScore >= minAgreement * 100,
      reason: `${unifiedSignal.direction} in ${regime.type} market (${(unifiedSignal.confidence * 100).toFixed(0)}% confidence, ${unifiedSignal.agreementScore.toFixed(0)}% agreement)`
    },

    metadata: {
      ...unifiedSignal.metadata,
      regimeDetection: {
        type: regime.type,
        strength: regime.strength,
        characteristics: regime.characteristics,
        volatilityLevel: regime.volatilityLevel,
        trendStrength: regime.trendStrength,
        rangeWidth: regime.rangeWidth
      }
    }
  };
}

/**
 * Example usage in your signal pipeline
 */
export async function exampleUsage() {
  const signal = await generateRegimeAwareSignal(
    'BTC/USDT',
    50000,
    '1h',
    // Market data
    'HIGH',
    75,
    0.02,
    'RISING',
    0.5,
    4,
    // Gradient
    0.8,
    85,
    false,
    // UT Bot
    800,
    49000,
    3,
    0,
    0.6,
    // Market Structure
    'UPTREND',
    false,
    // Flow Field
    'BULLISH',
    80,
    'medium',
    'ACCELERATING',
    // ML
    'BULLISH',
    0.75,
    0.03,
    0.02,
    // Account
    10000
  );

  console.log('\n=== FINAL SIGNAL ===');
  console.log(`Action: ${signal.recommendation.action}`);
  console.log(`Regime: ${signal.recommendation.regime}`);
  console.log(`Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
  console.log(`Position: ${(signal.positionSizing.finalPositionPercent * 100).toFixed(2)}% of account`);
  console.log(`Entry: ${signal.entryRule}`);
  console.log(`Exit: ${signal.exitRule}`);
}

// =============================================================================
// REGIME BEHAVIOR SUMMARY
// =============================================================================

/**
 * TRENDING (Gradient leads: 40%)
 * ├─ Buy on pullbacks to EMA20
 * ├─ Sell on rallies in downtrend
 * ├─ Position sizing: 1.0x (normal)
 * └─ Min agreement: 55%
 * 
 * SIDEWAYS (UT Bot leads: 40%)
 * ├─ Buy at support / trailing stop from above
 * ├─ Sell at resistance / trailing stop from below
 * ├─ Position sizing: 1.2x (mean-reversion edge)
 * └─ Min agreement: 60%
 * 
 * HIGH_VOLATILITY (UT Bot leads: 40%)
 * ├─ Wait for confirmation + close protective stops
 * ├─ Exit quickly on reversal
 * ├─ Position sizing: 0.5x (capital protection)
 * └─ Min agreement: 70%
 * 
 * BREAKOUT (Market Structure leads: 35%)
 * ├─ Enter on structure break (HH/LL) + energy acceleration
 * ├─ Use trailing stops for momentum capture
 * ├─ Position sizing: 1.5x (large breakout trades)
 * └─ Min agreement: 65%
 * 
 * QUIET (ML Predictions lead: 25%)
 * ├─ Only trade on high ML confidence (>75%)
 * ├─ Exit at first sign of regime shift
 * ├─ Position sizing: 0.6x (reduce trading)
 * └─ Min agreement: 75%
 */
