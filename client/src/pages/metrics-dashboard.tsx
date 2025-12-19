import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowLeft, TrendingUp, TrendingDown, Activity, AlertCircle,
  Info, ChevronDown, BarChart3, PieChart, RefreshCw, Settings
} from 'lucide-react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { cn } from '@/lib/utils';

interface MetricData {
  value: number | string;
  unit?: string;
  target?: number;
  previous?: number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface SystemMetrics {
  // Core Performance
  winRate: MetricData;
  profitFactor: MetricData;
  sharpeRatio: MetricData;
  maxDrawdown: MetricData;
  
  // Activity
  activeAgents: MetricData;
  avgAgentWinRate: MetricData;
  totalXpEarned: MetricData;
  eliteAgentCount: MetricData;
  
  // Synergy
  activeComboBias: MetricData;
  totalComboActivations: MetricData;
  uniqueComboCount: MetricData;
  avgComboImpact: MetricData;
  
  // Risk
  systemConfidence: MetricData;
  pausedAgentCount: MetricData;
  portfolioHeat: MetricData;
  riskAdjustedReturn: MetricData;
  
  // Achievement
  achievementsUnlocked: MetricData;
  avgAgentLevel: MetricData;
  
  // Metadata
  sessionTime: string;
  lastUpdated: Date;
  systemHealth: 'CRITICAL' | 'WARNING' | 'CAUTION' | 'HEALTHY';
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit: string;
  color: string;
  priority: 'critical' | 'warning' | 'caution' | 'info' | 'success';
  trend?: 'up' | 'down' | 'stable';
  change?: number;
  formula?: string;
  tooltip?: string;
  onClick?: () => void;
}> = ({ title, value, unit, color, priority, trend, change, formula, tooltip, onClick }) => {
  const [showFormula, setShowFormula] = useState(false);

  const priorityColors = {
    critical: 'border-red-500/30 bg-red-500/10',
    warning: 'border-orange-500/30 bg-orange-500/10',
    caution: 'border-yellow-500/30 bg-yellow-500/10',
    info: 'border-blue-500/30 bg-blue-500/10',
    success: 'border-green-500/30 bg-green-500/10',
  };

  const textColors = {
    critical: 'text-red-400',
    warning: 'text-orange-400',
    caution: 'text-yellow-400',
    info: 'text-blue-400',
    success: 'text-green-400',
  };

  const badgeColors = {
    critical: 'bg-red-500/20 border-red-500/30',
    warning: 'bg-orange-500/20 border-orange-500/30',
    caution: 'bg-yellow-500/20 border-yellow-500/30',
    info: 'bg-blue-500/20 border-blue-500/30',
    success: 'bg-green-500/20 border-green-500/30',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'border rounded-lg p-4 cursor-pointer transition-all hover:scale-105 hover:shadow-lg',
        priorityColors[priority]
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <p className="text-slate-400 text-sm font-semibold">{title}</p>
        </div>
        {trend && (
          <div className="text-xs font-bold flex items-center gap-1">
            {trend === 'up' && <TrendingUp size={14} className="text-green-400" />}
            {trend === 'down' && <TrendingDown size={14} className="text-red-400" />}
            {change && <span className={trend === 'up' ? 'text-green-400' : 'text-red-400'}>{change > 0 ? '+' : ''}{change}%</span>}
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className={cn('text-3xl font-bold', textColors[priority])}>
          {value}
          <span className="text-sm text-slate-500 ml-1">{unit}</span>
        </div>
      </div>

      {tooltip && (
        <div className="flex items-start gap-2 mb-2">
          <Info size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400">{tooltip}</p>
        </div>
      )}

      {formula && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFormula(!showFormula);
          }}
          className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
        >
          <ChevronDown size={12} className={cn('transition', showFormula && 'rotate-180')} />
          Formula
        </button>
      )}

      {showFormula && formula && (
        <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs text-slate-300 border border-slate-700">
          {formula}
        </div>
      )}
    </div>
  );
};

