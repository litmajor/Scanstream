
import { ExchangeDataFeed } from '../../trading-engine';
import { CacheManager } from './cache-manager';
import { RateLimiter } from './rate-limiter';
import type { PriceData, OHLCVData, ExchangeHealth } from '../../types/gateway';

/**
 * Exchange Aggregator
 * Unifies CCXT data fetching with Gateway intelligence
 * - Multi-exchange price aggregation
 * - Smart failover and fallback
 * - Deviation detection
 * - Health monitoring
 */
export class ExchangeAggregator {
  private exchangeDataFeed: ExchangeDataFeed | null = null;
  private cache: CacheManager;
  private rateLimiter: RateLimiter;
  private healthStatus: Map<string, ExchangeHealth>;
  
  // Exchange priority for data sources
  private readonly exchangePriority = [
    'binance',
    'kucoinfutures', 
    'coinbase',
    'okx',
    'bybit',
    'kraken'
  ];

  constructor(cache: CacheManager, rateLimiter: RateLimiter) {
    this.cache = cache;
    this.rateLimiter = rateLimiter;
    this.healthStatus = new Map();
  }

  /**
   * Initialize with ExchangeDataFeed
   */
  async initialize(): Promise<void> {
    try {
      this.exchangeDataFeed = await ExchangeDataFeed.create();
      console.log('[Gateway] ExchangeAggregator initialized with CCXT');
      
      // Initialize health monitoring for each exchange
      for (const exchange of this.exchangePriority) {
        this.healthStatus.set(exchange, {
          exchange,
          healthy: true,
          latency: 0,
          rateUsage: 0,
          consecutiveFailures: 0
        });
      }
    } catch (error) {
      console.error('[Gateway] Failed to initialize ExchangeAggregator:', error);
      throw error;
    }
  }

  /**
   * Get aggregated price from multiple exchanges
   * Returns median price with confidence score
   */
  async getAggregatedPrice(symbol: string): Promise<PriceData> {
    const cacheKey = `price:${symbol}`;
    
    // Check cache first
    const cached = this.cache.get<PriceData>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.exchangeDataFeed) {
      throw new Error('ExchangeAggregator not initialized');
    }

    const prices: Array<{ exchange: string; price: number; timestamp: Date }> = [];
    const errors: string[] = [];

    // Fetch from all healthy exchanges in parallel
    const fetchPromises = this.exchangePriority
      .filter(exchange => this.isExchangeHealthy(exchange))
      .map(async (exchange) => {
        try {
          await this.rateLimiter.acquire(exchange, 'high');
          
          const startTime = Date.now();
          const frames = await this.exchangeDataFeed!.fetchMarketData(
            symbol, 
            '1m', 
            1, 
            exchange
          );
          
          const latency = Date.now() - startTime;
          this.updateExchangeHealth(exchange, true, latency);
          
          if (frames && frames.length > 0) {
            const price = (frames[0].price as any).close;
            prices.push({
              exchange,
              price,
              timestamp: new Date()
            });
          }
        } catch (error: any) {
          this.updateExchangeHealth(exchange, false);
          errors.push(`${exchange}: ${error.message}`);
        }
      });

    await Promise.allSettled(fetchPromises);

    // Need at least 2 sources for confidence
    if (prices.length < 2) {
      throw new Error(`Insufficient price sources: ${prices.length}. Errors: ${errors.join(', ')}`);
    }

    // Calculate median price
    const priceValues = prices.map(p => p.price).sort((a, b) => a - b);
    const medianPrice = priceValues[Math.floor(priceValues.length / 2)];

    // Calculate deviation
    const maxDeviation = Math.max(...priceValues.map(p => Math.abs(p - medianPrice) / medianPrice));

    // Confidence score based on agreement and number of sources
    const confidence = Math.min(100, 
      (1 - maxDeviation) * 70 + // Agreement weight
      (prices.length / this.exchangePriority.length) * 30 // Source diversity weight
    );

    const result: PriceData = {
      symbol,
      price: medianPrice,
      confidence,
      sources: prices.map(p => p.exchange),
      deviation: maxDeviation * 100,
      timestamp: new Date()
    };

    // Cache for 10 seconds
    this.cache.set(cacheKey, result, 10000);

