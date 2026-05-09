/**
 * UNIFIED REGIME CLASSIFICATION SYSTEM
 * 
 * Single source of truth for all regime detection across the platform.
 * Consolidates 9 fragmented regime detection systems into 1 canonical system.
 * 
 * Replaces:
 *   - regimeClassifier.ts (VFMD system)
 *   - market-regime-detector.ts
 *   - ml-regime-detector.ts
 *   - regime-assessment.ts
 *   - ml-regime-ensemble.ts
 *   - regime-aware-signal-router.ts (partial)
 *   - regime-thresholds.ts (partial)
 * 
 * All consumers migrate to this unified system without breaking changes.
 */

export const UnifiedRegimes = {
  // Directional trends (clear ADX > 25)
  TRENDING_UP: 'TRENDING_UP',
  TRENDING_DOWN: 'TRENDING_DOWN',

  // Range-bound (low ADX < 20)
  RANGING: 'RANGING',

  // High volatility (ATR > threshold)
  VOLATILE: 'VOLATILE',

  // Low energy, building compression (Bollinger Band width tightening)
  CONSOLIDATING: 'CONSOLIDATING',

  // Smart money patterns (VFMD-specific, but unified)
  ACCUMULATION: 'ACCUMULATION',      // Buyers building at lows
  DISTRIBUTION: 'DISTRIBUTION',      // Sellers exiting at highs

  // Breakout imminent (maximum compression)
  BREAKOUT_TRANSITION: 'BREAKOUT_TRANSITION',
} as const;

export type UnifiedRegimeType = typeof UnifiedRegimes[keyof typeof UnifiedRegimes];

/**
 * Regime characteristics for trading decisions
 */
export interface RegimeCharacteristics {
  description: string;
  positionSize: number;       // 0-1 multiplier for risk management
  stopDistance: number;       // 0-1 multiplier (tighter in trending)
  targetSize: number;         // 0-1 multiplier (larger in breakout)
  profitFactor: number;       // Expected profit factor (1.5-3.0)
  maxDrawdown: number;        // Expected max drawdown %
  tradingImplications: string[];
  aggressiveness: 'PASSIVE' | 'MODERATE' | 'AGGRESSIVE';
}

/**
 * Regime detection result
 */
export interface RegimeDetectionResult {
  regime: UnifiedRegimeType;
  confidence: number;         // 0-1, how sure we are
  strength: number;           // 0-100, magnitude of regime
  indicators: {
    adx: number;              // 0-100, trend strength
    volatility: number;       // ATR as % of price
    divergence: number;       // -1 to +1, buyer vs seller conviction
    coherence: number;        // 0-1, how aligned all signals are
    compression: number;      // 0-1, Bollinger Band width
  };
}

/**
 * Regime transition tracking
 */
export interface RegimeTransition {
  from: UnifiedRegimeType;
  to: UnifiedRegimeType;
  timestamp: number;
  confidence: number;
  reason: string;
}

/**
 * Mapping matrix: Convert from any system to unified
 */
