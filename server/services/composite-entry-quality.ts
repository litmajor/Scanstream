
/**
 * Composite Entry Quality Score Engine
 * Combines multiple features to predict winning entries
 */

import { MarketFrame } from '../types/gateway';

export interface CompositeQualityMetrics {
  momentumQuality: number; // 0-1
  trendAlignment: number; // 0-1
  flowQuality: number; // 0-1
  riskRewardQuality: number; // 0-1
  volatilityAppropriateness: number; // 0-1
  dataQualityScore: number; // 0-1 (NEW)
  changeMetricsScore: number; // 0-1 (NEW)
  supportResistanceScore: number; // 0-1 (NEW)
  ichimokuConfirmation: number; // 0-1 (NEW)
  compositeScore: number; // 0-1 (weighted combination)
  breakdown: {
    momentumStrength: number;
    volumeConfirmation: number;
    emaAligned: boolean;
    orderFlowSupport: number;
    riskRewardRatio: number;
    volatilityLabel: string;
    dataConfidence: number;
    dataDeviation: number;
    changeAlignment: boolean;
    nearestSupport: number;
    nearestResistance: number;
    ichimokuBullish: boolean;
  };
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  filtered: boolean; // True if data quality too low
}

export class CompositeEntryQualityEngine {
  /**
   * Calculate composite entry quality score
   */
  calculateEntryQuality(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): CompositeQualityMetrics {
    // Feature 1: Data Quality Validation (NEW - Filter unreliable data)
    const dataQualityScore = this.calculateDataQuality(marketData);
    
    // Feature 2: Change Metrics Momentum Validation (NEW)
    const changeMetricsScore = this.calculateChangeMetricsQuality(marketData, signalDirection);
    
    // Feature 3: Support/Resistance Quality (NEW)
    const supportResistanceScore = this.calculateSupportResistanceQuality(marketData, signalDirection);
    
    // Feature 4: Ichimoku Confirmation (NEW)
    const ichimokuConfirmation = this.calculateIchimokuQuality(marketData, signalDirection);
    
    // Feature 5: Momentum + Volume Confirmation
    const momentumQuality = this.calculateMomentumQuality(marketData);

    // Feature 6: Trend Alignment Score
    const trendAlignment = this.calculateTrendAlignment(marketData);

    // Feature 7: Order Flow Support
    const flowQuality = this.calculateFlowQuality(marketData, signalDirection);

    // Feature 8: Risk/Reward Quality
    const riskRewardQuality = this.calculateRiskRewardQuality(marketData);

    // Feature 9: Volatility Appropriateness
    const volatilityAppropriateness = this.calculateVolatilityAppropriateness(marketData);

    // Check if data quality is too low to proceed
    const filtered = dataQualityScore < 0.3;

    // Enhanced Composite Score (weighted combination)
    const compositeScore = filtered ? 0 :
      dataQualityScore * 0.15 +           // NEW: Data reliability
      changeMetricsScore * 0.10 +         // NEW: Momentum confirmation
      supportResistanceScore * 0.10 +     // NEW: Structure quality
      ichimokuConfirmation * 0.05 +       // NEW: Trend confirmation
      momentumQuality * 0.20 +            // Reduced from 0.25
      trendAlignment * 0.20 +             // Reduced from 0.25
      flowQuality * 0.10 +                // Reduced from 0.20
      riskRewardQuality * 0.05 +          // Reduced from 0.20
      volatilityAppropriateness * 0.05;   // Reduced from 0.10

    // Determine quality rating
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (filtered) quality = 'poor';
    else if (compositeScore >= 0.80) quality = 'excellent';
    else if (compositeScore >= 0.65) quality = 'good';
    else if (compositeScore >= 0.50) quality = 'fair';
    else quality = 'poor';

    return {
      momentumQuality,
      trendAlignment,
      flowQuality,
      riskRewardQuality,
      volatilityAppropriateness,
      dataQualityScore,
      changeMetricsScore,
      supportResistanceScore,
      ichimokuConfirmation,
      compositeScore,
      breakdown: {
        momentumStrength: marketData.indicators.momentum_short || 0,
        volumeConfirmation: marketData.volume / (marketData.indicators.volume_sma_20 || 1),
        emaAligned: this.checkEmaAlignment(marketData),
        orderFlowSupport: this.getOrderFlowRatio(marketData, signalDirection),
        riskRewardRatio: marketData.advanced?.riskRewardRatio || 0,
        volatilityLabel: this.getVolatilityLabel(marketData),
        dataConfidence: marketData.confidence || 0,
        dataDeviation: marketData.deviation || 0,
        changeAlignment: this.checkChangeAlignment(marketData, signalDirection),
        nearestSupport: marketData.supportLevel || 0,
        nearestResistance: marketData.resistanceLevel || 0,
        ichimokuBullish: marketData.indicators.ichimoku_bullish || false
      },
      quality,
      filtered
    };
  }

