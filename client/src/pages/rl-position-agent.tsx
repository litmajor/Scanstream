
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Brain, Target, Shield, TrendingUp, Activity, Zap } from 'lucide-react';
import { useLocation } from 'wouter';
import { useTheme } from '../contexts/ThemeContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RLSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  expectedReturn: number;
  maxDrawdown: number;
  qValue: number;
}

interface RLStats {
  totalExperiences: number;
  epsilon: number;
  avgReward: number;
  episodeCount: number;
  successRate: number;
  avgPositionSize: number;
  avgRiskReward: number;
  bestEpisodeReward: number;
  recentPerformance: Array<{ episode: number; reward: number; avgReturn: number }>;
}

export default function RLPositionAgent() {
  const [, setLocation] = useLocation();
  const { colors } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [baseSize, setBaseSize] = useState(1.0);

  // Fetch RL signals
  const { data: signalsData, isLoading: signalsLoading } = useQuery({
    queryKey: ['rl-signals', selectedSymbol],
    queryFn: async () => {
      const response = await fetch(`/api/rl-agent/signals?symbols=${selectedSymbol}`);
      if (!response.ok) throw new Error('Failed to fetch RL signals');
      return response.json();
    },
    refetchInterval: 10000
  });

  // Fetch RL stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['rl-stats'],
    queryFn: async () => {
      const response = await fetch('/api/rl-agent/stats');
      if (!response.ok) throw new Error('Failed to fetch RL stats');
      return response.json();
    },
    refetchInterval: 30000
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'BUY': return colors.success;
      case 'SELL': return colors.error;
      case 'HOLD': return colors.warning;
      default: return colors.textSecondary;
    }
  };

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
                RL Position Agent
              </h1>
              <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                Reinforcement Learning • Dynamic Position Sizing • Risk Optimization
              </p>
            </div>

            <div className="w-32" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Agent Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {statsLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="h-16 rounded" style={{ backgroundColor: colors.surface }} />
              </div>
            ))
          ) : (
            <>
              <div className="rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>Success Rate</div>
                    <div className="text-2xl font-bold" style={{ color: colors.success }}>
                      {((statsData?.stats?.successRate || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <Target className="w-8 h-8" style={{ color: colors.success }} />
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>Avg Reward</div>
                    <div className="text-2xl font-bold" style={{ color: colors.accent }}>
                      {(statsData?.stats?.avgReward || 0).toFixed(2)}
                    </div>
                  </div>
                  <TrendingUp className="w-8 h-8" style={{ color: colors.accent }} />
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>Avg R:R Ratio</div>
                    <div className="text-2xl font-bold" style={{ color: colors.text }}>
                      {(statsData?.stats?.avgRiskReward || 0).toFixed(2)}
                    </div>
                  </div>
                  <Shield className="w-8 h-8" style={{ color: colors.warning }} />
                </div>
              </div>

              <div className="rounded-xl border p-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm" style={{ color: colors.textSecondary }}>Experiences</div>
                    <div className="text-2xl font-bold" style={{ color: colors.text }}>
                      {statsData?.stats?.totalExperiences || 0}
                    </div>
                  </div>
                  <Brain className="w-8 h-8" style={{ color: colors.info }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Performance Chart */}
        <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center" style={{ color: colors.text }}>
            <Activity className="w-5 h-5 mr-2" style={{ color: colors.accent }} />
            Training Performance
          </h2>

          {statsLoading ? (
            <div className="animate-pulse h-64 rounded-lg" style={{ backgroundColor: colors.surface }} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statsData?.stats?.recentPerformance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="episode" stroke={colors.textSecondary} />
                <YAxis stroke={colors.textSecondary} />
                <Tooltip
                  contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '8px' }}
                  labelStyle={{ color: colors.text }}
                />
                <Legend />
                <Line type="monotone" dataKey="reward" stroke={colors.accent} strokeWidth={2} name="Episode Reward" />
                <Line type="monotone" dataKey="avgReturn" stroke={colors.success} strokeWidth={2} strokeDasharray="5 5" name="Avg Return" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Signal Configuration */}
        <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center" style={{ color: colors.text }}>
            <Zap className="w-5 h-5 mr-2" style={{ color: colors.accent }} />
            Signal Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
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

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Base Position Size</label>
              <input
                type="number"
                value={baseSize}
                onChange={(e) => setBaseSize(parseFloat(e.target.value))}
                min="0.1"
                max="10"
                step="0.1"
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
              />
            </div>
          </div>
        </div>

        {/* RL Signals */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center" style={{ color: colors.text }}>
            <Target className="w-5 h-5 mr-2" style={{ color: colors.accent }} />
            RL Position Recommendations
          </h2>

          {signalsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-lg" style={{ backgroundColor: colors.surface }} />
              ))}
            </div>
          ) : signalsData?.signals && signalsData.signals.length > 0 ? (
            <div className="space-y-4">
              {signalsData.signals.map((signal: RLSignal, index: number) => (
                <div
                  key={index}
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-bold" style={{ color: colors.text }}>{signal.symbol}</div>
                      <div
                        className="inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1"
                        style={{
                          backgroundColor: `${getActionColor(signal.action)}20`,
                          color: getActionColor(signal.action)
                        }}
                      >
                        {signal.action}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm" style={{ color: colors.textSecondary }}>Confidence</div>
                      <div className="text-2xl font-bold" style={{ color: colors.accent }}>
                        {(signal.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div style={{ color: colors.textSecondary }}>Position Size</div>
                      <div className="font-semibold" style={{ color: colors.text }}>
                        {(signal.positionSize * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div>
                      <div style={{ color: colors.textSecondary }}>Stop Loss</div>
                      <div className="font-semibold" style={{ color: colors.error }}>
                        ${signal.stopLoss.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: colors.textSecondary }}>Take Profit</div>
                      <div className="font-semibold" style={{ color: colors.success }}>
                        ${signal.takeProfit.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: colors.textSecondary }}>R:R Ratio</div>
                      <div className="font-semibold" style={{ color: colors.text }}>
                        1:{signal.riskRewardRatio.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm" style={{ borderTopColor: colors.border }}>
                    <div>
                      <div style={{ color: colors.textSecondary }}>Expected Return</div>
                      <div
                        className="font-semibold"
                        style={{ color: signal.expectedReturn >= 0 ? colors.success : colors.error }}
                      >
                        {signal.expectedReturn >= 0 ? '+' : ''}{signal.expectedReturn.toFixed(2)}%
                      </div>
                    </div>

                    <div>
                      <div style={{ color: colors.textSecondary }}>Max Drawdown</div>
                      <div className="font-semibold" style={{ color: colors.error }}>
                        {signal.maxDrawdown.toFixed(2)}%
                      </div>
                    </div>

                    <div>
                      <div style={{ color: colors.textSecondary }}>Q-Value</div>
                      <div className="font-semibold" style={{ color: colors.text }}>
                        {signal.qValue.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: colors.textSecondary }}>
              No RL signals available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
