/**
 * RiskRewardLabel Component
 * 
 * Displays risk/reward ratio with color coding and visual indicator
 * Used in: OpportunitiesGrid, TradeDetailModal, RiskAssessmentPanel
 */

import React from 'react';

interface RiskRewardLabelProps {
  risk: number;
  reward: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

const getRiskRewardColor = (ratio: number): { bg: string; text: string; icon: string } => {
  if (ratio >= 3) return { bg: 'bg-green-100', text: 'text-green-700', icon: '🎯' };
  if (ratio >= 2) return { bg: 'bg-blue-100', text: 'text-blue-700', icon: '✓' };
  if (ratio >= 1.5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⚠️' };
  return { bg: 'bg-red-100', text: 'text-red-700', icon: '✗' };
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export const RiskRewardLabel: React.FC<RiskRewardLabelProps> = ({
  risk,
  reward,
  size = 'md',
  showDetails = false,
  className,
}) => {
  const ratio = reward / risk;
  const { bg, text, icon } = getRiskRewardColor(ratio);
  const formattedRatio = ratio.toFixed(2);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`${bg} ${text} rounded-lg font-bold ${sizeClasses[size]} inline-flex items-center gap-1.5`}>
        <span>{icon}</span>
        <span>1:{formattedRatio}</span>
      </div>

      {showDetails && (
        <div className="text-xs text-gray-600 ml-2">
          <div>R: {risk.toFixed(2)}</div>
          <div>R/R: {reward.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};

export default RiskRewardLabel;
