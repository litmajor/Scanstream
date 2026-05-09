/**
 * Market Data Layer (MDL) Orchestrator
 * 
 * Coordinates:
 * - Adapter selection
 * - Integrity checking
 * - Storage
 * - Event emission
 * 
 * This is what the rest of the system calls.
 * All complex logic is hidden here.
 */

import type {
  MarketDataAdapter,
  Candle,
  WorldTick,
  WorldState,
  IntegrityIssue,
  OperationMode,
} from '../../types/market-data';

import { MarketDataIntegrityChecker } from './integrity-checker';
import { storage } from '../../storage';
import { EventEmitter } from 'events';
import { getRegimeService } from '../regime-service';

export class MarketDataLayer extends EventEmitter implements WorldState {
  private adapters: Map<string, MarketDataAdapter>;
  private integrity: MarketDataIntegrityChecker;
  private adapterPriority: string[];

  constructor(
    adapters: Map<string, MarketDataAdapter>,
    adapterPriority?: string[]
  ) {
    super();
    this.adapters = adapters;
    this.integrity = new MarketDataIntegrityChecker();
    
    // Default priority: try adapters in order
    this.adapterPriority = adapterPriority || Array.from(adapters.keys());
  }

  /**
   * Fetch and validate candles
   * 
   * This is the main entry point for fetching market data.
   * It handles:
   * - Adapter selection
   * - Integrity validation
   * - Gap healing
   * - Storage
   * - Event emission
   */
  async fetchAndValidate(
    symbol: string,
    timeframe: number,
    since?: number,
    limit?: number,
    adapterHint?: string
  ): Promise<Candle[]> {
    // Select adapter
    const adapter = this.selectAdapter(adapterHint);
    if (!adapter) {
      throw new Error('No market data adapters available');
    }

    // Fetch raw candles
    console.log(`[MDL] Fetching ${symbol} ${timeframe}s from ${adapter.venue}`);
    const rawCandles = await adapter.fetchOHLCV(
      symbol,
      timeframe,
      since,
      limit
    );

    // Validate integrity
    console.log(
      `[MDL] Validating ${rawCandles.length} candles for ${symbol}`
    );
    const result = await this.integrity.validate(
      rawCandles,
      symbol,
      timeframe
    );

    // Report issues
    if (result.issues.length > 0) {
      result.issues.forEach((issue: IntegrityIssue) => {
        this.emit('integrity.issue', issue);
      });
    }

    // Attempt healing if needed
    if (result.backfillRequired && result.valid) {
      try {
        const healed = await this.integrity.healGap(
          adapter,
          symbol,
          timeframe,
          result.backfillRequired.from,
          result.backfillRequired.to
        );

        // Merge healed candles
        result.candles = this.mergeCandles(result.candles, healed);
      } catch (error: any) {
        console.warn(
          `[MDL] Gap healing failed, proceeding with gap:`,
          error.message
        );
      }
    }

    // Return validated candles
    if (!result.valid) {
      console.error(
        `[MDL] Validation failed for ${symbol}, but returning candles anyway`
      );
    }

    return result.candles;
  }

