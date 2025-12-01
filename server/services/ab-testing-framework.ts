/**
 * A/B Testing Framework
 * Compares flat vs dynamic position sizing in paper trading
 * Statistical significance testing using paired t-test
 */

import { type TradeRecord, type ABTestResult } from '@shared/schema';
import { DynamicPositionSizer } from './dynamic-position-sizer';
import { randomUUID } from 'crypto';

interface SizingResult {
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  trades: { pnl: number; size: number }[];
}

export class ABTestingFramework {
  private dynamicSizer: DynamicPositionSizer;
  private readonly FLAT_POSITION_SIZE = 0.01;
  private readonly ACCOUNT_BALANCE = 100000;

  constructor() {
    this.dynamicSizer = new DynamicPositionSizer();
  }

  runABTest(trades: TradeRecord[]): ABTestResult {
    if (trades.length < 30) {
      throw new Error('Insufficient trades for A/B test (minimum 30 required)');
    }

    const flatResults = this.simulateFlatSizing(trades);
    const dynamicResults = this.simulateDynamicSizing(trades);

    const returnDelta = dynamicResults.totalReturn - flatResults.totalReturn;
    const sharpeDelta = dynamicResults.sharpeRatio - flatResults.sharpeRatio;
    const drawdownReduction = flatResults.maxDrawdown - dynamicResults.maxDrawdown;

    const pValue = this.pairedTTest(flatResults.trades, dynamicResults.trades);
    const isSignificant = pValue < 0.05;

    return {
      testId: randomUUID(),
      startDate: trades[0].entryTime,
      endDate: trades[trades.length - 1].exitTime,
      signalCount: trades.length,
      flatSizing: {
        totalReturn: flatResults.totalReturn,
        sharpeRatio: flatResults.sharpeRatio,
        sortinoRatio: flatResults.sortinoRatio,
        maxDrawdown: flatResults.maxDrawdown,
        winRate: flatResults.winRate
      },
      dynamicSizing: {
        totalReturn: dynamicResults.totalReturn,
        sharpeRatio: dynamicResults.sharpeRatio,
        sortinoRatio: dynamicResults.sortinoRatio,
        maxDrawdown: dynamicResults.maxDrawdown,
        winRate: dynamicResults.winRate
      },
      improvement: {
        returnDelta,
        sharpeDelta,
        drawdownReduction
      },
      pValue,
      isSignificant
    };
  }

  private simulateFlatSizing(trades: TradeRecord[]): SizingResult {
    let equity = this.ACCOUNT_BALANCE;
    let peak = equity;
    let maxDrawdown = 0;
    const returns: number[] = [];
    const results: { pnl: number; size: number }[] = [];
    let wins = 0;

    for (const trade of trades) {
      const positionSize = equity * this.FLAT_POSITION_SIZE;
      const pnl = positionSize * (trade.actualPnlPercent / 100);
      
      equity += pnl;
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      const returnPct = pnl / this.ACCOUNT_BALANCE;
      returns.push(returnPct);
      results.push({ pnl, size: this.FLAT_POSITION_SIZE });
      if (pnl > 0) wins++;
    }

    const totalReturn = (equity - this.ACCOUNT_BALANCE) / this.ACCOUNT_BALANCE;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;
    
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn * Math.sqrt(252)) / downsideDev : sharpeRatio;

