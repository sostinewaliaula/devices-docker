import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { notificationService } from '../../services/apiDatabase';
import { notificationTypeStyle } from '../../components/ui/notificationStyles';

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await notificationService.getForUser(user.id, 100);
      setItems(data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await notificationService.markAllAsRead(user.id);
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-surface border border-line rounded-2xl shadow-card">
        <p className="text-muted">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-surface border border-line rounded-2xl shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-heading">Notifications</h1>
        <button onClick={markAllAsRead} className="button-action">Mark all as read</button>
      </div>
      <div className="mt-6">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map(notification => {
              const style = notificationTypeStyle(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 rounded-xl ${style.bar} ${notification.is_read ? "bg-surface-2/60 opacity-80" : "bg-lightblue/50 dark:bg-surface-2"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-heading">{notification.title}</h3>
                        {notification.type && (
                          <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full ${style.pill}`}>{notification.type}</span>
                        )}
                        {!notification.is_read && <span className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                      </div>
                      <p className="mt-1 text-sm text-content">{notification.message}</p>
                      <p className="mt-1 text-xs text-muted">{new Date(notification.created_at).toLocaleString()}</p>
                    </div>
                    {!notification.is_read && (
                      <button onClick={() => markAsRead(notification.id)} className="px-3 py-1 text-xs font-medium whitespace-nowrap rounded-full text-secondary bg-lightblue hover:bg-secondary hover:text-white dark:text-accent dark:bg-accent/15 dark:hover:bg-accent dark:hover:text-secondary">Mark as read</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted">No notifications to display</p>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
