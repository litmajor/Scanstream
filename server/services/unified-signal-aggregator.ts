/**
 * Unified Signal Aggregator
 * 
 * Instead of strategies generating independent signals, they contribute insights:
 * - Gradient Direction (primary trend + shift markers)
 * - Flow Field (energy, acceleration, turbulence)
 * - UT Bot (volatility, trailing stop quality)
 * - Market Engine (structure breaks, swing analysis)
 * - ML Models (direction, price targets, holding periods)
 * - Volatility Analysis (ATR, regime changes)
 * 
 * Result: Single coherent signal with full transparency on contributing factors
 */

export interface StrategyContribution {
  name: string;
  weight: number; // 0-1, how much this strategy influences the final signal
  trend?: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength?: number; // 0-100, signal strength from this strategy
  volatility?: number; // Current volatility contribution
  momentum?: number; // -1 to +1, momentum score
  confidence?: number; // 0-1, how confident is this strategy
  buySignals?: number; // Count of buy signals from this strategy
  sellSignals?: number; // Count of sell signals from this strategy
  energyTrend?: 'ACCELERATING' | 'STABLE' | 'DECELERATING'; // From flow field
  trendShiftMarker?: boolean; // Gradient detected trend change
  reason: string; // Why this strategy contributes what it does
}

export interface UnifiedSignal {
  // Primary direction from gradient
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  strength: number; // 0-100

  // Trend information (gradient-based)
  trend: {
    direction: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    strength: number; // 0-100 (from ADX-like calculation)
    trendShiftDetected: boolean; // Gradient marker
    timeframesAligned: string[]; // Which timeframes agree
  };

  // Market structure (from market engine)
  structure: {
    breakoutDetected: boolean;
    supportLevel: number;
    resistanceLevel: number;
    trendStartTime: number;
    reversalLikelihood: number; // 0-1
  };

  // Energy metrics (from flow field)
  energy: {
    currentForce: number; // 0-100
    turbulence: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    energyTrend: 'ACCELERATING' | 'STABLE' | 'DECELERATING';
    pressureTrend: 'RISING' | 'FALLING' | 'STABLE';
  };

  // Volatility metrics (from UT Bot + ATR analysis)
  volatility: {
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    atr: number;
    atrPercent: number; // ATR as % of price
    regimeShift: boolean; // Volatility changed significantly
  };

  // Position sizing recommendations
  sizing: {
    baseMultiplier: number; // 0.5-2.0 from confidence
    volatilityAdjustment: number; // Volatility reduction factor
    trendAlignment: number; // Boost for aligned trades
    finalMultiplier: number; // Combined multiplier
  };

  // Contributing strategies with transparency
  contributions: StrategyContribution[];
  agreementScore: number; // % of strategies agreeing on direction

  // Risk metrics
  risk: {
    score: number; // 0-100
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    factors: string[];
    recommendedStopLoss: number;
  };

  // Metadata
  metadata: {
    timestamp: number;
    symbol: string;
    timeframe: string;
    priceLevel: number;
    backtestKey?: string;
    debugInfo?: Record<string, any>;
  };
}

export class UnifiedSignalAggregator {
  /**
   * Aggregate signals from all strategies into single coherent signal
   */
  static aggregate(
    symbol: string,
    currentPrice: number,
    timeframe: string,
    contributions: StrategyContribution[]
  ): UnifiedSignal {
    if (contributions.length === 0) {
      throw new Error('No strategy contributions provided');
    }

    // Calculate weighted trends
    const weightedBullish = contributions
      .filter(c => c.trend === 'BULLISH')
      .reduce((sum, c) => sum + (c.weight * (c.confidence || 0.5)), 0);
    
    const weightedBearish = contributions
      .filter(c => c.trend === 'BEARISH')
      .reduce((sum, c) => sum + (c.weight * (c.confidence || 0.5)), 0);

    const weightedSideways = contributions
      .filter(c => c.trend === 'SIDEWAYS')
      .reduce((sum, c) => sum + (c.weight * (c.confidence || 0.5)), 0);

    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0) || 1;

    // Determine primary direction
    let direction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' = 'SIDEWAYS';
    
    const bullishPct = (weightedBullish / totalWeight) * 100;
    const bearishPct = (weightedBearish / totalWeight) * 100;
    const sidewaysPct = (weightedSideways / totalWeight) * 100;

    if (bullishPct > 60) {
      direction = 'BUY';
      trendDirection = 'BULLISH';
    } else if (bearishPct > 60) {
      direction = 'SELL';
      trendDirection = 'BEARISH';
    } else {
      direction = 'HOLD';
      trendDirection = 'SIDEWAYS';
    }

    // Confidence: blend of strategy confidences weighted by agreement
    const avgConfidence = contributions.reduce((sum, c) => sum + (c.confidence || 0.5), 0) / contributions.length;
    const agreementScore = Math.max(bullishPct, bearishPct, sidewaysPct);
    const confidence = (avgConfidence * 0.4) + ((agreementScore / 100) * 0.6);

    // Trend strength from contributions
    const trendStrength = contributions
      .reduce((sum, c) => sum + (c.strength || 0) * c.weight, 0) / totalWeight;

    // Trend shift detection (from gradient)
    const gradientContrib = contributions.find(c => c.name.toLowerCase().includes('gradient'));
    const trendShiftDetected = gradientContrib?.trendShiftMarker || false;

    // Volatility aggregation
    const avgVolatility = contributions
      .reduce((sum, c) => sum + (c.volatility || 0.5), 0) / contributions.length;
    
