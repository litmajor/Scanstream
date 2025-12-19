/**
 * SourceIcon Component
 * 
 * Displays icon for each signal source (ML, Scanner, Agents, Price Action)
 * Used in: OpportunitiesGrid, SourceAnalysisPanel, ConsensusDashboard
 */

import React from 'react';
import type { SourceType } from '../../types/scout-report-types';

interface SourceIconProps {
  source: SourceType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  title?: string;
}

const sourceConfig: Record<SourceType, { icon: string; label: string; bg: string; text: string }> = {
  ML: {
    icon: '🤖',
    label: 'ML Model',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
  },
  SCANNER: {
    icon: '📊',
    label: 'Scanner',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  AGENTS: {
    icon: '🦾',
    label: 'Agents',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
  },
  PRICE_ACTION: {
    icon: '📈',
    label: 'Price Action',
    bg: 'bg-green-100',
    text: 'text-green-700',
  },
};

const sizeClasses = {
  sm: 'w-6 h-6 text-sm',
  md: 'w-8 h-8 text-lg',
  lg: 'w-10 h-10 text-2xl',
};

export const SourceIcon: React.FC<SourceIconProps> = ({
  source,
  size = 'md',
  showLabel = false,
  className,
  title,
}) => {
  const config = sourceConfig[source as SourceType];

  return (
    <div
      className={`
        inline-flex items-center gap-2 ${className}
        ${showLabel ? `${config.bg} ${config.text} px-3 py-1.5 rounded-full` : ''}
      `}
      title={title || config.label}
    >
      <span className={sizeClasses[size]}>{config.icon}</span>
      {showLabel && <span className="text-sm font-medium">{config.label}</span>}
    </div>
  );
};

export default SourceIcon;
