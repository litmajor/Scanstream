/**
 * Opportunities Grid Component
 * 
 * Responsive grid displaying trade opportunities with:
 * - Type badges (SCALP/DAY/SWING)
 * - Direction indicators
 * - Entry zones and targets
 * - Risk/Reward ratios
 * - Probability and source information
 * - Sorting and card interactions
 * 
 * Used in: ScoutReportViewer (opportunities view mode)
 */

import React, { useState, useMemo } from 'react';
import DirectionBadge from './DirectionBadge';
import ConfidenceBar from './ConfidenceBar';
import RiskRewardLabel from './RiskRewardLabel';
import SourceIcon from './SourceIcon';
import type { TradeOpportunity, TradeType } from '../../types/scout-report-types';

interface OpportunitiesGridProps {
  opportunities: TradeOpportunity[];
  onSelectOpportunity?: (opportunity: TradeOpportunity) => void;
  className?: string;
}

type SortOption = 'riskReward' | 'confidence' | 'probability' | 'quality' | 'duration';

export const OpportunitiesGrid: React.FC<OpportunitiesGridProps> = ({
  opportunities,
  onSelectOpportunity,
  className,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('riskReward');

  // Sort opportunities
  const sortedOpportunities = useMemo(() => {
    const sorted = [...opportunities];

    switch (sortBy) {
      case 'riskReward':
        sorted.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
        break;
      case 'confidence':
        sorted.sort((a, b) => b.confidence - a.confidence);
        break;
      case 'probability':
        sorted.sort((a, b) => b.probability - a.probability);
        break;
      case 'quality':
        sorted.sort((a, b) => b.qualityScore - a.qualityScore);
        break;
      case 'duration':
        const typeOrder: Record<TradeType, number> = { SCALP: 0, DAY: 1, SWING: 2, POSITION: 3 };
        sorted.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
        break;
    }

    return sorted;
  }, [opportunities, sortBy]);

  // Get color for trade type
  const getTypeColor = (type: TradeType): string => {
    switch (type) {
      case 'SCALP':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'DAY':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SWING':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sorting Controls */}
      <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <span className="text-sm font-semibold text-gray-700">Sort by:</span>
        <div className="flex gap-2 flex-wrap">
          {(['riskReward', 'confidence', 'probability', 'quality', 'duration'] as SortOption[]).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${
                  sortBy === option
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }
              `}
            >
              {option === 'riskReward'
                ? 'Risk/Reward'
                : option === 'confidence'
                  ? 'Confidence'
                  : option === 'probability'
                    ? 'Probability'
                    : option === 'quality'
                      ? 'Quality'
                      : 'Duration'}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing <strong>{sortedOpportunities.length}</strong> opportunity{sortedOpportunities.length !== 1 ? 'ies' : ''}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedOpportunities.map((opp) => (
          <div
            key={opp.id}
            onClick={() => onSelectOpportunity?.(opp)}
            className={`
              bg-white rounded-lg border-2 border-gray-200 p-4
              transition-all hover:shadow-lg hover:border-blue-300 cursor-pointer
              ${onSelectOpportunity ? 'hover:scale-105' : ''}
            `}
          >
            {/* Header: Type Badge and Direction */}
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getTypeColor(opp.type)}`}>
                {opp.type}
              </span>
              <DirectionBadge direction={opp.direction} size="sm" />
            </div>

            {/* Entry Zone */}
            <div className="mb-3">
              <p className="text-xs text-gray-600 font-medium mb-1">ENTRY ZONE</p>
              <p className="text-lg font-bold text-gray-800">
                {opp.entryZone.low.toFixed(2)} - {opp.entryZone.high.toFixed(2)}
              </p>
            </div>

            {/* Targets */}
            <div className="mb-3">
              <p className="text-xs text-gray-600 font-medium mb-1">TARGETS</p>
              <div className="space-y-1">
                {opp.targets.map((target, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">T{idx + 1}:</span>
                    <span className="font-semibold text-green-600">{target.level.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk/Reward - Prominent */}
            <div className="mb-3 p-2 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
              <RiskRewardLabel risk={opp.stopLoss.price} reward={opp.targets[0]?.level || 0} size="md" />
            </div>

            {/* Confidence Bar */}
            <ConfidenceBar value={opp.confidence * 100} label="Confidence" showPercentage size="sm" />

            {/* Probability and Quality Score */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-blue-50 rounded p-2 border border-blue-200">
                <div className="text-xs text-blue-600 font-medium">Probability</div>
                <div className="text-lg font-bold text-blue-800">{(opp.probability * 100).toFixed(0)}%</div>
              </div>
              <div className="bg-purple-50 rounded p-2 border border-purple-200">
                <div className="text-xs text-purple-600 font-medium">Quality</div>
                <div className="text-lg font-bold text-purple-800">{opp.qualityScore.toFixed(1)}/10</div>
              </div>
            </div>

            {/* Supporting Sources */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 font-medium mb-2">SOURCES</p>
              <div className="flex gap-2">
                {opp.supportingSources?.map((source, idx) => (
                  <SourceIcon key={idx} source={source.source} size="sm" showLabel={false} />
                ))}
              </div>
            </div>

            {/* Details Button */}
            {onSelectOpportunity && (
              <button
                className="
                  w-full mt-4 px-3 py-2 bg-blue-500 text-white text-sm font-semibold
                  rounded-lg hover:bg-blue-600 transition-colors
                "
              >
                View Details →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedOpportunities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No opportunities found</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};

export default OpportunitiesGrid;
