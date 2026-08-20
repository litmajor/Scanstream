
import { ExchangeDataFeed } from '../../trading-engine';
import { CacheManager } from './cache-manager';
import { RateLimiter } from './rate-limiter';
import type { PriceData, OHLCVData, ExchangeHealth } from '../../types/gateway';
import { recordIntegrityBypassBlocked } from '../observability/safety-metrics';
import { getSharedService } from '../shared-service-registry';

/**
 * Exchange Aggregator
 * Unifies CCXT data fetching with Gateway intelligence
 * - Multi-exchange price aggregation
 * - Smart failover and fallback
 * - Deviation detection
 * - Health monitoring
 */
export class ExchangeAggregator {
  private exchangeDataFeed: any = null;
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

  getExchangeInstances(): Map<string, any> {
    if (!this.exchangeDataFeed) {
      return new Map();
    }
    return (this.exchangeDataFeed as any).getExchangeInstances ? (this.exchangeDataFeed as any).getExchangeInstances() : new Map();
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

    // Prefer canonical consensus from TruthEngine when available and fresh
    try {
      const truth = getSharedService('truthEngine');
      if (truth && typeof truth.getConsensus === 'function') {
        const c = truth.getConsensus(symbol);
        if (c && typeof c.price === 'number' && c.price > 0) {
          const result: PriceData = {
            symbol,
            price: c.price,
            confidence: Math.min(100, Math.max(0, Number(c.confidence) || 0)),
            sources: c.sources || [],
            deviation: 0,
            timestamp: new Date(c.timestamp || Date.now())
          };
          // Cache the consensus-derived value briefly for callers
          this.cache.set(cacheKey, result, 30_000);
          return result;
        }
      }
    } catch (e) {
      // non-fatal — fall back to exchange scraping
    }

    const prices: Array<{ exchange: string; price: number; timestamp: Date }> = [];
    const errors: string[] = [];

    // Prefer the chosen venue first and then try other healthy exchanges sequentially
    const preferred = this.chooseVenueForSymbol(symbol);
    const healthy = this.exchangePriority.filter(exchange => this.isExchangeHealthy(exchange));
    const candidates = preferred ? [preferred, ...healthy.filter(e => e !== preferred)] : healthy;

    const maxSources = Math.min(3, candidates.length); // stop after collecting up to 3 sources

    for (const exchange of candidates) {
      if (prices.length >= maxSources) break;
      try {
        await this.rateLimiter.acquire(exchange, 'high');
        const startTime = Date.now();
        const frames = await this.exchangeDataFeed!.fetchMarketData(symbol, '1m', 1, exchange);
        const latency = Date.now() - startTime;
        this.updateExchangeHealth(exchange, true, latency);

        if (frames && frames.length > 0) {
          const price = (frames[0].price as any).close;
          prices.push({ exchange, price, timestamp: new Date() });
        }
      } catch (error: any) {
        this.updateExchangeHealth(exchange, false, 0, error);
        errors.push(`${exchange}: ${error.message}`);
        // continue to next candidate
      }
    }

    if (prices.length === 0) {
      throw new Error(`Insufficient price sources: ${prices.length}. Errors: ${errors.join(', ')}`);
    }

    // Calculate median price
    const priceValues = prices.map(p => p.price).sort((a, b) => a - b);
    const medianPrice = priceValues[Math.floor(priceValues.length / 2)];

    // Calculate deviation
    const maxDeviation = Math.max(...priceValues.map(p => Math.abs(p - medianPrice) / (medianPrice || 1)));

    // Confidence score based on agreement and number of sources
    let confidence = Math.min(100,
      (1 - maxDeviation) * 70 + // Agreement weight
      (prices.length / this.exchangePriority.length) * 30 // Source diversity weight
    );
    // If only single source, degrade confidence to reflect low redundancy
    if (prices.length === 1) confidence = Math.min(confidence, 40);

    const result: PriceData = {
      symbol,
      price: medianPrice,
      confidence,
      sources: prices.map(p => p.exchange),
      deviation: maxDeviation * 100,
      timestamp: new Date()
    };

    // Cache for 3 minutes (180 seconds)
    this.cache.set(cacheKey, result, 180000);

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
        // Skip if rate limited
        if (this.rateLimiter.isRateLimited(exchange)) {
          console.log(`[Gateway] Skipping ${exchange} (rate limited)`);
          continue;
        }

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
        const ohlcv: OHLCVData[] = frames.map((frame: any) => ({
          timestamp: new Date(frame.timestamp).getTime(),
          open: (frame.price as any).open,
          high: (frame.price as any).high,
          low: (frame.price as any).low,
          close: (frame.price as any).close,
          volume: frame.volume,
          exchange
        }));

        // Cache for 3 minutes (OHLCV - scanner prices)
        this.cache.set(cacheKey, ohlcv, 180000);

        return ohlcv;
      } catch (error: any) {
        // Handle rate limit errors specifically
        if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
          const retryAfter = parseInt(error.headers?.['retry-after'] || '60');
          this.rateLimiter.handleRateLimitError(exchange, retryAfter);
        }
        
