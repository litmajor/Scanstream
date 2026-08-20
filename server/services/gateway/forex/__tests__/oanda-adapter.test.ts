import { describe, expect, it, vi } from 'vitest';
import { OandaAdapter } from '../oanda-adapter';
import { OandaClient } from '../oanda-client';

describe('OandaAdapter', () => {
  it('marks REST candles as historical and preserves the adapter origin', async () => {
    const client = new OandaClient({ apiKey: 'test', accountId: 'test' });
    vi.spyOn(client, 'getCandles').mockResolvedValue({
      instrument: 'EUR_USD',
      granularity: 'H1',
      candles: [{
        complete: true,
        volume: 10,
        time: '2024-01-01T00:00:00.000Z',
        mid: { o: '1', h: '2', l: '0.5', c: '1.5' },
      }],
    });

    const [candle] = await new OandaAdapter(client).fetchCandles('EUR_USD', 3600, 1);

    expect(candle).toMatchObject({
      source: 'historical',
      origin: 'oanda',
      venue: 'OANDA',
    });
  });
});
