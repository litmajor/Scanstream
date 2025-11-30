
import { EnhancedPortfolioSimulator, PositionSizeConfig } from './portfolio-simulator';
import { db } from './db-storage';
import type { Signal } from '@shared/schema';
import { EventEmitter } from 'events';

interface PaperTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  entryTime: Date;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitTime?: Date;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'SIGNAL';
  pnl?: number;
  pnlPercent?: number;
  source: 'ML' | 'RL' | 'GATEWAY' | 'MANUAL';
  signalId?: string;
}

interface AutoExecutionConfig {
  enabled: boolean;
  sources: ('ML' | 'RL' | 'GATEWAY')[];
  minConfidence: number;
  maxPositionsPerSymbol: number;
  positionSizing: PositionSizeConfig;
  riskManagement: {
    useStopLoss: boolean;
    useTakeProfit: boolean;
    trailingStop: boolean;
    trailingStopPercent: number;
  };
}

export class PaperTradingEngine extends EventEmitter {
  private simulator: EnhancedPortfolioSimulator;
  private activeTrades: Map<string, PaperTrade> = new Map();
  private tradeHistory: PaperTrade[] = [];
  private config: AutoExecutionConfig;
  private priceCache: Map<string, number> = new Map();
  private isRunning: boolean = false;
  private monitorInterval?: NodeJS.Timeout;

  constructor(initialBalance: number = 10000) {
    super();
    this.simulator = new EnhancedPortfolioSimulator({
      initialCapital: initialBalance,
      commissionRate: 0.1,
      slippageRate: 0.05,
      maxPositionsPerSymbol: 3
    });

    this.config = {
      enabled: false,
      sources: ['ML', 'RL', 'GATEWAY'],
      minConfidence: 0.6,
      maxPositionsPerSymbol: 1,
      positionSizing: {
        type: 'percentage',
        value: 10, // 10% of capital per trade
        maxRisk: 2 // Max 2% risk per trade
      },
      riskManagement: {
        useStopLoss: true,
        useTakeProfit: true,
        trailingStop: false,
        trailingStopPercent: 2.0
      }
    };

    this.simulator.setPositionSizing(this.config.positionSizing);
  }

  /**
   * Start auto-execution engine
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.config.enabled = true;

    // Monitor signals every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.processNewSignals();
      this.updateOpenPositions();
    }, 5000);

    this.emit('started');
    console.log('[Paper Trading] Engine started');
  }

  /**
   * Stop auto-execution engine
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.config.enabled = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    this.emit('stopped');
    console.log('[Paper Trading] Engine stopped');
  }

  /**
   * Process new signals and auto-execute if conditions are met
   */
  private async processNewSignals(): Promise<void> {
    try {
      const signals = await db.getLatestSignals(20);
      
      for (const signal of signals) {
        if (!this.shouldExecuteSignal(signal)) continue;

        const source = this.determineSignalSource(signal);
        if (!this.config.sources.includes(source)) continue;

        await this.executeSignal(signal, source);
      }
    } catch (error) {
      console.error('[Paper Trading] Error processing signals:', error);
    }
  }

  /**
   * Determine if signal should be executed
   */
  private shouldExecuteSignal(signal: Signal): boolean {
    // Check confidence threshold
    if (signal.confidence < this.config.minConfidence) return false;

    // Check if already have max positions for this symbol
    const symbolPositions = Array.from(this.activeTrades.values())
      .filter(t => t.symbol === signal.symbol && t.status === 'OPEN');
    
    if (symbolPositions.length >= this.config.maxPositionsPerSymbol) return false;

    // Check if signal is recent (within last 2 minutes)
    const signalAge = Date.now() - new Date(signal.timestamp).getTime();
    if (signalAge > 120000) return false; // Skip signals older than 2 minutes

    // Check if we already executed this signal
    const alreadyExecuted = this.tradeHistory.some(t => t.signalId === signal.id);
    if (alreadyExecuted) return false;

    return true;
  }

  /**
   * Determine signal source (ML, RL, or GATEWAY)
   */
  private determineSignalSource(signal: Signal): 'ML' | 'RL' | 'GATEWAY' {
    // Check reasoning for source indicators
    const reasoning = Array.isArray(signal.reasoning) 
      ? signal.reasoning.join(' ') 
      : String(signal.reasoning);

    if (reasoning.includes('ML prediction') || reasoning.includes('LSTM')) {
      return 'ML';
    } else if (reasoning.includes('Position size:') || reasoning.includes('Risk/Reward:')) {
      return 'RL';
    } else {
      return 'GATEWAY';
    }
  }

