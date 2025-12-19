/**
 * Automated Trading Dashboard
 * 
 * Real-time monitoring and control panel for ML-based automated trading.
 * Displays active trades, P&L, risk metrics, and allows manual intervention.
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ActiveTrade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  recommendation: 'CONFIRM' | 'CAUTION';
  executedAt: string;
  currentPrice?: number;
  unrealizedPL?: number;
  unrealizedPLPercent?: number;
}

interface TradeStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageProfitUSD: number;
  averageLossUSD: number;
  profitFactor: number;
  totalProfitLoss: number;
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageDurationMinutes: number;
}

interface RiskMetrics {
  activeTrades: number;
  totalOpenPositionSize: number;
  dailyProfitLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
  utilizationPercent: number;
}

const AutomatedTradingDashboard: React.FC<{
  refreshInterval?: number;
}> = ({ refreshInterval = 30000 }) => {
  const queryClient = useQueryClient();
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);

  // Fetch active trades
  const { data: activeTrades = [] } = useQuery<ActiveTrade[]>({
    queryKey: ['active-trades'],
    queryFn: async () => {
      const res = await fetch('/api/ml/trades/active');
      const data = await res.json();
      return data.trades || [];
    },
    refetchInterval: refreshInterval,
  });

  // Fetch trade statistics
  const { data: stats } = useQuery<TradeStatistics>({
    queryKey: ['trade-stats'],
    queryFn: async () => {
      const res = await fetch('/api/ml/trades/statistics');
      const data = await res.json();
      return data.stats;
    },
    refetchInterval: refreshInterval,
  });

  // Calculate risk metrics
  const riskMetrics: RiskMetrics = {
    activeTrades: activeTrades.length,
    totalOpenPositionSize: activeTrades.reduce((sum, t) => sum + t.positionSize, 0),
    dailyProfitLoss: activeTrades.reduce((sum, t) => sum + (t.unrealizedPL || 0), 0),
    maxPositionSize: 10000,
    maxOpenPositions: 5,
    utilizationPercent:
      ((activeTrades.reduce((sum, t) => sum + t.positionSize, 0) / 10000) * 100) | 0,
  };

  // Handle trade close
  const handleCloseTrade = async (tradeId: string) => {
    if (!closePrice || isNaN(Number(closePrice))) {
      alert('Please enter a valid exit price');
      return;
    }

    setIsClosing(true);
    try {
      const res = await fetch(`/api/ml/trades/${tradeId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exitPrice: Number(closePrice),
          reason: 'MANUAL_CLOSE',
        }),
      });

      if (res.ok) {
        alert('Trade closed successfully');
        setClosePrice('');
        setSelectedTrade(null);
        queryClient.invalidateQueries({ queryKey: ['active-trades'] });
      } else {
        alert('Failed to close trade');
      }
    } catch (error) {
      alert('Error closing trade');
    } finally {
      setIsClosing(false);
    }
  };

  // Handle auto-close
  const handleAutoClose = async () => {
    try {
      const res = await fetch('/api/ml/trades/auto-close', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Auto-closed ${data.closedCount} trades. P&L: $${data.totalProfitLoss.toFixed(2)}`);
        queryClient.invalidateQueries({ queryKey: ['active-trades'] });
      }
    } catch (error) {
      alert('Error triggering auto-close');
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">🤖 Automated Trading Dashboard</h1>
        <button
          onClick={handleAutoClose}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          🔄 Auto-Close Trades
        </button>
      </div>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Active Trades</p>
          <p className="text-3xl font-bold text-blue-600">{riskMetrics.activeTrades}</p>
          <p className="text-xs text-gray-500 mt-1">
            Max: {riskMetrics.maxOpenPositions}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Position Size</p>
          <p className="text-3xl font-bold text-purple-600">
            ${(riskMetrics.totalOpenPositionSize / 1000).toFixed(1)}K
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(riskMetrics.utilizationPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {riskMetrics.utilizationPercent}% of max
          </p>
        </div>

        <div
          className={`bg-white rounded-lg border border-gray-200 p-4 ${
            riskMetrics.dailyProfitLoss >= 0 ? 'border-green-300' : 'border-red-300'
          }`}
        >
          <p className="text-sm text-gray-600">Unrealized P&L</p>
          <p
            className={`text-3xl font-bold ${
              riskMetrics.dailyProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ${riskMetrics.dailyProfitLoss.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {((riskMetrics.dailyProfitLoss / riskMetrics.totalOpenPositionSize) * 100).toFixed(2)}%
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Win Rate</p>
          <p className="text-3xl font-bold text-indigo-600">
            {stats ? `${(stats.winRate * 100).toFixed(0)}%` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats ? `${stats.winningTrades}W / ${stats.losingTrades}L` : 'No trades'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Trades Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">📊 Active Trades</h2>
          </div>

          {activeTrades.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No active trades
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Symbol</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Dir</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Entry</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Current</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">P&L</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Conf</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTrades.map(trade => (
                    <tr
                      key={trade.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedTrade(selectedTrade === trade.id ? null : trade.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            trade.direction === 'LONG'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        ${trade.entryPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        ${trade.currentPrice?.toFixed(2) || 'N/A'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          (trade.unrealizedPL || 0) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        ${trade.unrealizedPL?.toFixed(2) || '0.00'} (
                        {(trade.unrealizedPLPercent || 0).toFixed(2)}%)
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            trade.confidence > 0.8
                              ? 'bg-blue-100 text-blue-700'
                              : trade.confidence > 0.6
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {(trade.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedTrade(trade.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Close Trade Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🚪 Close Trade</h3>

          {selectedTrade ? (
            <>
              {activeTrades.find(t => t.id === selectedTrade) && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Selected Trade</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {activeTrades.find(t => t.id === selectedTrade)?.symbol}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Entry Price</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${activeTrades.find(t => t.id === selectedTrade)?.entryPrice.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Exit Price
                    </label>
                    <input
                      type="number"
                      value={closePrice}
                      onChange={e => setClosePrice(e.target.value)}
                      placeholder="Enter exit price"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      step="0.01"
                    />
                  </div>

                  <button
                    onClick={() =>
                      handleCloseTrade(selectedTrade)
                    }
                    disabled={isClosing}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-gray-400"
                  >
                    {isClosing ? 'Closing...' : 'Close Trade'}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedTrade(null);
                      setClosePrice('');
                    }}
                    className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500">Select a trade from the table to close it</p>
          )}
        </div>
      </div>

      {/* Statistics Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Win Rate Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Trade Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Wins', value: stats.winningTrades },
                    { name: 'Losses', value: stats.losingTrades },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Key Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total P&L</span>
                <span
                  className={`font-semibold ${
                    stats.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  ${stats.totalProfitLoss.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Win</span>
                <span className="font-semibold text-green-600">
                  ${stats.averageProfitUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Loss</span>
                <span className="font-semibold text-red-600">
                  -${stats.averageLossUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-gray-600">Profit Factor</span>
                <span
                  className={`font-semibold ${
                    stats.profitFactor > 1.5
                      ? 'text-green-600'
                      : stats.profitFactor > 1.0
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {stats.profitFactor.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Largest Win</span>
                <span className="font-semibold text-green-600">
                  ${stats.largestWin.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Largest Loss</span>
                <span className="font-semibold text-red-600">
                  -${Math.abs(stats.largestLoss).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedTradingDashboard;
