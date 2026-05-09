/**
 * Regime Gate: Directional Environment Filter
 * 
 * Prevents entry into regimes that structurally reject that direction.
 * Not about prediction — about **market structure compatibility**.
 * 
 * Core truth: Convexity only exists in compatible regimes.
 * SELLs work in breakdown/distribution environments.
 * BUYs work in breakout/accumulation environments.
 * Both fail equally in whipsaw zones.
 */

import type { MarketTick } from './types.ts';

export type MarketDirection = 'BUY' | 'SELL';

export interface RegimeGateState {
  /** Is this regime structurally favorable for this direction? */
  allows_direction: boolean;
  
  /** Confidence in regime classification (0-1) */
  regime_confidence: number;
  
  /** Current market regime */
  regime: string;
  
  /** Reason for gate decision */
  gate_reason: string;
  
  /** Raw metrics used */
  diagnostics: {
    volatility_regime: 'low' | 'medium' | 'high' | 'extreme';
    volatility_trend: 'expanding' | 'contracting' | 'neutral';
    atr_slope: number; // Positive = expanding, negative = contracting
    range_vs_trend: 'range_bound' | 'trending' | 'breakout_pending';
    momentum_direction: 'up' | 'down' | 'neutral';
    momentum_strength: number; // 0-1, how strong is the directional bias
  };
}

export class RegimeGate {
  /**
   * Evaluate if market structure allows profitable trading in the given direction
   * 
   * @param ticks Market candle data (last ~100 bars recommended)
   * @param direction BUY or SELL
   * @returns Gate state with decision and diagnostics
   */
  static evaluateDirectionAllowed(
    ticks: MarketTick[],
    direction: MarketDirection
  ): RegimeGateState {
    if (ticks.length < 20) {
      return {
        allows_direction: true, // Default open on insufficient data
        regime_confidence: 0,
        regime: 'UNKNOWN',
        gate_reason: 'Insufficient data for regime evaluation',
        diagnostics: {
          volatility_regime: 'low',
          volatility_trend: 'neutral',
          atr_slope: 0,
          range_vs_trend: 'range_bound',
          momentum_direction: 'neutral',
          momentum_strength: 0
        }
      };
    }

    // Calculate volatility characteristics
    const volatilityMetrics = RegimeGate.calculateVolatilityMetrics(ticks);
    const trendMetrics = RegimeGate.calculateTrendMetrics(ticks);
    const momentumMetrics = RegimeGate.calculateMomentumMetrics(ticks);

    // Determine regime classification
    const regime = RegimeGate.classifyRegime(
      volatilityMetrics,
      trendMetrics,
      momentumMetrics
    );

    // Apply directional gates
    const gateDecision = RegimeGate.applyDirectionalGates(
      direction,
      regime,
      volatilityMetrics,
      trendMetrics,
      momentumMetrics
    );

    return gateDecision;
  }

  /**
   * Calculate volatility expansion/contraction trend
   */
  private static calculateVolatilityMetrics(ticks: MarketTick[]): any {
    const atr14 = RegimeGate.calculateATR(ticks, 14);
    const atr20 = RegimeGate.calculateATR(ticks, 20);
    const atr5 = RegimeGate.calculateATR(ticks, 5);

    // Is volatility expanding or contracting?
    const atrSlope = atr14 - atr20; // Positive = recent expansion
    const volatilityTrend = Math.abs(atrSlope) < atr20 * 0.05
      ? 'neutral'
      : atrSlope > 0
      ? 'expanding'
      : 'contracting';

    // Absolute level
    const avgClose = ticks.slice(-50).reduce((sum, t) => sum + t.close, 0) / 50;
    const volatilityPercent = (atr14 / avgClose) * 100;

    const volatilityRegime =
      volatilityPercent > 3 ? 'extreme' :
      volatilityPercent > 2.5 ? 'high' :
      volatilityPercent > 1.5 ? 'medium' :
      'low';

    return {
      atr14,
      atr20,
      atr5,
      atr_slope: atrSlope,
      volatility_trend: volatilityTrend,
      volatility_percent: volatilityPercent,
      volatility_regime: volatilityRegime
    };
  }

