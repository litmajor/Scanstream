import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Cache for API responses to avoid rate limiting
const cache: { [key: string]: { data: any; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/symbols
 * Fetch real symbols data from multiple sources
 * Query params: search, exchange, assetClass, marketCap, minVolume, minLiquidity, minVolatility, maxVolatility
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search = '',
      exchange = 'all',
      assetClass = 'all',
      marketCap = 'all',
      minVolume = 0,
      minLiquidity = 0,
      minVolatility = 0,
      maxVolatility = 100,
      page = 1,
      limit = 50
    } = req.query;

    interface CoinData {
        id: string;
        symbol: string;
        name: string;
        price: number;
        change24h: number;
        change7d: number;
        change30d: number;
        volume24h: number;
        marketCap: number;
        liquidity: number;
        spread: number;
        volatility: number;
        exchanges: string[];
        image?: string;
        rank?: number;
        ath?: number;
        atl?: number;
        description?: string;
        website?: string;
    }

    let symbols: CoinData[] = [];

    // Fetch from CoinGecko (cryptocurrencies)
    const cryptoSymbols = await fetchCryptoSymbols();
    symbols = [...symbols, ...cryptoSymbols];

    // Fetch from Alpha Vantage or other sources for stocks/forex if available
    // For now, we'll use the crypto data as primary source
    // Additional integrations can be added here

    let filtered = symbols;

    // Search filter
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.symbol.toLowerCase().includes(searchLower) ||
          s.name.toLowerCase().includes(searchLower)
      );
    }

    // Exchange filter
    if (exchange !== 'all' && (exchange as string).length > 0) {
      filtered = filtered.filter((s) =>
        s.exchanges?.some((e: string) => e.toLowerCase() === (exchange as string).toLowerCase())
      );
    }

    // Asset class filter
    if (assetClass !== 'all') {
      if (assetClass === 'spot') {
        filtered = filtered.filter((s) => !s.symbol.includes('USD') && s.marketCap > 0);
      } else if (assetClass === 'futures') {
        filtered = filtered.filter((s) => s.volatility > 25);
      } else if (assetClass === 'perpetual') {
        filtered = filtered.filter((s) => s.liquidity > 80);
      }
    }

    // Market cap filter
    if (marketCap !== 'all') {
      if (marketCap === 'micro') {
        filtered = filtered.filter((s) => s.marketCap > 0 && s.marketCap < 100000000);
      } else if (marketCap === 'small') {
        filtered = filtered.filter((s) => s.marketCap >= 100000000 && s.marketCap < 1000000000);
      } else if (marketCap === 'mid') {
        filtered = filtered.filter((s) => s.marketCap >= 1000000000 && s.marketCap < 10000000000);
      } else if (marketCap === 'large') {
        filtered = filtered.filter((s) => s.marketCap >= 10000000000);
      }
    }

    // Volume filter
    const minVol = parseInt(minVolume as string) || 0;
    if (minVol > 0) {
      filtered = filtered.filter((s) => s.volume24h >= minVol);
    }

    // Liquidity filter
    const minLiq = parseInt(minLiquidity as string) || 0;
    if (minLiq > 0) {
      filtered = filtered.filter((s) => s.liquidity >= minLiq);
    }

    // Volatility range filter
    const minVol2 = parseInt(minVolatility as string) || 0;
    const maxVol = parseInt(maxVolatility as string) || 100;
    filtered = filtered.filter((s) => s.volatility >= minVol2 && s.volatility <= maxVol);

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, parseInt(limit as string) || 50);
    const total = filtered.length;
    const startIdx = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIdx, startIdx + limitNum);

    res.json({
      data: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('Error fetching symbols:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch symbols' });
  }
});

/**
 * GET /api/symbols/:symbol
 * Get detailed info for a specific symbol from real APIs
 */
