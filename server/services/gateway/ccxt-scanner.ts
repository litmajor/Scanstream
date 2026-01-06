import { ExchangeAggregator } from './exchange-aggregator';
import { CacheManager } from './cache-manager';
import { RateLimiter } from './rate-limiter';
import type { PriceData, OHLCVData } from '../../types/gateway';

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
      minConfidence = 70
    } = options;

    const results: ScanResult[] = [];

    if (parallel) {
      // Parallel scanning with Gateway rate limiting
      const scanPromises = symbols.map(symbol => 
        this.scanSingleSymbol(symbol, timeframe, limit, useCache, minConfidence)
      );

      const settled = await Promise.allSettled(scanPromises);

      settled.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else if (result.status === 'rejected') {
          console.warn(`[CCXT Scanner] Failed to scan ${symbols[index]}:`, result.reason);
        }
      });
    } else {
      // Sequential scanning
      for (const symbol of symbols) {
        try {
          const result = await this.scanSingleSymbol(
            symbol, 
            timeframe, 
            limit, 
            useCache, 
            minConfidence
          );

          if (result) {
            results.push(result);
          }
        } catch (error: any) {
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
      // Step 1: Get aggregated price through Gateway
      const priceData = await this.aggregator.getAggregatedPrice(symbol);

      // Filter by confidence
      if (priceData.confidence < minConfidence) {
        console.warn(`[CCXT Scanner] Low confidence for ${symbol}: ${priceData.confidence}%`);
        return null;
      }

      // Step 2: Get OHLCV data through Gateway
      const ohlcv = await this.aggregator.getOHLCV(symbol, timeframe, limit);

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
        const candles = frames.map(f => ({
          ts: (f.timestamp instanceof Date ? f.timestamp.getTime() : Number(f.timestamp)) || Date.now(),
          open: (f.price as any)?.open ?? 0,
          high: (f.price as any)?.high ?? 0,
          low: (f.price as any)?.low ?? 0,
          close: (f.price as any)?.close ?? 0,
          volume: f.volume ?? 0,
          isFinal: true,
          source: 'ccxt',
          venue: 'scanner',
          // Enrichment payloads (optional)
          price: f.price ?? undefined,
          indicators: (f as any).indicators ?? undefined,
          orderFlow: (f as any).orderFlow ?? undefined,
          marketMicrostructure: (f as any).marketMicrostructure ?? undefined,
          raw: (f as any).raw ?? undefined,
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
        console.warn('[CCXT Scanner] Integrity gate check failed, falling back to direct storage:', integrityError);

        // Fallback: store directly if integrity gate fails
        try {
          const { storage } = await import('../../storage');
          for (const frame of frames) {
            try {
              // Insert without timestamp to match InsertMarketFrame shape; storage will set timestamp
              await storage.createMarketFrame({
                symbol: frame.symbol,
                price: frame.price,
                volume: frame.volume,
                indicators: frame.indicators,
                orderFlow: frame.orderFlow,
                marketMicrostructure: frame.marketMicrostructure
              } as any);
            } catch (storageError) {
              console.warn(`[CCXT Scanner] Failed to store frame for ${symbol}:`, (storageError as any).message);
            }
          }
        } catch (importError) {
          console.warn('[CCXT Scanner] Storage module not available for frame persistence');
        }
      }

      // Step 5: Calculate basic metrics
      const metrics = this.calculateMetrics(frames, priceData);

      const result: ScanResult = {
        symbol,
        timeframe,
        price: priceData.price,
        confidence: priceData.confidence,
        sources: priceData.sources,
        deviation: priceData.deviation,
        metrics,
        timestamp: new Date(),
        dataQuality: this.assessDataQuality(frames, priceData)
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

    // Low deviation bonus (max 10 points)
    const deviationPenalty = Math.min(10, priceData.deviation * 5);
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
    const m = timeframe.match(/(\d+)([mhd])/i);
    if (!m) return 60;

    const amount = parseInt(m[1]);
    const unit = m[2].toLowerCase();

    if (unit === 'm') return amount * 60;
    if (unit === 'h') return amount * 3600;
    if (unit === 'd') return amount * 86400;
    return 60;
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
}

interface ScanResult {
  symbol: string;
  timeframe: string;
  price: number;
  confidence: number;
  sources: string[];
  deviation: number;
  metrics: ScanMetrics;
  timestamp: Date;
  dataQuality: number;
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
  trendStrength: number;
}

interface ScanStats {
  activeScans: number;
  cachedResults: number;
  totalScanned: number;
}

export type { ScanOptions, ScanResult, ScanMetrics, ScanStats };