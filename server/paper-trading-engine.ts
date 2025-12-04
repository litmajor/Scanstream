
import { EnhancedPortfolioSimulator, PositionSizeConfig } from './portfolio-simulator';
import { db } from './db-storage';
import type { Signal } from '@shared/schema';
import { EventEmitter } from 'events';
import { adaptiveHoldingIntegration } from './services/adaptive-holding-integration';

interface HoldingDecisionMetadata {
  holdingPeriodDays: number;
  institutionalConvictionLevel: 'STRONG' | 'MODERATE' | 'WEAK' | 'REVERSING';
  trailStopMultiplier: number;
  daysHeld?: number;
  nextReviewTime?: Date;
  lastAnalysisTime?: Date;
  action: 'HOLD' | 'REDUCE' | 'EXIT';
  recommendation?: string;
}

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
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'SIGNAL' | 'ADAPTIVE_HOLDING';
  pnl?: number;
  pnlPercent?: number;
  source: 'ML' | 'RL' | 'GATEWAY' | 'MANUAL';
  signalId?: string;
  // NEW: Adaptive holding metadata
  holdingDecision?: HoldingDecisionMetadata;
  marketRegime?: string;
  orderFlowScore?: number;
  microstructureHealth?: number;
  momentumQuality?: number;
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
   * Execute a signal and open a paper trade with realistic slippage
   */
  private async executeSignal(signal: Signal, source: 'ML' | 'RL' | 'GATEWAY'): Promise<void> {
    try {
      // Simulate realistic execution slippage (0.05% - 0.15% depending on volatility)
      const baseSlippage = 0.0005; // 0.05%
      const volatilitySlippage = Math.random() * 0.001; // Up to 0.1% additional
      const slippageMultiplier = signal.type === 'BUY' ? (1 + baseSlippage + volatilitySlippage) : (1 - baseSlippage - volatilitySlippage);
      
      const executionPrice = signal.price * slippageMultiplier;
      const stopLoss = signal.stopLoss || executionPrice * (signal.type === 'BUY' ? 0.98 : 1.02);
      const takeProfit = signal.takeProfit || executionPrice * (signal.type === 'BUY' ? 1.05 : 0.95);

      // Open position in simulator with realistic execution price
      const success = this.simulator.openPosition({
        id: `${signal.symbol}-${Date.now()}`,
        symbol: signal.symbol,
        side: signal.type === 'BUY' ? 'BUY' : 'SELL',
        entryTime: new Date(),
        entryPrice: executionPrice,
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

      // NEW: Initialize adaptive holding decision
      try {
        const atr = price * 0.02; // Approximate ATR as 2% of price
        const analysisInput = {
          symbol: trade.symbol,
          entryPrice: trade.entryPrice,
          currentPrice: trade.entryPrice,
          marketRegime: 'TRENDING', // Will be updated later
          orderFlowScore: 0.5, // Will be updated with actual data
          microstructureHealth: 0.75,
          momentumQuality: 0.6,
          volatilityLabel: 'MEDIUM',
          trendDirection: trade.side === 'BUY' ? 'BULLISH' : 'BEARISH',
          atr: atr,
          timeHeldHours: 0,
          profitPercent: 0
        };

        const holdingResult = adaptiveHoldingIntegration.analyzeHolding(analysisInput);
        
        trade.holdingDecision = {
          holdingPeriodDays: holdingResult.holdingDecision.holdingPeriodDays,
          institutionalConvictionLevel: holdingResult.holdingDecision.institutionalConvictionLevel,
          trailStopMultiplier: holdingResult.holdingDecision.trailStopMultiplier,
          daysHeld: 0,
          action: holdingResult.holdingDecision.action,
          recommendation: holdingResult.holdingDecision.recommendation,
          lastAnalysisTime: new Date(),
          nextReviewTime: new Date(Date.now() + 4 * 3600000) // Review in 4 hours
        };

        console.log(
          `[Adaptive Hold] Initialized for ${trade.symbol}: ${trade.holdingDecision.holdingPeriodDays} day target, ` +
          `${trade.holdingDecision.institutionalConvictionLevel} conviction`
        );
      } catch (holdingError) {
        console.warn(`[Adaptive Hold] Could not initialize for ${trade.symbol}:`, holdingError);
        // Continue without adaptive holding
      }

      this.activeTrades.set(trade.id, trade);
      this.emit('tradeOpened', trade);

      const slippageBps = Math.abs((executionPrice - signal.price) / signal.price * 10000);
      console.log(
        `[Paper Trading] Opened ${trade.side} position for ${trade.symbol} ` +
        `at $${trade.entryPrice.toFixed(2)} (signal: $${signal.price.toFixed(2)}, slippage: ${slippageBps.toFixed(1)}bps)`
      );
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

      // Estimate ATR for holding decision (simplified: ~2% of price)
      const atr = currentPrice * 0.02;

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

      // NEW: Analyze adaptive holding period
      await this.analyzeAdaptiveHolding(trade, currentPrice, atr);
    }
  }

  /**
   * Update prices from latest market data with fallback to exchange data
   */
  private async updatePrices(symbols: string[]): Promise<void> {
    try {
      const uniqueSymbols = [...new Set(symbols)];
      
      for (const symbol of uniqueSymbols) {
        // Try database first (faster)
        const latestFrame = await db.getLatestMarketFrame(symbol);
        if (latestFrame && Date.now() - new Date(latestFrame.timestamp).getTime() < 60000) {
          // Use DB price if less than 1 minute old
          this.priceCache.set(symbol, latestFrame.price.close);
        } else {
          // Fallback to live price from gateway if available
          try {
            const response = await fetch(`http://localhost:5000/api/gateway/ticker/${symbol}`);
            if (response.ok) {
              const ticker = await response.json();
              this.priceCache.set(symbol, ticker.last || ticker.close);
            } else if (latestFrame) {
              // Use stale DB price as last resort
              this.priceCache.set(symbol, latestFrame.price.close);
            }
          } catch (fetchError) {
            // Network error, use stale DB price if available
            if (latestFrame) {
              this.priceCache.set(symbol, latestFrame.price.close);
            }
          }
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
   * Analyze adaptive holding period for a position
   * Phase 3.2: Position Manager Integration
   */
  private async analyzeAdaptiveHolding(
    trade: PaperTrade,
    currentPrice: number,
    atr: number
  ): Promise<void> {
    try {
      // Skip if no holding decision metadata yet
      if (!trade.holdingDecision) {
        return;
      }

      // Calculate time held
      const daysHeld = (Date.now() - trade.entryTime.getTime()) / (1000 * 60 * 60 * 24);
      const profitPercent = trade.side === 'BUY'
        ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
        : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

      // Only re-analyze every 4 hours (3600000ms * 4)
      const lastAnalysis = trade.holdingDecision.lastAnalysisTime || trade.entryTime;
      if (Date.now() - lastAnalysis.getTime() < 3600000 * 4) {
        return;
      }

      // Re-analyze holding decision
      const analysisInput = {
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        currentPrice: currentPrice,
        marketRegime: trade.marketRegime || 'TRENDING',
        orderFlowScore: trade.orderFlowScore || 0.5,
        microstructureHealth: trade.microstructureHealth || 0.75,
        momentumQuality: trade.momentumQuality || 0.6,
        volatilityLabel: 'MEDIUM',
        trendDirection: trade.side === 'BUY' ? 'BULLISH' : 'BEARISH',
        atr: atr,
        timeHeldHours: daysHeld * 24,
        profitPercent: profitPercent
      };

      const result = adaptiveHoldingIntegration.analyzeHolding(analysisInput);

      // Update holding decision metadata
      trade.holdingDecision = {
        holdingPeriodDays: result.holdingDecision.holdingPeriodDays,
        institutionalConvictionLevel: result.holdingDecision.institutionalConvictionLevel,
        trailStopMultiplier: result.holdingDecision.trailStopMultiplier,
        daysHeld: daysHeld,
        action: result.holdingDecision.action,
        recommendation: result.holdingDecision.recommendation,
        lastAnalysisTime: new Date(),
        nextReviewTime: new Date(Date.now() + 4 * 3600000) // 4 hours
      };

      console.log(`[Adaptive Hold] ${trade.symbol}: ${trade.holdingDecision.recommendation}`);

      // Apply adaptive holding decision
      switch (result.holdingDecision.action) {
        case 'EXIT':
          // Force exit on REVERSING conviction or time exceeded
          if (profitPercent > 0) {
            // Take profit if in gain
            await this.closeTrade(trade.id, currentPrice, 'ADAPTIVE_HOLDING');
          } else if (daysHeld > trade.holdingDecision.holdingPeriodDays) {
            // Time's up, exit with loss
            await this.closeTrade(trade.id, currentPrice, 'ADAPTIVE_HOLDING');
          }
          break;

        case 'REDUCE':
          // Reduce position by 50%
          trade.quantity = trade.quantity * 0.5;
          console.log(`[Adaptive Hold] REDUCE position for ${trade.symbol}: 50% reduction`);
          this.emit('positionReduced', trade);
          break;

        case 'HOLD':
        default:
          // Adjust trailing stop based on conviction
          const trailDistance = atr * result.holdingDecision.trailStopMultiplier;
          const adaptiveStop = trade.side === 'BUY'
            ? currentPrice - trailDistance
            : currentPrice + trailDistance;

          if (trade.side === 'BUY' && adaptiveStop > trade.stopLoss) {
            trade.stopLoss = adaptiveStop;
          } else if (trade.side === 'SELL' && adaptiveStop < trade.stopLoss) {
            trade.stopLoss = adaptiveStop;
          }

          console.log(
            `[Adaptive Hold] ${trade.symbol}: ${result.holdingDecision.institutionalConvictionLevel} conviction, ` +
            `trail multiplier: ${result.holdingDecision.trailStopMultiplier.toFixed(2)}x ATR`
          );
          break;
      }

      this.emit('holdingDecisionAnalyzed', {
        tradeId: trade.id,
        decision: trade.holdingDecision,
        profitPercent,
        daysHeld
      });
    } catch (error) {
      console.error(`[Adaptive Hold] Error analyzing holding for ${trade.symbol}:`, error);
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
