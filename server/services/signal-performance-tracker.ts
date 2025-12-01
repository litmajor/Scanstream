
import { storage } from '../storage';

interface SignalPerformance {
  signalId: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  pnl: number;
  pnlPercent: number;
  status: 'active' | 'hit_target' | 'hit_stop' | 'expired';
  createdAt: Date;
  closedAt?: Date;
  source?: 'scanner' | 'ml' | 'rl'; // Track which source generated this signal
  correct?: boolean; // Whether signal was correct
  
  // Drawdown metrics
  peakPrice?: number; // Highest price reached during signal lifetime
  maxDrawdown?: number; // Maximum drawdown in % from peak
  recoveryFactor?: number; // Final PnL / max drawdown (risk-adjusted return)
}

export class SignalPerformanceTracker {
  private performances: Map<string, SignalPerformance> = new Map();

  async trackSignal(signal: any): Promise<void> {
    const performance: SignalPerformance = {
      signalId: signal.id || `sig-${Date.now()}`,
      symbol: signal.symbol,
      entryPrice: signal.price,
      currentPrice: signal.price,
      targetPrice: signal.takeProfit || signal.price * 1.05,
      stopLoss: signal.stopLoss || signal.price * 0.95,
      pnl: 0,
      pnlPercent: 0,
      status: 'active',
      createdAt: new Date(),
      source: signal.dominantSource || 'scanner', // Track which source dominated
      correct: undefined, // Will be set when signal closes
      peakPrice: signal.price, // Start tracking from entry price
      maxDrawdown: 0,
      recoveryFactor: 0
    };

    this.performances.set(performance.signalId, performance);

    // Store in database
    try {
      await storage.createSignalPerformance(performance);
    } catch (error) {
      console.error('[SignalTracker] Failed to store performance:', error);
    }
  }

  async updateSignalPrice(signalId: string, currentPrice: number): Promise<SignalPerformance | null> {
    const perf = this.performances.get(signalId);
    if (!perf || perf.status !== 'active') return null;

    perf.currentPrice = currentPrice;
    perf.pnl = currentPrice - perf.entryPrice;
    perf.pnlPercent = (perf.pnl / perf.entryPrice) * 100;

    // Track peak price for drawdown calculation
    if (!perf.peakPrice) perf.peakPrice = perf.entryPrice;
    if (currentPrice > perf.peakPrice) {
      perf.peakPrice = currentPrice;
    }

    // Calculate maximum drawdown from peak
    const drawdownPercent = ((perf.peakPrice - currentPrice) / perf.peakPrice) * 100;
    if (!perf.maxDrawdown || drawdownPercent > perf.maxDrawdown) {
      perf.maxDrawdown = drawdownPercent;
    }

    // Calculate recovery factor = cumulative_returns / max_drawdown
    // Avoid division by zero
    perf.recoveryFactor = perf.maxDrawdown > 0 
      ? perf.pnlPercent / perf.maxDrawdown 
      : (perf.pnlPercent > 0 ? Infinity : 0);

    // Check if target or stop hit
    if (currentPrice >= perf.targetPrice) {
      perf.status = 'hit_target';
      perf.correct = true; // Signal was correct
      perf.closedAt = new Date();
    } else if (currentPrice <= perf.stopLoss) {
      perf.status = 'hit_stop';
      perf.correct = false; // Signal was wrong
      perf.closedAt = new Date();
    }

    // Update in database
    try {
      await storage.updateSignalPerformance(signalId, perf);
    } catch (error) {
      console.error('[SignalTracker] Failed to update performance:', error);
    }

    return perf;
  }

  getPerformanceStats(): {
    totalSignals: number;
    activeSignals: number;
    winRate: number;
    avgPnl: number;
    avgPnlPercent: number;
    avgMaxDrawdown: number;
    recoveryFactor: number; // Cumulative returns / max drawdown
    riskAdjustedScore: number; // Combined metric: winRate * recoveryFactor
  } {
    const all = Array.from(this.performances.values());
    const closed = all.filter(p => p.status === 'hit_target' || p.status === 'hit_stop');
    const winners = closed.filter(p => p.status === 'hit_target');

    const winRate = closed.length > 0 ? (winners.length / closed.length) * 100 : 0;
    const avgPnlPercent = closed.length > 0 ? closed.reduce((sum, p) => sum + p.pnlPercent, 0) / closed.length : 0;
    
    // Calculate drawdown metrics
    const avgMaxDrawdown = closed.length > 0 
      ? closed.reduce((sum, p) => sum + (p.maxDrawdown || 0), 0) / closed.length 
      : 0;
    
    // Recovery factor = total cumulative returns / average max drawdown
    const totalCumulativeReturns = closed.reduce((sum, p) => sum + p.pnlPercent, 0);
    const recoveryFactor = avgMaxDrawdown > 0 
      ? totalCumulativeReturns / avgMaxDrawdown 
      : (totalCumulativeReturns > 0 ? 1.0 : 0);

    // Risk-adjusted score combines both metrics
    // Considers both win rate and recovery efficiency
    const riskAdjustedScore = (winRate / 100) * Math.max(0.5, recoveryFactor);

    return {
      totalSignals: all.length,
      activeSignals: all.filter(p => p.status === 'active').length,
      winRate,
      avgPnl: closed.length > 0 ? closed.reduce((sum, p) => sum + p.pnl, 0) / closed.length : 0,
      avgPnlPercent,
      avgMaxDrawdown: Math.round(avgMaxDrawdown * 100) / 100,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100,
      riskAdjustedScore: Math.round(riskAdjustedScore * 100) / 100
    };
  }