    let volatilityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'MEDIUM';
    if (avgVolatility < 0.01) volatilityLevel = 'LOW';
    else if (avgVolatility < 0.03) volatilityLevel = 'MEDIUM';
    else if (avgVolatility < 0.06) volatilityLevel = 'HIGH';
    else volatilityLevel = 'EXTREME';

    // Energy metrics
    const flowFieldContrib = contributions.find(c => c.name.toLowerCase().includes('flow'));
    const energyTrend = flowFieldContrib?.energyTrend || 'STABLE';
    
    // Size multiplier calculation
    const baseMultiplier = 0.5 + (confidence * 1.3); // 0.5 -> 1.8 range
    const volatilityAdjustment = this.getVolatilityAdjustment(volatilityLevel);
    const trendAlignmentMult = this.getTrendAlignmentMultiplier(direction, trendDirection);
    const finalMultiplier = this.clamp(baseMultiplier * volatilityAdjustment * trendAlignmentMult, 0.3, 2.5);

    // Risk assessment
    const riskFactors: string[] = [];
    let riskScore = 50;

    if (volatilityLevel === 'EXTREME') {
      riskScore += 30;
      riskFactors.push('Extreme volatility detected');
    }
    if (trendDirection === 'SIDEWAYS') {
      riskScore += 15;
      riskFactors.push('Unclear trend - sideways market');
    }
    if (agreementScore < 60) {
      riskScore += 20;
      riskFactors.push('Low strategy agreement');
    }
    if (energyTrend === 'DECELERATING') {
      riskScore += 10;
      riskFactors.push('Energy decelerating - potential exhaustion');
    }

    riskScore = Math.min(100, riskScore);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'MEDIUM';
    if (riskScore < 30) riskLevel = 'LOW';
    else if (riskScore < 60) riskLevel = 'MEDIUM';
    else if (riskScore < 80) riskLevel = 'HIGH';
    else riskLevel = 'EXTREME';

    // Recommended stop loss (based on volatility)
    const stopLossDistance = currentPrice * (0.01 + avgVolatility);
    const recommendedStopLoss = direction === 'BUY' 
      ? currentPrice - stopLossDistance 
      : currentPrice + stopLossDistance;

    // Timeframes aligned (strategies contributing to this signal)
    const alignedTimeframes = contributions
      .filter(c => (c.confidence || 0.5) > 0.6)
      .map(c => c.name);

    return {
      direction,
      confidence: this.clamp(confidence, 0, 1),
      strength: Math.round(Math.min(100, agreementScore)),

      trend: {
        direction: trendDirection,
        strength: Math.round(Math.min(100, trendStrength)),
        trendShiftDetected,
        timeframesAligned: alignedTimeframes
      },

      structure: {
        breakoutDetected: contributions.some(c => c.reason.toLowerCase().includes('break')),
        supportLevel: 0, // Would be populated from market engine
        resistanceLevel: 0,
        trendStartTime: Date.now(),
        reversalLikelihood: this.clamp(1 - confidence, 0, 1)
      },

      energy: {
        currentForce: Math.round((weightedBullish - weightedBearish) / totalWeight * 100) + 50,
        turbulence: contributions
          .find(c => c.name.toLowerCase().includes('flow'))
          ?.volatility ? volatilityLevel as any : 'MEDIUM',
        energyTrend,
        pressureTrend: energyTrend === 'ACCELERATING' ? 'RISING' : 
                      energyTrend === 'DECELERATING' ? 'FALLING' : 'STABLE'
      },

      volatility: {
        level: volatilityLevel,
        atr: avgVolatility * currentPrice,
        atrPercent: avgVolatility * 100,
        regimeShift: contributions.some(c => c.reason.toLowerCase().includes('regime'))
      },

      sizing: {
        baseMultiplier,
        volatilityAdjustment,
        trendAlignment: trendAlignmentMult,
        finalMultiplier
      },

      contributions,
      agreementScore,

      risk: {
        score: riskScore,
        level: riskLevel,
        factors: riskFactors,
        recommendedStopLoss
      },

      metadata: {
        timestamp: Date.now(),
        symbol,
        timeframe,
        priceLevel: currentPrice,
        debugInfo: {
          bullishPct: Math.round(bullishPct),
          bearishPct: Math.round(bearishPct),
          sidewaysPct: Math.round(sidewaysPct),
          avgConfidence: Math.round(avgConfidence * 100),
          strategyCount: contributions.length,
          totalWeight
        }
      }
    };
  }

  /**
   * Get volatility adjustment for position sizing
   */
  private static getVolatilityAdjustment(level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'): number {
    switch (level) {
      case 'LOW': return 1.2;
      case 'MEDIUM': return 1.0;
      case 'HIGH': return 0.8;
      case 'EXTREME': return 0.6;
      default: return 1.0;
    }
  }

  /**
   * Get trend alignment multiplier
   */
  private static getTrendAlignmentMultiplier(
    direction: 'BUY' | 'SELL' | 'HOLD',
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS'
  ): number {
    if (direction === 'HOLD') return 1.0;
    
    if ((direction === 'BUY' && trend === 'BULLISH') ||
        (direction === 'SELL' && trend === 'BEARISH')) {
      return 1.4; // Aligned
    }
    
    if ((direction === 'BUY' && trend === 'BEARISH') ||
        (direction === 'SELL' && trend === 'BULLISH')) {
      return 0.6; // Counter-trend
    }
    
    return 1.0; // Sideways
  }

  /**
   * Clamp value between min and max
   */
  private static clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}

export default UnifiedSignalAggregator;
