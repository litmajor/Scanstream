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
 * Fetch OHLC chart data from CoinGecko
 * GET /api/coingecko/chart/:coinId
 * Query params:
 *   - days: number of days (1, 7, 14, 30, 90, 180, 365, max)
 *   - vs_currency: currency (default: usd)
 */
router.get('/api/coingecko/chart/:coinId', async (req: Request, res: Response) => {
  try {
    const { coinId } = req.params;
    const days = req.query.days || '7';
    const vsCurrency = req.query.vs_currency || 'usd';
    
    const cacheKey = `${coinId}-${days}-${vsCurrency}`;
    
    // Check cache first
    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[CoinGecko Chart] Cache hit for ${cacheKey}`);
      return res.json(cached.data);
    }
    
    console.log(`[CoinGecko Chart] Fetching chart data for ${coinId} (${days} days)`);
    
    // Fetch OHLC data from CoinGecko
    const response = await axios.get(
      `${COINGECKO_API}/coins/${coinId}/ohlc`,
      {
        params: {
          vs_currency: vsCurrency,
          days
        },
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const ohlcData = response.data;
    
    // Transform CoinGecko format to our chart format
    // CoinGecko returns: [[timestamp, open, high, low, close], ...]
    const chartData = ohlcData.map((candle: number[]) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: null // CoinGecko OHLC doesn't include volume
    }));
    
    const result = {
      success: true,
      coinId,
      vsCurrency,
      days,
      dataPoints: chartData.length,
      data: chartData,
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
 * Clear chart cache (for testing/debugging)
 * POST /api/coingecko/chart/clear-cache
 */
router.post('/api/coingecko/chart/clear-cache', (req: Request, res: Response) => {
  chartCache.clear();
  res.json({ success: true, message: 'Chart cache cleared' });
});

export default router;

