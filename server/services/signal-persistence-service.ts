/**
 * Signal Persistence Service
 * 
 * Tracks signal lifecycle from generation to outcome:
 * - Records signal generation (entry point, confidence, patterns)
 * - Links signals to trades when executed
 * - Records outcomes (win/loss/breakeven)
 * - Computes historical accuracy by pattern and timeframe
 * 
 * Enables feedback loop: actual signal effectiveness → dynamic accuracy adjustment
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SignalRecord {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  confidence: number; // 0-1
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
  
  // Pattern info
  primaryPattern?: string;
  patterns?: string[];
  qualityScore?: number;
  qualityRating?: 'excellent' | 'good' | 'fair' | 'poor' | 'filtered';
  
  // Additional context
  reasoning?: Record<string, any>;
  regimeState?: string;
  timeframe?: string;
  userId?: string;
}

export interface SignalOutcome {
  signalId: string;
  exitPrice: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  realizedPnL: number;
  realizedPnLPercent: number;
  durationSeconds?: number;
  tradeId?: string;
  notes?: string;
}

export interface SignalStats {
  symbol: string;
  totalSignals: number;
  winRate: number; // 0-1
  profitFactor: number;
  avgPnL: number;
  totalPnL: number;
  
  // Pattern breakdown
  patternAccuracy: Record<string, { wins: number; losses: number; winRate: number }>;
  
  // Quality correlation
  qualityVsWinRate: Record<string, number>;
}

export class SignalPersistenceService {
  /**
   * Record a new signal when it's generated
   */
  async recordSignal(signal: SignalRecord): Promise<any> {
    try {
      const recorded = await prisma.signal.create({
        data: {
          symbol: signal.symbol,
          type: signal.type,
          strength: signal.strength,
          confidence: signal.confidence,
          entryPrice: signal.entryPrice,
          price: signal.entryPrice,
          stopLoss: signal.stopLoss || 0,
          takeProfit: signal.takeProfit || 0,
          riskReward: signal.riskReward || 0,
          
          // Lifecycle fields
          entryTimestamp: new Date(),
          
          // Pattern info
          primaryPattern: signal.primaryPattern,
          patterns: signal.patterns || [],
          qualityScore: signal.qualityScore,
          qualityRating: signal.qualityRating,
          
          // Metadata
          regimeState: signal.regimeState,
          reasoning: signal.reasoning || {},
          userId: signal.userId,
          momentumLabel: signal.timeframe,
          
          outcome: 'OPEN',
        }
      });

      console.log(`[SignalPersistence] Recorded signal: ${signal.symbol} ${signal.type} @ ${signal.entryPrice}`);
      return recorded;
    } catch (error) {
      console.error('[SignalPersistence] Error recording signal:', error);
      throw error;
    }
  }

  /**
   * Update signal with exit outcome
   */
  async updateSignalOutcome(outcome: SignalOutcome): Promise<any> {
    try {
      const signal = await prisma.signal.findUnique({
        where: { id: outcome.signalId }
      }) as any;

      if (!signal) {
        throw new Error(`Signal not found: ${outcome.signalId}`);
      }

      // Calculate duration
      const entryTime = new Date(signal.entryTimestamp);
      const durationSeconds = outcome.durationSeconds ||
        Math.floor((Date.now() - entryTime.getTime()) / 1000);

      // Update signal with outcome
      const updated = await prisma.signal.update({
        where: { id: outcome.signalId },
        data: {
          exitTimestamp: new Date(),
          exitPrice: outcome.exitPrice,
          outcome: outcome.outcome,
          realizedPnL: outcome.realizedPnL,
          realizedPnLPercent: outcome.realizedPnLPercent,
          durationSeconds: durationSeconds,
        }
      });

      // Create or update SignalTrade linking
      if (outcome.tradeId) {
        const prismaAny = prisma as any;
        await prismaAny.signalTrade.create({
          data: {
            signalId: outcome.signalId,
            tradeId: outcome.tradeId,
            executed: true,
            executedAt: new Date(),
            outcome: outcome.outcome,
            pnl: outcome.realizedPnL,
            pnlPercent: outcome.realizedPnLPercent,
            notes: outcome.notes,
          }
        });
      }

      console.log(`[SignalPersistence] Updated signal outcome: ${signal.symbol} ${outcome.outcome} ${outcome.realizedPnLPercent > 0 ? '+' : ''}${(outcome.realizedPnLPercent * 100).toFixed(2)}%`);
      
      // Update performance stats (async, non-blocking)
      this.updatePerformanceStats(signal.symbol).catch(err =>
        console.error('[SignalPersistence] Async perf stats update failed:', err)
      );
      
      return updated;
    } catch (error) {
      console.error('[SignalPersistence] Error updating signal outcome:', error);
      throw error;
    }
  }

  /**
   * Mark signal as not executed
   */
  async markSignalNotExecuted(signalId: string, reason?: string): Promise<any> {
    try {
      return await prisma.signalTrade.create({
        data: {
          signalId,
          executed: false,
          outcome: 'NOT_EXECUTED',
          notes: reason,
        }
      });
    } catch (error) {
      console.error('[SignalPersistence] Error marking signal not executed:', error);
      throw error;
    }
  }

  /**
   * Get signal statistics for a symbol
   */
  async getSignalStats(symbol: string): Promise<SignalStats | null> {
    try {
      // Get all closed signals for symbol
      const signals = await prisma.signal.findMany({
        where: {
          symbol,
          NOT: {
            outcome: null
          }
        },
        include: {
          signalTrades: true
        }
      }) as any[];

      if (signals.length === 0) {
        return null;
      }

      // Calculate stats
      const winSignals = signals.filter((s: any) => s.outcome === 'WIN').length;
      const lossSignals = signals.filter((s: any) => s.outcome === 'LOSS').length;
      const winRate = signals.length > 0 ? winSignals / signals.length : 0;
      
      const totalPnL = signals.reduce((sum, s: any) => sum + (s.realizedPnL ?? 0), 0);
      const profitFactor = lossSignals > 0 ? winSignals / lossSignals : winSignals > 0 ? winSignals : 0;
      const avgPnL = signals.length > 0 ? totalPnL / signals.length : 0;

      // Pattern breakdown
      const patternAccuracy: Record<string, any> = {};
      for (const signal of signals) {
        if ((signal as any).primaryPattern) {
          if (!patternAccuracy[(signal as any).primaryPattern]) {
            patternAccuracy[(signal as any).primaryPattern] = { wins: 0, losses: 0, winRate: 0 };
          }
          if ((signal as any).outcome === 'WIN') {
            patternAccuracy[(signal as any).primaryPattern].wins++;
          } else if ((signal as any).outcome === 'LOSS') {
            patternAccuracy[(signal as any).primaryPattern].losses++;
          }
          const total = patternAccuracy[(signal as any).primaryPattern].wins + patternAccuracy[(signal as any).primaryPattern].losses;
          patternAccuracy[(signal as any).primaryPattern].winRate = total > 0 ? patternAccuracy[(signal as any).primaryPattern].wins / total : 0;
        }
      }

      // Quality vs win rate
      const qualityVsWinRate: Record<string, number> = {};
      for (const rating of ['excellent', 'good', 'fair', 'poor']) {
        const ratingSignals = signals.filter((s: any) => s.qualityRating === rating);
        if (ratingSignals.length > 0) {
          const wins = ratingSignals.filter((s: any) => s.outcome === 'WIN').length;
          qualityVsWinRate[rating] = wins / ratingSignals.length;
        }
      }

      return {
        symbol,
        totalSignals: signals.length,
        winRate,
        profitFactor,
        avgPnL,
        totalPnL,
        patternAccuracy,
        qualityVsWinRate
      };
    } catch (error) {
      console.error('[SignalPersistence] Error getting signal stats:', error);
      throw error;
    }
  }

  /**
   * Update performance statistics for a symbol
   */
  private async updatePerformanceStats(symbol: string): Promise<void> {
    try {
      const stats = await this.getSignalStats(symbol);
      if (!stats) return;

      // Upsert stats record (cast to any for Prisma flexibility)
      const prismaAny = prisma as any;
      if (prismaAny.signalPerformanceStats) {
        await prismaAny.signalPerformanceStats.upsert({
          where: { symbol },
          update: {
            totalSignals: stats.totalSignals,
            winSignals: Math.round(stats.winRate * stats.totalSignals),
            lossSignals: stats.totalSignals - Math.round(stats.winRate * stats.totalSignals),
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            avgPnL: stats.avgPnL,
            totalPnL: stats.totalPnL,
            patternAccuracy: stats.patternAccuracy,
            qualityVsWinRate: stats.qualityVsWinRate,
            lastUpdated: new Date(),
          },
          create: {
            symbol,
            totalSignals: stats.totalSignals,
            winSignals: Math.round(stats.winRate * stats.totalSignals),
            lossSignals: stats.totalSignals - Math.round(stats.winRate * stats.totalSignals),
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            avgPnL: stats.avgPnL,
            totalPnL: stats.totalPnL,
            patternAccuracy: stats.patternAccuracy,
            qualityVsWinRate: stats.qualityVsWinRate,
          }
        });
      }
    } catch (error) {
      console.error('[SignalPersistence] Error updating performance stats:', error);
      // Non-fatal: don't throw
    }
  }

  /**
   * Get all open signals (not yet closed)
   */
  async getOpenSignals(symbol?: string): Promise<any[]> {
    try {
      return await prisma.signal.findMany({
        where: {
          outcome: 'OPEN',
          ...(symbol && { symbol })
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        include: { signalTrades: true }
      });
    } catch (error) {
      console.error('[SignalPersistence] Error getting open signals:', error);
      throw error;
    }
  }

  /**
   * Get recent signals (closed or open)
   */
  async getRecentSignals(symbol?: string, limit: number = 50): Promise<any[]> {
    try {
      return await prisma.signal.findMany({
        where: symbol ? { symbol } : undefined,
        orderBy: { timestamp: 'desc' },
        take: Math.min(limit, 500),
        include: { signalTrades: true }
      });
    } catch (error) {
      console.error('[SignalPersistence] Error getting recent signals:', error);
      throw error;
    }
  }

  /**
   * Get signal performance by pattern
   */
  async getPatternPerformance(symbol: string): Promise<Record<string, any>> {
    try {
      const signals = (await prisma.signal.findMany({
        where: {
          symbol,
          outcome: { not: null }
        }
      })) as any[];

      const performance: Record<string, any> = {};
      for (const signal of signals) {
        const pattern = signal.primaryPattern || 'UNKNOWN';
        if (!performance[pattern]) {
          performance[pattern] = {
            count: 0,
            wins: 0,
            losses: 0,
            totalPnL: 0,
            winRate: 0,
            avgPnL: 0
          };
        }
        performance[pattern].count++;
        if (signal.outcome === 'WIN') performance[pattern].wins++;
        if (signal.outcome === 'LOSS') performance[pattern].losses++;
        performance[pattern].totalPnL += signal.realizedPnL || 0;
        performance[pattern].winRate = performance[pattern].wins / performance[pattern].count;
        performance[pattern].avgPnL = performance[pattern].totalPnL / performance[pattern].count;
      }

      return performance;
    } catch (error) {
      console.error('[SignalPersistence] Error getting pattern performance:', error);
      throw error;
    }
  }
}

export default SignalPersistenceService;