    return result;
  }

  /**
   * Get OHLCV data with fallback logic
   */
  async getOHLCV(
    symbol: string, 
    timeframe: string = '1m', 
    limit: number = 100
  ): Promise<OHLCVData[]> {
    const cacheKey = `ohlcv:${symbol}:${timeframe}:${limit}`;
    
    // Check cache
    const cached = this.cache.get<OHLCVData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.exchangeDataFeed) {
      throw new Error('ExchangeAggregator not initialized');
    }

    // Try exchanges in priority order until one succeeds
    for (const exchange of this.exchangePriority) {
      if (!this.isExchangeHealthy(exchange)) {
        continue;
      }

      try {
        await this.rateLimiter.acquire(exchange, 'normal');
        
        const startTime = Date.now();
        const frames = await this.exchangeDataFeed.fetchMarketData(
          symbol,
          timeframe,
          limit,
          exchange
        );
        
        const latency = Date.now() - startTime;
        this.updateExchangeHealth(exchange, true, latency);

        // Convert to OHLCV format
        const ohlcv: OHLCVData[] = frames.map(frame => ({
          timestamp: new Date(frame.timestamp).getTime(),
          open: (frame.price as any).open,
          high: (frame.price as any).high,
          low: (frame.price as any).low,
          close: (frame.price as any).close,
          volume: frame.volume,
          exchange
        }));

        // Cache for 1 minute
        this.cache.set(cacheKey, ohlcv, 60000);

        return ohlcv;
      } catch (error: any) {
        this.updateExchangeHealth(exchange, false);
        console.warn(`[Gateway] Failed to fetch from ${exchange}: ${error.message}`);
        continue;
      }
    }

    throw new Error(`Failed to fetch OHLCV for ${symbol} from all exchanges`);
  }

  /**
   * Get market data with full indicators (for signal generation)
   */
  async getMarketFrames(
    symbol: string,
    timeframe: string = '1m',
    limit: number = 100
  ) {
    if (!this.exchangeDataFeed) {
      throw new Error('ExchangeAggregator not initialized');
    }

    // Try to use the most reliable exchange
    for (const exchange of this.exchangePriority) {
      if (!this.isExchangeHealthy(exchange)) {
        continue;
      }

      try {
        await this.rateLimiter.acquire(exchange, 'normal');
        
        const frames = await this.exchangeDataFeed.fetchMarketData(
          symbol,
          timeframe,
          limit,
          exchange
        );

        this.rateLimiter.recordSuccess(exchange);
        return frames;
      } catch (error: any) {
        this.rateLimiter.recordFailure(exchange);
        console.warn(`[Gateway] Failed to fetch market frames from ${exchange}: ${error.message}`);
        continue;
      }
    }

    throw new Error(`Failed to fetch market frames for ${symbol}`);
  }

  /**
   * Check if exchange is healthy
   */
  private isExchangeHealthy(exchange: string): boolean {
    const health = this.healthStatus.get(exchange);
    if (!health) return false;
    
    // If temporarily disabled due to geo-restriction, check if recovery time has passed (5 minutes)
    if (!health.healthy && health.isGeoRestricted) {
      const timeSinceError = Date.now() - (health.lastErrorTime?.getTime() || 0);
      if (timeSinceError > 5 * 60 * 1000) { // 5 minute recovery window
        health.healthy = true;
        health.consecutiveFailures = 0;
        health.isGeoRestricted = false;
        this.healthStatus.set(exchange, health);
        console.log(`[Gateway] Retrying geo-restricted exchange: ${exchange}`);
      }
    }
    
    return health.healthy && health.consecutiveFailures < 10;
  }

  /**
   * Check if error is a geo-restriction (403/451)
   */
  private isGeoRestrictionError(error: any): boolean {
    const message = error?.message || '';
    const statusCode = error?.status || error?.statusCode || 0;
    return statusCode === 403 || statusCode === 451 || 
           message.includes('403') || message.includes('451') ||
           message.includes('Forbidden') || message.includes('geo') ||
           message.includes('restricted') || message.includes('CloudFront');
  }

  /**
   * Update exchange health status with intelligent error handling
   */
  private updateExchangeHealth(
    exchange: string, 
    success: boolean, 
    latency: number = 0,
    error?: any
  ): void {
    const health = this.healthStatus.get(exchange);
    if (!health) return;

    if (success) {
      health.healthy = true;
      health.latency = latency;
      health.consecutiveFailures = 0;
      health.lastError = undefined;
      health.lastErrorTime = undefined;
      health.isGeoRestricted = false;
    } else {
      const isGeoRestricted = this.isGeoRestrictionError(error);
      
      if (isGeoRestricted) {
        // Geo-restricted exchanges get more patience
        health.isGeoRestricted = true;
        health.consecutiveFailures = Math.min(health.consecutiveFailures + 1, 3); // Cap at 3 before disabling
        health.lastErrorTime = new Date();
        
        if (health.consecutiveFailures >= 3) {
          health.healthy = false;
          // Log once when disabled, then quiet
          if (health.consecutiveFailures === 3) {
            console.warn(`[Gateway] Exchange ${exchange} temporarily disabled (geo-restricted). Will retry in 5 minutes.`);
          }
        }
        // Don't log individual geo-restriction errors - they're expected
      } else {
        // Regular errors count more heavily
        health.consecutiveFailures++;
        health.lastErrorTime = new Date();
        
        if (health.consecutiveFailures >= 5) {
          health.healthy = false;
          if (health.consecutiveFailures === 5) {
            console.warn(`[Gateway] Exchange ${exchange} marked as unhealthy after ${health.consecutiveFailures} failures: ${error?.message}`);
          }
        }
      }
    }

    this.healthStatus.set(exchange, health);
  }

  /**
   * Get health status for all exchanges
   */
  getHealthStatus(): Record<string, ExchangeHealth> {
    const status: Record<string, ExchangeHealth> = {};
    for (const [exchange, health] of this.healthStatus.entries()) {
      status[exchange] = { ...health };
    }
    return status;
  }

  /**
   * Reset exchange health (for recovery)
   */
  resetExchangeHealth(exchange: string): void {
    const health = this.healthStatus.get(exchange);
    if (health) {
      health.healthy = true;
      health.consecutiveFailures = 0;
      health.lastError = undefined;
      health.lastErrorTime = undefined;
      this.healthStatus.set(exchange, health);
      console.log(`[Gateway] Exchange ${exchange} health reset`);
    }
  }
}
