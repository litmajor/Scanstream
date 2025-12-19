import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  Trophy, TrendingUp, Award, ChevronDown, ArrowUpDown, Search, Filter,
  ArrowLeft, Users, Target, Zap, BarChart3, Flame, Shield, Crown
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

type SortBy = 'level' | 'winRate' | 'wins' | 'profitFactor' | 'sharpe' | 'trades' | 'name';

const AGENT_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  BREAKOUT: { color: '#FF6B6B', icon: <Zap size={16} /> },
  REVERSAL: { color: '#4ECDC4', icon: <TrendingUp size={16} /> },
  ML_PREDICTION: { color: '#95E1D3', icon: <BarChart3 size={16} /> },
  MA_CROSSOVER: { color: '#F4A261', icon: <TrendingUp size={16} /> },
  SUPPORT_BOUNCE: { color: '#2A9D8F', icon: <Shield size={16} /> },
  TREND_RIDER: { color: '#E76F51', icon: <TrendingUp size={16} /> },
  PHYSICS_FLOW: { color: '#264653', icon: <Zap size={16} /> },
  PHYSICS_VFMD: { color: '#D62828', icon: <Target size={16} /> },
  EXIT_ORCHESTRATOR: { color: '#06A77D', icon: <Trophy size={16} /> },
  OPPOSITION_READER: { color: '#D62828', icon: <Shield size={16} /> },
  MICROSTRUCTURE_SPECIALIST: { color: '#8338EC', icon: <Flame size={16} /> },
};

const rankColors: Record<string, { bg: string; text: string; border: string }> = {
  Bronze: { bg: '#8B4513', text: '#D2B48C', border: '#CD7F32' },
  Silver: { bg: '#708090', text: '#C0C0C0', border: '#C0C0C0' },
  Gold: { bg: '#8B8000', text: '#FFD700', border: '#FFD700' },
  Platinum: { bg: '#6F6F6F', text: '#E5E4E2', border: '#E5E4E2' },
  Diamond: { bg: '#0B5394', text: '#B9F2FF', border: '#B9F2FF' },
  Master: { bg: '#4B0082', text: '#FF00FF', border: '#FF00FF' },
};

