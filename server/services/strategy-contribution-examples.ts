/**
 * Strategy Contribution Integration Guide
 * 
 * How to refactor strategies to feed insights into the Unified Signal Aggregator
 * instead of generating independent signals.
 */

import { StrategyContribution } from './unified-signal-aggregator';

// ============================================================================
// EXAMPLE 1: Gradient Direction Strategy
// ============================================================================

/**
 * Gradient Direction Strategy Contribution
 * 
 * The gradient direction is your PRIMARY trend backbone.
 * It detects:
 * - Trend direction (visual gradient slope)
 * - Trend shifts (when gradient direction changes)
 * - Trend strength (steepness of gradient)
 */
export function getGradientDirectionContribution(
  symbol: string,
  gradientValue: number, // -1 to +1, positive = bullish trend
  gradientStrength: number, // 0-100
  trendShiftDetected: boolean,
  confidence: number // 0-1
): StrategyContribution {
  // Gradient directly feeds trend
  const trend = gradientValue > 0.1 ? 'BULLISH' : 
                gradientValue < -0.1 ? 'BEARISH' : 'SIDEWAYS';

  return {
    name: 'Gradient Direction',
    weight: 0.35, // High weight - this is the primary trend signal
    trend,
    strength: gradientStrength,
    confidence,
    trendShiftMarker: trendShiftDetected,
    reason: `Gradient ${trend} with ${gradientStrength.toFixed(0)}% strength${trendShiftDetected ? ' (trend shift detected)' : ''}`
  };
}

// ============================================================================
// EXAMPLE 2: UT Bot Volatility Strategy
// ============================================================================

/**
 * UT Bot Strategy Contribution
 * 
 * UT Bot provides:
 * - Volatility assessment (ATR-based)
 * - Trailing stop quality (how clean is the stop)
 * - Signal count (how many buy/sell signals)
 * - Momentum from trailing stop moves
 */
export function getUTBotContribution(
  symbol: string,
  atr: number,
  price: number,
  trailingStop: number,
  buySignalCount: number,
  sellSignalCount: number,
  momentum: number // -1 to +1
): StrategyContribution {
  const volatilityPercent = (atr / price) * 100;
  
  // Determine signal trend based on trailing stop distance
  const stopDistance = Math.abs(price - trailingStop) / price;
  let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (trailingStop < price * 0.98) trend = 'BULLISH'; // Stop below = uptrend
  if (trailingStop > price * 1.02) trend = 'BEARISH'; // Stop above = downtrend

  return {
    name: 'UT Bot Volatility',
    weight: 0.20, // Medium weight
    trend,
    volatility: volatilityPercent / 100, // Normalize to 0-1
    momentum,
    confidence: 0.6 + (stopDistance * 0.3), // Higher confidence with wider stops
    buySignals: buySignalCount,
    sellSignals: sellSignalCount,
    reason: `ATR ${atr.toFixed(4)} (${volatilityPercent.toFixed(1)}%), ${buySignalCount} buy / ${sellSignalCount} sell signals, momentum ${momentum.toFixed(2)}`
  };
}

// ============================================================================
// EXAMPLE 3: Market Engine Structure Strategy
// ============================================================================

/**
 * Market Structure Engine Contribution
 * 
 * Market Engine provides:
 * - Trend from swing analysis (HH/HL, LH/LL)
 * - Structure break detection
 * - Support/resistance levels
 * - Reversal likelihood
 */
export function getMarketStructureContribution(
  symbol: string,
  trend: 'UPTREND' | 'DOWNTREND' | 'RANGING',
  structureBreak: boolean,
  lastSwingType: string, // 'HH' | 'HL' | 'LH' | 'LL'
  confidence: number
): StrategyContribution {
  let trendDir: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  if (trend === 'UPTREND') trendDir = 'BULLISH';
  else if (trend === 'DOWNTREND') trendDir = 'BEARISH';

  const breakStr = structureBreak ? ' (structure break detected)' : '';
  
  return {
    name: 'Market Structure',
    weight: 0.25, // High weight - structural analysis is robust
    trend: trendDir,
    strength: confidence * 100,
    confidence,
    reason: `${trend} with ${lastSwingType} pattern${breakStr}`
  };
}

// ============================================================================
// EXAMPLE 4: Flow Field Energy Strategy
// ============================================================================

