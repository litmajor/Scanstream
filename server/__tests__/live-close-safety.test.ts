import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LiveTradingEngine } from '../live-trading-engine';
import { RealizedPnlLedger } from '../services/execution/realized-pnl-ledger';

function ledgerPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scanstream-close-')), 'ledger.json');
}

function seedPosition(engine: LiveTradingEngine, quantity = 1): void {
  (engine as unknown as { positions: Map<string, any> }).positions.set('BTC/USDT', {
    id: 'BTC/USDT',
    symbol: 'BTC/USDT',
    side: 'long',
    entryPrice: 100,
    currentPrice: 100,
    quantity,
    leverage: 1,
    pnl: 0,
    pnlPercent: 0,
    openTime: Date.now(),
    marginUsed: 100,
    orders: [],
  });
}

describe('fill-aware close safety', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retains the remaining exposure after a partial close and records realized PnL', async () => {
    const ledger = new RealizedPnlLedger({ filePath: ledgerPath(), clock: Date.now });
    ledger.load();
    const engine = new LiveTradingEngine({ enabled: true, testMode: true }, { realizedPnlLedger: ledger });
    seedPosition(engine);
    (engine as unknown as { exchange: unknown }).exchange = {
      createOrder: vi.fn(async () => ({
        id: 'close-1',
        status: 'closed',
        trades: [{
          id: 'fill-close-1',
          amount: 0.4,
          price: 110,
          cost: 44,
          fee: { currency: 'USDT', cost: 1 },
        }],
      })),
    };

    expect(await engine.closePosition('BTC/USDT')).toBe(false);
    const position = (engine as unknown as { positions: Map<string, any> }).positions.get('BTC/USDT');
    expect(position.quantity).toBeCloseTo(0.6, 12);
    expect((engine as unknown as { orders: Map<string, any> }).orders.size).toBe(1);
    expect(ledger.summary().pnl).toBeCloseTo(3, 12);
  });

  it('keeps exposure when an ambiguous close cannot be reconciled', async () => {
    const engine = new LiveTradingEngine({ enabled: true, testMode: true });
    seedPosition(engine);
    const blocked = vi.fn();
    engine.on('executionBlocked', blocked);
    (engine as unknown as { exchange: unknown }).exchange = {
      createOrder: vi.fn(async () => { throw new Error('request timeout'); }),
    };

    expect(await engine.closePosition('BTC/USDT')).toBe(false);
    expect((engine as unknown as { positions: Map<string, any> }).positions.get('BTC/USDT').quantity).toBe(1);
    expect(blocked).toHaveBeenCalledWith(expect.objectContaining({ reason: 'close_order_state_unknown' }));
  });
});
