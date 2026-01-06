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
import { MarketTick } from './types';
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

export class BinanceDataFetcher {
  private baseURL = 'https://api.binance.com/api/v3';
  private maxCandlesPerRequest = 1000; // Binance limit

  /**
   * Fetch 180 days of 1-hour BTC/USDT data from Binance
   * 
   * @param symbol - Trading pair (e.g., 'BTCUSDT')
   * @param days - Number of days to fetch (default: 180)
   * @param interval - Candle interval (default: '1h')
   * @returns Array of MarketTick objects
   */
  async fetchHistoricalData(
    symbol: string = 'BTCUSDT',
    days: number = 180,
    interval: '1h' | '4h' | '1d' = '1h'
  ): Promise<MarketTick[]> {
    
    console.log('📊 BINANCE DATA FETCH STARTING...');
    console.log('='.repeat(70));
    console.log(`Symbol: ${symbol}`);
    console.log(`Period: ${days} days`);
    console.log(`Interval: ${interval}`);
    console.log(`Expected candles: ~${days * 24} (for 1h)`);
    console.log('');

    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);

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
    days: number = 180,
    interval: '1h' | '4h' | '1d' = '1h',
    cacheDir: string = './data/cache',
    maxCacheAge: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<MarketTick[]> {
    
    const filename = `${symbol}_${interval}_${days}d.json`;
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
    const ticks = await this.fetchHistoricalData(symbol, days, interval);

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

// Run if called directly (ESM version)
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchAndCacheBinanceData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default BinanceDataFetcher;