import { describe, expect, it, vi } from 'vitest';
import { OptimizedContinuousMultiTimeframeScanner } from '../continuous-scanner-optimized';

describe('OptimizedContinuousMultiTimeframeScanner', () => {
  it('starts its per-symbol scan tasks without an undeclared loop binding', async () => {
    const fetchFrames = vi.fn().mockResolvedValue({
      'BTC/USDT': { '1m': [] },
    });
    const scanner = new OptimizedContinuousMultiTimeframeScanner(
      ['BTC/USDT'],
      ['1m'],
      {
        useWorkerPool: false,
        enableDiagnostics: false,
        pollIntervalMs: 60_000,
      },
    );

    expect(() => scanner.start(fetchFrames)).not.toThrow();
    await Promise.resolve();
    expect(fetchFrames).toHaveBeenCalledWith(['BTC/USDT'], ['1m'], 200);
    await scanner.stop();
  });
});
