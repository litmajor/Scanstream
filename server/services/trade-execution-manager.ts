/**
 * Trade Execution Manager
 * Unified orchestrator for:
 * 1. Loss Limiter - Cut losses early
 * 2. Drawdown Monitor - Prevent catastrophic losses
 * 3. Win Amplifier - Maximize winners
 * 4. Clustering Integration - Dynamic risk limits & exit strategies
 */

import { LossLimiter, type LossLimitConfig } from './loss-limiter';
import { DrawdownMonitor } from './drawdown-monitor';
import { WinAmplifier } from './win-amplifier';
import { getClusterMetrics, createExitStrategySelector, createStopLossOptimizer } from './clustering/index';
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
  clusteringContext?: {
    cluster_strength: number;
    exit_strategy: string;
    stop_loss_adjusted: boolean;
    size_multiplier_applied: number;
  };
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
   * Comprehensive execution decision with clustering integration
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

    // 3. CLUSTERING INTEGRATION - Get cluster metrics and apply dynamic adjustments
    let clusteringContext: ExecutionDecision['clusteringContext'] | undefined;
    let clusterSizeMultiplier = 1.0;
    let clusterStopLossAdjustment = 1.0;
    let selectedExitStrategy = 'profit_target'; // default
    let clusterMetrics: any = undefined;
    
    const symbol = (signal as any).symbol;
    if (symbol) {
      clusterMetrics = getClusterMetrics(symbol);
      
      if (clusterMetrics && clusterMetrics.cluster_strength > 0) {
        // STEP 1: Apply clustering size multiplier (from TrendRider)
        const sizeMultiplier = (signal as any).size_multiplier || 1.0; // Already calculated by agent
        clusterSizeMultiplier = Math.max(0.5, Math.min(2.0, sizeMultiplier)); // Clamp 0.5x-2.0x
        
        // STEP 2: Adjust stops based on cluster strength
        const baseStop = (signal as any).stop || 0.95;
        const clusterStrength = clusterMetrics.cluster_strength || 0;
        // Adjust stop loss: stronger clusters allow tighter stops
        const stopMultiplier = Math.max(0.8, Math.min(1.2, 1.0 - (clusterStrength * 0.2)));
        clusterStopLossAdjustment = stopMultiplier; // 0.8x to 1.2x
        
        // STEP 3: Select exit strategy based on clusters
        const exitSelector = createExitStrategySelector();
        const exitRec = exitSelector.selectStrategy(
          {
            current_profit_pct: 0, // Will be updated when holding
            cluster_strength: clusterMetrics.cluster_strength,
            trend_formation: clusterMetrics.trend_formation_signal,
            bars_held: 0,
            directional_ratio: clusterMetrics.directional_ratio,
            follow_through: clusterMetrics.follow_through
          },
          (signal as any).entry || 0,
          (signal as any).entry || 0
        );
        selectedExitStrategy = exitRec.strategy;
        
        clusteringContext = {
          cluster_strength: clusterMetrics.cluster_strength,
          exit_strategy: selectedExitStrategy,
          stop_loss_adjusted: clusterStopLossAdjustment !== 1.0,
          size_multiplier_applied: clusterSizeMultiplier
        };
        
        console.log(
          `[TradeExecutionManager] Risk adjustment for ${symbol}: ` +
          `size_mult=${clusterSizeMultiplier.toFixed(2)}x, ` +
          `stop_adj=${clusterStopLossAdjustment.toFixed(2)}x, ` +
          `exit=${selectedExitStrategy}, ` +
          `cluster_strength=${clusterMetrics.cluster_strength.toFixed(2)}`
        );
      }
    }

    // 4. Calculate position size for new trades (with clustering multiplier applied)
    const positionScaling = this.winAmplifier.calculatePositionSize(
      signal,
      basePositionSize,
      historicalWinRate
    );

    // 5. Analyze existing positions
    const positionActions = this.analyzePositions(
      portfolioState.openPositions,
      portfolioState.prices,
      clusterMetrics // Pass cluster metrics for dynamic exit decisions
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
    let finalPositionSize = positionScaling.baseSize * positionScaling.scaleMultiplier * clusterSizeMultiplier;
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

    if (clusteringContext) {
      messages.push(`🎯 Clustering: ${selectedExitStrategy} exit, size=${clusterSizeMultiplier.toFixed(1)}x`);
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
      summary: messages.join(' | '),
      clusteringContext
    };
  }

  /**
   * Analyze existing positions for actions (with clustering exit strategies)
   */
  private analyzePositions(
    positions: Trade[],
    prices: Map<string, number>,
    clusterMetrics?: any
  ): ExecutionDecision['positionActions'] {
    const actions: ExecutionDecision['positionActions'] = [];

    for (const trade of positions) {
      if (trade.status !== 'OPEN') continue;

      const currentPrice = prices.get(trade.symbol) || trade.entryPrice;
      const unrealizedPnL = this.calculateUnrealizedPnL(trade, currentPrice);
      const unrealizedPnLPct = (unrealizedPnL / (trade.entryPrice * trade.quantity)) * 100;

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
          reason: `Risk limit: ${reason}`
        });
      } else if (clusterMetrics && clusterMetrics.cluster_strength < 0.3) {
        // CLUSTERING EXIT TRIGGER: If clusters collapse (strength < 0.3), exit winning trades
        if (unrealizedPnLPct > 0.5) {
          actions.push({
            tradeId: trade.id,
            action: 'CLOSE',
            reason: `Cluster breakdown detected (strength=${clusterMetrics.cluster_strength.toFixed(2)}), exiting profit: +${unrealizedPnLPct.toFixed(2)}%`
          });
        }
      } else if (unrealizedPnL > 0) {
        // Winning position - consider adding or holding based on exit strategy
        actions.push({
          tradeId: trade.id,
          action: 'HOLD',
          reason: `Winning trade: +${unrealizedPnLPct.toFixed(2)}%, cluster strength=${clusterMetrics?.cluster_strength?.toFixed(2) || 'N/A'}`
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
