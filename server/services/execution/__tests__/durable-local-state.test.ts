import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { DurableLocalStateStore } from '../durable-local-state';

const paths: string[] = [];

function statePath(): string {
  const filePath = path.join(os.tmpdir(), `durable-local-state-${Date.now()}-${Math.random()}.json`);
  paths.push(filePath);
  return filePath;
}

afterEach(() => {
  for (const filePath of paths.splice(0)) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch {
      // Best-effort cleanup for test-only state.
    }
  }
});

describe('durable local execution state', () => {
  it('reports an absent file without treating it as unreadable', () => {
    const store = new DurableLocalStateStore({ filePath: statePath(), clock: () => 1_700_000_000_000 });
    expect(store.load()).toEqual({ status: 'absent' });
  });

  it('round-trips state through an atomic durable write', () => {
    const filePath = statePath();
    const store = new DurableLocalStateStore({ filePath, clock: () => 1_700_000_000_000 });
    const orders = [{ id: 'o1', clientOrderId: 'ss-1', status: 'open' }];
    const positions = [{ id: 'BTC/USDT', symbol: 'BTC/USDT', quantity: 1 }];

    store.persist(orders, positions);

    expect(store.load()).toEqual({
      status: 'ok',
      state: {
        schemaVersion: 1,
        writtenAt: '2023-11-14T22:13:20.000Z',
        orders,
        positions,
      },
    });
    expect(fs.readdirSync(path.dirname(filePath)).filter((name) => name.includes('.tmp'))).toEqual([]);
  });

  it('reports truncated and unknown-version files as unreadable', () => {
    const filePath = statePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{"schemaVersion":1,"orders":');
    expect(new DurableLocalStateStore({ filePath }).load().status).toBe('unreadable');

    fs.writeFileSync(filePath, JSON.stringify({
      schemaVersion: 999,
      writtenAt: new Date().toISOString(),
      orders: [],
      positions: [],
    }));
    expect(new DurableLocalStateStore({ filePath }).load().status).toBe('unreadable');
  });

  it('never replaces the previous file when a write fails before rename', () => {
    const filePath = statePath();
    const store = new DurableLocalStateStore({ filePath });
    store.persist([{ id: 'old' }], []);
    const originalRename = fs.renameSync;
    fs.renameSync = (() => {
      throw new Error('rename failed');
    }) as typeof fs.renameSync;
    try {
      expect(() => store.persist([{ id: 'new' }], [])).toThrow('rename failed');
    } finally {
      fs.renameSync = originalRename;
    }
    expect((store.load() as any).state.orders).toEqual([{ id: 'old' }]);
  });
});
