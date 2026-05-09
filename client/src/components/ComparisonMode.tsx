import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Download,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Activity,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface BacktestMetrics {
  totalReturn?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  profitFactor?: number;
  sortinoRatio?: number;
  annualizedReturn?: number;
  calmarRatio?: number;
  totalTrades?: number;
  avgWin?: number;
  avgLoss?: number;
  [key: string]: number | undefined;
}

interface BacktestResult {
  id: string;
  name?: string;
  symbol?: string;
  metrics: BacktestMetrics;
  equityCurve?: Array<{ timestamp: string; value: number }>;
  trades?: Array<{ entryTime: string; exitTime: string; pnl: number; returnPercent: number }>;
  monthlyReturns?: Array<{ month: string; return: number }>;
}

interface MetricComparison {
  metric: string;
  label: string;
  result1Value: number;
  result2Value: number;
  result3Value?: number;
  result4Value?: number;
  difference12: number;
  percentChange12: number;
  winner: 'result1' | 'result2' | 'result3' | 'result4' | 'tie';
  inverted?: boolean; // For metrics where lower is better (drawdown)
}

interface ComparisonModeProps {
  results: BacktestResult[];
  onClose?: () => void;
  onExport?: (data: any) => void;
}

const ComparisonMode: React.FC<ComparisonModeProps> = ({ results, onClose, onExport }) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'charts' | 'rankings' | 'statistics'>('metrics');
  const [visibleResults, setVisibleResults] = useState<Set<number>>(new Set([0, 1]));
  const [selectedMetricSort, setSelectedMetricSort] = useState<string>('totalReturn');

  // Colors for results
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];
  const resultNames = results.slice(0, 4).map((r) => r.name || r.symbol || `Result ${results.indexOf(r) + 1}`);

  // Calculate metric comparisons
  const comparisons = useMemo(() => {
    const metricsToCompare = [
      { key: 'totalReturn', label: 'Total Return (%)', inverted: false },
      { key: 'sharpeRatio', label: 'Sharpe Ratio', inverted: false },
      { key: 'maxDrawdown', label: 'Max Drawdown (%)', inverted: true },
      { key: 'winRate', label: 'Win Rate (%)', inverted: false },
      { key: 'profitFactor', label: 'Profit Factor', inverted: false },
      { key: 'sortinoRatio', label: 'Sortino Ratio', inverted: false },
      { key: 'annualizedReturn', label: 'Annualized Return (%)', inverted: false },
      { key: 'calmarRatio', label: 'Calmar Ratio', inverted: false },
      { key: 'totalTrades', label: 'Total Trades', inverted: false },
      { key: 'avgWin', label: 'Avg Win (%)', inverted: false },
      { key: 'avgLoss', label: 'Avg Loss (%)', inverted: true },
    ];

    return metricsToCompare
      .map((m) => {
        const val1 = (results[0]?.metrics as any)?.[m.key] ?? 0;
        const val2 = (results[1]?.metrics as any)?.[m.key] ?? 0;
        const val3 = (results[2]?.metrics as any)?.[m.key];
        const val4 = (results[3]?.metrics as any)?.[m.key];

        const difference = val1 - val2;
        const percentChange = val2 !== 0 ? (difference / Math.abs(val2)) * 100 : 0;

        let winner: 'result1' | 'result2' | 'result3' | 'result4' | 'tie' = 'tie';

        if (m.inverted) {
          // For inverted metrics (lower is better), reverse the logic
          if (val1 < val2) winner = 'result1';
          else if (val2 < val1) winner = 'result2';
        } else {
          // For normal metrics (higher is better)
          if (val1 > val2) winner = 'result1';
          else if (val2 > val1) winner = 'result2';
        }

        return {
          metric: m.key,
          label: m.label,
          result1Value: val1,
          result2Value: val2,
          result3Value: val3,
          result4Value: val4,
          difference12: difference,
          percentChange12: percentChange,
          winner,
          inverted: m.inverted,
        };
      })
      .sort((a, b) => {
        if (selectedMetricSort === 'totalReturn') {
          return Math.abs(b.percentChange12) - Math.abs(a.percentChange12);
        }
        return 0;
      });
  }, [results, selectedMetricSort]);

  // Overlay equity curves
  const overlayedData = useMemo(() => {
    if (!results[0]?.equityCurve || !results[1]?.equityCurve) return [];

    const timestamps = new Set<string>();
    results.forEach((r, idx) => {
      if (visibleResults.has(idx) && r.equityCurve) {
        r.equityCurve.forEach((point) => timestamps.add(point.timestamp));
      }
    });

    const sortedTimestamps = Array.from(timestamps).sort();

    return sortedTimestamps.map((ts) => {
      const dataPoint: any = { timestamp: ts };
      results.forEach((r, idx) => {
        if (visibleResults.has(idx) && r.equityCurve) {
          const point = r.equityCurve.find((p) => p.timestamp === ts);
          if (point) {
            dataPoint[`result${idx}`] = point.value;
          }
        }
      });
      return dataPoint;
    });
  }, [results, visibleResults]);

  // Calculate rankings
  const rankings = useMemo(() => {
    const rankingMetrics = ['totalReturn', 'sharpeRatio', 'winRate'];

    const rankings: Record<string, { result: BacktestResult; score: number }> = {};

    rankingMetrics.forEach((metric) => {
      const sorted = [...results].sort((a, b) => {
        const aVal = a.metrics[metric] ?? 0;
        const bVal = b.metrics[metric] ?? 0;
        return bVal - aVal;
      });

      sorted.forEach((result, idx) => {
        if (!rankings[result.id]) {
          rankings[result.id] = { result, score: 0 };
        }
        rankings[result.id]!.score += idx === 0 ? 3 : idx === 1 ? 2 : 1;
      });
    });

    return Object.values(rankings)
      .sort((a, b) => b.score - a.score)
      .map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [results]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (results.length < 2) return null;

    const result1Equity = results[0]?.equityCurve || [];
    const result2Equity = results[1]?.equityCurve || [];

    // Correlation between equity curves
    const correlation = calculateCorrelation(
      result1Equity.map((p) => p.value),
      result2Equity.map((p) => p.value)
    );

    // Drawdown analysis
    const calcDrawdown = (curve: Array<{ timestamp: string; value: number }>) => {
      let peak = 0;
      let maxDD = 0;
      curve.forEach((point) => {
        if (point.value > peak) peak = point.value;
        const dd = (peak - point.value) / peak;
        if (dd > maxDD) maxDD = dd;
      });
      return maxDD;
    };

    const drawdown1 = calcDrawdown(result1Equity);
    const drawdown2 = calcDrawdown(result2Equity);

    return {
      correlation,
      drawdown1: drawdown1 * 100,
      drawdown2: drawdown2 * 100,
    };
  }, [results]);

  return (
    <div className="w-full bg-gray-900 rounded-lg border border-gray-700 p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Backtest Comparison
          </h2>
          <p className="text-gray-400 mt-1">
            {results.length} result{results.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <div className="flex gap-2">
          {onExport && (
            <button
              onClick={() => onExport(comparisons)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Result Selection */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {results.slice(0, 4).map((result, idx) => (
          <button
            key={result.id}
            onClick={() => {
              const newVisible = new Set(visibleResults);
              if (newVisible.has(idx)) {
                newVisible.delete(idx);
              } else {
                newVisible.add(idx);
              }
              setVisibleResults(newVisible);
            }}
            className={`p-3 rounded-lg border-2 transition-colors ${
              visibleResults.has(idx)
                ? `border-${['blue', 'red', 'green', 'amber'][idx]}-500 bg-${['blue', 'red', 'green', 'amber'][idx]}-900 bg-opacity-30`
                : 'border-gray-700 bg-gray-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{resultNames[idx]}</span>
              {visibleResults.has(idx) ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4 opacity-50" />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Return: {((result.metrics.totalReturn ?? 0) * 100).toFixed(1)}%
            </p>
          </button>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 overflow-x-auto">
        {(['metrics', 'charts', 'rankings', 'statistics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-semibold text-sm whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-400 mb-3">
              Comparing {Math.min(visibleResults.size, 2)} result{visibleResults.size !== 1 ? 's' : ''}
            </div>
            {comparisons.map((comp) => (
              <div
                key={comp.metric}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    {comp.metric === 'totalReturn' && <TrendingUp className="w-4 h-4 text-green-400" />}
                    {comp.metric === 'maxDrawdown' && <TrendingDown className="w-4 h-4 text-red-400" />}
                    {comp.metric === 'sharpeRatio' && <Zap className="w-4 h-4 text-yellow-400" />}
                    {comp.label}
                  </h3>
                  <span
                    className={`text-sm font-bold px-2 py-1 rounded ${
                      comp.percentChange12 > 0
                        ? 'bg-green-900 text-green-400'
                        : comp.percentChange12 < 0
                          ? 'bg-red-900 text-red-400'
                          : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {comp.percentChange12 > 0 ? '+' : ''}
                    {comp.percentChange12.toFixed(2)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Result 1 */}
                  <div className="bg-gray-900 rounded p-3 border-l-4 border-blue-500">
                    <p className="text-xs text-gray-400 mb-1">{resultNames[0]}</p>
                    <p className="text-lg font-bold text-blue-400">
                      {comp.result1Value.toFixed(comp.metric === 'totalTrades' ? 0 : 2)}
                    </p>
                    {comp.winner === 'result1' && (
                      <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" /> Winner
                      </p>
                    )}
                  </div>

                  {/* Result 2 */}
                  <div className="bg-gray-900 rounded p-3 border-l-4 border-red-500">
                    <p className="text-xs text-gray-400 mb-1">{resultNames[1]}</p>
                    <p className="text-lg font-bold text-red-400">
                      {comp.result2Value.toFixed(comp.metric === 'totalTrades' ? 0 : 2)}
                    </p>
                    {comp.winner === 'result2' && (
                      <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                        <ArrowUp className="w-3 h-3" /> Winner
                      </p>
                    )}
                  </div>
                </div>

                {/* Additional results if available */}
                {results.length > 2 && comp.result3Value !== undefined && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-gray-900 rounded p-3 border-l-4 border-green-500">
                      <p className="text-xs text-gray-400 mb-1">{resultNames[2]}</p>
                      <p className="text-lg font-bold text-green-400">
                        {comp.result3Value.toFixed(comp.metric === 'totalTrades' ? 0 : 2)}
                      </p>
                    </div>
                    {results.length > 3 && comp.result4Value !== undefined && (
                      <div className="bg-gray-900 rounded p-3 border-l-4 border-amber-500">
                        <p className="text-xs text-gray-400 mb-1">{resultNames[3]}</p>
                        <p className="text-lg font-bold text-amber-400">
                          {comp.result4Value.toFixed(comp.metric === 'totalTrades' ? 0 : 2)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            {overlayedData.length > 0 ? (
              <>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Equity Curve Overlay
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={overlayedData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="timestamp" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }}
                        formatter={(value) => (typeof value === 'number' ? `$${value.toFixed(2)}` : value)}
                      />
                      <Legend />
                      {[0, 1, 2, 3].map(
                        (idx) =>
                          visibleResults.has(idx) && (
                            <Line
                              key={`result${idx}`}
                              type="monotone"
                              dataKey={`result${idx}`}
                              stroke={colors[idx]}
                              dot={false}
                              isAnimationActive={false}
                              name={resultNames[idx]}
                              strokeWidth={2}
                            />
                          )
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly Returns Comparison */}
                {results[0]?.monthlyReturns && results[1]?.monthlyReturns && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4">Monthly Returns Comparison</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[0, 1].map(
                        (resultIdx) =>
                          results[resultIdx]?.monthlyReturns && (
                            <div key={resultIdx}>
                              <p className="text-sm text-gray-400 mb-3">{resultNames[resultIdx]}</p>
                              <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={results[resultIdx].monthlyReturns}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                  <XAxis dataKey="month" stroke="#9ca3af" />
                                  <YAxis stroke="#9ca3af" />
                                  <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }}
                                    formatter={(value: any) => `${((typeof value === 'number' ? value : 0) * 100).toFixed(2)}%`}
                                  />
                                  <Bar dataKey="return" fill={colors[resultIdx]}>
                                    {results[resultIdx].monthlyReturns?.map((entry, i) => (
                                      <Cell
                                        key={`cell-${i}`}
                                        fill={entry.return >= 0 ? '#10b981' : '#ef4444'}
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">No equity curve data available for visualization</p>
              </div>
            )}
          </div>
        )}

        {/* Rankings Tab */}
        {activeTab === 'rankings' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-yellow-400" />
                Overall Rankings
              </h3>
              <div className="space-y-3">
                {rankings.map((r) => (
                  <div
                    key={r.result.id}
                    className="flex items-center justify-between bg-gray-900 rounded p-4 border border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 bg-opacity-20 flex items-center justify-center font-bold text-blue-400">
                        #{r.rank}
                      </div>
                      <div>
                        <p className="font-semibold">{r.result.name || r.result.symbol || 'Result'}</p>
                        <p className="text-xs text-gray-400">Score: {r.score} points</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400">
                        {((r.result.metrics.totalReturn ?? 0) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-400">Return</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranking Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { metric: 'totalReturn', label: 'Best Return', icon: TrendingUp },
                { metric: 'sharpeRatio', label: 'Best Risk-Adjusted', icon: Zap },
                { metric: 'winRate', label: 'Best Win Rate', icon: Target },
              ].map((category) => {
                const best = [...results].sort(
                  (a, b) => (b.metrics[category.metric] ?? 0) - (a.metrics[category.metric] ?? 0)
                )[0];
                const IconComponent = category.icon;

                return (
                  <div key={category.metric} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                      <IconComponent className="w-4 h-4" />
                      {category.label}
                    </p>
                    <p className="text-2xl font-bold text-amber-400">
                      {best ? (best.name || best.symbol || 'Result') : 'N/A'}
                    </p>
                    {best && (
                      <p className="text-xs text-gray-500 mt-2">
                        {(best.metrics[category.metric] ?? 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'statistics' && statistics && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Equity Correlation</p>
                <p className="text-3xl font-bold text-blue-400">{statistics.correlation.toFixed(3)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {statistics.correlation > 0.7
                    ? 'Highly correlated'
                    : statistics.correlation > 0.3
                      ? 'Moderately correlated'
                      : 'Weakly correlated'}
                </p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">{resultNames[0]} Drawdown</p>
                <p className="text-3xl font-bold text-red-400">{statistics.drawdown1.toFixed(2)}%</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">{resultNames[1]} Drawdown</p>
                <p className="text-3xl font-bold text-red-400">{statistics.drawdown2.toFixed(2)}%</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">Trade Distribution Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1].map(
                  (resultIdx) =>
                    results[resultIdx]?.trades && (
                      <div key={resultIdx} className="bg-gray-900 rounded p-3 border border-gray-700">
                        <p className="text-sm text-gray-400 mb-3">{resultNames[resultIdx]}</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Total Trades:</span>
                            <span className="font-semibold text-white">
                              {results[resultIdx].trades?.length ?? 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Winning Trades:</span>
                            <span className="font-semibold text-green-400">
                              {
                                results[resultIdx].trades?.filter((t) => (t.pnl ?? 0) > 0).length ??
                                0
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Losing Trades:</span>
                            <span className="font-semibold text-red-400">
                              {
                                results[resultIdx].trades?.filter((t) => (t.pnl ?? 0) < 0).length ??
                                0
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function: Calculate Pearson correlation coefficient
function calculateCorrelation(arr1: number[], arr2: number[]): number {
  const n = Math.min(arr1.length, arr2.length);
  if (n === 0) return 0;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += arr1[i];
    sumY += arr2[i];
    sumXY += arr1[i] * arr2[i];
    sumX2 += arr1[i] * arr1[i];
    sumY2 += arr2[i] * arr2[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

export default ComparisonMode;
