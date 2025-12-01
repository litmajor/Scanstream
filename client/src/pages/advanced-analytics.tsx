
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  Target,
  AlertCircle,
  Zap,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface CandleCluster {
  startIndex: number;
  direction: 'bullish' | 'bearish';
  candles: number;
  totalVolume: number;
}

interface ClusteringAnalysis {
  clusters: CandleCluster[];
  totalClusters: number;
  bullishClusters: number;
  bearishClusters: number;
  directionalRatio: number;
  trendFormation: boolean;
  dominantDirection: 'bullish' | 'bearish';
}

export default function AdvancedAnalytics() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');

  // Fetch market data for clustering
  const { data: marketData, isLoading: loadingMarket } = useQuery({
    queryKey: ['market-data', selectedSymbol, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/gateway/market-data/${selectedSymbol}?timeframe=${timeframe}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch market data');
      return response.json();
    },
  });

  // Fetch candle clustering analysis
  const { data: clustering, isLoading: loadingClustering, refetch: refetchClustering } = useQuery({
    queryKey: ['candle-clustering', selectedSymbol],
    queryFn: async () => {
      if (!marketData?.data) return null;
      
      const response = await fetch('/api/analytics/candle-clustering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: marketData.data }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch clustering');
      return response.json() as Promise<ClusteringAnalysis>;
    },
    enabled: !!marketData?.data,
  });

  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'LINK/USDT'];
  const timeframes = ['5m', '15m', '1h', '4h', '1d'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-blue-400" />
            Advanced Analytics Engine
          </h1>
          <p className="text-slate-400">Candle Clustering, Pattern Detection & Market Regime Analysis</p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 hover:border-slate-500"
          >
            {symbols.map(s => <option key={s}>{s}</option>)}
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 hover:border-slate-500"
          >
            {timeframes.map(t => <option key={t}>{t}</option>)}
          </select>

          <Button
            onClick={() => refetchClustering()}
            disabled={loadingClustering || loadingMarket}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Analyze Clusters
          </Button>
        </div>

        {/* Market Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Candles Analyzed</span>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {marketData?.data?.length || 0}
            </p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total Clusters</span>
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {clustering?.totalClusters || 0}
            </p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Directional Ratio</span>
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {clustering ? `${(clustering.directionalRatio * 100).toFixed(0)}%` : 'N/A'}
            </p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Trend Formation</span>
              <AlertCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {clustering?.trendFormation ? 'YES' : 'NO'}
            </p>
          </Card>
        </div>

        {/* Clustering Summary */}
        {clustering && (
          <Card className="p-6 bg-slate-800/50 border-slate-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-400" />
              Clustering Analysis Summary
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bullish Clusters */}
              <div className="bg-slate-700/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-400 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Bullish Clusters
                  </h3>
                  <Badge className="bg-green-500/20 text-green-400 border-green-700">
                    {clustering.bullishClusters}
                  </Badge>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-600 to-green-400"
                    style={{ width: `${(clustering.bullishClusters / clustering.totalClusters) * 100}%` }}
                  />
                </div>
              </div>

              {/* Bearish Clusters */}
              <div className="bg-slate-700/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-red-400 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    Bearish Clusters
                  </h3>
                  <Badge className="bg-red-500/20 text-red-400 border-red-700">
                    {clustering.bearishClusters}
                  </Badge>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 to-red-400"
                    style={{ width: `${(clustering.bearishClusters / clustering.totalClusters) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Dominant Direction */}
            <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Dominant Direction</p>
                  <p className={`text-2xl font-bold ${clustering.dominantDirection === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                    {clustering.dominantDirection.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-sm mb-1">Trend Strength</p>
                  <div className="flex items-center gap-2">
                    {clustering.trendFormation ? (
                      <>
                        <Badge className="bg-green-500/20 text-green-400 border-green-700">STRONG</Badge>
                        <ArrowUp className="w-6 h-6 text-green-400" />
                      </>
                    ) : (
                      <>
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-700">WEAK</Badge>
                        <ArrowDown className="w-6 h-6 text-yellow-400" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Detailed Clusters List */}
        {clustering && clustering.clusters.length > 0 && (
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-purple-400" />
              Detected Clusters ({clustering.clusters.length})
            </h2>
            
            <div className="space-y-3">
              {clustering.clusters.map((cluster, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    cluster.direction === 'bullish' 
                      ? 'bg-green-500/10 border-green-700' 
                      : 'bg-red-500/10 border-red-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {cluster.direction === 'bullish' ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className={`font-semibold ${cluster.direction === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                          {cluster.direction.toUpperCase()} Cluster #{idx + 1}
                        </p>
                        <p className="text-sm text-slate-400">
                          Starting at candle {cluster.startIndex}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Candles: <span className="text-white font-semibold">{cluster.candles}</span></p>
                      <p className="text-sm text-slate-400">Volume: <span className="text-white font-semibold">{cluster.totalVolume.toFixed(0)}</span></p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Loading State */}
        {(loadingMarket || loadingClustering) && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-slate-400">Analyzing market data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
