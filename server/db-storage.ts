import { PrismaClient } from '@prisma/client';
import { type IStorage } from './storage';
import { type MarketFrame, type Signal, type Trade, type Strategy, type BacktestResult, type InsertMarketFrame, type InsertSignal, type InsertTrade, type InsertStrategy, type InsertBacktestResult, type MarketSentiment, type PortfolioSummary } from "@shared/schema";
import { v4 as uuidv4 } from 'uuid';

export class DbStorage implements IStorage {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getMarketFrames(symbol: string, limit = 100): Promise<MarketFrame[]> {
    return this.prisma.marketFrame.findMany({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async createMarketFrame(frame: InsertMarketFrame): Promise<MarketFrame> {
    // Ensure all JSON fields are valid objects for Prisma
    const safeFrame = {
      id: uuidv4(), // generate new unique id
      ...frame,
      price: frame.price ?? {},
      indicators: frame.indicators ?? {},
      orderFlow: frame.orderFlow ?? {},
      marketMicrostructure: frame.marketMicrostructure ?? {},
    };
    // Only update mutable fields (not id)
    return this.prisma.marketFrame.upsert({
      where: { id: safeFrame.id },
      update: {
        price: safeFrame.price,
        indicators: safeFrame.indicators,
        orderFlow: safeFrame.orderFlow,
        marketMicrostructure: safeFrame.marketMicrostructure,
        // add other mutable fields here if needed
      },
      create: safeFrame,
    });
  }

  async getLatestMarketFrame(symbol: string): Promise<MarketFrame | undefined> {
    const frame = await this.prisma.marketFrame.findFirst({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
    });
    return frame ?? undefined;
  }

  async getSignals(symbol?: string, limit = 100): Promise<Signal[]> {
    const results = await this.prisma.signal.findMany({
      where: symbol ? { symbol } : undefined,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return results.map((r: any) => ({
      ...r,
      type: r.type as "BUY" | "SELL" | "HOLD",
    }));
  }

  async createSignal(signal: InsertSignal): Promise<Signal> {
    // Ensure reasoning is a valid object for Prisma JSON field
    const safeSignal = {
      ...signal,
      reasoning: signal.reasoning ?? {},
      type: signal.type as "BUY" | "SELL" | "HOLD",
    };
    
    try {
      const result = await this.prisma.signal.create({ data: safeSignal });
      return {
        ...result,
        type: result.type as "BUY" | "SELL" | "HOLD",
      };
    } catch (error: any) {
      // If unique constraint violation, try to update existing signal instead
      if (error?.code === 'P2002') {
        console.warn(`Signal already exists, updating instead of creating new one`);
        // Find by symbol and use the latest one
        const existing = await this.prisma.signal.findFirst({
          where: { symbol: signal.symbol },
          orderBy: { timestamp: 'desc' }
        });
        
        if (existing) {
          const result = await this.prisma.signal.update({
            where: { id: existing.id },
            data: safeSignal,
          });
          return {
            ...result,
            type: result.type as "BUY" | "SELL" | "HOLD",
          };
        }
      }
      throw error;
    }
  }

  async getLatestSignals(limit = 10): Promise<Signal[]> {
    const results = await this.prisma.signal.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return results.map((r: any) => ({
      ...r,
      type: r.type as "BUY" | "SELL" | "HOLD",
    }));
  }

  async getTrades(status?: string): Promise<Trade[]> {
    // Use entryTime for ordering, as Trade does not have timestamp
    const results = await this.prisma.trade.findMany({
      where: status ? { status } : undefined,
      orderBy: { entryTime: 'desc' },
    });
    return results.map((r: any) => ({
      ...r,
      status: r.status as "OPEN" | "CLOSED" | "CANCELLED",
    }));
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const result = await this.prisma.trade.create({ data: trade });
    return {
      ...result,
      status: result.status as "OPEN" | "CLOSED" | "CANCELLED",
    };
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<Trade> {
    const result = await this.prisma.trade.update({ where: { id }, data: updates });
    return {
      ...result,
      status: result.status as "OPEN" | "CLOSED" | "CANCELLED",
    };
  }

  async getStrategies(): Promise<Strategy[]> {
    return this.prisma.strategy.findMany();
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    const safeStrategy = {
      ...strategy,
      riskParams: JSON.parse(JSON.stringify(strategy.riskParams)),
      performance: JSON.parse(JSON.stringify(strategy.performance)),
    };
    return this.prisma.strategy.create({ data: safeStrategy });
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    // Ensure riskParams and performance are valid JSON objects for Prisma
    const safeUpdates = {
      ...updates,
      riskParams: updates.riskParams ?? {},
      performance: updates.performance ?? {},
    };
    return this.prisma.strategy.update({ where: { id }, data: safeUpdates });
  }

  async getBacktestResults(strategyId?: string): Promise<BacktestResult[]> {
    // Ensure all required fields are present in returned results
    const results = await this.prisma.backtestResult.findMany({
      where: strategyId ? { strategyId } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        strategyId: true,
        startDate: true,
        endDate: true,
        initialCapital: true,
        finalCapital: true,
        performance: true,
        equityCurve: true,
        monthlyReturns: true,
        metrics: true,
        trades: true,
        createdAt: true,
      },
    });
    // Map results to ensure all required fields
    return results.map((r: any) => ({
      id: r.id,
      strategyId: r.strategyId,
      startDate: r.startDate,
      endDate: r.endDate,
      initialCapital: r.initialCapital,
      finalCapital: r.finalCapital,
      performance: r.performance ?? {},
      equityCurve: r.equityCurve ?? [],
      monthlyReturns: r.monthlyReturns ?? [],
      metrics: r.metrics ?? {},
      trades: r.trades ?? [],
      createdAt: r.createdAt,
    }));
  }

  async deleteBacktestResult(id: string): Promise<void> {
    await this.prisma.backtestResult.delete({
      where: { id },
    });
  }

  async createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    // Only pass fields that are allowed for creation; id and createdAt are generated by DB
    const safeResult = {
      strategyId: result.strategyId,
      startDate: result.startDate ?? new Date(),
      endDate: result.endDate ?? new Date(),
      initialCapital: result.initialCapital ?? 0,
      finalCapital: result.finalCapital ?? 0,
      performance: result.performance ?? {},
      equityCurve: result.equityCurve ?? [],
      monthlyReturns: result.monthlyReturns ?? [],
      metrics: result.metrics ?? {},
      trades: result.trades ?? [],
    };
    return this.prisma.backtestResult.create({ data: safeResult });
  }

  async getMarketSentiment(): Promise<MarketSentiment> {
    // Return the latest MarketSentiment record
    const sentiment = await this.prisma.marketSentiment.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!sentiment) throw new Error('No market sentiment data found');
    // Ensure all required fields are present, extracting from .data if needed
    const data = (sentiment as any).data || sentiment;
    return {
      fearGreedIndex: data.fearGreedIndex ?? 0,
      btcDominance: data.btcDominance ?? 0,
      totalMarketCap: data.totalMarketCap ?? 0,
      volume24h: data.volume24h ?? 0,
    };
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    // Return the latest PortfolioSummary record
    const summary = await this.prisma.portfolioSummary.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // Return default empty portfolio if no data exists
    if (!summary) {
      return {
        totalValue: 0,
        availableCash: 0,
        invested: 0,
        dayChange: 0,
        dayChangePercent: 0,
      };
    }

    // If summary fields are nested in summary.data, extract them
    const data = (summary as any).data || summary;
    return {
      totalValue: data.totalValue ?? 0,
      availableCash: data.availableCash ?? 0,
      invested: data.invested ?? 0,
      dayChange: data.dayChange ?? 0,
      dayChangePercent: data.dayChangePercent ?? 0,
    };
  }

  async getRecentFrames(limit: number = 1000): Promise<MarketFrame[]> {
    return this.prisma.marketFrame.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async createSignalPerformance(performance: any): Promise<void> {
    // Store signal performance metrics - could be in a separate table or cache
    // For now, we'll just log it since signal tracking is handled elsewhere
    console.log('[DbStorage] Signal performance tracked:', performance);
  }

  async updateSignalPerformance(signalId: string, updates: any): Promise<void> {
    // Update signal performance metrics
    console.log('[DbStorage] Signal performance updated:', { signalId, updates });
  }
}

// Export singleton instance
export const db = new DbStorage();