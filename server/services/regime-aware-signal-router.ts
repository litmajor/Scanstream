/**
 * Regime-Aware Signal Router
 * 
 * Dynamically adjusts strategy weights based on market regime
 * 
 * Market Regimes:
 * - TRENDING (UPTREND/DOWNTREND): Gradient direction is king (35-40%)
 * - SIDEWAYS/RANGING: UT Bot volatility is king (30-35%), mean-reversion edge
 * - HIGH_VOLATILITY: UT Bot trailing stops crucial (35-40%), protect capital
 * - BREAKOUT: Market Structure swing analysis (30%), + Flow Field energy (25%)
 * - QUIET: ML confirmation dominant (20%), reduced sizing across board
 */

import { StrategyContribution } from './unified-signal-aggregator';

export interface MarketRegime {
  type: 'TRENDING' | 'SIDEWAYS' | 'HIGH_VOLATILITY' | 'BREAKOUT' | 'QUIET';
  strength: number; // 0-100, how confident in this regime classification
  characteristics: string[];
  volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  trendStrength: number; // 0-100, from ADX-like calculation
  rangeWidth: number; // 0-1, how wide is the range
}

export interface RegimeAdjustedWeights {
  gradientDirection: number;
  marketStructure: number;
  utBotVolatility: number;
  flowFieldEnergy: number;
  mlPredictions: number;
  patternDetection: number; // NEW: Pattern detection + confluence
  volumeMetrics: number;     // NEW: Volume confirmation strength
  reasoning: string[];
}

export class RegimeAwareSignalRouter {
  /**
   * Detect current market regime from available data
   */
  static detectRegime(
    volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME',
    trendStrength: number, // 0-100 (from ADX)
    rangeWidth: number, // 0-1 (high/low / close)
    volatilityTrend: 'RISING' | 'STABLE' | 'FALLING',
    priceVsMA: number, // -1 to +1, price vs moving average
    recentSwings: number // count of recent swings (structure breaks)
  ): MarketRegime {
    const characteristics: string[] = [];

    // TRENDING detection
    if (trendStrength > 60 && volatilityLevel !== 'EXTREME') {
      const direction = priceVsMA > 0 ? 'uptrend' : 'downtrend';
      characteristics.push(`Strong ${direction} (ADX: ${trendStrength.toFixed(0)})`);
      
      return {
        type: 'TRENDING',
        strength: Math.min(100, trendStrength + 10),
        characteristics,
        volatilityLevel,
        trendStrength,
        rangeWidth
      };
    }

    // HIGH_VOLATILITY detection
    if (volatilityLevel === 'EXTREME' || (volatilityLevel === 'HIGH' && volatilityTrend === 'RISING')) {
      characteristics.push(`Extreme volatility (${volatilityLevel})`);
      characteristics.push(volatilityTrend === 'RISING' ? 'Volatility expanding' : 'Volatility extreme');
      
      return {
        type: 'HIGH_VOLATILITY',
        strength: 85,
        characteristics,
        volatilityLevel,
        trendStrength,
        rangeWidth
      };
    }

    // BREAKOUT detection (structure breaks + volatility spike)
    if (recentSwings > 3 && volatilityLevel === 'HIGH') {
      characteristics.push('Multiple structure breaks detected');
      characteristics.push('Potential breakout scenario');
      
      return {
        type: 'BREAKOUT',
        strength: 75,
        characteristics,
        volatilityLevel,
        trendStrength,
        rangeWidth
      };
    }

    // SIDEWAYS/RANGING detection
    if (trendStrength < 40 && rangeWidth < 0.05 && volatilityLevel !== 'EXTREME') {
      characteristics.push('Tight range, low trend strength');
      characteristics.push('Mean reversion conditions');
      characteristics.push(`Range width: ${(rangeWidth * 100).toFixed(1)}%`);
      
      return {
        type: 'SIDEWAYS',
        strength: Math.min(100, 100 - trendStrength),
        characteristics,
        volatilityLevel,
        trendStrength,
        rangeWidth
      };
    }

    // QUIET detection (low volatility + weak trend)
    if (volatilityLevel === 'LOW' && trendStrength < 35) {
      characteristics.push('Low volatility + weak trend');
      characteristics.push('Reduced signal reliability');
      
      return {
        type: 'QUIET',
        strength: 70,
        characteristics,
        volatilityLevel,
        trendStrength,
        rangeWidth
      };
    }

    // Default: fallback to trending weak signal
    characteristics.push('Mixed conditions, default weighting');
    return {
      type: 'TRENDING',
      strength: 50,
      characteristics,
      volatilityLevel,
      trendStrength,
      rangeWidth
    };
  }