    return {
      totalReturn: totalReturn * 100,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: maxDrawdown * 100,
      winRate: (wins / trades.length) * 100,
      trades: results
    };
  }

  private simulateDynamicSizing(trades: TradeRecord[]): SizingResult {
    let equity = this.ACCOUNT_BALANCE;
    let peak = equity;
    let maxDrawdown = 0;
    const returns: number[] = [];
    const results: { pnl: number; size: number }[] = [];
    let wins = 0;

    for (const trade of trades) {
      const sizing = this.dynamicSizer.calculatePositionSize({
        symbol: trade.symbol,
        confidence: trade.confidence,
        signalType: 'BUY',
        accountBalance: equity,
        currentPrice: trade.entryPrice,
        atr: trade.entryPrice * (trade.volatilityRatio * 0.02),
        marketRegime: trade.regime,
        primaryPattern: trade.pattern
      });

      const positionSize = sizing.positionSize;
      const pnl = positionSize * (trade.actualPnlPercent / 100);
      
      equity += pnl;
      if (equity > peak) peak = equity;
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

      const returnPct = pnl / this.ACCOUNT_BALANCE;
      returns.push(returnPct);
      results.push({ pnl, size: sizing.positionPercent });
      if (pnl > 0) wins++;
    }

    const totalReturn = (equity - this.ACCOUNT_BALANCE) / this.ACCOUNT_BALANCE;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;
    
    const downsideReturns = returns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 0
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn * Math.sqrt(252)) / downsideDev : sharpeRatio;

    return {
      totalReturn: totalReturn * 100,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: maxDrawdown * 100,
      winRate: (wins / trades.length) * 100,
      trades: results
    };
  }

  private pairedTTest(
    flatTrades: { pnl: number; size: number }[],
    dynamicTrades: { pnl: number; size: number }[]
  ): number {
    if (flatTrades.length !== dynamicTrades.length) {
      return 1;
    }

    const n = flatTrades.length;
    const differences: number[] = [];
    
    for (let i = 0; i < n; i++) {
      differences.push(dynamicTrades[i].pnl - flatTrades[i].pnl);
    }

    const meanDiff = differences.reduce((a, b) => a + b, 0) / n;
    const stdDiff = Math.sqrt(
      differences.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (n - 1)
    );
    
    if (stdDiff === 0) return meanDiff > 0 ? 0 : 1;

    const tStat = meanDiff / (stdDiff / Math.sqrt(n));
    const df = n - 1;
    
    const pValue = this.tDistributionPValue(Math.abs(tStat), df);
    return pValue * 2;
  }

  private tDistributionPValue(t: number, df: number): number {
    const x = df / (df + t * t);
    return 0.5 * this.incompleteBeta(df / 2, 0.5, x);
  }

  private incompleteBeta(a: number, b: number, x: number): number {
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    let sum = 0;
    const terms = 100;
    
    for (let k = 0; k < terms; k++) {
      const term = (this.binomialCoeff(a + b - 1, k) * Math.pow(x, k) * Math.pow(1 - x, a + b - 1 - k)) / a;
      sum += term;
    }
    
    return Math.min(1, Math.max(0, sum));
  }

  private binomialCoeff(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i) / (i + 1);
    }
    return result;
  }

  runBootstrapTest(trades: TradeRecord[], iterations: number = 1000): {
    meanImprovement: number;
    confidenceInterval: { lower: number; upper: number };
    probabilityBetter: number;
  } {
    const improvements: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const sample = this.bootstrapSample(trades);
      const flat = this.simulateFlatSizing(sample);
      const dynamic = this.simulateDynamicSizing(sample);
      improvements.push(dynamic.totalReturn - flat.totalReturn);
    }

    improvements.sort((a, b) => a - b);
    const lowerIdx = Math.floor(iterations * 0.025);
    const upperIdx = Math.floor(iterations * 0.975);

    return {
      meanImprovement: improvements.reduce((a, b) => a + b, 0) / iterations,
      confidenceInterval: {
        lower: improvements[lowerIdx],
        upper: improvements[upperIdx]
      },
      probabilityBetter: improvements.filter(i => i > 0).length / iterations
    };
  }

  private bootstrapSample(trades: TradeRecord[]): TradeRecord[] {
    const sample: TradeRecord[] = [];
    for (let i = 0; i < trades.length; i++) {
      const idx = Math.floor(Math.random() * trades.length);
      sample.push(trades[idx]);
    }
    return sample;
  }
}

export const abTestingFramework = new ABTestingFramework();
