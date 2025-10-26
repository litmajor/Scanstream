
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Brain,
  TrendingUp,
  Activity,
  Zap,
  Target,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface StrategyWeight {
  strategyId: string;
  baseWeight: number;
  regimeMultiplier: number;
  volatilityMultiplier: number;
  momentumAlignment: number;
  temporalDecay: number;
  finalWeight: number;
}

interface SynthesizedSignal {
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  price: number;
  stopLoss: number;
  takeProfit: number;
  contributingStrategies: Array<{
    strategyId: string;
    weight: number;
  }>;
  regimeContext: {
    type: string;
    volatility: string;
    momentum: number;
    trend: string;
  };
  confidenceBreakdown: {
    baseConfidence: number;
    regimeAdjustment: number;
    volatilityAdjustment: number;
    momentumAdjustment: number;
    finalConfidence: number;
  };
}

export default function StrategySynthesisPage() {
  const [, setLocation] = useLocation();
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    signal: SynthesizedSignal;
    weights: StrategyWeight[];
  }>({
    queryKey: ['strategy-synthesis', symbol, timeframe],
    queryFn: async () => {
      const response = await fetch('/api/strategies/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, timeframe })
      });
      if (!response.ok) throw new Error('Failed to synthesize signals');
      return response.json();
    },
    enabled: false
  });

  const getSignalIcon = (type: string) => {
    if (type === 'BUY') return <ArrowUp className="w-6 h-6 text-green-400" />;
    if (type === 'SELL') return <ArrowDown className="w-6 h-6 text-red-400" />;
    return <Minus className="w-6 h-6 text-gray-400" />;
  };

  const getSignalColor = (type: string) => {
    if (type === 'BUY') return 'from-green-600 to-emerald-600';
    if (type === 'SELL') return 'from-red-600 to-rose-600';
    return 'from-gray-600 to-slate-600';
  };

  const strategyNames: Record<string, string> = {
    'gradient_trend_filter': 'Gradient Trend Filter',
    'ut_bot': 'UT Bot',
    'mean_reversion': 'Mean Reversion',
    'volume_profile': 'Volume Profile',
    'market_structure': 'Market Structure'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setLocation('/')}
              className="flex items-center text-slate-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back</span>
            </button>

            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Strategy Synthesis
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Smart multi-strategy signal synthesis</p>
            </div>

            <div className="w-24" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="1h">1 Hour</option>
              <option value="4h">4 Hours</option>
              <option value="1d">1 Day</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20"
            >
              {isLoading ? 'Synthesizing...' : 'Synthesize Signal'}
            </button>
          </div>
        </div>

        {data && (
          <>
            {/* Main Signal Card */}
            <div className={`bg-gradient-to-r ${getSignalColor(data.signal.type)} rounded-xl p-6 mb-6 shadow-xl`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getSignalIcon(data.signal.type)}
                  <div>
                    <h2 className="text-2xl font-bold text-white">{data.signal.type}</h2>
                    <p className="text-white/80 text-sm">Synthesized Signal</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">${data.signal.price.toFixed(2)}</p>
                  <p className="text-white/80 text-sm">Entry Price</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 bg-black/20 rounded-lg p-4">
                <div>
                  <p className="text-white/60 text-xs mb-1">Confidence</p>
                  <p className="text-white font-semibold">{(data.signal.confidence * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-1">Strength</p>
                  <p className="text-white font-semibold">{(data.signal.strength * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-1">Stop Loss</p>
                  <p className="text-white font-semibold">${data.signal.stopLoss.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs mb-1">Take Profit</p>
                  <p className="text-white font-semibold">${data.signal.takeProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Confidence Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-400" />
                  Confidence Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(data.signal.confidenceBreakdown).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-white font-semibold">{(value * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.abs(value) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-400" />
                  Market Regime
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Type</span>
                    <span className="text-white font-semibold">{data.signal.regimeContext.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Volatility</span>
                    <span className="text-white font-semibold capitalize">{data.signal.regimeContext.volatility}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Momentum</span>
                    <span className="text-white font-semibold">{data.signal.regimeContext.momentum.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Trend</span>
                    <span className="text-white font-semibold capitalize">{data.signal.regimeContext.trend}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategy Weights */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-400" />
                Strategy Weights
              </h3>
              <div className="space-y-4">
                {data.weights.map((weight) => (
                  <div key={weight.strategyId} className="bg-slate-800/30 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">{strategyNames[weight.strategyId]}</span>
                      <span className="text-lg font-bold text-blue-400">{(weight.finalWeight * 100).toFixed(1)}%</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Base</span>
                        <p className="text-white font-semibold">{(weight.baseWeight * 100).toFixed(0)}%</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Regime</span>
                        <p className="text-white font-semibold">×{weight.regimeMultiplier.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Volatility</span>
                        <p className="text-white font-semibold">×{weight.volatilityMultiplier.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Momentum</span>
                        <p className="text-white font-semibold">×{weight.momentumAlignment.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Decay</span>
                        <p className="text-white font-semibold">×{weight.temporalDecay.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!data && !isLoading && (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Click "Synthesize Signal" to generate a multi-strategy signal</p>
          </div>
        )}
      </div>
    </div>
  );
}
