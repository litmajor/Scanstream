
/**
 * Market Regime Detector
 * 
 * Identifies market regimes (trending up, trending down, ranging, volatile)
 * to adapt trading strategies dynamically
 */

import type { MarketFrame } from '@shared/schema';

export type MarketRegime = 'bull_trending' | 'bear_trending' | 'ranging' | 'high_volatility' | 'accumulation' | 'distribution';

interface RegimeMetrics {
  trendStrength: number;
  volatility: number;
  volume: number;
  momentum: number;
}

export class MarketRegimeDetector {
  private regimeHistory: MarketRegime[] = [];
  private readonly historyLength = 100;

  /**
   * Calculate regime metrics
   */
  private calculateMetrics(frames: MarketFrame[]): RegimeMetrics {
    const prices = frames.map(f => (f.price as any).close || f.price);
    const volumes = frames.map(f => f.volume);
    
    // Trend strength (linear regression slope)
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = prices.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const trendStrength = slope / (sumY / n); // Normalized
    
    // Volatility (standard deviation of returns)
    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Volume trend
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const volumeRatio = recentVolume / avgVolume;
    
    // Momentum
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    
    return {
      trendStrength,
      volatility,
      volume: volumeRatio,
      momentum
    };
  }

  /**
   * Detect current market regime
   */
  detectRegime(frames: MarketFrame[]): {
    regime: MarketRegime;
    confidence: number;
    metrics: RegimeMetrics;
    description: string;
    tradingImplications: string[];
  } {
    if (frames.length < 50) {
      return {
        regime: 'ranging',
        confidence: 0.5,
        metrics: { trendStrength: 0, volatility: 0, volume: 0, momentum: 0 },
        description: 'Insufficient data',
        tradingImplications: ['Wait for more data']
      };
    }
    
    const recent = frames.slice(-50);
    const metrics = this.calculateMetrics(recent);
    
    let regime: MarketRegime;
    let confidence: number;
    let description: string;
    let tradingImplications: string[];
    
    // Regime classification logic
    if (Math.abs(metrics.trendStrength) > 0.6 && metrics.volatility < 0.03) {
      // Strong trend, low volatility
      if (metrics.momentum > 0.05) {
        regime = 'bull_trending';
        description = 'Strong uptrend with low volatility';
        tradingImplications = [
          'Favor long positions',
          'Use tight stops',
          'Trail stops as trend continues',
          'Look for pullback entries'
        ];
        confidence = 0.85;
      } else {
        regime = 'bear_trending';
        description = 'Strong downtrend with low volatility';
        tradingImplications = [
          'Favor short positions or stay out',
          'Tight stops on longs',
          'Wait for reversal signals',
          'Reduce position sizes'
        ];
        confidence = 0.85;
      }
    } else if (metrics.volatility > 0.05) {
      // High volatility
      regime = 'high_volatility';
      description = 'High volatility environment';
      tradingImplications = [
        'Reduce position sizes',
        'Wider stops required',
        'Quick scalps only',
        'Avoid swing trades'
      ];
      confidence = 0.75;
    } else if (Math.abs(metrics.trendStrength) < 0.2 && metrics.volatility < 0.02) {
      // Low trend, low volatility
      if (metrics.volume > 1.2) {
        regime = 'accumulation';
        description = 'Accumulation phase with rising volume';
        tradingImplications = [
          'Watch for breakout',
          'Accumulate on dips',
          'Tight risk management',
          'Prepare for trend start'
        ];
        confidence = 0.7;
      } else if (metrics.volume < 0.8) {
        regime = 'distribution';
        description = 'Distribution phase with falling volume';
        tradingImplications = [
          'Reduce exposure',
          'Watch for breakdown',
          'Take profits on longs',
          'Prepare for downtrend'
        ];
        confidence = 0.7;
      } else {
        regime = 'ranging';
        description = 'Sideways consolidation';
        tradingImplications = [
          'Range trading strategies',
          'Buy support, sell resistance',
          'Avoid breakout chasing',
          'Small position sizes'
        ];
        confidence = 0.65;
      }
    } else {
      // Default to ranging
      regime = 'ranging';
      description = 'Mixed signals, likely ranging';
      tradingImplications = [
        'Wait for clearer signals',
        'Reduce position sizes',
        'Focus on high-probability setups'
      ];
      confidence = 0.5;
    }
    
    // Track regime history
    this.regimeHistory.push(regime);
    if (this.regimeHistory.length > this.historyLength) {
      this.regimeHistory.shift();
    }
    
    return {
      regime,
      confidence,
      metrics,
      description,
      tradingImplications
    };
  }

  /**
   * Get regime stability (how long in current regime)
   */
  getRegimeStability(): number {
    if (this.regimeHistory.length < 10) return 0;
    
    const recent10 = this.regimeHistory.slice(-10);
    const currentRegime = recent10[recent10.length - 1];
    const sameRegimeCount = recent10.filter(r => r === currentRegime).length;
    
    return sameRegimeCount / 10; // 0-1
  }
}

export default new MarketRegimeDetector();
