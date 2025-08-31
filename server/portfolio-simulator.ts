// Enhanced Portfolio Simulator with advanced features
import { Trade, Signal } from "@shared/schema";
import fs from 'fs';
import path from 'path';

function loadTradingConfig() {
  const configPath = path.resolve(__dirname, '../config/trading-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

export interface PortfolioSimulatorOptions {
  initialCapital?: number;
  commissionRate?: number; // as percentage (e.g., 0.1 for 0.1%)
  slippageRate?: number; // as percentage
  maxPositionsPerSymbol?: number;
  riskFreeRate?: number; // annual risk-free rate for Sharpe ratio
  benchmarkReturns?: number[]; // for comparison
}

export interface PositionSizeConfig {
  type: 'fixed' | 'percentage' | 'kelly' | 'volatility';
  value: number; // amount, percentage, or multiplier
  maxRisk?: number; // max risk per trade as percentage of capital
}

export interface DrawdownPeriod {
  startDate: Date;
  endDate: Date | null;
  startValue: number;
  minValue: number;
  maxDrawdown: number;
  duration: number; // in days
  recovered: boolean;
}

export interface PerformanceMetrics {
  // Basic metrics
  totalReturn: number;
  annualizedReturn: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalTrades: number;
  
  // Risk metrics
  maxDrawdown: number;
  averageDrawdown: number;
  maxDrawdownDuration: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number;
  
  // Advanced metrics
  kelly: number; // Kelly criterion
  var95: number; // Value at Risk (95%)
  cvar95: number; // Conditional VaR (95%)
  beta?: number; // vs benchmark
  alpha?: number; // vs benchmark
  
  // Trade analysis
  consecutiveWins: number;
  consecutiveLosses: number;
  largestWin: number;
  largestLoss: number;
  avgTradeDuration: number; // in hours
  
  // Monthly/Yearly breakdown
  monthlyReturns: { [key: string]: number };
  yearlyReturns: { [key: string]: number };
}

export class EnhancedPortfolioSimulator {
  // Core state
  private equityCurve: { date: Date; value: number }[] = [];
  private dailyReturns: number[] = [];
  private openPositions: Map<string, Trade[]> = new Map();
  private closedTrades: Trade[] = [];
  private tradeLog: Trade[] = [];
  private drawdownPeriods: DrawdownPeriod[] = [];
  
  // Configuration
  private initialCapital: number;
  private currentBalance: number;
  private maxBalance: number;
  private commissionRate: number;
  private slippageRate: number;
  private maxPositionsPerSymbol: number;
  private riskFreeRate: number;
  private monteCarloIterations: number;
  private rollingWindowSize: number;
  private riskRewardRatio: number;
  private volatilityMultiplier: number;
  private benchmarkReturns: number[];
  
  // Tracking variables
  private currentDrawdownPeriod: DrawdownPeriod | null = null;
  private lastEquityDate: Date | null = null;
  private positionSizeConfig: PositionSizeConfig = { type: 'fixed', value: 1000 };

  constructor(options: PortfolioSimulatorOptions = {}) {
  const config = loadTradingConfig();
  this.initialCapital = options.initialCapital ?? config.initialCapital ?? 100000;
  this.currentBalance = this.initialCapital;
  this.maxBalance = this.initialCapital;
  this.commissionRate = options.commissionRate ?? config.commissionRate ?? 0.1;
  this.slippageRate = options.slippageRate ?? config.slippageRate ?? 0.05;
  this.maxPositionsPerSymbol = options.maxPositionsPerSymbol ?? config.maxPositionsPerSymbol ?? 1;
  this.riskFreeRate = options.riskFreeRate ?? config.riskFreeRate ?? 0.02;
  this.benchmarkReturns = options.benchmarkReturns ?? [];
  this.monteCarloIterations = config.monteCarloIterations ?? 1000;
  this.rollingWindowSize = config.rollingWindowSize ?? 30;
  this.riskRewardRatio = config.riskRewardRatio ?? 2;
  this.volatilityMultiplier = config.volatilityMultiplier ?? 0.5;
    
    this.equityCurve.push({ date: new Date(), value: this.initialCapital });
  }

  // Position sizing methods
  setPositionSizing(config: PositionSizeConfig): void {
    this.positionSizeConfig = config;
  }

  private calculatePositionSize(
    symbol: string, 
    entryPrice: number, 
    stopLoss?: number
  ): number {
    const { type, value, maxRisk } = this.positionSizeConfig;
    
    switch (type) {
      case 'fixed':
        return value / entryPrice;
      
      case 'percentage':
        return (this.currentBalance * value / 100) / entryPrice;
      
      case 'volatility':
        // Simple volatility-based sizing (would need historical volatility data)
        const baseSize = (this.currentBalance * 0.02) / entryPrice; // 2% of capital
        return baseSize * value; // multiplier
      
      case 'kelly':
        // Simplified Kelly criterion (would need win rate and avg win/loss history)
        const historicalWinRate = this.calculateWinRate();
        const avgWinLoss = this.calculateAvgWinLossRatio();
        if (historicalWinRate > 0 && avgWinLoss > 0) {
          const kelly = (historicalWinRate * avgWinLoss - (1 - historicalWinRate)) / avgWinLoss;
          const kellySize = Math.max(0, Math.min(kelly * value, 0.25)); // Cap at 25%
          return (this.currentBalance * kellySize) / entryPrice;
        }
        return (this.currentBalance * 0.02) / entryPrice; // Fallback to 2%
      
      default:
        return value / entryPrice;
    }
  }

  // Enhanced position management
  openPosition(trade: Omit<Trade, 'quantity'>, stopLoss?: number): boolean {
    const symbol = trade.symbol;
    const existingPositions = this.openPositions.get(symbol) || [];
    
    if (existingPositions.length >= this.maxPositionsPerSymbol) {
      console.warn(`Maximum positions reached for ${symbol}`);
      return false;
    }

    // Calculate position size
    const quantity = this.calculatePositionSize(symbol, trade.entryPrice, stopLoss);
    const totalCost = trade.entryPrice * quantity;
    
    // Apply slippage
    const slippageAdjustedPrice = trade.side === 'BUY' 
      ? trade.entryPrice * (1 + this.slippageRate / 100)
      : trade.entryPrice * (1 - this.slippageRate / 100);
    
    // Calculate commission
    const commission = (totalCost * this.commissionRate) / 100;
    
    if (totalCost + commission > this.currentBalance) {
      console.warn(`Insufficient funds for trade ${trade.id}`);
      return false;
    }

    const enhancedTrade: Trade = {
      ...trade,
      quantity,
      entryPrice: slippageAdjustedPrice,
      commission,
      status: 'OPEN'
    };

    existingPositions.push(enhancedTrade);
    this.openPositions.set(symbol, existingPositions);
    this.tradeLog.push(enhancedTrade);
    this.currentBalance -= commission; // Deduct commission immediately

    return true;
  }

  closePosition(
    symbol: string, 
    exitPrice: number, 
    exitTime: number | Date,
    quantity?: number
  ): boolean {
    const positions = this.openPositions.get(symbol);
    if (!positions || positions.length === 0) return false;

    // Close oldest position (FIFO) or specified quantity
    const trade = positions[0];
    const closeQuantity = quantity || trade.quantity;
    
    if (closeQuantity > trade.quantity) {
      console.warn(`Cannot close more than available quantity`);
      return false;
    }

    // Apply slippage to exit price
    const slippageAdjustedExitPrice = trade.side === 'BUY'
      ? exitPrice * (1 - this.slippageRate / 100)
      : exitPrice * (1 + this.slippageRate / 100);

    // Calculate P&L
    const pnl = trade.side === 'BUY'
      ? (slippageAdjustedExitPrice - trade.entryPrice) * closeQuantity
      : (trade.entryPrice - slippageAdjustedExitPrice) * closeQuantity;

    // Calculate exit commission
    const exitCommission = (slippageAdjustedExitPrice * closeQuantity * this.commissionRate) / 100;
    const netPnl = pnl - exitCommission;

    // Update trade
    const closedTrade: Trade = {
      ...trade,
      exitPrice: slippageAdjustedExitPrice,
      exitTime: exitTime instanceof Date ? exitTime : new Date(exitTime),
      quantity: closeQuantity,
      pnl: netPnl,
      commission: trade.commission + exitCommission,
      status: 'CLOSED'
    };

    this.closedTrades.push(closedTrade);
    this.currentBalance += netPnl;

    // Update position (partial or full close)
    if (closeQuantity === trade.quantity) {
      positions.shift(); // Remove the trade
    } else {
      trade.quantity -= closeQuantity; // Reduce quantity
    }

    if (positions.length === 0) {
      this.openPositions.delete(symbol);
    }

    // Update equity curve and drawdown
    this.updateEquityCurve(exitTime instanceof Date ? exitTime : new Date(exitTime));
    
    return true;
  }

  private updateEquityCurve(date: Date): void {
    const currentValue = this.getCurrentPortfolioValue();
    this.equityCurve.push({ date, value: currentValue });
    
    // Calculate daily return
    if (this.equityCurve.length > 1) {
      const prevValue = this.equityCurve[this.equityCurve.length - 2].value;
      const dailyReturn = (currentValue - prevValue) / prevValue;
      this.dailyReturns.push(dailyReturn);
    }

    // Update max balance and drawdown tracking
    if (currentValue > this.maxBalance) {
      this.maxBalance = currentValue;
      // End current drawdown period if recovering
      if (this.currentDrawdownPeriod && !this.currentDrawdownPeriod.recovered) {
        this.currentDrawdownPeriod.endDate = date;
        this.currentDrawdownPeriod.recovered = true;
        this.currentDrawdownPeriod = null;
      }
    } else {
      // Start or continue drawdown period
      if (!this.currentDrawdownPeriod) {
        this.currentDrawdownPeriod = {
          startDate: date,
          endDate: null,
          startValue: this.maxBalance,
          minValue: currentValue,
          maxDrawdown: (this.maxBalance - currentValue) / this.maxBalance,
          duration: 0,
          recovered: false
        };
        this.drawdownPeriods.push(this.currentDrawdownPeriod);
      } else {
        this.currentDrawdownPeriod.minValue = Math.min(this.currentDrawdownPeriod.minValue, currentValue);
        this.currentDrawdownPeriod.maxDrawdown = (this.currentDrawdownPeriod.startValue - this.currentDrawdownPeriod.minValue) / this.currentDrawdownPeriod.startValue;
        this.currentDrawdownPeriod.duration = Math.floor((date.getTime() - this.currentDrawdownPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    this.lastEquityDate = date;
  }

  private getCurrentPortfolioValue(): number {
    // For simplicity, using current balance + unrealized P&L would require current prices
    // This implementation focuses on closed positions
    return this.currentBalance;
  }

  // Helper methods for calculations
  private calculateWinRate(): number {
    if (this.closedTrades.length === 0) return 0;
    const wins = this.closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
    return wins / this.closedTrades.length;
  }

  private calculateAvgWinLossRatio(): number {
    const wins = this.closedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losses = this.closedTrades.filter(t => (t.pnl ?? 0) < 0);
    
    if (wins.length === 0 || losses.length === 0) return 0;
    
    const avgWin = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losses.length);
    
    return avgWin / avgLoss;
  }

  // Enhanced performance metrics
  getPerformanceMetrics(): PerformanceMetrics {
    const trades = this.closedTrades;
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const totalReturn = (this.currentBalance - this.initialCapital) / this.initialCapital;
    const returns = this.dailyReturns;
    const wins = trades.filter(t => (t.pnl ?? 0) > 0);
    const losses = trades.filter(t => (t.pnl ?? 0) < 0);
    const winRate = wins.length / trades.length;
    
    const avgWin = wins.length ? wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / losses.length : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    // Risk metrics
    const volatility = this.calculateVolatility(returns);
    const annualizedReturn = this.calculateAnnualizedReturn(totalReturn);
    const maxDrawdown = Math.max(...this.drawdownPeriods.map(d => d.maxDrawdown), 0);
    const averageDrawdown = this.drawdownPeriods.length > 0 
      ? this.drawdownPeriods.reduce((sum, d) => sum + d.maxDrawdown, 0) / this.drawdownPeriods.length 
      : 0;
    const maxDrawdownDuration = Math.max(...this.drawdownPeriods.map(d => d.duration), 0);

    const sharpeRatio = this.calculateSharpeRatio(returns, this.riskFreeRate);
    const sortinoRatio = this.calculateSortinoRatio(returns, this.riskFreeRate);
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // VaR calculations
    const var95 = this.calculateVaR(returns, 0.95);
    const cvar95 = this.calculateCVaR(returns, 0.95);

    // Kelly criterion
    const kelly = winRate > 0 && avgLoss !== 0 ? (winRate * Math.abs(avgWin/avgLoss) - (1 - winRate)) / Math.abs(avgWin/avgLoss) : 0;

    // Trade analysis
    const tradeDurations = trades
      .filter(t => t.exitTime && t.entryTime)
      .map(t => {
        const entry = t.entryTime instanceof Date ? t.entryTime : new Date(t.entryTime);
        const exit = t.exitTime instanceof Date ? t.exitTime : new Date(t.exitTime!);
        return (exit.getTime() - entry.getTime()) / (1000 * 60 * 60); // hours
      });
    
    const avgTradeDuration = tradeDurations.length > 0 
      ? tradeDurations.reduce((sum, d) => sum + d, 0) / tradeDurations.length 
      : 0;

    const consecutiveWins = this.calculateMaxConsecutive(trades, true);
    const consecutiveLosses = this.calculateMaxConsecutive(trades, false);
    const largestWin = Math.max(...trades.map(t => t.pnl ?? 0), 0);
    const largestLoss = Math.min(...trades.map(t => t.pnl ?? 0), 0);

    // Time-based returns
    const monthlyReturns = this.calculateMonthlyReturns();
    const yearlyReturns = this.calculateYearlyReturns();

    // Benchmark comparison (if provided)
    let beta, alpha;
    if (this.benchmarkReturns.length > 0) {
      const correlation = this.calculateCorrelation(returns, this.benchmarkReturns);
      const benchmarkVolatility = this.calculateVolatility(this.benchmarkReturns);
      beta = benchmarkVolatility > 0 ? correlation * (volatility / benchmarkVolatility) : 0;
      
      const benchmarkReturn = this.benchmarkReturns.reduce((sum, r) => sum + r, 0);
      alpha = annualizedReturn - (this.riskFreeRate + beta * (benchmarkReturn - this.riskFreeRate));
    }

    return {
      totalReturn,
      annualizedReturn,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      totalTrades: trades.length,
      maxDrawdown,
      averageDrawdown,
      maxDrawdownDuration,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      volatility,
      kelly,
      var95,
      cvar95,
      beta,
      alpha,
      consecutiveWins,
      consecutiveLosses,
      largestWin,
      largestLoss,
      avgTradeDuration,
      monthlyReturns,
      yearlyReturns
    };
  }

  // Statistical calculation methods
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance * 252); // Annualized (assuming 252 trading days)
  }

  private calculateAnnualizedReturn(totalReturn: number): number {
    if (this.equityCurve.length < 2) return 0;
    const firstDate = this.equityCurve[0].date;
    const lastDate = this.equityCurve[this.equityCurve.length - 1].date;
    const years = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length * 252; // Annualized
    const volatility = this.calculateVolatility(returns);
    return volatility > 0 ? (meanReturn - riskFreeRate) / volatility : 0;
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length * 252;
    const downside = returns.filter(r => r < 0);
    if (downside.length === 0) return Infinity;
    
    const downsideDeviation = Math.sqrt(
      downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length * 252
    );
    return downsideDeviation > 0 ? (meanReturn - riskFreeRate) / downsideDeviation : 0;
  }

  private calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    return sorted[index] || 0;
  }

  private calculateCVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;
    const sorted = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor((1 - confidence) * sorted.length);
    const tailReturns = sorted.slice(0, varIndex + 1);
    return tailReturns.length > 0 ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const minLength = Math.min(x.length, y.length);
    if (minLength < 2) return 0;
    
    const xSlice = x.slice(0, minLength);
    const ySlice = y.slice(0, minLength);
    
    const meanX = xSlice.reduce((sum, val) => sum + val, 0) / minLength;
    const meanY = ySlice.reduce((sum, val) => sum + val, 0) / minLength;
    
    let numerator = 0;
    let sumXSq = 0;
    let sumYSq = 0;
    
    for (let i = 0; i < minLength; i++) {
      const xDiff = xSlice[i] - meanX;
      const yDiff = ySlice[i] - meanY;
      numerator += xDiff * yDiff;
      sumXSq += xDiff * xDiff;
      sumYSq += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(sumXSq * sumYSq);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateMaxConsecutive(trades: Trade[], wins: boolean): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    
    for (const trade of trades) {
      const isWin = (trade.pnl ?? 0) > 0;
      if (isWin === wins) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }
    
    return maxConsecutive;
  }

  private calculateMonthlyReturns(): { [key: string]: number } {
    const monthlyReturns: { [key: string]: number } = {};
    
    for (let i = 1; i < this.equityCurve.length; i++) {
      const date = this.equityCurve[i].date;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthReturn = (this.equityCurve[i].value - this.equityCurve[i-1].value) / this.equityCurve[i-1].value;
      
      if (monthlyReturns[key]) {
        monthlyReturns[key] = (1 + monthlyReturns[key]) * (1 + monthReturn) - 1;
      } else {
        monthlyReturns[key] = monthReturn;
      }
    }
    
    return monthlyReturns;
  }

  private calculateYearlyReturns(): { [key: string]: number } {
    const yearlyReturns: { [key: string]: number } = {};
    const monthlyReturns = this.calculateMonthlyReturns();
    
    for (const [month, return_] of Object.entries(monthlyReturns)) {
      const year = month.split('-')[0];
      if (yearlyReturns[year]) {
        yearlyReturns[year] = (1 + yearlyReturns[year]) * (1 + return_) - 1;
      } else {
        yearlyReturns[year] = return_;
      }
    }
    
    return yearlyReturns;
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      totalTrades: 0,
      maxDrawdown: 0,
      averageDrawdown: 0,
      maxDrawdownDuration: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      volatility: 0,
      kelly: 0,
      var95: 0,
      cvar95: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      avgTradeDuration: 0,
      monthlyReturns: {},
      yearlyReturns: {}
    };
  }

  // Export methods
  exportDetailedReport(): string {
    const metrics = this.getPerformanceMetrics();
    let report = "=== ENHANCED PORTFOLIO PERFORMANCE REPORT ===\n\n";
    
    report += "BASIC METRICS:\n";
    report += `Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%\n`;
    report += `Annualized Return: ${(metrics.annualizedReturn * 100).toFixed(2)}%\n`;
    report += `Win Rate: ${(metrics.winRate * 100).toFixed(2)}%\n`;
    report += `Profit Factor: ${metrics.profitFactor.toFixed(2)}\n`;
    report += `Total Trades: ${metrics.totalTrades}\n\n`;
    
    report += "RISK METRICS:\n";
    report += `Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%\n`;
    report += `Volatility: ${(metrics.volatility * 100).toFixed(2)}%\n`;
    report += `Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}\n`;
    report += `Sortino Ratio: ${metrics.sortinoRatio.toFixed(2)}\n`;
    report += `Calmar Ratio: ${metrics.calmarRatio.toFixed(2)}\n`;
    report += `VaR (95%): ${(metrics.var95 * 100).toFixed(2)}%\n`;
    report += `CVaR (95%): ${(metrics.cvar95 * 100).toFixed(2)}%\n\n`;
    
    report += "TRADE ANALYSIS:\n";
    report += `Largest Win: $${metrics.largestWin.toFixed(2)}\n`;
    report += `Largest Loss: $${metrics.largestLoss.toFixed(2)}\n`;
    report += `Max Consecutive Wins: ${metrics.consecutiveWins}\n`;
    report += `Max Consecutive Losses: ${metrics.consecutiveLosses}\n`;
    report += `Avg Trade Duration: ${metrics.avgTradeDuration.toFixed(1)} hours\n\n`;
    
    if (metrics.beta !== undefined && metrics.alpha !== undefined) {
      report += "BENCHMARK COMPARISON:\n";
      report += `Beta: ${metrics.beta.toFixed(2)}\n`;
      report += `Alpha: ${(metrics.alpha * 100).toFixed(2)}%\n\n`;
    }
    
    return report;
  }

  exportTradesToCSV(): string {
    if (this.closedTrades.length === 0) return '';
    
    const header = [
      'id', 'symbol', 'side', 'entryTime', 'exitTime', 'entryPrice', 'exitPrice', 
      'quantity', 'pnl', 'commission', 'status', 'duration_hours', 'return_pct'
    ];
    
    const rows = this.closedTrades.map(t => {
      const entryTime = t.entryTime instanceof Date ? t.entryTime : new Date(t.entryTime);
      const exitTime = t.exitTime instanceof Date ? t.exitTime : new Date(t.exitTime!);
      const durationHours = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
      const returnPct = ((t.pnl ?? 0) / (t.entryPrice * t.quantity)) * 100;
      
      return [
        t.id, t.symbol, t.side, entryTime.toISOString(), exitTime.toISOString(),
        t.entryPrice, t.exitPrice, t.quantity, t.pnl, t.commission, t.status,
        durationHours.toFixed(2), returnPct.toFixed(2)
      ];
    });
    
    return [header, ...rows].map(row => row.join(',')).join('\n');
  }

  exportEquityCurveToCSV(): string {
    if (this.equityCurve.length === 0) return '';
    
    const header = ['date', 'value', 'daily_return', 'drawdown'];
    const rows = this.equityCurve.map((point, i) => {
      const dailyReturn = i > 0 ? ((point.value - this.equityCurve[i-1].value) / this.equityCurve[i-1].value) * 100 : 0;
      const drawdown = ((this.maxBalance - point.value) / this.maxBalance) * 100;
      
      return [
        point.date.toISOString().split('T')[0],
        point.value.toFixed(2),
        dailyReturn.toFixed(4),
        drawdown.toFixed(2)
      ];
    });
    
    return [header, ...rows].map(row => row.join(',')).join('\n');
  }

  // Getter methods
  getEquityCurve(): { date: Date; value: number }[] {
    return [...this.equityCurve];
  }

  getDrawdownPeriods(): DrawdownPeriod[] {
    return [...this.drawdownPeriods];
  }

  getOpenPositions(): Trade[] {
    const allPositions: Trade[] = [];
    for (const positions of this.openPositions.values()) {
      allPositions.push(...positions);
    }
    return allPositions;
  }

  getClosedTrades(): Trade[] {
    return [...this.closedTrades];
  }

  getCurrentBalance(): number {
    return this.currentBalance;
  }

  getMaxDrawdown(): number {
    return Math.max(...this.drawdownPeriods.map(d => d.maxDrawdown), 0);
  }

  getDailyReturns(): number[] {
    return [...this.dailyReturns];
  }

  // Utility methods
  reset(): void {
    this.equityCurve = [{ date: new Date(), value: this.initialCapital }];
    this.dailyReturns = [];
    this.openPositions.clear();
    this.closedTrades = [];
    this.tradeLog = [];
    this.drawdownPeriods = [];
    this.currentBalance = this.initialCapital;
    this.maxBalance = this.initialCapital;
    this.currentDrawdownPeriod = null;
    this.lastEquityDate = null;
  }

  // Backtesting helper methods
  runBacktest(signals: Signal[], priceData: Map<string, { date: Date; price: number }[]>): void {
    // Sort signals by timestamp
    const sortedSignals = signals.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const signal of sortedSignals) {
      const symbolPrices = priceData.get(signal.symbol);
      if (!symbolPrices) continue;

      // Find the price at signal time
      const signalDate = new Date(signal.timestamp);
      const pricePoint = symbolPrices.find(p => 
        Math.abs(p.date.getTime() - signalDate.getTime()) < 60000 // Within 1 minute
      );
      
      if (!pricePoint) continue;

      if (signal.type === 'BUY') {
        this.openPosition({
          id: `${signal.symbol}_${signal.timestamp}`,
          symbol: signal.symbol,
          side: 'BUY',
          entryTime: signalDate,
          entryPrice: pricePoint.price,
          commission: 0,
          status: 'OPEN',
          exitTime: null,
          exitPrice: null,
          pnl: null
        });
      } else if (signal.type === 'SELL') {
        // For sell signals, either close long position or open short
        const hasLongPosition = this.openPositions.get(signal.symbol)?.some(p => p.side === 'BUY');
        if (hasLongPosition) {
          this.closePosition(signal.symbol, pricePoint.price, signalDate);
        } else {
          this.openPosition({
            id: `${signal.symbol}_${signal.timestamp}`,
            symbol: signal.symbol,
            side: 'SELL',
            entryTime: signalDate,
            entryPrice: pricePoint.price,
            commission: 0,
            status: 'OPEN',
            exitTime: null,
            exitPrice: null,
            pnl: null
          });
        }
      }
    }
  }

  // Advanced analysis methods
  getMonteCarloAnalysis(iterations?: number): {
    finalValues: number[];
    percentiles: { [key: number]: number };
    probabilityOfProfit: number;
    worstCase: number;
    bestCase: number;
  } {
  iterations = iterations ?? this.monteCarloIterations;
  if (this.closedTrades.length === 0) {
      return {
        finalValues: [],
        percentiles: {},
        probabilityOfProfit: 0,
        worstCase: this.initialCapital,
        bestCase: this.initialCapital
      };
    }

    // Use real historical returns from production data source
    const returns = this.closedTrades.map(t => (t.pnl ?? 0) / (t.entryPrice * t.quantity));
    const finalValues: number[] = [];

    // TODO: Replace with real scenario simulation using production data
    // For now, use sequential returns for each simulation
    for (let i = 0; i < iterations; i++) {
      let balance = this.initialCapital;
      const numTrades = this.closedTrades.length;
      for (let j = 0; j < numTrades; j++) {
        // Use sequential returns instead of random sampling
        const scenarioReturn = returns[j % returns.length] ?? 0;
  // Use config for position size
  const positionSize = (loadTradingConfig().positionSize ?? 0.1);
  const tradeSize = balance * positionSize;
        const pnl = tradeSize * scenarioReturn;
        balance += pnl;
        if (balance <= 0) break; // Account blown
      }
      finalValues.push(balance);
    }

    const sortedValues = finalValues.sort((a, b) => a - b);
    const percentiles = {
      5: sortedValues[Math.floor(0.05 * iterations)],
      10: sortedValues[Math.floor(0.10 * iterations)],
      25: sortedValues[Math.floor(0.25 * iterations)],
      50: sortedValues[Math.floor(0.50 * iterations)],
      75: sortedValues[Math.floor(0.75 * iterations)],
      90: sortedValues[Math.floor(0.90 * iterations)],
      95: sortedValues[Math.floor(0.95 * iterations)]
    };

    const probabilityOfProfit = finalValues.filter(v => v > this.initialCapital).length / iterations;
    
    return {
      finalValues,
      percentiles,
      probabilityOfProfit,
      worstCase: Math.min(...finalValues),
      bestCase: Math.max(...finalValues)
    };
  }

  getRollingMetrics(windowSize?: number): {
    dates: Date[];
    returns: number[];
    sharpe: number[];
    drawdown: number[];
    winRate: number[];
  } {
    const result = {
      dates: [] as Date[],
      returns: [] as number[],
      sharpe: [] as number[],
      drawdown: [] as number[],
      winRate: [] as number[]
    };

  windowSize = windowSize ?? this.rollingWindowSize;
  if (this.dailyReturns.length < windowSize) return result;

    for (let i = windowSize - 1; i < this.dailyReturns.length; i++) {
      const window = this.dailyReturns.slice(i - windowSize + 1, i + 1);
      const windowDate = this.equityCurve[i + 1]?.date || new Date();
      
      // Rolling return
      const rollingReturn = window.reduce((sum, r) => sum + r, 0);
      
      // Rolling Sharpe
      const meanReturn = window.reduce((sum, r) => sum + r, 0) / window.length;
      const variance = window.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / window.length;
      const volatility = Math.sqrt(variance * 252);
      const rollingSharpe = volatility > 0 ? (meanReturn * 252 - this.riskFreeRate) / volatility : 0;
      
      // Rolling drawdown
      let maxValue = this.equityCurve[i - windowSize + 1]?.value || this.initialCapital;
      let currentDrawdown = 0;
      
      for (let j = i - windowSize + 2; j <= i + 1; j++) {
        const value = this.equityCurve[j]?.value || this.initialCapital;
        maxValue = Math.max(maxValue, value);
        currentDrawdown = Math.max(currentDrawdown, (maxValue - value) / maxValue);
      }
      
      // Rolling win rate (based on trades in window)
      const windowStartDate = this.equityCurve[i - windowSize + 1]?.date || new Date();
      const windowEndDate = this.equityCurve[i + 1]?.date || new Date();
      const windowTrades = this.closedTrades.filter(t => {
        const tradeDate = t.exitTime instanceof Date ? t.exitTime : new Date(t.exitTime!);
        return tradeDate >= windowStartDate && tradeDate <= windowEndDate;
      });
      
      const rollingWinRate = windowTrades.length > 0 
        ? windowTrades.filter(t => (t.pnl ?? 0) > 0).length / windowTrades.length 
        : 0;
      
      result.dates.push(windowDate);
      result.returns.push(rollingReturn);
      result.sharpe.push(rollingSharpe);
      result.drawdown.push(currentDrawdown);
      result.winRate.push(rollingWinRate);
    }

    return result;
  }

  // Risk management methods
  setStopLoss(symbol: string, stopPrice: number): boolean {
    const positions = this.openPositions.get(symbol);
    if (!positions || positions.length === 0) return false;

    // Add stop loss to all positions for the symbol
    positions.forEach(position => {
      (position as any).stopLoss = stopPrice;
    });

    return true;
  }

  setTakeProfit(symbol: string, profitPrice: number): boolean {
    const positions = this.openPositions.get(symbol);
    if (!positions || positions.length === 0) return false;

    positions.forEach(position => {
      (position as any).takeProfit = profitPrice;
    });

    return true;
  }

  checkRiskLimits(currentPrices: Map<string, number>): {
    marginCall: boolean;
    stopLossTriggered: string[];
    takeProfitTriggered: string[];
    positionsAtRisk: Trade[];
  } {
    const result = {
      marginCall: false,
      stopLossTriggered: [] as string[],
      takeProfitTriggered: [] as string[],
      positionsAtRisk: [] as Trade[]
    };

    // Check margin call (if balance falls below 25% of initial capital)
    result.marginCall = this.currentBalance < this.initialCapital * 0.25;

    // Check stop losses and take profits
    for (const [symbol, positions] of this.openPositions.entries()) {
      const currentPrice = currentPrices.get(symbol);
      if (!currentPrice) continue;

      for (const position of positions) {
        const stopLoss = (position as any).stopLoss;
        const takeProfit = (position as any).takeProfit;

        // Check stop loss
        if (stopLoss) {
          const shouldTriggerStopLoss = position.side === 'BUY' 
            ? currentPrice <= stopLoss 
            : currentPrice >= stopLoss;
          
          if (shouldTriggerStopLoss) {
            result.stopLossTriggered.push(symbol);
          }
        }

        // Check take profit
        if (takeProfit) {
          const shouldTriggerTakeProfit = position.side === 'BUY'
            ? currentPrice >= takeProfit
            : currentPrice <= takeProfit;
          
          if (shouldTriggerTakeProfit) {
            result.takeProfitTriggered.push(symbol);
          }
        }

        // Calculate unrealized P&L for risk assessment
        const unrealizedPnl = position.side === 'BUY'
          ? (currentPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - currentPrice) * position.quantity;

        const riskPercentage = Math.abs(unrealizedPnl) / this.initialCapital;
        
        if (riskPercentage > 0.05) { // More than 5% of capital at risk
          result.positionsAtRisk.push(position);
        }
      }
    }

    return result;
  }

  // Portfolio optimization helpers
  getOptimalPositionSize(symbol: string, expectedReturn: number, volatility: number): number {
    // Kelly Criterion for optimal position sizing
    const historicalWinRate = this.calculateWinRate();
    const avgWinLoss = this.calculateAvgWinLossRatio();
    
    if (historicalWinRate === 0 || avgWinLoss === 0) {
      return this.currentBalance * 0.02; // Conservative 2% of capital
    }

    const kelly = (historicalWinRate * avgWinLoss - (1 - historicalWinRate)) / avgWinLoss;
    const adjustedKelly = Math.max(0, Math.min(kelly * 0.5, 0.25)); // Cap at 25%, use half-Kelly
    
    return this.currentBalance * adjustedKelly;
  }

  rebalancePortfolio(targetAllocations: Map<string, number>): boolean {
    // Simple rebalancing based on target allocations
    const totalValue = this.getCurrentPortfolioValue();
    let success = true;

    for (const [symbol, targetWeight] of targetAllocations.entries()) {
      const targetValue = totalValue * targetWeight;
      const currentPositions = this.openPositions.get(symbol) || [];
      const currentValue = currentPositions.reduce((sum, pos) => 
        sum + pos.entryPrice * pos.quantity, 0
      );

      const difference = targetValue - currentValue;
      
      if (Math.abs(difference) > totalValue * 0.01) { // Rebalance if difference > 1%
        // This would require current market prices to execute
        // Implementation would depend on having access to current market data
        console.log(`Rebalancing ${symbol}: target ${targetValue}, current ${currentValue}, difference ${difference}`);
      }
    }

    return success;
  }
}