  getRecentPerformance(limit: number = 20): SignalPerformance[] {
    return Array.from(this.performances.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get recent win rates by source (last N signals)
   * Used for adaptive weighting in consensus engine
   */
  getRecentWinRates(lookback: number = 20): { scanner: number; ml: number; rl: number } {
    const recentSignals = Array.from(this.performances.values())
      .filter(p => p.correct !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, lookback);

    if (recentSignals.length === 0) {
      return { scanner: 1, ml: 1, rl: 1 };
    }

    const winsBySource = { scanner: 0, ml: 0, rl: 0 };
    const countBySource = { scanner: 0, ml: 0, rl: 0 };

    for (const signal of recentSignals) {
      const source = (signal.source || 'scanner') as 'scanner' | 'ml' | 'rl';
      if (signal.correct) winsBySource[source]++;
      countBySource[source]++;
    }

    return {
      scanner: countBySource.scanner > 0 ? winsBySource.scanner / countBySource.scanner : 0.5,
      ml: countBySource.ml > 0 ? winsBySource.ml / countBySource.ml : 0.5,
      rl: countBySource.rl > 0 ? winsBySource.rl / countBySource.rl : 0.5
    };
  }

  /**
   * Get win rates by pattern type for adaptive pattern weighting
   */
  getPatternWinRates(lookback: number = 50): Map<string, number> {
    const patternStats = new Map<string, { wins: number; total: number }>();
    
    const recentSignals = Array.from(this.performances.values())
      .filter(p => p.correct !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, lookback);

    for (const signal of recentSignals) {
      const pattern = (signal as any).primaryPattern || 'UNKNOWN';
      if (!patternStats.has(pattern)) {
        patternStats.set(pattern, { wins: 0, total: 0 });
      }
      
      const stats = patternStats.get(pattern)!;
      stats.total++;
      if (signal.correct) stats.wins++;
    }

    const winRates = new Map<string, number>();
    for (const [pattern, stats] of patternStats.entries()) {
      winRates.set(pattern, stats.total > 0 ? stats.wins / stats.total : 0.5);
    }

    return winRates;
  }

  /**
   * Get pattern statistics for Kelly Criterion position sizing
   * Returns winRate, avgProfit, avgLoss for a specific pattern
   */
  getPatternStats(pattern: string): { winRate: number; avgProfit: number; avgLoss: number; totalTrades: number } | null {
    const signals = Array.from(this.performances.values())
      .filter(p => {
        const primaryPattern = (p as any).primaryPattern;
        return primaryPattern === pattern && p.correct !== undefined;
      });

    if (signals.length < 5) {
      return null;
    }

    const wins = signals.filter(p => p.correct === true);
    const losses = signals.filter(p => p.correct === false);

    const winRate = wins.length / signals.length;
    const avgProfit = wins.length > 0 
      ? wins.reduce((sum, p) => sum + Math.abs(p.pnlPercent), 0) / wins.length / 100
      : 0.025;
    const avgLoss = losses.length > 0 
      ? losses.reduce((sum, p) => sum + Math.abs(p.pnlPercent), 0) / losses.length / 100
      : 0.015;

    return {
      winRate,
      avgProfit,
      avgLoss,
      totalTrades: signals.length
    };
  }

  /**
   * Get all pattern statistics for Kelly validation
   */
  getAllPatternStats(): Map<string, { winRate: number; avgProfit: number; avgLoss: number; totalTrades: number }> {
    const patternStats = new Map<string, { 
      wins: number; 
      losses: number; 
      totalProfit: number; 
      totalLoss: number;
    }>();
    
    const signals = Array.from(this.performances.values())
      .filter(p => p.correct !== undefined);

    for (const signal of signals) {
      const pattern = (signal as any).primaryPattern || 'UNKNOWN';
      if (!patternStats.has(pattern)) {
        patternStats.set(pattern, { wins: 0, losses: 0, totalProfit: 0, totalLoss: 0 });
      }
      
      const stats = patternStats.get(pattern)!;
      if (signal.correct) {
        stats.wins++;
        stats.totalProfit += Math.abs(signal.pnlPercent);
      } else {
        stats.losses++;
        stats.totalLoss += Math.abs(signal.pnlPercent);
      }
    }

    const result = new Map<string, { winRate: number; avgProfit: number; avgLoss: number; totalTrades: number }>();
    for (const [pattern, stats] of patternStats.entries()) {
      const total = stats.wins + stats.losses;
      if (total >= 5) {
        result.set(pattern, {
          winRate: stats.wins / total,
          avgProfit: stats.wins > 0 ? (stats.totalProfit / stats.wins) / 100 : 0.025,
          avgLoss: stats.losses > 0 ? (stats.totalLoss / stats.losses) / 100 : 0.015,
          totalTrades: total
        });
      }
    }

    return result;
  }
}

export const signalPerformanceTracker = new SignalPerformanceTracker();
