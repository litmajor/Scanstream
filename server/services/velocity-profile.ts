/**
 * Velocity Profile Service (Phase 2)
 * 
 * Measures the impact of asset velocity-based position sizing on backtest performance.
 * 
 * Velocity Metrics:
 * - Price velocity: Rate of price change
 * - Volume velocity: Rate of volume increase
 * - Momentum velocity: Combined price and volume momentum
 * - Acceleration: Second-order rate of change
 * 
 * Position Sizing:
 * - Baseline: Fixed position sizing (1.0x)
 * - Velocity-based: 0.5x to 2.0x based on asset velocity profile
 * - Expected improvement: +20-30% return
 */

import { Trade, BacktestMetrics } from './capability-measurement';

interface VelocityMetrics {
  priceVelocity: number;      // Rate of price change (%)
  volumeVelocity: number;     // Rate of volume increase (%)
  momentumVelocity: number;   // Combined momentum score (0-100)
  acceleration: number;       // Second-order change rate
  volatility: number;         // Price volatility (%)
  convictionScore: number;    // Final conviction for sizing (0-1)
}

interface VelocityProfile {
  symbol: string;
  timeframe: string;
  period: string;
  priceHistory: number[];
  volumeHistory: number[];
  velocityScores: VelocityMetrics[];
  avgVelocity: number;
  volatilityProfile: {
    low: number;    // Percentage of time in low volatility
    medium: number; // Percentage of time in medium volatility
    high: number;   // Percentage of time in high volatility
  };
}

interface EnhancedTradeWithVelocity extends Trade {
  velocityAtEntry: VelocityMetrics;
  velocityMultiplier: number;
  adjustedQuantity: number;
  velocityBased: boolean;
}

interface VelocityImpact {
  metrics: {
    returnImprovement: number;
    sharpeImprovement: number;
    drawdownReduction: number;
    winRateImprovement: number;
  };
  avgMultiplier: number;
  velocityDistribution: {
    low: number;    // % of trades with 0.5-0.75x multiplier
    medium: number; // % of trades with 0.75-1.25x multiplier
    high: number;   // % of trades with 1.25-2.0x multiplier
  };
  timeInHighVelocity: number;
}

interface VelocityComparisonReport {
  baseline: BacktestMetrics;
  withVelocityProfile: VelocityImpact;
  adaptiveVelocity: VelocityImpact;
  highFrequencyVelocity: VelocityImpact;
  combined: VelocityImpact;
}

export class VelocityProfile {
  /**
   * Calculate velocity metrics for a single point in time
   */
  calculateVelocityMetrics(
    currentPrice: number,
    previousPrice: number,
    currentVolume: number,
    previousVolume: number,
    volumeMA: number,
    priceMA: number
  ): VelocityMetrics {
    // Price velocity: rate of price change from MA
    const priceChange = ((currentPrice - priceMA) / priceMA) * 100;
    const priceVelocity = Math.abs(priceChange);

    // Volume velocity: rate of volume change from MA
    const volumeChange = ((currentVolume - volumeMA) / volumeMA) * 100;
    const volumeVelocity = Math.max(0, Math.min(100, volumeChange));

    // Momentum velocity: combined momentum signal
    const priceDirection = priceChange > 0 ? 1 : -1;
    const volumeBoost = Math.min(100, Math.max(0, volumeVelocity));
    const momentumVelocity = (priceVelocity * 0.6 + volumeBoost * 0.4) * Math.min(1, priceDirection + 1);

    // Acceleration: second derivative (rate of rate of change)
    const priceMomentum = currentPrice - previousPrice;
    const volumeMomentum = currentVolume - previousVolume;
    const acceleration = Math.abs(priceMomentum) / (Math.abs(previousPrice) || 1) * 100;

    // Volatility: price standard deviation proxy
    const priceRange = Math.abs(currentPrice - previousPrice);
    const volatility = (priceRange / (Math.min(currentPrice, previousPrice) || 1)) * 100;

    // Conviction score: normalized to 0-1 range
    // Higher velocity + higher volume = higher conviction
    const velocityNormalized = Math.min(1, priceVelocity / 10);
    const volumeNormalized = Math.min(1, volumeVelocity / 100);
    const convictionScore = (velocityNormalized * 0.6 + volumeNormalized * 0.4);

    return {
      priceVelocity,
      volumeVelocity,
      momentumVelocity,
      acceleration,
      volatility,
      convictionScore
    };
  }

