/**
 * Clustering Metrics Calculator
 * 
 * Calculates all clustering metrics from OHLCV candle data
 * System-wide clustering analysis for any asset/timeframe
 * 
 * Metrics Calculated:
 * - trend_formation_signal: Boolean (is a trend forming?)
 * - cluster_strength: 0-1 (directional_ratio × follow_through)
 * - directional_ratio: 0-1 (% of candles in dominant direction)
 * - follow_through: 0-1 (candle continuation %)
 * - total_clusters: Count of directional candle groups
 * - bullish_clusters: Count of upward clusters
 * - bearish_clusters: Count of downward clusters
 */

export interface ClusterMetrics {
  trend_formation_signal: boolean;
  cluster_strength: number; // 0-1
  directional_ratio: number; // 0-1
  follow_through: number; // 0-1
  total_clusters: number;
  bullish_clusters: number;
  bearish_clusters: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * ClusteringCalculator: Computes clustering metrics from raw price data
 * 
 * Algorithm:
 * 1. Identify candle direction (bullish/bearish/neutral)
 * 2. Group consecutive candles in same direction into clusters
 * 3. Count clusters and measure directional strength
 * 4. Calculate follow-through (momentum continuation)
 * 5. Combine into final cluster strength metric
 */
export class ClusteringCalculator {
  /**
   * Calculate all clustering metrics from OHLCV candle history
   * 
   * @param candles Array of OHLCV data points (minimum 10 required)
   * @returns ClusterMetrics with all clustering indicators
   */
  static calculateMetrics(candles: OHLCV[]): ClusterMetrics {
    if (!candles || candles.length < 10) {
      return this.getDefaultMetrics(); // Insufficient data
    }

    // Analyze candle directions
    const directions = this.analyzeCandles(candles);

    // Count clusters (groups of same direction)
    const clusterInfo = this.countClusters(directions);

    // Calculate directional ratio (% in dominant direction)
    const directional_ratio = this.calculateDirectionalRatio(directions);

    // Calculate follow-through (momentum continuation)
    const follow_through = this.calculateFollowThrough(candles);

    // Combined cluster strength
    const cluster_strength = directional_ratio * follow_through;

    // Detect trend formation
    const trend_formation_signal = this.isTrendForming(clusterInfo, directional_ratio, follow_through);

    return {
      trend_formation_signal,
      cluster_strength: Math.min(Math.max(cluster_strength, 0), 1), // Clamp 0-1
      directional_ratio: Math.min(Math.max(directional_ratio, 0), 1),
      follow_through: Math.min(Math.max(follow_through, 0), 1),
      total_clusters: clusterInfo.total,
      bullish_clusters: clusterInfo.bullish,
      bearish_clusters: clusterInfo.bearish
    };
  }

  /**
   * Analyze individual candle directions (up/down/neutral)
   */
  private static analyzeCandles(candles: OHLCV[]): ('UP' | 'DOWN' | 'NEUTRAL')[] {
    return candles.map((candle, idx) => {
      // Compare close vs open
      if (candle.close > candle.open) {
        return 'UP';
      } else if (candle.close < candle.open) {
        return 'DOWN';
      } else {
        return 'NEUTRAL'; // Doji/no body
      }
    });
  }

  /**
   * Count clusters (consecutive candles in same direction)
   */
  private static countClusters(directions: ('UP' | 'DOWN' | 'NEUTRAL')[]): {
    total: number;
    bullish: number;
    bearish: number;
  } {
    let total = 0;
    let bullish = 0;
    let bearish = 0;
    let inCluster = false;
    let currentDirection: 'UP' | 'DOWN' | null = null;

    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];

      // Skip neutral candles
      if (dir === 'NEUTRAL') {
        if (inCluster) {
          // Neutral breaks a cluster
          inCluster = false;
        }
        continue;
      }

      // Same direction as current cluster
      if (inCluster && dir === currentDirection) {
        // Continue cluster
        continue;
      }

      // Direction changed or starting new cluster
      if (!inCluster) {
        // Start new cluster
        inCluster = true;
        currentDirection = dir;
        total++;

        if (dir === 'UP') {
          bullish++;
        } else {
          bearish++;
        }
      } else {
        // Direction changed - end old, start new
        total++;
        currentDirection = dir;

        if (dir === 'UP') {
          bullish++;
        } else {
          bearish++;
        }
      }
    }

