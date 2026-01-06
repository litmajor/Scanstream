/**
 * Metrics Calculator
 * Computes performance metrics from backtest trade results
 * Metrics: Win rate, Profit factor, Sharpe ratio, Sortino, Max drawdown
 */

export interface TradeResult {
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryBar: number;
  exitBar: number;
  pnlPct: number;
  pnlAbs: number;
  status: 'WIN' | 'LOSS' | 'PARTIAL';
  exitReason: string;
}

export interface BarReturn {
  bar: number;
  timestamp: number;
  dailyReturn: number;  // Return for this bar
  cumulativeReturn: number;
}

export interface BacktestMetrics {
  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;  // %
  
  // Profit Metrics
  totalProfit: number;
  totalLoss: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;  // Gross profit / Gross loss
  
  // Average Metrics
  avgWin: number;  // Absolute
  avgLoss: number;  // Absolute
  avgWinPct: number;  // %
  avgLossPct: number;  // %
  riskRewardRatio: number;  // Avg win / Avg loss
  
  // Drawdown
  maxDrawdown: number;  // Peak to trough %
  maxDrawdownAbs: number;  // Dollar amount
  
  // Returns
  totalReturn: number;  // %
  annualizedReturn: number;  // %
  monthlyAvgReturn: number;  // %
  
  // Risk-Adjusted
  sharpeRatio: number;  // Return / StdDev * sqrt(252)
  sortinoRatio: number;  // Return / DownsideStdDev * sqrt(252)
  calmarRatio: number;  // Annual return / Max drawdown
  
  // Trade Duration
  avgBarsDuration: number;
  maxBarsDuration: number;
  minBarsDuration: number;
  
  // Streak Info
  longestWinStreak: number;
  longestLossStreak: number;
  
  // Additional
  bars: number;
  startPrice: number;
  endPrice: number;
}

export class MetricsCalculator {
  
