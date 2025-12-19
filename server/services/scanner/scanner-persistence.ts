/**
 * Scanner Results Persistence Service
 * 
 * Stores scan results to database for:
 * - Historical tracking
 * - Performance analysis
 * - Backtesting
 * - Audit trails
 */

import type { ScanResult, ExchangeScanResults, CrossExchangeSignal, MultiExchangeScanResults } from './multi-exchange-scanner';
import { PrismaClient } from '@prisma/client';

export interface StoredScanResult {
  id?: string;
  symbol: string;
  exchange: string;
  timestamp: number;
  
  // Signal data
  signal: string;
  strength: number;
  confidence: number;
  compositeScore?: number;
  armSignal?: string;
  armConfidence?: number;
  
  // Market data
  price: number;
  volume24h?: number;
  volumeChange?: number;
  change24h?: number;
  
  // Market state
  marketState?: string;
  stateAlignment?: number;
  persistenceTicks?: number;
  confirmationEdge?: boolean;
  
  // Technical indicators
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  atr?: number;
  bollingerHigh?: number;
  bollingerLow?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredScanSession {
  id?: string;
  startTime: number;
  endTime?: number;
  exchanges: string[];
  symbolsScanned: number;
  resultsCount: number;
  avgConfidence: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Scanner Results Persistence Service
 * 
 * Implements database operations for:
 * - Storing individual scan results
 * - Storing scan sessions
 * - Querying historical data
 * - Computing statistics
 */
export class ScannerPersistenceService {
  private db: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.db = prismaClient;
  }

  /**
   * Create a new scan session
   */
  async createScanSession(
    exchanges: string[],
    symbolCount: number
  ): Promise<StoredScanSession> {
    const session = await this.db.scanSession.create({
      data: {
        exchanges,
        symbolCount,
        status: 'in_progress'
      }
    });

    return {
      id: session.id,
      startTime: session.startTime.getTime(),
      exchanges: session.exchanges,
      symbolsScanned: session.symbolCount,
      resultsCount: 0,
      avgConfidence: 0,
      status: 'IN_PROGRESS',
      createdAt: session.startTime,
      updatedAt: session.startTime
    };
  }

  /**
   * Complete a scan session
   */
  async completeScanSession(
    sessionId: string,
    resultCount: number,
    avgConfidence: number
  ): Promise<void> {
    await this.db.scanSession.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        status: 'completed',
        successCount: resultCount,
        avgConfidence
      }
    });
  }

  /**
   * Store a batch of scan results
   */
  async storeScanResults(
    results: ScanResult[],
    sessionId: string
  ): Promise<StoredScanResult[]> {
    try {
      const stored = await Promise.all(
        results.map(result =>
          this.db.scanResult.create({
            data: {
              sessionId,
              symbol: result.symbol,
              exchange: result.exchange,
              signal: result.signal,
              strength: result.signalStrength || 0,
              confidence: result.confidence,
              compositeScore: (result as any).compositeScore,
              armSignal: (result as any).armSignal,
              armConfidence: (result as any).armConfidence,
              price: result.price,
              volume24h: result.volume,
              volumeChange: (result as any).volumeChange,
              change24h: (result as any).change24h,
              marketState: (result as any).marketState,
              stateAlignment: (result as any).stateAlignment,
              persistenceTicks: (result as any).persistenceTicks,
              confirmationEdge: (result as any).confirmationEdge,
              rsi: (result as any).rsi,
              macd: (result as any).macd,
              macdSignal: (result as any).macdSignal,
              ema20: (result as any).ema20,
              ema50: (result as any).ema50,
              ema200: (result as any).ema200,
              atr: (result as any).atr,
              bollingerHigh: (result as any).bollingerHigh,
              bollingerLow: (result as any).bollingerLow
            }
          })
        )
      );

      return stored.map(s => ({
        id: s.id,
        symbol: s.symbol,
        exchange: s.exchange,
        timestamp: s.timestamp.getTime(),
        signal: s.signal,
        strength: s.strength,
        confidence: s.confidence,
        compositeScore: s.compositeScore || 0,
        armSignal: s.armSignal || undefined,
        armConfidence: s.armConfidence || undefined,
        price: s.price,
        volume24h: s.volume24h || 0,
        change24h: s.change24h || 0,
        marketState: s.marketState || '',
        createdAt: s.timestamp,
        updatedAt: s.timestamp
      }));
    } catch (error) {
      console.error('[ScannerPersistence] Error storing results:', error);
      throw error;
    }
  }

  /**
   * Store cross-exchange signals
   */
  async storeCrossExchangeSignals(
    signals: any[],
    sessionId: string
  ): Promise<void> {
    try {
      await Promise.all(
        signals.map(signal =>
          this.db.crossExchangeSignal.create({
            data: {
              sessionId,
              symbol: signal.symbol,
              signalType: signal.type,
              confidence: signal.confidence,
              exchanges: signal.exchanges,
              description: signal.description,
              avgCompositeScore: signal.avgCompositeScore,
              priceRange: signal.priceRange,
              volumeMetrics: signal.volumeMetrics
            }
          })
        )
      );
    } catch (error) {
      console.error('[ScannerPersistence] Error storing cross-exchange signals:', error);
      throw error;
    }
  }

  /**
   * Get recent scan results for a symbol
   */
  async getRecentResults(
    symbol: string,
    exchange?: string,
    hours: number = 24
  ): Promise<StoredScanResult[]> {
    try {
      const since = new Date(Date.now() - hours * 3600 * 1000);

      const results = await this.db.scanResult.findMany({
        where: {
          symbol,
          ...(exchange && { exchange }),
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      return results.map(r => ({
        id: r.id,
        symbol: r.symbol,
        exchange: r.exchange,
        timestamp: r.timestamp.getTime(),
        signal: r.signal,
        strength: r.strength,
        confidence: r.confidence,
        compositeScore: r.compositeScore || 0,
        price: r.price,
        volume24h: r.volume24h || 0,
        change24h: r.change24h,
        createdAt: r.timestamp,
        updatedAt: r.timestamp
      }));
    } catch (error) {
      console.error('[ScannerPersistence] Error getting recent results:', error);
      return [];
    }
  }

  /**
   * Get cross-exchange signal history for a symbol
   */
  async getCrossExchangeSignalHistory(
    symbol: string,
    days: number = 7
  ): Promise<any[]> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const signals = await this.db.crossExchangeSignal.findMany({
        where: {
          symbol,
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' },
        take: 100
      });

      return signals.map(s => ({
        id: s.id,
        symbol: s.symbol,
        type: s.signalType,
        confidence: s.confidence,
        exchanges: s.exchanges,
        description: s.description,
        avgScore: s.avgCompositeScore,
        timestamp: s.timestamp.getTime()
      }));
    } catch (error) {
      console.error('[ScannerPersistence] Error getting signal history:', error);
      return [];
    }
  }

  /**
   * Get signal statistics for a symbol
   */
  async getSignalStats(
    symbol: string,
    days: number = 7
  ): Promise<any> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      const results = await this.db.scanResult.findMany({
        where: {
          symbol,
          timestamp: { gte: since }
        }
      });

      if (results.length === 0) {
        return {
          totalScans: 0,
          avgConfidence: 0,
          signalCounts: {},
          topExchange: 'N/A',
          trend: 'N/A'
        };
      }

      const signalCounts: Record<string, number> = {};
      let totalConfidence = 0;
      const exchanges = new Map<string, number>();

      results.forEach(r => {
        signalCounts[r.signal] = (signalCounts[r.signal] || 0) + 1;
        totalConfidence += r.confidence;
        exchanges.set(r.exchange, (exchanges.get(r.exchange) || 0) + 1);
      });

      const topExchange = Array.from(exchanges.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        totalScans: results.length,
        avgConfidence: +(totalConfidence / results.length).toFixed(4),
        signalCounts,
        topExchange,
        trend: this.determineTrend(results)
      };
    } catch (error) {
      console.error('[ScannerPersistence] Error getting stats:', error);
      return null;
    }
  }

  /**
   * Get top performing symbols
   */
  async getTopPerformers(
    days: number = 7,
    limit: number = 10
  ): Promise<any[]> {
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000);

      // Group by symbol and compute average composite score
      const results = await this.db.scanResult.groupBy({
        by: ['symbol'],
        where: { timestamp: { gte: since } },
        _avg: { compositeScore: true },
        _count: true,
        orderBy: { _avg: { compositeScore: 'desc' } },
        take: limit
      });

      return results.map(r => ({
        symbol: r.symbol,
        avgScore: +(r._avg.compositeScore || 0).toFixed(4),
        scanCount: r._count
      }));
    } catch (error) {
      console.error('[ScannerPersistence] Error getting top performers:', error);
      return [];
    }
  }

  /**
   * Helper: Determine trend from recent results
   */
  private determineTrend(results: any[]): string {
    const recent = results.slice(0, Math.min(20, results.length));
    const bullishCount = recent.filter(r => 
      r.signal.includes('Buy')
    ).length;
    const bearishCount = recent.filter(r => 
      r.signal.includes('Sell')
    ).length;

    if (bullishCount > bearishCount * 1.5) return 'bullish';
    if (bearishCount > bullishCount * 1.5) return 'bearish';
    return 'neutral';
  }
}

export default ScannerPersistenceService;
