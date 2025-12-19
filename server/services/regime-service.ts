import { EventEmitter } from 'events';
import { storage } from '../storage';
import { StrategyIntegrationEngine } from '../strategy-integration';

export interface RegimeContext {
  type: string;
  volatility: 'low' | 'medium' | 'high';
  momentum: number; // -1..1
  trend: 'up' | 'down' | 'sideways';
  score?: number; // 0..100
  confidence?: number; // 0..1
  computedAt?: number; // ms
  source?: string;
}

/**
 * RegimeService
 *
 * Centralizes market regime computation and publishes `regime.update` events.
 * Agents and UI can subscribe to the event bus or call `computeRegime()` to fetch the
 * latest sanitized regime context.
 */
export class RegimeService extends EventEmitter {
  private engine: StrategyIntegrationEngine;

  constructor() {
    super();
    this.engine = new StrategyIntegrationEngine();
  }

  /**
   * Compute regime for a symbol/timeframe by reading recent market frames from storage
   */
  async computeRegime(symbol: string, timeframe: number): Promise<RegimeContext | null> {
    try {
      const frames = await storage.getMarketFrames(symbol, 200);

      if (!frames || frames.length < 10) return null;

      const raw = this.engine.detectMarketRegime(frames as any);

      const ctx: RegimeContext = {
        type: raw.type,
        volatility: raw.volatility,
        momentum: raw.momentum,
        trend: raw.trend,
        score: Math.round(((raw.momentum + 1) / 2) * 100),
        confidence: Math.min(1, Math.max(0, 0.5 + Math.abs(raw.momentum) * 0.5)),
        computedAt: Date.now(),
        source: 'strategy-integration'
      };

      // Publish update
      this.emit('regime.update', { symbol, timeframe, regime: ctx });

      return ctx;
    } catch (error: any) {
      console.error('[RegimeService] computeRegime failed:', error?.message || error);
      return null;
    }
  }
}

let instance: RegimeService | null = null;

export function getRegimeService(): RegimeService {
  if (!instance) instance = new RegimeService();
  return instance;
}

export default getRegimeService();
