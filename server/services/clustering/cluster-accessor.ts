/**
 * Market Data Cluster Accessor
 * 
 * System-wide interface for agents to access clustering metrics
 * Provides unified access to cluster data for any asset/timeframe
 * 
 * Used by:
 * - TrendRider, ReversalMaster, BreakoutHunter, SupportSniper
 * - Any agent needing cluster-enhanced decision making
 */

import type { ClusterMetrics } from './clustering-calculator';
import { calculateClusterMetrics } from './clustering-calculator';

/**
 * ClusterAccessor: Provides agents with cluster data
 * 
 * Can fetch from:
 * 1. Cached market data fetcher (live real-time data)
 * 2. Direct calculation from OHLCV (on-demand)
 * 3. Default metrics (fallback if no data available)
 */
export class ClusterAccessor {
  private marketDataFetcher: any; // MarketDataFetcher instance

  constructor(marketDataFetcher: any) {
    this.marketDataFetcher = marketDataFetcher;
  }

  /**
   * Get clustering metrics for any symbol (system-wide)
   * 
   * @param symbol Trading pair (e.g., 'BTC/USDT', 'ETH/USDT')
   * @returns ClusterMetrics with clustering information
   */
  getClusterMetrics(symbol: string): ClusterMetrics {
    // Try to get from cache first (most recent calculation)
    const cached = this.marketDataFetcher?.getClusteringMetrics(symbol);
    if (cached) {
      return cached;
    }

    // If not cached, try to calculate from OHLCV
    const candles = this.marketDataFetcher?.getCandles(symbol);
    if (candles && candles.length >= 10) {
      return calculateClusterMetrics(candles);
    }

    // Fallback: return default (no data available)
    return this.getDefaultMetrics();
  }

  /**
   * Get clustering metrics with fallback retry
   * Attempts multiple times if network is slow
   */
  async getClusterMetricsWithRetry(symbol: string, retries: number = 1): Promise<ClusterMetrics> {
    for (let i = 0; i <= retries; i++) {
      const metrics = this.getClusterMetrics(symbol);

      // If we got valid data (cluster_strength > 0), return it
      if (metrics.cluster_strength > 0 || i === retries) {
        return metrics;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }

    return this.getDefaultMetrics();
  }

  /**
   * Get cluster metrics for multiple symbols at once
   * @param symbols Array of trading pairs
   * @returns Map of symbol -> ClusterMetrics
   */
  getClusterMetricsBatch(symbols: string[]): Map<string, ClusterMetrics> {
    const result = new Map<string, ClusterMetrics>();

    for (const symbol of symbols) {
      result.set(symbol, this.getClusterMetrics(symbol));
    }

    return result;
  }

  /**
   * Check if symbol has clustering data available
   */
  hasClusterData(symbol: string): boolean {
    const metrics = this.getClusterMetrics(symbol);
    return metrics.cluster_strength > 0 || metrics.total_clusters > 0;
  }

  /**
   * Get summary of clustering health across all symbols
   */
  getClusteringHealth(): {
    total_symbols: number;
    with_clusters: number;
    avg_cluster_strength: number;
    trending_count: number;
  } {
    const symbols = this.marketDataFetcher?.getStatus()?.symbols || [];
    const metrics = this.getClusterMetricsBatch(symbols);

    let with_clusters = 0;
    let total_strength = 0;
    let trending_count = 0;

    for (const metric of metrics.values()) {
      if (metric.cluster_strength > 0) {
        with_clusters++;
        total_strength += metric.cluster_strength;
      }
      if (metric.trend_formation_signal) {
        trending_count++;
      }
    }

    return {
      total_symbols: symbols.length,
      with_clusters,
      avg_cluster_strength: with_clusters > 0 ? total_strength / with_clusters : 0,
      trending_count
    };
  }

  /**
   * Get default metrics (no data available)
   */
  private getDefaultMetrics(): ClusterMetrics {
    return {
      trend_formation_signal: false,
      cluster_strength: 0,
      directional_ratio: 0,
      follow_through: 0,
      total_clusters: 0,
      bullish_clusters: 0,
      bearish_clusters: 0
    };
  }
}

/**
 * Global singleton for accessing clustering metrics
 * Used by all agents and services
 */
let globalClusterAccessor: ClusterAccessor | null = null;

/**
 * Initialize global cluster accessor
 */
export function initializeClusterAccessor(marketDataFetcher: any): void {
  globalClusterAccessor = new ClusterAccessor(marketDataFetcher);
  console.log('[ClusterAccessor] Initialized globally');
}

/**
 * Get global cluster accessor instance
 */
export function getClusterAccessor(): ClusterAccessor {
  if (!globalClusterAccessor) {
    throw new Error(
      'ClusterAccessor not initialized. Call initializeClusterAccessor() first.'
    );
  }
  return globalClusterAccessor;
}

/**
 * Quick helper: Get cluster metrics for a symbol
 * Assumes global accessor is initialized
 */
export function getClusterMetrics(symbol: string): ClusterMetrics {
  return getClusterAccessor().getClusterMetrics(symbol);
}

/**
 * Quick helper: Check if symbol has trending clusters
 */
export function isTrendingSymbol(symbol: string): boolean {
  const metrics = getClusterMetrics(symbol);
  return metrics.trend_formation_signal && metrics.cluster_strength > 0.65;
}

/**
 * Quick helper: Get cluster strength for a symbol
 */
export function getClusterStrength(symbol: string): number {
  return getClusterMetrics(symbol).cluster_strength;
}
