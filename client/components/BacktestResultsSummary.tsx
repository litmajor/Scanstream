/**
 * Backtest Results Summary Component
 * 
 * Displays historical backtest performance metrics:
 * - Win rate and trade count (LONG vs SHORT)
 * - Profit/loss metrics (avg profit, total profit)
 * - Risk metrics (Sharpe ratio, max drawdown)
 * - Performance chart over time
 * 
 * Features:
 * - Direction-specific performance (LONG/SHORT breakdown)
 * - Visual performance indicators
 * - Detailed stats table
 * - Performance comparison chart
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';

interface BacktestStats {
  symbol: string;
  timeframe: string;
  totalTrades: number;
  winRate: string;
  avgProfit: string;
  totalProfit: string;
  sharpeRatio: string;
  maxDrawdown: string;
  byDirection: {
    long: {
      trades: number;
      wins: number;
      winRate: string;
      avgProfit?: string;
    };
    short: {
      trades: number;
      wins: number;
      winRate: string;
      avgProfit?: string;
    };
  };
}

interface BacktestResultsSummaryProps {
  symbol: string;
  timeframe?: string;
  onRefresh?: () => void;
}

/**
 * Format percentage values with color coding
 */
const PercentageCell: React.FC<{ value: string; isProfit?: boolean }> = ({ value, isProfit }) => {
  const numValue = parseFloat(value);
  const isPositive = numValue > 0;
  const color = isProfit
    ? isPositive
      ? '#10b981'
      : '#ef4444'
    : isPositive
    ? '#10b981'
    : '#ef4444';

  return (
    <span style={{ color }} className="font-medium">
      {isPositive ? '+' : ''}{value}
    </span>
  );
};

/**
 * Performance badge
 */
