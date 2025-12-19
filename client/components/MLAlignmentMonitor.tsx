/**
 * Real-Time ML Alignment Notifications
 * 
 * Monitors ML consensus and scanner signals for alignment changes,
 * displays real-time notifications and maintains notification history.
 * 
 * Features:
 * - Real-time alignment/conflict detection
 * - Notification toast system
 * - Alignment history log
 * - High-confidence signal alerts
 * - Sound notifications (optional)
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface AlignmentNotification {
  id: string;
  symbol: string;
  timestamp: number;
  type: 'aligned' | 'conflict' | 'high-confidence' | 'regime-change';
  scannerDirection?: string;
  mlDirection?: string;
  confidence?: number;
  message: string;
  actionable?: boolean;
}

interface MLAlignmentMonitorProps {
  symbols: string[];
  onNotification?: (notification: AlignmentNotification) => void;
  enableSoundNotifications?: boolean;
  showToast?: boolean;
  maxHistorySize?: number;
}

/**
 * Notification toast component
 */
const NotificationToast: React.FC<{
  notification: AlignmentNotification;
  onClose: () => void;
  autoClose?: number;
}> = ({ notification, onClose, autoClose = 5000 }) => {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  const getStyles = () => {
    switch (notification.type) {
      case 'aligned':
        return { bg: 'bg-green-50', border: 'border-green-300', icon: '✓', color: 'text-green-800' };
      case 'conflict':
        return { bg: 'bg-yellow-50', border: 'border-yellow-300', icon: '⚠', color: 'text-yellow-800' };
      case 'high-confidence':
        return { bg: 'bg-blue-50', border: 'border-blue-300', icon: '🎯', color: 'text-blue-800' };
      case 'regime-change':
        return { bg: 'bg-orange-50', border: 'border-orange-300', icon: '📊', color: 'text-orange-800' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-300', icon: 'ℹ', color: 'text-gray-800' };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`${styles.bg} ${styles.border} border-2 rounded-lg p-4 shadow-lg animate-slideIn flex items-start justify-between gap-3 max-w-md`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{styles.icon}</span>
        <div>
          <p className={`font-semibold ${styles.color}`}>{notification.symbol}</p>
          <p className={`text-sm ${styles.color}`}>{notification.message}</p>
          {notification.confidence && (
            <p className="text-xs text-gray-600 mt-1">
              Confidence: {(notification.confidence * 100).toFixed(0)}%
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
};

/**
 * Main alignment monitor component
 */
export const MLAlignmentMonitor: React.FC<MLAlignmentMonitorProps> = ({
  symbols,
  onNotification,
  enableSoundNotifications = false,
  showToast = true,
  maxHistorySize = 50,
}) => {
  const [notifications, setNotifications] = useState<AlignmentNotification[]>([]);
  const [displayedToasts, setDisplayedToasts] = useState<Map<string, AlignmentNotification>>(new Map());
  const queryClient = useQueryClient();
  const previousDataRef = useRef<Map<string, any>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch ML predictions for all symbols
  const { data: predictions } = useQuery({
    queryKey: ['ml-alignment-monitor', symbols],
    queryFn: async () => {
      const results = await Promise.all(
        symbols.map(symbol =>
          fetch(`/api/ml/mtf/predictions/${symbol}`)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      );
      return results.filter(Boolean);
    },
    refetchInterval: 30000, // 30 seconds
    enabled: symbols.length > 0,
  });

  // Detect alignment changes
  useEffect(() => {
    if (!predictions) return;

    predictions.forEach((pred: any) => {
      const symbol = pred.symbol;
      const previousPred = previousDataRef.current.get(symbol);

      // Check for alignment changes
      if (previousPred) {
        const previousConfidence = previousPred.consensus.confidence;
        const currentConfidence = pred.consensus.confidence;

        // Notify on high-confidence signals
        if (currentConfidence > 0.85 && previousConfidence <= 0.85) {
          const notif: AlignmentNotification = {
            id: `high-conf-${symbol}-${Date.now()}`,
            symbol,
            timestamp: Date.now(),
            type: 'high-confidence',
            mlDirection: pred.consensus.direction,
            confidence: currentConfidence,
            message: `Strong ${pred.consensus.direction} signal detected (${(currentConfidence * 100).toFixed(0)}% confidence)`,
            actionable: true,
          };
          addNotification(notif);
        }

        // Notify on direction changes
        if (previousPred.consensus.direction !== pred.consensus.direction) {
          const notif: AlignmentNotification = {
            id: `direction-change-${symbol}-${Date.now()}`,
            symbol,
            timestamp: Date.now(),
            type: 'conflict',
            mlDirection: pred.consensus.direction,
            confidence: currentConfidence,
            message: `Direction changed: ${previousPred.consensus.direction} → ${pred.consensus.direction}`,
            actionable: true,
          };
          addNotification(notif);
        }

        // Notify on confidence drops
        if (previousConfidence > 0.7 && currentConfidence < 0.5) {
          const notif: AlignmentNotification = {
            id: `conf-drop-${symbol}-${Date.now()}`,
            symbol,
            timestamp: Date.now(),
            type: 'regime-change',
            mlDirection: pred.consensus.direction,
            confidence: currentConfidence,
            message: `Confidence declined: ${(previousConfidence * 100).toFixed(0)}% → ${(currentConfidence * 100).toFixed(0)}%`,
            actionable: false,
          };
          addNotification(notif);
        }
      }

      // Update previous data
      previousDataRef.current.set(symbol, pred);
    });
  }, [predictions]);

  // Add notification
  const addNotification = useCallback(
    (notification: AlignmentNotification) => {
      // Add to history
      setNotifications(prev => [notification, ...prev.slice(0, maxHistorySize - 1)]);

      // Add to displayed toasts
      if (showToast) {
        setDisplayedToasts(prev => new Map(prev).set(notification.id, notification));
      }

      // Callback
      if (onNotification) {
        onNotification(notification);
      }

      // Play sound
      if (enableSoundNotifications) {
        playNotificationSound();
      }
    },
    [maxHistorySize, showToast, onNotification, enableSoundNotifications]
  );

  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Silently fail if audio can't play
      });
    }
  };

  // Remove displayed toast
  const removeToast = (id: string) => {
    setDisplayedToasts(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  return (
    <>
      {/* Hidden audio for notifications */}
      {enableSoundNotifications && (
        <audio
          ref={audioRef}
          src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==" // Simple beep sound
          preload="auto"
        />
      )}

      {/* Floating toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
        {Array.from(displayedToasts.values()).map(notification => (
          <div key={notification.id} className="pointer-events-auto">
            <NotificationToast
              notification={notification}
              onClose={() => removeToast(notification.id)}
            />
          </div>
        ))}
      </div>

      {/* Notification history panel */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-80 bg-white rounded-lg border border-gray-200 shadow-lg max-h-96 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h4 className="font-semibold text-gray-800">📋 Alignment Alerts</h4>
            <button
              onClick={() => setNotifications([])}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{notif.symbol}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
                    {notif.confidence && (
                      <p className="text-xs text-blue-600 mt-1">
                        Confidence: {(notif.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                      notif.type === 'aligned'
                        ? 'bg-green-100 text-green-700'
                        : notif.type === 'high-confidence'
                        ? 'bg-blue-100 text-blue-700'
                        : notif.type === 'conflict'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {notif.type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(notif.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 text-center">
            {notifications.length} alert{notifications.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Inline summary for signals page */}
      {notifications.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-semibold text-blue-900">
            🔔 {notifications.length} real-time ML alignment alert{notifications.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Latest: {notifications[0].message}
          </p>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default MLAlignmentMonitor;
