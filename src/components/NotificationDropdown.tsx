import React from 'react';
import {
  CheckIcon,
  XIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PackageIcon,
  MessageCircleIcon,
  BellIcon
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationDropdownProps {
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Company palette: approved → Green, rejected → Red, fulfilled/comment → Blue Tint (Golden brown in dark),
  // status change → Orange, anything else → muted.
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'request_approved':
        return <CheckCircleIcon className="w-5 h-5 text-secondary dark:text-brand-green" />;
      case 'request_rejected':
        return <XCircleIcon className="w-5 h-5 text-primary" />;
      case 'request_fulfilled':
        return <PackageIcon className="w-5 h-5 text-secondary dark:text-accent" />;
      case 'comment_added':
        return <MessageCircleIcon className="w-5 h-5 text-secondary dark:text-accent" />;
      case 'status_change':
        return <ClockIcon className="w-5 h-5 text-brand-orange" />;
      default:
        return <ClockIcon className="w-5 h-5 text-muted" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async (notificationId: number, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
  };

  const handleDelete = async (notificationId: number) => {
    await deleteNotification(notificationId);
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-2 rounded w-3/4"></div>
          <div className="h-4 bg-surface-2 rounded w-1/2"></div>
          <div className="h-4 bg-surface-2 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80">
      {/* Header */}
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-lg font-semibold text-heading">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 bg-primary text-white text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-secondary dark:text-accent hover:text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted hover:text-heading"
            aria-label="Close notifications"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted">
            <BellIcon className="w-8 h-8 mx-auto mb-2 text-muted/60" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-surface-2 transition-colors ${
                  !notification.is_read ? 'bg-lightblue/40 dark:bg-surface-2/60 border-l-4 border-primary' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${
                        !notification.is_read
                          ? 'text-heading'
                          : 'text-content'
                      }`}>
                        {notification.title}
                      </p>
                      <div className="flex items-center space-x-1">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id, notification.is_read)}
                            className="text-muted hover:text-secondary dark:hover:text-brand-green"
                            title="Mark as read"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="text-muted hover:text-primary"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      {notification.message}
                    </p>
                    {notification.asset_name && (
                      <p className="text-xs text-muted mt-1">
                        Asset: {notification.asset_name}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 10 && (
        <div className="px-4 py-3 border-t border-line">
          <button className="text-sm text-secondary dark:text-accent hover:text-primary hover:underline">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
