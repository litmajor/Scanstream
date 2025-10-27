import { useState } from 'react';
import { X, Check, Clock, TrendingUp, AlertTriangle, Info, Zap } from 'lucide-react';
import type { Notification } from '../types/notification';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction?: (id: string) => void;
}

const categoryIcons = {
  signal: Zap,
  trade: TrendingUp,
  system: Info,
  alert: AlertTriangle,
};

const priorityColors = {
  low: 'text-slate-400 bg-slate-800/30 border-slate-700/50',
  medium: 'text-blue-400 bg-blue-800/30 border-blue-700/50',
  high: 'text-yellow-400 bg-yellow-800/30 border-yellow-700/50',
  urgent: 'text-red-400 bg-red-800/30 border-red-700/50',
};

const categoryColors = {
  signal: 'text-purple-400',
  trade: 'text-green-400',
  system: 'text-blue-400',
  alert: 'text-red-400',
};

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onAction,
}: NotificationItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = categoryIcons[notification.category];
  const isUnread = notification.status === 'unread';

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div
      className={`
        relative p-4 rounded-lg transition-all duration-200
        ${priorityColors[notification.priority]}
        ${isUnread ? 'border-l-4' : 'border-l-2'}
        ${isHovered ? 'shadow-lg scale-[1.01]' : 'shadow-md'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Unread Indicator */}
      {isUnread && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      )}

      {/* Header */}
      <div className="flex items-start space-x-3 mb-2">
        <div className={`p-2 rounded-lg bg-slate-900/50 ${categoryColors[notification.category]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white truncate">
              {notification.title}
            </h4>
            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
              {formatTimestamp(notification.timestamp)}
            </span>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">
            {notification.category}
          </p>
        </div>
      </div>

      {/* Message */}
      <p className="text-sm text-slate-300 mb-3 leading-relaxed">
        {notification.message}
      </p>

      {/* Metadata */}
      {notification.metadata && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(notification.metadata).map(([key, value]) => (
            <span
              key={key}
              className="px-2 py-1 bg-slate-900/50 rounded text-xs text-slate-400"
            >
              <span className="font-medium">{key}:</span> {String(value)}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-2">
        {notification.actionLabel && (
          <button
            onClick={() => {
              onAction?.(notification.id);
              onMarkAsRead(notification.id);
            }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
          >
            {notification.actionLabel}
          </button>
        )}
        
        {isUnread && (
          <button
            onClick={() => onMarkAsRead(notification.id)}
            className="p-1.5 hover:bg-slate-700/50 rounded-md transition-colors group"
            title="Mark as read"
          >
            <Check className="w-4 h-4 text-slate-400 group-hover:text-green-400" />
          </button>
        )}
        
        <button
          onClick={() => onDismiss(notification.id)}
          className="p-1.5 hover:bg-slate-700/50 rounded-md transition-colors group ml-auto"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
        </button>
      </div>
    </div>
  );
}

