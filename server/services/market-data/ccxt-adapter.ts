/**
 * CCXT Market Data Adapter
 * 
 * Wraps CCXT behind the universal MarketDataAdapter interface.
 * This is a thin layer that normalizes CCXT output to our canonical format.
 * 
 * ✅ Zero behavior change from existing code
 * ✅ All CCXT logic stays the same
 * ✅ Just hidden behind a clean interface
 */

import * as ccxt from 'ccxt';
import type { MarketDataAdapter, Candle, Ticker, AdapterHealth } from '../types/market-data';

/**
 * Single exchange adapter for CCXT
 * Example: BinanceMarketDataAdapter, KuCoinMarketDataAdapter, etc.
 */
export class CCXTMarketDataAdapter implements MarketDataAdapter {
  readonly venue: string;
  readonly assetClass: 'crypto' | 'forex' = 'crypto';
  
  private exchange: ccxt.Exchange;
  private lastError?: string;
  private errorCount: number = 0;
  private lastFetchTime?: number;
  private consecutiveFailures: number = 0;

  constructor(
    exchangeName: string,
    exchange: ccxt.Exchange
  ) {
    this.venue = exchangeName;
    this.exchange = exchange;
  }

  /**
   * Fetch OHLCV candles
   * 
   * Input: symbol, timeframe (seconds), since, limit
   * Output: normalized Candle array
   * 
   * ✅ This is the exact same logic as before
   * ✅ Just moved into an adapter class
   */
  async fetchOHLCV(
    symbol: string,
    timeframe: number,
    since?: number,
    limit?: number
  ): Promise<Candle[]> {
    try {
      // Convert seconds to CCXT format (M1, M5, H1, D1, etc)
      const ccxtTimeframe = this.secondsToTimeframe(timeframe);

      // Fetch raw OHLCV from exchange
      const rawCandles = await this.exchange.fetchOHLCV(
        symbol,
        ccxtTimeframe,
        since,
        limit || 100
      );

      // Normalize to our Candle format
      const candles: Candle[] = rawCandles.map((row) => ({
        ts: row[0],
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: row[5] || 0,
        isFinal: this.isCandleFinal(row[0], timeframe),
        source: 'ccxt',
        venue: this.venue,
        raw: row,
      }));

      // Track success
      this.lastFetchTime = Date.now();
      this.consecutiveFailures = 0;
      this.errorCount = 0;
      this.lastError = undefined;

      return candles;
    } catch (error: any) {
      this.errorCount++;
      this.consecutiveFailures++;
      this.lastError = error?.message || 'Unknown error';
      
      console.error(
        `[${this.venue}] fetchOHLCV failed:`,
        error?.message
      );
      
      throw error;
    }
  }

  /**
   * Fetch ticker (optional)
   */
  async fetchTicker(symbol: string): Promise<Ticker> {
    try {
      const raw = await this.exchange.fetchTicker(symbol);

      return {
        symbol,
        timestamp: raw.timestamp || Date.now(),
        last: raw.last || 0,
        bid: raw.bid || 0,
        ask: raw.ask || 0,
        volume24h: raw.quoteVolume,
      };
    } catch (error: any) {
      console.error(`[${this.venue}] fetchTicker failed:`, error?.message);
      throw error;
    }
  }

  /**
   * Get adapter health status
   */
  async getHealth(): Promise<AdapterHealth> {
    return {
      healthy: this.consecutiveFailures < 3,
      lastCheckTime: Date.now(),
      lastFetchTime: this.lastFetchTime,
      errorCount: this.errorCount,
      errorMessage: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * Convert seconds to CCXT timeframe string
   */
  private secondsToTimeframe(seconds: number): string {
    const minutes = seconds / 60;
    
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    
    const hours = minutes / 60;
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    
    const days = hours / 24;
    return `${Math.round(days)}d`;
  }

  /**
   * Determine if a candle is final (closed)
   * 
   * A candle is final if we're past its close time by at least half the interval.
   * This gives us confidence the broker has finalized it.
   */
  private isCandleFinal(openTime: number, timeframe: number): boolean {
    const now = Date.now();
    const closeTime = openTime + (timeframe * 1000);
    const halfInterval = (timeframe * 1000) / 2;

    return now >= closeTime + halfInterval;
  }
}

/**
 * Factory to create CCXT adapters for multiple exchanges
 * 
 * Usage:
 * ```
 * const adapters = CCXTAdapterFactory.createMultiple([
 *   'binance', 'kucoinfutures', 'okx'
 * ]);
 * ```
 */
export class CCXTAdapterFactory {
  /**
   * Create a single CCXT adapter
   */
  static create(exchangeName: string): CCXTMarketDataAdapter {
    const ExchangeClass = ccxt[exchangeName as keyof typeof ccxt] as any;

    if (!ExchangeClass) {
      throw new Error(
        `Exchange ${exchangeName} not supported by CCXT. ` +
        `Available: ${Object.keys(ccxt).join(', ')}`
      );
    }

    const exchange = new ExchangeClass({
      enableRateLimit: true,
      // Don't load markets here — lazy load on first use
    });

    return new CCXTMarketDataAdapter(exchangeName, exchange);
  }

  /**
   * Create multiple CCXT adapters
   */
  static createMultiple(
    exchangeNames: string[]
  ): Map<string, CCXTMarketDataAdapter> {
    const adapters = new Map<string, CCXTMarketDataAdapter>();

    for (const name of exchangeNames) {
      try {
        const adapter = this.create(name);
        adapters.set(name, adapter);
      } catch (error: any) {
        console.warn(`Failed to create adapter for ${name}:`, error.message);
      }
    }

    return adapters;
  }
}
