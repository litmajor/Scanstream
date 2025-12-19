import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  Zap, ArrowLeft, Users, TrendingUp, Flame, Shield, Clock,
  Search, Filter, ChevronDown, BarChart3, Trophy, Activity
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface ComboLog {
  id: string;
  timestamp: string;
  comboName: string;
  agents: string[];
  bonusMultiplier: number;
  description: string;
  impact: number;
  duration: number;
  trades_affected: number;
  pnl_boost: number;
}

const SAMPLE_COMBO_LOGS: ComboLog[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    comboName: 'Perfect Storm',
    agents: ['BreakoutHunter', 'TrendRider', 'GRADIENT_TREND'],
    bonusMultiplier: 2.5,
    description: 'Breakout + trend + gradient = unstoppable',
    impact: 95,
    duration: 45,
    trades_affected: 3,
    pnl_boost: 450
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    comboName: 'ML Consensus',
    agents: ['ML', 'RL', 'Scanner'],
    bonusMultiplier: 1.7,
    description: 'Machine learning agents voting together',
    impact: 72,
    duration: 30,
    trades_affected: 2,
    pnl_boost: 280
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    comboName: 'Divergence Surge',
    agents: ['VFMD', 'Flow'],
    bonusMultiplier: 1.5,
    description: 'VFMD + Flow physics create powerful entry signals',
    impact: 68,
    duration: 25,
    trades_affected: 2,
    pnl_boost: 165
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    comboName: 'Smart Exit',
    agents: ['EXIT', 'OPPOSITION', 'Volume Profile'],
    bonusMultiplier: 1.8,
    description: 'Orchestrated exit with support resistance',
    impact: 85,
    duration: 35,
    trades_affected: 1,
    pnl_boost: 320
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 2400000).toISOString(),
    comboName: 'Risk Fortress',
    agents: ['RiskManager', 'MICROSTRUCTURE', 'UT_BOT'],
    bonusMultiplier: 1.6,
    description: 'Defensive combo for risk management',
    impact: 62,
    duration: 20,
    trades_affected: 1,
    pnl_boost: 125
  },
];

type SortBy = 'timestamp' | 'impact' | 'multiplier' | 'pnl';

const ComboActivityPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);

  // Mock data - in production, fetch from API
  const combos = SAMPLE_COMBO_LOGS;

  // Calculate stats
  const stats = useMemo(() => {
    return {
      totalCombos: combos.length,
      totalTradesAffected: combos.reduce((sum, c) => sum + c.trades_affected, 0),
      totalPnLBoost: combos.reduce((sum, c) => sum + c.pnl_boost, 0),
      avgMultiplier: (combos.reduce((sum, c) => sum + c.bonusMultiplier, 0) / combos.length).toFixed(2),
      avgImpact: Math.round(combos.reduce((sum, c) => sum + c.impact, 0) / combos.length),
    };
  }, [combos]);

  // Filter and sort
  const filteredAndSortedCombos = useMemo(() => {
    let filtered = combos.filter(combo => {
      if (searchTerm && !combo.comboName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let compare = 0;
      switch (sortBy) {
        case 'timestamp':
          compare = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'impact':
          compare = a.impact - b.impact;
          break;
        case 'multiplier':
          compare = a.bonusMultiplier - b.bonusMultiplier;
          break;
        case 'pnl':
          compare = a.pnl_boost - b.pnl_boost;
          break;
      }
      return sortAsc ? compare : -compare;
    });

    return filtered;
  }, [combos, searchTerm, sortBy, sortAsc]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/agent-roster')}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={32} className="text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Combo Activity Log</h1>
          </div>
          <p className="text-slate-400 text-lg">Track agent synergies and combo triggers</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <div className="text-purple-300 text-sm font-semibold mb-1">Total Combos</div>
            <div className="text-3xl font-bold text-white">{stats.totalCombos}</div>
          </div>

          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-300 text-sm font-semibold mb-1">Avg Multiplier</div>
            <div className="text-3xl font-bold text-white">{stats.avgMultiplier}x</div>
          </div>

          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <div className="text-green-300 text-sm font-semibold mb-1">Total P&L Boost</div>
            <div className="text-3xl font-bold text-white">+${stats.totalPnLBoost}</div>
          </div>

          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
            <div className="text-orange-300 text-sm font-semibold mb-1">Avg Impact</div>
            <div className="text-3xl font-bold text-white">{stats.avgImpact}%</div>
          </div>

          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
            <div className="text-amber-300 text-sm font-semibold mb-1">Trades Affected</div>
            <div className="text-3xl font-bold text-white">{stats.totalTradesAffected}</div>
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
                placeholder="Search combos..."
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
                <option value="timestamp">Timestamp</option>
                <option value="impact">Impact</option>
                <option value="multiplier">Multiplier</option>
                <option value="pnl">P&L Boost</option>
              </select>
            </div>

            {/* Sort Direction */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white hover:bg-slate-600 transition flex items-center justify-center gap-2"
            >
              {sortAsc ? '↑' : '↓'} {sortAsc ? 'Asc' : 'Desc'}
            </button>

            {/* Space for alignment */}
            <div></div>
          </div>
        </div>

        {/* Combo Log Table */}
        <div className="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Time</th>
                <th className="px-6 py-4 text-left text-slate-300 font-semibold">Combo Name</th>
                <th className="px-6 py-4 text-center text-slate-300 font-semibold">Agents</th>
                <th className="px-6 py-4 text-center text-slate-300 font-semibold">Multiplier</th>
                <th className="px-6 py-4 text-center text-slate-300 font-semibold">Impact</th>
                <th className="px-6 py-4 text-center text-slate-300 font-semibold">Duration</th>
                <th className="px-6 py-4 text-center text-slate-300 font-semibold">Trades</th>
                <th className="px-6 py-4 text-center text-slate-300 font-semibold">P&L Boost</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCombos.length > 0 ? (
                filteredAndSortedCombos.map((combo) => (
                  <tr 
                    key={combo.id}
                    className="border-b border-slate-700 hover:bg-slate-700/30 transition"
                  >
                    <td className="px-6 py-4">
                      <span className="text-slate-300 text-sm">
                        {new Date(combo.timestamp).toLocaleTimeString()}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{combo.comboName}</div>
                      <div className="text-slate-400 text-xs">{combo.description}</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-blue-400 font-bold">{combo.agents.length}</span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-yellow-400 font-bold">{combo.bonusMultiplier}x</span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-12 bg-slate-700 rounded-full h-2">
                          <div 
                            className="h-full rounded-full bg-green-500"
                            style={{ width: `${combo.impact}%` }}
                          />
                        </div>
                        <span className="text-green-400 font-bold text-sm">{combo.impact}%</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-slate-300">{combo.duration}s</span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-blue-400 font-bold">{combo.trades_affected}</span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400 font-bold">+${combo.pnl_boost}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Activity size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No combo activity found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Combo Pair Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Most Active Agents */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users size={20} className="text-blue-400" />
              Most Active Agents
            </h3>
            <div className="space-y-2">
              {['VFMD', 'Flow', 'BreakoutHunter'].map((agent, idx) => (
                <div key={agent} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                  <span className="text-white text-sm font-semibold">#{idx + 1} {agent}</span>
                  <span className="text-amber-400">{8 - idx * 2} combos</span>
                </div>
              ))}
            </div>
          </div>

          {/* Best Performing Combos */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy size={20} className="text-amber-400" />
              Best Performing
            </h3>
            <div className="space-y-2">
              {combos.slice().sort((a, b) => b.impact - a.impact).slice(0, 3).map((combo, idx) => (
                <div key={combo.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                  <span className="text-white text-sm font-semibold">{combo.comboName}</span>
                  <span className="text-green-400">{combo.impact}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Combo Frequency */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-purple-400" />
              Frequency
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                <span className="text-white text-sm">Last Hour</span>
                <span className="text-blue-400 font-bold">{combos.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                <span className="text-white text-sm">Last 24h</span>
                <span className="text-blue-400 font-bold">{combos.length * 8}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                <span className="text-white text-sm">All Time</span>
                <span className="text-blue-400 font-bold">{combos.length * 42}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboActivityPage;
