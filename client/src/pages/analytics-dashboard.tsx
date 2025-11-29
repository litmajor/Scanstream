import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Brain, Target, Zap, BarChart3 } from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  weight: number;
  baseWeight: number;
  regimeMultiplier: number;
  volatilityMultiplier: number;
  momentumAlignment: number;
  temporalDecay: number;
  finalWeight: number;
  performance?: {
    winRate: number;
    profitFactor: number;
    trades: number;
  };
}

interface MLModel {
  id: string;
  name: string;
  type: string;
  symbol: string;
  accuracy: number;
  status: string;
  confidence: number;
  predictions: {
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    nextHour: number;
    nextDay: number;
  };
}

interface MarketRegime {
  type: string;
  volatility: 'low' | 'medium' | 'high';
  momentum: number;
  trend: string;
}

export default function AnalyticsDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');

  // Fetch strategies data
  const { data: strategiesData, isLoading: loadingStrategies } = useQuery({
    queryKey: ['strategies', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/strategies/list?symbol=${selectedSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch strategies');
      return response.json() as Promise<{ strategies: Strategy[]; regime: MarketRegime }>;
    },
  });

  // Fetch ML models data
  const { data: modelsData, isLoading: loadingModels } = useQuery({
    queryKey: ['ml-models', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/ml/models?symbol=${selectedSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch ML models');
      return response.json() as Promise<{ models: MLModel[] }>;
    },
  });

  // Mock data for display
  const mockStrategies: Strategy[] = [
    {
      id: 'gradient_trend_filter',
      name: 'Gradient Trend Filter',
      weight: 0.25,
      baseWeight: 0.25,
      regimeMultiplier: 1.1,
      volatilityMultiplier: 0.95,
      momentumAlignment: 1.05,
      temporalDecay: 0.98,
      finalWeight: 0.27,
      performance: { winRate: 0.68, profitFactor: 2.1, trades: 234 },
    },
    {
      id: 'ut_bot',
      name: 'UT Bot',
      weight: 0.20,
      baseWeight: 0.20,
      regimeMultiplier: 1.0,
      volatilityMultiplier: 1.08,
      momentumAlignment: 0.98,
      temporalDecay: 0.97,
      finalWeight: 0.21,
      performance: { winRate: 0.62, profitFactor: 1.8, trades: 189 },
    },
    {
      id: 'mean_reversion',
      name: 'Mean Reversion',
      weight: 0.20,
      baseWeight: 0.20,
      regimeMultiplier: 0.85,
      volatilityMultiplier: 1.2,
      momentumAlignment: 0.92,
      temporalDecay: 0.96,
      finalWeight: 0.18,
      performance: { winRate: 0.71, profitFactor: 2.3, trades: 156 },
    },
    {
      id: 'volume_profile',
      name: 'Volume Profile',
      weight: 0.20,
      baseWeight: 0.20,
      regimeMultiplier: 1.05,
      volatilityMultiplier: 0.9,
      momentumAlignment: 1.02,
      temporalDecay: 0.99,
      finalWeight: 0.19,
      performance: { winRate: 0.65, profitFactor: 1.9, trades: 201 },
    },
    {
      id: 'market_structure',
      name: 'Market Structure',
      weight: 0.15,
      baseWeight: 0.15,
      regimeMultiplier: 0.92,
      volatilityMultiplier: 1.1,
      momentumAlignment: 0.88,
      temporalDecay: 0.95,
      finalWeight: 0.15,
      performance: { winRate: 0.59, profitFactor: 1.6, trades: 112 },
    },
  ];

  const mockModels: MLModel[] = [
    {
      id: '1',
      name: 'LSTM Price Predictor',
      type: 'LSTM',
      symbol: selectedSymbol,
      accuracy: 87.3,
      status: 'trained',
      confidence: 0.85,
      predictions: { direction: 'UP', nextHour: 45120, nextDay: 46250 },
    },
    {
      id: '2',
      name: 'Random Forest Classifier',
      type: 'Random Forest',
      symbol: selectedSymbol,
      accuracy: 82.1,
      status: 'trained',
      confidence: 0.78,
      predictions: { direction: 'UP', nextHour: 3250, nextDay: 3180 },
    },
    {
      id: '3',
      name: 'Market Sentiment Analyzer',
      type: 'BERT',
      symbol: selectedSymbol,
      accuracy: 91.5,
      status: 'trained',
      confidence: 0.92,
      predictions: { direction: 'UP', nextHour: 98, nextDay: 105 },
    },
  ];

  const mockRegime: MarketRegime = {
    type: 'BULL_STRONG',
    volatility: 'medium',
    momentum: 0.125,
    trend: 'up',
  };

  const strategies = strategiesData?.strategies || mockStrategies;
  const regime = strategiesData?.regime || mockRegime;
  const models = modelsData?.models || mockModels;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Analytics Dashboard</h1>
          <p className="text-slate-400">Strategies, ML Models & Market Regime Analysis</p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 hover:border-slate-500"
          >
            <option>BTC/USDT</option>
            <option>ETH/USDT</option>
            <option>SOL/USDT</option>
            <option>AVAX/USDT</option>
          </select>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 bg-slate-800 text-white rounded border border-slate-700 hover:border-slate-500"
          >
            <option>1h</option>
            <option>4h</option>
            <option>1d</option>
          </select>
        </div>

        {/* Market Regime Card */}
        <Card className="mb-8 p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Current Market Regime
            </h2>
            <Badge className={`px-3 py-1 text-sm font-semibold ${
              regime.type.includes('BULL') ? 'bg-green-500/20 text-green-400 border-green-700' :
              regime.type.includes('BEAR') ? 'bg-red-500/20 text-red-400 border-red-700' :
              'bg-slate-500/20 text-slate-400 border-slate-700'
            } border`}>
              {regime.type}
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-700/30 p-3 rounded">
              <p className="text-slate-400 text-sm">Volatility</p>
              <p className="text-white font-bold text-lg capitalize">{regime.volatility}</p>
            </div>
            <div className="bg-slate-700/30 p-3 rounded">
              <p className="text-slate-400 text-sm">Momentum</p>
              <p className={`font-bold text-lg ${regime.momentum > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(regime.momentum * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-slate-700/30 p-3 rounded">
              <p className="text-slate-400 text-sm">Trend</p>
              <p className="text-white font-bold text-lg capitalize">{regime.trend}</p>
            </div>
            <div className="bg-slate-700/30 p-3 rounded">
              <p className="text-slate-400 text-sm">Symbol</p>
              <p className="text-white font-bold text-lg">{selectedSymbol}</p>
            </div>
          </div>
        </Card>

        {/* Strategies Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Trading Strategies ({strategies.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <Card key={strategy.id} className="p-5 bg-slate-800/50 border-slate-700 hover:border-slate-500 transition">
                <h3 className="font-bold text-white mb-3">{strategy.name}</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Base Weight</span>
                    <span className="text-white font-mono">{(strategy.baseWeight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Final Weight</span>
                    <span className="text-blue-400 font-mono font-bold">{(strategy.finalWeight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                      style={{ width: `${strategy.finalWeight * 100}%` }}
                    />
                  </div>
                </div>
                {strategy.performance && (
                  <div className="pt-3 border-t border-slate-700 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Win Rate</span>
                      <span className="text-green-400">{(strategy.performance.winRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Profit Factor</span>
                      <span className="text-green-400">{strategy.performance.profitFactor.toFixed(2)}x</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Total Trades</span>
                      <span className="text-slate-300">{strategy.performance.trades}</span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* ML Models Grid */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            ML Models ({models.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => (
              <Card key={model.id} className="p-5 bg-slate-800/50 border-slate-700 hover:border-slate-500 transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white">{model.name}</h3>
                    <p className="text-xs text-slate-400">{model.type}</p>
                  </div>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-700 border text-xs">
                    {model.status}
                  </Badge>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Accuracy</span>
                    <span className="text-white font-mono font-bold">{model.accuracy.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                      style={{ width: `${model.accuracy}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Confidence</span>
                    <span className="text-purple-400 font-mono">{(model.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Next 1H Prediction</span>
                    <div className="flex items-center gap-1">
                      {model.predictions.direction === 'UP' && <TrendingUp className="w-4 h-4 text-green-400" />}
                      {model.predictions.direction === 'DOWN' && <TrendingDown className="w-4 h-4 text-red-400" />}
                      <span className="text-xs font-mono text-white">{model.predictions.nextHour}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Next 24H Prediction</span>
                    <span className="text-xs font-mono text-white">{model.predictions.nextDay}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
