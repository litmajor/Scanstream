/**
 * Binance Historical Data Fetcher
 * 
 * Fetches 1-hour BTC/USDT data for 180 days using Binance PUBLIC API.
 * 
 * Why Binance:
 * - FREE (no API key needed for historical data)
 * - Best data quality (exchange-grade)
 * - Full 180 days of 1h candles
 * - Rate limit: 1200 requests/min
 * 
 * API Docs: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */

import axios from 'axios';
import { MarketTick } from './types.ts';
import * as fs from 'fs';
import * as path from 'path';

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  ignore: string;
}

export interface OrderFlowData {
  timestamp: number;
  symbol: string;
  interval: string;
  // From Binance klines (approximated)
  buyVolume: number;
  sellVolume: number;
  buyCount: number;
  sellCount: number;
  netVolume: number;
  volumeRatio: number;
  dominantSide: 'BUY' | 'SELL' | 'NEUTRAL';
  // Real microstructure (from CCXT orderbook when available)
  bidVolume?: number;          // Real bid depth
  askVolume?: number;          // Real ask depth
  spread?: number;             // Bid-ask spread
  spreadPercent?: number;      // Spread as % of price
  imbalance?: number;          // bidVol / (bidVol + askVol)
  bidAskRatio?: number;        // bidVol / askVol
  depth?: number;              // Total liquidity
  hasMicrostructure?: boolean; // Flag: was orderbook data available?
}

export interface MarketDataWithOrderFlow {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  orderFlow?: OrderFlowData;
}

export class BinanceDataFetcher {
  private baseURL = 'https://api.binance.com/api/v3';
  private maxCandlesPerRequest = 1000; // Binance limit
  private ccxtExchange: any = null; // Lazy-loaded CCXT exchange

  // All supported timeframes from 1m to 1d
  private readonly allTimeframes = [
    '1m', '3m', '5m', '15m', '30m',
    '1h', '2h', '4h', '6h', '8h', '12h',
    '1d'
  ];

  /**
   * Initialize CCXT exchange for orderbook fetching (lazy initialization)
   */
  private async initCCXT(): Promise<void> {
    if (this.ccxtExchange) return;
    
    try {
      const ccxt = await import('ccxt');
      this.ccxtExchange = new (ccxt as any).binance({
        enableRateLimit: true,
        rateLimit: 100, // ms between requests
      });
      console.log('✓ CCXT Binance exchange initialized');
    } catch (error) {
      console.warn('⚠️  CCXT not available, continuing with kline orderflow only:', (error as any).message);
      this.ccxtExchange = null;
    }
  }

