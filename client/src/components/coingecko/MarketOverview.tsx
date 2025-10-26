/**
 * Market Overview Widget
 * Displays global market metrics from CoinGecko
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn is available for conditional styling

interface MarketOverviewData {
  success: boolean;
  global: {
    totalMarketCap: number;
    totalVolume: number;
    btcDominance: number;
    activeCryptocurrencies: number;
    markets: number;
  };
  regime: {
    current: 'bull' | 'bear' | 'neutral' | 'volatile';
    confidence: number;
    btcDominance: number;
  };
  trending: Array<{
    id: string;
    symbol: string;
    name: string;
    rank: number;
    score: number;
  }>;
}

// Assuming this interface for Fear & Greed data
interface FearGreedData {
  success: boolean;
  index: number;
  sentiment: string;
}

export function MarketOverview() {
  const { data, isLoading, error } = useQuery<MarketOverviewData>({
    queryKey: ['coingecko-market-overview'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/market-overview');
      if (!response.ok) throw new Error('Failed to fetch market overview');
      return response.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes (reduced from 1 min to respect rate limits)
    staleTime: 180000, // Consider data fresh for 3 minutes
    retry: 2, // Retry only twice on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Fetching Fear & Greed data
  const { data: fearGreedData } = useQuery<FearGreedData>({
    queryKey: ['coingecko-fear-greed'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko/fear-greed');
      if (!response.ok) throw new Error('Failed to fetch fear & greed');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className="w-full bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Card className="w-full bg-slate-800/40 border-yellow-500/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-yellow-400 text-sm">Market Data Temporarily Unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400">
            {error ? 'Rate limit reached. Data will refresh automatically.' : 'Unable to fetch market data.'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Using cached data where available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const regimeConfig = {
    bull: { emoji: '🚀', color: 'text-green-600', bg: 'bg-green-50', label: 'Bull Market' },
    bear: { emoji: '🐻', color: 'text-red-600', bg: 'bg-red-50', label: 'Bear Market' },
    neutral: { emoji: '😐', color: 'text-gray-600', bg: 'bg-gray-50', label: 'Neutral' },
    volatile: { emoji: '⚡', color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Volatile' },
  };

  const regime = regimeConfig[data.regime.current];

  return (
    <Card className="w-full bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white">Global Market</CardTitle>
          <span className="text-xs text-slate-500">
            Data by <a href="https://coingecko.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300 transition-colors">CoinGecko</a>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Regime */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{regime.emoji}</span>
              <div>
                <div className={`font-semibold ${regime.color}`}>{regime.label}</div>
                <div className="text-xs text-slate-400">Confidence: {data.regime.confidence}%</div>
              </div>
            </div>
            <Activity className={`w-5 h-5 ${regime.color}`} />
          </div>
        </div>

        {/* Global Metrics */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Market Cap</span>
            <span className="font-medium text-white">
              ${(data.global.totalMarketCap / 1e12).toFixed(2)}T
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">24h Volume</span>
            <span className="font-medium text-white">
              ${(data.global.totalVolume / 1e9).toFixed(1)}B
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">BTC Dominance</span>
            <span className="font-medium text-white">
              {data.global.btcDominance.toFixed(1)}%
              {data.global.btcDominance > 55 ? (
                <TrendingUp className="w-3 h-3 text-orange-400 inline ml-1" />
              ) : (
                <TrendingDown className="w-3 h-3 text-green-400 inline ml-1" />
              )}
            </span>
          </div>
          {fearGreedData?.success && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
              <span className="text-slate-400">Fear & Greed</span>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "font-medium",
                  fearGreedData.index >= 75 ? "text-green-400" :
                  fearGreedData.index >= 60 ? "text-green-300" :
                  fearGreedData.index >= 45 ? "text-yellow-400" :
                  fearGreedData.index >= 30 ? "text-orange-400" :
                  "text-red-400"
                )}>
                  {fearGreedData.index}
                </span>
                <span className="text-slate-500 text-[10px]">
                  {fearGreedData.sentiment}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Trending Coins */}
        {data.trending.length > 0 && (
          <div className="pt-2 border-t border-slate-700/50">
            <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-blue-400" />
              Trending Now
            </div>
            <div className="space-y-1">
              {data.trending.slice(0, 5).map((coin, idx) => (
                <div key={coin.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-4">{idx + 1}.</span>
                    <span className="font-medium text-white">{coin.symbol.toUpperCase()}</span>
                    <span className="text-slate-400 truncate max-w-[100px]">{coin.name}</span>
                  </div>
                  <span className="text-yellow-500">⭐</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}