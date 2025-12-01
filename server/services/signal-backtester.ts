/**
 * Signal Backtester Service
 * 
 * Backtests trading signals against historical data to validate profitability
 */

export interface BacktestSignal {
  symbol: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  confidence: number;
  stopLoss: number;
  takeProfit: number;
}

export interface BacktestResult {
  signal: BacktestSignal;
  exitPrice?: number;
  exitTime?: number;
  exitType?: 'TP' | 'SL' | 'TIMEOUT'; // Take Profit, Stop Loss, or Timeout
  roi: number; // Percentage return on investment
  profit: number; // Absolute profit/loss
  correct: boolean; // Did the signal win?
  holdingTime: number; // Seconds held
}

export interface BacktestStats {
  totalSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRate: number; // Percentage
  totalROI: number; // Sum of all ROIs
  averageROI: number; // Average ROI per signal
  averageWinROI: number; // Average ROI of winning signals
  averageLossROI: number; // Average ROI of losing signals
  profitFactor: number; // Gross profit / Gross loss
  largestWin: number;
  largestLoss: number;
  averageHoldingTime: number; // Seconds
  symbol?: string;
  period?: string; // Time period analyzed
}

export class SignalBacktester {
  private results: BacktestResult[] = [];
  private readonly maxResults = 1000;

  /**
   * Backtest a signal against historical OHLCV data
   */
  backtestSignal(
    signal: BacktestSignal,
    historicalData: Array<{
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>,
    timeoutMinutes: number = 60
  ): BacktestResult {
    // Find candles after signal entry
    const signalIndex = historicalData.findIndex(c => c.timestamp >= signal.timestamp);
    if (signalIndex === -1 || signalIndex === historicalData.length - 1) {
      return {
        signal,
        exitType: 'TIMEOUT',
        exitPrice: signal.entryPrice,
        roi: 0,
        profit: 0,
        correct: false,
        holdingTime: 0
      };
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let exitPrice = signal.entryPrice;
    let exitTime = signal.timestamp;
    let exitType: 'TP' | 'SL' | 'TIMEOUT' = 'TIMEOUT';
    let holdingTime = 0;

    // Scan for exit conditions
    for (let i = signalIndex + 1; i < historicalData.length; i++) {
      const candle = historicalData[i];
      holdingTime = (candle.timestamp - signal.timestamp) / 1000;

      // Check timeout
      if (candle.timestamp - signal.timestamp > timeoutMs) {
        exitPrice = candle.close;
        exitTime = candle.timestamp;
        exitType = 'TIMEOUT';
        break;
      }

      // For BUY signals: check for take profit or stop loss
      if (signal.type === 'BUY') {
        if (candle.high >= signal.takeProfit) {
          exitPrice = signal.takeProfit;
          exitTime = candle.timestamp;
          exitType = 'TP';
          break;
        }
        if (candle.low <= signal.stopLoss) {
          exitPrice = signal.stopLoss;
          exitTime = candle.timestamp;
          exitType = 'SL';
          break;
        }
      }
      // For SELL signals: check for take profit or stop loss
      else if (signal.type === 'SELL') {
        if (candle.low <= signal.takeProfit) {
          exitPrice = signal.takeProfit;
          exitTime = candle.timestamp;
          exitType = 'TP';
          break;
        }
        if (candle.high >= signal.stopLoss) {
          exitPrice = signal.stopLoss;
          exitTime = candle.timestamp;
          exitType = 'SL';
          break;
        }
      }
    }

    // Calculate P&L
    const profit = signal.type === 'BUY'
      ? exitPrice - signal.entryPrice
      : signal.entryPrice - exitPrice;

    const roi = (profit / signal.entryPrice) * 100;
    const correct = exitType === 'TP' || (exitType === 'TIMEOUT' && profit > 0);

    const result: BacktestResult = {
      signal,
      exitPrice,
      exitTime,
      exitType,
      roi,
      profit,
      correct,
      holdingTime
    };

    this.recordResult(result);
    return result;
  }

  /**
   * Backtest multiple signals at once
   */
  backtestSignals(
    signals: BacktestSignal[],
    historicalData: Array<{
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  ): BacktestResult[] {
    return signals.map(signal => this.backtestSignal(signal, historicalData));
  }

  /**
   * Record a backtest result
   */
  private recordResult(result: BacktestResult) {
    this.results.push(result);
    
    // Keep only recent results
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }
  }

  /**
   * Get detailed statistics for all backtested signals
   */
  getStats(symbolFilter?: string): BacktestStats {
    const results = symbolFilter
      ? this.results.filter(r => r.signal.symbol === symbolFilter)
      : this.results;

    if (results.length === 0) {
      return {
        totalSignals: 0,
        winningSignals: 0,
        losingSignals: 0,
        winRate: 0,
        totalROI: 0,
        averageROI: 0,
        averageWinROI: 0,
        averageLossROI: 0,
        profitFactor: 0,
        largestWin: 0,
        largestLoss: 0,
        averageHoldingTime: 0
      };
    }

    const winningResults = results.filter(r => r.correct);
    const losingResults = results.filter(r => !r.correct);

    const totalROI = results.reduce((sum, r) => sum + r.roi, 0);
    const grossProfit = winningResults.reduce((sum, r) => sum + Math.max(0, r.roi), 0);
    const grossLoss = Math.abs(losingResults.reduce((sum, r) => sum + Math.min(0, r.roi), 0));

    return {
      totalSignals: results.length,
      winningSignals: winningResults.length,
      losingSignals: losingResults.length,
      winRate: (winningResults.length / results.length) * 100,
      totalROI,
      averageROI: totalROI / results.length,
      averageWinROI: winningResults.length > 0
        ? winningResults.reduce((sum, r) => sum + r.roi, 0) / winningResults.length
        : 0,
      averageLossROI: losingResults.length > 0
        ? losingResults.reduce((sum, r) => sum + r.roi, 0) / losingResults.length
        : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      largestWin: Math.max(...results.map(r => r.roi), 0),
      largestLoss: Math.min(...results.map(r => r.roi), 0),
      averageHoldingTime: results.reduce((sum, r) => sum + r.holdingTime, 0) / results.length,
      symbol: symbolFilter,
      period: 'all-time'
    };
  }

  /**
   * Get backtest history
   */
  getHistory(symbol?: string, limit: number = 100): BacktestResult[] {
    const results = symbol
      ? this.results.filter(r => r.signal.symbol === symbol)
      : this.results;

    return results.slice(-limit);
  }

  /**
   * Clear old results
   */
  pruneOldResults(daysToKeep: number = 30) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    this.results = this.results.filter(r => r.signal.timestamp > cutoffTime);
  }

  /**
   * Export results for analysis
   */
  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const header = 'Symbol,Type,EntryPrice,ExitPrice,ExitType,ROI%,ProfitAbs,Correct,HoldingTime(s)\n';
      const rows = this.results.map(r =>
        `${r.signal.symbol},${r.signal.type},${r.signal.entryPrice.toFixed(2)},${r.exitPrice?.toFixed(2)},${r.exitType},${r.roi.toFixed(2)},${r.profit.toFixed(2)},${r.correct},${r.holdingTime}`
      );
      return header + rows.join('\n');
    }
    return JSON.stringify(this.results, null, 2);
  }
}

// Global singleton
let backtester: SignalBacktester | null = null;

export function getBacktester(): SignalBacktester {
  if (!backtester) {
    backtester = new SignalBacktester();
  }
  return backtester;
}
