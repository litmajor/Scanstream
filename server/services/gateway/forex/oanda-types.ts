/**
 * OANDA API Type Definitions
 * 
 * Minimal types for OANDA REST API v20
 * Focus: candle fetching, not full feature coverage
 */

/**
 * OANDA candle response from API
 */
export interface OandaCandleResponse {
  instrument: string;
  granularity: string;
  candles: OandaCandle[];
}

/**
 * Individual OANDA candle
 */
export interface OandaCandle {
  complete: boolean;           // candle is finalized
  volume: number;              // tick count (not standard volume)
  time: string;                // ISO 8601 timestamp
  mid: OandaPrice;             // mid price (representative)
  ask?: OandaPrice;            // ask price
  bid?: OandaPrice;            // bid price
}

/**
 * OANDA price structure (OHLC)
 */
export interface OandaPrice {
  o: string;                   // open
  h: string;                   // high
  l: string;                   // low
  c: string;                   // close
}

/**
 * OANDA request parameters for candles
 */
export interface OandaCandlesRequest {
  instrument: string;          // e.g. "EUR_USD"
  granularity: string;         // e.g. "M1", "M5", "H1", "D"
  count?: number;              // number of candles to fetch
  price?: 'M' | 'B' | 'A';     // 'M' = mid, 'B' = bid, 'A' = ask
  from?: string;               // ISO 8601 start time
  to?: string;                 // ISO 8601 end time
}

/**
 * OANDA HTTP response envelope
 */
export interface OandaResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
