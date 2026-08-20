import { ExchangeAggregator } from './exchange-aggregator';
import { CacheManager } from './cache-manager';
import { RateLimiter } from './rate-limiter';
import type { PriceData, OHLCVData } from '../../types/gateway';
import { recordIntegrityBypassBlocked } from '../observability/safety-metrics';
import { priceCache } from '../../../src/core/PriceCache';

/**
 * CCXT Scanner - Orchestrated by Gateway
 * Scans multiple symbols across exchanges with intelligent routing
 */
export class CCXTScanner {
  private aggregator: ExchangeAggregator;
  private cache: CacheManager;
  private rateLimiter: RateLimiter;
  private activeScanSymbols: Set<string>;
  private scanResults: Map<string, ScanResult>;

  constructor(
    aggregator: ExchangeAggregator,
    cache: CacheManager,
    rateLimiter: RateLimiter
  ) {
    this.aggregator = aggregator;
    this.cache = cache;
    this.rateLimiter = rateLimiter;
    this.activeScanSymbols = new Set();
    this.scanResults = new Map();
  }

  /**
   * Scan multiple symbols with Gateway intelligence
   */
  async scanSymbols(
    symbols: string[],
    timeframe: string = '1m',
    options: ScanOptions = {}
  ): Promise<ScanResult[]> {
    console.log(`[CCXT Scanner] Starting scan for ${symbols.length} symbols`);

    const {
      limit = 100,
      parallel = true,
      useCache = true,
      minConfidence = 70,
      progressCb,
      prioritySymbols
    } = options;

    const results: ScanResult[] = [];

    // Allow callers to prioritize symbols (e.g., major pairs first)
    const orderedSymbols = (() => {
      if (!prioritySymbols || prioritySymbols.length === 0) return symbols;
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of prioritySymbols) {
        if (symbols.includes(s) && !seen.has(s)) {
          out.push(s);
          seen.add(s);
        }
      }
      for (const s of symbols) {
        if (!seen.has(s)) {
          out.push(s);
          seen.add(s);
        }
      }
      return out;
    })();

    let completed = 0;
    const total = orderedSymbols.length;
    if (progressCb) progressCb(0, total);

    if (parallel) {
      // Parallel scanning with Gateway rate limiting; report progress as each finishes
      const scanPromises = orderedSymbols.map(symbol =>
        this.scanSingleSymbol(symbol, timeframe, limit, useCache, minConfidence)
          .then(res => {
            completed += 1;
            if (progressCb) progressCb(completed, total, symbol);
            return { symbol, res };
          })
          .catch(err => {
            completed += 1;
            if (progressCb) progressCb(completed, total, symbol, err);
            return { symbol, res: null };
          })
      );

      const settled = await Promise.all(scanPromises);

      for (const item of settled) {
        if (item && (item as any).res) results.push((item as any).res);
      }
    } else {
      // Sequential scanning
      for (const symbol of orderedSymbols) {
        try {
          const result = await this.scanSingleSymbol(
            symbol,
            timeframe,
            limit,
            useCache,
            minConfidence
          );

          completed += 1;
          if (progressCb) progressCb(completed, total, symbol);

          if (result) {
            results.push(result);
          }
        } catch (error: any) {
          completed += 1;
          if (progressCb) progressCb(completed, total, symbol, error);
          console.warn(`[CCXT Scanner] Error scanning ${symbol}:`, error.message);
        }
      }
    }

