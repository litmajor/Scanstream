import React, { useState, useEffect } from 'react';
import { 
  Shield, Zap, Brain, TrendingUp, Award, Heart, Flame, Eye, BarChart3, Network, 
  Wind, AlertCircle, CheckCircle, RotateCcw, Maximize2, Volume2
} from 'lucide-react';

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

interface AgentCardProps {
  agent: Agent;
  onViewDetails: (agent: Agent) => void;
  onInteract: (agentName: string, action: string) => void;
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

const AgentCard: React.FC<AgentCardProps> = ({ agent, onViewDetails, onInteract }) => {
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

  const personabilityEmojis: Record<string, string> = {
    aggressive: '🚀',
    balanced: '⚖️',
    conservative: '🛡️'
  };

  // Calculate skill progress average
  const avgSkill = Object.values(agent.skill_levels).reduce((a, b) => a + b, 0) / Object.keys(agent.skill_levels).length;

  return (
    <div 
      className="relative rounded-lg border-2 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer group"
      style={{ borderColor: config.color, backgroundColor: config.bgColor }}
      onClick={() => onViewDetails(agent)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div style={{ color: config.color }}>
            {config.icon}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm truncate">{agent.name}</h3>
            <p className="text-xs text-gray-600">{agent.agent_type}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: config.color }}>
            Lv {agent.level}
          </div>
          <div 
            className="text-xs px-2 py-1 rounded text-white"
            style={{ backgroundColor: rankColors[agent.rank] || '#999' }}
          >
            {agent.rank}
          </div>
        </div>
      </div>

      {/* Mood & Personality */}
      <div className="flex gap-2 mb-3 text-sm">
        <span title={`Mood: ${agent.mood}`}>{moodEmojis[agent.mood as keyof typeof moodEmojis] || '😐'}</span>
        <span title={`Personality: ${agent.personality}`}>
          {personabilityEmojis[agent.personality as keyof typeof personabilityEmojis] || '⚖️'}
        </span>
      </div>

      {/* XP Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">XP Progress</span>
          <span className="font-semibold">{agent.xp}/{agent.xp_to_next_level}</span>
        </div>
        <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: `${Math.min((agent.xp / agent.xp_to_next_level) * 100, 100)}%`,
              backgroundColor: config.color 
            }}
          />
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-white bg-opacity-60 rounded p-2">
          <div className="text-gray-600">Win Rate</div>
          <div className="font-bold text-sm">{(agent.stats.win_rate * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-white bg-opacity-60 rounded p-2">
          <div className="text-gray-600">Trades</div>
          <div className="font-bold text-sm">{agent.stats.total_trades}</div>
        </div>
        <div className="bg-white bg-opacity-60 rounded p-2">
          <div className="text-gray-600">Profit Factor</div>
          <div className="font-bold text-sm">{agent.stats.profit_factor.toFixed(2)}</div>
        </div>
        <div className="bg-white bg-opacity-60 rounded p-2">
          <div className="text-gray-600">Sharpe</div>
          <div className="font-bold text-sm">{agent.stats.sharpe_ratio.toFixed(2)}</div>
        </div>
      </div>

      {/* Skills Preview */}
      <div className="mb-3">
        <div className="text-xs font-semibold mb-1 text-gray-700">Skills</div>
        <div className="flex gap-1 flex-wrap">
          {Object.entries(agent.skill_levels).slice(0, 3).map(([skill, level]) => (
            <div 
              key={skill}
              className="text-xs px-2 py-1 rounded text-white"
              style={{ backgroundColor: `${config.color}99` }}
            >
              {skill.split('_').pop()} {level}
            </div>
          ))}
        </div>
      </div>

      {/* Abilities */}
      {agent.abilities.length > 0 && (
        <div className="mb-3 text-xs">
          <div className="font-semibold mb-1 text-gray-700">Abilities ({agent.abilities.length})</div>
          <div className="flex flex-wrap gap-1">
            {agent.abilities.slice(0, 2).map((ability, idx) => (
              <span key={idx} className="text-xs bg-white bg-opacity-70 px-2 py-1 rounded">
                ✨ {ability}
              </span>
            ))}
            {agent.abilities.length > 2 && (
              <span className="text-xs bg-white bg-opacity-70 px-2 py-1 rounded">
                +{agent.abilities.length - 2} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-t pt-2 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInteract(agent.name, 'train');
          }}
          className="flex-1 px-2 py-1 text-xs font-semibold rounded text-white transition-colors"
          style={{ backgroundColor: config.color }}
          title="Train agent to improve skills"
        >
          Train
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInteract(agent.name, 'inspect');
          }}
          className="flex-1 px-2 py-1 text-xs font-semibold rounded border transition-colors"
          style={{ borderColor: config.color, color: config.color }}
          title="View detailed info"
        >
          Inspect
        </button>
      </div>
    </div>
  );
};

