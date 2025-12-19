import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, Zap, Activity, Filter, Trash2, Calendar,
  TrendingUp, Trophy, AlertCircle, Users, Clock
} from 'lucide-react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { cn } from '@/lib/utils';

type EventTypeFilter = 'all' | 'xp_gain' | 'level_up' | 'mood_change' | 'trade_result' | 'combo_activation' | 'achievement_unlocked';

const RealtimeUpdatesPage: React.FC = () => {
  const [, navigate] = useLocation();
  const { events, isConnected, clearEvent, clearAll } = useRealtime();
  const [filterType, setFilterType] = useState<EventTypeFilter>('all');
  const [filterAgent, setFilterAgent] = useState('');

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const typeMatch = filterType === 'all' || e.type === filterType;
      const agentMatch = !filterAgent || e.agentName.toLowerCase().includes(filterAgent.toLowerCase());
      return typeMatch && agentMatch;
    });
  }, [events, filterType, filterAgent]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      totalEvents: events.length,
      xpGains: events.filter((e) => e.type === 'xp_gain').length,
      levelUps: events.filter((e) => e.type === 'level_up').length,
      trades: events.filter((e) => e.type === 'trade_result').length,
      combos: events.filter((e) => e.type === 'combo_activation').length,
      achievements: events.filter((e) => e.type === 'achievement_unlocked').length,
      uniqueAgents: new Set(events.map((e) => e.agentName)).size,
    };
  }, [events]);

  // Get event type label
  const getEventLabel = (type: EventTypeFilter): string => {
    const labels: Record<EventTypeFilter, string> = {
      all: 'All Events',
      xp_gain: 'XP Gains',
      level_up: 'Level Ups',
      mood_change: 'Mood Changes',
      trade_result: 'Trade Results',
      combo_activation: 'Combo Activations',
      achievement_unlocked: 'Achievements',
    };
    return labels[type];
  };

  // Get event color
  const getEventColor = (type: string): string => {
    const colors: Record<string, string> = {
      xp_gain: 'bg-yellow-500',
      level_up: 'bg-green-500',
      mood_change: 'bg-blue-500',
      trade_result: 'bg-purple-500',
      combo_activation: 'bg-purple-600',
      achievement_unlocked: 'bg-amber-600',
    };
    return colors[type] || 'bg-slate-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/agent-arena-hub')}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity size={32} className={cn(
                'transition-all',
                isConnected ? 'text-green-400 animate-pulse' : 'text-red-400'
              )} />
              <h1 className="text-4xl font-bold text-white">Live Updates</h1>
            </div>
            <div className={cn(
              'px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2',
              isConnected
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-red-500/20 border border-red-500/30 text-red-400'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <p className="text-slate-400 text-lg">Real-time agent activity stream</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs font-semibold mb-1">Total Events</div>
            <div className="text-2xl font-bold text-white">{stats.totalEvents}</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-center">
            <div className="text-yellow-400 text-xs font-semibold mb-1">⭐ XP Gains</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.xpGains}</div>
          </div>
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
            <div className="text-green-400 text-xs font-semibold mb-1">🎉 Level Ups</div>
            <div className="text-2xl font-bold text-green-400">{stats.levelUps}</div>
          </div>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 text-center">
            <div className="text-purple-400 text-xs font-semibold mb-1">📈 Trades</div>
            <div className="text-2xl font-bold text-purple-400">{stats.trades}</div>
          </div>
          <div className="bg-purple-900/30 border border-purple-600/30 rounded-lg p-4 text-center">
            <div className="text-purple-300 text-xs font-semibold mb-1">⚡ Combos</div>
            <div className="text-2xl font-bold text-purple-300">{stats.combos}</div>
          </div>
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 text-center">
            <div className="text-amber-400 text-xs font-semibold mb-1">🏆 Achievements</div>
            <div className="text-2xl font-bold text-amber-400">{stats.achievements}</div>
          </div>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
            <div className="text-blue-400 text-xs font-semibold mb-1">👥 Agents</div>
            <div className="text-2xl font-bold text-blue-400">{stats.uniqueAgents}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filter by Type */}
            <div>
              <label className="block text-slate-400 text-sm font-semibold mb-2">
                Event Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as EventTypeFilter)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 transition"
              >
                <option value="all">All Events</option>
                <option value="xp_gain">XP Gains</option>
                <option value="level_up">Level Ups</option>
                <option value="mood_change">Mood Changes</option>
                <option value="trade_result">Trade Results</option>
                <option value="combo_activation">Combo Activations</option>
                <option value="achievement_unlocked">Achievements</option>
              </select>
            </div>

            {/* Filter by Agent */}
            <div>
              <label className="block text-slate-400 text-sm font-semibold mb-2">
                Agent Name
              </label>
              <input
                type="text"
                placeholder="Search agents..."
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Results */}
            <div>
              <label className="block text-slate-400 text-sm font-semibold mb-2">
                Results
              </label>
              <div className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm">
                {filteredEvents.length} / {events.length} events
              </div>
            </div>

            {/* Clear Button */}
            <div className="flex items-end">
              <button
                onClick={() => clearAll()}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-3">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="group bg-slate-800/40 border border-slate-700 rounded-lg p-4 hover:bg-slate-800/60 hover:border-slate-600 transition"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    'p-3 rounded-lg text-white flex-shrink-0',
                    getEventColor(event.type)
                  )}>
                    {event.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">
                          {event.title}
                        </div>
                        <div className="text-slate-400 text-sm mt-1">
                          {event.description}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {event.agentName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Close Button */}
                      <button
                        onClick={() => clearEvent(event.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white flex-shrink-0"
                      >
                        <AlertCircle size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Activity size={48} className="mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400 text-lg font-semibold">No events match your filters</p>
              <p className="text-slate-500 text-sm mt-2">Waiting for live agent activity...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealtimeUpdatesPage;
