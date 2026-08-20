import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  computeRealizedClosePnl,
  RealizedPnlLedger,
} from '../realized-pnl-ledger';
import { QuoteCurrencyConverter } from '../quote-conversion';

function ledgerPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scanstream-realized-')), 'ledger.json');
}

describe('realized PnL ledger', () => {
  it('computes long and short closes with quote fees', () => {
    const long = computeRealizedClosePnl({
      side: 'long',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 2,
      fees: [{ currency: 'USDT', cost: 3 }],
      quoteCurrency: 'USDT',
    });
    const short = computeRealizedClosePnl({
      side: 'short',
      entryPrice: 100,
      exitPrice: 90,
      quantity: 1,
      fees: [],
      quoteCurrency: 'USDT',
    });

    expect(long).toMatchObject({ grossPnl: 20, pnl: 17, quoteFees: 3 });
    expect(short).toMatchObject({ grossPnl: 10, pnl: 10 });
  });

  it('reports non-quote fees without inventing a conversion', () => {
    const result = computeRealizedClosePnl({
      side: 'long',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      fees: [{ currency: 'BNB', cost: 0.01 }],
      quoteCurrency: 'USDT',
    });
    expect(result.pnl).toBe(10);
    expect(result.unconvertedFees).toEqual([{ currency: 'BNB', cost: 0.01 }]);
  });

  it('converts direct and inverse same-venue quotes only when the ticker is fresh', async () => {
    const now = 1_700_000_000_000;
    const converter = new QuoteCurrencyConverter({ maxAgeMs: 60_000, clock: () => now });
    const exchange = {
      markets: { 'BNB/USDT': {}, 'USDT/BTC': {} },
      fetchTicker: async (symbol: string) => ({
        last: symbol === 'BNB/USDT' ? 300 : 0.00002,
        timestamp: now - 1_000,
      }),
    };
    await expect(converter.convert(exchange, 'BNB', 'USDT', 0.01)).resolves.toMatchObject({
      status: 'known',
      conversion: { market: 'BNB/USDT', direction: 'direct', quoteAmount: 3 },
    });
    await expect(converter.convert(exchange, 'BTC', 'USDT', 0.01)).resolves.toMatchObject({
      status: 'known',
      conversion: { market: 'USDT/BTC', direction: 'inverse' },
    });
    const inverse = await converter.convert(exchange, 'BTC', 'USDT', 0.01);
    expect(inverse.status === 'known' ? inverse.conversion.quoteAmount : null).toBeCloseTo(500);
  });

  it('rejects stale, timestamp-less, non-positive, missing and failed ticker data', async () => {
    const now = 1_700_000_000_000;
    const converter = new QuoteCurrencyConverter({ maxAgeMs: 60_000, clock: () => now });
    await expect(converter.convert({
      markets: { 'BNB/USDT': {} },
      fetchTicker: async () => ({ last: 300, timestamp: now - 60_001 }),
    }, 'BNB', 'USDT', 1)).resolves.toMatchObject({ status: 'unknown' });
    await expect(converter.convert({
      markets: { 'BNB/USDT': {} },
      fetchTicker: async () => ({ last: 300 }),
    }, 'BNB', 'USDT', 1)).resolves.toMatchObject({ status: 'unknown' });
    await expect(converter.convert({
      markets: { 'BNB/USDT': {} },
      fetchTicker: async () => ({ last: 0, timestamp: now }),
    }, 'BNB', 'USDT', 1)).resolves.toMatchObject({ status: 'unknown' });
    await expect(converter.convert({
      markets: {},
      fetchTicker: async () => ({ last: 300, timestamp: now }),
    }, 'BNB', 'USDT', 1)).resolves.toMatchObject({ status: 'unknown' });
    await expect(converter.convert({
      markets: { 'BNB/USDT': {} },
      fetchTicker: async () => { throw new Error('ticker failed'); },
    }, 'BNB', 'USDT', 1)).resolves.toMatchObject({ status: 'unknown' });
  });

  it('keeps unknown arithmetic unknown', () => {
    expect(computeRealizedClosePnl({
      side: 'long',
      entryPrice: null,
      exitPrice: 110,
      quantity: 1,
      fees: [],
      quoteCurrency: 'USDT',
    }).pnl).toBeNull();
  });

  it('persists entries, survives reload, and deduplicates IDs', () => {
    const filePath = ledgerPath();
    const first = new RealizedPnlLedger({ filePath, clock: () => 1_700_000_000_000 });
    expect(first.load().status).toBe('absent');
    expect(first.append({
      id: 'close-1',
      category: 'trade',
      at: new Date(1_700_000_000_000).toISOString(),
      symbol: 'BTC/USDT',
      quoteCurrency: 'USDT',
      pnl: 12,
      grossPnl: 13,
      quoteFees: 1,
      unconvertedFees: [],
    })).toBe(true);
    expect(first.append({
      id: 'close-1',
      category: 'trade',
      at: new Date(1_700_000_000_000).toISOString(),
      symbol: 'BTC/USDT',
      quoteCurrency: 'USDT',
      pnl: 12,
      grossPnl: 13,
      quoteFees: 1,
      unconvertedFees: [],
    })).toBe(false);

    const second = new RealizedPnlLedger({ filePath, clock: () => 1_700_000_000_000 });
    expect(second.load().status).toBe('ok');
    expect(second.summary().pnl).toBe(12);
  });

  it('treats corrupt state as unreadable', () => {
    const filePath = ledgerPath();
    fs.writeFileSync(filePath, '{truncated');
    expect(new RealizedPnlLedger({ filePath }).load()).toMatchObject({ status: 'unreadable' });
  });

  it('returns unknown daily totals when an entry is unknown', () => {
    const filePath = ledgerPath();
    const ledger = new RealizedPnlLedger({ filePath, clock: () => 1_700_000_000_000 });
    ledger.load();
    ledger.append({
      id: 'unknown-close',
      category: 'trade',
      at: new Date(1_700_000_000_000).toISOString(),
      symbol: 'BTC/USDT',
      quoteCurrency: 'USDT',
      pnl: null,
      grossPnl: null,
      quoteFees: null,
      unconvertedFees: [],
    });
    expect(ledger.summary().pnl).toBeNull();
    expect(ledger.summary().unknown).toBe(true);
  });

  it('keeps unconvertible fees unknown and applies immutable conversion records once', () => {
    const now = 1_700_000_000_000;
    const ledger = new RealizedPnlLedger({ filePath: ledgerPath(), clock: () => now });
    ledger.load();
    ledger.append({
      id: 'fee-close',
      category: 'trade',
      at: new Date(now).toISOString(),
      symbol: 'BTC/USDT',
      quoteCurrency: 'USDT',
      pnl: 10,
      grossPnl: 10,
      quoteFees: 0,
      unconvertedFees: [{ currency: 'BNB', cost: 0.01 }],
    });
    expect(ledger.summary()).toMatchObject({ pnl: null, unknown: true });
    expect(ledger.appendConversion('fee-close', {
      kind: 'fee',
      feeIndex: 0,
      sourceCurrency: 'BNB',
      quoteCurrency: 'USDT',
      sourceAmount: 0.01,
      quoteAmount: 3,
      rate: 300,
      market: 'BNB/USDT',
      direction: 'direct',
      tickerTimestamp: now,
      convertedAt: new Date(now).toISOString(),
    })).toBe(true);
    expect(ledger.appendConversion('fee-close', {
      kind: 'fee',
      feeIndex: 0,
      sourceCurrency: 'BNB',
      quoteCurrency: 'USDT',
      sourceAmount: 0.01,
      quoteAmount: 3,
      rate: 300,
      market: 'BNB/USDT',
      direction: 'direct',
      tickerTimestamp: now,
      convertedAt: new Date(now).toISOString(),
    })).toBe(false);
    expect(ledger.summary()).toMatchObject({ pnl: 7, unknown: false, unconvertedFees: [] });
    const original = ledger.entries().find((entry) => entry.id === 'fee-close');
    expect(original?.pnl).toBe(10);
    expect(original?.unconvertedFees).toEqual([{ currency: 'BNB', cost: 0.01 }]);
    expect(ledger.entries().filter((entry) => entry.category === 'conversion')).toHaveLength(1);
  });

  it('applies signed funding conversion to the daily funding total', () => {
    const now = 1_700_000_000_000;
    const ledger = new RealizedPnlLedger({ filePath: ledgerPath(), clock: () => now });
    ledger.load();
    ledger.append({
      id: 'funding-btc',
      category: 'funding',
      at: new Date(now).toISOString(),
      symbol: 'BTC/USDT:USDT',
      quoteCurrency: 'USDT',
      pnl: null,
      grossPnl: null,
      quoteFees: 0,
      unconvertedFees: [{ currency: 'BTC', cost: 0.01 }],
      fundingAmount: -0.01,
      fundingCurrency: 'BTC',
      fundingSource: 'ledger',
    });
    ledger.appendConversion('funding-btc', {
      kind: 'funding',
      feeIndex: 0,
      sourceCurrency: 'BTC',
      quoteCurrency: 'USDT',
      sourceAmount: -0.01,
      quoteAmount: -300,
      rate: 30_000,
      market: 'BTC/USDT',
      direction: 'direct',
      tickerTimestamp: now,
      convertedAt: new Date(now).toISOString(),
    });
    expect(ledger.summary()).toMatchObject({
      pnl: -300,
      fundingPnl: -300,
      unknown: false,
      unconvertedFees: [],
    });
  });

  it('rejects fee conversions for funding entries', () => {
    const now = 1_700_000_000_000;
    const ledger = new RealizedPnlLedger({ filePath: ledgerPath(), clock: () => now });
    ledger.load();
    ledger.append({
      id: 'funding-entry',
      category: 'funding',
      at: new Date(now).toISOString(),
      symbol: 'BTC/USDT:USDT',
      quoteCurrency: 'USDT',
      pnl: null,
      grossPnl: null,
      quoteFees: 0,
      unconvertedFees: [{ currency: 'BTC', cost: 0.01 }],
      fundingAmount: -0.01,
      fundingCurrency: 'BTC',
      fundingSource: 'ledger',
    });
    expect(() => ledger.appendConversion('funding-entry', {
      kind: 'fee',
      feeIndex: 0,
      sourceCurrency: 'BTC',
      quoteCurrency: 'USDT',
      sourceAmount: 0.01,
      quoteAmount: 300,
      rate: 30_000,
      market: 'BTC/USDT',
      direction: 'direct',
      tickerTimestamp: now,
      convertedAt: new Date(now).toISOString(),
    })).toThrow(/trade entry/);
  });

  it('requires an explicit durable resolution for an unknown entry', () => {
    const filePath = ledgerPath();
    const ledger = new RealizedPnlLedger({ filePath, clock: () => 1_700_000_000_000 });
    ledger.load();
    ledger.append({
      id: 'unknown-close',
      category: 'trade',
      at: new Date(1_700_000_000_000).toISOString(),
      symbol: 'BTC/USDT',
      quoteCurrency: 'USDT',
      pnl: null,
      grossPnl: null,
      quoteFees: null,
      unconvertedFees: [],
    });

    const resolved = ledger.resolveUnknown('unknown-close', {
      kind: 'attested_value',
      pnl: -7,
      reason: 'exchange trade export reviewed',
    });
    expect(resolved.pnl).toBeNull();
    expect(ledger.summary()).toMatchObject({ pnl: -7, unknown: false });
    expect(ledger.entries()).toHaveLength(2);

    const reloaded = new RealizedPnlLedger({ filePath, clock: () => 1_700_000_000_000 });
    expect(reloaded.load().status).toBe('ok');
    expect(reloaded.summary()).toMatchObject({ pnl: -7, unknown: false });
    expect(() => reloaded.resolveUnknown('unknown-close', {
      kind: 'excluded_unknown',
      reason: 'duplicate request',
    })).toThrow(/already resolved/);
  });

  it('can explicitly exclude an unknown entry without treating it as zero', () => {
    const filePath = ledgerPath();
    const ledger = new RealizedPnlLedger({ filePath, clock: () => 1_700_000_000_000 });
    ledger.load();
    ledger.append({
      id: 'unknown-funding',
      category: 'funding',
      at: new Date(1_700_000_000_000).toISOString(),
      symbol: 'BTC/USDT:USDT',
      quoteCurrency: 'USDT',
      pnl: null,
      grossPnl: null,
      quoteFees: null,
      unconvertedFees: [{ currency: 'BTC', cost: 0.01 }],
    });
    ledger.resolveUnknown('unknown-funding', {
      kind: 'excluded_unknown',
      reason: 'operator accepted non-quote funding exclusion',
    });
    expect(ledger.summary()).toMatchObject({ pnl: 0, unknown: false });
    expect(ledger.summary().unconvertedFees).toEqual([{ currency: 'BTC', cost: 0.01 }]);
  });
});