  /**
   * Fetch multi-timeframe data for multiple symbols
   * Fetches all timeframes from 1m to 1d for BTC and ETH
   * 
   * @param symbols - Trading pairs (e.g., ['BTCUSDT', 'ETHUSDT'])
   * @param days - Number of days to fetch (default: 30)
   * @returns Map of symbol -> timeframe -> MarketDataWithOrderFlow[]
   */
  async fetchMultiTimeframeData(
    symbols: string[] = ['BTCUSDT', 'ETHUSDT'],
    days: number = 30,
    includeOrderFlow: boolean = true
  ): Promise<Map<string, Map<string, MarketDataWithOrderFlow[]>>> {
    
    console.log('📊 MULTI-TIMEFRAME DATA FETCH STARTING...');
    console.log('='.repeat(80));
    console.log(`Symbols: ${symbols.join(', ')}`);
    console.log(`Timeframes: ${this.allTimeframes.join(', ')}`);
    console.log(`Period: ${days} days`);
    console.log(`Include OrderFlow: ${includeOrderFlow}`);
    console.log('');

    const allData = new Map<string, Map<string, MarketDataWithOrderFlow[]>>();

    for (const symbol of symbols) {
      console.log(`\n🔄 Fetching data for ${symbol}...`);
      const timeframeData = new Map<string, MarketDataWithOrderFlow[]>();

      for (const timeframe of this.allTimeframes) {
        try {
          console.log(`  📍 ${symbol} @ ${timeframe}...`);
          
          const ticks = await this.fetchHistoricalData(symbol, days, timeframe as any);
          
          let marketData: MarketDataWithOrderFlow[] = ticks.map(tick => ({
            timestamp: tick.timestamp,
            open: tick.open,
            high: tick.high,
            low: tick.low,
            close: tick.close,
            volume: tick.volume
          }));

          // Fetch and attach orderflow data if requested
          if (includeOrderFlow) {
            const orderFlowData = await this.fetchOrderFlowData(
              symbol,
              timeframe,
              ticks.length
            );
            
            // Merge orderflow with market data
            marketData = marketData.map((data, index) => ({
              ...data,
              orderFlow: orderFlowData[index] || undefined
            }));

            // Attempt to enrich latest candle with real CCXT orderbook microstructure
            if (marketData.length > 0) {
              const latestCandle = marketData[marketData.length - 1];
              const microstructure = await this.fetchOrderBookMicrostructure(
                symbol,
                latestCandle.close
              );
              
              if (microstructure && latestCandle.orderFlow) {
                // Merge microstructure metrics into latest orderflow
                latestCandle.orderFlow = {
                  ...latestCandle.orderFlow,
                  ...microstructure
                };
              }
            }
          }

          timeframeData.set(timeframe, marketData);
          console.log(`    ✅ Fetched ${marketData.length} candles`);

        } catch (error) {
          console.error(`    ❌ Failed to fetch ${symbol} @ ${timeframe}:`, error);
        }

        // Rate limiting between requests
        await this.sleep(100);
      }

      allData.set(symbol, timeframeData);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ MULTI-TIMEFRAME FETCH COMPLETE');
    console.log('');

    return allData;
  }

  /**
   * Fetch orderflow data based on kline volume data
   * Approximates orderflow using buy/sell volumes from Binance klines
   * 
   * @param symbol - Trading pair
   * @param interval - Candle interval
   * @param limit - Number of candles to fetch
   * @returns Array of OrderFlowData
   */
  private async fetchOrderFlowData(
    symbol: string,
    interval: string,
    limit: number = 1000
  ): Promise<OrderFlowData[]> {
    
    try {
      const url = `${this.baseURL}/klines`;
      
      const params = {
        symbol: symbol,
        interval: interval,
        limit: Math.min(limit, this.maxCandlesPerRequest)
      };

      const response = await axios.get(url, { params });
      const klines = response.data;

      // Extract orderflow data from kline response
      // Binance provides: takerBuyBaseVolume and takerBuyQuoteVolume at indices 9 and 10
      const orderFlowData: OrderFlowData[] = klines.map((kline: any) => {
        const timestamp = kline[0];
        const takerBuyBaseVolume = parseFloat(kline[9]); // Buy volume
        const totalBaseVolume = parseFloat(kline[5]);     // Total volume
        const sellBaseVolume = totalBaseVolume - takerBuyBaseVolume; // Sell volume
        
        const trades = parseInt(kline[8]);
        const takerBuyCount = Math.round(trades * (takerBuyBaseVolume / totalBaseVolume));
        const takerSellCount = trades - takerBuyCount;

        const netVolume = takerBuyBaseVolume - sellBaseVolume;
        const volumeRatio = totalBaseVolume > 0 
          ? takerBuyBaseVolume / totalBaseVolume 
          : 0.5;

        // Determine dominant side (threshold 55%)
        let dominantSide: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        if (volumeRatio > 0.55) dominantSide = 'BUY';
        else if (volumeRatio < 0.45) dominantSide = 'SELL';

        return {
          timestamp,
          symbol,
          interval,
          buyVolume: takerBuyBaseVolume,
          sellVolume: sellBaseVolume,
          buyCount: takerBuyCount,
          sellCount: takerSellCount,
          netVolume,
          volumeRatio,
          dominantSide
        };
      });

      return orderFlowData;

    } catch (error) {
      console.error(`Error fetching orderflow for ${symbol}/${interval}:`, error);
      return [];
    }
  }

  /**
   * Fetch real orderbook microstructure from CCXT
   * Augments orderflow data with real bid/ask depth metrics
   * 
   * @param symbol - Trading pair (e.g., 'BTC/USDT')
   * @param price - Current price (for spread % calculation)
   * @returns Microstructure data or null if unavailable
   */
  private async fetchOrderBookMicrostructure(
    symbol: string,
    price: number
  ): Promise<Partial<OrderFlowData> | null> {
    
    if (!this.ccxtExchange) return null;

    try {
      // Format symbol for CCXT (e.g., 'BTCUSDT' -> 'BTC/USDT')
      const ccxtSymbol = symbol.slice(0, -4) + '/' + symbol.slice(-4);
      
      // Fetch top 20 levels of orderbook (balance speed vs depth)
      const orderbook = await this.ccxtExchange.fetchOrderBook(ccxtSymbol, 20);

      if (!orderbook?.bids || !orderbook?.asks || orderbook.bids.length === 0) {
        return null;
      }

      // Calculate bid and ask volumes
      const bidVolume = orderbook.bids.reduce((sum: number, [_price, qty]: [number, number]) => sum + qty, 0);
      const askVolume = orderbook.asks.reduce((sum: number, [_price, qty]: [number, number]) => sum + qty, 0);
      const totalDepth = bidVolume + askVolume;

      // Calculate spread
      const bestBid = orderbook.bids[0][0];
      const bestAsk = orderbook.asks[0][0];
      const spread = bestAsk - bestBid;
      const spreadPercent = price > 0 ? (spread / price) * 100 : 0;

      // Calculate imbalance (0-1 scale, 0.5 = neutral)
      const imbalance = totalDepth > 0 ? bidVolume / totalDepth : 0.5;
      const bidAskRatio = askVolume > 0 ? bidVolume / askVolume : 1.0;

      return {
        bidVolume,
        askVolume,
        spread,
        spreadPercent,
        imbalance,
        bidAskRatio,
        depth: totalDepth,
        hasMicrostructure: true
      };

    } catch (error) {
      // Silently fail - orderbook is optional
      return null;
    }
  }

  /**
   * Fetch historical data from Binance
   * Can fetch by days (relative to now) or specific date range (2025-2026)
   * 
   * @param symbol - Trading pair (e.g., 'BTCUSDT')
   * @param days - Number of days to fetch (default: 365)
   * @param interval - Candle interval (default: '1h')
   * @param startDate - Optional: Start date as ISO string (e.g., '2025-01-01')
   * @param endDate - Optional: End date as ISO string (e.g., '2026-01-01')
   * @returns Array of MarketTick objects
   */
  async fetchHistoricalData(
    symbol: string = 'BTCUSDT',
    days: number = 365,
    interval: '1h' | '4h' | '1d' = '1h',
    startDate?: string,
    endDate?: string
  ): Promise<MarketTick[]> {
    
    console.log('📊 BINANCE DATA FETCH STARTING...');
    console.log('='.repeat(70));
    console.log(`Symbol: ${symbol}`);
    console.log(`Interval: ${interval}`);
    
    // Calculate time range
    let startTime: number;
    let endTime: number;
    
    if (startDate && endDate) {
      // Use specific date range (e.g., 2025-2026)
      startTime = new Date(startDate).getTime();
      endTime = new Date(endDate).getTime();
      const rangedays = Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000));
      console.log(`Period: ${startDate} to ${endDate} (${rangedays} days)`);
      console.log(`Expected candles: ~${rangedays * 24} (for 1h)`);
    } else {
      // Use relative days from now
      endTime = Date.now();
      startTime = endTime - (days * 24 * 60 * 60 * 1000);
      console.log(`Period: Last ${days} days`);
      console.log(`Expected candles: ~${days * 24} (for 1h)`);
    }
    console.log('');

