import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { 
  Shield, Zap, Brain, TrendingUp, Award, Heart, Flame, Eye, BarChart3, Network, 
  Wind, AlertCircle, CheckCircle, RotateCcw, Maximize2, Volume2, Search, Filter, ChevronDown,
  ArrowUpDown, Users, ArrowLeft, LineChart, PieChart, Activity, Wallet, Target, Zap as ZapIcon,
  Trophy, Star, Clock, TrendingDown
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface Agent {
  name: string;
  agent_type: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  mood: string;
  personality: string;
  stats: {
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    profit_factor: number;
    sharpe_ratio: number;
    max_drawdown: number;
  };
  skill_levels: Record<string, number>;
  abilities: string[];
  achievements: Array<{
    name: string;
    description: string;
    unlockedAt: string;
  }>;
  rank: string;
}

interface TradeRecord {
  id: string;
  symbol: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  timestamp: string;
  status: 'win' | 'loss' | 'pending';
}

// Agent type colors and icons
const AGENT_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ReactNode; emoji: string }> = {
  BREAKOUT: { color: '#FF6B6B', bgColor: '#FFE5E5', icon: <Zap size={20} />, emoji: '💥' },
  REVERSAL: { color: '#4ECDC4', bgColor: '#E0F7F6', icon: <RotateCcw size={20} />, emoji: '🔄' },
  ML_PREDICTION: { color: '#95E1D3', bgColor: '#E8F8F5', icon: <Brain size={20} />, emoji: '🧠' },
  MA_CROSSOVER: { color: '#F4A261', bgColor: '#FDF3E9', icon: <TrendingUp size={20} />, emoji: '📈' },
  SUPPORT_BOUNCE: { color: '#2A9D8F', bgColor: '#E8F5F0', icon: <Shield size={20} />, emoji: '🎯' },
  TREND_RIDER: { color: '#E76F51', bgColor: '#FBE9E1', icon: <Wind size={20} />, emoji: '🌊' },
  PHYSICS_FLOW: { color: '#264653', bgColor: '#E5E9EC', icon: <Wind size={20} />, emoji: '🌀' },
  PHYSICS_VFMD: { color: '#D62828', bgColor: '#FAE2E3', icon: <Eye size={20} />, emoji: '👁️' },
  EXIT_ORCHESTRATOR: { color: '#06A77D', bgColor: '#E8F5F0', icon: <CheckCircle size={20} />, emoji: '🎬' },
  OPPOSITION_READER: { color: '#D62828', bgColor: '#FAE2E3', icon: <AlertCircle size={20} />, emoji: '🚧' },
  MICROSTRUCTURE_SPECIALIST: { color: '#8338EC', bgColor: '#F5E5FF', icon: <Volume2 size={20} />, emoji: '🌊' },
};

