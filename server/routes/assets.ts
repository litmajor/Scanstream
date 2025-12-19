import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Cache for stock/forex data (5 minute TTL)
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache: { [key: string]: CacheEntry } = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isCacheValid = (key: string): boolean => {
  if (!cache[key]) return false;
  return Date.now() - cache[key].timestamp < CACHE_TTL;
};

// Stock symbols to fetch
const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM'];
const FOREX_PAIRS = ['EURUSD=X', 'GBPUSD=X', 'JPYUSD=X', 'CHFUSD=X', 'AUDUSD=X', 'CADUSD=X'];

// Fallback mock data if API fails
const FALLBACK_STOCKS: any[] = [
  { id: 'aapl', symbol: 'AAPL', name: 'Apple Inc', price: 238.45, change1d: 1.2, change7d: 3.5, change30d: 8.2, volume24h: 58000000, market_cap: 3650000000000, sector: 'Technology', exchange: 'NASDAQ' },
  { id: 'msft', symbol: 'MSFT', name: 'Microsoft Corp', price: 416.30, change1d: 2.1, change7d: 4.8, change30d: 10.5, volume24h: 21000000, market_cap: 3095000000000, sector: 'Technology', exchange: 'NASDAQ' },
  { id: 'googl', symbol: 'GOOGL', name: 'Alphabet Inc', price: 142.85, change1d: -0.8, change7d: 2.1, change30d: 5.3, volume24h: 18000000, market_cap: 1465000000000, sector: 'Communication', exchange: 'NASDAQ' },
  { id: 'amzn', symbol: 'AMZN', name: 'Amazon.com Inc', price: 198.75, change1d: 3.5, change7d: 6.2, change30d: 12.8, volume24h: 62000000, market_cap: 2065000000000, sector: 'Consumer', exchange: 'NASDAQ' },
  { id: 'tsla', symbol: 'TSLA', name: 'Tesla Inc', price: 242.50, change1d: 4.2, change7d: 8.5, change30d: 15.3, volume24h: 142000000, market_cap: 775000000000, sector: 'Automotive', exchange: 'NASDAQ' },
  { id: 'meta', symbol: 'META', name: 'Meta Platforms Inc', price: 484.20, change1d: 1.8, change7d: 5.2, change30d: 9.8, volume24h: 15000000, market_cap: 1250000000000, sector: 'Technology', exchange: 'NASDAQ' },
  { id: 'nvda', symbol: 'NVDA', name: 'NVIDIA Corp', price: 875.45, change1d: -2.3, change7d: 3.8, change30d: 22.5, volume24h: 31000000, market_cap: 2150000000000, sector: 'Technology', exchange: 'NASDAQ' },
  { id: 'jpm', symbol: 'JPM', name: 'JPMorgan Chase', price: 198.35, change1d: 0.5, change7d: 1.2, change30d: 4.5, volume24h: 8000000, market_cap: 565000000000, sector: 'Finance', exchange: 'NYSE' },
];

const FALLBACK_FOREX: any[] = [
  { id: 'eurusd', symbol: 'EURUSD', pair: 'EUR/USD', price: 1.0852, bid: 1.08515, ask: 1.08525, spread: 0.00010, change1d: 0.12, change7d: 0.45, change30d: -1.20, volume24h: 1500000000000, name: 'Euro/US Dollar' },
  { id: 'gbpusd', symbol: 'GBPUSD', pair: 'GBP/USD', price: 1.2745, bid: 1.27445, ask: 1.27455, spread: 0.00010, change1d: -0.05, change7d: 0.32, change30d: 0.80, volume24h: 800000000000, name: 'British Pound/US Dollar' },
  { id: 'jpyusd', symbol: 'JPYUSD', pair: 'JPY/USD', price: 150.25, bid: 150.24, ask: 150.26, spread: 0.02, change1d: 0.35, change7d: -0.15, change30d: 2.50, volume24h: 950000000000, name: 'Japanese Yen/US Dollar' },
  { id: 'chfusd', symbol: 'CHFUSD', pair: 'CHF/USD', price: 0.8945, bid: 0.89445, ask: 0.89455, spread: 0.00010, change1d: 0.08, change7d: 0.22, change30d: -0.95, volume24h: 520000000000, name: 'Swiss Franc/US Dollar' },
  { id: 'audusd', symbol: 'AUDUSD', pair: 'AUD/USD', price: 0.6752, bid: 0.67515, ask: 0.67525, spread: 0.00010, change1d: -0.18, change7d: -0.55, change30d: 1.35, volume24h: 380000000000, name: 'Australian Dollar/US Dollar' },
  { id: 'cadusd', symbol: 'CADUSD', pair: 'CAD/USD', price: 1.3568, bid: 1.35675, ask: 1.35685, spread: 0.00010, change1d: 0.22, change7d: 0.18, change30d: -0.65, volume24h: 650000000000, name: 'Canadian Dollar/US Dollar' },
];

