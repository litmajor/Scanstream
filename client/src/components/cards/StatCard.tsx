import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: {
    bg: 'from-slate-800/40 to-slate-900/40',
    border: 'border-slate-700/50',
    icon: 'text-slate-400',
    value: 'text-white',
  },
  success: {
    bg: 'from-green-900/40 to-emerald-900/40',
    border: 'border-green-700/50',
    icon: 'text-green-400',
    value: 'text-green-400',
  },
  warning: {
    bg: 'from-yellow-900/40 to-orange-900/40',
    border: 'border-yellow-700/50',
    icon: 'text-yellow-400',
    value: 'text-yellow-400',
  },
  error: {
    bg: 'from-red-900/40 to-rose-900/40',
    border: 'border-red-700/50',
    icon: 'text-red-400',
    value: 'text-red-400',
  },
  info: {
    bg: 'from-blue-900/40 to-cyan-900/40',
    border: 'border-blue-700/50',
    icon: 'text-blue-400',
    value: 'text-blue-400',
  },
};

const sizeStyles = {
  sm: {
    padding: 'p-3',
    title: 'text-xs',
    value: 'text-lg',
    icon: 'w-4 h-4',
  },
  md: {
    padding: 'p-4',
    title: 'text-sm',
    value: 'text-2xl',
    icon: 'w-5 h-5',
  },
  lg: {
    padding: 'p-6',
    title: 'text-base',
    value: 'text-3xl',
    icon: 'w-6 h-6',
  },
};

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
  variant = 'default',
  size = 'md',
}: StatCardProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  // Auto-detect trend from change if not provided
  const displayTrend = trend || (change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : undefined);

  return (
    <div
      className={`
        bg-gradient-to-br ${styles.bg} backdrop-blur-md
        border ${styles.border}
        rounded-xl ${sizes.padding}
        shadow-lg hover:shadow-xl
        transition-all duration-300
        hover:-translate-y-1
        group
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-slate-400 font-medium uppercase tracking-wider ${sizes.title}">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors`}>
            <Icon className={`${sizes.icon} ${styles.icon} group-hover:scale-110 transition-transform`} />
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className={`font-bold font-mono ${sizes.value} ${styles.value} leading-none mb-1`}>
            {value}
          </div>
          
          {change !== undefined && (
            <div className="flex items-center space-x-1">
              {displayTrend === 'up' && <TrendingUp className="w-3 h-3 text-green-400" />}
              {displayTrend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
              {displayTrend === 'neutral' && <Minus className="w-3 h-3 text-slate-400" />}
              <span
                className={`text-xs font-semibold ${
                  displayTrend === 'up'
                    ? 'text-green-400'
                    : displayTrend === 'down'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
              >
                {change > 0 ? '+' : ''}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-slate-500">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

