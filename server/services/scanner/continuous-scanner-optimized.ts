/**
 * Optimized Continuous Multi-Timeframe Scanner
 * 
 * Integrates:
 * - Indicator caching per timeframe
 * - Config-driven selective computation
 * - Performance diagnostics
 * - Heavy indicator offloading to worker threads
 * - Payload size management
 */

import EventEmitter from 'events';
import OptimizedMomentumScanner from './momentum-scanner-optimized';
import { IndicatorCache } from './indicator-cache';
import { IndicatorConfigManager, type IndicatorProfile } from './indicator-config';
import { ScannerDiagnostics, PayloadInspector, type FrameProcessingMetrics } from './scanner-diagnostics';
import HeavyIndicatorWorkerPool from './heavy-indicator-worker-pool';
import type { MarketFrame } from './continuous-scanner';

export interface OptimizedContinuousScannerOptions {
  /** Polling interval in ms */
  pollIntervalMs?: number;
  /** Number of lookback candles to fetch */
  lookbackCandles?: number;
  /** Indicator profile: 'conservative', 'balanced', 'aggressive' */
  indicatorProfile?: IndicatorProfile;
  /** Cache TTL in ms */
  cacheTtlMs?: number;
  /** Max cache entries */
  maxCacheEntries?: number;
  /** Enable worker pool for heavy indicators */
  useWorkerPool?: boolean;
  /** Worker pool size */
  workerPoolSize?: number;
  /** Max payload size in bytes (warn if exceeded) */
  maxPayloadBytes?: number;
  /** Enable diagnostics reporting */
  enableDiagnostics?: boolean;
  /** Log interval for diagnostics in ms */
  diagnosticsLogIntervalMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface ProcessedResult {
  symbol: string;
  timeframe: string;
  score: number;
  reason?: string;
  indicators?: Record<string, any>;
  diagnostics?: {
    computedIndicators: string[];
    cachedIndicators: string[];
    deferredIndicators: string[];
    computationTimeMs: number;
    payloadSizeBytes: number;
  };
}

/**
 * Production-ready scanner with all optimizations integrated.
 */
export class OptimizedContinuousMultiTimeframeScanner extends EventEmitter {
  private running = false;
  private scanTimer?: NodeJS.Timeout;
  private diagnosticsTimer?: NodeJS.Timeout;

  private readonly indicatorCache: IndicatorCache;
  private readonly configManager: IndicatorConfigManager;
  private readonly scanner: OptimizedMomentumScanner;
  private readonly diagnostics: ScannerDiagnostics;
  private readonly workerPool: HeavyIndicatorWorkerPool | null;

  private readonly opts: Required<OptimizedContinuousScannerOptions>;

  constructor(
    private symbols: string[],
    private timeframes: string[],
    opts?: OptimizedContinuousScannerOptions
  ) {
    super();

    // Normalize options
    this.opts = {
      pollIntervalMs: opts?.pollIntervalMs ?? 30_000,
      lookbackCandles: opts?.lookbackCandles ?? 200,
      indicatorProfile: opts?.indicatorProfile ?? 'balanced',
      cacheTtlMs: opts?.cacheTtlMs ?? 60_000,
      maxCacheEntries: opts?.maxCacheEntries ?? 1000,
      useWorkerPool: opts?.useWorkerPool ?? true,
      workerPoolSize: opts?.workerPoolSize ?? 2,
      maxPayloadBytes: opts?.maxPayloadBytes ?? 1_000_000,
      enableDiagnostics: opts?.enableDiagnostics ?? true,
      diagnosticsLogIntervalMs: opts?.diagnosticsLogIntervalMs ?? 60_000,
      debug: opts?.debug ?? false
    };

    // Initialize components
    this.indicatorCache = new IndicatorCache({
      ttlMs: this.opts.cacheTtlMs,
      maxEntries: this.opts.maxCacheEntries,
      debug: this.opts.debug
    });

    this.configManager = new IndicatorConfigManager(this.opts.indicatorProfile);
    this.scanner = new OptimizedMomentumScanner(this.configManager, this.indicatorCache);
    this.diagnostics = new ScannerDiagnostics();

    this.workerPool = this.opts.useWorkerPool
      ? new HeavyIndicatorWorkerPool({
          poolSize: this.opts.workerPoolSize,
          debug: this.opts.debug
        })
      : null;

    if (this.opts.debug) {
      console.log(`[Scanner] Initialized: ${this.symbols.length} symbols, ${this.timeframes.length} timeframes`);
      console.log(`[Scanner] Profile: ${this.opts.indicatorProfile}, Cache TTL: ${this.opts.cacheTtlMs}ms`);
    }
  }