export const RegimeMapper = {
  // From VFMD Physics Agent (6 regimes)
  vfmd: {
    'laminar_trend': 'TRENDING_UP',
    'turbulent_chop': 'VOLATILE',
    'accumulation': 'ACCUMULATION',
    'distribution': 'DISTRIBUTION',
    'breakout_transition': 'BREAKOUT_TRANSITION',
    'consolidation': 'CONSOLIDATING',
  },

  // From ML Regime Detector (6 regimes)
  ml: {
    'TRENDING_UP': 'TRENDING_UP',
    'TRENDING_DOWN': 'TRENDING_DOWN',
    'RANGING': 'RANGING',
    'VOLATILE': 'VOLATILE',
    'CONSOLIDATING': 'CONSOLIDATING',
    'UNKNOWN': 'RANGING',
  },

  // From Market Regime Detector (3 regimes + volatility)
  scanner: {
    'bull': 'TRENDING_UP',
    'bear': 'TRENDING_DOWN',
    'ranging': 'RANGING',
    'low_vol': 'CONSOLIDATING',
    'medium_vol': 'RANGING',
    'high_vol': 'VOLATILE',
  },

  // From Signal Router (5 regimes)
  router: {
    'TRENDING': 'TRENDING_UP',
    'SIDEWAYS': 'RANGING',
    'HIGH_VOLATILITY': 'VOLATILE',
    'BREAKOUT': 'BREAKOUT_TRANSITION',
    'QUIET': 'CONSOLIDATING',
  },

  // From Live Velocity Calculator (3 regimes)
  velocity: {
    'BULL': 'TRENDING_UP',
    'BEAR': 'TRENDING_DOWN',
    'SIDEWAYS': 'RANGING',
  },

  // From Regime Assessment (5 regimes)
  assessment: {
    'TRENDING_UP': 'TRENDING_UP',
    'TRENDING_DOWN': 'TRENDING_DOWN',
    'RANGING': 'RANGING',
    'VOLATILE': 'VOLATILE',
    'CONSOLIDATING': 'CONSOLIDATING',
  },

  // Generic lowercase variants
  generic: {
    'up': 'TRENDING_UP',
    'down': 'TRENDING_DOWN',
    'range': 'RANGING',
    'sideways': 'RANGING',
    'chop': 'VOLATILE',
    'quiet': 'CONSOLIDATING',
    'consolidation': 'CONSOLIDATING',
    'accumulation': 'ACCUMULATION',
    'distribution': 'DISTRIBUTION',
  },
} as const;

/**
 * Central regime detection orchestrator
 * Combines signals from all detection methods and returns unified regime
 */