  /**
   * Adjust strategy weights based on regime
   * 
   * Default weights (TRENDING):
   * - Gradient: 35% (trend backbone)
   * - Market Structure: 25% (swing analysis)
   * - UT Bot: 20% (volatility quality)
   * - Flow Field: 15% (energy confirmation)
   * - ML: 5% (confirmation only)
   * 
   * Adapted by regime for better performance
   */
  static getRegimeAdjustedWeights(regime: MarketRegime): RegimeAdjustedWeights {
    const reasoning: string[] = [];

    switch (regime.type) {
      // ========== TRENDING: Gradient dominates ==========
      case 'TRENDING':
        reasoning.push('Trending market: Gradient direction is reliable');
        reasoning.push('Follow trend with structure breaks for entries');
        reasoning.push('Patterns validate trend direction (MA crosses, breakouts)');
        reasoning.push('Volume confirms trend strength');
        return {
          gradientDirection: 0.35,      // Trend backbone
          marketStructure: 0.20,        // Swings confirm trend
          utBotVolatility: 0.10,        // Less relevant in trends
          flowFieldEnergy: 0.10,        // Flow confirmation
          mlPredictions: 0.05,          // ML backup
          patternDetection: 0.10,       // Patterns validate trend (MA crosses, breakouts)
          volumeMetrics: 0.10,          // Volume confirms continuation
          reasoning
        };

      // ========== SIDEWAYS: UT Bot (Mean Reversion) dominates ==========
      case 'SIDEWAYS':
        reasoning.push('Sideways market: Gradient unreliable, use mean-reversion');
        reasoning.push('UT Bot trailing stops = entry/exit signals');
        reasoning.push('Buy near support, sell near resistance');
        reasoning.push('Patterns detect support bounces and resistance breaks');
        reasoning.push('Volume surges confirm breakout attempts out of range');
        return {
          gradientDirection: 0.08,      // Reduce gradient (not trending)
          marketStructure: 0.15,        // Support/resistance from structure
          utBotVolatility: 0.35,        // UT Bot leads: trailing stops = pivot points
          flowFieldEnergy: 0.12,        // Flow energy helps confirm reversals
          mlPredictions: 0.08,          // ML models often good at ranges
          patternDetection: 0.14,       // Patterns detect support bounces + confluences
          volumeMetrics: 0.08,          // Volume spikes signal breakout attempts
          reasoning
        };

      // ========== HIGH_VOLATILITY: UT Bot (capital protection) dominates ==========
      case 'HIGH_VOLATILITY':
        reasoning.push('High volatility: Protect capital first');
        reasoning.push('UT Bot trailing stops = dynamic risk management');
        reasoning.push('Reduced position sizing across all signals');
        reasoning.push('Patterns help identify volatility-driven fakeouts');
        reasoning.push('Volume spikes often false breakouts in extreme vol');
        return {
          gradientDirection: 0.08,      // Reduce (whipsaws in vol spikes)
          marketStructure: 0.06,        // Reduce (structure breaks are fakes)
          utBotVolatility: 0.42,        // UT Bot leads: close protective stops
          flowFieldEnergy: 0.22,        // Flow field turbulence info crucial
          mlPredictions: 0.08,          // ML can adapt to vol regime
          patternDetection: 0.06,       // Patterns less reliable in extreme vol
          volumeMetrics: 0.08,          // Volume but watch for fakes
          reasoning
        };

      // ========== BREAKOUT: Structure + Energy dominates ==========
      case 'BREAKOUT':
        reasoning.push('Breakout scenario: Structure breaks are high-probability');
        reasoning.push('Flow Field energy confirming breakout direction');
        reasoning.push('Patterns detect breakouts (Bollinger breaks, MA crosses)');
        reasoning.push('Volume SURGE critical for confirming breakout validity');
        reasoning.push('Large position sizing for breakout trades');
        return {
          gradientDirection: 0.12,      // Gradient confirms direction post-break
          marketStructure: 0.25,        // Structure breaks are primary (HH/LL)
          utBotVolatility: 0.08,        // Trailing stops for momentum capture
          flowFieldEnergy: 0.18,        // Energy acceleration = breakout confirmation
          mlPredictions: 0.04,          // Least useful in breakouts
          patternDetection: 0.18,       // Patterns detect breakouts (Bollinger, MA crosses)
          volumeMetrics: 0.15,          // Volume SURGE validates real breakout
          reasoning
        };

      // ========== QUIET: Reduced trading, ML confirmation ==========
      case 'QUIET':
        reasoning.push('Quiet market: Low signal reliability overall');
        reasoning.push('Reduce position sizing 50%');
        reasoning.push('Patterns less reliable with low conviction');
        reasoning.push('Wait for regime shift or volume surge (breakout signal)');
        reasoning.push('ML models: only trade when high confidence');
        return {
          gradientDirection: 0.18,      // Reduce all
          marketStructure: 0.12,
          utBotVolatility: 0.12,
          flowFieldEnergy: 0.12,
          mlPredictions: 0.22,          // ML gets boost (best at identifying quiets)
          patternDetection: 0.12,       // Patterns less reliable
          volumeMetrics: 0.12,          // Wait for volume to signal breakout
          reasoning
        };

      default:
        return {
          gradientDirection: 0.35,
          marketStructure: 0.25,
          utBotVolatility: 0.20,
          flowFieldEnergy: 0.10,
          mlPredictions: 0.05,
          patternDetection: 0.03,
          volumeMetrics: 0.02,
          reasoning: ['Default weighting (TRENDING)']
        };
    }
  }

