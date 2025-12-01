
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Waves, Activity, Wind, Zap, TrendingUp, TrendingDown, Info, BarChart3, Play } from 'lucide-react';
import FlowFieldVisualizer from '@/components/FlowFieldVisualizer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'LINK/USDT'];

interface FlowFieldData {
  latestForce: number;
  averageForce: number;
  maxForce: number;
  forceDirection: number;
  pressure: number;
  averagePressure: number;
  pressureTrend: 'rising' | 'falling' | 'stable';
  turbulence: number;
  turbulenceLevel: 'low' | 'medium' | 'high' | 'extreme';
  energyGradient: number;
  energyTrend: 'accelerating' | 'decelerating' | 'stable';
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
  forceVectors: Array<{
    timestamp: number;
    fx: number;
    fy: number;
    magnitude: number;
    angle: number;
  }>;
}

export default function FlowFieldPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [backtestConfig, setBacktestConfig] = useState({
    initialCapital: 10000,
    positionSize: 0.1,
    stopLossPercent: 0.02,
    takeProfitPercent: 0.05,
    minConfidence: 60
  });
  const [showBacktest, setShowBacktest] = useState(false);

  // Fetch chart data first
  const { data: chartData } = useQuery({
    queryKey: ['coingecko-chart', selectedSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/coingecko/chart?symbol=${encodeURIComponent(selectedSymbol)}&days=7`);
      if (!res.ok) throw new Error('Failed to fetch chart data');
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Fetch historical data for backtesting (30 days)
  const { data: historicalData } = useQuery({
    queryKey: ['coingecko-chart-historical', selectedSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/coingecko/chart?symbol=${encodeURIComponent(selectedSymbol)}&days=30`);
      if (!res.ok) throw new Error('Failed to fetch historical data');
      return res.json();
    },
    enabled: showBacktest,
  });

  // Backtest mutation
  const backtestMutation = useMutation({
    mutationFn: async () => {
      const flowFieldPoints = historicalData.map((d: any) => ({
        timestamp: d.timestamp,
        price: d.close,
        volume: d.volume,
        bidVolume: d.volume * 0.52,
        askVolume: d.volume * 0.48,
        high: d.high,
        low: d.low,
        open: d.open,
        close: d.close
      }));

      const res = await fetch('/api/analytics/backtest/flow-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historicalData: flowFieldPoints,
          config: backtestConfig
        })
      });

      if (!res.ok) throw new Error('Backtest failed');
      return res.json();
    }
  });

  // Fetch flow field data
  const { data: flowFieldData, isLoading } = useQuery<FlowFieldData>({
    queryKey: ['flow-field', selectedSymbol, chartData?.length],
    queryFn: async () => {
      if (!chartData || chartData.length < 2) {
        throw new Error('Insufficient data');
      }

      const flowFieldPoints = chartData.map((d: any) => ({
        timestamp: d.timestamp,
        price: d.close,
        volume: d.volume,
        bidVolume: d.volume * 0.52,
        askVolume: d.volume * 0.48,
        high: d.high,
        low: d.low,
        open: d.open,
        close: d.close
      }));

      const res = await fetch('/api/analytics/flow-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: flowFieldPoints })
      });

      if (!res.ok) throw new Error('Failed to compute flow field');
      const result = await res.json();
      return result.result;
    },
    enabled: !!chartData && chartData.length >= 2,
    refetchInterval: 30000,
  });

  // Interpretation helpers
  const getDirectionIcon = (direction: string) => {
    if (direction === 'bullish') return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (direction === 'bearish') return <TrendingDown className="w-5 h-5 text-red-400" />;
    return <Activity className="w-5 h-5 text-yellow-400" />;
  };

  const getTurbulenceColor = (level: string) => {
    const colors = {
      low: 'text-green-400 bg-green-500/10 border-green-500/30',
      medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
      high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      extreme: 'text-red-400 bg-red-500/10 border-red-500/30'
    };
    return colors[level as keyof typeof colors] || colors.medium;
  };

  const getInterpretation = (data: FlowFieldData) => {
    const insights: string[] = [];

    // Force interpretation
    if (data.latestForce > data.averageForce * 1.3) {
      insights.push(`Strong ${data.dominantDirection} momentum detected - force is ${((data.latestForce / data.averageForce - 1) * 100).toFixed(0)}% above average`);
    } else if (data.latestForce < data.averageForce * 0.7) {
      insights.push('Weakening momentum - force below average');
    }

    // Turbulence interpretation
    if (data.turbulenceLevel === 'low') {
      insights.push('Low turbulence indicates a clean trend with high confidence');
    } else if (data.turbulenceLevel === 'extreme') {
      insights.push('⚠️ Extreme turbulence detected - highly unstable market conditions');
    }

    // Pressure interpretation
    if (data.pressure > data.averagePressure * 1.5) {
      insights.push(`High market pressure (${data.pressureTrend}) - potential ${data.pressureTrend === 'rising' ? 'reversal or breakout' : 'consolidation'}`);
    }

    // Energy interpretation
    if (data.energyTrend === 'accelerating' && data.dominantDirection !== 'neutral') {
      insights.push(`Momentum is accelerating in ${data.dominantDirection} direction - strong trend continuation signal`);
    } else if (data.energyTrend === 'decelerating') {
      insights.push('Energy decelerating - potential trend exhaustion or reversal');
    }

    return insights;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Flow Field Engine
            </h1>
            <p className="text-slate-400 text-sm">Physics-based market analysis with force vectors, pressure fields, and turbulence metrics</p>
          </div>
        </div>
      </div>

      {/* Symbol Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Select Symbol</label>
        <div className="flex flex-wrap gap-2">
          {SYMBOLS.map(symbol => (
            <button
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedSymbol === symbol
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-slate-700/50'
              }`}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {/* Flow Field Data */}
      {flowFieldData && (
        <div className="space-y-6">
          {/* Key Insights */}
          <div className="bg-gradient-to-br from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Info className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Market Insights</h2>
            </div>
            <div className="space-y-2">
              {getInterpretation(flowFieldData).map((insight, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2"></div>
                  <p className="text-slate-300 text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Force Card */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-medium text-slate-300">Force</span>
                </div>
                {getDirectionIcon(flowFieldData.dominantDirection)}
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {(flowFieldData.latestForce * 100).toFixed(2)}%
              </div>
              <div className="text-xs text-slate-400">
                Avg: {(flowFieldData.averageForce * 100).toFixed(2)}%
              </div>
              <div className={`mt-3 px-2 py-1 rounded text-xs font-medium inline-block ${
                flowFieldData.dominantDirection === 'bullish' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                flowFieldData.dominantDirection === 'bearish' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
              }`}>
                {flowFieldData.dominantDirection.toUpperCase()}
              </div>
            </div>

            {/* Pressure Card */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-orange-400" />
                  <span className="text-sm font-medium text-slate-300">Pressure</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {(flowFieldData.pressure * 100).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">
                Avg: {(flowFieldData.averagePressure * 100).toFixed(2)}
              </div>
              <div className={`mt-3 px-2 py-1 rounded text-xs font-medium inline-block ${
                flowFieldData.pressureTrend === 'rising' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' :
                flowFieldData.pressureTrend === 'falling' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' :
                'bg-slate-500/10 text-slate-400 border border-slate-500/30'
              }`}>
                {flowFieldData.pressureTrend.toUpperCase()}
              </div>
            </div>

            {/* Turbulence Card */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Wind className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-slate-300">Turbulence</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {(flowFieldData.turbulence * 10000).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 mb-3">
                Chaos level
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium inline-block border ${getTurbulenceColor(flowFieldData.turbulenceLevel)}`}>
                {flowFieldData.turbulenceLevel.toUpperCase()}
              </div>
            </div>

            {/* Energy Card */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium text-slate-300">Energy</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {(flowFieldData.energyGradient * 1000).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400 mb-3">
                Gradient
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium inline-block ${
                flowFieldData.energyTrend === 'accelerating' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                flowFieldData.energyTrend === 'decelerating' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                'bg-slate-500/10 text-slate-400 border border-slate-500/30'
              }`}>
                {flowFieldData.energyTrend.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Visualizer */}
          <FlowFieldVisualizer 
            data={flowFieldData} 
            symbol={selectedSymbol}
            width={1200}
            height={500}
          />

          {/* Trading Recommendations */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Trading Recommendations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Entry Conditions</h3>
                <div className="space-y-2 text-sm text-slate-400">
                  {flowFieldData.latestForce > flowFieldData.averageForce * 1.2 && flowFieldData.turbulenceLevel === 'low' ? (
                    <p className="text-green-400">✓ Optimal - Strong force with low turbulence</p>
                  ) : flowFieldData.turbulenceLevel === 'extreme' ? (
                    <p className="text-red-400">✗ Avoid - Extreme turbulence detected</p>
                  ) : (
                    <p className="text-yellow-400">○ Wait - Conditions not optimal</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Risk Adjustment</h3>
                <div className="space-y-2 text-sm text-slate-400">
                  {flowFieldData.turbulenceLevel === 'low' ? (
                    <p>Recommend: Tighter stops (0.8x normal)</p>
                  ) : flowFieldData.turbulenceLevel === 'extreme' ? (
                    <p>Recommend: Very wide stops (1.5x normal) or avoid</p>
                  ) : (
                    <p>Recommend: Normal stop loss</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Backtesting Section */}
          <Card className="bg-gradient-to-br from-purple-900/20 via-indigo-900/20 to-blue-900/20 border border-purple-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Flow Field Backtesting
                </CardTitle>
                <Button
                  onClick={() => setShowBacktest(!showBacktest)}
                  variant="outline"
                  size="sm"
                  className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                >
                  {showBacktest ? 'Hide' : 'Show'} Backtest
                </Button>
              </div>
            </CardHeader>
            {showBacktest && (
              <CardContent className="space-y-4">
                {/* Configuration */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <Label className="text-slate-300 text-xs">Initial Capital</Label>
                    <Input
                      type="number"
                      value={backtestConfig.initialCapital}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, initialCapital: Number(e.target.value) })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Position Size</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={backtestConfig.positionSize}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, positionSize: Number(e.target.value) })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Stop Loss %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={backtestConfig.stopLossPercent}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, stopLossPercent: Number(e.target.value) })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Take Profit %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={backtestConfig.takeProfitPercent}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, takeProfitPercent: Number(e.target.value) })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Min Confidence</Label>
                    <Input
                      type="number"
                      value={backtestConfig.minConfidence}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, minConfidence: Number(e.target.value) })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => backtestMutation.mutate()}
                  disabled={backtestMutation.isPending || !historicalData}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {backtestMutation.isPending ? 'Running Backtest...' : 'Run Backtest (30 Days)'}
                </Button>

                {/* Results */}
                {backtestMutation.data && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-slate-900/50 border-slate-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-slate-400">Total Trades</div>
                          <div className="text-xl font-bold text-white">{backtestMutation.data.results?.totalTrades || 0}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-900/50 border-slate-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-slate-400">Win Rate</div>
                          <div className="text-xl font-bold text-green-400">
                            {backtestMutation.data.results?.winRate?.toFixed(1) || 0}%
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-900/50 border-slate-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-slate-400">Total P&L</div>
                          <div className={`text-xl font-bold ${(backtestMutation.data.results?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${backtestMutation.data.results?.totalPnl?.toFixed(2) || 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-900/50 border-slate-700/50">
                        <CardContent className="p-4">
                          <div className="text-xs text-slate-400">Sharpe Ratio</div>
                          <div className="text-xl font-bold text-white">
                            {backtestMutation.data.results?.sharpeRatio?.toFixed(2) || 0}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {backtestMutation.data.report && (
                      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-white mb-2">Flow Field Insights</h3>
                        <div className="space-y-1 text-xs text-slate-300">
                          <p>• Avg Force (Winners): {backtestMutation.data.report.avgForceWinners?.toFixed(4) || 'N/A'}</p>
                          <p>• Avg Force (Losers): {backtestMutation.data.report.avgForceLosers?.toFixed(4) || 'N/A'}</p>
                          <p>• Avg Turbulence (Winners): {backtestMutation.data.report.avgTurbulenceWinners?.toFixed(4) || 'N/A'}</p>
                          <p>• Signal Accuracy: {backtestMutation.data.report.signalAccuracy?.toFixed(1) || 'N/A'}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {backtestMutation.isError && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                    Backtest failed. Please try again.
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
