/**
 * PHASE 5: SIGNAL HISTORY & ACCURACY TABLE
 * 
 * Shows all historical signals with entry/exit prices, P&L, quality scores
 * Filters by source, strategy, quality level
 * Displays: Signal accuracy correlation with confidence levels
 * Updates via WebSocket with new trades
 */

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ChevronDown, Filter, TrendingUp, TrendingDown } from 'lucide-react';

export interface SignalHistoryEntry {
  id: string;
  timestamp: string;
  symbol: string;
  signalSource: 'SCANNER' | 'ML' | 'RL' | 'RPG';
  strategy?: string;
  entryPrice: number;
  exitPrice?: number;
  profitLoss?: number;
  profitLossPercent?: number;
  quality: number;                 // 0-100, signal quality score
  confidence: number;              // 0-100, confidence level
  status: 'open' | 'closed' | 'cancelled';
  actualOutcome?: 'WIN' | 'LOSS' | 'BREAK_EVEN';
  outcomeAccuracy?: boolean;       // Did quality score predict outcome?
  duration?: number;               // Minutes open
  reason?: string;                 // Why signal was generated
}

export interface SignalHistoryProps {
  signals: SignalHistoryEntry[];
  onSourceFilterChange?: (source: string | null) => void;
}

const SignalHistory: React.FC<SignalHistoryProps> = ({ signals, onSourceFilterChange }) => {
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterQualityMin, setFilterQualityMin] = useState(0);
  const [sortBy, setSortBy] = useState<'recent' | 'quality' | 'pnl'>('recent');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Handle filter changes
  const handleSourceFilter = (source: string | null) => {
    setFilterSource(source);
    onSourceFilterChange?.(source);
  };

  // Filter and sort signals
  const filteredSignals = useMemo(() => {
    let filtered = [...signals];

    if (filterSource) {
      filtered = filtered.filter((s) => s.signalSource === filterSource);
    }

    if (filterStatus) {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    filtered = filtered.filter((s) => s.quality >= filterQualityMin);

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'quality':
          return b.quality - a.quality;
        case 'pnl':
          return (b.profitLoss || 0) - (a.profitLoss || 0);
        case 'recent':
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });

    return filtered;
  }, [signals, filterSource, filterStatus, filterQualityMin, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const closedSignals = filteredSignals.filter((s) => s.status === 'closed' && s.actualOutcome);

    if (closedSignals.length === 0) {
      return {
        winRate: 0,
        avgPnL: 0,
        accuracyRate: 0,
        totalSignals: filteredSignals.length
      };
    }

    const wins = closedSignals.filter((s) => s.actualOutcome === 'WIN').length;
    const totalPnL = closedSignals.reduce((sum, s) => sum + (s.profitLoss || 0), 0);
    const correctPredictions = closedSignals.filter((s) => s.outcomeAccuracy).length;

    return {
      winRate: (wins / closedSignals.length) * 100,
      avgPnL: totalPnL / closedSignals.length,
      accuracyRate: (correctPredictions / closedSignals.length) * 100,
      totalSignals: filteredSignals.length
    };
  }, [filteredSignals]);

  // Chart data: accuracy by quality score
  const qualityAccuracyData = useMemo(() => {
    const buckets: { [key: number]: { total: number; correct: number } } = {};

    filteredSignals
      .filter((s) => s.status === 'closed' && s.outcomeAccuracy !== undefined)
      .forEach((s) => {
        const bucket = Math.floor(s.quality / 10) * 10;
        if (!buckets[bucket]) {
          buckets[bucket] = { total: 0, correct: 0 };
        }
        buckets[bucket].total += 1;
        if (s.outcomeAccuracy) {
          buckets[bucket].correct += 1;
        }
      });

    return Object.entries(buckets)
      .map(([quality, data]) => ({
        quality: `${quality}-${parseInt(quality) + 9}%`,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        count: data.total
      }))
      .sort((a, b) => parseInt(a.quality) - parseInt(b.quality));
  }, [filteredSignals]);

  // Chart data: P&L by confidence
  const confidencePnLData = useMemo(() => {
    const buckets: { [key: number]: { total: number; pnl: number } } = {};

    filteredSignals
      .filter((s) => s.status === 'closed' && s.profitLoss !== undefined)
      .forEach((s) => {
        const bucket = Math.floor(s.confidence / 10) * 10;
        if (!buckets[bucket]) {
          buckets[bucket] = { total: 0, pnl: 0 };
        }
        buckets[bucket].total += 1;
        buckets[bucket].pnl += s.profitLoss || 0;
      });

    return Object.entries(buckets)
      .map(([confidence, data]) => ({
        confidence: `${confidence}-${parseInt(confidence) + 9}%`,
        avgPnL: data.total > 0 ? data.pnl / data.total : 0,
        count: data.total
      }))
      .sort((a, b) => parseInt(a.confidence) - parseInt(b.confidence));
  }, [filteredSignals]);

  // Source distribution pie data
  const sourceDistribution = useMemo(() => {
    const counts: { [key: string]: number } = {};
    filteredSignals.forEach((s) => {
      counts[s.signalSource] = (counts[s.signalSource] || 0) + 1;
    });
    return Object.entries(counts).map(([source, count]) => ({
      name: source,
      value: count
    }));
  }, [filteredSignals]);

  const COLORS = {
    SCANNER: '#3b82f6',
    ML: '#8b5cf6',
    RL: '#ec4899',
    RPG: '#f59e0b'
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'bg-green-100 text-green-800';
    if (quality >= 65) return 'bg-yellow-100 text-yellow-800';
    if (quality >= 50) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getPnLColor = (pnl?: number) => {
    if (!pnl) return 'text-gray-600';
    return pnl > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  };

  const getSourceBg = (source: string) => {
    const bgMap: { [key: string]: string } = {
      SCANNER: 'bg-blue-100 text-blue-800',
      ML: 'bg-purple-100 text-purple-800',
      RL: 'bg-pink-100 text-pink-800',
      RPG: 'bg-amber-100 text-amber-800'
    };
    return bgMap[source] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* HEADER */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-2">
          📊 Signal History & Accuracy
        </h2>
        <p className="text-sm text-gray-600">Complete trading signal history with P&L tracking and accuracy analysis</p>
      </div>

      {/* KEY STATISTICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-green-700 mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-green-600">{stats.winRate.toFixed(1)}%</p>
          <p className="text-xs text-green-600 mt-1">Closed signals</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <p className="text-xs text-blue-700 mb-1">Signal Quality Accuracy</p>
          <p className="text-2xl font-bold text-blue-600">{stats.accuracyRate.toFixed(1)}%</p>
          <p className="text-xs text-blue-600 mt-1">Predictions correct</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <p className="text-xs text-purple-700 mb-1">Avg P&L</p>
          <p className={`text-2xl font-bold ${stats.avgPnL > 0 ? 'text-green-600' : 'text-red-600'}`}>${stats.avgPnL.toFixed(2)}</p>
          <p className="text-xs text-purple-600 mt-1">Per signal</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
          <p className="text-xs text-amber-700 mb-1">Total Signals</p>
          <p className="text-2xl font-bold text-amber-600">{stats.totalSignals}</p>
          <p className="text-xs text-amber-600 mt-1">In filtered set</p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
        {/* Quality Accuracy */}
        <div className="bg-white rounded p-4 border border-gray-200">
          <p className="font-bold text-sm mb-3">Signal Quality vs Accuracy</p>
          {qualityAccuracyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={qualityAccuracyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quality" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="accuracy" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">No closed signals data</p>
          )}
        </div>

        {/* P&L by Confidence */}
        <div className="bg-white rounded p-4 border border-gray-200">
          <p className="font-bold text-sm mb-3">P&L by Confidence Level</p>
          {confidencePnLData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={confidencePnLData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="confidence" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="avgPnL"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">No P&L data</p>
          )}
        </div>

        {/* Source Distribution */}
        <div className="bg-white rounded p-4 border border-gray-200">
          <p className="font-bold text-sm mb-3">Signals by Source</p>
          {sourceDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sourceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} (${value})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sourceDistribution.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#ccc'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">No signals</p>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
        <p className="font-bold flex items-center gap-2">
          <Filter size={16} /> Filters & Sorting
        </p>

        {/* Filter Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Source Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Signal Source</label>
            <select
              value={filterSource || ''}
              onChange={(e) => handleSourceFilter(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Sources</option>
              <option value="SCANNER">Scanner</option>
              <option value="ML">Machine Learning</option>
              <option value="RL">Reinforcement Learning</option>
              <option value="RPG">RPG Agent</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Status</label>
            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Quality Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Min Quality</label>
            <select
              value={filterQualityMin}
              onChange={(e) => setFilterQualityMin(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={0}>All Qualities</option>
              <option value={50}>50%+</option>
              <option value={65}>65%+</option>
              <option value={80}>80%+</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="recent">Most Recent</option>
              <option value="quality">Quality Score</option>
              <option value="pnl">P&L Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* SIGNAL TABLE */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-gray-700">Time</th>
              <th className="px-4 py-3 text-left font-bold text-gray-700">Symbol</th>
              <th className="px-4 py-3 text-left font-bold text-gray-700">Source</th>
              <th className="px-4 py-3 text-right font-bold text-gray-700">Entry Price</th>
              <th className="px-4 py-3 text-right font-bold text-gray-700">Exit Price</th>
              <th className="px-4 py-3 text-right font-bold text-gray-700">P&L</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Quality</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Confidence</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Status</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredSignals.length > 0 ? (
              filteredSignals.map((signal) => (
                <React.Fragment key={signal.id}>
                  <tr className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(signal.timestamp).toLocaleDateString()} {new Date(signal.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">{signal.symbol}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSourceBg(signal.signalSource)}`}>
                        {signal.signalSource}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">${signal.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {signal.exitPrice ? `$${signal.exitPrice.toFixed(2)}` : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${getPnLColor(signal.profitLoss)}`}>
                      {signal.profitLoss !== undefined ? `${signal.profitLoss > 0 ? '+' : ''}${signal.profitLoss.toFixed(2)} (${signal.profitLossPercent?.toFixed(2) || 0}%)` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-lg font-bold text-sm ${getQualityColor(signal.quality)}`}>
                        {signal.quality.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-700 font-semibold">{signal.confidence.toFixed(0)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          signal.status === 'open'
                            ? 'bg-blue-100 text-blue-800'
                            : signal.status === 'closed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {signal.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedRow(expandedRow === signal.id ? null : signal.id)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        {expandedRow === signal.id ? '▼' : '▶'}
                      </button>
                    </td>
                  </tr>

                  {/* EXPANDED DETAILS ROW */}
                  {expandedRow === signal.id && (
                    <tr className="bg-blue-50 border-b border-gray-200">
                      <td colSpan={10} className="px-4 py-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {signal.strategy && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Strategy</p>
                              <p className="font-bold">{signal.strategy}</p>
                            </div>
                          )}
                          {signal.duration && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Duration</p>
                              <p className="font-bold">{signal.duration} min</p>
                            </div>
                          )}
                          {signal.actualOutcome && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Actual Outcome</p>
                              <p className={`font-bold ${signal.actualOutcome === 'WIN' ? 'text-green-600' : signal.actualOutcome === 'LOSS' ? 'text-red-600' : 'text-gray-600'}`}>
                                {signal.actualOutcome}
                              </p>
                            </div>
                          )}
                          {signal.outcomeAccuracy !== undefined && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Prediction Accuracy</p>
                              <p className={`font-bold ${signal.outcomeAccuracy ? 'text-green-600' : 'text-red-600'}`}>
                                {signal.outcomeAccuracy ? '✓ Correct' : '✗ Incorrect'}
                              </p>
                            </div>
                          )}
                          {signal.reason && (
                            <div className="lg:col-span-4">
                              <p className="text-xs text-gray-600 mb-1">Signal Reasoning</p>
                              <p className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">{signal.reason}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No signals match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION INFO */}
      <div className="text-center text-sm text-gray-600">
        Showing {filteredSignals.length} of {signals.length} total signals
      </div>
    </div>
  );
};

export default SignalHistory;
