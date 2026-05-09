import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Play, Download, Settings, TrendingUp, BarChart3, Zap, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface BacktestResult {
  symbol: string;
  startDate: number;
  endDate: number;
  status: 'RUNNING' | 'COMPLETE' | 'FAILED';
  trades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  equityCurve: Array<{ time: number; equity: number }>;
}

interface BacktestIntegrationProps {
  onRunBacktest?: (params: BacktestParams) => void;
  results?: BacktestResult[];
}

export interface BacktestParams {
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  agents: string[];
  minConfidence: number;
  maxPositionSize: number;
}

export default function BacktestIntegration({
  onRunBacktest,
  results = []
}: BacktestIntegrationProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [params, setParams] = useState<BacktestParams>({
    symbol: 'BTC',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    agents: ['VFMD', 'FLOW', 'GRADIENT_TREND'],
    minConfidence: 60,
    maxPositionSize: 5
  });

  const handleRunBacktest = () => {
    onRunBacktest?.(params);
  };

  const latestResult = results?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Backtest Engine</h2>
        <p className="text-slate-400">Test your trading strategy against historical data</p>
      </div>

      {/* Configuration Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Backtest Configuration
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? 'Hide' : 'Edit'} Settings
            </Button>
          </div>
        </CardHeader>

        {showSettings && (
          <CardContent className="space-y-4 border-t border-slate-800 pt-4">
            {/* Symbol */}
            <div>
              <label className="text-sm font-semibold block mb-2">Symbol</label>
              <select
                value={params.symbol}
                onChange={(e) => setParams({ ...params, symbol: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option>BTC</option>
                <option>ETH</option>
                <option>SOL</option>
                <option>XRP</option>
                <option>ADA</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold block mb-2">Start Date</label>
                <input
                  type="date"
                  value={params.startDate}
                  onChange={(e) => setParams({ ...params, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-2">End Date</label>
                <input
                  type="date"
                  value={params.endDate}
                  onChange={(e) => setParams({ ...params, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>

            {/* Capital & Position Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold block mb-2">Initial Capital</label>
                <input
                  type="number"
                  value={params.initialCapital}
                  onChange={(e) => setParams({ ...params, initialCapital: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-2">Max Position Size (%)</label>
                <input
                  type="number"
                  value={params.maxPositionSize}
                  onChange={(e) => setParams({ ...params, maxPositionSize: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  min="0.5"
                  max="10"
                  step="0.5"
                />
              </div>
            </div>

            {/* Min Confidence */}
            <div>
              <label className="text-sm font-semibold block mb-2">
                Min Agent Confidence: {params.minConfidence}%
              </label>
              <input
                type="range"
                min="30"
                max="90"
                value={params.minConfidence}
                onChange={(e) => setParams({ ...params, minConfidence: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-slate-400 mt-1">
                Only trade signals with at least {params.minConfidence}% confidence
              </div>
            </div>

            {/* Agent Selection */}
            <div>
              <label className="text-sm font-semibold block mb-2">Agents to Use</label>
              <div className="grid grid-cols-2 gap-2">
                {['VFMD', 'FLOW', 'GRADIENT_TREND', 'SCANNER', 'ML', 'RL', 'UT_BOT', 'EXIT'].map((agent) => (
                  <label key={agent} className="flex items-center gap-2 p-2 bg-slate-800 rounded border border-slate-700 cursor-pointer hover:border-slate-600">
                    <input
                      type="checkbox"
                      checked={params.agents.includes(agent)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setParams({ ...params, agents: [...params.agents, agent] });
                        } else {
                          setParams({ ...params, agents: params.agents.filter(a => a !== agent) });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{agent}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleRunBacktest}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Run Backtest
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                Close Settings
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Results */}
      {latestResult && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className={`bg-slate-800 border-slate-700 ${latestResult.totalReturn > 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Total Return</div>
                <div className={`text-2xl font-bold flex items-center gap-1 ${latestResult.totalReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {latestResult.totalReturn > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  {latestResult.totalReturnPercent.toFixed(2)}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ${latestResult.totalReturn.toFixed(0)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-blue-400">{latestResult.winRate.toFixed(1)}%</div>
                <div className="text-xs text-slate-400 mt-1">
                  {latestResult.winningTrades}W / {latestResult.losingTrades}L
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Profit Factor</div>
                <div className="text-2xl font-bold text-purple-400">{latestResult.profitFactor.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-1">
                  Wins vs Losses ratio
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Max Drawdown</div>
                <div className="text-2xl font-bold text-red-400">{latestResult.maxDrawdown.toFixed(1)}%</div>
                <div className="text-xs text-slate-400 mt-1">
                  Sharpe: {latestResult.sharpeRatio.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Equity Curve */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Equity Curve
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestResult.equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={latestResult.equityCurve}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="time"
                      stroke="#94a3b8"
                      tickFormatter={(time) => new Date(time).toLocaleDateString()}
                    />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                      formatter={(value: any) => `$${typeof value === 'number' ? value.toFixed(2) : value}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorEquity)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  Loading equity curve...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Statistics */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Detailed Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400 mb-2">Total Trades</div>
                  <div className="text-2xl font-bold">{latestResult.trades}</div>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="text-xs text-slate-400 mb-2">Avg Win</div>
                  <div className="text-2xl font-bold text-green-400">${latestResult.avgWin.toFixed(0)}</div>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                  <div className="text-xs text-slate-400 mb-2">Avg Loss</div>
                  <div className="text-2xl font-bold text-red-400">${latestResult.avgLoss.toFixed(0)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle>Export Results</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF Report
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {!latestResult && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No backtest results yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Configure the settings above and click "Run Backtest" to start
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
