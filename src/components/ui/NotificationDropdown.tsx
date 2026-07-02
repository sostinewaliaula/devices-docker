import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { BellIcon, CheckIcon } from 'lucide-react';
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
    <div ref={dropdownRef} className="absolute right-0 w-80 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-card z-50">
      <div className="py-2 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-4">
          <p className="text-sm font-bold text-primary dark:text-primary">Notifications</p>
          <button onClick={markAllAsRead} className="text-xs font-medium text-secondary hover:underline">Mark all as read</button>
        </div>
      </div>
      <div className="h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500">Loading...</div>
        ) : unreadNotifications.length > 0 ? (
          unreadNotifications.map(notification => (
            <div key={notification.id} className={`px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800 ${notification.is_read ? 'bg-white dark:bg-gray-900' : 'bg-lightred dark:bg-gray-800'}`}>
              <div className="flex items-start">
                <div className={`p-1 mr-3 rounded-full ${notification.type === 'info' ? 'bg-lightblue text-secondary dark:bg-purple-900 dark:text-purple-200' : notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200' : notification.type === 'success' ? 'bg-lightred text-primary dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200'}`}>
                  <BellIcon size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-primary dark:text-primary">{notification.title}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">{notification.message}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{formatDate(notification.created_at)}</p>
                </div>
                {!notification.is_read && (
                  <button onClick={() => markAsRead(notification.id)} className="p-1 text-secondary rounded-full hover:bg-lightblue dark:hover:bg-gray-800">
                    <CheckIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <BellIcon size={32} className="text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">No unread notifications</p>
          </div>
        )}
      </div>
      <div className="py-2 text-center border-t border-gray-100 dark:border-gray-800">
        <Link to="/notifications" className="text-sm font-medium text-secondary hover:underline" onClick={onClose}>View all notifications</Link>
      </div>
    </div>
  );
};
export default NotificationDropdown;
