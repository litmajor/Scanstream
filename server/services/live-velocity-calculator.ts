/**
 * Live Velocity Calculator
 * 
 * Fetches real-time historical data and calculates velocity profiles on-the-fly
 * instead of relying on hardcoded defaults.
 * 
 * Data Source Priority:
 * 1. CCXT (Binance, KuCoin, etc.) - Primary, free, unlimited rate limit
 * 2. Polygon.io API - Fallback if CCXT unavailable
 * 3. Hardcoded defaults - Last resort if both unavailable
 * 
 * Features:
 * - Fetches daily OHLCV data from CCXT exchanges (primary)
 * - Falls back to Polygon.io API if needed
 * - Calculates velocity metrics across multiple lookback periods
 * - Detects market regimes (bull/bear/sideways)
 * - Caches results to minimize API calls
 * - Graceful degradation if data sources unavailable
 */

import axios, { AxiosInstance } from 'axios';
import * as ccxt from 'ccxt';
import type { AssetVelocityData, VelocityMetrics } from './asset-velocity-profile';
import { symbolManager } from './symbol-manager';

interface PolygonCandle {
  t: number; // timestamp in ms
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vw?: number; // volume weighted average price
  n?: number; // number of transactions
}

interface CachedVelocityData {
  data: AssetVelocityData;
  fetchedAt: number;
  period: string; // e.g., "90D", "1Y", "2Y"
}

interface RegimeDetectionResult {
  regime: 'BULL' | 'BEAR' | 'SIDEWAYS';
  volatility: number;
  trendStrength: number;
  startDate: number;
}

