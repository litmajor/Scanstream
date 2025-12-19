/**
 * VFMD Performance Monitor
 * 
 * Tracks live performance metrics and detects performance degradation
 * Alerts when system performance drifts from expected levels
 */

import type { Trade } from './backtester';

/**
 * Live performance statistics
 */
export interface PerformanceStats {
  // Time period
  startDate: Date;
  endDate: Date;
  periodName: string;
  tradeDays: number;

  // Returns
  totalTrades: number;
  totalReturn: number;
  returnPercent: number;
  avgReturn: number;
  winRate: number;

  // Risk metrics
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  profitFactor: number;

  // Per-regime breakdown
  regimeDistribution: {
    laminar_trend: number;
    turbulent_chop: number;
    accumulation: number;
    distribution: number;
    breakout_transition: number;
    consolidation: number;
  };

  // Signal accuracy
  pegAccuracy: number; // % of PEG signals that were profitable
  avgEntryLead: number; // Bars ahead of actual breakout
  avgHoldDuration: number; // Average bars held

  // Drift detection
  recentWinRate: number; // Last 30 days
  historicalWinRate: number; // All-time
  drift: number; // Change in win rate
  driftSignificant: boolean; // Drift > 5%?

  // Alert status
  alerts: PerformanceAlert[];
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  metric: string;
  current: number;
  threshold: number;
  timestamp: Date;
}

export class VFMDMonitor {
  private trades: Trade[] = [];
  private regimeLog: Array<{ timestamp: Date; regime: string }> = [];

  /**
   * Record a completed trade
   */
  recordTrade(trade: Trade): void {
    this.trades.push(trade);
  }

  /**
   * Record regime change
   */
  recordRegimeChange(regime: string): void {
    this.regimeLog.push({
      timestamp: new Date(),
      regime
    });
  }

  /**
   * Get complete performance report
   */
  getPerformanceStats(
    historicalTrades?: Trade[],
    expectedWinRate: number = 0.55,
    expectedSharpe: number = 1.5
  ): PerformanceStats {
    // Combine historical and live trades
    const allTrades = [...(historicalTrades || []), ...this.trades];

    // Split by time period
    const allTime = allTrades;
    const recentDays = 30;
    const recentCutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);
    const recent = allTrades.filter(t => new Date(t.exitBar * 1000) > recentCutoff);

    // Calculate returns
    const totalReturn = allTrades.reduce((sum, t) => sum + t.pnl, 0);
    const recentReturn = recent.reduce((sum, t) => sum + t.pnl, 0);

    const wins = allTrades.filter(t => t.pnl > 0).length;
    const losses = allTrades.filter(t => t.pnl < 0).length;
    const recentWins = recent.filter(t => t.pnl > 0).length;

    const winRate = allTrades.length > 0 ? wins / allTrades.length : 0;
    const recentWinRate = recent.length > 0 ? recentWins / recent.length : 0;
    const drift = recentWinRate - winRate;

    // Calculate risk metrics
    const returns = allTrades.map(t => t.pnlPercent);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance =
      returns.length > 0
        ? returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length
        : 0;
    const sharpeRatio = (avgReturn / Math.sqrt(variance)) * Math.sqrt(252);

    const downReturns = returns.filter(r => r < 0);
    const downVariance =
      downReturns.length > 0
        ? downReturns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / downReturns.length
        : variance;
    const sortinoRatio = (avgReturn / Math.sqrt(downVariance)) * Math.sqrt(252);

    // Max drawdown
    let maxDD = 0;
    let runningPnL = 0;
    let peak = 0;
    for (const trade of allTrades) {
      runningPnL += trade.pnl;
      peak = Math.max(peak, runningPnL);
      const dd = (peak - runningPnL) / (peak || 1);
      maxDD = Math.max(maxDD, dd);
    }

    // Profit factor
    const totalWins = wins > 0 ? allTrades.filter(t => t.pnl > 0).reduce((a, b) => a + b.pnl, 0) : 0;
    const totalLosses =
      losses > 0 ? Math.abs(allTrades.filter(t => t.pnl < 0).reduce((a, b) => a + b.pnl, 0)) : 1;
    const profitFactor = totalWins / totalLosses;

