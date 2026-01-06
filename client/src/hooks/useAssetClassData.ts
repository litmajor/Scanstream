import { useQuery } from '@tanstack/react-query';

export type AssetClass = 'crypto' | 'forex' | 'stocks' | 'commodities' | 'indices';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  market_cap_rank: number;
  price: number; // normalized from current_price
  market_cap: number;
  total_volume: number;
  change1d: number; // normalized from price_change_percentage_24h
  change7d: number; // normalized from price_change_percentage_7d
  change30d: number; // normalized from price_change_percentage_30d
  market_cap_change_percentage_24h?: number;
  ath?: number;
  atl?: number;
}

export interface ForexAsset {
  id: string;
  symbol: string; // normalized from pair
  pair?: string; // EUR/USD
  baseCurrency?: string;
  quoteCurrency?: string;
  price: number; // normalized from currentPrice
  bid: number;
  ask: number;
  spread: number;
  change1d: number;
  change7d: number;
  change30d: number;
  volume24h?: number;
  name?: string;
  market_cap?: number;
}

export interface StockAsset {
  id: string;
  symbol: string;
  name: string;
  sector?: string;
  exchange?: string;
  price: number; // normalized from currentPrice
  market_cap?: number; // normalized from marketCap
  peRatio?: number;
  dividendYield?: number;
  change1d: number;
  change7d: number;
  change30d: number;
  volume?: number;
}

export interface CommodityAsset {
  id: string;
  symbol: string;
  name: string;
  type?: string; // 'metal', 'energy', 'agriculture'
  price: number; // normalized from currentPrice
  unit?: string; // 'oz', 'barrel', 'bushel'
  change1d: number;
  change7d: number;
  change30d: number;
  volume?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  market_cap?: number;
}

export type Asset = CryptoAsset | ForexAsset | StockAsset | CommodityAsset;

