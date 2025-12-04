import { useState } from 'react';
import { Zap, TrendingUp, BarChart3, Eye, Play } from 'lucide-react';
import BounceStrategyDashboard from './BounceStrategyDashboard';

interface StrategyMetadata {
  id: string;
  name: string;
  description: string;
  type: string;
  performance: {
    winRate: number;
    avgReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  isActive: boolean;
}

export default function StrategyListWithBounce() {
  const [bounceModalOpen, setBounceModalOpen] = useState(false);
  const [strategies, setStrategies] = useState<StrategyMetadata[]>([
    {
      id: 'gradient_trend_filter',
      name: 'Gradient Trend Filter',
      description: 'Advanced trend-following strategy using gradient analysis',
      type: 'Trend Following',
      performance: { winRate: 68, avgReturn: 4.2, sharpeRatio: 1.8, maxDrawdown: -12.5 },
      isActive: true,
    },
    {
      id: 'ut_bot',
      name: 'UT Bot Strategy',
      description: 'ATR-based trailing stop system for capturing trends',
      type: 'Trend Following',
      performance: { winRate: 62, avgReturn: 3.8, sharpeRatio: 1.6, maxDrawdown: -15.2 },
      isActive: true,
    },
    {
      id: 'mean_reversion',
      name: 'Mean Reversion Engine',
      description: 'Multi-indicator reversal system combining Bollinger Bands and RSI',
      type: 'Mean Reversion',
      performance: { winRate: 72, avgReturn: 2.9, sharpeRatio: 1.4, maxDrawdown: -9.8 },
      isActive: true,
    },
    {
      id: 'volume_profile',
      name: 'Volume Profile Engine',
      description: 'Order flow and volume profile analysis for high-probability zones',
      type: 'Volume Analysis',
      performance: { winRate: 65, avgReturn: 3.5, sharpeRatio: 1.5, maxDrawdown: -11.3 },
      isActive: true,
    },
    {
      id: 'market_structure',
      name: 'Market Structure Engine',
      description: 'Price action analysis using market structure breaks',
      type: 'Price Action',
      performance: { winRate: 70, avgReturn: 4.0, sharpeRatio: 1.7, maxDrawdown: -10.5 },
      isActive: true,
    },
    {
      id: 'enhanced_bounce',
      name: 'Enhanced Bounce Strategy',
      description: 'Multi-timeframe support/resistance bounce detection with Bayesian confidence',
      type: 'Support/Resistance',
      performance: { winRate: 72, avgReturn: 3.2, sharpeRatio: 1.9, maxDrawdown: -8.3 },
      isActive: true,
    },
  ]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Trend Following':
        return 'bg-blue-100 text-blue-700';
      case 'Mean Reversion':
        return 'bg-orange-100 text-orange-700';
      case 'Volume Analysis':
        return 'bg-green-100 text-green-700';
      case 'Price Action':
        return 'bg-purple-100 text-purple-700';
      case 'Support/Resistance':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const isBounce = (id: string) => id === 'enhanced_bounce';

  return (
    <>
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
          <h2 className="text-2xl font-bold mb-2">Available Strategies</h2>
          <p className="text-gray-300">Select a strategy to execute or view detailed analysis</p>
        </div>

        {/* Strategy Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className={`border rounded-lg p-4 transition-all hover:shadow-lg ${
                isBounce(strategy.id)
                  ? 'border-pink-300 bg-gradient-to-br from-pink-50 to-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* NEW Badge for Bounce */}
              {isBounce(strategy.id) && (
                <div className="flex justify-end mb-2">
                  <span className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-full">
                    ✨ NEW
                  </span>
                </div>
              )}

              {/* Title */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{strategy.name}</h3>
                  <p className="text-sm text-gray-600">{strategy.description}</p>
                </div>
                {isBounce(strategy.id) && (
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <Zap className="w-5 h-5 text-pink-600" />
                  </div>
                )}
              </div>

              {/* Type Badge */}
              <div className="mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(strategy.type)}`}>
                  {strategy.type}
                </span>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-white rounded p-2 text-center border border-gray-200">
                  <p className="text-xs text-gray-600">WR</p>
                  <p className="font-bold text-sm text-green-600">{strategy.performance.winRate}%</p>
                </div>
                <div className="bg-white rounded p-2 text-center border border-gray-200">
                  <p className="text-xs text-gray-600">Avg Ret</p>
                  <p className="font-bold text-sm text-blue-600">{strategy.performance.avgReturn}%</p>
                </div>
                <div className="bg-white rounded p-2 text-center border border-gray-200">
                  <p className="text-xs text-gray-600">Sharpe</p>
                  <p className="font-bold text-sm text-orange-600">{strategy.performance.sharpeRatio.toFixed(1)}</p>
                </div>
                <div className="bg-white rounded p-2 text-center border border-gray-200">
                  <p className="text-xs text-gray-600">MDD</p>
                  <p className="font-bold text-sm text-red-600">{strategy.performance.maxDrawdown}%</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {isBounce(strategy.id) ? (
                  <>
                    <button
                      onClick={() => setBounceModalOpen(true)}
                      className="flex-1 py-2 px-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Play className="w-4 h-4" />
                      Launch
                    </button>
                    <button
                      onClick={() => setBounceModalOpen(true)}
                      className="flex-1 py-2 px-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Backtest
                    </button>
                  </>
                ) : (
                  <>
                    <button className="flex-1 py-2 px-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2 text-sm">
                      <Play className="w-4 h-4" />
                      Execute
                    </button>
                    <button className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm">
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </>
                )}
              </div>

              {/* Bounce Special Features */}
              {isBounce(strategy.id) && (
                <div className="mt-4 pt-4 border-t border-pink-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Key Features:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>✓ 7-timeframe multi-level analysis</li>
                    <li>✓ Volume-weighted zone detection</li>
                    <li>✓ Bayesian confidence scoring</li>
                    <li>✓ TradingView-inspired fractal pivots</li>
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="bg-gray-50 border-t border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Strategy Overview</h3>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {strategies.map((s) => (
              <div key={s.id} className="text-center">
                <p className="text-xs text-gray-600 mb-1 truncate">{s.name.split(' ')[0]}</p>
                <div className="flex justify-center gap-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">SR</p>
                    <p className={`font-bold text-sm ${
                      s.performance.sharpeRatio > 1.7 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {s.performance.sharpeRatio.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">WR</p>
                    <p className={`font-bold text-sm ${
                      s.performance.winRate > 70 ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {s.performance.winRate}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bounce Strategy Dashboard Modal */}
      <BounceStrategyDashboard isOpen={bounceModalOpen} onClose={() => setBounceModalOpen(false)} />
    </>
  );
}
