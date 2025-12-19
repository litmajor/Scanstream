/**
 * MarketFrame — World State Layer (Reality Model)
 * 
 * Describes what the MARKET LOOKS LIKE at a moment in time.
 * This is what your SYSTEM BELIEVES, not what any single exchange said.
 * 
 * RULES (Enforced):
 * ✅ Stored in DB for replay and analysis
 * ✅ Deterministic and replayable
 * ✅ Multi-exchange aware (optional)
 * ✅ Every frame carries an explicit quality envelope (confidence, latency, source count)
 * ❌ No trading decisions yet (that's DecisionContext)
 * ❌ Storage NEVER evaluates quality (computed at assembly time, persisted as fact)
 * 
 * Why: MarketFrame is your ground truth. Once persisted, it's immutable.
 * Quality is NOT truth — it's our DECLARED BELIEF about the data reliability.
 */

export interface FrameQuality {
  /** How many independent data sources contributed to this frame? (1 = single, >1 = aggregated) */
  sourceCount: number;

  /** Worst-case ingestion latency (milliseconds from exchange to our processing) */
  maxLatencyMs: number;

  /** Is this frame using fallback/degraded data? (cache, in-memory, replay, synthetic) */
  isFallback: boolean;

  /** System confidence score (0–1). Computed deterministically at frame assembly. */
  confidence: number;

  /** Explanation: why is confidence what it is? (for debugging and auditability) */
  confidenceReason?: string;

  /** Timestamp when quality was last evaluated (ms) */
  evaluatedAt: number;
}

export interface MarketFrameIndicators {
  /** Exponential Moving Average (20-period) */
  ema20?: number;

  /** Exponential Moving Average (50-period) */
  ema50?: number;

  /** Volume-Weighted Average Price */
  vwap?: number;

  /** Average True Range (volatility) */
  atr?: number;

  /** Relative Strength Index (0–100) */
  rsi?: number;

  /** MACD (Moving Average Convergence Divergence) */
  macd?: {
    line: number;
    signal: number;
    histogram: number;
  };

  /** Bollinger Bands */
  bb?: {
    upper: number;
    middle: number;
    lower: number;
  };

  /** Custom indicators (future-proofing) */
  [key: string]: any;
}

export interface MarketFrameMicrostructure {
  /** Bid-ask spread (bps) */
  spread?: number;

  /** Order book depth (sum of top N levels) */
  depth?: number;

  /** Bid/ask volume imbalance (0–1, 0.5 = balanced) */
  imbalance?: number;

  /** Price aggression: 1 = buys dominant, 0 = sells dominant */
  aggression?: number;

  /** Custom microstructure metrics */
  [key: string]: any;
}

export interface MarketFrameMeta {
  /** EXECUTION CONTROL: Is this LIVE data (tradeable) or REPLAY data (non-tradeable)? */
  mode: 'LIVE' | 'REPLAY';

  /** DATA SOURCE: Where did this data come from? (WS = websocket, REPLAY_API = replay endpoint, CACHE = cached, FALLBACK = degraded) */
  source: 'WS' | 'REPLAY_API' | 'CACHE' | 'FALLBACK';

  /** Opening timestamp of this frame (ms) */
  tsOpen: number;

  /** Closing timestamp of this frame (ms) */
  tsClose: number;

  /** Is this frame complete/final, or still accumulating ticks? */
  isFinal: boolean;

  /** How many exchanges contributed to this frame? (1 for single, >1 for aggregated) */
  exchangeCount: number;

  /** Latency from exchange to our processing (ms estimate) */
  latencyMs: number;

  /** If source='FALLBACK', why? (e.g., 'exchange_down', 'cache_used') */
  fallbackReason?: string;

  /** Arbitrary metadata (version, checksum, source exchanges, etc.) */
  [key: string]: any;
}

export interface MarketFrame {
  /** Symbol (normalized, e.g., 'BTCUSDT') */
  symbol: string;