  /**
   * Adjust contribution weights to match regime
   * 
   * Takes strategy contributions and reweights them dynamically
   */
  static reweightContributions(
    contributions: StrategyContribution[],
    regime: MarketRegime
  ): StrategyContribution[] {
    const weights = this.getRegimeAdjustedWeights(regime);
    
    return contributions.map(contrib => {
      let newWeight = contrib.weight; // default

      if (contrib.name.toLowerCase().includes('gradient')) {
        newWeight = weights.gradientDirection;
      } else if (contrib.name.toLowerCase().includes('market structure')) {
        newWeight = weights.marketStructure;
      } else if (contrib.name.toLowerCase().includes('ut bot')) {
        newWeight = weights.utBotVolatility;
      } else if (contrib.name.toLowerCase().includes('flow field')) {
        newWeight = weights.flowFieldEnergy;
      } else if (contrib.name.toLowerCase().includes('ml')) {
        newWeight = weights.mlPredictions;
      }

      return {
        ...contrib,
        weight: newWeight
      };
    });
  }

  /**
   * Calculate position sizing multiplier based on regime
   * 
   * TRENDING: 1.0x (normal sizing)
   * SIDEWAYS: 1.2x (mean-reversion trades have better win rate)
   * HIGH_VOLATILITY: 0.5x (capital protection)
   * BREAKOUT: 1.5x (larger breakout trades)
   * QUIET: 0.6x (reduce trading, wait for clarity)
   */
  static getRegimeSizingMultiplier(regime: MarketRegime): number {
    const multipliers: Record<MarketRegime['type'], number> = {
      'TRENDING': 1.0,
      'SIDEWAYS': 1.2,
      'HIGH_VOLATILITY': 0.5,
      'BREAKOUT': 1.5,
      'QUIET': 0.6
    };

    return multipliers[regime.type];
  }

  /**
   * Get regime-specific entry and exit rules
   */
  static getRegimeRules(regime: MarketRegime): {
    entryRule: string;
    exitRule: string;
    stoplossMultiplier: number;
    takeprofitMultiplier: number;
  } {
    switch (regime.type) {
      case 'TRENDING':
        return {
          entryRule: 'Buy on pullbacks to EMA20 in uptrend, sell on rallies to EMA20 in downtrend',
          exitRule: 'Take profit at 2x risk or trailing stop breakthrough',
          stoplossMultiplier: 1.5,    // 1.5x ATR
          takeprofitMultiplier: 2.0   // 2x ATR
        };

      case 'SIDEWAYS':
        return {
          entryRule: 'Buy at support/UT Bot trailing stop from above, sell at resistance/trailing stop from below',
          exitRule: 'Take profit at opposite support/resistance or 1.5x risk',
          stoplossMultiplier: 1.0,    // 1.0x ATR (tighter stops in ranges)
          takeprofitMultiplier: 1.5   // 1.5x ATR (smaller targets in ranges)
        };

      case 'HIGH_VOLATILITY':
        return {
          entryRule: 'Wait for UT Bot trailing stop confirmation + Flow Field alignment',
          exitRule: 'Exit quickly on any reversal signal, protect capital',
          stoplossMultiplier: 1.0,    // Tight stops (volatility can reverse fast)
          takeprofitMultiplier: 1.0   // Small targets (book profits quick)
        };

      case 'BREAKOUT':
        return {
          entryRule: 'Enter on structure break (HH in upbreak, LL in downbreak) + energy acceleration',
          exitRule: 'Trailing stop at previous swing level or 3x risk (larger targets)',
          stoplossMultiplier: 1.5,    // Allow room for breakout fakeouts
          takeprofitMultiplier: 3.0   // Larger profit targets on breakouts
        };

      case 'QUIET':
        return {
          entryRule: 'Only enter on ML strong confidence signals (>75%)',
          exitRule: 'Exit at first sign of market shifting regime',
          stoplossMultiplier: 0.8,    // Tight stops (low vol means fakes don't move far)
          takeprofitMultiplier: 1.2   // Small targets (low vol = small moves)
        };

      default:
        return {
          entryRule: 'Default rules',
          exitRule: 'Default rules',
          stoplossMultiplier: 1.5,
          takeprofitMultiplier: 2.0
        };
    }
  }

  /**
   * Get recommended signal filtering threshold by regime
   * 
   * Only trade signals above this agreement threshold
   */
  static getMinAgreementThreshold(regime: MarketRegime): number {
    switch (regime.type) {
      case 'TRENDING': return 0.55;      // Trending: accept more signals
      case 'SIDEWAYS': return 0.60;      // Sideways: need moderate agreement
      case 'HIGH_VOLATILITY': return 0.70; // Vol: need high confidence
      case 'BREAKOUT': return 0.65;      // Breakout: above average
      case 'QUIET': return 0.75;         // Quiet: only best signals
      default: return 0.60;
    }
  }
}

export default RegimeAwareSignalRouter;
