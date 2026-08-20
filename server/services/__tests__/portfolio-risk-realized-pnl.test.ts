import { describe, expect, it, vi } from 'vitest';
import { PortfolioRiskManager } from '../portfolio-risk-manager';

describe('portfolio risk realized PnL input', () => {
  it('uses the worse of balance and realized PnL results', () => {
    const manager = new PortfolioRiskManager(10_000);
    const metrics = manager.getPortfolioMetrics(10_050, { dailyPnl: -500 });
    expect(metrics.realizedDailyPnl).toBe(-500);
    expect(metrics.dailyPnl).toBe(-500);
    expect(metrics.dailyPnlPercent).toBeCloseTo(-5, 12);
  });

  it('marks unknown realized PnL as unavailable rather than zero', () => {
    const manager = new PortfolioRiskManager(10_000);
    const metrics = manager.getPortfolioMetrics(10_000, { dailyPnl: null, unknown: true });
    expect(metrics.realizedDailyPnl).toBeNull();
    expect(metrics.dailyPnlUnknown).toBe(true);
    expect(metrics.canOpenNewPosition).toBe(false);
  });

  it('resets the balance window at a UTC day boundary', () => {
    vi.setSystemTime(new Date('2024-01-31T23:59:00.000Z'));
    const manager = new PortfolioRiskManager(10_000);
    vi.setSystemTime(new Date('2024-02-01T00:01:00.000Z'));

    const metrics = manager.getPortfolioMetrics(9_000, { dailyPnl: 0 });
    expect(metrics.dailyPnl).toBe(0);
    vi.useRealTimers();
  });
});
