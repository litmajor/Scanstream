/**
 * DirectionBadge Component
 * 
 * Displays trade direction with color coding
 * Used in: OpportunitiesGrid, ConsensusDashboard, TradeDetailModal
 */

import React from 'react';
import type { Direction } from '../../types/scout-report-types';

interface DirectionBadgeProps {
  direction: Direction;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const directionConfig = {
  BULLISH: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    icon: '📈',
    label: 'Bullish',
  },
  BEARISH: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: '📉',
    label: 'Bearish',
  },
  NEUTRAL: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    icon: '➡️',
    label: 'Neutral',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export const DirectionBadge: React.FC<DirectionBadgeProps> = ({
  direction,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const config = directionConfig[direction as Direction];

  return (
    <div
      className={`
        inline-flex items-center gap-2 font-semibold rounded-full border-2
        ${sizeClasses[size]} ${config.bg} ${config.text} ${config.border}
        ${className}
      `}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </div>
  );
};

export default DirectionBadge;
