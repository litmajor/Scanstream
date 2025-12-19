/**
 * Executive Summary Section Component
 * 
 * High-level overview of scout report with:
 * - Key metrics (direction, confidence, agreement, conviction)
 * - Consensus visualization
 * - Alternative scenarios
 * 
 * Used in: ScoutReportViewer (primary display)
 */

import React, { useMemo } from 'react';
import MetricCard from './MetricCard';
import DirectionBadge from './DirectionBadge';
import ConfidenceBar from './ConfidenceBar';
import SourceIcon from './SourceIcon';
import type { ExecutiveSummary, AlternativeView } from '../../types/scout-report-types';

interface ExecutiveSummaryProps {
  summary: ExecutiveSummary;
  alternatives?: AlternativeView[];
  className?: string;
}

export const ExecutiveSummarySection: React.FC<ExecutiveSummaryProps> = ({
  summary,
  alternatives = [],
  className,
}) => {
  // Calculate conviction level from confidence and agreement
  const convictionLevel = useMemo(() => {
    const combined = (summary.confidence + summary.agreement) / 2;
    if (combined >= 0.8) return { level: 'Very Strong', color: 'green' };
    if (combined >= 0.6) return { level: 'Strong', color: 'blue' };
    if (combined >= 0.4) return { level: 'Moderate', color: 'orange' };
    return { level: 'Weak', color: 'red' };
  }, [summary.confidence, summary.agreement]);

  // Determine urgency from strength
  const urgencyBadge = useMemo(() => {
    if (summary.strength >= 8) return { text: 'Urgent', color: 'red' };
    if (summary.strength >= 6) return { text: 'High Priority', color: 'orange' };
    if (summary.strength >= 4) return { text: 'Normal', color: 'blue' };
    return { text: 'Low Priority', color: 'gray' };
  }, [summary.strength]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Direction and Recommendation */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-6 border-2 border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 mb-2">PRIMARY DIRECTION</h2>
            <DirectionBadge direction={summary.direction} size="lg" />
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-600 mb-1">RECOMMENDATION</div>
            <div className="text-lg font-bold text-slate-800">{summary.recommendation}</div>
          </div>
        </div>

        {/* Urgency Badge */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-300">
          <span
            className={`
              px-3 py-1 rounded-full text-sm font-semibold
              ${urgencyBadge.color === 'red' ? 'bg-red-100 text-red-700' : ''}
              ${urgencyBadge.color === 'orange' ? 'bg-orange-100 text-orange-700' : ''}
              ${urgencyBadge.color === 'blue' ? 'bg-blue-100 text-blue-700' : ''}
              ${urgencyBadge.color === 'gray' ? 'bg-gray-100 text-gray-700' : ''}
            `}
          >
            {urgencyBadge.text}
          </span>
          <span className="text-xs text-gray-600">Signal Strength: {summary.strength.toFixed(1)}/10</span>
        </div>
      </div>

      {/* Key Metrics - 4 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Confidence */}
        <MetricCard
          label="Confidence"
          value={Math.round(summary.confidence * 100)}
          unit="%"
          barValue={summary.confidence * 100}
          color="blue"
          icon="📊"
        />

        {/* Source Agreement */}
        <MetricCard
          label="Source Agreement"
          value={Math.round(summary.agreement * 100)}
          unit="%"
          barValue={summary.agreement * 100}
          color="green"
          icon="🤝"
        />

        {/* Conviction Level */}
        <MetricCard
          label="Conviction"
          value={convictionLevel.level}
          color={convictionLevel.color as any}
          icon="💪"
        />

        {/* Signal Strength */}
        <MetricCard
          label="Signal Strength"
          value={summary.strength.toFixed(1)}
          unit="/10"
          barValue={(summary.strength / 10) * 100}
          color="orange"
          icon="⚡"
        />
      </div>

      {/* Confidence Details with Progress */}
      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">CONFIDENCE TREND</h3>
        <ConfidenceBar value={summary.confidence * 100} label="Overall Confidence" showPercentage size="lg" />
        {summary.confidenceTrend && (
          <div className="mt-3 text-sm text-gray-600">
            <span className={summary.confidenceTrend > 0 ? 'text-green-600' : 'text-red-600'}>
              {summary.confidenceTrend > 0 ? '↑' : '↓'} {Math.abs(summary.confidenceTrend).toFixed(1)}% from previous
            </span>
          </div>
        )}
      </div>

      {/* Alternative Scenarios */}
      {alternatives.length > 0 && (
        <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">ALTERNATIVE SCENARIOS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alternatives.map((alt, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-300 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <DirectionBadge direction={alt.direction} size="sm" />
                  <span className="text-xs font-bold text-gray-700">
                    {Math.round(alt.probability * 100)}%
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  <strong>Trigger:</strong> {alt.triggerCondition}
                </div>
                <div className="text-xs text-gray-700">
                  <strong>Target:</strong> {alt.targetPrice.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Text */}
      {summary.summary && (
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-700 leading-relaxed">{summary.summary}</p>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummarySection;
