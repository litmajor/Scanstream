/**
 * Cross-Exchange Types
 */
import type { Candle } from '../../types/market-data';

export type SymbolUniverse = {
  symbol: string; // "BTC/USDT"
  exchanges: string[]; // ["binance","kraken"]
};

export type AggregatedCandle = {
  symbol: string;
  exchangeCandles: Record<string, Candle | undefined>; // key=exchange
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  timestamp: number; // aligned worldTime or last update
  sourcesSeen: string[];
  confidence?: number; // 0-100 for synthetic/filled candles
};
