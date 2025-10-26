import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Play, Download, Settings, BarChart3, TrendingUp, TrendingDown, Calendar, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Mock backtest data - replace with real data from API
const mockBacktestData = {
  results: [
    {
      id: '1',
      name: 'BTC/USDT Momentum Strategy',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      period: '2024-01-01 to 2024-10-19',
      totalReturn: 45.2,
      annualizedReturn: 38.7,
      maxDrawdown: -12.3,
      sharpeRatio: 1.85,
      winRate: 68.5,
      totalTrades: 156,
      profitFactor: 2.1,
      status: 'completed',
      createdAt: new Date('2024-10-15')
    },
    {
      id: '2',
      name: 'ETH/USDT Mean Reversion',
      symbol: 'ETH/USDT',
      timeframe: '4h',
      period: '2024-06-01 to 2024-10-19',
      totalReturn: 23.8,
      annualizedReturn: 28.4,
      maxDrawdown: -8.7,
      sharpeRatio: 1.42,
      winRate: 72.1,
      totalTrades: 89,
      profitFactor: 1.8,
      status: 'completed',
      createdAt: new Date('2024-10-10')
    },
    {
      id: '3',
      name: 'SOL/USDT Breakout Strategy',
      symbol: 'SOL/USDT',
      timeframe: '1d',
      period: '2024-03-01 to 2024-10-19',
      totalReturn: 67.9,
      annualizedReturn: 52.3,
      maxDrawdown: -15.2,
      sharpeRatio: 2.1,
      winRate: 61.2,
      totalTrades: 234,
      profitFactor: 2.4,
      status: 'running',
      createdAt: new Date('2024-10-18')
    }
  ],
  strategies: [
    { id: 'momentum', name: 'Momentum Strategy', description: 'Follows trend direction' },
    { id: 'mean_reversion', name: 'Mean Reversion', description: 'Trades against extremes' },
    { id: 'breakout', name: 'Breakout Strategy', description: 'Trades breakouts' },
    { id: 'scalping', name: 'Scalping Strategy', description: 'Quick profit trades' }
  ]
};

export default function BacktestPage() {
  const [, setLocation] = useLocation();
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Fetch backtest data from API
  const { data: backtestData, isLoading, error, refetch } = useQuery({
    queryKey: ['backtest-data'],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/backtest/results');
      // return response.json();
      return mockBacktestData;
    },
    refetchInterval: 5000, // Refresh every 5 seconds for running backtests
  });

  const handleRunBacktest = async () => {
    if (!selectedStrategy || !selectedSymbol || !selectedTimeframe) {
      alert('Please select strategy, symbol, and timeframe');
      return;
    }

    setIsRunning(true);
    try {
      // TODO: Implement actual backtest API call
      // await fetch('/api/backtest/run', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ strategy: selectedStrategy, symbol: selectedSymbol, timeframe: selectedTimeframe })
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetch();
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'running': return 'text-blue-500 bg-blue-100 dark:bg-blue-900';
      case 'failed': return 'text-red-500 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getReturnColor = (returnValue: number) => {
    return returnValue >= 0 ? 'text-green-500' : 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading backtest results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Backtests</h2>
          <p className="text-slate-400 mb-4">Failed to load backtest results</p>
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
                Strategy Backtesting
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Test your strategies with historical data</p>
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
                title="Backtest Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backtest Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Run New Backtest */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl shadow-blue-500/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Run New Backtest</h2>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Strategy Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Strategy
              </label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Strategy</option>
                {backtestData?.strategies.map(strategy => (
                  <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                ))}
              </select>
            </div>

            {/* Symbol Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Symbol
              </label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Symbol</option>
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="ETH/USDT">ETH/USDT</option>
                <option value="SOL/USDT">SOL/USDT</option>
                <option value="ADA/USDT">ADA/USDT</option>
                <option value="DOT/USDT">DOT/USDT</option>
              </select>
            </div>

            {/* Timeframe Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Timeframe
              </label>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Timeframe</option>
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>

            {/* Run Button */}
            <div className="flex items-end">
              <button
                onClick={handleRunBacktest}
                disabled={isRunning || !selectedStrategy || !selectedSymbol || !selectedTimeframe}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                {isRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Backtest
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Backtest Results */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Backtest Results</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {backtestData?.results.map((result) => (
              <div key={result.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5">
                {/* Result Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">{result.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                    {result.status}
                  </span>
                </div>

                {/* Symbol and Timeframe */}
                <div className="flex items-center space-x-4 mb-4 text-sm text-slate-400">
                  <span className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-1" />
                    {result.symbol}
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {result.timeframe}
                  </span>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Return</span>
                    <span className={`font-semibold ${getReturnColor(result.totalReturn)}`}>
                      {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Annualized Return</span>
                    <span className={`font-semibold ${getReturnColor(result.annualizedReturn)}`}>
                      {result.annualizedReturn >= 0 ? '+' : ''}{result.annualizedReturn}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Drawdown</span>
                    <span className="font-semibold text-red-500">{result.maxDrawdown}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sharpe Ratio</span>
                    <span className="font-semibold text-white">{result.sharpeRatio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate</span>
                    <span className="font-semibold text-white">{result.winRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Trades</span>
                    <span className="font-semibold text-white">{result.totalTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Profit Factor</span>
                    <span className="font-semibold text-white">{result.profitFactor}</span>
                  </div>
                </div>

                {/* Period */}
                <div className="mb-4 pt-4 border-t border-slate-700/30">
                  <div className="flex items-center text-sm text-slate-400">
                    <Calendar className="w-4 h-4 mr-1" />
                    {result.period}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
                    View Details
                  </button>
                  <button className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all">
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {backtestData?.results.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-block p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 mb-6">
                <BarChart3 className="w-16 h-16 text-slate-600 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Backtest Results</h3>
              <p className="text-slate-500">Run your first backtest to see results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
