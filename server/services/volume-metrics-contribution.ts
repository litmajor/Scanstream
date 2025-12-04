/**
 * Volume Metrics as 6th Integrated Signal Source
 * 
 * Treats volume as independent signal source (not just confirmation):
 * - Volume spikes indicate institutional activity
 * - Volume trends reveal market strength
 * - Volume profile guides entry zones
 * 
 * Integrated into unified 6-source framework with regime-aware weighting:
 * - TRENDING: 8% weight (volume trend validates continuation)
 * - SIDEWAYS: 12% weight (volume spike breaks consolidation)
 * - HIGH_VOL: 15% weight (volume management critical)
 * - BREAKOUT: 20% weight (volume confirms breakout strength)
 * - QUIET: 10% weight (any volume significant)
 */

import type { StrategyContribution } from './unified-signal-aggregator';

export interface VolumeMetricsResult {
  // Raw metrics
  volumeRatio: number; // Current vol / average vol
  volumeSpike: boolean; // Spike > 1.5x
  volumeTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
  marketActivity: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

  // Strength assessment
  strength: 'WEAK' | 'NORMAL' | 'STRONG' | 'EXTREME';
  confirmation: boolean;

  // Direction signals
  bullishVolume: number; // 0-1, strength of bullish volume signal
  bearishVolume: number; // 0-1, strength of bearish volume signal

  // Reasoning
  reason: string;
}

export class VolumeMetricsEngine {
  private static readonly SPIKE_THRESHOLD = 1.5; // 1.5x average volume
  private static readonly STRONG_VOLUME = 1.2;
  private static readonly WEAK_VOLUME = 0.8;

  /**
   * Analyze volume metrics as independent signal source
   */
  static analyzeVolume(
    currentVolume: number,
    avgVolume: number,
    prevVolume: number,
    movePercent: number, // Price move as percentage
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    highestPrice: number,
    lowestPrice: number,
    currentPrice: number
  ): VolumeMetricsResult {
    // ========== VOLUME RATIO ==========
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1.0;
    const prevRatio = avgVolume > 0 ? prevVolume / avgVolume : 1.0;

    // ========== SPIKE DETECTION ==========
    const volumeSpike = volumeRatio > this.SPIKE_THRESHOLD;

    // ========== TREND DETECTION ==========
    let volumeTrend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
    if (currentVolume > prevVolume * 1.1) {
      volumeTrend = 'INCREASING';
    } else if (currentVolume < prevVolume * 0.9) {
      volumeTrend = 'DECREASING';
    }

    // ========== MARKET ACTIVITY CLASSIFICATION ==========
    let marketActivity: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' = 'NORMAL';
    if (volumeRatio < this.WEAK_VOLUME) {
      marketActivity = 'LOW';
    } else if (volumeRatio > 2.5) {
      marketActivity = 'EXTREME';
    } else if (volumeRatio > 1.8) {
      marketActivity = 'HIGH';
    }

    // ========== BULLISH/BEARISH VOLUME SIGNALS ==========
    let bullishVolume = 0;
    let bearishVolume = 0;

    // Signal 1: Volume-Price Action Correlation
    if (trend === 'BULLISH' && volumeRatio > this.STRONG_VOLUME) {
      bullishVolume += 0.35; // Strong signal: price up + volume up
    } else if (trend === 'BULLISH' && volumeRatio < this.WEAK_VOLUME) {
      bearishVolume += 0.20; // Weak signal: price up but volume down (weak bullish)
    }

    if (trend === 'BEARISH' && volumeRatio > this.STRONG_VOLUME) {
      bearishVolume += 0.35; // Strong signal: price down + volume up
    } else if (trend === 'BEARISH' && volumeRatio < this.WEAK_VOLUME) {
      bullishVolume += 0.20; // Weak signal: price down but volume down (weak bearish)
    }

    // Signal 2: Volume Spike Magnitude
    if (volumeSpike) {
      // Determine if spike is bullish or bearish based on price position
      const pricePosition = (currentPrice - lowestPrice) / (highestPrice - lowestPrice);
      if (pricePosition > 0.6) {
        bullishVolume += 0.25; // Spike at high price = bullish
      } else if (pricePosition < 0.4) {
        bearishVolume += 0.25; // Spike at low price = bearish
      } else {
        bullishVolume += 0.10;
        bearishVolume += 0.10; // Neutral spike
      }
    }

    // Signal 3: Volume Trend Consistency
    if (volumeTrend === 'INCREASING') {
      if (trend === 'BULLISH') bullishVolume += 0.20; // Increasing volume with bullish trend
      if (trend === 'BEARISH') bearishVolume += 0.20; // Increasing volume with bearish trend
    } else if (volumeTrend === 'DECREASING') {
      if (trend === 'BULLISH') bullishVolume -= 0.10; // Decreasing volume weakens bullish
      if (trend === 'BEARISH') bearishVolume -= 0.10; // Decreasing volume weakens bearish
    }

    // Signal 4: Large Price Move with Volume
    if (Math.abs(movePercent) > 2.0 && volumeRatio > this.STRONG_VOLUME) {
      // Significant move + strong volume = high conviction
      if (movePercent > 0) {
        bullishVolume += 0.15;
      } else {
        bearishVolume += 0.15;
      }
    }

    // Normalize to 0-1 range
    bullishVolume = Math.min(1.0, bullishVolume);
    bearishVolume = Math.min(1.0, bearishVolume);

    // ========== OVERALL STRENGTH ==========
    let strength: 'WEAK' | 'NORMAL' | 'STRONG' | 'EXTREME' = 'NORMAL';
    if (volumeRatio < 0.7) {
      strength = 'WEAK';
    } else if (volumeRatio > 2.0) {
      strength = 'EXTREME';
    } else if (volumeRatio > 1.5) {
      strength = 'STRONG';
    }

    // ========== CONFIRMATION STATUS ==========
    // Volume confirms if it aligns with price direction
    const confirmation =
      (trend === 'BULLISH' && bullishVolume > 0.5) || (trend === 'BEARISH' && bearishVolume > 0.5);

    // ========== BUILD REASONING ==========
    const reasons: string[] = [];
    reasons.push(`Volume ${(volumeRatio * 100).toFixed(0)}% of average`);

    if (volumeSpike) {
      reasons.push('SPIKE DETECTED');
    }

    reasons.push(`Trend: ${volumeTrend}`);

    if (confirmation) {
      reasons.push('✓ Confirms price action');
    } else if (trend !== 'NEUTRAL') {
      reasons.push('⚠ Does NOT confirm price action');
    }

    reasons.push(`Bullish vol: ${(bullishVolume * 100).toFixed(0)}%`);
    reasons.push(`Bearish vol: ${(bearishVolume * 100).toFixed(0)}%`);

    const reason = reasons.join(' | ');

    return {
      volumeRatio,
      volumeSpike,
      volumeTrend,
      marketActivity,
      strength,
      confirmation,
      bullishVolume,
      bearishVolume,
      reason
    };
  }