export class LiveVelocityCalculator {
  private readonly POLYGON_API_KEY = process.env.POLYGON_API_KEY || '';
  private client: AxiosInstance;
  private velocityCache: Map<string, CachedVelocityData> = new Map();
  private readonly CACHE_TTL = 86400000; // 24 hours
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // ms
  private ccxtExchanges: Map<string, ccxt.Exchange>;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.polygon.io',
      timeout: 10000,
    });

    // Initialize CCXT exchanges (free, unlimited)
    this.ccxtExchanges = new Map();
    try {
      this.ccxtExchanges.set('binance', new ccxt.binance({ enableRateLimit: true }));
      this.ccxtExchanges.set('kucoin', new ccxt.kucoin({ enableRateLimit: true }));
      this.ccxtExchanges.set('coinbase', new ccxt.coinbase({ enableRateLimit: true }));
      console.log('[LiveVelocity] CCXT exchanges initialized (Binance, KuCoin, Coinbase)');
    } catch (error) {
      console.warn('[LiveVelocity] Failed to initialize CCXT exchanges:', error);
    }
  }

  /**
   * Calculate velocity profile for asset using live data
   * Fetches daily candles for specified lookback period
   */
  async calculateLiveVelocityProfile(
    symbol: string,
    lookbackDays: number = 365,
    regime?: 'BULL' | 'BEAR' | 'SIDEWAYS'
  ): Promise<AssetVelocityData> {
    // Check cache first
    const cacheKey = `${symbol}:${lookbackDays}:${regime || 'all'}`;
    const cached = this.velocityCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      console.log(`[LiveVelocity] Using cached profile for ${symbol}`);
      return cached.data;
    }

    try {
      console.log(
        `[LiveVelocity] Fetching live data for ${symbol} (${lookbackDays}D lookback)`
      );

      // Fetch daily candles (use canonical normalization from SymbolManager)
      const canonical = symbolManager.canonicalize(symbol);
      const candles = await this.fetchDailyCandles(
        canonical,
        lookbackDays
      );

      if (candles.length < 30) {
        console.warn(
          `[LiveVelocity] Insufficient data (${candles.length} candles). Using defaults.`
        );
        return this.getDefaultFallback(symbol);
      }

      // Filter by regime if specified
      let filteredCandles = candles;
      if (regime) {
        const regimeStart = this.detectRegimeStart(candles, regime);
        filteredCandles = candles.filter(c => c.t >= regimeStart);
      }

      // Calculate velocity metrics
      const profile = this.calculateMetrics(symbol, filteredCandles);

      // Cache result
      this.velocityCache.set(cacheKey, {
        data: profile,
        fetchedAt: Date.now(),
        period: `${lookbackDays}D${regime ? ` (${regime})` : ''}`,
      });

      console.log(
        `[LiveVelocity] Calculated ${profile.symbol} 1D avg move: $${profile['1D'].avgDollarMove.toFixed(2)}`
      );
      return profile;
    } catch (error) {
      console.error(
        `[LiveVelocity] Failed to fetch live data for ${symbol}:`,
        error
      );
      return this.getDefaultFallback(symbol);
    }
  }

  /**
   * Detect current market regime and fetch velocity profile for it
   */
  async calculateRegimeAwareVelocityProfile(
    symbol: string,
    lookbackDays: number = 365
  ): Promise<{ profile: AssetVelocityData; regime: RegimeDetectionResult }> {
    try {
      const canonical = symbolManager.canonicalize(symbol);
      const candles = await this.fetchDailyCandles(
        canonical,
        lookbackDays
      );

      if (candles.length < 30) {
        return {
          profile: this.getDefaultFallback(symbol),
          regime: {
            regime: 'SIDEWAYS',
            volatility: 0,
            trendStrength: 0,
            startDate: Date.now(),
          },
        };
      }

      // Detect current regime
      const regime = this.detectCurrentRegime(candles);
      console.log(
        `[LiveVelocity] Detected regime for ${symbol}: ${regime.regime} (strength: ${regime.trendStrength.toFixed(2)})`
      );

      // Calculate velocity for this regime
      const regimeCandles = candles.filter(c => c.t >= regime.startDate);
      const profile = this.calculateMetrics(symbol, regimeCandles);

      return { profile, regime };
    } catch (error) {
      console.error(`[LiveVelocity] Regime detection failed:`, error);
      return {
        profile: this.getDefaultFallback(symbol),
        regime: {
          regime: 'SIDEWAYS',
          volatility: 0,
          trendStrength: 0,
          startDate: Date.now(),
        },
      };
    }
  }

  /**
   * Compare velocity across multiple regimes to show how it changes
   */
  async compareRegimes(
    symbol: string,
    lookbackDays: number = 730 // 2 years
  ): Promise<{ bull: AssetVelocityData; bear: AssetVelocityData; sideways: AssetVelocityData }> {
    const candles = await this.fetchDailyCandles(symbol, lookbackDays);

    const bull = this.calculateVelocityForRegime(candles, 'BULL');
    const bear = this.calculateVelocityForRegime(candles, 'BEAR');
    const sideways = this.calculateVelocityForRegime(candles, 'SIDEWAYS');

    return {
      bull: bull || this.getDefaultFallback(symbol),
      bear: bear || this.getDefaultFallback(symbol),
      sideways: sideways || this.getDefaultFallback(symbol),
    };
  }

  /**
   * Fetch daily OHLCV candles - Primary: CCXT, Fallback: Polygon.io
   * 
   * Data Source Priority:
   * 1. CCXT (Binance) - Free, unlimited, preferred
   * 2. CCXT (KuCoin/Coinbase) - Free alternatives
   * 3. Polygon.io API - If CCXT unavailable
   * 4. Return empty array - If all sources fail
   */
  private async fetchDailyCandles(
    symbol: string,
    lookbackDays: number
  ): Promise<any[]> {
    // First try CCXT (free, unlimited rate limit)
    console.log(`[LiveVelocity] Attempting CCXT fetch for ${symbol}...`);
    const ccxtCandles = await this.fetchFromCCXT(symbol, lookbackDays);
    if (ccxtCandles.length > 0) {
      console.log(
        `[LiveVelocity] ✅ Fetched ${ccxtCandles.length} candles from CCXT for ${symbol}`
      );
      return ccxtCandles;
    }

    // Fallback to Polygon.io if CCXT fails
    console.log(`[LiveVelocity] CCXT failed, falling back to Polygon.io for ${symbol}...`);
    const polygonCandles = await this.fetchDailyPolygonCandles(
      this.toPolygonSymbol(symbol),
      lookbackDays
    );
    if (polygonCandles.length > 0) {
      console.log(
        `[LiveVelocity] ✅ Fetched ${polygonCandles.length} candles from Polygon for ${symbol}`
      );
      return polygonCandles;
    }

    // Both sources failed
    console.warn(`[LiveVelocity] ⚠️ No data sources available for ${symbol}`);
    return [];
  }

  /**
   * Fetch daily candles from CCXT (Primary source - Free, unlimited)
   */
  private async fetchFromCCXT(symbol: string, lookbackDays: number): Promise<any[]> {
    try {
      const exchange = this.ccxtExchanges.get('binance');
      if (!exchange) {
        console.warn('[LiveVelocity] Binance CCXT exchange not initialized');
        return [];
      }

      // Convert symbol to CCXT format (e.g., "BTC" → "BTC/USDT")
      const ccxtSymbol = symbol.includes('/') ? symbol : `${symbol}/USDT`;

      // CCXT does not populate `symbols` until markets are loaded.
      await exchange.loadMarkets();
      if (!(exchange.symbols ?? []).includes(ccxtSymbol)) {
        console.warn(`[LiveVelocity] Symbol ${ccxtSymbol} not available on Binance`);
        return [];
      }

      // Calculate since timestamp (1 day = 86400000 ms)
      const since = Date.now() - lookbackDays * 86400000;

      console.log(`[LiveVelocity] Fetching CCXT candles for ${ccxtSymbol}...`);
      const candles = await exchange.fetchOHLCV(ccxtSymbol, '1d', since);

      // Convert CCXT format [timestamp, open, high, low, close, volume]
      // to PolygonCandle format {t, o, h, l, c, v}
      return candles.map(c => ({
        t: c[0], // timestamp in ms
        o: c[1], // open
        h: c[2], // high
        l: c[3], // low
        c: c[4], // close
        v: c[5], // volume
      }));
    } catch (error: any) {
      console.warn(`[LiveVelocity] CCXT fetch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch daily OHLCV candles from Polygon.io (Fallback)
   */
  private async fetchDailyPolygonCandles(
    normalizedSymbol: string,
    lookbackDays: number
  ): Promise<any[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - lookbackDays);
    const toDate = new Date();

    const from = fromDate.toISOString().split('T')[0];
    const to = toDate.toISOString().split('T')[0];

    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        console.log(
          `[LiveVelocity] Fetching Polygon daily candles for ${normalizedSymbol} from ${from} to ${to}`
        );

        // Use the ticker in the request path. `normalizedSymbol` should be
        // returned by `toPolygonSymbol()` in the form `X:BASEQUOTE` when
        // possible. We encode it to be safe.
        const tickerPath = encodeURIComponent(normalizedSymbol);
        const response = await this.client.get(`/v2/aggs/ticker/${tickerPath}/range/1/day`, {
          params: {
            from,
            to,
            apiKey: this.POLYGON_API_KEY,
            sort: 'asc',
            limit: 50000, // Max per request
          },
        });

        if (!response.data.results || response.data.results.length === 0) {
          console.warn(`[LiveVelocity] No data returned from Polygon for ${normalizedSymbol}`);
          return [];
        }

        return response.data.results;
      } catch (error: any) {
        attempt++;

        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          console.warn(`[LiveVelocity] Polygon rate limited. Waiting ${this.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        } else if (attempt < this.MAX_RETRIES) {
          console.warn(`[LiveVelocity] Polygon attempt ${attempt} failed, retrying...`);
          await new Promise(resolve =>
            setTimeout(resolve, this.RETRY_DELAY * attempt)
          );
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Failed to fetch from Polygon after ${this.MAX_RETRIES} attempts`);
  }

  /**
   * Calculate velocity metrics from candles
   */
  private calculateMetrics(
    symbol: string,
    candles: PolygonCandle[]
  ): AssetVelocityData {
    const timeframes = {
      '1D': 1,
      '3D': 3,
      '7D': 7,
      '14D': 14,
      '21D': 21,
      '30D': 30,
    };

    const profile: any = {
      symbol,
      lastUpdated: Date.now(),
    };

    for (const [name, days] of Object.entries(timeframes)) {
      const moves: number[] = [];
      const percentMoves: number[] = [];
      const windowVolumes: number[] = [];
      let upCount = 0;

      // Rolling window analysis
      for (let i = 0; i < candles.length - days; i++) {
        const startPrice = candles[i].c;
        const endPrice = candles[i + days].c;

        const dollarMove = Math.abs(endPrice - startPrice);
        const percentMove = (dollarMove / startPrice) * 100;

        // Sum volumes across the window for VW metrics
        let volSum = 0;
        for (let j = i; j <= i + days; j++) {
          volSum += (candles[j]?.v || 0);
        }

        moves.push(dollarMove);
        percentMoves.push(percentMove);
        windowVolumes.push(volSum);

        if (endPrice > startPrice) upCount++;
      }

      // Calculate base statistics
      const stats = this.calculateStatistics(
        moves,
        percentMoves,
        upCount,
        Math.max(1, candles.length - days)
      );

      // Compute volume-weighted average dollar move
      const totalVol = windowVolumes.reduce((a, b) => a + b, 0) || 0;
      const weightedSum = moves.reduce((acc, m, idx) => acc + m * (windowVolumes[idx] || 0), 0);
      const vwAvgDollarMove = totalVol > 0 ? weightedSum / totalVol : stats.avgDollarMove;

      // Volatility-adjusted velocity: normalize percent move by ATR% (avoid divide-by-zero)
      const atrPercent = this.calculateATR(candles, Math.min(14, Math.max(2, days)));
      const volatilityAdjustedPercent = atrPercent > 0 ? stats.avgPercentMove / atrPercent : stats.avgPercentMove;

      profile[name] = {
        ...stats,
        vwAvgDollarMove,
        volatilityAdjustedPercent,
      } as any;
    }

    // Momentum divergence between short and long velocity profiles
    try {
      profile.momentumDivergence = this.detectMomentumDivergence(candles);
    } catch (e) {
      profile.momentumDivergence = { score: 0, divergent: false };
    }

    return profile as AssetVelocityData;
  }

  /**
   * Calculate statistical metrics
   */
  private calculateStatistics(
    moves: number[],
    percentMoves: number[],
    upCount: number,
    totalWindows: number
  ): VelocityMetrics {
    moves.sort((a, b) => a - b);
    percentMoves.sort((a, b) => a - b);

    const avg = moves.reduce((a, b) => a + b, 0) / moves.length;
    const median = moves[Math.floor(moves.length / 2)];

    const avgPercent = percentMoves.reduce((a, b) => a + b, 0) / percentMoves.length;
    const medianPercent = percentMoves[Math.floor(percentMoves.length / 2)];

    const p25Index = Math.floor(moves.length * 0.25);
    const p75Index = Math.floor(moves.length * 0.75);
    const p90Index = Math.floor(moves.length * 0.90);

    return {
      avgDollarMove: avg,
      medianDollarMove: median,
      avgPercentMove: avgPercent,
      medianPercentMove: medianPercent,
      p25: moves[p25Index],
      p75: moves[p75Index],
      p90: moves[p90Index],
      maxMove: moves[moves.length - 1],
      upDaysPercent: (upCount / totalWindows) * 100,
    };
  }

  /**
   * Calculate ATR (average true range) as a percent of price
   */
  private calculateATR(candles: PolygonCandle[], period: number = 14): number {
    if (candles.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].h;
      const low = candles[i].l;
      const prevClose = candles[i - 1].c;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
    const slice = trs.slice(-period);
    const atr = slice.reduce((a, b) => a + b, 0) / slice.length;
    const recentClose = candles[candles.length - 1].c || 1;
    return (atr / recentClose) * 100; // percent
  }

  /**
   * Detect momentum divergence between short and long velocity profiles.
   * Returns a simple score and flag if divergent.
   */
  private detectMomentumDivergence(candles: PolygonCandle[]): { score: number; divergent: boolean } {
    // Use percent moves over short (7) and long (30) windows
    const short = 7;
    const long = 30;
    if (candles.length < long + 2) return { score: 0, divergent: false };

    const calcAvgPercentForWindow = (windowDays: number) => {
      const moves: number[] = [];
      for (let i = candles.length - windowDays - 1; i < candles.length - 1; i++) {
        const start = candles[i].c;
        const end = candles[i + 1].c;
        moves.push(Math.abs(end - start) / Math.max(1e-9, start) * 100);
      }
      return moves.reduce((a, b) => a + b, 0) / Math.max(1, moves.length);
    };

    const shortAvg = calcAvgPercentForWindow(short);
    const longAvg = calcAvgPercentForWindow(long);

    // Score: positive if short > long (momentum accelerating), negative if short < long
    const score = (shortAvg - longAvg) / Math.max(1e-9, longAvg);
    const divergent = Math.abs(score) > 0.15; // arbitrary threshold
    return { score, divergent };
  }

  /**
   * Detect current market regime
   */
  private detectCurrentRegime(candles: PolygonCandle[]): RegimeDetectionResult {
    // Use recent 30 candles for trend detection
    const recent = candles.slice(-30);

    // Calculate SMA 10 and 20
    const sma10 = this.calculateSMA(recent, 10);
    const sma20 = this.calculateSMA(recent, 20);

    // Calculate volatility
    const returns = [];
    for (let i = 1; i < recent.length; i++) {
      returns.push(Math.log(recent[i].c / recent[i - 1].c));
    }
    const volatility = this.standardDeviation(returns) * 100;

    // Determine regime
    let regime: 'BULL' | 'BEAR' | 'SIDEWAYS';
    let trendStrength = 0;

    const priceChange = (recent[recent.length - 1].c - recent[0].c) / recent[0].c;

    if (sma10 > sma20 && priceChange > 0.02) {
      regime = 'BULL';
      trendStrength = Math.min(volatility * priceChange, 1);
    } else if (sma10 < sma20 && priceChange < -0.02) {
      regime = 'BEAR';
      trendStrength = Math.min(Math.abs(volatility * priceChange), 1);
    } else {
      regime = 'SIDEWAYS';
      trendStrength = 1 - volatility; // Lower volatility in sideways
    }

    return {
      regime,
      volatility,
      trendStrength,
      startDate: this.findRegimeStart(candles, regime),
    };
  }

  /**
   * Find when current regime started
   */
  private findRegimeStart(
    candles: PolygonCandle[],
    targetRegime: string
  ): number {
    // Walk backwards until regime changes
    let regimeCount = 0;
    const requiredLength = 5; // At least 5 candles in same regime

    for (let i = candles.length - 1; i >= 0; i--) {
      const regime = this.getRegimeAtIndex(candles, i);

      if (regime === targetRegime) {
        regimeCount++;
        if (regimeCount >= requiredLength) {
          return candles[i].t;
        }
      } else {
        regimeCount = 0;
      }
    }

    return candles[0].t;
  }

  /**
   * Get regime at specific candle index
   */
  private getRegimeAtIndex(candles: PolygonCandle[], index: number): string {
    if (index < 20) return 'SIDEWAYS';

    const window = candles.slice(Math.max(0, index - 20), index + 1);
    const sma10 = this.calculateSMA(window, 10);
    const sma20 = this.calculateSMA(window, 20);

    if (sma10 > sma20) return 'BULL';
    if (sma10 < sma20) return 'BEAR';
    return 'SIDEWAYS';
  }

  /**
   * Calculate velocity metrics for specific regime
   */
  private calculateVelocityForRegime(
    allCandles: PolygonCandle[],
    regime: 'BULL' | 'BEAR' | 'SIDEWAYS'
  ): AssetVelocityData | null {
    const regimeCandles = this.filterByRegime(allCandles, regime);

    if (regimeCandles.length < 30) {
      return null;
    }

    return this.calculateMetrics(
      allCandles.length > 0 ? `(${regime})` : '',
      regimeCandles
    );
  }

  /**
   * Filter candles by regime
   */
  private filterByRegime(
    candles: PolygonCandle[],
    targetRegime: string
  ): PolygonCandle[] {
    return candles.filter((_, i) => {
      const regime = this.getRegimeAtIndex(candles, i);
      return regime === targetRegime;
    });
  }

  /**
   * Detect regime start date
   */
  private detectRegimeStart(
    candles: PolygonCandle[],
    regime: string
  ): number {
    for (let i = candles.length - 1; i >= 0; i--) {
      if (this.getRegimeAtIndex(candles, i) !== regime) {
        return candles[i + 1]?.t || candles[0].t;
      }
    }
    return candles[0].t;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(candles: PolygonCandle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].c;

    const sum = candles
      .slice(-period)
      .reduce((acc, c) => acc + c.c, 0);
    return sum / period;
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Normalize symbol to Polygon format (e.g., "X:BTCUSD")
   */
  private normalizeSymbol(symbol: string): string {
    // Detect format:
    // - "BTC/USDT" or "BTC" → for CCXT (already good)
    // - "X:BTCUSD" format → for Polygon.io API
    
    if (!symbol) return symbol;

    let s = symbol.trim().toUpperCase();
    if (s.startsWith('X:')) return s; // already polygon style

    // handle common separators
    if (s.includes('/')) return s;
    if (s.includes('-')) return s.replace('-', '/');

    // known quote currencies
    const knownQuotes = ['USD', 'USDT', 'USDC', 'BTC', 'ETH', 'EUR', 'BUSD'];
    for (const q of knownQuotes) {
      if (s.endsWith(q)) {
        const base = s.slice(0, s.length - q.length);
        return `${base}/${q}`;
      }
    }

    // fallback to USDT for crypto
    return `${s}/USDT`;
  }

  /**
   * Convert to Polygon format if needed
   */
  private toPolygonSymbol(symbol: string): string {
    if (!symbol) return symbol;
    let s = symbol.trim().toUpperCase();
    if (s.startsWith('X:')) return s;

    let base = '';
    let quote = '';
    if (s.includes('/')) {
      [base, quote] = s.split('/');
    } else if (s.includes('-')) {
      [base, quote] = s.split('-');
    } else {
      const knownQuotes = ['USD', 'USDT', 'USDC', 'BTC', 'ETH', 'EUR', 'BUSD'];
      for (const q of knownQuotes) {
        if (s.endsWith(q)) {
          base = s.slice(0, s.length - q.length);
          quote = q;
          break;
        }
      }
      if (!base) {
        base = s;
        quote = 'USD';
      }
    }

    // Polygon uses `X:BASEQUOTE` for crypto aggregates (e.g., X:BTCUSD)
    return `X:${base}${quote}`;
  }

  /**
   * Fallback to hardcoded defaults if API unavailable
   */
  private getDefaultFallback(symbol: string): AssetVelocityData {
    const base = symbol.split('/')[0].toUpperCase();
    // Better defaults based on market cap / known large caps
    const isHighCap = ['BTC', 'ETH'].includes(base);

    // Return generic safe defaults for unknown assets
    const generic: AssetVelocityData = {
      symbol,
      '1D': {
        avgDollarMove: 0,
        medianDollarMove: 0,
        avgPercentMove: isHighCap ? 1.5 : 2.5,
        medianPercentMove: isHighCap ? 1.2 : 2.0,
        p25: 0,
        p75: 0,
        p90: 0,
        maxMove: 0,
        upDaysPercent: 50,
      },
      '3D': {
        avgDollarMove: 0,
        medianDollarMove: 0,
        avgPercentMove: isHighCap ? 3.5 : 5.0,
        medianPercentMove: isHighCap ? 2.8 : 4.0,
        p25: 0,
        p75: 0,
        p90: 0,
        maxMove: 0,
        upDaysPercent: 50,
      },
      '7D': {
        avgDollarMove: 0,
        medianDollarMove: 0,
        avgPercentMove: isHighCap ? 5.5 : 7.5,
        medianPercentMove: isHighCap ? 4.5 : 6.0,
        p25: 0,
        p75: 0,
        p90: 0,
        maxMove: 0,
        upDaysPercent: 50,
      },
      '14D': {
        avgDollarMove: 0,
        medianDollarMove: 0,
        avgPercentMove: isHighCap ? 8.0 : 10.0,
        medianPercentMove: isHighCap ? 6.5 : 8.0,
        p25: 0,
        p75: 0,
        p90: 0,
        maxMove: 0,
        upDaysPercent: 50,
      },
      '21D': {
        avgDollarMove: 0,
        medianDollarMove: 0,
        avgPercentMove: isHighCap ? 10.0 : 12.5,
        medianPercentMove: isHighCap ? 8.0 : 10.0,
        p25: 0,
        p75: 0,
        p90: 0,
        maxMove: 0,
        upDaysPercent: 50,
      },
      '30D': {
        avgDollarMove: 0,
        medianDollarMove: 0,
        avgPercentMove: isHighCap ? 12.0 : 15.0,
        medianPercentMove: isHighCap ? 9.5 : 12.0,
        p25: 0,
        p75: 0,
        p90: 0,
        maxMove: 0,
        upDaysPercent: 50,
      },
      lastUpdated: Date.now(),
    };

    return generic;
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      const keysToDelete = Array.from(this.velocityCache.keys()).filter(k =>
        k.startsWith(symbol)
      );
      keysToDelete.forEach(k => this.velocityCache.delete(k));
      console.log(`[LiveVelocity] Cleared cache for ${symbol}`);
    } else {
      this.velocityCache.clear();
      console.log(`[LiveVelocity] Cleared all cache`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalCached: number;
    items: Array<{ key: string; age: number; period: string }>;
  } {
    const items = Array.from(this.velocityCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.fetchedAt,
      period: value.period,
    }));

    return {
      totalCached: items.length,
      items,
    };
  }
}

// Export singleton instance
export const liveVelocityCalculator = new LiveVelocityCalculator();