  /**
   * Feature 1: Momentum Quality with Volume Confirmation
   */
  private calculateMomentumQuality(marketData: MarketFrame): number {
    const momentum = marketData.indicators.momentum_short || 0;
    const momentumTrend = marketData.indicators.momentum_long || 0;
    
    // Momentum strength (combine short and long-term)
    const momentumStrength = momentum * (momentumTrend > 0 ? 1.0 : 0.5);
    
    // Volume confirmation
    const volumeRatio = marketData.volume / (marketData.indicators.volume_sma_20 || 1);
    const volumeConfirmation = Math.min(volumeRatio, 2.0); // Cap at 2x
    
    // Combined momentum quality
    const momentumQuality = momentumStrength * (0.7 + 0.3 * (volumeConfirmation / 2.0));
    
    // Normalize to 0-1
    return Math.max(0, Math.min(1, momentumQuality));
  }

  /**
   * Feature 2: Trend Alignment Score
   */
  private calculateTrendAlignment(marketData: MarketFrame): number {
    const emaAligned = this.checkEmaAlignment(marketData);
    
    // Full alignment = 1.0, no alignment = 0.5 (neutral)
    if (emaAligned) {
      // Check strength of alignment
      const ema20 = marketData.indicators.ema20 || 0;
      const ema50 = marketData.indicators.ema50 || 0;
      const ema200 = marketData.indicators.ema200 || 0;
      
      const spacing20_50 = Math.abs((ema20 - ema50) / ema50);
      const spacing50_200 = Math.abs((ema50 - ema200) / ema200);
      
      // Better spacing = stronger trend
      const alignmentStrength = Math.min((spacing20_50 + spacing50_200) * 10, 1.0);
      return 0.8 + alignmentStrength * 0.2; // 0.8-1.0 range for aligned
    }
    
    return 0.5; // Neutral for non-aligned
  }

  /**
   * Feature 3: Order Flow Quality
   */
  private calculateFlowQuality(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): number {
    const orderFlowSupport = this.getOrderFlowRatio(marketData, signalDirection);
    
    // Normalize: 3.0 = perfect flow support, 1.5 = neutral
    const flowQuality = Math.min(orderFlowSupport, 3.0) / 1.5;
    
    return Math.max(0, Math.min(1, flowQuality / 2)); // Scale to 0-1
  }

  /**
   * Feature 4: Risk/Reward Quality
   */
  private calculateRiskRewardQuality(marketData: MarketFrame): number {
    const riskRewardRatio = marketData.advanced?.riskRewardRatio || 0;
    
    // 2:1 is ideal, anything above is excellent
    const rrQuality = Math.min(riskRewardRatio / 2.0, 1.0);
    
    return rrQuality;
  }

  /**
   * Feature 5: Volatility Appropriateness
   */
  private calculateVolatilityAppropriateness(marketData: MarketFrame): number {
    const volatilityLabel = this.getVolatilityLabel(marketData);
    
    const appropriatenessMap: Record<string, number> = {
      'LOW': 0.8,      // Calm conditions less ideal
      'MEDIUM': 1.0,   // Medium volatility ideal
      'HIGH': 0.9,     // High volatility OK but riskier
      'EXTREME': 0.7   // Extreme volatility risky
    };
    
    return appropriatenessMap[volatilityLabel] || 0.7;
  }

