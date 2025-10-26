import { X, TrendingUp, TrendingDown, BarChart3, DollarSign, Target, Shield, Activity } from 'lucide-react';

interface SymbolDetailModalProps {
  signal: any;
  onClose: () => void;
}

export function SymbolDetailModal({ signal, onClose }: SymbolDetailModalProps) {
  if (!signal) return null;

  const opportunityScore = (signal as any).opportunity_score || signal.advanced?.opportunity_score || 0;
  const marketRegime = (signal as any).market_regime || signal.advanced?.market_regime;
  const slTp = (signal as any).sl_tp || signal.risk_reward;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{signal.symbol}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{signal.exchange} · {signal.timeframe || '1h'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close modal"
            title="Close"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Price & Signal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Price</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${signal.price?.toLocaleString() || 'N/A'}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {signal.change > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm text-gray-600 dark:text-gray-400">24h Change</span>
              </div>
              <p className={`text-2xl font-bold ${signal.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {signal.change > 0 ? '+' : ''}{signal.change?.toFixed(2)}%
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Signal</span>
              </div>
              <p className={`text-2xl font-bold ${
                signal.signal === 'BUY' ? 'text-green-600' : 
                signal.signal === 'SELL' ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {signal.signal}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Strength</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {signal.strength}%
              </p>
            </div>
          </div>

          {/* Opportunity Score */}
          {opportunityScore > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Opportunity Score</h3>
                <span className={`text-3xl font-bold ${
                  opportunityScore >= 80 ? 'text-green-600' :
                  opportunityScore >= 60 ? 'text-blue-600' :
                  'text-orange-600'
                }`}>
                  {opportunityScore.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    opportunityScore >= 80 ? 'bg-green-600' :
                    opportunityScore >= 60 ? 'bg-blue-600' :
                    'bg-orange-600'
                  }`}
                  style={{ width: `${opportunityScore}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Market Regime */}
          {marketRegime && (
            <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Market Regime</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Regime</p>
                  <p className={`text-lg font-bold capitalize ${
                    marketRegime.regime === 'bull' ? 'text-green-600' :
                    marketRegime.regime === 'bear' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {marketRegime.regime}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Confidence</p>
                  <p className="text-lg font-bold text-blue-600">
                    {(marketRegime.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Volatility</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {marketRegime.volatility}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stop Loss / Take Profit */}
          {slTp && (
            <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trade Plan</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Entry</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    ${(slTp.entry_price || signal.price)?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Stop Loss</span>
                  </div>
                  <p className="text-lg font-bold text-red-600">
                    ${(slTp.stop_loss || slTp.stopLoss)?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Take Profit</span>
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    ${(slTp.take_profit || slTp.takeProfit)?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">R:R Ratio</span>
                  </div>
                  <p className="text-lg font-bold text-purple-600">
                    1:{(slTp.risk_reward_ratio || slTp.riskReward || 0).toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Technical Indicators */}
          <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Technical Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">RSI</p>
                <p className={`text-lg font-bold ${
                  signal.indicators?.rsi > 70 ? 'text-red-600' :
                  signal.indicators?.rsi < 30 ? 'text-green-600' :
                  'text-gray-900 dark:text-white'
                }`}>
                  {signal.indicators?.rsi?.toFixed(1) || signal.rsi?.toFixed(1) || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">MACD</p>
                <p className="text-lg font-bold capitalize text-gray-900 dark:text-white">
                  {signal.indicators?.macd || signal.macd || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Volume</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {signal.volume ? `${(signal.volume / 1000000).toFixed(2)}M` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                <p className={`text-lg font-bold capitalize ${
                  (signal as any).status === 'complete' ? 'text-green-600' :
                  (signal as any).status === 'analyzing' ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  {(signal as any).status || 'quick_scan'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <a
              href={`https://www.tradingview.com/chart/?symbol=${signal.exchange?.toUpperCase()}:${signal.symbol.replace('/', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium text-center transition-colors"
            >
              View on TradingView
            </a>
            <button
              onClick={onClose}
              className="px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

