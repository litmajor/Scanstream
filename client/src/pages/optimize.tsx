import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Settings, Play, Download, Target, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Mock optimization data - replace with real data from API
const mockOptimizationData = {
  strategies: [
    {
      id: '1',
      name: 'BTC Momentum Strategy',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      parameters: {
        rsiPeriod: 14,
        emaPeriod: 20,
        volumeThreshold: 1.5,
        stopLoss: 0.02,
        takeProfit: 0.04
      },
      performance: {
        totalReturn: 45.2,
        sharpeRatio: 1.85,
        maxDrawdown: -12.3,
        winRate: 68.5,
        profitFactor: 2.1
      },
      status: 'optimized',
      lastOptimized: new Date('2024-10-18')
    },
    {
      id: '2',
      name: 'ETH Mean Reversion',
      symbol: 'ETH/USDT',
      timeframe: '4h',
      parameters: {
        rsiPeriod: 21,
        emaPeriod: 50,
        volumeThreshold: 1.2,
        stopLoss: 0.015,
        takeProfit: 0.03
      },
      performance: {
        totalReturn: 23.8,
        sharpeRatio: 1.42,
        maxDrawdown: -8.7,
        winRate: 72.1,
        profitFactor: 1.8
      },
      status: 'optimizing',
      lastOptimized: new Date('2024-10-19')
    }
  ],
  optimizationResults: [
    {
      parameter: 'RSI Period',
      current: 14,
      optimized: 21,
      improvement: 15.2,
      impact: 'high'
    },
    {
      parameter: 'EMA Period',
      current: 20,
      optimized: 50,
      improvement: 8.7,
      impact: 'medium'
    },
    {
      parameter: 'Stop Loss',
      current: 0.02,
      optimized: 0.015,
      improvement: 12.3,
      impact: 'high'
    },
    {
      parameter: 'Take Profit',
      current: 0.04,
      optimized: 0.03,
      improvement: -2.1,
      impact: 'low'
    }
  ],
  agents: [
    { id: 'scanner', name: 'Scanner Agent', status: 'active', performance: 0.87 },
    { id: 'ml', name: 'ML Agent', status: 'active', performance: 0.92 },
    { id: 'risk', name: 'Risk Agent', status: 'active', performance: 0.78 }
  ]
};

export default function OptimizePage() {
  const [, setLocation] = useLocation();
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Fetch optimization data from API
  const { data: optimizationData, isLoading, error, refetch } = useQuery({
    queryKey: ['optimization-data'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/optimize/strategies');
      // return response.json();
      return mockOptimizationData;
    },
    refetchInterval: 5000, // Refresh every 5 seconds for running optimizations
  });

  const handleOptimize = async () => {
    if (!selectedStrategy) {
      alert('Please select a strategy to optimize');
      return;
    }

    setIsOptimizing(true);
    try {
      // TODO: Implement actual optimization API call
      // await fetch('/api/optimize/run', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ strategyId: selectedStrategy })
      // });
      
      // Simulate optimization
      await new Promise(resolve => setTimeout(resolve, 3000));
      await refetch();
    } finally {
      setIsOptimizing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimized': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'optimizing': return 'text-blue-500 bg-blue-100 dark:bg-blue-900';
      case 'failed': return 'text-red-500 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading optimization data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Optimization</h2>
          <p className="text-slate-400 mb-4">Failed to load optimization data</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg transition-all text-white font-semibold shadow-lg shadow-blue-500/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
                Strategy Optimization
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Optimize strategy parameters for maximum performance</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Export Results"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Optimization Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optimization Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Agent Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {optimizationData?.agents.map((agent) => (
            <div key={agent.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-400">{agent.name}</p>
                  <p className="text-2xl font-semibold text-white">
                    {(agent.performance * 100).toFixed(1)}%
                  </p>
                  <p className={`text-xs ${agent.status === 'active' ? 'text-green-500' : 'text-red-500'}`}>
                    {agent.status}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Run Optimization */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl shadow-blue-500/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Run Optimization</h2>
            <Target className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Strategy
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Strategy to Optimize</option>
                {optimizationData?.strategies.map(strategy => (
                  <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleOptimize}
                disabled={isOptimizing || !selectedStrategy}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                {isOptimizing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Optimization
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Optimization Results */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white mb-4">Parameter Optimization Results</h2>
          
          <div className="space-y-4">
            {optimizationData?.optimizationResults.map((result, index) => (
              <div key={index} className="border border-slate-700/30 bg-slate-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">{result.parameter}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(result.impact)}`}>
                    {result.impact} impact
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Current:</span>
                    <span className="ml-2 font-semibold text-white">{result.current}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Optimized:</span>
                    <span className="ml-2 font-semibold text-blue-400">{result.optimized}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Improvement:</span>
                    <span className={`ml-2 font-semibold ${result.improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {result.improvement >= 0 ? '+' : ''}{result.improvement}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategies */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Optimized Strategies</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {optimizationData?.strategies.map((strategy) => (
              <div key={strategy.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5">
                {/* Strategy Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(strategy.status)}`}>
                    {strategy.status}
                  </span>
                </div>

                {/* Strategy Details */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Symbol</span>
                    <span className="text-white font-medium">{strategy.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timeframe</span>
                    <span className="text-white font-medium">{strategy.timeframe}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Return</span>
                    <span className={`font-semibold ${strategy.performance.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {strategy.performance.totalReturn >= 0 ? '+' : ''}{strategy.performance.totalReturn}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sharpe Ratio</span>
                    <span className="font-semibold text-white">{strategy.performance.sharpeRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Drawdown</span>
                    <span className="font-semibold text-red-500">{strategy.performance.maxDrawdown}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate</span>
                    <span className="font-semibold text-white">{strategy.performance.winRate}%</span>
                  </div>
                </div>

                {/* Parameters */}
                <div className="mb-4 pt-4 border-t border-slate-700/30">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Optimized Parameters</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(strategy.parameters).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-400">{key}</span>
                        <span className="text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
                    View Details
                  </button>
                  <button className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all">
                    Deploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
