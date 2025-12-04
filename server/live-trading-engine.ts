
import * as ccxt from 'ccxt';
import { EventEmitter } from 'events';
import { db } from './db-storage';
import type { Signal } from '@shared/schema';

interface LiveOrder {
  id: string;
  exchangeOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  price?: number;
  amount: number;
  status: 'pending' | 'open' | 'closed' | 'canceled' | 'expired' | 'rejected';
  filled: number;
  remaining: number;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
  };
  timestamp: number;
  signalId?: string;
}

interface LivePosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: number;
  marginUsed: number;
  liquidationPrice?: number;
  orders: LiveOrder[];
}

interface ExecutionConfig {
  enabled: boolean;
  exchange: string;
  testMode: boolean; // Use exchange sandbox
  maxPositionSize: number; // Max USD per position
  maxTotalExposure: number; // Max total USD exposure
  defaultLeverage: number;
  slippageTolerance: number; // Max acceptable slippage %
  minConfidence: number;
}

export class LiveTradingEngine extends EventEmitter {
  private exchange: ccxt.Exchange | null = null;
  private positions: Map<string, LivePosition> = new Map();
  private orders: Map<string, LiveOrder> = new Map();
  private isRunning: boolean = false;
  private monitorInterval?: NodeJS.Timeout;
  private config: ExecutionConfig;

  constructor(config?: Partial<ExecutionConfig>) {
    super();
    this.config = {
      enabled: false,
      exchange: 'binance',
      testMode: true, // Always start in test mode
      maxPositionSize: 1000,
      maxTotalExposure: 5000,
      defaultLeverage: 1,
      slippageTolerance: 0.5,
      minConfidence: 0.7,
      ...config
    };
  }