// Fetch CoinGecko cryptocurrencies (Top 250)
const fetchCryptoAssets = async (page: number = 1) => {
  try {
    // Try to get all available price change data from CoinGecko
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false&price_change_percentage=1h,24h,7d,30d,200d,1y`
    );

    if (!response.ok) throw new Error('Failed to fetch cryptos from CoinGecko');

    const rawData = await response.json();
    
    // Log sample data for debugging
    if (page === 1 && rawData.length > 0) {
      console.log('Sample CoinGecko response:', rawData[0]);
    }
    
    // Normalize CoinGecko API response to our interface
    const data: CryptoAsset[] = rawData.map((item: any) => {
      // CoinGecko returns price changes in format: price_change_percentage_7d_in_currency
      // But also has price_change_percentage_7d for USD
      const change7d = item.price_change_percentage_7d ?? 0;
      const change30d = item.price_change_percentage_30d ?? 0;
      const change1d = item.price_change_percentage_24h ?? 0;

      return {
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        image: item.image,
        market_cap_rank: item.market_cap_rank,
        price: item.current_price || 0,
        market_cap: item.market_cap || 0,
        total_volume: item.total_volume || 0,
        change1d,
        change7d,
        change30d,
        market_cap_change_percentage_24h: item.market_cap_change_percentage_24h,
        ath: item.ath,
        atl: item.atl,
      };
    });

    return {
      data,
      total: 15000, // CoinGecko has ~15k+ coins
      page,
      perPage: 250,
    };
  } catch (error) {
    console.error('Crypto fetch error:', error);
    return { data: [], total: 0, page, perPage: 250 };
  }
};

// Fetch from backend - Forex pairs
const fetchForexAssets = async (page: number = 1) => {
  try {
    const response = await fetch(`/api/assets/forex?page=${page}&limit=100`);

    if (!response.ok) {
      // Fallback: return mock data until backend is ready
      return {
        data: generateMockForexData(),
        total: 200,
        page,
        perPage: 100,
      };
    }

    return response.json();
  } catch (error) {
    console.error('Forex fetch error:', error);
    return {
      data: generateMockForexData(),
      total: 200,
      page,
      perPage: 100,
    };
  }
};

// Fetch from backend - Stocks
const fetchStockAssets = async (page: number = 1) => {
  try {
    const response = await fetch(`/api/assets/stocks?page=${page}&limit=100`);

    if (!response.ok) {
      return {
        data: generateMockStockData(),
        total: 5000,
        page,
        perPage: 100,
      };
    }

    return response.json();
  } catch (error) {
    console.error('Stocks fetch error:', error);
    return {
      data: generateMockStockData(),
      total: 5000,
      page,
      perPage: 100,
    };
  }
};

// Fetch from backend - Commodities
const fetchCommodityAssets = async (page: number = 1) => {
  try {
    const response = await fetch(`/api/assets/commodities?page=${page}&limit=100`);

    if (!response.ok) {
      return {
        data: generateMockCommodityData(),
        total: 100,
        page,
        perPage: 100,
      };
    }

    return response.json();
  } catch (error) {
    console.error('Commodities fetch error:', error);
    return {
      data: generateMockCommodityData(),
      total: 100,
      page,
      perPage: 100,
    };
  }
};

// Main hook - handles all asset classes
export const useAssetClassData = (assetClass: AssetClass, page: number = 1) => {
  return useQuery({
    queryKey: ['assets', assetClass, page],
    queryFn: async () => {
      switch (assetClass) {
        case 'crypto':
          return fetchCryptoAssets(page);
        case 'forex':
          return fetchForexAssets(page);
        case 'stocks':
          return fetchStockAssets(page);
        case 'commodities':
          return fetchCommodityAssets(page);
        case 'indices':
          return fetchStockAssets(page); // Temporary: use stock structure
        default:
          return { data: [], total: 0, page, perPage: 100 };
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mock data generators for development
function generateMockForexData(): ForexAsset[] {
  const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD'];
  return pairs.map((pair, i) => ({
    id: `forex-${i}`,
    symbol: pair.replace('/', ''),
    pair,
    baseCurrency: pair.split('/')[0],
    quoteCurrency: pair.split('/')[1],
    price: 1.08 + Math.random() * 0.1,
    bid: 1.0799 + Math.random() * 0.1,
    ask: 1.0801 + Math.random() * 0.1,
    spread: 0.0002,
    change1d: (Math.random() - 0.5) * 2,
    change7d: (Math.random() - 0.5) * 3,
    change30d: (Math.random() - 0.5) * 5,
    volume24h: Math.random() * 1000000000000,
  }));
}

function generateMockStockData(): StockAsset[] {
  const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM'];
  return stocks.map((symbol, i) => ({
    id: `stock-${i}`,
    symbol,
    name: `${symbol} Inc`,
    sector: 'Technology',
    exchange: 'NASDAQ',
    price: 100 + Math.random() * 200,
    market_cap: Math.random() * 3000000000000,
    peRatio: 15 + Math.random() * 20,
    dividendYield: Math.random() * 5,
    change1d: (Math.random() - 0.5) * 4,
    change7d: (Math.random() - 0.5) * 8,
    change30d: (Math.random() - 0.5) * 10,
    volume: Math.random() * 100000000,
  }));
}

function generateMockCommodityData(): CommodityAsset[] {
  const commodities = [
    { symbol: 'GOLD', name: 'Gold', type: 'metal', unit: 'oz' },
    { symbol: 'SILVER', name: 'Silver', type: 'metal', unit: 'oz' },
    { symbol: 'COPPER', name: 'Copper', type: 'metal', unit: 'lb' },
    { symbol: 'OIL', name: 'Crude Oil', type: 'energy', unit: 'barrel' },
    { symbol: 'GAS', name: 'Natural Gas', type: 'energy', unit: 'mmBtu' },
    { symbol: 'WHEAT', name: 'Wheat', type: 'agriculture', unit: 'bushel' },
  ];

  return commodities.map((item, i) => ({
    id: `commodity-${i}`,
    symbol: item.symbol,
    name: item.name,
    type: item.type,
    price: 100 + Math.random() * 500,
    unit: item.unit,
    change1d: (Math.random() - 0.5) * 3,
    change7d: (Math.random() - 0.5) * 5,
    change30d: (Math.random() - 0.5) * 8,
    volume: Math.random() * 100000,
    openPrice: 100 + Math.random() * 400,
    highPrice: 150 + Math.random() * 400,
    lowPrice: 50 + Math.random() * 400,
  }));
}
