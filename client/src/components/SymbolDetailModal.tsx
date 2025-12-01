import { X, TrendingUp, TrendingDown, BarChart3, DollarSign, Target, Shield, Activity, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface SymbolDetailModalProps {
  signal: any;
  onClose: () => void;
}

export function SymbolDetailModal({ signal, onClose }: SymbolDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'flow' | 'analysis'>('overview');
  if (!signal) return null;

  const opportunityScore = (signal as any).opportunity_score || signal.advanced?.opportunity_score || 0;
  const marketRegime = (signal as any).market_regime || signal.advanced?.market_regime;
  const slTp = (signal as any).sl_tp || signal.risk_reward;
  
  // Extract indicator values from reasoning or direct properties
  const getIndicatorValue = (field: string) => {
    // Check direct properties first
    if (signal[field] !== undefined) return signal[field];
    
    // Check indicators object
    if (signal.indicators?.[field] !== undefined) return signal.indicators[field];
    
    // Try to parse from reasoning array
    if (Array.isArray(signal.reasoning)) {
      const reasoningStr = signal.reasoning.find((r: any) => 
        String(r).toLowerCase().includes(field.toLowerCase())
      );
      if (reasoningStr) {
        const match = String(reasoningStr).match(/[\d.]+/);
        return match ? parseFloat(match[0]) : undefined;
      }
    }
    
    return undefined;
  };

  const rsiValue = getIndicatorValue('rsi');
  const macdValue = getIndicatorValue('macd');
  const volumeValue = signal.volume || getIndicatorValue('volume');
  const avgVolumeValue = signal.averageVolume || getIndicatorValue('averageVolume') || getIndicatorValue('avgVolume')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-10">
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

        {/* Tabs */}
        <div className="sticky top-[72px] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex gap-0 z-10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('technical')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'technical'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Technical
          </button>
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'flow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Flow & Cluster
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Analysis
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
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
            </div>
          )}

          {/* TECHNICAL TAB */}
          {activeTab === 'technical' && (
            <div className="space-y-6">
          {/* Technical Indicators */}
          <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Technical Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">RSI (14)</p>
                <p className={`text-lg font-bold ${
                  rsiValue > 70 ? 'text-red-600' :
                  rsiValue < 30 ? 'text-green-600' :
                  'text-gray-900 dark:text-white'
                }`}>
                  {rsiValue ? rsiValue.toFixed(1) : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {rsiValue > 70 ? 'Overbought' : rsiValue < 30 ? 'Oversold' : 'Neutral'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">MACD</p>
                <p className="text-lg font-bold capitalize text-gray-900 dark:text-white">
                  {macdValue || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Volume Profile</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {volumeValue ? `${(volumeValue / 1000000).toFixed(2)}M` : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Current
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Volume</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  ${avgVolumeValue ? (avgVolumeValue / 1000000).toFixed(2) : '0.00'}M
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {volumeValue && avgVolumeValue && volumeValue > avgVolumeValue ? '📈 Above Average' : '📉 Below Average'}
                </p>
              </div>
            </div>
          </div>
            </div>
          )}

          {/* FLOW & CLUSTERING TAB */}
          {activeTab === 'flow' && (
            <div className="space-y-6">
          {/* Flow Engine Stats */}
          {(signal.flowMetrics || signal.orderFlow || signal.microstructure || signal.toxicity !== undefined) && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-5 rounded-lg border border-cyan-200 dark:border-cyan-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Flow Engine Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {signal.flowMetrics?.buyVolume !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Buy Volume</p>
                    <p className="text-lg font-bold text-green-600">{(signal.flowMetrics.buyVolume / 1000000).toFixed(2)}M</p>
                  </div>
                )}
                {signal.flowMetrics?.sellVolume !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sell Volume</p>
                    <p className="text-lg font-bold text-red-600">{(signal.flowMetrics.sellVolume / 1000000).toFixed(2)}M</p>
                  </div>
                )}
                {signal.flowMetrics?.ratio !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Flow Ratio</p>
                    <p className="text-lg font-bold text-blue-600">{signal.flowMetrics.ratio.toFixed(2)}</p>
                  </div>
                )}
                {signal.toxicity !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-cyan-200 dark:border-cyan-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Toxicity</p>
                    <p className={`text-lg font-bold ${signal.toxicity > 0.7 ? 'text-red-600' : signal.toxicity > 0.4 ? 'text-orange-600' : 'text-green-600'}`}>
                      {(signal.toxicity * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clustering Analysis */}
          {(signal.clustering || signal.cluster !== undefined || signal.clusterLabel) && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-5 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Clustering Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {signal.clustering?.cluster !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cluster</p>
                    <p className="text-lg font-bold text-purple-600">{signal.clustering.cluster}</p>
                  </div>
                )}
                {signal.clustering?.silhouette !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Silhouette Score</p>
                    <p className={`text-lg font-bold ${signal.clustering.silhouette > 0.5 ? 'text-green-600' : signal.clustering.silhouette > 0.3 ? 'text-blue-600' : 'text-yellow-600'}`}>
                      {signal.clustering.silhouette.toFixed(3)}
                    </p>
                  </div>
                )}
                {signal.clustering?.distance !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Distance</p>
                    <p className="text-lg font-bold text-pink-600">{signal.clustering.distance.toFixed(4)}</p>
                  </div>
                )}
                {signal.clustering?.members !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cluster Members</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{signal.clustering.members}</p>
                  </div>
                )}
                {signal.clustering?.centroidDistance !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Centroid Dist</p>
                    <p className="text-lg font-bold text-indigo-600">{signal.clustering.centroidDistance.toFixed(4)}</p>
                  </div>
                )}
                {signal.clustering?.density !== undefined && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border border-purple-200 dark:border-purple-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Density</p>
                    <p className="text-lg font-bold text-violet-600">{signal.clustering.density.toFixed(3)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
            </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === 'analysis' && (
            <div className="space-y-6">
          {/* Signal Reasoning */}
          {(signal.reasoning || signal.momentumLabel || signal.regimeState) && (
            <div className="bg-gray-50 dark:bg-gray-700 p-5 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Signal Analysis</h3>
              <div className="space-y-3">
                {signal.momentumLabel && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Momentum</span>
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">{signal.momentumLabel}</span>
                  </div>
                )}
                {signal.regimeState && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Market Regime</span>
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">{signal.regimeState}</span>
                  </div>
                )}
                {signal.legacyLabel && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Signal Type</span>
                    <span className="font-semibold text-gray-900 dark:text-white capitalize">{signal.legacyLabel}</span>
                  </div>
                )}
                {signal.signalStrengthScore !== undefined && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Strength Score</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{signal.signalStrengthScore.toFixed(2)}</span>
                  </div>
                )}
                {Array.isArray(signal.reasoning) && signal.reasoning.length > 0 && (
                  <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Details</p>
                    <ul className="space-y-1 text-sm text-gray-900 dark:text-gray-300">
                      {signal.reasoning.map((reason: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-gray-400 mt-0.5">•</span>
                          <span>{String(reason)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
            </div>
          )}

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

