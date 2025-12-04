/**
 * Trade Execution Manager
 * Unified orchestrator for:
 * 1. Loss Limiter - Cut losses early
 * 2. Drawdown Monitor - Prevent catastrophic losses
 * 3. Win Amplifier - Maximize winners
 */

import { LossLimiter, type LossLimitConfig } from './loss-limiter';
import { DrawdownMonitor } from './drawdown-monitor';
import { WinAmplifier } from './win-amplifier';
import type { Signal, Trade } from '@shared/schema';

export interface ExecutionDecision {
  canOpenNewPosition: boolean;
  positionActions: Array<{
    tradeId: string;
    action: 'CLOSE' | 'HOLD' | 'ADD_TO' | 'REDUCE';
    reason: string;
    newSize?: number; // For ADD_TO/REDUCE
  }>;
  positionSize: number; // For new trades
  overallStatus: 'HEALTHY' | 'WARNING' | 'SEVERE' | 'CRITICAL';
  summary: string;
}

export class TradeExecutionManager {
  private lossLimiter: LossLimiter;
  private drawdownMonitor: DrawdownMonitor;
  private winAmplifier: WinAmplifier;

  constructor(
    initialBalance: number = 10000,
    lossConfig?: LossLimitConfig
  ) {
    this.lossLimiter = new LossLimiter(
      lossConfig || {
        maxLossPerTrade: 0.02, // 2%
        maxDailyLoss: 0.05, // 5%
        maxConsecutiveLosses: 3,
        maxLossStreakMinutes: 120,
        hardStopLossPercent: 0.05 // 5%
      }
    );
    this.drawdownMonitor = new DrawdownMonitor(initialBalance);
    this.winAmplifier = new WinAmplifier();
  }

  /**
   * Comprehensive execution decision
   */
  makeExecutionDecision(
    signal: Signal,
    portfolioState: {
      totalValue: number;
      cash: number;
      openPositions: Trade[];
      closedTodayTrades: Trade[];
      unrealizedPnL: number;
      prices: Map<string, number>; // Current prices
    },
    basePositionSize: number = 1000, // USD
    historicalWinRate: number = 0.55
  ): ExecutionDecision {
    // 1. Check loss limits
    const lossCheck = this.lossLimiter.checkLosses({
      totalValue: portfolioState.totalValue,
      cash: portfolioState.cash,
      openPositions: portfolioState.openPositions,
      closedTodayTrades: portfolioState.closedTodayTrades,
      unrealizedPnL: portfolioState.unrealizedPnL
    });

    // 2. Check drawdown
    const drawdownState = this.drawdownMonitor.getDrawdownState(portfolioState.totalValue);
    const drawdownAction = this.drawdownMonitor.getAction(portfolioState.totalValue);

    // 3. Calculate position size for new trades
    const positionScaling = this.winAmplifier.calculatePositionSize(
      signal,
      basePositionSize,
      historicalWinRate
    );

    // 4. Analyze existing positions
    const positionActions = this.analyzePositions(
      portfolioState.openPositions,
      portfolioState.prices
    );

    // Determine overall status
    let overallStatus: 'HEALTHY' | 'WARNING' | 'SEVERE' | 'CRITICAL' = 'HEALTHY';
    if (drawdownState.isCritical || lossCheck.stats.dailyLossPercent > 0.2) {
      overallStatus = 'CRITICAL';
    } else if (drawdownState.isSevere || lossCheck.stats.dailyLossPercent > 0.15) {
      overallStatus = 'SEVERE';
    } else if (drawdownState.isWarning || lossCheck.stats.dailyLossPercent > 0.1) {
      overallStatus = 'WARNING';
    }

    // Can we open new positions?
    let canOpenNewPosition = lossCheck.canTrade && drawdownAction.action === 'CONTINUE';

    // Cap position size by drawdown
    let finalPositionSize = positionScaling.baseSize * positionScaling.scaleMultiplier;
    if (drawdownState.isWarning) {
      finalPositionSize *= 0.75; // Reduce 25% on warning
    }
    if (drawdownState.isSevere) {
      finalPositionSize *= 0.5; // Reduce 50% on severe
    }
    if (drawdownState.isCritical) {
      canOpenNewPosition = false;
      finalPositionSize = 0;
    }

    // Summary message
    const messages: string[] = [];
    if (!canOpenNewPosition) {
      messages.push(`❌ Cannot open: ${lossCheck.reason || drawdownAction.reason}`);
    } else {
      messages.push(`✅ Can open: Size ${finalPositionSize.toFixed(0)} USD`);
    }

    if (lossCheck.shouldCutLoss) {
      messages.push(`🔴 Cut loss on trade: ${lossCheck.shouldCutLoss}`);
    }

    if (drawdownAction.action !== 'CONTINUE') {
      messages.push(`⚠️ ${drawdownAction.reason}`);
    }

    return {
      canOpenNewPosition,
      positionActions,
      positionSize: finalPositionSize,
      overallStatus,
      summary: messages.join(' | ')
    };
  }

  /**
   * Analyze existing positions for actions
   */
  private analyzePositions(
    positions: Trade[],
    prices: Map<string, number>
  ): ExecutionDecision['positionActions'] {
    const actions: ExecutionDecision['positionActions'] = [];

    for (const trade of positions) {
      if (trade.status !== 'OPEN') continue;

      const currentPrice = prices.get(trade.symbol) || trade.entryPrice;
      const unrealizedPnL = this.calculateUnrealizedPnL(trade, currentPrice);

      // Loss limit check
      const { shouldCut, reason } = this.lossLimiter.shouldCutPosition(
        trade,
        currentPrice,
        10000 // Placeholder portfolio value
      );

      if (shouldCut) {
        actions.push({
          tradeId: trade.id,
          action: 'CLOSE',
          reason
        });
      } else if (unrealizedPnL > 0) {
        // Winning position - consider adding
        actions.push({
          tradeId: trade.id,
          action: 'ADD_TO',
          reason: `Winning trade: +${unrealizedPnL.toFixed(2)} USD`
        });
      }
    }

    return actions;
  }

  /**
   * Calculate unrealized P&L
   */
  private calculateUnrealizedPnL(trade: Trade, currentPrice: number): number {
    if (trade.side === 'BUY') {
      return (currentPrice - trade.entryPrice) * trade.quantity;
    } else {
      return (trade.entryPrice - currentPrice) * trade.quantity;
    }
  }

  /**
   * Record trade outcome for learning
   */
  recordTradeOutcome(
    tradeId: string,
    signal: Signal,
    pnl: number,
    durationHours: number
  ): void {
    this.winAmplifier.recordTradeOutcome(tradeId, signal, pnl, durationHours);
  }

  /**
   * Get metrics
   */
  getMetrics(): {
    portfolio: {
      highWaterMark: number;
      currentValue: number;
      maxDrawdown: number;
      status: string;
    };
    performance: {
      avgWinRate: number;
      profitFactor: number;
      winToLossRatio: number;
    };
  } {
    const drawdownStats = this.drawdownMonitor.getStats();
    const perfMetrics = this.winAmplifier.getPerformanceMetrics();

    return {
      portfolio: {
        highWaterMark: drawdownStats.highWaterMark,
        currentValue: 0, // Would be populated from caller
        maxDrawdown: 0,
        status: 'TRACKING'
      },
      performance: {
        avgWinRate: perfMetrics.avgWinRate,
        profitFactor: perfMetrics.avgProfitFactor,
        winToLossRatio: perfMetrics.winToLossRatio
      }
    };
  }
}
