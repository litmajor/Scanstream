
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Activity, TrendingUp, Zap, Target, BarChart3, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function FlowEnginePage() {
  const [, setLocation] = useLocation();
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');

  // Fetch flow field data
  const { data: flowData, isLoading, refetch } = useQuery({
    queryKey: ['flow-field', selectedSymbol, selectedTimeframe],
    queryFn: async () => {
      const response = await fetch(`/api/flow-field/analyze?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`);
      if (!response.ok) throw new Error('Failed to fetch flow field data');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch flow field backtest
  const { data: backtestData } = useQuery({
    queryKey: ['flow-backtest', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/flow-field/backtest?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}&days=30`);
      if (!response.ok) throw new Error('Failed to fetch backtest');
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="relative border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/30">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setLocation('/')}
                className="flex items-center text-slate-400 hover:text-white transition-all"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                <span className="font-medium">Dashboard</span>
              </button>
              <div className="h-6 w-px bg-slate-700"></div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Flow Engine Intelligence
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Market flow field analysis & interpretations</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm"
              >
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="ETH/USDT">ETH/USDT</option>
                <option value="SOL/USDT">SOL/USDT</option>
              </select>

              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-200 text-sm"
              >
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="4h">4h</option>
                <option value="1d">1d</option>
              </select>

              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-all"
              >
                <Activity className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading flow field data...</p>
          </div>
        ) : flowData ? (
          <>
            {/* Flow Metrics Overview */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Flow Strength</span>
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-white">{flowData.flow_strength?.toFixed(2) || 'N/A'}</p>
                <p className="text-xs text-slate-500 mt-1">{flowData.flow_direction || 'Unknown'}</p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Divergence Score</span>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-white">{flowData.divergence_score?.toFixed(2) || 'N/A'}</p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Momentum Alignment</span>
                  <Target className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-2xl font-bold text-white">{(flowData.momentum_alignment * 100)?.toFixed(0) || 'N/A'}%</p>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Signal Quality</span>
                  <BarChart3 className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-2xl font-bold text-white">{flowData.signal_quality || 'N/A'}</p>
              </div>
            </div>

            {/* Flow Interpretation */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Flow Field Interpretation</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Market Structure</h3>
                  <p className="text-slate-400">{flowData.interpretation?.market_structure || 'Analyzing market structure...'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Flow Analysis</h3>
                  <p className="text-slate-400">{flowData.interpretation?.flow_analysis || 'Flow field patterns detected.'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Trading Recommendation</h3>
                  <p className="text-slate-400">{flowData.interpretation?.recommendation || 'Based on flow dynamics...'}</p>
                </div>
              </div>
            </div>

            {/* Backtest Results */}
            {backtestData && (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Backtest Performance (30 days)</h2>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-slate-400">Total Return</span>
                    <p className="text-lg font-bold text-green-400">{backtestData.total_return?.toFixed(2)}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Win Rate</span>
                    <p className="text-lg font-bold text-white">{backtestData.win_rate?.toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Sharpe Ratio</span>
                    <p className="text-lg font-bold text-white">{backtestData.sharpe_ratio?.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-400">No flow field data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
