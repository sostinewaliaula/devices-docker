import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { notificationService } from '../../services/apiDatabase';

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
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-3xl font-bold text-primary">Notifications</h1>
      <button onClick={markAllAsRead} className="button-primary">Mark all as read</button>
    </div>
    <div className="mt-6">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map(notification => (
              <div key={notification.id} className={`p-4 border-l-4 rounded-xl ${notification.is_read ? 'bg-lightred border-primary dark:bg-green-900 dark:bg-opacity-20' : 'bg-lightblue border-secondary dark:bg-purple-900 dark:bg-opacity-20'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{notification.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{notification.message}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{new Date(notification.created_at).toLocaleString()}</p>
                  </div>
                  {!notification.is_read && (
                    <button onClick={() => markAsRead(notification.id)} className="px-2 py-1 text-xs font-medium text-secondary bg-lightblue dark:bg-purple-900 dark:text-purple-200 rounded-full">Mark as read</button>
                  )}
                </div>
              </div>
            ))}
            </div>
        ) : (
          <p className="text-center text-gray-600 dark:text-gray-400">No notifications to display</p>
        )}
          </div>
    </div>
  );
};

export default NotificationsPage;
