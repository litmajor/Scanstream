import { ExchangeAggregator } from './gateway/exchange-aggregator';
import { CacheManager } from './gateway/cache-manager';
import { RateLimiter } from './gateway/rate-limiter';
import { SignalPipeline } from './gateway/signal-pipeline';
import { signalWebSocketService } from './websocket-signals';
import { signalArchive } from './signal-archive';
import { calculateClusterMetrics } from './clustering';
import { getTimeAnchorManager } from './market-data/time-anchor';
import { priceCache } from '../../src/core/PriceCache';
import { symbolRegistry } from '../../src/core/SymbolRegistry';

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
  // Track last fetch timestamp per (symbol:timeframe) to enforce cooldowns
  private lastFetchTime: Map<string, number> = new Map();
  
  // Track last processed CLOSED candle timestamp per symbol to avoid signal spam
  private lastProcessedCandleTime: Map<string, number> = new Map();

  // 🔒 BACKFILL TRACKING (critical for LIVE mode)
  // Per (symbol, timeframe): has initial backfill completed?
  private backfillComplete = new Set<string>(); // keys: "symbol:timeframe"
  // Prevent overlapping fetchAllData calls
  private fetchLock = false;
  // Prevent concurrent transition handling
  private transitioningBackfill = false;

  // Configurable symbol universe - can be updated dynamically via setSymbols()
  // Default: Popular trading pairs across major exchanges
  private symbols: string[] = [
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

  // Timeframes to fetch data for - matches multi-timeframe analysis
  private readonly timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // Per-timeframe cooldowns (milliseconds) to avoid re-fetching slow frames too often
  private readonly TIMEFRAME_COOLDOWNS: Record<string, number> = {
    '1m':  60_000,
    '5m':  5 * 60_000,
    '15m': 15 * 60_000,
    '1h':  60 * 60_000,
    '4h':  4 * 60 * 60_000,
    '1d':  24 * 60 * 60_000,
  };

  // Candle limits per timeframe (more candles for longer timeframes)
  private readonly candleLimits: { [key: string]: number } = {
    '1m': 200,
    '5m': 150,
    '15m': 100,
    '1h': 100,
    '4h': 80,
    '1d': 50
  };

  // Exchanges to try (Binance first, then fallback to others)
  private readonly exchangesToTry = ['binance', 'coinbase', 'kucoinfutures', 'okx', 'bybit', 'kraken'];

  constructor(aggregator: ExchangeAggregator, cacheManager: CacheManager, rateLimiter: RateLimiter, signalPipeline?: SignalPipeline) {
    this.aggregator = aggregator;
    this.cacheManager = cacheManager;
    this.rateLimiter = rateLimiter;
    this.signalPipeline = signalPipeline || null;
    // Whether we've already signalled global backfill completion to ModeDetector
    (this as any).backfillSignalled = false;
  }

  /**
   * Set the signal pipeline (optional, for signal generation)
   */
  setSignalPipeline(pipeline: SignalPipeline): void {
    this.signalPipeline = pipeline;
  }

  /**
   * Set the symbol universe dynamically
   * Allows updating trading pairs at runtime
   */
  setSymbols(newSymbols: string[]): void {
    if (newSymbols && newSymbols.length > 0) {
      this.symbols = newSymbols;
      console.log(`[MarketDataFetcher] Symbol universe updated: ${newSymbols.length} symbols`);
    } else {
      console.warn('[MarketDataFetcher] Cannot set empty symbol universe');
    }
  }

  /**
   * Get current symbol universe
   */
  getSymbols(): string[] {
    return [...this.symbols];
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
      // Clear timestamp tracking on restart to avoid skipping first closed candle
      // (otherwise if service restarts, in-memory timestamps prevent signal generation)
      this.lastProcessedCandleTime.clear();
      console.log('[MarketDataFetcher] Cleared candle timestamp cache for fresh start');

      // If a symbol registry exists, use it to build a dynamic universe instead of hardcoded seed list
      try {
        const regs = symbolRegistry.getAll();
        if (regs && regs.length > 0) {
          this.symbols = regs.map(r => r.symbol);
          console.log(`[MarketDataFetcher] Symbol universe initialized from SymbolRegistry: ${this.symbols.length} symbols`);
        } else {
          console.log('[MarketDataFetcher] SymbolRegistry empty — using default seed list');
        }
      } catch (e) {
        console.warn('[MarketDataFetcher] Could not read SymbolRegistry, using default seed list');
      }

      // Seed anchors for all configured symbols/timeframes to avoid runtime discovery during LIVE
      try {
        const anchorMgr = getTimeAnchorManager();
        for (const symbol of this.symbols) {
          for (const tf of this.timeframes) {
            const tf_seconds = this.timeframeToSeconds(tf);
            try { anchorMgr.getOrCreateAnchor(symbol, tf_seconds, true); } catch (e) { /* ignore */ }
          }
        }
        console.log('[MarketDataFetcher] Pre-seeded TimeAnchorManager for configured symbols');
      } catch (e) {
        console.warn('[MarketDataFetcher] Could not pre-seed anchors', (e as any)?.message || e);
      }

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
   * 
   * 🔒 CRITICAL: Respects backfill boundaries
   * - BACKFILL phase: Fetch REST data once, mark complete
   * - LIVE phase: Only accept WS, no more REST
   */
  private async fetchAllData(): Promise<void> {
    if (this.fetchLock) {
      console.log('[MarketDataFetcher] fetch already in progress, skipping');
      return;
    }
    this.fetchLock = true;
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      // Fetch data for each symbol in limited concurrency batches to avoid huge parallel blasts
      const symbolConcurrency = Math.min(5, Math.max(1, Math.floor(this.symbols.length / 3)));
      for (let i = 0; i < this.symbols.length; i += symbolConcurrency) {
        const batch = this.symbols.slice(i, i + symbolConcurrency);
        const batchPromises = batch.map(symbol =>
          this.fetchSymbolData(symbol)
            .then(() => {
              successCount++;
            })
            .catch(error => {
              errorCount++;
              console.error(`[MarketDataFetcher] Failed to fetch ${symbol}:`, error.message);
            })
        );
        await Promise.all(batchPromises);
      }

      // Check if all timeframes for all symbols are backfilled
      // If so, transition anchors to ARMED and disable REST polling
      await this.checkAndTransitionBackfill();

      const duration = Date.now() - startTime;
      console.log(
        `[MarketDataFetcher] Fetch completed: ${successCount}/${this.symbols.length} symbols (${duration}ms)`
      );
    } catch (error) {
      console.error('[MarketDataFetcher] Batch fetch error:', error);
    } finally {
      this.fetchLock = false;
    }
  }

  /**
   * Check if all (symbol, timeframe) pairs have completed backfill
   * If so, transition to ARMED mode and stop REST polling
   */
  private async checkAndTransitionBackfill(): Promise<void> {
    if (this.transitioningBackfill) return;
    this.transitioningBackfill = true;
    const anchorMgr = getTimeAnchorManager();
    let allBackfillComplete = true;

    for (const symbol of this.symbols) {
      for (const timeframe of this.timeframes) {
        const key = `${symbol}:${timeframe}`;
        const tf_seconds = this.timeframeToSeconds(timeframe);
        
        // Check if anchor has been initialized
        const anchor = anchorMgr.getAnchor(symbol, tf_seconds);
        if (!anchor || anchor.mode === 'BACKFILL') {
          allBackfillComplete = false;
        } else if (anchor.mode === 'ARMED' || anchor.mode === 'LIVE') {
          // Already transitioned, good
          this.backfillComplete.add(key);
        }
      }
    }

    // Once all anchors have been transitioned to ARMED or beyond, stop REST fetching
    if (allBackfillComplete && this.symbols.length > 0) {
      // Signal global backfill completion to mode detector (one-time)
      try {
        const { getModeDetector } = await import('./market-data/mode-detector');
        const modeDetector = getModeDetector();
        // Only signal once
        if (!(this as any).backfillSignalled && !modeDetector.getMetrics().backfillComplete) {
          modeDetector.setBackfillComplete(true);
          (this as any).backfillSignalled = true;
          console.log('[MarketDataFetcher] Signalled ModeDetector backfill completion');
        }
      } catch (e) {
        console.warn('[MarketDataFetcher] Could not signal ModeDetector backfill completion', (e as any)?.message || e);
      }
      // Ensure all anchors are transitioned to ARMED before disabling REST
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          const tf_seconds = this.timeframeToSeconds(timeframe);
          const anchor = anchorMgr.getAnchor(symbol, tf_seconds);
          if (anchor && anchor.mode === 'BACKFILL') {
            // Should not happen, but force transition just in case
            anchorMgr.transitionToArmed(symbol, tf_seconds);
            console.log(`[MarketDataFetcher] ⚠️ Force-transitioned ${symbol}:${tf_seconds} to ARMED`);
          }
        }
      }
      console.log('[MarketDataFetcher] 🔒 Backfill complete for all symbols → transitioning to WS-only mode');
      this.disableRestFetching();
      this.transitioningBackfill = false;
    }
    this.transitioningBackfill = false;
  }

  /**
   * Convert CCXT timeframe string to seconds
   */
  private timeframeToSeconds(tf: string): number {
    const map: { [key: string]: number } = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return map[tf] || 60;
  }

  /**
   * Disable REST fetching permanently (enter LIVE mode)
   * WS will handle all data from this point forward
   */
  private disableRestFetching(): void {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval as any);
      this.fetchInterval = null;
      console.log('[MarketDataFetcher] ✅ REST polling disabled — LIVE mode (WS only)');
    }
  }

  /**
   * Fetch data for a single symbol across multiple timeframes
   * 
   * 🔒 CRITICAL: Marks backfill completion in TimeAnchor per (symbol, timeframe)
   */
  private async fetchSymbolData(symbol: string): Promise<void> {
    try {
      console.debug(`[MarketDataFetcher] [Strategy] Processing ${symbol} frames`);
      if (!this.signalPipeline) {
        console.warn('[MarketDataFetcher] No SignalPipeline attached — signal generation will be skipped');
      }
      const anchorMgr = getTimeAnchorManager();
      // Fetch data for each timeframe in parallel with appropriate candle limits
      const results = await Promise.all(
        this.timeframes.map(async (timeframe) => {
          const tf_seconds = this.timeframeToSeconds(timeframe);
          const anchor = anchorMgr.getAnchor(symbol, tf_seconds);

          const cacheKey = `ohlcv:${symbol}:${timeframe}`;
          const cooldown = this.TIMEFRAME_COOLDOWNS[timeframe] || 60_000;
          const last = this.lastFetchTime.get(cacheKey) || 0;

          // If anchor is ARMED/LIVE we should prefer cache and avoid REST fetches
          if (anchor && (anchor.mode === 'ARMED' || anchor.mode === 'LIVE')) {
            // Attempt to return cached candles (closed+forming) if available
            const cached = this.cacheManager.get(cacheKey) || priceCache.getCandles(symbol, timeframe);
            if (cached && Array.isArray(cached) && cached.length > 0) {
              return cached.slice(-this.getCandleLimit(timeframe));
            }
            // No cached data available; fall through to conditional fetch below
          }

          // Enforce per-timeframe cooldown to avoid hammering slow frames
          if (Date.now() - last < cooldown) {
            const cached = this.cacheManager.get(cacheKey) || priceCache.getCandles(symbol, timeframe);
            if (cached && Array.isArray(cached) && cached.length > 0) {
              // Use cache when still in cooldown window
              console.debug(`[MarketDataFetcher] Skipping fetch for ${symbol} ${timeframe} (cooldown). Using cache (${cached.length} candles)`);
              return cached.slice(-this.getCandleLimit(timeframe));
            }
            // If cache empty, only allow fetch when anchor is still in BACKFILL mode
            if (!(anchor && anchor.mode === 'BACKFILL')) {
              console.debug(`[MarketDataFetcher] Skipping fetch for ${symbol} ${timeframe} due to cooldown and empty cache (not BACKFILL)`);
              return [];
            }
            // Otherwise allow fetch because we're still backfilling historical data
          }

          // Record attempt time to avoid concurrent callers triggering duplicate fetches
          this.lastFetchTime.set(cacheKey, Date.now());

          return this.fetchOHLCV(symbol, timeframe, this.candleLimits[timeframe] || 100);
        })
      );

      // Mark backfill complete for each timeframe
      // This transitions anchors from BACKFILL → ARMED
      this.timeframes.forEach((timeframe, index) => {
        const tf_seconds = this.timeframeToSeconds(timeframe);
        const anchor = anchorMgr.getOrCreateAnchor(symbol, tf_seconds);
        
        if (anchor.mode === 'BACKFILL') {
          anchorMgr.transitionToArmed(symbol, tf_seconds);
        }
      });

      // Find the 1h data for current price broadcasting
      const hourlyDataIndex = this.timeframes.indexOf('1h');
      const hourlyData = results[hourlyDataIndex];

      if (hourlyData && hourlyData.length >= 2) {
        // CRITICAL FIX: Separate the currently forming candle from closed candles
        const currentFormingCandle = hourlyData[hourlyData.length - 1]; // Current open 1h candle
        const lastClosedCandle = hourlyData[hourlyData.length - 2]; // Last CONFIRMED closed candle
        const currentPrice = currentFormingCandle[4]; // close price (latest tick)

        // Use only CLOSED candles for analysis to avoid false signals
        const closedCandles = hourlyData.slice(0, -1); // All except the current forming candle

        // Cache OHLCV data for all timeframes (including forming candle for display)
        this.timeframes.forEach((timeframe, index) => {
          const cacheKey = `ohlcv:${symbol}:${timeframe}`;
          const candleData = results[index];
          if (candleData && candleData.length > 0) {
            // Cache duration: shorter for intraday, longer for daily
            const cacheDuration = timeframe === '1d' ? 600000 : 180000; // 10min for daily, 3min for others
            this.cacheManager.set(cacheKey, candleData, cacheDuration);
          }
        });

        // Calculate clustering metrics from CLOSED candles only (not the forming candle)
        const clusterMetrics = calculateClusterMetrics(closedCandles);
        // Compute simple momentum acceleration and volume confirmation from closed candles
        let momentum_acceleration = 0;
        let volume_confirmation = 0;
        try {
          const closes = closedCandles.map(c => c[4]);
          if (closes.length >= 3) {
            const n = closes.length;
            const r1 = (closes[n - 2] - closes[n - 3]) / (closes[n - 3] || 1);
            const r2 = (closes[n - 1] - closes[n - 2]) / (closes[n - 2] || 1);
            momentum_acceleration = r2 - r1; // positive = accelerating in direction
            // normalize to small bounded value
            if (!Number.isFinite(momentum_acceleration)) momentum_acceleration = 0;
            momentum_acceleration = Math.max(-1, Math.min(1, momentum_acceleration));
          }

          const volumes = closedCandles.map(c => c[5] || 0);
          const lastVol = volumes[volumes.length - 1] || 0;
          const avgVol = volumes.slice(-6, -1).length > 0 ? volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / volumes.slice(-6, -1).length : 0;
          if (avgVol > 0) {
            volume_confirmation = Math.min(1, lastVol / (avgVol * 1.15));
          } else {
            volume_confirmation = 0;
          }
        } catch (e) {
          momentum_acceleration = 0;
          volume_confirmation = 0;
        }

        // Attach computed signals to clusterMetrics for downstream consumers
        (clusterMetrics as any).momentum_acceleration = momentum_acceleration;
        (clusterMetrics as any).volume_confirmation = volume_confirmation;
        console.log(
          `[MarketDataFetcher] Clustering for ${symbol}: strength=${clusterMetrics.cluster_strength.toFixed(2)}, formation=${clusterMetrics.trend_formation_signal}, total_clusters=${clusterMetrics.total_clusters}`
        );

        // Store clustering metrics (with momentum & volume) in cache for agent access
        const clusterCacheKey = `clustering:${symbol}:1h`;
        this.cacheManager.set(clusterCacheKey, clusterMetrics, 180000); // 3 minute cache

        // CRITICAL FIX: Only generate signal when a NEW closed candle arrives
        // This prevents signal spam and false signals from forming candles
        const latestClosedTimestamp = lastClosedCandle[0]; // timestamp of last closed candle
        const previousProcessedTimestamp = this.lastProcessedCandleTime.get(symbol);

        if (latestClosedTimestamp && latestClosedTimestamp !== previousProcessedTimestamp) {
          // New closed candle detected - safe to generate signal now
          const candleCloseTime = new Date(latestClosedTimestamp).toISOString();
          console.log(`[MarketDataFetcher] ✓ New closed candle detected for ${symbol} at ${candleCloseTime} - Generating signal...`);

          // Step 2: Generate trading signal from the CLOSED market data
          // NOTE: SignalPipeline should use closed candles internally via getClosedCandles()
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
                  signalType: action as 'BUY' | 'SELL' | 'HOLD',
                  strength: confidence,
                  price: currentPrice,
                  confidence: confidence,
                  exchange: (signal as any).exchange || 'aggregated',
                  source: 'MarketDataFetcher',
                  reasoning: { change24h: (signal as any).change24h, volume: currentFormingCandle[5] }
                });

                // Broadcast signal to WebSocket clients with proper SignalData structure
                const signalData = {
                  symbol,
                  signal: action as 'BUY' | 'SELL' | 'HOLD',
                  strength: confidence,
                  price: currentPrice,
                  change24h: (signal as any).change24h,
                  volume: currentFormingCandle[5], // volume
                  timestamp: Date.now(),
                  exchange: (signal as any).exchange || 'aggregated',
                  clustering: clusterMetrics, // Include clustering metrics
                  momentum_acceleration: (clusterMetrics as any).momentum_acceleration || 0,
                  volume_confirmation: (clusterMetrics as any).volume_confirmation || 0
                };
                signalWebSocketService.broadcastSignal(signalData, 'new');

                console.log(`[MarketDataFetcher] 📊 Signal generated for ${symbol}: ${action} (strength: ${confidence.toFixed(1)}%) [Confirmed Closed Candle]`);
              }

              // Mark this closed candle as processed to prevent duplicate signals
              this.lastProcessedCandleTime.set(symbol, latestClosedTimestamp);
            } catch (signalError: any) {
              console.warn(`[MarketDataFetcher] Signal generation failed for ${symbol}:`, signalError.message);
              // Don't throw - market data still valid even if signal fails
            }
          }
        } else if (previousProcessedTimestamp) {
          // Still processing forming candle - skip signal generation
          // This is normal; happens 30s ago until next 1h close
          if (latestClosedTimestamp === previousProcessedTimestamp) {
            console.debug(`[MarketDataFetcher] ⏳ Still in forming candle for ${symbol} (last processed: ${new Date(latestClosedTimestamp).toISOString()})`);
          }
        }
      }
    } catch (error) {
      console.error(`[MarketDataFetcher] Error fetching ${symbol}:`, error);
      throw error;
    }
    finally {
      console.debug(`[MarketDataFetcher] [Strategy] Completed processing ${symbol}`);
    }
  }

  /**
   * Fetch OHLCV data from the aggregator (returns array of candles in CCXT format)
   * Uses RateLimiter to respect exchange rate limits
   * Uses TickerCache to avoid redundant symbol lookups
   */
  private async fetchOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 100
  ): Promise<number[][]> {
    try {
      // Prefer routing per-symbol to the best venue
      let preferredVenue: string | undefined = undefined;
      try {
        if (typeof (this.aggregator as any).chooseVenueForSymbol === 'function') {
          preferredVenue = (this.aggregator as any).chooseVenueForSymbol(symbol);
        }
      } catch (e) {
        // ignore
      }
      console.debug(`[MarketDataFetcher] preferredVenue for ${symbol} -> ${preferredVenue}`);

      const rateLimiterExchange = preferredVenue || 'binance';
      await this.rateLimiter.acquire(rateLimiterExchange, 'normal');

      // Step 1: Prefer PriceCache (authoritative source)
      try {
        const cached = priceCache.getCandles(symbol, timeframe);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          console.log(`[MarketDataFetcher] Using priceCache for ${symbol} ${timeframe} (${cached.length} candles)`);
          // Return the most recent up-to-`limit` candles in CCXT number[][] format
          return cached.slice(-limit);
        }
        // If cache empty, attempt to refresh the priceCache for this symbol/timeframe
        await priceCache.refreshCandles(symbol, timeframe, limit);
        const refreshed = priceCache.getCandles(symbol, timeframe);
        if (refreshed && Array.isArray(refreshed) && refreshed.length > 0) {
          console.log(`[MarketDataFetcher] Loaded ${symbol} ${timeframe} into priceCache (${refreshed.length} candles)`);
          return refreshed.slice(-limit);
        }
      } catch (pcErr) {
        // If price cache fails for any reason, we fall back to aggregator below
        console.debug('[MarketDataFetcher] priceCache attempt failed:', (pcErr as any)?.message || pcErr);
      }

      // Prefer Aggregator.getMarketFrames which routes frames through the IntegrityGate
      // so validated candles are stored and world.tick events are emitted.
      try {
        // If we've chosen a preferred venue, try fetching from that venue first (more efficient, preserves liquidity)
        let frames: any[] | null = null;
        if (preferredVenue && typeof (this.aggregator as any).getMarketFramesOnVenue === 'function') {
          try {
            frames = await (this.aggregator as any).getMarketFramesOnVenue(symbol, timeframe, limit, preferredVenue);
            console.log(`[MarketDataFetcher] Routed ${symbol} to preferred venue ${preferredVenue}`);
          } catch (e) {
            console.debug(`[MarketDataFetcher] Preferred venue ${preferredVenue} failed for ${symbol}:`, (e as any)?.message || e);
            frames = null;
          }
        }

        if (!frames) {
          frames = await (this.aggregator as any).getMarketFrames(symbol, timeframe, limit);
        }
        if (frames && Array.isArray(frames) && frames.length > 0) {
          console.log(`[MarketDataFetcher] Successfully fetched ${symbol} (${frames.length} frames) via aggregator.getMarketFrames`);
          // Convert frames to CCXT number[][] format
          const candles = frames.map((f: any) => [
            typeof f.timestamp === 'number' ? f.timestamp : (f.timestamp instanceof Date ? f.timestamp.getTime() : Number(f.timestamp)),
            (f.price && f.price.open) || f.open || 0,
            (f.price && f.price.high) || f.high || 0,
            (f.price && f.price.low) || f.low || 0,
            (f.price && f.price.close) || f.close || 0,
            f.volume || 0,
          ]);
          return candles.slice(-limit);
        }
      } catch (aggErr) {
        console.debug('[MarketDataFetcher] aggregator.getMarketFrames failed, falling back to getOHLCV:', (aggErr as any)?.message || aggErr);
      }

      // Fallback: The aggregator tries exchanges in priority order internally
      // It returns OHLCVData[] but we need to convert to number[][] format
      const ohlcvData = await (this.aggregator as any).getOHLCV(symbol, timeframe, limit);

      if (ohlcvData && Array.isArray(ohlcvData) && ohlcvData.length > 0) {
        console.log(`[MarketDataFetcher] Successfully fetched ${symbol} from ${ohlcvData[0]?.exchange || 'unknown'} (${ohlcvData.length} candles for ${timeframe})`);

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
      // Check if it's a rate limit or all-exchanges-failed error
      if (error.message?.includes('rate limit') || error.message?.includes('all exchanges failed')) {
        console.warn(`[MarketDataFetcher] ${symbol} fetch degraded: ${error.message}`);
        // Don't throw - let the caller handle gracefully
        return [];
      }
      
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

  /**
   * Get clustering metrics for a symbol (from cache)
   * Available to agents system-wide
   */
  getClusteringMetrics(symbol: string): any {
    const cacheKey = `clustering:${symbol}:1h`;
    return this.cacheManager.get(cacheKey);
  }

  /**
   * Get OHLCV candles for a symbol and timeframe (from cache)
   * Used for real-time analysis
   */
  getCandles(symbol: string, timeframe: string = '1h'): number[][] {
    const cacheKey = `ohlcv:${symbol}:${timeframe}`;
    return this.cacheManager.get(cacheKey) || [];
  }

  /**
   * Get CLOSED candles only for a symbol and timeframe (current forming candle excluded)
   * 
   * CRITICAL: Use this for signal generation and analysis to avoid false signals
   * The current forming candle changes in real-time and can create false breakouts.
   * 
   * ALL signal analysis, clustering, backtesting, and agent decision-making should use this.
   * Only use getCandles() if you specifically need the current forming candle for price display.
   * 
   * Returns empty array if less than 2 candles available
   */
  getClosedCandles(symbol: string, timeframe: string = '1h'): number[][] {
    const all = this.getCandles(symbol, timeframe);
    // Exclude the current forming candle
    return all.length >= 2 ? all.slice(0, -1) : [];
  }

  /**
   * Get all available timeframes
   */
  getAvailableTimeframes(): string[] {
    return this.timeframes;
  }

  /**
   * Get candle limit for a timeframe
   */
  getCandleLimit(timeframe: string): number {
    return this.candleLimits[timeframe] || 100;
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