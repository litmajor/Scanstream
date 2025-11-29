
```typescript
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

      // Step 4: Calculate basic metrics
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

      // Cache result for 30 seconds
      if (useCache) {
        this.cache.set(cacheKey, result, 30000);
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
```
