import { describe, expect, it, vi } from 'vitest';
import { priceCache } from '../../../../src/core/PriceCache';
import type { MarketFrame } from '@shared/schema';
import { CCXTScanner } from '../ccxt-scanner';
import { CacheManager } from '../cache-manager';
import { ExchangeAggregator } from '../exchange-aggregator';
import { RateLimiter } from '../rate-limiter';

function makeFrames(): MarketFrame[] {
  return Array.from({ length: 20 }, (_, index) => ({
    id: `frame-${index}`,
    timestamp: new Date(Date.now() - (20 - index) * 60_000),
    symbol: 'BTC/USDT',
    timeframe: 60,
    price: { open: 99, high: 101, low: 98, close: 100 + index },
    volume: 10,
    indicators: {
      rsi: 55,
      macd: { macd: 1, signal: 0.5, histogram: 0.5 },
      bb: { lower: 90, upper: 110 },
      ema20: 100,
      ema50: 98,
      ema200: 95,
      adx: 25,
      atr: 2,
    },
    orderFlow: {},
    marketMicrostructure: {},
  }));
}

describe('CCXTScanner price cache path', () => {
  it('uses the authoritative price cache without throwing on the default cached path', async () => {
    const cache = new CacheManager();
    const rateLimiter = new RateLimiter();
    const aggregator = new ExchangeAggregator(cache, rateLimiter);
    const frames = makeFrames();
    const candles = frames.map((frame) => [
      frame.timestamp.getTime(),
      frame.price.open,
      frame.price.high,
      frame.price.low,
      frame.price.close,
      frame.volume,
    ] as [number, number, number, number, number, number]);

    priceCache.set('BTC/USDT', {
      symbol: 'BTC/USDT',
      price: 100,
      timestamp: Date.now(),
      exchange: 'binance',
      confidence: 99,
    });
    const getAggregatedPrice = vi.spyOn(aggregator, 'getAggregatedPrice');
    vi.spyOn(aggregator, 'getOHLCV').mockResolvedValue(
      candles.map((candle) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        exchange: 'binance',
      })),
    );
    vi.spyOn(aggregator, 'getMarketFrames').mockResolvedValue(frames);

    const scanner = new CCXTScanner(aggregator, cache, rateLimiter);
    const results = await scanner.scanSymbols(['BTC/USDT'], '1m', {
      parallel: false,
      useCache: true,
      minConfidence: 70,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.price).toBe(100);
    expect(getAggregatedPrice).not.toHaveBeenCalled();
  });
});
