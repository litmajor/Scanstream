
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Mover {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
  rank: number;
}

interface TopMoversData {
  success: boolean;
  gainers: Mover[];
  losers: Mover[];
}

export function TopMoversWidget({ limit = 5 }: { limit?: number }) {
  const { data, isLoading, refetch } = useQuery<TopMoversData>({
    queryKey: ['top-movers', limit],
    queryFn: async () => {
      const response = await fetch(`/api/coingecko/top-movers?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch top movers');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
    staleTime: 30000,
  });

  if (isLoading || !data?.success) {
    return (
      <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm">Top Movers (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-slate-700/30 rounded" />
            <div className="h-12 bg-slate-700/30 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm">Top Movers (24h)</CardTitle>
          <button
            onClick={() => refetch()}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gainers */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-xs font-semibold text-green-400">Top Gainers</span>
          </div>
          <div className="space-y-1">
            {data.gainers.slice(0, 3).map((coin) => (
              <div
                key={coin.symbol}
                className="flex items-center justify-between p-2 bg-green-500/5 border border-green-500/20 rounded hover:bg-green-500/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {coin.symbol}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      #{coin.rank}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{coin.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-green-400">
                    +{coin.change24h.toFixed(2)}%
                  </div>
                  <div className="text-xs text-slate-400">
                    ${coin.price < 1 ? coin.price.toFixed(6) : coin.price.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Losers */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <TrendingDown className="w-3 h-3 text-red-400" />
            <span className="text-xs font-semibold text-red-400">Top Losers</span>
          </div>
          <div className="space-y-1">
            {data.losers.slice(0, 3).map((coin) => (
              <div
                key={coin.symbol}
                className="flex items-center justify-between p-2 bg-red-500/5 border border-red-500/20 rounded hover:bg-red-500/10 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {coin.symbol}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      #{coin.rank}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{coin.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-red-400">
                    {coin.change24h.toFixed(2)}%
                  </div>
                  <div className="text-xs text-slate-400">
                    ${coin.price < 1 ? coin.price.toFixed(6) : coin.price.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-center text-slate-500 pt-2 border-t border-slate-700/50">
          Updates every minute
        </div>
      </CardContent>
    </Card>
  );
}
