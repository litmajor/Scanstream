
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Play, Download, Settings, BarChart3, TrendingUp, TrendingDown, Calendar, Clock, Trash2, Zap } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BounceBacktestComponent from '../components/BounceBacktestComponent';

interface BacktestResult {
  id: string;
  strategyId: string;
  name?: string;
  symbol?: string;
  timeframe?: string;
  period?: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn?: number;
  annualizedReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  winRate?: number;
  totalTrades?: number;
  profitFactor?: number;
  status?: string;
  createdAt: string;
  metrics: {
    totalReturn?: number;
    annualizedReturn?: number;
    maxDrawdown?: number;
    sharpeRatio?: number;
    winRate?: number;
    totalTrades?: number;
    profitFactor?: number;
    sortinoRatio?: number;
    calmarRatio?: number;
  };
  performance: any;
  equityCurve: any[];
  monthlyReturns: any[];
  trades: any[];
}

interface Strategy {
  id: string;
  name: string;
  description: string;
}

export default function BacktestPage() {
  const [, setLocation] = useLocation();
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [showBounceBacktest, setShowBounceBacktest] = useState(false);
  const queryClient = useQueryClient();

  // Fetch available strategies
  const { data: strategiesData } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const response = await fetch('/api/strategies');
      if (!response.ok) throw new Error('Failed to fetch strategies');
      return response.json();
    },
  });

  // Fetch backtest results
  const { data: backtestData, isLoading, error, refetch } = useQuery<{ results: BacktestResult[] }>({
    queryKey: ['backtest-results'],
    queryFn: async () => {
      const response = await fetch('/api/strategies/backtest/results');
      if (!response.ok) throw new Error('Failed to fetch backtest results');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Run backtest mutation
  const runBacktestMutation = useMutation({
    mutationFn: async (params: {
      strategyId: string;
      symbol: string;
      timeframe: string;
      startDate: string;
      endDate: string;
      initialCapital: number;
    }) => {
      const response = await fetch('/api/strategies/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to run backtest');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
    },
  });

  // Delete backtest mutation
  const deleteBacktestMutation = useMutation({
    mutationFn: async (backtestId: string) => {
      const response = await fetch(`/api/strategies/backtest/${backtestId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete backtest');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backtest-results'] });
    },
  });

  const handleRunBacktest = async () => {
    if (!selectedStrategy || !selectedSymbol || !selectedTimeframe) {
      alert('Please select strategy, symbol, and timeframe');
      return;
    }

    try {
      await runBacktestMutation.mutateAsync({
        strategyId: selectedStrategy,
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        startDate,
        endDate,
        initialCapital,
      });
    } catch (error: any) {
      alert(error.message || 'Failed to run backtest');
    }
  };

  const handleDeleteBacktest = async (backtestId: string) => {
    if (!confirm('Are you sure you want to delete this backtest?')) return;
    try {
      await deleteBacktestMutation.mutateAsync(backtestId);
    } catch (error: any) {
      alert(error.message || 'Failed to delete backtest');
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'running': return 'text-blue-500 bg-blue-100 dark:bg-blue-900';
      case 'failed': return 'text-red-500 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getReturnColor = (returnValue?: number) => {
    if (!returnValue) return 'text-gray-500';
    return returnValue >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const formatMetric = (value?: number, decimals = 2) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(decimals);
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
          <p className="text-slate-400 mb-4">{error.message}</p>
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

  const strategies = strategiesData?.strategies || [];
  const results = backtestData?.results || [];

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
            <button
              onClick={() => setLocation('/')}
              className="flex items-center text-slate-400 hover:text-white transition-all hover:translate-x-[-2px]"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Dashboard</span>
            </button>

            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Strategy Backtesting
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Test your strategies with historical data</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowBounceBacktest(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 rounded-lg transition-all text-white font-medium shadow-lg shadow-pink-500/20"
                title="Bounce Strategy Backtest"
              >
                <Zap className="w-4 h-4" />
                <span>Bounce Backtest</span>
              </button>
              <button
                onClick={() => refetch()}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Refresh Results"
              >
                <Download className="w-4 h-4" />
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Strategy Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="">Select Strategy</option>
                {strategies.map((strategy: Strategy) => (
                  <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                ))}
              </select>
            </div>

            {/* Symbol Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="ETH/USDT">ETH/USDT</option>
                <option value="SOL/USDT">SOL/USDT</option>
                <option value="ADA/USDT">ADA/USDT</option>
                <option value="DOT/USDT">DOT/USDT</option>
              </select>
            </div>

            {/* Timeframe Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Timeframe</label>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="4h">4 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>

            {/* Initial Capital */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Initial Capital ($)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              />
            </div>

            {/* Run Button */}
            <div className="flex items-end">
              <button
                onClick={handleRunBacktest}
                disabled={runBacktestMutation.isPending || !selectedStrategy || !selectedSymbol || !selectedTimeframe}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                {runBacktestMutation.isPending ? (
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
          <h2 className="text-lg font-semibold text-white">Backtest Results ({results.length})</h2>
          
          {results.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 mb-6">
                <BarChart3 className="w-16 h-16 text-slate-600 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Backtest Results</h3>
              <p className="text-slate-500">Run your first backtest to see results here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map((result) => {
                const metrics = result.metrics || {};
                const totalReturn = metrics.totalReturn ?? result.totalReturn ?? 
                  ((result.finalCapital - result.initialCapital) / result.initialCapital * 100);
                
                return (
                  <div key={result.id} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5">
                    {/* Result Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white truncate flex-1">
                        {result.name || strategies.find(s => s.id === result.strategyId)?.name || 'Unknown Strategy'}
                      </h3>
                      <button
                        onClick={() => handleDeleteBacktest(result.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all text-red-400 hover:text-red-300"
                        title="Delete backtest"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Symbol and Timeframe */}
                    <div className="flex items-center space-x-4 mb-4 text-sm text-slate-400">
                      <span className="flex items-center">
                        <BarChart3 className="w-4 h-4 mr-1" />
                        {result.symbol || 'N/A'}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {result.timeframe || 'N/A'}
                      </span>
                    </div>

                    {/* Performance Metrics */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Return</span>
                        <span className={`font-semibold ${getReturnColor(totalReturn)}`}>
                          {totalReturn >= 0 ? '+' : ''}{formatMetric(totalReturn)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sharpe Ratio</span>
                        <span className="font-semibold text-white">{formatMetric(metrics.sharpeRatio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Drawdown</span>
                        <span className="font-semibold text-red-500">{formatMetric(metrics.maxDrawdown)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Win Rate</span>
                        <span className="font-semibold text-white">{formatMetric(metrics.winRate)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Trades</span>
                        <span className="font-semibold text-white">{metrics.totalTrades || 0}</span>
                      </div>
                    </div>

                    {/* Period */}
                    <div className="mb-4 pt-4 border-t border-slate-700/30">
                      <div className="flex items-center text-sm text-slate-400">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Capital Summary */}
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>
                        <span className="text-slate-500">Initial</span>
                        <p className="text-white font-semibold">${formatMetric(result.initialCapital, 0)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Final</span>
                        <p className="text-white font-semibold">${formatMetric(result.finalCapital, 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bounce Strategy Backtest Modal */}
        {showBounceBacktest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 p-4">
            <BounceBacktestComponent onClose={() => setShowBounceBacktest(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
