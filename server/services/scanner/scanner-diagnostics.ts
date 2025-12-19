/**
 * Scanner Diagnostics & Performance Metrics
 * 
 * Tracks computation time, payload sizes, cache efficiency, and memory usage.
 * Helps identify bottlenecks and validate optimization effectiveness.
 */

export interface IndicatorComputationMetrics {
  name: string;
  /** Time in milliseconds to compute this indicator */
  computationTimeMs: number;
  /** Whether this indicator was served from cache */
  fromCache: boolean;
  /** Approximate size of the indicator data in bytes */
  sizeBytes: number;
}

export interface FrameProcessingMetrics {
  symbol: string;
  timeframe: string;
  timestamp: number;
  /** Total time to compute all indicators for this frame in ms */
  totalComputationMs: number;
  /** Indicators that were computed vs cached */
  indicators: IndicatorComputationMetrics[];
  /** Number of frames processed */
  frameCount: number;
  /** Total payload size (all indicators) in bytes */
  totalPayloadBytes: number;
  /** Number of deferred (heavy) indicators */
  deferredCount: number;
  /** Memory usage estimate for this frame in bytes */
  memoryUsageBytes: number;
}

export interface ScannerHealthMetrics {
  timestamp: number;
  cacheHitRate: number; // 0-1
  avgComputationTimeMs: number;
  avgPayloadSizeBytes: number;
  totalSymbolsScanned: number;
  totalTimeframesScanned: number;
  memoryUsageMB: number;
  /** List of slowest computations */
  slowestIndicators: Array<{ name: string; avgTimeMs: number }>;
  /** Warning flags for performance issues */
  warnings: string[];
}

/**
 * Aggregates performance metrics across multiple frames and scanning operations.
 * Helps identify bottlenecks and optimization opportunities.
 */
export class ScannerDiagnostics {
  private metrics: FrameProcessingMetrics[] = [];
  private indicatorStats = new Map<string, { totalTime: number; count: number; totalSize: number }>();
  private memorySnapshots: number[] = [];

