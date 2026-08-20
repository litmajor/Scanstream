import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheManager } from '../cache-manager';

describe('CacheManager freshness bounds', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a miss without evicting when a caller bound is exceeded', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const cache = new CacheManager();
    cache.set('ticker', { price: 100 }, 200);

    now.mockReturnValue(1_101);
    const missesBefore = cache.getStats().misses;
    expect(cache.get('ticker', true, 100)).toBeNull();
    expect(cache.getStats().misses).toBe(missesBefore + 1);

    now.mockReturnValue(1_050);
    expect(cache.get('ticker', false, 200)).toEqual({ price: 100 });
  });

  it('returns stale data when its TTL is exceeded and stale reads are allowed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const cache = new CacheManager();
    cache.set('ticker', { price: 100 }, 100);

    now.mockReturnValue(1_101);
    expect(cache.get('ticker', true)).toEqual({ price: 100 });
  });

  it('evicts expired data when stale reads are not allowed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const cache = new CacheManager();
    cache.set('ticker', { price: 100 }, 100);

    now.mockReturnValue(1_101);
    const missesBefore = cache.getStats().misses;
    expect(cache.get('ticker', false)).toBeNull();
    expect(cache.getStats().misses).toBe(missesBefore + 1);
    expect(cache.get('ticker', true)).toBeNull();
  });
});
