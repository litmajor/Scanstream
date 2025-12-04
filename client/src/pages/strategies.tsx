import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  TrendingUp,
  Activity,
  BarChart3,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  Info,
  Play,
  Settings,
  Download,
  GitCompare,
  Activity as ActivityIcon,
  Wallet,
  Store,
  Copy
} from 'lucide-react';
import StrategyComparisonDashboard from '../components/StrategyComparisonDashboard';
import StrategyLiveMonitor from '../components/StrategyLiveMonitor';
import StrategyPortfolioOptimizer from '../components/StrategyPortfolioOptimizer';
import StrategyBacktestingSuite from '../components/StrategyBacktestingSuite';
import StrategyMarketplace from '../components/StrategyMarketplace';
import StrategyCopyTrading from '../components/StrategyCopyTrading';
import BounceStrategyDashboard from '../components/BounceStrategyDashboard';

// Types
interface Strategy {
  id: string;
  name: string;
  description: string;
  type: string;
  features: string[];
  parameters: {
    [key: string]: {
      type: string;
      default: any;
      description: string;
      min?: number;
      max?: number;
    };
  };
  performance: {
    winRate?: number;
    avgReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
  };
  isActive: boolean;
  lastUpdated: string;
}

interface ConsensusResult {
  direction: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number[];
  positionSize: number;
  confidence: number;
  riskRewardRatio: number;
  contributingStrategies: string[];
  timeframeAlignment: { [key: string]: string };
  edgeScore: number;
  timestamp: string;
}