// Network Visualization Component
const AgentNetworkView: React.FC<{ agents: Agent[] }> = ({ agents }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-6 text-white min-h-96">
      <div className="flex items-center gap-2 mb-4">
        <Network size={20} />
        <h3 className="text-lg font-bold">Agent Ecosystem Network</h3>
      </div>
      
      <div className="grid gap-4">
        {/* Entry Agents */}
        <div className="border border-blue-500 rounded-lg p-4 bg-blue-950">
          <div className="font-bold text-blue-300 mb-2">🎯 Entry Specialists</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {agents.filter(a => a.agent_type.includes('PHYSICS')).map(a => (
              <div key={a.name} className="bg-blue-800 px-2 py-1 rounded">
                {a.name} (Lv{a.level})
              </div>
            ))}
          </div>
        </div>

        {/* Exit Agents */}
        <div className="border border-green-500 rounded-lg p-4 bg-green-950">
          <div className="font-bold text-green-300 mb-2">🚪 Exit Specialists</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {agents.filter(a => a.agent_type.includes('EXIT') || a.agent_type.includes('OPPOSITION') || a.agent_type.includes('MICROSTRUCTURE')).map(a => (
              <div key={a.name} className="bg-green-800 px-2 py-1 rounded">
                {a.name} (Lv{a.level})
              </div>
            ))}
          </div>
        </div>

        {/* Other Agents */}
        <div className="border border-purple-500 rounded-lg p-4 bg-purple-950">
          <div className="font-bold text-purple-300 mb-2">⚔️ Combat Specialists</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {agents.filter(a => !a.agent_type.includes('PHYSICS') && !a.agent_type.includes('EXIT') && !a.agent_type.includes('OPPOSITION') && !a.agent_type.includes('MICROSTRUCTURE')).map(a => (
              <div key={a.name} className="bg-purple-800 px-2 py-1 rounded">
                {a.name} (Lv{a.level})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-600 text-xs text-gray-400">
        <div className="grid grid-cols-3 gap-4">
          <div>Entry agents scout for opportunities</div>
          <div>Exit agents manage profit & protection</div>
          <div>Combats execute the strategy</div>
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
export default function AgentArenaHub() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'network' | 'leaderboard'>('cards');
  const [filter, setFilter] = useState<'all' | 'entry' | 'exit' | 'combat'>('all');

  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/rpg-agents/status');
        if (response.ok) {
          const data = await response.json();
          setAgents(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  const filterAgents = () => {
    if (filter === 'all') return agents;
    if (filter === 'entry') return agents.filter(a => a.agent_type.includes('PHYSICS'));
    if (filter === 'exit') return agents.filter(a => 
      a.agent_type.includes('EXIT') || 
      a.agent_type.includes('OPPOSITION') || 
      a.agent_type.includes('MICROSTRUCTURE')
    );
    return agents.filter(a => 
      !a.agent_type.includes('PHYSICS') && 
      !a.agent_type.includes('EXIT') &&
      !a.agent_type.includes('OPPOSITION') &&
      !a.agent_type.includes('MICROSTRUCTURE')
    );
  };

  const handleInteract = async (agentName: string, action: string) => {
    console.log(`Agent ${agentName} - Action: ${action}`);
    // Handle interactions here
  };

  const filteredAgents = filterAgents();
  const avgWinRate = filteredAgents.length > 0 
    ? (filteredAgents.reduce((sum, a) => sum + a.stats.win_rate, 0) / filteredAgents.length * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🎮 Agent Arena</h1>
              <p className="text-gray-400">View all agents, their stats, abilities, and interactions</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-400">{agents.length}</div>
              <div className="text-gray-400">Active Agents</div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-900 bg-opacity-50 border border-blue-500 rounded-lg p-3">
              <div className="text-gray-400 text-sm">Avg Win Rate</div>
              <div className="text-2xl font-bold text-blue-300">{avgWinRate}%</div>
            </div>
            <div className="bg-purple-900 bg-opacity-50 border border-purple-500 rounded-lg p-3">
              <div className="text-gray-400 text-sm">Total Trades</div>
              <div className="text-2xl font-bold text-purple-300">
                {agents.reduce((sum, a) => sum + a.stats.total_trades, 0)}
              </div>
            </div>
            <div className="bg-green-900 bg-opacity-50 border border-green-500 rounded-lg p-3">
              <div className="text-gray-400 text-sm">Avg Sharpe</div>
              <div className="text-2xl font-bold text-green-300">
                {(agents.reduce((sum, a) => sum + a.stats.sharpe_ratio, 0) / agents.length).toFixed(2)}
              </div>
            </div>
            <div className="bg-yellow-900 bg-opacity-50 border border-yellow-500 rounded-lg p-3">
              <div className="text-gray-400 text-sm">Avg Level</div>
              <div className="text-2xl font-bold text-yellow-300">
                {(agents.reduce((sum, a) => sum + a.level, 0) / agents.length).toFixed(1)}
              </div>
            </div>
          </div>

          {/* View Mode Selector */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Cards View
            </button>
            <button
              onClick={() => setViewMode('network')}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                viewMode === 'network'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Network
            </button>
            <button
              onClick={() => setViewMode('leaderboard')}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                viewMode === 'leaderboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Leaderboard
            </button>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All ({agents.length})
            </button>
            <button
              onClick={() => setFilter('entry')}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                filter === 'entry'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Entry ({agents.filter(a => a.agent_type.includes('PHYSICS')).length})
            </button>
            <button
              onClick={() => setFilter('exit')}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                filter === 'exit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Exit ({agents.filter(a => a.agent_type.match(/EXIT|OPPOSITION|MICROSTRUCTURE/)).length})
            </button>
            <button
              onClick={() => setFilter('combat')}
              className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${
                filter === 'combat'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Combat ({agents.filter(a => !a.agent_type.match(/PHYSICS|EXIT|OPPOSITION|MICROSTRUCTURE/)).length})
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-gray-400">Loading agents...</div>
          </div>
        )}

        {/* View Content */}
        {!loading && (
          <>
            {viewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAgents.map(agent => (
                  <AgentCard
                    key={agent.name}
                    agent={agent}
                    onViewDetails={setSelectedAgent}
                    onInteract={handleInteract}
                  />
                ))}
              </div>
            )}

            {viewMode === 'network' && (
              <AgentNetworkView agents={filteredAgents} />
            )}

            {viewMode === 'leaderboard' && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-400 font-semibold">Rank</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-semibold">Agent</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-semibold">Level</th>
                      <th className="px-4 py-3 text-right text-gray-400 font-semibold">Win Rate</th>
                      <th className="px-4 py-3 text-right text-gray-400 font-semibold">Trades</th>
                      <th className="px-4 py-3 text-right text-gray-400 font-semibold">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredAgents]
                      .sort((a, b) => b.stats.sharpe_ratio - a.stats.sharpe_ratio)
                      .map((agent, idx) => (
                        <tr 
                          key={agent.name}
                          className="border-b border-gray-700 hover:bg-gray-700 cursor-pointer"
                          onClick={() => setSelectedAgent(agent)}
                        >
                          <td className="px-4 py-3 text-gray-300">#{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{agent.name}</div>
                            <div className="text-xs text-gray-500">{agent.agent_type}</div>
                          </td>
                          <td className="px-4 py-3 text-yellow-400 font-bold">Lv{agent.level}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={agent.stats.win_rate > 0.6 ? 'text-green-400' : agent.stats.win_rate > 0.5 ? 'text-yellow-400' : 'text-red-400'}>
                              {(agent.stats.win_rate * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">{agent.stats.total_trades}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-400">{agent.stats.sharpe_ratio.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAgent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedAgent(null)}
        >
          <div 
            className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">{selectedAgent.name}</h2>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-gray-400 text-sm">Type</div>
                  <div className="text-white font-semibold">{selectedAgent.agent_type}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Level</div>
                  <div className="text-white font-semibold">Lv{selectedAgent.level}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Rank</div>
                  <div className="text-white font-semibold">{selectedAgent.rank}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Personality</div>
                  <div className="text-white font-semibold">{selectedAgent.personality}</div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3">Statistics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-gray-400 text-sm">Win Rate</div>
                    <div className="text-xl font-bold text-green-400">{(selectedAgent.stats.win_rate * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-gray-400 text-sm">Profit Factor</div>
                    <div className="text-xl font-bold text-blue-400">{selectedAgent.stats.profit_factor.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-gray-400 text-sm">Sharpe Ratio</div>
                    <div className="text-xl font-bold text-purple-400">{selectedAgent.stats.sharpe_ratio.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3">Skills</h3>
                <div className="space-y-2">
                  {Object.entries(selectedAgent.skill_levels).map(([skill, level]) => (
                    <div key={skill}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{skill}</span>
                        <span className="text-gray-400">{level}/10</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(level / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedAgent.achievements.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-3">Achievements</h3>
                  <div className="space-y-2">
                    {selectedAgent.achievements.map((achievement, idx) => (
                      <div key={idx} className="bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded p-3">
                        <div className="font-semibold text-yellow-300">🏆 {achievement.name}</div>
                        <div className="text-sm text-gray-300">{achievement.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