  /**
   * Emit a world tick (candle event)
   * 
   * ⚠️  DEPRECATED: Use IntegrityGate.storeValidatedCandles() instead
   * 
   * This method is kept for backward compatibility, but the preferred path is:
   * 1. Data source (CCXT/adapter) fetches candles
   * 2. IntegrityGate validates and stores
   * 3. IntegrityGate emits 'world.tick' event automatically
   * 
   * This MDL.emitWorldTick() is only for manual emission (e.g., replay, testing).
   * 
   * This is how the RPG system learns that time advanced.
   */
  async emitWorldTick(
    symbol: string,
    timeframe: number,
    candle: Candle
  ): Promise<void> {
    const tick: WorldTick = {
      symbol,
      timeframe,
      worldTime: candle.ts + (timeframe * 1000),  // Canonical market time
      emitTime: Date.now(),                       // Wall-clock emission time
      candle,
      isFinal: candle.isFinal,
      source: candle.source || 'unknown',
      mode: 'LIVE' as any as OperationMode,  // TODO: Determine actual operation mode
    };

    // Attach regimeContext if available (non-blocking best-effort)
    try {
      const regimeSvc = getRegimeService();
      const regime = await regimeSvc.computeRegime(symbol, timeframe);
      if (regime) {
        // safe cast to allow optional field
        (tick as any).regimeContext = regime;
      }
    } catch (err) {
      // Don't block emission on regime failures
      console.warn('[MDL] regime attach failed:', (err as any)?.message || err);
    }

    // Emit to RPG system (world.tick now may include regimeContext)
    this.emit('world.tick', tick);

    // Store in database (redundant if called from IntegrityGate)
    try {
      await storage.createMarketFrame({
        symbol,
        price: candle.close,
        volume: candle.volume,
        indicators: {
          timestamp: candle.ts,
          isFinal: candle.isFinal,
          source: candle.source,
        },
        orderFlow: {},
        marketMicrostructure: {},
      });
    } catch (error: any) {
      console.error(
        `[MDL] Failed to store candle for ${symbol}:`,
        error.message
      );
    }
  }

  /**
   * Get candles from storage (world state snapshot)
   */
  async getSnapshot(
    symbol: string,
    timeframe: number,
    lookback: number
  ): Promise<Candle[]> {
    try {
      const frames = await storage.getMarketFrames(symbol, lookback);

      return frames
        .filter((f: any) => f.timeframe === timeframe || f.timeframe?.toString() === timeframe.toString())
        .map((f: any) => ({
          ts: f.timestamp.getTime(),
          open: f.open,
          high: f.high,
          low: f.low,
          close: f.close,
          volume: f.volume || 0,
          isFinal: f.isFinal || false,
          source: f.source,
        }));
    } catch (error: any) {
      console.error(`[MDL] Failed to get snapshot for ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * Get latest candle for an asset
   */
  async getLatest(
    symbol: string,
    timeframe: number
  ): Promise<Candle | undefined> {
    const snapshot = await this.getSnapshot(symbol, timeframe, 1);
    return snapshot[0];
  }

  /**
   * Select an adapter
   * Priority: explicit hint > priority list > first available
   */
  private selectAdapter(hint?: string): MarketDataAdapter | undefined {
    if (hint) {
      const adapter = this.adapters.get(hint);
      if (adapter) {
        return adapter;
      }
      console.warn(`[MDL] Adapter hint ${hint} not found, using priority list`);
    }

    // Use priority order
    for (const venue of this.adapterPriority) {
      const adapter = this.adapters.get(venue);
      if (adapter) {
        return adapter;
      }
    }

    // Fallback: return any adapter
    return this.adapters.values().next().value;
  }

  /**
   * Merge two candle arrays, removing duplicates
   */
  private mergeCandles(existing: Candle[], new_: Candle[]): Candle[] {
    const merged = [...existing];
    const existingTimestamps = new Set(existing.map(c => c.ts));

    for (const candle of new_) {
      if (!existingTimestamps.has(candle.ts)) {
        merged.push(candle);
      }
    }

    // Sort by timestamp
    return merged.sort((a, b) => a.ts - b.ts);
  }
}

/**
 * Global MDL instance
 * Initialized during server startup
 */
let mdlInstance: MarketDataLayer | null = null;

export function initializeMarketDataLayer(
  adapters: Map<string, MarketDataAdapter>,
  adapterPriority?: string[]
): MarketDataLayer {
  mdlInstance = new MarketDataLayer(adapters, adapterPriority);
  console.log('[MDL] Market Data Layer initialized');
  return mdlInstance;
}

export function getMarketDataLayer(): MarketDataLayer {
  if (!mdlInstance) {
    throw new Error('Market Data Layer not initialized');
  }
  return mdlInstance;
}