  /**
   * Calculate all metrics from trade results
   */
  static calculate(
    trades: TradeResult[],
    barReturns: BarReturn[],
    totalBars: number,
    riskFreeRate: number = 0.05  // 5% annual
  ): BacktestMetrics {
    
    if (trades.length === 0) {
      return this.getEmptyMetrics(totalBars);
    }
    
    // Trade-based metrics
    const winningTrades = trades.filter(t => t.pnlPct > 0);
    const losingTrades = trades.filter(t => t.pnlPct < 0);
    const winRate = winningTrades.length / trades.length;
    
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnlAbs, 0);
    const totalLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlAbs), 0);
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnlAbs, 0);
    const grossLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlAbs), 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
    
    const avgWin = winningTrades.length > 0 
      ? grossProfit / winningTrades.length 
      : 0;
    const avgLoss = losingTrades.length > 0 
      ? grossLoss / losingTrades.length 
      : 0;
    const avgWinPct = winningTrades.length > 0 
      ? (winningTrades.reduce((sum, t) => sum + t.pnlPct, 0) / winningTrades.length) * 100
      : 0;
    const avgLossPct = losingTrades.length > 0 
      ? (losingTrades.reduce((sum, t) => sum + Math.abs(t.pnlPct), 0) / losingTrades.length) * 100
      : 0;
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0);
    
    // Drawdown metrics
    const { maxDrawdown, maxDrawdownAbs } = this.calculateDrawdown(barReturns);
    
    // Returns metrics
    const totalReturn = this.calculateTotalReturn(trades);
    const annualizedReturn = this.annualizeReturn(totalReturn, totalBars);
    const monthlyAvgReturn = totalReturn / 12;  // Approximate (365 / 30)
    
    // Risk-adjusted metrics
    const { sharpeRatio, sortinoRatio } = this.calculateRiskMetrics(
      barReturns,
      riskFreeRate,
      totalBars
    );
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
    
    // Duration metrics
    const durations = trades.map(t => t.exitBar - t.entryBar);
    const avgBarsDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    const maxBarsDuration = Math.max(...durations, 0);
    const minBarsDuration = Math.min(...durations, 0);
    
    // Streak metrics
    const streaks = this.calculateStreaks(trades);
    
    // Price metrics
    const startPrice = barReturns.length > 0 ? barReturns[0].cumulativeReturn : 1;
    const endPrice = barReturns.length > 0 
      ? barReturns[barReturns.length - 1].cumulativeReturn 
      : 1;
    
    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winRate * 100,
      
      totalProfit,
      totalLoss,
      grossProfit,
      grossLoss,
      profitFactor,
      
      avgWin,
      avgLoss,
      avgWinPct,
      avgLossPct,
      riskRewardRatio,
      
      maxDrawdown: maxDrawdown * 100,
      maxDrawdownAbs,
      
      totalReturn: totalReturn * 100,
      annualizedReturn: annualizedReturn * 100,
      monthlyAvgReturn: monthlyAvgReturn * 100,
      
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      
      avgBarsDuration,
      maxBarsDuration,
      minBarsDuration,
      
      longestWinStreak: streaks.longestWin,
      longestLossStreak: streaks.longestLoss,
      
      bars: totalBars,
      startPrice,
      endPrice,
    };
  }
  
  /**
   * Calculate maximum drawdown
   */
  private static calculateDrawdown(returns: BarReturn[]): { maxDrawdown: number; maxDrawdownAbs: number } {
    if (returns.length === 0) return { maxDrawdown: 0, maxDrawdownAbs: 0 };
    
    let maxDrawdown = 0;
    let maxDrawdownAbs = 0;
    let peak = returns[0].cumulativeReturn;
    
    for (const bar of returns) {
      if (bar.cumulativeReturn > peak) {
        peak = bar.cumulativeReturn;
      }
      
      const drawdown = (peak - bar.cumulativeReturn) / peak;
      const drawdownAbs = peak - bar.cumulativeReturn;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownAbs = drawdownAbs;
      }
    }
    
    return { maxDrawdown, maxDrawdownAbs };
  }
  
  /**
   * Calculate total return from trades
   */
  private static calculateTotalReturn(trades: TradeResult[]): number {
    if (trades.length === 0) return 0;
    
    let cumulativeReturn = 1;
    for (const trade of trades) {
      cumulativeReturn *= (1 + trade.pnlPct);
    }
    
    return cumulativeReturn - 1;
  }
  
  /**
   * Annualize return based on bar count
   */
  private static annualizeReturn(totalReturn: number, totalBars: number): number {
    // Assume 8760 bars in a year (hourly)
    const barsPerYear = 8760;
    const yearsElapsed = totalBars / barsPerYear;
    
    if (yearsElapsed <= 0) return totalReturn;
    
    // (1 + r)^n = 1 + total_return, solve for r
    return Math.pow(1 + totalReturn, 1 / yearsElapsed) - 1;
  }
  
  /**
   * Calculate Sharpe and Sortino ratios
   */
  private static calculateRiskMetrics(
    returns: BarReturn[],
    riskFreeRate: number,
    totalBars: number
  ): { sharpeRatio: number; sortinoRatio: number } {
    if (returns.length === 0) return { sharpeRatio: 0, sortinoRatio: 0 };
    
    const dailyReturns = returns.map(r => r.dailyReturn);
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    
    // Standard deviation
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    
    // Downside deviation (only negative returns)
    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = downsideReturns.length > 0
      ? downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length
      : 0;
    const downsideStdDev = Math.sqrt(downsideVariance);
    
    // Annualize (hourly data: ~252 trading days * 24 hours ≈ 6000 hours, or use 8760 for calendar hours)
    const annualizeFactor = Math.sqrt(252);  // Standard Sharpe annualization
    
    // Sharpe ratio
    const sharpeRatio = stdDev > 0 
      ? ((avgReturn - riskFreeRate / 252) / stdDev) * annualizeFactor 
      : 0;
    
    // Sortino ratio
    const sortinoRatio = downsideStdDev > 0 
      ? ((avgReturn - riskFreeRate / 252) / downsideStdDev) * annualizeFactor 
      : 0;
    
    return { sharpeRatio, sortinoRatio };
  }
  
  /**
   * Calculate win/loss streaks
   */
  private static calculateStreaks(trades: TradeResult[]): { longestWin: number; longestLoss: number } {
    if (trades.length === 0) return { longestWin: 0, longestLoss: 0 };
    
    let currentStreak = 0;
    let longestWin = 0;
    let longestLoss = 0;
    let lastWasWin = trades[0].pnlPct > 0;
    
    for (const trade of trades) {
      const isWin = trade.pnlPct > 0;
      
      if (isWin === lastWasWin) {
        currentStreak++;
      } else {
        if (lastWasWin) {
          longestWin = Math.max(longestWin, currentStreak);
        } else {
          longestLoss = Math.max(longestLoss, currentStreak);
        }
        currentStreak = 1;
        lastWasWin = isWin;
      }
    }
    
    // Check final streak
    if (lastWasWin) {
      longestWin = Math.max(longestWin, currentStreak);
    } else {
      longestLoss = Math.max(longestLoss, currentStreak);
    }
    
    return { longestWin, longestLoss };
  }
  
  /**
   * Format metrics for display
   */
  static formatMetrics(metrics: BacktestMetrics): string {
    return `
╔════════════════════════════════════════════════════════════╗
║              BACKTEST PERFORMANCE METRICS                 ║
╠════════════════════════════════════════════════════════════╣

📊 TRADE STATISTICS
├─ Total Trades: ${metrics.totalTrades}
├─ Winning: ${metrics.winningTrades} | Losing: ${metrics.losingTrades}
├─ Win Rate: ${metrics.winRate.toFixed(2)}%
├─ Longest Win Streak: ${metrics.longestWinStreak}
└─ Longest Loss Streak: ${metrics.longestLossStreak}

💰 PROFIT METRICS
├─ Gross Profit: $${metrics.grossProfit.toFixed(2)}
├─ Gross Loss: $${metrics.grossLoss.toFixed(2)}
├─ Profit Factor: ${metrics.profitFactor.toFixed(2)}x
├─ Avg Win: $${metrics.avgWin.toFixed(2)} (${metrics.avgWinPct.toFixed(2)}%)
├─ Avg Loss: $${metrics.avgLoss.toFixed(2)} (${metrics.avgLossPct.toFixed(2)}%)
└─ Risk/Reward Ratio: ${metrics.riskRewardRatio.toFixed(2)}

📈 RETURNS
├─ Total Return: ${metrics.totalReturn.toFixed(2)}%
├─ Annualized Return: ${metrics.annualizedReturn.toFixed(2)}%
└─ Monthly Average: ${metrics.monthlyAvgReturn.toFixed(2)}%

⚠️ RISK METRICS
├─ Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%
├─ Max Drawdown ($): ${metrics.maxDrawdownAbs.toFixed(2)}
├─ Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
├─ Sortino Ratio: ${metrics.sortinoRatio.toFixed(2)}
└─ Calmar Ratio: ${metrics.calmarRatio.toFixed(2)}

⏱️ DURATION
├─ Avg Bars per Trade: ${metrics.avgBarsDuration.toFixed(0)}
├─ Max Bars: ${metrics.maxBarsDuration}
└─ Min Bars: ${metrics.minBarsDuration}

╚════════════════════════════════════════════════════════════╝
    `;
  }
  
  private static getEmptyMetrics(totalBars: number): BacktestMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      
      totalProfit: 0,
      totalLoss: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      
      avgWin: 0,
      avgLoss: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      riskRewardRatio: 0,
      
      maxDrawdown: 0,
      maxDrawdownAbs: 0,
      
      totalReturn: 0,
      annualizedReturn: 0,
      monthlyAvgReturn: 0,
      
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      
      avgBarsDuration: 0,
      maxBarsDuration: 0,
      minBarsDuration: 0,
      
      longestWinStreak: 0,
      longestLossStreak: 0,
      
      bars: totalBars,
      startPrice: 0,
      endPrice: 0,
    };
  }
}
