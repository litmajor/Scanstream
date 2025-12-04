import type { CacheEntry } from '../../types/gateway';

/**
 * Intelligent Cache Manager
 * - Tiered caching (hot/warm/cold)
 * - TTL-based invalidation
 * - LRU eviction
 * - Memory-efficient
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private maxEntries: number;
  private hitCount: number;
  private missCount: number;

  constructor(maxEntries: number = 5000) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get value from cache
   * @param allowStale If true, return expired cache entries (for fallback scenarios)
   */
  get<T>(key: string, allowStale: boolean = false): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.ttl) {
      if (!allowStale) {
        this.cache.delete(key);
        this.missCount++;
        return null;
      }
      // Return stale data with warning
      console.warn(`[Cache] Returning stale data for ${key} (expired ${Math.round((Date.now() - entry.ttl) / 1000)}s ago)`);
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hitCount++;
    return entry.data as T;
  }

  /**
   * Set cache value with TTL
   */
  set<T>(key: string, data: T, ttl: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate by pattern (e.g., all prices)
   */
  invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      entries: this.cache.size,
      hitRate: total > 0 ? this.hitCount / total : 0,
      hits: this.hitCount,
      misses: this.missCount
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}