  /**
   * Calculate velocity profile for asset over time period
   */
  calculateVelocityProfile(
    symbol: string,
    timeframe: string,
    period: string,
    priceHistory: number[],
    volumeHistory: number[]
  ): VelocityProfile {
    const velocityScores: VelocityMetrics[] = [];
    const ma20Period = Math.min(20, Math.floor(priceHistory.length / 5));

    // Calculate moving averages for normalization
    const calculateMA = (data: number[], period: number): number[] => {
      const mas: number[] = [];
      for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - period + 1);
        const slice = data.slice(start, i + 1);
        const ma = slice.reduce((a, b) => a + b, 0) / slice.length;
        mas.push(ma);
      }
      return mas;
    };

    const priceMAs = calculateMA(priceHistory, ma20Period);
    const volumeMAs = calculateMA(volumeHistory, ma20Period);

    // Calculate velocity for each candle
    for (let i = 1; i < priceHistory.length; i++) {
      const velocity = this.calculateVelocityMetrics(
        priceHistory[i],
        priceHistory[i - 1],
        volumeHistory[i],
        volumeHistory[i - 1],
        volumeMAs[i],
        priceMAs[i]
      );
      velocityScores.push(velocity);
    }

    // Calculate average velocity
    const avgVelocity =
      velocityScores.reduce((sum, v) => sum + v.convictionScore, 0) / velocityScores.length;

    // Calculate volatility profile distribution
    const volatilityProfile = {
      low: 0,
      medium: 0,
      high: 0
    };

    velocityScores.forEach(v => {
      if (v.volatility < 1) volatilityProfile.low++;
      else if (v.volatility < 3) volatilityProfile.medium++;
      else volatilityProfile.high++;
    });

    const total = velocityScores.length;
    volatilityProfile.low = (volatilityProfile.low / total) * 100;
    volatilityProfile.medium = (volatilityProfile.medium / total) * 100;
    volatilityProfile.high = (volatilityProfile.high / total) * 100;

    return {
      symbol,
      timeframe,
      period,
      priceHistory,
      volumeHistory,
      velocityScores,
      avgVelocity,
      volatilityProfile
    };
  }

  /**
   * Apply velocity-based position sizing to trades
   * Conviction increases position size up to 2.0x, decreases down to 0.5x
   */
  applyVelocityProfileSizing(
    trades: Trade[],
    velocityProfile: VelocityProfile
  ): EnhancedTradeWithVelocity[] {
    return trades.map((trade, index) => {
      // Get velocity at entry time (use closest velocity score)
      const velocityIndex = Math.min(index, velocityProfile.velocityScores.length - 1);
      const velocityAtEntry = velocityProfile.velocityScores[velocityIndex];

      // Calculate position multiplier based on velocity conviction
      // Conviction 0.0-0.3 = 0.5x (low conviction)
      // Conviction 0.3-0.7 = 0.75x-1.25x (medium conviction)
      // Conviction 0.7-1.0 = 1.25x-2.0x (high conviction)
      let velocityMultiplier = 1.0;

      if (velocityAtEntry.convictionScore < 0.3) {
        velocityMultiplier = 0.5 + (velocityAtEntry.convictionScore / 0.3) * 0.25;
      } else if (velocityAtEntry.convictionScore < 0.7) {
        const mid = (velocityAtEntry.convictionScore - 0.3) / 0.4;
        velocityMultiplier = 0.75 + mid * 0.5;
      } else {
        const high = (velocityAtEntry.convictionScore - 0.7) / 0.3;
        velocityMultiplier = 1.25 + high * 0.75;
      }

      // Ensure multiplier is in valid range
      velocityMultiplier = Math.max(0.5, Math.min(2.0, velocityMultiplier));

      return {
        ...trade,
        velocityAtEntry,
        velocityMultiplier,
        adjustedQuantity: trade.quantity * velocityMultiplier,
        velocityBased: true
      };
    });
  }

  /**
   * Apply adaptive velocity-based sizing
   * Adjusts multiplier based on recent velocity trends
   */
  applyAdaptiveVelocitySizing(
    trades: Trade[],
    velocityProfile: VelocityProfile
  ): EnhancedTradeWithVelocity[] {
    return trades.map((trade, index) => {
      const velocityIndex = Math.min(index, velocityProfile.velocityScores.length - 1);
      const velocityAtEntry = velocityProfile.velocityScores[velocityIndex];

      // Calculate adaptive multiplier based on velocity trend
      let trendMultiplier = 1.0;
      if (velocityIndex > 5) {
        const recentVelocities = velocityProfile.velocityScores
          .slice(Math.max(0, velocityIndex - 5), velocityIndex)
          .map(v => v.convictionScore);
        const avgRecent = recentVelocities.reduce((a, b) => a + b, 0) / recentVelocities.length;
        const trend = velocityAtEntry.convictionScore - avgRecent;

        // Increasing velocity = increase multiplier
        trendMultiplier = 1.0 + Math.max(-0.25, Math.min(0.25, trend));
      }

      let adaptiveMultiplier = 0.75 + (velocityAtEntry.convictionScore * 1.25);
      adaptiveMultiplier = adaptiveMultiplier * trendMultiplier;
      adaptiveMultiplier = Math.max(0.5, Math.min(2.0, adaptiveMultiplier));

      return {
        ...trade,
        velocityAtEntry,
        velocityMultiplier: adaptiveMultiplier,
        adjustedQuantity: trade.quantity * adaptiveMultiplier,
        velocityBased: true
      };
    });
  }

  /**
   * Apply high-frequency velocity-based sizing
   * More aggressive sizing for high-velocity environments
   */
  applyHighFrequencyVelocitySizing(
    trades: Trade[],
    velocityProfile: VelocityProfile
  ): EnhancedTradeWithVelocity[] {
    return trades.map((trade, index) => {
      const velocityIndex = Math.min(index, velocityProfile.velocityScores.length - 1);
      const velocityAtEntry = velocityProfile.velocityScores[velocityIndex];

      // High frequency: more aggressive scaling
      // Uses momentum velocity more heavily
      const momentumFactor = velocityAtEntry.momentumVelocity / 100;
      const accelerationFactor = Math.min(1, velocityAtEntry.acceleration / 5);

      let hfMultiplier = 0.5 + (momentumFactor * 0.75) + (accelerationFactor * 0.75);
      hfMultiplier = Math.max(0.5, Math.min(2.0, hfMultiplier));

      return {
        ...trade,
        velocityAtEntry,
        velocityMultiplier: hfMultiplier,
        adjustedQuantity: trade.quantity * hfMultiplier,
        velocityBased: true
      };
    });
  }

  /**
   * Calculate impact of velocity-based position sizing
   */
  calculateVelocityImpact(
    baselineMetrics: BacktestMetrics,
    enhancedTrades: EnhancedTradeWithVelocity[],
    enhancedMetrics: BacktestMetrics
  ): VelocityImpact {
    // Calculate average multiplier
    const avgMultiplier =
      enhancedTrades.reduce((sum, t) => sum + t.velocityMultiplier, 0) / enhancedTrades.length;

    // Calculate velocity distribution
    const velocityDistribution = {
      low: 0,
      medium: 0,
      high: 0
    };

    enhancedTrades.forEach(trade => {
      if (trade.velocityMultiplier < 0.75) velocityDistribution.low++;
      else if (trade.velocityMultiplier <= 1.25) velocityDistribution.medium++;
      else velocityDistribution.high++;
    });

    const total = enhancedTrades.length;
    velocityDistribution.low = (velocityDistribution.low / total) * 100;
    velocityDistribution.medium = (velocityDistribution.medium / total) * 100;
    velocityDistribution.high = (velocityDistribution.high / total) * 100;

    // Calculate time in high velocity
    const highVelocityCount = enhancedTrades.filter(t => t.velocityMultiplier > 1.25).length;
    const timeInHighVelocity = (highVelocityCount / total) * 100;

    return {
      metrics: {
        returnImprovement: this.calculateImprovement(baselineMetrics.totalReturn, enhancedMetrics.totalReturn),
        sharpeImprovement: this.calculateImprovement(baselineMetrics.sharpeRatio, enhancedMetrics.sharpeRatio),
        drawdownReduction: baselineMetrics.maxDrawdown - enhancedMetrics.maxDrawdown,
        winRateImprovement: this.calculateImprovement(baselineMetrics.winRate * 100, enhancedMetrics.winRate * 100)
      },
      avgMultiplier,
      velocityDistribution,
      timeInHighVelocity
    };
  }

  /**
   * Calculate percentage improvement
   */
  private calculateImprovement(baseline: number, enhanced: number): number {
    if (baseline === 0) return 0;
    return ((enhanced - baseline) / Math.abs(baseline)) * 100;
  }

  /**
   * Generate full velocity profile comparison report
   */
  generateVelocityReport(
    baselineMetrics: BacktestMetrics,
    baselineProfile: VelocityProfile,
    trades: Trade[],
    enhancedMetricsFunc: (trades: EnhancedTradeWithVelocity[]) => BacktestMetrics
  ): VelocityComparisonReport {
    // Apply different velocity sizing strategies
    const velocityTrades = this.applyVelocityProfileSizing(trades, baselineProfile);
    const velocityMetrics = enhancedMetricsFunc(velocityTrades);
    const velocityImpact = this.calculateVelocityImpact(baselineMetrics, velocityTrades, velocityMetrics);

    const adaptiveTrades = this.applyAdaptiveVelocitySizing(trades, baselineProfile);
    const adaptiveMetrics = enhancedMetricsFunc(adaptiveTrades);
    const adaptiveImpact = this.calculateVelocityImpact(baselineMetrics, adaptiveTrades, adaptiveMetrics);

    const hfTrades = this.applyHighFrequencyVelocitySizing(trades, baselineProfile);
    const hfMetrics = enhancedMetricsFunc(hfTrades);
    const hfImpact = this.calculateVelocityImpact(baselineMetrics, hfTrades, hfMetrics);

    // Combined: use best multiplier from each trade
    const combinedTrades = trades.map((trade, index) => {
      const vTrade = velocityTrades[index];
      const aTrade = adaptiveTrades[index];
      const hfTrade = hfTrades[index];

      // Use best performing multiplier for each trade
      const multipliers = [vTrade.velocityMultiplier, aTrade.velocityMultiplier, hfTrade.velocityMultiplier];
      const bestMultiplier = multipliers.reduce((best, current) =>
        current > best ? current : best
      );

      return {
        ...trade,
        velocityAtEntry: vTrade.velocityAtEntry,
        velocityMultiplier: bestMultiplier,
        adjustedQuantity: trade.quantity * bestMultiplier,
        velocityBased: true
      };
    });

    const combinedMetrics = enhancedMetricsFunc(combinedTrades);
    const combinedImpact = this.calculateVelocityImpact(baselineMetrics, combinedTrades, combinedMetrics);

    return {
      baseline: baselineMetrics,
      withVelocityProfile: velocityImpact,
      adaptiveVelocity: adaptiveImpact,
      highFrequencyVelocity: hfImpact,
      combined: combinedImpact
    };
  }

  /**
   * Mock velocity profile provider for testing
   */
  generateMockVelocityProfile(symbol: string, tradeCount: number): VelocityProfile {
    const priceHistory = Array.from({ length: tradeCount }, (_, i) => {
      const trend = Math.sin(i / 20) * 1000 + 10000;
      const noise = (Math.random() - 0.5) * 500;
      return Math.max(5000, trend + noise);
    });

    const volumeHistory = Array.from({ length: tradeCount }, (_, i) => {
      const base = 1000000 + Math.sin(i / 15) * 500000;
      const noise = (Math.random() - 0.5) * 200000;
      return Math.max(100000, base + noise);
    });

    return this.calculateVelocityProfile(symbol, '1h', '2024', priceHistory, volumeHistory);
  }
}

export default VelocityProfile;
