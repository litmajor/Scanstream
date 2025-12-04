/**
 * Win Amplifier Service
 * Maximizes winning trades through:
 * 1. Scaling INTO winners (pyramid)
 * 2. Increasing position size for high-confidence signals
 * 3. Holding winners longer (dynamic exit)
 * 4. Cutting losers faster (aggressive exits)
 */

import type { Signal } from '@shared/schema';

export interface PositionScaling {
  baseSize: number; // Initial position size
  shouldPyramid: boolean; // Add to winner?
  pyramidSize: number; // How much to add
  scaleMultiplier: number; // 0.5x = half size, 2x = double
  reason: string;
}

export interface TradeQuality {
  tradeId: string;
  winRate: number; // 0-1
  profitFactor: number; // Wins/Losses
  avgWinSize: number;
  avgLossSize: number;
  sharpeRatio: number;
}

export class WinAmplifier {
  private tradeStats: Map<string, TradeQuality> = new Map();

  /**
   * Calculate position size based on signal quality + historical win rate
   */
  calculatePositionSize(
    signal: Signal,
    baseSize: number,
    historicalWinRate: number = 0.55
  ): PositionScaling {
    const signalStrength = signal.strength / 100; // 0-1
    const confidence = signal.confidence; // 0-1
    const agreement = (signal.agreementScore || 50) / 100; // 0-1

    // Quality score: weighted average of factors
    const qualityScore = signalStrength * 0.4 + confidence * 0.3 + agreement * 0.3;

    // Scale multiplier: 0.5x (small) to 2x (large)
    let scaleMultiplier = 0.5 + qualityScore * 1.5; // 0.5 to 2.0

    // Boost for high win rate traders
    if (historicalWinRate > 0.60) scaleMultiplier *= 1.2;
    if (historicalWinRate > 0.65) scaleMultiplier *= 1.3;
    if (historicalWinRate > 0.70) scaleMultiplier = Math.min(scaleMultiplier * 1.4, 2.5);

    // Cap at reasonable limits
    scaleMultiplier = Math.max(0.3, Math.min(scaleMultiplier, 2.5));

    const scaledSize = baseSize * scaleMultiplier;

    return {
      baseSize,
      shouldPyramid: qualityScore > 0.75 && confidence > 0.75,
      pyramidSize: qualityScore > 0.75 ? scaledSize * 0.25 : 0, // Add 25% on top winners
      scaleMultiplier,
      reason: `Quality: ${(qualityScore * 100).toFixed(0)}% | Conf: ${(confidence * 100).toFixed(0)}% | Agreement: ${(agreement * 100).toFixed(0)}%`
    };
  }

  /**
   * Determine how long to hold winning position
   */
  calculateHoldingDuration(
    signal: Signal,
    currentPnL: number,
    baseHolding: number = 24 // hours
  ): {
    holdHours: number;
    shouldHold: boolean;
    trailingStopPercent: number; // How much to let it run
    reason: string;
  } {
    const winningPercent = currentPnL > 0 ? 1 : 0;
    const pnlMagnitude = Math.abs(currentPnL);

    // Already profitable - hold longer
    if (currentPnL > 0) {
      const profitMultiplier = 1 + Math.min(currentPnL / 100, 2); // Up to 3x hold time for big wins
      const holdHours = baseHolding * profitMultiplier;

      return {
        holdHours: Math.min(holdHours, 72), // Cap at 72 hours
        shouldHold: true,
        trailingStopPercent: 0.05, // Let it run 5% past highest point
        reason: `Win amplification: Up ${currentPnL.toFixed(1)}%, holding longer`
      };
    }

    // Losing - hold shorter or close
    if (currentPnL < 0 && Math.abs(currentPnL) > 2) {
      return {
        holdHours: Math.max(baseHolding * 0.25, 1), // Reduce hold time for losers
        shouldHold: false,
        trailingStopPercent: 0.02, // Tight stop on losers
        reason: `Down ${Math.abs(currentPnL).toFixed(1)}%, close if hits stop`
      };
    }

    return {
      holdHours: baseHolding,
      shouldHold: true,
      trailingStopPercent: 0.03,
      reason: 'Normal holding period'
    };
  }