export default function StrategiesPage() {
  const [, setLocation] = useLocation();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [consensusSymbol, setConsensusSymbol] = useState('BTC/USDT');
  const [showConsensus, setShowConsensus] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);
  const [showPortfolioOptimizer, setShowPortfolioOptimizer] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showCopyTrading, setShowCopyTrading] = useState(false);
  const [showBounceStrategy, setShowBounceStrategy] = useState(false);
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<Strategy | null>(null);

  // Fetch strategies
  const { data: strategiesData, isLoading, error } = useQuery<{ success: boolean; strategies: Strategy[]; total: number }>({
    queryKey: ['strategies'],
    queryFn: async () => {
      const response = await fetch('/api/strategies');
      if (!response.ok) throw new Error('Failed to fetch strategies');
      return response.json();
    }
  });

  // Fetch consensus
  const { data: consensusData, refetch: refetchConsensus, isFetching: isConsensusLoading } = useQuery<{ success: boolean; consensus: ConsensusResult }>({
    queryKey: ['consensus', consensusSymbol],
    queryFn: async () => {
      const response = await fetch('/api/strategies/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: consensusSymbol,
          timeframes: ['D1', 'H4', 'H1', 'M15'],
          equity: 10000
        })
      });
      if (!response.ok) throw new Error('Failed to fetch consensus');
      return response.json();
    },
    enabled: showConsensus
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Trend Following':
        return <TrendingUp className="w-5 h-5" />;
      case 'Mean Reversion':
        return <Activity className="w-5 h-5" />;
      case 'Volume Analysis':
        return <BarChart3 className="w-5 h-5" />;
      case 'Price Action':
        return <Target className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Trend Following':
        return 'text-blue-400 bg-blue-500/10';
      case 'Mean Reversion':
        return 'text-green-400 bg-green-500/10';
      case 'Volume Analysis':
        return 'text-purple-400 bg-purple-500/10';
      case 'Price Action':
        return 'text-yellow-400 bg-yellow-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  const handleRunConsensus = () => {
    setShowConsensus(true);
    refetchConsensus();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading strategies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Strategies</h2>
          <p className="text-slate-400">Failed to load strategy data</p>
        </div>
      </div>
    );
  }

  const strategies = strategiesData?.strategies || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Header */}
      <div className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back Button */}
            <button
              onClick={() => setLocation('/')}
              className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Dashboard</span>
            </button>

            {/* Page Title */}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Trading Strategies
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Professional trading algorithms & strategy coordinator</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/strategies/execute-all', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        symbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'ADA/USDT'],
                        timeframe: '1h'
                      })
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert(`Generated ${data.totalSignals} signals from ${data.results.length} strategy executions!`);
                    }
                  } catch (error) {
                    console.error('Failed to execute strategies:', error);
                    alert('Failed to execute strategies');
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-green-500/20"
              >
                <Zap className="w-4 h-4" />
                <span>Generate Signals</span>
              </button>
              <button
                onClick={() => setShowLiveMonitor(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-orange-500/20"
              >
                <ActivityIcon className="w-4 h-4" />
                <span>Live Monitor</span>
              </button>
              <button
                onClick={() => setShowPortfolioOptimizer(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-purple-500/20"
              >
                <Wallet className="w-4 h-4" />
                <span>Optimize Portfolio</span>
              </button>
              <button
                onClick={() => setShowComparison(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-green-500/20"
              >
                <GitCompare className="w-4 h-4" />
                <span>Compare Strategies</span>
              </button>
              <button
                onClick={handleRunConsensus}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-blue-500/20"
              >
                <Play className="w-4 h-4" />
                <span>Run Consensus</span>
              </button>
              <button
                onClick={() => setShowMarketplace(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-cyan-500/20"
              >
                <Store className="w-4 h-4" />
                <span>Marketplace</span>
              </button>
              <button
                onClick={() => setShowCopyTrading(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-indigo-500/20"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Trading</span>
              </button>
              <button
                onClick={() => setShowBounceStrategy(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-pink-500/20"
              >
                <Zap className="w-4 h-4" />
                <span>Bounce Strategy</span>
              </button>
              <button
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Strategy Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Strategies</p>
                <p className="text-2xl font-bold text-white">{strategies.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Active</p>
                <p className="text-2xl font-bold text-white">{strategies.filter(s => s.isActive).length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Win Rate</p>
                <p className="text-2xl font-bold text-white">
                  {(strategies.reduce((sum, s) => sum + (s.performance.winRate || 0), 0) / strategies.length).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Sharpe</p>
                <p className="text-2xl font-bold text-white">
                  {(strategies.reduce((sum, s) => sum + (s.performance.sharpeRatio || 0), 0) / strategies.length).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Consensus Trade Panel */}
        {showConsensus && consensusData && (
          <div className="mb-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-sm border border-blue-700/30 rounded-xl p-6 shadow-xl shadow-blue-500/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Consensus Trade Signal</h2>
                  <p className="text-xs text-slate-400">Multi-strategy consensus for {consensusSymbol}</p>
                </div>
              </div>
              <button
                onClick={() => setShowConsensus(false)}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close consensus"
                title="Close consensus"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Direction</p>
                <p className={`text-xl font-bold ${consensusData.consensus.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                  {consensusData.consensus.direction}
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Entry Price</p>
                <p className="text-xl font-bold text-white">${consensusData.consensus.entryPrice.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Confidence</p>
                <p className="text-xl font-bold text-blue-400">{consensusData.consensus.confidence}%</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Edge Score</p>
                <p className="text-xl font-bold text-purple-400">{consensusData.consensus.edgeScore}/100</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Stop Loss</p>
                <p className="text-lg font-semibold text-red-400">${consensusData.consensus.stopLoss.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Take Profit 1</p>
                <p className="text-lg font-semibold text-green-400">${consensusData.consensus.takeProfit[0].toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 mb-1">Risk/Reward</p>
                <p className="text-lg font-semibold text-yellow-400">{consensusData.consensus.riskRewardRatio}:1</p>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
              <p className="text-xs text-slate-400 mb-2">Contributing Strategies</p>
              <div className="flex flex-wrap gap-2">
                {consensusData.consensus.contributingStrategies.map((strategy, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs text-blue-300"
                  >
                    {strategy}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Strategy Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5"
            >
              {/* Strategy Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className={`p-3 rounded-lg ${getTypeColor(strategy.type)}`}>
                    {getTypeIcon(strategy.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{strategy.name}</h3>
                    <p className="text-xs text-slate-400">{strategy.type}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {strategy.isActive ? (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-green-300">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-gray-500/20 border border-gray-500/30 rounded-full">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-xs text-gray-300">Inactive</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-300 mb-4">{strategy.description}</p>

              {/* Features */}
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-400 mb-2">Key Features:</p>
                <div className="space-y-1">
                  {strategy.features.slice(0, 3).map((feature, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-400">
                      <CheckCircle className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4 border-t border-slate-700/30 pt-4">
                <div>
                  <p className="text-xs text-slate-400">Win Rate</p>
                  <p className="text-lg font-semibold text-green-400">{strategy.performance.winRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Avg Return</p>
                  <p className="text-lg font-semibold text-blue-400">{strategy.performance.avgReturn}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Sharpe Ratio</p>
                  <p className="text-lg font-semibold text-purple-400">{strategy.performance.sharpeRatio}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Max Drawdown</p>
                  <p className="text-lg font-semibold text-red-400">{strategy.performance.maxDrawdown}%</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedStrategy(strategy.id)}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2"
                >
                  <Info className="w-4 h-4" />
                  <span>Details</span>
                </button>
                                 <button 
                   onClick={() => setSelectedStrategyForBacktest(strategy)}
                   className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2"
                 >
                   <BarChart3 className="w-4 h-4" />
                   <span>Backtest</span>
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Comparison Dashboard */}
      {showComparison && (
        <StrategyComparisonDashboard
          strategies={strategies}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* Live Strategy Monitor */}
      {showLiveMonitor && (
        <StrategyLiveMonitor
          strategies={strategies.map(s => ({ id: s.id, name: s.name }))}
          onClose={() => setShowLiveMonitor(false)}
        />
      )}

      {/* Portfolio Optimizer */}
      {showPortfolioOptimizer && (
        <StrategyPortfolioOptimizer
          strategies={strategies}
          onClose={() => setShowPortfolioOptimizer(false)}
          initialCapital={100000}
        />
      )}

      {/* Backtesting Suite */}
      {selectedStrategyForBacktest && (
        <StrategyBacktestingSuite
          strategy={selectedStrategyForBacktest}
          onClose={() => setSelectedStrategyForBacktest(null)}
        />
      )}

      {/* Strategy Marketplace */}
      {showMarketplace && (
        <StrategyMarketplace
          onClose={() => setShowMarketplace(false)}
        />
      )}

      {/* Strategy Copy Trading */}
      {showCopyTrading && (
        <StrategyCopyTrading
          onClose={() => setShowCopyTrading(false)}
        />
      )}

      {/* Enhanced Bounce Strategy Dashboard */}
      {showBounceStrategy && (
        <BounceStrategyDashboard
          isOpen={showBounceStrategy}
          onClose={() => setShowBounceStrategy(false)}
        />
      )}
    </div>
  );
}

