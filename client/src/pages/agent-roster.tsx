import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Shield, Zap, Brain, TrendingUp, Award, Heart, Flame, Eye, BarChart3, Network, 
  Wind, AlertCircle, CheckCircle, RotateCcw, Maximize2, Volume2, Search, Filter, ChevronDown,
  ArrowUpDown, Users
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

type SortBy = 'level' | 'wins' | 'winRate' | 'profitFactor' | 'sharpe' | 'name';
type FilterType = 'all' | 'physics' | 'ml' | 'exit' | 'reversal' | 'breakout';

interface RosterStats {
  totalAgents: number;
  activeAgents: number;
  totalWins: number;
  avgWinRate: number;
  totalTrades: number;
}

// Main Roster Page
const AgentRoster: React.FC = () => {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('level');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortAsc, setSortAsc] = useState(false);

  const handleNavigateToDetail = (agentName: string) => {
    navigate(`/agent-detail/${encodeURIComponent(agentName)}`);
  };

  // Fetch all agents
  const { data: agentsData, isLoading, error } = useQuery({
    queryKey: ['agents-all'],
    queryFn: async () => {
      const response = await fetch('/api/agents/all');
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const agents: Agent[] = agentsData?.data || [];

  // Calculate roster stats
  const stats: RosterStats = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.rank !== 'RETIRED').length,
    totalWins: agents.reduce((sum, a) => sum + a.stats.wins, 0),
    avgWinRate: agents.length > 0 ? agents.reduce((sum, a) => sum + a.stats.win_rate, 0) / agents.length : 0,
    totalTrades: agents.reduce((sum, a) => sum + a.stats.total_trades, 0),
  };

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    // Search filter
    if (searchTerm && !agent.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Type filter
    if (filterType === 'physics' && !agent.agent_type.includes('PHYSICS')) return false;
    if (filterType === 'ml' && !agent.agent_type.includes('ML')) return false;
    if (filterType === 'exit' && !agent.agent_type.includes('EXIT')) return false;
    if (filterType === 'reversal' && agent.agent_type !== 'REVERSAL') return false;
    if (filterType === 'breakout' && agent.agent_type !== 'BREAKOUT') return false;

    return true;
  });

  // Sort agents
  const sortedAgents = [...filteredAgents].sort((a, b) => {
    let compare = 0;
    switch (sortBy) {
      case 'level':
        compare = a.level - b.level;
        break;
      case 'wins':
        compare = a.stats.wins - b.stats.wins;
        break;
      case 'winRate':
        compare = a.stats.win_rate - b.stats.win_rate;
        break;
      case 'profitFactor':
        compare = a.stats.profit_factor - b.stats.profit_factor;
        break;
      case 'sharpe':
        compare = a.stats.sharpe_ratio - b.stats.sharpe_ratio;
        break;
      case 'name':
        compare = a.name.localeCompare(b.name);
        break;
    }
    return sortAsc ? compare : -compare;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users size={32} className="text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Agent Roster</h1>
          </div>
          <p className="text-slate-400 text-lg">Manage and monitor your trading agent team</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-lg border border-blue-500/30 p-4">
            <div className="text-blue-300 text-sm font-semibold mb-1">Total Agents</div>
            <div className="text-3xl font-bold text-white">{stats.totalAgents}</div>
            <div className="text-blue-400 text-xs mt-1">{stats.activeAgents} active</div>
          </div>

          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-lg border border-green-500/30 p-4">
            <div className="text-green-300 text-sm font-semibold mb-1">Total Wins</div>
            <div className="text-3xl font-bold text-white">{stats.totalWins}</div>
            <div className="text-green-400 text-xs mt-1">across all trades</div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-lg border border-purple-500/30 p-4">
            <div className="text-purple-300 text-sm font-semibold mb-1">Avg Win Rate</div>
            <div className="text-3xl font-bold text-white">{(stats.avgWinRate * 100).toFixed(1)}%</div>
            <div className="text-purple-400 text-xs mt-1">team average</div>
          </div>

          <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 rounded-lg border border-amber-500/30 p-4">
            <div className="text-amber-300 text-sm font-semibold mb-1">Total Trades</div>
            <div className="text-3xl font-bold text-white">{stats.totalTrades}</div>
            <div className="text-amber-400 text-xs mt-1">team total</div>
          </div>

          <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 rounded-lg border border-red-500/30 p-4">
            <div className="text-red-300 text-sm font-semibold mb-1">Avg Sharpe</div>
            <div className="text-3xl font-bold text-white">
              {(agents.reduce((sum, a) => sum + a.stats.sharpe_ratio, 0) / Math.max(agents.length, 1)).toFixed(2)}
            </div>
            <div className="text-red-400 text-xs mt-1">risk-adjusted return</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-700/80 transition"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter size={18} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 focus:bg-slate-700/80 transition appearance-none"
              >
                <option value="all">All Types</option>
                <option value="physics">Physics Agents</option>
                <option value="ml">ML Agents</option>
                <option value="exit">Exit Agents</option>
                <option value="breakout">Breakout Hunters</option>
                <option value="reversal">Reversal Masters</option>
              </select>
              <ChevronDown size={16} className="absolute right-2 top-3 text-slate-500 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <ArrowUpDown size={18} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500 focus:bg-slate-700/80 transition appearance-none"
              >
                <option value="level">Level</option>
                <option value="wins">Wins</option>
                <option value="winRate">Win Rate</option>
                <option value="profitFactor">Profit Factor</option>
                <option value="sharpe">Sharpe Ratio</option>
                <option value="name">Name</option>
              </select>
              <ChevronDown size={16} className="absolute right-2 top-3 text-slate-500 pointer-events-none" />
            </div>

            {/* Sort Direction */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white hover:bg-slate-600 transition flex items-center justify-center gap-2"
              title={sortAsc ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown size={18} />
              {sortAsc ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin">
              <Zap size={32} className="text-blue-400" />
            </div>
            <p className="ml-4 text-slate-400">Loading agents...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400 mb-8">
            <p>Failed to load agents. Please try again.</p>
          </div>
        )}

        {/* Agent Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAgents.length > 0 ? (
              sortedAgents.map((agent) => (
                <AgentRosterCard 
                  key={agent.name} 
                  agent={agent}
                  onNavigateToDetail={handleNavigateToDetail}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-400 text-lg">No agents found matching your filters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Individual Agent Roster Card
interface AgentRosterCardProps {
  agent: Agent;
  onNavigateToDetail: (agentName: string) => void;
}

const AgentRosterCard: React.FC<AgentRosterCardProps> = ({ agent, onNavigateToDetail }) => {
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

  const xpPercent = (agent.xp / agent.xp_to_next_level) * 100;

  return (
    <div 
      className="relative rounded-lg border-2 overflow-hidden hover:shadow-2xl transition-all duration-300 group bg-slate-800/30"
      style={{ borderColor: config.color }}
    >
      {/* Background gradient overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{ backgroundColor: config.color }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${config.color}20`, borderColor: config.color, borderWidth: 1 }}>
              <div style={{ color: config.color }}>
                {config.icon}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-white truncate">{agent.name}</h3>
              <p className="text-xs text-slate-400">{agent.agent_type.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">Lv {agent.level}</div>
            <div 
              className="text-xs px-2 py-1 rounded font-semibold mt-1"
              style={{ backgroundColor: rankColors[agent.rank] || '#666', color: '#000' }}
            >
              {agent.rank}
            </div>
          </div>
        </div>

        {/* Mood Indicator */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-lg">{moodEmojis[agent.mood as keyof typeof moodEmojis] || '😐'}</span>
          <span className="text-slate-400">{agent.mood}</span>
        </div>

        {/* XP Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">XP Progress</span>
            <span className="text-slate-300 font-semibold">{agent.xp}/{agent.xp_to_next_level}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full transition-all duration-500"
              style={{ 
                width: `${Math.min(xpPercent, 100)}%`,
                backgroundColor: config.color 
              }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
            <div className="text-slate-400 text-xs font-semibold">Win Rate</div>
            <div className="text-lg font-bold text-white">{(agent.stats.win_rate * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
            <div className="text-slate-400 text-xs font-semibold">Trades</div>
            <div className="text-lg font-bold text-white">{agent.stats.total_trades}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
            <div className="text-slate-400 text-xs font-semibold">Profit Factor</div>
            <div className="text-lg font-bold text-white">{agent.stats.profit_factor.toFixed(2)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
            <div className="text-slate-400 text-xs font-semibold">Sharpe</div>
            <div className="text-lg font-bold text-white">{agent.stats.sharpe_ratio.toFixed(2)}</div>
          </div>
        </div>

        {/* Skills Bar */}
        {Object.keys(agent.skill_levels).length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-400 mb-2">Skills</div>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(agent.skill_levels).slice(0, 4).map(([skill, level]) => (
                <div 
                  key={skill}
                  className="text-xs px-2 py-1 rounded border"
                  style={{ 
                    backgroundColor: `${config.color}20`,
                    borderColor: config.color,
                    color: config.color
                  }}
                >
                  {skill.split('_').pop()} {level}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Badge */}
        {agent.achievements && agent.achievements.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <Award size={16} style={{ color: config.color }} />
            <span className="text-xs text-slate-400">
              {agent.achievements.length} achievement{agent.achievements.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-slate-700 pt-3 flex gap-2">
          <button
            onClick={() => onNavigateToDetail(agent.name)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded transition-all duration-200 text-white"
            style={{ 
              backgroundColor: config.color,
              opacity: 0.9
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.9')}
          >
            View Details
          </button>
          <button
            onClick={() => onNavigateToDetail(agent.name)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded border transition-all duration-200"
            style={{ 
              borderColor: config.color,
              color: config.color,
              backgroundColor: 'transparent'
            }}
          >
            Inspect
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentRoster;