  /**
   * Calculate trend strength and direction
   */
  private static calculateTrendMetrics(ticks: MarketTick[]): any {
    const closes = ticks.map(t => t.close);
    const lookback = Math.min(50, closes.length);

    // Simple trend: is current price above/below SMA?
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const currentPrice = closes[closes.length - 1];

    const priceAboveSMA20 = currentPrice > sma20;
    const priceAboveSMA50 = currentPrice > sma50;
    const sma20AboveSMA50 = sma20 > sma50;

    // Range vs trend: is price oscillating or breaking?
    const highLow50 = Math.max(...ticks.slice(-50).map(t => t.high)) -
                      Math.min(...ticks.slice(-50).map(t => t.low));
    const recent10High = Math.max(...ticks.slice(-10).map(t => t.high));
    const recent10Low = Math.min(...ticks.slice(-10).map(t => t.low));
    const recent10Range = recent10High - recent10Low;

    const isBreakingOut = recent10Range > highLow50 * 0.3; // Recent volatility > historical avg

    // Trend classification
    let rangeVsTrend = 'range_bound';
    if (sma20AboveSMA50 && priceAboveSMA20) {
      rangeVsTrend = 'trending';
    } else if (!sma20AboveSMA50 && !priceAboveSMA20) {
      rangeVsTrend = 'trending';
    } else if (isBreakingOut) {
      rangeVsTrend = 'breakout_pending';
    }

    return {
      sma20,
      sma50,
      current_price: currentPrice,
      price_above_sma20: priceAboveSMA20,
      price_above_sma50: priceAboveSMA50,
      sma20_above_sma50: sma20AboveSMA50,
      range_vs_trend: rangeVsTrend,
      is_breaking_out: isBreakingOut
    };
  }