const PerformanceBadge: React.FC<{ label: string; value: string; threshold?: number; isHigherBetter?: boolean }> = ({
  label,
  value,
  threshold = 50,
  isHigherBetter = true,
}) => {
  const numValue = parseFloat(value.replace('%', ''));
  const isBad = isHigherBetter ? numValue < threshold : numValue > threshold;

  return (
    <div
      className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center ${
        isBad ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'
      }`}
    >
      <p className="text-xs text-gray-600 font-semibold uppercase mb-1">{label}</p>
      <p style={{ color: isBad ? '#ef4444' : '#10b981' }} className="text-2xl font-bold">
        {value}
      </p>
    </div>
  );
};

export const BacktestResultsSummary: React.FC<BacktestResultsSummaryProps> = ({
  symbol,
  timeframe = '1h',
  onRefresh,
}) => {
  const [selectedDirection, setSelectedDirection] = useState<'all' | 'long' | 'short'>('all');

  // Fetch backtest results
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backtest-results', symbol, timeframe],
    queryFn: () =>
      fetch(`/api/ml/mtf/backtest?symbol=${symbol}&timeframe=${timeframe}`)
        .then(r => {
          if (!r.ok) throw new Error('No backtest data');
          return r.json();
        })
        .catch(err => {
          console.error('Backtest fetch error:', err);
          return null;
        }),
    refetchInterval: 300000, // 5 minutes
    enabled: !!symbol && !!timeframe,
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || !data.stats) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <p className="text-yellow-700 font-semibold">No backtest data available</p>
        <p className="text-yellow-600 text-sm mt-1">
          Run a backtest for {symbol} {timeframe} to see results
        </p>
      </div>
    );
  }

  const stats = data.stats as BacktestStats;
  const overall = stats.byDirection;

  // Prepare performance data for charts
  const performanceData = [
    { name: 'Win Rate', Overall: parseFloat(stats.winRate), Long: parseFloat(overall.long.winRate), Short: parseFloat(overall.short.winRate) },
    { name: 'Avg Profit', Overall: parseFloat(stats.avgProfit), Long: parseFloat(overall.long.avgProfit || '0'), Short: parseFloat(overall.short.avgProfit || '0') },
  ];

  const tradeBreakdown = [
    { name: 'Long', trades: overall.long.trades, wins: overall.long.wins },
    { name: 'Short', trades: overall.short.trades, wins: overall.short.wins },
  ];

  const winRateValue = parseFloat(stats.winRate);
  const sharpeValue = parseFloat(stats.sharpeRatio);
  const drawdownValue = Math.abs(parseFloat(stats.maxDrawdown));

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Backtest Results</h3>
          <p className="text-sm text-gray-500 mt-1">
            {symbol} • {timeframe} • {stats.totalTrades} trades
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Key metrics cards */}
      <div className="grid grid-cols-4 gap-4">
        <PerformanceBadge label="Win Rate" value={stats.winRate} threshold={50} isHigherBetter={true} />
        <PerformanceBadge label="Avg Profit" value={stats.avgProfit} threshold={1} isHigherBetter={true} />
        <PerformanceBadge label="Sharpe Ratio" value={stats.sharpeRatio} threshold={1.0} isHigherBetter={true} />
        <PerformanceBadge label="Max Drawdown" value={stats.maxDrawdown} threshold={-3} isHigherBetter={false} />
      </div>

      {/* Direction breakdown */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Trade Breakdown (LONG vs SHORT)</h4>
        <div className="grid grid-cols-2 gap-4">
          {/* LONG trades */}
          <div className="p-4 rounded-lg bg-white border border-gray-200">
            <p className="text-sm font-semibold text-blue-700 mb-3">LONG Trades</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold text-gray-800">{overall.long.trades}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Wins:</span>
                <span className="font-semibold text-green-600">{overall.long.wins}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Win Rate:</span>
                <PercentageCell value={overall.long.winRate} />
              </div>
              {overall.long.avgProfit && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Profit:</span>
                  <PercentageCell value={overall.long.avgProfit} isProfit />
                </div>
              )}
            </div>
          </div>

          {/* SHORT trades */}
          <div className="p-4 rounded-lg bg-white border border-gray-200">
            <p className="text-sm font-semibold text-red-700 mb-3">SHORT Trades</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold text-gray-800">{overall.short.trades}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Wins:</span>
                <span className="font-semibold text-green-600">{overall.short.wins}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Win Rate:</span>
                <PercentageCell value={overall.short.winRate} />
              </div>
              {overall.short.avgProfit && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Profit:</span>
                  <PercentageCell value={overall.short.avgProfit} isProfit />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trade count visualization */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Trade Distribution</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tradeBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
            <Legend />
            <Bar dataKey="trades" fill="#3b82f6" name="Total Trades" />
            <Bar dataKey="wins" fill="#10b981" name="Winning Trades" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance comparison */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Performance Metrics</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
            <Legend />
            <Bar dataKey="Overall" fill="#3b82f6" name="Overall" />
            <Bar dataKey="Long" fill="#10b981" name="Long" />
            <Bar dataKey="Short" fill="#ef4444" name="Short" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Metric</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Value</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">Total Trades</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-800">{stats.totalTrades}</td>
              <td className="px-4 py-3 text-gray-600">Sample size for analysis</td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">Win Rate</td>
              <td className="px-4 py-3 text-right">
                <PercentageCell value={stats.winRate} />
              </td>
              <td className="px-4 py-3 text-gray-600">{winRateValue > 50 ? '✓ Profitable edge' : '⚠ Below 50%'}</td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">Avg Profit per Trade</td>
              <td className="px-4 py-3 text-right">
                <PercentageCell value={stats.avgProfit} isProfit />
              </td>
              <td className="px-4 py-3 text-gray-600">Average return per trade</td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">Total Profit</td>
              <td className="px-4 py-3 text-right">
                <PercentageCell value={stats.totalProfit} isProfit />
              </td>
              <td className="px-4 py-3 text-gray-600">Total backtest period return</td>
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">Sharpe Ratio</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-800">{stats.sharpeRatio}</td>
              <td className="px-4 py-3 text-gray-600">
                {sharpeValue > 1 ? '✓ Good risk-adjusted returns' : sharpeValue > 0.5 ? '⚠ Moderate returns' : '✗ Low returns'}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">Max Drawdown</td>
              <td className="px-4 py-3 text-right">
                <PercentageCell value={stats.maxDrawdown} />
              </td>
              <td className="px-4 py-3 text-gray-600">
                {drawdownValue < 5 ? '✓ Controlled risk' : drawdownValue < 10 ? '⚠ Moderate drawdown' : '✗ Large drawdown'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend/interpretation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-blue-900 mb-2">📊 How to interpret:</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• <strong>Win Rate:</strong> Percentage of trades that were profitable (target: greater than 50%)</li>
          <li>• <strong>Sharpe Ratio:</strong> Risk-adjusted returns (higher is better, greater than 1.0 is good)</li>
          <li>• <strong>Max Drawdown:</strong> Largest peak-to-trough decline (lower is better)</li>
          <li>• <strong>LONG vs SHORT:</strong> Performance breakdown by trade direction</li>
        </ul>
      </div>
    </div>
  );
};

export default BacktestResultsSummary;
