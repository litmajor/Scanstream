
import { ExchangeAggregator } from './exchange-aggregator';
import { ALL_TRACKED_ASSETS } from '@shared/tracked-assets';

export class CacheWarmer {
  private aggregator: ExchangeAggregator;
  private topSymbols: string[] = [];

  constructor(aggregator: ExchangeAggregator) {
    this.aggregator = aggregator;
    // Generate symbols from all 50 tracked assets: BTC/USDT, ETH/USDT, etc.
    this.topSymbols = ALL_TRACKED_ASSETS.map(asset => `${asset.symbol}/USDT`);
  }

  /**
   * Warm cache on startup for all 50 tracked assets
   */
  async warmCache(): Promise<void> {
    console.log(`[CacheWarmer] Starting cache warming for ${this.topSymbols.length} assets...`);
    
    const startTime = Date.now();
    let warmed = 0;
    
    // Fetch prices for all tracked assets
    for (const symbol of this.topSymbols) {
      try {
        await this.aggregator.getAggregatedPrice(symbol);
        warmed++;
      } catch (error: any) {
        console.warn(`[CacheWarmer] Failed to warm ${symbol}: ${error.message}`);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[CacheWarmer] Warmed ${warmed}/${this.topSymbols.length} symbols in ${duration}ms`);
  }

  /**
   * Continuous cache refresh
   */
  startContinuousWarming(intervalMs: number = 60000): void {
    console.log(`[CacheWarmer] Starting continuous warming (every ${intervalMs}ms)`);
    
    setInterval(async () => {
      await this.warmCache();
    }, intervalMs);
  }
}