  /**
   * Start continuous scanning loop.
   */
  start(fetchFrames: (symbols: string[], timeframes: string[], lookback: number) => Promise<Record<string, Record<string, MarketFrame[]>>>) {
    if (this.running) return;
    this.running = true;

    // Start main scan loop
    const scanLoop = async () => {
      try {
        const data = await fetchFrames(this.symbols, this.timeframes, this.opts.lookbackCandles);

        // Emit raw snapshot
        this.emit('snapshot', { timestamp: Date.now(), data });

        // Process all symbol/timeframe combinations
        const processed: ProcessedResult[] = [];
        const payloads: Record<string, any> = {};

        for (const symbol of Object.keys(data)) {
          const tfMap = data[symbol] ?? {};
          for (const timeframe of Object.keys(tfMap)) {
            try {
              const frames = tfMap[timeframe] ?? [];

              // Compute score with selective indicators
              let result = frames.length > 0
                ? this.scanner.computeScore(symbol, timeframe, frames)
                : { score: 0, reason: 'NO_DATA', indicators: {}, diagnostics: undefined };

              // Validate payload size
              const payloadBytes = result.diagnostics?.payloadSizeBytes ?? 0;
              const payloadValid = PayloadInspector.validatePayloadSize(payloadBytes, this.opts.maxPayloadBytes);
              
              if (!payloadValid.valid) {
                this.emit('warning', {
                  type: 'PAYLOAD_OVERSIZED',
                  symbol,
                  timeframe,
                  message: payloadValid.message
                });
                if (this.opts.debug) console.warn(`[Scanner] ${payloadValid.message}`);
              }

              // Store processed result
              processed.push({
                symbol,
                timeframe,
                score: result.score,
                reason: result.reason,
                indicators: result.indicators,
                diagnostics: result.diagnostics
              });

              // Optionally offload heavy indicators to worker pool (async, non-blocking)
              if (this.workerPool && result.diagnostics?.deferredIndicators.length) {
                this.processDeferredIndicators(symbol, timeframe, frames, result.diagnostics.deferredIndicators)
                  .catch(err => {
                    if (this.opts.debug) console.error(`[Scanner] Worker error: ${String(err)}`);
                  });
              }

              // Record diagnostics
              if (this.opts.enableDiagnostics && result.diagnostics) {
                const metrics: FrameProcessingMetrics = {
                  symbol,
                  timeframe,
                  timestamp: Date.now(),
                  totalComputationMs: result.diagnostics.computationTimeMs,
                  indicators: result.diagnostics.computedIndicators.map(name => ({
                    name,
                    computationTimeMs: 0, // Simplified; could be tracked per-indicator
                    fromCache: result.diagnostics!.cachedIndicators.includes(name),
                    sizeBytes: 0
                  })),
                  frameCount: frames.length,
                  totalPayloadBytes: payloadBytes,
                  deferredCount: result.diagnostics.deferredIndicators.length,
                  memoryUsageBytes: this.indicatorCache.getMemoryUsageEstimate()
                };
                this.diagnostics.recordFrameMetrics(metrics);
              }

              payloads[`${symbol}/${timeframe}`] = result.indicators;
            } catch (innerErr) {
              if (this.opts.debug) console.error(`[Scanner] Error processing ${symbol}/${timeframe}:`, innerErr);
              this.emit('error', { symbol, timeframe, error: innerErr });
              processed.push({
                symbol,
                timeframe,
                score: 0,
                reason: `ERROR:${String(innerErr)}`
              });
            }
          }
        }

        // Emit processed results
        this.emit('processed', {
          timestamp: Date.now(),
          results: processed,
          payloads
        });
      } catch (err) {
        if (this.opts.debug) console.error(`[Scanner] Scan error:`, err);
        this.emit('error', { type: 'SCAN_FAILED', error: err });
      } finally {
        if (this.running) {
          this.scanTimer = setTimeout(scanLoop, this.opts.pollIntervalMs);
        }
      }
    };

    // Start diagnostics reporter
    if (this.opts.enableDiagnostics) {
      const reportDiagnostics = () => {
        const health = this.diagnostics.getHealthMetrics();
        const cacheStats = this.indicatorCache.getStats();
        const workerStats = this.workerPool?.getStats();

        const report = {
          timestamp: Date.now(),
          health,
          cacheStats,
          workerStats
        };

        this.emit('diagnostics', report);

        if (this.opts.debug) {
          console.log(`[Scanner] ${this.diagnostics.getSummary()}`);
          if (health.warnings.length > 0) {
            console.warn(`[Scanner] Warnings:`, health.warnings);
          }
        }
      };

      this.diagnosticsTimer = setInterval(reportDiagnostics, this.opts.diagnosticsLogIntervalMs);
    }

    // Kick off immediately
    void scanLoop();

    if (this.opts.debug) console.log(`[Scanner] Started scanning...`);
  }

