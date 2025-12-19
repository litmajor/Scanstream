
import { EnhancedPortfolioSimulator, PositionSizeConfig } from './portfolio-simulator';
import { db } from './db-storage';
import type { Signal } from '@shared/schema';
import { EventEmitter } from 'events';
import { adaptiveHoldingIntegration } from './services/adaptive-holding-integration';
import { OrderFlowAnalyzer, orderFlowAnalyzer } from './services/order-flow-analyzer';
import { microstructureOptimizer } from './services/microstructure-exit-optimizer';
import { getLearningSystem } from './index';

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

  // Helper: simple RSI implementation (period default 14)
  private calculateRSI(closes: number[], period = 14): number {
    if (!closes || closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change; else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Helper: simple annualized volatility estimate from closes
  private estimateVolatility(closes: number[]): number {
    if (!closes || closes.length < 2) return 0.02;
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1 || 1);
    const dailyStd = Math.sqrt(variance);
    const annualized = dailyStd * Math.sqrt(252);
    return annualized;
  }

  // Helper: simple technical score from RSI and momentum (0-100)
  private computeTechnicalScore(closes: number[]): number {
    const rsi = this.calculateRSI(closes, 14);
    // momentum: normalized return over last 5 periods
    const N = Math.min(5, closes.length - 1);
    const momentum = N > 0 ? (closes[closes.length - 1] - closes[closes.length - 1 - N]) / closes[closes.length - 1 - N] : 0;
    const momentumScore = Math.max(-1, Math.min(1, momentum * 10)); // scale
    // technical score combines RSI (scaled) and momentum
    const score = Math.round(Math.min(100, Math.max(0, (rsi * 0.6) + ((momentumScore + 1) * 50 * 0.4))));
    return score;
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
        signalId: signal.id ?? null,
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

      // NEW: Initialize adaptive holding decision using real data (frames, order flow, microstructure, ML)
      try {
        const atr = executionPrice * 0.02; // initial ATR estimate

        // Fetch recent frames to compute indicators
        const frames = await db.getMarketFrames(signal.symbol, 120);
        const closes = frames && frames.length ? frames.map(f => (f as any).price?.close).filter((v: any) => typeof v === 'number') as number[] : [];

        const technicalScore = this.computeTechnicalScore(closes.length ? closes : [executionPrice]);
        const volatility = this.estimateVolatility(closes.length ? closes : [executionPrice]);

        // Order flow from latest frame
        const latestFrame = frames && frames.length ? frames[0] as any : undefined;
        const orderFlowData = latestFrame?.orderFlow ? {
          bidVolume: latestFrame.orderFlow.bidVolume || 0,
          askVolume: latestFrame.orderFlow.askVolume || 0,
          netFlow: latestFrame.orderFlow.netFlow || 0,
          spread: latestFrame.marketMicrostructure?.spread || 0,
          spreadPercent: latestFrame.marketMicrostructure?.spreadPercent || 0,
          volume: latestFrame.price?.volume || 0,
          volumeRatio: latestFrame.orderFlow?.volumeRatio
        } : { bidVolume: 0, askVolume: 0, netFlow: 0, spread: 0, spreadPercent: 0, volume: 0 };

        const orderFlowAnalysis = OrderFlowAnalyzer.analyzeOrderFlow(orderFlowData, trade.side === 'BUY' ? 'BUY' : 'SELL');
        const orderFlowScore = orderFlowAnalysis.orderFlowScore;

        // Microstructure analysis
        const microData = latestFrame?.marketMicrostructure ? {
          spread: latestFrame.marketMicrostructure.spread || 0,
          spreadPercent: latestFrame.marketMicrostructure.spreadPercent || 0,
          bidVolume: latestFrame.marketMicrostructure.bidVolume || 0,
          askVolume: latestFrame.marketMicrostructure.askVolume || 0,
          netFlow: latestFrame.orderFlow?.netFlow || 0,
          orderImbalance: latestFrame.marketMicrostructure.orderImbalance || 'BALANCED',
          volumeRatio: latestFrame.marketMicrostructure.volumeRatio || 1,
          bidAskRatio: latestFrame.marketMicrostructure.bidAskRatio || 1,
          price: executionPrice
        } : { spread: 0, spreadPercent: 0, bidVolume: 0, askVolume: 0, netFlow: 0, orderImbalance: 'BALANCED', volumeRatio: 1, bidAskRatio: 1, price: executionPrice };

        const microSignal = microstructureOptimizer.create().analyzeMicrostructure(microData, undefined, trade.side === 'BUY' ? 'BUY' : 'SELL');
        const microstructureHealth = microSignal.severity === 'CRITICAL' ? 0 : microSignal.severity === 'HIGH' ? 0.3 : microSignal.severity === 'MEDIUM' ? 0.6 : 1.0;
        const microstructureSignals = microSignal.signals || [];

        // Try to enhance ML probability via ML service (best-effort)
        let mlProbability = signal.confidence ?? 0.5;
        try {
          const resp = await fetch('http://localhost:3000/api/ml/enhance-signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signal })
          });
          if (resp.ok) {
            const enhanced = await resp.json();
            if (enhanced?.confidence) mlProbability = enhanced.confidence;
            else if (enhanced?.confidenceBreakdown && typeof enhanced.confidenceBreakdown.overall === 'number') mlProbability = enhanced.confidenceBreakdown.overall;
          }
        } catch (e) {
          // ignore and keep signal.confidence
        }

        const analysisInput = {
          symbol: trade.symbol,
          entryPrice: trade.entryPrice,
          currentPrice: trade.entryPrice,
          marketRegime: 'TRENDING' as const,
          orderFlowScore: orderFlowScore,
          microstructureHealth,
          momentumQuality: 0.6,
          volatility: volatility,
          technicalScore: technicalScore,
          mlProbability: mlProbability,
          microstructureSignals: microstructureSignals,
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
        if (latestFrame && Date.now() - new Date((latestFrame as any).timestamp).getTime() < 60000) {
          // Use DB price if less than 1 minute old
          const dbPrice = (latestFrame as any)?.price?.close;
          if (typeof dbPrice === 'number') {
            this.priceCache.set(symbol, dbPrice);
            continue;
          }
        }

        // Fallback branch
        if (!latestFrame) {
          // no DB frame, try gateway
        }
        else {
          // Fallback to live price from gateway if available
          try {
            const response = await fetch(`http://localhost:5000/api/gateway/ticker/${symbol}`);
            if (response.ok) {
              const ticker = await response.json();
              this.priceCache.set(symbol, ticker.last || ticker.close);
            } else if (latestFrame) {
              // Use stale DB price as last resort
              const stale = (latestFrame as any)?.price?.close;
              if (typeof stale === 'number') this.priceCache.set(symbol, stale);
            }
          } catch (fetchError) {
            // Network error, use stale DB price if available
            const stale = (latestFrame as any)?.price?.close;
            if (typeof stale === 'number') this.priceCache.set(symbol, stale);
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

      // Re-analyze holding decision using live market data and services
      // Fetch recent frames to compute indicators
      const frames = await db.getMarketFrames(trade.symbol, 200);
      const closes = frames && frames.length ? frames.map(f => (f as any).price?.close).filter((v: any) => typeof v === 'number') as number[] : [];
      const technicalScore = this.computeTechnicalScore(closes.length ? closes : [currentPrice]);
      const volatility = this.estimateVolatility(closes.length ? closes : [currentPrice]);

      const latestFrame = frames && frames.length ? frames[0] as any : undefined;
      const orderFlowData = latestFrame?.orderFlow ? {
        bidVolume: latestFrame.orderFlow.bidVolume || 0,
        askVolume: latestFrame.orderFlow.askVolume || 0,
        netFlow: latestFrame.orderFlow.netFlow || 0,
        spread: latestFrame.marketMicrostructure?.spread || 0,
        spreadPercent: latestFrame.marketMicrostructure?.spreadPercent || 0,
        volume: latestFrame.price?.volume || 0,
        volumeRatio: latestFrame.orderFlow?.volumeRatio
      } : { bidVolume: 0, askVolume: 0, netFlow: 0, spread: 0, spreadPercent: 0, volume: 0 };

      const orderFlowAnalysis = OrderFlowAnalyzer.analyzeOrderFlow(orderFlowData, trade.side === 'BUY' ? 'BUY' : 'SELL');
      const orderFlowScore = orderFlowAnalysis.orderFlowScore;

      const microData = latestFrame?.marketMicrostructure ? {
        spread: latestFrame.marketMicrostructure.spread || 0,
        spreadPercent: latestFrame.marketMicrostructure.spreadPercent || 0,
        bidVolume: latestFrame.marketMicrostructure.bidVolume || 0,
        askVolume: latestFrame.marketMicrostructure.askVolume || 0,
        netFlow: latestFrame.orderFlow?.netFlow || 0,
        orderImbalance: latestFrame.marketMicrostructure.orderImbalance || 'BALANCED',
        volumeRatio: latestFrame.marketMicrostructure.volumeRatio || 1,
        bidAskRatio: latestFrame.marketMicrostructure.bidAskRatio || 1,
        price: currentPrice
      } : { spread: 0, spreadPercent: 0, bidVolume: 0, askVolume: 0, netFlow: 0, orderImbalance: 'BALANCED', volumeRatio: 1, bidAskRatio: 1, price: currentPrice };

      const microSignal = microstructureOptimizer.create().analyzeMicrostructure(microData, undefined, trade.side === 'BUY' ? 'BUY' : 'SELL');
      const microstructureHealth = microSignal.severity === 'CRITICAL' ? 0 : microSignal.severity === 'HIGH' ? 0.3 : microSignal.severity === 'MEDIUM' ? 0.6 : 1.0;
      const microstructureSignals = microSignal.signals || [];

      // Best-effort ML probability enhancement (fallback to 0.5)
      let mlProbability = 0.5;
      try {
        if (trade.signalId) {
          const resp = await fetch('http://localhost:3000/api/ml/enhance-signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signalId: trade.signalId }) });
          if (resp.ok) {
            const json = await resp.json();
            mlProbability = json?.confidence ?? json?.confidenceBreakdown?.overall ?? mlProbability;
          }
        }
      } catch (e) {
        // ignore, keep default
      }

      const analysisInput = {
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        currentPrice: currentPrice,
        marketRegime: (trade.marketRegime || 'TRENDING') as 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CONSOLIDATING',
        orderFlowScore: orderFlowScore,
        microstructureHealth: microstructureHealth,
        momentumQuality: trade.momentumQuality || 0.6,
        volatility: volatility,
        technicalScore: technicalScore,
        mlProbability: mlProbability,
        microstructureSignals: microstructureSignals,
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
   * Close a trade and trigger learning system feedback
   */
  async closeTrade(
    tradeId: string, 
    exitPrice: number, 
    reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'SIGNAL' | 'ADAPTIVE_HOLDING'
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

    // ✅ NEW: Trigger learning system feedback
    try {
      const learningSystem = getLearningSystem();
      if (learningSystem) {
        // Estimate market regime based on trade metadata
        const market_regime = this.estimateMarketRegime(trade);
        
        // Create trade evidence context
        const tradeContext = {
          entry_confidence: trade.momentumQuality || 0.6,
          exit_confidence: 0.5,
          market_regime: market_regime as any,
          entry_quality_signal: 0.7,
          exit_timing_quality: this.calculateExitQuality(reason, pnlPercent),
          strategy_id: trade.source === 'ML' ? 'ml-direction-model' : 'rl-position-sizer'
        };

        // Process trade outcome through learning system
        const learningUpdate = await learningSystem.process_trade_outcome(
          trade as any,
          tradeContext,
          {
            prediction_accuracy: pnlPercent > 0 ? 1.0 : 0.0,
            confidence: trade.momentumQuality || 0.6,
            model_id: trade.source === 'ML' ? 'ml-direction-model' : 'rl-position-sizer'
          }
        );

        console.log(`[Learning] Trade ${tradeId} processed:`, {
          posterior_accuracy: learningUpdate.bayesian_update.posterior_accuracy.toFixed(4),
          weight: learningUpdate.bayesian_update.weight.toFixed(4),
          rl_reward: learningUpdate.rl_reward.toFixed(2),
          regime: learningUpdate.market_regime
        });
      }
    } catch (err) {
      console.error('[Learning] Error processing trade outcome:', err);
    }
  }

  /**
   * Estimate market regime from trade metadata
   */
  private estimateMarketRegime(trade: PaperTrade): string {
    if (!trade.marketRegime) {
      // Default: detect from momentum quality
      if ((trade.momentumQuality || 0) > 0.75) return 'TRENDING';
      if ((trade.momentumQuality || 0) < 0.35) return 'RANGING';
      if ((trade.microstructureHealth || 0) < 0.5) return 'VOLATILE';
      return 'NEUTRAL';
    }
    return trade.marketRegime;
  }

  /**
   * Calculate exit quality score based on exit reason and profitability
   */
  private calculateExitQuality(reason: string, pnlPercent: number): number {
    if (reason === 'TAKE_PROFIT') {
      // Good exit - hit profit target
      return Math.min(1.0, 0.85 + (pnlPercent / 10) * 0.15);
    } else if (reason === 'STOP_LOSS') {
      // Protected downside well
      return Math.max(0.3, 0.8 - Math.abs(pnlPercent) / 5);
    } else if (reason === 'SIGNAL') {
      // Based on exit signal quality
      return pnlPercent > 0 ? 0.8 : 0.5;
    } else if (reason === 'ADAPTIVE_HOLDING') {
      // Based on trend continuation
      return pnlPercent > 0 ? 0.75 : 0.55;
    }
    // MANUAL
    return pnlPercent > 0 ? 0.6 : 0.4;
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
      signalId: null,
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