  /**
   * Convert volume metrics to StrategyContribution for unified framework
   */
  static toStrategyContribution(result: VolumeMetricsResult, baseWeight: number = 0.12): StrategyContribution {
    // Determine dominant volume direction
    const volumeTrend = result.bullishVolume > result.bearishVolume ? 'BULLISH' : 'BEARISH';
    const confidence = Math.max(result.bullishVolume, result.bearishVolume);

    // Adjust confidence based on strength
    const strengthMultiplier =
      result.strength === 'EXTREME'
        ? 1.3
        : result.strength === 'STRONG'
          ? 1.2
          : result.strength === 'WEAK'
            ? 0.7
            : 1.0;

    const finalConfidence = Math.min(1.0, confidence * strengthMultiplier);

    // Strength score (0-100)
    const strength = result.volumeRatio > 1.5 ? 80 : result.volumeRatio > 1.2 ? 60 : result.volumeRatio > 1.0 ? 50 : 40;

    return {
      name: 'VolumeMetrics',
      trend: volumeTrend,
      confidence: finalConfidence,
      strength,
      reason: result.reason,
      energyTrend: result.volumeTrend === 'INCREASING' ? 'ACCELERATING' : 'DECELERATING',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get confidence level string for volume
   */
  static getConfidenceLabel(ratio: number): string {
    if (ratio > 3.0) return 'EXTREME';
    if (ratio > 2.0) return 'VERY HIGH';
    if (ratio > 1.5) return 'HIGH';
    if (ratio > 1.2) return 'MODERATE';
    if (ratio > 0.8) return 'NORMAL';
    if (ratio > 0.5) return 'LOW';
    return 'VERY LOW';
  }

  /**
   * Determine if volume confirms the given trend
   */
  static confirmsTrend(result: VolumeMetricsResult, trend: 'BULLISH' | 'BEARISH'): boolean {
    if (trend === 'BULLISH') {
      return result.bullishVolume > 0.6 && result.volumeRatio > 1.0;
    } else {
      return result.bearishVolume > 0.6 && result.volumeRatio > 1.0;
    }
  }

  /**
   * Get volume score for position sizing (Kelly Criterion)
   * Higher volume = higher conviction = larger position
   */
  static getPositionSizeMultiplier(result: VolumeMetricsResult): number {
    // Base multiplier on volume strength
    if (result.strength === 'EXTREME') return 1.8;
    if (result.strength === 'STRONG') return 1.5;
    if (result.strength === 'NORMAL') return 1.0;
    return 0.7; // WEAK volume = reduce position
  }
}

export default VolumeMetricsEngine;