/**
 * Flow Field Engine Contribution
 * 
 * Flow Field provides:
 * - Energy/force direction (bullish vs bearish pressure)
 * - Turbulence level (market chaos)
 * - Energy trend (accelerating, stable, decelerating)
 * - Pressure trend (rising, falling, stable)
 */
export function getFlowFieldContribution(
  symbol: string,
  dominantDirection: 'BULLISH' | 'BEARISH',
  currentForce: number, // 0-100
  turbulenceLevel: 'low' | 'medium' | 'high' | 'extreme',
  energyTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING',
  pressure: number // 0-100
): StrategyContribution {
  // Energy maps to confidence
  const confidence = Math.min(100, currentForce) / 100;

  return {
    name: 'Flow Field Energy',
    weight: 0.15, // Medium-light weight
    trend: dominantDirection,
    confidence,
    volatility: turbulenceLevel === 'extreme' ? 0.08 : 
                turbulenceLevel === 'high' ? 0.05 : 
                turbulenceLevel === 'medium' ? 0.025 : 0.005,
    energyTrend,
    reason: `${dominantDirection} force ${currentForce.toFixed(0)}/100, turbulence ${turbulenceLevel}, energy ${energyTrend.toLowerCase()}`
  };
}

// ============================================================================
// EXAMPLE 5: ML Model Predictions
// ============================================================================

/**
 * ML Predictions Contribution
 * 
 * ML models provide:
 * - Direction prediction
 * - Confidence score
 * - Expected price movement
 * - Volatility forecast
 */
export function getMLPredictionContribution(
  symbol: string,
  direction: 'BULLISH' | 'BEARISH',
  confidence: number, // 0-1
  priceChange: number, // Expected % change
  volatilityForecast: number // Expected volatility
): StrategyContribution {
  // ML provides direction but with lower weight than structural signals
  // because it can overfit
  
  return {
    name: 'ML Predictions',
    weight: 0.05, // Lower weight - use as confirmation, not primary
    trend: direction,
    confidence,
    volatility: Math.abs(volatilityForecast),
    momentum: Math.sign(priceChange) * Math.min(1, Math.abs(priceChange) / 0.05),
    reason: `${direction} with ${(confidence * 100).toFixed(0)}% confidence, expected ${priceChange.toFixed(2)}% move`
  };
}

// ============================================================================
// REAL WORLD USAGE EXAMPLE
// ============================================================================

// ============================================================================
// EXAMPLE 6: Volume Metrics Strategy
// ============================================================================

/**
 * Volume Metrics Strategy Contribution
 * 
 * Volume is a confirmation indicator showing conviction behind price moves.
 * It detects:
 * - Volume surges (unusual activity)
 * - Volume trends (increasing or decreasing)
 * - Volume-price correlation (confirmation strength)
 * - Volume bars above/below average
 */
export function getVolumeMetricsContribution(
  symbol: string,
  currentVolume: number,
  avgVolume: number,
  volumeSMA20: number,
  priceDirection: 'UP' | 'DOWN' | 'FLAT',
  volumeTrend: 'RISING' | 'FALLING' | 'STABLE'
): StrategyContribution {
  // Calculate volume metrics
  const volumeRatio = currentVolume / avgVolume;
  const volumeAboveMA = currentVolume > volumeSMA20;
  const volumeStrength = Math.min(100, (volumeRatio - 1) * 100); // 0-100%
  
  // Determine trend based on volume conviction
  let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
  let confidence = 0.5;
  let strength = 50;

  // Strong volume on up move = bullish
  if (priceDirection === 'UP' && volumeRatio > 1.2 && volumeTrend === 'RISING') {
    trend = 'BULLISH';
    confidence = Math.min(0.95, 0.5 + (volumeRatio - 1) * 0.5);
    strength = Math.min(100, 60 + volumeStrength);
  }
  // Strong volume on down move = bearish
  else if (priceDirection === 'DOWN' && volumeRatio > 1.2 && volumeTrend === 'RISING') {
    trend = 'BEARISH';
    confidence = Math.min(0.95, 0.5 + (volumeRatio - 1) * 0.5);
    strength = Math.min(100, 60 + volumeStrength);
  }
  // Low volume on move = weak conviction
  else if (volumeRatio < 0.8 || volumeTrend === 'FALLING') {
    confidence = 0.3;
    strength = Math.max(20, 50 * volumeRatio);
  }
  // Average volume = neutral
  else {
    confidence = 0.5;
    strength = 50;
  }

  return {
    name: 'Volume Metrics',
    weight: 0.10, // 10% base weight - confirmation indicator
    trend,
    strength: Math.max(20, strength),
    confidence,
    volatility: (currentVolume - avgVolume) / avgVolume, // Volume deviation
    momentum: volumeRatio > 1.0 ? volumeStrength / 100 : -volumeStrength / 100,
    reason: `Volume ${(volumeRatio).toFixed(1)}x average (${volumeTrend.toLowerCase()}), ${priceDirection} move ${confidence > 0.65 ? 'confirmed' : 'weak'}`
  };
}

