import { ExchangeAggregator } from './gateway/exchange-aggregator';
import { CacheManager } from './gateway/cache-manager';
import { RateLimiter } from './gateway/rate-limiter';
import { signalWebSocketService } from './websocket-signals';

/**
 * Market Data Fetcher Service
 * Automatically fetches market data on startup and keeps it updated
 * Broadcasts to WebSocket clients for real-time frontend updates
 */
export class MarketDataFetcher {
  private aggregator: ExchangeAggregator;
  private cacheManager: CacheManager;
  private rateLimiter: RateLimiter;
  private isRunning = false;
  private fetchInterval: NodeJS.Timer | null = null;

  // Popular trading pairs to fetch (Binance blocked on Replit, use other exchanges)
  private readonly symbols = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
  ];

  // Timeframes to fetch data for
  private readonly timeframes = ['1h'];
  
  // Exchanges to try (Binance is geo-blocked on Replit)
  private readonly exchangesToTry = ['coinbase', 'kucoinfutures', 'okx', 'bybit', 'kraken'];

  constructor(aggregator: ExchangeAggregator, cacheManager: CacheManager, rateLimiter: RateLimiter) {
    this.aggregator = aggregator;
    this.cacheManager = cacheManager;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Start the market data fetcher
   * Fetches data immediately and then periodically
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[MarketDataFetcher] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[MarketDataFetcher] Starting auto-fetch service...');

    try {
      // Initial fetch
      await this.fetchAllData();

      // Fetch every 30 seconds
      this.fetchInterval = setInterval(() => {
        this.fetchAllData().catch(err => {
          console.error('[MarketDataFetcher] Fetch error:', err.message);
        });
      }, 30 * 1000);

      console.log('[MarketDataFetcher] Auto-fetch started (30s interval)');
    } catch (error) {
      console.error('[MarketDataFetcher] Failed to start:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the market data fetcher
   */
  stop(): void {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval as any);
      this.fetchInterval = null;
    }
    this.isRunning = false;
    console.log('[MarketDataFetcher] Stopped');
  }

  /**
   * Fetch all market data for configured symbols and timeframes
   */
  private async fetchAllData(): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      // Fetch data for each symbol in parallel
      const fetchPromises = this.symbols.map(symbol =>
        this.fetchSymbolData(symbol)
          .then(() => {
            successCount++;
          })
          .catch(error => {
            errorCount++;
            console.error(`[MarketDataFetcher] Failed to fetch ${symbol}:`, error.message);
          })
      );

      await Promise.all(fetchPromises);

      const duration = Date.now() - startTime;
      console.log(
        `[MarketDataFetcher] Fetch completed: ${successCount}/${this.symbols.length} symbols (${duration}ms)`
      );
    } catch (error) {
      console.error('[MarketDataFetcher] Batch fetch error:', error);
    }
  }

  /**
   * Fetch data for a single symbol across multiple timeframes
   */
  private async fetchSymbolData(symbol: string): Promise<void> {
    try {
      // Fetch data for each timeframe
      const results = await Promise.all(
        this.timeframes.map(timeframe => this.fetchOHLCV(symbol, timeframe))
      );

      // Find the 1h data for current price broadcasting
      const hourlyData = results[0];

      if (hourlyData && hourlyData.length > 0) {
        const latest = hourlyData[hourlyData.length - 1];

        // Create market data message for WebSocket
        const marketDataMessage = {
          type: 'market_data',
          symbol,
          data: {
            timestamp: latest[0],
            open: latest[1],
            high: latest[2],
            low: latest[3],
            close: latest[4],
            volume: latest[5],
          },
          source: 'auto-fetcher',
          timeframe: '1h',
          fetchedAt: Date.now(),
        };

        // Broadcast to all connected WebSocket clients
        signalWebSocketService.broadcastSignal(marketDataMessage, 'update');

        // Cache the OHLCV data
        const cacheKey = `ohlcv:${symbol}:1h`;
        this.cacheManager.set(cacheKey, hourlyData, 60000); // 60s cache
      }
    } catch (error) {
      console.error(`[MarketDataFetcher] Error fetching ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch OHLCV data from the aggregator (tries multiple exchanges)
   */
  private async fetchOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<number[][]> {
    // Try each exchange until one succeeds
    for (const exchange of this.exchangesToTry) {
      try {
        await this.rateLimiter.acquire(exchange, 'normal');

        // Fetch from aggregator (which uses ExchangeDataFeed)
        const response = await (this.aggregator as any).getOHLCV(symbol, timeframe, limit, exchange);

        if (response && response.data && response.data.length > 0) {
          console.log(`[MarketDataFetcher] Successfully fetched ${symbol} from ${exchange}`);
          return response.data;
        }
      } catch (error: any) {
        // Try next exchange
        continue;
      }
    }

    throw new Error(`Failed to fetch ${symbol} from all exchanges`);
  }

  /**
   * Get current running status
   */
  getStatus(): { running: boolean; symbols: string[]; interval: number } {
    return {
      running: this.isRunning,
      symbols: this.symbols,
      interval: 30,
    };
  }
}

// Singleton instance
let fetcher: MarketDataFetcher | null = null;

/**
 * Initialize and get the market data fetcher
 */
export function initializeMarketDataFetcher(
  aggregator: ExchangeAggregator,
  cacheManager: CacheManager,
  rateLimiter: RateLimiter
): MarketDataFetcher {
  if (!fetcher) {
    fetcher = new MarketDataFetcher(aggregator, cacheManager, rateLimiter);
  }
  return fetcher;
}

/**
 * Get the existing fetcher instance
 */
export function getMarketDataFetcher(): MarketDataFetcher | null {
  return fetcher;
}
