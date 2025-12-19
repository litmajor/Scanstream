import React, { useState, useMemo } from 'react';
import { X, Bell, Zap, TrendingUp, Trophy, AlertCircle, ChevronDown } from 'lucide-react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { cn } from '@/lib/utils';

interface RealtimeEventFeedProps {
  maxVisible?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

const getEventIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'xp_gain':
      return <span className="text-lg">⭐</span>;
    case 'level_up':
      return <span className="text-lg">🎉</span>;
    case 'mood_change':
      return <span className="text-lg">😊</span>;
    case 'trade_result':
      return <TrendingUp size={16} />;
    case 'combo_activation':
      return <Zap size={16} />;
    case 'achievement_unlocked':
      return <Trophy size={16} />;
    default:
      return <Bell size={16} />;
  }
};

const RealtimeEventFeed: React.FC<RealtimeEventFeedProps> = ({
  maxVisible = 5,
  position = 'bottom-right',
  className,
}) => {
  const { events, isConnected, markAsRead, clearEvent } = useRealtime();
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleEvents = useMemo(() => {
    if (isExpanded) return events;
    return events.slice(0, maxVisible);
  }, [events, isExpanded, maxVisible]);

  const unreadCount = useMemo(() => {
    return events.filter((e) => !e.read).length;
  }, [events]);

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <div
      className={cn(
        'fixed z-50 pointer-events-none',
        positionClasses[position],
        className
      )}
    >
      {/* Connection Status Indicator */}
      <div className="mb-4 flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-full px-3 py-1.5 text-xs">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )}
          />
          <span className="text-slate-300">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Event Feed Container */}
      <div className="pointer-events-auto space-y-2">
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            onClick={() => markAsRead(event.id)}
            className={cn(
              'group p-4 rounded-lg backdrop-blur-sm border transition-all duration-300 cursor-pointer max-w-sm',
              'hover:scale-105 hover:shadow-lg',
              event.read
                ? 'bg-slate-800/40 border-slate-700'
                : 'bg-slate-800/80 border-slate-600 ring-1 ring-slate-500/20'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={cn(
                  'p-2 rounded-lg text-white flex-shrink-0',
                  event.color
                )}
              >
                {getEventIcon(event.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white text-sm">
                      {event.title}
                    </div>
                    <div className="text-slate-400 text-xs mt-1">
                      {event.description}
                    </div>
                    <div className="text-slate-500 text-xs mt-2">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearEvent(event.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand Button */}
      {events.length > maxVisible && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 pointer-events-auto w-full px-4 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition flex items-center justify-center gap-2"
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform', isExpanded && 'rotate-180')}
          />
          <span className="text-xs font-semibold">
            {isExpanded
              ? 'Collapse'
              : `Show ${events.length - maxVisible} more`}
          </span>
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-600 rounded-full text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <div className="text-center py-4 text-slate-400 text-sm pointer-events-auto">
          Waiting for events...
        </div>
      )}
    </div>
  );
};

export default RealtimeEventFeed;
