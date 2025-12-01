
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Shield,
  Zap,
  Activity,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface RLSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  price: number;
  timestamp: string;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number;
  reasoning: string[];
}

interface RLStats {
  qTableSize: number;
  experienceCount: number;
  epsilon: number;
  actionSpaceSize: number;
}

export default function RLPositionAgent() {
  const [selectedSymbol, setSelectedSymbol] = useState('all');

  // Fetch RL signals
  const { data: signalsData, isLoading: loadingSignals, refetch: refetchSignals } = useQuery({
    queryKey: ['rl-signals'],
    queryFn: async () => {
      const response = await fetch('/api/rl-agent/signals');
      if (!response.ok) throw new Error('Failed to fetch RL signals');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch RL stats
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['rl-stats'],
    queryFn: async () => {
      const response = await fetch('/api/rl-agent/stats');
      if (!response.ok) throw new Error('Failed to fetch RL stats');
      return response.json();
    },
  });

  const signals: RLSignal[] = signalsData?.signals || [];
  const stats: RLStats = statsData?.stats || {
    qTableSize: 0,
    experienceCount: 0,
    epsilon: 0,
    actionSpaceSize: 0,
  };

  // Filter signals by symbol
  const filteredSignals = selectedSymbol === 'all' 
    ? signals 
    : signals.filter(s => s.symbol === selectedSymbol);

  const uniqueSymbols = Array.from(new Set(signals.map(s => s.symbol)));

  const getSignalIcon = (type: string) => {
    if (type === 'BUY') return <ArrowUp className="w-5 h-5 text-green-400" />;
    if (type === 'SELL') return <ArrowDown className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  const getSignalColor = (type: string) => {
    if (type === 'BUY') return 'bg-green-500/20 text-green-400 border-green-700';
    if (type === 'SELL') return 'bg-red-500/20 text-red-400 border-red-700';
    return 'bg-gray-500/20 text-gray-400 border-gray-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Brain className="w-10 h-10 text-purple-400" />
            RL Position Agent
          </h1>
          <p className="text-slate-400">AI-Powered Position Sizing & Risk Management</p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 hover:border-slate-500"
          >
            <option value="all">All Symbols ({signals.length})</option>
            {uniqueSymbols.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <Button
            onClick={() => refetchSignals()}
            disabled={loadingSignals}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Refresh Signals
          </Button>
        </div>

        {/* RL Agent Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Q-Table Size</span>
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {stats.qTableSize.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">State-action pairs learned</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Experience Buffer</span>
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {stats.experienceCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">Training experiences</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Exploration Rate</span>
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {(stats.epsilon * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Epsilon-greedy</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Action Space</span>
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {stats.actionSpaceSize}
            </p>
            <p className="text-xs text-slate-500 mt-1">Available strategies</p>
          </Card>
        </div>

        {/* Active Signals */}
        <Card className="p-6 bg-slate-800/50 border-slate-700 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-purple-400" />
              Active Position Recommendations ({filteredSignals.length})
            </h2>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-700">
              Real-time
            </Badge>
          </div>

          {loadingSignals ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading RL signals...</p>
              </div>
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No active signals at the moment</p>
              <p className="text-sm text-slate-500 mt-2">The RL agent is analyzing market conditions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSignals.map((signal, idx) => (
                <div key={idx} className="bg-slate-700/30 p-5 rounded-lg border border-slate-600">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getSignalIcon(signal.signal)}
                      <div>
                        <h3 className="font-bold text-white text-lg">{signal.symbol}</h3>
                        <p className="text-sm text-slate-400">
                          {new Date(signal.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <Badge className={`mb-2 ${getSignalColor(signal.signal)}`}>
                        {signal.signal}
                      </Badge>
                      <p className="text-sm text-slate-400">
                        Strength: <span className="text-white font-semibold">{signal.strength.toFixed(0)}%</span>
                      </p>
                    </div>
                  </div>

                  {/* Position Parameters */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-3 rounded">
                      <p className="text-xs text-slate-400 mb-1">Current Price</p>
                      <p className="text-lg font-bold text-white">${signal.price.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-slate-800/50 p-3 rounded">
                      <p className="text-xs text-slate-400 mb-1">Position Size</p>
                      <p className="text-lg font-bold text-blue-400">${signal.positionSize.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-slate-800/50 p-3 rounded">
                      <p className="text-xs text-slate-400 mb-1">Stop Loss</p>
                      <p className="text-lg font-bold text-red-400">${signal.stopLoss.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-slate-800/50 p-3 rounded">
                      <p className="text-xs text-slate-400 mb-1">Take Profit</p>
                      <p className="text-lg font-bold text-green-400">${signal.takeProfit.toFixed(2)}</p>
                    </div>
                    
                    <div className="bg-slate-800/50 p-3 rounded">
                      <p className="text-xs text-slate-400 mb-1">Risk/Reward</p>
                      <p className="text-lg font-bold text-purple-400">{signal.riskReward.toFixed(2)}x</p>
                    </div>
                  </div>

                  {/* Confidence & Reasoning */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Agent Confidence</span>
                      <span className="text-sm font-semibold text-white">{(signal.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
                        style={{ width: `${signal.confidence * 100}%` }}
                      />
                    </div>
                    
                    <div className="mt-3 p-3 bg-slate-800/50 rounded">
                      <p className="text-xs text-slate-400 mb-2 font-semibold">AI Reasoning:</p>
                      <ul className="space-y-1">
                        {signal.reasoning.map((reason, ridx) => (
                          <li key={ridx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-purple-400">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-700/50">
          <div className="flex items-start gap-4">
            <Brain className="w-8 h-8 text-purple-400 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-white mb-2">How RL Position Agent Works</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Uses Q-learning to optimize position sizing based on market conditions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Dynamically adjusts stop-loss and take-profit levels using ATR multiples</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Learns from experience replay to improve risk-reward ratios over time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Adapts to volatility, trend, momentum, and market regime</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
