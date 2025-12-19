/**
 * FOREX ENGINE — Market Data Integration
 * 
 * Mirrors CCXT Scanner pattern but for Forex (OANDA).
 * 
 * Flow (same as CCXT):
 * OANDA API → Adapter → IntegrityGate → World Ticks → Agents
 * 
 * Key Principle:
 * Agents do not know the data came from forex.
 * They see the same World Tick events as crypto sources.
 */

import { OandaAdapter } from './gateway/forex/oanda-adapter';
import { OandaClient } from './gateway/forex/oanda-client';
import { IntegrityGate } from './market-data/integrity-gate';
import type { WorldTick } from '../types/market-data';

export interface ForexEngineConfig {
  oandaApiKey: string;
  oandaAccountId: string;
  oandaEnvironment?: 'live' | 'practice';
}

export interface ForexScanOptions {
  symbols: string[];           // e.g., ["EUR_USD", "GBP_JPY"]
  timeframeSeconds: number;    // 60, 300, 3600, etc
  limit?: number;              // candles per symbol (default 50)
  parallel?: boolean;          // fetch in parallel (default true)
}

export interface ForexScanResult {
  symbol: string;
  timeframeSeconds: number;
  ticksEmitted: number;
  gapsDetected: number;
  stored: number;
  rejected: number;
  timestamp: Date;
}

export class ForexEngine {
  private adapter: OandaAdapter;
  private gate: IntegrityGate;

  constructor(
    config: ForexEngineConfig,
    gate: IntegrityGate
  ) {
    // Initialize OANDA client
    const client = new OandaClient({
      apiKey: config.oandaApiKey,
      accountId: config.oandaAccountId,
      environment: config.oandaEnvironment || 'practice',
    });

    // Initialize adapter
    this.adapter = new OandaAdapter(client);
    this.gate = gate;

    console.log('[ForexEngine] Initialized (OANDA)');
  }

  /**
   * Scan forex symbols and emit world ticks
   * 
   * This method demonstrates the complete flow:
   * 1. Fetch candles from OANDA
   * 2. Pass through IntegrityGate
   * 3. Emit World Ticks for agents
   * 
   * Same process as CCXT, different source.
   */
  async scanSymbols(options: ForexScanOptions): Promise<ForexScanResult[]> {
    const {
      symbols,
      timeframeSeconds,
      limit = 50,
      parallel = true,
    } = options;

    console.log(
      `[ForexEngine] Scanning ${symbols.length} symbols at ${timeframeSeconds}s timeframe`
    );

    const results: ForexScanResult[] = [];

    if (parallel) {
      // Fetch all symbols in parallel
      const fetchPromises = symbols.map(symbol =>
        this.processSingleSymbol(symbol, timeframeSeconds, limit)
      );

      const settled = await Promise.allSettled(fetchPromises);

      settled.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else if (result.status === 'rejected') {
          console.warn(
            `[ForexEngine] Failed to scan ${symbols[index]}:`,
            result.reason
          );
        }
      });
    } else {
      // Fetch symbols sequentially
      for (const symbol of symbols) {
        try {
          const result = await this.processSingleSymbol(
            symbol,
            timeframeSeconds,
            limit
          );
          if (result) {
            results.push(result);
          }
        } catch (err: any) {
          console.warn(
            `[ForexEngine] Error scanning ${symbol}:`,
            err.message
          );
        }
      }
    }

    console.log(`[ForexEngine] Scan complete: ${results.length}/${symbols.length} successful`);
    return results;
  }

  /**
   * Process a single forex symbol
   * 
   * 1. Fetch candles from OANDA
   * 2. Route through IntegrityGate
   * 3. Return metrics (ticks, gaps, rejections)
   */
  private async processSingleSymbol(
    symbol: string,
    timeframeSeconds: number,
    limit: number
  ): Promise<ForexScanResult | null> {
    try {
      console.log(
        `[ForexEngine] Fetching ${symbol}/${timeframeSeconds}s (${limit} candles)`
      );

      // Step 1: Fetch from OANDA
      const candles = await this.adapter.fetchCandles(
        symbol,
        timeframeSeconds,
        limit
      );

      if (candles.length === 0) {
        console.warn(`[ForexEngine] No candles for ${symbol}`);
        return null;
      }

      // Step 2: Route through IntegrityGate
      // This is identical to the CCXT path:
      // - Validate (timestamps, OHLC, finality)
      // - Detect gaps (within-batch and cross-batch)
      // - Store canonical facts
      // - Emit World Ticks
      const gateResult = await this.gate.storeValidatedCandles(
        symbol,
        timeframeSeconds,
        candles
      );

      // Step 3: Report results
      const result: ForexScanResult = {
        symbol,
        timeframeSeconds,
        ticksEmitted: gateResult.ticks.length,
        gapsDetected: gateResult.gaps.length,
        stored: gateResult.stored.length,
        rejected: gateResult.rejected.length,
        timestamp: new Date(),
      };

      console.log(
        `[ForexEngine] ✅ ${symbol}: ${result.stored} stored, ` +
        `${result.rejected} rejected, ${result.gapsDetected} gaps, ` +
        `${result.ticksEmitted} ticks emitted`
      );

      return result;
    } catch (err: any) {
      console.error(`[ForexEngine] Error processing ${symbol}:`, err);
      return null;
    }
  }

  /**
   * Subscribe to world tick events (for agents)
   * 
   * Agents use this to react to forex data with same logic as crypto.
   */
  onWorldTick(listener: (tick: WorldTick) => void): void {
    this.gate.on('world.tick', listener);
  }

  /**
   * Subscribe to gap events (for monitoring)
   */
  onGapDetected(listener: (event: any) => void): void {
    this.gate.on('gap.detected', listener);
  }

  /**
   * Check if adapter supports a timeframe
   */
  isTimeframeSupported(seconds: number): boolean {
    return OandaAdapter.isTimeframeSupported(seconds);
  }

  /**
   * Get list of supported timeframes
   */
  getSupportedTimeframes(): number[] {
    return OandaAdapter.getSupportedTimeframes();
  }
}
