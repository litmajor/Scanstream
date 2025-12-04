import { useState } from 'react';
import { Zap, BarChart3, TrendingUp, Settings, X } from 'lucide-react';
import BounceStrategyCard from './BounceStrategyCard';
import BounceBacktestComponent from './BounceBacktestComponent';

type ViewMode = 'card' | 'backtest' | 'comparison';

interface BounceStrategyDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BounceStrategyDashboard({ isOpen, onClose }: BounceStrategyDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Enhanced Bounce Strategy</h2>
              <p className="text-sm text-gray-500">Multi-timeframe zone detection with Bayesian confidence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 flex gap-4">
          <button
            onClick={() => setViewMode('card')}
            className={`py-4 px-4 border-b-2 font-medium transition-colors ${
              viewMode === 'card'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Execute Strategy
            </div>
          </button>
          <button
            onClick={() => setViewMode('backtest')}
            className={`py-4 px-4 border-b-2 font-medium transition-colors ${
              viewMode === 'backtest'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Backtest
            </div>
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`py-4 px-4 border-b-2 font-medium transition-colors ${
              viewMode === 'comparison'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Strategy Comparison
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === 'card' && (
            <div className="space-y-4">
              {/* Symbol and Timeframe Controls */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    <option>BTC/USDT</option>
                    <option>ETH/USDT</option>
                    <option>SOL/USDT</option>
                    <option>ADA/USDT</option>
                    <option>XRP/USDT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
                  <select
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium"
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
              </div>

              {/* Strategy Card */}
              <BounceStrategyCard
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                onExecute={(symbol, timeframe) => {
                  console.log(`Executed ${symbol} on ${timeframe}`);
                }}
              />
            </div>
          )}

          {viewMode === 'backtest' && <BounceBacktestComponent onClose={() => setViewMode('card')} />}

          {viewMode === 'comparison' && (
            <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
              <div className="max-w-md mx-auto">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Strategy Comparison</h3>
                <p className="text-gray-600 mb-4">
                  Compare the Enhanced Bounce Strategy performance against other strategies
                </p>
                <div className="space-y-2 text-sm text-gray-600 text-left">
                  <p>✓ Win Rate Comparison</p>
                  <p>✓ Sharpe Ratio Analysis</p>
                  <p>✓ Drawdown Comparison</p>
                  <p>✓ Return Distribution</p>
                </div>
                <button className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700">
                  Load Comparison Data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <p className="text-gray-600">Win Rate</p>
              <p className="font-bold text-green-600">72%</p>
            </div>
            <div>
              <p className="text-gray-600">Sharpe Ratio</p>
              <p className="font-bold text-blue-600">1.9</p>
            </div>
            <div>
              <p className="text-gray-600">Avg Return</p>
              <p className="font-bold text-orange-600">3.2%</p>
            </div>
            <div>
              <p className="text-gray-600">Max Drawdown</p>
              <p className="font-bold text-red-600">-8.3%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
