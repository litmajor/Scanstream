
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
      createdAt: new Date()
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

    // Check if target or stop hit
    if (currentPrice >= perf.targetPrice) {
      perf.status = 'hit_target';
      perf.closedAt = new Date();
    } else if (currentPrice <= perf.stopLoss) {
      perf.status = 'hit_stop';
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
  } {
    const all = Array.from(this.performances.values());
    const closed = all.filter(p => p.status === 'hit_target' || p.status === 'hit_stop');
    const winners = closed.filter(p => p.status === 'hit_target');

    return {
      totalSignals: all.length,
      activeSignals: all.filter(p => p.status === 'active').length,
      winRate: closed.length > 0 ? (winners.length / closed.length) * 100 : 0,
      avgPnl: closed.length > 0 ? closed.reduce((sum, p) => sum + p.pnl, 0) / closed.length : 0,
      avgPnlPercent: closed.length > 0 ? closed.reduce((sum, p) => sum + p.pnlPercent, 0) / closed.length : 0
    };
  }

  getRecentPerformance(limit: number = 20): SignalPerformance[] {
    return Array.from(this.performances.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const signalPerformanceTracker = new SignalPerformanceTracker();
