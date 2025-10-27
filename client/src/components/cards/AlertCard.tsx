import { AlertCircle, AlertTriangle, CheckCircle, Info, X, LucideIcon } from 'lucide-react';

export interface AlertCardProps {
  title: string;
  message: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  icon?: LucideIcon;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeConfig = {
  success: {
    bg: 'from-green-900/40 to-emerald-900/40',
    border: 'border-green-700/50',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    titleColor: 'text-green-300',
    messageColor: 'text-green-400/80',
    actionBg: 'bg-green-600/30 hover:bg-green-600/50 border-green-600/50',
    actionText: 'text-green-300',
  },
  warning: {
    bg: 'from-yellow-900/40 to-orange-900/40',
    border: 'border-yellow-700/50',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-300',
    messageColor: 'text-yellow-400/80',
    actionBg: 'bg-yellow-600/30 hover:bg-yellow-600/50 border-yellow-600/50',
    actionText: 'text-yellow-300',
  },
  error: {
    bg: 'from-red-900/40 to-rose-900/40',
    border: 'border-red-700/50',
    icon: AlertCircle,
    iconColor: 'text-red-400',
    titleColor: 'text-red-300',
    messageColor: 'text-red-400/80',
    actionBg: 'bg-red-600/30 hover:bg-red-600/50 border-red-600/50',
    actionText: 'text-red-300',
  },
  info: {
    bg: 'from-blue-900/40 to-cyan-900/40',
    border: 'border-blue-700/50',
    icon: Info,
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-300',
    messageColor: 'text-blue-400/80',
    actionBg: 'bg-blue-600/30 hover:bg-blue-600/50 border-blue-600/50',
    actionText: 'text-blue-300',
  },
};

export default function AlertCard({
  title,
  message,
  type = 'info',
  icon,
  onClose,
  action,
}: AlertCardProps) {
  const config = typeConfig[type];
  const Icon = icon || config.icon;

  return (
    <div
      className={`
        relative
        bg-gradient-to-br ${config.bg} backdrop-blur-md
        border ${config.border}
        rounded-xl p-4
        shadow-lg
        animate-in slide-in-from-top duration-300
      `}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="p-2 rounded-lg bg-slate-900/50">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-sm ${config.titleColor} mb-1`}>
            {title}
          </h4>
          <p className={`text-sm ${config.messageColor}`}>
            {message}
          </p>

          {/* Action Button */}
          {action && (
            <button
              onClick={action.onClick}
              className={`
                mt-3 px-4 py-2 rounded-lg text-sm font-medium
                ${config.actionBg} ${config.actionText}
                border transition-all duration-200
                hover:scale-105
              `}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-800/50 transition-colors group"
            aria-label="Close alert"
          >
            <X className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
}

