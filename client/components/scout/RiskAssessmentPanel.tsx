/**
 * Risk Assessment Panel Component
 * 
 * Comprehensive risk analysis with:
 * - Key support/resistance levels
 * - Stop loss and take profit recommendations
 * - Risk metrics and constraints
 * - Overall risk gauge
 * 
 * Used in: ScoutReportViewer (risk view mode, full view)
 */

import React, { useMemo } from 'react';
import MetricCard from './MetricCard';
import type { RiskAssessment, RiskFactor } from '../../types/scout-report-types';

interface RiskAssessmentPanelProps {
  riskAssessment: RiskAssessment;
  currentPrice?: number;
  className?: string;
}

export const RiskAssessmentPanel: React.FC<RiskAssessmentPanelProps> = ({
  riskAssessment,
  currentPrice,
  className,
}) => {
  // Determine risk gauge color
  const getRiskGaugeColor = (score: number): string => {
    if (score <= 2) return 'text-green-600';
    if (score <= 4) return 'text-yellow-600';
    if (score <= 6) return 'text-orange-600';
    return 'text-red-600';
  };

  const getRiskGaugeBg = (score: number): string => {
    if (score <= 2) return 'bg-green-100 border-green-300';
    if (score <= 4) return 'bg-yellow-100 border-yellow-300';
    if (score <= 6) return 'bg-orange-100 border-orange-300';
    return 'bg-red-100 border-red-300';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Risk Gauge */}
      <div className={`rounded-lg p-6 border-2 ${getRiskGaugeBg(riskAssessment.overallRiskScore)}`}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">OVERALL RISK SCORE</h3>
        <div className="flex items-center gap-6">
          <div className={`text-6xl font-bold ${getRiskGaugeColor(riskAssessment.overallRiskScore)}`}>
            {riskAssessment.overallRiskScore.toFixed(1)}
          </div>
          <div className="flex-1">
            <div className="w-full bg-gray-300 rounded-full h-4">
              <div
                className={`
                  h-4 rounded-full transition-all
                  ${riskAssessment.overallRiskScore <= 2 ? 'bg-green-500' : ''}
                  ${riskAssessment.overallRiskScore > 2 && riskAssessment.overallRiskScore <= 4 ? 'bg-yellow-500' : ''}
                  ${riskAssessment.overallRiskScore > 4 && riskAssessment.overallRiskScore <= 6 ? 'bg-orange-500' : ''}
                  ${riskAssessment.overallRiskScore > 6 ? 'bg-red-500' : ''}
                `}
                style={{ width: `${(riskAssessment.overallRiskScore / 10) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {riskAssessment.riskLevel || 'Moderate'} Risk
            </p>
          </div>
        </div>
      </div>

      {/* Support and Resistance Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Support Levels */}
        <div className="bg-green-50 rounded-lg p-6 border-2 border-green-300">
          <h3 className="text-lg font-bold text-green-900 mb-4">📍 Support Levels</h3>
          {riskAssessment.supportLevels && riskAssessment.supportLevels.length > 0 ? (
            <div className="space-y-3">
              {riskAssessment.supportLevels.map((level, idx) => {
                const distance = currentPrice ? ((currentPrice - level) / currentPrice) * 100 : 0;
                return (
                  <div key={idx} className="bg-white rounded p-3 border border-green-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-green-900">S{idx + 1}</span>
                      <span className="font-semibold text-green-700">{level.toFixed(2)}</span>
                    </div>
                    {currentPrice && (
                      <div className="text-xs text-green-600">
                        {distance.toFixed(1)}% below current
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-green-700 text-sm">No support levels identified</p>
          )}
        </div>

        {/* Resistance Levels */}
        <div className="bg-red-50 rounded-lg p-6 border-2 border-red-300">
          <h3 className="text-lg font-bold text-red-900 mb-4">📍 Resistance Levels</h3>
          {riskAssessment.resistanceLevels && riskAssessment.resistanceLevels.length > 0 ? (
            <div className="space-y-3">
              {riskAssessment.resistanceLevels.map((level, idx) => {
                const distance = currentPrice ? ((level - currentPrice) / currentPrice) * 100 : 0;
                return (
                  <div key={idx} className="bg-white rounded p-3 border border-red-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-red-900">R{idx + 1}</span>
                      <span className="font-semibold text-red-700">{level.toFixed(2)}</span>
                    </div>
                    {currentPrice && (
                      <div className="text-xs text-red-600">
                        {distance.toFixed(1)}% above current
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-red-700 text-sm">No resistance levels identified</p>
          )}
        </div>
      </div>

      {/* Current Price Highlight */}
      {currentPrice && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-300">
          <div className="text-sm text-blue-600 font-medium mb-1">Current Price</div>
          <div className="text-3xl font-bold text-blue-900">{currentPrice.toFixed(2)}</div>
        </div>
      )}

      {/* Stop Loss and Take Profit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stop Loss */}
        {riskAssessment.recommendedStopLoss && (
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border-2 border-red-300">
            <h4 className="text-lg font-bold text-red-900 mb-4">🛑 Stop Loss</h4>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-red-600 font-medium">Recommended SL</div>
                <div className="text-2xl font-bold text-red-800">
                  {riskAssessment.recommendedStopLoss.toFixed(2)}
                </div>
              </div>
              {riskAssessment.recommendedStopLossPercent && (
                <div className="bg-red-200 rounded p-2">
                  <div className="text-xs text-red-700 font-medium">Risk %</div>
                  <div className="text-lg font-bold text-red-900">
                    {(riskAssessment.recommendedStopLossPercent * 100).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Take Profit */}
        {riskAssessment.recommendedTakeProfit && (
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-300">
            <h4 className="text-lg font-bold text-green-900 mb-4">🎯 Take Profit</h4>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-green-600 font-medium">Primary TP</div>
                <div className="text-2xl font-bold text-green-800">
                  {riskAssessment.recommendedTakeProfit.toFixed(2)}
                </div>
              </div>
              {riskAssessment.recommendedTakeProfitPercent && (
                <div className="bg-green-200 rounded p-2">
                  <div className="text-xs text-green-700 font-medium">Target %</div>
                  <div className="text-lg font-bold text-green-900">
                    {(riskAssessment.recommendedTakeProfitPercent * 100).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Risk Factors */}
      {riskAssessment.riskFactors && riskAssessment.riskFactors.length > 0 && (
        <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Risk Factors</h3>
          <div className="space-y-3">
            {riskAssessment.riskFactors.map((factor: RiskFactor, idx: number) => (
              <div
                key={idx}
                className="bg-gray-50 rounded p-4 border border-gray-300 flex items-start gap-3"
              >
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-1">{factor.name}</div>
                  <div className="text-sm text-gray-700">{factor.description}</div>
                  <div className="text-xs text-gray-600 mt-2">
                    Impact: <span className="font-bold text-orange-600">{(factor.impact * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {riskAssessment.constraints && riskAssessment.constraints.length > 0 && (
        <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
          <h3 className="text-lg font-bold text-yellow-900 mb-4">⚠️ Constraints</h3>
          <ul className="space-y-2">
            {riskAssessment.constraints.map((constraint: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-yellow-800 text-sm">
                <span className="text-lg">•</span>
                <span>{constraint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RiskAssessmentPanel;
