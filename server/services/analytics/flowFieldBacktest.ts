/**
 * Flow Field Backtesting Framework
 * 
 * Validates flow field signals against historical data
 * Measures predictive power and profitability
 */

import { computeFlowField, type FlowFieldPoint, type FlowFieldResult } from './flowFieldEngine';
import { generateFlowSignals, detectFlowReversals } from './flowFieldIntegration';

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  initialCapital: number;
  positionSize: number; // Percentage of capital per trade (0-1)
  stopLossPercent: number; // Stop loss as percentage (e.g., 0.02 = 2%)
  takeProfitPercent: number; // Take profit as percentage
  commission: number; // Commission per trade as percentage
  slippage: number; // Slippage as percentage
  minConfidence: number; // Minimum confidence to enter trade (0-100)
}

/**
 * Trade record
 */
export interface Trade {
  symbol: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  direction: 'long' | 'short';
  size: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  exitReason: 'stop_loss' | 'take_profit' | 'signal_exit' | 'timeout';
  flowField: Partial<FlowFieldResult>;
}

/**
 * Backtest results
 */
export interface BacktestResults {
  // Performance metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // P&L metrics
  totalPnL: number;
  totalPnLPercent: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  
  // Risk metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Flow field specific
  flowAccuracy: number; // How often flow signal matched price movement
  reversalAccuracy: number; // How often reversal signals were correct
  avgForceOnWin: number;
  avgForceOnLoss: number;
  avgTurbulenceOnWin: number;
  avgTurbulenceOnLoss: number;
  
  // Detailed data
  trades: Trade[];
  equityCurve: Array<{ timestamp: number; equity: number }>;
  drawdownCurve: Array<{ timestamp: number; drawdown: number }>;
}

/**
 * Run backtest on historical data
 */