        this.updateExchangeHealth(exchange, false, 0, error);
        // Only log if not a geo-restriction error or rate limit
        if (!this.isGeoRestrictionError(error) && !error.message?.includes('429')) {
          console.warn(`[Gateway] Failed to fetch from ${exchange}: ${error.message}`);
        }
        continue;
      }
    }

    // Try to return stale cache data if all exchanges failed
    const staleCache = this.cache.get<OHLCVData[]>(cacheKey, true); // Get even if expired
    if (staleCache) {
      console.warn(`[Gateway] All exchanges failed for ${symbol}, returning stale cache data`);
      return staleCache;
    }

    throw new Error(`Failed to fetch OHLCV for ${symbol} from all exchanges and no cache available`);
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

        // NEW: Process through integrity gate before returning
        try {
          const { getIntegrityGate } = await import('../market-data/integrity-gate');
          const gate = getIntegrityGate();

          // Convert to candle format
          const candles = frames.map((f: any) => ({
            ts: Math.floor((f.timestamp || Date.now()) as number),
            open: (f.price as any)?.open || (f as any).open || 0,
            high: (f.price as any)?.high || (f as any).high || 0,
            low: (f.price as any)?.low || (f as any).low || 0,
            close: (f.price as any)?.close || (f as any).close || 0,
            volume: f.volume || 0,
            isFinal: true,
            source: 'historical',
            origin: 'ccxt',
            venue: exchange
          }));

          // Get timeframe in seconds
          const timeframeSeconds = this.parseTimeframeToSeconds(timeframe);

          // Validate through integrity layer
          const result = await gate.storeValidatedCandles(
            symbol,
            timeframeSeconds,
            candles as any
          );

          if (result.rejected.length > 0 || result.gaps.length > 0) {
            console.log(
              `[Aggregator] Integrity check for ${symbol}/${timeframe}: ` +
              `${result.stored.length} valid, ${result.rejected.length} rejected, ${result.gaps.length} gaps`
            );
          }

          // Return validated frames (map back to original format)
          const validatedFrames = frames.filter((f: any) => {
            const fTimestamp = typeof f.timestamp === 'string' ? new Date(f.timestamp).getTime() : 
                             f.timestamp instanceof Date ? f.timestamp.getTime() : f.timestamp;
            return result.stored.some((c: any) => c.ts === fTimestamp);
          });

          // Only validated frames leave this boundary. Returning the raw frames
          // when nothing validated would push rejected data downstream.
          if (validatedFrames.length === 0 && frames.length > 0) {
            console.warn(
              `[Aggregator] All ${frames.length} frames for ${symbol}/${timeframe} failed integrity validation — dropped`
            );
          }
          return validatedFrames;
        } catch (integrityError) {
          console.error(
            `[Aggregator] Integrity gate failed for ${symbol}/${timeframe} — frames dropped (no bypass):`,
            integrityError
          );
          recordIntegrityBypassBlocked(symbol, String(timeframe), frames.length);
          return [];
        }
      } catch (error: any) {
        this.rateLimiter.recordFailure(exchange);
        this.updateExchangeHealth(exchange, false, 0, error);
        // Only log if not a geo-restriction error
        if (!this.isGeoRestrictionError(error)) {
          console.warn(`[Gateway] Failed to fetch market frames from ${exchange}: ${error.message}`);
        }
        continue;
      }
    }

    throw new Error(`Failed to fetch market frames for ${symbol}`);
  }

  /**
   * Choose the best venue for a given symbol based on available market metadata (volume/depth).
   * Returns an exchange name or undefined if no clear candidate.
   */
  chooseVenueForSymbol(symbol: string): string | undefined {
    if (!this.exchangeDataFeed) return undefined;
        const instancesRaw = (this.exchangeDataFeed as any).getExchangeInstances ? (this.exchangeDataFeed as any).getExchangeInstances() : new Map();
        const instances: Map<string, any> = instancesRaw as Map<string, any>;
    let best: { exchange?: string; score: number } = { score: -1 };

    for (const [name, exchange] of Array.from(instances.entries())) {
      try {
        const markets: any = (exchange as any).markets || {};
        // Direct match
        if (markets[symbol]) {
          const info = markets[symbol].info || {};
          const vol = Number(info.quoteVolume || info.quoteVolume24h || info.quoteVolume_24h || info.volume || 0) || 0;
          const score = vol;
          if (score > best.score) best = { exchange: name, score };
          continue;
        }

        // Try common variant without slash
        const compact = symbol.replace('/', '');
        if (markets[compact]) {
          const info = markets[compact].info || {};
          const vol = Number(info.quoteVolume || info.quoteVolume24h || info.volume || 0) || 0;
          const score = vol * 0.9; // slightly de-prioritize heuristics
          if (score > best.score) best = { exchange: name, score };
        }
      } catch (e) {
        // ignore
      }
    }

    if (best.score > 0 && best.exchange) return best.exchange;

    // Fallback: prefer configured priority order when volumes are not available
    for (const p of this.exchangePriority) {
      const instancesMap = (this.exchangeDataFeed as any).getExchangeInstances ? (this.exchangeDataFeed as any).getExchangeInstances() : new Map();
      if (instancesMap.has(p)) {
        const ex = instancesMap.get(p) as any;
        if (ex && ex.markets && (ex.markets[symbol] || ex.markets[symbol.replace('/', '')])) {
          return p;
        }
      }
    }

    // If still not found, distribute load by rotating preferred exchanges
    // Use a deterministic hash of the symbol so requests spread evenly across exchanges
    const preferredOrder = ['binance', 'okx', 'bybit', 'kucoinfutures'];
    const available = preferredOrder.filter(p => instances.has(p));
    if (available.length === 0) {
      // fallback to any available exchange instance
      const any = instances.keys().next();
      return any.done ? undefined : any.value;
    }

    // simple djb2-ish hash
    let h = 5381;
    for (let i = 0; i < symbol.length; i++) {
      h = ((h << 5) + h) + symbol.charCodeAt(i);
      h = h & 0xffffffff;
    }
    const start = Math.abs(h) % available.length;
    console.debug(`[Aggregator] hash=${h} available=${available.join(',')} startIdx=${start}`);

    // Rotate through available preferred exchanges and return the first that actually lists the symbol
    for (let i = 0; i < available.length; i++) {
      const idx = (start + i) % available.length;
      const exName = available[idx];
      try {
        const ex = instances.get(exName) as any;
        const markets = ex?.markets || {};
        console.debug(`[Aggregator] checking ${exName} markets for ${symbol}: has=${Boolean(markets[symbol] || markets[symbol.replace('/', '')])}`);
        if (markets[symbol] || markets[symbol.replace('/', '')]) return exName;
      } catch (e) { /* ignore malformed instances */ }
    }

    // Last resort: return deterministic preferred exchange even if it may not list the symbol
    return available[start];
  }

  /**
   * Fetch market frames from a specific venue (exchange name). Useful to route symbol to best venue.
   */
  async getMarketFramesOnVenue(symbol: string, timeframe: string = '1m', limit: number = 100, venue?: string) {
    if (!this.exchangeDataFeed) throw new Error('ExchangeAggregator not initialized');
    if (!venue) return this.getMarketFrames(symbol, timeframe, limit);

    try {
      const frames = await this.exchangeDataFeed.fetchMarketData(symbol, timeframe, limit, venue);
      // Map to same return format as getMarketFrames (no integrity processing here)
      return frames;
    } catch (e) {
      throw e;
    }
  }

  /**
   * Parse timeframe string to seconds
   */
  private parseTimeframeToSeconds(timeframe: string): number {
    const m = timeframe.match(/(\d+)([mhd])/i);
    if (!m) return 60;

    const amount = parseInt(m[1]);
    const unit = m[2].toLowerCase();

    if (unit === 'm') return amount * 60;
    if (unit === 'h') return amount * 3600;
    if (unit === 'd') return amount * 86400;
    return 60;
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
