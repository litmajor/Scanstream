import { EventEmitter } from 'events';
import type { ArbSignal } from '../../agents/arbitrage-agent';
import type { CrossExchangeAggregator } from '../aggregator/cross-exchange-aggregator';
import type { PortfolioAgent } from '../../agents/portfolio-agent';
import { ExchangeSimulator } from './exchange-sim';
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { ExecutionStore } from './execution-store';

export interface ExecutionEngineConfig {
  maxLatencyMs: number;
  maxExposurePerSymbol: number; // absolute units
  maxLeverage: number;
  defaultOrderSize: number; // units of base asset
}

export class ExecutionEngine extends EventEmitter {
  private cfg: ExecutionEngineConfig;

  constructor(
    private gate: EventEmitter,
    private aggregator: CrossExchangeAggregator,
    private portfolio: PortfolioAgent,
    private exchangeSim: ExchangeSimulator,
    cfg?: Partial<ExecutionEngineConfig>
  ) {
    super();
    this.cfg = Object.assign({ maxLatencyMs: 5000, maxExposurePerSymbol: 10, maxLeverage: 2, defaultOrderSize: 1 }, cfg || {});

    this.gate.on('arb.signal', (sig: ArbSignal) => this.handleSignal(sig).catch(err => console.error('[ExecutionEngine] handleSignal error', err)));

    // Create a simple execution store (file-based) for persistence
    try {
      const store = new ExecutionStore();
      (this as any)._store = store;
    } catch (err) {
      console.warn('[ExecutionEngine] Failed to initialize ExecutionStore', err);
    }
  }

  private async handleSignal(sig: ArbSignal) {
    // Latency check
    const latency = Date.now() - (sig.timestamp || 0);
    if (latency > this.cfg.maxLatencyMs) {
      console.warn('[ExecutionEngine] Dropping stale arb.signal (latency ms):', latency, sig.symbol);
      return;
    }

    // Gap-aware: ask portfolio if symbol is paused
    if (this.portfolio.isPaused(sig.symbol)) {
      console.warn('[ExecutionEngine] Symbol paused due to gap, skipping execution:', sig.symbol);
      return;
    }

    // Risk: check exposure
    const currentExposure = this.portfolio.getExposure(sig.symbol);
    if (Math.abs(currentExposure) >= this.cfg.maxExposurePerSymbol) {
      console.warn('[ExecutionEngine] Max exposure reached for', sig.symbol, currentExposure);
      return;
    }

    // Determine order size limited by exposure remaining
    const remaining = Math.max(0, this.cfg.maxExposurePerSymbol - Math.abs(currentExposure));
    const orderSize = Math.min(this.cfg.defaultOrderSize, remaining);
    if (orderSize <= 0) return;

    // Simple two-leg arb: buy on worstExchange, sell on bestExchange
    const buyExchange = sig.worstExchange;
    const sellExchange = sig.bestExchange;
    const buyPrice = sig.worstPrice;
    const sellPrice = sig.bestPrice;

    console.log('[ExecutionEngine] Executing arb:', sig.symbol, 'size=', orderSize, 'buy@', buyExchange, 'sell@', sellExchange);

    // Get available depth estimate from aggregator per-exchange candle volume
    // Use order book depth and a VWAP-like splitting strategy
    const buyOb = this.exchangeSim.getOrderBook(sig.symbol, buyExchange);
    const sellOb = this.exchangeSim.getOrderBook(sig.symbol, sellExchange);

    const buyDepth = buyOb ? buyOb.asks.reduce((s, [, v]) => s + v, 0) : 0;
    const sellDepth = sellOb ? sellOb.bids.reduce((s, [, v]) => s + v, 0) : 0;

    const usableDepth = Math.max(1, Math.floor(Math.min(buyDepth, sellDepth)));

    // VWAP split into N chunks proportional to top-of-book sizes
    const maxChunk = Math.max(0.001, Math.floor(usableDepth / 3));
    let remainingSize = orderSize;
    const chunks: number[] = [];
    while (remainingSize > 0) {
      const chunk = Math.min(remainingSize, Math.max(0.0001, maxChunk));
      chunks.push(chunk);
      remainingSize -= chunk;
    }

    for (const chunk of chunks) {
      // Place buy then sell with basic slippage + TWAP-style pacing (a small delay)
      const buyFill = await this.exchangeSim.placeOrder(buyExchange, sig.symbol, 'buy', chunk, buyPrice);
      // small artificial pacing
      await new Promise((r) => setTimeout(r, 20));
      const sellFill = await this.exchangeSim.placeOrder(sellExchange, sig.symbol, 'sell', chunk, sellPrice);

      // Apply fills to portfolio
      this.portfolio.applyFill(buyFill as any);
      this.portfolio.applyFill(sellFill as any);

      // Persist execution fills if store available
      try {
        const store: ExecutionStore | undefined = (this as any)._store;
        if (store) {
          await store.saveExecution({ buyFill, sellFill, sig });
        }
      } catch (err) {
        console.warn('[ExecutionEngine] Failed to persist execution', err);
      }

      // Emit execution event
      this.emit('execution.filled', { buyFill, sellFill, sig });
      this.gate.emit('execution.filled', { buyFill, sellFill, sig });
    }
  }
}

export default ExecutionEngine;
