/**
 * LSTM Backtest Engine
 * 
 * Evaluates LSTM predictions against historical OHLCV data.
 * Supports:
 * - LONG/SHORT direction testing
 * - Multi-timeframe backtesting
 * - Multi-exchange comparison
 * - Profit target and stop loss tracking
 * - Win rate, Sharpe ratio, drawdown calculation
 */

import { storage } from '../storage';
import { BacktestPrediction } from './multi-timeframe-ml-service';

export interface BacktestConfig {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  startDate: Date;
  endDate: Date;
  targetProfitPercent?: number; // Default 2%
  stopLossPercent?: number; // Default 1%
  commissionPercent?: number; // Default 0.1%
}

export interface BacktestResult {
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  totalCandles: number;
  
  // LONG results
  longTrades: number;
  longWins: number;
  longWinRate: number;
  longAvgProfit: number;
  longMaxDD: number;
  
  // SHORT results
  shortTrades: number;
  shortWins: number;
  shortWinRate: number;
  shortAvgProfit: number;
  shortMaxDD: number;
  
  // Combined results
  totalTrades: number;
  totalWins: number;
  totalWinRate: number;
  totalAvgProfit: number;
  totalSharpeRatio: number;
  totalMaxDD: number;
  
  // Quality metrics
  profitFactor: number; // Gross profit / gross loss
  recoveryFactor: number; // Net profit / max drawdown
  expectancy: number; // Average profit per trade (with commission)
  
  trades: BacktestPrediction[];
}

export interface MultiExchangeBacktestResult {
  symbol: string;
  timeframe: string;
  exchanges: {
    [exchange: string]: BacktestResult;
  };
  consensus: {
    bestExchange: string;
    avgWinRate: number;
    avgSharpe: number;
  };
}

/**
 * LSTM Backtest Engine
 */
export class LSTMBacktestEngine {
  /**
   * Backtest LSTM predictions for a symbol/timeframe combination
   */
  async backtest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      console.log(
        `[Backtest] Starting backtest for ${config.symbol} on ${config.timeframe} from ${config.startDate.toISOString().split('T')[0]} to ${config.endDate.toISOString().split('T')[0]}`
      );

      // Fetch historical data
      const lookbackDays = Math.ceil((config.endDate.getTime() - config.startDate.getTime()) / (24 * 60 * 60 * 1000)) + 30;
      const frames = await storage.getMarketFrames(config.symbol, lookbackDays);

      if (!frames || frames.length < 100) {
        throw new Error(`Insufficient historical data: ${frames?.length || 0} candles`);
      }

      // Filter to date range
      const startTs = config.startDate.getTime();
      const endTs = config.endDate.getTime();
      const filteredFrames = frames.filter(f => {
        const frameTs = typeof f.timestamp === 'number' ? f.timestamp : new Date(f.timestamp || 0).getTime();
        return frameTs >= startTs && frameTs <= endTs;
      });

      if (filteredFrames.length < 10) {
        throw new Error(`No data in date range. Found ${filteredFrames.length} candles`);
      }

      // Run backtest
      const targetProfit = config.targetProfitPercent || 2.0;
      const stopLoss = config.stopLossPercent || 1.0;
      const commission = config.commissionPercent || 0.1;

      const trades = await this.simulateTrades(
        filteredFrames,
        config.symbol,
        config.timeframe,
        targetProfit,
        stopLoss,
        commission
      );

      // Calculate statistics
      const results = this.calculateStatistics(trades, config, filteredFrames.length);

      console.log(`[Backtest] Completed: ${results.totalTrades} trades, ${(results.totalWinRate * 100).toFixed(1)}% win rate`);

