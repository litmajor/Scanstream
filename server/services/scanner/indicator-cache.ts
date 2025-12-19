/**
 * Indicator Caching Layer
 * 
 * Caches computed indicator arrays per timeframe to avoid redundant calculations.
 * Supports TTL-based expiration and memory-efficient storage.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface IndicatorCacheOptions {
  /** TTL in milliseconds for cached entries. Default: 60000ms (1 minute) */
  ttlMs?: number;
  /** Max entries to keep in cache before eviction. Default: 1000 */
  maxEntries?: number;
  /** Enable debug logging for cache hits/misses */
  debug?: boolean;
}

/**
 * High-performance cache for indicator arrays keyed by (symbol, timeframe, indicator_name).
 * Automatically evicts stale entries and maintains memory bounds.
 */
export class IndicatorCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly debug: boolean;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(opts?: IndicatorCacheOptions) {
    this.ttlMs = opts?.ttlMs ?? 60_000;
    this.maxEntries = opts?.maxEntries ?? 1000;
    this.debug = opts?.debug ?? false;
  }

  /**
   * Generate cache key from symbol, timeframe, and indicator name.
   */
  private getKey(symbol: string, timeframe: string, indicatorName: string): string {
    return `${symbol}:${timeframe}:${indicatorName}`;
  }

  /**
   * Check if cached entry is still valid (not expired).
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Get cached indicator array. Returns undefined if not found or expired.
   */
  get<T = any>(symbol: string, timeframe: string, indicatorName: string): T | undefined {
    const key = this.getKey(symbol, timeframe, indicatorName);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      if (this.debug) console.log(`[IndicatorCache] MISS: ${key}`);
      return undefined;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      if (this.debug) console.log(`[IndicatorCache] EXPIRED: ${key}`);
      return undefined;
    }

    this.stats.hits++;
    if (this.debug) console.log(`[IndicatorCache] HIT: ${key}`);
    return entry.data as T;
  }

  /**
   * Set cached indicator array with automatic TTL expiration.
   */
  set<T = any>(symbol: string, timeframe: string, indicatorName: string, data: T): void {
    const key = this.getKey(symbol, timeframe, indicatorName);

    // Enforce size limit: simple FIFO eviction when approaching max
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
        if (this.debug) console.log(`[IndicatorCache] EVICTED: ${firstKey}`);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  /**
   * Batch set multiple indicators at once. Useful for bulk indicator computation.
   */
  setBatch(symbol: string, timeframe: string, indicators: Record<string, any>): void {
    for (const [name, data] of Object.entries(indicators)) {
      this.set(symbol, timeframe, name, data);
    }
  }

  /**
   * Batch get multiple indicators. Returns only cached hits; missing ones are undefined.
   */
  getBatch(symbol: string, timeframe: string, indicatorNames: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const name of indicatorNames) {
      const cached = this.get(symbol, timeframe, name);
      if (cached !== undefined) result[name] = cached;
    }
    return result;
  }

  /**
   * Invalidate all cache entries for a symbol/timeframe (e.g., on new data).
   */
  invalidateTimeframe(symbol: string, timeframe: string): number {
    let count = 0;
    const prefix = `${symbol}:${timeframe}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (this.debug) console.log(`[IndicatorCache] INVALIDATED ${count} entries for ${symbol}/${timeframe}`);
    return count;
  }

  /**
   * Invalidate all entries for a symbol (e.g., symbol delisted or config changed).
   */
  invalidateSymbol(symbol: string): number {
    let count = 0;
    const prefix = `${symbol}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (this.debug) console.log(`[IndicatorCache] INVALIDATED ${count} entries for ${symbol}`);
    return count;
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
    if (this.debug) console.log(`[IndicatorCache] CLEARED`);
  }

  /**
   * Get cache statistics (hits, misses, evictions).
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses)
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get approximate memory usage in bytes (rough estimate).
   */
  getMemoryUsageEstimate(): number {
    let bytes = 0;
    for (const entry of this.cache.values()) {
      if (Array.isArray(entry.data)) {
        // Rough estimate: each number is ~8 bytes, plus object overhead
        bytes += entry.data.length * 8 + 50;
      } else if (typeof entry.data === 'object') {
        // Complex object: estimate ~100 bytes base + nested size
        bytes += JSON.stringify(entry.data).length + 100;
      } else {
        bytes += 50;
      }
    }
    return bytes;
  }
}

export default IndicatorCache;