    return { total, bullish, bearish };
  }

  /**
   * Calculate directional ratio (% of candles in dominant direction)
   */
  private static calculateDirectionalRatio(directions: ('UP' | 'DOWN' | 'NEUTRAL')[]): number {
    if (directions.length === 0) return 0;

    const bullish = directions.filter(d => d === 'UP').length;
    const bearish = directions.filter(d => d === 'DOWN').length;
    const total = bullish + bearish; // Exclude neutrals

    if (total === 0) return 0;

    // Ratio = max(bullish, bearish) / total
    const dominant = Math.max(bullish, bearish);
    return dominant / total;
  }

  /**
   * Calculate follow-through (momentum continuation across candles)
   * 
   * Follow-through = % of candles that continue previous candle's direction
   */
  private static calculateFollowThrough(candles: OHLCV[]): number {
    if (candles.length < 2) return 0;

    let followThroughCount = 0;

    for (let i = 1; i < candles.length; i++) {
      const prevCandle = candles[i - 1];
      const currCandle = candles[i];

      // Get directions
      const prevDir = prevCandle.close > prevCandle.open ? 'UP' : prevCandle.close < prevCandle.open ? 'DOWN' : 'NEUTRAL';
      const currDir = currCandle.close > currCandle.open ? 'UP' : currCandle.close < currCandle.open ? 'DOWN' : 'NEUTRAL';

      // Count if current continues previous direction
      if (prevDir !== 'NEUTRAL' && currDir === prevDir) {
        followThroughCount++;
      }
    }

    return followThroughCount / (candles.length - 1);
  }

  /**
   * Detect if a trend is forming
   * 
   * Conditions:
   * - At least 3 clusters (organized movement) - RELAXED from 4
   * - Directional ratio > 0.55 (clear direction) - RELAXED from 0.65
   * - Follow-through > 0.40 (momentum sustaining) - RELAXED from 0.50
   * 
   * Why relax: 180-day 1h data is mostly consolidation. Original thresholds 
   * filtered 92% of signals. Relaxed thresholds allow clustering to boost
   * high-quality setups without eliminating almost all trading opportunities.
   */
  private static isTrendForming(
    clusterInfo: { total: number; bullish: number; bearish: number },
    directional_ratio: number,
    follow_through: number
  ): boolean {
    const minClusters = 3;
    const minDirectionalRatio = 0.55;
    const minFollowThrough = 0.40;

    return (
      clusterInfo.total >= minClusters &&
      directional_ratio >= minDirectionalRatio &&
      follow_through >= minFollowThrough
    );
  }

  /**
   * Get default metrics for insufficient data
   */
  private static getDefaultMetrics(): ClusterMetrics {
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

  /**
   * Batch calculate metrics for multiple candle sets
   */
  static calculateMetricsBatch(
    candleSets: OHLCV[][]
  ): ClusterMetrics[] {
    return candleSets.map(candles => this.calculateMetrics(candles));
  }

  /**
   * Quick helper: Convert CCXT number[][] format to OHLCV objects
   */
  static convertFromCCXTFormat(ccxtCandles: number[][]): OHLCV[] {
    return ccxtCandles.map(candle => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  }

  /**
   * Quick helper: Convert to CCXT number[][] format
   */
  static convertToCCXTFormat(ohlcv: OHLCV[]): number[][] {
    return ohlcv.map(candle => [
      candle.timestamp,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume
    ]);
  }
}

/**
 * Factory function
 */
export function createClusteringCalculator(): typeof ClusteringCalculator {
  return ClusteringCalculator;
}

/**
 * Quick helper: Calculate metrics without instantiation
 */
export function calculateClusterMetrics(ccxtCandles: number[][]): ClusterMetrics {
  if (!ccxtCandles || ccxtCandles.length < 10) {
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

  const ohlcvCandles = ClusteringCalculator.convertFromCCXTFormat(ccxtCandles);
  return ClusteringCalculator.calculateMetrics(ohlcvCandles);
}