    console.log(`[CCXT Scanner] Scan complete: ${results.length}/${symbols.length} successful`);
    return results;
  }

  /**
   * Scan single symbol through Gateway
   */
  private async scanSingleSymbol(
    symbol: string,
    timeframe: string,
    limit: number,
    useCache: boolean,
    minConfidence: number
  ): Promise<ScanResult | null> {
    const cacheKey = `scan:${symbol}:${timeframe}`;

    // Check cache first
    if (useCache) {
      const cached = this.cache.get<ScanResult>(cacheKey);
      if (cached) {
        console.log(`[CCXT Scanner] Cache hit for ${symbol}`);
        return cached;
      }
    }

    this.activeScanSymbols.add(symbol);

    try {
      // Step 1: Prefer PriceCache (authoritative fallback)
      let priceData: any = null;
      if (useCache) {
        const cachedTicker = priceCache.get(symbol);
        if (cachedTicker && (Date.now() - (cachedTicker.timestamp || 0) < 60_000)) {
          priceData = {
            symbol,
            price: cachedTicker.price,
            confidence: cachedTicker.confidence ?? 100,
            sources: cachedTicker.exchange ? [cachedTicker.exchange] : [],
            timestamp: new Date(cachedTicker.timestamp || Date.now())
          } as PriceData;
        } else {
          // Attempt to refresh cache once (best-effort)
          try {
            await priceCache.refresh(symbol);
            const refreshed = priceCache.get(symbol);
            if (refreshed) {
              priceData = {
                symbol,
                price: refreshed.price,
                confidence: refreshed.confidence ?? 100,
                sources: refreshed.exchange ? [refreshed.exchange] : [],
                timestamp: new Date(refreshed.timestamp || Date.now())
              } as PriceData;
            }
          } catch (e) {
            // ignore and fallback to aggregator
          }
        }
      }

      if (!priceData) {
        // Fallback to aggregator when cache missing or stale
        priceData = await this.aggregator.getAggregatedPrice(symbol);
        try {
          // Update lightweight cache for others
          priceCache.set(symbol, { symbol, price: priceData.price, timestamp: Date.now(), exchange: priceData.sources?.[0], confidence: priceData.confidence });
        } catch (e) {
          // noop
        }
      }

      // Filter by confidence
      if (priceData.confidence < minConfidence) {
        console.warn(`[CCXT Scanner] Low confidence for ${symbol}: ${priceData.confidence}%`);
        return null;
      }

      // Step 2: Prefer cached candles when available
      let ohlcv: any[] | null = null;
      if (useCache) {
        const cachedCandles = priceCache.getCandles(symbol, timeframe);
        if (cachedCandles && cachedCandles.length >= Math.min(20, limit)) {
          ohlcv = cachedCandles.map(c => [c[0], c[1], c[2], c[3], c[4], c[5]]);
        }
      }

      if (!ohlcv) {
        ohlcv = await this.aggregator.getOHLCV(symbol, timeframe, limit);
      }

      if (!ohlcv || ohlcv.length < 20) {
        console.warn(`[CCXT Scanner] Insufficient OHLCV data for ${symbol}`);
        return null;
      }

      // Step 3: Get full market frames for calculations
      const frames = await this.aggregator.getMarketFrames(symbol, timeframe, limit);

      // Step 4: Store market frames in shared storage for ML/RL agents
      // 
      // CRITICAL ORDERING:
      // 1. Integrity gate validates all candles
      // 2. Integrity gate stores validated candles to storage
      // 3. Integrity gate emits 'world.tick' events for each valid candle
      // 4. Agents subscribe to 'world.tick', NOT to storage polling
      try {
        const { getIntegrityGate } = await import('../market-data/integrity-gate');
        
        const gate = getIntegrityGate();

        // Convert to candle format
        // Preserve enriched frame fields (price snapshot, indicators, orderFlow, microstructure)
        // so they survive integrity checks and can be persisted by the storage layer.
        const candles = frames.map((f: {
          timestamp: Date | number;
          price: { open: number; high: number; low: number; close: number };
          volume: number;
          indicators?: object;
          orderFlow?: object;
          marketMicrostructure?: object;
          raw?: object;
        }) => ({
          ts: (f.timestamp instanceof Date ? f.timestamp.getTime() : Number(f.timestamp)) || Date.now(),
          open: (f.price as any)?.open ?? 0,
          high: (f.price as any)?.high ?? 0,
          low: (f.price as any)?.low ?? 0,
          close: (f.price as any)?.close ?? 0,
          volume: f.volume ?? 0,
          isFinal: true,
          // These frames originate from REST/CCXT scans (backfill/historical)
          source: 'historical',
          origin: 'ccxt',
          venue: 'scanner',
          // Enrichment payloads (optional)
          price: f.price ?? undefined,
          indicators: f.indicators ?? undefined,
          orderFlow: f.orderFlow ?? undefined,
          marketMicrostructure: f.marketMicrostructure ?? undefined,
          raw: f.raw ?? undefined,
        }));

        // Get timeframe in seconds
        const timeframeSeconds = this.parseTimeframeToSeconds(timeframe);

        // Validate through integrity layer
          const result = await gate.storeValidatedCandles(
            symbol,
            timeframeSeconds,
            candles
          );

        console.log(
          `[CCXT Scanner] Integrity check for ${symbol}/${timeframe}: ` +
            `${result.stored.length} valid, ${result.rejected.length} rejected, ${result.gaps.length} gaps`
        );

        // ✅ Integrity gate already stored validated candles
        // ✅ Integrity gate already emitted 'world.tick' events
        // ✅ No need to call storage.createMarketFrame() again!

        // Log rejected candles as warnings
        if (result.rejected.length > 0) {
          console.warn(`[CCXT Scanner] Rejected ${result.rejected.length} invalid candles for ${symbol}`);
        }

        // Return the world ticks for monitoring
        console.log(`[CCXT Scanner] Emitted ${result.ticks.length} world ticks for ${symbol}`);

      } catch (integrityError) {
        // No fallback to direct storage: bypassing the integrity gate would let
        // unvalidated data become canonical, which is worse than losing a scan.
        console.error(
          `[CCXT Scanner] Integrity gate failed for ${symbol}/${timeframe} — frames dropped (no direct-storage fallback):`,
          integrityError
        );
        recordIntegrityBypassBlocked(symbol, timeframe, frames.length);
      }

      // Step 5: Calculate basic metrics
      const metrics = this.calculateMetrics(frames, priceData);

      const dataQuality = this.assessDataQuality(frames, priceData);
      // Health score blends data quality and price confidence (0-100)
      const healthScore = Math.round(Math.min(100, (dataQuality * 0.6) + (Number(priceData.confidence || 0) * 0.4)));

      const result: ScanResult = {
        symbol,
        timeframe,
        price: priceData.price,
        confidence: priceData.confidence,
        sources: priceData.sources,
        deviation: priceData.deviation,
        metrics,
        timestamp: new Date(),
        dataQuality,
        healthScore
      };

      // Cache result for 3 minutes (180 seconds)
      if (useCache) {
        this.cache.set(cacheKey, result, 180000);
      }

      this.scanResults.set(symbol, result);
      this.activeScanSymbols.delete(symbol);

      return result;
    } catch (error: any) {
      this.activeScanSymbols.delete(symbol);
      console.error(`[CCXT Scanner] Error scanning ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate metrics from market frames
   */
  private calculateMetrics(frames: any[], priceData: PriceData): ScanMetrics {
    const latest = frames[frames.length - 1];

    if (!latest || !latest.indicators) {
      return this.getDefaultMetrics();
    }

    const { rsi, macd, bb, ema20, ema50, adx, atr } = latest.indicators;
    const price = latest.price.close;

    // Calculate momentum
    const momentum = this.calculateMomentum(frames);

    // Volume analysis
    const volumeRatio = frames.length > 1 
      ? latest.volume / (frames.slice(-20).reduce((sum, f) => sum + f.volume, 0) / 20)
      : 1;

    // Volatility
    const volatility = atr / price;

    // Cross-exchange deviation: provided by aggregator as `priceData.deviation` (fraction)
    const crossExchangeDeviation = typeof priceData.deviation === 'number' ? priceData.deviation : 0;

    // Trend strength
    const trendStrength = this.calculateTrendStrength(frames);

    return {
      rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      bbPosition: (price - bb.lower) / (bb.upper - bb.lower),
      ema20,
      ema50,
      adx,
      atr,
      momentum,
      crossExchangeDeviation,
      volumeRatio,
      volatility,
      trendStrength
    };
  }

  /**
   * Calculate momentum from recent frames
   */
  private calculateMomentum(frames: any[]): number {
    if (frames.length < 10) return 0;

    const recent = frames.slice(-10);
    const older = frames.slice(-20, -10);

    const recentAvg = recent.reduce((sum, f) => sum + f.price.close, 0) / recent.length;
    const olderAvg = older.reduce((sum, f) => sum + f.price.close, 0) / older.length;

    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(frames: any[]): number {
    if (frames.length < 20) return 0;

    const latest = frames[frames.length - 1];
    const { ema20, ema50, ema200 } = latest.indicators;
    const price = latest.price.close;

    let strength = 0;

    // Price above EMAs = bullish
    if (price > ema20) strength += 0.3;
    if (price > ema50) strength += 0.3;
    if (price > ema200) strength += 0.2;

    // EMA alignment
    if (ema20 > ema50) strength += 0.1;
    if (ema50 > ema200) strength += 0.1;

    return strength;
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(frames: any[], priceData: PriceData): number {
    let quality = 0;

    // Price confidence (max 40 points)
    quality += (priceData.confidence / 100) * 40;

    // Data completeness (max 30 points)
    quality += Math.min(30, (frames.length / 100) * 30);

    // Source diversity (max 20 points)
    quality += Math.min(20, priceData.sources.length * 5);

    // Low deviation bonus (max 10 points) - smaller deviation is better
    const deviation = typeof priceData.deviation === 'number' ? priceData.deviation : 0;
    const deviationPenalty = Math.min(10, deviation * 5);
    quality += 10 - deviationPenalty;

    return Math.min(100, quality);
  }

  /**
   * Get default metrics
   */
  private getDefaultMetrics(): ScanMetrics {
    return {
      rsi: 50,
      macd: 0,
      macdSignal: 0,
      macdHistogram: 0,
      bbPosition: 0.5,
      ema20: 0,
      ema50: 0,
      adx: 20,
      atr: 0,
      momentum: 0,
      volumeRatio: 1,
      volatility: 0,
      trendStrength: 0
    };
  }

  /**
   * Get scan statistics
   */
  getStats(): ScanStats {
    return {
      activeScans: this.activeScanSymbols.size,
      cachedResults: this.scanResults.size,
      totalScanned: this.scanResults.size
    };
  }

  /**
   * Parse timeframe string to seconds (e.g., "1h" -> 3600)
   */
  private parseTimeframeToSeconds(timeframe: string): number {
    const match = timeframe.match(/^(\d+)([mhd])$/i);
    if (!match) return 60;

    const [, amount, unit] = match as any;
    const value = parseInt(amount, 10);

    return unit.toLowerCase() === 'm' ? value * 60 :
           unit.toLowerCase() === 'h' ? value * 3600 : value * 86400;
  }

  /**
   * Clear scan results
   */
  clearResults(): void {
    this.scanResults.clear();
  }
}

// Types
interface ScanOptions {
  limit?: number;
  parallel?: boolean;
  useCache?: boolean;
  minConfidence?: number;
  // Progress callback (completed, total, symbol?, error?) -> void
  progressCb?: (completed: number, total: number, symbol?: string, error?: any) => void;
  // Optional list of symbols to prioritize (scanned first)
  prioritySymbols?: string[];
}

// Core result returned by scanner; kept compact for programmatic consumers
interface CoreScanResult {
  symbol: string;
  timeframe: string;
  price: number;
  confidence: number;
  sources: string[];
  deviation: number;
  metrics: ScanMetrics;
  timestamp: Date;
  dataQuality: number;
  healthScore?: number;
}

// Full ScanResult includes UI/diagnostic extensions
interface ScanResult extends CoreScanResult {
  symbol: string;
  timeframe: string;
  price: number;
  confidence: number;
  sources: string[];
  deviation: number;
  metrics: ScanMetrics;
  timestamp: Date;
  dataQuality: number;
  healthScore?: number;
  // Optional runtime fields used by UI and downstream services
  id?: string;
  exchange?: string;
  // Derived/consensus fields
  consensus?: {
    signal?: 'BUY' | 'SELL' | 'HOLD';
    confidence?: number;
    riskScore?: 'LOW' | 'MEDIUM' | 'HIGH';
    agentAgreement?: number;
  };
  agentConsensus?: {
    signal?: 'BUY' | 'SELL' | 'HOLD';
    confidence?: number;
    riskScore?: string;
  };
  agentSignals?: any[];
  // UI convenience fields
  signal?: 'BUY' | 'SELL' | 'HOLD';
  strength?: number;
  currentPrice?: number;
  // Risk/reward structure used by frontend
  risk_reward?: {
    entry_price?: number;
    stop_loss?: number;
    take_profit?: number;
    stop_loss_pct?: number;
    take_profit_pct?: number;
    risk_reward_ratio?: number;
  };
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  // Extended diagnostic/meta
  advanced?: any;
  indicators?: any;
  orderFlow?: any;
  marketMicrostructure?: any;
}

interface ScanMetrics {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bbPosition: number;
  ema20: number;
  ema50: number;
  adx: number;
  atr: number;
  momentum: number;
  volumeRatio: number;
  volatility: number;
  // Deviation across venues (fractional, e.g., 0.02 = 2%)
  crossExchangeDeviation?: number;
  trendStrength: number;
}

interface ScanStats {
  activeScans: number;
  cachedResults: number;
  totalScanned: number;
}

export type { ScanOptions, ScanResult, ScanMetrics, ScanStats };