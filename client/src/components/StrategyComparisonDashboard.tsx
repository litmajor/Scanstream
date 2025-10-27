import { useState } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  Area,
  ComposedChart,
} from 'recharts';
import {
  CheckCircle2,
  XCircle,
  Download,
  X,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

interface Strategy {
  id: string;
  name: string;
  type: string;
  performance: {
    winRate?: number;
    avgReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
  };
  equityCurve?: { date: string; value: number }[];
}

interface StrategyComparisonDashboardProps {
  strategies: Strategy[];
  onClose: () => void;
}

export default function StrategyComparisonDashboard({
  strategies,
  onClose,
}: StrategyComparisonDashboardProps) {
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'radar' | 'equity' | 'heatmap'>('radar');

  const maxCompareCount = 4;

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies((prev) => {
      if (prev.includes(strategyId)) {
        return prev.filter((id) => id !== strategyId);
      } else if (prev.length < maxCompareCount) {
        return [...prev, strategyId];
      }
      return prev;
    });
  };

  const selectedStrategyData = strategies.filter((s) =>
    selectedStrategies.includes(s.id)
  );

  // Prepare radar chart data
  const radarData = [
    { metric: 'Win Rate', ...Object.fromEntries(selectedStrategyData.map(s => [s.name, s.performance.winRate || 0])) },
    { metric: 'Avg Return', ...Object.fromEntries(selectedStrategyData.map(s => [s.name, (s.performance.avgReturn || 0) * 10])) },
    { metric: 'Sharpe', ...Object.fromEntries(selectedStrategyData.map(s => [s.name, (s.performance.sharpeRatio || 0) * 20])) },
    { metric: 'Max DD', ...Object.fromEntries(selectedStrategyData.map(s => [s.name, Math.abs((s.performance.maxDrawdown || 0)) * 10])) },
  ];

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Prepare equity curve data
  const prepareEquityData = () => {
    if (!selectedStrategyData.length) return [];

    const allDates = new Set<string>();
    selectedStrategyData.forEach((strategy) => {
      if (strategy.equityCurve) {
        strategy.equityCurve.forEach((point) => allDates.add(point.date));
      }
    });

    const sortedDates = Array.from(allDates).sort();

    return sortedDates.map((date) => {
      const dataPoint: any = { date };
      selectedStrategyData.forEach((strategy) => {
        const point = strategy.equityCurve?.find((p) => p.date === date);
        dataPoint[strategy.name] = point?.value || null;
      });
      return dataPoint;
    });
  };

  const equityData = prepareEquityData();

  // Performance heatmap data
  const heatmapData = selectedStrategyData.map((strategy) => ({
    strategy: strategy.name,
    winRate: strategy.performance.winRate || 0,
    avgReturn: strategy.performance.avgReturn || 0,
    sharpeRatio: strategy.performance.sharpeRatio || 0,
    maxDrawdown: strategy.performance.maxDrawdown || 0,
  }));

  const handleExport = () => {
    const data = {
      selectedStrategies: selectedStrategyData.map((s) => ({
        name: s.name,
        type: s.type,
        performance: s.performance,
      })),
      comparisonDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategy-comparison-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              <span>Strategy Comparison Dashboard</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Compare up to {maxCompareCount} strategies side-by-side
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="Close comparison"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Strategy Selector */}
          <div className="mb-6 bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              Select Strategies to Compare ({selectedStrategies.length}/{maxCompareCount})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {strategies.map((strategy) => {
                const isSelected = selectedStrategies.includes(strategy.id);
                const isDisabled =
                  !isSelected && selectedStrategies.length >= maxCompareCount;

                return (
                  <button
                    key={strategy.id}
                    onClick={() => toggleStrategy(strategy.id)}
                    disabled={isDisabled}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDisabled
                        ? 'border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm">
                        {strategy.name}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-slate-600 rounded-full" />
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{strategy.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedStrategies.length < 2 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Select at least 2 strategies
              </h3>
              <p className="text-slate-400">
                Choose {2 - selectedStrategies.length} more strategy
                {2 - selectedStrategies.length !== 1 ? 'ies' : ''} to start comparing
              </p>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 mb-6 bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                <button
                  onClick={() => setActiveTab('radar')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'radar'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Performance Radar
                </button>
                <button
                  onClick={() => setActiveTab('equity')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'equity'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Equity Curves
                </button>
                <button
                  onClick={() => setActiveTab('heatmap')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'heatmap'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Performance Heatmap
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'radar' && (
                <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-6">
                    Performance Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: '#cbd5e1', fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: '#cbd5e1', fontSize: 10 }}
                      />
                      {selectedStrategyData.map((strategy, index) => (
                        <Radar
                          key={strategy.id}
                          name={strategy.name}
                          dataKey={strategy.name}
                          stroke={colors[index]}
                          fill={colors[index]}
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                      ))}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'equity' && (
                <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-6">
                    Equity Curve Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={equityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.substring(0, 5)}
                      />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(100, 116, 139, 0.5)',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      {selectedStrategyData.map((strategy, index) => (
                        <Line
                          key={strategy.id}
                          type="monotone"
                          dataKey={strategy.name}
                          stroke={colors[index]}
                          strokeWidth={2}
                          dot={false}
                          name={strategy.name}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {activeTab === 'heatmap' && (
                <div className="bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-6">
                    Performance Heatmap
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-slate-300 font-semibold">
                            Strategy
                          </th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">
                            Win Rate
                          </th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">
                            Avg Return
                          </th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">
                            Sharpe Ratio
                          </th>
                          <th className="text-right py-3 px-4 text-slate-300 font-semibold">
                            Max Drawdown
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapData.map((row, index) => (
                          <tr
                            key={index}
                            className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3 px-4 font-medium text-white">
                              {row.strategy}
                            </td>
                            <td
                              className="py-3 px-4 text-right"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  row.winRate,
                                  0,
                                  100,
                                  true
                                ),
                              }}
                            >
                              <span className="font-mono font-semibold">
                                {row.winRate.toFixed(1)}%
                              </span>
                            </td>
                            <td
                              className="py-3 px-4 text-right"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  row.avgReturn,
                                  -10,
                                  10,
                                  true
                                ),
                              }}
                            >
                              <span className="font-mono font-semibold">
                                {row.avgReturn >= 0 ? '+' : ''}
                                {row.avgReturn.toFixed(2)}%
                              </span>
                            </td>
                            <td
                              className="py-3 px-4 text-right"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  row.sharpeRatio,
                                  0,
                                  3,
                                  true
                                ),
                              }}
                            >
                              <span className="font-mono font-semibold">
                                {row.sharpeRatio.toFixed(2)}
                              </span>
                            </td>
                            <td
                              className="py-3 px-4 text-right"
                              style={{
                                backgroundColor: getHeatmapColor(
                                  Math.abs(row.maxDrawdown),
                                  0,
                                  20,
                                  false
                                ),
                              }}
                            >
                              <span className="font-mono font-semibold text-red-400">
                                {row.maxDrawdown.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-green-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Comparison</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function for heatmap coloring
function getHeatmapColor(
  value: number,
  min: number,
  max: number,
  higherIsBetter: boolean
): string {
  const normalized = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const intensity = higherIsBetter ? normalized : 1 - normalized;

  // Green to Red gradient (for drawdown, Red is bad)
  if (higherIsBetter) {
    // Green (good) to Yellow (medium) to Red (bad)
    if (intensity > 0.5) {
      const greenIntensity = ((intensity - 0.5) * 2) * 255;
      return `rgba(${255 - greenIntensity}, 255, 0, 0.2)`;
    } else {
      const redIntensity = (1 - intensity * 2) * 255;
      return `rgba(255, ${redIntensity}, 0, 0.2)`;
    }
  } else {
    // Red (bad) to Yellow (medium) to Green (good)
    if (intensity > 0.5) {
      const redIntensity = ((intensity - 0.5) * 2) * 255;
      return `rgba(255, ${redIntensity}, 0, 0.2)`;
    } else {
      const greenIntensity = (1 - intensity * 2) * 255;
      return `rgba(${255 - greenIntensity}, 255, 0, 0.2)`;
    }
  }
}
