import { useState } from 'react';
import { X, Copy, Play, Pause, TrendingUp, DollarSign, AlertCircle, CheckCircle, Settings, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CopiedStrategy {
  id: string;
  name: string;
  isActive: boolean;
  allocationPercent: number;
  tradesCopied: number;
  totalPnL: number;
  winRate: number;
  copiedAt: string;
  lastTrade?: {
    symbol: string;
    direction: string;
    size: number;
    entry: number;
    timestamp: string;
  };
}

interface StrategyCopyTradingProps {
  onClose: () => void;
}

export default function StrategyCopyTrading({ onClose }: StrategyCopyTradingProps) {
  const [copiedStrategies, setCopiedStrategies] = useState<CopiedStrategy[]>([
    {
      id: '1',
      name: 'Golden Cross Momentum',
      isActive: true,
      allocationPercent: 35,
      tradesCopied: 127,
      totalPnL: 2847.32,
      winRate: 68.5,
      copiedAt: '2024-01-10T10:00:00Z',
      lastTrade: {
        symbol: 'BTC/USDT',
        direction: 'LONG',
        size: 0.15,
        entry: 43250,
        timestamp: '2024-01-18T14:32:00Z',
      },
    },
    {
      id: '2',
      name: 'Volume Breakout System',
      isActive: true,
      allocationPercent: 25,
      tradesCopied: 89,
      totalPnL: 1923.67,
      winRate: 64.2,
      copiedAt: '2024-01-08T08:00:00Z',
      lastTrade: {
        symbol: 'ETH/USDT',
        direction: 'LONG',
        size: 2.5,
        entry: 2650,
        timestamp: '2024-01-18T13:45:00Z',
      },
    },
    {
      id: '3',
      name: 'Mean Reversion Bot',
      isActive: false,
      allocationPercent: 20,
      tradesCopied: 234,
      totalPnL: -156.82,
      winRate: 72.3,
      copiedAt: '2024-01-05T12:00:00Z',
      lastTrade: {
        symbol: 'SOL/USDT',
        direction: 'SHORT',
        size: 10,
        entry: 98.5,
        timestamp: '2024-01-18T12:15:00Z',
      },
    },
  ]);

  const [totalCapital, setTotalCapital] = useState(10000);
  const [riskPerTrade, setRiskPerTrade] = useState(2); // percentage

  // Generate P&L history
  const pnlHistory = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const basePnL = i < 10 ? 500 : i < 20 ? 1200 : 2100;
    const volatility = (Math.random() - 0.5) * 200;
    return {
      date: date.toISOString().split('T')[0],
      pnl: basePnL + volatility,
    };
  });

  const totalPnL = copiedStrategies.reduce((sum, s) => sum + s.totalPnL, 0);
  const totalTrades = copiedStrategies.reduce((sum, s) => sum + s.tradesCopied, 0);
  const activeStrategies = copiedStrategies.filter((s) => s.isActive).length;

  const handleToggleActive = (id: string) => {
    setCopiedStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleUpdateAllocation = (id: string, value: number) => {
    setCopiedStrategies((prev) =>
      prev.map((s) => (s.id === id ? { ...s, allocationPercent: value } : s))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Copy className="w-6 h-6 text-blue-400" />
              <span>Copy Trading</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">Automatically copy signals from top strategies</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="Close copy trading"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className={`text-sm font-semibold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-400">Total P&L</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400">{totalTrades}</span>
              </div>
              <p className="text-xs text-slate-400">Total Trades</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <Play className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold text-purple-400">{activeStrategies}</span>
              </div>
              <p className="text-xs text-slate-400">Active Strategies</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 rounded-lg p-4 border border-yellow-500/20">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">
                  {totalPnL > 0 ? ((totalPnL / totalCapital) * 100).toFixed(2) : '0.00'}%
                </span>
              </div>
              <p className="text-xs text-slate-400">Total Return</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Settings */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <span>Settings</span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Total Capital: ${totalCapital.toLocaleString()}
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="100000"
                      step="1000"
                      value={totalCapital}
                      onChange={(e) => setTotalCapital(Number(e.target.value))}
                      className="w-full"
                      aria-label="Total capital"
                      title="Total capital"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Risk Per Trade: {riskPerTrade}%
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={riskPerTrade}
                      onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                      className="w-full"
                      aria-label="Risk per trade percentage"
                      title="Risk per trade percentage"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-600">
                    <h4 className="text-sm font-semibold text-white mb-3">Allocation Summary</h4>
                    <div className="space-y-2">
                      {copiedStrategies.map((strategy) => (
                        <div key={strategy.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 truncate">{strategy.name}</span>
                          <span className="text-white font-semibold">{strategy.allocationPercent}%</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-600 mt-2">
                        <span className="text-slate-400">Available</span>
                        <span className="text-blue-400 font-semibold">
                          {100 - copiedStrategies.reduce((sum, s) => sum + s.allocationPercent, 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-sm font-semibold text-white mb-3">Quick Stats</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Win Rate</span>
                    <span className="text-green-400 font-semibold">
                      {(copiedStrategies.reduce((sum, s) => sum + s.winRate, 0) / copiedStrategies.length).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Capital</span>
                    <span className="text-blue-400 font-semibold">
                      ${((copiedStrategies.filter((s) => s.isActive).reduce((sum, s) => sum + s.allocationPercent, 0) / 100) * totalCapital).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Risk</span>
                    <span className="text-yellow-400 font-semibold">
                      ${((totalCapital * riskPerTrade) / 100).toFixed(2)}/trade
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Strategy List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Copy className="w-5 h-5 text-blue-400" />
                  <span>Copied Strategies</span>
                </h3>

                <div className="space-y-3">
                  {copiedStrategies.map((strategy) => (
                    <div
                      key={strategy.id}
                      className="bg-slate-800/50 rounded-lg p-4 border border-slate-600 hover:border-blue-500/50 transition-all"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-white">{strategy.name}</h4>
                            {strategy.isActive ? (
                              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-xs text-green-300 flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-500/20 border border-gray-500/30 rounded-full text-xs text-gray-300 flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                                <span>Paused</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">Copied {new Date(strategy.copiedAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => handleToggleActive(strategy.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            strategy.isActive
                              ? 'text-green-400 hover:bg-green-500/20'
                              : 'text-slate-400 hover:bg-slate-600'
                          }`}
                          title={strategy.isActive ? 'Pause copying' : 'Resume copying'}
                        >
                          {strategy.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Allocation</p>
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={strategy.allocationPercent}
                              onChange={(e) => handleUpdateAllocation(strategy.id, Number(e.target.value))}
                              className="flex-1"
                              aria-label={`Allocation for ${strategy.name}`}
                              title={`Allocation for ${strategy.name}`}
                            />
                            <span className="text-sm font-semibold text-blue-400 w-12 text-right">
                              {strategy.allocationPercent}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Trades</p>
                          <p className="text-sm font-semibold text-white">{strategy.tradesCopied}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">P&L</p>
                          <p className={`text-sm font-semibold ${strategy.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {strategy.totalPnL >= 0 ? '+' : ''}${strategy.totalPnL.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                          <p className="text-sm font-semibold text-yellow-400">{strategy.winRate}%</p>
                        </div>
                      </div>

                      {/* Last Trade */}
                      {strategy.lastTrade && (
                        <div className="bg-slate-900/50 rounded p-3 border border-slate-600/50">
                          <p className="text-xs text-slate-400 mb-2">Last Copied Trade</p>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-white">{strategy.lastTrade.symbol}</span>
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  strategy.lastTrade.direction === 'LONG'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {strategy.lastTrade.direction}
                              </span>
                            </div>
                            <span className="text-slate-400">
                              {new Date(strategy.lastTrade.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-2 text-xs">
                            <span className="text-slate-400">
                              Size: <span className="text-white font-semibold">{strategy.lastTrade.size}</span>
                            </span>
                            <span className="text-slate-400">
                              Entry: <span className="text-white font-semibold">${strategy.lastTrade.entry.toLocaleString()}</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* P&L Chart */}
              <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                <h3 className="text-lg font-semibold text-white mb-4">P&L Over Time</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={pnlHistory}>
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
                      dataKey="pnl"
                      stroke={totalPnL >= 0 ? '#10b981' : '#ef4444'}
                      fill={totalPnL >= 0 ? '#10b981' : '#ef4444'}
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