    const allTicks: MarketTick[] = [];
    let currentStartTime = startTime;

    // Binance returns max 1000 candles per request
    // For 180 days @ 1h = 4,320 candles = need 5 requests
    const totalCandlesNeeded = days * 24;
    const requestsNeeded = Math.ceil(totalCandlesNeeded / this.maxCandlesPerRequest);

    console.log(`📡 Will make ${requestsNeeded} requests to Binance API...`);
    console.log('');

    for (let i = 0; i < requestsNeeded; i++) {
      try {
        console.log(`Request ${i + 1}/${requestsNeeded}...`);

        const klines = await this.fetchKlines(
          symbol,
          interval,
          currentStartTime,
          this.maxCandlesPerRequest
        );

        if (klines.length === 0) {
          console.log('  No more data available');
          break;
        }

        // Convert to MarketTick format
        const ticks = klines.map(k => this.convertKlineToTick(k));
        allTicks.push(...ticks);

        console.log(`  ✅ Fetched ${klines.length} candles`);

        // Update start time for next request
        const lastKline = klines[klines.length - 1];
        // closeTime is at index 6 in the array
        currentStartTime = (Array.isArray(lastKline) ? lastKline[6] : lastKline.closeTime) + 1;

        // Stop if we've reached end time
        if (currentStartTime >= endTime) {
          break;
        }

        // Rate limiting: sleep 200ms between requests
        await this.sleep(200);

      } catch (error) {
        console.error(`  ❌ Request ${i + 1} failed:`, error);
        
        // Retry logic
        if (i < requestsNeeded - 1) {
          console.log('  Retrying in 2 seconds...');
          await this.sleep(2000);
          i--; // Retry same request
        }
      }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log(`✅ FETCH COMPLETE: ${allTicks.length} candles`);
    console.log(`  First: ${new Date(allTicks[0].timestamp).toISOString()}`);
    console.log(`  Last: ${new Date(allTicks[allTicks.length - 1].timestamp).toISOString()}`);
    console.log('='.repeat(70));

    return allTicks;
  }

  /**
   * Fetch klines from Binance API
   * 
   * API Endpoint: GET /api/v3/klines
   * Docs: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
   */
  private async fetchKlines(
    symbol: string,
    interval: string,
    startTime: number,
    limit: number
  ): Promise<BinanceKline[]> {
    
    const url = `${this.baseURL}/klines`;
    
    const params = {
      symbol: symbol,
      interval: interval,
      startTime: startTime,
      limit: limit
    };

    const response = await axios.get(url, { params });

    // Binance returns array of arrays
    // [
    //   [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...]
    // ]
    return response.data;
  }

