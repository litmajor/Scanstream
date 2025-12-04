
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
  compositeScore: number; // 0-1 (weighted combination)
  breakdown: {
    momentumStrength: number;
    volumeConfirmation: number;
    emaAligned: boolean;
    orderFlowSupport: number;
    riskRewardRatio: number;
    volatilityLabel: string;
  };
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export class CompositeEntryQualityEngine {
  /**
   * Calculate composite entry quality score
   */
  calculateEntryQuality(
    marketData: MarketFrame,
    signalDirection: 'LONG' | 'SHORT'
  ): CompositeQualityMetrics {
    // Feature 1: Momentum + Volume Confirmation
    const momentumQuality = this.calculateMomentumQuality(marketData);

    // Feature 2: Trend Alignment Score
    const trendAlignment = this.calculateTrendAlignment(marketData);

    // Feature 3: Order Flow Support
    const flowQuality = this.calculateFlowQuality(marketData, signalDirection);

    // Feature 4: Risk/Reward Quality
    const riskRewardQuality = this.calculateRiskRewardQuality(marketData);

    // Feature 5: Volatility Appropriateness
    const volatilityAppropriateness = this.calculateVolatilityAppropriateness(marketData);

    // Composite Score (weighted combination)
    const compositeScore =
      momentumQuality * 0.25 +
      trendAlignment * 0.25 +
      flowQuality * 0.20 +
      riskRewardQuality * 0.20 +
      volatilityAppropriateness * 0.10;

    // Determine quality rating
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (compositeScore >= 0.80) quality = 'excellent';
    else if (compositeScore >= 0.65) quality = 'good';
    else if (compositeScore >= 0.50) quality = 'fair';
    else quality = 'poor';

    return {
      momentumQuality,
      trendAlignment,
      flowQuality,
      riskRewardQuality,
      volatilityAppropriateness,
      compositeScore,
      breakdown: {
        momentumStrength: marketData.indicators.momentum_short || 0,
        volumeConfirmation: marketData.volume / (marketData.indicators.volume_sma_20 || 1),
        emaAligned: this.checkEmaAlignment(marketData),
        orderFlowSupport: this.getOrderFlowRatio(marketData, signalDirection),
        riskRewardRatio: marketData.advanced?.riskRewardRatio || 0,
        volatilityLabel: this.getVolatilityLabel(marketData)
      },
      quality
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
