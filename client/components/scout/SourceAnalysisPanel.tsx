/**
 * Source Analysis Panel Component
 * 
 * Tabbed interface showing detailed analysis from each source:
 * - ML: Timeframe breakdown, indicators, predictions
 * - Scanner: Patterns, support/resistance, volume
 * - Agents: Agent signals, track records, reasoning
 * - Price Action: Current price, momentum, volume trend
 * 
 * Used in: ScoutReportViewer (sources view mode)
 */

import React, { useState } from 'react';
import ConfidenceBar from './ConfidenceBar';
import SourceIcon from './SourceIcon';
import type {
  MLSourceAnalysis,
  ScannerSourceAnalysis,
  AgentSourceAnalysis,
  PriceActionAnalysis,
  TimeframeSignal,
} from '../../types/scout-report-types';

interface SourceAnalysisPanelProps {
  ml?: MLSourceAnalysis;
  scanner?: ScannerSourceAnalysis;
  agents?: AgentSourceAnalysis;
  priceAction?: PriceActionAnalysis;
  className?: string;
}

type TabType = 'ml' | 'scanner' | 'agents' | 'price';

export const SourceAnalysisPanel: React.FC<SourceAnalysisPanelProps> = ({
  ml,
  scanner,
  agents,
  priceAction,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ml');

  return (
    <div className={`bg-white rounded-lg border-2 border-gray-200 ${className}`}>
      {/* Tab Navigation */}
      <div className="flex border-b-2 border-gray-200">
        {ml && (
          <button
            onClick={() => setActiveTab('ml')}
            title="ML Analysis"
            className={`
              flex-1 px-4 py-3 text-sm font-semibold transition-colors border-b-2
              ${
                activeTab === 'ml'
                  ? 'text-purple-700 border-purple-500 bg-purple-50'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }
            `}
          >
            <SourceIcon source="ML" showLabel size="sm" />
          </button>
        )}
        {scanner && (
          <button
            onClick={() => setActiveTab('scanner')}
            title="Scanner Analysis"
            className={`
              flex-1 px-4 py-3 text-sm font-semibold transition-colors border-b-2
              ${
                activeTab === 'scanner'
                  ? 'text-blue-700 border-blue-500 bg-blue-50'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }
            `}
          >
            <SourceIcon source="SCANNER" showLabel size="sm" />
          </button>
        )}
        {agents && (
          <button
            onClick={() => setActiveTab('agents')}
            title="Agent Analysis"
            className={`
              flex-1 px-4 py-3 text-sm font-semibold transition-colors border-b-2
              ${
                activeTab === 'agents'
                  ? 'text-amber-700 border-amber-500 bg-amber-50'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }
            `}
          >
            <SourceIcon source="AGENTS" showLabel size="sm" />
          </button>
        )}
        {priceAction && (
          <button
            onClick={() => setActiveTab('price')}
            title="Price Action Analysis"
            className={`
              flex-1 px-4 py-3 text-sm font-semibold transition-colors border-b-2
              ${
                activeTab === 'price'
                  ? 'text-green-700 border-green-500 bg-green-50'
                  : 'text-gray-600 border-transparent hover:bg-gray-50'
              }
            `}
          >
            <SourceIcon source="PRICE_ACTION" showLabel size="sm" />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* ML Tab */}
        {activeTab === 'ml' && ml && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Multi-Timeframe Analysis</h3>

              {/* Timeframe Breakdown */}
              <div className="space-y-4">
                {ml.timeframes?.map((tf: TimeframeSignal, idx: number) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-gray-800">{tf.timeframe}</div>
                      <div
                        className={`
                          px-3 py-1 rounded-full text-sm font-semibold
                          ${tf.direction === 'BUY' ? 'bg-green-100 text-green-700' : ''}
                          ${tf.direction === 'SELL' ? 'bg-red-100 text-red-700' : ''}
                          ${tf.direction === 'HOLD' ? 'bg-gray-100 text-gray-700' : ''}
                        `}
                      >
                        {tf.direction === 'BUY' ? '📈 Buy' : tf.direction === 'SELL' ? '📉 Sell' : '➡️ Hold'}
                      </div>
                    </div>
                    <ConfidenceBar value={tf.confidence * 100} label="Confidence" showPercentage size="md" />
                    {tf.predictedMove && (
                      <div className="mt-3 text-sm text-gray-700">
                        <strong>Predicted Move:</strong> {tf.predictedMove.toFixed(2)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Top Indicators */}
              {ml.topIndicators && ml.topIndicators.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3">Top Indicators by Impact</h4>
                  <div className="space-y-2">
                    {ml.topIndicators.map((ind: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{ind.name}</span>
                        <span className="font-semibold text-blue-600">{(ind.impact * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Position Sizing */}
              {ml.positionSizingRecommendation && (
                <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <h4 className="font-semibold text-blue-900 mb-2">Position Sizing Recommendation</h4>
                  <p className="text-blue-800 text-sm">{ml.positionSizingRecommendation.reasoning}</p>
                  <p className="text-blue-800 text-sm mt-2"><strong>Multiplier:</strong> {ml.positionSizingRecommendation.multiplier}x</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scanner Tab */}
        {activeTab === 'scanner' && scanner && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Technical Pattern Analysis</h3>

              {/* Primary Pattern */}
              {scanner.primaryPattern && (
                <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500 mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Primary Pattern</h4>
                  <p className="text-blue-800 text-sm mb-2">{scanner.primaryPattern.name}</p>
                  <div className="text-xs text-blue-700">
                    <strong>Confluence Score:</strong> {scanner.primaryPattern.confluenceScore?.toFixed(1)}/10
                  </div>
                </div>
              )}

              {/* Support/Resistance */}
              {(scanner.levels?.support || scanner.levels?.resistance) && (
                <div className="grid grid-cols-2 gap-4">
                  {scanner.levels?.support && scanner.levels.support.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-300">
                      <h4 className="font-semibold text-green-900 mb-3">Support Levels</h4>
                      <div className="space-y-2">
                        {scanner.levels.support.map((level: any, idx: number) => (
                          <div key={idx} className="text-sm text-green-800">
                            <strong>S{idx + 1}:</strong> {level.price.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {scanner.levels?.resistance && scanner.levels.resistance.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-300">
                      <h4 className="font-semibold text-red-900 mb-3">Resistance Levels</h4>
                      <div className="space-y-2">
                        {scanner.levels.resistance.map((level: any, idx: number) => (
                          <div key={idx} className="text-sm text-red-800">
                            <strong>R{idx + 1}:</strong> {level.price.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Volume Analysis */}
              {scanner.volumeAnalysis && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-300">
                  <h4 className="font-semibold text-gray-800 mb-2">Volume Analysis</h4>
                  <p className="text-sm text-gray-700">{scanner.volumeAnalysis.conclusion}</p>
                  <div className="text-xs text-gray-600 mt-2">
                    <strong>Trend:</strong> {scanner.volumeAnalysis.trend} ({scanner.volumeAnalysis.volumePercent.toFixed(0)}%)
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && agents && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Agent Signals & Consensus</h3>

              {/* Agent List */}
              {agents.agentSignals && agents.agentSignals.length > 0 && (
                <div className="space-y-3 mb-6">
                  {agents.agentSignals.map((agent: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800">{agent.agentName}</span>
                        <span
                          className={`
                            px-2 py-1 rounded text-xs font-bold
                            ${agent.direction === 'BULLISH' ? 'bg-green-100 text-green-700' : ''}
                            ${agent.direction === 'BEARISH' ? 'bg-red-100 text-red-700' : ''}
                            ${agent.direction === 'NEUTRAL' ? 'bg-gray-100 text-gray-700' : ''}
                          `}
                        >
                          {agent.direction}
                        </span>
                      </div>
                      <ConfidenceBar value={agent.confidence * 100} showPercentage size="sm" />
                      {agent.trackRecord && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span>Win Rate: {(agent.trackRecord.winRate * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Consensus */}
              {(agents as any).consensusDirection && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                  <h4 className="font-semibold text-amber-900 mb-2">Overall Agent Consensus</h4>
                  <p className="text-amber-800 text-sm">{(agents as any).consensusDirection}</p>
                  {(agents as any).agreementPercentage !== undefined && (
                    <div className="mt-2 text-xs text-amber-700">
                      <strong>Agreement:</strong> {(((agents as any).agreementPercentage || 0) * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price Action Tab */}
        {activeTab === 'price' && priceAction && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Price Action Analysis</h3>

              {/* Current Price */}
              {priceAction.currentPrice !== undefined && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border-2 border-green-300 mb-4">
                  <div className="text-sm text-gray-600 mb-1">Current Price</div>
                  <div className="text-3xl font-bold text-green-900">{priceAction.currentPrice.toFixed(2)}</div>
                </div>
              )}

              {/* Recent Highs/Lows */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {priceAction.recentHigh !== undefined && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-300">
                    <div className="text-xs text-red-600 mb-1">Recent High</div>
                    <div className="text-lg font-bold text-red-900">{priceAction.recentHigh.toFixed(2)}</div>
                  </div>
                )}
                {priceAction.recentLow !== undefined && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-300">
                    <div className="text-xs text-green-600 mb-1">Recent Low</div>
                    <div className="text-lg font-bold text-green-900">{priceAction.recentLow.toFixed(2)}</div>
                  </div>
                )}
              </div>

              {/* Momentum */}
              {priceAction.momentum !== undefined && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-300 mb-4">
                  <div className="text-sm text-blue-600 mb-1">Momentum</div>
                  <div className={`text-lg font-bold ${(priceAction.momentum as any)?.score > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(priceAction.momentum as any)?.direction === 'up' ? '↑' : '↓'} {Math.abs(((priceAction.momentum as any)?.score || 0)).toFixed(2)}
                  </div>
                </div>
              )}

              {/* Volume Trend */}
              {(priceAction as any).volumeTrend && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-300">
                  <h4 className="font-semibold text-gray-800 mb-2">Volume Trend</h4>
                  <p className="text-sm text-gray-700">{(priceAction as any).volumeTrend}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceAnalysisPanel;
