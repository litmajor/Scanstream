/**
 * PortfolioAgent (scaffold)
 *
 * Tracks positions across exchanges and reacts to arb signals and gap events.
 * Extends BaseAgent so it receives world.tick events (and can query aggregator).
 */

import { EventEmitter } from 'events';
import { BaseAgent } from './base-agent';
import type { WorldTick } from '../types/market-data';
import type { CrossExchangeAggregator } from '../services/aggregator/cross-exchange-aggregator';
import type HealingService from '../services/aggregator/healing-service';

export class PortfolioAgent extends BaseAgent {
  private positions: Map<string, Record<string, number>> = new Map(); // symbol -> exchange -> size
  private balances: Map<string, Record<string, number>> = new Map(); // exchange -> asset -> amount
  private pausedSymbols: Set<string> = new Set();

  constructor(gate: EventEmitter, private aggregator: CrossExchangeAggregator, private healing?: any) {
    super(gate, 'PortfolioAgent');

    // Listen for arb signals emitted on this agent (forwarded by startup glue)
    (this as any).on('arb.signal', (sig: any) => this.onArbSignal(sig));

    // Listen for gap events from IntegrityGate to pause trading on the symbol
    try {
      gate.on('gap.detected', (g: any) => {
        if (g && g.symbol) {
          // When a gap is detected, consult HealingService if available
          if (this.healing) {
            const synthetic = this.healing.forwardFill(g.symbol, this.aggregator as any);
            if (synthetic && synthetic.confidence >= 50) {
              console.log(`[PortfolioAgent] Healing available for ${g.symbol} confidence=${synthetic.confidence} — allowing limited trading`);
            } else {
              this.pausedSymbols.add(g.symbol);
              console.warn(`[PortfolioAgent] Pausing trading for ${g.symbol} due to gap detected (severity=${g.severity || 'unknown'})`);
            }
          } else {
            this.pausedSymbols.add(g.symbol);
            console.warn(`[PortfolioAgent] Pausing trading for ${g.symbol} due to gap detected (severity=${g.severity || 'unknown'})`);
          }
        }
      });
    } catch (err) {
      // ignore if gate doesn't support gaps
    }
  }

  /**
   * Optional handler called when RegimeService emits updates.
   * BaseAgent will call this if present.
   */
  onRegimeUpdate(symbol: string, timeframe: number, regime: any): void {
    try {
      // Ignore stale regime info (allow ~3 periods tolerance)
      const ageMs = regime?.computedAt ? Date.now() - regime.computedAt : 0;
      const staleThreshold = Math.max(60_000, timeframe * 1000 * 3);
      if (regime?.computedAt && ageMs > staleThreshold) return;

      // If previously paused but regime turned bullish with good confidence, resume
      if (this.pausedSymbols.has(symbol) && regime?.confidence && regime.confidence > 0.6 && String(regime.type).includes('BULL')) {
        this.pausedSymbols.delete(symbol);
        console.log(`[PortfolioAgent] Resuming trading for ${symbol} due to regime ${regime.type} (conf=${regime.confidence})`);
      }

      // If regime is strongly bearish or parabolic bear, pause trading proactively
      if (!this.pausedSymbols.has(symbol) && regime?.confidence && regime.confidence > 0.7 && (String(regime.type).includes('BEAR') || String(regime.type).includes('PARABOLIC'))) {
        this.pausedSymbols.add(symbol);
        console.warn(`[PortfolioAgent] Pausing trading for ${symbol} due to regime ${regime.type} (conf=${regime.confidence})`);
      }
    } catch (err) {
      console.warn('[PortfolioAgent] onRegimeUpdate handler error:', (err as any)?.message || err);
    }
  }

  onWorldTick(tick: WorldTick): void {
    // Maintain per-symbol position map (ensure key exists)
    const pos = this.positions.get(tick.symbol) || {};
    this.positions.set(tick.symbol, pos);

    // Example risk rule — if aggregated confidence low, log and consider reducing exposure
    const agg = this.aggregator.getAggregated(tick.symbol);
    if (agg && agg.confidence !== undefined && agg.confidence < 50) {
      console.log(`[PortfolioAgent] Low confidence ${agg.confidence} for ${tick.symbol} — consider reducing exposure`);
    }
  }

  isPaused(symbol: string): boolean {
    return this.pausedSymbols.has(symbol);
  }

  getExposure(symbol: string): number {
    const per = this.positions.get(symbol);
    if (!per) return 0;
    return Object.values(per).reduce((sum, v) => sum + (v || 0), 0);
  }

  getBalance(exchange: string, asset: string): number {
    const b = this.balances.get(exchange);
    if (!b) return 0;
    return b[asset] || 0;
  }

  setBalance(exchange: string, asset: string, amount: number) {
    if (!this.balances.has(exchange)) this.balances.set(exchange, {});
    const b = this.balances.get(exchange)!;
    b[asset] = amount;
  }

  /**
   * Apply a fill from an execution engine. Fill must contain: exchange, symbol, side, executedSize, avgPrice
   */
  applyFill(fill: any) {
    if (!fill || !fill.exchange || !fill.symbol) return;
    const symbol = fill.symbol;
    const exchange = fill.exchange;
    const base = symbol.split('/')[0];
    const quote = symbol.split('/')[1] || 'USD';

    if (!this.positions.has(symbol)) this.positions.set(symbol, {});
    const pos = this.positions.get(symbol)!;
    pos[exchange] = pos[exchange] || 0;

    if (fill.side === 'buy') {
      pos[exchange] += fill.executedSize;
    } else if (fill.side === 'sell') {
      pos[exchange] -= fill.executedSize;
    }

    // naive balance adjustments
    if (!this.balances.has(exchange)) this.balances.set(exchange, {});
    const bal = this.balances.get(exchange)!;
    const cost = (fill.avgPrice || 0) * (fill.executedSize || 0);
    if (fill.side === 'buy') {
      bal[base] = (bal[base] || 0) + fill.executedSize;
      bal[quote] = (bal[quote] || 0) - cost;
    } else {
      bal[base] = (bal[base] || 0) - fill.executedSize;
      bal[quote] = (bal[quote] || 0) + cost;
    }

    console.log(`[PortfolioAgent] Applied fill on ${exchange} ${symbol} ${fill.side} size=${fill.executedSize} price=${fill.avgPrice}`);
  }

  private onArbSignal(sig: any): void {
    console.log('[PortfolioAgent] Received arb signal', sig);
    // Risk and execution orchestration occurs in ExecutionEngine; PortfolioAgent maintains state
  }

  getPositions(): Map<string, Record<string, number>> {
    return this.positions;
  }
}