export class UnifiedRegimeDetector {
  /**
   * Detect regime from raw market data
   * This is the canonical detection method - all systems should use this
   */
  static detectRegime(params: {
    adx: number;              // 0-100, trend strength (use ADX indicator)
    volatility: number;       // 0-1, normalized ATR % (use ATR/price)
    priceVsMA: number;        // -1 to +1, price vs 50-MA (-1=far below, 0=at, +1=far above)
    rangeWidth: number;       // 0-1, (high-low)/(open+close)/2 normalized
    divergence: number;       // -1 to +1, buying pressure (-1=selling, 0=balanced, +1=buying)
    coherence: number;        // 0-1, how aligned are all signals (1=perfect alignment)
    momentum: number;         // -1 to +1, price momentum direction
    rsi?: number;             // 0-100, RSI for overbought/oversold context
  }): RegimeDetectionResult {
    const {
      adx,
      volatility,
      priceVsMA,
      rangeWidth,
      divergence,
      coherence,
      momentum,
      rsi = 50,
    } = params;

    let regime: UnifiedRegimeType = 'RANGING';
    let confidence = 0.5;
    let strength = 50;

    // Decision tree for regime classification

    // 1. EXTREME VOLATILITY - always takes priority
    if (volatility > 0.08) {
      confidence = Math.min(volatility, 1);
      strength = Math.round(volatility * 100);
      return {
        regime: 'VOLATILE',
        confidence,
        strength,
        indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
      };
    }

    // 2. CONSOLIDATING - very tight compression + low ADX
    if (rangeWidth < 0.015 && adx < 20 && volatility < 0.02) {
      confidence = 0.85;
      strength = Math.round((1 - volatility / 0.02) * 100);
      return {
        regime: 'CONSOLIDATING',
        confidence,
        strength,
        indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
      };
    }

    // 3. BREAKOUT_TRANSITION - maximum compression before breakout
    if (rangeWidth < 0.008 && volatility < 0.015 && adx < 15 && coherence > 0.8) {
      confidence = Math.min(0.9, coherence);
      strength = Math.round((1 - rangeWidth / 0.008) * 100);
      return {
        regime: 'BREAKOUT_TRANSITION',
        confidence,
        strength,
        indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
      };
    }

    // 4. ACCUMULATION - buyers quietly building (low vol, rising, low RSI recovery)
    if (
      volatility < 0.03 &&
      divergence > 0.3 &&
      priceVsMA < 0 &&
      rsi < 45 &&
      coherence > 0.7
    ) {
      confidence = Math.min(0.8, coherence);
      strength = Math.round((divergence * 0.5 + coherence * 0.5) * 100);
      return {
        regime: 'ACCUMULATION',
        confidence,
        strength,
        indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
      };
    }

    // 5. DISTRIBUTION - sellers quietly exiting (low vol, falling, high RSI failure)
    if (
      volatility < 0.03 &&
      divergence < -0.3 &&
      priceVsMA > 0 &&
      rsi > 55 &&
      coherence > 0.7
    ) {
      confidence = Math.min(0.8, coherence);
      strength = Math.round((Math.abs(divergence) * 0.5 + coherence * 0.5) * 100);
      return {
        regime: 'DISTRIBUTION',
        confidence,
        strength,
        indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
      };
    }

    // 6. STRONG TRENDING - High ADX > 25 with clear direction
    if (adx > 25) {
      if (priceVsMA > 0.1 && momentum > 0) {
        // TRENDING_UP
        confidence = Math.min(adx / 100, 0.95);
        strength = Math.round(adx);
        return {
          regime: 'TRENDING_UP',
          confidence,
          strength,
          indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
        };
      } else if (priceVsMA < -0.1 && momentum < 0) {
        // TRENDING_DOWN
        confidence = Math.min(adx / 100, 0.95);
        strength = Math.round(adx);
        return {
          regime: 'TRENDING_DOWN',
          confidence,
          strength,
          indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
        };
      }
    }

    // 7. WEAK TRENDING - ADX 15-25, some direction
    if (adx > 15 && adx <= 25) {
      if (priceVsMA > 0.05 && momentum >= 0) {
        confidence = Math.min(adx / 50, 0.75);
        strength = Math.round(adx);
        return {
          regime: 'TRENDING_UP',
          confidence,
          strength,
          indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
        };
      } else if (priceVsMA < -0.05 && momentum <= 0) {
        confidence = Math.min(adx / 50, 0.75);
        strength = Math.round(adx);
        return {
          regime: 'TRENDING_DOWN',
          confidence,
          strength,
          indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
        };
      }
    }

    // 8. RANGING - Default for low ADX + medium volatility
    if (adx < 25 && volatility < 0.05) {
      confidence = 0.7;
      strength = Math.round((1 - adx / 40) * 100);
      return {
        regime: 'RANGING',
        confidence,
        strength,
        indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
      };
    }

    // 9. DEFAULT - When nothing else matches
    return {
      regime: 'RANGING',
      confidence: 0.5,
      strength: 50,
      indicators: { adx, volatility, divergence, coherence, compression: rangeWidth },
    };
  }

  /**
   * Convert from any regime system to unified
   * Safe fallback to RANGING for unknown inputs
   */
  static mapToUnified(regime: string, source: keyof typeof RegimeMapper): UnifiedRegimeType {
    const normalizedRegime = regime.toLowerCase();
    const mapping = RegimeMapper[source] as Record<string, UnifiedRegimeType>;
    
    if (mapping && mapping[normalizedRegime]) {
      return mapping[normalizedRegime];
    }

    // Fallback for unknown regimes
    console.warn(
      `[UnifiedRegime] Unknown regime "${regime}" from source "${source}", defaulting to RANGING`
    );
    return 'RANGING';
  }

