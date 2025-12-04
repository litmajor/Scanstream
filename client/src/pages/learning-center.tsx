/**
 * Learning Center Dashboard
 * Visualizes Bayesian Belief Updater learning metrics and strategy evolution
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  Brain,
  TrendingUp,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Download,
  Settings
} from 'lucide-react';

interface StrategyBelief {
  posterior_accuracy: number;
  confidence: number;
  samples: number;
  win_rate: number;
  avg_roi: number;
  current_weight: number;
}

interface LearningMetrics {
  strategy_beliefs: Record<string, StrategyBelief>;
  adaptive_weights: Record<string, number>;
  market_regime: string;
  regime_adjusted_weights: Record<string, number>;
  calibration: Record<string, any>;
  learning_velocity: number;
  accuracy_improvements: Record<string, number>;
}

interface CalibrationData {
  confidence_level: string;
  expected_win_rate: number;
  actual_win_rate: number;
}

export function LearningCenter() {
  const [metrics, setMetrics] = useState<LearningMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [calibrationData, setCalibrationData] = useState<CalibrationData[]>([]);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  const [refreshInterval, setRefreshInterval] = useState(10000);

  // Fetch metrics on load and periodic refresh
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/learning/metrics');
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
        setLoading(false);
        
        // Generate calibration visualization data
        const calibData = Object.entries(data.metrics.calibration || {}).map(
          ([_, cal]: [string, any]) => ({
            confidence_level: 'High Conf',
            expected_win_rate: 0.80,
            actual_win_rate: cal.high_conf_wr || 0.0
          })
        );
        setCalibrationData(calibData);
      }
    } catch (error) {
      console.error('Failed to fetch learning metrics:', error);
    }
  };

  const fetchWeightHistory = async (strategyId: string) => {
    try {
      const response = await fetch(
        `/api/learning/weight-evolution/${strategyId}?days=7`
      );
      const data = await response.json();
      if (data.success) {
        setWeightHistory(data.evolution);
      }
    } catch (error) {
      console.error('Failed to fetch weight history:', error);
    }
  };

  const handleStrategySelect = (strategyId: string) => {
    setSelectedStrategy(strategyId);
    fetchWeightHistory(strategyId);
  };

  const handleReset = async () => {
    if (!confirm('Reset all beliefs to priors? This will clear learning history.')) {
      return;
    }

    try {
      const response = await fetch('/api/learning/reset', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert('Learning system reset to priors');
        fetchMetrics();
      }
    } catch (error) {
      console.error('Failed to reset learning:', error);
    }
  };

  const handleExport = () => {
    if (!metrics) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      metrics,
      weightHistory
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-metrics-${Date.now()}.json`;
    a.click();
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white">Loading learning metrics...</div>
      </div>
    );
  }

  const strategies = Object.keys(metrics.strategy_beliefs);
  const strategiesData = strategies.map(id => ({
    name: id,
    ...metrics.strategy_beliefs[id],
    weight: metrics.adaptive_weights[id] || 0,
    improvement: (metrics.accuracy_improvements[id] || 0) * 100
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Learning Center</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {/* Learning Velocity */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Learning Velocity</p>
                <p className="text-2xl font-bold text-white">{(metrics.learning_velocity * 100).toFixed(0)}%</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-slate-500 text-xs mt-2">Trades processed per period</p>
          </div>

          {/* Current Regime */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Market Regime</p>
                <p className="text-2xl font-bold text-white">{metrics.market_regime}</p>
              </div>
              <Target className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-slate-500 text-xs mt-2">Current market conditions</p>
          </div>

          {/* Avg Accuracy */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Avg Accuracy</p>
                <p className="text-2xl font-bold text-white">
                  {(
                    Object.values(metrics.strategy_beliefs).reduce(
                      (sum: number, b: any) => sum + b.posterior_accuracy,
                      0
                    ) / strategies.length * 100
                  ).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-slate-500 text-xs mt-2">Posterior accuracy</p>
          </div>

          {/* Total Samples */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Total Trades</p>
                <p className="text-2xl font-bold text-white">
                  {Object.values(metrics.strategy_beliefs).reduce(
                    (sum: number, b: any) => sum + b.samples,
                    0
                  )}
                </p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-slate-500 text-xs mt-2">Processed for learning</p>
          </div>
        </div>

        {/* Strategy Beliefs Comparison */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Strategy Belief Evolution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={strategiesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend />
              <Bar dataKey="posterior_accuracy" fill="#8b5cf6" name="Posterior Accuracy" />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke="#06b6d4"
                name="Confidence"
                yAxisId="right"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Adaptive Weights */}
        <div className="grid grid-cols-2 gap-6">
          {/* Current Weights */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Adaptive Weights</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={strategiesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#94a3b8" angle={-45} height={80} />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="weight" fill="#06b6d4" name="Current Weight" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Accuracy Improvements */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Accuracy Improvements</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={strategiesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#94a3b8" angle={-45} height={80} />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number) => `${(value as number).toFixed(2)}%`}
                />
                <Bar dataKey="improvement" fill="#10b981" name="Improvement %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy Details */}
        <div className="grid grid-cols-3 gap-6">
          {/* Strategy Selector */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Strategies</h2>
            <div className="space-y-2">
              {strategies.map(id => (
                <button
                  key={id}
                  onClick={() => handleStrategySelect(id)}
                  className={`w-full p-3 rounded-lg transition text-left ${
                    selectedStrategy === id
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <p className="font-semibold">{id}</p>
                  <p className="text-sm opacity-75">
                    {(metrics.adaptive_weights[id] * 100).toFixed(1)}% weight
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            {selectedStrategy ? (
              <>
                <h2 className="text-xl font-bold text-white mb-4">
                  {selectedStrategy} Details
                </h2>
                {metrics.strategy_beliefs[selectedStrategy] && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Win Rate</p>
                      <p className="text-2xl font-bold text-white">
                        {(metrics.strategy_beliefs[selectedStrategy].win_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Avg ROI</p>
                      <p className="text-2xl font-bold text-green-400">
                        {metrics.strategy_beliefs[selectedStrategy].avg_roi.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Confidence</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        {(metrics.strategy_beliefs[selectedStrategy].confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm mb-1">Samples</p>
                      <p className="text-2xl font-bold text-purple-400">
                        {metrics.strategy_beliefs[selectedStrategy].samples}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-400">Select a strategy to view details</p>
            )}
          </div>
        </div>

        {/* Weight Evolution Chart */}
        {selectedStrategy && weightHistory.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Weight Evolution - {selectedStrategy}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weightHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="timestamp" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Weight"
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Confidence Calibration */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Confidence Calibration</h2>
          <div className="space-y-4">
            {['high_confidence', 'medium_confidence', 'low_confidence'].map((level, idx) => {
              const expected = [0.80, 0.65, 0.50][idx];
              const data = calibrationData[0] || {};
              return (
                <div key={level}>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 capitalize">
                      {level.replace('_', ' ')}
                    </span>
                    <span className="text-white font-semibold">
                      {(expected * 100).toFixed(0)}% expected
                    </span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-cyan-500 h-2 rounded-full"
                      style={{ width: `${expected * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LearningCenter;
