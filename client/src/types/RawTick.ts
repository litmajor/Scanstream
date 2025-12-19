/**
 * RawTick — Exchange Truth Layer (Unstable by Design)
 * 
 * Represents EXACTLY what the exchange says — nothing more, nothing less.
 * 
 * RULES (Enforced):
 * ❌ Agents NEVER see RawTick
 * ❌ UI NEVER sees RawTick
 * ✅ Stored only in buffers/streams, never persisted to DB
 * ✅ Immediately converted to MarketFrame or UITick
 * 
 * Why: Raw data is radioactive ☢️ — powerful but unsafe.
 * No interpretation, no assumptions, can be wrong/duplicated/late/missing.
 */

export interface RawTick {
  /** Epoch milliseconds (UTC) — exchange timestamp, not our processing time */
  ts: number;

  /** Exchange identifier (e.g., 'binance', 'kraken', 'bybit') */
  exchange: string;

  /** Symbol as exchange reports it (e.g., 'BTCUSDT', 'BTC/USD') */
  symbol: string;

  /** Last traded price (always present for tick data) */
  price: number;

  /** Trade size / order size (optional for some exchange APIs) */
  size?: number;

  /** Direction of trade: 'buy' or 'sell' (optional for aggregated candles) */
  side?: 'buy' | 'sell';

  /** Unique trade ID from exchange (optional, used for dedup) */
  tradeId?: string;

  /** Sequence number for ordering guarantees (optional) */
  seq?: number;

  /** Arbitrary exchange-specific fields (future-proofing) */
  extra?: Record<string, any>;
}

/**
 * Type guard: validate that an object is a valid RawTick.
 * Checks only required fields; optional fields are not validated deeply.
 */
export function isRawTick(obj: any): obj is RawTick {
  return (
    obj &&
    typeof obj.ts === 'number' &&
    !isNaN(obj.ts) &&
    obj.ts > 0 &&
    typeof obj.exchange === 'string' &&
    obj.exchange.length > 0 &&
    typeof obj.symbol === 'string' &&
    obj.symbol.length > 0 &&
    typeof obj.price === 'number' &&
    !isNaN(obj.price) &&
    obj.price > 0 &&
    (obj.size === undefined || (typeof obj.size === 'number' && obj.size > 0)) &&
    (obj.side === undefined || ['buy', 'sell'].includes(obj.side))
  );
}

/**
 * Assert: obj is a valid RawTick, throw if not.
 * @throws Error if validation fails
 */
export function assertRawTick(obj: any): asserts obj is RawTick {
  if (!isRawTick(obj)) {
    throw new Error(
      `Invalid RawTick: expected { ts, exchange, symbol, price, size?, side?, tradeId?, seq? }, got ${JSON.stringify(obj)}`
    );
  }
}