// Usage example with enhanced features:
/*
const enhancedSim = new EnhancedPortfolioSimulator({
  initialCapital: 100000,
  commissionRate: 0.1, // 0.1%
  slippageRate: 0.05,  // 0.05%
  riskFreeRate: 0.02   // 2% annual
});

// Set position sizing strategy
enhancedSim.setPositionSizing({
  type: 'kelly',
  value: 0.5, // Half-Kelly
  maxRisk: 0.05 // Max 5% risk per trade
});

// Open positions (quantity calculated automatically)
enhancedSim.openPosition({
  id: '1',
  symbol: 'BTCUSDT',
  side: 'BUY',
  entryTime: new Date('2024-01-01'),
  entryPrice: 45000,
  commission: 0,
  status: 'OPEN'
});

// Set risk management
enhancedSim.setStopLoss('BTCUSDT', 42000); // 6.7% stop loss
enhancedSim.setTakeProfit('BTCUSDT', 50000); // 11.1% take profit

// Close position
enhancedSim.closePosition('BTCUSDT', 48000, new Date('2024-01-15'));

// Get comprehensive metrics
const metrics = enhancedSim.getPerformanceMetrics();
console.log(enhancedSim.exportDetailedReport());

// Monte Carlo analysis
const monteCarloResults = enhancedSim.getMonteCarloAnalysis(1000);
console.log(`Probability of profit: ${(monteCarloResults.probabilityOfProfit * 100).toFixed(1)}%`);

// Export data
console.log(enhancedSim.exportTradesToCSV());
console.log(enhancedSim.exportEquityCurveToCSV());
*/