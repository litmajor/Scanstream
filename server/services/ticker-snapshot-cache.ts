/**
 * Ticker Snapshot Cache
 * 
 * Centralizes ticker data fetching to prevent duplicate requests.
 * Multiple components request ticker data, but we only fetch once and cache.
 * 
 * This significantly reduces:
 * - Exchange API calls
 * - Rate limit hits
 * - Network overhead
 * - Server load
 */

export interface CachedTicker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
  vol: number;
  timestamp: number;
  cachedAt: number;
  source: string;
}

interface TickerRequest {
  symbol: string;
  resolve: (value: CachedTicker) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

export class TickerSnapshotCache {
  private cache = new Map<string, CachedTicker>();
  private pendingRequests = new Map<string, TickerRequest[]>();
  private cacheTTL = 5000; // 5 second cache
  private maxConcurrentFetches = 5;
  private activeFetches = 0;
  private fetchQueue: string[] = [];

  constructor(private exchanges: Map<string, any>, private cacheTTLMs = 5000) {
    this.cacheTTL = cacheTTLMs;
  }

  /**
   * Get ticker with automatic caching and deduplication
   */
  async getTicker(symbol: string, exchange?: any): Promise<CachedTicker> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
      return cached;
    }

    // Check if we're already fetching this symbol
    if (this.pendingRequests.has(symbol)) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.get(symbol)!.push({ symbol, resolve, reject, createdAt: Date.now() });
      });
    }

    // Deduplicate: wait for existing fetch or queue new one
    return new Promise((resolve, reject) => {
      const requests: TickerRequest[] = [{ symbol, resolve, reject, createdAt: Date.now() }];
      this.pendingRequests.set(symbol, requests);

      this.fetchTicker(symbol, exchange)
        .then(ticker => {
          this.cache.set(symbol, ticker);
          requests.forEach(req => req.resolve(ticker));
          this.pendingRequests.delete(symbol);
        })
        .catch(error => {
          requests.forEach(req => req.reject(error));
          this.pendingRequests.delete(symbol);
        });
    });
  }

  /**
   * Batch fetch tickers for multiple symbols
   */
  async getBatchTickers(symbols: string[], exchange?: any): Promise<Map<string, CachedTicker>> {
    const results = new Map<string, CachedTicker>();
    
    const fetches = symbols.map(symbol =>
      this.getTicker(symbol, exchange)
        .then(ticker => {
          results.set(symbol, ticker);
        })
        .catch(err => {
          console.warn(`[TickerCache] Failed to fetch ${symbol}:`, err.message);
        })
    );

    await Promise.all(fetches);
    return results;
  }

  /**
   * Internal fetch method - only called once per unique symbol
   */
  private async fetchTicker(symbol: string, exchange?: any): Promise<CachedTicker> {
    try {
      // Find the exchange adapter
      let adapter = exchange;
      if (!adapter) {
        // Try to find best exchange for this symbol
        for (const [, exch] of this.exchanges) {
          try {
            const ticker = await exch.fetchTicker(symbol);
            if (ticker) {
              adapter = exch;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!adapter) {
        throw new Error(`No exchange adapter available for ${symbol}`);
      }

      const raw = await adapter.fetchTicker(symbol);

      return {
        symbol,
        bid: raw.bid || raw.last,
        ask: raw.ask || raw.last,
        last: raw.last,
        high: raw.high,
        low: raw.low,
        vol: raw.quoteVolume || 0,
        timestamp: raw.timestamp || Date.now(),
        cachedAt: Date.now(),
        source: adapter.id || 'unknown'
      };
    } catch (error) {
      console.error(`[TickerCache] fetchTicker failed for ${symbol}:`, (error as any).message);
      throw error;
    }
  }

  /**
   * Invalidate cache for a symbol (e.g., after a trade)
   */
  invalidate(symbol: string): void {
    this.cache.delete(symbol);
  }

  /**
   * Invalidate all cached tickers
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedSymbols: this.cache.size,
      pendingFetches: this.pendingRequests.size,
      cacheTTL: this.cacheTTL,
      cachedItems: Array.from(this.cache.entries()).map(([symbol, ticker]) => ({
        symbol,
        age: Date.now() - ticker.cachedAt,
        stale: Date.now() - ticker.cachedAt > this.cacheTTL
      }))
    };
  }

  /**
   * Clean up stale cache entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [symbol, ticker] of this.cache.entries()) {
      if (now - ticker.cachedAt > this.cacheTTL * 2) {
        this.cache.delete(symbol);
      }
    }
  }
}

// Export singleton instance
let tickerCache: TickerSnapshotCache | null = null;

export function initTickerCache(exchanges: Map<string, any>, ttlMs = 5000): TickerSnapshotCache {
  tickerCache = new TickerSnapshotCache(exchanges, ttlMs);
  console.log('[TickerCache] Initialized with TTL:', ttlMs, 'ms');
  return tickerCache;
}

export function getTickerCache(): TickerSnapshotCache {
  if (!tickerCache) {
    throw new Error('[TickerCache] Not initialized. Call initTickerCache first.');
  }
  return tickerCache;
}