      return results;
    } catch (error) {
      console.error(`[Backtest] Error backtesting ${config.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Simulate trades from historical data
   */
  private async simulateTrades(
    frames: any[],
    symbol: string,
    timeframe: string,
    targetProfitPercent: number,
    stopLossPercent: number,
    commissionPercent: number
  ): Promise<BacktestPrediction[]> {
    const trades: BacktestPrediction[] = [];

    // Simplified: assume alternating LONG/SHORT for demonstration
    // In production, would load actual LSTM predictions for this period
    for (let i = 100; i < frames.length - 10; i += 5) {
      const frame = frames[i];
      const entryPrice = typeof frame.price === 'object' ? frame.price.close : frame.price;
      const frameTs = typeof frame.timestamp === 'number' ? frame.timestamp : new Date(frame.time || 0).getTime();

      // Alternate direction
      const direction = i % 10 === 0 ? 'BULLISH' : 'BEARISH';

      // Calculate target and stop
      const targetPrice = direction === 'BULLISH'
        ? entryPrice * (1 + targetProfitPercent / 100)
        : entryPrice * (1 - targetProfitPercent / 100);

      const stopPrice = direction === 'BULLISH'
        ? entryPrice * (1 - stopLossPercent / 100)
        : entryPrice * (1 + stopLossPercent / 100);

      // Simulate: find result in next 10 candles
      let result: 'WIN' | 'LOSS' | 'BREAKEVEN' | undefined;
      let priceAtCompletion = entryPrice;
      let holdCandles = 0;

      for (let j = i + 1; j < Math.min(i + 11, frames.length); j++) {
        const checkFrame = frames[j];
        const checkPrice = typeof checkFrame.price === 'object' ? checkFrame.price.close : checkFrame.price;

        holdCandles++;

        if (direction === 'BULLISH') {
          if (checkPrice >= targetPrice) {
            result = 'WIN';
            priceAtCompletion = targetPrice;
            break;
          } else if (checkPrice <= stopPrice) {
            result = 'LOSS';
            priceAtCompletion = stopPrice;
            break;
          }
        } else {
          if (checkPrice <= targetPrice) {
            result = 'WIN';
            priceAtCompletion = targetPrice;
            break;
          } else if (checkPrice >= stopPrice) {
            result = 'LOSS';
            priceAtCompletion = stopPrice;
            break;
          }
        }
      }

      if (result) {
        let profitPercent = 0;
        if (result === 'WIN') {
          profitPercent =
            direction === 'BULLISH'
              ? ((targetPrice - entryPrice) / entryPrice - commissionPercent / 100) * 100
              : ((entryPrice - targetPrice) / entryPrice - commissionPercent / 100) * 100;
        } else if (result === 'LOSS') {
          profitPercent =
            direction === 'BULLISH'
              ? ((stopPrice - entryPrice) / entryPrice - commissionPercent / 100) * 100
              : ((entryPrice - stopPrice) / entryPrice - commissionPercent / 100) * 100;
        }

        trades.push({
          symbol,
          timestamp: frameTs,
          timeframe,
          direction: direction as 'BULLISH' | 'BEARISH',
          confidence: 0.65, // Placeholder
          entryPrice,
          targetPrice,
          stopLossPrice: stopPrice,
          priceAtCompletion,
          result,
          profitPercent,
          holdCandles,
        });
      }
    }

    return trades;
  }

  /**
   * Calculate backtest statistics
   */
  private calculateStatistics(
    trades: BacktestPrediction[],
    config: BacktestConfig,
    totalCandles: number
  ): BacktestResult {
    const longTrades = trades.filter(t => t.direction === 'BULLISH');
    const shortTrades = trades.filter(t => t.direction === 'BEARISH');

    const result: BacktestResult = {
      symbol: config.symbol,
      timeframe: config.timeframe,
      startDate: config.startDate,
      endDate: config.endDate,
      totalCandles,

      // LONG stats
      longTrades: longTrades.length,
      longWins: longTrades.filter(t => t.result === 'WIN').length,
      longWinRate: longTrades.length > 0 ? longTrades.filter(t => t.result === 'WIN').length / longTrades.length : 0,
      longAvgProfit: longTrades.length > 0 ? longTrades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) / longTrades.length : 0,
      longMaxDD: this.calculateMaxDrawdown(longTrades),

      // SHORT stats
      shortTrades: shortTrades.length,
      shortWins: shortTrades.filter(t => t.result === 'WIN').length,
      shortWinRate: shortTrades.length > 0 ? shortTrades.filter(t => t.result === 'WIN').length / shortTrades.length : 0,
      shortAvgProfit: shortTrades.length > 0 ? shortTrades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) / shortTrades.length : 0,
      shortMaxDD: this.calculateMaxDrawdown(shortTrades),

      // Combined stats
      totalTrades: trades.length,
      totalWins: trades.filter(t => t.result === 'WIN').length,
      totalWinRate: trades.length > 0 ? trades.filter(t => t.result === 'WIN').length / trades.length : 0,
      totalAvgProfit: trades.length > 0 ? trades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) / trades.length : 0,
      totalSharpeRatio: this.calculateSharpe(trades),
      totalMaxDD: this.calculateMaxDrawdown(trades),

      // Quality metrics
      profitFactor: this.calculateProfitFactor(trades),
      recoveryFactor: this.calculateRecoveryFactor(trades),
      expectancy: this.calculateExpectancy(trades),

      trades,
    };

    return result;
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: BacktestPrediction[]): number {
    if (trades.length === 0) return 0;

    let peak = 0;
    let maxDD = 0;
    let cumProfit = 0;

    for (const trade of trades) {
      cumProfit += trade.profitPercent || 0;
      peak = Math.max(peak, cumProfit);
      maxDD = Math.min(maxDD, cumProfit - peak);
    }

    return maxDD;
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpe(trades: BacktestPrediction[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map(t => t.profitPercent || 0);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (assuming daily returns)
    const sharpe = (meanReturn / stdDev) * Math.sqrt(252);
    return isFinite(sharpe) ? sharpe : 0;
  }

  /**
   * Calculate profit factor
   */
  private calculateProfitFactor(trades: BacktestPrediction[]): number {
    const wins = trades.filter(t => t.result === 'WIN').reduce((sum, t) => sum + (t.profitPercent || 0), 0);
    const losses = Math.abs(trades.filter(t => t.result === 'LOSS').reduce((sum, t) => sum + (t.profitPercent || 0), 0));

    return losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;
  }

  /**
   * Calculate recovery factor
   */
  private calculateRecoveryFactor(trades: BacktestPrediction[]): number {
    const netProfit = trades.reduce((sum, t) => sum + (t.profitPercent || 0), 0);
    const maxDD = Math.abs(this.calculateMaxDrawdown(trades));

    return maxDD > 0 ? netProfit / maxDD : 0;
  }

  /**
   * Calculate expectancy
   */
  private calculateExpectancy(trades: BacktestPrediction[]): number {
    if (trades.length === 0) return 0;

    const avgProfit = trades.reduce((sum, t) => sum + (t.profitPercent || 0), 0) / trades.length;
    return avgProfit; // Simplified, would apply commission
  }

  /**
   * Backtest across multiple exchanges
   */
  async backtestMultiExchange(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    exchanges: string[]
  ): Promise<MultiExchangeBacktestResult> {
    const result: MultiExchangeBacktestResult = {
      symbol,
      timeframe,
      exchanges: {},
      consensus: {
        bestExchange: '',
        avgWinRate: 0,
        avgSharpe: 0,
      },
    };

    const backtestResults = await Promise.all(
      exchanges.map(exchange =>
        this.backtest({
          symbol: `${symbol}:${exchange}`, // Include exchange in symbol for routing
          timeframe: timeframe as any,
          startDate,
          endDate,
        })
      )
    );

    backtestResults.forEach((res, idx) => {
      result.exchanges[exchanges[idx]] = res;
    });

    // Calculate consensus
    const winRates = Object.values(result.exchanges).map(r => r.totalWinRate);
    const sharpes = Object.values(result.exchanges).map(r => r.totalSharpeRatio);

    result.consensus.avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    result.consensus.avgSharpe = sharpes.reduce((a, b) => a + b, 0) / sharpes.length;

    const best = Object.entries(result.exchanges).reduce((a, b) =>
      b[1].totalWinRate > a[1].totalWinRate ? b : a
    );
    result.consensus.bestExchange = best[0];

    return result;
  }
}

export const lstmBacktestEngine = new LSTMBacktestEngine();
