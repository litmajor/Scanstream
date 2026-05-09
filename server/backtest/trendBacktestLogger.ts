/**
 * Trend + Convexity Backtest Logger
 * 
 * Comprehensive logging for trend signal analysis:
 * - Per-trade trend metrics (AS, RA, DV, PS)
 * - Entry/exit reasons with trend context
 * - Signal quality statistics
 * - Visualization data export
 * 
 * Date: January 6, 2026
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ConvexTrade, VFMDScoutTrade } from '../backtest/convexity-backtester-with-for';
import type { TrendSignalState } from './trendConvexityEngine';

export interface TrendBacktestLog {
  metadata: {
    symbol: string;
    startDate: string;
    endDate: string;
    totalBars: number;
    backtestParams: any;
  };
  trades: TrendTradeLog[];
  summary: TrendLogSummary;
  signalQuality: SignalQualityMetrics;
}

export interface TrendTradeLog {
  tradeIndex: number;
  entryBar: number;
  entryTimestamp: string;
  entryPrice: number;
  direction: 'BUY' | 'SELL';
  
  // Trend signal at entry
  trendSignal: {
    acceptanceScore: number;
    signalType: string;
    responseAlignment: number;
    displacementValidation: number;
    persistenceScore: number;
    rejectionFlag: boolean;
    rejectionReason?: string;
    confidence: number;
  };
  
  // Scout context
  scoutInfo: {
    scoutEntryBar: number;
    scoutTarget: number;
    scoutStop: number;
    scoutPnL: number;
    scoutPnLPct: number;
    scoutExitReason: string;
  };
  
  // Convexity execution
  exitBar: number;
  exitTimestamp: string;
  exitPrice: number;
  exitReason: string;
  
  // Results
  pnl: number;
  pnlPct: number;
  holdingBars: number;
  
  // Analysis
  winTrade: boolean;
  asToWinCorrelation: number;  // Did higher AS = better results?
  psToHoldCorrelation: number; // Did higher PS = longer hold?
}

export interface TrendLogSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // By trend signal type
  bySignalType: {
    [signalType: string]: {
      count: number;
      winRate: number;
      avgPnL: number;
      avgPnLPct: number;
      avgAS: number;
      avgPS: number;
    };
  };
  
  // By acceptance score bins
  byAcceptanceScoreBin: {
    [binName: string]: {
      count: number;
      winRate: number;
      avgPnL: number;
      avgPnLPct: number;
    };
  };
  
  // Overall metrics
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
}

export interface SignalQualityMetrics {
  // How often did trends actually hold (persistence)?
  trendPersistenceStats: {
    avgPersistenceScore: number;
    psToWinRateCorrelation: number;
    psToAvgPnLCorrelation: number;
  };
  
  // How accurate was acceptance detection?
  acceptanceDetectionStats: {
    avgAcceptanceScore: number;
    asToWinRateCorrelation: number;
    asToAvgPnLCorrelation: number;
    rejectionAccuracy: number;  // % of rejected signals that would have lost
  };
  
  // Rejection flag effectiveness
  rejectionStats: {
    totalRejections: number;
    rejectionsByReason: {
      [reason: string]: number;
    };
    rejectionAccuracy: number;  // % that would have been losers if traded
  };
  
  // Signal timing
  timingStats: {
    avgBarsToTarget: number;
    avgBarsToStop: number;
    earlyTrendWinRate: number;
    acceptedTrendWinRate: number;
    strongTrendWinRate: number;
  };
}

export class TrendBacktestLogger {
  private logs: TrendTradeLog[] = [];
  private signalBuffer: Map<number, TrendSignalState> = new Map(); // barIndex -> TrendState

  /**
   * Record a completed convex trade with trend metrics
   */
  recordTrade(
    tradeIndex: number,
    convexTrade: ConvexTrade,
    scoutTrade: VFMDScoutTrade | undefined,
    entryTimestamp: string,
    exitTimestamp: string
  ): void {
    const tradeLog: TrendTradeLog = {
      tradeIndex,
      entryBar: convexTrade.entryBar,
      entryTimestamp,
      entryPrice: convexTrade.entryPrice,
      direction: convexTrade.direction,
      
      trendSignal: {
        acceptanceScore: convexTrade.acceptanceScore || 0,
        signalType: convexTrade.trendSignalType || 'UNKNOWN',
        responseAlignment: convexTrade.trendSignal?.responseAlignment || 0,
        displacementValidation: convexTrade.trendSignal?.displacementValidation || 0,
        persistenceScore: convexTrade.persistenceScore || 0,
        rejectionFlag: convexTrade.rejectionFlag || false,
        rejectionReason: convexTrade.trendSignal?.rejectionReason,
        confidence: convexTrade.trendSignal?.confidence || 0,
      },
      
      scoutInfo: scoutTrade ? {
        scoutEntryBar: scoutTrade.entryBar,
        scoutTarget: scoutTrade.target,
        scoutStop: scoutTrade.stop,
        scoutPnL: scoutTrade.pnl || 0,
        scoutPnLPct: scoutTrade.pnlPct || 0,
        scoutExitReason: scoutTrade.exitReason || 'UNKNOWN',
      } : {
        scoutEntryBar: 0,
        scoutTarget: 0,
        scoutStop: 0,
        scoutPnL: 0,
        scoutPnLPct: 0,
        scoutExitReason: 'NO_SCOUT',
      },
      
      exitBar: convexTrade.exitBar,
      exitTimestamp,
      exitPrice: convexTrade.exitPrice,
      exitReason: 'CLOSED',  // Could be enhanced with actual exit reason
      
      pnl: convexTrade.pnl,
      pnlPct: convexTrade.pnlPct,
      holdingBars: convexTrade.exitBar - convexTrade.entryBar,
      
      winTrade: convexTrade.pnlPct > 0,
      asToWinCorrelation: 0,  // Calculated in summary
      psToHoldCorrelation: 0,  // Calculated in summary
    };
    
    this.logs.push(tradeLog);
  }

  /**
   * Store trend signal for later analysis
   */
  recordTrendSignal(barIndex: number, signal: TrendSignalState): void {
    this.signalBuffer.set(barIndex, signal);
  }

  /**
   * Generate comprehensive summary and analysis
   */
  generateSummary(symbol: string, backtestParams: any): TrendBacktestLog {
    const metadata = {
      symbol,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      totalBars: 0,  // Would come from backtester
      backtestParams,
    };

    // Calculate correlations
    this.calculateCorrelations();

    // Group by signal type
    const bySignalType = this.groupBySignalType();
    const byAcceptanceScoreBin = this.groupByAcceptanceScoreBin();
    const allWins = this.logs.filter(t => t.winTrade);
    const allLosses = this.logs.filter(t => !t.winTrade);

    const summary: TrendLogSummary = {
      totalTrades: this.logs.length,
      winningTrades: allWins.length,
      losingTrades: allLosses.length,
      winRate: this.logs.length > 0 ? (allWins.length / this.logs.length) : 0,
      
      bySignalType,
      byAcceptanceScoreBin,
      
      totalPnL: this.logs.reduce((sum, t) => sum + t.pnl, 0),
      avgWin: allWins.length > 0 ? allWins.reduce((sum, t) => sum + t.pnl, 0) / allWins.length : 0,
      avgLoss: allLosses.length > 0 ? allLosses.reduce((sum, t) => sum + t.pnl, 0) / allLosses.length : 0,
      profitFactor: this.calculateProfitFactor(),
      sharpeRatio: this.calculateSharpeRatio(),
      maxDrawdown: this.calculateMaxDrawdown(),
      maxDrawdownPct: this.calculateMaxDrawdownPct(),
    };

    const signalQuality = this.analyzeSignalQuality();

    return {
      metadata,
      trades: this.logs,
      summary,
      signalQuality,
    };
  }

  /**
   * Export to JSON for visualization
   */
  exportToJSON(outputPath: string): void {
    const log = this.generateSummary('BTC/USDT', {});
    fs.writeFileSync(outputPath, JSON.stringify(log, null, 2));
    console.log(`✅ Trend backtest log exported to ${outputPath}`);
  }

  /**
   * Export CSV for spreadsheet analysis
   */
  exportToCSV(outputPath: string): void {
    if (this.logs.length === 0) {
      console.warn('⚠️  No trades to export');
      return;
    }

    const headers = [
      'TradeIndex',
      'EntryBar',
      'Direction',
      'AcceptanceScore',
      'SignalType',
      'ResponseAlignment',
      'DisplacementValidation',
      'PersistenceScore',
      'RejectionFlag',
      'EntryPrice',
      'ExitPrice',
      'PnL',
      'PnLPct',
      'HoldingBars',
      'ScoutPnL',
      'ScoutPnLPct',
      'Won',
    ].join(',');

    const rows = this.logs.map(t =>
      [
        t.tradeIndex,
        t.entryBar,
        t.direction,
        t.trendSignal.acceptanceScore.toFixed(2),
        t.trendSignal.signalType,
        t.trendSignal.responseAlignment.toFixed(2),
        t.trendSignal.displacementValidation.toFixed(2),
        t.trendSignal.persistenceScore.toFixed(2),
        t.trendSignal.rejectionFlag ? 'YES' : 'NO',
        t.entryPrice.toFixed(2),
        t.exitPrice.toFixed(2),
        t.pnl.toFixed(2),
        (t.pnlPct * 100).toFixed(2),
        t.holdingBars,
        t.scoutInfo.scoutPnL.toFixed(2),
        (t.scoutInfo.scoutPnLPct * 100).toFixed(2),
        t.winTrade ? 'YES' : 'NO',
      ].join(',')
    );

    const csv = [headers, ...rows].join('\n');
    fs.writeFileSync(outputPath, csv);
    console.log(`✅ Trend backtest CSV exported to ${outputPath}`);
  }

  // ===== PRIVATE ANALYSIS METHODS =====

  private calculateCorrelations(): void {
    // Calculate AS to win rate
    const correlation = this.calculatePearsonCorrelation(
      this.logs.map(t => t.trendSignal.acceptanceScore),
      this.logs.map(t => t.winTrade ? 1 : 0)
    );

    // Calculate PS to hold correlation
    const psCorrelation = this.calculatePearsonCorrelation(
      this.logs.map(t => t.trendSignal.persistenceScore),
      this.logs.map(t => t.holdingBars)
    );

    this.logs.forEach(log => {
      log.asToWinCorrelation = correlation;
      log.psToHoldCorrelation = psCorrelation;
    });
  }

  private groupBySignalType() {
    const groups: { [key: string]: TrendTradeLog[] } = {};
    
    for (const log of this.logs) {
      if (!groups[log.trendSignal.signalType]) {
        groups[log.trendSignal.signalType] = [];
      }
      groups[log.trendSignal.signalType].push(log);
    }

    const result: any = {};
    for (const [signalType, trades] of Object.entries(groups)) {
      const wins = trades.filter(t => t.winTrade).length;
      const pnlSum = trades.reduce((sum, t) => sum + t.pnl, 0);
      
      result[signalType] = {
        count: trades.length,
        winRate: trades.length > 0 ? wins / trades.length : 0,
        avgPnL: trades.length > 0 ? pnlSum / trades.length : 0,
        avgPnLPct: trades.length > 0 ? trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length : 0,
        avgAS: trades.length > 0 ? trades.reduce((sum, t) => sum + t.trendSignal.acceptanceScore, 0) / trades.length : 0,
        avgPS: trades.length > 0 ? trades.reduce((sum, t) => sum + t.trendSignal.persistenceScore, 0) / trades.length : 0,
      };
    }

    return result;
  }

  private groupByAcceptanceScoreBin() {
    const bins: { [key: string]: TrendTradeLog[] } = {
      'AS_0.5-1.0': [],
      'AS_1.0-1.5': [],
      'AS_1.5-2.0': [],
      'AS_2.0+': [],
    };

    for (const log of this.logs) {
      const as = log.trendSignal.acceptanceScore;
      if (as < 1.0) bins['AS_0.5-1.0'].push(log);
      else if (as < 1.5) bins['AS_1.0-1.5'].push(log);
      else if (as < 2.0) bins['AS_1.5-2.0'].push(log);
      else bins['AS_2.0+'].push(log);
    }

    const result: any = {};
    for (const [binName, trades] of Object.entries(bins)) {
      if (trades.length === 0) continue;
      
      const wins = trades.filter(t => t.winTrade).length;
      const pnlSum = trades.reduce((sum, t) => sum + t.pnl, 0);
      
      result[binName] = {
        count: trades.length,
        winRate: wins / trades.length,
        avgPnL: pnlSum / trades.length,
        avgPnLPct: trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length,
      };
    }

    return result;
  }

  private analyzeSignalQuality(): SignalQualityMetrics {
    const psValues = this.logs.map(t => t.trendSignal.persistenceScore);
    const asValues = this.logs.map(t => t.trendSignal.acceptanceScore);
    const winValues = this.logs.map(t => t.winTrade ? 1 : 0);
    const holdValues = this.logs.map(t => t.holdingBars);

    // Rejection analysis
    const rejectedTrades = this.logs.filter(t => t.trendSignal.rejectionFlag);
    const rejectionAccuracy = rejectedTrades.length > 0
      ? rejectedTrades.filter(t => !t.winTrade).length / rejectedTrades.length
      : 0;

    // Group by rejection reason
    const rejectionsByReason: { [reason: string]: number } = {};
    for (const log of rejectedTrades) {
      const reason = log.trendSignal.rejectionReason || 'UNKNOWN';
      rejectionsByReason[reason] = (rejectionsByReason[reason] || 0) + 1;
    }

    // Signal type win rates
    const earlyTrends = this.logs.filter(t => t.trendSignal.signalType === 'EARLY_TREND');
    const acceptedTrends = this.logs.filter(t => t.trendSignal.signalType === 'ACCEPTED_TREND');
    const strongTrends = this.logs.filter(t => t.trendSignal.signalType === 'STRONG_TREND');

    return {
      trendPersistenceStats: {
        avgPersistenceScore: psValues.reduce((a, b) => a + b, 0) / psValues.length,
        psToWinRateCorrelation: this.calculatePearsonCorrelation(psValues, winValues),
        psToAvgPnLCorrelation: this.calculatePearsonCorrelation(psValues, this.logs.map(t => t.pnl)),
      },
      
      acceptanceDetectionStats: {
        avgAcceptanceScore: asValues.reduce((a, b) => a + b, 0) / asValues.length,
        asToWinRateCorrelation: this.calculatePearsonCorrelation(asValues, winValues),
        asToAvgPnLCorrelation: this.calculatePearsonCorrelation(asValues, this.logs.map(t => t.pnl)),
        rejectionAccuracy,
      },
      
      rejectionStats: {
        totalRejections: rejectedTrades.length,
        rejectionsByReason,
        rejectionAccuracy,
      },
      
      timingStats: {
        avgBarsToTarget: 0,  // Would require more detailed tracking
        avgBarsToStop: 0,
        earlyTrendWinRate: earlyTrends.length > 0
          ? earlyTrends.filter(t => t.winTrade).length / earlyTrends.length
          : 0,
        acceptedTrendWinRate: acceptedTrends.length > 0
          ? acceptedTrends.filter(t => t.winTrade).length / acceptedTrends.length
          : 0,
        strongTrendWinRate: strongTrends.length > 0
          ? strongTrends.filter(t => t.winTrade).length / strongTrends.length
          : 0,
      },
    };
  }

  private calculateProfitFactor(): number {
    const wins = this.logs.filter(t => t.winTrade).reduce((sum, t) => sum + t.pnl, 0);
    const losses = Math.abs(this.logs.filter(t => !t.winTrade).reduce((sum, t) => sum + t.pnl, 0));
    return losses > 0 ? wins / losses : 0;
  }

  private calculateSharpeRatio(): number {
    const returns = this.logs.map(t => t.pnlPct);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;  // Annualized
  }

  private calculateMaxDrawdown(): number {
    let maxDrawdown = 0;
    let peak = 0;

    for (const log of this.logs) {
      if (log.pnl > peak) peak = log.pnl;
      const drawdown = peak - log.pnl;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return -maxDrawdown;
  }

  private calculateMaxDrawdownPct(): number {
    let maxDrawdownPct = 0;
    let peak = 1.0;
    let equity = 1.0;

    for (const log of this.logs) {
      equity *= (1 + log.pnlPct);
      if (equity > peak) peak = equity;
      const drawdownPct = (peak - equity) / peak;
      if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;
    }

    return -maxDrawdownPct;
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / x.length;
    const meanY = y.reduce((a, b) => a + b, 0) / y.length;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < x.length; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom > 0 ? numerator / denom : 0;
  }
}
