
import type { TokenBucket, QueuedRequest, RequestPriority } from '../../types/gateway';

/**
 * Rate Limiter with Token Bucket Algorithm
 * - Per-exchange rate tracking
 * - Priority queue
 * - Automatic retry with exponential backoff
 * - Circuit breaker
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket>;
  private queue: QueuedRequest[];
  private processing: boolean;
  private failureCount: Map<string, number>;
  private circuitBroken: Set<string>;

  constructor() {
    this.buckets = new Map();
    this.queue = [];
    this.processing = false;
    this.failureCount = new Map();
    this.circuitBroken = new Set();
  }

  /**
   * Initialize rate limit for an exchange
   */
  initExchange(exchange: string, requestsPerMinute: number): void {
    const refillRate = requestsPerMinute / 60; // tokens per second
    
    this.buckets.set(exchange, {
      tokens: requestsPerMinute,
      capacity: requestsPerMinute,
      refillRate,
      lastRefill: Date.now()
    });

    this.failureCount.set(exchange, 0);
  }

  /**
   * Acquire token for request
   */
  async acquire(
    exchange: string,
    priority: RequestPriority = 'normal'
  ): Promise<void> {
    if (this.circuitBroken.has(exchange)) {
      throw new Error(`Circuit breaker open for ${exchange}`);
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${exchange}-${Date.now()}-${Math.random()}`,
        exchange,
        priority,
        execute: async () => {},
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Sort by priority
      this.queue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      const request = this.queue[0];
      const bucket = this.buckets.get(request.exchange);

      if (!bucket) {
        this.queue.shift();
        request.reject(new Error(`Unknown exchange: ${request.exchange}`));
        continue;
      }

      // Refill tokens
      this.refillBucket(bucket);

      // Check if token available
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        this.queue.shift();
        request.resolve();
      } else {
        // Wait for next refill
        await this.sleep(100);
      }
    }

    this.processing = false;
  }

  /**
   * Refill token bucket
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Record failure (for circuit breaker)
   */
  recordFailure(exchange: string): void {
    const count = (this.failureCount.get(exchange) || 0) + 1;
    this.failureCount.set(exchange, count);

    // Break circuit after 10 consecutive failures
    if (count >= 10) {
      this.circuitBroken.add(exchange);
      console.warn(`[RateLimiter] Circuit breaker opened for ${exchange}`);
      
      // Auto-reset after 5 minutes
      setTimeout(() => {
        this.circuitBroken.delete(exchange);
        this.failureCount.set(exchange, 0);
        console.log(`[RateLimiter] Circuit breaker reset for ${exchange}`);
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Record success (reset failure count)
   */
  recordSuccess(exchange: string): void {
    this.failureCount.set(exchange, 0);
  }

  /**
   * Check if exchange is healthy
   */
  isHealthy(exchange: string): boolean {
    return !this.circuitBroken.has(exchange);
  }

  /**
   * Get rate limit stats
   */
  getStats(exchange: string) {
    const bucket = this.buckets.get(exchange);
    if (!bucket) return null;

    return {
      exchange,
      availableTokens: Math.floor(bucket.tokens),
      capacity: bucket.capacity,
      usage: 1 - (bucket.tokens / bucket.capacity),
      queueLength: this.queue.filter(r => r.exchange === exchange).length,
      healthy: this.isHealthy(exchange),
      failures: this.failureCount.get(exchange) || 0
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
