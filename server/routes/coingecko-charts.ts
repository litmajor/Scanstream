/**
 * CoinGecko Chart Data API
 * Provides OHLC candlestick data for trading terminal charts
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// CoinGecko API configuration
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache to respect rate limits
const chartCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Fetch extended OHLC chart data from CoinGecko for ML models
 * GET /api/coingecko/chart/:coinId
 * Query params:
 *   - days: number of days (1, 7, 14, 30, 90, 180, 365, max)
 *   - vs_currency: currency (default: usd)
 *   - extended: if true, fetch market_chart for volume data
 */
router.get('/api/coingecko/chart/:coinId', async (req: Request, res: Response) => {
  try {
    const { coinId } = req.params;
    const days = req.query.days || '90'; // Default to 90 days for 500+ points
    const vsCurrency = req.query.vs_currency || 'usd';
    const extended = req.query.extended === 'true';
    
    const cacheKey = `${coinId}-${days}-${vsCurrency}-${extended}`;
    
    // Check cache first
    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[CoinGecko Chart] Cache hit for ${cacheKey}`);
      return res.json(cached.data);
    }
    
    console.log(`[CoinGecko Chart] Fetching chart data for ${coinId} (${days} days, extended: ${extended})`);
    
    // Fetch OHLC data
    const ohlcResponse = await axios.get(
      `${COINGECKO_API}/coins/${coinId}/ohlc`,
      {
        params: {
          vs_currency: vsCurrency,
          days
        },
        headers: {
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );
    
    const ohlcData = ohlcResponse.data;
    
    // Fetch market chart for volume and additional data if extended
    let volumeData: any[] = [];
    let marketCapData: any[] = [];
    
    if (extended) {
      try {
        const marketChartResponse = await axios.get(
          `${COINGECKO_API}/coins/${coinId}/market_chart`,
          {
            params: {
              vs_currency: vsCurrency,
              days,
              interval: days === '1' ? 'hourly' : 'daily'
            },
            headers: {
              'Accept': 'application/json'
            },
            timeout: 15000
          }
        );
        
        volumeData = marketChartResponse.data.total_volumes || [];
        marketCapData = marketChartResponse.data.market_caps || [];
      } catch (volError) {
        console.warn('[CoinGecko Chart] Failed to fetch volume data:', volError);
      }
    }
    
    // Create volume lookup map
    const volumeMap = new Map(volumeData.map(v => [Math.floor(v[0] / 3600000) * 3600000, v[1]]));
    const marketCapMap = new Map(marketCapData.map(m => [Math.floor(m[0] / 3600000) * 3600000, m[1]]));
    
    // Transform data with volume and additional metrics
    const chartData = ohlcData.map((candle: number[]) => {
      const timestamp = candle[0];
      const roundedTimestamp = Math.floor(timestamp / 3600000) * 3600000;
      
      return {
        timestamp,
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: volumeMap.get(roundedTimestamp) || null,
        marketCap: marketCapMap.get(roundedTimestamp) || null,
        // ML-friendly features
        priceRange: candle[2] - candle[3],
        priceChange: candle[4] - candle[1],
        priceChangePercent: ((candle[4] - candle[1]) / candle[1]) * 100,
        upperShadow: candle[2] - Math.max(candle[1], candle[4]),
        lowerShadow: Math.min(candle[1], candle[4]) - candle[3],
        bodySize: Math.abs(candle[4] - candle[1]),
        isBullish: candle[4] > candle[1]
      };
    });
    
    const result = {
      success: true,
      coinId,
      vsCurrency,
      days,
      dataPoints: chartData.length,
      extended,
      data: chartData,
      metadata: {
        firstTimestamp: chartData[0]?.timestamp,
        lastTimestamp: chartData[chartData.length - 1]?.timestamp,
        hasVolume: extended && volumeData.length > 0,
        hasMarketCap: extended && marketCapData.length > 0,
        mlReady: true,
        features: [
          'open', 'high', 'low', 'close', 'volume', 'marketCap',
          'priceRange', 'priceChange', 'priceChangePercent',
          'upperShadow', 'lowerShadow', 'bodySize', 'isBullish'
        ]
      },
      cachedAt: Date.now()
    };
    
    // Cache the result
    chartCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    res.json(result);
    
  } catch (error: any) {
    console.error('[CoinGecko Chart] Error fetching chart data:', error.message);
    
    if (error.response?.status === 429) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Please wait a moment before requesting more data',
        retryAfter: 60
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch chart data',
        message: error.message
      });
    }
  }
});

/**
 * Get coin ID from symbol
 * GET /api/coingecko/coin-from-symbol/:symbol
 */
router.get('/api/coingecko/coin-from-symbol/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    
    // Common symbol to CoinGecko ID mappings
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'USDC': 'usd-coin',
      'ADA': 'cardano',
      'AVAX': 'avalanche-2',
      'DOGE': 'dogecoin',
      'DOT': 'polkadot',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'LTC': 'litecoin',
      'APT': 'aptos',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'INJ': 'injective-protocol',
      'SUI': 'sui',
      'TIA': 'celestia'
    };

    const cleanSymbol = symbol.replace('/USDT', '').replace('/USD', '').toUpperCase();
    const coinId = symbolMap[cleanSymbol];

    if (coinId) {
      res.json({ success: true, symbol: cleanSymbol, coinId });
    } else {
      res.json({ success: false, error: 'Symbol not found', symbol: cleanSymbol });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to map symbol',
      message: error.message
    });
  }
});

/**
 * Fetch multi-timeframe data for ML training
 * GET /api/coingecko/chart/:coinId/multi-timeframe
 * Returns 500+ data points across multiple timeframes
 */
router.get('/api/coingecko/chart/:coinId/multi-timeframe', async (req: Request, res: Response) => {
  try {
    const { coinId } = req.params;
    const vsCurrency = req.query.vs_currency || 'usd';
    
    const cacheKey = `multi-${coinId}-${vsCurrency}`;
    const cached = chartCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return res.json(cached.data);
    }
    
    console.log(`[CoinGecko Chart] Fetching multi-timeframe data for ${coinId}`);
    
    // Fetch multiple timeframes in parallel
    const timeframes = [
      { name: '1d', days: '1' },
      { name: '7d', days: '7' },
      { name: '30d', days: '30' },
      { name: '90d', days: '90' },
      { name: '180d', days: '180' },
      { name: '365d', days: '365' }
    ];
    
    const promises = timeframes.map(async (tf) => {
      try {
        const ohlcResponse = await axios.get(
          `${COINGECKO_API}/coins/${coinId}/ohlc`,
          {
            params: {
              vs_currency: vsCurrency,
              days: tf.days
            },
            headers: { 'Accept': 'application/json' },
            timeout: 15000
          }
        );
        
        const chartData = ohlcResponse.data.map((candle: number[]) => ({
          timestamp: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          priceRange: candle[2] - candle[3],
          priceChange: candle[4] - candle[1],
          priceChangePercent: ((candle[4] - candle[1]) / candle[1]) * 100,
          bodySize: Math.abs(candle[4] - candle[1]),
          isBullish: candle[4] > candle[1]
        }));
        
        return {
          timeframe: tf.name,
          dataPoints: chartData.length,
          data: chartData
        };
      } catch (error) {
        console.error(`[CoinGecko Chart] Failed to fetch ${tf.name}:`, error);
        return {
          timeframe: tf.name,
          dataPoints: 0,
          data: [],
          error: 'Failed to fetch'
        };
      }
    });
    
    const results = await Promise.all(promises);
    const totalDataPoints = results.reduce((sum, r) => sum + r.dataPoints, 0);
    
    const result = {
      success: true,
      coinId,
      vsCurrency,
      totalDataPoints,
      timeframes: results,
      mlReady: totalDataPoints >= 500,
      cachedAt: Date.now()
    };
    
    chartCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    res.json(result);
    
  } catch (error: any) {
    console.error('[CoinGecko Chart] Multi-timeframe error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch multi-timeframe data',
      message: error.message
    });
  }
});

/**
 * Clear chart cache (for testing/debugging)
 * POST /api/coingecko/chart/clear-cache
 */
router.post('/api/coingecko/chart/clear-cache', (req: Request, res: Response) => {
  chartCache.clear();
  res.json({ success: true, message: 'Chart cache cleared' });
});

export default router;