const AgentLeaderboard: React.FC = () => {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('winRate');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterRank, setFilterRank] = useState<string>('all');

  // Fetch leaderboard
  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ['agent-leaderboard'],
    queryFn: async () => {
      const response = await fetch('/api/agents/leaderboard');
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const agents: Agent[] = leaderboardData?.data || [];

  // Filter and sort
  const filteredAndSortedAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      // Search filter
      if (searchTerm && !agent.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Rank filter
      if (filterRank !== 'all' && agent.rank !== filterRank) {
        return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let compare = 0;
      switch (sortBy) {
        case 'level':
          compare = a.level - b.level;
          break;
        case 'winRate':
          compare = a.stats.win_rate - b.stats.win_rate;
          break;
        case 'wins':
          compare = a.stats.wins - b.stats.wins;
          break;
        case 'profitFactor':
          compare = a.stats.profit_factor - b.stats.profit_factor;
          break;
        case 'sharpe':
          compare = a.stats.sharpe_ratio - b.stats.sharpe_ratio;
          break;
        case 'trades':
          compare = a.stats.total_trades - b.stats.total_trades;
          break;
        case 'name':
          compare = a.name.localeCompare(b.name);
          break;
      }
      return sortAsc ? compare : -compare;
    });

    return filtered;
  }, [agents, searchTerm, filterRank, sortBy, sortAsc]);

  const uniqueRanks = [...new Set(agents.map(a => a.rank))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/agent-roster')}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Roster
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Crown size={32} className="text-amber-400" />
            <h1 className="text-4xl font-bold text-white">Agent Leaderboard</h1>
          </div>
          <p className="text-slate-400 text-lg">Ranked by performance metrics</p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-300 text-sm font-semibold mb-1">Total Agents</div>
            <div className="text-3xl font-bold text-white">{agents.length}</div>
          </div>
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <div className="text-green-300 text-sm font-semibold mb-1">Avg Win Rate</div>
            <div className="text-3xl font-bold text-white">
              {agents.length > 0 
                ? ((agents.reduce((sum, a) => sum + a.stats.win_rate, 0) / agents.length) * 100).toFixed(1)
                : '0'
              }%
            </div>
          </div>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <div className="text-purple-300 text-sm font-semibold mb-1">Total Wins</div>
            <div className="text-3xl font-bold text-white">
              {agents.reduce((sum, a) => sum + a.stats.wins, 0)}
            </div>
          </div>
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
            <div className="text-amber-300 text-sm font-semibold mb-1">Avg Sharpe</div>
            <div className="text-3xl font-bold text-white">
              {agents.length > 0 
                ? (agents.reduce((sum, a) => sum + a.stats.sharpe_ratio, 0) / agents.length).toFixed(2)
                : '0'
              }
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Sort By */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="winRate">Win Rate</option>
                <option value="level">Level</option>
                <option value="wins">Wins</option>
                <option value="profitFactor">Profit Factor</option>
                <option value="sharpe">Sharpe Ratio</option>
                <option value="trades">Total Trades</option>
                <option value="name">Name</option>
              </select>
            </div>

            {/* Rank Filter */}
            <div>
              <select
                value={filterRank}
                onChange={(e) => setFilterRank(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="all">All Ranks</option>
                {uniqueRanks.map(rank => (
                  <option key={rank} value={rank}>{rank}</option>
                ))}
              </select>
            </div>

            {/* Sort Direction */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white hover:bg-slate-600 transition flex items-center justify-center gap-2"
            >
              <ArrowUpDown size={18} />
              {sortAsc ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <Zap size={32} className="mx-auto mb-2 text-blue-400 animate-spin" />
            <p className="text-slate-400">Loading leaderboard...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400 mb-8">
            <p>Failed to load leaderboard. Please try again.</p>
          </div>
        )}

        {/* Leaderboard Table */}
        {!isLoading && (
          <div className="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">#</th>
                  <th className="px-6 py-4 text-left text-slate-300 font-semibold">Agent</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Level</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Rank</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Wins</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Losses</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Win Rate</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Profit Factor</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Sharpe</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Trades</th>
                  <th className="px-6 py-4 text-center text-slate-300 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedAgents.length > 0 ? (
                  filteredAndSortedAgents.map((agent, idx) => {
                    const config = AGENT_CONFIG[agent.agent_type] || { color: '#666', icon: <Users size={16} /> };
                    const rankStyle = rankColors[agent.rank] || { bg: '#333', text: '#999', border: '#666' };

                    return (
                      <tr 
                        key={agent.name}
                        className="border-b border-slate-700 hover:bg-slate-700/30 transition cursor-pointer"
                        onClick={() => navigate(`/agent-detail/${encodeURIComponent(agent.name)}`)}
                      >
                        {/* Rank */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Crown size={18} className="text-amber-400" />}
                            {idx === 1 && <Trophy size={18} className="text-slate-300" />}
                            {idx === 2 && <Award size={18} className="text-amber-700" />}
                            <span className="text-white font-bold">{idx + 1}</span>
                          </div>
                        </td>

                        {/* Agent Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="p-2 rounded"
                              style={{ color: config.color }}
                            >
                              {config.icon}
                            </div>
                            <div>
                              <div className="text-white font-semibold">{agent.name}</div>
                              <div className="text-slate-400 text-sm">{agent.agent_type.replace(/_/g, ' ')}</div>
                            </div>
                          </div>
                        </td>

                        {/* Level */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-white font-bold">Lv {agent.level}</span>
                        </td>

                        {/* Rank Badge */}
                        <td className="px-6 py-4 text-center">
                          <span 
                            className="px-3 py-1 rounded text-sm font-semibold"
                            style={{ 
                              backgroundColor: rankStyle.bg,
                              color: rankStyle.text,
                              border: `1px solid ${rankStyle.border}`
                            }}
                          >
                            {agent.rank}
                          </span>
                        </td>

                        {/* Wins */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-green-400 font-bold">{agent.stats.wins}</span>
                        </td>

                        {/* Losses */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-red-400 font-bold">{agent.stats.losses}</span>
                        </td>

                        {/* Win Rate */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-700 rounded-full h-2">
                              <div 
                                className="h-full rounded-full bg-blue-500 transition-all"
                                style={{ width: `${agent.stats.win_rate * 100}%` }}
                              />
                            </div>
                            <span className="text-white font-bold text-sm">
                              {(agent.stats.win_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Profit Factor */}
                        <td className="px-6 py-4 text-center">
                          <span 
                            className="font-bold"
                            style={{ color: agent.stats.profit_factor > 1.5 ? '#10b981' : agent.stats.profit_factor > 1 ? '#60a5fa' : '#ef4444' }}
                          >
                            {agent.stats.profit_factor.toFixed(2)}
                          </span>
                        </td>

                        {/* Sharpe Ratio */}
                        <td className="px-6 py-4 text-center">
                          <span 
                            className="font-bold"
                            style={{ color: agent.stats.sharpe_ratio > 2 ? '#10b981' : agent.stats.sharpe_ratio > 1 ? '#60a5fa' : '#ef4444' }}
                          >
                            {agent.stats.sharpe_ratio.toFixed(2)}
                          </span>
                        </td>

                        {/* Total Trades */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-slate-300">{agent.stats.total_trades}</span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/agent-detail/${encodeURIComponent(agent.name)}`);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                      No agents found matching your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentLeaderboard;