  /**
   * Asynchronously process deferred heavy indicators.
   */
  private async processDeferredIndicators(
    symbol: string,
    timeframe: string,
    frames: MarketFrame[],
    indicatorNames: string[]
  ): Promise<void> {
    if (!this.workerPool || indicatorNames.length === 0) return;

    const closes = frames.map(f => f.price.close);
    const volumes = frames.map(f => f.volume ?? 0);
    const highs = frames.map(f => f.price.high);
    const lows = frames.map(f => f.price.low);

    const frameData = { closes, volumes, highs, lows };

    for (const indicatorName of indicatorNames) {
      try {
        const result = await this.workerPool.computeIndicator(symbol, timeframe, indicatorName, frameData, 5);
        if (result.success && result.data) {
          this.indicatorCache.set(symbol, timeframe, indicatorName, result.data);
          if (this.opts.debug) {
            console.log(`[Scanner] Deferred ${indicatorName} cached for ${symbol}/${timeframe}`);
          }
        }
      } catch (err) {
        if (this.opts.debug) console.error(`[Scanner] Failed to compute ${indicatorName}:`, err);
      }
    }
  }

  /**
   * Stop the scanner and cleanup resources.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    if (this.diagnosticsTimer) clearInterval(this.diagnosticsTimer);
    if (this.workerPool) await this.workerPool.shutdown();
    if (this.opts.debug) console.log(`[Scanner] Stopped`);
  }

  /**
   * Get current configuration.
   */
  getConfig() {
    return this.configManager.export();
  }

  /**
   * Update indicator configuration.
   */
  setIndicatorProfile(profile: IndicatorProfile): void {
    this.configManager.setGlobalProfile(profile);
    this.indicatorCache.clear(); // Clear cache on profile change
    if (this.opts.debug) console.log(`[Scanner] Profile updated to: ${profile}`);
  }

  /**
   * Enable/disable specific indicator per symbol/timeframe.
   */
  setIndicatorEnabled(symbol: string, timeframe: string, indicatorName: string, enabled: boolean): void {
    this.configManager.setOverride(symbol, timeframe, {
      [indicatorName]: { enabled } as any
    });
    this.indicatorCache.invalidateTimeframe(symbol, timeframe);
    if (this.opts.debug) console.log(`[Scanner] ${indicatorName} ${enabled ? 'enabled' : 'disabled'} for ${symbol}/${timeframe}`);
  }

  /**
   * Get diagnostics report.
   */
  getDiagnostics() {
    return this.diagnostics.export();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats() {
    return this.indicatorCache.getStats();
  }
}

export default OptimizedContinuousMultiTimeframeScanner;
