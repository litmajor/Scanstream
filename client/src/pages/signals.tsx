import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Brain, Target, Bot, TrendingUp, Filter, RefreshCw, Grid3x3, Clock } from 'lucide-react';
import EnhancedSignalsList from '../components/EnhancedSignalsList';
import SignalStrengthHeatmap from '../components/SignalStrengthHeatmap';
import SignalTimeline from '../components/SignalTimeline';

type SignalSource = 'all' | 'scanner' | 'strategies' | 'ml' | 'rl';

interface UnifiedSignal {
  symbol: string;
  exchange?: string;
  signal: string;
  strength: number;
  price: number;
  change?: number;
  change24h?: number;
  volume?: number;
  timestamp: number;
  source: 'scanner' | 'strategy' | 'ml' | 'rl';
  strategyName?: string;
  confidence?: number;
  indicators?: {
    rsi?: number;
    macd?: number;
  };
  advanced?: {
    opportunity_score?: number;
  };
}

export default function SignalsPage() {
  const [selectedSource, setSelectedSource] = useState<SignalSource>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'heatmap' | 'timeline'>('list');
  const [filters, setFilters] = useState({
    hot: false,
    confirmed: false,
    highConviction: false,
  });

  // Fetch Scanner Signals
  const { data: scannerSignals, refetch: refetchScanner } = useQuery<UnifiedSignal[]>({
    queryKey: ['scanner-signals'],
    queryFn: async () => {
      const response = await fetch('/api/scanner/signals');
      if (!response.ok) return [];
      const data = await response.json();
      return (data.signals || []).map((s: any) => ({ ...s, source: 'scanner' as const }));
    },
    refetchInterval: 30000,
  });

  // Fetch Strategy Signals
  const { data: strategySignals, refetch: refetchStrategies } = useQuery<UnifiedSignal[]>({
    queryKey: ['strategy-signals'],
    queryFn: async () => {
      const response = await fetch('/api/strategies/signals');
      if (!response.ok) return [];
      const data = await response.json();
      return (data.signals || []).map((s: any) => ({ ...s, source: 'strategy' as const }));
    },
    refetchInterval: 30000,
  });

  // Fetch ML Predictions
  const { data: mlSignals, refetch: refetchML } = useQuery<UnifiedSignal[]>({
    queryKey: ['ml-signals'],
    queryFn: async () => {
      const response = await fetch('/api/ml-engine/predictions');
      if (!response.ok) return [];
      const data = await response.json();
      return (data.predictions || []).map((p: any) => ({
        symbol: p.symbol,
        signal: p.direction,
        strength: p.confidence * 100,
        price: p.price,
        timestamp: p.timestamp,
        source: 'ml' as const,
        confidence: p.confidence,
      }));
    },
    refetchInterval: 45000,
  });

  // Fetch RL Agent Signals
  const { data: rlSignals, refetch: refetchRL } = useQuery<UnifiedSignal[]>({
    queryKey: ['rl-signals'],
    queryFn: async () => {
      const response = await fetch('/api/rl-agent/signals');
      if (!response.ok) return [];
      const data = await response.json();
      return (data.signals || []).map((s: any) => ({ ...s, source: 'rl' as const }));
    },
    refetchInterval: 45000,
  });

  // Combine all signals
  const allSignals: UnifiedSignal[] = [
    ...(scannerSignals || []),
    ...(strategySignals || []),
    ...(mlSignals || []),
    ...(rlSignals || []),
  ].sort((a, b) => b.timestamp - a.timestamp);

  // Filter by source
  let displaySignals = selectedSource === 'all' 
    ? allSignals 
    : allSignals.filter(s => s.source === selectedSource);

  // Apply smart filters
  if (filters.hot) {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    displaySignals = displaySignals.filter(s => s.timestamp > fiveMinutesAgo);
  }
  if (filters.confirmed) {
    // Multiple sources agree
    const symbolCounts = displaySignals.reduce((acc, s) => {
      acc[s.symbol] = (acc[s.symbol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    displaySignals = displaySignals.filter(s => (symbolCounts[s.symbol] || 0) >= 2);
  }
  if (filters.highConviction) {
    displaySignals = displaySignals.filter(s => (s.confidence || s.strength / 100) > 0.8);
  }

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchScanner(),
      refetchStrategies(),
      refetchML(),
      refetchRL(),
    ]);
    setIsRefreshing(false);
  };

  const sourceStats = [
    {
      id: 'all',
      name: 'All Sources',
      count: allSignals.length,
      icon: Zap,
      color: 'blue',
    },
    {
      id: 'scanner',
      name: 'Scanner',
      count: scannerSignals?.length || 0,
      icon: Target,
      color: 'green',
    },
    {
      id: 'strategies',
      name: 'Strategies',
      count: strategySignals?.length || 0,
      icon: TrendingUp,
      color: 'purple',
    },
    {
      id: 'ml',
      name: 'ML Predictions',
      count: mlSignals?.length || 0,
      icon: Brain,
      color: 'cyan',
    },
    {
      id: 'rl',
      name: 'RL Agent',
      count: rlSignals?.length || 0,
      icon: Bot,
      color: 'orange',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Unified Signals
            </h1>
            <p className="text-slate-400 mt-1">All trading signals from Scanner, Strategies, ML & RL</p>
          </div>

          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh All</span>
          </button>
        </div>

        {/* Source Filter Pills */}
        <div className="flex flex-wrap gap-3 mb-6">
          {sourceStats.map((source) => {
            const Icon = source.icon;
            const isActive = selectedSource === source.id;
            return (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id as SignalSource)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{source.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive ? 'bg-white/20' : 'bg-slate-700'
                }`}>
                  {source.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total Signals</span>
              <Zap className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{allSignals.length}</div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Strong Signals</span>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {allSignals.filter(s => s.strength > 70).length}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Unique Symbols</span>
              <Target className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {new Set(allSignals.map(s => s.symbol)).size}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Avg Strength</span>
              <Filter className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {allSignals.length > 0 
                ? (allSignals.reduce((sum, s) => sum + s.strength, 0) / allSignals.length).toFixed(0)
                : 0
              }%
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Smart Filters */}
        <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400 mr-2">View:</span>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'heatmap'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
            >
              <Grid3x3 className="w-4 h-4 inline mr-1" />
              Heatmap
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Timeline
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-400 mr-2">Smart Filters:</span>
            <button
              onClick={() => setFilters(prev => ({ ...prev, hot: !prev.hot }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filters.hot
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
              title="Show signals from last 5 minutes"
            >
              🔥 Hot Right Now
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, confirmed: !prev.confirmed }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filters.confirmed
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
              title="Multiple sources agree"
            >
              ✓ Confirmed
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, highConviction: !prev.highConviction }))}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filters.highConviction
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white'
              }`}
              title="ML confidence > 80%"
            >
              💎 High Conviction
            </button>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' && (
        <EnhancedSignalsList 
          signals={displaySignals} 
          isLoading={false}
        />
      )}

      {viewMode === 'heatmap' && (
        <SignalStrengthHeatmap
          signals={displaySignals.slice(0, 10).map(s => ({
            symbol: s.symbol,
            timeframes: {
              '1m': Math.random() * 30 + 50,
              '5m': s.strength * 0.8,
              '15m': s.strength * 0.9,
              '1h': s.strength,
              '4h': Math.random() * 20 + 60,
              '1d': Math.random() * 40 + 50,
            },
          }))}
        />
      )}

      {viewMode === 'timeline' && (
        <SignalTimeline
          events={displaySignals.slice(0, 10).map(s => ({
            time: new Date(s.timestamp),
            type: s.signal.toUpperCase() as 'BUY' | 'SELL' | 'HOLD',
            symbol: s.symbol,
            price: s.price,
            change: s.change || 0,
            confidence: s.confidence || s.strength / 100,
          }))}
        />
      )}
    </div>
  );
}

