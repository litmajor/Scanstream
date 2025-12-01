
/**
 * Multi-Timeframe Confirmation System
 * 
 * Analyzes signals across multiple timeframes and calculates alignment scores
 * to determine trade quality and position sizing multipliers.
 */

import { EnhancedMultiTimeframeSignal, EnhancedTimeframeAnalysis } from '../multi-timeframe';
import { DynamicPositionSizer } from './dynamic-position-sizer';

export interface TimeframeWeight {
  weight: number;
  label: 'MACRO' | 'PRIMARY' | 'ENTRY' | 'TIMING' | 'EXECUTION';
}

export interface TimeframeSignalAnalysis {
  timeframe: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentum: 'STRONG' | 'MODERATE' | 'WEAK';
  volumeQuality: 'HEALTHY' | 'DECLINING' | 'WEAK';
  weight: number;
  score: number;
  emaAlignment: number;
  structureScore: number;
}

export interface MultiTimeframeRecommendation {
  action: 'STRONG_BUY' | 'BUY' | 'CAUTION' | 'SKIP' | 'STRONG_SELL' | 'SELL';
  confidenceMultiplier: number;
  positionMultiplier: number;
  reasoning: string;
  targetMultiplier: number;
  stopMultiplier: number;
  alignmentScore: number;
  alignedTimeframes: number;
  totalTimeframes: number;
  dominantTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export class MultiTimeframeConfirmation {
  private readonly timeframeWeights: Record<string, TimeframeWeight> = {
    '1w': { weight: 3.0, label: 'MACRO' },
    '1d': { weight: 2.5, label: 'PRIMARY' },
    '4h': { weight: 2.0, label: 'ENTRY' },
    '1h': { weight: 1.5, label: 'TIMING' },
    '15m': { weight: 1.0, label: 'EXECUTION' },
    '5m': { weight: 0.8, label: 'EXECUTION' }
  };

  /**
   * Analyze timeframe signals and calculate alignment
   */
  analyzeTimeframes(
    timeframeAnalyses: EnhancedTimeframeAnalysis[]
  ): TimeframeSignalAnalysis[] {
    return timeframeAnalyses.map(analysis => {
      const weight = this.timeframeWeights[analysis.timeframe]?.weight || 1.0;
      
      // Determine momentum quality
      const momentum = this.analyzeMomentum(analysis);
      
      // Determine volume quality
      const volumeQuality = this.analyzeVolumeQuality(analysis);
      
      // Calculate overall score for this timeframe
      const score = this.calculateTimeframeScore(
        analysis.trend,
        momentum,
        volumeQuality,
        analysis.strength
      );

      return {
        timeframe: analysis.timeframe,
        trend: analysis.trend,
        momentum,
        volumeQuality,
        weight,
        score,
        emaAlignment: analysis.emaAnalysis.alignmentStrength,
        structureScore: analysis.structure.trendStrength
      };
    });
  }

  /**
   * Calculate alignment score across all timeframes
   */
  calculateAlignmentScore(signals: TimeframeSignalAnalysis[]): {
    alignmentScore: number;
    bullishScore: number;
    bearishScore: number;
    totalWeight: number;
  } {
    let bullishScore = 0;
    let bearishScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      totalWeight += signal.weight;
      
      if (signal.trend === 'BULLISH') {
        bullishScore += signal.score * signal.weight;
      } else if (signal.trend === 'BEARISH') {
        bearishScore += signal.score * signal.weight;
      }
    }

    // Calculate alignment as percentage (0-100)
    const alignmentScore = totalWeight > 0 
      ? ((bullishScore - bearishScore) / totalWeight) * 100
      : 0;

    return {
      alignmentScore,
      bullishScore,
      bearishScore,
      totalWeight
    };
  }

