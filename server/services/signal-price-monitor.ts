
import { signalPerformanceTracker } from './signal-performance-tracker';
import { aggregator } from '../routes/gateway';

class SignalPriceMonitor {
  private updateInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMs: number = 5000): void {
    if (this.isRunning) return;

    console.log('[SignalMonitor] Starting price monitoring...');
    this.isRunning = true;

    this.updateInterval = setInterval(async () => {
      await this.updateActivePrices();
    }, intervalMs);
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('[SignalMonitor] Stopped price monitoring');
  }

  private async updateActivePrices(): Promise<void> {
    try {
      const recent = signalPerformanceTracker.getRecentPerformance(50);
      const active = recent.filter(p => p.status === 'active');

      for (const perf of active) {
        try {
          const priceData = await aggregator.getAggregatedPrice(perf.symbol);
          
          if (priceData.price > 0) {
            await signalPerformanceTracker.updateSignalPrice(
              perf.signalId,
              priceData.price
            );
          }
        } catch (error) {
          console.error(`[SignalMonitor] Error updating ${perf.symbol}:`, error);
        }
      }
    } catch (error) {
      console.error('[SignalMonitor] Update error:', error);
    }
  }
}

export const signalPriceMonitor = new SignalPriceMonitor();
