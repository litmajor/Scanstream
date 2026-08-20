import { describe, expect, it } from 'vitest';
import { TickerSnapshotCache } from '../ticker-snapshot-cache';

function exchange(id: string, price: number, fetchTicker?: (symbol: string) => Promise<any>) {
  return {
    id,
    fetchTicker: fetchTicker ?? (async () => ({
      bid: price - 1,
      ask: price + 1,
      last: price,
      high: price + 2,
      low: price - 2,
      quoteVolume: 10,
      timestamp: 1_700_000_000_000,
    })),
  };
}

describe('ticker snapshot cache', () => {
  it('isolates values by venue and refuses implicit venue substitution', async () => {
    let now = 1_700_000_000_000;
    const binance = exchange('binance', 100);
    const coinbase = exchange('coinbase', 200);
    const cache = new TickerSnapshotCache(new Map([
      ['binance', binance],
      ['coinbase', coinbase],
    ]), 5_000, { clock: () => now });

    await expect(cache.getTicker('BTC/USDT', binance)).resolves.toMatchObject({
      last: 100,
      source: 'binance',
    });
    await expect(cache.getTicker('BTC/USDT', coinbase)).resolves.toMatchObject({
      last: 200,
      source: 'coinbase',
    });
    await expect(cache.getTicker('BTC/USDT')).resolves.toBeNull();
    now += 6_000;
    await expect(cache.getTicker('BTC/USDT', binance, 1_000)).resolves.toMatchObject({ last: 100 });
  });

  it('rejects stale cached values using the explicit read age', async () => {
    let now = 1_700_000_000_000;
    let calls = 0;
    const venue = exchange('binance', 100, async () => {
      calls += 1;
      if (calls > 1) throw new Error('refresh unavailable');
      return { last: 100, timestamp: now };
    });
    const cache = new TickerSnapshotCache(new Map([['binance', venue]]), 60_000, {
      clock: () => now,
    });
    await cache.getTicker('BTC/USDT', venue);
    now += 2_000;
    await expect(cache.getTicker('BTC/USDT', venue, 1_000)).resolves.toBeNull();
  });

  it('single-flights concurrent reads and limits different-key fetches', async () => {
    let now = 1_700_000_000_000;
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const venue = exchange('binance', 100, async () => {
      calls += 1;
      await gate;
      return { last: 100, timestamp: now };
    });
    const cache = new TickerSnapshotCache(new Map([['binance', venue]]), 5_000, {
      clock: () => now,
      maxConcurrentFetches: 1,
    });
    const reads = Promise.all(Array.from({ length: 10 }, () => cache.getTicker('BTC/USDT', venue)));
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    await expect(reads).resolves.toHaveLength(10);
  });

  it('does not cache failures and applies a short per-key backoff', async () => {
    let now = 1_700_000_000_000;
    let calls = 0;
    const venue = exchange('binance', 100, async () => {
      calls += 1;
      throw new Error('upstream unavailable');
    });
    const cache = new TickerSnapshotCache(new Map([['binance', venue]]), 5_000, {
      clock: () => now,
      failureBackoffMs: 1_000,
    });
    await expect(cache.getTicker('BTC/USDT', venue)).resolves.toBeNull();
    await expect(cache.getTicker('BTC/USDT', venue)).resolves.toBeNull();
    expect(calls).toBe(1);
    now += 1_001;
    await expect(cache.getTicker('BTC/USDT', venue)).resolves.toBeNull();
    expect(calls).toBe(2);
    expect(cache.getStats().cachedSymbols).toBe(0);
  });

  it('invalidates by key and by venue', async () => {
    const binance = exchange('binance', 100);
    const coinbase = exchange('coinbase', 200);
    const cache = new TickerSnapshotCache(new Map([
      ['binance', binance],
      ['coinbase', coinbase],
    ]));
    await cache.getTicker('BTC/USDT', binance);
    await cache.getTicker('ETH/USDT', binance);
    await cache.getTicker('BTC/USDT', coinbase);
    cache.invalidate('BTC/USDT', binance);
    expect(cache.getStats().cachedItems.map((item) => item.key)).toEqual([
      'binance:ETH/USDT',
      'coinbase:BTC/USDT',
    ]);
    cache.invalidateVenue('binance');
    expect(cache.getStats().cachedItems.map((item) => item.key)).toEqual(['coinbase:BTC/USDT']);
  });
});
