import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Notification, NotificationCategory, NotificationPriority, NotificationSettings } from '../types/notification';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
  addNotification: (
    category: NotificationCategory,
    priority: NotificationPriority,
    title: string,
    message: string,
    options?: {
      actionLabel?: string;
      actionUrl?: string;
      onAction?: () => void;
      metadata?: Record<string, any>;
    }
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  toggleSound: () => void;
  toggleDesktopNotifications: () => void;
  requestDesktopPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      desktopEnabled: false,
      categories: {
        signal: true,
        trade: true,
        system: true,
        alert: true,
      },
    };
  });

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }, [settings]);

  // Listen for WebSocket notifications
  useEffect(() => {
    const handleWebSocketNotification = (event: CustomEvent) => {
      const notification = event.detail;

      // Add the notification to state
      setNotifications(prev => [notification, ...prev]);

      // Play sound for medium+ priority
      if (notification.priority !== 'low') {
        playNotificationSound();
      }

      // Show desktop notification for high+ priority
      if (notification.priority === 'high' || notification.priority === 'urgent') {
        showDesktopNotification(notification.title, notification.message, notification.priority);
      }
    };

    window.addEventListener('ws-notification', handleWebSocketNotification as EventListener);

    return () => {
      window.removeEventListener('ws-notification', handleWebSocketNotification as EventListener);
    };
  }, [playNotificationSound, showDesktopNotification]);

  // Unread count
  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore audio errors (browser might block autoplay)
    });
  }, []);

  // Show desktop notification
  const showDesktopNotification = useCallback((title: string, message: string, priority: NotificationPriority) => {
    if (!settings.desktopEnabled || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const icon = '/favicon.svg';
    const urgencyTag = priority === 'urgent' ? '🚨 ' : priority === 'high' ? '⚠️ ' : '';

    new Notification(`${urgencyTag}${title}`, {
      body: message,
      icon,
      badge: icon,
      tag: `notification-${Date.now()}`,
      requireInteraction: priority === 'urgent',
    });
  }, [settings.desktopEnabled]);

  // Add notification
  const addNotification = useCallback((
    category: NotificationCategory,
    priority: NotificationPriority,
    title: string,
    message: string,
    options?: {
      actionLabel?: string;
      actionUrl?: string;
      onAction?: () => void;
      metadata?: Record<string, any>;
    }
  ) => {
    const newNotification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category,
      priority,
      status: 'unread',
      title,
      message,
      timestamp: new Date(),
      ...options,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Play sound for medium+ priority
    if (priority !== 'low') {
      playNotificationSound();
    }

    // Show desktop notification for high+ priority
    if (priority === 'high' || priority === 'urgent') {
      showDesktopNotification(title, message, priority);
    }
  }, [playNotificationSound, showDesktopNotification]);

  // Mark as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, status: 'read' as const } : n))
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, status: 'read' as const }))
    );
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  // Toggle desktop notifications
  const toggleDesktopNotifications = useCallback(() => {
    setSettings(prev => ({ ...prev, desktopEnabled: !prev.desktopEnabled }));
  }, []);

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    settings,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    toggleSound,
    toggleDesktopNotifications,
    requestDesktopPermission,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}