/**
 * PHASE 5: EXTENDED AGENT LEADERBOARD & STATUS
 * 
 * Shows all 5 core RPG agents with real-time performance metrics
 * Displays: Win rate, Sharpe ratio, active signals, achievement badges
 * Updates via WebSocket
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Zap, TrendingUp, AlertCircle, Award } from 'lucide-react';

export interface AgentStatus {
  id: string;
  name: string;
  strategy: 'TREND_FOLLOWING' | 'MEAN_REVERSION' | 'MOMENTUM' | 'BREAKOUT' | 'VOLATILITY';
  rank: number;
  winRate: number;                    // 0-100
  totalTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;              // Total wins / Total losses
  activeSignals: number;
  lastActiveTime: string;
  achievements: string[];            // Badge types
  performanceTrend: 'up' | 'down' | 'stable';
  status: 'active' | 'learning' | 'paused' | 'inactive';
}

export interface AgentLeaderboardProps {
  agents: AgentStatus[];
}

const AgentLeaderboard: React.FC<AgentLeaderboardProps> = ({ agents }) => {
  const [sortBy, setSortBy] = useState<'rank' | 'winRate' | 'sharpe' | 'profit'>('rank');
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);

  // Sort agents based on selected criteria
  const sortedAgents = [...agents].sort((a, b) => {
    switch (sortBy) {
      case 'winRate':
        return b.winRate - a.winRate;
      case 'sharpe':
        return b.sharpeRatio - a.sharpeRatio;
      case 'profit':
        return b.profitFactor - a.profitFactor;
      case 'rank':
      default:
        return a.rank - b.rank;
    }
  });

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'learning':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'TREND_FOLLOWING':
        return '📈';
      case 'MEAN_REVERSION':
        return '🔄';
      case 'MOMENTUM':
        return '⚡';
      case 'BREAKOUT':
        return '🚀';
      case 'VOLATILITY':
        return '🌪️';
      default:
        return '🎯';
    }
  };

  const getAchievementIcon = (achievement: string) => {
    switch (achievement) {
      case 'HIGH_WINRATE':
        return '🎯';
      case 'CONSISTENT_PERFORMER':
        return '📊';
      case 'RISK_MANAGER':
        return '🛡️';
      case 'PROFIT_GENERATOR':
        return '💰';
      case 'EARLY_ADOPTER':
        return '⭐';
      default:
        return '🏆';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '➖';
    }
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* HEADER */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Trophy className="text-yellow-500" size={24} />
          Agent Leaderboard
        </h2>
        <p className="text-sm text-gray-600">Real-time performance rankings of all trading agents</p>
      </div>

      {/* SORT CONTROLS */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'rank', label: 'By Rank' },
          { value: 'winRate', label: 'By Win Rate' },
          { value: 'sharpe', label: 'By Sharpe Ratio' },
          { value: 'profit', label: 'By Profit Factor' }
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setSortBy(option.value as any)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              sortBy === option.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* AGENT CARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedAgents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
            className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200 cursor-pointer hover:shadow-lg transition hover:border-blue-400"
          >
            {/* AGENT HEADER */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl font-bold w-10">{getMedalEmoji(agent.rank)}</span>
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <span>{getStrategyIcon(agent.strategy)}</span>
                    {agent.name}
                  </h3>
                  <p className="text-xs text-gray-600">{agent.strategy}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${getStatusColor(agent.status)}`}>
                {agent.status.toUpperCase()}
              </div>
            </div>

            {/* PRIMARY METRICS */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Win Rate</p>
                <p className={`text-xl font-bold ${agent.winRate >= 55 ? 'text-green-600' : agent.winRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {agent.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Sharpe Ratio</p>
                <p className={`text-xl font-bold ${agent.sharpeRatio > 1.5 ? 'text-green-600' : agent.sharpeRatio > 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {agent.sharpeRatio.toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Profit Factor</p>
                <p className={`text-xl font-bold ${agent.profitFactor > 1.5 ? 'text-green-600' : agent.profitFactor > 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {agent.profitFactor.toFixed(2)}x
                </p>
              </div>
              <div className="bg-white rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Max Drawdown</p>
                <p className="text-xl font-bold text-orange-600">{Math.abs(agent.maxDrawdown).toFixed(1)}%</p>
              </div>
            </div>

            {/* SECONDARY INFO */}
            <div className="grid grid-cols-3 gap-2 text-xs mb-4 bg-white rounded p-3">
              <div>
                <p className="text-gray-600">Total Trades</p>
                <p className="font-bold">{agent.totalTrades}</p>
              </div>
              <div>
                <p className="text-gray-600">Active Signals</p>
                <p className="font-bold text-blue-600">{agent.activeSignals}</p>
              </div>
              <div>
                <p className="text-gray-600">Trend</p>
                <p className="font-bold">{getTrendIcon(agent.performanceTrend)}</p>
              </div>
            </div>

            {/* ACHIEVEMENTS BADGES */}
            {agent.achievements.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {agent.achievements.slice(0, 3).map((achievement) => (
                  <span
                    key={achievement}
                    className="text-lg"
                    title={achievement}
                  >
                    {getAchievementIcon(achievement)}
                  </span>
                ))}
                {agent.achievements.length > 3 && (
                  <span className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded">
                    +{agent.achievements.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* EXPAND/COLLAPSE INDICATOR */}
            <div className="text-center text-xs text-blue-500 font-semibold">
              {selectedAgent?.id === agent.id ? '▼ Hide Details' : '▶ View Details'}
            </div>
          </div>
        ))}
      </div>

      {/* DETAILED AGENT VIEW */}
      {selectedAgent && (
        <div className="mt-6 bg-blue-50 rounded-lg p-6 border-2 border-blue-200 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span>{getStrategyIcon(selectedAgent.strategy)}</span>
                {selectedAgent.name} - Detailed Performance
              </h3>
              <p className="text-sm text-gray-600">Last active: {new Date(selectedAgent.lastActiveTime).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-xl font-bold text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* DETAILED METRICS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded p-4">
              <p className="text-xs text-gray-600 mb-2">Win Rate</p>
              <p className="text-2xl font-bold text-green-600">{selectedAgent.winRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-600 mt-2">{selectedAgent.totalTrades > 0 ? Math.round((selectedAgent.winRate / 100) * selectedAgent.totalTrades) : 0} wins</p>
            </div>
            <div className="bg-white rounded p-4">
              <p className="text-xs text-gray-600 mb-2">Sharpe Ratio</p>
              <p className="text-2xl font-bold text-blue-600">{selectedAgent.sharpeRatio.toFixed(2)}</p>
              <p className="text-xs text-gray-600 mt-2">Risk-adjusted return</p>
            </div>
            <div className="bg-white rounded p-4">
              <p className="text-xs text-gray-600 mb-2">Profit Factor</p>
              <p className="text-2xl font-bold text-purple-600">{selectedAgent.profitFactor.toFixed(2)}x</p>
              <p className="text-xs text-gray-600 mt-2">Total gains / losses</p>
            </div>
            <div className="bg-white rounded p-4">
              <p className="text-xs text-gray-600 mb-2">Max Drawdown</p>
              <p className="text-2xl font-bold text-red-600">{Math.abs(selectedAgent.maxDrawdown).toFixed(1)}%</p>
              <p className="text-xs text-gray-600 mt-2">Largest decline</p>
            </div>
          </div>

          {/* ALL ACHIEVEMENTS */}
          {selectedAgent.achievements.length > 0 && (
            <div className="bg-white rounded p-4">
              <p className="font-bold mb-3 flex items-center gap-2">
                <Award size={18} />
                Achievements ({selectedAgent.achievements.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {selectedAgent.achievements.map((achievement) => (
                  <div key={achievement} className="flex items-center gap-2 bg-yellow-100 px-3 py-2 rounded-lg">
                    <span className="text-xl">{getAchievementIcon(achievement)}</span>
                    <span className="font-semibold text-sm">{achievement.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATUS & ACTIVITY */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded p-4">
              <p className="text-xs text-gray-600 mb-2">Status</p>
              <div className={`px-3 py-2 rounded-lg border inline-block font-bold ${getStatusColor(selectedAgent.status)}`}>
                {selectedAgent.status.toUpperCase()}
              </div>
            </div>
            <div className="bg-white rounded p-4">
              <p className="text-xs text-gray-600 mb-2">Performance Trend</p>
              <p className="font-bold text-lg">{getTrendIcon(selectedAgent.performanceTrend)} {selectedAgent.performanceTrend.toUpperCase()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentLeaderboard;