  /**
   * Execute a signal and open a paper trade
   */
  private async executeSignal(signal: Signal, source: 'ML' | 'RL' | 'GATEWAY'): Promise<void> {
    try {
      const price = signal.price;
      const stopLoss = signal.stopLoss || price * (signal.type === 'BUY' ? 0.98 : 1.02);
      const takeProfit = signal.takeProfit || price * (signal.type === 'BUY' ? 1.05 : 0.95);

      // Open position in simulator
      const success = this.simulator.openPosition({
        id: `${signal.symbol}-${Date.now()}`,
        symbol: signal.symbol,
        side: signal.type === 'BUY' ? 'BUY' : 'SELL',
        entryTime: new Date(),
        entryPrice: price,
        commission: 0,
        status: 'OPEN',
        exitTime: null,
        exitPrice: null,
        pnl: null
      }, stopLoss);

      if (!success) {
        console.log(`[Paper Trading] Failed to open position for ${signal.symbol}`);
        return;
      }

      // Get the actual position that was opened
      const positions = this.simulator.getOpenPositions();
      const openedPosition = positions[positions.length - 1];

      // Create paper trade record
      const trade: PaperTrade = {
        id: openedPosition.id,
        symbol: signal.symbol,
        side: signal.type === 'BUY' ? 'BUY' : 'SELL',
        entryPrice: openedPosition.entryPrice,
        entryTime: openedPosition.entryTime instanceof Date 
          ? openedPosition.entryTime 
          : new Date(openedPosition.entryTime),
        quantity: openedPosition.quantity,
        stopLoss,
        takeProfit,
        status: 'OPEN',
        source,
        signalId: signal.id
      };

      this.activeTrades.set(trade.id, trade);
      this.emit('tradeOpened', trade);

      console.log(`[Paper Trading] Opened ${trade.side} position for ${trade.symbol} at $${trade.entryPrice.toFixed(2)}`);
    } catch (error) {
      console.error('[Paper Trading] Error executing signal:', error);
    }
  }

  /**
   * Update open positions and check stop-loss/take-profit
   */
  private async updateOpenPositions(): Promise<void> {
    const activeTrades = Array.from(this.activeTrades.values())
      .filter(t => t.status === 'OPEN');

    if (activeTrades.length === 0) return;

    // Fetch current prices
    await this.updatePrices(activeTrades.map(t => t.symbol));

    for (const trade of activeTrades) {
      const currentPrice = this.priceCache.get(trade.symbol);
      if (!currentPrice) continue;

      // Check stop loss
      if (this.config.riskManagement.useStopLoss) {
        const stopHit = trade.side === 'BUY' 
          ? currentPrice <= trade.stopLoss
          : currentPrice >= trade.stopLoss;

        if (stopHit) {
          await this.closeTrade(trade.id, currentPrice, 'STOP_LOSS');
          continue;
        }
      }

      // Check take profit
      if (this.config.riskManagement.useTakeProfit) {
        const tpHit = trade.side === 'BUY'
          ? currentPrice >= trade.takeProfit
          : currentPrice <= trade.takeProfit;

        if (tpHit) {
          await this.closeTrade(trade.id, currentPrice, 'TAKE_PROFIT');
          continue;
        }
      }

      // Update trailing stop
      if (this.config.riskManagement.trailingStop) {
        this.updateTrailingStop(trade, currentPrice);
      }
    }
  }

  /**
   * Update prices from latest market data
   */
  private async updatePrices(symbols: string[]): Promise<void> {
    try {
      const uniqueSymbols = [...new Set(symbols)];
      
      for (const symbol of uniqueSymbols) {
        const latestFrame = await db.getLatestMarketFrame(symbol);
        if (latestFrame) {
          this.priceCache.set(symbol, latestFrame.price.close);
        }
      }
    } catch (error) {
      console.error('[Paper Trading] Error updating prices:', error);
    }
  }

