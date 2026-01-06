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

      {/* Market Conditions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Market Conditions */}
        <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-300">
          <h3 className="text-lg font-bold text-blue-900 mb-4">📊 Market Conditions</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Trend:</span>
              <span className="ml-2 font-semibold text-blue-900">{riskAssessment.marketConditions.trend}</span>
            </div>
            <div>
              <span className="text-gray-600">Volatility:</span>
              <span className="ml-2 font-semibold text-blue-900">{riskAssessment.marketConditions.volatility}</span>
            </div>
            <div>
              <span className="text-gray-600">Liquidity:</span>
              <span className="ml-2 font-semibold text-blue-900">{riskAssessment.marketConditions.liquidityLevel}</span>
            </div>
            <div>
              <span className="text-gray-600">Regime Stability:</span>
              <span className="ml-2 font-semibold text-blue-900">{riskAssessment.marketConditions.regimeStability}</span>
            </div>
          </div>
        </div>

        {/* Risk Constraints */}
        <div className="bg-orange-50 rounded-lg p-6 border-2 border-orange-300">
          <h3 className="text-lg font-bold text-orange-900 mb-4">⚙️ Risk Constraints</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-orange-600 font-medium">Max Position Size</div>
              <div className="text-lg font-bold text-orange-900">{riskAssessment.constraints.maxPositionPercent.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-orange-600 font-medium">Daily Risk Limit</div>
              <div className="text-lg font-bold text-orange-900">{riskAssessment.constraints.dailyRiskLimitPercent.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-orange-600 font-medium">Recommended Stop %</div>
              <div className="text-lg font-bold text-orange-900">{riskAssessment.constraints.recommendedStopPercent.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Price Highlight */}
      {currentPrice && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-300">
          <div className="text-sm text-blue-600 font-medium mb-1">Current Price</div>
          <div className="text-3xl font-bold text-blue-900">{currentPrice.toFixed(2)}</div>
        </div>
      )}



      {/* Risk Factors */}
      {riskAssessment.factors && riskAssessment.factors.length > 0 && (
        <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🔍 Risk Factors</h3>
          <div className="space-y-3">
            {riskAssessment.factors.map((factor: RiskFactor, idx: number) => (
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

      {/* Warnings and Critical Issues */}
      {(riskAssessment.warnings?.length > 0 || riskAssessment.criticalIssues?.length > 0) && (
        <div className="space-y-4">
          {riskAssessment.warnings && riskAssessment.warnings.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-6 border-2 border-yellow-300">
              <h3 className="text-lg font-bold text-yellow-900 mb-4">⚠️ Warnings</h3>
              <ul className="space-y-2">
                {riskAssessment.warnings.map((warning: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-yellow-800 text-sm">
                    <span className="text-lg">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {riskAssessment.criticalIssues && riskAssessment.criticalIssues.length > 0 && (
            <div className="bg-red-50 rounded-lg p-6 border-2 border-red-300">
              <h3 className="text-lg font-bold text-red-900 mb-4">🚨 Critical Issues</h3>
              <ul className="space-y-2">
                {riskAssessment.criticalIssues.map((issue: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-red-800 text-sm">
                    <span className="text-lg">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RiskAssessmentPanel;
