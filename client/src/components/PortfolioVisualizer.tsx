
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, BarChart3, PieChart as PieChartIcon, Calendar, Clock, Activity } from 'lucide-react';

export type PortfolioData = {
  equityCurve: Array<{ date: Date; value: number }>;
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    totalTrades: number;
    maxDrawdown: number;
    averageDrawdown: number;
    maxDrawdownDuration: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    volatility: number;
    kelly: number;
    var95: number;
    cvar95: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    largestWin: number;
    largestLoss: number;
    avgTradeDuration: number;
    monthlyReturns: Record<string, number>;
    yearlyReturns: Record<string, number>;
  };
  trades: Array<{
    id: string;
    symbol: string;
    side: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    duration: number;
    returnPct: number;
  }>;
  drawdownPeriods: Array<{
    startDate: Date;
    endDate: Date | null;
    maxDrawdown: number;
    duration: number;
  }>;
  monteCarloResults: {
    percentiles: Record<string | number, number>;
    probabilityOfProfit: number;
    worstCase: number;
    bestCase: number;
  };
};

const PortfolioVisualizer: React.FC<{ data: PortfolioData }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number): string => `${(value * 100).toFixed(2)}%`;

  // Prepare enhanced chart data
  const equityChartData = data.equityCurve.map((point, index) => ({
    date: point.date.toISOString().split('T')[0],
    equity: point.value,
    drawdown: index > 0 ? ((Math.max(...data.equityCurve.slice(0, index + 1).map(p => p.value)) - point.value) / Math.max(...data.equityCurve.slice(0, index + 1).map(p => p.value)) * 100) : 0,
  }));

  // Win rate over time (calculate rolling win rate)
  const winRateOverTime = data.trades && data.trades.length > 0 ? data.trades.map((_, index) => {
    const window = 20; // 20-trade rolling window
    const start = Math.max(0, index - window);
    const windowTrades = data.trades.slice(start, index + 1);
    const wins = windowTrades.filter(t => t.pnl > 0).length;
    const winRate = windowTrades.length > 0 ? (wins / windowTrades.length) * 100 : 0;
    return {
      trade: index + 1,
      winRate,
      cumulativeWinRate: ((data.trades.slice(0, index + 1).filter(t => t.pnl > 0).length / (index + 1)) * 100)
    };
  }) : [];

  // Signal quality over time (based on return %)
  const signalQuality = data.trades && data.trades.length > 0 ? data.trades.map((trade, index) => ({
    trade: index + 1,
    quality: Math.abs(trade.returnPct) > 5 ? 'Excellent' : Math.abs(trade.returnPct) > 2 ? 'Good' : 'Fair',
    returnPct: trade.returnPct,
    avgReturn: data.trades.slice(0, index + 1).reduce((sum, t) => sum + t.returnPct, 0) / (index + 1)
  })) : [];

  const monthlyReturnsData = Object.entries(data.metrics.monthlyReturns).map(([month, return_]) => ({
    month,
    return: return_ * 100,
    positive: return_ >= 0
  }));

  // Trade distribution for enhanced pie chart
  const tradeDistribution = data.trades && data.trades.length > 0 ? [
    { 
      range: 'Large Loss (< -5%)', 
      count: data.trades.filter(t => t.returnPct < -5).length, 
      value: data.trades.filter(t => t.returnPct < -5).reduce((sum, t) => sum + Math.abs(t.pnl), 0),
      color: '#ef4444' 
    },
    { 
      range: 'Small Loss (-5% to 0%)', 
      count: data.trades.filter(t => t.returnPct >= -5 && t.returnPct < 0).length, 
      value: data.trades.filter(t => t.returnPct >= -5 && t.returnPct < 0).reduce((sum, t) => sum + Math.abs(t.pnl), 0),
      color: '#f97316' 
    },
    { 
      range: 'Small Win (0% to 5%)', 
      count: data.trades.filter(t => t.returnPct >= 0 && t.returnPct < 5).length, 
      value: data.trades.filter(t => t.returnPct >= 0 && t.returnPct < 5).reduce((sum, t) => sum + t.pnl, 0),
      color: '#84cc16' 
    },
    { 
      range: 'Large Win (> 5%)', 
      count: data.trades.filter(t => t.returnPct >= 5).length, 
      value: data.trades.filter(t => t.returnPct >= 5).reduce((sum, t) => sum + t.pnl, 0),
      color: '#22c55e' 
    },
  ].filter(item => item.count > 0) : [];

  type SymbolPerf = { symbol: string; totalPnl: number; trades: number; winRate: number };
  const symbolPerformanceData: Record<string, SymbolPerf> = data.trades.reduce((acc: Record<string, SymbolPerf>, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { symbol: trade.symbol, totalPnl: 0, trades: 0, winRate: 0 };
    }
    acc[trade.symbol].totalPnl += trade.pnl;
    acc[trade.symbol].trades += 1;
    return acc;
  }, {});

  Object.values(symbolPerformanceData).forEach((item: SymbolPerf) => {
    const symbolTrades = data.trades.filter(t => t.symbol === item.symbol);
    item.winRate = symbolTrades.filter(t => t.pnl > 0).length / symbolTrades.length * 100;
  });

  const monteCarloData = Object.entries(data.monteCarloResults.percentiles).map(([percentile, value]) => ({
    percentile: `${percentile}%`,
    value,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              <span className="font-semibold">{entry.name}:</span> {
                entry.name.includes('$') || entry.name.includes('Price') || entry.name.includes('Value')
                  ? formatCurrency(entry.value)
                  : entry.name.includes('%') || entry.name.includes('Rate')
                  ? `${entry.value.toFixed(2)}%`
                  : entry.value.toLocaleString()
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    color?: 'blue' | 'green' | 'red' | 'purple' | 'yellow';
    trend?: number | null;
  }> = ({ title, value, subtitle, icon: Icon, color = 'blue', trend = null }) => {
    const colorClasses = {
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
      green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
      red: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
      purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
      yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400'
    };

    return (
      <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm border rounded-xl p-5 transition-all hover:scale-105 hover:shadow-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs text-slate-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-white mb-1">{value}</p>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend !== null && (
          <div className="mt-3 flex items-center">
            {trend > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
            )}
            <span className={`text-xs font-medium ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {Math.abs(trend).toFixed(1)}% vs last period
            </span>
          </div>
        )}
      </div>
    );
  };

  const TabButton: React.FC<{ id: string; label: string; isActive: boolean }> = ({ id, label, isActive }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all ${
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
          Portfolio Analytics Dashboard
        </h1>
        <p className="text-slate-400 text-lg">Comprehensive performance analysis and risk metrics</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-3 bg-slate-800/30 border border-slate-700/50 p-3 rounded-xl backdrop-blur-sm">
        <TabButton id="overview" label="Overview" isActive={activeTab === 'overview'} />
        <TabButton id="performance" label="Performance" isActive={activeTab === 'performance'} />
        <TabButton id="risk" label="Risk Analysis" isActive={activeTab === 'risk'} />
        <TabButton id="trades" label="Trade Analysis" isActive={activeTab === 'trades'} />
        <TabButton id="quality" label="Signal Quality" isActive={activeTab === 'quality'} />
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Return"
              value={formatPercent(data.metrics.totalReturn)}
              subtitle="Since inception"
              icon={TrendingUp}
              color="green"
              trend={12.5}
            />
            <MetricCard
              title="Current Balance"
              value={formatCurrency(data.equityCurve[data.equityCurve.length - 1]?.value || 0)}
              subtitle="Portfolio value"
              icon={DollarSign}
              color="blue"
            />
            <MetricCard
              title="Win Rate"
              value={formatPercent(data.metrics.winRate)}
              subtitle={`${data.metrics.totalTrades} trades`}
              icon={Target}
              color="purple"
            />
            <MetricCard
              title="Sharpe Ratio"
              value={data.metrics.sharpeRatio.toFixed(2)}
              subtitle="Risk-adjusted return"
              icon={Activity}
              color="yellow"
            />
          </div>

          {/* Separated Equity and Drawdown Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Equity Curve */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                Equity Curve
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equityChartData}>
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fill="url(#equityGradient)"
                    name="Portfolio Value"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Drawdown Chart */}
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
                Drawdown Analysis
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={equityChartData}>
                  <defs>
                    <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="drawdown" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    fill="url(#drawdownGradient)"
                    name="Drawdown %"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-xs text-red-400 mb-1">Max Drawdown</p>
                  <p className="text-lg font-bold text-red-400">{formatPercent(data.metrics.maxDrawdown)}</p>
                </div>
                <div className="text-center p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <p className="text-xs text-orange-400 mb-1">Avg Drawdown</p>
                  <p className="text-lg font-bold text-orange-400">{formatPercent(data.metrics.averageDrawdown)}</p>
                </div>
                <div className="text-center p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <p className="text-xs text-yellow-400 mb-1">Max Duration</p>
                  <p className="text-lg font-bold text-yellow-400">{data.metrics.maxDrawdownDuration}d</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-blue-400" />
                Performance Metrics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Annualized Return</span>
                  <span className="font-bold text-green-400">{formatPercent(data.metrics.annualizedReturn)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Profit Factor</span>
                  <span className="font-bold text-white">{data.metrics.profitFactor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Volatility</span>
                  <span className="font-bold text-yellow-400">{formatPercent(data.metrics.volatility)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Sortino Ratio</span>
                  <span className="font-bold text-white">{data.metrics.sortinoRatio.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-400" />
                Trade Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Average Win</span>
                  <span className="font-bold text-green-400">{formatCurrency(data.metrics.avgWin)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Average Loss</span>
                  <span className="font-bold text-red-400">{formatCurrency(data.metrics.avgLoss)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Largest Win</span>
                  <span className="font-bold text-green-400">{formatCurrency(data.metrics.largestWin)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Largest Loss</span>
                  <span className="font-bold text-red-400">{formatCurrency(data.metrics.largestLoss)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-purple-400" />
                Streak Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Best Win Streak</span>
                  <span className="font-bold text-green-400">{data.metrics.consecutiveWins}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Worst Loss Streak</span>
                  <span className="font-bold text-red-400">{data.metrics.consecutiveLosses}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Avg Trade Duration</span>
                  <span className="font-bold text-white">{data.metrics.avgTradeDuration.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-slate-900/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Calmar Ratio</span>
                  <span className="font-bold text-white">{data.metrics.calmarRatio.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Monthly Returns */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-400" />
              Monthly Returns Distribution
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyReturnsData}>
                <defs>
                  <linearGradient id="positiveBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="negativeBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="return" 
                  fill="url(#positiveBar)"
                  name="Monthly Return %"
                  radius={[8, 8, 0, 0]}
                >
                  {monthlyReturnsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.positive ? 'url(#positiveBar)' : 'url(#negativeBar)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Win Rate Over Time */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-400" />
              Win Rate Evolution
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={winRateOverTime}>
                <defs>
                  <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="trade" stroke="#94a3b8" style={{ fontSize: '12px' }} label={{ value: 'Trade Number', position: 'insideBottom', offset: -5 }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="winRate" 
                  fill="url(#winRateGradient)" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  name="Rolling Win Rate (20 trades)"
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulativeWinRate" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  name="Cumulative Win Rate"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Symbol Performance Table */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-purple-400" />
              Performance by Symbol
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Symbol</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Total P&L</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Trades</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Win Rate</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(symbolPerformanceData)
                    .sort((a, b) => b.totalPnl - a.totalPnl)
                    .map((item: SymbolPerf, index: number) => (
                    <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{item.symbol}</td>
                      <td className={`py-3 px-4 text-right font-bold ${item.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(item.totalPnl)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{item.trades}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          item.winRate >= 70 ? 'bg-green-500/20 text-green-400' :
                          item.winRate >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {item.winRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-slate-700/50 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${item.totalPnl >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, Math.abs(item.totalPnl) / 1000 * 10)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Risk Tab */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Sharpe Ratio"
              value={data.metrics.sharpeRatio.toFixed(2)}
              subtitle="Risk-adjusted return"
              icon={BarChart3}
              color="blue"
            />
            <MetricCard
              title="Sortino Ratio"
              value={data.metrics.sortinoRatio.toFixed(2)}
              subtitle="Downside risk"
              icon={TrendingDown}
              color="green"
            />
            <MetricCard
              title="VaR (95%)"
              value={formatPercent(Math.abs(data.metrics.var95))}
              subtitle="Value at Risk"
              icon={AlertTriangle}
              color="red"
            />
            <MetricCard
              title="Kelly %"
              value={formatPercent(data.metrics.kelly)}
              subtitle="Optimal position"
              icon={Target}
              color="purple"
            />
          </div>

          {/* Drawdown Periods Table */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />
              Drawdown Periods Analysis
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Start Date</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">End Date</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Max Drawdown</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Duration</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.drawdownPeriods.map((period, index) => (
                    <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                      <td className="py-3 px-4 text-slate-300">{period.startDate.toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-300">{period.endDate ? period.endDate.toLocaleDateString() : 'Ongoing'}</td>
                      <td className="py-3 px-4 text-right font-bold text-red-400">
                        {formatPercent(period.maxDrawdown)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{period.duration} days</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                          Math.abs(period.maxDrawdown) > 0.15 ? 'bg-red-500/20 text-red-400' :
                          Math.abs(period.maxDrawdown) > 0.10 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {Math.abs(period.maxDrawdown) > 0.15 ? 'Severe' : Math.abs(period.maxDrawdown) > 0.10 ? 'Moderate' : 'Mild'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Metrics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Drawdown Metrics</h3>
              <div className="space-y-3">
                {[
                  { label: 'Max Drawdown', value: formatPercent(data.metrics.maxDrawdown), color: 'text-red-400' },
                  { label: 'Average Drawdown', value: formatPercent(data.metrics.averageDrawdown), color: 'text-orange-400' },
                  { label: 'Max DD Duration', value: `${data.metrics.maxDrawdownDuration} days`, color: 'text-yellow-400' },
                  { label: 'Volatility', value: formatPercent(data.metrics.volatility), color: 'text-blue-400' },
                ].map((metric, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg">
                    <span className="text-slate-400">{metric.label}</span>
                    <span className={`font-bold ${metric.color}`}>{metric.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">Position Sizing</h3>
              <div className="space-y-3">
                {[
                  { label: 'Kelly Criterion', value: formatPercent(data.metrics.kelly), color: 'text-purple-400' },
                  { label: 'Half Kelly (Recommended)', value: formatPercent(data.metrics.kelly * 0.5), color: 'text-green-400' },
                  { label: 'Quarter Kelly (Conservative)', value: formatPercent(data.metrics.kelly * 0.25), color: 'text-blue-400' },
                  { label: 'CVaR (95%)', value: formatPercent(Math.abs(data.metrics.cvar95)), color: 'text-red-400' },
                ].map((metric, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/30 rounded-lg">
                    <span className="text-slate-400">{metric.label}</span>
                    <span className={`font-bold ${metric.color}`}>{metric.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-300">
                  <strong>Note:</strong> Use 25-50% of Kelly for safety margin
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trades Tab */}
      {activeTab === 'trades' && (
        <div className="space-y-6">
          {/* Enhanced Trade Distribution Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <PieChartIcon className="w-5 h-5 mr-2 text-blue-400" />
                Trade Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tradeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name.split('(')[0]}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {tradeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-4">Trade Statistics Breakdown</h3>
              <div className="space-y-3">
                {tradeDistribution.map((item, index) => (
                  <div key={index} className="p-3 bg-slate-900/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-slate-300 font-medium">{item.range}</span>
                      </div>
                      <span className="text-white font-bold">{item.count} trades</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Impact</span>
                      <span className={`font-semibold ${item.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Trades Table */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">Recent Trades</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Symbol</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-semibold">Side</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Entry</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Exit</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Qty</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">P&L</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Return %</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.trades || []).slice(-20).reverse().map((trade, index) => (
                    <tr key={index} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">${trade.entryPrice.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-300">${trade.exitPrice.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{trade.quantity.toFixed(4)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(trade.pnl)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        trade.returnPct >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {trade.returnPct >= 0 ? '+' : ''}{trade.returnPct.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{trade.duration.toFixed(1)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Signal Quality Tab */}
      {activeTab === 'quality' && (
        <div className="space-y-6">
          {/* Signal Quality Over Time */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-purple-400" />
              Signal Quality Evolution
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={signalQuality}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="trade" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="returnPct" 
                  fill="#3b82f6" 
                  stroke="#3b82f6" 
                  fillOpacity={0.2}
                  name="Return %"
                />
                <Line 
                  type="monotone" 
                  dataKey="avgReturn" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={false}
                  name="Average Return"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Monte Carlo Simulation Results */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-400" />
              Monte Carlo Simulation
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monteCarloData}>
                <defs>
                  <linearGradient id="monteCarloGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="percentile" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fill="url(#monteCarloGradient)" 
                  name="Portfolio Value"
                />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-xs text-green-400 mb-2">Profit Probability</p>
                <p className="text-2xl font-bold text-green-400">
                  {(data.monteCarloResults.probabilityOfProfit * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-xs text-red-400 mb-2">Worst Case (5%)</p>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(data.monteCarloResults.worstCase)}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-xs text-blue-400 mb-2">Median (50%)</p>
                <p className="text-xl font-bold text-blue-400">
                  {formatCurrency(data.monteCarloResults.percentiles[50])}
                </p>
              </div>
              <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-xs text-green-400 mb-2">Best Case (95%)</p>
                <p className="text-xl font-bold text-green-400">
                  {formatCurrency(data.monteCarloResults.bestCase)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioVisualizer;
