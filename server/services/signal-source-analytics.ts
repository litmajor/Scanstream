
/**
 * Signal Source Analytics
 * 
 * Tracks performance metrics per signal source (ML, RL, Gateway, Scanner)
 * Calculates win rate, Sharpe ratio, Sortino ratio, drawdown, and profit factor
 * for each signal source independently.
 */

interface SignalSourceTrade {
  source: 'ML' | 'RL' | 'GATEWAY' | 'SCANNER' | 'CONSENSUS';
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  pnl: number;
  pnlPercent: number;
  confidence: number;
  pattern: string;
}

interface SourceMetrics {
  source: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  avgDrawdown: number;
  currentDrawdown: number;
  calmarRatio: number;
  avgHoldingPeriod: number; // hours
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  avgConfidence: number;
}

export class SignalSourceAnalytics {
  private trades: Map<string, SignalSourceTrade[]> = new Map();
  private readonly sources = ['ML', 'RL', 'GATEWAY', 'SCANNER', 'CONSENSUS'];

  constructor() {
    // Initialize trade arrays for each source
    for (const source of this.sources) {
      this.trades.set(source, []);
    }
  }

  /**
   * Record a completed trade
   */
  recordTrade(trade: SignalSourceTrade): void {
    const sourceTrades = this.trades.get(trade.source) || [];
    sourceTrades.push(trade);
    this.trades.set(trade.source, sourceTrades);
  }

  /**
   * Calculate metrics for a specific source
   */
  getSourceMetrics(source: string): SourceMetrics {
    const sourceTrades = this.trades.get(source) || [];
    
    if (sourceTrades.length === 0) {
      return {
        source,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        totalReturn: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        avgDrawdown: 0,
        currentDrawdown: 0,
        calmarRatio: 0,
        avgHoldingPeriod: 0,
        bestTrade: 0,
        worstTrade: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        avgConfidence: 0
      };
    }

    const winners = sourceTrades.filter(t => t.pnl > 0);
    const losers = sourceTrades.filter(t => t.pnl <= 0);

    const totalTrades = sourceTrades.length;
    const winningTrades = winners.length;
    const losingTrades = losers.length;
    const winRate = (winningTrades / totalTrades) * 100;

    const avgWin = winners.length > 0
      ? winners.reduce((sum, t) => sum + t.pnlPercent, 0) / winners.length
      : 0;

    const avgLoss = losers.length > 0
      ? Math.abs(losers.reduce((sum, t) => sum + t.pnlPercent, 0) / losers.length)
      : 0;

    const totalWinAmount = winners.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0);
    const totalLossAmount = losers.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0);
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0;

    const totalReturn = sourceTrades.reduce((sum, t) => sum + t.pnlPercent, 0);

    // Sharpe Ratio
    const returns = sourceTrades.map(t => t.pnlPercent);
    const avgReturn = totalReturn / totalTrades;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev !== 0 ? (avgReturn - 0.5) / stdDev : 0; // 0.5% risk-free rate

    // Sortino Ratio (only downside deviation)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length
      : 0;
    const downsideStdDev = Math.sqrt(downsideVariance);
    const sortinoRatio = downsideStdDev !== 0 ? (avgReturn - 0.5) / downsideStdDev : 0;

    // Drawdown calculations
    let peak = 0;
    let maxDD = 0;
    let currentDD = 0;
    let cumulative = 0;
    const drawdowns: number[] = [];

    for (const trade of sourceTrades) {
      cumulative += trade.pnlPercent;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const dd = ((peak - cumulative) / (peak || 1)) * 100;
      drawdowns.push(dd);
      if (dd > maxDD) {
        maxDD = dd;
      }
    }
    currentDD = drawdowns[drawdowns.length - 1] || 0;
    const avgDrawdown = drawdowns.reduce((sum, dd) => sum + dd, 0) / drawdowns.length;

    // Calmar Ratio
    const annualizedReturn = avgReturn * 252; // Assuming daily trades
    const calmarRatio = maxDD > 0 ? annualizedReturn / maxDD : 0;

    // Holding period
    const holdingPeriods = sourceTrades.map(t => 
      (t.exitTime.getTime() - t.entryTime.getTime()) / (1000 * 60 * 60) // hours
    );
    const avgHoldingPeriod = holdingPeriods.reduce((sum, h) => sum + h, 0) / holdingPeriods.length;

    // Best/worst trades
    const bestTrade = Math.max(...sourceTrades.map(t => t.pnlPercent));
    const worstTrade = Math.min(...sourceTrades.map(t => t.pnlPercent));

    // Consecutive wins/losses
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    for (const trade of sourceTrades) {
      if (trade.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    }

    // Average confidence
    const avgConfidence = sourceTrades.reduce((sum, t) => sum + t.confidence, 0) / totalTrades;

    return {
      source,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      totalReturn,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: maxDD,
      avgDrawdown,
      currentDrawdown: currentDD,
      calmarRatio,
      avgHoldingPeriod,
      bestTrade,
      worstTrade,
      consecutiveWins: maxWinStreak,
      consecutiveLosses: maxLossStreak,
      avgConfidence
    };
  }

  /**
   * Get metrics for all sources
   */
  getAllSourceMetrics(): Map<string, SourceMetrics> {
    const metrics = new Map<string, SourceMetrics>();
    for (const source of this.sources) {
      metrics.set(source, this.getSourceMetrics(source));
    }
    return metrics;
  }

  /**
   * Get best performing source
   */
  getBestSource(metric: 'winRate' | 'sharpeRatio' | 'profitFactor' = 'sharpeRatio'): string {
    const allMetrics = this.getAllSourceMetrics();
    let bestSource = 'CONSENSUS';
    let bestValue = -Infinity;

    for (const [source, metrics] of allMetrics.entries()) {
      const value = metrics[metric];
      if (value > bestValue) {
        bestValue = value;
        bestSource = source;
      }
    }

    return bestSource;
  }

  /**
   * Export data for analysis
   */
  exportData() {
    return {
      trades: Object.fromEntries(this.trades),
      metrics: Object.fromEntries(this.getAllSourceMetrics())
    };
  }
}

// Singleton instance
export const signalSourceAnalytics = new SignalSourceAnalytics();
