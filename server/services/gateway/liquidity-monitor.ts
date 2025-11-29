
import { ExchangeAggregator } from './exchange-aggregator';
import { CacheManager } from './cache-manager';

export interface LiquidityData {
  symbol: string;
  totalVolume24h: number;
  bidDepth: number;
  askDepth: number;
  spreadPercent: number;
  liquidityScore: number; // 0-100
  healthy: boolean;
  exchanges: Array<{
    name: string;
    volume: number;
    spread: number;
  }>;
  timestamp: Date;
}

export class LiquidityMonitor {
  private aggregator: ExchangeAggregator;
  private cache: CacheManager;

  constructor(aggregator: ExchangeAggregator, cache: CacheManager) {
    this.aggregator = aggregator;
    this.cache = cache;
  }

  /**
   * Check liquidity health across exchanges
   */
  async checkLiquidity(symbol: string, amount?: number): Promise<LiquidityData> {
    const cacheKey = `liquidity:${symbol}`;
    const cached = this.cache.get<LiquidityData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Get aggregated price data (includes multiple sources)
    const priceData = await this.aggregator.getAggregatedPrice(symbol);
    
    // Get OHLCV to calculate volume
    const ohlcv = await this.aggregator.getOHLCV(symbol, '1m', 24 * 60); // 24 hours of 1m candles
    
    // Calculate 24h volume
    const totalVolume24h = ohlcv.reduce((sum, candle) => sum + candle.volume, 0);
    
    // Estimate bid/ask depth (simplified - real impl would query order books)
    const bidDepth = totalVolume24h * 0.1; // 10% of 24h volume
    const askDepth = totalVolume24h * 0.1;
    
    // Calculate spread from deviation
    const spreadPercent = priceData.deviation;
    
    // Calculate liquidity score (0-100)
    let liquidityScore = 0;
    
    // Volume component (max 40 points)
    const volumeScore = Math.min(40, (totalVolume24h / 1000000) * 10); // $1M = 10 points
    liquidityScore += volumeScore;
    
    // Source diversity (max 30 points)
    const sourceScore = Math.min(30, priceData.sources.length * 6); // 5 sources = 30 points
    liquidityScore += sourceScore;
    
    // Tight spread bonus (max 20 points)
    const spreadScore = Math.max(0, 20 - (spreadPercent * 100)); // <0.2% = 20 points
    liquidityScore += spreadScore;
    
    // Depth component (max 10 points)
    const depthScore = Math.min(10, (bidDepth + askDepth) / totalVolume24h * 50);
    liquidityScore += depthScore;
    
    const healthy = liquidityScore >= 60 && spreadPercent < 0.02;
    
    const result: LiquidityData = {
      symbol,
      totalVolume24h,
      bidDepth,
      askDepth,
      spreadPercent,
      liquidityScore: Math.min(100, liquidityScore),
      healthy,
      exchanges: priceData.sources.map(name => ({
        name,
        volume: totalVolume24h / priceData.sources.length, // Distributed evenly (simplified)
        spread: spreadPercent
      })),
      timestamp: new Date()
    };
    
    // Cache for 30 seconds
    this.cache.set(cacheKey, result, 30000);
    
    return result;
  }

  /**
   * Get liquidity for multiple symbols
   */
  async batchCheckLiquidity(symbols: string[]): Promise<Map<string, LiquidityData>> {
    const results = new Map<string, LiquidityData>();
    
    const settled = await Promise.allSettled(
      symbols.map(symbol => this.checkLiquidity(symbol))
    );
    
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.set(symbols[index], result.value);
      }
    });
    
    return results;
  }
}
