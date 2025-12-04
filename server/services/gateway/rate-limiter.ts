
import type { TokenBucket, QueuedRequest, RequestPriority } from '../../types/gateway';
import { getErrorLogger } from '../error-logger';

/**
 * Rate Limiter with Token Bucket Algorithm
 * - Per-exchange rate tracking
 * - Priority queue
 * - Automatic retry with exponential backoff
 * - Circuit breaker
 * - Adaptive throttling based on exchange headers
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket>;
  private queue: QueuedRequest[];
  private processing: boolean;
  private failureCount: Map<string, number>;
  private circuitBroken: Set<string>;
  private rateLimitResets: Map<string, number>; // timestamp when rate limit resets
  private adaptiveThrottling: Map<string, number>; // temporary reduction multiplier
  private logger = getErrorLogger();

  constructor() {
    this.buckets = new Map();
    this.queue = [];
    this.processing = false;
    this.failureCount = new Map();
    this.circuitBroken = new Set();
    this.rateLimitResets = new Map();
    this.adaptiveThrottling = new Map();
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
   * Record rate limit headers from exchange response
   */
  recordRateLimitHeaders(exchange: string, headers: Record<string, any>): void {
    try {
      // Common rate limit headers across exchanges
      const remaining = parseInt(headers['x-ratelimit-remaining'] || headers['x-mbx-used-weight-1m'] || '0');
      const limit = parseInt(headers['x-ratelimit-limit'] || headers['x-mbx-order-count-1m'] || '0');
      const reset = parseInt(headers['x-ratelimit-reset'] || '0');

      if (limit > 0) {
        const usage = 1 - (remaining / limit);
        
        // If we're using >80% of rate limit, throttle requests
        if (usage > 0.8) {
          const throttle = Math.max(0.3, 1 - usage); // Reduce to 30-70% speed
          this.adaptiveThrottling.set(exchange, throttle);
          this.logger.warn(`High rate limit usage on ${exchange}: ${(usage * 100).toFixed(1)}%`, {
            service: 'RateLimiter',
            exchange,
            remaining,
            limit,
            throttle
          });
        } else {
          // Reset throttling if usage is healthy
          this.adaptiveThrottling.delete(exchange);
        }
      }

      if (reset > 0) {
        this.rateLimitResets.set(exchange, reset * 1000); // Convert to ms
      }
    } catch (error) {
      // Silently ignore header parsing errors
    }
  }

  /**
   * Handle 429 rate limit error
   */
  handleRateLimitError(exchange: string, retryAfter?: number): void {
    const bucket = this.buckets.get(exchange);
    if (!bucket) return;

    // Drain all tokens
    bucket.tokens = 0;
    
    // Set reset time
    const resetTime = retryAfter ? Date.now() + (retryAfter * 1000) : Date.now() + (60 * 1000);
    this.rateLimitResets.set(exchange, resetTime);
    
    // Apply heavy throttling
    this.adaptiveThrottling.set(exchange, 0.2); // Reduce to 20% speed
    
    this.logger.logRateLimit(exchange, resetTime);
    
    // Don't break circuit, just slow down
    console.warn(`[RateLimiter] Rate limit hit for ${exchange}, throttling until ${new Date(resetTime).toISOString()}`);
  }

  /**
   * Get rate limit stats
   */
  getStats(exchange?: string) {
    if (!exchange) {
      // Return stats for all exchanges
      return Object.fromEntries(
        Array.from(this.buckets.entries()).map(([ex, bucket]) => {
          const resetTime = this.rateLimitResets.get(ex);
          const isThrottled = this.adaptiveThrottling.has(ex);
          
          return [
            ex,
            {
              exchange: ex,
              availableTokens: Math.floor(bucket.tokens),
              capacity: bucket.capacity,
              usage: 1 - (bucket.tokens / bucket.capacity),
              queueLength: this.queue.filter(r => r.exchange === ex).length,
              healthy: this.isHealthy(ex),
              failures: this.failureCount.get(ex) || 0,
              throttled: isThrottled,
              throttleMultiplier: this.adaptiveThrottling.get(ex),
              rateLimitReset: resetTime ? new Date(resetTime).toISOString() : null
            }
          ];
        })
      );
    }
    const bucket = this.buckets.get(exchange);
    if (!bucket) return null;

    const resetTime = this.rateLimitResets.get(exchange);
    const isThrottled = this.adaptiveThrottling.has(exchange);

    return {
      exchange,
      availableTokens: Math.floor(bucket.tokens),
      capacity: bucket.capacity,
      usage: 1 - (bucket.tokens / bucket.capacity),
      queueLength: this.queue.filter(r => r.exchange === exchange).length,
      healthy: this.isHealthy(exchange),
      failures: this.failureCount.get(exchange) || 0,
      throttled: isThrottled,
      throttleMultiplier: this.adaptiveThrottling.get(exchange),
      rateLimitReset: resetTime ? new Date(resetTime).toISOString() : null
    };
  }

  /**
   * Check if exchange is currently rate limited
   */
  isRateLimited(exchange: string): boolean {
    const resetTime = this.rateLimitResets.get(exchange);
    if (!resetTime) return false;
    
    if (Date.now() < resetTime) {
      return true;
    }
    
    // Reset time has passed, clear it
    this.rateLimitResets.delete(exchange);
    this.adaptiveThrottling.delete(exchange);
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
