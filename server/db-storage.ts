import { PrismaClient } from '@prisma/client';
import { type IStorage } from './storage';
import { type MarketFrame, type Signal, type Trade, type Strategy, type BacktestResult, type InsertMarketFrame, type InsertSignal, type InsertTrade, type InsertStrategy, type InsertBacktestResult, type MarketSentiment, type PortfolioSummary, type ModelMetric, type InsertModelMetric } from "@shared/schema";
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';

// Simple in-memory fallback to avoid circular dependency
class SimpleFallbackStorage implements IStorage {
  private marketFrames: Map<string, MarketFrame> = new Map();
  private signals: Map<string, Signal> = new Map();
  private trades: Map<string, Trade> = new Map();
  private strategies: Map<string, Strategy> = new Map();
  private backtestResults: Map<string, BacktestResult> = new Map();
  private modelMetrics: Map<string, ModelMetric> = new Map();
  private auditLogs: Map<string, any> = new Map();

  async getMarketFrames(symbol: string, limit = 200): Promise<MarketFrame[]> {
    return Array.from(this.marketFrames.values())
      .filter(frame => frame.symbol === symbol)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createMarketFrame(frameData: InsertMarketFrame): Promise<MarketFrame> {
    const id = randomUUID();
    const frame: MarketFrame = {
      ...frameData,
      id,
      timestamp: new Date(),
    };
    this.marketFrames.set(id, frame);
    return frame;
  }

  async getLatestMarketFrame(symbol: string): Promise<MarketFrame | undefined> {
    const frames = await this.getMarketFrames(symbol, 1);
    return frames[0];
  }

  async getSignals(symbol?: string, limit = 50): Promise<Signal[]> {
    let signals = Array.from(this.signals.values());
    if (symbol) {
      signals = signals.filter(signal => signal.symbol === symbol);
    }
    return signals
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createSignal(signalData: InsertSignal): Promise<Signal> {
    const id = randomUUID();
    const signal: Signal = {
      ...signalData,
      id,
      timestamp: new Date(),
      momentumLabel: signalData.momentumLabel !== undefined ? signalData.momentumLabel : null,
      regimeState: signalData.regimeState !== undefined ? signalData.regimeState : null,
      legacyLabel: signalData.legacyLabel !== undefined ? signalData.legacyLabel : null,
      signalStrengthScore: signalData.signalStrengthScore !== undefined ? signalData.signalStrengthScore : null,
      classifications: signalData.classifications ?? [],
      patternDetails: signalData.patternDetails ?? [],
      timeframeAlignment: signalData.timeframeAlignment ?? 0,
      agreementScore: signalData.agreementScore ?? 50,
      positionSize: signalData.positionSize ?? null,
    };
    this.signals.set(id, signal);
    return signal;
  }

  async getLatestSignals(limit = 10): Promise<Signal[]> {
    return Array.from(this.signals.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getTrades(status?: string): Promise<Trade[]> {
    let trades = Array.from(this.trades.values());
    if (status) {
      trades = trades.filter(trade => trade.status === status);
    }
    return trades.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
  }

  async createTrade(tradeData: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const trade: Trade = {
      ...tradeData,
      id,
      status: tradeData.status || 'OPEN',
      exitTime: tradeData.exitTime || null,
      exitPrice: tradeData.exitPrice || null,
      pnl: tradeData.pnl || null,
      commission: tradeData.commission || 0,
      signalId: tradeData.signalId ?? null,
    };
    this.trades.set(id, trade);
    return trade;
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<Trade> {
    const existingTrade = this.trades.get(id);
    if (!existingTrade) {
      throw new Error(`Trade with id ${id} not found`);
    }
    const updatedTrade = { ...existingTrade, ...updates };
    this.trades.set(id, updatedTrade);
    return updatedTrade;
  }

  async getStrategies(): Promise<Strategy[]> {
    return Array.from(this.strategies.values());
  }

  async createStrategy(strategyData: InsertStrategy): Promise<Strategy> {
    const id = randomUUID();
    const strategy: Strategy = {
      ...strategyData,
      id,
      isActive: strategyData.isActive !== undefined ? strategyData.isActive : true,
    };
    this.strategies.set(id, strategy);
    return strategy;
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    const existingStrategy = this.strategies.get(id);
    if (!existingStrategy) {
      throw new Error(`Strategy with id ${id} not found`);
    }
    const updatedStrategy = { ...existingStrategy, ...updates };
    this.strategies.set(id, updatedStrategy);
    return updatedStrategy;
  }

  async getBacktestResults(strategyId?: string): Promise<BacktestResult[]> {
    let results = Array.from(this.backtestResults.values());
    if (strategyId) {
      results = results.filter(result => result.strategyId === strategyId);
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createBacktestResult(resultData: InsertBacktestResult): Promise<BacktestResult> {
    const id = randomUUID();
    const result: BacktestResult = {
      id,
      strategyId: resultData.strategyId,
      performance: resultData.performance ?? {},
      equityCurve: resultData.equityCurve ?? [],
      monthlyReturns: resultData.monthlyReturns ?? [],
      startDate: resultData.startDate ?? new Date(),
      endDate: resultData.endDate ?? new Date(),
      initialCapital: resultData.initialCapital ?? 0,
      finalCapital: resultData.finalCapital ?? 0,
      createdAt: new Date(),
      metrics: resultData.metrics ?? {},
      trades: resultData.trades ?? [],
    };
    this.backtestResults.set(id, result);
    return result;
  }

  async deleteBacktestResult(id: string): Promise<void> {
    this.backtestResults.delete(id);
  }

  async getMarketSentiment(): Promise<MarketSentiment> {
    return {
      fearGreedIndex: 67,
      btcDominance: 51.2,
      totalMarketCap: 1680000000000,
      volume24h: 89200000000,
    };
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    return {
      totalValue: 0,
      availableCash: 0,
      invested: 0,
      dayChange: 0,
      dayChangePercent: 0,
    };
  }

    // Audit log persistence (in-memory fallback implementation)
    async createAuditLog(log: import("@shared/schema").InsertAuditLog): Promise<void> {
      const id = randomUUID();
      const ts = (log as any).timestamp ? new Date((log as any).timestamp) : new Date();
      const record = { ...log, id, timestamp: ts } as any;
      this.auditLogs.set(id, record);
    }

    async getAuditLogs(entityType?: string, entityId?: string, limit = 100): Promise<import("@shared/schema").InsertAuditLog[]> {
      let items = Array.from(this.auditLogs.values()) as any[];
      if (entityType) items = items.filter(i => i.entityType === entityType);
      if (entityId) items = items.filter(i => i.entityId === entityId);
      items = items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
      return items as import("@shared/schema").InsertAuditLog[];
    }

  async createSignalPerformance(performance: any): Promise<void> {
    // No-op
  }

  async updateSignalPerformance(signalId: string, updates: any): Promise<void> {
    // No-op
  }

  // Model metrics persistence for drift detection
  async createModelMetric(metric: InsertModelMetric): Promise<void> {
    const id = randomUUID();
    const record: ModelMetric = {
      id,
      modelName: metric.modelName,
      timestamp: new Date(),
      accuracy: metric.accuracy ?? null,
      precision: metric.precision ?? null,
      recall: metric.recall ?? null,
      driftScore: metric.driftScore ?? null,
      dataPoints: metric.dataPoints ?? 0,
      isStale: metric.isStale ?? false,
    } as any;
    this.modelMetrics.set(id, record);
  }

  async getLatestModelMetrics(modelName: string, limit = 10): Promise<ModelMetric[]> {
    let items = Array.from(this.modelMetrics.values()).filter(m => m.modelName === modelName);
    items = items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
    return items;
  }

  async getStaleModelMetrics(): Promise<ModelMetric[]> {
    return Array.from(this.modelMetrics.values()).filter(m => m.isStale === true).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export class DbStorage implements IStorage {
  private prisma: PrismaClient;
  private fallback: IStorage = new SimpleFallbackStorage();
  private isConnected: boolean = false;

  constructor() {
    this.prisma = new PrismaClient({
      errorFormat: 'minimal',
    });
    this.testConnection();
  }

  private getFallback(): IStorage {
    return this.fallback;
  }

  private async testConnection(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.isConnected = true;
      console.log('[DbStorage] Connected to PostgreSQL');
    } catch (error) {
      this.isConnected = false;
      console.warn('[DbStorage] Cannot connect to PostgreSQL, using in-memory fallback:', (error as any).message);
    }
  }

  async getMarketFrames(symbol: string, limit = 200): Promise<MarketFrame[]> {
    if (!this.isConnected) {
      return this.getFallback().getMarketFrames(symbol, limit);
    }
    try {
      return await this.prisma.marketFrame.findMany({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.warn('[DbStorage] Query failed, using fallback:', (error as any).message);
      return this.getFallback().getMarketFrames(symbol, limit);
    }
  }

  async createMarketFrame(frame: InsertMarketFrame): Promise<MarketFrame> {
    if (!this.isConnected) {
      return this.getFallback().createMarketFrame(frame);
    }
    try {
      // Ensure all required fields are present for Prisma
      // frame may not have all fields from Drizzle schema, so we provide defaults
      const safeFrame = {
        symbol: frame.symbol,
        timeframe: (frame as any).timeframe ?? 3600, // Default to 1h if not specified
        open: (frame as any).open ?? null,
        high: (frame as any).high ?? null,
        low: (frame as any).low ?? null,
        close: (frame as any).close ?? null,
        volume: frame.volume ?? 0,
        isFinal: (frame as any).isFinal ?? false,
        price: (frame as any).price ?? {},
        indicators: (frame as any).indicators ?? {},
        orderFlow: (frame as any).orderFlow ?? {},
        marketMicrostructure: (frame as any).marketMicrostructure ?? {},
      };

      return await this.prisma.marketFrame.create({
        data: safeFrame,
      });
    } catch (error) {
      console.warn('[DbStorage] Write failed, using fallback:', (error as any).message);
      return this.getFallback().createMarketFrame(frame);
    }
  }

  async getLatestMarketFrame(symbol: string): Promise<MarketFrame | undefined> {
    if (!this.isConnected) {
      return this.getFallback().getLatestMarketFrame(symbol);
    }
    try {
      const frame = await this.prisma.marketFrame.findFirst({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
      });
      return frame ?? undefined;
    } catch (error) {
      console.warn('[DbStorage] Query failed, using fallback:', (error as any).message);
      return this.getFallback().getLatestMarketFrame(symbol);
    }
  }

  async getSignals(symbol?: string, limit = 100): Promise<Signal[]> {
    if (!this.isConnected) {
      return this.getFallback().getSignals(symbol, limit);
    }
    try {
      const results = await this.prisma.signal.findMany({
        where: symbol ? { symbol } : undefined,
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
      return results.map((r: any) => ({
        ...r,
        type: r.type as "BUY" | "SELL" | "HOLD",
        classifications: r.classifications ?? [],
        patternDetails: r.patternDetails ?? [],
        timeframeAlignment: r.timeframeAlignment ?? 0,
        agreementScore: r.agreementScore ?? 50,
        positionSize: r.positionSize ?? null,
      }));
    } catch (error) {
      console.warn('[DbStorage] Query failed, using fallback:', (error as any).message);
      return this.getFallback().getSignals(symbol, limit);
    }
  }

  async createSignal(signalData: InsertSignal): Promise<Signal> {
    if (!this.isConnected) {
      return this.getFallback().createSignal(signalData);
    }
    try {
      // Ensure reasoning is a valid object for Prisma JSON field
      const safeSignal = {
        symbol: signalData.symbol,
        type: signalData.type as "BUY" | "SELL" | "HOLD",
        strength: signalData.strength,
        confidence: signalData.confidence,
        price: signalData.price,
        reasoning: signalData.reasoning ?? {},
        riskReward: signalData.riskReward,
        stopLoss: signalData.stopLoss,
        takeProfit: signalData.takeProfit,
        momentumLabel: (signalData as any).momentumLabel,
        regimeState: (signalData as any).regimeState,
        legacyLabel: (signalData as any).legacyLabel,
        signalStrengthScore: (signalData as any).signalStrengthScore,
        classifications: signalData.classifications ?? [],
        patternDetails: signalData.patternDetails ?? [],
        timeframeAlignment: signalData.timeframeAlignment ?? 0,
        agreementScore: signalData.agreementScore ?? 50,
        positionSize: signalData.positionSize ?? null,
        entryPrice: (signalData as any).entryPrice ?? signalData.price ?? 0, // Use provided entryPrice, fallback to price, or default to 0
      };
      
      const result = await this.prisma.signal.create({ data: safeSignal });
      return {
        ...result,
        type: result.type as "BUY" | "SELL" | "HOLD",
        classifications: (result as any).classifications ?? [],
        patternDetails: (result as any).patternDetails ?? [],
        timeframeAlignment: (result as any).timeframeAlignment ?? 0,
        agreementScore: (result as any).agreementScore ?? 50,
        positionSize: (result as any).positionSize ?? null,
      };
    } catch (error: any) {
      console.warn('[DbStorage] Write failed, using fallback:', (error as any).message);
      return this.getFallback().createSignal(signalData);
    }
  }

  async getLatestSignals(limit = 10): Promise<Signal[]> {
    if (!this.isConnected) {
      return this.getFallback().getLatestSignals(limit);
    }
    try {
      const results = await this.prisma.signal.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
      return results.map((r: any) => ({
        ...r,
        type: r.type as "BUY" | "SELL" | "HOLD",
        classifications: r.classifications ?? [],
        patternDetails: r.patternDetails ?? [],
        timeframeAlignment: r.timeframeAlignment ?? 0,
        agreementScore: r.agreementScore ?? 50,
        positionSize: r.positionSize ?? null,
      }));
    } catch (error) {
      console.warn('[DbStorage] Query failed, using fallback:', (error as any).message);
      return this.getFallback().getLatestSignals(limit);
    }
  }

  async getTrades(status?: string): Promise<Trade[]> {
    if (!this.isConnected) {
      return this.getFallback().getTrades(status);
    }
    try {
      // Use entryTime for ordering, as Trade does not have timestamp
      const results = await this.prisma.trade.findMany({
        where: status ? { status } : undefined,
        orderBy: { entryTime: 'desc' },
      });
      return results.map((r: any) => ({
        ...r,
        status: r.status as "OPEN" | "CLOSED" | "CANCELLED",
        signalId: (r as any).signalId ?? null,
      }));
    } catch (error) {
      console.warn('[DbStorage] Query failed, using fallback:', (error as any).message);
      return this.getFallback().getTrades(status);
    }
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    if (!this.isConnected) {
      return this.getFallback().createTrade(trade);
    }
    try {
      const result = await this.prisma.trade.create({ data: trade });
      return {
        ...result,
        status: result.status as "OPEN" | "CLOSED" | "CANCELLED",
        signalId: (result as any).signalId ?? null,
      };
    } catch (error) {
      console.warn('[DbStorage] Write failed, using fallback:', (error as any).message);
      return this.getFallback().createTrade(trade);
    }
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<Trade> {
    if (!this.isConnected) {
      return this.getFallback().updateTrade(id, updates);
    }
    try {
      const result = await this.prisma.trade.update({ where: { id }, data: updates });
      return {
        ...result,
        status: result.status as "OPEN" | "CLOSED" | "CANCELLED",
        signalId: (result as any).signalId ?? null,
      };
    } catch (error) {
      console.warn('[DbStorage] Write failed, using fallback:', (error as any).message);
      return this.getFallback().updateTrade(id, updates);
    }
  }

  async getStrategies(): Promise<Strategy[]> {
    if (!this.isConnected) {
      return this.getFallback().getStrategies();
    }
    try {
      return await this.prisma.strategy.findMany();
    } catch (error) {
      console.warn('[DbStorage] Query failed, using fallback:', (error as any).message);
      return this.getFallback().getStrategies();
    }
  }

  async createStrategy(strategy: InsertStrategy): Promise<Strategy> {
    if (!this.isConnected) {
      return this.getFallback().createStrategy(strategy);
    }
    try {
      const safeStrategy = {
        ...strategy,
        riskParams: JSON.parse(JSON.stringify(strategy.riskParams)),
        performance: JSON.parse(JSON.stringify(strategy.performance)),
      };
      return await this.prisma.strategy.create({ data: safeStrategy });
    } catch (error) {
      console.warn('[DbStorage] Write failed, using fallback:', (error as any).message);
      return this.getFallback().createStrategy(strategy);
    }
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    if (!this.isConnected) {
      return this.getFallback().updateStrategy(id, updates);
    }
    try {
      // Ensure riskParams and performance are valid JSON objects for Prisma
      const safeUpdates = {
        ...updates,
        riskParams: updates.riskParams ?? {},
        performance: updates.performance ?? {},
      };
      return await this.prisma.strategy.update({ where: { id }, data: safeUpdates });
    } catch (error) {
      console.warn('[DbStorage] Write failed, using fallback:', (error as any).message);
      return this.getFallback().updateStrategy(id, updates);
    }
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

  // Model metrics persistence
  async createModelMetric(metric: InsertModelMetric): Promise<void> {
    if (!this.isConnected) {
      return this.getFallback().createModelMetric(metric);
    }
    try {
      await (this.prisma as any).modelMetrics.create({ data: {
        modelName: metric.modelName,
        accuracy: metric.accuracy ?? null,
        precision: metric.precision ?? null,
        recall: metric.recall ?? null,
        driftScore: metric.driftScore ?? null,
        dataPoints: metric.dataPoints ?? 0,
        isStale: metric.isStale ?? false,
      }} as any);
    } catch (error) {
      console.warn('[DbStorage] Write failed for model metric, using fallback:', (error as any).message);
      return this.getFallback().createModelMetric(metric);
    }
  }

  async getLatestModelMetrics(modelName: string, limit = 10): Promise<ModelMetric[]> {
    if (!this.isConnected) {
      return this.getFallback().getLatestModelMetrics(modelName, limit);
    }
    try {
      const results = await (this.prisma as any).modelMetrics.findMany({
        where: { modelName },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
      return results as any;
    } catch (error) {
      console.warn('[DbStorage] Query failed for model metrics, using fallback:', (error as any).message);
      return this.getFallback().getLatestModelMetrics(modelName, limit);
    }
  }

  async getStaleModelMetrics(): Promise<ModelMetric[]> {
    if (!this.isConnected) {
      return this.getFallback().getStaleModelMetrics();
    }
    try {
      const results = await (this.prisma as any).modelMetrics.findMany({
        where: { isStale: true },
        orderBy: { timestamp: 'desc' },
      });
      return results as any;
    } catch (error) {
      console.warn('[DbStorage] Query failed for stale model metrics, using fallback:', (error as any).message);
      return this.getFallback().getStaleModelMetrics();
    }
  }

  // ScanRun persistence for scanner-analysis
  async createScanRun(scan: { scanId: string; timestamp: string; timeframe?: string; symbolCount?: number; payload: any; }): Promise<any> {
    const data = {
      scanId: scan.scanId,
      timestamp: new Date(scan.timestamp),
      timeframe: scan.timeframe ?? null,
      symbolCount: scan.symbolCount ?? (Array.isArray(scan.payload?.results) ? scan.payload.results.length : 0),
      payload: scan.payload ?? {}
    };
    return this.prisma.scanRun.create({ data });
  }

  async getRecentScanRuns(limit = 10): Promise<any[]> {
    const results = await this.prisma.scanRun.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return results;
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

  // Audit log persistence (DB-backed when available)
  async createAuditLog(log: import("@shared/schema").InsertAuditLog): Promise<void> {
    if (!this.isConnected) {
      return this.getFallback().createAuditLog(log);
    }
    try {
      const ts = (log as any).timestamp ? new Date((log as any).timestamp) : new Date();
      await (this.prisma as any).auditLogs.create({ data: {
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        userId: (log as any).userId ?? null,
        details: (log as any).details ?? {},
        severity: (log as any).severity ?? 'INFO',
        timestamp: ts,
      }} as any);
    } catch (error) {
      console.warn('[DbStorage] Write failed for audit log, using fallback:', (error as any).message);
      return this.getFallback().createAuditLog(log);
    }
  }

  async getAuditLogs(entityType?: string, entityId?: string, limit = 100): Promise<import("@shared/schema").InsertAuditLog[]> {
    if (!this.isConnected) {
      return this.getFallback().getAuditLogs(entityType, entityId, limit);
    }
    try {
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      const results = await (this.prisma as any).auditLogs.findMany({ where, orderBy: { timestamp: 'desc' }, take: limit });
      return results as any as import("@shared/schema").InsertAuditLog[];
    } catch (error) {
      console.warn('[DbStorage] Query failed for audit logs, using fallback:', (error as any).message);
      return this.getFallback().getAuditLogs(entityType, entityId, limit);
    }
  }

  /**
   * Generic raw query method for custom SQL queries
   */
  async query(sql: string, values?: any[]): Promise<{ rows: any[] }> {
    if (!this.isConnected) {
      console.warn('[DbStorage] Database not connected, cannot execute query');
      return { rows: [] };
    }
    try {
      const result = await (this.prisma as any).$queryRawUnsafe(sql, ...(values || []));
      return { rows: Array.isArray(result) ? result : [result] };
    } catch (error) {
      console.warn('[DbStorage] Raw query failed:', (error as any).message);
      return { rows: [] };
    }
  }
}

// Export singleton instance
export const db = new DbStorage();