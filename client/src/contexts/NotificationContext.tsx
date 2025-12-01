import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
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

// Sound helper function defined outside component to avoid initialization issues
const playNotificationSoundInternal = (soundEnabled: boolean) => {
  if (!soundEnabled) return;

  // Create a simple beep sound using Web Audio API
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.JSON.parse(saved) : {
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
        playNotificationSoundInternal(settings.soundEnabled);
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
  }, [settings.soundEnabled, showDesktopNotification]); // Added settings.soundEnabled as dependency

  // Unread count
  const unreadCount = notifications.filter(n => n.status === 'unread').length;

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

    // Play sound if enabled
    if (settings.soundEnabled) {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.warn('Failed to play notification sound:', err));
    }

    // Show desktop notification for high+ priority
    if (priority === 'high' || priority === 'urgent') {
      showDesktopNotification(title, message, priority);
    }
  }, [settings.soundEnabled, showDesktopNotification]);


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