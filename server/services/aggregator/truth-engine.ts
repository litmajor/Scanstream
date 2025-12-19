import { EventEmitter } from 'events';
import type { CrossExchangeAggregator } from './cross-exchange-aggregator';

export type Consensus = {
  symbol: string;
  price: number | null;
  timestamp: number;
  sources: string[];
  confidence: number; // 0..100
};

/**
 * TruthEngine (Multi-Source Arbitration)
 * - Listens to world.tick events (via provided gate)
 * - Maintains per-symbol per-exchange latest prices
 * - Computes a consensus price using median/weighted rules
 * - Emits `consensus.updated` when canonical price changes
 */
export class TruthEngine extends EventEmitter {
  private store: Map<string, Consensus> = new Map();
  private aggregator: CrossExchangeAggregator;

  constructor(private gate: EventEmitter, aggregator: CrossExchangeAggregator) {
    super();
    this.aggregator = aggregator;
    this.gate.on('world.tick', (tick: any) => this.onWorldTick(tick));
  }

  private onWorldTick(tick: any) {
    try {
      const symbol = tick.symbol;
      // compute consensus from aggregator (uses multiple sources)
      const per = this.aggregator.getPerExchange(symbol);
      const entries = Object.entries(per || {}).filter(([, v]) => !!v) as [string, any][];
      if (entries.length === 0) return;

      const closes = entries.map(([, c]) => c.close).sort((a, b) => a - b);
      const median = closes[Math.floor(closes.length / 2)];

      const now = Date.now();
      const sources = entries.map(([s]) => s);

      // confidence heuristic (similar to HealingService): sources, freshness, spread
      const spread = Math.max(...closes) - Math.min(...closes);
      const sourceFactor = Math.min(1, entries.length / 5);
      const freshnessWindow = 90_000;
      let fresh = 0;
      for (const [, c] of entries) if (now - (c.ts || 0) < freshnessWindow) fresh++;
      const freshnessFactor = fresh / Math.max(1, entries.length);
      const spreadFactor = spread > 0 ? Math.max(0, 1 - spread / Math.max(1, Math.abs(median))) : 1;
      const confidence = Math.round(100 * sourceFactor * freshnessFactor * spreadFactor);

      const consensus: Consensus = {
        symbol,
        price: median,
        timestamp: now,
        sources,
        confidence,
      };

      const prev = this.store.get(symbol);
      const prevStr = prev ? JSON.stringify(prev) : null;
      const nextStr = JSON.stringify(consensus);
      if (prevStr !== nextStr) {
        this.store.set(symbol, consensus);
        this.emit('consensus.updated', consensus);
        // forward to gate for observability
        try {
          this.gate.emit('consensus.updated', consensus);
        } catch (err) {
          // ignore
        }
      }
    } catch (err) {
      console.error('[TruthEngine] onWorldTick error', err);
    }
  }

  getConsensus(symbol: string): Consensus | undefined {
    return this.store.get(symbol);
  }
}

export default TruthEngine;