  /**
   * Get regime characteristics for trading decisions
   * Used by position sizing, stop placement, target calculation
   */
  static getCharacteristics(regime: UnifiedRegimeType): RegimeCharacteristics {
    const characteristics: Record<UnifiedRegimeType, RegimeCharacteristics> = {
      TRENDING_UP: {
        description: '📈 Strong uptrend with clear direction',
        positionSize: 1.0,
        stopDistance: 0.8,      // Tighter stops in trending
        targetSize: 1.2,
        profitFactor: 2.5,
        maxDrawdown: 8,
        tradingImplications: [
          '✅ Favor long positions',
          '🎯 Use tight trailing stops',
          '💡 Buy dips within trend',
          '⚠️ Avoid shorting',
        ],
        aggressiveness: 'AGGRESSIVE',
      },

      TRENDING_DOWN: {
        description: '📉 Strong downtrend with clear direction',
        positionSize: 1.0,
        stopDistance: 0.8,
        targetSize: 1.2,
        profitFactor: 2.5,
        maxDrawdown: 8,
        tradingImplications: [
          '✅ Favor short positions',
          '🎯 Use tight trailing stops',
          '💡 Short rallies within trend',
          '⚠️ Avoid longs',
        ],
        aggressiveness: 'AGGRESSIVE',
      },

      RANGING: {
        description: '↔️ Range-bound market, sideways movement',
        positionSize: 0.7,
        stopDistance: 1.0,
        targetSize: 0.8,
        profitFactor: 1.8,
        maxDrawdown: 12,
        tradingImplications: [
          '🔄 Fade extremes (support/resistance)',
          '📊 Buy support, sell resistance',
          '⏱️ Use tighter stops',
          '⚠️ Reduce position size',
        ],
        aggressiveness: 'MODERATE',
      },

      VOLATILE: {
        description: '⚡ High volatility, unclear direction',
        positionSize: 0.4,
        stopDistance: 1.5,
        targetSize: 0.5,
        profitFactor: 1.5,
        maxDrawdown: 20,
        tradingImplications: [
          '⚠️ Significantly reduce position size',
          '📏 Increase stop distance',
          '🎯 Focus on quality setups only',
          '⏸️ Consider sitting out',
        ],
        aggressiveness: 'PASSIVE',
      },

      CONSOLIDATING: {
        description: '🔘 Low energy, building volatility before breakout',
        positionSize: 0.6,
        stopDistance: 1.2,
        targetSize: 1.5,
        profitFactor: 2.2,
        maxDrawdown: 10,
        tradingImplications: [
          '👀 Watch for breakout confirmation',
          '🎯 Small positions OK',
          '🔔 Monitor volume spike',
          '⏳ Prepare for big move',
        ],
        aggressiveness: 'MODERATE',
      },

      ACCUMULATION: {
        description: '🤫 Smart money quietly buying at lows',
        positionSize: 0.9,
        stopDistance: 0.9,
        targetSize: 1.3,
        profitFactor: 2.8,
        maxDrawdown: 6,
        tradingImplications: [
          '💼 Strong institutional accumulation signal',
          '📈 High probability reversal setup',
          '✅ Build long positions gradually',
          '🎯 Tight stops',
        ],
        aggressiveness: 'AGGRESSIVE',
      },

      DISTRIBUTION: {
        description: '🤫 Smart money quietly selling at highs',
        positionSize: 0.6,
        stopDistance: 0.9,
        targetSize: 0.7,
        profitFactor: 1.9,
        maxDrawdown: 10,
        tradingImplications: [
          '💼 Strong institutional distribution signal',
          '📉 High probability reversal setup',
          '❌ Reduce longs, avoid new longs',
          '🎯 Consider short bias',
        ],
        aggressiveness: 'PASSIVE',
      },

      BREAKOUT_TRANSITION: {
        description: '💥 Energy compressed, big move coming',
        positionSize: 1.2,
        stopDistance: 0.7,
        targetSize: 1.8,
        profitFactor: 3.2,
        maxDrawdown: 5,
        tradingImplications: [
          '🚀 Highest conviction entry opportunity',
          '📊 Maximum position size acceptable',
          '🎯 Tight stops, large targets',
          '⚡ Most aggressive trading mode',
        ],
        aggressiveness: 'AGGRESSIVE',
      },
    };

    return characteristics[regime] || characteristics.RANGING;
  }

