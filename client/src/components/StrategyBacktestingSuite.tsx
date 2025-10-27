import { useState, useEffect } from 'react';
import { X, Play, BarChart3, TrendingUp, AlertCircle, Download, Settings, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Strategy {
  id: string;
  name: string;
  performance?: {
    winRate?: number;
    avgReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
  };
}

interface StrategyBacktestingSuiteProps {
  strategy: Strategy;
  onClose: () => void;
}

interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
  transactionCost: number;
  slippage: number;
  monteCarloIterations: number;
  walkForwardPeriods: number;
  optimization: boolean;
}

interface BacktestResults {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  expectedValue: number;
  kellyCriterion: number;
  valueAtRisk: number;
  conditionalVaR: number;
  trades: number;
  equityCurve: { date: string; value: number }[];
  drawdownSeries: { date: string; value: number }[];
  monthlyReturns: { month: string; return: number }[];
}

export default function StrategyBacktestingSuite({
  strategy,
  onClose,
}: StrategyBacktestingSuiteProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    startDate: '2023-01-01',
    endDate: '2024-12-31',
    initialCapital: 100000,
    transactionCost: 0.001,
    slippage: 0.0005,
    monteCarloIterations: 1000,
    walkForwardPeriods: 4,
    optimization: true,
  });

  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'walkforward' | 'montecarlo' | 'analysis'>('overview');

  const runBacktest = async () => {
    setIsRunning(true);

    // Simulate backtest execution
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate mock results
    const mockResults: BacktestResults = {
      totalReturn: 45.8,
      annualizedReturn: 22.4,
      sharpeRatio: 1.68,
      sortinoRatio: 2.15,
      calmarRatio: 2.8,
      maxDrawdown: -8.2,
      winRate: 58.3,
      profitFactor: 1.85,
      expectedValue: 0.024,
      kellyCriterion: 0.12,
      valueAtRisk: -2.5,
      conditionalVaR: -4.1,
      trades: 127,
      equityCurve: generateEquityCurve(),
      drawdownSeries: generateDrawdownSeries(),
      monthlyReturns: generateMonthlyReturns(),
    };

    setBacktestResults(mockResults);
    setIsRunning(false);
  };

  const generateEquityCurve = () => {
    const dates = [];
    const values = [];
    let value = 100000;

    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= days; i += 7) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      
      // Add some realistic volatility
      value += (Math.random() - 0.45) * value * 0.02;
      value = Math.max(value, config.initialCapital * 0.7);

      dates.push(date.toISOString().split('T')[0]);
      values.push(value);
    }

    return dates.map((date, i) => ({ date, value: values[i] }));
  };

  const generateDrawdownSeries = () => {
    return backtestResults?.equityCurve.map((point, index) => {
      const peak = Math.max(...backtestResults.equityCurve.slice(0, index + 1).map(p => p.value));
      const drawdown = ((point.value - peak) / peak) * 100;
      return { date: point.date, value: drawdown };
    }) || [];
  };

  const generateMonthlyReturns = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month) => ({
      month,
      return: (Math.random() - 0.3) * 10,
    }));
  };

  // Monte Carlo simulation results
  const monteCarloResults = backtestResults
    ? Array.from({ length: 100 }, (_, i) => ({
        iteration: i + 1,
        finalValue: config.initialCapital * (1 + backtestResults.totalReturn / 100) * (0.8 + Math.random() * 0.4),
        maxDrawdown: -(5 + Math.random() * 5),
      }))
    : [];

  useEffect(() => {
    if (backtestResults) {
      setBacktestResults({
        ...backtestResults,
        drawdownSeries: generateDrawdownSeries(),
      });
    }
  }, [backtestResults?.equityCurve]);

  const handleExport = () => {
    if (!backtestResults) return;

    const data = {
      strategy: strategy.name,
      config,
      results: backtestResults,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest-${strategy.name}-${Date.now()}.json`;
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
              <span>Backtesting Suite - {strategy.name}</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">Comprehensive strategy validation & analysis</p>
          </div>
          <div className="flex items-center space-x-2">
            {backtestResults && (
              <button
                onClick={handleExport}
                className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-all"
                title="Export results"
              >
                <Download className="w-5 h-5 text-green-400" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Close backtesting suite"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Configuration */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <span>Backtest Configuration</span>
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={config.startDate}
                        onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">End Date</label>
                      <input
                        type="date"
                        value={config.endDate}
                        onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Initial Capital ($)</label>
                    <input
                      type="number"
                      value={config.initialCapital}
                      onChange={(e) => setConfig({ ...config, initialCapital: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Transaction Cost ({config.transactionCost * 100}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.01"
                      step="0.0001"
                      value={config.transactionCost}
                      onChange={(e) => setConfig({ ...config, transactionCost: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Slippage ({config.slippage * 100}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.005"
                      step="0.0001"
                      value={config.slippage}
                      onChange={(e) => setConfig({ ...config, slippage: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="optimization"
                      checked={config.optimization}
                      onChange={(e) => setConfig({ ...config, optimization: e.target.checked })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="optimization" className="text-sm text-slate-300">
                      Enable Parameter Optimization
                    </label>
                  </div>

                  <button
                    onClick={runBacktest}
                    disabled={isRunning}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-white font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRunning ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        <span>Running Backtest...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        <span>Run Backtest</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Results */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tabs */}
              {backtestResults && (
                <div className="flex space-x-2 bg-slate-700/50 rounded-lg p-2 border border-slate-600">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'walkforward', label: 'Walk-Forward' },
                    { id: 'montecarlo', label: 'Monte Carlo' },
                    { id: 'analysis', label: 'Analysis' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {!backtestResults ? (
                <div className="bg-slate-700/50 rounded-lg p-12 border border-slate-600 text-center">
                  <Activity className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No Backtest Results</h3>
                  <p className="text-slate-400">Configure your parameters and run a backtest to see results</p>
                </div>
              ) : (
                <>
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Performance Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Total Return</p>
                          <p className="text-2xl font-bold text-green-400">{backtestResults.totalReturn.toFixed(2)}%</p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Sharpe Ratio</p>
                          <p className="text-2xl font-bold text-blue-400">{backtestResults.sharpeRatio.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Max Drawdown</p>
                          <p className="text-2xl font-bold text-red-400">{backtestResults.maxDrawdown.toFixed(2)}%</p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                          <p className="text-2xl font-bold text-yellow-400">{backtestResults.winRate.toFixed(1)}%</p>
                        </div>
                      </div>

                      {/* Equity Curve */}
                      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                        <h3 className="text-lg font-semibold text-white mb-4">Equity Curve</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={backtestResults.equityCurve}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(100, 116, 139, 0.5)',
                                borderRadius: '8px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Drawdown Chart */}
                      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                        <h3 className="text-lg font-semibold text-white mb-4">Drawdown Series</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={backtestResults.drawdownSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(100, 116, 139, 0.5)',
                                borderRadius: '8px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#ef4444"
                              fill="#ef4444"
                              fillOpacity={0.3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Risk Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <h4 className="text-sm font-semibold text-white mb-3">Risk Metrics</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Sortino Ratio</span>
                              <span className="text-white font-semibold">{backtestResults.sortinoRatio.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Calmar Ratio</span>
                              <span className="text-white font-semibold">{backtestResults.calmarRatio.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Value at Risk (VaR)</span>
                              <span className="text-red-400 font-semibold">{backtestResults.valueAtRisk.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Conditional VaR</span>
                              <span className="text-red-400 font-semibold">{backtestResults.conditionalVaR.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <h4 className="text-sm font-semibold text-white mb-3">Trade Statistics</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Trades</span>
                              <span className="text-white font-semibold">{backtestResults.trades}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Profit Factor</span>
                              <span className="text-green-400 font-semibold">{backtestResults.profitFactor.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Expected Value</span>
                              <span className="text-blue-400 font-semibold">{backtestResults.expectedValue.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Kelly Criterion</span>
                              <span className="text-yellow-400 font-semibold">{backtestResults.kellyCriterion.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Monte Carlo Tab */}
                  {activeTab === 'montecarlo' && (
                    <div className="space-y-6">
                      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                        <h3 className="text-lg font-semibold text-white mb-4">Monte Carlo Simulation</h3>
                        <p className="text-sm text-slate-400 mb-4">
                          {monteCarloResults.length} iterations showing distribution of possible outcomes
                        </p>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={monteCarloResults.slice(0, 50)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="iteration" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(100, 116, 139, 0.5)',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="finalValue" fill="#3b82f6" name="Final Value ($)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
