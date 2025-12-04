import { ExchangeAggregator } from './gateway/exchange-aggregator';
import { CacheManager } from './gateway/cache-manager';
import { RateLimiter } from './gateway/rate-limiter';
import { SignalPipeline } from './gateway/signal-pipeline';
import { signalWebSocketService } from './websocket-signals';
import { signalArchive } from './signal-archive';

/**
 * Market Data Fetcher Service
 * Automatically fetches market data on startup and keeps it updated
 * Broadcasts to WebSocket clients for real-time frontend updates
 */
export class MarketDataFetcher {
  private aggregator: ExchangeAggregator;
  private cacheManager: CacheManager;
  private rateLimiter: RateLimiter;
  private signalPipeline: SignalPipeline | null = null;
  private isRunning = false;
  private fetchInterval: NodeJS.Timer | null = null;
  private latestSignals: Map<string, any> = new Map();

  // Popular trading pairs to fetch (Binance blocked on Replit, use other exchanges)
  private readonly symbols = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'AVAX/USDT',
    'ADA/USDT',
    'DOT/USDT',
    'LINK/USDT',
    'XRP/USDT',
    'DOGE/USDT',
    'ATOM/USDT',
    'ARB/USDT',
    'OP/USDT',
    'AAVE/USDT',
    'UNI/USDT',
    'NEAR/USDT',
  ];

  // Timeframes to fetch data for
  private readonly timeframes = ['1h'];

  // Exchanges to try (Binance is geo-blocked on Replit)
  private readonly exchangesToTry = ['coinbase', 'kucoinfutures', 'okx', 'bybit', 'kraken'];

  constructor(aggregator: ExchangeAggregator, cacheManager: CacheManager, rateLimiter: RateLimiter, signalPipeline?: SignalPipeline) {
    this.aggregator = aggregator;
    this.cacheManager = cacheManager;
    this.rateLimiter = rateLimiter;
    this.signalPipeline = signalPipeline || null;
  }

  /**
   * Set the signal pipeline (optional, for signal generation)
   */
  setSignalPipeline(pipeline: SignalPipeline): void {
    this.signalPipeline = pipeline;
  }

  /**
   * Get latest generated signals
   */
  getLatestSignals(): Map<string, any> {
    return this.latestSignals;
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
        const currentPrice = latest[4]; // close price

        // Cache the OHLCV data
        const cacheKey = `ohlcv:${symbol}:1h`;
        this.cacheManager.set(cacheKey, hourlyData, 180000); // 3 minute cache

        // Step 2: Generate trading signal from the market data
        if (this.signalPipeline) {
          try {
            const signal = await this.signalPipeline.generateSignal(symbol, '1h', 100);
            if (signal) {
              this.latestSignals.set(symbol, signal);

              // Extract signal properties
              const action = (signal as any).action || (signal as any).type || (signal as any).signal || 'HOLD';
              const confidence = (signal as any).confidence || 0;

              // Archive the signal with its outcome
              await signalArchive.archiveSignal({
                symbol,
                signal: action as 'BUY' | 'SELL' | 'HOLD',
                strength: confidence,
                price: currentPrice,
                change24h: (signal as any).change24h,
                volume: latest[5], // volume
                timestamp: Date.now(),
                exchange: (signal as any).exchange || 'aggregated',
                outcome: null // Outcome will be recorded after execution
              });

              // Broadcast signal to WebSocket clients with proper SignalData structure
              const signalData = {
                symbol,
                signal: action as 'BUY' | 'SELL' | 'HOLD',
                strength: confidence,
                price: currentPrice,
                change24h: (signal as any).change24h,
                volume: latest[5], // volume
                timestamp: Date.now(),
                exchange: (signal as any).exchange || 'aggregated'
              };
              signalWebSocketService.broadcastSignal(signalData, 'new');

              console.log(`[MarketDataFetcher] Signal generated for ${symbol}: ${action} (strength: ${confidence.toFixed(1)}%)`);
            }
          } catch (signalError: any) {
            console.warn(`[MarketDataFetcher] Signal generation failed for ${symbol}:`, signalError.message);
            // Don't throw - market data still valid even if signal fails
          }
        }
      }
    } catch (error) {
      console.error(`[MarketDataFetcher] Error fetching ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch OHLCV data from the aggregator (returns array of candles in CCXT format)
   */
  private async fetchOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<number[][]> {
    try {
      // The aggregator tries exchanges in priority order internally
      // It returns OHLCVData[] but we need to convert to number[][] format
      const ohlcvData = await (this.aggregator as any).getOHLCV(symbol, timeframe, limit);

      if (ohlcvData && Array.isArray(ohlcvData) && ohlcvData.length > 0) {
        console.log(`[MarketDataFetcher] Successfully fetched ${symbol} (${ohlcvData.length} candles)`);

        // Convert OHLCVData[] format to CCXT number[][] format: [timestamp, open, high, low, close, volume]
        const candles = ohlcvData.map((candle: any) => [
          candle.timestamp,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        ]);

        return candles;
      } else {
        throw new Error(`No valid OHLCV data returned for ${symbol}`);
      }
    } catch (error: any) {
      console.error(`[MarketDataFetcher] OHLCV fetch error for ${symbol}/${timeframe}:`, error.message);
      throw error;
    }
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