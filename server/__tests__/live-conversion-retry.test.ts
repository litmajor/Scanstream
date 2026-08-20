import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LiveTradingEngine } from '../live-trading-engine';
import { RealizedPnlLedger } from '../services/execution/realized-pnl-ledger';
import { safetyEventLog } from '../services/observability/safety-event-log';

function ledgerPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scanstream-conversion-')), 'ledger.json');
}

describe('live conversion retry safety', () => {
  it('emits the first unknown signal and retries a current-day conversion', async () => {
    let now = Date.now();
    const ledger = new RealizedPnlLedger({ filePath: ledgerPath(), clock: () => now });
    ledger.load();
    ledger.append({
      id: 'retry-close',
      category: 'trade',
      at: new Date(now).toISOString(),
      symbol: 'BTC/USDT',
      quoteCurrency: 'USDT',
      pnl: 10,
      grossPnl: 10,
      quoteFees: 0,
      unconvertedFees: [{ currency: 'BNB', cost: 0.01 }],
    });

    let attempts = 0;
    const converter = {
      convert: async () => ++attempts > 1 ? {
        status: 'known' as const,
        conversion: {
          sourceCurrency: 'BNB',
          quoteCurrency: 'USDT',
          sourceAmount: 0.01,
          quoteAmount: 3,
          rate: 300,
          market: 'BNB/USDT',
          direction: 'direct' as const,
          tickerTimestamp: now,
          convertedAt: new Date(now).toISOString(),
        },
      } : { status: 'unknown' as const, reason: 'conversion_ticker_failed' },
    };
    const engine = new LiveTradingEngine(
      { enabled: true, testMode: true },
      {
        realizedPnlLedger: ledger,
        quoteConverter: converter as never,
        clock: () => now,
      },
    );
    (engine as unknown as { exchange: unknown }).exchange = { markets: {} };

    await (engine as unknown as { retryCurrentDayQuoteConversions: () => Promise<void> })
      .retryCurrentDayQuoteConversions();
    expect(attempts).toBe(1);
    expect(safetyEventLog.tail().some((event) =>
      event.type === 'conversion_unknown' && event.detail === 'conversion_ticker_failed',
    )).toBe(true);

    now += 5_001;
    await (engine as unknown as { retryCurrentDayQuoteConversions: () => Promise<void> })
      .retryCurrentDayQuoteConversions();
    expect(ledger.summary()).toMatchObject({ pnl: 7, unknown: false });
    engine.dispose();
  });
});