  /**
   * Get trading recommendation based on multi-timeframe analysis
   */
  getTradeRecommendation(
    mtfSignal: EnhancedMultiTimeframeSignal,
    baseConfidence: number
  ): MultiTimeframeRecommendation {
    const signals = this.analyzeTimeframes(mtfSignal.timeframeAnalysis);
    const { alignmentScore, bullishScore, bearishScore, totalWeight } = 
      this.calculateAlignmentScore(signals);

    const alignedTimeframes = signals.filter(s => 
      (alignmentScore > 0 && s.trend === 'BULLISH') ||
      (alignmentScore < 0 && s.trend === 'BEARISH')
    ).length;

    const dominantTrend = alignmentScore > 10 ? 'BULLISH' : 
                         alignmentScore < -10 ? 'BEARISH' : 'NEUTRAL';

    // PERFECT BULLISH ALIGNMENT (80%+ bullish across timeframes)
    if (alignmentScore > 80) {
      return {
        action: 'STRONG_BUY',
        confidenceMultiplier: 1.35,
        positionMultiplier: 1.5,
        reasoning: `Perfect bullish alignment across ${alignedTimeframes}/${signals.length} timeframes`,
        targetMultiplier: 1.8,
        stopMultiplier: 1.2,
        alignmentScore,
        alignedTimeframes,
        totalTimeframes: signals.length,
        dominantTrend
      };
    }
    
    // PERFECT BEARISH ALIGNMENT
    else if (alignmentScore < -80) {
      return {
        action: 'STRONG_SELL',
        confidenceMultiplier: 1.35,
        positionMultiplier: 1.5,
        reasoning: `Perfect bearish alignment across ${alignedTimeframes}/${signals.length} timeframes`,
        targetMultiplier: 1.8,
        stopMultiplier: 1.2,
        alignmentScore,
        alignedTimeframes,
        totalTimeframes: signals.length,
        dominantTrend
      };
    }
    
    // GOOD BULLISH ALIGNMENT (65-80%)
    else if (alignmentScore > 65) {
      return {
        action: 'BUY',
        confidenceMultiplier: 1.15,
        positionMultiplier: 1.2,
        reasoning: `Strong bullish alignment: ${alignedTimeframes}/${signals.length} timeframes`,
        targetMultiplier: 1.3,
        stopMultiplier: 1.0,
        alignmentScore,
        alignedTimeframes,
        totalTimeframes: signals.length,
        dominantTrend
      };
    }
    
    // GOOD BEARISH ALIGNMENT
    else if (alignmentScore < -65) {
      return {
        action: 'SELL',
        confidenceMultiplier: 1.15,
        positionMultiplier: 1.2,
        reasoning: `Strong bearish alignment: ${alignedTimeframes}/${signals.length} timeframes`,
        targetMultiplier: 1.3,
        stopMultiplier: 1.0,
        alignmentScore,
        alignedTimeframes,
        totalTimeframes: signals.length,
        dominantTrend
      };
    }
    
    // MIXED SIGNALS (45-65%)
    else if (Math.abs(alignmentScore) > 45) {
      return {
        action: 'CAUTION',
        confidenceMultiplier: 0.85,
        positionMultiplier: 0.7,
        reasoning: `Mixed signals: ${alignedTimeframes}/${signals.length} timeframes aligned`,
        targetMultiplier: 0.8,
        stopMultiplier: 0.8,
        alignmentScore,
        alignedTimeframes,
        totalTimeframes: signals.length,
        dominantTrend
      };
    }
    
    // CONFLICTING (below 45%)
    else {
      return {
        action: 'SKIP',
        confidenceMultiplier: 0.5,
        positionMultiplier: 0.0,
        reasoning: `Timeframes not aligned - high risk (${Math.abs(alignmentScore).toFixed(1)}% alignment)`,
        targetMultiplier: 0.0,
        stopMultiplier: 0.0,
        alignmentScore,
        alignedTimeframes,
        totalTimeframes: signals.length,
        dominantTrend
      };
    }
  }

  /**
   * Apply recommendation to enhance signal
   */
  enhanceSignalWithMTF(
    mtfSignal: EnhancedMultiTimeframeSignal,
    recommendation: MultiTimeframeRecommendation
  ): EnhancedMultiTimeframeSignal {
    return {
      ...mtfSignal,
      confidence: Math.min(0.95, mtfSignal.confidence * recommendation.confidenceMultiplier),
      strength: Math.min(1.0, mtfSignal.strength * recommendation.confidenceMultiplier),
      type: recommendation.action.includes('BUY') ? 'BUY' : 
            recommendation.action.includes('SELL') ? 'SELL' : 'HOLD',
      reasoning: [
        ...mtfSignal.reasoning,
        recommendation.reasoning,
        `MTF Alignment: ${recommendation.alignmentScore.toFixed(1)}%`,
        `Timeframe Consensus: ${recommendation.alignedTimeframes}/${recommendation.totalTimeframes}`
      ],
      // Enhanced position sizing
      takeProfit: mtfSignal.takeProfit * recommendation.targetMultiplier,
      stopLoss: mtfSignal.price - (mtfSignal.price - mtfSignal.stopLoss) * recommendation.stopMultiplier,
      
      // Add MTF metadata
      confluenceScore: recommendation.alignmentScore / 100,
      overallTrend: recommendation.dominantTrend,
      probabilityOfSuccess: Math.min(0.95, 
        mtfSignal.probabilityOfSuccess * recommendation.confidenceMultiplier
      )
    };
  }

