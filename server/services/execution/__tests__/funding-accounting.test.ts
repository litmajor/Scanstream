import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FundingAccounting } from '../funding-accounting';
import { LiveTradingEngine } from '../../../live-trading-engine';

function statePath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scanstream-funding-')), 'funding.json');
}

describe('funding accounting', () => {
  it('deduplicates payments by payment ID', async () => {
    let now = 1_700_000_000_000;
    const accounting = new FundingAccounting({ filePath: statePath(), clock: () => now, recheckIntervalMs: 60_000 });
    accounting.load();
    const exchange = {
      markets: { 'BTC/USDT:USDT': { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async () => [{
        id: 'payment-1',
        amount: -2,
        currency: 'USDT',
        timestamp: 1_700_000_000_000,
      }],
    };
    expect(await accounting.reconcile(exchange, 'BTC/USDT:USDT')).toMatchObject({ status: 'known' });
    now += 60_001;
    expect(await accounting.reconcile(exchange, 'BTC/USDT:USDT')).toMatchObject({ status: 'known' });
    expect(accounting.payments()).toHaveLength(1);
  });

  it('pages full responses and advances only after a short final page', async () => {
    const calls: number[] = [];
    const accounting = new FundingAccounting({
      filePath: statePath(),
      clock: () => 1_800_000_000_000,
      initialLookbackMs: 1_000,
    });
    accounting.load();
    const full = Array.from({ length: 200 }, (_, index) => ({
      id: `p-${index}`,
      amount: 1,
      currency: 'USDT',
      timestamp: 1_800_000_000_000 + index,
    }));
    const exchange = {
      markets: { BTC: { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async (_symbol: string, since: number, limit: number) => {
        calls.push(since);
        return calls.length === 1 ? full : [{ id: 'p-last', amount: 1, currency: 'USDT', timestamp: since + 1 }];
      },
    };
    const first = await accounting.reconcile(exchange, 'BTC');
    expect(first.status).toBe('unknown');
    expect(calls).toHaveLength(2);
    expect(accounting.payments()).toHaveLength(201);
    expect(calls[1]).toBeGreaterThan(calls[0]);
  });

  it('does not reuse unknown funding answers', async () => {
    let now = 1_800_000_000_000;
    let queries = 0;
    const accounting = new FundingAccounting({
      filePath: statePath(),
      clock: () => now,
      initialLookbackMs: 1_000,
      recheckIntervalMs: 60_000,
    });
    accounting.load();
    const exchange = {
      markets: { BTC: { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async () => {
        queries += 1;
        throw new Error('history unavailable');
      },
    };
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('unknown');
    now += 1;
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('unknown');
    expect(queries).toBe(2);
  });

  it('reuses a durable known answer only within the configured interval', async () => {
    let now = 1_800_000_000_000;
    const filePath = statePath();
    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 1,
      writtenAt: new Date(now).toISOString(),
      payments: [],
      lastCheckedAt: { BTC: now - 1 },
      lastKnownAt: { BTC: now - 1 },
      initialLookbackUnknown: {},
      initialLookbackSince: {},
      baselineAttestations: {},
    }));
    const accounting = new FundingAccounting({ filePath, clock: () => now, recheckIntervalMs: 60_000 });
    expect(accounting.load().status).toBe('ok');
    let queries = 0;
    const exchange = {
      markets: { BTC: { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async () => {
        queries += 1;
        return [];
      },
    };
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('known');
    expect(queries).toBe(0);
    now += 60_000;
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('known');
    expect(queries).toBe(1);
  });

  it('proves initial coverage when the venue returns a short page at the boundary', async () => {
    const accounting = new FundingAccounting({
      filePath: statePath(),
      clock: () => 1_800_000_000_000,
      initialLookbackMs: 1_000,
    });
    accounting.load();
    expect(await accounting.reconcile({
      markets: { BTC: { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async () => [{
        id: 'p1',
        amount: 1,
        currency: 'USDT',
        timestamp: 1_800_000_000_000,
      }],
    }, 'BTC')).toMatchObject({ status: 'known' });
  });

  it('attests one unknown baseline and requires a new gap to block again', async () => {
    let now = 1_800_000_000_000;
    const accounting = new FundingAccounting({
      filePath: statePath(),
      clock: () => now,
      initialLookbackMs: 1_000,
      recheckIntervalMs: 0,
    });
    accounting.load();
    const full = Array.from({ length: 200 }, (_, index) => ({
      id: `p-${index}`,
      amount: 1,
      currency: 'USDT',
      timestamp: now + index,
    }));
    const calls: Record<string, number> = {};
    const exchange = {
      markets: { BTC: { type: 'swap' }, ETH: { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async (symbol: string) => {
        calls[symbol] = (calls[symbol] ?? 0) + 1;
        if (calls[symbol] <= 2) return calls[symbol] === 1 ? full : [];
        if (symbol === 'BTC' && calls[symbol] === 3) return [];
        if (symbol === 'BTC') {
          if (calls[symbol] === 4) return full;
          throw new Error('truncated history');
        }
        return [];
      },
    };

    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('unknown');
    expect((await accounting.reconcile(exchange, 'ETH')).status).toBe('unknown');
    accounting.attestInitialCoverage('BTC', 'venue export reviewed to establish baseline');
    const persisted = JSON.parse(fs.readFileSync(accounting.getPath(), 'utf8'));
    expect(persisted.initialLookbackUnknown).toMatchObject({ BTC: false, ETH: true });
    expect(persisted.baselineAttestations.BTC).toMatchObject({
      symbol: 'BTC',
      reason: 'venue export reviewed to establish baseline',
    });
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('known');
    expect((await accounting.reconcile(exchange, 'ETH')).status).toBe('unknown');
    now += 1;
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('unknown');
  });

  it('refuses unsupported and failed funding queries as unknown', async () => {
    const unsupported = new FundingAccounting({ filePath: statePath() });
    unsupported.load();
    expect(await unsupported.reconcile({ markets: { BTC: { type: 'swap' } } }, 'BTC')).toMatchObject({
      status: 'unknown',
      reason: 'funding_source_unsupported',
    });

    const failed = new FundingAccounting({ filePath: statePath() });
    failed.load();
    expect(await failed.reconcile({
      markets: { BTC: { type: 'swap' } },
      has: { fetchFundingHistory: true },
      fetchFundingHistory: async () => { throw new Error('exchange unavailable'); },
    }, 'BTC')).toMatchObject({ status: 'unknown' });
  });

  it('uses declared ledger funding capability, pages it, and deduplicates payment IDs', async () => {
    const calls: number[] = [];
    const accounting = new FundingAccounting({
      filePath: statePath(),
      clock: () => 1_800_000_000_000,
      initialLookbackMs: 1_000,
    });
    accounting.load();
    const full = Array.from({ length: 200 }, (_, index) => ({
      id: `ledger-${index}`,
      type: 'funding',
      symbol: 'BTC',
      amount: -1,
      currency: 'USDT',
      timestamp: 1_800_000_000_000 - index,
    }));
    const exchange = {
      markets: { BTC: { symbol: 'BTC', type: 'swap', settle: 'USDT' } },
      has: { fetchFundingHistory: false, fetchLedger: true },
      fetchLedger: async (currency: string, since: number) => {
        expect(currency).toBe('USDT');
        calls.push(since);
        return calls.length === 1
          ? full
          : [
            { id: 'ledger-0', type: 'funding', symbol: 'BTC', amount: -1, currency: 'USDT', timestamp: since },
            { id: 'trade-1', type: 'trade', symbol: 'BTC', amount: 5, currency: 'USDT', timestamp: since },
          ];
      },
    };
    expect((await accounting.reconcile(exchange, 'BTC')).status).toBe('unknown');
    expect(calls).toHaveLength(2);
    expect(accounting.payments()).toHaveLength(200);
    expect(accounting.payments()[0].source).toBe('ledger');
  });

  it('attributes ledger rows through the exchange raw market-id index', async () => {
    const calls: string[] = [];
    const accounting = new FundingAccounting({ filePath: statePath(), clock: () => 1_800_000_000_000 });
    accounting.load();
    const exchange = {
      markets: { 'BTC/USDT:USDT': { symbol: 'BTC/USDT:USDT', type: 'swap', settle: 'USDT' } },
      markets_by_id: {
        'BTC-PERP': { symbol: 'BTC/USDT:USDT', type: 'swap', settle: 'USDT' },
      },
      market: (candidate: string) => {
        if (candidate === 'BTC/USDT:USDT') return exchange.markets[candidate];
        throw new Error('raw market id is resolved through markets_by_id');
      },
      has: { fetchFundingHistory: false, fetchLedger: true },
      fetchLedger: async (currency: string) => {
        calls.push(currency);
        return [{
          id: 'ledger-btc',
          type: 'funding',
          amount: -1,
          currency: 'USDT',
          timestamp: 1_800_000_000_000,
          info: { instrument: 'BTC-PERP' },
        }];
      },
    };

    expect(await accounting.reconcile(exchange, 'BTC/USDT:USDT')).toMatchObject({ status: 'known' });
    expect(calls).toEqual(['USDT']);
    expect(accounting.payments()).toHaveLength(1);
  });

  it('skips ledger funding rows attributed to other markets in the settle currency', async () => {
    const accounting = new FundingAccounting({ filePath: statePath(), clock: () => 1_800_000_000_000 });
    accounting.load();
    const exchange = {
      markets: {
        'BTC/USDT:USDT': { symbol: 'BTC/USDT:USDT', type: 'swap', settle: 'USDT' },
        'ETH/USDT:USDT': { symbol: 'ETH/USDT:USDT', type: 'swap', settle: 'USDT' },
      },
      has: { fetchFundingHistory: false, fetchLedger: true },
      fetchLedger: async (currency: string) => {
        expect(currency).toBe('USDT');
        return [{
          id: 'ledger-eth',
          type: 'funding',
          symbol: 'ETH/USDT:USDT',
          amount: -1,
          currency: 'USDT',
          timestamp: 1_800_000_000_000,
        }];
      },
    };

    await expect(accounting.reconcile(exchange, 'BTC/USDT:USDT')).resolves.toMatchObject({
      status: 'known',
      payments: [],
    });
  });

  it('refuses a funding ledger row without market attribution', async () => {
    const accounting = new FundingAccounting({ filePath: statePath(), clock: () => 1_800_000_000_000 });
    accounting.load();
    const exchange = {
      markets: {
        'BTC/USDT:USDT': { symbol: 'BTC/USDT:USDT', type: 'swap', settle: 'USDT' },
      },
      has: { fetchFundingHistory: false, fetchLedger: true },
      fetchLedger: async (currency: string) => {
        expect(currency).toBe('USDT');
        return [{
          id: 'ledger-unknown',
          type: 'funding',
          amount: -1,
          currency: 'USDT',
          timestamp: 1_800_000_000_000,
          info: { currency: 'USDT' },
        }];
      },
    };

    await expect(accounting.reconcile(exchange, 'BTC/USDT:USDT')).resolves.toMatchObject({
      status: 'unknown',
      reason: 'funding_ledger_unattributable',
    });
  });

  it('refuses unrelated non-contract ledger identifiers instead of skipping the row', async () => {
    const accounting = new FundingAccounting({ filePath: statePath(), clock: () => 1_800_000_000_000 });
    accounting.load();
    const exchange = {
      markets: {
        'BTC/USDT:USDT': { symbol: 'BTC/USDT:USDT', type: 'swap', settle: 'USDT' },
        USDT: { symbol: 'USDT', type: 'spot' },
      },
      has: { fetchFundingHistory: false, fetchLedger: true },
      fetchLedger: async () => [{
        id: 'ledger-spot-info',
        type: 'funding',
        amount: -1,
        currency: 'USDT',
        timestamp: 1_800_000_000_000,
        info: { currency: 'USDT' },
      }],
    };

    await expect(accounting.reconcile(exchange, 'BTC/USDT:USDT')).resolves.toMatchObject({
      status: 'unknown',
      reason: 'funding_ledger_unattributable',
    });
  });

  it('refuses ledger rows resolving to multiple contract markets', async () => {
    const accounting = new FundingAccounting({ filePath: statePath(), clock: () => 1_800_000_000_000 });
    accounting.load();
    const exchange = {
      markets: {
        'BTC/USDT:USDT': { symbol: 'BTC/USDT:USDT', type: 'swap', settle: 'USDT' },
        'ETH/USDT:USDT': { symbol: 'ETH/USDT:USDT', type: 'swap', settle: 'USDT' },
      },
      has: { fetchFundingHistory: false, fetchLedger: true },
      fetchLedger: async () => [{
        id: 'ledger-ambiguous',
        type: 'funding',
        amount: -1,
        currency: 'USDT',
        timestamp: 1_800_000_000_000,
        info: {
          firstMarket: 'BTC/USDT:USDT',
          secondMarket: 'ETH/USDT:USDT',
        },
      }],
    };

    await expect(accounting.reconcile(exchange, 'BTC/USDT:USDT')).resolves.toMatchObject({
      status: 'unknown',
      reason: 'funding_ledger_attribution_ambiguous',
    });
  });

  it('does not let unsupported-source venues be cleared by baseline attestation', async () => {
    const accounting = new FundingAccounting({ filePath: statePath() });
    accounting.load();
    expect(await accounting.reconcile({ markets: { BTC: { type: 'swap' } }, has: {} }, 'BTC'))
      .toMatchObject({ status: 'unknown', reason: 'funding_source_unsupported' });
    expect(() => accounting.attestInitialCoverage('BTC', 'operator reviewed venue'))
      .toThrow(/not awaiting attestation/);
  });

  it('does not require funding accounting for spot markets', async () => {
    const accounting = new FundingAccounting({ filePath: statePath() });
    accounting.load();
    expect(await accounting.reconcile({
      markets: { 'BTC/USDT': { type: 'spot' } },
    }, 'BTC/USDT')).toEqual({ status: 'not_required', payments: [] });
  });

  it('allows unknown funding only through the explicit operator escape hatch', async () => {
    const accounting = new FundingAccounting({ filePath: statePath() });
    accounting.load();
    const engine = new LiveTradingEngine(
      { enabled: true, testMode: false },
      { fundingAccounting: accounting },
    );
    const internal = engine as unknown as {
      fundingLoaded: boolean;
      fundingHealthy: boolean;
      exchange: unknown;
      ensureFundingAccounted(symbol: string): Promise<boolean>;
    };
    internal.fundingLoaded = true;
    internal.fundingHealthy = true;
    internal.exchange = { markets: { BTC: { type: 'swap' } } };

    const previous = process.env.ALLOW_UNACCOUNTED_FUNDING;
    delete process.env.ALLOW_UNACCOUNTED_FUNDING;
    await expect(internal.ensureFundingAccounted('BTC')).resolves.toBe(false);
    process.env.ALLOW_UNACCOUNTED_FUNDING = '1';
    await expect(internal.ensureFundingAccounted('BTC')).resolves.toBe(true);
    if (previous === undefined) delete process.env.ALLOW_UNACCOUNTED_FUNDING;
    else process.env.ALLOW_UNACCOUNTED_FUNDING = previous;
    engine.dispose();
  });
});
