/**
 * Smart Symbol Mapper
 * Learns and caches which symbol formats work for each exchange
 * Prevents repeated failed attempts with the same symbol/exchange combos
 */

interface SymbolMapping {
  [symbol: string]: {
    [exchange: string]: string | null; // null means "failed, don't retry"
  };
}

export class SymbolMapper {
  private static instance: SymbolMapper;
  private mappings: SymbolMapping = {};
  private failedExchanges: Map<string, Set<string>> = new Map(); // symbol -> set of failed exchanges

  private constructor() {}

  static getInstance(): SymbolMapper {
    if (!SymbolMapper.instance) {
      SymbolMapper.instance = new SymbolMapper();
    }
    return SymbolMapper.instance;
  }

  /**
   * Get cached mapping for symbol on exchange
   * Returns: mapped symbol or undefined if not cached or previously failed
   */
  getCachedMapping(symbol: string, exchange: string): string | undefined {
    const cached = this.mappings[symbol]?.[exchange];
    if (cached === null) {
      // Previously failed on this exchange, don't retry
      return undefined;
    }
    return cached;
  }

  /**
   * Check if this symbol/exchange combo has already failed
   */
  hasFailedBefore(symbol: string, exchange: string): boolean {
    const failed = this.failedExchanges.get(`${symbol}:${exchange}`);
    return !!failed;
  }

  /**
   * Cache a successful mapping
   */
  cacheSuccessfulMapping(symbol: string, exchange: string, mappedSymbol: string): void {
    if (!this.mappings[symbol]) {
      this.mappings[symbol] = {};
    }
    this.mappings[symbol][exchange] = mappedSymbol;
    this.failedExchanges.delete(`${symbol}:${exchange}`);
    console.log(`[SymbolMapper] Cached mapping: ${symbol} -> ${mappedSymbol} (${exchange})`);
  }

  /**
   * Mark a symbol/exchange as failed - don't retry this combo
   */
  markAsFailed(symbol: string, exchange: string): void {
    if (!this.mappings[symbol]) {
      this.mappings[symbol] = {};
    }
    this.mappings[symbol][exchange] = null; // null = don't retry
    this.failedExchanges.set(`${symbol}:${exchange}`, new Set([exchange]));
    console.log(`[SymbolMapper] Marked as failed: ${symbol} (${exchange}) - will not retry`);
  }

  /**
   * Get list of exchanges this symbol is known to NOT work on
   */
  getFailedExchanges(symbol: string): string[] {
    const mapping = this.mappings[symbol];
    if (!mapping) return [];
    return Object.entries(mapping)
      .filter(([_, mapped]) => mapped === null)
      .map(([exchange]) => exchange);
  }

  /**
   * Get stats for debugging
   */
  getStats(): {
    totalSymbolsMapped: number;
    totalMappings: number;
    totalFailed: number;
  } {
    let totalMappings = 0;
    let totalFailed = 0;

    Object.values(this.mappings).forEach((exchanges) => {
      Object.values(exchanges).forEach((mapped) => {
        totalMappings++;
        if (mapped === null) totalFailed++;
      });
    });

    return {
      totalSymbolsMapped: Object.keys(this.mappings).length,
      totalMappings,
      totalFailed,
    };
  }

  /**
   * Reset all cached mappings (useful for testing)
   */
  reset(): void {
    this.mappings = {};
    this.failedExchanges.clear();
  }
}

export default SymbolMapper.getInstance();
