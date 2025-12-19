import { CrossExchangeAggregator } from '../aggregator/cross-exchange-aggregator';

export interface FillResult {
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  requestedSize: number;
  executedSize: number;
  avgPrice: number;
  slippage: number;
  timestamp: number;
}

/**
 * Very small exchange simulator used by the ExecutionEngine for smoke tests.
 * Not meant to replace real exchange clients — provides basic depth and balance checks.
 */
export class ExchangeSimulator {
  // exchange -> asset -> balance
  private balances: Map<string, Record<string, number>> = new Map();
  // exchange -> daily traded volume (reset not implemented in simulator)
  private dailyVolume: Map<string, number> = new Map();
  // per-exchange daily limit (base asset units)
  private dailyLimits: Map<string, number> = new Map();

  constructor(private aggregator?: CrossExchangeAggregator) {}

  setDailyLimit(exchange: string, limit: number) {
    this.dailyLimits.set(exchange, limit);
  }

  setBalance(exchange: string, asset: string, amount: number) {
    if (!this.balances.has(exchange)) this.balances.set(exchange, {});
    const b = this.balances.get(exchange)!;
    b[asset] = amount;
  }

  getBalance(exchange: string, asset: string): number {
    const b = this.balances.get(exchange);
    if (!b) return 0;
    return b[asset] || 0;
  }

  private addDailyVolume(exchange: string, amount: number) {
    const v = this.dailyVolume.get(exchange) || 0;
    this.dailyVolume.set(exchange, v + amount);
  }

  getDailyVolume(exchange: string): number {
    return this.dailyVolume.get(exchange) || 0;
  }

  getOrderBook(symbol: string, exchange: string) {
    // Derive a tiny synthetic order book using latest per-exchange candle
    const defaultPrice = 100;
    let price = defaultPrice;
    let volume = 100;
    try {
      if (this.aggregator) {
        const per = this.aggregator.getPerExchange(symbol);
        const ex = per[exchange];
        if (ex) {
          price = ex.close || price;
          volume = Math.max(1, Math.floor(ex.volume || volume));
        }
      }
    } catch (err) {
      // ignore
    }

    // Build simple bids/asks arrays around price
    const bids: Array<[number, number]> = [];
    const asks: Array<[number, number]> = [];
    for (let i = 0; i < 5; i++) {
      bids.push([price - i * 0.5, Math.max(1, Math.floor(volume / (i + 1)))]);
      asks.push([price + i * 0.5, Math.max(1, Math.floor(volume / (i + 1)))]);
    }

    return { bids, asks };
  }

  /**
   * Place a simulated order using order book depth. Returns executed fill with simple slippage model.
   */
  async placeOrder(exchange: string, symbol: string, side: 'buy' | 'sell', size: number, price: number): Promise<FillResult> {
    // Enforce daily limit if set
    const dailyLimit = this.dailyLimits.get(exchange) || Infinity;
    const currentDaily = this.dailyVolume.get(exchange) || 0;
    if (currentDaily + size > dailyLimit) {
      // can't execute beyond daily limit
      const allowed = Math.max(0, dailyLimit - currentDaily);
      if (allowed <= 0) {
        return {
          exchange,
          symbol,
          side,
          requestedSize: size,
          executedSize: 0,
          avgPrice: price,
          slippage: 0,
          timestamp: Date.now(),
        };
      }
      size = allowed;
    }

    const ob = this.getOrderBook(symbol, exchange);
    const depth = side === 'buy' ? ob.asks : ob.bids; // for buy, consume asks

    let remaining = size;
    let executed = 0;
    let cost = 0;

    for (const [p, vol] of depth) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, vol);
      executed += take;
      cost += take * p;
      remaining -= take;
    }

    const executedSize = executed;
    const avgPrice = executed > 0 ? cost / executed : price;

    // slippage based on fraction of top-of-book consumed
    const topVol = depth[0] ? depth[0][1] : 1;
    const fraction = Math.min(1, executedSize / Math.max(1, topVol));
    const slippage = Math.min(0.05, fraction * 0.02); // up to 5%

    // Adjust balances simplistically (assume quote asset USD-like)
    const base = symbol.split('/')[0];
    const quote = symbol.split('/')[1] || 'USD';
    const costWithSlippage = avgPrice * (1 + (side === 'buy' ? slippage : -slippage)) * executedSize;

    const exchBalances = this.balances.get(exchange) || {};
    // Simulate: for buy, decrease quote balance, increase base; for sell, inverse
    if (side === 'buy') {
      exchBalances[quote] = (exchBalances[quote] || 0) - costWithSlippage;
      exchBalances[base] = (exchBalances[base] || 0) + executedSize;
    } else {
      exchBalances[base] = (exchBalances[base] || 0) - executedSize;
      exchBalances[quote] = (exchBalances[quote] || 0) + costWithSlippage;
    }
    this.balances.set(exchange, exchBalances);

    this.addDailyVolume(exchange, executedSize);

    return {
      exchange,
      symbol,
      side,
      requestedSize: size,
      executedSize,
      avgPrice,
      slippage,
      timestamp: Date.now(),
    };
  }
}

export default ExchangeSimulator;