export function runFlowFieldBacktest(
  historicalData: FlowFieldPoint[],
  config: BacktestConfig
): BacktestResults {
  const trades: Trade[] = [];
  const equityCurve: Array<{ timestamp: number; equity: number }> = [];
  const drawdownCurve: Array<{ timestamp: number; drawdown: number }> = [];
  
  let capital = config.initialCapital;
  let peakCapital = config.initialCapital;
  let currentPosition: Trade | null = null;
  
  // Window size for flow field calculation (e.g., last 50 data points)
  const windowSize = 50;
  
  // Iterate through historical data
  for (let i = windowSize; i < historicalData.length; i++) {
    const currentTime = historicalData[i].timestamp;
    const currentPrice = historicalData[i].price;
    
    // Get window of data for flow field calculation
    const window = historicalData.slice(i - windowSize, i);
    
    // Compute flow field
    const flowField = computeFlowField(window);
    
    // Generate signals
    const flowSignal = generateFlowSignals(flowField);
    const reversal = detectFlowReversals(flowField, window);
    
    // Check if we have an open position
    if (currentPosition) {
      // Check stop loss
      if (currentPosition.direction === 'long') {
        const loss = (currentPrice - currentPosition.entryPrice) / currentPosition.entryPrice;
        if (loss <= -config.stopLossPercent) {
          // Stop loss hit
          closePosition(currentPosition, currentPrice, currentTime, 'stop_loss', flowField);
          currentPosition = null;
          continue;
        }
        
        // Check take profit
        const profit = (currentPrice - currentPosition.entryPrice) / currentPosition.entryPrice;
        if (profit >= config.takeProfitPercent) {
          closePosition(currentPosition, currentPrice, currentTime, 'take_profit', flowField);
          currentPosition = null;
          continue;
        }
      } else { // short
        const loss = (currentPosition.entryPrice - currentPrice) / currentPosition.entryPrice;
        if (loss <= -config.stopLossPercent) {
          closePosition(currentPosition, currentPrice, currentTime, 'stop_loss', flowField);
          currentPosition = null;
          continue;
        }
        
        const profit = (currentPosition.entryPrice - currentPrice) / currentPosition.entryPrice;
        if (profit >= config.takeProfitPercent) {
          closePosition(currentPosition, currentPrice, currentTime, 'take_profit', flowField);
          currentPosition = null;
          continue;
        }
      }
      
      // Check for exit signal
      if (
        (currentPosition.direction === 'long' && (flowSignal.signal === 'SELL' || flowSignal.signal === 'STRONG_SELL')) ||
        (currentPosition.direction === 'short' && (flowSignal.signal === 'BUY' || flowSignal.signal === 'STRONG_BUY'))
      ) {
        closePosition(currentPosition, currentPrice, currentTime, 'signal_exit', flowField);
        currentPosition = null;
      }
    } else {
      // No position - look for entry signals
      if (flowSignal.confidence >= config.minConfidence) {
        if (flowSignal.signal === 'STRONG_BUY' || flowSignal.signal === 'BUY') {
          // Enter long position
          currentPosition = openPosition('long', currentPrice, currentTime, flowField);
        } else if (flowSignal.signal === 'STRONG_SELL' || flowSignal.signal === 'SELL') {
          // Enter short position
          currentPosition = openPosition('short', currentPrice, currentTime, flowField);
        }
      }
    }
    
    // Record equity curve
    let currentEquity = capital;
    if (currentPosition) {
      const unrealizedPnL = calculateUnrealizedPnL(currentPosition, currentPrice);
      currentEquity = capital + unrealizedPnL;
    }
    
    equityCurve.push({
      timestamp: currentTime,
      equity: currentEquity
    });
    
    // Update peak and drawdown
    if (currentEquity > peakCapital) {
      peakCapital = currentEquity;
    }
    
    const drawdown = (peakCapital - currentEquity) / peakCapital;
    drawdownCurve.push({
      timestamp: currentTime,
      drawdown
    });
  }
  
  // Close any remaining position
  if (currentPosition && historicalData.length > 0) {
    const lastPoint = historicalData[historicalData.length - 1];
    const lastWindow = historicalData.slice(-windowSize);
    const finalFlowField = computeFlowField(lastWindow);
    closePosition(currentPosition, lastPoint.price, lastPoint.timestamp, 'timeout', finalFlowField);
  }
  
  // Helper functions
  function openPosition(
    direction: 'long' | 'short',
    price: number,
    time: number,
    flowField: FlowFieldResult
  ): Trade {
    const positionValue = capital * config.positionSize;
    const commissionCost = positionValue * config.commission;
    const size = (positionValue - commissionCost) / price;
    
    return {
      symbol: 'BACKTEST',
      entryTime: time,
      exitTime: 0,
      entryPrice: price * (1 + (direction === 'long' ? config.slippage : -config.slippage)),
      exitPrice: 0,
      direction,
      size,
      pnl: 0,
      pnlPercent: 0,
      commission: commissionCost,
      exitReason: 'timeout',
      flowField: {
        latestForce: flowField.latestForce,
        turbulence: flowField.turbulence,
        turbulenceLevel: flowField.turbulenceLevel,
        pressure: flowField.pressure,
        energyTrend: flowField.energyTrend
      }
    };
  }
  
  function closePosition(
    position: Trade,
    price: number,
    time: number,
    reason: Trade['exitReason'],
    flowField: FlowFieldResult
  ): void {
    position.exitTime = time;
    position.exitPrice = price * (1 + (position.direction === 'long' ? -config.slippage : config.slippage));
    position.exitReason = reason;
    
    // Calculate P&L
    if (position.direction === 'long') {
      position.pnl = (position.exitPrice - position.entryPrice) * position.size - position.commission;
    } else {
      position.pnl = (position.entryPrice - position.exitPrice) * position.size - position.commission;
    }
    
    position.pnlPercent = position.pnl / (position.entryPrice * position.size);
    
    // Update capital
    capital += position.pnl;
    
    trades.push(position);
  }
  
  function calculateUnrealizedPnL(position: Trade, currentPrice: number): number {
    if (position.direction === 'long') {
      return (currentPrice - position.entryPrice) * position.size;
    } else {
      return (position.entryPrice - currentPrice) * position.size;
    }
  }
  
  // Calculate results
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalPnLPercent = (totalPnL / config.initialCapital) * 100;
  
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
    : 0;
  
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
    : 0;
  
  const largestWin = winningTrades.length > 0
    ? Math.max(...winningTrades.map(t => t.pnl))
    : 0;
  
  const largestLoss = losingTrades.length > 0
    ? Math.min(...losingTrades.map(t => t.pnl))
    : 0;
  
  const grossWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
  
  const maxDrawdown = Math.max(...drawdownCurve.map(d => d.drawdown));
  const maxDrawdownPercent = maxDrawdown * 100;
  
  // Sharpe ratio (simplified - using returns)
  const returns = equityCurve.map((e, i) => 
    i > 0 ? (e.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity : 0
  ).filter((r, i) => i > 0);
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0; // Annualized
  
  // Sortino ratio (only downside deviation)
  const downsideReturns = returns.filter(r => r < 0);
  const downsideStd = downsideReturns.length > 0
    ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length)
    : 0;
  const sortinoRatio = downsideStd > 0 ? (avgReturn / downsideStd) * Math.sqrt(252) : 0;
  
  // Calmar ratio
  const annualizedReturn = (Math.pow(capital / config.initialCapital, 365 / ((historicalData[historicalData.length - 1].timestamp - historicalData[0].timestamp) / (1000 * 60 * 60 * 24))) - 1);
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  
  // Flow field specific metrics
  const avgForceOnWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.flowField.latestForce || 0), 0) / winningTrades.length
    : 0;
  
  const avgForceOnLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + (t.flowField.latestForce || 0), 0) / losingTrades.length
    : 0;
  
  const avgTurbulenceOnWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.flowField.turbulence || 0), 0) / winningTrades.length
    : 0;
  
  const avgTurbulenceOnLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + (t.flowField.turbulence || 0), 0) / losingTrades.length
    : 0;
  
  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    
    totalPnL,
    totalPnLPercent,
    averageWin: avgWin,
    averageLoss: avgLoss,
    largestWin,
    largestLoss,
    profitFactor,
    
    maxDrawdown,
    maxDrawdownPercent,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    
    flowAccuracy: 0, // TODO: Calculate based on signal vs actual movement
    reversalAccuracy: 0, // TODO: Calculate based on reversal detection
    avgForceOnWin,
    avgForceOnLoss,
    avgTurbulenceOnWin,
    avgTurbulenceOnLoss,
    
    trades,
    equityCurve,
    drawdownCurve
  };
}

