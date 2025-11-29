
import { ExchangeAggregator } from './exchange-aggregator';

export class CacheWarmer {
  private aggregator: ExchangeAggregator;
  private topSymbols = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT',
    'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'ETC/USDT'
  ];

  constructor(aggregator: ExchangeAggregator) {
    this.aggregator = aggregator;
  }

  /**
   * Warm cache on startup
   */
  async warmCache(): Promise<void> {
    console.log('[CacheWarmer] Starting cache warming...');
    
    const startTime = Date.now();
    let warmed = 0;
    
    // Fetch prices for top symbols
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