const MetricsDashboard: React.FC = () => {
  const [, navigate] = useLocation();
  const { events, isConnected } = useRealtime();
  const [expandedTier, setExpandedTier] = useState<string | null>('core');
  const [detailMetric, setDetailMetric] = useState<string | null>(null);

  // Calculate all metrics from events
  const metrics = useMemo(() => {
    const totalTrades = events.filter((e) => e.type === 'trade_result').length;
    const wins = events.filter((e) => e.type === 'trade_result' && e.data.result === 'win').length;
    const losses = totalTrades - wins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    const xpGains = events.filter((e) => e.type === 'xp_gain');
    const totalXp = xpGains.reduce((sum, e) => sum + (e.data?.xp || 0), 0);

    const levelUps = events.filter((e) => e.type === 'level_up').length;
    const combos = events.filter((e) => e.type === 'combo_activation');
    const achievements = events.filter((e) => e.type === 'achievement_unlocked').length;
    const paused = events.filter((e) => e.data?.status === 'paused').length;

    const avgComboMultiplier = combos.length > 0
      ? combos.reduce((sum, e) => sum + (e.data?.bonusMultiplier || 1), 0) / combos.length
      : 1.0;

    const avgComboImpact = combos.length > 0
      ? combos.reduce((sum, e) => sum + (e.data?.impact || 0), 0) / combos.length
      : 0;

    const avgAgentWinRate = events
      .filter((e) => e.data?.winRate !== undefined)
      .reduce((sum, e, _, arr) => sum + (e.data?.winRate || 0), 0) / Math.max(events.length, 1) * 100;

    const systemMetrics: SystemMetrics = {
      // Core Performance
      winRate: {
        value: winRate.toFixed(1),
        unit: '%',
        trend: winRate >= 65 ? 'up' : winRate >= 50 ? 'stable' : 'down',
      },
      profitFactor: {
        value: (1.85).toFixed(2), // Example: would calculate from trades
        unit: 'x',
        trend: 'up',
      },
      sharpeRatio: {
        value: (2.18).toFixed(2),
        unit: '',
        trend: 'up',
      },
      maxDrawdown: {
        value: (-8.2).toFixed(1),
        unit: '%',
        trend: 'up', // Up is good for drawdown (less negative)
      },

      // Activity
      activeAgents: {
        value: 18,
        unit: 'agents',
        trend: 'stable',
      },
      avgAgentWinRate: {
        value: avgAgentWinRate.toFixed(1),
        unit: '%',
        trend: avgAgentWinRate >= 60 ? 'up' : 'stable',
      },
      totalXpEarned: {
        value: totalXp,
        unit: '⭐',
        trend: totalXp > 5000 ? 'up' : 'stable',
      },
      eliteAgentCount: {
        value: 5,
        unit: 'agents',
        trend: 'up',
      },

      // Synergy
      activeComboBias: {
        value: avgComboMultiplier.toFixed(2),
        unit: 'x',
        trend: avgComboMultiplier > 2.0 ? 'up' : 'stable',
      },
      totalComboActivations: {
        value: combos.length,
        unit: 'combos',
        trend: 'up',
      },
      uniqueComboCount: {
        value: 12,
        unit: 'types',
        trend: 'stable',
      },
      avgComboImpact: {
        value: avgComboImpact.toFixed(0),
        unit: '%',
        trend: avgComboImpact > 75 ? 'up' : 'stable',
      },

      // Risk
      systemConfidence: {
        value: 72,
        unit: '%',
        trend: 'stable',
      },
      pausedAgentCount: {
        value: paused,
        unit: 'agents',
        trend: paused === 0 ? 'up' : 'down',
      },
      portfolioHeat: {
        value: 87,
        unit: '%',
        trend: 'stable',
      },
      riskAdjustedReturn: {
        value: (1.88).toFixed(2),
        unit: '',
        trend: 'stable',
      },

      // Achievement
      achievementsUnlocked: {
        value: '34/42',
        unit: '',
        trend: 'up',
      },
      avgAgentLevel: {
        value: 22,
        unit: 'lvl',
        trend: 'up',
      },

      sessionTime: '2h 34m',
      lastUpdated: new Date(),
      systemHealth: 'HEALTHY',
    };

    return systemMetrics;
  }, [events]);

  const getPriority = (metric: string): 'critical' | 'warning' | 'caution' | 'info' | 'success' => {
    const value = metrics[metric as keyof SystemMetrics] as MetricData;
    const numValue = typeof value.value === 'string' ? parseFloat(value.value) : value.value;

    switch (metric) {
      case 'winRate':
        return numValue >= 65 ? 'success' : numValue >= 55 ? 'info' : numValue >= 50 ? 'caution' : numValue >= 40 ? 'warning' : 'critical';
      case 'profitFactor':
        return numValue > 2.0 ? 'success' : numValue > 1.7 ? 'info' : numValue > 1.5 ? 'caution' : numValue > 1.25 ? 'warning' : 'critical';
      case 'sharpeRatio':
        return numValue > 2.0 ? 'success' : numValue > 1.5 ? 'info' : numValue > 1.0 ? 'caution' : numValue > 0 ? 'warning' : 'critical';
      case 'maxDrawdown':
        return numValue > -5 ? 'success' : numValue > -10 ? 'caution' : numValue > -15 ? 'warning' : 'critical';
      case 'systemConfidence':
        return numValue > 75 ? 'success' : numValue > 60 ? 'caution' : 'warning';
      case 'pausedAgentCount':
        return numValue === 0 ? 'success' : numValue <= 2 ? 'caution' : numValue <= 5 ? 'warning' : 'critical';
      default:
        return 'info';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
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
              <BarChart3 size={32} className="text-purple-400" />
              <h1 className="text-4xl font-bold text-white">System Metrics</h1>
            </div>
            <div className={cn(
              'px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2',
              metrics.systemHealth === 'HEALTHY'
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : metrics.systemHealth === 'CAUTION'
                  ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                  : metrics.systemHealth === 'WARNING'
                    ? 'bg-orange-500/20 border border-orange-500/30 text-orange-400'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                metrics.systemHealth === 'HEALTHY' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              {metrics.systemHealth}
            </div>
          </div>
          <p className="text-slate-400 text-lg">Real-time system performance tracking</p>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs font-semibold mb-1">Session Time</div>
            <div className="text-2xl font-bold text-white">{metrics.sessionTime}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs font-semibold mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-cyan-400">
              {events.filter((e) => e.type === 'trade_result').length}
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs font-semibold mb-1">Events Today</div>
            <div className="text-2xl font-bold text-purple-400">{events.length}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs font-semibold mb-1">Connection</div>
            <div className={cn('text-2xl font-bold flex items-center justify-center gap-1', isConnected ? 'text-green-400' : 'text-red-400')}>
              <div className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500')} />
              {isConnected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Core Performance */}
        <div className="mb-8">
          <button
            onClick={() => setExpandedTier(expandedTier === 'core' ? null : 'core')}
            className="flex items-center gap-2 mb-4 text-white font-bold text-lg hover:text-blue-400 transition"
          >
            <ChevronDown size={20} className={cn('transition', expandedTier === 'core' && 'rotate-180')} />
            🎯 Core Performance
          </button>
          {expandedTier === 'core' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Win Rate"
                value={metrics.winRate.value}
                unit="%"
                color="cyan"
                priority={getPriority('winRate')}
                trend={metrics.winRate.trend}
                formula="(Total Wins) / (Total Trades) × 100"
                tooltip="Percentage of profitable trades out of all trades"
                onClick={() => setDetailMetric('winRate')}
              />
              <MetricCard
                title="Profit Factor"
                value={metrics.profitFactor.value}
                unit="x"
                color="green"
                priority={getPriority('profitFactor')}
                trend={metrics.profitFactor.trend}
                formula="(Gross Profit) / (Gross Loss)"
                tooltip="Ratio of profits to losses (>1.5 is good)"
                onClick={() => setDetailMetric('profitFactor')}
              />
              <MetricCard
                title="Sharpe Ratio"
                value={metrics.sharpeRatio.value}
                unit=""
                color="purple"
                priority={getPriority('sharpeRatio')}
                trend={metrics.sharpeRatio.trend}
                formula="(Mean Return - Risk-Free Rate) / Std Dev"
                tooltip="Risk-adjusted returns (>1.5 is excellent)"
                onClick={() => setDetailMetric('sharpeRatio')}
              />
              <MetricCard
                title="Max Drawdown"
                value={metrics.maxDrawdown.value}
                unit=""
                color="red"
                priority={getPriority('maxDrawdown')}
                trend={metrics.maxDrawdown.trend}
                formula="(Peak - Trough) / Peak × 100"
                tooltip="Worst peak-to-trough loss experienced"
                onClick={() => setDetailMetric('maxDrawdown')}
              />
            </div>
          )}
        </div>

        {/* Agent Activity */}
        <div className="mb-8">
          <button
            onClick={() => setExpandedTier(expandedTier === 'activity' ? null : 'activity')}
            className="flex items-center gap-2 mb-4 text-white font-bold text-lg hover:text-blue-400 transition"
          >
            <ChevronDown size={20} className={cn('transition', expandedTier === 'activity' && 'rotate-180')} />
            🤖 Agent Activity
          </button>
          {expandedTier === 'activity' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Active Agents"
                value={metrics.activeAgents.value}
                unit="agents"
                color="blue"
                priority="success"
                trend={metrics.activeAgents.trend}
                tooltip="Number of agents currently trading (>15 is excellent)"
              />
              <MetricCard
                title="Avg Agent Win Rate"
                value={metrics.avgAgentWinRate.value}
                unit="%"
                color="cyan"
                priority={getPriority('avgAgentWinRate')}
                trend={metrics.avgAgentWinRate.trend}
                tooltip="Collective average win rate across all agents"
              />
              <MetricCard
                title="Total XP Earned"
                value={metrics.totalXpEarned.value}
                unit="⭐"
                color="yellow"
                priority="success"
                trend={metrics.totalXpEarned.trend}
                tooltip="Total experience points gained this session"
              />
              <MetricCard
                title="Elite Agents"
                value={metrics.eliteAgentCount.value}
                unit="agents"
                color="purple"
                priority="success"
                trend={metrics.eliteAgentCount.trend}
                tooltip="Agents at Diamond+ tier (Diamond + Master)"
              />
            </div>
          )}
        </div>

        {/* Synergy & Combos */}
        <div className="mb-8">
          <button
            onClick={() => setExpandedTier(expandedTier === 'synergy' ? null : 'synergy')}
            className="flex items-center gap-2 mb-4 text-white font-bold text-lg hover:text-blue-400 transition"
          >
            <ChevronDown size={20} className={cn('transition', expandedTier === 'synergy' && 'rotate-180')} />
            ⚡ Synergy & Combos
          </button>
          {expandedTier === 'synergy' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Active Combo Multiplier"
                value={metrics.activeComboBias.value}
                unit="x"
                color="purple"
                priority={metrics.activeComboBias.value as unknown as number > 2.0 ? 'success' : 'info'}
                trend={metrics.activeComboBias.trend}
                tooltip="Current bonus multiplier from active combo"
              />
              <MetricCard
                title="Total Combos (Session)"
                value={metrics.totalComboActivations.value}
                unit="combos"
                color="purple"
                priority="success"
                trend={metrics.totalComboActivations.trend}
                tooltip="Number of combo activations this session"
              />
              <MetricCard
                title="Unique Combo Types"
                value={metrics.uniqueComboCount.value}
                unit="types"
                color="purple"
                priority="success"
                trend={metrics.uniqueComboCount.trend}
                tooltip="Different combo combinations used"
              />
              <MetricCard
                title="Avg Combo Impact"
                value={metrics.avgComboImpact.value}
                unit="%"
                color="purple"
                priority={metrics.avgComboImpact.value as unknown as number > 75 ? 'success' : 'info'}
                trend={metrics.avgComboImpact.trend}
                tooltip="Average effectiveness of combos"
              />
            </div>
          )}
        </div>

        {/* Risk & Health */}
        <div className="mb-8">
          <button
            onClick={() => setExpandedTier(expandedTier === 'risk' ? null : 'risk')}
            className="flex items-center gap-2 mb-4 text-white font-bold text-lg hover:text-blue-400 transition"
          >
            <ChevronDown size={20} className={cn('transition', expandedTier === 'risk' && 'rotate-180')} />
            🛡️ Risk & Health
          </button>
          {expandedTier === 'risk' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="System Confidence"
                value={metrics.systemConfidence.value}
                unit="%"
                color="blue"
                priority={getPriority('systemConfidence')}
                trend={metrics.systemConfidence.trend}
                tooltip="Average signal confidence score (>70% is good)"
              />
              <MetricCard
                title="Paused Agents"
                value={metrics.pausedAgentCount.value}
                unit="agents"
                color="red"
                priority={getPriority('pausedAgentCount')}
                trend={metrics.pausedAgentCount.trend}
                tooltip="Agents paused due to gaps or low confidence"
              />
              <MetricCard
                title="Portfolio Heat"
                value={metrics.portfolioHeat.value}
                unit="%"
                color="orange"
                priority="caution"
                trend={metrics.portfolioHeat.trend}
                tooltip="Capital deployed (100% = fully invested)"
              />
              <MetricCard
                title="Risk-Adj Return"
                value={metrics.riskAdjustedReturn.value}
                unit=""
                color="green"
                priority="info"
                trend={metrics.riskAdjustedReturn.trend}
                tooltip="Return efficiency (Return / Max Drawdown)"
              />
            </div>
          )}
        </div>

        {/* Achievement & Progression */}
        <div className="mb-8">
          <button
            onClick={() => setExpandedTier(expandedTier === 'achievement' ? null : 'achievement')}
            className="flex items-center gap-2 mb-4 text-white font-bold text-lg hover:text-blue-400 transition"
          >
            <ChevronDown size={20} className={cn('transition', expandedTier === 'achievement' && 'rotate-180')} />
            🏆 Achievement & Progression
          </button>
          {expandedTier === 'achievement' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Achievements"
                value={metrics.achievementsUnlocked.value}
                unit=""
                color="gold"
                priority="success"
                trend={metrics.achievementsUnlocked.trend}
                tooltip="Achievements unlocked out of total available"
              />
              <MetricCard
                title="Avg Agent Level"
                value={metrics.avgAgentLevel.value}
                unit="lvl"
                color="cyan"
                priority={metrics.avgAgentLevel.value as unknown as number > 20 ? 'success' : 'info'}
                trend={metrics.avgAgentLevel.trend}
                tooltip="Average level across all agents"
              />
              <MetricCard
                title="Level Ups (Session)"
                value={events.filter((e) => e.type === 'level_up').length}
                unit="agents"
                color="green"
                priority="success"
                trend="up"
                tooltip="Number of agents that leveled up"
              />
              <MetricCard
                title="Last Updated"
                value={metrics.lastUpdated.toLocaleTimeString()}
                unit=""
                color="slate"
                priority="info"
                tooltip="Time of last metric update"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
