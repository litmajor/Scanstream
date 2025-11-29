
import { CacheManager } from './cache-manager';

export interface GasPrice {
  chain: string;
  standard: number; // gwei
  fast: number;
  instant: number;
  baseFee?: number;
  priorityFee?: number;
  estimatedTime: {
    standard: number; // seconds
    fast: number;
    instant: number;
  };
  timestamp: Date;
}

export class GasProvider {
  private cache: CacheManager;
  
  // Default gas prices (in gwei) - fallback values
  private readonly defaults = {
    ethereum: { standard: 20, fast: 30, instant: 50 },
    polygon: { standard: 30, fast: 50, instant: 100 },
    bsc: { standard: 3, fast: 5, instant: 10 },
    arbitrum: { standard: 0.1, fast: 0.2, instant: 0.5 },
    optimism: { standard: 0.001, fast: 0.002, instant: 0.005 }
  };

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  /**
   * Get current gas prices for a chain
   */
  async getGasPrice(chain: string = 'ethereum'): Promise<GasPrice> {
    const cacheKey = `gas:${chain}`;
    const cached = this.cache.get<GasPrice>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Use default values (in production, fetch from actual gas oracles)
    const chainDefaults = this.defaults[chain as keyof typeof this.defaults] || this.defaults.ethereum;
    
    const result: GasPrice = {
      chain,
      standard: chainDefaults.standard,
      fast: chainDefaults.fast,
      instant: chainDefaults.instant,
      estimatedTime: {
        standard: 60, // 1 minute
        fast: 30,     // 30 seconds
        instant: 15   // 15 seconds
      },
      timestamp: new Date()
    };
    
    // Cache for 15 seconds (gas prices change frequently)
    this.cache.set(cacheKey, result, 15000);
    
    return result;
  }

  /**
   * Estimate transaction cost in USD
   */
  async estimateCost(
    chain: string,
    gasLimit: number,
    speed: 'standard' | 'fast' | 'instant' = 'standard'
  ): Promise<number> {
    const gasPrice = await this.getGasPrice(chain);
    const gasPriceGwei = gasPrice[speed];
    
    // Convert to ETH (1 gwei = 0.000000001 ETH)
    const costEth = (gasPriceGwei * gasLimit) / 1e9;
    
    // Assume ETH price (in production, fetch real-time)
    const ethPriceUsd = 2500;
    
    return costEth * ethPriceUsd;
  }
}
