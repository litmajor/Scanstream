/**
 * Trade Evidence Extractor
 * 
 * Extracts Evidence objects from completed trades for Bayesian belief updating.
 * Evidence includes profitability, quality metrics, regime match, and confidence calibration.
 */

import { Trade } from '@shared/schema';
import { Evidence, MarketRegime } from './bayesian-belief-updater';

export interface TradeContext {
  entry_confidence: number; // ML model confidence at entry
  exit_confidence: number; // ML model confidence at exit
  market_regime: MarketRegime;
  entry_quality_signal: number; // How good was the entry signal (0-1)
  exit_timing_quality: number; // How well-timed was the exit (0-1)
  strategy_id: string;
}

/**
 * Extract evidence from a closed trade
 */
export function extractTradeEvidence(
  trade: Trade,
  context: TradeContext
): Evidence {
  // Calculate profitability
  const was_profitable = (trade.pnl || 0) > 0;
  const investmentAmount = trade.entryPrice * trade.quantity;
  const pnlPercent = investmentAmount > 0 ? ((trade.pnl || 0) / investmentAmount) * 100 : 0;
  const roi = pnlPercent / 100; // Convert percentage to decimal

  // Risk-adjusted return: ROI divided by how confident we were
  const entry_confidence_safe = Math.max(0.1, context.entry_confidence); // Avoid division by tiny numbers
  const risk_adjusted_return = roi / entry_confidence_safe;

  // Entry quality: How good was the signal?
  const entry_quality = context.entry_quality_signal;

  // Exit quality: Combination of timing and exit signal confidence
  const exit_timing = context.exit_timing_quality;
  const exit_signal_confidence = Math.max(0, context.exit_confidence);
  const exit_quality = (exit_timing + exit_signal_confidence) / 2;

  // Duration efficiency: Did we exit quickly?
  // Fast exits (< 4 hours) get higher scores for efficiency
  // Long holds (>72 hours) get lower efficiency scores
  const duration_hours = trade.exitTime && trade.entryTime
    ? (new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime()) / (1000 * 60 * 60)
    : 24;
  
  let duration_efficiency = 1.0;
  if (duration_hours < 4) {
    duration_efficiency = 0.9; // Quick exits are efficient
  } else if (duration_hours > 72) {
    duration_efficiency = 0.5; // Long holds get lower efficiency
  } else {
    duration_efficiency = 0.7 + (1 - Math.min(duration_hours / 72, 1)) * 0.2;
  }

  // Regime match: How well did the strategy perform in this regime?
  // If the regime matches what we expect, this is higher
  const regime_match = context.entry_quality_signal; // Use entry quality as proxy for regime fit

  // Confidence calibration: Did our confidence level predict the outcome?
  // High confidence should predict wins more often
  const confidence_calibration = context.entry_confidence;

  return {
    was_profitable,
    roi,
    risk_adjusted_return,
    entry_quality,
    exit_quality,
    duration_efficiency,
    regime_match,
    confidence_calibration,
    strategy_id: context.strategy_id,
    timestamp: new Date(),
  };
}

/**
 * Calculate entry quality from technical indicators
 * Returns score 0-1 indicating how "clean" the entry was
 */
export function calculateEntryQuality(
  rsi: number,
  macd_histogram: number,
  trend_strength: number,
  confluence: number
): number {
  let quality = 0.5; // Start at neutral

  // RSI extremes indicate stronger signals
  if ((rsi > 70 && macd_histogram < 0) || (rsi < 30 && macd_histogram > 0)) {
    quality += 0.2; // Divergence is a strong signal
  } else if (rsi > 65 || rsi < 35) {
    quality += 0.1; // Extreme RSI is decent
  }

  // Trend strength adds confidence
  quality += Math.min(0.2, trend_strength);

  // Confluence (multiple signals agreeing) adds confidence
  quality += Math.min(0.15, confluence);

  return Math.max(0, Math.min(1, quality));
}

/**
 * Calculate exit quality from exit conditions
 * Returns score 0-1 indicating how well we exited
 */
export function calculateExitQuality(
  reason: string,
  distance_from_target: number,
  pnl_percent: number
): number {
  let quality = 0.5;

  // Exit at target is optimal
  if (reason === 'TAKE_PROFIT' && distance_from_target < 0.02) {
    quality = 0.95;
  }
  // Stop loss is neutral
  else if (reason === 'STOP_LOSS') {
    quality = 0.5;
  }
  // Manual close is worse
  else if (reason === 'MANUAL') {
    quality = 0.4;
  }

  // Adjust based on actual profit
  if (pnl_percent > 3) {
    quality += 0.1;
  } else if (pnl_percent < -2) {
    quality -= 0.1;
  }

  return Math.max(0, Math.min(1, quality));
}

/**
 * Estimate market regime from price data
 */
export function estimateMarketRegime(
  atr: number,
  price: number,
  trend_strength: number,
  volatility: number
): MarketRegime {
  const atr_percent = (atr / price) * 100;
  const abs_trend = Math.abs(trend_strength);

  // High volatility + weak trend = ranging
  if (volatility > 0.03 && abs_trend < 0.3) {
    return MarketRegime.RANGING;
  }
  // High volatility + strong trend = volatile
  else if (volatility > 0.03) {
    return MarketRegime.VOLATILE;
  }
  // Strong trend = trending
  else if (abs_trend > 0.5) {
    return MarketRegime.TRENDING;
  }
  // Default
  else {
    return MarketRegime.NEUTRAL;
  }
}

/**
 * Calculate evidence weight adjustment based on market conditions
 * Higher weight for evidence in well-defined conditions
 */
export function calculateEvidenceWeight(
  regime: MarketRegime,
  volume_ratio: number,
  samples_in_regime: number
): number {
  let weight = 1.0;

  // Volume ratio increases evidence weight
  if (volume_ratio > 1.5) {
    weight *= 1.2;
  }

  // Well-defined regimes have higher evidence weight
  if (regime === MarketRegime.TRENDING) {
    weight *= 1.1;
  } else if (regime === MarketRegime.RANGING) {
    weight *= 0.9; // Ranging is more ambiguous
  }

  // More samples = more confident in regime classification
  if (samples_in_regime > 50) {
    weight *= 1.05;
  }

  return weight;
}
