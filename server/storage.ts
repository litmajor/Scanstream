import { type MarketFrame, type Signal, type Trade, type Strategy, type BacktestResult, type InsertMarketFrame, type InsertSignal, type InsertTrade, type InsertStrategy, type InsertBacktestResult, type MarketSentiment, type PortfolioSummary } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Market data
  getMarketFrames(symbol: string, limit?: number): Promise<MarketFrame[]>;
  createMarketFrame(frame: InsertMarketFrame): Promise<MarketFrame>;
  getLatestMarketFrame(symbol: string): Promise<MarketFrame | undefined>;
  
  // Signals
  getSignals(symbol?: string, limit?: number): Promise<Signal[]>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  getLatestSignals(limit?: number): Promise<Signal[]>;
  
  // Trades
  getTrades(status?: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, updates: Partial<Trade>): Promise<Trade>;
  
  // Strategies
  getStrategies(): Promise<Strategy[]>;
  createStrategy(strategy: InsertStrategy): Promise<Strategy>;
  updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy>;
  
  // Backtest results
  getBacktestResults(strategyId?: string): Promise<BacktestResult[]>;
  createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;
  
  // Market metrics
  getMarketSentiment(): Promise<MarketSentiment>;
  getPortfolioSummary(): Promise<PortfolioSummary>;
}

export class MemStorage implements IStorage {
  private marketFrames: Map<string, MarketFrame> = new Map();
  private signals: Map<string, Signal> = new Map();
  private trades: Map<string, Trade> = new Map();
  private strategies: Map<string, Strategy> = new Map();
  private backtestResults: Map<string, BacktestResult> = new Map();

  async getMarketFrames(symbol: string, limit = 100): Promise<MarketFrame[]> {
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

  async getMarketSentiment(): Promise<MarketSentiment> {
    return {
      fearGreedIndex: 67,
      btcDominance: 51.2,
      totalMarketCap: 1680000000000, // $1.68T
      volume24h: 89200000000, // $89.2B
    };
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const openTrades = await this.getTrades('OPEN');
    const totalInvested = openTrades.reduce((sum, trade) => sum + (trade.entryPrice * trade.quantity), 0);
    
    return {
      totalValue: 127543.89,
      availableCash: 23456.78,
      invested: totalInvested || 104087.11,
      dayChange: 5892.31,
      dayChangePercent: 4.84,
    };
  }

  // Signal Performance Tracking
  private signalPerformances: Map<string, any> = new Map();

  async createSignalPerformance(performance: any): Promise<void> {
    this.signalPerformances.set(performance.signalId, performance);
  }

  async updateSignalPerformance(signalId: string, updates: any): Promise<void> {
    const existing = this.signalPerformances.get(signalId);
    if (existing) {
      this.signalPerformances.set(signalId, { ...existing, ...updates });
    }
  }

  async getSignalPerformance(signalId: string): Promise<any> {
    return this.signalPerformances.get(signalId);
  }

  async getAllSignalPerformances(): Promise<any[]> {
    return Array.from(this.signalPerformances.values());
  }
}

import { DbStorage } from './db-storage';
export const storage = new DbStorage();