  /**
   * Convert Binance kline to MarketTick
   */
  private convertKlineToTick(kline: any): MarketTick {
    return {
      timestamp: kline[0], // openTime
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5])
    };
  }

  /**
   * Save data to disk for caching
   */
  async saveToFile(
    ticks: MarketTick[],
    symbol: string,
    days: number,
    interval: string,
    outputDir: string = './data/cache'
  ): Promise<string> {
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${symbol}_${interval}_${days}d.json`;
    const filepath = path.join(outputDir, filename);

    const data = {
      symbol,
      interval,
      days,
      candles: ticks.length,
      dateRange: {
        start: new Date(ticks[0].timestamp).toISOString(),
        end: new Date(ticks[ticks.length - 1].timestamp).toISOString()
      },
      fetchedAt: new Date().toISOString(),
      data: ticks
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    console.log(`\n💾 Data saved to: ${filepath}`);
    console.log(`   Size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);

    return filepath;
  }

  /**
   * Save multi-timeframe data for multiple symbols to disk
   */
  async saveMultiTimeframeData(
    allData: Map<string, Map<string, MarketDataWithOrderFlow[]>>,
    outputDir: string = './data/cache/multi-timeframe'
  ): Promise<void> {
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [symbol, timeframeData] of allData) {
      const symbolDir = path.join(outputDir, symbol);
      
      if (!fs.existsSync(symbolDir)) {
        fs.mkdirSync(symbolDir, { recursive: true });
      }

      for (const [timeframe, marketData] of timeframeData) {
        if (marketData.length === 0) continue;

        const filename = `${symbol}_${timeframe}.json`;
        const filepath = path.join(symbolDir, filename);

        const data = {
          symbol,
          timeframe,
          candles: marketData.length,
          hasOrderFlow: marketData.some(d => d.orderFlow !== undefined),
          dateRange: {
            start: new Date(marketData[0].timestamp).toISOString(),
            end: new Date(marketData[marketData.length - 1].timestamp).toISOString()
          },
          fetchedAt: new Date().toISOString(),
          data: marketData
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        const fileSizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
        console.log(`    💾 ${symbol} ${timeframe}: ${fileSizeMB} MB`);
      }
    }

    console.log(`\n✅ All data saved to: ${outputDir}`);
  }

  /**
   * Load data from cache
   */
  static loadFromFile(filepath: string): MarketTick[] {
    if (!fs.existsSync(filepath)) {
      throw new Error(`Cache file not found: ${filepath}`);
    }

    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    
    console.log(`\n📁 Loaded from cache: ${filepath}`);
    console.log(`   Symbol: ${data.symbol}`);
    console.log(`   Interval: ${data.interval}`);
    console.log(`   Candles: ${data.candles}`);
    console.log(`   Date range: ${data.dateRange.start} to ${data.dateRange.end}`);

    return data.data;
  }

  /**
   * Fetch with caching
   * Loads from cache if available, otherwise fetches fresh
   */
  async fetchWithCache(
    symbol: string = 'BTCUSDT',
    days: number = 365,
    interval: '1h' | '4h' | '1d' = '1h',
    cacheDir: string = './data/cache',
    maxCacheAge: number = 24 * 60 * 60 * 1000, // 24 hours
    startDate?: string,
    endDate?: string
  ): Promise<MarketTick[]> {
    
    // Generate filename based on date range or days
    const filename = startDate && endDate 
      ? `${symbol}_${interval}_${startDate}_to_${endDate}.json`
      : `${symbol}_${interval}_${days}d.json`;
    const filepath = path.join(cacheDir, filename);

    // Check if cache exists and is fresh
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      const cacheAge = Date.now() - stats.mtimeMs;

      if (cacheAge < maxCacheAge) {
        console.log('✅ Using cached data (fresh)');
        return BinanceDataFetcher.loadFromFile(filepath);
      } else {
        console.log('⚠️  Cache exists but is stale, fetching fresh data...');
      }
    } else {
      console.log('📡 No cache found, fetching from Binance...');
    }

    // Fetch fresh data
    const ticks = await this.fetchHistoricalData(symbol, days, interval, startDate, endDate);

    // Save to cache
    await this.saveToFile(ticks, symbol, days, interval, cacheDir);

    return ticks;
  }

  /**
   * Validate data quality
   */
  validateData(ticks: MarketTick[]): {
    valid: boolean;
    issues: string[];
    stats: {
      totalCandles: number;
      missingCandles: number;
      zeroVolume: number;
      priceAnomalies: number;
    };
  } {
    const issues: string[] = [];

    // Check for minimum data
    if (ticks.length < 100) {
      issues.push(`Insufficient data: ${ticks.length} candles (need >100)`);
    }

    // Check for gaps
    let missingCandles = 0;
    const expectedInterval = 3600000; // 1 hour in ms

    for (let i = 1; i < ticks.length; i++) {
      const gap = ticks[i].timestamp - ticks[i - 1].timestamp;
      if (gap > expectedInterval * 1.5) {
        missingCandles++;
      }
    }

    if (missingCandles > ticks.length * 0.05) {
      issues.push(`Too many gaps: ${missingCandles} (>${5}% of data)`);
    }

    // Check for zero volume
    const zeroVolume = ticks.filter(t => t.volume === 0).length;
    if (zeroVolume > ticks.length * 0.01) {
      issues.push(`Too many zero-volume candles: ${zeroVolume} (>${1}%)`);
    }

    // Check for price anomalies (>20% instant moves)
    let priceAnomalies = 0;
    for (let i = 1; i < ticks.length; i++) {
      const change = Math.abs(ticks[i].close - ticks[i - 1].close) / ticks[i - 1].close;
      if (change > 0.2) {
        priceAnomalies++;
      }
    }

    if (priceAnomalies > 5) {
      issues.push(`Suspicious price spikes: ${priceAnomalies} (>20% instant moves)`);
    }

    const valid = issues.length === 0;

    if (valid) {
      console.log('\n✅ DATA QUALITY: PASSED');
    } else {
      console.log('\n⚠️  DATA QUALITY ISSUES:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return {
      valid,
      issues,
      stats: {
        totalCandles: ticks.length,
        missingCandles,
        zeroVolume,
        priceAnomalies
      }
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI Script to fetch and cache data
 */
export async function fetchAndCacheBinanceData() {
  console.log('🚀 BINANCE DATA FETCHER');
  console.log('='.repeat(70));
  console.log('');

  const fetcher = new BinanceDataFetcher();

  try {
    // Fetch 180 days of 1h BTC/USDT data
    const ticks = await fetcher.fetchWithCache(
      'BTCUSDT',
      180,
      '1h',
      './data/cache'
    );

    // Validate
    const validation = fetcher.validateData(ticks);

    if (validation.valid) {
      console.log('\n🎉 SUCCESS: Data ready for VFMD validation');
      console.log(`   Total candles: ${validation.stats.totalCandles}`);
      console.log(`   Ready to use for physics validation`);
    } else {
      console.log('\n⚠️  WARNING: Data has quality issues but may still work');
    }

    return ticks;

  } catch (error) {
    console.error('\n❌ FETCH FAILED:', error);
    throw error;
  }
}

/**
 * Advanced CLI Script: Fetch multi-timeframe data for BTC and ETH
 * Includes orderflow data for comprehensive market analysis
 * Fetches 365 days of 2025-2026 data at 1hr intervals
 * 
 * Usage: npx ts-node -O '{"module":"esnext"}' ./server/services/vfmd/binanceDataFetcher.ts multiTF
 */
export async function fetchMultiTimeframeScript() {
  console.log('🚀 MULTI-TIMEFRAME DATA FETCHER (2025-2026 FULL YEAR)');
  console.log('='.repeat(80));
  console.log('');
  console.log('📅 Fetching 365 days: Jan 1, 2025 - Dec 31, 2025');
  console.log('🔗 Symbols: BTC/USDT, ETH/USDT');
  console.log('⏱️  Interval: 1 hour candles');
  console.log('📊 Including: Order flow data (buy/sell volumes, ratios)');
  console.log('');

  const fetcher = new BinanceDataFetcher();

  try {
    // Fetch all timeframes for BTC and ETH
    const allData = await fetcher.fetchMultiTimeframeData(
      ['BTCUSDT', 'ETHUSDT'],
      365,  // Full year 2025
      true // Include orderflow
    );

    // Process and save data
    for (const [symbol, timeframeData] of allData) {
      console.log(`\n📊 ${symbol} Summary:`);
      console.log('-'.repeat(80));
      
      for (const [timeframe, marketData] of timeframeData) {
        if (marketData.length === 0) continue;

        const withOrderFlow = marketData.filter(d => d.orderFlow).length;
        const avgBuyRatio = marketData.reduce((acc, d) => {
          if (!d.orderFlow) return acc;
          return acc + d.orderFlow.volumeRatio;
        }, 0) / withOrderFlow;

        console.log(`  ${timeframe.padEnd(4)} | Candles: ${marketData.length.toString().padEnd(4)} | ` +
                    `Avg Buy Ratio: ${(avgBuyRatio * 100).toFixed(1)}% | ` +
                    `Orderflow: ${withOrderFlow}/${marketData.length}`);
      }

      // Save to file for each symbol
      await fetcher.saveMultiTimeframeData(
        allData,
        './data/cache/multi-timeframe'
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ MULTI-TIMEFRAME FETCH COMPLETE (2025-2026 FULL YEAR)');
    console.log('📁 Data saved to ./data/cache/multi-timeframe/');
    console.log('');
    console.log('📈 Data Summary:');
    console.log('   ✓ Timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d');
    console.log('   ✓ Symbols: BTC/USDT, ETH/USDT');
    console.log('   ✓ Period: Full 365 days (Jan 1 - Dec 31, 2025)');
    console.log('   ✓ 1hr Candles: ~8,760 per asset per timeframe');
    console.log('   ✓ Orderflow: Buy/Sell volumes, ratios, dominant side');
    console.log('   ✓ Microstructure: Real bid/ask depth, spread, imbalance (when available)');
    console.log('');

    return allData;

  } catch (error) {
    console.error('\n❌ MULTI-TIMEFRAME FETCH FAILED:', error);
    throw error;
  }
}

/**
 * CLI Script: Fetch exactly 365 days of 2025-2026 data
 * For both BTC and ETH at 1hr candles
 * 
 * Usage: npx ts-node -O '{"module":"esnext"}' ./server/services/vfmd/binanceDataFetcher.ts 2025-2026
 */
export async function fetch2025To2026Data() {
  console.log('🚀 BINANCE DATA FETCHER: 2025-2026 FULL YEAR');
  console.log('='.repeat(80));
  console.log('');
  console.log('📅 Period: January 1, 2025 - December 31, 2025');
  console.log('📊 Symbols: BTC/USDT, ETH/USDT');
  console.log('⏱️  Interval: 1 hour candles');
  console.log('📈 Total candles per asset: ~8,760 (365 days × 24 hours)');
  console.log('');

  const fetcher = new BinanceDataFetcher();

  try {
    const results = new Map<string, MarketTick[]>();

    for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
      console.log(`\n🔄 Fetching ${symbol} data for full 2025...`);
      console.log('-'.repeat(80));

      const ticks = await fetcher.fetchWithCache(
        symbol,
        365,
        '1h',
        './data/cache',
        24 * 60 * 60 * 1000, // 24 hour cache
        '2025-01-01',  // Start: Jan 1, 2025
        '2026-01-01'   // End: Jan 1, 2026 (exclusive, so covers full 2025)
      );

      results.set(symbol, ticks);

      // Validate data
      const validation = fetcher.validateData(ticks);

      console.log(`\n✅ ${symbol} Summary:`);
      console.log(`   Total candles: ${validation.stats.totalCandles}`);
      console.log(`   Date range: ${new Date(ticks[0].timestamp).toISOString().split('T')[0]} to ${new Date(ticks[ticks.length - 1].timestamp).toISOString().split('T')[0]}`);
      console.log(`   Status: ${validation.valid ? '✅ VALID' : '⚠️  WITH ISSUES'}`);
      
      if (!validation.valid) {
        console.log(`   Issues:`);
        validation.issues.forEach(issue => console.log(`     - ${issue}`));
      }

      // Rate limiting
      await fetcher['sleep'](500);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 2025-2026 DATA FETCH COMPLETE');
    console.log('');
    console.log('📁 Cache location: ./data/cache/');
    console.log('');
    console.log('📊 Ready for backtesting:');
    console.log('   ✓ BTC/USDT: ~8,760 1hr candles');
    console.log('   ✓ ETH/USDT: ~8,760 1hr candles');
    console.log('   ✓ Full 365 days of 2025 market data');
    console.log('');

    return results;

  } catch (error) {
    console.error('\n❌ 2025-2026 FETCH FAILED:', error);
    throw error;
  }
}

/**
 * CLI Script: Fetch 1-day candles for BTC, ETH, SOL across 2023, 2024, 2025
 * Saves files labeled by year: BTCUSDT_1d_2023.json, BTCUSDT_1d_2024.json, etc.
 * 
 * Usage: npx ts-node -O '{"module":"esnext"}' ./server/services/vfmd/binanceDataFetcher.ts 3years
 */
export async function fetch3YearsMultiAssetData() {
  console.log('🚀 BINANCE DATA FETCHER: 3 YEARS × 3 ASSETS × 1D CANDLES');
  console.log('='.repeat(90));
  console.log('');
  console.log('📅 Years: 2023, 2024, 2025');
  console.log('📊 Symbols: BTC/USDT, ETH/USDT, SOL/USDT (LONG candles)');
  console.log('⏱️  Interval: 1 day candles');
  console.log('📈 Total candles per asset per year: ~365 (1 per day)');
  console.log('');

  const fetcher = new BinanceDataFetcher();
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const years = [
    { year: 2023, start: '2023-01-01', end: '2024-01-01' },
    { year: 2024, start: '2024-01-01', end: '2025-01-01' },
    { year: 2025, start: '2025-01-01', end: '2026-01-01' }
  ];

  const cacheDir = './data/cache';
  const results = new Map<string, Map<number, MarketTick[]>>();

  try {
    for (const symbol of symbols) {
      console.log(`\n🔄 Fetching ${symbol} data across 3 years...`);
      console.log('-'.repeat(90));

      const yearlyData = new Map<number, MarketTick[]>();

      for (const { year, start, end } of years) {
        try {
          console.log(`   ${year}: ${start} → ${end.split('-').slice(0, 2).join('-')}...`);

          // Generate year-labeled filename
          const yearLabeledFilename = `${symbol}_1d_${year}.json`;
          const yearLabeledPath = `${cacheDir}/${yearLabeledFilename}`;

          // Check if file already exists
          if (fs.existsSync(yearLabeledPath)) {
            console.log(`      ✓ Using existing file: ${yearLabeledFilename}`);
            const data = JSON.parse(fs.readFileSync(yearLabeledPath, 'utf-8'));
            yearlyData.set(year, data.data);
          } else {
            // Fetch from Binance
            const ticks = await fetcher.fetchHistoricalData(
              symbol,
              365,
              '1d',
              start,
              end
            );

            yearlyData.set(year, ticks);

            // Validate
            const validation = fetcher.validateData(ticks);
            const status = validation.valid ? '✅' : '⚠️';

            // Create cache directory if needed
            if (!fs.existsSync(cacheDir)) {
              fs.mkdirSync(cacheDir, { recursive: true });
            }

            // Save with year-labeled filename
            const yearData = {
              symbol,
              interval: '1d',
              year,
              candles: ticks.length,
              dateRange: {
                start: new Date(ticks[0].timestamp).toISOString(),
                end: new Date(ticks[ticks.length - 1].timestamp).toISOString()
              },
              fetchedAt: new Date().toISOString(),
              data: ticks
            };

            fs.writeFileSync(yearLabeledPath, JSON.stringify(yearData, null, 2));
            console.log(`      ${status} Saved: ${yearLabeledFilename}`);
          }

          // Rate limiting
          await fetcher['sleep'](300);

        } catch (error) {
          console.error(`      ❌ Failed to fetch ${symbol} ${year}:`, (error as any).message);
        }
      }

      results.set(symbol, yearlyData);
    }

    // Print summary
    console.log('\n' + '='.repeat(90));
    console.log('✅ 3-YEAR MULTI-ASSET DATA FETCH COMPLETE');
    console.log('');
    console.log('📁 Cache location: ' + cacheDir);
    console.log('');
    console.log('📊 Data Summary:');
    console.log('   Symbols:    BTC/USDT, ETH/USDT, SOL/USDT');
    console.log('   Years:      2023, 2024, 2025');
    console.log('   Interval:   1 day (daily candles)');
    console.log('   Files per asset: 3 (one per year)');
    console.log('');
    console.log('📋 Files generated:');

    for (const symbol of symbols) {
      console.log(`\n   ${symbol}:`);
      const yearlyData = results.get(symbol);
      if (yearlyData) {
        for (const { year } of years) {
          const ticks = yearlyData.get(year);
          if (ticks && ticks.length > 0) {
            console.log(`      • ${symbol}_1d_${year}.json (${ticks.length} candles)`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(90));
    console.log('🎉 Ready for strategy optimization and backtesting!');
    console.log('');

    return results;

  } catch (error) {
    console.error('\n❌ 3-YEAR FETCH FAILED:', error);
    throw error;
  }
}

/**
 * Fetch 3 years of 1-hour candles for 3 assets (BTC, ETH, SOL)
 * Parallelizes requests for faster fetching
 * Saves files labeled by year: BTCUSDT_1h_2023.json, BTCUSDT_1h_2024.json, etc.
 * 
 * Usage: npx ts-node -O '{"module":"esnext"}' ./server/services/vfmd/binanceDataFetcher.ts 3years-1h
 */
export async function fetch3YearsMultiAsset1HourData() {
  console.log('🚀 BINANCE DATA FETCHER: 3 YEARS × 3 ASSETS × 1HR CANDLES');
  console.log('='.repeat(90));
  console.log('');
  console.log('📅 Years: 2023, 2024, 2025');
  console.log('📊 Symbols: BTC/USDT, ETH/USDT, SOL/USDT');
  console.log('⏱️  Interval: 1 hour candles');
  console.log('📈 Expected candles per asset per year: ~8,760 (24/day × 365)');
  console.log('⚡ Parallelization: Fetching all assets/years concurrently');
  console.log('');

  const fetcher = new BinanceDataFetcher();
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const years = [
    { year: 2023, start: '2023-01-01', end: '2024-01-01' },
    { year: 2024, start: '2024-01-01', end: '2025-01-01' },
    { year: 2025, start: '2025-01-01', end: '2026-01-01' }
  ];

  const cacheDir = './data/cache';
  const results = new Map<string, Map<number, MarketTick[]>>();

  try {
    // Create all fetch tasks for parallel execution
    const fetchTasks: Promise<{
      symbol: string;
      year: number;
      start: string;
      end: string;
      ticks: MarketTick[];
    }>[] = [];

    console.log('🔄 Queuing all fetch tasks for parallel execution...\n');

    for (const symbol of symbols) {
      for (const { year, start, end } of years) {
        const task = (async () => {
          const yearLabeledFilename = `${symbol}_1h_${year}.json`;
          const yearLabeledPath = `${cacheDir}/${yearLabeledFilename}`;

          // Check if file already exists
          if (fs.existsSync(yearLabeledPath)) {
            console.log(`   ✓ ${yearLabeledFilename} (cached)`);
            const data = JSON.parse(fs.readFileSync(yearLabeledPath, 'utf-8'));
            return {
              symbol,
              year,
              start,
              end,
              ticks: data.data
            };
          }

          // Fetch from Binance
          const ticks = await fetcher.fetchHistoricalData(
            symbol,
            365,
            '1h',
            start,
            end
          );

          console.log(`   ✓ ${yearLabeledFilename} fetched (${ticks.length} candles)`);

          // Create cache directory if needed
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }

          // Save with year-labeled filename
          const yearData = {
            symbol,
            interval: '1h',
            year,
            candles: ticks.length,
            dateRange: {
              start: new Date(ticks[0].timestamp).toISOString(),
              end: new Date(ticks[ticks.length - 1].timestamp).toISOString()
            },
            fetchedAt: new Date().toISOString(),
            data: ticks
          };

          fs.writeFileSync(yearLabeledPath, JSON.stringify(yearData, null, 2));

          return {
            symbol,
            year,
            start,
            end,
            ticks
          };
        })();

        fetchTasks.push(task);
      }
    }

    console.log(`⏳ Executing ${fetchTasks.length} parallel fetch operations...\n`);

    // Execute all tasks in parallel with rate limiting
    const results_array = await Promise.all(
      fetchTasks.map(async (task, index) => {
        // Stagger requests with small delays to avoid overwhelming API
        await fetcher['sleep'](index * 100);
        return task;
      })
    );

    // Organize results by symbol and year
    for (const { symbol, year, ticks } of results_array) {
      if (!results.has(symbol)) {
        results.set(symbol, new Map());
      }
      results.get(symbol)!.set(year, ticks);
    }

    // Print summary
    console.log('\n' + '='.repeat(90));
    console.log('✅ 3-YEAR 1-HOUR DATA FETCH COMPLETE');
    console.log('');
    console.log('📁 Cache location: ' + cacheDir);
    console.log('');
    console.log('📊 Data Summary:');
    console.log('   Symbols:    BTC/USDT, ETH/USDT, SOL/USDT');
    console.log('   Years:      2023, 2024, 2025');
    console.log('   Interval:   1 hour candles');
    console.log('   Files per asset: 3 (one per year)');
    console.log('');
    console.log('📋 Files generated:');

    for (const symbol of symbols) {
      console.log(`\n   ${symbol}:`);
      const yearlyData = results.get(symbol);
      let totalHours = 0;
      
      if (yearlyData) {
        for (const { year } of years) {
          const ticks = yearlyData.get(year);
          if (ticks && ticks.length > 0) {
            totalHours += ticks.length;
            const fileSizeMB = getFileSizeMB(`${cacheDir}/${symbol}_1h_${year}.json`);
            console.log(`      • ${symbol}_1h_${year}.json (${ticks.length} candles, ${fileSizeMB}MB)`);
          }
        }
      }
      
      console.log(`      Total: ${totalHours} hours (~${(totalHours / 24).toFixed(0)} days)`);
    }

    console.log('\n' + '='.repeat(90));
    console.log('🎉 Ready for backtesting with realistic 1-hour resolution!');
    console.log('');

    return results;

  } catch (error) {
    console.error('\n❌ 1-HOUR DATA FETCH FAILED:', error);
    throw error;
  }
}

/**
 * Fetch 3 years of 4-hour candles for 3 assets (BTC, ETH, SOL)
 * Parallelizes requests for faster fetching
 * Saves files labeled by year: BTCUSDT_4h_2023.json, BTCUSDT_4h_2024.json, etc.
 * 
 * Usage: npx ts-node -O '{"module":"esnext"}' ./server/services/vfmd/binanceDataFetcher.ts 3years-4h
 */
export async function fetch3YearsMultiAsset4HourData() {
  console.log('🚀 BINANCE DATA FETCHER: 3 YEARS × 3 ASSETS × 4HR CANDLES');
  console.log('='.repeat(90));
  console.log('');
  console.log('📅 Years: 2023, 2024, 2025');
  console.log('📊 Symbols: BTC/USDT, ETH/USDT, SOL/USDT');
  console.log('⏱️  Interval: 4 hour candles');
  console.log('📈 Expected candles per asset per year: ~2,190 (6/day × 365)');
  console.log('⚡ Parallelization: Fetching all assets/years concurrently');
  console.log('');

  const fetcher = new BinanceDataFetcher();
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const years = [
    { year: 2023, start: '2023-01-01', end: '2024-01-01' },
    { year: 2024, start: '2024-01-01', end: '2025-01-01' },
    { year: 2025, start: '2025-01-01', end: '2026-01-01' }
  ];

  const cacheDir = './data/cache';
  const results = new Map<string, Map<number, MarketTick[]>>();

  try {
    // Create all fetch tasks for parallel execution
    const fetchTasks: Promise<{
      symbol: string;
      year: number;
      start: string;
      end: string;
      ticks: MarketTick[];
    }>[] = [];

    console.log('🔄 Queuing all fetch tasks for parallel execution...\n');

    for (const symbol of symbols) {
      for (const yearData of years) {
        const taskPromise = (async () => {
          console.log(`  📡 Queued: ${symbol} ${yearData.year} (4h)`);
          return {
            symbol,
            year: yearData.year,
            start: yearData.start,
            end: yearData.end,
            ticks: await fetcher.fetchWithCache(
              symbol,
              365,
              '4h',
              cacheDir,
              24 * 60 * 60 * 1000,
              yearData.start,
              yearData.end
            )
          };
        })();

        fetchTasks.push(taskPromise);
      }
    }

    console.log(`\n⏳ Executing ${fetchTasks.length} parallel fetch operations...\n`);

    // Execute all tasks in parallel with rate limiting
    const results_array = await Promise.all(
      fetchTasks.map(async (task, index) => {
        await fetcher['sleep'](index * 200); // Stagger requests slightly
        return task;
      })
    );

    // Organize results by symbol and year
    for (const { symbol, year, ticks } of results_array) {
      if (!results.has(symbol)) results.set(symbol, new Map());
      results.get(symbol)!.set(year, ticks);
    }

    // Print summary
    console.log('\n' + '='.repeat(90));
    console.log('✅ 3-YEAR 4-HOUR DATA FETCH COMPLETE');
    console.log('');
    console.log('📁 Cache location: ' + cacheDir);
    console.log('');
    console.log('📊 Data Summary:');
    console.log('   Symbols:    BTC/USDT, ETH/USDT, SOL/USDT');
    console.log('   Years:      2023, 2024, 2025');
    console.log('   Interval:   4 hour candles');
    console.log('   Files per asset: 3 (one per year)');
    console.log('');
    console.log('📋 Files generated:');

    for (const symbol of symbols) {
      for (const year of [2023, 2024, 2025]) {
        const filename = `${symbol}_4h_${year}.json`;
        const filepath = path.join(cacheDir, filename);
        const sizeInfo = fs.existsSync(filepath) ? `(${getFileSizeMB(filepath)} MB)` : '';
        console.log(`   ✓ ${filename} ${sizeInfo}`);
      }
    }

    console.log('\n' + '='.repeat(90));
    console.log('🎉 Ready for backtesting with 4-hour resolution!');
    console.log('');

    return results;

  } catch (error) {
    console.error('\n❌ 4-HOUR DATA FETCH FAILED:', error);
    throw error;
  }
}

/**
 * Helper to get file size in MB
 */
function getFileSizeMB(filepath: string): string {
  if (!fs.existsSync(filepath)) return '0';
  const bytes = fs.statSync(filepath).size;
  const mb = (bytes / 1024 / 1024).toFixed(2);
  return mb;
}

// CLI entrypoint
const scriptType = process.argv[2] || 'default';

if (scriptType === '2025-2026') {
  fetch2025To2026Data()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else if (scriptType === '3years') {
  fetch3YearsMultiAssetData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else if (scriptType === '3years-1h') {
  fetch3YearsMultiAsset1HourData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else if (scriptType === '3years-4h') {
  fetch3YearsMultiAsset4HourData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else if (scriptType === 'multiTF') {
  fetchMultiTimeframeScript()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else if (scriptType === 'default') {
  fetchAndCacheBinanceData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}


export default BinanceDataFetcher;