  /**
   * Detect regime transitions (when market changes regimes)
   * Useful for alert systems and strategy rebalancing
   */
  static detectTransition(
    previousRegime: UnifiedRegimeType,
    currentRegime: UnifiedRegimeType,
    confidence: number
  ): RegimeTransition | null {
    // Only consider it a real transition if confidence is high
    if (confidence < 0.6) return null;

    // Same regime = no transition
    if (previousRegime === currentRegime) return null;

    // Build transition reason
    const reasons: Record<string, string> = {
      [`${previousRegime}→${currentRegime}`]: `Transitioned from ${previousRegime} to ${currentRegime}`,
    };

    return {
      from: previousRegime,
      to: currentRegime,
      timestamp: Date.now(),
      confidence,
      reason: `Market changed from ${previousRegime} to ${currentRegime} (${(confidence * 100).toFixed(0)}% confidence)`,
    };
  }

  /**
   * Multi-timeframe regime voting
   * Combines regimes from multiple timeframes for stronger signals
   */
  static multiTimeframeVoting(
    regimes: Array<{ regime: UnifiedRegimeType; confidence: number; timeframe: string }>
  ): { consensus: UnifiedRegimeType; confidence: number; agreement: number } {
    if (regimes.length === 0) {
      return {
        consensus: 'RANGING',
        confidence: 0.5,
        agreement: 0,
      };
    }

    // Weight each regime by timeframe importance and confidence
    const weights: Record<string, number> = {
      '1H': 1.0,
      '4H': 1.5,
      '1D': 2.0,    // Daily most important
      '1W': 1.5,
    };

    const scored = regimes.map(r => ({
      ...r,
      score: (r.confidence * 100) * (weights[r.timeframe] || 1),
    }));

    // Group by regime and sum scores
    const regimeScores = new Map<UnifiedRegimeType, number>();
    let totalScore = 0;

    for (const { regime, score } of scored) {
      regimeScores.set(regime, (regimeScores.get(regime) || 0) + score);
      totalScore += score;
    }

    // Find winning regime
    let consensus: UnifiedRegimeType = 'RANGING';
    let maxScore = 0;

    for (const [regime, score] of regimeScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        consensus = regime;
      }
    }

    const confidenceScore = maxScore / totalScore;
    const agreementPercent =
      (regimes.filter(r => r.regime === consensus).length / regimes.length) * 100;

    return {
      consensus,
      confidence: confidenceScore,
      agreement: agreementPercent,
    };
  }

  /**
   * Regime strength scorer
   * 0-100 scale where 100 = maximum conviction for this regime
   */
  static calculateRegimeStrength(indicators: {
    adx: number;
    volatility: number;
    divergence: number;
    coherence: number;
    compression: number;
  }): number {
    const { adx, volatility, divergence, coherence, compression } = indicators;

    // Different calculations per regime
    // Trending strength = ADX
    // Consolidating strength = coherence * (1 - compression)
    // Volatile strength = volatility
    // etc.

    const trendingStrength = Math.min(adx, 100);
    const consolidatingStrength = coherence * 100 * (1 - compression);
    const volatileStrength = volatility * 100;

    // Average all signals for overall strength
    const avgStrength = (trendingStrength + consolidatingStrength + volatileStrength) / 3;
    return Math.round(Math.min(avgStrength, 100));
  }
}

/**
 * Helper function: Convert from any source to unified regime
 * Shorthand for mapToUnified
 */
export const mapRegime = (
  regime: string,
  source: keyof typeof RegimeMapper
): UnifiedRegimeType => UnifiedRegimeDetector.mapToUnified(regime, source);

/**
 * Helper function: Get regime characteristics
 * Shorthand for getCharacteristics
 */
export const getRegimeConfig = (regime: UnifiedRegimeType): RegimeCharacteristics =>
  UnifiedRegimeDetector.getCharacteristics(regime);

export default UnifiedRegimeDetector;