  /**
   * Record metrics for a processed frame.
   */
  recordFrameMetrics(metrics: FrameProcessingMetrics): void {
    this.metrics.push(metrics);

    // Aggregate indicator statistics
    for (const ind of metrics.indicators) {
      const existing = this.indicatorStats.get(ind.name) ?? { totalTime: 0, count: 0, totalSize: 0 };
      existing.totalTime += ind.computationTimeMs;
      existing.count += 1;
      existing.totalSize += ind.sizeBytes;
      this.indicatorStats.set(ind.name, existing);
    }

    // Record memory usage
    const memUsageMB = metrics.memoryUsageBytes / (1024 * 1024);
    this.memorySnapshots.push(memUsageMB);

    // Keep only recent snapshots (last 100)
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots.shift();
    }
  }

  /**
   * Get aggregated health metrics.
   */
  getHealthMetrics(): ScannerHealthMetrics {
    const recentMetrics = this.metrics.slice(-100); // Last 100 frames
    const warnings: string[] = [];

    if (recentMetrics.length === 0) {
      return {
        timestamp: Date.now(),
        cacheHitRate: 0,
        avgComputationTimeMs: 0,
        avgPayloadSizeBytes: 0,
        totalSymbolsScanned: 0,
        totalTimeframesScanned: 0,
        memoryUsageMB: 0,
        slowestIndicators: [],
        warnings: ['No metrics recorded yet']
      };
    }

    // Calculate averages
    const avgComputationTimeMs = recentMetrics.reduce((sum, m) => sum + m.totalComputationMs, 0) / recentMetrics.length;
    const avgPayloadSizeBytes = recentMetrics.reduce((sum, m) => sum + m.totalPayloadBytes, 0) / recentMetrics.length;
    const avgMemoryMB = this.memorySnapshots.length > 0
      ? this.memorySnapshots.reduce((a, b) => a + b, 0) / this.memorySnapshots.length
      : 0;

    // Calculate cache hit rate
    let totalComputed = 0;
    let totalCached = 0;
    for (const metrics of recentMetrics) {
      for (const ind of metrics.indicators) {
        if (ind.fromCache) totalCached++;
        else totalComputed++;
      }
    }
    const cacheHitRate = totalComputed + totalCached > 0
      ? totalCached / (totalComputed + totalCached)
      : 0;

    // Find slowest indicators
    const slowestIndicators = Array.from(this.indicatorStats.entries())
      .map(([name, stats]) => ({ name, avgTimeMs: stats.totalTime / Math.max(1, stats.count) }))
      .sort((a, b) => b.avgTimeMs - a.avgTimeMs)
      .slice(0, 5);

    // Generate warnings
    if (avgComputationTimeMs > 100) {
      warnings.push(`High computation time: ${avgComputationTimeMs.toFixed(0)}ms`);
    }
    if (avgPayloadSizeBytes > 500_000) {
      warnings.push(`Large payload: ${(avgPayloadSizeBytes / 1024).toFixed(0)}KB`);
    }
    if (avgMemoryMB > 100) {
      warnings.push(`High memory usage: ${avgMemoryMB.toFixed(0)}MB`);
    }
    if (cacheHitRate < 0.5) {
      warnings.push(`Low cache hit rate: ${(cacheHitRate * 100).toFixed(0)}%`);
    }

    const uniqueSymbols = new Set(recentMetrics.map(m => m.symbol)).size;
    const uniqueTimeframes = new Set(recentMetrics.map(m => m.timeframe)).size;

    return {
      timestamp: Date.now(),
      cacheHitRate,
      avgComputationTimeMs,
      avgPayloadSizeBytes,
      totalSymbolsScanned: uniqueSymbols,
      totalTimeframesScanned: uniqueTimeframes,
      memoryUsageMB: avgMemoryMB,
      slowestIndicators,
      warnings
    };
  }

  /**
   * Get detailed metrics for a specific indicator across all frames.
   */
  getIndicatorStats(indicatorName: string) {
    const stats = this.indicatorStats.get(indicatorName);
    if (!stats) return null;

    return {
      name: indicatorName,
      totalComputations: stats.count,
      totalTimeMs: stats.totalTime,
      avgTimeMs: stats.totalTime / stats.count,
      avgSizeBytes: stats.totalSize / stats.count,
      totalSizeBytes: stats.totalSize
    };
  }

  /**
   * Get all recorded frame metrics (for export/analysis).
   */
  getAllMetrics(): FrameProcessingMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get last N frame metrics.
   */
  getRecentMetrics(count: number): FrameProcessingMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear all diagnostics data (for memory management or test reset).
   */
  clear(): void {
    this.metrics = [];
    this.indicatorStats.clear();
    this.memorySnapshots = [];
  }

  /**
   * Export diagnostics as JSON for logging/analysis.
   */
  export() {
    return {
      timestamp: Date.now(),
      health: this.getHealthMetrics(),
      recentMetrics: this.getRecentMetrics(50),
      indicatorStats: Object.fromEntries(
        Array.from(this.indicatorStats.entries()).map(([name, stats]) => [
          name,
          {
            totalComputations: stats.count,
            totalTimeMs: stats.totalTime,
            avgTimeMs: stats.totalTime / stats.count,
            avgSizeBytes: stats.totalSize / stats.count
          }
        ])
      )
    };
  }

  /**
   * Get summary as a single-line string for logging.
   */
  getSummary(): string {
    const health = this.getHealthMetrics();
    return `[Health] CacheHit:${(health.cacheHitRate * 100).toFixed(0)}% AvgTime:${health.avgComputationTimeMs.toFixed(0)}ms Payload:${(health.avgPayloadSizeBytes / 1024).toFixed(0)}KB Memory:${health.memoryUsageMB.toFixed(0)}MB`;
  }
}

/**
 * Payload size inspector for compliance with UI/logging constraints.
 */
export class PayloadInspector {
  /**
   * Check if payload meets size constraints.
   */
  static validatePayloadSize(payloadBytes: number, maxBytes: number = 1_000_000): { valid: boolean; message: string } {
    if (payloadBytes <= maxBytes) {
      return { valid: true, message: `Payload OK: ${(payloadBytes / 1024).toFixed(0)}KB` };
    }
    return {
      valid: false,
      message: `Payload OVERSIZED: ${(payloadBytes / 1024).toFixed(0)}KB exceeds max ${(maxBytes / 1024).toFixed(0)}KB`
    };
  }

  /**
   * Estimate the size of an object/array (rough JSON-based estimate).
   */
  static estimateSize(obj: any): number {
    return JSON.stringify(obj).length;
  }

  /**
   * Summarize indicator payload composition.
   */
  static analyzeIndicatorPayload(indicators: Record<string, any>): {
    totalBytes: number;
    breakdown: Record<string, number>;
    largest: Array<{ name: string; bytes: number }>;
  } {
    const breakdown: Record<string, number> = {};
    for (const [name, data] of Object.entries(indicators)) {
      breakdown[name] = this.estimateSize(data);
    }

    const largest = Object.entries(breakdown)
      .map(([name, bytes]) => ({ name, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const totalBytes = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { totalBytes, breakdown, largest };
  }
}

export default ScannerDiagnostics;
