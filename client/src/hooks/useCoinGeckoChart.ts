/**
 * Hook to fetch chart data from CoinGecko
 */

import { useQuery } from '@tanstack/react-query';
import { ChartDataPoint } from '../components/TradingChart';

interface CoinGeckoChartData {
  success: boolean;
  coinId: string;
  data: ChartDataPoint[];
}

export function useCoinGeckoChart(symbol: string, days: number = 7) {
  // Convert symbol to CoinGecko ID
  const coinId = symbolToCoinId(symbol);
  
  return useQuery<ChartDataPoint[]>({
    queryKey: ['coingecko-chart', coinId, days],
    queryFn: async () => {
      if (!coinId) {
        console.warn(`[CoinGecko Chart] Unknown symbol: ${symbol}`);
        return [];
      }
      
      try {
        const response = await fetch(`/api/coingecko/chart/${coinId}?days=${days}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result: CoinGeckoChartData = await response.json();
        
        if (!result.success || !result.data) {
          console.warn(`[CoinGecko Chart] No data for ${coinId}`);
          return [];
        }
        
        console.log(`[CoinGecko Chart] Fetched ${result.data.length} candles for ${symbol}`);
        return result.data;
        
      } catch (error: any) {
        console.error(`[CoinGecko Chart] Error fetching ${symbol}:`, error.message);
        return [];
      }
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 180000, // Consider fresh for 3 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Convert trading symbol to CoinGecko coin ID
 */
function symbolToCoinId(symbol: string): string | null {
  const symbolMap: Record<string, string> = {
    'BTC/USDT': 'bitcoin',
    'BTC': 'bitcoin',
    'ETH/USDT': 'ethereum',
    'ETH': 'ethereum',
    'BNB/USDT': 'binancecoin',
    'BNB': 'binancecoin',
    'SOL/USDT': 'solana',
    'SOL': 'solana',
    'XRP/USDT': 'ripple',
    'XRP': 'ripple',
    'ADA/USDT': 'cardano',
    'ADA': 'cardano',
    'AVAX/USDT': 'avalanche-2',
    'AVAX': 'avalanche-2',
    'DOGE/USDT': 'dogecoin',
    'DOGE': 'dogecoin',
    'DOT/USDT': 'polkadot',
    'DOT': 'polkadot',
    'MATIC/USDT': 'matic-network',
    'MATIC': 'matic-network',
    'LINK/USDT': 'chainlink',
    'LINK': 'chainlink',
    'UNI/USDT': 'uniswap',
    'UNI': 'uniswap',
    'ATOM/USDT': 'cosmos',
    'ATOM': 'cosmos',
    'LTC/USDT': 'litecoin',
    'LTC': 'litecoin',
    'APT/USDT': 'aptos',
    'APT': 'aptos',
    'ARB/USDT': 'arbitrum',
    'ARB': 'arbitrum',
    'OP/USDT': 'optimism',
    'OP': 'optimism',
    'INJ/USDT': 'injective-protocol',
    'INJ': 'injective-protocol',
    'SUI/USDT': 'sui',
    'SUI': 'sui',
    'TIA/USDT': 'celestia',
    'TIA': 'celestia',
  };
  
  // Clean up symbol
  const cleanSymbol = symbol.toUpperCase().trim();
  return symbolMap[cleanSymbol] || null;
}