    // Regime distribution
    const regimeCount = this.regimeLog.reduce(
      (acc, log) => {
        acc[log.regime] = (acc[log.regime] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalRegimes = Object.values(regimeCount).reduce((a, b) => a + b, 0);

    const regimeDistribution = {
      laminar_trend: (regimeCount['laminar_trend'] || 0) / (totalRegimes || 1),
      turbulent_chop: (regimeCount['turbulent_chop'] || 0) / (totalRegimes || 1),
      accumulation: (regimeCount['accumulation'] || 0) / (totalRegimes || 1),
      distribution: (regimeCount['distribution'] || 0) / (totalRegimes || 1),
      breakout_transition: (regimeCount['breakout_transition'] || 0) / (totalRegimes || 1),
      consolidation: (regimeCount['consolidation'] || 0) / (totalRegimes || 1)
    };

    // PEG accuracy
    const pegAccuracy = winRate; // Simplified: % of entries that were profitable

    // Entry lead time
    const avgEntryLead =
      allTrades.length > 0 ? allTrades.reduce((sum, t) => sum + t.bars, 0) / allTrades.length : 0;

    // Generate alerts
    const alerts: PerformanceAlert[] = [];

    if (sharpeRatio < expectedSharpe * 0.7) {
      alerts.push({
        severity: 'WARNING',
        message: `Sharpe ratio degraded: ${sharpeRatio.toFixed(2)} vs expected ${expectedSharpe.toFixed(2)}`,
        metric: 'sharpe_ratio',
        current: sharpeRatio,
        threshold: expectedSharpe,
        timestamp: new Date()
      });
    }

    if (recentWinRate < expectedWinRate * 0.8 && recent.length > 5) {
      alerts.push({
        severity: 'WARNING',
        message: `Recent win rate dropped to ${(recentWinRate * 100).toFixed(0)}%`,
        metric: 'recent_win_rate',
        current: recentWinRate,
        threshold: expectedWinRate,
        timestamp: new Date()
      });
    }

    if (Math.abs(drift) > 0.1) {
      alerts.push({
        severity: 'WARNING',
        message: `Performance drifted ${(drift * 100).toFixed(1)}% from historical average`,
        metric: 'performance_drift',
        current: recentWinRate,
        threshold: winRate,
        timestamp: new Date()
      });
    }

    if (maxDD > 0.25) {
      alerts.push({
        severity: 'CRITICAL',
        message: `Maximum drawdown exceeded: ${(maxDD * 100).toFixed(1)}%`,
        metric: 'max_drawdown',
        current: maxDD,
        threshold: 0.25,
        timestamp: new Date()
      });
    }

    if (regimeDistribution.turbulent_chop > 0.3) {
      alerts.push({
        severity: 'INFO',
        message: `${(regimeDistribution.turbulent_chop * 100).toFixed(0)}% time spent in turbulent markets (avoid)`,
        metric: 'turbulent_time',
        current: regimeDistribution.turbulent_chop,
        threshold: 0.2,
        timestamp: new Date()
      });
    }

    return {
      startDate: allTrades.length > 0 ? new Date(allTrades[0].entryBar * 1000) : new Date(),
      endDate: new Date(),
      periodName: 'all-time',
      tradeDays: Math.ceil((new Date().getTime() - (allTrades[0]?.entryBar || 0) * 1000) / (24 * 60 * 60 * 1000)),

      totalTrades: allTrades.length,
      totalReturn: totalReturn,
      returnPercent: totalReturn / 10000, // Assuming $10k account
      avgReturn,
      winRate,

      maxDrawdown: maxDD,
      sharpeRatio,
      sortinoRatio,
      profitFactor,

      regimeDistribution,

      pegAccuracy: winRate,
      avgEntryLead,
      avgHoldDuration: allTrades.length > 0 ? allTrades.reduce((sum, t) => sum + t.bars, 0) / allTrades.length : 0,

      recentWinRate,
      historicalWinRate: winRate,
      drift,
      driftSignificant: Math.abs(drift) > 0.05,

      alerts
    };
  }

  /**
   * Get regime-specific performance
   */
  getRegimePerformance(
    trades: Trade[]
  ): Record<
    string,
    {
      tradeCount: number;
      winRate: number;
      avgPnL: number;
      profitFactor: number;
    }
  > {
    const byRegime: Record<
      string,
      {
        trades: Trade[];
        wins: number;
        losses: number;
        totalPnL: number;
      }
    > = {};

    // Group by regime
    for (const trade of trades) {
      const regime = trade.entryRegime;
      if (!byRegime[regime]) {
        byRegime[regime] = {
          trades: [],
          wins: 0,
          losses: 0,
          totalPnL: 0
        };
      }

      byRegime[regime].trades.push(trade);
      if (trade.pnl > 0) byRegime[regime].wins++;
      else byRegime[regime].losses++;
      byRegime[regime].totalPnL += trade.pnl;
    }

    // Calculate stats
    const results: Record<
      string,
      {
        tradeCount: number;
        winRate: number;
        avgPnL: number;
        profitFactor: number;
      }
    > = {};

    for (const [regime, data] of Object.entries(byRegime)) {
      const tradeCount = data.trades.length;
      const winRate = data.wins / tradeCount;
      const avgPnL = data.totalPnL / tradeCount;
      const winPnL = data.trades.filter(t => t.pnl > 0).reduce((a, b) => a + b.pnl, 0);
      const lossPnL = Math.abs(
        data.trades.filter(t => t.pnl < 0).reduce((a, b) => a + b.pnl, 0)
      );
      const profitFactor = lossPnL > 0 ? winPnL / lossPnL : 0;

      results[regime] = {
        tradeCount,
        winRate,
        avgPnL,
        profitFactor
      };
    }

    return results;
  }

  /**
   * Format performance report
   */
  static formatReport(stats: PerformanceStats): string {
    const lines = [
      `\n${'='.repeat(70)}`,
      `VFMD PERFORMANCE MONITOR - ${stats.periodName.toUpperCase()}`,
      `${stats.startDate.toISOString()} to ${stats.endDate.toISOString()}`,
      `${'='.repeat(70)}`,

      `\nOVERALL PERFORMANCE:`,
      `  Total Trades: ${stats.totalTrades}`,
      `  Total Return: $${stats.totalReturn.toLocaleString()} (${(stats.returnPercent * 100).toFixed(1)}%)`,
      `  Average Trade: ${(stats.avgReturn * 100).toFixed(2)}%`,
      `  Win Rate: ${(stats.winRate * 100).toFixed(1)}%`,
      `  Profit Factor: ${stats.profitFactor.toFixed(2)}`,

      `\nRISK METRICS:`,
      `  Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}`,
      `  Sortino Ratio: ${stats.sortinoRatio.toFixed(2)}`,
      `  Max Drawdown: ${(stats.maxDrawdown * 100).toFixed(1)}%`,

      `\nRECENT PERFORMANCE (Last 30 days):`,
      `  Win Rate: ${(stats.recentWinRate * 100).toFixed(1)}%`,
      `  Drift: ${(stats.drift * 100).toFixed(1)}% ${stats.driftSignificant ? '⚠️ SIGNIFICANT' : '✓'}`,

      `\nREGIME TIME DISTRIBUTION:`,
      `  Trending: ${(stats.regimeDistribution.laminar_trend * 100).toFixed(0)}%`,
      `  Turbulent: ${(stats.regimeDistribution.turbulent_chop * 100).toFixed(0)}%`,
      `  Accumulation: ${(stats.regimeDistribution.accumulation * 100).toFixed(0)}%`,
      `  Distribution: ${(stats.regimeDistribution.distribution * 100).toFixed(0)}%`,
      `  Breakout: ${(stats.regimeDistribution.breakout_transition * 100).toFixed(0)}%`,
      `  Consolidation: ${(stats.regimeDistribution.consolidation * 100).toFixed(0)}%`
    ];

    // Add alerts
    if (stats.alerts.length > 0) {
      lines.push(`\nALERTS (${stats.alerts.length}):`);
      for (const alert of stats.alerts) {
        const icon = alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '🟡' : 'ℹ️';
        lines.push(
          `  ${icon} [${alert.severity}] ${alert.message} (${alert.current.toFixed(2)} vs ${alert.threshold.toFixed(2)})`
        );
      }
    } else {
      lines.push(`\n✅ No alerts - System performing normally`);
    }

    lines.push(`\n${'='.repeat(70)}\n`);
    return lines.join('\n');
  }
}