  /**
   * Rank positions by profit potential (which to add to)
   */
  rankPositionsByPotential(
    positions: Array<{
      id: string;
      signal: Signal;
      currentPnL: number;
      duration: number; // hours held
    }>
  ): Array<{
    positionId: string;
    potential: number; // 0-1
    recommendation: 'PYRAMID' | 'HOLD' | 'REDUCE' | 'CLOSE';
    reason: string;
  }> {
    return positions
      .map(pos => {
        const signalQuality = (pos.signal.strength + pos.signal.confidence * 100) / 200;
        const pnlScore = Math.min(pos.currentPnL / 5, 1); // Score up to +5%
        const ageScore = Math.min(pos.duration / 24, 0.5); // New positions < 24h get bonus

        const potential = signalQuality * 0.5 + pnlScore * 0.3 + ageScore * 0.2;

        let recommendation: 'PYRAMID' | 'HOLD' | 'REDUCE' | 'CLOSE' = 'HOLD';
        let reason = '';

        if (potential > 0.8 && pos.currentPnL > 0) {
          recommendation = 'PYRAMID';
          reason = `High potential winner: ${(potential * 100).toFixed(0)}%, PnL: +${pos.currentPnL.toFixed(1)}%`;
        } else if (pos.currentPnL < -3) {
          recommendation = 'CLOSE';
          reason = `Losing too much: ${pos.currentPnL.toFixed(1)}%`;
        } else if (pos.currentPnL < -1 && pos.duration > 12) {
          recommendation = 'REDUCE';
          reason = `Held too long with loss: ${pos.duration}h, down ${Math.abs(pos.currentPnL).toFixed(1)}%`;
        }

        return {
          positionId: pos.id,
          potential,
          recommendation,
          reason
        };
      })
      .sort((a, b) => b.potential - a.potential);
  }

  /**
   * Calculate optimal exit level (take profit)
   */
  calculateOptimalExit(
    entryPrice: number,
    riskReward: number = 1.5,
    volatility: number = 0.02
  ): {
    takeProfitPrice: number;
    takeProfitPercent: number;
    scaledTakeProfitPrice: number; // Higher for winners
    reason: string;
  } {
    // Base TP from risk reward
    const baseTakeProfitPercent = riskReward * 0.02; // Assume 2% risk
    const takeProfitPrice = entryPrice * (1 + baseTakeProfitPercent);

    // Adjust for volatility
    const volatilityAdjustment = volatility > 0.05 ? 1.2 : volatility < 0.01 ? 0.8 : 1;
    const scaledTakeProfitPrice = entryPrice * (1 + baseTakeProfitPercent * volatilityAdjustment);

    return {
      takeProfitPrice,
      takeProfitPercent: baseTakeProfitPercent,
      scaledTakeProfitPrice,
      reason: `Risk/Reward: ${riskReward}x, Volatility adjustment: ${(volatilityAdjustment * 100).toFixed(0)}%`
    };
  }

  /**
   * Track winning patterns to boost future trades
   */
  recordTradeOutcome(
    tradeId: string,
    signal: Signal,
    pnl: number,
    durationHours: number
  ): void {
    this.tradeStats.set(tradeId, {
      tradeId,
      winRate: pnl > 0 ? 1 : 0,
      profitFactor: pnl > 0 ? 2 : 0.5,
      avgWinSize: pnl > 0 ? pnl : 0,
      avgLossSize: pnl < 0 ? Math.abs(pnl) : 0,
      sharpeRatio: pnl / (durationHours / 24)
    });
  }

  /**
   * Get average performance metrics
   */
  getPerformanceMetrics(): {
    avgWinRate: number;
    avgProfitFactor: number;
    avgWinSize: number;
    avgLossSize: number;
    winToLossRatio: number;
  } {
    if (this.tradeStats.size === 0) {
      return {
        avgWinRate: 0.5,
        avgProfitFactor: 1.0,
        avgWinSize: 0,
        avgLossSize: 0,
        winToLossRatio: 1
      };
    }

    const stats = Array.from(this.tradeStats.values());
    const avgWinRate = stats.reduce((sum, s) => sum + s.winRate, 0) / stats.length;
    const avgWinSize = stats.reduce((sum, s) => sum + s.avgWinSize, 0) / stats.length;
    const avgLossSize = stats.reduce((sum, s) => sum + s.avgLossSize, 0) / stats.length;
    const avgProfitFactor = avgWinSize / Math.max(avgLossSize, 0.01);

    return {
      avgWinRate,
      avgProfitFactor,
      avgWinSize,
      avgLossSize,
      winToLossRatio: avgWinSize / Math.max(avgLossSize, 0.01)
    };
  }
}