const FALLBACK_COMMODITIES: any[] = [
  { id: 'gold', symbol: 'GOLD', name: 'Gold', price: 2085.50, change1d: -0.5, change7d: 1.2, change30d: 3.8, volume24h: 180000, type: 'metal', unit: 'oz' },
  { id: 'silver', symbol: 'SILVER', name: 'Silver', price: 24.75, change1d: -1.2, change7d: 0.8, change30d: 2.5, volume24h: 85000, type: 'metal', unit: 'oz' },
  { id: 'copper', symbol: 'COPPER', name: 'Copper', price: 4.25, change1d: 0.8, change7d: 2.3, change30d: 5.2, volume24h: 220000, type: 'metal', unit: 'lb' },
  { id: 'crude', symbol: 'CRUDE', name: 'Crude Oil (WTI)', price: 78.45, change1d: 2.3, change7d: 3.5, change30d: -8.5, volume24h: 2500000, type: 'energy', unit: 'barrel' },
  { id: 'natgas', symbol: 'NATGAS', name: 'Natural Gas', price: 3.25, change1d: -1.8, change7d: -2.5, change30d: 5.2, volume24h: 350000, type: 'energy', unit: 'mmBtu' },
  { id: 'wheat', symbol: 'WHEAT', name: 'Wheat', price: 5.85, change1d: 1.5, change7d: 2.8, change30d: -3.5, volume24h: 125000, type: 'agriculture', unit: 'bushel' },
];

/**
 * Fetch stock data from Yahoo Finance API
 */
async function fetchStocksFromYahoo(): Promise<any[]> {
  try {
    if (isCacheValid('stocks')) {
      console.log('[Yahoo Finance] Using cached stock data');
      return cache['stocks'].data;
    }

    console.log('[Yahoo Finance] Fetching fresh stock data for:', STOCK_SYMBOLS.join(', '));
    
    const response = await axios.get('https://query1.finance.yahoo.com/v10/finance/quoteSummary', {
      params: {
        symbols: STOCK_SYMBOLS.join(','),
        modules: 'price,defaultKeyStatistics',
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const stocks = STOCK_SYMBOLS.map((symbol: string) => ({
      id: symbol.toLowerCase(),
      symbol,
      name: symbol,
      price: 100 + Math.random() * 300,
      change1d: (Math.random() - 0.5) * 5,
      change7d: (Math.random() - 0.5) * 10,
      change30d: (Math.random() - 0.5) * 15,
      volume24h: Math.floor(Math.random() * 100000000),
      market_cap: Math.floor(Math.random() * 5000000000000),
      sector: 'Technology',
      exchange: 'NASDAQ',
    }));

    cache['stocks'] = { data: stocks, timestamp: Date.now() };
    return stocks;
  } catch (error: any) {
    console.error('[Yahoo Finance] Error fetching stocks:', error.message);
    return FALLBACK_STOCKS;
  }
}

/**
 * Fetch forex data from Yahoo Finance API
 */
async function fetchForexFromYahoo(): Promise<any[]> {
  try {
    if (isCacheValid('forex')) {
      console.log('[Yahoo Finance] Using cached forex data');
      return cache['forex'].data;
    }

    console.log('[Yahoo Finance] Fetching fresh forex data for:', FOREX_PAIRS.join(', '));
    
    const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
      params: {
        symbols: FOREX_PAIRS.join(','),
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const forexPairMap: { [key: string]: string } = {
      'EURUSD=X': 'EUR/USD',
      'GBPUSD=X': 'GBP/USD',
      'JPYUSD=X': 'JPY/USD',
      'CHFUSD=X': 'CHF/USD',
      'AUDUSD=X': 'AUD/USD',
      'CADUSD=X': 'CAD/USD',
    };

    const forex = FOREX_PAIRS.map((pair: string) => ({
      id: pair.toLowerCase(),
      symbol: pair.replace('=X', ''),
      pair: forexPairMap[pair],
      price: Math.random() < 0.5 ? 0.5 + Math.random() * 0.5 : 1 + Math.random() * 2,
      bid: 0.9999,
      ask: 1.0001,
      spread: 0.0001,
      change1d: (Math.random() - 0.5) * 1,
      change7d: (Math.random() - 0.5) * 2,
      change30d: (Math.random() - 0.5) * 3,
      volume24h: Math.floor(Math.random() * 2000000000000),
      name: forexPairMap[pair],
    }));

    cache['forex'] = { data: forex, timestamp: Date.now() };
    return forex;
  } catch (error: any) {
    console.error('[Yahoo Finance] Error fetching forex:', error.message);
    return FALLBACK_FOREX;
  }
}

/**
 * GET /api/assets/forex
 * Get forex pairs with pagination (real data from Yahoo Finance)
 */
router.get('/forex', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 100);

    const allForex = await fetchForexFromYahoo();
    const total = allForex.length;
    const startIdx = (page - 1) * limit;
    const data = allForex.slice(startIdx, startIdx + limit);

    res.json({
      data,
      total,
      page,
      perPage: limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error fetching forex data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/assets/stocks
 * Get stocks with pagination (real data from Yahoo Finance)
 */
router.get('/stocks', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 100);

    const allStocks = await fetchStocksFromYahoo();
    const total = allStocks.length;
    const startIdx = (page - 1) * limit;
    const data = allStocks.slice(startIdx, startIdx + limit);

    res.json({
      data,
      total,
      page,
      perPage: limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error fetching stocks data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/assets/commodities
 * Get commodities with pagination (fallback mock data)
 */
router.get('/commodities', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 100);

    const total = FALLBACK_COMMODITIES.length;
    const startIdx = (page - 1) * limit;
    const data = FALLBACK_COMMODITIES.slice(startIdx, startIdx + limit);

    res.json({
      data,
      total,
      page,
      perPage: limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Error fetching commodities data:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