const AgentDetailPage: React.FC = () => {
  const [location, navigate] = useLocation();
  const [match, params] = useRoute('/agent-detail/:agentName');
  const agentName = params?.agentName || '';

  // Fetch agent details
  const { data: agentData, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: ['agent-detail', agentName],
    queryFn: async () => {
      const response = await fetch(`/api/agents/status/${agentName}`);
      if (!response.ok) throw new Error('Failed to fetch agent details');
      return response.json();
    },
    enabled: !!agentName,
    refetchInterval: 30000,
  });

  // Fetch agent achievements
  const { data: achievementsData } = useQuery({
    queryKey: ['agent-achievements', agentName],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentName}/achievements`);
      if (!response.ok) throw new Error('Failed to fetch achievements');
      return response.json();
    },
    enabled: !!agentName,
  });

  const agent: Agent | undefined = agentData?.data;
  const achievements = achievementsData?.data || [];

  if (agentLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin">
          <Zap size={32} className="text-blue-400" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/agent-roster')}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
          >
            <ArrowLeft size={20} />
            Back to Roster
          </button>
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-400">
            <p>Agent not found or failed to load details.</p>
          </div>
        </div>
      </div>
    );
  }

  const config = AGENT_CONFIG[agent.agent_type] || { 
    color: '#666', 
    bgColor: '#f0f0f0', 
    icon: <Shield size={20} />, 
    emoji: '🤖' 
  };

  const rankColors: Record<string, string> = {
    Bronze: '#CD7F32',
    Silver: '#C0C0C0',
    Gold: '#FFD700',
    Platinum: '#E5E4E2',
    Diamond: '#B9F2FF',
    Master: '#FF00FF'
  };

  const moodEmojis: Record<string, string> = {
    focused: '🎯',
    cautious: '⚠️',
    aggressive: '🔥',
    tilted: '😤'
  };

  const personalityEmojis: Record<string, string> = {
    aggressive: '🚀',
    balanced: '⚖️',
    conservative: '🛡️'
  };

  const xpPercent = (agent.xp / agent.xp_to_next_level) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Navigation */}
        <button
          onClick={() => navigate('/agent-roster')}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Roster
        </button>

        {/* Agent Header */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div 
                className="p-4 rounded-lg border-2"
                style={{ borderColor: config.color, backgroundColor: `${config.color}20` }}
              >
                <div style={{ color: config.color, fontSize: '40px' }}>
                  {config.emoji}
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-1">{agent.name}</h1>
                <p className="text-slate-400 text-lg">{agent.agent_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-white mb-2">Lv {agent.level}</div>
              <div 
                className="text-lg px-4 py-2 rounded font-bold inline-block"
                style={{ backgroundColor: rankColors[agent.rank] || '#666', color: '#000' }}
              >
                {agent.rank}
              </div>
            </div>
          </div>

          {/* Mood and Personality */}
          <div className="flex gap-6 text-lg mb-6">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{moodEmojis[agent.mood as keyof typeof moodEmojis] || '😐'}</span>
              <div>
                <div className="text-slate-400 text-sm">Mood</div>
                <div className="text-white font-semibold">{agent.mood}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl">{personalityEmojis[agent.personality as keyof typeof personalityEmojis] || '⚖️'}</span>
              <div>
                <div className="text-slate-400 text-sm">Personality</div>
                <div className="text-white font-semibold">{agent.personality}</div>
              </div>
            </div>
          </div>

          {/* XP Progress */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-slate-400 font-semibold">XP Progress to Level {agent.level + 1}</span>
              <span className="text-white font-bold">{agent.xp}/{agent.xp_to_next_level} ({xpPercent.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(xpPercent, 100)}%`,
                  backgroundColor: config.color 
                }}
              />
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column: Stats & Skills */}
          <div className="lg:col-span-1 space-y-8">
            {/* Performance Stats */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={24} style={{ color: config.color }} />
                Performance
              </h2>
              <div className="space-y-4">
                <StatCard label="Win Rate" value={`${(agent.stats.win_rate * 100).toFixed(1)}%`} />
                <StatCard label="Wins" value={agent.stats.wins.toString()} />
                <StatCard label="Losses" value={agent.stats.losses.toString()} />
                <StatCard label="Total Trades" value={agent.stats.total_trades.toString()} />
                <StatCard label="Profit Factor" value={agent.stats.profit_factor.toFixed(2)} />
                <StatCard label="Sharpe Ratio" value={agent.stats.sharpe_ratio.toFixed(2)} />
                <StatCard label="Max Drawdown" value={`${(Math.abs(agent.stats.max_drawdown) * 100).toFixed(2)}%`} />
              </div>
            </div>

            {/* Skills Tree */}
            {Object.keys(agent.skill_levels).length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Star size={24} style={{ color: config.color }} />
                  Skills
                </h2>
                <div className="space-y-3">
                  {Object.entries(agent.skill_levels).map(([skill, level]) => (
                    <div key={skill}>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-300">{skill.replace(/_/g, ' ')}</span>
                        <span className="text-white font-bold">Lvl {level}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(level / 10) * 100}%`,
                            backgroundColor: config.color 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Abilities */}
            {agent.abilities && agent.abilities.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ZapIcon size={24} style={{ color: config.color }} />
                  Abilities
                </h2>
                <div className="space-y-2">
                  {agent.abilities.map((ability, idx) => (
                    <div 
                      key={idx}
                      className="px-3 py-2 rounded border"
                      style={{ 
                        borderColor: config.color,
                        backgroundColor: `${config.color}10`
                      }}
                    >
                      <span className="text-white text-sm">✨ {ability}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Column: Charts */}
          <div className="lg:col-span-1 space-y-8">
            {/* Win/Loss Breakdown */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <PieChart size={24} style={{ color: config.color }} />
                Trade Outcome
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-green-400">Wins</span>
                    <span className="text-green-400 font-bold">{agent.stats.wins}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ width: `${agent.stats.total_trades > 0 ? (agent.stats.wins / agent.stats.total_trades) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-red-400">Losses</span>
                    <span className="text-red-400 font-bold">{agent.stats.losses}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-red-500"
                      style={{ width: `${agent.stats.total_trades > 0 ? (agent.stats.losses / agent.stats.total_trades) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 text-center">
                <div className="text-slate-400 text-sm mb-1">Win Rate</div>
                <div className="text-3xl font-bold text-white">{(agent.stats.win_rate * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Risk Metrics */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Target size={24} style={{ color: config.color }} />
                Risk Metrics
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="text-slate-400 text-sm mb-1">Profit Factor</div>
                  <div className="text-2xl font-bold text-white">{agent.stats.profit_factor.toFixed(2)}</div>
                  <p className="text-xs text-slate-500 mt-1">Gross profit / Gross loss</p>
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <div className="text-slate-400 text-sm mb-1">Sharpe Ratio</div>
                  <div className="text-2xl font-bold text-white">{agent.stats.sharpe_ratio.toFixed(2)}</div>
                  <p className="text-xs text-slate-500 mt-1">Risk-adjusted return</p>
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <div className="text-slate-400 text-sm mb-1">Max Drawdown</div>
                  <div className="text-2xl font-bold text-red-400">
                    {(Math.abs(agent.stats.max_drawdown) * 100).toFixed(2)}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Worst peak-to-trough</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Achievements */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 h-full">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy size={24} style={{ color: config.color }} />
                Achievements
              </h2>
              
              {achievements && achievements.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {achievements.map((achievement: any, idx: number) => (
                    <div 
                      key={idx}
                      className="p-3 rounded border-l-4 bg-slate-700/30"
                      style={{ borderColor: config.color }}
                    >
                      <div className="font-semibold text-white text-sm">{achievement.name}</div>
                      <p className="text-slate-400 text-xs mt-1">{achievement.description}</p>
                      {achievement.unlockedAt && (
                        <div className="text-slate-500 text-xs mt-2 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-center py-8">
                  <Award size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No achievements unlocked yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity size={24} style={{ color: config.color }} />
            Recent Activity
          </h2>
          <div className="text-slate-400 text-center py-8">
            <Activity size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Recent trades will appear here when available</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-slate-400 text-sm">{label}</span>
    <span className="text-white font-bold">{value}</span>
  </div>
);

export default AgentDetailPage;
