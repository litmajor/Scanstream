/**
 * ConfidenceBar Component
 * 
 * Visual confidence indicator with percentage and color gradient
 * Used in: MetricCard, OpportunitiesGrid, ConsensusDashboard
 */

import React from 'react';

interface ConfidenceBarProps {
  value: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const getConfidenceColor = (value: number): string => {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-blue-500';
  if (value >= 40) return 'bg-yellow-500';
  if (value >= 20) return 'bg-orange-500';
  return 'bg-red-500';
};

const getConfidenceTextColor = (value: number): string => {
  if (value >= 80) return 'text-green-600';
  if (value >= 60) return 'text-blue-600';
  if (value >= 40) return 'text-yellow-600';
  if (value >= 20) return 'text-orange-600';
  return 'text-red-600';
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const labelSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  value,
  label,
  showPercentage = true,
  size = 'md',
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const colorClass = getConfidenceColor(clampedValue);
  const textColorClass = getConfidenceTextColor(clampedValue);

  return (
    <div className={`w-full ${className}`}>
      {/* Label and percentage */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className={`${labelSizeClasses[size]} font-medium text-gray-700`}>{label}</span>}
          {showPercentage && (
            <span className={`${labelSizeClasses[size]} font-semibold ${textColorClass}`}>
              {clampedValue.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* Bar container */}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${colorClass} h-full rounded-full transition-all duration-300`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};

export default ConfidenceBar;
