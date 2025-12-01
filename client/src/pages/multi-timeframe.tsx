import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Clock, Target, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function MultiTimeframePage() {
  const [, setLocation] = useLocation();
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTimeframes, setSelectedTimeframes] = useState(['1h', '4h', '1d']);

  // Fetch multi-timeframe data from API
  const { data: multiTimeframeData, isLoading, error, refetch } = useQuery({
    queryKey: ['multi-timeframe-data', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/analysis/multi-timeframe?symbol=${selectedSymbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch multi-timeframe analysis');
      }
      const data = await response.json();
      
      // Transform backend data to match UI expectations
      return {
        symbol: data.symbol,
        analysis: {
          overallTrend: data.overallTrend.toLowerCase(),
          confluenceScore: data.multiTimeframeAnalysis?.confluenceScore || 0,
          timeframeAnalysis: data.multiTimeframeAnalysis?.timeframeAnalysis?.map((tf: any) => ({
            timeframe: tf.timeframe,
            trend: tf.trend.toLowerCase(),
            strength: tf.strength,
            signals: tf.signals.map((s: any) => s.type),
            price: tf.signals[0]?.price || 0,
            change: ((tf.signals[0]?.price || 0) / (tf.signals[0]?.stopLoss || 1) - 1) * 100
          })) || []
        },
        recommendations: data.multiTimeframeAnalysis?.timeframeAnalysis
          ?.filter((tf: any) => tf.signals.length > 0)
          .map((tf: any) => {
            const signal = tf.signals[0];
            return {
              action: signal.type,
              confidence: signal.confidence,
              timeframe: tf.timeframe,
              reason: signal.reasoning?.join(', ') || 'Multi-timeframe confluence detected',
              target: signal.takeProfit,
              stopLoss: signal.stopLoss
            };
          }) || []
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'bearish': return 'text-red-500 bg-red-100 dark:bg-red-900';
      case 'neutral': return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getStrengthColor = (strength: number) => {
    if (strength >= 0.8) return 'text-green-500';
    if (strength >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return 'text-green-500 bg-green-100 dark:bg-green-900';
      case 'SELL': return 'text-red-500 bg-red-100 dark:bg-red-900';
      case 'HOLD': return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-900';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading multi-timeframe analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Analysis</h2>
          <p className="text-slate-400 mb-4">Failed to load multi-timeframe analysis</p>
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
                Multi-Timeframe Analysis
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Analyze trends across multiple timeframes</p>
            </div>

            {/* Symbol Selection */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="px-3 py-2 border border-slate-700/50 rounded-lg bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors"
              >
                <option value="BTC/USDT">BTC/USDT</option>
                <option value="ETH/USDT">ETH/USDT</option>
                <option value="SOL/USDT">SOL/USDT</option>
                <option value="AVAX/USDT">AVAX/USDT</option>
                <option value="ADA/USDT">ADA/USDT</option>
                <option value="DOT/USDT">DOT/USDT</option>
                <option value="LINK/USDT">LINK/USDT</option>
                <option value="XRP/USDT">XRP/USDT</option>
                <option value="DOGE/USDT">DOGE/USDT</option>
                <option value="ATOM/USDT">ATOM/USDT</option>
                <option value="ARB/USDT">ARB/USDT</option>
                <option value="OP/USDT">OP/USDT</option>
                <option value="AAVE/USDT">AAVE/USDT</option>
                <option value="UNI/USDT">UNI/USDT</option>
                <option value="NEAR/USDT">NEAR/USDT</option>
              </select>
              <button
                onClick={() => refetch()}
                className="p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all text-slate-300 hover:text-white"
                title="Refresh Analysis"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Timeframe Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overall Analysis */}
        <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl shadow-blue-500/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Overall Analysis</h2>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall Trend */}
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-2">Overall Trend</div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getTrendColor(multiTimeframeData?.analysis.overallTrend || 'neutral')}`}>
                {multiTimeframeData?.analysis.overallTrend?.toUpperCase()}
              </span>
            </div>

            {/* Confluence Score */}
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-2">Confluence Score</div>
              <div className="text-2xl font-bold text-white">
                {((multiTimeframeData?.analysis.confluenceScore || 0) * 100).toFixed(1)}%
              </div>
            </div>

            {/* Current Price */}
            <div className="text-center">
              <div className="text-sm text-slate-400 mb-2">Current Price</div>
              <div className="text-2xl font-bold text-white">
                ${multiTimeframeData?.analysis.timeframeAnalysis[0]?.price?.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Timeframe Analysis */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Timeframe Analysis</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {multiTimeframeData?.analysis.timeframeAnalysis.map((tf: any, index: number) => (
              <div key={tf.timeframe} className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all hover:shadow-xl hover:shadow-blue-500/5">
                {/* Timeframe Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-semibold text-white">{tf.timeframe}</h3>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(tf.trend)}`}>
                    {tf.trend.toUpperCase()}
                  </span>
                </div>

                {/* Price and Change */}
                <div className="mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Price</span>
                    <span className="text-lg font-semibold text-white">
                      ${tf.price?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Change</span>
                    <span className={`font-semibold ${tf.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tf.change >= 0 ? '+' : ''}{tf.change}%
                    </span>
                  </div>
                </div>

                {/* Strength */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400">Strength</span>
                    <span className={`font-semibold ${getStrengthColor(tf.strength)}`}>
                      {(tf.strength * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        tf.strength >= 0.8 ? 'bg-green-500' :
                        tf.strength >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${tf.strength * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Signals */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Signals</h4>
                  <div className="space-y-1">
                    {tf.signals.map((signal: string, signalIndex: number) => (
                      <div key={signalIndex} className="flex items-center text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        <span className="text-slate-400">{signal}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
                    View Chart
                  </button>
                  <button className="flex-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all">
                    Analyze
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl shadow-blue-500/5">
          <h2 className="text-lg font-semibold text-white mb-4">Trading Recommendations</h2>
          
          <div className="space-y-4">
            {multiTimeframeData?.recommendations.map((rec: any, index: number) => (
              <div key={index} className="border border-slate-700/30 bg-slate-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getActionColor(rec.action)}`}>
                    {rec.action}
                  </span>
                  <span className="text-sm text-slate-400">
                    Confidence: {(rec.confidence * 100).toFixed(1)}%
                  </span>
                  <span className="text-sm text-slate-400">
                    Timeframe: {rec.timeframe}
                  </span>
                </div>
              </div>
              
              <div className="mb-3">
                <p className="text-slate-300">{rec.reason}</p>
              </div>
              
              {rec.target && rec.stopLoss && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Target:</span>
                      <span className="ml-2 font-semibold text-green-500">${rec.target.toLocaleString()}</span>
                    </div>
                  <div>
                    <span className="text-slate-400">Stop Loss:</span>
                      <span className="ml-2 font-semibold text-red-500">${rec.stopLoss.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
