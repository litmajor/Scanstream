import { LucideIcon } from 'lucide-react';

export interface InfoCardProps {
  title: string;
  content: string | React.ReactNode;
  icon?: LucideIcon;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: {
    bg: 'from-slate-800/40 to-slate-900/40',
    border: 'border-slate-700/50',
    icon: 'text-slate-400',
    title: 'text-white',
  },
  primary: {
    bg: 'from-blue-900/30 to-slate-900/40',
    border: 'border-blue-700/50',
    icon: 'text-blue-400',
    title: 'text-blue-300',
  },
  success: {
    bg: 'from-green-900/30 to-slate-900/40',
    border: 'border-green-700/50',
    icon: 'text-green-400',
    title: 'text-green-300',
  },
  warning: {
    bg: 'from-yellow-900/30 to-slate-900/40',
    border: 'border-yellow-700/50',
    icon: 'text-yellow-400',
    title: 'text-yellow-300',
  },
  info: {
    bg: 'from-cyan-900/30 to-slate-900/40',
    border: 'border-cyan-700/50',
    icon: 'text-cyan-400',
    title: 'text-cyan-300',
  },
};

const sizeStyles = {
  sm: {
    padding: 'p-3',
    title: 'text-sm',
    content: 'text-xs',
    icon: 'w-4 h-4',
  },
  md: {
    padding: 'p-4',
    title: 'text-base',
    content: 'text-sm',
    icon: 'w-5 h-5',
  },
  lg: {
    padding: 'p-6',
    title: 'text-lg',
    content: 'text-base',
    icon: 'w-6 h-6',
  },
};

export default function InfoCard({
  title,
  content,
  icon: Icon,
  variant = 'default',
  footer,
  size = 'md',
}: InfoCardProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  return (
    <div
      className={`
        bg-gradient-to-br ${styles.bg} backdrop-blur-md
        border ${styles.border}
        rounded-xl ${sizes.padding}
        shadow-lg
        transition-all duration-300
        hover:shadow-xl
      `}
    >
      <div className="flex items-start space-x-3 mb-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-900/50">
            <Icon className={`${sizes.icon} ${styles.icon}`} />
          </div>
        )}
        <h3 className={`font-bold ${sizes.title} ${styles.title}`}>
          {title}
        </h3>
      </div>

      <div className={`text-slate-400 ${sizes.content}`}>
        {typeof content === 'string' ? (
          <p>{content}</p>
        ) : (
          content
        )}
      </div>

      {footer && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          {footer}
        </div>
      )}
    </div>
  );
}