  /**
   * Helper: Check if EMAs are aligned
   */
  private checkEmaAlignment(marketData: MarketFrame): boolean {
    const ema20 = marketData.indicators.ema20;
    const ema50 = marketData.indicators.ema50;
    const ema200 = marketData.indicators.ema200;
    
    if (!ema20 || !ema50 || !ema200) return false;
    
    // Bullish alignment: EMA20 > EMA50 > EMA200
    return ema20 > ema50 && ema50 > ema200;
  }

  /**
   * Helper: Get order flow ratio for direction
   */
  private getOrderFlowRatio(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): number {
    const bidVolume = marketData.orderFlow?.bidVolume || 0;
    const askVolume = marketData.orderFlow?.askVolume || 0;
    
    if (signalDirection === 'LONG') {
      return bidVolume / (askVolume + 1); // Bid/Ask for longs
    } else {
      return askVolume / (bidVolume + 1); // Ask/Bid for shorts
    }
  }

  /**
   * Helper: Get volatility label
   */
  private getVolatilityLabel(marketData: MarketFrame): string {
    const atr = marketData.indicators.atr || 0;
    const price = marketData.price.close;
    const atrPercent = (atr / price) * 100;
    
    if (atrPercent < 1.5) return 'LOW';
    if (atrPercent < 3.0) return 'MEDIUM';
    if (atrPercent < 5.0) return 'HIGH';
    return 'EXTREME';
  }

  /**
   * NEW: Feature 6 - Data Quality Score
   * Filters unreliable data based on confidence and deviation
   */
  private calculateDataQuality(marketData: MarketFrame): number {
    const confidence = marketData.confidence || 0.5; // Default to neutral
    const deviation = marketData.deviation || 0;
    const sources = marketData.sources?.length || 1;
    
    // High confidence = good
    let confidenceScore = confidence;
    
    // Low deviation = good (sources agree)
    let deviationScore = 1.0;
    if (deviation > 0.05) deviationScore = 0.3; // >5% deviation = poor
    else if (deviation > 0.02) deviationScore = 0.6; // >2% deviation = fair
    else if (deviation > 0.01) deviationScore = 0.8; // >1% deviation = good
    
    // More sources = better
    let sourcesScore = Math.min(sources / 3, 1.0); // 3+ sources = perfect
    
    // Combined data quality
    const dataQuality = 
      confidenceScore * 0.5 +
      deviationScore * 0.3 +
      sourcesScore * 0.2;
    
    return Math.max(0, Math.min(1, dataQuality));
  }

  /**
   * NEW: Feature 7 - Change Metrics Quality
   * Validates momentum is real (not just a reversal)
   */
  private calculateChangeMetricsQuality(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): number {
    const change1h = marketData.change1h || 0;
    const change24h = marketData.change24h || 0;
    const change7d = marketData.change7d || 0;
    
    // For LONG: want positive changes across timeframes
    // For SHORT: want negative changes across timeframes
    const multiplier = signalDirection === 'LONG' ? 1 : -1;
    
    // Alignment check: all timeframes moving in same direction
    const aligned1h = (change1h * multiplier) > 0;
    const aligned24h = (change24h * multiplier) > 0;
    const aligned7d = (change7d * multiplier) > 0;
    
    let alignmentScore = 0;
    if (aligned1h) alignmentScore += 0.4; // Short-term most important
    if (aligned24h) alignmentScore += 0.35;
    if (aligned7d) alignmentScore += 0.25;
    
    // Strength check: magnitude of changes
    const avgChange = Math.abs((change1h + change24h + change7d) / 3);
    let strengthScore = Math.min(avgChange / 5.0, 1.0); // 5% avg = perfect
    
    // Acceleration bonus: getting stronger over time
    let accelerationBonus = 0;
    if (Math.abs(change1h) > Math.abs(change24h)) accelerationBonus = 0.1;
    
    return Math.min(1.0, alignmentScore * 0.7 + strengthScore * 0.3 + accelerationBonus);
  }