  /**
   * Analyze momentum strength
   */
  private analyzeMomentum(analysis: EnhancedTimeframeAnalysis): 'STRONG' | 'MODERATE' | 'WEAK' {
    const { momentum } = analysis;
    
    // Strong momentum: RSI extreme + MACD trending + Stochastic aligned
    if (
      (momentum.rsi > 60 || momentum.rsi < 40) &&
      momentum.macd.trend !== 'NEUTRAL' &&
      momentum.stochastic.trend !== 'NEUTRAL' &&
      momentum.macd.trend === momentum.stochastic.trend
    ) {
      return 'STRONG';
    }
    
    // Moderate momentum: Some indicators aligned
    if (
      momentum.macd.trend !== 'NEUTRAL' ||
      momentum.stochastic.trend !== 'NEUTRAL'
    ) {
      return 'MODERATE';
    }
    
    return 'WEAK';
  }

  /**
   * Analyze volume quality
   */
  private analyzeVolumeQuality(
    analysis: EnhancedTimeframeAnalysis
  ): 'HEALTHY' | 'DECLINING' | 'WEAK' {
    const { volume } = analysis;
    
    // Healthy: Increasing volume + OBV confirmation
    if (
      volume.volumeTrend === 'INCREASING' &&
      volume.volumeConfirmation &&
      volume.obvTrend !== 'BEARISH'
    ) {
      return 'HEALTHY';
    }
    
    // Declining: Volume decreasing or OBV bearish
    if (
      volume.volumeTrend === 'DECREASING' ||
      volume.obvTrend === 'BEARISH'
    ) {
      return 'DECLINING';
    }
    
    return 'WEAK';
  }

  /**
   * Calculate timeframe score
   */
  private calculateTimeframeScore(
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    momentum: 'STRONG' | 'MODERATE' | 'WEAK',
    volumeQuality: 'HEALTHY' | 'DECLINING' | 'WEAK',
    strength: number
  ): number {
    let score = 0;
    
    // Trend contribution
    if (trend === 'BULLISH') score += 0.4;
    else if (trend === 'BEARISH') score -= 0.4;
    
    // Momentum contribution
    if (momentum === 'STRONG') score += 0.3;
    else if (momentum === 'MODERATE') score += 0.15;
    
    // Volume contribution
    if (volumeQuality === 'HEALTHY') score += 0.2;
    else if (volumeQuality === 'DECLINING') score -= 0.1;
    
    // Strength contribution
    score += strength * 0.1;
    
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get detailed alignment report
   */
  getAlignmentReport(mtfSignal: EnhancedMultiTimeframeSignal): {
    summary: string;
    timeframeBreakdown: Array<{
      timeframe: string;
      trend: string;
      strength: number;
      weight: number;
      contribution: number;
    }>;
    recommendation: string;
  } {
    const signals = this.analyzeTimeframes(mtfSignal.timeframeAnalysis);
    const { alignmentScore } = this.calculateAlignmentScore(signals);
    const recommendation = this.getTradeRecommendation(mtfSignal, mtfSignal.confidence);

    const timeframeBreakdown = signals.map(s => ({
      timeframe: s.timeframe.toUpperCase(),
      trend: s.trend,
      strength: Math.round(s.score * 100),
      weight: s.weight,
      contribution: Math.round(s.score * s.weight * 100)
    }));

    return {
      summary: `${recommendation.action}: ${Math.abs(alignmentScore).toFixed(1)}% alignment (${recommendation.alignedTimeframes}/${recommendation.totalTimeframes} timeframes)`,
      timeframeBreakdown,
      recommendation: recommendation.reasoning
    };
  }
}