  /**
   * Update trailing stop loss
   */
  private updateTrailingStop(trade: PaperTrade, currentPrice: number): void {
    const trailPercent = this.config.riskManagement.trailingStopPercent / 100;

    if (trade.side === 'BUY') {
      const newStop = currentPrice * (1 - trailPercent);
      if (newStop > trade.stopLoss) {
        trade.stopLoss = newStop;
        this.emit('stopLossUpdated', trade);
      }
    } else {
      const newStop = currentPrice * (1 + trailPercent);
      if (newStop < trade.stopLoss) {
        trade.stopLoss = newStop;
        this.emit('stopLossUpdated', trade);
      }
    }
  }

  /**
   * Close a trade
   */
  async closeTrade(
    tradeId: string, 
    exitPrice: number, 
    reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'SIGNAL'
  ): Promise<void> {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status === 'CLOSED') return;

    // Close position in simulator
    const success = this.simulator.closePosition(
      trade.symbol,
      exitPrice,
      new Date(),
      trade.quantity
    );

    if (!success) {
      console.log(`[Paper Trading] Failed to close position ${tradeId}`);
      return;
    }

    // Calculate P&L
    const pnl = trade.side === 'BUY'
      ? (exitPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - exitPrice) * trade.quantity;

    const pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;

    // Update trade record
    trade.status = 'CLOSED';
    trade.exitPrice = exitPrice;
    trade.exitTime = new Date();
    trade.exitReason = reason;
    trade.pnl = pnl;
    trade.pnlPercent = pnlPercent;

    this.tradeHistory.push(trade);
    this.activeTrades.delete(tradeId);

    this.emit('tradeClosed', trade);

    console.log(`[Paper Trading] Closed ${trade.symbol} ${trade.side} at $${exitPrice.toFixed(2)} (${reason}) - P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
  }

  /**
   * Manual trade execution
   */
  async executeManuaTrade(
    symbol: string,
    side: 'BUY' | 'SELL',
    price: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<string | null> {
    const sl = stopLoss || price * (side === 'BUY' ? 0.98 : 1.02);
    const tp = takeProfit || price * (side === 'BUY' ? 1.05 : 0.95);

    const success = this.simulator.openPosition({
      id: `manual-${symbol}-${Date.now()}`,
      symbol,
      side,
      entryTime: new Date(),
      entryPrice: price,
      commission: 0,
      status: 'OPEN',
      exitTime: null,
      exitPrice: null,
      pnl: null
    }, sl);

    if (!success) return null;

    const positions = this.simulator.getOpenPositions();
    const openedPosition = positions[positions.length - 1];

    const trade: PaperTrade = {
      id: openedPosition.id,
      symbol,
      side,
      entryPrice: openedPosition.entryPrice,
      entryTime: openedPosition.entryTime instanceof Date 
        ? openedPosition.entryTime 
        : new Date(openedPosition.entryTime),
      quantity: openedPosition.quantity,
      stopLoss: sl,
      takeProfit: tp,
      status: 'OPEN',
      source: 'MANUAL'
    };

    this.activeTrades.set(trade.id, trade);
    this.emit('tradeOpened', trade);

    return trade.id;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AutoExecutionConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.positionSizing) {
      this.simulator.setPositionSizing(updates.positionSizing);
    }
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current status
   */
  getStatus() {
    const metrics = this.simulator.getPerformanceMetrics();
    
    return {
      isRunning: this.isRunning,
      balance: this.simulator.getCurrentBalance(),
      openPositions: this.activeTrades.size,
      totalTrades: this.tradeHistory.length,
      metrics,
      activeTrades: Array.from(this.activeTrades.values()),
      recentTrades: this.tradeHistory.slice(-10),
      config: this.config
    };
  }

  /**
   * Reset simulator
   */
  reset(initialBalance?: number): void {
    this.stop();
    this.activeTrades.clear();
    this.tradeHistory = [];
    this.priceCache.clear();
    
    if (initialBalance) {
      this.simulator = new EnhancedPortfolioSimulator({
        initialCapital: initialBalance,
        commissionRate: 0.1,
        slippageRate: 0.05,
        maxPositionsPerSymbol: 3
      });
      this.simulator.setPositionSizing(this.config.positionSizing);
    } else {
      this.simulator.reset();
    }

    this.emit('reset');
  }

  /**
   * Export data
   */
  exportData() {
    return {
      trades: this.tradeHistory,
      equityCurve: this.simulator.getEquityCurve(),
      metrics: this.simulator.getPerformanceMetrics(),
      drawdowns: this.simulator.getDrawdownPeriods()
    };
  }
}

// Singleton instance
export const paperTradingEngine = new PaperTradingEngine(10000);
