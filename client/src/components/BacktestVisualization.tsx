import React, { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  HeatmapChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Calendar, AlertCircle } from 'lucide-react';

interface Trade {
  id: string;
  entryTime: string;
  exitTime?: string;
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  side: 'BUY' | 'SELL';
}

interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

interface BacktestVisualizationProps {
  equityCurve: { timestamp: string; value: number }[];
  trades: Trade[];
  metrics: BacktestMetrics;
  monthlyReturns?: { month: string; return: number }[];
}

export default function BacktestVisualization({
  equityCurve,
  trades,
  metrics,
  monthlyReturns
}: BacktestVisualizationProps) {
  // Calculate equity curve stats
  const equityStats = useMemo(() => {
    if (!equityCurve || equityCurve.length === 0) return null;

    const values = equityCurve.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const current = values[values.length - 1];

    return { min, max, current };
  }, [equityCurve]);

  // Calculate drawdown curve
  const drawdownCurve = useMemo(() => {
    if (!equityCurve || equityCurve.length === 0) return [];

    let peak = equityCurve[0].value;
    return equityCurve.map(point => {
      if (point.value > peak) peak = point.value;
      const drawdown = ((point.value - peak) / peak) * 100;
      return {
        timestamp: point.timestamp,
        drawdown: Math.max(drawdown, 0),
        value: point.value
      };
    });
  }, [equityCurve]);

  // Calculate monthly returns heatmap data
  const monthlyHeatmapData = useMemo(() => {
    if (!monthlyReturns || monthlyReturns.length === 0) return [];
    
    return monthlyReturns.map(m => ({
      month: m.month,
      return: m.return,
      fill: m.return >= 0 ? '#10b981' : '#ef4444'
    }));
  }, [monthlyReturns]);

  // Prepare trade scatter data
  const tradeScatterData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    
    return trades.map((trade, idx) => ({
      x: idx,
      y: trade.pnlPercent,
      pnl: trade.pnl,
      type: trade.side,
      fill: trade.pnl >= 0 ? '#10b981' : '#ef4444'
    }));
  }, [trades]);

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  return (
    <div className="space-y-6 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Return */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Total Return</span>
            <TrendingUp className={`w-4 h-4 ${metrics.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </div>
          <p className={`text-2xl font-bold ${metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(metrics.totalReturn)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Annualized: {formatPercent(metrics.annualizedReturn)}
          </p>
        </div>

        {/* Sharpe Ratio */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Sharpe Ratio</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-400">{metrics.sharpeRatio.toFixed(2)}</p>
          <p className="text-xs text-slate-500 mt-1">
            Risk-adjusted return
          </p>
        </div>

        {/* Max Drawdown */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Max Drawdown</span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-400">{formatPercent(metrics.maxDrawdown)}</p>
          <p className="text-xs text-slate-500 mt-1">
            Peak-to-trough
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Win Rate</span>
            <AlertCircle className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-400">{formatPercent(metrics.winRate)}</p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.totalTrades} trades
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-800/30 border border-slate-700/30 rounded p-3">
          <p className="text-xs text-slate-500">Sortino Ratio</p>
          <p className="text-lg font-bold text-slate-200">{metrics.sortinoRatio.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded p-3">
          <p className="text-xs text-slate-500">Calmar Ratio</p>
          <p className="text-lg font-bold text-slate-200">{metrics.calmarRatio.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded p-3">
          <p className="text-xs text-slate-500">Profit Factor</p>
          <p className="text-lg font-bold text-slate-200">{metrics.profitFactor.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded p-3">
          <p className="text-xs text-slate-500">Avg Win/Loss</p>
          <p className="text-lg font-bold text-slate-200">
            {(metrics.avgWin / Math.abs(metrics.avgLoss)).toFixed(2)}x
          </p>
        </div>
      </div>

      {/* Equity Curve Chart */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
          <TrendingUp className="w-4 h-4 mr-2 text-blue-400" />
          Equity Curve
        </h3>
        {equityCurve && equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={equityCurve}>
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorEquity)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-80 flex items-center justify-center text-slate-500">
            No equity curve data available
          </div>
        )}
        {equityStats && (
          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div>
              <p className="text-slate-500">Starting</p>
              <p className="font-bold text-slate-200">{formatCurrency(equityStats.min)}</p>
            </div>
            <div>
              <p className="text-slate-500">Peak</p>
              <p className="font-bold text-slate-200">{formatCurrency(equityStats.max)}</p>
            </div>
            <div>
              <p className="text-slate-500">Final</p>
              <p className="font-bold text-green-400">{formatCurrency(equityStats.current)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Drawdown Chart */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
          <TrendingDown className="w-4 h-4 mr-2 text-red-400" />
          Drawdown Over Time
        </h3>
        {drawdownCurve && drawdownCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={drawdownCurve}>
              <defs>
                <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: any) => `${value.toFixed(2)}%`}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorDrawdown)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            No drawdown data available
          </div>
        )}
      </div>

      {/* Monthly Returns Heatmap */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-purple-400" />
          Monthly Returns
        </h3>
        {monthlyHeatmapData && monthlyHeatmapData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={monthlyHeatmapData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis dataKey="month" type="category" stroke="#94a3b8" style={{ fontSize: '12px' }} width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: any) => `${value.toFixed(2)}%`}
              />
              <Bar dataKey="return" fill="#3b82f6" radius={[0, 8, 8, 0]}>
                {monthlyHeatmapData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500">
            No monthly returns data available
          </div>
        )}
      </div>

      {/* Trade Distribution */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center">
          <Activity className="w-4 h-4 mr-2 text-green-400" />
          Trade P&L Distribution
        </h3>
        {tradeScatterData && tradeScatterData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="x"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                label={{ value: 'Trade #', position: 'insideBottomRight', offset: -10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                stroke="#94a3b8"
                style={{ fontSize: '12px' }}
                label={{ value: 'P&L %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#e2e8f0' }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                formatter={(value: any) => `${value.toFixed(2)}%`}
              />
              <Scatter name="Wins" data={tradeScatterData.filter(t => t.pnl >= 0)} fill="#10b981" />
              <Scatter name="Losses" data={tradeScatterData.filter(t => t.pnl < 0)} fill="#ef4444" />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            No trade data available
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Winning Trades</p>
            <p className="font-bold text-green-400">
              {tradeScatterData.filter(t => t.pnl >= 0).length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Losing Trades</p>
            <p className="font-bold text-red-400">
              {tradeScatterData.filter(t => t.pnl < 0).length}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Avg Win</p>
            <p className="font-bold text-blue-400">
              {formatPercent(metrics.avgWin)}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Table */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Detailed Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatItem label="Total Return" value={formatPercent(metrics.totalReturn)} />
          <StatItem label="Annualized Return" value={formatPercent(metrics.annualizedReturn)} />
          <StatItem label="Max Drawdown" value={formatPercent(metrics.maxDrawdown)} />
          <StatItem label="Sharpe Ratio" value={metrics.sharpeRatio.toFixed(2)} />
          <StatItem label="Sortino Ratio" value={metrics.sortinoRatio.toFixed(2)} />
          <StatItem label="Calmar Ratio" value={metrics.calmarRatio.toFixed(2)} />
          <StatItem label="Win Rate" value={formatPercent(metrics.winRate)} />
          <StatItem label="Profit Factor" value={metrics.profitFactor.toFixed(2)} />
          <StatItem label="Total Trades" value={metrics.totalTrades.toString()} />
          <StatItem label="Avg Win" value={formatPercent(metrics.avgWin)} />
          <StatItem label="Avg Loss" value={formatPercent(metrics.avgLoss)} />
          <StatItem label="Win/Loss Ratio" value={(metrics.avgWin / Math.abs(metrics.avgLoss)).toFixed(2)} />
        </div>
      </div>
    </div>
  );
}

// Helper component for statistics
function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}
