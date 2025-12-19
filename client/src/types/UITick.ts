/**
 * UITick — Human Reality Layer (UI Truth Model)
 * 
 * Tells humans what's happening WITHOUT LYING.
 * Only safe, annotated, opinionated data reaches the human eye.
 * 
 * RULES (Enforced):
 * ❌ UI NEVER infers missing data
 * ❌ UI NEVER computes indicators on the fly
 * ✅ UI ONLY renders declared truth from UITick
 * ✅ UITick must include explicit source and uncertainty markers
 * 
 * Why: Prevents user confusion and silent data corruption in the display layer.
 */

export interface UITickOverlays {
  /** Type of signal (if any) detected on this tick */
  signal?: 'breakout' | 'mean_reversion' | 'momentum' | 'custom' | string;

  /** Confidence in the overlay signal (0–1) */
  confidence?: number;

  /** Human-readable annotation */
  label?: string;
}

export interface UITickState {
  /** EXECUTION CONTROL: 'LIVE' = real-time tradeable data, 'REPLAY' = historical non-tradeable */
  mode: 'LIVE' | 'REPLAY';

  /** DATA SOURCE: 'WS' = websocket, 'REPLAY_API' = replay endpoint, 'CACHE' = cached, 'FALLBACK' = degraded */
  source: 'WS' | 'REPLAY_API' | 'CACHE' | 'FALLBACK';

  /** Is this tick the final one for its bucket, or is it provisional? */
  isFinal: boolean;

  /** @deprecated Use 'mode' and 'source' instead of 'origin' */
  origin?: 'WS' | 'REPLAY' | 'FALLBACK';
}

export interface UITick {
  /** Epoch milliseconds (UTC) */
  ts: number;

  /** Symbol (normalized, e.g., 'BTCUSDT') */
  symbol: string;

  /** Last price (always present) */
  price: number;

  /** Optional price change and percentage for this tick */
  priceChange?: number;
  priceChangePercent?: number;

  /** Volume (if available) */
  volume?: number;

  /** Overlaid signals or annotations (optional) */
  overlays?: UITickOverlays;

  /** Operational state: mode, finality, origin */
  state: UITickState;

  /** Warnings or caveats the user should see */
  warnings?: string[];
}

/**
 * Type guard: validate UITick structure.
 */
export function isUITick(obj: any): obj is UITick {
  return (
    obj &&
    typeof obj.ts === 'number' &&
    !isNaN(obj.ts) &&
    obj.ts > 0 &&
    typeof obj.symbol === 'string' &&
    obj.symbol.length > 0 &&
    typeof obj.price === 'number' &&
    !isNaN(obj.price) &&
    obj.price > 0 &&
    obj.state &&
    (obj.state.mode === 'LIVE' || obj.state.mode === 'REPLAY') &&
    (obj.state.source === 'WS' || obj.state.source === 'REPLAY_API' || obj.state.source === 'CACHE' || obj.state.source === 'FALLBACK') &&
    typeof obj.state.isFinal === 'boolean'
  );
}

/**
 * Assert: obj is a valid UITick.
 * @throws Error if validation fails
 */
export function assertUITick(obj: any): asserts obj is UITick {
  if (!isUITick(obj)) {
    throw new Error(
      `Invalid UITick: expected { ts, symbol, price, state: { mode, source, isFinal } }, got ${JSON.stringify(obj)}`
    );
  }
}

/**
 * Factory: create a UITick from raw or market data.
 */
export function createUITick(
  ts: number,
  symbol: string,
  price: number,
  state: UITickState,
  overrides: Partial<UITick> = {}
): UITick {
  return {
    ts,
    symbol,
    price,
    state,
    warnings: [],
    ...overrides,
  };
}

/**
 * Factory: create a UITick in LIVE mode from a WorldTick-like object.
 */
export function createLiveUITick(
  raw: { timestamp?: number; ts?: number; symbol?: string; price?: number; [key: string]: any },
  source: 'WS' | 'REPLAY_API' | 'CACHE' | 'FALLBACK' = 'WS'
): UITick {
  const ts = raw.timestamp ?? raw.ts ?? Date.now();
  const symbol = raw.symbol ?? 'UNKNOWN';
  const price = raw.price ?? 0;

  const warnings: string[] = [];
  if (price <= 0) warnings.push('Invalid price (≤ 0)');
  if (!raw.symbol) warnings.push('Symbol missing');

  // ENFORCE: If source is REPLAY_API, mode must be REPLAY
  const mode = source === 'REPLAY_API' ? 'REPLAY' : 'LIVE';

  return {
    ts,
    symbol,
    price,
    state: {
      mode,
      source,
      isFinal: false,
      origin: source === 'REPLAY_API' ? 'REPLAY' : source === 'WS' ? 'WS' : 'FALLBACK',
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Factory: mark a UITick as final (all ticks for this bucket received).
 */
export function markUITickFinal(tick: UITick): UITick {
  return {
    ...tick,
    state: {
      ...tick.state,
      isFinal: true,
    },
  };
}

/**
 * Add a warning to a UITick.
 */
export function addUITickWarning(tick: UITick, warning: string): UITick {
  return {
    ...tick,
    warnings: [...(tick.warnings ?? []), warning],
  };
}
