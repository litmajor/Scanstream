
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Brain, TrendingUp, Activity, Zap, Target, BarChart3, AlertCircle, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTheme } from '../contexts/ThemeContext';
import { LineChart, Line, ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ClusterData {
  clusterId: number;
  candles: number;
  avgReturn: number;
  volatility: number;
  centroid: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
}

interface PatternDetection {
  pattern: string;
  confidence: number;
  timeframe: string;
  predictedMove: number;
  historicalAccuracy: number;
}

interface MarketRegime {
  regime: 'BULL_EARLY' | 'BULL_LATE' | 'BEAR_EARLY' | 'BEAR_LATE' | 'SIDEWAYS' | 'VOLATILE';
  confidence: number;
  characteristics: {
    trend: number;
    volatility: number;
    volume: number;
  };
  duration: number;
  transitionProbability: Record<string, number>;
}

export default function AdvancedAnalytics() {
  const [, setLocation] = useLocation();
  const { colors } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [timeframe, setTimeframe] = useState('1h');

  // Fetch candle clustering analysis
  const { data: clusterData, isLoading: clustersLoading } = useQuery({
    queryKey: ['analytics-clusters', selectedSymbol, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/clusters?symbol=${selectedSymbol}&timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch cluster data');
      return response.json();
    },
    refetchInterval: 60000
  });

  // Fetch pattern detection
  const { data: patternData, isLoading: patternsLoading } = useQuery({
    queryKey: ['analytics-patterns', selectedSymbol, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/patterns?symbol=${selectedSymbol}&timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch pattern data');
      return response.json();
    },
    refetchInterval: 60000
  });

  // Fetch market regime analysis
  const { data: regimeData, isLoading: regimeLoading } = useQuery({
    queryKey: ['analytics-regime', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/regime?symbol=${selectedSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch regime data');
      return response.json();
    },
    refetchInterval: 30000
  });

  const getRegimeColor = (regime: string) => {
    const colors = {
      'BULL_EARLY': '#22c55e',
      'BULL_LATE': '#84cc16',
      'BEAR_EARLY': '#f59e0b',
      'BEAR_LATE': '#ef4444',
      'SIDEWAYS': '#8b5cf6',
      'VOLATILE': '#ec4899'
    };
    return colors[regime as keyof typeof colors] || '#6b7280';
  };

  const clusterColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <div className="border-b" style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setLocation('/')}
              className="flex items-center transition-all hover:translate-x-[-2px]"
              style={{ color: colors.textSecondary }}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="font-medium">Back to Dashboard</span>
            </button>

            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Advanced Analytics Engine
              </h1>
              <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                Candle Clustering • Pattern Detection • Market Regime Analysis
              </p>
            </div>

            <div className="w-32" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Symbol & Timeframe Selector */}
        <div className="mb-6 rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Symbol</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
              >
                <option>BTC/USDT</option>
                <option>ETH/USDT</option>
                <option>SOL/USDT</option>
                <option>AVAX/USDT</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
              >
                <option>1m</option>
                <option>5m</option>
                <option>15m</option>
                <option>1h</option>
                <option>4h</option>
                <option>1d</option>
              </select>
            </div>
          </div>
        </div>

        {/* Market Regime Analysis */}
        <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center" style={{ color: colors.text }}>
            <Activity className="w-5 h-5 mr-2" style={{ color: colors.accent }} />
            Market Regime Analysis
          </h2>

          {regimeLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-20 rounded-lg" style={{ backgroundColor: colors.surface }} />
            </div>
          ) : regimeData?.regime ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold" style={{ color: getRegimeColor(regimeData.regime.regime) }}>
                    {regimeData.regime.regime.replace('_', ' ')}
                  </div>
                  <div className="text-sm" style={{ color: colors.textSecondary }}>
                    Confidence: {(regimeData.regime.confidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm" style={{ color: colors.textSecondary }}>Duration</div>
                  <div className="font-semibold" style={{ color: colors.text }}>
                    {regimeData.regime.duration} candles
                  </div>
                </div>
              </div>

              {/* Characteristics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <div className="text-xs" style={{ color: colors.textSecondary }}>Trend</div>
                  <div className="text-lg font-semibold" style={{ color: colors.text }}>
                    {(regimeData.regime.characteristics.trend * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-lg border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <div className="text-xs" style={{ color: colors.textSecondary }}>Volatility</div>
                  <div className="text-lg font-semibold" style={{ color: colors.text }}>
                    {(regimeData.regime.characteristics.volatility * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-lg border p-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <div className="text-xs" style={{ color: colors.textSecondary }}>Volume</div>
                  <div className="text-lg font-semibold" style={{ color: colors.text }}>
                    {(regimeData.regime.characteristics.volume * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Transition Probabilities */}
              <div>
                <div className="text-sm font-medium mb-2" style={{ color: colors.text }}>Transition Probabilities</div>
                <div className="space-y-2">
                  {Object.entries(regimeData.regime.transitionProbability || {}).map(([regime, prob]) => (
                    <div key={regime} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: colors.textSecondary }}>{regime}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(prob as number) * 100}%`, backgroundColor: colors.accent }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right" style={{ color: colors.text }}>
                          {((prob as number) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: colors.textSecondary }}>
              No regime data available
            </div>
          )}
        </div>

        {/* Candle Clustering */}
        <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center" style={{ color: colors.text }}>
            <Brain className="w-5 h-5 mr-2" style={{ color: colors.accent }} />
            Candle Clustering Analysis
          </h2>

          {clustersLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-64 rounded-lg" style={{ backgroundColor: colors.surface }} />
            </div>
          ) : clusterData?.clusters ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis dataKey="volatility" name="Volatility" stroke={colors.textSecondary} />
                  <YAxis dataKey="avgReturn" name="Avg Return" stroke={colors.textSecondary} />
                  <Tooltip
                    contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px' }}
                    labelStyle={{ color: colors.text }}
                  />
                  <Scatter name="Clusters" data={clusterData.clusters} fill={colors.accent}>
                    {clusterData.clusters.map((entry: ClusterData, index: number) => (
                      <Cell key={`cell-${index}`} fill={clusterColors[index % clusterColors.length]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusterData.clusters.map((cluster: ClusterData, index: number) => (
                  <div
                    key={cluster.clusterId}
                    className="rounded-lg border p-4"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: clusterColors[index % clusterColors.length] }}
                      >
                        Cluster {cluster.clusterId}
                      </div>
                      <div className="text-xs" style={{ color: colors.textSecondary }}>
                        {cluster.candles} candles
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: colors.textSecondary }}>Avg Return:</span>
                        <span
                          className="font-semibold"
                          style={{ color: cluster.avgReturn >= 0 ? colors.success : colors.error }}
                        >
                          {cluster.avgReturn >= 0 ? '+' : ''}{cluster.avgReturn.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: colors.textSecondary }}>Volatility:</span>
                        <span style={{ color: colors.text }}>{cluster.volatility.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: colors.textSecondary }}>
              No cluster data available
            </div>
          )}
        </div>

        {/* Pattern Detection */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center" style={{ color: colors.text }}>
            <Target className="w-5 h-5 mr-2" style={{ color: colors.accent }} />
            Pattern Detection
          </h2>

          {patternsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: colors.surface }} />
              ))}
            </div>
          ) : patternData?.patterns && patternData.patterns.length > 0 ? (
            <div className="space-y-3">
              {patternData.patterns.map((pattern: PatternDetection, index: number) => (
                <div
                  key={index}
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="text-lg font-semibold" style={{ color: colors.text }}>
                          {pattern.pattern}
                        </div>
                        <div
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: pattern.confidence >= 0.7 ? `${colors.success}20` : `${colors.warning}20`,
                            color: pattern.confidence >= 0.7 ? colors.success : colors.warning
                          }}
                        >
                          {(pattern.confidence * 100).toFixed(0)}% confidence
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span style={{ color: colors.textSecondary }}>Timeframe:</span>
                          <span className="ml-2 font-medium" style={{ color: colors.text }}>
                            {pattern.timeframe}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: colors.textSecondary }}>Predicted Move:</span>
                          <span
                            className="ml-2 font-semibold"
                            style={{ color: pattern.predictedMove >= 0 ? colors.success : colors.error }}
                          >
                            {pattern.predictedMove >= 0 ? '+' : ''}{pattern.predictedMove.toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span style={{ color: colors.textSecondary }}>Historical Accuracy:</span>
                          <span className="ml-2 font-medium" style={{ color: colors.text }}>
                            {(pattern.historicalAccuracy * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {pattern.confidence >= 0.7 ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: colors.success }} />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: colors.warning }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: colors.textSecondary }}>
              No patterns detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
