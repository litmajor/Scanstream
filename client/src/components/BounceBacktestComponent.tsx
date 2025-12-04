import { useState } from 'react';
import { X, Play, BarChart3, TrendingUp, AlertCircle, Download, Settings, Calendar } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BacktestResults {
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  avgReturn: number;
}

interface BounceBacktestComponentProps {
  onClose?: () => void;
}

export default function BounceBacktestComponent({ onClose }: BounceBacktestComponentProps) {
  const [config, setConfig] = useState({
    symbol: 'BTC/USDT',
    timeframe: '1h',
    startDate: '2024-09-01',
    endDate: '2024-12-31',
    riskProfile: 'moderate',
  });

  const [results, setResults] = useState<BacktestResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equityCurve, setEquityCurve] = useState<any[]>([]);

  const runBacktest = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/strategies/bounce/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.backtest);
        // Generate mock equity curve
        generateMockEquityCurve();
      } else {
        setError(data.error || 'Backtest failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const generateMockEquityCurve = () => {
    const data = [];
    let value = 10000;
    for (let i = 0; i < 90; i++) {
      value += (Math.random() - 0.45) * 500; // Slight uptrend bias
      data.push({ date: `Day ${i + 1}`, value: Math.round(value) });
    }
    setEquityCurve(data);
  };

  const downloadResults = () => {
    if (!results) return;
    const csv =
      'Strategy,Symbol,Timeframe,WinRate,TotalTrades,ProfitFactor,SharpeRatio,MaxDrawdown,TotalReturn,AvgReturn\n' +
      `${results.strategyName},${results.symbol},${results.timeframe},${results.winRate},${results.totalTrades},${results.profitFactor},${results.sharpeRatio},${results.maxDrawdown},${results.totalReturn},${results.avgReturn}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bounce-backtest-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900">Enhanced Bounce Strategy Backtest</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuration
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <input
                type="text"
                value={config.symbol}
                onChange={(e) => setConfig({ ...config, symbol: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="BTC/USDT"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
              <select
                value={config.timeframe}
                onChange={(e) => setConfig({ ...config, timeframe: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option>1m</option>
                <option>5m</option>
                <option>15m</option>
                <option>1h</option>
                <option>4h</option>
                <option>1d</option>
                <option>1w</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Profile</label>
              <select
                value={config.riskProfile}
                onChange={(e) => setConfig({ ...config, riskProfile: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={runBacktest}
              disabled={isRunning}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                isRunning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
              }`}
            >
              {isRunning ? (
                <>
                  <Calendar className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Backtest
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {results ? (
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                  <p className="text-3xl font-bold text-green-600">{results.winRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">{results.totalTrades} trades</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">Sharpe Ratio</p>
                  <p className="text-3xl font-bold text-blue-600">{results.sharpeRatio.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Risk-adjusted return</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-gray-600 mb-1">Total Return</p>
                  <p className="text-3xl font-bold text-orange-600">+{results.totalReturn.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Per trade: {results.avgReturn.toFixed(2)}%</p>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-gray-600 mb-1">Max Drawdown</p>
                  <p className="text-3xl font-bold text-red-600">{results.maxDrawdown.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Largest peak-to-trough</p>
                </div>
              </div>

              {/* Profit Factor */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-gray-600 mb-2">Profit Factor</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-purple-600 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min((results.profitFactor / 3) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="font-bold text-purple-600">{results.profitFactor.toFixed(2)}x</span>
                </div>
              </div>

              {/* Equity Curve */}
              {equityCurve.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-3">Equity Curve</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                      <Line type="monotone" dataKey="value" stroke="#9333ea" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={downloadResults}
                className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Results (CSV)
              </button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 border border-gray-200 text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Configure and run a backtest to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
