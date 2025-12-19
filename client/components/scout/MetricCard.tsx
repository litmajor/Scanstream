/**
 * MetricCard Component
 * 
 * Reusable metric card for displaying stats in Scout Reports
 * Used in: ExecutiveSummary, RiskAssessment, ConsensusDashboard
 */

import React from 'react';
import { formatPrice, formatMetric, formatCurrency, formatPct, autoFormat } from '../../utils/formatting';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  barValue?: number; // 0-100 for progress bar
  color?: 'green' | 'red' | 'blue' | 'orange' | 'gray';
  icon?: React.ReactNode;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  green: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
  red: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200',
  blue: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
  orange: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
  gray: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200',
};

const textColors = {
  green: 'text-green-700',
  red: 'text-red-700',
  blue: 'text-blue-700',
  orange: 'text-orange-700',
  gray: 'text-gray-700',
};

const barColors = {
  green: 'bg-green-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  gray: 'bg-gray-500',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  trend,
  trendValue,
  barValue,
  color = 'blue',
  icon,
  subtitle,
  onClick,
  className,
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <span className="text-green-600">↑</span>;
    if (trend === 'down') return <span className="text-red-600">↓</span>;
    return <span className="text-gray-600">→</span>;
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg
        ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${className}
      `}
    >
      {/* Header with icon and label */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="text-xl opacity-70">{icon}</div>}
      </div>

      {/* Value with unit */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className={`text-2xl font-bold ${textColors[color]}`}>{value}</span>
        {unit && <span className="text-sm text-gray-600">{unit}</span>}
      </div>

      {/* Trend indicator */}
      {trend && trendValue && (
        <div className="flex items-center gap-2 text-sm mb-3">
          {getTrendIcon()}
          <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
            {trendValue}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {barValue !== undefined && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`${barColors[color]} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${Math.min(100, Math.max(0, barValue))}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default MetricCard;
