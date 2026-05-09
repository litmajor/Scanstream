/**
 * Consensus Dashboard Component
 * 
 * Comprehensive consensus visualization with:
 * - Main direction and agreement percentage
 * - Source agreement breakdown chart
 * - Dissent analysis
 * - Confidence trend
 * 
 * Used in: ScoutReportViewer (consensus view mode, full view)
 */

import React, { useMemo } from 'react';
import ConfidenceBar from './ConfidenceBar';
import type { ConsensusData, SourceType } from '../../types';

interface ConsensusDashboardProps {
  consensus: ConsensusData;
  className?: string;
}

export const ConsensusDashboard: React.FC<ConsensusDashboardProps> = ({ consensus, className }) => {
  // Calculate agreement breakdown
  const breakdown = useMemo(() => {
    const total = (consensus.bullishSources || 0) + (consensus.bearishSources || 0) + (consensus.neutralSources || 0);
    if (total === 0) return { bullish: 0, bearish: 0, neutral: 0 };

    return {
      bullish: ((consensus.bullishSources || 0) / total) * 100,
      bearish: ((consensus.bearishSources || 0) / total) * 100,
      neutral: ((consensus.neutralSources || 0) / total) * 100,
    };
  }, [consensus.bullishSources, consensus.bearishSources, consensus.neutralSources]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Consensus Direction */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-6 border-2 border-slate-200">
        <p className="text-sm font-semibold text-gray-600 mb-3">PRIMARY CONSENSUS</p>
        <div className="flex items-center justify-between">
          <div>
            <div
              className={`
                inline-block px-4 py-2 rounded-full text-lg font-bold
                ${consensus.direction === 'BUY' ? 'bg-green-100 text-green-800' : ''}
                ${consensus.direction === 'SELL' ? 'bg-red-100 text-red-800' : ''}
                ${consensus.direction === 'HOLD' ? 'bg-gray-100 text-gray-800' : ''}
              `}
            >
              {consensus.direction === 'BUY' ? '📈 Buy' : ''}
              {consensus.direction === 'SELL' ? '📉 Sell' : ''}
              {consensus.direction === 'HOLD' ? '➡️ Hold' : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-slate-800">{Math.round(consensus.agreement * 100)}%</div>
            <p className="text-sm text-gray-600">Agreement</p>
          </div>
        </div>
      </div>

      {/* Source Agreement Breakdown */}
      <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Source Agreement Breakdown</h3>

        {/* Stacked Bar Chart */}
        <div className="mb-6">
          <div className="flex h-12 rounded-lg overflow-hidden border-2 border-gray-300 shadow-md">
            {breakdown.bullish > 0 && (
              <div className="bg-green-500 flex items-center justify-center text-white font-bold text-sm" style={{ width: `${breakdown.bullish}%` }}>
                {breakdown.bullish > 10 && `${breakdown.bullish.toFixed(0)}%`}
              </div>
            )}
            {breakdown.neutral > 0 && (
              <div className="bg-gray-400 flex items-center justify-center text-white font-bold text-sm" style={{ width: `${breakdown.neutral}%` }}>
                {breakdown.neutral > 10 && `${breakdown.neutral.toFixed(0)}%`}
              </div>
            )}
            {breakdown.bearish > 0 && (
              <div className="bg-red-500 flex items-center justify-center text-white font-bold text-sm" style={{ width: `${breakdown.bearish}%` }}>
                {breakdown.bearish > 10 && `${breakdown.bearish.toFixed(0)}%`}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-4 h-4 bg-green-500 rounded mx-auto mb-2"></div>
            <p className="text-sm font-semibold text-gray-700">Bullish</p>
            <p className="text-lg font-bold text-green-600">{consensus.bullishSources || 0}</p>
          </div>
          <div className="text-center">
            <div className="w-4 h-4 bg-gray-400 rounded mx-auto mb-2"></div>
            <p className="text-sm font-semibold text-gray-700">Neutral</p>
            <p className="text-lg font-bold text-gray-600">{consensus.neutralSources || 0}</p>
          </div>
          <div className="text-center">
            <div className="w-4 h-4 bg-red-500 rounded mx-auto mb-2"></div>
            <p className="text-sm font-semibold text-gray-700">Bearish</p>
            <p className="text-lg font-bold text-red-600">{consensus.bearishSources || 0}</p>
          </div>
        </div>
      </div>

      {/* Source Details Table */}
      <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Source Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-300">
              <tr className="text-gray-700">
                <th className="text-left py-2">Source</th>
                <th className="text-center py-2">Signal</th>
                <th className="text-center py-2">Confidence</th>
                <th className="text-center py-2">Agreement</th>
              </tr>
            </thead>
            <tbody>
              {consensus.sourceDetails?.map((detail: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-800">{detail.source}</td>
                  <td className="py-3 text-center">
                    <span
                      className={`
                        inline-block px-2 py-1 rounded text-xs font-bold
                        ${detail.direction === 'BUY' ? 'bg-green-100 text-green-700' : ''}
                        ${detail.direction === 'SELL' ? 'bg-red-100 text-red-700' : ''}
                        ${detail.direction === 'HOLD' ? 'bg-gray-100 text-gray-700' : ''}
                      `}
                    >
                      {detail.direction === 'BUY' ? '📈 Buy' : detail.direction === 'SELL' ? '📉 Sell' : '➡️ Hold'}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-semibold text-gray-800">{Math.round(detail.confidence * 100)}%</span>
                  </td>
                  <td className="py-3 text-center">
                    {detail.agreesWithConsensus ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dissent Analysis */}
      {consensus.dissentingSources && consensus.dissentingSources.length > 0 && (
        <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
          <h3 className="text-lg font-bold text-yellow-900 mb-4">⚠️ Dissenting Sources</h3>
          <p className="text-yellow-800 mb-4">
            {consensus.dissentingSources.length} source{consensus.dissentingSources.length !== 1 ? 's' : ''} disagree with primary consensus:
          </p>
          <div className="space-y-2">
            {consensus.dissentingSources.map((source: string, idx: number) => (
              <div key={idx} className="bg-yellow-100 rounded p-3 border border-yellow-400">
                <p className="font-semibold text-yellow-900">{source}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Trend */}
      {consensus.confidenceTrend !== undefined && (
        <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-300">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Confidence Trend</h3>
          <ConfidenceBar
            value={consensus.agreement * 100}
            label="Current Consensus Strength"
            showPercentage
            size="lg"
          />
          <div className="mt-4 text-blue-800">
            <span className={consensus.confidenceTrend.direction === 'increasing' ? 'text-green-600' : 'text-red-600'}>
              {consensus.confidenceTrend.direction === 'increasing' ? '↑' : '↓'} {Math.max(consensus.confidenceTrend.previous1h, consensus.confidenceTrend.previous4h).toFixed(1)}%
            </span>
            <span className="text-blue-800"> from previous scan</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsensusDashboard;
