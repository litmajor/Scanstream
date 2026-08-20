/**
 * Venue-scoped, memory-only ticker snapshots.
 *
 * This cache is an optimization for market-data reads, never an authority for
 * exposure or execution state. It starts empty after every process restart.
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

interface PendingFetch {
  promise: Promise<CachedTicker | null>;
}

interface FailureBackoff {
  until: number;
  reason: string;
}

export interface TickerSnapshotCacheOptions {
  ttlMs?: number;
  maxConcurrentFetches?: number;
  failureBackoffMs?: number;
  clock?: () => number;
}

interface QueuedFetch {
  task: () => Promise<CachedTicker | null>;
  resolve: (value: CachedTicker | null) => void;
  reject: (error: unknown) => void;
}

export class TickerSnapshotCache {
  private readonly cache = new Map<string, CachedTicker>();
  private readonly pendingRequests = new Map<string, PendingFetch>();
  private readonly cacheTTL: number;
  private readonly maxConcurrentFetches: number;
  private readonly failureBackoffMs: number;
  private readonly clock: () => number;
  private readonly failures = new Map<string, FailureBackoff>();
  private readonly generations = new Map<string, number>();
  private readonly fetchQueue: QueuedFetch[] = [];
  private activeFetches = 0;

  constructor(
    private readonly exchanges: Map<string, any>,
    cacheTTLMs = 5000,
    options: TickerSnapshotCacheOptions = {},
  ) {
    this.cacheTTL = options.ttlMs ?? cacheTTLMs;
    this.maxConcurrentFetches = Math.max(1, Math.floor(options.maxConcurrentFetches ?? 5));
    this.failureBackoffMs = Math.max(1, options.failureBackoffMs ?? 1000);
    this.clock = options.clock ?? Date.now;
  }

  /**
   * Read a ticker for an explicit venue. A missing venue is unknown; this
   * method never silently substitutes another exchange.
   */
  async getTicker(
    symbol: string,
    exchange?: any,
    maxAgeMs: number = this.cacheTTL,
  ): Promise<CachedTicker | null> {
    const venue = this.venueId(exchange);
    if (!venue || !exchange || typeof exchange.fetchTicker !== 'function') return null;

    const key = this.key(symbol, venue);
    const generation = this.generations.get(key) ?? 0;
    if (!this.generations.has(key)) this.generations.set(key, generation);
    const now = this.clock();
    const cached = this.cache.get(key);
    const requestedAge = Number.isFinite(maxAgeMs) && maxAgeMs >= 0 ? maxAgeMs : this.cacheTTL;
    if (cached && now - cached.cachedAt <= requestedAge) return cached;
    if (cached) this.cache.delete(key);

    const failure = this.failures.get(key);
    if (failure && now < failure.until) return null;
    if (failure) this.failures.delete(key);

    const pending = this.pendingRequests.get(key);
    if (pending) {
      const fetched = await pending.promise;
      return this.generations.get(key) === generation &&
        fetched && this.clock() - fetched.cachedAt <= requestedAge ? fetched : null;
    }

    const promise = this.enqueue(async () => {
      try {
        const ticker = await this.fetchTicker(symbol, exchange, venue);
        if (ticker && this.generations.get(key) === generation) {
          this.cache.set(key, ticker);
          this.failures.delete(key);
        }
        return ticker;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.failures.set(key, { until: this.clock() + this.failureBackoffMs, reason });
        return null;
      }
    });
    this.pendingRequests.set(key, { promise });
    try {
      const fetched = await promise;
      return this.generations.get(key) === generation &&
        fetched && this.clock() - fetched.cachedAt <= requestedAge ? fetched : null;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  async getBatchTickers(
    symbols: string[],
    exchange: any,
    maxAgeMs: number = this.cacheTTL,
  ): Promise<Map<string, CachedTicker>> {
    const results = new Map<string, CachedTicker>();
    await Promise.all(symbols.map(async (symbol) => {
      const ticker = await this.getTicker(symbol, exchange, maxAgeMs);
      if (ticker) results.set(symbol, ticker);
    }));
    return results;
  }

  /** Invalidate one venue-scoped ticker key. */
  invalidate(symbol: string, exchange?: any): void {
    if (exchange) {
      const venue = this.venueId(exchange);
      if (venue) this.invalidateKey(this.key(symbol, venue));
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${symbol}`)) this.invalidateKey(key);
    }
  }

  /** Invalidate every cached ticker for one venue. */
  invalidateVenue(venue: string): number {
    let removed = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${venue}:`)) {
        this.invalidateKey(key);
        removed += 1;
      }
    }
    return removed;
  }

  invalidateAll(): void {
    for (const key of new Set([
      ...this.cache.keys(),
      ...this.pendingRequests.keys(),
      ...this.failures.keys(),
    ])) {
      this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    }
    this.cache.clear();
    this.failures.clear();
  }

  getStats() {
    const now = this.clock();
    return {
      cachedSymbols: this.cache.size,
      pendingFetches: this.pendingRequests.size,
      cacheTTL: this.cacheTTL,
      activeFetches: this.activeFetches,
      queuedFetches: this.fetchQueue.length,
      failuresInBackoff: Array.from(this.failures.entries()).filter(([, failure]) => failure.until > now).length,
      cachedItems: Array.from(this.cache.entries()).map(([key, ticker]) => ({
        key,
        symbol: ticker.symbol,
        source: ticker.source,
        age: now - ticker.cachedAt,
        stale: now - ticker.cachedAt > this.cacheTTL,
      })),
    };
  }

  cleanup(): void {
    const now = this.clock();
    for (const [key, ticker] of this.cache.entries()) {
      if (now - ticker.cachedAt > this.cacheTTL) this.cache.delete(key);
    }
    for (const [key, failure] of this.failures.entries()) {
      if (failure.until <= now) this.failures.delete(key);
    }
  }

  private key(symbol: string, venue: string): string {
    return `${venue}:${symbol}`;
  }

  private venueId(exchange: any): string | null {
    if (!exchange) return null;
    for (const [id, candidate] of this.exchanges.entries()) {
      if (candidate === exchange) return id;
    }
    const id = exchange.id ?? exchange.name ?? exchange.exchangeId;
    return typeof id === 'string' && id.trim() ? id.trim() : 'explicit';
  }

  private invalidateKey(key: string): void {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    this.cache.delete(key);
    this.failures.delete(key);
  }

  private enqueue(task: () => Promise<CachedTicker | null>): Promise<CachedTicker | null> {
    return new Promise((resolve, reject) => {
      this.fetchQueue.push({ task, resolve, reject });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    while (this.activeFetches < this.maxConcurrentFetches && this.fetchQueue.length > 0) {
      const queued = this.fetchQueue.shift()!;
      this.activeFetches += 1;
      queued.task().then(queued.resolve, queued.reject).finally(() => {
        this.activeFetches -= 1;
        this.drainQueue();
      });
    }
  }

  private async fetchTicker(symbol: string, exchange: any, venue: string): Promise<CachedTicker | null> {
    const raw = await exchange.fetchTicker(symbol);
    const last = Number(raw?.last);
    if (!Number.isFinite(last) || last <= 0) throw new Error('ticker price is invalid');
    const cachedAt = this.clock();
    return {
      symbol,
      bid: Number.isFinite(Number(raw?.bid)) ? Number(raw.bid) : last,
      ask: Number.isFinite(Number(raw?.ask)) ? Number(raw.ask) : last,
      last,
      high: Number.isFinite(Number(raw?.high)) ? Number(raw.high) : last,
      low: Number.isFinite(Number(raw?.low)) ? Number(raw.low) : last,
      vol: Number.isFinite(Number(raw?.quoteVolume)) ? Number(raw.quoteVolume) : 0,
      timestamp: Number.isFinite(Number(raw?.timestamp)) ? Number(raw.timestamp) : 0,
      cachedAt,
      source: venue,
    };
  }
}

let tickerCache: TickerSnapshotCache | null = null;

export function initTickerCache(
  exchanges: Map<string, any>,
  ttlMs = 5000,
  options: TickerSnapshotCacheOptions = {},
): TickerSnapshotCache {
  tickerCache = new TickerSnapshotCache(exchanges, ttlMs, options);
  console.log('[TickerCache] Initialized with TTL:', ttlMs, 'ms');
  return tickerCache;
}

export function getTickerCache(): TickerSnapshotCache {
  if (!tickerCache) {
    throw new Error('[TickerCache] Not initialized. Call initTickerCache first.');
  }
  return tickerCache;
}