  /**
   * Calculate momentum direction and strength
   */
  private static calculateMomentumMetrics(ticks: MarketTick[]): any {
    const closes = ticks.map(t => t.close);
    const lookback = Math.min(20, closes.length - 1);

    // RSI-like momentum (simplified)
    let gains = 0, losses = 0;
    for (let i = closes.length - lookback; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const momentumStrength = Math.abs(gains - losses) / (gains + losses || 1);
    const momentumDirection = gains > losses ? 'up' : losses > gains ? 'down' : 'neutral';

    return {
      gains,
      losses,
      momentum_direction: momentumDirection,
      momentum_strength: momentumStrength
    };
  }

  /**
   * Classify market regime from metrics
   */
  private static classifyRegime(
    vol: any,
    trend: any,
    momentum: any
  ): string {
    // Breakdown/Distribution regime (SELL favorable)
    if (
      trend.range_vs_trend === 'trending' &&
      !trend.sma20_above_sma50 &&
      momentum.momentum_direction === 'down'
    ) {
      return 'DOWNTREND_ESTABLISHED';
    }

    if (
      vol.volatility_trend === 'expanding' &&
      momentum.momentum_direction === 'down'
    ) {
      return 'DISTRIBUTION_BREAKDOWN';
    }

    // Breakout/Accumulation regime (BUY favorable)
    if (
      trend.range_vs_trend === 'trending' &&
      trend.sma20_above_sma50 &&
      momentum.momentum_direction === 'up'
    ) {
      return 'UPTREND_ESTABLISHED';
    }

    if (
      trend.range_vs_trend === 'breakout_pending' &&
      vol.volatility_trend === 'contracting'
    ) {
      return 'ACCUMULATION_COMPRESSION';
    }

    // Neutral/Risky regimes
    if (vol.volatility_trend === 'neutral' && trend.range_vs_trend === 'range_bound') {
      return 'CONSOLIDATION_NEUTRAL';
    }

    if (vol.volatility_regime === 'extreme') {
      return 'VOLATILE_WHIPSAW';
    }

    return 'MIXED_STRUCTURE';
  }

  /**
   * Apply directional gates based on regime
   * Returns: should this direction be allowed to trade?
   */
  private static applyDirectionalGates(
    direction: MarketDirection,
    regime: string,
    vol: any,
    trend: any,
    momentum: any
  ): RegimeGateState {
    // SELL favorable regimes
    const sellFavorableRegimes = [
      'DOWNTREND_ESTABLISHED',
      'DISTRIBUTION_BREAKDOWN',
    ];

    // BUY favorable regimes
    const buyFavorableRegimes = [
      'UPTREND_ESTABLISHED',
      'ACCUMULATION_COMPRESSION',
    ];

    // Anti-regimes (actively punish that direction)
    const antiSellRegimes = ['UPTREND_ESTABLISHED', 'ACCUMULATION_COMPRESSION'];
    const antiBuyRegimes = ['DOWNTREND_ESTABLISHED', 'DISTRIBUTION_BREAKDOWN'];

    // Danger zones (punish both)
    const dangerRegimes = ['VOLATILE_WHIPSAW', 'MIXED_STRUCTURE'];

    let allows_direction = true;
    let gate_reason = '';
    let regime_confidence = 0.7; // Default confidence

    if (direction === 'SELL') {
      if (sellFavorableRegimes.includes(regime)) {
        allows_direction = true;
        gate_reason = `✅ ${regime} favors SELL (momentum down, structure breaking)`;
        regime_confidence = 0.85;
      } else if (antiBuyRegimes.includes(regime)) {
        // Slightly cautious but allowed
        allows_direction = true;
        gate_reason = `⚠️ ${regime} mixed for SELL, weak BUY signal suggests short bias`;
        regime_confidence = 0.6;
      } else if (dangerRegimes.includes(regime)) {
        allows_direction = false;
        gate_reason = `🔒 ${regime} creates whipsaw risk for both directions`;
        regime_confidence = 0.4;
      } else {
        allows_direction = true;
        gate_reason = `${regime} - neutral, allowing SELL with caution`;
        regime_confidence = 0.5;
      }
    } else {
      // BUY direction
      if (buyFavorableRegimes.includes(regime)) {
        allows_direction = true;
        gate_reason = `✅ ${regime} favors BUY (momentum up, structure forming)`;
        regime_confidence = 0.85;
      } else if (antiSellRegimes.includes(regime)) {
        // Slightly cautious but allowed
        allows_direction = true;
        gate_reason = `⚠️ ${regime} mixed for BUY, weak SELL signal suggests long bias`;
        regime_confidence = 0.6;
      } else if (dangerRegimes.includes(regime)) {
        allows_direction = false;
        gate_reason = `🔒 ${regime} creates whipsaw risk for both directions`;
        regime_confidence = 0.4;
      } else {
        allows_direction = true;
        gate_reason = `${regime} - neutral, allowing BUY with caution`;
        regime_confidence = 0.5;
      }
    }

    return {
      allows_direction,
      regime_confidence,
      regime,
      gate_reason,
      diagnostics: {
        volatility_regime: vol.volatility_regime,
        volatility_trend: vol.volatility_trend,
        atr_slope: vol.atr_slope,
        range_vs_trend: trend.range_vs_trend,
        momentum_direction: momentum.momentum_direction,
        momentum_strength: momentum.momentum_strength
      }
    };
  }

  /**
   * Calculate ATR for given period
   */
  private static calculateATR(ticks: MarketTick[], period: number): number {
    const trues: number[] = [];
    for (let i = 1; i < ticks.length; i++) {
      const high = ticks[i].high;
      const low = ticks[i].low;
      const prevClose = ticks[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trues.push(tr);
    }

    const atr = trues.slice(-period).reduce((a, b) => a + b, 0) / period;
    return atr;
  }
}
