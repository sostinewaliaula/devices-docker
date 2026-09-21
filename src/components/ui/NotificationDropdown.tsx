import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { BellIcon, CheckIcon } from 'lucide-react';
import { notificationTypeStyle } from './notificationStyles';
interface NotificationDropdownProps {
  onClose: () => void;
}
const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const formatDate = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

  // Get unread notifications for dropdown (limit to 3)
  const unreadNotifications = notifications.filter(n => !n.is_read).slice(0, 3);

  return (
    <div ref={dropdownRef} className="absolute right-0 w-80 mt-2 overflow-hidden bg-surface border border-line rounded-2xl shadow-card z-50">
      <div className="py-3 border-b border-line">
        <div className="flex items-center justify-between px-4">
          <p className="text-sm font-bold text-heading">Notifications</p>
          <button onClick={markAllAsRead} className="text-xs font-medium text-secondary dark:text-accent hover:text-primary hover:underline">Mark all as read</button>
        </div>
      </div>
      <div className="h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted">Loading...</div>
        ) : unreadNotifications.length > 0 ? (
          unreadNotifications.map(notification => (
            <div key={notification.id} className="relative px-4 py-3 border-b last:border-b-0 border-line bg-lightblue/40 dark:bg-surface-2/60">
              {/* Unread marker */}
              <span className="absolute left-0 top-0 h-full w-1 bg-primary" aria-hidden="true" />
              <div className="flex items-start">
                <div className={`p-1.5 mr-3 rounded-full ${notificationTypeStyle(notification.type).chip}`}>
                  <BellIcon size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-heading">{notification.title}</p>
                  <p className="text-xs text-content">{notification.message}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(notification.created_at)}</p>
                </div>
                {!notification.is_read && (
                  <button onClick={() => markAsRead(notification.id)} className="p-1 rounded-full text-secondary dark:text-accent hover:bg-lightblue dark:hover:bg-surface-2" aria-label="Mark as read">
                    <CheckIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <BellIcon size={32} className="text-muted/60" />
            <p className="mt-2 text-sm font-medium text-muted">No unread notifications</p>
          </div>
        )}
      </div>
      <div className="py-3 text-center border-t border-line">
        <Link to="/notifications" className="text-sm font-medium text-secondary dark:text-accent hover:text-primary hover:underline" onClick={onClose}>View all notifications</Link>
      </div>
    </div>
  );
};
export default NotificationDropdown;