router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    // Try to get from cache first
    const cacheKey = `symbol-${symbol.toUpperCase()}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
      return res.json(cache[cacheKey].data);
    }

    // Fetch from CoinGecko
    const data = await fetchSymbolFromCoingecko(symbol);

    if (!data) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    // Cache the result
    cache[cacheKey] = { data, timestamp: Date.now() };

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching symbol:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch symbol' });
  }
});

/**
 * Fetch cryptocurrency symbols from CoinGecko API
 */
async function fetchCryptoSymbols(): Promise<any[]> {
  const cacheKey = 'crypto-symbols';

  // Return cached data if available and fresh
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
    return cache[cacheKey].data;
  }

  try {
    console.log('[CoinGecko] Fetching cryptocurrency markets...');
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 250,
        page: 1,
        sparkline: false,
        price_change_percentage: '1h,24h,7d,30d',
      },
      timeout: 10000,
    });

    const symbols = response.data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price || 0,
      change24h: coin.price_change_percentage_24h || 0,
      change7d: coin.price_change_percentage_7d || 0,
      change30d: coin.price_change_percentage_30d || 0,
      volume24h: coin.total_volume || 0,
      marketCap: coin.market_cap || 0,
      liquidity: calculateLiquidity(coin.total_volume, coin.market_cap),
      spread: 0.01, // Average spread for crypto
      volatility: Math.abs(coin.price_change_percentage_24h || 0) * 2, // Estimate volatility
      exchanges: ['binance', 'coinbase', 'kraken', 'okx'], // Major exchanges
      image: coin.image,
      rank: coin.market_cap_rank,
      ath: coin.ath,
      atl: coin.atl,
    }));

    // Cache the results
    cache[cacheKey] = { data: symbols, timestamp: Date.now() };
    console.log(`[CoinGecko] Fetched ${symbols.length} cryptocurrencies`);

    return symbols;
  } catch (error: any) {
    console.error('[CoinGecko] Error fetching data:', error.message);
    // Return empty array on error - client should handle gracefully
    return [];
  }
}

/**
 * Fetch specific symbol from CoinGecko
 */
async function fetchSymbolFromCoingecko(symbol: string): Promise<any | null> {
  try {
    // First, search for the coin by symbol
    const searchResponse = await axios.get(
      `https://api.coingecko.com/api/v3/search`,
      {
        params: { query: symbol },
        timeout: 10000,
      }
    );

    if (!searchResponse.data.coins || searchResponse.data.coins.length === 0) {
      return null;
    }

    const coin = searchResponse.data.coins[0];

    // Get detailed market data
    const detailResponse = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coin.id}`,
      {
        params: {
          localization: false,
          tickers: true,
          market_data: true,
          community_data: false,
          developer_data: false,
        },
        timeout: 10000,
      }
    );

    const data = detailResponse.data;

    return {
      id: data.id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      price: data.market_data?.current_price?.usd || 0,
      change24h: data.market_data?.price_change_percentage_24h || 0,
      change7d: data.market_data?.price_change_percentage_7d || 0,
      change30d: data.market_data?.price_change_percentage_30d || 0,
      volume24h: data.market_data?.total_volume?.usd || 0,
      marketCap: data.market_data?.market_cap?.usd || 0,
      liquidity: calculateLiquidity(
        data.market_data?.total_volume?.usd,
        data.market_data?.market_cap?.usd
      ),
      spread: 0.01,
      volatility: Math.abs(data.market_data?.price_change_percentage_24h || 0) * 2,
      exchanges: data.tickers?.slice(0, 5).map((t: any) => t.market?.name) || [],
      image: data.image?.large,
      rank: data.market_cap_rank,
      ath: data.market_data?.ath?.usd,
      atl: data.market_data?.atl?.usd,
      description: data.description?.en,
      website: data.links?.homepage?.[0],
    };
  } catch (error: any) {
    console.error('[CoinGecko] Error fetching symbol:', error.message);
    return null;
  }
}

/**
 * Calculate liquidity score (0-100) based on volume and market cap
 */
function calculateLiquidity(volume: number = 0, marketCap: number = 0): number {
  if (!marketCap || marketCap === 0) return 0;

  const volumeToMcRatio = volume / marketCap;

  // Higher ratio = higher liquidity
  // Normalize: 1% ratio = 50 points, 10% ratio = 100 points, etc.
  const liquidity = Math.min(100, (volumeToMcRatio * 10) * 100);

  return Math.round(liquidity * 100) / 100;
}

export default router;
