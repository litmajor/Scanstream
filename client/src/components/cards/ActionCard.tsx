import { LucideIcon, ArrowRight } from 'lucide-react';

export interface ActionCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  href?: string;
  badge?: string;
}

const variantStyles = {
  default: {
    bg: 'from-slate-800/40 to-slate-900/40',
    bgHover: 'group-hover:from-slate-700/50 group-hover:to-slate-800/50',
    border: 'border-slate-700/50',
    borderHover: 'group-hover:border-slate-600/70',
    icon: 'text-slate-400 group-hover:text-white',
    arrow: 'text-slate-500 group-hover:text-white',
  },
  primary: {
    bg: 'from-blue-900/40 to-blue-800/40',
    bgHover: 'group-hover:from-blue-800/60 group-hover:to-blue-700/60',
    border: 'border-blue-700/50',
    borderHover: 'group-hover:border-blue-600/70',
    icon: 'text-blue-400 group-hover:text-blue-300',
    arrow: 'text-blue-500 group-hover:text-blue-300',
  },
  success: {
    bg: 'from-green-900/40 to-emerald-800/40',
    bgHover: 'group-hover:from-green-800/60 group-hover:to-emerald-700/60',
    border: 'border-green-700/50',
    borderHover: 'group-hover:border-green-600/70',
    icon: 'text-green-400 group-hover:text-green-300',
    arrow: 'text-green-500 group-hover:text-green-300',
  },
  warning: {
    bg: 'from-yellow-900/40 to-orange-800/40',
    bgHover: 'group-hover:from-yellow-800/60 group-hover:to-orange-700/60',
    border: 'border-yellow-700/50',
    borderHover: 'group-hover:border-yellow-600/70',
    icon: 'text-yellow-400 group-hover:text-yellow-300',
    arrow: 'text-yellow-500 group-hover:text-yellow-300',
  },
  danger: {
    bg: 'from-red-900/40 to-rose-800/40',
    bgHover: 'group-hover:from-red-800/60 group-hover:to-rose-700/60',
    border: 'border-red-700/50',
    borderHover: 'group-hover:border-red-600/70',
    icon: 'text-red-400 group-hover:text-red-300',
    arrow: 'text-red-500 group-hover:text-red-300',
  },
};

export default function ActionCard({
  title,
  description,
  icon: Icon,
  onClick,
  variant = 'default',
  disabled = false,
  href,
  badge,
}: ActionCardProps) {
  const styles = variantStyles[variant];
  const Component = href ? 'a' : 'button';

  return (
    <Component
      onClick={!disabled ? onClick : undefined}
      href={href}
      disabled={disabled}
      className={`
        group relative w-full text-left
        bg-gradient-to-br ${styles.bg} ${styles.bgHover} backdrop-blur-md
        border ${styles.border} ${styles.borderHover}
        rounded-xl p-6
        shadow-lg hover:shadow-2xl
        transition-all duration-300
        hover:-translate-y-1 hover:scale-[1.02]
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        overflow-hidden
      `}
    >
      {/* Animated gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {Icon && (
              <div className="p-3 rounded-lg bg-slate-900/50 group-hover:bg-slate-800/70 transition-colors">
                <Icon className={`w-6 h-6 ${styles.icon} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`} />
              </div>
            )}
            <h3 className="text-lg font-bold text-white group-hover:text-slate-100 transition-colors">
              {title}
            </h3>
          </div>

          {badge && (
            <span className="px-2 py-1 text-xs font-semibold bg-slate-700/50 text-slate-300 rounded-full">
              {badge}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors mb-4">
          {description}
        </p>

        <div className="flex items-center text-sm font-medium">
          <span className={`${styles.arrow.split(' ')[0]} group-hover:text-white transition-colors`}>
            {disabled ? 'Unavailable' : 'Take action'}
          </span>
          <ArrowRight className={`w-4 h-4 ml-2 ${styles.arrow} transition-all duration-300 group-hover:translate-x-1`} />
        </div>
      </div>
    </Component>
  );
}