/**
 * How to generate Unified Signal from all strategies:
 */

import { UnifiedSignalAggregator } from './unified-signal-aggregator';

export async function generateUnifiedSignal(
  symbol: string,
  currentPrice: number,
  timeframe: string,
  // Gradient
  gradientValue: number,
  gradientStrength: number,
  trendShiftDetected: boolean,
  // UT Bot
  atr: number,
  trailingStop: number,
  utBuyCount: number,
  utSellCount: number,
  utMomentum: number,
  // Market Structure
  structureTrend: 'UPTREND' | 'DOWNTREND' | 'RANGING',
  structureBreak: boolean,
  // Flow Field
  flowDominant: 'BULLISH' | 'BEARISH',
  flowForce: number,
  flowTurbulence: 'low' | 'medium' | 'high' | 'extreme',
  flowEnergyTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING',
  // ML
  mlDirection: 'BULLISH' | 'BEARISH',
  mlConfidence: number,
  mlPriceChange: number,
  mlVolatility: number,
  // Volume Metrics (NEW!)
  currentVolume: number,
  avgVolume: number,
  volumeSMA20: number,
  priceDirection: 'UP' | 'DOWN' | 'FLAT',
  volumeTrend: 'RISING' | 'FALLING' | 'STABLE'
) {
  // Gather all contributions (now 6 sources!)
  const contributions = [
    getGradientDirectionContribution(symbol, gradientValue, gradientStrength, trendShiftDetected, 0.7),
    getUTBotContribution(symbol, atr, currentPrice, trailingStop, utBuyCount, utSellCount, utMomentum),
    getMarketStructureContribution(symbol, structureTrend, structureBreak, 'HH', 0.8),
    getFlowFieldContribution(symbol, flowDominant, flowForce, flowTurbulence, flowEnergyTrend, 50),
    getMLPredictionContribution(symbol, mlDirection, mlConfidence, mlPriceChange, mlVolatility),
    getVolumeMetricsContribution(symbol, currentVolume, avgVolume, volumeSMA20, priceDirection, volumeTrend) // NEW!
  ];

  // Aggregate into single coherent signal
  const unifiedSignal = UnifiedSignalAggregator.aggregate(
    symbol,
    currentPrice,
    timeframe,
    contributions
  );

  return unifiedSignal;
}

// ============================================================================
// BENEFITS OF THIS APPROACH
// ============================================================================

/**
 * Why this is better than independent signals:
 * 
 * 1. **Single Source of Truth**
 *    - One signal, not 5 conflicting ones
 *    - Full transparency on which strategies contributed
 * 
 * 2. **Intelligent Weighting**
 *    - Gradient (primary trend): 35%
 *    - Market Structure (robust): 25%
 *    - UT Bot (volatility): 20%
 *    - Flow Field (energy): 15%
 *    - ML (confirmation): 5%
 *    - Weights can be tuned based on backtest performance
 * 
 * 3. **Agreement Scoring**
 *    - Shows % of strategies agreeing on direction
 *    - Higher agreement = more confidence
 *    - Can skip trades with low agreement (< 60%)
 * 
 * 4. **Unified Risk Management**
 *    - Single risk score combining all factors
 *    - Volatility adjustments based on all sources
 *    - Trend alignment boost/reduction applied consistently
 * 
 * 5. **Easy Backtesting**
 *    - Log each contribution
 *    - Track which mix of strategies performed best
 *    - Can enable/disable strategies dynamically
 * 
 * 6. **Explainability**
 *    - Users see exactly why a signal was generated
 *    - "Buy signal: 75% agreement (Gradient BULLISH + Structure HH + Flow accelerating)"
 */
