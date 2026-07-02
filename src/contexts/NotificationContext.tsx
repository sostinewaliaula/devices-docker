import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import api from '../services/apiService';
import { useAuth } from './AuthContextNew';

interface Notification {
  id: string;
  user_id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
}

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (options?: { silent?: boolean }) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
  // Toast functionality
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;
  resetAuthError: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [authError, setAuthError] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchNotifications = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent || false;
    // Don't fetch if we know there's an auth error
    if (authError) return;

    try {
      if (!silent) setLoading(true);
      const response = await api.get('/notifications');

      if (response.data.success) {
        const notifs = response.data.data.notifications;
        const count = response.data.data.unreadCount;

        // Convert is_read from number (0/1) to boolean for consistency
        const normalizedNotifs = notifs.map((n: any) => ({
          ...n,
          is_read: Boolean(n.is_read)
        }));

        setNotifications(normalizedNotifs);
        setUnreadCount(count);
        setAuthError(false); // Reset auth error on successful fetch
      }
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      // If it's an authentication error, stop retrying
      if (error.response?.status === 401) {
        setAuthError(true);
        return;
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authError]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.is_read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const resetAuthError = useCallback(() => {
    setAuthError(false);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }, [dismissToast]);

  // Fetch notifications on mount and when authentication status changes
  useEffect(() => {
    if (isAuthenticated) {
      resetAuthError();
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, fetchNotifications, resetAuthError]);

  // Set up polling for new notifications every 30 seconds (only if authenticated and no auth errors)
  useEffect(() => {
    if (!isAuthenticated || authError) return;

    const interval = setInterval(() => {
      fetchNotifications({ silent: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, authError, fetchNotifications]);

  // Listen for custom refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchNotifications();
    };

    window.addEventListener('refreshNotifications', handleRefresh);
    return () => window.removeEventListener('refreshNotifications', handleRefresh);
  }, [fetchNotifications]);

  const value: NotificationContextType = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    toasts,
    addToast,
    dismissToast,
    resetAuthError,
  }), [
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    toasts,
    addToast,
    dismissToast,
    resetAuthError,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