  /** Timeframe ('tick', '1s', '5s', '1m', '5m', '1h', '1d') */
  timeframe: 'tick' | '1s' | '5s' | '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | string;

  /** OHLCV (Open, High, Low, Close, Volume) */
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  /** Technical indicators (optional, populated by signal-pipeline or aggregator) */
  indicators?: MarketFrameIndicators;

  /** Market microstructure metrics (optional) */
  microstructure?: MarketFrameMicrostructure;

  /** CRITICAL: Quality envelope — system belief about data reliability */
  quality: FrameQuality;

  /** Metadata: timestamps, sources, finality, latency */
  meta: MarketFrameMeta;
}

/**
 * Type guard: validate MarketFrame structure.
 */
export function isMarketFrame(obj: any): obj is MarketFrame {
  return (
    obj &&
    typeof obj.symbol === 'string' &&
    obj.symbol.length > 0 &&
    typeof obj.timeframe === 'string' &&
    obj.timeframe.length > 0 &&
    typeof obj.open === 'number' &&
    typeof obj.high === 'number' &&
    typeof obj.low === 'number' &&
    typeof obj.close === 'number' &&
    typeof obj.volume === 'number' &&
    obj.quality &&
    typeof obj.quality.sourceCount === 'number' &&
    typeof obj.quality.maxLatencyMs === 'number' &&
    typeof obj.quality.isFallback === 'boolean' &&
    typeof obj.quality.confidence === 'number' &&
    obj.quality.confidence >= 0 &&
    obj.quality.confidence <= 1 &&
    typeof obj.quality.evaluatedAt === 'number' &&
    obj.meta &&
    typeof obj.meta.mode === 'string' &&
    ['LIVE', 'REPLAY'].includes(obj.meta.mode) &&
    typeof obj.meta.source === 'string' &&
    ['WS', 'REPLAY_API', 'CACHE', 'FALLBACK'].includes(obj.meta.source) &&
    typeof obj.meta.tsOpen === 'number' &&
    typeof obj.meta.tsClose === 'number' &&
    typeof obj.meta.isFinal === 'boolean'
  );
}

/**
 * Assert: obj is a valid MarketFrame.
 * @throws Error if validation fails
 */
export function assertMarketFrame(obj: any): asserts obj is MarketFrame {
  if (!isMarketFrame(obj)) {
    throw new Error(
      `Invalid MarketFrame: expected { symbol, timeframe, open, high, low, close, volume, meta: { tsOpen, tsClose, isFinal, source } }, got ${JSON.stringify(obj)}`
    );
  }
}

/**
 * Factory: create a MarketFrame from OHLCV data with sensible defaults.
 * 
 * CRITICAL: Quality MUST be provided or computed by caller.
 * Default quality is conservative (0.5 confidence if not specified).
 */
export function createMarketFrame(
  symbol: string,
  timeframe: string,
  ohlcv: { open: number; high: number; low: number; close: number; volume: number },
  meta: Partial<MarketFrameMeta> = {},
  quality: Partial<FrameQuality> = {}
): MarketFrame {
  const now = Date.now();
  return {
    symbol,
    timeframe,
    ...ohlcv,
    quality: {
      sourceCount: quality.sourceCount ?? 1,
      maxLatencyMs: quality.maxLatencyMs ?? 0,
      isFallback: quality.isFallback ?? false,
      confidence: quality.confidence ?? 0.5, // Conservative default
      confidenceReason: quality.confidenceReason ?? 'default_conservative',
      evaluatedAt: quality.evaluatedAt ?? now,
    },
    meta: {
      mode: meta.mode ?? 'LIVE',
      source: meta.source ?? 'WS',
      tsOpen: meta.tsOpen ?? now,
      tsClose: meta.tsClose ?? now,
      isFinal: meta.isFinal ?? false,
      exchangeCount: meta.exchangeCount ?? 1,
      latencyMs: meta.latencyMs ?? 0,
      ...meta,
    },
  };
}
