/**
 * OANDA Forex Adapter
 * 
 * Converts OANDA API responses → Canonical Candle[]
 * 
 * Responsibility:
 * - Convert OANDA format to Candle
 * - Map timeframes (60 → M1, 300 → M5, etc)
 * - Preserve metadata (source, isFinal)
 * 
 * NOT responsible for:
 * - Validation (CandleIntegrityLayer handles this)
 * - Storage (IntegrityGate handles this)
 * - World Tick emission (IntegrityGate handles this)
 * - Retries or caching (caller handles this)
 * 
 * This adapter is a **claim translator**, not a truth enforcer.
 */

import type { Candle } from '../../types/market-data';
import { OandaClient } from './oanda-client';
import type { OandaCandlesRequest } from './oanda-types';

export class OandaAdapter {
  /**
   * Timeframe mapping: seconds → OANDA granularity
   * 
   * OANDA supports: M1, M5, M15, M30, H1, H2, H3, H4, H6, H8, H12, D, W, M
   */
  private static readonly TIMEFRAME_MAP: Record<number, string> = {
    60: 'M1',           // 1 minute
    300: 'M5',          // 5 minutes
    900: 'M15',         // 15 minutes
    1800: 'M30',        // 30 minutes
    3600: 'H1',         // 1 hour
    7200: 'H2',         // 2 hours
    10800: 'H3',        // 3 hours
    14400: 'H4',        // 4 hours
    21600: 'H6',        // 6 hours
    28800: 'H8',        // 8 hours
    43200: 'H12',       // 12 hours
    86400: 'D',         // 1 day
    604800: 'W',        // 1 week
    2592000: 'M',       // 1 month (30 days)
  };

  constructor(private client: OandaClient) {}

  /**
   * Fetch candles from OANDA
   * 
   * @param symbol OANDA symbol (e.g., "EUR_USD", "GBP_JPY")
   * @param timeframeSeconds Timeframe in seconds (60, 300, 3600, etc)
   * @param limit Number of candles to fetch (max varies, typically 5000)
   * @returns Array of normalized candles
   */
  async fetchCandles(
    symbol: string,
    timeframeSeconds: number,
    limit: number = 50
  ): Promise<Candle[]> {
    // Validate timeframe support
    const granularity = this.mapTimeframe(timeframeSeconds);
    if (!granularity) {
      console.error(
        `[OandaAdapter] Unsupported timeframe: ${timeframeSeconds}s. ` +
        `Supported: ${Object.keys(OandaAdapter.TIMEFRAME_MAP).join(', ')}`
      );
      return [];
    }

    // Request from OANDA
    const response = await this.client.getCandles({
      instrument: symbol,
      granularity,
      count: limit,
      price: 'M',  // mid price (representative)
    });

    if (!response || !response.candles) {
      console.warn(`[OandaAdapter] No candles returned for ${symbol}/${granularity}`);
      return [];
    }

    // Normalize to Candle[]
    const candles: Candle[] = response.candles.map((oc) => ({
      ts: new Date(oc.time).getTime(),           // Convert ISO 8601 → ms
      open: Number(oc.mid.o),
      high: Number(oc.mid.h),
      low: Number(oc.mid.l),
      close: Number(oc.mid.c),
      volume: oc.volume,                         // Tick volume (not standard)
      isFinal: oc.complete === true,
      source: 'oanda',
      venue: 'OANDA',
      raw: oc,                                   // Store raw for debugging
    }));

    console.log(
      `[OandaAdapter] Fetched ${candles.length} candles for ${symbol}/${granularity}`
    );

    return candles;
  }

  /**
   * Map seconds to OANDA granularity string
   * 
   * @param seconds Timeframe in seconds
   * @returns OANDA granularity (e.g., "M1", "H1") or null if unsupported
   */
  private mapTimeframe(seconds: number): string | null {
    return OandaAdapter.TIMEFRAME_MAP[seconds] || null;
  }

  /**
   * Get list of supported timeframes
   * @returns Array of supported timeframes in seconds
   */
  static getSupportedTimeframes(): number[] {
    return Object.keys(OandaAdapter.TIMEFRAME_MAP)
      .map(Number)
      .sort((a, b) => a - b);
  }

  /**
   * Check if a timeframe is supported
   * @param seconds Timeframe in seconds
   * @returns true if supported
   */
  static isTimeframeSupported(seconds: number): boolean {
    return seconds in OandaAdapter.TIMEFRAME_MAP;
  }
}