  /**
   * Initialize exchange connection
   */
  async initialize(): Promise<void> {
    try {
      const exchangeName = this.config.exchange;
      const ExchangeClass = ccxt[exchangeName as keyof typeof ccxt] as any;
      
      if (!ExchangeClass) {
        throw new Error(`Exchange ${exchangeName} not supported`);
      }

      this.exchange = new ExchangeClass({
        apiKey: process.env[`${exchangeName.toUpperCase()}_API_KEY`],
        secret: process.env[`${exchangeName.toUpperCase()}_SECRET`],
        enableRateLimit: true,
        options: {
          defaultType: 'future', // Use futures for leverage
          ...(this.config.testMode && { sandbox: true })
        }
      });

      await this.exchange.loadMarkets();
      
      console.log(
        `[Live Trading] Connected to ${exchangeName} ` +
        `(${this.config.testMode ? 'TESTNET' : 'LIVE'})`
      );

      this.emit('initialized', { exchange: exchangeName, testMode: this.config.testMode });
    } catch (error: any) {
      console.error('[Live Trading] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start live trading engine
   */
  async start(): Promise<void> {
    if (!this.exchange) {
      await this.initialize();
    }

    this.isRunning = true;
    this.config.enabled = true;

    // Monitor positions and orders every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.updatePositions();
      this.checkOrders();
    }, 5000);

    this.emit('started');
    console.log('[Live Trading] Engine started');
  }

  /**
   * Stop live trading engine
   */
  stop(): void {
    this.isRunning = false;
    this.config.enabled = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.emit('stopped');
    console.log('[Live Trading] Engine stopped');
  }

  /**
   * Execute a signal on the live exchange
   */
  async executeSignal(signal: Signal): Promise<LiveOrder | null> {
    if (!this.exchange || !this.config.enabled) {
      console.log('[Live Trading] Engine not enabled');
      return null;
    }

    // Safety checks
    if (signal.confidence < this.config.minConfidence) {
      console.log(`[Live Trading] Signal confidence too low: ${signal.confidence}`);
      return null;
    }

    const totalExposure = this.getTotalExposure();
    if (totalExposure >= this.config.maxTotalExposure) {
      console.log(`[Live Trading] Max exposure reached: $${totalExposure}`);
      return null;
    }

    try {
      // Calculate position size (simplified - use dynamic sizing in production)
      const positionSizeUSD = Math.min(
        this.config.maxPositionSize,
        this.config.maxTotalExposure - totalExposure
      );
      const amount = positionSizeUSD / signal.price;

      // Place market order
      const order = await this.exchange.createOrder(
        signal.symbol,
        'market',
        signal.type.toLowerCase() as 'buy' | 'sell',
        amount
      );

      const liveOrder: LiveOrder = {
        id: `order-${Date.now()}`,
        exchangeOrderId: order.id,
        symbol: signal.symbol,
        side: signal.type.toLowerCase() as 'buy' | 'sell',
        type: 'market',
        amount,
        status: order.status as any,
        filled: order.filled || 0,
        remaining: order.remaining || amount,
        cost: order.cost || 0,
        fee: order.fee,
        timestamp: order.timestamp || Date.now(),
        signalId: signal.id
      };

      this.orders.set(liveOrder.id, liveOrder);
      this.emit('orderPlaced', liveOrder);

      // Place stop-loss and take-profit orders
      if (signal.stopLoss) {
        await this.placeStopLoss(signal.symbol, signal.type, amount, signal.stopLoss);
      }
      if (signal.takeProfit) {
        await this.placeTakeProfit(signal.symbol, signal.type, amount, signal.takeProfit);
      }

      console.log(
        `[Live Trading] Order placed: ${signal.type} ${amount.toFixed(4)} ${signal.symbol} ` +
        `@ market (signal confidence: ${(signal.confidence * 100).toFixed(0)}%)`
      );

      return liveOrder;
    } catch (error: any) {
      console.error('[Live Trading] Order execution failed:', error);
      this.emit('orderError', { signal, error: error.message });
      return null;
    }
  }

  /**
   * Place stop-loss order
   */
  private async placeStopLoss(symbol: string, side: string, amount: number, stopPrice: number): Promise<void> {
    if (!this.exchange) return;

    try {
      const stopSide = side === 'BUY' ? 'sell' : 'buy';
      await this.exchange.createOrder(
        symbol,
        'stop',
        stopSide,
        amount,
        undefined,
        { stopPrice }
      );
      console.log(`[Live Trading] Stop-loss placed at $${stopPrice.toFixed(2)}`);
    } catch (error) {
      console.error('[Live Trading] Failed to place stop-loss:', error);
    }
  }

  /**
   * Place take-profit order
   */
  private async placeTakeProfit(symbol: string, side: string, amount: number, tpPrice: number): Promise<void> {
    if (!this.exchange) return;

    try {
      const tpSide = side === 'BUY' ? 'sell' : 'buy';
      await this.exchange.createOrder(
        symbol,
        'limit',
        tpSide,
        amount,
        tpPrice
      );
      console.log(`[Live Trading] Take-profit placed at $${tpPrice.toFixed(2)}`);
    } catch (error) {
      console.error('[Live Trading] Failed to place take-profit:', error);
    }
  }

  /**
   * Update positions with current prices
   */
  private async updatePositions(): Promise<void> {
    if (!this.exchange) return;

    try {
      const positions = await this.exchange.fetchPositions();
      
      for (const pos of positions) {
        if (Math.abs(pos.contracts || 0) > 0) {
          const livePos: LivePosition = {
            id: `${pos.symbol}-${pos.timestamp}`,
            symbol: pos.symbol,
            side: (pos.side as 'long' | 'short') || 'long',
            entryPrice: pos.entryPrice || 0,
            currentPrice: pos.markPrice || 0,
            quantity: Math.abs(pos.contracts || 0),
            leverage: pos.leverage || 1,
            pnl: pos.unrealizedPnl || 0,
            pnlPercent: pos.percentage || 0,
            stopLoss: undefined,
            takeProfit: undefined,
            openTime: pos.timestamp || Date.now(),
            marginUsed: pos.initialMargin || 0,
            liquidationPrice: pos.liquidationPrice,
            orders: []
          };

          this.positions.set(livePos.id, livePos);
        }
      }

      this.emit('positionsUpdated', Array.from(this.positions.values()));
    } catch (error) {
      console.error('[Live Trading] Failed to update positions:', error);
    }
  }

  /**
   * Check order status
   */
  private async checkOrders(): Promise<void> {
    if (!this.exchange) return;

    for (const [orderId, order] of this.orders.entries()) {
      if (order.status === 'open' || order.status === 'pending') {
        try {
          const updated = await this.exchange.fetchOrder(order.exchangeOrderId, order.symbol);
          
          if (updated.status !== order.status) {
            order.status = updated.status as any;
            order.filled = updated.filled || 0;
            order.remaining = updated.remaining || 0;
            order.cost = updated.cost || 0;

            this.emit('orderUpdated', order);
            
            if (order.status === 'closed') {
              console.log(
                `[Live Trading] Order filled: ${order.side} ${order.filled.toFixed(4)} ` +
                `${order.symbol} @ $${(order.cost / order.filled).toFixed(2)}`
              );
            }
          }
        } catch (error) {
          // Order might be cancelled or expired
          console.warn(`[Live Trading] Could not fetch order ${order.exchangeOrderId}`);
        }
      }
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId: string): Promise<boolean> {
    const position = this.positions.get(positionId);
    if (!position || !this.exchange) return false;

    try {
      const side = position.side === 'long' ? 'sell' : 'buy';
      await this.exchange.createOrder(
        position.symbol,
        'market',
        side,
        position.quantity
      );

      this.positions.delete(positionId);
      this.emit('positionClosed', position);
      
      console.log(`[Live Trading] Position closed: ${position.symbol}`);
      return true;
    } catch (error) {
      console.error('[Live Trading] Failed to close position:', error);
      return false;
    }
  }

  /**
   * Get total exposure across all positions
   */
  private getTotalExposure(): number {
    let total = 0;
    for (const position of this.positions.values()) {
      total += position.marginUsed;
    }
    return total;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      exchange: this.config.exchange,
      testMode: this.config.testMode,
      positions: Array.from(this.positions.values()),
      openOrders: Array.from(this.orders.values()).filter(o => o.status === 'open'),
      totalExposure: this.getTotalExposure(),
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', this.config);
  }
}

// Singleton instance (disabled by default for safety)
export const liveTradingEngine = new LiveTradingEngine({
  enabled: false,
  testMode: true
});
