/**
 * Loss Limiter Service
 * Aggressive loss cutting to minimize drawdowns
 * 
 * Rules:
 * 1. Max loss per trade: 2% of portfolio
 * 2. Max loss per day: 5% of portfolio
 * 3. Max consecutive losses: 3 (then pause)
 * 4. Max loss streak duration: 2 hours (then pause)
 */

import type { Trade } from '@shared/schema';

export interface LossLimitConfig {
  maxLossPerTrade: number; // 0.02 = 2%
  maxDailyLoss: number; // 0.05 = 5%
  maxConsecutiveLosses: number; // 3 losses
  maxLossStreakMinutes: number; // 120 minutes
  hardStopLossPercent: number; // Exit if down 5% from entry
}

export interface PortfolioState {
  totalValue: number;
  cash: number;
  openPositions: Trade[];
  closedTodayTrades: Trade[];
  unrealizedPnL: number;
}

export interface LossLimitCheck {
  canTrade: boolean; // Can open new position?
  shouldCutLoss: string | null; // Trade ID to close or null
  reason: string; // Why blocked/cutting
  stats: {
    dailyLoss: number;
    dailyLossPercent: number;
    consecutiveLosses: number;
    lastLossTime: number | null;
    minutesSinceLastLoss: number;
  };
}

export class LossLimiter {
  constructor(private config: LossLimitConfig) {}

  /**
   * Check if we should cut a losing position
   */
  shouldCutPosition(
    trade: Trade,
    currentPrice: number,
    portfolioValue: number
  ): { shouldCut: boolean; reason: string } {
    if (trade.status !== 'OPEN') {
      return { shouldCut: false, reason: 'Trade not open' };
    }

    const unrealizedPnL = this.calculateUnrealizedPnL(trade, currentPrice);
    const unrealizedPercent = unrealizedPnL / portfolioValue;

    // Hard stop: down 5%+
    if (unrealizedPercent <= -this.config.hardStopLossPercent) {
      return {
        shouldCut: true,
        reason: `Hard stop: Down ${Math.abs(unrealizedPercent * 100).toFixed(1)}%`
      };
    }

    // Soft stop: down 3%+
    if (unrealizedPercent <= -0.03) {
      return {
        shouldCut: true,
        reason: `Soft stop: Down ${Math.abs(unrealizedPercent * 100).toFixed(1)}%`
      };
    }

    return { shouldCut: false, reason: '' };
  }

  /**
   * Comprehensive loss limit check
   */
  checkLosses(state: PortfolioState): LossLimitCheck {
    const now = Date.now();

    // Calculate daily loss
    const dailyLosses = state.closedTodayTrades
      .filter(t => t.pnl !== null && t.pnl < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0);

    const dailyLossPercent = Math.abs(dailyLosses) / (state.totalValue - state.unrealizedPnL);

    // Find worst position (biggest loss)
    const worstPosition = state.openPositions
      .map(trade => ({
        trade,
        pnl: this.calculateUnrealizedPnL(trade, 0), // simplified
        pnlPercent: this.calculateUnrealizedPnL(trade, 0) / state.totalValue
      }))
      .filter(p => p.pnl < 0)
      .sort((a, b) => a.pnlPercent - b.pnlPercent)[0];

    // Count consecutive losses
    const consecutiveLosses = this.countConsecutiveLosses(state.closedTodayTrades);

    // Time since last loss
    const lastLossTime = state.closedTodayTrades
      .filter(t => (t.pnl || 0) < 0)
      .map(t => new Date(t.exitTime || 0).getTime())
      .sort((a, b) => b - a)[0] || null;

    const minutesSinceLastLoss = lastLossTime ? (now - lastLossTime) / 60000 : 999;

    // Checks
    let canTrade = true;
    let shouldCutLoss: string | null = null;
    let reason = '';

    // Daily loss limit exceeded
    if (dailyLossPercent > this.config.maxDailyLoss) {
      canTrade = false;
      reason = `Daily loss limit exceeded: ${(dailyLossPercent * 100).toFixed(1)}% > ${(this.config.maxDailyLoss * 100).toFixed(1)}%`;
    }

    // Too many consecutive losses
    if (consecutiveLosses >= this.config.maxConsecutiveLosses) {
      canTrade = false;
      reason = `${consecutiveLosses} consecutive losses - PAUSE trading`;
    }

    // Loss streak within time window
    if (minutesSinceLastLoss < this.config.maxLossStreakMinutes && consecutiveLosses >= 2) {
      canTrade = false;
      reason = `Loss streak: ${consecutiveLosses} losses in ${minutesSinceLastLoss.toFixed(0)}min - PAUSE`;
    }

    // Cut worst losing position if daily loss getting bad
    if (dailyLossPercent > this.config.maxDailyLoss * 0.7 && worstPosition) {
      shouldCutLoss = worstPosition.trade.id;
      reason = `Cut worst loss to prevent exceeding daily limit`;
    }

    return {
      canTrade,
      shouldCutLoss,
      reason: reason || 'All limits OK',
      stats: {
        dailyLoss: Math.abs(dailyLosses),
        dailyLossPercent,
        consecutiveLosses,
        lastLossTime,
        minutesSinceLastLoss
      }
    };
  }

  /**
   * Calculate unrealized P&L for a position
   */
  private calculateUnrealizedPnL(trade: Trade, currentPrice: number): number {
    if (trade.side === 'BUY') {
      return (currentPrice - trade.entryPrice) * trade.quantity;
    } else {
      return (trade.entryPrice - currentPrice) * trade.quantity;
    }
  }

  /**
   * Count consecutive losing trades
   */
  private countConsecutiveLosses(trades: Trade[]): number {
    let consecutive = 0;
    for (const trade of trades.reverse()) {
      if ((trade.pnl || 0) < 0) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }
}