/**
 * Export backtest results to JSON
 */
export function exportBacktestResults(results: BacktestResults): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Generate backtest report summary
 */
export function generateBacktestReport(results: BacktestResults): string {
  return `
╔════════════════════════════════════════════════════════╗
║         FLOW FIELD BACKTEST RESULTS                    ║
╚════════════════════════════════════════════════════════╝

PERFORMANCE METRICS
───────────────────
Total Trades:        ${results.totalTrades}
Winning Trades:      ${results.winningTrades} (${results.winRate.toFixed(2)}%)
Losing Trades:       ${results.losingTrades}

P&L METRICS
───────────
Total P&L:           $${results.totalPnL.toFixed(2)} (${results.totalPnLPercent.toFixed(2)}%)
Average Win:         $${results.averageWin.toFixed(2)}
Average Loss:        $${results.averageLoss.toFixed(2)}
Largest Win:         $${results.largestWin.toFixed(2)}
Largest Loss:        $${results.largestLoss.toFixed(2)}
Profit Factor:       ${results.profitFactor.toFixed(2)}

RISK METRICS
────────────
Max Drawdown:        ${results.maxDrawdownPercent.toFixed(2)}%
Sharpe Ratio:        ${results.sharpeRatio.toFixed(2)}
Sortino Ratio:       ${results.sortinoRatio.toFixed(2)}
Calmar Ratio:        ${results.calmarRatio.toFixed(2)}

FLOW FIELD INSIGHTS
───────────────────
Avg Force (Wins):    ${(results.avgForceOnWin * 100).toFixed(3)}
Avg Force (Losses):  ${(results.avgForceOnLoss * 100).toFixed(3)}
Avg Turbulence (W):  ${(results.avgTurbulenceOnWin * 10000).toFixed(3)}
Avg Turbulence (L):  ${(results.avgTurbulenceOnLoss * 10000).toFixed(3)}

KEY INSIGHTS
────────────
${results.avgForceOnWin > results.avgForceOnLoss ? '✓ Winning trades have stronger force (good!)' : '✗ Losing trades have stronger force (review entry criteria)'}
${results.avgTurbulenceOnLoss > results.avgTurbulenceOnWin ? '✓ Losing trades have higher turbulence (good filtering!)' : '✗ Winning trades have higher turbulence (unexpected)'}
${results.profitFactor > 1.5 ? '✓ Strong profit factor' : results.profitFactor > 1 ? '○ Acceptable profit factor' : '✗ Weak profit factor - needs improvement'}
${results.sharpeRatio > 1 ? '✓ Good risk-adjusted returns' : '✗ Poor risk-adjusted returns'}
`;
}

