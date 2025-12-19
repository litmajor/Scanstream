/**
 * DiscoveryAgent
 *
 * Detects new symbols appearing in the feed and updates a simple in-memory
 * SymbolUniverse. Notifies listeners when new assets are discovered.
 */

import { EventEmitter } from 'events';
import { BaseAgent } from './base-agent';
import type { WorldTick } from '../types/market-data';
import type { SymbolUniverse } from '../services/aggregator/cross-exchange-types';

export class DiscoveryAgent extends BaseAgent {
  private universe: Map<string, SymbolUniverse> = new Map();

  constructor(gate: EventEmitter) {
    super(gate, 'DiscoveryAgent');
  }

  onWorldTick(tick: WorldTick): void {
    const symbol = tick.symbol;
    if (!this.universe.has(symbol)) {
      const universe: SymbolUniverse = { symbol, exchanges: [tick.source || 'unknown'] };
      this.universe.set(symbol, universe);
      console.log(`[DiscoveryAgent] New symbol discovered: ${symbol} from ${tick.source}`);
      this.emit('universe.added', universe);
    } else {
      const u = this.universe.get(symbol)!;
      const source = tick.source || 'unknown';
      if (!u.exchanges.includes(source)) {
        u.exchanges.push(source);
        console.log(`[DiscoveryAgent] ${symbol} seen on new exchange: ${source}`);
        this.emit('universe.updated', u);
      }
    }
  }

  getUniverse(): SymbolUniverse[] {
    return Array.from(this.universe.values());
  }
}