  /**
   * NEW: Feature 8 - Support/Resistance Quality
   * Times exits more precisely using structural levels
   */
  private calculateSupportResistanceQuality(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): number {
    const currentPrice = marketData.price.close;
    const support = marketData.supportLevel || 0;
    const resistance = marketData.resistanceLevel || 0;
    
    if (support === 0 || resistance === 0) return 0.5; // Neutral if missing
    
    // Calculate distance to key levels
    const distanceToSupport = ((currentPrice - support) / currentPrice) * 100;
    const distanceToResistance = ((resistance - currentPrice) / currentPrice) * 100;
    
    // For LONG: want to be near support, far from resistance
    // For SHORT: want to be near resistance, far from support
    if (signalDirection === 'LONG') {
      // Good entry: 1-3% above support, >5% below resistance
      let supportScore = 0;
      if (distanceToSupport < 1) supportScore = 0.3; // Too close to support
      else if (distanceToSupport < 3) supportScore = 1.0; // Perfect zone
      else if (distanceToSupport < 5) supportScore = 0.7; // Acceptable
      else supportScore = 0.4; // Too far from support
      
      let resistanceScore = Math.min(distanceToResistance / 5.0, 1.0);
      
      return supportScore * 0.6 + resistanceScore * 0.4;
    } else {
      // SHORT: inverse logic
      let resistanceScore = 0;
      if (distanceToResistance < 1) resistanceScore = 1.0; // Perfect zone
      else if (distanceToResistance < 3) resistanceScore = 0.7;
      else resistanceScore = 0.4;
      
      let supportScore = Math.min(distanceToSupport / 5.0, 1.0);
      
      return resistanceScore * 0.6 + supportScore * 0.4;
    }
  }

  /**
   * NEW: Feature 9 - Ichimoku Confirmation
   * Additional trend confirmation layer
   */
  private calculateIchimokuQuality(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): number {
    const ichimokuBullish = marketData.indicators.ichimoku_bullish;
    
    if (ichimokuBullish === undefined || ichimokuBullish === null) {
      return 0.5; // Neutral if not available
    }
    
    // For LONG: want ichimoku bullish
    // For SHORT: want ichimoku bearish
    if (signalDirection === 'LONG') {
      return ichimokuBullish ? 1.0 : 0.2;
    } else {
      return ichimokuBullish ? 0.2 : 1.0;
    }
  }

  /**
   * Helper: Check if change metrics align with signal direction
   */
  private checkChangeAlignment(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): boolean {
    const change1h = marketData.change1h || 0;
    const change24h = marketData.change24h || 0;
    
    if (signalDirection === 'LONG') {
      return change1h > 0 && change24h > 0;
    } else {
      return change1h < 0 && change24h < 0;
    }
  }

  /**
   * Batch calculate for multiple signals
   */
  batchCalculate(
    signals: Array<{ marketData: MarketFrame; direction: 'LONG' | 'SHORT' }>
  ): CompositeQualityMetrics[] {
    return signals.map(signal =>
      this.calculateEntryQuality(signal.marketData, signal.direction)
    );
  }

  /**
   * Filter signals by minimum composite quality
   */
  filterByQuality(
    signals: Array<{ marketData: MarketFrame; direction: 'LONG' | 'SHORT' }>,
    minQuality: number = 0.65
  ): Array<{ marketData: MarketFrame; direction: 'LONG' | 'SHORT'; quality: CompositeQualityMetrics }> {
    return signals
      .map(signal => ({
        ...signal,
        quality: this.calculateEntryQuality(signal.marketData, signal.direction)
      }))
      .filter(item => item.quality.compositeScore >= minQuality);
  }
}

export const compositeEntryQualityEngine = new CompositeEntryQualityEngine();
