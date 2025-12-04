
import { PrismaClient } from '@prisma/client';

interface ArchivedSignal {
  id: string;
  symbol: string;
  exchange: string;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  price: number;
  timestamp: Date;
  source: string;
  reasoning?: any;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number;
  // Outcome tracking
  executedAt?: Date;
  exitedAt?: Date;
  exitPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING';
  hitStopLoss?: boolean;
  hitTakeProfit?: boolean;
}

export class SignalArchiveService {
  private prisma: PrismaClient;
  private maxArchiveSize = 50000; // Keep last 50k signals

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Archive a new signal when generated
   */
  async archiveSignal(signal: Omit<ArchivedSignal, 'id' | 'timestamp' | 'outcome'>): Promise<string> {
    try {
      const archived = await this.prisma.signal.create({
        data: {
          symbol: signal.symbol,
          type: signal.signalType,
          strength: signal.strength,
          confidence: signal.confidence,
          price: signal.price,
          reasoning: signal.reasoning || {},
          riskReward: signal.takeProfit && signal.stopLoss 
            ? Math.abs((signal.takeProfit - signal.price) / (signal.price - signal.stopLoss))
            : 1,
          stopLoss: signal.stopLoss || 0,
          takeProfit: signal.takeProfit || 0,
        }
      });

      console.log(`[SignalArchive] Archived signal ${archived.id} for ${signal.symbol}`);
      return archived.id;
    } catch (error) {
      console.error('[SignalArchive] Error archiving signal:', error);
      throw error;
    }
  }

  /**
   * Update signal when executed (trade opened)
   */
  async markExecuted(signalId: string, executionPrice: number): Promise<void> {
    try {
      await this.prisma.signal.update({
        where: { id: signalId },
        data: {
          price: executionPrice,
          timestamp: new Date(),
        }
      });
      console.log(`[SignalArchive] Marked signal ${signalId} as executed at ${executionPrice}`);
    } catch (error) {
      console.error('[SignalArchive] Error marking executed:', error);
    }
  }

  /**
   * Update signal outcome when trade closes
   */
  async recordOutcome(signalId: string, outcome: {
    exitPrice: number;
    exitedAt: Date;
    hitStopLoss?: boolean;
    hitTakeProfit?: boolean;
  }): Promise<void> {
    try {
      const signal = await this.prisma.signal.findUnique({ where: { id: signalId } });
      if (!signal) {
        console.warn(`[SignalArchive] Signal ${signalId} not found`);
        return;
      }

      const entryPrice = signal.price;
      const pnl = outcome.exitPrice - entryPrice;
      const pnlPercent = (pnl / entryPrice) * 100;

      const outcomeType: 'WIN' | 'LOSS' | 'BREAKEVEN' = 
        pnlPercent > 0.5 ? 'WIN' :
        pnlPercent < -0.5 ? 'LOSS' : 'BREAKEVEN';

      // Store outcome in reasoning field (since we don't have dedicated columns)
      const updatedReasoning = {
        ...(signal.reasoning as any || {}),
        outcome: {
          type: outcomeType,
          exitPrice: outcome.exitPrice,
          exitedAt: outcome.exitedAt,
          pnl,
          pnlPercent,
          hitStopLoss: outcome.hitStopLoss,
          hitTakeProfit: outcome.hitTakeProfit,
        }
      };

      await this.prisma.signal.update({
        where: { id: signalId },
        data: { reasoning: updatedReasoning }
      });

      console.log(`[SignalArchive] Recorded ${outcomeType} outcome for ${signalId}: ${pnlPercent.toFixed(2)}%`);
    } catch (error) {
      console.error('[SignalArchive] Error recording outcome:', error);
    }
  }

  /**
   * Query historical signals with filters
   */
  async querySignals(filters: {
    symbol?: string;
    startDate?: Date;
    endDate?: Date;
    outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING';
    minStrength?: number;
    source?: string;
    limit?: number;
  }) {
    const { symbol, startDate, endDate, minStrength, limit = 100 } = filters;

    const signals = await this.prisma.signal.findMany({
      where: {
        ...(symbol && { symbol }),
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
        ...(minStrength && { strength: { gte: minStrength } }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return signals;
  }

  /**
   * Get performance statistics from archived signals
   */
  async getPerformanceStats(filters?: { symbol?: string; days?: number }) {
    const { symbol, days = 30 } = filters || {};
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const signals = await this.querySignals({
      symbol,
      startDate,
      limit: 10000,
    });

    const withOutcomes = signals.filter(s => (s.reasoning as any)?.outcome);
    
    const wins = withOutcomes.filter(s => (s.reasoning as any).outcome.type === 'WIN').length;
    const losses = withOutcomes.filter(s => (s.reasoning as any).outcome.type === 'LOSS').length;
    const breakevens = withOutcomes.filter(s => (s.reasoning as any).outcome.type === 'BREAKEVEN').length;

    const totalPnl = withOutcomes.reduce((sum, s) => sum + ((s.reasoning as any).outcome.pnl || 0), 0);
    const avgPnl = withOutcomes.length > 0 ? totalPnl / withOutcomes.length : 0;

    return {
      totalSignals: signals.length,
      executedSignals: withOutcomes.length,
      wins,
      losses,
      breakevens,
      winRate: withOutcomes.length > 0 ? (wins / withOutcomes.length) * 100 : 0,
      totalPnl,
      avgPnl,
      avgPnlPercent: withOutcomes.reduce((sum, s) => sum + ((s.reasoning as any).outcome.pnlPercent || 0), 0) / (withOutcomes.length || 1),
    };
  }

  /**
   * Cleanup old signals to prevent database bloat
   */
  async pruneOldSignals(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const deleted = await this.prisma.signal.deleteMany({
      where: {
        timestamp: { lt: cutoffDate }
      }
    });

    console.log(`[SignalArchive] Pruned ${deleted.count} signals older than ${daysToKeep} days`);
    return deleted.count;
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

// Singleton instance
export const signalArchive = new SignalArchiveService();
