/**
 * ArbitrageAgent
 *
 * Extends BaseAgent (mandatory world.tick subscription). On every world.tick,
 * it queries the CrossExchangeAggregator for the unified symbol state and
 * detects simple two-way arbitrage opportunities (max-min > threshold).
 */

import { EventEmitter } from 'events';
import { BaseAgent } from './base-agent';
import type { WorldTick } from '../types/market-data';
import type { CrossExchangeAggregator } from '../services/aggregator/cross-exchange-aggregator';
import type { TruthEngine } from '../services/aggregator/truth-engine';

export interface ArbSignal {
  symbol: string;
  bestExchange: string;
  worstExchange: string;
  bestPrice: number;
  worstPrice: number;
  spread: number;
  timestamp: number;
}

export class ArbitrageAgent extends BaseAgent {
  private baseThreshold: number;

  constructor(gate: EventEmitter, private aggregator: CrossExchangeAggregator, private arbThreshold = 0, private truth?: TruthEngine) {
    super(gate, 'ArbitrageAgent');
    this.baseThreshold = arbThreshold;
  }

  onWorldTick(tick: WorldTick): void {
    // Always query aggregated view — this keeps subscription to world.tick mandatory
    const aggregated = this.aggregator.getAggregated(tick.symbol);
    if (!aggregated) return;

    // If a TruthEngine is available, prefer consensus price for one-truth arbitration
    const consensus = this.truth ? this.truth.getConsensus(tick.symbol) : undefined;

    const exchangeCandles = aggregated.exchangeCandles;
    const prices: Array<{ exchange: string; price: number }> = [];

    for (const [exchange, candle] of Object.entries(exchangeCandles)) {
      if (!candle) continue;
      prices.push({ exchange, price: candle.close });
    }

    if (prices.length < 1) return; // need at least one price source

    // If consensus exists, compute spread relative to consensus
    if (consensus && consensus.price !== null) {
      // find best away-from-consensus opportunities
      for (const p of prices) {
        const diff = Math.abs(p.price - consensus.price);
        if (diff > this.arbThreshold) {
          const signal: ArbSignal = {
            symbol: tick.symbol,
            bestExchange: p.exchange, // side depends on whether p.price > consensus
            worstExchange: p.exchange,
            bestPrice: p.price,
            worstPrice: consensus.price,
            spread: diff,
            timestamp: Date.now(),
          };
          console.log('[ArbitrageAgent] Arb signal (consensus):', signal);
          this.emit('arb.signal', signal);
        }
      }
      return;
    }

    prices.sort((a, b) => a.price - b.price);
    const worst = prices[0];
    const best = prices[prices.length - 1];
    const spread = best.price - worst.price;

    // threshold can be absolute or relative; here we treat it as absolute
    if (spread > this.arbThreshold) {
      const signal: ArbSignal = {
        symbol: tick.symbol,
        bestExchange: best.exchange,
        worstExchange: worst.exchange,
        bestPrice: best.price,
        worstPrice: worst.price,
        spread,
        timestamp: Date.now(),
      };

      console.log('[ArbitrageAgent] Arb signal:', signal);
      this.emit('arb.signal', signal);
    }
  }

  /**
   * Optional handler invoked by BaseAgent when RegimeService emits a regime.update
   * Adjusts arbitrage threshold based on regime volatility and avoids acting on stale regime values.
   */
  onRegimeUpdate(symbol: string, timeframe: number, regime: any): void {
    try {
      const ageMs = regime?.computedAt ? Date.now() - regime.computedAt : 0;
      const staleThreshold = Math.max(60_000, timeframe * 1000 * 3);
      if (regime?.computedAt && ageMs > staleThreshold) return;

      if (regime?.volatility === 'high') {
        this.arbThreshold = Math.max(this.baseThreshold, Math.round(this.baseThreshold * 1.5));
      } else if (regime?.volatility === 'low') {
        this.arbThreshold = Math.max(0, Math.round(this.baseThreshold * 0.7));
      } else {
        this.arbThreshold = this.baseThreshold;
      }

      console.log(`[ArbitrageAgent] Adjusted arbThreshold=${this.arbThreshold} for regime ${regime?.type} (vol=${regime?.volatility})`);
    } catch (err) {
      console.warn('[ArbitrageAgent] onRegimeUpdate error:', (err as any)?.message || err);
    }
  }
}
