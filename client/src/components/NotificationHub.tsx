import { useState, useMemo } from 'react';
import { X, Search, Filter, CheckCheck, Trash2, Volume2, VolumeX, Bell } from 'lucide-react';
import NotificationItem from './NotificationItem';
import type { Notification, NotificationCategory } from '../types/notification';

interface NotificationHubProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const categories: { value: NotificationCategory | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'All', emoji: '📋' },
  { value: 'signal', label: 'Signals', emoji: '⚡' },
  { value: 'trade', label: 'Trades', emoji: '💹' },
  { value: 'alert', label: 'Alerts', emoji: '🚨' },
  { value: 'system', label: 'System', emoji: 'ℹ️' },
];

export default function NotificationHub({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
  soundEnabled,
  onToggleSound,
}: NotificationHubProps) {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }

    // Unread filter
    if (showOnlyUnread) {
      filtered = filtered.filter(n => n.status === 'unread');
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        n =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      );
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, selectedCategory, showOnlyUnread, searchQuery]);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const getCategoryCount = (category: NotificationCategory | 'all') => {
    if (category === 'all') return notifications.length;
    return notifications.filter(n => n.category === category).length;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Notification Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-gradient-to-br from-slate-900/98 to-slate-950/98 backdrop-blur-xl border-l border-slate-700/50 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Bell className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Notifications</h2>
                <p className="text-sm text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-3 border-b border-slate-700/50 flex items-center space-x-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                ${selectedCategory === cat.value
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                }
              `}
            >
              <span className="mr-1.5">{cat.emoji}</span>
              {cat.label}
              <span className="ml-1.5 text-xs opacity-75">
                ({getCategoryCount(cat.value)})
              </span>
            </button>
          ))}
        </div>

        {/* Actions Bar */}
        <div className="px-6 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowOnlyUnread(!showOnlyUnread)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5
                ${showOnlyUnread
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                }
              `}
            >
              <Filter className="w-3 h-3" />
              <span>Unread Only</span>
            </button>
            
            <button
              onClick={onToggleSound}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
              title={soundEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-green-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark All Read</span>
              </button>
            )}
            
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Bell className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-400 mb-2">
                {searchQuery ? 'No matching notifications' : 'No notifications'}
              </h3>
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? 'Try a different search term'
                  : "You're all caught up! New notifications will appear here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onDismiss={onDismiss}
                onAction={(id) => {
                  notification.onAction?.();
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                  }
                }}
              />
            ))
          )}
        </div>

        {/* Footer Stats */}
        <div className="px-6 py-3 border-t border-slate-700/50 bg-slate-900/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredNotifications.length} of {notifications.length}
            </span>
            <span>
              {unreadCount} unread
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

