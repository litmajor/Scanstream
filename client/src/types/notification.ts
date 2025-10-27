// Notification types and interfaces

export type NotificationCategory = 'signal' | 'trade' | 'system' | 'alert';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationStatus = 'unread' | 'read';

export interface Notification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  timestamp: Date;
  icon?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
  metadata?: Record<string, any>;
}

export interface NotificationGroup {
  category: NotificationCategory;
  notifications: Notification[];
  count: number;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  categories: {
    signal: boolean;
    trade: boolean;
    system: boolean;
    alert: boolean;
  };
}

