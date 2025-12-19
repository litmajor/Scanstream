/**
 * Market Data Layer (MDL) — Universal Adapter Interface
 * 
 * This is the hard shell around all market data sources.
 * - CCXT (crypto)
 * - OANDA (forex)
 * - MT5 (forex/equities)
 * - FIX (institutional)
 * 
 * The rest of the system only knows this interface.
 * Asset class (crypto/forex) and venue are transparent to consumers.
 */

/**
 * A normalized candle from any source
 */
export interface Candle {
  ts: number;           // Timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  
  // Metadata
  isFinal: boolean;     // Is this candle closed? (incomplete = unfinalized)
  source?: string;      // 'ccxt', 'oanda', 'mt5', etc
  venue?: string;       // 'binance', 'oanda', 'mt5', etc
  
  // Optional raw data from source
  raw?: any;
}

/**
 * Market data ticker (latest price snapshot)
 */
export interface Ticker {
  symbol: string;
  timestamp: number;
  last: number;
  bid: number;
  ask: number;
  volume24h?: number;
  volumeQuote?: number;
}

/**
 * Market depth snapshot (order book)
 */
export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: Array<[number, number]>;  // [price, quantity]
  asks: Array<[number, number]>;
}

/**
 * Result of integrity validation
 */
export interface IntegrityResult {
  valid: boolean;
  candles: Candle[];
  issues: IntegrityIssue[];
  backfillRequired?: {
    symbol: string;
    timeframe: number;
    from: number;
    to: number;
  };
}

/**
 * Issues detected during integrity check
 */
export interface IntegrityIssue {
  type:
    | 'gap'                    // Missing candles
    | 'duplicate'              // Same timestamp appears twice
    | 'timestamp_misaligned'   // Close time doesn't match interval
    | 'ohlc_invalid'           // high < low, etc
    | 'out_of_order'           // Timestamps not monotonic
    | 'backfill_failed'        // Could not fill gap
    | 'external_anomaly';      // Unknown integrity issue
  
  severity: 'warn' | 'error';
  details: string;
  candles?: number[];          // Affected candle indices
  timestamp?: number;
}

/**
 * Health status of a data source
 */
export interface AdapterHealth {
  healthy: boolean;
  lastCheckTime: number;
  lastFetchTime?: number;
  latencyMs?: number;
  errorCount: number;
  errorMessage?: string;
  consecutiveFailures: number;
}

/**
 * Universal market data adapter interface
 * 
 * Implementations:
 * - CCXTMarketDataAdapter (crypto)
 * - OandaMarketDataAdapter (forex)
 * - MT5MarketDataAdapter (forex/equities)
 */
export interface MarketDataAdapter {
  readonly venue: string;              // 'binance', 'oanda', 'mt5', etc
  readonly assetClass: 'crypto' | 'forex' | 'equities';
  
  /**
   * Fetch candles for a symbol
   * @param symbol Normalized symbol (BTC/USDT or EUR/USD)
   * @param timeframe Timeframe in seconds (60, 300, 3600, etc)
   * @param since Fetch candles since this timestamp (ms)
   * @param limit Maximum candles to return
   */
  fetchOHLCV(
    symbol: string,
    timeframe: number,
    since?: number,
    limit?: number
  ): Promise<Candle[]>;

  /**
   * Fetch latest ticker
   */
  fetchTicker?(symbol: string): Promise<Ticker>;

  /**
   * Fetch order book
   */
  fetchOrderBook?(symbol: string): Promise<OrderBook>;

  /**
   * Get health status
   */
  getHealth?(): Promise<AdapterHealth>;
}

/**
 * Market data integrity checker
 * 
 * Validates candles before they reach the RPG system:
 * - No gaps
 * - No duplicates
 * - Timestamp alignment
 * - OHLC validity
 * - Monotonic ordering
 */
export interface MarketDataIntegrity {
  /**
   * Validate a batch of candles
   * @param candles Array of candles to validate
   * @param symbol Symbol being validated
   * @param timeframe Timeframe in seconds
   * @returns Validation result with issues detected
   */
  validate(
    candles: Candle[],
    symbol: string,
    timeframe: number
  ): Promise<IntegrityResult>;

  /**
   * Attempt to heal a gap by fetching missing candles
   * @param adapter The adapter to fetch from
   * @param symbol Symbol with gap
   * @param timeframe Timeframe in seconds
   * @param from Start of gap (ms)
   * @param to End of gap (ms)
   */
  healGap(
    adapter: MarketDataAdapter,
    symbol: string,
    timeframe: number,
    from: number,
    to: number
  ): Promise<Candle[]>;
}

/**
 * World tick — the atomic event that drives the RPG
 * 
 * When a candle closes or a partial update arrives:
 * emit('world.tick', WorldTick)
 * 
 * This is the boundary between:
 * - Market Data Layer (production)
 * - RPG Trading System (consumption)
 */
export interface WorldTick {
  symbol: string;
  timeframe: number;                    // seconds
  
  /**
   * CRITICAL SEMANTIC: worldTime (canonical market time)
   * 
   * This is the CLOSE TIME of the candle, not wall-clock emission time.
   * It represents the market moment when this candle became fact.
   * 
   * worldTime = candle.ts + (timeframe * 1000) - 1 ms
   * 
   * This ensures:
   * ✅ Replay alignment (same tick at same market time)
   * ✅ Cross-timeframe consistency
   * ✅ Physics/RL step accuracy
   * ✅ Multi-venue synchronization
   */
  worldTime: number;                    // ms (candle close time, NOT emission time)
  
  /**
   * Wall-clock time when this tick was emitted (diagnostic only)
   */
  emitTime: number;                     // ms (when we emitted this tick)
  
  candle: Candle;
  isFinal: boolean;                     // Candle closed
  source: string;                       // 'ccxt', 'oanda', etc
  /**
   * Optional regime context attached by the RegimeService / StrategyIntegrationEngine
   * This is a sanitized view intended for agents and UIs (no account/order data)
   */
  regimeContext?: {
    type: string;
    volatility: 'low' | 'medium' | 'high';
    momentum: number; // -1..1
    trend: 'up' | 'down' | 'sideways';
    score?: number; // 0..100
    confidence?: number; // 0..1
    computedAt?: number; // ms
    source?: string;
  };
}

/**
 * Market data event emitter
 * 
 * The RPG subscribes to these events.
 */
export interface MarketDataEventBus {
  /**
   * Subscribe to world ticks for an asset
   */
  on(
    event: 'world.tick',
    handler: (tick: WorldTick) => void
  ): void;

  /**
   * Subscribe to integrity issues
   */
  on(
    event: 'integrity.issue',
    handler: (issue: IntegrityIssue) => void
  ): void;

  /**
   * Subscribe to adapter health changes
   */
  on(
    event: 'adapter.health',
    handler: (health: AdapterHealth) => void
  ): void;

  /**
   * Unsubscribe
   */
  off(event: string, handler: Function): void;

  /**
   * Emit event
   */
  emit(event: string, ...args: any[]): void;
}

/**
 * World state snapshot — what the RPG sees
 * 
 * The RPG never queries CCXT directly.
 * It only asks the MDL for snapshots.
 */
export interface WorldState {
  /**
   * Get candles for an asset (from storage)
   */
  getSnapshot(
    symbol: string,
    timeframe: number,
    lookback: number
  ): Promise<Candle[]>;

  /**
   * Get latest candle
   */
  getLatest(
    symbol: string,
    timeframe: number
  ): Promise<Candle | undefined>;
}
